const logger = require('../utils/logger');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const schedule = require('node-schedule');

class SelfBuildingEngine {
  constructor(claudeService, discordService, databaseService = null, deploymentTracker = null) {
    this.claudeService = claudeService;
    this.discordService = discordService;
    this.db = databaseService;
    this.deploymentTracker = deploymentTracker;
    this.isBuilding = false;
    this.completedFeatures = new Set();
    
    this.targets = {
      pi4_core: {
        host: process.env.PI4_CORE_HOST || '100.127.213.67',
        user: process.env.PI4_CORE_USER || 'shieldtech',
        path: '/home/shieldtech/openclaw-builds',
        description: 'Database + API Backend',
        enabled: false // Disabled until Pi is reachable
      },
      pi4_auto: {
        host: process.env.PI4_AUTO_HOST || '100.104.230.113',
        user: process.env.PI4_AUTO_USER || 'shieldtech',
        path: '/home/shieldtech/openclaw-builds',
        description: 'N8N Automation',
        enabled: false // Disabled until Pi is reachable
      },
      oracle: {
        host: 'localhost',
        user: process.env.USER || 'kosmox_ai',
        path: '/home/kosmox_ai/openclaw',
        description: 'OpenClaw Brain (Oracle Cloud)',
        enabled: true // Always enabled (local)
      }
    };
  }

  async start() {
    logger.info('🤖 Self-Building Engine starting...');
    
    // Check which targets are reachable
    await this.checkTargets();
    
    await this.loadCompletedFeatures();
    
    // Build roadmap features every 2 hours
    schedule.scheduleJob('0 */2 * * *', () => {
      this.buildNextRoadmapFeature();
    });
    
    // Initial build after 1 minute
    setTimeout(() => this.buildNextRoadmapFeature(), 60000);
    
    const enabledTargets = Object.entries(this.targets)
      .filter(([_, t]) => t.enabled)
      .map(([name, t]) => `${name} (${t.description})`)
      .join('\n');
    
    if (this.discordService?.sendEmbed) {
      await this.discordService.sendEmbed({
        title: '🤖 SELF-BUILDING ENGINE ACTIVE',
        description: 'Building roadmap features autonomously!',
        fields: [
          {
            name: '✅ Available Targets',
            value: enabledTargets || 'None',
            inline: false
          },
          {
            name: '⚠️ Unavailable Targets',
            value: Object.entries(this.targets)
              .filter(([_, t]) => !t.enabled)
              .map(([name]) => name)
              .join(', ') || 'None',
            inline: false
          }
        ],
        color: 0x9b59b6
      });
    }
  }

  async checkTargets() {
    for (const [name, target] of Object.entries(this.targets)) {
      if (name === 'oracle') {
        target.enabled = true;
        continue;
      }
      
      try {
        await execPromise(`ping -c 1 -W 2 ${target.host}`, { timeout: 3000 });
        target.enabled = true;
        logger.info(`✅ ${name} is reachable`);
      } catch {
        target.enabled = false;
        logger.warn(`⚠️ ${name} is not reachable (deploying locally only)`);
      }
    }
  }

  async loadCompletedFeatures() {
    try {
      const completedFile = path.join(__dirname, '../../data/completed-features.json');
      const data = await fs.readFile(completedFile, 'utf8');
      const completed = JSON.parse(data);
      this.completedFeatures = new Set(completed);
      logger.info(`📋 Loaded ${this.completedFeatures.size} completed features`);
    } catch {
      logger.info('📋 No completed features yet');
    }
  }

  async saveCompletedFeature(featureName) {
    this.completedFeatures.add(featureName);
    const completedFile = path.join(__dirname, '../../data/completed-features.json');
    await fs.mkdir(path.dirname(completedFile), { recursive: true });
    await fs.writeFile(
      completedFile, 
      JSON.stringify(Array.from(this.completedFeatures), null, 2)
    );
  }

  async buildNextRoadmapFeature() {
    if (this.isBuilding) {
      logger.info('Already building, skipping...');
      return;
    }
    
    try {
      this.isBuilding = true;
      logger.info('📋 Reading roadmap...');
      
      const roadmap = await this.readRoadmap();
      const nextFeature = await this.selectNextFeature(roadmap);
      
      if (nextFeature.shouldBuild) {
        await this.buildFeature(nextFeature);
        await this.saveCompletedFeature(nextFeature.feature.name);
      } else {
        logger.info('✅ All roadmap features complete!');
      }
      
    } catch (error) {
      logger.error('Build error:', error);
      
      if (this.discordService?.sendEmbed) {
        await this.discordService.sendEmbed({
          title: '❌ BUILD FAILED',
          description: error.message,
          color: 0xe74c3c
        });
      }
    } finally {
      this.isBuilding = false;
    }
  }

  async readRoadmap() {
    try {
      const roadmapPath = path.join(__dirname, '../../knowledge-base/shieldtech-roadmap.md');
      return await fs.readFile(roadmapPath, 'utf8');
    } catch {
      return 'No roadmap found';
    }
  }

  async selectNextFeature(roadmap) {
    const completedList = Array.from(this.completedFeatures).join(', ');
    const enabledTargets = Object.keys(this.targets).filter(k => this.targets[k].enabled).join(', ');
    
    const prompt = `You are OpenClaw building ShieldTech autonomously.

AVAILABLE DEPLOYMENT TARGETS: ${enabledTargets}

ROADMAP:
${roadmap}

ALREADY COMPLETED: ${completedList || 'None'}

Select the NEXT feature to build that can be deployed to AVAILABLE targets only.

Since Pi servers are not available, focus on features that can run on Oracle Cloud:
- AI services
- Data processing
- Analysis tools
- Backend services that don't need Pi hardware

Respond as JSON:
{
  "shouldBuild": true,
  "feature": {
    "name": "Feature Name",
    "description": "What it does",
    "files": [
      {
        "path": "relative/path/file.js",
        "content": "complete code here"
      }
    ],
    "deployment_target": "oracle"
  }
}

If all features complete or none can be built: {"shouldBuild": false}`;

    const response = await this.claudeService.generate(prompt, {
      maxTokens: 4096,
      serviceName: 'Self-Builder'
    });
    
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { shouldBuild: false };
  }

  async buildFeature(featureData) {
    const feature = featureData.feature;
    
    logger.info(`🔨 Building: ${feature.name}`);
    
    if (this.discordService?.sendEmbed) {
      await this.discordService.sendEmbed({
        title: '🔨 BUILDING FEATURE',
        description: `**${feature.name}**\n\n${feature.description}`,
        fields: [
          { name: 'Target', value: feature.deployment_target, inline: true },
          { name: 'Files', value: `${feature.files.length}`, inline: true }
        ],
        color: 0xf39c12
      });
    }
    
    try {
      // Deploy locally to Oracle
      for (const file of feature.files) {
        const filePath = path.join(this.targets.oracle.path, file.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content);
        logger.info(`✅ Created: ${file.path}`);
      
      // Log to deployment tracker
      if (this.deploymentTracker) {
        await this.deploymentTracker.logDeployment({
          featureName: feature.name,
          target: feature.deployment_target || 'oracle',
          files: feature.files.map(f => f.path),
          status: 'success',
          path: this.targets.oracle.path
        });
      }
      }
      
      if (this.discordService?.sendEmbed) {
        await this.discordService.sendEmbed({
          title: '✅ FEATURE DEPLOYED',
          description: `**${feature.name}** is live!`,
          color: 0x2ecc71
        });
      }
      
    } catch (error) {
      logger.error('Build failed:', error);
      throw error;
    }
  }
}

module.exports = SelfBuildingEngine;
