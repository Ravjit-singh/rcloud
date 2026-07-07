document.addEventListener('DOMContentLoaded', () => {
    
    document.getElementById('loginBtn').addEventListener('click', () => auth.handleLogin());
    document.getElementById('registerBtn').addEventListener('click', () => auth.handleRegister());
    document.getElementById('profileBtn').addEventListener('click', () => window.location.href = '/settings.html');

    const fileInput = document.getElementById('hiddenFileInput');
    const newBtn = document.getElementById('newBtn');
    const mobileNewBtn = document.getElementById('mobileNewBtn');
    const newMenu = document.getElementById('newMenu');
    const itemMenu = document.getElementById('itemMenu');
    const bulkMenu = document.getElementById('bulkMenu');
    const sortMenu = document.getElementById('sortMenu');
    const bulkMenuBtn = document.getElementById('bulkMenuBtn');
    const sortMenuTrigger = document.getElementById('sortMenuTrigger');

    function toggleMenu(e) {
        e.stopPropagation();
        if (itemMenu) itemMenu.classList.add('hidden');
        if (bulkMenu) bulkMenu.classList.add('hidden');
        if (sortMenu) sortMenu.classList.add('hidden');

        if (newMenu.classList.contains('hidden')) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.currentTarget.id === 'mobileNewBtn') {
                newMenu.style.top = `${rect.top - 110}px`; newMenu.style.left = `${rect.left - 130}px`;
            } else {
                newMenu.style.top = `${rect.bottom + 10}px`; newMenu.style.left = `${rect.left}px`;
            }
            newMenu.classList.remove('hidden');
        } else { newMenu.classList.add('hidden'); }
    }

    if (newBtn) newBtn.addEventListener('click', toggleMenu);
    if (mobileNewBtn) mobileNewBtn.addEventListener('click', toggleMenu);

    if (bulkMenuBtn) {
        bulkMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (newMenu) newMenu.classList.add('hidden');
            if (itemMenu) itemMenu.classList.add('hidden');
            if (sortMenu) sortMenu.classList.add('hidden');
            bulkMenu.classList.toggle('hidden');
        });
    }

    if (sortMenuTrigger) {
        sortMenuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (newMenu) newMenu.classList.add('hidden');
            if (itemMenu) itemMenu.classList.add('hidden');
            if (bulkMenu) bulkMenu.classList.add('hidden');
            if (!sortMenu.classList.contains('hidden')) { ui.setSort(state.sortBy, state.sortOrder === 'asc' ? 'desc' : 'asc'); }
            sortMenu.classList.toggle('hidden');
        });
    }

    document.getElementById('viewToggleBtn').addEventListener('click', () => {
        const newMode = state.viewMode === 'grid' ? 'list' : 'grid';
        state.viewMode = newMode;
        localStorage.setItem('rcloud_view', newMode);
        document.getElementById('viewToggleIcon').textContent = newMode === 'grid' ? 'view_list' : 'grid_view';
        ui.renderContent();
    });

    document.addEventListener('click', () => {
        if (newMenu) newMenu.classList.add('hidden');
        if (itemMenu) itemMenu.classList.add('hidden');
        if (bulkMenu) bulkMenu.classList.add('hidden');
        if (sortMenu) sortMenu.classList.add('hidden');
    });

    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    let searchTimeout;

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            if (query.length > 0) clearSearchBtn.classList.remove('hidden');
            else clearSearchBtn.classList.add('hidden');
            searchTimeout = setTimeout(() => {
                if (query.length > 0) ui.performSearch(query);
                else ui.loadDrive(true);
            }, 300);
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = ''; clearSearchBtn.classList.add('hidden'); ui.loadDrive(true);
        });
    }

    document.getElementById('menuUploadBtn').addEventListener('click', () => fileInput.click());

    // THE FIX: Refactored prompt into Custom Material Modal
    document.getElementById('menuFolderBtn').addEventListener('click', async () => {
        newMenu.classList.add('hidden');
        const folderName = await ui.promptModal("New Folder", "Enter folder name...", "", "Create a new folder in this directory.");
        if (folderName) {
            ui.showToast("Creating folder...", "create_new_folder", "text-md-accent");
            const res = await api.createFolder(folderName, state.currentFolderId);
            if (res.status === 200) { ui.showToast("Folder created!", "check_circle", "text-green-400"); ui.loadDrive(); } 
            else { ui.showToast("Failed to create folder", "error", "text-red-400"); }
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) { ui.uploadQueue(Array.from(e.target.files)); fileInput.value = ''; newMenu.classList.add('hidden'); }
    });

    document.getElementById('bulkZipBtn').addEventListener('click', async () => {
        if (state.selected.size === 0) return;
        ui.showToast("Compressing items...", "archive", "text-md-accent");
        const items = Array.from(state.selected.values());
        const success = await api.downloadZip(items);
        if (success) ui.showToast("Download started!", "check_circle", "text-green-400");
        else ui.showToast("Compression failed", "error", "text-red-400");
        ui.clearSelection();
    });

    document.getElementById('bulkMakePublicBtn').addEventListener('click', () => { ui.bulkToggleShare(true); bulkMenu.classList.add('hidden'); });
    document.getElementById('bulkMakePrivateBtn').addEventListener('click', () => { ui.bulkToggleShare(false); bulkMenu.classList.add('hidden'); });

    document.getElementById('menuItemTogglePublic').addEventListener('click', () => {
        const target = state.activeMenuTarget;
        if (target) ui.toggleShare(target.id, target.type, !target.isPublic, target.shareId);
        itemMenu.classList.add('hidden');
    });

    // THE FIX: Refactored prompt fallback into Custom Material Modal
    document.getElementById('menuItemCopyLink').addEventListener('click', async () => {
        const target = state.activeMenuTarget;
        if (target) {
            const link = `${window.location.origin}/share/${target.type}/${target.shareId}`;
            try {
                if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(link); ui.showToast("Link copied to clipboard!", "content_copy", "text-green-400"); } 
                else { throw new Error(); }
            } catch (err) { 
                await ui.promptModal("Link Ready", "", link, "Your public link is ready. Copy it below:");
            }
        }
        itemMenu.classList.add('hidden');
    });

    document.getElementById('menuItemToggleStar').addEventListener('click', async () => {
        const t = state.activeMenuTarget;
        if (t) { await api.toggleStar(t.id, t.type, !t.isStarred); ui.loadDrive(true); }
        itemMenu.classList.add('hidden');
    });

    document.getElementById('menuItemToggleTrash').addEventListener('click', async () => {
        const t = state.activeMenuTarget;
        if (t) { await api.toggleTrash(t.id, t.type, !t.isTrash); ui.loadDrive(true); }
        itemMenu.classList.add('hidden');
    });

    // THE FIX: Refactored confirm into Custom Material Modal
    document.getElementById('menuItemPermanentDelete').addEventListener('click', async () => {
        const t = state.activeMenuTarget;
        itemMenu.classList.add('hidden');
        if (t && await ui.confirmModal("Delete Forever", "Permanently delete this item? This cannot be undone.", true, "delete_forever")) { 
            if (t.type === 'folder') await api.deleteFolder(t.id); else await api.deleteFile(t.id); 
            ui.loadDrive(true); 
        }
    });

    document.getElementById('bulkCutBtn').addEventListener('click', () => { ui.setClipboard('cut', Array.from(state.selected.values())); bulkMenu.classList.add('hidden'); });
    document.getElementById('bulkCopyBtn').addEventListener('click', () => { ui.setClipboard('copy', Array.from(state.selected.values())); bulkMenu.classList.add('hidden'); });
    document.getElementById('menuItemCut').addEventListener('click', () => { if (state.activeMenuTarget) ui.setClipboard('cut', [state.activeMenuTarget]); itemMenu.classList.add('hidden'); });
    document.getElementById('menuItemCopy').addEventListener('click', () => { if (state.activeMenuTarget) ui.setClipboard('copy', [state.activeMenuTarget]); itemMenu.classList.add('hidden'); });

    document.getElementById('viewToggleIcon').textContent = state.viewMode === 'grid' ? 'view_list' : 'grid_view';
    ui.loadDrive();
});
