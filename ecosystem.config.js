module.exports = {
  apps: [{
    name: 'openclaw-master',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    min_uptime: '30s',
    max_restarts: 5,
    restart_delay: 30000,
    exp_backoff_restart_delay: 60000,
    env_file: '.env',
    env: { NODE_ENV: 'production' }
  }]
};
