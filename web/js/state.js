const state = {
    currentFolderId: null,
    path: [{ id: null, name: "My Drive" }],
    
    selected: new Map(), 
    currentData: { folders: [], files: [] }, 
    activeMenuTarget: null, 
    
    clipboard: { action: null, items: [] },

    // NEW: View & Sort Engine State
    viewMode: localStorage.getItem('rcloud_view') || 'grid', // 'grid' or 'list'
    sortBy: localStorage.getItem('rcloud_sort') || 'name',   // 'name', 'date', 'size'
    sortOrder: localStorage.getItem('rcloud_sortOrder') || 'asc' // 'asc' or 'desc'
};
