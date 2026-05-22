/**
 * the_family_tree.js — The Family Tree Section Content Engine
 *
 * Renders the genealogy section (#section-main) as a broadsheet page.
 * Public section (minRole: 0) — visible to all logged-in members.
 *
 * Layout:
 *   ┌──────────────── BANNER ─────────────────┐
 *   │  The Family Tree · biblical genealogy   │
 *   └─────────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  Figure of the  │  Heritage        │  From the Record │
 *   │  Day (drop cap) │  (name meaning,  │  (congregation   │
 *   │                 │   lifespan,      │   connection)    │
 *   │                 │   children)      │                  │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-genealogies) = #1a3030 (Cedar & Stone)
 *
 * Data: window.HERALD_DATA.genealogy — rotates daily by dayOfYear % length
 */

(function () {
  'use strict';

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  function todayLong() {
    var d = new Date();
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function dayOfYear(date) {
    var start = new Date(date.getFullYear(), 0, 0);
    var diff  = date - start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60000;
    return Math.floor(diff / 86400000);
  }

  // ── Static fallback ───────────────────────────────────────────────────────
  var STATIC = {
    name:      'Abraham',
    meaning:   'Father of Many Nations',
    bio:       'The founding patriarch of the nation of Israel. Called by God from Ur of the Chaldeans, Abraham left everything familiar to follow a promise — land, seed, and blessing for all the families of the earth. His faith, tested most severely on Moriah, was counted to him as righteousness. The covenant God made with Abraham is the backbone of all Scripture.',
    lifespan:  '175 years',
    reference: 'Genesis 12–25',
    children:  'Ishmael (by Hagar), Isaac (by Sarah)',
  };

  // ── Load from bundle ──────────────────────────────────────────────────────
  function loadFigure() {
    try {
      var arr = window.HERALD_DATA && window.HERALD_DATA.genealogy;
      if (!arr || !arr.length) return STATIC;
      var idx = dayOfYear(new Date()) % arr.length;
      var f   = arr[idx];
      if (!f || !f.name) return STATIC;
      return {
        name:      f.name      || STATIC.name,
        meaning:   f.meaning   || '',
        bio:       f.bio       || STATIC.bio,
        lifespan:  f.lifespan  ? f.lifespan + ' years' : '',
        reference: f.reference || '',
        children:  f.children  || '',
      };
    } catch (_) { return STATIC; }
  }

  // ── Col 1: Figure of the Day ──────────────────────────────────────────────
  function buildFigureCol(d) {
    var bioParagraphs = d.bio.match(/.{1,400}(\s|$)/g) || [d.bio];
    var bodyHTML = bioParagraphs.map(function (p) { return '<p>' + esc(p.trim()) + '</p>'; }).join('\n');
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-genealogies)">',
      '    Figure of the Day &mdash; ' + todayLong(),
      '  </p>',
      '  <h2 class="np-headline">' + esc(d.name) + '</h2>',
      d.meaning ? '  <p class="np-byline" style="font-variant:small-caps;letter-spacing:.06em;">' + esc(d.meaning) + '</p>' : '',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">' + bodyHTML + '</div>',
      '</div>',
    ].filter(Boolean).join('\n');
  }

  // ── Col 2: Heritage ───────────────────────────────────────────────────────
  function buildHeritageCol(d) {
    var items = [];
    if (d.reference) items.push({ label: 'Scripture', value: d.reference });
    if (d.lifespan)  items.push({ label: 'Lifespan',  value: d.lifespan });
    if (d.meaning)   items.push({ label: 'Name Means', value: d.meaning });
    if (d.children)  items.push({ label: 'Children',  value: d.children });

    var rows = items.map(function (item) {
      return [
        '<li class="np-briefs__item" style="padding:10px 0">',
        '  <span class="np-briefs__title" style="font-family:var(--font-headline);font-size:0.82rem;color:var(--ink-dim)">' + esc(item.label) + '</span>',
        '  <span class="np-briefs__deck" style="font-size:0.9rem;color:var(--ink)">' + esc(item.value) + '</span>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Heritage Record</p>',
      '  <ul class="np-briefs">' + rows + '</ul>',
      '</div>',
    ].join('\n');
  }

  // ── Col 3: From the Record ────────────────────────────────────────────────
  function buildRecordCol(d) {
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">From the Record</p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-genealogies)">',
      '    <p>\u201cThese are the generations\u2026\u201d</p>',
      '    <footer>Genesis 5:1 &mdash; The Book of Generations</footer>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body" style="font-size:0.88rem;">',
      '    <p>Scripture traces the line of every name because every life in the story of God matters. The genealogies are not filler &mdash; they are the spine of the covenant narrative.</p>',
      '    <p>The Flock Herald draws from a registry of 1,321 figures in the biblical record. Each day, one name comes forward from the scroll.</p>',
      '  </div>',
      '  <p class="np-col__flag" style="margin-top:18px">Explore the Full Genealogy</p>',
      '  <p class="np-body" style="font-size:0.85rem;font-style:italic;">',
      '    Open the Genealogy app in FlockOS to trace the complete family lines, from Adam to the Apostles.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-genealogies)">',
      '  <p class="np-banner__flag" style="color:var(--sec-genealogies)">',
      '    The Flock Herald &mdash; The Family Tree',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">The generations of the faithful &mdash; the biblical record of God\u2019s covenant family.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var main = document.getElementById('panel-family') || document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Family Tree';
    var figure = loadFigure();
    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildFigureCol(figure),
      buildHeritageCol(figure),
      buildRecordCol(figure),
      '</div>',
      '</div>',
    ].join('\n');
  }

  function boot() {
    render();
    if (typeof Nehemiah !== 'undefined' && typeof Nehemiah.onAuthResolved === 'function') {
      Nehemiah.onAuthResolved(render);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
