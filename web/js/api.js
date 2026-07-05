const API_URL = '/api';

const api = {
    async request(endpoint, options = {}) {
        try {
            const res = await fetch(`${API_URL}${endpoint}`, options);
            const data = await res.json();
            return { status: res.status, data };
        } catch (err) {
            return { status: 500, data: { error: "Network error" } };
        }
    },

    async register(u, p) { return this.request('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) }); },
    async login(u, p) { return this.request('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) }); },
    async logout() { return this.request('/logout', { method: 'POST' }); },
    
    // Drive Navigation
    async getDrive(folderId = null) {
        const endpoint = folderId ? `/drive/${folderId}` : '/drive';
        return this.request(endpoint);
    },
    
    // Folder Creation
    async createFolder(name, parentId) {
        return this.request('/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parentId }) });
    },
    
    async deleteFile(id) { return this.request(`/delete/${id}`, { method: 'DELETE' }); }
};
