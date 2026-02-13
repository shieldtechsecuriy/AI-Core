require('dotenv').config();
const logger = require('./utils/logger');
const DiscordService = require('./services/discord.service');
const DatabaseService = require('./services/database.service');
const DailyReportService = require('./services/daily-report.service');
const DailyEmailReportService = require('./services/daily-email-report.service');
const OpenAIService = require('./services/openai.service');
const TokenTrackerService = require('./services/token-tracker.service');
const TokenOptimizerService = require('./services/token-optimizer.service');
const ConversationalAssistantService = require('./services/conversational-assistant.service');
const MessageRouter = require('./services/message-router.service');
const AutonomousBuilderService = require('./services/autonomous-builder.service');
const AutonomousDeploymentEngine = require('./services/autonomous-deployment-engine.service');
const BusinessStrategistService = require('./services/business-strategist.service');
const RoadmapSeederService = require('./services/roadmap-seeder.service');
const SecurityGuardianService = require('./services/security-guardian.service');
const CompetitorIntelligenceService = require('./services/competitor-intelligence.service');
const SSHSecurityMonitor = require('./services/ssh-security-monitor.service');
const DeploymentTracker = require('./services/deployment-tracker.service');
const AutonomyControlService = require('./services/autonomy-control.service');
const LogSummaryService = require('./services/log-summary.service');
const StatusService = require('./services/status.service');
const PasswordVaultService = require('./services/password-vault.service');
const BackupService = require('./services/backup.service');
const SelfHealService = require('./services/self-heal.service');
const UpdateManagerService = require('./services/update-manager.service');
const RoadmapProgressTracker = require('./services/roadmap-progress-tracker.service');

async function main() {
  try {
    logger.info('🚀 Starting OpenClaw with Full Autonomous Deployment...');
    
    // Initialize Discord
    const discordService = new DiscordService({
      discordToken: process.env.DISCORD_BOT_TOKEN,
      enabled: process.env.DISCORD_ENABLED === 'true'
    });
    await discordService.initialize();
    await new Promise(r => setTimeout(r, 2000));
    
    // Initialize Database
    const databaseService = new DatabaseService();
    await databaseService.initialize();

    const autonomyControl = new AutonomyControlService();
    await autonomyControl.load();

    const roadmapSeeder = new RoadmapSeederService(databaseService);
    await roadmapSeeder.start();
    
    // Initialize Token Tracking
    const tokenTracker = new TokenTrackerService(discordService, databaseService);
    await tokenTracker.start();

    const tokenOptimizer = new TokenOptimizerService(tokenTracker, discordService);
    await tokenOptimizer.start();
    
    // Initialize Daily Reports
    const dailyReport = new DailyReportService(databaseService, tokenTracker, discordService);
    await dailyReport.start();

    const dailyEmail = new DailyEmailReportService(databaseService, tokenTracker);
    await dailyEmail.start();

    const statusService = new StatusService(databaseService, tokenTracker, autonomyControl);
    await statusService.start();

    const logSummary = new LogSummaryService(discordService);
    await logSummary.start();

    const selfHeal = new SelfHealService(discordService, databaseService);
    await selfHeal.start();

    const updateManager = new UpdateManagerService(discordService);
    await updateManager.scheduleNotifications();
    
    // Initialize OpenAI Service (only)
    const claudeService = new OpenAIService();
    claudeService.setTokenTracker(tokenTracker);
    
    // Initialize Conversational Assistant
    const assistant = new ConversationalAssistantService(claudeService, discordService);
    await assistant.start();
    
    // ============================================================
    // AUTONOMOUS DEPLOYMENT PIPELINE
    // ============================================================
    
    logger.info('🤖 Initializing Autonomous Deployment Pipeline...');
    
    // Create Deployment Engine
    const deploymentEngine = new AutonomousDeploymentEngine(
      claudeService, 
      discordService, 
      databaseService
    );
    
    // Create Builder with Deployment Engine
    const builder = new AutonomousBuilderService(
      claudeService, 
      discordService, 
      deploymentEngine,
      databaseService,
      autonomyControl
    );
    await builder.start();

    // Initialize Roadmap Progress Tracker
    const roadmapTracker = new RoadmapProgressTracker(databaseService, discordService);

    // Initialize other services
    const strategist = new BusinessStrategistService(claudeService, discordService, autonomyControl);
    await strategist.start();
    
    const security = new SecurityGuardianService(discordService);
    await security.start();
    
    const competitor = new CompetitorIntelligenceService(claudeService, discordService);
    await competitor.start();
    
    const deploymentTracker = new DeploymentTracker(discordService);
    await deploymentTracker.start();
    
    const sshMonitor = new SSHSecurityMonitor(discordService);
    await sshMonitor.start();

    const backupService = new BackupService(discordService);
    await backupService.start();
    
    const passwordVault = new PasswordVaultService();
    try {
      await passwordVault.initialize();
    } catch (error) {
      logger.warn('Password vault not initialized:', error.message);
    }
    
    // ============================================================
    // MESSAGE ROUTER WITH COMMAND HANDLERS
    // ============================================================
    
    if (discordService.client) {
      const router = new MessageRouter(discordService.client);
      
      // Build command - Trigger autonomous build & deploy
      router.registerHandler(
        'Build Command',
        100,
        (msg) => msg.content.startsWith('/build') || 
                 (msg.content.includes('OpenClaw') && msg.content.toLowerCase().includes('build')),
        async (msg) => {
          await msg.reply('🔨 Starting autonomous build & deploy pipeline...');
          try {
            await builder.buildNextFeature();
            await msg.reply('✅ Build cycle initiated! Watch for approval requests.');
          } catch (error) {
            await msg.reply(`❌ Build failed: ${error.message}`);
            logger.error('Build command error:', error);
          }
        }
      );
      
      // Status command
      router.registerHandler(
        'Status Command',
        100,
        (msg) => msg.content.startsWith('/status'),
        async (msg) => {
          const status = {
            discord: discordService.client?.ws.status === 0 ? '🟢' : '🔴',
            database: databaseService ? '🟢' : '🔴',
            builder: builder.isBuilding ? '🟡 Building...' : '🟢 Ready',
            deployment: '🟢 Ready'
          };
          
          await msg.reply(
            `📊 **OpenClaw Status**\n\n` +
            `Discord: ${status.discord}\n` +
            `Database: ${status.database}\n` +
            `Builder: ${status.builder}\n` +
            `Deployment Engine: ${status.deployment}`
          );
        }
      );

      // Debug + fix command
      router.registerHandler(
        'Debug Fix Command',
        100,
        (msg) => msg.content.startsWith('/debug-fix'),
        async (msg) => {
          await msg.reply('🧰 Running diagnostics...');
          const { results, hasCritical } = await selfHeal.runDiagnostics({ autoHeal: false });
          const summary = results.map(r => `${r.name}: ${r.status}`).join('\n');
          await msg.reply(`🧪 Diagnostics:\n${summary}`);
          if (hasCritical) {
            await msg.reply('⚠️ Critical issues found. Restarting OpenClaw...');
            process.exit(1);
          } else {
            await msg.reply('✅ All systems healthy.');
          }
        }
      );

      // Update plan command
      router.registerHandler(
        'Update Plan Command',
        100,
        (msg) => msg.content.startsWith('/update-plan'),
        async (msg) => {
          await msg.reply('🧠 Analyzing updates...');
          try {
            await updateManager.runPlan();
            await msg.reply('✅ Update plan generated and posted.');
          } catch (error) {
            await msg.reply(`❌ Update plan failed: ${error.message}`);
          }
        }
      );

      // Create channels
      router.registerHandler(
        'Setup Channels Command',
        100,
        (msg) => msg.content.startsWith('/setup-channels'),
        async (msg) => {
          const channels = [
            'openclaw-updates',
            'openclaw-alerts',
            'openclaw-builds',
            'openclaw-security',
            'openclaw-backups',
            'openclaw-summaries'
          ];
          await msg.reply('🧱 Creating OpenClaw channels...');
          await discordService.ensureChannels(channels);
          await msg.reply('✅ Channel setup complete (if permissions allow).');
        }
      );

      // Build all roadmap features
      router.registerHandler(
        'Build All Roadmap Command',
        100,
        (msg) => msg.content.startsWith('/build-roadmap-all'),
        async (msg) => {
          await msg.reply('🚧 Building all roadmap features (sequential). This may take a while.');
          try {
            await builder.buildAllRoadmapFeatures();
            await msg.reply('✅ Roadmap build queue complete.');
          } catch (error) {
            await msg.reply(`❌ Roadmap build failed: ${error.message}`);
          }
        }
      );

      // Roadmap status command
      router.registerHandler(
        'Roadmap Status Command',
        100,
        (msg) => msg.content.startsWith('/roadmap-status'),
        async (msg) => {
          try {
            await roadmapTracker.sendProgressReport();
            await msg.reply('📊 Roadmap progress report sent above.');
          } catch (error) {
            await msg.reply(`❌ Roadmap status failed: ${error.message}`);
          }
        }
      );

      // Apply one update at a time
      router.registerHandler(
        'Update Apply Command',
        100,
        (msg) => msg.content.startsWith('/update-apply '),
        async (msg) => {
          const spec = msg.content.substring(14).trim();
          if (!spec) {
            await msg.reply('Usage: /update-apply <package>@<version>');
            return;
          }
          await msg.reply(`🔧 Applying update ${spec}...`);
          try {
            await updateManager.applyPackage(spec);
            await msg.reply('✅ Update applied. Restarting...');
            process.exit(1);
          } catch (error) {
            await msg.reply(`❌ Update failed: ${error.message}`);
          }
        }
      );

      // Launch now command
      router.registerHandler(
        'Launch Now Command',
        100,
        (msg) => msg.content.startsWith('/launch-now'),
        async (msg) => {
          await msg.reply('🚀 Launching monthly build now...');
          try {
            await builder.buildNextFeature({ ignorePause: true });
            await msg.reply('✅ Launch triggered.');
          } catch (error) {
            await msg.reply(`❌ Launch failed: ${error.message}`);
          }
        }
      );

      // Pause autonomy
      router.registerHandler(
        'Pause Autonomy Command',
        100,
        (msg) => msg.content.startsWith('/pause-autonomy'),
        async (msg) => {
          await autonomyControl.pause('Paused from Discord');
          await msg.reply('⏸️ Autonomy paused. Scheduled builds and consulting updates are halted.');
        }
      );

      // Resume autonomy
      router.registerHandler(
        'Resume Autonomy Command',
        100,
        (msg) => msg.content.startsWith('/resume-autonomy'),
        async (msg) => {
          await autonomyControl.resume();
          await msg.reply('▶️ Autonomy resumed.');
        }
      );

      // Backup now
      router.registerHandler(
        'Backup Now Command',
        100,
        (msg) => msg.content.startsWith('/backup-now'),
        async (msg) => {
          await msg.reply('📦 Running backups now...');
          try {
            await backupService.runAllBackups();
            await msg.reply('✅ Backup complete.');
          } catch (error) {
            await msg.reply(`❌ Backup failed: ${error.message}`);
          }
        }
      );

      // Vault add
      router.registerHandler(
        'Vault Add Command',
        100,
        (msg) => msg.content.startsWith('/vault add '),
        async (msg) => {
          const args = msg.content.substring(11).trim().split(' ');
          if (args.length < 3) {
            await msg.reply('Usage: /vault add <site> <username> <password> [notes]');
            return;
          }
          const [site, username, password, ...notesParts] = args;
          const notes = notesParts.join(' ');
          try {
            await passwordVault.storeCredential({ site, username, password, notes });
            await msg.reply('🔐 Credential stored in Google Sheets.');
          } catch (error) {
            await msg.reply(`❌ Vault error: ${error.message}`);
          }
        }
      );
      
      // Deploy command (manual deploy)
      router.registerHandler(
        'Deploy Command',
        100,
        (msg) => msg.content.startsWith('/deploy'),
        async (msg) => {
          await msg.reply('🚀 Manual deployment not yet implemented. Use /build for autonomous deployment.');
        }
      );
      
      // Help command
      router.registerHandler(
        'Help Command',
        100,
        (msg) => msg.content.startsWith('/help'),
        async (msg) => {
          await msg.reply(
            `🤖 **OpenClaw Commands**\n\n` +
            `\`/build\` - Start autonomous build & deploy\n` +
            `\`/launch-now\` - Trigger monthly launch immediately\n` +
            `\`/status\` - Check system status\n` +
            `\`/deploy\` - Manual deployment (coming soon)\n` +
            `\`/docs\` - List knowledge base docs\n` +
            `\`/search <query>\` - Search knowledge base\n` +
            `\`/backup-now\` - Run backups now\n` +
            `\`/pause-autonomy\` - Pause autonomous schedules\n` +
            `\`/resume-autonomy\` - Resume autonomous schedules\n` +
            `\`/debug-fix\` - Run diagnostics and auto-heal if needed\n` +
            `\`/update-plan\` - Analyze updates and risks\n` +
            `\`/update-apply <pkg>@<ver>\` - Apply one update\n` +
            `\`/setup-channels\` - Create OpenClaw channels\n` +
            `\`/build-roadmap-all\` - Build/deploy all roadmap items\n` +
            `\`/roadmap-status\` - Show roadmap progress report\n` +
            `\`/vault add <site> <user> <pass> [notes]\` - Save credentials\n` +
            `\`/help\` - Show this help\n\n` +
            `**Autonomous Mode:**\n` +
            `OpenClaw builds features monthly on the 1st at 9:00 AM ET.\n` +
            `Roadmap features are always built FIRST.\n` +
            `New AI ideas require your ✅ approval before building.`
          );
        }
      );

      // Docs command
      router.registerHandler(
        'Docs Command',
        90,
        (msg) => msg.content.startsWith('/docs'),
        async (msg) => {
          const docs = claudeService.knowledgeBase.getAllDocuments();
          if (!docs || docs.length === 0) {
            await msg.reply('📚 Knowledge base is empty or not configured.');
            return;
          }
          const docList = docs.map(d => `• ${d.filename}`).join('\n');
          await msg.reply(`📚 ShieldTech Knowledge Base:\n${docList}`);
        }
      );

      // Search command
      router.registerHandler(
        'Search Command',
        90,
        (msg) => msg.content.startsWith('/search '),
        async (msg) => {
          const query = msg.content.substring(8).trim();
          if (!query) {
            await msg.reply('Usage: /search <query>');
            return;
          }
          const results = claudeService.knowledgeBase.getContext(query);
          const summary = results.length > 0
            ? `Found ${results.length} relevant documents`
            : 'No relevant documents found';
          await msg.reply(`🔍 Search: "${query}"\n${summary}`);
        }
      );
      
       // Conversational fallback
      router.registerConversationalHandler(async (msg) => {
        const userId = msg.author?.id || 'unknown-user';
        const username =
          msg.author?.username ||
          msg.author?.tag ||
          'Unknown User';
        const text = msg.content ?? '';

        // Pass the Discord message object as the 4th arg so the assistant
        // can reply directly in this channel.
        await assistant.handleMessage(userId, username, text, msg);
      });
      
      router.initialize();
      logger.info('✅ Message router initialized');
    }

    // One-time startup actions (auto-clear flags)
    if (process.env.AUTO_SETUP_CHANNELS === 'true' && discordService?.ensureChannels) {
      const already = await databaseService.hasSeededRoadmap('auto_setup_channels_done');
      if (!already) {
      await discordService.ensureChannels([
        'openclaw-updates',
        'openclaw-alerts',
        'openclaw-builds',
        'openclaw-security',
        'openclaw-backups',
        'openclaw-summaries'
      ]);
      await databaseService.markRoadmapSeeded('auto_setup_channels_done');
      }
    }

    if (process.env.AUTO_BUILD_ROADMAP === 'true' && builder?.buildAllRoadmapFeatures) {
      const already = await databaseService.hasSeededRoadmap('auto_build_roadmap_done');
      if (!already) {
        await builder.buildAllRoadmapFeatures();
        await databaseService.markRoadmapSeeded('auto_build_roadmap_done');
      }
    }
    
    logger.info('✅ ALL SERVICES RUNNING!');
    logger.info('🤖 Autonomous deployment pipeline ACTIVE');
    
    // Send startup notification
    if (discordService?.sendEmbed) {
      await discordService.sendEmbed({
        title: '🤖 OPENCLAW AUTONOMOUS MODE ACTIVE',
        description: '**Full autonomous deployment pipeline ready!**',
        fields: [
          { name: '🔨', value: 'Autonomous Builder', inline: true },
          { name: '🚀', value: 'Deployment Engine', inline: true },
          { name: '📊', value: 'Cost Tracking', inline: true },
          { name: '🔐', value: 'Approval Gates', inline: true },
          { name: '🗄️', value: 'Database Logging', inline: true },
          { name: '🗺️', value: 'Roadmap-First Build', inline: true }
        ],
        footer: { text: 'Send /help for commands' },
        color: 0x9b59b6
      });
    }
    
  } catch (error) {
    logger.error('Startup failed:', error);
    process.exit(1);
  }
}

main();
