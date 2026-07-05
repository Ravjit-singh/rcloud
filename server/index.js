const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDB } = require('./db'); 

const app = express();
const PORT = 3000;

// Re-routed to your new 'files' directory
const FILES_DIR = path.join(__dirname, 'files');
const WEB_DIR = path.join(__dirname, '../web');

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(WEB_DIR));

// --- DIRECTORY INITIALIZATION ---
// This ensures the server doesn't crash if the files folder is missing
async function ensureDirExists(dirPath) {
    try {
        await fs.access(dirPath);
    } catch (error) {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

// --- SECURITY: Path Traversal Prevention ---
function getSafePath(filename) {
    const safeSuffix = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
    const finalPath = path.join(FILES_DIR, safeSuffix);
    if (!finalPath.startsWith(FILES_DIR)) {
        throw new Error("Security Exception: Path Traversal Attempted");
    }
    return finalPath;
}

// --- MULTER: Storage Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, FILES_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});
const upload = multer({ storage });

// --- ROUTES ---

// 1. Get all files
app.get('/api/files', async (req, res) => {
    try {
        const files = await fs.readdir(FILES_DIR);
        const fileStats = await Promise.all(files.map(async (file) => {
            const stats = await fs.stat(path.join(FILES_DIR, file));
            return { name: file, size: stats.size, isDirectory: stats.isDirectory() };
        }));
        res.json({ success: true, files: fileStats });
    } catch (err) {
        res.status(500).json({ error: "Failed to read files directory" });
    }
});

// 2. Upload a file
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({ success: true, message: "File secured in R Cloud", filename: req.file.filename });
});

// 3. Move or Rename a file
app.post('/api/move', async (req, res) => {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) return res.status(400).json({ error: "Missing parameters" });

    try {
        const oldPath = getSafePath(oldName);
        const newPath = getSafePath(newName);
        await fs.rename(oldPath, newPath);
        res.json({ success: true, message: "File moved/renamed successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Delete a file
app.delete('/api/delete/:filename', async (req, res) => {
    try {
        const targetPath = getSafePath(req.params.filename);
        await fs.unlink(targetPath);
        res.json({ success: true, message: "File deleted" });
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
            console.log(`📁 Files directory: ${FILES_DIR}`);
        });
    } catch (err) {
        console.error("❌ Failed to start server:", err);
    }
}

startServer();
