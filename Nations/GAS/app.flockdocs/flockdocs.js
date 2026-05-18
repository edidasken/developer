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
  // Session 6: Collaboration state
  collab: {
    realtimeUnsub: null,   // Firestore onSnapshot unsubscribe function
    presenceUnsub: null,   // Presence onSnapshot unsubscribe
    presenceDocRef: null,  // Ref to our own presence entry
    activeTab: 'comments', // 'comments' | 'history'
    comments: [],          // Loaded comments
    versions: [],          // Loaded versions
    pendingVersion: null,  // Version object awaiting preview/restore
    lastSaveVersion: 0,    // Timestamp of last auto-versioned save
    shareData: null,       // Pending share dialog state
    sharedWith: [],        // Pending list of specific users for share dialog
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
    // Session 4 state
    charts: [],            // Array of chart definitions { id, type, range, title, hasHeaders, paletteIdx, showLegend }
    chartBuilderOpen: false,
    chartPreviewInstance: null, // Chart.js instance in the builder preview
    chartPaletteIdx: 0,         // Currently selected palette in builder
    chartType: 'bar',           // Currently selected chart type in builder
  },
  // Session 8: FlockSlides state
  slides: {
    slides: [],          // Array of slide objects { id, bg, transition, elements[] }
    currentIdx: 0,       // Current slide index
    selectedElId: null,  // Selected element ID
    dragState: null,     // { elId, startX, startY, origX, origY }
    resizeState: null,   // { elId, handle, startX, startY, origW, origH, origX, origY }
    theme: 'default',    // Active theme name
    scale: 1,            // CSS scale for canvas
    autoSaveTimer: null,
    presenterMode: false,
    presenterIdx: 0,
  },
};

/* ── Initialization ───────────────────────────────────────────────────────── */
window.FlockDocs = {
  init,
  createNewDocument,
  createNewSpreadsheet,
  createNewPresentation,
  showTemplatePicker,
  showShareDialog,
  openDocument,
  saveDocument,
  deleteDocument,
  switchView,
  exportDocAsHtml: () => _exportDocAsHtml(),
  exportDocAsPdf: () => _exportDocAsPdf(),
  exportSheetAsCsv: () => _exportSheetAsCsv(),
  exportSheetAsXlsx: () => _exportSheetAsXlsx(),
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

  // Insert chart button
  document.getElementById('fs-chart-btn')?.addEventListener('click', _showChartBuilder);

  // Session 7: Spreadsheet Import/Export bindings
  document.getElementById('fd-sheet-io-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('fd-sheet-io-dropdown')?.classList.toggle('hidden');
  });
  document.getElementById('fd-export-csv-btn')?.addEventListener('click', () => {
    document.getElementById('fd-sheet-io-dropdown')?.classList.add('hidden');
    _exportSheetAsCsv();
  });
  document.getElementById('fd-export-xlsx-btn')?.addEventListener('click', () => {
    document.getElementById('fd-sheet-io-dropdown')?.classList.add('hidden');
    _exportSheetAsXlsx();
  });
  document.getElementById('fd-import-csv-btn')?.addEventListener('click', () => {
    document.getElementById('fd-sheet-io-dropdown')?.classList.add('hidden');
    document.getElementById('fd-csv-file-input')?.click();
  });
  document.getElementById('fd-import-xlsx-btn')?.addEventListener('click', () => {
    document.getElementById('fd-sheet-io-dropdown')?.classList.add('hidden');
    document.getElementById('fd-xlsx-file-input')?.click();
  });
  document.getElementById('fd-csv-file-input')?.addEventListener('change', (e) => {
    if (e.target.files[0]) _importSheetCsv(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('fd-xlsx-file-input')?.addEventListener('change', (e) => {
    if (e.target.files[0]) _importSheetXlsx(e.target.files[0]);
    e.target.value = '';
  });

  // Chart modal controls
  document.getElementById('fd-chart-modal-close')?.addEventListener('click', _closeChartBuilder);
  document.getElementById('fd-chart-cancel-btn')?.addEventListener('click', _closeChartBuilder);
  document.getElementById('fd-chart-insert-btn')?.addEventListener('click', _insertChart);
  document.getElementById('fd-chart-range')?.addEventListener('input', _updateChartPreview);
  document.getElementById('fd-chart-headers')?.addEventListener('change', _updateChartPreview);
  document.getElementById('fd-chart-title')?.addEventListener('input', _updateChartPreview);
  document.getElementById('fd-chart-legend')?.addEventListener('change', _updateChartPreview);

  // Chart type buttons (delegated)
  document.getElementById('fd-chart-type-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-chart-type]');
    if (!btn) return;
    document.querySelectorAll('[data-chart-type]').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    S.sheet.chartType = btn.dataset.chartType;
    _updateChartPreview();
  });

  // Close chart modal on overlay click
  document.getElementById('fd-chart-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('fd-chart-modal-overlay')) _closeChartBuilder();
  });

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
    // Writer table popup
    if (!document.getElementById('fd-table-btn-wrap')?.contains(e.target)) {
      document.getElementById('fd-table-popup')?.classList.add('hidden');
    }
    // Writer page layout popup
    if (!document.getElementById('fd-layout-btn-wrap')?.contains(e.target)) {
      document.getElementById('fd-layout-popup')?.classList.add('hidden');
    }
    // Session 7: IO dropdown menus
    if (!document.getElementById('fd-writer-io-wrap')?.contains(e.target)) {
      document.getElementById('fd-writer-io-dropdown')?.classList.add('hidden');
    }
    if (!document.getElementById('fd-sheet-io-wrap')?.contains(e.target)) {
      document.getElementById('fd-sheet-io-dropdown')?.classList.add('hidden');
    }
  });

  // ── Session 5: Document Enhancement bindings ───────────────────────────
  // Insert Image button
  document.getElementById('fd-insert-image-btn')?.addEventListener('click', () => {
    // Show sub-menu or directly open file dialog
    document.getElementById('fd-image-file-input')?.click();
  });
  document.getElementById('fd-image-file-input')?.addEventListener('change', _insertImageFromFile);

  // Insert Table popup
  document.getElementById('fd-insert-table-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const popup = document.getElementById('fd-table-popup');
    if (popup) {
      popup.classList.toggle('hidden');
      if (!popup.classList.contains('hidden')) _buildTableGrid();
    }
  });

  // Insert Page Break
  document.getElementById('fd-insert-break-btn')?.addEventListener('click', _insertPageBreak);

  // Page Layout popup
  document.getElementById('fd-page-layout-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('fd-layout-popup')?.classList.toggle('hidden');
  });

  // Page layout margin buttons (delegated)
  document.getElementById('fd-layout-popup')?.addEventListener('click', (e) => {
    const marginBtn = e.target.closest('[data-margin]');
    const orientBtn = e.target.closest('[data-orient]');
    if (marginBtn) {
      _applyPageMargin(marginBtn.dataset.margin);
      document.getElementById('fd-layout-popup')?.classList.add('hidden');
    }
    if (orientBtn) {
      _applyPageOrientation(orientBtn.dataset.orient);
      document.getElementById('fd-layout-popup')?.classList.add('hidden');
    }
  });

  // Print button
  document.getElementById('fd-print-btn')?.addEventListener('click', _printDocument);

  // Header/footer auto-save on input
  document.getElementById('fd-doc-header')?.addEventListener('input', _autoSave);
  document.getElementById('fd-doc-footer')?.addEventListener('input', _autoSave);

  // Template picker close
  document.getElementById('fd-template-close-btn')?.addEventListener('click', () => {
    document.getElementById('fd-template-overlay')?.classList.add('hidden');
  });
  document.getElementById('fd-template-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('fd-template-overlay')) {
      document.getElementById('fd-template-overlay')?.classList.add('hidden');
    }
  });
  // Template grid (delegated, injected by showTemplatePicker)
  document.getElementById('fd-template-grid')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-template]');
    if (card) _applyTemplate(card.dataset.template);
  });

  // ── Session 6: Collaboration bindings ─────────────────────────────────
  // Share button
  document.getElementById('fd-share-btn')?.addEventListener('click', showShareDialog);

  // Comments panel toggle
  document.getElementById('fd-comments-btn')?.addEventListener('click', () => {
    _toggleCollabPanel('comments');
  });

  // History panel toggle
  document.getElementById('fd-history-btn')?.addEventListener('click', () => {
    _toggleCollabPanel('history');
  });

  // Collab panel tab switching
  document.getElementById('fd-collab-panel')?.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) _switchCollabTab(tab.dataset.tab);
  });

  // Comment submit
  document.getElementById('fd-comment-submit')?.addEventListener('click', _addComment);
  document.getElementById('fd-comment-textarea')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) _addComment();
  });

  // Share modal close
  document.getElementById('fd-share-close-btn')?.addEventListener('click', _closeShareDialog);
  document.getElementById('fd-share-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('fd-share-overlay')) _closeShareDialog();
  });

  // Share church toggle shows/hides permission row
  document.getElementById('fd-share-church-toggle')?.addEventListener('change', (e) => {
    const row = document.getElementById('fd-share-church-perm-row');
    if (row) row.style.display = e.target.checked ? 'flex' : 'none';
  });

  // Share: add user
  document.getElementById('fd-share-add-user-btn')?.addEventListener('click', _addSharedUser);
  document.getElementById('fd-share-email-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _addSharedUser();
  });

  // Share: save
  document.getElementById('fd-share-save-btn')?.addEventListener('click', _saveShareSettings);

  // Share: copy link
  document.getElementById('fd-share-copy-link-btn')?.addEventListener('click', _copyShareLink);

  // Version preview close/cancel/restore
  document.getElementById('fd-version-preview-close')?.addEventListener('click', _closeVersionPreview);
  document.getElementById('fd-version-cancel-btn')?.addEventListener('click', _closeVersionPreview);
  document.getElementById('fd-version-restore-btn')?.addEventListener('click', _restoreVersion);
  document.getElementById('fd-version-preview-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('fd-version-preview-overlay')) _closeVersionPreview();
  });

  // ── Session 7: Import/Export — Writer ─────────────────────────────────
  document.getElementById('fd-writer-io-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('fd-writer-io-dropdown')?.classList.toggle('hidden');
  });
  document.getElementById('fd-export-html-btn')?.addEventListener('click', () => {
    document.getElementById('fd-writer-io-dropdown')?.classList.add('hidden');
    _exportDocAsHtml();
  });
  document.getElementById('fd-export-pdf-btn')?.addEventListener('click', () => {
    document.getElementById('fd-writer-io-dropdown')?.classList.add('hidden');
    _exportDocAsPdf();
  });
  document.getElementById('fd-export-txt-btn')?.addEventListener('click', () => {
    document.getElementById('fd-writer-io-dropdown')?.classList.add('hidden');
    _exportDocAsText();
  });
  document.getElementById('fd-email-doc-btn')?.addEventListener('click', () => {
    document.getElementById('fd-writer-io-dropdown')?.classList.add('hidden');
    _emailDocument();
  });
  document.getElementById('fd-import-docx-btn')?.addEventListener('click', () => {
    document.getElementById('fd-writer-io-dropdown')?.classList.add('hidden');
    document.getElementById('fd-docx-file-input')?.click();
  });
  document.getElementById('fd-docx-file-input')?.addEventListener('change', (e) => {
    if (e.target.files[0]) _importDocx(e.target.files[0]);
    e.target.value = '';
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
    // Session 5: stash Firestore 'pageLayout' (JSON string) as pageLayout_raw;
    // always set it so _openEditor can safely JSON.parse it.
    S.currentDoc.pageLayout_raw = (typeof S.currentDoc.pageLayout === 'string')
      ? S.currentDoc.pageLayout
      : '';
    delete S.currentDoc.pageLayout;

    if (S.currentDoc.type === 'spreadsheet') {
      _openSpreadsheetEditor();
    } else if (S.currentDoc.type === 'presentation') {
      _openSlidesEditor();
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

  // Collect header / footer / pageLayout (Session 5)
  S.currentDoc.docHeader   = document.getElementById('fd-doc-header')?.innerHTML  || '';
  S.currentDoc.docFooter   = document.getElementById('fd-doc-footer')?.innerHTML  || '';
  S.currentDoc.pageLayout  = S.currentDoc.pageLayout || {};

  // Extract document name from first heading
  const firstHeading = editor.querySelector('h1, h2, h3');
  if (firstHeading) {
    S.currentDoc.name = firstHeading.textContent.trim() || 'Untitled Document';
  }

  try {
    const db = firebase.firestore();
    const saveStatus = document.getElementById('fd-save-status');
    
    if (saveStatus) saveStatus.textContent = 'Saving...';

    const docPayload = {
      name: S.currentDoc.name,
      content: S.currentDoc.content,
      docHeader:  S.currentDoc.docHeader,
      docFooter:  S.currentDoc.docFooter,
      pageLayout: JSON.stringify(S.currentDoc.pageLayout),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: S.user.uid,
      updatedByName: S.user.displayName || 'Anonymous',
    };

    if (S.currentDoc.id) {
      // Update existing document
      await db.collection(COLLECTION_DOCS).doc(S.currentDoc.id).update(docPayload);
    } else {
      // Create new document
      const docRef = await db.collection(COLLECTION_DOCS).add({
        ...docPayload,
        type: S.currentDoc.type,
        ownerId: S.currentDoc.ownerId,
        ownerName: S.currentDoc.ownerName,
        shared: S.currentDoc.shared || false,
        sharedWith: S.currentDoc.sharedWith || [],
        churchPermission: S.currentDoc.churchPermission || 'view',
        folderId: S.currentDoc.folderId,
        deleted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      S.currentDoc.id = docRef.id;
      // Start realtime + presence now that doc has an ID
      _startRealtimeSync();
      _startPresence();
    }

    if (saveStatus) saveStatus.textContent = 'All changes saved';
    console.log('[FlockDocs] Document saved:', S.currentDoc.id);

    // Session 6: save a version (rate-limited to 1 per minute)
    _saveVersion();
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
  const sheetClass = doc.type === 'spreadsheet' ? ' fd-doc-sheet' : (doc.type === 'presentation' ? ' fd-doc-pres' : '');
  
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

  // Restore header and footer (Session 5)
  const headerEl = document.getElementById('fd-doc-header');
  const footerEl = document.getElementById('fd-doc-footer');
  if (headerEl) headerEl.innerHTML = S.currentDoc.docHeader || '';
  if (footerEl) footerEl.innerHTML = S.currentDoc.docFooter || '';

  // Restore page layout (Session 5)
  S.currentDoc.pageLayout = {};
  if (S.currentDoc.pageLayout_raw) {
    try { S.currentDoc.pageLayout = JSON.parse(S.currentDoc.pageLayout_raw); } catch (_) { /* */ }
  }
  _applyStoredPageLayout();

  // Session 6: start realtime sync + presence (only for saved docs)
  if (S.currentDoc.id) {
    _startRealtimeSync();
    _startPresence();
    _loadComments();
    _loadVersionHistory();
  }
}

function _closeEditor() {
  // Session 6: tear down realtime + presence
  _stopRealtimeSync();
  _stopPresence();

  // Close collab panel if open
  document.getElementById('fd-collab-panel')?.classList.remove('is-open');

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

function _toast(msg, type = 'info', durationMs = 3500) {
  const container = document.getElementById('fd-toast-container');
  if (!container) {
    console.log(`[FlockDocs] ${type.toUpperCase()}: ${msg}`);
    return;
  }
  const el = document.createElement('div');
  el.className = 'fd-toast' + (type !== 'info' ? ' ' + type : '');
  el.textContent = msg;
  container.appendChild(el);
  const remove = () => {
    el.classList.add('fd-toast-fade');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };
  const timer = setTimeout(remove, durationMs);
  el.addEventListener('click', () => { clearTimeout(timer); remove(); });
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
  S.sheet.charts = [];
  S.sheet.chartType = 'bar';
  S.sheet.chartPaletteIdx = 0;

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
      if (Array.isArray(meta.charts)) S.sheet.charts = meta.charts;
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

  // Init chart builder palettes (done once per open)
  _initChartPalettes();

  // Render the grid
  _renderGrid();

  // Render any saved charts
  _renderChartsPanel();

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

  // Close chart builder if open
  _closeChartBuilder();

  // Destroy any live Chart.js instances in the panel
  _destroyPanelCharts();

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
  S.sheet.charts = [];
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

  // Serialize Session 3+4 metadata
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
    charts:       S.sheet.charts,   // Session 4: chart definitions
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

/* ══════════════════════════════════════════════════════════════════════════════
   SESSION 4: CHARTS & VISUALIZATIONS
   "The heavens declare the glory of God; the skies proclaim the work of his hands."
   — Psalm 19:1
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Color Palettes ───────────────────────────────────────────────────────── */
const FS_CHART_PALETTES = [
  { name: 'Ocean',    colors: ['#2563eb','#0891b2','#059669','#7c3aed','#db2777','#ea580c'] },
  { name: 'Church',   colors: ['#1a73e8','#f59e0b','#10b981','#8b5cf6','#ef4444','#64748b'] },
  { name: 'Harvest',  colors: ['#d97706','#b45309','#15803d','#166534','#92400e','#78350f'] },
  { name: 'Pastel',   colors: ['#93c5fd','#6ee7b7','#fde68a','#fca5a5','#c4b5fd','#a5f3fc'] },
  { name: 'Mono',     colors: ['#1f2937','#374151','#6b7280','#9ca3af','#d1d5db','#f3f4f6'] },
];

function _initChartPalettes() {
  const container = document.getElementById('fd-chart-palettes');
  if (!container || container._built) return;
  container._built = true;
  container.innerHTML = FS_CHART_PALETTES.map((palette, idx) => {
    const dots = palette.colors.slice(0, 4).map(c =>
      `<div class="fd-palette-dot" style="background:${c}"></div>`).join('');
    return `<button class="fd-palette-btn${idx === 0 ? ' is-active' : ''}"
      data-palette="${idx}" title="${palette.name}">${dots}</button>`;
  }).join('');
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-palette]');
    if (!btn) return;
    container.querySelectorAll('.fd-palette-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    S.sheet.chartPaletteIdx = parseInt(btn.dataset.palette, 10);
    _updateChartPreview();
  });
}

/* ── Chart Builder ────────────────────────────────────────────────────────── */
function _showChartBuilder() {
  S.sheet.chartBuilderOpen = true;

  // Pre-fill range from current selection
  const rangeInput = document.getElementById('fd-chart-range');
  if (rangeInput && S.sheet.selected && !rangeInput.value) {
    rangeInput.value = S.sheet.selected;
  }

  // Restore type selection
  document.querySelectorAll('[data-chart-type]').forEach(b => {
    b.classList.toggle('is-active', b.dataset.chartType === S.sheet.chartType);
  });

  document.getElementById('fd-chart-modal-overlay')?.classList.remove('hidden');
  _updateChartPreview();
}

function _closeChartBuilder() {
  if (!S.sheet.chartBuilderOpen) return;
  S.sheet.chartBuilderOpen = false;

  // Destroy preview chart instance
  if (S.sheet.chartPreviewInstance) {
    S.sheet.chartPreviewInstance.destroy();
    S.sheet.chartPreviewInstance = null;
  }
  document.getElementById('fd-chart-modal-overlay')?.classList.add('hidden');
}

/* ── Build Chart.js data config from sheet data + range string ────────────── */
function _buildChartData(rangeStr, hasHeaders, type, paletteIdx) {
  rangeStr = rangeStr.trim().toUpperCase();
  if (!rangeStr.match(/^[A-Z]+\d+(:[A-Z]+\d+)?$/)) return null;

  const refs = _parseRange(rangeStr);
  if (!refs.length) return null;

  // Find the bounding box
  const parsedAll = refs.map(_parseRef);
  const colLetters = [...new Set(parsedAll.map(r => r.col))].sort();
  const rowNums = [...new Set(parsedAll.map(r => parseInt(r.row, 10)))].sort((a, b) => a - b);

  if (colLetters.length === 0 || rowNums.length === 0) return null;

  const palette = FS_CHART_PALETTES[paletteIdx] || FS_CHART_PALETTES[0];

  // Extract labels (first column) and series (remaining columns)
  const labelCol = colLetters[0];
  const dataStartCol = 1; // index into colLetters

  // Determine header row offset
  const dataRowStart = hasHeaders ? 1 : 0;
  if (dataRowStart >= rowNums.length) return null;

  const labels = rowNums.slice(dataRowStart).map(r => {
    const val = _getCellDisplay(`${labelCol}${r}`);
    return val !== '' ? val : `Row ${r}`;
  });

  if (colLetters.length < 2) {
    // Single column: values in label col, synthetic series
    const values = rowNums.slice(dataRowStart).map(r =>
      parseFloat(_getCellRawValue(`${labelCol}${r}`)) || 0
    );
    const seriesLabel = hasHeaders
      ? (_getCellDisplay(`${labelCol}${rowNums[0]}`) || 'Values')
      : 'Values';
    return {
      labels,
      datasets: [{
        label: seriesLabel,
        data: values,
        backgroundColor: _buildBgColors(type, palette, 0, labels.length),
        borderColor: type === 'line' ? palette.colors[0] : undefined,
        borderWidth: type === 'line' ? 2 : 1,
        fill: false,
      }],
    };
  }

  // Multiple columns: each column (after first) is a dataset
  const datasets = colLetters.slice(dataStartCol).map((col, colIdx) => {
    const seriesLabel = hasHeaders
      ? (_getCellDisplay(`${col}${rowNums[0]}`) || col)
      : col;
    const data = rowNums.slice(dataRowStart).map(r =>
      parseFloat(_getCellRawValue(`${col}${r}`)) || 0
    );
    const color = palette.colors[colIdx % palette.colors.length];
    return {
      label: seriesLabel,
      data,
      backgroundColor: _buildBgColors(type, palette, colIdx, labels.length),
      borderColor: type === 'line' ? color : undefined,
      borderWidth: type === 'line' ? 2 : 1,
      fill: false,
    };
  });

  return { labels, datasets };
}

function _buildBgColors(type, palette, colIdx, count) {
  if (type === 'pie' || type === 'doughnut') {
    // Each slice gets its own color
    return Array.from({ length: count }, (_, i) =>
      palette.colors[i % palette.colors.length] + 'cc');
  }
  const color = palette.colors[colIdx % palette.colors.length];
  return color + 'cc'; // single color with transparency
}

/* ── Live Preview in modal ────────────────────────────────────────────────── */
function _updateChartPreview() {
  const rangeStr = document.getElementById('fd-chart-range')?.value || '';
  const hasHeaders = document.getElementById('fd-chart-headers')?.checked !== false;
  const title = document.getElementById('fd-chart-title')?.value || '';
  const showLegend = document.getElementById('fd-chart-legend')?.checked !== false;
  const type = S.sheet.chartType;
  const paletteIdx = S.sheet.chartPaletteIdx;

  const msgEl = document.getElementById('fd-chart-preview-msg');
  const canvas = document.getElementById('fd-chart-preview-canvas');
  if (!canvas) return;

  if (!rangeStr.trim()) {
    if (msgEl) msgEl.textContent = 'Enter a data range to preview the chart.';
    if (S.sheet.chartPreviewInstance) {
      S.sheet.chartPreviewInstance.destroy();
      S.sheet.chartPreviewInstance = null;
    }
    return;
  }

  const chartData = _buildChartData(rangeStr, hasHeaders, type, paletteIdx);
  if (!chartData) {
    if (msgEl) msgEl.textContent = 'Could not parse range. Try something like A1:C10.';
    return;
  }
  if (msgEl) msgEl.textContent = '';

  // Destroy old preview instance before creating new one
  if (S.sheet.chartPreviewInstance) {
    S.sheet.chartPreviewInstance.destroy();
    S.sheet.chartPreviewInstance = null;
  }

  const ctx = canvas.getContext('2d');
  S.sheet.chartPreviewInstance = new Chart(ctx, _buildChartJsConfig(type, chartData, title, showLegend));
}

/* Build a Chart.js configuration object */
function _buildChartJsConfig(type, chartData, title, showLegend) {
  const isRadial = type === 'pie' || type === 'doughnut';
  return {
    type,
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: { display: showLegend, position: isRadial ? 'right' : 'top' },
        title: {
          display: !!title,
          text: title,
          font: { size: 14, weight: '600', family: "'Plus Jakarta Sans', sans-serif" },
          color: '#1f2937',
        },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: isRadial ? {} : {
        x: {
          ticks: { font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" }, color: '#6b7280' },
          grid: { color: '#e5e7eb' },
        },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" }, color: '#6b7280' },
          grid: { color: '#e5e7eb' },
        },
      },
    },
  };
}

/* ── Insert Chart (save to sheet + render in panel) ─────────────────────── */
function _insertChart() {
  const rangeStr = document.getElementById('fd-chart-range')?.value || '';
  const hasHeaders = document.getElementById('fd-chart-headers')?.checked !== false;
  const title = document.getElementById('fd-chart-title')?.value.trim() || 'Chart';
  const showLegend = document.getElementById('fd-chart-legend')?.checked !== false;
  const type = S.sheet.chartType;
  const paletteIdx = S.sheet.chartPaletteIdx;

  if (!rangeStr.trim()) {
    const msgEl = document.getElementById('fd-chart-preview-msg');
    if (msgEl) msgEl.textContent = 'Please enter a data range first.';
    return;
  }

  const chartDef = {
    id: `chart_${Date.now()}`,
    type,
    range: rangeStr.trim().toUpperCase(),
    title,
    hasHeaders,
    paletteIdx,
    showLegend,
  };

  S.sheet.charts.push(chartDef);
  _closeChartBuilder();
  _renderChartsPanel();
  _autoSaveSheet();
  _toast(`Chart "${title}" inserted`, 'success');
}

/* ── Charts Panel ─────────────────────────────────────────────────────────── */
function _renderChartsPanel() {
  const row = document.getElementById('fd-charts-row');
  if (!row) return;

  // Destroy all existing Chart.js instances in panel before re-rendering
  _destroyPanelCharts();
  row.innerHTML = '';

  if (!S.sheet.charts.length) {
    row.innerHTML = '<span class="fd-charts-empty">No charts yet — click the chart icon in the toolbar to insert one.</span>';
    return;
  }

  for (const chart of S.sheet.charts) {
    const card = document.createElement('div');
    card.className = 'fd-chart-card';
    card.dataset.chartId = chart.id;
    card.innerHTML = `
      <div class="fd-chart-card-header">
        <div class="fd-chart-card-title">${_e(chart.title)}</div>
        <div class="fd-chart-card-actions">
          <button class="fd-chart-action-btn" title="Download as PNG"
            onclick="_fsExportChart('${chart.id}')">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>
          <button class="fd-chart-action-btn delete" title="Delete chart"
            onclick="_fsDeleteChart('${chart.id}')">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="fd-chart-canvas-wrap">
        <canvas id="fd-chart-canvas-${chart.id}"></canvas>
      </div>
    `;
    row.appendChild(card);
  }

  // Render each chart after DOM is updated
  requestAnimationFrame(() => {
    for (const chart of S.sheet.charts) {
      const canvas = document.getElementById(`fd-chart-canvas-${chart.id}`);
      if (!canvas) continue;
      const chartData = _buildChartData(chart.range, chart.hasHeaders, chart.type, chart.paletteIdx);
      if (!chartData) continue;
      const ctx = canvas.getContext('2d');
      canvas._chartInstance = new Chart(ctx, _buildChartJsConfig(
        chart.type, chartData, chart.title, chart.showLegend
      ));
    }
  });
}

function _destroyPanelCharts() {
  // Destroy all Chart.js instances attached to panel canvases
  document.querySelectorAll('[id^="fd-chart-canvas-"]').forEach(canvas => {
    if (canvas._chartInstance) {
      canvas._chartInstance.destroy();
      canvas._chartInstance = null;
    }
  });
}

/* ── Export chart as image ────────────────────────────────────────────────── */
function _fsExportChart(chartId) {
  const canvas = document.getElementById(`fd-chart-canvas-${chartId}`);
  if (!canvas) return;
  const chart = S.sheet.charts.find(c => c.id === chartId);
  const name = (chart?.title || 'chart').replace(/\s+/g, '_').toLowerCase();
  const link = document.createElement('a');
  link.download = `${name}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
window._fsExportChart = _fsExportChart;

/* ── Delete chart ─────────────────────────────────────────────────────────── */
function _fsDeleteChart(chartId) {
  // Destroy the Chart.js instance first
  const canvas = document.getElementById(`fd-chart-canvas-${chartId}`);
  if (canvas?._chartInstance) {
    canvas._chartInstance.destroy();
    canvas._chartInstance = null;
  }
  S.sheet.charts = S.sheet.charts.filter(c => c.id !== chartId);
  _renderChartsPanel();
  _autoSaveSheet();
}
window._fsDeleteChart = _fsDeleteChart;

/* ══════════════════════════════════════════════════════════════════════════════
   SESSION 5: DOCUMENT ENHANCEMENTS
   "Write the vision and make it plain on tablets." — Habakkuk 2:2
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Template definitions ─────────────────────────────────────────────────── */
const FD_TEMPLATES = [
  {
    key: 'sermon',
    name: 'Sermon Notes',
    preview: `<h1>Sermon Title</h1><p><strong>Scripture:</strong> John 3:16</p><p><strong>Date:</strong> Sunday, May 2026</p><hr><h2>Introduction</h2><p>Opening thought...</p><h2>Main Points</h2><p>1. First point...</p>`,
    content: `<h1>Sermon Title</h1>
<p><strong>Scripture:</strong> [Book Chapter:Verse]</p>
<p><strong>Speaker:</strong> [Name]</p>
<p><strong>Date:</strong> [Date]</p>
<hr>
<h2>Introduction</h2>
<p>Opening hook, illustration, or question that draws the congregation in.</p>
<h2>Main Point 1: [Title]</h2>
<p>Supporting scripture and explanation.</p>
<ul><li>Key insight</li><li>Application</li></ul>
<h2>Main Point 2: [Title]</h2>
<p>Supporting scripture and explanation.</p>
<ul><li>Key insight</li><li>Application</li></ul>
<h2>Main Point 3: [Title]</h2>
<p>Supporting scripture and explanation.</p>
<ul><li>Key insight</li><li>Application</li></ul>
<h2>Conclusion</h2>
<p>Call to action and closing prayer.</p>
<h2>Response</h2>
<p>How can the congregation apply this message this week?</p>`,
  },
  {
    key: 'bulletin',
    name: 'Church Bulletin',
    preview: `<h1>Weekly Bulletin</h1><p style="text-align:center"><strong>Sunday, May 2026</strong></p><hr><h2>Order of Service</h2><p>10:00 AM – Welcome &amp; Announcements</p><p>10:10 AM – Worship</p>`,
    content: `<h1 style="text-align:center">[Church Name]</h1>
<h2 style="text-align:center">Weekly Bulletin</h2>
<p style="text-align:center"><strong>Sunday, [Date]</strong> &middot; [Time] AM</p>
<hr>
<h2>Order of Service</h2>
<table><tbody>
<tr><td><strong>10:00 AM</strong></td><td>Welcome &amp; Announcements</td></tr>
<tr><td><strong>10:10 AM</strong></td><td>Worship &amp; Praise</td></tr>
<tr><td><strong>10:35 AM</strong></td><td>Scripture Reading</td></tr>
<tr><td><strong>10:40 AM</strong></td><td>Message</td></tr>
<tr><td><strong>11:15 AM</strong></td><td>Response &amp; Prayer</td></tr>
<tr><td><strong>11:30 AM</strong></td><td>Benediction</td></tr>
</tbody></table>
<h2>Announcements</h2>
<ul>
<li><strong>[Event Name]</strong> &mdash; [Date], [Time], [Location]</li>
<li><strong>[Event Name]</strong> &mdash; [Date], [Time], [Location]</li>
</ul>
<h2>Prayer Requests</h2>
<ul><li>[Name] &mdash; [Prayer request]</li></ul>
<h2>This Week&rsquo;s Scripture</h2>
<p>[Scripture reference and text]</p>
<h2>Giving</h2>
<p>Thank you for your faithful generosity. You may give online at [website] or in the offering boxes.</p>`,
  },
  {
    key: 'meeting',
    name: 'Meeting Agenda',
    preview: `<h1>Meeting Agenda</h1><p><strong>Date:</strong> May 2026</p><p><strong>Location:</strong> Church Office</p><hr><h2>Agenda Items</h2><p>1. Opening prayer</p>`,
    content: `<h1>Meeting Agenda</h1>
<p><strong>Meeting:</strong> [Name of Meeting]</p>
<p><strong>Date:</strong> [Date]</p>
<p><strong>Time:</strong> [Start Time] &ndash; [End Time]</p>
<p><strong>Location:</strong> [Location]</p>
<p><strong>Facilitator:</strong> [Name]</p>
<hr>
<h2>Attendees</h2>
<ul><li>[Name], [Role]</li><li>[Name], [Role]</li></ul>
<h2>Agenda</h2>
<table><tbody>
<tr><th>Time</th><th>Item</th><th>Lead</th></tr>
<tr><td>5 min</td><td>Opening prayer</td><td>[Name]</td></tr>
<tr><td>10 min</td><td>Review previous minutes</td><td>[Name]</td></tr>
<tr><td>20 min</td><td>[Discussion Topic 1]</td><td>[Name]</td></tr>
<tr><td>20 min</td><td>[Discussion Topic 2]</td><td>[Name]</td></tr>
<tr><td>10 min</td><td>Action items &amp; next steps</td><td>All</td></tr>
<tr><td>5 min</td><td>Closing prayer</td><td>[Name]</td></tr>
</tbody></table>
<h2>Action Items</h2>
<table><tbody>
<tr><th>Item</th><th>Owner</th><th>Due</th></tr>
<tr><td>[Action]</td><td>[Name]</td><td>[Date]</td></tr>
</tbody></table>
<h2>Notes</h2>
<p>[Space for notes during meeting]</p>`,
  },
  {
    key: 'letter',
    name: 'Church Letter',
    preview: `<p>[Church Name]<br>[Address]</p><p>[Date]</p><p>Dear [Recipient],</p><p>We are writing to you regarding...</p>`,
    content: `<p>[Church Name]<br>[Street Address]<br>[City, State, ZIP]<br>[Phone] &middot; [Email]</p>
<p>&nbsp;</p>
<p>[Date]</p>
<p>&nbsp;</p>
<p>[Recipient Name]<br>[Title]<br>[Organization]<br>[Address]</p>
<p>&nbsp;</p>
<p>Dear [Recipient Name],</p>
<p>&nbsp;</p>
<p>We are writing to you regarding [subject]. [Opening paragraph &mdash; state the purpose of the letter clearly and warmly].</p>
<p>[Body paragraph &mdash; provide details, context, or information relevant to the purpose].</p>
<p>[Closing paragraph &mdash; summarize, provide next steps, and express gratitude or encouragement].</p>
<p>&nbsp;</p>
<p>In His service,</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
<p>[Sender Name]<br>[Title]<br>[Church Name]</p>`,
  },
];

/* ── Template Picker ──────────────────────────────────────────────────────── */
function showTemplatePicker() {
  document.getElementById('fd-new-menu')?.classList.add('hidden');

  const grid = document.getElementById('fd-template-grid');
  if (grid && !grid._built) {
    grid._built = true;
    grid.innerHTML = FD_TEMPLATES.map(t => `
      <div class="fd-template-card" data-template="${t.key}">
        <div class="fd-template-preview">${t.preview}</div>
        <div class="fd-template-name">${_e(t.name)}</div>
      </div>
    `).join('');
  }
  document.getElementById('fd-template-overlay')?.classList.remove('hidden');
}

function _applyTemplate(key) {
  const tpl = FD_TEMPLATES.find(t => t.key === key);
  if (!tpl) return;
  document.getElementById('fd-template-overlay')?.classList.add('hidden');

  S.currentDoc = {
    id: null,
    name: tpl.name,
    type: 'document',
    content: tpl.content,
    docHeader: '', docFooter: '', pageLayout: {},
    ownerId: S.user.uid,
    ownerName: S.user.displayName,
    shared: false, folderId: null, deleted: false,
    createdAt: new Date(), updatedAt: new Date(),
  };
  _openEditor();
}

/* ── Insert Image ─────────────────────────────────────────────────────────── */
function _insertImageFromFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    _insertImageDataUrl(ev.target.result, file.name);
  };
  reader.readAsDataURL(file);
  // Reset so same file can be re-selected
  e.target.value = '';
}

function _insertImageDataUrl(dataUrl, altText) {
  const editor = document.getElementById('fd-editor-content');
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0);
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = altText || 'Image';
    range.deleteContents();
    range.insertNode(img);
    range.setStartAfter(img);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    document.execCommand('insertHTML', false, `<img src="${dataUrl}" alt="${_e(altText || 'Image')}">`);
  }
  _autoSave();
}

/* ── Insert Table ─────────────────────────────────────────────────────────── */
const FD_TABLE_MAX = 10;

function _buildTableGrid() {
  const grid = document.getElementById('fd-table-grid');
  if (!grid || grid._built) return;
  grid._built = true;

  let html = '';
  for (let r = 1; r <= FD_TABLE_MAX; r++) {
    for (let c = 1; c <= FD_TABLE_MAX; c++) {
      html += `<button class="fd-table-cell-btn" data-row="${r}" data-col="${c}"></button>`;
    }
  }
  grid.innerHTML = html;

  grid.addEventListener('mouseover', function(e) {
    const btn = e.target.closest('.fd-table-cell-btn');
    if (!btn) return;
    const maxR = parseInt(btn.dataset.row, 10);
    const maxC = parseInt(btn.dataset.col, 10);
    grid.querySelectorAll('.fd-table-cell-btn').forEach(function(b) {
      b.classList.toggle('hovered',
        parseInt(b.dataset.row, 10) <= maxR && parseInt(b.dataset.col, 10) <= maxC);
    });
    const label = document.getElementById('fd-table-grid-label');
    if (label) label.textContent = maxR + ' \u00d7 ' + maxC + ' table';
  });

  grid.addEventListener('mouseleave', function() {
    grid.querySelectorAll('.fd-table-cell-btn').forEach(function(b) { b.classList.remove('hovered'); });
    const label = document.getElementById('fd-table-grid-label');
    if (label) label.textContent = 'Select table size';
  });

  grid.addEventListener('click', function(e) {
    const btn = e.target.closest('.fd-table-cell-btn');
    if (!btn) return;
    _insertTable(parseInt(btn.dataset.row, 10), parseInt(btn.dataset.col, 10));
    document.getElementById('fd-table-popup')?.classList.add('hidden');
  });
}

function _insertTable(rows, cols) {
  const editor = document.getElementById('fd-editor-content');
  if (!editor) return;
  editor.focus();

  let html = '<table><tbody>';
  // header row
  html += '<tr>' + Array.from({ length: cols }, function() { return '<th><br></th>'; }).join('') + '</tr>';
  // data rows
  for (let r = 1; r < rows; r++) {
    html += '<tr>' + Array.from({ length: cols }, function() { return '<td><br></td>'; }).join('') + '</tr>';
  }
  html += '</tbody></table><p><br></p>';

  document.execCommand('insertHTML', false, html);
  _autoSave();
}

/* ── Insert Page Break ────────────────────────────────────────────────────── */
function _insertPageBreak() {
  document.execCommand('insertHTML', false, '<hr class="fd-page-break"><p><br></p>');
  _autoSave();
}

/* ── Page Layout ──────────────────────────────────────────────────────────── */
function _applyPageMargin(margin) {
  const page = document.getElementById('fd-editor-page');
  if (!page) return;
  ['layout-margins-narrow','layout-margins-normal','layout-margins-wide'].forEach(function(c) { page.classList.remove(c); });
  page.classList.add('layout-margins-' + margin);
  document.querySelectorAll('[data-margin]').forEach(function(b) {
    b.classList.toggle('is-active', b.dataset.margin === margin);
  });
  if (!S.currentDoc) return;
  S.currentDoc.pageLayout = S.currentDoc.pageLayout || {};
  S.currentDoc.pageLayout.margin = margin;
  _autoSave();
}

function _applyPageOrientation(orient) {
  const page = document.getElementById('fd-editor-page');
  if (!page) return;
  page.classList.toggle('layout-orient-landscape', orient === 'landscape');
  document.querySelectorAll('[data-orient]').forEach(function(b) {
    b.classList.toggle('is-active', b.dataset.orient === orient);
  });
  if (!S.currentDoc) return;
  S.currentDoc.pageLayout = S.currentDoc.pageLayout || {};
  S.currentDoc.pageLayout.orient = orient;
  _autoSave();
}

function _applyStoredPageLayout() {
  const layout = (S.currentDoc && S.currentDoc.pageLayout) || {};
  const page = document.getElementById('fd-editor-page');
  if (!page) return;
  ['narrow','normal','wide'].forEach(function(m) { page.classList.remove('layout-margins-' + m); });
  page.classList.add('layout-margins-' + (layout.margin || 'normal'));
  document.querySelectorAll('[data-margin]').forEach(function(b) {
    b.classList.toggle('is-active', b.dataset.margin === (layout.margin || 'normal'));
  });
  page.classList.toggle('layout-orient-landscape', layout.orient === 'landscape');
  document.querySelectorAll('[data-orient]').forEach(function(b) {
    b.classList.toggle('is-active', b.dataset.orient === (layout.orient || 'portrait'));
  });
}

/* ── Print ────────────────────────────────────────────────────────────────── */
function _printDocument() {
  if (S.currentDoc) {
    const editor = document.getElementById('fd-editor-content');
    if (editor) S.currentDoc.content = editor.innerHTML;
  }
  window.print();
}

/* ══════════════════════════════════════════════════════════════════════════════
   SESSION 6: COLLABORATION & SHARING
   "Two are better than one, because they have a good return for their labor."
   — Ecclesiastes 4:9
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Constants ───────────────────────────────────────────────────────────── */
const COLLECTION_COMMENTS = 'flockDocComments';
const COLLECTION_VERSIONS = 'flockDocVersions';
const COLLECTION_PRESENCE = 'flockDocPresence';
const VERSION_MIN_INTERVAL = 60 * 1000; // 1 minute between auto-versions

/* ── Avatar colour palette ───────────────────────────────────────────────── */
const AVATAR_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#ec4899','#14b8a6','#f97316',
];
function _avatarColor(uid) {
  var h = 0;
  for (var i = 0; i < (uid || '').length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function _initials(name) {
  var parts = (name || 'U').trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

/* ══════════════════════════════════════════════════════════════════════════════
   REAL-TIME SYNC
   ══════════════════════════════════════════════════════════════════════════════ */

function _startRealtimeSync() {
  if (!S.currentDoc || !S.currentDoc.id) return;
  _stopRealtimeSync();
  if (!_checkFirebase()) return;

  var db = firebase.firestore();
  var docRef = db.collection(COLLECTION_DOCS).doc(S.currentDoc.id);
  var myLastSave = Date.now();

  S.collab.realtimeUnsub = docRef.onSnapshot(function(snapshot) {
    if (!snapshot.exists || !S.currentDoc) return;
    var data = snapshot.data();

    // Ignore changes triggered by our own save (within 2 seconds)
    var updatedAt = data.updatedAt && typeof data.updatedAt.toMillis === 'function'
      ? data.updatedAt.toMillis() : 0;
    var isOursave = (updatedAt - myLastSave) < 2500 || data.updatedBy === S.user.uid;

    // Update realtime indicator
    var dot = document.getElementById('fd-realtime-dot');
    if (dot) {
      dot.style.background = '#16a34a';
    }

    if (!isOursave && data.content !== undefined) {
      // Another user has edited — update editor if not actively typing
      var editor = document.getElementById('fd-editor-content');
      if (editor && document.activeElement !== editor) {
        editor.innerHTML = data.content;
        _toast('Document updated by ' + (data.updatedByName || 'someone else'), 'info', 2500);
      }
    }
    myLastSave = Date.now();
  }, function(err) {
    console.warn('[FlockDocs] Realtime sync error:', err);
  });
}

function _stopRealtimeSync() {
  if (S.collab.realtimeUnsub) {
    S.collab.realtimeUnsub();
    S.collab.realtimeUnsub = null;
  }
  var bar = document.getElementById('fd-presence-bar');
  if (bar) bar.innerHTML = '';
}

/* ══════════════════════════════════════════════════════════════════════════════
   PRESENCE
   ══════════════════════════════════════════════════════════════════════════════ */

function _startPresence() {
  if (!S.currentDoc || !S.currentDoc.id || !S.user) return;
  _stopPresence();
  if (!_checkFirebase()) return;

  var db = firebase.firestore();
  var presenceId = S.currentDoc.id + '_' + S.user.uid;
  var ref = db.collection(COLLECTION_PRESENCE).doc(presenceId);
  S.collab.presenceDocRef = ref;

  // Write our presence
  ref.set({
    docId: S.currentDoc.id,
    uid: S.user.uid,
    displayName: S.user.displayName || 'Anonymous',
    initials: _initials(S.user.displayName || S.user.email),
    color: _avatarColor(S.user.uid),
    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(function(e) { console.warn('[FlockDocs] Presence write error:', e); });

  // Heartbeat every 20 seconds
  S.collab._presenceHeartbeat = setInterval(function() {
    ref.update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() })
      .catch(function() {});
  }, 20000);

  // Listen to all presence for this doc (within the last 90 seconds)
  S.collab.presenceUnsub = db.collection(COLLECTION_PRESENCE)
    .where('docId', '==', S.currentDoc.id)
    .onSnapshot(function(snapshot) {
      var now = Date.now();
      var active = snapshot.docs
        .map(function(d) { return d.data(); })
        .filter(function(p) {
          var ms = p.lastSeen && p.lastSeen.toMillis ? p.lastSeen.toMillis() : 0;
          return (now - ms) < 90000;
        });
      _renderPresence(active);
    }, function(err) { console.warn('[FlockDocs] Presence error:', err); });
}

function _stopPresence() {
  clearInterval(S.collab._presenceHeartbeat);
  S.collab._presenceHeartbeat = null;
  if (S.collab.presenceDocRef) {
    S.collab.presenceDocRef.delete().catch(function() {});
    S.collab.presenceDocRef = null;
  }
  if (S.collab.presenceUnsub) {
    S.collab.presenceUnsub();
    S.collab.presenceUnsub = null;
  }
}

function _renderPresence(people) {
  var bar = document.getElementById('fd-presence-bar');
  if (!bar) return;
  // Show others (not ourselves)
  var others = people.filter(function(p) { return p.uid !== S.user.uid; });
  if (others.length === 0) {
    bar.innerHTML = '<span class="fd-realtime-dot" id="fd-realtime-dot"></span><span class="fd-realtime-label">Live</span>';
    return;
  }
  var avatars = others.map(function(p) {
    return '<span class="fd-presence-avatar" style="background:' + p.color + '" title="' + _e(p.displayName) + ' is editing">' + _e(p.initials) + '</span>';
  }).join('');
  bar.innerHTML = '<span class="fd-presence-label">Also editing:</span><span class="fd-presence-avatars">' + avatars + '</span>'
    + '<span class="fd-realtime-dot" id="fd-realtime-dot"></span><span class="fd-realtime-label">Live</span>';
}

/* ══════════════════════════════════════════════════════════════════════════════
   COLLAB PANEL
   ══════════════════════════════════════════════════════════════════════════════ */

function _toggleCollabPanel(tab) {
  var panel = document.getElementById('fd-collab-panel');
  if (!panel) return;
  var isOpen = panel.classList.contains('is-open');
  if (!isOpen) {
    panel.classList.add('is-open');
    _switchCollabTab(tab || S.collab.activeTab || 'comments');
  } else if (S.collab.activeTab === tab) {
    // Clicking the same tab button closes the panel
    panel.classList.remove('is-open');
  } else {
    _switchCollabTab(tab);
  }
}

function _switchCollabTab(tab) {
  S.collab.activeTab = tab;
  document.querySelectorAll('.fd-collab-tab').forEach(function(btn) {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.fd-collab-tab-content').forEach(function(el) {
    el.classList.toggle('is-active', el.id === 'fd-tab-content-' + tab);
  });
  if (tab === 'history') _loadVersionHistory();
  if (tab === 'comments') _loadComments();
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMMENTS
   ══════════════════════════════════════════════════════════════════════════════ */

async function _loadComments() {
  if (!S.currentDoc || !S.currentDoc.id) return;
  if (!_checkFirebase()) return;
  try {
    var db = firebase.firestore();
    var snapshot = await db.collection(COLLECTION_COMMENTS)
      .where('docId', '==', S.currentDoc.id)
      .orderBy('createdAt', 'asc')
      .get();
    S.collab.comments = snapshot.docs.map(function(d) {
      return Object.assign({ id: d.id }, d.data());
    });
    _renderComments();
  } catch (err) {
    console.error('[FlockDocs] Error loading comments:', err);
  }
}

function _renderComments() {
  var list = document.getElementById('fd-comments-list');
  if (!list) return;
  if (S.collab.comments.length === 0) {
    list.innerHTML = '<div style="padding:24px;text-align:center;font:500 0.875rem var(--font-ui);color:var(--ink-muted)">No comments yet.<br>Add the first one below.</div>';
    return;
  }
  list.innerHTML = S.collab.comments.map(function(c) {
    var color = _avatarColor(c.authorId);
    var initials = c.authorInitials || _initials(c.authorName || 'U');
    var time = _formatDate(c.createdAt);
    var resolvedClass = c.resolved ? ' resolved' : '';
    var resolveLabel = c.resolved ? 'Resolved' : 'Resolve';
    return '<div class="fd-comment-item' + resolvedClass + '" id="fd-comment-' + c.id + '">'
      + '<div class="fd-comment-header">'
      + '<div class="fd-comment-avatar" style="background:' + color + '">' + _e(initials) + '</div>'
      + '<div class="fd-comment-meta">'
      + '<div class="fd-comment-author">' + _e(c.authorName || 'Unknown') + '</div>'
      + '<div class="fd-comment-time">' + time + '</div>'
      + '</div></div>'
      + '<div class="fd-comment-text">' + _e(c.text) + '</div>'
      + '<div class="fd-comment-actions">'
      + (c.resolved ? '' : '<button class="fd-comment-action-btn" onclick="_resolveComment(\'' + c.id + '\')">' + resolveLabel + '</button>')
      + (c.authorId === (S.user && S.user.uid) ? '<button class="fd-comment-action-btn" onclick="_deleteComment(\'' + c.id + '\')" style="color:var(--ink-muted)">Delete</button>' : '')
      + '</div></div>';
  }).join('');
}

async function _addComment() {
  var textarea = document.getElementById('fd-comment-textarea');
  var text = textarea ? textarea.value.trim() : '';
  if (!text || !S.currentDoc || !S.currentDoc.id) return;
  if (!_checkFirebase()) return;
  try {
    var db = firebase.firestore();
    await db.collection(COLLECTION_COMMENTS).add({
      docId: S.currentDoc.id,
      text: text,
      authorId: S.user.uid,
      authorName: S.user.displayName || 'Anonymous',
      authorInitials: _initials(S.user.displayName || S.user.email),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      resolved: false,
    });
    if (textarea) textarea.value = '';
    _loadComments();
    _toast('Comment added', 'success');
  } catch (err) {
    console.error('[FlockDocs] Error adding comment:', err);
    _toast('Failed to add comment', 'error');
  }
}

async function _resolveComment(commentId) {
  if (!_checkFirebase()) return;
  try {
    var db = firebase.firestore();
    await db.collection(COLLECTION_COMMENTS).doc(commentId).update({ resolved: true });
    _loadComments();
  } catch (err) {
    _toast('Failed to resolve comment', 'error');
  }
}

async function _deleteComment(commentId) {
  if (!_checkFirebase()) return;
  try {
    var db = firebase.firestore();
    await db.collection(COLLECTION_COMMENTS).doc(commentId).delete();
    _loadComments();
  } catch (err) {
    _toast('Failed to delete comment', 'error');
  }
}
window._resolveComment = _resolveComment;
window._deleteComment = _deleteComment;

/* ══════════════════════════════════════════════════════════════════════════════
   VERSION HISTORY
   ══════════════════════════════════════════════════════════════════════════════ */

async function _saveVersion() {
  if (!S.currentDoc || !S.currentDoc.id) return;
  if (!_checkFirebase()) return;

  var now = Date.now();
  if (now - S.collab.lastSaveVersion < VERSION_MIN_INTERVAL) return;
  S.collab.lastSaveVersion = now;

  try {
    var db = firebase.firestore();
    await db.collection(COLLECTION_VERSIONS).add({
      docId: S.currentDoc.id,
      name: S.currentDoc.name,
      content: S.currentDoc.content,
      docHeader: S.currentDoc.docHeader || '',
      docFooter: S.currentDoc.docFooter || '',
      pageLayout: JSON.stringify(S.currentDoc.pageLayout || {}),
      savedAt: firebase.firestore.FieldValue.serverTimestamp(),
      savedBy: S.user.uid,
      savedByName: S.user.displayName || 'Anonymous',
    });
    // Refresh history list if panel is open on history tab
    if (document.getElementById('fd-collab-panel')?.classList.contains('is-open')
        && S.collab.activeTab === 'history') {
      _loadVersionHistory();
    }
  } catch (err) {
    console.warn('[FlockDocs] Version save error:', err);
  }
}

async function _loadVersionHistory() {
  var list = document.getElementById('fd-history-list');
  if (!S.currentDoc || !S.currentDoc.id) {
    if (list) list.innerHTML = '<div class="fd-history-empty">Open a saved document to view its version history.</div>';
    return;
  }
  if (!_checkFirebase()) return;
  if (list) list.innerHTML = '<div class="fd-history-empty">Loading history…</div>';
  try {
    var db = firebase.firestore();
    var snapshot = await db.collection(COLLECTION_VERSIONS)
      .where('docId', '==', S.currentDoc.id)
      .orderBy('savedAt', 'desc')
      .limit(50)
      .get();
    S.collab.versions = snapshot.docs.map(function(d) {
      return Object.assign({ id: d.id }, d.data());
    });
    _renderVersionHistory();
  } catch (err) {
    console.error('[FlockDocs] Error loading version history:', err);
    if (list) list.innerHTML = '<div class="fd-history-empty">Could not load history.</div>';
  }
}

function _renderVersionHistory() {
  var list = document.getElementById('fd-history-list');
  if (!list) return;
  if (S.collab.versions.length === 0) {
    list.innerHTML = '<div class="fd-history-empty">No version history yet.<br>Versions are saved automatically as you edit.</div>';
    return;
  }
  list.innerHTML = S.collab.versions.map(function(v) {
    var time = _formatDate(v.savedAt);
    var histSvg = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    return '<div class="fd-history-item" id="fd-version-' + v.id + '">'
      + '<div class="fd-history-icon">' + histSvg + '</div>'
      + '<div class="fd-history-meta">'
      + '<div class="fd-history-author">' + _e(v.savedByName || 'Unknown') + '</div>'
      + '<div class="fd-history-time">' + time + '</div>'
      + '<button class="fd-history-restore-btn" onclick="_previewVersion(\'' + v.id + '\')">Preview &amp; Restore</button>'
      + '</div></div>';
  }).join('');
}

function _previewVersion(versionId) {
  var version = S.collab.versions.find(function(v) { return v.id === versionId; });
  if (!version) return;
  S.collab.pendingVersion = version;

  var title = document.getElementById('fd-version-preview-title');
  var doc = document.getElementById('fd-version-preview-doc');
  var overlay = document.getElementById('fd-version-preview-overlay');

  if (title) title.textContent = 'Version by ' + (version.savedByName || 'Unknown') + ' \u2014 ' + _formatDate(version.savedAt);
  if (doc) doc.innerHTML = version.content;
  if (overlay) overlay.classList.remove('hidden');
}

function _closeVersionPreview() {
  S.collab.pendingVersion = null;
  document.getElementById('fd-version-preview-overlay')?.classList.add('hidden');
}

function _restoreVersion() {
  var version = S.collab.pendingVersion;
  if (!version) return;

  var editor = document.getElementById('fd-editor-content');
  if (editor) editor.innerHTML = version.content;

  var headerEl = document.getElementById('fd-doc-header');
  var footerEl = document.getElementById('fd-doc-footer');
  if (headerEl) headerEl.innerHTML = version.docHeader || '';
  if (footerEl) footerEl.innerHTML = version.docFooter || '';

  _closeVersionPreview();
  _toast('Version restored \u2014 save to keep it', 'success');
  _autoSave();
}
window._previewVersion = _previewVersion;

/* ══════════════════════════════════════════════════════════════════════════════
   SHARE DIALOG
   ══════════════════════════════════════════════════════════════════════════════ */

function showShareDialog() {
  if (!S.currentDoc) {
    _toast('Please open a document first', 'warning');
    return;
  }
  // Populate current share state
  var sharedWith = Array.isArray(S.currentDoc.sharedWith) ? S.currentDoc.sharedWith : [];
  S.collab.sharedWith = sharedWith.map(function(u) { return Object.assign({}, u); });

  var churchToggle = document.getElementById('fd-share-church-toggle');
  var churchPermRow = document.getElementById('fd-share-church-perm-row');
  var churchPerm = document.getElementById('fd-share-church-perm');

  if (churchToggle) churchToggle.checked = !!S.currentDoc.shared;
  if (churchPermRow) churchPermRow.style.display = S.currentDoc.shared ? 'flex' : 'none';
  if (churchPerm) churchPerm.value = S.currentDoc.churchPermission || 'view';

  _renderSharedUsersList();
  document.getElementById('fd-share-overlay')?.classList.remove('hidden');
  document.getElementById('fd-share-email-input')?.focus();
}

function _closeShareDialog() {
  document.getElementById('fd-share-overlay')?.classList.add('hidden');
}

function _renderSharedUsersList() {
  var container = document.getElementById('fd-shared-users-list');
  if (!container) return;
  if (S.collab.sharedWith.length === 0) {
    container.innerHTML = '<div style="font:400 0.813rem var(--font-ui);color:var(--ink-muted);padding:8px 0">No specific users added yet.</div>';
    return;
  }
  container.innerHTML = S.collab.sharedWith.map(function(u, idx) {
    var color = _avatarColor(u.uid || u.email);
    var initials = _initials(u.name || u.email);
    return '<div class="fd-shared-user-item">'
      + '<div class="fd-shared-user-avatar" style="background:' + color + '">' + _e(initials) + '</div>'
      + '<div class="fd-shared-user-info">'
      + '<div class="fd-shared-user-name">' + _e(u.name || u.email) + '</div>'
      + '<div class="fd-shared-user-email">' + _e(u.email) + '</div>'
      + '</div>'
      + '<span class="fd-shared-user-perm">' + _e(u.permission || 'view') + '</span>'
      + '<button class="fd-shared-user-remove" onclick="_removeSharedUser(' + idx + ')" aria-label="Remove">'
      + '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '</button>'
      + '</div>';
  }).join('');
}

function _addSharedUser() {
  var emailInput = document.getElementById('fd-share-email-input');
  var permSelect = document.getElementById('fd-share-user-perm');
  var email = emailInput ? emailInput.value.trim().toLowerCase() : '';
  var perm = permSelect ? permSelect.value : 'view';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    _toast('Please enter a valid email address', 'warning');
    return;
  }
  // Prevent duplicates
  if (S.collab.sharedWith.find(function(u) { return u.email === email; })) {
    _toast('This person is already in the list', 'warning');
    return;
  }
  S.collab.sharedWith.push({ email: email, name: email, permission: perm });
  if (emailInput) emailInput.value = '';
  _renderSharedUsersList();
}

function _removeSharedUser(idx) {
  S.collab.sharedWith.splice(idx, 1);
  _renderSharedUsersList();
}
window._removeSharedUser = _removeSharedUser;

async function _saveShareSettings() {
  if (!S.currentDoc || !_checkFirebase()) return;
  var churchToggle = document.getElementById('fd-share-church-toggle');
  var churchPerm = document.getElementById('fd-share-church-perm');

  var shared = churchToggle ? churchToggle.checked : false;
  var churchPermission = churchPerm ? churchPerm.value : 'view';

  try {
    var db = firebase.firestore();
    var update = {
      shared: shared,
      churchPermission: churchPermission,
      sharedWith: S.collab.sharedWith,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (S.currentDoc.id) {
      await db.collection(COLLECTION_DOCS).doc(S.currentDoc.id).update(update);
      Object.assign(S.currentDoc, update);
      _closeShareDialog();
      _toast('Sharing settings saved', 'success');
    } else {
      // Doc not saved yet - apply to in-memory state only
      Object.assign(S.currentDoc, update);
      _closeShareDialog();
      _toast('Sharing settings will be saved with the document', 'info');
    }
  } catch (err) {
    console.error('[FlockDocs] Error saving share settings:', err);
    _toast('Failed to save sharing settings', 'error');
  }
}

function _copyShareLink() {
  var url = window.location.href.split('?')[0];
  if (S.currentDoc && S.currentDoc.id) {
    url += '?doc=' + S.currentDoc.id;
  }
  navigator.clipboard.writeText(url).then(function() {
    _toast('Link copied to clipboard', 'success');
  }).catch(function() {
    // Fallback for non-HTTPS
    try {
      var ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      _toast('Link copied to clipboard', 'success');
    } catch (_) {
      _toast('Could not copy link automatically', 'warning');
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   SESSION 7: IMPORT / EXPORT
   "Whatever you do, work at it with all your heart, as working for the Lord"
   — Colossians 3:23
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Utilities ───────────────────────────────────────────────────────────── */

function _triggerDownload(content, filename, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
}

function _triggerBinaryDownload(arrayBuffer, filename) {
  var blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
}

function _safeDocName() {
  return (S.currentDoc && S.currentDoc.name || 'Untitled')
    .replace(/[<>:"/\\|?*]/g, '-').trim() || 'Untitled';
}

/* ══════════════════════════════════════════════════════════════════════════════
   WRITER — EXPORT
   ══════════════════════════════════════════════════════════════════════════════ */

function _exportDocAsHtml() {
  if (!S.currentDoc) {
    _toast('Please open a document first', 'warning');
    return;
  }
  var editor = document.getElementById('fd-editor-content');
  if (!editor) return;
  var docName = _safeDocName();
  var header = document.getElementById('fd-doc-header')?.innerHTML || '';
  var footer = document.getElementById('fd-doc-footer')?.innerHTML || '';

  var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
    + '<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>' + _e(docName) + '</title>\n'
    + '<style>\n'
    + '  body { font: 400 14px/1.6 Georgia, serif; color: #1f2937; max-width: 816px; margin: 0 auto; padding: 40px 96px; }\n'
    + '  h1 { font-size: 2rem; margin: 0 0 16px; }\n'
    + '  h2 { font-size: 1.5rem; margin: 24px 0 12px; }\n'
    + '  h3 { font-size: 1.25rem; margin: 20px 0 10px; }\n'
    + '  table { border-collapse: collapse; width: 100%; margin: 16px 0; }\n'
    + '  td, th { border: 1px solid #d1d5db; padding: 8px 12px; vertical-align: top; }\n'
    + '  th { background: #f9fafb; font-weight: 700; }\n'
    + '  img { max-width: 100%; height: auto; display: block; margin: 8px 0; }\n'
    + '  hr.fd-page-break { border: none; border-top: 2px dashed #d1d5db; margin: 32px 0; }\n'
    + '  .fd-doc-header { border-bottom: 1px solid #e5e7eb; margin-bottom: 24px; padding-bottom: 8px; font-size: 12px; color: #6b7280; }\n'
    + '  .fd-doc-footer { border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 8px; font-size: 12px; color: #6b7280; }\n'
    + '</style>\n</head>\n<body>\n';

  if (header) {
    html += '<div class="fd-doc-header">' + header + '</div>\n';
  }
  html += editor.innerHTML + '\n';
  if (footer) {
    html += '<div class="fd-doc-footer">' + footer + '</div>\n';
  }
  html += '</body>\n</html>';

  _triggerDownload(html, docName + '.html', 'text/html;charset=utf-8');
  _toast('Document downloaded as HTML', 'success');
}

function _exportDocAsPdf() {
  if (!S.currentDoc) {
    _toast('Please open a document first', 'warning');
    return;
  }
  _toast('Opening print dialog — choose "Save as PDF" in your browser', 'info', 4000);
  setTimeout(function() { window.print(); }, 500);
}

function _exportDocAsText() {
  if (!S.currentDoc) {
    _toast('Please open a document first', 'warning');
    return;
  }
  var editor = document.getElementById('fd-editor-content');
  if (!editor) return;

  // Extract plain text preserving some structure
  var clone = editor.cloneNode(true);
  // Replace block elements with newlines
  clone.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, tr, br').forEach(function(el) {
    el.insertAdjacentText('afterend', '\n');
  });
  var text = clone.textContent.replace(/\n{3,}/g, '\n\n').trim();

  _triggerDownload(text, _safeDocName() + '.txt', 'text/plain;charset=utf-8');
  _toast('Document downloaded as plain text', 'success');
}

function _emailDocument() {
  if (!S.currentDoc) {
    _toast('Please open a document first', 'warning');
    return;
  }
  var editor = document.getElementById('fd-editor-content');
  if (!editor) return;

  var docName = _safeDocName();

  // Build plain text excerpt for email body
  var clone = editor.cloneNode(true);
  clone.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, br').forEach(function(el) {
    el.insertAdjacentText('afterend', '\n');
  });
  var bodyText = clone.textContent.replace(/\n{3,}/g, '\n\n').trim();
  var subject = encodeURIComponent(docName);
  var bodyEncoded = encodeURIComponent(
    bodyText.substring(0, 1800) + (bodyText.length > 1800 ? '\n\n[...document continues]' : '')
  );

  window.location.href = 'mailto:?subject=' + subject + '&body=' + bodyEncoded;
  _toast('Opening your email client…', 'info');
}

/* ══════════════════════════════════════════════════════════════════════════════
   WRITER — IMPORT DOCX
   ══════════════════════════════════════════════════════════════════════════════ */

async function _importDocx(file) {
  if (!window.mammoth) {
    _toast('DOCX import library is loading, please try again in a moment', 'warning');
    return;
  }
  if (!S.currentDoc) {
    _toast('Please open or create a document first', 'warning');
    return;
  }

  // Show loading banner
  var presenceBar = document.getElementById('fd-presence-bar');
  var banner = null;
  if (presenceBar) {
    banner = document.createElement('div');
    banner.className = 'fd-import-banner';
    banner.innerHTML = '<div class="fd-import-spinner"></div><span>Importing ' + _e(file.name) + '…</span>';
    presenceBar.parentNode.insertBefore(banner, presenceBar.nextSibling);
  }

  try {
    var arrayBuffer = await file.arrayBuffer();
    var result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });

    if (result.messages && result.messages.length > 0) {
      console.info('[FlockDocs] DOCX import messages:', result.messages);
    }

    var editor = document.getElementById('fd-editor-content');
    if (!editor) return;

    // Confirm if editor has content
    var hasContent = editor.textContent.trim().length > 0
      && editor.textContent.trim() !== 'Start typing...';
    if (hasContent) {
      if (!confirm('Replace the current document content with the imported DOCX?\n\nThis will overwrite what is already in the editor.')) {
        return;
      }
    }

    editor.innerHTML = result.value;

    // Update doc name from filename
    var importedName = file.name.replace(/\.docx$/i, '').trim();
    if (importedName) {
      S.currentDoc.name = importedName;
      var docNameInput = document.getElementById('fd-doc-name-input');
      if (docNameInput) docNameInput.value = importedName;
    }

    _autoSave();
    _toast('DOCX imported successfully', 'success');
  } catch (err) {
    console.error('[FlockDocs] DOCX import error:', err);
    _toast('Failed to import DOCX: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    if (banner) banner.remove();
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   SPREADSHEET — EXPORT CSV
   ══════════════════════════════════════════════════════════════════════════════ */

function _exportSheetAsCsv() {
  if (!S.currentDoc || S.currentDoc.type !== 'spreadsheet') {
    _toast('Please open a spreadsheet first', 'warning');
    return;
  }

  var data = S.sheet.data;
  var rows = S.sheet.rows;
  var cols = S.sheet.cols;
  var csvRows = [];

  for (var r = 1; r <= rows; r++) {
    var rowData = [];
    for (var c = 0; c < cols; c++) {
      var col = String.fromCharCode(65 + c);
      var ref = col + r;
      var cell = data[ref];
      var val = cell ? (cell.v !== undefined ? cell.v : '') : '';
      // Quote if needed
      var str = String(val);
      if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }
      rowData.push(str);
    }
    // Trim trailing empty cells
    while (rowData.length > 0 && rowData[rowData.length - 1] === '') {
      rowData.pop();
    }
    if (rowData.length > 0) {
      csvRows.push(rowData.join(','));
    } else if (csvRows.length > 0) {
      // Keep blank row if not at end
      csvRows.push('');
    }
  }

  // Trim trailing empty rows
  while (csvRows.length > 0 && csvRows[csvRows.length - 1] === '') {
    csvRows.pop();
  }

  var csv = csvRows.join('\r\n');
  _triggerDownload(csv, _safeDocName() + '.csv', 'text/csv;charset=utf-8');
  _toast('Spreadsheet exported as CSV', 'success');
}

/* ══════════════════════════════════════════════════════════════════════════════
   SPREADSHEET — EXPORT XLSX
   ══════════════════════════════════════════════════════════════════════════════ */

function _exportSheetAsXlsx() {
  if (!S.currentDoc || S.currentDoc.type !== 'spreadsheet') {
    _toast('Please open a spreadsheet first', 'warning');
    return;
  }
  if (!window.XLSX) {
    _toast('Excel export library is loading, please try again in a moment', 'warning');
    return;
  }

  var data = S.sheet.data;
  var rows = S.sheet.rows;
  var cols = S.sheet.cols;

  // Build a 2-D array of raw values
  var matrix = [];
  var lastNonEmptyRow = 0;
  for (var r = 1; r <= rows; r++) {
    var rowArr = [];
    var hasValue = false;
    for (var c = 0; c < cols; c++) {
      var col = String.fromCharCode(65 + c);
      var ref = col + r;
      var cell = data[ref];
      var val = cell ? (cell.v !== undefined ? cell.v : '') : '';
      // Try numeric conversion
      if (val !== '' && !isNaN(Number(val))) val = Number(val);
      rowArr.push(val);
      if (val !== '') hasValue = true;
    }
    if (hasValue) lastNonEmptyRow = r;
    matrix.push(rowArr);
  }
  // Trim trailing empty rows
  matrix = matrix.slice(0, lastNonEmptyRow);
  // Trim trailing empty columns per row
  var maxCols = 0;
  matrix.forEach(function(row) {
    var last = row.length;
    while (last > 0 && (row[last - 1] === '' || row[last - 1] === undefined)) last--;
    if (last > maxCols) maxCols = last;
  });
  matrix = matrix.map(function(row) { return row.slice(0, maxCols); });

  try {
    var ws = XLSX.utils.aoa_to_sheet(matrix);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, _safeDocName().substring(0, 31));
    var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    _triggerBinaryDownload(wbout, _safeDocName() + '.xlsx');
    _toast('Spreadsheet exported as Excel (.xlsx)', 'success');
  } catch (err) {
    console.error('[FlockDocs] XLSX export error:', err);
    _toast('Failed to export Excel file', 'error');
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   SPREADSHEET — IMPORT CSV
   ══════════════════════════════════════════════════════════════════════════════ */

async function _importSheetCsv(file) {
  if (!S.currentDoc || S.currentDoc.type !== 'spreadsheet') {
    _toast('Please open a spreadsheet first', 'warning');
    return;
  }

  try {
    var text = await file.text();
    var parsed = _parseCsvText(text);
    _importMatrixIntoSheet(parsed, file.name.replace(/\.csv$/i, ''));
    _toast('CSV imported successfully', 'success');
  } catch (err) {
    console.error('[FlockDocs] CSV import error:', err);
    _toast('Failed to import CSV: ' + (err.message || 'Unknown error'), 'error');
  }
}

function _parseCsvText(text) {
  // RFC 4180-compatible CSV parser
  var rows = [];
  var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  var i = 0;
  var n = lines.length;

  while (i < n) {
    var row = [];
    while (i < n && lines[i] !== '\n') {
      var cell = '';
      if (lines[i] === '"') {
        // Quoted cell
        i++;
        while (i < n) {
          if (lines[i] === '"' && lines[i + 1] === '"') {
            cell += '"'; i += 2;
          } else if (lines[i] === '"') {
            i++; break;
          } else {
            cell += lines[i++];
          }
        }
        // Skip comma or newline after closing quote
        if (lines[i] === ',') i++;
      } else {
        // Unquoted cell — read until comma or newline
        while (i < n && lines[i] !== ',' && lines[i] !== '\n') {
          cell += lines[i++];
        }
        if (lines[i] === ',') i++;
      }
      row.push(cell);
    }
    if (lines[i] === '\n') i++;
    rows.push(row);
  }
  // Remove trailing empty rows
  while (rows.length > 0 && rows[rows.length - 1].every(function(c) { return c === ''; })) {
    rows.pop();
  }
  return rows;
}

/* ══════════════════════════════════════════════════════════════════════════════
   SPREADSHEET — IMPORT XLSX
   ══════════════════════════════════════════════════════════════════════════════ */

async function _importSheetXlsx(file) {
  if (!S.currentDoc || S.currentDoc.type !== 'spreadsheet') {
    _toast('Please open a spreadsheet first', 'warning');
    return;
  }
  if (!window.XLSX) {
    _toast('Excel import library is loading, please try again in a moment', 'warning');
    return;
  }

  try {
    var arrayBuffer = await file.arrayBuffer();
    var wb = XLSX.read(arrayBuffer, { type: 'array' });
    // Import the first sheet
    var wsName = wb.SheetNames[0];
    var ws = wb.Sheets[wsName];
    var matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    _importMatrixIntoSheet(matrix, file.name.replace(/\.(xlsx|xls)$/i, ''));
    _toast('Excel file imported successfully', 'success');
  } catch (err) {
    console.error('[FlockDocs] XLSX import error:', err);
    _toast('Failed to import Excel file: ' + (err.message || 'Unknown error'), 'error');
  }
}

/* ── Shared: load a 2-D matrix into the active spreadsheet ───────────────── */

function _importMatrixIntoSheet(matrix, nameHint) {
  if (!matrix || matrix.length === 0) {
    _toast('The file appears to be empty', 'warning');
    return;
  }

  var confirm_replace = true;
  var hasData = Object.keys(S.sheet.data).some(function(k) { return S.sheet.data[k] && S.sheet.data[k].v !== ''; });
  if (hasData) {
    confirm_replace = confirm('Replace the current spreadsheet data with the imported data?\n\nThis will overwrite all existing cells.');
    if (!confirm_replace) return;
  }

  // Clear existing data
  S.sheet.data = {};

  var rows = Math.min(matrix.length, S.sheet.rows);
  var cols = S.sheet.cols;

  for (var r = 0; r < rows; r++) {
    var row = matrix[r];
    if (!row) continue;
    var colCount = Math.min(row.length, cols);
    for (var c = 0; c < colCount; c++) {
      var val = row[c];
      if (val === null || val === undefined) val = '';
      var str = String(val);
      if (str !== '') {
        var colLetter = String.fromCharCode(65 + c);
        var ref = colLetter + (r + 1);
        S.sheet.data[ref] = { v: str, f: '', s: {} };
      }
    }
  }

  // Update spreadsheet name if we have a hint
  if (nameHint) {
    S.currentDoc.name = nameHint;
    var nameInput = document.getElementById('fd-sheet-name');
    if (nameInput) nameInput.value = nameHint;
  }

  // Re-render grid and save
  _renderGrid();
  _autoSaveSheet();
}

/* ══════════════════════════════════════════════════════════════════════════════
   SESSION 8: FLOCKSLIDES — PRESENTATION EDITOR
   "Proclaim the good news clearly and beautifully." — Colossians 4:4
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Theme definitions ───────────────────────────────────────────────────── */
const SLIDE_THEMES = {
  default:  { bg: '#ffffff', text: '#1f2937', accent: '#3b82f6', accent2: '#e0e7ff' },
  midnight: { bg: '#1e1b4b', text: '#e0e7ff', accent: '#818cf8', accent2: '#312e81' },
  ocean:    { bg: '#0c4a6e', text: '#e0f2fe', accent: '#38bdf8', accent2: '#075985' },
  forest:   { bg: '#14532d', text: '#dcfce7', accent: '#4ade80', accent2: '#166534' },
  sunset:   { bg: '#7c2d12', text: '#ffedd5', accent: '#fb923c', accent2: '#9a3412' },
  slate:    { bg: '#f8fafc', text: '#334155', accent: '#64748b', accent2: '#e2e8f0' },
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function _slideId() {
  return 'sl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}
function _elId() {
  return 'el_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}
function _newBlankSlide() {
  return { id: _slideId(), bg: '', transition: 'fade', elements: [] };
}
function _defaultTitleSlide() {
  var theme = SLIDE_THEMES[S.slides.theme] || SLIDE_THEMES.default;
  return {
    id: _slideId(),
    bg: '',
    transition: 'fade',
    elements: [
      {
        id: _elId(), type: 'text',
        x: 80, y: 160, w: 800, h: 120,
        content: '<h1 style="text-align:center;margin:0;line-height:1.2">Presentation Title</h1>',
        style: { color: theme.text, fontSize: 48 },
      },
      {
        id: _elId(), type: 'text',
        x: 200, y: 310, w: 560, h: 60,
        content: '<p style="text-align:center;margin:0">Click to edit subtitle</p>',
        style: { color: theme.text, fontSize: 20 },
      },
    ],
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC: CREATE NEW PRESENTATION
   ══════════════════════════════════════════════════════════════════════════════ */

function createNewPresentation() {
  document.getElementById('fd-new-menu')?.classList.add('hidden');
  S.slides.theme = 'default';
  S.slides.slides = [_defaultTitleSlide()];
  S.slides.currentIdx = 0;
  S.slides.selectedElId = null;

  S.currentDoc = {
    id: null,
    name: 'Untitled Presentation',
    type: 'presentation',
    slideData: '',
    theme: 'default',
    ownerId: S.user.uid,
    ownerName: S.user.displayName || 'Anonymous',
    shared: false,
    folderId: null,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  _openSlidesEditor();
}

/* ══════════════════════════════════════════════════════════════════════════════
   SLIDES EDITOR OPEN / CLOSE
   ══════════════════════════════════════════════════════════════════════════════ */

function _openSlidesEditor() {
  if (!S.currentDoc) return;

  // Load slide data from doc if it exists
  if (S.currentDoc.slideData) {
    try {
      var loaded = JSON.parse(S.currentDoc.slideData);
      if (Array.isArray(loaded) && loaded.length > 0) {
        S.slides.slides = loaded;
      } else {
        S.slides.slides = [_defaultTitleSlide()];
      }
    } catch (e) {
      S.slides.slides = [_defaultTitleSlide()];
    }
  }
  S.slides.theme = S.currentDoc.theme || 'default';
  S.slides.currentIdx = 0;
  S.slides.selectedElId = null;

  // Switch views
  document.getElementById('fd-library-view')?.classList.add('hidden');
  document.getElementById('fd-editor-view')?.classList.add('hidden');
  document.getElementById('fd-sheet-view')?.classList.add('hidden');
  document.getElementById('fd-slides-view')?.classList.remove('hidden');

  // Populate name
  var nameInput = document.getElementById('fd-slides-name');
  if (nameInput) nameInput.value = S.currentDoc.name || 'Untitled Presentation';

  // Apply active theme button state
  _updateThemeBtnState();

  // Bind slides event listeners (idempotent)
  _bindSlidesEvents();

  // Render thumbnails and canvas
  _renderThumbnails();
  _renderSlideCanvas(S.slides.currentIdx);

  // Scale canvas after a brief paint
  requestAnimationFrame(_scaleSlideCanvas);
  window.addEventListener('resize', _scaleSlideCanvas);

  var saveStatus = document.getElementById('fd-slides-save-status');
  if (saveStatus) saveStatus.textContent = 'All changes saved';
}

function _closeSlidesEditor() {
  // Stop drag / resize
  S.slides.dragState = null;
  S.slides.resizeState = null;
  S.slides.selectedElId = null;

  window.removeEventListener('resize', _scaleSlideCanvas);

  document.getElementById('fd-slides-view')?.classList.add('hidden');
  document.getElementById('fd-library-view')?.classList.remove('hidden');

  S.currentDoc = null;
  _loadDocuments();
}

/* ══════════════════════════════════════════════════════════════════════════════
   SAVE
   ══════════════════════════════════════════════════════════════════════════════ */

function _autoSaveSlides() {
  clearTimeout(S.slides.autoSaveTimer);
  var saveStatus = document.getElementById('fd-slides-save-status');
  if (saveStatus) saveStatus.textContent = 'Unsaved changes...';
  S.slides.autoSaveTimer = setTimeout(_savePresentation, 2000);
}

async function _savePresentation() {
  if (!S.currentDoc || !_checkFirebase()) return;

  var saveStatus = document.getElementById('fd-slides-save-status');
  if (saveStatus) saveStatus.textContent = 'Saving...';

  S.currentDoc.slideData = JSON.stringify(S.slides.slides);
  S.currentDoc.theme = S.slides.theme;
  S.currentDoc.updatedAt = new Date();

  var payload = {
    name: S.currentDoc.name,
    slideData: S.currentDoc.slideData,
    theme: S.currentDoc.theme,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: S.user.uid,
    updatedByName: S.user.displayName || 'Anonymous',
  };

  try {
    var db = firebase.firestore();
    if (S.currentDoc.id) {
      await db.collection(COLLECTION_DOCS).doc(S.currentDoc.id).update(payload);
    } else {
      var ref = await db.collection(COLLECTION_DOCS).add({
        ...payload,
        type: 'presentation',
        ownerId: S.currentDoc.ownerId,
        ownerName: S.currentDoc.ownerName,
        shared: false,
        sharedWith: [],
        churchPermission: 'view',
        folderId: null,
        deleted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      S.currentDoc.id = ref.id;
    }
    if (saveStatus) saveStatus.textContent = 'All changes saved';
  } catch (err) {
    console.error('[FlockSlides] Save error:', err);
    _toast('Failed to save presentation', 'error');
    if (saveStatus) saveStatus.textContent = 'Error saving';
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   CANVAS SCALING
   ══════════════════════════════════════════════════════════════════════════════ */

function _scaleSlideCanvas() {
  var wrap = document.getElementById('fd-slides-canvas-wrap');
  var canvas = document.getElementById('fd-slides-canvas');
  if (!wrap || !canvas) return;

  var W = wrap.clientWidth;
  var H = wrap.clientHeight;
  var scale = Math.min((W * 0.94) / 960, (H * 0.94) / 540);
  S.slides.scale = scale;

  canvas.style.transform = 'scale(' + scale + ')';
}

/* ══════════════════════════════════════════════════════════════════════════════
   THUMBNAIL RENDERING
   ══════════════════════════════════════════════════════════════════════════════ */

function _renderThumbnails() {
  var sidebar = document.getElementById('fd-slides-sidebar');
  if (!sidebar) return;

  var theme = SLIDE_THEMES[S.slides.theme] || SLIDE_THEMES.default;
  var html = '';

  S.slides.slides.forEach(function(slide, idx) {
    var isActive = idx === S.slides.currentIdx ? ' is-active' : '';
    var bg = slide.bg || theme.bg;

    // Build mini inner HTML
    var innerHtml = '<div class="fd-slide-bg" style="background:' + _e(bg) + '"></div>';
    slide.elements.forEach(function(el) {
      var elStyle = 'position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;'
        + 'width:' + el.w + 'px;height:' + el.h + 'px;'
        + 'overflow:hidden;padding:4px 6px;box-sizing:border-box;'
        + 'color:' + _e(el.style.color || theme.text) + ';';
      if (el.type === 'text') {
        innerHtml += '<div style="' + elStyle + 'pointer-events:none">' + el.content + '</div>';
      } else if (el.type === 'image') {
        innerHtml += '<div style="' + elStyle + '"><img src="' + _e(el.content) + '" style="width:100%;height:100%;object-fit:cover" alt=""></div>';
      }
    });

    html += '<div class="fd-slide-thumb-wrap" data-slide-idx="' + idx + '">'
      + '<div class="fd-slide-thumb-num">' + (idx + 1) + '</div>'
      + '<div class="fd-slide-thumb' + isActive + '">'
      + '<div class="fd-slide-thumb-inner">' + innerHtml + '</div>'
      + '</div>'
      + '</div>';
  });

  html += '<button class="fd-slides-add-btn" id="fd-slides-sidebar-add-btn">'
    + '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">'
    + '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>'
    + '</svg> Add Slide</button>';

  sidebar.innerHTML = html;

  // Click events on thumbnails
  sidebar.querySelectorAll('[data-slide-idx]').forEach(function(el) {
    el.addEventListener('click', function() {
      _selectSlide(parseInt(el.dataset.slideIdx, 10));
    });
  });
  sidebar.querySelector('#fd-slides-sidebar-add-btn')?.addEventListener('click', _addSlide);
}

/* ══════════════════════════════════════════════════════════════════════════════
   SLIDE NAVIGATION
   ══════════════════════════════════════════════════════════════════════════════ */

function _selectSlide(idx) {
  if (idx < 0 || idx >= S.slides.slides.length) return;
  S.slides.currentIdx = idx;
  S.slides.selectedElId = null;
  _renderThumbnails();
  _renderSlideCanvas(idx);
}

/* ══════════════════════════════════════════════════════════════════════════════
   CANVAS RENDERING
   ══════════════════════════════════════════════════════════════════════════════ */

function _renderSlideCanvas(idx) {
  var canvas = document.getElementById('fd-slides-canvas');
  if (!canvas) return;

  var slide = S.slides.slides[idx];
  if (!slide) { canvas.innerHTML = ''; return; }

  var theme = SLIDE_THEMES[S.slides.theme] || SLIDE_THEMES.default;
  var bg = slide.bg || theme.bg;

  // Background
  canvas.style.background = bg;

  // Clear and rebuild elements
  canvas.innerHTML = '';

  slide.elements.forEach(function(el) {
    var dom = _buildElementDom(el, theme);
    canvas.appendChild(dom);
  });

  // Canvas click = deselect
  canvas.addEventListener('mousedown', function(e) {
    if (e.target === canvas) {
      _deselectAll();
    }
  }, { capture: false });

  // Re-apply selected state
  if (S.slides.selectedElId) {
    var sel = canvas.querySelector('[data-el-id="' + S.slides.selectedElId + '"]');
    if (sel) sel.classList.add('is-selected');
  }
}

function _buildElementDom(el, theme) {
  var div = document.createElement('div');
  div.className = 'fd-slide-element' + (el.id === S.slides.selectedElId ? ' is-selected' : '');
  div.dataset.elId = el.id;
  div.style.left = el.x + 'px';
  div.style.top = el.y + 'px';
  div.style.width = el.w + 'px';
  div.style.height = el.h + 'px';

  if (el.type === 'text') {
    div.classList.add('fd-slide-text-el');
    div.innerHTML = el.content;
    div.style.color = el.style.color || theme.text;
    // Double-click to edit
    div.addEventListener('dblclick', function(e) {
      e.stopPropagation();
      _startTextEdit(div, el);
    });
  } else if (el.type === 'image') {
    div.classList.add('fd-slide-img-el');
    var img = document.createElement('img');
    img.src = el.content;
    img.alt = '';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    div.appendChild(img);
  }

  // Mouse events: select + drag
  div.addEventListener('mousedown', function(e) {
    if (e.target.classList.contains('fd-resize-handle')) return;
    e.stopPropagation();
    _selectElement(el.id);
    // Start drag
    S.slides.dragState = {
      elId: el.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
    };
  });

  // Add resize handles if selected
  if (el.id === S.slides.selectedElId) {
    ['nw', 'ne', 'sw', 'se'].forEach(function(handle) {
      var h = document.createElement('div');
      h.className = 'fd-resize-handle';
      h.dataset.handle = handle;
      h.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        e.preventDefault();
        S.slides.resizeState = {
          elId: el.id,
          handle: handle,
          startX: e.clientX,
          startY: e.clientY,
          origW: el.w,
          origH: el.h,
          origX: el.x,
          origY: el.y,
        };
        S.slides.dragState = null;
      });
      div.appendChild(h);
    });
  }

  return div;
}

function _startTextEdit(div, el) {
  div.contentEditable = 'true';
  div.focus();
  // Position caret at end
  var range = document.createRange();
  var sel = window.getSelection();
  range.selectNodeContents(div);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);

  div.addEventListener('blur', function onBlur() {
    div.removeAttribute('contenteditable');
    div.removeEventListener('blur', onBlur);
    el.content = div.innerHTML;
    _renderThumbnails();
    _autoSaveSlides();
  }, { once: true });

  div.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      div.blur();
    }
  });
}

function _selectElement(elId) {
  S.slides.selectedElId = elId;
  _renderSlideCanvas(S.slides.currentIdx);
}

function _deselectAll() {
  S.slides.selectedElId = null;
  _renderSlideCanvas(S.slides.currentIdx);
}

/* ══════════════════════════════════════════════════════════════════════════════
   ELEMENT DRAG + RESIZE (document-level mouse events)
   ══════════════════════════════════════════════════════════════════════════════ */

function _bindSlidesDragEvents() {
  document.addEventListener('mousemove', function(e) {
    if (S.slides.dragState) {
      var scale = S.slides.scale || 1;
      var dx = (e.clientX - S.slides.dragState.startX) / scale;
      var dy = (e.clientY - S.slides.dragState.startY) / scale;
      var slide = S.slides.slides[S.slides.currentIdx];
      if (!slide) return;
      var el = slide.elements.find(function(el) { return el.id === S.slides.dragState.elId; });
      if (!el) return;
      el.x = Math.round(Math.max(0, Math.min(960 - el.w, S.slides.dragState.origX + dx)));
      el.y = Math.round(Math.max(0, Math.min(540 - el.h, S.slides.dragState.origY + dy)));
      // Update DOM directly for performance
      var domEl = document.querySelector('[data-el-id="' + el.id + '"]');
      if (domEl) {
        domEl.style.left = el.x + 'px';
        domEl.style.top = el.y + 'px';
      }
    }
    if (S.slides.resizeState) {
      var rs = S.slides.resizeState;
      var scale2 = S.slides.scale || 1;
      var dx2 = (e.clientX - rs.startX) / scale2;
      var dy2 = (e.clientY - rs.startY) / scale2;
      var slide2 = S.slides.slides[S.slides.currentIdx];
      if (!slide2) return;
      var el2 = slide2.elements.find(function(el) { return el.id === rs.elId; });
      if (!el2) return;
      var minW = 60; var minH = 30;
      if (rs.handle === 'se' || rs.handle === 'ne') {
        el2.w = Math.round(Math.max(minW, rs.origW + dx2));
      }
      if (rs.handle === 'sw' || rs.handle === 'nw') {
        var newW = Math.round(Math.max(minW, rs.origW - dx2));
        el2.x = Math.round(rs.origX + rs.origW - newW);
        el2.w = newW;
      }
      if (rs.handle === 'se' || rs.handle === 'sw') {
        el2.h = Math.round(Math.max(minH, rs.origH + dy2));
      }
      if (rs.handle === 'ne' || rs.handle === 'nw') {
        var newH = Math.round(Math.max(minH, rs.origH - dy2));
        el2.y = Math.round(rs.origY + rs.origH - newH);
        el2.h = newH;
      }
      var domEl2 = document.querySelector('[data-el-id="' + el2.id + '"]');
      if (domEl2) {
        domEl2.style.left = el2.x + 'px';
        domEl2.style.top = el2.y + 'px';
        domEl2.style.width = el2.w + 'px';
        domEl2.style.height = el2.h + 'px';
      }
    }
  });

  document.addEventListener('mouseup', function() {
    if (S.slides.dragState || S.slides.resizeState) {
      S.slides.dragState = null;
      S.slides.resizeState = null;
      _renderThumbnails();
      _autoSaveSlides();
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   SLIDE CRUD
   ══════════════════════════════════════════════════════════════════════════════ */

function _addSlide() {
  var blank = _newBlankSlide();
  var theme = SLIDE_THEMES[S.slides.theme] || SLIDE_THEMES.default;
  blank.elements = [
    {
      id: _elId(), type: 'text',
      x: 80, y: 100, w: 800, h: 80,
      content: '<h2 style="text-align:center;margin:0">Slide Title</h2>',
      style: { color: theme.text, fontSize: 36 },
    },
    {
      id: _elId(), type: 'text',
      x: 80, y: 220, w: 800, h: 200,
      content: '<p style="text-align:center;margin:0">Click to add content here</p>',
      style: { color: theme.text, fontSize: 20 },
    },
  ];
  S.slides.slides.splice(S.slides.currentIdx + 1, 0, blank);
  S.slides.currentIdx++;
  S.slides.selectedElId = null;
  _renderThumbnails();
  _renderSlideCanvas(S.slides.currentIdx);
  _autoSaveSlides();
}

function _deleteCurrentSlide() {
  if (S.slides.slides.length <= 1) {
    _toast('Cannot delete the only slide', 'warning');
    return;
  }
  S.slides.slides.splice(S.slides.currentIdx, 1);
  S.slides.currentIdx = Math.max(0, S.slides.currentIdx - 1);
  S.slides.selectedElId = null;
  _renderThumbnails();
  _renderSlideCanvas(S.slides.currentIdx);
  _autoSaveSlides();
}

function _duplicateCurrentSlide() {
  var slide = S.slides.slides[S.slides.currentIdx];
  if (!slide) return;
  var clone = JSON.parse(JSON.stringify(slide));
  clone.id = _slideId();
  clone.elements = clone.elements.map(function(el) {
    return Object.assign({}, el, { id: _elId() });
  });
  S.slides.slides.splice(S.slides.currentIdx + 1, 0, clone);
  S.slides.currentIdx++;
  S.slides.selectedElId = null;
  _renderThumbnails();
  _renderSlideCanvas(S.slides.currentIdx);
  _autoSaveSlides();
}

/* ══════════════════════════════════════════════════════════════════════════════
   ADD ELEMENTS
   ══════════════════════════════════════════════════════════════════════════════ */

function _addTextBox() {
  var slide = S.slides.slides[S.slides.currentIdx];
  if (!slide) return;
  var theme = SLIDE_THEMES[S.slides.theme] || SLIDE_THEMES.default;
  var el = {
    id: _elId(), type: 'text',
    x: 180, y: 160, w: 600, h: 80,
    content: '<p style="text-align:center;margin:0">Text box</p>',
    style: { color: theme.text, fontSize: 24 },
  };
  slide.elements.push(el);
  S.slides.selectedElId = el.id;
  _renderThumbnails();
  _renderSlideCanvas(S.slides.currentIdx);
  _autoSaveSlides();
  _toast('Text box added — double-click to edit', 'info');
}

function _addImageToSlide(file) {
  var slide = S.slides.slides[S.slides.currentIdx];
  if (!slide) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    var el = {
      id: _elId(), type: 'image',
      x: 180, y: 80, w: 600, h: 380,
      content: e.target.result,
      style: {},
    };
    slide.elements.push(el);
    S.slides.selectedElId = el.id;
    _renderThumbnails();
    _renderSlideCanvas(S.slides.currentIdx);
    _autoSaveSlides();
  };
  reader.readAsDataURL(file);
}

function _deleteSelectedElement() {
  if (!S.slides.selectedElId) return;
  var slide = S.slides.slides[S.slides.currentIdx];
  if (!slide) return;
  slide.elements = slide.elements.filter(function(el) { return el.id !== S.slides.selectedElId; });
  S.slides.selectedElId = null;
  _renderThumbnails();
  _renderSlideCanvas(S.slides.currentIdx);
  _autoSaveSlides();
}

/* ══════════════════════════════════════════════════════════════════════════════
   THEMES
   ══════════════════════════════════════════════════════════════════════════════ */

function _applyTheme(name) {
  if (!SLIDE_THEMES[name]) return;
  S.slides.theme = name;
  S.currentDoc.theme = name;
  _updateThemeBtnState();
  document.getElementById('fd-slides-theme-popup')?.classList.add('hidden');
  _renderThumbnails();
  _renderSlideCanvas(S.slides.currentIdx);
  _autoSaveSlides();
  _toast('Theme changed to ' + name.charAt(0).toUpperCase() + name.slice(1), 'success');
}

function _updateThemeBtnState() {
  document.querySelectorAll('[data-theme]').forEach(function(btn) {
    btn.classList.toggle('is-active', btn.dataset.theme === S.slides.theme);
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   TRANSITIONS
   ══════════════════════════════════════════════════════════════════════════════ */

function _applyTransition(name) {
  var slide = S.slides.slides[S.slides.currentIdx];
  if (!slide) return;
  slide.transition = name;
  // Update active state in popup
  document.querySelectorAll('[data-transition]').forEach(function(btn) {
    btn.classList.toggle('is-active', btn.dataset.transition === name);
  });
  document.getElementById('fd-slides-trans-popup')?.classList.add('hidden');
  _autoSaveSlides();
  _toast('Transition: ' + name.charAt(0).toUpperCase() + name.slice(1), 'info');
}

/* ══════════════════════════════════════════════════════════════════════════════
   PRESENTER MODE
   ══════════════════════════════════════════════════════════════════════════════ */

function _enterPresenterMode() {
  S.slides.presenterMode = true;
  S.slides.presenterIdx = S.slides.currentIdx;

  var overlay = document.getElementById('fd-presenter-overlay');
  if (overlay) overlay.classList.remove('hidden');

  _renderPresenterSlide(S.slides.presenterIdx, false);
  _updatePresenterControls();

  // Keyboard navigation
  document._presenterKeyHandler = function(e) {
    if (!S.slides.presenterMode) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault(); _presenterNext();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault(); _presenterPrev();
    } else if (e.key === 'Escape') {
      _exitPresenterMode();
    }
  };
  document.addEventListener('keydown', document._presenterKeyHandler);

  // Scale presenter canvas
  requestAnimationFrame(_scalePresenterCanvas);
}

function _exitPresenterMode() {
  S.slides.presenterMode = false;
  document.getElementById('fd-presenter-overlay')?.classList.add('hidden');
  if (document._presenterKeyHandler) {
    document.removeEventListener('keydown', document._presenterKeyHandler);
    delete document._presenterKeyHandler;
  }
}

function _presenterNext() {
  if (S.slides.presenterIdx < S.slides.slides.length - 1) {
    S.slides.presenterIdx++;
    _renderPresenterSlide(S.slides.presenterIdx, true);
    _updatePresenterControls();
  }
}

function _presenterPrev() {
  if (S.slides.presenterIdx > 0) {
    S.slides.presenterIdx--;
    _renderPresenterSlide(S.slides.presenterIdx, false);
    _updatePresenterControls();
  }
}

function _renderPresenterSlide(idx, forward) {
  var canvas = document.getElementById('fd-presenter-canvas');
  if (!canvas) return;
  var slide = S.slides.slides[idx];
  if (!slide) return;
  var theme = SLIDE_THEMES[S.slides.theme] || SLIDE_THEMES.default;

  canvas.style.background = slide.bg || theme.bg;
  canvas.innerHTML = '';
  slide.elements.forEach(function(el) {
    var dom = document.createElement('div');
    dom.className = 'fd-slide-element';
    dom.style.cssText = 'left:' + el.x + 'px;top:' + el.y + 'px;'
      + 'width:' + el.w + 'px;height:' + el.h + 'px;cursor:default;user-select:none;';
    if (el.type === 'text') {
      dom.style.color = el.style.color || theme.text;
      dom.innerHTML = el.content;
    } else if (el.type === 'image') {
      dom.innerHTML = '<img src="' + _e(el.content) + '" style="width:100%;height:100%;object-fit:cover" alt="">';
    }
    canvas.appendChild(dom);
  });

  // Apply transition animation
  var transition = slide.transition || 'fade';
  var animClass = '';
  if (transition === 'fade') animClass = 'fd-presenter-anim-fade';
  else if (transition === 'slide') animClass = 'fd-presenter-anim-slide';
  else if (transition === 'zoom') animClass = 'fd-presenter-anim-zoom';

  if (animClass) {
    canvas.classList.remove('fd-presenter-anim-fade', 'fd-presenter-anim-slide', 'fd-presenter-anim-zoom');
    void canvas.offsetWidth; // force reflow
    canvas.classList.add(animClass);
  }

  _scalePresenterCanvas();
}

function _scalePresenterCanvas() {
  var wrap = document.getElementById('fd-presenter-slide-wrap');
  var canvas = document.getElementById('fd-presenter-canvas');
  if (!wrap || !canvas) return;
  var W = wrap.clientWidth;
  var H = wrap.clientHeight;
  var scale = Math.min((W * 0.96) / 960, (H * 0.96) / 540);
  canvas.style.transform = 'scale(' + scale + ')';
}

function _updatePresenterControls() {
  var idx = S.slides.presenterIdx;
  var total = S.slides.slides.length;
  var counter = document.getElementById('fd-presenter-counter');
  var prevBtn = document.getElementById('fd-presenter-prev-btn');
  var nextBtn = document.getElementById('fd-presenter-next-btn');
  if (counter) counter.textContent = (idx + 1) + ' / ' + total;
  if (prevBtn) prevBtn.disabled = idx === 0;
  if (nextBtn) nextBtn.disabled = idx === total - 1;
}

/* ══════════════════════════════════════════════════════════════════════════════
   EXPORT TO PDF
   ══════════════════════════════════════════════════════════════════════════════ */

function _exportSlidesPdf() {
  if (!S.slides.slides.length) {
    _toast('No slides to export', 'warning');
    return;
  }

  var theme = SLIDE_THEMES[S.slides.theme] || SLIDE_THEMES.default;
  var printRoot = document.createElement('div');
  printRoot.className = 'fd-slides-print-root';
  printRoot.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:#fff;';

  S.slides.slides.forEach(function(slide) {
    var page = document.createElement('div');
    page.className = 'fd-slides-print-page';
    page.style.cssText = 'width:100%;aspect-ratio:16/9;overflow:hidden;position:relative;background:' + (slide.bg || theme.bg) + ';page-break-after:always;';

    slide.elements.forEach(function(el) {
      var dom = document.createElement('div');
      dom.style.cssText = 'position:absolute;left:' + (el.x / 9.6) + '%;top:' + (el.y / 5.4) + '%;'
        + 'width:' + (el.w / 9.6) + '%;height:' + (el.h / 5.4) + '%;'
        + 'overflow:hidden;box-sizing:border-box;padding:1% 0.6%;';
      if (el.type === 'text') {
        dom.style.color = el.style.color || theme.text;
        dom.innerHTML = el.content;
      } else if (el.type === 'image') {
        dom.innerHTML = '<img src="' + _e(el.content) + '" style="width:100%;height:100%;object-fit:cover" alt="">';
      }
      page.appendChild(dom);
    });

    printRoot.appendChild(page);
  });

  document.body.appendChild(printRoot);
  printRoot.style.display = 'block';

  _toast('Opening print dialog — choose "Save as PDF"', 'info', 4000);

  setTimeout(function() {
    window.print();
    setTimeout(function() {
      document.body.removeChild(printRoot);
    }, 1000);
  }, 300);
}

/* ══════════════════════════════════════════════════════════════════════════════
   EVENT BINDINGS
   ══════════════════════════════════════════════════════════════════════════════ */

var _slidesEventsBound = false;

function _bindSlidesEvents() {
  if (_slidesEventsBound) return;
  _slidesEventsBound = true;

  // Back button
  document.getElementById('fd-slides-back-btn')?.addEventListener('click', _closeSlidesEditor);

  // Name input
  document.getElementById('fd-slides-name')?.addEventListener('input', function(e) {
    S.currentDoc.name = e.target.value || 'Untitled Presentation';
    _autoSaveSlides();
  });

  // Add text box
  document.getElementById('fd-slides-add-text-btn')?.addEventListener('click', _addTextBox);

  // Add image
  document.getElementById('fd-slides-add-image-btn')?.addEventListener('click', function() {
    document.getElementById('fd-slide-img-input')?.click();
  });
  document.getElementById('fd-slide-img-input')?.addEventListener('change', function(e) {
    if (e.target.files[0]) _addImageToSlide(e.target.files[0]);
    e.target.value = '';
  });

  // Theme button + popup
  document.getElementById('fd-slides-theme-btn')?.addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('fd-slides-theme-popup')?.classList.toggle('hidden');
  });
  document.getElementById('fd-theme-grid')?.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-theme]');
    if (btn) _applyTheme(btn.dataset.theme);
  });

  // Transition button + popup
  document.getElementById('fd-slides-trans-btn')?.addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('fd-slides-trans-popup')?.classList.toggle('hidden');
  });
  document.getElementById('fd-slides-trans-popup')?.addEventListener('click', function(e) {
    var item = e.target.closest('[data-transition]');
    if (item) _applyTransition(item.dataset.transition);
  });

  // Slide CRUD buttons
  document.getElementById('fd-slides-add-slide-btn')?.addEventListener('click', _addSlide);
  document.getElementById('fd-slides-del-slide-btn')?.addEventListener('click', _deleteCurrentSlide);
  document.getElementById('fd-slides-dup-slide-btn')?.addEventListener('click', _duplicateCurrentSlide);

  // Present
  document.getElementById('fd-slides-present-btn')?.addEventListener('click', _enterPresenterMode);

  // Export PDF
  document.getElementById('fd-slides-export-pdf-btn')?.addEventListener('click', _exportSlidesPdf);

  // Presenter controls
  document.getElementById('fd-presenter-prev-btn')?.addEventListener('click', _presenterPrev);
  document.getElementById('fd-presenter-next-btn')?.addEventListener('click', _presenterNext);
  document.getElementById('fd-presenter-exit-btn')?.addEventListener('click', _exitPresenterMode);

  // Close popups on outside click
  document.addEventListener('click', function(e) {
    if (!document.getElementById('fd-slides-theme-wrap')?.contains(e.target)) {
      document.getElementById('fd-slides-theme-popup')?.classList.add('hidden');
    }
    if (!document.getElementById('fd-slides-trans-wrap')?.contains(e.target)) {
      document.getElementById('fd-slides-trans-popup')?.classList.add('hidden');
    }
  });

  // Delete element on Del/Backspace key (when not editing text)
  document.addEventListener('keydown', function(e) {
    if (!document.getElementById('fd-slides-view') || document.getElementById('fd-slides-view').classList.contains('hidden')) return;
    if (e.target.contentEditable === 'true' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.slides.selectedElId) {
      e.preventDefault();
      _deleteSelectedElement();
    }
  });

  // Bind drag events (global, idempotent)
  _bindSlidesDragEvents();
}
