/**
 * the_letters.js — The Letters Section Content Engine
 *
 * Renders the epistles section (#section-main) as a broadsheet page.
 * Public section (minRole: 0) — visible to all logged-in members.
 *
 * Layout:
 *   ┌──────────────── BANNER ──────────────────┐
 *   │  The Letters · correspondence column     │
 *   └──────────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  The Pastoral   │  Church          │  The Epistles    │
 *   │  Letter         │  Communications  │  (key passage)   │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-epistles) = #1e3050 (Inkwell Blue)
 *
 * Data: No live data — static editorial content.
 *       Firestore hook: collection "letters" (future phase).
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

  // ── Pastoral letter pool (rotates weekly) ─────────────────────────────────
  var LETTERS = [
    {
      salutation: 'Dear Church,',
      body:  'Grace and peace to you from God our Father and the Lord Jesus Christ. As we gather again this week, I am reminded that the church is not a building or a program \u2014 it is a people bound together by the love of God. You are that people. This paper is printed for you, in gratitude.',
      sign:  'Your pastor, in Christ',
    },
    {
      salutation: 'To the Beloved,',
      body:  'The Lord is faithful. Whatever you are facing this week, stand on that truth. He who began a good work in you will bring it to completion. The pages of this Herald exist to remind you of that story every morning.',
      sign:  'With love, your shepherd',
    },
    {
      salutation: 'Brothers and Sisters,',
      body:  'The New Testament church wrote letters to each other constantly. Letters of encouragement, of correction, of joy, of sorrow. This column exists in that same tradition. The church is a community of the written word, and these letters are a small part of how we stay connected.',
      sign:  'Together in the Gospel',
    },
    {
      salutation: 'Greetings in Christ,',
      body:  'The love of God is not abstract \u2014 it is expressed in the gathered people of the church. In the smile of a greeter, in the cup of coffee, in the song that rises from many voices, in the prayer whispered over a friend. This week, look for it.',
      sign:  'Yours in service',
    },
  ];

  function thisLetter() {
    return LETTERS[Math.floor(dayOfYear(new Date()) / 7) % LETTERS.length];
  }

  // ── Col 1: Pastoral Letter ────────────────────────────────────────────────
  function buildLetterCol() {
    var letter = thisLetter();
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-epistles)">',
      '    The Pastoral Letter &mdash; ' + todayLong(),
      '  </p>',
      '  <h2 class="np-headline">' + esc(letter.salutation) + '</h2>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">',
      '    <p>' + esc(letter.body) + '</p>',
      '  </div>',
      '  <p class="np-byline" style="margin-top:16px;font-style:italic;">' + esc(letter.sign) + '</p>',
      '</div>',
    ].join('\n');
  }

  // ── Col 2: Church Communications ─────────────────────────────────────────
  function buildCommunicationsCol() {
    var items = [
      { title: 'Connect with Leadership', detail: 'Speak with your pastor or administrator for church communications, prayer, or counsel.' },
      { title: 'Correspondence',          detail: 'The Letters section is the place for official church communications and pastoral notes.' },
      { title: 'Submit a Letter',         detail: 'Members may submit letters to the congregation through church leadership.' },
      { title: 'Church Calendar',         detail: 'Check the weekly bulletin for upcoming services, events, and gatherings.' },
    ];
    var rows = items.map(function (n) {
      return [
        '<li class="np-briefs__item">',
        '  <span class="np-briefs__title">' + esc(n.title) + '</span>',
        '  <span class="np-briefs__deck">' + esc(n.detail) + '</span>',
        '</li>',
      ].join('\n');
    }).join('\n');
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Communications</p>',
      '  <ul class="np-briefs">' + rows + '</ul>',
      '</div>',
    ].join('\n');
  }

  // ── Col 3: From the Epistles ──────────────────────────────────────────────
  var EPISTLE_PASSAGES = [
    { ref: 'Romans 8:38\u201339',          text: 'For I am sure that neither death nor life, nor angels nor rulers, nor things present nor things to come, nor powers, nor height nor depth, nor anything else in all creation, will be able to separate us from the love of God in Christ Jesus our Lord.' },
    { ref: '1 Corinthians 13:4\u20137',    text: 'Love is patient and kind; love does not envy or boast; it is not arrogant or rude. It does not insist on its own way; it is not irritable or resentful; it does not rejoice at wrongdoing, but rejoices with the truth. Love bears all things, believes all things, hopes all things, endures all things.' },
    { ref: 'Ephesians 2:8\u20139',         text: 'For by grace you have been saved through faith. And this is not your own doing; it is the gift of God, not a result of works, so that no one may boast.' },
    { ref: 'Philippians 4:6\u20137',       text: 'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.' },
    { ref: 'Colossians 1:16\u201317',      text: 'For by him all things were created, in heaven and on earth, visible and invisible, whether thrones or dominions or rulers or authorities \u2014 all things were created through him and for him. And he is before all things, and in him all things hold together.' },
    { ref: '2 Timothy 3:16\u201317',       text: 'All Scripture is breathed out by God and profitable for teaching, for reproof, for correction, and for training in righteousness, that the man of God may be complete, equipped for every good work.' },
    { ref: 'James 1:22',                   text: 'But be doers of the word, and not hearers only, deceiving yourselves.' },
  ];

  function buildEpistlesCol() {
    var ep = EPISTLE_PASSAGES[new Date().getDay()];
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">From the Epistles</p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-epistles)">',
      '    <p>\u201c' + esc(ep.text) + '\u201d</p>',
      '    <footer>' + esc(ep.ref) + ' (ESV)</footer>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body" style="font-size:0.86rem;">',
      '    <p>The letters of Paul, Peter, James, John, and Jude are the pastoral correspondence of the first-century church \u2014 written under the Spirit to be read aloud among congregations just like this one. They still speak.</p>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-epistles)">',
      '  <p class="np-banner__flag" style="color:var(--sec-epistles)">',
      '    The Flock Herald &mdash; The Letters',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">Pastoral correspondence, church communications, and the written Word.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Letters';
    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildLetterCol(),
      buildCommunicationsCol(),
      buildEpistlesCol(),
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
