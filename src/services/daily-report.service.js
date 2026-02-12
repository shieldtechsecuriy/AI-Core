const schedule = require('node-schedule');
const logger = require('../utils/logger');

class DailyReportService {
  constructor(databaseService, tokenTracker, discordService) {
    this.db = databaseService;
    this.tokenTracker = tokenTracker;
    this.discordService = discordService;
  }

  async start() {
    logger.info('📊 Daily Report Service starting...');
    
    // Daily report at 11:59 PM local timezone
    const timezone = process.env.DEFAULT_TZ || 'America/New_York';
    schedule.scheduleJob({ rule: '59 23 * * *', tz: timezone }, () => {
      this.sendDailyReport();
    });
    
    logger.info('✅ Daily reports scheduled');
  }

  async sendDailyReport() {
    try {
      const tokenUsage = this.tokenTracker.getDailyUsage();
      const roadmapProgress = await this.db.getRoadmapProgress();
      
      const todayCost = tokenUsage.totalCost || 0;
      const totalFeatures = roadmapProgress.pending.length + 
                           roadmapProgress.inProgress.length + 
                           roadmapProgress.completed.length;
      const completionPercentage = totalFeatures > 0 
        ? Math.round((roadmapProgress.completed.length / totalFeatures) * 100) 
        : 0;
      
      const barLength = 20;
      const filledBars = Math.round((completionPercentage / 100) * barLength);
      const progressBar = '█'.repeat(filledBars) + '░'.repeat(barLength - filledBars);
      
      const embed = {
        title: '📊 DAILY OPENCLAW REPORT',
        description: `**${new Date().toLocaleDateString()}**`,
        fields: [
          {
            name: '💰 COST SUMMARY',
            value: `**Today:** $${todayCost.toFixed(2)}\n**API Calls:** ${tokenUsage.apiCalls || 0}`,
            inline: false
          },
          {
            name: '📋 ROADMAP PROGRESS',
            value: `\`\`\`${progressBar}\`\`\`\n**${completionPercentage}% Complete**`,
            inline: false
          },
          {
            name: '✅ Completed',
            value: `${roadmapProgress.completed.length} features`,
            inline: true
          },
          {
            name: '🔨 In Progress',
            value: `${roadmapProgress.inProgress.length} features`,
            inline: true
          },
          {
            name: '📋 Pending',
            value: `${roadmapProgress.pending.length} features`,
            inline: true
          }
        ],
        color: todayCost > 5 ? 0xe74c3c : 0x2ecc71,
        timestamp: new Date().toISOString()
      };
      
      const summaryChannel = process.env.DISCORD_SUMMARY_CHANNEL_ID;
      if (summaryChannel && this.discordService.sendEmbedToChannel) {
        await this.discordService.sendEmbedToChannel(summaryChannel, embed);
      } else {
        await this.discordService.sendEmbed(embed);
      }
      logger.info('📊 Daily report sent');
      
    } catch (error) {
      logger.error('Daily report failed:', error);
    }
  }
}

module.exports = DailyReportService;
