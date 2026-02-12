const OpenAI = require('openai');
const logger = require('../utils/logger');
const KnowledgeBaseService = require('./knowledge-base.service');

class OpenAIService {
  constructor(tokenTracker = null) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for OpenAI service');
    }

    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    this.knowledgeBase = new KnowledgeBaseService();
    this.tokenTracker = tokenTracker;

    logger.info('OpenAI service initialized');
  }

  setTokenTracker(tracker) {
    this.tokenTracker = tracker;
  }

  async generate(prompt, options = {}) {
    try {
      const serviceName = options.serviceName || 'OpenAI';
      const maxTokens =
        options.maxTokens ||
        parseInt(process.env.DYNAMIC_MAX_TOKENS || process.env.DEFAULT_MAX_TOKENS || '1024', 10);

      const model = process.env.DYNAMIC_OPENAI_MODEL || this.model;
      const concisePrefix = process.env.CONCISE_MODE === '1'
        ? 'Be concise. Return only what is asked. Avoid extra prose.\n\n'
        : '';

      const response = await this.client.responses.create({
        model,
        input: `${concisePrefix}${prompt}`,
        max_output_tokens: maxTokens
      });

      const text = response.output_text || '';

      if (this.tokenTracker && response.usage) {
        await this.tokenTracker.trackUsage(
          serviceName,
          response.usage.input_tokens || 0,
          response.usage.output_tokens || 0
        );
      }

      return text;
    } catch (error) {
      logger.error('OpenAI API error:', error);
      throw error;
    }
  }

  async chat(prompt, options = {}) {
    return this.generate(prompt, options);
  }

  async generateWithContext(query, prompt, options = {}) {
    const limit = parseInt(process.env.KB_CONTEXT_LIMIT || '2', 10);
    const context = await this.knowledgeBase.getRelevantContext(query, limit);
    const contextText = context
      .map(doc => `File: ${doc.filename}\n${doc.content}`)
      .join('\n\n---\n\n');
    const concisePrefix = process.env.CONCISE_MODE === '1'
      ? 'Be concise. Return only what is asked. Avoid extra prose.\n\n'
      : '';
    const fullPrompt = `${concisePrefix}${prompt}\n\nRelevant context:\n${contextText}`;
    return this.generate(fullPrompt, options);
  }

  async generateStructured(schema, prompt, options = {}) {
    const serviceName = options.serviceName || 'OpenAI';
    const maxTokens = options.maxTokens || parseInt(process.env.DEFAULT_MAX_TOKENS || '1024', 10);

    const model = process.env.DYNAMIC_OPENAI_MODEL || this.model;
    const response = await this.client.responses.create({
      model,
      input: prompt,
      max_output_tokens: maxTokens,
      text: {
        format: {
          type: 'json_schema',
          name: 'openclaw_code_generation',
          schema
        }
      }
    });

    const output = response.output_text || '';

    if (this.tokenTracker && response.usage) {
      await this.tokenTracker.trackUsage(
        serviceName,
        response.usage.input_tokens || 0,
        response.usage.output_tokens || 0
      );
    }

    let parsed = this.safeParseJson(output) || this.safeParseJson(this.extractJsonCandidate(output));
    if (!parsed) {
      const repaired = await this.generate(
        `Fix this JSON so it is valid. Return ONLY valid JSON, no markdown.\n\n${output}`,
        { maxTokens: 1024 }
      );
      parsed = this.safeParseJson(repaired) || this.safeParseJson(this.extractJsonCandidate(repaired));
    }
    if (!parsed) {
      throw new Error('Could not parse JSON from OpenAI structured output');
    }

    return parsed;
  }

  safeParseJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  extractJsonCandidate(text) {
    if (!text) return null;
    const fence = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fence) return fence[1];

    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }
}

module.exports = OpenAIService;
