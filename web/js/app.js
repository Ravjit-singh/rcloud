document.addEventListener('DOMContentLoaded', () => {
    
    // Auth Buttons
    document.getElementById('loginBtn').addEventListener('click', () => auth.handleLogin());
    document.getElementById('registerBtn').addEventListener('click', () => auth.handleRegister());
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await api.logout();
        auth.showAuth();
    });

    // Upload Triggers
    const fileInput = document.getElementById('hiddenFileInput');
    document.getElementById('newBtn').addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            ui.uploadFile(e.target.files[0]);
            fileInput.value = ''; // Reset input
        }
    });

    // Boot Up - Try to fetch files immediately. If cookie exists, it jumps straight to Dashboard.
    ui.loadFiles();
});
