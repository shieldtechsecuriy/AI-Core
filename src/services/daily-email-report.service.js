const schedule = require('node-schedule');
const logger = require('../utils/logger');
const EmailService = require('./email.service');

class DailyEmailReportService {
  constructor(databaseService, tokenTracker) {
    this.db = databaseService;
    this.tokenTracker = tokenTracker;
    this.email = new EmailService();
  }

  async start() {
    const timezone = process.env.DEFAULT_TZ || 'America/New_York';
    schedule.scheduleJob({ rule: '0 6 * * *', tz: timezone }, () => {
      this.sendDailyReport().catch(err =>
        logger.error('Daily email report failed:', err)
      );
    });
  }

  async sendDailyReport() {
    const tokenUsage = this.tokenTracker.getDailyUsage();
    const roadmap = await this.db.getRoadmapProgress();

    const totalFeatures =
      roadmap.pending.length + roadmap.inProgress.length + roadmap.completed.length;
    const completionPct =
      totalFeatures > 0
        ? Math.round((roadmap.completed.length / totalFeatures) * 100)
        : 0;

    const subject = `OpenClaw Daily Report - ${new Date().toLocaleDateString()}`;
    const text = [
      `Daily Spend: $${tokenUsage.totalCost.toFixed(2)}`,
      `API Calls: ${tokenUsage.apiCalls}`,
      `Roadmap: ${roadmap.completed.length} completed / ${roadmap.pending.length} pending`,
      `Completion: ${completionPct}%`,
      '',
      'Planned Next Steps:',
      '- Continue roadmap execution (if pending)',
      '- Monthly build on 1st at 9:00 AM ET'
    ].join('\n');

    const html = `
      <h2>OpenClaw Daily Report</h2>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>Daily Spend:</strong> $${tokenUsage.totalCost.toFixed(2)}</p>
      <p><strong>API Calls:</strong> ${tokenUsage.apiCalls}</p>
      <p><strong>Roadmap:</strong> ${roadmap.completed.length} completed / ${roadmap.pending.length} pending</p>
      <p><strong>Completion:</strong> ${completionPct}%</p>
      <h3>Planned Next Steps</h3>
      <ul>
        <li>Continue roadmap execution (if pending)</li>
        <li>Monthly build on 1st at 9:00 AM ET</li>
      </ul>
    `;

    await this.email.sendDailySummary(subject, text, html);
  }
}

module.exports = DailyEmailReportService;
