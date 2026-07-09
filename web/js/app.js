document.addEventListener('DOMContentLoaded', () => {
    
    document.getElementById('loginBtn')?.addEventListener('click', () => auth.handleLogin());
    document.getElementById('registerBtn')?.addEventListener('click', () => auth.handleRegister());
    document.getElementById('profileBtn')?.addEventListener('click', () => window.location.href = '/settings.html');

    const fileInput = document.getElementById('hiddenFileInput');
    const folderInput = document.getElementById('hiddenFolderInput'); 
    const newBtn = document.getElementById('newBtn');
    const mobileNewBtn = document.getElementById('mobileNewBtn');
    const newMenu = document.getElementById('newMenu');
    const bulkMenu = document.getElementById('bulkMenu');
    const sortMenu = document.getElementById('sortMenu');
    const bulkMenuBtn = document.getElementById('bulkMenuBtn');
    const sortMenuTrigger = document.getElementById('sortMenuTrigger');

    function toggleMenu(e) {
        e.stopPropagation();
        ui.closeItemMenu();
        if (bulkMenu) bulkMenu.classList.add('hidden');
        if (sortMenu) sortMenu.classList.add('hidden');
        if (newMenu && newMenu.classList.contains('hidden')) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.currentTarget.id === 'mobileNewBtn') { newMenu.style.top = `${rect.top - 110}px`; newMenu.style.left = `${rect.left - 130}px`; } 
            else { newMenu.style.top = `${rect.bottom + 10}px`; newMenu.style.left = `${rect.left}px`; }
            newMenu.classList.remove('hidden');
        } else if (newMenu) { newMenu.classList.add('hidden'); }
    }

    newBtn?.addEventListener('click', toggleMenu);
    mobileNewBtn?.addEventListener('click', toggleMenu);

    bulkMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (newMenu) newMenu.classList.add('hidden'); 
        ui.closeItemMenu(); 
        if (sortMenu) sortMenu.classList.add('hidden');
        bulkMenu?.classList.toggle('hidden');
    });

    sortMenuTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (newMenu) newMenu.classList.add('hidden'); 
        ui.closeItemMenu(); 
        if (bulkMenu) bulkMenu.classList.add('hidden');
        if (sortMenu && !sortMenu.classList.contains('hidden')) { ui.setSort(state.sortBy, state.sortOrder === 'asc' ? 'desc' : 'asc'); }
        sortMenu?.classList.toggle('hidden');
    });

    document.getElementById('viewToggleBtn')?.addEventListener('click', () => {
        const newMode = state.viewMode === 'grid' ? 'list' : 'grid'; state.viewMode = newMode; localStorage.setItem('rcloud_view', newMode);
        const icon = document.getElementById('viewToggleIcon'); if (icon) icon.textContent = newMode === 'grid' ? 'view_list' : 'grid_view';
        ui.renderContent();
    });

    document.addEventListener('click', () => {
        if (newMenu) newMenu.classList.add('hidden'); 
        if (bulkMenu) bulkMenu.classList.add('hidden'); 
        if (sortMenu) sortMenu.classList.add('hidden');
        ui.closeItemMenu(); // The Global Fix
    });

    bulkMenu?.addEventListener('click', (e) => e.stopPropagation()); sortMenu?.addEventListener('click', (e) => e.stopPropagation()); newMenu?.addEventListener('click', (e) => e.stopPropagation());

    const searchInput = document.getElementById('searchInput'); const clearSearchBtn = document.getElementById('clearSearchBtn'); let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout); const query = e.target.value.trim();
        if (query.length > 0) clearSearchBtn?.classList.remove('hidden'); else clearSearchBtn?.classList.add('hidden');
        searchTimeout = setTimeout(() => { if (query.length > 0) ui.performSearch(query); else ui.loadDrive(true); }, 300);
    });

    clearSearchBtn?.addEventListener('click', () => { if(searchInput) searchInput.value = ''; clearSearchBtn.classList.add('hidden'); ui.loadDrive(true); });

    document.getElementById('menuUploadBtn')?.addEventListener('click', () => { if(newMenu) newMenu.classList.add('hidden'); fileInput?.click(); });
    
    document.getElementById('menuFolderUploadBtn')?.addEventListener('click', () => { if(newMenu) newMenu.classList.add('hidden'); folderInput?.click(); });

    document.getElementById('menuFolderBtn')?.addEventListener('click', async () => {
        if (newMenu) newMenu.classList.add('hidden');
        const folderName = await ui.promptModal("New Folder", "Enter folder name...", "", "Create a new folder in this directory.");
        if (folderName) {
            ui.showToast("Creating folder...", "create_new_folder", "text-md-accent");
            const res = await api.createFolder(folderName, state.currentFolderId);
            if (res.status === 200) { ui.showToast("Folder created!", "check_circle", "text-green-400"); ui.loadDrive(); } else { ui.showToast("Failed to create folder", "error", "text-red-400"); }
        }
    });
    
    fileInput?.addEventListener('change', (e) => { if (e.target.files.length > 0) { ui.uploadQueue(Array.from(e.target.files)); fileInput.value = ''; } });
    folderInput?.addEventListener('change', (e) => { if (e.target.files.length > 0) { ui.uploadQueue(Array.from(e.target.files)); folderInput.value = ''; } });

    document.getElementById('menuItemRename')?.addEventListener('click', async () => {
        const target = state.activeMenuTarget; ui.closeItemMenu(); 
        if (target) {
            const newName = await ui.promptModal("Rename Item", "Enter new name...", target.name, "Rename this file or folder.");
            if (newName && newName !== target.name) {
                ui.showToast("Renaming...", "edit", "text-md-accent"); const res = await api.renameItem(target.id, target.type, newName);
                if (res.status === 200) { ui.showToast("Renamed successfully!", "check_circle", "text-green-400"); ui.loadDrive(true); } else { ui.showToast("Failed to rename", "error", "text-red-400"); }
            }
        }
    });

    document.getElementById('bulkZipBtn')?.addEventListener('click', async () => {
        if (state.selected.size === 0) return;
        ui.showToast("Compressing items...", "archive", "text-md-accent"); const items = Array.from(state.selected.values()); const success = await api.downloadZip(items);
        if (success) ui.showToast("Download started!", "check_circle", "text-green-400"); else ui.showToast("Compression failed", "error", "text-red-400"); ui.clearSelection();
    });

    document.getElementById('bulkMakePublicBtn')?.addEventListener('click', () => { ui.bulkToggleShare(true); if(bulkMenu) bulkMenu.classList.add('hidden'); });
    document.getElementById('bulkMakePrivateBtn')?.addEventListener('click', () => { ui.bulkToggleShare(false); if(bulkMenu) bulkMenu.classList.add('hidden'); });

    document.getElementById('menuItemShare')?.addEventListener('click', () => {
        const target = state.activeMenuTarget; ui.closeItemMenu();
        if (target) ui.openShareModal(target.id, target.type, target.isPublic, target.shareId);
    });

    document.getElementById('menuItemCopyLink')?.addEventListener('click', async () => {
        const target = state.activeMenuTarget; ui.closeItemMenu();
        if (target) {
            const link = `${window.location.origin}/share/${target.type}/${target.shareId}`;
            try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(link); ui.showToast("Link copied to clipboard!", "content_copy", "text-green-400"); } else { throw new Error(); } } 
            catch (err) { await ui.promptModal("Link Ready", "", link, "Your public link is ready. Copy it below:"); }
        }
    });

    document.getElementById('menuItemToggleStar')?.addEventListener('click', async () => { const t = state.activeMenuTarget; if (t) { await api.toggleStar(t.id, t.type, !t.isStarred); ui.loadDrive(true); } ui.closeItemMenu(); });
    document.getElementById('menuItemToggleTrash')?.addEventListener('click', async () => { const t = state.activeMenuTarget; if (t) { await api.toggleTrash(t.id, t.type, !t.isTrash); ui.loadDrive(true); } ui.closeItemMenu(); });
    
    document.getElementById('menuItemPermanentDelete')?.addEventListener('click', async () => {
        const t = state.activeMenuTarget; ui.closeItemMenu();
        if (t && await ui.confirmModal("Delete Forever", "Permanently delete this item? This cannot be undone.", true, "delete_forever")) { if (t.type === 'folder') await api.deleteFolder(t.id); else await api.deleteFile(t.id); ui.loadDrive(true); }
    });

    document.getElementById('bulkCutBtn')?.addEventListener('click', () => { ui.setClipboard('cut', Array.from(state.selected.values())); if(bulkMenu) bulkMenu.classList.add('hidden'); });
    document.getElementById('bulkCopyBtn')?.addEventListener('click', () => { ui.setClipboard('copy', Array.from(state.selected.values())); if(bulkMenu) bulkMenu.classList.add('hidden'); });
    document.getElementById('menuItemCut')?.addEventListener('click', () => { if (state.activeMenuTarget) ui.setClipboard('cut', [state.activeMenuTarget]); ui.closeItemMenu(); });
    document.getElementById('menuItemCopy')?.addEventListener('click', () => { if (state.activeMenuTarget) ui.setClipboard('copy', [state.activeMenuTarget]); ui.closeItemMenu(); });

    // ==========================================
    //      NATIVE DRAG AND DROP ENGINE
    // ==========================================
    const dropZone = document.getElementById('dragDropOverlay');
    window.addEventListener('dragover', (e) => {
        e.preventDefault(); if (state.isFrozen) return;
        dropZone?.classList.remove('hidden'); setTimeout(() => dropZone?.classList.remove('opacity-0'), 10);
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (e.relatedTarget === null || e.target === dropZone) { dropZone?.classList.add('opacity-0'); setTimeout(() => dropZone?.classList.add('hidden'), 300); }
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone?.classList.add('opacity-0'); setTimeout(() => dropZone?.classList.add('hidden'), 300);
        if (state.isFrozen) return;
        if (e.dataTransfer && e.dataTransfer.files.length > 0) ui.uploadQueue(Array.from(e.dataTransfer.files));
    });

    const viewIcon = document.getElementById('viewToggleIcon'); if(viewIcon) viewIcon.textContent = state.viewMode === 'grid' ? 'view_list' : 'grid_view';
    if (typeof ui !== 'undefined' && typeof ui.loadDrive === 'function') { ui.loadDrive(); ui.updateStorage(); }
});
