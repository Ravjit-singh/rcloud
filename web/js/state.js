const state = {
    currentFolderId: null,
    path: [{ id: null, name: "My Drive" }],
    
    selected: new Map(), 
    currentData: { folders: [], files: [] }, 
    activeMenuTarget: null, 
    
    clipboard: { action: null, items: [] },

    currentView: 'home', // 'home', 'starred', 'shared', 'trash'
    
    viewMode: localStorage.getItem('rcloud_view') || 'grid',
    sortBy: localStorage.getItem('rcloud_sort') || 'name',
    sortOrder: localStorage.getItem('rcloud_sortOrder') || 'asc'
};
