const schedule = require('node-schedule');
const logger = require('../utils/logger');

class SelfHealService {
  constructor(discordService, databaseService) {
    this.discordService = discordService;
    this.db = databaseService;
  }

  async start() {
    const timezone = process.env.DEFAULT_TZ || 'America/New_York';
    // Run every 6 hours
    schedule.scheduleJob({ rule: '0 */6 * * *', tz: timezone }, () => {
      this.runDiagnostics({ autoHeal: true }).catch(err =>
        logger.error('Self-heal diagnostics failed:', err)
      );
    });
  }

  async runDiagnostics({ autoHeal = false } = {}) {
    const results = [];
    let hasCritical = false;

    // Discord
    const discordReady = Boolean(this.discordService?.isReady);
    results.push({ name: 'Discord', status: discordReady ? 'OK' : 'FAIL' });
    if (!discordReady) hasCritical = true;

    // Database
    let dbOk = false;
    try {
      await this.db.all('SELECT 1');
      dbOk = true;
    } catch (e) {
      dbOk = false;
    }
    results.push({ name: 'Database', status: dbOk ? 'OK' : 'FAIL' });
    if (!dbOk) hasCritical = true;

    if (hasCritical) {
      await this.sendAlert(results, autoHeal);
      if (autoHeal) {
        logger.warn('Self-heal triggered restart');
        // Let PM2 restart the process
        process.exit(1);
      }
    }

    return { results, hasCritical };
  }

  async sendAlert(results, autoHeal) {
    if (!this.discordService?.sendEmbed) return;
    const fields = results.map(r => ({
      name: r.name,
      value: r.status,
      inline: true
    }));

    await this.discordService.sendEmbed({
      title: autoHeal ? '⚠️ Self-Heal Triggered' : '⚠️ Diagnostics Failed',
      description: autoHeal
        ? 'Critical check failed. Restarting OpenClaw.'
        : 'Critical check failed. Manual fix may be required.',
      fields,
      color: 0xe67e22
    });
  }
}

module.exports = SelfHealService;
