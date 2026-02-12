const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const KnowledgeBaseService = require('./knowledge-base.service');

class ClaudeService {
  constructor(tokenTracker = null) {
    if (!process.env.CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY is required');
    }
    
    this.client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY
    });
    
    this.model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    this.knowledgeBase = new KnowledgeBaseService();
    this.tokenTracker = tokenTracker; // Will be set after initialization
    
    logger.info('Claude service initialized');
  }

  setTokenTracker(tracker) {
    this.tokenTracker = tracker;
  }

  async generate(prompt, options = {}) {
    try {
      const serviceName = options.serviceName || 'Unknown';
      const maxTokens = options.maxTokens || parseInt(process.env.DEFAULT_MAX_TOKENS || '1024', 10);
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      
      const text = response.content[0].text;
      
      // Track token usage
      if (this.tokenTracker) {
        await this.tokenTracker.trackUsage(
          serviceName,
          response.usage.input_tokens,
          response.usage.output_tokens
        );
      }
      
      // Log usage
      logger.info(`📊 Claude API: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);
      
      return text;
      
    } catch (error) {
      logger.error('Claude API error:', error);
      throw error;
    }
  }

  // Backward-compatible alias for older services
  async chat(prompt, options = {}) {
    return this.generate(prompt, options);
  }

  async generateWithContext(query, prompt, options = {}) {
    const context = await this.knowledgeBase.getRelevantContext(query, 2);
    
    const contextText = context.map(doc => 
      `File: ${doc.filename}\n${doc.content}`
    ).join('\n\n---\n\n');
    
    const fullPrompt = `${prompt}\n\nRelevant context:\n${contextText}`;
    
    return this.generate(fullPrompt, options);
  }
}

module.exports = ClaudeService;
