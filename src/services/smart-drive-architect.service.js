const logger = require('../utils/logger');

class SmartDriveArchitectService {
  constructor(googleService, discordService, claudeService) {
    this.googleService = googleService;
    this.discordService = discordService;
    this.claudeService = claudeService;
    this.existingStructure = null;
    this.foldersCreated = 0;
    this.sheetsCreated = 0;
  }

  async start() {
    logger.info('🏗️ Smart Drive Architect starting...');
    await this.notifyDiscord({
      title: '🏗️ SMART DRIVE ARCHITECT ACTIVE',
      description: 'Analyzing existing structure and building intelligently',
      fields: [
        { name: 'Mode', value: 'Learn from existing + Auto-expand' },
        { name: 'Strategy', value: 'Mirror patterns, extend logically' }
      ],
      color: 0x3498db
    });
    await this.scanExistingStructure();
    await this.analyzePatterns();
    await this.createIntelligentExtensions();
    logger.info('✅ Drive architecture complete!');
  }

  async scanExistingStructure() {
    try {
      logger.info('🔍 Scanning existing Google Drive...');
      const folders = await this.googleService.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name, parents, createdTime)',
        pageSize: 1000
      });
      const sheets = await this.googleService.drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name, parents, createdTime)',
        pageSize: 1000
      });
      this.existingStructure = {
        folders: folders.data.files || [],
        sheets: sheets.data.files || [],
        totalFolders: folders.data.files?.length || 0,
        totalSheets: sheets.data.files?.length || 0
      };
      logger.info(`📊 Found ${this.existingStructure.totalFolders} folders, ${this.existingStructure.totalSheets} sheets`);
      await this.notifyDiscord({
        title: '🔍 EXISTING STRUCTURE SCANNED',
        fields: [
          { name: 'Folders', value: this.existingStructure.totalFolders.toString() },
          { name: 'Spreadsheets', value: this.existingStructure.totalSheets.toString() }
        ],
        color: 0x2ecc71
      });
      const leadTracker = this.existingStructure.sheets.find(s => 
        s.name.toLowerCase().includes('lead') && s.name.toLowerCase().includes('track')
      );
      if (leadTracker) {
        logger.info(`✅ Found Lead Tracker: ${leadTracker.name}`);
        process.env.LEAD_TRACKER_SHEET_ID = leadTracker.id;
        await this.notifyDiscord({
          title: '✅ LEAD TRACKER FOUND',
          description: `**${leadTracker.name}**`,
          fields: [{ name: 'ID', value: leadTracker.id }],
          color: 0x9b59b6
        });
      }
    } catch (error) {
      logger.error('Structure scan error:', error.message);
    }
  }

  async analyzePatterns() {
    try {
      logger.info('🧠 Analyzing patterns with AI...');
      const prompt = `Analyze this Google Drive and suggest structure:
${JSON.stringify(this.existingStructure, null, 2)}
Return JSON: {"folderNamingPattern":"","missingComponents":[],"suggestedStructure":{"folders":[],"sheets":[]}}`;
      const analysis = await this.claudeService.generateCode(prompt);
      const match = analysis.match(/\{[\s\S]*\}/);
      if (match) {
        this.patterns = JSON.parse(match[0]);
        await this.notifyDiscord({
          title: '🧠 PATTERN ANALYSIS COMPLETE',
          description: 'AI identified your organizational logic',
          color: 0xe74c3c
        });
      }
    } catch (error) {
      logger.error('Pattern analysis error:', error.message);
    }
  }

  async createIntelligentExtensions() {
    try {
      if (!this.patterns?.suggestedStructure) {
        await this.createDefaultStructure();
        return;
      }
      let rootFolder = this.existingStructure.folders.find(f => f.name.includes('OpenClaw'));
      if (!rootFolder) {
        rootFolder = await this.googleService.createFolder({ name: 'OpenClaw Automation' });
        this.foldersCreated++;
      }
      for (const name of this.patterns.suggestedStructure.folders || []) {
        const exists = this.existingStructure.folders.find(f => f.name.toLowerCase() === name.toLowerCase());
        if (!exists) {
          await this.googleService.createFolder({ name, parentFolderId: rootFolder.id });
          this.foldersCreated++;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      await this.notifyDiscord({
        title: '✅ INTELLIGENT STRUCTURE CREATED',
        fields: [
          { name: 'New Folders', value: this.foldersCreated.toString() },
          { name: 'New Sheets', value: this.sheetsCreated.toString() }
        ],
        color: 0x2ecc71
      });
    } catch (error) {
      logger.error('Extension creation error:', error.message);
    }
  }

  async createDefaultStructure() {
    const folders = ['OpenClaw Automation','Lead Generation','Reports','Backups'];
    for (const name of folders) {
      await this.googleService.createFolder({ name });
      this.foldersCreated++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  async notifyDiscord(embed) {
    if (this.discordService?.sendEmbed) await this.discordService.sendEmbed(embed);
  }
}

module.exports = SmartDriveArchitectService;
