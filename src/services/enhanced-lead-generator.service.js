const logger = require('../utils/logger');

class EnhancedLeadGeneratorService {
  constructor(googleService, driveArchitect, discordService, claudeService) {
    this.googleService = googleService;
    this.discordService = discordService;
    this.claudeService = claudeService;
    this.leadsToday = 0;
    this.leadTrackerSheetId = null;
    this.interval = 2 * 60 * 60 * 1000; // 2 hours
  }

  async start() {
    logger.info('🔍 Enhanced Lead Generator starting...');
    await new Promise(r => setTimeout(r, 5000)); // Wait for architect
    this.leadTrackerSheetId = process.env.LEAD_TRACKER_SHEET_ID;
    if (!this.leadTrackerSheetId) {
      logger.warn('No Lead Tracker found, creating new...');
      await this.createLeadTracker();
    } else {
      logger.info(`✅ Using existing: ${this.leadTrackerSheetId}`);
      await this.analyzeExistingSheet();
    }
    await this.notifyDiscord({
      title: '🔍 ENHANCED LEAD GENERATOR ACTIVE',
      description: 'Integrated with your existing tracker',
      fields: [
        { name: 'Target', value: '50+ leads/day' },
        { name: 'Mode', value: '✅ Append to existing' }
      ],
      color: 0x9b59b6
    });
    this.timer = setInterval(() => this.generateLeadBatch(), this.interval);
  }

  async analyzeExistingSheet() {
    try {
      const response = await this.googleService.sheets.spreadsheets.values.get({
        spreadsheetId: this.leadTrackerSheetId,
        range: 'A1:Z1'
      });
      this.existingHeaders = response.data.values?.[0] || [];
      const dataResp = await this.googleService.sheets.spreadsheets.values.get({
        spreadsheetId: this.leadTrackerSheetId,
        range: 'A:A'
      });
      this.existingRowCount = dataResp.data.values?.length || 1;
      await this.notifyDiscord({
        title: '📊 EXISTING TRACKER ANALYZED',
        fields: [
          { name: 'Current Rows', value: (this.existingRowCount - 1).toString() },
          { name: 'Columns', value: this.existingHeaders.length.toString() }
        ],
        color: 0x3498db
      });
    } catch (error) {
      logger.error('Sheet analysis error:', error.message);
    }
  }

  async createLeadTracker() {
    const sheet = await this.googleService.createSpreadsheet({
      title: 'AI Lead Tracker - OpenClaw',
      data: [['Date','Business','Contact','Email','Phone','Address','Status','Notes']]
    });
    this.leadTrackerSheetId = sheet.id;
    process.env.LEAD_TRACKER_SHEET_ID = sheet.id;
  }

  async generateLeadBatch() {
    try {
      logger.info('🔍 Generating leads...');
      // Simplified for demo - would include actual scraping
      const leads = [];
      if (leads.length > 0) await this.appendToSheet(leads);
    } catch (error) {
      logger.error('Lead generation error:', error.message);
    }
  }

  async appendToSheet(leads) {
    try {
      const rows = leads.map(lead => this.mapToColumns(lead));
      await this.googleService.sheets.spreadsheets.values.append({
        spreadsheetId: this.leadTrackerSheetId,
        range: 'A:Z',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows }
      });
    } catch (error) {
      logger.error('Append error:', error.message);
    }
  }

  mapToColumns(lead) {
    const row = [];
    for (const header of this.existingHeaders || []) {
      const h = header.toLowerCase();
      if (h.includes('date')) row.push(new Date().toISOString().split('T')[0]);
      else if (h.includes('business')) row.push(lead.businessName);
      else if (h.includes('email')) row.push(lead.email || '');
      else row.push('');
    }
    return row;
  }

  async notifyDiscord(embed) {
    if (this.discordService?.sendEmbed) await this.discordService.sendEmbed(embed);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

module.exports = EnhancedLeadGeneratorService;
