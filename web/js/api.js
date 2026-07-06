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
    async getDrive(folderId = null) { return this.request(folderId ? `/drive/${folderId}` : '/drive'); },
    async createFolder(name, parentId) { return this.request('/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parentId }) }); },
    async deleteFile(id) { return this.request(`/delete/${id}`, { method: 'DELETE' }); },
    async deleteFolder(id) { return this.request(`/folders/${id}`, { method: 'DELETE' }); },
    async toggleShare(id, type, isPublic) { return this.request(`/share/${type}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic }) }); },
    
    // NEW SEARCH ROUTE
    async search(query) { return this.request(`/search?q=${encodeURIComponent(query)}`); },
    
    async copyItems(items, targetFolder) { return this.request('/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, targetFolder }) }); },
    async moveItems(items, targetFolder) { return this.request('/move', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, targetFolder }) }); },
    
    async updatePassword(currentPassword, newPassword) {
        return this.request('/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
    }
};
