const { Client } = require('ssh2');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');
const N8NWorkflowGenerator = require('./n8n-workflow-generator.service');
const GoogleService = require('./google.service');

class AutonomousDeploymentEngine {
  constructor(claudeService, discordService, databaseService) {
    this.claude = claudeService;
    this.discord = discordService;
    this.db = databaseService;

    this.sshConfig = {
      pi4Auto: {
        host: process.env.PI4_AUTO_HOST,
        port: 22,
        username: process.env.PI4_AUTO_USER,
        readyTimeout: parseInt(process.env.SSH_READY_TIMEOUT_MS || '30000', 10),
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        privateKey: process.env.PI_SSH_KEY_PATH
          ? require('fs').readFileSync(process.env.PI_SSH_KEY_PATH)
          : null
      },
      pi4Core: {
        host: process.env.PI4_CORE_HOST,
        port: 22,
        username: process.env.PI4_CORE_USER,
        readyTimeout: parseInt(process.env.SSH_READY_TIMEOUT_MS || '30000', 10),
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        privateKey: process.env.PI_SSH_KEY_PATH
          ? require('fs').readFileSync(process.env.PI_SSH_KEY_PATH)
          : null
      }
    };
  }

  async buildAndDeploy(feature) {
    const deploymentId = Date.now().toString();

    try {
      await this.discord.sendEmbed({
        title: '🚀 AUTONOMOUS DEPLOYMENT STARTED',
        description: `Deploying: **${feature.feature_name}**`,
        fields: [
          { name: 'Target', value: feature.deployment_target, inline: true },
          { name: 'Priority', value: feature.priority, inline: true },
          { name: 'ID', value: deploymentId, inline: true }
        ],
        color: 0x3498db
      });

      logger.info('📝 Step 1: Generating code...');
      const code = await this.generateCode(feature);

      logger.info('📁 Step 2: Creating files locally...');
      const localPath = await this.createLocalFiles(feature, code, deploymentId);

      const requireApproval = String(process.env.REQUIRE_APPROVAL_FOR_DEPLOY || 'true') === 'true';
      if (requireApproval) {
        logger.info('🔐 Step 3: Requesting deployment approval...');
        const approved = await this.requestApproval(feature, deploymentId);
        if (!approved) throw new Error('Deployment cancelled by user');
      } else {
        logger.info('✅ Approval gate disabled, proceeding with deployment');
      }

      logger.info('🚢 Step 4: Deploying to target...');
      await this.sshDeploy(feature.deployment_target, localPath);

      logger.info('🔄 Step 5: Restarting services...');
      // restart skipped (no pm2/service unit on target)
      // await this.restartServices(feature.deployment_target);

      logger.info('✅ Step 6: Verifying deployment...');
      await this.verifyDeployment(feature.deployment_target);

      if (feature.needs_n8n) {
        logger.info('🔗 Step 7: Creating N8N workflows...');
        await this.createN8NWorkflows(feature);
      }

      if (feature.needs_sheets) {
        logger.info('📊 Step 8: Creating Google Sheets...');
        await this.createGoogleSheets(feature);
      }

      await this.discord.sendEmbed({
        title: '✅ DEPLOYMENT SUCCESSFUL',
        description: `**${feature.feature_name}** is now live!`,
        fields: [
          { name: 'Deployment ID', value: deploymentId },
          { name: 'Target', value: feature.deployment_target },
          { name: 'Status', value: '🟢 Operational' }
        ],
        color: 0x2ecc71
      });

      await this.logDeployment(deploymentId, feature, 'success');
      return { success: true, deploymentId };

    } catch (error) {
      logger.error('Deployment failed:', error);
      await this.discord.sendEmbed({
        title: '❌ DEPLOYMENT FAILED',
        description: `**${feature.feature_name}**\n\n${error.message}`,
        color: 0xe74c3c
      });
      await this.logDeployment(deploymentId, feature, 'failed', error.message);
      throw error;
    }
  }

  async generateCode(feature) {
    let fileList = Array.isArray(feature.files_needed) && feature.files_needed.length
      ? feature.files_needed
      : null;

    if (!fileList) {
      const planPrompt = `Return JSON only: { "files": ["path1", "path2"] }\n\nFeature: ${feature.feature_name}\nDescription: ${feature.description || ''}`;
      let plan = null;

      if (process.env.OPENAI_STRUCTURED === 'true' && typeof this.claude.generateStructured === 'function') {
        try {
          plan = await this.claude.generateStructured(
            { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } } }, required: ['files'], additionalProperties: false },
            planPrompt,
            { maxTokens: 512 }
          );
        } catch (e) {
          logger.warn('Structured plan failed, falling back to plain JSON');
        }
      }

      if (!plan) {
        const planText = await this.claude.chat(planPrompt, { maxTokens: 512 });
        plan = this.extractJsonSafe(planText);
      }

      if (plan && Array.isArray(plan)) {
        fileList = plan;
      } else if (plan && Array.isArray(plan.files)) {
        fileList = plan.files;
      }

      if (!fileList || fileList.length === 0) {
        throw new Error('Could not determine file list for code generation');
      }
    }

    const files = [];
    for (const filePath of fileList) {
      const filePrompt = `Generate the complete, production-ready code for this file only.\n\nFeature: ${feature.feature_name}\nDescription: ${feature.description || ''}\nFile path: ${filePath}\n\nReturn ONLY the raw file contents (no markdown, no code fences).`;
      let content = await this.claude.chat(filePrompt, { maxTokens: 2048 });
      content = this.stripCodeFences(content);
      files.push({ path: filePath, content });
    }

    return { files };
  }

  stripCodeFences(text) {
    if (!text) return '';
    const fence = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
    if (fence) return fence[1].trim();
    return text.trim();
  }

  async extractJsonSafe(text) {
    const fenceMatch = text.match(/```json\\s*([\\s\\S]*?)\\s*```/i);
    if (fenceMatch) {
      const parsed = this.tryParseJson(fenceMatch[1]);
      if (parsed) return parsed;
    }

    const balanced = this.findBalancedJson(text);
    if (balanced) {
      const parsed = this.tryParseJson(balanced);
      if (parsed) return parsed;
    }

    try {
      const repaired = await this.repairJsonWithClaude(text);
      const parsed = this.tryParseJson(repaired);
      if (parsed) return parsed;
    } catch (e) {
      logger.warn('JSON repair failed:', e.message);
    }

    return null;
  }

  tryParseJson(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  findBalancedJson(text) {
    let start = -1;
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') {
        if (start === -1) start = i;
        depth++;
      } else if (ch === '}') {
        if (depth > 0) depth--;
        if (depth === 0 && start !== -1) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  async repairJsonWithClaude(badJson) {
    const prompt = `Fix this JSON so it is valid. Return ONLY valid JSON, no markdown.\\n\\n${badJson}`;
    return await this.claude.chat(prompt, { maxTokens: 1024 });
  }

  async createLocalFiles(feature, code, deploymentId) {
    const buildDir = path.join('/tmp', `openclaw-build-${deploymentId}`);
    await fs.mkdir(buildDir, { recursive: true });

    for (const file of code.files) {
      const filePath = path.join(buildDir, file.path);
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content);
      logger.info(`✅ Created: ${file.path}`);
    }

    return buildDir;
  }

  async requestApproval(feature, deploymentId) {
    const msg = await this.discord.sendEmbed({
      title: '🔐 APPROVAL REQUIRED',
      description: `Ready to deploy **${feature.feature_name}**`,
      fields: [
        { name: 'Target', value: feature.deployment_target },
        { name: 'Files', value: feature.files_needed.join('\\n') },
        { name: 'Deployment ID', value: deploymentId }
      ],
      color: 0xf39c12
    });

    if (!msg) throw new Error('Could not send approval request');

    await msg.react('✅');
    await msg.react('❌');

    return new Promise((resolve) => {
      const filter = (reaction, user) => ['✅', '❌'].includes(reaction.emoji.name) && !user.bot;
      const collector = msg.createReactionCollector({ filter, time: 60000, max: 1 });

      collector.on('collect', (reaction) => resolve(reaction.emoji.name === '✅'));
      collector.on('end', (collected) => { if (collected.size === 0) resolve(false); });
    });
  }

  async sshDeploy(target, localPath) {
    const config = target === 'pi4-auto' ? this.sshConfig.pi4Auto : this.sshConfig.pi4Core;

    return new Promise((resolve, reject) => {
      const conn = new Client();

      conn.on('ready', async () => {
        try {
          const remotePath =
            (target === 'pi4-auto' ? process.env.PI4_AUTO_PATH : process.env.PI4_CORE_PATH) ||
            '/home/shieldtech/openclaw-builds';

          await this.execSSH(conn, `mkdir -p ${remotePath}`);
          await this.uploadDirectory(conn, localPath, remotePath);

          logger.info('✅ Files deployed via SFTP');
          conn.end();
          resolve();
        } catch (error) {
          conn.end();
          reject(error);
        }
      });

      conn.on('error', reject);
      conn.connect(config);
    });
  }

  async uploadDirectory(conn, localDir, remoteDir) {
    const fs = require('fs');
    const path = require('path');

    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)));
    });

    const mkdir = (dir) =>
      new Promise((resolve) => sftp.mkdir(dir, { mode: 0o755 }, () => resolve()));

    const uploadFile = (localPath, remotePath) =>
      new Promise((resolve, reject) =>
        sftp.fastPut(localPath, remotePath, {}, (err) => (err ? reject(err) : resolve()))
      );

    const walkDir = async (dir, rel = '') => {
      const full = path.join(dir, rel);
      const entries = await fs.promises.readdir(full, { withFileTypes: true });
      for (const entry of entries) {
        const relPath = path.join(rel, entry.name);
        const localPath = path.join(dir, relPath);
        const remotePath = path.posix.join(remoteDir, relPath.split(path.sep).join('/'));
        if (entry.isDirectory()) {
          await mkdir(remotePath);
          await walkDir(dir, relPath);
        } else {
          await uploadFile(localPath, remotePath);
        }
      }
    };

    await mkdir(remoteDir);
    await walkDir(localDir);
  }

  execSSH(conn, command) {
    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) return reject(err);

        let output = '';
        let errOut = '';
        stream.on('data', (data) => { output += data.toString(); });
        stream.stderr.on('data', (data) => { errOut += data.toString(); });

        stream.on('close', (code) => {
          if (code === 0) resolve(output);
          else reject(new Error(`Command failed with code ${code}: ${command}\n${output}\n${errOut}`));
        });
      });
    });
  }

  async restartServices(target) {
    const config = target === 'pi4-auto' ? this.sshConfig.pi4Auto : this.sshConfig.pi4Core;

    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', async () => {
        try {
          await this.execSSH(conn, 'PATH=$PATH:/usr/local/bin:/home/shieldtech/.npm-global/bin; pm2 restart all || sudo -n systemctl restart shieldtech-api');
          logger.info('✅ Services restarted');
          conn.end();
          resolve();
        } catch (error) {
          conn.end();
          reject(error);
        }
      });
      conn.connect(config);
    });
  }

  async verifyDeployment(target) {
    if (target === 'pi4-auto') {
      logger.info('✅ Skipping health check for pi4-auto (no service port)');
      return;
    }

    const url = target === 'pi4-auto'
      ? `http://${this.sshConfig.pi4Auto.host}:3003/health`
      : `http://${this.sshConfig.pi4Core.host}:3002/`;

    await new Promise(r => setTimeout(r, 10000));

    let lastErr = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const response = await axios.get(url, { timeout: 5000 });
        if (response.status === 200) {
          logger.info('✅ Deployment verified');
          return;
        }
      } catch (err) {
        lastErr = err;
      }
      await new Promise(r => setTimeout(r, 5000));
    }

    throw lastErr || new Error('Health check failed after retries');
  }

  async createN8NWorkflows(feature) {
    const dryRun = String(process.env.DRY_RUN || 'false') === 'true';
    const generator = new N8NWorkflowGenerator();
    const baseUrl = process.env.N8N_BASE_URL;
    const apiKey = process.env.N8N_API_KEY;
    const apiPath = process.env.N8N_API_PATH || '/api/v1/workflows';
    const createSheet = String(process.env.N8N_CREATE_SHEET_PER_WORKFLOW || 'true') === 'true';

    let sheetId = null;
    if (createSheet) {
      sheetId = await this.createGoogleSheets(feature, { dryRun });
    }

    const workflow = generator.buildWorkflowForFeature(feature, {
      sheetId,
      webhookPath: `openclaw-${Date.now()}`,
      sheetsCredentialId: process.env.N8N_GOOGLE_SHEETS_CREDENTIAL_ID || null
    });

    await generator.createWorkflowForFeature(
      { ...feature, feature_name: feature.feature_name || feature.name },
      {
        sheetId,
        webhookPath: `openclaw-${Date.now()}`,
        sheetsCredentialId: process.env.N8N_GOOGLE_SHEETS_CREDENTIAL_ID || null
      }
    );

    if (!baseUrl || !apiKey) {
      logger.warn('N8N_BASE_URL or N8N_API_KEY not configured; workflow exported only');
      return { workflowId: null, sheetId };
    }

    if (dryRun) {
      logger.info('🧪 DRY_RUN enabled; skipping N8N API create');
      return { workflowId: 'dry-run', sheetId };
    }

    const url = `${baseUrl.replace(/\/+$/, '')}${apiPath}`;
    const response = await axios.post(url, workflow, {
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': apiKey,
        Authorization: `Bearer ${apiKey}`
      },
      timeout: 15000
    });

    const workflowId = response.data?.id || response.data?.data?.id || null;
    const workflowUrl = workflowId ? `${baseUrl.replace(/\/+$/, '')}/workflow/${workflowId}` : null;

    if (this.db?.saveWorkflowMap) {
      await this.db.saveWorkflowMap({
        featureName: feature.feature_name || feature.name,
        sheetId,
        workflowId,
        workflowUrl
      });
    }

    logger.info(`✅ N8N workflow created: ${workflowId || 'unknown'}`);
    return { workflowId, sheetId };
  }

  async createGoogleSheets(feature, options = {}) {
    const dryRun = options.dryRun || String(process.env.DRY_RUN || 'false') === 'true';
    const folderId = process.env.BACKUP_DRIVE_FOLDER_ID;
    if (!folderId) {
      logger.warn('BACKUP_DRIVE_FOLDER_ID not configured; skipping sheet creation');
      return null;
    }

    if (dryRun) {
      logger.info('🧪 DRY_RUN enabled; skipping Google Sheets create');
      return 'dry-run-sheet';
    }

    const googleService = new GoogleService();
    await googleService.initialize();

    const title = `OpenClaw - ${feature.feature_name || feature.name} - ${new Date().toISOString().slice(0, 10)}`;

    const sheet = await googleService.sheets.spreadsheets.create({
      requestBody: { properties: { title } }
    });

    const sheetId = sheet.data?.spreadsheetId;
    if (!sheetId) return null;

    await googleService.drive.files.update({
      fileId: sheetId,
      addParents: folderId,
      removeParents: 'root',
      fields: 'id, parents'
    });

    if (this.db?.saveWorkflowMap) {
      await this.db.saveWorkflowMap({
        featureName: feature.feature_name || feature.name,
        sheetId,
        workflowId: null,
        workflowUrl: null
      });
    }

    logger.info(`✅ Google Sheet created: ${sheetId}`);
    return sheetId;
  }

  async logDeployment(deploymentId, feature, status, error = null) {
    if (!this.db) return;

    try {
      await this.db.run(`
        INSERT INTO deployments (
          deployment_id,
          feature_name,
          target,
          status,
          error_message,
          deployed_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      `, [
        deploymentId,
        feature.feature_name,
        feature.deployment_target,
        status,
        error
      ]);
    } catch (err) {
      logger.error('Failed to log deployment:', err);
    }
  }
}

module.exports = AutonomousDeploymentEngine;
