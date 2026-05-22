/**
 * the_straight_path.js — The Path Section Content Engine
 *
 * Renders the discipleship section (#section-main) as a broadsheet page.
 * Public section (minRole: -1) — visible to all visitors.
 *
 * Layout:
 *   ┌────────── BANNER ──────────┐
 *   │  The Path · discipleship   │
 *   └────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  Week's Focus   │  Memory Verse    │  Reading Plan    │
 *   │  (drop cap)     │  + reflection    │  (7-day list)    │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-straight-path) = #4a2808  (Pilgrim Brown)
 *
 * Phase 0: static placeholder content
 * Phase 1: live Firestore data from discipleship/{weekKey}
 */

(function () {
  'use strict';

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  function thisWeek() {
    var d = new Date();
    // Find Monday of current week
    var day = d.getDay() || 7;
    var mon = new Date(d);
    mon.setDate(d.getDate() - day + 1);
    var sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    if (mon.getMonth() === sun.getMonth()) {
      return MONTHS[mon.getMonth()] + ' ' + mon.getDate() + '\u2013' + sun.getDate() + ', ' + sun.getFullYear();
    }
    return MONTHS[mon.getMonth()] + ' ' + mon.getDate() + ' \u2013 ' + MONTHS[sun.getMonth()] + ' ' + sun.getDate() + ', ' + sun.getFullYear();
  }

  // ── Phase 0 static content ────────────────────────────────────────────────
  var STATIC = {
    focusTitle:   'Walking the Ancient Paths',
    focusVerse:   'Jeremiah 6:16',
    focusText:    '"Stand at the crossroads and look; ask for the ancient paths, ask where the good way is, and walk in it, and you will find rest for your souls."',
    focusBody:    [
      'Discipleship is not a program. It is a path — one walked daily, one step at a time, ' +
      'in the company of other pilgrims. The ancient ways have not worn out; they have only ' +
      'been obscured by the noise of the age.',

      'This week, find the path again. It begins with the Word in the morning, ' +
      'continues with a conversation that matters, and ends with gratitude before sleep. ' +
      'The congregation walks together. You are not alone on the road.',
    ],

    memoryVerse:  'Matthew 11:28\u201329',
    memoryText:   'Come to me, all you who are weary and burdened, and I will give you rest. Take my yoke upon you and learn from me, for I am gentle and humble in heart, and you will find rest for your souls.',
    memoryRef:    'NIV',
    memoryNote:   'This week\'s memory verse. Read it aloud three times this morning.',

    readingTitle: 'Weekly Reading Plan',
    readingDays: [
      { day: 'Monday',    ref: 'Psalm 1',           desc: 'The blessed life' },
      { day: 'Tuesday',   ref: 'Matthew 5:1\u201312', desc: 'The Beatitudes' },
      { day: 'Wednesday', ref: 'Proverbs 3:1\u201312', desc: 'Trust in the Lord' },
      { day: 'Thursday',  ref: 'Romans 12:1\u201312',  desc: 'Living sacrifice' },
      { day: 'Friday',    ref: 'Philippians 4:4\u201313', desc: 'Peace that passes' },
      { day: 'Saturday',  ref: 'Colossians 3:1\u201317', desc: 'Set your mind above' },
      { day: 'Sunday',    ref: 'Hebrews 12:1\u201313', desc: 'Run with endurance' },
    ],
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  function buildFocusCol(d) {
    var bodyHTML = d.focusBody.map(function (p) { return '<p>' + p + '</p>'; }).join('\n');
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-straight-path)">',
      '    This Week\u2019s Focus &mdash; ' + thisWeek(),
      '  </p>',
      '  <h2 class="np-headline">' + esc(d.focusTitle) + '</h2>',
      '  <p class="np-byline" style="font-variant:small-caps;letter-spacing:.06em;">' + esc(d.focusVerse) + '</p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-straight-path)">',
      '    <p>' + esc(d.focusText) + '</p>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">' + bodyHTML + '</div>',
      '</div>',
    ].join('\n');
  }

  function buildMemoryCol(d) {
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Memory Verse</p>',
      '  <p class="np-byline" style="font-family:var(--font-headline);font-size:1rem;margin-bottom:10px;">',
      '    ' + esc(d.memoryVerse) + ' &mdash; ' + esc(d.memoryRef),
      '  </p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-straight-path)">',
      '    <p>\u201c' + esc(d.memoryText) + '\u201d</p>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <p class="np-body" style="font-style:italic;font-size:0.85rem;">' + esc(d.memoryNote) + '</p>',
      '</div>',
    ].join('\n');
  }

  function buildReadingCol(d) {
    var items = d.readingDays.map(function (r) {
      return [
        '<li class="np-briefs__item">',
        '  <span class="np-briefs__title">' + esc(r.day) + ' \u2014 ' + esc(r.ref) + '</span>',
        '  <span class="np-briefs__deck">' + esc(r.desc) + '</span>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">' + esc(d.readingTitle) + '</p>',
      '  <ul class="np-briefs">' + items + '</ul>',
      '</div>',
    ].join('\n');
  }

  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-straight-path)">',
      '  <p class="np-banner__flag" style="color:var(--sec-straight-path)">',
      '    The Flock Herald &mdash; The Path',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">Discipleship, growth, and the journey of faith.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render(data) {
    var main = document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Path';

    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildFocusCol(data),
      buildMemoryCol(data),
      buildReadingCol(data),
      '</div>',
      '</div>',
    ].join('\n');
  }

  function fetchContent(callback) {
    try {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        var d = new Date();
        var weekKey = d.getFullYear() + '-W' + String(Math.ceil((d - new Date(d.getFullYear(), 0, 1)) / 604800000)).padStart(2, '0');
        firebase.firestore().collection('discipleship').doc(weekKey).get()
          .then(function (doc) {
            callback(doc.exists ? Object.assign({}, STATIC, doc.data()) : STATIC);
          })
          .catch(function () { callback(STATIC); });
        return;
      }
    } catch (_) {}
    callback(STATIC);
  }

  function boot() {
    fetchContent(render);
    if (typeof Nehemiah !== 'undefined' && typeof Nehemiah.onAuthResolved === 'function') {
      Nehemiah.onAuthResolved(function () { fetchContent(render); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
