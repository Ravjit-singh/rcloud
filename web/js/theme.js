const theme = {
    colors: {
        dark: {
            '--md-bg': '#131314', '--md-surface': '#1e1f20', '--md-hover': '#282a2c',
            '--md-text': '#e3e3e3', '--md-text-muted': '#c4c7c5', '--md-accent': '#a8c7fa',
            '--md-active': '#004a77', '--md-fab': '#c2e7ff', '--md-fab-text': '#001d35'
        },
        light: {
            '--md-bg': '#fdfcff', '--md-surface': '#edf0f6', '--md-hover': '#e0e2e8',
            '--md-text': '#1a1c1e', '--md-text-muted': '#43474e', '--md-accent': '#0061a4',
            '--md-active': '#d1e4ff', '--md-fab': '#c2e7ff', '--md-fab-text': '#001d35'
        }
    },
    
    init() {
        const saved = localStorage.getItem('rcloud_theme') || 'device';
        this.set(saved, false);
    },

    set(mode, save = true) {
        if (save) localStorage.setItem('rcloud_theme', mode);
        
        let activeMode = mode;
        if (mode === 'device') {
            activeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        const root = document.documentElement;
        const palette = this.colors[activeMode];
        
        for (const [key, value] of Object.entries(palette)) {
            root.style.setProperty(key, value);
        }
    }
};

// Execute immediately to prevent "flashing" on page load
theme.init();

// Auto-switch if the user's OS changes themes while the app is open
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem('rcloud_theme') === 'device') theme.set('device', false);
});
