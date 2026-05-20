/**
 * FlockShamar - Keep & Guard Your Notes
 * "The Lord bless you and keep you" - Numbers 6:24
 * 
 * A Google Keep-style note-taking app for FlockOS
 */

import { mountUnityHeader } from '../Scripts/the_unity_header.js';
import { mountQuill }       from '../Scripts/the_quill.js';

(function() {
  'use strict';
  
  // State
  const S = {
    notes: [],
    currentNote: null,
    currentView: 'notes',
    user: null,
    db: null,
    isExpanded: false,
    searchQuery: '',
    colorPickerTarget: null,
    todos: [],
    todosLoaded: false,
    todosLoading: false,
    upperRoomReady: false,
  };
  
  // Initialize
  async function init() {
    console.log('[FlockShamar] Initializing...');

    // Wait for auth to be ready
    await _waitForReady();

    // Initialize Firebase
    try {
      if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
        // Firebase config loaded by firm_foundation.js
        firebase.initializeApp(window.FIREBASE_CONFIG || {});
      }
      S.db = firebase.firestore();

      // Mint UpperRoom custom token so Firebase Auth resolves with the correct user
      const UR = window.UpperRoom;
      if (UR) {
        try {
          const cfg = window.FLOCK_FIREBASE_CONFIG || window.FIREBASE_CONFIG || null;
          if (typeof UR.init === 'function') {
            try { await UR.init(cfg); } catch (_) { /* may already be initialized */ }
          }
          if (typeof UR.authenticate === 'function') {
            await UR.authenticate();
            console.log('[FlockShamar] UpperRoom authenticated');
          }
        } catch (e) {
          console.warn('[FlockShamar] UpperRoom authenticate failed (continuing):', e);
        }
      }

      // Auth state — by now UpperRoom has signed in; user should be present
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          S.user = user;
          console.log('[FlockShamar] User authenticated:', user.uid);
          await loadNotes();
        } else {
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (isLocalhost) {
            // Development mode - use localStorage
            S.user = { uid: 'dev-user', displayName: 'Dev User', email: 'dev@flockos.church' };
            console.log('[FlockShamar] Development mode - using localStorage');
            loadNotesFromLocalStorage();
          } else {
            // Firebase not signed in after UpperRoom attempt — redirect to sign-in
            console.warn('[FlockShamar] Firebase user null after UpperRoom auth — redirecting to sign-in.');
            window.location.replace('app.flockshamar/index.html');
            return;
          }
        }
        render();
        checkDeepLink(); // Open deep-linked note if present in URL
      });
    } catch (err) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost) {
        console.warn('[FlockShamar] Firebase init failed, using localStorage:', err);
        S.user = { uid: 'dev-user', displayName: 'Dev User', email: 'dev@flockos.church' };
        loadNotesFromLocalStorage();
        render();
        checkDeepLink();
      } else {
        console.error('[FlockShamar] Firebase init failed — redirecting to sign-in:', err);
        window.location.replace('app.flockshamar/index.html');
      }
    }
    
    // Mount Unity Header
    if (typeof mountUnityHeader === 'function') {
      mountUnityHeader(document.getElementById('fs-topbar'), {
        appId: 'flockshamar',
        appName: 'FlockShamar',
        appIconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9,12 11,14 15,10"/></svg>',
        appAccent: '#fbbf24',
        appAccentDk: '#a16207',
        homeHref: 'app.flockshamar/app.flockshamar.html',
        onHamburger: () => {
          const sidebar = document.getElementById('fs-sidebar');
          if (sidebar) {
            sidebar.classList.toggle('show');
          }
        },
        features: [
          { id: 'fs-notes',   label: 'Notes',   hint: 'All your notes',   run: () => document.querySelector('[data-view="notes"]')?.click() },
          { id: 'fs-todos',   label: 'To-dos',  hint: 'Checklist notes',  run: () => document.querySelector('[data-view="todos"]')?.click() },
          { id: 'fs-archive', label: 'Archive', hint: 'Archived notes',   run: () => document.querySelector('[data-view="archive"]')?.click() },
          { id: 'fs-trash',   label: 'Trash',   hint: 'Deleted notes',    run: () => document.querySelector('[data-view="trash"]')?.click() },
        ],
      });
    }
    
    // Event Listeners
    setupEventListeners();
  }
  
  // Wait for Nehemiah auth to be ready
  function _waitForReady() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      const checkReady = () => {
        attempts++;
        
        if (typeof firebase !== 'undefined' && typeof Nehemiah !== 'undefined') {
          // Nehemiah loaded - check if authenticated
          if (Nehemiah.isAuthenticated()) {
            resolve();
          } else if (!isLocalhost) {
            // Not authenticated in DEPLOYED environment - redirect to login
            console.warn('[FlockShamar] User not authenticated, redirecting to login');
            window.location.replace('app.flockshamar/index.html');
            reject(new Error('Not authenticated'));
          } else {
            // Localhost - warn but don't redirect (for development)
            console.warn('[FlockShamar] User not authenticated (localhost - allowing for development)');
            resolve();
          }
        } else if (attempts >= maxAttempts) {
          // Timeout
          if (!isLocalhost) {
            console.error('[FlockShamar] Timeout waiting for auth, redirecting to login');
            window.location.replace('app.flockshamar/index.html');
            reject(new Error('Timeout'));
          } else {
            console.warn('[FlockShamar] Timeout waiting for auth (localhost - continuing anyway)');
            resolve();
          }
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }
  
  function setupEventListeners() {
    // Quick add note
    const quickAdd = document.getElementById('fs-quick-add');
    const quickNote = document.getElementById('fs-quick-note');
    const quickTitle = document.getElementById('fs-quick-title');
    
    quickNote.addEventListener('focus', () => {
      quickAdd.classList.add('expanded');
      S.isExpanded = true;
    });
    
    quickNote.addEventListener('input', autoResizeTextarea);
    
    document.getElementById('fs-btn-close').addEventListener('click', () => {
      saveQuickNote();
      quickAdd.classList.remove('expanded');
      S.isExpanded = false;
      quickNote.value = '';
      quickTitle.value = '';
    });
    
    // Close quick add when clicking outside
    document.addEventListener('click', (e) => {
      if (!quickAdd.contains(e.target) && S.isExpanded) {
        saveQuickNote();
        quickAdd.classList.remove('expanded');
        S.isExpanded = false;
        quickNote.value = '';
        quickTitle.value = '';
      }
    });
    
    // Quick add color picker
    document.getElementById('fs-btn-color').addEventListener('click', (e) => {
      e.stopPropagation();
      S.colorPickerTarget = 'quick-add';
      showColorPicker(e.target);
    });
    
    // Color picker options
    document.querySelectorAll('.fs-color-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const color = e.target.dataset.color;
        if (S.colorPickerTarget === 'quick-add') {
          quickAdd.style.background = getColorValue(color);
        } else if (S.currentNote) {
          S.currentNote.color = color;
          saveNote(S.currentNote);
          render();
        }
        hideColorPicker();
      });
    });
    
    // Search
    document.getElementById('fs-search').addEventListener('input', (e) => {
      S.searchQuery = e.target.value.toLowerCase();
      render();
    });
    
    // Sidebar navigation
    document.querySelectorAll('.fs-sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.fs-sidebar-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        S.currentView = item.dataset.view;
        render();
      });
    });
    
    // Edit modal
    document.getElementById('fs-edit-btn-close').addEventListener('click', () => {
      if (S.currentNote) {
        S.currentNote.title = document.getElementById('fs-edit-title').value;
        S.currentNote.content = document.getElementById('fs-edit-content').innerHTML;
        S.currentNote.updatedAt = new Date();
        saveNote(S.currentNote);
        S.currentNote = null;
        hideEditModal();
      }
    });
    
    document.getElementById('fs-edit-btn-pin').addEventListener('click', () => {
      if (S.currentNote) {
        S.currentNote.pinned = !S.currentNote.pinned;
        saveNote(S.currentNote);
        render();
      }
    });
    
    document.getElementById('fs-edit-btn-archive').addEventListener('click', () => {
      if (S.currentNote) {
        S.currentNote.archived = !S.currentNote.archived;
        saveNote(S.currentNote);
        S.currentNote = null;
        hideEditModal();
      }
    });
    
    document.getElementById('fs-edit-btn-delete').addEventListener('click', async () => {
      if (S.currentNote) {
        if (S.currentNote.deleted) {
          // Permanently delete
          if (confirm('Permanently delete this note? This cannot be undone.')) {
            await deleteNotePermanently(S.currentNote.id);
            S.currentNote = null;
            hideEditModal();
          }
        } else {
          // Move to trash
          S.currentNote.deleted = true;
          S.currentNote.deletedAt = new Date();
          saveNote(S.currentNote);
          S.currentNote = null;
          hideEditModal();
        }
      }
    });
    
    document.getElementById('fs-edit-btn-color').addEventListener('click', (e) => {
      e.stopPropagation();
      S.colorPickerTarget = 'edit-modal';
      showColorPicker(e.target);
    });
    
    // Close modal when clicking outside
    document.getElementById('fs-edit-modal').addEventListener('click', (e) => {
      if (e.target.id === 'fs-edit-modal') {
        if (S.currentNote) {
          S.currentNote.title = document.getElementById('fs-edit-title').value;
          S.currentNote.content = document.getElementById('fs-edit-content').innerHTML;
          S.currentNote.updatedAt = new Date();
          saveNote(S.currentNote);
          S.currentNote = null;
          hideEditModal();
        }
      }
    });
  }
  
  // Save quick note
  function saveQuickNote() {
    const title = document.getElementById('fs-quick-title').value.trim();
    const content = document.getElementById('fs-quick-note').value.trim();
    
    if (!title && !content) return;
    
    const note = {
      id: generateId(),
      title,
      content,
      type: 'text',
      color: 'default',
      pinned: false,
      archived: false,
      deleted: false,
      labels: [],
      checklist: [],
      ownerId: S.user.uid,
      ownerName: S.user.displayName || S.user.email,
      shared: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    S.notes.unshift(note);
    saveNote(note);
  }
  
  // Save note to storage
  async function saveNote(note) {
    if (S.db && S.user.uid !== 'dev-user') {
      try {
        await S.db.collection('notes').doc(note.id).set({
          ...note,
          createdAt: firebase.firestore.Timestamp.fromDate(note.createdAt),
          updatedAt: firebase.firestore.Timestamp.fromDate(note.updatedAt),
          deletedAt: note.deletedAt ? firebase.firestore.Timestamp.fromDate(note.deletedAt) : null
        });
      } catch (err) {
        console.error('[FlockShamar] Error saving note:', err);
      }
    } else {
      saveNotesToLocalStorage();
    }
    render();
  }
  
  // Load notes from Firestore
  async function loadNotes() {
    if (!S.db) return;
    
    try {
      const snapshot = await S.db.collection('notes')
        .where('ownerId', '==', S.user.uid)
        .orderBy('updatedAt', 'desc')
        .get();
      
      S.notes = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          deletedAt: data.deletedAt?.toDate() || null
        };
      });
      
      render();
    } catch (err) {
      console.error('[FlockShamar] Error loading notes:', err);
    }
  }
  
  // LocalStorage methods
  function saveNotesToLocalStorage() {
    localStorage.setItem('fs_notes', JSON.stringify(S.notes));
  }
  
  function loadNotesFromLocalStorage() {
    const stored = localStorage.getItem('fs_notes');
    if (stored) {
      S.notes = JSON.parse(stored).map(note => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt),
        deletedAt: note.deletedAt ? new Date(note.deletedAt) : null
      }));
    }
  }
  
  // Delete note permanently
  async function deleteNotePermanently(noteId) {
    if (S.db && S.user.uid !== 'dev-user') {
      try {
        await S.db.collection('notes').doc(noteId).delete();
      } catch (err) {
        console.error('[FlockShamar] Error deleting note:', err);
      }
    }
    
    S.notes = S.notes.filter(n => n.id !== noteId);
    saveNotesToLocalStorage();
    render();
  }
  
  // Render notes
  function render() {
    const pinnedContainer = document.getElementById('fs-pinned-notes');
    const otherContainer = document.getElementById('fs-other-notes');
    const pinnedSection = document.getElementById('fs-pinned-section');
    const othersSection = document.getElementById('fs-others-section');
    const quickAdd = document.getElementById('fs-quick-add');
    const viewTitle = document.getElementById('fs-view-title');
    const pinnedTitle = document.getElementById('fs-pinned-title');
    const othersTitle = document.getElementById('fs-others-title');
    const emptyState = document.getElementById('fs-empty-state');
    const emptyIcon = document.getElementById('fs-empty-icon');
    const emptyText = document.getElementById('fs-empty-text');
    
    // Update view title and quick-add visibility
    const viewConfig = {
      notes: { title: 'Notes', showQuickAdd: true, othersLabel: 'OTHERS', emptyIcon: '📝', emptyText: 'Take a note to get started' },
      archive: { title: 'Archive', showQuickAdd: false, othersLabel: 'ARCHIVED', emptyIcon: '📦', emptyText: 'Your archived notes appear here' },
      trash: { title: 'Trash', showQuickAdd: false, othersLabel: 'IN TRASH', emptyIcon: '🗑️', emptyText: 'Trash is empty' },
      reminders: { title: 'Reminders', showQuickAdd: false, othersLabel: 'REMINDERS', emptyIcon: '🔔', emptyText: 'No reminders yet' },
      todos: { title: 'Todos', showQuickAdd: false, othersLabel: 'SHARED TODOS', emptyIcon: '✅', emptyText: 'No open todos. Tap + Add Todo.' }
    };
    
    const config = viewConfig[S.currentView] || viewConfig.notes;
    viewTitle.textContent = config.title;
    othersTitle.textContent = config.othersLabel;
    
    if (config.showQuickAdd) {
      quickAdd.classList.remove('hidden');
    } else {
      quickAdd.classList.add('hidden');
    }

    // Todos view: hide note sections, show todos section, load + render todos
    const todosSection = document.getElementById('fs-todos-section');
    if (S.currentView === 'todos') {
      pinnedSection.classList.add('hidden');
      othersSection.classList.add('hidden');
      emptyState.classList.add('hidden');
      if (todosSection) todosSection.classList.remove('hidden');
      _renderTodosView();
      return;
    } else if (todosSection) {
      todosSection.classList.add('hidden');
    }
    
    // Filter notes based on view and search
    let filteredNotes = S.notes.filter(note => {
      if (S.searchQuery) {
        const matchesSearch = note.title.toLowerCase().includes(S.searchQuery) ||
                            note.content.toLowerCase().includes(S.searchQuery) ||
                            note.labels.some(l => l.toLowerCase().includes(S.searchQuery));
        if (!matchesSearch) return false;
      }
      
      if (S.currentView === 'notes') {
        return !note.archived && !note.deleted;
      } else if (S.currentView === 'archive') {
        return note.archived && !note.deleted;
      } else if (S.currentView === 'trash') {
        return note.deleted;
      } else if (S.currentView === 'reminders') {
        return note.hasReminder && !note.archived && !note.deleted;
      }
      return true;
    });
    
    // Separate pinned and other notes
    const pinnedNotes = filteredNotes.filter(n => n.pinned);
    const otherNotes = filteredNotes.filter(n => !n.pinned);
    
    // Render pinned notes
    if (pinnedNotes.length > 0) {
      pinnedSection.classList.remove('hidden');
      pinnedContainer.innerHTML = pinnedNotes.map(renderNoteCard).join('');
    } else {
      pinnedSection.classList.add('hidden');
    }
    
    // Render other notes
    if (otherNotes.length > 0) {
      othersSection.classList.remove('hidden');
      otherContainer.innerHTML = otherNotes.map(renderNoteCard).join('');
    } else {
      othersSection.classList.add('hidden');
    }
    
    // Show empty state if no notes at all
    if (filteredNotes.length === 0) {
      emptyState.classList.remove('hidden');
      emptyIcon.textContent = config.emptyIcon;
      emptyText.textContent = config.emptyText;
    } else {
      emptyState.classList.add('hidden');
    }
    
    // Attach event listeners to note cards
    attachNoteCardListeners();
  }
  
  // Render individual note card
  function renderNoteCard(note) {
    const labels = note.labels && note.labels.length > 0
      ? `<div class="fs-note-labels">
          ${note.labels.map(label => `<span class="fs-label-tag">${label}</span>`).join('')}
         </div>`
      : '';
    
    const checklist = note.type === 'checklist' && note.checklist && note.checklist.length > 0
      ? `<ul class="fs-checklist">
          ${note.checklist.slice(0, 5).map(item => `
            <li class="fs-checklist-item">
              <div class="fs-checkbox ${item.checked ? 'checked' : ''}"></div>
              <span class="fs-checklist-text ${item.checked ? 'checked' : ''}">${item.text}</span>
            </li>
          `).join('')}
          ${note.checklist.length > 5 ? `<li class="fs-checklist-item">+${note.checklist.length - 5} more</li>` : ''}
         </ul>`
      : '';
    
    const hasChecklist = note.type === 'checklist' && note.checklist && note.checklist.length > 0;
    const isEmpty = !note.title && !hasChecklist && !(note.content && note.content.trim());
    return `
      <div class="fs-note-card ${note.pinned ? 'pinned' : ''} ${isEmpty ? 'is-empty' : ''}" 
           data-note-id="${note.id}" 
           data-color="${note.color || 'default'}">
        <button class="fs-icon-btn fs-note-pin" data-action="pin">
          ${note.pinned ? '📌' : '📍'}
        </button>
        
        ${note.title ? `<div class="fs-note-title">${escapeHtml(note.title)}</div>` : ''}
        ${checklist || `<div class="fs-note-content">${escapeHtml(stripHtml(note.content || ''))}</div>`}
        ${labels}
        
        <div class="fs-note-actions">
          <button class="fs-icon-btn" data-action="share" title="Share & Link">🔗</button>
          <button class="fs-icon-btn" data-action="archive" title="${note.archived ? 'Unarchive' : 'Archive'}">
            ${note.archived ? '📤' : '📦'}
          </button>
          <button class="fs-icon-btn" data-action="color" title="Change color">🎨</button>
          <button class="fs-icon-btn" data-action="delete" title="${note.deleted ? 'Delete forever' : 'Delete'}">
            🗑️
          </button>
        </div>
      </div>
    `;
  }
  
  // Attach event listeners to note cards
  function attachNoteCardListeners() {
    document.querySelectorAll('.fs-note-card').forEach(card => {
      const noteId = card.dataset.noteId;
      const note = S.notes.find(n => n.id === noteId);
      
      if (!note) return;
      
      // Click to edit
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        openEditModal(note);
      });
      
      // Pin button
      const pinBtn = card.querySelector('[data-action="pin"]');
      if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          note.pinned = !note.pinned;
          saveNote(note);
        });
      }
      
      // Archive button
      const archiveBtn = card.querySelector('[data-action="archive"]');
      if (archiveBtn) {
        archiveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          note.archived = !note.archived;
          saveNote(note);
        });
      }
      
      // Color button
      const colorBtn = card.querySelector('[data-action="color"]');
      if (colorBtn) {
        colorBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          S.currentNote = note;
          S.colorPickerTarget = 'note-card';
          showColorPicker(e.target);
        });
      }
      
      // Share button
      const shareBtn = card.querySelector('[data-action="share"]');
      if (shareBtn) {
        shareBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openShareModal(note);
        });
      }
      
      // Delete button
      const deleteBtn = card.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (note.deleted) {
            if (confirm('Permanently delete this note? This cannot be undone.')) {
              await deleteNotePermanently(note.id);
            }
          } else {
            note.deleted = true;
            note.deletedAt = new Date();
            saveNote(note);
          }
        });
      }
    });
  }
  
  // Open edit modal
  function openEditModal(note) {
    S.currentNote = note;
    document.getElementById('fs-edit-title').value = note.title || '';
    const contentEl = document.getElementById('fs-edit-content');
    contentEl.innerHTML = note.content || '';
    document.getElementById('fs-edit-modal').classList.add('show');

    // Mount Quill on the contenteditable
    if (S._shamarQuill) S._shamarQuill.destroy();
    S._shamarQuill = mountQuill(contentEl, {
      mode:    'note',
      toolbar: document.getElementById('fs-quill-bar'),
    });
    contentEl.focus();
    
    // Update modal background color
    const modalContent = document.querySelector('.fs-modal-content');
    modalContent.style.background = getColorValue(note.color || 'default');
    
    // Update pin button
    const pinBtn = document.getElementById('fs-edit-btn-pin');
    pinBtn.textContent = note.pinned ? '📌' : '📍';
    
    // Update archive button
    const archiveBtn = document.getElementById('fs-edit-btn-archive');
    archiveBtn.textContent = note.archived ? '📤' : '📦';
    archiveBtn.title = note.archived ? 'Unarchive' : 'Archive';
    
    // Update delete button
    const deleteBtn = document.getElementById('fs-edit-btn-delete');
    deleteBtn.textContent = note.deleted ? '⚠️' : '🗑️';
    deleteBtn.title = note.deleted ? 'Delete forever' : 'Delete';
  }
  
  // Hide edit modal
  function hideEditModal() {
    if (S._shamarQuill) { S._shamarQuill.destroy(); S._shamarQuill = null; }
    document.getElementById('fs-edit-modal').classList.remove('show');
    render();
  }
  
  // Open share modal
  function openShareModal(note) {
    const modal = document.getElementById('fs-share-modal');
    const linkInput = document.getElementById('fs-share-link');
    
    // Generate shareable link (proper web URL with query parameter)
    const baseUrl = window.location.origin + window.location.pathname;
    const noteLink = `${baseUrl}?note=${encodeURIComponent(note.id)}`;
    linkInput.value = noteLink;
    
    modal.classList.add('show');
    
    // Copy link button
    document.getElementById('fs-copy-link-btn').onclick = () => {
      linkInput.select();
      document.execCommand('copy');
      
      // Show feedback
      const btn = document.getElementById('fs-copy-link-btn');
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.style.background = '#10b981';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 2000);
    };
    
    // Close button
    document.getElementById('fs-share-close-btn').onclick = () => {
      modal.classList.remove('show');
    };
    
    // Close when clicking outside
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    };
    
    // Add collaborator button (future: integrate with FlockOS user system)
    document.getElementById('fs-add-collaborator-btn').onclick = () => {
      const email = document.getElementById('fs-share-email').value.trim();
      if (email) {
        // TODO: Add collaborator to note (requires FlockOS user integration)
        alert('Collaboration feature coming soon! For now, copy the link and share it in FlockChat.');
        document.getElementById('fs-share-email').value = '';
      }
    };
  }
  
  // Color picker
  function showColorPicker(target) {
    const picker = document.getElementById('fs-color-picker');
    const rect = target.getBoundingClientRect();
    picker.style.top = (rect.bottom + 8) + 'px';
    picker.style.left = rect.left + 'px';
    picker.classList.add('show');
    
    // Close when clicking outside
    setTimeout(() => {
      document.addEventListener('click', hideColorPicker);
    }, 0);
  }
  
  function hideColorPicker() {
    document.getElementById('fs-color-picker').classList.remove('show');
    document.removeEventListener('click', hideColorPicker);
  }
  
  function getColorValue(colorName) {
    const colors = {
      default: '#ffffff',
      red: '#f28b82',
      orange: '#fbbc04',
      yellow: '#fff475',
      green: '#ccff90',
      teal: '#a7ffeb',
      blue: '#cbf0f8',
      darkblue: '#aecbfa',
      purple: '#d7aefb',
      pink: '#fdcfe8',
      brown: '#e6c9a8',
      gray: '#e8eaed'
    };
    return colors[colorName] || colors.default;
  }
  
  // Utilities
  function generateId() {
    return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Check for deep-linked note in URL
  function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const noteId = params.get('note');
    
    if (noteId) {
      console.log('[FlockShamar] Opening deep-linked note:', noteId);
      
      // Wait a bit for notes to load
      setTimeout(() => {
        const note = S.notes.find(n => n.id === decodeURIComponent(noteId));
        if (note) {
          openEditModal(note);
          // Clean URL (remove query params)
          window.history.replaceState({}, '', window.location.pathname);
        } else {
          alert('Note not found. It may have been deleted or you may not have access.');
          window.history.replaceState({}, '', window.location.pathname);
        }
      }, 500);
    }
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  function autoResizeTextarea(e) {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }

  // ── Todos integration (synced with FlockOS via UpperRoom) ──────────
  async function _ensureUpperRoom() {
    if (S.upperRoomReady) return true;
    const UR = window.UpperRoom;
    if (!UR) {
      console.warn('[FlockShamar] UpperRoom not loaded; cannot sync Todos.');
      return false;
    }
    try {
      const cfg = window.FLOCK_FIREBASE_CONFIG || window.FIREBASE_CONFIG || null;
      if (typeof UR.init === 'function') {
        try { await UR.init(cfg); } catch (e) { /* may already be initialized */ }
      }
      if (typeof UR.authenticate === 'function') {
        try { await UR.authenticate(); } catch (e) { /* may already be authed */ }
      }
      S.upperRoomReady = true;
      return true;
    } catch (e) {
      console.warn('[FlockShamar] UpperRoom init failed', e);
      return false;
    }
  }

  function _todoEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _formatTodoDate(d) {
    if (!d) return '';
    try {
      const dt = (d && typeof d.toDate === 'function') ? d.toDate() : new Date(d);
      if (isNaN(dt.getTime())) return '';
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  }

  async function _loadTodos() {
    if (S.todosLoading) return;
    S.todosLoading = true;
    const ok = await _ensureUpperRoom();
    if (!ok) { S.todosLoading = false; _paintTodos([]); return; }
    try {
      const UR = window.UpperRoom;
      let list = [];
      if (typeof UR.myTodos === 'function') {
        list = await UR.myTodos();
      } else if (typeof UR.listTodos === 'function') {
        list = await UR.listTodos({ limit: 200 });
      }
      // Filter out archived; keep done + open so user sees completion state
      S.todos = (list || []).filter(t => (t.status || '') !== 'Archived');
      S.todosLoaded = true;
      _paintTodos(S.todos);
    } catch (e) {
      console.warn('[FlockShamar] loadTodos failed', e);
      _paintTodos([]);
    } finally {
      S.todosLoading = false;
    }
  }

  function _renderTodosView() {
    if (!S.todosLoaded && !S.todosLoading) {
      _loadTodos();
      _paintTodos([], 'Loading todos…');
      return;
    }
    _paintTodos(S.todos);
  }

  function _paintTodos(todos, placeholder) {
    const listEl = document.getElementById('fs-todo-list');
    if (!listEl) return;
    const q = (S.searchQuery || '').toLowerCase();
    const filtered = q
      ? todos.filter(t => (t.title || '').toLowerCase().includes(q) ||
                          (t.description || '').toLowerCase().includes(q))
      : todos;
    if (!filtered.length) {
      listEl.innerHTML = `<div class="fs-todo-empty">${_todoEscape(placeholder || 'No todos yet. Tap + Add Todo to create one.')}</div>`;
      return;
    }
    // Sort: open first by dueDate asc, then done
    filtered.sort((a, b) => {
      const ad = (a.status === 'Done') ? 1 : 0;
      const bd = (b.status === 'Done') ? 1 : 0;
      if (ad !== bd) return ad - bd;
      const av = a.dueDate ? new Date(a.dueDate.toDate ? a.dueDate.toDate() : a.dueDate).getTime() : Infinity;
      const bv = b.dueDate ? new Date(b.dueDate.toDate ? b.dueDate.toDate() : b.dueDate).getTime() : Infinity;
      return av - bv;
    });
    listEl.innerHTML = filtered.map(_renderTodoCard).join('');
    _attachTodoCardListeners();
  }

  function _renderTodoCard(t) {
    const isDone = (t.status || '') === 'Done';
    const pri = (t.priority || 'Medium').toLowerCase();
    const due = _formatTodoDate(t.dueDate);
    const cat = t.category || '';
    const assigned = t.assignedTo || '';
    return `
      <div class="fs-todo-card ${isDone ? 'is-done' : ''}" data-todo-id="${_todoEscape(t.id)}">
        <button class="fs-todo-check" data-todo-complete="${_todoEscape(t.id)}" aria-label="Complete todo" title="Mark complete">${isDone ? '✓' : ''}</button>
        <div class="fs-todo-main">
          <div class="fs-todo-row1">
            <span class="fs-todo-title">${_todoEscape(t.title || '(untitled)')}</span>
            <span class="fs-todo-chip fs-todo-chip--pri-${pri}">${_todoEscape(t.priority || 'Medium')}</span>
            <span class="fs-todo-chip fs-todo-chip--status ${isDone ? 'fs-todo-chip--status-done' : ''}">${_todoEscape(t.status || 'Not Started')}</span>
          </div>
          ${t.description ? `<div class="fs-todo-desc">${_todoEscape(t.description)}</div>` : ''}
          <div class="fs-todo-meta">
            ${due ? `<span>📅 ${_todoEscape(due)}</span>` : ''}
            ${cat ? `<span>🏷️ ${_todoEscape(cat)}</span>` : ''}
            ${assigned ? `<span>👤 ${_todoEscape(assigned)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function _attachTodoCardListeners() {
    document.querySelectorAll('[data-todo-complete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-todo-complete');
        const UR = window.UpperRoom;
        if (!UR || !id) return;
        btn.disabled = true;
        try {
          if (typeof UR.completeTodo === 'function') {
            await UR.completeTodo(id);
          } else if (typeof UR.updateTodo === 'function') {
            await UR.updateTodo(id, { status: 'Done' });
          }
          S.todosLoaded = false;
          await _loadTodos();
        } catch (err) {
          console.warn('[FlockShamar] completeTodo failed', err);
          btn.disabled = false;
        }
      });
    });
  }

  function _wireTodoForm() {
    const addBtn = document.getElementById('fs-todo-add-btn');
    const form = document.getElementById('fs-todo-form');
    const titleEl = document.getElementById('fs-todo-title');
    const dueEl = document.getElementById('fs-todo-due');
    const priEl = document.getElementById('fs-todo-priority');
    const saveBtn = document.getElementById('fs-todo-save-btn');
    const cancelBtn = document.getElementById('fs-todo-cancel-btn');
    if (!addBtn || !form || !saveBtn || !cancelBtn) return;

    addBtn.addEventListener('click', () => {
      form.classList.remove('hidden');
      titleEl && titleEl.focus();
    });
    cancelBtn.addEventListener('click', () => {
      form.classList.add('hidden');
      if (titleEl) titleEl.value = '';
      if (dueEl) dueEl.value = '';
      if (priEl) priEl.value = 'Medium';
    });
    saveBtn.addEventListener('click', async () => {
      const title = (titleEl?.value || '').trim();
      if (!title) { titleEl?.focus(); return; }
      saveBtn.disabled = true;
      const UR = window.UpperRoom;
      const ok = await _ensureUpperRoom();
      if (!ok || !UR || typeof UR.createTodo !== 'function') {
        alert('Unable to sync with FlockOS. Please try again.');
        saveBtn.disabled = false;
        return;
      }
      try {
        const payload = {
          title,
          priority: priEl?.value || 'Medium',
          status: 'Not Started',
          assignedTo: (S.user && S.user.email) || ''
        };
        if (dueEl && dueEl.value) payload.dueDate = new Date(dueEl.value).toISOString();
        await UR.createTodo(payload);
        if (titleEl) titleEl.value = '';
        if (dueEl) dueEl.value = '';
        if (priEl) priEl.value = 'Medium';
        form.classList.add('hidden');
        S.todosLoaded = false;
        await _loadTodos();
      } catch (err) {
        console.warn('[FlockShamar] createTodo failed', err);
        alert('Failed to create todo: ' + (err?.message || err));
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  // Global API
  window.FlockShamar = {
    init,
    createNote: saveQuickNote,
    openNote: openEditModal,
    deleteNote: deleteNotePermanently,
    searchNotes: (query) => {
      S.searchQuery = query.toLowerCase();
      render();
    }
  };
  
  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); _wireTodoForm(); });
  } else {
    init();
    _wireTodoForm();
  }
})();
