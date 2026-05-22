/**
 * the_pulpit.js — The Pulpit Section Content Engine
 *
 * Renders the pulpit section (#section-main) as a broadsheet page.
 * Leader section (minRole: 3) — leaders and above.
 *
 * Layout:
 *   ┌──────────────── BANNER ──────────────────┐
 *   │  The Pulpit · the preached Word          │
 *   └──────────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  Sermon Notes   │  The Text        │  Quiz of the     │
 *   │  (static /      │  (weekly focus   │  Week (quiz.js)  │
 *   │   Firestore)    │   scripture)     │  interactive     │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-pulpit) = #2e1a4a (Bishop's Purple)
 *
 * Data: window.HERALD_DATA.quiz — question of the week (week % 50)
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

  function weekNumber(date) {
    return Math.floor(dayOfYear(date) / 7);
  }

  // ── Static fallback quiz question ─────────────────────────────────────────
  var STATIC_Q = {
    question:      'How many books are in the Bible?',
    optionA:       '60',
    optionB:       '63',
    optionC:       '66',
    optionD:       '72',
    correctAnswer: 'c',
    reference:     'General Biblical Knowledge',
    difficulty:    'Easy',
    category:      'Bible Overview',
  };

  // ── Weekly text focus pool (rotates weekly) ───────────────────────────────
  var TEXTS = [
    { passage: 'Nehemiah 8:1\u20138', theme: 'The Power of Proclaimed Scripture', note: 'Ezra reads the Law publicly to the returned exiles. The people weep. Joy returns as they understand the Word. This passage is the paradigm for expository preaching.' },
    { passage: 'Luke 4:16\u201321',  theme: 'The Manifesto of the Kingdom', note: 'Jesus\u2019 first sermon in Nazareth. He opens the scroll of Isaiah, reads the messianic passage, rolls it up, sits down, and says: \u201cToday this Scripture has been fulfilled in your hearing.\u201d Every sermon aims at that sentence.' },
    { passage: '2 Timothy 4:1\u20132', theme: 'Preach the Word', note: 'Paul\u2019s final charge to Timothy. The ground of faithful preaching is the authority of the Word; the goal is reproof, correction, and training in righteousness. This is the pulpit\u2019s mandate.' },
    { passage: 'Romans 10:14\u201317', theme: 'Faith Comes by Hearing', note: 'The logic of proclamation: people cannot believe unless they hear, and they cannot hear unless someone preaches. The preached word is the instrument of saving faith.' },
  ];

  function thisText() {
    return TEXTS[weekNumber(new Date()) % TEXTS.length];
  }

  // ── Load quiz from bundle ─────────────────────────────────────────────────
  function loadQuiz() {
    try {
      var arr = window.HERALD_DATA && window.HERALD_DATA.quiz;
      if (!arr || !arr.length) return STATIC_Q;
      var q = arr[weekNumber(new Date()) % arr.length];
      if (!q || !q.question) return STATIC_Q;
      return q;
    } catch (_) { return STATIC_Q; }
  }

  // ── Col 1: Sermon Notes ───────────────────────────────────────────────────
  function buildSermonCol() {
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-pulpit)">',
      '    The Sermon Notes &mdash; ' + todayLong(),
      '  </p>',
      '  <h2 class="np-headline">The Preached Word</h2>',
      '  <p class="np-byline" style="font-variant:small-caps;">Prepared for Sunday\u2019s Message</p>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">',
      '    <p>This section is the Pulpit \u2014 the place where preaching is prepared, reflected on, and shared. Sermon notes, key texts, outlines, and follow-up teaching materials live here.</p>',
      '    <p>The pulpit is not a throne; it is a trumpet. The preacher does not speak his own words \u2014 he holds up the Word of God and says: \u201cThis is what it says. This is what it means. This is what it demands of us.\u201d</p>',
      '  </div>',
      '  <p class="np-col__flag" style="margin-top:18px">Preparing a Message?</p>',
      '  <p class="np-body" style="font-size:0.85rem;font-style:italic;">',
      '    Sermon notes and outlines can be uploaded through the Editor\u2019s Desk. Contact your administrator to enable sermon publishing.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Col 2: Weekly Text Focus ──────────────────────────────────────────────
  function buildTextCol() {
    var t = thisText();
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">The Text</p>',
      '  <p class="np-byline" style="font-family:var(--font-headline);font-size:1rem;margin-bottom:8px;">' + esc(t.passage) + '</p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-pulpit)">',
      '    <p>' + esc(t.theme) + '</p>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body" style="font-size:0.87rem;">',
      '    <p>' + esc(t.note) + '</p>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Col 3: Quiz of the Week ───────────────────────────────────────────────
  function buildQuizCol(q) {
    var opts = [
      { key: 'a', text: q.optionA },
      { key: 'b', text: q.optionB },
      { key: 'c', text: q.optionC },
      { key: 'd', text: q.optionD },
    ].filter(function (o) { return o.text; });

    var optRows = opts.map(function (o) {
      return [
        '<li class="np-briefs__item np-quiz-opt" data-opt="' + esc(o.key) + '" style="cursor:pointer;padding:8px 0;border-radius:3px;transition:background .15s;">',
        '  <span class="np-briefs__title" style="font-size:0.9rem;">',
        '    <strong>' + o.key.toUpperCase() + '.</strong> ' + esc(o.text),
        '  </span>',
        '</li>',
      ].join('\n');
    }).join('\n');

    var diffColor = { 'Easy': '#1a7a1a', 'Medium': '#8a5a00', 'Hard': '#7a1a1a' };
    var dc = diffColor[q.difficulty] || 'var(--ink-dim)';

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Quiz of the Week</p>',
      '  <p class="np-byline" style="font-size:0.78rem;color:' + dc + ';font-variant:small-caps;">' + esc(q.difficulty || '') + (q.category ? ' &mdash; ' + esc(q.category) : '') + '</p>',
      '  <p style="font-family:var(--font-headline);font-size:0.97rem;line-height:1.4;margin:8px 0 12px;">' + esc(q.question) + '</p>',
      '  <ul class="np-briefs" id="np-quiz-opts">' + optRows + '</ul>',
      '  <button id="np-quiz-reveal" style="margin-top:14px;padding:7px 16px;background:var(--sec-pulpit);color:#fff;border:none;border-radius:3px;font-family:var(--font-headline);font-size:0.82rem;cursor:pointer;letter-spacing:.04em;">Reveal Answer</button>',
      '  <p id="np-quiz-answer" style="display:none;margin-top:12px;font-size:0.86rem;"></p>',
      '</div>',
    ].join('\n');
  }

  // ── Wire quiz interactivity ───────────────────────────────────────────────
  function wireQuiz(q) {
    var btn    = document.getElementById('np-quiz-reveal');
    var answer = document.getElementById('np-quiz-answer');
    var opts   = document.querySelectorAll('.np-quiz-opt');

    opts.forEach(function (li) {
      li.addEventListener('mouseenter', function () { li.style.background = 'rgba(0,0,0,0.04)'; });
      li.addEventListener('mouseleave', function () { li.style.background = ''; });
      li.addEventListener('click', function () {
        opts.forEach(function (o) { o.style.fontWeight = ''; });
        li.style.fontWeight = 'bold';
      });
    });

    if (!btn || !answer) return;
    btn.addEventListener('click', function () {
      var correct = (q.correctAnswer || '').toLowerCase();
      var optMap  = { a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD };
      var ansText = optMap[correct] || '';
      opts.forEach(function (li) {
        var opt = (li.getAttribute('data-opt') || '').toLowerCase();
        li.style.background    = opt === correct ? 'rgba(26,122,26,0.12)' : '';
        li.style.outline       = opt === correct ? '2px solid #1a7a1a' : '';
        li.style.borderRadius  = '3px';
      });
      answer.style.display = '';
      answer.innerHTML = '<strong>Answer: ' + correct.toUpperCase() + '. ' +
        (ansText ? ansText + '</strong>' : '') +
        (q.reference ? ' &mdash; <span style="font-style:italic">' + q.reference + '</span>' : '');
      btn.disabled = true;
      btn.style.opacity = '0.5';
    });
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-pulpit)">',
      '  <p class="np-banner__flag" style="color:var(--sec-pulpit)">',
      '    The Flock Herald &mdash; The Pulpit',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">Sermons, teachings, and the preached Word &mdash; for those who stand to speak.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Pulpit';
    var q = loadQuiz();
    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildSermonCol(),
      buildTextCol(),
      buildQuizCol(q),
      '</div>',
      '</div>',
    ].join('\n');
    wireQuiz(q);
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
