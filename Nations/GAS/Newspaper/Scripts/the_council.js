/**
 * the_council.js — The Council Section Content Engine
 *
 * Renders the council section (#section-main) as a broadsheet page.
 * Restricted section (minRole: 4) — pastor and admin only.
 *
 * Layout:
 *   ┌──────────────── BANNER ──────────────────┐
 *   │  The Council · the Codex & governance    │
 *   └──────────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  The FlockOS    │  System Links    │  The Governance  │
 *   │  Codex          │                  │  Mandate         │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-cornerstone) = #1a2a3a (Blueprint Slate) — shared with cornerstone
 *
 * Data: No live data — links to FlockOS architecture + static governance content.
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

  // Council accent colour (Blueprint Slate)
  var ACCENT = 'var(--sec-cornerstone)';

  // ── FlockOS system links ──────────────────────────────────────────────────
  var SYSTEM_LINKS = [
    { label: 'FlockOS App',         url: '../../../index.html',               note: 'Church administration dashboard' },
    { label: 'FlockChat',           url: 'https://flock-os.github.io/FlockOS/flockchat-public/FlockChat.html', note: 'Secure group communications' },
    { label: 'Editor\u2019s Desk',  url: '../editors_desk/index.html',        note: 'Herald configuration & publishing' },
    { label: 'Shepherd\u2019s Desk',url: '../cornerstone/index.html',         note: 'Doctrine, apologetics, pastoral care' },
    { label: 'The Mission',         url: '../great_commission/index.html',     note: 'Nations, prayer, & prayercast' },
    { label: 'The Archive',         url: '../scroll_room/index.html',         note: 'Books of the Bible' },
  ];

  // ── Governance scriptures ─────────────────────────────────────────────────
  var GOV_SCRIPTURES = [
    { ref: 'Acts 6:3\u20134',       text: 'Brothers, pick out from among you seven men of good repute, full of the Spirit and of wisdom, whom we will appoint to this duty. But we will devote ourselves to prayer and to the ministry of the word.' },
    { ref: '1 Timothy 3:1\u20132',  text: 'The saying is trustworthy: If anyone aspires to the office of overseer, he desires a noble task. Therefore an overseer must be above reproach, the husband of one wife, sober-minded, self-controlled, respectable, hospitable, able to teach.' },
    { ref: 'Titus 1:7\u20139',      text: 'An overseer, as God\u2019s steward, must be above reproach. He must hold firm to the trustworthy word as taught, so that he may be able to give instruction in sound doctrine and also to rebuke those who contradict it.' },
    { ref: 'Hebrews 13:17',         text: 'Obey your leaders and submit to them, for they are keeping watch over your souls, as those who will have to give an account. Let them do this with joy and not with groaning, for that would be of no advantage to you.' },
    { ref: '1 Peter 5:2\u20133',    text: 'Shepherd the flock of God that is among you, exercising oversight, not under compulsion, but willingly, as God would have you; not for shameful gain, but eagerly; not domineering over those in your charge, but being examples to the flock.' },
  ];

  function govScripture() {
    return GOV_SCRIPTURES[new Date().getDay() % GOV_SCRIPTURES.length];
  }

  // ── Col 1: The FlockOS Codex ──────────────────────────────────────────────
  function buildCodexCol() {
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:' + ACCENT + '">',
      '    The Council &mdash; ' + todayLong(),
      '  </p>',
      '  <h2 class="np-headline">The FlockOS Codex</h2>',
      '  <p class="np-byline" style="font-variant:small-caps;">Architecture &middot; Governance &middot; Documentation</p>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">',
      '    <p>The Council section is the institutional record of the church\u2019s technology and governance. The Codex \u2014 the FlockOS as-built documentation \u2014 lives here: the architecture decisions, the deployment map, the data structures, and the build record.</p>',
      '    <p>Good governance is not bureaucracy \u2014 it is wisdom institutionalised so that the next generation of leaders can stand on what was built before them. This section exists so that the church never has to start from zero.</p>',
      '  </div>',
      '  <p class="np-col__flag" style="margin-top:18px">FlockOS Version</p>',
      '  <p class="np-body" style="font-size:0.85rem;font-family:var(--font-mono,monospace);">',
      '    New Covenant v1.01 &middot; The Flock Herald v1.0',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Col 2: System Links ───────────────────────────────────────────────────
  function buildLinksCol() {
    var rows = SYSTEM_LINKS.map(function (link) {
      return [
        '<li class="np-briefs__item" style="padding:9px 0">',
        '  <a href="' + esc(link.url) + '" style="text-decoration:none;">',
        '    <span class="np-briefs__title" style="color:' + ACCENT + ';font-size:0.88rem;">' + esc(link.label) + '</span>',
        '    <span class="np-briefs__deck" style="font-size:0.82rem;">' + esc(link.note) + '</span>',
        '  </a>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">FlockOS Navigation</p>',
      '  <ul class="np-briefs">' + rows + '</ul>',
      '  <hr class="np-column-rule" style="margin-top:16px">',
      '  <p class="np-body" style="font-size:0.82rem;font-style:italic;">',
      '    FlockOS is built on Firebase + vanilla JavaScript. The architecture documentation is maintained by the FlockOS team.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Col 3: The Governance Mandate ─────────────────────────────────────────
  function buildGovernanceCol() {
    var sc = govScripture();
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">The Governance Mandate</p>',
      '  <div class="np-pull-quote" style="border-left-color:' + ACCENT + '">',
      '    <p>\u201c' + esc(sc.text) + '\u201d</p>',
      '    <footer>' + esc(sc.ref) + ' (ESV)</footer>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body" style="font-size:0.87rem;">',
      '    <p>The church is governed not by policy but by character. The Codex and the documents in this section exist to serve the shepherds \u2014 to reduce friction so that leaders can focus on what only they can do: pray, preach, and love the flock.</p>',
      '  </div>',
      '  <p class="np-col__flag" style="margin-top:18px">Contact &amp; Support</p>',
      '  <p class="np-body" style="font-size:0.84rem;">',
      '    For technical issues, build requests, or architecture questions, reach the FlockOS team at <strong>flock-os.github.io</strong>.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:' + ACCENT + '">',
      '  <p class="np-banner__flag" style="color:' + ACCENT + '">',
      '    The Flock Herald &mdash; The Council',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">The Codex &mdash; as-built documentation, governance, and the architecture of the flock.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Council';
    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildCodexCol(),
      buildLinksCol(),
      buildGovernanceCol(),
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
