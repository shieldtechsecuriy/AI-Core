const fs = require('fs').promises;
const path = require('path');
const schedule = require('node-schedule');
const logger = require('../utils/logger');

class StatusService {
  constructor(databaseService, tokenTracker, autonomyControl) {
    this.db = databaseService;
    this.tokenTracker = tokenTracker;
    this.autonomy = autonomyControl;
    this.statusPath = path.join(__dirname, '../../data/status.json');
  }

  async start() {
    await this.writeStatus();

    schedule.scheduleJob('*/10 * * * *', () => {
      this.writeStatus();
    });
  }

  async writeStatus() {
    try {
      const roadmap = await this.db.getRoadmapProgress();
      const token = this.tokenTracker.getDailyUsage();
      const status = {
        timestamp: new Date().toISOString(),
        autonomyPaused: this.autonomy?.isPaused() || false,
        roadmap: {
          pending: roadmap.pending.length,
          inProgress: roadmap.inProgress.length,
          completed: roadmap.completed.length
        },
        spending: {
          totalCost: token.totalCost,
          apiCalls: token.apiCalls
        }
      };

      await fs.mkdir(path.dirname(this.statusPath), { recursive: true });
      await fs.writeFile(this.statusPath, JSON.stringify(status, null, 2));
    } catch (error) {
      logger.error('Failed to write status:', error);
    }
  }
}

module.exports = StatusService;
