const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ZipArchive } = require('archiver'); // THE FIX: Import the new class
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

app.put('/api/password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const user = await app.locals.db.get(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
        if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) return res.status(400).json({ error: "Incorrect current password" });
        const hashedNew = await bcrypt.hash(newPassword, 10);
        await app.locals.db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [hashedNew, req.user.id]);
        res.json({ success: true, message: "Password updated successfully" });
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

// ==========================================
//              DRIVE ROUTES
// ==========================================
app.get(['/api/drive', '/api/drive/:folderId'], authenticateToken, async (req, res) => {
    const folderId = req.params.folderId || null;
    try {
        const folders = await app.locals.db.all(`SELECT id, name, is_public, share_id, created_at as date FROM folders WHERE user_id = ? AND parent_id ${folderId ? '= ?' : 'IS NULL'}`, folderId ? [req.user.id, folderId] : [req.user.id]);
        const files = await app.locals.db.all(`SELECT id, original_name as name, size, is_public, share_id, upload_date as date FROM files WHERE user_id = ? AND folder_id ${folderId ? '= ?' : 'IS NULL'}`, folderId ? [req.user.id, folderId] : [req.user.id]);
        res.json({ success: true, folders, files, username: req.user.username });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.get('/api/search', authenticateToken, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json({ success: true, folders: [], files: [] });
    try {
        const folders = await app.locals.db.all(`SELECT id, name, is_public, share_id, created_at as date FROM folders WHERE user_id = ? AND name LIKE ?`, [req.user.id, `%${q}%`]);
        const files = await app.locals.db.all(`SELECT id, original_name as name, size, is_public, share_id, upload_date as date FROM files WHERE user_id = ? AND original_name LIKE ?`, [req.user.id, `%${q}%`]);
        res.json({ success: true, folders, files, username: req.user.username });
    } catch (err) { res.status(500).json({ error: "Failed to search" }); }
});

app.post('/api/folders', authenticateToken, async (req, res) => {
    try {
        const shareId = crypto.randomBytes(8).toString('hex');
        const result = await app.locals.db.run(`INSERT INTO folders (user_id, name, parent_id, share_id) VALUES (?, ?, ?, ?)`, [req.user.id, req.body.name, req.body.parentId || null, shareId]);
        res.json({ success: true, folderId: result.lastID });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    const folderId = req.body.folderId && req.body.folderId !== 'null' ? req.body.folderId : null;
    try {
        const shareId = crypto.randomBytes(8).toString('hex');
        await app.locals.db.run(`INSERT INTO files (user_id, folder_id, original_name, stored_name, size, share_id) VALUES (?, ?, ?, ?, ?, ?)`, [req.user.id, folderId, req.file.originalname, req.file.filename, req.file.size, shareId]);
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
//      ZIP ENGINE & CLIPBOARD (COPY/MOVE)
// ==========================================

// RECURSIVE PRIVATE ZIP EXPORTER
app.post('/api/download/zip', authenticateToken, async (req, res) => {
    const { items } = req.body;
    if (!items || items.length === 0) return res.status(400).send("No items selected");

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="RCloud_Export_${Date.now()}.zip"`);
    
    const archive = new ZipArchive({ zlib: { level: 5 } }); // THE FIX: Instantiate the class
    
    // THE FIX: Ignore missing files instead of crashing the Node process
    archive.on('warning', err => { if (err.code !== 'ENOENT') console.warn(err); });
    archive.on('error', err => { console.error('ZIP Error:', err); if (!res.headersSent) res.status(500).end(); });
    
    archive.pipe(res);

    async function addFolderToArchive(folderId, currentPath) {
        const files = await app.locals.db.all(`SELECT * FROM files WHERE folder_id = ? AND user_id = ?`, [folderId, req.user.id]);
        for (let f of files) {
            try {
                await fs.access(path.join(FILES_DIR, f.stored_name)); // Safely verify file exists first!
                archive.file(path.join(FILES_DIR, f.stored_name), { name: (currentPath ? currentPath + '/' : '') + f.original_name });
            } catch(e) {} // Silently skip missing files
        }
        
        const subfolders = await app.locals.db.all(`SELECT * FROM folders WHERE parent_id = ? AND user_id = ?`, [folderId, req.user.id]);
        for (let sub of subfolders) {
            const safeName = sub.name.replace(/[^a-zA-Z0-9-_ \.]/g, '_');
            const newPath = (currentPath ? currentPath + '/' : '') + safeName;
            archive.append(null, { name: newPath + '/' });
            await addFolderToArchive(sub.id, newPath);
        }
    }

    try {
        for (let item of items) {
            if (item.type === 'file') {
                const f = await app.locals.db.get(`SELECT * FROM files WHERE id = ? AND user_id = ?`, [item.id, req.user.id]);
                if (f) {
                    try {
                        await fs.access(path.join(FILES_DIR, f.stored_name));
                        archive.file(path.join(FILES_DIR, f.stored_name), { name: f.original_name });
                    } catch(e) {}
                }
            } else if (item.type === 'folder') {
                const folder = await app.locals.db.get(`SELECT * FROM folders WHERE id = ? AND user_id = ?`, [item.id, req.user.id]);
                if (folder) {
                    const safeName = folder.name.replace(/[^a-zA-Z0-9-_ \.]/g, '_');
                    archive.append(null, { name: safeName + '/' });
                    await addFolderToArchive(item.id, safeName);
                }
            }
        }
        await archive.finalize();
    } catch (err) { 
        console.error("ZIP Export Error:", err); 
        if (!res.headersSent) res.status(500).end(); 
    }
});

app.post('/api/copy', authenticateToken, async (req, res) => {
    const { targetFolder, items } = req.body;
    try {
        async function copyFolder(folderId, newParentId) {
            const folder = await app.locals.db.get(`SELECT * FROM folders WHERE id = ? AND user_id = ?`, [folderId, req.user.id]);
            if (!folder) return;
            const subfolders = await app.locals.db.all(`SELECT id FROM folders WHERE parent_id = ? AND user_id = ?`, [folderId, req.user.id]);
            const shareId = crypto.randomBytes(8).toString('hex');
            const result = await app.locals.db.run(`INSERT INTO folders (user_id, name, parent_id, is_public, share_id) VALUES (?, ?, ?, 0, ?)`, [req.user.id, folder.name + " (Copy)", newParentId, shareId]);
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
            await app.locals.db.run(`INSERT INTO files (user_id, folder_id, original_name, stored_name, size, is_public, share_id) VALUES (?, ?, ?, ?, ?, 0, ?)`, [req.user.id, newFolderId, newOriginalName, newStoredName, f.size, shareId]);
        }
        for (let item of items) {
            if (item.type === 'file') {
                const f = await app.locals.db.get(`SELECT * FROM files WHERE id = ? AND user_id = ?`, [item.id, req.user.id]);
                if (f) await copyFile(f, targetFolder);
            } else if (item.type === 'folder') { await copyFolder(item.id, targetFolder); }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to copy" }); }
});

app.put('/api/move', authenticateToken, async (req, res) => {
    const { targetFolder, items } = req.body;
    try {
        for (let item of items) {
            if (item.type === 'file') { await app.locals.db.run(`UPDATE files SET folder_id = ? WHERE id = ? AND user_id = ?`, [targetFolder, item.id, req.user.id]); } 
            else if (item.type === 'folder') {
                if (targetFolder === item.id || targetFolder === String(item.id)) continue;
                await app.locals.db.run(`UPDATE folders SET parent_id = ? WHERE id = ? AND user_id = ?`, [targetFolder, item.id, req.user.id]);
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ==========================================
//          PUBLIC SHARING ENGINE
// ==========================================
app.put('/api/share/:type/:id', authenticateToken, async (req, res) => {
    try {
        const { type, id } = req.params;
        const isPublic = req.body.isPublic ? 1 : 0;
        if (type === 'file') { await app.locals.db.run(`UPDATE files SET is_public = ? WHERE id = ? AND user_id = ?`, [isPublic, id, req.user.id]); } 
        else if (type === 'folder') {
            async function setFolderPublicStatus(currentFolderId) {
                await app.locals.db.run(`UPDATE folders SET is_public = ? WHERE id = ? AND user_id = ?`, [isPublic, currentFolderId, req.user.id]);
                await app.locals.db.run(`UPDATE files SET is_public = ? WHERE folder_id = ? AND user_id = ?`, [isPublic, currentFolderId, req.user.id]);
                const subfolders = await app.locals.db.all(`SELECT id FROM folders WHERE parent_id = ? AND user_id = ?`, [currentFolderId, req.user.id]);
                for (let sub of subfolders) await setFolderPublicStatus(sub.id);
            }
            await setFolderPublicStatus(id);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.get('/share/file/:share_id', async (req, res) => {
    try {
        const fileRecord = await app.locals.db.get(`SELECT stored_name, is_public FROM files WHERE share_id = ?`, [req.params.share_id]);
        if (!fileRecord || fileRecord.is_public !== 1) return res.status(403).send("<h1>⛔ 403 Forbidden</h1><p>This file is private.</p>");
        res.sendFile(path.join(FILES_DIR, fileRecord.stored_name));
    } catch (err) { res.status(500).send("Server error"); }
});

// PUBLIC FOLDER VIEWER
app.get('/share/folder/:share_id', async (req, res) => {
    try {
        const folder = await app.locals.db.get(`SELECT id, name, is_public FROM folders WHERE share_id = ?`, [req.params.share_id]);
        if (!folder || folder.is_public !== 1) return res.status(403).send("<h1>⛔ 403 Forbidden</h1><p>This folder is private.</p>");

        const folders = await app.locals.db.all(`SELECT share_id as id, name, created_at as date FROM folders WHERE parent_id = ? AND is_public = 1`, [folder.id]);
        const files = await app.locals.db.all(`SELECT share_id as id, original_name as name, size, upload_date as date FROM files WHERE folder_id = ? AND is_public = 1`, [folder.id]);

        let html = `
        <!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${folder.name} - Public Drive</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0" />
        <style> .material-symbols-rounded { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; } .material-symbols-rounded.filled { font-variation-settings: 'FILL' 1; } </style>
        </head>
        <body class="bg-[#131314] text-[#e3e3e3] p-4 md:p-8 font-sans h-screen flex flex-col">
            <div class="max-w-6xl mx-auto w-full flex-1 flex flex-col">
                
                <div class="flex flex-col md:flex-row md:items-center justify-between mb-6">
                    <div class="flex items-center mb-4 md:mb-0">
                        <button onclick="history.back()" class="p-2 mr-2 rounded-full hover:bg-white/10 transition flex items-center justify-center"><span class="material-symbols-rounded">arrow_back</span></button>
                        <span class="material-symbols-rounded filled text-[#a8c7fa] text-3xl mr-3">folder_shared</span>
                        <h1 class="text-2xl md:text-3xl font-medium truncate">${folder.name}</h1>
                    </div>
                    <div class="flex items-center space-x-2">
                        <a href="/share/download/zip/${req.params.share_id}" class="bg-[#a8c7fa] text-[#001d35] font-medium px-4 py-2 rounded-full hover:bg-[#c2e7ff] transition flex items-center shadow-sm">
                            <span class="material-symbols-rounded mr-2 text-[20px]">archive</span> Download All
                        </a>
                        <div class="relative">
                            <button id="pubSortBtn" onclick="document.getElementById('pubSortMenu').classList.toggle('hidden')" class="p-2 rounded-full text-[#c4c7c5] hover:bg-white/10 transition flex items-center justify-center">
                                <span class="material-symbols-rounded">sort</span>
                            </button>
                            <div id="pubSortMenu" class="hidden absolute top-12 right-0 bg-[#1e1f20] border border-[#444746] rounded-[12px] shadow-2xl py-2 w-40 z-50">
                                <button onclick="setSort('name')" class="w-full text-left px-4 py-2 text-[14px] text-[#e3e3e3] hover:bg-[#282a2c]">Name</button>
                                <button onclick="setSort('date')" class="w-full text-left px-4 py-2 text-[14px] text-[#e3e3e3] hover:bg-[#282a2c]">Date</button>
                                <button onclick="setSort('size')" class="w-full text-left px-4 py-2 text-[14px] text-[#e3e3e3] hover:bg-[#282a2c]">Size</button>
                            </div>
                        </div>
                        <button id="pubViewBtn" onclick="toggleView()" class="p-2 rounded-full text-[#c4c7c5] hover:bg-white/10 transition flex items-center justify-center">
                            <span class="material-symbols-rounded" id="pubViewIcon">view_list</span>
                        </button>
                    </div>
                </div>
                
                <div class="flex-1 overflow-y-auto pb-10" id="publicContainer"></div>
            </div>

            <div id="previewModal" class="hidden fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col transition-opacity duration-300 opacity-0"><div class="flex items-center justify-between p-4 text-[#e3e3e3] bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full z-10"><div class="flex items-center space-x-4"><button onclick="closePreview()" class="p-2 rounded-full hover:bg-white/10 transition flex items-center justify-center"><span class="material-symbols-rounded">arrow_back</span></button><span id="previewFilename" class="font-medium text-[16px] truncate max-w-[200px] md:max-w-md"></span></div><div class="flex items-center space-x-2"><a id="downloadPreviewBtn" class="p-2 rounded-full hover:bg-white/10 transition flex items-center justify-center" title="Download" download><span class="material-symbols-rounded">download</span></a></div></div><div id="previewContent" class="flex-1 flex items-center justify-center p-4 md:p-12 overflow-hidden relative mt-16 md:mt-0"></div></div>
            
            <script>
                let rawFolders = ${JSON.stringify(folders)};
                let rawFiles = ${JSON.stringify(files)};
                
                let viewMode = localStorage.getItem('rcloud_pub_view') || 'grid';
                let sortBy = localStorage.getItem('rcloud_pub_sort') || 'name';
                let sortOrder = localStorage.getItem('rcloud_pub_sortOrder') || 'asc';

                document.getElementById('pubViewIcon').textContent = viewMode === 'grid' ? 'view_list' : 'grid_view';

                function formatSize(b) { if (!b) return '--'; const k=1024, s=['B','KB','MB','GB'], i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i]; }
                function formatDate(d) { if (!d) return '--'; return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
                
                function getFileIcon(name) {
                    const ext = name.split('.').pop().toLowerCase();
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { icon: 'image', color: 'text-[#a8c7fa]' };
                    if (['pdf'].includes(ext)) return { icon: 'picture_as_pdf', color: 'text-red-400' };
                    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return { icon: 'movie', color: 'text-purple-400' };
                    if (['zip', 'rar', 'apk'].includes(ext)) return { icon: 'folder_zip', color: 'text-yellow-500' };
                    return { icon: 'description', color: 'text-blue-400' };
                }

                function toggleView() {
                    viewMode = viewMode === 'grid' ? 'list' : 'grid';
                    localStorage.setItem('rcloud_pub_view', viewMode);
                    document.getElementById('pubViewIcon').textContent = viewMode === 'grid' ? 'view_list' : 'grid_view';
                    render();
                }

                function setSort(by) {
                    if (sortBy === by) sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                    else { sortBy = by; sortOrder = 'asc'; }
                    localStorage.setItem('rcloud_pub_sort', sortBy); localStorage.setItem('rcloud_pub_sortOrder', sortOrder);
                    document.getElementById('pubSortMenu').classList.add('hidden');
                    render();
                }

                function sortData(arr) {
                    return arr.sort((a, b) => {
                        let vA, vB;
                        if (sortBy === 'name') { vA = a.name.toLowerCase(); vB = b.name.toLowerCase(); }
                        else if (sortBy === 'date') { vA = new Date(a.date).getTime()||0; vB = new Date(b.date).getTime()||0; }
                        else if (sortBy === 'size') { vA = a.size||0; vB = b.size||0; }
                        if (vA < vB) return sortOrder === 'asc' ? -1 : 1;
                        if (vA > vB) return sortOrder === 'asc' ? 1 : -1; return 0;
                    });
                }

                function render() {
                    const container = document.getElementById('publicContainer');
                    const sortedFolders = sortData([...rawFolders]);
                    const sortedFiles = sortData([...rawFiles]);
                    
                    if (sortedFolders.length === 0 && sortedFiles.length === 0) {
                        container.innerHTML = '<p class="text-[#c4c7c5] mt-4">This folder is empty.</p>'; return;
                    }

                    let html = '';
                    const isList = viewMode === 'list';
                    const gridClass = isList ? 'flex flex-col mb-8' : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-8';
                    const fileGridClass = isList ? 'flex flex-col' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';

                    if (sortedFolders.length > 0) {
                        html += '<h3 class="text-[14px] font-medium text-[#e3e3e3] mb-3 mt-4">Folders</h3><div class="' + gridClass + '">';
                        sortedFolders.forEach(f => {
                            if (isList) {
                                html += \`<a href="/share/folder/\${f.id}" class="flex items-center justify-between p-3 border-b border-[#444746] bg-[#1e1f20] hover:bg-[#282a2c] transition group">
                                    <div class="flex items-center flex-1 overflow-hidden"><span class="material-symbols-rounded filled text-[#c4c7c5] text-[24px] mr-4">folder</span><span class="text-[14px] font-medium text-[#e3e3e3] truncate">\${f.name}</span></div>
                                    <div class="w-32 hidden md:block text-[#c4c7c5] text-[13px]">\${formatDate(f.date)}</div>
                                    <div class="w-20 hidden md:block text-[#c4c7c5] text-[13px]">--</div>
                                </a>\`;
                            } else {
                                html += \`<a href="/share/folder/\${f.id}" class="flex items-center bg-[#1e1f20] hover:bg-[#282a2c] rounded-[16px] py-3.5 px-4 transition border border-transparent hover:border-[#444746] group">
                                    <span class="material-symbols-rounded filled text-[#c4c7c5] text-[28px] mr-4">folder</span>
                                    <div class="flex flex-col overflow-hidden"><span class="text-[15px] font-medium text-[#e3e3e3] truncate">\${f.name}</span><span class="text-[11px] text-[#c4c7c5] mt-0.5">\${formatDate(f.date)}</span></div>
                                </a>\`;
                            }
                        });
                        html += '</div>';
                    }

                    if (sortedFiles.length > 0) {
                        html += '<h3 class="text-[14px] font-medium text-[#e3e3e3] mb-3 mt-4">Files</h3><div class="' + fileGridClass + '">';
                        sortedFiles.forEach(f => {
                            const ft = getFileIcon(f.name);
                            if (isList) {
                                html += \`<div onclick="openPreview('\${f.id}', '\${f.name.replace(/'/g, "\\\\'")}')" class="flex items-center justify-between p-3 border-b border-[#444746] bg-[#1e1f20] hover:bg-[#282a2c] transition cursor-pointer group">
                                    <div class="flex items-center flex-1 overflow-hidden"><span class="material-symbols-rounded filled \${ft.color} text-[24px] mr-4">\${ft.icon}</span><span class="text-[14px] font-medium text-[#e3e3e3] truncate">\${f.name}</span></div>
                                    <div class="w-32 hidden md:block text-[#c4c7c5] text-[13px]">\${formatDate(f.date)}</div>
                                    <div class="w-20 hidden md:block text-[#c4c7c5] text-[13px]">\${formatSize(f.size)}</div>
                                    <a href="/share/file/\${f.id}" download="\${f.name}" onclick="event.stopPropagation()" class="p-2 rounded-full hover:bg-white/10 transition ml-4"><span class="material-symbols-rounded text-[#c4c7c5]">download</span></a>
                                </div>\`;
                            } else {
                                html += \`<div onclick="openPreview('\${f.id}', '\${f.name.replace(/'/g, "\\\\'")}')" class="flex flex-col bg-[#1e1f20] hover:bg-[#282a2c] border border-transparent hover:border-[#444746] rounded-[12px] overflow-hidden cursor-pointer transition group">
                                    <div class="h-32 bg-[#131314] m-1.5 rounded-[8px] flex items-center justify-center"><span class="material-symbols-rounded text-[48px] \${ft.color}">\${ft.icon}</span></div>
                                    <div class="px-3 pb-3 pt-1 flex justify-between items-center">
                                        <div class="flex flex-col overflow-hidden w-full"><div class="flex items-center mb-0.5"><span class="material-symbols-rounded filled \${ft.color} text-[16px] mr-2 shrink-0">\${ft.icon}</span><span class="text-[13px] font-medium text-[#e3e3e3] truncate">\${f.name}</span></div><span class="text-[11px] text-[#c4c7c5]">\${formatSize(f.size)} • \${formatDate(f.date)}</span></div>
                                        <a href="/share/file/\${f.id}" download="\${f.name}" onclick="event.stopPropagation()" class="p-1 rounded-full hover:bg-white/10 transition ml-2"><span class="material-symbols-rounded text-[#c4c7c5]">download</span></a>
                                    </div>
                                </div>\`;
                            }
                        });
                        html += '</div>';
                    }
                    container.innerHTML = html;
                }
                
                render();

                function openPreview(id, name) {
                    const ext = name.split('.').pop().toLowerCase();
                    const modal = document.getElementById('previewModal'); const content = document.getElementById('previewContent'); const downloadBtn = document.getElementById('downloadPreviewBtn');
                    document.getElementById('previewFilename').textContent = name; downloadBtn.href = '/share/file/' + id; 
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) { content.innerHTML = '<img src="/share/file/' + id + '" class="max-w-full max-h-full object-contain drop-shadow-2xl">'; } 
                    else if (['mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext)) { content.innerHTML = '<video src="/share/file/' + id + '" controls autoplay class="max-w-full max-h-full object-contain drop-shadow-2xl outline-none rounded-md bg-black"></video>'; } 
                    else { content.innerHTML = \`<div class="flex flex-col items-center text-[#c4c7c5]"><span class="material-symbols-rounded text-[80px] mb-4">description</span><p class="mb-6">No preview available for this file type.</p><a href="/share/file/\${id}" class="px-8 py-3 bg-[#004a77] text-[#a8c7fa] rounded-full font-medium hover:bg-[#005a8f] transition shadow-lg flex items-center" download><span class="material-symbols-rounded mr-2">download</span> Download File</a></div>\`; }
                    modal.classList.remove('hidden'); setTimeout(() => modal.classList.remove('opacity-0'), 50);
                }
                function closePreview() { const modal = document.getElementById('previewModal'); modal.classList.add('opacity-0'); setTimeout(() => { modal.classList.add('hidden'); document.getElementById('previewContent').innerHTML = ''; }, 300); }
            </script>
        </body></html>
        `;
        res.send(html);
    } catch (err) { res.status(500).send("Server error"); }
});

// PUBLIC BULK ZIP EXPORTER (CRASH PROOF)
app.get('/share/download/zip/:share_id', async (req, res) => {
    try {
        const folder = await app.locals.db.get(`SELECT id, name, is_public FROM folders WHERE share_id = ?`, [req.params.share_id]);
        if (!folder || folder.is_public !== 1) return res.status(403).send("Forbidden");

        // THE FIX: Clean dangerous characters to prevent HTTP Header parsing crashes!
        const safeName = folder.name.replace(/[^a-zA-Z0-9-_ \.]/g, '_');

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Export.zip"`);
        
        const archive = new ZipArchive({ zlib: { level: 5 } }); // THE FIX: Instantiate the class
        
        // THE FIX: Prevent missing files from throwing Unhandled Promise Rejections and dropping the stream
        archive.on('warning', err => { if (err.code !== 'ENOENT') console.warn(err); });
        archive.on('error', err => { console.error('ZIP Error:', err); if (!res.headersSent) res.status(500).end(); });
        
        archive.pipe(res);

        async function addFolderToArchive(folderId, currentPath) {
            const files = await app.locals.db.all(`SELECT * FROM files WHERE folder_id = ? AND is_public = 1`, [folderId]);
            for (let f of files) {
                try {
                    await fs.access(path.join(FILES_DIR, f.stored_name)); // THE FIX: Safely verify file exists first!
                    archive.file(path.join(FILES_DIR, f.stored_name), { name: (currentPath ? currentPath + '/' : '') + f.original_name });
                } catch(e) {} // Silently skip missing files
            }
            
            const subfolders = await app.locals.db.all(`SELECT * FROM folders WHERE parent_id = ? AND is_public = 1`, [folderId]);
            for (let sub of subfolders) {
                const safeSubName = sub.name.replace(/[^a-zA-Z0-9-_ \.]/g, '_');
                const newPath = (currentPath ? currentPath + '/' : '') + safeSubName;
                archive.append(null, { name: newPath + '/' });
                await addFolderToArchive(sub.id, newPath);
            }
        }
        
        // THE FIX: Add the root folder itself so the archive is never completely empty
        archive.append(null, { name: safeName + '/' });
        await addFolderToArchive(folder.id, safeName);
        
        await archive.finalize();
    } catch (err) { 
        console.error("ZIP Export Error:", err); 
        if (!res.headersSent) res.status(500).end(); 
    }
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