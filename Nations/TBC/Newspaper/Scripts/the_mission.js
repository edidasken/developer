/**
 * the_mission.js — The Mission Section Content Engine
 *
 * Renders the great_commission section (#section-main) as a broadsheet page.
 * Restricted section (minRole: 4) — pastor and admin only.
 *
 * Layout:
 *   ┌──────────────── BANNER ──────────────────┐
 *   │  The Mission · praying for the nations   │
 *   └──────────────────────────────────────────┘
 *   ┌── COL 1 (2fr) ──┬── COL 2 (1fr) ──┬── COL 3 (1fr) ──┐
 *   │  Nation Profile │  Prayer Report   │  Prayercast      │
 *   │  (flag, name,   │  (owSummary,     │  (embed if avail │
 *   │   stats)        │   challenges)    │   else stats)    │
 *   └─────────────────┴──────────────────┴──────────────────┘
 *
 * Accent: var(--sec-commission) = #a07818 (Altar Gold)
 *
 * Data:
 *   missions.js    — rotates weekly (238 countries)
 *   prayercast.js  — matched by country id (50 nations with videos)
 */

(function () {
  'use strict';

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function todayLong() {
    var d = new Date();
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function fmtNum(n) {
    if (!n && n !== 0) return '';
    return Number(n).toLocaleString('en-US');
  }

  function fmtPct(n) {
    if (!n && n !== 0) return '';
    return Number(n).toFixed(1) + '%';
  }

  function dayOfYear(date) {
    var start = new Date(date.getFullYear(), 0, 0);
    var diff  = date - start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60000;
    return Math.floor(diff / 86400000);
  }

  function weekNumber(date) {
    return Math.floor(dayOfYear(date) / 7);
  }

  // ── Static fallback ───────────────────────────────────────────────────────
  var STATIC_NATION = {
    _id:                'iran',
    countryName:        'Iran',
    icon:               '🇮🇷',
    region:             'Central Asia',
    continent:          'Asia',
    population:         '87,923,432',
    percentEvangelical: '0.19%',
    percentChristian:   '0.65%',
    persecutionLabel:   'Extreme',
    unreachedGroups:    '68 / 98',
    gospelAccess:       'Limited — active persecution. Underground church growing rapidly.',
    owSummary:          'Iran is experiencing one of the greatest church-growth movements in history, despite facing extreme government persecution of Christians. The underground church is thriving and evangelical Christianity is the fastest-growing religious group in the country.',
    owPrayerChallenges: 'Pray for the safety and boldness of house church leaders. Pray for those who face arrest, torture, and imprisonment for their faith. Pray for the complete Bible in Persian to reach every hand.',
    jpProfileUrl:       'https://joshuaproject.net/countries/IR',
  };

  // ── Load from bundles ─────────────────────────────────────────────────────
  function loadData() {
    var result = { nation: STATIC_NATION, video: null };
    var wk     = weekNumber(new Date());

    try {
      var nations = window.HERALD_DATA && window.HERALD_DATA.missions;
      if (nations && nations.length) {
        var n = nations[wk % nations.length];
        if (n && n.countryName) result.nation = n;
      }
    } catch (_) {}

    try {
      var videos = window.HERALD_DATA && window.HERALD_DATA.prayercast;
      if (videos && videos.length && result.nation._id) {
        var natId = result.nation._id.toLowerCase();
        for (var i = 0; i < videos.length; i++) {
          if (videos[i].id && videos[i].id.toLowerCase() === natId) {
            result.video = videos[i];
            break;
          }
        }
      }
    } catch (_) {}

    return result;
  }

  // ── Col 1: Nation Profile ─────────────────────────────────────────────────
  function buildProfileCol(n, wk) {
    var stats = [
      { label: 'Capital',          value: n.capital },
      { label: 'Region',           value: n.region },
      { label: 'Population',       value: n.population ? fmtNum(n.population) : '' },
      { label: 'Evangelical',      value: n.percentEvangelical != null ? fmtPct(n.percentEvangelical) : '' },
      { label: 'Christian',        value: n.percentChristian != null ? fmtPct(n.percentChristian) : '' },
      { label: 'Persecution',      value: n.persecutionLabel },
      { label: 'Unreached Groups', value: n.unreachedGroups != null ? String(n.unreachedGroups) : '' },
      { label: 'Bible Access',     value: n.bibleShortageTier },
      { label: '10/40 Window',     value: n.tenFortyWindow ? 'Yes' : '' },
    ].filter(function (s) { return s.value; });

    var rows = stats.map(function (s) {
      return [
        '<li class="np-briefs__item" style="padding:8px 0">',
        '  <span class="np-briefs__title" style="font-family:var(--font-headline);font-size:0.82rem;color:var(--ink-dim)">' + esc(s.label) + '</span>',
        '  <span class="np-briefs__deck" style="font-size:0.9rem;">' + esc(s.value) + '</span>',
        '</li>',
      ].join('\n');
    }).join('\n');

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag" style="color:var(--sec-commission)">',
      '    Nation of the Week &mdash; Week ' + wk,
      '  </p>',
      '  <h2 class="np-headline" style="font-size:2.2rem;">',
      '    ' + (n.icon ? esc(n.icon) + ' ' : '') + esc(n.countryName),
      '  </h2>',
      '  <hr class="np-column-rule">',
      '  <ul class="np-briefs">' + rows + '</ul>',
      n.gospelAccess
        ? [
            '  <p class="np-col__flag" style="margin-top:16px">Gospel Access</p>',
            '  <p class="np-body" style="font-size:0.86rem;">' + esc(n.gospelAccess) + '</p>',
          ].join('\n')
        : '',
      n.jpProfileUrl
        ? '  <p class="np-body" style="margin-top:10px;font-size:0.82rem;"><a href="' + esc(n.jpProfileUrl) + '" target="_blank" rel="noopener" style="color:var(--sec-commission)">Joshua Project Profile \u2192</a></p>'
        : '',
      '</div>',
    ].filter(Boolean).join('\n');
  }

  // ── Col 2: Prayer Report ──────────────────────────────────────────────────
  function buildPrayerCol(n) {
    var summary = n.owSummary || '';
    if (summary.length > 400) summary = summary.slice(0, 400).replace(/\S+$/, '') + '\u2026';

    var challenges = n.owPrayerChallenges || '';

    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Prayer Report</p>',
      '  <div class="np-body np-drop-cap" style="font-size:0.88rem;">',
      '    <p>' + esc(summary) + '</p>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <p class="np-col__flag" style="margin-top:0">Prayer Challenges</p>',
      '  <div class="np-body" style="font-size:0.86rem;">',
      '    <p>' + esc(challenges) + '</p>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ── Col 3: Prayercast Video / Stats ──────────────────────────────────────
  function buildVideoCol(n, video) {
    if (video && video.embedUrl) {
      var embedUrl = esc(video.embedUrl);
      if (embedUrl.indexOf('?') > -1) {
        embedUrl += '&rel=0&modestbranding=1';
      } else {
        embedUrl += '?rel=0&modestbranding=1';
      }
      return [
        '<div class="np-col">',
        '  <p class="np-col__flag">Prayercast Video</p>',
        '  <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:4px;margin-bottom:12px;">',
        '    <iframe',
        '      src="' + embedUrl + '"',
        '      style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"',
        '      allowfullscreen',
        '      loading="lazy"',
        '      title="Prayercast: ' + esc(n.countryName) + '"',
        '    ></iframe>',
        '  </div>',
        '  <p class="np-body" style="font-size:0.83rem;font-style:italic;">',
        '    Prayercast.com provides prayer-focused videos for unreached nations. Watch, pray, and believe.',
        '  </p>',
        '</div>',
      ].join('\n');
    }

    // Fallback — gospel summary
    return [
      '<div class="np-col">',
      '  <p class="np-col__flag">Missions Resources</p>',
      '  <div class="np-pull-quote" style="border-left-color:var(--sec-commission)">',
      '    <p>\u201cGo therefore and make disciples of all nations.\u201d</p>',
      '    <footer>Matthew 28:19 (ESV)</footer>',
      '  </div>',
      '  <hr class="np-column-rule">',
      '  <div class="np-body" style="font-size:0.86rem;">',
      n.gospelAccess ? '    <p><strong>Gospel Access:</strong> ' + esc(n.gospelAccess) + '</p>' : '',
      n.unreachedGroups ? '    <p><strong>Unreached People Groups:</strong> ' + esc(n.unreachedGroups) + '</p>' : '',
      '  </div>',
      n.jpProfileUrl
        ? '  <p class="np-body" style="margin-top:12px;font-size:0.82rem;"><a href="' + esc(n.jpProfileUrl) + '" target="_blank" rel="noopener" style="color:var(--sec-commission)">Joshua Project \u2192</a></p>'
        : '',
      '</div>',
    ].filter(Boolean).join('\n');
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function buildBanner(churchName) {
    return [
      '<div class="np-banner" style="border-bottom-color:var(--sec-commission)">',
      '  <p class="np-banner__flag" style="color:var(--sec-commission)">',
      '    The Flock Herald &mdash; The Mission',
      '  </p>',
      '  <h2 class="np-banner__headline">' + esc(churchName) + '</h2>',
      '  <p class="np-banner__deck">Praying for the nations &mdash; every tribe, tongue, and people.</p>',
      '</div>',
    ].join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : 'The Mission';
    var wk   = weekNumber(new Date());
    var data = loadData();

    main.innerHTML = [
      '<div class="np-broadsheet">',
      buildBanner(churchName),
      '<div class="np-cols">',
      buildProfileCol(data.nation, wk),
      buildPrayerCol(data.nation),
      buildVideoCol(data.nation, data.video),
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
