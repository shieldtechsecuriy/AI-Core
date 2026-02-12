const logger = require('../utils/logger');

class MessageRouter {
  constructor(discordClient) {
    this.discordClient = discordClient;

    // Array of { name, priority, matcher, handler }
    this.commandHandlers = [];

    // Fallback conversational handler (e.g. uses Claude)
    this.conversationalHandlerFn = null;
  }

  /**
   * Register a Discord command handler.
   *
   * Expected signature from src/index.js:
   *   router.registerHandler(
   *     'Build Command',
   *     100,
   *     (msg) => boolean,   // matcher
   *     async (msg) => {}   // handler
   *   );
   */
  registerHandler(name, priority, matcher, handler) {
    if (typeof matcher !== 'function' || typeof handler !== 'function') {
      logger.warn('MessageRouter.registerHandler called with invalid args', {
        name,
        priority,
        matcherType: typeof matcher,
        handlerType: typeof handler,
      });
      return;
    }

    this.commandHandlers.push({ name, priority: priority || 0, matcher, handler });

    // Keep highest-priority first (not strictly required, but nice)
    this.commandHandlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    logger.info('MessageRouter: registered handler', {
      name,
      priority,
    });
  }

  /**
   * Register the conversational fallback handler.
   *
   * In src/index.js:
   *   router.registerConversationalHandler(async (msg) => {
   *     await assistant.handleMessage(msg);
   *   });
   *
   * We'll store exactly that function and call it with the Discord message object.
   */
  registerConversationalHandler(handler) {
    if (typeof handler !== 'function') {
      logger.warn(
        'MessageRouter.registerConversationalHandler called with non-function',
        { handlerType: typeof handler }
      );
      return;
    }

    this.conversationalHandlerFn = handler;
    logger.info('MessageRouter: conversational handler registered');
  }

  /**
   * Internal helper to process a single Discord message.
   */
  async handleDiscordMessage(msg) {
    try {
      if (!msg) return;
      if (msg.author && msg.author.bot) {
        // Ignore bot messages to avoid loops
        return;
      }

      // 1) Try command handlers in priority order
      for (const cmd of this.commandHandlers) {
        try {
          if (cmd.matcher(msg)) {
            logger.info('MessageRouter: command matched', { name: cmd.name });
            await cmd.handler(msg);
            return; // stop after the first matching command
          }
        } catch (err) {
          logger.error('MessageRouter: error in command matcher/handler', {
            name: cmd.name,
            error: err.message,
            stack: err.stack,
          });
          // Don't crash the whole router; just continue
          return;
        }
      }

      // 2) Fallback to conversational handler
      if (this.conversationalHandlerFn) {
        await this.conversationalHandlerFn(msg);
        return;
      }

      logger.warn('MessageRouter.handleDiscordMessage: no handler for message', {
        content: msg.content,
      });
    } catch (err) {
      logger.error('MessageRouter: error handling Discord message', {
        error: err.message,
        stack: err.stack,
      });
    }
  }

  /**
   * Initialization hook expected by src/index.js via router.initialize().
   * Here we attach the Discord message listener.
   */
  async initialize() {
    if (!this.discordClient || typeof this.discordClient.on !== 'function') {
      logger.warn(
        'MessageRouter.initialize: discordClient is not set or has no .on method'
      );
      return;
    }

    // discord.js v13+/v14 use "messageCreate"
    this.discordClient.on('messageCreate', async (msg) => {
      await this.handleDiscordMessage(msg);
    });

    logger.info(
      'MessageRouter.initialize: Discord message routing attached (messageCreate listener)'
    );
  }

  /**
   * Optional generic route method in case other parts of the app use it.
   * You can call router.routeMessage(msg) to run the same logic manually.
   */
  async routeMessage(msg) {
    return this.handleDiscordMessage(msg);
  }
}

module.exports = MessageRouter;
