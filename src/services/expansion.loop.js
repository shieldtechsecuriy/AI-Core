const DiscoveryService = require('./discovery.service');
const EvaluationService = require('./evaluation.service');
const SignupService = require('./signup.service');
const IntegrationBuilder = require('./integration.builder');
const MultiDeployService = require('./multi-deploy.service');

class ExpansionLoop {
  constructor() {
    this.discoveryService = new DiscoveryService();
    this.evaluationService = new EvaluationService();
    this.signupService = new SignupService();
    this.integrationBuilder = new IntegrationBuilder();
    this.multiDeployService = new MultiDeployService();
    this.isRunning = false;
    this.cycleInterval = 24 * 60 * 60 * 1000;
  }

  async start() {
    this.isRunning = true;
    console.log('♾️  Self-Expansion Loop ACTIVE');
    console.log(`   Runs every ${this.cycleInterval / (60 * 60 * 1000)} hours\n`);
    
    while (this.isRunning) {
      try {
        await this.expansionCycle();
      } catch (error) {
        console.error('❌ Expansion cycle error:', error);
      }
      
      if (this.isRunning) {
        console.log(`💤 Next cycle in ${this.cycleInterval / (60 * 60 * 1000)} hours\n`);
        await this.sleep(this.cycleInterval);
      }
    }
  }

  stop() {
    this.isRunning = false;
    console.log('⏹️  Expansion loop stopped');
  }

  async expansionCycle() {
    console.log('\n🔄 ═══════ EXPANSION CYCLE ═══════');
    console.log(`   ${new Date().toISOString()}\n`);
    
    const discoveries = await this.discoveryService.discoverNewTools();
    console.log(`\n📊 Found ${discoveries.length} tools`);
    
    if (discoveries.length === 0) return;
    
    const topCandidates = discoveries.slice(0, 5);
    
    for (const tool of topCandidates) {
      console.log(`\n━━━ ${tool.name} ━━━`);
      
      try {
        const evaluation = await this.evaluationService.evaluateTool(tool);
        
        console.log(`   ROI: ${evaluation.roi}/10`);
        console.log(`   Recommend: ${evaluation.recommend ? '✅' : '❌'}`);
        
        if (evaluation.recommend) {
          const signup = await this.signupService.signUpForTool(tool);
          
          if (!signup.requiresManualSignup) {
            const integration = await this.integrationBuilder.buildIntegration(tool, signup.credentials);
            
            if (integration.success) {
              const fileContent = await require('fs').promises.readFile(integration.filePath, 'utf8');
              const files = [{ path: integration.filePath, content: fileContent }];
              
              console.log('🌍 Deploying to all devices...');
              await this.multiDeployService.deployToAllTargets(files, ['pi4-core', 'pi4-auto']);
            }
          }
          
          await this.sleep(60 * 1000);
        }
        
      } catch (error) {
        console.error(`   ❌ ${error.message}`);
      }
    }
    
    console.log('\n🏁 Cycle complete\n');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ExpansionLoop;
