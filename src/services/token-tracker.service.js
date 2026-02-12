const schedule = require('node-schedule');
const logger = require('../utils/logger');

class TokenTrackerService {
  constructor(discordService, databaseService = null) {
    this.discordService = discordService;
    this.db = databaseService;
    this.dailyUsage = {
      date: new Date().toISOString().split('T')[0],
      totalCost: 0,
      apiCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      breakdown: {}
    };
  }

  async start() {
    logger.info('💰 Token Tracker starting...');
    const timezone = process.env.DEFAULT_TZ || 'America/New_York';
    schedule.scheduleJob({ rule: '59 23 * * *', tz: timezone }, () => {
      this.resetDaily();
    });
    logger.info('✅ Token tracker active');
  }

  async trackUsage(serviceName, inputTokens, outputTokens) {
    const inputCost = (inputTokens * 3) / 1000000;
    const outputCost = (outputTokens * 15) / 1000000;
    const totalCost = inputCost + outputCost;
    
    this.dailyUsage.totalCost += totalCost;
    this.dailyUsage.apiCalls += 1;
    this.dailyUsage.inputTokens += inputTokens;
    this.dailyUsage.outputTokens += outputTokens;
    
    if (!this.dailyUsage.breakdown[serviceName]) {
      this.dailyUsage.breakdown[serviceName] = 0;
    }
    this.dailyUsage.breakdown[serviceName] += totalCost;
    
    if (this.db) {
      try {
        await this.db.run(
          `INSERT INTO token_usage (service_name, input_tokens, output_tokens, cost_usd) 
           VALUES (?, ?, ?, ?)`,
          [serviceName, inputTokens, outputTokens, totalCost]
        );
      } catch (error) {
        logger.error('Failed to save token usage:', error);
      }
    }
    
    logger.info(`💰 ${serviceName} - $${totalCost.toFixed(4)}`);
  }

  getDailyUsage() {
    return this.dailyUsage;
  }

  resetDaily() {
    this.dailyUsage = {
      date: new Date().toISOString().split('T')[0],
      totalCost: 0,
      apiCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      breakdown: {}
    };
  }
}

module.exports = TokenTrackerService;
