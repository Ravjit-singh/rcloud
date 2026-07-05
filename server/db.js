const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

// This will create a file named rcloud.db in your server folder
const DB_PATH = path.join(__dirname, 'rcloud.db');

async function initDB() {
    // Open the SQLite database
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    console.log("🗄️  SQLite Database connected successfully.");

    // Create the Users Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create the Files Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            original_name TEXT NOT NULL,
            stored_name TEXT UNIQUE NOT NULL,
            size INTEGER NOT NULL,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `);

    console.log("✅ Database tables verified.");
    return db;
}

module.exports = { initDB };
