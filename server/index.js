const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const archiver = require('archiver'); // FIX: Corrected Archiver Import
const { initDB } = require('./db');

const ADMIN_PASSWORD = 'admin'; 
const MASTER_PASSWORD = 'master'; 
const ADMIN_SECRET = 'rcloud-admin-strict-jwt-2026';

let sharp, ffmpeg;
try { sharp = require('sharp'); } catch (e) { console.warn("⚠️ Sharp missing. Falling back to native resolution."); }
try { ffmpeg = require('fluent-ffmpeg'); } catch (e) { console.warn("⚠️ fluent-ffmpeg missing. Video thumbnails disabled."); }

const app = express();
const PORT = 3000;
const JWT_SECRET = 'rcloud-super-secret-key-2026';

const FILES_DIR = path.join(__dirname, 'files');
const THUMBS_DIR = path.join(__dirname, 'thumbs');
const WEB_DIR = path.join(__dirname, '../web');

// FIX: Relaxed CORS to allow APK Wrappers & Hotspots to send cookies seamlessly
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(WEB_DIR));

async function ensureDirExists() {
    try { await fs.access(FILES_DIR); } catch (error) { await fs.mkdir(FILES_DIR, { recursive: true }); }
    try { await fs.access(THUMBS_DIR); } catch (error) { await fs.mkdir(THUMBS_DIR, { recursive: true }); }
}

const loginAttempts = new Map();
function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const record = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
    if (record.lockUntil > Date.now()) {
        const mins = Math.ceil((record.lockUntil - Date.now()) / 60000);
        return res.status(429).json({ error: `Security lock active. Try again in ${mins} min(s).` });
    }
    req.rateLimitRecord = record; req.rateLimitIp = ip; next();
}
function handleLoginFailure(req) {
    if(!req.rateLimitRecord) return;
    const record = req.rateLimitRecord; record.count += 1;
    if (record.count >= 3) record.lockUntil = Date.now() + 2 * 60 * 1000;
    loginAttempts.set(req.rateLimitIp, record);
}
function handleLoginSuccess(req) { if(req.rateLimitIp) loginAttempts.delete(req.rateLimitIp); }

function authenticateToken(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: "Access denied." });
    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token." });
        const dbUser = await app.locals.db.get(`SELECT is_frozen FROM users WHERE id = ?`, [user.id]);
        if (!dbUser) return res.status(404).json({error: "User deleted"});
        if (dbUser.is_frozen === 1 && ['POST', 'PUT', 'DELETE'].includes(req.method) && !req.path.includes('/logout') && !req.path.includes('/download')) {
            return res.status(403).json({ error: "ACCOUNT_FROZEN" });
        }
        req.user = user; next();
    });
}

function authenticateAdmin(req, res, next) {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ error: "Admin access denied." });
    jwt.verify(token, ADMIN_SECRET, (err, decoded) => { if (err) return res.status(403).json({ error: "Invalid admin token." }); next(); });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, FILES_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// ==========================================
//               AUTH ROUTES
// ==========================================
app.post('/api/register', rateLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Required" });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await app.locals.db.run(`INSERT INTO users (username, password_hash, is_approved) VALUES (?, ?, 0)`, [username, hashedPassword]);
        handleLoginSuccess(req); res.json({ success: true, message: "Account pending approval." });
    } catch (err) { handleLoginFailure(req); res.status(400).json({ error: "Registration Failed" }); }
});

app.post('/api/login', rateLimiter, async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await app.locals.db.get(`SELECT * FROM users WHERE username = ?`, [username]);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) { handleLoginFailure(req); return res.status(400).json({ error: "Invalid credentials" }); }
        if (user.is_approved === 0) { handleLoginFailure(req); return res.status(403).json({ error: "Account pending admin approval." }); }
        handleLoginSuccess(req);
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        // FIX: sameSite 'lax' ensures cookies save correctly on mobile network connections!
        res.cookie('auth_token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 86400000 });
        res.json({ success: true, username: user.username });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/logout', (req, res) => { res.clearCookie('auth_token'); res.json({ success: true }); });

app.put('/api/password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const user = await app.locals.db.get(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
        if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) return res.status(400).json({ error: "Incorrect password" });
        await app.locals.db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [await bcrypt.hash(newPassword, 10), req.user.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Error" }); }
});

// ==========================================
//               ADMIN ROUTES
// ==========================================
app.post('/api/admin/login', rateLimiter, (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) { handleLoginSuccess(req); const token = jwt.sign({ role: 'admin' }, ADMIN_SECRET, { expiresIn: '12h' }); res.cookie('admin_token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 43200000 }); res.json({ success: true }); } 
    else { handleLoginFailure(req); res.status(403).json({ error: "Invalid Admin Password" }); }
});

app.post('/api/admin/logout', (req, res) => { res.clearCookie('admin_token'); res.json({ success: true }); });

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const users = await app.locals.db.all(`SELECT id, username, is_approved, is_frozen, frozen_at, created_at FROM users ORDER BY created_at DESC`);
        for (let user of users) { const sizeRow = await app.locals.db.get(`SELECT SUM(size) as total FROM files WHERE user_id = ?`, [user.id]); user.storageUsed = sizeRow.total || 0; }
        res.json({ success: true, users });
    } catch(e) { res.status(500).json({error: "Failed"}); }
});

app.put('/api/admin/users/:id/approve', authenticateAdmin, async (req, res) => { try { await app.locals.db.run(`UPDATE users SET is_approved = 1 WHERE id = ?`, [req.params.id]); res.json({ success: true }); } catch(e) { res.status(500).json({error: "Failed"}); }});
app.put('/api/admin/users/:id/freeze', authenticateAdmin, async (req, res) => {
    const { masterPassword } = req.body; if (masterPassword !== MASTER_PASSWORD) return res.status(403).json({ error: "INVALID_MASTER" });
    try {
        const user = await app.locals.db.get(`SELECT is_frozen FROM users WHERE id = ?`, [req.params.id]);
        if (user.is_frozen === 1) await app.locals.db.run(`UPDATE users SET is_frozen = 0, frozen_at = NULL WHERE id = ?`, [req.params.id]); else await app.locals.db.run(`UPDATE users SET is_frozen = 1, frozen_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.params.id]); res.json({ success: true });
    } catch(e) { res.status(500).json({error: "Failed"}); }
});

app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    const { masterPassword } = req.body; if (masterPassword !== MASTER_PASSWORD) return res.status(403).json({ error: "INVALID_MASTER" });
    try { await destroyUser(req.params.id); res.json({ success: true }); } catch(e) { res.status(500).json({error: "Failed"}); }
});

async function destroyUser(userId) {
    const files = await app.locals.db.all(`SELECT stored_name FROM files WHERE user_id = ?`, [userId]);
    for (let f of files) { try { await fs.unlink(path.join(FILES_DIR, f.stored_name)); await fs.unlink(path.join(THUMBS_DIR, f.stored_name + '.webp')); await fs.unlink(path.join(THUMBS_DIR, f.stored_name + '.jpg')); } catch(e){} }
    await app.locals.db.run(`DELETE FROM users WHERE id = ?`, [userId]); 
}

setInterval(async () => {
    try { const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', ''); const doomedUsers = await app.locals.db.all(`SELECT id, username FROM users WHERE is_frozen = 1 AND frozen_at <= ?`, [tenDaysAgo]); for (let u of doomedUsers) await destroyUser(u.id); } catch(e) { }
}, 1000 * 60 * 60);

// ==========================================
//             STORAGE ENGINE
// ==========================================
app.get('/api/storage', authenticateToken, async (req, res) => {
    try {
        const userSizeRow = await app.locals.db.get(`SELECT SUM(size) as total FROM files WHERE user_id = ?`, [req.user.id]);
        const used = userSizeRow.total || 0;
        const userCountRow = await app.locals.db.get(`SELECT COUNT(id) as count FROM users`);
        const totalUsers = Math.max(1, userCountRow.count);
        const globalSizeRow = await app.locals.db.get(`SELECT SUM(size) as total FROM files`);
        const totalRCloudUsed = globalSizeRow.total || 0;
        let limit = 15 * 1024 * 1024 * 1024;
        try {
            const stats = await fs.statfs(FILES_DIR);
            const freeSpaceOnDevice = stats.bavail * stats.bsize; 
            const totalPool = freeSpaceOnDevice + totalRCloudUsed;
            limit = totalPool / totalUsers;
        } catch (diskErr) { limit = limit / totalUsers; }
        res.json({ success: true, used, limit });
    } catch (err) { res.status(500).json({ error: "Failed to calculate storage" }); }
});

// ==========================================
//               DRIVE ENGINE
// ==========================================
app.get(['/api/drive', '/api/drive/:folderId'], authenticateToken, async (req, res) => {
    const folderId = req.params.folderId || null; const view = req.query.view || 'home';
    try {
        const dbUser = await app.locals.db.get(`SELECT is_frozen FROM users WHERE id = ?`, [req.user.id]);
        const isFrozen = dbUser.is_frozen === 1;
        let folders, files;
        if (view === 'trash') {
            folders = await app.locals.db.all(`SELECT id, name, is_public, share_id, is_starred, is_trash, created_at as date FROM folders WHERE user_id = ? AND is_trash = 1`, [req.user.id]);
            files = await app.locals.db.all(`SELECT id, original_name as name, size, is_public, share_id, is_starred, is_trash, upload_date as date FROM files WHERE user_id = ? AND is_trash = 1`, [req.user.id]);
        } else if (view === 'starred') {
            folders = await app.locals.db.all(`SELECT id, name, is_public, share_id, is_starred, is_trash, created_at as date FROM folders WHERE user_id = ? AND is_starred = 1 AND is_trash = 0`, [req.user.id]);
            files = await app.locals.db.all(`SELECT id, original_name as name, size, is_public, share_id, is_starred, is_trash, upload_date as date FROM files WHERE user_id = ? AND is_starred = 1 AND is_trash = 0`, [req.user.id]);
        } else if (view === 'shared') {
            folders = await app.locals.db.all(`SELECT id, name, is_public, share_id, is_starred, is_trash, created_at as date FROM folders WHERE user_id = ? AND is_public = 1 AND is_trash = 0`, [req.user.id]);
            files = await app.locals.db.all(`SELECT id, original_name as name, size, is_public, share_id, is_starred, is_trash, upload_date as date FROM files WHERE user_id = ? AND is_public = 1 AND is_trash = 0`, [req.user.id]);
        } else {
            folders = await app.locals.db.all(`SELECT id, name, is_public, share_id, is_starred, is_trash, created_at as date FROM folders WHERE user_id = ? AND parent_id ${folderId ? '= ?' : 'IS NULL'} AND is_trash = 0`, folderId ? [req.user.id, folderId] : [req.user.id]);
            files = await app.locals.db.all(`SELECT id, original_name as name, size, is_public, share_id, is_starred, is_trash, upload_date as date FROM files WHERE user_id = ? AND folder_id ${folderId ? '= ?' : 'IS NULL'} AND is_trash = 0`, folderId ? [req.user.id, folderId] : [req.user.id]);
        }
        res.json({ success: true, folders, files, username: req.user.username, isFrozen });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.get('/api/search', authenticateToken, async (req, res) => {
    const { q } = req.query; if (!q) return res.json({ success: true, folders: [], files: [] });
    try {
        const folders = await app.locals.db.all(`SELECT id, name, is_public, share_id, is_starred, is_trash, created_at as date FROM folders WHERE user_id = ? AND name LIKE ? AND is_trash = 0`, [req.user.id, `%${q}%`]);
        const files = await app.locals.db.all(`SELECT id, original_name as name, size, is_public, share_id, is_starred, is_trash, upload_date as date FROM files WHERE user_id = ? AND original_name LIKE ? AND is_trash = 0`, [req.user.id, `%${q}%`]);
        res.json({ success: true, folders, files, username: req.user.username });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/folders', authenticateToken, async (req, res) => {
    try {
        const shareId = crypto.randomBytes(8).toString('hex');
        const result = await app.locals.db.run(`INSERT INTO folders (user_id, name, parent_id, share_id) VALUES (?, ?, ?, ?)`, [req.user.id, req.body.name, req.body.parentId || null, shareId]);
        res.json({ success: true, folderId: result.lastID });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    let folderId = req.body.folderId && req.body.folderId !== 'null' ? parseInt(req.body.folderId) : null;
    const relativePath = req.body.relativePath; 
    
    try {
        if (relativePath && relativePath.includes('/')) {
            const parts = relativePath.split('/');
            parts.pop(); 
            let currentParent = folderId;
            for (const part of parts) {
                let row = await app.locals.db.get(`SELECT id FROM folders WHERE name = ? AND parent_id ${currentParent ? '= ?' : 'IS NULL'} AND user_id = ? AND is_trash = 0`, currentParent ? [part, currentParent, req.user.id] : [part, req.user.id]);
                if (!row) {
                    const shareId = crypto.randomBytes(8).toString('hex');
                    const result = await app.locals.db.run(`INSERT INTO folders (user_id, name, parent_id, share_id) VALUES (?, ?, ?, ?)`, [req.user.id, part, currentParent, shareId]);
                    currentParent = result.lastID;
                } else { currentParent = row.id; }
            }
            folderId = currentParent;
        }

        const shareId = crypto.randomBytes(8).toString('hex');
        await app.locals.db.run(`INSERT INTO files (user_id, folder_id, original_name, stored_name, size, share_id) VALUES (?, ?, ?, ?, ?, ?)`, [req.user.id, folderId, req.file.originalname, req.file.filename, req.file.size, shareId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.put('/api/rename', authenticateToken, async (req, res) => {
    const { id, type, newName } = req.body; if (!newName || !newName.trim()) return res.status(400).json({ error: "Invalid name" });
    try {
        if (type === 'folder') await app.locals.db.run(`UPDATE folders SET name = ? WHERE id = ? AND user_id = ?`, [newName.trim(), id, req.user.id]);
        else await app.locals.db.run(`UPDATE files SET original_name = ? WHERE id = ? AND user_id = ?`, [newName.trim(), id, req.user.id]); res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to rename" }); }
});

app.put('/api/trash/:type/:id', authenticateToken, async (req, res) => {
    try {
        const { type, id } = req.params; const isTrash = req.body.isTrash ? 1 : 0;
        if (type === 'file') { await app.locals.db.run(`UPDATE files SET is_trash = ? WHERE id = ? AND user_id = ?`, [isTrash, id, req.user.id]); } else if (type === 'folder') { await app.locals.db.run(`UPDATE folders SET is_trash = ? WHERE id = ? AND user_id = ?`, [isTrash, id, req.user.id]); }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: "Failed"}); }
});

app.put('/api/star/:type/:id', authenticateToken, async (req, res) => {
    try {
        const { type, id } = req.params; const isStarred = req.body.isStarred ? 1 : 0;
        if (type === 'file') { await app.locals.db.run(`UPDATE files SET is_starred = ? WHERE id = ? AND user_id = ?`, [isStarred, id, req.user.id]); } else if (type === 'folder') { await app.locals.db.run(`UPDATE folders SET is_starred = ? WHERE id = ? AND user_id = ?`, [isStarred, id, req.user.id]); }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: "Failed"}); }
});

app.delete('/api/trash/empty', authenticateToken, async (req, res) => {
    try {
        async function deleteFolderTree(current) {
            const subfolders = await app.locals.db.all(`SELECT id FROM folders WHERE user_id = ? AND parent_id = ?`, [req.user.id, current]);
            for (let sub of subfolders) await deleteFolderTree(sub.id);
            await app.locals.db.run(`DELETE FROM files WHERE user_id = ? AND folder_id = ?`, [req.user.id, current]); await app.locals.db.run(`DELETE FROM folders WHERE user_id = ? AND id = ?`, [req.user.id, current]);
        }
        const rootTrashFolders = await app.locals.db.all(`SELECT id FROM folders WHERE is_trash = 1 AND user_id = ?`, [req.user.id]);
        for (let folder of rootTrashFolders) {
            let allFiles = await app.locals.db.all(`SELECT stored_name FROM files WHERE user_id = ? AND folder_id = ?`, [req.user.id, folder.id]);
            for (let f of allFiles) { try { await fs.unlink(path.join(FILES_DIR, f.stored_name)); await fs.unlink(path.join(THUMBS_DIR, f.stored_name+'.webp')); } catch(e){} }
            await deleteFolderTree(folder.id);
        }
        const looseFiles = await app.locals.db.all(`SELECT stored_name FROM files WHERE is_trash = 1 AND user_id = ?`, [req.user.id]);
        for (let f of looseFiles) { try { await fs.unlink(path.join(FILES_DIR, f.stored_name)); await fs.unlink(path.join(THUMBS_DIR, f.stored_name+'.webp')); } catch(e){} }
        await app.locals.db.run(`DELETE FROM files WHERE is_trash = 1 AND user_id = ?`, [req.user.id]); await app.locals.db.run(`DELETE FROM folders WHERE is_trash = 1 AND user_id = ?`, [req.user.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: "Failed"}); }
});

app.delete('/api/delete/:id', authenticateToken, async (req, res) => {
    try {
        const file = await app.locals.db.get(`SELECT stored_name FROM files WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
        if (!file) return res.status(404).json({ error: "Not found" });
        try { await fs.unlink(path.join(FILES_DIR, file.stored_name)); await fs.unlink(path.join(THUMBS_DIR, file.stored_name+'.webp')); } catch (e) {}
        await app.locals.db.run(`DELETE FROM files WHERE id = ?`, [req.params.id]); res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.delete('/api/folders/:id', authenticateToken, async (req, res) => {
    try {
        async function getAllFiles(current) {
            let allFiles = await app.locals.db.all(`SELECT stored_name FROM files WHERE user_id = ? AND folder_id = ?`, [req.user.id, current]);
            const subfolders = await app.locals.db.all(`SELECT id FROM folders WHERE user_id = ? AND parent_id = ?`, [req.user.id, current]);
            for (let sub of subfolders) allFiles = allFiles.concat(await getAllFiles(sub.id)); return allFiles;
        }
        async function deleteFolderTree(current) {
            const subfolders = await app.locals.db.all(`SELECT id FROM folders WHERE user_id = ? AND parent_id = ?`, [req.user.id, current]);
            for (let sub of subfolders) await deleteFolderTree(sub.id);
            await app.locals.db.run(`DELETE FROM files WHERE user_id = ? AND folder_id = ?`, [req.user.id, current]); await app.locals.db.run(`DELETE FROM folders WHERE user_id = ? AND id = ?`, [req.user.id, current]);
        }
        const filesToDelete = await getAllFiles(req.params.id);
        for (let file of filesToDelete) { try { await fs.unlink(path.join(FILES_DIR, file.stored_name)); await fs.unlink(path.join(THUMBS_DIR, file.stored_name+'.webp')); } catch (e) {} }
        await deleteFolderTree(req.params.id); res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/copy', authenticateToken, async (req, res) => {
    const { targetFolder, items } = req.body;
    try {
        async function copyFolder(folderId, newParentId) {
            const folder = await app.locals.db.get(`SELECT * FROM folders WHERE id = ? AND user_id = ?`, [folderId, req.user.id]);
            if (!folder) return;
            const subfolders = await app.locals.db.all(`SELECT id FROM folders WHERE parent_id = ? AND user_id = ?`, [folderId, req.user.id]);
            const shareId = crypto.randomBytes(8).toString('hex');
            const result = await app.locals.db.run(`INSERT INTO folders (user_id, name, parent_id, share_id) VALUES (?, ?, ?, ?)`, [req.user.id, folder.name + " (Copy)", newParentId, shareId]);
            const newFolderId = result.lastID;
            const files = await app.locals.db.all(`SELECT * FROM files WHERE folder_id = ? AND user_id = ?`, [folderId, req.user.id]);
            for (let f of files) await copyFile(f, newFolderId);
            for (let sub of subfolders) await copyFolder(sub.id, newFolderId);
        }
        async function copyFile(f, newFolderId) {
            const newStoredName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + f.original_name;
            await fs.copyFile(path.join(FILES_DIR, f.stored_name), path.join(FILES_DIR, newStoredName));
            const extMatch = f.original_name.match(/(\.[\w\d_-]+)$/i);
            const newOriginalName = extMatch ? f.original_name.replace(extMatch[0], ` (Copy)${extMatch[0]}`) : f.original_name + ' (Copy)';
            const shareId = crypto.randomBytes(8).toString('hex');
            await app.locals.db.run(`INSERT INTO files (user_id, folder_id, original_name, stored_name, size, share_id) VALUES (?, ?, ?, ?, ?, ?)`, [req.user.id, newFolderId, newOriginalName, newStoredName, f.size, shareId]);
        }
        for (let item of items) {
            if (item.type === 'file') { const f = await app.locals.db.get(`SELECT * FROM files WHERE id = ? AND user_id = ?`, [item.id, req.user.id]); if (f) await copyFile(f, targetFolder); } 
            else if (item.type === 'folder') { await copyFolder(item.id, targetFolder); }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to copy" }); }
});

app.put('/api/move', authenticateToken, async (req, res) => {
    const { targetFolder, items } = req.body;
    try {
        for (let item of items) {
            if (item.type === 'file') { await app.locals.db.run(`UPDATE files SET folder_id = ? WHERE id = ? AND user_id = ?`, [targetFolder, item.id, req.user.id]); } 
            else if (item.type === 'folder') { if (targetFolder === item.id || targetFolder === String(item.id)) continue; await app.locals.db.run(`UPDATE folders SET parent_id = ? WHERE id = ? AND user_id = ?`, [targetFolder, item.id, req.user.id]); }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ==========================================
//   FIX: THUMBNAIL ENGINE (FFMPEG & SHARP)
// ==========================================
async function serveThumbnail(fileRecord, res) {
    if (!fileRecord) return res.status(404).end();
    const ext = fileRecord.original_name.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    const isVideo = ['mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext);

    if (!isImage && !isVideo) return res.status(404).end();

    const thumbPathWebp = path.join(THUMBS_DIR, fileRecord.stored_name + '.webp');
    const thumbPathJpg = path.join(THUMBS_DIR, fileRecord.stored_name + '.jpg');
    const originalPath = path.join(FILES_DIR, fileRecord.stored_name);

    // Try to serve cached thumbnails first
    try { await fs.access(thumbPathWebp); return res.sendFile(thumbPathWebp); } catch (e) { } 
    try { await fs.access(thumbPathJpg); return res.sendFile(thumbPathJpg); } catch (e) { } 

    if (isImage) {
        if (!sharp) return res.sendFile(originalPath); // Just send raw image if sharp is missing
        try {
            await sharp(originalPath).resize(200, 200, { fit: 'cover' }).webp({ quality: 80 }).toFile(thumbPathWebp); 
            return res.sendFile(thumbPathWebp);
        } catch(e) { return res.sendFile(originalPath); }
    } else if (isVideo) {
        if (!ffmpeg) return res.status(404).end(); // If no ffmpeg, return 404 (frontend will show movie icon)
        
        try {
            // Extract a single raw JPG frame from the video
            await new Promise((resolve, reject) => { 
                ffmpeg(originalPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .screenshots({ count: 1, timestamps: ['10%'], folder: THUMBS_DIR, filename: fileRecord.stored_name + '.jpg', size: '200x200' }); 
            });
            
            if (sharp) {
                // If sharp exists, optimize the JPG frame into WEBP
                try {
                    await sharp(thumbPathJpg).webp({ quality: 80 }).toFile(thumbPathWebp); 
                    await fs.unlink(thumbPathJpg).catch(()=>{}); 
                    return res.sendFile(thumbPathWebp);
                } catch(err) {
                    return res.sendFile(thumbPathJpg);
                }
            } else {
                // FIX: If sharp is missing, just serve the raw JPG frame!
                return res.sendFile(thumbPathJpg);
            }
        } catch(e) { return res.status(404).end(); }
    }
}

app.get('/api/thumbnail/:id', authenticateToken, async (req, res) => {
    try {
        const file = await app.locals.db.get(`SELECT original_name, stored_name FROM files WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
        await serveThumbnail(file, res);
    } catch(e) { res.status(500).end(); }
});

app.get('/share/thumbnail/:share_id', async (req, res) => {
    try {
        const file = await app.locals.db.get(`SELECT original_name, stored_name, is_public FROM files WHERE share_id = ?`, [req.params.share_id]);
        if (!file || file.is_public !== 1) return res.status(403).end();
        await serveThumbnail(file, res);
    } catch(e) { res.status(500).end(); }
});

app.get('/api/view/:id', authenticateToken, async (req, res) => {
    try { const fileRecord = await app.locals.db.get(`SELECT stored_name FROM files WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]); if (!fileRecord) return res.status(404).send("Not found"); res.sendFile(path.join(FILES_DIR, fileRecord.stored_name)); } catch (err) { res.status(500).send("Error"); }
});

app.get('/api/download/:id', authenticateToken, async (req, res) => {
    try { const fileRecord = await app.locals.db.get(`SELECT original_name, stored_name FROM files WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]); if (!fileRecord) return res.status(404).send("Not found"); res.download(path.join(FILES_DIR, fileRecord.stored_name), fileRecord.original_name); } catch (err) { res.status(500).send("Error"); }
});

// ==========================================
//          SECURE SHARING ENGINE
// ==========================================
async function serveProtectedContent(req, res, shareId, renderCallback) {
    let item = await app.locals.db.get(`SELECT * FROM files WHERE share_id = ?`, [shareId]);
    let type = 'file';
    if (!item) { item = await app.locals.db.get(`SELECT * FROM folders WHERE share_id = ?`, [shareId]); type = 'folder'; }
    if (!item || item.is_public !== 1) return res.status(403).send("<h1>⛔ 403 Forbidden</h1><p>This item is private.</p>");

    if (item.share_expires_at && new Date(item.share_expires_at + 'Z') < new Date()) {
        return res.status(410).send("<h1>⏳ 410 Expired</h1><p>This link has expired.</p>");
    }

    if (item.share_pin) {
        const cookieVal = req.cookies[`auth_share_${shareId}`];
        if (cookieVal !== item.share_pin) {
            return res.send(`
            <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Protected Link</title>
            <script src="https://cdn.tailwindcss.com"></script></head>
            <body class="bg-[#131314] h-screen flex items-center justify-center p-4">
                <div class="bg-[#1e1f20] p-8 rounded-2xl w-full max-w-sm border border-[#444746] text-center shadow-2xl">
                    <h2 class="text-2xl font-medium text-[#e3e3e3] mb-2">Protected Link</h2>
                    <p class="text-[#c4c7c5] text-[15px] mb-8">Enter the secure PIN to access this file.</p>
                    <input type="password" id="pin" class="w-full bg-[#131314] border border-[#444746] rounded-lg py-3.5 px-4 text-center text-white tracking-[0.5em] mb-4 text-xl outline-none focus:border-[#a8c7fa] transition-all" maxlength="4" placeholder="••••">
                    <p id="err" class="text-red-400 text-sm mb-6 h-4"></p>
                    <button onclick="submitPin()" class="w-full bg-[#a8c7fa] text-[#001d35] font-medium py-3 rounded-full hover:brightness-110 transition">Unlock</button>
                </div>
                <script>
                    document.getElementById('pin').addEventListener('keypress', function(e) { if (e.key === 'Enter') submitPin(); });
                    async function submitPin() {
                        const pin = document.getElementById('pin').value;
                        const res = await fetch('/share/auth/${shareId}', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pin})});
                        if(res.ok) window.location.reload(); else document.getElementById('err').textContent = "Incorrect PIN";
                    }
                </script>
            </body></html>`);
        }
    }
    await renderCallback(item, type);
}

app.post('/share/auth/:share_id', async (req, res) => {
    const { pin } = req.body;
    res.cookie(`auth_share_${req.params.share_id}`, pin, { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true });
});

app.put('/api/share/:type/:id', authenticateToken, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { isPublic, pin, expiryDays } = req.body;
        const isPub = isPublic ? 1 : 0;
        const sharePin = (isPublic && pin) ? pin : null;
        let expiryDate = null;
        if (isPublic && expiryDays && expiryDays > 0) {
            expiryDate = new Date(Date.now() + expiryDays * 86400000).toISOString().replace('T', ' ').replace('Z', '');
        }

        if (type === 'file') { 
            await app.locals.db.run(`UPDATE files SET is_public = ?, share_pin = ?, share_expires_at = ? WHERE id = ? AND user_id = ?`, [isPub, sharePin, expiryDate, id, req.user.id]); 
        } else if (type === 'folder') {
            async function setFolderPublicStatus(currentFolderId) {
                await app.locals.db.run(`UPDATE folders SET is_public = ?, share_pin = ?, share_expires_at = ? WHERE id = ? AND user_id = ?`, [isPub, sharePin, expiryDate, currentFolderId, req.user.id]);
                await app.locals.db.run(`UPDATE files SET is_public = ? WHERE folder_id = ? AND user_id = ?`, [isPub, currentFolderId, req.user.id]);
                const subfolders = await app.locals.db.all(`SELECT id FROM folders WHERE parent_id = ? AND user_id = ?`, [currentFolderId, req.user.id]);
                for (let sub of subfolders) await setFolderPublicStatus(sub.id);
            }
            await setFolderPublicStatus(id);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.get('/share/file/:share_id', async (req, res) => {
    serveProtectedContent(req, res, req.params.share_id, async (item, type) => {
        if(type !== 'file') return res.status(404).send("Not a file");
        res.sendFile(path.join(FILES_DIR, item.stored_name));
    });
});

app.get('/share/folder/:share_id', async (req, res) => {
    serveProtectedContent(req, res, req.params.share_id, async (folder, type) => {
        if(type !== 'folder') return res.status(404).send("Not a folder");
        const folders = await app.locals.db.all(`SELECT share_id as id, name, created_at as date FROM folders WHERE parent_id = ? AND is_public = 1 AND is_trash = 0`, [folder.id]);
        const files = await app.locals.db.all(`SELECT share_id as id, original_name as name, size, upload_date as date FROM files WHERE folder_id = ? AND is_public = 1 AND is_trash = 0`, [folder.id]);
        
        let html = `<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${folder.name} - Public Drive</title>
        <script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0" /><style> .material-symbols-rounded { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; } .material-symbols-rounded.filled { font-variation-settings: 'FILL' 1; } </style>
        </head><body class="bg-[#131314] text-[#e3e3e3] p-4 md:p-8 font-sans h-screen flex flex-col"><div class="max-w-6xl mx-auto w-full flex-1 flex flex-col"><div class="flex flex-col md:flex-row md:items-center justify-between mb-6"><div class="flex items-center mb-4 md:mb-0"><button onclick="history.back()" class="p-2 mr-2 rounded-full hover:bg-white/10 transition flex items-center justify-center"><span class="material-symbols-rounded">arrow_back</span></button><span class="material-symbols-rounded filled text-[#a8c7fa] text-3xl mr-3">folder_shared</span><h1 class="text-2xl md:text-3xl font-medium truncate">${folder.name}</h1></div><div class="flex items-center space-x-2"><a href="/share/download/zip/${req.params.share_id}" class="bg-[#a8c7fa] text-[#001d35] font-medium px-4 py-2 rounded-full hover:bg-[#c2e7ff] transition flex items-center shadow-sm"><span class="material-symbols-rounded mr-2 text-[20px]">archive</span> Download All</a><div class="relative"><button id="pubSortBtn" onclick="document.getElementById('pubSortMenu').classList.toggle('hidden')" class="p-2 rounded-full text-[#c4c7c5] hover:bg-white/10 transition flex items-center justify-center"><span class="material-symbols-rounded">sort</span></button><div id="pubSortMenu" class="hidden absolute top-12 right-0 bg-[#1e1f20] border border-[#444746] rounded-[12px] shadow-2xl py-2 w-40 z-50"><button onclick="setSort('name')" class="w-full text-left px-4 py-2 text-[14px] text-[#e3e3e3] hover:bg-[#282a2c]">Name</button><button onclick="setSort('date')" class="w-full text-left px-4 py-2 text-[14px] text-[#e3e3e3] hover:bg-[#282a2c]">Date</button><button onclick="setSort('size')" class="w-full text-left px-4 py-2 text-[14px] text-[#e3e3e3] hover:bg-[#282a2c]">Size</button></div></div><button id="pubViewBtn" onclick="toggleView()" class="p-2 rounded-full text-[#c4c7c5] hover:bg-white/10 transition flex items-center justify-center"><span class="material-symbols-rounded" id="pubViewIcon">view_list</span></button></div></div><div class="flex-1 overflow-y-auto pb-10" id="publicContainer"></div></div>
        
        <div id="previewModal" class="hidden fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col transition-opacity duration-300 opacity-0">
            <div class="flex items-center justify-between p-4 text-[#e3e3e3] bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full z-10">
                <div class="flex items-center space-x-4"><button onclick="closePreview()" class="p-2 rounded-full hover:bg-white/10 transition flex items-center justify-center"><span class="material-symbols-rounded">arrow_back</span></button><span id="previewFilename" class="font-medium text-[16px] truncate max-w-[200px] md:max-w-md"></span></div>
                <div class="flex items-center space-x-2"><a id="downloadPreviewBtn" class="p-2 rounded-full hover:bg-white/10 transition flex items-center justify-center" title="Download" download><span class="material-symbols-rounded">download</span></a></div>
            </div>
            <div id="previewContent" class="flex-1 flex items-center justify-center p-4 md:p-12 overflow-hidden relative mt-16 md:mt-0"></div>
        </div>
        
        <script src="/js/videoplayer.js"></script>

        <script>
            let rawFolders = []; let rawFiles = [];
            try { rawFolders = ${JSON.stringify(folders)} || []; rawFiles = ${JSON.stringify(files)} || []; } catch(e) { }
            let viewMode = 'grid'; let sortBy = 'name'; let sortOrder = 'asc';
            try { viewMode = localStorage.getItem('rcloud_pub_view') || 'grid'; sortBy = localStorage.getItem('rcloud_pub_sort') || 'name'; sortOrder = localStorage.getItem('rcloud_pub_sortOrder') || 'asc'; } catch(e) {}
            document.addEventListener('DOMContentLoaded', () => { const icon = document.getElementById('pubViewIcon'); if (icon) icon.textContent = viewMode === 'grid' ? 'view_list' : 'grid_view'; render(); });
            function formatSize(b) { if (!b || isNaN(b)) return '--'; const k=1024, s=['B','KB','MB','GB'], i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i]; }
            function formatDate(d) { if (!d) return '--'; return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
            function getFileIcon(name) { if (!name) return { icon: 'description', color: 'text-blue-400' }; const ext = String(name).split('.').pop().toLowerCase(); if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { icon: 'image', color: 'text-[#a8c7fa]' }; if (['pdf'].includes(ext)) return { icon: 'picture_as_pdf', color: 'text-red-400' }; if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return { icon: 'movie', color: 'text-purple-400' }; if (['zip', 'rar', 'apk'].includes(ext)) return { icon: 'folder_zip', color: 'text-yellow-500' }; return { icon: 'description', color: 'text-blue-400' }; }
            function toggleView() { viewMode = viewMode === 'grid' ? 'list' : 'grid'; try { localStorage.setItem('rcloud_pub_view', viewMode); } catch(e){} const icon = document.getElementById('pubViewIcon'); if (icon) icon.textContent = viewMode === 'grid' ? 'view_list' : 'grid_view'; render(); }
            function setSort(by) { if (sortBy === by) sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'; else { sortBy = by; sortOrder = 'asc'; } try { localStorage.setItem('rcloud_pub_sort', sortBy); localStorage.setItem('rcloud_pub_sortOrder', sortOrder); } catch(e){} const menu = document.getElementById('pubSortMenu'); if (menu) menu.classList.add('hidden'); render(); }
            function sortData(arr) { return arr.sort((a, b) => { let vA, vB; if (sortBy === 'name') { vA = String(a.name || '').toLowerCase(); vB = String(b.name || '').toLowerCase(); } else if (sortBy === 'date') { vA = new Date(a.date).getTime()||0; vB = new Date(b.date).getTime()||0; } else if (sortBy === 'size') { vA = Number(a.size)||0; vB = Number(b.size)||0; } if (vA < vB) return sortOrder === 'asc' ? -1 : 1; if (vA > vB) return sortOrder === 'asc' ? 1 : -1; return 0; }); }
            function render() {
                try {
                    const container = document.getElementById('publicContainer'); if (!container) return;
                    const sortedFolders = sortData([...rawFolders]); const sortedFiles = sortData([...rawFiles]);
                    if (sortedFolders.length === 0 && sortedFiles.length === 0) { container.innerHTML = '<div class="flex flex-col items-center justify-center py-24 text-[#c4c7c5]"><span class="material-symbols-rounded text-[64px] mb-4 opacity-50">folder_open</span><p class="text-[16px] font-medium">This folder is empty</p></div>'; return; }
                    let html = ''; const isList = viewMode === 'list'; const gridClass = isList ? 'flex flex-col mb-8' : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-8'; const fileGridClass = isList ? 'flex flex-col' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';
                    if (sortedFolders.length > 0) { html += '<h3 class="text-[14px] font-medium text-[#e3e3e3] mb-3 mt-4">Folders</h3><div class="' + gridClass + '">'; sortedFolders.forEach(f => { if (isList) { html += \`<a href="/share/folder/\${f.id}" class="flex items-center justify-between p-3 border-b border-[#444746] bg-[#1e1f20] hover:bg-[#282a2c] transition group"><div class="flex items-center flex-1 overflow-hidden"><span class="material-symbols-rounded filled text-[#c4c7c5] text-[24px] mr-4">folder</span><span class="text-[14px] font-medium text-[#e3e3e3] truncate">\${f.name}</span></div><div class="w-32 hidden md:block text-[#c4c7c5] text-[13px]">\${formatDate(f.date)}</div><div class="w-20 hidden md:block text-[#c4c7c5] text-[13px]">--</div></a>\`; } else { html += \`<a href="/share/folder/\${f.id}" class="flex items-center bg-[#1e1f20] hover:bg-[#282a2c] rounded-[16px] py-3.5 px-4 transition border border-transparent hover:border-[#444746] group"><span class="material-symbols-rounded filled text-[#c4c7c5] text-[28px] mr-4">folder</span><div class="flex flex-col overflow-hidden"><span class="text-[15px] font-medium text-[#e3e3e3] truncate">\${f.name}</span><span class="text-[11px] text-[#c4c7c5] mt-0.5">\${formatDate(f.date)}</span></div></a>\`; } }); html += '</div>'; }
                    
                    if (sortedFiles.length > 0) { 
                        html += '<h3 class="text-[14px] font-medium text-[#e3e3e3] mb-3 mt-4">Files</h3><div class="' + fileGridClass + '">'; 
                        sortedFiles.forEach(f => { 
                            const ft = getFileIcon(f.name); 
                            const safeName = String(f.name).replace(/'/g, "\\\\'"); 
                            if (isList) { 
                                html += \`<div onclick="openPreview('\${f.id}', '\${safeName}')" class="flex items-center justify-between p-3 border-b border-[#444746] bg-[#1e1f20] hover:bg-[#282a2c] transition cursor-pointer group"><div class="flex items-center flex-1 overflow-hidden"><span class="material-symbols-rounded filled \${ft.color} text-[24px] mr-4">\${ft.icon}</span><span class="text-[14px] font-medium text-[#e3e3e3] truncate">\${f.name}</span></div><div class="w-32 hidden md:block text-[#c4c7c5] text-[13px]">\${formatDate(f.date)}</div><div class="w-20 hidden md:block text-[#c4c7c5] text-[13px]">\${formatSize(f.size)}</div><a href="/share/file/\${f.id}" download="\${f.name}" onclick="event.stopPropagation()" class="p-2 rounded-full hover:bg-white/10 transition ml-4"><span class="material-symbols-rounded text-[#c4c7c5]">download</span></a></div>\`; 
                            } else { 
                                let thumbnailHTML = \`<span class="material-symbols-rounded text-[48px] \${ft.color}">\${ft.icon}</span>\`;
                                const ext = f.name.split('.').pop().toLowerCase();
                                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext)) { 
                                    thumbnailHTML = \`
                                        <img src="/share/thumbnail/\${f.id}" loading="lazy" class="w-full h-full object-cover rounded-[8px] z-10 relative" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                                        <div class="absolute inset-0 flex items-center justify-center hidden z-0"><span class="material-symbols-rounded text-[48px] \${ft.color}">\${ft.icon}</span></div>
                                    \`; 
                                    if (['mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext)) { 
                                        thumbnailHTML += \`<div class="absolute inset-0 flex items-center justify-center bg-black/30 rounded-[8px] z-20 pointer-events-none"><span class="material-symbols-rounded text-white drop-shadow-lg text-[32px]">play_circle</span></div>\`; 
                                    } 
                                }
                                html += \`<div onclick="openPreview('\${f.id}', '\${safeName}')" class="flex flex-col bg-[#1e1f20] hover:bg-[#282a2c] border border-transparent hover:border-[#444746] rounded-[12px] overflow-hidden cursor-pointer transition group"><div class="h-32 bg-[#131314] m-1.5 rounded-[8px] flex items-center justify-center relative">\${thumbnailHTML}</div><div class="px-3 pb-3 pt-1 flex justify-between items-center"><div class="flex flex-col overflow-hidden w-full"><div class="flex items-center mb-0.5"><span class="material-symbols-rounded filled \${ft.color} text-[16px] mr-2 shrink-0">\${ft.icon}</span><span class="text-[13px] font-medium text-[#e3e3e3] truncate">\${f.name}</span></div><span class="text-[11px] text-[#c4c7c5]">\${formatSize(f.size)} • \${formatDate(f.date)}</span></div><a href="/share/file/\${f.id}" download="\${f.name}" onclick="event.stopPropagation()" class="p-1 rounded-full hover:bg-white/10 transition ml-2"><span class="material-symbols-rounded text-[#c4c7c5]">download</span></a></div></div>\`; 
                            } 
                        }); 
                        html += '</div>'; 
                    }
                    container.innerHTML = html;
                } catch (err) { }
            }

            function openPreview(id, name) { 
                try { 
                    const ext = String(name).split('.').pop().toLowerCase(); 
                    const modal = document.getElementById('previewModal'); 
                    const content = document.getElementById('previewContent'); 
                    const downloadBtn = document.getElementById('downloadPreviewBtn'); 
                    const modalHeader = modal.querySelector('div:first-child');
                    
                    document.getElementById('previewFilename').textContent = name; 
                    downloadBtn.href = '/share/file/' + id; 
                    
                    content.innerHTML = '';
                    
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) { 
                        if(modalHeader) modalHeader.classList.remove('hidden');
                        content.className = "flex-1 flex items-center justify-center p-4 md:p-12 overflow-hidden relative mt-16 md:mt-0";
                        content.innerHTML = '<img src="/share/file/' + id + '" class="max-w-full max-h-full object-contain drop-shadow-2xl">'; 
                    } 
                    else if (['mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext)) { 
                        if(modalHeader) modalHeader.classList.add('hidden');
                        content.className = "flex-1 flex items-center justify-center w-full h-full p-0 m-0 bg-black";
                        RPlayer.init(content, '/share/file/' + id, name);
                    } 
                    else { 
                        if(modalHeader) modalHeader.classList.remove('hidden');
                        content.className = "flex-1 flex items-center justify-center p-4 md:p-12 overflow-hidden relative mt-16 md:mt-0";
                        content.innerHTML = \`<div class="flex flex-col items-center text-[#c4c7c5]"><span class="material-symbols-rounded text-[80px] mb-4">description</span><p class="mb-6">No preview available for this file type.</p><a href="/share/file/\${id}" class="px-8 py-3 bg-[#004a77] text-[#a8c7fa] rounded-full font-medium hover:bg-[#005a8f] transition shadow-lg flex items-center" download><span class="material-symbols-rounded mr-2">download</span> Download File</a></div>\`; 
                    } 
                    modal.classList.remove('hidden'); 
                    setTimeout(() => modal.classList.remove('opacity-0'), 50); 
                } catch(e) {} 
            }
            
            function closePreview() { 
                const modal = document.getElementById('previewModal'); 
                modal.classList.add('opacity-0'); 
                if (typeof RPlayer !== 'undefined') RPlayer.destroy();
                setTimeout(() => { 
                    modal.classList.add('hidden'); 
                    document.getElementById('previewContent').innerHTML = ''; 
                    const modalHeader = modal.querySelector('div:first-child');
                    if(modalHeader) modalHeader.classList.remove('hidden');
                }, 300); 
            }
        </script>
        </body></html>`;
        res.send(html);
    });
});

app.get('/share/download/zip/:share_id', async (req, res) => {
    serveProtectedContent(req, res, req.params.share_id, async (folder, type) => {
        if(type !== 'folder') return res.status(400).send("Not a folder");
        const safeName = folder.name.replace(/[^a-zA-Z0-9-_ \.]/g, '_');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Export.zip"`);
        const archive = archiver('zip', { zlib: { level: 5 } });
        archive.on('warning', err => { if (err.code !== 'ENOENT') console.warn(err); });
        archive.on('error', err => { if (!res.headersSent) res.status(500).end(); });
        archive.pipe(res);
        async function addFolderToArchive(folderId, currentPath) {
            const files = await app.locals.db.all(`SELECT * FROM files WHERE folder_id = ? AND is_public = 1 AND is_trash = 0`, [folderId]);
            for (let f of files) { try { await fs.access(path.join(FILES_DIR, f.stored_name)); archive.file(path.join(FILES_DIR, f.stored_name), { name: (currentPath ? currentPath + '/' : '') + f.original_name }); } catch(e) {} }
            const subfolders = await app.locals.db.all(`SELECT * FROM folders WHERE parent_id = ? AND is_public = 1 AND is_trash = 0`, [folderId]);
            for (let sub of subfolders) { const safeSubName = sub.name.replace(/[^a-zA-Z0-9-_ \.]/g, '_'); const newPath = (currentPath ? currentPath + '/' : '') + safeSubName; archive.append(null, { name: newPath + '/' }); await addFolderToArchive(sub.id, newPath); }
        }
        archive.append(null, { name: safeName + '/' });
        await addFolderToArchive(folder.id, safeName);
        await archive.finalize();
    });
});

async function startServer() {
    await ensureDirExists();
    app.locals.db = await initDB();
    app.listen(PORT, () => console.log(`🚀 R Cloud Engine running live on http://localhost:${PORT}`));
}
startServer();
