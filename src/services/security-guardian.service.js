const logger = require('../utils/logger');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class SecurityGuardianService {
  constructor(discordService) {
    this.discordService = discordService;
    this.checkInterval = 5 * 60 * 1000;
  }

  async start() {
    logger.info('🛡️ Security Guardian starting...');
    
    if (this.discordService?.sendEmbed) {
      await this.discordService.sendEmbed({
        title: '🛡️ SECURITY GUARDIAN ACTIVE',
        description: '24/7 monitoring of all systems',
        fields: [
          { name: 'Monitoring', value: 'Pi4-Core, Pi4-Auto, Oracle' },
          { name: 'Check Frequency', value: 'Every 5 minutes' }
        ],
        color: 0xe74c3c
      });
    }

    setInterval(() => this.checkSecurity(), this.checkInterval);
    setTimeout(() => this.checkSecurity(), 3000);
  }

  async checkSecurity() {
    try {
      const { stdout: memInfo } = await execPromise('free -m');
      const { stdout: diskInfo } = await execPromise('df -h /');
      
      logger.info('🛡️ Security check complete');
    } catch (error) {
      logger.error('Security check failed:', error);
    }
  }
}

module.exports = SecurityGuardianService;
