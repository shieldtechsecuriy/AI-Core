const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const Deployer = require('./deployer');
const Notifier = require('./notifier');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const deployer = new Deployer();
let notifier;

client.once('ready', () => {
  console.log(`Claw bot logged in as ${client.user.tag}`);
  notifier = new Notifier(client, config.discord.channelId);
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages and messages without the command prefix
  if (message.author.bot) return;
  if (!message.content.startsWith(config.deploy.commandPrefix)) return;

  const prompt = message.content.slice(config.deploy.commandPrefix.length).trim();

  if (!prompt) {
    await message.reply(
      `Usage: \`${config.deploy.commandPrefix} <target>\`\n` +
      `Available targets: ${deployer.getAvailableTargets().join(', ')}\n` +
      `Other commands: \`${config.deploy.commandPrefix} list\`, \`${config.deploy.commandPrefix} status\`, \`${config.deploy.commandPrefix} restart\``
    );
    return;
  }

  const parsed = deployer.parsePrompt(prompt);

  // Handle non-deploy actions
  if (parsed.action === 'list') {
    await message.reply(`Available targets: ${deployer.getAvailableTargets().join(', ')}`);
    return;
  }

  if (parsed.action === 'status') {
    await message.reply(deployer.getActiveTasksSummary());
    return;
  }

  if (parsed.action === 'restart') {
    await message.reply('Restarting OpenClaw bot...');
    if (config.deploy.notifyOnComplete && notifier) {
      await notifier.sendInfo('OpenClaw bot is restarting...');
    }
    process.exit(0);
  }

  // Execute deployment
  const target = parsed.target;
  const requestedBy = message.author.tag;

  await message.reply(`Starting deployment to **${target}**...`);

  if (config.deploy.notifyOnComplete && notifier) {
    await notifier.notifyDeployStarted(target, requestedBy);
  }

  const result = await deployer.execute(target);

  // Always reply in the originating channel
  if (result.success) {
    await message.reply(
      `Deployment to **${target}** completed successfully.\n\`\`\`\n${result.output}\n\`\`\``
    );
  } else {
    await message.reply(
      `Deployment to **${target}** failed.\n\`\`\`\n${result.output}\n\`\`\``
    );
  }

  // Send rich notification to the configured notification channel
  if (config.deploy.notifyOnComplete && notifier) {
    await notifier.notifyTaskComplete(target, result, requestedBy);
  }
});

// Validate config before starting
if (!config.discord.token) {
  console.error('DISCORD_BOT_TOKEN is not set. Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

if (!config.discord.channelId) {
  console.error('DISCORD_CHANNEL_ID is not set. Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

client.login(config.discord.token);
