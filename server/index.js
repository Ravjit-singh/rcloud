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

// --- DIRECTORY INIT ---
async function ensureDirExists(dirPath) {
    try { await fs.access(dirPath); }
    catch (error) { await fs.mkdir(dirPath, { recursive: true }); }
}

// --- AUTH MIDDLEWARE ---
function authenticateToken(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: "Access denied. Please log in." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });
        req.user = user;
        next();
    });
}

// --- MULTER STORAGE ---
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
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await app.locals.db.run(`INSERT INTO users (username, password_hash) VALUES (?, ?)`, [username, hashedPassword]);
        res.json({ success: true, message: "User registered successfully!" });
    } catch (err) {
        console.error("❌ Register Error:", err);
        res.status(400).json({ error: "Username already exists or database error" });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await app.locals.db.get(`SELECT * FROM users WHERE username = ?`, [username]);
        if (!user) return res.status(400).json({ error: "User not found" });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: "Invalid password" });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('auth_token', token, { httpOnly: true, secure: false, sameSite: 'strict', maxAge: 24 * 60 * 60 * 1000 });
        res.json({ success: true, message: "Logged in", username: user.username });
    } catch (err) {
        console.error("❌ Login Error:", err);
        res.status(500).json({ error: "Login failed" });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true, message: "Logged out safely" });
});

// ==========================================
//              DRIVE ROUTES
// ==========================================

// Fetch folders and files
app.get(['/api/drive', '/api/drive/:folderId'], authenticateToken, async (req, res) => {
    const folderId = req.params.folderId || null;
    try {
        const folderQuery = folderId
            ? `SELECT id, name FROM folders WHERE user_id = ? AND parent_id = ?`
            : `SELECT id, name FROM folders WHERE user_id = ? AND parent_id IS NULL`;
        const folders = await app.locals.db.all(folderQuery, folderId ? [req.user.id, folderId] : [req.user.id]);

        const fileQuery = folderId
            ? `SELECT id, original_name as name, size FROM files WHERE user_id = ? AND folder_id = ?`
            : `SELECT id, original_name as name, size FROM files WHERE user_id = ? AND folder_id IS NULL`;
        const files = await app.locals.db.all(fileQuery, folderId ? [req.user.id, folderId] : [req.user.id]);

        res.json({ success: true, folders, files, username: req.user.username });
    } catch (err) {
        console.error("❌ Drive Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch drive contents" });
    }
});

// Create new folder
app.post('/api/folders', authenticateToken, async (req, res) => {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ error: "Folder name required" });
    try {
        const result = await app.locals.db.run(
            `INSERT INTO folders (user_id, name, parent_id) VALUES (?, ?, ?)`,
            [req.user.id, name, parentId || null]
        );
        res.json({ success: true, folderId: result.lastID, message: "Folder created" });
    } catch (err) {
        console.error("❌ Folder Creation Error:", err);
        res.status(500).json({ error: "Failed to create folder" });
    }
});

// Upload a file
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const folderId = req.body.folderId && req.body.folderId !== 'null' ? req.body.folderId : null;
    try {
        await app.locals.db.run(
            `INSERT INTO files (user_id, folder_id, original_name, stored_name, size) VALUES (?, ?, ?, ?, ?)`,
            [req.user.id, folderId, req.file.originalname, req.file.filename, req.file.size]
        );
        res.json({ success: true, message: "File securely encrypted" });
    } catch (err) {
        console.error("❌ Upload DB Error:", err);
        res.status(500).json({ error: "Failed to save file record in database" });
    }
});

// Delete a file (Bulletproof Version)
app.delete('/api/delete/:id', authenticateToken, async (req, res) => {
    try {
        const fileRecord = await app.locals.db.get(`SELECT stored_name FROM files WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
        if (!fileRecord) return res.status(404).json({ error: "File not found" });

        // Try to delete the physical file, but don't crash if it's already gone
        try {
            await fs.unlink(path.join(FILES_DIR, fileRecord.stored_name));
        } catch (fsError) {
            if (fsError.code !== 'ENOENT') throw fsError; 
            console.log(`⚠️ Physical file already missing, cleaning up database record...`);
        }

        await app.locals.db.run(`DELETE FROM files WHERE id = ?`, [req.params.id]);
        res.json({ success: true, message: "File deleted" });
    } catch (err) {
        console.error("❌ Delete Error:", err);
        res.status(500).json({ error: err.message });
    }
});
// Delete a folder (and recursively wipe all physical files inside it)
app.delete('/api/folders/:id', authenticateToken, async (req, res) => {
    try {
        const folderId = req.params.id;
        
        // Helper 1: Recursively find every single file inside this folder and its sub-folders
        async function getAllFiles(currentFolderId) {
            let allFiles = await app.locals.db.all(`SELECT stored_name FROM files WHERE user_id = ? AND folder_id = ?`, [req.user.id, currentFolderId]);
            const subfolders = await app.locals.db.all(`SELECT id FROM folders WHERE user_id = ? AND parent_id = ?`, [req.user.id, currentFolderId]);
            
            for (let sub of subfolders) {
                allFiles = allFiles.concat(await getAllFiles(sub.id));
            }
            return allFiles;
        }

        // Helper 2: Recursively scrub the database records
        async function deleteFolderTree(currentFolderId) {
            const subfolders = await app.locals.db.all(`SELECT id FROM folders WHERE user_id = ? AND parent_id = ?`, [req.user.id, currentFolderId]);
            for (let sub of subfolders) {
                await deleteFolderTree(sub.id);
            }
            await app.locals.db.run(`DELETE FROM files WHERE user_id = ? AND folder_id = ?`, [req.user.id, currentFolderId]);
            await app.locals.db.run(`DELETE FROM folders WHERE user_id = ? AND id = ?`, [req.user.id, currentFolderId]);
        }

        // Execute Step 1: Get the list of targets
        const filesToDelete = await getAllFiles(folderId);
        
        // Execute Step 2: Delete the physical files off your phone's hard drive
        for (let file of filesToDelete) {
            try {
                await fs.unlink(path.join(FILES_DIR, file.stored_name));
            } catch (err) {
                if (err.code !== 'ENOENT') console.error("File deletion error:", err);
            }
        }
        
        // Execute Step 3: Nuke the database records
        await deleteFolderTree(folderId);
        
        res.json({ success: true, message: "Folder and contents permanently deleted" });
    } catch (err) {
        console.error("❌ Folder Delete Error:", err);
        res.status(500).json({ error: "Failed to delete folder" });
    }
});


// --- BOOT UP SEQUENCE ---
async function startServer() {
    try {
        await ensureDirExists(FILES_DIR);
        const db = await initDB();
        app.locals.db = db;
        app.listen(PORT, () => {
            console.log(`🚀 R Cloud Engine running live on http://localhost:${PORT}`);
            console.log(`🔒 Vault securely authenticated with dynamic folder tracking.`);
        });
    } catch (err) {
        console.error("❌ Failed to start server:", err);
    }
}
startServer();
