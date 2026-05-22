// the_gates.js — The Flock Herald
// Shared page controller: section nav bar, right drawer, font scale picker, toasts.
// Loaded on every section page after the_adornment.js.

(function() {
  'use strict';

  // ── Section Registry ────────────────────────────────────────────────────────
  // Each entry: { id, label, shortLabel, url, minRole, icon }
  // minRole: -1 = public, 0 = member, 2 = care, 3 = leader, 4 = pastor
  const SECTIONS = [
    { id: 'herald',        label: 'The Herald',    shortLabel: 'Herald',    url: '../herald/index.html',        minRole: -1, icon: '📰' },
    { id: 'the_way',      label: 'The Way',       shortLabel: 'The Way',   url: '../the_way/index.html',       minRole: -1, icon: '🌱' },
    { id: 'the_sanctuary',label: 'The Sanctuary', shortLabel: 'Sanctuary', url: '../the_sanctuary/index.html', minRole:  3, icon: '🕊' },
    { id: 'the_flock',    label: 'The Flock',     shortLabel: 'The Flock', url: '../the_flock/index.html',     minRole:  2, icon: '🐑' },
    { id: 'the_mission',  label: 'The Mission',   shortLabel: 'Mission',   url: '../the_mission/index.html',   minRole:  4, icon: '🌍' },
    { id: 'the_family',   label: 'The Family',    shortLabel: 'Family',    url: '../the_family/index.html',    minRole:  0, icon: '👨‍👩‍👧‍👦' },
    { id: 'the_shepherd', label: 'The Shepherd',  shortLabel: 'Shepherd',  url: '../the_shepherd/index.html',  minRole:  4, icon: '🔑' },
    { id: 'the_calendar', label: 'The Calendar',  shortLabel: 'Calendar',  url: '../the_calendar/index.html',  minRole:  0, icon: '📅' },
    { id: 'the_weavers',  label: 'The Weavers',   shortLabel: 'Weavers',   url: '../the_weavers/index.html',   minRole:  3, icon: '🧵' }
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

  // ── Build section nav bar ───────────────────────────────────────────────────
  function buildNavBar() {
    const nav = document.getElementById('sec-nav');
    if (!nav) return;

    const activeId = getActiveSectionId();
    const userRole = getUserRole();

    SECTIONS.forEach(sec => {
      if (sec.minRole > userRole) return; // hide tabs user doesn't have access to

      const btn = document.createElement('a');
      btn.href = sec.url;
      btn.className = 'sec-nav-tab' + (sec.id === activeId ? ' is-active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', sec.id === activeId ? 'true' : 'false');
      btn.setAttribute('aria-label', sec.label);

      // Icon + label
      const icon = document.createElement('span');
      icon.textContent = sec.icon;
      icon.setAttribute('aria-hidden', 'true');

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
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');

    // Focus first focusable element in drawer
    const firstFocusable = drawer.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) firstFocusable.focus();
  }

  function closeDrawer() {
    const drawer = document.querySelector('.right-drawer');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
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
  window.FlockGates = { openDrawer, closeDrawer, showToast };
})();
