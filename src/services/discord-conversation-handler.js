const logger = require('../utils/logger');

class DiscordConversationHandler {
  constructor(discordClient, conversationalAssistant) {
    this.client = discordClient;
    this.assistant = conversationalAssistant;
    this.botId = null;
  }

  initialize() {
    this.botId = this.client.user.id;
    
    // Listen for messages
    this.client.on('messageCreate', async (message) => {
      try {
        // Ignore bot's own messages
        if (message.author.bot) return;

        // Check if bot was mentioned or message starts with command
        const isMentioned = message.mentions.has(this.botId);
        const isCommand = message.content.startsWith('/chat') || 
                         message.content.startsWith('!chat');

        if (isMentioned || isCommand) {
          // Show typing indicator
          await message.channel.sendTyping();

          // Extract message content (remove mention/command)
          let userMessage = message.content
            .replace(/<@!?\d+>/g, '') // Remove mentions
            .replace(/^\/(chat|talk|ask)\s*/i, '') // Remove commands
            .trim();

          // Handle special commands
          if (userMessage.toLowerCase() === 'clear' || userMessage.toLowerCase() === 'reset') {
            this.assistant.clearConversation(message.author.id);
            await message.reply('🗑️ Conversation cleared! Starting fresh.');
            return;
          }

          if (userMessage.toLowerCase() === 'brainstorm' || userMessage.toLowerCase() === 'ideas') {
            const response = await this.assistant.startIdeaBrainstorm(
              message.author.id,
              message.author.username
            );
            await message.reply(response);
            return;
          }

          if (userMessage.toLowerCase() === 'summary') {
            const summary = this.assistant.getConversationSummary(message.author.id);
            if (summary) {
              await message.reply(`📊 Conversation: ${summary.messageCount} messages over ${summary.duration} minutes`);
            } else {
              await message.reply('No active conversation. Start one by mentioning me!');
            }
            return;
          }

          // Get conversational response
          const response = await this.assistant.handleMessage(
            message.author.id,
            message.author.username,
            userMessage
          );

          // Send response (split if too long)
          if (response.length > 2000) {
            const chunks = this.splitMessage(response, 2000);
            for (const chunk of chunks) {
              await message.reply(chunk);
            }
          } else {
            await message.reply(response);
          }

          logger.info(`💬 Responded to ${message.author.username}`);
        }
      } catch (error) {
        logger.error('Discord message handling error:', error);
        await message.reply('Oops, I had trouble understanding that. Can you rephrase?');
      }
    });

    logger.info('✅ Discord conversation handler initialized');
  }

  splitMessage(text, maxLength = 2000) {
    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Try to split at last newline before maxLength
      let splitIndex = remaining.lastIndexOf('\n', maxLength);
      if (splitIndex === -1) {
        splitIndex = maxLength;
      }

      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trim();
    }

    return chunks;
  }
}

module.exports = DiscordConversationHandler;
