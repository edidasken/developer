/* ══════════════════════════════════════════════════════════════════════════════
   THE SECTION SHELL — shared Newspaper page bootstrap
   Owns shared page-frame work only: metadata, nav mounting, safe-area padding,
   and layout refresh. Section content remains in its own URL and its own script.
   ══════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const DEFAULTS = {
    sectionId: null,
    title: '',
    authLevel: -1,
    pageRoot: null,
    navSelector: '#sec-nav',
    mastheadSelector: '.sec-masthead',
    onReady: null,
  };

  function _getSectionsApi() {
    if (typeof window === 'undefined') return null;
    return window.NewspaperSections || null;
  }

  function _getAuthLevel(options) {
    if (options && typeof options.authLevel === 'number') return options.authLevel;
    if (typeof window !== 'undefined') {
      if (window.FlockGates && typeof window.FlockGates.getUserRole === 'function') {
        const role = window.FlockGates.getUserRole();
        if (typeof role === 'number') return role;
      }
      if (typeof window._HERALD_AUTH_LEVEL === 'number') return window._HERALD_AUTH_LEVEL;
    }
    return -1;
  }

  function _getSectionId(options) {
    if (options && options.sectionId) return String(options.sectionId);
    const docId = typeof document !== 'undefined' && document.documentElement
      ? document.documentElement.getAttribute('data-newspaper-section')
      : '';
    return docId || '';
  }

  function _setPageTitle(section, fallbackTitle) {
    if (typeof document === 'undefined') return;
    const titleText = fallbackTitle || (section && section.label) || 'The Newspaper';
    document.title = `${titleText} — The Flock Herald`;
    if (document.documentElement && section) {
      document.documentElement.setAttribute('data-newspaper-section', section.id);
      document.documentElement.dataset.newspaperSection = section.id;
    }
  }

  function _resolveNode(selector, fallback) {
    if (typeof document === 'undefined') return null;
    if (typeof selector === 'string' && selector) {
      const node = document.querySelector(selector);
      if (node) return node;
    }
    return fallback || null;
  }

  function _ensureIconLinks() {
    if (typeof document === 'undefined' || !document.head) return;

    const iconHref = '../../Images/icon-preview.png';
    const existingIcon = document.querySelector('link[rel="icon"][href="' + iconHref + '"]');
    if (existingIcon) return;

    const iconLink = document.createElement('link');
    iconLink.setAttribute('rel', 'icon');
    iconLink.setAttribute('type', 'image/png');
    iconLink.setAttribute('href', iconHref);

    const touchLink = document.createElement('link');
    touchLink.setAttribute('rel', 'apple-touch-icon');
    touchLink.setAttribute('href', iconHref);

    document.head.appendChild(iconLink);
    document.head.appendChild(touchLink);
  }

  function _mountNav(sectionApi, mount, activeSectionId, authLevel) {
    if (!sectionApi || typeof sectionApi.buildSectionNav !== 'function') return null;

    const builtNav = sectionApi.buildSectionNav(activeSectionId, authLevel);
    if (!builtNav || !mount) return builtNav || null;

    mount.id = builtNav.id || mount.id || 'sec-nav';
    mount.className = builtNav.className || 'sec-nav-bar';
    mount.setAttribute('role', builtNav.getAttribute('role') || 'navigation');
    mount.setAttribute('aria-label', builtNav.getAttribute('aria-label') || 'Herald sections');

    while (mount.firstChild) mount.removeChild(mount.firstChild);
    Array.from(builtNav.childNodes).forEach(node => {
      mount.appendChild(node.cloneNode(true));
    });

    return mount;
  }

  function _applySafePadding(masthead, nav) {
    if (typeof document === 'undefined' || !document.body) return 0;

    const mastheadHeight = masthead ? masthead.offsetHeight || 0 : 0;
    const navHeight = nav ? nav.offsetHeight || 0 : 0;
    const mastheadStyle = masthead ? window.getComputedStyle(masthead) : null;
    const navStyle = nav ? window.getComputedStyle(nav) : null;
    const mastheadFixed = mastheadStyle ? mastheadStyle.position === 'fixed' : false;
    const navFixed = navStyle ? navStyle.position === 'fixed' || navStyle.position === 'sticky' : false;

    if (nav && mastheadHeight > 0) {
      nav.style.top = `${mastheadHeight}px`;
    }

    const totalPadding = (mastheadFixed ? mastheadHeight : 0) + (navFixed ? navHeight : 0);
    document.body.style.paddingTop = totalPadding > 0 ? `${totalPadding}px` : '';
    return totalPadding;
  }

  function initializeSectionShell(options) {
    _ensureIconLinks();

    const cfg = Object.assign({}, DEFAULTS, options || {});
    const sectionsApi = _getSectionsApi();
    const sectionId = _getSectionId(cfg);
    const section = sectionsApi && typeof sectionsApi.getSectionManifest === 'function'
      ? sectionsApi.getSectionManifest(sectionId)
      : null;
    const authLevel = _getAuthLevel(cfg);

    _setPageTitle(section, cfg.title);

    const masthead = _resolveNode(cfg.mastheadSelector);
    const navMount = _resolveNode(cfg.navSelector);
    const pageRoot = cfg.pageRoot && typeof cfg.pageRoot === 'string'
      ? _resolveNode(cfg.pageRoot)
      : (cfg.pageRoot || null);

    if (pageRoot && section) {
      pageRoot.dataset.sectionId = section.id;
      pageRoot.dataset.sectionLayout = section.layout;
    }

    const refreshLayout = () => {
      const currentNav = _resolveNode(cfg.navSelector, navMount);
      return _applySafePadding(masthead, currentNav);
    };

    const refreshNav = () => {
      const currentNav = _resolveNode(cfg.navSelector, navMount);
      const nextNav = _mountNav(sectionsApi, currentNav, sectionId || (section && section.id), authLevel);
      refreshLayout();
      return nextNav;
    };

    const destroy = () => {
      window.removeEventListener('resize', refreshLayout);
      if (document.fonts && typeof document.fonts.removeEventListener === 'function') {
        try { document.fonts.removeEventListener('loadingdone', refreshLayout); } catch (_) {}
      }
    };

    refreshNav();

    window.addEventListener('resize', refreshLayout, { passive: true });

    if (document.fonts) {
      if (typeof document.fonts.ready?.then === 'function') {
        document.fonts.ready.then(refreshLayout).catch(() => {});
      }
      if (typeof document.fonts.addEventListener === 'function') {
        try { document.fonts.addEventListener('loadingdone', refreshLayout); } catch (_) {}
      }
    } else {
      setTimeout(refreshLayout, 250);
    }

    requestAnimationFrame(refreshLayout);

    if (typeof cfg.onReady === 'function') {
      try {
        cfg.onReady({
          section,
          sectionId: sectionId || (section && section.id) || '',
          authLevel,
          pageRoot,
          refreshLayout,
          refreshNav,
          destroy,
        });
      } catch (error) {
        console.warn('[NewspaperShell] onReady failed:', error);
      }
    }

    return {
      section,
      sectionId: sectionId || (section && section.id) || '',
      authLevel,
      pageRoot,
      refreshLayout,
      refreshNav,
      destroy,
    };
  }

  function getSectionShellContext() {
    const sectionsApi = _getSectionsApi();
    const sectionId = _getSectionId({});
    return {
      sectionId,
      section: sectionsApi && typeof sectionsApi.getSectionManifest === 'function'
        ? sectionsApi.getSectionManifest(sectionId)
        : null,
      authLevel: _getAuthLevel({}),
    };
  }

  const api = {
    initializeSectionShell,
    getSectionShellContext,
  };

  if (typeof window !== 'undefined') {
    window.NewspaperShell = api;
    window.initializeSectionShell = initializeSectionShell;
    window.getSectionShellContext = getSectionShellContext;
  }
})();
