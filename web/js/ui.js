const ui = {
    foldersGrid: document.getElementById('foldersGrid'),
    filesGrid: document.getElementById('filesGrid'),
    toastTimer: null,
    currentFiles: [], 
    previewIndex: 0,
    
    // Memory Pointers for the Pinch-to-Zoom Engine
    _imgTouchStart: null,
    _imgTouchMove: null,
    _imgTouchEnd: null,

    toggleSidebar(forceClose = false) {
        const sidebar = document.getElementById('mainSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (!sidebar || !overlay) return;
        const isClosed = sidebar.classList.contains('-translate-x-full');
        if (isClosed && !forceClose) {
            sidebar.classList.remove('-translate-x-full'); overlay.classList.remove('hidden'); setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        } else {
            sidebar.classList.add('-translate-x-full'); overlay.classList.add('opacity-0'); setTimeout(() => overlay.classList.add('hidden'), 300);
        }
    },

    async updateStorage() {
        const res = await api.getStorage();
        if (res.status === 200) {
            const { used, limit } = res.data;
            const percentage = Math.min((used / limit) * 100, 100);
            const bar = document.getElementById('storageProgressBar');
            const txt = document.getElementById('storageText');
            if (bar) bar.style.width = percentage + '%';
            if (txt) txt.textContent = `${this.formatSize(used)} / ${this.formatSize(limit)} Used`;
        }
    },
    
    showToast(message, icon = 'info', color = 'text-md-accent') {
        const toast = document.getElementById('toast');
        const toastIcon = document.getElementById('toastIcon');
        if(!toast || !toastIcon) return;
        document.getElementById('toastMessage').textContent = message;
        toastIcon.textContent = icon;
        toastIcon.className = `material-symbols-rounded mr-3 ${color}`;
        toast.classList.remove('opacity-0', 'translate-y-4');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.add('opacity-0', 'translate-y-4'), 3000);
    },

    confirmModal(title, message, isDestructive = true, icon = 'warning') {
        return new Promise((resolve) => {
            const modal = document.getElementById('customConfirmModal');
            const box = document.getElementById('confirmBox');
            if(!modal || !box) return resolve(false);
            document.getElementById('confirmModalTitle').textContent = title;
            document.getElementById('confirmModalDesc').textContent = message;
            const iconEl = document.getElementById('confirmModalIcon');
            iconEl.textContent = icon; iconEl.className = `material-symbols-rounded text-[32px] mr-3 ${isDestructive ? 'text-red-400' : 'text-md-accent'}`;
            const submitBtn = document.getElementById('confirmModalSubmitBtn');
            submitBtn.className = isDestructive ? "bg-red-400 text-black font-medium px-6 py-2.5 rounded-full hover:bg-red-500 transition-all active:scale-95 shadow-sm" : "bg-md-accent text-[#001d35] font-medium px-6 py-2.5 rounded-full hover:bg-[#c2e7ff] transition-all active:scale-95 shadow-sm";
            
            modal.classList.remove('hidden'); 
            setTimeout(() => { modal.classList.remove('opacity-0'); box.classList.remove('scale-95'); box.classList.add('scale-100'); }, 10);
            
            const cleanup = () => { box.classList.remove('scale-100'); box.classList.add('scale-95'); modal.classList.add('opacity-0'); setTimeout(() => modal.classList.add('hidden'), 300); document.getElementById('confirmModalCancelBtn').removeEventListener('click', onCancel); submitBtn.removeEventListener('click', onSubmit); };
            const onCancel = () => { cleanup(); resolve(false); };
            const onSubmit = () => { cleanup(); resolve(true); };
            document.getElementById('confirmModalCancelBtn').addEventListener('click', onCancel);
            submitBtn.addEventListener('click', onSubmit);
        });
    },

    promptModal(title, placeholder = "", defaultValue = "", description = null) {
        return new Promise((resolve) => {
            const modal = document.getElementById('customPromptModal');
            const box = document.getElementById('promptBox');
            if(!modal || !box) return resolve(null);
            document.getElementById('promptModalTitle').textContent = title;
            const descEl = document.getElementById('promptModalDesc');
            if (description) { descEl.textContent = description; descEl.classList.remove('hidden'); } else { descEl.classList.add('hidden'); }
            const input = document.getElementById('promptModalInput');
            input.placeholder = placeholder; input.value = defaultValue;
            
            modal.classList.remove('hidden'); 
            setTimeout(() => { modal.classList.remove('opacity-0'); box.classList.remove('scale-95'); box.classList.add('scale-100'); input.focus(); }, 10);
            
            const cleanup = () => { box.classList.remove('scale-100'); box.classList.add('scale-95'); modal.classList.add('opacity-0'); setTimeout(() => modal.classList.add('hidden'), 300); document.getElementById('promptModalCancelBtn').removeEventListener('click', onCancel); document.getElementById('promptModalSubmitBtn').removeEventListener('click', onSubmit); };
            const onCancel = () => { cleanup(); resolve(null); }; const onSubmit = () => { cleanup(); resolve(input.value.trim() || null); };
            document.getElementById('promptModalCancelBtn').addEventListener('click', onCancel); document.getElementById('promptModalSubmitBtn').addEventListener('click', onSubmit);
            input.onkeydown = (e) => { if(e.key === 'Enter') onSubmit(); };
        });
    },

    openShareModal(id, type, isPublic, shareId) {
        return new Promise((resolve) => {
            const modal = document.getElementById('customShareModal');
            const box = document.getElementById('shareBox');
            if(!modal || !box) return resolve(false);
            
            const toggle = document.getElementById('shareToggleSwitch');
            const options = document.getElementById('shareAdvancedOptions');
            const pinInput = document.getElementById('sharePinInput');
            const expirySelect = document.getElementById('shareExpirySelect');
            const linkBtn = document.getElementById('copyShareLinkBtn');

            toggle.checked = isPublic; pinInput.value = ''; expirySelect.value = '0';
            
            const updateUI = () => {
                if(toggle.checked) {
                    options.classList.remove('opacity-50', 'pointer-events-none');
                    linkBtn.classList.remove('hidden');
                    const link = `${window.location.origin}/share/${type}/${shareId}`;
                    linkBtn.onclick = () => { navigator.clipboard.writeText(link); this.showToast("Link Copied!", "content_copy", "text-green-400"); };
                } else {
                    options.classList.add('opacity-50', 'pointer-events-none');
                    linkBtn.classList.add('hidden');
                }
            };
            
            toggle.onchange = updateUI; updateUI();
            
            modal.classList.remove('hidden'); 
            setTimeout(() => { modal.classList.remove('opacity-0'); box.classList.remove('scale-95'); box.classList.add('scale-100'); }, 10);
            
            const cleanup = () => { box.classList.remove('scale-100'); box.classList.add('scale-95'); modal.classList.add('opacity-0'); setTimeout(() => modal.classList.add('hidden'), 300); };

            document.getElementById('shareModalCancelBtn').onclick = () => { cleanup(); resolve(false); };
            document.getElementById('shareModalSaveBtn').onclick = async () => {
                cleanup(); const isPub = toggle.checked; const pin = pinInput.value.trim(); const expiry = parseInt(expirySelect.value);
                this.showToast("Updating security rules...", "sync", "text-md-accent");
                const res = await api.toggleShare(id, type, isPub, pin, expiry);
                if (res.status === 200) { this.showToast(isPub ? "Link Live!" : "Link Locked", isPub ? "public" : "lock", isPub ? "text-green-400" : "text-md-text-muted"); this.loadDrive(true); } 
                else { this.showToast("Failed to update", "error", "text-red-400"); }
                resolve(true);
            };
        });
    },

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { icon: 'image', color: 'text-md-accent' };
        if (['pdf'].includes(ext)) return { icon: 'picture_as_pdf', color: 'text-red-400' };
        if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return { icon: 'movie', color: 'text-purple-400' };
        if (['zip', 'rar', 'apk'].includes(ext)) return { icon: 'folder_zip', color: 'text-yellow-500' };
        if (['js', 'html', 'css', 'ts', 'json'].includes(ext)) return { icon: 'code', color: 'text-green-400' };
        return { icon: 'description', color: 'text-blue-400' };
    },

    formatSize(bytes) {
        if (!bytes) return '--';
        const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    formatDate(dateStr) {
        if (!dateStr) return '--';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    switchView(view) {
        state.currentView = view; state.currentFolderId = null; state.path = [{ id: null, name: "My Drive" }];
        document.querySelectorAll('.sidebar-nav-btn').forEach(btn => { btn.classList.remove('bg-md-active', 'text-md-accent'); btn.classList.add('text-md-text'); });
        const activeSide = document.getElementById(`nav-${view}`);
        if (activeSide) { activeSide.classList.remove('text-md-text'); activeSide.classList.add('bg-md-active', 'text-md-accent'); }
        document.querySelectorAll('.bottom-nav-btn').forEach(btn => { btn.classList.remove('text-md-accent'); btn.classList.add('text-md-text-muted'); });
        const activeBottom = document.getElementById(`bottom-nav-${view}`);
        if (activeBottom) activeBottom.classList.add('text-md-accent');
        const newBtn = document.getElementById('newBtn'); const mobileNewBtn = document.getElementById('mobileNewBtn');
        if (view === 'home' && !state.isFrozen) { if(newBtn) newBtn.classList.remove('hidden'); if(mobileNewBtn) mobileNewBtn.classList.remove('hidden'); } 
        else { if(newBtn) newBtn.classList.add('hidden'); if(mobileNewBtn) mobileNewBtn.classList.add('hidden'); }
        this.loadDrive(true);
    },

    renderBreadcrumbs() {
        const container = document.getElementById('breadcrumbContainer');
        if(!container) return; container.innerHTML = '';
        if (state.currentView === 'starred') { container.innerHTML = `<button class="hover:bg-md-hover px-3 py-1.5 -ml-3 rounded-[8px] transition flex items-center text-yellow-500 font-medium"><span class="material-symbols-rounded filled mr-2">star</span> Starred</button>`; } 
        else if (state.currentView === 'shared') { container.innerHTML = `<button class="hover:bg-md-hover px-3 py-1.5 -ml-3 rounded-[8px] transition flex items-center text-green-400 font-medium"><span class="material-symbols-rounded filled mr-2">public</span> Shared Links</button>`; } 
        else if (state.currentView === 'trash') { container.innerHTML = `<div class="flex items-center justify-between w-full"><button class="hover:bg-md-hover px-3 py-1.5 -ml-3 rounded-[8px] transition flex items-center text-red-400 font-medium"><span class="material-symbols-rounded filled mr-2">delete</span> Trash</button>${state.isFrozen ? '' : '<button onclick="ui.emptyTrash()" class="text-sm font-medium text-red-400 bg-red-400/10 hover:bg-red-400 hover:text-black px-4 py-1.5 rounded-full transition border border-red-400/50 shadow-sm shrink-0 ml-4">Empty Trash</button>'}</div>`; } 
        else {
            state.path.forEach((crumb, index) => {
                const btn = document.createElement('button'); btn.className = "hover:bg-md-hover px-3 py-1.5 rounded-[8px] transition flex items-center shrink-0 active:scale-95"; btn.innerHTML = `<span class="font-medium">${crumb.name}</span>`;
                btn.onclick = () => { state.path = state.path.slice(0, index + 1); state.currentFolderId = crumb.id; this.loadDrive(true); };
                if (index > 0) { const sep = document.createElement('span'); sep.className = "material-symbols-rounded text-md-text-muted mx-1 shrink-0"; sep.textContent = "chevron_right"; container.appendChild(sep); } 
                else { btn.classList.add("-ml-3"); }
                container.appendChild(btn);
            });
        }
    },

    toggleSelect(rawId, type, name) { const id = String(rawId); if (state.selected.has(id)) state.selected.delete(id); else state.selected.set(id, { id, type, name }); this.updateSelectionUI(); this.renderContent(); },
    clearSelection() { state.selected.clear(); this.updateSelectionUI(); this.renderContent(); },
    updateSelectionUI() {
        const toolbar = document.getElementById('selectionToolbar'); if(!toolbar) return;
        if (state.selected.size > 0) { document.getElementById('selectionCount').textContent = `${state.selected.size} selected`; toolbar.classList.remove('hidden'); } else { toolbar.classList.add('hidden'); }
    },

    async bulkDelete() {
        if (state.selected.size === 0) return; const isTrashView = state.currentView === 'trash'; const msg = isTrashView ? `Permanently delete ${state.selected.size} items? This cannot be undone.` : `Move ${state.selected.size} items to trash?`;
        if (!(await this.confirmModal("Confirm Delete", msg, isTrashView, isTrashView ? "delete_forever" : "delete"))) return;
        this.showToast(isTrashView ? "Deleting items forever..." : "Moving to trash...", isTrashView ? "delete_forever" : "delete", "text-md-text-muted");
        let success = 0;
        for (const [id, item] of state.selected) { let res; if (isTrashView) res = item.type === 'folder' ? await api.deleteFolder(id) : await api.deleteFile(id); else res = await api.toggleTrash(id, item.type, true); if (res.status === 200) success++; }
        state.selected.clear(); this.updateSelectionUI(); this.showToast(isTrashView ? `Deleted ${success} items` : `Moved ${success} items to Trash`, "check_circle", "text-green-400"); this.loadDrive(true); if (isTrashView) this.updateStorage();
    },

    async emptyTrash() {
        if (!(await this.confirmModal("Empty Trash", "Permanently wipe all files in the trash? This cannot be undone.", true, "delete_forever"))) return;
        this.showToast("Emptying trash...", "delete_forever", "text-red-400");
        const res = await api.emptyTrash();
        if (res.status === 200) { this.showToast("Trash is empty", "check_circle", "text-green-400"); this.loadDrive(true); this.updateStorage(); } else { this.showToast("Failed to empty", "error", "text-red-400"); }
    },

    async bulkToggleShare(makePublic) {
        if (state.selected.size === 0) return;
        this.showToast(makePublic ? "Unlocking items..." : "Locking items...", "admin_panel_settings", "text-md-accent");
        let success = 0;
        for (const [id, item] of state.selected) { const res = await api.toggleShare(id, item.type, makePublic); if (res.status === 200) success++; }
        state.selected.clear(); this.updateSelectionUI(); this.showToast(`${success} items updated`, "check_circle", "text-green-400"); this.loadDrive(true);
    },

    openItemMenu(e, id, type, name, isPublic = false, shareId, isStarred = false, isTrash = false) {
        e.stopPropagation(); 
        document.getElementById('newMenu')?.classList.add('hidden'); document.getElementById('bulkMenu')?.classList.add('hidden'); document.getElementById('sortMenu')?.classList.add('hidden');
        state.activeMenuTarget = { id, type, name, isPublic, shareId, isStarred, isTrash };
        
        const menu = document.getElementById('itemMenu'); 
        const backdrop = document.getElementById('itemMenuBackdrop');
        if(!menu || !backdrop) return;

        const headerName = document.getElementById('menuItemHeaderName');
        const headerIcon = document.getElementById('menuItemHeaderIcon');
        if(headerName) headerName.textContent = name;
        if(headerIcon) {
            if(type === 'folder') {
                headerIcon.textContent = isPublic ? 'folder_shared' : 'folder';
                headerIcon.className = 'material-symbols-rounded mr-4 text-md-text-muted text-[28px] filled';
            } else {
                const iconData = this.getFileIcon(name);
                headerIcon.textContent = iconData.icon;
                headerIcon.className = `material-symbols-rounded mr-4 ${iconData.color} text-[28px] filled`;
            }
        }

        const copyBtn = document.getElementById('menuItemCopyLink');
        const pubBtnIcon = document.getElementById('menuItemShareIcon');
        const pubBtnText = document.getElementById('menuItemShareText');
        
        if (isPublic) { pubBtnIcon.textContent = 'lock_open'; pubBtnText.textContent = 'Share Settings'; copyBtn?.classList.remove('hidden'); } 
        else { pubBtnIcon.textContent = 'public'; pubBtnText.textContent = 'Share Settings'; copyBtn?.classList.add('hidden'); }

        const starIcon = document.getElementById('menuItemToggleStarIcon'); const starText = document.getElementById('menuItemToggleStarText');
        if (isStarred) { starIcon.classList.add('filled', 'text-yellow-500'); starText.textContent = "Unstar"; } else { starIcon.classList.remove('filled', 'text-yellow-500'); starText.textContent = "Add to Starred"; }

        const trashToggleBtn = document.getElementById('menuItemToggleTrash'); const trashIcon = document.getElementById('menuItemToggleTrashIcon'); const trashText = document.getElementById('menuItemToggleTrashText'); const permDeleteBtn = document.getElementById('menuItemPermanentDelete');
        if (state.isFrozen) { trashToggleBtn?.classList.add('hidden'); permDeleteBtn?.classList.add('hidden'); } else { trashToggleBtn?.classList.remove('hidden'); if (isTrash) { trashIcon.textContent = 'restore_from_trash'; trashText.textContent = 'Restore'; permDeleteBtn?.classList.remove('hidden'); } else { trashIcon.textContent = 'delete'; trashText.textContent = 'Move to Trash'; permDeleteBtn?.classList.add('hidden'); } }
        
        menu.classList.remove('hidden'); 
        
        if (window.innerWidth >= 768) {
            menu.style.bottom = 'auto'; 
            const rect = e.currentTarget.getBoundingClientRect(); 
            const menuHeight = menu.offsetHeight;
            if (rect.bottom + menuHeight > window.innerHeight) {
                menu.style.top = `${rect.top + window.scrollY - menuHeight - 8}px`; 
            } else {
                menu.style.top = `${rect.bottom + window.scrollY + 8}px`; 
            }
            menu.style.left = rect.right - 192 < 10 ? `10px` : `${rect.right - 192}px`; 
        } else {
            menu.style.top = ''; menu.style.left = ''; menu.style.bottom = ''; 
        }
        
        backdrop.classList.remove('hidden');
        menu.classList.add('flex');
        void menu.offsetWidth; 
        
        backdrop.classList.remove('opacity-0');
        if (window.innerWidth >= 768) {
            menu.classList.remove('md:scale-95', 'md:opacity-0');
            menu.classList.add('md:scale-100', 'md:opacity-100');
        } else {
            menu.classList.remove('translate-y-full');
            menu.classList.add('translate-y-0');
        }
    },

    closeItemMenu() {
        const menu = document.getElementById('itemMenu');
        const backdrop = document.getElementById('itemMenuBackdrop');
        if(!menu || !backdrop) return;
        
        backdrop.classList.add('opacity-0');
        
        if (window.innerWidth >= 768) {
            menu.classList.remove('md:scale-100', 'md:opacity-100');
            menu.classList.add('md:scale-95', 'md:opacity-0');
        } else {
            menu.classList.remove('translate-y-0');
            menu.classList.add('translate-y-full');
        }
        
        setTimeout(() => {
            backdrop.classList.add('hidden');
            menu.classList.add('hidden');
            menu.classList.remove('flex');
        }, 300);
    },

    async loadDrive(fetchData = true) {
        if (fetchData) {
            const response = await api.getDrive(state.currentFolderId);
            if (response.status === 401 || response.status === 403) return auth.showAuth();
            if (response.status !== 200) return this.showToast("Database Error", "error", "text-red-400");
            state.isFrozen = response.data.isFrozen;
            if (state.isFrozen) { const newBtn = document.getElementById('newBtn'); if(newBtn) newBtn.classList.add('hidden'); const mobBtn = document.getElementById('mobileNewBtn'); if(mobBtn) mobBtn.classList.add('hidden'); const dltBtn = document.getElementById('bulkDeleteBtn'); if(dltBtn) dltBtn.classList.add('hidden'); }
            if (!auth.view.classList.contains('hidden')) auth.showDashboard(response.data.username, false);
            if (state.isFrozen) this.showToast("Account frozen. Read-only mode.", "ac_unit", "text-blue-400");
            state.currentData = { folders: response.data.folders, files: response.data.files };
        }
        this.renderBreadcrumbs(); this.renderContent();
    },

    async performSearch(query) {
        const res = await api.search(query);
        if (res.status === 200) { state.currentData = { folders: res.data.folders, files: res.data.files }; document.getElementById('breadcrumbContainer').innerHTML = `<span class="px-3 py-1.5 text-md-accent font-medium bg-md-active rounded-[8px]">Search Results for "${query}"</span>`; this.renderContent(); }
    },

    setSort(by, forceOrder = null) {
        if (forceOrder) { state.sortOrder = forceOrder; } else { if (state.sortBy === by) state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'; else state.sortOrder = 'asc'; }
        state.sortBy = by; localStorage.setItem('rcloud_sort', state.sortBy); localStorage.setItem('rcloud_sortOrder', state.sortOrder);
        const map = { 'name': 'Name', 'date': 'Date Modified', 'size': 'File Size' }; document.getElementById('sortIndicatorLabel').textContent = map[state.sortBy]; document.getElementById('sortIndicatorIcon').textContent = state.sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'; document.getElementById('sortMenu')?.classList.add('hidden'); this.renderContent();
    },

    sortArray(arr) { return arr.sort((a, b) => { let valA, valB; if (state.sortBy === 'name') { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); } else if (state.sortBy === 'date') { valA = new Date(a.date).getTime() || 0; valB = new Date(b.date).getTime() || 0; } else if (state.sortBy === 'size') { valA = a.size || 0; valB = b.size || 0; } if (valA < valB) return state.sortOrder === 'asc' ? -1 : 1; if (valA > valB) return state.sortOrder === 'asc' ? 1 : -1; return 0; }); },

    renderContent() {
        if(!this.foldersGrid || !this.filesGrid) return;
        this.foldersGrid.innerHTML = ''; this.filesGrid.innerHTML = '';
        let { folders, files } = state.currentData; folders = this.sortArray([...folders]); files = this.sortArray([...files]);
        
        this.currentFiles = files;
        let animDelay = 0; // THE FIX: Global stagger clock for animations
        
        const isSelectionMode = state.selected.size > 0; const isList = state.viewMode === 'list';
        const foldersHeader = document.getElementById('foldersHeader'); const filesHeader = document.getElementById('filesHeader');

        if (folders.length === 0 && files.length === 0) {
            if (foldersHeader) foldersHeader.classList.add('hidden'); if (filesHeader) filesHeader.classList.add('hidden'); this.filesGrid.className = '';
            let emptyIcon = 'folder_open'; if (state.currentView === 'starred') emptyIcon = 'star'; if (state.currentView === 'trash') emptyIcon = 'delete';
            this.filesGrid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-24 text-md-text-muted animate-item"><span class="material-symbols-rounded text-[64px] mb-4 opacity-50">${emptyIcon}</span><p class="text-[16px] font-medium">Nothing to see here</p></div>`; return;
        }

        this.foldersGrid.className = isList ? 'flex flex-col mb-8' : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-8';
        this.filesGrid.className = isList ? 'flex flex-col pb-24' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-24';

        if (folders.length > 0) {
            if (foldersHeader) foldersHeader.classList.remove('hidden');
            folders.forEach(f => {
                const safeId = String(f.id); const isSel = state.selected.has(safeId); const bgClass = isSel ? 'bg-[#004a77]/30 border-md-accent' : 'bg-md-bg border-transparent hover:border-[#444746]';
                const isShared = f.is_public === 1; const folderIconName = isShared ? 'folder_shared' : 'folder'; const starBadge = f.is_starred === 1 ? `<span class="material-symbols-rounded filled text-yellow-500 text-[16px] ml-2">star</span>` : '';
                const card = document.createElement('div');
                card.onclick = () => { if (isSelectionMode) { this.toggleSelect(safeId, 'folder', f.name); } else { if (f.is_trash !== 1) { state.currentFolderId = f.id; state.path.push({ id: f.id, name: f.name }); this.loadDrive(true); } } };
                
                // Active/Hover States added to cards for tactile feedback
                if (isList) {
                    card.className = `animate-item flex items-center justify-between p-3 border-b border-[#444746] ${bgClass} hover:bg-md-hover transition-colors cursor-pointer group active:bg-md-surface-container`;
                    card.innerHTML = `<div class="flex items-center flex-1 overflow-hidden pointer-events-none"><div class="relative shrink-0 pointer-events-auto cursor-pointer flex items-center justify-center mr-4" onclick="event.stopPropagation(); ui.toggleSelect('${safeId}', 'folder', '${f.name.replace(/'/g, "\\'")}')">${isSel ? `<span class="material-symbols-rounded filled text-md-accent text-[24px]">check_circle</span>` : `<span class="material-symbols-rounded filled text-md-text-muted text-[24px] group-hover:text-md-text transition">${folderIconName}</span>`}</div><span class="text-[14px] font-medium text-md-text truncate">${f.name}</span>${starBadge}</div><div class="flex items-center shrink-0 w-32 hidden md:flex text-md-text-muted text-[13px]">${this.formatDate(f.date)}</div><div class="flex items-center shrink-0 w-20 hidden md:flex text-md-text-muted text-[13px]">--</div><div class="flex items-center shrink-0 ml-4 pointer-events-auto"><button onclick="ui.openItemMenu(event, '${safeId}', 'folder', '${f.name.replace(/'/g, "\\'")}', ${isShared}, '${f.share_id}', ${f.is_starred === 1}, ${f.is_trash === 1})" class="material-symbols-rounded text-md-text-muted hover:text-md-text text-[20px] transition p-1">more_vert</button></div>`;
                } else {
                    card.className = `animate-item flex justify-between items-center ${bgClass} rounded-[16px] py-3.5 px-4 cursor-pointer transition-colors border group active:bg-md-surface-container`;
                    card.innerHTML = `<div class="flex items-center overflow-hidden w-full pointer-events-none"><div class="relative shrink-0 pointer-events-auto cursor-pointer flex items-center justify-center mr-4" onclick="event.stopPropagation(); ui.toggleSelect('${safeId}', 'folder', '${f.name.replace(/'/g, "\\'")}')">${isSel ? `<span class="material-symbols-rounded filled text-md-accent text-[28px]">check_circle</span>` : `<span class="material-symbols-rounded filled text-md-text-muted text-[28px] transition hover:text-md-text">${folderIconName}</span>`}</div><div class="flex flex-col overflow-hidden"><div class="flex items-center"><span class="text-[15px] font-medium text-md-text truncate">${f.name}</span>${starBadge}</div><span class="text-[11px] text-md-text-muted mt-0.5">${this.formatDate(f.date)}</span></div></div><div class="flex items-center shrink-0 ml-2"><button onclick="ui.openItemMenu(event, '${safeId}', 'folder', '${f.name.replace(/'/g, "\\'")}', ${isShared}, '${f.share_id}', ${f.is_starred === 1}, ${f.is_trash === 1})" class="material-symbols-rounded text-md-text-muted hover:text-md-text text-[24px] transition cursor-pointer pointer-events-auto active:scale-90">more_vert</button></div>`;
                }
                card.style.animationDelay = `${animDelay * 0.04}s`;
                animDelay++;
                this.foldersGrid.appendChild(card);
            });
        } else { if (foldersHeader) foldersHeader.classList.add('hidden'); }

        if (files.length > 0) {
            if (filesHeader) filesHeader.classList.remove('hidden');
            files.forEach(file => {
                const safeId = String(file.id); const isSel = state.selected.has(safeId); const bgClass = isSel ? 'bg-[#004a77]/30 border-md-accent' : 'bg-md-bg border-transparent hover:border-[#444746]';
                const fileType = this.getFileIcon(file.name); const ext = file.name.split('.').pop().toLowerCase(); const isShared = file.is_public === 1; const starBadge = file.is_starred === 1 ? `<span class="material-symbols-rounded filled text-yellow-500 text-[16px] ml-2">star</span>` : '';
                const card = document.createElement('div');
                card.onclick = () => { if (isSelectionMode) this.toggleSelect(safeId, 'file', file.name); else if (file.is_trash !== 1) this.openPreview(safeId, file.name); };

                if (isList) {
                    card.className = `animate-item flex items-center justify-between p-3 border-b border-[#444746] ${bgClass} hover:bg-md-hover transition-colors cursor-pointer group active:bg-md-surface-container`;
                    card.innerHTML = `<div class="flex items-center flex-1 overflow-hidden pointer-events-none"><div class="relative shrink-0 pointer-events-auto cursor-pointer flex items-center justify-center mr-4" onclick="event.stopPropagation(); ui.toggleSelect('${safeId}', 'file', '${file.name.replace(/'/g, "\\'")}')">${isSel ? `<span class="material-symbols-rounded filled text-md-accent text-[24px]">check_circle</span>` : `<span class="material-symbols-rounded filled ${fileType.color} text-[24px]">${fileType.icon}</span>`}</div><span class="text-[14px] font-medium text-md-text truncate">${file.name}</span>${starBadge}</div><div class="flex items-center shrink-0 w-32 hidden md:flex text-md-text-muted text-[13px]">${this.formatDate(file.date)}</div><div class="flex items-center shrink-0 w-20 hidden md:flex text-md-text-muted text-[13px]">${this.formatSize(file.size)}</div><div class="flex items-center shrink-0 ml-4 pointer-events-auto"><button onclick="ui.openItemMenu(event, '${safeId}', 'file', '${file.name.replace(/'/g, "\\'")}', ${isShared}, '${file.share_id}', ${file.is_starred === 1}, ${file.is_trash === 1})" class="material-symbols-rounded text-md-text-muted hover:text-md-text text-[20px] transition p-1">more_vert</button></div>`;
                } else {
                    let thumbnailHTML = `<span class="material-symbols-rounded text-[48px] ${fileType.color}">${fileType.icon}</span>`;
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext)) { 
                        thumbnailHTML = `
                            <img src="/api/thumbnail/${file.id}" loading="lazy" class="w-full h-full object-cover rounded-[8px] z-10 relative" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                            <div class="absolute inset-0 flex items-center justify-center hidden z-0"><span class="material-symbols-rounded text-[48px] ${fileType.color}">${fileType.icon}</span></div>
                        `; 
                        if (['mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext)) { 
                            thumbnailHTML += `<div class="absolute inset-0 flex items-center justify-center bg-black/30 rounded-[8px] z-20 pointer-events-none"><span class="material-symbols-rounded text-white drop-shadow-lg text-[32px]">play_circle</span></div>`; 
                        } 
                    } 
                    card.className = `animate-item flex flex-col ${bgClass} rounded-[12px] overflow-hidden cursor-pointer transition-colors border group active:bg-md-surface-container`;
                    card.innerHTML = `<div class="h-32 bg-[#131314] m-1.5 rounded-[8px] flex items-center justify-center relative pointer-events-none">${thumbnailHTML}<div class="absolute top-2 left-2 pointer-events-auto cursor-pointer z-10" onclick="event.stopPropagation(); ui.toggleSelect('${safeId}', 'file', '${file.name.replace(/'/g, "\\'")}')">${isSel ? `<span class="material-symbols-rounded filled text-md-accent text-[24px] bg-md-surface rounded-full shadow-sm">check_circle</span>` : `<span class="material-symbols-rounded text-md-text-muted text-[24px] ${isSelectionMode?'opacity-100':'opacity-0 group-hover:opacity-100'} transition drop-shadow-md">radio_button_unchecked</span>`}</div></div><div class="px-3 pb-3 pt-1 flex justify-between items-center relative"><div class="flex flex-col overflow-hidden w-full pointer-events-none"><div class="flex items-center mb-0.5"><span class="material-symbols-rounded filled ${fileType.color} text-[16px] mr-2 shrink-0">${fileType.icon}</span><span class="text-[13px] font-medium text-md-text truncate" title="${file.name}">${file.name}</span>${starBadge}</div><span class="text-[11px] text-md-text-muted">${this.formatSize(file.size)} • ${this.formatDate(file.date)}</span></div><div class="flex items-center shrink-0 ml-2"><button onclick="ui.openItemMenu(event, '${safeId}', 'file', '${file.name.replace(/'/g, "\\'")}', ${isShared}, '${file.share_id}', ${file.is_starred === 1}, ${file.is_trash === 1})" class="material-symbols-rounded text-md-text-muted hover:text-md-text text-[24px] transition cursor-pointer pointer-events-auto active:scale-90">more_vert</button></div></div>`;
                }
                card.style.animationDelay = `${animDelay * 0.04}s`;
                animDelay++;
                this.filesGrid.appendChild(card);
            });
        } else { if (filesHeader) filesHeader.classList.add('hidden'); }
    },

    setClipboard(action, itemsArray) {
        state.clipboard.action = action; state.clipboard.items = itemsArray.map(item => ({ id: item.id, type: item.type })); const bar = document.getElementById('clipboardBar'); document.getElementById('clipboardText').textContent = `${itemsArray.length} item(s) to ${action}`; bar.classList.remove('hidden'); setTimeout(() => bar.classList.remove('opacity-0', 'translate-y-10'), 10); this.clearSelection();
    },
    clearClipboard() { state.clipboard = { action: null, items: [] }; const bar = document.getElementById('clipboardBar'); bar.classList.add('opacity-0', 'translate-y-10'); setTimeout(() => bar.classList.add('hidden'), 300); },

    async pasteClipboard() {
        if (state.clipboard.items.length === 0) return; const { action, items } = state.clipboard; const targetFolder = state.currentFolderId;
        this.showToast(`${action === 'copy' ? 'Copying' : 'Moving'} items...`, "content_paste", "text-md-accent");
        const res = action === 'copy' ? await api.copyItems(items, targetFolder) : await api.moveItems(items, targetFolder);
        if (res.status === 200) { this.showToast(`Successfully pasted!`, "check_circle", "text-green-400"); this.clearClipboard(); this.loadDrive(true); } else { this.showToast("Failed to paste items", "error", "text-red-400"); }
    },

    updatePreviewArrows() {
        const prevBtn = document.getElementById('previewPrevBtn');
        const nextBtn = document.getElementById('previewNextBtn');
        if (!prevBtn || !nextBtn) return;
        
        if (this.previewIndex > 0) prevBtn.classList.remove('invisible');
        else prevBtn.classList.add('invisible');
        
        if (this.currentFiles && this.previewIndex < this.currentFiles.length - 1) nextBtn.classList.remove('invisible');
        else nextBtn.classList.add('invisible');
    },

    previewNext(e) {
        if(e) e.stopPropagation();
        if (this.previewIndex !== undefined && this.previewIndex < this.currentFiles.length - 1) {
            if (typeof RPlayer !== 'undefined') RPlayer.destroy();
            this.destroyImageGestures(); // FIX: Memory cleanup
            const nextFile = this.currentFiles[this.previewIndex + 1];
            this.openPreview(nextFile.id, nextFile.name);
        }
    },

    previewPrev(e) {
        if(e) e.stopPropagation();
        if (this.previewIndex !== undefined && this.previewIndex > 0) {
            if (typeof RPlayer !== 'undefined') RPlayer.destroy();
            this.destroyImageGestures(); // FIX: Memory cleanup
            const prevFile = this.currentFiles[this.previewIndex - 1];
            this.openPreview(prevFile.id, prevFile.name);
        }
    },

    openPreview(id, name) {
        this.previewIndex = this.currentFiles?.findIndex(f => String(f.id) === String(id));
        this.updatePreviewArrows();

        const ext = name.split('.').pop().toLowerCase(); const modal = document.getElementById('previewModal'); const content = document.getElementById('previewContent'); const downloadBtn = document.getElementById('downloadPreviewBtn'); document.getElementById('previewFilename').textContent = name; downloadBtn.onclick = () => window.location.href = `/api/download/${id}`; 
        
        const modalHeader = modal.querySelector('div:first-child');
        content.innerHTML = ''; 
        
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) { 
            if(modalHeader) modalHeader.classList.remove('hidden');
            
            // THE FIX: Full Screen Image Rendering (No Padding) + Scale Transforms
            content.className = "flex-1 flex items-center justify-center p-0 overflow-hidden relative mt-16 md:mt-0 select-none";
            content.innerHTML = `<img id="previewImage" src="/api/view/${id}" class="max-w-full max-h-full object-contain drop-shadow-2xl transition-transform duration-100 ease-out origin-center" style="transform: translate(0px, 0px) scale(1);">`; 
            
            // Initiate the powerful Matrix Math Pinch Engine!
            this.initImageGestures();
            
        } else if (['mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext)) { 
            if(modalHeader) modalHeader.classList.add('hidden');
            content.className = "flex-1 flex items-center justify-center w-full h-full p-0 m-0 bg-black select-none";
            RPlayer.init(content, `/api/view/${id}`, name);
        } else { 
            if(modalHeader) modalHeader.classList.remove('hidden');
            content.className = "flex-1 flex items-center justify-center p-4 md:p-12 overflow-hidden relative mt-16 md:mt-0 select-none";
            content.innerHTML = `<div class="flex flex-col items-center text-md-text-muted"><span class="material-symbols-rounded text-[80px] mb-4">description</span><p class="mb-6">No preview available for this file type.</p><a href="/api/download/${id}" class="px-8 py-3 bg-md-active text-md-accent rounded-full font-medium hover:bg-[#005a8f] transition shadow-lg flex items-center active:scale-95"><span class="material-symbols-rounded mr-2">download</span> Download File</a></div>`; 
        }
        modal.classList.remove('hidden'); setTimeout(() => modal.classList.remove('opacity-0'), 50);
    },
    
    closePreview() { 
        const modal = document.getElementById('previewModal'); modal.classList.add('opacity-0'); 
        if (typeof RPlayer !== 'undefined') RPlayer.destroy();
        this.destroyImageGestures();
        
        setTimeout(() => { 
            modal.classList.add('hidden'); document.getElementById('previewContent').innerHTML = ''; 
            const modalHeader = modal.querySelector('div:first-child');
            if(modalHeader) modalHeader.classList.remove('hidden');
        }, 300); 
    },

    // ==========================================
    //    THE FIX: PINCH TO ZOOM & SWIPE ENGINE
    // ==========================================
    initImageGestures() {
        this.destroyImageGestures(); 
        const content = document.getElementById('previewContent');
        const img = document.getElementById('previewImage');
        if (!content || !img) return;

        let scale = 1, pointX = 0, pointY = 0, startX = 0, startY = 0;
        let pinchDistance = 0, initialScale = 1;
        let isPanning = false, isSwiping = false;

        this._imgTouchStart = (e) => {
            if (e.target.closest('button')) return;
            if (e.touches.length === 2) {
                e.preventDefault(); // Lock browser zoom
                pinchDistance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                initialScale = scale;
                isSwiping = false;
            } else if (e.touches.length === 1) {
                startX = e.touches[0].pageX - pointX;
                startY = e.touches[0].pageY - pointY;
                isPanning = scale > 1;
                isSwiping = scale === 1;
                this._swipeStartX = e.touches[0].pageX;
                this._swipeStartY = e.touches[0].pageY;
            }
        };

        this._imgTouchMove = (e) => {
            if (e.target.closest('button')) return;
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                scale = Math.min(Math.max(1, initialScale * (dist / pinchDistance)), 5); // 5x Max Zoom
                
                // Keep image centered if completely zoomed out
                if (scale <= 1.05) { scale = 1; pointX = 0; pointY = 0; }
                img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
            } else if (e.touches.length === 1 && isPanning) {
                e.preventDefault();
                pointX = e.touches[0].pageX - startX;
                pointY = e.touches[0].pageY - startY;
                img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
            }
        };

        this._imgTouchEnd = (e) => {
            if (e.touches.length === 0) {
                if (isSwiping && scale === 1) {
                    const endX = e.changedTouches[0].pageX;
                    const endY = e.changedTouches[0].pageY;
                    if (Math.abs(endY - this._swipeStartY) < 100) {
                        if (endX < this._swipeStartX - 75) this.previewNext();
                        if (endX > this._swipeStartX + 75) this.previewPrev();
                    }
                }
                isPanning = false; isSwiping = false;
            }
        };

        content.addEventListener('touchstart', this._imgTouchStart, { passive: false });
        content.addEventListener('touchmove', this._imgTouchMove, { passive: false });
        content.addEventListener('touchend', this._imgTouchEnd);
    },

    destroyImageGestures() {
        const content = document.getElementById('previewContent');
        if (content && this._imgTouchStart) {
            content.removeEventListener('touchstart', this._imgTouchStart);
            content.removeEventListener('touchmove', this._imgTouchMove);
            content.removeEventListener('touchend', this._imgTouchEnd);
        }
    },

    uploadQueue(files) {
        const panel = document.getElementById('uploadQueuePanel'); const list = document.getElementById('uploadList'); 
        panel.classList.remove('hidden'); setTimeout(() => panel.classList.remove('translate-y-4', 'opacity-0'), 10);
        files.forEach(file => {
            const fileId = 'upload-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            const item = document.createElement('div'); item.id = fileId; item.className = "p-3 border-b border-[#444746] flex flex-col bg-md-surface";
            item.innerHTML = `<div class="flex justify-between items-center mb-2"><span class="text-[13px] font-medium text-md-text truncate pr-2">${file.name}</span><span class="material-symbols-rounded text-[18px] text-md-text-muted status-icon">pending</span></div><div class="w-full bg-[#444746] rounded-full h-1.5 overflow-hidden"><div class="bg-md-accent h-1.5 rounded-full progress-bar transition-all duration-200" style="width: 0%"></div></div>`;
            list.prepend(item); this.executeUpload(file, fileId);
        });
        this.updateUploadTitle();
    },

    executeUpload(file, uiId) {
        const formData = new FormData(); formData.append('file', file);
        if (state.currentFolderId) formData.append('folderId', state.currentFolderId);
        if (file.webkitRelativePath) formData.append('relativePath', file.webkitRelativePath);
        const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/upload', true); xhr.withCredentials = true;
        const itemUI = document.getElementById(uiId); const progressBar = itemUI.querySelector('.progress-bar'); const statusIcon = itemUI.querySelector('.status-icon');
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) { progressBar.style.width = ((event.loaded / event.total) * 100) + '%'; } };
        xhr.onload = () => {
            if (xhr.status === 200) { progressBar.classList.replace('bg-md-accent', 'bg-green-400'); statusIcon.textContent = 'check_circle'; statusIcon.classList.add('text-green-400'); this.loadDrive(true); this.updateStorage(); } 
            else { progressBar.classList.replace('bg-md-accent', 'bg-red-400'); statusIcon.textContent = 'error'; statusIcon.classList.add('text-red-400'); }
            this.updateUploadTitle();
        };
        xhr.onerror = () => { progressBar.classList.replace('bg-md-accent', 'bg-red-400'); statusIcon.textContent = 'error'; statusIcon.classList.add('text-red-400'); this.updateUploadTitle(); };
        xhr.send(formData);
    },

    updateUploadTitle() { const list = document.getElementById('uploadList'); const total = list.children.length; const completed = list.querySelectorAll('.bg-green-400, .bg-red-400').length; const title = document.getElementById('uploadQueueTitle'); if (completed < total) title.textContent = `Uploading ${total - completed} item(s)...`; else title.textContent = `${completed} upload(s) complete`; },
    closeUploadQueue(e) { 
        e.stopPropagation(); 
        const panel = document.getElementById('uploadQueuePanel');
        panel.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => { panel.classList.add('hidden'); document.getElementById('uploadList').innerHTML = ''; }, 300);
    },

    async deleteFile(id) {
        if (!(await this.confirmModal("Delete File", "Permanently delete this file?", true, "delete_forever"))) return;
        const res = await api.deleteFile(id); if (res.status === 200) { this.showToast("File deleted", "delete", "text-md-text-muted"); this.loadDrive(true); this.updateStorage(); }
    },
    async deleteFolder(id, name) {
        if (!(await this.confirmModal("Delete Folder", `Delete folder "${name}" and ALL files inside it?`, true, "delete_forever"))) return;
        this.showToast("Deleting folder...", "delete", "text-md-text-muted"); const res = await api.deleteFolder(id);
        if (res.status === 200) { this.showToast("Folder deleted", "check_circle", "text-green-400"); this.loadDrive(true); this.updateStorage(); } else { this.showToast("Failed to delete", "error", "text-red-400"); }
    }
};
