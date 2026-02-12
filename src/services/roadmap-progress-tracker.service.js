const logger = require('../utils/logger');

class RoadmapProgressTracker {
  constructor(databaseService, discordService) {
    this.db = databaseService;
    this.discordService = discordService;
  }

  async sendProgressReport() {
    const progress = await this.db.getRoadmapProgress();
    
    const totalFeatures = progress.pending.length + progress.inProgress.length + progress.completed.length;
    const completedCount = progress.completed.length;
    const percentage = totalFeatures > 0 ? Math.round((completedCount / totalFeatures) * 100) : 0;
    
    // Build visual progress bar
    const barLength = 20;
    const filledBars = Math.round((percentage / 100) * barLength);
    const emptyBars = barLength - filledBars;
    const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
    
    const embed = {
      title: '📊 ROADMAP PROGRESS REPORT',
      description: `**Overall: ${percentage}% Complete**\n\`\`\`${progressBar}\`\`\``,
      fields: [
        {
          name: '✅ Completed Features',
          value: progress.completed.length > 0 
            ? progress.completed.map(f => `• ${f.feature_name} (${f.phase})`).join('\n')
            : 'None yet',
          inline: false
        },
        {
          name: '🔨 In Progress',
          value: progress.inProgress.length > 0
            ? progress.inProgress.map(f => `• ${f.feature_name} - ${f.progress_percentage}%`).join('\n')
            : 'None',
          inline: false
        },
        {
          name: '📋 Pending (Next Up)',
          value: progress.pending.slice(0, 5).length > 0
            ? progress.pending.slice(0, 5).map(f => `• ${f.feature_name} (${f.priority})`).join('\n')
            : 'None',
          inline: false
        }
      ],
      color: percentage === 100 ? 0x2ecc71 : percentage > 50 ? 0xf39c12 : 0xe74c3c,
      footer: {
        text: `${completedCount}/${totalFeatures} features deployed`
      },
      timestamp: new Date().toISOString()
    };
    
    await this.discordService.sendEmbed(embed);
    
    logger.info(`📊 Progress report sent: ${percentage}%`);
  }

  async markFeatureComplete(featureName, deployedTo) {
    await this.db.updateRoadmapProgress(featureName, 100, 'completed', deployedTo);
    logger.info(`✅ Marked complete: ${featureName}`);
    
    // Send update
    await this.sendProgressReport();
  }

  async markFeatureStarted(featureName) {
    await this.db.updateRoadmapProgress(featureName, 10, 'in_progress');
    logger.info(`🔨 Started: ${featureName}`);
  }
}

module.exports = RoadmapProgressTracker;
