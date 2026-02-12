const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.adminEmail = process.env.ADMIN_EMAIL || 'admin@shieldtechsolutions.com';
    
    // Configure email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendDailySummary(subject, text, html) {
    if (!this.transporter) return;
    const to = this.adminEmail;
    await this.transporter.sendMail({
      from: this.adminEmail,
      to,
      subject,
      text,
      html
    });
    logger.info('📧 Daily summary email sent');
  }

  async sendApprovalRequest(task, debugResult) {
    const subject = `🚀 OpenClaw: Feature Ready for Approval - ${task.description}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat { text-align: center; padding: 15px; background: white; 
            border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-value { font-size: 32px; font-weight: bold; color: #667eea; }
    .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
    .files { background: white; padding: 15px; border-radius: 8px; 
             margin: 20px 0; border-left: 4px solid #667eea; }
    .file-item { padding: 5px 0; font-family: monospace; color: #555; }
    .fixes { background: #fff3cd; padding: 15px; border-radius: 8px; 
             margin: 20px 0; border-left: 4px solid #ffc107; }
    .fix-item { padding: 8px 0; border-bottom: 1px solid #eee; }
    .button { display: inline-block; padding: 15px 30px; margin: 10px 5px;
              border-radius: 8px; text-decoration: none; font-weight: bold;
              font-size: 16px; }
    .approve { background: #28a745; color: white; }
    .reject { background: #dc3545; color: white; }
    .rebuild { background: #ffc107; color: #333; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 OpenClaw Build Complete</h1>
      <p style="margin: 0; font-size: 18px;">${task.description}</p>
    </div>
    
    <div class="content">
      <h2>✅ Feature Successfully Built & Tested</h2>
      <p>Your feature has been generated, tested, and debugged automatically. 
         All tests are passing and it's ready for deployment.</p>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${debugResult.files.length}</div>
          <div class="stat-label">Files Generated</div>
        </div>
        <div class="stat">
          <div class="stat-value">${debugResult.fixes.length}</div>
          <div class="stat-label">Auto-Fixes Applied</div>
        </div>
        <div class="stat">
          <div class="stat-value">${debugResult.attempt}</div>
          <div class="stat-label">Test Attempts</div>
        </div>
      </div>
      
      <div class="files">
        <h3>📁 Generated Files:</h3>
        ${debugResult.files.map(f => `
          <div class="file-item">📄 ${f.path}</div>
        `).join('')}
      </div>
      
      ${debugResult.fixes.length > 0 ? `
        <div class="fixes">
          <h3>🔧 Auto-Fixes Applied:</h3>
          ${debugResult.fixes.map(fix => `
            <div class="fix-item">
              <strong>Attempt ${fix.attempt}:</strong> ${fix.fixDescription}
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <h3>🚀 Ready to Deploy</h3>
      <p>This feature has been tested on Pi4-Core and is ready for production deployment.
         Click one of the buttons below to proceed:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${this.getApprovalUrl(task.id, 'approve')}" class="button approve">
          ✅ Approve & Deploy to Production
        </a>
        <a href="${this.getApprovalUrl(task.id, 'reject')}" class="button reject">
          ❌ Reject Build
        </a>
        <a href="${this.getApprovalUrl(task.id, 'rebuild')}" class="button rebuild">
          🔄 Rebuild from Scratch
        </a>
      </div>
      
      <p style="font-size: 12px; color: #666; margin-top: 30px;">
        <strong>Note:</strong> You can also approve via Discord by reacting to the message 
        in your OpenClaw channel.
      </p>
    </div>
    
    <div class="footer">
      <p>OpenClaw Autonomous Build System</p>
      <p>ShieldTech Security Solutions</p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"OpenClaw" <${process.env.SMTP_USER}>`,
        to: this.adminEmail,
        subject,
        html
      });
      
      logger.info('Approval email sent', { to: this.adminEmail, taskId: task.id });
      return true;
      
    } catch (error) {
      logger.error('Failed to send approval email', { error: error.message });
      return false;
    }
  }

  getApprovalUrl(taskId, action) {
    const baseUrl = process.env.OPENCLAW_URL || 'http://localhost:3001';
    return `${baseUrl}/api/approve/${taskId}/${action}`;
  }

  async sendDeploymentComplete(task, success, message) {
    const subject = success 
      ? `✅ Deployed: ${task.description}`
      : `❌ Deployment Failed: ${task.description}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${success ? '#28a745' : '#dc3545'}; 
              color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .message { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${success ? '✅' : '❌'} Deployment ${success ? 'Complete' : 'Failed'}</h1>
      <p style="margin: 0; font-size: 18px;">${task.description}</p>
    </div>
    <div class="content">
      <div class="message">
        <p>${message}</p>
      </div>
      <p style="font-size: 12px; color: #666;">
        OpenClaw Autonomous Build System<br>
        ShieldTech Security Solutions
      </p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"OpenClaw" <${process.env.SMTP_USER}>`,
        to: this.adminEmail,
        subject,
        html
      });
      
      logger.info('Deployment notification sent', { to: this.adminEmail, success });
      
    } catch (error) {
      logger.error('Failed to send deployment email', { error: error.message });
    }
  }
}

module.exports = EmailService;
