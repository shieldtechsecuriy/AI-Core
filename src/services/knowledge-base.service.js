const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class KnowledgeBaseService {
  constructor() {
    this.basePath = process.env.KB_PATH || path.join(__dirname, '../../knowledge-base/shieldtech');
    this.documents = new Map();
    this.loadAllDocuments();
  }

  loadAllDocuments() {
    try {
      if (!fs.existsSync(this.basePath)) {
        logger.warn(`Knowledge base directory not found: ${this.basePath}`);
        return;
      }

      const files = fs.readdirSync(this.basePath);
      
      files.forEach(filename => {
        if (filename.endsWith('.md') || filename.endsWith('.sql') || filename.endsWith('.ts')) {
          const filepath = path.join(this.basePath, filename);
          const content = fs.readFileSync(filepath, 'utf8');
          
          this.documents.set(filename, {
            filename,
            content,
            keywords: this.extractKeywords(filename, content)
          });
        }
      });

      logger.info(`📚 Loaded ${this.documents.size} ShieldTech documents into knowledge base`);
    } catch (error) {
      logger.error('Failed to load knowledge base:', error);
    }
  }

  extractKeywords(filename, content) {
    const keywords = new Set();
    
    // Extract from filename
    const filenameWords = filename.toLowerCase().replace(/[_-]/g, ' ').split(' ');
    filenameWords.forEach(word => keywords.add(word));
    
    // Common technical terms to look for
    const technicalTerms = [
      'api', 'database', 'schema', 'deployment', 'architecture', 
      'roadmap', 'setup', 'types', 'guide', 'specification',
      'device', 'monitoring', 'alarm', 'customer', 'crm', 'bidding'
    ];
    
    technicalTerms.forEach(term => {
      if (content.toLowerCase().includes(term)) {
        keywords.add(term);
      }
    });
    
    return Array.from(keywords);
  }

  getContext(query, limit = 3) {
    const queryLower = query.toLowerCase();
    const relevantDocs = [];

    this.documents.forEach((doc, filename) => {
      let score = 0;
      
      // Check if query keywords match document keywords
      doc.keywords.forEach(keyword => {
        if (queryLower.includes(keyword)) {
          score += 1;
        }
      });
      
      if (score > 0) {
        relevantDocs.push({ ...doc, score });
      }
    });

    // Sort by relevance score and return top 3
    return relevantDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Backward-compatible alias
  getRelevantContext(query, limit = 3) {
    return this.getContext(query, limit);
  }

  listDocuments() {
    return Array.from(this.documents.keys());
  }

  getAllDocuments() {
    return Array.from(this.documents.values());
  }

  getDocument(filename) {
    return this.documents.get(filename);
  }
}

module.exports = KnowledgeBaseService;
