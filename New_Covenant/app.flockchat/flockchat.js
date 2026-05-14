/* ══════════════════════════════════════════════════════════════════════════
   FLOCKCHAT V3 — iMessage for Church
   "How good and pleasant it is when God's people live together in unity!"
   — Psalm 133:1

   Philosophy: Radical simplicity. One unified conversation list. Beautiful
   bubbles. Push notifications. No complexity.

   Data Structure:
     conversations/{cid}
       ├── type: 'dm' | 'group' | 'prayer' | 'announcement'
       ├── name, icon, participants[], lastMessage{}, lastActivity, unreadCount
       └── messages/{mid} → { text, author, timestamp, type }

   Features:
     ✓ Unified conversation list (no tabs!)
     ✓ iMessage-style bubbles
     ✓ Real-time updates
     ✓ Push notifications (FCM)
     ✓ Mobile + desktop responsive
     ✓ Auto-scroll to latest
     ✓ Typing indicators (future)

   ══════════════════════════════════════════════════════════════════════════ */

'use strict';

(function() {

  /* ── Constants ─────────────────────────────────────────────────────── */
  const VERSION = 'v3.0.0';
  const MSG_LIMIT = 100;

  /* ── State ─────────────────────────────────────────────────────────── */
  let _db = null;
  let _messaging = null;
  let _me = null;
  let _conversations = [];
  let _activeConvId = null;
  let _messages = [];
  let _convUnsub = null;
  let _msgUnsub = null;

  /* ── DOM Helpers ────────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);
  const _e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const _initials = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('');

  /* ── Boot ───────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => _boot().catch(err => {
    _setBootStatus('Error: ' + (err?.message || err));
    console.error('[FlockChat]', err);
  }));

  async function _boot() {
    console.log('[FlockChat] Booting', VERSION);
    _setBootStatus('Loading…');
    
    // Wait for Nehemiah (auth must be checked before proceeding)
    await _waitFor(() => typeof window.Nehemiah !== 'undefined');
    
    // Check auth FIRST (like FlockStand does)
    const N = window.Nehemiah;
    if (typeof N.isAuthenticated === 'function' && !N.isAuthenticated()) {
      window.location.replace('app.flockchat/index.html');
      return;
    }
    
    // Get session
    _me = N.getSession ? N.getSession() : null;
    if (!_me) {
      window.location.replace('app.flockchat/index.html');
      return;
    }
    
    // Wait for Firebase
    await _waitFor(() => typeof window.firebase !== 'undefined');

    _setBootStatus('Connecting…');
    
    // Init Firestore
    try {
      _db = firebase.firestore();
    } catch (err) {
      _setBootStatus('Failed to connect. Please refresh.');
      throw err;
    }

    // Init FCM (push notifications)
    _initFCM().catch(err => console.warn('[FlockChat] FCM init failed:', err));

    // Enrich user doc
    await _enrichUser();

    // Seed default conversations
    await _seedConversations();

    _hideBoot();
    _mountApp();
  }

  function _setBootStatus(msg) {
    const el = $('fc-boot-status');
    if (el) el.textContent = msg;
  }

  function _hideBoot() {
    const b = $('fc-boot');
    if (!b) return;
    b.classList.add('fade-out');
    setTimeout(() => { b.style.display = 'none'; }, 350);
  }

  async function _waitFor(condition, timeout = 10000) {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > timeout) throw new Error('Timeout waiting for condition');
      await new Promise(r => setTimeout(r, 100));
    }
  }

  /* ── User Setup ─────────────────────────────────────────────────────── */
  async function _enrichUser() {
    if (!_db || !_me) return;
    const ref = _db.collection('users').doc(_me.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        displayName: _me.displayName || _me.email,
        email: _me.email,
        role: _me.role || 'volunteer',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const d = snap.data();
      if (d.role && d.role !== _me.role) _me.role = d.role;
      if (d.displayName) _me.displayName = d.displayName;
      ref.update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    }
  }

  /* ── FCM Push Notifications ─────────────────────────────────────────── */
  async function _initFCM() {
    if (!firebase.messaging || !firebase.messaging.isSupported || !firebase.messaging.isSupported()) {
      console.log('[FlockChat] FCM not supported');
      return;
    }

    _messaging = firebase.messaging();

    // Check for VAPID key configuration
    const vapidKey = (typeof window !== 'undefined') ? window.FLOCK_VAPID_KEY : null;
    if (!vapidKey) {
      console.log('[FlockChat] FCM VAPID key not configured (window.FLOCK_VAPID_KEY)');
      return;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FlockChat] Notification permission denied');
      return;
    }

    // Get token
    const token = await _messaging.getToken({ vapidKey });
    console.log('[FlockChat] FCM token:', token);

    // Save token to user doc
    if (_me && token) {
      await _db.collection('users').doc(_me.uid).update({
        fcmToken: token,
        fcmUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(err => console.error('[FlockChat] Failed to save FCM token:', err));
    }

    // Handle foreground messages
    _messaging.onMessage(payload => {
      console.log('[FlockChat] Foreground message:', payload);
      const { notification } = payload;
      if (notification) {
        _toast(notification.title + ': ' + notification.body);
      }
    });
  }

  /* ── Seed Default Conversations ─────────────────────────────────────── */
  async function _seedConversations() {
    const snap = await _db.collection('conversations').limit(1).get();
    if (!snap.empty) return; // Already seeded

    console.log('[FlockChat] Seeding default conversations');

    // 1. Church Announcements
    await _db.collection('conversations').add({
      type: 'announcement',
      name: 'Church Announcements',
      icon: '📢',
      participants: [_me.uid],
      lastMessage: {
        text: 'Welcome to FlockChat! This is where pastors share important updates.',
        author: 'system',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      },
      lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
      unreadCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: _me.uid
    });

    // 2. Prayer Chain
    await _db.collection('conversations').add({
      type: 'prayer',
      name: 'Prayer Chain',
      icon: '🙏',
      participants: [_me.uid],
      lastMessage: {
        text: 'Share your prayer requests here. We\'re praying together!',
        author: 'system',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      },
      lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
      unreadCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: _me.uid
    });

    // 3. General Chat
    await _db.collection('conversations').add({
      type: 'group',
      name: 'General Chat',
      icon: '👥',
      participants: [_me.uid],
      lastMessage: {
        text: 'This is the place for general conversation and fellowship!',
        author: 'system',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      },
      lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
      unreadCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: _me.uid
    });
  }

  /* ── Mount App ──────────────────────────────────────────────────────── */
  function _mountApp() {
    const app = $('fc-app');
    if (app) app.removeAttribute('hidden');

    _bindUI();
    _loadConversations();
  }

  /* ── UI Binding ──────────────────────────────────────────────────────── */
  function _bindUI() {
    // Search
    const search = $('fc-search');
    if (search) {
      search.addEventListener('input', () => _filterConversations(search.value));
    }

    // New conversation button
    const newBtn = $('fc-new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => _openNewConversationModal());
    }

    // Modal close
    const modalClose = $('fc-modal-close');
    const modalBackdrop = $('fc-new-modal');
    if (modalClose) {
      modalClose.addEventListener('click', () => _closeNewConversationModal());
    }
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) _closeNewConversationModal();
      });
    }

    // User search in modal
    const userSearch = $('fc-user-search');
    if (userSearch) {
      userSearch.addEventListener('input', () => _filterUsers(userSearch.value));
    }

    // Composer input
    const input = $('fc-input');
    const sendBtn = $('fc-send');
    if (input && sendBtn) {
      input.addEventListener('input', () => {
        sendBtn.disabled = !input.value.trim();
        _autoResize(input);
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          _sendMessage();
        }
      });
      sendBtn.addEventListener('click', () => _sendMessage());
    }

    // Back button (mobile)
    const backBtn = $('fc-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        const thread = $('fc-thread');
        if (thread) thread.classList.remove('active');
        _activeConvId = null;
      });
    }
  }

  function _autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  /* ── New Conversation Modal ──────────────────────────────────────────── */
  let _allUsers = [];

  async function _openNewConversationModal() {
    const modal = $('fc-new-modal');
    if (!modal) return;

    // Load users if not already loaded
    if (_allUsers.length === 0) {
      await _loadUsers();
    }

    // Render user list
    _renderUsers(_allUsers);

    // Show modal
    modal.removeAttribute('hidden');
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });

    // Focus search
    const search = $('fc-user-search');
    if (search) {
      search.value = '';
      search.focus();
    }
  }

  function _closeNewConversationModal() {
    const modal = $('fc-new-modal');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => {
      modal.setAttribute('hidden', '');
    }, 200);
  }

  async function _loadUsers() {
    try {
      const snap = await _db.collection('users').orderBy('displayName').get();
      _allUsers = [];
      console.log('[FlockChat] Loading users. Current user UID:', _me.uid);
      snap.forEach(doc => {
        const u = doc.data();
        u.uid = doc.id;
        console.log('[FlockChat] User doc:', u.uid, u.displayName, u.email);
        // Don't include self
        if (u.uid !== _me.uid) {
          _allUsers.push(u);
        }
      });
      console.log('[FlockChat] Loaded', _allUsers.length, 'other users (excluding self)');
      
      // If database only has current user, show helpful message
      if (_allUsers.length === 0) {
        _toast('No other members found. Invite team members to get started!', 'info');
      }
    } catch (err) {
      console.error('[FlockChat] Failed to load users:', err);
      _toast('Failed to load members', 'error');
    }
  }

  function _renderUsers(users) {
    const list = $('fc-user-list');
    if (!list) return;

    if (users.length === 0) {
      list.innerHTML = `
        <div class="fc-empty">
          <div class="fc-empty-icon">👥</div>
          <div class="fc-empty-text">No members found</div>
        </div>
      `;
      return;
    }

    list.innerHTML = users.map(u => {
      const name = u.displayName || u.email || 'Unknown';
      const initials = _initials(name);
      const email = u.email || '';
      // Escape quotes for onclick attribute
      const safeName = name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return `
        <div class="fc-user-item" data-uid="${u.uid}" data-name="${_e(name)}" onclick="window._createDirectMessage('${u.uid}', '${safeName}')">
          <div class="fc-user-avatar">${initials}</div>
          <div class="fc-user-info">
            <div class="fc-user-name">${_e(name)}</div>
            <div class="fc-user-email">${_e(email)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function _filterUsers(query) {
    const q = query.toLowerCase();
    const filtered = _allUsers.filter(u => {
      const name = (u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
    _renderUsers(filtered);
  }

  window._createDirectMessage = async function(otherUid, otherName) {
    _closeNewConversationModal();

    console.log('[FlockChat] Creating DM:', { me: _me.uid, other: otherUid, name: otherName });

    // Validate
    if (!otherUid || otherUid === _me.uid) {
      _toast('Cannot create conversation with yourself', 'error');
      return;
    }

    try {
      // Check if DM already exists
      const existingSnap = await _db.collection('conversations')
        .where('type', '==', 'dm')
        .where('participants', 'array-contains', _me.uid)
        .get();

      let existingConv = null;
      existingSnap.forEach(doc => {
        const d = doc.data();
        if (d.participants && d.participants.includes(otherUid)) {
          existingConv = { id: doc.id, ...d };
        }
      });

      if (existingConv) {
        console.log('[FlockChat] Found existing DM:', existingConv.id);
        window._openConversation(existingConv.id);
        return;
      }

      // Create new DM
      console.log('[FlockChat] Creating new DM conversation...');
      const docRef = await _db.collection('conversations').add({
        type: 'dm',
        name: otherName,
        icon: _initials(otherName),
        participants: [_me.uid, otherUid],
        lastMessage: {
          text: '',
          author: '',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        },
        lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
        unreadCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: _me.uid
      });

      console.log('[FlockChat] DM created:', docRef.id);
      // Open new conversation
      window._openConversation(docRef.id);
      _toast('Conversation created!', 'success');
    } catch (err) {
      console.error('[FlockChat] Failed to create DM:', err);
      console.error('[FlockChat] Error details:', {
        code: err.code,
        message: err.message,
        stack: err.stack
      });
      _toast('Failed to create conversation: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  /* ── Load Conversations ──────────────────────────────────────────────── */
  function _loadConversations() {
    if (_convUnsub) _convUnsub();

    _convUnsub = _db.collection('conversations')
      .where('participants', 'array-contains', _me.uid)
      .orderBy('lastActivity', 'desc')
      .onSnapshot(snap => {
        _conversations = [];
        snap.forEach(doc => {
          const d = doc.data();
          d.id = doc.id;
          _conversations.push(d);
        });
        _renderConversations();
      }, err => {
        console.error('[FlockChat] Failed to load conversations:', err);
        _toast('Failed to load conversations', 'error');
      });
  }

  function _filterConversations(query) {
    const list = $('fc-list');
    if (!list) return;
    const q = query.toLowerCase();
    $$('.fc-conv-item').forEach(item => {
      const name = item.dataset.name?.toLowerCase() || '';
      item.style.display = name.includes(q) ? '' : 'none';
    });
  }

  function _renderConversations() {
    const list = $('fc-list');
    if (!list) return;

    if (_conversations.length === 0) {
      list.innerHTML = `
        <div class="fc-empty">
          <div class="fc-empty-icon">💬</div>
          <div class="fc-empty-title">No conversations yet</div>
          <div class="fc-empty-text">Start a conversation to get started!</div>
        </div>
      `;
      return;
    }

    list.innerHTML = _conversations.map(c => {
      const isActive = c.id === _activeConvId;
      const unread = c.unreadCount || 0;
      const time = _formatTime(c.lastActivity);
      const preview = c.lastMessage?.text || 'No messages yet';
      
      let iconClass = 'fc-conv-icon';
      if (c.type === 'prayer') iconClass += ' prayer';
      if (c.type === 'announcement') iconClass += ' announcement';
      if (c.type === 'dm') iconClass += ' dm';

      return `
        <div class="fc-conv-item ${isActive ? 'active' : ''} ${unread > 0 ? 'unread' : ''}"
             data-id="${c.id}"
             data-name="${_e(c.name)}"
             onclick="window._openConversation('${c.id}')">
          <div class="${iconClass}">${_e(c.icon || '👥')}</div>
          <div class="fc-conv-content">
            <div class="fc-conv-header">
              <div class="fc-conv-name">${_e(c.name)}</div>
              <div class="fc-conv-time">${time}</div>
            </div>
            <div class="fc-conv-preview">${_e(preview)}</div>
          </div>
          ${unread > 0 ? `<div class="fc-conv-badge">${unread}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  /* ── Open Conversation ───────────────────────────────────────────────── */
  window._openConversation = function(convId) {
    _activeConvId = convId;
    const conv = _conversations.find(c => c.id === convId);
    if (!conv) return;

    // Mark as read
    _markAsRead(convId);

    // Update UI
    _renderConversations();
    
    // Update thread header
    const icon = $('fc-thread-icon');
    const name = $('fc-thread-name');
    const meta = $('fc-thread-meta');
    if (icon) icon.textContent = conv.icon || '👥';
    if (name) name.textContent = conv.name;
    if (meta) {
      const count = conv.participants?.length || 0;
      meta.textContent = conv.type === 'dm' ? 'Direct Message' : `${count} ${count === 1 ? 'member' : 'members'}`;
    }

    // Show thread pane (mobile)
    const thread = $('fc-thread');
    if (thread) thread.classList.add('active');

    // Load messages
    _loadMessages(convId);
  };

  function _markAsRead(convId) {
    _db.collection('conversations').doc(convId).update({
      unreadCount: 0
    }).catch(() => {});
  }

  /* ── Load Messages ───────────────────────────────────────────────────── */
  function _loadMessages(convId) {
    if (_msgUnsub) _msgUnsub();

    const msgContainer = $('fc-messages');
    if (!msgContainer) return;

    msgContainer.innerHTML = '<div class="fc-loading"><div class="fc-spinner"></div></div>';

    _msgUnsub = _db.collection('conversations').doc(convId).collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(MSG_LIMIT)
      .onSnapshot(snap => {
        _messages = [];
        snap.forEach(doc => {
          const d = doc.data();
          d.id = doc.id;
          _messages.push(d);
        });
        _renderMessages();
        _scrollToBottom();
      }, err => {
        console.error('[FlockChat] Failed to load messages:', err);
        msgContainer.innerHTML = `
          <div class="fc-empty">
            <div class="fc-empty-icon">⚠️</div>
            <div class="fc-empty-title">Failed to load messages</div>
            <div class="fc-empty-text">Please try again.</div>
          </div>
        `;
      });
  }

  function _renderMessages() {
    const msgContainer = $('fc-messages');
    if (!msgContainer) return;

    if (_messages.length === 0) {
      msgContainer.innerHTML = `
        <div class="fc-empty">
          <div class="fc-empty-icon">💬</div>
          <div class="fc-empty-title">No messages yet</div>
          <div class="fc-empty-text">Start the conversation!</div>
        </div>
      `;
      return;
    }

    msgContainer.innerHTML = _messages.map(m => {
      const isMine = m.author === _me.uid;
      const dir = isMine ? 'sent' : 'received';
      const time = _formatTime(m.timestamp);
      
      // Get author info
      const authorName = m.authorName || 'Unknown';
      const authorInitials = _initials(authorName);

      // Special card types
      if (m.type === 'prayer') {
        return `
          <div class="fc-card">
            <div class="fc-card-header">
              <span class="fc-card-icon">🙏</span>
              <span class="fc-card-author">${_e(authorName)}</span>
              <span class="fc-card-time">${time}</span>
            </div>
            <div class="fc-card-text">${_e(m.text)}</div>
            <button class="fc-card-btn" onclick="window._prayFor('${m.id}')">
              🙏 I'm Praying ${m.prayerCount > 0 ? `(${m.prayerCount})` : ''}
            </button>
          </div>
        `;
      }

      if (m.type === 'announcement') {
        return `
          <div class="fc-card announcement">
            <div class="fc-card-header">
              <span class="fc-card-icon">📢</span>
              <span class="fc-card-author">${_e(authorName)}</span>
              <span class="fc-card-time">${time}</span>
            </div>
            <div class="fc-card-text">${_e(m.text)}</div>
          </div>
        `;
      }

      // Regular message bubble
      return `
        <div class="fc-message ${dir}">
          ${!isMine ? `<div class="fc-avatar">${authorInitials}</div>` : ''}
          <div class="fc-bubble">
            ${!isMine ? `<div class="fc-message-author">${_e(authorName)}</div>` : ''}
            <div class="fc-message-text">${_e(m.text)}</div>
            <div class="fc-message-time">${time}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function _scrollToBottom() {
    const msgContainer = $('fc-messages');
    if (!msgContainer) return;
    setTimeout(() => {
      msgContainer.scrollTop = msgContainer.scrollHeight;
    }, 100);
  }

  /* ── Send Message ────────────────────────────────────────────────────── */
  async function _sendMessage() {
    if (!_activeConvId) return;

    const input = $('fc-input');
    const sendBtn = $('fc-send');
    if (!input || !sendBtn) return;

    const text = input.value.trim();
    if (!text) return;

    // Disable while sending
    input.disabled = true;
    sendBtn.disabled = true;

    try {
      const conv = _conversations.find(c => c.id === _activeConvId);
      const msgType = conv?.type === 'prayer' ? 'prayer' : conv?.type === 'announcement' ? 'announcement' : 'text';

      await _db.collection('conversations').doc(_activeConvId).collection('messages').add({
        text,
        author: _me.uid,
        authorName: _me.displayName || _me.email,
        type: msgType,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        prayerCount: msgType === 'prayer' ? 0 : null
      });

      // Update conversation lastMessage
      await _db.collection('conversations').doc(_activeConvId).update({
        lastMessage: {
          text,
          author: _me.uid,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        },
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Clear input
      input.value = '';
      input.style.height = 'auto';
    } catch (err) {
      console.error('[FlockChat] Failed to send message:', err);
      _toast('Failed to send message', 'error');
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  /* ── Prayer Action ───────────────────────────────────────────────────── */
  window._prayFor = async function(msgId) {
    if (!_activeConvId) return;
    try {
      const msgRef = _db.collection('conversations').doc(_activeConvId).collection('messages').doc(msgId);
      await msgRef.update({
        prayerCount: firebase.firestore.FieldValue.increment(1)
      });
      _toast('🙏 Added to your prayers', 'success');
    } catch (err) {
      console.error('[FlockChat] Failed to update prayer count:', err);
      _toast('Failed to record prayer', 'error');
    }
  };

  /* ── Utilities ────────────────────────────────────────────────────────── */
  function _formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    
    // Less than 1 hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    }
    
    // Today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    
    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // This week
    if (diff < 604800000) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    
    // Older
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function _toast(msg, type = '') {
    const host = $('fc-toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'fc-toast' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3800);
  }

  console.log('[FlockChat]', VERSION, 'loaded');

})();
