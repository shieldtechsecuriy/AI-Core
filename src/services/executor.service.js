const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

class ExecutorService {
  constructor(config) {
    this.pi4CoreHost = config.pi4CoreHost;
    this.pi4AutoHost = config.pi4AutoHost;
    this.sshKeyPath = config.sshKeyPath || '~/.ssh/openclaw_pi';
    this.piUser = config.piUser || 'daniel';
  }

  async executeOnPi(host, commands) {
    const commandString = Array.isArray(commands) ? commands.join(' && ') : commands;
    
    const sshCommand = `ssh -i ${this.sshKeyPath} -o StrictHostKeyChecking=no ${this.piUser}@${host} "${commandString}"`;
    
    logger.info('Executing on Pi', { host, command: commandString });
    
    try {
      const { stdout, stderr } = await execAsync(sshCommand);
      
      logger.info('Pi execution complete', { host, stdout: stdout.substring(0, 200) });
      
      return {
        success: true,
        stdout,
        stderr
      };
    } catch (error) {
      logger.error('Pi execution failed', { host, error: error.message });
      
      return {
        success: false,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr
      };
    }
  }


  async execCommand(command) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
      const { stdout, stderr } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
      if (stderr && !stdout) {
        throw new Error(stderr);
      }
      return { stdout, stderr };
    } catch (error) {
      throw error;
    }
  }

  async deployToPi(target, files, deploymentSteps) {
    const sshKeyPath = process.env.SSH_KEY_PATH || '/home/kosmox_ai/.ssh/openclaw_pi';
    const piUser = process.env.PI_USER || 'shieldtech';
    const host = target === 'pi4-core' 
      ? (process.env.PI4_CORE_HOST || '100.127.213.67')
      : (process.env.PI4_AUTO_HOST || '100.104.230.113');

    
    logger.info('Starting deployment', { target, fileCount: files.length });
    
    // Create temp directory for files
    const tempDir = `/tmp/openclaw-deploy-${Date.now()}`;
    await fs.mkdir(tempDir, { recursive: true });
    
    try {
      // Write files locally first
      for (const file of files) {
        const localPath = path.join(tempDir, path.basename(file.path));
        await fs.writeFile(localPath, file.content);
      }
      
      // Copy files to Pi
      for (const file of files) {
        const localPath = path.join(tempDir, path.basename(file.path));
        const remotePath = file.path;
        
    
    // Create remote directory first
    const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
    const mkdirCommand = `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no ${piUser}@${host} "mkdir -p ${remoteDir}"`;
    await this.execCommand(mkdirCommand);

        const scpCommand = `scp -i ${sshKeyPath} -o StrictHostKeyChecking=no "${localPath}" "${piUser}@${host}:${remotePath}"`;
        
        await execAsync(scpCommand);
        logger.info('File copied to Pi', { file: file.path });
      }
      
      // Execute deployment steps
      const result = await this.executeOnPi(host, deploymentSteps);
      
      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
      
      return result;
      
    } catch (error) {
      logger.error('Deployment failed', { target, error: error.message });
      
      // Cleanup on error
      await fs.rm(tempDir, { recursive: true, force: true });
      
      throw error;
    }
  }

  async runTests(host, testCommand) {
    return this.executeOnPi(host, testCommand);
  }

  async checkPiStatus(host) {
    const commands = [
      'uptime',
      'df -h /',
      'free -h'
    ];
    
    return this.executeOnPi(host, commands);
  }
}

module.exports = ExecutorService;
