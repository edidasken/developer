/**
 * the_stage.js — The Stage Section Content Engine
 *
 * Renders the stage section (#section-main) as a broadsheet page.
 * Leader section (minRole: 3) — media team leaders and above.
 *
 * Layout:
 *   ┌──────────────── BANNER ──────────────────┐
 *   │  The Stage · media & visual ministry     │
 *   └──────────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  Production     │  Verse for       │  The Technical   │
 *   │  Notes          │  Visuals         │  Runsheet        │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-stage) = #0c1445 (Vesper Blue)
 *
 * Data: No live data — static editorial content.
 *       Firestore hook: collection "stage_notes" (future phase).
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

  // ── Visual Scriptures (rotates daily) ─────────────────────────────────────
  var VISUAL_SCRIPTURES = [
    { ref: 'Exodus 35:31\u201332',   text: 'He has filled him with the Spirit of God, with skill, with intelligence, with knowledge, and with all craftsmanship, to devise artistic designs, to work in gold and silver and bronze.' },
    { ref: 'Bezalel, Exodus 31:3',  text: 'I have filled him with the Spirit of God, with ability and intelligence, with knowledge and all craftsmanship.' },
    { ref: '1 Chronicles 15:16',    text: 'David commanded the chiefs of the Levites to appoint their brothers as the singers who should play loudly on musical instruments, on harps and lyres and cymbals, to raise sounds of joy.' },
    { ref: 'Psalm 19:1',            text: 'The heavens declare the glory of God, and the sky above proclaims his handiwork.' },
    { ref: 'Colossians 3:23',       text: 'Whatever you do, work heartily, as for the Lord and not for men.' },
    { ref: '1 Corinthians 14:40',   text: 'But all things should be done decently and in order.' },
    { ref: 'Psalm 96:9',            text: 'Worship the Lord in the splendor of holiness; tremble before him, all the earth!' },
  ];

  var RUNSHEET_ITEMS = [
    { time: 'Pre-service',  task: 'Sound check, video test, slides loaded and advanced to title' },
    { time: 'Opening',      task: 'Announce start, fade house lights if applicable, roll intro' },
    { time: 'Worship',      task: 'Follow worship leader cues, advance lyrics slides in sync' },
    { time: 'Sermon',       task: 'Switch to speaker cam, have sermon slides ready on standby' },
    { time: 'Offering',     task: 'Ambient slide, soft background audio if applicable' },
    { time: 'Closing',      task: 'Advance outro, announcements slide, fade to standby' },
    { time: 'Post-service', task: 'House lights up, loop info slide, safe shutdown sequence' },
  ];

  // ── Col 1: Production Notes ───────────────────────────────────────────────
  function buildProductionCol() {
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-stage)">',
      '    Production Notes &mdash; ' + todayLong(),
      '  </p>',
      '  <h2 class="np-headline">The Visual Ministry</h2>',
      '  <p class="np-byline" style="font-variant:small-caps;">Media · Presentation · Technical Excellence</p>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">',
      '    <p>Bezalel was the first person in Scripture specifically filled with the Spirit for a craft \u2014 and that craft was art. The visual ministry of the church stands in that lineage. The media team are not technicians; they are artisans called to help the congregation focus on God.</p>',
      '    <p>Every slide, every camera cut, every projected word is a service to the gathered people. The goal is invisibility \u2014 when the stage does its job perfectly, no one notices it. The Word and the worship fill the room instead.</p>',
      '  </div>',
      '  <p class="np-col__flag" style="margin-top:18px">Stage Notes</p>',
      '  <p class="np-body" style="font-size:0.85rem;font-style:italic;">',
      '    Production notes, slide decks, and run-of-show files can be shared through the Editor\u2019s Desk. Contact your administrator to enable media publishing.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Col 2: Verse for Visuals ──────────────────────────────────────────────
  function buildVerseCol() {
    var sc = VISUAL_SCRIPTURES[new Date().getDay()];
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Verse for Visuals</p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-stage)">',
      '    <p>\u201c' + esc(sc.text) + '\u201d</p>',
      '    <footer>' + esc(sc.ref) + ' (ESV)</footer>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <p class="np-col__flag" style="margin-top:0">The Bezalel Principle</p>',
      '  <div class="np-body" style="font-size:0.87rem;">',
      '    <p>The Spirit of God produces technical excellence. Every great craftsman in Scripture operated under divine anointing. The media team\u2019s skill is a spiritual gift \u2014 train it, steward it, and offer it to God without apology.</p>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Col 3: Technical Runsheet ─────────────────────────────────────────────
  function buildRunsheetCol() {
    var rows = RUNSHEET_ITEMS.map(function (item) {
      return [
        '<li class="np-briefs__item" style="padding:7px 0">',
        '  <span class="np-briefs__title" style="font-family:var(--font-headline);font-size:0.8rem;color:var(--ink-dim);min-width:90px;display:inline-block;">' + esc(item.time) + '</span>',
        '  <span class="np-briefs__deck" style="font-size:0.84rem;">' + esc(item.task) + '</span>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Service Runsheet</p>',
      '  <ul class="np-briefs">' + rows + '</ul>',
      '  <p class="np-body" style="font-size:0.83rem;font-style:italic;margin-top:12px;">',
      '    Generic runsheet template. Customise in the Editor\u2019s Desk for your church\u2019s order of service.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-stage)">',
      '  <p class="np-banner__flag" style="color:var(--sec-stage)">',
      '    The Flock Herald &mdash; The Stage',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">Media, presentations, and the visual ministry of the church.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Stage';
    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildProductionCol(),
      buildVerseCol(),
      buildRunsheetCol(),
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
