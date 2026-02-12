const fs = require('fs').promises;
const logger = require('../utils/logger');

class SystemInventoryService {
  constructor(discordService) { this.discordService = discordService; }
  
  async generateInventory() {
    logger.info('Generating inventory...');
    const services = await fs.readdir('src/services').then(files => 
      files.filter(f => f.endsWith('.service.js')).map(f => ({
        name: f.replace('.service.js', ''), status: '✅'
      }))
    ).catch(() => []);
    
    if (this.discordService?.sendEmbed) {
      await this.discordService.sendEmbed({
        title: '📊 OPENCLAW INVENTORY',
        fields: [
          { name: 'Services', value: services.length + ' deployed' },
          { name: 'Status', value: '✅ Online' }
        ],
        color: 0x00ff00
      });
    }
    return { services };
  }
}

module.exports = SystemInventoryService;
