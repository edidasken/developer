/* ══════════════════════════════════════════════════════════════════════════════
   THE WAY — FlockOS Learning Hub
   Consolidated learning & growth portal: courses, quizzes, reading plans,
   theology, lexicon, apologetics, counseling, devotionals, certificates,
   and analytics — all in one rich dashboard.

   Depends on: Modules (the_tabernacle.js), TheVine (the_true_vine.js),
               Nehemiah (firm_foundation.js), Adornment (fine_linen.js)

   "I am the way, the truth, and the life." — John 14:6
   ══════════════════════════════════════════════════════════════════════════════ */


  // ── HTML-escape ─────────────────────────────────────────────────────────
  function _e(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(s)));
    return d.innerHTML;
  }

  function _spinner() {
    return '<div class="spin" style="text-align:center;padding:60px 20px;color:var(--ink-muted);">'
         + '<div style="margin:0 auto 16px;width:32px;height:32px;border:3px solid var(--line);'
         + 'border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite;"></div>'
         + 'Loading\u2026</div>';
  }

  function _isFB() { return typeof UpperRoom !== 'undefined' && UpperRoom.isReady(); }

  // ── Timeout guard — prevents hanging fetches from causing perma-spin ──
  var _FETCH_TIMEOUT = 15000;
  function _withTimeout(promise, ms) {
    if (!ms) ms = _FETCH_TIMEOUT;
    return Promise.race([
      promise,
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('Request timed out')); }, ms);
      })
    ]);
  }

  function _errHtml(msg) {
    return '<div style="padding:24px;text-align:center;color:var(--danger);">'
         + '<p style="font-size:1rem;font-weight:600;">Error</p>'
         + '<p style="font-size:0.85rem;">' + _e(msg) + '</p></div>';
  }

  function _empty(icon, title, desc) {
    return '<div style="text-align:center;padding:60px 20px;color:var(--ink-muted);">'
         + '<div style="font-size:2.5rem;margin-bottom:12px;">' + icon + '</div>'
         + '<h2 style="font-size:1.1rem;margin-bottom:6px;color:var(--ink);">' + _e(title) + '</h2>'
         + '<p style="font-size:0.85rem;">' + _e(desc) + '</p></div>';
  }

  function _badge(text, cls) {
    return '<span class="badge badge-' + (cls || 'info') + '">' + _e(text) + '</span>';
  }

  function _toast(msg, type) {
    if (typeof Modules !== 'undefined' && Modules._toast) { Modules._toast(msg, type); return; }
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;'
      + 'border-radius:8px;font-size:0.88rem;z-index:9999;color:#fff;'
      + 'background:' + (type === 'success' ? 'var(--success)' : type === 'danger' ? 'var(--danger)' : 'var(--accent)') + ';';
    document.body.appendChild(d);
    setTimeout(function() { d.remove(); }, 3000);
  }

  function _bibleLink(ref) {
    if (typeof Modules !== 'undefined' && Modules._bibleLink) return Modules._bibleLink(ref);
    return _e(ref);
  }

  function _rows(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.rows)) return res.rows;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.results)) return res.results;
    if (Array.isArray(res.items)) return res.items;
    return [];
  }

  // ── Local data cache ────────────────────────────────────────────────────
  var _cache = {};
  var _activeTab = 'dashboard';
  var _hubElement = null;
  var _session = null;

  // ── Silent diagnostic logger (localStorage) ────────────────────────────
  function _logDiagnostic(type, data) {
    try {
      var s = _getSession();
      if (!s || !s.email) return; // only log for authenticated users
      var key = 'flock_diag_' + type;
      var entry = { email: s.email, date: new Date().toISOString() };
      for (var k in data) { if (data.hasOwnProperty(k)) entry[k] = data[k]; }
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (_) {}
  }

  function _hubEl() { return _hubElement || document.getElementById('view-learning'); }
  function _hubBody(html) {
    var el = _hubEl();
    if (!el) return;
    var b = el.querySelector('#tw-body');
    if (b) b.innerHTML = html;
    else el.innerHTML = html;
  }

  // ── Session helper ──────────────────────────────────────────────────────
  function _getSession() {
    if (_session) return _session;
    if (typeof Nehemiah !== 'undefined' && Nehemiah.getSession) return Nehemiah.getSession();
    return {};
  }

  function _isAdmin() {
    var s = _getSession();
    if (s && (s.role === 'admin' || s.role === 'superadmin' || (s.roleLevel != null && s.roleLevel >= 2))) return true;
    if (typeof Nehemiah !== 'undefined' && (Nehemiah.hasGroup('Master') || Nehemiah.hasGroup('Seed Admin') || Nehemiah.hasGroup('Lead Pastor'))) return true;
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SVG CHART HELPERS (no external libs)
  // ══════════════════════════════════════════════════════════════════════════

  function _svgLine(data, w, h, color) {
    if (!data || !data.length) return '<svg width="' + w + '" height="' + h + '"></svg>';
    var max = Math.max.apply(null, data) || 1;
    var pts = data.map(function(v, i) {
      var x = (i / Math.max(data.length - 1, 1)) * (w - 8) + 4;
      var y = h - 4 - ((v / max) * (h - 8));
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    return '<svg width="' + w + '" height="' + h + '" style="display:block;">'
         + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
         + '</svg>';
  }

  function _svgBar(data, labels, w, h, color) {
    if (!data || !data.length) return '';
    var max = Math.max.apply(null, data) || 1;
    var barW = Math.max(12, Math.floor((w - 20) / data.length) - 4);
    var svg = '<svg width="' + w + '" height="' + (h + 24) + '" style="display:block;">';
    data.forEach(function(v, i) {
      var bh = (v / max) * (h - 8);
      var x = 10 + i * (barW + 4);
      var y = h - bh;
      svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + bh
           + '" rx="3" fill="' + color + '" opacity="0.8"/>';
      if (labels && labels[i]) {
        svg += '<text x="' + (x + barW / 2) + '" y="' + (h + 14) + '" text-anchor="middle" '
             + 'font-size="9" fill="var(--ink-muted)">' + _e(labels[i]) + '</text>';
      }
    });
    svg += '</svg>';
    return svg;
  }

  function _svgDonut(segments, size) {
    // segments: [{value, color, label}]
    var r = (size || 80) / 2 - 4;
    var cx = (size || 80) / 2;
    var total = segments.reduce(function(s, d) { return s + (d.value || 0); }, 0) || 1;
    var svg = '<svg width="' + (size || 80) + '" height="' + (size || 80) + '" style="display:block;">';
    var angle = -90;
    segments.forEach(function(seg) {
      var pct = (seg.value || 0) / total;
      var sweep = pct * 360;
      if (sweep < 0.5) return;
      var startRad = angle * Math.PI / 180;
      var endRad = (angle + sweep) * Math.PI / 180;
      var x1 = cx + r * Math.cos(startRad);
      var y1 = cx + r * Math.sin(startRad);
      var x2 = cx + r * Math.cos(endRad);
      var y2 = cx + r * Math.sin(endRad);
      var large = sweep > 180 ? 1 : 0;
      svg += '<path d="M ' + cx + ' ' + cx + ' L ' + x1.toFixed(2) + ' ' + y1.toFixed(2)
           + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2)
           + ' Z" fill="' + seg.color + '" opacity="0.85"/>';
      angle += sweep;
    });
    // Center hole
    svg += '<circle cx="' + cx + '" cy="' + cx + '" r="' + (r * 0.55) + '" fill="var(--bg-raised)"/>';
    svg += '</svg>';
    return svg;
  }

  function _svgSparkline(data, w, h) {
    return _svgLine(data, w || 80, h || 24, 'var(--accent)');
  }

  function _svgHeatmap(data, weeks, cellSize) {
    // data: array of { date:'YYYY-MM-DD', value:N }
    cellSize = cellSize || 12;
    var gap = 2;
    var map = {};
    (data || []).forEach(function(d) { map[d.date] = d.value; });
    var today = new Date();
    var numWeeks = weeks || 26;
    var totalDays = numWeeks * 7;
    var w = numWeeks * (cellSize + gap) + 20;
    var h = 7 * (cellSize + gap) + 20;
    var svg = '<svg width="' + w + '" height="' + h + '" style="display:block;">';
    var dayLabels = ['', 'M', '', 'W', '', 'F', ''];
    dayLabels.forEach(function(lbl, di) {
      if (lbl) {
        svg += '<text x="0" y="' + (di * (cellSize + gap) + cellSize + 6) + '" font-size="9" fill="var(--ink-faint)">' + lbl + '</text>';
      }
    });
    for (var d = totalDays - 1; d >= 0; d--) {
      var date = new Date(today);
      date.setDate(date.getDate() - d);
      var key = date.toISOString().slice(0, 10);
      var val = map[key] || 0;
      var col = d < 0 ? 0 : Math.min(4, val);
      var colors = ['var(--bg-sunken)', 'rgba(74,222,128,0.25)', 'rgba(74,222,128,0.45)', 'rgba(74,222,128,0.7)', 'rgba(74,222,128,0.95)'];
      var weekIdx = Math.floor((totalDays - 1 - d) / 7);
      var dayIdx = date.getDay();
      var x = 16 + weekIdx * (cellSize + gap);
      var y = dayIdx * (cellSize + gap) + 6;
      svg += '<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize
           + '" rx="2" fill="' + colors[col] + '" title="' + _e(key) + ': ' + val + '"/>';
    }
    svg += '</svg>';
    return svg;
  }

  // ── Progress bar helper ─────────────────────────────────────────────────
  function _progressBar(pct, color) {
    var p = Math.min(100, Math.max(0, pct || 0));
    return '<div style="height:6px;background:var(--bg-sunken);border-radius:3px;overflow:hidden;">'
         + '<div style="height:100%;width:' + p + '%;background:' + (color || 'var(--accent)')
         + ';border-radius:3px;transition:width 0.3s;"></div></div>';
  }

  // ── Card/panel helpers ──────────────────────────────────────────────────
  function _card(content, style) {
    return '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;'
         + 'padding:16px;' + (style || '') + '">' + content + '</div>';
  }

  function _kpi(label, value, icon, sub) {
    return '<div style="text-align:center;padding:12px 8px;">'
         + '<div style="font-size:1.4rem;margin-bottom:2px;">' + (icon || '') + '</div>'
         + '<div style="font-size:1.5rem;font-weight:700;color:var(--accent);">' + _e(String(value)) + '</div>'
         + '<div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px;">' + _e(label) + '</div>'
         + (sub ? '<div style="font-size:0.68rem;color:var(--ink-faint);margin-top:1px;">' + sub + '</div>' : '')
         + '</div>';
  }

  function _actionBtn(label, onclick) {
    return '<button onclick="' + _e(onclick) + '" '
         + 'style="padding:7px 16px;border:1px solid var(--line);border-radius:6px;'
         + 'background:var(--bg-raised);color:var(--accent);font-size:0.8rem;'
         + 'cursor:pointer;font-family:inherit;transition:all 0.15s;"'
         + ' onmouseover="this.style.background=\'var(--accent)\';this.style.color=\'var(--ink-inverse)\'"'
         + ' onmouseout="this.style.background=\'var(--bg-raised)\';this.style.color=\'var(--accent)\'"'
         + '>' + label + '</button>';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB SYSTEM
  // ══════════════════════════════════════════════════════════════════════════

  var _tabs = [
    { id: 'dashboard',   label: 'Dashboard',    icon: '\u2302' },
    { id: 'courses',     label: 'Courses',       icon: '\uD83D\uDCDA' },
    { id: 'quizzes',     label: 'Quizzes',       icon: '\u2753' },
    { id: 'reading',     label: 'Reading Plans', icon: '\uD83D\uDCD6' },
    { id: 'theology',    label: 'Theology',      icon: '\u2638' },
    { id: 'lexicon',     label: 'Lexicon',       icon: '\u0391' },
    { id: 'library',     label: 'The Word',      icon: '\u271D' },
    { id: 'devotionals', label: 'Devotionals',   icon: '\u2601' },
    { id: 'apologetics', label: 'Apologetics',   icon: '\u2696' },
    { id: 'psalms',      label: 'Psalms',        icon: '\uD83C\uDFB5' },
    { id: 'counseling',  label: 'Counseling',    icon: '\uD83D\uDC9A' },
    { id: 'heart',       label: 'Heart Check',   icon: '\u2764' },
    { id: 'genealogy',   label: 'Genealogy',     icon: '\uD83D\uDC65' },
    { id: 'journal',     label: 'Journal',       icon: '\uD83D\uDCDD' },
    { id: 'analytics',   label: 'Analytics',     icon: '\uD83D\uDCCA' },
    { id: 'certificates',label: 'Certificates',  icon: '\uD83C\uDF93' },
  ];

  function _renderTabs() {
    // Simple back button for in-hub sub-pages (courses, analytics, certificates)
    var html = '<div style="padding:0 0 12px;border-bottom:1px solid var(--line);margin-bottom:16px;position:sticky;top:48px;z-index:90;background:var(--bg);">';
    html += '<button onclick="TheWay.switchTab(\'dashboard\')" '
          + 'style="padding:8px 16px;border:1px solid var(--line);border-radius:8px;cursor:pointer;'
          + 'font-size:0.85rem;font-family:inherit;background:var(--bg-raised);'
          + 'color:var(--accent);font-weight:600;transition:all 0.15s;" '
          + 'onmouseover="this.style.background=\'var(--accent)\';this.style.color=\'var(--ink-inverse)\'" '
          + 'onmouseout="this.style.background=\'var(--bg-raised)\';this.style.color=\'var(--accent)\'"'
          + '>\u2190 Learning Hub</button>';
    html += '</div>';
    return html;
  }

  export function switchTab(tabId) {
    if (_quizTimer) { clearInterval(_quizTimer); _quizTimer = null; }
    _activeTab = tabId;
    var el = _hubEl();
    if (!el) return;
    var body = el.querySelector('#tw-panels');
    if (body) body.innerHTML = _spinner();
    // Show tab bar on sub-pages, hide on dashboard
    var tabBar = el.querySelector('#tw-tabs');
    if (tabBar) {
      if (tabId === 'dashboard') {
        tabBar.style.display = 'none';
      } else {
        tabBar.style.display = '';
        tabBar.innerHTML = _renderTabs();
      }
    }
    // Render active panel
    _renderPanel(tabId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN HUB RENDERER
  // ══════════════════════════════════════════════════════════════════════════

  export async function renderHub(el, session) {
    _hubElement = el;
    _session = session || _getSession();

    // Ensure Firebase auth is ready so _isFB() routes to Firestore content
    // Skip for unauthenticated users — UpperRoom requires a session
    var hasSession = _session && (_session.email || _session.token);
    if (hasSession && typeof UpperRoom !== 'undefined' && !UpperRoom.isReady()) {
      try {
        await _withTimeout(UpperRoom.init(), 8000);
        await _withTimeout(UpperRoom.authenticate(), 8000);
      } catch (_) {}
    }

    el.innerHTML = '<div style="max-width:1200px;margin:0 auto;">'
      + '<div id="tw-tabs" style="' + (_activeTab === 'dashboard' ? 'display:none;' : '') + '">' + _renderTabs() + '</div>'
      + '<div id="tw-panels">' + _spinner() + '</div>'
      + '<div id="tw-body"></div>'
      + '</div>';

    // Load initial data — await so the module view cache can capture rendered content
    await _renderPanel(_activeTab);
  }

  export function refresh() {
    _cache = {};
    var el = _hubEl();
    if (el) renderHub(el, _session);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PANEL ROUTER
  // ══════════════════════════════════════════════════════════════════════════

  function _renderPanel(tabId) {
    switch (tabId) {
      case 'dashboard':    return _renderDashboard();
      case 'courses':      return _renderCourses();
      case 'quizzes':      return _renderQuizzes();
      case 'reading':      return _renderReadingPlans();
      case 'theology':     return _renderTheology();
      case 'lexicon':      return _renderLexicon();
      case 'library':      return _renderLibrary();
      case 'devotionals':  return _renderDevotionals();
      case 'apologetics':  return _renderApologetics();
      case 'psalms':       return _renderPsalms();
      case 'counseling':   return _renderCounseling();
      case 'heart':        return _renderHeart();
      case 'genealogy':    return _renderGenealogy();
      case 'journal':      return _renderJournal();
      case 'analytics':    return _renderAnalytics();
      case 'certificates': return _renderCertificates();
      default:             return _renderDashboard();
    }
  }

  function _panel(html) {
    var el = _hubEl();
    if (!el) return;
    var p = el.querySelector('#tw-panels');
    if (p) p.innerHTML = html;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. DASHBOARD — Welcome hero + launch cards + quick-resume
  // ══════════════════════════════════════════════════════════════════════════

  // Card definitions for the launch grid
  // nav: module name for navigate() — opens as full page
  // (cards without nav stay in-hub via switchTab)
  // zone: Tabernacle grouping for visual organization
  var _launchCards = [
    { id: 'courses',     icon: '\uD83D\uDCDA', title: 'Courses',        desc: 'Structured playlists &amp; guided studies',             zone: 'gates' },
    { id: 'reading',     icon: '\uD83D\uDCD6', title: 'Reading Plans',  desc: 'Through the Bible in a year',             nav: 'reading',      zone: 'gates' },
    { id: 'devotionals', icon: '\u2601',        title: 'Devotionals',    desc: 'Scripture, reflection &amp; prayer',      nav: 'devotionals',  zone: 'gates' },
    { id: 'quizzes',     icon: '\uD83D\uDCDD', title: 'Bible Quiz',     desc: 'Test your knowledge of Scripture',        nav: 'quiz',         zone: 'gates' },
    { id: 'library',     icon: '\u271D',        title: 'The Word',       desc: '66 Books of the Bible',                   nav: 'library',      zone: 'courts' },
    { id: 'theology',    icon: '\u2638',        title: 'Theology',       desc: 'Core beliefs &amp; systematic doctrine',  nav: 'theology',     zone: 'courts' },
    { id: 'lexicon',     icon: '\u0391',        title: 'Lexicon',        desc: 'Greek &amp; Hebrew word study',           nav: 'words',        zone: 'courts' },
    { id: 'apologetics', icon: '\u2696',        title: 'Apologetics',    desc: 'Defend the faith with confidence',        nav: 'apologetics',  zone: 'courts' },
    { id: 'psalms',      icon: '\uD83C\uDFB5', title: 'Psalms',         desc: 'Browse all 150 psalms by theme or number', nav: 'psalms',        zone: 'courts' },
    { id: 'heart',       icon: '\u2764',        title: 'Heart Check',    desc: 'Spiritual health self-assessment',        nav: 'heart',        zone: 'holy' },
    { id: 'journal',     icon: '\uD83D\uDCDD', title: 'Journal',        desc: 'Personal reflections &amp; devotion notes', nav: 'journal',    zone: 'holy' },
    { id: 'counseling',  icon: '\u2695',        title: 'Counseling',     desc: 'Biblical guidance &amp; pastoral help',   nav: 'counseling',   zone: 'holy' },
    { id: 'genealogy',   icon: '\uD83D\uDC65', title: 'Genealogy',      desc: 'Biblical family trees &amp; lineages',    nav: 'genealogy',    zone: 'holy' },
    { id: 'analytics',   icon: '\uD83D\uDCCA', title: 'Analytics',      desc: 'Track your learning progress',                                 zone: 'holies' },
    { id: 'certificates',icon: '\uD83C\uDF93', title: 'Certificates',   desc: 'Earned achievements &amp; completion',                         zone: 'holies' },
    { id: 'prayerful-action', icon: '\uD83D\uDE4F', title: 'Prayerful Action', desc: 'Necessity, power &amp; application of prayer', href: 'prayerful_action.html', zone: 'scrolls' },
    { id: 'worship', icon: '\uD83D\uDE4C', title: 'Anatomy of Worship', desc: 'Exegetical analysis of worship in spirit &amp; truth', href: 'the_anatomy_of_worship.html', zone: 'scrolls' },
    { id: 'weavers-plan', icon: '\uD83E\uDDF5', title: "The Weaver's Plan", desc: 'The Story of Joseph &mdash; Genesis 37&ndash;50', href: 'the_weavers_plan.html', zone: 'scrolls' },
    { id: 'gift-drift', icon: '\uD83C\uDF81', title: 'The Gift Drift', desc: 'Correcting modern drift on spiritual gifts &mdash; charismata', href: 'the_gift_drift.html', zone: 'scrolls' },
  ];

  var _zones = [
    { id: 'gates',   label: 'The Gates',          glyph: '' },
    { id: 'courts',  label: 'The Courts',         glyph: '\u2726' },
    { id: 'holy',    label: 'The Holy Place',     glyph: '\u2726 \u2726' },
    { id: 'holies',  label: 'The Holy of Holies', glyph: '\u2726 \u2726 \u2726' },
    { id: 'scrolls', label: 'The Scrolls',        glyph: '\u00B7' },
  ];

  async function _renderDashboard() {
    _panel(_spinner());
    try {
      var fetches = [
        _withTimeout(_fetchStats()),
        _withTimeout(_fetchProgress({ status: 'In Progress' })),
        _withTimeout(_fetchCertificates()),
        _withTimeout(_fetchQuizResults()),
      ];
      var results = await Promise.allSettled(fetches);
      var stats  = results[0].status === 'fulfilled' ? results[0].value : {};
      var active = results[1].status === 'fulfilled' ? _rows(results[1].value) : [];
      var certs  = results[2].status === 'fulfilled' ? _rows(results[2].value) : [];
      var qr     = results[3].status === 'fulfilled' ? _rows(results[3].value) : [];

      _cache.stats = stats;
      _cache.activeProgress = active;
      _cache.certificates = certs;
      _cache.quizResults = qr;

      var avgScore = 0;
      if (qr.length) {
        var total = qr.reduce(function(s, r) { return s + (r.scorePercent || 0); }, 0);
        avgScore = Math.round(total / qr.length);
      }
      var streak = _calcStreak(active);

      var html = '';

      // ── Welcome Hero ────────────────────────────────────────────────
      html += '<div style="text-align:center;padding:32px 20px 24px;">'
            + '<h1 style="color:var(--accent);font-weight:700;margin:0 0 8px;font-size:1.8rem;">Learning Hub</h1>'
            + '<div style="color:var(--gold,#d4b870);font-style:italic;margin-bottom:6px;">'
            + '\u201CAll Scripture is breathed out by God and profitable for teaching.\u201D</div>'
            + '<div style="color:var(--ink-muted);margin-bottom:8px;">2 Timothy 3:16</div>'
            + '</div>';

      // ── KPI Ribbon (compact, below hero) ────────────────────────────
      html += '<div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;margin-bottom:24px;">';
      var kpis = [
        [stats.completed || 0, 'Completed'],
        [streak + 'd', 'Streak'],
        [Math.round((stats.totalMinutes || 0) / 60) + 'h', 'Learned'],
        [certs.length, 'Certificates'],
        [avgScore + '%', 'Quiz Avg'],
      ];
      kpis.forEach(function(k) {
        html += '<div style="text-align:center;min-width:70px;">'
              + '<div style="font-size:1.3rem;font-weight:700;color:var(--accent);">' + k[0] + '</div>'
              + '<div style="font-size:0.7rem;color:var(--ink-muted);">' + k[1] + '</div>'
              + '</div>';
      });
      html += '</div>';

      // ── Launch Card Grid (grouped by Tabernacle zones) ──────────────────
      _zones.forEach(function(z) {
        var zoneCards = _launchCards.filter(function(c) { return c.zone === z.id; });
        if (!zoneCards.length) return;

        // Threshold divider (skip before first zone)
        if (z.glyph) {
          html += '<div class="dash-threshold" style="max-width:900px;margin-left:auto;margin-right:auto;">'
                + '<span class="dash-threshold-glyph">' + z.glyph + '</span></div>';
        }

        html += '<div class="dash-zone-label" style="max-width:900px;margin-left:auto;margin-right:auto;">' + z.label + '</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));'
              + 'gap:16px;max-width:900px;margin:0 auto 4px;">';
        zoneCards.forEach(function(c) {
          var action;
          if (c.href) {
            var base = window.location.pathname.indexOf('/Pages/') !== -1 ? '' : 'FlockOS/Pages/';
            var fromPage = window.location.pathname.indexOf('index.html') !== -1 || window.location.pathname.match(/\/FlockOS\/?$/) ? 'public' : 'admin';
            action = 'window.location.href=\'' + base + c.href + '?from=' + fromPage + '\'';
          } else {
            action = c.nav
              ? 'navigate(\'' + c.nav + '\')'
              : 'TheWay.switchTab(\'' + c.id + '\')';
          }
          html += '<div onclick="' + action + '" '
                + 'style="background:linear-gradient(135deg,var(--accent-soft,rgba(126,170,204,0.08)),var(--gold-soft,rgba(212,184,112,0.06)));'
                + 'border:1px solid var(--gold,#d4b870);border-radius:var(--radius-md,10px);'
                + 'padding:20px;cursor:pointer;transition:all 0.2s;text-align:center;" '
                + 'onmouseover="this.style.borderColor=\'var(--accent)\';this.style.transform=\'translateY(-2px)\'" '
                + 'onmouseout="this.style.borderColor=\'var(--gold,#d4b870)\';this.style.transform=\'none\'">'
                + '<div style="font-size:1.6rem;margin-bottom:8px;">' + c.icon + '</div>'
                + '<div style="font-weight:600;color:var(--ink);margin-bottom:4px;">' + c.title + '</div>'
                + '<div style="color:var(--ink-muted);font-size:0.8rem;line-height:1.4;">' + c.desc + '</div>'
                + '</div>';
        });
        html += '</div>';
      });

      // ── Continue Learning (if any in-progress) ──────────────────────
      if (active.length) {
        html += '<div style="max-width:900px;margin:0 auto 20px;">';
        html += _card(
          '<h3 style="font-size:0.95rem;margin:0 0 12px;color:var(--ink);">\uD83D\uDCDA Continue Learning</h3>'
          + active.slice(0, 5).map(function(p) {
              return '<div style="padding:8px 0;border-bottom:1px solid var(--line);cursor:pointer;" '
                   + 'onclick="TheWay.openCourse(\'' + _e(p.playlistId || '') + '\')">'
                   + '<div style="display:flex;justify-content:space-between;align-items:center;">'
                   + '<span style="font-weight:600;">' + _e(p.playlistTitle || p.sermonTitle || 'Untitled') + '</span>'
                   + '<span style="font-size:0.75rem;color:var(--accent);font-weight:700;">' + (p.progressPercent || 0) + '%</span>'
                   + '</div>'
                   + _progressBar(p.progressPercent)
                   + '</div>';
            }).join('')
        );
        html += '</div>';
      }

      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message || 'Failed to load dashboard'));
    }
  }

  function _calcStreak(progressItems) {
    if (!progressItems || !progressItems.length) return 0;
    var dates = {};
    progressItems.forEach(function(p) {
      var d = (p.lastListenedAt || p.updatedAt || p.createdAt || '').slice(0, 10);
      if (d) dates[d] = true;
    });
    var streak = 0;
    var today = new Date();
    for (var i = 0; i < 365; i++) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      var key = d.toISOString().slice(0, 10);
      if (dates[key]) streak++;
      else if (i > 0) break; // allow today to be missing
    }
    return streak;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. COURSE CATALOG — Filterable/searchable grid
  // ══════════════════════════════════════════════════════════════════════════

  var _courseFilter = { search: '', category: '', difficulty: '' };

  async function _renderCourses() {
    _panel(_spinner());
    try {
      if (!_cache.playlists) {
        var res = await _withTimeout(_isFB() ? UpperRoom.listLrnPlaylists({ status: 'Active' }) : TheVine.flock.call('learning.playlists.list', { status: 'Active' }, { skipAuth: true }));
        _cache.playlists = _rows(res);
      }
      if (!_cache.topics) {
        var tres = await _withTimeout(_isFB() ? UpperRoom.listLrnTopics({ status: 'Active' }) : TheVine.flock.call('learning.topics.list', { status: 'Active' }, { skipAuth: true }));
        _cache.topics = _rows(tres);
      }
      var s = _getSession();
      if (!_cache.userProgress) {
        _cache.userProgress = (s && s.email) ? _rows(await _withTimeout(_fetchProgress({}))) : [];
      }

      _renderCourseGrid();
    } catch (e) {
      _panel(_errHtml(e.message || 'Failed to load courses'));
    }
  }

  function _renderCourseGrid() {
    var playlists = _cache.playlists || [];
    var progress = _cache.userProgress || [];
    var search = (_courseFilter.search || '').toLowerCase();
    var catFilter = _courseFilter.category || '';
    var diffFilter = _courseFilter.difficulty || '';

    // Build progress map
    var progMap = {};
    progress.forEach(function(p) {
      if (p.playlistId) {
        if (!progMap[p.playlistId]) progMap[p.playlistId] = { completed: 0, total: 0, pct: 0 };
        progMap[p.playlistId].total++;
        if (p.status === 'Completed') progMap[p.playlistId].completed++;
      }
    });
    Object.keys(progMap).forEach(function(k) {
      var pg = progMap[k];
      pg.pct = pg.total ? Math.round(pg.completed / pg.total * 100) : 0;
    });

    var filtered = playlists.filter(function(p) {
      if (search && (p.title || '').toLowerCase().indexOf(search) === -1
          && (p.description || '').toLowerCase().indexOf(search) === -1
          && (p.topicNames || '').toLowerCase().indexOf(search) === -1) return false;
      if (catFilter && (p.topicNames || '').indexOf(catFilter) === -1) return false;
      if (diffFilter && p.difficultyLevel !== diffFilter) return false;
      return true;
    });

    // Gather unique categories for filter
    var categories = {};
    playlists.forEach(function(p) {
      (p.topicNames || '').split(',').forEach(function(t) {
        t = t.trim();
        if (t) categories[t] = true;
      });
    });

    var html = '';

    // ── Filter bar ────────────────────────────────────────────────────
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">';
    html += '<div style="flex:1;min-width:200px;position:relative;">'
          + '<input type="text" placeholder="Search courses\u2026" value="' + _e(_courseFilter.search) + '" '
          + 'oninput="TheWay._filterCourses(\'search\',this.value)" '
          + 'style="width:100%;padding:8px 12px;border:1px solid var(--line);border-radius:6px;'
          + 'background:var(--bg-raised);color:var(--ink);font-size:max(0.88rem,16px);font-family:inherit;"></div>';

    html += '<select onchange="TheWay._filterCourses(\'category\',this.value)" '
          + 'style="padding:8px 12px;border:1px solid var(--line);border-radius:6px;'
          + 'background:var(--bg-raised);color:var(--ink);font-size:max(0.85rem,16px);font-family:inherit;">'
          + '<option value="">All Categories</option>';
    Object.keys(categories).sort().forEach(function(c) {
      html += '<option value="' + _e(c) + '"' + (catFilter === c ? ' selected' : '') + '>' + _e(c) + '</option>';
    });
    html += '</select>';

    html += '<select onchange="TheWay._filterCourses(\'difficulty\',this.value)" '
          + 'style="padding:8px 12px;border:1px solid var(--line);border-radius:6px;'
          + 'background:var(--bg-raised);color:var(--ink);font-size:max(0.85rem,16px);font-family:inherit;">'
          + '<option value="">All Levels</option>'
          + '<option value="Beginner"' + (diffFilter === 'Beginner' ? ' selected' : '') + '>Beginner</option>'
          + '<option value="Intermediate"' + (diffFilter === 'Intermediate' ? ' selected' : '') + '>Intermediate</option>'
          + '<option value="Advanced"' + (diffFilter === 'Advanced' ? ' selected' : '') + '>Advanced</option>'
          + '</select>';

    if (_isAdmin()) {
      html += '<button onclick="TheWay._newCourse()" '
            + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;'
            + 'padding:8px 16px;font-weight:600;cursor:pointer;font-size:0.83rem;font-family:inherit;">'
            + '+ New Course</button>';
    }
    html += '</div>';

    // ── Course cards ──────────────────────────────────────────────────
    if (!filtered.length) {
      html += _empty('\uD83D\uDCDA', 'No courses found', 'Try adjusting your search or filters.');
      _panel(html);
      return;
    }

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">';
    filtered.forEach(function(p) {
      var prog = progMap[p.id] || { pct: 0 };
      var diffColor = p.difficultyLevel === 'Beginner' ? 'var(--success)' :
                      p.difficultyLevel === 'Intermediate' ? 'var(--warning)' : 'var(--danger)';
      html += '<div onclick="TheWay.openCourse(\'' + _e(p.id) + '\')" '
            + 'style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;'
            + 'padding:16px;cursor:pointer;transition:all 0.2s;" '
            + 'onmouseover="this.style.borderColor=\'var(--accent)\';this.style.transform=\'translateY(-2px)\'" '
            + 'onmouseout="this.style.borderColor=\'var(--line)\';this.style.transform=\'none\'">';
      // Cover image / color strip
      if (p.coverImageUrl) {
        html += '<div style="height:90px;border-radius:6px;margin-bottom:12px;'
              + 'background:url(\'' + _e(p.coverImageUrl) + '\') center/cover no-repeat;'
              + 'background-color:var(--bg-sunken);"></div>';
      } else {
        html += '<div style="height:8px;border-radius:4px;margin-bottom:12px;background:linear-gradient(90deg,'
              + diffColor + ',var(--accent));"></div>';
      }
      html += '<div style="font-weight:700;font-size:0.92rem;margin-bottom:4px;">' + _e(p.title) + '</div>';
      if (p.curatorName) {
        html += '<div style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:6px;">by ' + _e(p.curatorName) + '</div>';
      }
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">';
      if (p.difficultyLevel) {
        html += '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;font-weight:600;'
              + 'background:' + diffColor + ';color:#fff;">' + _e(p.difficultyLevel) + '</span>';
      }
      if (p.estimatedHours) {
        html += '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;'
              + 'background:var(--accent-soft);color:var(--accent);">\u23F0 ' + p.estimatedHours + 'h</span>';
      }
      html += '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;'
            + 'background:var(--lilac-soft);color:var(--lilac);">' + (p.itemCount || 0) + ' lessons</span>';
      if (p.featured === 'TRUE') {
        html += '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;'
              + 'background:var(--gold-soft,rgba(212,184,112,0.12));color:var(--ink);font-weight:600;">\u2605 Featured</span>';
      }
      html += '</div>';
      if (p.tags) {
        html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">';
        p.tags.split(',').forEach(function(t) {
          t = t.trim();
          if (t) html += '<span style="font-size:0.66rem;padding:1px 6px;border-radius:8px;'
                       + 'background:var(--bg-hover);color:var(--ink-muted);">#' + _e(t) + '</span>';
        });
        html += '</div>';
      }
      if (p.description) {
        html += '<div style="font-size:0.78rem;color:var(--ink-muted);margin-bottom:8px;'
              + 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'
              + _e(p.description) + '</div>';
      }
      if (prog.pct > 0) html += _progressBar(prog.pct);
      html += '</div>';
    });
    html += '</div>';

    _panel(html);
  }

  export function _filterCourses(field, val) {
    _courseFilter[field] = val;
    _renderCourseGrid();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. COURSE PLAYER — Step-by-step lesson viewer
  // ══════════════════════════════════════════════════════════════════════════

  var _currentCourse = null;
  var _currentLessonIdx = 0;
  var _courseNotes = [];

  export async function openCourse(playlistId) {
    if (!playlistId) return;
    _panel(_spinner());
    try {
      var res = await _withTimeout(_isFB() ? UpperRoom.getLrnPlaylist({ id: playlistId }) : TheVine.flock.call('learning.playlists.get', { id: playlistId }));
      _currentCourse = (res && !res.error) ? res : null;
      if (!_currentCourse) { _panel(_errHtml('Course not found')); return; }

      // Fetch user's notes for this course
      try {
        var nres = await _withTimeout(_isFB() ? UpperRoom.listLrnNotes({ playlistId: playlistId }) : TheVine.flock.call('learning.notes.list', { playlistId: playlistId }));
        _courseNotes = _rows(nres);
      } catch (_) { _courseNotes = []; }

      _currentLessonIdx = 0;

      // Find first incomplete lesson
      var userProg = (_cache.userProgress || []).filter(function(p) { return p.playlistId === playlistId; });
      var completedSermons = {};
      userProg.forEach(function(p) { if (p.status === 'Completed') completedSermons[p.sermonId] = true; });
      var items = _currentCourse.items || [];
      for (var i = 0; i < items.length; i++) {
        if (!completedSermons[items[i].sermonId]) { _currentLessonIdx = i; break; }
      }

      _renderCoursePlayer();
    } catch (e) {
      _panel(_errHtml(e.message || 'Failed to load course'));
    }
  }

  function _renderCoursePlayer() {
    var c = _currentCourse;
    if (!c) return;
    var items = c.items || [];
    var lesson = items[_currentLessonIdx] || {};
    var totalLessons = items.length;
    var lessonNum = _currentLessonIdx + 1;

    var html = '';

    // ── Back button + course title ────────────────────────────────────
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">';
    html += '<button onclick="TheWay.switchTab(\'courses\')" '
          + 'style="background:none;border:1px solid var(--line);border-radius:6px;'
          + 'padding:6px 14px;cursor:pointer;font-size:0.82rem;color:var(--ink);font-family:inherit;">'
          + '\u2190 Back to Courses</button>';
    html += '<div style="flex:1;">'
          + '<div style="font-weight:700;font-size:1.05rem;">' + _e(c.title) + '</div>'
          + '<div style="font-size:0.75rem;color:var(--ink-muted);">Lesson ' + lessonNum + ' of ' + totalLessons + '</div>'
          + '</div>';
    if (_isAdmin()) {
      html += '<button onclick="TheWay._editCourse(\'' + _e(c.id) + '\')" '
            + 'style="background:none;border:1px solid var(--accent);color:var(--accent);border-radius:6px;'
            + 'padding:6px 12px;cursor:pointer;font-size:0.78rem;font-family:inherit;">'
            + '\u270E Edit Course</button>';
      html += '<button onclick="TheWay._manageLessons()" '
            + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;'
            + 'padding:6px 12px;cursor:pointer;font-size:0.78rem;font-weight:600;font-family:inherit;">'
            + '\u2630 Manage Lessons</button>';
    }
    html += '</div>';

    // ── Progress bar ──────────────────────────────────────────────────
    var pct = totalLessons ? Math.round(lessonNum / totalLessons * 100) : 0;
    html += _progressBar(pct) + '<div style="height:12px;"></div>';

    // ── Course info strip ─────────────────────────────────────────────
    var _hasMeta = c.description || c.topicNames || c.estimatedHours || c.curatorName
                 || c.tags || c.preacherFilter || c.scriptureFilter;
    if (_hasMeta) {
      html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;'
            + 'padding:14px 16px;margin-bottom:14px;">';
      if (c.coverImageUrl) {
        html += '<div style="height:80px;border-radius:6px;margin-bottom:10px;'
              + 'background:url(\'' + _e(c.coverImageUrl) + '\') center/cover no-repeat;'
              + 'background-color:var(--bg-sunken);"></div>';
      }
      if (c.description) {
        html += '<div style="font-size:0.83rem;color:var(--ink);line-height:1.6;margin-bottom:8px;">'
              + _e(c.description) + '</div>';
      }
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">';
      if (c.curatorName) {
        html += '<span style="font-size:0.75rem;color:var(--ink-muted);">Curated by <strong>'
              + _e(c.curatorName) + '</strong></span>';
      }
      if (c.estimatedHours) {
        html += '<span style="font-size:0.72rem;padding:2px 8px;border-radius:10px;'
              + 'background:var(--accent-soft);color:var(--accent);">\u23F0 ' + c.estimatedHours + 'h</span>';
      }
      if (c.topicNames) {
        c.topicNames.split(',').forEach(function(t) {
          t = t.trim();
          if (t) html += '<span style="font-size:0.72rem;padding:2px 8px;border-radius:10px;'
                       + 'background:var(--lilac-soft,#f0ebff);color:var(--lilac,#7c5cbf);">' + _e(t) + '</span>';
        });
      }
      if (c.tags) {
        c.tags.split(',').forEach(function(t) {
          t = t.trim();
          if (t) html += '<span style="font-size:0.72rem;padding:2px 8px;border-radius:10px;'
                       + 'background:var(--bg-hover);color:var(--ink-muted);">#' + _e(t) + '</span>';
        });
      }
      if (c.preacherFilter) {
        html += '<span style="font-size:0.72rem;color:var(--ink-muted);">Preachers: '
              + _e(c.preacherFilter) + '</span>';
      }
      if (c.scriptureFilter) {
        html += '<span style="font-size:0.72rem;color:var(--ink-muted);">Scriptures: '
              + _e(c.scriptureFilter) + '</span>';
      }
      html += '</div></div>';
    }

    // ── Layout: content + sidebar ─────────────────────────────────────
    html += '<div style="display:grid;grid-template-columns:1fr 280px;gap:16px;" class="tw-player-grid">';

    // Left: Lesson content
    html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;padding:20px;">';
    html += '<div style="font-size:0.72rem;color:var(--accent);font-weight:600;margin-bottom:6px;">'
          + (lesson.sectionLabel || 'LESSON ' + lessonNum) + '</div>';
    html += '<h2 style="font-size:1.15rem;margin-bottom:12px;">' + _e(lesson.sermonTitle || 'Lesson') + '</h2>';
    if (lesson.preacherName) {
      html += '<div style="font-size:0.82rem;color:var(--ink-muted);margin-bottom:12px;">by ' + _e(lesson.preacherName) + '</div>';
    }
    if (lesson.scriptureRefs) {
      html += '<div style="margin-bottom:12px;">';
      lesson.scriptureRefs.split(',').forEach(function(ref) {
        ref = ref.trim();
        if (ref) html += '<span style="margin-right:8px;">' + _bibleLink(ref) + '</span>';
      });
      html += '</div>';
    }
    if (lesson.notesForLearner) {
      html += '<div style="background:var(--bg-sunken);border-radius:8px;padding:14px;margin-bottom:16px;'
            + 'font-size:0.85rem;line-height:1.65;color:var(--ink);">'
            + _e(lesson.notesForLearner) + '</div>';
    }
    if (lesson.discussionQuestions) {
      html += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--line);">'
            + '<div style="font-weight:700;font-size:0.82rem;margin-bottom:8px;">Discussion Questions</div>'
            + '<div style="font-size:0.82rem;color:var(--ink-muted);line-height:1.65;">'
            + _e(lesson.discussionQuestions) + '</div></div>';
    }
    // Controls
    html += '<div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">';
    if (_currentLessonIdx > 0) {
      html += '<button onclick="TheWay._prevLesson()" '
            + 'style="background:none;border:1px solid var(--line);border-radius:6px;padding:8px 16px;'
            + 'cursor:pointer;font-size:0.82rem;color:var(--ink);font-family:inherit;">\u2190 Previous</button>';
    }
    html += '<button onclick="TheWay._markComplete()" '
          + 'style="background:var(--success);color:#fff;border:none;border-radius:6px;padding:8px 16px;'
          + 'cursor:pointer;font-size:0.82rem;font-weight:600;font-family:inherit;">\u2713 Mark Complete</button>';
    html += '<button onclick="TheWay._bookmarkLesson()" '
          + 'style="background:none;border:1px solid var(--gold);border-radius:6px;padding:8px 16px;'
          + 'cursor:pointer;font-size:0.82rem;color:var(--gold);font-family:inherit;">\u2606 Bookmark</button>';
    if (_currentLessonIdx < totalLessons - 1) {
      html += '<button onclick="TheWay._nextLesson()" '
            + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;padding:8px 16px;'
            + 'cursor:pointer;font-size:0.82rem;font-weight:600;font-family:inherit;">Next \u2192</button>';
    }
    html += '</div>';
    html += '</div>'; // end content column

    // Right: lesson list + notes sidebar
    html += '<div>';
    // Lesson list
    html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;'
          + 'padding:12px;margin-bottom:12px;max-height:300px;overflow-y:auto;">';
    html += '<div style="font-weight:700;font-size:0.8rem;margin-bottom:8px;">Lessons</div>';
    items.forEach(function(item, idx) {
      var isCurrent = idx === _currentLessonIdx;
      html += '<div onclick="TheWay._goToLesson(' + idx + ')" '
            + 'style="padding:6px 8px;border-radius:6px;cursor:pointer;font-size:0.78rem;margin-bottom:2px;'
            + (isCurrent ? 'background:var(--accent-soft);font-weight:700;' : 'background:transparent;color:var(--ink-muted);')
            + '">' + (idx + 1) + '. ' + _e(item.sermonTitle || 'Lesson ' + (idx + 1))
            + (item.durationMins ? ' <span style="color:var(--ink-faint);font-size:0.7rem;">(' + item.durationMins + 'm)</span>' : '')
            + '</div>';
    });
    html += '</div>';

    // Notes panel
    html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;padding:12px;">';
    html += '<div style="font-weight:700;font-size:0.8rem;margin-bottom:8px;">My Notes</div>';
    html += '<textarea id="tw-note-input" placeholder="Take notes on this lesson\u2026" '
          + 'style="width:100%;min-height:100px;background:var(--bg-sunken);border:1px solid var(--line);'
          + 'border-radius:6px;padding:8px;color:var(--ink);font-size:max(0.82rem,16px);font-family:inherit;resize:vertical;">'
          + '</textarea>';
    html += '<button onclick="TheWay._saveNote()" '
          + 'style="margin-top:6px;background:var(--accent);color:var(--ink-inverse);border:none;border-radius:4px;'
          + 'padding:5px 12px;font-size:0.78rem;cursor:pointer;font-family:inherit;">Save Note</button>';
    // Existing notes
    var lessonNotes = _courseNotes.filter(function(n) { return n.sermonId === (lesson.sermonId || ''); });
    if (lessonNotes.length) {
      html += '<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px;">';
      lessonNotes.forEach(function(n) {
        html += '<div style="font-size:0.78rem;color:var(--ink-muted);margin-bottom:6px;padding:6px;'
              + 'background:var(--bg-sunken);border-radius:4px;">'
              + _e(n.content) + '<br>'
              + '<span style="font-size:0.68rem;color:var(--ink-faint);">' + _e(n.createdAt || '') + '</span>'
              + '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    html += '</div>'; // end sidebar column
    html += '</div>'; // end grid

    // ── Responsive override for mobile ────────────────────────────────
    html += '<style>.tw-player-grid{grid-template-columns:1fr 280px;}@media(max-width:768px){.tw-player-grid{grid-template-columns:1fr!important;}}</style>';

    _panel(html);
  }

  export function _goToLesson(idx) { _currentLessonIdx = idx; _renderCoursePlayer(); }
  export function _prevLesson() { if (_currentLessonIdx > 0) { _currentLessonIdx--; _renderCoursePlayer(); } }
  export function _nextLesson() {
    var items = (_currentCourse && _currentCourse.items) || [];
    if (_currentLessonIdx < items.length - 1) { _currentLessonIdx++; _renderCoursePlayer(); }
  }

  export async function _markComplete() {
    var c = _currentCourse;
    if (!c) return;
    var items = c.items || [];
    var lesson = items[_currentLessonIdx];
    if (!lesson) return;
    try {
      await (_isFB() ? UpperRoom.completeLrnProgress({
        sermonId: lesson.sermonId,
        sermonTitle: lesson.sermonTitle,
        playlistId: c.id,
        playlistTitle: c.title,
      }) : TheVine.flock.call('learning.progress.complete', {
        sermonId: lesson.sermonId,
        sermonTitle: lesson.sermonTitle,
        playlistId: c.id,
        playlistTitle: c.title,
      }));
      _toast('Lesson marked complete!', 'success');

      // Check if whole course is done
      var allDone = true;
      for (var i = 0; i < items.length; i++) {
        if (i !== _currentLessonIdx) {
          var prog = (_cache.userProgress || []).find(function(p) {
            return p.sermonId === items[i].sermonId && p.playlistId === c.id && p.status === 'Completed';
          });
          if (!prog) { allDone = false; break; }
        }
      }
      if (allDone && items.length > 0) {
        _toast('Course completed! Certificate earned! \uD83C\uDF93', 'success');
        // Auto-issue certificate
        if (_isAdmin() || true) { // members can earn certs
          try {
            var s = _getSession();
            await (_isFB() ? UpperRoom.issueLrnCertificate({
              memberId: s.memberId || '',
              memberName: s.displayName || s.email || '',
              certificateType: 'Playlist Completion',
              playlistId: c.id,
              playlistTitle: c.title,
            }) : TheVine.flock.call('learning.certificates.issue', {
              memberId: s.memberId || '',
              memberName: s.displayName || s.email || '',
              certificateType: 'Playlist Completion',
              playlistId: c.id,
              playlistTitle: c.title,
            }));
          } catch (_) { /* non-fatal */ }
        }
      }

      // Advance to next or stay
      _cache.userProgress = null; // invalidate
      if (_currentLessonIdx < items.length - 1) _nextLesson();
      else _renderCoursePlayer();
    } catch (e) {
      _toast(e.message || 'Failed to update progress', 'danger');
    }
  }

  export async function _bookmarkLesson() {
    var c = _currentCourse;
    if (!c) return;
    var lesson = (c.items || [])[_currentLessonIdx];
    if (!lesson) return;
    try {
      await TheVine.flock.call('learning.bookmarks.create', {
        sermonId: lesson.sermonId,
        sermonTitle: lesson.sermonTitle,
        preacherName: lesson.preacherName || '',
      });
      _toast('Bookmarked!', 'success');
    } catch (e) {
      _toast(e.message || 'Bookmark failed', 'danger');
    }
  }

  export async function _saveNote() {
    var c = _currentCourse;
    if (!c) return;
    var lesson = (c.items || [])[_currentLessonIdx];
    if (!lesson) return;
    var input = document.getElementById('tw-note-input');
    var content = input ? input.value.trim() : '';
    if (!content) { _toast('Please enter a note', 'danger'); return; }
    try {
      await (_isFB() ? UpperRoom.createLrnNote({
        sermonId: lesson.sermonId,
        sermonTitle: lesson.sermonTitle,
        playlistId: c.id,
        noteType: 'General',
        content: content,
      }) : TheVine.flock.call('learning.notes.create', {
        sermonId: lesson.sermonId,
        sermonTitle: lesson.sermonTitle,
        playlistId: c.id,
        noteType: 'General',
        content: content,
      }));
      _toast('Note saved!', 'success');
      // Refresh notes
      var nres = await (_isFB() ? UpperRoom.listLrnNotes({ playlistId: c.id }) : TheVine.flock.call('learning.notes.list', { playlistId: c.id }));
      _courseNotes = _rows(nres);
      _renderCoursePlayer();
    } catch (e) {
      _toast(e.message || 'Failed to save note', 'danger');
    }
  }

  export async function _newCourse() {
    var fields = [
      { name: 'title',           label: 'Course Title',                        required: true },
      { name: 'description',     label: 'Description',       type: 'textarea' },
      { name: 'coverImageUrl',   label: 'Cover Image URL' },
      { name: 'difficultyLevel', label: 'Difficulty',         type: 'select',
        options: ['Beginner', 'Intermediate', 'Advanced'] },
      { name: 'estimatedHours',  label: 'Estimated Hours',    type: 'number' },
      { name: 'topicNames',      label: 'Categories (comma-separated)' },
      { name: 'preacherFilter',  label: 'Preacher Filter (comma-separated)' },
      { name: 'scriptureFilter', label: 'Scripture Filter (e.g. John, Romans)' },
      { name: 'tags',            label: 'Tags (comma-separated)' },
      { name: 'featured',        label: 'Featured',           type: 'select',
        options: ['FALSE', 'TRUE'] },
      { name: 'sortOrder',       label: 'Sort Order',         type: 'number' },
      { name: 'visibility',      label: 'Visibility',         type: 'select',
        options: ['Public', 'Private'] },
    ];
    if (typeof Modules !== 'undefined' && Modules._modal) {
      Modules._modal('New Course', fields, async function(data) {
        await (_isFB() ? UpperRoom.createLrnPlaylist(data) : TheVine.flock.call('learning.playlists.create', data));
        _cache.playlists = null;
        _toast('Course created!', 'success');
        _renderCourses();
      });
    }
  }

  export async function _editCourse(id) {
    var c = (_currentCourse && _currentCourse.id === id) ? _currentCourse : null;
    if (!c) {
      try {
        var res = await (_isFB() ? UpperRoom.getLrnPlaylist({ id: id }) : TheVine.flock.call('learning.playlists.get', { id: id }));
        c = (res && !res.error) ? res : null;
      } catch (e) { _toast(e.message || 'Failed to load course', 'danger'); return; }
    }
    if (!c) { _toast('Course not found', 'danger'); return; }
    var fields = [
      { name: 'title',           label: 'Course Title',                       required: true,  value: c.title },
      { name: 'description',     label: 'Description',       type: 'textarea',                 value: c.description },
      { name: 'coverImageUrl',   label: 'Cover Image URL',                                     value: c.coverImageUrl },
      { name: 'difficultyLevel', label: 'Difficulty',         type: 'select',
        options: ['Beginner', 'Intermediate', 'Advanced'],                                      value: c.difficultyLevel },
      { name: 'estimatedHours',  label: 'Estimated Hours',    type: 'number',                  value: c.estimatedHours || 0 },
      { name: 'topicNames',      label: 'Categories (comma-separated)',                        value: c.topicNames },
      { name: 'preacherFilter',  label: 'Preacher Filter',                                     value: c.preacherFilter },
      { name: 'scriptureFilter', label: 'Scripture Filter',                                    value: c.scriptureFilter },
      { name: 'tags',            label: 'Tags (comma-separated)',                              value: c.tags },
      { name: 'featured',        label: 'Featured',           type: 'select',
        options: ['FALSE', 'TRUE'],                                                             value: c.featured },
      { name: 'sortOrder',       label: 'Sort Order',         type: 'number',                  value: c.sortOrder || 0 },
      { name: 'visibility',      label: 'Visibility',         type: 'select',
        options: ['Public', 'Private'],                                                         value: c.visibility },
      { name: 'status',          label: 'Status',             type: 'select',
        options: ['Active', 'Draft', 'Archived'],                                               value: c.status },
    ];
    if (typeof Modules !== 'undefined' && Modules._modal) {
      Modules._modal('Edit Course', fields, async function(data) {
        data.id = id;
        await (_isFB() ? UpperRoom.updateLrnPlaylist(data) : TheVine.flock.call('learning.playlists.update', data));
        _cache.playlists = null;
        try {
          var upd = await (_isFB() ? UpperRoom.getLrnPlaylist({ id: id }) : TheVine.flock.call('learning.playlists.get', { id: id }));
          if (upd && !upd.error) _currentCourse = upd;
        } catch (_) {}
        _toast('Course updated!', 'success');
        _renderCoursePlayer();
      });
    }
  }

  export function _manageLessons() {
    var c = _currentCourse;
    if (!c) return;
    var items = c.items || [];
    var html = '';

    // Header
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">';
    html += '<button onclick="TheWay.openCourse(\'' + _e(c.id) + '\')" '
          + 'style="background:none;border:1px solid var(--line);border-radius:6px;'
          + 'padding:6px 14px;cursor:pointer;font-size:0.82rem;color:var(--ink);font-family:inherit;">'
          + '\u2190 Back to Course</button>';
    html += '<div style="flex:1;font-weight:700;font-size:1rem;">Manage Lessons \u2014 '
          + _e(c.title) + '</div></div>';

    // Lesson list
    html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;'
          + 'padding:16px;margin-bottom:16px;">';
    html += '<div style="font-weight:700;font-size:0.88rem;margin-bottom:12px;">Lessons ('
          + items.length + ')</div>';
    if (!items.length) {
      html += '<div style="color:var(--ink-muted);font-size:0.82rem;">No lessons yet. Use the form below to add the first one.</div>';
    } else {
      items.forEach(function(item, idx) {
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;'
              + 'border:1px solid var(--line);border-radius:8px;margin-bottom:6px;background:var(--bg-sunken);">';
        // Reorder arrows
        html += '<div style="display:flex;flex-direction:column;gap:2px;">';
        html += '<button onclick="TheWay._moveLessonUp(\'' + _e(item.id) + '\')" '
              + 'style="background:none;border:1px solid var(--line);border-radius:3px;'
              + 'padding:1px 6px;cursor:pointer;font-size:0.7rem;color:var(--ink-muted);font-family:inherit;"'
              + (idx === 0 ? ' disabled' : '') + '>\u25B2</button>';
        html += '<button onclick="TheWay._moveLessonDown(\'' + _e(item.id) + '\')" '
              + 'style="background:none;border:1px solid var(--line);border-radius:3px;'
              + 'padding:1px 6px;cursor:pointer;font-size:0.7rem;color:var(--ink-muted);font-family:inherit;"'
              + (idx === items.length - 1 ? ' disabled' : '') + '>\u25BC</button>';
        html += '</div>';
        // Item details
        html += '<div style="flex:1;min-width:0;">';
        html += '<div style="font-weight:600;font-size:0.85rem;">'
              + (idx + 1) + '. ' + _e(item.sermonTitle || 'Untitled') + '</div>';
        if (item.preacherName) {
          html += '<div style="font-size:0.75rem;color:var(--ink-muted);">by ' + _e(item.preacherName) + '</div>';
        }
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px;">';
        if (item.sectionLabel) {
          html += '<span style="font-size:0.68rem;padding:1px 6px;border-radius:8px;'
                + 'background:var(--accent-soft);color:var(--accent);">' + _e(item.sectionLabel) + '</span>';
        }
        if (item.durationMins) {
          html += '<span style="font-size:0.68rem;padding:1px 6px;border-radius:8px;'
                + 'background:var(--bg-hover);color:var(--ink-muted);">\u23F0 ' + item.durationMins + 'm</span>';
        }
        if (item.required === 'TRUE') {
          html += '<span style="font-size:0.68rem;padding:1px 6px;border-radius:8px;'
                + 'background:#d4edda;color:var(--success);">Required</span>';
        }
        if (item.bonus === 'TRUE') {
          html += '<span style="font-size:0.68rem;padding:1px 6px;border-radius:8px;'
                + 'background:var(--gold-soft,rgba(212,184,112,0.12));color:var(--ink);font-weight:600;">Bonus</span>';
        }
        html += '</div></div>';
        // Action buttons
        html += '<div style="display:flex;gap:6px;">';
        html += '<button onclick="TheWay._editLesson(\'' + _e(item.id) + '\')" '
              + 'style="background:none;border:1px solid var(--accent);color:var(--accent);'
              + 'border-radius:5px;padding:4px 10px;font-size:0.76rem;cursor:pointer;font-family:inherit;">Edit</button>';
        html += '<button onclick="TheWay._removeLessonItem(\'' + _e(item.id) + '\')" '
              + 'style="background:none;border:1px solid var(--danger);color:var(--danger);'
              + 'border-radius:5px;padding:4px 10px;font-size:0.76rem;cursor:pointer;font-family:inherit;">Remove</button>';
        html += '</div></div>';
      });
    }
    html += '</div>';

    // Add lesson form
    var inp = 'width:100%;background:var(--bg-sunken);border:1px solid var(--line);border-radius:6px;'
            + 'padding:7px 10px;color:var(--ink);font-size:max(0.82rem,16px);font-family:inherit;'
            + 'margin-bottom:8px;box-sizing:border-box;';
    html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;padding:16px;">';
    html += '<div style="font-weight:700;font-size:0.88rem;margin-bottom:12px;">Add Lesson</div>';
    html += '<input id="tw-al-sermonTitle" placeholder="Sermon / Lesson Title *" style="' + inp + '">';
    html += '<input id="tw-al-sermonId" placeholder="Sermon ID (from Sermons tab, optional)" style="' + inp + '">';
    html += '<input id="tw-al-preacherName" placeholder="Preacher Name" style="' + inp + '">';
    html += '<input id="tw-al-scriptureRefs" placeholder="Scripture Refs (e.g. John 3:16, Romans 1:1)" style="' + inp + '">';
    html += '<input id="tw-al-sectionLabel" placeholder="Section Label (e.g. WEEK 1)" style="' + inp + '">';
    html += '<textarea id="tw-al-notesForLearner" placeholder="Notes for Learner" rows="3" '
          + 'style="' + inp + 'resize:vertical;"></textarea>';
    html += '<textarea id="tw-al-discussionQuestions" placeholder="Discussion Questions" rows="2" '
          + 'style="' + inp + 'resize:vertical;"></textarea>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
    html += '<input id="tw-al-durationMins" type="number" placeholder="Duration (mins)" min="0" '
          + 'style="flex:1;min-width:120px;' + inp + '">';
    html += '<select id="tw-al-required" style="flex:1;min-width:120px;' + inp + '">'
          + '<option value="TRUE">Required</option><option value="FALSE">Optional</option></select>';
    html += '<select id="tw-al-bonus" style="flex:1;min-width:100px;' + inp + '">'
          + '<option value="FALSE">Not Bonus</option><option value="TRUE">Bonus</option></select>';
    html += '</div>';
    html += '<button onclick="TheWay._addLessonSubmit(\'' + _e(c.id) + '\')" '
          + 'style="margin-top:8px;background:var(--accent);color:var(--ink-inverse);border:none;'
          + 'border-radius:6px;padding:8px 20px;font-weight:600;cursor:pointer;font-size:0.85rem;font-family:inherit;">'
          + '+ Add Lesson</button>';
    html += '</div>';

    _panel(html);
  }

  export async function _addLessonSubmit(playlistId) {
    var sermonTitle = ((document.getElementById('tw-al-sermonTitle') || {}).value || '').trim();
    if (!sermonTitle) { _toast('Sermon title is required', 'danger'); return; }
    try {
      await (_isFB() ? UpperRoom.createLrnPlaylistItem({
        playlistId:          playlistId,
        sermonId:            ((document.getElementById('tw-al-sermonId') || {}).value || '').trim(),
        sermonTitle:         sermonTitle,
        preacherName:        ((document.getElementById('tw-al-preacherName') || {}).value || '').trim(),
        scriptureRefs:       ((document.getElementById('tw-al-scriptureRefs') || {}).value || '').trim(),
        sectionLabel:        ((document.getElementById('tw-al-sectionLabel') || {}).value || '').trim(),
        notesForLearner:     ((document.getElementById('tw-al-notesForLearner') || {}).value || '').trim(),
        discussionQuestions: ((document.getElementById('tw-al-discussionQuestions') || {}).value || '').trim(),
        durationMins:        Number((document.getElementById('tw-al-durationMins') || {}).value || 0),
        required:            ((document.getElementById('tw-al-required') || {}).value || 'TRUE'),
        bonus:               ((document.getElementById('tw-al-bonus') || {}).value || 'FALSE'),
        sortOrder:           ((_currentCourse && _currentCourse.items) || []).length + 1,
      }) : TheVine.flock.call('learning.playlistItems.create', {
        playlistId:          playlistId,
        sermonId:            ((document.getElementById('tw-al-sermonId') || {}).value || '').trim(),
        sermonTitle:         sermonTitle,
        preacherName:        ((document.getElementById('tw-al-preacherName') || {}).value || '').trim(),
        scriptureRefs:       ((document.getElementById('tw-al-scriptureRefs') || {}).value || '').trim(),
        sectionLabel:        ((document.getElementById('tw-al-sectionLabel') || {}).value || '').trim(),
        notesForLearner:     ((document.getElementById('tw-al-notesForLearner') || {}).value || '').trim(),
        discussionQuestions: ((document.getElementById('tw-al-discussionQuestions') || {}).value || '').trim(),
        durationMins:        Number((document.getElementById('tw-al-durationMins') || {}).value || 0),
        required:            ((document.getElementById('tw-al-required') || {}).value || 'TRUE'),
        bonus:               ((document.getElementById('tw-al-bonus') || {}).value || 'FALSE'),
        sortOrder:           ((_currentCourse && _currentCourse.items) || []).length + 1,
      }));
      _toast('Lesson added!', 'success');
      var res = await (_isFB() ? UpperRoom.getLrnPlaylist({ id: playlistId }) : TheVine.flock.call('learning.playlists.get', { id: playlistId }));
      if (res && !res.error) _currentCourse = res;
      _manageLessons();
    } catch (e) { _toast(e.message || 'Failed to add lesson', 'danger'); }
  }

  export async function _editLesson(itemId) {
    var c = _currentCourse;
    if (!c) return;
    var item = (c.items || []).find(function(i) { return i.id === itemId; });
    if (!item) return;
    var fields = [
      { name: 'sermonTitle',         label: 'Sermon Title',        required: true,  value: item.sermonTitle },
      { name: 'sermonId',            label: 'Sermon ID',                            value: item.sermonId },
      { name: 'preacherName',        label: 'Preacher Name',                        value: item.preacherName },
      { name: 'scriptureRefs',       label: 'Scripture Refs',                       value: item.scriptureRefs },
      { name: 'sectionLabel',        label: 'Section Label',                        value: item.sectionLabel },
      { name: 'notesForLearner',     label: 'Notes for Learner',   type: 'textarea', value: item.notesForLearner },
      { name: 'discussionQuestions', label: 'Discussion Questions', type: 'textarea', value: item.discussionQuestions },
      { name: 'durationMins',        label: 'Duration (mins)',      type: 'number',  value: item.durationMins || 0 },
      { name: 'required',            label: 'Required',             type: 'select',
        options: ['TRUE', 'FALSE'],                                                   value: item.required },
      { name: 'bonus',               label: 'Bonus',                type: 'select',
        options: ['FALSE', 'TRUE'],                                                   value: item.bonus },
      { name: 'sortOrder',           label: 'Sort Order',           type: 'number',  value: item.sortOrder || 0 },
    ];
    if (typeof Modules !== 'undefined' && Modules._modal) {
      Modules._modal('Edit Lesson', fields, async function(data) {
        data.id = itemId;
        await (_isFB() ? UpperRoom.updateLrnPlaylistItem(data) : TheVine.flock.call('learning.playlistItems.update', data));
        var res = await (_isFB() ? UpperRoom.getLrnPlaylist({ id: c.id }) : TheVine.flock.call('learning.playlists.get', { id: c.id }));
        if (res && !res.error) _currentCourse = res;
        _toast('Lesson updated!', 'success');
        _manageLessons();
      });
    }
  }

  export async function _removeLessonItem(itemId) {
    if (!window.confirm('Remove this lesson from the course?')) return;
    var c = _currentCourse;
    if (!c) return;
    try {
      await (_isFB() ? UpperRoom.deleteLrnPlaylistItem({ id: itemId }) : TheVine.flock.call('learning.playlistItems.delete', { id: itemId }));
      var res = await (_isFB() ? UpperRoom.getLrnPlaylist({ id: c.id }) : TheVine.flock.call('learning.playlists.get', { id: c.id }));
      if (res && !res.error) _currentCourse = res;
      _toast('Lesson removed', 'success');
      _manageLessons();
    } catch (e) { _toast(e.message || 'Failed to remove lesson', 'danger'); }
  }

  export async function _moveLessonUp(itemId) {
    var c = _currentCourse;
    if (!c) return;
    var items = (c.items || []).slice();
    var idx = items.findIndex(function(i) { return i.id === itemId; });
    if (idx <= 0) return;
    var tmp = items[idx]; items[idx] = items[idx - 1]; items[idx - 1] = tmp;
    try {
      await (_isFB() ? UpperRoom.reorderLrnPlaylistItem({
        playlistId: c.id,
        orderedIds: items.map(function(i) { return i.id; }),
      }) : TheVine.flock.call('learning.playlistItems.reorder', {
        playlistId: c.id,
        orderedIds: items.map(function(i) { return i.id; }),
      }));
      var res = await (_isFB() ? UpperRoom.getLrnPlaylist({ id: c.id }) : TheVine.flock.call('learning.playlists.get', { id: c.id }));
      if (res && !res.error) _currentCourse = res;
      _manageLessons();
    } catch (e) { _toast(e.message || 'Failed to reorder', 'danger'); }
  }

  export async function _moveLessonDown(itemId) {
    var c = _currentCourse;
    if (!c) return;
    var items = (c.items || []).slice();
    var idx = items.findIndex(function(i) { return i.id === itemId; });
    if (idx < 0 || idx >= items.length - 1) return;
    var tmp = items[idx]; items[idx] = items[idx + 1]; items[idx + 1] = tmp;
    try {
      await (_isFB() ? UpperRoom.reorderLrnPlaylistItem({
        playlistId: c.id,
        orderedIds: items.map(function(i) { return i.id; }),
      }) : TheVine.flock.call('learning.playlistItems.reorder', {
        playlistId: c.id,
        orderedIds: items.map(function(i) { return i.id; }),
      }));
      var res = await (_isFB() ? UpperRoom.getLrnPlaylist({ id: c.id }) : TheVine.flock.call('learning.playlists.get', { id: c.id }));
      if (res && !res.error) _currentCourse = res;
      _manageLessons();
    } catch (e) { _toast(e.message || 'Failed to reorder', 'danger'); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. BIBLE QUIZ ENGINE
  // ══════════════════════════════════════════════════════════════════════════

  var _quizData = null;
  var _quizTimer = null;
  var _quizStartTime = null;

  async function _renderQuizzes() {
    _panel(_spinner());
    try {
      // App quiz: check live bundle first, fall back to static snapshot.
      var appQuiz = [];
      try {
        var liveQuiz = (typeof TheTruth !== 'undefined') ? TheTruth.liveBundle('quiz') : null;
        if (liveQuiz && liveQuiz.length) {
          appQuiz = liveQuiz;
        } else {
          var qmod = await import('../../Data/quiz.js');
          appQuiz = qmod.default || [];
        }
      } catch (_) {}

      // Course quizzes still come from Firestore (user-authored, not static content)
      var quizzes = [];
      try {
        var res = await _withTimeout(_isFB() ? UpperRoom.listLrnQuizzes({ status: 'Published' }) : TheVine.flock.call('learning.quizzes.list', { status: 'Published' }));
        quizzes = _rows(res);
      } catch (_) {}

      _cache.quizzes = quizzes;
      _cache.appQuiz = appQuiz;

      var html = '';

      // Quiz results / score history
      var qr = _cache.quizResults || [];
      if (qr.length) {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px;">';
        var avgScore = Math.round(qr.reduce(function(s, r) { return s + (r.scorePercent || 0); }, 0) / qr.length);
        var passed = qr.filter(function(r) { return r.passed === 'TRUE'; }).length;
        html += _card(_kpi('Quiz Average', avgScore + '%', '\uD83D\uDCCA'));
        html += _card(_kpi('Quizzes Passed', passed + '/' + qr.length, '\u2713'));
        html += _card(
          '<div style="text-align:center;padding:12px 8px;">'
          + '<div style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:4px;">Score Trend</div>'
          + _svgSparkline(qr.slice(-10).map(function(r) { return r.scorePercent || 0; }), 120, 32)
          + '</div>'
        );
        html += '</div>';
      }

      // App quiz section (the interactive Bible quiz from the_tabernacle.js)
      if (appQuiz.length) {
        html += '<h3 style="font-size:0.92rem;font-weight:700;margin-bottom:10px;">Bible Quiz Challenge</h3>';
        html += _card(
          '<p style="font-size:0.85rem;color:var(--ink-muted);margin-bottom:12px;">'
          + appQuiz.length + ' questions from across the Bible. Test your knowledge!</p>'
          + '<button onclick="TheWay._startAppQuiz()" '
          + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;'
          + 'padding:10px 20px;font-weight:700;cursor:pointer;font-size:0.88rem;font-family:inherit;">'
          + '\u25B6 Start Quiz</button>'
        );
        html += '<div style="height:16px;"></div>';
      }

      // Course-specific quizzes
      if (quizzes.length) {
        html += '<h3 style="font-size:0.92rem;font-weight:700;margin-bottom:10px;">Course Quizzes</h3>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">';
        quizzes.forEach(function(q) {
          var diffColor = q.difficulty === 'Beginner' ? 'var(--success)' :
                          q.difficulty === 'Intermediate' ? 'var(--warning)' : 'var(--danger)';
          html += _card(
            '<div style="font-weight:700;font-size:0.88rem;margin-bottom:4px;">' + _e(q.title) + '</div>'
            + '<div style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:8px;">' + _e(q.description) + '</div>'
            + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">'
            + '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;font-weight:600;'
            + 'background:' + diffColor + ';color:#fff;">' + _e(q.difficulty || 'Beginner') + '</span>'
            + '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;'
            + 'background:var(--accent-soft);color:var(--accent);">' + (q.questionCount || 0) + ' questions</span>'
            + (q.timeLimitMins ? '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;'
            + 'background:var(--peach-soft);color:var(--peach);">\u23F0 ' + q.timeLimitMins + ' min</span>' : '')
            + '</div>'
            + '<button onclick="TheWay._startCourseQuiz(\'' + _e(q.id) + '\')" '
            + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:4px;'
            + 'padding:6px 14px;font-size:0.8rem;cursor:pointer;font-weight:600;font-family:inherit;">'
            + 'Take Quiz</button>'
          );
        });
        html += '</div>';
      }

      if (!quizzes.length && !appQuiz.length) {
        html += _empty('\u2753', 'No quizzes available yet', 'Check back soon for new quiz content.');
      }

      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message || 'Failed to load quizzes'));
    }
  }

  var _twQuizPicked = [];
  var _twQuizIdx = 0;
  var _twQuizAnswers = {};

  export function _startAppQuiz() {
    var questions = _cache.appQuiz || [];
    if (!questions.length) return;
    _quizStartTime = Date.now();
    _quizData = questions;

    // Shuffle and apply admin quiz size setting
    var shuffled = questions.slice().sort(function() { return Math.random() - 0.5; });
    var limit = Number(localStorage.getItem('flock_quiz_size') || 0);
    _twQuizPicked = (limit > 0 && limit < shuffled.length) ? shuffled.slice(0, limit) : shuffled;
    _twQuizIdx = 0;
    _twQuizAnswers = {};
    _renderAppQuizQuestion();

    // Start timer
    if (_quizTimer) clearInterval(_quizTimer);
    _quizTimer = setInterval(function() {
      var elapsed = Math.floor((Date.now() - _quizStartTime) / 1000);
      var m = Math.floor(elapsed / 60);
      var s = elapsed % 60;
      var te = document.getElementById('tw-quiz-timer');
      if (te) te.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    }, 1000);
  }

  function _renderAppQuizQuestion() {
    var total = _twQuizPicked.length;
    var i = _twQuizIdx;
    var q = _twQuizPicked[i];
    if (!q) return;

    var html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">';
    html += '<button onclick="TheWay.switchTab(\'quizzes\')" '
          + 'style="background:none;border:1px solid var(--line);border-radius:6px;'
          + 'padding:6px 14px;cursor:pointer;font-size:0.82rem;color:var(--ink);font-family:inherit;">'
          + '\u2190 Back</button>';
    html += '<div style="flex:1;font-weight:700;font-size:1rem;">Bible Quiz</div>';
    html += '<div id="tw-quiz-timer" style="font-size:0.85rem;color:var(--accent);font-weight:700;">0:00</div>';
    html += '</div>';

    // Progress bar
    var pct = Math.round(((i + 1) / total) * 100);
    html += '<div style="margin-bottom:14px;">'
          + '<div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--ink-muted);margin-bottom:4px;">'
          + '<span>Question ' + (i + 1) + ' of ' + total + '</span>'
          + '<span>' + Object.keys(_twQuizAnswers).length + ' answered</span></div>'
          + '<div style="height:6px;background:var(--bg-sunken);border-radius:3px;overflow:hidden;">'
          + '<div style="width:' + pct + '%;height:100%;background:var(--accent);border-radius:3px;transition:width 0.3s;"></div>'
          + '</div></div>';

    // Question card
    var correct = String(q['Correct Answer'] || q.correctAnswer || '').toLowerCase().trim();
    html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:12px;">';
    html += '<div style="font-weight:700;font-size:0.88rem;margin-bottom:8px;">'
          + (i + 1) + '. ' + _e(q['Question'] || q.question || '') + '</div>';
    var savedAns = _twQuizAnswers[i] || '';
    var opts = ['a', 'b', 'c', 'd'];
    opts.forEach(function(letter) {
      var opt = q['Option ' + letter.toUpperCase()] || q[letter] || q['option_' + letter] || '';
      if (!opt) return;
      html += '<label style="display:block;padding:6px 10px;margin-bottom:4px;border-radius:6px;'
            + 'cursor:pointer;font-size:0.82rem;transition:background 0.15s;'
            + (savedAns === letter ? 'background:var(--bg-sunken);' : '') + '" '
            + 'onmouseover="this.style.background=\'var(--bg-hover)\'" '
            + 'onmouseout="this.style.background=\'' + (savedAns === letter ? 'var(--bg-sunken)' : 'transparent') + '\'">'
            + '<input type="radio" name="q_current" value="' + _e(letter) + '" '
            + (savedAns === letter ? 'checked ' : '')
            + 'data-correct="' + _e(correct) + '" '
            + 'data-question="' + _e(q['Question'] || q.question || '') + '" '
            + 'data-reference="' + _e(q['Reference'] || q.reference || '') + '" '
            + 'data-opt-text="' + _e(opt) + '" '
            + 'onchange="TheWay._twQuizSave(\'' + _e(letter) + '\')" '
            + 'style="margin-right:8px;">'
            + '<strong>' + _e(letter.toUpperCase()) + '.</strong> ' + _e(opt) + '</label>';
    });
    if (q['Reference'] || q.reference) {
      html += '<div style="font-size:0.72rem;color:var(--ink-faint);margin-top:6px;font-style:italic;">'
            + _bibleLink(q['Reference'] || q.reference) + '</div>';
    }
    html += '</div>';

    // Navigation
    html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">';
    if (i > 0) {
      html += '<button type="button" onclick="TheWay._twQuizNav(-1)" '
            + 'style="background:none;border:1px solid var(--line);border-radius:8px;padding:10px 20px;'
            + 'cursor:pointer;font-size:0.85rem;color:var(--ink);font-family:inherit;">\u25C0 Previous</button>';
    } else {
      html += '<div></div>';
    }
    if (i < total - 1) {
      html += '<button type="button" onclick="TheWay._twQuizNav(1)" '
            + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:8px;padding:10px 20px;'
            + 'cursor:pointer;font-weight:700;font-size:0.85rem;font-family:inherit;">Next \u25B6</button>';
    } else {
      html += '<button type="button" onclick="TheWay._scoreQuiz(' + total + ')" '
            + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:8px;padding:10px 20px;'
            + 'cursor:pointer;font-weight:700;font-size:0.85rem;font-family:inherit;">Score Quiz \u2714</button>';
    }
    html += '</div>';

    _panel(html);
  }

  export function _twQuizSave(letter) {
    _twQuizAnswers[_twQuizIdx] = letter;
  }

  export function _twQuizNav(dir) {
    var sel = document.querySelector('input[name="q_current"]:checked');
    if (sel) _twQuizAnswers[_twQuizIdx] = sel.value;
    _twQuizIdx += dir;
    if (_twQuizIdx < 0) _twQuizIdx = 0;
    if (_twQuizIdx >= _twQuizPicked.length) _twQuizIdx = _twQuizPicked.length - 1;
    _renderAppQuizQuestion();
  }

  export function _scoreQuiz(totalQ) {
    if (_quizTimer) { clearInterval(_quizTimer); _quizTimer = null; }
    var elapsed = _quizStartTime ? Math.floor((Date.now() - _quizStartTime) / 1000) : 0;

    var correct = 0;
    var total = _twQuizPicked.length;
    _twQuizPicked.forEach(function(q, i) {
      var answer = _twQuizAnswers[i] || '';
      var correctLetter = String(q['Correct Answer'] || q.correctAnswer || '').toLowerCase().trim();
      if (answer === correctLetter) correct++;
    });

    var pct = total ? Math.round(correct / total * 100) : 0;
    _logDiagnostic('quiz', { title: 'Bible Quiz', correct: correct, total: total, pct: pct });

    var html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">';
    html += '<button onclick="TheWay.switchTab(\'quizzes\')" '
          + 'style="background:none;border:1px solid var(--line);border-radius:6px;padding:6px 14px;'
          + 'cursor:pointer;font-size:0.82rem;color:var(--ink);font-family:inherit;">\u2190 Back</button>';
    html += '<div style="flex:1;font-weight:700;font-size:1rem;">Quiz Results</div>';
    html += '</div>';

    // Score display
    html += '<div style="background:var(--bg-raised);border:2px solid var(--accent);border-radius:10px;'
          + 'padding:20px;margin-bottom:16px;text-align:center;">'
          + '<div style="font-size:2rem;font-weight:700;color:var(--accent);">' + correct + ' / ' + total + '</div>'
          + '<div style="font-size:0.88rem;color:var(--ink-muted);">' + pct + '% correct</div>'
          + '<div style="font-size:0.78rem;color:var(--ink-faint);margin-top:4px;">Time: '
          + Math.floor(elapsed / 60) + ':' + (elapsed % 60 < 10 ? '0' : '') + (elapsed % 60) + '</div></div>';

    // Review each question
    _twQuizPicked.forEach(function(q, i) {
      var answer = _twQuizAnswers[i] || '';
      var correctLetter = String(q['Correct Answer'] || q.correctAnswer || '').toLowerCase().trim();
      var isRight = answer === correctLetter;
      var icon = isRight ? '\u2705' : (answer ? '\u274C' : '\u2B1C');
      var bg = isRight ? 'rgba(34,197,94,0.08)' : (answer ? 'rgba(248,113,113,0.08)' : 'var(--bg-raised)');
      html += '<div style="background:' + bg + ';border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:6px;font-size:0.82rem;">'
            + '<div style="font-weight:600;">' + icon + ' ' + (i + 1) + '. ' + _e(q['Question'] || q.question || '') + '</div>';
      if (!isRight) {
        var correctText = q['Option ' + correctLetter.toUpperCase()] || q[correctLetter] || '';
        html += '<div style="color:var(--success);font-size:0.78rem;margin-top:2px;">Correct: ' + _e(correctText) + '</div>';
      }
      html += '</div>';
    });

    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px;">'
          + '<button type="button" onclick="TheWay._startAppQuiz()" '
          + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:8px;padding:12px 24px;'
          + 'font-weight:700;font-size:0.9rem;cursor:pointer;font-family:inherit;">\u21BB Retake</button></div>';

    _panel(html);
  }

  export async function _startCourseQuiz(quizId) {
    _panel(_spinner());
    try {
      var res = await _withTimeout(_isFB() ? UpperRoom.getLrnQuiz({ id: quizId }) : TheVine.flock.call('learning.quizzes.get', { id: quizId }));
      if (!res || res.error) { _panel(_errHtml('Quiz not found')); return; }
      var quiz = res;
      var allQuestions = [];
      try { allQuestions = JSON.parse(quiz.questionsJson || '[]'); } catch (_) {}
      if (!allQuestions.length) { _panel(_errHtml('Quiz has no questions')); return; }

      // Shuffle and pick up to 12 random questions
      var shuffled = allQuestions.slice().sort(function() { return Math.random() - 0.5; });
      var questions = shuffled.slice(0, Math.min(12, shuffled.length));

      _quizStartTime = Date.now();

      var html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">';
      html += '<button onclick="TheWay.switchTab(\'quizzes\')" '
            + 'style="background:none;border:1px solid var(--line);border-radius:6px;padding:6px 14px;'
            + 'cursor:pointer;font-size:0.82rem;color:var(--ink);font-family:inherit;">\u2190 Back</button>';
      html += '<div style="flex:1;"><div style="font-weight:700;font-size:1rem;">' + _e(quiz.title) + '</div>'
            + '<div style="font-size:0.75rem;color:var(--ink-muted);">' + questions.length + ' of ' + allQuestions.length + ' questions'
            + (quiz.timeLimitMins ? ' \u2022 ' + quiz.timeLimitMins + ' min limit' : '') + '</div></div>';
      html += '<div id="tw-quiz-timer" style="font-size:0.85rem;color:var(--accent);font-weight:700;">0:00</div>';
      html += '</div>';

      html += '<form id="tw-cquiz-form" data-quiz-id="' + _e(quizId) + '">';
      questions.forEach(function(q, i) {
        html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;'
              + 'padding:14px;margin-bottom:12px;">';
        html += '<div style="font-weight:700;font-size:0.88rem;margin-bottom:8px;">'
              + (i + 1) + '. ' + _e(q.question || '') + '</div>';
        (q.options || []).forEach(function(opt, oi) {
          var letter = String.fromCharCode(97 + oi);
          html += '<label style="display:block;padding:6px 10px;margin-bottom:4px;border-radius:6px;'
                + 'cursor:pointer;font-size:0.82rem;">'
                + '<input type="radio" name="cq' + i + '" value="' + oi + '" style="margin-right:8px;">'
                + '<strong>' + _e(letter.toUpperCase()) + '.</strong> ' + _e(opt) + '</label>';
        });
        html += '</div>';
      });
      html += '<button type="button" onclick="TheWay._submitCourseQuiz(\'' + _e(quizId) + '\',' + questions.length + ')" '
            + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:8px;'
            + 'padding:12px 24px;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:inherit;">'
            + 'Submit Answers</button>';
      html += '</form>';

      _panel(html);

      if (_quizTimer) clearInterval(_quizTimer);
      _quizTimer = setInterval(function() {
        var elapsed = Math.floor((Date.now() - _quizStartTime) / 1000);
        var m = Math.floor(elapsed / 60);
        var s = elapsed % 60;
        var te = document.getElementById('tw-quiz-timer');
        if (te) te.textContent = m + ':' + (s < 10 ? '0' : '') + s;
      }, 1000);
    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  export async function _submitCourseQuiz(quizId, numQ) {
    if (_quizTimer) { clearInterval(_quizTimer); _quizTimer = null; }
    var form = document.getElementById('tw-cquiz-form');
    if (!form) return;
    var answers = [];
    for (var i = 0; i < numQ; i++) {
      var checked = form.querySelector('input[name="cq' + i + '"]:checked');
      answers.push(checked ? checked.value : '');
    }
    var elapsed = _quizStartTime ? Math.floor((Date.now() - _quizStartTime) / 1000) : 0;
    try {
      var res = await (_isFB() ? UpperRoom.submitLrnQuizResult({
        quizId: quizId,
        answers: answers,
        timeTakenSecs: elapsed,
        startedAt: new Date(_quizStartTime).toISOString(),
      }) : TheVine.flock.call('learning.quizResults.submit', {
        quizId: quizId,
        answers: answers,
        timeTakenSecs: elapsed,
        startedAt: new Date(_quizStartTime).toISOString(),
      }));
      _cache.quizResults = null;

      // Silently log course quiz score
      _logDiagnostic('quiz', { title: _e(quiz.title || 'Course Quiz'), correct: res.correctCount || 0, total: res.totalQuestions || numQ, pct: res.scorePercent || 0 });

      var scoreDiv = document.createElement('div');
      scoreDiv.style.cssText = 'background:var(--bg-raised);border:2px solid var(--accent);border-radius:10px;'
        + 'padding:20px;margin:16px 0;text-align:center;';
      scoreDiv.innerHTML = '<div style="font-size:2rem;font-weight:700;color:var(--accent);">'
        + (res.correctCount || 0) + ' / ' + (res.totalQuestions || numQ) + '</div>'
        + '<div style="font-size:0.88rem;color:var(--ink-muted);">' + (res.scorePercent || 0) + '% correct</div>'
        + '<div style="font-size:0.85rem;margin-top:8px;color:' + (res.passed ? 'var(--success)' : 'var(--danger)') + ';font-weight:700;">'
        + (res.passed ? '\u2713 Passed!' : '\u2717 ' + (res.message || 'Try again')) + '</div>';
      form.parentNode.insertBefore(scoreDiv, form);
      var btn = form.querySelector('button');
      if (btn) { btn.disabled = true; btn.textContent = 'Submitted'; }
    } catch (e) {
      _toast(e.message || 'Submission failed', 'danger');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. READING PLANS — Multi-day with streak calendar
  // ══════════════════════════════════════════════════════════════════════════

  var _featuredPlans = [
    { title: 'Bible in One Year', desc: 'Walk through the entire Bible chronologically in 365 days with daily Old Testament, New Testament, and Psalms/Proverbs readings.', days: 365, icon: '\uD83D\uDCD6', color: 'var(--accent)', url: 'https://www.bible.com/reading-plans/1-bible-in-one-year' },
    { title: 'Chronological Bible in a Year', desc: 'Experience Scripture in the order events actually occurred — from Creation through Revelation.', days: 365, icon: '\uD83D\uDD70\uFE0F', color: 'var(--gold,#d4b870)', url: 'https://www.bible.com/reading-plans/5805-chronological-bible-in-a-year' },
    { title: 'The Bible Project: Read Scripture', desc: 'Engaging overviews and daily readings designed by The Bible Project to help you understand each book.', days: 365, icon: '\uD83C\uDFA5', color: 'var(--mint)', url: 'https://www.bible.com/reading-plans/25498-read-scripture' },
    { title: 'Life of Jesus', desc: 'A 30-day journey through the four Gospels exploring the life, ministry, death, and resurrection of Christ.', days: 30, icon: '\u2720', color: 'var(--peach,#f97316)', url: 'https://www.bible.com/reading-plans/20656-the-life-of-jesus' },
    { title: '21 Days of Prayer', desc: 'Develop a deeper prayer life with three weeks of guided devotional readings and Scripture reflections.', days: 21, icon: '\uD83D\uDE4F', color: 'var(--lilac)', url: 'https://www.bible.com/reading-plans/1908-21-days-of-prayer' },
    { title: 'Psalms for the Summer', desc: 'Refresh your soul with a month of Psalms — praise, lament, thanksgiving, and trust in one beautiful collection.', days: 30, icon: '\u2600\uFE0F', color: 'var(--warning,#eab308)', url: 'https://www.bible.com/reading-plans/15933-psalms-for-the-summer' },
    { title: 'New Believer\'s Guide', desc: 'A 14-day introduction to the Christian faith, covering salvation, prayer, the Holy Spirit, and spiritual growth.', days: 14, icon: '\uD83C\uDF31', color: 'var(--success,#22c55e)', url: 'https://www.bible.com/reading-plans/243-new-believers' },
    { title: 'Romans: The Gospel of Grace', desc: 'A deep dive into Paul\'s masterpiece on justification, sanctification, and life in the Spirit.', days: 30, icon: '\u2709\uFE0F', color: 'var(--accent)', url: 'https://www.bible.com/reading-plans/2032-romans' },
  ];

  var _readingPlans = [
    { id: 'chronological', title: 'Chronological Bible', desc: 'Read the Bible in chronological order in 365 days.', days: 365, category: 'Whole Bible' },
    { id: 'nt-90', title: 'New Testament in 90 Days', desc: 'Read the New Testament in 90 days.', days: 90, category: 'New Testament' },
    { id: 'psalms-30', title: 'Psalms in 30 Days', desc: 'Read all 150 Psalms in 30 days.', days: 30, category: 'Poetry' },
    { id: 'proverbs-31', title: 'Proverbs in 31 Days', desc: 'One chapter of Proverbs per day.', days: 31, category: 'Wisdom' },
    { id: 'gospels-60', title: 'Four Gospels in 60 Days', desc: 'Walk through the life of Jesus.', days: 60, category: 'Gospels' },
    { id: 'epistles-45', title: 'Epistles in 45 Days', desc: 'Paul\'s letters and general epistles.', days: 45, category: 'Epistles' },
  ];

  async function _renderReadingPlans() {
    _panel(_spinner());
    try {
      // Fetch user's reading progress from localStorage (lightweight)
      var stored = {};
      try { stored = JSON.parse(localStorage.getItem('tw_reading_progress') || '{}'); } catch (_) {}
      _cache.readingProgress = stored;

      var html = '';

      // ── Featured Bible.com Reading Plans ──
      html += '<h3 style="font-size:0.92rem;font-weight:700;margin-bottom:10px;">\uD83C\uDF1F Featured Reading Plans</h3>';
      html += '<div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:10px;margin-bottom:20px;'
            + '-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;">';
      _featuredPlans.forEach(function(fp) {
        html += '<a href="' + _e(fp.url) + '" target="_blank" rel="noopener noreferrer" '
              + 'style="scroll-snap-align:start;flex:0 0 220px;text-decoration:none;color:inherit;'
              + 'background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;'
              + 'padding:16px;display:flex;flex-direction:column;transition:box-shadow 0.15s,border-color 0.15s;"'
              + ' onmouseenter="this.style.borderColor=\'' + 'var(--accent)' + '\';this.style.boxShadow=\'0 4px 16px rgba(0,0,0,0.08)\'"'
              + ' onmouseleave="this.style.borderColor=\'var(--line)\';this.style.boxShadow=\'none\'">';
        html += '<div style="font-size:1.6rem;margin-bottom:8px;">' + fp.icon + '</div>';
        html += '<div style="font-weight:700;font-size:0.85rem;margin-bottom:4px;line-height:1.3;">' + _e(fp.title) + '</div>';
        html += '<div style="font-size:0.72rem;color:var(--ink-muted);margin-bottom:10px;line-height:1.4;flex:1;">' + _e(fp.desc) + '</div>';
        html += '<div style="display:flex;align-items:center;gap:6px;">'
              + '<span style="font-size:0.68rem;padding:2px 8px;border-radius:10px;font-weight:600;'
              + 'background:' + fp.color + ';color:#fff;opacity:0.9;">' + fp.days + ' days</span>'
              + '<span style="font-size:0.68rem;color:var(--ink-faint);margin-left:auto;">Bible.com \u2197</span>'
              + '</div>';
        html += '</a>';
      });
      html += '</div>';

      // Streak calendar heatmap
      var heatData = [];
      Object.keys(stored).forEach(function(planId) {
        var plan = stored[planId] || {};
        Object.keys(plan).forEach(function(dayKey) {
          if (plan[dayKey] && plan[dayKey].date) {
            heatData.push({ date: plan[dayKey].date, value: 1 });
          }
        });
      });
      // Merge by date
      var merged = {};
      heatData.forEach(function(d) {
        merged[d.date] = (merged[d.date] || 0) + d.value;
      });
      var heatArr = Object.keys(merged).map(function(k) { return { date: k, value: merged[k] }; });

      html += '<h3 style="font-size:0.92rem;font-weight:700;margin-bottom:10px;">Reading Streak</h3>';
      html += _card('<div style="overflow-x:auto;">' + _svgHeatmap(heatArr, 26, 12) + '</div>'
        + '<div style="font-size:0.72rem;color:var(--ink-faint);margin-top:6px;">Each cell = one day of reading</div>'
      , 'margin-bottom:20px;');

      // Plan library
      html += '<h3 style="font-size:0.92rem;font-weight:700;margin-bottom:10px;">Reading Plans</h3>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">';

      _readingPlans.forEach(function(plan) {
        var progress = stored[plan.id] || {};
        var completed = Object.keys(progress).filter(function(k) { return progress[k] && progress[k].done; }).length;
        var pct = plan.days ? Math.round(completed / plan.days * 100) : 0;

        html += _card(
          '<div style="font-weight:700;font-size:0.92rem;margin-bottom:4px;">' + _e(plan.title) + '</div>'
          + '<div style="font-size:0.78rem;color:var(--ink-muted);margin-bottom:8px;">' + _e(plan.desc) + '</div>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">'
          + '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;'
          + 'background:var(--mint-soft);color:var(--mint);">' + plan.days + ' days</span>'
          + '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;'
          + 'background:var(--lilac-soft);color:var(--lilac);">' + _e(plan.category) + '</span>'
          + '</div>'
          + _progressBar(pct, 'var(--mint)')
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">'
          + '<span style="font-size:0.75rem;color:var(--ink-muted);">' + completed + '/' + plan.days + ' days</span>'
          + '<button onclick="TheWay._openReadingPlan(\'' + _e(plan.id) + '\')" '
          + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:4px;'
          + 'padding:5px 14px;font-size:0.78rem;cursor:pointer;font-family:inherit;">'
          + (completed > 0 ? 'Continue' : 'Start') + '</button>'
          + '</div>'
        );
      });
      html += '</div>';

      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  export async function _openReadingPlan(planId) {
    var plan = _readingPlans.find(function(p) { return p.id === planId; });
    if (!plan) return;
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem('tw_reading_progress') || '{}'); } catch (_) {}
    var progress = stored[planId] || {};

    // Load day-by-day schedule from static bundle
    var schedule = [];
    try {
      var smod = await import('../Data/reading-plans.js');
      var allSchedules = smod.default || {};
      schedule = allSchedules[planId] || [];
    } catch (_) {}

    var html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">';
    html += '<button onclick="TheWay.switchTab(\'reading\')" '
          + 'style="background:none;border:1px solid var(--line);border-radius:6px;padding:6px 14px;'
          + 'cursor:pointer;font-size:0.82rem;color:var(--ink);font-family:inherit;">\u2190 Back</button>';
    html += '<div style="flex:1;font-weight:700;font-size:1rem;">' + _e(plan.title) + '</div>';

    var completedCount = Object.keys(progress).filter(function(k) { return progress[k] && progress[k].done; }).length;
    var pct = plan.days ? Math.round(completedCount / plan.days * 100) : 0;
    html += '<span style="font-size:0.78rem;color:var(--ink-muted);">' + pct + '% complete</span>';
    html += '</div>';

    html += _progressBar(pct, 'var(--mint)');
    html += '<div style="height:14px;"></div>';

    if (schedule.length) {
      // Day list with passage detail
      html += '<div style="display:flex;flex-direction:column;gap:6px;">';
      schedule.forEach(function(entry) {
        var d = entry.day;
        var done = progress['day' + d] && progress['day' + d].done;
        var passages = entry.passages || [];
        html += '<div style="display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:8px;'
              + 'border:1px solid ' + (done ? 'rgba(74,222,128,0.4)' : 'var(--line)') + ';'
              + 'background:' + (done ? 'rgba(74,222,128,0.07)' : 'var(--bg-raised)') + ';">';
        html += '<button onclick="TheWay._toggleReadingDay(\'' + _e(planId) + '\',' + d + ')" '
              + 'style="flex:0 0 32px;height:32px;border-radius:50%;border:2px solid '
              + (done ? 'var(--success)' : 'var(--line)') + ';cursor:pointer;font-size:0.7rem;font-weight:700;'
              + 'background:' + (done ? 'var(--success)' : 'transparent') + ';'
              + 'color:' + (done ? '#fff' : 'var(--ink-muted)') + ';font-family:inherit;">'
              + (done ? '\u2713' : d) + '</button>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:0.72rem;color:var(--ink-muted);font-weight:600;margin-bottom:1px;">Day ' + d + '</div>';
        html += '<div style="font-size:0.83rem;">' + passages.map(function(p) { return _bibleLink(p); }).join(' &bull; ') + '</div>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      // Fallback: numbered grid (no schedule data for this plan)
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:4px;">';
      for (var d = 1; d <= plan.days; d++) {
        var done = progress['day' + d] && progress['day' + d].done;
        html += '<button onclick="TheWay._toggleReadingDay(\'' + _e(planId) + '\',' + d + ')" '
              + 'style="width:100%;aspect-ratio:1;border-radius:6px;cursor:pointer;font-size:0.72rem;'
              + 'font-family:inherit;border:1px solid ' + (done ? 'var(--success)' : 'var(--line)') + ';'
              + 'background:' + (done ? 'rgba(74,222,128,0.15)' : 'var(--bg-raised)') + ';'
              + 'color:' + (done ? 'var(--success)' : 'var(--ink-muted)') + ';font-weight:' + (done ? '700' : '400') + ';">'
              + d + '</button>';
      }
      html += '</div>';
    }

    _panel(html);
  }

  export function _toggleReadingDay(planId, day) {
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem('tw_reading_progress') || '{}'); } catch (_) {}
    if (!stored[planId]) stored[planId] = {};
    var key = 'day' + day;
    if (stored[planId][key] && stored[planId][key].done) {
      delete stored[planId][key];
    } else {
      stored[planId][key] = { done: true, date: new Date().toISOString().slice(0, 10) };
    }
    localStorage.setItem('tw_reading_progress', JSON.stringify(stored));
    _openReadingPlan(planId);  // async — fire and forget, re-renders panel
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. THEOLOGY — Doctrine categories & deep dives
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderTheology() {
    _panel(_spinner());
    try {
      // ── Check local bundle (TheTruth sync from flockos-truth) first ──
      // If a bundle is present we skip live Firestore reads entirely.
      var _theoBundleFlat = null;
      try {
        if (typeof TheTruth !== 'undefined') _theoBundleFlat = TheTruth.liveBundle('theology');
        if (!_theoBundleFlat || !_theoBundleFlat.length) {
          var _theoMod = await import('../Data/theology.js');
          if ((_theoMod.default || []).length) _theoBundleFlat = _theoMod.default;
        }
        if (_theoBundleFlat && !_theoBundleFlat.length) _theoBundleFlat = null;
      } catch (_) {}

      // ── Fetch full tree (categories → sections → scriptures) ─────────
      var tree = [];
      var stats = null;
      if (!_theoBundleFlat && _isFB()) {
        try {
          var results = await _withTimeout(Promise.all([
            UpperRoom.theologyFull(),
            UpperRoom.theologyDashboard()
          ]));
          tree  = _rows(results[0]);
          stats = results[1];
          if (stats && stats.rows) stats = stats.rows[0] || stats.rows;
          if (stats && stats.data) stats = stats.data;
        } catch (_) {}
      }

      // Fallback to flat content: bundle → UpperRoom.listAppContent → TheVine
      if (!tree.length) {
        try {
          var flat = _theoBundleFlat || [];
          if (!flat.length && _isFB() && typeof UpperRoom !== 'undefined') {
            try { flat = _rows(await _withTimeout(UpperRoom.listAppContent('theology'))); } catch (_) {}
          }
          if (!flat.length && typeof TheVine !== 'undefined' && TheVine.app && TheVine.app.theology) {
            flat = _rows(await _withTimeout(TheVine.app.theology()));
          }
            if (flat.length) {
              var catMap = {};
              flat.forEach(function(r) {
                var cat = r['Category Title'] || r.categoryTitle || r.category_title || 'General';
                if (!catMap[cat]) catMap[cat] = {
                  title: cat,
                  subtitle: r['Category Subtitle'] || r.categorySubtitle || '',
                  intro: r['Category Intro'] || r.categoryIntro || r.category_intro || '',
                  icon: r['Category Icon'] || r.categoryIcon || '\u2638',
                  colorVar: r['Category Color'] || r.categoryColor || 'var(--accent-cyan)',
                  sections: []
                };
                catMap[cat].sections.push({
                  title: r['Section Title'] || r.sectionTitle || r.section_title || '',
                  content: r['Content'] || r.content || '',
                  summary: r['Summary'] || r.summary || '',
                  scriptureRefs: r['Scripture Refs'] || r['ScriptureRefs'] || r.scriptureRefs || '',
                  keywords: r['Keywords'] || r.keywords || '',
                  status: r['Status'] || r.status || 'Approved',
                  version: r['Version'] || r.version || null,
                  approvedBy: r['Approved By'] || r.approvedBy || '',
                  approvedAt: r['Approved At'] || r.approvedAt || '',
                  scriptures: []
                });
              });
              tree = Object.keys(catMap).map(function(k) { return catMap[k]; });
              // Derive KPI stats from bundle data (no live Firestore dashboard call needed)
              if (_theoBundleFlat) {
                stats = {
                  totalCategories:  tree.length,
                  totalSections:    flat.length,
                  approvedSections: flat.filter(function(r) { return (r.status || r['Status'] || 'Approved') === 'Approved'; }).length,
                  draftSections:    flat.filter(function(r) { return (r.status || r['Status'] || '') === 'Draft'; }).length,
                };
              }
            }
        } catch (_) {}
      }

      if (!tree.length) {
        _panel(_empty('\u2638', 'No theology content yet', 'Doctrine categories and deep dives will appear here.'));
        return;
      }

      var html = '';

      // ── Dashboard KPIs ───────────────────────────────────────────────
      if (stats) {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:20px;">';
        html += _kpi('Categories',  stats.totalCategories  || tree.length, '\uD83D\uDCC2');
        html += _kpi('Sections',    stats.totalSections    || '—', '\uD83D\uDCDC');
        html += _kpi('Approved',    stats.approvedSections || '—', '\u2705');
        html += _kpi('Drafts',      stats.draftSections    || '—', '\u270F\uFE0F');
        html += _kpi('Scriptures',  stats.totalScriptures  || '—', '\uD83D\uDCD6');
        html += _kpi('Revisions',   stats.totalRevisions   || '—', '\uD83D\uDD04');
        html += '</div>';
      }

      // ── Search ───────────────────────────────────────────────────────
      html += '<div style="margin-bottom:14px;">';
      html += '<input type="text" placeholder="Search doctrines, scripture, keywords\u2026" '
            + 'oninput="TheWay._filterPanel(\'theo\',this.value)" '
            + 'style="width:100%;max-width:480px;padding:8px 12px;border:1px solid var(--line);border-radius:6px;'
            + 'background:var(--bg-raised);color:var(--ink);font-size:max(0.88rem,16px);font-family:inherit;"></div>';

      // ── Category accordion ───────────────────────────────────────────
      html += '<div id="theo-grid">';
      tree.forEach(function(cat) {
        var sections = cat.sections || [];
        var icon     = cat.icon || '\u2638';
        var color    = cat.colorVar || 'var(--accent-cyan)';
        var approved = sections.filter(function(s) { return s.status === 'Approved'; }).length;

        // Build full-text search index for this category
        var searchText = (cat.title + ' ' + (cat.subtitle || '') + ' ' + (cat.intro || '') + ' '
          + sections.map(function(s) {
              var scrText = (s.scriptures || []).map(function(sc) { return sc.reference + ' ' + sc.text + ' ' + sc.contextNote; }).join(' ');
              return s.title + ' ' + s.content + ' ' + s.summary + ' ' + s.scriptureRefs + ' ' + s.keywords + ' ' + scrText;
            }).join(' ')).toLowerCase();

        html += '<details class="browse-item" data-search="' + _e(searchText) + '" '
              + 'style="margin-bottom:10px;border:1px solid var(--line);border-radius:10px;overflow:hidden;">';

        // ── Category header ──────────────────────────────────────────
        html += '<summary style="padding:14px 18px;background:var(--bg-raised);cursor:pointer;'
              + 'display:flex;align-items:center;gap:10px;border-left:4px solid ' + _e(color) + ';">'
              + '<span style="font-size:1.3rem;">' + icon + '</span>'
              + '<span style="flex:1;">'
              + '<span style="font-weight:700;font-size:0.92rem;color:var(--ink);">' + _e(cat.title) + '</span>';
        if (cat.subtitle) html += '<span style="font-size:0.78rem;color:var(--ink-muted);margin-left:8px;">' + _e(cat.subtitle) + '</span>';
        html += '</span>'
              + '<span style="font-size:0.72rem;color:var(--ink-muted);white-space:nowrap;">'
              + sections.length + ' section' + (sections.length !== 1 ? 's' : '');
        if (approved > 0) html += ' \u00B7 ' + approved + ' approved';
        html += '</span>'
              + '<span style="font-size:0.7rem;color:var(--ink-faint);transition:transform 0.2s;">\u25B6</span>'
              + '</summary>';

        html += '<div style="padding:18px;">';

        // ── Category intro ───────────────────────────────────────────
        if (cat.intro) {
          html += '<div style="background:var(--accent-soft);border-radius:8px;padding:12px 16px;'
                + 'margin-bottom:16px;font-size:0.84rem;color:var(--accent);line-height:1.6;">'
                + '<strong>Overview:</strong> ' + _e(cat.intro) + '</div>';
        }

        // ── Sections ─────────────────────────────────────────────────
        if (!sections.length) {
          html += '<div style="text-align:center;padding:24px;color:var(--ink-muted);font-size:0.82rem;">'
                + 'No doctrinal sections yet.</div>';
        }

        sections.forEach(function(sec) {
          html += '<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;'
                + 'padding:14px 16px;margin-bottom:10px;">';

          // Section header: title + status
          html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
          html += '<div style="font-weight:700;font-size:0.9rem;flex:1;color:var(--ink);">' + _e(sec.title) + '</div>';
          if (sec.status) {
            var sBg = sec.status === 'Approved' ? 'var(--success)' :
                      sec.status === 'Draft' ? 'var(--warning)' :
                      sec.status === 'Under Review' ? 'var(--info,var(--accent))' : 'var(--ink-muted)';
            html += '<span style="font-size:0.68rem;padding:2px 8px;border-radius:10px;'
                  + 'background:' + sBg + ';color:#fff;white-space:nowrap;">' + _e(sec.status) + '</span>';
          }
          if (sec.version && sec.version > 1) {
            html += '<span style="font-size:0.68rem;padding:2px 8px;border-radius:10px;'
                  + 'background:var(--bg-sunken);color:var(--ink-muted);">v' + sec.version + '</span>';
          }
          html += '</div>';

          // Summary
          if (sec.summary) {
            html += '<div style="font-size:0.82rem;color:var(--accent);font-style:italic;'
                  + 'margin-bottom:8px;line-height:1.5;">' + _e(sec.summary) + '</div>';
          }

          // Content
          if (sec.content) {
            html += '<div style="font-size:0.84rem;color:var(--ink-muted);line-height:1.7;margin-bottom:8px;">'
                  + _e(sec.content) + '</div>';
          }

          // Inline scripture refs (comma-separated from section)
          if (sec.scriptureRefs) {
            html += '<div style="margin-bottom:8px;">';
            sec.scriptureRefs.split(',').forEach(function(ref) {
              ref = ref.trim();
              if (ref) html += '<span style="display:inline-block;margin:2px 4px 2px 0;">' + _bibleLink(ref) + '</span>';
            });
            html += '</div>';
          }

          // Linked scriptures (detailed cards from TheologyScriptures)
          var scriptures = sec.scriptures || [];
          if (scriptures.length) {
            html += '<div style="margin-top:6px;border-top:1px solid var(--line);padding-top:10px;">';
            html += '<div style="font-size:0.75rem;font-weight:600;color:var(--ink-muted);margin-bottom:6px;">'
                  + '\uD83D\uDCD6 Supporting Scriptures</div>';
            scriptures.forEach(function(sc) {
              var isPrimary = sc.isPrimary === 'TRUE' || sc.isPrimary === true;
              html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:6px;'
                    + 'padding:10px 12px;margin-bottom:6px;'
                    + (isPrimary ? 'border-left:3px solid var(--gold);' : '') + '">';
              html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
              html += '<span>' + _bibleLink(sc.reference) + '</span>';
              if (sc.translation) {
                html += '<span style="font-size:0.68rem;padding:1px 6px;border-radius:4px;'
                      + 'background:var(--bg-sunken);color:var(--ink-muted);">' + _e(sc.translation) + '</span>';
              }
              if (isPrimary) {
                html += '<span style="font-size:0.68rem;padding:1px 6px;border-radius:4px;'
                      + 'background:var(--gold);color:#fff;">Primary</span>';
              }
              html += '</div>';
              if (sc.text) {
                html += '<div style="font-size:0.82rem;color:var(--ink);line-height:1.6;font-style:italic;'
                      + 'margin-bottom:4px;">\u201C' + _e(sc.text) + '\u201D</div>';
              }
              if (sc.contextNote) {
                html += '<div style="font-size:0.78rem;color:var(--ink-muted);line-height:1.5;">'
                      + '\uD83D\uDCAC ' + _e(sc.contextNote) + '</div>';
              }
              html += '</div>';
            });
            html += '</div>';
          }

          // Keywords as tags
          if (sec.keywords) {
            html += '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">';
            sec.keywords.split(',').forEach(function(kw) {
              kw = kw.trim();
              if (kw) html += '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;'
                    + 'background:var(--lilac-soft,var(--bg-sunken));color:var(--lilac,var(--ink-muted));">' + _e(kw) + '</span>';
            });
            html += '</div>';
          }

          // Approval info
          if (sec.approvedBy && sec.status === 'Approved') {
            html += '<div style="margin-top:8px;font-size:0.72rem;color:var(--ink-faint);">'
                  + '\u2705 Approved by ' + _e(sec.approvedBy)
                  + (sec.approvedAt ? ' on ' + _e(sec.approvedAt.split('T')[0]) : '') + '</div>';
          }

          html += '</div>'; // end section card
        });

        html += '</div></details>';
      });
      html += '</div>';

      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. LEXICON — Greek & Hebrew word study (split-panel)
  // ══════════════════════════════════════════════════════════════════════════

  var _twLexRows = null;     // cached word rows keyed by English
  var _twLexMaxUsage = 1;    // cached max usage for bar scaling

  async function _renderLexicon() {
    _panel(_spinner());
    try {
      var words = [];
      // 1. Try live bundle (admin-synced cache)
      try {
        var liveWords = (typeof TheTruth !== 'undefined') ? TheTruth.liveBundle('words') : null;
        if (liveWords && liveWords.length) words = liveWords;
      } catch (_) {}
      // 2. Try TheVine API
      if (!words.length) {
        try {
          if (typeof TheVine !== 'undefined' && TheVine.app && TheVine.app.words) {
            var res = await _withTimeout(TheVine.app.words());
            words = _rows(res);
          }
        } catch (_) {}
      }
      // 3. Fall back to Strong's concordance static data
      if (!words.length) {
        try {
          var gMod = await import('../../Data/strongs-greek.js');
          var hMod = await import('../../Data/strongs-hebrew.js');
          var GREEK = gMod.default || {};
          var HEBREW = hMod.default || {};
          for (var gid in GREEK) {
            var ge = GREEK[gid];
            words.push({ id: gid, 'Strong\'s': gid, English: (ge.kjv_def || '').split(',')[0].trim(), KJVRenderings: ge.kjv_def || '', Original: ge.lemma || '', Transliteration: ge.translit || '', Pronunciation: '', Testament: 'New', Definition: ge.strongs_def ? ge.strongs_def.trim() : '', Etymology: ge.derivation || '', 'Usage Count': '0', Verses: '', Theme: '' });
          }
          for (var hid in HEBREW) {
            var he = HEBREW[hid];
            words.push({ id: hid, 'Strong\'s': hid, English: (he.kjv_def || '').split(',')[0].trim(), KJVRenderings: he.kjv_def || '', Original: he.lemma || '', Transliteration: he.xlit || '', Pronunciation: he.pron || '', Testament: 'Old', Definition: he.strongs_def ? he.strongs_def.trim() : '', Etymology: he.derivation || '', 'Usage Count': '0', Verses: '', Theme: '' });
          }
        } catch (_) {}
      }

      if (!words.length) {
        _panel(_empty('\u0391', 'Lexicon Coming Soon', 'Greek and Hebrew word studies will appear here.'));
        return;
      }

      var ntWords = words.filter(function(r) { return (r['Testament'] || '') === 'New'; });
      var otWords = words.filter(function(r) { return (r['Testament'] || '') !== 'New'; });
      var maxUsage = Math.max.apply(null, words.map(function(r) { return parseInt(r['Usage Count'] || '0', 10) || 0; }).concat([1]));
      _twLexMaxUsage = maxUsage;

      // Sort alphabetically by English
      var sorted = words.slice().sort(function(a, b) { return (a['English'] || '').localeCompare(b['English'] || ''); });
      var letters = {};
      sorted.forEach(function(r) {
        var ch = (r['English'] || '?')[0].toUpperCase();
        if (!letters[ch]) letters[ch] = [];
        letters[ch].push(r);
      });

      // Cache for clicks — key by Strong's number (unique) with English as fallback
      _twLexRows = {};
      sorted.forEach(function(r) { var key = (r["Strong's"] || r['English'] || '').trim(); if (key) _twLexRows[key] = r; });

      var html = '';

      // Stat cards
      html += '<div class="gene-stat-row">';
      html += '<div class="gene-stat-card"><div class="gene-stat-num">' + words.length + '</div><div class="gene-stat-label">Total Words</div></div>';
      html += '<div class="gene-stat-card"><div class="gene-stat-num" style="color:var(--accent);">' + ntWords.length + '</div><div class="gene-stat-label">Greek (NT)</div></div>';
      html += '<div class="gene-stat-card"><div class="gene-stat-num" style="color:var(--gold);">' + otWords.length + '</div><div class="gene-stat-label">Hebrew (OT)</div></div>';
      html += '<div class="gene-stat-card"><div class="gene-stat-num">' + Object.keys(letters).length + '</div><div class="gene-stat-label">Letters</div></div>';
      html += '</div>';

      // Testament filter tabs
      html += '<div class="lex-testament-tabs">';
      html += '<button class="lex-testament-tab active" onclick="TheWay._twLexFilter(\'all\',this)">All<span class="lex-count-badge">' + words.length + '</span></button>';
      html += '<button class="lex-testament-tab" onclick="TheWay._twLexFilter(\'nt\',this)">Greek (NT)<span class="lex-count-badge">' + ntWords.length + '</span></button>';
      html += '<button class="lex-testament-tab lex-ot-tab" onclick="TheWay._twLexFilter(\'ot\',this)">Hebrew (OT)<span class="lex-count-badge">' + otWords.length + '</span></button>';
      html += '</div>';

      // Search bar
      html += '<div class="browse-search" style="margin-bottom:10px;">';
      html += '<span class="browse-search-icon">\uD83D\uDD0D</span>';
      html += '<input type="text" id="tw-lex-search" name="tw-lex-search" class="browse-search-input" placeholder="Search ' + words.length + ' words by English, Strong\u2019s, or original\u2026" oninput="TheWay._twLexSearch(this.value)">';
      html += '<span id="tw-lex-count" style="font-size:.85rem;color:var(--text-secondary);margin-left:auto;">' + words.length + '</span>';
      html += '</div>';

      // Letter index
      html += '<div class="letter-index" style="margin-bottom:10px;">';
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function(L) {
        var has = letters[L];
        html += '<button class="letter-index-btn' + (has ? '' : ' disabled') + '" onclick="TheWay._twLexLetterJump(\'' + L + '\')">' + L + '</button>';
      });
      html += '</div>';

      // Split panel container
      html += '<div class="gene-split">';

      // Left: word list
      html += '<div class="gene-list">';
      html += '<div class="gene-list-scroll" id="tw-lex-list-scroll">';
      Object.keys(letters).sort().forEach(function(letter) {
        html += '<div class="gene-letter-head" data-letter="' + letter + '" id="tw-lex-' + letter + '">' + letter + '</div>';
        letters[letter].forEach(function(r) {
          var eng = r['English'] || '';
          var original = r['Original'] || '';
          var strongs = r["Strong's"] || '';
          var isNT = (r['Testament'] || '') === 'New';
          var testKey = isNT ? 'nt' : 'ot';
          var searchText = (eng + ' ' + strongs + ' ' + original + ' ' + (r['Transliteration'] || '') + ' ' + (r['Definition'] || '')).toLowerCase();
          html += '<div class="gene-item" data-search="' + _e(searchText) + '" data-testament="' + testKey + '" data-letter="' + letter + '" data-idx="' + _e(r["Strong's"] || eng) + '" onclick="TheWay._twLexSelect(this.dataset.idx)">';
          html += '<div class="gene-item-name">' + _e(eng) + '</div>';
          html += '<div class="gene-item-title" style="display:flex;align-items:center;gap:6px;">';
          if (original) html += '<span style="font-family:\'Noto Sans\',\'Noto Sans Hebrew\',serif;' + (isNT ? '' : 'direction:rtl;') + '">' + _e(original) + '</span>';
          if (strongs) html += '<span class="lex-strongs-pill ' + (isNT ? 'lex-nt' : 'lex-ot') + '" style="font-size:0.65rem;padding:1px 5px;">' + _e(strongs) + '</span>';
          html += '</div>';
          html += '</div>';
        });
      });
      html += '</div></div>';

      // Right: detail panel
      html += '<div class="gene-detail" id="tw-lex-detail">';
      html += '<div class="gene-detail-empty">';
      html += '<div style="font-size:3rem;">\u2721</div>';
      html += '<p>Select a word from the list</p>';
      html += '</div>';
      html += '</div>';

      html += '</div>'; // close gene-split

      _panel(html);

      // Auto-select G5547 (Christos) if present, otherwise first word
      var autoWord = sorted.find(function(r) { return (r["Strong's"] || '').trim() === 'G5547'; }) || sorted[0];
      if (autoWord) _twLexSelect(autoWord["Strong's"] || autoWord['English']);

    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  /** Select a word in the TheWay lexicon split-panel */
  export function _twLexSelect(name) {
    if (!name || !_twLexRows) return;
    var word = _twLexRows[name.trim()];
    if (!word) return;

    // Mark active in list
    document.querySelectorAll('#tw-lex-list-scroll .gene-item').forEach(function(el) {
      el.classList.toggle('active', el.dataset.idx === name.trim());
    });

    var detail = document.getElementById('tw-lex-detail');
    if (!detail) return;

    var eng      = word['English'] || '';
    var strongs  = word["Strong's"] || '';
    var original = word['Original'] || '';
    var translit = word['Transliteration'] || '';
    var def      = word['Definition'] || '';
    var nuance   = word['Nuance'] || '';
    var testament= word['Testament'] || '';
    var theme    = word['Theme'] || '';
    var usage    = parseInt(word['Usage Count'] || '0', 10) || 0;
    var verses   = word['Verses'] || '';
    var isNT     = testament === 'New';
    var langDir  = isNT ? 'ltr' : 'rtl';
    var langClass= isNT ? 'lex-greek' : 'lex-hebrew';

    var h = '<div class="gene-fade-in">';

    // Hero
    h += '<div class="gene-hero">';
    if (original) {
      h += '<div class="lex-original ' + langClass + '" dir="' + langDir + '" style="font-size:2.4rem;margin-bottom:4px;">' + _e(original) + '</div>';
      if (translit) h += '<p style="font-style:italic;color:var(--ink-muted);font-size:0.9rem;margin:0 0 6px;">' + _e(translit) + '</p>';
    }
    h += '<h2 class="gene-hero-name">' + _e(eng) + '</h2>';
    h += '<div class="gene-hero-badges">';
    if (strongs) h += '<span class="lex-strongs-pill ' + (isNT ? 'lex-nt' : 'lex-ot') + '">' + _e(strongs) + '</span>';
    h += '<span class="gene-hero-badge ' + (isNT ? 'gene-hero-badge-accent' : 'gene-hero-badge-gold') + '">' + (isNT ? 'Greek (NT)' : 'Hebrew (OT)') + '</span>';
    if (theme) h += '<span class="gene-hero-badge" style="background:var(--lilac-soft,var(--bg-sunken));color:var(--lilac,var(--ink-muted));">' + _e(theme) + '</span>';
    h += '</div></div>';

    // Sections
    h += '<div class="gene-sections">';
    if (def) {
      h += '<div class="gene-section ' + (isNT ? '' : 'gene-section-gold') + '">';
      h += '<div class="gene-section-label">Definition</div>';
      h += '<p style="line-height:1.7;">' + _e(def) + '</p></div>';
    }
    if (nuance) {
      h += '<div class="gene-section gene-section-lilac">';
      h += '<div class="gene-section-label">Nuance</div>';
      h += '<p style="font-style:italic;line-height:1.6;">' + _e(nuance) + '</p></div>';
    }
    if (usage) {
      var usagePct = Math.round((usage / (_twLexMaxUsage || 1)) * 100);
      h += '<div class="gene-section gene-section-mint">';
      h += '<div class="gene-section-label">Biblical Usage</div>';
      h += '<div class="lex-stat-bar">';
      h += '<span style="font-size:1.1rem;font-weight:700;color:var(--ink);min-width:50px;">' + usage + '</span>';
      h += '<div class="lex-stat-bar-fill" style="width:' + usagePct + '%;"></div>';
      h += '<span style="font-size:0.78rem;color:var(--ink-muted);">occurrences</span>';
      h += '</div></div>';
    }
    if (verses) {
      h += '<div class="gene-section gene-section-peach">';
      h += '<div class="gene-section-label">Scripture References</div>';
      h += '<div class="gene-ref-pills">';
      verses.split(/[,;]/).forEach(function(v) {
        v = v.trim();
        if (v) h += '<span class="gene-ref-pill">' + _bibleLink(v) + '</span>';
      });
      h += '</div></div>';
    }
    h += '</div></div>';

    detail.innerHTML = h;
    detail.scrollTop = 0;

    if (window.innerWidth <= 900) {
      setTimeout(function() { detail.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    }
  }

  /** Filter lexicon list items by testament in TheWay */
  export function _twLexFilter(testament, btn) {
    document.querySelectorAll('.lex-testament-tab').forEach(function(t) { t.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var items = document.querySelectorAll('#tw-lex-list-scroll .gene-item');
    var heads = document.querySelectorAll('#tw-lex-list-scroll .gene-letter-head');
    items.forEach(function(el) {
      if (testament === 'all') { el.style.display = ''; return; }
      el.style.display = (el.dataset.testament === testament) ? '' : 'none';
    });
    heads.forEach(function(h) {
      var letter = h.dataset.letter;
      var anyVisible = false;
      items.forEach(function(el) {
        if (el.dataset.letter === letter && el.style.display !== 'none') anyVisible = true;
      });
      h.style.display = anyVisible ? '' : 'none';
    });
    var visible = 0;
    items.forEach(function(el) { if (el.style.display !== 'none') visible++; });
    var counter = document.getElementById('tw-lex-count');
    if (counter) counter.textContent = visible;
  }

  /** Search / filter the TheWay lexicon list */
  export function _twLexSearch(query) {
    var q = (query || '').toLowerCase().trim();
    var items = document.querySelectorAll('#tw-lex-list-scroll .gene-item');
    var heads = document.querySelectorAll('#tw-lex-list-scroll .gene-letter-head');
    items.forEach(function(el) {
      el.style.display = (!q || (el.dataset.search || '').indexOf(q) !== -1) ? '' : 'none';
    });
    heads.forEach(function(h) {
      var letter = h.dataset.letter;
      var anyVisible = false;
      items.forEach(function(el) {
        if (el.dataset.letter === letter && el.style.display !== 'none') anyVisible = true;
      });
      h.style.display = anyVisible ? '' : 'none';
    });
    var visible = 0;
    items.forEach(function(el) { if (el.style.display !== 'none') visible++; });
    var counter = document.getElementById('tw-lex-count');
    if (counter) counter.textContent = visible;
  }

  /** Letter jump for TheWay lexicon */
  export function _twLexLetterJump(letter) {
    var heading = document.getElementById('tw-lex-' + letter);
    if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. LIBRARY — The Word (Bible browser)
  // ══════════════════════════════════════════════════════════════════════════

  var _BIBLE_BOOKS = [
    { name: 'Genesis', ch: 50, t: 'ot' }, { name: 'Exodus', ch: 40, t: 'ot' },
    { name: 'Leviticus', ch: 27, t: 'ot' }, { name: 'Numbers', ch: 36, t: 'ot' },
    { name: 'Deuteronomy', ch: 34, t: 'ot' }, { name: 'Joshua', ch: 24, t: 'ot' },
    { name: 'Judges', ch: 21, t: 'ot' }, { name: 'Ruth', ch: 4, t: 'ot' },
    { name: '1 Samuel', ch: 31, t: 'ot' }, { name: '2 Samuel', ch: 24, t: 'ot' },
    { name: '1 Kings', ch: 22, t: 'ot' }, { name: '2 Kings', ch: 25, t: 'ot' },
    { name: '1 Chronicles', ch: 29, t: 'ot' }, { name: '2 Chronicles', ch: 36, t: 'ot' },
    { name: 'Ezra', ch: 10, t: 'ot' }, { name: 'Nehemiah', ch: 13, t: 'ot' },
    { name: 'Esther', ch: 10, t: 'ot' }, { name: 'Job', ch: 42, t: 'ot' },
    { name: 'Psalms', ch: 150, t: 'ot' }, { name: 'Proverbs', ch: 31, t: 'ot' },
    { name: 'Ecclesiastes', ch: 12, t: 'ot' }, { name: 'Song of Solomon', ch: 8, t: 'ot' },
    { name: 'Isaiah', ch: 66, t: 'ot' }, { name: 'Jeremiah', ch: 52, t: 'ot' },
    { name: 'Lamentations', ch: 5, t: 'ot' }, { name: 'Ezekiel', ch: 48, t: 'ot' },
    { name: 'Daniel', ch: 12, t: 'ot' }, { name: 'Hosea', ch: 14, t: 'ot' },
    { name: 'Joel', ch: 3, t: 'ot' }, { name: 'Amos', ch: 9, t: 'ot' },
    { name: 'Obadiah', ch: 1, t: 'ot' }, { name: 'Jonah', ch: 4, t: 'ot' },
    { name: 'Micah', ch: 7, t: 'ot' }, { name: 'Nahum', ch: 3, t: 'ot' },
    { name: 'Habakkuk', ch: 3, t: 'ot' }, { name: 'Zephaniah', ch: 3, t: 'ot' },
    { name: 'Haggai', ch: 2, t: 'ot' }, { name: 'Zechariah', ch: 14, t: 'ot' },
    { name: 'Malachi', ch: 4, t: 'ot' },
    { name: 'Matthew', ch: 28, t: 'nt' }, { name: 'Mark', ch: 16, t: 'nt' },
    { name: 'Luke', ch: 24, t: 'nt' }, { name: 'John', ch: 21, t: 'nt' },
    { name: 'Acts', ch: 28, t: 'nt' }, { name: 'Romans', ch: 16, t: 'nt' },
    { name: '1 Corinthians', ch: 16, t: 'nt' }, { name: '2 Corinthians', ch: 13, t: 'nt' },
    { name: 'Galatians', ch: 6, t: 'nt' }, { name: 'Ephesians', ch: 6, t: 'nt' },
    { name: 'Philippians', ch: 4, t: 'nt' }, { name: 'Colossians', ch: 4, t: 'nt' },
    { name: '1 Thessalonians', ch: 5, t: 'nt' }, { name: '2 Thessalonians', ch: 3, t: 'nt' },
    { name: '1 Timothy', ch: 6, t: 'nt' }, { name: '2 Timothy', ch: 4, t: 'nt' },
    { name: 'Titus', ch: 3, t: 'nt' }, { name: 'Philemon', ch: 1, t: 'nt' },
    { name: 'Hebrews', ch: 13, t: 'nt' }, { name: 'James', ch: 5, t: 'nt' },
    { name: '1 Peter', ch: 5, t: 'nt' }, { name: '2 Peter', ch: 3, t: 'nt' },
    { name: '1 John', ch: 5, t: 'nt' }, { name: '2 John', ch: 1, t: 'nt' },
    { name: '3 John', ch: 1, t: 'nt' }, { name: 'Jude', ch: 1, t: 'nt' },
    { name: 'Revelation', ch: 22, t: 'nt' },
  ];

  // Book content cache: id → full row
  var _bookCache = {};

  async function _renderLibrary() {
    _panel(_spinner());
    try {
      var rows = [];
      try {
        if (typeof TheVine !== 'undefined' && TheVine.app && TheVine.app.books) {
          var res = await _withTimeout(TheVine.app.books());
          rows = Array.isArray(res) ? res : _rows(res);
        }
      } catch (_) {}

      if (!rows.length) {
        // Fallback: load from static books-of-the-bible.js bundle
        try {
          var bmod = await import('../Data/books-of-the-bible.js');
          var bdata = bmod.default || [];
          if (bdata.length) {
            rows = bdata.map(function(b) {
              return {
                id:                    b.bookName,
                'Book Name':           b.bookName,
                'Author':              b.author,
                'Testament':           b.testament,
                'Genre':               b.genre,
                'Summary':             b.summary,
                'Core Theology':       b.christInBook,
                'Practical Application': b.application,
                'Key Verse':           b.keyVerse,
                'Themes':              b.themes,
                'Time Period':         b.timePeriod,
                booknum:               b.order,
              };
            });
          }
        } catch (_) {}
      }

      if (!rows.length) {
        // Last resort: static chapter-link grid (no rich data)
        var html = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">';
        html += '<input type="text" placeholder="Search books\u2026" '
              + 'oninput="TheWay._filterPanel(\'lib\',this.value)" '
              + 'style="flex:1;min-width:200px;padding:8px 12px;border:1px solid var(--line);border-radius:6px;'
              + 'background:var(--bg-raised);color:var(--ink);font-size:max(0.88rem,16px);font-family:inherit;">';
        html += '<button onclick="TheWay._libTestament(\'all\',this)" class="tw-lib-filter active" '
              + 'style="padding:6px 12px;border:1px solid var(--line);border-radius:6px;cursor:pointer;font-size:0.8rem;'
              + 'background:var(--accent);color:var(--ink-inverse);font-family:inherit;">All 66</button>';
        html += '<button onclick="TheWay._libTestament(\'ot\',this)" class="tw-lib-filter" '
              + 'style="padding:6px 12px;border:1px solid var(--line);border-radius:6px;cursor:pointer;font-size:0.8rem;'
              + 'background:transparent;color:var(--ink);font-family:inherit;">Old Testament</button>';
        html += '<button onclick="TheWay._libTestament(\'nt\',this)" class="tw-lib-filter" '
              + 'style="padding:6px 12px;border:1px solid var(--line);border-radius:6px;cursor:pointer;font-size:0.8rem;'
              + 'background:transparent;color:var(--ink);font-family:inherit;">New Testament</button>';
        html += '</div>';
        html += '<div id="lib-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;">';
        _BIBLE_BOOKS.forEach(function(book) {
          var searchText = book.name.toLowerCase();
          html += '<details class="browse-item" data-search="' + _e(searchText) + '" data-testament="' + book.t + '" '
                + 'style="border:1px solid var(--line);border-radius:8px;overflow:hidden;">';
          html += '<summary style="padding:8px 12px;background:var(--bg-raised);cursor:pointer;font-size:0.85rem;font-weight:600;">'
                + _e(book.name) + ' <span style="font-size:0.7rem;color:var(--ink-muted);">(' + book.ch + ' ch)</span></summary>';
          html += '<div style="padding:8px 12px;display:flex;gap:4px;flex-wrap:wrap;">';
          for (var c = 1; c <= book.ch; c++) {
            html += '<a href="https://www.bible.com/bible/59/' + _e(book.name.replace(/ /g, '').substring(0, 3).toUpperCase())
                  + '.' + c + '.ESV" target="_blank" rel="noopener" '
                  + 'style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;'
                  + 'border-radius:4px;font-size:0.72rem;border:1px solid var(--line);color:var(--accent);text-decoration:none;"'
                  + ' onmouseover="this.style.background=\'var(--accent-soft)\'" onmouseout="this.style.background=\'transparent\'">'
                  + c + '</a>';
          }
          html += '</div></details>';
        });
        html += '</div>';
        _panel(html);
        return;
      }

      // Sort by booknum
      rows.sort(function(a, b) { return (a.booknum || 0) - (b.booknum || 0); });

      // Cache all rows by id
      rows.forEach(function(r) { if (r.id) _bookCache[r.id] = r; });

      // Inject explorer styles once
      if (!document.getElementById('tw-lib-style')) {
        var s = document.createElement('style'); s.id = 'tw-lib-style';
        s.textContent = '.tw-lib-explorer{display:grid;grid-template-columns:220px 1fr;gap:0;min-height:520px;border:1px solid var(--line);border-radius:10px;overflow:hidden;}'
          + '@media(max-width:680px){.tw-lib-explorer{grid-template-columns:1fr;}}'
          + '.tw-lib-sidebar{background:var(--bg-raised);border-right:1px solid var(--line);overflow-y:auto;display:flex;flex-direction:column;}'
          + '.tw-lib-filter-row{display:flex;gap:4px;padding:8px;}'
          + '.tw-lib-filter{flex:1;padding:5px 0;border:1px solid var(--line);border-radius:6px;cursor:pointer;font-size:0.72rem;font-weight:700;background:transparent;color:var(--ink-muted);font-family:inherit;transition:all 0.15s;}'
          + '.tw-lib-filter.active{background:var(--accent);color:var(--ink-inverse);border-color:var(--accent);}'
          + '.tw-lib-search{padding:0 8px 8px;}'
          + '.tw-lib-search input{width:100%;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font-size:0.82rem;font-family:inherit;box-sizing:border-box;}'
          + '.tw-lib-list{flex:1;overflow-y:auto;}'
          + '.tw-lib-item{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;cursor:pointer;border-left:3px solid transparent;font-size:0.84rem;color:var(--ink);transition:all 0.15s;}'
          + '.tw-lib-item:hover{background:var(--bg-sunken);border-left-color:var(--accent);}'
          + '.tw-lib-item.active{background:var(--accent-soft);border-left-color:var(--accent);color:var(--accent);font-weight:600;}'
          + '.tw-lib-tag{font-size:0.68rem;padding:2px 6px;border-radius:4px;background:var(--bg-sunken);color:var(--ink-muted);}'
          + '.tw-lib-detail{overflow-y:auto;padding:20px;}'
          + '.tw-lib-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;color:var(--ink-muted);text-align:center;padding:20px;}'
          + '.tw-lib-tab-bar{display:flex;border-bottom:1px solid var(--line);margin-bottom:20px;}'
          + '.tw-lib-tab{padding:7px 16px;border:none;border-bottom:2px solid transparent;cursor:pointer;font-size:0.85rem;font-weight:600;background:transparent;color:var(--ink-muted);font-family:inherit;}'
          + '.tw-lib-tab.active{border-bottom-color:var(--accent);color:var(--ink);}';
        document.head.appendChild(s);
      }

      var html = '';
      html += '<div class="tw-lib-explorer">';

      // ── Left sidebar ──
      html += '<div class="tw-lib-sidebar">';
      html += '<div class="tw-lib-filter-row">';
      html += '<button id="lib-btn-all" onclick="TheWay._libFilter(\'all\',this)" class="tw-lib-filter active">All 66</button>';
      html += '<button id="lib-btn-ot" onclick="TheWay._libFilter(\'Old\',this)" class="tw-lib-filter">OT</button>';
      html += '<button id="lib-btn-nt" onclick="TheWay._libFilter(\'New\',this)" class="tw-lib-filter">NT</button>';
      html += '</div>';
      html += '<div class="tw-lib-search">';
      html += '<input type="text" placeholder="\uD83D\uDD0D Search\u2026" id="lib-search" autocomplete="off" oninput="TheWay._libSearch(this.value)">';
      html += '</div>';
      html += '<div id="lib-list" class="tw-lib-list">';
      rows.forEach(function(book) {
        var id    = book.id || '';
        var name  = book['Book Name'] || book.title || id;
        var test  = book['Testament'] || '';
        var genre = book['Genre'] || '';
        html += '<div class="tw-lib-item lib-book-item" data-id="' + _e(id) + '" data-testament="' + _e(test) + '" '
              + 'data-search="' + _e(name.toLowerCase()) + '" '
              + 'onclick="TheWay._openBook(this,\'' + _e(id) + '\')">';
        html += '<span>' + _e(name) + '</span>';
        if (genre) html += '<span class="tw-lib-tag">' + _e(_shortGenre(genre)) + '</span>';
        html += '</div>';
      });
      html += '</div></div>'; // end sidebar

      // ── Right detail pane ──
      html += '<div id="lib-detail" class="tw-lib-detail">';
      html += '<div class="tw-lib-empty">';
      html += '<div style="font-size:2.5rem;margin-bottom:12px;">&#10013;</div>';
      html += '<div style="font-size:1rem;font-weight:600;margin-bottom:6px;">Select a book</div>';
      html += '<div style="font-size:0.85rem;">Choose a book from the list to explore its summary, theology, and practical application.</div>';
      html += '</div></div>';

      html += '</div>'; // end explorer
      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  function _shortGenre(g) {
    if (!g) return g;
    var m = g.match(/\(([^)]+)\)/);
    var s = m ? m[1] : g;
    return s.replace(/^The /, '');
  }

  export function _libFilter(testament, btn) {
    document.querySelectorAll('.tw-lib-filter').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    document.querySelectorAll('#lib-list .lib-book-item').forEach(function(el) {
      var match = testament === 'all' || el.dataset.testament === testament;
      el.style.display = match ? '' : 'none';
    });
  }

  export function _libSearch(q) {
    q = (q || '').toLowerCase().trim();
    document.querySelectorAll('#lib-list .lib-book-item').forEach(function(el) {
      el.style.display = (!q || (el.dataset.search || '').indexOf(q) !== -1) ? '' : 'none';
    });
  }

  export function _openBook(rowEl, id) {
    var detailEl = document.getElementById('lib-detail');
    if (!detailEl) return;

    // Mark active
    document.querySelectorAll('#lib-list .lib-book-item').forEach(function(el) {
      el.classList.remove('active');
    });
    if (rowEl) rowEl.classList.add('active');

    var book = _bookCache[id];
    if (!book) {
      detailEl.innerHTML = '<div style="padding:20px;color:var(--danger,#c0392b);">Book not found.</div>';
      return;
    }

    var name      = book['Book Name'] || id;
    var author    = book['Author'] || '';
    var test      = book['Testament'] || '';
    var genre     = book['Genre'] || '';
    var summary   = book['Summary'] || '';
    var theology  = book['Core Theology'] || '';
    var practical = book['Practical Application'] || '';
    var keyVerse  = book['Key Verse'] || '';
    var themes    = book['Themes'] || '';
    var timePeriod= book['Time Period'] || '';

    var b = '<div style="max-width:700px;">';

    // Header
    b += '<div style="margin-bottom:20px;">';
    b += '<h2 style="font-size:1.5rem;font-weight:800;margin:0 0 4px;">' + _e(name) + '</h2>';
    b += '<div style="font-size:0.8rem;color:var(--ink-muted);display:flex;gap:12px;flex-wrap:wrap;">';
    if (author)     b += '<span>&#9997; ' + _e(author) + '</span>';
    if (test)       b += '<span>' + _e(test) + ' Testament</span>';
    if (genre)      b += '<span style="color:var(--accent);">' + _e(_shortGenre(genre)) + '</span>';
    if (timePeriod) b += '<span>&#128336; ' + _e(timePeriod) + '</span>';
    b += '</div>';
    if (keyVerse) {
      b += '<blockquote style="margin:12px 0 0;padding:10px 14px;border-left:3px solid var(--accent);'
         + 'background:var(--bg-raised);border-radius:0 6px 6px 0;font-size:0.85rem;color:var(--ink-muted);font-style:italic;">'
         + _e(keyVerse) + '</blockquote>';
    }
    b += '</div>';

    // Tab bar (only show tabs that have content)
    var firstTab = summary ? 'summary' : (theology ? 'theology' : 'practical');
    var tabs = [];
    if (summary)  tabs.push({id:'summary',   label:'Summary'});
    if (themes)   tabs.push({id:'themes',    label:'Themes'});
    if (theology) tabs.push({id:'theology',  label:'Christ in This Book'});
    if (practical)tabs.push({id:'practical', label:'Application'});
    if (tabs.length) {
      b += '<div class="tw-lib-tab-bar">';
      tabs.forEach(function(tab, i) {
        b += '<button class="tw-lib-tab' + (i === 0 ? ' active' : '') + '" id="lib-tab-' + tab.id + '" '
           + 'onclick="TheWay._libTab(\'' + _e(id) + '\',\'' + tab.id + '\')">' + tab.label + '</button>';
      });
      b += '</div>';

      // Content panels
      var prose = 'font-size:0.9rem;line-height:1.75;color:var(--ink);white-space:pre-wrap;';
      if (summary)  b += '<div id="lib-panel-summary"   style="' + prose + '">' + _e(summary)   + '</div>';
      if (themes)   b += '<div id="lib-panel-themes"    style="' + prose + 'display:none;">' + _e(themes) + '</div>';
      if (theology) b += '<div id="lib-panel-theology"  style="' + prose + 'display:none;">' + _e(theology)  + '</div>';
      if (practical)b += '<div id="lib-panel-practical" style="' + prose + 'display:none;">' + _e(practical) + '</div>';
    } else {
      b += '<div style="color:var(--ink-muted);font-size:0.9rem;">No additional content available for this book.</div>';
    }

    b += '</div>';
    detailEl.innerHTML = b;
  }

  export function _libTab(id, tab) {
    ['summary', 'themes', 'theology', 'practical'].forEach(function(t) {
      var panel = document.getElementById('lib-panel-' + t);
      var btn   = document.getElementById('lib-tab-' + t);
      if (panel) panel.style.display = t === tab ? '' : 'none';
      if (btn)   btn.classList.toggle('active', t === tab);
    });
  }

  // Keep _libTestament as alias so existing references don't break
  export function _libTestament(t, btn) { _libFilter(t === 'ot' ? 'Old' : t === 'nt' ? 'New' : 'all', btn); }

  // ══════════════════════════════════════════════════════════════════════════
  // 9. DEVOTIONALS — Daily devotionals
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderDevotionals() {
    _panel(_spinner());
    try {
      // Check live bundle (written by TheTruth after Firestore edits) before
      // falling back to the static snapshot bundled at deploy time.
      var live = (typeof TheTruth !== 'undefined') ? TheTruth.liveBundle('devotionals') : null;
      var devos;
      if (live) {
        devos = live;
      } else {
        var mod  = await import('../Data/devotionals.js');
        devos = mod.default || [];
      }

      if (!devos.length) {
        _panel(_empty('\u2601', 'No devotionals yet', 'Run export_devotionals_to_js.py to refresh the bundle.'));
        return;
      }

      // Bundle is sorted ascending by date; show newest first
      devos = devos.slice().sort(function(a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });

      var html = '<div style="margin-bottom:12px;">';
      html += '<input type="text" placeholder="Search devotionals\u2026" '
            + 'oninput="TheWay._filterPanel(\'devo\',this.value)" '
            + 'style="width:100%;max-width:400px;padding:8px 12px;border:1px solid var(--line);border-radius:6px;'
            + 'background:var(--bg-raised);color:var(--ink);font-size:max(0.88rem,16px);font-family:inherit;"></div>';

      html += '<div id="devo-grid">';
      devos.forEach(function(d) {
        var title = d.title || d['Title'] || 'Devotional';
        var date = d.date || d['Date'] || '';
        var theme = d.theme || d['Theme'] || '';
        var verse = d.scripture || d.scriptureRef || d['Scripture'] || '';
        var reflection = d.reflection || d['Reflection'] || '';
        var question = d.question || d['Question'] || '';
        var prayer = d.prayer || d['Prayer'] || '';
        var searchText = (title + ' ' + theme + ' ' + reflection + ' ' + verse + ' ' + question + ' ' + prayer).toLowerCase();

        html += '<details class="browse-item" data-search="' + _e(searchText) + '" '
              + 'style="margin-bottom:8px;border:1px solid var(--line);border-radius:8px;overflow:hidden;">';
        html += '<summary style="padding:12px 16px;background:var(--bg-raised);cursor:pointer;'
              + 'display:flex;align-items:center;gap:8px;">'
              + '<span style="font-weight:700;font-size:0.88rem;flex:1;">' + _e(title) + '</span>';
        if (theme) html += '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;'
              + 'background:var(--lilac-soft,var(--bg-sunken));color:var(--lilac,var(--ink-muted));">' + _e(theme) + '</span>';
        if (date) html += '<span style="font-size:0.72rem;color:var(--ink-muted);">' + _e(date) + '</span>';
        html += '</summary>';
        html += '<div style="padding:14px 16px;">';
        if (verse) html += '<div style="margin-bottom:10px;">' + _bibleLink(verse) + '</div>';
        if (reflection) html += '<div style="font-size:0.85rem;line-height:1.65;color:var(--ink);margin-bottom:10px;">' + _e(reflection) + '</div>';
        if (question) html += '<div style="background:var(--accent-soft);border-radius:6px;padding:10px 14px;'
              + 'margin-bottom:10px;font-size:0.84rem;color:var(--accent);line-height:1.5;">'
              + '<strong>Reflect:</strong> ' + _e(question) + '</div>';
        if (prayer) html += '<div style="background:var(--mint-soft,var(--bg-sunken));border-radius:6px;padding:10px 14px;'
              + 'font-size:0.84rem;color:var(--mint,var(--ink-muted));line-height:1.5;font-style:italic;">'
              + '\uD83D\uDE4F ' + _e(prayer) + '</div>';
        html += '</div></details>';
      });
      html += '</div>';

      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 10. APOLOGETICS — Q&A defence of the faith (static bundle, zero Firestore reads)
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderApologetics() {
    _panel(_spinner());
    try {
      // Load from local static bundle — re-export with:
      //   python "Architechtural Docs/New Covenant/Automation/Shepherds/export_apologetics_to_js.py"
      var mod  = await import('../Data/apologetics.js');
      var data = mod.default || [];

      if (!data.length) {
        _panel(_empty('\u2696', 'No apologetics content yet', 'Apologetics Q&A will appear here.'));
        return;
      }

      // Group by category; data is sorted by categoryTitle + shortTitle from export script
      var cats = {};
      var catOrder = [];
      data.forEach(function(r) {
        var cat   = r.categoryTitle || 'General';
        var color = r.categoryColor || '#6366f1';
        var intro = r.categoryIntro || '';
        if (!cats[cat]) { cats[cat] = { color: color, intro: intro, items: [] }; catOrder.push(cat); }
        cats[cat].items.push(r);
      });

      var html = '<div style="margin-bottom:12px;">';
      html += '<input type="text" placeholder="Search apologetics\u2026" '
            + 'oninput="TheWay._filterPanel(\'apol\',this.value)" '
            + 'style="width:100%;max-width:400px;padding:8px 12px;border:1px solid var(--line);border-radius:6px;'
            + 'background:var(--bg-raised);color:var(--ink);font-size:max(0.88rem,16px);font-family:inherit;"></div>';

      html += '<div id="apol-grid">';
      catOrder.forEach(function(cat) {
        var grp = cats[cat];
        var searchText = (cat + ' ' + grp.intro + ' ' + grp.items.map(function(q) {
          return (q.questionTitle || q.shortTitle || '') + ' ' + (q.answerContent || '');
        }).join(' ')).toLowerCase();

        html += '<details class="browse-item" data-search="' + _e(searchText) + '" '
              + 'style="margin-bottom:8px;border:1px solid var(--line);border-radius:8px;overflow:hidden;">';
        html += '<summary style="padding:12px 16px;background:var(--bg-raised);cursor:pointer;'
              + 'font-weight:700;font-size:0.88rem;border-left:4px solid ' + _e(grp.color) + ';">'
              + _e(cat) + ' <span style="font-size:0.75rem;color:var(--ink-muted);">(' + grp.items.length + ')</span></summary>';
        html += '<div style="padding:14px 16px;">';
        if (grp.intro) {
          html += '<div style="background:var(--lilac-soft);border-radius:6px;padding:10px 14px;'
                + 'margin-bottom:12px;font-size:0.82rem;color:var(--lilac);">' + _e(grp.intro) + '</div>';
        }
        grp.items.forEach(function(q) {
          var title = q.questionTitle || q.shortTitle || 'Question';
          html += '<div style="padding:10px 0;border-bottom:1px solid var(--line);">';
          html += '<div style="font-weight:600;font-size:0.85rem;margin-bottom:4px;">' + _e(title) + '</div>';
          if (q.answerContent) html += '<div style="font-size:0.82rem;color:var(--ink-muted);line-height:1.6;">' + _e(q.answerContent) + '</div>';
          if (q.quoteText) {
            html += '<blockquote style="margin:8px 0 0;padding:8px 14px;border-left:3px solid var(--gold);'
                  + 'font-style:italic;color:var(--gold);">' + _e(q.quoteText) + '</blockquote>';
          }
          if (q.referenceText) {
            var ref = q.referenceUrl
              ? '<a href="' + _e(q.referenceUrl) + '" target="_blank" rel="noopener" style="color:var(--link);">' + _e(q.referenceText) + '</a>'
              : _bibleLink(q.referenceText);
            html += '<div style="font-size:0.78rem;color:var(--ink-muted);margin-top:6px;">' + ref + '</div>';
          }
          html += '</div>';
        });
        html += '</div></details>';
      });
      html += '</div>';

      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PSALMS — Browse all 150 psalms by theme or numeric order
  // Data: New_Covenant/Data/psalms.js (static bundle — zero Firestore reads)
  // Re-generate: python "Architechtural Docs/New Covenant/Automation/Shepherds/convert_psalms_to_js.py"
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderPsalms() {
    _panel(_spinner());
    try {
      var mod  = await import('../Data/psalms.js');
      var data = mod.default || {};
      var byNumber = data.byNumber || [];
      var byTheme  = data.byTheme  || [];

      if (!byNumber.length) {
        _panel(_empty('\uD83C\uDFB5', 'Psalms not loaded', 'Run convert_psalms_to_js.py to generate the data bundle.'));
        return;
      }

      var VIEW_KEY = '_psalmsView';
      window[VIEW_KEY] = window[VIEW_KEY] || 'theme';

      function _buildPsalmsHtml(view) {
        window[VIEW_KEY] = view;
        var html = '<div style="margin-bottom:14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">';
        html += '<button onclick="TheWay._psalmsView(\'theme\')" '
              + 'style="padding:6px 14px;border-radius:20px;border:1px solid var(--line);cursor:pointer;font-size:0.82rem;font-family:inherit;'
              + (view === 'theme' ? 'background:var(--accent);color:var(--ink-inverse);font-weight:700;' : 'background:var(--bg-raised);color:var(--ink);')
              + '">By Theme</button>';
        html += '<button onclick="TheWay._psalmsView(\'number\')" '
              + 'style="padding:6px 14px;border-radius:20px;border:1px solid var(--line);cursor:pointer;font-size:0.82rem;font-family:inherit;'
              + (view === 'number' ? 'background:var(--accent);color:var(--ink-inverse);font-weight:700;' : 'background:var(--bg-raised);color:var(--ink);')
              + '">By Number</button>';
        html += '<input type="text" id="psalms-search" placeholder="Search psalms\u2026" '
              + 'oninput="TheWay._filterPanel(\'psalms\',this.value)" '
              + 'style="margin-left:auto;padding:6px 12px;border:1px solid var(--line);border-radius:6px;'
              + 'background:var(--bg-raised);color:var(--ink);font-size:max(0.85rem,16px);font-family:inherit;min-width:180px;">';
        html += '</div>';

        html += '<div id="psalms-grid">';
        if (view === 'theme') {
          // Theme-type colors
          var THEME_COLORS = {
            'Praise': '#f59e0b', 'Lament': '#6b7280', 'Thanksgiving': '#10b981',
            'Trust': '#3b82f6', 'Messianic': '#8b5cf6', 'Wisdom': '#84cc16',
            'Imprecatory': '#ef4444', 'Royal': '#f97316', 'Pilgrimage': '#06b6d4',
            'Creation': '#22c55e', 'Penitential': '#ec4899'
          };
          function _themeColor(t) {
            for (var k in THEME_COLORS) { if (t.indexOf(k) !== -1) return THEME_COLORS[k]; }
            return '#6366f1';
          }
          byTheme.forEach(function(section) {
            var color = _themeColor(section.theme);
            var searchText = (section.theme + ' ' + (section.intro || '') + ' ' +
              section.psalms.map(function(p) { return p.number + ' ' + p.title; }).join(' ')).toLowerCase();
            html += '<details class="browse-item" data-search="' + _e(searchText) + '" '
                  + 'style="margin-bottom:8px;border:1px solid var(--line);border-radius:8px;overflow:hidden;">';
            html += '<summary style="padding:12px 16px;background:var(--bg-raised);cursor:pointer;'
                  + 'font-weight:700;font-size:0.88rem;border-left:4px solid ' + color + ';display:flex;align-items:center;gap:8px;">'
                  + _e(section.theme)
                  + ' <span style="font-size:0.75rem;color:var(--ink-muted);font-weight:400;">(\u00d7' + section.psalms.length + ')</span></summary>';
            html += '<div style="padding:14px 16px;">';
            if (section.intro) {
              html += '<div style="background:var(--bg-raised);border-radius:6px;padding:8px 12px;'
                    + 'margin-bottom:12px;font-size:0.8rem;font-style:italic;color:var(--ink-muted);">' + _e(section.intro) + '</div>';
            }
            // Psalm chips
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">';
            section.psalms.forEach(function(p) {
              html += '<span style="display:inline-block;padding:3px 10px;border-radius:12px;'
                    + 'background:' + color + '22;border:1px solid ' + color + '55;'
                    + 'font-size:0.78rem;font-weight:600;color:var(--ink);cursor:default;" '
                    + 'title="' + _e(p.title) + '">\u00b6 ' + p.display + '</span>';
            });
            html += '</div>';
            // Full psalm list
            section.psalms.forEach(function(p) {
              html += '<div style="padding:6px 0;border-top:1px solid var(--line);display:flex;gap:8px;align-items:baseline;">';
              html += '<span style="font-weight:700;font-size:0.8rem;min-width:40px;color:' + color + ';">\u00b6 ' + p.display + '</span>';
              html += '<span style="font-size:0.82rem;color:var(--ink-muted);">' + _e(p.title) + '</span>';
              html += '</div>';
            });
            html += '</div></details>';
          });
        } else {
          // Numeric view
          var TYPE_COLORS = {
            'Praise': '#f59e0b', 'Lament': '#6b7280', 'Thanksgiving': '#10b981',
            'Trust': '#3b82f6', 'Messianic': '#8b5cf6', 'Wisdom': '#84cc16',
            'Imprecatory': '#ef4444', 'Royal': '#f97316', 'Pilgrimage': '#06b6d4',
            'Creation': '#22c55e', 'Penitential': '#ec4899'
          };
          function _typeColor(t) {
            for (var k in TYPE_COLORS) { if (t && t.indexOf(k) !== -1) return TYPE_COLORS[k]; }
            return '#6366f1';
          }
          byNumber.forEach(function(p) {
            var searchText = (p.number + ' ' + p.display + ' ' + p.types.join(' ') + ' ' + p.title).toLowerCase();
            html += '<div class="browse-item" data-search="' + _e(searchText) + '" '
                  + 'style="padding:10px 14px;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;">';
            html += '<span style="font-weight:700;font-size:0.85rem;min-width:70px;color:var(--accent);">'
                  + 'Psalm ' + _e(p.display) + '</span>';
            html += '<span style="font-size:0.85rem;flex:1;">' + _e(p.title) + '</span>';
            var typeHtml = p.types.map(function(t) {
              var c = _typeColor(t);
              return '<span style="font-size:0.72rem;padding:2px 7px;border-radius:10px;'
                   + 'background:' + c + '22;border:1px solid ' + c + '55;color:var(--ink);white-space:nowrap;">' + _e(t) + '</span>';
            }).join('');
            if (typeHtml) html += '<span style="display:flex;gap:4px;flex-wrap:wrap;">' + typeHtml + '</span>';
            html += '</div>';
          });
        }
        html += '</div>';
        return html;
      }

      _panel(_buildPsalmsHtml(window[VIEW_KEY]));

      // Store for view-switch callbacks
      window['_psalmsData'] = data;
      window['_buildPsalmsHtml'] = _buildPsalmsHtml;

    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  export function _psalmsView(view) {
    var fn = window['_buildPsalmsHtml'];
    if (fn) _panel(fn(view));
    var s = document.getElementById('psalms-search');
    if (s) s.value = '';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 11. COUNSELING — Biblical counseling resources (lazy-load per card)
  // ══════════════════════════════════════════════════════════════════════════

  // Cache: id → full doc data (populated on first card open)
  var _counselCache = {};

  async function _renderCounseling() {
    _panel(_spinner());
    try {
      // Check live bundle (written by TheTruth after Firestore edits) first.
      var live = (typeof TheTruth !== 'undefined') ? TheTruth.liveBundle('counseling') : null;
      var allDocs;
      if (live && live.length) {
        allDocs = live;
      } else {
        var mod  = await import('../../Data/counseling.js');
        allDocs = mod.default || [];
      }

      if (!allDocs.length) {
        _panel(_empty('\u2695', 'Counseling resources coming soon', 'Run export_counseling_to_js.py to refresh the bundle.'));
        return;
      }

      // Pre-populate the lazy-fetch cache with the full docs from the bundle
      allDocs.forEach(function(d) { _counselCache[d._id || d.id || ''] = d; });

      var stubs = allDocs.map(function(d) {
        return {
          id:    d._id || d.id || '',
          title: d.title || d['Title'] || d._id || '',
          icon:  d.icon  || d['Icon']  || '\u2695',
          color: d.color || d['Color'] || 'var(--mint)',
        };
      });

      // ── Hero header ──
      var html = '';
      html += '<div class="coun-hero">';
      html += '<div class="coun-hero-inner">';
      html += '<div style="font-size:2rem;margin-bottom:6px;">\u2695</div>';
      html += '<h2 class="coun-hero-title">Biblical Counseling</h2>';
      html += '<p class="coun-hero-sub">Compassionate, Scripture-centered guidance for every season of life.<br>Rooted in God\u2019s Word. Anchored in His promises.</p>';
      html += '</div></div>';

      // ── Search ──
      html += '<div style="margin:18px 0 14px;">';
      html += '<input type="text" placeholder="\uD83D\uDD0D Search topics\u2026" '
            + 'oninput="TheWay._filterPanel(\'counsel\',this.value)" '
            + 'style="width:100%;max-width:480px;padding:11px 14px 11px 14px;border:1px solid var(--line);border-radius:10px;'
            + 'background:var(--bg-raised);color:var(--ink);font-size:max(0.9rem,16px);font-family:inherit;"></div>';

      // ── Topic count ──
      html += '<div style="font-size:0.78rem;color:var(--ink-muted);margin-bottom:16px;">' + stubs.length + ' topics available</div>';

      // ── Card grid — stub cards only ──
      html += '<div id="counsel-grid" class="coun-grid">';

      stubs.forEach(function(stub) {
        var id    = stub.id || '';
        var title = stub.title || stub['Title'] || 'Topic';
        var icon  = stub.icon  || stub['Icon']  || '\u2695';
        var color = stub.color || stub['Color'] || 'var(--mint)';

        html += '<div class="browse-item coun-card" data-search="' + _e(title.toLowerCase()) + '" data-cid="' + _e(id) + '">';
        html += '<div class="coun-card-head" style="border-top:3px solid ' + _e(color) + ';" '
              + 'onclick="TheWay._openCounselCard(this,\'' + _e(id) + '\')" style="cursor:pointer;">';
        html += '<div class="coun-card-icon" style="background:' + _e(color) + '22;color:' + _e(color) + ';">' + icon + '</div>';
        html += '<h3 class="coun-card-title">' + _e(title) + '</h3>';
        html += '<div class="coun-card-chevron" style="margin-left:auto;font-size:0.75rem;color:var(--ink-muted);">&#9660;</div>';
        html += '</div>';
        // Detail area — populated on first open
        html += '<div class="coun-card-body" id="coun-body-' + _e(id) + '" style="display:none;"></div>';
        html += '</div>';
      });

      html += '</div>';
      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  // Called when a card header is clicked; lazily fetches and renders full content
  export async function _openCounselCard(headEl, id) {
    var bodyEl = document.getElementById('coun-body-' + id);
    if (!bodyEl) return;

    // Toggle if already populated
    if (bodyEl.style.display !== 'none') {
      bodyEl.style.display = 'none';
      var chev = headEl.querySelector('.coun-card-chevron');
      if (chev) chev.innerHTML = '&#9660;';
      return;
    }

    // Show chevron-up
    var chev = headEl.querySelector('.coun-card-chevron');
    if (chev) chev.innerHTML = '&#9650;';

    // Full doc is already in _counselCache (pre-loaded from static bundle)

    var item = _counselCache[id];
    if (!item) {
      bodyEl.innerHTML = '<div style="padding:12px;color:var(--err,#c0392b);font-size:0.85rem;">Could not load content.</div>';
      bodyEl.style.display = 'block';
      return;
    }

    // ── Parse helpers (scoped here so they don't pollute the outer closure) ──
    function parseScriptures(raw) {
      if (!raw) return [];
      var parts = raw.split(/(?=(?:[123]?\s?[A-Z][a-z]+\s+\d+:\d+))/g);
      var out = [];
      parts.forEach(function(p) {
        p = p.trim(); if (!p) return;
        var m = p.match(/^([123]?\s?[A-Za-z]+\s+\d+:\d+(?:-\d+)?):?\s*(.*)/s);
        if (m) { out.push({ ref: m[1].trim(), text: m[2].replace(/[.;,\s]+$/, '').trim() }); }
        else   { out.push({ ref: '', text: p.replace(/[.;,\s]+$/, '').trim() }); }
      });
      return out;
    }
    function parseSteps(raw) {
      if (!raw) return [];
      return raw.split(/[;\n]+/).map(function(s) { return s.trim(); }).filter(Boolean);
    }
    function linkifyStep(text) {
      return text.replace(/\(([123]?\s?[A-Za-z]+\s+\d+:\d+(?:-\d+)?)\)/g, function(_, ref) {
        return '(' + _bibleLink(ref) + ')';
      });
    }

    var color      = item['Color'] || item.color || 'var(--mint)';
    var definition = item['Definition'] || item.definition || '';
    var scriptures = parseScriptures(item['Scriptures'] || item.scriptures || '');
    var steps      = parseSteps(item['Steps'] || item.steps || '');

    var b = '';
    if (definition) {
      b += '<div class="coun-definition">' + _e(definition) + '</div>';
    }
    if (scriptures.length) {
      b += '<div class="coun-section">';
      b += '<div class="coun-section-label" style="color:var(--gold,#d4b870);"><span>&#128214;</span> Scripture Foundation</div>';
      scriptures.forEach(function(s) {
        b += '<div class="coun-verse">';
        if (s.ref) b += '<div class="coun-verse-ref">' + _bibleLink(s.ref) + '</div>';
        if (s.text) b += '<div class="coun-verse-text">\u201C' + _e(s.text) + '\u201D</div>';
        b += '</div>';
      });
      b += '</div>';
    }
    if (steps.length) {
      b += '<div class="coun-section">';
      b += '<div class="coun-section-label" style="color:var(--mint,#8cc5a2);"><span>&#128161;</span> Faith Response Steps</div>';
      b += '<ol class="coun-steps">';
      steps.forEach(function(s, i) {
        b += '<li class="coun-step">';
        b += '<span class="coun-step-num" style="background:' + _e(color) + '18;color:' + _e(color) + ';">' + (i + 1) + '</span>';
        b += '<span class="coun-step-text">' + linkifyStep(_e(s)) + '</span>';
        b += '</li>';
      });
      b += '</ol></div>';
    }

    bodyEl.innerHTML = b || '<div style="padding:12px;color:var(--ink-muted);font-size:0.85rem;">No details available.</div>';
    bodyEl.style.display = 'block';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 12. HEART CHECK — Spiritual vitality diagnostic
  // ══════════════════════════════════════════════════════════════════════════

  var _heartRows = [];
  var _heartAnswers = {};

  async function _renderHeart() {
    _panel(_spinner());
    try {
      var raw = await _withTimeout(_isFB() && typeof UpperRoom !== 'undefined' ? UpperRoom.listAppContent('heart') : TheVine.app.heart());
      var rows = Array.isArray(raw) ? raw : _rows(raw);
      if (!rows.length) { _panel(_empty('\u2764', 'No questions yet', 'Add diagnostic questions in the Matthew spreadsheet.')); return; }

      _heartRows = rows;
      _heartAnswers = {};

      var html = '';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
      html += '<div><h3 style="margin:0;font-size:1rem;font-weight:700;">Heart Condition Diagnostic</h3>';
      html += '<p style="margin:4px 0 0;font-size:0.82rem;color:var(--ink-muted);">A biblical counseling tool to assess your spiritual vitality.</p></div>';
      html += '</div>';

      // 2-column layout: questionnaire + vitality panel
      html += '<div style="display:grid;grid-template-columns:1fr 280px;gap:16px;">';

      // Column 1: Questionnaire
      html += '<div style="max-height:600px;overflow-y:auto;padding-right:4px;">';
      rows.forEach(function(item, idx) {
        var qid = item['Question ID'] || ('hq_' + idx);
        item['Question ID'] = qid;
        html += '<div id="tw-hcard-' + _e(qid) + '" style="background:var(--bg-raised);border:1px solid var(--line);'
              + 'border-radius:8px;padding:12px;margin-bottom:8px;transition:border-color 0.3s;">';
        html += '<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;'
              + 'color:var(--accent);margin-bottom:4px;">' + _e(item['Category'] || '') + '</div>';
        html += '<p style="margin:0 0 8px;font-size:0.88rem;color:var(--ink);line-height:1.52;">'
              + (idx + 1) + '. ' + _e(item['Question'] || '') + '</p>';
        html += '<div style="display:flex;gap:6px;">';
        html += '<button onclick="TheWay._heartAnswer(\'' + _e(qid) + '\',\'yes\')" '
              + 'style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--line);background:transparent;'
              + 'color:var(--ink-muted);cursor:pointer;font-size:0.78rem;font-weight:700;font-family:inherit;">Yes</button>';
        html += '<button onclick="TheWay._heartAnswer(\'' + _e(qid) + '\',\'no\')" '
              + 'style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--line);background:transparent;'
              + 'color:var(--ink-muted);cursor:pointer;font-size:0.78rem;font-weight:700;font-family:inherit;">No</button>';
        html += '</div></div>';
      });
      html += '</div>';

      // Column 2: Vitality Scan
      html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;padding:16px;">';
      html += '<h3 style="text-align:center;margin:0 0 12px;font-size:0.88rem;font-weight:700;color:var(--success);">Spiritual Vitality Scan</h3>';
      html += '<div id="tw-heart-score" style="text-align:center;font-size:2rem;font-weight:800;color:var(--success);margin:16px 0;">100%</div>';
      html += '<p id="tw-heart-status" style="text-align:center;font-size:0.78rem;font-weight:700;color:var(--success);text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">Heart Condition: Clear</p>';
      html += '<div id="tw-heart-cats"></div>';
      html += '</div>';

      html += '</div>';
      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  export function _heartAnswer(qid, answer) {
    _heartAnswers[qid] = answer;
    // Compute score
    var total = _heartRows.length;
    var answered = Object.keys(_heartAnswers).length;
    var noCount = 0;
    for (var k in _heartAnswers) { if (_heartAnswers[k] === 'no') noCount++; }
    var pct = answered ? Math.round((noCount / answered) * 100) : 100;
    var color = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
    var label = pct >= 75 ? 'Healthy' : pct >= 50 ? 'Needs Attention' : 'Critical';
    var scoreEl = document.getElementById('tw-heart-score');
    var statusEl = document.getElementById('tw-heart-status');
    if (scoreEl) { scoreEl.textContent = pct + '%'; scoreEl.style.color = color; }
    if (statusEl) { statusEl.textContent = 'Heart Condition: ' + label; statusEl.style.color = color; }

    // Category breakdown
    var cats = {};
    _heartRows.forEach(function(r) {
      var cat = r['Category'] || 'General';
      if (!cats[cat]) cats[cat] = { total: 0, healthy: 0 };
      cats[cat].total++;
      if (_heartAnswers[r['Question ID']] === 'no') cats[cat].healthy++;
    });
    var catEl = document.getElementById('tw-heart-cats');
    if (catEl) {
      var ch = '';
      for (var c in cats) {
        var cp = cats[c].total ? Math.round((cats[c].healthy / cats[c].total) * 100) : 0;
        ch += '<div style="margin-bottom:8px;">';
        ch += '<div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:3px;">';
        ch += '<span>' + _e(c) + '</span><span style="font-weight:700;">' + cp + '%</span></div>';
        ch += _progressBar(cp, cp >= 75 ? 'var(--success)' : cp >= 50 ? 'var(--warning)' : 'var(--danger)');
        ch += '</div>';
      }
      catEl.innerHTML = ch;
    }

    // Silently log heart check snapshot
    var flagged = [];
    for (var fk in _heartAnswers) { if (_heartAnswers[fk] === 'yes') {
      var row = _heartRows.find(function(r) { return r['Question ID'] === fk; });
      if (row) flagged.push(row['Category'] || 'General');
    }}
    _logDiagnostic('heart', { pct: pct, label: label, answered: answered, total: total, flagged: flagged });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 13. GENEALOGY — Biblical characters split-panel A-Z directory
  // ══════════════════════════════════════════════════════════════════════════

  var _twGeneRows = null;      // cached rows
  var _twGeneParentOf = null;  // cached parent lookup

  // Normalize a genealogy record from the Firestore bundle (lowercase camelCase keys)
  // to the capitalized-key format the genealogy display code expects.
  function _normalizeGeneRow(r) {
    return {
      'Name':      r.name      || r['Name']      || '',
      'Title':     r.title     || r['Title']      || '',
      'Meaning':   r.meaning   || r['Meaning']    || '',
      'Lifespan':  r.lifespan  || r['Lifespan']   || '',
      'Bio':       r.bio       || r['Bio']        || '',
      'Reference': r.reference || r['Reference']  || '',
      'Children':  r.children  || r['Children']   || '',
      '_docId':    r._docId    || ''
    };
  }

  async function _renderGenealogy() {
    _panel(_spinner());
    try {
      // ── Check live bundle (TheTruth sync from flockos-truth) first ──
      var rows = [];
      var _gLive = (typeof TheTruth !== 'undefined') ? TheTruth.liveBundle('genealogy') : null;
      if (_gLive && _gLive.length) {
        rows = _gLive.map(_normalizeGeneRow).filter(function(r) { return r['Name']; });
      }
      // Static snapshot bundled at deploy time
      if (!rows.length) {
        try {
          var _gMod = await import('../Data/genealogy.js');
          var _gStatic = (_gMod.default || []).filter(function(r) { return r.name || r['Name']; });
          if (_gStatic.length) rows = _gStatic.map(_normalizeGeneRow);
        } catch (_) {}
      }
      // Legacy fallback: TheVine Google Sheets
      if (!rows.length) {
        try {
          var _gRaw = await _withTimeout(TheVine.app.genealogy());
          rows = Array.isArray(_gRaw) ? _gRaw : _rows(_gRaw);
        } catch (_) {}
      }
      if (!rows.length) { _panel(_empty('\uD83D\uDC65', 'No genealogy data yet', 'Add entries in the Truth Editor.')); return; }

      // Sort alphabetically
      var sorted = rows.slice().sort(function(a, b) { return (a['Name'] || '').localeCompare(b['Name'] || ''); });
      // Group by first letter
      var letters = {};
      sorted.forEach(function(r) {
        var ch = (r['Name'] || '?')[0].toUpperCase();
        if (!letters[ch]) letters[ch] = [];
        letters[ch].push(r);
      });

      // Build parent lookup
      var parentOf = {};
      rows.forEach(function(r) {
        if (r['Children'] && r['Name']) {
          r['Children'].split(/[,;]/).map(function(c) { return c.trim(); }).filter(Boolean).forEach(function(c) {
            if (!parentOf[c]) parentOf[c] = [];
            parentOf[c].push(r['Name'].trim());
          });
        }
      });
      _twGeneRows = {};
      sorted.forEach(function(r) { if (r['Name']) _twGeneRows[r['Name'].trim()] = r; });
      _twGeneParentOf = parentOf;

      var withBio = rows.filter(function(r) { return r['Bio']; }).length;
      var withRefs = rows.filter(function(r) { return r['Reference']; }).length;

      var html = '';

      // Stat cards
      html += '<div class="gene-stat-row">';
      html += '<div class="gene-stat-card"><div class="gene-stat-num">' + rows.length + '</div><div class="gene-stat-label">Characters</div></div>';
      html += '<div class="gene-stat-card"><div class="gene-stat-num">' + Object.keys(letters).length + '</div><div class="gene-stat-label">Letters</div></div>';
      html += '<div class="gene-stat-card"><div class="gene-stat-num">' + withRefs + '</div><div class="gene-stat-label">Referenced</div></div>';
      html += '<div class="gene-stat-card"><div class="gene-stat-num">' + withBio + '</div><div class="gene-stat-label">With Bio</div></div>';
      html += '</div>';

      // Search bar
      html += '<div class="browse-search" style="margin-bottom:10px;">';
      html += '<span class="browse-search-icon">\uD83D\uDD0D</span>';
      html += '<input type="text" class="browse-search-input" placeholder="Search ' + rows.length + ' characters\u2026" oninput="TheWay._twGeneSearch(this.value)">';
      html += '<span id="tw-gene-count" style="font-size:.85rem;color:var(--text-secondary);margin-left:auto;">' + rows.length + '</span>';
      html += '</div>';

      // Letter index
      html += '<div class="letter-index" style="margin-bottom:10px;">';
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function(L) {
        var has = letters[L];
        html += '<button class="letter-index-btn' + (has ? '' : ' disabled') + '" onclick="TheWay._twGeneLetterJump(\'' + L + '\')">' + L + '</button>';
      });
      html += '</div>';

      // Split panel container
      html += '<div class="gene-split">';

      // Left: name list
      html += '<div class="gene-list">';
      html += '<div class="gene-list-scroll" id="tw-gene-list-scroll">';
      Object.keys(letters).sort().forEach(function(letter) {
        html += '<div class="gene-letter-head" data-letter="' + letter + '" id="tw-gene-' + letter + '">' + letter + '</div>';
        letters[letter].forEach(function(r) {
          var name = r['Name'] || '';
          var searchText = (name + ' ' + (r['Title'] || '') + ' ' + (r['Meaning'] || '')).toLowerCase();
          html += '<div class="gene-item" data-search="' + _e(searchText) + '" data-letter="' + letter + '" data-idx="' + _e(name) + '" onclick="TheWay._twGeneSelect(this.dataset.idx)">';
          html += '<div class="gene-item-name">' + _e(name) + '</div>';
          if (r['Title']) html += '<div class="gene-item-title">' + _e(r['Title']) + '</div>';
          html += '</div>';
        });
      });
      html += '</div></div>';

      // Right: detail panel
      html += '<div class="gene-detail" id="tw-gene-detail">';
      html += '<div class="gene-detail-empty">';
      html += '<div style="font-size:3rem;">\uD83D\uDC64</div>';
      html += '<p>Select a character from the list</p>';
      html += '</div>';
      html += '</div>';

      html += '</div>'; // close gene-split

      _panel(html);

      // Auto-select first person (prefer Jesus/Christ)
      var autoSelect = sorted.find(function(r) { return /jesus|christ/i.test(r['Name'] || ''); }) || sorted[0];
      if (autoSelect) _twGeneSelect(autoSelect['Name']);

    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  /** Select a person in the TheWay genealogy split-panel */
  export function _twGeneSelect(name) {
    if (!name || !_twGeneRows) return;
    var person = _twGeneRows[name.trim()];
    if (!person) return;
    var parentOf = _twGeneParentOf || {};

    // Mark active in list
    document.querySelectorAll('#tw-gene-list-scroll .gene-item').forEach(function(el) {
      el.classList.toggle('active', el.dataset.idx === name.trim());
    });

    var detail = document.getElementById('tw-gene-detail');
    if (!detail) return;

    var n = person['Name'] || '';
    var title    = person['Title'] || '';
    var meaning  = person['Meaning'] || '';
    var lifespan = person['Lifespan'] || '';
    var ref      = person['Reference'] || '';
    var bio      = person['Bio'] || '';
    var children = person['Children'] || '';
    var parents  = parentOf[n] || [];

    var h = '<div class="gene-fade-in">';

    // Hero
    h += '<div class="gene-hero">';
    h += '<h2 class="gene-hero-name">' + _e(n) + '</h2>';
    if (title) h += '<p class="gene-hero-title">' + _e(title) + '</p>';
    h += '<div class="gene-hero-badges">';
    if (lifespan) h += '<span class="gene-hero-badge gene-hero-badge-gold">' + _e(lifespan) + '</span>';
    if (meaning)  h += '<span class="gene-hero-badge gene-hero-badge-accent">\u201C' + _e(meaning) + '\u201D</span>';
    h += '</div></div>';

    // Sections
    h += '<div class="gene-sections">';
    if (bio) {
      h += '<div class="gene-section gene-section-lilac">';
      h += '<div class="gene-section-label">Biography</div>';
      h += '<p>' + _e(bio) + '</p></div>';
    }
    if (meaning && !bio) {
      h += '<div class="gene-section">';
      h += '<div class="gene-section-label">Name Meaning</div>';
      h += '<p>\u201C' + _e(meaning) + '\u201D</p></div>';
    }
    if (lifespan) {
      h += '<div class="gene-section gene-section-gold">';
      h += '<div class="gene-section-label">Lifespan</div>';
      h += '<p>' + _e(lifespan) + '</p></div>';
    }
    if (ref) {
      h += '<div class="gene-section gene-section-peach">';
      h += '<div class="gene-section-label">Scripture References</div>';
      h += '<div class="gene-ref-pills">';
      ref.split(/[,;]/).forEach(function(v) {
        v = v.trim();
        if (v) h += '<span class="gene-ref-pill">' + _bibleLink(v) + '</span>';
      });
      h += '</div></div>';
    }
    if (parents.length) {
      h += '<div class="gene-section gene-section-peach">';
      h += '<div class="gene-section-label">Parents</div>';
      h += '<p>' + parents.map(function(p) {
        return '<span class="gene-family-link" onclick="TheWay._twGeneSelect(\'' + _e(p).replace(/'/g, "\\'") + '\')">' + _e(p) + '</span>';
      }).join(', ') + '</p></div>';
    }
    if (children) {
      h += '<div class="gene-section gene-section-mint">';
      h += '<div class="gene-section-label">Children</div>';
      h += '<p>' + children.split(/[,;]/).map(function(c) {
        c = c.trim();
        return c ? '<span class="gene-family-link" onclick="TheWay._twGeneSelect(\'' + _e(c).replace(/'/g, "\\'") + '\')">' + _e(c) + '</span>' : '';
      }).filter(Boolean).join(', ') + '</p></div>';
    }
    h += '</div></div>';

    detail.innerHTML = h;
    detail.scrollTop = 0;

    // On mobile, scroll detail into view
    if (window.innerWidth <= 900) {
      setTimeout(function() { detail.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    }
  }

  /** Search / filter the TheWay genealogy list */
  export function _twGeneSearch(query) {
    var q = (query || '').toLowerCase().trim();
    var items = document.querySelectorAll('#tw-gene-list-scroll .gene-item');
    var heads = document.querySelectorAll('#tw-gene-list-scroll .gene-letter-head');
    items.forEach(function(el) {
      el.style.display = (!q || (el.dataset.search || '').indexOf(q) !== -1) ? '' : 'none';
    });
    heads.forEach(function(h) {
      var letter = h.dataset.letter;
      var anyVisible = false;
      items.forEach(function(el) {
        if (el.dataset.letter === letter && el.style.display !== 'none') anyVisible = true;
      });
      h.style.display = anyVisible ? '' : 'none';
    });
    var visible = 0;
    items.forEach(function(el) { if (el.style.display !== 'none') visible++; });
    var counter = document.getElementById('tw-gene-count');
    if (counter) counter.textContent = visible;
  }

  /** Letter jump for TheWay genealogy */
  export function _twGeneLetterJump(letter) {
    var heading = document.getElementById('tw-gene-' + letter);
    if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 14. JOURNAL — Personal journal entries
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderJournal() {
    _panel(_spinner());
    try {
      var res = await _withTimeout(_isFB() ? UpperRoom.listJournal({ limit: 200 }) : TheVine.flock.journal.list({ limit: 200 }));
      var rows = _rows(res);

      var html = '';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">';
      html += '<h3 style="margin:0;font-size:1rem;font-weight:700;">My Journal</h3>';
      html += '<button onclick="TheWay._newJournal()" style="background:var(--accent);color:var(--ink-inverse);border:none;'
            + 'border-radius:6px;padding:8px 16px;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;">+ New Entry</button>';
      html += '</div>';

      if (!rows.length) { _panel(html + _empty('\uD83D\uDCDD', 'No journal entries', 'Start writing to capture your thoughts, prayers, and reflections.')); return; }

      rows.sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

      rows.forEach(function(r) {
        var date = (r.createdAt || r.date || '').substring(0, 10);
        var preview = (r.content || r.body || '').substring(0, 200);
        html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:10px;cursor:pointer;" '
              + 'onclick="TheWay._viewJournal(\'' + _e(r.id || '') + '\')">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
        html += '<span style="font-weight:700;font-size:0.92rem;">' + _e(r.title || 'Untitled') + '</span>';
        html += '<span style="font-size:0.72rem;color:var(--ink-muted);">' + _e(date) + '</span>';
        html += '</div>';
        if (r.tags) html += '<div style="font-size:0.72rem;color:var(--accent);margin-bottom:4px;">' + _e(r.tags) + '</div>';
        html += '<p style="margin:0;font-size:0.82rem;color:var(--ink-muted);line-height:1.5;">' + _e(preview) + (preview.length >= 200 ? '\u2026' : '') + '</p>';
        html += '</div>';
      });

      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  export function _newJournal() {
    if (typeof Modules !== 'undefined' && Modules.newJournal) { Modules.newJournal(); return; }
    _toast('Journal creation requires sign-in', 'info');
  }

  export function _viewJournal(id) {
    if (typeof Modules !== 'undefined' && Modules.editJournal) { Modules.editJournal(id); return; }
    _toast('Journal editor requires sign-in', 'info');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 16. ANALYTICS DASHBOARD — Charts & graphs
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderAnalytics() {
    _panel(_spinner());
    try {
      var fetches = [
        _withTimeout(_fetchStats()),
        _withTimeout(_fetchProgress({})),
        _withTimeout(_fetchQuizResults()),
        _withTimeout(_fetchCertificates()),
      ];
      var results = await Promise.allSettled(fetches);
      var stats    = results[0].status === 'fulfilled' ? results[0].value : {};
      var progress = results[1].status === 'fulfilled' ? _rows(results[1].value) : [];
      var qr       = results[2].status === 'fulfilled' ? _rows(results[2].value) : [];
      var certs    = results[3].status === 'fulfilled' ? _rows(results[3].value) : [];

      var html = '';

      // ── Learning hours over time (weekly aggregation) ───────────────
      var weeklyHours = {};
      progress.forEach(function(p) {
        var date = (p.lastListenedAt || p.updatedAt || '').slice(0, 10);
        if (!date) return;
        var d = new Date(date + 'T00:00:00');
        var weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        var key = weekStart.toISOString().slice(0, 10);
        weeklyHours[key] = (weeklyHours[key] || 0) + (p.totalDurationSecs || 0) / 3600;
      });
      var wKeys = Object.keys(weeklyHours).sort();
      var wData = wKeys.map(function(k) { return Math.round(weeklyHours[k] * 10) / 10; });
      var wLabels = wKeys.map(function(k) { return k.slice(5); });

      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:20px;">';

      // Line chart: hours over time
      html += _card(
        '<div style="font-weight:700;font-size:0.85rem;margin-bottom:10px;">Learning Hours (Weekly)</div>'
        + (wData.length ? _svgBar(wData, wLabels, 300, 120, 'var(--accent)') : '<div style="color:var(--ink-muted);font-size:0.82rem;">No data yet</div>')
      );

      // Donut chart: category breakdown
      var catCounts = {};
      progress.forEach(function(p) {
        var cat = p.playlistTitle || 'Uncategorized';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      });
      var donutColors = ['var(--accent)', 'var(--mint)', 'var(--peach)', 'var(--lilac)', 'var(--rose)', 'var(--gold)'];
      var segments = Object.keys(catCounts).slice(0, 6).map(function(k, i) {
        return { value: catCounts[k], color: donutColors[i % donutColors.length], label: k };
      });
      html += _card(
        '<div style="font-weight:700;font-size:0.85rem;margin-bottom:10px;">Category Breakdown</div>'
        + '<div style="display:flex;align-items:center;gap:16px;">'
        + (segments.length ? _svgDonut(segments, 100) : '')
        + '<div style="font-size:0.75rem;color:var(--ink-muted);">'
        + segments.map(function(s) {
            return '<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">'
              + '<div style="width:8px;height:8px;border-radius:2px;background:' + s.color + ';"></div>'
              + _e(s.label) + ' (' + s.value + ')</div>';
          }).join('')
        + '</div></div>'
      );

      html += '</div>'; // end grid row

      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:20px;">';

      // Quiz performance trend
      var quizScores = qr.map(function(r) { return r.scorePercent || 0; });
      html += _card(
        '<div style="font-weight:700;font-size:0.85rem;margin-bottom:10px;">Quiz Performance Trend</div>'
        + (quizScores.length ? _svgLine(quizScores, 300, 80, 'var(--peach)')
          : '<div style="color:var(--ink-muted);font-size:0.82rem;">No quiz data yet</div>')
      );

      // Streak heatmap
      var heatData = [];
      progress.forEach(function(p) {
        var d = (p.lastListenedAt || p.updatedAt || '').slice(0, 10);
        if (d) heatData.push({ date: d, value: 1 });
      });
      var merged = {};
      heatData.forEach(function(d) { merged[d.date] = (merged[d.date] || 0) + d.value; });
      var heatArr = Object.keys(merged).map(function(k) { return { date: k, value: merged[k] }; });
      html += _card(
        '<div style="font-weight:700;font-size:0.85rem;margin-bottom:10px;">Activity Heatmap</div>'
        + '<div style="overflow-x:auto;">' + _svgHeatmap(heatArr, 26, 12) + '</div>'
      );
      html += '</div>';

      // ── Leaderboard (admin view: congregation-wide) ─────────────────
      if (_isAdmin()) {
        html += '<h3 style="font-size:0.92rem;font-weight:700;margin-bottom:10px;">Top Learners</h3>';
        var learners = {};
        progress.forEach(function(p) {
          var name = p.memberName || p.memberId || 'Unknown';
          if (!learners[name]) learners[name] = { name: name, completed: 0, hours: 0 };
          if (p.status === 'Completed') learners[name].completed++;
          learners[name].hours += (p.totalDurationSecs || 0) / 3600;
        });
        var sorted = Object.values(learners).sort(function(a, b) { return b.completed - a.completed; });

        if (sorted.length) {
          html += '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;overflow:hidden;">';
          html += '<table style="width:100%;border-collapse:collapse;">';
          html += '<thead><tr style="border-bottom:2px solid var(--line);">'
                + '<th style="text-align:left;padding:10px 14px;font-size:0.78rem;color:var(--ink-muted);">#</th>'
                + '<th style="text-align:left;padding:10px 14px;font-size:0.78rem;color:var(--ink-muted);">Name</th>'
                + '<th style="text-align:center;padding:10px 14px;font-size:0.78rem;color:var(--ink-muted);">Completed</th>'
                + '<th style="text-align:center;padding:10px 14px;font-size:0.78rem;color:var(--ink-muted);">Hours</th>'
                + '</tr></thead><tbody>';
          sorted.slice(0, 15).forEach(function(l, i) {
            var medal = i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : (i + 1);
            html += '<tr style="border-bottom:1px solid var(--line);">'
                  + '<td style="padding:8px 14px;font-size:0.82rem;">' + medal + '</td>'
                  + '<td style="padding:8px 14px;font-size:0.82rem;">' + _e(l.name) + '</td>'
                  + '<td style="text-align:center;padding:8px 14px;font-size:0.82rem;font-weight:700;color:var(--accent);">' + l.completed + '</td>'
                  + '<td style="text-align:center;padding:8px 14px;font-size:0.82rem;">' + Math.round(l.hours * 10) / 10 + '</td>'
                  + '</tr>';
          });
          html += '</tbody></table></div>';
        }
      }

      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 13. CERTIFICATES — View & print completion certificates
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderCertificates() {
    _panel(_spinner());
    try {
      var certs = [];
      try {
        var res = await _withTimeout(_fetchCertificates());
        certs = _rows(res);
      } catch (_) {}

      _cache.certificates = certs;

      if (!certs.length) {
        _panel(_empty('\uD83C\uDF93', 'No certificates yet', 'Complete courses and quizzes to earn certificates!'));
        return;
      }

      var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">';
      certs.forEach(function(c) {
        html += '<div style="background:var(--bg-raised);border:2px solid var(--gold);border-radius:12px;'
              + 'padding:20px;text-align:center;position:relative;">';
        html += '<div style="font-size:2rem;margin-bottom:8px;">\uD83C\uDF93</div>';
        html += '<div style="font-size:0.7rem;color:var(--gold);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Certificate of Completion</div>';
        html += '<div style="font-weight:700;font-size:1rem;margin-bottom:4px;">' + _e(c.memberName || '') + '</div>';
        html += '<div style="font-size:0.82rem;color:var(--ink-muted);margin-bottom:8px;">' + _e(c.playlistTitle || c.quizTitle || c.certificateType || '') + '</div>';
        html += '<div style="font-size:0.72rem;color:var(--ink-faint);margin-bottom:8px;">'
              + _e(c.issueDate || c.createdAt || '') + '</div>';
        html += '<div style="font-size:0.65rem;color:var(--ink-faint);font-family:monospace;">'
              + 'ID: ' + _e(c.certificateNumber || c.id || '') + '</div>';
        html += '<div style="margin-top:12px;">'
              + '<button onclick="TheWay._printCert(\'' + _e(c.id) + '\')" '
              + 'style="background:var(--gold);color:#fff;border:none;border-radius:4px;padding:5px 14px;'
              + 'font-size:0.78rem;cursor:pointer;font-family:inherit;">\uD83D\uDDA8 Print</button></div>';
        html += '</div>';
      });
      html += '</div>';

      _panel(html);
    } catch (e) {
      _panel(_errHtml(e.message));
    }
  }

  export function _printCert(certId) {
    var certs = _cache.certificates || [];
    var cert = certs.find(function(c) { return c.id === certId; });
    if (!cert) return;

    var churchName = 'FlockOS Church';
    try {
      if (typeof Nehemiah !== 'undefined' && Nehemiah.getSession) {
        var s = Nehemiah.getSession();
        if (s && s.churchName) churchName = s.churchName;
      }
    } catch (_) {}

    var w = window.open('', '_blank', 'width=800,height=600');
    if (!w) { _toast('Please allow popups to print certificates', 'danger'); return; }
    w.document.write(
      '<!DOCTYPE html><html><head><title>Certificate</title>'
      + '<style>'
      + 'body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;'
      + 'background:#faf9f6;font-family:Georgia,"Times New Roman",serif;}'
      + '.cert{width:700px;padding:60px;border:3px double #8B7028;border-radius:4px;background:#fff;text-align:center;}'
      + '.cert h1{font-size:2rem;color:#8B7028;margin-bottom:4px;letter-spacing:2px;text-transform:uppercase;}'
      + '.cert .subtitle{font-size:0.9rem;color:#8B7028;margin-bottom:24px;}'
      + '.cert .name{font-size:1.6rem;font-weight:700;margin:12px 0;border-bottom:2px solid #8B7028;display:inline-block;padding:4px 40px;}'
      + '.cert .course{font-size:1.1rem;color:#444;margin:12px 0;}'
      + '.cert .date{font-size:0.85rem;color:#888;margin-top:20px;}'
      + '.cert .id{font-size:0.7rem;color:#aaa;margin-top:8px;font-family:monospace;}'
      + '.cert .church{font-size:1rem;color:#8B7028;margin-top:24px;font-style:italic;}'
      + '@media print{body{background:#fff;}}'
      + '</style></head><body>'
      + '<div class="cert">'
      + '<h1>\uD83C\uDF93 Certificate of Completion</h1>'
      + '<div class="subtitle">This certifies that</div>'
      + '<div class="name">' + _e(cert.memberName || '') + '</div>'
      + '<div class="course">has successfully completed<br><strong>' + _e(cert.playlistTitle || cert.quizTitle || '') + '</strong></div>'
      + '<div class="date">Date: ' + _e(cert.issueDate || cert.createdAt || 'N/A') + '</div>'
      + '<div class="id">Certificate ID: ' + _e(cert.certificateNumber || cert.id || '') + '</div>'
      + '<div class="church">' + _e(churchName) + '</div>'
      + '</div>'
      + '<script>setTimeout(function(){window.print();},500);<\/script>'
      + '</body></html>'
    );
    w.document.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GENERIC FILTER HELPER (used by theology, lexicon, devotionals, etc.)
  // ══════════════════════════════════════════════════════════════════════════

  export function _filterPanel(prefix, query) {
    var q = (query || '').toLowerCase().trim();
    var items = document.querySelectorAll('#' + prefix + '-grid .browse-item');
    items.forEach(function(item) {
      item.style.display = (!q || (item.dataset.search || '').indexOf(q) !== -1) ? '' : 'none';
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // API HELPERS — All calls through TheVine
  // ══════════════════════════════════════════════════════════════════════════

  function _fetchStats() {
    return _isFB() ? UpperRoom.lrnProgressStats() : TheVine.flock.call('learning.progress.stats', {});
  }
  function _fetchProgress(params) {
    return _isFB() ? UpperRoom.listLrnProgress(params || {}) : TheVine.flock.call('learning.progress.list', params || {});
  }
  function _fetchRecommendations() {
    return _isFB() ? UpperRoom.listLrnRecommendations({ status: 'Active' }) : TheVine.flock.call('learning.recommendations.list', { status: 'Active' });
  }
  function _fetchCertificates() {
    return _isFB() ? UpperRoom.listLrnCertificates({}) : TheVine.flock.call('learning.certificates.list', {});
  }
  function _fetchQuizResults() {
    return _isFB() ? UpperRoom.listLrnQuizResults({}) : TheVine.flock.call('learning.quizResults.list', {});
  }

  export function resetHome() { _activeTab = 'dashboard'; }
  export const _lexTestament = _twLexFilter;  // backward-compat alias

/* Expose as window.TheWay for inline onclick= handlers */
if (typeof window !== 'undefined') {
  window.TheWay = {
    switchTab,
    renderHub,
    refresh,
    _filterCourses,
    openCourse,
    _goToLesson,
    _prevLesson,
    _nextLesson,
    _markComplete,
    _bookmarkLesson,
    _saveNote,
    _newCourse,
    _editCourse,
    _manageLessons,
    _addLessonSubmit,
    _editLesson,
    _removeLessonItem,
    _moveLessonUp,
    _moveLessonDown,
    _startAppQuiz,
    _twQuizSave,
    _twQuizNav,
    _scoreQuiz,
    _startCourseQuiz,
    _submitCourseQuiz,
    _openReadingPlan,
    _toggleReadingDay,
    _twLexSelect,
    _twLexFilter,
    _twLexSearch,
    _twLexLetterJump,
    _libFilter,
    _libSearch,
    _openBook,
    _libTab,
    _libTestament,
    _psalmsView,
    _openCounselCard,
    _heartAnswer,
    _twGeneSelect,
    _twGeneSearch,
    _twGeneLetterJump,
    _newJournal,
    _viewJournal,
    _printCert,
    _filterPanel,
    resetHome,
    _lexTestament,
  };
}
