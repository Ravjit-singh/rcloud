const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

// THE FIX: We changed the filename to rcloud_v2.db to force a clean generation
const DB_PATH = path.join(__dirname, 'rcloud_v2.db');

async function initDB() {
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    console.log("🗄️  SQLite Database (v2) connected successfully.");

    // 1. Users Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Folders Table
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

    // 3. Files Table (Now with folder_id)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            folder_id INTEGER DEFAULT NULL,
            original_name TEXT NOT NULL,
            stored_name TEXT UNIQUE NOT NULL,
            size INTEGER NOT NULL,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
        )
    `);

    console.log("✅ Database tables (Users, Folders, Files) verified.");
    return db;
}

module.exports = { initDB };
