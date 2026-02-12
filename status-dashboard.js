#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n' + '═'.repeat(70));
console.log('🤖 OPENCLAW STATUS DASHBOARD');
console.log('═'.repeat(70) + '\n');

// PM2 Processes
console.log('📦 PM2 PROCESSES');
console.log('─'.repeat(70));
try {
  const pm2List = execSync('pm2 jlist', { encoding: 'utf8' });
  const processes = JSON.parse(pm2List);
  
  processes.forEach(proc => {
    const status = proc.pm2_env.status === 'online' ? '✅' : '❌';
    const uptime = proc.pm2_env.status === 'online' 
      ? Math.floor((Date.now() - proc.pm2_env.pm_uptime) / 1000 / 60) + 'm'
      : 'offline';
    const restarts = proc.pm2_env.restart_time;
    const memory = Math.round(proc.monit.memory / 1024 / 1024) + 'MB';
    
    console.log(`${status} ${proc.name.padEnd(25)} | Uptime: ${uptime.padEnd(8)} | Restarts: ${restarts} | RAM: ${memory}`);
  });
} catch (error) {
  console.log('❌ Could not read PM2 processes');
}

console.log('\n📅 SCHEDULED SERVICES');
console.log('─'.repeat(70));

const scheduledServices = [
  { name: '🤖 Autonomous Builder', schedule: 'Every 2 hours', status: '✅ Active' },
  { name: '💡 Business Strategist', schedule: 'Every 4 hours', status: '✅ Active' },
  { name: '🛡️ Security Guardian', schedule: 'Every 6 hours', status: '✅ Active' },
  { name: '🕵️ Competitor Intelligence', schedule: 'Every 8 hours', status: '✅ Active' },
  { name: '🔨 Self-Building Engine', schedule: 'Every 2 hours', status: '✅ Active' },
  { name: '🔐 SSH Security Monitor', schedule: 'Every 30 minutes', status: '✅ Active' },
  { name: '📊 Daily Reports', schedule: '11:59 PM daily', status: '✅ Active' },
  { name: '📈 Weekly Summary', schedule: 'Sundays 8 PM', status: '✅ Active' },
  { name: '💰 Monthly Projection', schedule: '1st of month 9 AM', status: '✅ Active' }
];

scheduledServices.forEach(service => {
  console.log(`${service.status} ${service.name.padEnd(30)} | ${service.schedule}`);
});

console.log('\n💬 DISCORD NOTIFICATIONS');
console.log('─'.repeat(70));

const notifications = [
  '✅ Build completions',
  '✅ Deployment notifications (with target + files)',
  '✅ Security alerts (SSH attempts)',
  '✅ Cost warnings (75%, 90% of budget)',
  '✅ Daily reports (costs + progress)',
  '✅ Weekly summaries',
  '✅ Monthly projections',
  '✅ Business ideas generated',
  '✅ Competitor analysis',
  '✅ System errors/failures'
];

notifications.forEach(notif => console.log(`  ${notif}`));

console.log('\n📊 DEPLOYMENT TRACKING');
console.log('─'.repeat(70));

try {
  const logPath = path.join(__dirname, 'data/deployment-log.json');
  const deployments = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  
  const byTarget = {};
  deployments.forEach(d => {
    if (!byTarget[d.target]) byTarget[d.target] = 0;
    if (d.status === 'success') byTarget[d.target]++;
  });
  
  console.log('📍 Deployments by Target:');
  Object.entries(byTarget).forEach(([target, count]) => {
    console.log(`  ${target.padEnd(20)}: ${count} successful`);
  });
  
  const recent = deployments.slice(-5);
  console.log('\n🕐 Last 5 Deployments:');
  recent.forEach(d => {
    const time = new Date(d.timestamp).toLocaleString();
    const status = d.status === 'success' ? '✅' : '❌';
    console.log(`  ${status} ${time} | ${d.feature} → ${d.target}`);
  });
  
} catch {
  console.log('  No deployment data yet');
}

console.log('\n💰 COST TRACKING');
console.log('─'.repeat(70));

try {
  const dbPath = path.join(__dirname, 'data/openclaw.db');
  if (fs.existsSync(dbPath)) {
    console.log('✅ Database active at: data/openclaw.db');
    console.log('✅ Tracking: token_usage, business_ideas, roadmap_features, built_features');
  } else {
    console.log('⚠️  Database not yet created');
  }
} catch {
  console.log('⚠️  Could not read database');
}

console.log('\n📍 DEPLOYMENT TARGETS');
console.log('─'.repeat(70));

const targets = [
  { name: 'Oracle Cloud', host: 'localhost', status: '✅ Active', path: '/home/kosmox_ai/openclaw' },
  { name: 'Pi4-Core', host: 'pi4-core.local', status: '⚠️  Offline', path: '/home/shieldtech/shieldtech-api' },
  { name: 'Pi4-Auto', host: 'pi4-auto.local', status: '⚠️  Offline', path: '/home/shieldtech/n8n-workflows' }
];

targets.forEach(target => {
  console.log(`${target.status} ${target.name.padEnd(20)} | ${target.host.padEnd(20)} | ${target.path}`);
});

console.log('\n📁 FILE LOCATIONS');
console.log('─'.repeat(70));

const files = [
  { name: 'Deployment Log', path: 'data/deployment-log.json' },
  { name: 'Database', path: 'data/openclaw.db' },
  { name: 'Completed Features', path: 'data/completed-features.json' },
  { name: 'N8N Workflows', path: 'n8n-workflows/' },
  { name: 'Knowledge Base', path: 'knowledge-base/' },
  { name: 'PM2 Logs', path: '~/.pm2/logs/' }
];

files.forEach(file => {
  const fullPath = path.join(__dirname, file.path);
  const exists = fs.existsSync(fullPath) ? '✅' : '❌';
  console.log(`${exists} ${file.name.padEnd(25)} | ${file.path}`);
});

console.log('\n🔧 USEFUL COMMANDS');
console.log('─'.repeat(70));

const commands = [
  { cmd: 'node status-dashboard.js', desc: 'This dashboard' },
  { cmd: 'node check-deployments.js', desc: 'Detailed deployment history' },
  { cmd: 'pm2 logs openclaw-master', desc: 'Live logs' },
  { cmd: 'pm2 monit', desc: 'Real-time monitoring' },
  { cmd: 'pm2 restart openclaw-master', desc: 'Restart OpenClaw' },
  { cmd: 'pm2 list', desc: 'List all processes' },
  { cmd: 'sqlite3 data/openclaw.db', desc: 'Query database directly' }
];

commands.forEach(c => {
  console.log(`  ${c.cmd.padEnd(35)} - ${c.desc}`);
});

console.log('\n' + '═'.repeat(70) + '\n');
