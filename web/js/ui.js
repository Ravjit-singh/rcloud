const ui = {
    grid: document.getElementById('filesGrid'),
    uploadStatus: document.getElementById('uploadStatus'),

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return { icon: 'image', color: 'text-md-accent' };
        if (['pdf'].includes(ext)) return { icon: 'picture_as_pdf', color: 'text-red-400' };
        if (['mp4', 'mkv'].includes(ext)) return { icon: 'movie', color: 'text-purple-400' };
        return { icon: 'description', color: 'text-blue-400' };
    },

    async loadFiles() {
        const response = await api.getFiles();
        
        if (response.status === 401 || response.status === 403) {
            return auth.showAuth(); // Token expired or missing
        }

        this.grid.innerHTML = '';
        
        if (!response.data.files || response.data.files.length === 0) {
            this.grid.innerHTML = `<p class="text-md-text-muted col-span-full">Your vault is empty.</p>`;
            return;
        }

        response.data.files.forEach(file => {
            const fileType = this.getFileIcon(file.name);
            const card = document.createElement('div');
            
            card.className = "flex flex-col bg-md-bg hover:bg-md-hover rounded-[12px] overflow-hidden transition border border-transparent hover:border-[#444746] group";
            card.innerHTML = `
                <div class="h-32 bg-md-surface m-1.5 rounded-[8px] flex items-center justify-center">
                    <span class="material-symbols-rounded text-[48px] ${fileType.color}">${fileType.icon}</span>
                </div>
                <div class="px-3 pb-3 pt-1 flex justify-between items-center">
                    <div class="flex items-center overflow-hidden pr-2">
                        <span class="material-symbols-rounded filled ${fileType.color} text-[20px] mr-2 shrink-0">${fileType.icon}</span>
                        <span class="text-[13px] font-medium text-md-text truncate" title="${file.name}">${file.name}</span>
                    </div>
                    <button onclick="ui.deleteFile('${file.id}')" class="material-symbols-rounded text-md-text-muted hover:text-red-400 text-[20px] transition shrink-0 opacity-0 group-hover:opacity-100">delete</button>
                </div>
            `;
            this.grid.appendChild(card);
        });
    },

    async uploadFile(file) {
        this.uploadStatus.textContent = "Uploading...";
        this.uploadStatus.classList.remove('opacity-0');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (res.status === 401 || res.status === 403) return auth.showAuth();
            
            this.uploadStatus.textContent = "Upload complete";
            setTimeout(() => this.uploadStatus.classList.add('opacity-0'), 2000);
            this.loadFiles();
        } catch (err) {
            this.uploadStatus.textContent = "Upload failed";
        }
    },

    async deleteFile(id) {
        if (!confirm("Delete this file permanently?")) return;
        const res = await api.deleteFile(id);
        if (res.status === 200) this.loadFiles();
    }
};
