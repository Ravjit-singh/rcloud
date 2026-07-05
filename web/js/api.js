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

    async register(username, password) {
        return this.request('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
    },

    async login(username, password) {
        return this.request('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
    },

    async logout() {
        return this.request('/logout', { method: 'POST' });
    },

    async getFiles() {
        return this.request('/files');
    },

    async deleteFile(id) {
        return this.request(`/delete/${id}`, { method: 'DELETE' });
    }
};
