document.addEventListener('DOMContentLoaded', () => {
    
    // Auth Interactions
    document.getElementById('loginBtn').addEventListener('click', () => auth.handleLogin());
    document.getElementById('registerBtn').addEventListener('click', () => auth.handleRegister());
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await api.logout();
        auth.showAuth();
    });

    // New Button Logic (Prompt menu to create folder or upload file)
    const fileInput = document.getElementById('hiddenFileInput');
    document.getElementById('newBtn').addEventListener('click', async () => {
        const action = prompt("Type '1' to upload a File, or '2' to create a New Folder:");
        
        if (action === '1') {
            fileInput.click();
        } else if (action === '2') {
            const folderName = prompt("Enter folder name:");
            if (folderName) {
                await api.createFolder(folderName, state.currentFolderId);
                ui.loadDrive();
            }
        }
    });
    
    // Handle the actual file upload after selecting it
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            ui.uploadFile(e.target.files[0]);
            fileInput.value = ''; 
        }
    });

    // Boot Up Engine
    ui.loadDrive();
});
