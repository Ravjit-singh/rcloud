const auth = {
    view: document.getElementById('authView'),
    dash: document.getElementById('dashboardView'),
    status: document.getElementById('authStatus'),

    async handleLogin() {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        if (!u || !p) return this.showError("Please enter both fields");
        
        this.showError("Authenticating...", "text-md-text-muted");
        const res = await api.login(u, p);
        if (res.status === 200) {
            this.showDashboard(res.data.username);
        } else {
            // Displays brute force lock text elegantly
            this.showError(res.data.error || "Invalid credentials"); 
        }
    },

    async handleRegister() {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        if (!u || !p) return this.showError("Please enter both fields");
        
        this.showError("Creating account...", "text-md-text-muted");
        const res = await api.register(u, p);
        if (res.status === 200) {
            this.showError("Account pending admin approval.", "text-green-400");
            document.getElementById('password').value = '';
        } else {
            this.showError(res.data.error || "Registration failed");
        }
    },

    showError(msg, color = "text-red-400") {
        this.status.textContent = msg;
        this.status.className = `text-sm font-medium h-4 ${color} text-center`;
    },

    showAuth() {
        this.dash.classList.add('hidden');
        this.view.classList.remove('hidden');
        setTimeout(() => this.view.classList.remove('opacity-0'), 10);
    },

    showDashboard(username, initialLoad = true) {
        document.getElementById('profileInitial').textContent = username.charAt(0).toUpperCase();
        this.view.classList.add('opacity-0');
        setTimeout(() => {
            this.view.classList.add('hidden');
            this.dash.classList.remove('hidden');
            setTimeout(() => this.dash.classList.remove('opacity-0'), 10);
            if(initialLoad) {
                ui.loadDrive();
                ui.updateStorage(); // Call the quota tracker
            }
        }, 300);
    }
};
