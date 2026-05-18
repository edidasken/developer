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
  const ANNOUNCEMENTS_ID = 'announcements';

  /* ── State ─────────────────────────────────────────────────────────── */
  let _db = null;
  let _messaging = null;
  let _me = null;
  let _conversations = [];
  let _activeConvId = null;
  let _messages = [];
  let _convUnsub = null;
  let _msgUnsub = null;
  let _showArchived = false;
  let _openMenuConvId = null;

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
    
    // Wait for Firebase + UpperRoom (Firebase Auth wrapper)
    await _waitFor(() => typeof window.firebase !== 'undefined' && typeof window.UpperRoom !== 'undefined');

    _setBootStatus('Connecting…');

    // Authenticate to Firebase via UpperRoom (custom token from GAS).
    // Firestore rules require request.auth != null — without this every
    // read fails with "Missing or insufficient permissions."
    try {
      await window.UpperRoom.init(window.FLOCK_FIREBASE_CONFIG);
      await window.UpperRoom.authenticate();
    } catch (err) {
      _setBootStatus('Sign-in failed. Please refresh.');
      throw err;
    }

    // Init Firestore (after auth so reads succeed)
    try {
      _db = firebase.firestore();
    } catch (err) {
      _setBootStatus('Failed to connect. Please refresh.');
      throw err;
    }

    // Prefer Firebase Auth uid for Firestore writes (matches request.auth.uid)
    try {
      const fbUser = firebase.auth().currentUser;
      if (fbUser && fbUser.uid) _me.uid = fbUser.uid;
    } catch (_) {}

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
    // Mark this person's member doc as FlockChat-active so OTHER members
    // know we can be reached in-app (vs SMS fallback).
    _markMemberFlockchatActive().catch(err => console.warn('[FlockChat] flockchatActive flag failed:', err));
  }

  async function _markMemberFlockchatActive() {
    const myEmail = (_me?.email || '').toLowerCase();
    if (!myEmail || !_db) return;
    // Find by primaryEmail first, then email.
    const tries = [
      _db.collection('members').where('primaryEmail', '==', myEmail).limit(1),
      _db.collection('members').where('email',        '==', myEmail).limit(1)
    ];
    for (const q of tries) {
      try {
        const snap = await q.get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          await doc.ref.update({
            flockchatActive: true,
            flockchatLastSeen: firebase.firestore.FieldValue.serverTimestamp()
          });
          return;
        }
      } catch (_) { /* try next */ }
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
    // (Church Announcements is NOT seeded — it's a single shared doc at
    //  conversations/announcements, mirrored from the_announcements view.
    //  FlockChat injects it as a static entry in _renderConversations.)

    // Prayer Chain is per-user (a private funnel into the church Prayer
    // Chain). Make sure THIS user has one — independently of whether other
    // users have already seeded their own.
    try {
      const mine = await _db.collection('conversations')
        .where('type', '==', 'prayer')
        .where('participants', 'array-contains', _me.uid)
        .limit(1).get();
      if (mine.empty) {
        console.log('[FlockChat] Seeding Prayer Chain for', _me.uid);
        await _db.collection('conversations').add({
          type: 'prayer',
          name: 'Prayer Chain',
          icon: '🙏',
          participants: [_me.uid],
          lastMessage: {
            text: 'Type a prayer request below — it goes straight to the church Prayer Chain.',
            author: 'system',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          },
          lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
          unreadCount: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: _me.uid
        });
      }
    } catch (err) {
      console.warn('[FlockChat] Prayer Chain seed failed:', err);
    }
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
      // Source of truth = The Fold (members collection), NOT the chat-only
      // `users` collection (which accumulates duplicates from every sign-in).
      const snap = await _db.collection('members').orderBy('lastName').get();
      const myEmail = (_me.email || '').toLowerCase();
      const byEmail = new Map();
      snap.forEach(doc => {
        const m = doc.data() || {};
        m.uid = doc.id;
        // Filter out archived/inactive
        const ms = String(m.membershipStatus || '').toLowerCase();
        const st = String(m.status || '').toLowerCase();
        if (ms === 'archived' || st === 'inactive' || st === 'archived') return;
        // Normalize display fields for the renderer
        const first = m.firstName || '';
        const last  = m.lastName  || '';
        const name  = m.displayName || m.name || (first + ' ' + last).trim() || m.primaryEmail || m.email || 'Unknown';
        const email = (m.primaryEmail || m.email || '').toLowerCase();
        if (!email && !name) return;
        // Exclude self by email (uid won't match — Auth uid vs member doc id)
        if (email && email === myEmail) return;
        // Dedupe by email (fall back to uid when email missing)
        const key = email || m.uid;
        if (byEmail.has(key)) return;
        const phoneRaw = m.primaryPhone || m.mobile || m.phone || m.phoneNumber || '';
        const phone = String(phoneRaw).replace(/[^\d+]/g, '');
        byEmail.set(key, {
          uid: m.uid,
          displayName: name,
          email: email,
          phone: phone,
          flockchatActive: !!m.flockchatActive,
          role: m.role || m.memberType || 'member'
        });
      });
      _allUsers = Array.from(byEmail.values())
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      console.log('[FlockChat] Loaded', _allUsers.length, 'members from The Fold');
      if (_allUsers.length === 0) {
        _toast('No other members found in The Fold yet.', 'info');
      }
    } catch (err) {
      console.error('[FlockChat] Failed to load members:', err);
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
      const phone = u.phone || '';
      const onFC  = !!u.flockchatActive;
      // Escape quotes for onclick attribute
      const safeName = name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      // Route: FlockChat user → in-app DM. Otherwise if we have a phone → SMS.
      let onclick, badge, sub;
      if (onFC) {
        onclick = `window._createDirectMessage('${u.uid}', '${safeName}')`;
        badge = '';
        sub = email;
      } else if (phone) {
        onclick = `window._startSmsConversation('${u.uid}', '${safeName}', '${phone}')`;
        badge = '<span class="fc-user-badge sms" title="Not on FlockChat — will text via SMS">SMS</span>';
        sub = phone;
      } else {
        onclick = `window._toast && window._toast('No phone or FlockChat account on file for ' + ${JSON.stringify(name)}, 'info')`;
        badge = '<span class="fc-user-badge muted" title="No phone on file">No contact</span>';
        sub = email || 'No contact info';
      }
      return `
        <div class="fc-user-item ${onFC ? '' : 'sms'}" data-uid="${u.uid}" data-name="${_e(name)}" onclick="${onclick}">
          <div class="fc-user-avatar">${initials}</div>
          <div class="fc-user-info">
            <div class="fc-user-name">${_e(name)} ${badge}</div>
            <div class="fc-user-email">${_e(sub)}</div>
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

  /* ── SMS Fallback (member not on FlockChat) ──────────────────────────── */
  function _smsHref(phone, body) {
    // sms:NUMBER?&body=... works on both iOS and Android.
    const num = String(phone || '').replace(/[^\d+]/g, '');
    const txt = body ? ('?&body=' + encodeURIComponent(body)) : '';
    return 'sms:' + num + txt;
  }

  function _launchSms(phone, body) {
    try { window.location.href = _smsHref(phone, body); } catch (_) {}
  }

  window._startSmsConversation = async function(memberUid, otherName, phone) {
    _closeNewConversationModal();
    if (!phone) { _toast('No phone number on file', 'error'); return; }

    try {
      // Find existing SMS conversation for this phone (so it logs to recents
      // instead of creating a new card every tap).
      const existingSnap = await _db.collection('conversations')
        .where('type', '==', 'sms')
        .where('participants', 'array-contains', _me.uid)
        .get();

      let convId = null;
      existingSnap.forEach(doc => {
        const d = doc.data();
        if (d.smsPhone === phone) convId = doc.id;
      });

      if (!convId) {
        const docRef = await _db.collection('conversations').add({
          type: 'sms',
          name: otherName,
          icon: '💬',
          smsPhone: phone,
          smsMemberUid: memberUid,
          participants: [_me.uid],
          lastMessage: {
            text: 'Texts via SMS — not in FlockChat',
            author: 'system',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          },
          lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
          unreadCount: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: _me.uid
        });
        convId = docRef.id;
      } else {
        // Bump lastActivity so it sorts to the top of recents.
        await _db.collection('conversations').doc(convId).update({
          lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }

      // Open the thread — user types in the FlockChat composer; pressing
      // Send packages the message and hands it off to the native SMS app.
      window._openConversation(convId);
    } catch (err) {
      console.error('[FlockChat] Failed to start SMS conversation:', err);
      _toast('Failed to start SMS: ' + (err.message || 'Unknown'), 'error');
    }
  };

  /* ── Load Conversations ──────────────────────────────────────────────── */
  function _loadConversations() {
    if (_convUnsub) _convUnsub();

    // Render the static pinned threads (Church Announcements) immediately
    // so the list never looks empty — even if the conversations query is
    // still loading or fails outright.
    _conversations = [];
    _injectAnnouncements();
    _renderConversations();

    _convUnsub = _db.collection('conversations')
      .where('participants', 'array-contains', _me.uid)
      .orderBy('lastActivity', 'desc')
      .onSnapshot(snap => {
        _conversations = [];
        snap.forEach(doc => {
          const d = doc.data();
          d.id = doc.id;
          // The shared announcements doc is injected separately (no
          // participants array → wouldn't match this query anyway, but
          // belt-and-suspenders).
          if (d.id === ANNOUNCEMENTS_ID) return;
          // Per-user soft delete: if I removed this conversation from my
          // view, never show it again on this account.
          if (Array.isArray(d.deletedBy) && d.deletedBy.includes(_me.uid)) return;
          _conversations.push(d);
        });
        _injectAnnouncements();
        _renderConversations();
      }, err => {
        console.error('[FlockChat] Failed to load conversations:', err);
        _toast('Failed to load conversations', 'error');
        // Even on error, keep statics visible so the user isn't stranded.
        _conversations = [];
        _injectAnnouncements();
        _renderConversations();
      });
  }

  // Listen to the shared announcements doc so the static thread's preview
  // + sort key stay fresh when leadership posts.
  let _annDocUnsub = null;
  let _annLastSnippet = '';
  let _annLastAt = null;

  function _injectAnnouncements() {
    const entry = {
      id: ANNOUNCEMENTS_ID,
      type: 'announcement',
      name: 'Church Announcements',
      icon: '📢',
      participants: [],
      lastMessage: { text: _annLastSnippet || 'Tap to view church-wide announcements.', author: '', timestamp: _annLastAt },
      lastActivity: _annLastAt,
      unreadCount: 0,
      _static: true
    };
    _conversations.unshift(entry);

    if (_annDocUnsub) return; // already listening
    try {
      _annDocUnsub = _db.collection('conversations').doc(ANNOUNCEMENTS_ID)
        .onSnapshot(doc => {
          const d = doc.exists ? doc.data() : null;
          _annLastSnippet = (d && d.lastSnippet) || '';
          _annLastAt = (d && d.lastMessageAt) || null;
          const e = _conversations.find(c => c.id === ANNOUNCEMENTS_ID);
          if (e) {
            e.lastMessage = { text: _annLastSnippet || 'Tap to view church-wide announcements.', author: '', timestamp: _annLastAt };
            e.lastActivity = _annLastAt;
            _renderConversations();
          }
        }, err => console.warn('[FlockChat] announcements doc listen failed:', err));
    } catch (err) {
      console.warn('[FlockChat] announcements doc listen setup failed:', err);
    }
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

  function _isStaticConv(c) {
    return c && (c._static === true || c.type === 'announcement' || c.type === 'prayer' || c.id === ANNOUNCEMENTS_ID);
  }
  function _isArchivedForMe(c) {
    return c && Array.isArray(c.archivedBy) && c.archivedBy.includes(_me?.uid);
  }

  function _renderConversations() {
    const list = $('fc-list');
    if (!list) return;

    // Split into visible vs archived (static threads always visible).
    const archivedCount = _conversations.filter(c => !_isStaticConv(c) && _isArchivedForMe(c)).length;
    const visible = _conversations.filter(c => {
      if (_isStaticConv(c)) return true;
      const archived = _isArchivedForMe(c);
      return _showArchived ? archived : !archived;
    });

    if (visible.length === 0 && archivedCount === 0) {
      list.innerHTML = `
        <div class="fc-empty">
          <div class="fc-empty-icon">💬</div>
          <div class="fc-empty-title">No conversations yet</div>
          <div class="fc-empty-text">Start a conversation to get started!</div>
        </div>
      `;
      return;
    }

    // ── Pinned section (Church Announcements + Prayer Chain) ──────────────
    const pinned  = visible.filter(c => c.type === 'announcement' || c.type === 'prayer');
    const regular = visible.filter(c => c.type !== 'announcement' && c.type !== 'prayer');

    let pinnedHtml = '';
    if (pinned.length > 0) {
      const bubbles = pinned.map(c => {
        const isActive  = c.id === _activeConvId;
        const unread    = c.unreadCount || 0;
        const typeClass = c.type === 'announcement' ? 'announcement' : 'prayer';
        const badge     = unread > 0
          ? `<div class="fc-pinned-badge">${unread > 9 ? '9+' : unread}</div>` : '';
        return `
          <div class="fc-pinned-item ${isActive ? 'active' : ''}"
               data-id="${c.id}"
               onclick="window._openConversation('${c.id}')">
            <div class="fc-pinned-bubble ${typeClass}">
              ${_e(c.icon || '💬')}
              ${badge}
            </div>
            <div class="fc-pinned-name">${_e(c.name)}</div>
          </div>`;
      }).join('');
      pinnedHtml = `
        <div class="fc-pinned-section">
          <div class="fc-pinned-header">
            <span class="fc-pinned-header-icon">📌</span>
            <span class="fc-pinned-header-label">Pinned</span>
          </div>
          <div class="fc-pinned-grid">${bubbles}</div>
        </div>`;
    }

    // ── Regular conversation rows ─────────────────────────────────────────
    const rows = regular.map(c => {
      const isActive = c.id === _activeConvId;
      const unread = c.unreadCount || 0;
      const time = _formatTime(c.lastActivity);
      const preview = c.lastMessage?.text || 'No messages yet';
      const isStatic = _isStaticConv(c);
      const menuOpen = _openMenuConvId === c.id;

      let iconClass = 'fc-conv-icon';
      if (c.type === 'prayer') iconClass += ' prayer';
      if (c.type === 'announcement') iconClass += ' announcement';
      if (c.type === 'dm') iconClass += ' dm';
      if (c.type === 'sms') iconClass += ' sms';

      const actionsBtn = isStatic ? '' : `
          <button class="fc-conv-actions-btn ${menuOpen ? 'open' : ''}"
                  title="More"
                  onclick="event.stopPropagation(); window._toggleConvMenu('${c.id}')">⋯</button>
          ${menuOpen ? `
            <div class="fc-conv-menu" onclick="event.stopPropagation()">
              <button onclick="window._archiveConv('${c.id}')">${_isArchivedForMe(c) ? 'Unarchive' : 'Archive'}</button>
              <button class="danger" onclick="window._deleteConv('${c.id}')">Delete</button>
            </div>
          ` : ''}
      `;

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
          ${actionsBtn}
        </div>
      `;
    }).join('');

    let footer = '';
    if (_showArchived) {
      footer = `<button class="fc-archive-toggle" onclick="window._toggleArchivedView()">← Back to active</button>`;
    } else if (archivedCount > 0) {
      footer = `<button class="fc-archive-toggle" onclick="window._toggleArchivedView()">Show archived (${archivedCount})</button>`;
    }

    list.innerHTML = pinnedHtml + rows + footer;
  }

  // Close menu when clicking elsewhere
  document.addEventListener('click', () => {
    if (_openMenuConvId) {
      _openMenuConvId = null;
      _renderConversations();
    }
  });

  window._toggleConvMenu = function(convId) {
    _openMenuConvId = (_openMenuConvId === convId) ? null : convId;
    _renderConversations();
  };

  window._toggleArchivedView = function() {
    _showArchived = !_showArchived;
    _openMenuConvId = null;
    _renderConversations();
  };

  window._archiveConv = async function(convId) {
    _openMenuConvId = null;
    const conv = _conversations.find(c => c.id === convId);
    if (!conv || _isStaticConv(conv)) return;
    const archived = _isArchivedForMe(conv);
    try {
      const op = archived
        ? firebase.firestore.FieldValue.arrayRemove(_me.uid)
        : firebase.firestore.FieldValue.arrayUnion(_me.uid);
      await _db.collection('conversations').doc(convId).update({ archivedBy: op });
      _toast(archived ? 'Conversation unarchived' : 'Conversation archived', 'success');
    } catch (err) {
      console.error('[FlockChat] archive failed:', err);
      _toast('Failed to update conversation', 'error');
    }
  };

  window._deleteConv = async function(convId) {
    _openMenuConvId = null;
    const conv = _conversations.find(c => c.id === convId);
    if (!conv || _isStaticConv(conv)) return;
    if (!confirm(`Delete "${conv.name}" from your messages?\n\nThe conversation will be removed from your view. Other participants keep their copy.`)) return;

    try {
      // Soft-delete for me: drop from participants + record in deletedBy.
      await _db.collection('conversations').doc(convId).update({
        participants: firebase.firestore.FieldValue.arrayRemove(_me.uid),
        deletedBy:    firebase.firestore.FieldValue.arrayUnion(_me.uid)
      });

      // If everyone has deleted it, hard-delete the doc + its messages.
      const fresh = await _db.collection('conversations').doc(convId).get();
      const data = fresh.exists ? fresh.data() : null;
      if (data && Array.isArray(data.participants) && data.participants.length === 0) {
        try {
          const msgs = await _db.collection('conversations').doc(convId).collection('messages').get();
          const batch = _db.batch();
          msgs.forEach(m => batch.delete(m.ref));
          batch.delete(_db.collection('conversations').doc(convId));
          await batch.commit();
        } catch (e) {
          // Best-effort hard delete; soft delete already succeeded.
          console.warn('[FlockChat] hard-delete cleanup failed:', e);
        }
      }

      // If we were viewing it, clear the thread.
      if (_activeConvId === convId) {
        _activeConvId = null;
        if (_msgUnsub) { _msgUnsub(); _msgUnsub = null; }
        const thread = $('fc-thread');
        if (thread) thread.classList.remove('active');
        const name = $('fc-thread-name'); if (name) name.textContent = 'Select a conversation';
        const meta = $('fc-thread-meta'); if (meta) meta.textContent = '';
        const msgContainer = $('fc-messages');
        if (msgContainer) msgContainer.innerHTML = '';
      }
      _toast('Conversation deleted', 'success');
    } catch (err) {
      console.error('[FlockChat] delete failed:', err);
      _toast('Failed to delete conversation', 'error');
    }
  };

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
      if (conv.type === 'sms') meta.textContent = 'SMS • ' + (conv.smsPhone || 'no number');
      else if (conv.type === 'prayer') meta.textContent = 'Prayer Chain • posts here become church prayer requests';
      else if (conv.type === 'announcement') meta.textContent = 'Church-wide announcements';
      else meta.textContent = conv.type === 'dm' ? 'Direct Message' : `${count} ${count === 1 ? 'member' : 'members'}`;
    }

    // Composer hint for SMS threads
    const inputEl = $('fc-input');
    if (inputEl) {
      inputEl.placeholder = (conv.type === 'sms')
        ? 'Type a message — will open your SMS app…'
        : (conv.type === 'prayer')
          ? 'Share a prayer request…'
          : (conv.type === 'announcement')
            ? 'Post an announcement to the whole church…'
            : 'FlockChat';
    }

    // Show thread pane (mobile)
    const thread = $('fc-thread');
    if (thread) thread.classList.add('active');

    // Load messages
    _loadMessages(convId);
  };

  function _markAsRead(convId) {
    // The shared announcements doc has no per-user unreadCount and members
    // typically can't write to it — don't try.
    if (convId === ANNOUNCEMENTS_ID) return;
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

    // Special path: shared church announcements channel uses the wall/UpperRoom
    // shape ({ body, senderName, senderEmail, sentAt }) instead of FlockChat's
    // ({ text, authorName, author, timestamp }). Map on the fly.
    if (convId === ANNOUNCEMENTS_ID) {
      _msgUnsub = _db.collection('conversations').doc(convId).collection('messages')
        .orderBy('sentAt', 'asc')
        .limit(MSG_LIMIT)
        .onSnapshot(snap => {
          _messages = [];
          snap.forEach(doc => {
            const d = doc.data() || {};
            _messages.push({
              id:         doc.id,
              text:       d.body || d.text || '',
              author:     d.senderEmail || d.author || '',
              authorName: d.senderName  || d.authorName || 'Leadership',
              type:       'announcement',
              timestamp:  d.sentAt || d.timestamp || null
            });
          });
          if (_messages.length === 0) {
            const c = $('fc-messages');
            if (c) c.innerHTML = `
              <div class="fc-empty">
                <div class="fc-empty-icon">📢</div>
                <div class="fc-empty-title">No announcements yet</div>
                <div class="fc-empty-text">When leadership posts, it'll show up here.</div>
              </div>`;
            return;
          }
          _renderMessages();
          _scrollToBottom();
        }, err => {
          console.error('[FlockChat] Failed to load announcements:', err);
          msgContainer.innerHTML = `
            <div class="fc-empty">
              <div class="fc-empty-icon">⚠️</div>
              <div class="fc-empty-title">Couldn't load announcements</div>
              <div class="fc-empty-text">Please try again.</div>
            </div>`;
        });
      return;
    }

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

      // Church Announcements: route through UpperRoom so the post lands in
      // the same shared channel that The Announcements view reads/writes.
      if (_activeConvId === ANNOUNCEMENTS_ID || conv?.type === 'announcement') {
        if (!window.UpperRoom || typeof window.UpperRoom.sendMessage !== 'function') {
          _toast('Announcements channel unavailable', 'error');
          return;
        }
        try {
          await window.UpperRoom.sendMessage(ANNOUNCEMENTS_ID, text);
          input.value = '';
          input.style.height = 'auto';
          _toast('📢 Posted to Church Announcements', 'success');
        } catch (err) {
          console.error('[FlockChat] Failed to post announcement:', err);
          _toast(err?.message || 'Failed to post announcement', 'error');
        }
        return;
      }

      // SMS conversations: hand off to the native SMS composer with the
      // text prefilled, and log the attempt so the thread + recents update.
      if (conv?.type === 'sms') {
        const phone = conv.smsPhone;
        if (!phone) { _toast('No phone on file for this contact', 'error'); return; }
        _launchSms(phone, text);
        await _db.collection('conversations').doc(_activeConvId).collection('messages').add({
          text,
          author: _me.uid,
          authorName: _me.displayName || _me.email,
          type: 'sms',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        await _db.collection('conversations').doc(_activeConvId).update({
          lastMessage: {
            text: '📲 ' + text,
            author: _me.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          },
          lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Log to the member's touch history so it shows up on their Fold page.
        if (conv.smsMemberUid && window.UpperRoom && typeof window.UpperRoom.createTouch === 'function') {
          try {
            await window.UpperRoom.createTouch({
              memberId:   conv.smsMemberUid,
              memberName: conv.name || '',
              channel:    'text',
              note:       text
            });
          } catch (logErr) {
            console.warn('[FlockChat] Touch log write failed:', logErr);
          }
        }
        _toast('📲 SMS opened — tap Send in your messages app', 'success');
        input.value = '';
        input.style.height = 'auto';
        return;
      }

      const msgType = conv?.type === 'prayer' ? 'prayer' : conv?.type === 'announcement' ? 'announcement' : 'text';

      // Prayer Chain: also create an actual PrayerRequest in the church's
      // prayers collection so it shows up in The Prayer Chain admin view
      // (auto-assigned to the lead pastor by UpperRoom.createPrayer).
      let createdPrayerId = null;
      if (msgType === 'prayer' && window.UpperRoom && typeof window.UpperRoom.createPrayer === 'function') {
        try {
          createdPrayerId = await window.UpperRoom.createPrayer({
            submitterName:  _me.displayName || _me.email || 'Anonymous',
            submitterEmail: _me.email || '',
            prayerText:     text,
            category:       'Other',
            isConfidential: 'FALSE',
            followUpRequested: 'FALSE'
          });
        } catch (err) {
          console.error('[FlockChat] Failed to create PrayerRequest:', err);
          _toast('Posted to chat, but failed to log prayer request', 'error');
        }
      }

      await _db.collection('conversations').doc(_activeConvId).collection('messages').add({
        text,
        author: _me.uid,
        authorName: _me.displayName || _me.email,
        type: msgType,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        prayerCount: msgType === 'prayer' ? 0 : null,
        prayerId: createdPrayerId || null
      });

      if (createdPrayerId) {
        _toast('🙏 Prayer request submitted to the church', 'success');
      }

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
