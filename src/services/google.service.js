const { google } = require('googleapis');
const logger = require('../utils/logger');

class GoogleService {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.sheets = null;
  }

  async initialize() {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });

      this.auth = oauth2Client;
      this.drive = google.drive({ version: 'v3', auth: oauth2Client });
      this.sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      logger.info('✅ Google API initialized');
      return true;
    } catch (error) {
      logger.error('Google API initialization failed:', error.message);
      throw error;
    }
  }
}

module.exports = GoogleService;
