/* ═══════════════════════════════════════════════════════════════════════
   THE UPPER ROOM — Firebase Firestore Comms Module for FlockOS
   Real-time messaging: DMs, Chat Rooms, Channels, Notifications
   ═══════════════════════════════════════════════════════════════════════ */
;(function() {
  'use strict';

  /* ── Firebase Config ──────────────────────────────────────────────── */
  // Firebase API keys are public identifiers (not secrets).
  // Security is enforced by Firestore security rules, not key secrecy.
  // Per-church override: set window.FLOCK_FIREBASE_CONFIG before loading.
  var _DEFAULT_FIREBASE_CONFIG = {
    apiKey:            'AIzaSyBA-fkxjABbwIHn0i6MPiXbGwahfJmuJeo',
    authDomain:        'flockos-notify.firebaseapp.com',
    projectId:         'flockos-notify',
    storageBucket:     'flockos-notify.firebasestorage.app',
    messagingSenderId: '321766738616',
    appId:             '1:321766738616:web:d2c1c53ad7493fcde4c24d'
  };
  var FIREBASE_CONFIG = (typeof window.FLOCK_FIREBASE_CONFIG === 'object' && window.FLOCK_FIREBASE_CONFIG)
    ? window.FLOCK_FIREBASE_CONFIG
    : _DEFAULT_FIREBASE_CONFIG;

  /* ── State ────────────────────────────────────────────────────────── */
  var _db         = null;   // Firestore instance
  var _auth       = null;   // Firebase Auth instance
  var _churchId   = null;   // e.g. 'FlockOS', 'TheForest'
  var _userEmail  = null;   // logged-in user email
  var _userName   = null;   // logged-in display name
  var _initialized = false; // true once Firebase app + Firestore initialized
  var _ready      = false;  // true once Firebase auth + Firestore ready
  var _listeners  = {};     // active snapshot listeners (keyed by path)
  var _unreadDM   = 0;      // unread DM count
  var _unreadRoom = 0;      // unread room count
  var _permModulesCache = null; // session cache for static permissionModules config doc

  /* ── Timeout constant ───────────────────────────────────────────── */
  var FIRESTORE_TIMEOUT_MS = 8000; // 8 seconds — Firestore reads are typically sub-second

  /* ── Helpers ──────────────────────────────────────────────────────── */
  function _now()    { return firebase.firestore.FieldValue.serverTimestamp(); }
  function _ts(d)    { return d && d.toDate ? d.toDate() : (d ? new Date(d) : new Date()); }
  function _uid()    { return _db.collection('_').doc().id; }

  /**
   * Wrap any promise with a timeout.  If the promise doesn't settle
   * within `ms` milliseconds, reject with a user-friendly message.
   * @param {Promise} p   — the underlying promise (e.g. Firestore .get())
   * @param {number}  ms  — timeout in ms (default FIRESTORE_TIMEOUT_MS)
   * @param {string}  label — optional context for the error message
   */
  function _withTimeout(p, ms, label) {
    ms = ms || FIRESTORE_TIMEOUT_MS;
    return Promise.race([
      p,
      new Promise(function(_, reject) {
        setTimeout(function() {
          reject(new Error(
            (label || 'Request') + ' timed out after ' + (ms / 1000) + 's. Check your connection and try again.'
          ));
        }, ms);
      })
    ]);
  }

  function _churchRef() {
    // Collections live at the root of each church's own Firebase project —
    // no churches/{churchId}/ nesting needed; the project IS the boundary.
    return _db;
  }
  var _churchDoc = _churchRef;

  /* ── Universal pagination helper ──────────────────────────────────── */
  var _DEFAULT_PAGE = 25;
  /**
   * Apply startAfter cursor + limit to a query, execute, and return either
   * a plain array (legacy callers) or { results, lastDoc, hasMore, total? }.
   *   q      – Firestore query (already has orderBy)
   *   opts   – caller opts: { limit, startAfter, paginate, ...extras }
   *   mapFn  – optional: function(doc) → row  (default: doc.data() + id)
   */
  function _paginatedGet(q, opts, mapFn) {
    opts = opts || {};
    var lim = opts.limit || _DEFAULT_PAGE;
    q = q.limit(lim);
    if (opts.startAfter) q = q.startAfter(opts.startAfter);
    var _map = mapFn || function(doc) { var d = doc.data(); d.id = doc.id; return d; };
    return q.get().then(function(snap) {
      var results = [];
      snap.forEach(function(doc) { results.push(_map(doc)); });
      if (!opts.startAfter && !opts.paginate) return results;
      return {
        results: results,
        lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
        hasMore: snap.docs.length === lim
      };
    });
  }

  function _convosRef() {
    return _churchRef().collection('conversations');
  }

  /* ── Escaping (reuse FlockOS _e if available) ─────────────────────── */
  function _e(s) {
    if (typeof window._e === 'function') return window._e(s);
    var el = document.createElement('span');
    el.textContent = s || '';
    return el.innerHTML;
  }

  /* ── Time Ago ─────────────────────────────────────────────────────── */
  function _timeAgo(ts) {
    if (!ts) return '';
    var d = _ts(ts);
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
  }

  /* ── Init ─────────────────────────────────────────────────────────── */
  function init(config) {
    console.log('[FLOCK-DEBUG] UpperRoom.init() called — _initialized=' + _initialized);
    if (_initialized) return Promise.resolve();
    _initialized = true;

    // Accept optional config override
    if (config) FIREBASE_CONFIG = config;

    // Firebase SDK must be loaded
    if (typeof firebase === 'undefined' || !firebase.firestore) {
      console.warn('[FLOCK-DEBUG] UpperRoom.init() — Firebase SDK NOT LOADED');
      _initialized = false;
      return Promise.reject(new Error('Firebase SDK not available'));
    }

    // Initialize Firebase app (idempotent)
    if (!firebase.apps.length) {
      console.log('[FLOCK-DEBUG] UpperRoom.init() — initializing Firebase app, projectId=' + (FIREBASE_CONFIG ? FIREBASE_CONFIG.projectId : 'NONE'));
      firebase.initializeApp(FIREBASE_CONFIG);
    } else {
      console.log('[FLOCK-DEBUG] UpperRoom.init() — Firebase app already exists, projectId=' + firebase.apps[0].options.projectId);
    }
    _db   = firebase.firestore();
    _auth = firebase.auth();

    // Safari's WebChannel streaming transport can stall for ~30s on collection
    // queries before falling back to long polling. This setting detects the
    // stall and falls back immediately instead of waiting for the timeout.
    try { _db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (_) {}

    console.log('[FLOCK-DEBUG] UpperRoom.init() — Firestore and Auth initialized, churchId=' + _resolveChurchId());

    // Resolve churchId early so _churchRef() works even before authenticate()
    _churchId = _resolveChurchId();

    // Monitor token refreshes — custom claims (churchId, role) are NOT
    // persisted through automatic ID token refresh (~1 hour).  When the
    // refreshed token loses them, Firestore rules start rejecting reads.
    // This listener detects the loss and silently re-mints a custom token.
    var _reAuthInFlight = false;
    _auth.onIdTokenChanged(function(user) {
      if (!user || _reAuthInFlight) return;
      user.getIdTokenResult().then(function(result) {
        if (!result.claims || !result.claims.churchId) {
          _reAuthInFlight = true;
          _ready = false;
          _mintAndSignIn()
            .then(function()  { _reAuthInFlight = false; })
            .catch(function() { _reAuthInFlight = false; });
        }
      }).catch(function() {});
    });

    return Promise.resolve();
  }

  /* ── Authenticate via Custom Token from Apps Script ────────────── */
  function authenticate() {
    console.log('[FLOCK-DEBUG] UpperRoom.authenticate() called — _ready=' + _ready + ', hasCurrentUser=' + !!(_auth && _auth.currentUser));
    // Get session from FlockOS auth (available when running inside the Launcher/FlockOS app).
    var session = null;
    if (typeof Nehemiah !== 'undefined' && Nehemiah.getSession) {
      session = Nehemiah.getSession();
    } else if (typeof TheVine !== 'undefined' && TheVine.session) {
      session = TheVine.session();
    }

    // Determine churchId from page context (needed even in Firebase-only path).
    _churchId = _resolveChurchId();

    // Wait for Firebase Auth to finish restoring any persisted session from
    // IndexedDB. currentUser is null until this resolves, even if the user
    // was previously signed in.
    return new Promise(function(resolve, reject) {
      var _unsub = _auth.onAuthStateChanged(function(user) {
        _unsub(); // only need the first callback
        console.log('[FLOCK-DEBUG] UpperRoom.authenticate() — onAuthStateChanged fired, user=' + (user ? user.uid : 'null'));

        if (user) {
          // Firebase persisted a session — fill in email from Firebase user if
          // Nehemiah/TheVine session isn't available (e.g. standalone app page).
          if (!session || !session.email) {
            _userEmail = user.email || user.uid;
            _userName  = user.displayName || user.email || user.uid;
            console.log('[FLOCK-DEBUG] UpperRoom.authenticate() — no FlockOS session; using Firebase user email=' + _userEmail);
          } else {
            _userEmail = session.email;
            _userName  = session.displayName || session.email;
          }
          console.log('[FLOCK-DEBUG] UpperRoom.authenticate() — email=' + _userEmail + ', churchId=' + _churchId);

          // Verify custom claims are still present.
          console.log('[FLOCK-DEBUG] UpperRoom.authenticate() — restored user, checking claims…');
          _withTimeout(
            user.getIdTokenResult()
              .then(function(result) {
                console.log('[FLOCK-DEBUG] UpperRoom.authenticate() — claims: churchId=' + (result.claims ? result.claims.churchId : 'NONE') + ', role=' + (result.claims ? result.claims.role : 'NONE'));
                if (result.claims && result.claims.churchId) {
                  _ready = true;
                  console.log('[FLOCK-DEBUG] UpperRoom.authenticate() — FAST PATH: reusing persisted session (no GAS call)');
                  return;  // claims intact — no re-auth needed
                }
                // Claims lost after token refresh — get a fresh custom token.
                // This requires Nehemiah/TheVine to be available.
                if (!session || !session.email) {
                  throw new Error('No FlockOS session — please sign in from the FlockOS Launcher first.');
                }
                console.log('[FLOCK-DEBUG] UpperRoom.authenticate() — claims LOST, re-minting…');
                return _mintAndSignIn();
              }),
            30000, 'Firebase authentication'
          ).then(resolve).catch(reject);
        } else {
          // No persisted Firebase session at all — require Nehemiah/TheVine to mint a new one.
          if (!session || !session.email) {
            console.error('[FLOCK-DEBUG] UpperRoom.authenticate() — no Firebase session and no FlockOS session');
            return reject(new Error('No FlockOS session — please sign in from the FlockOS Launcher first.'));
          }
          _userEmail = session.email;
          _userName  = session.displayName || session.email;
          console.log('[FLOCK-DEBUG] UpperRoom.authenticate() — not signed in, calling _mintAndSignIn()…');
          _mintAndSignIn().then(resolve).catch(reject);
        }
      });
    });
  }

  /* ── Mint a fresh custom token from GAS and sign in ────────────── */
  function _mintAndSignIn() {
    console.log('[FLOCK-DEBUG] _mintAndSignIn() calling TheVine.flock.firebase.token({ churchId: ' + _churchId + ' })…');
    var _mintStart = Date.now();
    return TheVine.flock.firebase.token({ churchId: _churchId })
      .then(function(res) {
        var token = res && (res.token || res.customToken);
        console.log('[FLOCK-DEBUG] _mintAndSignIn() token received in ' + (Date.now() - _mintStart) + 'ms — hasToken=' + !!token + ', tokenLength=' + (token ? token.length : 0));
        if (!token) throw new Error('No custom token returned from GAS');
        console.log('[FLOCK-DEBUG] _mintAndSignIn() calling signInWithCustomToken…');
        return _auth.signInWithCustomToken(token);
      })
      .then(function() {
        _ready = true;
        console.log('[FLOCK-DEBUG] _mintAndSignIn() SUCCESS — _ready=true, uid=' + (_auth.currentUser ? _auth.currentUser.uid : 'N/A'));
      })
      .catch(function(err) {
        console.error('[FLOCK-DEBUG] _mintAndSignIn() FAILED:', err);
        // Re-throw with the Firebase error code included so callers can surface it
        var code = err && err.code ? ' (' + err.code + ')' : '';
        throw new Error((err && err.message ? err.message : String(err)) + code);
      });
  }

  /* ── Resolve churchId from page/config ────────────────────────── */
  function _resolveChurchId() {
    // Try build-injected church ID (window.FLOCK_CHURCH_ID set by A-Build_Churches.sh)
    if (typeof window.FLOCK_CHURCH_ID === 'string' && window.FLOCK_CHURCH_ID) return window.FLOCK_CHURCH_ID;
    // Try manifest short_name
    try {
      var meta = document.querySelector('meta[name="church-id"]');
      if (meta) return meta.content;
    } catch (_) {}
    // Try URL path: /Covenant/Nations/TheForest/ -> TheForest
    var m = window.location.pathname.match(/\/Covenant\/Nations\/([^/]+)\//);
    if (m) return m[1];
    // Backward compatibility for older deployment paths.
    m = window.location.pathname.match(/\/Church\/([^/]+)\//);
    if (m) return m[1];
    // Default FlockOS
    return 'FlockOS';
  }

  /* ══════════════════════════════════════════════════════════════════
     CONVERSATIONS — unified: DMs, Rooms, Channels
     ══════════════════════════════════════════════════════════════════ */

  /* ── Create a DM conversation ───────────────────────────────────── */
  function createDM(recipientEmail, recipientName) {
    // Check for existing DM between these two users
    var participants = [_userEmail, recipientEmail].sort();
    var dmId = 'dm_' + participants.join('_').replace(/[^a-zA-Z0-9_]/g, '-');

    return _convosRef().doc(dmId).get().then(function(doc) {
      if (doc.exists) return doc.id;
      return _convosRef().doc(dmId).set({
        type:         'dm',
        participants: participants,
        participantNames: _buildNameMap(recipientEmail, recipientName),
        createdBy:    _userEmail,
        createdAt:    _now(),
        lastMessageAt: _now(),
        lastSnippet:  '',
        unreadBy:     []
      }).then(function() { return dmId; });
    });
  }

  /* ── Create a Chat Room ─────────────────────────────────────────── */
  function createRoom(name, description, memberEmails) {
    var roomId = _uid();
    var allMembers = [_userEmail].concat(memberEmails || []);
    // Deduplicate
    var seen = {};
    allMembers = allMembers.filter(function(e) {
      if (seen[e]) return false;
      seen[e] = true;
      return true;
    });

    return _convosRef().doc(roomId).set({
      type:         'room',
      name:         name || 'New Room',
      description:  description || '',
      participants: allMembers,
      createdBy:    _userEmail,
      createdAt:    _now(),
      lastMessageAt: _now(),
      lastSnippet:  '',
      memberCount:  allMembers.length,
      unreadBy:     []
    }).then(function() { return roomId; });
  }

  /* ── Create a Channel (broadcast) ───────────────────────────────── */
  function createChannel(name, description) {
    var channelId = _uid();
    return _convosRef().doc(channelId).set({
      type:            'channel',
      name:            name || 'New Channel',
      description:     description || '',
      subscribers:     [_userEmail],
      createdBy:       _userEmail,
      createdAt:       _now(),
      lastMessageAt:   _now(),
      lastSnippet:     '',
      subscriberCount: 1,
      postPermission:  'admin',  // 'admin', 'leader', 'anyone'
      unreadBy:        []
    }).then(function() { return channelId; });
  }

  /* ── List conversations by type ─────────────────────────────────── */
  function listConversations(type) {
    return _convosRef()
      .where(type === 'channel' ? 'subscribers' : 'participants', 'array-contains', _userEmail)
      .where('type', '==', type)
      .orderBy('lastMessageAt', 'desc')
      .limit(50)
      .get()
      .then(function(snap) {
        var results = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          if (d.status !== 'archived') results.push(d);
        });
        return results;
      });
  }

  /* ── Listen to conversation list (real-time) ────────────────────── */
  function listenConversations(type, callback) {
    var key = 'list_' + type;
    _unlisten(key);

    // _userEmail is set by authenticate(), but the new shell doesn't call that
    // during boot — only during login or when the Learning Hub opens.  Self-heal
    // by reading the session directly so Fellowship works without a prior auth call.
    if (!_userEmail) {
      var _sess = null;
      if (typeof Nehemiah !== 'undefined' && Nehemiah.getSession) _sess = Nehemiah.getSession();
      else if (typeof TheVine !== 'undefined' && TheVine.session) _sess = TheVine.session();
      if (_sess && _sess.email) {
        _userEmail = _sess.email;
        _userName  = _sess.displayName || _sess.email;
      }
    }
    if (!_userEmail) { callback([]); return; } // no session at all — return empty

    var field = type === 'channel' ? 'subscribers' : 'participants';
    _listeners[key] = _convosRef()
      .where(field, 'array-contains', _userEmail)
      .where('type', '==', type)
      .orderBy('lastMessageAt', 'desc')
      .limit(50)
      .onSnapshot(function(snap) {
        var results = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          if (d.status !== 'archived') results.push(d);
        });
        callback(results);
      }, function(err) {
        console.error('[UpperRoom] listenConversations error:', err);
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     MESSAGES
     ══════════════════════════════════════════════════════════════════ */

  /* ── Send a message ─────────────────────────────────────────────── */
  function sendMessage(convoId, body, opts) {
    opts = opts || {};
    var msgId = _uid();
    var msgRef = _convosRef().doc(convoId).collection('messages').doc(msgId);
    var convoRef = _convosRef().doc(convoId);

    var msgData = {
      body:        body,
      senderEmail: _userEmail,
      senderName:  _userName,
      sentAt:      _now(),
      replyTo:     opts.replyTo || null,
      attachmentUrl:  opts.attachmentUrl || null,
      attachmentName: opts.attachmentName || null
    };

    var snippet = body.length > 80 ? body.substring(0, 80) + '…' : body;

    // Batch: write message + update conversation metadata.
    // Use set({ merge: true }) instead of update() so the conversation doc
    // is created automatically if it doesn't exist (e.g. #prayer-chain seeded
    // by name but never explicitly created via createChannel).
    var batch = _db.batch();
    batch.set(msgRef, msgData);
    batch.set(convoRef, {
      lastMessageAt: _now(),
      lastSnippet:   snippet,
      lastSenderName: _userName
    }, { merge: true });
    return batch.commit().then(function() {
      // If this is a DM, bump open care cases for the other participant — fire-and-forget.
      // Keeps "last updated" current whenever the pastor messages a member via FlockChat.
      if (String(convoId).indexOf('dm_') === 0) {
        _convosRef().doc(convoId).get().then(function(doc) {
          if (!doc.exists) return;
          var parts = doc.data().participants || [];
          var otherEmail = '';
          for (var pi = 0; pi < parts.length; pi++) {
            if (parts[pi] !== _userEmail) { otherEmail = parts[pi]; break; }
          }
          if (!otherEmail) return;
          return getMember(otherEmail).then(function(m) {
            if (m && m.id) _touchOpenCareCases(m.id, 'flockchat');
          });
        }).catch(function(e) { console.warn('[UpperRoom] DM care touch failed:', e); });
      }
      return msgId;
    });
  }

  /* ── Fetch messages (one-time) ──────────────────────────────────── */
  function getMessages(convoId, limitN) {
    return _convosRef().doc(convoId).collection('messages')
      .orderBy('sentAt', 'asc')
      .limit(limitN || 100)
      .get()
      .then(function(snap) {
        var msgs = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          msgs.push(d);
        });
        return msgs;
      });
  }

  /* ── Listen to messages (real-time) ─────────────────────────────── */
  function listenMessages(convoId, callback) {
    var key = 'msgs_' + convoId;
    _unlisten(key);

    _listeners[key] = _convosRef().doc(convoId).collection('messages')
      .orderBy('sentAt', 'asc')
      .limitToLast(100)
      .onSnapshot(function(snap) {
        var msgs = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          msgs.push(d);
        });
        callback(msgs);
      }, function(err) {
        console.error('[UpperRoom] listenMessages error:', err);
      });
  }

  /* ── Delete a message ───────────────────────────────────────────── */
  function deleteMessage(convoId, msgId) {
    return _convosRef().doc(convoId).collection('messages').doc(msgId).delete();
  }

  /* ══════════════════════════════════════════════════════════════════
     ROOM / CONVERSATION MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  /* ── Join a room ────────────────────────────────────────────────── */
  function joinRoom(convoId) {
    return _convosRef().doc(convoId).update({
      participants: firebase.firestore.FieldValue.arrayUnion(_userEmail),
      memberCount:  firebase.firestore.FieldValue.increment(1)
    });
  }

  /* ── Leave a room ───────────────────────────────────────────────── */
  function leaveRoom(convoId) {
    return _convosRef().doc(convoId).update({
      participants: firebase.firestore.FieldValue.arrayRemove(_userEmail),
      memberCount:  firebase.firestore.FieldValue.increment(-1)
    });
  }

  /* ── Add participant ────────────────────────────────────────────── */
  function addParticipant(convoId, email) {
    return _convosRef().doc(convoId).update({
      participants: firebase.firestore.FieldValue.arrayUnion(email),
      memberCount:  firebase.firestore.FieldValue.increment(1)
    });
  }

  /* ── Update room/channel metadata ───────────────────────────────── */
  function updateConversation(convoId, data) {
    return _convosRef().doc(convoId).update(data);
  }

  /* ── Archive conversation ───────────────────────────────────────── */
  function archiveConversation(convoId) {
    return _convosRef().doc(convoId).update({ status: 'archived' });
  }

  /* ── Delete conversation (pastor/admin only) ────────────────────── */
  function deleteConversation(convoId) {
    return _convosRef().doc(convoId).delete();
  }

  /* ── Get a single conversation ──────────────────────────────────── */
  function getConversation(convoId) {
    return _convosRef().doc(convoId).get().then(function(doc) {
      if (!doc.exists) return null;
      var d = doc.data();
      d.id = doc.id;
      return d;
    });
  }

  /* ── Create a Group Thread ─────────────────────────────────────────── */
  function createThread(subject, memberEmails, firstMessage) {
    var threadId = _uid();
    var allMembers = [_userEmail].concat(memberEmails || []);
    var seen = {};
    allMembers = allMembers.filter(function(e) {
      if (!e || seen[e]) return false;
      seen[e] = true;
      return true;
    });
    var snippet = firstMessage
      ? (firstMessage.length > 80 ? firstMessage.substring(0, 80) + '…' : firstMessage)
      : '';
    return _convosRef().doc(threadId).set({
      type:          'thread',
      subject:       subject || 'New Thread',
      participants:  allMembers,
      createdBy:     _userEmail,
      createdAt:     _now(),
      lastMessageAt: _now(),
      lastSnippet:   snippet,
      memberCount:   allMembers.length,
      unreadBy:      []
    }).then(function() {
      if (!firstMessage) return threadId;
      return sendMessage(threadId, firstMessage).then(function() { return threadId; });
    });
  }

  /* ── Conversations I started (Sent view) ────────────────────────────── */
  function listSentConversations() {
    return _convosRef()
      .where('createdBy', '==', _userEmail)
      .orderBy('lastMessageAt', 'desc')
      .limit(50)
      .get()
      .then(function(snap) {
        var results = [];
        snap.forEach(function(doc) {
          var d = doc.data(); d.id = doc.id; results.push(d);
        });
        return results;
      });
  }

  /* ── App-level settings (comms mode per church) ─────────────────────── */
  function getCommsMode() {
    console.log('[FLOCK-DEBUG] UpperRoom.getCommsMode() querying settings/app…');
    var _gcmStart = Date.now();
    return _churchRef().collection('settings').doc('app')
      .get()
      .then(function(doc) {
        var mode = !doc.exists ? 'firebase' : (doc.data().commsMode || 'firebase');
        console.log('[FLOCK-DEBUG] UpperRoom.getCommsMode() RESULT: ' + mode + ' (exists=' + doc.exists + ', ' + (Date.now() - _gcmStart) + 'ms)');
        return mode;
      })
      .catch(function(err) {
        console.error('[FLOCK-DEBUG] UpperRoom.getCommsMode() ERROR:', err);
        return 'firebase';
      });
  }

  function setCommsMode(mode) {
    return _churchRef().collection('settings').doc('app')
      .set({ commsMode: mode }, { merge: true });
  }

  /* ── Browse available rooms (discoverable) ──────────────────────── */
  function browseRooms() {
    return _convosRef()
      .where('type', '==', 'room')
      .orderBy('lastMessageAt', 'desc')
      .limit(50)
      .get()
      .then(function(snap) {
        var rooms = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          if (d.status !== 'archived') rooms.push(d);
        });
        return rooms;
      });
  }

  /* ── Browse all channels (discoverable) ─────────────────────────── */
  function browseChannels() {
    return _convosRef()
      .where('type', '==', 'channel')
      .orderBy('lastMessageAt', 'desc')
      .limit(50)
      .get()
      .then(function(snap) {
        var channels = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          d.memberCount = d.subscriberCount || (d.subscribers ? d.subscribers.length : 0);
          if (d.status !== 'archived') channels.push(d);
        });
        return channels;
      });
  }

  /* ── Subscribe / unsubscribe channel ────────────────────────────── */
  function subscribeChannel(channelId) {
    return _convosRef().doc(channelId).update({
      subscribers:     firebase.firestore.FieldValue.arrayUnion(_userEmail),
      subscriberCount: firebase.firestore.FieldValue.increment(1)
    });
  }

  function unsubscribeChannel(channelId) {
    return _convosRef().doc(channelId).update({
      subscribers:     firebase.firestore.FieldValue.arrayRemove(_userEmail),
      subscriberCount: firebase.firestore.FieldValue.increment(-1)
    });
  }

  /* ── Post to channel (creates a message in the channel convo) ───── */
  function postToChannel(channelId, subject, body) {
    var msgBody = subject ? ('**' + subject + '**\n\n' + body) : body;
    return sendMessage(channelId, msgBody);
  }

  /* ══════════════════════════════════════════════════════════════════
     TEMPLATES — churches/{churchId}/templates
     ══════════════════════════════════════════════════════════════════ */

  function _templatesRef() {
    return _churchRef().collection('templates');
  }

  function listTemplates() {
    return _templatesRef()
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
      .then(function(snap) {
        var results = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          results.push(d);
        });
        return results;
      });
  }

  function getTemplate(id) {
    return _templatesRef().doc(id).get().then(function(doc) {
      if (!doc.exists) return null;
      var d = doc.data();
      d.id = doc.id;
      return d;
    });
  }

  function createTemplate(data) {
    var id = _uid();
    return _templatesRef().doc(id).set({
      name:      data.name || '',
      category:  data.category || '',
      subject:   data.subject || '',
      body:      data.body || '',
      createdBy: _userEmail,
      createdAt: _now(),
      updatedAt: _now()
    }).then(function() { return id; });
  }

  function updateTemplate(id, data) {
    data.updatedAt = _now();
    return _templatesRef().doc(id).update(data);
  }

  function deleteTemplate(id) {
    return _templatesRef().doc(id).delete();
  }

  /* ══════════════════════════════════════════════════════════════════
     BROADCASTS — churches/{churchId}/broadcasts
     ══════════════════════════════════════════════════════════════════ */

  function _broadcastsRef() {
    return _churchRef().collection('broadcasts');
  }

  function listBroadcasts(limitN) {
    return _broadcastsRef()
      .orderBy('createdAt', 'desc')
      .limit(limitN || 50)
      .get()
      .then(function(snap) {
        var results = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          results.push(d);
        });
        return results;
      });
  }

  function createBroadcast(data) {
    var id = _uid();
    return _broadcastsRef().doc(id).set({
      subject:        data.subject || '',
      body:           data.body || data.message || '',
      audience:       data.audience || 'all',
      recipientCount: data.recipientCount || 0,
      openCount:      0,
      status:         'sent',
      sentBy:         _userEmail,
      createdAt:      _now()
    }).then(function() { return id; });
  }

  /* ══════════════════════════════════════════════════════════════════
     NOTIFICATION PREFERENCES — churches/{churchId}/settings/notifPrefs_{email}
     ══════════════════════════════════════════════════════════════════ */

  function _notifPrefsDocId() {
    return 'notifPrefs_' + _userEmail.replace(/[^a-zA-Z0-9]/g, '-');
  }

  function getNotifPrefs() {
    return _churchRef().collection('settings').doc(_notifPrefsDocId())
      .get()
      .then(function(doc) {
        if (!doc.exists) return {};
        return doc.data();
      })
      .catch(function() { return {}; });
  }

  function updateNotifPrefs(prefs) {
    return _churchRef().collection('settings').doc(_notifPrefsDocId())
      .set(prefs, { merge: true });
  }

  /* ══════════════════════════════════════════════════════════════════
     PRAYER REQUESTS — churches/{churchId}/prayers
     ══════════════════════════════════════════════════════════════════ */

  function _prayersRef() {
    return _churchRef().collection('prayers');
  }

  function listPrayers(opts) {
    opts = opts || {};
    console.log('[FLOCK-DEBUG] UpperRoom.listPrayers() called — allUsers=' + !!opts.allUsers + ', _userEmail=' + _userEmail + ', _ready=' + _ready + ', hasDb=' + !!_db);
    var q = _prayersRef();
    // Filter by current user's email unless opts.allUsers is set (admin/pastor).
    // Firestore rules require createdBy == userEmail() or isConfidential != true;
    // without a matching .where(), the query is rejected for non-pastor users
    // and the .catch(() => []) silently returns an empty array.
    if (!opts.allUsers && _userEmail) {
      q = q.where('createdBy', '==', _userEmail);
    }
    q = q.orderBy('submittedAt', 'desc').limit(opts.limit || _DEFAULT_PAGE);
    if (opts.startAfter) q = q.startAfter(opts.startAfter);
    console.log('[FLOCK-DEBUG] UpperRoom.listPrayers() executing query…');
    var _lpStart = Date.now();
    return q.get().then(function(snap) {
      var results = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        d.id = doc.id;
        results.push(d);
      });
      console.log('[FLOCK-DEBUG] UpperRoom.listPrayers() DONE: ' + results.length + ' rows in ' + (Date.now() - _lpStart) + 'ms');
      if (!opts.startAfter && !opts.paginate) return results;
      return { results: results, lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null, hasMore: snap.docs.length === (opts.limit || _DEFAULT_PAGE) };
    });
  }


  function countOpenPrayers() {
    return _prayersRef()
      .where('status', 'not-in', ['answered','closed','archived'])
      .get().then(function(snap) { return snap.size; });
  }
  function getPrayer(id) {
    return _prayersRef().doc(id).get().then(function(doc) {
      if (!doc.exists) return null;
      var d = doc.data();
      d.id = doc.id;
      return d;
    });
  }

  function createPrayer(data) {
    var id = _uid();
    // Auto-assign to lead pastor from AppConfig if not explicitly assigned
    return getAppConfig({ key: 'LEAD_PASTOR_MEMBER_ID' }).then(function(cfg) {
      var defaultAssignee = (cfg && cfg.value) ? String(cfg.value).trim() : '';
      return _prayersRef().doc(id).set({
        submitterName:     data.submitterName || 'Anonymous',
        submitterEmail:    data.submitterEmail || _userEmail,
        submitterPhone:    data.submitterPhone || '',
        prayerText:        data.prayerText || '',
        category:          data.category || '',
        status:            'New',
        isConfidential:    data.isConfidential || 'FALSE',
        followUpRequested: data.followUpRequested || 'FALSE',
        assignedTo:        data.assignedTo || defaultAssignee || '',
        adminNotes:        '',
        createdBy:         _userEmail,
        submittedAt:       _now(),
        lastUpdated:       _now(),
        updatedBy:         _userEmail
      }).then(function() { return id; });
    }).catch(function() {
      // If AppConfig lookup fails, still create the prayer (unassigned)
      return _prayersRef().doc(id).set({
        submitterName:     data.submitterName || 'Anonymous',
        submitterEmail:    data.submitterEmail || _userEmail,
        submitterPhone:    data.submitterPhone || '',
        prayerText:        data.prayerText || '',
        category:          data.category || '',
        status:            'New',
        isConfidential:    data.isConfidential || 'FALSE',
        followUpRequested: data.followUpRequested || 'FALSE',
        assignedTo:        data.assignedTo || '',
        adminNotes:        '',
        createdBy:         _userEmail,
        submittedAt:       _now(),
        lastUpdated:       _now(),
        updatedBy:         _userEmail
      }).then(function() { return id; });
    });
  }

  function updatePrayer(id, data) {
    data.lastUpdated = _now();
    data.updatedBy   = _userEmail;
    return _prayersRef().doc(id).update(data);
  }

  function deletePrayer(id) {
    return _prayersRef().doc(id).delete();
  }

  function listPrayerInteractions(prayerId) {
    return _prayersRef().doc(prayerId).collection('interactions')
      .orderBy('createdAt', 'desc').limit(100).get()
      .then(function(snap) {
        return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      });
  }

  function addPrayerInteraction(prayerId, data) {
    var rec = Object.assign({}, data, { createdAt: _now(), createdBy: _userEmail });
    return _prayersRef().doc(prayerId).collection('interactions').add(rec)
      .then(function(ref) { return Object.assign({ id: ref.id }, rec); });
  }

  /* ── Listen to prayers (real-time for public wall) ──────────────── */
  function listenPrayers(callback) {
    var key = 'prayers';
    _unlisten(key);

    _listeners[key] = _prayersRef()
      .orderBy('submittedAt', 'desc')
      .limit(100)
      .onSnapshot(function(snap) {
        var results = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          results.push(d);
        });
        callback(results);
      }, function(err) {
        console.error('[UpperRoom] listenPrayers error:', err);
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     TODOS / TASKS — churches/{churchId}/todos
     ══════════════════════════════════════════════════════════════════ */

  function _todosRef() {
    return _churchRef().collection('todos');
  }

  function listTodos(opts) {
    opts = opts || {};
    var q = _todosRef().orderBy('createdAt', 'desc');
    return _paginatedGet(q, opts);
  }

  function myTodos() {
    return _todosRef()
      .where('assignedTo', '==', _userEmail)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get()
      .then(function(snap) {
        var results = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          results.push(d);
        });
        return results;
      });
  }

  function createTodo(data) {
    var id = _uid();
    return _todosRef().doc(id).set({
      title:          data.title || '',
      description:    data.description || '',
      dueDate:        data.dueDate || '',
      priority:       data.priority || 'Medium',
      status:         data.status || 'Not Started',
      category:       data.category || 'Other',
      recurring:      data.recurring === 'true' || data.recurring === true,
      recurrenceRule: data.recurrenceRule || '',
      assignedTo:     data.assignedTo || _userEmail,
      entityType:     data.entityType || '',
      entityId:       data.entityId || '',
      notes:          data.notes || '',
      createdBy:      _userEmail,
      createdAt:      _now(),
      updatedAt:      _now()
    }).then(function() { return id; });
  }

  function updateTodo(id, data) {
    data.updatedAt = _now();
    return _todosRef().doc(id).update(data);
  }

  function completeTodo(id) {
    return _todosRef().doc(id).update({
      status:      'Done',
      completedAt: _now(),
      updatedAt:   _now()
    });
  }

  function archiveTodo(id) {
    return _todosRef().doc(id).update({
      status:    'Archived',
      updatedAt: _now()
    });
  }

  function unarchiveTodo(id) {
    return _todosRef().doc(id).update({
      status:    'Not Started',
      updatedAt: _now()
    });
  }

  function deleteTodo(id) {
    return _todosRef().doc(id).delete();
  }

  /* ── Listen to todos (real-time) ────────────────────────────────── */
  function listenTodos(callback) {
    var key = 'todos';
    _unlisten(key);

    _listeners[key] = _todosRef()
      .orderBy('createdAt', 'desc')
      .limit(200)
      .onSnapshot(function(snap) {
        var results = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          results.push(d);
        });
        callback(results);
      }, function(err) {
        console.error('[UpperRoom] listenTodos error:', err);
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     NOTIFICATIONS
     ══════════════════════════════════════════════════════════════════ */

  function _notifsRef() {
    return _churchRef().collection('notifications');
  }

  /* ── Create notification ────────────────────────────────────────── */
  function createNotification(recipientEmail, title, body, entityType, entityId) {
    return _notifsRef().add({
      recipientEmail: recipientEmail,
      title:          title,
      body:           body,
      entityType:     entityType || 'message',
      entityId:       entityId || '',
      read:           false,
      createdAt:      _now()
    });
  }

  /* ── Listen to my notifications (real-time) ─────────────────────── */
  function listenNotifications(callback) {
    var key = 'my_notifs';
    _unlisten(key);

    _listeners[key] = _notifsRef()
      .where('recipientEmail', '==', _userEmail)
      .where('read', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(30)
      .onSnapshot(function(snap) {
        var notifs = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          notifs.push(d);
        });
        callback(notifs);
      });
  }

  /* ── Mark notification read ─────────────────────────────────────── */
  function markNotifRead(notifId) {
    return _notifsRef().doc(notifId).update({ read: true, readAt: _now() });
  }

  /* ── Mark all notifications read ────────────────────────────────── */
  function markAllNotifsRead() {
    return _notifsRef()
      .where('recipientEmail', '==', _userEmail)
      .where('read', '==', false)
      .get()
      .then(function(snap) {
        var batch = _db.batch();
        snap.forEach(function(doc) {
          batch.update(doc.ref, { read: true, readAt: _now() });
        });
        return batch.commit();
      });
  }

  /* ── Unread count ───────────────────────────────────────────────── */
  function getUnreadCount() {
    return _notifsRef()
      .where('recipientEmail', '==', _userEmail)
      .where('read', '==', false)
      .get()
      .then(function(snap) { return snap.size; });
  }

  /* ── List notifications (one-shot) ──────────────────────────────── */
  function listNotifications(opts) {
    opts = opts || {};
    return _notifsRef()
      .where('recipientEmail', '==', _userEmail)
      .orderBy('createdAt', 'desc')
      .limit(opts.limit || 60)
      .get()
      .then(function(snap) {
        var out = [];
        snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
        return out;
      });
  }

  /* ── Dismiss (delete) a notification ────────────────────────────── */
  function dismissNotification(notifId) {
    return _notifsRef().doc(notifId).delete();
  }

  /* ══════════════════════════════════════════════════════════════════
     TYPING INDICATORS (ephemeral — auto-expire)
     ══════════════════════════════════════════════════════════════════ */

  function setTyping(convoId, isTyping) {
    var ref = _convosRef().doc(convoId).collection('typing').doc(_userEmail);
    if (isTyping) {
      return ref.set({ name: _userName, at: _now() });
    }
    return ref.delete().catch(function() {});
  }

  function listenTyping(convoId, callback) {
    var key = 'typing_' + convoId;
    _unlisten(key);

    _listeners[key] = _convosRef().doc(convoId).collection('typing')
      .onSnapshot(function(snap) {
        var typers = [];
        snap.forEach(function(doc) {
          if (doc.id !== _userEmail) {
            var d = doc.data();
            // Only show if typed within last 10 seconds
            var at = d.at && d.at.toDate ? d.at.toDate() : null;
            if (at && (Date.now() - at.getTime()) < 10000) {
              typers.push(d.name || doc.id);
            }
          }
        });
        callback(typers);
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     CLEANUP
     ══════════════════════════════════════════════════════════════════ */

  function _unlisten(key) {
    if (_listeners[key]) {
      _listeners[key]();
      delete _listeners[key];
    }
  }

  function detachAll() {
    Object.keys(_listeners).forEach(function(k) {
      if (typeof _listeners[k] === 'function') _listeners[k]();
    });
    _listeners = {};
  }

  function signOut() {
    detachAll();
    _ready = false;
    if (_auth) return _auth.signOut();
    return Promise.resolve();
  }

  /* ── Name map helper ────────────────────────────────────────────── */
  function _buildNameMap(email, name) {
    var map = {};
    map[_userEmail] = _userName;
    if (email && name) map[email] = name;
    return map;
  }

  /* ══════════════════════════════════════════════════════════════════
     USERS — churches/{churchId}/users
     ══════════════════════════════════════════════════════════════════ */

  function _usersRef() {
    return _churchRef().collection('users');
  }

  function listUsers() { return Promise.reject('User admin moved to GAS — use TheVine.flock.users.list()'); }
  function getUser()   { return Promise.reject('User admin moved to GAS'); }

  // ── User admin functions REMOVED ─────────────────────────────────────
  // User administration (create, update, approve, deny, reset passcode)
  // is now handled exclusively by GAS (TheVine) to ensure passwords are
  // hashed server-side and auth data never enters Firestore.
  // See: the_shepherd.js, the_tabernacle.js, the_life.js → TheVine.flock.users.*

  function createUser()    { return Promise.reject('User admin moved to GAS — use TheVine.flock.users.create()'); }
  function updateUser()    { return Promise.reject('User admin moved to GAS — use TheVine.flock.users.update()'); }
  function approveUser()   { return Promise.reject('User admin moved to GAS — use TheVine.flock.users.approve()'); }
  function denyUser()      { return Promise.reject('User admin moved to GAS — use TheVine.flock.users.deny()'); }
  function resetPasscode() { return Promise.reject('User admin moved to GAS — use TheVine.flock.users.resetPasscode()'); }

  /* ══════════════════════════════════════════════════════════════════
     MEMBERS — churches/{churchId}/members
     ══════════════════════════════════════════════════════════════════ */

  function _membersRef() {
    return _churchRef().collection('members');
  }

  function listMembers(opts) {
    opts = opts || {};
    var q = _membersRef().orderBy('lastName');
    if (opts.membershipStatus) q = q.where('membershipStatus', '==', opts.membershipStatus);
    return _paginatedGet(q, opts);
  }


  function countMembers() {
    return _membersRef().get().then(function(snap) { return snap.size; });
  }
  function getMember(idOrEmail) {
    // Try by doc ID first, fall back to email query
    return _membersRef().doc(idOrEmail).get().then(function(doc) {
      if (doc.exists) { var d = doc.data(); d.id = doc.id; return d; }
      // Fall back: query by primaryEmail
      return _membersRef().where('primaryEmail', '==', idOrEmail.toLowerCase())
        .limit(1).get().then(function(snap) {
          if (snap.empty) return null;
          var d2 = snap.docs[0].data(); d2.id = snap.docs[0].id; return d2;
        });
    });
  }

  function _genMemberPin() {
    // 9 random digits always starting with 1–9, formatted xxx-xx-xxxx
    var n = String(Math.floor(Math.random() * 900000000) + 100000000);
    return n.slice(0, 3) + '-' + n.slice(3, 5) + '-' + n.slice(5);
  }

  function createMember(data) {
    data.primaryEmail = (data.primaryEmail || data.email || '').toLowerCase();
    if (!data.memberPin) data.memberPin = _genMemberPin();
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = _userEmail;
    return _membersRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function updateMember(data) {
    var id = data.id;
    if (!id) return Promise.reject('member id required');
    var payload = Object.assign({}, data);
    delete payload.id;
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    payload.updatedBy = _userEmail;
    return _membersRef().doc(id).set(payload, { merge: true }).then(function() {
      payload.id = id; return payload;
    });
  }

  function deleteMember(id) {
    return _membersRef().doc(id).delete();
  }

  /* ── CASCADE DELETE — wipe all user data across every collection ── */
  function deleteUserCascade(email) {
    if (!email) return Promise.reject('email required');
    email = email.toLowerCase();

    var toDelete = [];   // { ref, label }
    var toUpdate = [];   // { ref, data, label }

    function _collect(ref, label) {
      toDelete.push({ ref: ref, label: label });
    }

    function _sweep(collRef, field, value, label) {
      return collRef.where(field, '==', value).get().then(function(snap) {
        snap.forEach(function(doc) { _collect(doc.ref, label); });
      });
    }

    function _sweepConvo(field) {
      return _convosRef().where(field, 'array-contains', email).get().then(function(snap) {
        snap.forEach(function(doc) {
          var d = doc.data();
          var arr = d[field] || [];
          if (arr.length <= 1) {
            _collect(doc.ref, 'conversations');
          } else {
            var upd = {};
            upd[field] = firebase.firestore.FieldValue.arrayRemove(email);
            if (field === 'subscribers') upd.subscriberCount = firebase.firestore.FieldValue.increment(-1);
            else upd.memberCount = firebase.firestore.FieldValue.increment(-1);
            toUpdate.push({ ref: doc.ref, data: upd, label: 'conversations (removed from)' });
          }
        });
      });
    }

    // Step 1 — find member doc(s) by email
    return _membersRef().where('primaryEmail', '==', email).limit(5).get()
      .then(function(snap) {
        var memberIds = [];
        snap.forEach(function(doc) {
          memberIds.push(doc.id);
          _collect(doc.ref, 'members');
        });

        // Build unique lookup keys: email + any Firestore member doc IDs
        var ids = [email];
        memberIds.forEach(function(mid) { if (mid !== email && ids.indexOf(mid) === -1) ids.push(mid); });

        var s = [];

        // ── Direct doc-keyed by email ──
        s.push(_permissionsRef().doc(email).get().then(function(d) { if (d.exists) _collect(d.ref, 'permissions'); }));
        s.push(_accessRef().doc(email).get().then(function(d) { if (d.exists) _collect(d.ref, 'accessControl'); }));
        var prefId = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
        s.push(_prefsRef().doc(prefId).get().then(function(d) { if (d.exists) _collect(d.ref, 'preferences'); }));

        // ── Email-field queries ──
        s.push(_sweep(_memberCardsRef(), 'email', email, 'memberCards'));
        s.push(_sweep(_prayersRef(), 'submitterEmail', email, 'prayers'));
        s.push(_sweep(_journalRef(), 'createdBy', email, 'journal'));
        s.push(_sweep(_todosRef(), 'assignedTo', email, 'todos'));
        s.push(_sweep(_notifsRef(), 'recipientEmail', email, 'notifications'));
        s.push(_sweep(_calendarEventsRef(), 'email', email, 'calendarEvents'));
        s.push(_sweep(_outreachContactsRef(), 'email', email, 'outreachContacts'));
        s.push(_sweep(_outreachContactsRef(), 'assignedTo', email, 'outreachContacts'));

        // ── memberId-based queries (email OR Firestore doc ID) ──
        ids.forEach(function(mid) {
          s.push(_sweep(_rsvpsRef(), 'memberId', mid, 'rsvps'));
          s.push(_sweep(_volunteersRef(), 'memberId', mid, 'volunteers'));
          s.push(_sweep(_givingRef(), 'memberId', mid, 'giving'));
          s.push(_sweep(_pledgesRef(), 'memberId', mid, 'pledges'));
          s.push(_sweep(_contactsRef(), 'memberId', mid, 'contactLog'));
          s.push(_sweep(_notesRef(), 'memberId', mid, 'pastoralNotes'));
          s.push(_sweep(_milestonesRef(), 'memberId', mid, 'milestones'));
          s.push(_sweep(_careCasesRef(), 'memberId', mid, 'careCases'));
          s.push(_sweep(_careAssignmentsRef(), 'memberId', mid, 'careAssignments'));
          s.push(_sweep(_compassionRef(), 'memberId', mid, 'compassionRequests'));
          s.push(_sweep(_discEnrollRef(), 'memberId', mid, 'discEnrollments'));
          s.push(_sweep(_discGoalsRef(), 'memberId', mid, 'discGoals'));
          s.push(_sweep(_discAssessRef(), 'memberId', mid, 'discAssessments'));
          s.push(_sweep(_discMilestonesRef(), 'memberId', mid, 'discMilestones'));
          s.push(_sweep(_discCertsRef(), 'memberId', mid, 'discCertificates'));
          s.push(_sweep(_discMentoringRef(), 'mentorId', mid, 'discMentoring'));
          s.push(_sweep(_discMentoringRef(), 'menteeId', mid, 'discMentoring'));
          s.push(_sweep(_lrnProgressRef(), 'memberId', mid, 'lrnProgress'));
          s.push(_sweep(_lrnNotesRef(), 'memberId', mid, 'lrnNotes'));
          s.push(_sweep(_lrnCertsRef(), 'memberId', mid, 'lrnCertificates'));
          s.push(_sweep(_lrnRecsRef(), 'memberId', mid, 'lrnRecommendations'));
          s.push(_sweep(_lrnQuizResultsRef(), 'memberId', mid, 'lrnQuizResults'));
        });

        // ── Conversations: remove user from participant / subscriber arrays ──
        s.push(_sweepConvo('participants'));
        s.push(_sweepConvo('subscribers'));

        // ── Group member subcollections: groups/{gid}/members/{memberId} ──
        s.push(_groupsRef().get().then(function(gSnap) {
          var gDels = [];
          gSnap.forEach(function(gDoc) {
            ids.forEach(function(mid) {
              gDels.push(
                _groupsRef().doc(gDoc.id).collection('members').doc(mid).get().then(function(mDoc) {
                  if (mDoc.exists) _collect(mDoc.ref, 'groupMembers');
                })
              );
            });
          });
          return Promise.all(gDels);
        }));

        return Promise.all(s);
      })
      .then(function() {
        // ── Batch-delete all collected refs (max 450 ops per batch) ──
        var allOps = toDelete.map(function(o) { return { type: 'delete', ref: o.ref, label: o.label }; })
          .concat(toUpdate.map(function(o) { return { type: 'update', ref: o.ref, data: o.data, label: o.label }; }));

        if (allOps.length === 0) return Promise.resolve();

        var promises = [];
        for (var i = 0; i < allOps.length; i += 450) {
          var chunk = allOps.slice(i, i + 450);
          var b = _db.batch();
          chunk.forEach(function(op) {
            if (op.type === 'delete') b.delete(op.ref);
            else b.update(op.ref, op.data);
          });
          promises.push(b.commit());
        }
        return Promise.all(promises);
      })
      .then(function() {
        var summary = {};
        toDelete.forEach(function(o) { summary[o.label] = (summary[o.label] || 0) + 1; });
        toUpdate.forEach(function(o) { summary[o.label] = (summary[o.label] || 0) + 1; });
        return { success: true, totalDeleted: toDelete.length, totalUpdated: toUpdate.length, summary: summary };
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     MEMBER CARDS — churches/{churchId}/memberCards
     ══════════════════════════════════════════════════════════════════ */

  function _memberCardsRef() {
    return _churchRef().collection('memberCards');
  }

  function listMemberCards(opts) {
    opts = opts || {};
    var q = _memberCardsRef().orderBy('lastName');
    if (opts.status) q = q.where('status', '==', opts.status);
    if (opts.visibility) q = q.where('visibility', '==', opts.visibility);
    return _paginatedGet(q, opts);
  }

  function getMemberCard(idOrNumber) {
    return _memberCardsRef().doc(idOrNumber).get().then(function(doc) {
      if (doc.exists) { var d = doc.data(); d.id = doc.id; return d; }
      // Fall back: query by memberNumber
      return _memberCardsRef().where('memberNumber', '==', idOrNumber)
        .limit(1).get().then(function(snap) {
          if (snap.empty) return null;
          var d2 = snap.docs[0].data(); d2.id = snap.docs[0].id; return d2;
        });
    });
  }

  function searchMemberCards(query) {
    var q = (query || '').toLowerCase();
    if (!q) return listMemberCards({ limit: 200 });
    // Fast path: when the query looks like an email address, resolve it with a
    // single targeted index lookup instead of fetching up to 200 docs client-side.
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) {
      return _memberCardsRef().where('email', '==', q).limit(1).get()
        .then(function(snap) {
          var results = [];
          snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; results.push(d); });
          return results;
        });
    }
    // Client-side filter for name/title searches
    return listMemberCards({ limit: 200 }).then(function(cards) {
      return cards.filter(function(c) {
        return (c.firstName || '').toLowerCase().indexOf(q) >= 0 ||
               (c.lastName || '').toLowerCase().indexOf(q) >= 0 ||
               (c.email || '').toLowerCase().indexOf(q) >= 0 ||
               (c.cardTitle || '').toLowerCase().indexOf(q) >= 0;
      });
    });
  }

  function createMemberCard(data) {
    data.email = (data.email || '').toLowerCase();
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = _userEmail;
    return _memberCardsRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function updateMemberCard(data) {
    var id = data.id;
    if (!id) return Promise.reject('card id required');
    var payload = Object.assign({}, data);
    delete payload.id;
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    payload.updatedBy = _userEmail;
    return _memberCardsRef().doc(id).set(payload, { merge: true }).then(function() {
      payload.id = id; return payload;
    });
  }

  function deleteMemberCard(id) {
    return _memberCardsRef().doc(id).delete();
  }

  /* ══════════════════════════════════════════════════════════════════
     TOUCHES — churches/{churchId}/touches
     Contact-log entries created whenever a shepherd reaches out to a
     member via text, call, or email through The Fold.
     ══════════════════════════════════════════════════════════════════ */

  function _touchesRef() {
    return _churchRef().collection('touches');
  }

  function createTouch(data) {
    // data: { memberId, memberName, channel: 'text'|'call'|'email', note? }
    if (!data || !data.memberId) return Promise.reject('memberId required');
    var payload = {
      memberId:    data.memberId,
      memberName:  data.memberName  || '',
      channel:     data.channel     || 'unknown',
      note:        data.note        || '',
      loggedBy:    _userEmail       || '',
      loggedAt:    firebase.firestore.FieldValue.serverTimestamp(),
    };
    return _touchesRef().add(payload).then(function(ref) {
      payload.id = ref.id;
      // Auto-update any open care cases for this member so that every contact
      // registers as an update — no manual Save required.
      _touchOpenCareCases(data.memberId, data.channel || 'unknown');
      return payload;
    });
  }

  // Bump updatedAt + lastContactAt on every open care case for a member
  // whenever a touch or contact is logged.  Runs fire-and-forget (errors
  // are logged but never surface to the caller).
  function _touchOpenCareCases(memberId, channel) {
    if (!memberId) return;
    var TERMINAL = { Resolved: true, Closed: true, Deleted: true };
    _careCasesRef().where('memberId', '==', memberId).get().then(function(snap) {
      var now = firebase.firestore.FieldValue.serverTimestamp();
      var batch = firebase.firestore().batch();
      var count = 0;
      snap.docs.forEach(function(doc) {
        var status = doc.data().status;
        if (TERMINAL[status]) return;
        batch.update(doc.ref, {
          updatedAt:          now,
          lastContactAt:      now,
          lastContactChannel: channel || 'unknown',
          updatedBy:          _userEmail || '',
        });
        count++;
      });
      if (count > 0) return batch.commit();
    }).catch(function(err) {
      console.warn('[UpperRoom] _touchOpenCareCases failed:', err);
    });
  }

  // Maps a contactLog contactType string to the canonical touch channel value.
  var _CONTACT_TYPE_TO_CHANNEL = {
    'text':          'text',
    'sms':           'text',
    'phone call':    'call',
    'phone':         'call',
    'call':          'call',
    'email':         'email',
    'home visit':    'visit',
    'office visit':  'visit',
    'video call':    'call',
  };

  function listTouches(opts) {
    opts = opts || {};
    if (!opts.memberId) return Promise.reject('memberId required');
    var limit = opts.limit || 50;

    // Query both collections in parallel so that historical contactLog records
    // (written before the touches collection existed) surface alongside newer
    // entries written directly to touches.
    var touchQuery = _touchesRef().where('memberId', '==', opts.memberId).get();
    var contactQuery = _contactsRef().where('memberId', '==', opts.memberId).get();

    return Promise.all([touchQuery, contactQuery]).then(function(results) {
      var touchSnap   = results[0];
      var contactSnap = results[1];

      // Native touches rows
      var rows = touchSnap.docs.map(function(d) {
        var r = d.data(); r.id = d.id; return r;
      });

      // Map contactLog entries to touch shape, skipping any already in touches
      // (guard: if a touch was written by the new code it won't be in contactLog).
      contactSnap.docs.forEach(function(d) {
        var c = d.data();
        var typeKey = String(c.contactType || '').toLowerCase().trim();
        var channel = _CONTACT_TYPE_TO_CHANNEL[typeKey] || 'unknown';
        rows.push({
          id:         'd_' + d.id,   // prefix avoids id collision with touches docs
          memberId:   c.memberId,
          memberName: c.memberName || '',
          channel:    channel,
          note:       c.details || c.subject || '',
          loggedBy:   c.contactedBy || c.createdBy || '',
          loggedAt:   c.createdAt || null,
          _source:    'contactLog'
        });
      });

      function _ms(ts) {
        if (!ts) return 0;
        if (ts.toMillis) return ts.toMillis();
        return new Date(ts).getTime() || 0;
      }
      rows.sort(function(a, b) { return _ms(b.loggedAt) - _ms(a.loggedAt); });
      return rows.slice(0, limit);
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     PERMISSIONS — churches/{churchId}/permissions
     ══════════════════════════════════════════════════════════════════ */

  function _permissionsRef() {
    return _churchRef().collection('permissions');
  }

  function getPermissions(email) {
    return _permissionsRef().doc(email.toLowerCase()).get().then(function(doc) {
      if (!doc.exists) return { overrides: [], permissions: {} };
      return doc.data();
    });
  }

  function listPermissionModules() {
    // Static config — stored as a single doc; cache for the session to avoid
    // a redundant read on every profile open (this doc changes very rarely).
    if (_permModulesCache) return Promise.resolve(_permModulesCache);
    return _churchRef().collection('settings').doc('permissionModules').get()
      .then(function(doc) {
        _permModulesCache = doc.exists ? doc.data() : { modules: {} };
        return _permModulesCache;
      });
  }

  function setPermissions(email, grants, denies) {
    var payload = {
      targetEmail: email.toLowerCase(),
      grants: grants || [],
      denies: denies || [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: _userEmail
    };
    return _permissionsRef().doc(email.toLowerCase()).set(payload, { merge: true });
  }

  /* ── Member-role layer (memberId-keyed access role) ────────────── */
  // Lightweight role-per-member mapping used by the_fold's "Access Level"
  // dropdown.  Stored alongside permissions but keyed by memberId so it
  // survives email changes.  Granular grants/denies still live in the
  // email-keyed permissions doc above.
  function _memberRolesRef() { return _churchRef().collection('memberRoles'); }

  function getMemberRole(p) {
    var memberId = (p && typeof p === 'object') ? (p.memberId || p.id) : p;
    if (!memberId) return Promise.resolve(null);
    return _memberRolesRef().doc(String(memberId)).get().then(function(doc) {
      if (!doc.exists) return null;
      var d = doc.data(); d.id = doc.id; return d;
    });
  }

  function setMemberRole(p) {
    p = p || {};
    var memberId = p.memberId || p.id;
    if (!memberId) return Promise.reject('memberId required');
    var role = p.role || p.accessRole || p.level || '';
    var payload = {
      memberId: String(memberId),
      role:     role,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: _userEmail
    };
    return _memberRolesRef().doc(String(memberId)).set(payload, { merge: true });
  }

  /* ══════════════════════════════════════════════════════════════════
     CARE CASES — churches/{churchId}/careCases
     ══════════════════════════════════════════════════════════════════ */

  function _careCasesRef() {
    return _churchRef().collection('careCases');
  }

  function listCareCases(opts) {
    opts = opts || {};
    var q = _careCasesRef().orderBy('createdAt', 'desc');
    if (opts.status) q = q.where('status', '==', opts.status);
    return _paginatedGet(q, opts, function(d) { return Object.assign({ id: d.id }, d.data()); });
  }

  function getCareCase(id) {
    return _careCasesRef().doc(id).get().then(function(doc) {
      if (!doc.exists) return null;
      return Object.assign({ id: doc.id }, doc.data());
    });
  }

  function createCareCase(data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = data.createdBy || _userEmail;
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    data.status = data.status || 'Open';
    return _careCasesRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function updateCareCase(data) {
    var id = data.id || data.caseId;
    if (!id) return Promise.reject('case id required');
    var payload = Object.assign({}, data);
    delete payload.id; delete payload.caseId;
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    payload.updatedBy = _userEmail;
    return _careCasesRef().doc(id).update(payload).then(function() {
      payload.id = id; return payload;
    });
  }

  function resolveCareCase(opts) {
    var id = (typeof opts === 'string') ? opts : (opts.id || opts.caseId);
    return _careCasesRef().doc(id).update({
      status: 'Resolved',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      resolvedBy: _userEmail,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      return { ok: true, row: { status: 'Resolved' } };
    });
  }

  function careDashboard() {
    return _careCasesRef().get().then(function(snap) {
      var cases = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      var open = 0, resolved = 0, total = cases.length;
      cases.forEach(function(c) { if (c.status === 'Resolved') resolved++; else open++; });
      return { open: open, resolved: resolved, total: total, cases: cases };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     CARE INTERACTIONS — churches/{churchId}/careInteractions
     ══════════════════════════════════════════════════════════════════ */

  function _careInteractionsRef() {
    return _churchRef().collection('careInteractions');
  }

  function listCareInteractions(opts) {
    opts = opts || {};
    var q = _careInteractionsRef().orderBy('createdAt', 'desc');
    if (opts.caseId) q = q.where('caseId', '==', opts.caseId);
    q = q.limit(opts.limit || 100);
    return q.get().then(function(snap) {
      return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    });
  }

  function createCareInteraction(data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = data.createdBy || _userEmail;
    return _careInteractionsRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function followUpDoneCareInteraction(id) {
    return _careInteractionsRef().doc(id).update({
      followUpDone: true,
      followUpCompletedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: _userEmail
    });
  }

  function careFollowUpsDue() {
    return _careInteractionsRef()
      .where('followUpDone', '==', false)
      .where('dueDate', '<=', new Date().toISOString().slice(0, 10))
      .orderBy('dueDate')
      .get().then(function(snap) {
        return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     CARE ASSIGNMENTS — churches/{churchId}/careAssignments
     ══════════════════════════════════════════════════════════════════ */

  function _careAssignmentsRef() {
    return _churchRef().collection('careAssignments');
  }

  function listCareAssignments(opts) {
    opts = opts || {};
    var q = _careAssignmentsRef().orderBy('createdAt', 'desc').limit(opts.limit || 80);
    if (opts.status) q = q.where('status', '==', opts.status);
    return q.get().then(function(snap) {
      return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    });
  }

  function careAssignmentsForMember(memberId) {
    return _careAssignmentsRef().where('memberId', '==', memberId).get().then(function(snap) {
      return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    });
  }

  function careAssignmentsMyFlock(caregiverId) {
    return _careAssignmentsRef()
      .where('caregiverId', '==', caregiverId)
      .where('status', '==', 'Active')
      .get().then(function(snap) {
        return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      });
  }

  function createCareAssignment(data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = data.createdBy || _userEmail;
    data.status = data.status || 'Active';
    return _careAssignmentsRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function reassignCareAssignment(data) {
    var id = data.id;
    if (!id) return Promise.reject('assignment id required');
    return _careAssignmentsRef().doc(id).update({
      caregiverId: data.newCaregiverId,
      notes: data.notes || '',
      reassignedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: _userEmail
    });
  }

  function updateCareAssignment(data) {
    var id = data.id;
    if (!id) return Promise.reject('assignment id required');
    var patch = { updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: _userEmail };
    if (data.role     !== undefined) patch.role     = data.role;
    if (data.status   !== undefined) patch.status   = data.status;
    if (data.notes    !== undefined) patch.notes    = data.notes;
    if (data.caregiverId !== undefined) patch.caregiverId = data.caregiverId;
    return _careAssignmentsRef().doc(id).update(patch);
  }

  function endCareAssignment(id) {
    if (typeof id === 'object') id = id.id;
    return _careAssignmentsRef().doc(id).update({
      status: 'Ended',
      endedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: _userEmail
    });
  }

  function listCaregivers() {
    return _careAssignmentsRef()
      .where('status', '==', 'Active')
      .get().then(function(snap) {
        var seen = {}, list = [];
        snap.docs.forEach(function(d) {
          var a = d.data();
          if (a.caregiverId && !seen[a.caregiverId]) {
            seen[a.caregiverId] = true;
            list.push({ email: a.caregiverId, role: a.role || 'Shepherd' });
          }
        });
        return list;
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     COMPASSION REQUESTS — churches/{churchId}/compassionRequests
     ══════════════════════════════════════════════════════════════════ */

  function _compassionRef() {
    return _churchRef().collection('compassionRequests');
  }

  function listCompassionRequests(opts) {
    opts = opts || {};
    var q = _compassionRef().orderBy('createdAt', 'desc');
    if (opts.status) q = q.where('status', '==', opts.status);
    return _paginatedGet(q, opts, function(d) { return Object.assign({ id: d.id }, d.data()); });
  }


  function countOpenCompassionRequests() {
    return _compassionRef()
      .where('status', 'not-in', ['closed','completed','resolved','archived'])
      .get().then(function(snap) { return snap.size; });
  }
  function getCompassionRequest(id) {
    return _compassionRef().doc(id).get().then(function(doc) {
      if (!doc.exists) return null;
      return Object.assign({ id: doc.id }, doc.data());
    });
  }

  function createCompassionRequest(data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = data.createdBy || _userEmail;
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    data.status = data.status || 'Pending';
    return _compassionRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function updateCompassionRequest(data) {
    var id = data.id;
    if (!id) return Promise.reject('request id required');
    var payload = Object.assign({}, data);
    delete payload.id;
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    payload.updatedBy = _userEmail;
    return _compassionRef().doc(id).update(payload).then(function() {
      payload.id = id; return payload;
    });
  }

  function approveCompassionRequest(id) {
    if (typeof id === 'object') id = id.id;
    return _compassionRef().doc(id).update({
      status: 'Approved',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      approvedBy: _userEmail,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function denyCompassionRequest(id) {
    if (typeof id === 'object') id = id.id;
    return _compassionRef().doc(id).update({
      status: 'Denied',
      deniedAt: firebase.firestore.FieldValue.serverTimestamp(),
      deniedBy: _userEmail,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function resolveCompassionRequest(id) {
    if (typeof id === 'object') id = id.id;
    return _compassionRef().doc(id).update({
      status: 'Resolved',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      resolvedBy: _userEmail,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function compassionDashboard() {
    return _compassionRef().get().then(function(snap) {
      var reqs = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      var pending = 0, approved = 0, resolved = 0;
      reqs.forEach(function(r) {
        if (r.status === 'Pending') pending++;
        else if (r.status === 'Approved') approved++;
        else if (r.status === 'Resolved') resolved++;
      });
      return { pending: pending, approved: approved, resolved: resolved, total: reqs.length, requests: reqs };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     COMPASSION LOGS — churches/{churchId}/compassionLogs
     ══════════════════════════════════════════════════════════════════ */

  function _compassionLogRef() {
    return _churchRef().collection('compassionLogs');
  }

  function listCompassionLogs(opts) {
    opts = opts || {};
    var q = _compassionLogRef().orderBy('createdAt', 'desc');
    if (opts.requestId) q = q.where('requestId', '==', opts.requestId);
    q = q.limit(opts.limit || 80);
    return q.get().then(function(snap) {
      return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    });
  }

  function recentCompassionLogs(opts) {
    opts = opts || {};
    return _compassionLogRef().orderBy('createdAt', 'desc').limit(opts.limit || 10)
      .get().then(function(snap) {
        return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      });
  }

  function createCompassionLog(data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = data.createdBy || _userEmail;
    return _compassionLogRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function deleteCompassionLog(id) {
    if (typeof id === 'object') id = id.id;
    return _compassionLogRef().doc(id).delete();
  }

  /* ══════════════════════════════════════════════════════════════════
     COMPASSION RESOURCES — churches/{churchId}/compassionResources
     ══════════════════════════════════════════════════════════════════ */

  function _compassionResourcesRef() {
    return _churchRef().collection('compassionResources');
  }

  function listCompassionResources(opts) {
    opts = opts || {};
    return _compassionResourcesRef().orderBy('name').limit(opts.limit || 80)
      .get().then(function(snap) {
        return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      });
  }

  function lowCompassionResources() {
    return _compassionResourcesRef().where('status', '==', 'Low')
      .get().then(function(snap) {
        return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      });
  }

  function createCompassionResource(data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = data.createdBy || _userEmail;
    return _compassionResourcesRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function updateCompassionResource(data) {
    var id = data.id;
    if (!id) return Promise.reject('resource id required');
    var payload = Object.assign({}, data);
    delete payload.id;
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    payload.updatedBy = _userEmail;
    return _compassionResourcesRef().doc(id).update(payload).then(function() {
      payload.id = id; return payload;
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     OUTREACH CONTACTS — churches/{churchId}/outreachContacts
     ══════════════════════════════════════════════════════════════════ */

  function _outreachContactsRef() {
    return _churchRef().collection('outreachContacts');
  }

  function listOutreachContacts(opts) {
    opts = opts || {};
    var q = _outreachContactsRef();
    // byEmail: filter to a specific submitter email (equality only — no composite index needed)
    if (opts.byEmail) q = q.where('email', '==', opts.byEmail);
    if (opts.status) q = q.where('status', '==', opts.status);
    // Skip orderBy when filtering by email to avoid requiring a composite index.
    // Results are sorted client-side in the view layer.
    if (!opts.byEmail) q = q.orderBy('createdAt', 'desc');
    return _paginatedGet(q, opts, function(d) { return Object.assign({ id: d.id }, d.data()); });
  }

  function getOutreachContact(id) {
    if (typeof id === 'object') id = id.contactId || id.id;
    return _outreachContactsRef().doc(id).get().then(function(doc) {
      if (!doc.exists) return null;
      return Object.assign({ id: doc.id }, doc.data());
    });
  }

  function createOutreachContact(data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = data.createdBy || _userEmail;
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    data.status = data.status || 'New';
    return _outreachContactsRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function updateOutreachContact(data) {
    var id = data.id;
    if (!id) return Promise.reject('contact id required');
    var payload = Object.assign({}, data);
    delete payload.id;
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    payload.updatedBy = _userEmail;
    return _outreachContactsRef().doc(id).update(payload).then(function() {
      payload.id = id; return payload;
    });
  }

  function convertOutreachContact(data) {
    var id = data.id;
    if (!id) return Promise.reject('contact id required');
    return _outreachContactsRef().doc(id).update({
      status: 'Converted',
      memberId: data.memberId || '',
      convertedAt: firebase.firestore.FieldValue.serverTimestamp(),
      convertedBy: _userEmail,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function deleteOutreachContact(id) {
    if (!id) return Promise.reject('contact id required');
    return _outreachContactsRef().doc(id).delete();
  }

  function submitOutreachContact(data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.status = data.status || 'New';
    data.source = data.source || 'PublicForm';
    return _outreachContactsRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     OUTREACH CAMPAIGNS — churches/{churchId}/outreachCampaigns
     ══════════════════════════════════════════════════════════════════ */

  function _outreachCampaignsRef() {
    return _churchRef().collection('outreachCampaigns');
  }

  function listOutreachCampaigns(opts) {
    opts = opts || {};
    return _outreachCampaignsRef().orderBy('createdAt', 'desc').limit(opts.limit || 50)
      .get().then(function(snap) {
        return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      });
  }

  function createOutreachCampaign(data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = data.createdBy || _userEmail;
    data.status = data.status || 'Active';
    return _outreachCampaignsRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function updateOutreachCampaign(data) {
    var id = data.id;
    if (!id) return Promise.reject('campaign id required');
    var payload = Object.assign({}, data);
    delete payload.id;
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    payload.updatedBy = _userEmail;
    return _outreachCampaignsRef().doc(id).update(payload).then(function() {
      payload.id = id; return payload;
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     OUTREACH FOLLOW-UPS — churches/{churchId}/outreachFollowUps
     ══════════════════════════════════════════════════════════════════ */

  function _outreachFollowUpsRef() {
    return _churchRef().collection('outreachFollowUps');
  }

  function listOutreachFollowUps(opts) {
    opts = opts || {};
    var q = _outreachFollowUpsRef().orderBy('createdAt', 'desc');
    if (opts.contactId) q = q.where('contactId', '==', opts.contactId);
    q = q.limit(opts.limit || 60);
    return q.get().then(function(snap) {
      return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    });
  }

  function createOutreachFollowUp(data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = data.createdBy || _userEmail;
    return _outreachFollowUpsRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function outreachFollowUpDone(id) {
    if (typeof id === 'object') id = id.id;
    return _outreachFollowUpsRef().doc(id).update({
      done: true,
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      completedBy: _userEmail
    });
  }

  function outreachFollowUpsDue() {
    return _outreachFollowUpsRef()
      .where('done', '==', false)
      .where('dueDate', '<=', new Date().toISOString().slice(0, 10))
      .orderBy('dueDate')
      .get().then(function(snap) {
        return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      });
  }

  function outreachDashboard() {
    return _outreachContactsRef().get().then(function(snap) {
      var contacts = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      var newC = 0, active = 0, converted = 0;
      contacts.forEach(function(c) {
        if (c.status === 'New') newC++;
        else if (c.status === 'Converted') converted++;
        else active++;
      });
      return { new: newC, active: active, converted: converted, total: contacts.length, contacts: contacts };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     EVENTS — churches/{churchId}/events
     ══════════════════════════════════════════════════════════════════ */

  function _eventsRef() {
    return _churchRef().collection('events');
  }

  function listEvents(opts) {
    opts = opts || {};
    var q = _eventsRef().orderBy('startDate', 'desc');
    if (opts.status) q = q.where('status', '==', opts.status);
    return _paginatedGet(q, opts);
  }

  function getEvent(id) {
    return _eventsRef().doc(id).get().then(function(doc) {
      if (!doc.exists) return null;
      var d = doc.data();
      d.id = doc.id;
      return d;
    });
  }

  function createEvent(data) {
    var id = _uid();
    return _eventsRef().doc(id).set({
      title:           data.title || '',
      description:     data.description || '',
      eventType:       data.eventType || 'Other',
      location:        data.location || '',
      startDate:       data.startDate || '',
      endDate:         data.endDate || data.startDate || '',
      startTime:       data.startTime || '',
      endTime:         data.endTime || '',
      recurring:       data.recurring || 'None',
      recurringUntil:  data.recurringUntil || '',
      capacity:        data.capacity || 0,
      rsvpRequired:    data.rsvpRequired || false,
      ministryTeam:    data.ministryTeam || '',
      contactPerson:   data.contactPerson || '',
      visibility:      data.visibility || 'public',
      status:          data.status || 'Planned',
      notes:           data.notes || '',
      createdBy:       _userEmail,
      createdAt:       _now(),
      updatedBy:       _userEmail,
      updatedAt:       _now()
    }).then(function() { return id; });
  }

  function updateEvent(id, data) {
    if (typeof id === 'object') { data = id; id = data.id; }
    data.updatedAt = _now();
    data.updatedBy = _userEmail;
    delete data.id;
    return _eventsRef().doc(id).update(data);
  }

  function cancelEvent(id) {
    if (typeof id === 'object') id = id.id;
    return _eventsRef().doc(id).update({
      status:    'Cancelled',
      updatedAt: _now(),
      updatedBy: _userEmail
    });
  }

  function deleteEvent(id) {
    if (typeof id === 'object') id = id.id;
    return _eventsRef().doc(id).delete();
  }

  function publicEvents(opts) {
    opts = opts || {};
    return _eventsRef()
      .where('visibility', '==', 'public')
      .orderBy('startDate', 'desc')
      .limit(opts.limit || 200)
      .get().then(function(snap) {
        var results = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.id = doc.id;
          results.push(d);
        });
        return results;
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     EVENT RSVPs — churches/{churchId}/rsvps
     ══════════════════════════════════════════════════════════════════ */

  function _rsvpsRef() {
    return _churchRef().collection('rsvps');
  }

  function rsvpEvent(data) {
    var id = _uid();
    return _rsvpsRef().doc(id).set({
      eventId:     data.eventId || '',
      memberId:    data.memberId || _userEmail,
      response:    data.response || 'Attending',
      guestCount:  data.guestCount || 0,
      notes:       data.notes || '',
      respondedAt: _now(),
      updatedAt:   _now()
    }).then(function() { return id; });
  }

  function listRsvps(opts) {
    opts = opts || {};
    var q = _rsvpsRef();
    if (opts.eventId) q = q.where('eventId', '==', opts.eventId);
    q = q.orderBy('respondedAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var results = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        d.id = doc.id;
        results.push(d);
      });
      return results;
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     PERSONAL CALENDAR — churches/{churchId}/calendarEvents
     ══════════════════════════════════════════════════════════════════ */

  function _calendarEventsRef() {
    return _churchRef().collection('calendarEvents');
  }

  function listCalendarEvents(opts) {
    opts = opts || {};
    return _calendarEventsRef()
      .where('email', '==', opts.email || _userEmail)
      .limit(opts.limit || 200)
      .get().then(function(snap) {
        var results = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.EventID = doc.id;
          d.id = doc.id;
          results.push(d);
        });
        // Sort descending by StartDateTime in JS to avoid needing a composite
        // index and to handle the TitleCase field name correctly.
        results.sort(function(a, b) {
          var sa = a.StartDateTime || '';
          var sb = b.StartDateTime || '';
          return sb < sa ? -1 : sb > sa ? 1 : 0;
        });
        return results;
      });
  }

  function getCalendarEvent(eventId) {
    return _calendarEventsRef().doc(eventId).get().then(function(doc) {
      if (!doc.exists) return null;
      var d = doc.data();
      d.EventID = doc.id;
      d.id = doc.id;
      return d;
    });
  }

  function createCalendarEvent(data) {
    var id = _uid();
    return _calendarEventsRef().doc(id).set({
      email:           _userEmail,
      Title:           data.Title || '',
      Description:     data.Description || '',
      StartDateTime:   data.StartDateTime || '',
      EndDateTime:     data.EndDateTime || '',
      Location:        data.Location || '',
      Attendees:       data.Attendees || '',
      Color:           data.Color || '#6366f1',
      IsAllDay:        data.IsAllDay || false,
      RecurrenceRule:  data.RecurrenceRule || 'None',
      RecurringDay:    data.RecurringDay || '',
      RecurringUntil:  data.RecurringUntil || '',
      AlertMinutes:    data.AlertMinutes || '',
      Visibility:      data.Visibility || 'public',
      SharedWith:      data.SharedWith || '',
      DelegatedTo:     data.DelegatedTo || '',
      CreatedBy:       _userEmail,
      CreatedAt:       _now(),
      UpdatedBy:       _userEmail,
      UpdatedAt:       _now()
    }).then(function() { return id; });
  }

  function updateCalendarEvent(eventId, data) {
    if (typeof eventId === 'object') { data = eventId; eventId = data.EventID || data.id; }
    data.UpdatedBy = _userEmail;
    data.UpdatedAt = _now();
    delete data.EventID;
    delete data.id;
    return _calendarEventsRef().doc(eventId).update(data);
  }

  function deleteCalendarEvent(eventId) {
    if (typeof eventId === 'object') eventId = eventId.EventID || eventId.id;
    return _calendarEventsRef().doc(eventId).delete();
  }

  function listDelegatedCalendars() {
    return _calendarEventsRef()
      .where('DelegatedTo', 'array-contains', _userEmail)
      .limit(200)
      .get().then(function(snap) {
        var results = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          d.EventID = doc.id;
          results.push(d);
        });
        // Sort descending by StartDateTime in JS (avoids composite index requirement)
        results.sort(function(a, b) {
          var sa = a.StartDateTime || '';
          var sb = b.StartDateTime || '';
          return sb < sa ? -1 : sb > sa ? 1 : 0;
        });
        var owners = {};
        results.forEach(function(r) {
          if (!owners[r.email]) owners[r.email] = [];
          owners[r.email].push(r);
        });
        return Object.keys(owners).map(function(email) {
          return { ownerEmail: email, events: owners[email] };
        });
      });
  }

  /**
   * Get (or create) a share token for the current user's personal calendar
   * iCal feed.  Pass { regenerate: true } to force a new token.
   * Returns { shareToken, feedUrl } where feedUrl is the Cloud Function URL.
   */
  function getCalendarShareToken(opts) {
    opts = opts || {};
    var tokensRef = _churchRef().collection('calendarTokens');
    var regenerate = !!opts.regenerate;

    function _makeToken() {
      // Generate a cryptographically random 32-char hex token
      var arr = new Uint8Array(16);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
      } else {
        for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      }
      return Array.from(arr).map(function(b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }

    function _feedUrl(token) {
      // Derive the Cloud Function base URL from the Firebase project config
      var projectId = FIREBASE_CONFIG && FIREBASE_CONFIG.projectId ? FIREBASE_CONFIG.projectId : '';
      if (!projectId) return '';
      return 'https://us-central1-' + projectId + '.cloudfunctions.net/serveCalendarICS?token=' + encodeURIComponent(token);
    }

    if (!regenerate) {
      // Try to find an existing token for this user
      return tokensRef
        .where('email', '==', _userEmail)
        .limit(1)
        .get()
        .then(function(snap) {
          if (!snap.empty) {
            var token = snap.docs[0].id;
            return { shareToken: token, feedUrl: _feedUrl(token) };
          }
          // No existing token — create one
          var newToken = _makeToken();
          return tokensRef.doc(newToken).set({
            email:     _userEmail,
            createdAt: _now(),
            updatedAt: _now()
          }).then(function() {
            return { shareToken: newToken, feedUrl: _feedUrl(newToken) };
          });
        });
    }

    // Regenerate: delete old tokens for this user, then create new one
    return tokensRef
      .where('email', '==', _userEmail)
      .get()
      .then(function(snap) {
        var deletes = [];
        snap.forEach(function(doc) { deletes.push(doc.ref.delete()); });
        return Promise.all(deletes);
      })
      .then(function() {
        var newToken = _makeToken();
        return tokensRef.doc(newToken).set({
          email:     _userEmail,
          createdAt: _now(),
          updatedAt: _now()
        }).then(function() {
          return { shareToken: newToken, feedUrl: _feedUrl(newToken) };
        });
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     GROUPS — churches/{churchId}/groups
     ══════════════════════════════════════════════════════════════════ */

  function _groupsRef() {
    return _churchRef().collection('groups');
  }

  function listGroups(opts) {
    opts = opts || {};
    var q = _groupsRef().orderBy('groupName');
    if (opts.status) q = q.where('status', '==', opts.status);
    return _paginatedGet(q, opts);
  }

  function getGroup(id) {
    if (typeof id === 'object') id = id.id;
    return _groupsRef().doc(id).get().then(function(doc) {
      if (!doc.exists) return null;
      var d = doc.data(); d.id = doc.id; return d;
    });
  }

  function createGroup(data) {
    var id = _uid();
    return _groupsRef().doc(id).set({
      groupName:      data.groupName || data.name || '',
      groupType:      data.groupType || data.type || '',
      description:    data.description || '',
      leaderId:       data.leaderId || '',
      coLeaderId:     data.coLeaderId || '',
      meetingDay:     data.meetingDay || '',
      meetingTime:    data.meetingTime || '',
      location:       data.location || data.meetingLocation || '',
      capacity:       data.capacity || 0,
      status:         data.status || 'Active',
      semester:       data.semester || '',
      notes:          data.notes || '',
      memberCount:    0,
      createdBy:      _userEmail,
      createdAt:      _now(),
      updatedAt:      _now()
    }).then(function() { return id; });
  }

  function updateGroup(id, data) {
    if (typeof id === 'object') { data = id; id = data.id; }
    data.updatedAt = _now();
    delete data.id;
    return _groupsRef().doc(id).update(data);
  }

  /* ── Group Members sub-collection: groups/{groupId}/members ──── */

  function _groupMembersRef(groupId) {
    return _groupsRef().doc(groupId).collection('members');
  }

  function listGroupMembers(opts) {
    opts = opts || {};
    var gid = opts.groupId || opts.id;
    return _groupMembersRef(gid).get().then(function(snap) {
      var results = [];
      snap.forEach(function(doc) {
        var d = doc.data(); d.id = doc.id; results.push(d);
      });
      return results;
    });
  }

  function addGroupMember(data) {
    var gid = data.groupId;
    var mid = data.memberId;
    return _groupMembersRef(gid).doc(mid).set({
      memberId:   mid,
      role:       data.role || 'member',
      joinedDate: data.joinedDate || new Date().toISOString().split('T')[0],
      status:     data.status || 'Active',
      addedBy:    _userEmail,
      addedAt:    _now()
    }).then(function() {
      // increment memberCount on group doc
      return _groupsRef().doc(gid).update({
        memberCount: firebase.firestore.FieldValue.increment(1)
      });
    });
  }

  function removeGroupMember(data) {
    var gid = data.groupId;
    var mid = data.memberId;
    return _groupMembersRef(gid).doc(mid).delete().then(function() {
      return _groupsRef().doc(gid).update({
        memberCount: firebase.firestore.FieldValue.increment(-1)
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     ATTENDANCE — churches/{churchId}/attendance
     ══════════════════════════════════════════════════════════════════ */

  function _attendanceRef() {
    return _churchRef().collection('attendance');
  }

  function listAttendance(opts) {
    opts = opts || {};
    var q = _attendanceRef().orderBy('date', 'desc');
    return _paginatedGet(q, opts);
  }

  function getAttendance(id) {
    if (typeof id === 'object') id = id.id;
    return _attendanceRef().doc(id).get().then(function(doc) {
      if (!doc.exists) return null;
      var d = doc.data(); d.id = doc.id; return d;
    });
  }

  function createAttendance(data) {
    var id = _uid();
    var adults   = parseInt(data.adults, 10) || 0;
    var children = parseInt(data.children, 10) || 0;
    return _attendanceRef().doc(id).set({
      date:        data.date || '',
      serviceType: data.serviceType || '',
      adults:      adults,
      children:    children,
      total:       adults + children,
      notes:       data.notes || '',
      recordedBy:  _userEmail,
      createdAt:   _now()
    }).then(function() { return id; });
  }

  function updateAttendance(id, data) {
    if (typeof id === 'object') { data = id; id = data.id; }
    if (data.adults != null || data.children != null) {
      data.total = (parseInt(data.adults, 10) || 0) + (parseInt(data.children, 10) || 0);
    }
    delete data.id;
    return _attendanceRef().doc(id).update(data);
  }

  function attendanceSummary() {
    return _attendanceRef().orderBy('date', 'desc').limit(200).get().then(function(snap) {
      var records = [];
      snap.forEach(function(doc) {
        var d = doc.data(); d.id = doc.id; records.push(d);
      });
      // Build monthly summary
      var monthly = {};
      var totals = { services: 0, adults: 0, children: 0, total: 0 };
      records.forEach(function(r) {
        var m = (r.date || '').substring(0, 7); // YYYY-MM
        if (!m) return;
        if (!monthly[m]) monthly[m] = { month: m, services: 0, adults: 0, children: 0, total: 0 };
        monthly[m].services++;
        monthly[m].adults   += parseInt(r.adults, 10) || 0;
        monthly[m].children += parseInt(r.children, 10) || 0;
        monthly[m].total    += parseInt(r.total, 10) || 0;
        totals.services++;
        totals.adults   += parseInt(r.adults, 10) || 0;
        totals.children += parseInt(r.children, 10) || 0;
        totals.total    += parseInt(r.total, 10) || 0;
      });
      totals.avgPerService = totals.services ? Math.round(totals.total / totals.services) : 0;
      var summary = Object.values(monthly).sort(function(a, b) { return a.month.localeCompare(b.month); });
      summary.forEach(function(m) {
        m.avgPerService = m.services ? Math.round(m.total / m.services) : 0;
      });
      return { summary: summary, totals: totals };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     CHECK-IN SESSIONS — churches/{churchId}/checkinSessions
     ══════════════════════════════════════════════════════════════════ */

  function _checkinRef() {
    return _churchRef().collection('checkinSessions');
  }

  function checkinOpen(data) {
    var id = _uid();
    return _checkinRef().doc(id).set({
      name:           data.name || '',
      date:           data.date || new Date().toISOString().split('T')[0],
      status:         'Open',
      checkedInCount: 0,
      openedBy:       _userEmail,
      openedAt:       _now(),
      closedAt:       null,
      notes:          data.notes || '',
      createdAt:      _now()
    }).then(function() { return id; });
  }

  function checkinClose(data) {
    // Find open session by name
    return _checkinRef()
      .where('name', '==', data.name)
      .where('status', '==', 'Open')
      .limit(1)
      .get().then(function(snap) {
        if (snap.empty) throw new Error('No open session found with that name.');
        var doc = snap.docs[0];
        return doc.ref.update({
          status:   'Closed',
          closedAt: _now()
        });
      });
  }

  function checkinSessions(opts) {
    opts = opts || {};
    return _checkinRef().orderBy('createdAt', 'desc').limit(opts.limit || 100).get().then(function(snap) {
      var results = [];
      snap.forEach(function(doc) {
        var d = doc.data(); d.id = doc.id; results.push(d);
      });
      return results;
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     VOLUNTEERS
     ══════════════════════════════════════════════════════════════════ */

  function _volunteersRef() { return _churchDoc().collection('volunteers'); }

  function listVolunteers(opts) {
    opts = opts || {};
    var q = _volunteersRef();
    if (opts.serviceDate) q = q.where('serviceDate', '==', opts.serviceDate);
    if (opts.ministryId)  q = q.where('ministryId', '==', opts.ministryId);
    if (opts.memberId)    q = q.where('memberId', '==', opts.memberId);
    q = q.orderBy('serviceDate', 'desc');
    return _paginatedGet(q, opts);
  }

  function getVolunteer(id) {
    return _volunteersRef().doc(id).get().then(function(d) {
      if (!d.exists) throw new Error('Volunteer record not found');
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createVolunteer(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _volunteersRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateVolunteer(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    data.updatedBy = _userEmail;
    return _volunteersRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function swapVolunteer(data) {
    var id = data.id; if (!id) throw new Error('id required');
    var swapWith = data.swapWith; if (!swapWith) throw new Error('swapWith required');
    var db = _db();
    var batch = db.batch();
    var ref1 = _volunteersRef().doc(id);
    var ref2 = _volunteersRef().doc(swapWith);
    return Promise.all([ref1.get(), ref2.get()]).then(function(snaps) {
      var d1 = snaps[0].data(), d2 = snaps[1].data();
      if (!d1 || !d2) throw new Error('One or both volunteer records not found');
      batch.update(ref1, { memberId: d2.memberId, memberName: d2.memberName || '', updatedAt: _now() });
      batch.update(ref2, { memberId: d1.memberId, memberName: d1.memberName || '', updatedAt: _now() });
      return batch.commit();
    }).then(function() { return { success: true }; });
  }

  /* ══════════════════════════════════════════════════════════════════
     MINISTRIES
     ══════════════════════════════════════════════════════════════════ */

  function _ministriesRef() { return _churchDoc().collection('ministries'); }

  function listMinistries(opts) {
    opts = opts || {};
    var q = _ministriesRef();
    if (opts.status) q = q.where('status', '==', opts.status);
    q = q.orderBy('name', 'asc');
    return _paginatedGet(q, opts);
  }

  function getMinistry(id) {
    return _ministriesRef().doc(id).get().then(function(d) {
      if (!d.exists) throw new Error('Ministry not found');
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createMinistry(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _ministriesRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateMinistry(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    data.updatedBy = _userEmail;
    return _ministriesRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function ministrySummary() {
    return listMinistries({ limit: 200 }).then(function(rows) {
      var byStatus = {}, byType = {}, totalMembers = 0;
      rows.forEach(function(r) {
        var s = r.status || 'Active';
        var t = r.type || r.ministryType || 'General';
        byStatus[s] = (byStatus[s] || 0) + 1;
        byType[t]   = (byType[t] || 0) + 1;
        totalMembers += Number(r.memberCount || 0);
      });
      return { total: rows.length, byStatus: byStatus, byType: byType, totalMembers: totalMembers };
    });
  }

  function ministryTree() {
    return listMinistries({ limit: 200 }).then(function(rows) {
      var tree = {};
      rows.forEach(function(r) {
        var parent = r.parentMinistry || r.department || 'Uncategorized';
        if (!tree[parent]) tree[parent] = [];
        tree[parent].push(r);
      });
      return tree;
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     SERVICE PLANS
     ══════════════════════════════════════════════════════════════════ */

  function _servicePlansRef() { return _churchDoc().collection('servicePlans'); }

  function listServicePlans(opts) {
    opts = opts || {};
    var q = _servicePlansRef();
    if (opts.id) return getServicePlan(opts.id).then(function(r) { return [r]; });
    if (opts.status) q = q.where('status', '==', opts.status);
    q = q.orderBy('serviceDate', 'desc');
    return _paginatedGet(q, opts);
  }

  function getServicePlan(id) {
    return _servicePlansRef().doc(id).get().then(function(d) {
      if (!d.exists) throw new Error('Service plan not found');
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createServicePlan(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _servicePlansRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateServicePlan(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    data.updatedBy = _userEmail;
    return _servicePlansRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function deleteAllServicePlans() {
    return _servicePlansRef().get().then(function(snap) {
      var batch = _db.batch();
      var count = 0;
      snap.forEach(function(doc) { batch.delete(doc.ref); count++; });
      if (count === 0) return { deleted: 0 };
      return batch.commit().then(function() { return { deleted: count }; });
    });
  }

  /* ── Service Orders (Anatomy of Worship per-service templates) ── */
  function _serviceOrdersRef() { return _churchDoc().collection('serviceOrders'); }

  function getServiceOrder(serviceId) {
    return _serviceOrdersRef().doc(serviceId).get().then(function(d) {
      if (!d.exists) return null;
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function saveServiceOrder(serviceId, items) {
    var ref = _serviceOrdersRef().doc(serviceId);
    var data = { items: items, updatedAt: _now(), updatedBy: _userEmail };
    return ref.set(data, { merge: true }).then(function() {
      return { id: serviceId, success: true };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     SONGS
     ══════════════════════════════════════════════════════════════════ */

  function _songsRef() { return _churchDoc().collection('songs'); }

  function listSongs(opts) {
    opts = opts || {};
    var q = _songsRef();
    if (opts.genre) q = q.where('genre', '==', opts.genre);
    q = q.orderBy('title', 'asc');
    return _paginatedGet(q, opts);
  }

  function getSong(id) {
    return _songsRef().doc(id).get().then(function(d) {
      if (!d.exists) throw new Error('Song not found');
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createSong(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _songsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateSong(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    data.updatedBy = _userEmail;
    return _songsRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function deleteSong(id) {
    if (!id) throw new Error('id required');
    return _songsRef().doc(id).delete().then(function() { return { success: true }; });
  }

  /* ══════════════════════════════════════════════════════════════════
     SONG ARRANGEMENTS
     ══════════════════════════════════════════════════════════════════ */

  function _songArrsRef() { return _churchDoc().collection('songArrangements'); }

  function listSongArrangements(opts) {
    opts = opts || {};
    if (!opts.songId) return Promise.resolve([]);
    return _songArrsRef()
      .where('songId', '==', opts.songId)
      .orderBy('createdAt', 'asc')
      .get().then(function(snap) {
        var out = [];
        snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
        return out;
      });
  }

  function getSongWithArrangements(id) {
    return Promise.all([getSong(id), listSongArrangements({ songId: id })]).then(function(res) {
      var song = res[0];
      song.arrangements = res[1];
      return song;
    });
  }

  function createSongArrangement(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _songArrsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateSongArrangement(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    data.updatedBy = _userEmail;
    return _songArrsRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function deleteSongArrangement(id) {
    if (!id) throw new Error('id required');
    return _songArrsRef().doc(id).delete().then(function() { return { success: true }; });
  }

  /* ══════════════════════════════════════════════════════════════════
     PRESENTATIONS (FlockShow)
     ══════════════════════════════════════════════════════════════════ */

  function _presentationsRef() { return _churchDoc().collection('presentations'); }

  function listPresentations(opts) {
    opts = opts || {};
    var q = _presentationsRef().orderBy('updatedAt', 'desc');
    if (opts.createdBy) q = q.where('createdBy', '==', opts.createdBy);
    return _paginatedGet(q, opts);
  }

  function getPresentation(id) {
    return _presentationsRef().doc(id).get().then(function(d) {
      if (!d.exists) throw new Error('Presentation not found');
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createPresentation(data) {
    data = Object.assign({}, data);
    data.createdAt = _now();
    data.createdBy = _userEmail;
    data.updatedAt = _now();
    data.updatedBy = _userEmail;
    return _presentationsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updatePresentation(data) {
    var id = data.id; if (!id) throw new Error('id required');
    data = Object.assign({}, data); delete data.id;
    data.updatedAt = _now();
    data.updatedBy = _userEmail;
    return _presentationsRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function deletePresentation(id) {
    if (!id) throw new Error('id required');
    return _presentationsRef().doc(id).delete().then(function() { return { success: true }; });
  }

  /* ══════════════════════════════════════════════════════════════════
     SERMONS
     ══════════════════════════════════════════════════════════════════ */

  function _sermonsRef() { return _churchDoc().collection('sermons'); }

  function listSermons(opts) {
    opts = opts || {};
    var q = _sermonsRef();
    if (opts.status) q = q.where('status', '==', opts.status);
    if (opts.preacher) q = q.where('preacher', '==', opts.preacher);
    q = q.orderBy('date', 'desc');
    return _paginatedGet(q, opts);
  }

  function getSermon(id) {
    if (typeof id === 'object') id = id.id || id;
    return _sermonsRef().doc(id).get().then(function(d) {
      if (!d.exists) throw new Error('Sermon not found');
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createSermon(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    data.status    = data.status || 'draft';
    return _sermonsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateSermon(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    data.updatedBy = _userEmail;
    return _sermonsRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function deleteSermon(data) {
    var id = (typeof data === 'string') ? data : (data.id || data);
    return _sermonsRef().doc(id).delete().then(function() {
      return { success: true };
    });
  }

  function submitSermon(data) {
    var id = (typeof data === 'string') ? data : (data.id || data);
    return _sermonsRef().doc(id).update({ status: 'submitted', submittedAt: _now() }).then(function() {
      return { success: true };
    });
  }

  function approveSermon(data) {
    var id = (typeof data === 'string') ? data : (data.id || data);
    return _sermonsRef().doc(id).update({ status: 'approved', approvedAt: _now(), approvedBy: _userEmail }).then(function() {
      return { success: true };
    });
  }

  function deliverSermon(data) {
    var id = data.id; if (!id) throw new Error('id required');
    return _sermonsRef().doc(id).update({
      status: 'delivered',
      deliveredAt: data.deliveredAt || _now(),
      deliveryNotes: data.deliveryNotes || data.notes || ''
    }).then(function() { return { success: true }; });
  }

  function uploadSermonMedia(data) {
    var id = data.id; if (!id) throw new Error('id required');
    return _sermonsRef().doc(id).update({
      mediaUrl:  data.mediaUrl  || data.url || '',
      mediaType: data.mediaType || data.type || '',
      updatedAt: _now()
    }).then(function() { return { success: true }; });
  }

  function sermonDashboard() {
    return listSermons({ limit: 200 }).then(function(rows) {
      var byStatus = {}, total = rows.length, thisMonth = 0;
      var now = new Date(), y = now.getFullYear(), m = now.getMonth();
      rows.forEach(function(r) {
        var s = r.status || 'draft';
        byStatus[s] = (byStatus[s] || 0) + 1;
        var d = new Date(r.date || r.createdAt || 0);
        if (d.getFullYear() === y && d.getMonth() === m) thisMonth++;
      });
      return { total: total, byStatus: byStatus, thisMonth: thisMonth };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     SERMON SERIES
     ══════════════════════════════════════════════════════════════════ */

  function _sermonSeriesRef() { return _churchDoc().collection('sermonSeries'); }

  function listSermonSeries(opts) {
    opts = opts || {};
    var q = _sermonSeriesRef();
    q = q.orderBy('startDate', 'desc').limit(opts.limit || 100);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function getSermonSeries(data) {
    var id = (typeof data === 'string') ? data : (data.id || data);
    return _sermonSeriesRef().doc(id).get().then(function(d) {
      if (!d.exists) throw new Error('Sermon series not found');
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createSermonSeries(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _sermonSeriesRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateSermonSeries(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _sermonSeriesRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function deleteSermonSeries(data) {
    var id = (typeof data === 'string') ? data : (data.id || data);
    return _sermonSeriesRef().doc(id).delete().then(function() {
      return { success: true };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     SERMON REVIEWS
     ══════════════════════════════════════════════════════════════════ */

  function _sermonReviewsRef() { return _churchDoc().collection('sermonReviews'); }

  function listSermonReviews(opts) {
    opts = opts || {};
    var q = _sermonReviewsRef();
    if (opts.sermonId) q = q.where('sermonId', '==', opts.sermonId);
    q = q.orderBy('createdAt', 'desc').limit(opts.limit || 100);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function createSermonReview(data) {
    data.createdAt = _now();
    data.reviewerEmail = _userEmail;
    return _sermonReviewsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     GIVING
     ══════════════════════════════════════════════════════════════════ */

  function _givingRef() { return _churchDoc().collection('giving'); }

  function listGiving(opts) {
    opts = opts || {};
    var q = _givingRef();
    if (opts.memberId) q = q.where('memberId', '==', opts.memberId);
    if (opts.fund)     q = q.where('fund', '==', opts.fund);
    q = q.orderBy('date', 'desc');
    return _paginatedGet(q, opts);
  }

  function createGiving(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _givingRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateGiving(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _givingRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function givingSummary() {
    return listGiving({ limit: 2000 }).then(function(rows) {
      var now = new Date();
      var thisMonthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      var total = 0, monthlyTotal = 0, byFund = {}, byMonth = {}, givers = {}, count = rows.length;
      rows.forEach(function(r) {
        var amt = Number(r.amount || 0);
        total += amt;
        var dateKey = (r.date || r.giftDate || '').substring(0, 7);
        if (dateKey === thisMonthKey) monthlyTotal += amt;
        var f = r.fund || r.category || 'General';
        byFund[f] = (byFund[f] || 0) + amt;
        if (dateKey) byMonth[dateKey] = (byMonth[dateKey] || 0) + amt;
        var n = r.name || r.giverName || '';
        if (n && n !== 'Anonymous') givers[n] = true;
      });
      // Convert byMonth → sorted array for bar chart
      var monthArr = Object.keys(byMonth).sort().map(function(m) {
        var d = new Date(m + '-02'); // day=2 avoids TZ shift
        var lbl = d.toLocaleDateString(undefined, { month: 'short' });
        return { month: m, label: lbl, amount: byMonth[m] };
      });
      // Last 12 months only
      if (monthArr.length > 12) monthArr = monthArr.slice(monthArr.length - 12);
      // Convert byFund → array sorted by amount desc
      var fundArr = Object.keys(byFund)
        .sort(function(a, b) { return byFund[b] - byFund[a]; })
        .map(function(f) { return { name: f, amount: byFund[f] }; });
      return {
        total:        total,
        monthlyTotal: monthlyTotal,
        thisMonth:    monthlyTotal,
        ytdTotal:     total,
        count:        count,
        averageGift:  count > 0 ? total / count : 0,
        activeGivers: Object.keys(givers).length,
        monthly:      monthArr,
        funds:        fundArr,
      };
    });
  }

  function memberGivingStatement(opts) {
    opts = opts || {};
    var memberId = opts.memberId; if (!memberId) throw new Error('memberId required');
    var year = opts.year || new Date().getFullYear();
    var start = year + '-01-01', end = year + '-12-31';
    return _givingRef()
      .where('memberId', '==', memberId)
      .where('date', '>=', start)
      .where('date', '<=', end)
      .orderBy('date', 'asc')
      .get().then(function(snap) {
        var out = [], total = 0;
        snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); total += Number(o.amount || 0); });
        return { records: out, total: total, year: year, memberId: memberId };
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     PLEDGES
     ══════════════════════════════════════════════════════════════════ */

  function _pledgesRef() { return _churchDoc().collection('pledges'); }

  function listPledges(opts) {
    opts = opts || {};
    var q = _pledgesRef();
    q = q.orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function createPledge(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _pledgesRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updatePledge(data) {
    var id = data.id; if (!id) throw new Error('id required');
    var doc = Object.assign({}, data);
    delete doc.id;
    doc.updatedAt = _now();
    doc.updatedBy = _userEmail;
    return _pledgesRef().doc(id).update(doc).then(function() {
      return { id: id, success: true };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     JOURNAL
     ══════════════════════════════════════════════════════════════════ */

  function _journalRef() { return _churchDoc().collection('journal'); }

  function listJournal(opts) {
    opts = opts || {};
    console.log('[FLOCK-DEBUG] UpperRoom.listJournal() called — allUsers=' + !!opts.allUsers + ', _userEmail=' + _userEmail + ', _ready=' + _ready + ', hasDb=' + !!_db);
    var q = _journalRef();
    // Filter by current user's email unless opts.allUsers is set (admin backup).
    // Firestore rules require createdBy == userEmail() for non-pastor users;
    // without this .where(), the query is rejected with "permission denied"
    // and the .catch(() => []) silently returns an empty array.
    if (!opts.allUsers && _userEmail) {
      q = q.where('createdBy', '==', _userEmail);
    }
    q = q.orderBy('createdAt', 'desc').limit(opts.limit || _DEFAULT_PAGE);
    if (opts.startAfter) q = q.startAfter(opts.startAfter);
    console.log('[FLOCK-DEBUG] UpperRoom.listJournal() executing query…');
    var _ljStart = Date.now();
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      console.log('[FLOCK-DEBUG] UpperRoom.listJournal() DONE: ' + out.length + ' rows in ' + (Date.now() - _ljStart) + 'ms');
      if (!opts.startAfter && !opts.paginate) return out;
      return { results: out, lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null, hasMore: snap.docs.length === (opts.limit || _DEFAULT_PAGE) };
    });
  }

  function createJournal(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _journalRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateJournal(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _journalRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function deleteJournal(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _journalRef().doc(id).delete().then(function() {
      return { id: id, success: true };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     DISCIPLESHIP — Paths
     ══════════════════════════════════════════════════════════════════ */

  function _discPathsRef() { return _churchDoc().collection('discipleshipPaths'); }

  function listDiscPaths(opts) {
    opts = opts || {};
    var q = _discPathsRef().orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function getDiscPath(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _discPathsRef().doc(id).get().then(function(d) {
      if (!d.exists) return null;
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createDiscPath(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    data.status = data.status || 'draft';
    return _discPathsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateDiscPath(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _discPathsRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function publishDiscPath(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _discPathsRef().doc(id).update({ status: 'published', publishedAt: _now() }).then(function() {
      return { id: id, success: true };
    });
  }

  function archiveDiscPath(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _discPathsRef().doc(id).update({ status: 'archived', archivedAt: _now() }).then(function() {
      return { id: id, success: true };
    });
  }

  /* ── Discipleship — Steps ─────────────────────────────────────── */

  function _discStepsRef() { return _churchDoc().collection('discipleshipSteps'); }

  function listDiscSteps(opts) {
    opts = opts || {};
    var q = _discStepsRef();
    if (opts.pathId) q = q.where('pathId', '==', opts.pathId);
    q = q.orderBy('order', 'asc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function getDiscStep(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _discStepsRef().doc(id).get().then(function(d) {
      if (!d.exists) return null;
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createDiscStep(data) {
    data.createdAt = _now();
    return _discStepsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateDiscStep(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _discStepsRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function deleteDiscStep(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _discStepsRef().doc(id).delete().then(function() {
      return { id: id, success: true };
    });
  }

  /* ── Discipleship — Enrollments ───────────────────────────────── */

  function _discEnrollRef() { return _churchDoc().collection('discipleshipEnrollments'); }

  function listDiscEnrollments(opts) {
    opts = opts || {};
    var q = _discEnrollRef().orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function getDiscEnrollment(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _discEnrollRef().doc(id).get().then(function(d) {
      if (!d.exists) return null;
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createDiscEnrollment(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    data.status = data.status || 'active';
    return _discEnrollRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateDiscEnrollment(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _discEnrollRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function advanceDiscEnrollment(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _discEnrollRef().doc(id).get().then(function(d) {
      if (!d.exists) throw new Error('Enrollment not found');
      var cur = d.data();
      var step = (cur.currentStep || 0) + 1;
      return _discEnrollRef().doc(id).update({ currentStep: step, updatedAt: _now() });
    }).then(function() { return { id: id, success: true }; });
  }

  /* ── Discipleship — Mentoring ─────────────────────────────────── */

  function _discMentoringRef() { return _churchDoc().collection('discipleshipMentoring'); }

  function listDiscMentoring(opts) {
    opts = opts || {};
    var q = _discMentoringRef().orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function getDiscMentoring(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _discMentoringRef().doc(id).get().then(function(d) {
      if (!d.exists) return null;
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createDiscMentoring(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _discMentoringRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateDiscMentoring(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _discMentoringRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  /* ── Discipleship — Meetings ──────────────────────────────────── */

  function _discMeetingsRef() { return _churchDoc().collection('discipleshipMeetings'); }

  function createDiscMeeting(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _discMeetingsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  /* ── Discipleship — Goals ─────────────────────────────────────── */

  function _discGoalsRef() { return _churchDoc().collection('discipleshipGoals'); }

  function listDiscGoals(opts) {
    opts = opts || {};
    var q = _discGoalsRef().orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function createDiscGoal(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _discGoalsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateDiscGoal(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _discGoalsRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  /* ── Discipleship — Assessments ───────────────────────────────── */

  function _discAssessRef() { return _churchDoc().collection('discipleshipAssessments'); }

  function listDiscAssessments(opts) {
    opts = opts || {};
    var q = _discAssessRef().orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function getDiscAssessment(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _discAssessRef().doc(id).get().then(function(d) {
      if (!d.exists) return null;
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createDiscAssessment(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _discAssessRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  /* ── Discipleship — Milestones ────────────────────────────────── */

  function _discMilestonesRef() { return _churchDoc().collection('discipleshipMilestones'); }

  function listDiscMilestones(opts) {
    opts = opts || {};
    var q = _discMilestonesRef().orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function createDiscMilestone(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    data.earnedAt = data.earnedAt || _now();
    return _discMilestonesRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  /* ── Discipleship — Certificates ──────────────────────────────── */

  function _discCertsRef() { return _churchDoc().collection('discipleshipCertificates'); }

  function listDiscCertificates(opts) {
    opts = opts || {};
    var q = _discCertsRef().orderBy('issuedAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function issueDiscCertificate(data) {
    data.issuedAt = _now();
    data.issuedBy = _userEmail;
    data.status = 'active';
    return _discCertsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function revokeDiscCertificate(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _discCertsRef().doc(id).update({ status: 'revoked', revokedAt: _now() }).then(function() {
      return { id: id, success: true };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     LEARNING — Topics
     ══════════════════════════════════════════════════════════════════ */

  function _lrnTopicsRef() { return _churchDoc().collection('learningTopics'); }

  function listLrnTopics(opts) {
    opts = opts || {};
    var q = _lrnTopicsRef();
    if (opts.status) q = q.where('status', '==', opts.status);
    q = q.orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function createLrnTopic(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _lrnTopicsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateLrnTopic(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _lrnTopicsRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function deleteLrnTopic(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _lrnTopicsRef().doc(id).delete().then(function() {
      return { id: id, success: true };
    });
  }

  /* ── Learning — Playlists ─────────────────────────────────────── */

  function _lrnPlaylistsRef() { return _churchDoc().collection('learningPlaylists'); }

  function listLrnPlaylists(opts) {
    opts = opts || {};
    var q = _lrnPlaylistsRef();
    if (opts.status) q = q.where('status', '==', opts.status);
    if (opts.sort === 'recent') q = q.orderBy('updatedAt', 'desc');
    else q = q.orderBy('createdAt', 'desc');
    q = q.limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function getLrnPlaylist(opts) {
    var id = (opts && opts.id) || opts; if (!id) throw new Error('id required');
    return _lrnPlaylistsRef().doc(id).get().then(function(d) {
      if (!d.exists) return null;
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createLrnPlaylist(data) {
    data.createdAt = _now();
    data.updatedAt = _now();
    data.createdBy = _userEmail;
    data.status = data.status || 'Active';
    return _lrnPlaylistsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateLrnPlaylist(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _lrnPlaylistsRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function deleteLrnPlaylist(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _lrnPlaylistsRef().doc(id).delete().then(function() {
      return { id: id, success: true };
    });
  }

  function subscribeLrnPlaylist(data) {
    data.subscribedAt = _now();
    data.subscribedBy = _userEmail;
    return _lrnPlaylistsRef().doc(data.playlistId).collection('subscribers').add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  /* ── Learning — Playlist Items ────────────────────────────────── */

  function _lrnItemsRef() { return _churchDoc().collection('learningPlaylistItems'); }

  function createLrnPlaylistItem(data) {
    data.createdAt = _now();
    return _lrnItemsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateLrnPlaylistItem(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _lrnItemsRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function deleteLrnPlaylistItem(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _lrnItemsRef().doc(id).delete().then(function() {
      return { id: id, success: true };
    });
  }

  function reorderLrnPlaylistItem(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    return _lrnItemsRef().doc(id).update({ order: data.order || data.newOrder, updatedAt: _now() }).then(function() {
      return { id: id, success: true };
    });
  }

  /* ── Learning — Quizzes ───────────────────────────────────────── */

  function _lrnQuizzesRef() { return _churchDoc().collection('learningQuizzes'); }

  function listLrnQuizzes(opts) {
    opts = opts || {};
    var q = _lrnQuizzesRef();
    if (opts.status) q = q.where('status', '==', opts.status);
    q = q.orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function getLrnQuiz(opts) {
    var id = (opts && opts.id) || opts; if (!id) throw new Error('id required');
    return _lrnQuizzesRef().doc(id).get().then(function(d) {
      if (!d.exists) return null;
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createLrnQuiz(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    data.status = data.status || 'Draft';
    return _lrnQuizzesRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateLrnQuiz(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _lrnQuizzesRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function publishLrnQuiz(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _lrnQuizzesRef().doc(id).update({ status: 'Published', publishedAt: _now() }).then(function() {
      return { id: id, success: true };
    });
  }

  function deleteLrnQuiz(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _lrnQuizzesRef().doc(id).delete().then(function() {
      return { id: id, success: true };
    });
  }

  /* ── Learning — Quiz Results ──────────────────────────────────── */

  function _lrnQuizResultsRef() { return _churchDoc().collection('learningQuizResults'); }

  function listLrnQuizResults(opts) {
    opts = opts || {};
    var q = _lrnQuizResultsRef().orderBy('completedAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function submitLrnQuizResult(data) {
    data.completedAt = _now();
    data.submittedBy = _userEmail;
    return _lrnQuizResultsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  /* ── Learning — Recommendations ───────────────────────────────── */

  function _lrnRecsRef() { return _churchDoc().collection('learningRecommendations'); }

  function listLrnRecommendations(opts) {
    opts = opts || {};
    var q = _lrnRecsRef();
    if (opts.status) q = q.where('status', '==', opts.status);
    q = q.orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function createLrnRecommendation(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _lrnRecsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function generateLrnRecommendations() {
    // Stub — in Firestore mode, recommendations are generated client-side or via Cloud Function
    return listLrnRecommendations({ status: 'Active' });
  }

  function acceptLrnRecommendation(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _lrnRecsRef().doc(id).update({ status: 'Accepted', acceptedAt: _now() }).then(function() {
      return { id: id, success: true };
    });
  }

  function dismissLrnRecommendation(opts) {
    var id = opts && opts.id; if (!id) throw new Error('id required');
    return _lrnRecsRef().doc(id).update({ status: 'Dismissed', dismissedAt: _now() }).then(function() {
      return { id: id, success: true };
    });
  }

  /* ── Learning — Progress ──────────────────────────────────────── */

  function _lrnProgressRef() { return _churchDoc().collection('learningProgress'); }

  function listLrnProgress(opts) {
    opts = opts || {};
    var q = _lrnProgressRef();
    if (opts.memberId) q = q.where('memberId', '==', opts.memberId);
    q = q.orderBy('updatedAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function completeLrnProgress(data) {
    data.completedAt = _now();
    data.completedBy = _userEmail;
    data.updatedAt = _now();
    return _lrnProgressRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function lrnProgressStats() {
    return _lrnProgressRef().where('completedBy', '==', _userEmail).get().then(function(snap) {
      var total = 0, complete = 0;
      snap.forEach(function(d) { total++; if (d.data().completedAt) complete++; });
      return { total: total, completed: complete };
    });
  }

  /* ── Learning — Notes ─────────────────────────────────────────── */

  function _lrnNotesRef() { return _churchDoc().collection('learningNotes'); }

  function listLrnNotes(opts) {
    opts = opts || {};
    var q = _lrnNotesRef();
    if (opts.playlistId) q = q.where('playlistId', '==', opts.playlistId);
    q = q.where('createdBy', '==', _userEmail).orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function createLrnNote(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _lrnNotesRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  /* ── Learning — Certificates ──────────────────────────────────── */

  function _lrnCertsRef() { return _churchDoc().collection('learningCertificates'); }

  function listLrnCertificates(opts) {
    opts = opts || {};
    var q = _lrnCertsRef().orderBy('issuedAt', 'desc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function issueLrnCertificate(data) {
    data.issuedAt = _now();
    data.issuedBy = _userEmail;
    return _lrnCertsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  /* ── Learning — Dashboard ─────────────────────────────────────── */

  function lrnDashboard() {
    return Promise.all([
      listLrnPlaylists({ limit: 200 }),
      listLrnTopics({ limit: 100 }),
      listLrnQuizzes({ limit: 100 })
    ]).then(function(res) {
      var playlists = res[0], topics = res[1], quizzes = res[2];
      return {
        totalPlaylists: playlists.length,
        totalTopics: topics.length,
        totalQuizzes: quizzes.length,
        activePlaylists: playlists.filter(function(p) { return p.status === 'Active'; }).length,
        publishedQuizzes: quizzes.filter(function(q) { return q.status === 'Published'; }).length
      };
    });
  }

  /* ── Learning — Sermon Search ─────────────────────────────────── */

  function searchLrnSermons(query) {
    // Search sermons collection by title/tags for learning integration
    return _churchDoc().collection('sermons').orderBy('date', 'desc').limit(200).get().then(function(snap) {
      var out = [];
      var q = (query || '').toLowerCase();
      snap.forEach(function(d) {
        var o = d.data(); o.id = d.id;
        var text = ((o.title || '') + ' ' + (o.tags || '') + ' ' + (o.speaker || '')).toLowerCase();
        if (!q || text.indexOf(q) >= 0) out.push(o);
      });
      return out;
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     THEOLOGY
     ══════════════════════════════════════════════════════════════════ */

  function _theoCatsRef() { return _churchDoc().collection('theologyCategories'); }
  function _theoSecsRef() { return _churchDoc().collection('theologySections'); }

  function listTheologyCategories(opts) {
    opts = opts || {};
    var q = _theoCatsRef().orderBy('sortOrder', 'asc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function getTheologyCategory(opts) {
    var id = (opts && opts.id) || opts; if (!id) throw new Error('id required');
    return _theoCatsRef().doc(id).get().then(function(d) {
      if (!d.exists) return null;
      var o = d.data(); o.id = d.id; return o;
    });
  }

  function createTheologyCategory(data) {
    data.createdAt = _now();
    data.createdBy = _userEmail;
    return _theoCatsRef().add(data).then(function(ref) {
      return { id: ref.id, success: true };
    });
  }

  function updateTheologyCategory(data) {
    var id = data.id; if (!id) throw new Error('id required');
    delete data.id;
    data.updatedAt = _now();
    return _theoCatsRef().doc(id).update(data).then(function() {
      return { id: id, success: true };
    });
  }

  function listTheologySections(opts) {
    opts = opts || {};
    var q = _theoSecsRef().orderBy('sortOrder', 'asc').limit(opts.limit || 200);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function theologyFlat() {
    return Promise.all([listTheologyCategories(), listTheologySections()]).then(function(res) {
      var cats = res[0], secs = res[1];
      var flat = [];
      cats.forEach(function(c) {
        flat.push(c);
        secs.filter(function(s) { return s.categoryId === c.id; }).forEach(function(s) { flat.push(s); });
      });
      return flat;
    });
  }

  function theologyFull() {
    return Promise.all([listTheologyCategories(), listTheologySections()]).then(function(res) {
      var cats = res[0], secs = res[1];
      return cats.map(function(c) {
        c.sections = secs.filter(function(s) { return s.categoryId === c.id; });
        return c;
      });
    });
  }

  function theologyDashboard() {
    return Promise.all([listTheologyCategories(), listTheologySections()]).then(function(res) {
      return { totalCategories: res[0].length, totalSections: res[1].length };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     ALBUMS — photo & media galleries
     ══════════════════════════════════════════════════════════════════ */

  function _albumsRef() { return _churchDoc().collection('albums'); }

  function listAlbums(opts) {
    opts = opts || {};
    var q = _albumsRef().orderBy('createdAt', 'desc');
    q = q.limit(opts.limit || 100);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function createAlbum(data) {
    data.createdAt = _ts();
    data.createdBy = _userEmail;
    return _albumsRef().add(data).then(function(ref) { data.id = ref.id; return data; });
  }

  function updateAlbum(data) {
    var id = data.id; delete data.id;
    data.updatedAt = _ts();
    data.updatedBy = _userEmail;
    return _albumsRef().doc(id).update(data);
  }

  function deleteAlbum(id) {
    return _albumsRef().doc(id).delete();
  }

  /* ══════════════════════════════════════════════════════════════════
     STATISTICS & ANALYTICS
     ══════════════════════════════════════════════════════════════════ */

  function _statsConfigRef()    { return _churchDoc().collection('statisticsConfig'); }
  function _statsSnapshotsRef() { return _churchDoc().collection('statisticsSnapshots'); }
  function _statsViewsRef()     { return _churchDoc().collection('statisticsViews'); }

  // ── Dashboard: aggregate key metrics from latest snapshot ───────
  function statsDashboard() {
    return _statsSnapshotsRef().orderBy('createdAt', 'desc').limit(1)
      .get().then(function(snap) {
        if (snap.empty) return { stats: [] };
        var d = snap.docs[0].data();
        return { stats: d.metrics || d.stats || d.data || [] };
      });
  }

  // ── Trends: gather snapshots within period, group by metric ─────
  function statsTrends(opts) {
    opts = opts || {};
    var days = opts.period || 90;
    var since = new Date(); since.setDate(since.getDate() - days);
    return _statsSnapshotsRef()
      .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(since))
      .orderBy('createdAt', 'asc')
      .get().then(function(snap) {
        var byMetric = {};
        snap.forEach(function(d) {
          var o = d.data();
          var metrics = o.metrics || o.data || [];
          if (!Array.isArray(metrics)) {
            metrics = Object.entries(metrics).map(function(e) { return { label: e[0], value: e[1] }; });
          }
          metrics.forEach(function(m) {
            var key = m.label || m.name || m.metric || 'unknown';
            if (!byMetric[key]) byMetric[key] = { metric: key, data: [] };
            byMetric[key].data.push(m.value != null ? m.value : m.count != null ? m.count : 0);
          });
        });
        return { trends: Object.values(byMetric) };
      });
  }

  // ── Compute: take a fresh snapshot now ──────────────────────────
  function statsCompute() {
    // In Firebase mode compute = create a new snapshot from current config
    return _statsConfigRef().get().then(function(snap) {
      var metricKeys = [];
      snap.forEach(function(d) { var c = d.data(); metricKeys.push(c.key || c.metricKey || d.id); });
      var snapData = { createdAt: _ts(), createdBy: _userEmail, label: 'Auto-compute', metrics: {} };
      metricKeys.forEach(function(k) { snapData.metrics[k] = 0; }); // placeholder for real values
      return _statsSnapshotsRef().add(snapData);
    });
  }

  // ── Export: build CSV from latest dashboard ─────────────────────
  function statsExport() {
    return statsDashboard().then(function(res) {
      return { stats: res.stats }; // caller builds CSV in the_tabernacle.js
    });
  }

  // ── Config CRUD ─────────────────────────────────────────────────
  function listStatsConfig()   { return _statsConfigRef().get().then(_snapToArr); }
  function getStatsConfig(id)  { return _statsConfigRef().doc(id).get().then(function(d) { var o = d.data() || {}; o.id = d.id; return { config: o }; }); }
  function createStatsConfig(data) {
    data.createdAt = _ts(); data.createdBy = _userEmail;
    return _statsConfigRef().add(data);
  }
  function updateStatsConfig(data) {
    var id = data.id; delete data.id;
    data.updatedAt = _ts(); data.updatedBy = _userEmail;
    return _statsConfigRef().doc(id).update(data);
  }
  function deleteStatsConfig(id) { return _statsConfigRef().doc(id).delete(); }

  // ── Snapshots CRUD ──────────────────────────────────────────────
  function listStatsSnapshots(opts) {
    opts = opts || {};
    return _statsSnapshotsRef().orderBy('createdAt', 'desc').limit(opts.limit || 100).get().then(_snapToArr);
  }
  function getStatsSnapshot(id) {
    return _statsSnapshotsRef().doc(id).get().then(function(d) { var o = d.data() || {}; o.id = d.id; return { snapshot: o }; });
  }
  function createStatsSnapshot(data) {
    data.createdAt = _ts(); data.createdBy = _userEmail;
    return _statsSnapshotsRef().add(data).then(function(ref) { data.id = ref.id; return data; });
  }
  function deleteStatsSnapshot(id) { return _statsSnapshotsRef().doc(id).delete(); }

  // ── Views CRUD ──────────────────────────────────────────────────
  function listStatsViews()    { return _statsViewsRef().get().then(_snapToArr); }
  function createStatsView(data) {
    data.createdAt = _ts(); data.createdBy = _userEmail;
    return _statsViewsRef().add(data);
  }
  function updateStatsView(data) {
    var id = data.id; delete data.id;
    data.updatedAt = _ts(); data.updatedBy = _userEmail;
    return _statsViewsRef().doc(id).update(data);
  }
  function deleteStatsView(id) { return _statsViewsRef().doc(id).delete(); }

  // ── helper: snapshot array conversion ───────────────────────────
  function _snapToArr(snap) {
    var out = [];
    snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════
     MISSIONS
     ══════════════════════════════════════════════════════════════════ */

  function _missionsRef(sub) { return _churchDoc().collection(sub); }

  // Registry (countries / Bible Access List) lives at the TOP LEVEL of the
  // Firestore project — it is global world-state, shared across all churches,
  // not nested under churches/{churchId}/.
  function _missionsRegistryRef() { return _db.collection('missionsRegistry'); }

  // generic CRUD factory for each missions sub-collection
  function _mList(col, opts) {
    opts = opts || {};
    var q = _missionsRef(col);
    if (opts.id) return q.doc(opts.id).get().then(function(d) { var o = d.data() || {}; o.id = d.id; return [o]; });
    q = q.orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(_snapToArr);
  }
  function _mGet(col, p) {
    var id = (typeof p === 'string') ? p : p.id;
    return _missionsRef(col).doc(id).get().then(function(d) { var o = d.data() || {}; o.id = d.id; return o; });
  }
  function _mCreate(col, data) {
    data.createdAt = _now(); data.createdBy = _userEmail;
    return _missionsRef(col).add(data).then(function(ref) { data.id = ref.id; return data; });
  }
  function _mUpdate(col, data) {
    var id = data.id; delete data.id;
    data.updatedAt = _now(); data.updatedBy = _userEmail;
    return _missionsRef(col).doc(id).update(data);
  }
  function _mDelete(col, p) {
    var id = (typeof p === 'string') ? p : p.id;
    return _missionsRef(col).doc(id).delete().then(function() { return { success: true }; });
  }

  // ── Registry (countries) — TOP-LEVEL collection, not church-scoped ──
  function listMissionsRegistry(opts) {
    opts = opts || {};
    var q = _missionsRegistryRef();
    if (opts.id) return q.doc(opts.id).get().then(function(d) { var o = d.data() || {}; o.id = d.id; return [o]; });
    return q.orderBy('countryName').limit(opts.limit || 300).get().then(_snapToArr);
  }
  function getMissionsRegistry(p) {
    var id = (typeof p === 'string') ? p : p.id;
    return _missionsRegistryRef().doc(id).get().then(function(d) { var o = d.data() || {}; o.id = d.id; return o; });
  }
  function createMissionsRegistry(data) {
    data.createdAt = _now(); data.createdBy = _userEmail;
    // Use the country slug as the document ID when possible so we never get duplicates
    var slug = (data.countryName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (slug) {
      return _missionsRegistryRef().doc(slug).set(data, { merge: true }).then(function() { data.id = slug; return data; });
    }
    return _missionsRegistryRef().add(data).then(function(ref) { data.id = ref.id; return data; });
  }
  function updateMissionsRegistry(data) {
    var id = data.id; delete data.id;
    data.updatedAt = _now(); data.updatedBy = _userEmail;
    return _missionsRegistryRef().doc(id).update(data);
  }
  function deleteMissionsRegistry(p) {
    var id = (typeof p === 'string') ? p : p.id;
    return _missionsRegistryRef().doc(id).delete().then(function() { return { success: true }; });
  }

  // ── Partners ────────────────────────────────────────────────────
  function listMissionsPartners(opts) { return _mList('missionsPartners', opts); }
  function getMissionsPartners(p)     { return _mGet('missionsPartners', p); }
  function createMissionsPartners(d)  { return _mCreate('missionsPartners', d); }
  function updateMissionsPartners(d)  { return _mUpdate('missionsPartners', d); }
  function deleteMissionsPartners(p)  { return _mDelete('missionsPartners', p); }

  // ── Prayer Focus ────────────────────────────────────────────────
  function listMissionsPrayerFocus(opts) { return _mList('missionsPrayerFocus', opts); }
  function createMissionsPrayerFocus(d)  { return _mCreate('missionsPrayerFocus', d); }
  function updateMissionsPrayerFocus(d)  { return _mUpdate('missionsPrayerFocus', d); }
  function deleteMissionsPrayerFocus(p) { return _mDelete('missionsPrayerFocus', p); }
  function respondMissionsPrayerFocus(p) {
    return _missionsRef('missionsPrayerFocus').doc(p.id).update({
      lastPrayedAt: _now(),
      prayerCount: firebase.firestore.FieldValue.increment(1),
      updatedBy: _userEmail
    });
  }

  // ── Updates (field reports) ─────────────────────────────────────
  function listMissionsUpdates(opts) { return _mList('missionsUpdates', opts); }
  function getMissionsUpdates(p)     { return _mGet('missionsUpdates', p); }
  function createMissionsUpdates(d)  { return _mCreate('missionsUpdates', d); }
  function updateMissionsUpdates(d)  { return _mUpdate('missionsUpdates', d); }
  function deleteMissionsUpdates(p)   { return _mDelete('missionsUpdates', p); }

  // ── Teams ───────────────────────────────────────────────────────
  function listMissionsTeams(opts) { return _mList('missionsTeams', opts); }
  function getMissionsTeams(p)     { return _mGet('missionsTeams', p); }
  function createMissionsTeams(d)  { return _mCreate('missionsTeams', d); }
  function updateMissionsTeams(d)  { return _mUpdate('missionsTeams', d); }
  function deleteMissionsTeams(p)     { return _mDelete('missionsTeams', p); }

  // ── Bulk create (for restore) ───────────────────────────────────
  function missionsBulkCreate(p) {
    var col = 'missionsRegistry';
    if (p.tab === 'MissionsPartners') col = 'missionsPartners';
    else if (p.tab === 'MissionsPrayerFocus') col = 'missionsPrayerFocus';
    else if (p.tab === 'MissionsUpdates') col = 'missionsUpdates';
    else if (p.tab === 'MissionsTeams') col = 'missionsTeams';
    var batch = _db.batch();
    // Registry is global (top-level), all other missions tabs are church-scoped
    var ref = (col === 'missionsRegistry') ? _missionsRegistryRef() : _missionsRef(col);
    (p.rows || []).forEach(function(r) { batch.set(ref.doc(), r); });
    return batch.commit();
  }

  /* ══════════════════════════════════════════════════════════════════
     APP CONFIG — key/value configuration pairs
     ══════════════════════════════════════════════════════════════════ */

  function _appConfigRef() { return _churchDoc().collection('appConfig'); }

  function listAppConfig() {
    return _appConfigRef().get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; o.key = o.key || d.id; out.push(o); });
      return out;
    });
  }

  function getAppConfig(opts) {
    var key = opts.key || opts.id;
    return _appConfigRef().doc(key).get().then(function(d) {
      if (!d.exists) return { key: key, value: '' };
      var o = d.data(); o.id = d.id; o.key = o.key || d.id;
      return o;
    });
  }

  function setAppConfig(data) {
    var key = data.key;
    var doc = {
      key: key,
      value: data.value != null ? data.value : '',
      updatedAt: _ts(),
      updatedBy: _userEmail
    };
    if (data.description) doc.description = data.description;
    if (data.category)    doc.category    = data.category;
    return _appConfigRef().doc(key).set(doc, { merge: true });
  }

  function updateAppConfig(data) {
    return setAppConfig(data);
  }

  /* ══════════════════════════════════════════════════════════════════
     MAINTENANCE MODE — global (not church-scoped) appConfig/system
     ══════════════════════════════════════════════════════════════════ */

  function _globalAppConfigRef() { return _db.collection('appConfig'); }

  function getMaintenanceStatus() {
    return _globalAppConfigRef().doc('system').get().then(function(d) {
      if (!d.exists) return { maintenance: false };
      return d.data();
    });
  }

  function setMaintenanceMode(data) {
    var enabled = !!(data && data.maintenance);
    return _globalAppConfigRef().doc('system').set({
      maintenance: enabled,
      updatedAt: _ts(),
      updatedBy: _userEmail
    }, { merge: true });
  }

  /* ══════════════════════════════════════════════════════════════════
     USER PREFERENCES — per-user preferences
     ══════════════════════════════════════════════════════════════════ */

  function _prefsRef() { return _churchDoc().collection('preferences'); }
  function _prefsDocId() { return (_userEmail || 'anon').replace(/[^a-zA-Z0-9@._-]/g, '_'); }

  function getUserPreferences() {
    return _prefsRef().doc(_prefsDocId()).get().then(function(d) {
      return d.exists ? d.data() : {};
    });
  }

  function updateUserPreferences(data) {
    data.updatedAt = _ts();
    return _prefsRef().doc(_prefsDocId()).set(data, { merge: true });
  }

  /* ══════════════════════════════════════════════════════════════════
     CONTACTS / PASTORAL NOTES / MILESTONES / HOUSEHOLDS
     ══════════════════════════════════════════════════════════════════ */

  function _contactsRef()   { return _churchDoc().collection('contactLog'); }
  function _notesRef()      { return _churchDoc().collection('pastoralNotes'); }
  function _milestonesRef() { return _churchDoc().collection('milestones'); }
  function _householdsRef() { return _churchDoc().collection('households'); }

  function listContacts(opts) {
    opts = opts || {};
    var q = _contactsRef().orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(_snapToArr);
  }
  function createContact(data) {
    data.createdAt = _ts(); data.createdBy = _userEmail;
    return _contactsRef().add(data).then(function(ref) {
      data.id = ref.id;
      // Auto-touch any open care cases for this member.
      _touchOpenCareCases(data.memberId, data.contactType || data.channel || 'unknown');
      return data;
    });
  }

  function listPastoralNotes(opts) {
    opts = opts || {};
    var q = _notesRef().orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(_snapToArr);
  }
  function createPastoralNote(data) {
    data.createdAt = _ts(); data.createdBy = _userEmail;
    return _notesRef().add(data).then(function(ref) { data.id = ref.id; return data; });
  }

  function listMilestones(opts) {
    opts = opts || {};
    var q = _milestonesRef().orderBy('createdAt', 'desc').limit(opts.limit || 200);
    return q.get().then(_snapToArr);
  }

  function createMilestone(data) {
    data = data || {};
    data.createdAt = _ts();
    data.createdBy = _userEmail;
    return _milestonesRef().add(data).then(function(ref) {
      data.id = ref.id; return data;
    });
  }

  function updateMilestone(data) {
    data = data || {};
    var id = data.id;
    if (!id) return Promise.reject('milestone id required');
    var payload = Object.assign({}, data);
    delete payload.id;
    payload.updatedAt = _ts();
    payload.updatedBy = _userEmail;
    return _milestonesRef().doc(id).update(payload).then(function() {
      payload.id = id; return payload;
    });
  }

  function deleteMilestone(id) {
    if (id && typeof id === 'object') id = id.id;
    if (!id) return Promise.reject('milestone id required');
    return _milestonesRef().doc(id).delete();
  }

  function listHouseholds(opts) {
    opts = opts || {};
    var q = _householdsRef().orderBy('name', 'asc').limit(opts.limit || 200);
    return q.get().then(_snapToArr);
  }

  /* ══════════════════════════════════════════════════════════════════
     AUDIT LOG
     ══════════════════════════════════════════════════════════════════ */

  function _auditRef() { return _churchDoc().collection('auditLog'); }

  function listAudit(opts) {
    opts = opts || {};
    var q = _auditRef().orderBy('ts', 'desc').limit(opts.limit || 200);
    return q.get().then(_snapToArr);
  }

  function writeAuditEntry(entry) {
    // Write a single audit entry directly to the auditLog collection.
    // Called for client-side events (e.g. view) that don't go through the backend API.
    return _auditRef().add({
      ts:         entry.ts || new Date().toISOString(),
      actorEmail: entry.user || '',
      role:       entry.role || '',
      action:     entry.action || '',
      entityType: entry.target || '',
      entityId:   entry.targetId || '',
      details:    entry.detail || '',
    }).catch(function() { /* non-fatal */ });
  }

  /* ══════════════════════════════════════════════════════════════════
     ACCESS CONTROL
     ══════════════════════════════════════════════════════════════════ */

  function _accessRef() { return _churchDoc().collection('accessControl'); }

  function listAccess() {
    return _accessRef().get().then(_snapToArr);
  }
  function setAccess(data) {
    var email = (data.email || '').toLowerCase();
    return _accessRef().doc(email).set({
      email: email,
      role: data.role || 'member',
      displayName: data.displayName || '',
      updatedAt: _ts(),
      updatedBy: _userEmail
    }, { merge: true });
  }
  function removeAccess(data) {
    var email = (data.email || '').toLowerCase();
    return _accessRef().doc(email).delete();
  }

  /* ══════════════════════════════════════════════════════════════════
     MEMBER CARDS — extended methods
     ══════════════════════════════════════════════════════════════════ */

  function memberCardsDashboard() {
    return listMemberCards({ limit: 500 }).then(function(cards) {
      var active = cards.filter(function(c) { return c.status !== 'archived'; });
      return {
        totalCards: cards.length,
        activeCards: active.length,
        archivedCards: cards.length - active.length
      };
    });
  }

  function memberCardsMine() {
    return _memberCardsRef().where('email', '==', _userEmail)
      .limit(1).get().then(function(snap) {
        if (snap.empty) return null;
        var d = snap.docs[0].data(); d.id = snap.docs[0].id; return d;
      });
  }

  function memberCardsByNumber(opts) {
    var num = opts.cardNumber || opts.memberNumber || '';
    return _memberCardsRef().where('memberNumber', '==', num)
      .limit(1).get().then(function(snap) {
        if (snap.empty) return null;
        var d = snap.docs[0].data(); d.id = snap.docs[0].id; return d;
      });
  }

  function memberCardsArchive(opts) {
    return _memberCardsRef().doc(opts.id).update({ status: 'archived', archivedAt: _ts(), archivedBy: _userEmail });
  }

  function memberCardsBulkProvision(opts) {
    var count = opts.count || 1;
    var prefix = opts.prefix || 'MC';
    var batch = _db.batch();
    for (var i = 0; i < count; i++) {
      var num = prefix + '-' + String(Date.now()).slice(-6) + String(i).padStart(3, '0');
      batch.set(_memberCardsRef().doc(), { memberNumber: num, status: 'unassigned', createdAt: _ts(), createdBy: _userEmail });
    }
    return batch.commit();
  }

  function memberCardsVcard(opts) {
    // In Firebase mode, build a vCard URL from the card data
    var id = opts.memberNumber || opts.id;
    return getMemberCard(id).then(function(card) {
      if (!card) return null;
      var lines = ['BEGIN:VCARD','VERSION:3.0'];
      if (card.firstName || card.lastName) lines.push('N:' + (card.lastName || '') + ';' + (card.firstName || ''));
      if (card.firstName || card.lastName) lines.push('FN:' + ((card.firstName || '') + ' ' + (card.lastName || '')).trim());
      if (card.email) lines.push('EMAIL:' + card.email);
      if (card.phone) lines.push('TEL:' + card.phone);
      lines.push('END:VCARD');
      var blob = new Blob([lines.join('\r\n')], { type: 'text/vcard' });
      return URL.createObjectURL(blob);
    });
  }

  function memberCardsDirectory() {
    return listMemberCards({ limit: 500 }).then(function(cards) {
      return cards.filter(function(c) { return c.status !== 'archived' && c.visibility !== 'hidden'; });
    });
  }

  // ── Member Card Links — subcollection ──────────────────────────
  function _cardLinksRef(cardId) { return _memberCardsRef().doc(cardId).collection('links'); }

  function listCardLinks(opts) {
    return _cardLinksRef(opts.cardId).get().then(_snapToArr);
  }
  function createCardLink(data) {
    var cardId = data.cardId; delete data.cardId;
    data.createdAt = _ts();
    return _cardLinksRef(cardId).add(data).then(function(ref) { data.id = ref.id; return data; });
  }
  function deleteCardLink(opts) {
    // Requires knowing which card the link belongs to; search if needed
    if (opts.cardId) return _cardLinksRef(opts.cardId).doc(opts.id).delete();
    // Fallback: try to find by iterating (not ideal but functional)
    return listMemberCards({ limit: 500 }).then(function(cards) {
      var promises = cards.map(function(c) {
        return _cardLinksRef(c.id).doc(opts.id).delete().catch(function() {});
      });
      return Promise.all(promises);
    });
  }

  // ── Member Card Views — subcollection ──────────────────────────
  function _cardViewsRef() { return _churchDoc().collection('memberCardViews'); }

  function listCardViews(opts) {
    opts = opts || {};
    return _cardViewsRef().orderBy('viewedAt', 'desc').limit(opts.limit || 80).get().then(_snapToArr);
  }
  function myCardViews() {
    return _cardViewsRef().where('viewerEmail', '==', _userEmail)
      .orderBy('viewedAt', 'desc').limit(30).get().then(_snapToArr);
  }

  /* ══════════════════════════════════════════════════════════════════
     BULK OPERATIONS & DATA TOOLS
     ══════════════════════════════════════════════════════════════════ */

  function bulkCreate(p) {
    var colMap = {
      Members:             'members',
      Events:              'events',
      SmallGroups:         'groups',
      Giving:              'giving',
      Ministries:          'ministries',
      Songs:               'songs',
      Sermons:             'sermons',
      SermonSeries:        'sermonSeries',
      DiscipleshipPaths:   'discipleshipPaths',
      TheologyCategories:  'theologyCategories',
      TheologySections:    'theologySections',
      LearningPlaylists:   'learningPlaylists',
      MemberCards:         'memberCards',
      AppConfig:           'appConfig'
    };
    var col = colMap[p.tab] || p.tab;
    var batch = _db.batch();
    var ref = _churchDoc().collection(col);
    (p.rows || []).forEach(function(r) {
      r.createdAt = _ts(); r.createdBy = _userEmail;
      batch.set(ref.doc(), r);
    });
    return batch.commit();
  }

  function bulkMembersImport(opts) {
    var records = typeof opts.records === 'string' ? JSON.parse(opts.records) : (opts.records || []);
    var batch = _db.batch();
    var ref = _churchDoc().collection('members');
    records.forEach(function(r) {
      r.createdAt = _ts(); r.createdBy = _userEmail;
      batch.set(ref.doc(), r);
    });
    return batch.commit().then(function() { return { imported: records.length }; });
  }

  function bulkDataExport(opts) {
    var col = opts.tab || 'members';
    return _churchDoc().collection(col).get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     REPORTS
     ══════════════════════════════════════════════════════════════════ */

  function reportsDashboard() {
    // Aggregation from existing data — return counts per domain
    return Promise.all([
      _churchDoc().collection('members').get().then(function(s) { return s.size; }),
      _churchDoc().collection('events').get().then(function(s) { return s.size; }),
      _churchDoc().collection('giving').get().then(function(s) { return s.size; }),
      _churchDoc().collection('attendance').get().then(function(s) { return s.size; }),
      _churchDoc().collection('groups').get().then(function(s) { return s.size; }),
    ]).then(function(counts) {
      return {
        members: counts[0],
        events: counts[1],
        giving: counts[2],
        attendance: counts[3],
        groups: counts[4]
      };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     APP CONTENT (read-only reference data — per-church Truth content)
     ══════════════════════════════════════════════════════════════════ */

  function _appContentRef(type) { return _churchRef().collection(type); }

  function listAppContent(type, opts) {
    opts = opts || {};
    var q = _appContentRef(type);
    // Devotionals: fetch from yesterday onward (no upper bound) — includes yesterday + all future.
    if (type === 'devotionals' && !opts.skipDateFilter) {
      var _yesterday = new Date();
      _yesterday.setDate(_yesterday.getDate() - 1);
      function _pad(n) { return n < 10 ? '0' + n : '' + n; }
      function _ymd(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }
      q = q.where('date', '>=', _ymd(_yesterday));
    }
    if (opts.orderBy) q = q.orderBy(opts.orderBy, opts.dir || 'asc');
    if (opts.limit) q = q.limit(opts.limit);
    return q.get().then(function(snap) {
      var out = [];
      snap.forEach(function(d) { var o = d.data(); o.id = d.id; out.push(o); });
      return out;
    });
  }

  function getAppContent(type, id) {
    return _appContentRef(type).doc(id).get().then(function(snap) {
      if (!snap.exists) return null;
      var o = snap.data(); o.id = snap.id; return o;
    });
  }

  /* ── Strategic Plan (Goals / Initiatives / Key Dates) ─────────── */
  function _stratGoalsRef()  { return _churchRef().collection('strategicGoals'); }
  function _stratInitsRef()  { return _churchRef().collection('strategicInitiatives'); }
  function _stratDatesRef()  { return _churchRef().collection('strategicKeyDates'); }

  function listStrategicGoals(opts) {
    return _paginatedGet(_stratGoalsRef().orderBy('createdAt', 'desc'), opts || { limit: 200 });
  }
  function createStrategicGoal(data) {
    var id = _uid();
    var doc = Object.assign({}, data, { createdBy: _userEmail, createdAt: _now(), updatedAt: _now() });
    delete doc.id;
    return _stratGoalsRef().doc(id).set(doc).then(function() { return Object.assign({ id: id }, doc); });
  }
  function updateStrategicGoal(data) {
    var id = String(data.id);
    var doc = Object.assign({}, data, { updatedAt: _now() });
    delete doc.id;
    return _stratGoalsRef().doc(id).update(doc).then(function() { return Object.assign({ id: id }, doc); });
  }
  function deleteStrategicGoal(opts) {
    return _stratGoalsRef().doc(String(opts.id)).delete();
  }

  function listStrategicInitiatives(opts) {
    return _paginatedGet(_stratInitsRef().orderBy('createdAt', 'desc'), opts || { limit: 200 });
  }
  function createStrategicInitiative(data) {
    var id = _uid();
    var doc = Object.assign({}, data, { createdBy: _userEmail, createdAt: _now(), updatedAt: _now() });
    delete doc.id;
    return _stratInitsRef().doc(id).set(doc).then(function() { return Object.assign({ id: id }, doc); });
  }
  function updateStrategicInitiative(data) {
    var id = String(data.id);
    var doc = Object.assign({}, data, { updatedAt: _now() });
    delete doc.id;
    return _stratInitsRef().doc(id).update(doc).then(function() { return Object.assign({ id: id }, doc); });
  }
  function deleteStrategicInitiative(opts) {
    return _stratInitsRef().doc(String(opts.id)).delete();
  }

  function listStrategicKeyDates(opts) {
    return _paginatedGet(_stratDatesRef().orderBy('createdAt', 'desc'), opts || { limit: 200 });
  }
  function createStrategicKeyDate(data) {
    var id = _uid();
    var doc = Object.assign({}, data, { createdBy: _userEmail, createdAt: _now(), updatedAt: _now() });
    delete doc.id;
    return _stratDatesRef().doc(id).set(doc).then(function() { return Object.assign({ id: id }, doc); });
  }
  function updateStrategicKeyDate(data) {
    var id = String(data.id);
    var doc = Object.assign({}, data, { updatedAt: _now() });
    delete doc.id;
    return _stratDatesRef().doc(id).update(doc).then(function() { return Object.assign({ id: id }, doc); });
  }
  function deleteStrategicKeyDate(opts) {
    return _stratDatesRef().doc(String(opts.id)).delete();
  }

  /* ── Error Telemetry (disabled — manual debugging only) ──────────── */
  function logError() {
    // Firestore error logging disabled to reduce writes.
    // Use browser console + copy/paste for debugging.
  }

  /* ══════════════════════════════════════════════════════════════════
     PUBLIC API — window.UpperRoom
     ══════════════════════════════════════════════════════════════════ */

  window.UpperRoom = {
    // Lifecycle
    init:           init,
    authenticate:   authenticate,
    signOut:        signOut,
    detachAll:      detachAll,

    // State
    isReady:        function() { return _ready; },
    waitReady:      function() {
      if (_ready) return Promise.resolve();
      return new Promise(function(resolve, reject) {
        var tries = 0;
        var iv = setInterval(function() {
          tries++;
          if (_ready) { clearInterval(iv); resolve(); return; }
          if (tries >= 100) { clearInterval(iv); reject(new Error('UpperRoom.waitReady() timed out after 10s')); }
        }, 100);
      });
    },
    churchId:       function() { return _churchId; },
    userEmail:      function() { return _userEmail; },

    // Conversations
    createDM:           createDM,
    createRoom:         createRoom,
    createThread:       createThread,
    createChannel:      createChannel,
    listConversations:  listConversations,
    listSentConversations: listSentConversations,
    listenConversations: listenConversations,
    getConversation:    getConversation,
    updateConversation: updateConversation,
    archiveConversation: archiveConversation,
    deleteConversation: deleteConversation,
    browseRooms:        browseRooms,
    browseChannels:     browseChannels,
    subscribeChannel:   subscribeChannel,
    unsubscribeChannel: unsubscribeChannel,
    postToChannel:      postToChannel,

    // Templates
    listTemplates:   listTemplates,
    getTemplate:     getTemplate,
    createTemplate:  createTemplate,
    updateTemplate:  updateTemplate,
    deleteTemplate:  deleteTemplate,

    // Broadcasts
    listBroadcasts:  listBroadcasts,
    createBroadcast: createBroadcast,

    // Notification Preferences
    getNotifPrefs:    getNotifPrefs,
    updateNotifPrefs: updateNotifPrefs,

    // Prayer Requests
    listPrayers:    listPrayers,
    countOpenPrayers: countOpenPrayers,
    getPrayer:      getPrayer,
    createPrayer:   createPrayer,
    updatePrayer:   updatePrayer,
    deletePrayer:   deletePrayer,
    listenPrayers:  listenPrayers,
    listPrayerInteractions: listPrayerInteractions,
    addPrayerInteraction:   addPrayerInteraction,

    // Todos / Tasks
    listTodos:      listTodos,
    myTodos:        myTodos,
    createTodo:     createTodo,
    updateTodo:     updateTodo,
    completeTodo:   completeTodo,
    archiveTodo:    archiveTodo,
    unarchiveTodo:  unarchiveTodo,
    deleteTodo:     deleteTodo,
    listenTodos:    listenTodos,

    // Settings
    getCommsMode:       getCommsMode,
    setCommsMode:       setCommsMode,

    // Membership
    joinRoom:       joinRoom,
    leaveRoom:      leaveRoom,
    addParticipant: addParticipant,

    // Messages
    sendMessage:    sendMessage,
    getMessages:    getMessages,
    listenMessages: listenMessages,
    deleteMessage:  deleteMessage,

    // Notifications
    createNotification:  createNotification,
    listenNotifications: listenNotifications,
    listNotifications:   listNotifications,
    markNotifRead:       markNotifRead,
    markAllNotifsRead:   markAllNotifsRead,
    getUnreadCount:      getUnreadCount,
    dismissNotification: dismissNotification,

    // Typing
    setTyping:      setTyping,
    listenTyping:   listenTyping,

    // Users
    listUsers:       listUsers,
    getUser:         getUser,
    createUser:      createUser,
    updateUser:      updateUser,
    approveUser:     approveUser,
    denyUser:        denyUser,
    resetPasscode:   resetPasscode,

    // Members
    listMembers:     listMembers,
    countMembers:    countMembers,
    getMember:       getMember,
    createMember:    createMember,
    updateMember:    updateMember,
    deleteMember:    deleteMember,
    deleteUserCascade: deleteUserCascade,

    // Touches (contact log)
    createTouch:     createTouch,
    listTouches:     listTouches,

    // Member Cards
    listMemberCards:   listMemberCards,
    getMemberCard:     getMemberCard,
    searchMemberCards: searchMemberCards,
    createMemberCard:  createMemberCard,
    updateMemberCard:  updateMemberCard,
    deleteMemberCard:  deleteMemberCard,

    // Permissions
    getPermissions:        getPermissions,
    listPermissionModules: listPermissionModules,
    setPermissions:        setPermissions,
    getMemberRole:         getMemberRole,
    setMemberRole:         setMemberRole,

    // Care Cases
    listCareCases:         listCareCases,
    getCareCase:           getCareCase,
    createCareCase:        createCareCase,
    updateCareCase:        updateCareCase,
    resolveCareCase:       resolveCareCase,
    careDashboard:         careDashboard,

    // Care Interactions
    listCareInteractions:       listCareInteractions,
    createCareInteraction:      createCareInteraction,
    followUpDoneCareInteraction: followUpDoneCareInteraction,
    careFollowUpsDue:           careFollowUpsDue,

    // Care Assignments
    listCareAssignments:       listCareAssignments,
    careAssignmentsForMember:  careAssignmentsForMember,
    careAssignmentsMyFlock:    careAssignmentsMyFlock,
    createCareAssignment:      createCareAssignment,
    reassignCareAssignment:    reassignCareAssignment,
    updateCareAssignment:      updateCareAssignment,
    endCareAssignment:         endCareAssignment,
    listCaregivers:            listCaregivers,

    // Compassion Requests
    listCompassionRequests:    listCompassionRequests,
    countOpenCompassionRequests: countOpenCompassionRequests,
    getCompassionRequest:      getCompassionRequest,
    createCompassionRequest:   createCompassionRequest,
    updateCompassionRequest:   updateCompassionRequest,
    approveCompassionRequest:  approveCompassionRequest,
    denyCompassionRequest:     denyCompassionRequest,
    resolveCompassionRequest:  resolveCompassionRequest,
    compassionDashboard:       compassionDashboard,

    // Compassion Logs
    listCompassionLogs:        listCompassionLogs,
    recentCompassionLogs:      recentCompassionLogs,
    createCompassionLog:       createCompassionLog,
    deleteCompassionLog:       deleteCompassionLog,

    // Compassion Resources
    listCompassionResources:   listCompassionResources,
    lowCompassionResources:    lowCompassionResources,
    createCompassionResource:  createCompassionResource,
    updateCompassionResource:  updateCompassionResource,

    // Outreach Contacts
    listOutreachContacts:      listOutreachContacts,
    getOutreachContact:        getOutreachContact,
    createOutreachContact:     createOutreachContact,
    updateOutreachContact:     updateOutreachContact,
    convertOutreachContact:    convertOutreachContact,
    deleteOutreachContact:     deleteOutreachContact,
    submitOutreachContact:     submitOutreachContact,

    // Outreach Campaigns
    listOutreachCampaigns:     listOutreachCampaigns,
    createOutreachCampaign:    createOutreachCampaign,
    updateOutreachCampaign:    updateOutreachCampaign,

    // Outreach Follow-ups
    listOutreachFollowUps:     listOutreachFollowUps,
    createOutreachFollowUp:    createOutreachFollowUp,
    outreachFollowUpDone:      outreachFollowUpDone,
    outreachFollowUpsDue:      outreachFollowUpsDue,
    outreachDashboard:         outreachDashboard,

    // Events
    listEvents:         listEvents,
    getEvent:           getEvent,
    createEvent:        createEvent,
    updateEvent:        updateEvent,
    cancelEvent:        cancelEvent,
    deleteEvent:        deleteEvent,
    publicEvents:       publicEvents,

    // RSVPs
    rsvpEvent:          rsvpEvent,
    listRsvps:          listRsvps,

    // Personal Calendar
    listCalendarEvents:       listCalendarEvents,
    getCalendarEvent:         getCalendarEvent,
    createCalendarEvent:      createCalendarEvent,
    updateCalendarEvent:      updateCalendarEvent,
    deleteCalendarEvent:      deleteCalendarEvent,
    listDelegatedCalendars:   listDelegatedCalendars,
    getCalendarShareToken:    getCalendarShareToken,

    // Groups
    listGroups:         listGroups,
    getGroup:           getGroup,
    createGroup:        createGroup,
    updateGroup:        updateGroup,
    listGroupMembers:   listGroupMembers,
    addGroupMember:     addGroupMember,
    removeGroupMember:  removeGroupMember,

    // Attendance
    listAttendance:     listAttendance,
    getAttendance:      getAttendance,
    createAttendance:   createAttendance,
    updateAttendance:   updateAttendance,
    attendanceSummary:  attendanceSummary,

    // Check-In
    checkinOpen:        checkinOpen,
    checkinClose:       checkinClose,
    checkinSessions:    checkinSessions,

    // Volunteers
    listVolunteers:     listVolunteers,
    getVolunteer:       getVolunteer,
    createVolunteer:    createVolunteer,
    updateVolunteer:    updateVolunteer,
    swapVolunteer:      swapVolunteer,

    // Ministries
    listMinistries:     listMinistries,
    getMinistry:        getMinistry,
    createMinistry:     createMinistry,
    updateMinistry:     updateMinistry,
    ministrySummary:    ministrySummary,
    ministryTree:       ministryTree,

    // Service Plans
    listServicePlans:   listServicePlans,
    getServicePlan:     getServicePlan,
    createServicePlan:      createServicePlan,
    updateServicePlan:      updateServicePlan,
    deleteAllServicePlans:  deleteAllServicePlans,

    // Service Orders (Anatomy of Worship)
    getServiceOrder:    getServiceOrder,
    saveServiceOrder:   saveServiceOrder,

    // Songs
    listSongs:               listSongs,
    getSong:                 getSong,
    createSong:              createSong,
    updateSong:              updateSong,
    deleteSong:              deleteSong,

    // Song Arrangements
    listSongArrangements:    listSongArrangements,
    getSongWithArrangements: getSongWithArrangements,
    createSongArrangement:   createSongArrangement,
    updateSongArrangement:   updateSongArrangement,
    deleteSongArrangement:   deleteSongArrangement,

    // Sermons
    listSermons:        listSermons,
    getSermon:          getSermon,
    createSermon:       createSermon,
    updateSermon:       updateSermon,
    deleteSermon:       deleteSermon,
    submitSermon:       submitSermon,
    approveSermon:      approveSermon,
    deliverSermon:      deliverSermon,
    uploadSermonMedia:  uploadSermonMedia,
    sermonDashboard:    sermonDashboard,

    // Sermon Series
    listSermonSeries:   listSermonSeries,
    getSermonSeries:    getSermonSeries,
    createSermonSeries: createSermonSeries,
    updateSermonSeries: updateSermonSeries,
    deleteSermonSeries: deleteSermonSeries,

    // Presentations (FlockShow)
    listPresentations:   listPresentations,
    getPresentation:     getPresentation,
    createPresentation:  createPresentation,
    updatePresentation:  updatePresentation,
    deletePresentation:  deletePresentation,

    // Sermon Reviews
    listSermonReviews:  listSermonReviews,
    createSermonReview: createSermonReview,

    // Giving
    listGiving:            listGiving,
    createGiving:          createGiving,
    updateGiving:          updateGiving,
    givingSummary:         givingSummary,
    memberGivingStatement: memberGivingStatement,

    // Pledges
    listPledges:  listPledges,
    createPledge: createPledge,
    updatePledge: updatePledge,

    // Journal
    listJournal:   listJournal,
    createJournal: createJournal,
    updateJournal: updateJournal,
    deleteJournal: deleteJournal,

    // Discipleship — Paths
    listDiscPaths:    listDiscPaths,
    getDiscPath:      getDiscPath,
    createDiscPath:   createDiscPath,
    updateDiscPath:   updateDiscPath,
    publishDiscPath:  publishDiscPath,
    archiveDiscPath:  archiveDiscPath,

    // Discipleship — Steps
    listDiscSteps:    listDiscSteps,
    getDiscStep:      getDiscStep,
    createDiscStep:   createDiscStep,
    updateDiscStep:   updateDiscStep,
    deleteDiscStep:   deleteDiscStep,

    // Discipleship — Enrollments
    listDiscEnrollments:    listDiscEnrollments,
    getDiscEnrollment:      getDiscEnrollment,
    createDiscEnrollment:   createDiscEnrollment,
    updateDiscEnrollment:   updateDiscEnrollment,
    advanceDiscEnrollment:  advanceDiscEnrollment,

    // Discipleship — Mentoring
    listDiscMentoring:    listDiscMentoring,
    getDiscMentoring:     getDiscMentoring,
    createDiscMentoring:  createDiscMentoring,
    updateDiscMentoring:  updateDiscMentoring,

    // Discipleship — Meetings
    createDiscMeeting: createDiscMeeting,

    // Discipleship — Goals
    listDiscGoals:    listDiscGoals,
    createDiscGoal:   createDiscGoal,
    updateDiscGoal:   updateDiscGoal,

    // Discipleship — Assessments
    listDiscAssessments:  listDiscAssessments,
    getDiscAssessment:    getDiscAssessment,
    createDiscAssessment: createDiscAssessment,

    // Discipleship — Milestones
    listDiscMilestones:   listDiscMilestones,
    createDiscMilestone:  createDiscMilestone,

    // Discipleship — Certificates
    listDiscCertificates:   listDiscCertificates,
    issueDiscCertificate:   issueDiscCertificate,
    revokeDiscCertificate:  revokeDiscCertificate,

    // Learning — Topics
    listLrnTopics:       listLrnTopics,
    createLrnTopic:      createLrnTopic,
    updateLrnTopic:      updateLrnTopic,
    deleteLrnTopic:      deleteLrnTopic,

    // Learning — Playlists
    listLrnPlaylists:      listLrnPlaylists,
    getLrnPlaylist:         getLrnPlaylist,
    createLrnPlaylist:     createLrnPlaylist,
    updateLrnPlaylist:     updateLrnPlaylist,
    deleteLrnPlaylist:     deleteLrnPlaylist,
    subscribeLrnPlaylist:  subscribeLrnPlaylist,

    // Learning — Playlist Items
    createLrnPlaylistItem:  createLrnPlaylistItem,
    updateLrnPlaylistItem:  updateLrnPlaylistItem,
    deleteLrnPlaylistItem:  deleteLrnPlaylistItem,
    reorderLrnPlaylistItem: reorderLrnPlaylistItem,

    // Learning — Quizzes
    listLrnQuizzes:   listLrnQuizzes,
    getLrnQuiz:        getLrnQuiz,
    createLrnQuiz:     createLrnQuiz,
    updateLrnQuiz:     updateLrnQuiz,
    publishLrnQuiz:    publishLrnQuiz,
    deleteLrnQuiz:     deleteLrnQuiz,

    // Learning — Quiz Results
    listLrnQuizResults:   listLrnQuizResults,
    submitLrnQuizResult:  submitLrnQuizResult,

    // Learning — Recommendations
    listLrnRecommendations:      listLrnRecommendations,
    createLrnRecommendation:     createLrnRecommendation,
    generateLrnRecommendations:  generateLrnRecommendations,
    acceptLrnRecommendation:     acceptLrnRecommendation,
    dismissLrnRecommendation:    dismissLrnRecommendation,

    // Learning — Progress
    listLrnProgress:      listLrnProgress,
    completeLrnProgress:  completeLrnProgress,
    lrnProgressStats:     lrnProgressStats,

    // Learning — Notes
    listLrnNotes:    listLrnNotes,
    createLrnNote:   createLrnNote,

    // Learning — Certificates
    listLrnCertificates:  listLrnCertificates,
    issueLrnCertificate:  issueLrnCertificate,

    // Learning — Dashboard & Search
    lrnDashboard:      lrnDashboard,
    searchLrnSermons:  searchLrnSermons,

    // Theology
    listTheologyCategories:  listTheologyCategories,
    getTheologyCategory:     getTheologyCategory,
    createTheologyCategory:  createTheologyCategory,
    updateTheologyCategory:  updateTheologyCategory,
    listTheologySections:    listTheologySections,
    theologyFlat:            theologyFlat,
    theologyFull:            theologyFull,
    theologyDashboard:       theologyDashboard,

    // App Content (global reference data)
    listAppContent:  listAppContent,
    getAppContent:   getAppContent,

    // Albums
    listAlbums:    listAlbums,
    createAlbum:   createAlbum,
    updateAlbum:   updateAlbum,
    deleteAlbum:   deleteAlbum,

    // Statistics & Analytics
    statsDashboard:       statsDashboard,
    statsTrends:          statsTrends,
    statsCompute:         statsCompute,
    statsExport:          statsExport,
    listStatsConfig:      listStatsConfig,
    getStatsConfig:       getStatsConfig,
    createStatsConfig:    createStatsConfig,
    updateStatsConfig:    updateStatsConfig,
    deleteStatsConfig:    deleteStatsConfig,
    listStatsSnapshots:   listStatsSnapshots,
    getStatsSnapshot:     getStatsSnapshot,
    createStatsSnapshot:  createStatsSnapshot,
    deleteStatsSnapshot:  deleteStatsSnapshot,
    listStatsViews:       listStatsViews,
    createStatsView:      createStatsView,
    updateStatsView:      updateStatsView,
    deleteStatsView:      deleteStatsView,

    // Missions
    listMissionsRegistry:     listMissionsRegistry,
    getMissionsRegistry:      getMissionsRegistry,
    createMissionsRegistry:   createMissionsRegistry,
    updateMissionsRegistry:   updateMissionsRegistry,
    deleteMissionsRegistry:   deleteMissionsRegistry,
    listMissionsPartners:     listMissionsPartners,
    getMissionsPartners:      getMissionsPartners,
    createMissionsPartners:   createMissionsPartners,
    updateMissionsPartners:   updateMissionsPartners,
    deleteMissionsPartners:   deleteMissionsPartners,
    listMissionsPrayerFocus:  listMissionsPrayerFocus,
    createMissionsPrayerFocus: createMissionsPrayerFocus,
    updateMissionsPrayerFocus: updateMissionsPrayerFocus,
    deleteMissionsPrayerFocus: deleteMissionsPrayerFocus,
    respondMissionsPrayerFocus: respondMissionsPrayerFocus,
    listMissionsUpdates:      listMissionsUpdates,
    getMissionsUpdates:       getMissionsUpdates,
    createMissionsUpdates:    createMissionsUpdates,
    updateMissionsUpdates:    updateMissionsUpdates,
    deleteMissionsUpdates:    deleteMissionsUpdates,
    listMissionsTeams:        listMissionsTeams,
    getMissionsTeams:         getMissionsTeams,
    createMissionsTeams:      createMissionsTeams,
    updateMissionsTeams:      updateMissionsTeams,
    deleteMissionsTeams:      deleteMissionsTeams,
    missionsBulkCreate:       missionsBulkCreate,

    // Strategic Plan
    listStrategicGoals:       listStrategicGoals,
    createStrategicGoal:      createStrategicGoal,
    updateStrategicGoal:      updateStrategicGoal,
    deleteStrategicGoal:      deleteStrategicGoal,
    listStrategicInitiatives:  listStrategicInitiatives,
    createStrategicInitiative: createStrategicInitiative,
    updateStrategicInitiative: updateStrategicInitiative,
    deleteStrategicInitiative: deleteStrategicInitiative,
    listStrategicKeyDates:     listStrategicKeyDates,
    createStrategicKeyDate:    createStrategicKeyDate,
    updateStrategicKeyDate:    updateStrategicKeyDate,
    deleteStrategicKeyDate:    deleteStrategicKeyDate,

    // App Config
    listAppConfig:         listAppConfig,
    getAppConfig:          getAppConfig,
    setAppConfig:          setAppConfig,
    updateAppConfig:       updateAppConfig,

    // Maintenance Mode (global)
    getMaintenanceStatus:  getMaintenanceStatus,
    setMaintenanceMode:    setMaintenanceMode,

    // User Preferences
    getUserPreferences:    getUserPreferences,
    updateUserPreferences: updateUserPreferences,

    // Contacts / Notes / Milestones / Households
    listContacts:          listContacts,
    createContact:         createContact,
    listPastoralNotes:     listPastoralNotes,
    createPastoralNote:    createPastoralNote,
    listMilestones:        listMilestones,
    createMilestone:       createMilestone,
    updateMilestone:       updateMilestone,
    deleteMilestone:       deleteMilestone,
    listHouseholds:        listHouseholds,

    // Audit
    listAudit:             listAudit,
    writeAuditEntry:       writeAuditEntry,

    // Access Control
    listAccess:            listAccess,
    setAccess:             setAccess,
    removeAccess:          removeAccess,

    // Member Cards — extended
    memberCardsDashboard:   memberCardsDashboard,
    memberCardsMine:        memberCardsMine,
    memberCardsByNumber:    memberCardsByNumber,
    memberCardsArchive:     memberCardsArchive,
    memberCardsBulkProvision: memberCardsBulkProvision,
    memberCardsVcard:       memberCardsVcard,
    memberCardsDirectory:   memberCardsDirectory,
    listCardLinks:          listCardLinks,
    createCardLink:         createCardLink,
    deleteCardLink:         deleteCardLink,
    listCardViews:          listCardViews,
    myCardViews:            myCardViews,

    // Bulk Operations & Data Tools
    bulkCreate:             bulkCreate,
    bulkMembersImport:      bulkMembersImport,
    bulkDataExport:         bulkDataExport,

    // Reports
    reportsDashboard:       reportsDashboard,

    // Utility
    timeAgo:        _timeAgo,

    // Error telemetry
    logError:       logError
  };

  // ── Auto-initialize on load (Firebase SDK is loaded before this script) ──
  try { init(); } catch (_) {}

})();
