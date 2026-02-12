const EmailService = require('./email.service');
const logger = require('../utils/logger');

class ApprovalService {
  constructor() {
    this.emailService = new EmailService();
    this.pendingApprovals = new Map();
  }

  async requestApproval(message, task, testResults) {
    const embed = {
      title: '✅ Feature Ready for Approval',
      description: task.description,
      color: 0x00ff00,
      fields: [
        { 
          name: '📁 Files Generated', 
          value: `${testResults.files.length} files`, 
          inline: true 
        },
        { 
          name: '🔄 Auto-fixes Applied', 
          value: `${testResults.fixes.length}`, 
          inline: true 
        },
        { 
          name: '🎯 Attempts', 
          value: `${testResults.attempt}/${5}`, 
          inline: true 
        },
        {
          name: '📝 Files',
          value: testResults.files.map(f => `\`${f.path}\``).join('\n').substring(0, 1000),
          inline: false
        }
      ],
      timestamp: new Date()
    };

    if (testResults.fixes.length > 0) {
      embed.fields.push({
        name: '🔧 Fixes Applied',
        value: testResults.fixes.map(f => 
          `**Attempt ${f.attempt}:** ${f.fixDescription}`
        ).join('\n').substring(0, 1000),
        inline: false
      });
    }

    const approvalMessage = await message.channel.send({ embeds: [embed] });
    
    // Add reaction buttons
    await approvalMessage.react('✅'); // Approve
    await approvalMessage.react('❌'); // Reject
    await approvalMessage.react('🔄'); // Rebuild

    logger.info('Approval requested', { taskId: task.id, messageId: approvalMessage.id });

    // Store for reaction handler
    this.pendingApprovals.set(approvalMessage.id, {
      taskId: task.id,
      files: testResults.files,
      deploymentSteps: testResults.deploymentSteps,
      channelId: message.channel.id
    });

    return approvalMessage.id;
  }

  async handleReaction(messageId, emoji, userId) {
    const approval = this.pendingApprovals.get(messageId);
    if (!approval) return null;

    const emojiName = emoji.name || emoji;

    logger.info('Approval reaction received', { 
      messageId, 
      emoji: emojiName, 
      userId,
      taskId: approval.taskId 
    });

    let action = null;

    switch (emojiName) {
      case '✅':
        action = 'approved';
        break;
      case '❌':
        action = 'rejected';
        break;
      case '🔄':
        action = 'rebuild';
        break;
      default:
        return null;
    }

    // Remove from pending
    this.pendingApprovals.delete(messageId);

    return {
      action,
      taskId: approval.taskId,
      files: approval.files,
      deploymentSteps: approval.deploymentSteps,
      channelId: approval.channelId
    };
  }

  getPendingApproval(messageId) {
    return this.pendingApprovals.get(messageId);
  }

  clearApproval(messageId) {
    this.pendingApprovals.delete(messageId);
  }
}

module.exports = ApprovalService;
