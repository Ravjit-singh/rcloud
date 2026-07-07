const ui = {
    foldersGrid: document.getElementById('foldersGrid'),
    filesGrid: document.getElementById('filesGrid'),
    toastTimer: null,
    
    showToast(message, icon = 'info', color = 'text-md-accent') {
        const toast = document.getElementById('toast');
        const toastIcon = document.getElementById('toastIcon');
        document.getElementById('toastMessage').textContent = message;
        toastIcon.textContent = icon;
        toastIcon.className = `material-symbols-rounded mr-3 ${color}`;
        toast.classList.remove('opacity-0', 'translate-y-4');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.add('opacity-0', 'translate-y-4'), 3000);
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

    // NEW: Handles clicking Bottom Nav / Sidebar Navigation!
    switchView(view) {
        state.currentView = view;
        state.currentFolderId = null; 
        state.path = [{ id: null, name: "My Drive" }];
        
        document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
            btn.classList.remove('bg-md-active', 'text-md-accent'); btn.classList.add('text-md-text');
        });
        const activeSide = document.getElementById(`nav-${view}`);
        if (activeSide) { activeSide.classList.remove('text-md-text'); activeSide.classList.add('bg-md-active', 'text-md-accent'); }

        document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
            btn.classList.remove('text-md-accent'); btn.classList.add('text-md-text-muted');
        });
        const activeBottom = document.getElementById(`bottom-nav-${view}`);
        if (activeBottom) activeBottom.classList.add('text-md-accent');

        const newBtn = document.getElementById('newBtn');
        const mobileNewBtn = document.getElementById('mobileNewBtn');
        if (view === 'home') { newBtn.classList.remove('hidden'); mobileNewBtn.classList.remove('hidden'); } 
        else { newBtn.classList.add('hidden'); mobileNewBtn.classList.add('hidden'); }

        this.loadDrive(true);
    },

    renderBreadcrumbs() {
        const container = document.getElementById('breadcrumbContainer');
        container.innerHTML = '';

        if (state.currentView === 'starred') {
            container.innerHTML = `<button class="hover:bg-md-hover px-3 py-1.5 -ml-3 rounded-[8px] transition flex items-center text-yellow-500 font-medium"><span class="material-symbols-rounded filled mr-2">star</span> Starred</button>`;
        } else if (state.currentView === 'shared') {
            container.innerHTML = `<button class="hover:bg-md-hover px-3 py-1.5 -ml-3 rounded-[8px] transition flex items-center text-green-400 font-medium"><span class="material-symbols-rounded filled mr-2">public</span> Shared Links</button>`;
        } else if (state.currentView === 'trash') {
            container.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <button class="hover:bg-md-hover px-3 py-1.5 -ml-3 rounded-[8px] transition flex items-center text-red-400 font-medium"><span class="material-symbols-rounded filled mr-2">delete</span> Trash</button>
                    <button onclick="ui.emptyTrash()" class="text-sm font-medium text-red-400 bg-red-400/10 hover:bg-red-400 hover:text-black px-4 py-1.5 rounded-full transition border border-red-400/50 shadow-sm">Empty Trash</button>
                </div>
            `;
        } else {
            state.path.forEach((crumb, index) => {
                const btn = document.createElement('button');
                btn.className = "hover:bg-md-hover px-3 py-1.5 rounded-[8px] transition flex items-center";
                btn.innerHTML = `<span class="font-medium">${crumb.name}</span>`;
                btn.onclick = () => {
                    state.path = state.path.slice(0, index + 1);
                    state.currentFolderId = crumb.id;
                    this.loadDrive(true);
                };
                if (index > 0) {
                    const sep = document.createElement('span');
                    sep.className = "material-symbols-rounded text-md-text-muted mx-1";
                    sep.textContent = "chevron_right";
                    container.appendChild(sep);
                } else { btn.classList.add("-ml-3"); }
                container.appendChild(btn);
            });
        }
    },

    toggleSelect(rawId, type, name) {
        const id = String(rawId); 
        if (state.selected.has(id)) state.selected.delete(id);
        else state.selected.set(id, { id, type, name }); 
        this.updateSelectionUI();
        this.renderContent(); 
    },

    clearSelection() {
        state.selected.clear();
        this.updateSelectionUI();
        this.renderContent();
    },

    updateSelectionUI() {
        const toolbar = document.getElementById('selectionToolbar');
        if (state.selected.size > 0) {
            document.getElementById('selectionCount').textContent = `${state.selected.size} selected`;
            toolbar.classList.remove('hidden');
        } else { toolbar.classList.add('hidden'); }
    },

    // NEW: Contextual Bulk Trash/Delete
    async bulkDelete() {
        if (state.selected.size === 0) return;
        const isTrashView = state.currentView === 'trash';
        
        if (isTrashView) {
            if (!confirm(`Permanently delete ${state.selected.size} items?`)) return;
            this.showToast("Deleting items forever...", "delete_forever", "text-red-400");
        } else {
            this.showToast("Moving to trash...", "delete", "text-md-text-muted");
        }
        
        let success = 0;
        for (const [id, item] of state.selected) {
            let res;
            if (isTrashView) res = item.type === 'folder' ? await api.deleteFolder(id) : await api.deleteFile(id);
            else res = await api.toggleTrash(id, item.type, true);
            
            if (res.status === 200) success++;
        }
        state.selected.clear();
        this.updateSelectionUI();
        this.showToast(isTrashView ? `Deleted ${success} items` : `Moved ${success} items to Trash`, "check_circle", "text-green-400");
        this.loadDrive(true);
    },

    async emptyTrash() {
        if (!confirm("Permanently wipe all files in the trash? This cannot be undone.")) return;
        this.showToast("Emptying trash...", "delete_forever", "text-red-400");
        const res = await api.emptyTrash();
        if (res.status === 200) { this.showToast("Trash is empty", "check_circle", "text-green-400"); this.loadDrive(true); }
        else { this.showToast("Failed to empty", "error", "text-red-400"); }
    },

    async bulkToggleShare(makePublic) {
        if (state.selected.size === 0) return;
        this.showToast(makePublic ? "Unlocking items..." : "Locking items...", "admin_panel_settings", "text-md-accent");
        let success = 0;
        for (const [id, item] of state.selected) {
            const res = await api.toggleShare(id, item.type, makePublic);
            if (res.status === 200) success++;
        }
        state.selected.clear();
        this.updateSelectionUI();
        this.showToast(`${success} items updated`, "check_circle", "text-green-400");
        this.loadDrive(true);
    },

    // NEW: Updates Menu dynamically depending on Star/Trash statuses
    openItemMenu(e, id, type, name, isPublic = false, shareId, isStarred = false, isTrash = false) {
        e.stopPropagation();
        state.activeMenuTarget = { id, type, name, isPublic, shareId, isStarred, isTrash };
        
        const menu = document.getElementById('itemMenu');
        const copyBtn = document.getElementById('menuItemCopyLink');
        const pubBtnIcon = document.getElementById('menuItemTogglePublicIcon');
        const pubBtnText = document.getElementById('menuItemTogglePublicText');
        
        if (isPublic) { pubBtnIcon.textContent = 'link_off'; pubBtnText.textContent = 'Revoke Link'; copyBtn.classList.remove('hidden'); } 
        else { pubBtnIcon.textContent = 'public'; pubBtnText.textContent = 'Make Public'; copyBtn.classList.add('hidden'); }

        const starIcon = document.getElementById('menuItemToggleStarIcon');
        const starText = document.getElementById('menuItemToggleStarText');
        if (isStarred) { starIcon.classList.add('filled', 'text-yellow-500'); starText.textContent = "Unstar"; } 
        else { starIcon.classList.remove('filled', 'text-yellow-500'); starText.textContent = "Add to Starred"; }

        const trashIcon = document.getElementById('menuItemToggleTrashIcon');
        const trashText = document.getElementById('menuItemToggleTrashText');
        const permDeleteBtn = document.getElementById('menuItemPermanentDelete');
        if (isTrash) { trashIcon.textContent = 'restore_from_trash'; trashText.textContent = 'Restore'; permDeleteBtn.classList.remove('hidden'); } 
        else { trashIcon.textContent = 'delete'; trashText.textContent = 'Move to Trash'; permDeleteBtn.classList.add('hidden'); }
        
        const rect = e.currentTarget.getBoundingClientRect();
        menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
        menu.style.left = rect.right - 192 < 10 ? `10px` : `${rect.right - 192}px`;
        menu.classList.remove('hidden');
    },

    async loadDrive(fetchData = true) {
        if (fetchData) {
            const response = await api.getDrive(state.currentFolderId);
            if (response.status === 401 || response.status === 403) return auth.showAuth();
            if (response.status !== 200) return this.showToast("Database Error", "error", "text-red-400");
            if (!auth.view.classList.contains('hidden')) auth.showDashboard(response.data.username, false);
            state.currentData = { folders: response.data.folders, files: response.data.files };
        }
        this.renderBreadcrumbs();
        this.renderContent();
    },

    async performSearch(query) {
        const res = await api.search(query);
        if (res.status === 200) {
            state.currentData = { folders: res.data.folders, files: res.data.files };
            document.getElementById('breadcrumbContainer').innerHTML = `<span class="px-3 py-1.5 text-md-accent font-medium bg-md-active rounded-[8px]">Search Results for "${query}"</span>`;
            this.renderContent();
        }
    },

    setSort(by, forceOrder = null) {
        if (forceOrder) { state.sortOrder = forceOrder; } 
        else {
            if (state.sortBy === by) state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
            else state.sortOrder = 'asc';
        }
        state.sortBy = by;
        localStorage.setItem('rcloud_sort', state.sortBy);
        localStorage.setItem('rcloud_sortOrder', state.sortOrder);
        
        const map = { 'name': 'Name', 'date': 'Date Modified', 'size': 'File Size' };
        document.getElementById('sortIndicatorLabel').textContent = map[state.sortBy];
        document.getElementById('sortIndicatorIcon').textContent = state.sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward';
        document.getElementById('sortMenu').classList.add('hidden');
        this.renderContent();
    },

    sortArray(arr) {
        return arr.sort((a, b) => {
            let valA, valB;
            if (state.sortBy === 'name') { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }
            else if (state.sortBy === 'date') { valA = new Date(a.date).getTime() || 0; valB = new Date(b.date).getTime() || 0; }
            else if (state.sortBy === 'size') { valA = a.size || 0; valB = b.size || 0; }
            if (valA < valB) return state.sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return state.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    },

    renderContent() {
        this.foldersGrid.innerHTML = '';
        this.filesGrid.innerHTML = '';

        let { folders, files } = state.currentData;
        folders = this.sortArray([...folders]);
        files = this.sortArray([...files]);

        const isSelectionMode = state.selected.size > 0;
        const isList = state.viewMode === 'list';
        
        const foldersHeader = document.getElementById('foldersHeader');
        const filesHeader = document.getElementById('filesHeader');

        if (folders.length === 0 && files.length === 0) {
            if (foldersHeader) foldersHeader.classList.add('hidden');
            if (filesHeader) filesHeader.classList.add('hidden');
            this.filesGrid.className = '';
            
            let emptyIcon = 'folder_open';
            if (state.currentView === 'starred') emptyIcon = 'star';
            if (state.currentView === 'trash') emptyIcon = 'delete';

            this.filesGrid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-24 text-md-text-muted">
                    <span class="material-symbols-rounded text-[64px] mb-4 opacity-50">${emptyIcon}</span>
                    <p class="text-[16px] font-medium">Nothing to see here</p>
                </div>`;
            return;
        }

        this.foldersGrid.className = isList ? 'flex flex-col mb-8' : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-8';
        this.filesGrid.className = isList ? 'flex flex-col pb-24' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-24';

        if (folders.length > 0) {
            if (foldersHeader) foldersHeader.classList.remove('hidden');
            folders.forEach(f => {
                const safeId = String(f.id);
                const isSel = state.selected.has(safeId);
                const bgClass = isSel ? 'bg-[#004a77]/30 border-md-accent' : 'bg-md-bg border-transparent hover:border-[#444746]';
                const isShared = f.is_public === 1;
                const folderIconName = isShared ? 'folder_shared' : 'folder';
                const starBadge = f.is_starred === 1 ? `<span class="material-symbols-rounded filled text-yellow-500 text-[16px] ml-2">star</span>` : '';
                
                const card = document.createElement('div');
                card.onclick = () => {
                    if (isSelectionMode) { this.toggleSelect(safeId, 'folder', f.name); } 
                    else { if (f.is_trash !== 1) { state.currentFolderId = f.id; state.path.push({ id: f.id, name: f.name }); this.loadDrive(true); } }
                };
                
                if (isList) {
                    card.className = `flex items-center justify-between p-3 border-b border-[#444746] ${bgClass} hover:bg-md-hover transition cursor-pointer group`;
                    card.innerHTML = `
                        <div class="flex items-center flex-1 overflow-hidden pointer-events-none">
                            <div class="relative shrink-0 pointer-events-auto cursor-pointer flex items-center justify-center mr-4" onclick="event.stopPropagation(); ui.toggleSelect('${safeId}', 'folder', '${f.name.replace(/'/g, "\\'")}')">
                                ${isSel ? `<span class="material-symbols-rounded filled text-md-accent text-[24px]">check_circle</span>` : `<span class="material-symbols-rounded filled text-md-text-muted text-[24px] group-hover:text-md-text transition">${folderIconName}</span>`}
                            </div>
                            <span class="text-[14px] font-medium text-md-text truncate">${f.name}</span>
                            ${starBadge}
                        </div>
                        <div class="flex items-center shrink-0 w-32 hidden md:flex text-md-text-muted text-[13px]">${this.formatDate(f.date)}</div>
                        <div class="flex items-center shrink-0 w-20 hidden md:flex text-md-text-muted text-[13px]">--</div>
                        <div class="flex items-center shrink-0 ml-4 pointer-events-auto">
                            <button onclick="ui.openItemMenu(event, '${safeId}', 'folder', '${f.name.replace(/'/g, "\\'")}', ${isShared}, '${f.share_id}', ${f.is_starred === 1}, ${f.is_trash === 1})" class="material-symbols-rounded text-md-text-muted hover:text-md-text text-[20px] transition p-1">more_vert</button>
                        </div>
                    `;
                } else {
                    card.className = `flex justify-between items-center ${bgClass} rounded-[16px] py-3.5 px-4 cursor-pointer transition border group`;
                    card.innerHTML = `
                        <div class="flex items-center overflow-hidden w-full pointer-events-none">
                            <div class="relative shrink-0 pointer-events-auto cursor-pointer flex items-center justify-center mr-4" onclick="event.stopPropagation(); ui.toggleSelect('${safeId}', 'folder', '${f.name.replace(/'/g, "\\'")}')">
                                ${isSel ? `<span class="material-symbols-rounded filled text-md-accent text-[28px]">check_circle</span>` : `<span class="material-symbols-rounded filled text-md-text-muted text-[28px] transition hover:text-md-text">${folderIconName}</span>`}
                            </div>
                            <div class="flex flex-col overflow-hidden">
                                <div class="flex items-center">
                                    <span class="text-[15px] font-medium text-md-text truncate">${f.name}</span>${starBadge}
                                </div>
                                <span class="text-[11px] text-md-text-muted mt-0.5">${this.formatDate(f.date)}</span>
                            </div>
                        </div>
                        <div class="flex items-center shrink-0 ml-2">
                            <button onclick="ui.openItemMenu(event, '${safeId}', 'folder', '${f.name.replace(/'/g, "\\'")}', ${isShared}, '${f.share_id}', ${f.is_starred === 1}, ${f.is_trash === 1})" class="material-symbols-rounded text-md-text-muted hover:text-md-text text-[24px] transition cursor-pointer pointer-events-auto">more_vert</button>
                        </div>
                    `;
                }
                this.foldersGrid.appendChild(card);
            });
        } else { if (foldersHeader) foldersHeader.classList.add('hidden'); }

        if (files.length > 0) {
            if (filesHeader) filesHeader.classList.remove('hidden');
            files.forEach(file => {
                const safeId = String(file.id);
                const isSel = state.selected.has(safeId);
                const bgClass = isSel ? 'bg-[#004a77]/30 border-md-accent' : 'bg-md-bg border-transparent hover:border-[#444746]';
                
                const fileType = this.getFileIcon(file.name);
                const ext = file.name.split('.').pop().toLowerCase();
                const isShared = file.is_public === 1;
                const starBadge = file.is_starred === 1 ? `<span class="material-symbols-rounded filled text-yellow-500 text-[16px] ml-2">star</span>` : '';
                
                const card = document.createElement('div');
                card.onclick = () => { if (isSelectionMode) this.toggleSelect(safeId, 'file', file.name); else if (file.is_trash !== 1) this.openPreview(safeId, file.name); };

                if (isList) {
                    card.className = `flex items-center justify-between p-3 border-b border-[#444746] ${bgClass} hover:bg-md-hover transition cursor-pointer group`;
                    card.innerHTML = `
                        <div class="flex items-center flex-1 overflow-hidden pointer-events-none">
                            <div class="relative shrink-0 pointer-events-auto cursor-pointer flex items-center justify-center mr-4" onclick="event.stopPropagation(); ui.toggleSelect('${safeId}', 'file', '${file.name.replace(/'/g, "\\'")}')">
                                ${isSel ? `<span class="material-symbols-rounded filled text-md-accent text-[24px]">check_circle</span>` : `<span class="material-symbols-rounded filled ${fileType.color} text-[24px]">${fileType.icon}</span>`}
                            </div>
                            <span class="text-[14px] font-medium text-md-text truncate">${file.name}</span>
                            ${starBadge}
                        </div>
                        <div class="flex items-center shrink-0 w-32 hidden md:flex text-md-text-muted text-[13px]">${this.formatDate(file.date)}</div>
                        <div class="flex items-center shrink-0 w-20 hidden md:flex text-md-text-muted text-[13px]">${this.formatSize(file.size)}</div>
                        <div class="flex items-center shrink-0 ml-4 pointer-events-auto">
                            <button onclick="ui.openItemMenu(event, '${safeId}', 'file', '${file.name.replace(/'/g, "\\'")}', ${isShared}, '${file.share_id}', ${file.is_starred === 1}, ${file.is_trash === 1})" class="material-symbols-rounded text-md-text-muted hover:text-md-text text-[20px] transition p-1">more_vert</button>
                        </div>
                    `;
                } else {
                    // NEW: Optimized Server Thumbnails for Grid View!
                    let thumbnailHTML = `<span class="material-symbols-rounded text-[48px] ${fileType.color}">${fileType.icon}</span>`;
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext)) {
                        thumbnailHTML = `<img src="/api/thumbnail/${file.id}" loading="lazy" class="w-full h-full object-cover rounded-[8px]">`;
                        if (['mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext)) {
                            thumbnailHTML += `<div class="absolute inset-0 flex items-center justify-center bg-black/30 rounded-[8px]"><span class="material-symbols-rounded text-white drop-shadow-lg text-[32px]">play_circle</span></div>`;
                        }
                    } 

                    card.className = `flex flex-col ${bgClass} rounded-[12px] overflow-hidden cursor-pointer transition border group`;
                    card.innerHTML = `
                        <div class="h-32 bg-md-surface m-1.5 rounded-[8px] flex items-center justify-center relative pointer-events-none">
                            ${thumbnailHTML}
                            <div class="absolute top-2 left-2 pointer-events-auto cursor-pointer z-10" onclick="event.stopPropagation(); ui.toggleSelect('${safeId}', 'file', '${file.name.replace(/'/g, "\\'")}')">
                                ${isSel ? `<span class="material-symbols-rounded filled text-md-accent text-[24px] bg-md-surface rounded-full shadow-sm">check_circle</span>` : `<span class="material-symbols-rounded text-md-text-muted text-[24px] ${isSelectionMode?'opacity-100':'opacity-0 group-hover:opacity-100'} transition drop-shadow-md">radio_button_unchecked</span>`}
                            </div>
                        </div>
                        <div class="px-3 pb-3 pt-1 flex justify-between items-center relative">
                            <div class="flex flex-col overflow-hidden w-full pointer-events-none">
                                <div class="flex items-center mb-0.5">
                                    <span class="material-symbols-rounded filled ${fileType.color} text-[16px] mr-2 shrink-0">${fileType.icon}</span>
                                    <span class="text-[13px] font-medium text-md-text truncate" title="${file.name}">${file.name}</span>
                                    ${starBadge}
                                </div>
                                <span class="text-[11px] text-md-text-muted">${this.formatSize(file.size)} • ${this.formatDate(file.date)}</span>
                            </div>
                            <div class="flex items-center shrink-0 ml-2">
                                <button onclick="ui.openItemMenu(event, '${safeId}', 'file', '${file.name.replace(/'/g, "\\'")}', ${isShared}, '${file.share_id}', ${file.is_starred === 1}, ${file.is_trash === 1})" class="material-symbols-rounded text-md-text-muted hover:text-md-text text-[24px] transition cursor-pointer pointer-events-auto">more_vert</button>
                            </div>
                        </div>
                    `;
                }
                this.filesGrid.appendChild(card);
            });
        } else { if (filesHeader) filesHeader.classList.add('hidden'); }
    },

    setClipboard(action, itemsArray) {
        state.clipboard.action = action;
        state.clipboard.items = itemsArray.map(item => ({ id: item.id, type: item.type })); 
        const bar = document.getElementById('clipboardBar');
        document.getElementById('clipboardText').textContent = `${itemsArray.length} item(s) to ${action}`;
        bar.classList.remove('hidden'); setTimeout(() => bar.classList.remove('opacity-0', 'translate-y-10'), 10); 
        this.clearSelection();
    },

    clearClipboard() {
        state.clipboard = { action: null, items: [] };
        const bar = document.getElementById('clipboardBar');
        bar.classList.add('opacity-0', 'translate-y-10');
        setTimeout(() => bar.classList.add('hidden'), 300);
    },

    async pasteClipboard() {
        if (state.clipboard.items.length === 0) return;
        const { action, items } = state.clipboard;
        const targetFolder = state.currentFolderId;
        this.showToast(`${action === 'copy' ? 'Copying' : 'Moving'} items...`, "content_paste", "text-md-accent");
        
        const res = action === 'copy' ? await api.copyItems(items, targetFolder) : await api.moveItems(items, targetFolder);
        if (res.status === 200) { this.showToast(`Successfully pasted!`, "check_circle", "text-green-400"); this.clearClipboard(); this.loadDrive(true); } 
        else { this.showToast("Failed to paste items", "error", "text-red-400"); }
    },

    async toggleShare(id, type, makePublic, shareId) {
        this.showToast(makePublic ? "Generating link..." : "Revoking link...", "link", "text-md-accent");
        const res = await api.toggleShare(id, type, makePublic);
        if (res.status === 200) {
            if (makePublic) {
                const link = `${window.location.origin}/share/${type}/${shareId}`;
                try { await navigator.clipboard.writeText(link); this.showToast("Link copied to clipboard!", "content_copy", "text-green-400"); } 
                catch (err) { prompt("Your public link is ready. Copy it below:", link); this.showToast("Link generated!", "check_circle", "text-green-400"); }
            } else { this.showToast("Link disabled (Private)", "lock", "text-md-text-muted"); }
            this.loadDrive(true);
        } else { this.showToast("Failed to change permissions", "error", "text-red-400"); }
    },

    openPreview(id, name) {
        const ext = name.split('.').pop().toLowerCase();
        const modal = document.getElementById('previewModal'); const content = document.getElementById('previewContent'); const downloadBtn = document.getElementById('downloadPreviewBtn');
        document.getElementById('previewFilename').textContent = name; downloadBtn.onclick = () => window.location.href = `/api/download/${id}`; content.innerHTML = ''; 
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) { content.innerHTML = `<img src="/api/view/${id}" class="max-w-full max-h-full object-contain drop-shadow-2xl">`; } 
        else if (['mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext)) { content.innerHTML = `<video src="/api/view/${id}" controls autoplay class="max-w-full max-h-full object-contain drop-shadow-2xl outline-none rounded-md bg-black"></video>`; } 
        else { content.innerHTML = `<div class="flex flex-col items-center text-md-text-muted"><span class="material-symbols-rounded text-[80px] mb-4">description</span><p class="mb-6">No preview available for this file type.</p><a href="/api/download/${id}" class="px-8 py-3 bg-md-active text-md-accent rounded-full font-medium hover:bg-[#005a8f] transition shadow-lg flex items-center"><span class="material-symbols-rounded mr-2">download</span> Download File</a></div>`; }
        modal.classList.remove('hidden'); setTimeout(() => modal.classList.remove('opacity-0'), 50);
    },

    closePreview() { const modal = document.getElementById('previewModal'); modal.classList.add('opacity-0'); setTimeout(() => { modal.classList.add('hidden'); document.getElementById('previewContent').innerHTML = ''; }, 300); },

    uploadQueue(files) {
        const panel = document.getElementById('uploadQueuePanel'); const list = document.getElementById('uploadList'); panel.classList.remove('hidden');
        files.forEach(file => {
            const fileId = 'upload-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            const item = document.createElement('div'); item.id = fileId; item.className = "p-3 border-b border-[#444746] flex flex-col bg-md-surface";
            item.innerHTML = `
                <div class="flex justify-between items-center mb-2"><span class="text-[13px] font-medium text-md-text truncate pr-2">${file.name}</span><span class="material-symbols-rounded text-[18px] text-md-text-muted status-icon">pending</span></div>
                <div class="w-full bg-[#444746] rounded-full h-1.5 overflow-hidden"><div class="bg-md-accent h-1.5 rounded-full progress-bar transition-all duration-200" style="width: 0%"></div></div>`;
            list.prepend(item); this.executeUpload(file, fileId);
        });
        this.updateUploadTitle();
    },

    executeUpload(file, uiId) {
        const formData = new FormData(); formData.append('file', file);
        if (state.currentFolderId) formData.append('folderId', state.currentFolderId);
        const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/upload', true); xhr.withCredentials = true;
        const itemUI = document.getElementById(uiId); const progressBar = itemUI.querySelector('.progress-bar'); const statusIcon = itemUI.querySelector('.status-icon');
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) { progressBar.style.width = ((event.loaded / event.total) * 100) + '%'; } };
        xhr.onload = () => {
            if (xhr.status === 200) { progressBar.classList.replace('bg-md-accent', 'bg-green-400'); statusIcon.textContent = 'check_circle'; statusIcon.classList.add('text-green-400'); this.loadDrive(true); } 
            else { progressBar.classList.replace('bg-md-accent', 'bg-red-400'); statusIcon.textContent = 'error'; statusIcon.classList.add('text-red-400'); }
            this.updateUploadTitle();
        };
        xhr.onerror = () => { progressBar.classList.replace('bg-md-accent', 'bg-red-400'); statusIcon.textContent = 'error'; statusIcon.classList.add('text-red-400'); this.updateUploadTitle(); };
        xhr.send(formData);
    },

    updateUploadTitle() {
        const list = document.getElementById('uploadList'); const total = list.children.length; const completed = list.querySelectorAll('.bg-green-400, .bg-red-400').length; const title = document.getElementById('uploadQueueTitle');
        if (completed < total) title.textContent = `Uploading ${total - completed} item(s)...`; else title.textContent = `${completed} upload(s) complete`;
    },

    closeUploadQueue(e) { e.stopPropagation(); document.getElementById('uploadQueuePanel').classList.add('hidden'); document.getElementById('uploadList').innerHTML = ''; }
};
