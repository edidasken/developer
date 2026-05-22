/**
 * the_shepherds_desk.js — The Shepherd's Desk Section Content Engine
 *
 * Renders the cornerstone section (#section-main) as a broadsheet page.
 * Restricted section (minRole: 4) — pastor and admin only.
 *
 * Layout:
 *   ┌──────────────── BANNER ──────────────────┐
 *   │  The Shepherd's Desk · pastoral tools    │
 *   └──────────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  Today's        │  Apologetics     │  Pastoral Care   │
 *   │  Doctrine       │  Q & A           │  Topic           │
 *   │  (drop cap)     │                  │                  │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-cornerstone) = #1a2a3a (Blueprint Slate)
 *
 * Data:
 *   theology.js   — rotates daily (27 doctrine sections)
 *   apologetics.js — rotates daily (115 Q&As)
 *   counseling.js  — rotates daily (50 pastoral care topics)
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

  // ── Static fallbacks ──────────────────────────────────────────────────────
  var STATIC = {
    doctrine: {
      categoryTitle:    'Theology Proper',
      sectionTitle:     'The Triune God',
      content:          'I believe in One Eternal God, who exists in three distinct Persons: Father, Son, and Holy Spirit. The Father reveals Himself through the Son and the Holy Spirit glorifies the Son. In Christ we behold the Fullness of the Godhead in bodily form, and through Him we are reconciled to God.',
      scriptureRefs:    'Matthew 28:19; 2 Corinthians 13:14; Colossians 2:9',
    },
    apologetic: {
      questionTitle:    'What is sin?',
      answerContent:    'Sin is any failure to conform to God\'s holy character and law in thought, word, or deed.',
      quoteText:        'Everyone who makes a practice of sinning also practices lawlessness; sin is lawlessness.',
      referenceText:    '1 John 3:4 (ESV)',
    },
    care: {
      title:      'Grief & Loss',
      definition: 'Grief is the natural response to significant loss. God does not ask us to skip grief — He promises to be present in it.',
      steps:      'Acknowledge the reality of the loss. Permit yourself to grieve honestly before God. Seek the comfort of the Holy Spirit and the community of the church.',
      scriptures: 'Psalm 34:18; John 11:35; Romans 8:18',
    },
  };

  // ── Load from bundles ─────────────────────────────────────────────────────
  function loadData() {
    var doy = dayOfYear(new Date());
    var result = { doctrine: STATIC.doctrine, apologetic: STATIC.apologetic, care: STATIC.care };

    try {
      var theology = window.HERALD_DATA && window.HERALD_DATA.theology;
      if (theology && theology.length) {
        var t = theology[doy % theology.length];
        if (t) result.doctrine = {
          categoryTitle: t.categoryTitle  || STATIC.doctrine.categoryTitle,
          sectionTitle:  t.sectionTitle   || STATIC.doctrine.sectionTitle,
          content:       t.content        || STATIC.doctrine.content,
          scriptureRefs: t.scriptureRefs  || STATIC.doctrine.scriptureRefs,
        };
      }
    } catch (_) {}

    try {
      var apolo = window.HERALD_DATA && window.HERALD_DATA.apologetics;
      if (apolo && apolo.length) {
        var a = apolo[doy % apolo.length];
        if (a) result.apologetic = {
          questionTitle: a.questionTitle || a.questionId || STATIC.apologetic.questionTitle,
          answerContent: a.answerContent || STATIC.apologetic.answerContent,
          quoteText:     a.quoteText     || STATIC.apologetic.quoteText,
          referenceText: a.referenceText || STATIC.apologetic.referenceText,
        };
      }
    } catch (_) {}

    try {
      var counsel = window.HERALD_DATA && window.HERALD_DATA.counseling;
      if (counsel && counsel.length) {
        var c = counsel[doy % counsel.length];
        if (c) result.care = {
          title:      c.title      || STATIC.care.title,
          icon:       c.icon       || '',
          definition: c.definition || STATIC.care.definition,
          steps:      c.steps      || STATIC.care.steps,
          scriptures: c.scriptures || STATIC.care.scriptures,
        };
      }
    } catch (_) {}

    try {
      var heart = window.HERALD_DATA && window.HERALD_DATA.heart;
      if (heart && heart.length) {
        var h = heart[doy % heart.length];
        if (h) result.heart = {
          category:     h['Category']     || '',
          question:     h['Question']     || '',
          prescription: h['Prescription'] || '',
          verse:        h['Verse Reference'] || '',
        };
      }
    } catch (_) {}

    try {
      var mirror = window.HERALD_DATA && window.HERALD_DATA.mirror;
      if (mirror && mirror.length) {
        var m = mirror[doy % mirror.length];
        if (m) result.mirror = {
          category:     m['Category Title'] || '',
          question:     m['Question']       || '',
          prescription: m['Prescription']   || '',
          scripture:    m['Scripture']      || '',
        };
      }
    } catch (_) {}

    return result;
  }

  // ── Col 1: Today's Doctrine ───────────────────────────────────────────────
  function buildDoctrineCol(d, mirror) {
    // Break content into ~2 paragraphs at sentence boundaries
    var raw   = d.content;
    var mid   = Math.floor(raw.length / 2);
    var split = raw.indexOf('. ', mid);
    var p1    = split > -1 ? raw.slice(0, split + 1) : raw;
    var p2    = split > -1 ? raw.slice(split + 2)    : '';

    var mirrorHTML = '';
    if (mirror && mirror.question) {
      mirrorHTML = [
        '  <hr class="np-column-rule" style="margin-top:18px">',
        '  <p class="np-col__flag" style="margin-top:0">Shepherd\u2019s Mirror \u2014 ' + esc(mirror.category) + '</p>',
        '  <p style="font-size:0.85rem;font-style:italic;line-height:1.5;margin:6px 0 8px;">' + esc(mirror.question) + '</p>',
        mirror.prescription
          ? '  <p style="font-size:0.82rem;color:var(--ink-dim);">' + esc(mirror.prescription) + '</p>'
          : '',
        mirror.scripture
          ? '  <p class="np-byline" style="margin-top:8px;font-size:0.8rem;font-variant:small-caps;">' + esc(mirror.scripture) + '</p>'
          : '',
      ].filter(Boolean).join('\n');
    }

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-cornerstone)">',
      '    Today\u2019s Doctrine &mdash; ' + todayLong(),
      '  </p>',
      '  <h2 class="np-headline">' + esc(d.sectionTitle) + '</h2>',
      '  <p class="np-byline" style="font-variant:small-caps;letter-spacing:.06em;">' + esc(d.categoryTitle) + '</p>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">',
      '    <p>' + esc(p1) + '</p>',
      p2 ? '    <p>' + esc(p2) + '</p>' : '',
      '  </div>',
      d.scriptureRefs
        ? '  <p class="np-byline" style="margin-top:14px;font-size:0.82rem;font-variant:small-caps;">' + esc(d.scriptureRefs) + '</p>'
        : '',
      mirrorHTML,
      '</div>',
    ].filter(Boolean).join('\n');
  }

  // ── Col 2: Apologetics Q&A ────────────────────────────────────────────────
  function buildApologeticsCol(a) {
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Apologetics</p>',
      '  <p class="np-byline" style="font-family:var(--font-headline);font-size:1rem;margin-bottom:8px;">',
      '    ' + esc(a.questionTitle),
      '  </p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-cornerstone)">',
      '    <p>\u201c' + esc(a.quoteText) + '\u201d</p>',
      '    <footer>' + esc(a.referenceText) + '</footer>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body" style="font-size:0.88rem;">',
      '    <p>' + esc(a.answerContent) + '</p>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Col 3: Pastoral Care Topic ────────────────────────────────────────────
  function buildCareCol(c, heart) {
    var scriptureItems = (c.scriptures || '').split(/[;,]/).map(function (s) { return s.trim(); }).filter(Boolean);
    var scriptureHTML  = scriptureItems.length
      ? '<ul class="np-briefs">' + scriptureItems.map(function (s) {
          return '<li class="np-briefs__item"><span class="np-briefs__title" style="font-size:0.85rem">' + esc(s) + '</span></li>';
        }).join('') + '</ul>'
      : '';

    var heartHTML = '';
    if (heart && heart.question) {
      heartHTML = [
        '  <hr class="np-column-rule" style="margin-top:18px">',
        '  <p class="np-col__flag" style="margin-top:0">Heart Check \u2014 ' + esc(heart.category) + '</p>',
        '  <p style="font-size:0.85rem;font-style:italic;line-height:1.5;margin:6px 0 8px;">' + esc(heart.question) + '</p>',
        heart.prescription
          ? '  <p style="font-size:0.82rem;color:var(--ink-dim);">' + esc(heart.prescription) + '</p>'
          : '',
        heart.verse
          ? '  <p class="np-byline" style="margin-top:8px;font-size:0.8rem;font-variant:small-caps;">' + esc(heart.verse) + '</p>'
          : '',
      ].filter(Boolean).join('\n');
    }

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Pastoral Care</p>',
      '  <p class="np-byline" style="font-family:var(--font-headline);font-size:1.05rem;margin-bottom:8px;">',
      '    ' + (c.icon ? esc(c.icon) + ' ' : '') + esc(c.title),
      '  </p>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body" style="font-size:0.88rem;">',
      '    <p>' + esc(c.definition) + '</p>',
      '    <p>' + esc(c.steps) + '</p>',
      '  </div>',
      scriptureHTML
        ? '  <p class="np-col__flag" style="margin-top:16px">Key Scriptures</p>' + scriptureHTML
        : '',
      heartHTML,
      '</div>',
    ].filter(Boolean).join('\n');
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-cornerstone)">',
      '  <p class="np-banner__flag" style="color:var(--sec-cornerstone)">',
      '    The Flock Herald &mdash; The Shepherd\u2019s Desk',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">Doctrine, apologetics, and pastoral care &mdash; tools for the shepherd.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var main = document.getElementById('panel-shepherd') || document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Shepherd\u2019s Desk';
    var data = loadData();
    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildDoctrineCol(data.doctrine, data.mirror),
      buildApologeticsCol(data.apologetic),
      buildCareCol(data.care, data.heart),
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
