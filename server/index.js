const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// The absolute path to our local storage folder
const STORAGE_DIR = path.join(__dirname, 'storage');
// The absolute path to our frontend UI folder
const WEB_DIR = path.join(__dirname, '../web');

app.use(cors());
app.use(express.json());

// --- HOST THE FRONTEND ---
// This tells Express to serve any files in the 'web' directory automatically
app.use(express.static(WEB_DIR));

// --- SECURITY: Path Traversal Prevention ---
function getSafePath(filename) {
    const safeSuffix = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
    const finalPath = path.join(STORAGE_DIR, safeSuffix);
    if (!finalPath.startsWith(STORAGE_DIR)) {
        throw new Error("Security Exception: Path Traversal Attempted");
    }
    return finalPath;
}

// --- MULTER: Storage Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, STORAGE_DIR);
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
        const files = await fs.readdir(STORAGE_DIR);
        const fileStats = await Promise.all(files.map(async (file) => {
            const stats = await fs.stat(path.join(STORAGE_DIR, file));
            return { name: file, size: stats.size, isDirectory: stats.isDirectory() };
        }));
        res.json({ success: true, files: fileStats });
    } catch (err) {
        res.status(500).json({ error: "Failed to read storage directory" });
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

// --- BOOT UP ---
app.listen(PORT, () => {
    console.log(`🚀 R Cloud Engine running live on http://localhost:${PORT}`);
    console.log(`📁 Storage directory: ${STORAGE_DIR}`);
    console.log(`🖥️  Frontend UI served at: http://localhost:${PORT}`);
});
