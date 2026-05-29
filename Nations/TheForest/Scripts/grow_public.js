/* ══════════════════════════════════════════════════════════════════════════════
   GROW PUBLIC — Lightweight bootstrap for the public-facing GROW page.
   No auth, no Firebase, no backend. Static + offline-mode modules only.
   "But grow in the grace and knowledge of our Lord." — 2 Peter 3:18
   ══════════════════════════════════════════════════════════════════════════════ */

import { installScriptureLinks } from './the_scrolls/the_bible_link.js';
import { mountUnityHeader } from './the_unity_header.js';

/* ─── Module registry ────────────────────────────────────────────────────────
   Only public-safe modules. Excluded: Journal, Analytics, Certificates,
   Fellowship, Announcements, Prayer Chain, The Fold, The Life.
   ─────────────────────────────────────────────────────────────────────────── */
const NAV = [
  /* Daily Practice */
  {
    section: 'Daily Practice',
    items: [
      { name: 'the_gospel_reading',       title: 'Reading Plans',      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,      accent: '#0ea5e9' },
      { name: 'the_gospel_devotionals',   title: 'Devotionals',        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`, accent: '#f59e0b' },
      { name: 'the_gospel_heart',         title: 'Heart Check',        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.66l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21l8.84-8.62a5.5 5.5 0 0 0 0-7.78z"/></svg>`,         accent: '#dc2626' },
      { name: 'the_gospel_mirror',        title: "Shepherd's Mirror",  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="18" height="20" rx="3"/><path d="M9 22v-4h6v4"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>`,                             accent: '#7c3aed' },
    ],
  },
  /* Global Outreach */
  {
    section: 'Global Outreach',
    items: [
      { name: 'the_gospel_missions',     title: 'World Missions',  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`, accent: '#059669' },
      { name: 'the_gospel_invitation',   title: 'The Invitation',  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/></svg>`, accent: '#7eaacc' },
    ],
  },
  /* Study & Discipleship */
  {
    section: 'Study & Discipleship',
    items: [
      { name: 'the_gospel_courses',       title: 'Courses',            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 4v12a4 4 0 0 0 4 4"/><path d="M9 9h6M9 13h6"/></svg>`,                     accent: '#7c3aed' },
      { name: 'the_gospel_quizzes',       title: 'Quizzes',            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,  accent: '#0891b2' },
      { name: 'the_gospel_theology',      title: 'Theology',           icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,  accent: '#1d4ed8' },
      { name: 'the_gospel_teaching_plans',title: 'Teaching Plans',     icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,                               accent: '#059669' },
      { name: 'the_gospel_lexicon',       title: 'Lexicon',            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,             accent: '#be185d' },
      { name: 'the_gospel_library',       title: 'Library',            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.25278V19.2528M12 6.25278C10.8321 5.47686 9.24649 5 7.5 5C5.75351 5 4.16789 5.47686 3 6.25278V19.2528C4.16789 18.4769 5.75351 18 7.5 18C9.24649 18 10.8321 18.4769 12 19.2528M12 6.25278C13.1679 5.47686 14.7535 5 16.5 5C18.2465 5 19.8321 5.47686 21 6.25278V19.2528C19.8321 18.4769 18.2465 18 16.5 18C14.7535 18 13.1679 18.4769 12 19.2528"/></svg>`, accent: '#0f766e' },
      { name: 'the_gospel_apologetics',   title: 'Apologetics',        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M3 7l9 3 9-3"/><path d="M3 17l9-3 9 3"/></svg>`,                                                         accent: '#475569' },
      { name: 'the_gospel_psalms',        title: 'Psalms',             icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,                                                   accent: '#7c3aed' },
      { name: 'the_gospel_counseling',    title: 'Counseling',         icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,                       accent: '#0369a1' },
      { name: 'the_gospel_genealogy',     title: 'Genealogy',          icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="9" y1="11" x2="9" y2="21"/><line x1="5" y1="16" x2="13" y2="16"/></svg>`,                         accent: '#92400e' },
    ],
  },
  /* About */
  {
    section: 'About',
    items: [
      { name: 'the_gospel_why', title: 'The Why', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>`, accent: '#e8a838' },
    ],
  },
];

/* Flat module list for quick lookup */
const ALL_MODULES = NAV.flatMap(g => g.items);

/* ─── DOM handles ────────────────────────────────────────────────────────────*/
const topbar  = document.getElementById('gp-topbar-wrap');
const sidebar = document.getElementById('gp-sidebar');
const main    = document.getElementById('gp-main');

/* ─── State ──────────────────────────────────────────────────────────────── */
let _currentUnmount = null;
let _sidebarOpen = false;

/* ─── Routing helpers ────────────────────────────────────────────────────── */
function currentRoute() {
  return location.hash.replace(/^#/, '') || '';
}

function go(name) {
  location.hash = name ? `#${name}` : '';
}

/* ─── Bespoke "Sign in to FlockOS" marketing dropdown ────────────────────── */
const SIGNIN_DROPDOWN_HTML = /* html */`
  <div class="gp-signin-dropdown-inner">
    <img src="Images/icon-grow.svg" alt="GROW" width="44" height="44" style="border-radius:12px;display:block;margin:0 auto 10px;">
    <p class="gp-signin-title">Sign in to FlockOS</p>
    <p class="gp-signin-sub">Unlock your journal, certificates, fellowship channels, and progress tracking.</p>
    <a href="index.html" class="gp-cta gp-signin-cta">
      Sign in
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    </a>
    <div style="margin-top:8px;">
      <button id="gp-signup-btn" style="width:100%;padding:10px;border:1.5px solid var(--gold,#e8a838);border-radius:50px;background:transparent;color:var(--gold,#e8a838);font:600 0.84rem 'Plus Jakarta Sans',system-ui,sans-serif;cursor:pointer;transition:background .15s,color .15s;" onmouseover="this.style.background='var(--gold,#e8a838)';this.style.color='#0c1445'" onmouseout="this.style.background='transparent';this.style.color='var(--gold,#e8a838)'">
        ✉️ Request Access
      </button>
    </div>
    <p class="gp-signin-foot">Powered by <strong>FlockOS</strong></p>
  </div>
`;

const _signinDropdown = document.getElementById('gp-signin-dropdown');
if (_signinDropdown) _signinDropdown.innerHTML = SIGNIN_DROPDOWN_HTML;

function _openSigninDropdown() {
  if (!_signinDropdown) return;
  _signinDropdown.hidden = false;
  // Wire request-access button each open (idempotent — same node)
  const signupBtn = document.getElementById('gp-signup-btn');
  if (signupBtn && !signupBtn._wired) {
    signupBtn._wired = true;
    signupBtn.addEventListener('click', () => {
      _closeSigninDropdown();
      _openOutreachModal('I\'d like to request access to FlockOS.', { name: 'signup', title: 'Request Access' });
    });
  }
}
function _closeSigninDropdown() {
  if (_signinDropdown) _signinDropdown.hidden = true;
}
document.addEventListener('click', (e) => {
  if (_signinDropdown && !_signinDropdown.hidden) {
    const onAvatar = e.target.closest('.unity-avatar');
    if (!_signinDropdown.contains(e.target) && !onAvatar) _closeSigninDropdown();
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _closeSigninDropdown(); });

/* ─── Unity header (shared chrome across every New Covenant app) ────────── */
const GROW_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';

mountUnityHeader(topbar, {
  appId:       'grow',
  appName:     'GROW',
  appIconSvg:  GROW_ICON,
  appAccent:   '#d97706',
  appAccentDk: '#78350f',
  homeHref:    'app.grow/',
  user:        null,                             // GROW is public — no auth at this layer
  avatarSrc:   'Images/icon-grow.svg',
  onAccount:   () => {                           // override: open marketing sign-in dropdown
    if (_signinDropdown && _signinDropdown.hidden) _openSigninDropdown();
    else _closeSigninDropdown();
  },
  onHamburger: () => _toggleSidebar(),
  features:    ALL_MODULES.map(m => ({
    id:    `nav-${m.name}`,
    label: m.title,
    hint:  'Open module',
    run:   () => go(m.name),
  })).concat([
    { id: 'nav-home', label: 'Home / Overview', hint: 'GROW dashboard', run: () => go('') },
  ]),
});

/* ─── Sidebar ────────────────────────────────────────────────────────────── */
function _sidebarHTML() {
  return /* html */`
    <button class="pillars-item" data-go="" data-section="home" style="width:100%">
      <span class="pillars-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V8"/><path d="M5 12c0-3 3-5 7-4 0 4-3 7-7 4z"/><path d="M19 8c0-3-3-5-7-4 0 4 3 7 7 4z"/></svg>
      </span>
      <span class="pillars-label">Overview</span>
    </button>

    ${NAV.map(g => /* html */`
      <div class="pillars-section">${g.section}</div>
      ${g.items.map(item => /* html */`
        <button class="pillars-item" data-go="${item.name}" data-section="word" style="width:100%">
          <span class="pillars-icon">${item.icon}</span>
          <span class="pillars-label">${item.title}</span>
        </button>
      `).join('')}
    `).join('')}

    <div style="margin-top:auto;padding:24px 14px 8px;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
      <a href="index.html" target="_self"
         style="color:rgba(255,255,255,0.32);font:0.72rem var(--font-ui);text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;">
        <img src="Images/icon-flockos.svg" alt="" width="14" height="14" style="border-radius:3px;opacity:0.5;">
        Powered by FlockOS
      </a>
    </div>
  `;
}

sidebar.innerHTML = _sidebarHTML();

/* ─── Active state sync ──────────────────────────────────────────────────── */
function _syncActive(route) {
  sidebar.querySelectorAll('.pillars-item[data-go]').forEach(btn => {
    const match = btn.dataset.go === route;
    btn.classList.toggle('is-active', match);
    btn.setAttribute('aria-current', match ? 'page' : 'false');
  });
}

/* ─── Home dashboard ─────────────────────────────────────────────────────── */
function _renderHome() {
  function _card(item) {
    return /* html */`
      <button class="growth-card" data-go="${item.name}" style="--grow-accent:${item.accent}">
        <span class="growth-card-icon" aria-hidden="true">${item.icon}</span>
        <span class="growth-card-text">
          <span class="growth-card-title">${item.title}</span>
        </span>
      </button>
    `;
  }

  main.innerHTML = /* html */`
    <section class="grow-page" data-grow="home">
      <header class="grow-hero" style="--grow-accent:#0ea572">
        <div class="grow-hero-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22V8"/><path d="M5 12c0-3 3-5 7-4 0 4-3 7-7 4z"/><path d="M19 8c0-3-3-5-7-4 0 4 3 7 7 4z"/>
          </svg>
        </div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">GROW</h1>
          <p class="grow-hero-sub">Your library, your habits, your discipleship &mdash; freely available in <strong>210 countries</strong>. No account required. Works offline.</p>
        </div>
      </header>

      ${NAV.map(g => /* html */`
        <section class="growth-section">
          <header class="growth-section-head">
            <h2 class="growth-section-title">${g.section}</h2>
          </header>
          <div class="growth-grid">
            ${g.items.map(_card).join('')}
          </div>
        </section>
      `).join('')}

      <div class="gp-full-access-banner">
        <div class="gp-full-access-inner">
          <span class="gp-full-access-label">Want your journal, certificates &amp; progress tracking?</span>
          <a href="index.html" class="gp-cta">Sign in to FlockOS
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    </section>
  `;

  /* Wire home dashboard cards */
  main.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => go(btn.dataset.go));
  });
  installScriptureLinks(main);
}

/* ─── Module loader ──────────────────────────────────────────────────────── */
async function _loadModule(name) {
  main.innerHTML = /* html */`
    <div style="padding:48px 24px;text-align:center;color:var(--ink-muted,#7a7f96);font:0.95rem var(--font-ui);">
      <div style="width:40px;height:40px;border:3px solid var(--line,#e5e7ef);border-top-color:var(--gold,#e8a838);border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto 16px;"></div>
      Loading…
    </div>
  `;

  try {
    const mod = await import(`./the_gospel/${name}.js`);
    main.innerHTML = mod.render();
    const unmount = mod.mount(main, { go });
    _currentUnmount = typeof unmount === 'function' ? unmount : null;
    installScriptureLinks(main);
    // Wire any "Send to Pastor" buttons inside this module
    const modTitle = ALL_MODULES.find(m => m.name === name)?.title || name.replace(/_/g,' ');
    _installPrayerHook(main, { name, title: modTitle });
  } catch (err) {
    console.error('[grow-public] module load failed:', name, err);
    main.innerHTML = /* html */`
      <div style="padding:48px 24px;max-width:520px;margin:0 auto;text-align:center;">
        <div style="font-size:2.5rem;margin-bottom:12px;">⚠️</div>
        <h2 style="font:700 1.2rem var(--font-ui);color:var(--ink,#1b264f);margin:0 0 8px;">${name.replace(/_/g,' ')} could not be loaded</h2>
        <p style="color:var(--ink-muted,#7a7f96);font:0.9rem var(--font-ui);margin:0 0 20px;">${err.message || String(err)}</p>
        <button onclick="history.back()" style="padding:10px 22px;border-radius:10px;background:var(--gold,#e8a838);color:#0c1445;border:0;font:600 0.9rem var(--font-ui);cursor:pointer;">← Back</button>
      </div>
    `;
  }
}

/* ─── Router ─────────────────────────────────────────────────────────────── */
async function _route() {
  /* Cleanup previous view */
  if (typeof _currentUnmount === 'function') {
    try { _currentUnmount(); } catch (_) {}
    _currentUnmount = null;
  }

  /* Scroll main back to top */
  main.scrollTop = 0;

  const route = currentRoute();
  _syncActive(route);

  /* Close sidebar on mobile after nav */
  if (_sidebarOpen) _toggleSidebar(false);

  if (!route) {
    _renderHome();
    return;
  }

  const mod = ALL_MODULES.find(m => m.name === route);
  if (!mod) {
    go('');  /* Unknown route → home */
    return;
  }

  await _loadModule(route);
}

/* ─── Sidebar nav click delegation ──────────────────────────────────────── */
sidebar.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-go]');
  if (!btn) return;
  go(btn.dataset.go);
});

/* ─── Mobile sidebar toggle (driven by unity-header onHamburger) ─────────── */
const sidePanel = document.getElementById('gp-sidebar-wrap');

function _toggleSidebar(open) {
  _sidebarOpen = open ?? !_sidebarOpen;
  sidePanel.classList.toggle('gp-sidebar-open', _sidebarOpen);
}

/* Close sidebar when clicking the overlay backdrop */
sidePanel.addEventListener('click', (e) => {
  if (e.target === sidePanel) _toggleSidebar(false);
});

/* ─── Firebase / Outreach submission ─────────────────────────────────────────
   Lazy-init Firebase compat SDK (loaded from CDN in grow-public.html).
   Writes go to outreachContacts at root of the project — same collection
   the admin's My Flock → Outreach Contacts panel reads.
   ────────────────────────────────────────────────────────────────────────── */
const _OUTREACH_FB_CONFIG = (typeof window.FLOCK_FIREBASE_CONFIG === 'object' && window.FLOCK_FIREBASE_CONFIG)
  ? window.FLOCK_FIREBASE_CONFIG
  : {
      apiKey:    'AIzaSyBA-fkxjABbwIHn0i6MPiXbGwahfJmuJeo',
      authDomain:'flockos-notify.firebaseapp.com',
      projectId: 'flockos-notify',
    };

let _outreachDB = null;
function _getDB() {
  if (_outreachDB) return _outreachDB;
  try {
    const fb = window.firebase;
    if (!fb) return null;
    const app = fb.apps.length ? fb.app() : fb.initializeApp(_OUTREACH_FB_CONFIG, 'grow-public');
    _outreachDB = app.firestore();
  } catch (e) {
    console.warn('[grow-public] Firebase init failed:', e.message);
  }
  return _outreachDB;
}

/** Submit an outreach contact to Firestore without requiring auth. */
async function _submitOutreachContact(data) {
  const db = _getDB();
  if (!db) throw new Error('Firebase not available');
  await db.collection('outreachContacts').add({
    source:      'PublicGROW',
    firstName:   data.firstName  || '',
    lastName:    data.lastName   || '',
    email:       data.email      || '',
    phone:       data.phone      || '',
    requestType: data.requestType|| 'Prayer Request',
    message:     data.message    || '',
    urgency:     data.urgency    || 'Normal',
    context:     data.context    || '',
    status:      'New',
    createdAt:   window.firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/* ─── Outreach / prayer-request modal ───────────────────────────────────── */
const _outreachStyle = document.createElement('style');
_outreachStyle.textContent = `
.gp-prayer-overlay {
  position:fixed; inset:0; z-index:900;
  background:rgba(12,20,69,0.75); backdrop-filter:blur(5px);
  display:flex; align-items:flex-start; justify-content:center;
  padding:16px 16px 40px; overflow-y:auto;
  animation:gp-overlay-in 180ms ease;
}
@media(min-width:600px) { .gp-prayer-overlay { align-items:center; } }
@keyframes gp-overlay-in { from{opacity:0} to{opacity:1} }
.gp-prayer-card {
  background:var(--bg-raised,#fff); border:1px solid var(--line,#e5e7ef);
  border-radius:20px; box-shadow:0 24px 72px rgba(15,23,42,.30);
  width:100%; max-width:520px;
  padding:28px 28px 24px;
  animation:gp-card-in 200ms cubic-bezier(.2,.8,.2,1);
}
@keyframes gp-card-in { from{transform:translateY(12px) scale(.97);opacity:0} to{transform:none;opacity:1} }
.gp-prayer-head { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; gap:12px; }
.gp-prayer-title { font:700 1.15rem var(--font-ui,sans-serif); color:var(--ink,#1b264f); margin:0 0 3px; }
.gp-prayer-sub   { font:0.84rem var(--font-ui,sans-serif); color:var(--ink-muted,#7a7f96); margin:0; line-height:1.4; }
.gp-prayer-field { display:flex; flex-direction:column; gap:4px; margin-bottom:13px; }
.gp-prayer-label { font:600 0.78rem var(--font-ui,sans-serif); color:var(--ink,#1b264f); }
.gp-prayer-input {
  padding:9px 12px; border-radius:10px; border:1.5px solid var(--line,#e5e7ef);
  font:0.9rem var(--font-ui,sans-serif); color:var(--ink,#1b264f);
  background:var(--bg,#f7f8fb); outline:none; transition:border-color 130ms;
  width:100%; box-sizing:border-box;
}
.gp-prayer-input:focus { border-color:var(--gold,#e8a838); }
textarea.gp-prayer-input { resize:vertical; min-height:100px; font-size:.85rem; line-height:1.5; }
.gp-prayer-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
@media(max-width:480px) { .gp-prayer-row { grid-template-columns:1fr; } }
.gp-prayer-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:6px; }
.gp-prayer-submit {
  flex:1; padding:12px 18px; border-radius:10px;
  background:var(--gold,#e8a838); color:#0c1445; border:0;
  font:700 0.9rem var(--font-ui,sans-serif); cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  transition:background 130ms, transform 100ms;
}
.gp-prayer-submit:hover:not(:disabled) { background:#f0b534; transform:translateY(-1px); }
.gp-prayer-submit:disabled { opacity:.6; cursor:not-allowed; }
.gp-prayer-cancel {
  padding:12px 16px; border-radius:10px; background:transparent;
  border:1.5px solid var(--line,#e5e7ef);
  font:600 0.85rem var(--font-ui,sans-serif); color:var(--ink-muted,#7a7f96);
  cursor:pointer; transition:border-color 130ms,color 130ms;
}
.gp-prayer-cancel:hover { border-color:var(--ink,#1b264f); color:var(--ink,#1b264f); }
.gp-prayer-privacy {
  margin-top:14px; padding:10px 14px; border-radius:10px;
  background:rgba(232,168,56,.10);
  font:0.76rem var(--font-ui,sans-serif); color:var(--ink-muted,#7a7f96); line-height:1.5;
}
.gp-prayer-success {
  text-align:center; padding:12px 0 4px;
}
.gp-prayer-success-icon {
  width:56px; height:56px; border-radius:50%; margin:0 auto 14px;
  background:rgba(5,150,105,.15); display:flex; align-items:center; justify-content:center;
}
.gp-prayer-success-icon svg { color:#059669; }
.gp-prayer-success-title { font:700 1.15rem var(--font-ui,sans-serif); color:var(--ink,#1b264f); margin:0 0 8px; }
.gp-prayer-success-sub   { font:0.88rem var(--font-ui,sans-serif); color:var(--ink-muted,#7a7f96); margin:0 0 20px; line-height:1.5; }
.gp-prayer-err { margin-top:8px; font:0.82rem var(--font-ui,sans-serif); color:#b91c1c; }
@media(max-width:500px) { .gp-prayer-card { padding:20px 16px 18px; } }
`;
document.head.appendChild(_outreachStyle);

/** Open the public outreach / prayer-request modal.
 * @param {string} prefillSummary  - pre-filled message text
 * @param {{name:string,title:string}} [ctx] - module context (where button was pressed)
 */
function _openOutreachModal(prefillSummary, ctx) {
  document.getElementById('gp-prayer-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'gp-prayer-overlay';
  overlay.className = 'gp-prayer-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'gp-pr-title');

  const _ctxLabel = ctx?.title || '';
  const _isSignup = ctx?.name === 'signup';

  function _renderForm() {
    return /* html */`
      <div class="gp-prayer-head">
        <div>
          <p class="gp-prayer-title" id="gp-pr-title">${_isSignup ? '✉️ Request Access to FlockOS' : '🙏 Send a Request to Your Pastor'}</p>
          <p class="gp-prayer-sub">${_isSignup ? 'Fill in your info and a shepherd will reach out to get you set up.' : 'Fill in your information so pastoral staff can follow up with you personally.'}</p>
          ${_ctxLabel && !_isSignup ? `<p style="margin:6px 0 0;font:600 0.74rem var(--font-ui,sans-serif);color:var(--gold,#e8a838);letter-spacing:.04em;">📍 ${_ctxLabel}</p>` : ''}
        </div>
      </div>

      <div class="gp-prayer-row">
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-fn">First Name</label>
          <input class="gp-prayer-input" id="gp-pr-fn" type="text" placeholder="First" autocomplete="given-name">
        </div>
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-ln">Last Name</label>
          <input class="gp-prayer-input" id="gp-pr-ln" type="text" placeholder="Last" autocomplete="family-name">
        </div>
      </div>

      <div class="gp-prayer-row">
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-email">Email <span style="color:#b91c1c">*</span></label>
          <input class="gp-prayer-input" id="gp-pr-email" type="email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-phone">Phone (optional)</label>
          <input class="gp-prayer-input" id="gp-pr-phone" type="tel" placeholder="(555) 000-0000" autocomplete="tel">
        </div>
      </div>

      <div class="gp-prayer-row">
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-type">Request Type</label>
          <select class="gp-prayer-input" id="gp-pr-type">
            ${_isSignup ? '<option value="Access Request" selected>Access Request</option>' : ''}
            <option value="Prayer Request"${!_isSignup ? '' : ''}>Prayer Request</option>
            <option value="Pastoral Care">Pastoral Care</option>
            <option value="Counseling">Counseling</option>
            <option value="General Contact">General Contact</option>
          </select>
        </div>
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-urgency">Urgency</label>
          <select class="gp-prayer-input" id="gp-pr-urgency">
            <option value="Normal">Normal</option>
            <option value="Urgent">Urgent — please respond soon</option>
          </select>
        </div>
      </div>

      <div class="gp-prayer-field">
        <label class="gp-prayer-label" for="gp-pr-msg">${_isSignup ? 'Tell us about yourself' : 'Your Message'} <span style="color:#b91c1c">*</span></label>
        <textarea class="gp-prayer-input" id="gp-pr-msg" placeholder="${_isSignup ? 'What brings you here? Any church or background info helps…' : 'Share what\'s on your heart…'}"></textarea>
      </div>

      <div id="gp-pr-err" class="gp-prayer-err" hidden></div>

      <div class="gp-prayer-actions">
        <button class="gp-prayer-submit" id="gp-pr-send">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          ${_isSignup ? 'Request Access' : 'Send to Pastoral Team'}
        </button>
        <button class="gp-prayer-cancel" id="gp-pr-cancel">Cancel</button>
      </div>

      <p class="gp-prayer-privacy">🔒 Your information is shared only with your pastoral staff. Nothing is sold or shared externally.</p>
    `;
  }

  function _renderSuccess(name) {
    return /* html */`
      <div class="gp-prayer-success">
        <div class="gp-prayer-success-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p class="gp-prayer-success-title">Request Received${name ? `, ${name}` : ''}!</p>
        <p class="gp-prayer-success-sub">Your request has been sent to the pastoral team. Someone will be reaching out to you soon. We're praying for you.</p>
        <button class="gp-prayer-submit" id="gp-pr-done" style="max-width:200px;margin:0 auto;">Done</button>
      </div>
    `;
  }

  overlay.innerHTML = `<div class="gp-prayer-card" id="gp-pr-card">${_renderForm()}</div>`;
  document.body.appendChild(overlay);

  function _close() { overlay.remove(); }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) _close(); });
  document.getElementById('gp-pr-cancel')?.addEventListener('click', _close);

  const _esc = (ev) => { if (ev.key === 'Escape') { _close(); document.removeEventListener('keydown', _esc); } };
  document.addEventListener('keydown', _esc);

  document.getElementById('gp-pr-send')?.addEventListener('click', async () => {
    const fn      = document.getElementById('gp-pr-fn')?.value.trim()      || '';
    const ln      = document.getElementById('gp-pr-ln')?.value.trim()      || '';
    const email   = document.getElementById('gp-pr-email')?.value.trim()   || '';
    const phone   = document.getElementById('gp-pr-phone')?.value.trim()   || '';
    const type    = document.getElementById('gp-pr-type')?.value           || 'Prayer Request';
    const urgency = document.getElementById('gp-pr-urgency')?.value        || 'Normal';
    const msg     = document.getElementById('gp-pr-msg')?.value.trim()     || '';
    const errEl   = document.getElementById('gp-pr-err');

    /* Validate */
    if (!email && !phone) {
      if (errEl) { errEl.textContent = 'Please enter an email address or phone number so we can reach you.'; errEl.hidden = false; }
      document.getElementById('gp-pr-email')?.focus();
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (errEl) { errEl.textContent = 'Please enter a valid email address.'; errEl.hidden = false; }
      document.getElementById('gp-pr-email')?.focus();
      return;
    }
    if (!msg) {
      if (errEl) { errEl.textContent = 'Please add a message so we know how to help.'; errEl.hidden = false; }
      document.getElementById('gp-pr-msg')?.focus();
      return;
    }
    if (errEl) errEl.hidden = true;

    const btn = document.getElementById('gp-pr-send');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    try {
      await _submitOutreachContact({ firstName: fn, lastName: ln, email, phone, requestType: type, urgency, message: msg, context: _ctxLabel });
      const card = document.getElementById('gp-pr-card');
      if (card) card.innerHTML = _renderSuccess(fn);
      document.getElementById('gp-pr-done')?.addEventListener('click', _close);
    } catch (err) {
      console.warn('[grow-public] outreach submit failed:', err);
      /* Fallback: copy to clipboard so user isn't left empty-handed */
      const fallbackText = [
        `Name: ${fn} ${ln}`.trim(),
        `Email: ${email}`,
        `Phone: ${phone}`,
        `Type: ${type}`,
        `Urgency: ${urgency}`,
        `\nMessage:\n${msg}`,
      ].filter(l => l.trim()).join('\n');

      try { await navigator.clipboard.writeText(fallbackText); } catch (_) {}

      if (btn) { btn.disabled = false; btn.textContent = 'Send to Pastoral Team'; }
      if (errEl) {
        errEl.textContent = 'We couldn\'t reach the server right now. Your message has been copied to your clipboard — please email or text it to your pastoral team directly.';
        errEl.hidden = false;
      }
    }
  });

  /* Prefill message with any diagnostic summary */
  if (prefillSummary) {
    const msgEl = document.getElementById('gp-pr-msg');
    if (msgEl) msgEl.value = prefillSummary;
  }

  /* Focus first name field */
  setTimeout(() => document.getElementById('gp-pr-fn')?.focus(), 80);
}

/**
 * Gather a human-readable summary from the module's diagnostic output.
 * Reads from the visible prescriptions/scan/plan panel rendered in `root`.
 * @param {Element} root
 * @param {{name:string,title:string}} [ctx]
 */
function _gatherDiagnosticSummary(root, ctx) {
  const lines = [];
  const label = ctx?.title || root.querySelector('.grow-hero-title')?.textContent.trim() || '';
  if (label) lines.push(`=== ${label} ===\n`);
  root.querySelectorAll('.grow-split-aside, [data-bind="scan"], [data-bind="plan"]').forEach(panel => {
    panel.querySelectorAll('[style*="border-left"]').forEach(card => {
      const cat  = card.querySelector('[style*="text-transform"]');
      const q    = card.querySelector('p');
      const step = card.querySelectorAll('p')[1];
      const ref  = card.querySelectorAll('p')[2];
      if (cat && cat.textContent.trim()) lines.push(`\n[${cat.textContent.trim()}]`);
      if (q)    lines.push(q.textContent.trim());
      if (step) lines.push(`→ ${step.textContent.trim()}`);
      if (ref)  lines.push(`   ${ref.textContent.trim()}`);
    });
    const pct = panel.querySelector('.grow-scan-pct');
    if (pct) lines.push(`\nCompletion: ${pct.textContent.trim()}`);
  });
  const scraped = lines.join('\n').trim();
  if (scraped) return scraped;
  /* Fallback: generic context based on module title */
  return label ? `I was exploring "${label}" in GROW and would love to connect with a pastor.` : '';
}

/**
 * Install a capture-phase listener on `root` that intercepts any
 * [data-help-btn] click and opens the public outreach modal.
 * @param {Element} root
 * @param {{name:string,title:string}} [ctx] - module context
 */
function _installPrayerHook(root, ctx) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-help-btn]');
    if (!btn) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    /* Prefer the module's own summaryFn (stored by wireHelp) over DOM scraping */
    let summary = '';
    const prayerBtn = /** @type {HTMLElement & { _prayerSummaryFn?: () => (string|Promise<string>) }} */ (btn);
    if (typeof prayerBtn._prayerSummaryFn === 'function') {
      try { const r = prayerBtn._prayerSummaryFn(); summary = (r instanceof Promise) ? '' : (r || ''); } catch (_) {}
    }
    if (!summary) summary = _gatherDiagnosticSummary(root, ctx);
    _openOutreachModal(summary, ctx);
  }, true /* capture */);
}

/* ─── Hash-change listener ───────────────────────────────────────────────── */
window.addEventListener('hashchange', _route);

/* ─── Initial render ─────────────────────────────────────────────────────── */
_route();

/* CSS spin keyframe injected once (only needed for loading indicator) */
const _spin = document.createElement('style');
_spin.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(_spin);

/* ─── Expose prayer/contact modal for footer & external access ──────────── */
window._openOutreachModal = _openOutreachModal;

/* ─── Service worker registration ───────────────────────────────────────────
   Enables full offline support and PWA install for the GROW app.
   Uses the shared New Covenant SW (the_living_water.js).
   ─────────────────────────────────────────────────────────────────────────── */
import('./the_living_water_register.js').then((m) => m.register()).catch(() => {});
