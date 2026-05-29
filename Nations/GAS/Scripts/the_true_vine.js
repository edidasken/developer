/* ══════════════════════════════════════════════════════════════════════════════
   THE VINE — FlockOS Centralized API Client
   "I am the vine; you are the branches." — John 15:5

   Every API call in FlockOS flows through The Vine.
   4 branches — named after the four Gospels:

     Matthew  (app)       — Public content, teaching & instruction
     Mark     (missions)  — Global missions, going to the nations
     Luke     (extra)     — Statistics, analytics & future data
     John     (flock)     — Church management, shepherding the flock

   Usage (Gospel names or functional names — both work):
     TheVine.matthew.books()                              // or TheVine.app.books()
     TheVine.john.members.list({ status: 'active' })      // or TheVine.flock.members.list(…)
     TheVine.john.auth.login({ email, passcode })          // or TheVine.flock.auth.login(…)
     TheVine.mark.registry.list()                          // or TheVine.missions.registry.list()
     TheVine.luke.statistics.dashboard()                   // or TheVine.extra.statistics.dashboard()
   ══════════════════════════════════════════════════════════════════════════════ */

const TheVine = (() => {
  'use strict';

  // ── Configuration ────────────────────────────────────────────────────────
  // Replace these URLs after deploying each GAS Web App.
  // Each API supports primary / secondary / tertiary endpoints for load-balancing.

  const _config = {

    APP_ENDPOINTS: [
      'https://script.google.com/macros/s/AKfycbx2pemG039LB609OlVY-OcqLWK75qRV2ZgZNyf4Oc7dGogCR2HC4C__iWUqlG9JfYLt/exec', // PRIMARY (unified)
      '', // SECONDARY
      '', // TERTIARY
    ],

    FLOCK_ENDPOINTS: [
      'https://script.google.com/macros/s/AKfycbx2pemG039LB609OlVY-OcqLWK75qRV2ZgZNyf4Oc7dGogCR2HC4C__iWUqlG9JfYLt/exec', // PRIMARY (unified)
      '', // SECONDARY
      '', // TERTIARY
    ],

    MISSIONS_ENDPOINTS: [
      'https://script.google.com/macros/s/AKfycbx2pemG039LB609OlVY-OcqLWK75qRV2ZgZNyf4Oc7dGogCR2HC4C__iWUqlG9JfYLt/exec', // PRIMARY (unified)
      '', // SECONDARY
      '', // TERTIARY
    ],

    EXTRA_ENDPOINTS: [
      'https://script.google.com/macros/s/AKfycbx2pemG039LB609OlVY-OcqLWK75qRV2ZgZNyf4Oc7dGogCR2HC4C__iWUqlG9JfYLt/exec', // PRIMARY (unified)
      '', // SECONDARY
      '', // TERTIARY
    ],

    // Tier toggles — which endpoint tiers are active
    TIER_PRIMARY:   true,   // Default ON
    TIER_SECONDARY: false,  // Default OFF
    TIER_TERTIARY:  false,  // Default OFF
    RANDOMIZE:      false,  // Default OFF — when ON, randomly pick from enabled tiers

    // Local data mode — when set to a resolver function, routes API calls locally
    // instead of fetching from GAS endpoints. Set via TheVine.configure().
    LOCAL_RESOLVER: null,  // function(action, params) => Promise<Object>|null

    SESSION_KEY:  'flock_auth_session',
    PROFILE_KEY:  'flock_auth_profile',
    VAULT_KEY:    'flock_secure_vault',
    SESSION_TTL:  6 * 60 * 60 * 1000,  // 6 hours

    TIMEOUT_MS:   30000,
    FAILOVER_PROBE_MS: 35000,
  };

  // ── Backward-compat getters for single-URL access ────────────────────
  // These resolve to the primary endpoint so existing code works unchanged.
  Object.defineProperties(_config, {
    FLOCK_URL:    { get() { return (_config.FLOCK_ENDPOINTS    || [''])[0] || ''; }, set(v) { if (!_config.FLOCK_ENDPOINTS)    _config.FLOCK_ENDPOINTS    = ['','','']; _config.FLOCK_ENDPOINTS[0]    = v; }, enumerable: true },
    MISSIONS_URL: { get() { return (_config.MISSIONS_ENDPOINTS || [''])[0] || ''; }, set(v) { if (!_config.MISSIONS_ENDPOINTS) _config.MISSIONS_ENDPOINTS = ['','','']; _config.MISSIONS_ENDPOINTS[0] = v; }, enumerable: true },
    EXTRA_URL:    { get() { return (_config.EXTRA_ENDPOINTS    || [''])[0] || ''; }, set(v) { if (!_config.EXTRA_ENDPOINTS)    _config.EXTRA_ENDPOINTS    = ['','','']; _config.EXTRA_ENDPOINTS[0]    = v; }, enumerable: true },
  });


  // ── Endpoint resolver — picks a URL from enabled tiers ───────────────
  // key: 'FLOCK' | 'MISSIONS' | 'EXTRA' | 'APP'

  function _resolveUrl(key) {
    const eps = _config[key + '_ENDPOINTS'] || [];
    const tierEnabled = [
      _config.TIER_PRIMARY,
      _config.TIER_SECONDARY,
      _config.TIER_TERTIARY,
    ];

    // Build pool of enabled, non-empty URLs
    const pool = [];
    for (let i = 0; i < 3; i++) {
      if (tierEnabled[i] && eps[i]) pool.push(eps[i]);
    }

    if (!pool.length) {
      // Fallback: try any non-empty URL regardless of toggle
      const fallback = eps.filter(Boolean);
      return fallback[0] || '';
    }

    if (_config.RANDOMIZE && pool.length > 1) {
      return pool[Math.floor(Math.random() * pool.length)];
    }

    return pool[0]; // sequential: use first enabled
  }


  // ── Session helpers ──────────────────────────────────────────────────────

  function _getSession() {
    try {
      const raw = sessionStorage.getItem(_config.SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.token || !s.email) return null;
      if (s.expiresAt && Date.now() > s.expiresAt) {
        sessionStorage.removeItem(_config.SESSION_KEY);
        return null;
      }
      return s;
    } catch (_) { return null; }
  }

  function _saveSession(data) {
    if (!data || !data.token) return;
    data.expiresAt = data.expiresAt || (Date.now() + _config.SESSION_TTL);
    sessionStorage.setItem(_config.SESSION_KEY, JSON.stringify(data));
  }

  function _clearSession() {
    sessionStorage.removeItem(_config.SESSION_KEY);
    sessionStorage.removeItem(_config.PROFILE_KEY);
    sessionStorage.removeItem(_config.VAULT_KEY);
  }


  // ── Outgoing key normalization (camelCase → Title Case for GAS sheets) ──
  // GAS sheet headers use Title Case with spaces ("Care Type", "Member ID").
  // Frontend forms & Firestore use camelCase ("careType", "memberId").
  // This layer normalizes outgoing keys so GAS matches existing column headers
  // instead of creating duplicate camelCase columns.

  var _ACRONYMS = {
    Id:'ID', Url:'URL', Bpm:'BPM', Ccli:'CCLI', Rsvp:'RSVP',
    Zip:'ZIP', Ip:'IP', Bg:'BG', Sms:'SMS', Iso:'ISO',
    Html:'HTML', Json:'JSON', Csv:'CSV', Dm:'DM',
  };

  // Headers containing hyphens or lowercase prepositions that can't be
  // derived from a generic camelCase split.  Keyed by the all-lowercase
  // collapsed form of the camelCase field name.
  var _HEADER_OVERRIDES = {
    dateofbirth:'Date of Birth', dateofdeath:'Date of Death',
    followuprequested:'Follow-Up Requested', followupneeded:'Follow-Up Needed',
    followupdate:'Follow-Up Date', followupcompleted:'Follow-Up Completed',
    followupdone:'Follow-Up Done', followuppriority:'Follow-Up Priority',
    nextfollowup:'Next Follow-Up', nextfollowupdate:'Next Follow-Up Date',
    replytoid:'Reply-To ID', inappenabled:'In-App Enabled',
    coleaderid:'Co-Leader ID', coleadid:'Co-Lead ID',
    churchid:'churchId',
  };

  // Verbs whose params represent row data destined for sheet columns.
  var _WRITE_VERBS = { create:1, update:1, bulkCreate:1, send:1, set:1, setAll:1, post:1 };

  function _camelToTitle(key) {
    // 1. Check override map (handles hyphens, "of", etc.)
    var canonical = key.toLowerCase();
    if (_HEADER_OVERRIDES[canonical]) return _HEADER_OVERRIDES[canonical];

    // 2. Generic split on camelCase boundaries + letter→digit boundaries
    return key
      .replace(/([a-z\d])([A-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      .split(' ')
      .map(function(w, i) {
        var cap = w.charAt(0).toUpperCase() + w.slice(1);
        return _ACRONYMS[cap] || cap;
      })
      .join(' ');
  }

  function _normalizeOutgoing(params) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) return params;
    var out = {};
    var keys = Object.keys(params);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'rows' && Array.isArray(params.rows)) {
        out.rows = params.rows.map(_normalizeOutgoing);
      } else if (k === 'tab') {
        out.tab = params.tab;
      } else {
        out[_camelToTitle(k)] = params[k];
      }
    }
    return out;
  }


  // ── Core fetch engine ────────────────────────────────────────────────────

  /**
   * Authenticated action call (FLOCK / MISSIONS / EXTRA APIs).
   * Automatically injects token + email from session.
   * @param {string} baseUrl  - API endpoint URL
   * @param {string} action   - e.g. 'members.list'
   * @param {Object} [params] - action parameters (merged into query string)
   * @param {Object} [opts]   - { skipAuth, timeout, method }
   * @returns {Promise<Object>} parsed JSON response
   */
  async function _call(baseUrl, action, params, opts) {
    params = params || {};
    opts   = opts || {};

    // ── Top progress bar ───────────────────────────────────────────────
    if (window.TopBar) window.TopBar.start();

    // ── Local resolver hook — The Wellspring ───────────────────────────
    if (typeof _config.LOCAL_RESOLVER === 'function') {
      const localResult = await _config.LOCAL_RESOLVER(action, params);
      if (localResult !== undefined) { if (window.TopBar) window.TopBar.done(); return localResult; }
    }

    if (!baseUrl) throw new Error('TheVine: endpoint URL not configured for action "' + action + '"');

    // ── Normalize outgoing data keys for GAS (camelCase → Title Case) ──
    // Runs AFTER the local resolver (Firestore keeps camelCase) and
    // BEFORE auth injection (so token/authEmail/email stay lowercase).
    var _verb = action.split('.').pop();
    if (_WRITE_VERBS[_verb]) {
      params = _normalizeOutgoing(params);
    }

    // Inject auth unless explicitly skipped
    if (!opts.skipAuth) {
      const session = _getSession();
      if (session) {
        params.token     = params.token     || session.token;
        params.authEmail = params.authEmail || session.email;
        params.email     = params.email     || session.email;
      }
    }

    params.action = action;
    params._      = String(Date.now());  // cache-bust

    const usePost = (opts.method || '').toUpperCase() === 'POST';
    var fetchOpts = { cache: 'no-store' };
    var url;

    if (usePost) {
      // POST: send only lightweight keys on the URL; payload goes in the body
      var qsParams = { action: params.action, _: params._ };
      if (params.token)     qsParams.token     = params.token;
      if (params.authEmail) qsParams.authEmail = params.authEmail;
      if (params.email)     qsParams.email     = params.email;
      url = baseUrl + '?' + new URLSearchParams(qsParams).toString();
      fetchOpts.method = 'POST';
      fetchOpts.headers = { 'Content-Type': 'text/plain' };
      fetchOpts.body = JSON.stringify(params);
    } else {
      url = baseUrl + '?' + new URLSearchParams(params).toString();
      fetchOpts.method = 'GET';
    }

    const timeout = opts.timeout || _config.TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    fetchOpts.signal = controller.signal;

    try {
      const resp = await fetch(url, fetchOpts);

      if (!resp.ok) {
        throw new Error('HTTP ' + resp.status + ' from ' + action);
      }

      const data = await resp.json();

      if (data && data.error) {
        const err = new Error(data.error || data.message || 'API error');
        err.apiResponse = data;
        throw err;
      }

      return data;

    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error('The server took too long to respond. Please try again — it may be waking up.');
      }
      throw e;
    } finally {
      clearTimeout(timer);
      if (window.TopBar) window.TopBar.done();
    }
  }


  // ── APP API fetch with failover ──────────────────────────────────────────

  /**
   * Read a public content tab from the APP API.
   * Tries each endpoint in sequence until one responds.
   * @param {string} tabName - e.g. 'Books', 'Devotionals', 'Mirror'
   * @returns {Promise<Array>} array of row objects
   */
  async function _appTab(tabName) {
    if (window.TopBar) window.TopBar.start();
    try {
    // ── Local resolver hook — The Wellspring ───────────────────────────
    if (typeof _config.LOCAL_RESOLVER === 'function') {
      const localResult = await _config.LOCAL_RESOLVER('app.tab', { tab: tabName });
      if (localResult !== undefined) return localResult;
    }

    // Build tier-aware pool
    const eps = _config.APP_ENDPOINTS;
    const tierEnabled = [_config.TIER_PRIMARY, _config.TIER_SECONDARY, _config.TIER_TERTIARY];
    const pool = [];
    for (let i = 0; i < 3; i++) {
      if (tierEnabled[i] && eps[i]) pool.push(eps[i]);
    }
    // Fallback: if no tiers enabled, use any non-empty endpoint
    if (!pool.length) {
      for (let i = 0; i < eps.length; i++) { if (eps[i]) pool.push(eps[i]); }
    }
    if (!pool.length) throw new Error('TheVine: no APP API endpoints configured');

    // Shuffle for load balancing if randomize is on
    if (_config.RANDOMIZE && pool.length > 1) {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }

    let lastError = null;

    for (const ep of pool) {
      try {
        const url = ep + '?action=app.tab&tab=' + encodeURIComponent(tabName) + '&_=' + Date.now();

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), _config.TIMEOUT_MS);

        try {
          const resp = await fetch(url, { cache: 'no-store', signal: controller.signal });
          if (!resp.ok) throw new Error('HTTP ' + resp.status);

          const data = await resp.json();

          if (data && data.error) throw new Error(data.error);

          // Normalize: API may return raw array or { data: [...] }
          if (Array.isArray(data)) return data;
          if (data && Array.isArray(data.data)) return data.data;
          if (data && Array.isArray(data.rows)) return data.rows;
          return data;

        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        lastError = err;
        continue;  // try next endpoint
      }
    }

    throw lastError || new Error('TheVine: all APP API endpoints failed for tab "' + tabName + '"');
    } finally {
      if (window.TopBar) window.TopBar.done();
    }
  }


  // ── Branch factory ───────────────────────────────────────────────────────
  // Creates a namespace object where each verb becomes a callable method.
  // e.g. _branch(URL, 'events', ['list','get','create']) =>
  //   { list(p), get(p), create(p) }  each calling ?action=events.list etc.

  function _branch(urlOrFn, ns, verbs, overrides) {
    const obj = {};
    for (const verb of verbs) {
      obj[verb] = (params, opts) => {
        const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
        return _call(url, ns + '.' + verb, params, opts);
      };
    }
    if (overrides) Object.assign(obj, overrides);
    return obj;
  }

  // Shorthand for branches — lazy URL resolution for load-balancing
  function _f(ns, verbs, overrides) { return _branch(() => _resolveUrl('FLOCK'),    ns, verbs, overrides); }
  function _m(ns, verbs, overrides) { return _branch(() => _resolveUrl('MISSIONS'), ns, verbs, overrides); }
  function _x(ns, verbs, overrides) { return _branch(() => _resolveUrl('EXTRA'),    ns, verbs, overrides); }


  /* ════════════════════════════════════════════════════════════════════════
     PUBLIC API — The 4 Branches
     ════════════════════════════════════════════════════════════════════════ */

  // ┌──────────────────────────────────────────────────────────────────────┐
  // │  BRANCH 1: MATTHEW — APP API — Public Content (No Auth)             │
  // │  "Go and make disciples of all nations, teaching them..." Mat 28:19  │
  // └──────────────────────────────────────────────────────────────────────┘

  const app = {

    /** Fetch any public content tab by name.
     *  @param {string} tabName — 'Books', 'Devotionals', 'Words', etc.
     *  @returns {Promise<Array>} */
    tab: _appTab,

    // Convenience accessors for known tabs
    books:        () => _appTab('Books'),
    genealogy:    () => _appTab('Genealogy'),
    counseling:   () => _appTab('Counseling'),
    devotionals:  () => _appTab('Devotionals'),
    reading:      () => _appTab('Reading'),
    words:        () => _appTab('Words'),
    heart:        () => _appTab('Heart'),
    mirror:       () => _appTab('Mirror'),
    theology:     () => _appTab('Theology'),
    quiz:         () => _appTab('Quiz'),
    apologetics:  () => _appTab('Apologetics'),
    config:       () => _appTab('Config'),
  };


  // ┌──────────────────────────────────────────────────────────────────────┐
  // │  BRANCH 2: JOHN — FLOCK API — Church Management (Auth + RBAC)       │
  // │  "Feed my sheep." John 21:17                                         │
  // └──────────────────────────────────────────────────────────────────────┘

  const flock = {

    /** Raw action call — TheVine.flock.call('members.list', { status:'active' }) */
    call: (action, params, opts) => _call(_resolveUrl('FLOCK'), action, params, opts),

    // ── Auth ─────────────────────────────────────────────────────────────
    auth: {
      login: async (params) => {
        // POST so credentials go in the request body, not the URL query string
        const data = await _call(_resolveUrl('FLOCK'), 'auth.login', params, { skipAuth: true, method: 'POST' });
        if (data && data.ok) {
          if (data.session) _saveSession(data.session);
          else if (data.token) _saveSession(data);
        }
        return data;
      },
      profile:        (p, o) => _call(_resolveUrl('FLOCK'), 'auth.profile', p, o),
      refresh:        (p, o) => _call(_resolveUrl('FLOCK'), 'auth.refresh', p, o),
      logout: async (params) => {
        try { await _call(_resolveUrl('FLOCK'), 'auth.logout', params); } catch (_) {}
        _clearSession();
      },
      changePasscode: (p, o) => _call(_resolveUrl('FLOCK'), 'auth.changePasscode', p, o),
      profileUpdate:  (p, o) => _call(_resolveUrl('FLOCK'), 'auth.profileUpdate', p, o),
    },

    // ── Users (admin) ────────────────────────────────────────────────────
    users:         _f('users', ['list', 'create', 'update', 'deactivate', 'delete', 'resetPasscode', 'approve', 'deny', 'pending']),

    // ── Access (admin) ───────────────────────────────────────────────────
    access:        _f('access', ['list', 'set', 'remove']),

    // ── Config  ──────────────────────────────────────────────────────────
    config:        _f('config', ['list', 'get', 'set']),

    // ── Members (core) ───────────────────────────────────────────────────
    members:       _f('members', ['list', 'search', 'get', 'create', 'update', 'delete']),

    // ── Prayer Requests ──────────────────────────────────────────────────
    prayer:        _f('prayer', ['list', 'get', 'create', 'update']),

    // ── Journal ──────────────────────────────────────────────────────────
    journal:       _f('journal', ['list', 'get', 'create', 'update', 'delete']),

    // ── Contacts ─────────────────────────────────────────────────────────
    contacts:      _f('contacts', ['list', 'create', 'update']),

    // ── Pastoral Notes ───────────────────────────────────────────────────
    notes:         _f('notes', ['list', 'create', 'update']),

    // ── Milestones ───────────────────────────────────────────────────────
    milestones:    _f('milestones', ['list', 'create', 'update']),

    // ── Households ───────────────────────────────────────────────────────
    households:    _f('households', ['list', 'create', 'update']),

    // ── ToDo (Cross-Entity Task Management) ──────────────────────────────
    todo:          _f('todo', ['list', 'create', 'update', 'delete', 'archive', 'unarchive', 'complete', 'forEntity', 'myTasks', 'overdue', 'dashboard']),

    // ── Attendance ───────────────────────────────────────────────────────
    attendance:    _f('attendance', ['list', 'get', 'create', 'update', 'bulkCreate', 'summary']),

    // ── Events ───────────────────────────────────────────────────────────
    events:        _f('events', ['list', 'get', 'create', 'update', 'cancel', 'rsvp', 'rsvpList'], {
      // No auth — returns only visibility:'public' events for the public calendar
      public: (p) => _call(_resolveUrl('FLOCK'), 'events.public', p || {}, { skipAuth: true }),
    }),

    // ── Small Groups ─────────────────────────────────────────────────────
    groups:        _f('groups', ['list', 'get', 'create', 'update', 'addMember', 'removeMember', 'members']),

    // ── Giving ───────────────────────────────────────────────────────────
    giving: (() => {
      const g = _f('giving', ['list', 'create', 'update', 'summary', 'memberStatement']);
      g.pledges = _f('giving.pledges', ['list', 'create']);
      return g;
    })(),

    // ── Volunteers ───────────────────────────────────────────────────────
    volunteers:    _f('volunteers', ['list', 'schedule', 'create', 'update', 'swap']),

    // ── Communications ────────────────────────────────────────────────────
    comms: (() => {
      const c = _f('comms', ['list', 'create', 'send', 'dashboard']);
      c.messages      = _f('comms.messages', ['list', 'get', 'send', 'update', 'delete', 'inbox', 'sent']);
      c.threads       = _f('comms.threads', ['list', 'get', 'create', 'update', 'archive', 'mute', 'unmute', 'addParticipant']);
      c.notifications = _f('comms.notifications', ['list', 'unreadCount', 'markRead', 'dismiss', 'create', 'broadcast']);
      c.notifPrefs    = _f('comms.notifPrefs', ['get', 'update']);
      c.channels      = _f('comms.channels', ['list', 'get', 'create', 'update', 'delete', 'post']);
      c.templates     = _f('comms.templates', ['list', 'get', 'create', 'update', 'delete', 'use']);
      c.readReceipts  = _f('comms.readReceipts', ['create', 'forMessage']);
      c.broadcast     = _f('comms.broadcast', ['list', 'create', 'send']);
      return c;
    })(),

    // ── Firebase ─────────────────────────────────────────────────────────
    firebase:      _f('firebase', ['token']),

    // ── SMS Gateway (Twilio) ─────────────────────────────────────────────
    sms:           _f('sms', ['send']),

    // ── Check-In ─────────────────────────────────────────────────────────
    checkin:       _f('checkin', ['open', 'close', 'record', 'sessions']),

    // ── Ministries ───────────────────────────────────────────────────────
    ministries:    _f('ministries', ['list', 'get', 'create', 'update', 'tree', 'summary']),
    ministryMembers: _f('ministryMembers', ['list', 'forMember', 'add', 'update', 'remove']),

    // ── Service Planning ─────────────────────────────────────────────────
    servicePlans:  _f('servicePlans', ['list', 'get', 'create', 'update', 'duplicate']),
    serviceItems:  _f('serviceItems', ['list', 'create', 'update', 'delete', 'reorder']),
    serviceOrders: _f('serviceOrders', ['get', 'save']),

    // ── Spiritual Care ───────────────────────────────────────────────────
    care: (() => {
      const c = _f('care', ['list', 'get', 'create', 'update', 'resolve', 'dashboard']);
      c.interactions = _f('care.interactions', ['list', 'create', 'followUpDone']);
      c.followUps    = _f('care.followUps', ['due']);
      c.assignments  = _f('care.assignments', ['list', 'forMember', 'myFlock', 'create', 'end', 'reassign']);
      c.caregivers   = _f('care.caregivers', ['list']);
      return c;
    })(),

    // ── Outreach ─────────────────────────────────────────────────────────
    outreach: (() => {
      const o = { dashboard: (p, opts) => _call(_resolveUrl('FLOCK'), 'outreach.dashboard', p, opts) };
      o.contacts  = _f('outreach.contacts', ['list', 'get', 'create', 'update', 'convert']);
      o.campaigns = _f('outreach.campaigns', ['list', 'get', 'create', 'update']);
      o.followUps = _f('outreach.followUps', ['list', 'create', 'done', 'due']);
      return o;
    })(),

    // ── Sermons ──────────────────────────────────────────────────────────
    sermons:       _f('sermons', ['list', 'get', 'create', 'upload', 'update', 'submit', 'approve', 'deliver', 'delete', 'dashboard']),
    sermonSeries:  _f('sermonSeries', ['list', 'get', 'create', 'update']),
    sermonReviews: _f('sermonReviews', ['create', 'list']),
    albums:        _f('albums', ['list', 'get', 'create', 'update', 'delete']),

    // ── Compassion / Benevolence ─────────────────────────────────────────
    compassion: (() => {
      const c = { dashboard: (p, opts) => _call(_resolveUrl('FLOCK'), 'compassion.dashboard', p, opts) };
      c.requests  = _f('compassion.requests', ['list', 'get', 'create', 'update', 'approve', 'deny', 'resolve']);
      c.followUps = _f('compassion.followUps', ['due']);
      c.resources = _f('compassion.resources', ['list', 'create', 'update', 'low']);
      c.log       = _f('compassion.log', ['create', 'list', 'recent']);
      return c;
    })(),

    // ── Discipleship ─────────────────────────────────────────────────────
    discipleship: (() => {
      const d = { dashboard: (p, opts) => _call(_resolveUrl('FLOCK'), 'discipleship.dashboard', p, opts) };
      d.paths        = _f('discipleship.paths', ['list', 'get', 'create', 'update', 'publish', 'archive']);
      d.steps        = _f('discipleship.steps', ['list', 'get', 'create', 'update', 'delete', 'reorder']);
      d.enrollments  = _f('discipleship.enrollments', ['list', 'get', 'create', 'update', 'advance', 'forMember', 'complete']);
      d.mentoring    = _f('discipleship.mentoring', ['list', 'get', 'create', 'update', 'end', 'forMentor']);
      d.meetings     = _f('discipleship.meetings', ['list', 'create', 'update']);
      d.assessments  = _f('discipleship.assessments', ['list', 'get', 'create', 'update', 'forMember']);
      d.resources    = _f('discipleship.resources', ['list', 'get', 'create', 'update']);
      d.milestones   = _f('discipleship.milestones', ['list', 'forMember', 'create', 'update']);
      d.goals        = _f('discipleship.goals', ['list', 'forMember', 'create', 'update', 'complete', 'review', 'overdue']);
      d.certificates = _f('discipleship.certificates', ['list', 'forMember', 'issue', 'revoke']);
      return d;
    })(),

    // ── Learning ─────────────────────────────────────────────────────────
    learning: (() => {
      const l = { dashboard: (p, opts) => _call(_resolveUrl('FLOCK'), 'learning.dashboard', p, opts) };
      l.topics          = _f('learning.topics', ['list', 'get', 'create', 'update', 'delete', 'tree']);
      l.playlists       = _f('learning.playlists', ['list', 'get', 'create', 'update', 'delete', 'subscribe']);
      l.playlistItems   = _f('learning.playlistItems', ['list', 'create', 'update', 'delete', 'reorder']);
      l.progress        = _f('learning.progress', ['list', 'get', 'update', 'complete', 'stats']);
      l.notes           = _f('learning.notes', ['list', 'get', 'create', 'update', 'delete']);
      l.bookmarks       = _f('learning.bookmarks', ['list', 'create', 'update', 'delete']);
      l.recommendations = _f('learning.recommendations', ['list', 'create', 'dismiss', 'accept', 'generate']);
      l.quizzes         = _f('learning.quizzes', ['list', 'get', 'create', 'update', 'publish', 'delete']);
      l.quizResults     = _f('learning.quizResults', ['list', 'submit']);
      l.certificates    = _f('learning.certificates', ['list', 'forMember', 'issue', 'revoke']);
      l.sermons         = _f('learning.sermons', ['search', 'topics', 'preachers', 'scriptures']);
      return l;
    })(),

    // ── Theology ─────────────────────────────────────────────────────────
    theology: (() => {
      const t = _f('theology', ['flat', 'full', 'search', 'dashboard']);
      t.categories = _f('theology.categories', ['list', 'get', 'create', 'update', 'delete', 'reorder']);
      t.sections   = _f('theology.sections', ['list', 'get', 'create', 'update', 'delete', 'approve', 'reorder', 'forCategory']);
      t.scriptures = _f('theology.scriptures', ['list', 'create', 'update', 'delete']);
      t.revisions  = _f('theology.revisions', ['list', 'get']);
      return t;
    })(),

    // ── Member Cards ─────────────────────────────────────────────────────
    memberCards: (() => {
      const mc = _f('memberCards', [
        'list', 'get', 'byNumber', 'create', 'update', 'archive',
        'mine', 'search', 'bulkProvision', 'directory', 'dashboard',
      ]);
      // Public endpoints (no auth required)
      mc.public     = (p) => _call(_resolveUrl('FLOCK'), 'memberCards.public', p, { skipAuth: true });
      mc.publicFull = (p) => _call(_resolveUrl('FLOCK'), 'memberCards.publicFull', p, { skipAuth: true });
      mc.vcard      = (p) => _call(_resolveUrl('FLOCK'), 'memberCards.vcard', p, { skipAuth: true });
      mc.links      = _f('memberCards.links', ['list', 'create', 'update', 'delete']);
      mc.views      = _f('memberCards.views', ['list', 'mine']);
      return mc;
    })(),

    // ── Permissions ──────────────────────────────────────────────────────
    permissions: _f('permissions', ['get', 'set', 'copy', 'list', 'setAll']),

    // ── User Preferences ─────────────────────────────────────────────────
    preferences: _f('user.preferences', ['get', 'update']),

    // ── Reports ──────────────────────────────────────────────────────────
    reports:       _f('reports', ['memberGrowth', 'attendanceTrend', 'givingSummary', 'prayerOverview', 'dashboard']),

    // ── Multi-Church ─────────────────────────────────────────────────────
    church:        _f('church', ['create', 'update', 'setup', 'configs', 'list', 'delete']),

    // ── Bulk Operations ──────────────────────────────────────────────────
    bulk:          _f('bulk', ['membersImport', 'dataExport']),
  };


  // ┌──────────────────────────────────────────────────────────────────────┐
  // │  BRANCH 3: MARK — MISSIONS API — Global Missions                     │
  // │  "Go into all the world and preach the gospel." Mark 16:15           │
  // └──────────────────────────────────────────────────────────────────────┘

  const missions = {

    /** Raw action call — routes to MISSIONS (Mark) */
    call: (action, params, opts) => _call(_resolveUrl('MISSIONS'), action, params, opts),

    /** Fetch a country dossier tab by name (e.g. 'Afghanistan', 'NKorea') */
    country: (countryName) => _call(_resolveUrl('MISSIONS'), 'missions.country', { country: countryName }),

    dashboard: (p, opts) => _call(_resolveUrl('MISSIONS'), 'missions.dashboard', p, opts),

    registry:    _m('missions.registry', ['list', 'get', 'create', 'update', 'delete', '1040']),
    regions:     _m('missions.regions', ['list', 'get', 'create', 'update', 'delete', 'forCountry']),
    cities:      _m('missions.cities', ['list', 'get', 'create', 'update', 'delete', 'forCountry']),
    partners:    _m('missions.partners', ['list', 'get', 'create', 'update', 'delete']),
    prayerFocus: _m('missions.prayerFocus', ['list', 'create', 'update', 'respond', 'delete']),
    updates:     _m('missions.updates', ['list', 'get', 'create', 'update', 'publish', 'delete']),
    teams:       _m('missions.teams', ['list', 'get', 'create', 'update', 'delete']),
    metrics:     _m('missions.metrics', ['list', 'create', 'update', 'compare']),
  };


  // ┌──────────────────────────────────────────────────────────────────────┐
  // │  BRANCH 4: LUKE — EXTRA API — Statistics, Analytics & Future Slots  │
  // │  "I myself have carefully investigated everything." Luke 1:3         │
  // └──────────────────────────────────────────────────────────────────────┘

  const extra = {

    /** Raw action call — routes to EXTRA (Luke) */
    call: (action, params, opts) => _call(_resolveUrl('EXTRA'), action, params, opts),

    statistics: (() => {
      const s = _x('statistics', ['compute', 'dashboard', 'trends', 'export']);
      s.config = _x('statistics.config', ['list', 'get', 'create', 'update', 'delete']);
      s.snapshots = _x('statistics.snapshots', ['list', 'get', 'create', 'delete', 'latest']);
      s.views = _x('statistics.views', ['list', 'get', 'create', 'update', 'delete']);
      return s;
    })(),
  };


  // ┌──────────────────────────────────────────────────────────────────────┐
  // │  UTILITIES                                                           │
  // └──────────────────────────────────────────────────────────────────────┘

  /**
   * Check if user is currently logged in.
   * @returns {FlockSession|null}
   */
  function session() {
    return _getSession();
  }

  /**
   * Check if user has a specific minimum role level.
   * @param {string} requiredRole — 'readonly','volunteer','care','leader','pastor','admin'
   * @returns {boolean}
   */
  function hasRole(requiredRole) {
    const levels = { readonly: 0, volunteer: 1, care: 2, leader: 3, pastor: 4, admin: 5 };
    const s = _getSession();
    if (!s || !s.role) return false;
    const userLevel = levels[String(s.role).toLowerCase()] ?? -1;
    const reqLevel  = levels[String(requiredRole).toLowerCase()] ?? 99;
    return userLevel >= reqLevel;
  }

  /**
   * Health check on any API.
   * Parses the JSON response and verifies data.ok === true.
   * GAS always returns HTTP 200, so we must check the payload.
   * @param {'app'|'flock'|'missions'|'extra'} branch
   * @returns {Promise<Object|false>} health response object or false
   */
  async function health(branch) {
    // Accept Gospel names as well as API aliases
    const _aliases = { matthew: 'app', john: 'flock', mark: 'missions', luke: 'extra' };
    branch = _aliases[branch] || branch;
    try {
      let url;
      if (branch === 'app') {
        const ep = _config.APP_ENDPOINTS.find(Boolean);
        if (!ep) return false;
        url = ep + '?action=health&_=' + Date.now();
      } else {
        const map = { flock: _config.FLOCK_URL, missions: _config.MISSIONS_URL, extra: _config.EXTRA_URL };
        if (!map[branch]) return false;
        url = map[branch] + '?action=health&_=' + Date.now();
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), _config.FAILOVER_PROBE_MS);
      try {
        const resp = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!resp.ok) return false;
        const data = await resp.json();
        return (data && data.ok === true) ? data : false;
      } finally {
        clearTimeout(timer);
      }
    } catch (_) {
      return false;
    }
  }

  /**
   * Update configuration at runtime (e.g. after loading from a config endpoint).
   * @param {Object} overrides — keys matching _config properties
   */
  function configure(overrides) {
    if (!overrides || typeof overrides !== 'object') return;
    // Support simplified DATABASE_URL → populate all four endpoint arrays
    if (overrides.DATABASE_URL) {
      var u = overrides.DATABASE_URL;
      _config.FLOCK_ENDPOINTS    = [u, '', ''];
      _config.APP_ENDPOINTS      = [u, '', ''];
      _config.MISSIONS_ENDPOINTS = [u, '', ''];
      _config.EXTRA_ENDPOINTS    = [u, '', ''];
    }
    for (const key of Object.keys(overrides)) {
      if (key === 'DATABASE_URL') continue; // already handled above
      if (Object.prototype.hasOwnProperty.call(_config, key)) {
        _config[key] = overrides[key];
      }
    }
  }

  /** Check if local data mode is active. */
  function isLocal() { return typeof _config.LOCAL_RESOLVER === 'function'; }

  /** Return a copy of the current endpoint URLs and tier settings (read-only). */
  function endpoints() {
    return {
      APP_ENDPOINTS:      _config.APP_ENDPOINTS.slice(),
      FLOCK_ENDPOINTS:    _config.FLOCK_ENDPOINTS.slice(),
      MISSIONS_ENDPOINTS: _config.MISSIONS_ENDPOINTS.slice(),
      EXTRA_ENDPOINTS:    _config.EXTRA_ENDPOINTS.slice(),
      TIER_PRIMARY:       _config.TIER_PRIMARY,
      TIER_SECONDARY:     _config.TIER_SECONDARY,
      TIER_TERTIARY:      _config.TIER_TERTIARY,
      RANDOMIZE:          _config.RANDOMIZE,
      // Backward compat aliases
      FLOCK_URL:    _config.FLOCK_ENDPOINTS[0] || '',
      MISSIONS_URL: _config.MISSIONS_ENDPOINTS[0] || '',
      EXTRA_URL:    _config.EXTRA_ENDPOINTS[0] || '',
    };
  }


  // ┌──────────────────────────────────────────────────────────────────────┐
  // │  VINE MANIFEST — Identity, Metadata & Live Diagnostics              │
  // └──────────────────────────────────────────────────────────────────────┘

  /**
   * The Vine manifest — describes the system, its four Gospel-named branches,
   * and provides live health diagnostics for the admin dashboard.
   *
   * "I am the vine; you are the branches. If you remain in me and I in you,
   *  you will bear much fruit; apart from me you can do nothing." — John 15:5
   */
  const manifest = Object.freeze({

    name: 'The Vine',
    version: '1.0.0',
    product: 'FlockOS',
    scripture: {
      text: 'I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit; apart from me you can do nothing.',
      reference: 'John 15:5',
      context: 'Jesus declares Himself the source of all life and fruitfulness. Every operation in FlockOS flows through The Vine — a centralized API client where all four branches draw from one root. Just as the branches cannot bear fruit apart from the vine, no page in FlockOS functions apart from this single connection layer.',
    },

    branches: Object.freeze([

      Object.freeze({
        gospel:      'Matthew',
        alias:       'app',
        api:         'APP API',
        role:        'Public Content — Teaching & Instruction',
        auth:        false,
        description: 'Matthew is the Gospel of teaching. It contains the Sermon on the Mount, the Great Commission, and more recorded discourse from Jesus than any other Gospel. Matthew organized his account to instruct — presenting Jesus as the authoritative Teacher and promised Messiah. This branch serves all public, read-only content: scripture encyclopedias, devotionals, lexicon data, counseling wisdom, theology, quizzes, and apologetics. No login required — the teaching is freely given to all.',
        scripture: {
          text:      'Therefore go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit, and teaching them to obey everything I have commanded you.',
          reference: 'Matthew 28:19–20',
        },
        endpoint: () => _config.APP_ENDPOINTS.find(Boolean) || '(not configured)',
        failover: () => _config.APP_ENDPOINTS.filter(Boolean).length,
        tabs: 12,
      }),

      Object.freeze({
        gospel:      'John',
        alias:       'flock',
        api:         'FLOCK API',
        role:        'Church Management — Shepherding the Flock',
        auth:        true,
        description: 'John is the pastoral Gospel. It records Jesus washing feet, comforting His disciples, praying for unity, and three times charging Peter: "Feed my sheep." John reveals the intimate, relational heart of Jesus — the Good Shepherd who knows His sheep by name. This branch manages the entire church body: member records, prayer requests, pastoral notes, households, attendance, events, small groups, giving, volunteering, communications, spiritual care, outreach, discipleship, learning, sermons, photos, member cards, and administration. Every operation requires authentication and respects role-based access — because shepherding demands accountability.',
        scripture: {
          text:      'Jesus said, "Feed my sheep."',
          reference: 'John 21:17',
        },
        supportingScriptures: [
          { text: 'I am the good shepherd. The good shepherd lays down his life for the sheep.', reference: 'John 10:11' },
          { text: 'I am the good shepherd; I know my sheep and my sheep know me.', reference: 'John 10:14' },
          { text: 'My sheep listen to my voice; I know them, and they follow me.', reference: 'John 10:27' },
        ],
        endpoint: () => _config.FLOCK_URL || '(not configured)',
        tabs: 79,
      }),

      Object.freeze({
        gospel:      'Mark',
        alias:       'missions',
        api:         'MISSIONS API',
        role:        'Global Missions — Going to the Nations',
        auth:        true,
        description: 'Mark is the Gospel of action. It is the shortest, fastest-paced account — written with urgency, using the word "immediately" over forty times. Mark presents Jesus as the suffering Servant who came not to be served but to serve, and who sends His followers out with the same urgency. This branch powers the global missions module: country dossiers for 48 persecuted nations, regional intelligence, city-level data, missionary partners, prayer focus rotations, field updates, mission teams, and persecution metrics. The data here fuels the church\'s mandate to go.',
        scripture: {
          text:      'He said to them, "Go into all the world and preach the gospel to all creation."',
          reference: 'Mark 16:15',
        },
        supportingScriptures: [
          { text: 'For even the Son of Man did not come to be served, but to serve, and to give his life as a ransom for many.', reference: 'Mark 10:45' },
          { text: 'And the gospel must first be preached to all nations.', reference: 'Mark 13:10' },
        ],
        endpoint: () => _config.MISSIONS_URL || '(not configured)',
        tabs: { structured: 8, countries: 48, total: 56 },
      }),

      Object.freeze({
        gospel:      'Luke',
        alias:       'extra',
        api:         'EXTRA API',
        role:        'Statistics, Analytics & Future Data',
        auth:        true,
        description: 'Luke is the Gospel of careful investigation. A physician and historian, Luke opens his account by declaring that he "carefully investigated everything from the beginning" so that Theophilus could "know the certainty" of what he had been taught. Luke\'s precision, his emphasis on evidence and documentation, and his attention to dates, rulers, and census data make him the natural patron of this branch. It houses the statistics engine — metric definitions, computed snapshots, trend analysis, custom dashboard views, and data exports — along with fifty reserved slots for future features. When the church needs to measure, analyze, and plan with certainty, it draws from Luke.',
        scripture: {
          text:      'I myself have carefully investigated everything from the beginning, I too decided to write an orderly account for you, most excellent Theophilus, so that you may know the certainty of the things you have been taught.',
          reference: 'Luke 1:3–4',
        },
        supportingScriptures: [
          { text: 'Suppose one of you wants to build a tower. Won\'t you first sit down and estimate the cost to see whether you have enough money to complete it?', reference: 'Luke 14:28' },
        ],
        endpoint: () => _config.EXTRA_URL || '(not configured)',
        tabs: { statistics: 3, futureSlots: 50, total: 53 },
      }),

    ]),

    /**
     * Live diagnostics — pings all 4 branches and returns status + health details.
     * health() now returns the full JSON payload (or false), so diagnostics
     * can surface message, version, tab counts, and module lists.
     * @returns {Promise<Object>} { vine, branches: [{ gospel, api, status, latencyMs, details }] }
     */
    diagnostics: async () => {
      const results = [];

      for (const branch of manifest.branches) {
        const key = branch.alias;
        const start = performance.now();
        let result = false;
        try {
          result = await health(key);
        } catch (_) {}
        const latencyMs = Math.round(performance.now() - start);

        results.push({
          gospel:      branch.gospel,
          alias:       branch.alias,
          api:         branch.api,
          role:        branch.role,
          auth:        branch.auth,
          endpoint:    branch.endpoint(),
          status:      result ? 'online' : 'offline',
          latencyMs,
          scripture:   branch.scripture.reference,
          details:     result || null,
        });
      }

      return {
        vine: manifest.scripture.reference,
        product: manifest.product,
        version: manifest.version,
        checkedAt: new Date().toISOString(),
        branches: results,
      };
    },
  });


  /* ════════════════════════════════════════════════════════════════════════
     THE ROOT SYSTEM — Data Layer, Cache & Page Wiring

     "Blessed is the one who trusts in the LORD…
      They will be like a tree planted by the water
      that sends out its roots by the stream." — Jeremiah 17:7–8

     Every page in FlockOS connects to The Vine through its Root System.
     Data flows in, is cached in memory, refreshes in the background,
     and ripples out to every component that subscribes.

     ▸ grove()      – declare what data a page needs; it auto-loads
     ▸ cache        – in-memory store with TTL, stale-while-revalidate
     ▸ on/off/emit  – lightweight pub/sub for data-change events
     ▸ lifecycle    – auto-wires visibility, online/offline, session
     ════════════════════════════════════════════════════════════════════════ */


  // ── Event Bus ────────────────────────────────────────────────────────────
  // Lightweight pub/sub so any UI component can subscribe to data changes.
  // TheVine.on('members:fresh', (data) => renderTable(data))

  const _listeners = {};

  function on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
    return () => off(event, fn); // returns unsubscribe function
  }

  function off(event, fn) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(f => f !== fn);
  }

  function emit(event, data) {
    if (!_listeners[event]) return;
    for (const fn of _listeners[event]) {
      try { fn(data); } catch (e) { console.error('[Vine:emit] ' + event, e); }
    }
  }


  // ── Cache Store ──────────────────────────────────────────────────────────
  // In-memory cache with per-key TTL and stale-while-revalidate support.
  //   TheVine.cache.get('members')
  //   TheVine.cache.set('members', data, { ttl: 120000 })

  const _cache = {};

  const _CACHE_DEFAULTS = {
    ttl:       5 * 60 * 1000,   // 5 minutes default
    staleTTL:  15 * 60 * 1000,  // serve stale up to 15 min while revalidating
  };

  const cache = {

    /** Get cached value. Returns data or null.
     *  If stale but within staleTTL, returns stale data AND triggers background refresh. */
    get(key) {
      const entry = _cache[key];
      if (!entry) return null;
      const age = Date.now() - entry.storedAt;
      if (age < entry.ttl) return entry.data;                    // fresh
      if (age < entry.staleTTL) {                                // stale but servable
        if (entry.revalidator && !entry.revalidating) {
          entry.revalidating = true;
          entry.revalidator()
            .then(fresh => { cache.set(key, fresh, entry.opts); emit(key + ':fresh', fresh); })
            .catch(() => {})
            .finally(() => { entry.revalidating = false; });
        }
        return entry.data;                                       // return stale while revalidating
      }
      delete _cache[key];                                        // expired — evict
      return null;
    },

    /** Store a value with optional TTL and revalidator function. */
    set(key, data, opts) {
      opts = opts || {};
      _cache[key] = {
        data,
        storedAt:      Date.now(),
        ttl:           opts.ttl      || _CACHE_DEFAULTS.ttl,
        staleTTL:      opts.staleTTL || _CACHE_DEFAULTS.staleTTL,
        revalidator:   opts.revalidator || null,
        revalidating:  false,
        opts,
      };
      emit(key + ':cached', data);
    },

    /** Check if a fresh (non-stale) entry exists. */
    has(key) {
      const entry = _cache[key];
      return !!entry && (Date.now() - entry.storedAt) < entry.ttl;
    },

    /** Remove a specific key or clear everything. */
    invalidate(key) {
      if (key) { delete _cache[key]; emit(key + ':invalidated'); }
      else { for (const k of Object.keys(_cache)) delete _cache[k]; emit('cache:cleared'); }
    },

    /** Cache stats for diagnostics / admin dashboard. */
    stats() {
      const now = Date.now();
      const keys = Object.keys(_cache);
      return {
        entries: keys.length,
        fresh: keys.filter(k => (now - _cache[k].storedAt) < _cache[k].ttl).length,
        stale: keys.filter(k => {
          const age = now - _cache[k].storedAt;
          return age >= _cache[k].ttl && age < _cache[k].staleTTL;
        }).length,
        keys,
      };
    },
  };


  // ── Fetch + Cache helper ─────────────────────────────────────────────────
  // Wraps any async fetcher with automatic cache read/write/revalidate.
  //   const data = await TheVine.nurture('members', () => TheVine.flock.members.list(), { ttl: 60000 })

  async function nurture(key, fetcher, opts) {
    opts = opts || {};

    // 1. Check cache first
    const cached = cache.get(key);
    if (cached !== null && !opts.force) return cached;

    // 2. Fetch fresh data
    emit(key + ':loading');
    try {
      const data = await fetcher();
      cache.set(key, data, { ...opts, revalidator: fetcher });
      emit(key + ':fresh', data);
      return data;
    } catch (err) {
      emit(key + ':error', err);
      // Return stale data as fallback if available
      const entry = _cache[key];
      if (entry) return entry.data;
      throw err;
    }
  }


  // ── Groves — Page Data Bundles ───────────────────────────────────────────
  // A "grove" declares all the data a page needs. When the page loads,
  // the grove hydrates everything in parallel, wires up refresh intervals,
  // and gives you a single object with all your data + a teardown function.
  //
  //   const page = await TheVine.grove('pastoral-dashboard', {
  //     members:  { fetch: () => TheVine.flock.members.list({ status: 'active' }), ttl: 120000 },
  //     prayer:   { fetch: () => TheVine.flock.prayer.list({ status: 'New' }),      ttl: 60000  },
  //     todo:     { fetch: () => TheVine.flock.todo.list({ status: 'Open' }),        ttl: 60000  },
  //   });
  //
  //   page.data.members    // already loaded
  //   page.data.prayer     // already loaded
  //   page.refresh('prayer')  // manual re-fetch of one key
  //   page.refreshAll()       // re-fetch everything
  //   page.teardown()         // stop all intervals, remove listeners

  const _groves = {};

  async function grove(name, spec) {
    // Tear down any previous grove with the same name
    if (_groves[name]) _groves[name].teardown();

    const data       = {};
    const intervals  = [];
    const unsubs     = [];
    const keys       = Object.keys(spec);

    // Hydrate all keys in parallel
    const settled = await Promise.allSettled(
      keys.map(async key => {
        const s     = spec[key];
        const ttl   = s.ttl || _CACHE_DEFAULTS.ttl;
        const fresh = await nurture(name + ':' + key, s.fetch, { ttl, staleTTL: s.staleTTL });
        data[key]   = fresh;

        // Auto-refresh interval (if requested)
        if (s.refresh) {
          const ms = typeof s.refresh === 'number' ? s.refresh : ttl;
          const id = setInterval(() => {
            nurture(name + ':' + key, s.fetch, { ttl, staleTTL: s.staleTTL, force: true })
              .then(d => { data[key] = d; })
              .catch(() => {});
          }, ms);
          intervals.push(id);
        }

        // Subscribe to fresh events so data object stays current
        const unsub = on(name + ':' + key + ':fresh', d => { data[key] = d; });
        unsubs.push(unsub);
      })
    );

    // Log any failures but don't block the page
    for (let i = 0; i < settled.length; i++) {
      if (settled[i].status === 'rejected') {
        console.warn('[Vine:grove] ' + name + '.' + keys[i] + ' failed:', settled[i].reason);
      }
    }

    const handle = {
      name,
      data,
      spec,

      /** Re-fetch a single key */
      async refresh(key) {
        if (!spec[key]) return;
        const s   = spec[key];
        const ttl = s.ttl || _CACHE_DEFAULTS.ttl;
        data[key] = await nurture(name + ':' + key, s.fetch, { ttl, staleTTL: s.staleTTL, force: true });
        emit(name + ':refreshed', { key, data: data[key] });
        return data[key];
      },

      /** Re-fetch all keys in parallel */
      async refreshAll() {
        await Promise.allSettled(keys.map(k => handle.refresh(k)));
        emit(name + ':refreshed:all', data);
        return data;
      },

      /** Stop intervals, remove listeners, free memory */
      teardown() {
        for (const id of intervals) clearInterval(id);
        for (const unsub of unsubs) unsub();
        intervals.length = 0;
        unsubs.length = 0;
        for (const k of keys) cache.invalidate(name + ':' + k);
        delete _groves[name];
        emit(name + ':teardown');
      },
    };

    _groves[name] = handle;
    emit(name + ':ready', data);
    return handle;
  }


  // ── Pre-built Grove Templates ────────────────────────────────────────────
  // Common page data bundles — call TheVine.groves.pastoral() and you're wired.

  const groves = {

    /** Pastoral dashboard — members, prayer, contacts, todo, notes */
    pastoral: (opts) => grove('pastoral', {
      members:  { fetch: () => flock.members.list({ status: 'active', ...(opts||{}) }), ttl: 120000, refresh: 120000 },
      prayer:   { fetch: () => flock.prayer.list({ status: 'New' }),                    ttl: 60000,  refresh: 60000 },
      contacts: { fetch: () => flock.contacts.list(),                                   ttl: 120000 },
      todo:     { fetch: () => flock.todo.list({ status: 'Not Started' }),               ttl: 60000,  refresh: 60000 },
      notes:    { fetch: () => flock.notes.list(),                                      ttl: 120000 },
    }),

    /** Public content page — devotionals + reading plan for today */
    bread: () => grove('bread', {
      devotionals: { fetch: () => app.devotionals(), ttl: 300000 },
      reading:     { fetch: () => app.reading(),     ttl: 300000 },
    }),

    /** Bible explorer — books, characters, words */
    explorer: () => grove('explorer', {
      books:     { fetch: () => app.books(),     ttl: 600000 },
      genealogy: { fetch: () => app.genealogy(), ttl: 600000 },
      words:     { fetch: () => app.words(),     ttl: 600000 },
    }),

    /** Missions overview — registry, prayer focus, updates */
    missions: () => grove('missions', {
      registry:    { fetch: () => missions.registry.list(), ttl: 300000 },
      prayerFocus: { fetch: () => missions.prayerFocus.list({ status: 'Active' }), ttl: 120000, refresh: 120000 },
      updates:     { fetch: () => missions.updates.list({ published: 'TRUE' }),     ttl: 120000, refresh: 120000 },
    }),

    /** Discipleship hub — paths, enrollments, mentoring */
    discipleship: () => grove('discipleship', {
      paths:       { fetch: () => flock.discipleship.paths.list({ status: 'Published' }), ttl: 300000 },
      enrollments: { fetch: () => flock.discipleship.enrollments.list(),                  ttl: 120000, refresh: 120000 },
      mentoring:   { fetch: () => flock.discipleship.mentoring.list({ status: 'Active' }),ttl: 120000 },
    }),

    /** Giving dashboard — summary, pledges */
    giving: () => grove('giving', {
      summary: { fetch: () => flock.giving.summary(),  ttl: 120000, refresh: 120000 },
      pledges: { fetch: () => flock.giving.pledges.list(), ttl: 300000 },
    }),

    /** Communications hub — threads, unread count, channels */
    comms: () => grove('comms', {
      threads:   { fetch: () => flock.comms.threads.list(),              ttl: 30000, refresh: 30000 },
      unread:    { fetch: () => flock.comms.notifications.unreadCount(), ttl: 15000, refresh: 15000 },
      channels:  { fetch: () => flock.comms.channels.list(),             ttl: 120000 },
    }),

    /** Learning center — topics, playlists, user progress */
    learning: () => grove('learning', {
      topics:    { fetch: () => flock.learning.topics.list(),    ttl: 300000 },
      playlists: { fetch: () => flock.learning.playlists.list(), ttl: 120000 },
      progress:  { fetch: () => flock.learning.progress.list(),  ttl: 60000, refresh: 60000 },
    }),

    /** Admin / statistics dashboard */
    admin: () => grove('admin', {
      stats:      { fetch: () => extra.statistics.dashboard(),  ttl: 60000, refresh: 60000 },
      members:    { fetch: () => flock.members.list(),          ttl: 120000 },
      attendance: { fetch: () => flock.attendance.summary(),    ttl: 120000 },
      reports:    { fetch: () => flock.reports.dashboard(),     ttl: 120000 },
    }),

    /** Theology reference — categories, sections */
    theology: () => grove('theology', {
      categories: { fetch: () => flock.theology.categories.list(), ttl: 600000 },
      full:       { fetch: () => flock.theology.full(),            ttl: 600000 },
    }),

    /** Heart/Mirror diagnostic tools */
    diagnostic: () => grove('diagnostic', {
      heart:  { fetch: () => app.heart(),  ttl: 600000 },
      mirror: { fetch: () => app.mirror(), ttl: 600000 },
    }),

    /** Spiritual care dashboard */
    care: () => grove('care', {
      cases:     { fetch: () => flock.care.list({ status: 'Active' }), ttl: 60000, refresh: 60000 },
      followUps: { fetch: () => flock.care.followUps.due(),            ttl: 60000, refresh: 60000 },
      dashboard: { fetch: () => flock.care.dashboard(),                ttl: 120000 },
    }),

    /** Cross-entity task dashboard */
    tasks: (opts) => grove('tasks', {
      myTasks:  { fetch: () => flock.todo.myTasks(opts || {}),                        ttl: 30000, refresh: 30000 },
      overdue:  { fetch: () => flock.todo.overdue(),                                  ttl: 60000, refresh: 60000 },
      all:      { fetch: () => flock.todo.list({ status: 'Not Started', ...(opts||{}) }), ttl: 60000, refresh: 60000 },
      dashboard:{ fetch: () => flock.todo.dashboard(),                                ttl: 120000 },
    }),
  };


  // ── Page Lifecycle ───────────────────────────────────────────────────────
  // Auto-wires browser events so data stays warm without manual wiring:
  //  - Visibility change: pause/resume refresh when tab hidden/visible
  //  - Online/offline: retry failed fetches when reconnected
  //  - Session change: clear stale auth data on login/logout
  //  - Unload: tear down groves cleanly

  const lifecycle = {

    _started: false,
    _paused:  false,

    /** Call once in main.js or page init. Wires all automatic behaviors. */
    start() {
      if (lifecycle._started) return;
      lifecycle._started = true;

      // Pause background refreshes when tab is hidden
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          lifecycle._paused = true;
          emit('lifecycle:paused');
        } else {
          lifecycle._paused = false;
          emit('lifecycle:resumed');
          // Refresh all active groves when user returns
          for (const g of Object.values(_groves)) {
            g.refreshAll().catch(() => {});
          }
        }
      });

      // When coming back online, refresh everything
      window.addEventListener('online', () => {
        emit('lifecycle:online');
        for (const g of Object.values(_groves)) {
          g.refreshAll().catch(() => {});
        }
      });

      window.addEventListener('offline', () => {
        emit('lifecycle:offline');
      });

      // Clean teardown on page unload
      window.addEventListener('beforeunload', () => {
        for (const g of Object.values(_groves)) g.teardown();
      });

      emit('lifecycle:started');
    },

    /** True when the browser tab is hidden (background refreshes should be paused). */
    get paused() { return lifecycle._paused; },

    /** List all active groves. */
    get activeGroves() { return Object.keys(_groves); },
  };


  // ┌──────────────────────────────────────────────────────────────────────┐
  // │  PUBLIC SURFACE                                                      │
  // └──────────────────────────────────────────────────────────────────────┘

  return Object.freeze({
    // Functional names
    app,
    flock,
    missions,
    extra,

    // Gospel names (aliases)
    matthew:  app,        // Public content — teaching & instruction
    john:     flock,      // Church management — shepherding the flock
    mark:     missions,   // Global missions — going to the nations
    luke:     extra,      // Statistics & analytics — careful investigation

    // Identity & diagnostics
    manifest,

    // Data layer — The Root System
    cache,                // In-memory cache with TTL + stale-while-revalidate
    nurture,              // fetch + cache wrapper: nurture('key', fetcher, { ttl })
    grove,                // Page data bundle: grove('name', { key: { fetch, ttl } })
    groves,               // Pre-built grove templates (pastoral, bread, explorer, etc.)
    lifecycle,            // Auto-wire visibility, online/offline, session

    // Event bus
    on,                   // Subscribe:   TheVine.on('members:fresh', fn)
    off,                  // Unsubscribe: TheVine.off('members:fresh', fn)
    emit,                 // Publish:     TheVine.emit('custom:event', data)

    // Utilities
    session,
    hasRole,
    health,
    configure,
    endpoints,
    isLocal,
  });

})();
