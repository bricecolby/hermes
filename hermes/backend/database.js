// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { schemaStatements } = require('../shared/schema');

const dataDir = path.resolve('./backend/data');
const dbPath = path.join(dataDir, 'hermes.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, err => {
  if (err) throw err;
  console.log(`Database connected at: ${dbPath}`);

  db.serialize(() => {
    schemaStatements.forEach(stmt => db.run(stmt));
  });
});

module.exports = db;
