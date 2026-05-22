/**
 * the_living_water_section.js — The Wellspring Section Content Engine
 *
 * Renders the scripture/reflection section (#section-main) as a broadsheet page.
 * Public section (minRole: -1) — visible to all visitors.
 *
 * NOTE: Named "the_living_water_section.js" to avoid conflict with the Firebase
 * infrastructure script "the_living_water.js" already loaded in section pages.
 *
 * Layout:
 *   ┌────────── BANNER ──────────┐
 *   │  The Wellspring · scripture│
 *   └────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  Today's        │  Reflection      │  Weekly          │
 *   │  Scripture      │  Questions       │  Passage List    │
 *   │  (drop cap)     │                  │                  │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-living-water) = #09102e  (Wellspring Navy)
 *
 * Phase 0: static placeholder content
 * Phase 1: live scripture via Wellspring API / Firestore
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

  // ── Phase 0 static content ────────────────────────────────────────────────
  var STATIC = {
    scriptureRef:   'John 4:13\u201314',
    scriptureText:  '"Everyone who drinks this water will be thirsty again, but whoever drinks the water I give them will never thirst. Indeed, the water I give them will become in them a spring of water welling up to eternal life."',
    scriptureTrans: 'NIV',

    expositionTitle: 'Living Water',
    expositionBody:  [
      'Every thirst points to this one. The woman at the well had come for water — ' +
      'the kind that fills jars, the kind that runs out by evening. She met instead ' +
      'the One whose water never runs dry.',

      'The Wellspring is not a metaphor. It is the life of God offered freely, ' +
      'poured into those who ask. The congregation gathers here not to consume information, ' +
      'but to drink. Come thirsty. Come often. The spring does not run dry.',
    ],

    reflectionTitle:   'Questions for Reflection',
    reflectionQuestions: [
      'What thirst are you trying to satisfy today with something other than Christ?',
      'Where have you seen the living water at work in someone around you this week?',
      'How might you become a conduit of this water to someone who is thirsty today?',
    ],
    reflectionNote:  'These questions are for personal meditation or small group discussion.',

    passageTitle: 'This Week\u2019s Passages',
    passages: [
      { ref: 'John 4:1\u201342',       theme: 'The woman at the well' },
      { ref: 'Psalm 42',              theme: 'As the deer pants for water' },
      { ref: 'Isaiah 55:1\u20133',     theme: 'Come, all who are thirsty' },
      { ref: 'Revelation 22:1\u20132', theme: 'The river of life' },
      { ref: 'Ezekiel 47:1\u201312',   theme: 'Water flowing from the temple' },
    ],
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  function buildScriptureCol(d) {
    var bodyHTML = d.expositionBody.map(function (p) { return '<p>' + p + '</p>'; }).join('\n');
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-living-water)">',
      '    Today\u2019s Scripture &mdash; ' + todayLong(),
      '  </p>',
      '  <h2 class="np-headline">' + esc(d.expositionTitle) + '</h2>',
      '  <p class="np-byline" style="font-variant:small-caps;letter-spacing:.06em;">',
      '    ' + esc(d.scriptureRef) + ' &mdash; ' + esc(d.scriptureTrans),
      '  </p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-living-water)">',
      '    <p>' + esc(d.scriptureText) + '</p>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">' + bodyHTML + '</div>',
      '</div>',
    ].join('\n');
  }

  function buildReflectionCol(d) {
    var qItems = d.reflectionQuestions.map(function (q, i) {
      return [
        '<li class="np-briefs__item" style="padding:12px 0">',
        '  <span class="np-briefs__title" style="font-size:0.88rem;font-style:italic;font-family:var(--font-body)">',
        '    ' + (i + 1) + '. ' + esc(q),
        '  </span>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">' + esc(d.reflectionTitle) + '</p>',
      '  <ul class="np-briefs">' + qItems + '</ul>',
      '  <hr class="np-column-rule">',
      '  <p class="np-body" style="font-style:italic;font-size:0.8rem;color:var(--ink-dim)">' +
           esc(d.reflectionNote) + '</p>',
      '</div>',
    ].join('\n');
  }

  function buildPassagesCol(d) {
    var items = d.passages.map(function (p) {
      return [
        '<li class="np-briefs__item">',
        '  <span class="np-briefs__title">' + esc(p.ref) + '</span>',
        '  <span class="np-briefs__deck">' + esc(p.theme) + '</span>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">' + esc(d.passageTitle) + '</p>',
      '  <ul class="np-briefs">' + items + '</ul>',
      '</div>',
    ].join('\n');
  }

  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-living-water)">',
      '  <p class="np-banner__flag" style="color:var(--sec-living-water)">',
      '    The Flock Herald &mdash; The Wellspring',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">Scripture, reflection, and living water for the soul.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render(data) {
    var main = document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Wellspring';

    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildScriptureCol(data),
      buildReflectionCol(data),
      buildPassagesCol(data),
      '</div>',
      '</div>',
    ].join('\n');
  }

  function fetchContent(callback) {
    try {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        var d = new Date();
        var dateKey = d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0');
        firebase.firestore().collection('wellspring').doc(dateKey).get()
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
