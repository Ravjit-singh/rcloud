const API_URL = '/api';

const api = {
    async request(endpoint, options = {}) {
        try {
            options.credentials = 'same-origin'; 
            const res = await fetch(`${API_URL}${endpoint}`, options);
            const data = await res.json();
            return { status: res.status, data };
        } catch (err) { return { status: 500, data: { error: "Network error" } }; }
    },

    async register(u, p) { return this.request('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) }); },
    async login(u, p) { return this.request('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) }); },
    async logout() { return this.request('/logout', { method: 'POST' }); },
    
    // UPDATED: Dynamically pushes the View State to backend
    async getDrive(folderId = null) { 
        const viewQuery = state.currentView !== 'home' ? `?view=${state.currentView}` : '';
        const endpoint = folderId ? `/drive/${folderId}${viewQuery}` : `/drive${viewQuery}`;
        return this.request(endpoint); 
    },
    
    async createFolder(name, parentId) { return this.request('/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parentId }) }); },
    async deleteFile(id) { return this.request(`/delete/${id}`, { method: 'DELETE' }); },
    async deleteFolder(id) { return this.request(`/folders/${id}`, { method: 'DELETE' }); },
    async toggleShare(id, type, isPublic) { return this.request(`/share/${type}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic }) }); },
    
    // NEW: Star & Trash Engines
    async toggleTrash(id, type, isTrash) { return this.request(`/trash/${type}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isTrash }) }); },
    async toggleStar(id, type, isStarred) { return this.request(`/star/${type}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isStarred }) }); },
    async emptyTrash() { return this.request('/trash/empty', { method: 'DELETE' }); },

    async search(query) { return this.request(`/search?q=${encodeURIComponent(query)}`); },
    async copyItems(items, targetFolder) { return this.request('/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, targetFolder }) }); },
    async moveItems(items, targetFolder) { return this.request('/move', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, targetFolder }) }); },
    async updatePassword(currentPassword, newPassword) { return this.request('/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) }); },
    
    async downloadZip(items) {
        try {
            const res = await fetch(`${API_URL}/download/zip`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `RCloud_Export_${Date.now()}.zip`;
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
            return true;
        } catch (err) { return false; }
    }
};
