const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'rcloud_v2.db');

async function initDB() {
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
    console.log("🗄️  SQLite Database connected.");

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_approved INTEGER DEFAULT 0,
            is_frozen INTEGER DEFAULT 0,
            frozen_at DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            parent_id INTEGER DEFAULT NULL,
            is_public INTEGER DEFAULT 0,
            is_trash INTEGER DEFAULT 0,
            is_starred INTEGER DEFAULT 0,
            share_id TEXT,
            share_pin TEXT DEFAULT NULL,
            share_expires_at DATETIME DEFAULT NULL,
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
            is_trash INTEGER DEFAULT 0,
            is_starred INTEGER DEFAULT 0,
            share_id TEXT,
            share_pin TEXT DEFAULT NULL,
            share_expires_at DATETIME DEFAULT NULL,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
        )
    `);

    // Migrations
    try { await db.exec(`ALTER TABLE files ADD COLUMN share_id TEXT`); } catch (err) {}
    try { await db.exec(`ALTER TABLE folders ADD COLUMN share_id TEXT`); } catch (err) {}
    try { await db.exec(`ALTER TABLE files ADD COLUMN is_trash INTEGER DEFAULT 0`); } catch (err) {}
    try { await db.exec(`ALTER TABLE folders ADD COLUMN is_trash INTEGER DEFAULT 0`); } catch (err) {}
    try { await db.exec(`ALTER TABLE files ADD COLUMN is_starred INTEGER DEFAULT 0`); } catch (err) {}
    try { await db.exec(`ALTER TABLE folders ADD COLUMN is_starred INTEGER DEFAULT 0`); } catch (err) {}
    try { await db.exec(`ALTER TABLE users ADD COLUMN is_approved INTEGER DEFAULT 0`); } catch (err) {}
    try { await db.exec(`ALTER TABLE users ADD COLUMN is_frozen INTEGER DEFAULT 0`); } catch (err) {}
    try { await db.exec(`ALTER TABLE users ADD COLUMN frozen_at DATETIME DEFAULT NULL`); } catch (err) {}
    
    // NEW Migrations: Secure Sharing
    try { await db.exec(`ALTER TABLE files ADD COLUMN share_pin TEXT DEFAULT NULL`); } catch (err) {}
    try { await db.exec(`ALTER TABLE files ADD COLUMN share_expires_at DATETIME DEFAULT NULL`); } catch (err) {}
    try { await db.exec(`ALTER TABLE folders ADD COLUMN share_pin TEXT DEFAULT NULL`); } catch (err) {}
    try { await db.exec(`ALTER TABLE folders ADD COLUMN share_expires_at DATETIME DEFAULT NULL`); } catch (err) {}

    await db.run(`UPDATE users SET is_approved = 1 WHERE is_approved = 0 OR is_approved IS NULL`);

    const filesMissing = await db.all(`SELECT id FROM files WHERE share_id IS NULL`);
    for (let f of filesMissing) await db.run(`UPDATE files SET share_id = ? WHERE id = ?`, [crypto.randomBytes(8).toString('hex'), f.id]);
    const foldersMissing = await db.all(`SELECT id FROM folders WHERE share_id IS NULL`);
    for (let f of foldersMissing) await db.run(`UPDATE folders SET share_id = ? WHERE id = ?`, [crypto.randomBytes(8).toString('hex'), f.id]);

    console.log("✅ Database tables, security strings & states verified.");
    return db;
}
module.exports = { initDB };
