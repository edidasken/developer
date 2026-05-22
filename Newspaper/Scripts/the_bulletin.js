/**
 * the_bulletin.js — The Bulletin Section Content Engine
 *
 * Renders the gatehouse section (#section-main) as a broadsheet page.
 * Public section (minRole: 0) — visible to all logged-in members.
 *
 * Layout:
 *   ┌──────────────── BANNER ──────────────────┐
 *   │  The Bulletin · weekly board             │
 *   └──────────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  This Week at   │  Events &        │  Prayer Board    │
 *   │  the Church     │  Announcements   │                  │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-gatehouse) = #3d1818 (Crimson Notice)
 *
 * Data: No live data source yet — static editorial content.
 *       Firestore hook: collection "bulletins" (future phase).
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

  var WEEK_SCRIPTURES = [
    { ref: 'Hebrews 10:24\u201325', text: 'Let us consider how to stir up one another to love and good works, not neglecting to meet together, as is the habit of some, but encouraging one another.' },
    { ref: 'Acts 2:42',           text: 'And they devoted themselves to the apostles\u2019 teaching and the fellowship, to the breaking of bread and the prayers.' },
    { ref: 'Colossians 3:16',     text: 'Let the word of Christ dwell in you richly, teaching and admonishing one another in all wisdom, singing psalms and hymns and spiritual songs.' },
    { ref: 'Romans 15:7',         text: 'Therefore welcome one another as Christ has welcomed you, for the glory of God.' },
    { ref: '1 Peter 4:10',        text: 'As each has received a gift, use it to serve one another, as good stewards of God\u2019s varied grace.' },
    { ref: 'Philippians 2:2',     text: 'Complete my joy by being of the same mind, having the same love, being in full accord and of one mind.' },
    { ref: 'Galatians 6:2',       text: 'Bear one another\u2019s burdens, and so fulfill the law of Christ.' },
  ];

  function weekScripture() {
    return WEEK_SCRIPTURES[new Date().getDay()];
  }

  // ── Col 1: This Week at the Church ────────────────────────────────────────
  function buildWeekCol(churchName) {
    var sc = weekScripture();
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-gatehouse)">',
      '    This Week at ' + esc(churchName) + ' &mdash; ' + todayLong(),
      '  </p>',
      '  <h2 class="np-headline">A Word for the Congregation</h2>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">',
      '    <p>The weekly bulletin is the heartbeat of congregational life \u2014 the place where the scattered life of the church is gathered into one printed page and laid before the people. What is happening this week? Where do we gather? Who needs our prayers?</p>',
      '    <p>This section is your community noticeboard. Announcements from leaders, upcoming gatherings, events to look forward to, and names to bring before God.</p>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <p class="np-col__flag" style="margin-top:0">This Week\u2019s Scripture</p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-gatehouse)">',
      '    <p>\u201c' + esc(sc.text) + '\u201d</p>',
      '    <footer>' + esc(sc.ref) + ' (ESV)</footer>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Col 2: Announcements ──────────────────────────────────────────────────
  function buildAnnouncementsCol() {
    var notices = [
      { title: 'Sunday Service', detail: 'Weekly gathering for worship, teaching, and communion. All are welcome.' },
      { title: 'Midweek Prayer', detail: 'Mid-week corporate prayer meeting. Pray for the church, the city, and the nations.' },
      { title: 'New Members Class', detail: 'Interested in membership? Speak to a pastor this Sunday after service.' },
      { title: 'Bulletin Board',  detail: 'Full announcements are posted on the church notice board and distributed each Sunday.' },
    ];

    var rows = notices.map(function (n) {
      return [
        '<li class="np-briefs__item">',
        '  <span class="np-briefs__title">' + esc(n.title) + '</span>',
        '  <span class="np-briefs__deck">' + esc(n.detail) + '</span>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Notices &amp; Events</p>',
      '  <ul class="np-briefs">' + rows + '</ul>',
      '  <hr class="np-column-rule" style="margin-top:18px">',
      '  <p class="np-body" style="font-size:0.83rem;font-style:italic;">',
      '    Bulletin updates are published by church staff. Contact your pastor or administrator to post a notice.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Col 3: Prayer Board ───────────────────────────────────────────────────
  function buildPrayerBoardCol() {
    var items = [
      'For the sick and those in need of healing',
      'For families walking through grief',
      'For new members finding their place',
      'For our pastors and leaders',
      'For those who do not yet know Christ',
      'For the persecuted church around the world',
    ];

    var rows = items.map(function (it) {
      return [
        '<li class="np-briefs__item">',
        '  <span class="np-briefs__deck" style="font-size:0.87rem;">\u2022 ' + esc(it) + '</span>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">The Prayer Board</p>',
      '  <ul class="np-briefs">' + rows + '</ul>',
      '  <hr class="np-column-rule" style="margin-top:18px">',
      '  <div class="np-body" style="font-size:0.85rem;">',
      '    <p>\u201cPray without ceasing.\u201d &mdash; 1 Thessalonians 5:17</p>',
      '    <p style="font-style:italic;">Prayer requests can be submitted to your pastor or care team leader.</p>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-gatehouse)">',
      '  <p class="np-banner__flag" style="color:var(--sec-gatehouse)">',
      '    The Flock Herald &mdash; The Bulletin',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">The weekly noticeboard &mdash; announcements, events, and the prayer board.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Congregation';
    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildWeekCol(churchName),
      buildAnnouncementsCol(),
      buildPrayerBoardCol(),
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
