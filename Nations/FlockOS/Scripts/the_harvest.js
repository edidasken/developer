/* ══════════════════════════════════════════════════════════════════════════════
   THE HARVEST — FlockOS Ministry Hub
   Consolidated ministry portal: events, sermons, service plans, songs,
   ministry teams, and volunteer scheduling — all in one rich dashboard.

   Depends on: Modules (the_tabernacle.js), TheVine (the_true_vine.js),
               Nehemiah (firm_foundation.js), Adornment (fine_linen.js)

   "The harvest is plentiful but the workers are few." — Matthew 9:37
   ══════════════════════════════════════════════════════════════════════════════ */

const TheHarvest = (() => {
  'use strict';

  function _isFB() {
    return typeof Modules !== 'undefined' && Modules._isFirebaseComms && Modules._isFirebaseComms();
  }

  // ── HTML-escape ─────────────────────────────────────────────────────────
  function _e(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(s)));
    return d.innerHTML;
  }

  function _spinner() {
    return '<div style="text-align:center;padding:60px 20px;color:var(--ink-muted);">'
         + '<div style="margin:0 auto 16px;width:32px;height:32px;border:3px solid var(--line);'
         + 'border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite;"></div>'
         + 'Loading\u2026</div>';
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

  function _statusBadge(val) {
    if (typeof Modules !== 'undefined' && Modules._statusBadge) return Modules._statusBadge(val);
    var t = String(val || '').toUpperCase();
    if (['TRUE','ACTIVE','OPEN','PUBLISHED','DELIVERED','COMPLETE','YES','APPROVED','ANSWERED','CONFIRMED','COMPLETED'].includes(t))
      return _badge(val, 'success');
    if (['FALSE','INACTIVE','CLOSED','ARCHIVED','CANCELLED','DENIED','NO'].includes(t))
      return _badge(val, 'warn');
    if (['URGENT','HIGH','PENDING','DRAFT','NEW','CRITICAL','SCHEDULED','NO-SHOW'].includes(t))
      return _badge(val, 'danger');
    return _badge(val, 'info');
  }

  function _toast(msg, type) {
    if (typeof Modules !== 'undefined' && Modules._toast) { Modules._toast(msg, type); return; }
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;'
                    + 'font-size:0.85rem;z-index:99999;color:#fff;'
                    + 'background:' + (type === 'error' ? 'var(--danger)' : 'var(--accent)') + ';';
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

  // ── Recurrence / visibility helpers (mirror what the_tabernacle.js uses) ─
  function _recurLabel(val) {
    var labels = { daily:'Daily', weekly:'Weekly', biweekly:'Bi-weekly',
                   monthly:'Monthly', quarterly:'Quarterly', yearly:'Yearly' };
    return labels[String(val || '').toLowerCase()] || val || '';
  }
  function _visBadge(val) {
    var v = String(val || '').toLowerCase();
    if (v === 'public')  return _badge('Public', 'success');
    if (v === 'private') return _badge('Private', 'warn');
    if (v === 'members') return _badge('Members', 'info');
    return _badge(val || 'Public', 'info');
  }
  function _recurOpts() {
    return ['None','Daily','Weekly','Bi-weekly','Monthly','Quarterly','Yearly'];
  }
  function _visibilityOpts() {
    return [
      { value: 'public',   label: 'Public' },
      { value: 'members',  label: 'Members Only' },
      { value: 'leaders',  label: 'Leaders' },
      { value: 'deacons',  label: 'Deacons' },
      { value: 'pastors',  label: 'Pastors' },
      { value: 'admins',   label: 'Admins' },
      { value: 'private',  label: 'Private' },
    ];
  }

  // ── Local data cache ────────────────────────────────────────────────────
  var _cache = {};
  var _activeTab = 'overview';
  var _hubElement = null;
  var _session = null;

  function _hubEl() { return _hubElement || document.getElementById('view-events'); }
  function _hubBody(html) {
    var el = _hubEl();
    if (!el) return;
    var b = el.querySelector('#th-body');
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

  // ── Modal / edit helpers (delegate to the_tabernacle.js) ────────────────
  function _modal(title, fields, onSave) {
    if (typeof Modules !== 'undefined' && Modules._modal) {
      Modules._modal(title, fields, onSave);
    }
  }
  function _edit(cacheKey, title, fields, updateFn, id, getFn) {
    if (typeof Modules !== 'undefined' && Modules._edit) {
      // Seed Modules._dataCache so the fallback lookup finds the row
      if (_cache[cacheKey] && Modules._dataCache) Modules._dataCache[cacheKey] = _cache[cacheKey];
      Modules._edit(cacheKey, title, fields, updateFn, id, getFn);
    }
  }
  function _reload(view) {
    if (typeof Modules !== 'undefined' && Modules._reload) {
      Modules._reload(view);
    }
  }

  // ── SVG Mini-charts ─────────────────────────────────────────────────────
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
    svg += '<circle cx="' + cx + '" cy="' + cx + '" r="' + (r * 0.55) + '" fill="var(--bg-raised)"/>';
    svg += '</svg>';
    return svg;
  }

  // ── Card / KPI helpers ──────────────────────────────────────────────────
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

  // ── Table helper (mirrors the_tabernacle.js _table pattern) ─────────────
  function _table(cols, rows, opts) {
    if (typeof Modules !== 'undefined' && Modules._table) return Modules._table(cols, rows, opts);
    // Fallback mini table
    var html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.82rem;">';
    html += '<thead><tr>';
    cols.forEach(function(c) { html += '<th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--line);color:var(--ink-muted);font-weight:600;">' + _e(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    var editFn = opts && opts.editFn;
    var ids = opts && opts.ids;
    rows.forEach(function(row, ri) {
      var click = editFn && ids && ids[ri]
        ? ' onclick="' + editFn + '(\'' + _e(ids[ri]) + '\')" style="cursor:pointer;" '
        : '';
      html += '<tr' + click + '>';
      row.forEach(function(cell) { html += '<td style="padding:8px 10px;border-bottom:1px solid var(--line);">' + (cell || '') + '</td>'; });
      html += '</tr>';
    });
    if (!rows.length) {
      html += '<tr><td colspan="' + cols.length + '" style="padding:24px;text-align:center;color:var(--ink-muted);">No records found</td></tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB SYSTEM
  // ══════════════════════════════════════════════════════════════════════════

  var _tabs = [
    { id: 'overview',    label: 'Overview',      icon: '\u2302' },
    { id: 'events',      label: 'Events',        icon: '\u2734' },
    { id: 'sermons',     label: 'Sermons',       icon: '\uD83C\uDFA4' },
    { id: 'services',    label: 'Services',      icon: '\u26EA' },
    { id: 'songs',       label: 'Songs',         icon: '\uD83C\uDFB5' },
    { id: 'ministries',  label: 'Ministries',    icon: '\uD83E\uDD1D' },
    { id: 'volunteers',  label: 'Volunteers',    icon: '\uD83D\uDE4B' },
  ];

  function _renderTabs() {
    return '<div style="margin-bottom:16px;">'
         + '<a onclick="navigate(\'ministry\')" style="display:inline-flex;align-items:center;gap:4px;'
         + 'font-size:0.82rem;font-weight:600;color:var(--accent);cursor:pointer;text-decoration:none;" '
         + 'onmouseover="this.style.opacity=\'0.7\'" onmouseout="this.style.opacity=\'1\'">'
         + '\u2190 Ministry Hub</a></div>';
  }

  function switchTab(tabId) {
    _activeTab = tabId;
    var el = _hubEl();
    if (!el) return;
    var body = el.querySelector('#th-panels');
    if (body) body.innerHTML = _spinner();
    var tabBar = el.querySelector('#th-tabs');
    if (tabBar) {
      if (tabId === 'overview') {
        tabBar.style.display = 'none';
      } else {
        tabBar.style.display = '';
        tabBar.innerHTML = _renderTabs();
      }
    }
    _renderPanel(tabId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN HUB RENDERER
  // ══════════════════════════════════════════════════════════════════════════

  async function renderHub(el, session) {
    _hubElement = el;
    _session = session || _getSession();

    el.innerHTML = '<div style="max-width:1200px;margin:0 auto;">'
      + '<div id="th-tabs" style="' + (_activeTab === 'overview' ? 'display:none;' : '') + '">' + _renderTabs() + '</div>'
      + '<div id="th-panels">' + _spinner() + '</div>'
      + '<div id="th-body"></div>'
      + '</div>';

    _renderPanel(_activeTab);
  }

  function refresh() {
    _cache = {};
    var el = _hubEl();
    if (el) renderHub(el, _session);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PANEL ROUTER
  // ══════════════════════════════════════════════════════════════════════════

  function _renderPanel(tabId) {
    switch (tabId) {
      case 'overview':    _renderOverview();    break;
      case 'events':      _renderEvents();      break;
      case 'sermons':     _renderSermons();     break;
      case 'services':    _renderServices();    break;
      case 'songs':       _renderSongs();       break;
      case 'ministries':  _renderMinistries();  break;
      case 'volunteers':  _renderVolunteers();  break;
      default:            _renderOverview();
    }
  }

  function _panel(html) {
    var el = _hubEl();
    if (!el) return;
    var p = el.querySelector('#th-panels');
    if (p) p.innerHTML = html;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. OVERVIEW — Hero + launch-card dashboard
  // ══════════════════════════════════════════════════════════════════════════

  var _launchCards = [
    { id: 'events',     nav: 'events',     icon: '\u2734',          title: 'Events',     desc: 'Plan & manage church events',   zone: 'courts' },
    { id: 'services',   nav: 'services',   icon: '\u26EA',          title: 'Services',   desc: 'Service plans & run sheets',    zone: 'courts' },
    { id: 'songs',      nav: 'songs',      icon: '\uD83C\uDFB5',    title: 'Songs',      desc: 'Song library & setlists',       zone: 'courts' },
    { id: 'sermons',    nav: 'sermons',    icon: '\uD83C\uDFA4',    title: 'Sermons',    desc: 'Sermon series & messages',      zone: 'holy' },
    { id: 'ministries', nav: 'ministries', icon: '\uD83E\uDD1D',    title: 'Ministries', desc: 'Teams & ministry groups',       zone: 'holy' },
    { id: 'volunteers', nav: 'volunteers', icon: '\uD83D\uDE4B',    title: 'Volunteers', desc: 'Scheduling & coordination',     zone: 'holy' },
  ];

  var _harvestZones = [
    { id: 'courts', label: 'The Courts',     glyph: '' },
    { id: 'holy',   label: 'The Holy Place', glyph: '\u2726' },
  ];

  async function _renderOverview() {
    // ── Hero ─────────────────────────────────────────────────────────────
    var html = '<div style="text-align:center;padding:48px 20px 32px;">'
      + '<h1 style="font-size:2.4rem;font-weight:800;color:var(--accent);margin:0;">Ministry Hub</h1>'
      + '<p style="font-style:italic;color:#d4a017;font-size:1.05rem;margin:10px 0 4px;">'
      + '\u201CWhatever you do, work heartily, as for the Lord and not for men.\u201D</p>'
      + '<span style="font-size:0.8rem;color:var(--ink-muted);">Colossians 3:23</span>'
      + '</div>';

    // ── Launch Cards (grouped by zone) ───────────────────────────────────
    _harvestZones.forEach(function(z) {
      var zoneCards = _launchCards.filter(function(c) { return c.zone === z.id; });
      if (!zoneCards.length) return;

      if (z.glyph) {
        html += '<div class="dash-threshold"><span class="dash-threshold-glyph">' + z.glyph + '</span></div>';
      }
      html += '<div class="dash-zone-label">' + z.label + '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:4px;">';
      zoneCards.forEach(function(c) {
        html += '<div onclick="navigate(\'' + c.nav + '\')" '
              + 'style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;'
              + 'padding:20px;cursor:pointer;transition:all 0.2s;text-align:center;" '
              + 'onmouseover="this.style.borderColor=\'var(--accent)\';this.style.transform=\'translateY(-2px)\'" '
              + 'onmouseout="this.style.borderColor=\'var(--line)\';this.style.transform=\'none\'">'
              + '<div style="font-size:2rem;margin-bottom:8px;">' + c.icon + '</div>'
              + '<div style="font-weight:700;color:var(--ink);margin-bottom:4px;">' + _e(c.title) + '</div>'
              + '<div style="font-size:0.78rem;color:var(--ink-muted);">' + _e(c.desc) + '</div>'
              + '</div>';
      });
      html += '</div>';
    });

    // ── Compact KPI ribbon (deferred) ────────────────────────────────────
    html += '<div id="th-kpi-ribbon" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));'
          + 'gap:12px;margin-bottom:20px;">' + _spinner() + '</div>';

    _panel(html);

    // Fetch KPIs in background
    try {
      var results = await Promise.allSettled([
        _isFB() ? UpperRoom.listEvents({ limit: 100 }) : TheVine.flock.events.list({ limit: 100 }),
        _isFB() ? UpperRoom.listSermons({ limit: 100 }) : TheVine.flock.sermons.list({ limit: 100 }),
        _isFB() ? UpperRoom.listServicePlans({ limit: 50 }) : TheVine.flock.servicePlans.list({ limit: 50 }),
        _isFB() ? UpperRoom.listSongs() : TheVine.flock.call('songs.list', {}),
        _isFB() ? UpperRoom.listMinistries() : TheVine.flock.ministries.list(),
        _isFB() ? UpperRoom.listVolunteers({ limit: 100 }) : TheVine.flock.volunteers.list({ limit: 100 }),
      ]);

      var events     = results[0].status === 'fulfilled' ? _rows(results[0].value) : [];
      var sermons    = results[1].status === 'fulfilled' ? _rows(results[1].value) : [];
      var services   = results[2].status === 'fulfilled' ? _rows(results[2].value) : [];
      var songs      = results[3].status === 'fulfilled' ? _rows(results[3].value) : [];
      var ministries = results[4].status === 'fulfilled' ? _rows(results[4].value) : [];
      var volunteers = results[5].status === 'fulfilled' ? _rows(results[5].value) : [];

      _cache.events = events;  _cache.sermons = sermons;
      _cache.services = services;  _cache.songs = songs;
      _cache.ministries = ministries;  _cache.volunteers = volunteers;

      var today = new Date().toISOString().slice(0, 10);
      var upcoming = events.filter(function(ev) {
        return (ev.date || ev.startDate || '').substring(0, 10) >= today;
      });
      var activeMins = ministries.filter(function(m) {
        return String(m.status || m.active || '').toUpperCase() !== 'INACTIVE';
      });

      var ribbon = _card(_kpi('Upcoming Events', upcoming.length, '\u2734'))
        + _card(_kpi('Sermons', sermons.length, '\uD83C\uDFA4'))
        + _card(_kpi('Service Plans', services.length, '\u26EA'))
        + _card(_kpi('Songs', songs.length, '\uD83C\uDFB5'))
        + _card(_kpi('Ministries', activeMins.length, '\uD83E\uDD1D'))
        + _card(_kpi('Volunteers', volunteers.length, '\uD83D\uDE4B'));

      var el = _hubEl();
      if (el) {
        var r = el.querySelector('#th-kpi-ribbon');
        if (r) r.innerHTML = ribbon;
      }
    } catch (e) {
      var el2 = _hubEl();
      if (el2) {
        var r2 = el2.querySelector('#th-kpi-ribbon');
        if (r2) r2.innerHTML = '<p style="color:var(--ink-muted);font-size:0.85rem;">Could not load stats.</p>';
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. EVENTS — Full events table with create/edit
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderEvents() {
    _panel(_spinner());
    try {
      var res = _isFB()
        ? await UpperRoom.listEvents({ limit: 60 })
        : await TheVine.flock.events.list({ limit: 60 });
      var rows = _rows(res);
      _cache.events = rows;

      var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
                 + '<h3 style="margin:0;font-size:1rem;color:var(--ink);">\u2734 Events</h3>'
                 + '<div>' + _actionBtn('+ New Event', 'TheHarvest._newEvent()') + '</div>'
                 + '</div>';

      _panel(header + _table(
        ['Title', 'Date', 'Time', 'Location', 'Type', 'Recurrence', 'Visibility', 'Status'],
        rows.map(function(r) {
          return [
            _e(r.title || r.name || ''),
            _e(r.date || r.startDate || ''),
            _e(r.time || r.startTime || ''),
            _e(r.location || ''),
            _e(r.type || r.eventType || ''),
            (r.recurring && r.recurring !== 'None')
              ? _badge(_recurLabel(r.recurring), 'info')
              : '<span style="color:var(--ink-muted);font-size:0.75rem;">One-time</span>',
            _visBadge(r.visibility),
            _statusBadge(r.status),
          ];
        }),
        { editFn: 'TheHarvest._editEvent', ids: rows.map(function(r) { return r.id; }) }
      ));
    } catch (e) { _panel(_errHtml(e.message)); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. SERMONS — Sermon table with series toggle
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderSermons() {
    _panel(_spinner());
    try {
      var res = _isFB() ? await UpperRoom.listSermons({ limit: 60 }) : await TheVine.flock.sermons.list({ limit: 60 });
      var rows = _rows(res);
      _cache.sermons = rows;

      var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
                 + '<h3 style="margin:0;font-size:1rem;color:var(--ink);">\uD83C\uDFA4 Sermons</h3>'
                 + '<div style="display:flex;gap:6px;">'
                 + _actionBtn('+ New Sermon', 'TheHarvest._newSermon()')
                 + _actionBtn('Series', 'TheHarvest._sermonSeries()')
                 + '</div></div>';

      _panel(header + _table(
        ['Title', 'Preacher', 'Scripture', 'Series', 'Date', 'Status'],
        rows.map(function(r) {
          return [
            _e(r.title || ''),
            _e(r.preacher || r.speaker || ''),
            _bibleLink(r.scripture || r.scriptureRef || ''),
            _e(r.seriesName || r.series || ''),
            _e(r.deliveredDate || r.date || ''),
            _statusBadge(r.status),
          ];
        }),
        { editFn: 'TheHarvest._editSermon', ids: rows.map(function(r) { return r.id; }) }
      ));
    } catch (e) { _panel(_errHtml(e.message)); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. SERVICES — Service plan table
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderServices() {
    _panel(_spinner());
    try {
      var res = _isFB() ? await UpperRoom.listServicePlans({ limit: 40 }) : await TheVine.flock.servicePlans.list({ limit: 40 });
      var rows = _rows(res);
      _cache.services = rows;

      var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
                 + '<h3 style="margin:0;font-size:1rem;color:var(--ink);">\u26EA Service Plans</h3>'
                 + '<div>' + _actionBtn('+ New Plan', 'TheHarvest._newServicePlan()') + '</div>'
                 + '</div>';

      _panel(header + _table(
        ['Title', 'Date', 'Service Type', 'Theme', 'Lead Pastor', 'Status'],
        rows.map(function(r) {
          return [
            _e(r.title || ''),
            _e(r.date || r.serviceDate || ''),
            _e(r.serviceType || r.type || ''),
            _e(r.theme || ''),
            _e(r.leadPastor || r.leader || ''),
            _statusBadge(r.status),
          ];
        }),
        { editFn: 'TheHarvest._editServicePlan', ids: rows.map(function(r) { return r.id; }) }
      ));
    } catch (e) { _panel(_errHtml(e.message)); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. SONGS — Song catalog with FlockStand launcher
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderSongs() {
    _panel(_spinner());
    try {
      var res = _isFB() ? await UpperRoom.listSongs() : await TheVine.flock.call('songs.list', {});
      var rows = _rows(res);
      _cache.songs = rows;

      var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
                 + '<h3 style="margin:0;font-size:1rem;color:var(--ink);">\uD83C\uDFB5 Songs</h3>'
                 + '<div style="display:flex;gap:6px;">'
                 + _actionBtn('+ Add Song', 'TheHarvest._newSong()')
                 + (typeof openMusicStandApp === 'function'
                     ? _actionBtn('\u266B FlockStand', 'openMusicStandApp()')
                     : '')
                 + '</div></div>';

      _panel(header + _table(
        ['Title', 'Artist', 'Default Key', 'BPM', 'Genre', 'CCLI #'],
        rows.map(function(r) {
          return [
            _e(r.title || ''),
            _e(r.artist || ''),
            _e(r.defaultKey || ''),
            _e(r.tempoBpm || ''),
            _e(r.genre || ''),
            _e(r.ccliNumber || ''),
          ];
        }),
        { editFn: 'TheHarvest._editSong', ids: rows.map(function(r) { return r.id; }) }
      ));
    } catch (e) { _panel(_errHtml(e.message)); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. MINISTRIES — Ministry teams table
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderMinistries() {
    _panel(_spinner());
    try {
      var res = _isFB() ? await UpperRoom.listMinistries() : await TheVine.flock.ministries.list();
      var rows = _rows(res);
      _cache.ministries = rows;

      var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
                 + '<h3 style="margin:0;font-size:1rem;color:var(--ink);">\uD83E\uDD1D Ministries</h3>'
                 + '<div>' + _actionBtn('+ New Ministry', 'TheHarvest._newMinistry()') + '</div>'
                 + '</div>';

      _panel(header + _table(
        ['Name', 'Type', 'Leader', 'Parent', 'Members', 'Status'],
        rows.map(function(r) {
          return [
            _e(r.name || ''),
            _e(r.type || r.ministryType || ''),
            _e(r.leader || r.leaderName || ''),
            _e(r.parentName || r.parent || ''),
            _e(r.memberCount != null ? r.memberCount : ''),
            _statusBadge(r.status || r.active),
          ];
        }),
        { editFn: 'TheHarvest._editMinistry', ids: rows.map(function(r) { return r.id; }) }
      ));
    } catch (e) { _panel(_errHtml(e.message)); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. VOLUNTEERS — Volunteer schedule with member lookup
  // ══════════════════════════════════════════════════════════════════════════

  async function _renderVolunteers() {
    _panel(_spinner());
    try {
      var results = await Promise.all([
        _isFB() ? UpperRoom.listVolunteers({ limit: 60 }) : TheVine.flock.volunteers.list({ limit: 60 }),
        _isFB() ? UpperRoom.memberCardsDirectory() : TheVine.flock.memberCards.directory(),
      ]);
      var rows = _rows(results[0]);
      var dir  = _rows(results[1]);

      var mLookup = {};
      dir.forEach(function(m) {
        mLookup[m.id] = ((m.preferredName || m.firstName || '') + ' ' + (m.lastName || '')).trim();
        if (m.memberNumber) mLookup[m.memberNumber] = mLookup[m.id];
      });

      _cache.volunteers = rows;
      _cache.memberDir = dir;

      var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
                 + '<h3 style="margin:0;font-size:1rem;color:var(--ink);">\uD83D\uDE4B Volunteers</h3>'
                 + '<div>' + _actionBtn('+ Schedule Volunteer', 'TheHarvest._newVolunteer()') + '</div>'
                 + '</div>';

      _panel(header + _table(
        ['Member', 'Role', 'Ministry', 'Service Date', 'Status', ''],
        rows.map(function(r) {
          var mName = mLookup[r.memberId] || r.memberName || r.name || r.email || r.memberId || '';
          var mNum = dir.find(function(d) { return d.id === r.memberId; });
          var cardLinks = mNum
            ? '<a href="javascript:void(0)" onclick="event.stopPropagation();TheHarvest._vcardOpen(\'' + _e(mNum.memberNumber) + '\')" '
              + 'style="color:var(--accent);font-size:0.75rem;margin-right:8px;" title="Download vCard">\u2B07 vCard</a>'
            : '';
          return [
            _e(mName),
            _e(r.role || r.volunteerRole || ''),
            _e(r.ministryTeam || r.ministry || ''),
            _e(r.scheduledDate || r.serviceDate || r.date || ''),
            _statusBadge(r.status),
            cardLinks,
          ];
        }),
        { editFn: 'TheHarvest._editVolunteer', ids: rows.map(function(r) { return r.id; }) }
      ));
    } catch (e) { _panel(_errHtml(e.message)); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CRUD — Create functions (open modals via the_tabernacle.js)
  // ══════════════════════════════════════════════════════════════════════════

  function _newEvent() {
    _modal('New Event', [
      { name: 'title',       label: 'Title',    required: true },
      { name: 'startDate',   label: 'Date',     type: 'date', required: true },
      { name: 'startTime',   label: 'Start Time', type: 'time' },
      { name: 'endTime',     label: 'End Time',   type: 'time' },
      { name: 'location',    label: 'Location' },
      { name: 'eventType',   label: 'Type', type: 'select',
        options: ['Service','Bible Study','Prayer Meeting','Youth Event','Community','Special','Conference','Other'] },
      { name: 'recurring',   label: 'Recurring', type: 'select',
        options: _recurOpts() },
      { name: 'recurringUntil', label: 'Repeat Until', type: 'date' },
      { name: 'visibility',  label: 'Visibility', type: 'select',
        options: _visibilityOpts() },
      { name: 'description', label: 'Description', type: 'textarea' },
    ], async function(data) {
      if (_isFB()) { await UpperRoom.createEvent(data); } else { await TheVine.flock.events.create(data); }
      _toast('Event created', 'success');
      _renderEvents();
    });
  }

  function _newSermon() {
    _modal('New Sermon', [
      { name: 'title',      label: 'Title',              required: true },
      { name: 'preacher',   label: 'Preacher',           required: true },
      { name: 'scripture',  label: 'Scripture Reference' },
      { name: 'seriesName', label: 'Series Name' },
      { name: 'date',       label: 'Delivery Date',      type: 'date' },
      { name: 'notes',      label: 'Notes',              type: 'textarea' },
    ], async function(data) {
      if (_isFB()) { await UpperRoom.createSermon(data); }
      else { await TheVine.flock.sermons.create(data); }
      _toast('Sermon created', 'success');
      _renderSermons();
    });
  }

  function _newServicePlan() {
    _modal('New Service Plan', [
      { name: 'serviceDate',      label: 'Service Date',     type: 'date',     required: true },
      { name: 'serviceType',      label: 'Service Type',     type: 'select',
        options: ['Sunday AM','Sunday PM','Wednesday','Special','Good Friday','Easter','Christmas','Other'] },
      { name: 'theme',            label: 'Theme' },
      { name: 'scriptureFocus',   label: 'Scripture Focus' },
      { name: 'sermonTitle',      label: 'Sermon Title' },
      { name: 'preacherId',       label: 'Preacher (Member ID or Name)' },
      { name: 'worshipLeaderId',  label: 'Worship Leader (Member ID or Name)' },
      { name: 'notes',            label: 'Notes',            type: 'textarea' },
    ], async function(data) {
      if (_isFB()) { await UpperRoom.createServicePlan(data); }
      else { await TheVine.flock.servicePlans.create(data); }
      _toast('Service plan created', 'success');
      _renderServices();
    });
  }

  function _newSong() {
    _modal('Add Song', [
      { name: 'title',       label: 'Title',            required: true },
      { name: 'artist',      label: 'Artist / Band' },
      { name: 'ccliNumber',  label: 'CCLI Number' },
      { name: 'defaultKey',  label: 'Default Key', type: 'select',
        options: ['A','Bb','B','C','C#','D','Eb','E','F','F#','G','Ab'] },
      { name: 'tempoBpm',    label: 'Tempo (BPM)',  type: 'number' },
      { name: 'genre',       label: 'Genre' },
      { name: 'tags',        label: 'Tags (comma-separated)' },
      { name: 'lyrics',      label: 'Lyrics',       type: 'textarea' },
    ], async function(data) {
      if (_isFB()) { await UpperRoom.createSong(data); }
      else { await TheVine.flock.call('songs.create', data); }
      _toast('Song added', 'success');
      _renderSongs();
    });
  }

  function _newMinistry() {
    _modal('New Ministry', [
      { name: 'name',        label: 'Ministry Name', required: true },
      { name: 'type',        label: 'Type', type: 'select',
        options: ['Worship','Youth','Children','Outreach','Prayer','Teaching','Hospitality','Media','Administration','Missions','Pastoral','Other'] },
      { name: 'leader',      label: 'Leader' },
      { name: 'email',       label: 'Ministry Email', type: 'email' },
      { name: 'description', label: 'Description',    type: 'textarea' },
    ], async function(data) {
      if (_isFB()) { await UpperRoom.createMinistry(data); }
      else { await TheVine.flock.ministries.create(data); }
      _toast('Ministry created', 'success');
      _renderMinistries();
    });
  }

  function _newVolunteer() {
    var dir = _cache.memberDir || [];
    var memberOpts = dir.map(function(m) {
      var label = ((m.preferredName || m.firstName || '') + ' ' + (m.lastName || '')).trim();
      return { value: m.id, label: label || m.memberNumber };
    });
    _modal('Schedule Volunteer', [
      { name: 'memberId',    label: 'Member',        type: 'select', required: true,
        options: memberOpts },
      { name: 'role',        label: 'Role',          required: true },
      { name: 'ministryTeam', label: 'Ministry',     type: 'select',
        options: ['Worship','Greeting','Sound','Children','Youth','Outreach','Other'] },
      { name: 'scheduledDate', label: 'Service Date', type: 'date', required: true },
      { name: 'serviceType', label: 'Service Type',  type: 'select',
        options: ['Sunday AM','Sunday PM','Wednesday','Special','Other'] },
      { name: 'notes',       label: 'Notes',         type: 'textarea' },
    ], async function(data) {
      if (_isFB()) { await UpperRoom.createVolunteer(data); }
      else { await TheVine.flock.volunteers.create(data); }
      _toast('Volunteer scheduled', 'success');
      _renderVolunteers();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CRUD — Edit functions (load record then modal)
  // ══════════════════════════════════════════════════════════════════════════

  function _editEvent(id) {
    _edit('events', 'Edit Event', [
      { name: 'title',       label: 'Title',      required: true },
      { name: 'startDate',   label: 'Date',       type: 'date', required: true },
      { name: 'startTime',   label: 'Start Time', type: 'time' },
      { name: 'endTime',     label: 'End Time',   type: 'time' },
      { name: 'location',    label: 'Location' },
      { name: 'eventType',   label: 'Type', type: 'select',
        options: ['Service','Bible Study','Prayer Meeting','Youth Event','Community','Special','Conference','Other'] },
      { name: 'recurring',   label: 'Recurring', type: 'select',
        options: _recurOpts() },
      { name: 'recurringUntil', label: 'Repeat Until', type: 'date' },
      { name: 'visibility',  label: 'Visibility', type: 'select',
        options: _visibilityOpts() },
      { name: 'description', label: 'Description', type: 'textarea' },
    ], function(p) { return _isFB() ? UpperRoom.updateEvent(p) : TheVine.flock.events.update(p); }, id,
       function(p) { return _isFB() ? UpperRoom.getEvent(p.id || p) : TheVine.flock.events.get(p); });
  }

  function _editSermon(id) {
    _edit('sermons', 'Edit Sermon', [
      { name: 'title',      label: 'Title',              required: true },
      { name: 'preacher',   label: 'Preacher',           required: true },
      { name: 'scripture',  label: 'Scripture Reference' },
      { name: 'seriesName', label: 'Series Name' },
      { name: 'date',       label: 'Delivery Date',      type: 'date' },
      { name: 'status',     label: 'Status', type: 'select',
        options: ['draft','submitted','approved','delivered'] },
      { name: 'notes',      label: 'Notes',              type: 'textarea' },
    ], function(p) { return _isFB() ? UpperRoom.updateSermon(p) : TheVine.flock.sermons.update(p); }, id,
       function(p) { return _isFB() ? UpperRoom.getSermon(p.id || p) : TheVine.flock.sermons.get(p); });
  }

  function _editServicePlan(id) {
    _edit('services', 'Edit Service Plan', [
      { name: 'serviceDate',      label: 'Service Date',     type: 'date',     required: true },
      { name: 'serviceType',      label: 'Service Type',     type: 'select',
        options: ['Sunday AM','Sunday PM','Wednesday','Special','Good Friday','Easter','Christmas','Other'] },
      { name: 'theme',            label: 'Theme' },
      { name: 'scriptureFocus',   label: 'Scripture Focus' },
      { name: 'sermonTitle',      label: 'Sermon Title' },
      { name: 'preacherId',       label: 'Preacher (Member ID or Name)' },
      { name: 'worshipLeaderId',  label: 'Worship Leader (Member ID or Name)' },
      { name: 'status',           label: 'Status',           type: 'select',
        options: ['Draft','Confirmed','In Progress','Completed'] },
      { name: 'notes',            label: 'Notes',            type: 'textarea' },
    ], function(p) { return _isFB() ? UpperRoom.updateServicePlan(p) : TheVine.flock.servicePlans.update(p); }, id,
       function(p) { return _isFB() ? UpperRoom.getServicePlan(p.id || p) : TheVine.flock.servicePlans.get(p); });
  }

  function _editSong(id) {
    _edit('songs', 'Edit Song', [
      { name: 'title',      label: 'Title',            required: true },
      { name: 'artist',     label: 'Artist / Band' },
      { name: 'ccliNumber', label: 'CCLI Number' },
      { name: 'defaultKey', label: 'Default Key', type: 'select',
        options: ['A','Bb','B','C','C#','D','Eb','E','F','F#','G','Ab'] },
      { name: 'tempoBpm',   label: 'Tempo (BPM)',  type: 'number' },
      { name: 'genre',      label: 'Genre' },
      { name: 'tags',       label: 'Tags (comma-separated)' },
      { name: 'lyrics',     label: 'Lyrics',       type: 'textarea' },
    ], function(p) { return _isFB() ? UpperRoom.updateSong(p) : TheVine.flock.call('songs.update', p); }, id, null);
  }

  function _editMinistry(id) {
    _edit('ministries', 'Edit Ministry', [
      { name: 'name',        label: 'Ministry Name', required: true },
      { name: 'type',        label: 'Type', type: 'select',
        options: ['Worship','Youth','Children','Outreach','Prayer','Teaching','Hospitality','Media','Administration','Missions','Pastoral','Other'] },
      { name: 'leader',      label: 'Leader' },
      { name: 'email',       label: 'Ministry Email', type: 'email' },
      { name: 'description', label: 'Description',    type: 'textarea' },
    ], function(p) { return _isFB() ? UpperRoom.updateMinistry(p) : TheVine.flock.ministries.update(p); }, id,
       function(p) { return _isFB() ? UpperRoom.getMinistry(p.id || p) : TheVine.flock.ministries.get(p); });
  }

  function _editVolunteer(id) {
    _edit('volunteers', 'Edit Volunteer Schedule', [
      { name: 'role',        label: 'Role',          required: true },
      { name: 'ministryTeam', label: 'Ministry',     type: 'select',
        options: ['Worship','Greeting','Sound','Children','Youth','Outreach','Other'] },
      { name: 'scheduledDate', label: 'Service Date', type: 'date', required: true },
      { name: 'serviceType', label: 'Service Type',  type: 'select',
        options: ['Sunday AM','Sunday PM','Wednesday','Special','Other'] },
      { name: 'status',      label: 'Status',        type: 'select',
        options: ['Scheduled','Confirmed','Declined','No-Show','Completed'] },
      { name: 'notes',       label: 'Notes',         type: 'textarea' },
    ], function(p) { return _isFB() ? UpperRoom.updateVolunteer(p) : TheVine.flock.volunteers.update(p); }, id, null);
  }

  // ── Sermon series helper ────────────────────────────────────────────────
  async function _sermonSeries() {
    _panel(_spinner());
    try {
      var res = _isFB() ? await UpperRoom.listSermonSeries() : await TheVine.flock.sermonSeries.list();
      var rows = _rows(res);

      var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
                 + '<h3 style="margin:0;font-size:1rem;color:var(--ink);">\uD83C\uDFA4 Sermon Series</h3>'
                 + '<div>' + _actionBtn('\u2190 Back to Sermons', 'navigate(\'sermons\')') + '</div>'
                 + '</div>';

      _panel(header + _table(
        ['Series Name', 'Preacher', 'Sermons', 'Start Date', 'Status'],
        rows.map(function(r) {
          return [
            _e(r.name || r.title || ''),
            _e(r.preacher || ''),
            _e(r.sermonCount != null ? r.sermonCount : ''),
            _e(r.startDate || ''),
            _statusBadge(r.status),
          ];
        })
      ));
    } catch (e) { _panel(_errHtml(e.message)); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  return {
    // Hub lifecycle
    renderHub:         renderHub,
    refresh:           refresh,
    switchTab:         switchTab,

    // CRUD — create
    _newEvent:         _newEvent,
    _newSermon:        _newSermon,
    _newServicePlan:   _newServicePlan,
    _newSong:          _newSong,
    _newMinistry:      _newMinistry,
    _newVolunteer:     _newVolunteer,

    // CRUD — edit
    _editEvent:        _editEvent,
    _editSermon:       _editSermon,
    _editServicePlan:  _editServicePlan,
    _editSong:         _editSong,
    _editMinistry:     _editMinistry,
    _editVolunteer:    _editVolunteer,

    // Extras
    _sermonSeries:     _sermonSeries,
    _vcardOpen:        function(memberNumber) {
      var result = _isFB() ? UpperRoom.memberCardsVcard({ memberNumber: memberNumber }) : TheVine.flock.memberCards.vcard({ memberNumber: memberNumber });
      if (typeof result === 'string') { window.open(result); }
      else if (result && typeof result.then === 'function') { result.then(function(u) { if (u) window.open(u); }); }
    },
    resetHome:         function() { _activeTab = 'overview'; },
  };

})();
