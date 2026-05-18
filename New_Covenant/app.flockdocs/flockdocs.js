/* ══════════════════════════════════════════════════════════════════════════════
   FLOCKDOCS.JS — FlockDocs Productivity Suite
   "Write the vision and make it plain on tablets." — Habakkuk 2:2

   This is the main entry point for the FlockDocs app — a productivity suite
   for churches including word processing, spreadsheets, and document management.

   Features:
     • Rich text document editor
     • Private user documents
     • Shared church documents
     • Folder organization
     • Real-time Firestore sync
     • Collaborative editing (future)
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Constants ───────────────────────────────────────────────────────────── */
const STORE_KEY_PREFS = 'fd_prefs';
const COLLECTION_DOCS = 'flockDocs';
const COLLECTION_FOLDERS = 'flockFolders';

/* ── State ────────────────────────────────────────────────────────────────── */
const S = {
  user: null,              // { uid, displayName, email, role }
  currentView: 'all-docs', // 'all-docs' | 'my-docs' | 'shared-docs' | 'recent' | 'trash'
  currentDoc: null,        // Currently open document
  documents: [],           // All documents (filtered based on view)
  folders: [],             // Folder list
  currentFolder: null,     // Current folder filter
  searchQuery: '',         // Search filter
  autoSaveTimer: null,     // Auto-save debounce timer
  prefs: {
    defaultFontSize: 16,
    defaultFont: 'Noto Serif',
  },
  sheet: {                 // FlockSheets editor state
    data: {},              // { 'A1': { v: '', f: '', s: { bold, fmt, bg, color, border } } }
    selected: null,        // Currently selected cell ref e.g. 'A1'
    isEditing: false,      // Is a cell currently being inline-edited?
    colWidths: {},         // { 'A': 100, 'B': 150 }
    rows: 50,
    cols: 26,
    autoSaveTimer: null,
    // Session 3 state
    clipboard: null,       // Deep copy of a cell's data for copy/paste
    copyRef: null,         // Ref of the cell being copied (for visual indicator)
    filterActive: false,   // Is filter mode on?
    filterValues: {},      // { col: Set<string> } — allowed values per column
    hiddenRows: new Set(), // Row numbers hidden by current filters
    freezeRow: false,      // Freeze first data row
    freezeCol: false,      // Freeze first data column
    sortCol: null,         // Last sorted column letter
    sortAsc: true,         // Sort direction
  },
};

/* ── Initialization ───────────────────────────────────────────────────────── */
window.FlockDocs = {
  init,
  createNewDocument,
  createNewSpreadsheet,
  openDocument,
  saveDocument,
  deleteDocument,
  switchView,
};

// Wait for firm_foundation.js to complete auth
window.addEventListener('DOMContentLoaded', () => {
  // firm_foundation.js will call our init after auth completes
  if (window.firmFoundationReady) {
    init();
  } else {
    window.addEventListener('firm-foundation-ready', init);
  }
});

function init() {
  console.log('[FlockDocs] Initializing...');
  
  // Get authenticated user from firm_foundation
  if (typeof getCurrentUser === 'function') {
    S.user = getCurrentUser();
  }
  
  if (!S.user) {
    console.error('[FlockDocs] No authenticated user found');
    return;
  }

  _loadPrefs();
  _bindEvents();
  _loadDocuments();
  _loadFolders();
  
  console.log('[FlockDocs] Ready');
}

/* ── Preferences ──────────────────────────────────────────────────────────── */
function _loadPrefs() {
  try {
    const raw = localStorage.getItem(STORE_KEY_PREFS);
    if (raw) Object.assign(S.prefs, JSON.parse(raw));
  } catch (_) { /* ignore */ }
}

function _savePrefs() {
  try {
    localStorage.setItem(STORE_KEY_PREFS, JSON.stringify(S.prefs));
  } catch (_) {}
}

/* ── Event Bindings ───────────────────────────────────────────────────────── */
function _bindEvents() {
  // Mobile menu toggle
  document.getElementById('fd-menu-btn')?.addEventListener('click', () => {
    document.getElementById('fd-sidebar-wrap')?.classList.toggle('is-open');
  });

  // New document button (default: create document)
  document.getElementById('fd-new-doc-btn')?.addEventListener('click', createNewDocument);

  // New document type dropdown toggle
  document.getElementById('fd-new-type-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('fd-new-menu')?.classList.toggle('hidden');
  });

  // Sidebar view buttons
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  // Search input
  document.getElementById('fd-search-input')?.addEventListener('input', (e) => {
    S.searchQuery = e.target.value.toLowerCase();
    _renderDocuments();
  });

  // Editor toolbar
  document.querySelectorAll('[data-format]').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.format;
      _execCommand(format);
    });
  });

  // Format select
  document.getElementById('fd-format-select')?.addEventListener('change', (e) => {
    _execCommand('formatBlock', e.target.value);
  });

  // Back button (document editor)
  document.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    _closeEditor();
  });

  // Save button (document editor)
  document.getElementById('fd-save-btn')?.addEventListener('click', saveDocument);

  // Editor content - auto-save on input
  document.getElementById('fd-editor-content')?.addEventListener('input', () => {
    _autoSave();
  });

  // ── Spreadsheet toolbar events ─────────────────────────────────────────
  document.getElementById('fd-sheet-back-btn')?.addEventListener('click', _closeSpreadsheetEditor);
  document.getElementById('fd-sheet-save-btn')?.addEventListener('click', _saveSpreadsheet);
  document.getElementById('fs-bold-btn')?.addEventListener('click', _toggleCellBold);
  document.querySelectorAll('.fs-fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => _setCellFormat(btn.dataset.fmt));
  });

  // Color pickers
  document.getElementById('fs-bg-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    _toggleColorPopup('bg');
  });
  document.getElementById('fs-tc-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    _toggleColorPopup('tc');
  });

  // Border picker
  document.getElementById('fs-border-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    _toggleBorderPopup();
  });

  // Sort
  document.getElementById('fs-sort-asc-btn')?.addEventListener('click', () => {
    const col = S.sheet.selected ? _parseRef(S.sheet.selected).col : 'A';
    _sortByColumn(col, true);
  });
  document.getElementById('fs-sort-desc-btn')?.addEventListener('click', () => {
    const col = S.sheet.selected ? _parseRef(S.sheet.selected).col : 'A';
    _sortByColumn(col, false);
  });

  // Filter toggle
  document.getElementById('fs-filter-btn')?.addEventListener('click', _toggleFilter);

  // Fill down / right
  document.getElementById('fs-fill-down-btn')?.addEventListener('click', _fillDown);
  document.getElementById('fs-fill-right-btn')?.addEventListener('click', _fillRight);

  // Freeze
  document.getElementById('fs-freeze-btn')?.addEventListener('click', _toggleFreeze);

  // Formula bar input
  document.getElementById('fs-formula-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = e.target.value;
      if (S.sheet.selected) _setCellValue(S.sheet.selected, val);
      _commitFormulaBarEdit();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      _updateFormulaBar();
    }
  });
  document.getElementById('fs-formula-input')?.addEventListener('blur', () => {
    const val = document.getElementById('fs-formula-input')?.value ?? '';
    if (S.sheet.selected) _setCellValue(S.sheet.selected, val);
    _refreshCell(S.sheet.selected);
    _autoSaveSheet();
  });

  // Grid keyboard navigation
  document.getElementById('fd-grid-wrap')?.addEventListener('keydown', _onGridKeydown);

  // Close all popups when clicking outside
  document.addEventListener('click', (e) => {
    // New-doc dropdown
    const menu = document.getElementById('fd-new-menu');
    const wrap = document.getElementById('fd-new-btn-wrap');
    if (menu && !menu.classList.contains('hidden') && !wrap?.contains(e.target)) {
      menu.classList.add('hidden');
    }
    // Mobile sidebar
    const sidebar = document.getElementById('fd-sidebar-wrap');
    const menuBtn = document.getElementById('fd-menu-btn');
    if (sidebar?.classList.contains('is-open') &&
        !sidebar.contains(e.target) &&
        !menuBtn.contains(e.target)) {
      sidebar.classList.remove('is-open');
    }
    // Sheet color/border popups
    if (!document.getElementById('fs-bg-wrap')?.contains(e.target)) {
      document.getElementById('fs-bg-popup')?.classList.add('hidden');
    }
    if (!document.getElementById('fs-tc-wrap')?.contains(e.target)) {
      document.getElementById('fs-tc-popup')?.classList.add('hidden');
    }
    if (!document.getElementById('fs-border-wrap')?.contains(e.target)) {
      document.getElementById('fs-border-popup')?.classList.add('hidden');
    }
  });
}

/* ── Documents CRUD ───────────────────────────────────────────────────────── */
async function _loadDocuments() {
  if (!_checkFirebase()) return;

  try {
    const db = firebase.firestore();
    let query = db.collection(COLLECTION_DOCS);

    // Filter based on current view
    if (S.currentView === 'my-docs') {
      query = query.where('ownerId', '==', S.user.uid);
    } else if (S.currentView === 'shared-docs') {
      query = query.where('shared', '==', true);
    } else if (S.currentView === 'trash') {
      query = query.where('deleted', '==', true);
    } else {
      // All docs: show both owned and shared
      query = query.where('deleted', '==', false);
    }

    query = query.orderBy('updatedAt', 'desc');

    const snapshot = await query.get();
    S.documents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    _renderDocuments();
  } catch (err) {
    console.error('[FlockDocs] Error loading documents:', err);
    _toast('Failed to load documents', 'error');
  }
}

async function _loadFolders() {
  if (!_checkFirebase()) return;

  try {
    const db = firebase.firestore();
    const snapshot = await db.collection(COLLECTION_FOLDERS)
      .where('ownerId', '==', S.user.uid)
      .orderBy('name')
      .get();

    S.folders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    _renderFolders();
  } catch (err) {
    console.error('[FlockDocs] Error loading folders:', err);
  }
}

function createNewDocument() {
  S.currentDoc = {
    id: null,
    name: 'Untitled Document',
    type: 'document', // 'document' | 'spreadsheet' | 'presentation'
    content: '<h1>Untitled Document</h1><p>Start typing...</p>',
    ownerId: S.user.uid,
    ownerName: S.user.displayName,
    shared: false,
    folderId: null,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  _openEditor();
}

function createNewSpreadsheet() {
  document.getElementById('fd-new-menu')?.classList.add('hidden');
  S.currentDoc = {
    id: null,
    name: 'Untitled Spreadsheet',
    type: 'spreadsheet',
    sheetData: '{}',
    colWidths: '{}',
    ownerId: S.user.uid,
    ownerName: S.user.displayName,
    shared: false,
    folderId: null,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  _openSpreadsheetEditor();
}

async function openDocument(docId) {
  if (!_checkFirebase()) return;

  try {
    const db = firebase.firestore();
    const docRef = await db.collection(COLLECTION_DOCS).doc(docId).get();
    
    if (!docRef.exists) {
      _toast('Document not found', 'error');
      return;
    }

    S.currentDoc = {
      id: docRef.id,
      ...docRef.data(),
    };

    if (S.currentDoc.type === 'spreadsheet') {
      _openSpreadsheetEditor();
    } else {
      _openEditor();
    }
  } catch (err) {
    console.error('[FlockDocs] Error opening document:', err);
    _toast('Failed to open document', 'error');
  }
}

async function saveDocument() {
  if (!S.currentDoc) return;
  if (!_checkFirebase()) return;

  const editor = document.getElementById('fd-editor-content');
  if (!editor) return;

  S.currentDoc.content = editor.innerHTML;
  S.currentDoc.updatedAt = new Date();

  // Extract document name from first heading
  const firstHeading = editor.querySelector('h1, h2, h3');
  if (firstHeading) {
    S.currentDoc.name = firstHeading.textContent.trim() || 'Untitled Document';
  }

  try {
    const db = firebase.firestore();
    const saveStatus = document.getElementById('fd-save-status');
    
    if (saveStatus) saveStatus.textContent = 'Saving...';

    if (S.currentDoc.id) {
      // Update existing document
      await db.collection(COLLECTION_DOCS).doc(S.currentDoc.id).update({
        name: S.currentDoc.name,
        content: S.currentDoc.content,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Create new document
      const docRef = await db.collection(COLLECTION_DOCS).add({
        name: S.currentDoc.name,
        type: S.currentDoc.type,
        content: S.currentDoc.content,
        ownerId: S.currentDoc.ownerId,
        ownerName: S.currentDoc.ownerName,
        shared: S.currentDoc.shared,
        folderId: S.currentDoc.folderId,
        deleted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      S.currentDoc.id = docRef.id;
    }

    if (saveStatus) saveStatus.textContent = 'All changes saved';
    console.log('[FlockDocs] Document saved:', S.currentDoc.id);
  } catch (err) {
    console.error('[FlockDocs] Error saving document:', err);
    _toast('Failed to save document', 'error');
    const saveStatus = document.getElementById('fd-save-status');
    if (saveStatus) saveStatus.textContent = 'Error saving';
  }
}

async function deleteDocument(docId) {
  if (!_checkFirebase()) return;

  try {
    const db = firebase.firestore();
    // Soft delete - move to trash
    await db.collection(COLLECTION_DOCS).doc(docId).update({
      deleted: true,
      deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    _toast('Document moved to trash', 'success');
    _loadDocuments();
  } catch (err) {
    console.error('[FlockDocs] Error deleting document:', err);
    _toast('Failed to delete document', 'error');
  }
}

/* ── View Management ──────────────────────────────────────────────────────── */
function switchView(viewName) {
  S.currentView = viewName;
  
  // Update sidebar active state
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.view === viewName);
  });

  // Update library title
  const titles = {
    'all-docs': 'All Documents',
    'my-docs': 'My Documents',
    'shared-docs': 'Shared with Church',
    'recent': 'Recent Documents',
    'trash': 'Trash',
  };
  document.getElementById('fd-library-title').textContent = titles[viewName] || 'Documents';

  _loadDocuments();
}

/* ── Rendering ────────────────────────────────────────────────────────────── */
function _renderDocuments() {
  const container = document.getElementById('fd-doc-list');
  if (!container) return;

  // Filter documents by search query
  let docs = S.documents;
  if (S.searchQuery) {
    docs = docs.filter(doc => 
      doc.name.toLowerCase().includes(S.searchQuery)
    );
  }

  if (docs.length === 0) {
    container.innerHTML = `
      <div class="fd-empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <h3>${S.searchQuery ? 'No documents found' : 'No documents yet'}</h3>
        <p>${S.searchQuery ? 'Try a different search term' : 'Create your first document to get started'}</p>
        ${!S.searchQuery ? `<button class="fd-btn" onclick="FlockDocs.createNewDocument()">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create Document
        </button>` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="fd-doc-grid">${docs.map(_renderDocCard).join('')}</div>`;
}

function _renderDocCard(doc) {
  const icon = _getDocIcon(doc.type);
  const date = _formatDate(doc.updatedAt);
  const sheetClass = doc.type === 'spreadsheet' ? ' fd-doc-sheet' : '';
  
  return `
    <div class="fd-doc-card" onclick="FlockDocs.openDocument('${doc.id}')">
      <button class="fd-doc-menu-btn" onclick="event.stopPropagation(); _showDocMenu('${doc.id}')">
        <svg fill="currentColor" viewBox="0 0 24 24" width="18" height="18">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </button>
      <div class="fd-doc-icon${sheetClass}">${icon}</div>
      <div class="fd-doc-name">${_e(doc.name)}</div>
      <div class="fd-doc-meta">
        ${doc.shared ? '👥 Shared • ' : ''}Updated ${date}
      </div>
    </div>
  `;
}

function _renderFolders() {
  const container = document.getElementById('fd-folders-list');
  if (!container) return;

  if (S.folders.length === 0) {
    container.innerHTML = '<div style="padding:12px;font-size:0.813rem;color:var(--ink-muted);text-align:center;">No folders</div>';
    return;
  }

  container.innerHTML = S.folders.map(folder => `
    <div class="fd-folder-item" onclick="_selectFolder('${folder.id}')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
      </svg>
      ${_e(folder.name)}
    </div>
  `).join('');
}

/* ── Editor ───────────────────────────────────────────────────────────────── */
function _openEditor() {
  if (!S.currentDoc) return;

  const libraryView = document.getElementById('fd-library-view');
  const editorView = document.getElementById('fd-editor-view');
  const editor = document.getElementById('fd-editor-content');

  if (libraryView) libraryView.classList.add('hidden');
  if (editorView) editorView.classList.remove('hidden');
  
  if (editor) {
    editor.innerHTML = S.currentDoc.content;
    editor.focus();
  }
}

function _closeEditor() {
  const libraryView = document.getElementById('fd-library-view');
  const editorView = document.getElementById('fd-editor-view');

  if (libraryView) libraryView.classList.remove('hidden');
  if (editorView) editorView.classList.add('hidden');

  S.currentDoc = null;
  _loadDocuments();
}

function _execCommand(command, value = null) {
  document.execCommand(command, false, value);
  document.getElementById('fd-editor-content')?.focus();
}

function _autoSave() {
  clearTimeout(S.autoSaveTimer);
  
  const saveStatus = document.getElementById('fd-save-status');
  if (saveStatus) saveStatus.textContent = 'Unsaved changes...';

  S.autoSaveTimer = setTimeout(() => {
    saveDocument();
  }, 2000); // Auto-save after 2 seconds of no typing
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function _checkFirebase() {
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.error('[FlockDocs] Firebase not initialized');
    _toast('Database connection error', 'error');
    return false;
  }
  return true;
}

function _getDocIcon(type) {
  const icons = {
    document: `<svg fill="white" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/></svg>`,
    spreadsheet: `<svg fill="white" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>`,
    presentation: `<svg fill="white" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>`,
  };
  return icons[type] || icons.document;
}

function _formatDate(date) {
  if (!date) return 'Unknown';
  
  // Handle Firestore Timestamp
  if (date && typeof date.toDate === 'function') {
    date = date.toDate();
  } else if (!(date instanceof Date)) {
    date = new Date(date);
  }

  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _e(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function _toast(msg, type = 'info') {
  console.log(`[FlockDocs] ${type.toUpperCase()}: ${msg}`);
  // TODO: Implement toast UI
}

function _showDocMenu(docId) {
  // TODO: Implement context menu
  console.log('[FlockDocs] Show menu for doc:', docId);
}

function _selectFolder(folderId) {
  S.currentFolder = folderId;
  _loadDocuments();
}

/* ── Export for HTML onclick handlers ──────────────────────────────────────── */
window._showDocMenu = _showDocMenu;
window._selectFolder = _selectFolder;

/* ══════════════════════════════════════════════════════════════════════════════
   FLOCKSHEETS — Spreadsheet Engine
   "A wise man will hear, and will increase learning." — Proverbs 1:5
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Open / Close Spreadsheet Editor ─────────────────────────────────────── */
function _openSpreadsheetEditor() {
  if (!S.currentDoc) return;

  // Load sheet data from doc
  try {
    S.sheet.data = JSON.parse(S.currentDoc.sheetData || '{}');
  } catch (_) { S.sheet.data = {}; }
  try {
    S.sheet.colWidths = JSON.parse(S.currentDoc.colWidths || '{}');
  } catch (_) { S.sheet.colWidths = {}; }

  // Load Session 3 metadata (freeze, sort, filter)
  S.sheet.freezeRow = false;
  S.sheet.freezeCol = false;
  S.sheet.sortCol = null;
  S.sheet.sortAsc = true;
  S.sheet.filterActive = false;
  S.sheet.filterValues = {};
  S.sheet.hiddenRows = new Set();
  S.sheet.clipboard = null;
  S.sheet.copyRef = null;

  if (S.currentDoc.sheetMeta) {
    try {
      const meta = JSON.parse(S.currentDoc.sheetMeta);
      S.sheet.freezeRow = !!meta.freezeRow;
      S.sheet.freezeCol = !!meta.freezeCol;
      S.sheet.sortCol = meta.sortCol || null;
      S.sheet.sortAsc = meta.sortAsc !== false;
      S.sheet.filterActive = !!meta.filterActive;
      if (meta.filterValues) {
        for (const [col, vals] of Object.entries(meta.filterValues)) {
          S.sheet.filterValues[col] = new Set(vals);
        }
        _applyFiltersToHiddenRows();
      }
    } catch (_) { /* ignore */ }
  }

  S.sheet.selected = null;
  S.sheet.isEditing = false;

  // Show spreadsheet view, hide others
  document.getElementById('fd-library-view')?.classList.add('hidden');
  document.getElementById('fd-editor-view')?.classList.add('hidden');
  document.getElementById('fd-sheet-view')?.classList.remove('hidden');

  // Set spreadsheet name
  const nameInput = document.getElementById('fd-sheet-name');
  if (nameInput) nameInput.value = S.currentDoc.name || 'Untitled Spreadsheet';

  // Build color picker swatches (done once per open)
  _initColorPickers();

  // Render the grid
  _renderGrid();

  // Bind grid mouse events once via the persistent wrap element (not the table)
  const wrap = document.getElementById('fd-grid-wrap');
  if (wrap && !wrap._sheetBound) {
    wrap.addEventListener('mousedown', _onGridMousedown);
    wrap.addEventListener('dblclick', _onGridDblclick);
    wrap._sheetBound = true;
  }

  // Update freeze button visual state
  _updateFreezeBtn();

  // Select A1 by default
  _selectCell('A1');

  // Focus the grid for keyboard events
  wrap?.focus();
}

function _closeSpreadsheetEditor() {
  // Commit any pending edit
  if (S.sheet.isEditing) _commitCellEdit();

  document.getElementById('fd-sheet-view')?.classList.add('hidden');
  document.getElementById('fd-library-view')?.classList.remove('hidden');

  S.currentDoc = null;
  S.sheet.data = {};
  S.sheet.selected = null;
  S.sheet.isEditing = false;
  S.sheet.clipboard = null;
  S.sheet.copyRef = null;
  S.sheet.filterActive = false;
  S.sheet.filterValues = {};
  S.sheet.hiddenRows = new Set();
  clearTimeout(S.sheet.autoSaveTimer);

  _loadDocuments();
}

/* ── Grid Rendering ───────────────────────────────────────────────────────── */
function _renderGrid() {
  const cols = _sheetCols();
  const rows = _sheetRows();

  // Build freeze class string for the table element
  let tableCls = 'fd-grid';
  if (S.sheet.freezeRow) tableCls += ' fs-freeze-row';
  if (S.sheet.freezeCol) tableCls += ' fs-freeze-col';

  const parts = [`<table class="${tableCls}" id="fd-grid" role="grid">`];

  // ── Sticky header row ──
  parts.push('<thead><tr>');
  parts.push('<th class="fd-corner"></th>');
  for (const col of cols) {
    const w = S.sheet.colWidths[col] || 100;
    let hdrCls = 'fd-col-header';
    if (S.sheet.sortCol === col) hdrCls += S.sheet.sortAsc ? ' fs-sorted-asc' : ' fs-sorted-desc';
    // Filter button inside header when filter mode is on
    const filterBtn = S.sheet.filterActive
      ? `<button class="fs-filter-btn${S.sheet.filterValues[col] ? ' is-active' : ''}" `
        + `onclick="event.stopPropagation();_fsShowFilter('${col}',this)" tabindex="-1">▾</button>`
      : '';
    parts.push(
      `<th class="${hdrCls}" data-col="${col}" style="width:${w}px;min-width:${w}px">`
      + `${col}${filterBtn}</th>`
    );
  }
  parts.push('</tr></thead>');

  // ── Data rows (hidden rows are skipped by filter) ──
  parts.push('<tbody>');
  for (const row of rows) {
    if (S.sheet.hiddenRows.has(row)) continue;
    parts.push(`<tr data-row="${row}">`);
    parts.push(`<th class="fd-row-header" data-row="${row}">${row}</th>`);
    for (const col of cols) {
      const ref = `${col}${row}`;
      const cell = S.sheet.data[ref];
      const display = _getCellDisplay(ref);
      let cls = 'fd-cell';
      if (cell?.s?.bold) cls += ' fd-bold';
      const fmt = cell?.s?.fmt;
      if (fmt && fmt !== 'plain') cls += ` fd-${fmt}`;
      else if (_isNumericResult(ref)) cls += ' fd-num';
      const styleStr = _buildCellStyle(cell?.s);
      const styleAttr = styleStr ? ` style="${styleStr}"` : '';
      parts.push(
        `<td class="${cls}"${styleAttr} data-ref="${ref}" data-row="${row}" data-col="${col}">`
        + `${_e(display)}</td>`
      );
    }
    parts.push('</tr>');
  }
  parts.push('</tbody></table>');

  const wrap = document.getElementById('fd-grid-wrap');
  if (!wrap) return;
  wrap.innerHTML = parts.join('');
  // Note: grid mouse events are bound once in _openSpreadsheetEditor via the wrap element
}

/* ── Cell Selection ───────────────────────────────────────────────────────── */
function _selectCell(ref) {
  if (!ref) return;
  ref = ref.toUpperCase();

  // Deselect previous
  if (S.sheet.selected) {
    const prev = document.querySelector(`[data-ref="${S.sheet.selected}"]`);
    prev?.classList.remove('is-selected');
    // Deselect headers
    const prevParsed = _parseRef(S.sheet.selected);
    document.querySelector(`.fd-col-header[data-col="${prevParsed.col}"]`)?.classList.remove('is-col-selected');
    document.querySelector(`.fd-row-header[data-row="${prevParsed.row}"]`)?.classList.remove('is-row-selected');
  }

  S.sheet.selected = ref;

  // Highlight cell
  const cell = document.querySelector(`[data-ref="${ref}"]`);
  cell?.classList.add('is-selected');

  // Highlight headers
  const parsed = _parseRef(ref);
  document.querySelector(`.fd-col-header[data-col="${parsed.col}"]`)?.classList.add('is-col-selected');
  document.querySelector(`.fd-row-header[data-row="${parsed.row}"]`)?.classList.add('is-row-selected');

  // Update formula bar
  _updateFormulaBar();

  // Update bold button state
  const bold = S.sheet.data[ref]?.s?.bold;
  document.getElementById('fs-bold-btn')?.classList.toggle('is-active', !!bold);

  // Update format button states
  const fmt = S.sheet.data[ref]?.s?.fmt || 'plain';
  document.querySelectorAll('.fs-fmt-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.fmt === fmt);
  });

  // Scroll cell into view
  cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function _updateFormulaBar() {
  const ref = S.sheet.selected;
  document.getElementById('fs-cell-ref').textContent = ref || '';
  const cell = ref ? S.sheet.data[ref] : null;
  const input = document.getElementById('fs-formula-input');
  if (input) input.value = cell?.f || cell?.v || '';
}

/* ── Cell Editing ─────────────────────────────────────────────────────────── */
function _startCellEdit(ref, initialChar) {
  if (!ref) return;
  _selectCell(ref);

  S.sheet.isEditing = true;
  const cellEl = document.querySelector(`[data-ref="${ref}"]`);
  if (!cellEl) return;

  cellEl.classList.add('is-editing');
  cellEl.classList.remove('is-selected');

  const cell = S.sheet.data[ref];
  const currentVal = cell?.f || cell?.v || '';
  const startVal = initialChar !== undefined ? initialChar : currentVal;

  cellEl.innerHTML = `<input class="fd-cell-editor" id="fd-cell-editor-input" value="${_e(startVal)}" autocomplete="off" spellcheck="false">`;
  const input = cellEl.querySelector('.fd-cell-editor');

  input.focus();
  // Place cursor at end
  const len = input.value.length;
  input.setSelectionRange(len, len);

  input.addEventListener('keydown', _onCellEditorKeydown);
  input.addEventListener('blur', _onCellEditorBlur);
}

function _onCellEditorKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    _commitCellEdit();
    _moveSelection('down');
  } else if (e.key === 'Tab') {
    e.preventDefault();
    _commitCellEdit();
    _moveSelection(e.shiftKey ? 'left' : 'right');
  } else if (e.key === 'Escape') {
    e.preventDefault();
    _cancelCellEdit();
  } else if (e.key === 'ArrowUp' && e.ctrlKey) {
    e.preventDefault();
    _commitCellEdit();
    _moveSelection('up');
  } else if (e.key === 'ArrowDown' && e.ctrlKey) {
    e.preventDefault();
    _commitCellEdit();
    _moveSelection('down');
  }
}

function _onCellEditorBlur() {
  if (S.sheet.isEditing) _commitCellEdit();
}

function _commitCellEdit() {
  if (!S.sheet.isEditing) return;
  const ref = S.sheet.selected;
  const input = document.getElementById('fd-cell-editor-input');
  const val = input ? input.value : '';

  S.sheet.isEditing = false;
  _setCellValue(ref, val);
  _refreshCell(ref);
  _selectCell(ref);
  _autoSaveSheet();
}

function _cancelCellEdit() {
  if (!S.sheet.isEditing) return;
  S.sheet.isEditing = false;
  const ref = S.sheet.selected;
  _refreshCell(ref);
  _selectCell(ref);
}

function _setCellValue(ref, val) {
  if (!ref) return;
  if (!S.sheet.data[ref]) S.sheet.data[ref] = { v: '', f: '', s: {} };

  if (val === '' || val === null || val === undefined) {
    // Clear cell but keep style
    S.sheet.data[ref].v = '';
    S.sheet.data[ref].f = '';
  } else if (typeof val === 'string' && val.startsWith('=')) {
    S.sheet.data[ref].f = val;
    S.sheet.data[ref].v = val; // keep raw
  } else {
    S.sheet.data[ref].f = '';
    S.sheet.data[ref].v = val;
  }

  // Remove cell entirely if truly empty with no style
  if (!S.sheet.data[ref].v && !S.sheet.data[ref].f &&
      !S.sheet.data[ref].s?.bold && !S.sheet.data[ref].s?.fmt) {
    delete S.sheet.data[ref];
  }
}

function _refreshCell(ref) {
  if (!ref) return;
  const cellEl = document.querySelector(`[data-ref="${ref}"]`);
  if (!cellEl) return;

  const cell = S.sheet.data[ref];
  const display = _getCellDisplay(ref);
  let cls = 'fd-cell';
  if (cell?.s?.bold) cls += ' fd-bold';
  const fmt = cell?.s?.fmt;
  if (fmt && fmt !== 'plain') cls += ` fd-${fmt}`;
  else if (_isNumericResult(ref)) cls += ' fd-num';

  cellEl.className = cls;
  cellEl.style.cssText = _buildCellStyle(cell?.s);
  cellEl.innerHTML = _e(display);
}

function _commitFormulaBarEdit() {
  if (S.sheet.selected) {
    _refreshCell(S.sheet.selected);
    _selectCell(S.sheet.selected);
    _autoSaveSheet();
  }
}

/* ── Grid Keyboard Navigation ─────────────────────────────────────────────── */
function _onGridKeydown(e) {
  if (!S.sheet.selected) {
    _selectCell('A1');
    return;
  }
  if (S.sheet.isEditing) return; // let cell editor handle it

  const ctrl = e.ctrlKey || e.metaKey;

  switch (e.key) {
    case 'ArrowUp':    e.preventDefault(); _moveSelection('up'); break;
    case 'ArrowDown':  e.preventDefault(); _moveSelection('down'); break;
    case 'ArrowLeft':  e.preventDefault(); _moveSelection('left'); break;
    case 'ArrowRight': e.preventDefault(); _moveSelection('right'); break;
    case 'Enter':      e.preventDefault(); _startCellEdit(S.sheet.selected); break;
    case 'Tab':
      e.preventDefault();
      _moveSelection(e.shiftKey ? 'left' : 'right');
      break;
    case 'Delete':
    case 'Backspace':
      e.preventDefault();
      _setCellValue(S.sheet.selected, '');
      _refreshCell(S.sheet.selected);
      _updateFormulaBar();
      _autoSaveSheet();
      break;
    default:
      if (ctrl) {
        switch (e.key.toLowerCase()) {
          case 'b': e.preventDefault(); _toggleCellBold(); break;
          case 's': e.preventDefault(); _saveSpreadsheet(); break;
          case 'c': e.preventDefault(); _copyCell(); break;
          case 'v': e.preventDefault(); _pasteCell(); break;
          case 'd': e.preventDefault(); _fillDown(); break;
          case 'r': e.preventDefault(); _fillRight(); break;
        }
      } else if (e.key.length === 1 && !e.altKey) {
        e.preventDefault();
        _startCellEdit(S.sheet.selected, e.key);
      }
  }
}

function _onGridMousedown(e) {
  const cell = e.target.closest('td.fd-cell');
  if (!cell) return;
  if (S.sheet.isEditing) _commitCellEdit();
  _selectCell(cell.dataset.ref);
  document.getElementById('fd-grid-wrap')?.focus();
}

function _onGridDblclick(e) {
  const cell = e.target.closest('td.fd-cell');
  if (!cell) return;
  _startCellEdit(cell.dataset.ref);
}

function _moveSelection(dir) {
  const ref = S.sheet.selected || 'A1';
  const { col, row } = _parseRef(ref);
  const colIdx = col.charCodeAt(0) - 65;
  const rowNum = parseInt(row, 10);

  let newColIdx = colIdx, newRow = rowNum;
  if (dir === 'up')    newRow = Math.max(1, rowNum - 1);
  if (dir === 'down')  newRow = Math.min(S.sheet.rows, rowNum + 1);
  if (dir === 'left')  newColIdx = Math.max(0, colIdx - 1);
  if (dir === 'right') newColIdx = Math.min(S.sheet.cols - 1, colIdx + 1);

  _selectCell(`${String.fromCharCode(65 + newColIdx)}${newRow}`);
}

/* ── Cell Formatting ──────────────────────────────────────────────────────── */
function _toggleCellBold() {
  const ref = S.sheet.selected;
  if (!ref) return;
  if (!S.sheet.data[ref]) S.sheet.data[ref] = { v: '', f: '', s: {} };
  if (!S.sheet.data[ref].s) S.sheet.data[ref].s = {};
  S.sheet.data[ref].s.bold = !S.sheet.data[ref].s.bold;
  _refreshCell(ref);
  _selectCell(ref);
  _autoSaveSheet();
}

function _setCellFormat(fmt) {
  const ref = S.sheet.selected;
  if (!ref) return;
  if (!S.sheet.data[ref]) S.sheet.data[ref] = { v: '', f: '', s: {} };
  if (!S.sheet.data[ref].s) S.sheet.data[ref].s = {};
  S.sheet.data[ref].s.fmt = fmt;
  _refreshCell(ref);
  _selectCell(ref);
  _autoSaveSheet();
}

/* ── Formula Engine ───────────────────────────────────────────────────────── */
function _getCellDisplay(ref) {
  const cell = S.sheet.data[ref];
  if (!cell) return '';
  const val = (cell.f && cell.f.startsWith('=')) ? _evalFormula(cell.f) : cell.v;
  return _applyFormat(val, cell.s?.fmt);
}

function _getCellRawValue(ref) {
  const cell = S.sheet.data[ref];
  if (!cell) return '';
  if (cell.f && cell.f.startsWith('=')) return _evalFormula(cell.f);
  return cell.v ?? '';
}

/* ── Formula evaluator (recursive, supports nested calls) ─────────────── */
function _evalFormula(formula) {
  if (!formula || !formula.startsWith('=')) return formula;
  const raw = formula.substring(1).trim();
  const call = _parseTopLevelCall(raw);
  if (call) {
    const args = _splitArgs(call.argsRaw);
    const result = _dispatchFn(call.name, args);
    if (result !== undefined) return result;
  }
  // Fall back to safe math expression with cell refs
  return _evalMathExpr(raw);
}

/* Parse the outermost FUNCNAME(…) from a raw expression.
   Returns { name: string, argsRaw: string } or null. */
function _parseTopLevelCall(raw) {
  const m = raw.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\(/);
  if (!m) return null;
  const name = m[1].toUpperCase();
  const openIdx = raw.indexOf('(');
  let depth = 0;
  for (let i = openIdx; i < raw.length; i++) {
    if (raw[i] === '(') depth++;
    else if (raw[i] === ')') {
      depth--;
      if (depth === 0) {
        if (i === raw.length - 1) {          // Entire expression is one function call
          return { name, argsRaw: raw.slice(openIdx + 1, i) };
        }
        return null; // Something after the close paren — not a simple call
      }
    }
  }
  return null; // Unbalanced parens
}

/* Split a comma-separated argument string, respecting nested parens and quotes */
function _splitArgs(argsStr) {
  if (!argsStr.trim()) return [];
  const args = [];
  let depth = 0, inStr = false, strChar = '', cur = '';
  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i];
    if (!inStr && (c === '"' || c === "'")) { inStr = true; strChar = c; cur += c; continue; }
    if (inStr && c === strChar) { inStr = false; cur += c; continue; }
    if (!inStr && c === '(') { depth++; cur += c; continue; }
    if (!inStr && c === ')') { depth--; cur += c; continue; }
    if (!inStr && c === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

/* Evaluate a single argument: literal, cell ref, range, nested call, or math */
function _evalSingleArg(arg) {
  if (arg === undefined || arg === null) return '';
  arg = String(arg).trim();
  if (!arg) return '';

  // String literal — preserve case
  if ((arg.startsWith('"') && arg.endsWith('"')) ||
      (arg.startsWith("'") && arg.endsWith("'"))) {
    return arg.slice(1, -1);
  }
  // Boolean
  if (arg.toUpperCase() === 'TRUE')  return true;
  if (arg.toUpperCase() === 'FALSE') return false;

  // Pure number literal
  if (/^-?[\d.]+$/.test(arg)) return parseFloat(arg);

  // Cell reference e.g. A1
  if (/^[A-Za-z]+\d+$/.test(arg)) {
    const raw = _getCellRawValue(arg.toUpperCase());
    const n = parseFloat(raw);
    return (!isNaN(n) && raw !== '') ? n : raw;
  }

  // Range e.g. A1:C10 — returns flat array of values
  if (/^[A-Za-z]+\d+:[A-Za-z]+\d+$/.test(arg)) {
    return _parseRange(arg.toUpperCase()).map(r => {
      const raw = _getCellRawValue(r);
      const n = parseFloat(raw);
      return (!isNaN(n) && raw !== '') ? n : raw;
    });
  }

  // Nested function call e.g. SUM(A1:A5)
  if (/^[A-Za-z][A-Za-z0-9_]*\s*\(/.test(arg)) {
    return _evalFormula('=' + arg);
  }

  // Fall back to math expression
  return _evalMathExpr(arg);
}

/* Evaluate a comparison/boolean condition string as used in IF() */
function _evalCondition(condStr) {
  condStr = condStr.trim();
  const m = condStr.match(/^(.+?)\s*(>=|<=|<>|!=|>|<|=)\s*(.+)$/);
  if (m) {
    const lv = _evalSingleArg(m[1].trim());
    const rv = _evalSingleArg(m[3].trim());
    // Numeric comparison if both sides are numeric; string comparison otherwise
    const ln = parseFloat(lv), rn = parseFloat(rv);
    const numeric = !isNaN(ln) && !isNaN(rn) && lv !== '' && rv !== '';
    const [a, b] = numeric ? [ln, rn] : [String(lv).toLowerCase(), String(rv).toLowerCase()];
    switch (m[2]) {
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '<>':
      case '!=': return a != b;  // eslint-disable-line eqeqeq
      case '>':  return a > b;
      case '<':  return a < b;
      case '=':  return a == b;  // eslint-disable-line eqeqeq
    }
  }
  const val = _evalSingleArg(condStr);
  return val !== 0 && val !== false && val !== '' &&
         String(val).toUpperCase() !== 'FALSE' && val !== null;
}

/* Safe math fallback — cell refs only, no functions */
function _evalMathExpr(expr) {
  try {
    let evalExpr = expr.toUpperCase().replace(/\b([A-Z]+)(\d+)\b/g, (_, col, row) => {
      const val = parseFloat(_getCellRawValue(col + row));
      return isNaN(val) ? '0' : String(val);
    });
    if (!/^[0-9+\-*/.() \t]+$/.test(evalExpr)) return '#ERROR';
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${evalExpr})`)();
    return (typeof result === 'number' && isFinite(result)) ? result : '#ERROR';
  } catch (_) {
    return '#ERROR';
  }
}

/* Get all numeric values from a list of args (each may be a cell, range, or literal) */
function _getNumericVals(args) {
  const nums = [];
  for (const arg of args) {
    const val = _evalSingleArg(arg);
    if (Array.isArray(val)) {
      val.forEach(v => { const n = parseFloat(v); if (!isNaN(n)) nums.push(n); });
    } else {
      const n = parseFloat(val);
      if (!isNaN(n)) nums.push(n);
    }
  }
  return nums;
}

/* Dispatch a function call to its implementation */
function _dispatchFn(name, args) {
  switch (name) {
    // ── Aggregate ──
    case 'SUM': {
      const nums = _getNumericVals(args);
      return nums.reduce((a, b) => a + b, 0);
    }
    case 'AVERAGE': {
      const nums = _getNumericVals(args);
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    }
    case 'COUNT':  return _getNumericVals(args).length;
    case 'COUNTA': {
      let count = 0;
      for (const arg of args) {
        const val = _evalSingleArg(arg);
        if (Array.isArray(val)) count += val.filter(v => v !== '' && v !== null).length;
        else if (val !== '' && val !== null) count++;
      }
      return count;
    }
    case 'MIN': {
      const nums = _getNumericVals(args);
      return nums.length ? Math.min(...nums) : 0;
    }
    case 'MAX': {
      const nums = _getNumericVals(args);
      return nums.length ? Math.max(...nums) : 0;
    }

    // ── Logic ──
    case 'IF': {
      if (args.length < 2) return '#ERROR';
      const cond = _evalCondition(args[0]);
      const trueVal  = _evalSingleArg(args[1] ?? '');
      const falseVal = args[2] !== undefined ? _evalSingleArg(args[2]) : false;
      return cond ? trueVal : falseVal;
    }
    case 'IFERROR': {
      if (args.length < 2) return '#ERROR';
      const tryVal = _evalSingleArg(args[0]);
      return (tryVal === '#ERROR' || tryVal === '#N/A' || tryVal === '#REF!') 
        ? _evalSingleArg(args[1]) 
        : tryVal;
    }
    case 'AND': {
      return args.every(a => _evalCondition(a));
    }
    case 'OR': {
      return args.some(a => _evalCondition(a));
    }
    case 'NOT': {
      return !_evalCondition(args[0] ?? '');
    }

    // ── Lookup ──
    case 'VLOOKUP': {
      if (args.length < 3) return '#ERROR';
      const lookupVal = _evalSingleArg(args[0]);
      const rangeStr  = args[1].trim().toUpperCase();
      const colIdx    = parseInt(_evalSingleArg(args[2]), 10);
      const exact     = args[3] !== undefined
        ? (_evalSingleArg(args[3]) === true || String(_evalSingleArg(args[3])).toUpperCase() === 'TRUE' || _evalSingleArg(args[3]) === 1)
        : true;
      const refs = _parseRange(rangeStr);
      if (!refs.length) return '#N/A';
      const start = _parseRef(refs[0]);
      const end   = _parseRef(refs[refs.length - 1]);
      const startRow = parseInt(start.row, 10);
      const endRow   = parseInt(end.row, 10);
      const startColIdx2 = start.col.charCodeAt(0) - 65;
      const endColIdx2   = end.col.charCodeAt(0) - 65;
      if (colIdx < 1 || colIdx > endColIdx2 - startColIdx2 + 1) return '#REF!';
      const resultCol = String.fromCharCode(65 + startColIdx2 + colIdx - 1);
      for (let r = startRow; r <= endRow; r++) {
        const cellVal = _getCellRawValue(start.col + r);
        const cv = parseFloat(cellVal), lv = parseFloat(lookupVal);
        const numericMatch = !isNaN(cv) && !isNaN(lv) && cv === lv;
        const strMatch = String(cellVal).toLowerCase() === String(lookupVal).toLowerCase();
        if (exact ? (numericMatch || strMatch) : (numericMatch && cv <= lv)) {
          return _evalSingleArg(resultCol + r);
        }
      }
      return '#N/A';
    }

    // ── Text ──
    case 'CONCATENATE':
    case 'CONCAT': {
      return args.map(a => {
        const val = _evalSingleArg(a);
        return Array.isArray(val) ? val.join('') : String(val);
      }).join('');
    }
    case 'LEN':   return String(_evalSingleArg(args[0] ?? '')).length;
    case 'LEFT':  {
      const s = String(_evalSingleArg(args[0] ?? ''));
      const n = args[1] !== undefined ? parseInt(_evalSingleArg(args[1]), 10) : 1;
      return s.slice(0, n);
    }
    case 'RIGHT': {
      const s = String(_evalSingleArg(args[0] ?? ''));
      const n = args[1] !== undefined ? parseInt(_evalSingleArg(args[1]), 10) : 1;
      return s.slice(-n);
    }
    case 'MID': {
      const s = String(_evalSingleArg(args[0] ?? ''));
      const start = parseInt(_evalSingleArg(args[1] ?? '1'), 10) - 1; // 1-indexed
      const len   = parseInt(_evalSingleArg(args[2] ?? '1'), 10);
      return s.slice(start, start + len);
    }
    case 'UPPER':    return String(_evalSingleArg(args[0] ?? '')).toUpperCase();
    case 'LOWER':    return String(_evalSingleArg(args[0] ?? '')).toLowerCase();
    case 'TRIM':     return String(_evalSingleArg(args[0] ?? '')).trim();
    case 'REPT': {
      const s = String(_evalSingleArg(args[0] ?? ''));
      const n = parseInt(_evalSingleArg(args[1] ?? '1'), 10);
      return s.repeat(Math.max(0, n));
    }
    case 'SUBSTITUTE': {
      const s    = String(_evalSingleArg(args[0] ?? ''));
      const find = String(_evalSingleArg(args[1] ?? ''));
      const repl = String(_evalSingleArg(args[2] ?? ''));
      return s.split(find).join(repl);
    }
    case 'TEXT': {
      const num  = parseFloat(_evalSingleArg(args[0] ?? ''));
      const fmt  = String(_evalSingleArg(args[1] ?? ''));
      if (isNaN(num)) return String(_evalSingleArg(args[0] ?? ''));
      if (fmt.includes('%')) return (num * 100).toFixed(0) + '%';
      if (fmt.includes('$')) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
      const decimals = (fmt.match(/\.(0+)/) || [])[1]?.length ?? 0;
      return num.toFixed(decimals);
    }

    // ── Math ──
    case 'ROUND': {
      const n = parseFloat(_evalSingleArg(args[0] ?? '0'));
      const d = parseInt(_evalSingleArg(args[1] ?? '0'), 10);
      return parseFloat(n.toFixed(d));
    }
    case 'ROUNDUP': {
      const n = parseFloat(_evalSingleArg(args[0] ?? '0'));
      const d = parseInt(_evalSingleArg(args[1] ?? '0'), 10);
      const factor = Math.pow(10, d);
      return Math.ceil(n * factor) / factor;
    }
    case 'ROUNDDOWN': {
      const n = parseFloat(_evalSingleArg(args[0] ?? '0'));
      const d = parseInt(_evalSingleArg(args[1] ?? '0'), 10);
      const factor = Math.pow(10, d);
      return Math.floor(n * factor) / factor;
    }
    case 'ABS':   return Math.abs(parseFloat(_evalSingleArg(args[0] ?? '0')));
    case 'SQRT':  return Math.sqrt(parseFloat(_evalSingleArg(args[0] ?? '0')));
    case 'POWER': return Math.pow(parseFloat(_evalSingleArg(args[0] ?? '0')), parseFloat(_evalSingleArg(args[1] ?? '1')));
    case 'MOD': {
      const a = parseFloat(_evalSingleArg(args[0] ?? '0'));
      const b = parseFloat(_evalSingleArg(args[1] ?? '1'));
      return b !== 0 ? a % b : '#DIV/0!';
    }
    case 'INT':   return Math.floor(parseFloat(_evalSingleArg(args[0] ?? '0')));
    case 'RAND':  return Math.random();

    // ── Date ──
    case 'TODAY': {
      const d = new Date();
      return _fmtDate(d);
    }
    case 'NOW': {
      const d = new Date();
      return _fmtDate(d) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    case 'DATE': {
      const yr = parseInt(_evalSingleArg(args[0] ?? ''), 10);
      const mo = parseInt(_evalSingleArg(args[1] ?? ''), 10) - 1;
      const dy = parseInt(_evalSingleArg(args[2] ?? ''), 10);
      const d = new Date(yr, mo, dy);
      return isNaN(d.getTime()) ? '#VALUE!' : _fmtDate(d);
    }
    case 'YEAR': {
      const d = _parseDateArg(args[0] ?? '');
      return d ? d.getFullYear() : '#VALUE!';
    }
    case 'MONTH': {
      const d = _parseDateArg(args[0] ?? '');
      return d ? d.getMonth() + 1 : '#VALUE!';
    }
    case 'DAY': {
      const d = _parseDateArg(args[0] ?? '');
      return d ? d.getDate() : '#VALUE!';
    }

    default:
      return undefined; // Unknown function — fall through to math evaluator
  }
}

function _fmtDate(d) {
  return `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}`;
}

function _parseDateArg(arg) {
  const val = String(_evalSingleArg(arg));
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/* ── Range / Ref helpers ──────────────────────────────────────────────────── */
function _parseRange(range) {
  range = range.trim().toUpperCase();
  if (!range.includes(':')) return [range];

  const [startRef, endRef] = range.split(':');
  const startParsed = _parseRef(startRef);
  const endParsed   = _parseRef(endRef);
  const startColIdx = startParsed.col.charCodeAt(0) - 65;
  const endColIdx   = endParsed.col.charCodeAt(0) - 65;
  const startRow    = parseInt(startParsed.row, 10);
  const endRow      = parseInt(endParsed.row, 10);

  const refs = [];
  for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
    for (let c = Math.min(startColIdx, endColIdx); c <= Math.max(startColIdx, endColIdx); c++) {
      refs.push(`${String.fromCharCode(65 + c)}${r}`);
    }
  }
  return refs;
}

function _parseRef(ref) {
  const m = String(ref).toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return { col: 'A', row: '1' };
  return { col: m[1], row: m[2] };
}

function _applyFormat(val, fmt) {
  if (val === '' || val === null || val === undefined) return '';
  if (typeof val === 'string' && val.startsWith('#')) return val; // error strings

  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return String(val); // text — no numeric formatting

  switch (fmt) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
    case 'percent':
      // Standard spreadsheet: 0.5 → 50%, 1 → 100%
      return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(num);
    case 'decimal':
      return num.toFixed(2);
    default:
      if (Number.isInteger(num)) return String(num);
      return parseFloat(num.toPrecision(9)).toString();
  }
}

/* True if the display value of a cell is numeric (used for right-align class) */
function _isNumericResult(ref) {
  const cell = S.sheet.data[ref];
  if (!cell) return false;
  const val = (cell.f && cell.f.startsWith('=')) ? _evalFormula(cell.f) : cell.v;
  return typeof val === 'number' || (!isNaN(parseFloat(val)) && val !== '');
}

/* Build a CSS style string from a cell's style object */
function _buildCellStyle(s) {
  if (!s) return '';
  const parts = [];
  if (s.bg)    parts.push(`background-color:${s.bg}`);
  if (s.color) parts.push(`color:${s.color}`);
  if (s.border) {
    const bc = '#374151';
    switch (s.border) {
      case 'all':    parts.push(`border:2px solid ${bc}`); break;
      case 'outer':  parts.push(`outline:2px solid ${bc};outline-offset:-1px`); break;
      case 'top':    parts.push(`border-top:2px solid ${bc}`); break;
      case 'bottom': parts.push(`border-bottom:2px solid ${bc}`); break;
      case 'left':   parts.push(`border-left:2px solid ${bc}`); break;
      case 'right':  parts.push(`border-right:2px solid ${bc}`); break;
    }
  }
  return parts.join(';');
}

/* ── Save / Load Spreadsheet ──────────────────────────────────────────────── */
async function _saveSpreadsheet() {
  if (!S.currentDoc) return;
  if (!_checkFirebase()) return;

  // Commit any pending inline edit
  if (S.sheet.isEditing) _commitCellEdit();

  const nameInput = document.getElementById('fd-sheet-name');
  if (nameInput) S.currentDoc.name = nameInput.value.trim() || 'Untitled Spreadsheet';

  const sheetData = JSON.stringify(S.sheet.data);
  const colWidths  = JSON.stringify(S.sheet.colWidths);

  // Serialize Session 3 metadata
  const filterValsSerialized = {};
  for (const [col, valSet] of Object.entries(S.sheet.filterValues)) {
    filterValsSerialized[col] = Array.from(valSet);
  }
  const sheetMeta = JSON.stringify({
    freezeRow:    S.sheet.freezeRow,
    freezeCol:    S.sheet.freezeCol,
    sortCol:      S.sheet.sortCol,
    sortAsc:      S.sheet.sortAsc,
    filterActive: S.sheet.filterActive,
    filterValues: filterValsSerialized,
  });

  const saveStatus = document.getElementById('fd-sheet-save-status');
  if (saveStatus) saveStatus.textContent = 'Saving…';

  try {
    const db = firebase.firestore();

    if (S.currentDoc.id) {
      await db.collection(COLLECTION_DOCS).doc(S.currentDoc.id).update({
        name: S.currentDoc.name,
        sheetData,
        colWidths,
        sheetMeta,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const docRef = await db.collection(COLLECTION_DOCS).add({
        name: S.currentDoc.name,
        type: 'spreadsheet',
        sheetData,
        colWidths,
        sheetMeta,
        ownerId: S.currentDoc.ownerId,
        ownerName: S.currentDoc.ownerName,
        shared: false,
        folderId: null,
        deleted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      S.currentDoc.id = docRef.id;
    }

    if (saveStatus) saveStatus.textContent = 'All changes saved';
    console.log('[FlockSheets] Saved:', S.currentDoc.id);
  } catch (err) {
    console.error('[FlockSheets] Error saving:', err);
    _toast('Failed to save spreadsheet', 'error');
    if (saveStatus) saveStatus.textContent = 'Error saving';
  }
}

function _autoSaveSheet() {
  clearTimeout(S.sheet.autoSaveTimer);
  const saveStatus = document.getElementById('fd-sheet-save-status');
  if (saveStatus) saveStatus.textContent = 'Unsaved changes…';
  S.sheet.autoSaveTimer = setTimeout(_saveSpreadsheet, 2000);
}

/* ── Sheet helpers ────────────────────────────────────────────────────────── */
function _sheetCols() {
  return Array.from({ length: S.sheet.cols }, (_, i) => String.fromCharCode(65 + i));
}

function _sheetRows() {
  return Array.from({ length: S.sheet.rows }, (_, i) => i + 1);
}

/* ══════════════════════════════════════════════════════════════════════════════
   SESSION 3 FEATURES
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Color palette & pickers ─────────────────────────────────────────────── */
const FS_PALETTE = [
  null,        // No color
  '#ffffff', '#f1f5f9', '#e2e8f0', '#94a3b8', '#475569',
  '#fef2f2', '#fee2e2', '#fca5a5', '#ef4444', '#991b1b',
  '#fff7ed', '#fed7aa', '#fb923c', '#f97316', '#c2410c',
  '#fefce8', '#fef08a', '#facc15', '#eab308', '#854d0e',
  '#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#14532d',
  '#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a',
  '#f5f3ff', '#ddd6fe', '#a78bfa', '#7c3aed', '#4c1d95',
];

function _initColorPickers() {
  ['bg', 'tc'].forEach(type => {
    const popup = document.getElementById(`fs-${type}-popup`);
    if (!popup || popup._built) return;
    popup._built = true;
    const swatches = FS_PALETTE.map((color, i) => {
      if (!color) {
        return `<div class="fs-swatch fs-swatch-none" title="No color"
          onclick="_fsPickColor('${type}','')"></div>`;
      }
      return `<div class="fs-swatch" style="background:${color}" title="${color}"
        onclick="_fsPickColor('${type}','${color}')"></div>`;
    }).join('');
    popup.innerHTML = `<div class="fs-swatches">${swatches}</div>`;
  });
}

function _toggleColorPopup(type) {
  const popup = document.getElementById(`fs-${type}-popup`);
  const other = document.getElementById(type === 'bg' ? 'fs-tc-popup' : 'fs-bg-popup');
  other?.classList.add('hidden');
  document.getElementById('fs-border-popup')?.classList.add('hidden');
  popup?.classList.toggle('hidden');
}

function _fsPickColor(type, color) {
  const ref = S.sheet.selected;
  if (ref) {
    if (!S.sheet.data[ref]) S.sheet.data[ref] = { v: '', f: '', s: {} };
    if (!S.sheet.data[ref].s) S.sheet.data[ref].s = {};
    if (type === 'bg') {
      S.sheet.data[ref].s.bg = color || null;
      document.getElementById('fs-bg-bar').style.background = color || 'transparent';
    } else {
      S.sheet.data[ref].s.color = color || null;
      document.getElementById('fs-tc-bar').style.background = color || 'currentColor';
    }
    // Clean up empty style
    if (!Object.values(S.sheet.data[ref].s).some(Boolean)) {
      delete S.sheet.data[ref].s;
    }
    _refreshCell(ref);
    _selectCell(ref);
    _autoSaveSheet();
  }
  document.getElementById(`fs-${type}-popup`)?.classList.add('hidden');
}
window._fsPickColor = _fsPickColor;

/* ── Border picker ───────────────────────────────────────────────────────── */
function _toggleBorderPopup() {
  document.getElementById('fs-bg-popup')?.classList.add('hidden');
  document.getElementById('fs-tc-popup')?.classList.add('hidden');
  document.getElementById('fs-border-popup')?.classList.toggle('hidden');
}

function _fsSetBorder(borderType) {
  const ref = S.sheet.selected;
  if (ref) {
    if (!S.sheet.data[ref]) S.sheet.data[ref] = { v: '', f: '', s: {} };
    if (!S.sheet.data[ref].s) S.sheet.data[ref].s = {};
    S.sheet.data[ref].s.border = borderType || null;
    _refreshCell(ref);
    _selectCell(ref);
    _autoSaveSheet();
  }
  document.getElementById('fs-border-popup')?.classList.add('hidden');
}
window._fsSetBorder = _fsSetBorder;

/* ── Sort ────────────────────────────────────────────────────────────────── */
function _sortByColumn(col, asc) {
  col = col.toUpperCase();

  // Collect all row numbers
  const rowNums = _sheetRows();

  // Sort row numbers by value in the given column
  rowNums.sort((a, b) => {
    const va = _getCellRawValue(`${col}${a}`);
    const vb = _getCellRawValue(`${col}${b}`);
    const na = parseFloat(va), nb = parseFloat(vb);
    if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
    const sa = String(va).toLowerCase(), sb = String(vb).toLowerCase();
    return asc ? (sa < sb ? -1 : sa > sb ? 1 : 0) : (sa > sb ? -1 : sa < sb ? 1 : 0);
  });

  // Physically move cell data to new positions
  const oldData = JSON.parse(JSON.stringify(S.sheet.data));
  const newData = {};
  _sheetCols().forEach(c => {
    rowNums.forEach((oldRow, idx) => {
      const newRow = idx + 1;
      const src = `${c}${oldRow}`;
      const dst = `${c}${newRow}`;
      if (oldData[src]) newData[dst] = { ...oldData[src] };
    });
  });
  S.sheet.data = newData;
  S.sheet.sortCol = col;
  S.sheet.sortAsc = asc;

  // Re-apply filters on new data
  if (S.sheet.filterActive) _applyFiltersToHiddenRows();

  S.sheet.selected = null;
  _renderGrid();
  _autoSaveSheet();
  _toast(`Sorted by column ${col} ${asc ? 'A → Z' : 'Z → A'}`, 'success');
}

/* ── Filter ──────────────────────────────────────────────────────────────── */
function _toggleFilter() {
  S.sheet.filterActive = !S.sheet.filterActive;
  if (!S.sheet.filterActive) {
    S.sheet.filterValues = {};
    S.sheet.hiddenRows = new Set();
  }
  document.getElementById('fs-filter-btn')?.classList.toggle('is-active', S.sheet.filterActive);
  _renderGrid();
  if (S.sheet.selected) _selectCell(S.sheet.selected);
  _autoSaveSheet();
}

/* Show filter dropdown for a specific column header */
function _fsShowFilter(col, btnEl) {
  // Remove any existing filter dropdowns
  document.querySelectorAll('.fs-filter-dropdown').forEach(el => el.remove());

  // Collect all unique display values for this column (across all non-hidden rows)
  const allVals = new Set();
  for (let r = 1; r <= S.sheet.rows; r++) {
    const v = _getCellDisplay(`${col}${r}`);
    if (v !== '') allVals.add(v);
  }

  const activeSet = S.sheet.filterValues[col]; // undefined = all shown
  const items = [...allVals].sort().map(val => {
    const checked = !activeSet || activeSet.has(val);
    return `<label class="fs-filter-item">
      <input type="checkbox" value="${_e(val)}" ${checked ? 'checked' : ''}> ${_e(val)}
    </label>`;
  }).join('') || '<div style="padding:6px;font-size:0.8rem;color:#6b7280">No values</div>';

  const dropdown = document.createElement('div');
  dropdown.className = 'fs-filter-dropdown';
  dropdown.innerHTML = `
    <input class="fs-filter-search" type="text" placeholder="Search…">
    <div class="fs-filter-list">${items}</div>
    <button class="fs-filter-apply">Apply</button>
  `;

  // Position relative to the header th
  const headerTh = btnEl.closest('th.fd-col-header');
  if (headerTh) {
    headerTh.style.position = 'relative';
    headerTh.appendChild(dropdown);
  }

  dropdown.querySelector('.fs-filter-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    dropdown.querySelectorAll('.fs-filter-item').forEach(item => {
      item.style.display = item.textContent.trim().toLowerCase().includes(q) ? '' : 'none';
    });
  });

  dropdown.querySelector('.fs-filter-apply')?.addEventListener('click', () => {
    const checkedVals = new Set(
      Array.from(dropdown.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value)
    );
    const totalVals = dropdown.querySelectorAll('input[type=checkbox]').length;
    if (checkedVals.size === 0 || checkedVals.size === totalVals) {
      delete S.sheet.filterValues[col];
    } else {
      S.sheet.filterValues[col] = checkedVals;
    }
    dropdown.remove();
    _applyFiltersToHiddenRows();
    _renderGrid();
    if (S.sheet.selected) _selectCell(S.sheet.selected);
    _autoSaveSheet();
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeDD(ev) {
      if (!dropdown.contains(ev.target) && !btnEl.contains(ev.target)) {
        dropdown.remove();
        document.removeEventListener('click', closeDD);
      }
    });
  }, 50);
}
window._fsShowFilter = _fsShowFilter;

function _applyFiltersToHiddenRows() {
  S.sheet.hiddenRows = new Set();
  if (Object.keys(S.sheet.filterValues).length === 0) return;
  for (let r = 1; r <= S.sheet.rows; r++) {
    for (const [col, allowed] of Object.entries(S.sheet.filterValues)) {
      const val = _getCellDisplay(`${col}${r}`);
      if (!allowed.has(val)) { S.sheet.hiddenRows.add(r); break; }
    }
  }
}

/* ── Copy / Paste ────────────────────────────────────────────────────────── */
function _copyCell() {
  const ref = S.sheet.selected;
  if (!ref) return;
  const cell = S.sheet.data[ref];
  S.sheet.clipboard = cell ? JSON.parse(JSON.stringify(cell)) : null;
  S.sheet.copyRef = ref;
  // Visual: dashed border on source cell
  document.querySelectorAll('.is-copy-source').forEach(el => el.classList.remove('is-copy-source'));
  document.querySelector(`[data-ref="${ref}"]`)?.classList.add('is-copy-source');
  _toast('Copied cell', 'success');
}

function _pasteCell() {
  const ref = S.sheet.selected;
  if (!ref) return;
  if (!S.sheet.clipboard) { _toast('Nothing to paste', 'error'); return; }
  S.sheet.data[ref] = JSON.parse(JSON.stringify(S.sheet.clipboard));
  _refreshCell(ref);
  _selectCell(ref);
  _autoSaveSheet();
}

/* ── Fill Down / Fill Right ──────────────────────────────────────────────── */
function _fillDown() {
  const ref = S.sheet.selected;
  if (!ref) return;
  const { col, row } = _parseRef(ref);
  const rowNum = parseInt(row, 10);
  const sourceCell = S.sheet.data[ref];
  if (!sourceCell) return;

  let count = 0;
  for (let r = rowNum + 1; r <= S.sheet.rows; r++) {
    const target = `${col}${r}`;
    const existing = S.sheet.data[target];
    if (existing && (existing.v || existing.f)) break; // stop at non-empty cell
    S.sheet.data[target] = JSON.parse(JSON.stringify(sourceCell));
    _refreshCell(target);
    count++;
  }
  if (count > 0) {
    _autoSaveSheet();
    _toast(`Filled ${count} cell${count > 1 ? 's' : ''} down`, 'success');
  }
}

function _fillRight() {
  const ref = S.sheet.selected;
  if (!ref) return;
  const { col, row } = _parseRef(ref);
  const colIdx = col.charCodeAt(0) - 65;
  const sourceCell = S.sheet.data[ref];
  if (!sourceCell) return;

  let count = 0;
  for (let c = colIdx + 1; c < S.sheet.cols; c++) {
    const target = `${String.fromCharCode(65 + c)}${row}`;
    const existing = S.sheet.data[target];
    if (existing && (existing.v || existing.f)) break; // stop at non-empty cell
    S.sheet.data[target] = JSON.parse(JSON.stringify(sourceCell));
    _refreshCell(target);
    count++;
  }
  if (count > 0) {
    _autoSaveSheet();
    _toast(`Filled ${count} cell${count > 1 ? 's' : ''} right`, 'success');
  }
}

/* ── Freeze rows / columns ───────────────────────────────────────────────── */
function _toggleFreeze() {
  // Cycle: none → freeze row → freeze row+col → freeze col → none
  if (!S.sheet.freezeRow && !S.sheet.freezeCol) {
    S.sheet.freezeRow = true;
  } else if (S.sheet.freezeRow && !S.sheet.freezeCol) {
    S.sheet.freezeCol = true;
  } else if (S.sheet.freezeRow && S.sheet.freezeCol) {
    S.sheet.freezeRow = false;
  } else {
    S.sheet.freezeCol = false;
  }
  _updateFreezeBtn();
  _renderGrid();
  if (S.sheet.selected) _selectCell(S.sheet.selected);
  _autoSaveSheet();
}

function _updateFreezeBtn() {
  const btn = document.getElementById('fs-freeze-btn');
  if (!btn) return;
  const fr = S.sheet.freezeRow, fc = S.sheet.freezeCol;
  btn.classList.toggle('is-active', fr || fc);
  if (fr && fc) btn.title = 'Unfreeze row (freeze row + col A active)';
  else if (fr)  btn.title = 'Freeze first column too (row 1 frozen)';
  else if (fc)  btn.title = 'Unfreeze column A';
  else          btn.title = 'Freeze top row';
}
