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

import { mountUnityHeader } from '../Scripts/the_unity_header.js';

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
};

/* ── Initialization ───────────────────────────────────────────────────────── */
window.FlockDocs = {
  init,
  createNewDocument,
  openDocument,
  saveDocument,
  deleteDocument,
  switchView,
};

// Wait for Firebase and Nehemiah to be ready
function _waitForReady() {
  return new Promise((resolve) => {
    const checkReady = () => {
      if (typeof firebase !== 'undefined' && 
          typeof Nehemiah !== 'undefined' && 
          Nehemiah.isAuthenticated()) {
        resolve();
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  await _waitForReady();
  init();
});

function init() {
  console.log('[FlockDocs] Initializing...');
  
  // Get authenticated user from Nehemiah
  const profile = Nehemiah.getProfile();
  if (!profile) {
    console.error('[FlockDocs] No authenticated user found');
    window.location.replace('app.flockdocs/index.html');
    return;
  }
  
  S.user = {
    uid: profile.uid,
    displayName: profile.displayName || profile.email,
    email: profile.email,
    role: profile.role || 'member',
  };

  console.log('[FlockDocs] User:', S.user.displayName);

  _loadPrefs();
  _mountHeader();
  _bindEvents();
  _loadDocuments();
  _loadFolders();
  
  console.log('[FlockDocs] Ready');
}

/* ── Unity Header ─────────────────────────────────────────────────────────── */
function _mountHeader() {
  const appIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
  
  mountUnityHeader(document.getElementById('fd-topbar'), {
    appId: 'flockdocs',
    appName: 'FlockDocs',
    appIconSvg,
    appAccent: '#e8a838',
    appAccentDk: '#c48a20',
    homeHref: 'app.flockdocs/app.flockdocs.html',
    user: S.user,
    onSignOut: async () => {
      try {
        await Nehemiah.logout();
        window.location.replace('app.flockdocs/index.html');
      } catch (err) {
        console.error('[FlockDocs] Sign out failed:', err);
      }
    },
    onHamburger: () => {
      document.getElementById('fd-sidebar-wrap')?.classList.toggle('is-open');
    },
    extras: [
      {
        html: `<button onclick="FlockDocs.createNewDocument()" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:8px;background:#e8a838;color:#0c1445;font:600 0.82rem 'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:background .15s;border:none;white-space:nowrap;box-shadow:0 2px 8px rgba(232,168,56,0.25)" onmouseover="this.style.background='#f0b845'" onmouseout="this.style.background='#e8a838'" title="Create a new document" aria-label="New Document"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg><span style="white-space:nowrap">New</span></button>`,
      },
    ],
  });
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

  // Back button
  document.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    _closeEditor();
  });

  // Save button
  document.getElementById('fd-save-btn')?.addEventListener('click', saveDocument);

  // Editor content - auto-save on input
  document.getElementById('fd-editor-content')?.addEventListener('input', () => {
    _autoSave();
  });

  // Close mobile sidebar when clicking outside
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('fd-sidebar-wrap');
    const hamburger = document.querySelector('.unity-hamburger');
    if (sidebar?.classList.contains('is-open') && 
        !sidebar.contains(e.target) && 
        e.target !== hamburger && 
        !hamburger?.contains(e.target)) {
      sidebar.classList.remove('is-open');
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

    _openEditor();
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
        ${!S.searchQuery ? `<button class="fd-btn fd-btn--primary" onclick="FlockDocs.createNewDocument()">
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
  
  return `
    <div class="fd-doc-card" onclick="FlockDocs.openDocument('${doc.id}')">
      <button class="fd-doc-menu-btn" onclick="event.stopPropagation(); _showDocMenu('${doc.id}')">
        <svg fill="currentColor" viewBox="0 0 24 24" width="18" height="18">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </button>
      <div class="fd-doc-icon">${icon}</div>
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
