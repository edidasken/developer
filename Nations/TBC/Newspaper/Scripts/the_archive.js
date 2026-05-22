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
  // ── Word Study Widget ─────────────────────────────────────────────────────
  function buildWordStudy() {
    return [
      '<div class="np-word-study" style="margin-top:2rem;padding-top:1.25rem;border-top:2px solid var(--sec-scroll-room)">',
      '  <p class="np-col__flag" style="color:var(--sec-scroll-room);margin-bottom:0.5rem">Word Study &mdash; Strong\'s Concordance</p>',
      '  <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem">',
      '    <input id="ws-input" type="text" placeholder="G3056 &middot; logos &middot; or Hebrew H7225&hellip;" ',
      '      style="font-family:var(--font-body);font-size:0.9rem;border:1px solid var(--rule);',
      '             background:var(--paper);color:var(--ink);padding:0.45rem 0.75rem;border-radius:3px;',
      '             flex:1 1 220px;min-width:180px;" />',
      '    <button onclick="wsSearch()" ',
      '      style="font-family:var(--font-headline);font-size:0.82rem;letter-spacing:.06em;',
      '             background:var(--sec-scroll-room);color:var(--paper);border:none;',
      '             padding:0.45rem 1rem;border-radius:3px;cursor:pointer;white-space:nowrap">',
      '      Look Up',
      '    </button>',
      '  </div>',
      '  <div id="ws-result" style="font-family:var(--font-body);font-size:0.88rem;min-height:1.5rem"></div>',
      '</div>',
    ].join('\n');
  }

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
      buildWordStudy(),
      '</div>',
    ].join('\n');

    // Attach word study search after DOM injection
    window.wsSearch = function () {
      var raw    = (document.getElementById('ws-input').value || '').trim();
      var result = document.getElementById('ws-result');
      if (!raw) { result.innerHTML = ''; return; }

      var upper = raw.toUpperCase();
      var entry, lang;

      // Try exact Strong's number first (G… or H…)
      if (/^G\d+$/i.test(raw) && window.HERALD_DATA && window.HERALD_DATA.strongsGreek) {
        entry = window.HERALD_DATA.strongsGreek[upper];
        lang  = 'Greek';
      } else if (/^H\d+$/i.test(raw) && window.HERALD_DATA && window.HERALD_DATA.strongsHebrew) {
        entry = window.HERALD_DATA.strongsHebrew[upper];
        lang  = 'Hebrew';
      } else {
        // Transliteration search — scan both lexicons
        var q = raw.toLowerCase();
        var gk = window.HERALD_DATA && window.HERALD_DATA.strongsGreek;
        var hb = window.HERALD_DATA && window.HERALD_DATA.strongsHebrew;
        if (gk) {
          var gkeys = Object.keys(gk);
          for (var i = 0; i < gkeys.length; i++) {
            if ((gk[gkeys[i]].translit || '').toLowerCase().indexOf(q) === 0) {
              entry = gk[gkeys[i]];
              entry._num = gkeys[i];
              lang = 'Greek';
              break;
            }
          }
        }
        if (!entry && hb) {
          var hkeys = Object.keys(hb);
          for (var j = 0; j < hkeys.length; j++) {
            if ((hb[hkeys[j]].translit || '').toLowerCase().indexOf(q) === 0) {
              entry = hb[hkeys[j]];
              entry._num = hkeys[j];
              lang = 'Hebrew';
              break;
            }
          }
        }
      }

      if (!entry) {
        result.innerHTML = '<em style="color:var(--ink-dim)">No entry found for \u201c' + esc(raw) + '\u201d &mdash; try a Strong\'s number (G3056) or transliteration.</em>';
        return;
      }

      var num = entry._num || upper;
      result.innerHTML = [
        '<div style="display:grid;grid-template-columns:auto 1fr;gap:0.3rem 1rem;align-items:baseline">',
        '  <span style="font-variant:small-caps;font-size:0.78rem;color:var(--ink-dim)">Number</span>',
        '  <strong style="font-family:var(--font-headline)">' + esc(num) + ' &mdash; ' + lang + '</strong>',
        entry.lemma ?
          '  <span style="font-variant:small-caps;font-size:0.78rem;color:var(--ink-dim)">Word</span>' +
          '  <span style="font-size:1.05rem">' + esc(entry.lemma) + '</span>' : '',
        entry.translit ?
          '  <span style="font-variant:small-caps;font-size:0.78rem;color:var(--ink-dim)">Translit.</span>' +
          '  <span style="font-style:italic">' + esc(entry.translit) + '</span>' : '',
        entry.kjv_def ?
          '  <span style="font-variant:small-caps;font-size:0.78rem;color:var(--ink-dim)">KJV</span>' +
          '  <span>' + esc(entry.kjv_def) + '</span>' : '',
        entry.strongs_def ?
          '  <span style="font-variant:small-caps;font-size:0.78rem;color:var(--ink-dim)">Definition</span>' +
          '  <span>' + esc(entry.strongs_def) + '</span>' : '',
        entry.derivation ?
          '  <span style="font-variant:small-caps;font-size:0.78rem;color:var(--ink-dim)">Derivation</span>' +
          '  <span style="font-size:0.83rem;color:var(--ink-dim)">' + esc(entry.derivation) + '</span>' : '',
        '</div>',
      ].filter(Boolean).join('\n');
    };

    // Allow Enter key in search box
    var inp = document.getElementById('ws-input');
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') window.wsSearch();
      });
    }
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
