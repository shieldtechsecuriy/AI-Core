const fs = require('fs').promises;
const path = require('path');
const schedule = require('node-schedule');
const logger = require('../utils/logger');

class LogSummaryService {
  constructor(discordService) {
    this.discordService = discordService;
    this.logFile = path.join(__dirname, '../../data/logs/openclaw.log');
  }

  async start() {
    const timezone = process.env.DEFAULT_TZ || 'America/New_York';
    schedule.scheduleJob({ rule: '50 23 * * *', tz: timezone }, () => {
      this.sendDailySummary();
    });
  }

  async sendDailySummary() {
    try {
      const entries = await this.loadRecentLogs(24);
      const counts = this.countByLevel(entries);
      const status = await this.loadStatus();

      const summary = [
        `Info: ${counts.info}`,
        `Warn: ${counts.warn}`,
        `Error: ${counts.error}`
      ].join('\n');

      const topErrors = entries
        .filter(e => e.level === 'error')
        .slice(-5)
        .map(e => `• ${e.message}`) // last 5
        .join('\n') || 'None';

      const embed = {
        title: '📊 Daily OpenClaw Summary',
        description: 'Last 24 hours',
        fields: [
          { name: 'Log Counts', value: summary, inline: true },
          { name: 'Recent Errors', value: topErrors.substring(0, 1000), inline: false }
        ],
        color: counts.error > 0 ? 0xe74c3c : 0x2ecc71
      };

      if (status) {
        embed.fields.push({
          name: 'Status Overview',
          value:
            `Autonomy: ${status.autonomyPaused ? 'Paused' : 'Active'}\n` +
            `Roadmap: ${status.roadmap.completed} done / ${status.roadmap.pending} pending\n` +
            `Daily Spend: $${(status.spending.totalCost || 0).toFixed(2)}`,
          inline: false
        });
      }

      await this.sendToSummaryChannel(embed);
      logger.info('📊 Daily log summary sent');
    } catch (error) {
      logger.error('Log summary failed:', error);
    }
  }

  async loadRecentLogs(hours) {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      const cutoff = Date.now() - hours * 60 * 60 * 1000;

      return lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .filter(entry => {
          const ts = new Date(entry.timestamp || entry.time || 0).getTime();
          return ts >= cutoff;
        });
    } catch {
      return [];
    }
  }

  countByLevel(entries) {
    return entries.reduce(
      (acc, entry) => {
        const level = entry.level || 'info';
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      },
      { info: 0, warn: 0, error: 0 }
    );
  }

  async loadStatus() {
    try {
      const statusPath = path.join(__dirname, '../../data/status.json');
      const content = await fs.readFile(statusPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async sendToSummaryChannel(embed) {
    if (!this.discordService) return;
    const channelId = process.env.DISCORD_SUMMARY_CHANNEL_ID;
    if (channelId && this.discordService.sendEmbedToChannel) {
      await this.discordService.sendEmbedToChannel(channelId, embed);
    } else {
      await this.discordService.sendEmbed(embed);
    }
  }
}

module.exports = LogSummaryService;
