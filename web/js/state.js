const state = {
    currentFolderId: null,
    path: [{ id: null, name: "My Drive" }],
    
    selected: new Map(), 
    currentData: { folders: [], files: [] }, 
    activeMenuTarget: null, 
    
    // NEW: Virtual Clipboard Engine
    clipboard: {
        action: null, // 'copy' or 'cut'
        items: []     // Array of { id, type, name }
    }
};
