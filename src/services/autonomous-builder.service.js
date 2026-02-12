const RoadmapAutoSkipService = require('./roadmap-autoskip.service');
const logger = require('../utils/logger');

class AutonomousBuilderService {
  constructor(claudeService, discordService, deploymentEngine = null, databaseService = null, autonomyControl = null) {
    this.claude = claudeService;
    this.discord = discordService;
    this.deploymentEngine = deploymentEngine;
    this.db = databaseService;
    this.autonomy = autonomyControl;
    this.autoSkip = new RoadmapAutoSkipService();
    this.isBuilding = false;
  }

  async start() {
    logger.info('🤖 Autonomous Builder Service started');

    const timezone = process.env.DEFAULT_TZ || 'America/New_York';
    const monthlyRule = '0 9 1 * *';

    // Monthly build on 1st, 9:00 AM ET
    const schedule = require('node-schedule');
    schedule.scheduleJob({ rule: monthlyRule, tz: timezone }, () => {
      if (this.autonomy?.isPaused()) {
        logger.info('⏸️ Autonomy paused; skipping monthly build');
        return;
      }
      if (!this.isBuilding) {
        this.buildNextFeature().catch(err => {
          logger.error('Monthly build cycle error:', err);
        });
      }
    });
  }

  extractJSON(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (e2) {
          logger.error('Failed to parse JSON from code block');
        }
      }
      const plainMatch = text.match(/\{[\s\S]*\}/);
      if (plainMatch) {
        try {
          return JSON.parse(plainMatch[0]);
        } catch (e3) {
          logger.error('Failed to parse plain JSON');
        }
      }
      return null;
    }
  }

  async buildNextFeature(options = {}) {
    if (this.isBuilding) {
      logger.info('⏭️ Build already in progress');
      return;
    }

    if (!options.ignorePause && this.autonomy?.isPaused()) {
      logger.info('⏸️ Autonomy paused; build request ignored');
      return;
    }

    this.isBuilding = true;

    try {
      logger.info('🔨 Starting autonomous build cycle...');

      const roadmapFeature = await this.getNextRoadmapFeature();

      if (roadmapFeature) {
        logger.info(`🗺️ Roadmap feature queued: ${roadmapFeature.feature_name}`);
     
      const skip = await this.autoSkip.shouldSkip(roadmapFeature.feature_name);
      if (skip) {
        logger.info(`⏭️ Skipping already-completed task: ${roadmapFeature.feature_name}`);
        await this.db.markRoadmapFeatureStatus(roadmapFeature.feature_name, 'completed');
        this.isBuilding = false;
        return this.buildNextFeature({ ignorePause: options.ignorePause });
}

        const planned = await this.planRoadmapFeature(roadmapFeature);

        if (!planned) {
          throw new Error('Could not plan roadmap feature');
        }

        await this.deployFeature(planned, roadmapFeature.feature_name);
        return;
      }

      const prompt = `You are OpenClaw's autonomous builder for ShieldTech.

Select the NEXT highest-priority feature to build and deploy.

Return ONLY JSON (no markdown):

{
  "feature_name": "Feature Name",
  "priority": "high",
  "deployment_target": "pi4-auto",
  "estimated_time": "2 hours",
  "description": "What this does",
  "files_needed": ["file1.js", "file2.js"],
  "dependencies": ["service1"],
  "needs_n8n": false,
  "needs_sheets": false
}

Priority features:
- N8N Workflow Auto-Creator (pi4-auto) - HIGH
- Credential Vault Client (pi4-auto) - HIGH  
- Device Monitoring Dashboard (pi4-core) - MEDIUM
- GPS Tracking API (pi4-core) - MEDIUM

Respond with JSON only.`;

      const response = await this.claude.chat(prompt);
      const feature = this.extractJSON(response);
      
      if (!feature) {
        throw new Error('Could not parse feature JSON');
      }

      if (!feature.feature_name || !feature.deployment_target) {
        throw new Error('Invalid feature: missing required fields');
      }

      logger.info(`✅ Selected: ${feature.feature_name}`);

      await this.deployFeature(feature);

    } catch (error) {
      logger.error('Build failed:', error);
      
      if (this.discord?.sendMessage) {
        await this.discord.sendMessage(
          `⚠️ Build failed: ${error.message}`
        );
      }
    } finally {
      this.isBuilding = false;
    }
  }

  async getNextRoadmapFeature() {
    if (!this.db) return null;
    const pending = await this.db.getPendingRoadmapFeatures(1);
    return pending[0] || null;
  }

  async planRoadmapFeature(roadmapFeature) {
    const planningPrompt = `You are OpenClaw's autonomous builder for ShieldTech.

We must complete all ROADMAP features before starting new features.
Plan implementation details for the roadmap item below.

Roadmap item:
${roadmapFeature.feature_name}

Context:
${roadmapFeature.description || 'No additional context'}

Return ONLY JSON (no markdown):
{
  "feature_name": "${roadmapFeature.feature_name}",
  "priority": "${roadmapFeature.priority || 'high'}",
  "deployment_target": "pi4-core or pi4-auto",
  "estimated_time": "2 hours",
  "description": "What this does",
  "files_needed": ["file1.js", "file2.js"],
  "dependencies": ["service1"],
  "needs_n8n": false,
  "needs_sheets": false
}
`;

    const response = await this.claude.generate(planningPrompt, { maxTokens: 1024 });
    const planned = this.extractJSON(response);

    if (planned && !planned.deployment_target) {
      planned.deployment_target = this.inferDeploymentTarget(roadmapFeature.feature_name);
    }

    return planned;
  }

  inferDeploymentTarget(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('n8n') || lower.includes('automation') || lower.includes('workflow')) {
      return 'pi4-auto';
    }
    if (lower.includes('frontend') || lower.includes('vercel')) {
      return 'pi4-core';
    }
    return 'pi4-core';
  }

  async deployFeature(feature, roadmapFeatureName = null) {
    if (this.deploymentEngine) {
      logger.info('🚀 Starting autonomous deployment...');
      await this.deploymentEngine.buildAndDeploy(feature);

      if (roadmapFeatureName && this.db) {
        await this.db.markRoadmapFeatureStatus(roadmapFeatureName, 'completed');
      }
      return;
    }

    await this.discord.sendEmbed({
      title: '🔨 Feature Selected (Deployment Engine Not Available)',
      description: feature.description,
      fields: [
        { name: 'Feature', value: feature.feature_name },
        { name: 'Target', value: feature.deployment_target }
      ],
      color: 0xf39c12
    });
  }

  async buildAllRoadmapFeatures() {
    if (!this.db) throw new Error('Database not configured');
    let next = await this.getNextRoadmapFeature();
    while (next) {
      await this.buildNextFeature();
      next = await this.getNextRoadmapFeature();
    }
  }
}

module.exports = AutonomousBuilderService;
