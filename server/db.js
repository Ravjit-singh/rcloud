const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'rcloud_v2.db');

async function initDB() {
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
    console.log("🗄️  SQLite Database connected.");

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            parent_id INTEGER DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            folder_id INTEGER DEFAULT NULL,
            original_name TEXT NOT NULL,
            stored_name TEXT UNIQUE NOT NULL,
            size INTEGER NOT NULL,
            is_public INTEGER DEFAULT 0, 
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
        )
    `);

    // AUTO-MIGRATION: Safely add the column to an existing database if it's missing!
    try {
        await db.exec(`ALTER TABLE files ADD COLUMN is_public INTEGER DEFAULT 0`);
        console.log("🛠️ Database migrated: Added 'is_public' column.");
    } catch (err) {
        // If it throws an error, the column already exists. Safe to ignore!
    }

    console.log("✅ Database tables verified.");
    return db;
}

module.exports = { initDB };
