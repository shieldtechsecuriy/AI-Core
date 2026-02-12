const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class RoadmapSeederService {
  constructor(databaseService) {
    this.db = databaseService;
    this.roadmapPath =
      process.env.ROADMAP_PATH ||
      path.join(__dirname, '../../knowledge-base/shieldtech/project_roadmap.md');
    this.seedKey = `roadmap:${this.roadmapPath}`;
  }

  async start() {
    try {
      const alreadySeeded = await this.db.hasSeededRoadmap(this.seedKey);
      if (alreadySeeded) {
        logger.info('🗺️ Roadmap already seeded, skipping');
        return;
      }

      const content = await fs.readFile(this.roadmapPath, 'utf8');
      const features = this.parseRoadmap(content);

      if (features.length === 0) {
        logger.warn('🗺️ No roadmap features parsed');
        return;
      }

      for (const feature of features) {
        await this.db.run(
          `INSERT OR IGNORE INTO roadmap_features 
           (feature_name, phase, priority, description, status) 
           VALUES (?, ?, ?, ?, 'pending')`,
          [
            feature.feature_name,
            feature.phase || '',
            feature.priority || 'medium',
            feature.description || ''
          ]
        );
      }

      await this.db.markRoadmapSeeded(this.seedKey);
      logger.info(`🗺️ Seeded ${features.length} roadmap features`);
    } catch (error) {
      logger.error('Roadmap seeding failed:', error);
    }
  }

  parseRoadmap(content) {
    const lines = content.split('\n');
    let currentPhase = '';
    let currentSection = '';
    let inCritical = false;
    const features = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('## ')) {
        currentPhase = line.replace(/^##\s+/, '');
        currentSection = '';
        inCritical = false;
        continue;
      }

      if (line.startsWith('### ')) {
        currentSection = line.replace(/^###\s+/, '');
        continue;
      }

      if (line.toLowerCase().includes('critical path') || line.toLowerCase().includes('must complete')) {
        inCritical = true;
        continue;
      }

      if (line.startsWith('- ')) {
        const featureName = line.replace(/^-+\s+/, '').trim();
        if (!featureName) continue;

        const descriptionParts = [];
        if (currentPhase) descriptionParts.push(currentPhase);
        if (currentSection) descriptionParts.push(currentSection);
        const description = descriptionParts.join(' / ');

        features.push({
          feature_name: featureName,
          phase: currentPhase || currentSection || '',
          priority: inCritical ? 'high' : 'medium',
          description
        });
      }
    }

    return features;
  }
}

module.exports = RoadmapSeederService;
