const { exec } = require('child_process');

/**
 * Supported deployment targets and their shell commands.
 * Extend this map to add new deployment targets.
 */
const DEPLOY_TARGETS = {
  production: 'echo "Deploying to production..."',
  staging: 'echo "Deploying to staging..."',
  preview: 'echo "Deploying preview build..."',
};

class Deployer {
  constructor() {
    this.activeTasks = new Map();
  }

  getAvailableTargets() {
    return Object.keys(DEPLOY_TARGETS);
  }

  /**
   * Parse a deployment prompt string into a structured command.
   * Accepts formats like:
   *   "deploy production"
   *   "deploy staging --branch main"
   *   "status"
   *   "list"
   */
  parsePrompt(prompt) {
    const parts = prompt.trim().split(/\s+/);
    const action = parts[0]?.toLowerCase();

    if (action === 'status') {
      return { action: 'status' };
    }
    if (action === 'list') {
      return { action: 'list' };
    }
    if (action === 'restart') {
      return { action: 'restart' };
    }

    const target = parts[0]?.toLowerCase();
    const flags = parts.slice(1);
    return { action: 'deploy', target, flags };
  }

  /**
   * Execute a deployment for the given target.
   * Returns a promise that resolves with { success, output } or rejects on error.
   */
  execute(target) {
    const command = DEPLOY_TARGETS[target];
    if (!command) {
      return Promise.resolve({
        success: false,
        output: `Unknown target "${target}". Available: ${this.getAvailableTargets().join(', ')}`,
      });
    }

    const taskId = `${target}-${Date.now()}`;
    this.activeTasks.set(taskId, { target, startedAt: new Date() });

    return new Promise((resolve) => {
      exec(command, { timeout: 300_000 }, (error, stdout, stderr) => {
        this.activeTasks.delete(taskId);

        if (error) {
          resolve({
            success: false,
            target,
            output: stderr || error.message,
          });
        } else {
          resolve({
            success: true,
            target,
            output: stdout.trim(),
          });
        }
      });
    });
  }

  getActiveTasksSummary() {
    if (this.activeTasks.size === 0) {
      return 'No active deployments.';
    }
    const lines = [];
    for (const [id, task] of this.activeTasks) {
      const elapsed = Math.round((Date.now() - task.startedAt.getTime()) / 1000);
      lines.push(`- **${task.target}** (${id}) — running for ${elapsed}s`);
    }
    return lines.join('\n');
  }
}

module.exports = Deployer;
