const { Client } = require('ssh2');

class RoadmapAutoSkipService {
  constructor() {
    this.targets = {
      pi4Core: {
        host: process.env.PI4_CORE_HOST,
        user: process.env.PI4_CORE_USER,
        keyPath: process.env.PI_SSH_KEY_PATH,
        base: '/home/shieldtech'
      }
    };
  }

  async shouldSkip(taskName) {
    const t = taskName.toLowerCase();

    if (t.includes('postgresql')) {
      return this.checkCmd('pi4Core', 'psql --version');
    }
    if (t.includes('prisma')) {
      return this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/prisma');
    }
    if (t.includes('next.js') || t.includes('nextjs')) {
      return this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/package.json');
    }
    if (t.includes('monitoring service') || t.includes('systemd service')) {
      return this.checkCmd('pi4Core', 'systemctl status shieldtech-monitor');
    }

    return false;
  }

  checkPath(target, path) {
    return this.exec(target, `test -e ${path} && echo "yes" || echo "no"`).then(r => r.trim() === 'yes');
  }

  checkCmd(target, cmd) {
    return this.exec(target, cmd).then(() => true).catch(() => false);
  }

  exec(targetName, command) {
    const target = this.targets[targetName];
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) { conn.end(); return reject(err); }
          let out = '';
          stream.on('close', (code) => {
            conn.end();
            if (code === 0) resolve(out);
            else reject(new Error(out));
          });
          stream.on('data', d => out += d.toString());
          stream.stderr.on('data', d => out += d.toString());
        });
      }).on('error', reject).connect({
        host: target.host,
        username: target.user,
        privateKey: require('fs').readFileSync(target.keyPath)
      });
    });
  }
}

module.exports = RoadmapAutoSkipService;
