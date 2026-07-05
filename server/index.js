const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDB } = require('./db');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'rcloud-super-secret-key-2026';

const FILES_DIR = path.join(__dirname, 'files');
const WEB_DIR = path.join(__dirname, '../web');

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(WEB_DIR));

async function ensureDirExists(dirPath) {
    try { await fs.access(dirPath); }
    catch (error) { await fs.mkdir(dirPath, { recursive: true }); }
}

function authenticateToken(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: "Access denied. Please log in." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });
        req.user = user;
        next();
    });
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

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Required" });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await app.locals.db.run(`INSERT INTO users (username, password_hash) VALUES (?, ?)`, [username, hashedPassword]);
        res.json({ success: true, message: "Registered" });
    } catch (err) { res.status(400).json({ error: "Error" }); }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await app.locals.db.get(`SELECT * FROM users WHERE username = ?`, [username]);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(400).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('auth_token', token, { httpOnly: true, secure: false, sameSite: 'strict', maxAge: 24 * 60 * 60 * 1000 });
        res.json({ success: true, username: user.username });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true });
});

// ==========================================
//              DRIVE ROUTES
// ==========================================

// Now fetches the is_public status!
app.get(['/api/drive', '/api/drive/:folderId'], authenticateToken, async (req, res) => {
    const folderId = req.params.folderId || null;
    try {
        const folders = await app.locals.db.all(
            `SELECT id, name FROM folders WHERE user_id = ? AND parent_id ${folderId ? '= ?' : 'IS NULL'}`, 
            folderId ? [req.user.id, folderId] : [req.user.id]
        );
        const files = await app.locals.db.all(
            `SELECT id, original_name as name, size, is_public FROM files WHERE user_id = ? AND folder_id ${folderId ? '= ?' : 'IS NULL'}`, 
            folderId ? [req.user.id, folderId] : [req.user.id]
        );
        res.json({ success: true, folders, files, username: req.user.username });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/folders', authenticateToken, async (req, res) => {
    try {
        const result = await app.locals.db.run(`INSERT INTO folders (user_id, name, parent_id) VALUES (?, ?, ?)`, [req.user.id, req.body.name, req.body.parentId || null]);
        res.json({ success: true, folderId: result.lastID });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    const folderId = req.body.folderId && req.body.folderId !== 'null' ? req.body.folderId : null;
    try {
        await app.locals.db.run(`INSERT INTO files (user_id, folder_id, original_name, stored_name, size) VALUES (?, ?, ?, ?, ?)`, [req.user.id, folderId, req.file.originalname, req.file.filename, req.file.size]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.delete('/api/delete/:id', authenticateToken, async (req, res) => {
    try {
        const file = await app.locals.db.get(`SELECT stored_name FROM files WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
        if (!file) return res.status(404).json({ error: "Not found" });
        try { await fs.unlink(path.join(FILES_DIR, file.stored_name)); } catch (e) {}
        await app.locals.db.run(`DELETE FROM files WHERE id = ?`, [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.delete('/api/folders/:id', authenticateToken, async (req, res) => {
    try {
        async function getAllFiles(current) {
            let allFiles = await app.locals.db.all(`SELECT stored_name FROM files WHERE user_id = ? AND folder_id = ?`, [req.user.id, current]);
            const subfolders = await app.locals.db.all(`SELECT id FROM folders WHERE user_id = ? AND parent_id = ?`, [req.user.id, current]);
            for (let sub of subfolders) allFiles = allFiles.concat(await getAllFiles(sub.id));
            return allFiles;
        }
        async function deleteFolderTree(current) {
            const subfolders = await app.locals.db.all(`SELECT id FROM folders WHERE user_id = ? AND parent_id = ?`, [req.user.id, current]);
            for (let sub of subfolders) await deleteFolderTree(sub.id);
            await app.locals.db.run(`DELETE FROM files WHERE user_id = ? AND folder_id = ?`, [req.user.id, current]);
            await app.locals.db.run(`DELETE FROM folders WHERE user_id = ? AND id = ?`, [req.user.id, current]);
        }
        
        const filesToDelete = await getAllFiles(req.params.id);
        for (let file of filesToDelete) { try { await fs.unlink(path.join(FILES_DIR, file.stored_name)); } catch (e) {} }
        await deleteFolderTree(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ==========================================
//          PUBLIC SHARING ENGINE
// ==========================================

// Toggle the Public Link Switch (Requires Auth)
app.put('/api/share/:id', authenticateToken, async (req, res) => {
    try {
        await app.locals.db.run(`UPDATE files SET is_public = ? WHERE id = ? AND user_id = ?`, [req.body.isPublic ? 1 : 0, req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// The Public Share Link Endpoint (NO AUTH REQUIRED)
app.get('/share/:id', async (req, res) => {
    try {
        const fileRecord = await app.locals.db.get(`SELECT original_name, stored_name, is_public FROM files WHERE id = ?`, [req.params.id]);
        
        // Block access if it doesn't exist or is set to private
        if (!fileRecord || fileRecord.is_public !== 1) {
            return res.status(403).send("<h1>⛔ 403 Forbidden</h1><p>This file is private or does not exist.</p>");
        }
        
        res.sendFile(path.join(FILES_DIR, fileRecord.stored_name));
    } catch (err) { res.status(500).send("Server error"); }
});

app.get('/api/view/:id', authenticateToken, async (req, res) => {
    try {
        const fileRecord = await app.locals.db.get(`SELECT stored_name FROM files WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
        if (!fileRecord) return res.status(404).send("Not found");
        res.sendFile(path.join(FILES_DIR, fileRecord.stored_name));
    } catch (err) { res.status(500).send("Error"); }
});

app.get('/api/download/:id', authenticateToken, async (req, res) => {
    try {
        const fileRecord = await app.locals.db.get(`SELECT original_name, stored_name FROM files WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
        if (!fileRecord) return res.status(404).send("Not found");
        res.download(path.join(FILES_DIR, fileRecord.stored_name), fileRecord.original_name);
    } catch (err) { res.status(500).send("Error"); }
});

async function startServer() {
    await ensureDirExists(FILES_DIR);
    app.locals.db = await initDB();
    app.listen(PORT, () => console.log(`🚀 R Cloud Engine running live on http://localhost:${PORT}`));
}
startServer();
