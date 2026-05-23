// the_gates.js — shared Newspaper chrome controller
// Owns drawer, font scale, toast, and section nav wiring.
// Consumes the canonical shared section manifest + shell contracts.

(function () {
  'use strict';

  const FONT_KEY = 'flock_font_scale';
  const FONT_STEPS = [0.85, 1, 1.1, 1.15, 1.25];
  const FONT_LABELS = ['Compact', 'Normal', 'Comfortable', 'Large', 'XL'];
  const SANCTUARY_LOGIN_TABS = new Set(['herald', 'the_way', 'the_sanctuary']);
  const ELEVATED_GROUPS = new Set(['seed admin', 'lead pastor', 'master', 'admin', 'timothy']);

  let _drawerListenersBound = false;
  let _drawerLastTrigger = null;
  let _fontPickerEl = null;
  let _fontPickerCloseTimer = null;
  let _fontPickerTrigger = null;

  function _sectionsApi() {
    if (typeof window === 'undefined') return null;
    return window.NewspaperSections || null;
  }

  function _getSectionManifest(sectionId) {
    const api = _sectionsApi();
    if (api && typeof api.getSectionManifest === 'function') {
      return api.getSectionManifest(sectionId);
    }
    return null;
  }

  function _getSectionManifests() {
    const api = _sectionsApi();
    if (api && typeof api.getSectionManifests === 'function') {
      return api.getSectionManifests();
    }
    return [];
  }

  function _getActiveSectionId(pathname) {
    const api = _sectionsApi();
    if (api && typeof api.getActiveSectionId === 'function') {
      return api.getActiveSectionId(pathname);
    }
    const path = String(pathname || (typeof window !== 'undefined' && window.location ? window.location.pathname : '') || '');
    const sections = _getSectionManifests();
    for (let i = 0; i < sections.length; i += 1) {
      if (path.includes('/' + sections[i].id + '/')) return sections[i].id;
    }
    return 'herald';
  }

  function _getAuthSession() {
    if (window.Nehemiah && typeof window.Nehemiah.getSession === 'function') {
      return window.Nehemiah.getSession() || null;
    }
    return null;
  }

  function _getAuthProfile() {
    if (window.Nehemiah && typeof window.Nehemiah.getProfile === 'function') {
      return window.Nehemiah.getProfile() || null;
    }
    return null;
  }

  function _getGroups() {
    const session = _getAuthSession();
    const profile = _getAuthProfile();
    const raw = (session && session.groups) || (profile && profile.groups) || '';
    if (!raw) return [];
    return String(raw).split(',').map(group => group.trim().toLowerCase()).filter(Boolean);
  }

  function _getEffectiveRoleLevel() {
    const session = _getAuthSession();
    const profile = _getAuthProfile();
    const groups = _getGroups();

    if (groups.some(group => ELEVATED_GROUPS.has(group))) return 5;

    if (session && typeof session.roleLevel === 'number') return session.roleLevel;
    if (profile && typeof profile.roleLevel === 'number') return profile.roleLevel;

    const role = (session && session.role) || (profile && profile.role) || '';
    const levels = { readonly: 0, volunteer: 1, care: 2, leader: 3, pastor: 4, admin: 5 };
    if (role && levels[String(role).toLowerCase()] !== undefined) return levels[String(role).toLowerCase()];

    if (window._HERALD_AUTH_LEVEL !== undefined) return window._HERALD_AUTH_LEVEL;
    return -1;
  }

  function getUserRole() {
    return _getEffectiveRoleLevel();
  }

  function _isSectionVisible(section, authLevel) {
    if (!section) return false;
    const role = typeof authLevel === 'number' ? authLevel : -1;

    if (window._HERALD_SANCTUARY_LOGIN_REQUIRED) {
      return SANCTUARY_LOGIN_TABS.has(section.id);
    }

    if (role < section.minRole && !section.publicAllowed) {
      return false;
    }

    return true;
  }

  function _mountNav(navEl, authLevel) {
    if (!navEl) return null;

    const api = _sectionsApi();
    const sections = _getSectionManifests();
    const activeId = _getActiveSectionId();
    const role = typeof authLevel === 'number' ? authLevel : getUserRole();

    navEl.innerHTML = '';
    navEl.className = 'sec-nav-bar';
    navEl.setAttribute('role', 'navigation');
    navEl.setAttribute('aria-label', 'Herald sections');

    for (let i = 0; i < sections.length; i += 1) {
      const section = sections[i];
      if (!_isSectionVisible(section, role)) continue;

      const link = document.createElement('a');
      link.href = section.url;
      link.className = 'sec-nav-tab' + (section.id === activeId ? ' is-active' : '');
      link.setAttribute('role', 'tab');
      link.setAttribute('aria-selected', section.id === activeId ? 'true' : 'false');
      link.setAttribute('aria-label', section.label);
      link.dataset.sectionId = section.id;

      const icon = document.createElement('span');
      icon.className = 'tab-icon-badge';
      icon.style.setProperty('--badge-bg', section.iconBg || 'var(--gold)');
      icon.innerHTML = section.svg || '';

      const label = document.createElement('span');
      label.textContent = section.shortLabel || section.label || section.id;

      link.appendChild(icon);
      link.appendChild(label);
      navEl.appendChild(link);
    }

    const activeTab = navEl.querySelector('.is-active');
    if (activeTab && typeof activeTab.scrollIntoView === 'function') {
      setTimeout(() => {
        try {
          activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } catch (_) {}
      }, 100);
    }

    if (api && typeof api.buildSectionNav === 'function') {
      // Touch the shared contract so the shell and the gates stay in sync.
      // No-op if the shared API is already mounted elsewhere.
    }

    return navEl;
  }

  function buildNavBar() {
    const nav = document.getElementById('sec-nav');
    if (!nav) return null;
    return _mountNav(nav, getUserRole());
  }

  function rebuildNavBar() {
    return buildNavBar();
  }

  function _safeLocalStorageGet(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function _safeLocalStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function _applyScale(scale) {
    const next = Number(scale);
    if (!Number.isFinite(next)) return;
    document.documentElement.style.setProperty('--fn-scale', String(next));
    _safeLocalStorageSet(FONT_KEY, String(next));
  }

  function getCurrentFontScale() {
    const stored = parseFloat(_safeLocalStorageGet(FONT_KEY, '1'));
    const idx = FONT_STEPS.indexOf(stored);
    return idx >= 0 ? FONT_STEPS[idx] : 1;
  }

  function getCurrentScaleIndex() {
    const stored = parseFloat(_safeLocalStorageGet(FONT_KEY, '1'));
    const idx = FONT_STEPS.indexOf(stored);
    return idx >= 0 ? idx : 1;
  }

  function _closeFontScalePicker() {
    if (_fontPickerEl && _fontPickerEl.parentNode) {
      _fontPickerEl.parentNode.removeChild(_fontPickerEl);
    }
    _fontPickerEl = null;
    _fontPickerTrigger = null;

    if (_fontPickerCloseTimer) {
      clearTimeout(_fontPickerCloseTimer);
      _fontPickerCloseTimer = null;
    }

    document.removeEventListener('keydown', _handleFontPickerKeydown, true);
    document.removeEventListener('pointerdown', _handleFontPickerPointerDown, true);
  }

  function _handleFontPickerKeydown(event) {
    if (event.key === 'Escape') {
      _closeFontScalePicker();
    }
  }

  function _handleFontPickerPointerDown(event) {
    if (!_fontPickerEl) return;
    const target = event.target;
    if (_fontPickerEl.contains(target)) return;
    if (_fontPickerTrigger && _fontPickerTrigger.contains(target)) return;
    _closeFontScalePicker();
  }

  function openFontScalePicker(triggerEl) {
    const trigger = triggerEl || document.getElementById('font-scale-btn');
    if (!trigger) return;

    if (_fontPickerEl) {
      if (_fontPickerTrigger === trigger) {
        _closeFontScalePicker();
        return;
      }
      _closeFontScalePicker();
    }

    const currentIndex = getCurrentScaleIndex();
    const currentScale = FONT_STEPS[currentIndex];
    const rect = trigger.getBoundingClientRect();
    const width = 212;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
    const aboveTop = rect.top - 8 - (FONT_STEPS.length * 44 + 56);
    const top = aboveTop > 8 ? aboveTop : Math.min(window.innerHeight - 8, rect.bottom + 8);

    const wrap = document.createElement('div');
    wrap.className = 'font-scale-picker';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Choose text size');
    wrap.style.position = 'fixed';
    wrap.style.zIndex = '1200';
    wrap.style.left = left + 'px';
    wrap.style.top = top + 'px';
    wrap.style.width = width + 'px';
    wrap.style.maxWidth = 'calc(100vw - 16px)';
    wrap.style.background = 'var(--paper-card)';
    wrap.style.border = '1px solid var(--rule)';
    wrap.style.borderRadius = '12px';
    wrap.style.boxShadow = '0 10px 30px rgba(0,0,0,0.18)';
    wrap.style.padding = '0.5rem';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '0.25rem';

    const title = document.createElement('div');
    title.textContent = 'Text size';
    title.style.fontFamily = 'var(--font-body)';
    title.style.fontSize = '0.6875rem';
    title.style.fontWeight = '700';
    title.style.letterSpacing = '0.12em';
    title.style.textTransform = 'uppercase';
    title.style.color = 'var(--ink-muted)';
    title.style.padding = '0.25rem 0.35rem 0.5rem';

    wrap.appendChild(title);

    for (let i = 0; i < FONT_STEPS.length; i += 1) {
      const scale = FONT_STEPS[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'font-scale-picker__item' + (scale === currentScale ? ' is-active' : '');
      btn.textContent = FONT_LABELS[i];
      btn.dataset.scale = String(scale);
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'space-between';
      btn.style.gap = '0.75rem';
      btn.style.width = '100%';
      btn.style.minHeight = '44px';
      btn.style.border = '1px solid var(--rule)';
      btn.style.borderRadius = '10px';
      btn.style.padding = '0.5rem 0.75rem';
      btn.style.background = scale === currentScale ? 'var(--sec-color, var(--gold))' : 'var(--paper-sunken)';
      btn.style.color = scale === currentScale ? 'var(--ink-inverse)' : 'var(--ink)';
      btn.style.fontFamily = 'var(--font-body)';
      btn.style.fontSize = '0.875rem';
      btn.style.fontWeight = '600';
      btn.style.cursor = 'pointer';
      btn.style.textAlign = 'left';
      btn.style.boxSizing = 'border-box';

      const mark = document.createElement('span');
      mark.textContent = scale === currentScale ? 'Current' : '';
      mark.style.fontSize = '0.6875rem';
      mark.style.fontWeight = '700';
      mark.style.letterSpacing = '0.06em';
      mark.style.textTransform = 'uppercase';
      mark.style.color = scale === currentScale ? 'rgba(255,255,255,0.86)' : 'var(--ink-muted)';

      btn.appendChild(mark);

      btn.addEventListener('click', () => {
        _applyScale(scale);
        showToast('Text size: ' + FONT_LABELS[i]);
        _closeFontScalePicker();
      });

      wrap.appendChild(btn);
    }

    document.body.appendChild(wrap);
    _fontPickerEl = wrap;
    _fontPickerTrigger = trigger;

    setTimeout(() => {
      document.addEventListener('keydown', _handleFontPickerKeydown, true);
      document.addEventListener('pointerdown', _handleFontPickerPointerDown, true);
    }, 0);
  }

  function showToast(message, durationMs) {
    const layer = document.getElementById('toast-layer');
    if (!layer) return null;

    const toast = document.createElement('div');
    toast.className = 'toast toast-message';
    toast.textContent = String(message || '');
    layer.appendChild(toast);

    const duration = typeof durationMs === 'number' ? durationMs : 2200;
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 350);
    }, duration);

    return toast;
  }

  function closeDrawer() {
    const drawer = document.querySelector('.right-drawer');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
    if (_drawerLastTrigger && typeof _drawerLastTrigger.focus === 'function') {
      try { _drawerLastTrigger.focus(); } catch (_) {}
    }
    _drawerLastTrigger = null;
  }

  function openDrawer(titleText, contentHTML) {
    const drawer = document.querySelector('.right-drawer');
    const titleEl = document.getElementById('drawer-title');
    const bodyEl = document.getElementById('drawer-body');
    if (!drawer || !titleEl || !bodyEl) return;

    _closeFontScalePicker();

    titleEl.textContent = String(titleText || '');
    bodyEl.innerHTML = String(contentHTML || '');
    bodyEl.scrollTop = 0;

    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');

    const firstFocusable = drawer.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable && typeof firstFocusable.focus === 'function') {
      try { firstFocusable.focus(); } catch (_) {}
    }
  }

  function initDrawer() {
    if (_drawerListenersBound) return;
    _drawerListenersBound = true;

    const closeBtn = document.querySelector('.drawer-close');
    const backdrop = document.querySelector('.drawer-backdrop');

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeDrawer();
        _closeFontScalePicker();
      }
    });
  }

  function initFontScale() {
    const btn = document.getElementById('font-scale-btn');
    if (!btn) return;

    const stored = parseFloat(_safeLocalStorageGet(FONT_KEY, '1'));
    const idx = FONT_STEPS.indexOf(stored);
    _applyScale(idx >= 0 ? FONT_STEPS[idx] : 1);

    btn.addEventListener('click', () => openFontScalePicker(btn));
  }

  function buildNavBarIfNeeded() {
    const nav = document.getElementById('sec-nav');
    if (!nav) return null;
    return _mountNav(nav, getUserRole());
  }

  function init() {
    buildNavBarIfNeeded();
    initDrawer();
    initFontScale();
  }

  function getSectionManifestById(sectionId) {
    return _getSectionManifest(sectionId);
  }

  function getSectionFromUrl(url) {
    const api = _sectionsApi();
    if (api && typeof api.getSectionFromUrl === 'function') {
      return api.getSectionFromUrl(url);
    }
    const sections = _getSectionManifests();
    const target = String(url || '');
    for (let i = 0; i < sections.length; i += 1) {
      if (sections[i].url === target) return sections[i];
    }
    return null;
  }

  function buildSectionNav(activeSectionId, authLevel) {
    const api = _sectionsApi();
    if (api && typeof api.buildSectionNav === 'function') {
      return api.buildSectionNav(activeSectionId, authLevel);
    }
    const nav = document.createElement('nav');
    nav.id = 'sec-nav';
    nav.className = 'sec-nav-bar';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Herald sections');
    return _mountNav(nav, typeof authLevel === 'number' ? authLevel : getUserRole());
  }

  const api = {
    openDrawer,
    closeDrawer,
    showToast,
    toast: showToast,
    getUserRole,
    rebuildNavBar,
    buildNavBar: buildNavBarIfNeeded,
    openFontScalePicker,
    closeFontScalePicker: _closeFontScalePicker,
    applyFontScale: _applyScale,
    getCurrentFontScale,
    getCurrentScaleIndex,
    getSectionManifest: getSectionManifestById,
    getSectionManifests: _getSectionManifests,
    getSectionFromUrl,
    getActiveSectionId: _getActiveSectionId,
    buildSectionNav,
    init,
  };

  if (typeof window !== 'undefined') {
    window.FlockGates = api;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
