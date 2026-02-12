const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class N8NWorkflowGenerator {
  constructor() {
    this.workflowsDir = path.join(__dirname, '../../n8n-workflows');
  }

  async createWorkflowForIdea(idea) {
    const workflow = {
      name: `Business Idea: ${idea.title}`,
      nodes: [
        {
          parameters: {
            values: {
              string: [
                { name: 'title', value: idea.title },
                { name: 'description', value: idea.description },
                { name: 'status', value: 'pending' }
              ]
            }
          },
          name: 'Set Idea Data',
          type: 'n8n-nodes-base.set',
          position: [250, 300]
        },
        {
          parameters: {
            url: process.env.GOOGLE_SHEETS_WEBHOOK || 'https://hooks.zapier.com/hooks/catch/placeholder/',
            options: {}
          },
          name: 'Send to Google Sheets',
          type: 'n8n-nodes-base.httpRequest',
          position: [450, 300]
        }
      ],
      connections: {
        'Set Idea Data': {
          main: [[{ node: 'Send to Google Sheets', type: 'main', index: 0 }]]
        }
      }
    };
    
    const filename = `idea-${Date.now()}.json`;
    const filepath = path.join(this.workflowsDir, filename);
    
    await fs.mkdir(this.workflowsDir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(workflow, null, 2));
    
    logger.info(`✅ N8N workflow created: ${filename}`);
    return filename;
  }


  buildWorkflowForFeature(feature, options = {}) {
    const sheetId = options.sheetId || '';
    const webhookPath = options.webhookPath || `openclaw-${Date.now()}`;
    const sheetsCredentialId = options.sheetsCredentialId || process.env.N8N_GOOGLE_SHEETS_CREDENTIAL_ID || null;

    const nodes = [
      {
        parameters: {
          httpMethod: 'POST',
          path: webhookPath,
          responseMode: 'onReceived'
        },
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300]
      },
      {
        parameters: {
          values: {
            string: [
              { name: 'feature_name', value: feature.feature_name || feature.name },
              { name: 'phase', value: feature.phase || '' },
              { name: 'status', value: feature.status || 'pending' },
              { name: 'sheet_id', value: sheetId }
            ]
          }
        },
        name: 'Feature Data',
        type: 'n8n-nodes-base.set',
        position: [470, 300]
      }
    ];

    if (sheetId) {
      const sheetNode = {
        parameters: {
          operation: 'append',
          sheetId,
          range: 'Sheet1!A:D',
          options: {},
          dataToSend: 'autoMapInputData'
        },
        name: 'Append to Sheet',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4,
        position: [690, 300]
      };

      if (sheetsCredentialId) {
        sheetNode.credentials = {
          googleSheetsOAuth2Api: { id: sheetsCredentialId }
        };
      }
      nodes.push(sheetNode);
    }

    const connections = {
      Webhook: { main: [[{ node: 'Feature Data', type: 'main', index: 0 }]] }
    };

    if (sheetId) {
      connections['Feature Data'] = {
        main: [[{ node: 'Append to Sheet', type: 'main', index: 0 }]]
      };
    }

    return {
      name: `OpenClaw: ${feature.feature_name || feature.name}`,
      nodes,
      connections,
      settings: {},
      staticData: null
    };
  }

  async createWorkflowForFeature(feature) {
    const workflow = {
      name: `Roadmap Feature: ${feature.name}`,
      nodes: [
        {
          parameters: {
            values: {
              string: [
                { name: 'feature_name', value: feature.name },
                { name: 'phase', value: feature.phase },
                { name: 'status', value: feature.status }
              ]
            }
          },
          name: 'Feature Data',
          type: 'n8n-nodes-base.set',
          position: [250, 300]
        },
        {
          parameters: {
            url: process.env.FEATURE_TRACKING_WEBHOOK || 'https://hooks.zapier.com/hooks/catch/placeholder/',
            options: {}
          },
          name: 'Track Progress',
          type: 'n8n-nodes-base.httpRequest',
          position: [450, 300]
        }
      ],
      connections: {
        'Feature Data': {
          main: [[{ node: 'Track Progress', type: 'main', index: 0 }]]
        }
      }
    };
    
    const safeName = (feature.feature_name || feature.name || 'feature').toString();
      const filename = `feature-${safeName.replace(/\s+/g, '-').toLowerCase()}.json`;
    const filepath = path.join(this.workflowsDir, filename);
    
    await fs.mkdir(this.workflowsDir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(workflow, null, 2));
    
    logger.info(`✅ N8N workflow created: ${filename}`);
    return filename;
  }
}

module.exports = N8NWorkflowGenerator;
