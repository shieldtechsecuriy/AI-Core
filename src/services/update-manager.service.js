const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const logger = require('../utils/logger');

const execPromise = util.promisify(exec);

class UpdateManagerService {
  constructor(discordService) {
    this.discordService = discordService;
    this.appDir = path.join(__dirname, '../..');
  }

  async runPlan() {
    try {
      const audit = await this.runAudit();
      const outdated = await this.runOutdated();
      const plan = this.buildPlan(outdated);

      await this.sendPlan(audit, plan);
      return { audit, plan };
    } catch (error) {
      logger.error('Update plan failed:', error);
      throw error;
    }
  }

  async scheduleNotifications() {
    const schedule = require('node-schedule');
    const timezone = process.env.DEFAULT_TZ || 'America/New_York';
    schedule.scheduleJob({ rule: '0 10 * * 1', tz: timezone }, () => {
      this.runPlan().catch(err => logger.error('Scheduled update plan failed:', err));
    });
  }

  async runAudit() {
    try {
      const { stdout } = await execPromise('npm audit --json', { cwd: this.appDir });
      return JSON.parse(stdout);
    } catch (error) {
      try {
        return JSON.parse(error.stdout || '{}');
      } catch {
        return { error: error.message };
      }
    }
  }

  async runOutdated() {
    try {
      const { stdout } = await execPromise('npm outdated --json', { cwd: this.appDir });
      return JSON.parse(stdout || '{}');
    } catch (error) {
      // npm outdated exits non-zero when updates exist
      try {
        return JSON.parse(error.stdout || '{}');
      } catch {
        return {};
      }
    }
  }

  buildPlan(outdated) {
    const plan = [];
    for (const [name, info] of Object.entries(outdated || {})) {
      const current = info.current || '0.0.0';
      const latest = info.latest || current;
      const risk = this.isMajorBump(current, latest) ? 'HIGH' : 'LOW';
      plan.push({ name, current, latest, risk });
    }
    return plan.sort((a, b) => (a.risk === 'HIGH' ? 1 : -1));
  }

  isMajorBump(current, latest) {
    const c = this.parseSemver(current);
    const l = this.parseSemver(latest);
    if (!c || !l) return true;
    return l.major > c.major;
  }

  parseSemver(version) {
    const match = String(version).match(/(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;
    return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10), patch: parseInt(match[3], 10) };
  }

  async sendPlan(audit, plan) {
    if (!this.discordService?.sendEmbed) return;
    const vulnCount = audit?.metadata?.vulnerabilities || {};
    const vulnSummary = `Low: ${vulnCount.low || 0}, Moderate: ${vulnCount.moderate || 0}, High: ${vulnCount.high || 0}, Critical: ${vulnCount.critical || 0}`;

    const planLines = plan.slice(0, 10).map(p =>
      `${p.name}: ${p.current} → ${p.latest} (${p.risk})`
    ).join('\n') || 'No updates found';

    await this.discordService.sendEmbed({
      title: '🧰 Controlled Update Plan',
      description: 'Analyzed updates and risks. Apply one at a time with /update-apply <pkg>@<ver>.',
      fields: [
        { name: 'Vulnerabilities', value: vulnSummary, inline: false },
        { name: 'Top Updates', value: planLines.substring(0, 1000), inline: false }
      ],
      color: 0x3498db
    });
  }

  async applyPackage(spec) {
    if (!spec) throw new Error('Package spec required, e.g., discord.js@14.17.0');
    await execPromise(`npm install ${spec} --omit=dev`, { cwd: this.appDir });
    logger.info(`✅ Applied update: ${spec}`);
  }
}

module.exports = UpdateManagerService;
