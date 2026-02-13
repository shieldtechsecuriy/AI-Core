const { Client } = require('ssh2');
const fs = require('fs');
const logger = require('../utils/logger');

const SSH_READY_TIMEOUT_MS = parseInt(process.env.SSH_READY_TIMEOUT_MS || '30000', 10);

class RoadmapAutoSkipService {
  constructor(databaseService = null) {
    this.db = databaseService;
    this.targets = {
      pi4Core: {
        host: process.env.PI4_CORE_HOST,
        user: process.env.PI4_CORE_USER,
        keyPath: process.env.PI_SSH_KEY_PATH,
        base: '/home/shieldtech'
      }
    };

    // Comprehensive check map: keyword in feature name -> check function
    // Covers every phase of the ShieldTech roadmap
    this.checkMap = [
      // Phase 1 - Foundation
      { keywords: ['postgresql', 'postgres', 'database setup'], check: () => this.checkCmd('pi4Core', 'psql --version') },
      { keywords: ['prisma'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/prisma') },
      { keywords: ['jwt', 'authentication', 'auth endpoints'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/middleware/auth.js') },
      { keywords: ['express', 'backend api', 'node.js/express'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/package.json') },
      { keywords: ['next.js', 'nextjs', 'frontend foundation'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/package.json') },
      { keywords: ['tailwind', 'shadcn'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/tailwind.config.js') },
      { keywords: ['nextauth', 'role-based routing'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/api/auth') },
      { keywords: ['device monitoring', 'icmp ping', 'ping loop', 'monitoring service'], check: () => this.checkCmd('pi4Core', 'systemctl is-active shieldtech-monitor') },
      { keywords: ['systemd service'], check: () => this.checkCmd('pi4Core', 'systemctl is-active shieldtech-monitor') },
      { keywords: ['asset management', 'device list', 'device detail', 'device filtering'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/devices') },
      { keywords: ['floor plan'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/floorplan') },
      { keywords: ['real-time status'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/status-websocket.js') },

      // Phase 1 - Week 2
      { keywords: ['customer portal', 'customer dashboard'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/customer') },
      { keywords: ['support ticket', 'ticket system'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/routes/tickets.js') },
      { keywords: ['invoice viewer', 'invoice'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/invoices') },
      { keywords: ['health score widget'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/components/HealthScore') },
      { keywords: ['technician', 'mobile-optimized', 'mobile interface'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/technician') },
      { keywords: ['time clock', 'clock in'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/routes/timeclock.js') },
      { keywords: ['photo upload'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/routes/uploads.js') },
      { keywords: ['crm pipeline', 'lead database', 'pipeline visualization'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/crm') },
      { keywords: ['lead scoring', 'lead scoring ai'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/lead-scoring.js') },
      { keywords: ['email generation'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/email-generator.js') },
      { keywords: ['proposal management'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/routes/proposals.js') },
      { keywords: ['gps', 'gps dashboard', 'location tracking', 'route history'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/gps') },
      { keywords: ['time entry approval'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/routes/time-approval.js') },
      { keywords: ['alarm', 'alarm panel', 'zone display', 'test mode controls', 'event log viewer'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/alarms') },

      // Phase 2 - Deployment & Polish
      { keywords: ['vercel', 'vercel deployment', 'custom domain', 'ssl'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/vercel.json') },

      // Phase 3 - Hardware Upgrade
      { keywords: ['hailo', 'ai hat', 'dual ai hat'], check: () => this.checkCmd('pi4Core', 'hailortcli fw-control identify 2>/dev/null') },
      { keywords: ['ollama'], check: () => this.checkCmd('pi4Core', 'ollama --version') },
      { keywords: ['local llm', 'migrate ai'], check: () => this.checkCmd('pi4Core', 'ollama list 2>/dev/null | grep -q .') },
      { keywords: ['video playback'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/video') },
      { keywords: ['predictive maintenance'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/predictive-maintenance.js') },
      { keywords: ['analytics dashboard', 'advanced analytics'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/analytics') },

      // Phase 4 - Platform Hardening
      { keywords: ['audit log', 'change history'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/middleware/audit-log.js') },
      { keywords: ['soft delete', 'restore workflow'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/middleware/soft-delete.js') },
      { keywords: ['scheduled db backup', 'snapshot restore'], check: () => this.checkCmd('pi4Core', 'systemctl is-active shieldtech-backup') },
      { keywords: ['safety gate', 'dry run'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/safety-gates.js') },
      { keywords: ['rollback'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/rollback.js') },
      { keywords: ['qa checklist', 'automated qa'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/qa-checklist.js') },

      // Phase 5 - Revenue & Ops
      { keywords: ['auto follow-up', 'follow-up engine'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/auto-followup.js') },
      { keywords: ['customer health score', 'health score model'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/customer-health.js') },
      { keywords: ['smart alerts', 'threshold-based'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/smart-alerts.js') },
      { keywords: ['activity feed', 'unified activity'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/activity-feed') },
      { keywords: ['rbac', 'role-based access control'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/middleware/rbac.js') },

      // Phase 6 - Scale
      { keywords: ['multi-tenant'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/middleware/tenant.js') },
      { keywords: ['index health', 'query analyzer'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/index-health.js') },
      { keywords: ['upsell', 'upsell recommendation'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/upsell-engine.js') },
      { keywords: ['ai operator', 'incident remediation'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/ai-operator.js') },
      { keywords: ['shadow sales', 'quotes'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-api/src/services/shadow-sales.js') },
      { keywords: ['executive dashboard'], check: () => this.checkPath('pi4Core', '/home/shieldtech/shieldtech-portal/src/app/executive') },
    ];
  }

  /**
   * Check if a roadmap item should be skipped.
   * Priority order:
   *   1. Database status (already marked completed)
   *   2. Keyword-based SSH checks (file/service exists on target)
   */
  async shouldSkip(taskName) {
    // 1. Check database first — cheapest check
    if (this.db) {
      try {
        const rows = await this.db.all(
          "SELECT status FROM roadmap_features WHERE feature_name = ? AND status = 'completed'",
          [taskName]
        );
        if (rows.length > 0) {
          logger.info(`⏭️ Auto-skip (DB): ${taskName} already completed`);
          return true;
        }
      } catch (err) {
        logger.warn('Auto-skip DB check failed:', err.message);
      }
    }

    // 2. Keyword-based SSH checks
    const t = taskName.toLowerCase();
    for (const entry of this.checkMap) {
      const matched = entry.keywords.some(kw => t.includes(kw));
      if (matched) {
        try {
          const exists = await entry.check();
          if (exists) {
            logger.info(`⏭️ Auto-skip (SSH): ${taskName} already installed`);
            return true;
          }
        } catch (err) {
          // SSH unreachable or check failed — don't skip, let the builder decide
          logger.debug(`Auto-skip check failed for ${taskName}: ${err.message}`);
        }
        return false;
      }
    }

    return false;
  }

  checkPath(target, filePath) {
    return this.exec(target, `test -e ${filePath} && echo "yes" || echo "no"`)
      .then(r => r.trim() === 'yes');
  }

  checkCmd(target, cmd) {
    return this.exec(target, cmd).then(() => true).catch(() => false);
  }

  exec(targetName, command) {
    const target = this.targets[targetName];
    if (!target || !target.host || !target.user) {
      return Promise.reject(new Error(`Target ${targetName} not configured`));
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('SSH check timed out'));
      }, SSH_READY_TIMEOUT_MS + 5000);

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) { clearTimeout(timeout); conn.end(); return reject(err); }
          let out = '';
          stream.on('close', (code) => {
            clearTimeout(timeout);
            conn.end();
            if (code === 0) resolve(out);
            else reject(new Error(out || `Exit code ${code}`));
          });
          stream.on('data', d => out += d.toString());
          stream.stderr.on('data', d => out += d.toString());
        });
      }).on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      }).connect({
        host: target.host,
        username: target.user,
        readyTimeout: SSH_READY_TIMEOUT_MS,
        privateKey: target.keyPath ? fs.readFileSync(target.keyPath) : undefined
      });
    });
  }
}

module.exports = RoadmapAutoSkipService;
