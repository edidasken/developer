/**
 * the_archive.js — The Archive Section Content Engine
 *
 * Renders the scroll room section (#section-main) as a broadsheet page.
 * Restricted section (minRole: 4) — pastor and admin only.
 *
 * Layout:
 *   ┌──────────────── BANNER ─────────────────┐
 *   │  The Archive · the written Word         │
 *   └─────────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  Book of the    │  Christ in This  │  The Bookshelf   │
 *   │  Bible (drop    │  Book + Themes   │  (author, time,  │
 *   │  cap)           │                  │   key verse)     │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-scroll-room) = #2a1a0e (Ink & Leather)
 *
 * Data: window.HERALD_DATA.booksOfBible — rotates daily by dayOfYear % 66
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
    bookName:    'John',
    author:      'John the Apostle',
    testament:   'New',
    genre:       'Gospel',
    timePeriod:  'c. AD 85–90',
    summary:     'The Gospel of John opens at the beginning — "In the beginning was the Word" — and never lets go. Seven signs, seven "I am" statements, and a Farewell Discourse that unlocks the Trinity. Written that you might believe.',
    keyVerse:    '"For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life." — John 3:16',
    themes:      'The deity of Christ; faith and belief; eternal life; the Holy Spirit; love.',
    christInBook:'Jesus is the eternal Word made flesh, the great I AM, the resurrection and the life, and the way, the truth, and the life.',
    application: 'Read John slowly. Each chapter is a world. The signs are not ends in themselves — they are arrows pointing to the Person. Believe.',
  };

  // ── Load from bundle ──────────────────────────────────────────────────────
  function loadBook() {
    try {
      var arr = window.HERALD_DATA && window.HERALD_DATA.booksOfBible;
      if (!arr || !arr.length) return STATIC;
      var idx = dayOfYear(new Date()) % arr.length;
      var b   = arr[idx];
      if (!b || !b.bookName) return STATIC;
      return {
        bookName:    b.bookName    || STATIC.bookName,
        author:      b.author      || STATIC.author,
        testament:   b.testament   || STATIC.testament,
        genre:       b.genre       || STATIC.genre,
        timePeriod:  b.timePeriod  || STATIC.timePeriod,
        summary:     b.summary     || STATIC.summary,
        keyVerse:    b.keyVerse    || STATIC.keyVerse,
        themes:      b.themes      || STATIC.themes,
        christInBook:b.christInBook|| STATIC.christInBook,
        application: b.application || STATIC.application,
      };
    } catch (_) { return STATIC; }
  }

  // ── Col 1: Book of the Bible ──────────────────────────────────────────────
  function buildBookCol(b) {
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-scroll-room)">',
      '    Book of the Bible &mdash; ' + todayLong(),
      '  </p>',
      '  <h2 class="np-headline">' + esc(b.bookName) + '</h2>',
      '  <p class="np-byline" style="font-variant:small-caps;letter-spacing:.06em;">',
      '    ' + esc(b.testament) + ' Testament &mdash; ' + esc(b.genre),
      '  </p>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">',
      '    <p>' + esc(b.summary) + '</p>',
      '    <p>' + esc(b.application) + '</p>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Col 2: Christ in This Book ────────────────────────────────────────────
  function buildChristCol(b) {
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Christ in This Book</p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-scroll-room)">',
      '    <p>' + esc(b.christInBook) + '</p>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <p class="np-col__flag" style="margin-top:0">Themes</p>',
      '  <div class="np-body" style="font-size:0.88rem;">',
      '    <p>' + esc(b.themes) + '</p>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <p class="np-col__flag" style="margin-top:0">Key Verse</p>',
      '  <div class="np-body" style="font-size:0.85rem;font-style:italic;">',
      '    <p>' + esc(b.keyVerse) + '</p>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Col 3: The Bookshelf ──────────────────────────────────────────────────
  function buildShelfCol(b) {
    var items = [
      { label: 'Author',      value: b.author },
      { label: 'Testament',   value: b.testament },
      { label: 'Genre',       value: b.genre },
      { label: 'Written',     value: b.timePeriod },
    ].filter(function (i) { return i.value; });

    var rows = items.map(function (item) {
      return [
        '<li class="np-briefs__item" style="padding:10px 0">',
        '  <span class="np-briefs__title" style="font-family:var(--font-headline);font-size:0.82rem;color:var(--ink-dim)">' + esc(item.label) + '</span>',
        '  <span class="np-briefs__deck" style="font-size:0.9rem;">' + esc(item.value) + '</span>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">The Bookshelf</p>',
      '  <ul class="np-briefs">' + rows + '</ul>',
      '  <hr class="np-column-rule">',
      '  <p class="np-body" style="font-size:0.83rem;font-style:italic;margin-top:10px;">',
      '    The Archive cycles through all 66 books of Scripture. One book each day &mdash; the whole counsel of God in a year.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-scroll-room)">',
      '  <p class="np-banner__flag" style="color:var(--sec-scroll-room)">',
      '    The Flock Herald &mdash; The Archive',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">The written Word &mdash; one book of Scripture, every day.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Archive';
    var book = loadBook();
    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildBookCol(book),
      buildChristCol(book),
      buildShelfCol(book),
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
