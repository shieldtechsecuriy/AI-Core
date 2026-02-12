const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

class DiscordService {
  constructor(config, taskService, approvalService, claudeService) {
    this.config = config;
    this.taskService = taskService;
    this.approvalService = approvalService;
    this.claudeService = claudeService;
    this.isReady = false;
    this.initializing = false;
    this.retryTimer = null;
    
    const AutoDebugService = require('./auto-debug.service');
    this.autoDebugService = new AutoDebugService(claudeService);
    
    logger.info('Discord service initialized');
  }

  async initialize() {
    if (this.config.enabled === false) {
      logger.info('Discord disabled by config');
      return;
    }

    if (!this.config.discordToken) {
      logger.warn('Discord token not configured');
      return;
    }

    if (this.isReady || this.initializing) {
      logger.info('Discord already initialized or initializing');
      return;
    }
    this.initializing = true;
    
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
      ]
    });
    
    try {
      await new Promise((resolve, reject) => {
        const onReady = () => {
          this.isReady = true;
          const guilds = this.client.guilds.cache.map(g => g.name).join(', ');
          const guildCount = this.client.guilds.cache.size;
          logger.info(`✅ Discord bot connected: ${this.client.user.tag}`);
          logger.info(`📊 Bot is in ${guildCount} server(s): ${guilds || 'NONE'}`);
          this.client.guilds.cache.forEach(guild => {
            logger.info(`  - Server: ${guild.name} (ID: ${guild.id})`);
            const channels = guild.channels.cache
              .filter(ch => ch.isTextBased())
              .map(ch => ch.name)
              .join(', ');
            logger.info(`    Channels: ${channels || 'NONE VISIBLE'}`);
          });
          resolve();
        };

        this.client.once('clientReady', onReady);
        this.client.once('ready', onReady);
        this.client.login(this.config.discordToken).catch(reject);
      });
    } catch (error) {
      this.isReady = false;
      logger.error('Discord login failed:', error.message);
      this.scheduleRetry(error);
    } finally {
      this.initializing = false;
    }
  }

  scheduleRetry(error) {
    if (this.retryTimer) return;

    const match = /resets at ([0-9T:\.\-Z]+)/.exec(String(error.message || ''));
    let delayMs = 5 * 60 * 1000;
    if (match) {
      const resetAt = Date.parse(match[1]);
      if (!Number.isNaN(resetAt)) {
        delayMs = Math.max(60 * 1000, resetAt - Date.now() + 5000);
      }
    }

    logger.warn(`Discord retry scheduled in ${Math.ceil(delayMs / 1000)}s`);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.initialize().catch(err => logger.error('Discord retry failed:', err.message));
    }, delayMs);
  }

  async ensureChannels(channelNames = []) {
    if (!this.isReady || !this.client) return;
    const guildId = process.env.DISCORD_GUILD_ID;
    const guild = guildId
      ? this.client.guilds.cache.get(guildId)
      : this.client.guilds.cache.first();
    if (!guild) {
      logger.warn('No guild found for channel setup');
      return;
    }

    const existing = new Set(
      guild.channels.cache.filter(ch => ch.isTextBased()).map(ch => ch.name)
    );

    for (const name of channelNames) {
      if (existing.has(name)) continue;
      try {
        await guild.channels.create({
          name,
          reason: 'OpenClaw channel setup',
        });
        logger.info(`✅ Created channel ${name}`);
      } catch (error) {
        logger.error(`Failed to create channel ${name}:`, error.message);
      }
    }
  }

  getNotificationChannel() {
    if (!this.client) return null;

    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (channelId) {
      const byId = this.client.channels.cache.get(channelId);
      if (byId && byId.isTextBased()) return byId;
    }

    const preferredNames = ['openclaw-notifications', 'general'];
    return this.client.channels.cache.find(
      ch => ch.isTextBased() && preferredNames.includes(ch.name)
    );
  }

  async sendEmbed(embedData) {
    try {
      if (!this.isReady) {
        logger.warn('Discord bot not ready yet, skipping notification');
        return;
      }
      
      const channel = this.getNotificationChannel();
      
      if (!channel) {
        const availableChannels = Array.from(this.client.channels.cache.values())
          .filter(ch => ch.isTextBased())
          .map(ch => ch.name)
          .join(', ');
        logger.warn('No notification channel found. Available channels:', availableChannels);
        return;
      }

      const sent = await channel.send({
        embeds: [{
          title: embedData.title || 'OpenClaw Notification',
          description: embedData.description || '',
          color: embedData.color || 0x00ff00,
          fields: embedData.fields || [],
          timestamp: new Date(),
          footer: embedData.footer || { text: 'OpenClaw Autonomous System' }
        }]
      });
      
      logger.info('Discord notification sent:', embedData.title);
      return sent;
    } catch (error) {
      logger.error('Failed to send Discord notification:', error.message);
    }
  }

  async sendEmbedToChannel(channelId, embedData) {
    try {
      if (!this.isReady) return;
      const channel = this.client.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) {
        logger.warn('Summary channel not found or not text-based');
        return;
      }

      const sent = await channel.send({
        embeds: [{
          title: embedData.title || 'OpenClaw Notification',
          description: embedData.description || '',
          color: embedData.color || 0x00ff00,
          fields: embedData.fields || [],
          timestamp: new Date(),
          footer: embedData.footer || { text: 'OpenClaw Autonomous System' }
        }]
      });

      return sent;
    } catch (error) {
      logger.error('Failed to send Discord notification to channel:', error.message);
    }
  }

  async sendMessage(text) {
    if (!text) return;
    return this.sendEmbed({
      title: 'OpenClaw',
      description: String(text),
      color: 0x3498db
    });
  }

  async sendConversationalResponse(userId, text) {
    return this.sendMessage(text);
  }

  async handleCommand(message) {
    const command = message.content.toLowerCase();
    
    try {
      if (command === '/status') {
        await message.reply('🤖 OpenClaw Status: All systems operational');
      } else if (command === '/tasks') {
        await message.reply('📋 Task list coming soon...');
      } else if (command === '/pause') {
        await message.reply('⏸️ System paused');
      } else if (command === '/resume') {
        await message.reply('▶️ System resumed');
      } else if (command === '/docs') {
        const docs = this.claudeService.knowledgeBase.getAllDocuments();
        const docList = docs.map(d => `• ${d.filename}`).join('\n');
        await message.reply(`📚 ShieldTech Knowledge Base:
${docList}`);
      } else if (command.startsWith('/search ')) {
        const query = command.substring(8);
        const results = this.claudeService.knowledgeBase.getContext(query);
        const summary = results.length > 0 
          ? `Found ${results.length} relevant documents`
          : 'No relevant documents found';
        await message.reply(`🔍 Search: "${query}"
${summary}`);
      } else {
        await message.reply('Unknown command. Try /status, /tasks, /pause, /resume, /docs, or /search [query]');
      }
    } catch (error) {
      logger.error('Command handling error:', error);
    }
  }
}

module.exports = DiscordService;
