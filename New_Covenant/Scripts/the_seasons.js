/* ══════════════════════════════════════════════════════════════════════════════
   THE SEASON — FlockOS Calendar, Tasks & Check-In Hub
   Unified scheduling: church events, personal calendar, iCal feeds,
   task management, and attendance check-in — all in one hub.

   Depends on: Modules (the_tabernacle.js), TheVine (the_true_vine.js),
               Nehemiah (firm_foundation.js)

   "To everything there is a season, and a time to every purpose
    under the heaven." — Ecclesiastes 3:1
   ══════════════════════════════════════════════════════════════════════════════ */

const TheSeason = (() => {
  'use strict';

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

  /** Normalise a time value into "HH:MM" (24-hour).  Handles:
   *  - HH:MM or H:MM           → pass-through / zero-pad
   *  - "h:MM AM/PM"            → convert to 24-hour
   *  - Full Date.toString()    → extract hours/minutes
   *  - ISO datetime strings    → extract T portion           */
  function _fmtTime(v) {
    if (!v) return '';
    var s = String(v).trim();
    var h, m;
    // Already "h:MM AM" / "h:MM PM" → convert to 24-hour
    var ampm = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (ampm) {
      h = parseInt(ampm[1], 10);
      m = ampm[2];
      if (/[Pp]/.test(ampm[3]) && h < 12) h += 12;
      if (/[Aa]/.test(ampm[3]) && h === 12) h = 0;
      return String(h).padStart(2, '0') + ':' + m;
    }
    // ISO "2026-03-23T10:00:00" or bare "10:00"
    var iso = s.match(/(?:T|^)(\d{1,2}):(\d{2})/);
    if (iso) return String(parseInt(iso[1], 10)).padStart(2, '0') + ':' + iso[2];
    // Full Date.toString(): "Sat Dec 30 1899 10:00:00 GMT..."
    var ts = s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) ts += 'T00:00:00';
    var dt = new Date(ts);
    if (!isNaN(dt.getTime())) {
      return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
    }
    return s;  // unrecognised — return as-is
  }

  /** Format "HH:MM" (24-hr) to "h:MM AM/PM" for display */
  function _fmtTime12(v) {
    if (!v) return '';
    var s = _fmtTime(v);
    var p = s.match(/^(\d{1,2}):(\d{2})/);
    if (!p) return s;
    var h = parseInt(p[1], 10);
    var suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + p[2] + ' ' + suffix;
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

  // ── Page shell & body helpers ────────────────────────────────────────────
  function _shell(el, title, desc, actionHtml) {
    el.innerHTML =
      '<div class="page-header"><h1>' + _e(title) + '</h1><p>' + _e(desc) + '</p>'
      + (actionHtml
          ? '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">' + actionHtml + '</div>'
          : '')
      + '</div><div id="ml-body">' + _spinner() + '</div>';
  }

  function _body(el, html) {
    var b = el.querySelector('#ml-body');
    if (b) b.innerHTML = html;
  }

  function _btn(label, fn, primary) {
    var bg = primary !== false
      ? 'background:var(--accent);color:var(--ink-inverse);border:none;font-weight:600;'
      : 'background:none;border:1px solid var(--line);color:var(--ink);';
    return '<button onclick="' + fn + '" style="' + bg
         + 'border-radius:6px;padding:7px 15px;cursor:pointer;font-size:0.83rem;font-family:inherit;">'
         + _e(label) + '</button>';
  }

  // ── Delegation helpers (delegate to Modules) ─────────────────────────────
  function _modal(title, fields, onSave, submitLabel) {
    if (typeof Modules !== 'undefined' && Modules._modal) {
      Modules._modal(title, fields, onSave, submitLabel);
    }
  }
  function _edit(cacheKey, title, fields, updateFn, id, getFn) {
    if (typeof Modules !== 'undefined' && Modules._edit) {
      Modules._edit(cacheKey, title, fields, updateFn, id, getFn);
    }
  }
  function _reload(name) {
    if (typeof Modules !== 'undefined' && Modules._reload) {
      Modules._reload(name);
    }
  }
  function _rows(res) {
    if (typeof Modules !== 'undefined' && Modules._rows) return Modules._rows(res);
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.data && Array.isArray(res.data)) return res.data;
    if (res.rows && Array.isArray(res.rows)) return res.rows;
    return [];
  }
  function _table(cols, rows, opts) {
    if (typeof Modules !== 'undefined' && Modules._table) return Modules._table(cols, rows, opts);
    var html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.82rem;">';
    html += '<thead><tr>';
    cols.forEach(function(c) { html += '<th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--line);color:var(--ink-muted);font-weight:600;">' + _e(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    rows.forEach(function(row) {
      html += '<tr>';
      row.forEach(function(cell) { html += '<td style="padding:8px 10px;border-bottom:1px solid var(--line);">' + (cell || '') + '</td>'; });
      html += '</tr>';
    });
    if (!rows.length) {
      html += '<tr><td colspan="' + cols.length + '" style="padding:24px;text-align:center;color:var(--ink-muted);">No records found</td></tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  // ── Local data cache ────────────────────────────────────────────────────
  var _cache = {};

  // ── Member directory for task assignment (pastor+ only) ────────────────
  var _memberDirPromise = null;
  var _memberDirCache = null;

  function _isPastor() {
    return typeof Nehemiah !== 'undefined' && (Nehemiah.hasRole('pastor') || Nehemiah.hasGroup('Master') || Nehemiah.hasGroup('Seed Admin') || Nehemiah.hasGroup('Lead Pastor'));
  }

  async function _ensureMemberDir() {
    if (_memberDirCache && _memberDirCache.length) return _memberDirCache;
    if (!_memberDirPromise) {
      _memberDirPromise = TheVine.flock.call('members.list', { limit: 200 })
        .then(function(res) {
          _memberDirCache = _rows(res);
          return _memberDirCache;
        })
        .catch(function() { return []; });
    }
    return _memberDirPromise;
  }

  function _memberSelectOpts(dir) {
    return [{ value: '', label: '(myself)' }].concat(
      (dir || []).map(function(m) {
        var name = ((m.preferredName || m.firstName || '') + ' ' + (m.lastName || '')).trim();
        return { value: m.email || m.id, label: name || m.email || m.id };
      }).sort(function(a, b) { return a.label.localeCompare(b.label); })
    );
  }

  function _memberNameFromDir(emailOrId) {
    if (!emailOrId) return '';
    var dir = _memberDirCache || [];
    var key = String(emailOrId).toLowerCase();
    for (var i = 0; i < dir.length; i++) {
      var m = dir[i];
      if ((m.email && m.email.toLowerCase() === key) || m.id === emailOrId) {
        return ((m.preferredName || m.firstName || '') + ' ' + (m.lastName || '')).trim() || emailOrId;
      }
    }
    return emailOrId;
  }


  // ═══════════════════════════════════════════════════════════════════════
  // TODO — Task Management
  // ═══════════════════════════════════════════════════════════════════════

  function _isFB() {
    return typeof Modules !== 'undefined' && Modules._isFirebaseComms && Modules._isFirebaseComms();
  }

  // ── Shared constants ───────────────────────────────────────────────────
  const _TODO_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
  const _TODO_STATUSES   = ['Not Started', 'In Progress', 'Done', 'Archived'];
  const _TODO_CATEGORIES = ['Follow-Up', 'Visit', 'Phone Call', 'Admin', 'Event', 'Other'];
  const _TODO_RECURRENCE = ['Daily', 'Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Yearly'];

  function _priorityColor(p) {
    switch (String(p || '').toLowerCase()) {
      case 'urgent': return 'var(--danger)';
      case 'high':   return '#f59e0b';
      case 'medium': return 'var(--gold, #d4a017)';
      default:       return 'var(--ink-muted)';
    }
  }
  function _priorityIcon(p) {
    switch (String(p || '').toLowerCase()) {
      case 'urgent': return '\u26A0';   // ⚠
      case 'high':   return '\u2B06';   // ⬆
      case 'medium': return '\u2796';   // ➖
      default:       return '\u2B07';   // ⬇
    }
  }
  function _isOverdue(r) {
    if (!r.dueDate) return false;
    if (r.status === 'Done' || r.status === 'Archived') return false;
    return r.dueDate.substring(0, 10) < new Date().toISOString().substring(0, 10);
  }
  function _dueBadge(r) {
    if (!r.dueDate) return '<span style="color:var(--ink-muted);font-size:0.78rem;">No date</span>';
    var d = r.dueDate.substring(0, 10);
    var overdue = _isOverdue(r);
    return '<span style="font-size:0.78rem;font-weight:600;color:'
      + (overdue ? 'var(--danger)' : 'var(--ink)') + ';">'
      + (overdue ? '\u23F0 ' : '') + _e(d) + '</span>';
  }

  // ── Task card renderer ─────────────────────────────────────────────────
  function _taskCard(r) {
    var overdue = _isOverdue(r);
    var done = r.status === 'Done';
    var archived = r.status === 'Archived';
    var borderColor = overdue ? 'var(--danger)' : done ? 'var(--success)' : archived ? 'var(--ink-muted)' : 'var(--line)';
    var opacity = archived ? '0.55' : '1';

    var html = '<div class="todo-card" data-todo-id="' + _e(r.id) + '" style="'
      + 'background:var(--bg-raised);border:1px solid ' + borderColor + ';border-radius:10px;padding:14px 16px;'
      + 'opacity:' + opacity + ';transition:border-color .2s;display:flex;flex-direction:column;gap:8px;">';

    // Row 1: Priority icon + Title + quick-complete
    html += '<div style="display:flex;align-items:center;gap:8px;">'
      + '<span title="' + _e(r.priority || 'Medium') + '" style="font-size:1rem;color:' + _priorityColor(r.priority) + ';">' + _priorityIcon(r.priority) + '</span>'
      + '<span style="flex:1;font-weight:600;font-size:0.92rem;' + (done ? 'text-decoration:line-through;color:var(--ink-muted);' : '') + '">' + _e(r.title || 'Untitled') + '</span>';
    if (!done && !archived) {
      html += '<button onclick="Modules.completeTask(\'' + _e(r.id) + '\')" title="Mark Done" '
        + 'style="background:none;border:1px solid var(--success);color:var(--success);border-radius:50%;'
        + 'width:26px;height:26px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">\u2713</button>';
    }
    html += '</div>';

    // Row 2: Meta chips
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">';
    html += _dueBadge(r);
    html += '<span style="font-size:0.72rem;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.06);color:' + _priorityColor(r.priority) + ';">' + _e(r.priority || 'Medium') + '</span>';
    html += '<span style="font-size:0.72rem;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--ink);">' + _e(r.status || '') + '</span>';
    if (r.category) html += '<span style="font-size:0.72rem;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--accent);">' + _e(r.category) + '</span>';
    if (r.recurring) html += '<span title="Recurring: ' + _e(r.recurrenceRule) + '" style="font-size:0.72rem;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--gold, #d4a017);">\u21BB ' + _e(r.recurrenceRule) + '</span>';
    if (r.entityType) html += '<span style="font-size:0.72rem;padding:2px 7px;border-radius:4px;background:rgba(59,130,246,0.12);color:var(--info, #60a5fa);">\u{1F517} ' + _e(r.entityType) + (r.entityId ? ' #' + _e(r.entityId) : '') + '</span>';
    if (r.assignedTo && _isPastor()) html += '<span style="font-size:0.72rem;padding:2px 7px;border-radius:4px;background:rgba(168,85,247,0.12);color:#a855f7;">\uD83D\uDC64 ' + _e(_memberNameFromDir(r.assignedTo)) + '</span>';
    html += '</div>';

    // Row 3: Description snippet (if present)
    if (r.description) {
      var desc = r.description.length > 120 ? r.description.substring(0, 120) + '\u2026' : r.description;
      html += '<div style="font-size:0.8rem;color:var(--ink-muted);line-height:1.4;">' + _e(desc) + '</div>';
    }

    // Row 4: Action buttons
    html += '<div style="display:flex;gap:6px;margin-top:2px;">';
    html += '<button onclick="Modules.editTask(\'' + _e(r.id) + '\')" style="'
      + 'background:none;border:1px solid var(--line);color:var(--ink);border-radius:5px;'
      + 'padding:4px 10px;cursor:pointer;font-size:0.76rem;font-family:inherit;">Edit</button>';
    if (archived) {
      html += '<button onclick="Modules.unarchiveTask(\'' + _e(r.id) + '\')" style="'
        + 'background:none;border:1px solid var(--accent);color:var(--accent);border-radius:5px;'
        + 'padding:4px 10px;cursor:pointer;font-size:0.76rem;font-family:inherit;">Restore</button>';
    } else if (!done) {
      html += '<button onclick="Modules.archiveTask(\'' + _e(r.id) + '\')" style="'
        + 'background:none;border:1px solid var(--ink-muted);color:var(--ink-muted);border-radius:5px;'
        + 'padding:4px 10px;cursor:pointer;font-size:0.76rem;font-family:inherit;">Archive</button>';
    }
    html += '<button onclick="Modules.deleteTask(\'' + _e(r.id) + '\')" style="'
      + 'background:none;border:1px solid var(--danger);color:var(--danger);border-radius:5px;'
      + 'padding:4px 10px;cursor:pointer;font-size:0.76rem;font-family:inherit;">Delete</button>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  // ── Stat pill for dashboard bar ────────────────────────────────────────
  function _todoPill(label, count, color) {
    return '<div style="display:flex;flex-direction:column;align-items:center;padding:8px 14px;'
      + 'background:var(--bg-raised);border:1px solid var(--line);border-radius:8px;min-width:70px;">'
      + '<span style="font-size:1.3rem;font-weight:700;color:' + (color || 'var(--ink)') + ';">' + count + '</span>'
      + '<span style="font-size:0.7rem;color:var(--ink-muted);white-space:nowrap;">' + _e(label) + '</span></div>';
  }

  // ── Active filter state ────────────────────────────────────────────────
  var _todoFilter = 'active';  // 'all', 'active', 'Not Started', 'In Progress', 'Done', 'Archived', 'overdue'

  function _todoFilterBar(rows) {
    var counts = { all: rows.length, overdue: 0 };
    _TODO_STATUSES.forEach(function(s) { counts[s] = 0; });
    counts['active'] = 0;
    rows.forEach(function(r) {
      counts[r.status] = (counts[r.status] || 0) + 1;
      if (_isOverdue(r)) counts.overdue++;
      if (r.status !== 'Done' && r.status !== 'Archived') counts.active++;
    });

    var filters = [
      { key: 'active',      label: 'Active',      color: 'var(--accent)' },
      { key: 'all',         label: 'All',          color: 'var(--ink)' },
      { key: 'Not Started', label: 'Not Started',  color: 'var(--info, #60a5fa)' },
      { key: 'In Progress', label: 'In Progress',  color: '#f59e0b' },
      { key: 'overdue',     label: 'Overdue',      color: 'var(--danger)' },
      { key: 'Done',        label: 'Done',         color: 'var(--success)' },
      { key: 'Archived',    label: 'Archived',     color: 'var(--ink-muted)' },
    ];

    var html = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">';
    filters.forEach(function(f) {
      var sel = _todoFilter === f.key;
      html += '<button onclick="Modules.todoFilterBy(\'' + f.key + '\')" style="'
        + 'background:' + (sel ? f.color : 'none') + ';color:' + (sel ? '#000' : f.color) + ';'
        + 'border:1px solid ' + f.color + ';border-radius:20px;padding:4px 14px;cursor:pointer;'
        + 'font-size:0.78rem;font-weight:600;font-family:inherit;transition:all .15s;">'
        + _e(f.label) + ' <span style="opacity:0.8;">(' + (counts[f.key] || 0) + ')</span></button>';
    });
    html += '</div>';
    return html;
  }

  function _todoApplyFilter(rows) {
    if (_todoFilter === 'all') return rows;
    if (_todoFilter === 'active') return rows.filter(function(r) { return r.status !== 'Done' && r.status !== 'Archived'; });
    if (_todoFilter === 'overdue') return rows.filter(function(r) { return _isOverdue(r); });
    return rows.filter(function(r) { return r.status === _todoFilter; });
  }

  function todoFilterBy(key) {
    _todoFilter = key;
    var el = document.getElementById('view-todo');
    if (el) _todoRenderBody(el, _cache['todo'] || []);
  }

  // ── Render the body (called after load and after filter change) ────────
  function _todoRenderBody(el, rows) {
    var filtered = _todoApplyFilter(rows);

    // Stats bar
    var overdue = rows.filter(function(r) { return _isOverdue(r); }).length;
    var active  = rows.filter(function(r) { return r.status !== 'Done' && r.status !== 'Archived'; }).length;
    var done    = rows.filter(function(r) { return r.status === 'Done'; }).length;

    var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">'
      + _todoPill('Total', rows.length)
      + _todoPill('Active', active, 'var(--accent)')
      + _todoPill('Done', done, 'var(--success)')
      + _todoPill('Overdue', overdue, overdue > 0 ? 'var(--danger)' : 'var(--ink-muted)')
      + '</div>';

    // Filter bar
    html += _todoFilterBar(rows);

    // Cards grid
    if (filtered.length === 0) {
      html += '<div class="alert alert-info">No tasks match this filter.</div>';
    } else {
      // Sort: overdue first, then by priority weight desc, then by due date asc
      var pw = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
      filtered.sort(function(a, b) {
        var ao = _isOverdue(a) ? 0 : 1;
        var bo = _isOverdue(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        var ap = pw[a.priority] || 0;
        var bp = pw[b.priority] || 0;
        if (ap !== bp) return bp - ap;
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      });
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;">';
      filtered.forEach(function(r) { html += _taskCard(r); });
      html += '</div>';
    }

    _body(el, html);
  }

  // Direct render variant — writes HTML straight into el.innerHTML
  // (used when the element is not wrapped in _shell's #ml-body container)
  function _todoRenderDirect(el, rows) {
    var filtered = _todoApplyFilter(rows);
    var overdue = rows.filter(function(r) { return _isOverdue(r); }).length;
    var active  = rows.filter(function(r) { return r.status !== 'Done' && r.status !== 'Archived'; }).length;
    var done    = rows.filter(function(r) { return r.status === 'Done'; }).length;

    var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">'
      + _todoPill('Total', rows.length)
      + _todoPill('Active', active, 'var(--accent)')
      + _todoPill('Done', done, 'var(--success)')
      + _todoPill('Overdue', overdue, overdue > 0 ? 'var(--danger)' : 'var(--ink-muted)')
      + '</div>';
    html += _todoFilterBar(rows);
    if (filtered.length === 0) {
      html += '<div class="alert alert-info">No tasks match this filter.</div>';
    } else {
      var pw = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
      filtered.sort(function(a, b) {
        var ao = _isOverdue(a) ? 0 : 1;
        var bo = _isOverdue(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        var ap = pw[a.priority] || 0;
        var bp = pw[b.priority] || 0;
        if (ap !== bp) return bp - ap;
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      });
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;">';
      filtered.forEach(function(r) { html += _taskCard(r); });
      html += '</div>';
    }
    el.innerHTML = html;
  }


  // ═══════════════════════════════════════════════════════════════════════
  // CALENDAR STATE & CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  var _calDate  = new Date();           // currently viewed month pivot
  var _calView  = 'day';                // month | week | day | agenda
  var _calEvents = [];                  // merged event pool for current range
  var _session  = {};                   // session passed in via renderCalendar(el, s)
  var _calIcalCache = {};               // keyed by feed URL → parsed entries
  var _calMode  = 'calendar';           // 'calendar' | 'tasks' | 'checkin'
  var _calTZ;                           // IANA timezone from CHURCH_TIMEZONE config

  /** Merge timeZone into locale options when _calTZ is set */
  function _tzOpt(o) { return _calTZ ? Object.assign({ timeZone: _calTZ }, o) : o; }

  var _CAL_SETTINGS_KEY = 'flock_calendar_settings';
  function _calSettings() {
    try { return JSON.parse(localStorage.getItem(_CAL_SETTINGS_KEY) || '{}'); } catch (_) { return {}; }
  }

  /* ──── Color map per event source / type ──────────────────────────── */
  var _calColors = {
    'Service':        'var(--accent)',
    'Bible Study':    'var(--mint)',
    'Prayer Meeting': 'var(--lilac)',
    'Youth Event':    'var(--peach)',
    'Community':      'var(--sky)',
    'Special':        'var(--gold)',
    'Conference':     'var(--rose)',
    'Other':          'var(--ink-muted)',
    '_service':       'var(--accent)',   // from service plans
    '_ical':          'var(--sky)',      // from external feeds
    '_personal':      '#6366f1',        // personal calendar events
    '_task':          '#f59e0b',        // tasks with due dates
  };

  /* ──── Date helpers ───────────────────────────────────────────────── */
  function _calFmt(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }
  function _calMonthName(d) {
    return d.toLocaleString('default', _tzOpt({ month: 'long', year: 'numeric' }));
  }
  function _calDayName(d) { return d.toLocaleString('default', _tzOpt({ weekday: 'short' })); }
  function _calSameDay(a, b) { return _calFmt(a) === _calFmt(b); }
  function _calParse(s) {
    if (!s) return null;
    // Bare ISO dates ("2026-03-24") are parsed as UTC midnight by spec;
    // append time to force local-time interpretation
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00';
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function _calWeekStart(d) {
    var s = _calSettings();
    var startDay = s.weekStart === 'monday' ? 1 : 0;
    var r = new Date(d);
    r.setDate(r.getDate() - ((r.getDay() - startDay + 7) % 7));
    r.setHours(0,0,0,0);
    return r;
  }


  // ═══════════════════════════════════════════════════════════════════════
  // RECURRENCE & VISIBILITY
  // ═══════════════════════════════════════════════════════════════════════

  var _dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var _ordinals = ['First','Second','Third','Fourth','Last'];

  function _recurOpts() {
    var opts = [
      { value: 'None',     label: 'Does not repeat' },
      { value: 'Daily',    label: 'Daily' },
      { value: 'Weekly',   label: 'Weekly' },
      { value: 'Biweekly', label: 'Every 2 weeks' },
      { value: 'Monthly',  label: 'Monthly (same date)' },
    ];
    for (var oi = 0; oi < _ordinals.length; oi++) {
      for (var di = 0; di < 7; di++) {
        var val = _ordinals[oi] + '-' + _dayNames[di];
        opts.push({ value: val, label: _ordinals[oi] + ' ' + _dayNames[di] + ' of month' });
      }
    }
    opts.push({ value: 'Yearly', label: 'Yearly' });
    return opts;
  }

  function _recurLabel(v) {
    if (!v || v === 'None') return '';
    if (v === 'Daily')    return '\uD83D\uDD01 Daily';
    if (v === 'Weekly')   return '\uD83D\uDD01 Weekly';
    if (v === 'Biweekly') return '\uD83D\uDD01 Every 2 wks';
    if (v === 'Monthly')  return '\uD83D\uDD01 Monthly';
    if (v === 'Yearly')   return '\uD83D\uDD01 Yearly';
    var parts = v.split('-');
    if (parts.length === 2) {
      var ord = parts[0], day = parts[1];
      var shortOrd = ord === 'First' ? '1st' : ord === 'Second' ? '2nd'
        : ord === 'Third' ? '3rd' : ord === 'Fourth' ? '4th' : 'Last';
      return '\uD83D\uDD01 ' + shortOrd + ' ' + day.substring(0, 3);
    }
    return '\uD83D\uDD01 ' + v;
  }

  function _visibilityOpts() {
    return [
      { value: 'public',   label: '\uD83C\uDF10 Public' },
      { value: 'members',  label: '\uD83D\uDC65 Members Only' },
      { value: 'leaders',  label: '\uD83D\uDEE1\uFE0F Leaders' },
      { value: 'deacons',  label: '\u26EA Deacons' },
      { value: 'pastors',  label: '\u2720\uFE0F Pastors' },
      { value: 'admins',   label: '\uD83D\uDD12 Admins' },
      { value: 'private',  label: '\uD83D\uDC64 Private (Personal Only)' },
    ];
  }

  function _alertOpts() {
    return [
      { value: '',     label: 'No alert' },
      { value: '5',    label: '5 minutes before' },
      { value: '10',   label: '10 minutes before' },
      { value: '15',   label: '15 minutes before' },
      { value: '30',   label: '30 minutes before' },
      { value: '60',   label: '1 hour before' },
      { value: '120',  label: '2 hours before' },
      { value: '1440', label: '1 day before' },
    ];
  }

  function _visBadge(vis) {
    var v = String(vis || 'public').toLowerCase();
    if (v === 'public')   return _badge('\uD83C\uDF10 Public',   'success');
    if (v === 'members')  return _badge('\uD83D\uDC65 Members',  'info');
    if (v === 'leaders')  return _badge('\uD83D\uDEE1\uFE0F Leaders', 'info');
    if (v === 'deacons')  return _badge('\u26EA Deacons',   'warn');
    if (v === 'pastors')  return _badge('\u2720\uFE0F Pastors',  'warn');
    if (v === 'admins')   return _badge('\uD83D\uDD12 Admins',   'danger');
    if (v === 'private')  return _badge('\uD83D\uDC64 Private',  'danger');
    return _badge(vis, 'info');
  }

  var _roleLevels = {
    readonly: 0, volunteer: 1, care: 2, deacon: 2,
    leader: 3, treasurer: 3, pastor: 4, admin: 5
  };

  var _visRoleMap = {
    'public': 'readonly', 'members': 'volunteer', 'leaders': 'leader',
    'deacons': 'deacon', 'pastors': 'pastor', 'admins': 'admin', 'private': null
  };

  function _canSeeVis(vis, createdBy) {
    var v = String(vis || 'public').toLowerCase();
    if (v === 'public') return true;
    if (v === 'private') {
      var myEmail = (_session.email || '').toLowerCase();
      if (myEmail === (createdBy || '').toLowerCase()) return true;
      return _delegatedOwners.indexOf((createdBy || '').toLowerCase()) >= 0;
    }
    var myRole = String((_session.role || 'readonly')).toLowerCase();
    var myLevel = _roleLevels[myRole] || 0;
    var reqRole = _visRoleMap[v] || 'readonly';
    var reqLevel = _roleLevels[reqRole] || 0;
    return myLevel >= reqLevel;
  }


  // ═══════════════════════════════════════════════════════════════════════
  // RECURRENCE EXPANSION ENGINE
  // ═══════════════════════════════════════════════════════════════════════

  function _calExpandRecurring(ev, rangeStart, rangeEnd) {
    var rec = String(ev.recurring || 'None');
    if (rec === 'None' || !ev.date) return [ev];

    var start = _calParse(ev.date);
    if (!start) return [ev];

    var until = ev.recurringUntil ? _calParse(ev.recurringUntil) : null;
    if (!until) {
      until = new Date(start);
      until.setFullYear(until.getFullYear() + 1);
    }
    var hardEnd = new Date(Math.min(until.getTime(), rangeEnd.getTime()));
    var instances = [];
    var MAX_INSTANCES = 200;

    function inst(d) {
      var copy = {};
      for (var k in ev) { if (ev.hasOwnProperty(k)) copy[k] = ev[k]; }
      copy.date = _calFmt(d);
      copy._recurring = true;
      copy._recurParentId = ev.id;
      return copy;
    }

    if (rec === 'Daily') {
      var d = new Date(Math.max(start.getTime(), rangeStart.getTime()));
      if (d < start) d = new Date(start);
      while (d <= hardEnd && instances.length < MAX_INSTANCES) {
        instances.push(inst(d));
        d = new Date(d); d.setDate(d.getDate() + 1);
      }
    } else if (rec === 'Weekly') {
      var d = new Date(start);
      while (d <= hardEnd && instances.length < MAX_INSTANCES) {
        if (d >= rangeStart) instances.push(inst(d));
        d = new Date(d); d.setDate(d.getDate() + 7);
      }
    } else if (rec === 'Biweekly') {
      var d = new Date(start);
      while (d <= hardEnd && instances.length < MAX_INSTANCES) {
        if (d >= rangeStart) instances.push(inst(d));
        d = new Date(d); d.setDate(d.getDate() + 14);
      }
    } else if (rec === 'Monthly') {
      var d = new Date(start);
      var dayOfMonth = start.getDate();
      while (d <= hardEnd && instances.length < MAX_INSTANCES) {
        if (d >= rangeStart) instances.push(inst(d));
        d = new Date(d);
        d.setMonth(d.getMonth() + 1);
        d.setDate(Math.min(dayOfMonth, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      }
    } else if (rec === 'Yearly') {
      var d = new Date(start);
      while (d <= hardEnd && instances.length < MAX_INSTANCES) {
        if (d >= rangeStart) instances.push(inst(d));
        d = new Date(d); d.setFullYear(d.getFullYear() + 1);
      }
    } else {
      var parts = rec.split('-');
      if (parts.length === 2) {
        var ordinal = parts[0];
        var dayTarget = _dayNames.indexOf(parts[1]);
        if (dayTarget >= 0) {
          var mo = new Date(start.getFullYear(), start.getMonth(), 1);
          while (mo <= hardEnd && instances.length < MAX_INSTANCES) {
            var hit = _nthWeekday(mo.getFullYear(), mo.getMonth(), ordinal, dayTarget);
            if (hit && hit >= rangeStart && hit <= hardEnd && hit >= start) {
              instances.push(inst(hit));
            }
            mo.setMonth(mo.getMonth() + 1);
          }
        }
      }
    }

    return instances.length > 0 ? instances : [];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BROWSER ALERT / NOTIFICATION SYSTEM
  // ═══════════════════════════════════════════════════════════════════════

  var _alertIntervalId = null;
  var _ALERTS_FIRED_KEY = 'flock_alerts_fired_';

  function _alertFiredKey() {
    return _ALERTS_FIRED_KEY + new Date().toISOString().substring(0, 10);
  }

  function _alertGetFired() {
    try { return JSON.parse(localStorage.getItem(_alertFiredKey()) || '[]'); } catch (_) { return []; }
  }

  function _alertMarkFired(key) {
    var fired = _alertGetFired();
    if (fired.indexOf(key) < 0) {
      fired.push(key);
      localStorage.setItem(_alertFiredKey(), JSON.stringify(fired));
    }
  }

  function _alertFire(ev, mins) {
    var minsLabel = mins >= 1440
      ? '1 day'
      : mins >= 60 ? (mins / 60) + ' hour' + (mins / 60 > 1 ? 's' : '')
      : mins + ' min';
    var body = 'In ' + minsLabel + ': ' + (ev.title || 'Event')
      + (ev.time ? ' at ' + _fmtTime12(ev.time) : '')
      + (ev.location ? ' · ' + ev.location : '');
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification('\uD83D\uDCC5 FlockOS Reminder', { body: body, icon: '/favicon.ico' }); } catch (_) {}
    }
    _toast('\u23F0 ' + body, 'info');
  }

  function _alertCheck() {
    if (!_calEvents || !_calEvents.length) return;
    var now = new Date();
    var fired = _alertGetFired();
    _calEvents.forEach(function(ev) {
      if (!ev.alertMinutes || !ev.date || !ev.time) return;
      var alertMins = parseInt(ev.alertMinutes, 10);
      if (!alertMins) return;
      var eventDt = _calParse(ev.date + 'T' + ev.time);
      if (!eventDt) return;
      var alertTime = new Date(eventDt.getTime() - alertMins * 60000);
      var alertKey = String(ev.id || ev.title) + '_' + ev.date + '_' + ev.time + '_' + alertMins;
      var diff = now.getTime() - alertTime.getTime();
      // Fire if we're within the last 60 s of the alert time and haven't fired yet
      if (diff >= 0 && diff < 60000 && fired.indexOf(alertKey) < 0) {
        _alertMarkFired(alertKey);
        _alertFire(ev, alertMins);
      }
    });
  }

  function _alertRequestPermission() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(function() {});
    }
  }

  function _alertStart() {
    _alertRequestPermission();
    if (_alertIntervalId) return;
    _alertCheck(); // run once immediately
    _alertIntervalId = setInterval(_alertCheck, 60000);
  }


  function _nthWeekday(year, month, ordinal, dayTarget) {
    if (ordinal === 'Last') {
      var last = new Date(year, month + 1, 0);
      for (var i = 0; i < 7; i++) {
        var test = new Date(last);
        test.setDate(test.getDate() - i);
        if (test.getDay() === dayTarget) return test;
      }
      return null;
    }
    var ordIdx = { First: 1, Second: 2, Third: 3, Fourth: 4 }[ordinal] || 1;
    var count = 0;
    for (var day = 1; day <= 31; day++) {
      var test = new Date(year, month, day);
      if (test.getMonth() !== month) break;
      if (test.getDay() === dayTarget) {
        count++;
        if (count === ordIdx) return test;
      }
    }
    return null;
  }


  // ═══════════════════════════════════════════════════════════════════════
  // iCAL PARSER & DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════

  function _calParseICS(text, feedLabel) {
    var events = [];
    var blocks = text.split('BEGIN:VEVENT');
    for (var i = 1; i < blocks.length; i++) {
      var b = blocks[i].split('END:VEVENT')[0] || '';
      var get = function(key) {
        var m = b.match(new RegExp(key + '[^:]*:(.+)', 'i'));
        return m ? m[1].replace(/\\n/g, ' ').replace(/\\,/g, ',').trim() : '';
      };
      var dtStart = get('DTSTART');
      var dtEnd   = get('DTEND');
      var parseICal = function(v) {
        if (!v) return null;
        v = v.replace(/[^0-9T]/g, '');
        if (v.length >= 8) {
          var y = v.substring(0,4), mo = v.substring(4,6), da = v.substring(6,8);
          var h = '00', mi = '00';
          if (v.length >= 13) { h = v.substring(9,11); mi = v.substring(11,13); }
          return new Date(y + '-' + mo + '-' + da + 'T' + h + ':' + mi + ':00');
        }
        return null;
      };
      var sd = parseICal(dtStart);
      if (sd) {
        events.push({
          title: get('SUMMARY') || 'External Event',
          date: _calFmt(sd),
          time: sd.getHours() ? (String(sd.getHours()).padStart(2,'0') + ':' + String(sd.getMinutes()).padStart(2,'0')) : '',
          endTime: parseICal(dtEnd) ? (String(parseICal(dtEnd).getHours()).padStart(2,'0') + ':' + String(parseICal(dtEnd).getMinutes()).padStart(2,'0')) : '',
          location: get('LOCATION'),
          type: '_ical',
          description: get('DESCRIPTION'),
          source: feedLabel || 'External',
          visibility: 'public',
        });
      }
    }
    return events;
  }

  /* ──── Delegation cache for visibility checks ──────────────────── */
  var _delegatedOwners = [];

  /* ──── Fetch & merge all calendar sources ─────────────────────────── */
  var _calLoadedAt = 0;
  async function _calLoad(force) {
    // Serve warm data if loaded within 60 sec (unless forced after a mutation)
    if (!force && _calEvents.length && (Date.now() - _calLoadedAt) < 60000) return;

    // ── Resolve church timezone (once) ───────────────────────────────────
    if (!_calTZ) {
      try {
        var tzRes = _isFB()
          ? await UpperRoom.getAppConfig({ key: 'CHURCH_TIMEZONE' })
          : (typeof TheVine !== 'undefined' && TheVine.flock && TheVine.flock.config
              ? await TheVine.flock.config.get({ key: 'CHURCH_TIMEZONE' })
              : null);
        if (tzRes && tzRes.value) _calTZ = tzRes.value;
      } catch (_) { /* fall back to browser locale */ }
    }

    var s = _calSettings();
    var pool = [];

    var rangeStart = new Date(_calDate);
    rangeStart.setMonth(rangeStart.getMonth() - 6);
    rangeStart.setDate(1);
    var rangeEnd = new Date(_calDate);
    rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);

    // ── Fire all API calls in parallel ───────────────────────────────────
    var isSignedIn = !!(
      (typeof Nehemiah !== 'undefined' && Nehemiah.getSession && Nehemiah.getSession()) ||
      (typeof TheVine  !== 'undefined' && TheVine.session    && TheVine.session())
    );
    var promises = [
      isSignedIn
        ? (_isFB() ? UpperRoom.listDelegatedCalendars() : TheVine.flock.call('delegation.calendars', {})).catch(function() { return null; })
        : Promise.resolve(null),
      isSignedIn
        ? (_isFB() ? UpperRoom.listEvents({ limit: 200 }) : TheVine.flock.events.list({ limit: 200 })).catch(function() { return null; })
        : (_isFB() ? UpperRoom.publicEvents({ limit: 200 }) : TheVine.flock.events.public({ limit: 200 })).catch(function() { return null; }),
      isSignedIn && s.showServices !== false
        ? (_isFB() ? UpperRoom.listServicePlans({ limit: 100 }) : TheVine.flock.servicePlans.list({ limit: 100 })).catch(function() { return null; })
        : Promise.resolve(null),
      isSignedIn
        ? (_isFB() ? UpperRoom.listCalendarEvents({}) : TheVine.flock.call('calendar.list', {})).catch(function() { return null; })
        : Promise.resolve(null),
      isSignedIn
        ? (_isFB() ? UpperRoom.listTodos({ limit: 200 }) : TheVine.flock.todo.list({ limit: 200 })).catch(function() { return null; })
        : Promise.resolve(null),
      isSignedIn
        ? TheVine.flock.care.followUps.due().catch(function() { return null; })
        : Promise.resolve(null),
    ];

    // iCal feeds (also in parallel)
    var feeds = [s.icalUrl1, s.icalUrl2, s.icalUrl3].filter(Boolean);
    feeds.forEach(function(url) {
      if (_calIcalCache[url]) {
        promises.push(Promise.resolve({ _cached: url }));
      } else {
        promises.push(
          fetch(url).then(function(resp) {
            return resp.ok ? resp.text().then(function(txt) { return { _icalUrl: url, _icalText: txt }; }) : null;
          }).catch(function() { return null; })
        );
      }
    });

    var results = await Promise.all(promises);
    var delRes = results[0];
    var evRes  = results[1];
    var spRes  = results[2];
    var calRes = results[3];
    var todoRes = results[4];
    var careFollowUpRes = results[5];
    var icalResults = results.slice(6);

    // ── Process delegation ───────────────────────────────────────────────
    _delegatedOwners = delRes ? _rows(delRes).map(function(d) { return d.ownerEmail.toLowerCase(); }) : [];

    // ── 1. Internal events ───────────────────────────────────────────────
    if (evRes) {
      _rows(evRes).forEach(function(r) {
        if ((r.status || '').toLowerCase() === 'archived') return;
        var vis = r.visibility || 'public';
        if (!_canSeeVis(vis, r.createdBy)) return;
        pool.push({
          id: r.id, source: 'Events',
          title: r.title || r.name || '',
          date: String(r.date || r.startDate || '').substring(0, 10),
          time: _fmtTime(r.time || r.startTime || ''),
          endTime: _fmtTime(r.endTime || ''),
          location: r.location || '',
          type: r.type || r.eventType || 'Other',
          visibility: vis,
          status: r.status || '',
          description: r.description || '',
          recurring: r.recurring || 'None',
          recurringUntil: r.recurringUntil || '',
          createdBy: r.createdBy || '',
        });
      });
    }

    // ── 2. Service plans ─────────────────────────────────────────────────
    if (spRes) {
      _rows(spRes).forEach(function(r) {
        pool.push({
          id: r.id, source: 'Service Plan',
          title: (r.serviceType || r.type || 'Service') + ': ' + (r.title || r.theme || ''),
          date: String(r.date || r.serviceDate || '').substring(0, 10),
          time: '', endTime: '',
          location: '', type: '_service',
          visibility: 'public', status: r.status || '',
          description: 'Lead: ' + (r.leadPastor || r.leader || 'TBD'),
        });
      });
    }

    // ── 3. External iCal feeds ───────────────────────────────────────────
    icalResults.forEach(function(r) {
      if (!r) return;
      if (r._cached) {
        pool = pool.concat(_calIcalCache[r._cached]);
      } else if (r._icalUrl && r._icalText) {
        var parsed = _calParseICS(r._icalText, 'Feed');
        _calIcalCache[r._icalUrl] = parsed;
        pool = pool.concat(parsed);
      }
    });

    // ── 3b. Personal calendar events ─────────────────────────────────────
    if (calRes) {
      _rows(calRes).forEach(function(r) {
        var vis = r.Visibility || 'private'; // personal events default to private
        if (!_canSeeVis(vis, r.CreatedBy)) return;
        var startDt = r.StartDateTime || '';
        var endDt = r.EndDateTime || '';
        var dPart = startDt.substring(0, 10);
        var tPart = r.IsAllDay ? '' : (startDt.substring(11, 16) || '');
        var ePart = r.IsAllDay ? '' : (endDt.substring(11, 16) || '');
        pool.push({
          id: r.EventID, source: 'Personal',
          title: r.Title || '',
          date: dPart,
          time: tPart,
          endTime: ePart,
          location: r.Location || '',
          type: '_personal',
          visibility: vis,
          status: '',
          description: r.Description || '',
          recurring: r.RecurrenceRule || 'None',
          recurringUntil: r.RecurringUntil || '',
          alertMinutes: r.AlertMinutes || '',
          createdBy: r.CreatedBy || '',
          color: r.Color || '',
          attendees: r.Attendees || '',
          sharedWith: r.SharedWith || '',
          delegatedTo: r.DelegatedTo || '',
        });
      });
    }

    // ── 5. Tasks with due dates ──────────────────────────────────────────
    if (todoRes) {
      _rows(todoRes).forEach(function(r) {
        var due = String(r.dueDate || r['Due Date'] || '').substring(0, 10);
        if (!due) return;
        var st = (r.status || r['Status'] || '').toLowerCase();
        if (st === 'done' || st === 'completed' || st === 'cancelled') return;
        pool.push({
          id: r.id || r['ID'], source: 'Task',
          title: '\u2611 ' + (r.title || r['Title'] || 'Task'),
          date: due,
          time: '',
          endTime: '',
          location: '',
          type: '_task',
          visibility: 'members',
          status: r.status || r['Status'] || '',
          description: (r.description || r['Description'] || '')
            + (r.assignedTo || r['Assigned To'] ? '\nAssigned: ' + (r.assignedTo || r['Assigned To']) : '')
            + (r.priority || r['Priority'] ? '\nPriority: ' + (r.priority || r['Priority']) : ''),
          recurring: 'None',
        });
      });
    }

    // ── 6. Care follow-ups ─────────────────────────────────────────────
    if (careFollowUpRes) {
      _rows(careFollowUpRes).forEach(function(r) {
        var due = String(r.followUpDate || '').substring(0, 10);
        if (!due) return;
        pool.push({
          id: r.id, source: 'Care',
          title: '\uD83D\uDC9A Follow-up: ' + (r.summary || r.type || 'Care'),
          date: due,
          time: '',
          endTime: '',
          location: '',
          type: '_care',
          visibility: 'members',
          status: r.followUpDone ? 'done' : 'open',
          description: r.summary || '',
          recurring: 'None',
        });
      });
    }

    // 4. Expand recurring events
    var expanded = [];
    pool.forEach(function(ev) {
      var rec = String(ev.recurring || 'None');
      if (rec !== 'None') {
        expanded = expanded.concat(_calExpandRecurring(ev, rangeStart, rangeEnd));
      } else {
        expanded.push(ev);
      }
    });

    _calEvents = expanded;
    _calLoadedAt = Date.now();
    _alertStart();
  }


  // ═══════════════════════════════════════════════════════════════════════
  // EVENT RENDERING
  // ═══════════════════════════════════════════════════════════════════════

  function _calEventsForDate(dateStr) {
    return _calEvents.filter(function(e) { return e.date === dateStr; });
  }

  function _calPill(ev, compact) {
    var bg = ev.color || _calColors[ev.type] || 'var(--ink-muted)';
    var restricted = ev.visibility && ev.visibility !== 'public';
    var visIcon = restricted ? (ev.visibility === 'private' ? '\uD83D\uDC64 ' : '\uD83D\uDD12 ') : '';
    var timeStr = ev.time ? ev.time.substring(0,5) : '';
    if (compact) {
      return '<div class="cal-pill" style="background:' + bg + ';color:#fff;font-size:0.65rem;'
        + 'padding:1px 5px;border-radius:3px;margin:1px 0;white-space:nowrap;overflow:hidden;'
        + 'text-overflow:ellipsis;cursor:pointer;opacity:' + (restricted ? '0.7' : '1') + ';"'
        + ' onclick="Modules.calEventDetail(\'' + _e(ev.id || '') + '\',\'' + _e(ev.title || '') + '\',\'' + _e(ev.date) + '\')" title="' + _e(ev.title) + '">'
        + visIcon + (timeStr ? timeStr + ' ' : '') + _e(ev.title)
        + '</div>';
    }
    return '<div class="cal-event-row" style="display:flex;align-items:center;gap:8px;padding:8px 12px;'
      + 'border-left:3px solid ' + bg + ';background:var(--bg-raised);border-radius:0 var(--radius) var(--radius) 0;'
      + 'margin-bottom:6px;cursor:pointer;" onclick="Modules.calEventDetail(\'' + _e(ev.id || '') + '\',\'' + _e(ev.title || '') + '\',\'' + _e(ev.date) + '\')">'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-weight:600;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
      + (restricted ? '\uD83D\uDD12 ' : '') + _e(ev.title) + '</div>'
      + '<div style="font-size:0.72rem;color:var(--ink-muted);">'
      + (timeStr ? timeStr + (ev.endTime ? ' \u2013 ' + ev.endTime.substring(0,5) : '') + ' \u00B7 ' : '')
      + _e(ev.source || ev.type || '') + (ev.location ? ' \u00B7 ' + _e(ev.location) : '')
      + '</div></div>'
      + (restricted ? '<span style="font-size:0.65rem;background:var(--danger);color:#fff;padding:1px 6px;border-radius:8px;">Private</span>' : '')
      + '</div>';
  }


  // ═══════════════════════════════════════════════════════════════════════
  // GRID VIEWS
  // ═══════════════════════════════════════════════════════════════════════

  /* ──── MONTH VIEW ─────────────────────────────────────────────────── */
  function _calMonthGrid() {
    var s = _calSettings();
    var startDay = s.weekStart === 'monday' ? 1 : 0;
    var year = _calDate.getFullYear(), month = _calDate.getMonth();
    var first = new Date(year, month, 1);
    var last  = new Date(year, month + 1, 0);
    var startOffset = (first.getDay() - startDay + 7) % 7;
    var totalCells = startOffset + last.getDate();
    var rows = Math.ceil(totalCells / 7);
    var today = _calFmt(new Date());

    var dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    if (startDay === 1) dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    var html = '<div class="cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;">';

    dayLabels.forEach(function(d) {
      html += '<div style="background:var(--accent);color:var(--ink-inverse);text-align:center;font-size:0.72rem;font-weight:700;padding:6px 0;letter-spacing:0.5px;">' + d + '</div>';
    });

    for (var i = 0; i < rows * 7; i++) {
      var dayNum = i - startOffset + 1;
      var isValid = dayNum >= 1 && dayNum <= last.getDate();
      var dateStr = isValid ? (year + '-' + String(month + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0')) : '';
      var isToday = dateStr === today;
      var dayEvents = isValid ? _calEventsForDate(dateStr) : [];

      html += '<div class="cal-day-cell" style="background:var(--bg);min-height:82px;padding:3px;position:relative;'
        + (isValid ? 'cursor:pointer;' : 'opacity:0.35;') + '"'
        + (isValid ? ' onclick="Modules.calDayClick(\'' + dateStr + '\')"' : '') + '>';

      if (isValid) {
        html += '<div style="font-size:0.72rem;font-weight:' + (isToday ? '800' : '500') + ';padding:2px 5px;'
          + (isToday ? 'background:var(--accent);color:var(--ink-inverse);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;' : 'color:var(--ink-muted);')
          + '">' + dayNum + '</div>';

        var maxPills = 3;
        for (var p = 0; p < Math.min(dayEvents.length, maxPills); p++) {
          html += _calPill(dayEvents[p], true);
        }
        if (dayEvents.length > maxPills) {
          html += '<div style="font-size:0.6rem;color:var(--accent);padding:0 5px;font-weight:600;">+' + (dayEvents.length - maxPills) + ' more</div>';
        }
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  /* ──── Time helper ────────────────────────────────────────────────── */
  function _calTimeToMins(t) {
    if (!t) return 0;
    var parts = String(t).split(':');
    return parseInt(parts[0], 10) * 60 + (parseInt(parts[1] || '0', 10));
  }

  /* ──── WEEK VIEW ──────────────────────────────────────────────────── */
  function _calWeekGrid() {
    var ws = _calWeekStart(_calDate);
    var today = _calFmt(new Date());
    var s = _calSettings();
    var startHour = parseInt(s.workStart || '6', 10);
    var endHour   = parseInt(s.workEnd || '22', 10);
    var HOUR_H    = 60; // px per hour
    var totalH    = (endHour - startHour) * HOUR_H;

    // Outer wrapper: header row + body row using CSS grid
    var html = '<div style="display:grid;grid-template-columns:50px repeat(7,1fr);gap:1px;background:var(--line);'
      + 'border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;">';

    // ── Header row ──
    html += '<div style="background:var(--bg-raised);padding:4px;"></div>';
    for (var d = 0; d < 7; d++) {
      var wd = new Date(ws);
      wd.setDate(wd.getDate() + d);
      var isToday = _calFmt(wd) === today;
      html += '<div style="background:' + (isToday ? 'var(--accent)' : 'var(--bg-raised)') + ';color:'
        + (isToday ? 'var(--ink-inverse)' : 'var(--ink)') + ';text-align:center;padding:6px 2px;font-size:0.72rem;font-weight:700;">'
        + _calDayName(wd) + ' ' + wd.getDate() + '</div>';
    }

    // ── Time-label column ──
    var timeLabels = '';
    for (var h = startHour; h < endHour; h++) {
      var lbl = h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p';
      timeLabels += '<div style="height:' + HOUR_H + 'px;font-size:0.62rem;color:var(--ink-muted);'
        + 'padding:2px 4px;text-align:right;border-top:1px solid var(--line);box-sizing:border-box;">' + lbl + '</div>';
    }
    html += '<div style="background:var(--bg-raised);">' + timeLabels + '</div>';

    // ── 7 day columns: absolutely-positioned events ──
    for (var d2 = 0; d2 < 7; d2++) {
      var wd2 = new Date(ws);
      wd2.setDate(wd2.getDate() + d2);
      var ds = _calFmt(wd2);
      var dayEvs = _calEventsForDate(ds);
      var timedEvs = dayEvs.filter(function(ev) { return ev.time; });

      // Hour boundary lines
      var bgLines = '';
      for (var hl = 0; hl < (endHour - startHour); hl++) {
        bgLines += '<div style="position:absolute;left:0;right:0;top:' + (hl * HOUR_H) + 'px;'
          + 'border-top:1px solid var(--line);"></div>';
      }

      // Event blocks
      var evBlocks = '';
      timedEvs.forEach(function(ev) {
        var startMins = _calTimeToMins(ev.time);
        var endMins   = ev.endTime ? _calTimeToMins(ev.endTime) : startMins + 60;
        var topPx     = (startMins - startHour * 60) * (HOUR_H / 60);
        var heightPx  = Math.max(18, (endMins - startMins) * (HOUR_H / 60));
        if (topPx < 0) { heightPx += topPx; topPx = 0; }
        if (topPx >= totalH) return;
        heightPx = Math.min(heightPx, totalH - topPx);
        var bg = ev.color || (_calColors && _calColors[ev.type]) || 'var(--accent)';
        evBlocks += '<div onclick="event.stopPropagation();Modules.calEventDetail(\'' + _e(ev.id || '') + '\',\''
          + _e(ev.title || '') + '\',\'' + ev.date + '\')" title="' + _e(ev.title || '') + '"'
          + ' style="position:absolute;left:2px;right:2px;top:' + topPx.toFixed(1) + 'px;height:' + heightPx.toFixed(1) + 'px;'
          + 'background:' + bg + ';border-radius:3px;padding:2px 4px;overflow:hidden;cursor:pointer;'
          + 'box-sizing:border-box;z-index:1;opacity:0.92;">'
          + '<div style="font-size:0.6rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
          + _e(ev.title || '') + '</div>'
          + (heightPx > 30 && ev.time ? '<div style="font-size:0.58rem;color:rgba(255,255,255,0.85);">'
            + ev.time.substring(0,5) + (ev.endTime ? '–' + ev.endTime.substring(0,5) : '') + '</div>' : '')
          + '</div>';
      });

      html += '<div style="position:relative;height:' + totalH + 'px;background:var(--bg);cursor:pointer;"'
        + ' onclick="Modules.calDayClick(\'' + ds + '\')">' + bgLines + evBlocks + '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ──── DAY VIEW ───────────────────────────────────────────────────── */
  function _calDayGrid() {
    var today = _calFmt(new Date());
    var ds = _calFmt(_calDate);
    var isToday = ds === today;
    var dayEvents = _calEventsForDate(ds);
    var s = _calSettings();
    var startHour = parseInt(s.workStart || '6', 10);
    var endHour   = parseInt(s.workEnd || '22', 10);
    var HOUR_H    = 60; // px per hour
    var totalH    = (endHour - startHour) * HOUR_H;

    var html = '<div style="text-align:center;margin-bottom:12px;">'
      + '<div style="font-size:1.6rem;font-weight:800;color:' + (isToday ? 'var(--accent)' : 'var(--ink)') + ';">'
      + _calDate.toLocaleString('default', _tzOpt({ weekday: 'long' })) + '</div>'
      + '<div style="font-size:0.85rem;color:var(--ink-muted);">'
      + _calDate.toLocaleDateString('default', _tzOpt({ month: 'long', day: 'numeric', year: 'numeric' })) + '</div>'
      + '</div>';

    // All-day / unscheduled events
    var unscheduled = dayEvents.filter(function(ev) { return !ev.time; });
    if (unscheduled.length) {
      html += '<div style="padding:8px 12px;border:1px solid var(--line);border-radius:var(--radius);'
        + 'margin-bottom:8px;background:var(--bg-raised);">';
      html += '<div style="font-size:0.72rem;font-weight:700;color:var(--accent);margin-bottom:4px;">All Day</div>';
      unscheduled.forEach(function(ev) { html += _calPill(ev, false); });
      html += '</div>';
    }

    // Time grid
    html += '<div style="display:flex;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;">';

    // Time labels column
    html += '<div style="width:65px;flex-shrink:0;background:var(--bg-raised);border-right:1px solid var(--line);">';
    for (var h = startHour; h < endHour; h++) {
      var hourLabel = h === 0 ? '12 AM' : h < 12 ? h + ' AM' : h === 12 ? '12 PM' : (h - 12) + ' PM';
      html += '<div style="height:' + HOUR_H + 'px;font-size:0.72rem;color:var(--ink-muted);'
        + 'padding:4px 8px;text-align:right;border-top:1px solid var(--line);box-sizing:border-box;">' + hourLabel + '</div>';
    }
    html += '</div>';

    // Event column (absolutely positioned)
    var bgLines = '';
    for (var hl = 0; hl < (endHour - startHour); hl++) {
      bgLines += '<div style="position:absolute;left:0;right:0;top:' + (hl * HOUR_H) + 'px;'
        + 'border-top:1px solid var(--line);"></div>';
    }

    var timedEvs = dayEvents.filter(function(ev) { return ev.time; });
    var evBlocks = '';
    timedEvs.forEach(function(ev) {
      var startMins = _calTimeToMins(ev.time);
      var endMins   = ev.endTime ? _calTimeToMins(ev.endTime) : startMins + 60;
      var topPx     = (startMins - startHour * 60) * (HOUR_H / 60);
      var heightPx  = Math.max(22, (endMins - startMins) * (HOUR_H / 60));
      if (topPx < 0) { heightPx += topPx; topPx = 0; }
      if (topPx >= totalH) return;
      heightPx = Math.min(heightPx, totalH - topPx);
      var bg = ev.color || (_calColors && _calColors[ev.type]) || 'var(--accent)';
      evBlocks += '<div onclick="Modules.calEventDetail(\'' + _e(ev.id || '') + '\',\''
        + _e(ev.title || '') + '\',\'' + ev.date + '\')"'
        + ' style="position:absolute;left:6px;right:6px;top:' + topPx.toFixed(1) + 'px;height:' + heightPx.toFixed(1) + 'px;'
        + 'background:' + bg + ';border-radius:6px;padding:5px 10px;overflow:hidden;cursor:pointer;'
        + 'box-sizing:border-box;z-index:1;opacity:0.93;">'
        + '<div style="font-size:0.84rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
        + _e(ev.title || '') + '</div>'
        + (heightPx > 36 && ev.time ? '<div style="font-size:0.72rem;color:rgba(255,255,255,0.85);">'
          + _fmtTime12(ev.time) + (ev.endTime ? ' \u2013 ' + _fmtTime12(ev.endTime) : '') + '</div>' : '')
        + (heightPx > 52 && ev.location ? '<div style="font-size:0.7rem;color:rgba(255,255,255,0.75);">' + _e(ev.location) + '</div>' : '')
        + '</div>';
    });

    html += '<div style="flex:1;position:relative;height:' + totalH + 'px;background:var(--bg);">'
      + bgLines + evBlocks + '</div>';
    html += '</div>';
    return html;
  }

  /* ──── AGENDA VIEW ────────────────────────────────────────────────── */
  function _calAgendaView() {
    var start = new Date(_calDate);
    start.setHours(0,0,0,0);
    var html = '';
    var found = 0;

    for (var d = 0; d < 30; d++) {
      var check = new Date(start);
      check.setDate(check.getDate() + d);
      var ds = _calFmt(check);
      var dayEvs = _calEventsForDate(ds);
      if (!dayEvs.length) continue;
      found += dayEvs.length;

      var isToday = ds === _calFmt(new Date());
      html += '<div style="margin-bottom:16px;">';
      html += '<div style="font-size:0.78rem;font-weight:700;color:' + (isToday ? 'var(--accent)' : 'var(--ink)') + ';padding:6px 0;border-bottom:2px solid ' + (isToday ? 'var(--accent)' : 'var(--line)') + ';margin-bottom:6px;">'
        + (isToday ? '\u2605 TODAY \u2014 ' : '')
        + check.toLocaleDateString('default', _tzOpt({ weekday: 'long', month: 'long', day: 'numeric' }))
        + '</div>';

      dayEvs.sort(function(a, b) {
        return (a.time || '99:99').localeCompare(b.time || '99:99');
      });
      dayEvs.forEach(function(ev) { html += _calPill(ev, false); });
      html += '</div>';
    }

    if (!found) {
      html += _empty('\uD83D\uDCC5', 'Clear Schedule', 'No events in the next 30 days. Enjoy the peace.');
    }
    return html;
  }


  // ═══════════════════════════════════════════════════════════════════════
  // EVENT DETAIL & NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════

  function calEventDetail(id, title, date) {
    var ev = _calEvents.find(function(e) {
      return (e.id && e.id === id) || (e.title === title && e.date === date);
    });
    if (!ev) { ev = { title: title, date: date }; }

    var html = '<div style="font-size:0.88rem;line-height:1.8;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:8px;">';
    html += '<span style="font-weight:700;font-size:1rem;">' + _e(ev.title) + '</span>';
    if (ev.visibility && ev.visibility !== 'public') html += _visBadge(ev.visibility);
    html += '</div>';

    var alertLabel = '';
    if (ev.alertMinutes) {
      var _am = parseInt(ev.alertMinutes, 10);
      alertLabel = _am >= 1440 ? '1 day before'
        : _am >= 60 ? (_am / 60) + ' hour' + (_am / 60 > 1 ? 's' : '') + ' before'
        : _am + ' min before';
    }
    var detailRows = [
      ['\uD83D\uDCC5', 'Date', ev.date],
      ['\uD83D\uDD52', 'Time', ev.time ? _fmtTime12(ev.time) + (ev.endTime ? ' \u2013 ' + _fmtTime12(ev.endTime) : '') : 'All Day'],
      ['\uD83D\uDCCD', 'Location', ev.location],
      ['\uD83C\uDFF7\uFE0F', 'Type', ev.type === '_service' ? 'Service Plan' : ev.type === '_ical' ? 'External' : ev.type],
      ['\uD83D\uDCE1', 'Source', ev.source],
      ['\uD83D\uDCCB', 'Status', ev.status],
      ['\u23F0', 'Alert', alertLabel],
    ];
    detailRows.forEach(function(r) {
      if (r[2]) {
        html += '<div style="display:flex;gap:8px;padding:3px 0;">'
          + '<span>' + r[0] + '</span>'
          + '<span style="color:var(--ink-muted);min-width:65px;">' + r[1] + '</span>'
          + '<span style="font-weight:500;">' + _e(r[2]) + '</span></div>';
      }
    });
    if (ev.description) {
      html += '<div style="margin-top:10px;padding:10px;background:var(--bg);border-radius:var(--radius);font-size:0.82rem;color:var(--ink-muted);line-height:1.6;">' + _e(ev.description) + '</div>';
    }
    var shareText = ev.title + (ev.date ? ' \u2014 ' + ev.date : '') + (ev.time ? ' at ' + _fmtTime12(ev.time) : '') + (ev.location ? ' \u00B7 ' + ev.location : '');
    html += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);display:flex;gap:8px;">';
    html += '<button type="button" onclick="Modules._trumpetShare(\'' + _e(ev.title) + '\',\'' + _e(shareText).replace(/'/g, "\\'") + '\')" style="flex:1;padding:7px;background:none;border:1px solid var(--line);border-radius:var(--radius);cursor:pointer;color:var(--ink);font-size:0.78rem;">\uD83D\uDCE4 Share Event</button>';
    html += '</div>';
    // RSVP row for church events
    if (ev.source === 'Events' && ev.id) {
      html += '<div style="display:flex;gap:8px;margin-top:8px;">';
      html += '<button type="button" onclick="Modules.rsvpToEvent(\'' + _e(ev.id) + '\')" style="flex:1;padding:7px;background:none;border:1px solid var(--success);border-radius:var(--radius);cursor:pointer;color:var(--success);font-size:0.78rem;font-weight:600;">\u2705 RSVP</button>';
      html += '<button type="button" onclick="Modules.viewEventRsvps(\'' + _e(ev.id) + '\')" style="flex:1;padding:7px;background:none;border:1px solid var(--line);border-radius:var(--radius);cursor:pointer;color:var(--ink);font-size:0.78rem;">\uD83D\uDCCB View RSVPs</button>';
      html += '</div>';
    }
    if (ev.source === 'Personal') {
      html += '<div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">';
      html += '<button type="button" onclick="Modules.calEditPersonal(\'' + _e(ev.id) + '\')" style="flex:1;padding:8px;background:var(--accent);color:var(--ink-inverse);border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;">\u270F\uFE0F Edit</button>';
      html += '<button type="button" onclick="Modules.calDeletePersonal(\'' + _e(ev.id) + '\')" style="flex:1;padding:8px;background:var(--danger);color:#fff;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;">\uD83D\uDDD1\uFE0F Delete</button>';
      html += '</div>';
    }
    if (ev.source === 'Service Plan' && ev.id) {
      var _svcLabel = _e((ev.type !== '_service' ? ev.type : ev.title) || ev.title || 'Service Plan').replace(/'/g, "\\'");
      html += '<div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">';
      html += '<button type="button" onclick="var _m=document.getElementById(\'fl-modal\');if(_m)_m.remove();navigate(\'services\');Modules._svcOpen(\'' + _e(ev.id) + '\',\'' + _svcLabel + '\')" style="flex:1;padding:8px;background:var(--accent);color:var(--ink-inverse);border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-size:0.82rem;">✏️ Open &amp; Edit in Services</button>';
      html += '</div>';
    }
    if (ev.source === 'Events' && ev.id) {
      var isCancelled = (ev.status || '').toLowerCase() === 'cancelled';
      var myRole = String((_session.role || 'readonly')).toLowerCase();
      var canDelete = myRole === 'admin' || myRole === 'pastor';
      html += '<div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);flex-wrap:wrap;">';
      if (!isCancelled) {
        html += '<button type="button" onclick="Modules.calEditEvent(\'' + _e(ev.id) + '\')" style="flex:1;padding:8px;background:var(--accent);color:var(--ink-inverse);border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-size:0.82rem;">✏️ Edit</button>';
        html += '<button type="button" onclick="Modules.calArchiveEvent(\'' + _e(ev.id) + '\')" style="flex:1;padding:8px;background:var(--gold,#d97706);color:#fff;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-size:0.82rem;">📦 Archive</button>';
        html += '<button type="button" onclick="Modules.calCancelEvent(\'' + _e(ev.id) + '\')" style="flex:1;padding:8px;background:var(--danger);color:#fff;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-size:0.82rem;">✖ Cancel</button>';
      } else {
        html += '<button type="button" onclick="Modules.calEditEvent(\'' + _e(ev.id) + '\')" style="flex:1;padding:8px;background:var(--accent);color:var(--ink-inverse);border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-size:0.82rem;">✏️ Edit / Restore</button>';
      }
      if (canDelete) {
        html += '<button type="button" onclick="Modules.calDeleteEvent(\'' + _e(ev.id) + '\')" style="width:100%;padding:8px;background:var(--danger);color:#fff;border:none;border-radius:var(--radius);cursor:pointer;font-weight:600;font-size:0.82rem;margin-top:4px;">🗑️ Delete Permanently</button>';
      }
      html += '</div>';
    }
    html += '</div>';

    _modal('Event Details', [{ name: '_detail', type: 'html', html: html }], function() { return Promise.resolve(); }, 'Close');
  }

  function calDayClick(dateStr) {
    _calDate = new Date(dateStr + 'T12:00:00');
    _calView = 'day';
    _calRender(document.getElementById('cal-body'));
  }

  function calNav(dir) {
    if (_calView === 'month') {
      _calDate.setMonth(_calDate.getMonth() + dir);
    } else if (_calView === 'week') {
      _calDate.setDate(_calDate.getDate() + (7 * dir));
    } else {
      _calDate.setDate(_calDate.getDate() + dir);
    }
    _calRender(document.getElementById('cal-body'));
    _calUpdateHeader();
  }

  function calToday() {
    _calDate = new Date();
    _calRender(document.getElementById('cal-body'));
    _calUpdateHeader();
  }

  function calSetView(view) {
    _calView = view;
    _calRender(document.getElementById('cal-body'));
    _calUpdateHeader();
  }

  function _calUpdateHeader() {
    var titleEl = document.getElementById('cal-title');
    if (titleEl) {
      if (_calView === 'month') titleEl.textContent = _calMonthName(_calDate);
      else if (_calView === 'week') {
        var ws = _calWeekStart(_calDate);
        var we = new Date(ws); we.setDate(we.getDate() + 6);
        titleEl.textContent = ws.toLocaleDateString('default', _tzOpt({ month: 'short', day: 'numeric' })) + ' \u2013 ' + we.toLocaleDateString('default', _tzOpt({ month: 'short', day: 'numeric', year: 'numeric' }));
      } else if (_calView === 'day') {
        titleEl.textContent = _calDate.toLocaleDateString('default', _tzOpt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
      } else {
        titleEl.textContent = 'Upcoming \u00B7 30 Days';
      }
    }
    ['month','week','day','agenda'].forEach(function(v) {
      var btn = document.getElementById('cal-vbtn-' + v);
      if (btn) {
        btn.style.background = v === _calView ? 'var(--accent)' : 'transparent';
        btn.style.color = v === _calView ? 'var(--ink-inverse)' : 'var(--ink-muted)';
      }
    });
  }

  function _calRender(container) {
    if (!container) return;
    var html = '';
    if (_calView === 'month')      html = _calMonthGrid();
    else if (_calView === 'week')  html = _calWeekGrid();
    else if (_calView === 'day')   html = _calDayGrid();
    else                           html = _calAgendaView();
    container.innerHTML = html;
  }


  // ═══════════════════════════════════════════════════════════════════════
  // EVENT CRUD
  // ═══════════════════════════════════════════════════════════════════════

  function calQuickAdd() {
    var prefill = _calFmt(_calDate);
    _modal('Quick Add Event', [
      { name: 'title',       label: 'Title',    required: true },
      { name: 'startDate',   label: 'Date',     type: 'date', required: true, value: prefill },
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
      await _calLoad(true);
      _calRender(document.getElementById('cal-body'));
    });
  }

  function calNewPersonal() {
    var prefill = _calFmt(_calDate);
    var myEmail = (_session && _session.email) ? _session.email : '';
    _modal('New Personal Event', [
      { name: 'Title',         label: 'Title',        required: true },
      { name: 'startDate',     label: 'Date',         type: 'date', required: true, value: prefill },
      { name: 'startTime',     label: 'Start Time',   type: 'time' },
      { name: 'endTime',       label: 'End Time',     type: 'time' },
      { name: 'Location',      label: 'Location' },
      { name: 'Description',   label: 'Description',  type: 'textarea' },
      { name: 'Color',         label: 'Color',        type: 'color', value: '#6366f1' },
      { name: 'IsAllDay',      label: 'All Day',      type: 'select',
        options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }] },
      { name: 'RecurrenceRule', label: 'Recurring',   type: 'select', options: _recurOpts() },
      { name: 'RecurringUntil', label: 'Repeat Until', type: 'date' },
      { name: 'AlertMinutes',  label: 'Alert',        type: 'select', options: _alertOpts() },
      { name: 'Visibility',    label: 'Visibility',   type: 'select', options: _visibilityOpts(), value: 'private' },
    ], async function(data) {
      var start = data.startDate + (data.startTime ? 'T' + data.startTime : '');
      var end   = data.startDate + (data.endTime   ? 'T' + data.endTime   : '');
      var calData = {
        Title: data.Title, StartDateTime: start, EndDateTime: end,
        Location: data.Location, Description: data.Description,
        Color: data.Color, IsAllDay: data.IsAllDay === 'true',
        RecurrenceRule: data.RecurrenceRule,
        RecurringUntil: data.RecurringUntil || '',
        AlertMinutes: data.AlertMinutes || '',
        Visibility: data.Visibility || 'private',
        CreatedBy: myEmail,
      };
      if (_isFB()) { await UpperRoom.createCalendarEvent(calData); }
      else { await TheVine.flock.call('calendar.create', calData); }
      await _calLoad(true);
      _calRender(document.getElementById('cal-body'));
    });
  }

  async function calEditPersonal(eventId) {
    var overlay = document.getElementById('fl-modal');
    if (overlay) overlay.remove();

    var res;
    try {
      res = _isFB()
        ? await UpperRoom.getCalendarEvent(eventId)
        : await TheVine.flock.call('calendar.get', { eventId: eventId });
    } catch (err) {
      alert('Could not load event: ' + (err.message || 'Unknown error'));
      return;
    }
    var ev = (res && (res.row || res.data)) || res || {};
    var startDt = ev.StartDateTime || '';
    var endDt   = ev.EndDateTime   || '';

    var myEmail = (_session && _session.email) ? _session.email : (ev.CreatedBy || '');
    _modal('Edit Personal Event', [
      { name: 'Title',         label: 'Title',        required: true, value: ev.Title || '' },
      { name: 'startDate',     label: 'Date',         type: 'date', required: true, value: startDt.substring(0, 10) },
      { name: 'startTime',     label: 'Start Time',   type: 'time', value: ev.IsAllDay ? '' : startDt.substring(11, 16) },
      { name: 'endTime',       label: 'End Time',     type: 'time', value: ev.IsAllDay ? '' : endDt.substring(11, 16) },
      { name: 'Location',      label: 'Location',     value: ev.Location || '' },
      { name: 'Description',   label: 'Description',  type: 'textarea', value: ev.Description || '' },
      { name: 'Color',         label: 'Color',        type: 'color', value: ev.Color || '#6366f1' },
      { name: 'IsAllDay',      label: 'All Day',      type: 'select',
        options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }],
        value: ev.IsAllDay ? 'true' : 'false' },
      { name: 'RecurrenceRule', label: 'Recurring',   type: 'select', options: _recurOpts(), value: ev.RecurrenceRule || 'None' },
      { name: 'RecurringUntil', label: 'Repeat Until', type: 'date', value: (ev.RecurringUntil || '').substring(0, 10) },
      { name: 'AlertMinutes',  label: 'Alert',        type: 'select', options: _alertOpts(), value: ev.AlertMinutes || '' },
      { name: 'Visibility',    label: 'Visibility',   type: 'select', options: _visibilityOpts(), value: ev.Visibility || 'private' },
    ], async function(data) {
      var start = data.startDate + (data.startTime ? 'T' + data.startTime : '');
      var end   = data.startDate + (data.endTime   ? 'T' + data.endTime   : '');
      var calUpdate = {
        EventID: eventId,
        Title: data.Title, StartDateTime: start, EndDateTime: end,
        Location: data.Location, Description: data.Description,
        Color: data.Color, IsAllDay: data.IsAllDay === 'true',
        RecurrenceRule: data.RecurrenceRule,
        RecurringUntil: data.RecurringUntil || '',
        AlertMinutes: data.AlertMinutes || '',
        Visibility: data.Visibility || 'private',
        CreatedBy: myEmail,
      };
      if (_isFB()) { await UpperRoom.updateCalendarEvent(calUpdate); }
      else { await TheVine.flock.call('calendar.update', calUpdate); }
      await _calLoad(true);
      _calRender(document.getElementById('cal-body'));
    }, 'Save');
  }

  async function calDeletePersonal(eventId) {
    var overlay = document.getElementById('fl-modal');
    if (overlay) overlay.remove();
    if (!confirm('Delete this event? This cannot be undone.')) return;
    if (_isFB()) { await UpperRoom.deleteCalendarEvent(eventId); }
    else { await TheVine.flock.call('calendar.delete', { EventID: eventId }); }
    await _calLoad(true);
    _calRender(document.getElementById('cal-body'));
  }

  async function calDeleteEvent(eventId) {
    var overlay = document.getElementById('fl-modal');
    if (overlay) overlay.remove();
    if (!confirm('Permanently delete this event? This cannot be undone.')) return;
    if (_isFB()) { await UpperRoom.deleteEvent(eventId); }
    else { await TheVine.flock.events.delete({ id: eventId }); }
    await _calLoad(true);
    _calRender(document.getElementById('cal-body'));
  }


  // ── Church-event management (Events source) ──────────────────────────

  async function calEditEvent(eventId) {
    var overlay = document.getElementById('fl-modal');
    if (overlay) overlay.remove();

    var res;
    try {
      res = _isFB()
        ? await UpperRoom.getEvent(eventId)
        : await TheVine.flock.events.get({ id: eventId });
    } catch (err) {
      alert('Could not load event: ' + (err.message || 'Unknown error'));
      return;
    }
    var ev = (res && (res.row || res.data)) || res || {};

    _modal('Edit Event', [
      { name: 'title',           label: 'Title',         required: true, value: ev.title || '' },
      { name: 'startDate',       label: 'Date',          type: 'date', required: true, value: (ev.startDate || '').substring(0, 10) },
      { name: 'startTime',       label: 'Start Time',    type: 'time', value: _fmtTime(ev.startTime) },
      { name: 'endTime',         label: 'End Time',      type: 'time', value: _fmtTime(ev.endTime) },
      { name: 'location',        label: 'Location',      value: ev.location || '' },
      { name: 'eventType',       label: 'Type',          type: 'select',
        options: ['Service','Bible Study','Prayer Meeting','Youth Event','Community','Special','Conference','Other'],
        value: ev.eventType || 'Other' },
      { name: 'status',          label: 'Status',        type: 'select',
        options: ['Planned','Confirmed','In Progress','Completed','Cancelled'],
        value: ev.status || 'Planned' },
      { name: 'recurring',       label: 'Recurring',     type: 'select', options: _recurOpts(), value: ev.recurring || 'None' },
      { name: 'recurringUntil',  label: 'Repeat Until',  type: 'date', value: (ev.recurringUntil || '').substring(0, 10) },
      { name: 'visibility',      label: 'Visibility',    type: 'select', options: _visibilityOpts(), value: ev.visibility || 'public' },
      { name: 'ministryTeam',    label: 'Ministry Team', value: ev.ministryTeam || '' },
      { name: 'contactPerson',   label: 'Contact',       value: ev.contactPerson || '' },
      { name: 'capacity',        label: 'Capacity',      type: 'number', value: ev.capacity || '' },
      { name: 'rsvpRequired',    label: 'RSVP Required', type: 'select',
        options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }],
        value: ev.rsvpRequired ? 'true' : 'false' },
      { name: 'description',     label: 'Description',   type: 'textarea', value: ev.description || '' },
      { name: 'notes',           label: 'Notes',         type: 'textarea', value: ev.notes || '' },
    ], async function(data) {
      data.id = eventId;
      if (data.rsvpRequired) data.rsvpRequired = data.rsvpRequired === 'true';
      if (data.capacity) data.capacity = parseInt(data.capacity, 10) || 0;
      if (_isFB()) { await UpperRoom.updateEvent(data); } else { await TheVine.flock.events.update(data); }
      _toast('Event updated');
      await _calLoad(true);
      _calRender(document.getElementById('cal-body'));
    }, 'Save');
  }

  async function calArchiveEvent(eventId) {
    var overlay = document.getElementById('fl-modal');
    if (overlay) overlay.remove();
    if (!confirm('Archive this event? It will be hidden from the calendar.')) return;
    if (_isFB()) { await UpperRoom.updateEvent({ id: eventId, status: 'Archived' }); }
    else { await TheVine.flock.events.update({ id: eventId, status: 'Archived' }); }
    _toast('Event archived');
    await _calLoad(true);
    _calRender(document.getElementById('cal-body'));
  }

  async function calCancelEvent(eventId) {
    var overlay = document.getElementById('fl-modal');
    if (overlay) overlay.remove();
    if (!confirm('Cancel this event? Attendees will see it marked as cancelled.')) return;
    if (_isFB()) { await UpperRoom.cancelEvent(eventId); } else { await TheVine.flock.events.cancel({ id: eventId }); }
    _toast('Event cancelled');
    await _calLoad(true);
    _calRender(document.getElementById('cal-body'));
  }


  // ═══════════════════════════════════════════════════════════════════════
  // EVENT RSVP
  // ═══════════════════════════════════════════════════════════════════════

  function rsvpToEvent(eventId) {
    _modal('RSVP to Event', [
      { name: 'response',   label: 'Response', type: 'select', required: true,
        options: ['Attending', 'Maybe', 'Declined'] },
      { name: 'guestCount', label: 'Guest Count', type: 'number', value: '0' },
      { name: 'notes',      label: 'Notes',    type: 'textarea' },
    ], async function(data) {
      data.eventId = eventId;
      if (data.guestCount) data.guestCount = parseInt(data.guestCount, 10) || 0;
      if (_isFB()) { await UpperRoom.rsvpEvent(data); } else { await TheVine.flock.events.rsvp(data); }
      _toast('RSVP submitted!');
    }, 'Submit RSVP');
  }

  async function viewEventRsvps(eventId) {
    try {
      var res = _isFB()
        ? await UpperRoom.listRsvps({ eventId: eventId })
        : await TheVine.flock.events.rsvpList({ eventId: eventId });
      var rows = _rows(res);

      var attending = rows.filter(function(r) { return r.response === 'Attending'; });
      var maybe    = rows.filter(function(r) { return r.response === 'Maybe'; });
      var declined = rows.filter(function(r) { return r.response === 'Declined'; });
      var totalGuests = rows.reduce(function(sum, r) { return sum + (parseInt(r.guestCount, 10) || 0); }, 0);

      var html = '<div style="font-size:0.88rem;line-height:1.6;">';
      // Stats bar
      html += '<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">';
      html += '<div style="text-align:center;padding:8px 14px;background:var(--bg);border:1px solid var(--line);border-radius:8px;min-width:65px;">'
        + '<div style="font-size:1.2rem;font-weight:700;color:var(--success);">' + attending.length + '</div><div style="font-size:0.7rem;color:var(--ink-muted);">Attending</div></div>';
      html += '<div style="text-align:center;padding:8px 14px;background:var(--bg);border:1px solid var(--line);border-radius:8px;min-width:65px;">'
        + '<div style="font-size:1.2rem;font-weight:700;color:var(--gold,#d4a017);">' + maybe.length + '</div><div style="font-size:0.7rem;color:var(--ink-muted);">Maybe</div></div>';
      html += '<div style="text-align:center;padding:8px 14px;background:var(--bg);border:1px solid var(--line);border-radius:8px;min-width:65px;">'
        + '<div style="font-size:1.2rem;font-weight:700;color:var(--danger);">' + declined.length + '</div><div style="font-size:0.7rem;color:var(--ink-muted);">Declined</div></div>';
      html += '<div style="text-align:center;padding:8px 14px;background:var(--bg);border:1px solid var(--line);border-radius:8px;min-width:65px;">'
        + '<div style="font-size:1.2rem;font-weight:700;color:var(--ink);">' + totalGuests + '</div><div style="font-size:0.7rem;color:var(--ink-muted);">Guests</div></div>';
      html += '</div>';

      // RSVP list
      if (rows.length === 0) {
        html += '<div style="text-align:center;color:var(--ink-muted);padding:20px;">No RSVPs yet.</div>';
      } else {
        rows.forEach(function(r) {
          var respColor = r.response === 'Attending' ? 'var(--success)' : r.response === 'Declined' ? 'var(--danger)' : 'var(--gold,#d4a017)';
          var name = _memberNameFromDir(r.memberId || r.memberEmail || r.email || '');
          html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);">'
            + '<span style="flex:1;font-weight:500;">' + _e(name || 'Unknown') + '</span>'
            + '<span style="font-size:0.78rem;padding:2px 8px;border-radius:4px;background:' + respColor + ';color:#fff;font-weight:600;">' + _e(r.response || '') + '</span>';
          if (r.guestCount && parseInt(r.guestCount, 10) > 0) {
            html += '<span style="font-size:0.75rem;color:var(--ink-muted);">+' + _e(r.guestCount) + ' guest' + (parseInt(r.guestCount, 10) > 1 ? 's' : '') + '</span>';
          }
          html += '</div>';
          if (r.notes) {
            html += '<div style="padding:2px 0 6px 0;font-size:0.78rem;color:var(--ink-muted);font-style:italic;">' + _e(r.notes) + '</div>';
          }
        });
      }
      html += '</div>';

      _modal('RSVP List (' + rows.length + ')', [{ name: '_detail', type: 'html', html: html }], function() { return Promise.resolve(); }, 'Close');
    } catch (e) { alert('Could not load RSVPs: ' + (e.message || 'Unknown error')); }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // SUBSCRIBE & SYNC
  // ═══════════════════════════════════════════════════════════════════════

  function _calFeedUrl(shareToken) {
    // Firebase mode: the token value is already a full Cloud Function feed URL
    if (_isFB() && shareToken && shareToken.indexOf('cloudfunctions.net/') >= 0
        && (shareToken.indexOf('https://') === 0 || shareToken.indexOf('http://') === 0)) {
      return shareToken;
    }
    var base = '';
    if (typeof TheVine !== 'undefined' && TheVine.config) {
      var eps = TheVine.config.FLOCK_ENDPOINTS || [];
      base = eps[0] || TheVine.config.FLOCK_URL || '';
    }
    if (!base) return '';
    var url = base + '?action=calendar.ics';
    if (shareToken) url += '&shareToken=' + encodeURIComponent(shareToken);
    return url;
  }

  function _calGenerateICS() {
    var orgName = 'FlockOS Church';
    try { var el = document.querySelector('[data-org-name]'); if (el) orgName = el.dataset.orgName; } catch (_) {}

    var ical = 'BEGIN:VCALENDAR\r\n';
    ical += 'VERSION:2.0\r\n';
    ical += 'PRODID:-//FlockOS//Church CRM Calendar//EN\r\n';
    ical += 'CALSCALE:GREGORIAN\r\n';
    ical += 'METHOD:PUBLISH\r\n';
    ical += 'X-WR-CALNAME:' + orgName + ' Calendar\r\n';
    ical += 'X-WR-TIMEZONE:' + (_calTZ || 'America/New_York') + '\r\n';

    (_calEvents || []).forEach(function(ev) {
      var uid = (ev.id || Math.random().toString(36).substring(2)) + '@flockos';
      var dateClean = String(ev.date || '').replace(/-/g, '');
      if (!dateClean) return;

      ical += 'BEGIN:VEVENT\r\n';
      ical += 'UID:' + uid + '\r\n';

      if (ev.time) {
        var t = String(ev.time).replace(/:/g, '');
        if (t.length === 4) t += '00';
        ical += 'DTSTART:' + dateClean + 'T' + t + '\r\n';
        if (ev.endTime) {
          var et = String(ev.endTime).replace(/:/g, '');
          if (et.length === 4) et += '00';
          ical += 'DTEND:' + dateClean + 'T' + et + '\r\n';
        }
      } else {
        ical += 'DTSTART;VALUE=DATE:' + dateClean + '\r\n';
        ical += 'DTEND;VALUE=DATE:' + dateClean + '\r\n';
      }

      ical += 'SUMMARY:' + _icsEsc(ev.title || 'Event') + '\r\n';
      if (ev.location)    ical += 'LOCATION:' + _icsEsc(ev.location) + '\r\n';
      if (ev.description) ical += 'DESCRIPTION:' + _icsEsc(ev.description) + '\r\n';
      if (ev.type && ev.type !== '_ical' && ev.type !== '_service')
        ical += 'CATEGORIES:' + _icsEsc(ev.type) + '\r\n';
      ical += 'STATUS:CONFIRMED\r\n';
      ical += 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '').substring(0, 15) + 'Z\r\n';
      ical += 'END:VEVENT\r\n';
    });

    ical += 'END:VCALENDAR\r\n';
    return ical;
  }

  function _icsEsc(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;')
      .replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  function calDownloadICS() {
    var ics = _calGenerateICS();
    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'flockos-calendar.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function _calCopyUrl(btnId) {
    var inp = document.getElementById(btnId + '-url');
    if (!inp) return;
    navigator.clipboard.writeText(inp.value).then(function() {
      var btn = document.getElementById(btnId);
      if (btn) {
        var orig = btn.textContent;
        btn.textContent = '\u2713 Copied!';
        setTimeout(function() { btn.textContent = orig; }, 1800);
      }
    });
  }

  async function calSubscribe() {
    var publicUrl = _calFeedUrl();
    var personalUrl = '';
    var shareToken = '';

    try {
      if (_isFB()) {
        // Firebase mode: use UpperRoom to get/create a share token linked to a
        // Cloud Function iCal endpoint
        var fbRes = await UpperRoom.getCalendarShareToken({});
        if (fbRes && fbRes.feedUrl) {
          personalUrl = fbRes.feedUrl;
          shareToken  = fbRes.shareToken;
          // In Firebase mode the public URL is the same Cloud Function endpoint
          // without a token (returns only public events)
          if (!publicUrl && fbRes.feedUrl) {
            // Derive the public URL by stripping the token query param
            publicUrl = fbRes.feedUrl.split('?')[0];
          }
        }
      } else {
        var res = await TheVine.flock.call('calendar.shareToken', {});
        if (res && res.ok && res.shareToken) {
          shareToken  = res.shareToken;
          personalUrl = _calFeedUrl(shareToken);
        }
      }
    } catch (_) {}

    var h = '';

    h += '<div style="margin-bottom:18px;font-size:0.85rem;color:var(--ink-muted);line-height:1.6;">'
      + 'Subscribe to this calendar in Google Calendar, Apple Calendar, Outlook, or any app that supports iCal feeds. '
      + 'The feed updates automatically as events change.</div>';

    if (publicUrl) {
      h += '<div style="margin-bottom:16px;">';
      h += '<label style="font-size:0.78rem;font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">'
        + '\uD83C\uDF10 Public Calendar Feed</label>';
      h += '<p style="font-size:0.72rem;color:var(--ink-muted);margin:0 0 6px;">All public events \u2014 share with anyone.</p>';
      h += '<div style="display:flex;gap:6px;">';
      h += '<input id="cal-sub-public-url" type="text" value="' + _e(publicUrl) + '" readonly '
        + 'style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:0.78rem;'
        + 'background:var(--bg-sunken);color:var(--ink);font-family:monospace;">';
      h += '<button id="cal-sub-public" onclick="Modules._calCopyUrl(\'cal-sub-public\')" '
        + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;padding:8px 14px;'
        + 'cursor:pointer;font-size:0.78rem;font-weight:600;white-space:nowrap;">Copy URL</button>';
      h += '</div></div>';
    }

    if (personalUrl) {
      var sess = _session && _session.role ? _session : (typeof session !== 'undefined' ? session : {});
      var myRole = (sess.role || 'readonly').toLowerCase();
      // In Firebase mode the personalUrl is already the full Cloud Function URL;
      // appending role is only meaningful for GAS-based feeds.
      var displayUrl = _isFB() ? personalUrl : (personalUrl + '&role=' + encodeURIComponent(myRole));

      h += '<div style="margin-bottom:16px;">';
      h += '<label style="font-size:0.78rem;font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">'
        + '\uD83D\uDD12 Personal Calendar Feed</label>';
      h += '<p style="font-size:0.72rem;color:var(--ink-muted);margin:0 0 6px;">'
        + 'Your personal feed includes your private events and all events up to your role level. Keep this URL private.</p>';
      h += '<div style="display:flex;gap:6px;">';
      h += '<input id="cal-sub-personal-url" type="text" value="' + _e(displayUrl) + '" readonly '
        + 'style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:0.78rem;'
        + 'background:var(--bg-sunken);color:var(--ink);font-family:monospace;">';
      h += '<button id="cal-sub-personal" onclick="Modules._calCopyUrl(\'cal-sub-personal\')" '
        + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;padding:8px 14px;'
        + 'cursor:pointer;font-size:0.78rem;font-weight:600;white-space:nowrap;">Copy URL</button>';
      h += '</div>';

      h += '<div style="margin-top:6px;">';
      h += '<button onclick="Modules.calRegenToken()" '
        + 'style="background:none;border:none;color:var(--ink-muted);cursor:pointer;font-size:0.7rem;'
        + 'text-decoration:underline;padding:0;">Regenerate share token</button>';
      h += '</div>';
      h += '</div>';
    }

    h += '<div style="margin-bottom:20px;padding:14px;border:1px solid var(--line);border-radius:8px;background:var(--bg-sunken);">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;">';
    h += '<div>';
    h += '<div style="font-size:0.82rem;font-weight:700;color:var(--ink);">\u2B07\uFE0F Download Calendar File</div>';
    h += '<div style="font-size:0.72rem;color:var(--ink-muted);margin-top:2px;">Download a snapshot of all ' + (_calEvents || []).length + ' loaded events as an .ics file.</div>';
    h += '</div>';
    h += '<button onclick="Modules.calDownloadICS()" '
      + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;padding:8px 18px;'
      + 'cursor:pointer;font-size:0.8rem;font-weight:600;white-space:nowrap;">Download .ics</button>';
    h += '</div></div>';

    h += '<div style="border-top:1px solid var(--line);padding-top:16px;">';
    h += '<div style="font-size:0.82rem;font-weight:800;color:var(--ink);margin-bottom:12px;">How to Subscribe</div>';

    var instructions = [
      { app: 'Google Calendar', icon: '\uD83D\uDFE2', steps: 'Open Google Calendar \u2192 Settings (gear icon) \u2192 <strong>Add calendar</strong> \u2192 <strong>From URL</strong> \u2192 Paste the feed URL \u2192 <strong>Add calendar</strong>.' },
      { app: 'Apple Calendar', icon: '\uD83D\uDFE3', steps: 'Open Calendar \u2192 File \u2192 <strong>New Calendar Subscription</strong> \u2192 Paste the feed URL \u2192 Choose refresh interval \u2192 <strong>Subscribe</strong>.' },
      { app: 'Outlook', icon: '\uD83D\uDD35', steps: 'Open Outlook Calendar \u2192 <strong>Add calendar</strong> \u2192 <strong>Subscribe from web</strong> \u2192 Paste the feed URL \u2192 <strong>Import</strong>.' },
      { app: 'Other Apps', icon: '\u2699\uFE0F', steps: 'Look for an <strong>\u201CAdd calendar by URL\u201D</strong> or <strong>\u201CSubscribe to calendar\u201D</strong> option in your calendar app and paste the feed URL.' }
    ];

    instructions.forEach(function(inst) {
      h += '<div style="margin-bottom:10px;padding:10px 12px;border:1px solid var(--line);border-radius:6px;background:var(--bg);">';
      h += '<div style="font-size:0.78rem;font-weight:700;color:var(--ink);margin-bottom:4px;">';
      h += inst.icon + ' ' + _e(inst.app) + '</div>';
      h += '<div style="font-size:0.72rem;color:var(--ink-muted);line-height:1.5;">' + inst.steps + '</div>';
      h += '</div>';
    });
    h += '</div>';

    var overlay = document.createElement('div');
    overlay.id = 'cal-subscribe-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);'
      + 'display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg);border-radius:12px;padding:28px;max-width:560px;width:100%;'
      + 'max-height:85vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,0.25);';
    modal.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">'
      + '<h3 style="margin:0;font-size:1.1rem;color:var(--ink);">\uD83D\uDCC5 Subscribe & Sync</h3>'
      + '<button onclick="document.getElementById(\'cal-subscribe-overlay\').remove()" '
      + 'style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--ink-muted);padding:0;">\u2715</button>'
      + '</div>' + h;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  async function calRegenToken() {
    if (!confirm('Regenerate share token? This will invalidate all existing personal feed URLs.')) return;
    try {
      var newUrl = '';
      if (_isFB()) {
        var fbRes = await UpperRoom.getCalendarShareToken({ regenerate: true });
        if (fbRes && fbRes.feedUrl) {
          newUrl = fbRes.feedUrl;
        } else {
          alert('Failed to regenerate token.');
          return;
        }
      } else {
        var res = await TheVine.flock.call('calendar.shareToken', { regenerate: 'true' });
        if (res && res.ok && res.shareToken) {
          newUrl = _calFeedUrl(res.shareToken);
        } else {
          alert('Failed to regenerate token.');
          return;
        }
      }
      var inp = document.getElementById('cal-sub-personal-url');
      if (inp) inp.value = newUrl;
      alert('Share token regenerated. Update your calendar subscriptions with the new URL.');
    } catch (e) { alert('Error: ' + e.message); }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // MODE TAB BAR
  // ═══════════════════════════════════════════════════════════════════════

  function _calModeBar() {
    var modes = [
      { id: 'calendar', label: '\uD83D\uDCC5 Calendar' },
      { id: 'tasks',    label: '\u2611 Tasks' },
      { id: 'checkin',  label: '\u2714 Check-In' },
    ];
    var html = '<div style="display:flex;gap:2px;margin-bottom:16px;border-bottom:2px solid var(--line);padding-bottom:8px;">';
    modes.forEach(function(m) {
      var active = _calMode === m.id;
      html += '<button onclick="Modules.calSwitchMode(\'' + m.id + '\')" '
        + 'style="padding:8px 18px;border:none;border-radius:6px 6px 0 0;cursor:pointer;'
        + 'font-size:0.85rem;font-family:inherit;font-weight:' + (active ? '700' : '500') + ';'
        + 'transition:all 0.2s;'
        + (active
          ? 'background:var(--accent);color:var(--ink-inverse);'
          : 'background:transparent;color:var(--ink-muted);')
        + '">' + m.label + '</button>';
    });
    html += '</div>';
    return html;
  }

  function calSwitchMode(mode) {
    _calMode = mode;
    var el = document.getElementById('view-calendar');
    if (!el) return;
    renderCalendar(el);
  }


  // ═══════════════════════════════════════════════════════════════════════
  // DELEGATION
  // ═══════════════════════════════════════════════════════════════════════

  async function calDelegation() {
    var myDelegations = [];
    var delegatedToMe = [];

    try {
      var res = await TheVine.flock.call('delegation.list', {});
      var rows = _rows(res);
      var sess = (typeof session !== 'undefined') ? session : {};
      var myEmail = (sess.email || '').toLowerCase();
      rows.forEach(function(d) {
        if (d.ownerEmail.toLowerCase() === myEmail) myDelegations.push(d);
        else delegatedToMe.push(d);
      });
    } catch (_) {}

    var h = '';

    h += '<div style="margin-bottom:16px;font-size:0.85rem;color:var(--ink-muted);line-height:1.6;">'
      + 'Delegation lets you share your <strong>private</strong> calendar events with trusted team members. '
      + 'Delegates can view (but not edit) your personal events on the calendar.</div>';

    h += '<div style="margin-bottom:20px;padding:14px;border:1px solid var(--line);border-radius:8px;background:var(--bg-sunken);">';
    h += '<div style="font-size:0.82rem;font-weight:700;color:var(--ink);margin-bottom:8px;">\u2795 Grant Calendar Access</div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    h += '<input id="del-email" type="email" placeholder="Delegate\u2019s email address" '
      + 'style="flex:1;min-width:200px;padding:8px 10px;border:1px solid var(--line);border-radius:6px;'
      + 'font-size:0.82rem;background:var(--bg);color:var(--ink);">';
    h += '<select id="del-perm" style="padding:8px 10px;border:1px solid var(--line);border-radius:6px;'
      + 'font-size:0.82rem;background:var(--bg);color:var(--ink);">';
    h += '<option value="view">View Only</option>';
    h += '<option value="manage">View & Manage</option>';
    h += '</select>';
    h += '<button onclick="Modules._calGrantDelegation()" '
      + 'style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;padding:8px 16px;'
      + 'cursor:pointer;font-size:0.82rem;font-weight:600;">Grant</button>';
    h += '</div></div>';

    h += '<div style="margin-bottom:16px;">';
    h += '<div style="font-size:0.82rem;font-weight:700;color:var(--ink);margin-bottom:8px;">'
      + '\uD83D\uDD13 People Who Can See My Calendar</div>';
    if (myDelegations.length === 0) {
      h += '<div style="font-size:0.8rem;color:var(--ink-muted);padding:8px 0;">No active delegations.</div>';
    } else {
      myDelegations.forEach(function(d) {
        h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;'
          + 'border:1px solid var(--line);border-radius:6px;margin-bottom:4px;background:var(--bg-raised);">';
        h += '<div>';
        h += '<span style="font-weight:600;font-size:0.82rem;">' + _e(d.delegateEmail) + '</span>';
        h += ' <span style="font-size:0.72rem;color:var(--ink-muted);">(' + _e(d.permission) + ')</span>';
        if (d.expiresAt) h += ' <span style="font-size:0.68rem;color:var(--ink-muted);">expires ' + _e(d.expiresAt) + '</span>';
        h += '</div>';
        h += '<button onclick="Modules._calRevokeDelegation(\'' + _e(d.id) + '\')" '
          + 'style="background:var(--danger);color:#fff;border:none;border-radius:4px;padding:4px 10px;'
          + 'cursor:pointer;font-size:0.72rem;font-weight:600;">Revoke</button>';
        h += '</div>';
      });
    }
    h += '</div>';

    h += '<div style="margin-bottom:16px;">';
    h += '<div style="font-size:0.82rem;font-weight:700;color:var(--ink);margin-bottom:8px;">'
      + '\uD83D\uDCC5 Calendars Shared With Me</div>';
    if (delegatedToMe.length === 0) {
      h += '<div style="font-size:0.8rem;color:var(--ink-muted);padding:8px 0;">No one has shared their calendar with you yet.</div>';
    } else {
      delegatedToMe.forEach(function(d) {
        h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;'
          + 'border:1px solid var(--line);border-radius:6px;margin-bottom:4px;background:var(--bg-raised);">';
        h += '<span style="font-weight:600;font-size:0.82rem;">' + _e(d.ownerEmail) + '</span>';
        h += ' <span style="font-size:0.72rem;color:var(--ink-muted);">(' + _e(d.permission) + ')</span>';
        h += '</div>';
      });
    }
    h += '</div>';

    h += '<div style="border-top:1px solid var(--line);padding-top:12px;font-size:0.75rem;color:var(--ink-muted);line-height:1.6;">'
      + '<strong>How delegation works:</strong><br>'
      + '\u2022 <strong>View</strong> permission lets the delegate see your private calendar events.<br>'
      + '\u2022 <strong>Manage</strong> permission also lets them create/edit events on your behalf.<br>'
      + '\u2022 Only events marked <strong>\uD83D\uDC64 Private</strong> are affected \u2014 church-wide events '
      + '(Public, Members, Leaders, etc.) are visible based on role.'
      + '</div>';

    var overlay = document.createElement('div');
    overlay.id = 'cal-delegation-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);';
    overlay.innerHTML = '<div style="background:var(--bg-raised);border-radius:12px;padding:24px;'
      + 'max-width:560px;width:calc(100% - 32px);max-height:85vh;overflow-y:auto;'
      + 'box-shadow:0 24px 48px rgba(0,0,0,0.5);border:1px solid var(--line);">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
      + '<h3 style="margin:0;font-size:1.1rem;color:var(--ink);">\uD83D\uDC65 Calendar Delegation</h3>'
      + '<button onclick="document.getElementById(\'cal-delegation-overlay\').remove()" '
      + 'style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--ink-muted);">\u2715</button>'
      + '</div>' + h + '</div>';
    document.body.appendChild(overlay);
  }

  async function _calGrantDelegation() {
    var emailEl = document.getElementById('del-email');
    var permEl = document.getElementById('del-perm');
    if (!emailEl || !emailEl.value.trim()) { alert('Please enter a delegate email.'); return; }

    try {
      await TheVine.flock.call('delegation.grant', {
        delegateEmail: emailEl.value.trim(),
        permission: permEl ? permEl.value : 'view'
      });
      var ov = document.getElementById('cal-delegation-overlay');
      if (ov) ov.remove();
      await calDelegation();
    } catch (e) { alert('Error: ' + (e.message || e)); }
  }

  async function _calRevokeDelegation(id) {
    if (!confirm('Revoke this delegation?')) return;
    try {
      await TheVine.flock.call('delegation.revoke', { id: id });
      var ov = document.getElementById('cal-delegation-overlay');
      if (ov) ov.remove();
      await calDelegation();
    } catch (e) { alert('Error: ' + (e.message || e)); }
  }

  async function calRefresh() {
    _calIcalCache = {};
    await _calLoad(true);
    _calRender(document.getElementById('cal-body'));
  }


  // ═══════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════════════

  function _calSettingsSave() {
    var obj = {};
    var selDefView = document.getElementById('cal-s-defaultView');
    var selWeek    = document.getElementById('cal-s-weekStart');
    var inpStart   = document.getElementById('cal-s-workStart');
    var inpEnd     = document.getElementById('cal-s-workEnd');
    var togServices   = document.getElementById('cal-s-showServices');
    var togAttendance = document.getElementById('cal-s-showAttendance');

    if (selDefView) obj.defaultView = selDefView.value;
    if (selWeek)    obj.weekStart   = selWeek.value;
    if (inpStart)   obj.workStart   = parseInt(inpStart.value, 10) || 6;
    if (inpEnd)     obj.workEnd     = parseInt(inpEnd.value, 10) || 22;
    if (togServices)   obj.showServices   = togServices.checked;
    if (togAttendance) obj.showAttendance = togAttendance.checked;

    var togMissions      = document.getElementById('cal-s-showMissions');
    var togDiscipleship  = document.getElementById('cal-s-showDiscipleship');
    var togVolunteers    = document.getElementById('cal-s-showVolunteers');
    if (togMissions)     obj.showMissions     = togMissions.checked;
    if (togDiscipleship) obj.showDiscipleship = togDiscipleship.checked;
    if (togVolunteers)   obj.showVolunteers   = togVolunteers.checked;

    var selDefVis        = document.getElementById('cal-s-defaultVisibility');
    var togShowRestrict  = document.getElementById('cal-s-showRestrictedTitles');
    if (selDefVis)       obj.defaultVisibility    = selDefVis.value;
    if (togShowRestrict) obj.showRestrictedTitles = togShowRestrict.checked;

    var togAcceptDel   = document.getElementById('cal-s-acceptDelegation');
    var togDelNames    = document.getElementById('cal-s-showDelegateNames');
    var togNotifyDel   = document.getElementById('cal-s-notifyDelegation');
    if (togAcceptDel)  obj.acceptDelegation  = togAcceptDel.checked;
    if (togDelNames)   obj.showDelegateNames = togDelNames.checked;
    if (togNotifyDel)  obj.notifyDelegation  = togNotifyDel.checked;

    for (var i = 1; i <= 3; i++) {
      var inp = document.getElementById('cal-s-icalUrl' + i);
      if (inp) obj['icalUrl' + i] = inp.value.trim();
    }

    localStorage.setItem('flock_calendar_settings', JSON.stringify(obj));

    if (_isFB() && typeof UpperRoom !== 'undefined') {
      UpperRoom.setAppConfig({
        key: 'CALENDAR_SETTINGS',
        value: JSON.stringify(obj),
        description: 'Calendar display preferences, feeds & integrations',
        category: 'Calendar'
      }).catch(function() {});
    } else if (typeof TheVine !== 'undefined' && TheVine.flock && TheVine.flock.config) {
      TheVine.flock.config.set({
        key: 'CALENDAR_SETTINGS',
        value: JSON.stringify(obj),
        description: 'Calendar display preferences, feeds & integrations',
        category: 'Calendar'
      }).catch(function() {});
    }

    _calIcalCache = {};
    alert('Calendar settings saved.');
  }


  // ═══════════════════════════════════════════════════════════════════════
  // TASK CRUD
  // ═══════════════════════════════════════════════════════════════════════

  function newTask() {
    var fields = [
      { name: 'title',       label: 'Title',          required: true },
      { name: 'description', label: 'Description',    type: 'textarea' },
      { name: 'dueDate',     label: 'Due Date',       type: 'date' },
      { name: 'priority',    label: 'Priority',       type: 'select',
        options: _TODO_PRIORITIES, value: 'Medium' },
      { name: 'category',    label: 'Category',       type: 'select',
        options: _TODO_CATEGORIES, value: 'Other' },
      { name: 'recurring',   label: 'Recurring',      type: 'select',
        options: [{value:'', label:'No'}, {value:'true', label:'Yes'}] },
      { name: 'recurrenceRule', label: 'Repeat Every', type: 'select',
        options: [{value:'', label:'(select)'}].concat(_TODO_RECURRENCE) },
      { name: 'notes',       label: 'Notes',          type: 'textarea' },
    ];
    if (_isPastor()) {
      _ensureMemberDir().then(function(dir) {
        fields.splice(2, 0, { name: 'assignedTo', label: 'Assign To', type: 'select',
          options: _memberSelectOpts(dir), value: '' });
        _modal('New Task', fields, async function(data) {
          if (_isFB()) { await UpperRoom.createTodo(data); }
          else { await TheVine.flock.todo.create(data); }
          _reload('calendar');
        });
      });
    } else {
      _modal('New Task', fields, async function(data) {
        if (_isFB()) { await UpperRoom.createTodo(data); }
        else { await TheVine.flock.todo.create(data); }
        _reload('calendar');
      });
    }
  }

  // ── Assign Task — pastor+ shortcut with assignee pre-focused ──────────
  function assignTask() {
    _ensureMemberDir().then(function(dir) {
      var fields = [
        { name: 'assignedTo', label: 'Assign To',     type: 'select', required: true,
          options: _memberSelectOpts(dir).filter(function(o) { return o.value; }) },
        { name: 'title',       label: 'Title',          required: true },
        { name: 'description', label: 'Description',    type: 'textarea' },
        { name: 'dueDate',     label: 'Due Date',       type: 'date' },
        { name: 'priority',    label: 'Priority',       type: 'select',
          options: _TODO_PRIORITIES, value: 'Medium' },
        { name: 'category',    label: 'Category',       type: 'select',
          options: _TODO_CATEGORIES, value: 'Other' },
        { name: 'recurring',   label: 'Recurring',      type: 'select',
          options: [{value:'', label:'No'}, {value:'true', label:'Yes'}] },
        { name: 'recurrenceRule', label: 'Repeat Every', type: 'select',
          options: [{value:'', label:'(select)'}].concat(_TODO_RECURRENCE) },
        { name: 'notes',       label: 'Notes',          type: 'textarea' },
      ];
      _modal('Assign Task', fields, async function(data) {
        if (_isFB()) { await UpperRoom.createTodo(data); }
        else { await TheVine.flock.todo.create(data); }
        _reload('calendar');
      }, 'Assign');
    });
  }

  function editTask(id) {
    var fields = [
      { name: 'title',       label: 'Title',          required: true },
      { name: 'description', label: 'Description',    type: 'textarea' },
      { name: 'dueDate',     label: 'Due Date',       type: 'date' },
      { name: 'priority',    label: 'Priority',       type: 'select',
        options: _TODO_PRIORITIES },
      { name: 'status',      label: 'Status',         type: 'select',
        options: _TODO_STATUSES },
      { name: 'category',    label: 'Category',       type: 'select',
        options: _TODO_CATEGORIES },
      { name: 'recurring',   label: 'Recurring',      type: 'select',
        options: [{value:'false', label:'No'}, {value:'true', label:'Yes'}] },
      { name: 'recurrenceRule', label: 'Repeat Every', type: 'select',
        options: [{value:'', label:'(none)'}].concat(_TODO_RECURRENCE) },
      { name: 'notes',       label: 'Notes',          type: 'textarea' },
    ];
    if (_isPastor()) {
      _ensureMemberDir().then(function(dir) {
        fields.splice(2, 0, { name: 'assignedTo', label: 'Assign To', type: 'select',
          options: _memberSelectOpts(dir) });
        _edit('todo', 'Edit Task', fields, function(p) {
          if (_isFB()) { return UpperRoom.updateTodo(p.id, p); }
          return TheVine.flock.todo.update(p);
        }, id, null);
      });
    } else {
      _edit('todo', 'Edit Task', fields, function(p) {
        if (_isFB()) { return UpperRoom.updateTodo(p.id, p); }
        return TheVine.flock.todo.update(p);
      }, id, null);
    }
  }

  async function completeTask(id) {
    if (!confirm('Mark this task as Done?')) return;
    try {
      if (_isFB()) {
        await UpperRoom.completeTodo(id);
      } else {
        var res = await TheVine.flock.todo.complete({ id: id });
        if (res && res.nextOccurrence) {
          alert('Done! A recurring copy was created for ' + (res.nextOccurrence.dueDate || 'next occurrence') + '.');
        }
      }
      _reload('calendar');
    } catch (e) { alert(e.message || 'Failed to complete task.'); }
  }

  async function archiveTask(id) {
    try {
      if (_isFB()) { await UpperRoom.archiveTodo(id); }
      else { await TheVine.flock.todo.archive({ id: id }); }
      _reload('calendar');
    } catch (e) { alert(e.message || 'Failed to archive task.'); }
  }

  async function unarchiveTask(id) {
    try {
      if (_isFB()) { await UpperRoom.unarchiveTodo(id); }
      else { await TheVine.flock.todo.unarchive({ id: id }); }
      _reload('calendar');
    } catch (e) { alert(e.message || 'Failed to restore task.'); }
  }

  async function deleteTask(id) {
    if (!confirm('Permanently delete this task? This cannot be undone.')) return;
    try {
      if (_isFB()) { await UpperRoom.deleteTodo(id); }
      else { await TheVine.flock.todo.delete({ id: id }); }
      _reload('calendar');
    } catch (e) { alert(e.message || 'Failed to delete task.'); }
  }

  function todoRefresh() { _reload('calendar'); }


  // ═══════════════════════════════════════════════════════════════════════
  // CHECK-IN
  // ═══════════════════════════════════════════════════════════════════════

  function openCheckinSession() {
    _modal('Open Check-In Session', [
      { name: 'name', label: 'Session Name / Service', required: true },
      { name: 'date', label: 'Date', type: 'date',
        required: true, value: new Date().toISOString().substring(0, 10) },
    ], async function(data) {
      if (_isFB()) { await UpperRoom.checkinOpen(data); }
      else { await TheVine.flock.checkin.open(data); }
      _reload('checkin');
    });
  }

  async function closeCheckinSession() {
    var name = prompt('Enter the session name to close:');
    if (!name) return;
    try {
      if (_isFB()) { await UpperRoom.checkinClose(name); }
      else { await TheVine.flock.checkin.close({ name: name }); }
      _reload('checkin');
    } catch (e) { alert(e.message); }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // MODULE RENDERERS
  // ═══════════════════════════════════════════════════════════════════════

  function renderCalendar(el, sess) {
    _session = sess || {};
    var s = _calSettings();
    _calView = s.defaultView || 'day';
    _calDate = new Date();

    // ── Mode: Tasks ──
    if (_calMode === 'tasks') {
      var taskBtns = _btn('+ New Task', "Modules.newTask()") +
        _btn('\u21BB Refresh', "Modules.todoRefresh()", false);
      if (_isPastor()) {
        taskBtns += ' ' + _btn('\uD83D\uDC64 Assign Task', "Modules.assignTask()");
      }
      _shell(el, 'Calendar', 'Tasks, scheduling & check-in hub.', taskBtns);
      // Pastor+ sees all tasks; everyone else sees only their own
      var taskFetch;
      if (_isFB()) {
        taskFetch = _isPastor()
          ? UpperRoom.listTodos({})
          : UpperRoom.myTodos();
      } else {
        taskFetch = _isPastor()
          ? TheVine.flock.todo.list({})
          : TheVine.flock.todo.myTasks({});
      }
      // Pre-fetch member directory for assignee display
      if (_isPastor()) _ensureMemberDir().catch(function() {});
      taskFetch.then(function(taskRes) {
        var taskRows = _isFB() ? taskRes : _rows(taskRes);
        _cache['todo'] = taskRows;
        _body(el, _calModeBar() + '<div id="cal-mode-body"></div>');
        var modeBody = document.getElementById('cal-mode-body');
        if (modeBody) {
          _todoRenderDirect(modeBody, taskRows);
        }
      }).catch(function(e) { _body(el, _calModeBar() + _errHtml(e.message)); });
      return;
    }

    // ── Mode: Check-In ──
    if (_calMode === 'checkin') {
      _shell(el, 'Calendar', 'Tasks, scheduling & check-in hub.',
        _btn('Open Session', "Modules.openCheckinSession()") +
        _btn('Close Session', "Modules.closeCheckinSession()", false) +
        ' <button onclick="Modules.geoCheckin()" style="background:none;border:1px solid var(--accent);color:var(--accent);border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.82rem;margin-left:6px;">\uD83D\uDCCD Geo Check-In</button>' +
        ' <button onclick="Modules.toggleFullscreen()" style="background:none;border:1px solid var(--line);color:var(--ink-muted);border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.82rem;margin-left:6px;">\u26F6 Fullscreen</button>');
      var ciPromise = _isFB() ? UpperRoom.checkinSessions() : TheVine.flock.checkin.sessions({});
      ciPromise.then(function(ciRes) {
        var ciRows = _rows(ciRes);
        _body(el, _calModeBar() + _table(
          ['Date', 'Session', 'Checked In', 'Opened By', 'Status'],
          ciRows.map(function(r) { return [
            _e(r.date || r.openedAt || ''),
            _e(r.name || r.sessionName || r.serviceType || ''),
            _e(r.checkedInCount != null ? r.checkedInCount : ''),
            _e(r.openedBy || ''),
            _statusBadge(r.status),
          ]; })
        ));
      }).catch(function(e) { _body(el, _calModeBar() + _errHtml(e.message)); });
      return;
    }

    // ── Mode: Calendar (default) ──
    _shell(el, 'Calendar',
      'Unified schedule \u2014 events, services, external feeds & pastor schedule.',
      _btn('+ Quick Add', "Modules.calQuickAdd()") +
      _btn('+ My Event', "Modules.calNewPersonal()", false) +
      _btn('\uD83D\uDCC5 Subscribe', "Modules.calSubscribe()", false) +
      _btn('\uD83D\uDC65 Delegation', "Modules.calDelegation()", false) +
      _btn('\uD83D\uDD04 Refresh', "Modules.calRefresh()", false));

    _calLoad().then(function() {
      var html = '';

      html += _calModeBar();

      // Toolbar
      html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">';
      html += '<div style="display:flex;align-items:center;gap:6px;">';
      html += '<button onclick="Modules.calNav(-1)" style="background:none;border:1px solid var(--line);border-radius:6px;padding:5px 10px;cursor:pointer;color:var(--ink);font-size:0.85rem;">\u25C0</button>';
      html += '<button onclick="Modules.calToday()" style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;padding:5px 14px;cursor:pointer;font-size:0.78rem;font-weight:700;">Today</button>';
      html += '<button onclick="Modules.calNav(1)" style="background:none;border:1px solid var(--line);border-radius:6px;padding:5px 10px;cursor:pointer;color:var(--ink);font-size:0.85rem;">\u25B6</button>';
      html += '<span id="cal-title" style="font-size:1.05rem;font-weight:800;color:var(--ink);margin-left:8px;">'
        + (_calView === 'month' ? _calMonthName(_calDate) : '') + '</span>';
      html += '</div>';

      // View switcher
      html += '<div style="display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden;">';
      ['month','week','day','agenda'].forEach(function(v) {
        var active = v === _calView;
        html += '<button id="cal-vbtn-' + v + '" onclick="Modules.calSetView(\'' + v + '\')" style="'
          + 'background:' + (active ? 'var(--accent)' : 'transparent') + ';'
          + 'color:' + (active ? 'var(--ink-inverse)' : 'var(--ink-muted)') + ';'
          + 'border:none;padding:5px 12px;cursor:pointer;font-size:0.75rem;font-weight:600;text-transform:capitalize;'
          + 'transition:all 0.2s;">' + v + '</button>';
      });
      html += '</div>';
      html += '</div>';

      // Legend
      html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;font-size:0.7rem;">';
      var legendItems = [
        { label: 'Service', color: 'var(--accent)' },
        { label: 'Bible Study', color: 'var(--mint)' },
        { label: 'Prayer', color: 'var(--lilac)' },
        { label: 'Youth', color: 'var(--peach)' },
        { label: 'Community', color: 'var(--sky)' },
        { label: 'Special', color: 'var(--gold)' },
        { label: 'External', color: 'var(--sky)' },
        { label: 'Personal', color: '#6366f1' },
      ];
      legendItems.forEach(function(li) {
        html += '<div style="display:flex;align-items:center;gap:4px;">'
          + '<div style="width:10px;height:10px;border-radius:2px;background:' + li.color + ';"></div>'
          + '<span style="color:var(--ink-muted);">' + li.label + '</span></div>';
      });
      html += '</div>';

      // Stats bar
      var totalEvents = _calEvents.length;
      var publicCount = _calEvents.filter(function(e) { return (e.visibility || 'public') === 'public'; }).length;
      var restrictedCount = totalEvents - publicCount;
      var sources = {};
      _calEvents.forEach(function(e) { sources[e.source || 'Unknown'] = true; });
      var sourceCount = Object.keys(sources).length;

      html += '<div class="settings-stat-row" style="margin-bottom:16px;">';
      html += '<div class="settings-stat-card"><div class="settings-stat-value">' + totalEvents + '</div><div class="settings-stat-label">Total Events</div></div>';
      html += '<div class="settings-stat-card"><div class="settings-stat-value">' + publicCount + '</div><div class="settings-stat-label">Public</div></div>';
      html += '<div class="settings-stat-card"><div class="settings-stat-value">' + restrictedCount + '</div><div class="settings-stat-label">Restricted</div></div>';
      html += '<div class="settings-stat-card"><div class="settings-stat-value">' + sourceCount + '</div><div class="settings-stat-label">Sources</div></div>';
      html += '</div>';

      html += '<div id="cal-body"></div>';

      _body(el, html);
      _calRender(document.getElementById('cal-body'));
      _calUpdateHeader();

    }).catch(function(e) { _body(el, _errHtml(e.message)); });
  }

  function renderTodo(el) {
    _calMode = 'tasks';
    renderCalendar(el);
  }

  function renderCheckin(el) {
    _calMode = 'checkin';
    renderCalendar(el);
  }


  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC INTERFACE
  // ═══════════════════════════════════════════════════════════════════════

  return {
    renderCalendar,
    renderTodo,
    renderCheckin,
    preload: function() { _calLoad().catch(function() {}); },

    // Calendar navigation & views
    calNav,
    calToday,
    calSetView,
    calDayClick,
    calQuickAdd,
    calEventDetail,
    calRefresh,
    calSwitchMode,
    calSubscribe,
    calDownloadICS,
    calRegenToken,
    calDelegation,
    calNewPersonal,
    calEditPersonal,
    calDeletePersonal,
    calDeleteEvent,
    calEditEvent,
    calArchiveEvent,
    calCancelEvent,
    _calGrantDelegation,
    _calRevokeDelegation,
    _calCopyUrl,
    _calSettingsSave,

    // RSVP
    rsvpToEvent,
    viewEventRsvps,

    // Task management
    newTask,
    assignTask,
    editTask,
    completeTask,
    archiveTask,
    unarchiveTask,
    deleteTask,
    todoRefresh,
    todoFilterBy,

    // Check-in
    openCheckinSession,
    closeCheckinSession,

    // Alerts
    _alertStart,
    _alertRequestPermission,
  };

})();
