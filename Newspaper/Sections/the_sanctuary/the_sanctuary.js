// the_sanctuary.js — Section 3: The Sanctuary
// Absorbs: app.feed (Sermon Builder) + app.stand (Song Planner) + app.flockshow (Service Order)
// Auth: leader (3) — enforced by inline auth guard in index.html
// Data: sermons / songs / servicePlans — Firestore → GAS → localStorage

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════
     CONSTANTS
  ═══════════════════════════════════════════════════════════════════════ */

  const LS_SERMONS  = 'sanc_sermons_v1';
  const LS_SONGS    = 'sanc_songs_v1';
  const LS_PLANS    = 'sanc_plans_v1';

  const SECTION_TYPES = ['intro', 'scripture', 'point', 'illustration', 'explanation', 'application', 'prayer', 'conclusion', 'transition'];
  const SECTION_DEFAULTS = { intro: 'Introduction', scripture: 'Scripture Reading', point: 'Main Point', illustration: 'Illustration', explanation: 'Explanation', application: 'Application', prayer: 'Prayer', conclusion: 'Conclusion', transition: 'Transition' };

  const STATUS_CYCLE  = ['draft', 'ready', 'preached'];
  const STATUS_LABELS = { draft: 'Draft', ready: 'Ready', preached: 'Preached' };
  const STATUS_ICONS  = { draft: '✏️', ready: '✅', preached: '📖' };

  const RUN_TYPES = [
    { value: 'worship',    label: 'Worship',    icon: '🎵' },
    { value: 'prayer',     label: 'Prayer',     icon: '🙏' },
    { value: 'sermon',     label: 'Sermon',     icon: '📖' },
    { value: 'offering',   label: 'Offering',   icon: '🙌' },
    { value: 'communion',  label: 'Communion',  icon: '✝️' },
    { value: 'welcome',    label: 'Welcome',    icon: '👋' },
    { value: 'announcements', label: 'Announcements', icon: '📣' },
    { value: 'other',      label: 'Other',      icon: '•'  },
  ];

  const SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const FLATS  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

  // 20 starter songs for when Firestore is empty
  const STARTER_SONGS = [
    { title: 'How Great Thou Art',      artist: 'Stuart K. Hine',     key: 'G',  ccli: '14181' },
    { title: 'Amazing Grace',           artist: 'John Newton',         key: 'G',  ccli: '22025' },
    { title: 'Great Is Thy Faithfulness', artist: 'Thomas Chisholm', key: 'Eb', ccli: '18723' },
    { title: 'Holy, Holy, Holy',        artist: 'Reginald Heber',     key: 'D',  ccli: '31076' },
    { title: 'A Mighty Fortress',       artist: 'Martin Luther',      key: 'D',  ccli: '42964' },
    { title: 'It Is Well With My Soul', artist: 'Horatio Spafford',   key: 'Ab', ccli: '25376' },
    { title: 'To God Be the Glory',     artist: 'Fanny Crosby',       key: 'G',  ccli: '40430' },
    { title: 'Blessed Assurance',       artist: 'Fanny Crosby',       key: 'D',  ccli: '22324' },
    { title: 'Be Thou My Vision',       artist: 'Eleanor Hull',       key: 'D',  ccli: '30639' },
    { title: 'Here I Am to Worship',    artist: 'Tim Hughes',         key: 'E',  ccli: '3266032' },
    { title: 'What a Beautiful Name',   artist: 'Hillsong Worship',   key: 'D',  ccli: '7068424' },
    { title: 'Good Good Father',        artist: 'Chris Tomlin',       key: 'G',  ccli: '7036612' },
    { title: '10,000 Reasons',          artist: 'Matt Redman',        key: 'G',  ccli: '6016351' },
    { title: 'Build My Life',           artist: 'Pat Barrett',        key: 'E',  ccli: '7070345' },
    { title: 'Way Maker',               artist: 'Sinach',             key: 'B',  ccli: '7115744' },
    { title: 'Cornerstone',             artist: 'Hillsong Worship',   key: 'G',  ccli: '6158927' },
    { title: 'Oceans',                  artist: 'Hillsong United',    key: 'D',  ccli: '6428767' },
    { title: 'In Christ Alone',         artist: 'Stuart Townend',     key: 'D',  ccli: '3350395' },
    { title: 'How Deep the Father\'s Love', artist: 'Stuart Townend', key: 'G',  ccli: '1558277' },
    { title: 'The Lion and the Lamb',   artist: 'Leeland',            key: 'G',  ccli: '7050078' },
  ].map((s, i) => ({ ...s, id: 'starter_' + i, bpm: 0, notes: '', chords: '' }));

  /* ═══════════════════════════════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════════════════════════════ */

  const S = {
    // Sermon Builder
    sermons:        [],
    sermonSearch:   '',
    sermonFilter:   'all',   // 'all'|'draft'|'ready'|'preached'
    activeSermonId: null,

    // Song Planner
    songs:       [],
    songSearch:  '',
    songTab:     'library', // 'library'|'setlist'
    setList:     [],         // [{ songId, title, artist, key, semitones }]

    // Service Order
    runsheet:     [],        // [{ id, type, title, duration }]
    serviceDate:  '',

    // Shared plan id (ties setList + runsheet together)
    planId:       null,

    // Collapse state
    panelCollapsed: { sermons: false, songs: false, order: false },
  };

  /* ═══════════════════════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════════════════════ */

  const _e   = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const _uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  const _qs  = id => document.getElementById(id);
  const _now = () => Date.now();

  function _showAuthOverlay() {
    const overlay = _qs('sanc-auth-overlay');
    const grid = _qs('the-sanctuary-grid');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
    }
    if (grid) grid.classList.add('sanctuary-auth-blocked');
  }

  function _hideAuthOverlay() {
    const overlay = _qs('sanc-auth-overlay');
    const grid = _qs('the-sanctuary-grid');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (grid) grid.classList.remove('sanctuary-auth-blocked');
  }

  function _setAuthError(message) {
    const errorEl = _qs('sanc-auth-error');
    if (errorEl) {
      errorEl.textContent = message || '';
    }
  }

  function _isAuthenticated() {
    return window.Nehemiah && typeof window.Nehemiah.isAuthenticated === 'function' && window.Nehemiah.isAuthenticated();
  }

  function _hasLeaderAccess() {
    return window.Nehemiah && typeof window.Nehemiah.hasRole === 'function' && window.Nehemiah.hasRole('leader');
  }

  async function _ensureAuthenticated() {
    if (_isAuthenticated() && _hasLeaderAccess()) {
      _hideAuthOverlay();
      return true;
    }

    _showAuthOverlay();
    if (_isAuthenticated() && !window.Nehemiah.hasRole('leader')) {
      _setAuthError('Current account does not have leader access. Please sign in with a leader account.');
    }

    const form = _qs('sanc-auth-form');
    const emailInput = _qs('sanc-auth-email');
    const passInput = _qs('sanc-auth-pass');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

    if (!form || !emailInput || !passInput || !submitBtn) {
      _setAuthError('Authentication is unavailable.');
      return false;
    }

    return new Promise(resolve => {
      form.addEventListener('submit', async function onSubmit(event) {
        event.preventDefault();
        _setAuthError('');

        const email = String(emailInput.value || '').trim();
        const passcode = String(passInput.value || '');
        if (!email || !passcode) {
          _setAuthError('Please enter your email and passcode.');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in…';

        if (!window.Nehemiah || typeof window.Nehemiah.login !== 'function') {
          _setAuthError('Auth system is not ready yet. Refresh and try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
          return;
        }

        try {
          await window.Nehemiah.login(email, passcode);
          if (!_hasLeaderAccess()) {
            _setAuthError('Leader access required. Please sign in with a leader account.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
            return;
          }
          if (window.FlockGates && typeof window.FlockGates.rebuildNavBar === 'function') {
            window._HERALD_SANCTUARY_LOGIN_REQUIRED = false;
            window.FlockGates.rebuildNavBar();
          }
          _hideAuthOverlay();
          resolve(true);
        } catch (err) {
          _setAuthError(err && err.message ? err.message : 'Sign in failed. Check your credentials and try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
        }
      });
    });
  }

  function _fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(ts)) ? ts + 'T00:00:00' : ts);
    return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function _todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function _wordCount(text) {
    return (String(text || '').trim().match(/\S+/g) || []).length;
  }

  function _runTypeInfo(value) {
    return RUN_TYPES.find(t => t.value === value) || RUN_TYPES[RUN_TYPES.length - 1];
  }

  function _totalMinutes(runsheet) {
    return runsheet.reduce((sum, item) => sum + (parseInt(item.duration, 10) || 0), 0);
  }

  function _fsFB() {
    return !!(window.UpperRoom && typeof window.UpperRoom.isReady === 'function' && window.UpperRoom.isReady());
  }

  async function _gasCall(action, params = {}) {
    const endpoint = String(window.PASTORAL_DB_V2_ENDPOINT || '').trim();
    if (!endpoint) return null;
    const N    = window.Nehemiah;
    const sess = (N && typeof N.getSession === 'function') ? N.getSession() : null;
    if (!sess) return null;
    const p = new URLSearchParams({ action, token: sess.token, email: sess.email, _: String(_now()) });
    Object.keys(params).forEach(k => { if (params[k] != null) p.set(k, String(params[k])); });
    try {
      const resp = await fetch(endpoint + '?' + p.toString(), { referrerPolicy: 'no-referrer' });
      if (!resp.ok) return null;
      const data = await resp.json();
      return (data && data.ok) ? data : null;
    } catch (e) {
      console.warn('[Sanctuary] GAS call failed:', action, e);
      return null;
    }
  }

  /* ── Transpose ────────────────────────────────────────────────────────── */
  function _transposeNote(note, semitones) {
    if (!note || semitones === 0) return note;
    const useFlats = note.includes('b');
    const scale = useFlats ? FLATS : SHARPS;
    const idx = scale.indexOf(note);
    if (idx === -1) return note;
    return scale[((idx + semitones) % 12 + 12) % 12];
  }

  function _transposeChord(chord, semitones) {
    if (!chord || semitones === 0) return chord;
    const m = chord.match(/^([A-G][#b]?)(.*)/);
    if (!m) return chord;
    return _transposeNote(m[1], semitones) + m[2];
  }

  function _transposedKey(baseKey, semitones) {
    return _transposeNote(baseKey, semitones) || baseKey;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MODEL FACTORIES
  ═══════════════════════════════════════════════════════════════════════ */

  function _makeSermon(title = 'Untitled Sermon') {
    const now = _now();
    return { id: _uid(), title, series: '', date: _todayISO(), speaker: '', passage: '', status: 'draft', isActive: false, sections: [{ id: _uid(), type: 'intro', title: 'Introduction', notes: '' }], manuscript: '', researchNotes: '', altarCall: '', createdAt: now, updatedAt: now };
  }

  function _makeSermonSection(type = 'point') {
    return { id: _uid(), type, title: SECTION_DEFAULTS[type] || 'Section', notes: '' };
  }

  function _makeRunItem(type = 'worship', title = '', duration = 0) {
    return { id: _uid(), type, title, duration };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PERSISTENCE — SERMONS
  ═══════════════════════════════════════════════════════════════════════ */

  function _lsSyncSermons() {
    try { localStorage.setItem(LS_SERMONS, JSON.stringify(S.sermons)); } catch (_) {}
  }

  async function _loadSermons() {
    if (_fsFB()) {
      try {
        const result = await window.UpperRoom.listSermons({ limit: 500 });
        const rows = Array.isArray(result) ? result : (result.results || result.rows || []);
        if (rows.length > 0) {
          S.sermons = rows.map(r => { r._fsId = r.id; return r; });
          _lsSyncSermons();
          return;
        }
      } catch (e) { console.warn('[Sanctuary] Firestore sermons failed:', e); }
    }
    const gas = await _gasCall('sermons.list');
    if (gas && Array.isArray(gas.rows)) {
      S.sermons = gas.rows.map(r => { r._gasId = r.id; return r; });
      _lsSyncSermons();
      return;
    }
    try { S.sermons = JSON.parse(localStorage.getItem(LS_SERMONS) || '[]'); } catch (_) { S.sermons = []; }
  }

  let _sermonSaveTimer = null;
  function _queueSermonSave(sermon) {
    clearTimeout(_sermonSaveTimer);
    sermon.updatedAt = _now();
    _lsSyncSermons();
    _sermonSaveTimer = setTimeout(async () => {
      if (_fsFB()) {
        try {
          if (sermon._fsId) {
            const { id: _lid, _fsId, _gasId, ...payload } = sermon;
            await window.UpperRoom.updateSermon({ id: _fsId, ...payload });
          } else {
            const res = await window.UpperRoom.createSermon(sermon);
            sermon._fsId = res.id;
            _lsSyncSermons();
          }
          return;
        } catch (e) { console.warn('[Sanctuary] Firestore sermon save failed:', e); }
      }
      const payload = JSON.stringify(sermon);
      if (sermon._gasId) {
        await _gasCall('sermons.save', { id: sermon._gasId, data: payload });
      } else {
        const res = await _gasCall('sermons.save', { data: payload });
        if (res && res.row) { sermon._gasId = res.row.id; _lsSyncSermons(); }
      }
    }, 1200);
  }

  async function _deleteSermon(sermon) {
    S.sermons = S.sermons.filter(s => s.id !== sermon.id);
    _lsSyncSermons();
    if (_fsFB() && sermon._fsId) {
      try { await window.UpperRoom.deleteSermon(sermon._fsId); } catch (_) {}
    } else if (sermon._gasId) {
      await _gasCall('sermons.delete', { id: sermon._gasId });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PERSISTENCE — SONGS
  ═══════════════════════════════════════════════════════════════════════ */

  function _lsSyncSongs() {
    try { localStorage.setItem(LS_SONGS, JSON.stringify(S.songs)); } catch (_) {}
  }

  async function _loadSongs() {
    if (_fsFB()) {
      try {
        const result = await window.UpperRoom.listSongs({ limit: 1000 });
        const rows = Array.isArray(result) ? result : (result.results || result.rows || []);
        if (rows.length > 0) {
          S.songs = rows.map(r => { r._fsId = r.id; return r; });
          _lsSyncSongs();
          return;
        }
      } catch (e) { console.warn('[Sanctuary] Firestore songs failed:', e); }
    }
    const gas = await _gasCall('songs.list');
    if (gas && Array.isArray(gas.rows)) {
      S.songs = gas.rows.map(r => { r._gasId = r.id; return r; });
      _lsSyncSongs();
      return;
    }
    try { S.songs = JSON.parse(localStorage.getItem(LS_SONGS) || '[]'); } catch (_) { S.songs = []; }
    // Use starter library if still empty
    if (S.songs.length === 0) S.songs = STARTER_SONGS.map(s => ({ ...s }));
  }

  async function _saveSong(song) {
    song.updatedAt = _now();
    _lsSyncSongs();
    if (_fsFB()) {
      try {
        if (song._fsId) {
          const { id: _lid, _fsId, _gasId, ...payload } = song;
          await window.UpperRoom.updateSong({ id: _fsId, ...payload });
        } else {
          const res = await window.UpperRoom.createSong(song);
          song._fsId = res.id;
          _lsSyncSongs();
        }
        return;
      } catch (e) { console.warn('[Sanctuary] Firestore song save failed:', e); }
    }
    const payload = JSON.stringify(song);
    if (song._gasId) {
      await _gasCall('songs.save', { id: song._gasId, data: payload });
    } else {
      const res = await _gasCall('songs.save', { data: payload });
      if (res && res.row) { song._gasId = res.row.id; _lsSyncSongs(); }
    }
  }

  async function _deleteSong(song) {
    S.songs = S.songs.filter(s => s.id !== song.id);
    S.setList = S.setList.filter(sl => sl.songId !== song.id);
    _lsSyncSongs();
    if (_fsFB() && song._fsId) {
      try { await window.UpperRoom.deleteSong(song._fsId); } catch (_) {}
    }
    await _savePlan();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PERSISTENCE — SERVICE PLAN (setList + runsheet)
  ═══════════════════════════════════════════════════════════════════════ */

  function _lsSyncPlans() {
    try { localStorage.setItem(LS_PLANS, JSON.stringify({ planId: S.planId, date: S.serviceDate, setList: S.setList, runsheet: S.runsheet })); } catch (_) {}
  }

  async function _loadPlan() {
    const today = _todayISO();
    // Try Firestore
    if (_fsFB()) {
      try {
        const result = await window.UpperRoom.listServicePlans({ limit: 50 });
        const rows = Array.isArray(result) ? result : (result.results || result.rows || []);
        // Prefer a plan for today or the most recent
        const sorted = [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const plan = sorted.find(r => r.date === today) || sorted[0];
        if (plan) {
          S.planId      = plan._fsId || plan.id;
          S.serviceDate = plan.date  || today;
          S.setList     = Array.isArray(plan.setList)  ? plan.setList  : [];
          S.runsheet    = Array.isArray(plan.runsheet) ? plan.runsheet : [];
          _lsSyncPlans();
          return;
        }
      } catch (e) { console.warn('[Sanctuary] Firestore plan load failed:', e); }
    }
    // GAS fallback
    const gas = await _gasCall('servicePlans.list', { date: today });
    if (gas && gas.plan) {
      S.planId      = gas.plan.id || null;
      S.serviceDate = gas.plan.date || today;
      S.setList     = Array.isArray(gas.plan.setList)  ? gas.plan.setList  : [];
      S.runsheet    = Array.isArray(gas.plan.runsheet) ? gas.plan.runsheet : [];
      _lsSyncPlans();
      return;
    }
    // localStorage
    try {
      const cached = JSON.parse(localStorage.getItem(LS_PLANS) || '{}');
      S.planId      = cached.planId || null;
      S.serviceDate = cached.date   || today;
      S.setList     = Array.isArray(cached.setList)  ? cached.setList  : [];
      S.runsheet    = Array.isArray(cached.runsheet) ? cached.runsheet : [];
    } catch (_) {
      S.serviceDate = today;
      S.setList  = [];
      S.runsheet = [];
    }
  }

  let _planSaveTimer = null;
  function _savePlan() {
    _lsSyncPlans();
    clearTimeout(_planSaveTimer);
    _planSaveTimer = setTimeout(async () => {
      const payload = { date: S.serviceDate, setList: S.setList, runsheet: S.runsheet };
      if (_fsFB()) {
        try {
          if (S.planId) {
            await window.UpperRoom.updateServicePlan({ id: S.planId, ...payload });
          } else {
            const res = await window.UpperRoom.createServicePlan(payload);
            S.planId = res.id;
            _lsSyncPlans();
          }
          return;
        } catch (e) { console.warn('[Sanctuary] Firestore plan save failed:', e); }
      }
      await _gasCall('servicePlans.save', { id: S.planId || '', data: JSON.stringify(payload) });
    }, 800);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TOAST
  ═══════════════════════════════════════════════════════════════════════ */

  function _toast(msg, type = 'info') {
    if (window.FlockGates && typeof window.FlockGates.toast === 'function') {
      window.FlockGates.toast(msg, type);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PANEL A — SERMON BUILDER
  ═══════════════════════════════════════════════════════════════════════ */

  function renderSermonPanel() {
    const container = _qs('sanc-sermon-list-inner');
    if (!container) return;

    const q = S.sermonSearch.toLowerCase();
    let list = S.sermons.filter(s => {
      const matchSearch = !q || (s.title || '').toLowerCase().includes(q) || (s.passage || '').toLowerCase().includes(q) || (s.series || '').toLowerCase().includes(q);
      const matchStatus = S.sermonFilter === 'all' || (s.status || 'draft') === S.sermonFilter;
      return matchSearch && matchStatus;
    }).sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    if (list.length === 0) {
      container.innerHTML = `<div class="sanc-empty">${S.sermons.length === 0 ? 'No sermons yet — tap <strong>New Sermon</strong> to begin.' : 'No sermons match that search.'}</div>`;
      return;
    }

    container.innerHTML = list.map(s => {
      const active = s.id === S.activeSermonId;
      const wc = _wordCount((s.sections || []).map(x => x.notes || '').join(' ') + ' ' + (s.manuscript || ''));
      const statusCls = `sanc-badge sanc-badge--${s.status || 'draft'}`;
      return `<div class="sanc-story${active ? ' is-active-item' : ''}" data-id="${_e(s.id)}" data-action="open-sermon">
        <div class="sanc-story__kicker">${s.isActive ? '★ ACTIVE · ' : ''}${_e(s.series || 'SERMON')}</div>
        <div class="sanc-story__hed">${_e(s.title)}</div>
        ${s.passage ? `<div class="sanc-story__deck">${_e(s.passage)}</div>` : ''}
        <div class="sanc-story__meta">
          <span class="${_e(statusCls)}">${_e(STATUS_LABELS[s.status] || 'Draft')}</span>
          ${s.date ? `<span style="font-size:0.6875rem;color:var(--ink-muted)">${_fmtDate(s.date)}</span>` : ''}
          ${wc > 0 ? `<span style="font-size:0.6875rem;color:var(--ink-faint)">${wc} words</span>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  function openSermonDrawer(sermonId) {
    const s = S.sermons.find(x => x.id === sermonId);
    if (!s) return;
    S.activeSermonId = sermonId;
    renderSermonPanel();

    const html = `
      <div id="sd-sermon-id" data-id="${_e(s.id)}" style="display:none"></div>

      <div class="sanc-drawer-section">
        <label class="sanc-drawer-label" for="sd-title">Sermon Title</label>
        <input id="sd-title" class="sanc-input" type="text" value="${_e(s.title)}" placeholder="Enter sermon title" autocomplete="off">
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.625rem;" class="sanc-drawer-section">
        <div>
          <label class="sanc-drawer-label" for="sd-passage">Scripture Passage</label>
          <input id="sd-passage" class="sanc-input" type="text" value="${_e(s.passage || '')}" placeholder="e.g. John 3:16" autocomplete="off">
        </div>
        <div>
          <label class="sanc-drawer-label" for="sd-date">Date</label>
          <input id="sd-date" class="sanc-input" type="date" value="${_e(s.date || _todayISO())}">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.625rem;" class="sanc-drawer-section">
        <div>
          <label class="sanc-drawer-label" for="sd-series">Series</label>
          <input id="sd-series" class="sanc-input" type="text" value="${_e(s.series || '')}" placeholder="Series name" autocomplete="off">
        </div>
        <div>
          <label class="sanc-drawer-label" for="sd-status">Status</label>
          <select id="sd-status" class="sanc-select" style="width:100%;height:2.5rem;">
            ${STATUS_CYCLE.map(st => `<option value="${st}"${(s.status||'draft')===st?' selected':''}>${STATUS_LABELS[st]}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="sanc-drawer-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
          <span class="sanc-drawer-label" style="margin-bottom:0">Outline</span>
          <div style="display:flex;gap:0.375rem;flex-wrap:wrap;">
            <select id="sd-add-type" class="sanc-select" style="height:2rem;font-size:0.75rem;">
              ${SECTION_TYPES.map(t => `<option value="${t}">${SECTION_DEFAULTS[t]}</option>`).join('')}
            </select>
            <button class="sanc-btn sanc-btn--sm" id="sd-add-section" type="button">+ Add</button>
          </div>
        </div>
        <div id="sd-sections-list">
          ${_renderSermonSections(s)}
        </div>
      </div>

      <div class="sanc-drawer-section">
        <label class="sanc-drawer-label" for="sd-research">Research Notes</label>
        <textarea id="sd-research" class="sanc-textarea" rows="3" placeholder="Cross-references, background, illustrations…">${_e(s.researchNotes || '')}</textarea>
      </div>

      <div class="sanc-drawer-section">
        <label class="sanc-drawer-label" for="sd-altar">Altar Call</label>
        <textarea id="sd-altar" class="sanc-textarea" rows="2" placeholder="Altar call notes…">${_e(s.altarCall || '')}</textarea>
      </div>

      <div class="sanc-drawer-section" style="display:flex;gap:0.5rem;flex-wrap:wrap;border-top:1px solid var(--rule);padding-top:1rem;margin-top:0.25rem;">
        <button class="sanc-btn" id="sd-save-btn" type="button">Save Sermon</button>
        <button class="sanc-btn sanc-btn--ghost" id="sd-active-btn" type="button">${s.isActive ? 'Unpin as Active' : 'Pin as Active'}</button>
        <button class="sanc-btn sanc-btn--danger" id="sd-delete-btn" type="button" style="margin-left:auto">Delete</button>
      </div>`;

    if (window.FlockGates) window.FlockGates.openDrawer('Sermon Notes', html);
    _wireSermonDrawer(s);
  }

  function _renderSermonSections(s) {
    const secs = s.sections || [];
    if (secs.length === 0) return '<div class="sanc-empty" style="padding:0.75rem 0;">No sections yet — add one above.</div>';
    return secs.map((sec, i) => `
      <div class="sanc-section-row" data-sec-id="${_e(sec.id)}">
        <div>
          <span class="sanc-section-type-badge">${_e(sec.type)}</span>
        </div>
        <div class="sanc-section-notes">
          <input class="sanc-section-title-input" type="text" value="${_e(sec.title)}" placeholder="${_e(SECTION_DEFAULTS[sec.type]||'Section')}" data-field="title">
          <textarea class="sanc-section-notes-area" rows="2" placeholder="Notes, scripture, talking points…" data-field="notes">${_e(sec.notes || '')}</textarea>
        </div>
        <div class="sanc-section-row-actions">
          ${i > 0 ? `<button class="sanc-icon-btn" data-sec-move="up" title="Move up">▲</button>` : '<span style="min-width:28px"></span>'}
          ${i < secs.length - 1 ? `<button class="sanc-icon-btn" data-sec-move="down" title="Move down">▼</button>` : '<span style="min-width:28px"></span>'}
          <button class="sanc-icon-btn" data-sec-delete="${_e(sec.id)}" title="Remove section">✕</button>
        </div>
      </div>`).join('');
  }

  function _wireSermonDrawer(s) {
    const drawer = document.querySelector('.drawer-body') || document.getElementById('drawer-body');
    if (!drawer) return;

    // Auto-save field changes
    const autosave = () => {
      s.title         = (_qs('sd-title')    || {}).value    || s.title;
      s.passage       = (_qs('sd-passage')  || {}).value    || '';
      s.date          = (_qs('sd-date')     || {}).value    || s.date;
      s.series        = (_qs('sd-series')   || {}).value    || '';
      s.status        = (_qs('sd-status')   || {}).value    || s.status;
      s.researchNotes = (_qs('sd-research') || {}).value    || '';
      s.altarCall     = (_qs('sd-altar')    || {}).value    || '';
      _queueSermonSave(s);
    };

    ['sd-title','sd-passage','sd-date','sd-series','sd-status','sd-research','sd-altar']
      .forEach(id => { const el = _qs(id); if (el) el.addEventListener('input', autosave); });

    // Section field changes
    drawer.addEventListener('input', function(e) {
      const row = e.target.closest('[data-sec-id]');
      if (!row) return;
      const secId = row.dataset.secId;
      const sec = (s.sections || []).find(x => x.id === secId);
      if (!sec) return;
      const field = e.target.dataset.field;
      if (field === 'title') sec.title = e.target.value;
      if (field === 'notes') sec.notes = e.target.value;
      _queueSermonSave(s);
    });

    // Move section
    drawer.addEventListener('click', function(e) {
      const moveBtn = e.target.closest('[data-sec-move]');
      if (moveBtn) {
        const row   = moveBtn.closest('[data-sec-id]');
        const secId = row.dataset.secId;
        const idx   = s.sections.findIndex(x => x.id === secId);
        const dir   = moveBtn.dataset.secMove === 'up' ? -1 : 1;
        const newIdx = idx + dir;
        if (newIdx >= 0 && newIdx < s.sections.length) {
          [s.sections[idx], s.sections[newIdx]] = [s.sections[newIdx], s.sections[idx]];
          _qs('sd-sections-list').innerHTML = _renderSermonSections(s);
          _queueSermonSave(s);
        }
        return;
      }

      // Delete section
      const delBtn = e.target.closest('[data-sec-delete]');
      if (delBtn) {
        const secId = delBtn.dataset.secDelete;
        s.sections = s.sections.filter(x => x.id !== secId);
        _qs('sd-sections-list').innerHTML = _renderSermonSections(s);
        _queueSermonSave(s);
        return;
      }
    });

    // Add section
    const addBtn = _qs('sd-add-section');
    if (addBtn) addBtn.addEventListener('click', () => {
      const type = (_qs('sd-add-type') || {}).value || 'point';
      if (!s.sections) s.sections = [];
      s.sections.push(_makeSermonSection(type));
      _qs('sd-sections-list').innerHTML = _renderSermonSections(s);
      _queueSermonSave(s);
    });

    // Save button
    const saveBtn = _qs('sd-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => { autosave(); _toast('Sermon saved', 'success'); });

    // Pin/unpin active
    const activeBtn = _qs('sd-active-btn');
    if (activeBtn) activeBtn.addEventListener('click', () => {
      if (!s.isActive) S.sermons.forEach(x => { x.isActive = false; });
      s.isActive = !s.isActive;
      activeBtn.textContent = s.isActive ? 'Unpin as Active' : 'Pin as Active';
      _queueSermonSave(s);
      renderSermonPanel();
      _toast(s.isActive ? 'Sermon pinned as active' : 'Sermon unpinned', 'info');
    });

    // Delete
    const delBtn = _qs('sd-delete-btn');
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${s.title}"? This cannot be undone.`)) return;
      await _deleteSermon(s);
      if (window.FlockGates) window.FlockGates.closeDrawer();
      S.activeSermonId = null;
      renderSermonPanel();
      _toast('Sermon deleted', 'success');
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PANEL B — SONG PLANNER
  ═══════════════════════════════════════════════════════════════════════ */

  function renderSongPanel() {
    const container = _qs('sanc-song-list-inner');
    if (!container) return;

    // Update tab bar active state
    const tabBarEl = _qs('sanc-song-tabs');
    if (tabBarEl) {
      tabBarEl.querySelectorAll('.sanc-tab').forEach(t => {
        t.classList.toggle('is-active', t.dataset.tab === S.songTab);
      });
    }

    if (S.songTab === 'library') {
      _renderSongLibrary(container);
    } else {
      _renderSetList(container);
    }
  }

  function _renderSongLibrary(container) {
    const q = S.songSearch.toLowerCase();
    let songs = S.songs.filter(s => !q || (s.title || '').toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q) || (s.key || '').toLowerCase().includes(q) || (s.ccli || '').includes(q));

    if (songs.length === 0) {
      container.innerHTML = `<div class="sanc-empty">${S.songs.length === 0 ? 'No songs yet — add one below.' : 'No songs match that search.'}</div>`;
    } else {
      container.innerHTML = songs.map(song => {
        const inSet = S.setList.some(sl => sl.songId === song.id);
        return `<div class="sanc-song-row" data-song-id="${_e(song.id)}" data-action="open-song" style="cursor:pointer">
          <div class="sanc-song-info">
            <div class="sanc-song-title">${_e(song.title)}</div>
            <div class="sanc-song-meta">
              ${song.artist ? `<span>${_e(song.artist)}</span>` : ''}
              ${song.ccli ? `<span>CCLI ${_e(song.ccli)}</span>` : ''}
            </div>
          </div>
          ${song.key ? `<span class="sanc-key-chip">${_e(song.key)}</span>` : ''}
          <button class="sanc-btn sanc-btn--sm${inSet ? ' sanc-btn--ghost' : ''}" data-add-song="${_e(song.id)}" type="button">${inSet ? '✓ In Set' : '+ Set'}</button>
        </div>`;
      }).join('');
    }

    // Add new song form
    container.innerHTML += `
      <div class="sanc-add-row" style="margin-top:1rem;flex-direction:column;align-items:stretch;gap:0.5rem;">
        <div style="display:flex;gap:0.375rem;">
          <input id="sanc-new-song-title" class="sanc-input" type="text" placeholder="Song title" style="flex:2;height:2.25rem;padding:0.4375rem 0.75rem;" autocomplete="off">
          <input id="sanc-new-song-key" class="sanc-input" type="text" placeholder="Key" style="width:4rem;height:2.25rem;padding:0.4375rem 0.5rem;" autocomplete="off">
          <button class="sanc-btn" id="sanc-add-song-btn" type="button">Add Song</button>
        </div>
      </div>`;
  }

  function _renderSetList(container) {
    if (S.setList.length === 0) {
      container.innerHTML = `<div class="sanc-empty">Sunday's set is empty — go to Library and tap <strong>+ Set</strong> to add songs.</div>`;
    } else {
      container.innerHTML = S.setList.map((sl, i) => {
        const displayKey = sl.semitones ? _transposedKey(sl.key || 'C', sl.semitones) : (sl.key || '—');
        return `<div class="sanc-song-row" data-sl-idx="${i}" data-action="open-set-song">
          <div style="color:var(--ink-muted);font-size:0.75rem;font-weight:700;min-width:1.25rem;">${i + 1}</div>
          <div class="sanc-song-info" style="cursor:pointer">
            <div class="sanc-song-title">${_e(sl.title)}</div>
            <div class="sanc-song-meta">${sl.artist ? `<span>${_e(sl.artist)}</span>` : ''}</div>
          </div>
          <span class="sanc-key-chip">${_e(displayKey)}</span>
          <div style="display:flex;flex-direction:column;gap:0.125rem;">
            ${i > 0 ? `<button class="sanc-icon-btn" data-sl-move="up" data-sl-idx="${i}" title="Move up">▲</button>` : '<span style="min-width:28px"></span>'}
            ${i < S.setList.length - 1 ? `<button class="sanc-icon-btn" data-sl-move="down" data-sl-idx="${i}" title="Move down">▼</button>` : '<span style="min-width:28px"></span>'}
          </div>
          <button class="sanc-icon-btn" data-sl-remove="${i}" title="Remove from set" style="color:var(--ink-muted)">✕</button>
        </div>`;
      }).join('');
    }
    container.innerHTML += `<div style="text-align:right;padding:0.5rem 0;border-top:1px solid var(--rule);margin-top:0.5rem;"><span style="font-size:0.75rem;color:var(--ink-muted)">${S.setList.length} song${S.setList.length !== 1 ? 's' : ''} in Sunday's set</span></div>`;
  }

  function openSongDrawer(songId) {
    const song = S.songs.find(s => s.id === songId);
    if (!song) return;

    const inSet = S.setList.some(sl => sl.songId === song.id);
    const html = `
      <div class="sanc-drawer-section">
        <label class="sanc-drawer-label" for="song-title">Title</label>
        <input id="song-title" class="sanc-input" type="text" value="${_e(song.title)}" placeholder="Song title" autocomplete="off">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;" class="sanc-drawer-section">
        <div>
          <label class="sanc-drawer-label" for="song-artist">Artist</label>
          <input id="song-artist" class="sanc-input" type="text" value="${_e(song.artist||'')}" placeholder="Artist" autocomplete="off">
        </div>
        <div>
          <label class="sanc-drawer-label" for="song-key">Key</label>
          <input id="song-key" class="sanc-input" type="text" value="${_e(song.key||'')}" placeholder="Key" autocomplete="off" style="text-transform:uppercase">
        </div>
        <div>
          <label class="sanc-drawer-label" for="song-ccli">CCLI #</label>
          <input id="song-ccli" class="sanc-input" type="text" value="${_e(song.ccli||'')}" placeholder="CCLI" autocomplete="off">
        </div>
      </div>

      <div class="sanc-drawer-section">
        <label class="sanc-drawer-label">Transpose for Sunday</label>
        <div class="sanc-transpose" id="song-transpose-widget">
          <button class="sanc-transpose__btn" id="song-semitones-down" type="button">−</button>
          <div class="sanc-transpose__display" id="song-key-display">${_e(song.key||'C')}</div>
          <button class="sanc-transpose__btn" id="song-semitones-up" type="button">+</button>
          <span class="sanc-transpose__label" id="song-semitones-label" style="margin-left:0.25rem;font-size:0.75rem;color:var(--ink-muted)">Original key</span>
        </div>
      </div>

      <div class="sanc-drawer-section">
        <label class="sanc-drawer-label" for="song-chords">Chord Chart / Lyrics (ChordPro or plain text)</label>
        <textarea id="song-chords" class="sanc-textarea" rows="8" placeholder="[G]Amazing grace how [D]sweet the sound…">${_e(song.chords||'')}</textarea>
      </div>

      <div class="sanc-drawer-section" style="display:flex;gap:0.5rem;flex-wrap:wrap;border-top:1px solid var(--rule);padding-top:1rem;">
        <button class="sanc-btn" id="song-save-btn" type="button">Save Song</button>
        <button class="sanc-btn sanc-btn--ghost" id="song-set-btn" type="button">${inSet ? 'Remove from Set' : 'Add to Sunday\'s Set'}</button>
        ${song.id.startsWith('starter_') ? '' : `<button class="sanc-btn sanc-btn--danger" id="song-delete-btn" type="button" style="margin-left:auto">Delete</button>`}
      </div>`;

    if (window.FlockGates) window.FlockGates.openDrawer(song.title, html);
    _wireSongDrawer(song);
  }

  function _wireSongDrawer(song) {
    let semitones = 0;

    function updateKeyDisplay() {
      const kd = _qs('song-key-display');
      const lbl = _qs('song-semitones-label');
      if (kd) kd.textContent = _transposedKey(song.key || 'C', semitones);
      if (lbl) lbl.textContent = semitones === 0 ? 'Original key' : (semitones > 0 ? `+${semitones} semitones` : `${semitones} semitones`);
    }

    const downBtn = _qs('song-semitones-down');
    const upBtn   = _qs('song-semitones-up');
    if (downBtn) downBtn.addEventListener('click', () => { semitones--; updateKeyDisplay(); });
    if (upBtn)   upBtn.addEventListener('click',   () => { semitones++; updateKeyDisplay(); });

    const saveBtn = _qs('song-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      song.title  = (_qs('song-title')  || {}).value || song.title;
      song.artist = (_qs('song-artist') || {}).value || '';
      song.key    = ((_qs('song-key')   || {}).value || '').toUpperCase() || song.key;
      song.ccli   = (_qs('song-ccli')   || {}).value || '';
      song.chords = (_qs('song-chords') || {}).value || '';
      await _saveSong(song);
      renderSongPanel();
      _toast('Song saved', 'success');
    });

    const setBtn = _qs('song-set-btn');
    if (setBtn) setBtn.addEventListener('click', () => {
      const idx = S.setList.findIndex(sl => sl.songId === song.id);
      if (idx >= 0) {
        S.setList.splice(idx, 1);
        setBtn.textContent = "Add to Sunday's Set";
        _toast('Removed from set', 'info');
      } else {
        S.setList.push({ songId: song.id, title: song.title, artist: song.artist || '', key: song.key || 'C', semitones });
        setBtn.textContent = 'Remove from Set';
        _toast('Added to Sunday\'s set', 'success');
      }
      _savePlan();
      renderSongPanel();
    });

    const delBtn = _qs('song-delete-btn');
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${song.title}"? This cannot be undone.`)) return;
      await _deleteSong(song);
      if (window.FlockGates) window.FlockGates.closeDrawer();
      renderSongPanel();
      _toast('Song deleted', 'success');
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PANEL C — SERVICE ORDER
  ═══════════════════════════════════════════════════════════════════════ */

  function renderOrderPanel() {
    const container = _qs('sanc-order-body');
    if (!container) return;

    const totalMin = _totalMinutes(S.runsheet);
    const totalH   = Math.floor(totalMin / 60);
    const totalM   = totalMin % 60;
    const totalStr = totalH > 0 ? `${totalH}h ${totalM}m` : `${totalM} min`;

    let html = `
      <div class="sanc-order-meta">
        <span class="sanc-order-total">⏱ ${totalStr}</span>
        <span class="sanc-order-date">
          <input type="date" id="sanc-service-date" class="sanc-input" style="height:1.75rem;font-size:0.75rem;padding:0.1875rem 0.5rem;" value="${_e(S.serviceDate)}" title="Service date">
        </span>
      </div>`;

    if (S.runsheet.length === 0) {
      html += '<div class="sanc-empty">Service order is empty — add items below.</div>';
    } else {
      html += S.runsheet.map((item, i) => {
        const info = _runTypeInfo(item.type);
        return `<div class="sanc-run-item" data-run-id="${_e(item.id)}">
          <span class="sanc-run-type-icon">${info.icon}</span>
          <div class="sanc-run-info">
            <div class="sanc-run-title">${_e(item.title || info.label)}</div>
            <div style="font-size:0.625rem;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase">${_e(info.label)}</div>
          </div>
          <span class="sanc-run-dur">${item.duration ? item.duration + ' min' : '—'}</span>
          <div class="sanc-run-actions">
            ${i > 0 ? `<button class="sanc-icon-btn" data-run-move="up" title="Move up">▲</button>` : '<span style="min-width:28px"></span>'}
            ${i < S.runsheet.length - 1 ? `<button class="sanc-icon-btn" data-run-move="down" title="Move down">▼</button>` : '<span style="min-width:28px"></span>'}
            <button class="sanc-icon-btn" data-run-delete="${_e(item.id)}" title="Remove">✕</button>
          </div>
        </div>`;
      }).join('');
    }

    // Add item form
    html += `
      <div class="sanc-add-row">
        <select id="sanc-run-type" class="sanc-select">
          ${RUN_TYPES.map(t => `<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
        </select>
        <input id="sanc-run-title" class="sanc-input" type="text" placeholder="Item title" autocomplete="off">
        <input id="sanc-run-dur" class="sanc-input" type="number" placeholder="min" min="0" max="180" style="width:4rem;text-align:center;">
        <button class="sanc-btn sanc-btn--sm" id="sanc-add-run-btn" type="button">Add</button>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:0.75rem;padding-top:0.5rem;border-top:1px solid var(--rule);">
        <button class="sanc-btn sanc-btn--ghost sanc-btn--sm" id="sanc-print-btn" type="button">🖨 Print Order</button>
      </div>`;

    container.innerHTML = html;
    _wireOrderPanel();
  }

  function _wireOrderPanel() {
    // Service date change
    const dateInput = _qs('sanc-service-date');
    if (dateInput) dateInput.addEventListener('change', () => {
      S.serviceDate = dateInput.value || S.serviceDate;
      _savePlan();
    });

    // Reorder / delete items
    const container = _qs('sanc-order-body');
    if (!container) return;

    container.addEventListener('click', function(e) {
      const moveBtn = e.target.closest('[data-run-move]');
      if (moveBtn) {
        const row    = moveBtn.closest('[data-run-id]');
        const runId  = row.dataset.runId;
        const idx    = S.runsheet.findIndex(r => r.id === runId);
        const dir    = moveBtn.dataset.runMove === 'up' ? -1 : 1;
        const newIdx = idx + dir;
        if (newIdx >= 0 && newIdx < S.runsheet.length) {
          [S.runsheet[idx], S.runsheet[newIdx]] = [S.runsheet[newIdx], S.runsheet[idx]];
          renderOrderPanel();
          _savePlan();
        }
        return;
      }

      const delBtn = e.target.closest('[data-run-delete]');
      if (delBtn) {
        const runId = delBtn.dataset.runDelete;
        S.runsheet = S.runsheet.filter(r => r.id !== runId);
        renderOrderPanel();
        _savePlan();
        return;
      }
    });

    // Add item
    const addBtn = _qs('sanc-add-run-btn');
    if (addBtn) addBtn.addEventListener('click', () => {
      const type  = (_qs('sanc-run-type')  || {}).value || 'other';
      const title = (_qs('sanc-run-title') || {}).value.trim();
      const dur   = parseInt((_qs('sanc-run-dur') || {}).value, 10) || 0;
      const info  = _runTypeInfo(type);
      S.runsheet.push(_makeRunItem(type, title || info.label, dur));
      renderOrderPanel();
      _savePlan();
    });

    // Print
    const printBtn = _qs('sanc-print-btn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PANEL COLLAPSE
  ═══════════════════════════════════════════════════════════════════════ */

  function wireCollapseToggles() {
    document.querySelectorAll('[data-collapse-panel]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key  = btn.dataset.collapsePanel;
        S.panelCollapsed[key] = !S.panelCollapsed[key];
        const body = document.getElementById('sanc-' + key + '-body');
        if (body) body.classList.toggle('is-collapsed', S.panelCollapsed[key]);
        btn.textContent = S.panelCollapsed[key] ? '▶' : '▼';
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     GLOBAL EVENT DELEGATION
  ═══════════════════════════════════════════════════════════════════════ */

  function wireEvents() {
    const page = document.getElementById('the-sanctuary-grid') ||
                 document.querySelector('.sanctuary-columns');
    if (!page) return;

    page.addEventListener('click', function(e) {
      // Open sermon drawer
      const sermonRow = e.target.closest('[data-action="open-sermon"]');
      if (sermonRow) { openSermonDrawer(sermonRow.dataset.id); return; }

      // Open song drawer
      const songRow = e.target.closest('[data-action="open-song"]');
      if (songRow && !e.target.closest('[data-add-song]')) { openSongDrawer(songRow.dataset.songId); return; }

      // Add to set (library)
      const addSong = e.target.closest('[data-add-song]');
      if (addSong) {
        const songId = addSong.dataset.addSong;
        const song   = S.songs.find(s => s.id === songId);
        if (!song) return;
        const idx = S.setList.findIndex(sl => sl.songId === songId);
        if (idx >= 0) {
          S.setList.splice(idx, 1);
          _toast('Removed from set', 'info');
        } else {
          S.setList.push({ songId, title: song.title, artist: song.artist || '', key: song.key || 'C', semitones: 0 });
          _toast('Added to Sunday\'s set', 'success');
        }
        _savePlan();
        renderSongPanel();
        return;
      }

      // Open set-song drawer (transpose)
      const setRow = e.target.closest('[data-action="open-set-song"]');
      if (setRow && !e.target.closest('[data-sl-move]') && !e.target.closest('[data-sl-remove]')) {
        const idx = parseInt(setRow.dataset.slIdx, 10);
        const sl  = S.setList[idx];
        const song = S.songs.find(s => s.id === sl.songId) || { ...sl, id: sl.songId };
        openSongDrawer(song.id || song.songId);
        return;
      }

      // Setlist reorder
      const slMove = e.target.closest('[data-sl-move]');
      if (slMove) {
        const idx = parseInt(slMove.dataset.slIdx, 10);
        const dir = slMove.dataset.slMove === 'up' ? -1 : 1;
        const newIdx = idx + dir;
        if (newIdx >= 0 && newIdx < S.setList.length) {
          [S.setList[idx], S.setList[newIdx]] = [S.setList[newIdx], S.setList[idx]];
          _savePlan();
          renderSongPanel();
        }
        return;
      }

      // Setlist remove
      const slRem = e.target.closest('[data-sl-remove]');
      if (slRem) {
        S.setList.splice(parseInt(slRem.dataset.slRemove, 10), 1);
        _savePlan();
        renderSongPanel();
        return;
      }
    });

    // Song search
    const songSearchEl = _qs('sanc-song-search');
    if (songSearchEl) songSearchEl.addEventListener('input', () => {
      S.songSearch = songSearchEl.value;
      renderSongPanel();
    });

    // Song tabs
    document.querySelectorAll('.sanc-tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        S.songTab = tab.dataset.tab;
        renderSongPanel();
      });
    });

    // Sermon search
    const sermSearchEl = _qs('sanc-sermon-search');
    if (sermSearchEl) sermSearchEl.addEventListener('input', () => {
      S.sermonSearch = sermSearchEl.value;
      renderSermonPanel();
    });

    // Sermon filter
    const sermFilter = _qs('sanc-sermon-filter');
    if (sermFilter) sermFilter.addEventListener('change', () => {
      S.sermonFilter = sermFilter.value;
      renderSermonPanel();
    });

    // New sermon
    const newSermonBtn = _qs('sanc-new-sermon-btn');
    if (newSermonBtn) newSermonBtn.addEventListener('click', () => {
      const s = _makeSermon('New Sermon');
      S.sermons.unshift(s);
      _lsSyncSermons();
      renderSermonPanel();
      openSermonDrawer(s.id);
    });

    // Add song from library form (delegated — rendered inside song panel)
    page.addEventListener('click', function(e) {
      const addBtn = e.target.closest('#sanc-add-song-btn');
      if (addBtn) {
        const titleEl = _qs('sanc-new-song-title');
        const keyEl   = _qs('sanc-new-song-key');
        const title   = (titleEl || {}).value.trim();
        const key     = ((keyEl || {}).value || '').toUpperCase() || 'C';
        if (!title) { _toast('Enter a song title first', 'warning'); return; }
        const song = { id: _uid(), title, key, artist: '', ccli: '', bpm: 0, chords: '', notes: '', updatedAt: _now() };
        S.songs.push(song);
        _saveSong(song);
        if (titleEl) titleEl.value = '';
        if (keyEl)   keyEl.value = '';
        renderSongPanel();
        _toast('Song added', 'success');
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     BOOT
  ═══════════════════════════════════════════════════════════════════════ */

  async function boot() {
    const authReady = await _ensureAuthenticated();
    if (!authReady) {
      return;
    }

    // Font scale button
    const fontBtn = document.getElementById('font-scale-btn');
    if (fontBtn && window.FlockGates && typeof window.FlockGates.openFontScalePicker === 'function') {
      fontBtn.addEventListener('click', () => window.FlockGates.openFontScalePicker(fontBtn));
    }

    // Wire collapse toggles and section events
    wireCollapseToggles();
    wireEvents();

    // Show skeletons in list containers only (toolbars + tabs are pre-rendered)
    ['sanc-sermon-list-inner', 'sanc-song-list-inner', 'sanc-order-body'].forEach(id => {
      const el = _qs(id);
      if (el) el.innerHTML = `<div class="sanc-empty" style="padding:2rem 0 1rem">Loading…</div>`;
    });

    // Load data concurrently
    await Promise.allSettled([
      _loadSermons(),
      _loadSongs(),
      _loadPlan(),
    ]);

    // Render all panels
    renderSermonPanel();
    renderSongPanel();
    renderOrderPanel();
  }

  document.addEventListener('DOMContentLoaded', boot);

})();

