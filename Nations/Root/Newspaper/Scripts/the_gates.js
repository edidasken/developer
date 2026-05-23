// the_gates.js — The Flock Herald
// Shared page controller: section nav bar, right drawer, font scale picker, toasts.
// Loaded on every section page after the_adornment.js.

(function() {
  'use strict';

  // ── Section Registry ────────────────────────────────────────────────────────
  // Each entry: { id, label, shortLabel, url, minRole, icon }
  // minRole: -1 = public, 0 = member, 2 = care, 3 = leader, 4 = pastor
  const SECTIONS = [
    { id: 'herald',
      label: 'The Herald',    shortLabel: 'Herald',    url: '../herald/index.html',        minRole: -1,
      iconBg: '#7B4A28',
      // Newspaper: folded broadsheet with headline block + text rules
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><rect x="10" y="6" width="8" height="4" rx="1"/><path d="M10 14h8M10 18h5"/></svg>' },
    { id: 'the_way',
      label: 'The Way',       shortLabel: 'The Way',   url: '../the_way/index.html',       minRole: -1,
      iconBg: '#2A7A4B',
      // Cross: "I am the Way, the Truth, and the Life" — John 14:6
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"/><line x1="6" y1="8" x2="18" y2="8"/></svg>' },
    { id: 'the_sanctuary',
      label: 'The Sanctuary', shortLabel: 'Sanctuary', url: '../the_sanctuary/index.html', minRole:  3,
      iconBg: '#2B4C8C',
      // Church building with cross steeple
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4M10 4h4"/><path d="M4 10l8-6 8 6v11H4z"/><rect x="9" y="15" width="6" height="6"/></svg>' },
    { id: 'the_flock',
      label: 'The Flock',     shortLabel: 'The Flock', url: '../the_flock/index.html',     minRole:  2,
      iconBg: '#4A7A3A',
      // Group of people / community
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
    { id: 'the_mission',
      label: 'The Mission',   shortLabel: 'Mission',   url: '../the_mission/index.html',   minRole:  4,
      iconBg: '#2A6A6A',
      // Globe with meridians — go into all the world
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' },
    { id: 'the_family',
      label: 'The Family',    shortLabel: 'Family',    url: '../the_family/index.html',    minRole:  0,
      iconBg: '#6B3A7A',
      // Home with door — household of faith
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    { id: 'the_shepherd',
      label: 'The Shepherd',  shortLabel: 'Shepherd',  url: '../the_shepherd/index.html',  minRole:  4,
      iconBg: '#2A3C6A',
      // Key — keys of the kingdom (Matt 16:19)
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg>' },
    { id: 'the_calendar',
      label: 'The Calendar',  shortLabel: 'Calendar',  url: '../the_calendar/index.html',  minRole:  0,
      iconBg: '#8A5A20',
      // Calendar with date marker
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="8" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/></svg>' },
    { id: 'the_weavers',
      label: 'The Weavers',   shortLabel: 'Weavers',   url: '../the_weavers/index.html',   minRole:  3,
      iconBg: '#7A2A3A',
      // Scissors — creative ministries
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>' },
  ];

  // ── Detect active section from current URL ───────────────────────────────────
  function getActiveSectionId() {
    const path = window.location.pathname;
    for (const sec of SECTIONS) {
      if (path.includes('/' + sec.id + '/')) return sec.id;
    }
    // Fallback: herald
    return 'herald';
  }

  // ── Get user role from Nehemiah / firm_foundation ────────────────────────────
  function getUserRole() {
    // Nehemiah exposes current role. Local bypass sets role to 5.
    if (window.Nehemiah && typeof window.Nehemiah.getRole === 'function') {
      return window.Nehemiah.getRole();
    }
    // Fallback: check session storage for dev bypass
    if (window._HERALD_AUTH_LEVEL !== undefined) return window._HERALD_AUTH_LEVEL;
    return -1; // public
  }

  const SANCTUARY_LOGIN_TABS = new Set(['herald', 'the_way', 'the_sanctuary']);

  function _shouldRestrictNav() {
    return !!window._HERALD_SANCTUARY_LOGIN_REQUIRED;
  }

  // ── Build section nav bar ───────────────────────────────────────────────────
  function buildNavBar() {
    const nav = document.getElementById('sec-nav');
    if (!nav) return;

    nav.innerHTML = '';
    const activeId = getActiveSectionId();
    const userRole = getUserRole();
    const restrictNav = _shouldRestrictNav();

    SECTIONS.forEach(sec => {
      if (restrictNav && !SANCTUARY_LOGIN_TABS.has(sec.id)) return;
      if (!restrictNav && sec.minRole > userRole) return; // hide tabs user doesn't have access to

      const btn = document.createElement('a');
      btn.href = sec.url;
      btn.className = 'sec-nav-tab' + (sec.id === activeId ? ' is-active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', sec.id === activeId ? 'true' : 'false');
      btn.setAttribute('aria-label', sec.label);

      // Icon badge + label
      const icon = document.createElement('span');
      icon.className = 'tab-icon-badge';
      icon.style.setProperty('--badge-bg', sec.iconBg);
      icon.innerHTML = sec.svg;

      const label = document.createElement('span');
      label.textContent = sec.shortLabel;

      btn.appendChild(icon);
      btn.appendChild(label);
      nav.appendChild(btn);
    });

    // Scroll active tab into view
    const activeTab = nav.querySelector('.is-active');
    if (activeTab) {
      setTimeout(() => activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 100);
    }
  }

  // ── Right Drawer ────────────────────────────────────────────────────────────
  function openDrawer(titleText, contentHTML) {
    const drawer = document.querySelector('.right-drawer');
    const titleEl = document.getElementById('drawer-title');
    const bodyEl = document.getElementById('drawer-body');
    if (!drawer || !titleEl || !bodyEl) return;

    titleEl.textContent = titleText;
    bodyEl.innerHTML = contentHTML;
    bodyEl.scrollTop = 0;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');

    // Focus first focusable element in drawer
    const firstFocusable = drawer.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) firstFocusable.focus();
  }

  function closeDrawer() {
    const drawer = document.querySelector('.right-drawer');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
  }

  function initDrawer() {
    const closeBtn = document.querySelector('.drawer-close');
    const backdrop = document.querySelector('.drawer-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  // ── Font Scale Picker ───────────────────────────────────────────────────────
  const FONT_STEPS = [0.85, 1.0, 1.1, 1.15, 1.25];
  const FONT_LABELS = ['Compact', 'Normal', 'Comfortable', 'Large', 'XL'];

  function getCurrentScaleIndex() {
    const saved = parseFloat(localStorage.getItem('flock_font_scale') || '1.0');
    const idx = FONT_STEPS.indexOf(saved);
    return idx >= 0 ? idx : 1; // default Normal
  }

  function applyScale(scale) {
    document.documentElement.style.setProperty('--fn-scale', scale);
    localStorage.setItem('flock_font_scale', scale);
  }

  function initFontScale() {
    const btn = document.getElementById('font-scale-btn');
    if (!btn) return;

    // Restore saved scale
    const saved = parseFloat(localStorage.getItem('flock_font_scale') || '1.0');
    applyScale(saved);

    btn.addEventListener('click', () => {
      const currentIdx = getCurrentScaleIndex();
      const nextIdx = (currentIdx + 1) % FONT_STEPS.length;
      applyScale(FONT_STEPS[nextIdx]);
      showToast('Text size: ' + FONT_LABELS[nextIdx]);
    });
  }

  // ── Toast ───────────────────────────────────────────────────────────────────
  function showToast(message, durationMs) {
    const layer = document.getElementById('toast-layer');
    if (!layer) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    layer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 350);
    }, durationMs || 2200);
  }

  function rebuildNavBar() {
    buildNavBar();
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    buildNavBar();
    initDrawer();
    initFontScale();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose public API
  window.FlockGates = { openDrawer, closeDrawer, showToast, getUserRole, rebuildNavBar };
})();
