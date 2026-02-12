const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/openclaw.db');
    this.db = null;
  }

  async initialize() {
    logger.info('🗄️ Initializing database...');
    
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) throw err;
    });
    
    await this.createTables();
    logger.info('✅ Database ready');
  }

  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS business_ideas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        priority TEXT,
        status TEXT DEFAULT 'pending',
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS roadmap_features (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature_name TEXT UNIQUE NOT NULL,
        phase TEXT,
        priority TEXT,
        description TEXT,
        status TEXT DEFAULT 'pending',
        progress_percentage INTEGER DEFAULT 0,
        started_at DATETIME,
        completed_at DATETIME
      )`,
      
      `CREATE TABLE IF NOT EXISTS token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_name TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_usd REAL,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS roadmap_seed_meta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seed_key TEXT UNIQUE,
        seeded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];
    
    for (const sql of tables) {
      await this.run(sql);
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID });
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getPendingRoadmapFeatures(limit = 50) {
    return this.all(
      "SELECT * FROM roadmap_features WHERE status = 'pending' ORDER BY id ASC LIMIT ?",
      [limit]
    );
  }

  async markRoadmapFeatureStatus(featureName, status) {
    return this.run(
      "UPDATE roadmap_features SET status = ? WHERE feature_name = ?",
      [status, featureName]
    );
  }

  async hasSeededRoadmap(seedKey) {
    const rows = await this.all(
      "SELECT seed_key FROM roadmap_seed_meta WHERE seed_key = ?",
      [seedKey]
    );
    return rows.length > 0;
  }

  async markRoadmapSeeded(seedKey) {
    return this.run(
      "INSERT OR IGNORE INTO roadmap_seed_meta (seed_key) VALUES (?)",
      [seedKey]
    );
  }

  async getRoadmapProgress() {
    const pending = await this.all("SELECT * FROM roadmap_features WHERE status = 'pending'");
    const inProgress = await this.all("SELECT * FROM roadmap_features WHERE status = 'in_progress'");
    const completed = await this.all("SELECT * FROM roadmap_features WHERE status = 'completed'");
    
    return { pending, inProgress, completed };
  }
}

module.exports = DatabaseService;
