const RoadmapAutoSkipService = require('./roadmap-autoskip.service');
const logger = require('../utils/logger');

class AutonomousBuilderService {
  constructor(claudeService, discordService, deploymentEngine = null, databaseService = null, autonomyControl = null) {
    this.claude = claudeService;
    this.discord = discordService;
    this.deploymentEngine = deploymentEngine;
    this.db = databaseService;
    this.autonomy = autonomyControl;
    this.autoSkip = new RoadmapAutoSkipService(databaseService);
    this.isBuilding = false;
    this.roadmapComplete = false;
  }

  async start() {
    logger.info('🤖 Autonomous Builder Service started');

    const timezone = process.env.DEFAULT_TZ || 'America/New_York';
    const monthlyRule = '0 9 1 * *';

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
        try { return JSON.parse(jsonMatch[1]); } catch (e2) { /* fall through */ }
      }
      const plainMatch = text.match(/\{[\s\S]*\}/);
      if (plainMatch) {
        try { return JSON.parse(plainMatch[0]); } catch (e3) { /* fall through */ }
      }
      return null;
    }
  }

  // ─────────────────────────────────────────────────────
  // CORE BUILD LOOP
  // ─────────────────────────────────────────────────────

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

      // ── STEP 1: Always prioritize roadmap features first ──
      const roadmapFeature = await this.getNextRoadmapFeature();

      if (roadmapFeature) {
        this.roadmapComplete = false;

        // Auto-skip check (DB + SSH)
        const skip = await this.autoSkip.shouldSkip(roadmapFeature.feature_name);
        if (skip) {
          logger.info(`⏭️ Skipping already-completed: ${roadmapFeature.feature_name}`);
          await this.db.markRoadmapFeatureStatus(roadmapFeature.feature_name, 'completed');
          this.isBuilding = false;
          // Recurse to pick the next one
          return this.buildNextFeature({ ignorePause: options.ignorePause });
        }

        logger.info(`🗺️ Building roadmap feature: ${roadmapFeature.feature_name}`);
        const planned = await this.planRoadmapFeature(roadmapFeature);

        if (!planned) {
          throw new Error('Could not plan roadmap feature');
        }

        await this.deployFeature(planned, roadmapFeature.feature_name);
        return;
      }

      // ── STEP 2: Roadmap is complete — notify owner ──
      if (!this.roadmapComplete) {
        this.roadmapComplete = true;
        logger.info('🎉 All roadmap features are complete!');

        if (this.discord?.sendEmbed) {
          await this.discord.sendEmbed({
            title: '🎉 FULL ROADMAP COMPLETE',
            description:
              'Every roadmap feature has been built and deployed.\n\n' +
              'OpenClaw will now propose **new features/ideas** for your approval.\n' +
              'Nothing will be built without your explicit ✅ approval.',
            color: 0x2ecc71
          });
        }
      }

      // ── STEP 3: Generate a new idea — but REQUIRE approval ──
      const newFeature = await this.generateNewFeatureIdea();
      if (!newFeature) {
        logger.info('💤 No new features to propose right now');
        return;
      }

      // Send approval request and wait
      const approved = await this.requestNewFeatureApproval(newFeature);

      if (approved) {
        logger.info(`✅ Owner approved new feature: ${newFeature.feature_name}`);
        await this.deployFeature(newFeature);
      } else {
        logger.info(`❌ Owner denied new feature: ${newFeature.feature_name}`);
        if (this.discord?.sendEmbed) {
          await this.discord.sendEmbed({
            title: '❌ Feature Denied',
            description: `**${newFeature.feature_name}** was rejected. Will propose a different idea next cycle.`,
            color: 0xe74c3c
          });
        }
      }

    } catch (error) {
      logger.error('Build failed:', error);

      if (this.discord?.sendMessage) {
        await this.discord.sendMessage(`⚠️ Build failed: ${error.message}`);
      }
    } finally {
      this.isBuilding = false;
    }
  }

  // ─────────────────────────────────────────────────────
  // ROADMAP FEATURE METHODS
  // ─────────────────────────────────────────────────────

  async getNextRoadmapFeature() {
    if (!this.db) return null;
    const pending = await this.db.getPendingRoadmapFeatures(1);
    return pending[0] || null;
  }

  async getRoadmapStats() {
    if (!this.db) return { total: 0, completed: 0, pending: 0 };
    const progress = await this.db.getRoadmapProgress();
    return {
      total: progress.pending.length + progress.inProgress.length + progress.completed.length,
      completed: progress.completed.length,
      pending: progress.pending.length,
      inProgress: progress.inProgress.length
    };
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

  // ─────────────────────────────────────────────────────
  // NEW FEATURE IDEA GENERATION (post-roadmap only)
  // ─────────────────────────────────────────────────────

  async generateNewFeatureIdea() {
    const prompt = `You are OpenClaw's autonomous builder for ShieldTech.

The entire roadmap has been completed. Suggest ONE high-value NEW feature
that would benefit the ShieldTech platform. Be creative but practical.

Return ONLY JSON (no markdown):

{
  "feature_name": "Feature Name",
  "priority": "high",
  "deployment_target": "pi4-core",
  "estimated_time": "2 hours",
  "description": "What this does and why it matters",
  "files_needed": ["file1.js", "file2.js"],
  "dependencies": ["service1"],
  "needs_n8n": false,
  "needs_sheets": false
}

Respond with JSON only.`;

    const response = await this.claude.chat(prompt);
    return this.extractJSON(response);
  }

  // ─────────────────────────────────────────────────────
  // APPROVAL GATE FOR NEW IDEAS
  // ─────────────────────────────────────────────────────

  async requestNewFeatureApproval(feature) {
    if (!this.discord?.sendEmbed) {
      logger.warn('Discord not available for approval request — denying by default');
      return false;
    }

    const stats = await this.getRoadmapStats();

    const msg = await this.discord.sendEmbed({
      title: '💡 NEW FEATURE PROPOSAL — Approval Required',
      description:
        `OpenClaw has a new idea that is **not on the original roadmap**.\n\n` +
        `**React ✅ to approve or ❌ to deny.**\n` +
        `Nothing will be built without your approval.`,
      fields: [
        { name: 'Feature', value: feature.feature_name, inline: false },
        { name: 'Description', value: feature.description || 'N/A', inline: false },
        { name: 'Target', value: feature.deployment_target || 'TBD', inline: true },
        { name: 'Priority', value: feature.priority || 'medium', inline: true },
        { name: 'Est. Time', value: feature.estimated_time || 'TBD', inline: true },
        { name: 'Roadmap Status', value: `${stats.completed}/${stats.total} complete`, inline: true }
      ],
      color: 0xf39c12
    });

    if (!msg) {
      logger.warn('Could not send approval embed — denying by default');
      return false;
    }

    // Add reaction buttons
    try {
      await msg.react('✅');
      await msg.react('❌');
    } catch (err) {
      logger.warn('Could not add reactions:', err.message);
    }

    // Wait for owner reaction (5 minute timeout)
    const approvalTimeout = parseInt(process.env.NEW_FEATURE_APPROVAL_TIMEOUT_MS || '300000', 10);

    return new Promise((resolve) => {
      const filter = (reaction, user) =>
        ['✅', '❌'].includes(reaction.emoji.name) && !user.bot;

      const collector = msg.createReactionCollector({
        filter,
        time: approvalTimeout,
        max: 1
      });

      collector.on('collect', (reaction) => {
        resolve(reaction.emoji.name === '✅');
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          logger.info('⏰ Approval timed out — denying new feature by default');
          resolve(false);
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────
  // DEPLOYMENT
  // ─────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────
  // BUILD ALL ROADMAP (sequential, with auto-skip)
  // ─────────────────────────────────────────────────────

  async buildAllRoadmapFeatures() {
    if (!this.db) throw new Error('Database not configured');

    const stats = await this.getRoadmapStats();
    logger.info(`🗺️ Building all roadmap features: ${stats.pending} pending out of ${stats.total} total`);

    if (this.discord?.sendEmbed) {
      await this.discord.sendEmbed({
        title: '🗺️ ROADMAP BUILD STARTED',
        description: `Building ${stats.pending} pending features (${stats.completed} already done)`,
        color: 0x3498db
      });
    }

    let built = 0;
    let skipped = 0;
    let next = await this.getNextRoadmapFeature();

    while (next) {
      const skip = await this.autoSkip.shouldSkip(next.feature_name);
      if (skip) {
        await this.db.markRoadmapFeatureStatus(next.feature_name, 'completed');
        skipped++;
        logger.info(`⏭️ Skipped (already done): ${next.feature_name}`);
      } else {
        try {
          await this.buildNextFeature({ ignorePause: true });
          built++;
        } catch (err) {
          logger.error(`Failed to build ${next.feature_name}:`, err);
        }
      }
      next = await this.getNextRoadmapFeature();
    }

    const summary = `Built: ${built} | Skipped: ${skipped} | Total: ${stats.total}`;
    logger.info(`🎉 Roadmap build complete — ${summary}`);

    if (this.discord?.sendEmbed) {
      await this.discord.sendEmbed({
        title: '🎉 ROADMAP BUILD COMPLETE',
        description: summary,
        color: 0x2ecc71
      });
    }
  }
}

module.exports = AutonomousBuilderService;
