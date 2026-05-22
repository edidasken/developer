/**
 * the_gates.js — Newspaper Section Navigation + Page Flip
 *
 * Responsibilities:
 *  1. Builds the .sec-nav-bar with role-filtered section tabs
 *  2. Injects the .np-flip-nav prev/next bar below the sec-nav
 *  3. Handles swipe gestures (left/right) + keyboard (← →) to flip pages
 *  4. Navigates with direction-aware View Transitions (CSS cross-document flip)
 *  5. Injects a default section splash on empty stub section pages
 *  6. Sets #herald-church from window.HERALD_CHURCH_NAME
 *
 * Exposes window.HERALD_SECTIONS for use by the_proclamation.js
 *
 * Role levels (from firm_foundation.js):
 *   unauthenticated:-1  readonly:0  volunteer:1  care:2  deacon:2
 *   leader:3  treasurer:3  pastor:4  admin:5
 */

(function () {
  'use strict';

  // ── Restore nav direction IMMEDIATELY (before DOMContentLoaded) ──────────
  // Must run before view-transition-new animations play on the incoming page.
  (function () {
    try {
      var dir = sessionStorage.getItem('np-nav-dir') || 'forward';
      document.documentElement.setAttribute('data-nav-dir', dir);
      sessionStorage.removeItem('np-nav-dir');
    } catch (_) {}
  })();

  // ── Section Registry ──────────────────────────────────────────────────────
  var SECTIONS = [
    { slug: 'herald',           label: 'The Herald',            tagline: 'All the news of the congregation, set in type each morning.',          path: 'index.html',                        minRole: -1 },
    { slug: 'tabernacle',       label: 'The Tabernacle',        tagline: 'Worship, devotional, and the life of prayer.',                         path: 'Sections/tabernacle/index.html',    minRole:  0 },
    { slug: 'pulpit',           label: 'The Pulpit',            tagline: 'Sermons, teachings, and the preached Word.',                           path: 'Sections/pulpit/index.html',        minRole:  3 },
    { slug: 'levites',          label: 'The Cantors',           tagline: 'Music, worship planning, and the ministry of song.',                   path: 'Sections/levites/index.html',       minRole:  3 },
    { slug: 'stage',            label: 'The Stage',             tagline: 'Media, presentations, and visual ministry.',                           path: 'Sections/stage/index.html',         minRole:  3 },
    { slug: 'epistles',         label: 'The Letters',           tagline: 'Church communications, announcements, and correspondence.',            path: 'Sections/epistles/index.html',      minRole:  0 },
    { slug: 'straight_path',    label: 'The Path',              tagline: 'Discipleship, growth, and the journey of faith.',                      path: 'Sections/straight_path/index.html', minRole: -1 },
    { slug: 'great_commission', label: 'The Mission',           tagline: 'Outreach, evangelism, and the harvest field.',                         path: 'Sections/great_commission/index.html', minRole: 4 },
    { slug: 'living_water',     label: 'The Wellspring',        tagline: 'Scripture, reflection, and living water for the soul.',                path: 'Sections/living_water/index.html',  minRole: -1 },
    { slug: 'scroll_room',      label: 'The Archive',           tagline: 'Documents, records, and the written history of the church.',           path: 'Sections/scroll_room/index.html',   minRole:  4 },
    { slug: 'gatehouse',        label: 'The Bulletin',          tagline: 'Announcements, events, and the weekly bulletin board.',                path: 'Sections/gatehouse/index.html',     minRole:  0 },
    { slug: 'genealogies',      label: 'The Family Tree',       tagline: 'Congregation records, families, and the generations.',                 path: 'Sections/genealogies/index.html',   minRole:  0 },
    { slug: 'harvest',          label: 'The Harvest',           tagline: 'Giving, stewardship, and the fruit of generosity.',                    path: 'Sections/harvest/index.html',       minRole:  4 },
    { slug: 'cornerstone',      label: "The Shepherd's Desk",   tagline: "The pastor's operational dashboard — care, mission, and the flock.",   path: 'Sections/cornerstone/index.html',   minRole:  4 },
    { slug: 'editors_desk',     label: "Editor's Desk",         tagline: 'Control the Herald — publish, schedule, and manage the paper.',        path: 'Sections/editors_desk/index.html',  minRole:  4 },
    { slug: 'council',          label: 'The Council',           tagline: 'The Codex — as-built documentation and the architecture of the flock.', path: 'Sections/council/index.html',      minRole:  4 },
  ];

  // Expose for use by the_proclamation.js (loads after this script)
  window.HERALD_SECTIONS = SECTIONS;

  // ── Role helpers ─────────────────────────────────────────────────────────
  var ROLE_MAP = { readonly: 0, volunteer: 1, care: 2, deacon: 2,
                   leader: 3, treasurer: 3, pastor: 4, admin: 5 };

  function getUserRoleLevel() {
    if (typeof Nehemiah !== 'undefined' && Nehemiah.getSession) {
      try {
        var sess = Nehemiah.getSession();
        if (sess && typeof sess.roleLevel === 'number') return sess.roleLevel;
        if (sess && sess.role && ROLE_MAP[sess.role] !== undefined) return ROLE_MAP[sess.role];
      } catch (_) {}
    }
    return -1;
  }

  function visibleSections(userLevel) {
    return SECTIONS.filter(function (s) {
      return s.minRole === -1 || (userLevel >= 0 && userLevel >= s.minRole);
    });
  }

  // ── Determine active section slug from URL ────────────────────────────────
  function getActiveSlug() {
    var path = window.location.pathname;
    if (/\/Newspaper\/?$/.test(path) || /\/Newspaper\/index\.html$/.test(path)) return 'herald';
    // local dev server (no /Newspaper/ prefix)
    if (/^\/?$/.test(path) || /\/index\.html$/.test(path) && !/Sections/.test(path)) return 'herald';
    var m = path.match(/\/Sections\/([^/]+)\//);
    if (m) return m[1];
    return 'herald';
  }

  var _activeSlug = getActiveSlug();

  // ── Build hrefs ──────────────────────────────────────────────────────────
  // Resolve from current location to a section path (relative)
  function hrefTo(sec) {
    var inSection = /\/Sections\//.test(window.location.pathname);
    if (sec.slug === 'herald') {
      return inSection ? '../../index.html' : 'index.html';
    }
    if (inSection) {
      return '../' + sec.slug + '/index.html';
    }
    return sec.path; // from root: Sections/{slug}/index.html
  }

  // ── Section nav bar ──────────────────────────────────────────────────────
  function renderGates(userLevel) {
    var nav = document.getElementById('sec-nav');
    if (!nav) return;

    var visible = visibleSections(userLevel);
    var fragment = document.createDocumentFragment();

    visible.forEach(function (sec) {
      var a = document.createElement('a');
      a.className = 'sec-nav-tab' + (sec.slug === _activeSlug ? ' is-active' : '');
      a.setAttribute('data-section', sec.slug);
      a.setAttribute('href', hrefTo(sec));
      a.textContent = sec.label;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        flipTo(hrefTo(sec), sec.slug, _activeSlug);
      });
      fragment.appendChild(a);
    });

    nav.innerHTML = '';
    nav.appendChild(fragment);

    var activeTab = nav.querySelector('.is-active');
    if (activeTab) {
      setTimeout(function () {
        activeTab.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
      }, 80);
    }
  }

  // ── Flip navigation bar (prev / next) ────────────────────────────────────
  function injectFlipNav(userLevel) {
    // Don't inject twice
    if (document.getElementById('np-flip-nav')) return;

    var visible = visibleSections(userLevel);
    var idx     = visible.findIndex(function (s) { return s.slug === _activeSlug; });

    // If the active section isn't in the visible list (e.g. auth hasn't resolved yet
    // or user navigated directly to a gated URL), fall back to full SECTIONS order
    // so the counter and prev/next still make sense.
    if (idx === -1) {
      var fullIdx  = SECTIONS.findIndex(function (s) { return s.slug === _activeSlug; });
      var prevFull = fullIdx > 0 ? SECTIONS[fullIdx - 1] : null;
      var nextFull = fullIdx < SECTIONS.length - 1 ? SECTIONS[fullIdx + 1] : null;
      // Use adjacent sections that ARE visible, or the full list neighbors
      var prevSec = prevFull;
      var nextSec = nextFull;
      var total   = SECTIONS.length;
      var pos     = fullIdx + 1;
    } else {
      var prevSec = idx > 0 ? visible[idx - 1] : null;
      var nextSec = idx < visible.length - 1 ? visible[idx + 1] : null;
      var total   = visible.length;
      var pos     = idx + 1;
    }

    var chevLeft  = '<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>';
    var chevRight = '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>';

    var prevBtn = '<a id="np-flip-prev" class="np-flip-btn' + (prevSec ? '' : ' np-flip-btn--disabled') + '"' +
      (prevSec ? ' href="' + hrefTo(prevSec) + '"' : '') + '>' +
      chevLeft + '<span class="np-flip-btn__label">' + (prevSec ? prevSec.label : 'First Page') + '</span></a>';

    var nextBtn = '<a id="np-flip-next" class="np-flip-btn np-flip-btn--next' + (nextSec ? '' : ' np-flip-btn--disabled') + '"' +
      (nextSec ? ' href="' + hrefTo(nextSec) + '"' : '') + '>' +
      '<span class="np-flip-btn__label">' + (nextSec ? nextSec.label : 'Last Page') + '</span>' + chevRight + '</a>';

    var counter = '<span class="np-flip-counter">Section ' + pos + ' of ' + total + '</span>';

    var nav = document.createElement('div');
    nav.id = 'np-flip-nav';
    nav.className = 'np-flip-nav';
    nav.innerHTML = prevBtn + counter + nextBtn;

    // Insert right after sec-nav
    var secNav = document.getElementById('sec-nav');
    if (secNav && secNav.parentNode) {
      secNav.parentNode.insertBefore(nav, secNav.nextSibling);
    } else {
      var body = document.body;
      body.insertBefore(nav, body.firstChild);
    }

    // Wire clicks to flipTo
    var prevEl = nav.querySelector('#np-flip-prev');
    var nextEl = nav.querySelector('#np-flip-next');
    if (prevEl && prevSec) {
      prevEl.addEventListener('click', function (e) {
        e.preventDefault();
        flipTo(hrefTo(prevSec), prevSec.slug, _activeSlug);
      });
    }
    if (nextEl && nextSec) {
      nextEl.addEventListener('click', function (e) {
        e.preventDefault();
        flipTo(hrefTo(nextSec), nextSec.slug, _activeSlug);
      });
    }

    _prevSec = prevSec;
    _nextSec = nextSec;
  }

  var _prevSec = null;
  var _nextSec = null;

  // ── Page flip navigation ─────────────────────────────────────────────────
  // Determines direction by comparing section indices in the master list
  function flipTo(href, targetSlug, fromSlug) {
    var fromIdx   = SECTIONS.findIndex(function (s) { return s.slug === fromSlug; });
    var targetIdx = SECTIONS.findIndex(function (s) { return s.slug === (targetSlug || 'herald'); });
    var dir = (targetIdx >= fromIdx) ? 'forward' : 'back';

    try { sessionStorage.setItem('np-nav-dir', dir); } catch (_) {}
    document.documentElement.setAttribute('data-nav-dir', dir);
    window.location.href = href;
  }

  // ── Swipe gesture handler ────────────────────────────────────────────────
  function initSwipe() {
    var startX = 0, startY = 0, moved = false;

    document.addEventListener('touchstart', function (e) {
      startX = e.changedTouches[0].clientX;
      startY = e.changedTouches[0].clientY;
      moved  = false;
    }, { passive: true });

    document.addEventListener('touchmove', function () {
      moved = true;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      if (!moved) return;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      // Only horizontal swipes with more horizontal travel than vertical
      if (Math.abs(dx) < 48 || Math.abs(dy) > Math.abs(dx) * 0.8) return;

      if (dx < 0 && _nextSec) {
        // Swipe left = next section
        flipTo(hrefTo(_nextSec), _nextSec.slug, _activeSlug);
      } else if (dx > 0 && _prevSec) {
        // Swipe right = previous section
        flipTo(hrefTo(_prevSec), _prevSec.slug, _activeSlug);
      }
    }, { passive: true });
  }

  // ── Keyboard navigation ──────────────────────────────────────────────────
  function initKeyboard() {
    document.addEventListener('keydown', function (e) {
      // Don't hijack keyboard when focus is in an input
      var tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowRight' && _nextSec) {
        flipTo(hrefTo(_nextSec), _nextSec.slug, _activeSlug);
      } else if (e.key === 'ArrowLeft' && _prevSec) {
        flipTo(hrefTo(_prevSec), _prevSec.slug, _activeSlug);
      }
    });
  }

  // ── Default section splash for empty stub pages ──────────────────────────
  function injectSectionSplash() {
    var main = document.getElementById('section-main');
    if (!main) return;
    if (main.children.length > 0) return; // already has content

    var sec = SECTIONS.find(function (s) { return s.slug === _activeSlug; });
    if (!sec) return;

    main.innerHTML =
      '<div class="np-section-splash">' +
        '<p class="np-section-splash__flag">The Flock Herald &mdash; ' + sec.label + '</p>' +
        '<h2 class="np-section-splash__title">' + sec.label + '</h2>' +
        '<hr class="np-section-splash__rule">' +
        '<p class="np-section-splash__tagline">' + sec.tagline + '</p>' +
        '<p class="np-section-splash__coming">This section is coming in a future edition.</p>' +
      '</div>';
  }

  // ── Set church name in masthead ──────────────────────────────────────────
  function setChurchName() {
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME
      : null;
    if (!churchName && typeof Nehemiah !== 'undefined' && Nehemiah.getSession) {
      try {
        var sess = Nehemiah.getSession();
        if (sess && sess.churchName) churchName = sess.churchName;
      } catch (_) {}
    }
    var el = document.getElementById('herald-church');
    if (el && churchName) el.textContent = churchName;
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  function boot() {
    setChurchName();

    var initialLevel = getUserRoleLevel();
    renderGates(initialLevel);
    injectFlipNav(initialLevel);
    initSwipe();
    initKeyboard();
    injectSectionSplash();

    // Re-render on auth resolution (reveals gated sections)
    if (typeof Nehemiah !== 'undefined' && typeof Nehemiah.onAuthResolved === 'function') {
      Nehemiah.onAuthResolved(function (sess) {
        setChurchName();
        var level = (sess && sess.role && ROLE_MAP[sess.role] !== undefined)
          ? ROLE_MAP[sess.role] : 0;
        renderGates(level);
        // Remove and re-inject flip nav with updated section list
        var old = document.getElementById('np-flip-nav');
        if (old) old.remove();
        injectFlipNav(level);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
