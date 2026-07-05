const auth = {
    view: document.getElementById('authView'),
    dashView: document.getElementById('dashboardView'),
    statusEl: document.getElementById('authStatus'),

    showDashboard(username = "U") {
        document.getElementById('profileInitial').textContent = username.charAt(0).toUpperCase();
        this.view.classList.add('hidden');
        this.dashView.classList.remove('hidden');
        
        // Small delay triggers the CSS opacity fade-in
        setTimeout(() => this.dashView.classList.remove('opacity-0'), 50);
        
        ui.loadDrive();
    },

    showAuth() {
        this.dashView.classList.add('opacity-0');
        setTimeout(() => {
            this.dashView.classList.add('hidden');
            this.view.classList.remove('hidden');
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            this.statusEl.textContent = '';
        }, 300);
    },

    async handleLogin() {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        this.statusEl.textContent = "Loading...";
        this.statusEl.className = "text-sm font-medium text-md-accent h-4";
        
        const res = await api.login(u, p);
        if (res.status === 200) {
            this.statusEl.textContent = "";
            this.showDashboard(res.data.username);
        } else {
            this.statusEl.textContent = res.data.error;
            this.statusEl.className = "text-sm font-medium text-red-400 h-4";
        }
    },

    async handleRegister() {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        this.statusEl.textContent = "Registering...";
        this.statusEl.className = "text-sm font-medium text-md-accent h-4";
        
        const res = await api.register(u, p);
        if (res.status === 200) {
            this.statusEl.textContent = "Success! Now login.";
            this.statusEl.className = "text-sm font-medium text-green-400 h-4";
        } else {
            this.statusEl.textContent = res.data.error;
            this.statusEl.className = "text-sm font-medium text-red-400 h-4";
        }
    }
};
