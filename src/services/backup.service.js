const { Client } = require('ssh2');
const fs = require('fs').promises;
const path = require('path');
const schedule = require('node-schedule');
const { google } = require('googleapis');
const logger = require('../utils/logger');

const SSH_READY_TIMEOUT_MS = parseInt(process.env.SSH_READY_TIMEOUT_MS || '30000', 10);

class BackupService {
  constructor(discordService) {
    this.discordService = discordService;
  }

  async start() {
    const timezone = process.env.DEFAULT_TZ || 'America/New_York';
    // Weekly backups on Sunday at 2:00 AM ET
    schedule.scheduleJob({ rule: '0 2 * * 0', tz: timezone }, () => {
      this.runAllBackups().catch(err => logger.error('Scheduled backup failed:', err));
    });
  }

  async runAllBackups() {
    const targets = this.getTargets();
    if (targets.length === 0) {
      logger.warn('No backup targets configured');
      return;
    }

    await this.notify('📦 Backup started', `Targets: ${targets.map(t => t.name).join(', ')}`);

    for (const target of targets) {
      try {
        await this.backupTarget(target);
      } catch (error) {
        logger.error(`Backup failed for ${target.name}:`, error);
        await this.notify('❌ Backup failed', `${target.name}: ${error.message}`);
      }
    }

    await this.notify('✅ Backup complete', 'All targets processed');
  }

  getTargets() {
    const targets = [];
    if (process.env.PI4_AUTO_HOST && process.env.PI4_AUTO_USER) {
      targets.push({
        name: 'pi4-auto',
        host: process.env.PI4_AUTO_HOST,
        user: process.env.PI4_AUTO_USER,
        paths: (process.env.BACKUP_PATHS_AUTO || process.env.PI4_AUTO_PATH || '/home').split(',')
      });
    }
    if (process.env.PI4_CORE_HOST && process.env.PI4_CORE_USER) {
      targets.push({
        name: 'pi4-core',
        host: process.env.PI4_CORE_HOST,
        user: process.env.PI4_CORE_USER,
        paths: (process.env.BACKUP_PATHS_CORE || process.env.PI4_CORE_PATH || '/home').split(',')
      });
    }
    if (process.env.ORACLE_HOST && process.env.ORACLE_USER && process.env.ORACLE_HOST !== 'localhost') {
      targets.push({
        name: 'cloud-vm',
        host: process.env.ORACLE_HOST,
        user: process.env.ORACLE_USER,
        paths: (process.env.BACKUP_PATHS_CLOUD || process.env.ORACLE_PATH || '/home').split(',')
      });
    }
    return targets;
  }

  async backupTarget(target) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `openclaw-${target.name}-${timestamp}.tar.gz`;
    const remotePath = `/tmp/${archiveName}`;
    const localDir = path.join('/tmp', 'openclaw-backups');
    const localPath = path.join(localDir, archiveName);

    await fs.mkdir(localDir, { recursive: true });
    await this.execSSH(target, `tar czf ${remotePath} ${target.paths.join(' ')}`);
    await this.downloadSSH(target, remotePath, localPath);
    await this.execSSH(target, `rm -f ${remotePath}`);

    await this.uploadToDrive(localPath, archiveName);
    await fs.unlink(localPath);

    logger.info(`✅ Backup uploaded for ${target.name}`);
  }

  async execSSH(target, command) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn
        .on('ready', () => {
          conn.exec(command, (err, stream) => {
            if (err) {
              conn.end();
              return reject(err);
            }
            let stderr = '';
            stream.on('close', (code) => {
              conn.end();
              if (code !== 0 && stderr) {
                reject(new Error(stderr));
              } else {
                resolve();
              }
            });
            stream.stderr.on('data', (data) => {
              stderr += data.toString();
            });
          });
        })
        .on('error', reject)
        .connect(this.buildSSHConfig(target));
    });
  }

  async downloadSSH(target, remotePath, localPath) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn
        .on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end();
              return reject(err);
            }
            sftp.fastGet(remotePath, localPath, {}, (getErr) => {
              conn.end();
              if (getErr) reject(getErr);
              else resolve();
            });
          });
        })
        .on('error', reject)
        .connect(this.buildSSHConfig(target));
    });
  }

  buildSSHConfig(target) {
    return {
      host: target.host,
      port: 22,
      username: target.user,
      readyTimeout: SSH_READY_TIMEOUT_MS,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
      privateKey: process.env.PI_SSH_KEY_PATH
        ? require('fs').readFileSync(process.env.PI_SSH_KEY_PATH)
        : undefined
    };
  }

  async uploadToDrive(filePath, name) {
    const folderId = process.env.BACKUP_DRIVE_FOLDER_ID;
    if (!folderId) throw new Error('BACKUP_DRIVE_FOLDER_ID not configured');

    const auth = await this.createAuth();
    const drive = google.drive({ version: 'v3', auth });

    await drive.files.create({
      requestBody: {
        name,
        parents: [folderId]
      },
      media: {
        mimeType: 'application/gzip',
        body: require('fs').createReadStream(filePath)
      }
    });
  }

  async createAuth() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      return new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
      );
    }
    if (process.env.GOOGLE_SERVICE_ACCOUNT_PATH) {
      const credentials = require(process.env.GOOGLE_SERVICE_ACCOUNT_PATH);
      return new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
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

  async notify(title, description) {
    if (this.discordService?.sendEmbed) {
      await this.discordService.sendEmbed({
        title,
        description,
        color: 0x3498db
      });
    }
  }
}

module.exports = BackupService;