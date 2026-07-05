const ui = {
    foldersGrid: document.getElementById('foldersGrid'),
    filesGrid: document.getElementById('filesGrid'),
    uploadStatus: document.getElementById('uploadStatus'),
    
    // Automatically assigns a colorful MD3 icon based on the file type
    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { icon: 'image', color: 'text-md-accent' };
        if (['pdf'].includes(ext)) return { icon: 'picture_as_pdf', color: 'text-red-400' };
        if (['mp4', 'mkv', 'avi'].includes(ext)) return { icon: 'movie', color: 'text-purple-400' };
        if (['zip', 'rar', 'apk'].includes(ext)) return { icon: 'folder_zip', color: 'text-yellow-500' };
        if (['js', 'html', 'css', 'ts', 'json'].includes(ext)) return { icon: 'code', color: 'text-green-400' };
        return { icon: 'description', color: 'text-blue-400' };
    },

    renderBreadcrumbs() {
        // Selects the breadcrumb container from our index.html
        const container = document.querySelector('main > div:first-child');
        container.innerHTML = '';
        
        state.path.forEach((crumb, index) => {
            const btn = document.createElement('button');
            btn.className = "hover:bg-md-hover px-3 py-1.5 rounded-[8px] transition flex items-center";
            btn.innerHTML = `<span class="font-medium">${crumb.name}</span>`;
            
            // Allow clicking breadcrumbs to navigate back up the tree
            btn.onclick = () => {
                state.path = state.path.slice(0, index + 1);
                state.currentFolderId = crumb.id;
                this.loadDrive();
            };
            
            if (index > 0) {
                const sep = document.createElement('span');
                sep.className = "material-symbols-rounded text-md-text-muted mx-1";
                sep.textContent = "chevron_right";
                container.appendChild(sep);
            } else {
                btn.classList.add("-ml-3"); 
            }
            
            container.appendChild(btn);
        });
    },

    async loadDrive() {
        const response = await api.getDrive(state.currentFolderId);
        
        if (response.status === 401 || response.status === 403) return auth.showAuth();
        
        this.renderBreadcrumbs();
        
        this.foldersGrid.innerHTML = '';
        this.filesGrid.innerHTML = '';

        const { folders, files } = response.data;
        const folderHeader = this.foldersGrid.parentElement.querySelector('h3:nth-of-type(1)');
        
        // Render Folders
        if (folders.length === 0) {
            folderHeader.classList.add('hidden');
        } else {
            folderHeader.classList.remove('hidden');
            folders.forEach(f => {
                const card = document.createElement('div');
                card.className = "flex items-center bg-md-bg hover:bg-md-hover rounded-[12px] p-3 cursor-pointer transition border border-transparent hover:border-[#444746]";
                card.innerHTML = `
                    <span class="material-symbols-rounded filled text-md-text-muted text-[24px] mr-3">folder</span>
                    <span class="text-[14px] font-medium text-md-text truncate">${f.name}</span>
                `;
                // Double click to enter folder
                card.onclick = () => {
                    state.currentFolderId = f.id;
                    state.path.push({ id: f.id, name: f.name });
                    this.loadDrive();
                };
                this.foldersGrid.appendChild(card);
            });
        }

        // Render Files
        if (files.length === 0) {
            this.filesGrid.innerHTML = `<p class="text-md-text-muted col-span-full">This folder is empty.</p>`;
        } else {
            files.forEach(file => {
                const fileType = this.getFileIcon(file.name);
                const card = document.createElement('div');
                card.className = "flex flex-col bg-md-bg hover:bg-md-hover rounded-[12px] overflow-hidden cursor-pointer transition border border-transparent hover:border-[#444746] group";
                card.innerHTML = `
                    <div class="h-32 bg-md-surface m-1.5 rounded-[8px] flex items-center justify-center relative">
                        <span class="material-symbols-rounded text-[48px] ${fileType.color}">${fileType.icon}</span>
                    </div>
                    <div class="px-3 pb-3 pt-1 flex justify-between items-center">
                        <div class="flex items-center overflow-hidden pr-2">
                            <span class="material-symbols-rounded filled ${fileType.color} text-[20px] mr-2 shrink-0">${fileType.icon}</span>
                            <span class="text-[13px] font-medium text-md-text truncate" title="${file.name}">${file.name}</span>
                        </div>
                        <button onclick="event.stopPropagation(); ui.deleteFile('${file.id}')" class="material-symbols-rounded text-md-text-muted hover:text-red-400 text-[20px] transition shrink-0 opacity-0 group-hover:opacity-100">delete</button>
                    </div>
                `;
                this.filesGrid.appendChild(card);
            });
        }
    },

    async uploadFile(file) {
        this.uploadStatus.textContent = "Uploading...";
        this.uploadStatus.classList.remove('opacity-0');

        const formData = new FormData();
        formData.append('file', file);
        if (state.currentFolderId) formData.append('folderId', state.currentFolderId);

        try {
            // Using raw fetch here since FormData doesn't use standard JSON headers
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (res.status === 401 || res.status === 403) return auth.showAuth();
            
            this.uploadStatus.textContent = "Upload complete";
            setTimeout(() => this.uploadStatus.classList.add('opacity-0'), 2000);
            this.loadDrive();
        } catch (err) {
            this.uploadStatus.textContent = "Upload failed";
        }
    },

    async deleteFile(id) {
        if (!confirm("Delete this file permanently?")) return;
        const res = await api.deleteFile(id);
        if (res.status === 200) this.loadDrive();
    }
};
