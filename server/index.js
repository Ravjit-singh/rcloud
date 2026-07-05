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
const JWT_SECRET = 'rcloud-super-secret-key-2026'; // In a real production app, this goes in a .env file!

const FILES_DIR = path.join(__dirname, 'files');
const WEB_DIR = path.join(__dirname, '../web');

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(WEB_DIR));

// --- DIRECTORY INITIALIZATION ---
async function ensureDirExists(dirPath) {
    try { await fs.access(dirPath); } 
    catch (error) { await fs.mkdir(dirPath, { recursive: true }); }
}

// --- AUTH MIDDLEWARE ---
// This acts as a bouncer. If you don't have a valid login cookie, you can't access your files.
function authenticateToken(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: "Access denied. Please log in." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });
        req.user = user; // Attach the user's ID and username to the request
        next();
    });
}

// --- MULTER: Storage Configuration ---
// We now give files a unique random name on the hard drive to prevent users from overwriting each other's files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, FILES_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname); 
    }
});
const upload = multer({ storage });


// ==========================================
//              USER AUTH ROUTES
// ==========================================

// 1. Register a new user
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await app.locals.db.run(
            `INSERT INTO users (username, password_hash) VALUES (?, ?)`, 
            [username, hashedPassword]
        );
        res.json({ success: true, message: "User registered successfully!" });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: "Username already exists" });
        } else {
            res.status(500).json({ error: "Database error" });
        }
    }
});

// 2. Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await app.locals.db.get(`SELECT * FROM users WHERE username = ?`, [username]);
        if (!user) return res.status(400).json({ error: "User not found" });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: "Invalid password" });

        // Generate the keycard (Token)
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

        // Give the token to the user as a secure, HTTP-only cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: false, // Set to true if using HTTPS in the future
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({ success: true, message: "Logged in successfully", username: user.username });
    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

// 3. Logout
app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true, message: "Logged out safely" });
});


// ==========================================
//          PROTECTED FILE ROUTES
// ==========================================

// 1. Get ONLY the logged-in user's files
app.get('/api/files', authenticateToken, async (req, res) => {
    try {
        // We now ask the database for the files, not the hard drive directly
        const files = await app.locals.db.all(
            `SELECT id, original_name as name, stored_name, size FROM files WHERE user_id = ?`, 
            [req.user.id]
        );
        res.json({ success: true, files: files });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch files from database" });
    }
});

// 2. Upload a file and link it to the user
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
        await app.locals.db.run(
            `INSERT INTO files (user_id, original_name, stored_name, size) VALUES (?, ?, ?, ?)`,
            [req.user.id, req.file.originalname, req.file.filename, req.file.size]
        );
        res.json({ success: true, message: "File securely encrypted into your vault" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save file record in database" });
    }
});

// 3. Delete a file
app.delete('/api/delete/:id', authenticateToken, async (req, res) => {
    try {
        // First, check if the file belongs to this user
        const fileRecord = await app.locals.db.get(
            `SELECT stored_name FROM files WHERE id = ? AND user_id = ?`, 
            [req.params.id, req.user.id]
        );

        if (!fileRecord) return res.status(404).json({ error: "File not found or unauthorized" });

        // Delete the physical file from the hard drive
        const targetPath = path.join(FILES_DIR, fileRecord.stored_name);
        await fs.unlink(targetPath);

        // Delete the record from the database
        await app.locals.db.run(`DELETE FROM files WHERE id = ?`, [req.params.id]);

        res.json({ success: true, message: "File permanently deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
            console.log(`🔒 Vault securely authenticated and tracking files.`);
        });
    } catch (err) {
        console.error("❌ Failed to start server:", err);
    }
}

startServer();
