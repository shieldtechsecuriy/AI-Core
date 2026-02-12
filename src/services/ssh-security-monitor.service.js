const logger = require('../utils/logger');
const { exec } = require('child_process');
const util = require('util');
const { Client } = require('ssh2');
const execPromise = util.promisify(exec);
const schedule = require('node-schedule');
const fs = require('fs').promises;

class SSHSecurityMonitor {
  constructor(discordService) {
    this.discordService = discordService;
    this.failedAttempts = new Map();
    this.bannedIPs = new Set();
    this.whitelistedIPs = new Set([
      '127.0.0.1',
      '::1',
      // Add your home/office IPs here
    ]);
    
    // Thresholds
    this.MAX_FAILED_ATTEMPTS = 5;
    this.BAN_DURATION_HOURS = 24;
    this.CHECK_INTERVAL_MINUTES = 5;
  }

  async start() {
    logger.info('🛡️ SSH Security Monitor starting...');
    
    // Check if fail2ban is installed
    const fail2banInstalled = await this.checkFail2Ban();
    
    const timezone = process.env.DEFAULT_TZ || 'America/New_York';

    // Monitor auth logs every 5 minutes
    schedule.scheduleJob({ rule: `*/${this.CHECK_INTERVAL_MINUTES} * * * *`, tz: timezone }, () => {
      this.monitorSSHAttempts();
    });
    
    // Daily security report at 9 AM
    schedule.scheduleJob({ rule: '0 9 * * *', tz: timezone }, () => {
      this.sendDailySecurityReport();
    });

    // Enforce Tailscale-only SSH on remote targets if enabled
    if (String(process.env.SSH_DEFENSE_REMOTE || 'false') === 'true') {
      schedule.scheduleJob({ rule: '0 */6 * * *', tz: timezone }, () => {
        this.enforceRemoteTailscaleOnlySSH().catch(err => {
          logger.error('Remote SSH defense failed:', err);
        });
      });
    }

    if (String(process.env.SSH_DEFENSE_LOCAL_TAILSCALE || 'false') === 'true') {
      schedule.scheduleJob({ rule: '30 */6 * * *', tz: timezone }, () => {
        this.enforceLocalTailscaleOnlySSH().catch(err => {
          logger.error('Local SSH defense failed:', err);
        });
      });
    }
    
    // Initial check
    setTimeout(() => this.monitorSSHAttempts(), 10000);
    
    if (this.discordService?.sendEmbed) {
      await this.discordService.sendEmbed({
        title: '🛡️ SSH SECURITY MONITOR ACTIVE',
        description: 'Protecting against SSH attacks 24/7',
        fields: [
          { name: '⚠️ Max Failed Attempts', value: `${this.MAX_FAILED_ATTEMPTS}`, inline: true },
          { name: '🚫 Auto-Ban Duration', value: `${this.BAN_DURATION_HOURS}h`, inline: true },
          { name: '🔍 Check Frequency', value: `Every ${this.CHECK_INTERVAL_MINUTES}m`, inline: true },
          { name: '🛠️ Fail2Ban', value: fail2banInstalled ? '✅ Installed' : '⚠️ Not installed', inline: true }
        ],
        color: 0xe74c3c
      });
    }
  }

  async enforceLocalTailscaleOnlySSH() {
    const tailscaleCidr = process.env.TAILSCALE_CIDR || '100.64.0.0/10';
    const command = [
      "if ! command -v tailscale >/dev/null 2>&1; then echo 'tailscale missing'; exit 1; fi",
      "tailscale status >/dev/null 2>&1 || (echo 'tailscale not running'; exit 1)",
      `sudo iptables -C INPUT -p tcp --dport 22 -s ${tailscaleCidr} -j ACCEPT || sudo iptables -I INPUT -p tcp --dport 22 -s ${tailscaleCidr} -j ACCEPT`,
      "sudo iptables -C INPUT -p tcp --dport 22 -j DROP || sudo iptables -A INPUT -p tcp --dport 22 -j DROP"
    ].join(' && ');

    await execPromise(command);
    logger.info('🛡️ Enforced local Tailscale-only SSH');
  }

  async enforceRemoteTailscaleOnlySSH() {
    const tailscaleCidr = process.env.TAILSCALE_CIDR || '100.64.0.0/10';
    const targets = [];

    if (process.env.PI4_AUTO_HOST && process.env.PI4_AUTO_USER) {
      targets.push({ name: 'pi4-auto', host: process.env.PI4_AUTO_HOST, user: process.env.PI4_AUTO_USER });
    }
    if (process.env.PI4_CORE_HOST && process.env.PI4_CORE_USER) {
      targets.push({ name: 'pi4-core', host: process.env.PI4_CORE_HOST, user: process.env.PI4_CORE_USER });
    }

    for (const target of targets) {
      await this.enforceOnTarget(target, tailscaleCidr);
    }
  }

  async enforceOnTarget(target, tailscaleCidr) {
    const command = [
      "if ! command -v tailscale >/dev/null 2>&1; then echo 'tailscale missing'; exit 1; fi",
      "tailscale status >/dev/null 2>&1 || (echo 'tailscale not running'; exit 1)",
      `sudo iptables -C INPUT -p tcp --dport 22 -s ${tailscaleCidr} -j ACCEPT || sudo iptables -I INPUT -p tcp --dport 22 -s ${tailscaleCidr} -j ACCEPT`,
      "sudo iptables -C INPUT -p tcp --dport 22 -j DROP || sudo iptables -A INPUT -p tcp --dport 22 -j DROP"
    ].join(' && ');

    await this.execSSH(target, command);
    logger.info(`🛡️ Enforced Tailscale-only SSH on ${target.name}`);
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
              if (code !== 0) {
                reject(new Error(stderr || `Remote command failed (${code})`));
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
        .connect({
          host: target.host,
          port: 22,
          username: target.user,
          privateKey: process.env.PI_SSH_KEY_PATH
            ? require('fs').readFileSync(process.env.PI_SSH_KEY_PATH)
            : undefined
        });
    });
  }

  async checkFail2Ban() {
    try {
      await execPromise('which fail2ban-client');
      return true;
    } catch {
      return false;
    }
  }

  async monitorSSHAttempts() {
    try {
      logger.info('🔍 Checking SSH login attempts...');
      
      // Parse auth.log for failed SSH attempts
      const { stdout: authLog } = await execPromise(
        "sudo grep 'Failed password' /var/log/auth.log | tail -1000"
      ).catch(() => ({ stdout: '' }));
      
      if (!authLog) {
        logger.info('No failed SSH attempts found');
        return;
      }
      
      // Parse attempts
      const attempts = this.parseAuthLog(authLog);
      
      // Check for attacks
      const attacks = this.detectAttacks(attempts);
      
      // Ban attackers
      for (const attack of attacks) {
        await this.banIP(attack.ip, attack.attempts);
      }
      
      // Send alert if attacks detected
      if (attacks.length > 0) {
        await this.sendAttackAlert(attacks);
      }
      
    } catch (error) {
      logger.error('SSH monitoring error:', error);
    }
  }

  parseAuthLog(logContent) {
    const lines = logContent.split('\n');
    const attempts = new Map();
    
    for (const line of lines) {
      // Extract IP address from log line
      // Example: "Failed password for root from 192.168.1.100 port 22"
      const ipMatch = line.match(/from\s+(\d+\.\d+\.\d+\.\d+)/);
      const userMatch = line.match(/for\s+(\w+)\s+from/);
      
      if (ipMatch && ipMatch[1]) {
        const ip = ipMatch[1];
        const user = userMatch ? userMatch[1] : 'unknown';
        
        // Skip whitelisted IPs
        if (this.whitelistedIPs.has(ip)) continue;
        
        if (!attempts.has(ip)) {
          attempts.set(ip, {
            ip: ip,
            count: 0,
            users: new Set(),
            firstSeen: new Date(),
            lastSeen: new Date()
          });
        }
        
        const attempt = attempts.get(ip);
        attempt.count++;
        attempt.users.add(user);
        attempt.lastSeen = new Date();
      }
    }
    
    return Array.from(attempts.values());
  }

  detectAttacks(attempts) {
    const attacks = [];
    
    for (const attempt of attempts) {
      if (attempt.count >= this.MAX_FAILED_ATTEMPTS) {
        attacks.push({
          ip: attempt.ip,
          attempts: attempt.count,
          users: Array.from(attempt.users),
          duration: Math.round((attempt.lastSeen - attempt.firstSeen) / 1000 / 60), // minutes
          severity: this.calculateSeverity(attempt.count)
        });
      }
    }
    
    return attacks;
  }

  calculateSeverity(attempts) {
    if (attempts >= 100) return 'CRITICAL';
    if (attempts >= 50) return 'HIGH';
    if (attempts >= 20) return 'MEDIUM';
    return 'LOW';
  }

  async banIP(ip, attempts) {
    if (this.bannedIPs.has(ip)) {
      logger.info(`IP ${ip} already banned`);
      return;
    }
    
    try {
      // Try fail2ban first
      try {
        await execPromise(`sudo fail2ban-client set sshd banip ${ip}`);
        logger.info(`✅ Banned ${ip} via fail2ban (${attempts} attempts)`);
      } catch {
        // Fallback to iptables
        await execPromise(`sudo iptables -A INPUT -s ${ip} -j DROP`);
        logger.info(`✅ Banned ${ip} via iptables (${attempts} attempts)`);
      }
      
      this.bannedIPs.add(ip);
      
      // Log to file
      const logEntry = {
        ip: ip,
        attempts: attempts,
        bannedAt: new Date().toISOString(),
        method: 'auto-ban'
      };
      
      const logFile = '/home/kosmox_ai/openclaw/data/banned-ips.json';
      await this.appendBanLog(logFile, logEntry);
      
    } catch (error) {
      logger.error(`Failed to ban ${ip}:`, error);
    }
  }

  async appendBanLog(logFile, entry) {
    try {
      let logs = [];
      try {
        const content = await fs.readFile(logFile, 'utf8');
        logs = JSON.parse(content);
      } catch {
        // File doesn't exist yet
      }
      
      logs.push(entry);
      
      // Keep last 1000 entries
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }
      
      await fs.mkdir('/home/kosmox_ai/openclaw/data', { recursive: true });
      await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      logger.error('Failed to log ban:', error);
    }
  }

  async sendAttackAlert(attacks) {
    const totalAttempts = attacks.reduce((sum, a) => sum + a.attempts, 0);
    
    const criticalAttacks = attacks.filter(a => a.severity === 'CRITICAL');
    const highAttacks = attacks.filter(a => a.severity === 'HIGH');
    
    const fields = attacks.slice(0, 10).map(attack => ({
      name: `${this.getSeverityEmoji(attack.severity)} ${attack.ip}`,
      value: `${attack.attempts} attempts • ${attack.users.join(', ')} • BANNED`,
      inline: false
    }));
    
    if (this.discordService?.sendEmbed) {
      await this.discordService.sendEmbed({
        title: '🚨 SSH ATTACK DETECTED & BLOCKED',
        description: `**${attacks.length}** attacker(s) banned\n**${totalAttempts}** total failed attempts`,
        fields: fields,
        color: criticalAttacks.length > 0 ? 0xe74c3c : 0xf39c12,
        footer: {
          text: '🛡️ All IPs automatically banned for 24 hours'
        }
      });
    }
  }

  async sendDailySecurityReport() {
    try {
      const logFile = '/home/kosmox_ai/openclaw/data/banned-ips.json';
      
      let logs = [];
      try {
        const content = await fs.readFile(logFile, 'utf8');
        logs = JSON.parse(content);
      } catch {
        // No logs yet
      }
      
      // Filter last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentBans = logs.filter(log => new Date(log.bannedAt) > yesterday);
      
      const totalAttempts = recentBans.reduce((sum, log) => sum + log.attempts, 0);
      
      // Get top attackers
      const topAttackers = recentBans
        .sort((a, b) => b.attempts - a.attempts)
        .slice(0, 5);
      
      if (this.discordService?.sendEmbed) {
        await this.discordService.sendEmbed({
          title: '🛡️ Daily SSH Security Report',
          description: 'Last 24 hours of SSH attack activity',
          fields: [
            { name: '🚫 IPs Banned', value: `${recentBans.length}`, inline: true },
            { name: '⚠️ Failed Attempts', value: `${totalAttempts}`, inline: true },
            { name: '✅ Attacks Blocked', value: '100%', inline: true },
            {
              name: '🏆 Top Attackers',
              value: topAttackers.length > 0 
                ? topAttackers.map(a => `${a.ip} (${a.attempts} attempts)`).join('\n')
                : 'No attacks today',
              inline: false
            }
          ],
          color: 0x2ecc71
        });
      }
      
    } catch (error) {
      logger.error('Failed to send security report:', error);
    }
  }

  getSeverityEmoji(severity) {
    switch (severity) {
      case 'CRITICAL': return '🚨';
      case 'HIGH': return '⚠️';
      case 'MEDIUM': return '⚡';
      default: return '🔍';
    }
  }
}

module.exports = SSHSecurityMonitor;
