const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.resolve('data');
const dbPath = path.join(dataDir, 'app.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    }
    console.log(`Database connected at: ${dbPath}`);
    console.log('Connected to the SQLite database.');
});

module.exports = db;