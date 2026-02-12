const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const schedule = require('node-schedule');

class DeploymentTracker {
  constructor(discordService) {
    this.discordService = discordService;
    this.deploymentLog = [];
    this.logPath = path.join(__dirname, '../../data/deployment-log.json');
  }

  async start() {
    logger.info('📍 Deployment Tracker starting...');
    
    await this.loadLog();
    
    // Send deployment summary every 6 hours
    schedule.scheduleJob('0 */6 * * *', () => {
      this.sendDeploymentSummary();
    });
    
    logger.info('✅ Deployment tracker active');
  }

  async loadLog() {
    try {
      const data = await fs.readFile(this.logPath, 'utf8');
      this.deploymentLog = JSON.parse(data);
      logger.info(`📍 Loaded ${this.deploymentLog.length} deployment records`);
    } catch {
      this.deploymentLog = [];
    }
  }

  async logDeployment(deployment) {
    const record = {
      timestamp: new Date().toISOString(),
      feature: deployment.featureName,
      target: deployment.target,
      files: deployment.files || [],
      status: deployment.status,
      path: deployment.path,
      error: deployment.error || null
    };
    
    this.deploymentLog.push(record);
    
    // Keep only last 100 deployments
    if (this.deploymentLog.length > 100) {
      this.deploymentLog = this.deploymentLog.slice(-100);
    }
    
    await fs.mkdir(path.dirname(this.logPath), { recursive: true });
    await fs.writeFile(this.logPath, JSON.stringify(this.deploymentLog, null, 2));
    
    logger.info(`📍 Logged deployment: ${deployment.featureName} → ${deployment.target}`);
    
    // Send immediate notification
    await this.sendDeploymentNotification(record);
  }

  async sendDeploymentNotification(record) {
    if (!this.discordService?.sendEmbed) return;
    
    const statusEmoji = record.status === 'success' ? '✅' : '❌';
    const color = record.status === 'success' ? 0x2ecc71 : 0xe74c3c;
    
    await this.discordService.sendEmbed({
      title: `${statusEmoji} DEPLOYMENT ${record.status.toUpperCase()}`,
      description: `**${record.feature}**`,
      fields: [
        { name: '📍 Target', value: record.target, inline: true },
        { name: '📁 Files', value: `${record.files.length}`, inline: true },
        { name: '📂 Path', value: record.path, inline: false },
        { name: '📄 Files Deployed', value: record.files.join('\n') || 'None', inline: false }
      ],
      color: color,
      timestamp: new Date().toISOString()
    });
  }

  async sendDeploymentSummary() {
    const last24h = this.deploymentLog.filter(d => {
      const deployTime = new Date(d.timestamp);
      const now = new Date();
      return (now - deployTime) < 24 * 60 * 60 * 1000;
    });
    
    const byTarget = {};
    last24h.forEach(d => {
      if (!byTarget[d.target]) {
        byTarget[d.target] = { success: 0, failed: 0, features: [] };
      }
      if (d.status === 'success') {
        byTarget[d.target].success++;
        byTarget[d.target].features.push(d.feature);
      } else {
        byTarget[d.target].failed++;
      }
    });
    
    const fields = Object.entries(byTarget).map(([target, stats]) => ({
      name: `📍 ${target.toUpperCase()}`,
      value: [
        `✅ Success: ${stats.success}`,
        `❌ Failed: ${stats.failed}`,
        `📦 Features: ${stats.features.slice(0, 3).join(', ')}${stats.features.length > 3 ? '...' : ''}`
      ].join('\n'),
      inline: false
    }));
    
    if (this.discordService?.sendEmbed) {
      await this.discordService.sendEmbed({
        title: '📊 DEPLOYMENT SUMMARY (Last 24h)',
        fields: fields.length > 0 ? fields : [{ name: 'Status', value: 'No deployments in last 24h' }],
        color: 0x3498db,
        timestamp: new Date().toISOString()
      });
    }
  }

  async getDeploymentStats() {
    const byTarget = {};
    
    this.deploymentLog.forEach(d => {
      if (!byTarget[d.target]) {
        byTarget[d.target] = {
          total: 0,
          success: 0,
          failed: 0,
          lastDeployment: null,
          features: []
        };
      }
      
      byTarget[d.target].total++;
      if (d.status === 'success') {
        byTarget[d.target].success++;
        byTarget[d.target].features.push(d.feature);
      } else {
        byTarget[d.target].failed++;
      }
      
      if (!byTarget[d.target].lastDeployment || 
          new Date(d.timestamp) > new Date(byTarget[d.target].lastDeployment)) {
        byTarget[d.target].lastDeployment = d.timestamp;
      }
    });
    
    return byTarget;
  }
}

module.exports = DeploymentTracker;
