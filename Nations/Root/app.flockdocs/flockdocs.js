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
    data: {},              // { 'A1': { v: '', f: '', s: { bold, fmt } } }
    selected: null,        // Currently selected cell ref e.g. 'A1'
    isEditing: false,      // Is a cell currently being inline-edited?
    colWidths: {},         // { 'A': 100, 'B': 150 }
    rows: 50,
    cols: 26,
    autoSaveTimer: null,
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

  // Close new-doc dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('fd-new-menu');
    const wrap = document.getElementById('fd-new-btn-wrap');
    if (menu && !menu.classList.contains('hidden') && !wrap?.contains(e.target)) {
      menu.classList.add('hidden');
    }

    // Close mobile sidebar when clicking outside
    const sidebar = document.getElementById('fd-sidebar-wrap');
    const menuBtn = document.getElementById('fd-menu-btn');
    if (sidebar?.classList.contains('is-open') &&
        !sidebar.contains(e.target) &&
        !menuBtn.contains(e.target)) {
      sidebar.classList.remove('is-open');
    }
  });

  // ── Spreadsheet toolbar events ─────────────────────────────────────────
  document.getElementById('fd-sheet-back-btn')?.addEventListener('click', _closeSpreadsheetEditor);
  document.getElementById('fd-sheet-save-btn')?.addEventListener('click', _saveSpreadsheet);
  document.getElementById('fs-bold-btn')?.addEventListener('click', _toggleCellBold);
  document.querySelectorAll('.fs-fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => _setCellFormat(btn.dataset.fmt));
  });

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

  S.sheet.selected = null;
  S.sheet.isEditing = false;

  // Show spreadsheet view, hide others
  document.getElementById('fd-library-view')?.classList.add('hidden');
  document.getElementById('fd-editor-view')?.classList.add('hidden');
  document.getElementById('fd-sheet-view')?.classList.remove('hidden');

  // Set spreadsheet name
  const nameInput = document.getElementById('fd-sheet-name');
  if (nameInput) nameInput.value = S.currentDoc.name || 'Untitled Spreadsheet';

  // Render the grid
  _renderGrid();

  // Bind grid mouse events once via the persistent wrap element (not the table)
  const wrap = document.getElementById('fd-grid-wrap');
  if (wrap && !wrap._sheetBound) {
    wrap.addEventListener('mousedown', _onGridMousedown);
    wrap.addEventListener('dblclick', _onGridDblclick);
    wrap._sheetBound = true;
  }

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
  clearTimeout(S.sheet.autoSaveTimer);

  _loadDocuments();
}

/* ── Grid Rendering ───────────────────────────────────────────────────────── */
function _renderGrid() {
  const cols = _sheetCols();
  const rows = _sheetRows();

  // Build table HTML
  const parts = ['<table class="fd-grid" id="fd-grid" role="grid">'];

  // ── Sticky header row ──
  parts.push('<thead><tr>');
  parts.push('<th class="fd-corner"></th>');
  for (const col of cols) {
    const w = S.sheet.colWidths[col] || 100;
    parts.push(`<th class="fd-col-header" data-col="${col}" style="width:${w}px;min-width:${w}px">${col}</th>`);
  }
  parts.push('</tr></thead>');

  // ── Data rows ──
  parts.push('<tbody>');
  for (const row of rows) {
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
      else if (typeof _evalFormula(cell?.f || '') === 'number' || (!isNaN(parseFloat(cell?.v)) && cell?.v !== '')) {
        cls += ' fd-num';
      }
      parts.push(`<td class="${cls}" data-ref="${ref}" data-row="${row}" data-col="${col}">${_e(display)}</td>`);
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
  else if (_isNumericDisplay(ref)) cls += ' fd-num';

  cellEl.className = cls;
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
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        _startCellEdit(S.sheet.selected, e.key);
      }
      // Ctrl+B = toggle bold
      if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        _toggleCellBold();
      }
      // Ctrl+S = save
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        _saveSpreadsheet();
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

  let val;
  if (cell.f && cell.f.startsWith('=')) {
    val = _evalFormula(cell.f);
  } else {
    val = cell.v;
  }

  return _applyFormat(val, cell.s?.fmt);
}

function _getCellRawValue(ref) {
  const cell = S.sheet.data[ref];
  if (!cell) return '';
  if (cell.f && cell.f.startsWith('=')) return _evalFormula(cell.f);
  return cell.v ?? '';
}

function _evalFormula(formula) {
  if (!formula || !formula.startsWith('=')) return formula;

  const expr = formula.substring(1).trim().toUpperCase();

  // ── Built-in functions ────────────────────────────────────────────────
  const fnMatch = expr.match(/^(SUM|AVERAGE|COUNT|COUNTA|MIN|MAX)\(([^)]+)\)$/);
  if (fnMatch) {
    const [, fn, argStr] = fnMatch;
    const vals = _getRangeValues(argStr.trim());
    switch (fn) {
      case 'SUM':     return vals.reduce((a, b) => a + b, 0);
      case 'AVERAGE': return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      case 'COUNT':   return vals.length;
      case 'COUNTA':  return _parseRange(argStr.trim()).filter(r => _getCellRawValue(r) !== '').length;
      case 'MIN':     return vals.length ? Math.min(...vals) : 0;
      case 'MAX':     return vals.length ? Math.max(...vals) : 0;
    }
  }

  // ── Basic math with cell references ───────────────────────────────────
  try {
    // Substitute cell refs with numeric values
    let evalExpr = expr.replace(/\b([A-Z]+)(\d+)\b/g, (_, col, row) => {
      const val = parseFloat(_getCellRawValue(col + row));
      return isNaN(val) ? '0' : String(val);
    });

    // Allow only safe math characters after substitution
    if (!/^[0-9+\-*/.() \t]+$/.test(evalExpr)) return '#ERROR';

    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${evalExpr})`)();
    return typeof result === 'number' && isFinite(result) ? result : '#ERROR';
  } catch (_) {
    return '#ERROR';
  }
}

function _getRangeValues(rangeStr) {
  return _parseRange(rangeStr)
    .map(ref => parseFloat(_getCellRawValue(ref)))
    .filter(v => !isNaN(v));
}

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
  if (val === '#ERROR') return '#ERROR';

  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return String(val); // text — no formatting

  switch (fmt) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
    case 'percent':
      // Standard spreadsheet behaviour: 0.5 → 50%, 1 → 100% (no pre-division)
      return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(num);
    case 'decimal':
      return num.toFixed(2);
    default:
      // Display whole numbers without decimal point; avoid floating-point noise
      if (Number.isInteger(num)) return String(num);
      // Round to 9 significant digits to eliminate floating-point artefacts
      return parseFloat(num.toPrecision(9)).toString();
  }
}

function _isNumericDisplay(ref) {
  const display = _getCellDisplay(ref);
  if (!display || display === '#ERROR') return false;
  return !isNaN(parseFloat(display)) && display.trim() !== '';
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

  const saveStatus = document.getElementById('fd-sheet-save-status');
  if (saveStatus) saveStatus.textContent = 'Saving…';

  try {
    const db = firebase.firestore();

    if (S.currentDoc.id) {
      await db.collection(COLLECTION_DOCS).doc(S.currentDoc.id).update({
        name: S.currentDoc.name,
        sheetData,
        colWidths,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const docRef = await db.collection(COLLECTION_DOCS).add({
        name: S.currentDoc.name,
        type: 'spreadsheet',
        sheetData,
        colWidths,
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
