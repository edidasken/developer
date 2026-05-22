/**
 * the_gates.js — Newspaper Section Navigation Bar
 *
 * Builds the .sec-nav-bar with all 16 section tabs.
 * - Tabs are filtered by the current user's role (via Nehemiah) after auth resolves.
 * - Public sections (minRole: 0) render immediately without waiting for auth.
 * - Active tab is determined from window.location.pathname.
 * - Sets #herald-church from window.HERALD_CHURCH_NAME.
 *
 * Role levels (from firm_foundation.js):
 *   readonly:0  volunteer:1  care:2  deacon:2  leader:3  pastor:4  admin:5
 */

(function () {
  'use strict';

  // ── Section Registry ──────────────────────────────────────────────────────
  // Each entry: { slug, label, path, minRole }
  // path is relative to Newspaper/index.html (root of the paper)
  // minRole: -1 = public (no auth required)
  var SECTIONS = [
    { slug: 'herald',          label: 'The Herald',          path: 'index.html',                      minRole: -1 },
    { slug: 'tabernacle',      label: 'The Tabernacle',      path: 'Sections/tabernacle/index.html',  minRole:  0 },
    { slug: 'pulpit',          label: 'The Pulpit',          path: 'Sections/pulpit/index.html',      minRole:  3 },
    { slug: 'levites',         label: 'The Cantors',         path: 'Sections/levites/index.html',     minRole:  3 },
    { slug: 'stage',           label: 'The Stage',           path: 'Sections/stage/index.html',       minRole:  3 },
    { slug: 'epistles',        label: 'The Letters',         path: 'Sections/epistles/index.html',    minRole:  0 },
    { slug: 'straight_path',   label: 'The Path',            path: 'Sections/straight_path/index.html', minRole: -1 },
    { slug: 'great_commission',label: 'The Mission',         path: 'Sections/great_commission/index.html', minRole: 4 },
    { slug: 'living_water',    label: 'The Wellspring',      path: 'Sections/living_water/index.html', minRole: -1 },
    { slug: 'scroll_room',     label: 'The Archive',         path: 'Sections/scroll_room/index.html', minRole:  4 },
    { slug: 'gatehouse',       label: 'The Bulletin',        path: 'Sections/gatehouse/index.html',   minRole:  0 },
    { slug: 'genealogies',     label: 'The Family Tree',     path: 'Sections/genealogies/index.html', minRole:  0 },
    { slug: 'harvest',         label: 'The Harvest',         path: 'Sections/harvest/index.html',     minRole:  4 },
    { slug: 'cornerstone',     label: "The Shepherd's Desk", path: 'Sections/cornerstone/index.html', minRole:  4 },
    { slug: 'editors_desk',    label: "Editor's Desk",       path: 'Sections/editors_desk/index.html', minRole: 4 },
    { slug: 'council',         label: 'The Council',         path: 'Sections/council/index.html',     minRole:  4 },
  ];

  // ── Determine Active Section from URL ─────────────────────────────────────
  function getActiveSlug() {
    var path = window.location.pathname;
    // Herald front page: ends in /Newspaper/ or /Newspaper/index.html
    if (/\/Newspaper\/?$/.test(path) || /\/Newspaper\/index\.html$/.test(path)) {
      return 'herald';
    }
    // Section pages: .../Newspaper/Sections/<slug>/index.html
    var m = path.match(/\/Sections\/([^/]+)\//);
    if (m) return m[1];
    return 'herald';
  }

  // ── Build Tab Href ─────────────────────────────────────────────────────────
  // Resolve path from current location back to Newspaper root, then to the section.
  function resolveHref(section) {
    var path = window.location.pathname;
    // Are we inside a Sections/* subfolder?
    if (/\/Sections\//.test(path)) {
      return '../../' + section.path;
    }
    // We're at Newspaper root
    return section.path;
  }

  // ── Get user role level ────────────────────────────────────────────────────
  function getUserRoleLevel() {
    if (typeof Nehemiah !== 'undefined' && Nehemiah.getSession) {
      var sess = Nehemiah.getSession();
      if (sess && typeof sess.roleLevel === 'number') return sess.roleLevel;
      if (sess && sess.role) {
        var LEVELS = { readonly: 0, volunteer: 1, care: 2, deacon: 2,
                       leader: 3, treasurer: 3, pastor: 4, admin: 5 };
        return LEVELS[sess.role] !== undefined ? LEVELS[sess.role] : -1;
      }
    }
    return -1; // unauthenticated
  }

  // ── Render Section Bar ─────────────────────────────────────────────────────
  function renderGates(userLevel) {
    var nav = document.getElementById('sec-nav');
    if (!nav) return;

    var activeSlug = getActiveSlug();
    var fragment = document.createDocumentFragment();

    SECTIONS.forEach(function (sec) {
      // minRole -1 = public; -1 user level means unauthenticated (can see public only)
      var canAccess = sec.minRole === -1 || (userLevel >= 0 && userLevel >= sec.minRole);
      if (!canAccess) return; // hide tabs user cannot reach

      var a = document.createElement('a');
      a.className = 'sec-nav-tab' + (sec.slug === activeSlug ? ' is-active' : '');
      a.setAttribute('data-section', sec.slug);
      a.setAttribute('href', resolveHref(sec));
      a.textContent = sec.label;

      // Soft "access denied" for authenticated users below required role
      // (this case is filtered out above; only visible tabs are rendered)

      fragment.appendChild(a);
    });

    // Replace contents
    nav.innerHTML = '';
    nav.appendChild(fragment);

    // Scroll active tab into view
    var activeTab = nav.querySelector('.is-active');
    if (activeTab) {
      setTimeout(function () {
        activeTab.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
      }, 80);
    }
  }

  // ── Set Church Name in Masthead ────────────────────────────────────────────
  function setChurchName() {
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME
      : null;
    if (!churchName && typeof Nehemiah !== 'undefined' && Nehemiah.getSession) {
      var sess = Nehemiah.getSession();
      if (sess && sess.churchName) churchName = sess.churchName;
    }
    var el = document.getElementById('herald-church');
    if (el && churchName) el.textContent = churchName;
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function boot() {
    setChurchName();

    // Render public sections immediately (no auth wait)
    var initialLevel = getUserRoleLevel();
    renderGates(initialLevel);

    // If Nehemiah provides an async auth callback, re-render with full role
    if (typeof Nehemiah !== 'undefined' && typeof Nehemiah.onAuthResolved === 'function') {
      Nehemiah.onAuthResolved(function (sess) {
        setChurchName();
        var LEVELS = { readonly: 0, volunteer: 1, care: 2, deacon: 2,
                       leader: 3, treasurer: 3, pastor: 4, admin: 5 };
        var level = (sess && sess.role) ? (LEVELS[sess.role] !== undefined ? LEVELS[sess.role] : 0) : -1;
        renderGates(level);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
