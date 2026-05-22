/**
 * the_harvest_report.js — The Harvest Section Content Engine
 *
 * Renders the harvest section (#section-main) as a broadsheet page.
 * Restricted section (minRole: 4) — pastor and admin only.
 *
 * Layout:
 *   ┌──────────────── BANNER ──────────────────┐
 *   │  The Harvest · giving & stewardship      │
 *   └──────────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  Giving Report  │  Stewardship     │  Scripture on    │
 *   │  (Firestore     │  Principle       │  Generosity      │
 *   │   hook)         │                  │                  │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-harvest) = #0e2818 (Field Dispatch)
 *
 * Data: No live data — static editorial + Firestore hook for giving reports.
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

  // ── Stewardship principles (rotates weekly) ───────────────────────────────
  var PRINCIPLES = [
    {
      title: 'The Tithe Is the Beginning',
      body:  'The tithe (10%) is not the ceiling of generosity \u2014 it is the floor. It is the act of acknowledging that everything already belongs to God. When Malachi says \u201cbring the full tithe into the storehouse,\u201d he is not describing a payment to God; he is describing the return of what is already his.',
      ref:   'Malachi 3:10; Leviticus 27:30',
    },
    {
      title: 'The Widow\u2019s Two Coins',
      body:  'Jesus did not praise the widow\u2019s offering because it was large \u2014 it was small. He praised it because it was everything. The principle of proportional generosity is not percentage; it is posture. God looks at what you kept, not what you gave.',
      ref:   'Mark 12:41\u201344',
    },
    {
      title: 'Generosity Breaks the Power of Mammon',
      body:  'Paul does not say the love of money is a symptom of sin. He says it is the root. Radical generosity is the antidote \u2014 not because God needs our money, but because we need to be freed from it. Every act of giving is a declaration that we serve God and not wealth.',
      ref:   '1 Timothy 6:10, 17\u201319',
    },
    {
      title: 'The Grace of Giving',
      body:  'In 2 Corinthians 8, Paul calls the Macedonians\u2019 generosity a \u201cgrace.\u201d They begged to participate in the gift. Giving is not a burden to fulfill; it is a grace to pursue. The most generous people in the church are usually those who have experienced the most.',
      ref:   '2 Corinthians 8:1\u20135',
    },
  ];

  function thisPrinciple() {
    return PRINCIPLES[Math.floor(dayOfYear(new Date()) / 7) % PRINCIPLES.length];
  }

  // ── Generosity scriptures (rotates daily) ────────────────────────────────
  var GEN_SCRIPTURES = [
    { ref: '2 Corinthians 9:6\u20137', text: 'Whoever sows sparingly will also reap sparingly, and whoever sows bountifully will also reap bountifully. Each one must give as he has decided in his heart, not reluctantly or under compulsion, for God loves a cheerful giver.' },
    { ref: 'Proverbs 11:24\u201325',   text: 'One gives freely, yet grows all the richer; another withholds what he should give, and only suffers want. Whoever brings blessing will be enriched, and one who waters will himself be watered.' },
    { ref: 'Luke 6:38',              text: 'Give, and it will be given to you. Good measure, pressed down, shaken together, running over, will be put into your lap. For with the measure you use it will be measured back to you.' },
    { ref: 'Acts 4:34\u201335',       text: 'There was not a needy person among them, for as many as were owners of lands or houses sold them and brought the proceeds of what was sold and laid it at the apostles\u2019 feet, and it was distributed to each as any had need.' },
    { ref: 'Matthew 6:19\u201321',    text: 'Do not lay up for yourselves treasures on earth, where moth and rust destroy and where thieves break in and steal, but lay up for yourselves treasures in heaven.' },
    { ref: '1 Chronicles 29:14',     text: '\u201cBut who am I, and what is my people, that we should be able thus to offer willingly? For all things come from you, and of your own have we given you.\u201d' },
    { ref: 'Proverbs 3:9\u201310',    text: 'Honor the Lord with your wealth and with the firstfruits of all your produce; then your barns will be filled with plenty, and your vats will be bursting with wine.' },
  ];

  function buildGenerosityCol() {
    var sc = GEN_SCRIPTURES[new Date().getDay()];
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Scripture on Generosity</p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-harvest)">',
      '    <p>\u201c' + esc(sc.text) + '\u201d</p>',
      '    <footer>' + esc(sc.ref) + ' (ESV)</footer>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body" style="font-size:0.87rem;">',
      '    <p>The harvest is the fruit of sowing. Every financial decision the church makes either reflects or undermines its theology. These pages exist to help the pastor steward the harvest well.</p>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Col 1: Giving Report ──────────────────────────────────────────────────
  function buildGivingCol() {
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-harvest)">',
      '    Giving Report &mdash; ' + todayLong(),
      '  </p>',
      '  <h2 class="np-headline">The Harvest</h2>',
      '  <p class="np-byline" style="font-variant:small-caps;">Stewardship &middot; Generosity &middot; Financial Health</p>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">',
      '    <p>This section is the financial dashboard of the church \u2014 a place for the pastor and administrator to track the harvest. Giving reports, budget status, and generosity trends live here in a future phase.</p>',
      '    <p>The church\u2019s financial health is a spiritual indicator. A generous congregation is a healthy congregation. These numbers matter because people\u2019s hearts matter \u2014 and where the treasure goes, the heart follows.</p>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <p class="np-col__flag" style="margin-top:0">Giving Data</p>',
      '  <p class="np-body" style="font-size:0.85rem;font-style:italic;">',
      '    Live giving reports will be published here from your church\u2019s giving platform. Contact your administrator to enable financial reporting.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Col 2: Stewardship Principle ──────────────────────────────────────────
  function buildPrincipleCol() {
    var p = thisPrinciple();
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Stewardship Principle</p>',
      '  <h2 class="np-headline" style="font-size:1.3rem;">' + esc(p.title) + '</h2>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body" style="font-size:0.88rem;">',
      '    <p>' + esc(p.body) + '</p>',
      '  </div>',
      '  <p class="np-byline" style="margin-top:14px;font-size:0.82rem;font-variant:small-caps;">' + esc(p.ref) + '</p>',
      '</div>',
    ].join('\n');
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-harvest)">',
      '  <p class="np-banner__flag" style="color:var(--sec-harvest)">',
      '    The Flock Herald &mdash; The Harvest',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">Giving, stewardship, and the fruit of a generous congregation.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Harvest';
    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildGivingCol(),
      buildPrincipleCol(),
      buildGenerosityCol(),
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
