const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class AutonomyControlService {
  constructor() {
    this.statePath = path.join(__dirname, '../../data/autonomy.json');
    this.state = { paused: false, updatedAt: new Date().toISOString() };
  }

  async load() {
    try {
      const content = await fs.readFile(this.statePath, 'utf8');
      this.state = JSON.parse(content);
    } catch {
      await this.save();
    }
  }

  async save() {
    try {
      await fs.mkdir(path.dirname(this.statePath), { recursive: true });
      await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      logger.error('Failed to save autonomy state:', error);
    }
  }

  async pause(reason = '') {
    this.state.paused = true;
    this.state.reason = reason || 'Paused by user';
    this.state.updatedAt = new Date().toISOString();
    await this.save();
  }

  async resume() {
    this.state.paused = false;
    this.state.reason = '';
    this.state.updatedAt = new Date().toISOString();
    await this.save();
  }

  isPaused() {
    return Boolean(this.state.paused);
  }
}

module.exports = AutonomyControlService;
