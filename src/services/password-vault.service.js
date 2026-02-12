const { google } = require('googleapis');
const logger = require('../utils/logger');

class PasswordVaultService {
  constructor() {
    this.sheets = null;
  }

  async initialize() {
    const auth = await this.createAuth();
    this.sheets = google.sheets({ version: 'v4', auth });
    logger.info('✅ Password vault initialized');
  }

  async createAuth() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      return new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
      );
    }

    if (process.env.GOOGLE_SERVICE_ACCOUNT_PATH) {
      const credentials = require(process.env.GOOGLE_SERVICE_ACCOUNT_PATH);
      return new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return oauth2Client;
  }

  async storeCredential({ site, username, password, notes = '' }) {
    if (!this.sheets) await this.initialize();

    const spreadsheetId = process.env.PASSWORDS_SHEET_ID;
    const sheetName = process.env.PASSWORDS_SHEET_NAME || 'Passwords';

    if (!spreadsheetId) {
      throw new Error('PASSWORDS_SHEET_ID not configured');
    }

    const row = [
      new Date().toISOString(),
      site || '',
      username || '',
      password || '',
      notes || ''
    ];

    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:E`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row]
      }
    });

    logger.info('🔐 Stored credential in vault');
  }
}

module.exports = PasswordVaultService;
