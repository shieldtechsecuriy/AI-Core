const { EmbedBuilder } = require('discord.js');

class Notifier {
  constructor(client, channelId) {
    this.client = client;
    this.channelId = channelId;
  }

  async getChannel() {
    try {
      return await this.client.channels.fetch(this.channelId);
    } catch (err) {
      console.error(`Failed to fetch channel ${this.channelId}:`, err.message);
      return null;
    }
  }

  /**
   * Send a deployment-started notification.
   */
  async notifyDeployStarted(target, requestedBy) {
    const channel = await this.getChannel();
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('Deployment Started')
      .setColor(0xf0ad4e)
      .addFields(
        { name: 'Target', value: target, inline: true },
        { name: 'Requested By', value: requestedBy, inline: true },
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  /**
   * Send a task-complete notification with the result.
   */
  async notifyTaskComplete(target, result, requestedBy) {
    const channel = await this.getChannel();
    if (!channel) return;

    const success = result.success;
    const embed = new EmbedBuilder()
      .setTitle(success ? 'Deployment Complete' : 'Deployment Failed')
      .setColor(success ? 0x5cb85c : 0xd9534f)
      .addFields(
        { name: 'Target', value: target, inline: true },
        { name: 'Status', value: success ? 'Success' : 'Failed', inline: true },
        { name: 'Requested By', value: requestedBy, inline: true },
        { name: 'Output', value: `\`\`\`\n${result.output.slice(0, 1000)}\n\`\`\`` },
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  /**
   * Send a generic info message to the notification channel.
   */
  async sendInfo(message) {
    const channel = await this.getChannel();
    if (!channel) return;
    await channel.send(message);
  }
}

module.exports = Notifier;
