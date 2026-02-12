const logger = require('../utils/logger');

class ConversationalAssistantService {
  /**
   * @param {object} claudeService - must have .generate(prompt, options)
   * @param {object} discordService - optional, may have .sendConversationalResponse
   * @param {...any} rest - ignore any extra services passed from index.js
   */
  constructor(claudeService, discordService, ...rest) {
    this.claudeService = claudeService;
    this.discordService = discordService;

    // Keep per-user conversation history in memory
    this.activeConversations = new Map();

    logger.info('💬 Conversational Assistant starting...');
  }

  /**
   * Called from src/index.js: await assistant.start();
   * We don't need any heavy setup right now, so just log.
   */
  async start() {
    logger.info('✅ Conversational Assistant ready');
  }

  /**
   * Build a simple prompt for Claude from conversation history.
   */
  buildConversationPrompt(username, conversation) {
    const historyLines = (conversation.history || [])
      .slice(-12) // last 12 turns
      .map((turn) => {
        const speaker = turn.role === 'user' ? username : 'Assistant';
        return `${speaker}: ${turn.content}`;
      })
      .join('\n');

    return (
      `You are OpenClaw, an autonomous AI assistant helping operate a devops ` +
      `and deployment pipeline. Answer clearly and helpfully.\n\n` +
      `Conversation:\n` +
      historyLines +
      `\nAssistant:`
    );
  }

  /**
   * Handle a user message, maintain conversation history,
   * call Claude, and reply back into Discord if a msg object is provided.
   *
   * @param {string} userId
   * @param {string} username
   * @param {string} message       - plain text message
   * @param {object|null} msg      - optional Discord message object
   */
  async handleMessage(userId, username, message, msg = null) {
    try {
      // Normalize message to a safe string so substring never explodes
      const safeMessage = typeof message === 'string' ? message : '';
      const snippet = safeMessage.substring(0, 200);

      // Get or create conversation history for this user
      let conversation = this.activeConversations.get(userId) || {
        history: [],
        context: {},
        startedAt: new Date()
      };

      // Add user message to history
      conversation.history.push({
        role: 'user',
        content: safeMessage,
        timestamp: new Date()
      });

      // Build Claude prompt with conversation history
      const prompt = this.buildConversationPrompt(username, conversation);

      // Get Claude's response
      const response = await this.claudeService.generate(prompt, {
        maxTokens: 1024
      });

      // Add assistant response to history
      conversation.history.push({
        role: 'assistant',
        content: response,
        timestamp: new Date()
      });

      // Save updated conversation back to the map
      this.activeConversations.set(userId, conversation);

      // Log for your PM2 logs
      logger.info(`💬 Conversation with ${username}: ${snippet}...`);

      // Keep existing behavior – send to your notifications / log channel
      if (
        this.discordService &&
        typeof this.discordService.sendConversationalResponse === 'function'
      ) {
        await this.discordService.sendConversationalResponse(userId, response);
      }

      // Reply directly in the channel where the message came from
      if (msg && typeof msg.reply === 'function') {
        await msg.reply(response);
      }

      return response;
    } catch (error) {
      logger.error('ConversationalAssistantService.handleMessage error', {
        error: error.message,
        stack: error.stack
      });

      // Try to tell the user if we have a msg
      if (msg && typeof msg.reply === 'function') {
        try {
          await msg.reply(
            '❌ Sorry, something went wrong while processing your request.'
          );
        } catch (e) {
          // ignore reply failures
        }
      }

      throw error;
    }
  }
}

module.exports = ConversationalAssistantService;
