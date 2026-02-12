const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const ClaudeService = require('./claude.service');

const execPromise = util.promisify(exec);

class MultiDeployService {
  constructor() {
    this.claudeService = new ClaudeService();
    
    this.targets = {
      'oracle-master': {
        host: 'localhost',
        user: 'kosmox_ai',
        basePath: '/home/kosmox_ai/openclaw',
        type: 'local'
      },
      'pi4-core': {
        host: process.env.PI4_CORE_HOST || '100.127.213.67',
        user: process.env.PI_USER || 'shieldtech',
        basePath: '/home/shieldtech',
        type: 'ssh',
        sshKey: process.env.SSH_KEY_PATH || '/home/kosmox_ai/.ssh/openclaw_pi'
      },
      'pi4-auto': {
        host: process.env.PI4_AUTO_HOST || '100.104.230.113',
        user: process.env.PI_USER || 'shieldtech',
        basePath: '/home/shieldtech',
        type: 'ssh',
        sshKey: process.env.SSH_KEY_PATH || '/home/kosmox_ai/.ssh/openclaw_pi'
      }
    };
  }

  async deployToAllTargets(files, targetList = ['pi4-core', 'pi4-auto']) {
    console.log(`\n🚀 Multi-Device Deployment`);
    console.log(`   Targets: ${targetList.join(', ')}\n`);
    
    const results = { successful: [], failed: [], details: {} };
    
    for (const targetName of targetList) {
      const target = this.targets[targetName];
      if (!target) continue;
      
      console.log(`📦 Deploying to ${targetName}...`);
      
      try {
        const result = await this.deployToTarget(target, targetName, files);
        
        if (result.success) {
          results.successful.push(targetName);
          console.log(`✅ ${targetName} deployed`);
        } else {
          console.log(`🔧 Auto-fixing ${targetName}...`);
          const fixResult = await this.autoFixDeployment(target, targetName, result.error, files);
          
          if (fixResult.success) {
            results.successful.push(targetName);
            console.log(`✅ ${targetName} auto-fixed`);
          } else {
            results.failed.push(targetName);
          }
        }
        
        results.details[targetName] = result;
        
      } catch (error) {
        results.failed.push(targetName);
        console.error(`❌ ${targetName}:`, error.message);
      }
    }
    
    console.log(`\n✅ ${results.successful.length} successful | ❌ ${results.failed.length} failed\n`);
    return results;
  }

  async deployToTarget(target, targetName, files) {
    const result = { target: targetName, success: false, filesDeployed: [], errors: [] };
    
    try {
      for (const file of files) {
        const deployResult = await this.deployFile(target, file);
        if (deployResult.success) {
          result.filesDeployed.push(file.path);
        } else {
          result.errors.push({ file: file.path, error: deployResult.error });
        }
      }
      
      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push({ step: 'deployment', error: error.message });
    }
    
    return result;
  }

  async deployFile(target, file) {
    try {
      const remotePath = file.path.replace(/\/home\/daniel/g, target.basePath);
      const remoteDir = path.dirname(remotePath);
      
      const mkdirCmd = `ssh -i ${target.sshKey} -o StrictHostKeyChecking=no ${target.user}@${target.host} "mkdir -p ${remoteDir}"`;
      await execPromise(mkdirCmd);
      
      const tempFile = `/tmp/openclaw-${Date.now()}-${path.basename(file.path)}`;
      await fs.writeFile(tempFile, file.content);
      
      const scpCmd = `scp -i ${target.sshKey} -o StrictHostKeyChecking=no "${tempFile}" "${target.user}@${target.host}:${remotePath}"`;
      await execPromise(scpCmd);
      
      await fs.unlink(tempFile);
      return { success: true };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async autoFixDeployment(target, targetName, errorMessage, files) {
    try {
      const fixPrompt = `Deployment error on ${targetName}: ${errorMessage}

Fix the code. Return format:
<file path="/path/to/file.js">
corrected code
</file>`;

      const fixResponse = await this.claudeService.analyze({ description: fixPrompt });
      const fixedFiles = this.parseFixedFiles(fixResponse);
      
      if (fixedFiles.length > 0) {
        return await this.deployToTarget(target, targetName, fixedFiles);
      }
      
      return { success: false, error: 'No fixes generated' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  parseFixedFiles(content) {
    const files = [];
    const fileRegex = /<file path="([^"]+)">\n([\s\S]*?)\n<\/file>/g;
    let match;
    while ((match = fileRegex.exec(content)) !== null) {
      files.push({ path: match[1], content: match[2] });
    }
    return files;
  }
}

module.exports = MultiDeployService;
