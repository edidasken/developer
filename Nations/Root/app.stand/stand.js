/* ══════════════════════════════════════════════════════════════════════════════
   STAND.JS — Music Stand App Entry Point
   "Praise Him with the sound of the trumpet." — Psalm 150:3

   This is the standalone PWA shell for the Music Stand app (app.stand/).
   It handles:
     • FlockOS auth gate (Nehemiah / firm_foundation.js)
     • App-level navigation (dashboard, songs, services, import, settings)
     • Live full-screen presenter mode
     • Service plan management (setlists)
     • Import UI (SongSelect, Planning Center, manual ChordPro)
     • Settings (display, transpose, metronome)

   The full song library + arrangement + chord engine lives in
   Scripts/the_shofar/index.js — this module imports and delegates to it
   for the Songs Library view. All chord rendering, transposition, and
   CRUD flows run through The Shofar.
   ══════════════════════════════════════════════════════════════════════════════ */

// The Shofar is loaded as a plain defer script in music_stand.html
// and exposes window.openMusicStandApp — no ES module import needed.

/* ── Constants ───────────────────────────────────────────────────────────── */
const STORE_KEY_PREFS   = 'ms_prefs';
const STORE_KEY_PLAN_ID = 'ms_active_plan_id';

const _MS_SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const _MS_FLATS  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

/* ── State ────────────────────────────────────────────────────────────────── */
const S = {
  user:          null,   // { displayName, email, role }
  view:          'dashboard',
  activePlanId:  null,
  plans:         [],
  songs:         [],
  livePlan:      null,   // plan loaded for live mode
  liveIdx:       0,      // current song index in live mode
  liveSemitones: 0,
  liveAutoScroll: false,
  liveFontSize:  28,
  liveHideUI:    false,
  metroBpm:      72,
  metroBeats:    4,
  metroPlaying:  false,
  metroTick:     0,
  prefs: {
    defaultFontSize: 17,
    showChords:      true,
    showDiagrams:    false,
    nnsMode:         false,
    theme:           'dark',
  },
};

/* ── Prefs ────────────────────────────────────────────────────────────────── */
function _loadPrefs() {
  try {
    const raw = localStorage.getItem(STORE_KEY_PREFS);
    if (raw) Object.assign(S.prefs, JSON.parse(raw));
  } catch (_) { /* ignore */ }
}
function _savePrefs() {
  try { localStorage.setItem(STORE_KEY_PREFS, JSON.stringify(S.prefs)); } catch (_) {}
}

/* ── Tiny helpers ─────────────────────────────────────────────────────────── */
const _e = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

function _toast(msg, type = 'info') {
  const host = document.getElementById('ms-toasts');
  if (!host) return;
  const t = document.createElement('div');
  t.className = `ms-toast ms-toast--${type}`;
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('is-visible')); });
  setTimeout(() => {
    t.classList.remove('is-visible');
    setTimeout(() => t.remove(), 400);
  }, 3200);
}

function _fb() {
  return typeof UpperRoom !== 'undefined' &&
         typeof UpperRoom.isReady === 'function' &&
         UpperRoom.isReady();
}

function _fmtDate(raw) {
  if (!raw) return '';
  const s = String(raw);
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00' : s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
}

/* ── Transpose helpers (self-contained copy for live mode) ─────────────────── */
function _transposeChord(chord, semitones) {
  if (!chord || semitones === 0) return chord;
  const clean = chord.replace(/[()]/g, '');
  const noteMatch = clean.match(/^([A-G][#b]?)(.*)/);
  if (!noteMatch) return chord;
  const [, root, suffix] = noteMatch;
  const useFlats = root.includes('b');
  const scale = useFlats ? _MS_FLATS : _MS_SHARPS;
  const idx = scale.indexOf(root);
  if (idx === -1) return chord;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return scale[newIdx] + suffix;
}

function _transposeChordPro(text, semitones) {
  if (!text || semitones === 0) return text;
  return text.replace(/\[([^\]]+)\]/g, (_, ch) => `[${_transposeChord(ch, semitones)}]`);
}

/* ── Minimal ChordPro → HTML (for live presenter / preview) ──────────────── */
function _renderChordPro(text, opts = {}) {
  if (!text) return '<div class="ms-empty-content">No chord chart.</div>';
  const lines = String(text).split('\n');
  const { showChords = true } = opts;
  let html = '';
  let inSection = false;

  const SEC_COLORS = {
    verse: '--sc-verse', chorus: '--sc-chorus', bridge: '--sc-bridge',
    intro: '--sc-intro', outro: '--sc-outro', 'pre-chorus': '--sc-pre-chorus',
    tag: '--sc-tag', interlude: '--sc-default', instrumental: '--sc-default',
  };
  function _secColor(name) {
    const lc = name.toLowerCase();
    for (const [k, v] of Object.entries(SEC_COLORS)) if (lc.includes(k)) return v;
    return '--sc-default';
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Directives
    const dirMatch = line.match(/^\{([\w\-]+):\s*(.*?)\s*\}$/i);
    if (dirMatch) {
      const [, key, val] = dirMatch;
      const k = key.toLowerCase();
      // Metadata-only directives — silently skip
      const META_KEYS = new Set(['title','t','subtitle','st','artist','album','key','tempo','time','capo','copyright','ccli','flow','duration','book','number','keywords','topic','restrictions','songselect','link','meta','env','sorttitle']);
      if (!META_KEYS.has(k)) {
        // All non-metadata directives open a labelled section
        if (inSection) html += '</div></div>';
        const label = val || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const col = _secColor(label);
        html += `<div class="ms-section"><div class="ms-section-label" style="--sc:var(${col})">${_e(label)}</div><div class="ms-section-body">`;
        inSection = true;
      }
      continue;
    }

    // Start-of-section shorthand: {sov:...} / {start_of_verse:...} etc — open labelled section
    const sovMatch = line.match(/^\{(?:start_of_|so)(\w+)(?::\s*(.*?))?\s*\}/i);
    if (sovMatch) {
      if (inSection) html += '</div></div>';
      const secType  = sovMatch[1].toLowerCase().replace(/_/g, '-');
      const secLabel = sovMatch[2] || (secType.charAt(0).toUpperCase() + secType.slice(1));
      const col = _secColor(secLabel);
      html += `<div class="ms-section"><div class="ms-section-label" style="--sc:var(${col})">${_e(secLabel)}</div><div class="ms-section-body">`;
      inSection = true;
      continue;
    }
    if (/^\{(?:end_of_|eo)\w+\}/i.test(line)) {
      if (inSection) { html += '</div></div>'; inSection = false; }
      continue;
    }

    // Empty line
    if (!line.trim()) {
      if (inSection) html += '<div class="ms-chord-lyric-pair" style="height:0.8em"></div>';
      else { if (i > 0) html += '<div style="height:1.1em"></div>'; }
      continue;
    }

    // Parse chord+lyric pairs
    if (/\[[^\]]+\]/.test(line) && showChords) {
      let chordRow = '';
      let lyricRow = '';
      let pos = 0;
      const regex = /\[([^\]]+)\]/g;
      let m;
      while ((m = regex.exec(line)) !== null) {
        const before = line.substring(pos, m.index);
        lyricRow += before;
        while (chordRow.length < lyricRow.length) chordRow += ' ';
        chordRow += m[1];
        pos = m.index + m[0].length;
      }
      lyricRow += line.substring(pos);
      html += `<div class="ms-chord-lyric-pair">
        <div class="ms-cl-chords"><span class="ms-pair-chord">${_e(chordRow)}</span></div>
        <div class="ms-cl-lyrics"><span class="ms-pair-lyric">${_e(lyricRow)}</span></div>
      </div>`;
    } else {
      // Strip chords, show lyrics only
      const stripped = line.replace(/\[[^\]]+\]/g, '');
      html += `<div class="ms-lyric-line">${_e(stripped)}</div>`;
    }
  }
  if (inSection) html += '</div></div>';
  return html || '<div class="ms-empty-content">No content.</div>';
}

/* ── Wait for scripts to be ready ─────────────────────────────────────────── */
function _waitFor(predicate, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (predicate()) return resolve();
    const start = Date.now();
    const id = setInterval(() => {
      if (predicate()) { clearInterval(id); resolve(); }
      else if (Date.now() - start > timeout) { clearInterval(id); reject(new Error('timeout')); }
    }, 80);
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════════════════════ */

let _booted = false;
async function boot() {
  if (_booted) return;
  _booted = true;

  try {
    _loadPrefs();

    const N = window.Nehemiah || {};

    // If not authenticated, send back to login page
    if (typeof N.isAuthenticated === 'function' && !N.isAuthenticated()) {
      window.location.replace('app.stand/index.html');
      return;
    }

    // Build user profile
    const sess = (N.getSession ? N.getSession() : null) || {};
    S.user = {
      displayName: sess.displayName || sess.email || 'Worship Team',
      email:       sess.email || '',
      role:        sess.role || 'member',
    };

    // Authenticate with Firebase so UpperRoom.isReady() → true
    // and the Shofar can use Firestore instead of falling back to GAS.
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.init === 'function') {
        await UR.init();
        await UR.authenticate();
      }
    } catch (fbErr) {
      console.warn('[MusicStand] Firebase auth best-effort failed:', fbErr.message);
    }

    _launchApp();
  } catch (err) {
    console.error('[MusicStand] boot() error:', err);
    _showBootError('Failed to load: ' + err.message);
  }
}

/* ── Auth gate ────────────────────────────────────────────────────────────── */
function _renderAuthGate(N) {
  const bootEl = document.getElementById('ms-boot');
  if (bootEl) bootEl.style.display = 'none';

  const overlay = document.getElementById('ms-auth-overlay');
  overlay.removeAttribute('hidden'); overlay.style.display = ''
  overlay.innerHTML = `
    <div class="ms-auth-card">
      <img src="Images/stand.png" alt="Music Stand">
      <h1>Music Stand</h1>
      <p>Sign in with your FlockOS account to access the worship team music stand.</p>
      <button class="ms-btn ms-btn--primary" id="ms-signin-btn" style="margin-bottom:12px;">Sign In to FlockOS</button>
      <p style="font-size:.75rem;color:var(--ms-ink-muted);">Access is limited to authenticated FlockOS users.</p>
      <p style="font-size:.7rem;color:var(--ms-ink-faint);margin-top:20px;font-style:italic;">"Praise Him with the sound of the trumpet." — Psalm 150:3</p>
    </div>
  `;
  document.getElementById('ms-signin-btn').addEventListener('click', () => {
    // Delegate to Nehemiah's login flow (the_garments overlay)
    if (N && typeof N.login === 'function') {
      // redirect-based login
      const returnUrl = encodeURIComponent(location.href);
      const base = location.href.replace(/\/app\.stand\/music_stand\.html.*$/, '/');
      location.href = base + 'Scripts/the_priesthood/the_garments.html?return=' + returnUrl;
    } else {
      // Fallback: reload (Nehemiah will redirect)
      location.reload();
    }
  });
}

function _showBootError(msg) {
  const bootEl = document.getElementById('ms-boot');
  if (bootEl) {
    bootEl.style.display = 'flex';
    const lbl = bootEl.querySelector('.ms-boot-label');
    const ico = bootEl.querySelector('.ms-boot-icon');
    if (lbl) lbl.textContent = msg;
    if (ico) ico.textContent = '⚠️';
  }
}

/* ── Launch app after auth ────────────────────────────────────────────────── */
function _launchApp() {
  // Hide boot (use style.display — CSS display:flex overrides the hidden attribute)
  const bootEl = document.getElementById('ms-boot');
  if (bootEl) bootEl.style.display = 'none';

  // Show app
  const appEl = document.getElementById('ms-app');
  if (appEl) { appEl.removeAttribute('hidden'); appEl.style.display = ''; }

  // Restore last plan id
  try { S.activePlanId = localStorage.getItem(STORE_KEY_PLAN_ID) || null; } catch (_) {}

  // Wire global UI
  _wireHeader();
  _wireNav();

  // Apply font size pref
  document.documentElement.style.setProperty('--ms-song-fs', S.prefs.defaultFontSize + 'px');

  // Navigate to initial view
  const urlView = new URLSearchParams(location.search).get('view') || 'dashboard';
  _navigate(urlView);
}

/* ── Header ───────────────────────────────────────────────────────────────── */
function _wireHeader() {
  // Account name
  const nameEl = document.getElementById('ms-account-name');
  if (nameEl && S.user) nameEl.textContent = S.user.displayName || 'Account';

  // Account button → sign out
  const acctBtn = document.getElementById('ms-account-btn');
  if (acctBtn) {
    acctBtn.addEventListener('click', () => {
      _signOutAndRedirect();
    });
  }

  // Live button
  const liveBtn = document.getElementById('ms-live-btn');
  if (liveBtn) liveBtn.addEventListener('click', () => _navigate('live'));

  // Settings button
  const settingsBtn = document.getElementById('ms-settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', () => _navigate('settings'));

  // Mobile menu toggle
  const menuToggle = document.getElementById('ms-menu-toggle');
  const sidebar = document.getElementById('ms-sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('is-open'));
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('is-open');
      }
    });
  }
}

/* ── Navigation ───────────────────────────────────────────────────────────── */
function _wireNav() {
  document.querySelectorAll('[data-view],[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      const action = btn.dataset.action;
      if (action === 'live') { _navigate('live'); return; }
      if (view) _navigate(view);
      // close sidebar on mobile
      document.getElementById('ms-sidebar')?.classList.remove('is-open');
    });
  });
}

function _navigate(view) {
  S.view = view;

  // Update active states in sidebar and bottom nav
  document.querySelectorAll('.ms-nav-item[data-view],.ms-bnav-item[data-view]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.view === view);
  });

  if (view === 'live') {
    _openLiveMode();
    return;
  }

  const main = document.getElementById('ms-main');
  if (!main) return;
  main.scrollTop = 0;

  switch (view) {
    case 'dashboard': _renderDashboard(main); break;
    case 'songs':     _renderSongs(main);     break;
    case 'services':  _renderServices(main);  break;
    case 'import':    _renderImport(main);     break;
    case 'settings':  _renderSettings(main);  break;
    default:          _renderDashboard(main);
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: DASHBOARD
   ══════════════════════════════════════════════════════════════════════════════ */

async function _renderDashboard(main) {
  main.innerHTML = `
    <div class="ms-view">
      <div class="ms-page-hero">
        <div class="ms-page-hero-text">
          <h1>Dashboard</h1>
          <p>Welcome back, ${_e(S.user?.displayName || 'Worship Team')}. Here's your week at a glance.</p>
        </div>
        <div class="ms-page-hero-actions">
          <button class="ms-btn ms-btn--primary" id="db-new-service-btn">+ New Service Plan</button>
        </div>
      </div>
      <div class="ms-stats-grid" id="db-stats"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex-wrap:wrap;" id="db-cols">
        <div>
          <div class="ms-section-title">Upcoming Services</div>
          <div class="ms-upcoming-list" id="db-upcoming"><div class="ms-loading-center"><div class="ms-spinner"></div></div></div>
        </div>
        <div>
          <div class="ms-section-title">Quick Actions</div>
          <div style="display:flex;flex-direction:column;gap:10px;" id="db-actions">
            <button class="ms-btn ms-btn--ghost" data-view="songs" style="justify-content:flex-start;gap:12px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              Browse Song Library
            </button>
            <button class="ms-btn ms-btn--ghost" data-view="import" style="justify-content:flex-start;gap:12px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Import a Song
            </button>
            <button class="ms-btn ms-btn--ghost" id="db-live-quick" style="justify-content:flex-start;gap:12px;color:var(--ms-rose);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>
              Enter Live Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Re-wire inline nav buttons
  main.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => _navigate(btn.dataset.view));
  });
  main.querySelector('#db-live-quick')?.addEventListener('click', () => _navigate('live'));
  main.querySelector('#db-new-service-btn')?.addEventListener('click', () => _openServiceEditor(null));

  // Load stats + upcoming
  await _loadDashboardData(main);
}

async function _loadDashboardData(main) {
  let plans = [], songs = [];

  try {
    if (_fb()) {
      [plans, songs] = await Promise.all([
        UpperRoom.listServicePlans ? UpperRoom.listServicePlans() : Promise.resolve([]),
        UpperRoom.listSongs ? UpperRoom.listSongs() : Promise.resolve([]),
      ]);
      S.plans = plans || [];
      S.songs = songs || [];
    }
  } catch (_) { /* graceful */ }

  // Stats
  const statsEl = main.querySelector('#db-stats');
  if (statsEl) {
    const upcoming = S.plans.filter(p => {
      try { return new Date(p.serviceDate) >= new Date(); } catch { return false; }
    }).length;
    statsEl.innerHTML = `
      <div class="ms-stat-card" style="--stat-color:var(--ms-gold)">
        <div class="ms-stat-num">${S.songs.length || '—'}</div>
        <div class="ms-stat-label">Songs in Library</div>
      </div>
      <div class="ms-stat-card" style="--stat-color:var(--ms-blue)">
        <div class="ms-stat-num">${S.plans.length || '—'}</div>
        <div class="ms-stat-label">Service Plans</div>
      </div>
      <div class="ms-stat-card" style="--stat-color:var(--ms-emerald)">
        <div class="ms-stat-num">${upcoming || '—'}</div>
        <div class="ms-stat-label">Upcoming Services</div>
      </div>
      <div class="ms-stat-card" style="--stat-color:var(--ms-violet)">
        <div class="ms-stat-num">∞</div>
        <div class="ms-stat-label">Keys Available</div>
      </div>
    `;
  }

  // Upcoming list
  const upcomingEl = main.querySelector('#db-upcoming');
  if (upcomingEl) {
    const now = new Date();
    const upcoming = S.plans
      .filter(p => { try { return new Date(p.serviceDate) >= now; } catch { return true; } })
      .sort((a, b) => new Date(a.serviceDate) - new Date(b.serviceDate))
      .slice(0, 5);

    if (!upcoming.length) {
      upcomingEl.innerHTML = `
        <div class="ms-empty-state" style="padding:32px 16px;">
          <div class="ms-empty-state-icon">📅</div>
          <div class="ms-empty-state-title">No upcoming services</div>
          <div class="ms-empty-state-body">Create a service plan to start building your setlist.</div>
        </div>`;
    } else {
      upcomingEl.innerHTML = upcoming.map(p => `
        <button class="ms-service-card" data-plan-id="${_e(p.id)}" style="text-align:left;width:100%;font-family:inherit;border:none;cursor:pointer;">
          <div class="ms-service-card-header">
            <div class="ms-service-card-title">${_e(p.serviceType || 'Service')}</div>
            <div class="ms-service-card-date">${_fmtDate(p.serviceDate)}</div>
          </div>
          ${(p.songs || p.setlist || []).length ? `
          <div class="ms-service-card-songs">
            ${(p.songs || p.setlist || []).slice(0,4).map(s => `
              <div class="ms-service-song-row">
                <span class="ms-key-badge">${_e((s.key||s.defaultKey||'—').substring(0,2))}</span>
                <span>${_e(s.title||s.songTitle||'Untitled')}</span>
              </div>`).join('')}
            ${(p.songs||p.setlist||[]).length > 4 ? `<div style="font-size:.75rem;color:var(--ms-ink-faint);padding:2px 0">+${(p.songs||p.setlist||[]).length-4} more</div>` : ''}
          </div>` : '<div style="font-size:.8rem;color:var(--ms-ink-faint);margin-top:8px;">No songs added yet</div>'}
        </button>
      `).join('');
      upcomingEl.querySelectorAll('.ms-service-card').forEach(card => {
        card.addEventListener('click', () => {
          S.activePlanId = card.dataset.planId;
          try { localStorage.setItem(STORE_KEY_PLAN_ID, S.activePlanId); } catch {}
          _navigate('services');
        });
      });
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: SONGS LIBRARY (delegates to The Shofar)
   ══════════════════════════════════════════════════════════════════════════════ */

function _renderSongs(main) {
  // The Shofar expects a container with id="ms-app-container".
  // Wrap it in .ms-view so it inherits the same side padding as every other view.
  main.innerHTML = `<div class="ms-view"><div id="ms-app-container"></div></div>`;
  // Give the DOM a tick to settle, then let The Shofar take over
  requestAnimationFrame(() => {
    try { window.openMusicStandApp(); } catch (err) {
      console.error('[MusicStand] The Shofar failed to open:', err);
      main.innerHTML = `
        <div class="ms-view">
          <div class="ms-empty-state">
            <div class="ms-empty-state-icon">🎵</div>
            <div class="ms-empty-state-title">Song Library unavailable</div>
            <div class="ms-empty-state-body">${_e(err.message)}</div>
          </div>
        </div>`;
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: SERVICE PLANS
   ══════════════════════════════════════════════════════════════════════════════ */

async function _renderServices(main) {
  main.innerHTML = `
    <div class="ms-view">
      <div class="ms-page-hero">
        <div class="ms-page-hero-text">
          <h1>Service Plans</h1>
          <p>Build and manage your worship setlists, team notes, and service orders.</p>
        </div>
        <div class="ms-page-hero-actions">
          <button class="ms-btn ms-btn--primary" id="svc-new-btn">+ New Service Plan</button>
        </div>
      </div>
      <div id="svc-list"><div class="ms-loading-center"><div class="ms-spinner"></div></div></div>
    </div>
  `;

  main.querySelector('#svc-new-btn')?.addEventListener('click', () => _openServiceEditor(null));
  await _loadAndRenderPlans(main);
}

async function _loadAndRenderPlans(main) {
  const listEl = main.querySelector('#svc-list');
  if (!listEl) return;
  try {
    let plans = S.plans;
    if (!plans.length && _fb()) {
      plans = (await UpperRoom.listServicePlans?.()) || [];
      S.plans = plans;
    }
    if (!plans.length) {
      listEl.innerHTML = `
        <div class="ms-empty-state">
          <div class="ms-empty-state-icon">📅</div>
          <div class="ms-empty-state-title">No service plans yet</div>
          <div class="ms-empty-state-body">Create your first service plan to start building a setlist with chord charts, keys, and team notes.</div>
          <button class="ms-btn ms-btn--primary" style="margin-top:8px" id="svc-empty-new">Create First Plan</button>
        </div>`;
      listEl.querySelector('#svc-empty-new')?.addEventListener('click', () => _openServiceEditor(null));
      return;
    }
    const sorted = [...plans].sort((a, b) => new Date(b.serviceDate||0) - new Date(a.serviceDate||0));
    listEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">
      ${sorted.map(p => {
        const songs = p.songs || p.setlist || [];
        const isActive = p.id === S.activePlanId;
        return `<div class="ms-service-card${isActive ? ' is-active' : ''}" data-plan-id="${_e(p.id)}"
          style="cursor:pointer;text-align:left;${isActive ? 'border-color:var(--ms-gold);' : ''}">
          <div class="ms-service-card-header">
            <div>
              <div class="ms-service-card-title">${_e(p.serviceType || 'Service')}</div>
              <div style="font-size:.75rem;color:var(--ms-ink-muted);margin-top:2px;">${_e(p.theme||p.seriesTitle||'')}</div>
            </div>
            <div style="text-align:right">
              <div class="ms-service-card-date">${_fmtDate(p.serviceDate)}</div>
              ${isActive ? '<div style="font-size:.68rem;color:var(--ms-gold);font-weight:700;margin-top:2px;">ACTIVE</div>' : ''}
            </div>
          </div>
          <div class="ms-service-card-songs">
            ${songs.slice(0,5).map(s => `
              <div class="ms-service-song-row">
                <span class="ms-key-badge">${_e((s.key||s.defaultKey||'?').substring(0,2))}</span>
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_e(s.title||s.songTitle||'Untitled')}</span>
                ${s.tempoBpm||s.bpm ? `<span class="ms-tempo-badge">${s.tempoBpm||s.bpm} bpm</span>` : ''}
              </div>`).join('')}
            ${songs.length > 5 ? `<div style="font-size:.73rem;color:var(--ms-ink-faint)">+${songs.length-5} more songs</div>` : ''}
            ${!songs.length ? '<div style="font-size:.78rem;color:var(--ms-ink-faint);padding:4px 0">No songs yet — tap to add</div>' : ''}
          </div>
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
            <button class="ms-btn ms-btn--ghost ms-btn--sm svc-edit-btn" data-plan-id="${_e(p.id)}">Edit</button>
            <button class="ms-btn ms-btn--ghost ms-btn--sm svc-live-btn" data-plan-id="${_e(p.id)}" style="color:var(--ms-rose);">▶ Live</button>
            <button class="ms-btn ms-btn--danger ms-btn--sm svc-del-btn" data-plan-id="${_e(p.id)}">Delete</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;

    listEl.querySelectorAll('[data-plan-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const id = el.dataset.planId;
        S.activePlanId = id;
        try { localStorage.setItem(STORE_KEY_PLAN_ID, id); } catch {}
        _toast('Service plan selected', 'success');
        _renderServices(main);
      });
    });
    listEl.querySelectorAll('.svc-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const plan = S.plans.find(p => p.id === btn.dataset.planId);
        if (plan) _openServiceEditor(plan);
      });
    });
    listEl.querySelectorAll('.svc-live-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        S.activePlanId = btn.dataset.planId;
        try { localStorage.setItem(STORE_KEY_PLAN_ID, S.activePlanId); } catch {}
        _navigate('live');
      });
    });
    listEl.querySelectorAll('.svc-del-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const plan = S.plans.find(p => p.id === btn.dataset.planId);
        if (!plan) return;
        if (!confirm(`Delete "${plan.serviceType || 'Service Plan'}" on ${_fmtDate(plan.serviceDate)}?`)) return;
        try {
          if (_fb() && UpperRoom.deleteServicePlan) await UpperRoom.deleteServicePlan(plan.id);
          S.plans = S.plans.filter(p => p.id !== plan.id);
          _toast('Plan deleted', 'success');
          _renderServices(main);
        } catch (err) { _toast('Delete failed: ' + err.message, 'error'); }
      });
    });
  } catch (err) {
    listEl.innerHTML = `<div class="ms-empty-state"><div class="ms-empty-state-title">Could not load plans</div><div class="ms-empty-state-body">${_e(err.message)}</div></div>`;
  }
}

/* ── Service Plan Editor (sheet) ──────────────────────────────────────────── */
function _openServiceEditor(plan) {
  const host = document.getElementById('ms-sheet-host');
  if (!host) return;
  const isEdit = !!plan;
  const p = plan || {};
  const songs = p.songs || p.setlist || [];

  host.innerHTML = `
    <div class="ms-modal-backdrop" id="svc-editor-backdrop">
      <div class="ms-modal" style="max-width:680px;">
        <div class="ms-modal-title">${isEdit ? 'Edit Service Plan' : 'New Service Plan'}</div>
        <div class="ms-row" style="margin-bottom:12px;">
          <div class="ms-field">
            <div class="ms-label">Date</div>
            <input class="ms-input" type="date" id="svc-f-date" value="${_e(p.serviceDate||'')}">
          </div>
          <div class="ms-field">
            <div class="ms-label">Service Type</div>
            <select class="ms-select" id="svc-f-type">
              ${['Sunday Morning','Sunday Evening','Wednesday Night','Special Service','Rehearsal','Other'].map(t =>
                `<option${(p.serviceType||'Sunday Morning')===t?' selected':''}>${t}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="ms-field" style="margin-bottom:12px;">
          <div class="ms-label">Theme / Series</div>
          <input class="ms-input" type="text" id="svc-f-theme" value="${_e(p.theme||p.seriesTitle||'')}" placeholder="e.g. Kingdom Come — Week 3">
        </div>
        <div class="ms-label" style="margin-bottom:8px;">Songs</div>
        <div class="ms-setlist" id="svc-setlist">
          ${songs.map((s, i) => _setlistItemHtml(s, i)).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
          <div class="ms-search-wrap" style="flex:1">
            <svg class="ms-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input class="ms-search" type="text" id="svc-song-search" placeholder="Search songs to add…">
          </div>
        </div>
        <div id="svc-song-results" class="ms-song-picker-results"></div>
        <div class="ms-modal-actions">
          <button class="ms-btn ms-btn--ghost" id="svc-editor-cancel">Cancel</button>
          <button class="ms-btn ms-btn--primary" id="svc-editor-save">${isEdit ? 'Save Changes' : 'Create Plan'}</button>
        </div>
      </div>
    </div>
  `;

  // Working copy of songs array
  let _songs = [...songs];

  function _rebuildSetlist() {
    document.getElementById('svc-setlist').innerHTML = _songs.map(_setlistItemHtml).join('');
    document.querySelectorAll('.ms-setlist-remove').forEach((btn, i) => {
      btn.addEventListener('click', () => { _songs.splice(i, 1); _rebuildSetlist(); });
    });
  }
  _rebuildSetlist();

  // Song search
  const searchInput = document.getElementById('svc-song-search');
  const resultsEl = document.getElementById('svc-song-results');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) { resultsEl.innerHTML = ''; return; }
    const matches = S.songs.filter(s =>
      (s.title||'').toLowerCase().includes(q) || (s.artist||'').toLowerCase().includes(q)
    ).slice(0, 12);
    resultsEl.innerHTML = matches.map(s => `
      <button class="ms-song-pick-btn" data-song-id="${_e(s.id)}">
        <span class="ms-key-badge">${_e((s.defaultKey||'?').substring(0,2))}</span>
        <span style="flex:1">
          <span style="font-weight:600">${_e(s.title)}</span>
          <span style="color:var(--ms-ink-muted);font-size:.78rem;margin-left:6px">${_e(s.artist||'')}</span>
        </span>
        <span style="color:var(--ms-ink-faint);font-size:.75rem">${s.tempoBpm ? s.tempoBpm+' bpm' : ''}</span>
      </button>`).join('') || '<div style="color:var(--ms-ink-muted);padding:10px;font-size:.85rem">No songs found</div>';
    resultsEl.querySelectorAll('.ms-song-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const song = S.songs.find(s => s.id === btn.dataset.songId);
        if (!song) return;
        _songs.push({ songId: song.id, title: song.title, artist: song.artist||'', key: song.defaultKey||'C', tempoBpm: song.tempoBpm||'' });
        _rebuildSetlist();
        searchInput.value = '';
        resultsEl.innerHTML = '';
        _toast(`Added "${song.title}"`, 'success');
      });
    });
  });

  // Close / cancel
  document.getElementById('svc-editor-cancel').addEventListener('click', () => { host.innerHTML = ''; });
  document.getElementById('svc-editor-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'svc-editor-backdrop') host.innerHTML = '';
  });

  // Save
  document.getElementById('svc-editor-save').addEventListener('click', async () => {
    const payload = {
      serviceDate:  document.getElementById('svc-f-date').value,
      serviceType:  document.getElementById('svc-f-type').value,
      theme:        document.getElementById('svc-f-theme').value.trim(),
      songs:        _songs,
    };
    const btn = document.getElementById('svc-editor-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (_fb()) {
        if (isEdit && p.id) {
          await UpperRoom.updateServicePlan?.({ id: p.id, ...payload });
          const idx = S.plans.findIndex(x => x.id === p.id);
          if (idx !== -1) S.plans[idx] = { ...S.plans[idx], ...payload };
        } else {
          const result = await UpperRoom.createServicePlan?.(payload);
          if (result) S.plans.unshift({ ...payload, id: result.id || result });
        }
      }
      host.innerHTML = '';
      _toast(isEdit ? 'Plan updated' : 'Plan created', 'success');
      _navigate('services');
    } catch (err) {
      btn.disabled = false; btn.textContent = isEdit ? 'Save Changes' : 'Create Plan';
      _toast('Save failed: ' + err.message, 'error');
    }
  });
}

function _setlistItemHtml(s, i) {
  return `
    <div class="ms-setlist-item">
      <span class="ms-setlist-grip">⠿</span>
      <span class="ms-setlist-num">${i + 1}</span>
      <div class="ms-setlist-info">
        <div class="ms-setlist-title">${_e(s.title||s.songTitle||'Untitled')}</div>
        <div class="ms-setlist-artist">${_e(s.artist||'')}</div>
      </div>
      <div class="ms-setlist-right">
        <input class="ms-setlist-key-input" type="text" value="${_e(s.key||s.defaultKey||'C')}" maxlength="3" title="Service key">
        <button class="ms-btn ms-btn--ghost ms-btn--icon ms-setlist-remove" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: IMPORT
   ══════════════════════════════════════════════════════════════════════════════ */

function _renderImport(main) {
  main.innerHTML = `
    <div class="ms-view">
      <div class="ms-page-hero">
        <div class="ms-page-hero-text">
          <h1>Import Songs</h1>
          <p>Bring songs in from CCLI SongSelect, Planning Center, or paste raw ChordPro.</p>
        </div>
      </div>

      <div class="ms-import-tabs" id="imp-tabs">
        <button class="ms-import-tab is-active" data-tab="chordpro">ChordPro / SongSelect</button>
        <button class="ms-import-tab" data-tab="planning-center">Planning Center</button>
        <button class="ms-import-tab" data-tab="manual">Manual Entry</button>
      </div>

      <!-- ChordPro / SongSelect -->
      <div class="ms-import-panel is-active" id="imp-panel-chordpro">
        <div class="ms-import-source-grid">
          <div class="ms-import-source is-selected" data-source="songselect">
            <div class="ms-import-source-icon">🎵</div>
            <div class="ms-import-source-name">CCLI SongSelect</div>
            <div class="ms-import-source-desc">Paste the exported ChordPro file from SongSelect</div>
          </div>
          <div class="ms-import-source" data-source="planning-center-cp">
            <div class="ms-import-source-icon">📋</div>
            <div class="ms-import-source-name">Planning Center</div>
            <div class="ms-import-source-desc">Copy the chord chart from a PCO song</div>
          </div>
          <div class="ms-import-source" data-source="ultimate-guitar">
            <div class="ms-import-source-icon">🎸</div>
            <div class="ms-import-source-name">Ultimate Guitar</div>
            <div class="ms-import-source-desc">Paste a UG chord tab (auto-converted)</div>
          </div>
          <div class="ms-import-source" data-source="any-chordpro">
            <div class="ms-import-source-icon">📄</div>
            <div class="ms-import-source-name">Any ChordPro</div>
            <div class="ms-import-source-desc">Any .cho / .chopro file or raw text</div>
          </div>
        </div>

        <div class="ms-field" style="margin-bottom:16px;">
          <div class="ms-label">Paste Chord Chart</div>
          <textarea class="ms-input ms-textarea ms-content-editor" id="imp-cp-text" rows="14"
            placeholder="{title: Amazing Grace}&#10;{artist: John Newton}&#10;{key: G}&#10;{ccli: 4768151}&#10;&#10;{comment: Verse 1}&#10;[G]Amazing [C]grace how [G]sweet the sound&#10;That [G]saved a [Em]wretch like [D]me&#10;&#10;{comment: Chorus}&#10;[G]My chains are [D]gone..."></textarea>
        </div>
        <div id="imp-cp-preview" hidden style="margin-bottom:16px;"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="ms-btn ms-btn--ghost" id="imp-cp-parse">Preview</button>
          <button class="ms-btn ms-btn--primary" id="imp-cp-save" hidden>Save to Library</button>
        </div>
      </div>

      <!-- Planning Center OAuth -->
      <div class="ms-import-panel" id="imp-panel-planning-center">
        <div class="ms-card" style="max-width:520px;">
          <div style="font-size:1.4rem;margin-bottom:12px;">📋</div>
          <div style="font-weight:700;font-size:1rem;margin-bottom:8px;">Planning Center Online</div>
          <p style="color:var(--ms-ink-muted);font-size:.88rem;line-height:1.6;margin-bottom:16px;">
            Connect your Planning Center account to import service plans and songs directly. Your PCO data syncs automatically when you add songs to a service.
          </p>
          <p style="font-size:.8rem;color:var(--ms-ink-faint);margin-bottom:16px;line-height:1.5;">
            <strong style="color:var(--ms-ink)">How it works:</strong> FlockOS reads your PCO song library (read-only). It never writes to Planning Center. You stay in control.
          </p>
          <button class="ms-btn ms-btn--primary" id="imp-pco-connect">Connect Planning Center</button>
          <p style="font-size:.72rem;color:var(--ms-ink-faint);margin-top:12px;">Requires a Planning Center account with Songs access.</p>
        </div>

        <div style="margin-top:28px;">
          <div class="ms-label" style="margin-bottom:12px;">Or paste a Planning Center chord sheet</div>
          <textarea class="ms-input ms-textarea ms-content-editor" id="imp-pco-text" rows="10" placeholder="Paste the chord chart text from Planning Center here…"></textarea>
          <div style="margin-top:10px;display:flex;gap:10px;">
            <button class="ms-btn ms-btn--ghost" id="imp-pco-parse">Parse &amp; Preview</button>
          </div>
          <div id="imp-pco-preview" hidden style="margin-top:12px;"></div>
          <button class="ms-btn ms-btn--primary" id="imp-pco-save" hidden style="margin-top:10px;">Save to Library</button>
        </div>
      </div>

      <!-- Manual Entry -->
      <div class="ms-import-panel" id="imp-panel-manual">
        <div class="ms-editor-layout">
          <div class="ms-editor-col">
            <div class="ms-row">
              <div class="ms-field">
                <div class="ms-label">Song Title *</div>
                <input class="ms-input" type="text" id="imp-m-title" placeholder="Amazing Grace">
              </div>
              <div class="ms-field">
                <div class="ms-label">Artist / Author</div>
                <input class="ms-input" type="text" id="imp-m-artist" placeholder="John Newton">
              </div>
            </div>
            <div class="ms-row">
              <div class="ms-field">
                <div class="ms-label">Default Key</div>
                <select class="ms-select" id="imp-m-key">${_keyOptions('G')}</select>
              </div>
              <div class="ms-field">
                <div class="ms-label">Tempo (BPM)</div>
                <input class="ms-input" type="number" id="imp-m-bpm" min="0" max="300" placeholder="72">
              </div>
              <div class="ms-field">
                <div class="ms-label">Time Sig</div>
                <select class="ms-select" id="imp-m-time">
                  ${['4/4','3/4','6/8','2/4','6/4','12/8'].map(t => `<option>${t}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="ms-row">
              <div class="ms-field">
                <div class="ms-label">CCLI Number</div>
                <input class="ms-input" type="text" id="imp-m-ccli" placeholder="4768151">
              </div>
              <div class="ms-field">
                <div class="ms-label">Genre</div>
                <input class="ms-input" type="text" id="imp-m-genre" placeholder="Contemporary, Hymn…">
              </div>
            </div>
            <div class="ms-field">
              <div class="ms-label">Chord Sheet (ChordPro)</div>
              <div class="ms-field-hint">Use [G], [Am], [C/E] inline before the syllable they fall on</div>
              <textarea class="ms-input ms-textarea ms-content-editor" id="imp-m-chords" rows="12"
                placeholder="{comment: Verse 1}&#10;[G]Amazing [C]grace how [G]sweet the sound&#10;That [G]saved a [Em]wretch like [D]me&#10;&#10;{comment: Chorus}&#10;[G]My chains are [D]gone..."></textarea>
            </div>
            <div class="ms-field">
              <div class="ms-label">Notes</div>
              <textarea class="ms-input ms-textarea" id="imp-m-notes" rows="3" placeholder="Performance notes, key recommendations, etc."></textarea>
            </div>
            <div style="display:flex;gap:10px;">
              <button class="ms-btn ms-btn--ghost" id="imp-m-preview-btn">Preview</button>
              <button class="ms-btn ms-btn--primary" id="imp-m-save">Save to Library</button>
            </div>
          </div>
          <div class="ms-editor-col">
            <div class="ms-label" style="margin-bottom:8px">Live Preview</div>
            <div class="ms-content-preview ms-song-content" id="imp-m-preview" style="min-height:500px;--ms-song-fs:15px">
              <div class="ms-empty-content">Click "Preview" to see the rendered chart</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Tab switching
  main.querySelectorAll('.ms-import-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      main.querySelectorAll('.ms-import-tab').forEach(t => t.classList.remove('is-active'));
      main.querySelectorAll('.ms-import-panel').forEach(p => p.classList.remove('is-active'));
      tab.classList.add('is-active');
      main.querySelector(`#imp-panel-${tab.dataset.tab}`)?.classList.add('is-active');
    });
  });

  // Source selection
  main.querySelectorAll('.ms-import-source').forEach(src => {
    src.addEventListener('click', () => {
      main.querySelectorAll('.ms-import-source').forEach(s => s.classList.remove('is-selected'));
      src.classList.add('is-selected');
    });
  });

  // ChordPro parse + save
  let _cpParsed = null;
  main.querySelector('#imp-cp-parse')?.addEventListener('click', () => {
    const text = main.querySelector('#imp-cp-text').value;
    _cpParsed = _parseChordPro(text);
    _showImportPreview(main.querySelector('#imp-cp-preview'), _cpParsed, text);
    main.querySelector('#imp-cp-save').hidden = !_cpParsed.title;
  });
  main.querySelector('#imp-cp-save')?.addEventListener('click', async () => {
    if (!_cpParsed) return;
    await _saveParsedSong(_cpParsed, main.querySelector('#imp-cp-save'));
  });

  // PCO paste parse + save
  let _pcoParsed = null;
  main.querySelector('#imp-pco-parse')?.addEventListener('click', () => {
    const text = main.querySelector('#imp-pco-text').value;
    _pcoParsed = _parseChordPro(text);
    _showImportPreview(main.querySelector('#imp-pco-preview'), _pcoParsed, text);
    main.querySelector('#imp-pco-save').hidden = !_pcoParsed.title;
  });
  main.querySelector('#imp-pco-save')?.addEventListener('click', async () => {
    if (!_pcoParsed) return;
    await _saveParsedSong(_pcoParsed, main.querySelector('#imp-pco-save'));
  });

  // PCO connect (placeholder — OAuth would be a backend feature)
  main.querySelector('#imp-pco-connect')?.addEventListener('click', () => {
    _toast('Planning Center OAuth coming soon. Use the paste method below for now.', 'info');
  });

  // Manual preview
  main.querySelector('#imp-m-preview-btn')?.addEventListener('click', () => {
    const text = main.querySelector('#imp-m-chords').value;
    const previewEl = main.querySelector('#imp-m-preview');
    previewEl.innerHTML = _renderChordPro(text, { showChords: S.prefs.showChords });
  });

  // Manual save
  main.querySelector('#imp-m-save')?.addEventListener('click', async () => {
    const title = main.querySelector('#imp-m-title').value.trim();
    if (!title) { main.querySelector('#imp-m-title').focus(); _toast('Title is required', 'error'); return; }
    const keyVal = main.querySelector('#imp-m-key').value;
    const payload = {
      title,
      artist:        main.querySelector('#imp-m-artist').value.trim(),
      defaultKey:    keyVal,
      chordSheetKey: keyVal,
      chordSheet:    main.querySelector('#imp-m-chords').value,
      tempoBpm:      main.querySelector('#imp-m-bpm').value || '0',
      timeSignature: main.querySelector('#imp-m-time').value,
      ccliNumber:    main.querySelector('#imp-m-ccli').value.trim(),
      genre:         main.querySelector('#imp-m-genre').value.trim(),
      notes:         main.querySelector('#imp-m-notes').value.trim(),
      active:        'TRUE',
    };
    const btn = main.querySelector('#imp-m-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (_fb() && UpperRoom.createSong) await UpperRoom.createSong(payload);
      S.songs = [];  // invalidate cache
      _toast(`"${title}" saved to library`, 'success');
      btn.disabled = false; btn.textContent = 'Save to Library';
      _navigate('songs');
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Save to Library';
      _toast('Save failed: ' + err.message, 'error');
    }
  });
}

function _parseChordPro(text) {
  const result = { title: '', artist: '', key: '', ccliNumber: '', bpm: '', timeSignature: '', capo: '', chordSheet: text, sections: 0 };
  if (!text) return result;
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(/^\{([\w\-]+):\s*(.+?)\s*\}$/i);
    if (m) {
      const [, k, v] = m;
      const lk = k.toLowerCase();
      if (lk === 'title' || lk === 't')                               result.title = v;
      else if (lk === 'artist' || lk === 'a' || lk === 'composer')   result.artist = v;
      else if (lk === 'key')                                          result.key = v;
      else if (lk === 'capo')                                         result.capo = v;
      else if (lk === 'tempo' || lk === 'bpm')                       result.bpm = v;
      else if (lk === 'time')                                         result.timeSignature = v;
      else if (lk === 'ccli')                                         result.ccliNumber = v;
      else if (lk === 'comment' || lk === 'c')                        result.sections++;
    }
  }
  if (!result.title) {
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const l = lines[i].trim();
      if (l && !l.startsWith('{') && !l.startsWith('[') && l.length < 80) { result.title = l; break; }
    }
  }
  return result;
}

function _showImportPreview(el, parsed, rawText) {
  el.hidden = false;
  el.innerHTML = `
    <div style="background:var(--ms-gold-soft);border:1px solid var(--ms-gold-glow);border-radius:var(--ms-r-lg);padding:16px;margin-bottom:12px;">
      <div style="font-size:.75rem;font-weight:700;color:var(--ms-gold);letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;">Parsed</div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 16px;font-size:.88rem;">
        <span style="color:var(--ms-ink-muted)">Title</span><span style="font-weight:700">${_e(parsed.title||'—')}</span>
        <span style="color:var(--ms-ink-muted)">Artist</span><span>${_e(parsed.artist||'—')}</span>
        <span style="color:var(--ms-ink-muted)">Key</span><span style="color:var(--ms-gold);font-weight:700">${_e(parsed.key||'—')}</span>
        <span style="color:var(--ms-ink-muted)">CCLI</span><span>${_e(parsed.ccliNumber||'—')}</span>
        <span style="color:var(--ms-ink-muted)">Sections</span><span>${parsed.sections||0}</span>
      </div>
    </div>
    <div style="font-size:.8rem;color:var(--ms-ink-muted);margin-bottom:8px;">Chart preview</div>
    <div class="ms-song-content" style="--ms-song-fs:14px;max-height:300px;overflow-y:auto;background:var(--ms-bg-card);padding:14px;border-radius:var(--ms-r-md);">
      ${_renderChordPro(rawText)}
    </div>`;
}

async function _saveParsedSong(parsed, btn) {
  const payload = {
    title:         parsed.title || 'Imported Song',
    artist:        parsed.artist || '',
    defaultKey:    parsed.key || 'C',
    chordSheetKey: parsed.key || 'C',
    chordSheet:    parsed.chordSheet || '',
    ccliNumber:    parsed.ccliNumber || '',
    tempoBpm:      parsed.bpm || '0',
    timeSignature: parsed.timeSignature || '4/4',
    active:        'TRUE',
    notes:         'Imported',
  };
  if (parsed.capo) payload.capo = parsed.capo;
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (_fb() && UpperRoom.createSong) await UpperRoom.createSong(payload);
    S.songs = [];
    _toast(`"${payload.title}" saved to library`, 'success');
    _navigate('songs');
  } catch (err) {
    btn.disabled = false; btn.textContent = 'Save to Library';
    _toast('Save failed: ' + err.message, 'error');
  }
}

function _keyOptions(selected = 'C') {
  const keys = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B',
                 'Cm','C#m','Dm','D#m','Ebm','Em','Fm','F#m','Gm','G#m','Am','A#m','Bbm','Bm'];
  return keys.map(k => `<option${k===selected?' selected':''}>${k}</option>`).join('');
}

/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: SETTINGS
   ══════════════════════════════════════════════════════════════════════════════ */

function _renderSettings(main) {
  main.innerHTML = `
    <div class="ms-view" style="max-width:640px;">
      <div class="ms-page-hero">
        <div class="ms-page-hero-text">
          <h1>Settings</h1>
          <p>Customize your Music Stand experience.</p>
        </div>
      </div>

      <div class="ms-settings-section">
        <h2>Display</h2>
        <div class="ms-field" style="margin-bottom:16px;">
          <div class="ms-label">Default Song Font Size</div>
          <div style="display:flex;align-items:center;gap:12px;">
            <input type="range" id="set-fs" min="13" max="30" step="1" value="${S.prefs.defaultFontSize}" style="flex:1;accent-color:var(--ms-gold)">
            <span id="set-fs-val" style="min-width:32px;font-family:var(--ms-mono);color:var(--ms-gold);font-weight:700">${S.prefs.defaultFontSize}px</span>
          </div>
        </div>
        <div class="ms-field" style="margin-bottom:16px;">
          <label style="display:flex;align-items:center;gap:12px;cursor:pointer;">
            <input type="checkbox" id="set-show-chords" ${S.prefs.showChords ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--ms-gold)">
            <span>Show chord names above lyrics</span>
          </label>
        </div>
        <div class="ms-field" style="margin-bottom:16px;">
          <label style="display:flex;align-items:center;gap:12px;cursor:pointer;">
            <input type="checkbox" id="set-show-diagrams" ${S.prefs.showDiagrams ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--ms-gold)">
            <span>Show chord diagrams (guitar)</span>
          </label>
        </div>
        <div class="ms-field" style="margin-bottom:16px;">
          <label style="display:flex;align-items:center;gap:12px;cursor:pointer;">
            <input type="checkbox" id="set-nns" ${S.prefs.nnsMode ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--ms-gold)">
            <span>Nashville Number System (NNS) mode</span>
          </label>
        </div>
      </div>

      <div class="ms-settings-section">
        <h2>Live Presenter</h2>
        <div class="ms-field" style="margin-bottom:16px;">
          <div class="ms-label">Live Mode Font Size</div>
          <div style="display:flex;align-items:center;gap:12px;">
            <input type="range" id="set-live-fs" min="18" max="60" step="2" value="${S.liveFontSize}" style="flex:1;accent-color:var(--ms-gold)">
            <span id="set-live-fs-val" style="min-width:32px;font-family:var(--ms-mono);color:var(--ms-gold);font-weight:700">${S.liveFontSize}px</span>
          </div>
        </div>
      </div>

      <div class="ms-settings-section">
        <h2>Account</h2>
        <div style="background:var(--ms-bg-card);border:1px solid var(--ms-line);border-radius:var(--ms-r-lg);padding:16px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700">${_e(S.user?.displayName || 'Worship Team')}</div>
            <div style="font-size:.82rem;color:var(--ms-ink-muted)">${_e(S.user?.email || '')}</div>
            <div style="font-size:.75rem;color:var(--ms-ink-faint);margin-top:2px;text-transform:capitalize">${_e(S.user?.role || 'member')}</div>
          </div>
          <button class="ms-btn ms-btn--danger ms-btn--sm" id="set-signout">Sign Out</button>
        </div>
      </div>

      <div style="margin-top:4px;">
        <button class="ms-btn ms-btn--primary" id="set-save">Save Settings</button>
      </div>
    </div>
  `;

  const fsSlider = main.querySelector('#set-fs');
  const fsVal    = main.querySelector('#set-fs-val');
  fsSlider?.addEventListener('input', () => { fsVal.textContent = fsSlider.value + 'px'; });

  const liveFsSlider = main.querySelector('#set-live-fs');
  const liveFsVal    = main.querySelector('#set-live-fs-val');
  liveFsSlider?.addEventListener('input', () => { liveFsVal.textContent = liveFsSlider.value + 'px'; });

  main.querySelector('#set-save')?.addEventListener('click', () => {
    S.prefs.defaultFontSize = parseInt(fsSlider.value, 10);
    S.prefs.showChords      = main.querySelector('#set-show-chords').checked;
    S.prefs.showDiagrams    = main.querySelector('#set-show-diagrams').checked;
    S.prefs.nnsMode         = main.querySelector('#set-nns').checked;
    S.liveFontSize          = parseInt(liveFsSlider.value, 10);
    _savePrefs();
    document.documentElement.style.setProperty('--ms-song-fs', S.prefs.defaultFontSize + 'px');
    document.documentElement.style.setProperty('--ms-live-fs', S.liveFontSize + 'px');
    _toast('Settings saved', 'success');
  });

  main.querySelector('#set-signout')?.addEventListener('click', () => {
    _signOutAndRedirect();
  });
}

/**
 * Sign out from this PWA and return to the church root index.html.
 * Calls Nehemiah.logout() for full session cleanup but overrides its
 * launcher redirect (which assumes the caller lives in /Pages/, not
 * /app.stand/, and otherwise lands on a 404).
 */
function _signOutAndRedirect() {
  // The correct destination relative to <base href="../"> is the church root.
  const target = new URL('./', document.baseURI).toString();

  const N = window.Nehemiah;
  if (N && typeof N.logout === 'function') {
    // Hijack the redirect Nehemiah.logout() will attempt at the end of its
    // 25-second farewell card so it lands on the correct page.
    const _origReplace = window.location.replace.bind(window.location);
    window.location.replace = function () { _origReplace(target); };
    try { N.logout(); } catch (_) { _origReplace(target); }
  } else {
    window.location.replace(target);
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   LIVE PRESENTER MODE
   Full-screen dark presenter for use on stage or projected display.
   Loads the active service plan's setlist and renders chord charts
   with realtime transpose, autoscroll, and metronome.
   ══════════════════════════════════════════════════════════════════════════════ */

let _liveAutoScrollId = null;

async function _openLiveMode() {
  const overlay = document.getElementById('ms-live-overlay');
  overlay.hidden = false;
  document.documentElement.style.setProperty('--ms-live-fs', S.liveFontSize + 'px');

  // Load plan
  let plan = null;
  if (S.activePlanId) {
    plan = S.plans.find(p => p.id === S.activePlanId);
    if (!plan && _fb()) {
      try { plan = await UpperRoom.getServicePlan?.(S.activePlanId); } catch {}
    }
  }

  S.livePlan = plan;
  S.liveIdx = 0;
  S.liveSemitones = 0;
  _renderLiveOverlay(overlay);
}

function _closeLiveMode() {
  const overlay = document.getElementById('ms-live-overlay');
  overlay.hidden = true;
  _stopAutoscroll();
  _stopMetronome();
}

function _renderLiveOverlay(overlay) {
  const plan = S.livePlan;
  const songs = plan ? (plan.songs || plan.setlist || []) : [];
  const total = songs.length;
  const idx   = S.liveIdx;
  const song  = songs[idx];

  let chordHtml = '';
  if (song) {
    // Get full song content if available in songs cache
    const full = S.songs.find(s => s.id === song.songId || s.title === song.title);
    const rawText = full?.chordSheet || song.chordSheet || song.lyricsWithChords || '';
    const transposed = rawText ? _transposeChordPro(rawText, S.liveSemitones) : '';
    chordHtml = transposed ? _renderChordPro(transposed, { showChords: S.prefs.showChords }) : `<div class="ms-empty-content" style="color:rgba(255,255,255,.4)">No chord chart for this song.</div>`;
  } else if (!plan) {
    chordHtml = `<div class="ms-empty-content" style="color:rgba(255,255,255,.4);padding:60px 20px;text-align:center;">
      No active service plan.<br>
      <button class="ms-btn ms-btn--ghost" id="live-go-services" style="margin-top:16px;">Select a Service Plan</button>
    </div>`;
  }

  const currentKey = song ? (_transposeChord(song.key || song.defaultKey || 'C', S.liveSemitones)) : '';
  const origKey    = song ? (song.key || song.defaultKey || 'C') : '';

  overlay.innerHTML = `
    <!-- Top bar -->
    <div class="ms-live-topbar" id="live-topbar">
      <button class="ms-live-close" id="live-close">✕ Exit</button>
      <div class="ms-live-title">${song ? _e(song.title||song.songTitle||'') : (plan ? _e(plan.serviceType||'Service') : 'Music Stand')}</div>
      ${song ? `<div class="ms-live-key-display" id="live-key-display">${_e(currentKey)}${S.liveSemitones !== 0 ? ` <span style="font-size:.6em;color:rgba(255,255,255,.5)">(orig ${_e(origKey)})</span>` : ''}</div>` : ''}
      ${total > 0 ? `<div style="color:rgba(255,255,255,.5);font-size:.8rem;white-space:nowrap">${idx+1} / ${total}</div>` : ''}
    </div>

    <!-- Chord / lyric content -->
    <div class="ms-live-content ms-song-content" id="live-content">
      ${chordHtml}
    </div>

    <!-- Bottom bar -->
    <div class="ms-live-bottombar">
      <!-- Prev / Next -->
      ${total > 1 ? `
        <button class="ms-live-fs-btn" id="live-prev" title="Previous song (←)" ${idx === 0 ? 'disabled style="opacity:.4"' : ''}>◀</button>
      ` : ''}

      <!-- Transpose -->
      <div style="display:flex;align-items:center;gap:6px;">
        <button class="ms-live-fs-btn" id="live-trans-down" title="Transpose down (↓)">♭</button>
        <span style="font-family:var(--ms-mono);color:var(--ms-gold);font-size:.85rem;min-width:20px;text-align:center">${S.liveSemitones > 0 ? '+'+S.liveSemitones : S.liveSemitones || '0'}</span>
        <button class="ms-live-fs-btn" id="live-trans-up" title="Transpose up (↑)">♯</button>
        <button class="ms-live-fs-btn" id="live-trans-reset" title="Reset transpose" style="${S.liveSemitones === 0 ? 'opacity:.4' : ''}">✕</button>
      </div>

      <!-- Font size -->
      <div style="display:flex;align-items:center;gap:4px;">
        <button class="ms-live-fs-btn" id="live-font-down" title="Smaller text">A-</button>
        <button class="ms-live-fs-btn" id="live-font-up" title="Larger text">A+</button>
      </div>

      <!-- Autoscroll -->
      <button class="ms-autoscroll-btn${_liveAutoScrollId ? ' is-on' : ''}" id="live-autoscroll">⏬ Scroll</button>

      <!-- Metronome -->
      <button class="ms-autoscroll-btn${S.metroPlaying ? ' is-on' : ''}" id="live-metro-toggle">
        🥁 ${song?.tempoBpm || S.metroBpm || 72} BPM
      </button>

      <!-- Progress bar -->
      <div class="ms-live-progress">
        <div class="ms-live-progress-bar" style="width:${total > 0 ? ((idx/(total-1||1))*100).toFixed(1) : 0}%"></div>
      </div>

      ${total > 1 ? `<button class="ms-live-fs-btn" id="live-next" title="Next song (→)" ${idx >= total-1 ? 'disabled style="opacity:.4"' : ''}>▶</button>` : ''}
    </div>
  `;

  // Wire controls
  overlay.querySelector('#live-close')?.addEventListener('click', _closeLiveMode);

  overlay.querySelector('#live-prev')?.addEventListener('click', () => {
    if (S.liveIdx > 0) { S.liveIdx--; S.liveSemitones = 0; _renderLiveOverlay(overlay); }
  });
  overlay.querySelector('#live-next')?.addEventListener('click', () => {
    const max = (S.livePlan?.songs||S.livePlan?.setlist||[]).length - 1;
    if (S.liveIdx < max) { S.liveIdx++; S.liveSemitones = 0; _renderLiveOverlay(overlay); }
  });

  overlay.querySelector('#live-trans-down')?.addEventListener('click', () => {
    S.liveSemitones--; _renderLiveOverlay(overlay);
  });
  overlay.querySelector('#live-trans-up')?.addEventListener('click', () => {
    S.liveSemitones++; _renderLiveOverlay(overlay);
  });
  overlay.querySelector('#live-trans-reset')?.addEventListener('click', () => {
    if (S.liveSemitones !== 0) { S.liveSemitones = 0; _renderLiveOverlay(overlay); }
  });

  overlay.querySelector('#live-font-down')?.addEventListener('click', () => {
    S.liveFontSize = Math.max(14, S.liveFontSize - 2);
    document.documentElement.style.setProperty('--ms-live-fs', S.liveFontSize + 'px');
  });
  overlay.querySelector('#live-font-up')?.addEventListener('click', () => {
    S.liveFontSize = Math.min(72, S.liveFontSize + 2);
    document.documentElement.style.setProperty('--ms-live-fs', S.liveFontSize + 'px');
  });

  overlay.querySelector('#live-autoscroll')?.addEventListener('click', () => {
    if (_liveAutoScrollId) _stopAutoscroll();
    else _startAutoscroll(overlay.querySelector('#live-content'));
    overlay.querySelector('#live-autoscroll').classList.toggle('is-on', !!_liveAutoScrollId);
  });

  overlay.querySelector('#live-metro-toggle')?.addEventListener('click', () => {
    if (S.metroPlaying) _stopMetronome();
    else {
      const bpm = parseInt(song?.tempoBpm || S.metroBpm || 72, 10);
      _startMetronome(bpm, parseInt(song?.timeSignature?.split('/')[0] || S.metroBeats || 4, 10));
    }
    overlay.querySelector('#live-metro-toggle')?.classList.toggle('is-on', S.metroPlaying);
  });

  // Tap the content area to toggle top/bottom bars
  overlay.querySelector('#live-content')?.addEventListener('click', () => {
    const topbar = overlay.querySelector('#live-topbar');
    const bottombar = overlay.querySelector('.ms-live-bottombar');
    const hidden = topbar?.classList.contains('is-hidden');
    topbar?.classList.toggle('is-hidden', !hidden);
    bottombar?.style?.setProperty('opacity', hidden ? '1' : '0');
    if (hidden) setTimeout(() => bottombar?.style?.removeProperty('opacity'), 2000);
  });

  // Keyboard shortcuts
  const _keyHandler = (e) => {
    if (overlay.hidden) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      overlay.querySelector('#live-next')?.click(); e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      overlay.querySelector('#live-prev')?.click(); e.preventDefault();
    } else if (e.key === 'Escape') {
      _closeLiveMode(); e.preventDefault();
    } else if (e.key === '+' || e.key === '=') {
      S.liveSemitones++; _renderLiveOverlay(overlay);
    } else if (e.key === '-') {
      S.liveSemitones--; _renderLiveOverlay(overlay);
    }
  };
  document.removeEventListener('keydown', _keyHandler);
  document.addEventListener('keydown', _keyHandler);

  overlay.querySelector('#live-go-services')?.addEventListener('click', () => {
    _closeLiveMode(); _navigate('services');
  });
}

/* ── Autoscroll ───────────────────────────────────────────────────────────── */
function _startAutoscroll(contentEl) {
  if (!contentEl) return;
  _stopAutoscroll();
  const speed = 1; // px per tick
  _liveAutoScrollId = setInterval(() => {
    contentEl.scrollTop += speed;
    if (contentEl.scrollTop + contentEl.clientHeight >= contentEl.scrollHeight - 4) {
      _stopAutoscroll();
    }
  }, 60);
}
function _stopAutoscroll() {
  if (_liveAutoScrollId) { clearInterval(_liveAutoScrollId); _liveAutoScrollId = null; }
}

/* ── Metronome ────────────────────────────────────────────────────────────── */
let _metroIntervalId = null;
let _metroCtx = null;

function _startMetronome(bpm, beats) {
  _stopMetronome();
  S.metroPlaying = true;
  S.metroBpm     = bpm;
  S.metroBeats   = beats;
  S.metroTick    = 0;

  try {
    _metroCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { S.metroPlaying = false; return; }

  const interval = (60 / bpm) * 1000;
  _metroIntervalId = setInterval(() => {
    const isAccent = (S.metroTick % beats === 0);
    _metroClick(isAccent);
    S.metroTick++;
  }, interval);
  _metroClick(true); // immediate first beat
}

function _metroClick(accent) {
  if (!_metroCtx) return;
  const osc = _metroCtx.createOscillator();
  const gain = _metroCtx.createGain();
  osc.connect(gain); gain.connect(_metroCtx.destination);
  osc.frequency.value = accent ? 1200 : 900;
  gain.gain.setValueAtTime(accent ? 0.6 : 0.35, _metroCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, _metroCtx.currentTime + 0.06);
  osc.start(); osc.stop(_metroCtx.currentTime + 0.06);
}

function _stopMetronome() {
  if (_metroIntervalId) { clearInterval(_metroIntervalId); _metroIntervalId = null; }
  try { _metroCtx?.close(); } catch {}
  _metroCtx = null;
  S.metroPlaying = false;
}

/* ══════════════════════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════════════════════ */

// Modules are deferred — run after DOM is parsed
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
