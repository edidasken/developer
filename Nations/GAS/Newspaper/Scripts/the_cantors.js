/**
 * the_cantors.js — The Cantors Section Content Engine
 *
 * Renders the levites section (#section-main) as a broadsheet page.
 * Leader section (minRole: 3) — worship team leaders and above.
 *
 * Layout:
 *   ┌──────────────── BANNER ──────────────────┐
 *   │  The Cantors · music & worship           │
 *   └──────────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  The Ministry   │  Worship         │  Song of Ascents │
 *   │  of Song        │  Scripture       │  (rotating Psalm)│
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-levites) = #1a3d28 (Cedar Green)
 *
 * Data: window.HERALD_DATA.psalms — Song of Ascents (Psalms 120–134)
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

  // ── Songs of Ascents (Psalms 120–134, 15 psalms) ──────────────────────────
  var ASCENT_PSALMS = [120,121,122,123,124,125,126,127,128,129,130,131,132,133,134];

  function loadPsalm() {
    try {
      var psalmsData = window.HERALD_DATA && window.HERALD_DATA.psalms;
      if (!psalmsData || !psalmsData.byNumber) return null;
      var psNum = ASCENT_PSALMS[new Date().getDay() % ASCENT_PSALMS.length];
      return psalmsData.byNumber[psNum] || null;
    } catch (_) { return null; }
  }

  // ── Col 1: The Ministry of Song ───────────────────────────────────────────
  function buildMinistryCol() {
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-levites)">',
      '    The Cantors &mdash; ' + todayLong(),
      '  </p>',
      '  <h2 class="np-headline">The Ministry of Song</h2>',
      '  <p class="np-byline" style="font-variant:small-caps;">Worship · Music · The Levitical Calling</p>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">',
      '    <p>When David set the Levites apart as worshipers in the tabernacle, he established a pattern that runs through all of Scripture: the gathered people of God sing. The cantor \u2014 the song-leader \u2014 is not a performer; they are a guide, leading the congregation through the act of expressing its faith in music.</p>',
      '    <p>This section belongs to those who bear that calling. The worship set, the songs of preparation, the scripture that frames the gathering \u2014 all of it is the Levitical work. It is holy ground.</p>',
      '  </div>',
      '  <p class="np-col__flag" style="margin-top:18px">Song Selection</p>',
      '  <p class="np-body" style="font-size:0.85rem;font-style:italic;">',
      '    Worship set lists and song archives are managed through FlockStand in the FlockOS app. Song selection here reflects the week\u2019s teaching texts.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Col 2: Worship Scripture ──────────────────────────────────────────────
  var WORSHIP_SCRIPTURES = [
    { ref: 'Psalm 100:1\u20133',    text: 'Make a joyful noise to the Lord, all the earth! Serve the Lord with gladness! Come into his presence with singing! Know that the Lord, he is God! It is he who made us, and we are his; we are his people, and the sheep of his pasture.' },
    { ref: 'Revelation 5:11\u201312', text: 'Then I looked, and I heard around the throne and the living creatures and the elders the voice of many angels, numbering myriads of myriads and thousands of thousands, saying with a loud voice, \u201cWorthy is the Lamb who was slain.\u201d' },
    { ref: 'Colossians 3:16',      text: 'Let the word of Christ dwell in you richly, teaching and admonishing one another in all wisdom, singing psalms and hymns and spiritual songs, with thankfulness in your hearts to God.' },
    { ref: 'Zephaniah 3:17',       text: 'The Lord your God is in your midst, a mighty one who will save; he will rejoice over you with gladness; he will quiet you by his love; he will exult over you with loud singing.' },
    { ref: '2 Samuel 22:50',       text: 'For this I will praise you, O Lord, among the nations, and sing praises to your name.' },
    { ref: 'Psalm 95:1\u20132',    text: 'Oh come, let us sing to the Lord; let us make a joyful noise to the rock of our salvation! Let us come into his presence with thanksgiving; let us make a joyful noise to him with songs of praise!' },
    { ref: 'Ephesians 5:19',       text: 'Addressing one another in psalms and hymns and spiritual songs, singing and making melody to the Lord with your heart.' },
  ];

  function buildWorshipCol() {
    var sc = WORSHIP_SCRIPTURES[new Date().getDay()];
    var WORSHIP_NOTES = [
      'Worship is a weapon, a witness, and a welcome. The congregation sings because God is worthy, because the world is watching, and because the Spirit inhabits the praise of his people.',
      'The opening song sets the frame. Pray before you choose it. The congregation\u2019s first corporate act is the declaration of who God is.',
      'Leave room in the set for silence. Corporate silence is not awkward \u2014 it is powerful. Let the congregation hear God.',
    ];
    var note = WORSHIP_NOTES[new Date().getDay() % WORSHIP_NOTES.length];
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Worship Scripture</p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-levites)">',
      '    <p>\u201c' + esc(sc.text) + '\u201d</p>',
      '    <footer>' + esc(sc.ref) + ' (ESV)</footer>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <p class="np-col__flag" style="margin-top:0">For the Worship Leader</p>',
      '  <div class="np-body" style="font-size:0.87rem;">',
      '    <p>' + esc(note) + '</p>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Col 3: Song of Ascents ────────────────────────────────────────────────
  function buildAscentCol(psalm) {
    var psNum = ASCENT_PSALMS[new Date().getDay() % ASCENT_PSALMS.length];
    var psTitle = psalm ? psalm.title : ('Psalm ' + psNum);
    var psBody  = psalm && psalm.summary
      ? psalm.summary
      : 'The Songs of Ascents (Psalms 120\u2013134) were sung by pilgrims climbing the road to Jerusalem for the great feasts. They are songs of the journey \u2014 of longing, arrival, and joy in the presence of God. They remain the worship leader\u2019s companion.';

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Song of Ascents &mdash; Psalm ' + psNum + '</p>',
      '  <h2 class="np-headline" style="font-size:1.5rem;">' + esc(psTitle) + '</h2>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body" style="font-size:0.87rem;">',
      '    <p>' + esc(psBody) + '</p>',
      '  </div>',
      '  <p class="np-body" style="font-size:0.83rem;font-style:italic;margin-top:12px;">',
      '    The 15 Songs of Ascents rotate daily through this section. Read one each day in preparation for Sunday\u2019s gathering.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-levites)">',
      '  <p class="np-banner__flag" style="color:var(--sec-levites)">',
      '    The Flock Herald &mdash; The Cantors',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">Music, worship planning, and the ministry of song.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Cantors';
    var psalm = loadPsalm();
    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildMinistryCol(),
      buildWorshipCol(),
      buildAscentCol(psalm),
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
