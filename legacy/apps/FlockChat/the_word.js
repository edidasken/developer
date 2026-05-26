/* ══════════════════════════════════════════════════════════════════════════════
   THE WORD — FlockChat Engine
   "In the beginning was the Word, and the Word was with God,
    and the Word was God." — John 1:1

   Responsibilities:
     • Auth (Firebase email/password — standalone test mode)
     • Channel CRUD + real-time list
     • Message stream (Firestore onSnapshot, cursor pagination)
     • Message send / edit / delete / react
     • DM thread management
     • Presence (RTDB onDisconnect)
     • Typing indicators (RTDB ephemeral)
     • Unread badge counts
     • @mention highlight
     • Emoji picker (client-side)
     • Channel seeding (#general, #announcements, #prayer-chain)
   ══════════════════════════════════════════════════════════════════════════════ */

'use strict';

const TheWord = (() => {

  // ── Firebase handles ───────────────────────────────────────────────────
  let auth, db, rtdb, messaging, F; // F = firebase function imports

  // ── VAPID key — Web Push certificate from Firebase Console ────────────
  // Project Settings → Cloud Messaging → Web configuration → Key pair
  const VAPID_KEY = 'BDWyEyfi_O53MvhfeiIbb58qvhY-U71uRtwXieQYAQFullLURDjU75ihHcPGZZndTt4bhg0kNeFPV6fIuBMICc0';

  // ── Multi-tenant church isolation ─────────────────────────────────────
  // churchId comes from ?church= URL param (e.g. ?church=theforest)
  // All Firestore paths are prefixed: churches/{churchId}/{collection}
  // RTDB paths:                        /{collection}/{churchId}/...
  // If no param, falls back to 'default' (standalone / test mode)
  let _churchId = 'default';

  // Firestore collection helper — returns scoped collection path string
  function _col(name) {
    return _churchId === 'default' ? name : 'churches/' + _churchId + '/' + name;
  }

  // RTDB path helper — prepends /{churchId} scope
  function _rpath(path) {
    // path starts with '/' e.g. '/presence/uid' → '/theforest/presence/uid'
    return _churchId === 'default' ? path : '/' + _churchId + path;
  }

  // ── State ──────────────────────────────────────────────────────────────
  let _me          = null;   // { uid, displayName, email, role }
  let _activeId    = null;   // channelId or dmId
  let _activeType  = null;   // 'channel' | 'dm'
  let _channels    = [];
  let _dms         = [];
  let _userReads   = {};     // { [id]: timestamp } — local read-state cache
  let _msgUnsub    = null;   // unsubscribe for current message listener
  let _chUnsub     = null;   // unsubscribe for channel list
  let _dmUnsub     = null;
  let _typingTimer = null;
  let _isTyping    = false;
  let _lastMsgTs   = null;   // for pagination cursor
  let _detailsOpen = false;
  let _authMode    = 'signin'; // 'signin' | 'register'
  let _msgDocs     = [];     // all loaded message objects (live + paginated)
  let _msgCursor   = null;   // Firestore doc snapshot cursor for "load earlier"
  let _hasMoreMsgs = false;  // whether older messages may exist
  let _searchActive = false; // is message search bar open
  let _searchQuery  = '';    // current search filter text
  let _emojiTarget = null;   // message id for reaction target (null = composer)
  let _replyTarget  = null;   // { id, authorName, text } | null
  let _prayers      = [];     // prayer request docs
  let _announces    = [];     // broadcast/announcement docs
  let _prayerUnsub  = null;   // Firestore unsub for prayer list
  let _announceUnsub = null;  // Firestore unsub for announce list
  let _activePrayerId = null; // currently open prayer id
  let _activeAnnounceId = null; // currently open announce id
  let _contactTarget = null;    // { id, displayName, email, phone, role } — contact compose target

  // ── Emoji set ──────────────────────────────────────────────────────────
  const EMOJIS = [
    '👍','❤️','😂','🙏','🔥','✅','🎉','👏',
    '😊','😢','😮','🤔','💪','✨','🙌','💬',
    '📖','⛪','🕊️','🌿','☀️','🌙','⚡','🎶'
  ];

  // ── Default channels seeded on first run ───────────────────────────────
  const SEED_CHANNELS = [
    { name: 'general',       description: 'General conversation for the whole team', type: 'public' },
    { name: 'announcements', description: 'Important updates from leadership',       type: 'public' },
    { name: 'prayer-chain',  description: 'Share prayer requests and praise reports',type: 'public' }
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────────────────
  function init() {
    ({ auth, db, rtdb, messaging } = window._FC);
    F = window._FC.firebase;

    // Read church tenant from URL param (?church=theforest)
    const _urlChurch = new URLSearchParams(window.location.search).get('church');
    if (_urlChurch && /^[a-z0-9_-]+$/i.test(_urlChurch)) {
      _churchId = _urlChurch.toLowerCase();
    }

    _buildEmojiPicker();
    _bindAuthUI();
    _bindComposer();
    _bindModals();
    _bindSidebar();
    _bindTopbar();
    _bindUserMenu();
    _bindAdminPanel();
    _bindQuickSwitcher();
    _bindMessageSearch();
    _bindProfileModal();
    _bindPrayerUI();
    _bindContactModal();

    // Auth state observer
    F.onAuthStateChanged(auth, async (user) => {
      if (user) {
        await _onSignedIn(user);
      } else {
        _onSignedOut();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────────────────────────────────
  function _bindAuthUI() {
    const submitBtn    = _el('auth-submit-btn');
    const emailInput   = _el('auth-email');
    const passInput    = _el('auth-pass');
    const nameInput    = _el('auth-name');
    const toggleLink   = _el('auth-toggle-link');
    const toggleText   = _el('auth-toggle-text');
    const subtitle     = _el('auth-subtitle');
    const nameField    = _el('auth-name-field');

    submitBtn.addEventListener('click', _handleAuthSubmit);
    [emailInput, passInput, nameInput].forEach(el => {
      el.addEventListener('keydown', e => { if (e.key === 'Enter') _handleAuthSubmit(); });
    });

    toggleLink.addEventListener('click', () => {
      _authMode = _authMode === 'signin' ? 'register' : 'signin';
      if (_authMode === 'register') {
        submitBtn.textContent    = 'Create Account';
        subtitle.textContent     = 'Create your workspace account';
        toggleText.textContent   = 'Already have one?';
        toggleLink.textContent   = 'Sign in';
        nameField.style.display  = 'block';
      } else {
        submitBtn.textContent    = 'Sign In';
        subtitle.textContent     = 'Sign in to your workspace';
        toggleText.textContent   = 'No account?';
        toggleLink.textContent   = 'Create one';
        nameField.style.display  = 'none';
      }
      const forgotRow = _el('auth-forgot-row');
      if (forgotRow) forgotRow.style.display = _authMode === 'register' ? 'none' : '';
      _clearAuthError();
    });

    // Forgot password link
    const forgotLink = _el('auth-forgot-link');
    if (forgotLink) {
      forgotLink.addEventListener('click', () => {
        _authMode = 'reset';
        submitBtn.textContent    = 'Send Reset Email';
        subtitle.textContent     = 'Reset your password';
        toggleText.textContent   = 'Remember it?';
        toggleLink.textContent   = 'Sign in';
        nameField.style.display  = 'none';
        _el('auth-pass').closest('.auth-field').style.display = 'none';
        const forgotRow = _el('auth-forgot-row');
        if (forgotRow) forgotRow.style.display = 'none';
        _clearAuthError();
      });
    }
  }

  async function _handleAuthSubmit() {
    const email = _el('auth-email').value.trim();
    const pass  = _el('auth-pass').value;
    const name  = _el('auth-name').value.trim();
    const btn   = _el('auth-submit-btn');

    _clearAuthError();

    // Password reset mode
    if (_authMode === 'reset') {
      if (!email) { _showAuthError('Enter your email address.'); return; }
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        await F.sendPasswordResetEmail(auth, email);
        const errEl = _el('auth-error');
        errEl.style.background   = 'rgba(61,122,79,0.1)';
        errEl.style.borderColor  = 'rgba(61,122,79,0.3)';
        errEl.style.color        = 'var(--success)';
        errEl.textContent        = 'Reset email sent! Check your inbox.';
        errEl.style.display      = 'block';
        setTimeout(() => {
          _authMode = 'signin';
          btn.textContent = 'Sign In';
          _el('auth-subtitle').textContent = 'Sign in to your workspace';
          _el('auth-toggle-text').textContent = 'No account?';
          _el('auth-toggle-link').textContent = 'Create one';
          _el('auth-pass').closest('.auth-field').style.display = '';
          const forgotRow = _el('auth-forgot-row');
          if (forgotRow) forgotRow.style.display = '';
          _clearAuthError();
        }, 3000);
      } catch (err) {
        _showAuthError(_friendlyAuthError(err.code));
      }
      btn.disabled = false;
      btn.textContent = 'Send Reset Email';
      return;
    }
    if (!email || !pass) { _showAuthError('Email and password are required.'); return; }

    btn.disabled = true;
    btn.textContent = _authMode === 'signin' ? 'Signing in…' : 'Creating account…';

    try {
      if (_authMode === 'register') {
        if (!name) { _showAuthError('Display name is required.'); return; }
        const cred = await F.createUserWithEmailAndPassword(auth, email, pass);
        await F.updateProfile(cred.user, { displayName: name });
        // Create user doc in Firestore
        await F.setDoc(F.doc(db, _col('users'), cred.user.uid), {
          displayName: name,
          email:       email,
          role:        email === 'flockos.notify@gmail.com' ? 'admin' : 'volunteer',
          avatar:      '',
          status:      'available',
          lastSeen:    F.serverTimestamp(),
          createdAt:   F.serverTimestamp()
        });
      } else {
        await F.signInWithEmailAndPassword(auth, email, pass);
      }
    } catch (err) {
      _showAuthError(_friendlyAuthError(err.code));
      btn.disabled = false;
      btn.textContent = _authMode === 'signin' ? 'Sign In' : 'Create Account';
    }
  }

  function _friendlyAuthError(code) {
    const map = {
      'auth/invalid-credential':       'Incorrect email or password.',
      'auth/user-not-found':           'No account found for that email.',
      'auth/wrong-password':           'Incorrect password.',
      'auth/email-already-in-use':     'An account with that email already exists.',
      'auth/weak-password':            'Password must be at least 6 characters.',
      'auth/invalid-email':            'Please enter a valid email address.',
      'auth/too-many-requests':        'Too many attempts. Please wait and try again.',
      'auth/network-request-failed':   'Network error. Check your connection.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  }

  function _showAuthError(msg) {
    const el = _el('auth-error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  function _clearAuthError() {
    const el = _el('auth-error');
    el.textContent = '';
    el.style.display = 'none';
  }

  async function _onSignedIn(user) {
    // Set a baseline identity immediately so _showApp() can render right away.
    _me = {
      uid:         user.uid,
      displayName: user.displayName || user.email.split('@')[0],
      email:       user.email,
      phone:       '',
      role:        user.email === 'flockos.notify@gmail.com' ? 'admin' : 'volunteer'
    };

    // Show the app now — no need to wait on Firestore before unblocking the UI.
    _initPresence();
    _initPushNotifications();
    _showApp();
    _loadUserReads();
    _startChannelListener();
    _startDMListener();

    // Fetch/create the user doc in the background, then patch role + re-render.
    try {
      const userRef  = F.doc(db, _col('users'), user.uid);
      const userSnap = await F.getDoc(userRef);
      if (!userSnap.exists()) {
        await F.setDoc(userRef, {
          displayName: user.displayName || user.email.split('@')[0],
          email:       user.email,
          role:        _me.role,
          avatar:      '',
          status:      'available',
          lastSeen:    F.serverTimestamp(),
          createdAt:   F.serverTimestamp()
        });
      } else {
        const data = userSnap.data();
        // Patch role in case it differs from our optimistic guess
        if (data.role && data.role !== _me.role) {
          _me.role = data.role;
          // Re-render role-gated UI elements now that we have the real role
          _showApp();
          _renderChannelList();
        }
        if (data.displayName) _me.displayName = data.displayName;
        if (data.phone) _me.phone = data.phone;
        F.updateDoc(userRef, { lastSeen: F.serverTimestamp() }).catch(() => {});
      }
    } catch (err) {
      console.warn('Firestore user doc unavailable — continuing with auth identity only.', err);
    }

    // Seed default channels (no-op if they already exist)
    _seedChannels().catch(err => console.warn('Seed channels failed (non-fatal):', err));
  }

  function _onSignedOut() {
    _me         = null;
    _activeId   = null;
    _activeType = null;
    if (_msgUnsub) { _msgUnsub(); _msgUnsub = null; }
    if (_chUnsub)  { _chUnsub();  _chUnsub  = null; }
    if (_dmUnsub)  { _dmUnsub();  _dmUnsub  = null; }
    _hideApp();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRESENCE
  // ─────────────────────────────────────────────────────────────────────────
  function _initPresence() {
    if (!_me) return;
    const presRef = F.ref(rtdb, _rpath(`/presence/${_me.uid}`));

    // Mark online when connected
    const connRef = F.ref(rtdb, '.info/connected');
    F.onValue(connRef, (snap) => {
      if (!snap.val()) return;
      F.onDisconnect(presRef).set({ state: 'offline', lastChanged: F.rtdbTs() });
      F.set(presRef, { state: 'online', lastChanged: F.rtdbTs() });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUSH NOTIFICATIONS (FCM)
  // ─────────────────────────────────────────────────────────────────────────
  async function _initPushNotifications() {
    if (!messaging || !_me) return;
    if (VAPID_KEY === 'REPLACE_WITH_YOUR_VAPID_KEY') {
      console.warn('FlockChat: VAPID_KEY not set — push notifications disabled.');
      return;
    }

    try {
      // Register the service worker
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      // Get FCM token and save to user doc
      const token = await F.getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      if (token) {
        await F.updateDoc(F.doc(db, _col('users'), _me.uid), { fcmToken: token })
          .catch(() => F.setDoc(F.doc(db, _col('users'), _me.uid), { fcmToken: token }, { merge: true }));
      }

      // Foreground messages — show as toast while app is open
      F.onMessage(messaging, (payload) => {
        const n = payload.notification || {};
        // Don't show if the active channel is the source
        if (payload.data?.channelId && payload.data.channelId === _activeId) return;
        _toast(`${n.title || 'FlockChat'}: ${n.body || ''}`, 'info');
      });

    } catch (err) {
      console.warn('Push notification setup failed:', err.message);
    }
  }

  function _watchPresence(userId, dotEl) {
    const presRef = F.ref(rtdb, _rpath(`/presence/${userId}`));
    F.onValue(presRef, (snap) => {
      const data  = snap.val();
      const state = data?.state || 'offline';
      dotEl.className = 'dm-presence ' + state;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANNEL SEEDING
  // ─────────────────────────────────────────────────────────────────────────
  async function _seedChannels() {
    const colRef = F.collection(db, _col('channels'));
    const snap   = await F.getDocs(F.query(colRef, F.limit(1)));
    if (!snap.empty) return; // already seeded

    for (const ch of SEED_CHANNELS) {
      await F.addDoc(colRef, {
        name:        ch.name,
        description: ch.description,
        type:        ch.type,
        createdBy:   _me.uid,
        createdAt:   F.serverTimestamp(),
        members:     [_me.uid],
        messageCount: 0
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANNEL LIST LISTENER
  // ─────────────────────────────────────────────────────────────────────────
  function _startChannelListener() {
    const q = F.query(
      F.collection(db, _col('channels'))
    );
    _chUnsub = F.onSnapshot(q, (snap) => {
      _channels = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.name.localeCompare(b.name));
      _renderChannelList();
    }, (err) => {
      console.error('Channel listener error:', err);
      _toast('Could not load channels: ' + err.message, 'error');
    });
  }

  function _renderChannelList() {
    const container = _el('channel-list');
    const search    = _el('sidebar-search').value.toLowerCase();
    container.innerHTML = '';

    _channels
      .filter(ch => {
        if (ch.access === 'private' && !(ch.members || []).includes(_me?.uid) && !_isAdmin()) return false;
        if (ch.access === 'role-gated' && ch.minRole && !_hasRole(ch.minRole) && !_isAdmin()) return false;
        return !search || ch.name.toLowerCase().includes(search);
      })
      .forEach(ch => {
        const lastRead = _userReads[ch.id] || 0;
        const lastTs   = ch.lastTimestamp?.toMillis?.() || 0;
        const hasUnread = lastTs > lastRead && ch.id !== _activeId;
        const item = document.createElement('div');
        item.className = 'sidebar-item' + (_activeId === ch.id ? ' active' : '') + (hasUnread ? ' has-unread' : '');
        item.dataset.id = ch.id;
        item.innerHTML = `
          <span class="sigil">${ch.type === 'private' ? '🔒' : '#'}</span>
          <span class="ch-name">${_esc(ch.name)}</span>
          <span class="unread-badge" id="badge-${ch.id}">${hasUnread ? '●' : ''}</span>`;
        item.addEventListener('click', () => _openChannel(ch));
        container.appendChild(item);
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DM LIST LISTENER
  // ─────────────────────────────────────────────────────────────────────────
  function _startDMListener() {
    if (!_me) return;
    const q = F.query(
      F.collection(db, _col('dms')),
      F.where('members', 'array-contains', _me.uid)
    );
    _dmUnsub = F.onSnapshot(q, async (snap) => {
      _dms = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.lastTimestamp?.toMillis?.() || 0) - (a.lastTimestamp?.toMillis?.() || 0));
      await _renderDMList();
    });
  }

  async function _renderDMList() {
    const container = _el('dm-list');
    const search    = _el('sidebar-search').value.toLowerCase();
    container.innerHTML = '';

    for (const dm of _dms) {
      const otherId   = dm.members.find(id => id !== _me.uid);
      if (!otherId) continue;

      let otherName = dm.otherName || otherId;
      try {
        const uSnap = await F.getDoc(F.doc(db, _col('users'), otherId));
        if (uSnap.exists()) otherName = uSnap.data().displayName || otherName;
      } catch (_) { /* offline */ }

      if (search && !otherName.toLowerCase().includes(search)) continue;

      const item = document.createElement('div');
      item.className = 'sidebar-item' + (_activeId === dm.id ? ' active' : '');
      item.dataset.id = dm.id;

      const dot = document.createElement('div');
      dot.className = 'dm-presence';
      _watchPresence(otherId, dot);

      const lastRead  = _userReads[dm.id] || 0;
      const lastTs    = dm.lastTimestamp?.toMillis?.() || 0;
      const hasUnread = lastTs > lastRead && dm.id !== _activeId;
      item.className += hasUnread ? ' has-unread' : '';
      item.innerHTML = `<span class="ch-name">${_esc(otherName)}</span>
        <span class="unread-badge" id="badge-${dm.id}">${hasUnread ? '●' : ''}</span>`;
      item.insertBefore(dot, item.firstChild);
      item.addEventListener('click', () => _openDM(dm, otherName));
      container.appendChild(item);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OPEN CHANNEL
  // ─────────────────────────────────────────────────────────────────────────
  function _openChannel(ch) {
    const isMember = (ch.members || []).includes(_me?.uid);
    _setActive(ch.id, 'channel');
    const _tcn = _el('topbar-channel-name'); if (_tcn) _tcn.innerHTML = `<span id="topbar-channel-label">${ch.type === 'private' ? '🔒 ' : ''}${_esc(ch.name)}</span>`;
    const _tcd = _el('topbar-channel-desc'); if (_tcd) _tcd.textContent = ch.description || '';
    _el('composer-input').placeholder = `Message #${ch.name}…`;
    _el('details-title').textContent = `# ${ch.name}`;
    _el('details-desc').textContent  = ch.description || 'No description.';
    _renderDetails(ch);

    // Show/hide join banner & composer
    const banner   = _el('join-banner');
    const composer = _el('composer');
    const joinBtn  = _el('btn-join-channel');
    if (isMember) {
      banner.style.display   = 'none';
      composer.style.display = '';
      if (joinBtn) joinBtn.onclick = null;
    } else if (ch.access === 'role-gated' && ch.minRole && !_hasRole(ch.minRole)) {
      banner.querySelector('p').textContent = `This channel requires ${ch.minRole} access or higher.`;
      if (joinBtn) joinBtn.style.display = 'none';
      banner.style.display   = 'flex';
      composer.style.display = 'none';
    } else if (ch.access === 'private') {
      banner.querySelector('p').textContent = 'This is a private channel. Contact an admin to be invited.';
      if (joinBtn) joinBtn.style.display = 'none';
      banner.style.display   = 'flex';
      composer.style.display = 'none';
    } else {
      banner.querySelector('p').textContent = "You're not a member of this channel.";
      if (joinBtn) { joinBtn.style.display = ''; joinBtn.onclick = () => _joinChannel(ch); }
      banner.style.display   = 'flex';
      composer.style.display = 'none';
    }

    // Show search button once a conversation is open
    const srchBtn = _el('btn-msg-search');
    if (srchBtn) srchBtn.style.display = '';
    _markRead(ch.id);
    _listenMessages('channels', ch.id);
    _renderChannelList();
    _closeSidebar();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OPEN DM
  // ─────────────────────────────────────────────────────────────────────────
  function _openDM(dm, otherName) {
    _setActive(dm.id, 'dm');
    const _tcn2 = _el('topbar-channel-name'); if (_tcn2) _tcn2.innerHTML = `<span id="topbar-channel-label">${_esc(otherName)}</span>`;
    const _tcd2 = _el('topbar-channel-desc'); if (_tcd2) _tcd2.textContent = 'Direct Message';
    _el('composer-input').placeholder = `Message ${otherName}…`;
    _el('details-title').textContent = otherName;
    _el('details-desc').textContent  = 'Direct Message';
    _el('join-banner').style.display   = 'none';
    _el('composer').style.display = '';
    // Show search button once a conversation is open
    const srchBtn2 = _el('btn-msg-search');
    if (srchBtn2) srchBtn2.style.display = '';
    _markRead(dm.id);
    _listenMessages('dms', dm.id);
    _renderDMList();
    _closeSidebar();
  }

  function _setActive(id, type) {
    _activeId   = id;
    _activeType = type;
    _el('no-channel').style.display   = 'none';
    _el('thread-pane').style.display  = 'flex';
    _el('thread-pane').style.flexDirection = 'column';
    _el('message-list').innerHTML     = '<div style="text-align:center;padding:24px"><div class="spinner"></div></div>';
    if (_msgUnsub) { _msgUnsub(); _msgUnsub = null; }
    _lastMsgTs = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MESSAGE LISTENER
  // ─────────────────────────────────────────────────────────────────────────
  function _listenMessages(collection, parentId) {
    const msgCol = F.collection(db, _col(collection), parentId, 'messages');
    const q = F.query(msgCol, F.orderBy('timestamp', 'desc'), F.limit(50));
    _msgDocs     = [];
    _msgCursor   = null;
    _hasMoreMsgs = false;

    _msgUnsub = F.onSnapshot(q, (snap) => {
      if (!snap.empty) {
        // In descending order, last doc = oldest in this page
        _msgCursor   = snap.docs[snap.docs.length - 1];
        _hasMoreMsgs = snap.docs.length >= 50;
      }
      const recent = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .reverse(); // convert to oldest→newest
      // Merge: keep any pre-loaded older messages, replace recent with live data
      const recentIds = new Set(recent.map(m => m.id));
      const older     = _msgDocs.filter(m => !recentIds.has(m.id));
      _msgDocs = [...older, ...recent];
      _renderMessages(_msgDocs);
    }, (err) => {
      console.error('Message listener error:', err);
    });

    // Typing indicator
    const typRef = F.ref(rtdb, _rpath(`/typing/${parentId}`));
    F.onValue(typRef, (snap) => {
      const data = snap.val() || {};
      const others = Object.entries(data)
        .filter(([uid, val]) => uid !== _me?.uid && val === true)
        .map(([uid]) => uid);
      _renderTyping(others);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER MESSAGES
  // ─────────────────────────────────────────────────────────────────────────
  function _renderMessages(msgs, preserveScroll) {
    const list = _el('message-list');
    const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const prevScrollTop = list.scrollTop;
    const prevScrollHeight = list.scrollHeight;

    list.innerHTML = '';

    // ─ Load Earlier button ─
    if (_hasMoreMsgs) {
      const btn = document.createElement('button');
      btn.id = 'load-more-btn';
      btn.className = 'load-more-btn';
      btn.textContent = '↑ Load earlier messages';
      btn.addEventListener('click', _loadEarlierMessages);
      list.appendChild(btn);
    }
    let lastDate = null;
    let lastAuthor = null;
    let lastTs = null;

    if (msgs.length === 0) {
      list.innerHTML += `<div class="empty-thread">
        <div class="icon">✉️</div>
        <h3>No messages yet</h3>
        <p>Be the first to say something!</p>
      </div>`;
      _renderPinStrip();
      return;
    }

    // Active pins for pin button state
    const activeCh   = _activeType === 'channel' ? _channels.find(c => c.id === _activeId) : null;
    const activePins = activeCh?.pins || [];

    msgs.forEach(msg => {
      const ts       = msg.timestamp?.toDate?.() || new Date();
      const dateStr  = ts.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
      const grouped  = lastAuthor === msg.authorId
                       && lastTs && (ts - lastTs < 5 * 60 * 1000);

      // Search filter
      const msgMatchesSearch = !_searchActive || !_searchQuery ||
        (msg.text || '').toLowerCase().includes(_searchQuery.toLowerCase()) ||
        (msg.authorName || '').toLowerCase().includes(_searchQuery.toLowerCase());

      if (dateStr !== lastDate) {
        const div = document.createElement('div');
        div.className = 'day-divider';
        div.innerHTML = `<div class="line"></div><div class="label">${_esc(dateStr)}</div><div class="line"></div>`;
        list.appendChild(div);
        lastDate = dateStr;
      }

      const row = document.createElement('div');
      row.className = 'msg-row' + (grouped ? ' grouped' : '') + (msgMatchesSearch ? '' : ' search-hidden');
      row.dataset.msgId = msg.id;

      const initials = _initials(msg.authorName || '?');
      const timeStr  = ts.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
      const reactions = _renderReactionChips(msg.reactions || {}, msg.id);
      const canEdit   = msg.authorId === _me?.uid && !msg.deletedAt;
      const isPinned  = activePins.some(p => p.id === msg.id);
      const text      = msg.deletedAt
        ? '<em style="color:var(--ink-faint)">This message was deleted.</em>'
        : _formatText(msg.text || '');
      const replyHtml = msg.replyTo
        ? `<div class="reply-quote" data-jump="${_esc(msg.replyTo.id)}">
            <span class="reply-quote-author">${_esc(msg.replyTo.authorName || 'Unknown')}</span>
            <span class="reply-quote-text">${_esc((msg.replyTo.text || '').substring(0, 80))}${(msg.replyTo.text || '').length > 80 ? '…' : ''}</span>
          </div>`
        : '';

      row.innerHTML = `
        <div class="msg-avatar">${_esc(initials)}</div>
        <div class="msg-body">
          <div class="msg-meta">
            <span class="msg-author">${_esc(msg.authorName || 'Unknown')}</span>
            <span class="msg-time">${timeStr}</span>
          </div>
          ${replyHtml}
          <div class="msg-text">${text}${msg.editedAt ? '<span class="msg-edited">(edited)</span>' : ''}</div>
          ${reactions}
        </div>
        ${!msg.deletedAt ? `<div class="msg-actions">
          <button class="msg-action-btn" title="Reply" data-action="reply" data-id="${msg.id}" data-author="${_esc(msg.authorName || '')}" data-text="${_esc((msg.text || '').substring(0, 100))}">↩</button>
          <button class="msg-action-btn" title="React" data-action="react" data-id="${msg.id}">😊</button>
          ${_hasRole('leader') ? `<button class="msg-action-btn" title="${isPinned ? 'Unpin' : 'Pin'}" data-action="pin" data-id="${msg.id}" data-text="${_esc((msg.text || '').substring(0,100))}">${isPinned ? '📌' : '📎'}</button>` : ''}
          ${canEdit ? `<button class="msg-action-btn" title="Edit"   data-action="edit"   data-id="${msg.id}">✏️</button>` : ''}
          ${canEdit ? `<button class="msg-action-btn" title="Delete" data-action="delete" data-id="${msg.id}">🗑️</button>` : ''}
        </div>` : ''}`;

      // Wire reaction chips
      row.querySelectorAll('.reaction-chip').forEach(chip => {
        chip.addEventListener('click', () => _toggleReaction(msg.id, chip.dataset.emoji));
      });
      // Jump to quoted message
      row.querySelectorAll('.reply-quote').forEach(el => {
        el.addEventListener('click', () => {
          const target = list.querySelector(`[data-msg-id="${el.dataset.jump}"]`);
          if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.classList.add('msg-highlight'); setTimeout(() => target.classList.remove('msg-highlight'), 1800); }
        });
      });
      // Wire action buttons
      row.querySelectorAll('.msg-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const { action, id } = btn.dataset;
          if (action === 'reply')  _setReplyTarget({ id, authorName: btn.dataset.author, text: msg.text || '' });
          if (action === 'react')   _showEmojiPicker(e, id);
          if (action === 'pin')     _togglePinMessage(id, btn.dataset.text);
          if (action === 'edit')    _editMessage(msg);
          if (action === 'delete')  _deleteMessage(msg.id);
        });
      });

      list.appendChild(row);
      lastAuthor = msg.authorId;
      lastTs     = ts;
    });

    if (preserveScroll) {
      // Keep scroll position after loading older messages
      list.scrollTop = list.scrollHeight - prevScrollHeight + prevScrollTop;
    } else if (wasAtBottom || msgs.length <= 3) {
      list.scrollTop = list.scrollHeight;
    }

    _renderPinStrip();
    _updateSearchCount();
  }

  function _renderReactionChips(reactions, msgId) {
    const entries = Object.entries(reactions);
    if (!entries.length) return '';
    const chips = entries.map(([emoji, uids]) => {
      const reacted = uids.includes(_me?.uid);
      return `<div class="reaction-chip${reacted ? ' reacted' : ''}" data-emoji="${emoji}">
        <span class="emoji">${emoji}</span>
        <span class="count">${uids.length}</span>
      </div>`;
    }).join('');
    return `<div class="msg-reactions">${chips}</div>`;
  }

  function _formatText(text) {
    let t = _esc(text);
    // Multi-line code blocks first (protect interior from further processing)
    t = t.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
    // Inline code
    t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    // Bold **text**
    t = t.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
    // Italic *text* or _text_
    t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    t = t.replace(/_([^_\n]+)_/g, '<em>$1</em>');
    // Strikethrough ~~text~~
    t = t.replace(/~~(.+?)~~/g, '<del>$1</del>');
    // Blockquote lines (> text — escaped to &gt; by _esc)
    t = t.replace(/(^|\n)&gt; (.+)/g, '$1<blockquote>$2</blockquote>');
    // Auto-link URLs
    t = t.replace(/(https?:\/\/[^\s<>"&]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    // @channel / @here broadcasts — always highlight
    t = t.replace(/@(channel|here)/gi, '<span class="mention self">@$1</span>');
    // @user mentions
    t = t.replace(/@(\w[\w.]*)/g, (_, name) => {
      const isSelf = name.toLowerCase() === (_me?.displayName || '').toLowerCase();
      return `<span class="mention${isSelf ? ' self' : ''}">@${name}</span>`;
    });
    // Preserve newlines
    t = t.replace(/\n/g, '<br>');
    return t;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TYPING INDICATOR
  // ─────────────────────────────────────────────────────────────────────────
  function _renderTyping(uids) {
    const el = _el('typing-indicator');
    if (!uids.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>
      <span style="margin-left:6px">${uids.length === 1 ? 'Someone is' : `${uids.length} people are`} typing…</span>`;
  }

  function _setTyping(active) {
    if (!_activeId || !_me) return;
    const typRef = F.ref(rtdb, _rpath(`/typing/${_activeId}/${_me.uid}`));
    F.set(typRef, active ? true : null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND / EDIT / DELETE / REACT
  // ─────────────────────────────────────────────────────────────────────────
  function _bindComposer() {
    const input   = _el('composer-input');
    const sendBtn = _el('send-btn');

    input.addEventListener('input', () => {
      // Auto-resize
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';

      sendBtn.disabled = !input.value.trim();

      // Typing indicator
      if (!_isTyping) { _isTyping = true; _setTyping(true); }
      clearTimeout(_typingTimer);
      _typingTimer = setTimeout(() => { _isTyping = false; _setTyping(false); }, 2000);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) _sendMessage();
      }
    });

    sendBtn.addEventListener('click', _sendMessage);
  }

  async function _sendMessage() {
    const input = _el('composer-input');
    const text  = input.value.trim();
    if (!text || !_activeId || !_me) return;

    const collPath = _activeType === 'channel' ? 'channels' : 'dms';
    const msgCol   = F.collection(db, _col(collPath), _activeId, 'messages');

    input.value = '';
    input.style.height = 'auto';
    _el('send-btn').disabled = true;
    _setTyping(false);
    _isTyping = false;

    try {
      const payload = {
        authorId:    _me.uid,
        authorName:  _me.displayName,
        text:        text,
        reactions:   {},
        editedAt:    null,
        deletedAt:   null,
        timestamp:   F.serverTimestamp()
      };
      if (_replyTarget) {
        payload.replyTo = { id: _replyTarget.id, authorName: _replyTarget.authorName, text: (_replyTarget.text || '').substring(0, 200) };
        _clearReplyTarget();
      }
      await F.addDoc(msgCol, payload);
      // Update parent doc lastMessage
      await F.updateDoc(F.doc(db, _col(collPath), _activeId), {
        lastMessage:   text.substring(0, 100),
        lastTimestamp: F.serverTimestamp()
      }).catch(() => {});
    } catch (err) {
      _toast('Failed to send message.', 'error');
      console.error(err);
    }
  }

  function _editMessage(msg) {
    const row   = document.querySelector(`[data-msg-id="${msg.id}"]`);
    if (!row) return;
    const textEl = row.querySelector('.msg-text');
    const orig   = msg.text;
    textEl.innerHTML = `<textarea style="
      width:100%;background:var(--bg);border:1px solid var(--accent);
      border-radius:6px;padding:6px 9px;color:var(--ink);font-size:0.88rem;
      resize:none;outline:none;font-family:inherit;line-height:1.5"
      rows="2">${_esc(orig)}</textarea>
      <div style="display:flex;gap:6px;margin-top:5px">
        <button class="btn-primary" style="font-size:0.78rem;padding:5px 12px" id="edit-save">Save</button>
        <button class="btn-secondary" style="font-size:0.78rem;padding:5px 12px" id="edit-cancel">Cancel</button>
      </div>`;
    const ta = textEl.querySelector('textarea');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    textEl.querySelector('#edit-save').addEventListener('click', async () => {
      const newText = ta.value.trim();
      if (!newText) return;
      const collPath = _activeType === 'channel' ? 'channels' : 'dms';
      const msgRef   = F.doc(db, _col(collPath), _activeId, 'messages', msg.id);
      await F.updateDoc(msgRef, { text: newText, editedAt: F.serverTimestamp() });
    });
    textEl.querySelector('#edit-cancel').addEventListener('click', () => {
      textEl.innerHTML = _formatText(orig);
    });
  }

  async function _deleteMessage(msgId) {
    if (!confirm('Delete this message?')) return;
    const collPath = _activeType === 'channel' ? 'channels' : 'dms';
    const msgRef   = F.doc(db, _col(collPath), _activeId, 'messages', msgId);
    await F.updateDoc(msgRef, { deletedAt: F.serverTimestamp(), text: '' });
  }

  async function _toggleReaction(msgId, emoji) {
    if (!_me || !_activeId) return;
    const collPath = _activeType === 'channel' ? 'channels' : 'dms';
    const msgRef   = F.doc(db, _col(collPath), _activeId, 'messages', msgId);
    const snap     = await F.getDoc(msgRef);
    if (!snap.exists()) return;

    const reactions = snap.data().reactions || {};
    const uids      = reactions[emoji] || [];
    const hasIt     = uids.includes(_me.uid);

    const updated = { ...reactions };
    if (hasIt) {
      updated[emoji] = uids.filter(u => u !== _me.uid);
      if (!updated[emoji].length) delete updated[emoji];
    } else {
      updated[emoji] = [...uids, _me.uid];
    }
    await F.updateDoc(msgRef, { reactions: updated });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMOJI PICKER
  // ─────────────────────────────────────────────────────────────────────────
  function _buildEmojiPicker() {
    const grid = _el('emoji-grid');
    EMOJIS.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'emoji-btn';
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        if (_emojiTarget) {
          _toggleReaction(_emojiTarget, emoji);
        } else {
          const input = _el('composer-input');
          input.value += emoji;
          input.dispatchEvent(new Event('input'));
          input.focus();
        }
        _closeEmojiPicker();
      });
      grid.appendChild(btn);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      const picker = _el('emoji-picker');
      if (!picker.contains(e.target) && !e.target.closest('#btn-emoji') && !e.target.closest('[data-action="react"]')) {
        _closeEmojiPicker();
      }
    });

    _el('btn-emoji').addEventListener('click', (e) => {
      e.stopPropagation();
      _emojiTarget = null;
      _showEmojiPickerAt(e.currentTarget);
    });
  }

  function _showEmojiPicker(e, msgId) {
    e.stopPropagation();
    _emojiTarget = msgId;
    _showEmojiPickerAt(e.currentTarget);
  }

  function _showEmojiPickerAt(el) {
    const picker = _el('emoji-picker');
    const rect   = el.getBoundingClientRect();
    picker.style.display = 'block';
    const pickerH = picker.offsetHeight || 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const left = Math.min(rect.left, window.innerWidth - 280);
    picker.style.left = Math.max(4, left) + 'px';
    if (spaceBelow >= pickerH + 10) {
      picker.style.top    = (rect.bottom + 6) + 'px';
      picker.style.bottom = 'auto';
    } else {
      picker.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
      picker.style.top    = 'auto';
    }
  }

  function _closeEmojiPicker() {
    _el('emoji-picker').style.display = 'none';
    _emojiTarget = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD EARLIER MESSAGES
  // ─────────────────────────────────────────────────────────────────────────
  async function _loadEarlierMessages() {
    if (!_msgCursor || !_activeId) return;
    const btn = _el('load-more-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    const collPath = _activeType === 'channel' ? 'channels' : 'dms';
    const msgCol   = F.collection(db, _col(collPath), _activeId, 'messages');
    try {
      const q    = F.query(msgCol, F.orderBy('timestamp', 'desc'), F.startAfter(_msgCursor), F.limit(50));
      const snap = await F.getDocs(q);
      if (!snap.empty) {
        _msgCursor   = snap.docs[snap.docs.length - 1];
        _hasMoreMsgs = snap.docs.length >= 50;
        const older  = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
        _msgDocs = [...older, ..._msgDocs];
      } else {
        _hasMoreMsgs = false;
      }
      _renderMessages(_msgDocs, true);
    } catch (err) {
      _toast('Could not load earlier messages.', 'error');
      console.error(err);
      if (btn) { btn.disabled = false; btn.textContent = '↑ Load earlier messages'; }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PIN MESSAGES
  // ─────────────────────────────────────────────────────────────────────────
  async function _togglePinMessage(msgId, msgText) {
    if (!_hasRole('leader')) { _toast('Only leaders+ can pin messages.', 'error'); return; }
    if (_activeType !== 'channel') { _toast('Pinning is only supported in channels.', 'error'); return; }
    const chRef  = F.doc(db, _col('channels'), _activeId);
    const snap   = await F.getDoc(chRef);
    const pins   = snap.data()?.pins || [];
    const existing = pins.find(p => p.id === msgId);
    if (existing) {
      await F.updateDoc(chRef, { pins: F.arrayRemove(existing) });
      _toast('Message unpinned.', 'success');
    } else {
      if (pins.length >= 10) { _toast('Max 10 pinned messages per channel.', 'error'); return; }
      const newPin = { id: msgId, text: (msgText || '').substring(0, 100), pinnedBy: _me.uid, pinnedAt: Date.now() };
      await F.updateDoc(chRef, { pins: F.arrayUnion(newPin) });
      _toast('Message pinned! 📌', 'success');
    }
  }

  function _renderPinStrip() {
    const strip = _el('pin-strip');
    if (!strip) return;
    if (_activeType !== 'channel') { strip.style.display = 'none'; return; }
    const ch   = _channels.find(c => c.id === _activeId);
    const pins = ch?.pins || [];
    if (!pins.length) { strip.style.display = 'none'; return; }
    const latest = pins[pins.length - 1];
    strip.style.display = 'flex';
    const textEl = _el('pin-strip-text');
    const countEl = _el('pin-strip-count');
    if (textEl)  textEl.textContent  = latest.text || '(message)';
    if (countEl) countEl.textContent = pins.length > 1 ? `+${pins.length - 1} more` : '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DARK MODE TOGGLE
  // ─────────────────────────────────────────────────────────────────────────
  function _toggleDarkMode() {
    _darkMode = !_darkMode;
    document.documentElement.classList.toggle('dark-mode', _darkMode);
    const btn = _el('btn-dark-mode');
    if (btn) btn.textContent = _darkMode ? '☀️' : '🌙';
    try { localStorage.setItem('flockchat-dark', _darkMode ? '1' : '0'); } catch (_) {}
  }

  function _initDarkMode() {
    try {
      if (localStorage.getItem('flockchat-dark') === '1') {
        _darkMode = true;
        document.documentElement.classList.add('dark-mode');
        const btn = _el('btn-dark-mode');
        if (btn) btn.textContent = '☀️';
      }
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUICK SWITCHER (Ctrl+K)
  // ─────────────────────────────────────────────────────────────────────────
  function _bindQuickSwitcher() {
    const overlay = _el('quick-switcher');
    const input   = _el('qs-input');
    if (!overlay || !input) return;

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        overlay.classList.contains('open') ? _closeQuickSwitcher() : _openQuickSwitcher();
      }
      if (e.key === 'Escape' && overlay.classList.contains('open')) _closeQuickSwitcher();
    });

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) _closeQuickSwitcher();
    });

    // Input filtering + keyboard nav
    let _qsIndex = -1;
    input.addEventListener('input', () => {
      _qsIndex = -1;
      _renderQSList(input.value.trim());
    });
    input.addEventListener('keydown', (e) => {
      const items = _el('qs-list').querySelectorAll('.qs-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _qsIndex = Math.min(_qsIndex + 1, items.length - 1);
        items.forEach((it, i) => it.classList.toggle('qs-selected', i === _qsIndex));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _qsIndex = Math.max(_qsIndex - 1, 0);
        items.forEach((it, i) => it.classList.toggle('qs-selected', i === _qsIndex));
      } else if (e.key === 'Enter') {
        const sel = _el('qs-list').querySelector('.qs-selected');
        if (sel) sel.click();
        else if (items.length > 0) items[0].click();
      }
    });
  }

  function _openQuickSwitcher() {
    const overlay = _el('quick-switcher');
    const input   = _el('qs-input');
    if (!overlay) return;
    overlay.classList.add('open');
    if (input) { input.value = ''; input.focus(); }
    _renderQSList('');
  }

  function _closeQuickSwitcher() {
    const overlay = _el('quick-switcher');
    if (overlay) overlay.classList.remove('open');
  }

  function _renderQSList(query) {
    const list = _el('qs-list');
    if (!list) return;
    list.innerHTML = '';
    const q = query.toLowerCase();

    const chMatches = _channels.filter(ch => {
      if (ch.access === 'private' && !(ch.members || []).includes(_me?.uid) && !_isAdmin()) return false;
      return !q || ch.name.toLowerCase().includes(q);
    }).slice(0, 8);

    chMatches.forEach(ch => {
      const item = document.createElement('div');
      item.className = 'qs-item';
      item.innerHTML = `<span class="qs-sigil">${ch.type === 'private' ? '🔒' : '#'}</span><span>${_esc(ch.name)}</span>`;
      item.addEventListener('click', () => { _openChannel(ch); _closeQuickSwitcher(); });
      list.appendChild(item);
    });

    // DMs
    _dms.slice(0, 5).forEach(dm => {
      const otherId = dm.members?.find(id => id !== _me?.uid);
      if (!otherId) return;
      // Get name from cached DM list
      const dmItem = _el('dm-list')?.querySelector(`[data-id="${dm.id}"] .ch-name`);
      const name   = dmItem?.textContent || otherId;
      if (q && !name.toLowerCase().includes(q)) return;
      const item = document.createElement('div');
      item.className = 'qs-item';
      item.innerHTML = `<span class="qs-sigil">💬</span><span>${_esc(name)}</span>`;
      item.addEventListener('click', () => { _openDM(dm, name); _closeQuickSwitcher(); });
      list.appendChild(item);
    });

    if (!list.children.length) {
      list.innerHTML = '<div class="qs-item" style="color:var(--ink-faint);cursor:default">No results</div>';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MESSAGE SEARCH
  // ─────────────────────────────────────────────────────────────────────────
  function _bindMessageSearch() {
    const searchBtn   = _el('btn-msg-search');
    const searchBar   = _el('msg-search-bar');
    const searchInput = _el('msg-search-input');
    const searchClose = _el('msg-search-close');
    if (!searchBtn || !searchBar || !searchInput) return;

    searchBtn.addEventListener('click', () => _toggleMessageSearch());
    searchClose.addEventListener('click', () => _closeMessageSearch());

    searchInput.addEventListener('input', () => {
      _searchQuery = searchInput.value;
      _applySearchFilter();
    });

    // Ctrl+F shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && _activeId) {
        e.preventDefault();
        _toggleMessageSearch();
      }
      if (e.key === 'Escape' && _searchActive) _closeMessageSearch();
    });
  }

  function _toggleMessageSearch() {
    if (_searchActive) {
      _closeMessageSearch();
    } else {
      _searchActive = true;
      const bar = _el('msg-search-bar');
      if (bar) bar.style.display = 'flex';
      setTimeout(() => { const i = _el('msg-search-input'); if (i) i.focus(); }, 50);
    }
  }

  function _closeMessageSearch() {
    _searchActive = false;
    _searchQuery  = '';
    const bar   = _el('msg-search-bar');
    const input = _el('msg-search-input');
    const count = _el('msg-search-count');
    if (bar)   bar.style.display   = 'none';
    if (input) input.value         = '';
    if (count) count.textContent   = '';
    _applySearchFilter();
  }

  function _applySearchFilter() {
    const rows = _el('message-list')?.querySelectorAll('.msg-row');
    if (!rows) return;
    const q = _searchQuery.toLowerCase();
    let hits = 0;
    rows.forEach(row => {
      const msgId = row.dataset.msgId;
      const msg   = _msgDocs.find(m => m.id === msgId);
      const text  = (msg?.text || '').toLowerCase();
      const auth  = (msg?.authorName || '').toLowerCase();
      const match = !q || text.includes(q) || auth.includes(q);
      row.classList.toggle('search-hidden', !match);
      if (match && q) hits++;
    });
    _updateSearchCount(hits);
  }

  function _updateSearchCount(hits) {
    const countEl = _el('msg-search-count');
    if (!countEl) return;
    if (!_searchActive || !_searchQuery) { countEl.textContent = ''; return; }
    countEl.textContent = `${hits ?? 0} result${hits === 1 ? '' : 's'}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROFILE MODAL
  // ─────────────────────────────────────────────────────────────────────────
  function _bindProfileModal() {
    const cancelBtn = _el('btn-cancel-profile');
    const saveBtn   = _el('btn-save-profile');
    if (cancelBtn) cancelBtn.addEventListener('click', () => _closeModal('modal-profile'));
    if (saveBtn)   saveBtn.addEventListener('click',   _saveProfile);
    const backdrop = _el('modal-profile');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) _closeModal('modal-profile'); });
    }
  }

  function _openProfileModal() {
    if (!_me) return;
    const nameInput   = _el('profile-name');
    const emailInput  = _el('profile-email');
    const roleInput   = _el('profile-role');
    const statusInput = _el('profile-status-text');
    const phoneInput  = _el('profile-phone');
    if (nameInput)   nameInput.value   = _me.displayName || '';
    if (emailInput)  emailInput.value  = _me.email || '';
    if (roleInput)   roleInput.value   = _me.role || 'volunteer';
    if (statusInput) statusInput.value = _me.statusText || '';
    if (phoneInput)  phoneInput.value  = _me.phone || '';
    _openModal('modal-profile');
  }

  async function _saveProfile() {
    const nameInput   = _el('profile-name');
    const statusInput = _el('profile-status-text');
    const phoneInput  = _el('profile-phone');
    const newName     = nameInput?.value.trim();
    const newStatus   = statusInput?.value.trim() || '';
    const newPhone    = phoneInput?.value.trim() || '';
    if (!newName) { _toast('Display name cannot be empty.', 'error'); return; }
    const saveBtn = _el('btn-save-profile');
    if (saveBtn) saveBtn.disabled = true;
    try {
      // Update Firebase Auth display name
      await F.updateProfile(auth.currentUser, { displayName: newName });
      // Update Firestore user doc
      await F.updateDoc(F.doc(db, _col('users'), _me.uid), {
        displayName: newName,
        statusText:  newStatus,
        phone:       newPhone
      });
      _me.displayName  = newName;
      _me.statusText   = newStatus;
      _me.phone        = newPhone;
      // Update topbar name
      const nameEl = _el('topbar-uname');
      if (nameEl) nameEl.textContent = newName.split(' ')[0];
      const menuName = _el('user-menu-name');
      if (menuName) menuName.textContent = newName;
      _toast('Profile saved!', 'success');
      _closeModal('modal-profile');
    } catch (err) {
      _toast('Failed to save profile.', 'error');
      console.error(err);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANNEL CREATION MODAL
  // ─────────────────────────────────────────────────────────────────────────
  function _bindModals() {
    // New Channel
    _el('btn-new-channel').addEventListener('click', () => { _openModal('modal-new-channel'); _loadNewChannelMembers(); });
    _el('btn-cancel-channel').addEventListener('click', () => _closeModal('modal-new-channel'));
    _el('btn-create-channel').addEventListener('click', _createChannel);

    // New DM
    _el('btn-new-dm').addEventListener('click', _openDMModal);
    _el('btn-cancel-dm').addEventListener('click', () => _closeModal('modal-new-dm'));
    _el('btn-open-dm').addEventListener('click', _startDM);

    // Close modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) _closeModal(backdrop.id);
      });
    });
  }

  async function _loadNewChannelMembers() {
    const sel = _el('new-ch-members');
    sel.innerHTML = '<option value="" disabled>Loading…</option>';
    try {
      const snap = await F.getDocs(F.collection(db, _col('users')));
      sel.innerHTML = '';
      snap.forEach(d => {
        if (d.id === _me.uid) return;
        const opt = document.createElement('option');
        opt.value       = d.id;
        opt.textContent = d.data().displayName || d.data().email;
        sel.appendChild(opt);
      });
      if (!sel.options.length) sel.innerHTML = '<option value="" disabled>No other users yet</option>';
    } catch (err) {
      sel.innerHTML = '<option value="" disabled>Could not load users</option>';
      console.warn('_loadNewChannelMembers:', err);
    }
  }

  async function _createChannel() {
    // Role gate: only leader+ may create channels
    if (!_hasRole('leader')) {
      _toast('Only leaders, pastors, and admins can create channels.', 'error');
      return;
    }

    const name    = _el('new-ch-name').value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const desc    = _el('new-ch-desc').value.trim();
    const access  = _el('new-ch-access').value;
    const minRole = access === 'role-gated' ? (_el('new-ch-minrole').value || 'leader') : '';
    const type    = access === 'private' ? 'private' : 'public';

    if (!name) { _toast('Channel name is required.', 'error'); return; }

    const existing = _channels.find(c => c.name === name);
    if (existing) { _toast(`#${name} already exists.`, 'error'); return; }

    try {
      const pickedMembers = Array.from(_el('new-ch-members').selectedOptions).map(o => o.value).filter(Boolean);
      const members = [_me.uid, ...pickedMembers.filter(id => id !== _me.uid)];

      const ref = await F.addDoc(F.collection(db, _col('channels')), {
        name, description: desc, type, access, minRole,
        createdBy: _me.uid,
        createdAt: F.serverTimestamp(),
        members,
        messageCount: 0
      });
      _toast(`#${name} created!`, 'success');
      _closeModal('modal-new-channel');
      _el('new-ch-name').value = '';
      _el('new-ch-desc').value = '';
      _el('new-ch-access').value = 'public';
      _el('new-ch-minrole-row').style.display = 'none';
      Array.from(_el('new-ch-members').options).forEach(o => o.selected = false);
      // Open it immediately
      _openChannel({ id: ref.id, name, description: desc, type, access, minRole });
    } catch (err) {
      _toast('Failed to create channel.', 'error');
      console.error(err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MANAGE USERS (admin only)
  // ─────────────────────────────────────────────────────────────────────────
  async function _openDMModal() {
    const select = _el('dm-user-select');
    select.innerHTML = '<option value="">Loading…</option>';
    _openModal('modal-new-dm');

    try {
      const snap = await F.getDocs(F.collection(db, _col('users')));
      select.innerHTML = '<option value="">— Select a person —</option>';
      snap.forEach(d => {
        if (d.id === _me.uid) return;
        const opt = document.createElement('option');
        opt.value       = d.id;
        opt.textContent = d.data().displayName || d.data().email;
        select.appendChild(opt);
      });
    } catch (err) {
      select.innerHTML = '<option value="">Error loading users</option>';
    }
  }

  async function _startDM() {
    const otherId = _el('dm-user-select').value;
    if (!otherId) { _toast('Select a person first.', 'error'); return; }

    // DM ID = sorted pair
    const dmId = [_me.uid, otherId].sort().join('_');
    const dmRef = F.doc(db, _col('dms'), dmId);
    const snap  = await F.getDoc(dmRef);

    const otherSnap = await F.getDoc(F.doc(db, _col('users'), otherId));
    const otherName = otherSnap.data()?.displayName || 'Unknown';

    if (!snap.exists()) {
      await F.setDoc(dmRef, {
        members:       [_me.uid, otherId],
        lastMessage:   '',
        lastTimestamp: F.serverTimestamp()
      });
    }

    _closeModal('modal-new-dm');
    _openDM({ id: dmId, members: [_me.uid, otherId] }, otherName);
  }

  function _openModal(id)  { _el(id).classList.add('open'); }
  function _closeModal(id) { _el(id).classList.remove('open'); }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANNEL JOIN / LEAVE
  // ─────────────────────────────────────────────────────────────────────────
  async function _joinChannel(ch) {
    if (!_me) return;
    try {
      await F.updateDoc(F.doc(db, _col('channels'), ch.id), {
        members: F.arrayUnion(_me.uid)
      });
      _toast(`Joined #${ch.name}!`, 'success');
      _el('join-banner').style.display = 'none';
      _el('composer').style.display = '';
    } catch (err) {
      _toast('Could not join channel.', 'error');
      console.error(err);
    }
  }

  async function _leaveChannel(chId, chName) {
    if (!_me) return;
    if (!confirm(`Leave #${chName}?`)) return;
    try {
      await F.updateDoc(F.doc(db, _col('channels'), chId), {
        members: F.arrayRemove(_me.uid)
      });
      _toast(`Left #${chName}.`, 'success');
      if (_activeId === chId) {
        _activeId = null; _activeType = null;
        _el('thread-pane').style.display = 'none';
        _el('no-channel').style.display  = 'flex';
        if (_msgUnsub) { _msgUnsub(); _msgUnsub = null; }
      }
    } catch (err) {
      _toast('Could not leave channel.', 'error');
      console.error(err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UNREAD TRACKING
  // ─────────────────────────────────────────────────────────────────────────
  function _markRead(id) {
    const now = Date.now();
    _userReads[id] = now;
    // Persist in Firestore (best-effort)
    if (_me) {
      F.setDoc(
        F.doc(db, _col('userReads'), _me.uid + '_' + id),
        { uid: _me.uid, targetId: id, lastRead: F.serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    }
  }

  function _loadUserReads() {
    if (!_me) return;
    F.getDocs(F.query(
      F.collection(db, _col('userReads')),
      F.where('uid', '==', _me.uid)
    )).then(snap => {
      snap.forEach(d => {
        const data = d.data();
        const ts = data.lastRead?.toMillis?.() || 0;
        _userReads[data.targetId] = ts;
      });
      _renderChannelList();
      _renderDMList();
    }).catch(() => {});
  }

  function _positionMenu(menu, anchorRect) {
    // Make visible off-screen to measure real width
    menu.style.visibility = 'hidden';
    menu.style.display    = 'block';
    menu.style.left = '-9999px';
    menu.style.top  = '-9999px';
    const menuW = menu.offsetWidth || 200;
    menu.style.visibility = '';
    menu.style.display    = 'none'; // caller shows it

    const vw   = window.innerWidth;
    // Prefer right-aligned to anchor; clamp so it never overflows either edge
    let left = anchorRect.right - menuW;
    left = Math.max(8, Math.min(left, vw - menuW - 8));
    menu.style.left = left + 'px';
    menu.style.top  = (anchorRect.bottom + 6) + 'px';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USER STATUS MENU
  // ─────────────────────────────────────────────────────────────────────────
  function _bindUserMenu() {
    const menu = _el('user-menu');

    // Toggle on avatar/name click
    document.addEventListener('click', (e) => {
      const pill = e.target.closest('#topbar-user-pill');
      if (pill) {
        e.stopPropagation();
        if (menu.style.display === 'block') { menu.style.display = 'none'; return; }
        _positionMenu(menu, pill.getBoundingClientRect());
        menu.style.display = 'block';
        return;
      }
      if (!menu.contains(e.target)) menu.style.display = 'none';
    });

    // Status items
    menu.querySelectorAll('.user-menu-item[data-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        _setUserStatus(btn.dataset.status);
        menu.style.display = 'none';
      });
    });

    // Admin panel
    _el('btn-open-admin').addEventListener('click', () => {
      menu.style.display = 'none';
      _openAdminPanel();
    });

    // Profile modal
    const profileBtn = _el('btn-open-profile');
    if (profileBtn) profileBtn.addEventListener('click', () => {
      menu.style.display = 'none';
      _openProfileModal();
    });

    // Sign out
    _el('btn-user-menu-signout').addEventListener('click', async () => {
      menu.style.display = 'none';
      await F.signOut(auth);
      window.location.href = '/index.html';
    });
  }

  async function _setUserStatus(status) {
    if (!_me) return;
    const stateMap = { available: 'online', away: 'away', dnd: 'dnd' };
    const presRef  = F.ref(rtdb, _rpath(`/presence/${_me.uid}`));
    F.set(presRef, { state: stateMap[status] || 'online', lastChanged: F.rtdbTs() });
    await F.updateDoc(F.doc(db, _col('users'), _me.uid), { status }).catch(() => {});
    _me.status = status;
    const labels = { available: '🟢', away: '🟡', dnd: '🔴' };
    const dot = _el('topbar-status-dot');
    if (dot) dot.textContent = labels[status] || '🟢';
    _toast(`Status set to ${status}.`, 'success');
  }

  // Returns true for both admin and pastor roles
  const ROLE_LEVELS = { readonly: 0, volunteer: 1, care: 2, leader: 3, pastor: 4, admin: 5 };
  function _hasRole(required) {
    return (ROLE_LEVELS[_me?.role] || 0) >= (ROLE_LEVELS[required] || 0);
  }
  function _isAdmin() { return _hasRole('pastor'); }

  // ─────────────────────────────────────────────────────────────────────────
  // USER ADMIN PANEL
  // ─────────────────────────────────────────────────────────────────────────
  function _bindAdminPanel() {
    _el('btn-close-admin').addEventListener('click', () => _closeModal('modal-admin'));

    // Tab switching
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const which = tab.dataset.tab;
        _el('admin-tab-users').style.display = which === 'users' ? '' : 'none';
        _el('admin-tab-rooms').style.display = which === 'rooms' ? '' : 'none';
        if (which === 'rooms') _loadAdminRoomsTab();
      });
    });

    // Access type show/hide minRole row in new-channel modal
    const accessSel = _el('new-ch-access');
    if (accessSel) {
      accessSel.addEventListener('change', () => {
        _el('new-ch-minrole-row').style.display = accessSel.value === 'role-gated' ? '' : 'none';
      });
    }

    // Invite room modal
    _el('btn-cancel-invite-room').addEventListener('click', () => _closeModal('modal-invite-room'));
    _el('btn-confirm-invite-room').addEventListener('click', _confirmRoomInvite);
  }

  let _inviteRoomId = null;

  async function _openAdminPanel() {
    if (!_isAdmin()) {
      _toast('Only pastors and admins can access the admin dashboard.', 'error');
      return;
    }
    // Reset to users tab
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    const usersTab = document.querySelector('.admin-tab[data-tab="users"]');
    if (usersTab) usersTab.classList.add('active');
    _el('admin-tab-users').style.display = '';
    _el('admin-tab-rooms').style.display = 'none';

    _openModal('modal-admin');
    _loadAdminUsersTab();
  }

  const ALL_ROLES = ['readonly', 'volunteer', 'care', 'leader', 'pastor', 'admin'];
  const ROLE_LABELS = { readonly: 'Read Only', volunteer: 'Volunteer', care: 'Care Team', leader: 'Leader', pastor: 'Pastor', admin: 'Admin' };

  async function _loadAdminUsersTab() {
    const container = _el('admin-user-list');
    container.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    try {
      const snap = await F.getDocs(F.collection(db, _col('users')));
      container.innerHTML = '';
      snap.forEach(d => {
        const data = d.data();
        const uid  = d.id;
        const initials = _initials(data.displayName || uid);
        const isSelf = uid === _me.uid;
        const roleOptions = ALL_ROLES.map(r =>
          `<option value="${r}"${data.role === r ? ' selected' : ''}>${ROLE_LABELS[r]}</option>`
        ).join('');
        const row = document.createElement('div');
        row.className = 'admin-row';
        row.innerHTML = `
          <div class="member-avatar">${_esc(initials)}</div>
          <div class="admin-info">
            <div class="admin-name">${_esc(data.displayName || uid)}${isSelf ? ' <em style="font-size:0.72rem;color:var(--ink-faint)">(you)</em>' : ''}</div>
            <div class="admin-email">${_esc(data.email || '')}</div>
          </div>
          <select id="role-sel-${uid}" ${isSelf ? 'disabled' : ''}>${roleOptions}</select>
          ${!isSelf ? `<button class="btn-remove" data-uid="${uid}">Remove</button>` : ''}`;
        const sel = row.querySelector(`#role-sel-${uid}`);
        if (sel) sel.addEventListener('change', () => _setUserRole(uid, sel.value));
        const removeBtn = row.querySelector('.btn-remove');
        if (removeBtn) removeBtn.addEventListener('click', () => _removeUser(uid, data.displayName, row));
        container.appendChild(row);
      });
      if (!snap.size) container.innerHTML = '<p style="color:var(--ink-muted);font-size:0.85rem">No users found.</p>';
    } catch (err) {
      container.innerHTML = '<p style="color:var(--danger)">Could not load users.</p>';
      console.error(err);
    }
  }

  async function _loadAdminRoomsTab() {
    const container = _el('admin-room-list');
    container.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    try {
      const [chSnap, userSnap] = await Promise.all([
        F.getDocs(F.collection(db, _col('channels'))),
        F.getDocs(F.collection(db, _col('users')))
      ]);
      const usersMap = {};
      userSnap.forEach(d => { usersMap[d.id] = d.data(); });

      container.innerHTML = '';
      if (chSnap.empty) {
        container.innerHTML = '<p style="color:var(--ink-muted);font-size:0.85rem">No channels found.</p>';
        return;
      }

      chSnap.forEach(d => {
        const ch = { id: d.id, ...d.data() };
        const accessOptions = ['public', 'private', 'role-gated'].map(a =>
          `<option value="${a}"${(ch.access || 'public') === a ? ' selected' : ''}>${a}</option>`
        ).join('');
        const roleOptions = ALL_ROLES.map(r =>
          `<option value="${r}"${ch.minRole === r ? ' selected' : ''}>${ROLE_LABELS[r]}</option>`
        ).join('');
        const isRoleGated = ch.access === 'role-gated';
        const isPrivate   = ch.access === 'private';

        const row = document.createElement('div');
        row.className = 'admin-row';
        row.id = `rmrow-${ch.id}`;
        row.innerHTML = `
          <div class="admin-info">
            <div class="admin-name"># ${_esc(ch.name)}</div>
            <div class="admin-email">${(ch.members || []).length} member(s)</div>
          </div>
          <select class="room-access-sel" data-id="${ch.id}" style="font-size:0.78rem">${accessOptions}</select>
          <select class="room-minrole-sel" data-id="${ch.id}" style="font-size:0.78rem${isRoleGated ? '' : ';display:none'}">${roleOptions}</select>
          <button class="btn-invite-room" data-id="${ch.id}" data-name="${_esc(ch.name)}" style="font-size:0.78rem;padding:4px 10px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer${isPrivate ? '' : ';display:none'}">Invite</button>`;

        const accessSel  = row.querySelector('.room-access-sel');
        const roleSel    = row.querySelector('.room-minrole-sel');
        const inviteBtn  = row.querySelector('.btn-invite-room');

        accessSel.addEventListener('change', async () => {
          const newAccess = accessSel.value;
          roleSel.style.display   = newAccess === 'role-gated' ? '' : 'none';
          inviteBtn.style.display = newAccess === 'private'    ? '' : 'none';
          try {
            await F.updateDoc(F.doc(db, _col('channels'), ch.id), { access: newAccess });
            _toast('Channel access updated.', 'success');
          } catch (e) { _toast('Failed to update.', 'error'); }
        });

        roleSel.addEventListener('change', async () => {
          try {
            await F.updateDoc(F.doc(db, _col('channels'), ch.id), { minRole: roleSel.value });
            _toast('Minimum role updated.', 'success');
          } catch (e) { _toast('Failed to update.', 'error'); }
        });

        inviteBtn.addEventListener('click', () => _openInviteRoom(ch, usersMap));
        container.appendChild(row);
      });
    } catch (err) {
      container.innerHTML = '<p style="color:var(--danger)">Could not load channels.</p>';
      console.error(err);
    }
  }

  function _openInviteRoom(ch, usersMap) {
    _inviteRoomId = ch.id;
    _el('invite-room-label').textContent = `Invite a user to #${ch.name}`;
    const sel = _el('invite-room-user');
    const members = ch.members || [];
    sel.innerHTML = '<option value="">— Select a user —</option>';
    Object.entries(usersMap).forEach(([uid, u]) => {
      if (members.includes(uid)) return;
      const opt = document.createElement('option');
      opt.value = uid;
      opt.textContent = u.displayName || u.email || uid;
      sel.appendChild(opt);
    });
    if (sel.options.length === 1) {
      _toast('All users are already members of this channel.', 'info');
      return;
    }
    _openModal('modal-invite-room');
  }

  async function _confirmRoomInvite() {
    const uid = _el('invite-room-user').value;
    if (!uid || !_inviteRoomId) { _toast('Select a user first.', 'error'); return; }
    try {
      await F.updateDoc(F.doc(db, _col('channels'), _inviteRoomId), { members: F.arrayUnion(uid) });
      _toast('User invited to channel.', 'success');
      _closeModal('modal-invite-room');
      _inviteRoomId = null;
      _loadAdminRoomsTab();
    } catch (e) {
      _toast('Failed to invite user.', 'error');
    }
  }

  async function _setUserRole(uid, role) {
    try {
      await F.updateDoc(F.doc(db, _col('users'), uid), { role });
      _toast('Role updated.', 'success');
    } catch (err) {
      _toast('Failed to update role.', 'error');
      console.error(err);
    }
  }

  async function _removeUser(uid, name, rowEl) {
    if (!confirm(`Remove ${name || uid} from the workspace? This cannot be undone.`)) return;
    try {
      await F.deleteDoc(F.doc(db, _col('users'), uid));
      rowEl.remove();
      _toast(`${name} removed.`, 'success');
    } catch (err) {
      _toast('Failed to remove user.', 'error');
      console.error(err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SIDEBAR SEARCH
  // ─────────────────────────────────────────────────────────────────────────
  function _bindSidebar() {
    _el('sidebar-search').addEventListener('input', () => {
      _renderChannelList();
      _renderDMList();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOPBAR CONTROLS
  // ─────────────────────────────────────────────────────────────────────────
  function _bindTopbar() {
    // Legacy sign-out button
    const oldSignout = _el('btn-signout');
    if (oldSignout) oldSignout.addEventListener('click', async () => {
      await F.signOut(auth);
      window.location.href = '/index.html';
    });

    const btnManageUsers = _el('btn-manage-users');
    if (btnManageUsers) btnManageUsers.addEventListener('click', _openAdminPanel);
    const btnCloseManageUsers = _el('btn-close-manage-users');
    if (btnCloseManageUsers) btnCloseManageUsers.addEventListener('click', () => _closeModal('modal-manage-users'));

    _el('btn-details-toggle').addEventListener('click', () => {
      _detailsOpen = !_detailsOpen;
      _el('details-pane').classList.toggle('collapsed', !_detailsOpen);
      _el('btn-details-toggle').classList.toggle('active', _detailsOpen);
    });

    // Message search toggle
    const searchBtn = _el('btn-msg-search');
    if (searchBtn) searchBtn.addEventListener('click', _toggleMessageSearch);

    _el('btn-details-close').addEventListener('click', () => {
      _detailsOpen = false;
      _el('details-pane').classList.add('collapsed');
      _el('btn-details-toggle').classList.remove('active');
    });

    // ── Mobile: hamburger + scrim + bottom nav ──
    const isMobile = () => window.innerWidth <= 640;

    // Show/hide bottom nav based on viewport (hamburger handled by CSS)
    function _applyMobileChrome() {
      _el('bottom-nav').style.display = isMobile() ? 'flex' : 'none';
    }
    _applyMobileChrome();
    window.addEventListener('resize', _applyMobileChrome);

    // Hamburger opens sidebar drawer
    _el('btn-sidebar-toggle').addEventListener('click', () => _toggleSidebar());

    // Scrim closes sidebar drawer
    _el('sidebar-scrim').addEventListener('click', () => _closeSidebar());

    // Bottom nav
    _el('btn-nav-channels').addEventListener('click', () => {
      _setSidebarTab('channels');
      _toggleSidebar(true);
    });
    _el('btn-nav-dms').addEventListener('click', () => {
      _setSidebarTab('dms');
      _toggleSidebar(true);
    });
    _el('btn-nav-me').addEventListener('click', () => {
      _closeSidebar();
      _openProfileModal();
    });

    // Mobile People tab button
    const peopleMobileBtn = _el('btn-nav-people-mobile');
    if (peopleMobileBtn) peopleMobileBtn.addEventListener('click', () => {
      _el('btn-nav-people')?.click();
      _toggleSidebar(true);
    });
  }

  function _toggleSidebar(forceOpen) {
    const sidebar = _el('sidebar');
    const scrim   = _el('sidebar-scrim');
    const isOpen  = sidebar.classList.contains('open');
    if (forceOpen === true || !isOpen) {
      sidebar.classList.add('open');
      scrim.classList.add('open');
    } else {
      _closeSidebar();
    }
  }

  function _closeSidebar() {
    _el('sidebar').classList.remove('open');
    _el('sidebar-scrim').classList.remove('open');
  }

  function _setSidebarTab(tab) {
    // Scroll sidebar to channels or DMs section
    const target = tab === 'dms' ? _el('dm-list') : _el('channel-list');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Update bottom nav active state
    _el('btn-nav-channels').classList.toggle('active', tab === 'channels');
    _el('btn-nav-dms').classList.toggle('active', tab === 'dms');
    _el('btn-nav-me').classList.remove('active');
  }

  async function _renderDetails(ch) {
    const el = _el('details-members');
    el.innerHTML = '<div class="spinner" style="margin:12px auto"></div>';

    // Show/hide Leave button based on membership
    const isMember = (ch.members || []).includes(_me?.uid);
    const leaveSection = _el('details-leave-section');
    const leaveBtn     = _el('btn-leave-channel');
    if (leaveSection) leaveSection.style.display = isMember ? 'block' : 'none';
    if (leaveBtn) leaveBtn.onclick = () => _leaveChannel(ch.id, ch.name);
    try {
      const members = [...new Set(ch.members || [])]; // deduplicate UIDs
      const rows = await Promise.all(members.map(async uid => {
        const data = (await _fetchUserData(uid)) || {};
        const initials = _initials(data.displayName || uid);
        const isSelf = uid === _me?.uid;
        return `<div class="member-row${isSelf ? '' : ' member-row--contact'}" data-uid="${_esc(uid)}">
          <div class="member-avatar" style="width:32px;height:32px;font-size:0.78rem">${_esc(initials)}</div>
          <div style="flex:1;min-width:0">
            <span class="member-name">${_esc(data.displayName || uid)}</span>${isSelf ? ' <em style="font-size:0.7rem;color:var(--ink-faint)">(you)</em>' : ''}
          </div>
          <span class="member-role">${_esc(data.role || 'volunteer')}</span>
        </div>`;
      }));
      el.innerHTML = rows.join('');
      // Clicking a member row (non-self) opens the contact composer
      el.querySelectorAll('.member-row--contact').forEach(row => {
        row.addEventListener('click', async () => {
          const uid = row.dataset.uid;
          const data = (await _fetchUserData(uid)) || {};
          _openContactModal({ id: uid, ...data });
        });
      });
    } catch (_) {
      el.innerHTML = '<p style="font-size:0.8rem;color:var(--ink-faint)">Could not load members.</p>';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI TRANSITIONS
  // ─────────────────────────────────────────────────────────────────────────
  function _showApp() {
    _el('loading-overlay').style.display = 'none';
    _el('auth-screen').style.display     = 'none';
    _el('app').style.display             = 'flex';
    document.body.classList.remove('auth-open');

    // Set topbar user info
    _el('topbar-uname').textContent = (_me.displayName || '').split(' ')[0];
    const av = _el('topbar-avatar');
    if (av) av.textContent = _initials(_me.displayName);

    // Set user menu name
    const menuName = _el('user-menu-name');
    if (menuName) menuName.textContent = _me.displayName;

    // Show message search button whenever a channel/DM is active
    const msgSearchBtn = _el('btn-msg-search');
    if (msgSearchBtn) msgSearchBtn.style.display = _activeId ? '' : 'none';
    const btnNewCh = _el('btn-new-channel');
    if (btnNewCh) btnNewCh.style.display = _hasRole('leader') ? '' : 'none';
    const btnAdmin = _el('btn-open-admin');
    if (btnAdmin) btnAdmin.style.display = _isAdmin() ? '' : 'none';
    const btnUsers = _el('btn-manage-users');
    if (btnUsers) btnUsers.style.display = _isAdmin() ? '' : 'none';
  }

  function _hideApp() {
    _el('loading-overlay').style.display = 'none';
    _el('auth-screen').style.display     = 'flex';
    _el('app').style.display             = 'none';
    _el('thread-pane').style.display     = 'none';
    _el('no-channel').style.display      = 'flex';
    _el('channel-list').innerHTML        = '';
    _el('dm-list').innerHTML             = '';
    const srchBtnH = _el('btn-msg-search');
    if (srchBtnH) srchBtnH.style.display = 'none';
    _closeMessageSearch();
    document.body.classList.add('auth-open');

    // Reset auth form so Sign In button works immediately after logout
    const btn = _el('auth-submit-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
    const emailInput = _el('auth-email');
    const passInput  = _el('auth-pass');
    if (emailInput) emailInput.value = '';
    if (passInput)  passInput.value  = '';
    _authMode = 'signin';
    _clearAuthError();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOASTS
  // ─────────────────────────────────────────────────────────────────────────
  function _toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    _el('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────
  function _el(id) { return document.getElementById(id); }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _initials(name) {
    return (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() || '')
      .join('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REPLY TO MESSAGE
  // ─────────────────────────────────────────────────────────────────────────
  function _setReplyTarget(target) {
    _replyTarget = target;
    const bar = _el('reply-bar'); if (!bar) return;
    bar.style.display = 'flex';
    const nameEl = bar.querySelector('.reply-author');
    const textEl = bar.querySelector('.reply-text');
    if (nameEl) nameEl.textContent = target.authorName || 'Unknown';
    if (textEl) textEl.textContent = (target.text || '').substring(0, 80) + ((target.text || '').length > 80 ? '…' : '');
    _el('composer-input')?.focus();
  }

  function _clearReplyTarget() {
    _replyTarget = null;
    const bar = _el('reply-bar'); if (bar) bar.style.display = 'none';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRAYER CHAIN
  // ─────────────────────────────────────────────────────────────────────────
  function _startPrayerListener() {
    if (_prayerUnsub) return;
    const q = F.query(F.collection(db, _col('prayers')), F.orderBy('submittedAt', 'desc'), F.limit(50));
    _prayerUnsub = F.onSnapshot(q, snap => {
      _prayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _renderPrayerList();
    }, () => {});
  }

  function _renderPrayerList() {
    const el = _el('prayer-list'); if (!el) return;
    if (!_prayers.length) {
      el.innerHTML = '<div style="text-align:center;padding:1.5rem 1rem;font-size:0.78rem;color:var(--ink-faint)"><div style="font-size:2rem">🙏</div><p>No prayer requests yet.</p></div>';
      return;
    }
    el.innerHTML = _prayers.map(p => {
      const status = (p.status || 'New').toLowerCase();
      return `<div class="prayer-item${_activePrayerId === p.id ? ' active' : ''}" data-id="${_esc(p.id)}" tabindex="0" role="button">
        <div style="font-size:0.78rem;font-weight:700;color:var(--accent)">${_esc(p.submitterName || 'Anonymous')}</div>
        <div style="font-size:0.7rem;color:var(--ink-faint);margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${_esc(p.prayerText || '')}</div>
        <span class="prayer-status-badge ${status}">${_esc(p.status || 'New')}</span>
      </div>`;
    }).join('');
    el.querySelectorAll('.prayer-item').forEach(item => {
      item.addEventListener('click', () => _openPrayer(item.dataset.id));
      item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') _openPrayer(item.dataset.id); });
    });
  }

  function _openPrayer(prayerId) {
    _activePrayerId = prayerId; _activeAnnounceId = null;
    const p = _prayers.find(x => x.id === prayerId); if (!p) return;
    const panel = _el('prayer-detail-panel');
    const threadPane = _el('thread-pane');
    const announcePanel = _el('announce-detail-panel');
    if (threadPane) threadPane.style.display = 'none';
    if (announcePanel) announcePanel.style.display = 'none';
    if (panel) panel.style.display = 'flex';
    const ts = p.submittedAt?.toDate?.() || new Date();
    const detail = _el('prayer-detail-content');
    if (detail) detail.innerHTML = `
      ${p.category ? `<div class="prayer-cat-label">${_esc(p.category)}</div>` : ''}
      <h2 style="font-size:1.05rem;font-weight:800;margin:0.5rem 0">${_esc('Prayer for ' + (p.submitterName || 'Anonymous'))}</h2>
      <p style="font-size:0.88rem;line-height:1.7;white-space:pre-wrap;margin-bottom:0.85rem">${_esc(p.prayerText || '')}</p>
      <div style="font-size:0.72rem;color:var(--ink-faint)">
        Submitted ${ts.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}
        &nbsp;·&nbsp;<span class="prayer-status-badge ${(p.status||'New').toLowerCase()}">${_esc(p.status || 'New')}</span>
        ${p.isConfidential === 'TRUE' ? '&nbsp;·&nbsp;<span style="color:var(--ink-faint);font-style:italic">Confidential</span>' : ''}
      </div>`;
    const markBtn = _el('btn-mark-answered');
    if (markBtn) markBtn.style.display = _isAdmin() ? '' : 'none';
    el.querySelectorAll('.prayer-item')?.forEach(x => x.classList.toggle('active', x.dataset.id === prayerId));
  }

  async function _markPrayerAnswered() {
    if (!_activePrayerId) return;
    await F.updateDoc(F.doc(db, _col('prayers'), _activePrayerId), {
      status: 'Answered', answeredAt: F.serverTimestamp()
    });
    _toast('Marked as answered! 🎉', 'success');
  }

  async function _submitNewPrayer() {
    const nameEl = _el('prayer-submit-name');
    const textEl = _el('prayer-submit-text');
    const catEl  = _el('prayer-submit-category');
    const confEl = _el('prayer-submit-confidential');
    const text = textEl?.value.trim() || '';
    if (!text) { _toast('Please describe your prayer request.', 'error'); return; }
    const okBtn = _el('prayer-modal-ok'); if (okBtn) okBtn.disabled = true;
    await F.addDoc(F.collection(db, _col('prayers')), {
      submitterName:  nameEl?.value.trim() || _me?.displayName || 'Anonymous',
      submitterEmail: _me?.email || '',
      submitterUid:   _me?.uid || '',
      prayerText:     text,
      category:       catEl?.value || '',
      isConfidential: confEl?.checked ? 'TRUE' : 'FALSE',
      status:         'New',
      submittedAt:    F.serverTimestamp()
    });
    _closeHiddenModal(_el('prayer-modal'));
    if (nameEl) nameEl.value = ''; if (textEl) textEl.value = '';
    if (catEl) catEl.value = ''; if (confEl) confEl.checked = false;
    if (okBtn) okBtn.disabled = false;
    _toast('Prayer request submitted 🙏', 'success');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANNOUNCEMENTS
  // ─────────────────────────────────────────────────────────────────────────
  function _startAnnounceListener() {
    if (_announceUnsub) return;
    const q = F.query(F.collection(db, _col('broadcasts')), F.orderBy('createdAt', 'desc'), F.limit(50));
    _announceUnsub = F.onSnapshot(q, snap => {
      _announces = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _renderAnnounceList();
    }, () => {});
  }

  function _renderAnnounceList() {
    const el = _el('announce-list'); if (!el) return;
    if (!_announces.length) {
      el.innerHTML = '<div style="text-align:center;padding:1.5rem 1rem;font-size:0.78rem;color:var(--ink-faint)"><div style="font-size:2rem">📢</div><p>No announcements yet.</p></div>';
      return;
    }
    el.innerHTML = _announces.map(a => `
      <div class="announce-item${_activeAnnounceId === a.id ? ' active' : ''}" data-id="${_esc(a.id)}" tabindex="0" role="button">
        <div style="font-size:0.78rem;font-weight:700;color:var(--announce-color)">${_esc(a.subject || 'Announcement')}</div>
        <div style="font-size:0.7rem;color:var(--ink-faint);margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${_esc(a.body || a.message || '')}</div>
      </div>`).join('');
    el.querySelectorAll('.announce-item').forEach(item => {
      item.addEventListener('click', () => _openAnnouncement(item.dataset.id));
      item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') _openAnnouncement(item.dataset.id); });
    });
  }

  function _openAnnouncement(announceId) {
    _activeAnnounceId = announceId; _activePrayerId = null;
    const a = _announces.find(x => x.id === announceId); if (!a) return;
    const panel = _el('announce-detail-panel');
    const threadPane = _el('thread-pane');
    const prayerPanel = _el('prayer-detail-panel');
    if (threadPane) threadPane.style.display = 'none';
    if (prayerPanel) prayerPanel.style.display = 'none';
    if (panel) panel.style.display = 'flex';
    const ts = a.createdAt?.toDate?.() || new Date();
    const detail = _el('announce-detail-content');
    if (detail) detail.innerHTML = `
      <div style="display:inline-block;font-size:0.62rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--announce-color);background:rgba(251,191,36,0.1);padding:2px 8px;border-radius:4px;margin-bottom:0.75rem">📢 Announcement</div>
      <h2 style="font-size:1.05rem;font-weight:800;margin:0 0 0.5rem">${_esc(a.subject || 'Announcement')}</h2>
      <p style="font-size:0.88rem;line-height:1.7;white-space:pre-wrap">${_esc(a.body || a.message || '')}</p>
      <div style="font-size:0.72rem;color:var(--ink-faint);margin-top:0.85rem">${a.sentBy ? 'Posted by ' + _esc(a.sentBy) : ''} · ${ts.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</div>`;
    el.querySelectorAll?.('.announce-item')?.forEach(x => x.classList.toggle('active', x.dataset.id === announceId));
  }

  async function _submitAnnouncement() {
    const subjectEl = _el('announce-submit-subject');
    const bodyEl    = _el('announce-submit-body');
    const subject = subjectEl?.value.trim() || '';
    const body    = bodyEl?.value.trim() || '';
    if (!subject) { _toast('Please enter a subject.', 'error'); return; }
    if (!body)    { _toast('Please write the announcement.', 'error'); return; }
    const okBtn = _el('announce-modal-ok'); if (okBtn) okBtn.disabled = true;
    await F.addDoc(F.collection(db, _col('broadcasts')), {
      subject, body,
      sentBy:    _me?.displayName || _me?.email || 'Admin',
      sentByUid: _me?.uid || '',
      audience:  'all',
      createdAt: F.serverTimestamp()
    });
    _closeHiddenModal(_el('announce-modal'));
    if (subjectEl) subjectEl.value = ''; if (bodyEl) bodyEl.value = '';
    if (okBtn) okBtn.disabled = false;
    _toast('Announcement posted! 📢', 'success');
  }

  function _bindPrayerUI() {
    // Sidebar Prayer section
    const prayerTab = _el('btn-nav-prayer');
    if (prayerTab) prayerTab.addEventListener('click', () => {
      _startPrayerListener();
      const scroll = _el('sidebar-prayer-scroll');
      const chatScroll = document.querySelector('.sidebar-scroll');
      if (chatScroll) chatScroll.style.display = 'none';
      ['sidebar-announce-scroll', 'sidebar-people-scroll'].forEach(id => { const el = _el(id); if (el) el.style.display = 'none'; });
      if (scroll) scroll.style.display = '';
      document.querySelectorAll('.sidebar-section-nav').forEach(b => b.classList.toggle('active', b === prayerTab));
    });

    // New Prayer btn
    _el('btn-new-prayer')?.addEventListener('click', () => _openHiddenModal(_el('prayer-modal')));

    // Modal buttons
    _el('prayer-modal-cancel')?.addEventListener('click', () => _closeHiddenModal(_el('prayer-modal')));
    _el('prayer-modal-ok')?.addEventListener('click', _submitNewPrayer);

    // Mark answered
    _el('btn-mark-answered')?.addEventListener('click', _markPrayerAnswered);

    // Announce
    const announceTab = _el('btn-nav-announce');
    if (announceTab) announceTab.addEventListener('click', () => {
      _startAnnounceListener();
      const scroll = _el('sidebar-announce-scroll');
      const chatScroll = document.querySelector('.sidebar-scroll');
      if (chatScroll) chatScroll.style.display = 'none';
      ['sidebar-prayer-scroll', 'sidebar-people-scroll'].forEach(id => { const el = _el(id); if (el) el.style.display = 'none'; });
      if (scroll) scroll.style.display = '';
      document.querySelectorAll('.sidebar-section-nav').forEach(b => b.classList.toggle('active', b === announceTab));
    });

    const chatTab = _el('btn-nav-channels');
    if (chatTab) chatTab.addEventListener('click', () => {
      const chatScroll = document.querySelector('.sidebar-scroll');
      if (chatScroll) chatScroll.style.display = '';
      ['sidebar-prayer-scroll', 'sidebar-announce-scroll', 'sidebar-people-scroll'].forEach(id => {
        const el = _el(id); if (el) el.style.display = 'none';
      });
      document.querySelectorAll('.sidebar-section-nav').forEach(b => b.classList.toggle('active', b === chatTab));
    });

    // People tab
    const peopleTab = _el('btn-nav-people');
    if (peopleTab) peopleTab.addEventListener('click', () => {
      const chatScroll = document.querySelector('.sidebar-scroll');
      if (chatScroll) chatScroll.style.display = 'none';
      ['sidebar-prayer-scroll', 'sidebar-announce-scroll'].forEach(id => {
        const el = _el(id); if (el) el.style.display = 'none';
      });
      const scroll = _el('sidebar-people-scroll');
      if (scroll) scroll.style.display = '';
      document.querySelectorAll('.sidebar-section-nav').forEach(b => b.classList.toggle('active', b === peopleTab));
      _renderPeopleList();
    });

    // People search input
    _el('people-search-input')?.addEventListener('input', (e) => _renderPeopleList(e.target.value));

    // New Announce btn
    _el('btn-new-announce')?.addEventListener('click', () => _openHiddenModal(_el('announce-modal')));
    _el('announce-modal-cancel')?.addEventListener('click', () => _closeHiddenModal(_el('announce-modal')));
    _el('announce-modal-ok')?.addEventListener('click', _submitAnnouncement);

    // Reply bar cancel
    _el('reply-cancel-btn')?.addEventListener('click', _clearReplyTarget);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PEOPLE & CONTACT COMPOSER
  // ─────────────────────────────────────────────────────────────────────────

  // Fetch a user's doc from the scoped collection, with a root fallback
  async function _fetchUserData(uid) {
    try {
      const snap = await F.getDoc(F.doc(db, _col('users'), uid));
      if (snap.exists()) return snap.data();
    } catch (_) {}
    // Fallback: try root users collection (handles pre-migration or default-scope users)
    if (_churchId !== 'default') {
      try {
        const snap = await F.getDoc(F.doc(db, 'users', uid));
        if (snap.exists()) return snap.data();
      } catch (_) {}
    }
    return null;
  }

  function _getRecentContacts() {
    try { return JSON.parse(localStorage.getItem('fc_recent_contacts_' + _churchId) || '[]'); }
    catch (_) { return []; }
  }

  function _addRecentContact(uid) {
    try {
      const recent = _getRecentContacts().filter(id => id !== uid);
      recent.unshift(uid);
      localStorage.setItem('fc_recent_contacts_' + _churchId, JSON.stringify(recent.slice(0, 10)));
    } catch (_) {}
  }

  async function _renderPeopleList(filter = '') {
    const container = _el('people-list');
    if (!container) return;
    container.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    try {
      const snap = await F.getDocs(F.collection(db, _col('users')));
      const recentIds = _getRecentContacts();
      const allUsers = [];
      snap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));

      // Sort: recent contacts first, then alphabetical
      allUsers.sort((a, b) => {
        const ai = recentIds.indexOf(a.id);
        const bi = recentIds.indexOf(b.id);
        if (ai !== -1 && bi === -1) return -1;
        if (bi !== -1 && ai === -1) return 1;
        if (ai !== -1 && bi !== -1) return ai - bi;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });

      const lq = (filter || '').toLowerCase();
      const filtered = lq
        ? allUsers.filter(u =>
            (u.displayName || '').toLowerCase().includes(lq) ||
            (u.email || '').toLowerCase().includes(lq))
        : allUsers;

      container.innerHTML = '';
      if (filtered.length === 0) {
        container.innerHTML = '<p style="font-size:0.83rem;color:var(--ink-faint);text-align:center;padding:20px">No members found.</p>';
        return;
      }

      let lastWasRecent = null;
      filtered.forEach(u => {
        const isRecent = recentIds.includes(u.id);
        const isSelf   = u.id === _me?.uid;

        // Section dividers (only when no active filter)
        if (!lq) {
          if (isRecent && lastWasRecent === null) {
            const lbl = document.createElement('div');
            lbl.className = 'people-section-label'; lbl.textContent = 'Recently Contacted';
            container.appendChild(lbl);
          } else if (!isRecent && (lastWasRecent === null || lastWasRecent === true)) {
            const lbl = document.createElement('div');
            lbl.className = 'people-section-label';
            lbl.textContent = isRecent ? 'Recently Contacted' : 'All Members';
            container.appendChild(lbl);
          }
        }
        lastWasRecent = isRecent;

        const initials = _initials(u.displayName || u.email || '?');
        const card = document.createElement('div');
        card.className = 'people-card';
        card.innerHTML = `
          <div class="member-avatar" style="width:36px;height:36px;font-size:0.8rem;flex-shrink:0">${_esc(initials)}</div>
          <div class="people-info">
            <div class="people-name">${_esc(u.displayName || u.email || 'Unknown')}${isSelf ? ' <em style="font-size:0.7rem;color:var(--ink-faint)">(you)</em>' : ''}</div>
            <div class="people-role">${_esc(ROLE_LABELS[u.role] || u.role || 'Member')}</div>
          </div>
          <button class="people-contact-btn" title="Contact">✉️</button>`;

        const openContact = () => _openContactModal({ ...u });
        card.querySelector('.people-contact-btn').addEventListener('click', e => { e.stopPropagation(); openContact(); });
        if (!isSelf) card.addEventListener('click', openContact);
        container.appendChild(card);
      });
    } catch (err) {
      container.innerHTML = '<p style="color:var(--danger);font-size:0.85rem;padding:12px">Could not load members.</p>';
      console.error(err);
    }
  }

  function _openContactModal(user) {
    _contactTarget = user;
    _addRecentContact(user.id);
    const nameEl    = _el('contact-name');
    const roleEl    = _el('contact-role');
    const avatarEl  = _el('contact-avatar');
    const smsBtn    = _el('btn-contact-sms');
    const emailBtn  = _el('btn-contact-email');
    const phoneHint = _el('contact-phone-hint');
    const msgInput  = _el('contact-message');
    if (nameEl)   nameEl.textContent   = user.displayName || user.email || 'Unknown';
    if (roleEl)   roleEl.textContent   = ROLE_LABELS[user.role] || user.role || 'Member';
    if (avatarEl) avatarEl.textContent = _initials(user.displayName || user.email || '?');
    if (msgInput) msgInput.value = '';
    const hasPhone = !!(user.phone || '').trim();
    const hasEmail = !!(user.email || '').trim();
    if (smsBtn)    smsBtn.style.display    = hasPhone ? '' : 'none';
    if (phoneHint) phoneHint.style.display = hasPhone ? 'none' : '';
    if (emailBtn)  emailBtn.style.display  = hasEmail ? '' : 'none';
    _openModal('modal-contact');
  }

  function _bindContactModal() {
    const cancelBtn = _el('btn-cancel-contact');
    if (cancelBtn) cancelBtn.addEventListener('click', () => _closeModal('modal-contact'));
    const backdrop = _el('modal-contact');
    if (backdrop) backdrop.addEventListener('click', e => { if (e.target === backdrop) _closeModal('modal-contact'); });

    const smsBtn   = _el('btn-contact-sms');
    const dmBtn    = _el('btn-contact-dm');
    const emailBtn = _el('btn-contact-email');

    if (smsBtn) smsBtn.addEventListener('click', () => {
      if (!_contactTarget) return;
      const phone = (_contactTarget.phone || '').trim();
      const msg   = (_el('contact-message')?.value || '').trim();
      const url   = 'sms:' + phone + (msg ? '?body=' + encodeURIComponent(msg) : '');
      window.open(url, '_self');
      _closeModal('modal-contact');
    });

    if (dmBtn) dmBtn.addEventListener('click', async () => {
      if (!_contactTarget) return;
      const otherId = _contactTarget.id;
      if (!otherId || otherId === _me?.uid) { _toast('Cannot DM yourself.', 'info'); return; }
      const msg       = (_el('contact-message')?.value || '').trim();
      const otherName = _contactTarget.displayName || _contactTarget.email || 'Unknown';
      _closeModal('modal-contact');
      const dmId  = [_me.uid, otherId].sort().join('_');
      const dmRef = F.doc(db, _col('dms'), dmId);
      const snap  = await F.getDoc(dmRef);
      if (!snap.exists()) {
        await F.setDoc(dmRef, { members: [_me.uid, otherId], lastMessage: '', lastTimestamp: F.serverTimestamp() });
      }
      _openDM({ id: dmId, members: [_me.uid, otherId] }, otherName);
      if (msg) {
        const input = _el('composer-input');
        if (input) { input.value = msg; input.dispatchEvent(new Event('input')); }
      }
    });

    if (emailBtn) emailBtn.addEventListener('click', () => {
      if (!_contactTarget) return;
      const email = (_contactTarget.email || '').trim();
      if (!email) return;
      const msg = (_el('contact-message')?.value || '').trim();
      const url = 'mailto:' + email + (msg ? '?body=' + encodeURIComponent(msg) : '');
      window.open(url, '_self');
      _closeModal('modal-contact');
    });
  }

  function _openHiddenModal(el) { if (el) el.removeAttribute('hidden'); }
  function _closeHiddenModal(el) { if (el) el.setAttribute('hidden', ''); }

  // ─────────────────────────────────────────────────────────────────────────
  return { init };
})();

// ── Wait for _FC to be ready (set by FlockChat.html inline module) ──────────
(function waitForFC() {
  if (!window._FC) { setTimeout(waitForFC, 50); return; }
  TheWord.init();
})();
