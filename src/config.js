require('dotenv').config();

module.exports = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID,
  },
  deploy: {
    commandPrefix: process.env.DEPLOY_COMMAND_PREFIX || '!deploy',
    notifyOnComplete: process.env.NOTIFY_ON_COMPLETE !== 'false',
  },
};
