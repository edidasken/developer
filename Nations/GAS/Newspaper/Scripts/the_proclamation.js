/**
 * the_proclamation.js — Flock Herald Front Page (broadsheet layout)
 *
 * Renders the Herald front page (#herald-main) in a proper 3-column newspaper
 * broadsheet layout:
 *
 *   ┌──────────────────── BANNER (full width) ─────────────────────┐
 *   │  Today's Edition flag + church banner headline + deck        │
 *   └──────────────────────────────────────────────────────────────┘
 *   ┌─── COL 1 (2fr) ───┬── COL 2 (1fr) ──┬── COL 3 (1fr) ───────┐
 *   │ Lead article with  │  This morning's  │  Sections of         │
 *   │ drop cap & body    │  scripture       │  the paper           │
 *   │                    │  + tagline       │  (brief links)       │
 *   └────────────────────┴─────────────────┴──────────────────────┘
 *
 * Reads:
 *   - window.HERALD_CHURCH_NAME  (from C-Build Firebase injection)
 *   - window.HERALD_SECTIONS     (from the_gates.js — loaded before this)
 *   - localStorage('flock_herald_config') for Editor's Desk overrides
 *
 * Phase 0/1: static content with editor overrides.
 * Phase 2+: live Firestore content, dynamic scripture via Wellspring API.
 */

(function () {
  'use strict';

  // ── Helpers ───────────────────────────────────────────────────────────────
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

  function getEditorConfig() {
    try {
      var raw = localStorage.getItem('flock_herald_config');
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {};  }
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Herald date (secret date picker) ─────────────────────────────────────
  var HERALD_DATE_KEY = 'np_herald_date';

  function todayMidnight() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getHeraldDate() {
    try {
      var saved = localStorage.getItem(HERALD_DATE_KEY);
      if (saved) {
        var d = new Date(saved);
        if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d; }
      }
    } catch (_) {}
    return todayMidnight();
  }

  function setHeraldDate(d) {
    try { localStorage.setItem(HERALD_DATE_KEY, d.toISOString()); } catch (_) {}
  }

  function formatHeraldDate(d) {
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  // ── Column 1: Lead Article ────────────────────────────────────────────────
  function buildLeadCol(churchName, cfg) {
    var headline = (cfg && cfg.leadHeadline) || ('Welcome to ' + churchName.replace(/^The\s+/i, ''));
    var subhead  = (cfg && cfg.leadSubhead)  || 'Your church, every day.';
    var body1    = (cfg && cfg.leadBody1)    ||
      'The Flock Herald is the daily newspaper of the congregation \u2014 every section ' +
      'a chapter of the life you share together. Flip through the pages each morning ' +
      'to see what\u2019s happening across the church.';
    var body2    = (cfg && cfg.leadBody2)    ||
      'Scripture is the front page. Worship is the culture section. ' +
      'The letters column never closes. Turn the page and find your place ' +
      'in the story God is writing here.';

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Today\u2019s Edition</p>',
      '  <h2 class="np-headline">' + esc(headline) + '</h2>',
      '  <p class="np-byline">' + esc(subhead) + '</p>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body">',
      '    <p class="np-drop-cap">' + body1 + '</p>',
      '    <p>' + body2 + '</p>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Column 2: Scripture ───────────────────────────────────────────────────
  function buildScriptureCol(cfg) {
    var verse = (cfg && cfg.scriptureVerse) || 'Lamentations 3:22\u201323';
    var text  = (cfg && cfg.scriptureText)  ||
      'The steadfast love of the Lord never ceases; his mercies never come to ' +
      'an end; they are new every morning; great is your faithfulness.';
    var ref   = (cfg && cfg.scriptureRef)   || 'ESV';

    // Try to pull today's devotional scripture from the data bundle
    try {
      var dov = window.HERALD_DATA && window.HERALD_DATA.devotionals;
      if (dov && !(cfg && cfg.scriptureVerse)) {
        var today = new Date();
        var key = today.getFullYear() + '-' +
                  String(today.getMonth() + 1).padStart(2, '0') + '-' +
                  String(today.getDate()).padStart(2, '0');
        var entry = dov[key];
        if (entry && entry.scripture) {
          var parts = entry.scripture.split(/\s+[—\u2014]\s+/);
          if (parts.length > 1) {
            text  = parts[0].trim().replace(/^["""]/, '').replace(/["""]$/, '');
            verse = parts[1].trim();
            ref   = '';
          } else if (entry.title) {
            text  = entry.reflection || entry.scripture;
            verse = entry.title;
            ref   = '';
          }
        }
      }
    } catch (_) {}

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">This Morning\u2019s Scripture</p>',
      '  <div class="np-pull-quote">',
      '    <p>\u201c' + esc(text) + '\u201d</p>',
      '  </div>',
      '  <p class="np-byline">' + esc(verse) + (ref ? ' \u2014 ' + esc(ref) : '') + '</p>',
      '  <hr class="np-column-rule">',
      '  <p class="np-body" style="font-style:italic;">',
      '    Each morning the paper opens here \u2014 at the living Word.',
      '    Let it set the tone for everything that follows.',
      '  </p>',
      buildQuizWidget(),
      '</div>',
    ].join('\n');
  }

  // ── Column 3: Section Briefs ──────────────────────────────────────────────
  function buildBriefsCol(userLevel) {
    var sections = window.HERALD_SECTIONS || [];
    var visible  = sections.filter(function (s) {
      return s.slug !== 'herald' &&
             (s.minRole === -1 || (userLevel >= 0 && userLevel >= s.minRole));
    }).slice(0, 8); // show at most 8 briefs

    if (!visible.length) {
      return [
        '<div class="np-col">',
        '  <p class="np-col__flag">Sections</p>',
        '  <p class="np-byline" style="margin-top:8px;">Sign in to see all sections.</p>',
        '</div>',
      ].join('\n');
    }

    var items = visible.map(function (sec) {
      var href = 'Sections/' + sec.slug + '/index.html';
      return [
        '<li class="np-briefs__item">',
        '  <a class="np-briefs__link" href="' + href + '"',
        '     data-section="' + sec.slug + '">',
        '    <span class="np-briefs__title">' + esc(sec.label) + '</span>',
        '    <span class="np-briefs__deck">' + esc(sec.tagline) + '</span>',
        '  </a>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Sections of the Paper</p>',
      '  <ul class="np-briefs">',
      items,
      '  </ul>',
      '</div>',
    ].join('\n');
  }

  // ── Quiz widget (Question of the Day) ─────────────────────────────────────
  function buildQuizWidget() {
    try {
      var arr = window.HERALD_DATA && window.HERALD_DATA.quiz;
      if (!arr || !arr.length) return '';
      var today = new Date();
      var doy   = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
      var q     = arr[doy % arr.length];
      if (!q || !q.question) return '';
      var corr  = (q.correctAnswer || '').toUpperCase();
      var optMap = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD };
      return [
        '  <hr class="np-column-rule" style="margin-top:14px">',
        '  <p class="np-col__flag">Question of the Day</p>',
        '  <p style="font-family:var(--font-headline);font-size:1rem;line-height:1.5;margin:6px 0 10px;">' + esc(q.question) + '</p>',
        '  <p style="font-size:1.05rem;color:var(--ink-dim);font-style:italic;">',
        '    Answer: ' + corr + '. ' + esc(optMap[corr] || '') +
        (q.reference ? ' &mdash; ' + esc(q.reference) : '') +
        ' &mdash; <a href="Sections/pulpit/index.html" style="color:var(--gold)">See The Pulpit \u2192</a>',
        '  </p>',
      ].join('\n');
    } catch (_) { return ''; }
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName, cfg) {
    var headline = (cfg && cfg.bannerHeadline) ||
      (churchName !== 'The Church' ? churchName + ' \u2014 The Flock Herald' : 'The Flock Herald');
    var deck = (cfg && cfg.bannerDeck) ||
      'All the news of the congregation, set in type each morning.';

    var heraldDate = getHeraldDate();
    var isToday = heraldDate.toDateString() === todayMidnight().toDateString();

    return [
      '<div class="np-banner">',
      '  <p class="np-banner__flag">',
      '    <button class="np-date-btn np-date-btn--prev" aria-label="Previous day" title="Previous day">&#8249;</button>',
      '    <span id="np-banner-date">' + formatHeraldDate(heraldDate) + '</span>',
      '    <button class="np-date-btn np-date-btn--next' + (isToday ? ' np-date-btn--disabled' : '') + '" aria-label="Next day" title="Next day"' + (isToday ? ' disabled' : '') + '>&#8250;</button>',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(headline) + '</h2>',
      '  <p class="np-banner__deck">' + esc(deck) + '</p>',
      '</div>',
    ].join('\n');
  }

  // ── Wire date picker buttons ──────────────────────────────────────────────
  function wireDateButtons() {
    var prev = document.querySelector('.np-date-btn--prev');
    var next = document.querySelector('.np-date-btn--next');
    var dateSpan = document.getElementById('np-banner-date');
    if (!prev || !next || !dateSpan) return;

    prev.addEventListener('click', function () {
      var d = getHeraldDate();
      d.setDate(d.getDate() - 1);
      setHeraldDate(d);
      dateSpan.textContent = formatHeraldDate(d);
      next.disabled = false;
      next.classList.remove('np-date-btn--disabled');
    });

    next.addEventListener('click', function () {
      if (next.disabled) return;
      var d = getHeraldDate();
      d.setDate(d.getDate() + 1);
      setHeraldDate(d);
      dateSpan.textContent = formatHeraldDate(d);
      if (d.toDateString() === todayMidnight().toDateString()) {
        next.disabled = true;
        next.classList.add('np-date-btn--disabled');
      }
    });
  }

  // ── Wire section brief clicks through flipTo ──────────────────────────────
  function wireBriefClicks() {    var briefs = document.querySelectorAll('.np-briefs__link[data-section]');
    briefs.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var href = a.getAttribute('href');
        var slug = a.getAttribute('data-section');
        try { sessionStorage.setItem('np-nav-dir', 'forward'); } catch (_) {}
        document.documentElement.setAttribute('data-nav-dir', 'forward');
        window.location.href = href;
      });
    });
  }

  // ── Main render ───────────────────────────────────────────────────────────
  function renderHerald(userLevel) {
    var main = document.getElementById('herald-main');
    if (!main) return;

    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME
      : 'The Church';

    var cfg = getEditorConfig();

    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName, cfg),
      '<div class="np-cols">',
      buildLeadCol(churchName, cfg),
      buildScriptureCol(cfg),
      buildBriefsCol(userLevel),
      '</div>',
      '</div>',
    ].join('\n');

    wireBriefClicks();
    wireDateButtons();
  }
  function boot() {
    var initialLevel = getUserRoleLevel();
    renderHerald(initialLevel);

    if (typeof Nehemiah !== 'undefined' && typeof Nehemiah.onAuthResolved === 'function') {
      Nehemiah.onAuthResolved(function (sess) {
        var level = (sess && sess.role && ROLE_MAP[sess.role] !== undefined)
          ? ROLE_MAP[sess.role] : 0;
        renderHerald(level);
        wireBriefClicks();
        wireDateButtons();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
