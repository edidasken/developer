/**
 * the_tabernacle.js — The Tabernacle Section Content Engine
 *
 * Renders the Tabernacle section (#section-main) as a broadsheet page.
 *
 * Layout:
 *   ┌────────────── BANNER ─────────────────┐
 *   │  The Tabernacle · worship & devotion  │
 *   └───────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  Today's        │  Morning Prayer  │  Worship Notes   │
 *   │  Devotional     │  Focus           │  (song set)      │
 *   │  (drop cap)     │                  │                  │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Phase 0: static placeholder content (today's date, church name, formatting)
 * Phase 1: live devotional from Firestore (devotionals/{date}/tabernacle)
 * Phase 2: song set from Firestore (worship/{date}/songSet)
 *
 * Requires: window.HERALD_SECTIONS (from the_gates.js)
 */

(function () {
  'use strict';

  var ROLE_MAP = { readonly: 0, volunteer: 1, care: 2, deacon: 2,
                   leader: 3, treasurer: 3, pastor: 4, admin: 5 };

  function getUserRoleLevel() {
    if (typeof Nehemiah !== 'undefined' && Nehemiah.getSession) {
      try {
        var sess = Nehemiah.getSession();
        if (sess && typeof sess.roleLevel === 'number') return sess.roleLevel;
        if (sess && sess.role && ROLE_MAP[sess.role] !== undefined) return ROLE_MAP[sess.role];
      } catch (_) {}
    }
    return -1;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Date helpers ─────────────────────────────────────────────────────────
  var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  function todayLong() {
    var d = new Date();
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function todayKey() {
    // Returns "YYYY-MM-DD" for Firestore doc IDs
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  // ── Phase 0 static content ────────────────────────────────────────────────
  // These are replaced by live Firestore data in Phase 1.
  var STATIC = {
    devotionalTitle:   'Come, Let Us Worship',
    devotionalVerse:   'Psalm 95:6',
    devotionalText:    'Come, let us bow down in worship, let us kneel before the Lord our Maker.',
    devotionalBody:    [
      'Every morning is an invitation. The congregation gathers not only in the pews on Sunday, ' +
      'but in the quiet before the day begins \u2014 in kitchens, in cars, at desks. ' +
      'This is the Tabernacle that travels with the flock.',

      'The posture of worship is not confined to a building. It is the orientation of the heart ' +
      'toward the One who made it. Today, wherever you find yourself, you are standing on holy ground.',
    ],
    prayerFocus:       'The Congregation',
    prayerBody:        [
      'Lord, gather your people today. Knit together those who are scattered, ' +
      'encourage those who are weary, and strengthen those who carry heavy burdens.',
      'May this congregation be a house of prayer for all who enter.',
    ],
    prayerPrompt:      'Who in your congregation needs prayer today?',
    worshipNotes:      'Sunday Set List',
    worshipSongs:      [
      { title: 'Great Is Thy Faithfulness',    artist: 'Thomas Chisholm' },
      { title: 'Come Thou Fount',              artist: 'Robert Robinson' },
      { title: 'It Is Well with My Soul',      artist: 'Horatio Spafford' },
      { title: 'How Great Thou Art',           artist: 'Stuart K. Hine' },
    ],
    worshipNote:       'Set list subject to change. Contact the worship leader for details.',
  };

  // ── Col 1: Today's Devotional ─────────────────────────────────────────────
  function buildDevotionalCol(data) {
    var bodyHTML = data.devotionalBody.map(function (p) {
      return '<p>' + p + '</p>';
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-tabernacle)">Today\u2019s Devotional &mdash; ' + todayLong() + '</p>',
      '  <h2 class="np-headline">' + esc(data.devotionalTitle) + '</h2>',
      '  <p class="np-byline" style="font-variant:small-caps;letter-spacing:.06em;">' +
           esc(data.devotionalVerse) + '</p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-tabernacle)">',
      '    <p>\u201c' + esc(data.devotionalText) + '\u201d</p>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body np-drop-cap">' + bodyHTML + '</div>',
      '</div>',
    ].join('\n');
  }

  // ── Col 2: Morning Prayer Focus ───────────────────────────────────────────
  function buildPrayerCol(data) {
    var bodyHTML = data.prayerBody.map(function (p) {
      return '<p>' + p + '</p>';
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Morning Prayer</p>',
      '  <p class="np-byline" style="font-family:var(--font-headline);font-size:1.1rem;margin-bottom:12px;">' +
           esc(data.prayerFocus) + '</p>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body">' + bodyHTML + '</div>',
      '  <p class="np-byline" style="margin-top:16px;font-style:italic;">' +
           esc(data.prayerPrompt) + '</p>',
      '</div>',
    ].join('\n');
  }

  // ── Col 3: Worship Notes ──────────────────────────────────────────────────
  function buildWorshipCol(data) {
    var songItems = data.worshipSongs.map(function (s) {
      return [
        '<li class="np-briefs__item">',
        '  <span class="np-briefs__title">' + esc(s.title) + '</span>',
        '  <span class="np-briefs__deck">' + esc(s.artist) + '</span>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Worship Notes</p>',
      '  <p class="np-byline" style="font-family:var(--font-headline);font-size:0.95rem;margin-bottom:12px;">' +
           esc(data.worshipNotes) + '</p>',
      '  <ul class="np-briefs">',
      songItems,
      '  </ul>',
      '  <p class="np-briefs__deck" style="margin-top:14px;padding-top:10px;border-top:1px solid var(--rule-faint)">' +
           esc(data.worshipNote) + '</p>',
      '</div>',
    ].join('\n');
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-tabernacle)">',
      '  <p class="np-banner__flag" style="color:var(--sec-tabernacle)">',
      '    The Flock Herald &mdash; The Tabernacle',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">Worship, devotional, and the life of prayer.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Main render ───────────────────────────────────────────────────────────
  function renderTabernacle(data) {
    var main = document.getElementById('section-main');
    if (!main) return;

    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Tabernacle';

    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildDevotionalCol(data),
      buildPrayerCol(data),
      buildWorshipCol(data),
      '</div>',
      '</div>',
    ].join('\n');
  }

  // ── Phase 1: Firestore fetch (stubbed — activates when TheVine is ready) ──
  function fetchLiveContent(dateKey, callback) {
    // Phase 1: read from Firestore devotionals/{dateKey}/sections/tabernacle
    // For now, always falls back to static content
    try {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        var db = firebase.firestore();
        db.collection('devotionals').doc(dateKey)
          .get()
          .then(function (doc) {
            if (doc.exists) {
              var d = doc.data();
              callback(Object.assign({}, STATIC, d));
            } else {
              callback(STATIC);
            }
          })
          .catch(function () { callback(STATIC); });
        return;
      }
    } catch (_) {}
    callback(STATIC);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function boot() {
    var dateKey = todayKey();
    fetchLiveContent(dateKey, function (data) {
      renderTabernacle(data);
    });

    if (typeof Nehemiah !== 'undefined' && typeof Nehemiah.onAuthResolved === 'function') {
      Nehemiah.onAuthResolved(function () {
        fetchLiveContent(dateKey, function (data) {
          renderTabernacle(data);
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
