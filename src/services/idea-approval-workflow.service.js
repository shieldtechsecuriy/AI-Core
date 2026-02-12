const logger = require('../utils/logger');
const schedule = require('node-schedule');
const { google } = require('googleapis');

class IdeaApprovalWorkflowService {
  constructor(claudeService, discordService, googleService) {
    this.claudeService = claudeService;
    this.discordService = discordService;
    this.googleService = googleService;
    this.sheets = google.sheets({ version: 'v4', auth: googleService.auth });
    this.spreadsheetId = process.env.IDEA_APPROVAL_SHEET_ID || null;
  }

  async start() {
    logger.info('💡 Idea Approval Workflow starting...');
    
    // Create approval spreadsheet if it doesn't exist
    if (!this.spreadsheetId) {
      await this.createApprovalSheet();
    }
    
    // Generate ideas every 4 hours
    schedule.scheduleJob('0 */4 * * *', () => this.generateNewIdeas());
    
    // Check for approvals every 15 minutes
    schedule.scheduleJob('*/15 * * * *', () => this.checkApprovals());
    
    // Initial idea generation in 10 seconds
    setTimeout(() => this.generateNewIdeas(), 10000);
    
    if (this.discordService?.sendEmbed) {
      await this.discordService.sendEmbed({
        title: '🔄 IDEA APPROVAL WORKFLOW ACTIVE',
        description: 'Generate ideas → Get approval → Auto-build',
        fields: [
          { name: 'Idea Generation', value: 'Every 4 hours', inline: true },
          { name: 'Approval Check', value: 'Every 15 minutes', inline: true },
          { name: 'Sheet', value: this.spreadsheetId ? 'Connected' : 'Creating...', inline: true }
        ],
        color: 0x9b59b6
      });
    }
  }

  async createApprovalSheet() {
    try {
      logger.info('📊 Creating Business Ideas Approval Sheet...');
      
      const sheets = google.sheets({ version: 'v4', auth: this.googleService.auth });
      
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: `OpenClaw Business Ideas - ${new Date().toISOString().split('T')[0]}`
          },
          sheets: [{
            properties: { title: 'Ideas Pending Approval' },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [{
                values: [
                  { userEnteredValue: { stringValue: 'Date Generated' } },
                  { userEnteredValue: { stringValue: 'Idea Name' } },
                  { userEnteredValue: { stringValue: 'Category' } },
                  { userEnteredValue: { stringValue: 'Description' } },
                  { userEnteredValue: { stringValue: 'Estimated Value' } },
                  { userEnteredValue: { stringValue: 'Build Time' } },
                  { userEnteredValue: { stringValue: 'Status' } },
                  { userEnteredValue: { stringValue: 'APPROVE (Y/N)' } },
                  { userEnteredValue: { stringValue: 'Notes' } }
                ]
              }]
            }]
          }]
        }
      });
      
      this.spreadsheetId = spreadsheet.data.spreadsheetId;
      logger.info(`✅ Created sheet: ${this.spreadsheetId}`);
      
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`;
      
      if (this.discordService?.sendEmbed) {
        await this.discordService.sendEmbed({
          title: '📊 APPROVAL SHEET CREATED',
          description: `[Click here to approve/deny ideas](${sheetUrl})`,
          color: 0x3498db
        });
      }
      
      return this.spreadsheetId;
    } catch (error) {
      logger.error('Failed to create approval sheet:', error);
      throw error;
    }
  }

  async generateNewIdeas() {
    try {
      logger.info('💡 Generating new business ideas...');
      
      const prompt = `Generate 3 concrete business ideas for ShieldTech Security. Return ONLY JSON array: [{"name":"...","category":"...","description":"...","estimated_revenue":"...","build_time":"..."}]`;

      const response = await this.claudeService.generate(prompt);
      
      let ideas;
      try {
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        ideas = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
      } catch (e) {
        logger.error('Could not parse ideas:', e.message);
        return;
      }
      
      for (const idea of ideas) {
        await this.addIdeaToSheet(idea);
      }
      
      logger.info(`✅ Added ${ideas.length} ideas to approval sheet`);
      
    } catch (error) {
      logger.error('Idea generation failed:', error);
    }
  }

  async addIdeaToSheet(idea) {
    const row = [
      new Date().toISOString().split('T')[0],
      idea.name,
      idea.category,
      idea.description,
      idea.estimated_revenue || 'TBD',
      idea.build_time || 'TBD',
      'Pending',
      '',
      ''
    ];
    
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'Ideas Pending Approval!A:I',
      valueInputOption: 'RAW',
      requestBody: { values: [row] }
    });
  }

  async checkApprovals() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Ideas Pending Approval!A2:I'
      });
      
      const rows = response.data.values || [];
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const approval = row[7]?.toUpperCase();
        const status = row[6];
        
        if (approval === 'Y' && status === 'Pending') {
          await this.buildApprovedIdea(row[1], row[3], i + 2);
        }
      }
    } catch (error) {
      logger.error('Approval check failed:', error);
    }
  }

  async buildApprovedIdea(ideaName, description, rowNumber) {
    try {
      logger.info(`🔨 Building: ${ideaName}`);
      
      if (this.discordService?.sendEmbed) {
        await this.discordService.sendEmbed({
          title: '🚀 BUILDING APPROVED IDEA',
          description: ideaName,
          color: 0x2ecc71
        });
      }
      
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Ideas Pending Approval!G${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [['✅ Built']] }
      });
      
    } catch (error) {
      logger.error(`Build failed:`, error);
    }
  }
}

module.exports = IdeaApprovalWorkflowService;
