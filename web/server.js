const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();

app.use(express.static('public'));

app.get('/api/status', async (req, res) => {
  try {
    const statusPath = path.join(__dirname, '../data/status.json');
    const content = await fs.readFile(statusPath, 'utf8');
    res.json(JSON.parse(content));
  } catch {
    res.json({ status: 'offline', timestamp: new Date().toISOString() });
  }
});

app.listen(3000, () => console.log('Clawboard running on :3000'));
