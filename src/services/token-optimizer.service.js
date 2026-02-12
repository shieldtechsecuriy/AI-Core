const schedule = require('node-schedule');
const logger = require('../utils/logger');

class TokenOptimizerService {
  constructor(tokenTracker, discordService = null) {
    this.tokenTracker = tokenTracker;
    this.discordService = discordService;
    this.lastTier = null;
  }

  async start() {
    const timezone = process.env.DEFAULT_TZ || 'America/New_York';
    // Evaluate hourly
    schedule.scheduleJob({ rule: '0 * * * *', tz: timezone }, () => {
      this.evaluate().catch(err => logger.error('Token optimizer failed:', err));
    });
  }

  async evaluate() {
    const budget = parseFloat(process.env.DAILY_BUDGET_USD || '1.5');
    const usage = this.tokenTracker.getDailyUsage();
    const spent = usage.totalCost || 0;
    const pct = budget > 0 ? (spent / budget) * 100 : 0;

    let tier = 'normal';
    let maxTokens = 1024;
    let contextLimit = 2;

    if (pct >= 95) {
      tier = 'critical';
      maxTokens = 128;
      contextLimit = 1;
    } else if (pct >= 80) {
      tier = 'high';
      maxTokens = 256;
      contextLimit = 1;
    } else if (pct >= 50) {
      tier = 'medium';
      maxTokens = 512;
      contextLimit = 2;
    } else {
      tier = 'normal';
      maxTokens = parseInt(process.env.DEFAULT_MAX_TOKENS || '1024', 10);
      contextLimit = 2;
    }

    process.env.DYNAMIC_MAX_TOKENS = String(maxTokens);
    process.env.KB_CONTEXT_LIMIT = String(contextLimit);

    if (tier !== this.lastTier) {
      this.lastTier = tier;
      logger.info(`🧠 Token optimization tier: ${tier} (${pct.toFixed(1)}% of daily budget)`);
      if (this.discordService?.sendEmbed) {
        await this.discordService.sendEmbed({
          title: '🧠 Token Optimization Updated',
          description: `Tier: **${tier}**`,
          fields: [
            { name: 'Daily Spend', value: `$${spent.toFixed(2)} / $${budget.toFixed(2)}` },
            { name: 'Max Tokens', value: String(maxTokens), inline: true },
            { name: 'Context Docs', value: String(contextLimit), inline: true }
          ],
          color: 0x3498db
        });
      }
    }
  }
}

module.exports = TokenOptimizerService;
