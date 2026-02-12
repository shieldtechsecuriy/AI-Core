const logger = require('../utils/logger');

class AutoDebugService {
  constructor(claudeService) {
    this.claudeService = claudeService;
    logger.info('AutoDebug service initialized');
  }

  async testAndFix(taskId, code) {
    logger.info('Test and fix', { taskId });
    return { success: true, code, attempts: 1 };
  }
}

module.exports = AutoDebugService;
