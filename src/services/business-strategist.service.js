const logger = require('../utils/logger');
const schedule = require('node-schedule');

class BusinessStrategistService {
  constructor(claudeService, discordService, autonomyControl = null) {
    this.claudeService = claudeService;
    this.discordService = discordService;
    this.autonomy = autonomyControl;
  }

  async start() {
    logger.info('💡 Business Strategist starting...');
    
    if (this.discordService?.sendEmbed) {
      await this.discordService.sendEmbed({
        title: '💡 BUSINESS STRATEGIST ACTIVE',
        description: 'Monthly consulting updates scheduled.\n\n💬 Want custom ideas? Just ask me:\n`@OpenClaw brainstorm business ideas`',
        fields: [
          { name: 'Focus', value: 'Revenue growth, cost reduction, automation' },
          { name: 'Frequency', value: 'Twice per month' }
        ],
        color: 0xf39c12
      });
    }
    
    const timezone = process.env.DEFAULT_TZ || 'America/New_York';

    // Pre-launch consulting: 15th at 9 AM ET
    schedule.scheduleJob({ rule: '0 9 15 * *', tz: timezone }, () => this.analyzeOpportunities());

    // Launch-day consulting: 1st at 9 AM ET
    schedule.scheduleJob({ rule: '0 9 1 * *', tz: timezone }, () => this.analyzeOpportunities());
  }

  async analyzeOpportunities() {
    try {
      if (this.autonomy?.isPaused()) {
        logger.info('⏸️ Autonomy paused; skipping business consulting update');
        return;
      }

      logger.info('💡 Analyzing business opportunities...');
      
      const prompt = `You are a business strategist for ShieldTech Security Solutions (security cameras, access control, alarm systems).

Generate 3 actionable business ideas. For EACH idea, write:
1. A catchy title (one line)
2. Why it's a good opportunity (2-3 sentences)
3. Quick implementation notes (1-2 sentences)

Make it conversational and exciting - like you're pitching to a colleague, NOT writing a report.

Focus areas:
- Untapped market segments (small businesses, specific industries)
- New service offerings
- Automation to reduce costs
- Revenue growth opportunities

Write naturally. NO JSON. NO bullet points. Just clear paragraphs.`;

      const response = await this.claudeService.generate(prompt, { maxTokens: 1024 });
      
      // Send as a clean conversational message
      if (this.discordService?.client) {
        const channel = this.discordService.getNotificationChannel?.();
        if (channel) {
          await channel.send({
            embeds: [{
              title: '💡 Business Consulting Update',
              description: response,
              color: 0xf39c12,
              footer: {
                text: '💬 Want to discuss these? Tag me: @OpenClaw what do you think about idea #1?'
              },
              timestamp: new Date()
            }]
          });

          logger.info('✅ Sent consulting update to Discord');
        }
      }
      
    } catch (error) {
      logger.error('Strategy analysis failed:', error);
    }
  }
}

module.exports = BusinessStrategistService;
