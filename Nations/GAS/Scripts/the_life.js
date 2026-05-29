/* @ts-nocheck */
/* ══════════════════════════════════════════════════════════════════════════════
   THE LIFE  — My Flock Portal
   Full pastoral command-hub: care, prayer, compassion, outreach, discipleship,
   communications, and pastoral notes — with full-page editors.

   Depends on: Modules (the_tabernacle.js), TheVine (the_true_vine.js),
               Nehemiah (firm_foundation.js), Adornment (fine_linen.js)

   "I am the way, the truth, and the life." — John 14:6
   ══════════════════════════════════════════════════════════════════════════════ */

const TheLife = (() => {
  'use strict';

  var TheVine = typeof window !== 'undefined' ? window['TheVine'] : undefined;
  var UpperRoom = typeof window !== 'undefined' ? window['UpperRoom'] : undefined;

  // ── Borrow helpers from Modules / global scope ──────────────────────────
  // These are all defined inside the_tabernacle.js IIFE but exposed via Modules.*
  // We reference the low-level ones via the parent scope (they share the same IIFE
  // closure when loaded in order). Instead, we redefine tiny wrappers so the_life.js
  // is self-contained and can reference its host utilities cleanly.

  function _e(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(s)));
    return d.innerHTML;
  }
  function _spinner() {
    return '<div style="text-align:center;padding:80px 20px;color:var(--ink-muted);">'
         + '<div class="spinner" style="margin:0 auto 16px;width:32px;height:32px;border:3px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite;"></div>'
         + 'Loading\u2026</div>';
  }
  function _errHtml(msg) {
    return '<div style="padding:30px;text-align:center;color:var(--danger);">'
         + '<p style="font-size:1rem;font-weight:600;">Error</p>'
         + '<p style="font-size:0.85rem;">' + _e(msg) + '</p></div>';
  }
  function _badge(text, cls) {
    return '<span class="badge badge-' + (cls || 'info') + '">' + _e(text) + '</span>';
  }
  function _statusBadge(val) {
    var t = String(val || '').toUpperCase();
    if (['TRUE','ACTIVE','OPEN','PUBLISHED','DELIVERED','COMPLETE','YES','APPROVED','ANSWERED'].includes(t))
      return _badge(val, 'success');
    if (['FALSE','INACTIVE','CLOSED','ARCHIVED','CANCELLED','DENIED','NO'].includes(t))
      return _badge(val, 'warn');
    if (['URGENT','HIGH','PENDING','DRAFT','NEW','CRITICAL'].includes(t))
      return _badge(val, 'danger');
    return _badge(val, 'info');
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
  // ── Seed-admin / Lead Pastor visibility gate ───────────────────────────
  var _TERMINAL_STATUSES = ['resolved','closed','archived','cancelled','denied','completed','answered','inactive','deleted'];
  var _PRAYER_STATUS_AUDIT_EVENTS = ['closed', 'answered', 'new'];
  function _getStatusLowerCase(r, statusKey) {
    return String(statusKey ? r[statusKey] : (r.status || r['Status'] || r.stage || '')).toLowerCase();
  }
  function _mapPrayerDataForGAS(data) {
    var payload = Object.assign({}, data);
    // Keep GAS compatibility where sheet-column keys can be referenced directly.
    if (payload.status != null) payload['Status'] = payload.status;
    if (payload.assignedTo != null) payload['Assigned To'] = payload.assignedTo;
    if (payload.adminNotes != null) payload['Admin Notes'] = payload.adminNotes;
    return payload;
  }
  function _isSeedAdmin() {
    try {
      var V = _vine();
      var s = V && V.session ? V.session() : null;
      if (s && s.isSeed) return true;
      if (typeof Nehemiah !== 'undefined' && Nehemiah.hasGroup('Seed Admin')) return true;
      if (typeof Nehemiah !== 'undefined' && Nehemiah.hasGroup('Master')) return true;
      return false;
    } catch(e) { return false; }
  }
  function _isLeadPastor() {
    try { return Nehemiah.hasGroup('Lead Pastor') || Nehemiah.hasGroup('Master'); } catch(e) { return false; }
  }
  function _canViewNotes() {
    return _isSeedAdmin() || _isLeadPastor();
  }
  function _filterClosed(rows, statusKey) {
    if (_canViewNotes()) {
      // Lead Pastors / seed admins: active cases always, resolved only within 7 days.
      // Full history is still accessible via each member's file (Spiritual Care History section).
      var sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      return rows.filter(function(r) {
        var s = _getStatusLowerCase(r, statusKey);
        if (_TERMINAL_STATUSES.indexOf(s) === -1) return true; // open/active: always show
        var ts = r.updatedAt || r.resolvedAt || r.closedAt || r.createdAt || '';
        if (!ts) return false;
        return new Date(ts).getTime() >= sevenDaysAgo;
      });
    }
    return rows.filter(function(r) {
      return _TERMINAL_STATUSES.indexOf(_getStatusLowerCase(r, statusKey)) === -1;
    });
  }
  function _filterClosedPrayer(rows, statusKey) {
    // Prayer requests should fall out of pastor queues once terminal.
    // Seed admins retain the same recent-history visibility model.
    if (_isSeedAdmin()) return _filterClosed(rows, statusKey);
    return rows.filter(function(r) {
      return _TERMINAL_STATUSES.indexOf(_getStatusLowerCase(r, statusKey)) === -1;
    });
  }
  function _removePrayerFromCaches(prayerId) {
    if (_cache.allPrayer && _cache.allPrayer.length) {
      _cache.allPrayer = _cache.allPrayer.filter(function(r) { return (r.id || r.ID) !== prayerId; });
    }
    if (_flockData && _flockData.allPrayer && _flockData.allPrayer.length) {
      _flockData.allPrayer = _flockData.allPrayer.filter(function(r) { return (r.id || r.ID) !== prayerId; });
    }
  }
  function _phoneActions(phone) {
    if (!phone) return '';
    return '<span style="display:inline-flex;gap:4px;margin-left:6px;">'
      + '<button type="button" onclick="TheLife._callPhone(\'' + _e(phone) + '\')" style="background:none;border:none;cursor:pointer;font-size:0.85rem;padding:0;" title="Call">\uD83D\uDCDE</button>'
      + '<button type="button" onclick="TheLife._smsPhone(\'' + _e(phone) + '\')" style="background:none;border:none;cursor:pointer;font-size:0.85rem;padding:0;" title="Text">\uD83D\uDCAC</button>'
      + '</span>';
  }
  function _callPhone(phone) {
    if (!phone) return;
    var trumpet = window.Trumpet;
    if (trumpet && typeof trumpet.call === 'function') { trumpet.call(phone); }
    else { window.open('tel:' + encodeURIComponent(phone.replace(/[^\d+]/g, ''))); }
  }
  function _smsPhone(phone, body) {
    if (!phone) return;
    var trumpet = window.Trumpet;
    if (trumpet && typeof trumpet.sms === 'function') { trumpet.sms(phone, body); }
    else { window.open('sms:' + encodeURIComponent(phone.replace(/[^\d+]/g, '')) + (body ? '?body=' + encodeURIComponent(body) : '')); }
  }

  // ── Form validation helpers ─────────────────────────────────────────────
  var _EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function _validEmail(v) { return _EMAIL_RE.test(String(v || '').trim()); }
  function _validPhone(v) { return String(v || '').replace(/[^\d]/g, '').length >= 7; }
  function _validDate(v)  { return !isNaN(Date.parse(v)); }
  function _requireField(val, label) {
    if (!String(val || '').trim()) { _toast(label + ' is required.', 'warn'); return false; }
    return true;
  }
  // Converts Firestore Timestamps ({seconds,nanoseconds}), ISO strings, or
  // numeric milliseconds into a human-readable "Month D, YYYY h:mm AM/PM" string.
  function _fmtDate(val) {
    if (!val) return '';
    var ms;
    if (typeof val === 'object' && typeof val.seconds === 'number') {
      ms = val.seconds * 1000;
    } else if (typeof val === 'number') {
      ms = val > 1e10 ? val : val * 1000; // handle both ms and seconds
    } else {
      ms = Date.parse(String(val));
    }
    if (isNaN(ms)) return String(val);
    return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  // ── Local data cache ────────────────────────────────────────────────────
  var _cache = {};
  var _careCFG = null;  // Populated on first openCareCase; used by closure modal
  var _memberDirPromise = null;

  // ── Pagination state ────────────────────────────────────────────────────
  var _PANEL_PAGE_SIZE = 25;
  var _prayerPage = 0;

  // ── Timestamp-safe ms converter ─────────────────────────────────────────
  // Handles: Firestore Timestamp objects (.toMillis), plain JS Dates, ISO strings
  function _tsMs(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();  // Firestore Timestamp
    if (ts.seconds)  return ts.seconds * 1000;                     // raw {seconds, nanoseconds}
    var n = new Date(ts).getTime();
    return isNaN(n) ? 0 : n;
  }

  // Stamp today's ISO string onto a cached care case so _daysSince recalculates
  // immediately, without waiting for the next full hub re-fetch.
  function _bustCareCache(caseId) {
    var now = new Date().toISOString();
    (_cache.care || []).forEach(function(c) {
      if (c.id === caseId) c.updatedAt = now;
    });
  }

  // ── TTL-aware fetch: serves warm data via TheVine.nurture() ─────────────
  var _TTL_CARE = 60000;   // Pastoral data: 60 sec fresh window
  function _fetch(key, fetcher, ttl) {
    var V = _vine();
    return (V && V.nurture)
      ? V.nurture('life:' + key, fetcher, { ttl: ttl || _TTL_CARE })
      : fetcher();
  }

  // ── Audit logger ────────────────────────────────────────────────────────
  // Backend writeAudit fires on every API call automatically.
  // This frontend helper provides console-level tracing + Luke statistics,
  // and writes view events directly to auditLog (debounced: once per case per day per session).
  var _auditViewLog = {}; // key: 'action:targetId:YYYY-MM-DD' → true
  function _audit(action, target, targetId, detail) {
    var session = (typeof Nehemiah !== 'undefined' && Nehemiah.getSession) ? Nehemiah.getSession() : {};
    var entry = {
      ts: new Date().toISOString(),
      user: (session && session.email) || '?',
      role: (session && session.role) || '?',
      action: action,
      target: target,
      targetId: targetId || '',
      detail: detail || '',
    };
    // For view-only events: write to auditLog once per case per calendar day per session.
    // This keeps the access trail meaningful without burning writes on every click.
    var isViewEvent = (action === 'care.view' || action === 'prayer.view');
    var UR = _upperRoom();
    var V = _vine();
    if (isViewEvent && _isFB() && UR) {
      var _dayKey = action + ':' + (targetId || '') + ':' + entry.ts.substring(0, 10);
      if (!_auditViewLog[_dayKey]) {
        _auditViewLog[_dayKey] = true;
        UR.writeAuditEntry(entry);
      }
      return; // view events don't need a stats snapshot
    }
    // All other events: fire-and-forget statistics snapshot for trending
    try {
      if (_isFB() && UR) {
        UR.createStatsSnapshot({
          metricName: 'flock.audit.' + action,
          h1: entry.user,
          h2: entry.role,
          h3: entry.target,
          h4: entry.targetId,
          h5: entry.detail,
          h6: entry.ts,
        }).catch(function() { /* non-fatal */ });
      } else if (V && V.luke && V.luke.statistics) {
        V.luke.statistics.createSnapshot({
          metricName: 'flock.audit.' + action,
          h1: entry.user,
          h2: entry.role,
          h3: entry.target,
          h4: entry.targetId,
          h5: entry.detail,
          h6: entry.ts,
        }).catch(function() { /* non-fatal */ });
      }
    } catch (_) { /* non-fatal */ }
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

  function _vine() {
    if (typeof TheVine !== 'undefined') return TheVine;
    return typeof window !== 'undefined' ? window.TheVine : null;
  }

  function _upperRoom() {
    if (typeof UpperRoom !== 'undefined') return UpperRoom;
    return typeof window !== 'undefined' ? window.UpperRoom : null;
  }

  function _isFB() {
    return typeof Modules !== 'undefined' && typeof Modules._isFirebaseComms === 'function' && Modules._isFirebaseComms();
  }

  async function _ensureDir() {
    if (_cache.memberDir && _cache.memberDir.length) return _cache.memberDir;
    if (!_memberDirPromise) {
      // All My Flock users have care+ role → use members.list (full roster).
      // Admins also pull users.list (AuthUsers) to catch staff not in Members.
      _memberDirPromise = (async function() {
        var fetches = [_isFB() ? UpperRoom.listMembers({ limit: 200 }) : TheVine.flock.call('members.list', { limit: 200 })];
        // Always pull users.list to get role/groups for staff identification.
        // Uses Promise.allSettled so a users.list failure doesn't block members.
        try { fetches.push(TheVine.flock.call('users.list', {})); } catch(_) {}
        // Also fetch the configured Lead Pastor ID in parallel
        var _lpCfgP = (_isFB() ? UpperRoom.getAppConfig({ key: 'LEAD_PASTOR_MEMBER_ID' })
                                : TheVine.flock.call('appconfig.get', { key: 'LEAD_PASTOR_MEMBER_ID' }))
                      .catch(function() { return { value: '' }; });
        var res = await Promise.allSettled(fetches);
        var members = _rows(res[0].status === 'fulfilled' ? res[0].value : []);
        // Merge AuthUsers: enrich existing Members with role/groups, add missing ones
        if (res.length > 1 && res[1].status === 'fulfilled') {
          var authUsers = _rows(res[1].value);
          // Build a lookup of existing members by email
          var byEmail = {};
          members.forEach(function(m) {
            if (m.email) byEmail[m.email.toLowerCase()] = m;
            if (m.primaryEmail) byEmail[m.primaryEmail.toLowerCase()] = m;
          });
          authUsers.forEach(function(u) {
            if (!u.email) return;
            var key = u.email.toLowerCase();
            var existing = byEmail[key];
            if (existing) {
              // Enrich the existing member record with auth data
              if (u.role && !existing.role) existing.role = u.role;
              if (u.groups && !existing.groups) existing.groups = u.groups;
            } else {
              // AuthUser not in Members — add them
              byEmail[key] = true;
              members.push({
                email: u.email, firstName: u.firstName || '',
                lastName: u.lastName || '', role: u.role || '',
                groups: u.groups || '',
                _source: 'auth'
              });
            }
          });
        }
        // Cache the configured LP ID so _findLP can fall back to it
        var _lpCfg = await _lpCfgP;
        if (_lpCfg && _lpCfg.value) _cache.lpId = String(_lpCfg.value).trim();
        _cache.memberDir = members;
        return members;
      })().catch(function() { return []; });
    }
    return _memberDirPromise;
  }

  function _memberOpts(dir) {
    return [{ value: '', label: '(none)' }].concat(
      (dir || _cache.memberDir || []).map(function(m) {
        var name = m.preferredName || ((m.firstName || '') + ' ' + (m.lastName || '')).trim();
        return { value: m.memberPin || m.id || m.email, label: name || m.memberNumber || m.email || m.id };
      })
    );
  }

  var _STAFF_ROLES = { care: 1, deacon: 1, pastor: 1, admin: 1, staff: 1, elder: 1 };
  var _STAFF_GROUP_WORDS = ['pastor', 'admin', 'elder', 'deacon', 'staff', 'care', 'lead'];

  function _staffOpts(dir) {
    var all = dir || _cache.memberDir || [];
    var staff = all.filter(function(m) {
      if (m.role && _STAFF_ROLES[m.role.toLowerCase()]) return true;
      if (m.groups) {
        var gl = String(m.groups).toLowerCase();
        return _STAFF_GROUP_WORDS.some(function(w) { return gl.indexOf(w) !== -1; });
      }
      return false;
    });
    // If enrichment failed and no staff were identified, fall back to full list
    var list = staff.length ? staff : all;
    return [{ value: '', label: '(none)' }].concat(
      list.map(function(m) {
        var name = m.preferredName || ((m.firstName || '') + ' ' + (m.lastName || '')).trim();
        return { value: m.memberPin || m.id || m.email, label: name || m.memberNumber || m.email || m.id };
      })
    );
  }

  function _caregiverOpts(dir) {
    var opts = _staffOpts(dir);
    var cases = _cache.care || [];
    var counts = {};
    cases.forEach(function(c) {
      var st = (c.status || '').toLowerCase();
      if (st === 'resolved' || st === 'closed') return;
      if (c.primaryCaregiverId) counts[c.primaryCaregiverId] = (counts[c.primaryCaregiverId] || 0) + 1;
    });
    return opts.map(function(o) {
      if (!o.value || !counts[o.value]) return o;
      var ct = counts[o.value];
      return { value: o.value, label: o.label + ' (' + ct + ' active)' + (ct > 5 ? ' \u26A0' : '') };
    });
  }

  // Shared Lead Pastor finder — works on any array of member/user objects.
  // Priority: 1) groups contains "lead pastor", 2) role === "pastor",
  // 3) memberPin/id/memberNumber matches the LEAD_PASTOR_MEMBER_ID AppConfig value.
  function _findLP(list) {
    return (list || []).find(function(m) {
      return String(m.groups || '').toLowerCase().indexOf('lead pastor') !== -1;
    }) || (list || []).find(function(m) {
      return (m.role || '').toLowerCase() === 'pastor';
    }) || (_cache.lpId ? (list || []).find(function(m) {
      var id = _cache.lpId;
      return (m.memberPin === id || m.id === id || m.memberNumber === id);
    }) : null) || null;
  }

  function _memberName(emailOrId) {
    if (!emailOrId) return '';
    var dir = _cache.memberDir || [];
    var key = String(emailOrId).toLowerCase();
    for (var i = 0; i < dir.length; i++) {
      var m = dir[i];
      var name = m.preferredName || ((m.firstName || '') + ' ' + (m.lastName || '')).trim();
      if ((m.email && m.email.toLowerCase() === key) || (m.primaryEmail && m.primaryEmail.toLowerCase() === key)
        || m.id === emailOrId || m.memberNumber === emailOrId || m.memberPin === emailOrId) {
        return name || emailOrId;
      }
    }
    return emailOrId;
  }

  // Look up full member record from directory cache
  function _lookupMember(emailOrId) {
    if (!emailOrId) return {};
    var dir = _cache.memberDir || [];
    var key = String(emailOrId).toLowerCase();
    for (var i = 0; i < dir.length; i++) {
      var m = dir[i];
      if ((m.email && m.email.toLowerCase() === key)
        || (m.primaryEmail && m.primaryEmail.toLowerCase() === key)
        || m.id === emailOrId || m.memberNumber === emailOrId || m.memberPin === emailOrId) {
        return m;
      }
    }
    return {};
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FULL-PAGE EDITOR FRAMEWORK
  // Inspired by _ppOpen pattern — back button, sections, sticky save bar
  // ══════════════════════════════════════════════════════════════════════════

  function _fpField(label, name, val, type, opts) {
    var sid = 'fp-' + name;
    var h = '<div style="margin-bottom:12px;">'
          + '<label for="' + sid + '" style="display:block;font-size:0.72rem;color:var(--ink-muted);margin-bottom:3px;">' + _e(label) + '</label>';
    var base = ' id="' + sid + '" data-field="' + _e(name) + '"'
             + ' style="width:100%;background:rgba(255,255,255,0.07);border:1px solid var(--line);border-radius:6px;padding:7px 10px;color:var(--ink);font-size:max(0.92rem,16px);font-family:inherit;"';
    if (type === 'select' && opts) {
      h += '<select' + base + '>';
      (opts || []).forEach(function(o) {
        var ov = typeof o === 'object' ? o.value : o;
        var ol = typeof o === 'object' ? o.label : o;
        h += '<option value="' + _e(ov) + '"' + (String(val) === String(ov) ? ' selected' : '') + '>' + _e(ol) + '</option>';
      });
      h += '</select>';
    } else if (type === 'textarea') {
      h += '<textarea' + base + ' rows="4">' + _e(val || '') + '</textarea>';
    } else if (type === 'readonly') {
      h += '<input' + base + ' type="text" value="' + _e(val || '') + '" readonly style="width:100%;background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:6px;padding:7px 10px;color:var(--ink-muted);font-size:max(0.92rem,16px);font-family:inherit;cursor:not-allowed;">';
    } else {
      h += '<input' + base + ' type="' + _e(type || 'text') + '" value="' + _e(val || '') + '">';
    }
    return h + '</div>';
  }

  function _fp2(a, b) {
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px;">' + a + b + '</div>';
  }

  function _fpSec(title, id, content, open) {
    return '<details class="fp-section" ' + (open !== false ? 'open' : '') + ' style="margin-bottom:16px;border:1px solid var(--line);border-radius:8px;overflow:hidden;">'
      + '<summary style="padding:12px 16px;background:rgba(255,255,255,0.04);cursor:pointer;font-weight:700;font-size:0.82rem;color:var(--accent);user-select:none;">' + _e(title) + '</summary>'
      + '<div style="padding:16px;" id="fp-sec-' + id + '">' + content
      + '</div></details>';
  }

  // Collect all data-field values from a container
  function _fpCollect(containerId) {
    var data = {};
    var container = containerId ? document.getElementById(containerId) : document;
    if (!container) return data;
    container.querySelectorAll('[data-field]').forEach(function(el) {
      var f = el.getAttribute('data-field');
      data[f] = (el.value || '').trim();
    });
    return data;
  }

  // Get the hub view element
  var _fpEditorSource = 'my-flock'; // tracks which view opened the current editor

  function _hubEl() {
    return document.getElementById('view-' + _fpEditorSource) || document.getElementById('view-my-flock');
  }

  // Inject HTML into hub's body
  function _hubBody(html) {
    var el = _hubEl();
    if (!el) return;
    var b = el.querySelector('#ml-body');
    if (b) b.innerHTML = html;
    else el.innerHTML = html;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FULL-PAGE: CARE CASE EDITOR
  // ══════════════════════════════════════════════════════════════════════════

  var _fpCareId = '';

  async function openCareCase(id, defaults) {
    // For users without care.view-all, verify they are assigned to this case
    if (id && !Nehemiah.can('care.view-all')) {
      var _permCheck = (_cache.care || []).find(function(c) { return c.id === id; });
      if (!_permCheck) { _toast('Access denied. You are not assigned to this case.', 'error'); return; }
    }
    // Audit: record who viewed this case and when
    if (id) { _audit('care.view', 'SpiritualCareCases', id, 'viewed'); }
    var el = _hubEl();
    if (!el) return;
    _fpCareId = id || '';

    // Inject shell
    el.innerHTML = '<div class="fp-editor">'
      + '<div class="fp-topbar">'
      + '<button class="fp-back" onclick="TheLife.backToHub()">\u2190 My Flock</button>'
      + '<h2 class="fp-title">' + (id ? 'Edit Care Case' : 'New Care Case') + '</h2>'
      + '</div>'
      + '<div id="fp-body">' + _spinner() + '</div></div>';
    var _m = document.getElementById('main'); if (_m) _m.scrollTop = 0;

    // Parallel data fetch
    var _cgListIdx = -1;
    var _p = [_ensureDir()];
    if (id) {
      _p.push((_isFB() ? UpperRoom.getCareCase(id) : TheVine.flock.care.get({ caseId: id })).catch(function(err) {
        console.warn('[TheLife] care.get failed:', err.message || err);
        return null;
      }));
      _p.push((_isFB() ? UpperRoom.listCareInteractions({ caseId: id }) : TheVine.flock.care.interactions.list({ caseId: id })).catch(function() { return []; }));
    } else {
      _cgListIdx = _p.length;
      _p.push((_isFB() ? UpperRoom.listCaregivers() : TheVine.flock.care.caregivers.list({})).catch(function() { return { rows: [] }; }));
    }
    var _r = await Promise.all(_p);
    var dir = _r[0];
    var mOpts = _memberOpts(dir);

    // For new cases created by a non-Lead-Pastor caregiver: default primary to
    // the Lead Pastor and secondary to the current user.
    var rec = {};
    if (!id) {
      var _me = (TheVine.session() || {}).email || '';
      var _cgRes = _cgListIdx >= 0 ? (_r[_cgListIdx] || {}) : {};
      var _caregivers = _cgRes.rows || [];
      var _lpCg = _findLP(_caregivers);
      var _lpId = _lpCg ? (_lpCg.memberPin || _lpCg.email) : '';
      // Resolve current user to their memberPin
      var _mePin = _me;
      var _meMember = (_cache.memberDir || []).find(function(m) { return (m.email && m.email.toLowerCase() === _me.toLowerCase()) || (m.primaryEmail && m.primaryEmail.toLowerCase() === _me.toLowerCase()); });
      if (_meMember && _meMember.memberPin) _mePin = _meMember.memberPin;
      // Only auto-populate if the current user is NOT the Lead Pastor
      if (_lpId && _mePin && _lpId !== _mePin) {
        rec.primaryCaregiverId = _lpId;
        rec.secondaryCaregiverId = _mePin;
      }
      // Apply any pre-fill defaults (e.g. from createLinkedCase)
      if (defaults) { for (var _dk in defaults) { if (defaults.hasOwnProperty(_dk)) rec[_dk] = defaults[_dk]; } }
    }
    if (id) {
      var _raw = _r[1];
      // Unwrap: API returns { ok:true, row:{...} }
      if (_raw && typeof _raw === 'object' && !_raw.error) {
        rec = _raw.row || (_raw.id ? _raw : {});
      }
      // Fallback: try local care cache, or re-fetch the care list
      if (!rec.id) {
        rec = (_cache.care || []).find(function(c) { return c.id === id; }) || {};
      }
      if (!rec.id) {
        try {
          var listRes = await (_isFB() ? UpperRoom.listCareCases({}) : TheVine.flock.care.list({}));
          var allCases = _rows(listRes);
          _cache.care = allCases;
          rec = allCases.find(function(c) { return c.id === id; }) || {};
        } catch(e) { console.warn('[TheLife] care.list fallback failed:', e.message); }
      }
    }
    var interactions = id ? _rows(_r[2] || []) : [];

    var html = '';

    // Sticky save bar
    html += '<div class="fp-save-bar">'
      + '<button id="fp-save-btn" type="button" onclick="TheLife.saveCareCase()"'
      + ' class="fp-save-btn">\uD83D\uDCBE Save Care Case</button>'
      + '<span id="fp-save-status" class="fp-save-status"></span>'
      + (id ? '<button type="button" onclick="TheLife.resolveCareCase()" class="fp-resolve-btn">Resolve Case</button>' : '')
      + '</div>';

    // ── Section: Case Details ──
    var detSec = '';
    // Member select + non-member name fallback
    var memberSelectHtml = _fpField('Member', 'memberId', rec.memberId, 'select', mOpts);
    // Inject onchange onto the select to toggle the guest name row
    memberSelectHtml = memberSelectHtml.replace(
      'data-field="memberId"',
      'data-field="memberId" onchange="(function(s){var row=document.getElementById(\'fp-nonmember-row\');if(row)row.style.display=s.value?\'none\':\'block\';})(this)"'
    );
    var nonMemberVisible = !rec.memberId ? '' : 'none';
    var nonMemberRow = '<div id="fp-nonmember-row" style="margin-bottom:12px;display:' + nonMemberVisible + ';">'
      + '<label style="display:block;font-size:0.72rem;color:var(--ink-muted);margin-bottom:3px;">Guest / Non-member Name</label>'
      + '<input id="fp-memberName" data-field="memberName" type="text" value="' + _e(rec.memberName || rec.party1 || '') + '"'
      + ' placeholder="Full name of person receiving care\u2026"'
      + ' style="width:100%;background:rgba(255,255,255,0.07);border:1px solid var(--line);border-radius:6px;padding:7px 10px;color:var(--ink);font-size:max(0.92rem,16px);font-family:inherit;">'
      + '</div>';
    detSec += _fp2(memberSelectHtml, _fpField('Care Type', 'careType', rec.careType || rec.type, 'select',
        ['Shepherding','Elder Care','Crisis','Abuse / Domestic Violence','Immigration / Deportation','Incarceration & Re-Entry','Grief','Pregnancy & Infant Loss','Marriage','Pre-Marriage','Addiction','Pornography / Sexual Addiction','Hospital Visit','Medical','Terminal Illness / End of Life','New Believer','New Member Integration','Restoration','Counseling','Mental Health','Gender Identity / Sexuality','Discipleship','Family','Financial','Other']));
    detSec += nonMemberRow;
    detSec += _fp2(
      _fpField('Priority', 'priority', rec.priority, 'select', ['Low','Normal','High','Urgent']),
      _fpField('Status', 'status', rec.status || 'Open', 'select', ['Open','In Progress','Follow-Up','Resolved','Referred','Closed']));
    detSec += _fp2(
      _fpField('Risk Level', 'riskLevel', rec.riskLevel, 'select', ['','Low','Moderate','High','Critical']),
      _fpField('Trend', 'trend', rec.trend, 'select', ['','Improving','Stable','Declining']));
    detSec += _fp2(
      _fpField('Support Presence', 'supportPresence', rec.supportPresence, 'select', ['','Strong','Limited','None']),
      _fpField('Spiritual State', 'spiritualState', rec.spiritualState, 'select', ['','Connected','Struggling','Disconnected','Unknown']));
    var cgOpts = _caregiverOpts(dir);
    detSec += _fp2(
      _fpField('Assigned To', 'primaryCaregiverId', rec.primaryCaregiverId || rec.assignedTo, 'select', cgOpts),
      _fpField('Secondary Caregiver', 'secondaryCaregiverId', rec.secondaryCaregiverId, 'select', cgOpts));
    detSec += _fpField('Summary', 'summary', rec.summary, 'textarea');
    var _canSeeNotes = _canViewNotes();
    detSec += _fpField(_canSeeNotes ? 'Notes (confidential)' : 'Notes (confidential — Lead Pastor eyes only)', 'notes', _canSeeNotes ? rec.notes : '', 'textarea');
    if (rec.linkedCaseId) {
      detSec += '<div class="fp-field" style="margin-bottom:8px;"><label style="font-size:0.78rem;color:var(--ink-muted);">Linked Case</label>'
        + '<a href="#" onclick="TheLife.openCareCase(\'' + _e(rec.linkedCaseId) + '\');return false;" style="display:inline-block;padding:6px 12px;background:rgba(255,255,255,0.06);border-radius:6px;font-size:0.84rem;color:var(--accent);text-decoration:none;">\uD83D\uDD17 ' + _e(rec.linkedCaseId) + '</a>'
        + '<input type="hidden" id="fp-linkedCaseId" name="linkedCaseId" value="' + _e(rec.linkedCaseId) + '">'
        + '</div>';
    } else if (id) {
      detSec += '<input type="hidden" id="fp-linkedCaseId" name="linkedCaseId" value="">';
    }
    detSec += _fpField('Next Review Date', 'nextReviewDate', rec.nextReviewDate || '', 'date');
    if (id) {
      detSec += _fp2(
        _fpField('Created', 'createdAt', rec.createdAt, 'readonly'),
        _fpField('Last Updated', 'updatedAt', rec.updatedAt, 'readonly'));
    }
    html += _fpSec('Case Details', 'care-details', detSec);

    // ── Section: Care Type Workflow Guide (content rendered dynamically by _applyCareType) ──
    html += '<div id="fp-care-panel"></div>';

    // ── Section: Interaction Timeline ──
    if (id) {
      var tlSec = '';
      tlSec += '<div style="margin-bottom:12px;">'
        + '<button type="button" onclick="TheLife.addCareInteraction(\'' + _e(id) + '\')" class="fp-action-btn">+ Add Interaction</button>'
        + '</div>';
      if (interactions.length) {
        tlSec += '<div class="fp-timeline">';
        interactions.sort(function(a, b) {
          function _ts(v) { return v && typeof v === 'object' && v.seconds ? v.seconds : (Date.parse(String(v || '')) / 1000 || 0); }
          return _ts(b.date || b.createdAt) - _ts(a.date || a.createdAt);
        });
        interactions.forEach(function(ix) {
          tlSec += '<div class="fp-timeline-item">'
            + '<div class="fp-timeline-dot"></div>'
            + '<div class="fp-timeline-content">'
            + '<div class="fp-timeline-head">'
            + '<span class="fp-timeline-type">' + _e(ix.interactionType || ix.type || 'Note') + '</span>'
            + '<span class="fp-timeline-date">' + _e(_fmtDate(ix.date || ix.createdAt)) + '</span>'
            + (ix.createdBy ? '<span style="font-size:0.72rem;color:var(--ink-faint);margin-left:6px;">by ' + _e(ix.createdBy) + '</span>' : '')
            + '</div>'
            + '<div class="fp-timeline-body">' + _e(ix.notes || ix.description || '') + '</div>'
            + (ix.followUpDate ? '<div class="fp-timeline-fu">Follow-up: ' + _e(ix.followUpDate) + '</div>' : '')
            + '</div></div>';
        });
        tlSec += '</div>';
      } else {
        tlSec += '<div class="flock-empty"><div class="flock-empty-icon">\uD83D\uDCDD</div>No interactions recorded yet.</div>';
      }
      html += _fpSec('Interaction Timeline', 'care-timeline', tlSec);
    }

    // ── Section: Quick Actions ──
    if (id) {
      var actSec = '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
      var memLabel = _memberName(rec.memberId) || rec.memberId || '';
      if (rec.memberId) {
        actSec += '<button type="button" onclick="TheLife.viewMemberFromCase(\'' + _e(rec.memberId) + '\')" class="fp-action-btn">\uD83D\uDC64 View Member Profile</button>';
      }
      actSec += '<button type="button" onclick="TheLife.addCareInteraction(\'' + _e(id) + '\')" class="fp-action-btn">\uD83D\uDCDD Log Interaction</button>';
      actSec += '<button type="button" onclick="TheLife.scheduleCareFollowUp(\'' + _e(id) + '\')" class="fp-action-btn">\uD83D\uDCC5 Schedule Follow-Up</button>';
      actSec += '<button type="button" onclick="TheLife.createLinkedCase(\'' + _e(id) + '\',\'' + _e(rec.memberId || '') + '\')" class="fp-action-btn">\uD83D\uDD17 Create Linked Case</button>';
      actSec += '</div>';
      html += _fpSec('Quick Actions', 'care-actions', actSec);
    }

    // ── Section: Reach Out (Email / Call / Text) ──
    if (id && rec.memberId) {
      var memRec = _lookupMember(rec.memberId);
      var mEmail = memRec.primaryEmail || memRec.email || '';
      var mPhone = memRec.cellPhone || memRec.phone || memRec.homePhone || '';
      var mName  = ((memRec.preferredName || memRec.firstName || '') + ' ' + (memRec.lastName || '')).trim() || rec.memberName || rec.memberId;

      var roSec = '';

      // Quick-action buttons
      roSec += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">';
      if (mEmail) roSec += '<a href="mailto:' + encodeURIComponent(mEmail) + '?subject=' + encodeURIComponent('Checking In \u2014 ' + (rec.careType || 'Care')) + '" class="fp-action-btn">\u2709 Quick Email ' + _e(mEmail) + '</a>';
      if (mPhone) {
        roSec += '<button type="button" onclick="TheLife._callPhone(\'' + _e(mPhone) + '\')" class="fp-action-btn">\uD83D\uDCDE Call ' + _e(mPhone) + '</button>';
        roSec += '<button type="button" onclick="TheLife._smsPhone(\'' + _e(mPhone) + '\')" class="fp-action-btn">\uD83D\uDCAC Quick Text</button>';
      }
      if (!mEmail && !mPhone) roSec += '<div style="color:var(--ink-muted);font-size:0.82rem;">No contact info on file for this member.</div>';
      roSec += '</div>';

      // Compose & send section (like prayer reply)
      if (mEmail || mPhone) {
        roSec += '<div style="border-top:1px solid var(--line);padding-top:14px;">';
        roSec += '<label style="font-size:0.78rem;color:var(--ink-muted);display:block;margin-bottom:6px;">Compose & Send</label>';
        roSec += '<textarea id="fp-care-reach-msg" data-field="_reachMsg" rows="3" placeholder="Write a message to ' + _e(mName) + '\u2026" style="width:100%;background:rgba(255,255,255,0.07);border:1px solid var(--line);border-radius:6px;padding:8px 10px;color:var(--ink);font-size:max(0.92rem,16px);font-family:inherit;margin-bottom:10px;resize:vertical;"></textarea>';

        // Method radio buttons
        roSec += '<div style="display:flex;gap:16px;align-items:center;margin-bottom:10px;">';
        if (mEmail) roSec += '<label style="font-size:0.85rem;color:var(--ink);display:flex;align-items:center;gap:6px;cursor:pointer;">'
          + '<input type="radio" name="fp-care-reach-method" value="email"' + (mEmail ? ' checked' : '') + '> \u2709 Email' + (mEmail ? ' (' + _e(mEmail) + ')' : '') + '</label>';
        if (mPhone) roSec += '<label style="font-size:0.85rem;color:var(--ink);display:flex;align-items:center;gap:6px;cursor:pointer;">'
          + '<input type="radio" name="fp-care-reach-method" value="sms"' + (!mEmail && mPhone ? ' checked' : '') + '> \uD83D\uDCF1 Text' + (mPhone ? ' (' + _e(mPhone) + ')' : '') + '</label>';
        roSec += '</div>';

        roSec += '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
        roSec += '<button type="button" onclick="TheLife.sendCareReach()" class="fp-action-btn" style="background:var(--accent);color:var(--ink-inverse);border-color:var(--accent);font-weight:600;">\u2709 Send Message</button>';
        roSec += '<button type="button" onclick="TheLife.sendCareReach(\'log\')" class="fp-action-btn">Send & Log Interaction</button>';
        roSec += '</div>';
        roSec += '</div>';
      }

      html += _fpSec('Reach Out', 'care-reach', roSec);
    }

    // Bottom save
    html += '<div class="fp-bottom-bar">'
      + '<button type="button" onclick="TheLife.saveCareCase()" class="fp-save-btn">\uD83D\uDCBE Save Care Case</button>'
      + '<span id="fp-save-status2" class="fp-save-status"></span>'
      + '</div>';

    (document.getElementById('fp-body') || {}).innerHTML = html;

    // ── Care Type: workflow guide, priority default, and notes template wiring ──
    (function() {
      var ctSel   = document.getElementById('fp-careType');
      var priSel  = document.getElementById('fp-priority');
      var notesTa = document.getElementById('fp-notes');
      var panel   = document.getElementById('fp-care-panel');
      var _isNew  = !id;
      var _L = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';

      // Per-care-type config: icon, panel accent color, default priority, stage list, notes template
      if (!_careCFG) _careCFG = {
        'Crisis': {
          icon: '\uD83D\uDEA8', color: '#c94c4c', priority: 'Urgent',
          stages: [
            { t: 'Stage 1 \u2014 Immediate Response',   d: 'Contact within hours. Confirm physical safety. Never leave a crisis unacknowledged.' },
            { t: 'Stage 2 \u2014 Safety Assessment',    d: 'Danger? Self-harm? Housing secure? Children safe? If yes \u2192 involve authorities. Document everything.' },
            { t: 'Stage 3 \u2014 Resource Connection',  d: 'Connect to: 988 Lifeline, DV shelter, ER, or housing agency. The church walks alongside \u2014 it does not replace professional help.' },
            { t: 'Stage 4 \u2014 Stabilization',        d: 'Daily check-ins until stable. Log every contact. Assign secondary caregiver. No single point of failure.' },
            { t: 'Stage 5 \u2014 Transition',           d: 'Once stable: convert to Counseling, Grief, Restoration, or Shepherding. Close this case.' }
          ],
          notes: 'CRISIS INTAKE\n' + _L + '\nNature of Crisis:\n\n\nImmediate Safety Concerns (self-harm, danger, housing):\n\n\nPeople Involved:\n\n\n' + _L + '\nResources Contacted:\nReferrals Made:\nFollow-Up Plan:\nNext Check-In:',
          watchFor: [
            'Escalating language: hopelessness, finality, giving away possessions',
            'Dissociation: flat affect, disconnect from reality',
            'Substance use as coping',
            'Complete isolation from all support',
            'Return to the environment or person that caused the crisis'
          ],
          closureChecklist: [
            'Immediate safety confirmed',
            'Professional resources connected (if applicable)',
            'Transition case opened (Counseling, Grief, Restoration, Shepherding, or other)',
            'Member stable for at least 7 consecutive days before closure',
            'Final pastoral note'
          ]
        },
        'Grief': {
          icon: '\uD83E\uDD0E', color: '#9b7ec8', priority: 'High',
          stages: [
            { t: 'Stage 1 \u2014 First Contact (24 hrs)',  d: 'Reach out within 24 hours of learning of the loss. Show up \u2014 do not send a text and wait.' },
            { t: 'Stage 2 \u2014 Presence & Listening',   d: 'First visit: listen only. Do not minimize or problem-solve. Coordinate practical needs: meals, childcare, funeral logistics.' },
            { t: 'Stage 3 \u2014 Practical Support',      d: 'Activate Compassion team: meals 2 weeks, transportation, childcare. Handle memorial coordination.' },
            { t: 'Stage 4 \u2014 Ongoing Presence',      d: 'Week 1: daily. Month 1: weekly. After: bi-weekly. Grief peaks at 3\u20136 months \u2014 do not disappear then.' },
            { t: 'Stage 5 \u2014 Milestone Check-Ins',   d: 'Mark: 3 months, 6 months, 1 year, anniversary, first holidays. Calendar these at case creation.' }
          ],
          notes: 'GRIEF INTAKE\n' + _L + '\nLoss (what / whom / when):\n\n\nRelationship to Deceased:\n\nFamily Situation:\n\n\n' + _L + '\nImmediate Practical Needs:\nSpiritual State:\nSupport System:\nNext Contact:',
          watchFor: [
            'Isolation: declining all invitations, not attending church, not answering contacts',
            'Complicated grief symptoms: inability to function 6+ months post-loss, persistent disbelief',
            'Self-medication: increased alcohol use, sleep medication dependence',
            'Anniversary reactions: predictable spikes around holidays, birthdays, death anniversary',
            'Secondary losses: financial strain from lost income, identity loss from changed role'
          ],
          closureChecklist: [
            'All milestone dates contacted (3 months, 6 months, 1 year, anniversary, first holidays)',
            'Member verbally confirms readiness for closure',
            'Ongoing community connection confirmed (small group, friendships)',
            'Final pastoral note'
          ]
        },
        'Marriage': {
          icon: '\uD83D\uDC8D', color: '#c47878', priority: 'Normal',
          stages: [
            { t: 'Stage 1 \u2014 Initial Contact',     d: 'Often one spouse reaches out first. Listen without taking sides. Affirm the goal is to help the marriage, not adjudicate it.' },
            { t: 'Stage 2 \u2014 Joint Meeting',       d: 'Meet with both spouses when safe. No ongoing work with one spouse only. Danger present \u2192 handle separately, refer professionally.' },
            { t: 'Stage 3 \u2014 Counseling Plan',     d: 'Define cadence (weekly recommended), homework, and when referral is appropriate if no progress after 6 sessions.' },
            { t: 'Stage 4 \u2014 Sessions',            d: 'Focus on communication, covenant, Christ-centered vision. Log key themes as Interactions \u2014 not full session details.' },
            { t: 'Stage 5 \u2014 Referral if Needed', d: 'Abuse, trauma, addiction, mental health: refer professionally. Coordinate \u2014 do not abandon the couple.' },
            { t: 'Stage 6 \u2014 Close & Follow-Up',  d: 'Resolved: close the case. Schedule 3- and 6-month check-ins. Marriage is discipleship, not a problem to fix.' }
          ],
          notes: 'MARRIAGE INTAKE (CONFIDENTIAL)\n' + _L + '\nPresenting Issue:\n\n\nSpouse 1 Perspective:\n\n\nSpouse 2 Perspective:\n\n\nHow long has this been a struggle:\n\n' + _L + '\nChildren involved:  YES / NO\nPrior counseling:  YES / NO\nBoth willing to engage:  YES / NO\nSession Cadence:\nReferral Needed:',
          watchFor: [
            'One spouse disengaging from the process',
            'Escalation of conflict between sessions',
            'Disclosure of infidelity during counseling (requires immediate reassessment)',
            'Signs of domestic violence surfacing (activate DV protocol)',
            'Children in the home exhibiting stress reactions'
          ],
          closureChecklist: [
            'Both spouses agree care is no longer needed',
            'DV screening completed at intake (documented)',
            '3-month and 6-month follow-up check-ins scheduled',
            'Professional referral made if issues exceeded pastoral scope',
            'Final pastoral note'
          ]
        },
        'Addiction': {
          icon: '\uD83D\uDD17', color: '#d4853a', priority: 'High',
          stages: [
            { t: 'Stage 1 \u2014 Confidential Intake',    d: 'Zero condemnation. Be explicit about who will and will not know. This posture determines whether they stay or flee.' },
            { t: 'Stage 2 \u2014 Assessment',             d: 'Substance/behavior, duration, family awareness, professional support in place, safety risks (some withdrawal needs medical care).' },
            { t: 'Stage 3 \u2014 Accountability',         d: 'Assign an accountability partner (same-sex, mature believer). Weekly minimum check-ins. Document triggers in Notes.' },
            { t: 'Stage 4 \u2014 Professional Referral',  d: 'AA/NA/Celebrate Recovery, licensed counselor, or treatment program. The church walks alongside \u2014 it does not replace.' },
            { t: 'Stage 5 \u2014 Ongoing Through Relapse', d: 'Relapse is common. Do not withdraw. Recommit to the plan. Celebrate milestones: 30d, 90d, 6mo, 1yr.' },
            { t: 'Stage 6 \u2014 Long-Term Follow-Up',   d: 'Recovery is measured in years. Maintain connection even in stable sobriety. New identity in Christ is the goal.' }
          ],
          notes: 'ADDICTION INTAKE (CONFIDENTIAL)\n' + _L + '\nSubstance / Behavior:\n\nDuration / History:\n\nCurrent Status (active / recovery / relapse):\n\nFamily Awareness:  YES / NO\n\n' + _L + '\nAccountability Partner:\nProfessional Support (AA / therapist / program):\nChurch Support Plan:\nNext Check-In:',
          watchFor: [
            'Return to previous social environments (people, places, patterns)',
            'Sudden improvement in mood without explanation (possible return to substance)',
            'Financial irregularities: unexplained spending, borrowing, selling possessions',
            'Missed accountability check-ins',
            'Defensiveness or avoidance when asked direct questions',
            'Family members reporting concern',
            'Stopping professional treatment without consultation'
          ],
          closureChecklist: [
            'Accountability partner active and consistent',
            'Professional support connected (AA/NA/Celebrate Recovery/counselor)',
            'Minimum 12 months of sustained recovery before closure',
            'Milestones celebrated (30d, 90d, 6mo, 1yr)',
            'Transition to Shepherding (do not fully close)',
            'Final pastoral note'
          ]
        },
        'Hospital Visit': {
          icon: '\uD83C\uDFE5', color: '#5b9bd5', priority: 'Urgent',
          stages: [
            { t: 'Stage 1 \u2014 Contact Within 24 Hours', d: 'Never let a member be hospitalized without pastoral contact in 24 hours. Call if you cannot visit immediately.' },
            { t: 'Stage 2 \u2014 Visit & Pray',            d: 'Show up. Read Scripture (Psalm 23, Psalm 46, John 14). Pray specifically. Brief is fine \u2014 the point is presence.' },
            { t: 'Stage 3 \u2014 Follow the Family',       d: 'The waiting room needs pastoral care too. A call to the spouse or adult child carrying the weight matters.' },
            { t: 'Stage 4 \u2014 Discharge & Recovery',    d: 'Follow up within 48 hours of discharge. Arrange meals or help. Check in weekly until clearly recovering.' },
            { t: 'Stage 5 \u2014 Close or Transition',     d: 'Full recovery \u2192 resolve. Long-term illness \u2192 Elder Care or Shepherding. Member passes \u2192 open Grief case for family.' }
          ],
          notes: 'HOSPITAL VISIT\n' + _L + '\nHospital / Facility:\n\nRoom / Unit:\n\nNature of Illness / Procedure:\n\nFamily Present:\n\n' + _L + '\nVisit Date:\nPrayer Topics:\nExpected Discharge:\nFamily Needs:',
          closureChecklist: [
            'Post-discharge follow-up completed (within 48 hours)',
            'Practical needs addressed (meals, transport)',
            'If long-term: transitioned to Medical, Elder Care, or Shepherding',
            'If member passed: Grief case opened for family',
            'Final pastoral note'
          ]
        },
        'Medical': {
          icon: '\uD83E\uDE79', color: '#3d9fbf', priority: 'High',
          stages: [
            { t: 'Stage 1 \u2014 Initial Notification',     d: 'Contact within 48 hours of learning of the diagnosis or condition. Do not wait for them to reach out \u2014 the silence of the church in a health crisis is a wound that lasts.' },
            { t: 'Stage 2 \u2014 Pastoral Visit & Prayer',  d: 'Arrange an in-person or video visit. Listen before advising. Read Scripture (Psalm 23, Psalm 103, Romans 8:18-28). Pray specifically \u2014 name the diagnosis, name the fear, name the hope.' },
            { t: 'Stage 3 \u2014 Practical Support',        d: 'Activate Compassion team: meals during treatment, transportation to appointments, household and childcare help. Assign a volunteer point person and log their name in Notes.' },
            { t: 'Stage 4 \u2014 Family Coordination',      d: 'Identify the primary family caregiver. They are carrying weight too. A call, a meal, or prayer for the caregiver is pastoral care.' },
            { t: 'Stage 5 \u2014 Ongoing Care Through Treatment', d: 'Track treatment phases (surgery, chemo, radiation, recovery). Reach out before and after each major procedure. Do not disappear between appointments.' },
            { t: 'Stage 6 \u2014 Close or Transition',      d: 'Full recovery \u2192 celebrate and resolve. Chronic or terminal illness \u2192 transition to Elder Care. Member passes \u2192 open Grief case for family immediately.' }
          ],
          notes: 'MEDICAL CARE INTAKE\n' + _L + '\nDiagnosis / Medical Situation:\n\nTreatment Plan (surgery, chemo, procedure, other):\n\nExpected Timeline:\n\n\n' + _L + '\nPrimary Family Contact & Relationship:\n\nPractical Needs (meals / transport / household / childcare):\n\nSpiritual State:\n\nPrayer Requests:\n\nNext Contact:',
          watchFor: [
            'Increased isolation during treatment phases',
            'Spiritual drift or questioning God during prolonged illness',
            'Caregiver breakdown: family member carrying the primary burden showing exhaustion or resentment',
            'Financial strain from medical costs not being disclosed',
            'Depression developing alongside the physical condition'
          ],
          closureChecklist: [
            'Treatment phase documented',
            'Caregiver fatigue assessed (family caregiver)',
            'If terminal: transitioned to Terminal Illness workflow',
            'If member passed: Grief case opened for family',
            'Compassion team support wound down or transitioned',
            'Final pastoral note'
          ]
        },
        'New Believer': {
          icon: '\u2728', color: '#4caf8a', priority: 'Normal',
          stages: [
            { t: 'Stage 1 \u2014 Immediate Connection',    d: 'Contact within 48 hours of salvation or first connection. Make them feel found, not processed.' },
            { t: 'Stage 2 \u2014 Assign a Mentor',         d: 'Same-sex, mature believer. Not the pastor \u2014 discipleship at the body level. Chemistry matters.' },
            { t: 'Stage 3 \u2014 Foundations (4\u20138 wks)', d: 'Who is God? Jesus? The Bible, prayer, the church, sin, and grace. Structured guide. Write answers together.' },
            { t: 'Stage 4 \u2014 Community Integration',   d: 'Into a small group within 30 days. Belonging precedes behaving. Introduce them personally.' },
            { t: 'Stage 5 \u2014 Baptism Conversation',   d: 'When they understand what they believe and why: have the conversation. Milestone, not checkbox.' },
            { t: 'Stage 6 \u2014 Close & Celebrate',      d: 'At 6 months: in community, growing, serving? Celebrate and close. A sheep is in the fold.' }
          ],
          notes: 'NEW BELIEVER INTAKE\n' + _L + '\nHow they came to faith:\n\n\nBackground (church history, prior faith):\n\nImmediate Questions / Concerns:\n\n\n' + _L + '\nMentor Assigned:\nFoundations Curriculum:\nSmall Group:\nBaptism Interest:  YES / NO\nNext Meeting:',
          watchFor: [
            'Isolation from the faith community within the first 90 days (highest dropout risk)',
            'Pressure from family or friends hostile to the decision',
            'Theological confusion from online sources or fringe teaching',
            'Overwhelming guilt about past life without understanding of grace',
            'Mentor mismatch: lack of chemistry, missed meetings, fading engagement'
          ],
          closureChecklist: [
            'Mentor assigned and relationship active',
            'Foundations curriculum completed (4\u20138 weeks)',
            'Connected to a small group',
            'Baptism conversation had (and completed if ready)',
            'Serving conversation initiated',
            'Final pastoral note'
          ]
        },
        'Restoration': {
          icon: '\uD83D\uDD04', color: '#d4a93a', priority: 'High',
          stages: [
            { t: 'Stage 1 \u2014 Sensitive Intake',           d: 'Lead with grace. Establish the goal is restoration, not punishment. Be explicit about who will know.' },
            { t: 'Stage 2 \u2014 Understand the Situation',   d: 'What happened? Who was harmed? Ongoing or past? Is repentance genuine? Legal implications?' },
            { t: 'Stage 3 \u2014 Accountability Plan',        d: 'Named elder/leader as sponsor. Weekly check-ins. Agreed-upon boundaries. Defined timeline with review points.' },
            { t: 'Stage 4 \u2014 Community Reintegration',   d: 'Gradual, not sudden. Protect the community. Those harmed must not be retraumatized. Process, not event.' },
            { t: 'Stage 5 \u2014 Long-Term Review',          d: '3- and 6-month reviews. Flourishing, serving appropriately, no new concerns \u2192 then and only then resolve.' }
          ],
          notes: 'RESTORATION INTAKE (CONFIDENTIAL)\n' + _L + '\nSituation Summary:\n\n\nRepentance Indicators:\n\nPeople Affected:\n\n\n' + _L + '\nAccountability Structure:\nRestoration Steps Agreed:\nElder / Pastor Oversight:\nTimeline for Review:',
          watchFor: [
            'Premature restoration: community pressure to \u201cmove on\u201d before the process is complete',
            'Victim being sidelined: harmed person\u2019s needs overshadowed by the offender\u2019s restoration',
            'Accountability collapse: meetings becoming routine or being skipped',
            'Public repentance used manipulatively: appearing contrite without genuine heart change',
            'Legal issues quietly dropped: ensure the church does not obstruct any civil or criminal process'
          ],
          closureChecklist: [
            'Accountability plan completed (3\u20136 month minimum)',
            'Formal reviews at 3 and 6 months completed',
            'Victim care addressed in a separate case (if applicable)',
            'Community reintegration gradual and appropriate',
            'No active concerns from accountability sponsor',
            'Final pastoral note'
          ]
        },
        'Counseling': {
          icon: '\uD83D\uDDE3', color: '#5b9bd5', priority: 'Normal',
          stages: [
            { t: 'Stage 1 \u2014 Intake',                       d: 'Understand the presenting issue and goals. Is this within pastoral scope or does it need a licensed professional from the start?' },
            { t: 'Stage 2 \u2014 First Session \u2014 Listen',  d: 'Entirely listening. Resist the urge to fix. Help them articulate the root, not just the symptom.' },
            { t: 'Stage 3 \u2014 Ongoing Sessions',            d: 'Weekly or bi-weekly. Bring Scripture naturally. Assign homework and follow up on it.' },
            { t: 'Stage 4 \u2014 Refer if Needed',             d: 'Mental illness, trauma, addiction, suicidal ideation, DV: refer professionally. Coordinate both tracks.' },
            { t: 'Stage 5 \u2014 Close',                       d: 'Presenting issue resolved or tools in hand: close with prayer, reflection, and a 30-day check-in.' }
          ],
          notes: 'COUNSELING INTAKE\n' + _L + '\nPresenting Issue:\n\n\nBackground:\n\nGoals for Counseling:\n\n\n' + _L + '\nSession Cadence:\nReferral Needed:  YES / NO\nReferral Resource:\nNext Session:',
          watchFor: [
            'Issues beyond pastoral scope being treated as pastoral counseling (diagnosable conditions, trauma, suicidal ideation)',
            'Dependency: member becoming emotionally reliant on the counseling relationship rather than building broader support',
            'Counselor burnout: pastoral counselors carrying too many active sessions without rest or supervision',
            'Stalled progress: sessions continuing without clear direction or measurable improvement'
          ],
          closureChecklist: [
            'Presenting issue resolved or member has tools to continue',
            'Professional referral made if clinical issues surfaced',
            '30-day follow-up check-in scheduled',
            'If ongoing need: transitioned to Mental Health, Shepherding, or appropriate care type',
            'Final pastoral note'
          ]
        },
        'Discipleship': {
          icon: '\uD83D\uDCDA', color: '#4caf8a', priority: 'Low',
          stages: [
            { t: 'Stage 1 \u2014 Match with Disciple-Maker', d: 'Same-sex, mature believer who models what the disciple needs to become. Chemistry matters \u2014 do not force a bad match.' },
            { t: 'Stage 2 \u2014 Define Goals',              d: 'What do you want to look different in 6 months? Write the goals. Undefined discipleship drifts.' },
            { t: 'Stage 3 \u2014 Regular Meetings',          d: 'Weekly is ideal. A curriculum gives structure \u2014 but the conversation, not the content, is the point.' },
            { t: 'Stage 4 \u2014 Milestone Celebration',     d: 'Mark growth moments: first Bible study completed, sharing faith, serving, baptism. Log each as an Interaction.' },
            { t: 'Stage 5 \u2014 Multiply',                  d: 'The goal is a disciple who makes disciples. When ready: identify someone younger in faith to walk with. Celebrate and close.' }
          ],
          notes: 'DISCIPLESHIP PLAN\n' + _L + '\nDisciple-Maker Assigned:\n\nGoals (spiritual growth areas):\n\nCurrent Spiritual Disciplines:\n\n\n' + _L + '\nMeeting Cadence:\nCurriculum / Study:\nMilestones:\nTarget Completion:',
          watchFor: [
            'Stalled progress: meetings happening but no growth \u2014 curriculum may need changing or the match is not working',
            'Knowledge without obedience: studying but not applying',
            'Disciple-maker burnout: carrying too many relationships at once',
            'Forced multiplication: pushing someone to disciple before they are ready'
          ],
          closureChecklist: [
            'Goals defined at intake have been met or revised',
            'Curriculum or plan completed',
            'Member connected to ongoing community',
            'Multiplication conversation had (are they ready to disciple someone?)',
            'Final pastoral note'
          ]
        },
        'Family': {
          icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', color: '#c47878', priority: 'Normal',
          stages: [
            { t: 'Stage 1 \u2014 Intake',                 d: 'Who is reaching out? Who else is involved? Safety concern? The caller is often carrying weight for the whole family.' },
            { t: 'Stage 2 \u2014 Family Dynamics',        d: 'Prodigal child, estrangement, parenting struggle, blended family tension, parent-care conflict? Listen before advising.' },
            { t: 'Stage 3 \u2014 Care Plan',              d: 'Pastoral listening, practical resources (parenting class, therapy referral), or safety need? Assign caregiver and cadence.' },
            { t: 'Stage 4 \u2014 Ongoing Support',        d: 'Family situations are rarely quick. Commit to the long view. Pray specifically for the relational dynamics at play.' },
            { t: 'Stage 5 \u2014 Referral if Needed',    d: 'Family therapy for severe dysfunction; legal counsel for custody/estate; DV resources if safety is a concern.' }
          ],
          notes: 'FAMILY CARE INTAKE\n' + _L + '\nPresenting Situation:\n\n\nFamily Members Involved:\n\nChildren Present:  YES / NO\n\n\n' + _L + '\nKey Needs (spiritual / relational / practical):\nReferral Needed:\nFollow-Up Plan:\nNext Contact:',
          watchFor: [
            'Safety concerns masked as \u201cfamily conflict\u201d \u2014 always assess for domestic violence',
            'Prodigal parent burnout: the parent carrying years of grief and self-blame',
            'Children caught in the middle of adult conflict',
            'Blended family loyalty wounds: children feeling forced to choose between parents',
            'Estrangement reinforced by church members taking sides'
          ],
          closureChecklist: [
            'Presenting issue addressed or stabilized',
            'Professional referral made if clinical intervention needed',
            'Safety concerns resolved (if applicable)',
            'All affected family members offered care (not just the one who called)',
            'Follow-up plan in place',
            'Final pastoral note'
          ]
        },
        'Financial': {
          icon: '\uD83D\uDCB0', color: '#4caf8a', priority: 'Normal',
          stages: [
            { t: 'Stage 1 \u2014 Confidential Intake',      d: 'Financial need carries shame. Make them feel safe, not judged. Be explicit about confidentiality.' },
            { t: 'Stage 2 \u2014 Needs Assessment',         d: 'Immediate need (rent, utilities, food, medical)? Cause? One-time crisis or recurring pattern? Household size?' },
            { t: 'Stage 3 \u2014 Stewardship Counsel',      d: 'Crown Financial, Good Sense, or budget coaching. Offer this regardless of whether assistance is provided.' },
            { t: 'Stage 4 \u2014 Assistance if Applicable', d: 'Benevolence Fund: follow church policy. Document. Aid is a hand-up, not a hand-out. Connect to a stewardship plan.' },
            { t: 'Stage 5 \u2014 Follow-Up',               d: 'Check in at 30 and 90 days. Is the situation improving? Is there a trajectory toward stability?' }
          ],
          notes: 'FINANCIAL CARE INTAKE (CONFIDENTIAL)\n' + _L + '\nPresenting Need:\n\nCause (job loss / medical / other):\n\nHousehold Size:\n\n\n' + _L + '\nImmediate Assistance Needed:  YES / NO\nAmount / Type Requested:\nBenevolence Eligibility:\nStewardship Resources Shared:\nFollow-Up Date:',
          watchFor: [
            'Shame preventing honest disclosure of the full financial picture',
            'Recurring crises: repeated emergency requests may indicate a deeper issue (addiction, exploitation, mental health)',
            'Benevolence dependency: assistance without a stewardship plan creating a cycle',
            'Marital strain caused by or worsened by financial stress'
          ],
          closureChecklist: [
            'Immediate need addressed',
            'Stewardship plan or budget coaching offered',
            '30-day and 90-day follow-ups completed',
            'If benevolence funds used: documented per church policy',
            'Trajectory toward stability confirmed',
            'Final pastoral note'
          ]
        },
        'Shepherding': {
          icon: '\uD83D\uDC11', color: '#7eaacc', priority: 'Low',
          stages: [
            { t: 'Stage 1 \u2014 Connection',           d: 'Initiate contact. Often proactive \u2014 the member may not know they are being shepherded. Know your sheep before they need rescue.' },
            { t: 'Stage 2 \u2014 Regular Check-Ins',    d: 'Monthly minimum. Spiritual, relational, and practical state. A shepherd who only acts in crisis is not shepherding.' },
            { t: 'Stage 3 \u2014 Identify Deeper Needs', d: 'Shepherding often reveals what the member would not have initiated. Watch for withdrawal, spiritual drift, stress.' },
            { t: 'Stage 4 \u2014 Close or Escalate',    d: '3 healthy months: resolve (the relationship continues). Deeper need surfaces: convert to the appropriate care type.' }
          ],
          notes: 'SHEPHERDING NOTES\n' + _L + '\nReason for case:\n\nSpiritual State:\n\nLife Circumstances:\n\n\n' + _L + '\nConnection Goal:\nVisit Cadence:\nNext Contact:',
          watchFor: [
            'Gradual withdrawal from community: attendance drops, responses become shorter, engagement fades',
            'Life transitions not disclosed: job loss, health change, relational strain quietly absorbing them',
            'Spiritual drift: going through the motions without growth or engagement',
            'Shepherding case sitting idle: if no Interactions are logged for 60 days, the shepherd has lost the sheep'
          ],
          closureChecklist: [
            '3 consecutive months of healthy, stable engagement',
            'No pending concerns or unresolved needs',
            'Member aware of and connected to ongoing church community',
            'If deeper need emerged: appropriate care type case opened',
            'Final pastoral note'
          ]
        },
        'Elder Care': {
          icon: '\uD83E\uDDD3', color: '#d4b870', priority: 'High',
          footer: 'Visit Cadence: Urgent \u2192 every 2\u20133 days \u00a0\u00b7\u00a0 High \u2192 weekly \u00a0\u00b7\u00a0 Normal/stable \u2192 bi-weekly',
          stages: [
            { t: 'Stage 1 \u2014 Referral',              d: 'Case opened within 24 hrs. Notify lead pastor.' },
            { t: 'Stage 2 \u2014 Assessment (48 hrs)',   d: 'In-person visit. Assess: Spiritual \u00b7 Physical \u00b7 Practical \u00b7 Relational. Document in Notes.' },
            { t: 'Stage 3 \u2014 Care Plan',             d: 'Assign Primary + Secondary Caregiver. Set visit cadence. Slot volunteers for meals, transport, companionship.' },
            { t: 'Stage 4 \u2014 Active Care',           d: 'Log every contact as an Interaction. Monthly report to pastor. Pray on every visit.' },
            { t: 'Stage 5 \u2014 Escalation',            d: 'Signs of decline \u2192 elevate to Urgent, increase visits, pastor personally attends.' },
            { t: 'Stage 6 \u2014 Transition',            d: 'Facility/hospice: visit within first week. When member passes \u2192 open Grief case for family.' }
          ],
          notes: 'ASSESSMENT\n' + _L + '\nSpiritual (peace, connection, foundation):\n\n\nPhysical (meals, mobility, medication, safety):\n\n\nPractical (transport, bills, home, errands):\n\n\nRelational (family involvement, isolation):\n\n\n' + _L + '\nVisit Cadence: Weekly\nFamily Contact:\nNext Review Date:',
          watchFor: [
            'Cognitive decline: confusion, repeating questions, forgetting names',
            'Hygiene deterioration: unwashed clothing, body odor, unkempt appearance',
            'Weight loss or gain: not eating, eating poorly, unable to cook',
            'Medication confusion: missed doses, double doses, expired prescriptions',
            'Fall risk: bruises, unsteady gait, clutter in walking paths',
            'Withdrawal: declining visits, not answering phone, canceling appointments',
            'Financial exploitation: unexplained withdrawals, new \u201cfriends\u201d managing money',
            'Caregiver burnout in family members: exhaustion, resentment, health decline in the caregiver themselves'
          ],
          closureChecklist: [
            'All interactions logged through end of care',
            'Family notified and connected',
            'Follow-up plan exists (even after closure)',
            'If member passed: Grief case opened for family',
            'If transitioned to facility: facility contact info recorded, visitation cadence established',
            'Final pastoral note'
          ]
        },
        'Abuse / Domestic Violence': {
          icon: '\uD83D\uDEE1', color: '#c94c4c', priority: 'Urgent',
          stages: [
            { t: 'Stage 1 \u2014 Disclosure & Response',  d: 'Believe them. Create a private setting immediately \u2014 never in the presence of the abuser. Ask: Are you safe? Are your children safe? Do not contact or confront the abuser.' },
            { t: 'Stage 2 \u2014 Safety Planning',        d: 'Safe people, safe location, go-bag, documents. Refer to local DV shelter. Do not pressure a timeline \u2014 victims leave an average of 7 times before leaving for good.' },
            { t: 'Stage 3 \u2014 Sustained Pastoral Care', d: 'Assign same-sex caregiver. Weekly contact minimum. Never place victim in a setting with the abuser without their explicit consent.' },
            { t: 'Stage 4 \u2014 Legal & Practical Support', d: 'Accompany to court if requested. Connect to legal aid. Coordinate Compassion team: housing, meals, childcare, transport.' },
            { t: 'Stage 5 \u2014 Long-Term Care',         d: 'Healing is measured in years. Watch for re-entry into abusive relationship (no condemnation), PTSD, spiritual wounds. At 6 months: formal review.' }
          ],
          notes: 'ABUSE / DV INTAKE (CONFIDENTIAL \u2014 DO NOT SHARE)\n' + _L + '\nNature of Abuse (physical / emotional / financial / sexual / spiritual):\n\nDuration:\n\nChildren in home:  YES / NO\n\n\n' + _L + '\nImmediate Safety:  SAFE / AT RISK\nShelter / Safe Location Identified:\nLegal Action Desired:  YES / NO / UNSURE\nMandatory Report Filed:  YES / NO / N/A\nNext Contact:',
          watchFor: [
            'Re-entry into the abusive relationship (no condemnation \u2014 maintain care)',
            'PTSD symptoms: hypervigilance, nightmares, startle response, emotional numbing',
            'Abuser showing up at church or using church systems to locate victim',
            'Children exhibiting behavioral changes: aggression, withdrawal, regression',
            'Spiritual wounds: distrust of authority, questioning God\u2019s protection'
          ],
          closureChecklist: [
            'Victim is physically safe',
            'Victim has confirmed they are ready for case closure',
            'Professional support connected (DV shelter, counselor, legal aid)',
            'No information in the case is accessible to the abuser',
            'Shepherding case opened for ongoing oversight',
            'Final pastoral note'
          ]
        },
        'Immigration / Deportation': {
          icon: '\u2708', color: '#5b9bd5', priority: 'High',
          stages: [
            { t: 'Stage 1 \u2014 Confidential Disclosure', d: 'Absolute confidentiality \u2014 immigration status disclosure can cause direct, irreversible harm. Is active enforcement underway? If yes: Crisis protocol + this workflow simultaneously.' },
            { t: 'Stage 2 \u2014 Legal Resource Connection', d: 'Connect immediately to qualified immigration legal help (CLINIC, Immigration Advocates Network). Warn explicitly against notarios and unlicensed consultants.' },
            { t: 'Stage 3 \u2014 Practical & Safety Planning', d: 'Organize critical documents. Build family emergency plan: who cares for children, power of attorney. Compassion team: meals, transport, financial assistance.' },
            { t: 'Stage 4 \u2014 If Detention Occurs',      d: 'Contact immigration attorney immediately. Visit if facility allows. Support the family remaining at home \u2014 they are now in their own crisis.' },
            { t: 'Stage 5 \u2014 If Deportation Occurs',   d: 'Continue pastoral care for the family remaining. Maintain contact with deported member. Long-term separation care is multi-year work.' },
            { t: 'Stage 6 \u2014 Sustained Accompaniment', d: 'Immigration situations extend for months or years. Remain present through every court date and appeal. Case review every 6 months.' }
          ],
          notes: 'IMMIGRATION CARE INTAKE (CONFIDENTIAL \u2014 DO NOT DISCLOSE STATUS)\n' + _L + '\nGeneral Situation (no status details in this field \u2014 verbal only):\n\nFamily Members Affected:\n\nU.S.-Citizen Children:  YES / NO\n\n\n' + _L + '\nEnforcement Action Active:  YES / NO\nLegal Counsel Connected:  YES / NO\nFamily Emergency Plan in Place:  YES / NO\nNext Contact:',
          closureChecklist: [
            'Legal counsel connected',
            'Family emergency plan in place',
            'All family members accounted for in care',
            'If deportation occurred: family case remains open',
            '6-month review completed before any closure',
            'Final pastoral note'
          ]
        },
        'Incarceration & Re-Entry': {
          icon: '\uD83D\uDD11', color: '#7eaacc', priority: 'High',
          stages: [
            { t: 'Stage 1 \u2014 Arrest / Sentencing',    d: 'Contact the family immediately. Open a separate Family case for the household. Do not withdraw from the incarcerated member \u2014 the fold extends inside.' },
            { t: 'Stage 2 \u2014 Ministry Inside',        d: 'Establish visitation schedule. Send letters and cards. Ensure member has a Bible. Explore chaplaincy volunteer access.' },
            { t: 'Stage 3 \u2014 Family on the Outside',  d: 'Spouse and children experience a distinct grief. Children with an incarcerated parent are at elevated risk. Activate Compassion: meals, financial, transport.' },
            { t: 'Stage 4 \u2014 Pre-Release Planning',   d: 'Begin 60\u201390 days before release. Address: housing, employment (re-entry-friendly employers), community, and legal requirements (parole/probation terms).' },
            { t: 'Stage 5 \u2014 Re-Entry',               d: 'Be present near release day \u2014 this is the highest-risk moment. Assign accountability partner. Weekly check-ins for first 90 days. Introduce personally to community.' },
            { t: 'Stage 6 \u2014 Long-Term Stability',   d: 'Keep case open 12 months minimum. Watch for return to prior environments and isolation. Celebrate milestones. Close \u2192 transition to Discipleship or Shepherding.' }
          ],
          notes: 'INCARCERATION INTAKE\n' + _L + '\nCurrent Status (incarcerated / pre-sentencing / re-entry):\n\nFacility / Location:\n\nExpected Release Date:\n\nFamily Members Affected:\n\n\n' + _L + '\nFamily Care Case Opened:  YES / NO\nVisitation Registration Needed:  YES / NO\nKey Re-Entry Barriers:\nAccountability Partner:\nNext Contact:',
          watchFor: [
            'Return to previous relationships and environments post-release',
            'Substance use relapse during re-entry period',
            'Employment instability or inability to find re-entry-friendly work',
            'Isolation from church community after release'
          ],
          closureChecklist: [
            'Re-entry plan executed (housing, employment, community)',
            'Accountability partner assigned and active',
            '12 months of stable community participation',
            'Family case reviewed and updated',
            'Transition to Discipleship or Shepherding',
            'Final pastoral note'
          ]
        },
        'Pregnancy & Infant Loss': {
          icon: '\uD83D\uDD4A', color: '#9b7ec8', priority: 'High',
          stages: [
            { t: 'Stage 1 \u2014 First Contact (24 hrs)',  d: 'Contact within 24 hours. Lead with presence, not words. Acknowledge the father explicitly \u2014 his grief is real and often invisible. Do NOT say: "At least it was early," "You can try again," or "God needed an angel."' },
            { t: 'Stage 2 \u2014 Presence & Acknowledgment', d: 'Visit in person. Bring food, not advice. Ask about the baby by name if given. Activate Compassion: meals 2+ weeks, childcare, errands.' },
            { t: 'Stage 3 \u2014 Ongoing Grief Journey',  d: 'Follow standard Grief cadence. Calendar grief spikes: original due date, first Mother\u2019s/Father\u2019s Day, anniversary of loss, subsequent pregnancies.' },
            { t: 'Stage 4 \u2014 Referral & Community',   d: 'Refer to SHARE Pregnancy & Infant Loss Support (nationalshare.org). Consider a private memorial prayer of naming. For infertility: long-term care with no defined endpoint is right.' },
            { t: 'Stage 5 \u2014 Close or Transition',    d: 'Close when family is clearly stabilized. Leave the door open explicitly. Recurring loss or infertility: convert to Shepherding for sustained connection.' }
          ],
          notes: 'PREGNANCY & INFANT LOSS INTAKE\n' + _L + '\nType of Loss (miscarriage / stillbirth / infant death / infertility / other):\n\nDate of Loss:\n\nOriginal Due Date (if applicable):\n\nFather / Partner Acknowledged:  YES\n\n\n' + _L + '\nPractical Needs:\nSpiritual State:\nReferral Made:  YES / NO\nGrief Milestone Dates Calendared:  YES / NO\nNext Contact:',
          watchFor: [
            'Isolation and withdrawal \u2014 same patterns as Grief',
            'Father/partner grief being invisible or dismissed',
            'Anniversary reactions: original due date, loss anniversary, Mother\u2019s/Father\u2019s Day',
            'Subsequent pregnancy triggering intense anxiety or fear'
          ],
          closureChecklist: [
            'Father/partner explicitly included in care throughout',
            'Grief milestone dates calendared and contacted (due date, anniversary, Mother\u2019s/Father\u2019s Day)',
            'Referral to support group made (SHARE or equivalent)',
            'Door left explicitly open for future contact',
            'If subsequent pregnancy occurs: new care noted',
            'Final pastoral note'
          ]
        },
        'Pre-Marriage': {
          icon: '\uD83D\uDC91', color: '#c47878', priority: 'Normal',
          stages: [
            { t: 'Stage 1 \u2014 Engagement Contact',     d: 'Contact within 1 week of learning of the engagement. Frame the process as a gift: \u201cWe want to do everything we can to help you both start well.\u201d' },
            { t: 'Stage 2 \u2014 Initial Assessment',     d: 'Meet individually with husband and wife first. Assess: family of origin, communication patterns, conflict history, finances, children, faith alignment. Consider PREPARE/ENRICH assessment (prepare-enrich.com).' },
            { t: 'Stage 3 \u2014 Structured Preparation', d: '6 sessions minimum: (1) Covenant & Commitment, (2) Communication & Conflict, (3) Family of Origin, (4) Finances, (5) Roles & Expectations, (6) Faith & Spiritual Life. Mentor couple model recommended.' },
            { t: 'Stage 4 \u2014 Pre-Wedding Meeting',    d: 'Within 30 days of the wedding. Rehearsal logistics, ceremony content, Scripture. Ask both: \u201cIs there anything on your heart as you enter this covenant?\u201d Pray together.' },
            { t: 'Stage 5 \u2014 Post-Wedding Follow-Up', d: 'Check in at 3 months, 6 months, and 1 year. These contacts are the bridge to the Marriage workflow if it is ever needed.' }
          ],
          notes: 'PRE-MARRIAGE INTAKE\n' + _L + '\nWedding Date:\n\nHusband Name:\n\nWife Name:\n\nPrior Marriage (either):  YES / NO\nChildren from Prior Relationship:  YES / NO\n\n\n' + _L + '\nAssessment Tool Used:\nMentor Couple Assigned:\nSessions Completed:\nKey Topics / Themes:\nPost-Wedding Check-In Dates:',
          closureChecklist: [
            'All 6 preparation sessions completed',
            'Pre-wedding pastoral meeting conducted',
            'Post-wedding follow-ups scheduled (3, 6, 12 months)',
            'Assessment tool results reviewed with couple',
            'Final pastoral note'
          ]
        },
        'Terminal Illness / End of Life': {
          icon: '\uD83D\uDD6F', color: '#9b7ec8', priority: 'High',
          stages: [
            { t: 'Stage 1 \u2014 Receiving the News',     d: 'Contact within 24 hours. Lead with presence and prayer, not theology. Do not say \u201cGod will heal you\u201d unless they say it first. Ask about the family \u2014 open a second case if needed.' },
            { t: 'Stage 2 \u2014 Walking the Journey',    d: 'Weekly visits minimum. Pray specifically. Walk through over time: their life story, what they believe about what comes next, forgiveness, legacy. Encourage advance directive conversations.' },
            { t: 'Stage 3 \u2014 Family Care',            d: 'Family is in anticipatory grief \u2014 name it and tend to it. Separate pastoral care for the primary caregiver. Resources for children in the home. Partner with hospice team.' },
            { t: 'Stage 4 \u2014 Active Dying Phase',     d: 'Pastor personally reachable at all hours. Be present in the vigil if wanted. Read Scripture aloud \u2014 hearing is often the last sense to fade. Pray. Name the person. Commit them to God\u2019s hands.' },
            { t: 'Stage 5 \u2014 Immediate Family Care',  d: 'Remain with the family after death. Activate the Grief workflow for the family. Coordinate memorial / funeral. Personal contact every week for the first 30 days.' }
          ],
          notes: 'TERMINAL ILLNESS INTAKE\n' + _L + '\nDiagnosis:\n\nPrognosis / Timeline:\n\nHospice Enrolled:  YES / NO\nHospice Team:\n\nFamily Situation:\n\n\n' + _L + '\nPrimary Family Caregiver:\nAdvance Directive in Place:  YES / NO\nSpiritual State:\nKey Topics to Walk Through:\nNext Visit:',
          watchFor: [
            'Family conflict over end-of-life decisions',
            'Patient expressing unresolved guilt, fear, or anger',
            'Caregiver collapse: the family member carrying the primary burden breaking down',
            'Spiritual crisis: questioning God\u2019s goodness, fairness, or presence',
            'Hospice team and church team working in isolation \u2014 coordinate intentionally'
          ],
          closureChecklist: [
            'Advance directive conversation completed',
            'Hospice team coordinated',
            'Family care provided throughout (separate case or documented)',
            'At passing: Grief case opened for family immediately',
            'Memorial/funeral coordination completed',
            '30-day post-loss family contact plan active',
            'Final pastoral note'
          ]
        },
        'New Member Integration': {
          icon: '\uD83E\uDD1D', color: '#4caf8a', priority: 'Normal',
          stages: [
            { t: 'Stage 1 \u2014 Connection at Joining',  d: 'Personal contact within 48 hours of a new member commitment. Assign a Welcome Elder or Deacon. Learn their story: background, what brought them here, what they\u2019re hoping for.' },
            { t: 'Stage 2 \u2014 30 Days: Belonging',     d: 'Personal introduction to a small group within 30 days. Introduce them to 3\u20135 members who share something in common. Ensure the whole household is connected.' },
            { t: 'Stage 3 \u2014 60 Days: Serving',       d: 'Conversation: where are your gifts? What have you loved doing? Make a specific invitation to a serving team \u2014 not a generic ask.' },
            { t: 'Stage 4 \u2014 90-Day Assessment',      d: 'In a small group? At least one meaningful friendship? Connected to a serving area? If yes: close and celebrate. If no: identify the barrier and address it specifically.' },
            { t: 'Stage 5 \u2014 Transfer to Shepherding', d: 'When integrated: close this case, open a Shepherding case. Note their small group, serving role, and key relationships as their pastoral profile.' }
          ],
          notes: 'NEW MEMBER INTEGRATION\n' + _L + '\nName(s):\n\nJoining Date:\n\nBackground (prior church, transfer, returning):\n\nFamily / Household Members:\n\n\n' + _L + '\nWelcome Elder / Deacon Assigned:\nSmall Group Connected:  YES / NO  \u25ba Date:\nServing Team Connected:  YES / NO  \u25ba Team:\n90-Day Assessment Date:\nNotes:',
          watchFor: [
            'Quiet disappearance: member stops attending, no one notices for weeks',
            'Surface connection only: attending but never belonging \u2014 no small group, no friendships',
            'Spouse or family left out of the integration process',
            'Integration treated as a checklist rather than genuine relational investment'
          ],
          closureChecklist: [
            'Connected to a small group',
            'At least one meaningful friendship formed in the congregation',
            '90-day assessment completed',
            'Serving conversation initiated',
            'Shepherding case opened for ongoing care',
            'Final pastoral note'
          ]
        },
        'Pornography / Sexual Addiction': {
          icon: '\uD83D\uDD12', color: '#d4853a', priority: 'High',
          stages: [
            { t: 'Stage 1 \u2014 Disclosure',             d: 'Receive without shock or lecture. Same-sex pastor or elder responds. Say: \u201cThank you. This took courage. You are not alone.\u201d Establish strict confidentiality immediately.' },
            { t: 'Stage 2 \u2014 Assessment',             d: 'Duration, frequency, triggers, escalation pattern, spouse awareness, professional help in place, devices/subscriptions to address. If married: do not advise spouse disclosure \u2014 refer to a licensed therapist trained in sexual addiction to guide that step.' },
            { t: 'Stage 3 \u2014 Accountability Structure', d: 'Assign same-sex accountability partner. Install accountability software (Covenant Eyes \u2014 covenanteyes.com). Weekly check-ins with specific questions: How many times? When? What was happening before?' },
            { t: 'Stage 4 \u2014 Professional Referral',  d: 'CSAT (findacsat.com), Pure Desire Ministries, Celebrate Recovery, Every Man\u2019s Battle. If married: refer spouse to a betrayal trauma therapist. Walk alongside \u2014 do not attempt to provide the therapy.' },
            { t: 'Stage 5 \u2014 Recovery & Relapse',     d: 'Contact within 24 hours of a relapse. Lead with grace, not shame. Reassess accountability structure. Celebrate: 30d, 90d, 6mo, 1yr. Address root causes over time.' },
            { t: 'Stage 6 \u2014 Long-Term Freedom',      d: '12- and 24-month formal reviews. In time: invite them to give back as an accountability partner. When closing: convert to Shepherding \u2014 do not fully separate.' }
          ],
          notes: 'SEXUAL ADDICTION INTAKE (CONFIDENTIAL \u2014 DO NOT DISCLOSE)\n' + _L + '\nDuration / History:\n\nPattern / Frequency:\n\nEscalation (has it changed over time):  YES / NO\n\nSpouse / Family Aware:  YES / NO\nProfessional Help in Place:  YES / NO\n\n\n' + _L + '\nAccountability Partner Assigned:\nAccountability Software Installed:  YES / NO\nReferral Made:\nMarriage Case Opened:  YES / NO\nNext Check-In:',
          watchFor: [
            'Relapse patterns: same triggers and cycles as substance addiction',
            'Accountability software disabled or bypassed',
            'Spouse betrayal trauma symptoms: hypervigilance, trust collapse, emotional flooding',
            'Escalation in behavior pattern over time',
            'Isolation from accountability partner or community'
          ],
          closureChecklist: [
            'Accountability partner active and consistent',
            'Accountability software installed and reporting',
            'Professional referral made (CSAT or equivalent)',
            'If married: spouse connected to betrayal trauma therapist',
            '12-month and 24-month formal reviews completed',
            'Transition to Shepherding (do not fully close)',
            'Final pastoral note'
          ]
        },
        'Mental Health': {
          icon: '\uD83E\uDDE0', color: '#7eaacc', priority: 'Normal',
          stages: [
            { t: 'Stage 1 \u2014 Safe Disclosure',        d: 'Respond immediately. Lead with: \u201cThank you for telling me. You are not alone.\u201d Assess safety first: any risk of self-harm? If yes \u2192 Crisis workflow immediately. Establish confidentiality explicitly.' },
            { t: 'Stage 2 \u2014 Understanding Situation', d: 'What is the condition? How long? In treatment (therapy, psychiatry, medication)? What does a hard day cost them? What role does their faith play? Do not attempt to diagnose.' },
            { t: 'Stage 3 \u2014 Pastoral Care Plan',     d: 'Assign a caregiver with emotional stability and clear boundaries. Weekly check-in texts often preferred over formal visits. If not in professional care: encourage and provide a specific referral.' },
            { t: 'Stage 4 \u2014 Long-Term Presence',     d: 'Do not disappear during stable seasons \u2014 steady contact prevents drift and shame re-entry. Watch for: stopping medication, increased isolation, sudden calm after despair (safety risk).' },
            { t: 'Stage 5 \u2014 Crisis Response',        d: 'Suicidal ideation or intent: do not leave them alone. Call 988 together if needed. Activate Crisis workflow. Keep Mental Health case open for the ongoing journey.' },
            { t: 'Stage 6 \u2014 Long-Term Review',       d: 'Formal review at 6 and 12 months. Some cases remain open indefinitely \u2014 this is faithful shepherding, not failure. When thriving: close \u2192 convert to Shepherding.' }
          ],
          notes: 'MENTAL HEALTH INTAKE (CONFIDENTIAL)\n' + _L + '\nPresenting Condition (as member describes it):\n\nDuration:\n\nCurrently in Professional Treatment:  YES / NO\nTherapist / Psychiatrist:\n\nMedication in Place:  YES / NO\n\n\n' + _L + '\nSafety Concern:  YES / NO  \u2014 If YES: Crisis workflow activated\nCaregiver Assigned:\nContact Cadence:\nReferral Made:\nNext Contact:',
          watchFor: [
            'Medication non-compliance without professional guidance',
            'Increased isolation \u2014 especially during stable seasons when check-ins may decrease',
            'Sudden calm after prolonged distress (may indicate a decision to act on suicidal ideation \u2014 activate Crisis immediately)',
            'Caregiver compassion fatigue: mental health accompaniment is emotionally heavy long-term work',
            'Faith crisis: member questioning God\u2019s goodness because of their condition',
            'Family burnout: spouses, parents, or children carrying the weight silently'
          ],
          closureChecklist: [
            'Member stable and in ongoing professional care (or professionally discharged)',
            '6-month and 12-month formal reviews completed',
            'No active safety concerns',
            'Community connection verified (small group, friendships)',
            'Transitioned to Shepherding for ongoing oversight',
            'Final pastoral note'
          ]
        },
        'Gender Identity / Sexuality': {
          icon: '\u271D', color: '#7eaacc', priority: 'Normal',
          stages: [
            { t: 'Stage 1 \u2014 Safe Disclosure',        d: 'Receive with calm, unhurried presence. Listen fully before responding. Same-sex pastor or elder responds whenever possible. Do not minimize, diagnose, or prescribe at first. Establish confidentiality explicitly.' },
            { t: 'Stage 2 \u2014 Understanding Their World', d: 'What is the nature of the struggle? Same-sex attraction, gender confusion, or distress about their body? What do they believe theologically? What are they asking for from the church right now?' },
            { t: 'Stage 3 \u2014 Pastoral Care Plan',     d: 'Assign same-sex, spiritually mature caregiver. Regular meetings (monthly minimum). Affirm: their place in this community is not conditional on their struggle. Refer to AACC-network counselor within biblical framework.' },
            { t: 'Stage 4 \u2014 Community & Belonging',  d: 'Isolation is the enemy. Ensure genuine community: small group, friendships, belonging. For celibate path: the church must be a community where single men and women flourish. If married: spouse needs their own pastoral care.' },
            { t: 'Stage 5 \u2014 Long-Term Accompaniment', d: 'This is rarely a short journey. Celebrate faithfulness. If a member steps away from biblical teaching: maintain relationship and hold truth in love. Formal review every 6 months.' }
          ],
          notes: 'GENDER IDENTITY / SEXUALITY INTAKE (CONFIDENTIAL)\n' + _L + '\nNature of Struggle (as member describes it):\n\nTheological Stance (member\u2019s understanding):\n\nWhat They Are Seeking from the Church:\n\nFamily / Spouse Aware:  YES / NO\n\n\n' + _L + '\nCaregiver Assigned (same sex):\nProfessional Referral Made:  YES / NO\nCommunity Connection Plan:\nNext Meeting:',
          watchFor: [
            'Isolation: the member pulling away from community out of shame or fear of exposure',
            'Spiritual crisis: questioning God\u2019s design, fairness, or love',
            'Online influence: theology and community from internet sources contradicting the church\u2019s framework',
            'Spouse distress: if married, the spouse may be processing their own grief, fear, or confusion \u2014 open a separate case',
            'Caregiver discomfort: the assigned caregiver\u2019s own theology or discomfort affecting the quality of care'
          ],
          closureChecklist: [
            'Member connected to ongoing community (small group, friendships)',
            'Professional counselor referral made if desired',
            'If celibacy path chosen: community support structure verified',
            'If married: spouse care addressed',
            '6-month formal reviews completed',
            'Transitioned to Shepherding for ongoing accompaniment',
            'Final pastoral note'
          ]
        }
      };

      var _PRIORITY_LEVEL = { Urgent: 3, High: 2, Normal: 1, Low: 0 };

      function _renderCarePanel(type) {
        if (!panel) return;
        var cfg = _careCFG[type];
        if (!cfg) { panel.innerHTML = ''; return; }
        var stageHtml = cfg.stages.map(function(s) {
          return '<div style="padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:6px;border-left:3px solid ' + cfg.color + ';">' +
            '<strong style="font-size:0.82rem;">' + s.t + '</strong>' +
            '<div style="font-size:0.80rem;color:var(--ink-muted);margin-top:3px;">' + s.d + '</div>' +
            '</div>';
        }).join('');
        var footerHtml = cfg.footer
          ? '<div style="margin-top:4px;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:6px;font-size:0.80rem;color:var(--ink-muted);"><strong style="color:var(--ink);">Note:</strong> ' + cfg.footer + '</div>'
          : '';
        var watchHtml = '';
        if (cfg.watchFor && cfg.watchFor.length) {
          watchHtml = '<details style="margin-top:8px;border:1px solid #d4853a;border-radius:8px;overflow:hidden;">' +
            '<summary style="padding:10px 14px;background:rgba(212,133,58,0.08);cursor:pointer;font-weight:700;font-size:0.82rem;color:#d4853a;user-select:none;">\u26A0 Watch For</summary>' +
            '<div style="padding:12px 16px;display:grid;gap:6px;">' +
            cfg.watchFor.map(function(w) {
              return '<div style="padding:8px 10px;background:rgba(212,133,58,0.06);border-radius:6px;border-left:3px solid #d4853a;font-size:0.80rem;color:var(--ink-muted);">' + w + '</div>';
            }).join('') +
            '</div></details>';
        }
        panel.innerHTML =
          '<details class="fp-section" open style="margin-bottom:16px;border:1px solid ' + cfg.color + ';border-radius:8px;overflow:hidden;">' +
          '<summary style="padding:12px 16px;background:rgba(255,255,255,0.04);cursor:pointer;font-weight:700;font-size:0.82rem;color:' + cfg.color + ';user-select:none;">' + cfg.icon + ' ' + type + ' \u2014 Workflow Guide</summary>' +
          '<div style="padding:16px;display:grid;gap:8px;">' + stageHtml + footerHtml + '</div></details>' +
          watchHtml;
      }

      var _REVIEW_DAYS = { Urgent: 7, High: 14, Normal: 30, Low: 90 };

      function _calcNextReview(priority) {
        var days = _REVIEW_DAYS[priority] || 30;
        var d = new Date(); d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
      }

      function _applyCareType(type) {
        _renderCarePanel(type);
        var cfg = _careCFG[type];
        if (!cfg) return;
        // Auto-elevate priority on new cases if the care type default is higher
        if (priSel && _isNew) {
          var curLevel = _PRIORITY_LEVEL[priSel.value] !== undefined ? _PRIORITY_LEVEL[priSel.value] : 1;
          var cfgLevel = _PRIORITY_LEVEL[cfg.priority] !== undefined ? _PRIORITY_LEVEL[cfg.priority] : 1;
          if (cfgLevel > curLevel) {
            priSel.value = cfg.priority;
            _setNextReview(cfg.priority);
          }
        }
        // Inject notes template for new empty cases
        if (_isNew && notesTa && !notesTa.value.trim() && cfg.notes) {
          notesTa.value = cfg.notes;
        }
      }

      function _setNextReview(priority) {
        var nrIn = document.getElementById('fp-nextReviewDate');
        if (nrIn && _isNew && !nrIn._userEdited) nrIn.value = _calcNextReview(priority);
      }

      // Track manual edits to nextReviewDate so auto-calc doesn't overwrite
      var _nrIn = document.getElementById('fp-nextReviewDate');
      if (_nrIn) _nrIn.addEventListener('input', function() { this._userEdited = true; });

      // Auto-set next review when priority changes on new cases
      if (priSel) priSel.addEventListener('change', function() { _setNextReview(this.value); });

      if (ctSel) {
        ctSel.addEventListener('change', function() { _applyCareType(this.value); });
        _applyCareType(ctSel.value);
      }
      // Set initial next review date for new cases
      if (_isNew && priSel) _setNextReview(priSel.value);

      // ── Notes auto-save ──────────────────────────────────────────────────
      // For existing cases: debounce 1.5 s after last keystroke, then write
      // only the notes field.  No Save button required.
      if (notesTa && id && _canViewNotes()) {
        var _noteTimer = null;
        notesTa.addEventListener('input', function() {
          var st1 = document.getElementById('fp-save-status');
          var st2 = document.getElementById('fp-save-status2');
          function _stat(msg) { if (st1) st1.textContent = msg; if (st2) st2.textContent = msg; }
          _stat('Unsaved…');
          clearTimeout(_noteTimer);
          var _val = notesTa.value;
          _noteTimer = setTimeout(function() {
            _stat('Saving…');
            var savePromise = _isFB()
              ? UpperRoom.updateCareCase({ id: id, notes: _val })
              : TheVine.flock.care.update({ id: id, notes: _val });
            savePromise.then(function() {
              _stat('Notes saved ✓');
              _bustCareCache(id);
              // Keep "saved" visible briefly then clear
              setTimeout(function() { _stat(''); }, 2500);
            }).catch(function(e) {
              console.warn('[TheLife] notes auto-save failed:', e);
              _stat('Save failed');
            });
          }, 1500);
        });
      }
    })();
  }

  async function saveCareCase() {
    var btn = document.getElementById('fp-save-btn');
    var st1 = document.getElementById('fp-save-status');
    var st2 = document.getElementById('fp-save-status2');
    function _stat(msg) { if (st1) st1.textContent = msg; if (st2) st2.textContent = msg; }

    if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    _stat('');

    var data = _fpCollect('fp-body');
    // Remove readonly fields
    delete data.createdAt;
    delete data.updatedAt;
    // If a directory member is selected, clear the guest name so it doesn't pollute the record
    if (data.memberId) delete data.memberName;
    // Never overwrite Lead Pastor notes with blank on updates — notes field renders empty for non-LP users
    if (_fpCareId && !_canViewNotes()) delete data.notes;

    // Validate required fields
    if (!_requireField(data.careType || data['Care Type'], 'Care Type')) { if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Care Case'; } return; }
    if (!_requireField(data.memberId || data['Member ID'] || data.memberName || data['Member Name'], 'Member')) { if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Care Case'; } return; }

    try {
      if (_fpCareId) {
        data.id = _fpCareId;
        _stat('Updating case\u2026');
        await (_isFB() ? UpperRoom.updateCareCase(data) : TheVine.flock.care.update(data));
        _audit('care.update', 'SpiritualCareCases', _fpCareId, data.status || '');
        // Refresh the cache entry so the hub shows today's timestamp immediately
        _bustCareCache(_fpCareId);
      } else {
        _stat('Creating case\u2026');
        var res = await (_isFB() ? UpperRoom.createCareCase(data) : TheVine.flock.care.create(data));
        if (res && res.id) _fpCareId = res.id;
        _audit('care.create', 'SpiritualCareCases', _fpCareId || '', data.careType || '');
      }
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Care Case'; }
      _toast('Care case saved!', 'success');
      _stat('Saved \u2713');
      // If status is now terminal, go back to hub (item will be filtered);
      // otherwise reload to show fresh data.
      if (_fpCareId) {
        var _ns = (data.status || '').toLowerCase();
        if (_TERMINAL_STATUSES.indexOf(_ns) !== -1 && !_canViewNotes()) { backToHub(); }
        else { openCareCase(_fpCareId); }
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Care Case'; }
      _stat('');
      alert('Save failed: ' + (err.message || 'Unknown error'));
    }
  }

  // ── Closure Validation Modal ──────────────────────────────────────────
  function _showClosureModal(careType) {
    return new Promise(function(resolve) {
      var cfg = (_careCFG && _careCFG[careType]) ? _careCFG[careType] : null;
      var checklist = (cfg && cfg.closureChecklist) ? cfg.closureChecklist : [];
      // If no checklist, fall back to simple confirm
      if (!checklist.length) { resolve(confirm('Resolve this care case?')); return; }

      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--surface,#1e1e2e);color:var(--ink,#cdd6f4);border-radius:12px;padding:24px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.4);';

      var title = (cfg ? cfg.icon + ' ' : '') + careType + ' — Closure Validation';
      var html = '<h3 style="margin:0 0 16px;font-size:1rem;">' + title + '</h3>';
      html += '<div style="font-size:0.82rem;color:var(--ink-muted,#a6adc8);margin-bottom:12px;">Confirm each item before resolving:</div>';

      checklist.forEach(function(item, i) {
        var id = 'fp-closure-chk-' + i;
        html += '<label style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;font-size:0.84rem;cursor:pointer;">' +
          '<input type="checkbox" id="' + id + '" class="fp-closure-chk" style="margin-top:2px;flex-shrink:0;">' +
          '<span>' + item + '</span></label>';
      });

      html += '<div style="margin-top:16px;">' +
        '<label style="font-size:0.82rem;font-weight:600;">Final Pastoral Note</label>' +
        '<textarea id="fp-closure-note" rows="3" style="width:100%;margin-top:4px;padding:8px;border-radius:6px;border:1px solid var(--border,#45475a);background:var(--surface-alt,#181825);color:var(--ink,#cdd6f4);font-size:0.84rem;resize:vertical;" placeholder="Enter a final note for this case..."></textarea>' +
        '</div>';

      html += '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">' +
        '<button id="fp-closure-cancel" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border,#45475a);background:transparent;color:var(--ink,#cdd6f4);cursor:pointer;">Cancel</button>' +
        '<button id="fp-closure-confirm" disabled style="padding:8px 16px;border-radius:6px;border:none;background:#4caf8a;color:#fff;cursor:pointer;opacity:0.5;">Confirm Resolve</button>' +
        '</div>';

      box.innerHTML = html;
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      var confirmBtn = document.getElementById('fp-closure-confirm');
      var chks = box.querySelectorAll('.fp-closure-chk');
      var noteEl = document.getElementById('fp-closure-note');

      function updateBtn() {
        var allChecked = Array.prototype.every.call(chks, function(c) { return c.checked; });
        var hasNote = noteEl && noteEl.value.trim().length > 0;
        var ready = allChecked && hasNote;
        confirmBtn.disabled = !ready;
        confirmBtn.style.opacity = ready ? '1' : '0.5';
      }
      chks.forEach(function(c) { c.addEventListener('change', updateBtn); });
      if (noteEl) noteEl.addEventListener('input', updateBtn);

      document.getElementById('fp-closure-cancel').addEventListener('click', function() {
        document.body.removeChild(overlay);
        resolve(false);
      });
      confirmBtn.addEventListener('click', function() {
        var note = noteEl ? noteEl.value.trim() : '';
        document.body.removeChild(overlay);
        resolve(note || true);
      });
    });
  }

  async function resolveCareCase() {
    if (!_fpCareId) return;
    // Get care type from form or cached record
    var ctEl = document.getElementById('fp-careType');
    var careType = ctEl ? ctEl.value : '';
    if (!careType) {
      var caseRec = (_cache.care || []).find(function(c) { return c.id === _fpCareId; }) || {};
      careType = caseRec.careType || caseRec.type || '';
    }
    var closureResult = await _showClosureModal(careType);
    if (!closureResult) return;
    // Append closure note to the notes field if provided
    if (typeof closureResult === 'string') {
      var notesTa = document.getElementById('fp-notes');
      if (notesTa) {
        notesTa.value = (notesTa.value ? notesTa.value + '\n\n' : '') + '── CLOSURE NOTE ──\n' + closureResult;
      }
      // Save the updated notes before resolving
      await saveCareCase();
    }
    try {
      var result = await (_isFB() ? UpperRoom.resolveCareCase(_fpCareId) : TheVine.flock.care.resolve({ id: _fpCareId }));
      // Verify the server actually confirmed the resolve
      if (!result || !result.ok) {
        throw new Error(
          (result && result.error) || 'Server did not confirm resolution. Response: ' + JSON.stringify(result)
        );
      }
      if (result.row && result.row.status && result.row.status.toLowerCase() !== 'resolved') {
        throw new Error('Server returned status "' + result.row.status + '" instead of Resolved.');
      }
      _audit('care.resolve', 'SpiritualCareCases', _fpCareId, 'Resolved');
      _toast('Case resolved!', 'success');
      // Invalidate ALL cached care data keys
      if (typeof TheVine !== 'undefined' && TheVine.cache) {
        ['life:care','life:followUps','tab:care','tab:prayer','tab:compassion','tab:outreach'].forEach(function(k) {
          TheVine.cache.invalidate(k);
        });
      }
      delete _cache.care;
      backToHub();
    } catch (e) {
      console.error('[TheLife] care.resolve FAILED:', e);
      alert('Failed to resolve: ' + (e.message || e));
    }
  }

  // ── Create Linked Case ──────────────────────────────────────────────────
  function createLinkedCase(parentCaseId, memberId) {
    // Open a new care case pre-filled with the same member and a back-link
    _fpCareId = null;
    openCareCase(null, { memberId: memberId, linkedCaseId: parentCaseId });
  }

  // ── Send Email or Text from Care Case ──────────────────────────────────
  async function sendCareReach(mode) {
    var msgEl = document.getElementById('fp-care-reach-msg');
    var msg = (msgEl ? msgEl.value : '').trim();
    if (!msg) { alert('Please write a message before sending.'); return; }

    var method = (document.querySelector('input[name="fp-care-reach-method"]:checked') || {}).value;
    if (!method) { alert('Please select a contact method.'); return; }

    // Resolve member contact info from the current care case
    var caseRec = (_cache.care || []).find(function(c) { return c.id === _fpCareId; }) || {};
    var memberId = caseRec.memberId || '';
    if (!memberId) {
      // Fallback: read from the form field
      var memField = document.getElementById('fp-memberId');
      memberId = memField ? memField.value : '';
    }
    var memRec = _lookupMember(memberId);
    var email = memRec.primaryEmail || memRec.email || '';
    var phone = memRec.cellPhone || memRec.phone || memRec.homePhone || '';
    var mName = ((memRec.preferredName || memRec.firstName || '') + ' ' + (memRec.lastName || '')).trim() || memberId;

    if (method === 'email') {
      if (!email) { alert('No email address on file for ' + mName + '.'); return; }
      var subject = 'Checking In \u2014 ' + (caseRec.careType || 'Care');
      window.location.href = 'mailto:' + encodeURIComponent(email)
        + '?subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(msg);
      _toast('\u2709 Email composed!', 'success');
    } else if (method === 'sms') {
      if (!phone) { alert('No phone number on file for ' + mName + '.'); return; }
      var cleanPhone = phone.replace(/[^\d+]/g, '');
      // Try Twilio backend first, fall back to native SMS
      var cfgRows = _cache.config || [];
      var twCfg = cfgRows.find(function(r) { return (r.key || r.configKey) === 'TWILIO_ENABLED'; });
      var twOn = twCfg && String(twCfg.value).toUpperCase() === 'TRUE';
      if (twOn && typeof TheVine !== 'undefined' && TheVine.flock && TheVine.flock.sms) {
        try {
          await TheVine.flock.sms.send({ phone: cleanPhone, message: msg });
          _toast('\uD83D\uDCF1 Text sent to ' + mName + '!', 'success');
        } catch (smsErr) {
          alert('SMS send failed: ' + (smsErr.message || smsErr));
          return;
        }
      } else {
        window.open('sms:' + encodeURIComponent(cleanPhone) + '?body=' + encodeURIComponent(msg));
        _toast('\uD83D\uDCF1 Text composed!', 'success');
      }
    }

    _audit('care.reach', 'SpiritualCareCases', _fpCareId, method + ' to ' + mName);

    // Always bump open care cases for this member — fire-and-forget.
    // Every outreach from the app counts as care given, keeping "last updated" current.
    if (memberId && _isFB() && typeof UpperRoom !== 'undefined' && UpperRoom.createTouch) {
      UpperRoom.createTouch({
        memberId:   memberId,
        memberName: mName,
        channel:    method === 'email' ? 'email' : 'text',
        note:       msg.substring(0, 200),
      }).catch(function(e) { console.warn('[TheLife] care touch failed:', e); });
    }

    // Optionally log as care interaction
    if (mode === 'log' && _fpCareId) {
      try {
        await (_isFB() ? UpperRoom.createCareInteraction({
          caseId: _fpCareId,
          interactionType: method === 'email' ? 'Email' : 'Text',
          notes: msg,
        }) : TheVine.flock.care.interactions.create({
          caseId: _fpCareId,
          interactionType: method === 'email' ? 'Email' : 'Text',
          notes: msg,
        }));
        _audit('care.interaction', 'SpiritualCareInteractions', _fpCareId, method + ' outreach logged');
        _toast('Interaction logged!', 'success');
        openCareCase(_fpCareId);  // Refresh to show new interaction
      } catch (logErr) {
        console.warn('[TheLife] Failed to log interaction:', logErr);
      }
    }

    // Clear the compose box
    if (msgEl) msgEl.value = '';
  }

  async function addCareInteraction(caseId) {
    // Small inline modal for interaction logging
    _miniModal('Log Care Interaction', [
      { name: 'interactionType', label: 'Type', type: 'select',
        options: ['Phone Call','Visit','Email','Text','Meeting','Prayer','Other'] },
      { name: 'notes', label: 'Notes', type: 'textarea', required: true },
      { name: 'followUpDate', label: 'Follow-Up Date', type: 'date' },
    ], async function(data) {
      data.caseId = caseId;
      await (_isFB() ? UpperRoom.createCareInteraction(data) : TheVine.flock.care.interactions.create(data));
      _audit('care.interaction', 'SpiritualCareInteractions', caseId, data.interactionType || '');
      _toast('Interaction logged!', 'success');
      openCareCase(caseId);
    });
  }

  async function scheduleCareFollowUp(caseId) {
    _miniModal('Schedule Follow-Up', [
      { name: 'followUpDate', label: 'Follow-Up Date', type: 'date', required: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ], async function(data) {
      data.caseId = caseId;
      data.interactionType = 'Follow-Up Scheduled';
      data.followUpNeeded = true;
      await (_isFB() ? UpperRoom.createCareInteraction(data) : TheVine.flock.care.interactions.create(data));
      _toast('Follow-up scheduled!', 'success');
      openCareCase(caseId);
    });
  }

  function viewMemberFromCase(memberId) {
    if (typeof Modules !== 'undefined' && Modules._ppOpen) {
      Modules._ppOpen(memberId);
    }
  }

  // ── Load all spiritual care cases for a specific member (Lead Pastor use) ───
  // Called from _ppOpen in the_tabernacle.js to populate the Spiritual Care History
  // section in the person's file.  Shows every case ever linked to this member —
  // no time-window filter — sorted most-recent first.
  async function loadMemberCareHistory(memberId, altId, container) {
    if (!container) return;
    try {
      var all;
      if (_cache.care && _cache.care.length) {
        all = _cache.care;
      } else {
        var res = await (_isFB() ? UpperRoom.listCareCases({}) : TheVine.flock.care.list({}));
        all = _rows(res);
        _cache.care = all;
      }
      // Collect all known identifiers for this person
      var ids = [memberId, altId].filter(Boolean).map(function(x) { return String(x).toLowerCase(); });
      var matches = all.filter(function(c) {
        var mid = String(c.memberId || '').toLowerCase();
        return ids.indexOf(mid) !== -1;
      });
      matches.sort(function(a, b) {
        return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
      });
      if (!matches.length) {
        container.innerHTML = '<p style="color:var(--ink-muted);font-size:0.84rem;">No spiritual care cases on record for this member.</p>';
        return;
      }
      var h = '<table style="width:100%;font-size:0.78rem;border-collapse:collapse;">';
      h += '<tr style="border-bottom:1px solid var(--line);">'
         + '<th style="text-align:left;padding:6px 8px;">Date</th>'
         + '<th style="text-align:left;padding:6px 8px;">Type</th>'
         + '<th style="text-align:left;padding:6px 8px;">Status</th>'
         + '<th style="text-align:left;padding:6px 8px;">Summary</th>'
         + '<th style="padding:6px 8px;"></th></tr>';
      matches.forEach(function(c) {
        var date = _e((c.updatedAt || c.createdAt || '').substring(0, 10));
        var type = _e(c.careType || c.type || 'General');
        var status = _e(c.status || '');
        var summary = c.summary || '';
        if (summary.length > 90) summary = summary.substring(0, 90) + '\u2026';
        summary = _e(summary);
        var cid = _e(String(c.id || ''));
        h += '<tr style="border-top:1px solid var(--line);">';
        h += '<td style="padding:4px 8px;white-space:nowrap;color:var(--ink-muted);">' + date + '</td>';
        h += '<td style="padding:4px 8px;">' + type + '</td>';
        h += '<td style="padding:4px 8px;">' + status + '</td>';
        h += '<td style="padding:4px 8px;">' + summary + '</td>';
        if (cid) {
          h += '<td style="padding:4px 8px;"><button type="button" onclick="TheLife.openCareCase(\'' + cid + '\')"'
             + ' style="background:none;border:1px solid var(--line);border-radius:4px;padding:2px 8px;'
             + 'cursor:pointer;font-size:0.72rem;color:var(--ink);font-family:inherit;">View</button></td>';
        } else {
          h += '<td></td>';
        }
        h += '</tr>';
      });
      h += '</table>';
      container.innerHTML = h;
    } catch(err) {
      container.innerHTML = '<p style="color:var(--ink-muted);font-size:0.82rem;">Unable to load care history.</p>';
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // FULL-PAGE: PRAYER REQUEST EDITOR
  // ══════════════════════════════════════════════════════════════════════════

  var _fpPrayerId = '';

  async function openPrayer(id, sourceView) {
    _fpEditorSource = sourceView || 'my-flock';
    var el = _hubEl();
    if (!el) return;
    _fpPrayerId = id || '';
    // Audit: record who viewed this prayer request and when
    if (id) { _audit('prayer.view', 'PrayerRequests', id, 'viewed'); }

    el.innerHTML = '<div class="fp-editor">'
      + '<div class="fp-topbar">'
      + '<button class="fp-back" onclick="TheLife.backToHub()">\u2190 My Flock</button>'
      + '<h2 class="fp-title">Prayer Request</h2>'
      + '</div>'
      + '<div id="fp-body">' + _spinner() + '</div></div>';
    var _m = document.getElementById('main'); if (_m) _m.scrollTop = 0;

    // Parallel: fire _ensureDir, fetch prayer record, fetch interactions
    var _dirP = _ensureDir();
    var _prayerP = null;
    var _ixP = null;
    var rec = {};
    if (id) {
      var _adminCache = (typeof Modules !== 'undefined' && Modules._dataCache) ? (Modules._dataCache['prayer-admin'] || []) : [];
      rec = (_cache.allPrayer || []).find(function(r) { return (r.id || r.ID) === id; })
         || _adminCache.find(function(r) { return (r.id || r.ID) === id; })
         || {};
      if (!rec.id && !rec.ID) {
        _prayerP = _isFB()
          ? UpperRoom.getPrayer(id).catch(function() { return null; })
          : TheVine.flock.prayer.get({ id: id }).catch(function() { return null; });
      }
      if (_isFB()) {
        _ixP = UpperRoom.listPrayerInteractions(id).catch(function() { return []; });
      }
    }
    var dir = await _dirP;
    var mOpts = _staffOpts(dir);
    if (_prayerP) {
      var pRes = await _prayerP;
      if (pRes && !pRes.error) rec = pRes;
    }
    var interactions = _ixP ? (await _ixP) : [];

    // Normalize field names
    var name     = rec.submitterName || rec['Submitter Name'] || 'Anonymous';
    var email    = rec.submitterEmail || rec['Submitter Email'] || '';
    var phone    = rec.submitterPhone || rec['Submitter Phone'] || '';
    var prayer   = rec.prayerText || rec['Prayer Text'] || '';
    var cat      = rec.category || rec['Category'] || '';
    var isConf   = String(rec.isConfidential || rec['Is Confidential'] || '').toUpperCase() === 'TRUE';
    var isFU     = String(rec.followUpRequested || rec['Follow-Up Requested'] || '').toUpperCase() === 'TRUE';
    var status   = rec.status || rec['Status'] || 'New';
    var assigned = rec.assignedTo || rec['Assigned To'] || '';
    var notes    = rec.adminNotes || rec['Admin Notes'] || '';
    var date     = rec.submittedAt || rec['Submitted At'] || '';
    var prayerCount = rec.prayerCount || 0;

    var html = '';

    // Save bar
    html += '<div class="fp-save-bar">'
      + '<button id="fp-save-btn" type="button" onclick="TheLife.savePrayer()" class="fp-save-btn">\uD83D\uDCBE Save Changes</button>'
      + '<span id="fp-save-status" class="fp-save-status"></span>'
      + '</div>';

    // ── Section: Prayer Request (read-only display) ──
    var prSec = '';
    prSec += '<div class="fp-request-card">';
    prSec += '<div class="fp-request-header">';
    prSec += '<div class="fp-request-name">' + _e(name) + '</div>';
    prSec += '<div class="fp-request-meta">';
    if (date) prSec += '<span>' + _fmtDate(date) + '</span>';
    if (cat) prSec += _badge(cat, 'info');
    if (isConf) prSec += '<span class="badge badge-warn">\uD83D\uDD12 Confidential</span>';
    if (isFU) prSec += '<span class="badge badge-danger">Follow-up Requested</span>';
    prSec += '</div></div>';
    prSec += '<div class="fp-request-text">' + _e(prayer) + '</div>';
    prSec += '<div class="fp-request-contact">';
    if (email) prSec += '<span>\u2709 ' + _e(email) + '</span>';
    if (phone) prSec += '<span>\uD83D\uDCDE ' + _e(phone) + _phoneActions(phone) + '</span>';
    prSec += '</div>';
    prSec += '</div>';
    html += _fpSec('Prayer Request', 'prayer-request', prSec);

    // ── Section: Pastoral Response ──
    var rpSec = '';
    rpSec += _fp2(
      _fpField('Status', 'status', status, 'select', ['New','Praying','In Progress','Answered','Closed']),
      _fpField('Assigned To', 'assignedTo', assigned, 'select', mOpts));
    rpSec += _fpField('Admin Notes', 'adminNotes', notes, 'textarea');
    html += _fpSec('Pastoral Response', 'prayer-response', rpSec);

    // ── Section: Interaction Timeline ──
    if (id) {
      var tlSec = '';
      tlSec += '<div style="margin-bottom:12px;display:flex;gap:10px;flex-wrap:wrap;">'
        + '<button type="button" onclick="TheLife.addPrayerInteraction(\'' + _e(id) + '\')" class="fp-action-btn">+ Log Prayer / Interaction</button>'
        + '</div>';
      if (interactions.length) {
        tlSec += '<div class="fp-timeline">';
        interactions.forEach(function(ix) {
          var ixIcon = { 'Prayed': '\uD83D\uDE4F', 'Called': '\uD83D\uDCDE', 'Emailed': '\u2709\uFE0F', 'Texted': '\uD83D\uDCAC', 'Visited': '\uD83D\uDEAA', 'Counseled': '\uD83E\uDDD1\u200D\uD83D\uDCAC', 'Note': '\uD83D\uDCDD', 'Follow-Up': '\uD83D\uDCC5' }[ix.interactionType || ix.type] || '\uD83D\uDCDD';
          tlSec += '<div class="fp-timeline-item">'
            + '<div class="fp-timeline-dot"></div>'
            + '<div class="fp-timeline-content">'
            + '<div class="fp-timeline-head">'
            + '<span class="fp-timeline-type">' + ixIcon + ' ' + _e(ix.interactionType || ix.type || 'Note') + '</span>'
            + '<span class="fp-timeline-date">' + _e(_fmtDate(ix.date || ix.createdAt)) + '</span>'
            + (ix.createdBy ? '<span style="font-size:0.72rem;color:var(--ink-faint);margin-left:6px;">by ' + _e(ix.createdBy) + '</span>' : '')
            + '</div>'
            + (ix.notes ? '<div class="fp-timeline-body">' + _e(ix.notes) + '</div>' : '')
            + (ix.followUpDate ? '<div class="fp-timeline-fu">\uD83D\uDCC5 Follow-up: ' + _e(ix.followUpDate) + '</div>' : '')
            + '</div></div>';
        });
        tlSec += '</div>';
      } else {
        tlSec += '<div class="flock-empty"><div class="flock-empty-icon">\uD83D\uDE4F</div>No interactions logged yet. Log the first time you prayed over this request.</div>';
      }
      html += _fpSec('Prayer Log', 'prayer-timeline', tlSec);
    }

    // ── Section: Quick Actions ──
    if (id) {
      var actSec = '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
      actSec += '<button type="button" onclick="TheLife.addPrayerInteraction(\'' + _e(id) + '\',\'Prayed\')" class="fp-action-btn">\uD83D\uDE4F I Prayed For This</button>';
      actSec += '<button type="button" onclick="TheLife.addPrayerInteraction(\'' + _e(id) + '\',\'Follow-Up\')" class="fp-action-btn">\uD83D\uDCC5 Schedule Follow-Up</button>';
      actSec += '<button type="button" onclick="TheLife.convertPrayerToCare()" class="fp-action-btn">\uD83E\uDEA6 Convert to Care Case</button>';
      actSec += '</div>';
      html += _fpSec('Quick Actions', 'prayer-actions', actSec);
    }

    // ── Section: Reply / Contact ──
    var reSec = '';
    reSec += '<div style="margin-bottom:12px;">'
      + '<label style="font-size:0.78rem;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:6px;">Compose Reply</label>'
      + '<textarea id="fp-prayer-reply" rows="4" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid var(--line);background:rgba(255,255,255,0.07);color:var(--ink);font-size:0.88rem;resize:vertical;font-family:inherit;" placeholder="Write your response to this prayer request\u2026"></textarea>'
      + '</div>';
    reSec += '<div style="margin-bottom:14px;">'
      + '<label style="font-size:0.78rem;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:8px;">Send via</label>'
      + '<div style="display:flex;gap:16px;">'
      + '<label style="font-size:0.85rem;color:var(--ink);display:flex;align-items:center;gap:6px;cursor:pointer;">'
      + '<input type="radio" name="fp-prayer-method" value="email" ' + (email ? 'checked' : '') + ' /> \u2709 Email' + (email ? ' (' + _e(email) + ')' : ' <span style="color:var(--ink-muted);font-size:0.78rem;">\u2014 no email</span>') + '</label>'
      + '<label style="font-size:0.85rem;color:var(--ink);display:flex;align-items:center;gap:6px;cursor:pointer;">'
      + '<input type="radio" name="fp-prayer-method" value="sms" ' + (!email && phone ? 'checked' : '') + ' /> \uD83D\uDCF1 Text' + (phone ? ' (' + _e(phone) + ')' : ' <span style="color:var(--ink-muted);font-size:0.78rem;">\u2014 no phone</span>') + '</label>'
      + '</div></div>';
    reSec += '<div style="display:flex;gap:10px;">'
      + '<button type="button" onclick="TheLife.sendPrayerReply()" class="fp-action-btn" style="background:var(--accent);color:var(--ink-inverse);border-color:var(--accent);font-weight:600;">\u2709 Send Reply</button>';
    if (phone) {
      reSec += '<button type="button" onclick="TheLife._callPhone(\'' + _e(phone) + '\')" class="fp-action-btn">\uD83D\uDCDE Call</button>';
      reSec += '<button type="button" onclick="TheLife._smsPhone(\'' + _e(phone) + '\')" class="fp-action-btn">\uD83D\uDCAC Quick Text</button>';
    }
    reSec += '</div>';
    html += _fpSec('Reply & Contact', 'prayer-reply', reSec);

    // Bottom save
    html += '<div class="fp-bottom-bar" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'
      + '<button type="button" onclick="TheLife.savePrayer()" class="fp-save-btn">\uD83D\uDCBE Save Changes</button>'
      + '<span id="fp-save-status2" class="fp-save-status"></span>'
      + '<button type="button" onclick="TheLife.convertPrayerToCare()" class="fp-action-btn" style="margin-left:auto;background:rgba(var(--accent-rgb,99,102,241),0.12);border-color:var(--accent);color:var(--accent);">\uD83E\uDEA6 Convert to Care Case</button>'
      + '</div>';

    (document.getElementById('fp-body') || {}).innerHTML = html;
  }

  async function addPrayerInteraction(prayerId, presetType) {
    var iTypes = ['Prayed', 'Called', 'Emailed', 'Texted', 'Visited', 'Counseled', 'Follow-Up', 'Note'];
    var typeOpts = iTypes.map(function(t) {
      return '<option value="' + _e(t) + '"' + (presetType === t ? ' selected' : '') + '>' + t + '</option>';
    }).join('');
    var today = new Date().toISOString().substring(0, 10);

    var overlay = document.createElement('div');
    overlay.id = 'fp-ix-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = '<div style="background:var(--surface,#fff);border-radius:12px;padding:24px;width:100%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,0.25);">'
      + '<h3 style="margin:0 0 16px;font-size:1rem;font-weight:700;color:var(--ink);">Log Prayer Interaction</h3>'
      + '<div style="margin-bottom:12px;">'
      + '<label style="font-size:0.78rem;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:6px;">Type</label>'
      + '<select id="fp-ix-type" style="width:100%;padding:9px 12px;border-radius:6px;border:1px solid var(--line);background:var(--surface-raised,var(--surface,#fff));color:var(--ink);font-size:0.9rem;">' + typeOpts + '</select>'
      + '</div>'
      + '<div style="margin-bottom:12px;">'
      + '<label style="font-size:0.78rem;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:6px;">Date</label>'
      + '<input type="date" id="fp-ix-date" value="' + today + '" style="width:100%;padding:9px 12px;border-radius:6px;border:1px solid var(--line);background:var(--surface-raised,var(--surface,#fff));color:var(--ink);font-size:0.9rem;" />'
      + '</div>'
      + '<div style="margin-bottom:12px;">'
      + '<label style="font-size:0.78rem;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:6px;">Notes</label>'
      + '<textarea id="fp-ix-notes" rows="3" placeholder="Notes about this interaction\u2026" style="width:100%;padding:9px 12px;border-radius:6px;border:1px solid var(--line);background:var(--surface-raised,var(--surface,#fff));color:var(--ink);font-size:0.88rem;font-family:inherit;resize:vertical;"></textarea>'
      + '</div>'
      + '<div style="margin-bottom:16px;">'
      + '<label style="font-size:0.78rem;font-weight:600;color:var(--ink-muted);display:block;margin-bottom:6px;">Follow-Up Date (optional)</label>'
      + '<input type="date" id="fp-ix-fu" style="width:100%;padding:9px 12px;border-radius:6px;border:1px solid var(--line);background:var(--surface-raised,var(--surface,#fff));color:var(--ink);font-size:0.9rem;" />'
      + '</div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button type="button" id="fp-ix-save" class="fp-action-btn" style="background:var(--accent);color:var(--ink-inverse);border-color:var(--accent);font-weight:600;flex:1;">\uD83D\uDCBE Save Interaction</button>'
      + '<button type="button" onclick="document.getElementById(\'fp-ix-overlay\').remove()" class="fp-action-btn">Cancel</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    document.getElementById('fp-ix-save').onclick = async function() {
      var btn = document.getElementById('fp-ix-save');
      btn.disabled = true; btn.textContent = 'Saving\u2026';
      var data = {
        interactionType: document.getElementById('fp-ix-type').value,
        date:            document.getElementById('fp-ix-date').value,
        notes:           document.getElementById('fp-ix-notes').value.trim(),
        followUpDate:    document.getElementById('fp-ix-fu').value || null
      };
      try {
        if (_isFB()) {
          await UpperRoom.addPrayerInteraction(prayerId, data);
        }
        overlay.remove();
        _toast('Interaction saved.');
        openPrayer(prayerId, _fpEditorSource);
      } catch (err) {
        btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Interaction';
        _toast('Error saving: ' + (err.message || err), 'error');
      }
    };
  }

  async function convertPrayerToCare() {
    if (!_fpPrayerId) return;
    var rec = (_cache.allPrayer || []).find(function(r) { return (r.id || r.ID) === _fpPrayerId; }) || {};
    var name    = rec.submitterName || rec['Submitter Name'] || '';
    var memberId = rec.memberId || rec['Member ID'] || '';
    var notes   = rec.prayerText || rec['Prayer Text'] || '';
    var email   = rec.submitterEmail || rec['Submitter Email'] || '';
    if (!confirm('Convert this prayer request into a Spiritual Care Case? This will open the New Care Case form with the details pre-filled.')) return;
    var defaults = {};
    if (memberId) defaults.memberId = memberId;
    if (name) defaults.memberName = name;
    if (email) defaults.memberEmail = email;
    if (notes) defaults.notes = 'Originated from prayer request: ' + notes;
    defaults.linkedPrayerRequestId = _fpPrayerId;
    TheLife.openCareCase('', defaults);
  }

  async function savePrayer() {
    var btn = document.getElementById('fp-save-btn');
    var st1 = document.getElementById('fp-save-status');
    var st2 = document.getElementById('fp-save-status2');
    function _stat(msg) { if (st1) st1.textContent = msg; if (st2) st2.textContent = msg; }

    if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    _stat('');

    var data = {};
    var secEl = document.getElementById('fp-sec-prayer-response');
    if (secEl) {
      secEl.querySelectorAll('[data-field]').forEach(function(el) {
        data[el.getAttribute('data-field')] = (el.value || '').trim();
      });
    }
    data.id = _fpPrayerId;
    var _prevPrayerRecord = (_cache.allPrayer || []).find(function(r) { return (r.id || r.ID) === _fpPrayerId; })
      || ((_flockData && _flockData.allPrayer) ? _flockData.allPrayer.find(function(r) { return (r.id || r.ID) === _fpPrayerId; }) : null)
      || {};
    var _prevStatus = (_prevPrayerRecord.status || _prevPrayerRecord['Status'] || '').toLowerCase();

    // Fill in prayer text from the cached record if not present in the form
    // (savePrayer only collects the response section fields, not the original text)
    if (!data.prayerText && !data['Prayer Text']) {
      var _cachedRec = (_cache.allPrayer || []).find(function(r) { return (r.id || r.ID) === _fpPrayerId; }) || {};
      data.prayerText = _cachedRec.prayerText || _cachedRec['Prayer Text'] || '';
    }

    try {
      _stat('Updating prayer\u2026');
      if (_isFB()) { await UpperRoom.updatePrayer(_fpPrayerId, data); }
      else {
        var payload = _mapPrayerDataForGAS(data);
        await TheVine.flock.prayer.update(payload);
      }
      _audit('prayer.update', 'PrayerRequests', _fpPrayerId, data.status || '');
      var _newStatus = (data.status || '').toLowerCase();
      if (_prevStatus !== _newStatus) {
        _audit('prayer.status', 'PrayerRequests', _fpPrayerId, (_prevStatus || 'unknown') + ' \u2192 ' + (_newStatus || 'unknown'));
        if (_PRAYER_STATUS_AUDIT_EVENTS.indexOf(_newStatus) !== -1) {
          _audit('prayer.status.' + _newStatus, 'PrayerRequests', _fpPrayerId, data.status || '');
        }
      }
      if (_cache.allPrayer && _cache.allPrayer.length) {
        _cache.allPrayer = _cache.allPrayer.map(function(r) {
          return (r.id || r.ID) === _fpPrayerId ? Object.assign({}, r, data) : r;
        });
      }
      if (_flockData && _flockData.allPrayer && _flockData.allPrayer.length) {
        _flockData.allPrayer = _flockData.allPrayer.map(function(r) {
          return (r.id || r.ID) === _fpPrayerId ? Object.assign({}, r, data) : r;
        });
      }
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Changes'; }
      _toast('Prayer request updated!', 'success');
      _stat('Saved \u2713');
      if (_TERMINAL_STATUSES.indexOf(_newStatus) !== -1 && !_isSeedAdmin()) {
        _removePrayerFromCaches(_fpPrayerId);
        backToHub();
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Changes'; }
      _stat('');
      alert('Save failed: ' + (err.message || 'Unknown error'));
    }
  }

  function sendPrayerReply() {
    var reply = (document.getElementById('fp-prayer-reply') || {}).value || '';
    if (!reply.trim()) { alert('Please write a reply before sending.'); return; }
    var method = (document.querySelector('input[name="fp-prayer-method"]:checked') || {}).value;

    // Get cached record info
    var rec = (_cache.allPrayer || []).find(function(r) { return (r.id || r.ID) === _fpPrayerId; }) || {};
    var email = rec.submitterEmail || rec['Submitter Email'] || '';
    var phone = rec.submitterPhone || rec['Submitter Phone'] || '';
    var subject = 'Re: Your Prayer Request';

    if (method === 'email' && email) {
      window.location.href = 'mailto:' + encodeURIComponent(email)
        + '?subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(reply.trim());
    } else if (method === 'sms' && phone) {
      var _cfgR = _cache.config || [];
      var _twR  = _cfgR.find(function(r) { return (r.key || r.configKey) === 'TWILIO_ENABLED'; });
      var _twOn = _twR && String(_twR.value).toUpperCase() === 'TRUE';
      if (_twOn) {
        TheVine.flock.sms.send({ phone: phone.replace(/[^\d+]/g, ''), message: reply.trim() })
          .then(function() { _toast('\uD83D\uDCF1 SMS sent!', 'success'); })
          .catch(function(e) { alert('SMS failed: ' + e.message); });
      } else {
        window.location.href = 'sms:' + encodeURIComponent(phone)
          + '?body=' + encodeURIComponent(reply.trim());
      }
    } else {
      alert('No ' + (method === 'email' ? 'email' : 'phone') + ' on file for this person.');
      return;
    }
    _toast('Reply sent!', 'success');
  }


  // ══════════════════════════════════════════════════════════════════════════
  // FULL-PAGE: COMPASSION REQUEST EDITOR
  // ══════════════════════════════════════════════════════════════════════════

  var _fpCompId = '';

  async function openCompassion(id) {
    var el = _hubEl();
    if (!el) return;
    _fpCompId = id || '';

    el.innerHTML = '<div class="fp-editor">'
      + '<div class="fp-topbar">'
      + '<button class="fp-back" onclick="TheLife.backToHub()">\u2190 My Flock</button>'
      + '<h2 class="fp-title">' + (id ? 'Edit Compassion Request' : 'New Compassion Request') + '</h2>'
      + '</div>'
      + '<div id="fp-body">' + _spinner() + '</div></div>';
    var _m = document.getElementById('main'); if (_m) _m.scrollTop = 0;

    // Parallel data fetch
    var _p = [_ensureDir()];
    if (id) {
      _p.push((_isFB() ? UpperRoom.getCompassionRequest(id) : TheVine.flock.compassion.requests.get({ id: id })).catch(function() { return null; }));
      _p.push((_isFB() ? UpperRoom.listCompassionLogs({ requestId: id }) : TheVine.flock.compassion.log.list({ requestId: id })).catch(function() { return []; }));
    }
    var _r = await Promise.all(_p);
    var dir = _r[0];
    var mOpts = _staffOpts(dir);

    var rec = {};
    if (id) {
      rec = (_r[1] && !_r[1].error) ? _r[1]
        : (_cache.allCompassion || []).find(function(c) { return c.id === id; }) || {};
    }
    var followUps = id ? _rows(_r[2] || []) : [];

    var html = '';

    // Save bar
    html += '<div class="fp-save-bar">'
      + '<button id="fp-save-btn" type="button" onclick="TheLife.saveCompassion()" class="fp-save-btn">\uD83D\uDCBE Save Request</button>'
      + '<span id="fp-save-status" class="fp-save-status"></span>'
      + '</div>';

    // ── Section: Request Details ──
    var detSec = '';
    detSec += _fp2(
      _fpField('Requestor Name', 'requesterName', rec.requesterName || rec.memberName || rec.name, 'text'),
      _fpField('Requestor Email', 'requesterEmail', rec.requesterEmail || rec.email, 'email'));
    detSec += _fp2(
      _fpField('Requestor Phone', 'requesterPhone', rec.requesterPhone || rec.phone, 'tel'),
      _fpField('Request Type', 'requestType', rec.requestType || rec.type, 'select',
        ['Food','Rent','Utilities','Medical','Transport','Clothing','Counseling','Other']));
    detSec += _fp2(
      _fpField('Amount Requested ($)', 'amount', rec.amount || rec.amountRequested, 'number'),
      _fpField('Status', 'status', rec.status || 'pending', 'select',
        ['pending','approved','denied','resolved']));
    detSec += _fp2(
      _fpField('Urgency', 'urgency', rec.urgency, 'select', ['','low','normal','high','critical']),
      _fpField('Assigned To', 'assignedTo', rec.assignedTo, 'select', mOpts));
    detSec += _fpField('Description', 'description', rec.description, 'textarea');
    detSec += _fpField('Resolution Notes', 'resolutionNotes', rec.resolutionNotes, 'textarea');
    if (id) {
      detSec += _fp2(
        _fpField('Created', 'createdAt', rec.createdAt, 'readonly'),
        _fpField('Last Updated', 'updatedAt', rec.updatedAt, 'readonly'));
    }
    html += _fpSec('Request Details', 'comp-details', detSec);

    // ── Section: Follow-Up History ──
    if (id) {
      var fuSec = '';
      fuSec += '<div style="margin-bottom:12px;">'
        + '<button type="button" onclick="TheLife.addCompassionFollowUp(\'' + _e(id) + '\')" class="fp-action-btn">+ Log Follow-Up</button>'
        + '</div>';
      if (followUps.length) {
        fuSec += '<div class="fp-timeline">';
        followUps.sort(function(a, b) { return (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''); });
        followUps.forEach(function(fu) {
          fuSec += '<div class="fp-timeline-item">'
            + '<div class="fp-timeline-dot"></div>'
            + '<div class="fp-timeline-content">'
            + '<div class="fp-timeline-head">'
            + '<span class="fp-timeline-type">' + _e(fu.activityType || fu.type || 'Follow-Up') + '</span>'
            + '<span class="fp-timeline-date">' + _e(fu.date || fu.createdAt || '') + '</span>'
            + '</div>'
            + '<div class="fp-timeline-body">' + _e(fu.notes || fu.description || '') + '</div>'
            + '</div></div>';
        });
        fuSec += '</div>';
      } else {
        fuSec += '<div class="flock-empty"><div class="flock-empty-icon">\uD83D\uDCDD</div>No follow-ups recorded.</div>';
      }
      html += _fpSec('Follow-Up History', 'comp-followups', fuSec);
    }

    // ── Section: Quick Actions ──
    if (id) {
      var actSec = '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
      if (rec.status === 'pending') {
        actSec += '<button type="button" onclick="TheLife.approveCompassion(\'' + _e(id) + '\')" class="fp-action-btn" style="background:var(--success);color:#fff;border-color:var(--success);">\u2713 Approve</button>';
        actSec += '<button type="button" onclick="TheLife.denyCompassion(\'' + _e(id) + '\')" class="fp-action-btn" style="background:var(--danger);color:#fff;border-color:var(--danger);">\u2717 Deny</button>';
      }
      actSec += '<button type="button" onclick="TheLife.addCompassionFollowUp(\'' + _e(id) + '\')" class="fp-action-btn">\uD83D\uDCDD Log Follow-Up</button>';
      actSec += '</div>';
      html += _fpSec('Quick Actions', 'comp-actions', actSec);
    }

    // Contact info
    if (id && (rec.requesterPhone || rec.requesterEmail)) {
      var cSec = '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
      if (rec.requesterEmail) cSec += '<a href="mailto:' + encodeURIComponent(rec.requesterEmail) + '" class="fp-action-btn">\u2709 Email ' + _e(rec.requesterEmail) + '</a>';
      if (rec.requesterPhone) {
        cSec += '<button type="button" onclick="TheLife._callPhone(\'' + _e(rec.requesterPhone) + '\')" class="fp-action-btn">\uD83D\uDCDE Call ' + _e(rec.requesterPhone) + '</button>';
        cSec += '<button type="button" onclick="TheLife._smsPhone(\'' + _e(rec.requesterPhone) + '\')" class="fp-action-btn">\uD83D\uDCAC Text</button>';
      }
      cSec += '</div>';
      html += _fpSec('Contact', 'comp-contact', cSec);
    }

    // Bottom save
    html += '<div class="fp-bottom-bar">'
      + '<button type="button" onclick="TheLife.saveCompassion()" class="fp-save-btn">\uD83D\uDCBE Save Request</button>'
      + '<span id="fp-save-status2" class="fp-save-status"></span>'
      + '</div>';

    (document.getElementById('fp-body') || {}).innerHTML = html;
  }

  async function saveCompassion() {
    var btn = document.getElementById('fp-save-btn');
    var st1 = document.getElementById('fp-save-status');
    var st2 = document.getElementById('fp-save-status2');
    function _stat(msg) { if (st1) st1.textContent = msg; if (st2) st2.textContent = msg; }

    if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    _stat('');

    var data = _fpCollect('fp-body');
    delete data.createdAt;
    delete data.updatedAt;

    try {
      if (_fpCompId) {
        data.id = _fpCompId;
        _stat('Updating request\u2026');
        await (_isFB() ? UpperRoom.updateCompassionRequest(data) : TheVine.flock.compassion.requests.update(data));
        _audit('compassion.update', 'CompassionRequests', _fpCompId, data.status || '');
      } else {
        _stat('Creating request\u2026');
        var res = await (_isFB() ? UpperRoom.createCompassionRequest(data) : TheVine.flock.compassion.requests.create(data));
        if (res && res.id) _fpCompId = res.id;
        _audit('compassion.create', 'CompassionRequests', _fpCompId || '', data.requestType || '');
      }
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Request'; }
      _toast('Compassion request saved!', 'success');
      _stat('Saved \u2713');
      if (typeof TheVine !== 'undefined' && TheVine.cache) {
        ['life:compassion', 'tab:compassion'].forEach(function(k) { TheVine.cache.invalidate(k); });
      }
      delete _cache.allCompassion;
      if (_fpCompId) {
        var _ns = (data.status || '').toLowerCase();
        if (_TERMINAL_STATUSES.indexOf(_ns) !== -1 && !_canViewNotes()) { backToHub(); }
        else { openCompassion(_fpCompId); }
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Request'; }
      _stat('');
      alert('Save failed: ' + (err.message || 'Unknown error'));
    }
  }

  async function approveCompassion(id) {
    if (!confirm('Approve this compassion request?')) return;
    try {
      await (_isFB() ? UpperRoom.approveCompassionRequest(id) : TheVine.flock.compassion.requests.approve({ id: id }));
      _audit('compassion.approve', 'CompassionRequests', id, 'Approved');
      if (typeof TheVine !== 'undefined' && TheVine.cache) {
        ['life:compassion', 'tab:compassion'].forEach(function(k) { TheVine.cache.invalidate(k); });
      }
      delete _cache.allCompassion;
      _toast('Request approved!', 'success');
      openCompassion(id);
    } catch (e) { alert('Failed: ' + (e.message || e)); }
  }

  async function denyCompassion(id) {
    if (!confirm('Deny this compassion request?')) return;
    try {
      await (_isFB() ? UpperRoom.denyCompassionRequest(id) : TheVine.flock.compassion.requests.deny({ id: id }));
      _audit('compassion.deny', 'CompassionRequests', id, 'Denied');
      if (typeof TheVine !== 'undefined' && TheVine.cache) {
        ['life:compassion', 'tab:compassion'].forEach(function(k) { TheVine.cache.invalidate(k); });
      }
      delete _cache.allCompassion;
      _toast('Request denied.', 'danger');
      backToHub();
    } catch (e) { alert('Failed: ' + (e.message || e)); }
  }

  async function addCompassionFollowUp(requestId) {
    _miniModal('Log Compassion Follow-Up', [
      { name: 'activityType', label: 'Type', type: 'select',
        options: ['Phone Call','Visit','Resource Delivery','Check-In','Other'] },
      { name: 'notes', label: 'Notes', type: 'textarea', required: true },
    ], async function(data) {
      data.requestId = requestId;
      await (_isFB() ? UpperRoom.createCompassionLog(data) : TheVine.flock.compassion.log.create(data));
      _toast('Follow-up logged!', 'success');
      openCompassion(requestId);
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // FULL-PAGE: OUTREACH CONTACT EDITOR
  // ══════════════════════════════════════════════════════════════════════════

  var _fpOutId = '';

  async function openOutreach(id) {
    var el = _hubEl();
    if (!el) return;
    _fpOutId = id || '';

    el.innerHTML = '<div class="fp-editor">'
      + '<div class="fp-topbar">'
      + '<button class="fp-back" onclick="TheLife.backToHub()">\u2190 My Flock</button>'
      + '<h2 class="fp-title">' + (id ? 'Edit Outreach Contact' : 'New Outreach Contact') + '</h2>'
      + '</div>'
      + '<div id="fp-body">' + _spinner() + '</div></div>';
    var _m = document.getElementById('main'); if (_m) _m.scrollTop = 0;

    // Parallel data fetch
    var _p = [_ensureDir()];
    if (id) {
      _p.push((_isFB() ? UpperRoom.getOutreachContact(id) : TheVine.flock.outreach.contacts.get({ contactId: id })).catch(function() { return null; }));
      _p.push((_isFB() ? UpperRoom.listOutreachFollowUps({ contactId: id }) : TheVine.flock.outreach.followUps.list({ contactId: id })).catch(function() { return []; }));
    }
    var _r = await Promise.all(_p);
    var dir = _r[0];
    var mOpts = _staffOpts(dir);

    var rec = {};
    if (id) {
      var _got = _r[1];
      rec = (_got && !_got.error && _got.row) ? _got.row
        : (_cache.allOutreach || []).find(function(c) { return c.id === id; }) || {};
    }
    var followUps = id ? _rows(_r[2] || []) : [];

    var html = '';

    // Save bar
    html += '<div class="fp-save-bar">'
      + '<button id="fp-save-btn" type="button" onclick="TheLife.saveOutreach()" class="fp-save-btn">\uD83D\uDCBE Save Contact</button>'
      + '<span id="fp-save-status" class="fp-save-status"></span>'
      + '</div>';

    // ── Section: Contact Info ──
    var infoSec = '';
    infoSec += _fp2(
      _fpField('First Name', 'firstName', rec.firstName, 'text'),
      _fpField('Last Name', 'lastName', rec.lastName, 'text'));
    infoSec += _fp2(
      _fpField('Email', 'email', rec.email, 'email'),
      _fpField('Phone', 'phone', rec.phone, 'tel'));
    infoSec += _fp2(
      _fpField('Address', 'address', rec.address, 'text'),
      _fpField('City', 'city', rec.city, 'text'));
    infoSec += _fp2(
      _fpField('State', 'state', rec.state, 'text'),
      _fpField('ZIP', 'zip', rec.zip, 'text'));
    infoSec += _fp2(
      _fpField('How They Connected', 'source', rec.source, 'select',
        ['','Website','Sunday Visit','Community Event','Referral','Social Media','Door-to-Door','Other']),
      _fpField('Interest Level', 'interestLevel', rec.interestLevel, 'select',
        ['','Low','Medium','High','Very High']));
    infoSec += _fp2(
      _fpField('Status', 'status', rec.status || 'New', 'select',
        ['New','Contacted','Follow-Up','Visiting','Connected','Converted','Inactive','Archived']),
      _fpField('Assigned To', 'assignedTo', rec.assignedTo, 'select', mOpts));
    infoSec += _fp2(
      _fpField('Last Contact Date', 'lastContact', rec.lastContact, 'readonly'),
      _fpField('Next Follow-Up Date', 'nextFollowUp', rec.nextFollowUp, 'date'));
    infoSec += _fpField('Tags', 'tags', rec.tags, 'text');
    infoSec += _fpField('Notes', 'notes', rec.notes, 'textarea');
    if (id) {
      infoSec += _fp2(
        _fpField('Created', 'createdAt', rec.createdAt, 'readonly'),
        _fpField('Last Updated', 'updatedAt', rec.updatedAt, 'readonly'));
    }
    html += _fpSec('Contact Info', 'out-info', infoSec);

    // ── Section: Follow-Up History ──
    if (id) {
      var fuSec = '';
      fuSec += '<div style="margin-bottom:12px;">'
        + '<button type="button" onclick="TheLife.addOutreachFollowUp(\'' + _e(id) + '\')" class="fp-action-btn">+ Log Follow-Up</button>'
        + '</div>';
      if (followUps.length) {
        fuSec += '<div class="fp-timeline">';
        followUps.sort(function(a, b) { return (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''); });
        followUps.forEach(function(fu) {
          fuSec += '<div class="fp-timeline-item">'
            + '<div class="fp-timeline-dot"></div>'
            + '<div class="fp-timeline-content">'
            + '<div class="fp-timeline-head">'
            + '<span class="fp-timeline-type">' + _e(fu.method || fu.type || 'Follow-Up') + '</span>'
            + '<span class="fp-timeline-date">' + _e(fu.date || fu.nextFollowUp || fu.createdAt || '') + '</span>'
            + '</div>'
            + '<div class="fp-timeline-body">' + _e(fu.notes || '') + '</div>'
            + '</div></div>';
        });
        fuSec += '</div>';
      } else {
        fuSec += '<div class="flock-empty"><div class="flock-empty-icon">\uD83D\uDCDD</div>No follow-ups recorded.</div>';
      }
      html += _fpSec('Follow-Up History', 'out-followups', fuSec);
    }

    // ── Section: Quick Contact ──
    if (id && (rec.email || rec.phone)) {
      var qSec = '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
      if (rec.email) qSec += '<a href="mailto:' + encodeURIComponent(rec.email) + '" class="fp-action-btn">\u2709 Email</a>';
      if (rec.phone) {
        qSec += '<button type="button" onclick="TheLife._callPhone(\'' + _e(rec.phone) + '\')" class="fp-action-btn">\uD83D\uDCDE Call</button>';
        qSec += '<button type="button" onclick="TheLife._smsPhone(\'' + _e(rec.phone) + '\')" class="fp-action-btn">\uD83D\uDCAC Text</button>';
      }
      qSec += '<button type="button" onclick="TheLife.addOutreachFollowUp(\'' + _e(id) + '\')" class="fp-action-btn">\uD83D\uDCDD Log Follow-Up</button>';
      qSec += '</div>';
      html += _fpSec('Quick Contact', 'out-contact', qSec);
    }

    // Bottom save + archive (edit mode only)
    html += '<div class="fp-bottom-bar">'
      + '<button type="button" onclick="TheLife.saveOutreach()" class="fp-save-btn">\uD83D\uDCBE Save Contact</button>'
      + '<span id="fp-save-status2" class="fp-save-status"></span>'
      + (id ? '<button type="button" onclick="TheLife.archiveOutreach()" class="fp-action-btn" style="margin-left:auto;color:var(--danger);border-color:var(--danger);">\uD83D\uDDC4 Archive</button>' : '')
      + '</div>';

    (document.getElementById('fp-body') || {}).innerHTML = html;
  }

  async function saveOutreach() {
    var btn = document.getElementById('fp-save-btn');
    var st1 = document.getElementById('fp-save-status');
    var st2 = document.getElementById('fp-save-status2');
    function _stat(msg) { if (st1) st1.textContent = msg; if (st2) st2.textContent = msg; }

    if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    _stat('');

    var data = _fpCollect('fp-body');
    delete data.createdAt;
    delete data.updatedAt;
    delete data.lastContact; // read-only; backend sets this via follow-up log, not direct update

    // Validate required fields
    if (!_requireField(data.name || data.firstName || data.lastName || data['First Name'], 'Contact Name')) { if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save'; } return; }
    // Validate email format if provided
    if (data.email && !_validEmail(data.email)) { _toast('Please enter a valid email address.', 'warn'); if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save'; } return; }
    // Validate phone format if provided
    if (data.phone && !_validPhone(data.phone)) { _toast('Phone number must be at least 7 digits.', 'warn'); if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save'; } return; }

    try {
      if (_fpOutId) {
        data.id = _fpOutId;
        _stat('Updating contact\u2026');
        await (_isFB() ? UpperRoom.updateOutreachContact(data) : TheVine.flock.outreach.contacts.update(data));
        _audit('outreach.update', 'OutreachContacts', _fpOutId, '');
      } else {
        _stat('Creating contact\u2026');
        var res = await (_isFB() ? UpperRoom.createOutreachContact(data) : TheVine.flock.outreach.contacts.create(data));
        if (res && res.id) _fpOutId = res.id;
        _audit('outreach.create', 'OutreachContacts', _fpOutId || '', (data.firstName || '') + ' ' + (data.lastName || ''));
      }
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Contact'; }
      delete _cache.allOutreach;
      if (typeof TheVine !== 'undefined' && TheVine.cache) {
        TheVine.cache.invalidate('life:outreach');
        TheVine.cache.invalidate('tab:outreach');
      }
      _toast('Outreach contact saved!', 'success');
      _stat('Saved \u2713');
      if (_fpOutId) {
        var _ns = (data.status || '').toLowerCase();
        if (_ns === 'archived' || _ns === 'inactive' || (_TERMINAL_STATUSES && _TERMINAL_STATUSES.indexOf(_ns) !== -1)) {
          backToHub();
        } else { openOutreach(_fpOutId); }
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Contact'; }
      _stat('');
      alert('Save failed: ' + (err.message || 'Unknown error'));
    }
  }

  async function addOutreachFollowUp(contactId) {
    _miniModal('Log Outreach Follow-Up', [
      { name: 'method', label: 'Contact Method', type: 'select',
        options: ['Phone Call','Email','Visit','Social Media','Text','Event','Other'] },
      { name: 'notes', label: 'Notes', type: 'textarea', required: true },
      { name: 'nextFollowUp', label: 'Next Follow-Up Date', type: 'date' },
    ], async function(data) {
      data.contactId = contactId;
      await (_isFB() ? UpperRoom.createOutreachFollowUp(data) : TheVine.flock.outreach.followUps.create(data));
      _toast('Follow-up logged!', 'success');
      openOutreach(contactId);
    });
  }

  async function archiveOutreach() {
    if (!_fpOutId) return;
    var rec = (_cache.allOutreach || []).find(function(c) { return c.id === _fpOutId; }) || {};
    var name = [rec.firstName, rec.lastName].filter(Boolean).join(' ') || rec.name || 'this contact';
    var _undo = (typeof Modules !== 'undefined' && Modules._undoAction) || function(msg, fn) { fn(); };
    _undo(name + ' archived', async function() {
      var upd = { id: _fpOutId, status: 'Archived' };
      if (rec.email) upd.contactEmail = rec.email;
      await (_isFB() ? UpperRoom.updateOutreachContact(upd) : TheVine.flock.outreach.contacts.update(upd));
      delete _cache.allOutreach;
      if (typeof TheVine !== 'undefined' && TheVine.cache) {
        TheVine.cache.invalidate('life:outreach');
        TheVine.cache.invalidate('tab:outreach');
      }
      backToHub();
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // MINI-MODAL  (lightweight for quick-add interactions, kept intentionally
  //              small — these are expected to open INSIDE a full page)
  // ══════════════════════════════════════════════════════════════════════════

  function _miniModal(title, fields, onSubmit) {
    var id = 'fp-mini-modal';
    var old = document.getElementById(id);
    if (old) old.remove();

    var fHtml = '';
    fields.forEach(function(f) {
      var sid = 'fpm-' + f.name;
      fHtml += '<div style="margin-bottom:14px;">'
             + '<label for="' + sid + '" style="display:block;font-size:0.79rem;color:var(--ink-muted);margin-bottom:4px;">' + _e(f.label)
             + (f.required ? ' <span style="color:var(--danger);">*</span>' : '')
             + '</label>';
      var base = ' id="' + sid + '" name="' + _e(f.name) + '"'
               + (f.required ? ' required' : '')
               + ' style="width:100%;background:rgba(255,255,255,0.07);border:1px solid var(--line);border-radius:6px;padding:8px 12px;color:var(--ink);font-size:max(1rem,16px);font-family:inherit;"';
      if (f.type === 'textarea') {
        fHtml += '<textarea' + base + ' rows="' + (f.rows || 4) + '">' + _e(f.value || '') + '</textarea>';
      } else if (f.type === 'select' && f.options) {
        fHtml += '<select' + base + '>';
        f.options.forEach(function(o) {
          var ov = typeof o === 'object' ? o.value : o;
          var ol = typeof o === 'object' ? o.label : o;
          fHtml += '<option value="' + _e(ov) + '"' + (f.value === ov ? ' selected' : '') + '>' + _e(ol) + '</option>';
        });
        fHtml += '</select>';
      } else {
        fHtml += '<input' + base + ' type="' + _e(f.type || 'text') + '"'
               + (f.value != null ? ' value="' + _e(String(f.value)) + '"' : '') + '>';
      }
      fHtml += '</div>';
    });

    var m = document.createElement('div');
    m.id = id;
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1100;'
                    + 'display:flex;align-items:center;justify-content:center;padding:40px 20px;';
    m.innerHTML =
      '<div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;'
      + 'padding:24px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
      + '<h3 style="font-size:0.95rem;color:var(--accent);margin:0;">' + _e(title) + '</h3>'
      + '<button id="fpm-close" style="background:none;border:none;color:var(--ink-muted);font-size:1.3rem;cursor:pointer;line-height:1;">&#x2715;</button>'
      + '</div>'
      + '<form id="fpm-form">' + fHtml
      + '<div style="display:flex;gap:10px;margin-top:8px;">'
      + '<button type="submit" id="fpm-save" class="fp-save-btn" style="flex:1;">Save</button>'
      + '</div></form></div>';

    document.body.appendChild(m);

    document.getElementById('fpm-close').onclick = function() { m.remove(); };
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });

    document.getElementById('fpm-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var data = {};
      fields.forEach(function(f) {
        var inp = document.getElementById('fpm-' + f.name);
        if (inp) data[f.name] = inp.value.trim();
      });
      var saveBtn = document.getElementById('fpm-save');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving\u2026'; }
      try {
        await onSubmit(data);
        m.remove();
      } catch (err) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
        alert(err.message || 'Save failed.');
      }
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // FULL-PAGE: ADD / EDIT MEMBER
  // ══════════════════════════════════════════════════════════════════════════

  var _fpMemberId = '';

  // prefill: optional plain object with member fields to pre-populate when creating a new member
  // (used when redirecting from People or Admin panels where user context is already loaded)
  async function openAddMember(emailOrId, prefill) {
    if (!Nehemiah.can('my-flock.add-edit-members')) { _toast('You do not have permission to add or edit members.', 'error'); return; }
    var el = _hubEl();
    if (!el) return;
    _fpMemberId = emailOrId || '';
    var isEdit = !!emailOrId;

    el.innerHTML = '<div class="fp-editor">'
      + '<div class="fp-topbar">'
      + '<button class="fp-back" onclick="TheLife.backToHub()">\u2190 Back to My Flock</button>'
      + '<h2 class="fp-title">' + (isEdit ? 'Edit Member' : 'Add New Member') + '</h2>'
      + '</div>'
      + '<div id="fp-body">' + _spinner() + '</div></div>';
    var _m = document.getElementById('main'); if (_m) _m.scrollTop = 0;

    var rec = {};
    if (isEdit) {
      try {
        var res = await (_isFB() ? UpperRoom.getMember(emailOrId) : TheVine.flock.call('members.get', { id: emailOrId }));
        rec = (res && !res.error) ? res : {};
      } catch (_) {
        // Try directory cache
        var dir = _cache.memberDir || [];
        rec = dir.find(function(m) { return m.email === emailOrId || m.id === emailOrId; }) || {};
      }
      // Pin to server-side UUID so updates target the exact row
      if (rec.id) _fpMemberId = rec.id;
    } else if (prefill && typeof prefill === 'object') {
      // Pre-populate the form with caller-supplied data (e.g. redirected from People or Admin panels)
      rec = prefill;
    }

    // Load member/user directory for caregiver dropdown
    var _dirP = _ensureDir();
    var _dirPermRes = await Promise.all([_dirP]);
    var dir = _dirPermRes[0];
    var _memberRole = rec.role || '';
    var permData = [];

    var careRoles = { care: 1, deacon: 1, pastor: 1, admin: 1 };
    var caregiverOpts = [{ value: '', label: '(none)' }].concat(
      (dir || []).filter(function(m) { return m.role && careRoles[m.role.toLowerCase()]; })
        .map(function(m) {
          var name = m.preferredName || ((m.firstName || '') + ' ' + (m.lastName || '')).trim();
          return { value: m.id || m.email, label: name || m.email || m.id };
        })
    );

    var html = '';

    // Sticky save bar
    html += '<div class="fp-save-bar">'
      + '<button id="fp-save-btn" type="button" onclick="TheLife.saveMember()"'
      + ' class="fp-save-btn">\uD83D\uDCBE ' + (isEdit ? 'Save Member' : 'Create Member') + '</button>'
      + '<span id="fp-save-status" class="fp-save-status"></span>'
      + '</div>';

    // ── Section: Basic Info ──
    var basicSec = '';
    basicSec += _fp2(
      _fpField('First Name', 'firstName', rec.firstName, 'text'),
      _fpField('Last Name', 'lastName', rec.lastName, 'text'));
    basicSec += _fp2(
      _fpField('Preferred Name', 'preferredName', rec.preferredName, 'text'),
      _fpField('Suffix', 'suffix', rec.suffix, 'select',
        ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'MD', 'PhD', 'Esq.']));
    basicSec += _fp2(
      _fpField('Gender', 'gender', rec.gender, 'select', ['', 'Male', 'Female']),
      _fpField('Date of Birth', 'dateOfBirth', rec.dateOfBirth, 'date'));
    html += _fpSec('Basic Information', 'mem-basic', basicSec);

    // ── Section: Contact ──
    var contactSec = '';
    contactSec += _fp2(
      _fpField('Primary Email', 'primaryEmail', rec.primaryEmail || rec.email, 'email'),
      _fpField('Secondary Email', 'secondaryEmail', rec.secondaryEmail, 'email'));
    contactSec += _fp2(
      _fpField('Cell Phone', 'cellPhone', rec.cellPhone || rec.phone, 'tel'),
      _fpField('Home Phone', 'homePhone', rec.homePhone, 'tel'));
    contactSec += _fp2(
      _fpField('Work Phone', 'workPhone', rec.workPhone, 'tel'),
      _fpField('Preferred Contact', 'preferredContact', rec.preferredContact || 'Email', 'select',
        ['Email', 'Phone', 'Text', 'Mail']));
    html += _fpSec('Contact', 'mem-contact', contactSec);

    // ── Section: Address ──
    var addrSec = '';
    addrSec += _fpField('Address Line 1', 'address1', rec.address1, 'text');
    addrSec += _fpField('Address Line 2', 'address2', rec.address2, 'text');
    addrSec += _fp2(
      _fpField('City', 'city', rec.city, 'text'),
      _fpField('State', 'state', rec.state, 'text'));
    addrSec += _fp2(
      _fpField('ZIP', 'zip', rec.zip, 'text'),
      _fpField('Country', 'country', rec.country, 'text'));
    html += _fpSec('Address', 'mem-address', addrSec, false);

    // ── Section: Church Info ──
    var churchSec = '';
    churchSec += _fp2(
      _fpField('Membership Status', 'membershipStatus', rec.membershipStatus || 'Active', 'select',
        ['Active', 'Inactive', 'Visitor', 'Prospect', 'Former', 'Transferred', 'Deceased']),
      _fpField('Member Since', 'memberSince', rec.memberSince, 'date'));
    churchSec += _fp2(
      _fpField('How They Found Us', 'howTheyFoundUs', rec.howTheyFoundUs, 'select',
        ['', 'Website', 'Sunday Visit', 'Community Event', 'Referral', 'Social Media', 'Door-to-Door', 'Other']),
      _fpField('Small Group', 'smallGroup', rec.smallGroup, 'text'));
    churchSec += _fp2(
      _fpField('Baptism Date', 'baptismDate', rec.baptismDate, 'date'),
      _fpField('Salvation Date', 'salvationDate', rec.salvationDate, 'date'));
    churchSec += _fpField('Date of Death', 'dateOfDeath', rec.dateOfDeath, 'date');
    html += _fpSec('Church Info', 'mem-church', churchSec, false);

    // ── Section: Family ──
    var famSec = '';
    famSec += _fp2(
      _fpField('Marital Status', 'maritalStatus', rec.maritalStatus, 'select',
        ['', 'Single', 'Married', 'Divorced', 'Widowed', 'Separated']),
      _fpField('Spouse Name', 'spouseName', rec.spouseName, 'text'));
    famSec += _fp2(
      _fpField('Family Role', 'familyRole', rec.familyRole, 'select',
        ['', 'Head of Household', 'Spouse', 'Child', 'Other']),
      _fpField('Emergency Contact', 'emergencyContact', rec.emergencyContact, 'text'));
    famSec += _fpField('Emergency Phone', 'emergencyPhone', rec.emergencyPhone, 'tel');
    html += _fpSec('Family & Emergency', 'mem-family', famSec, false);

    // ── Section: Involvement ──
    var invSec = '';
    invSec += _fp2(
      _fpField('Ministry Teams', 'ministryTeams', rec.ministryTeams, 'text'),
      _fpField('Volunteer Roles', 'volunteerRoles', rec.volunteerRoles, 'text'));
    invSec += _fp2(
      _fpField('Spiritual Gifts', 'spiritualGifts', rec.spiritualGifts, 'text'),
      _fpField('Tags', 'tags', rec.tags, 'text'));
    invSec += _fpField('Website', 'website', rec.website, 'text');
    html += _fpSec('Involvement', 'mem-involve', invSec, false);

    // ── Section: Pastoral Notes ──
    var notesSec = '';
    notesSec += _fpField('Assigned To', 'assignedTo', rec.assignedTo, 'select', caregiverOpts);
    notesSec += _fpField('Pastoral Notes', 'pastoralNotes', rec.pastoralNotes, 'textarea');
    notesSec += _fp2(
      _fpField('Follow-Up Priority', 'followUpPriority', rec.followUpPriority || 'Low', 'select',
        ['Low', 'Normal', 'High', 'Urgent']),
      _fpField('Next Follow-Up', 'nextFollowUp', rec.nextFollowUp, 'date'));
    html += _fpSec('Pastoral Notes', 'mem-notes', notesSec, false);

    // ── Section: Login Account (Admin only, new members only) ──
    if (!isEdit && (Nehemiah.hasRole('admin') || Nehemiah.hasGroup('Master') || Nehemiah.hasGroup('Seed Admin') || Nehemiah.hasGroup('Lead Pastor'))) {
      var acctSec = '';
      acctSec += '<div style="margin-bottom:10px;display:flex;align-items:center;gap:8px;">'
        + '<input type="checkbox" id="fp-createAccount" onchange="document.getElementById(\'fp-sec-mem-acct-fields\').style.display=this.checked?\'block\':\'none\';">'
        + '<label for="fp-createAccount" style="font-size:0.82rem;color:var(--ink);">Create a login account for this member</label>'
        + '</div>';
      acctSec += '<div id="fp-sec-mem-acct-fields" style="display:none;">';
      acctSec += _fpField('Password', 'acctPassword', '', 'password');
      acctSec += _fpField('Confirm Password', 'acctPasswordConfirm', '', 'password');
      acctSec += _fpField('Account Role', 'acctRole', 'volunteer', 'select',
        [{value:'readonly', label:'Read Only'}, {value:'volunteer', label:'Volunteer'},
         {value:'care', label:'Care Team'}, {value:'deacon', label:'Deacon'},
         {value:'leader', label:'Leader'}, {value:'pastor', label:'Pastor'}]);
      acctSec += '</div>';
      html += _fpSec('Login Account (Optional)', 'mem-acct', acctSec, false);
    }

    // ── Section: Permissions (only shown to users with user-management capability) ──
    if (Nehemiah.can('users')) {
      var _permTargetEmail = rec.primaryEmail || rec.email || (typeof emailOrId === 'string' && emailOrId.indexOf('@') !== -1 ? emailOrId : '');
      html += _fpSec('Permissions', 'mem-perms',
        '<div id="fp-perms-placeholder" style="color:var(--ink-muted);font-size:0.84rem;padding:8px 0;">'
        + 'Expand this section to load permissions.</div>', false);
    }

    // Bottom save
    html += '<div class="fp-bottom-bar">'
      + '<button type="button" onclick="TheLife.saveMember()"'
      + ' class="fp-save-btn">\uD83D\uDCBE ' + (isEdit ? 'Save Member' : 'Create Member') + '</button>'
      + '<span id="fp-save-status2" class="fp-save-status"></span>'
      + '</div>';

    (document.getElementById('fp-body') || {}).innerHTML = html;

    // ── Lazy-load permissions when section is first expanded ──
    if (Nehemiah.can('users')) {
      var _permTargetEmail = rec.primaryEmail || rec.email || (typeof emailOrId === 'string' && emailOrId.indexOf('@') !== -1 ? emailOrId : '');
      var _permSec = document.getElementById('fp-sec-mem-perms');
      var _permDetails = _permSec && _permSec.closest('details');
      if (_permDetails) {
        var _permLoaded = false;
        _permDetails.addEventListener('toggle', function _onPermToggle() {
          if (_permLoaded || !_permDetails.open) return;
          _permLoaded = true;
          var ph = document.getElementById('fp-perms-placeholder');
          if (ph) ph.innerHTML = '<span style="color:var(--ink-muted);font-size:0.84rem;">Loading\u2026</span>';
          TheVine.flock.permissions.get({ targetEmail: _permTargetEmail })
            .then(function(res) {
              var role = (res && res.role) || rec.role || '';
              var ov   = (res && res.overrides) || [];
              var sec  = document.getElementById('fp-sec-mem-perms');
              if (sec) sec.innerHTML = _buildPermMatrix(ov, role);
              _fpSyncAllGrpHeaders();
              _fpSyncCritConfirm();
            })
            .catch(function() {
              var ph2 = document.getElementById('fp-perms-placeholder');
              if (ph2) ph2.textContent = 'Could not load permissions. Please close and reopen this profile.';
            });
        });
      }
    }
  }

  async function saveMember() {
    var btn = document.getElementById('fp-save-btn');
    var st1 = document.getElementById('fp-save-status');
    var st2 = document.getElementById('fp-save-status2');
    function _stat(msg) { if (st1) st1.textContent = msg; if (st2) st2.textContent = msg; }

    if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    _stat('');

    var data = _fpCollect('fp-body');
    // Separate account fields before cleaning
    var createAcct = !_fpMemberId && document.getElementById('fp-createAccount')
                   && document.getElementById('fp-createAccount').checked;
    var acctPassword = data.acctPassword || '';
    var acctPasswordConfirm = data.acctPasswordConfirm || '';
    var acctRole = data.acctRole || 'volunteer';
    delete data.acctPassword;
    delete data.acctPasswordConfirm;
    delete data.acctRole;

    // Remove empty strings so backend defaults apply
    Object.keys(data).forEach(function(k) { if (data[k] === '') delete data[k]; });

    if (!data.firstName && !data.lastName) {
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE ' + (_fpMemberId ? 'Save Member' : 'Create Member'); }
      alert('Please enter a first or last name.');
      return;
    }

    // Validate email format if provided
    if (data.primaryEmail && !_validEmail(data.primaryEmail)) {
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE ' + (_fpMemberId ? 'Save Member' : 'Create Member'); }
      alert('Please enter a valid email address.');
      return;
    }

    // Validate phone format if provided
    if (data.phone && !_validPhone(data.phone)) {
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE ' + (_fpMemberId ? 'Save Member' : 'Create Member'); }
      alert('Phone number must be at least 7 digits.');
      return;
    }

    // Validate account fields if creating account
    if (createAcct) {
      if (!data.primaryEmail) {
        if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Create Member'; }
        alert('A primary email is required to create a login account.');
        return;
      }
      if (!acctPassword || acctPassword.length < 6) {
        if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Create Member'; }
        alert('Password must be at least 6 characters.');
        return;
      }
      if (acctPassword !== acctPasswordConfirm) {
        if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Create Member'; }
        alert('Passwords do not match.');
        return;
      }
    }

    var isNew = !_fpMemberId;
    var session = Nehemiah.getSession() || {};

    try {
      if (_fpMemberId) {
        data.id = _fpMemberId;
        _stat('Updating member\u2026');
        await (_isFB() ? UpperRoom.updateMember(data) : TheVine.flock.call('members.update', data));
        _audit('member.update', 'Members', _fpMemberId, 'Updated member record');
      } else {
        _stat('Creating member\u2026');
        var res = await (_isFB() ? UpperRoom.createMember(data) : TheVine.flock.call('members.create', data));
        if (res && res.id) _fpMemberId = res.id;
        _audit('member.create', 'Members', _fpMemberId || data.primaryEmail || '',
          (data.firstName || '') + ' ' + (data.lastName || ''));

        // ── Auto-create care assignment: assign new member to current user ──
        try {
          _stat('Assigning to your flock\u2026');
          await (_isFB() ? UpperRoom.createCareAssignment({
            caregiverId: session.email || '',
            memberId: _fpMemberId || data.primaryEmail || '',
            role: 'Shepherd',
            status: 'Active',
            startDate: new Date().toISOString().split('T')[0],
          }) : TheVine.flock.care.assignments.create({
            caregiverId: session.email || '',
            memberId: _fpMemberId || data.primaryEmail || '',
            role: 'Shepherd',
            status: 'Active',
            startDate: new Date().toISOString().split('T')[0],
          }));
          _audit('care.assignment.create', 'SpiritualCareAssignments',
            _fpMemberId || data.primaryEmail || '',
            'Auto-assigned to ' + (session.email || 'caregiver'));
        } catch (assignErr) {
          console.warn('[TheLife] Care assignment auto-create failed:', assignErr);
          // Non-fatal — member was still created
        }

        // ── Create login account if admin opted in ──
        if (createAcct) {
          try {
            _stat('Creating login account\u2026');
            await TheVine.flock.call('users.create', {
              targetEmail: data.primaryEmail,
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              passcode: acctPassword,
              role: acctRole,
            });
            _audit('user.create', 'AuthUsers', data.primaryEmail,
              'Account created with role: ' + acctRole);
          } catch (acctErr) {
            console.warn('[TheLife] Account creation failed:', acctErr);
            if (acctErr.message && acctErr.message.toLowerCase().includes('already exists')) {
              _toast('Member created. A login account for this email already exists.', 'info');
            } else {
              _toast('Member created, but account creation failed: ' + (acctErr.message || ''), 'danger');
            }
          }
        }
      }

      // Invalidate member directory cache so new member shows up
      _cache.memberDir = null;
      _memberDirPromise = null;

      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save Member'; }
      _toast('Member ' + (isNew ? 'created' : 'saved') + '!', 'success');
      _stat('Saved \u2713');

      // Return to hub so user immediately sees the new member
      if (isNew) {
        setTimeout(function() { backToHub(); }, 600);
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE ' + (_fpMemberId ? 'Save Member' : 'Create Member'); }
      _stat('');
      alert('Save failed: ' + (err.message || 'Unknown error'));
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // HUB — Dashboard state + panel builders
  // ══════════════════════════════════════════════════════════════════════════

  var _flockData = {};
  var _flockActiveTab = 'overview';

  // ── Tiny helpers ────────────────────────────────────────────────────────
  function _flockKpi(val, label, color, onclick) {
    return '<div class="flock-kpi' + (color === 'danger' ? ' kpi-alert' : '') + '"'
      + (onclick ? ' onclick="' + onclick + '"' : '') + '>'
      + '<div class="flock-kpi-val" style="color:var(--' + (color || 'accent') + ');">' + val + '</div>'
      + '<div class="flock-kpi-label">' + _e(label) + '</div></div>';
  }
  function _flockTab(key, label, ct, ctCls) {
    var badge = ct > 0 ? '<span class="tab-ct' + (ctCls ? ' ct-' + ctCls : '') + '">' + ct + '</span>' : '';
    return '<button class="flock-tab' + (key === _flockActiveTab ? ' active' : '') + '" '
      + 'data-ftab="' + key + '" onclick="TheLife.switchTab(\'' + key + '\')">'
      + _e(label) + badge + '</button>';
  }
  function _flockCard(opts) {
    var priCls = '';
    var pri = (opts.priority || '').toLowerCase();
    if (pri === 'critical' || pri === 'high') priCls = ' priority-high';
    else if (pri === 'urgent') priCls = ' priority-urgent';
    var h = '<div class="flock-card' + priCls + '"' + (opts.onclick ? ' onclick="' + opts.onclick + '"' : '') + '>';
    h += '<div class="flock-card-head"><span class="flock-card-name">' + (opts.name || '') + '</span>';
    h += '<div class="flock-card-pills">' + (opts.pills || '') + '</div></div>';
    if (opts.body) h += '<div class="flock-card-body">' + opts.body + '</div>';
    var foot = [];
    if (opts.assigned) foot.push('<span class="assigned">' + _e(opts.assigned) + '</span>');
    if (opts.date) foot.push('<span>' + _fmtDate(opts.date) + '</span>');
    if (opts.extra) foot.push(opts.extra);
    if (foot.length) h += '<div class="flock-card-foot">' + foot.join(' \u00B7 ') + '</div>';
    h += '</div>';
    return h;
  }
  function _flockEmpty(icon, msg) {
    return '<div class="flock-empty"><div class="flock-empty-icon">' + icon + '</div>' + _e(msg) + '</div>';
  }

  // ── Tab switcher (lazy-renders panel on first view) ──────────────────
  function switchTab(key) {
    _flockActiveTab = key;
    document.querySelectorAll('.flock-tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-ftab') === key);
    });
    document.querySelectorAll('.flock-panel').forEach(function(p) {
      p.classList.toggle('active', p.id === 'flock-p-' + key);
    });
    // Always re-render panel on tab click
    var panel = document.getElementById('flock-p-' + key);
    if (panel && _flockData.myFlock) {
      var d = _flockData;
      _renderPanel(key, d.myFlock, d.openCases, d.fuRows, d.dashboard || {},
        d.allCare, d.allPrayer, d.allCompassion, d.allOutreach, d.allDisciple || []);
      panel.dataset.rendered = '1';
    }
    _audit('hub.tab', 'MyFlock', key, 'Switched to ' + key);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HUB — Panel builders
  // ══════════════════════════════════════════════════════════════════════════

  function _buildOverview(myFlock, openCases, fuRows, dashboard) {
    var h = '';

    // Dashboard summary row (if dashboard API returned data)
    if (dashboard && (dashboard.totalCases || dashboard.activeCases)) {
      // Count overdue open cases (no activity >14 days)
      var overdueCount = 0;
      var reviewsDue = 0;
      var _now = Date.now();
      openCases.forEach(function(c) {
        var last = c.lastContactAt || c.updatedAt || c.createdAt || '';
        if (last && Math.floor((_now - _tsMs(last)) / 86400000) > 14) overdueCount++;
        if (c.nextReviewDate) { var _rd = new Date(c.nextReviewDate); if (!isNaN(_rd) && _rd.getTime() < _now) reviewsDue++; }
      });
      h += '<div class="flock-dashboard-strip">';
      h += '<div class="flock-dash-item"><span class="flock-dash-val">' + (dashboard.totalCases || 0) + '</span><span class="flock-dash-label">Total Cases</span></div>';
      h += '<div class="flock-dash-item"><span class="flock-dash-val">' + (dashboard.activeCases || 0) + '</span><span class="flock-dash-label">Active</span></div>';
      h += '<div class="flock-dash-item"><span class="flock-dash-val">' + (dashboard.resolvedCases || 0) + '</span><span class="flock-dash-label">Resolved</span></div>';
      h += '<div class="flock-dash-item"><span class="flock-dash-val">' + (dashboard.avgResolutionDays || '\u2014') + '</span><span class="flock-dash-label">Avg Days</span></div>';
      if (overdueCount) h += '<div class="flock-dash-item"><span class="flock-dash-val" style="color:var(--danger);">' + overdueCount + '</span><span class="flock-dash-label" style="color:var(--danger);">Overdue</span></div>';
      if (reviewsDue) h += '<div class="flock-dash-item"><span class="flock-dash-val" style="color:var(--warning,orange);">' + reviewsDue + '</span><span class="flock-dash-label" style="color:var(--warning,orange);">Reviews Due</span></div>';
      h += '</div>';
    }

    // Assigned Members
    if (!myFlock.length) {
      h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
      h += '<span></span>';
      h += '<button onclick="TheLife.openAddMember()" style="background:var(--accent);color:var(--ink-inverse);border:none;font-weight:600;border-radius:6px;padding:7px 15px;cursor:pointer;font-size:0.82rem;font-family:inherit;">\uD83D\uDC64+ Add Member</button>';
      h += '</div>';
      h += _flockEmpty('\uD83D\uDC65', 'No members assigned yet.');
    } else {
      h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">';
      h += '<h4 class="flock-section-heading" style="margin-bottom:0;">\uD83D\uDC65 ' + (Nehemiah.hasRole('pastor') ? 'Entire Flock' : Nehemiah.hasRole('care') ? 'My Assigned Flock' : 'Church Directory') + '</h4>';
      h += '<button onclick="TheLife.openAddMember()" style="background:var(--accent);color:var(--ink-inverse);border:none;font-weight:600;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.8rem;font-family:inherit;">\uD83D\uDC64+ Add Member</button>';
      h += '</div>';
      h += '<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:16px;">';
      myFlock.forEach(function(a) {
        var name = a.memberName || a.memberId || '';
        var init = name ? name.charAt(0).toUpperCase() : '?';
        h += '<div class="flock-member-row">';
        h += '<div class="flock-member-init">' + _e(init) + '</div>';
        h += '<div class="flock-member-info">';
        h += '<div class="flock-member-name">' + _e(name) + '</div>';
        h += '<div class="flock-member-detail">' + _e(a.role || 'Shepherd') + (a.startDate ? ' \u00B7 Since ' + _e(a.startDate) : '') + '</div>';
        h += '</div>';
        h += '</div>';
      });
      h += '</div>';
    }

    // Open cases snapshot
    if (openCases.length) {
      h += '<h4 class="flock-section-heading">\u2764\uFE0F Open Cases <span class="flock-section-ct">' + openCases.length + '</span></h4>';
      h += '<div class="flock-card-grid">';
      openCases.slice(0, 8).forEach(function(c) {
        var ovPills = _statusBadge(c.priority || 'Normal') + _statusBadge(c.status);
        var _lastMs = _tsMs(c.lastContactAt) || _tsMs(c.updatedAt) || _tsMs(c.createdAt);
        var _dys = _lastMs ? Math.floor((Date.now() - _lastMs) / 86400000) : 0;
        if (_dys > 14) ovPills += _statusBadge('Urgent', _dys + 'd no contact');
        else if (_dys > 7) ovPills += _statusBadge('High', _dys + 'd no contact');
        if (c.nextReviewDate) { var _ovRd = new Date(c.nextReviewDate); if (!isNaN(_ovRd) && _ovRd.getTime() < Date.now()) ovPills += _statusBadge('Urgent', '\uD83D\uDD14 Review'); }
        h += _flockCard({
          name: _e(_memberName(c.memberId) || c.memberName || c.party1 || c.memberId || ''),
          pills: ovPills,
          body: _e((c.careType || '') + (c.summary ? ' \u2014 ' + c.summary.substring(0, 100) : '')),
          assigned: _memberName(c.primaryCaregiverId) || c.assignedName || '',
          date: c.createdAt || '',
          priority: c.priority,
          onclick: "TheLife.openCareCase('" + _e(c.id) + "')"
        });
      });
      h += '</div>';
      if (openCases.length > 8) h += '<div class="flock-see-more">+ ' + (openCases.length - 8) + ' more \u2014 see Care tab</div>';
    }

    // Follow-ups due
    if (fuRows.length) {
      h += '<h4 class="flock-section-heading" style="color:var(--danger);">\u26A0\uFE0F Follow-Ups Due <span class="flock-section-ct" style="background:var(--danger);">' + fuRows.length + '</span></h4>';
      h += '<div style="display:grid;gap:8px;">';
      fuRows.forEach(function(f) {
        var fuName = _memberName(f.memberId) || f.memberName || f.email || f.caseId || '';
        var fuClick = f.caseId ? ' style="cursor:pointer;" onclick="TheLife.openCareCase(\'' + _e(f.caseId) + '\')"' : '';
        h += '<div class="flock-followup-row"' + fuClick + '>'
          + '<span><strong>' + _e(fuName) + '</strong> \u2014 ' + _e(f.interactionType || f.type || 'Follow-up') + '</span>'
          + '<span class="flock-followup-date">' + _e(f.followUpDate || f.dueDate || f.due || '') + '</span></div>';
      });
      h += '</div>';
    }
    return h;
  }

  function _buildCarePanel(rows) {
    if (!rows.length) return _flockEmpty('\u2764', 'No care cases.');
    var unassigned = rows.filter(function(c) {
      var st = (c.status || '').toLowerCase();
      return st !== 'resolved' && st !== 'closed' && !c.primaryCaregiverId && !c.assignedTo;
    }).length;
    var h = '<div class="flock-actions">'
      + '<button class="primary" onclick="TheLife.openCareCase()">+ New Case</button>'
      + '<button onclick="TheLife.showFollowUps()">Follow-ups Due</button>'
      + '<button onclick="TheLife._autoAssignCasesToLP()" title="Auto-assign all unassigned care cases to the Lead Pastor">👤 Assign All to Lead Pastor</button>'
      + (unassigned ? '<button onclick="TheLife.showUnassignedCases()" style="position:relative;">Unassigned'
        + '<span style="position:absolute;top:-6px;right:-8px;background:#c94c4c;color:#fff;border-radius:999px;font-size:0.65rem;font-weight:700;padding:1px 5px;line-height:1.4;">' + unassigned + '</span></button>' : '')
      + '</div>';

    // Calculate days since last CONTACT (not last form-save) for open cases.
    // Priority: lastContactAt > updatedAt > createdAt
    var now = Date.now();
    rows.forEach(function(c) {
      var lastMs = _tsMs(c.lastContactAt) || _tsMs(c.updatedAt) || _tsMs(c.createdAt);
      c._daysSince = lastMs ? Math.floor((now - lastMs) / 86400000) : 999;
    });
    rows.sort(function(a, b) {
      // Open/active first, then by overdue days descending
      var aOpen = (a.status || '').toLowerCase() !== 'resolved' && (a.status || '').toLowerCase() !== 'closed' ? 1 : 0;
      var bOpen = (b.status || '').toLowerCase() !== 'resolved' && (b.status || '').toLowerCase() !== 'closed' ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return b._daysSince - a._daysSince;
    });

    h += '<div class="flock-card-grid">';
    rows.forEach(function(c) {
      var extraPills = '';
      if (c.riskLevel) extraPills += _statusBadge(c.riskLevel === 'Critical' ? 'Urgent' : c.riskLevel === 'High' ? 'High' : c.riskLevel, c.riskLevel + ' Risk');
      if (c.trend === 'Declining') extraPills += _statusBadge('High', '\u2198 Declining');
      else if (c.trend === 'Improving') extraPills += _statusBadge('Low', '\u2197 Improving');
      // Overdue badge for open cases
      var isOpen = (c.status || '').toLowerCase() !== 'resolved' && (c.status || '').toLowerCase() !== 'closed';
      if (isOpen && c._daysSince > 14) extraPills += _statusBadge('Urgent', c._daysSince + 'd no contact');
      else if (isOpen && c._daysSince > 7) extraPills += _statusBadge('High', c._daysSince + 'd no contact');
      // Review overdue badge
      if (isOpen && c.nextReviewDate) {
        var _rd = new Date(c.nextReviewDate);
        if (!isNaN(_rd) && _rd.getTime() < now) extraPills += _statusBadge('Urgent', '\uD83D\uDD14 Review overdue');
      }
      h += _flockCard({
        name: _e(_memberName(c.memberId) || c.memberName || c.party1 || c.memberId || ''),
        pills: _statusBadge(c.priority || 'Normal') + _statusBadge(c.status) + extraPills,
        body: _e((c.careType || '') + (c.summary ? ' \u2014 ' + c.summary.substring(0, 120) : '')),
        assigned: _memberName(c.primaryCaregiverId) || c.assignedName || '',
        date: c.createdAt || '',
        priority: c.priority,
        onclick: "TheLife.openCareCase('" + _e(c.id) + "')"
      });
    });
    h += '</div>';
    return h;
  }

  function _buildPrayerPanel(rows) {
    if (!rows.length) return _flockEmpty('\uD83D\uDE4F', 'No prayer requests. All caught up!');

    var unassignedCount = rows.filter(function(r) {
      var st = (r.status || r['Status'] || '').toLowerCase();
      return st !== 'answered' && st !== 'closed' && !(r.assignedTo || r['Assigned To']);
    }).length;

    var h = '<div class="flock-actions">'
      + '<button onclick="TheLife._autoAssignPrayersToLP()" title="Auto-assign all unassigned prayer requests to the Lead Pastor">👤 Assign All to Lead Pastor</button>'
      + (unassignedCount ? '<button onclick="TheLife.showUnassignedPrayers()" style="position:relative;">Unassigned'
        + '<span style="position:absolute;top:-6px;right:-8px;background:#c94c4c;color:#fff;border-radius:999px;font-size:0.65rem;font-weight:700;padding:1px 5px;line-height:1.4;">' + unassignedCount + '</span></button>' : '')
      + '</div>';

    var total = rows.length;
    var pages = Math.ceil(total / _PANEL_PAGE_SIZE);
    if (_prayerPage >= pages) _prayerPage = pages - 1;
    if (_prayerPage < 0) _prayerPage = 0;
    var start = _prayerPage * _PANEL_PAGE_SIZE;
    var page  = rows.slice(start, start + _PANEL_PAGE_SIZE);

    h += '<div class="flock-card-grid">';
    page.forEach(function(r) {
      var rid    = _e(String(r.id || r.ID || ''));
      var name   = _e(r.submitterName || r['Submitter Name'] || 'Anonymous');
      var prayer = _e(r.prayerText || r['Prayer Text'] || '');
      var cat    = r.category || r['Category'] || '';
      var isConf = String(r.isConfidential || r['Is Confidential'] || '').toUpperCase() === 'TRUE';
      var isFU   = String(r.followUpRequested || r['Follow-Up Requested'] || '').toUpperCase() === 'TRUE';
      var status = r.status || r['Status'] || 'New';
      var assigned = _memberName(r.assignedTo || r['Assigned To']) || '';
      var date   = r.submittedAt || r['Submitted At'] || '';
      var pills  = _statusBadge(status);
      if (cat) pills += ' ' + _badge(cat, 'info');
      if (isConf) pills += ' <span class="badge badge-warn">\uD83D\uDD12 Confidential</span>';
      if (isFU) pills += ' <span class="badge badge-danger">Follow-up</span>';

      h += _flockCard({
        name: name,
        pills: pills,
        body: prayer.length > 200 ? prayer.substring(0, 200) + '\u2026' : prayer,
        assigned: assigned,
        date: date,
        onclick: "TheLife.openPrayer('" + rid + "')"
      });
    });
    h += '</div>';
    // Pagination controls (only when > 1 page)
    if (pages > 1) {
      h += '<div style="display:flex;justify-content:center;align-items:center;gap:12px;padding:12px 0;font-size:0.85rem;">';
      h += '<button class="btn-sm" onclick="TheLife._prayerPageNav(-1)"' + (_prayerPage === 0 ? ' disabled' : '') + '>&laquo; Prev</button>';
      h += '<span>' + (start + 1) + '–' + Math.min(start + _PANEL_PAGE_SIZE, total) + ' of ' + total + '</span>';
      h += '<button class="btn-sm" onclick="TheLife._prayerPageNav(1)"' + (_prayerPage >= pages - 1 ? ' disabled' : '') + '>Next &raquo;</button>';
      h += '</div>';
    }
    return h;
  }

  function _prayerPageNav(delta) {
    _prayerPage += delta;
    var panel = document.getElementById('flock-p-prayer');
    if (panel) panel.innerHTML = _buildPrayerPanel(_cache.allPrayer || []);
  }

  async function showUnassignedPrayers() {
    var el = _hubEl();
    if (!el) return;
    el.innerHTML = '<div class="fp-editor">'
      + '<div class="fp-topbar">'
      + '<button class="fp-back" onclick="TheLife.backToHub()">← Back to My Flock</button>'
      + '<h2 class="fp-title">Unassigned Prayer Requests</h2>'
      + '</div>'
      + '<div id="fp-body">' + _spinner() + '</div></div>';
    var _m = document.getElementById('main'); if (_m) _m.scrollTop = 0;

    try {
      var dir = await _ensureDir();
      var allPrayers = _cache.allPrayer || [];

      var unassigned = allPrayers.filter(function(r) {
        var st = (r.status || r['Status'] || '').toLowerCase();
        return st !== 'answered' && st !== 'closed' && !(r.assignedTo || r['Assigned To']);
      });

      var _lpMember = _findLP(dir);
      var _lpId   = _lpMember ? (_lpMember.memberPin || _lpMember.id || _lpMember.email) : '';
      var _lpName = _lpMember ? (_lpMember.preferredName || ((_lpMember.firstName || '') + ' ' + (_lpMember.lastName || '')).trim()) : '';

      if (!unassigned.length) {
        (document.getElementById('fp-body') || {}).innerHTML = '<div style="padding:40px;text-align:center;">'
          + '<div style="font-size:2rem;margin-bottom:12px;">🎉</div>'
          + '<p style="color:var(--ink-muted);font-size:0.9rem;">All prayer requests are assigned!</p></div>';
        return;
      }

      var html = '<div style="max-width:860px;">';

      if (_lpId) {
        html += '<div style="background:rgba(var(--accent-rgb,99,102,241),0.1);border:1px solid var(--accent);border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">'
          + '<div style="font-size:0.88rem;color:var(--ink);">'
          + '<strong>' + unassigned.length + ' request' + (unassigned.length !== 1 ? 's' : '') + '</strong> have no assigned pastor.'
          + (_lpName ? ' Auto-assign all to <strong>' + _e(_lpName) + '</strong> (Lead Pastor)?' : '')
          + '</div>'
          + '<button type="button" onclick="TheLife._autoAssignPrayersToLP()" class="fp-action-btn" style="background:var(--accent);color:var(--ink-inverse);border-color:var(--accent);font-weight:600;white-space:nowrap;">'
          + '👤 Auto-Assign All to ' + _e(_lpName || 'Lead Pastor') + '</button>'
          + '</div>';
      }

      html += '<div class="flock-card-grid">';
      unassigned.forEach(function(r) {
        var rid  = _e(String(r.id || r.ID || ''));
        var name = _e(r.submitterName || r['Submitter Name'] || 'Anonymous');
        var prayer = r.prayerText || r['Prayer Text'] || '';
        var status = r.status || r['Status'] || 'New';
        var isConf = String(r.isConfidential || r['Is Confidential'] || '').toUpperCase() === 'TRUE';
        var isFU   = String(r.followUpRequested || r['Follow-Up Requested'] || '').toUpperCase() === 'TRUE';
        var pills  = _statusBadge(status);
        if (isConf) pills += ' <span class="badge badge-warn">🔒 Confidential</span>';
        if (isFU)   pills += ' <span class="badge badge-danger">Follow-up</span>';
        html += _flockCard({
          name: name,
          pills: pills,
          body: _e(prayer.length > 200 ? prayer.substring(0, 200) + '…' : prayer),
          date: r.submittedAt || r['Submitted At'] || '',
          onclick: "TheLife.openPrayer('" + rid + "')"
        });
      });
      html += '</div></div>';

      (document.getElementById('fp-body') || {}).innerHTML = html;
    } catch (e) {
      (document.getElementById('fp-body') || {}).innerHTML = _errHtml(e.message);
    }
  }

  async function _autoAssignPrayersToLP() {
    var btn = document.querySelector('[onclick="TheLife._autoAssignPrayersToLP()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Assigning…'; }

    var dir = await _ensureDir();
    var _lpMember = _findLP(dir);
    if (!_lpMember) { _toast('Lead Pastor not found in member directory.', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Auto-Assign All to Lead Pastor'; } return; }
    var _lpId = _lpMember.memberPin || _lpMember.id || _lpMember.email;

    var allPrayers = _cache.allPrayer || [];
    var unassigned = allPrayers.filter(function(r) {
      var st = (r.status || r['Status'] || '').toLowerCase();
      return st !== 'answered' && st !== 'closed' && !(r.assignedTo || r['Assigned To']);
    });

    try {
      await Promise.all(unassigned.map(function(r) {
        var id = r.id || r.ID;
        return _isFB() ? UpperRoom.updatePrayer(id, { assignedTo: _lpId }) : TheVine.flock.prayer.update({ id: id, assignedTo: _lpId });
      }));
      unassigned.forEach(function(r) { r.assignedTo = _lpId; });
      _toast(unassigned.length + ' request' + (unassigned.length !== 1 ? 's' : '') + ' assigned to Lead Pastor.');
      showUnassignedPrayers();
    } catch (err) {
      _toast('Error: ' + (err.message || err), 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Auto-Assign All to Lead Pastor'; }
    }
  }

  function _buildCompassionPanel(rows) {
    if (!rows.length) return _flockEmpty('\u2665', 'No compassion requests.');
    var h = '<div class="flock-actions">'
      + '<button class="primary" onclick="TheLife.openCompassion()">+ New Request</button></div>';
    h += '<div class="flock-card-grid">';
    rows.forEach(function(r) {
      var amt = r.amountRequested || r.amount ? '$' + Number(r.amountRequested || r.amount || 0).toFixed(2) : '';
      h += _flockCard({
        name: _e(r.requesterName || r.memberName || r.name || ''),
        pills: _statusBadge(r.status) + (r.urgency ? ' ' + _statusBadge(r.urgency) : ''),
        body: _e((r.requestType || r.type || '') + (amt ? ' \u2014 ' + amt : '')
          + (r.description ? ' \u2014 ' + r.description.substring(0, 100) : '')),
        assigned: _memberName(r.assignedTo) || r.assignedName || '',
        date: r.createdAt || '',
        priority: r.urgency,
        onclick: "TheLife.openCompassion('" + _e(r.id) + "')"
      });
    });
    h += '</div>';
    return h;
  }

  function _buildOutreachPanel(rows) {
    var h = '<div class="flock-actions">'
      + '<button class="primary" onclick="TheLife.openOutreach()">+ Add Contact</button></div>';
    if (!rows.length) {
      h += _flockEmpty('\u261E', 'No outreach contacts yet. Tap \u201C+ Add Contact\u201D to get started.');
      return h;
    }
    h += '<div class="flock-card-grid">';
    rows.forEach(function(r) {
      h += _flockCard({
        name: _e(r.name || [r.firstName, r.lastName].filter(Boolean).join(' ')),
        pills: _statusBadge(r.stage || r.status || ''),
        body: _e((r.source ? 'Source: ' + r.source : '')
          + (r.campaignName ? ' \u00B7 Campaign: ' + r.campaignName : '')),
        assigned: _memberName(r.assignedTo) || '',
        date: r.createdAt || '',
        extra: (r.phone ? _phoneActions(r.phone) : ''),
        onclick: "TheLife.openOutreach('" + _e(r.id) + "')"
      });
    });
    h += '</div>';
    return h;
  }

  function _buildNotesPanel(careRows, prayerRows, compassionRows) {
    var notes = [];
    var _notesAdmin = _canViewNotes();
    careRows.forEach(function(c) {
      if (_notesAdmin && (c.notes || c.summary)) {
        notes.push({
          type: 'Care', icon: '\u2764\uFE0F',
          name: _memberName(c.memberId) || c.memberName || c.party1 || c.memberId || '',
          text: c.notes || c.summary || '',
          date: c.updatedAt || c.createdAt || '',
          id: c.id,
          editFn: "TheLife.openCareCase('" + _e(c.id) + "')"
        });
      } else if (!_notesAdmin && c.summary) {
        notes.push({
          type: 'Care', icon: '\u2764\uFE0F',
          name: _memberName(c.memberId) || c.memberName || c.party1 || c.memberId || '',
          text: c.summary,
          date: c.updatedAt || c.createdAt || '',
          id: c.id,
          editFn: "TheLife.openCareCase('" + _e(c.id) + "')"
        });
      }
    });
    prayerRows.forEach(function(r) {
      var pt = r.prayerText || r['Prayer Text'] || '';
      if (pt) {
        notes.push({
          type: 'Prayer', icon: '\uD83D\uDE4F',
          name: r.submitterName || r['Submitter Name'] || 'Anonymous',
          text: pt,
          date: r.submittedAt || r['Submitted At'] || '',
          id: r.id || r.ID || '',
          editFn: "TheLife.openPrayer('" + _e(r.id || r.ID || '') + "')"
        });
      }
    });
    compassionRows.forEach(function(r) {
      if (r.resolutionNotes || r.description) {
        notes.push({
          type: 'Compassion', icon: '\u2665',
          name: r.requesterName || r.memberName || '',
          text: r.resolutionNotes || r.description || '',
          date: r.updatedAt || r.createdAt || '',
          id: r.id,
          editFn: "TheLife.openCompassion('" + _e(r.id) + "')"
        });
      }
    });
    notes.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    if (!notes.length) return _flockEmpty('\uD83D\uDCDD', 'No pastoral notes yet.');

    var h = '<div style="max-width:720px;">';
    notes.forEach(function(n) {
      h += '<div class="flock-note" onclick="' + n.editFn + '" style="cursor:pointer;">';
      h += '<div class="flock-note-head">'
        + '<span>' + n.icon + ' <strong>' + _e(n.name) + '</strong> \u00B7 ' + _badge(n.type, 'info') + '</span>'
        + '<span>' + _e(n.date) + '</span></div>';
      h += '<div class="flock-note-body">' + _e(n.text.length > 300 ? n.text.substring(0, 300) + '\u2026' : n.text) + '</div>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  function _buildDiscipleshipPanel(rows) {
    if (!rows.length) return _flockEmpty('\u2720', 'No discipleship paths.');
    var h = '<div class="flock-card-grid">';
    rows.forEach(function(r) {
      h += _flockCard({
        name: _e(r.name || r.title || ''),
        pills: _statusBadge(r.status || '') + (r.level ? ' ' + _badge(r.level, 'info') : ''),
        body: _e('Steps: ' + (r.stepCount || 0) + ' \u00B7 Enrolled: ' + (r.enrolledCount || 0)
          + (r.description ? '\n' + r.description.substring(0, 100) : '')),
        date: r.createdAt || ''
      });
    });
    h += '</div>';
    return h;
  }

  function _buildActivityPanel(careRows, prayerRows, compassionRows, outreachRows) {
    // Unified activity feed — all recent actions across all domains
    var items = [];
    careRows.forEach(function(c) {
      items.push({
        type: 'Care',
        icon: '\u2764\uFE0F',
        title: _memberName(c.memberId) || c.memberName || '',
        detail: (c.careType || '') + ' \u2014 ' + (c.status || ''),
        date: c.updatedAt || c.createdAt || '',
        onclick: "TheLife.openCareCase('" + _e(c.id) + "')"
      });
    });
    prayerRows.slice(0, 20).forEach(function(r) {
      items.push({
        type: 'Prayer',
        icon: '\uD83D\uDE4F',
        title: r.submitterName || r['Submitter Name'] || 'Anonymous',
        detail: (r.status || r['Status'] || 'New'),
        date: r.submittedAt || r['Submitted At'] || '',
        onclick: "TheLife.openPrayer('" + _e(r.id || r.ID || '') + "')"
      });
    });
    compassionRows.forEach(function(r) {
      items.push({
        type: 'Compassion',
        icon: '\u2665',
        title: r.requesterName || r.memberName || '',
        detail: (r.requestType || '') + ' \u2014 ' + (r.status || ''),
        date: r.updatedAt || r.createdAt || '',
        onclick: "TheLife.openCompassion('" + _e(r.id) + "')"
      });
    });
    outreachRows.slice(0, 20).forEach(function(r) {
      items.push({
        type: 'Outreach',
        icon: '\u261E',
        title: [r.firstName, r.lastName].filter(Boolean).join(' ') || r.name || '',
        detail: (r.source || '') + ' \u2014 ' + (r.status || r.stage || ''),
        date: r.updatedAt || r.createdAt || '',
        onclick: "TheLife.openOutreach('" + _e(r.id) + "')"
      });
    });

    items.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    if (!items.length) return _flockEmpty('\uD83D\uDCC5', 'No recent activity.');

    var h = '<div class="fp-timeline" style="max-width:800px;">';
    items.slice(0, 50).forEach(function(it) {
      h += '<div class="fp-timeline-item" onclick="' + (it.onclick || '') + '" style="cursor:pointer;">'
        + '<div class="fp-timeline-dot"></div>'
        + '<div class="fp-timeline-content">'
        + '<div class="fp-timeline-head">'
        + '<span class="fp-timeline-type">' + it.icon + ' ' + _e(it.type) + '</span>'
        + '<span class="fp-timeline-date">' + _e(it.date) + '</span>'
        + '</div>'
        + '<div class="fp-timeline-body"><strong>' + _e(it.title) + '</strong> \u00B7 ' + _e(it.detail) + '</div>'
        + '</div></div>';
    });
    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FOLLOW-UPS DUE (sub-view within hub)
  // ══════════════════════════════════════════════════════════════════════════

  async function showUnassignedCases() {
    var el = _hubEl();
    if (!el) return;
    el.innerHTML = '<div class="fp-editor">'
      + '<div class="fp-topbar">'
      + '<button class="fp-back" onclick="TheLife.backToHub()">← Back to My Flock</button>'
      + '<h2 class="fp-title">Unassigned Care Cases</h2>'
      + '</div>'
      + '<div id="fp-body">' + _spinner() + '</div></div>';
    var _m = document.getElementById('main'); if (_m) _m.scrollTop = 0;

    try {
      var dir = await _ensureDir();
      var allCases = _cache.care || [];
      if (!allCases.length) {
        var listRes = await (_isFB() ? UpperRoom.listCareCases({}) : TheVine.flock.care.list({}));
        allCases = _rows(listRes);
        _cache.care = allCases;
      }

      var unassigned = allCases.filter(function(c) {
        var st = (c.status || '').toLowerCase();
        return st !== 'resolved' && st !== 'closed' && !c.primaryCaregiverId && !c.assignedTo;
      });

      // Find lead pastor
      var staffDir = _staffOpts(dir).filter(function(o) { return o.value; });
      var _lpMember = _findLP(dir);
      var _lpId   = _lpMember ? (_lpMember.memberPin || _lpMember.id || _lpMember.email) : '';
      var _lpName = _lpMember ? (_lpMember.preferredName || ((_lpMember.firstName || '') + ' ' + (_lpMember.lastName || '')).trim()) : '';

      if (!unassigned.length) {
        (document.getElementById('fp-body') || {}).innerHTML = '<div style="padding:40px;text-align:center;">'
          + '<div style="font-size:2rem;margin-bottom:12px;">🎉</div>'
          + '<p style="color:var(--ink-muted);font-size:0.9rem;">All care cases are assigned!</p></div>';
        return;
      }

      var html = '<div style="max-width:860px;">';

      // Auto-assign banner
      if (_lpId) {
        html += '<div style="background:rgba(var(--accent-rgb,99,102,241),0.1);border:1px solid var(--accent);border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">'
          + '<div style="font-size:0.88rem;color:var(--ink);">'
          + '<strong>' + unassigned.length + ' case' + (unassigned.length !== 1 ? 's' : '') + '</strong> have no assigned caregiver.'
          + (_lpName ? ' Auto-assign all to <strong>' + _e(_lpName) + '</strong> (Lead Pastor)?' : '')
          + '</div>'
          + '<button type="button" onclick="TheLife._autoAssignToLP()" class="fp-action-btn" style="background:var(--accent);color:var(--ink-inverse);border-color:var(--accent);font-weight:600;white-space:nowrap;">'
          + '👤 Auto-Assign All to ' + _e(_lpName || 'Lead Pastor') + '</button>'
          + '</div>';
      }

      html += '<div class="flock-card-grid">';
      unassigned.forEach(function(c) {
        html += _flockCard({
          name: _e(_memberName(c.memberId) || c.memberName || c.party1 || c.memberId || '(Unknown)'),
          pills: _statusBadge(c.priority || 'Normal') + _statusBadge(c.status),
          body: _e((c.careType || '') + (c.summary ? ' — ' + c.summary.substring(0, 120) : '')),
          date: c.createdAt || '',
          priority: c.priority,
          onclick: "TheLife.openCareCase('" + _e(c.id) + "')"
        });
      });
      html += '</div></div>';

      (document.getElementById('fp-body') || {}).innerHTML = html;
    } catch (e) {
      (document.getElementById('fp-body') || {}).innerHTML = _errHtml(e.message);
    }
  }

  async function _autoAssignToLP() {
    var btn = document.querySelector('[onclick="TheLife._autoAssignToLP()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Assigning…'; }

    var dir = await _ensureDir();
    var _lpMember = _findLP(dir);
    if (!_lpMember) { _toast('Lead Pastor not found in member directory.', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Auto-Assign All to Lead Pastor'; } return; }
    var _lpId = _lpMember.memberPin || _lpMember.id || _lpMember.email;

    var allCases = _cache.care || [];
    var unassigned = allCases.filter(function(c) {
      var st = (c.status || '').toLowerCase();
      return st !== 'resolved' && st !== 'closed' && !c.primaryCaregiverId && !c.assignedTo;
    });

    try {
      await Promise.all(unassigned.map(function(c) {
        var upd = { primaryCaregiverId: _lpId, assignedTo: _lpId, status: c.status || 'Open' };
        return _isFB() ? UpperRoom.updateCareCase(Object.assign({ id: c.id }, upd)) : TheVine.flock.care.update(Object.assign({ id: c.id }, upd));
      }));
      // Refresh cache
      unassigned.forEach(function(c) { c.primaryCaregiverId = _lpId; c.assignedTo = _lpId; });
      _toast(unassigned.length + ' case' + (unassigned.length !== 1 ? 's' : '') + ' assigned to Lead Pastor.');
      showUnassignedCases();
    } catch (err) {
      _toast('Error: ' + (err.message || err), 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Auto-Assign All to Lead Pastor'; }
    }
  }

  async function _autoAssignCasesToLP() {
    var dir = await _ensureDir();
    var _lpMember = _findLP(dir);
    if (!_lpMember) { _toast('Lead Pastor not found in member directory. Ensure a member has the "Lead Pastor" group assigned.', 'error'); return; }
    var _lpId   = _lpMember.memberPin || _lpMember.id || _lpMember.email;
    var _lpName = _lpMember.preferredName || ((_lpMember.firstName || '') + ' ' + (_lpMember.lastName || '')).trim();

    var allCases = _cache.care || [];
    var unassigned = allCases.filter(function(c) {
      var st = (c.status || '').toLowerCase();
      return st !== 'resolved' && st !== 'closed' && !c.primaryCaregiverId && !c.assignedTo;
    });

    if (!unassigned.length) { _toast('All care cases are already assigned!'); return; }

    try {
      await Promise.all(unassigned.map(function(c) {
        var upd = { primaryCaregiverId: _lpId, assignedTo: _lpId, status: c.status || 'Open' };
        return _isFB() ? UpperRoom.updateCareCase(Object.assign({ id: c.id }, upd)) : TheVine.flock.care.update(Object.assign({ id: c.id }, upd));
      }));
      unassigned.forEach(function(c) { c.primaryCaregiverId = _lpId; c.assignedTo = _lpId; });
      _toast(unassigned.length + ' case' + (unassigned.length !== 1 ? 's' : '') + ' assigned to ' + (_lpName || 'Lead Pastor') + '.');
      refresh();
    } catch (err) {
      _toast('Error: ' + (err.message || err), 'error');
    }
  }

  async function showFollowUps() {
    var el = _hubEl();
    if (!el) return;
    el.innerHTML = '<div class="fp-editor">'
      + '<div class="fp-topbar">'
      + '<button class="fp-back" onclick="TheLife.backToHub()">\u2190 Back to My Flock</button>'
      + '<h2 class="fp-title">Follow-Ups Due</h2>'
      + '</div>'
      + '<div id="fp-body">' + _spinner() + '</div></div>';
    var _m = document.getElementById('main'); if (_m) _m.scrollTop = 0;

    try {
      var _r = await Promise.all([_isFB() ? UpperRoom.careFollowUpsDue() : TheVine.flock.care.followUps.due(), _ensureDir()]);
      var res = _r[0];
      var rows = _rows(res);

      if (!rows.length) {
        (document.getElementById('fp-body') || {}).innerHTML = '<div style="padding:40px;text-align:center;">'
          + '<div style="font-size:2rem;margin-bottom:12px;">\uD83C\uDF89</div>'
          + '<p style="color:var(--ink-muted);font-size:0.9rem;">No follow-ups due. Great work!</p></div>';
        return;
      }

      var html = '<div style="max-width:800px;">';
      html += '<table style="width:100%;font-size:0.82rem;border-collapse:collapse;">';
      html += '<thead><tr style="border-bottom:2px solid var(--line);">'
        + '<th style="text-align:left;padding:10px 8px;">Member</th>'
        + '<th style="text-align:left;padding:10px 8px;">Type</th>'
        + '<th style="text-align:left;padding:10px 8px;">Due Date</th>'
        + '<th style="text-align:left;padding:10px 8px;">Assigned To</th>'
        + '</tr></thead><tbody>';
      rows.forEach(function(r) {
        html += '<tr style="border-top:1px solid var(--line);">'
          + '<td style="padding:8px;">' + _e(r.memberName || r.email || '') + '</td>'
          + '<td style="padding:8px;">' + _e(r.type || '') + '</td>'
          + '<td style="padding:8px;">' + _e(r.dueDate || r.due || '') + '</td>'
          + '<td style="padding:8px;">' + _e(_memberName(r.assignedTo) || '') + '</td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
      (document.getElementById('fp-body') || {}).innerHTML = html;
    } catch (e) {
      (document.getElementById('fp-body') || {}).innerHTML = _errHtml(e.message);
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // NAVIGATION
  // ══════════════════════════════════════════════════════════════════════════

  function backToHub() {
    var el = _hubEl();
    if (el) {
      el.dataset.loaded = '';
      Modules.render(_fpEditorSource, el, Nehemiah.getSession());
    }
    _fpEditorSource = 'my-flock'; // reset after navigating back
    var _m = document.getElementById('main'); if (_m) _m.scrollTop = 0;
  }

  // Legacy alias — LoveInAction removed; all care flows now live in My Flock
  function backToLoveInAction() { backToHub(); }

  // ══════════════════════════════════════════════════════════════════════════
  // CARE HUB — inline tabbed view (replaces the removed love_in_action.js)
  // Tabs: Care Cases · Prayer · Compassion · Outreach · Assignments · Follow-Ups
  // ══════════════════════════════════════════════════════════════════════════

  var _careHubTab         = 'care';
  var _careHubAssignments = [];
  var _careHubFollowups   = [];
  var _careHubLoadingAsgn = false;
  var _careHubLoadingFU   = false;

  function _renderCareHub(container, tab) {
    _careHubTab         = tab || 'care';
    _careHubAssignments = [];
    _careHubFollowups   = [];
    _careHubLoadingAsgn = false;
    _careHubLoadingFU   = false;

    var d             = _flockData;
    var allCare       = d.allCare       || [];
    var allPrayer     = d.allPrayer     || [];
    var allCompassion = d.allCompassion || [];
    var allOutreach   = d.allOutreach   || [];

    var h = '<div class="fp-editor">';
    h += '<div class="fp-topbar"><button class="fp-back" onclick="TheLife.backToHub()">\u2190 My Flock</button>'
       + '<h2 class="fp-title">\u2764\uFE0F Care \u0026 Outreach</h2>'
       + '<button onclick="TheLife._careSummaryPrint()" style="margin-left:auto;background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;padding:6px 14px;font-weight:600;font-size:0.78rem;cursor:pointer;font-family:inherit;">📦 Print Summary</button>'
       + '</div>';

    // KPI strip
    h += '<div class="flock-kpi-row" style="margin-bottom:14px;">';
    h += _flockKpi(allCare.length,       'Care Cases',  allCare.length        ? 'warn'   : 'success', "TheLife._careHubSwitch('care')");
    h += _flockKpi(allPrayer.length,     'Prayers',     allPrayer.length      ? 'danger' : 'success', "TheLife._careHubSwitch('prayer')");
    h += _flockKpi(allCompassion.length, 'Compassion',  allCompassion.length  ? 'warn'   : 'success', "TheLife._careHubSwitch('compassion')");
    h += _flockKpi(allOutreach.length,   'Outreach',    'accent',                                     "TheLife._careHubSwitch('outreach')");
    h += '</div>';

    // Search
    h += '<div style="margin-bottom:14px;">'
       + '<input id="care-hub-q" type="search" placeholder="Search cases, names, notes\u2026"'
       + ' oninput="TheLife._careHubSearch(this.value)"'
       + ' style="width:100%;max-width:480px;background:rgba(255,255,255,0.07);border:1px solid var(--line);'
       + 'border-radius:6px;padding:8px 12px;color:var(--ink);font-size:0.88rem;font-family:inherit;"></div>';

    // Tab bar
    var _chTabs = [
      { key: 'care',        label: '\u2764\uFE0F Care',       ct: allCare.length },
      { key: 'prayer',      label: '\uD83D\uDE4F Prayer',     ct: allPrayer.length },
      { key: 'compassion',  label: '\u2665 Compassion',       ct: allCompassion.length },
      { key: 'outreach',    label: '\u261E Outreach',         ct: allOutreach.length },
      { key: 'assignments', label: '\uD83D\uDC65 Assignments',ct: 0 },
      { key: 'followups',   label: '\u23F0 Follow-Ups',       ct: 0 },
    ];
    h += '<div style="display:flex;gap:2px;border-bottom:2px solid var(--line);margin-bottom:16px;overflow-x:auto;-webkit-overflow-scrolling:touch;">';
    _chTabs.forEach(function(t) {
      var active = t.key === _careHubTab;
      h += '<button class="flock-tab' + (active ? ' active' : '') + '" id="care-hub-tab-' + t.key + '"'
         + ' onclick="TheLife._careHubSwitch(\'' + t.key + '\')">'
         + t.label + (t.ct > 0 ? ' <span style="font-size:0.72rem;opacity:.7;">(' + t.ct + ')</span>' : '')
         + '</button>';
    });
    h += '</div>';

    // Panels
    h += '<div id="care-hub-panels">';
    _chTabs.forEach(function(t) {
      h += '<div id="care-hub-p-' + t.key + '" style="' + (t.key !== _careHubTab ? 'display:none;' : '') + '">';
      if (t.key === 'care')       h += _buildCarePanel(allCare);
      else if (t.key === 'prayer')      h += _buildPrayerPanel(allPrayer);
      else if (t.key === 'compassion')  h += _buildCompassionPanel(allCompassion);
      else if (t.key === 'outreach')    h += _buildOutreachPanel(allOutreach);
      // assignments & followups are lazy-loaded on first tab click
      h += '</div>';
    });
    h += '</div></div>';

    container.innerHTML = h;
    var _m = document.getElementById('main'); if (_m) _m.scrollTop = 0;

    if (_careHubTab === 'assignments') _careHubLazyLoad('assignments');
    else if (_careHubTab === 'followups') _careHubLazyLoad('followups');
  }

  function _careHubSwitch(key) {
    _careHubTab = key;
    document.querySelectorAll('[id^="care-hub-tab-"]').forEach(function(btn) {
      btn.classList.toggle('active', btn.id === 'care-hub-tab-' + key);
    });
    document.querySelectorAll('[id^="care-hub-p-"]').forEach(function(panel) {
      panel.style.display = (panel.id === 'care-hub-p-' + key) ? '' : 'none';
    });
    if (key === 'assignments' || key === 'followups') {
      var panel = document.getElementById('care-hub-p-' + key);
      if (panel && !panel.innerHTML.trim()) _careHubLazyLoad(key);
    }
    _audit('care-hub.tab', 'CareHub', key, 'Switched to ' + key);
  }

  async function _careHubLazyLoad(key) {
    var panel = document.getElementById('care-hub-p-' + key);
    if (panel) panel.innerHTML = _spinner();
    try {
      if (key === 'assignments') {
        _careHubLoadingAsgn = true;
        var r = await (_isFB() ? UpperRoom.listCareAssignments({ limit: 80 }) : TheVine.flock.care.assignments.list({ limit: 80 }));
        _careHubAssignments = _filterClosed(_rows(r));
        if (panel) panel.innerHTML = _buildCareAssignmentsTable(_careHubAssignments);
        _careHubLoadingAsgn = false;
      } else {
        _careHubLoadingFU = true;
        var r2 = await (_isFB() ? UpperRoom.careFollowUpsDue() : TheVine.flock.care.followUps.due());
        _careHubFollowups = _rows(r2);
        if (panel) panel.innerHTML = _buildCareFollowUpsTable(_careHubFollowups);
        _careHubLoadingFU = false;
      }
    } catch (e) {
      if (panel) panel.innerHTML = '<div style="padding:20px;color:var(--danger);font-size:0.88rem;">Failed to load: ' + _e(e.message) + '</div>';
      _careHubLoadingAsgn = false;
      _careHubLoadingFU   = false;
    }
  }

  function _careHubSearch(q) {
    q = (q || '').toLowerCase().trim();
    document.querySelectorAll('.care-hub-row').forEach(function(r) {
      r.style.display = (!q || (r.dataset.search || '').indexOf(q) >= 0) ? '' : 'none';
    });
  }

  function _buildCareAssignmentsTable(rows) {
    var h = '<div style="margin-bottom:14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      + '<label style="font-size:0.8rem;color:var(--ink-muted);">Filter by member:</label>'
      + '<input id="care-asgn-member" type="text" placeholder="Member ID or email"'
      + ' style="padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:rgba(255,255,255,0.07);color:var(--ink);font-size:0.8rem;font-family:inherit;min-width:180px;">'
      + '<button onclick="TheLife._careHubSearchAssignments()"'
      + ' style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;padding:6px 14px;font-size:0.8rem;cursor:pointer;font-family:inherit;">Search</button>'
      + '</div>';
    if (!rows.length) return h + _flockEmpty('\uD83D\uDC65', 'No care assignments found.');
    h += '<div style="overflow-x:auto;"><table class="data-table"><thead><tr>';
    ['Member', 'Caregiver', 'Type', 'Status', 'Assigned On', 'Actions'].forEach(function(col) {
      h += '<th>' + _e(col) + '</th>';
    });
    h += '</tr></thead><tbody>';
    rows.forEach(function(r) {
      var id       = _e(String(r.id || ''));
      var isOpen   = !/^(ended|closed|complete|inactive|reassigned)$/i.test(r.status || '');
      var openCase = (_flockData.allCare || []).find(function(c) {
        return c.memberId === r.memberId && !/^(resolved|closed|archived)$/i.test(c.status || '');
      });
      var caseId   = openCase ? _e(openCase.id) : '';
      h += '<tr>'
        + '<td>' + (caseId
          ? '<a href="#" onclick="TheLife.openCareCase(\'' + caseId + '\');return false;" style="color:var(--accent);text-decoration:none;font-weight:600;">' + _e(_memberName(r.memberId) || r.memberId || '') + '</a>'
          : _e(_memberName(r.memberId) || r.memberId || '')) + '</td>'
        + '<td>' + _e(_memberName(r.caregiverId) || r.caregiverId || '') + '</td>'
        + '<td>' + _e(r.role || '') + '</td>'
        + '<td>' + _statusBadge(r.status || 'Active') + '</td>'
        + '<td>' + _e(r.startDate || r.createdAt || '') + '</td>'
        + '<td>';
      if (caseId) h += '<button onclick="TheLife.openCareCase(\'' + caseId + '\')" style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:5px;padding:3px 7px;font-size:0.73rem;cursor:pointer;margin-right:3px;font-family:inherit;">Open Case</button>';
      h += isOpen
        ? '<button onclick="TheLife._careHubReassign(\'' + id + '\')" style="background:none;border:1px solid var(--line);border-radius:5px;padding:3px 7px;font-size:0.73rem;cursor:pointer;margin-right:3px;font-family:inherit;">Reassign</button>'
          + '<button onclick="TheLife._careHubEndAssignment(\'' + id + '\')" style="background:var(--danger);color:#fff;border:none;border-radius:5px;padding:3px 7px;font-size:0.73rem;cursor:pointer;font-family:inherit;">End</button>'
        : '<span style="color:var(--ink-muted);font-size:0.76rem;">Closed</span>';
      h += '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function _buildCareFollowUpsTable(rows) {
    if (!rows.length) return _flockEmpty('\u23F0', 'No pending follow-up interactions.');
    var h = '<div style="overflow-x:auto;"><table class="data-table"><thead><tr>';
    ['Member', 'Caregiver', 'Due / Date', 'Notes', 'Status', 'Action'].forEach(function(col) {
      h += '<th>' + _e(col) + '</th>';
    });
    h += '</tr></thead><tbody>';
    rows.forEach(function(r) {
      var id            = _e(String(r.id || ''));
      var done          = r.followUpDone || /^(done|completed|complete)$/i.test(r.status || '');
      var notes         = r.notes || r.summary || '';
      var caseRec       = (_flockData.allCare || []).find(function(c) { return c.id === r.caseId; }) || {};
      var memberName    = _memberName(caseRec.memberId) || caseRec.memberName || r.memberName || r.caseId || '';
      var caregiverName = _memberName(r.caregiverId) || r.caregiverName || r.caregiver || r.createdBy || '';
      h += '<tr>'
        + '<td>' + _e(memberName) + '</td>'
        + '<td>' + _e(caregiverName) + '</td>'
        + '<td>' + _e(r.followUpDate || r.date || r.interactionDate || '') + '</td>'
        + '<td>' + _e(notes.length > 60 ? notes.substring(0, 60) + '\u2026' : notes) + '</td>'
        + '<td>' + _statusBadge(done ? 'Done' : (r.status || 'Pending')) + '</td>'
        + '<td>' + (done
          ? '<span style="color:var(--ink-muted);font-size:0.76rem;">Done</span>'
          : '<button onclick="TheLife._careHubFollowUpDone(\'' + id + '\')" style="background:var(--success);color:#fff;border:none;border-radius:5px;padding:3px 10px;font-size:0.76rem;cursor:pointer;font-family:inherit;">Done</button>')
        + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  async function _careHubSearchAssignments() {
    var inp = document.getElementById('care-asgn-member');
    var memberId = inp ? inp.value.trim() : '';
    if (!memberId) return;
    try {
      var res = await (_isFB() ? UpperRoom.careAssignmentsForMember(memberId) : TheVine.flock.care.assignments.forMember({ memberId: memberId }));
      _careHubAssignments = _rows(res);
      var panel = document.getElementById('care-hub-p-assignments');
      if (panel) panel.innerHTML = _buildCareAssignmentsTable(_careHubAssignments);
    } catch (e) { alert('Search failed: ' + (e.message || e)); }
  }

  async function _careHubReassign(id) {
    var userOpts = [{ value: '', label: '\u2014 Select caregiver \u2014' }];
    try {
      var uRes = await (_isFB() ? UpperRoom.listCaregivers() : TheVine.flock.care.caregivers.list({}));
      (_rows(uRes) || []).forEach(function(u) {
        userOpts.push({ value: u.email, label: (u.displayName || u.email) + ' (' + u.role + ')' });
      });
    } catch (e) { /* fall through */ }
    if (userOpts.length === 1) { alert('No caregivers found to reassign to.'); return; }
    _miniModal('Reassign Care Assignment', [
      { name: 'newCaregiverId', label: 'New Caregiver', type: 'select', options: userOpts, required: true },
      { name: 'notes', label: 'Reason / Notes', type: 'textarea' },
    ], async function(data) {
      if (!data.newCaregiverId) throw new Error('Please select a caregiver.');
      await (_isFB() ? UpperRoom.reassignCareAssignment({ id: id, newCaregiverId: data.newCaregiverId, notes: data.notes }) : TheVine.flock.care.assignments.reassign({ id: id, newCaregiverId: data.newCaregiverId, notes: data.notes }));
      var res = await (_isFB() ? UpperRoom.listCareAssignments({ limit: 80 }) : TheVine.flock.care.assignments.list({ limit: 80 }));
      _careHubAssignments = _filterClosed(_rows(res));
      var panel = document.getElementById('care-hub-p-assignments');
      if (panel) panel.innerHTML = _buildCareAssignmentsTable(_careHubAssignments);
    });
  }

  async function _careHubEndAssignment(id) {
    var cached = (_careHubAssignments || []).find(function(r) { return String(r.id) === String(id); }) || {};
    var name = cached.memberName || cached.member || 'this member';
    if (!confirm('End care assignment for ' + name + '?')) return;
    try {
      await (_isFB() ? UpperRoom.endCareAssignment(id) : TheVine.flock.care.assignments.end({ id: id }));
      _careHubAssignments = _careHubAssignments.filter(function(r) { return String(r.id) !== String(id); });
      var panel = document.getElementById('care-hub-p-assignments');
      if (panel) panel.innerHTML = _buildCareAssignmentsTable(_careHubAssignments);
    } catch (e) { alert('Failed: ' + (e.message || e)); }
  }

  async function _careHubFollowUpDone(id) {
    try {
      await (_isFB() ? UpperRoom.followUpDoneCareInteraction(id) : TheVine.flock.care.interactions.followUpDone({ id: id }));
      _careHubFollowups = _careHubFollowups.map(function(r) {
        return String(r.id) === String(id) ? Object.assign({}, r, { status: 'done' }) : r;
      });
      var panel = document.getElementById('care-hub-p-followups');
      if (panel) panel.innerHTML = _buildCareFollowUpsTable(_careHubFollowups);
    } catch (e) { alert('Failed: ' + (e.message || e)); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN HUB MODULE RENDER
  // Called by the_tabernacle.js _def('my-flock', ...) delegator
  // ══════════════════════════════════════════════════════════════════════════

  async function renderHub(el, session) {
    _audit('hub.open', 'MyFlock', '', 'Portal opened');
    // Pre-compute capabilities synchronously for immediate header rendering
    var _preIsPastor = Nehemiah.can('my-flock.add-edit-members');
    var _preIsCare   = !_preIsPastor && Nehemiah.can('my-flock');
    // Shell — render header instantly, data loads async
    el.innerHTML =
      '<div class="page-header"><h1>My Flock</h1>'
      + '<p>Pastoral command center \u2014 your dashboard for people, care, community & activity.</p>'
      + '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">'
      + (_preIsPastor ? '<button onclick="Modules.onboardMember()" style="background:var(--accent);color:var(--ink-inverse);border:none;font-weight:600;border-radius:6px;padding:7px 15px;cursor:pointer;font-size:0.83rem;font-family:inherit;">&#128075; Welcome Visitor</button>' : '')
      + (_preIsPastor ? '<button onclick="TheLife.openAddMember()" style="background:none;border:1px solid var(--line);color:var(--ink);border-radius:6px;padding:7px 15px;cursor:pointer;font-size:0.83rem;font-family:inherit;">&#128100;+ Add Member</button>' : '')
      + ((_preIsPastor || _preIsCare) ? '<button onclick="TheLife.openCareCase()" style="background:none;border:1px solid var(--line);color:var(--ink);border-radius:6px;padding:7px 15px;cursor:pointer;font-size:0.83rem;font-family:inherit;">+ New Case</button>' : '')
      + '<button onclick="TheLife.refresh()" style="background:none;border:1px solid var(--line);color:var(--ink);border-radius:6px;padding:7px 15px;cursor:pointer;font-size:0.83rem;font-family:inherit;">\u21BB Refresh</button>'
      + '</div></div><div id="ml-body">'
      + _spinner() + '</div>';

    try {
      var email = (session && session.email) || '';
      if (!email) { _hubBody(_errHtml('Session email not available.')); return; }

      var isPastorPlus = Nehemiah.can('my-flock.full-directory');
      var isCareRole    = !isPastorPlus && Nehemiah.can('my-flock');

      // ── Light data fetch for KPI ribbon ──
      var fetches = [
        isPastorPlus
          ? _fetch('members', () => _isFB() ? UpperRoom.listMembers({ limit: 200 }) : TheVine.flock.call('members.list', { limit: 200 }))
          : isCareRole
            ? _fetch('myFlock', () => _isFB() ? UpperRoom.careAssignmentsMyFlock(email) : TheVine.flock.care.assignments.myFlock({ caregiverId: email }))
            : _fetch('directory', () => _isFB() ? UpperRoom.listMemberCards() : TheVine.flock.memberCards.directory()),
        _fetch('care', () => _isFB() ? UpperRoom.listCareCases({ limit: 100 }) : TheVine.flock.care.list({ limit: 100 })),
        _fetch('followUps', () => _isFB() ? UpperRoom.careFollowUpsDue() : TheVine.flock.care.followUps.due({})),
        _fetch('compassion', () => _isFB() ? UpperRoom.listCompassionRequests({ limit: 50 }) : TheVine.flock.compassion.requests.list({ limit: 50 })),
        _fetch('outreach', () => _isFB() ? UpperRoom.listOutreachContacts({ limit: 50 }) : TheVine.flock.outreach.contacts.list({ limit: 50 })),
        _ensureDir(),
      ];
      // Fire prayer query independently — can be very slow on Firestore cold start
      var _prayerPromise = _fetch('prayer', () => _isFB() ? UpperRoom.listPrayers({ limit: 100, allUsers: true }) : TheVine.flock.prayer.list({ limit: 100 }));

      var results = await Promise.allSettled(fetches);

      var val = function(i) { return results[i].status === 'fulfilled' ? results[i].value : null; };
      var rawFlock      = _rows(val(0));
      var myFlock = isPastorPlus
        ? rawFlock.map(function(m) {
            var name = ((m.preferredName || m.firstName || '') + ' ' + (m.lastName || '')).trim();
            return { memberId: m.id || m.email, memberName: name || m.email || m.id,
                     role: m.membershipStatus || 'Member', startDate: m.memberSince || '',
                     _raw: m };
          })
        : isCareRole
          ? rawFlock.map(function(a) {
              var member = _lookupMember(a.memberId);
              var name = ((member.preferredName || member.firstName || '') + ' ' + (member.lastName || '')).trim();
              return { memberId: a.memberId, memberName: name || a.memberId,
                       role: a.role || 'Member', startDate: a.startDate || '',
                       _raw: member };
            })
          : rawFlock.map(function(c) {
              var name = ((c.firstName || '') + ' ' + (c.lastName || '')).trim();
              return { memberId: c.email || c.memberNumber, memberName: name || c.email || 'Unknown',
                       role: c.cardTitle || 'Member', startDate: '',
                       _raw: c };
            });
      var allCare       = _filterClosed(_rows(val(1)));
      var fuRows        = _rows(val(2));
      var allPrayer     = [];  // placeholder — filled async when prayer query resolves
      var allCompassion = _filterClosed(_rows(val(3)));
      var allOutreach   = _filterClosed(_rows(val(4)));

      if (isPastorPlus && rawFlock.length) {
        _cache.memberDir = rawFlock;
        _memberDirPromise = null;
      } else if (isCareRole) {
        // Restrict member directory to only the user's assigned members
        var _assignedIds = {};
        rawFlock.forEach(function(a) {
          if (a.memberId) _assignedIds[a.memberId] = true;
        });
        _cache.memberDir = (_cache.memberDir || []).filter(function(m) {
          return _assignedIds[m.id] || _assignedIds[m.email] || _assignedIds[m.memberNumber];
        });
        _memberDirPromise = null;
      }

      // Build a set of all known identifiers for the current user
      // so filters match whether the DB stores email, id, or memberNumber.
      var _me = _lookupMember(email);
      var _myIds = [email];
      if (_me.id && _me.id !== email) _myIds.push(_me.id);
      if (_me.memberNumber && _me.memberNumber !== email) _myIds.push(_me.memberNumber);
      if (_me.memberPin && _me.memberPin !== email) _myIds.push(_me.memberPin);
      if (_me.email && _me.email !== email) _myIds.push(_me.email);
      if (_me.primaryEmail && _me.primaryEmail !== email) _myIds.push(_me.primaryEmail);
      function _isMe(val) { return val && _myIds.indexOf(val) !== -1; }

      var myCases = allCare.filter(function(c) {
        return _isMe(c.primaryCaregiverId) || _isMe(c.secondaryCaregiverId)
          || _isMe(c.assignedTo);
      });
      var openCases = myCases.filter(function(c) {
        var s = (c.status || '').toLowerCase();
        return s !== 'resolved' && s !== 'closed';
      });
      var allOpenCases = allCare.filter(function(c) {
        var s = (c.status || '').toLowerCase();
        return s !== 'resolved' && s !== 'closed';
      });
      var newPrayers = allPrayer.filter(function(r) {
        var s = (r.status || r['Status'] || '').toLowerCase();
        return s === 'new' || s === 'pending' || s === 'in progress' || s === '';
      });
      var myPrayers = allPrayer.filter(function(r) {
        return _isMe(r.assignedTo) || _isMe(r.respondedBy);
      });
      var myNewPrayers = myPrayers.filter(function(r) {
        var s = (r.status || r['Status'] || '').toLowerCase();
        return s === 'new' || s === 'pending' || s === 'in progress' || s === '';
      });
      var pendingCompassion = allCompassion.filter(function(r) {
        var s = (r.status || '').toLowerCase();
        return s !== 'resolved' && s !== 'closed' && s !== 'denied';
      });
      var myCompassion = allCompassion.filter(function(r) {
        return _isMe(r.assignedTo) || _isMe(r.caseManagerEmail);
      });
      var myPendingCompassion = myCompassion.filter(function(r) {
        var s = (r.status || '').toLowerCase();
        return s !== 'resolved' && s !== 'closed' && s !== 'denied';
      });
      var myOutreach = allOutreach.filter(function(r) {
        return _isMe(r.assignedTo);
      });

      // Store for full-page editors (they still reference _flockData / _cache)
      _flockData = {
        myFlock: myFlock, allCare: allCare, openCases: openCases, fuRows: fuRows,
        allPrayer: allPrayer, allCompassion: allCompassion, allOutreach: allOutreach,
        newPrayers: newPrayers, pendingCompassion: pendingCompassion,
        allOpenCases: allOpenCases, myNewPrayers: myNewPrayers,
        myPendingCompassion: myPendingCompassion, myOutreach: myOutreach,
        unreadCt: 0, dashboard: {}, myCases: myCases,
        allDisciple: [], isPastorPlus: isPastorPlus, isCareRole: isCareRole,
      };
      _cache.allPrayer = allPrayer;
      _prayerPage = 0;  // reset pagination on fresh data
      _cache.allCompassion = allCompassion;
      _cache.allOutreach = allOutreach;
      _cache.care = Nehemiah.can('care.view-all') ? allCare : myCases;

      var html = '<div class="flock-hub">';

      // ── KPI Ribbon ──────────────────────────────────────────────────
      if (isPastorPlus) {
        // ── All Open row ──
        html += '<div style="font-weight:700;font-size:0.82rem;color:var(--gold,#d4a843);margin:8px 0 4px 2px;letter-spacing:0.03em;">ALL OPEN</div>';
        html += '<div class="flock-kpi-row">';
        html += _flockKpi(myFlock.length, 'Flock', 'accent',
          "TheLife.openApp('people')");
        html += _flockKpi(allOpenCases.length, 'Care Cases',
          allOpenCases.length ? 'warn' : 'success',
          "TheLife.openApp('care','care')");
        html += '<span id="flock-kpi-prayers-all">' + _flockKpi('\u2026', 'Prayers',
          'success',
          "TheLife.openApp('care','prayer')") + '</span>';
        html += _flockKpi(pendingCompassion.length, 'Compassion',
          pendingCompassion.length ? 'warn' : 'success',
          "TheLife.openApp('care','compassion')");
        html += _flockKpi(allOutreach.length, 'Outreach', 'accent',
          "TheLife.openApp('care','outreach')");
        html += '</div>';

        // ── My Open row ──
        var myFuRows = fuRows.filter(function(f) {
          return _isMe(f.assignedTo) || _isMe(f.primaryCaregiverId);
        });
        html += '<div style="font-weight:700;font-size:0.82rem;color:var(--ink-muted,#888);margin:12px 0 4px 2px;letter-spacing:0.03em;">MY OPEN</div>';
        html += '<div class="flock-kpi-row">';
        html += _flockKpi(myFuRows.length, 'Follow-Ups Due',
          myFuRows.length ? 'danger' : 'success',
          "TheLife.openApp('care','followups')");
        html += _flockKpi(openCases.length, 'Care Cases',
          openCases.length ? 'warn' : 'success',
          "TheLife.openApp('care','care')");
        html += '<span id="flock-kpi-prayers-my">' + _flockKpi('\u2026', 'Prayers',
          'success',
          "TheLife.openApp('care','prayer')") + '</span>';
        html += _flockKpi(myPendingCompassion.length, 'Compassion',
          myPendingCompassion.length ? 'warn' : 'success',
          "TheLife.openApp('care','compassion')");
        html += _flockKpi(myOutreach.length, 'Outreach',
          myOutreach.length ? 'accent' : 'success',
          "TheLife.openApp('care','outreach')");
        html += '</div>';
      } else {
        html += '<div class="flock-kpi-row">';
        html += _flockKpi(myFlock.length, isCareRole ? 'My Assigned Flock' : 'Church Directory', 'accent',
          isCareRole ? "TheLife.openApp('care','assignments')" : "TheLife.openApp('people')");
        html += _flockKpi(openCases.length, 'Open Cases',
          openCases.length ? 'warn' : 'success',
          "TheLife.openApp('care','care')");
        html += _flockKpi(fuRows.length, 'Follow-Ups Due',
          fuRows.length ? 'danger' : 'success',
          "TheLife.openApp('care','followups')");
        html += '<span id="flock-kpi-prayers-all">' + _flockKpi('\u2026', 'New Prayers',
          'success',
          "TheLife.openApp('care','prayer')") + '</span>';
        html += _flockKpi(pendingCompassion.length, 'Compassion',
          pendingCompassion.length ? 'warn' : 'success',
          "TheLife.openApp('care','compassion')");
        html += _flockKpi(allOutreach.length, 'Outreach', 'accent',
          "TheLife.openApp('care','outreach')");
        html += '</div>';
      }

      // ── App Launcher Cards (grouped by zone) ────────────────────────
      html += '<div class="dash-zone-label" style="margin-top:20px;">The Courts</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;">';

      html += isPastorPlus ? _appCard('\uD83D\uDC64', 'People', 'Search, view & manage every person in your flock.',
        myFlock.length + ' people', 'people') : '';

      html += _appCard('\uD83D\uDC51', 'The Fold', 'Small groups, Bible studies & attendance tracking.',
        '', 'fold');

      html += '</div>';

      html += '<div class="dash-threshold"><span class="dash-threshold-glyph">\u2726</span></div>';
      html += '<div class="dash-zone-label">The Holy Place</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;">';

      html += _appCard('\u2764\uFE0F', 'Care & Outreach',
        'Care cases, prayer requests, compassion & outreach.',
        openCases.length + ' open cases \u00B7 ' + newPrayers.length + ' prayers', 'care');

      html += _appCard('\u2708', 'Missions',
        'Countries, prayer focus, campaigns, partners & mission teams.',
        '', 'missions');

      html += _appCard('\uD83D\uDCC5', 'Activity Feed', 'Every interaction and touch — logged & tracked.',
        '', 'activity');

      html += '</div>';

      // ── Quick-access: urgent items ─────────────────────────────────
      if (openCases.length || fuRows.length || newPrayers.length) {
        html += '<div style="margin-top:24px;">';
        html += '<h3 style="font-size:0.92rem;color:var(--ink);margin-bottom:12px;">Needs Attention</h3>';

        if (fuRows.length) {
          html += '<div style="margin-bottom:16px;">';
          html += '<h4 class="flock-section-heading" style="color:var(--danger);">\u26A0\uFE0F Follow-Ups Due <span class="flock-section-ct" style="background:var(--danger);">' + fuRows.length + '</span></h4>';
          html += '<div style="display:grid;gap:8px;">';
          fuRows.slice(0, 5).forEach(function(f) {
            var fuName = _memberName(f.memberId) || f.memberName || f.email || f.caseId || '';
            var fuClick = f.caseId ? ' style="cursor:pointer;" onclick="TheLife.openCareCase(\'' + _e(f.caseId) + '\')"' : '';
            html += '<div class="flock-followup-row"' + fuClick + '>'
              + '<span><strong>' + _e(fuName) + '</strong> \u2014 ' + _e(f.interactionType || f.type || 'Follow-up') + '</span>'
              + '<span class="flock-followup-date">' + _e(f.followUpDate || f.dueDate || f.due || '') + '</span></div>';
          });
          if (fuRows.length > 5) html += '<div style="font-size:0.78rem;color:var(--ink-muted);text-align:center;padding:6px;">+ ' + (fuRows.length - 5) + ' more</div>';
          html += '</div></div>';
        }

        if (openCases.length) {
          html += '<div style="margin-bottom:16px;">';
          html += '<h4 class="flock-section-heading">\u2764\uFE0F Open Cases <span class="flock-section-ct">' + openCases.length + '</span></h4>';
          html += '<div class="flock-card-grid">';
          openCases.slice(0, 4).forEach(function(c) {
            html += _flockCard({
              name: _e(_memberName(c.memberId) || c.memberName || c.party1 || c.memberId || ''),
              pills: _statusBadge(c.priority || 'Normal') + _statusBadge(c.status),
              body: _e((c.careType || '') + (c.summary ? ' \u2014 ' + c.summary.substring(0, 100) : '')),
              assigned: _memberName(c.primaryCaregiverId) || c.assignedName || '',
              date: c.createdAt || '',
              priority: c.priority,
              onclick: "TheLife.openCareCase('" + _e(c.id) + "')"
            });
          });
          html += '</div>';
          if (openCases.length > 4) html += '<div style="font-size:0.78rem;color:var(--ink-muted);text-align:center;padding:6px;cursor:pointer;" onclick="TheLife.openApp(\'care\')">See all ' + openCases.length + ' cases \u2192</div>';
          html += '</div>';
        }

        html += '</div>';
      }

      html += '</div>'; // end flock-hub
      _hubBody(html);

      // ── Async prayer KPI backfill ──
      _prayerPromise.then(function(res) {
        var prayerRows = _filterClosedPrayer(_rows(res), 'Status');
        _cache.allPrayer = prayerRows;
        _flockData.allPrayer = prayerRows;

        var newP = prayerRows.filter(function(r) {
          var s = (r.status || r['Status'] || '').toLowerCase();
          return s === 'new' || s === 'pending' || s === 'in progress' || s === '';
        });
        _flockData.newPrayers = newP;

        // Update "ALL OPEN" prayer KPI
        var allEl = document.getElementById('flock-kpi-prayers-all');
        if (allEl) allEl.innerHTML = _flockKpi(newP.length, isPastorPlus ? 'Prayers' : 'New Prayers',
          newP.length ? 'danger' : 'success', "TheLife.openApp('care','prayer')");

        // Update "MY OPEN" prayer KPI (pastor view only)
        if (isPastorPlus) {
          var myP = prayerRows.filter(function(r) {
            return _isMe(r.assignedTo) || _isMe(r.respondedBy);
          });
          var myNewP = myP.filter(function(r) {
            var s = (r.status || r['Status'] || '').toLowerCase();
            return s === 'new' || s === 'pending' || s === 'in progress' || s === '';
          });
          _flockData.myNewPrayers = myNewP;
          _flockData.myPrayers = myP;
          var myEl = document.getElementById('flock-kpi-prayers-my');
          if (myEl) myEl.innerHTML = _flockKpi(myNewP.length, 'Prayers',
            myNewP.length ? 'danger' : 'success', "TheLife.openApp('care','prayer')");
        }
      }).catch(function() {});

      // ── Background: secondary fetches ──
      Promise.allSettled([
        (_isFB() ? UpperRoom.getUnreadCount().then(function(c) { return { count: c }; }) : TheVine.flock.comms.notifications.unreadCount()).catch(function() { return { count: 0 }; }),
        (_isFB() ? UpperRoom.careDashboard() : TheVine.flock.care.dashboard({})).catch(function() { return null; }),
      ]).then(function(sec) {
        var unreadCt = (sec[0].status === 'fulfilled' && sec[0].value) ? (sec[0].value.count || 0) : 0;
        var dashboard = (sec[1].status === 'fulfilled' ? sec[1].value : null) || {};
        _flockData.unreadCt = unreadCt;
        _flockData.dashboard = dashboard;
        if (unreadCt) {
          var kpiRow = document.querySelector('.flock-kpi-row');
          if (kpiRow) {
            kpiRow.insertAdjacentHTML('beforeend',
              _flockKpi(unreadCt, 'Unread Messages', 'danger', "navigate('comms')"));
          }
        }
      });

    } catch (e) { _hubBody(_errHtml(e.message)); }
  }

  // ── App card renderer ──
  function _appCard(icon, title, desc, subtitle, key) {
    return '<div onclick="TheLife.openApp(\'' + key + '\')" style="'
      + 'border:1px solid var(--line);border-radius:12px;padding:20px;cursor:pointer;'
      + 'background:rgba(255,255,255,0.03);transition:all .15s;'
      + '" onmouseover="this.style.borderColor=\'var(--accent)\';this.style.background=\'rgba(255,255,255,0.06)\'"'
      + ' onmouseout="this.style.borderColor=\'var(--line)\';this.style.background=\'rgba(255,255,255,0.03)\'">'
      + '<div style="font-size:1.8rem;margin-bottom:8px;">' + icon + '</div>'
      + '<div style="font-weight:700;font-size:0.95rem;color:var(--ink);margin-bottom:4px;">' + _e(title) + '</div>'
      + '<div style="font-size:0.78rem;color:var(--ink-muted);line-height:1.4;">' + _e(desc) + '</div>'
      + (subtitle ? '<div style="font-size:0.72rem;color:var(--accent);margin-top:8px;font-weight:600;">' + _e(subtitle) + '</div>' : '')
      + '</div>';
  }

  // ── App dispatcher — opens apps inline in #ml-body ──
  function openApp(key, tab) {
    var el = _hubEl();
    if (!el) return;
    var body = el.querySelector('#ml-body') || el;

    switch (key) {
      case 'people':
        if (!Nehemiah.can('my-flock.full-directory')) { _toast('Full directory access is not permitted for your account.', 'error'); return; }
        if (typeof TheShepherd !== 'undefined') TheShepherd.renderApp(body);
        break;
      case 'care':
        _renderCareHub(body, tab || 'care');
        break;
      case 'fold':
        if (typeof TheFold !== 'undefined') TheFold.renderApp(body);
        break;
      case 'activity':
        if (typeof TheScrolls !== 'undefined') TheScrolls.renderApp(body);
        break;
      case 'missions':
        navigate('missions');
        break;
      default:
        break;
    }
    var _m = document.getElementById('main'); if (_m) _m.scrollTop = 0;
  }

  // Render a single tab panel's content
  function _renderPanel(key, myFlock, openCases, fuRows, dashboard, allCare, allPrayer, allCompassion, allOutreach, allDisciple) {
    var p = document.getElementById('flock-p-' + key);
    if (!p) return;
    switch (key) {
      case 'overview':    p.innerHTML = _buildOverview(myFlock, openCases, fuRows, dashboard); break;
      case 'care':        p.innerHTML = _buildCarePanel(allCare); break;
      case 'prayer':      p.innerHTML = _buildPrayerPanel(allPrayer); break;
      case 'compassion':  p.innerHTML = _buildCompassionPanel(allCompassion); break;
      case 'outreach':    p.innerHTML = _buildOutreachPanel(allOutreach); break;
      case 'notes':       p.innerHTML = _buildNotesPanel(allCare, allPrayer, allCompassion); break;
      case 'activity':    p.innerHTML = _buildActivityPanel(allCare, allPrayer, allCompassion, allOutreach); break;
      case 'discipleship': p.innerHTML = _buildDiscipleshipPanel(allDisciple); break;
    }
  }

  function refresh() {
    // Invalidate warm caches so fresh data flows on re-render
    if (typeof TheVine !== 'undefined' && TheVine.cache) {
      ['members','myFlock','care','followUps','prayer','compassion','outreach'].forEach(function(k) {
        TheVine.cache.invalidate('life:' + k);
      });
    }
    _cache = {};
    _memberDirPromise = null;
    var el = document.getElementById('view-my-flock');
    if (el) { el.dataset.loaded = ''; Modules.render('my-flock', el, Nehemiah.getSession()); }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // PERMISSION MATRIX
  // ══════════════════════════════════════════════════════════════════════════

  function _buildPermMatrix(overrides, memberRole) {
    overrides = Array.isArray(overrides) ? overrides : [];
    var ovMap = {};
    overrides.forEach(function(o) { if (o && o.module) ovMap[o.module] = String(o.access || 'none').toLowerCase(); });
    memberRole = memberRole || '';

    // risk: 'low' | 'medium' | 'high' | 'critical'
    var ROWS = [
      { group: 'People & Directory', items: [
        { key: 'my-flock',                label: 'My Flock Access',        desc: 'View assigned flock list and basic member profiles.',                         risk: 'low' },
        { key: 'my-flock.full-directory',  label: 'Full Flock Directory',   desc: 'View all member contact details including addresses and phone numbers.',      risk: 'medium' },
        { key: 'my-flock.add-edit-members',label: 'Add / Edit Members',     desc: 'Create new member records and modify existing ones.',                         risk: 'high' },
        { key: 'my-flock.remove-members',  label: 'Remove Members',         desc: 'Delete or archive member records permanently.',                               risk: 'critical' },
        { key: 'directory',                label: 'Directory Access',        desc: 'View the church member directory.',                                           risk: 'low' },
        { key: 'directory.contact-details',label: 'Directory Contact Details', desc: 'See phone numbers, emails, and addresses in the directory.',               risk: 'medium' },
        { key: 'directory.export',         label: 'Export Directory',        desc: 'Download the directory as a spreadsheet.',                                    risk: 'high' },
      ]},
      { group: 'Pastoral Care', items: [
        { key: 'care',              label: 'Care Cases — Own Assigned', desc: 'View and update care cases assigned to this user.',               risk: 'low' },
        { key: 'care.create',       label: 'Create Care Cases',        desc: 'Open new care cases for members.',                                risk: 'low' },
        { key: 'care.edit',         label: 'Edit Own Care Cases',      desc: 'Modify details on care cases assigned to this user.',              risk: 'low' },
        { key: 'care.view-all',     label: 'View All Care Cases',      desc: 'See every active care case across the church.',                   risk: 'high' },
        { key: 'care.edit-all',     label: 'Edit All Care Cases',      desc: 'Modify any care case, not just assigned ones.',                   risk: 'high' },
        { key: 'care.reassign',     label: 'Reassign Care Cases',      desc: 'Transfer care cases between caregivers.',                         risk: 'high' },
        { key: 'care.close',        label: 'Close Care Cases',         desc: 'Mark care cases as resolved or completed.',                       risk: 'medium' },
        { key: 'care.notes',        label: 'Pastoral Care Notes',      desc: 'Read and write sensitive pastoral notes on care cases.',           risk: 'critical' },
        { key: 'care.interactions',  label: 'Care Interactions',        desc: 'Log and view interactions on assigned care cases.',               risk: 'low' },
        { key: 'care.follow-ups',    label: 'Care Follow-Ups',          desc: 'Schedule and manage follow-up tasks on care cases.',              risk: 'low' },
        { key: 'care.assignments',   label: 'Care Assignments',         desc: 'View and manage caregiver assignment lists.',                    risk: 'medium' },
      ]},
      { group: 'Prayer', items: [
        { key: 'prayer-admin',              label: 'Prayer Admin — Full Control', desc: 'Full management of all prayer requests: edit, delete, reassign.',  risk: 'high' },
        { key: 'prayer-admin.public',       label: 'Prayer — Non-Confidential',  desc: 'View prayer requests marked as shareable with the team.',          risk: 'low' },
        { key: 'prayer-admin.confidential', label: 'Prayer — Confidential',      desc: 'Access private prayer requests shared in confidence.',             risk: 'high' },
        { key: 'prayer-admin.notes',        label: 'Prayer Notes',               desc: 'Read and write private pastoral notes on prayer requests.',        risk: 'critical' },
      ]},
      { group: 'Compassion & Benevolence', items: [
        { key: 'compassion',                label: 'Compassion Fund Access',      desc: 'View compassion requests and assistance tracking.',               risk: 'medium' },
        { key: 'compassion.approve',         label: 'Approve Requests',            desc: 'Approve or deny compassion fund requests.',                      risk: 'medium' },
        { key: 'compassion.amount',          label: 'View Amounts',                desc: 'See financial amounts on compassion cases.',                     risk: 'medium' },
        { key: 'compassion.notes',           label: 'Compassion Notes',            desc: 'Read and write sensitive notes on compassion cases.',             risk: 'critical' },
        { key: 'compassion.resources',       label: 'Compassion Resources',        desc: 'View available compassion resources and referrals.',             risk: 'low' },
        { key: 'compassion.resources.edit',  label: 'Edit Resources',              desc: 'Add, modify, or remove compassion resources.',                   risk: 'medium' },
        { key: 'compassion.log',             label: 'Compassion Log',              desc: 'View the compassion activity log.',                              risk: 'low' },
        { key: 'compassion.log.create',      label: 'Create Log Entries',          desc: 'Add new entries to the compassion log.',                         risk: 'low' },
      ]},
      { group: 'Groups, Attendance & Check-In', items: [
        { key: 'groups',             label: 'Small Groups',           desc: 'View small group rosters, schedules, and assignments.',             risk: 'low' },
        { key: 'groups.manage',      label: 'Manage Groups',          desc: 'Edit group details, rosters, and schedules.',                      risk: 'low' },
        { key: 'groups.create',      label: 'Create Groups',          desc: 'Create new small groups.',                                         risk: 'medium' },
        { key: 'attendance',         label: 'Attendance',             desc: 'Record and view attendance for services and events.',               risk: 'low' },
        { key: 'attendance.record',  label: 'Record Attendance',      desc: 'Mark attendance for services and events.',                         risk: 'low' },
        { key: 'attendance.edit-past',label: 'Edit Past Attendance',  desc: 'Modify attendance records for previous dates.',                    risk: 'medium' },
        { key: 'checkin.manage',     label: 'Check-In Management',   desc: 'Manage the check-in system for services and events.',              risk: 'medium' },
        { key: 'checkin.sessions',   label: 'Check-In Sessions',     desc: 'Create and manage check-in sessions.',                             risk: 'medium' },
      ]},
      { group: 'Outreach', items: [
        { key: 'outreach',                label: 'Outreach',               desc: 'Manage community outreach programs and engagement.',             risk: 'low' },
        { key: 'outreach.contacts',        label: 'Outreach Contacts',      desc: 'View outreach contact records.',                               risk: 'low' },
        { key: 'outreach.contacts.edit',   label: 'Edit Outreach Contacts', desc: 'Add and modify outreach contact records.',                     risk: 'medium' },
        { key: 'outreach.campaigns',       label: 'Outreach Campaigns',     desc: 'View outreach campaign details.',                              risk: 'medium' },
        { key: 'outreach.campaigns.edit',  label: 'Edit Campaigns',         desc: 'Create and modify outreach campaigns.',                        risk: 'medium' },
        { key: 'outreach.follow-ups',      label: 'Outreach Follow-Ups',    desc: 'Manage outreach follow-up tasks.',                             risk: 'low' },
      ]},
      { group: 'Giving & Finance', items: [
        { key: 'giving',              label: 'Giving Records',       desc: 'Access giving history. Sensitive financial data.',                  risk: 'critical' },
        { key: 'giving.individual',    label: 'Individual Giving',    desc: 'View individual member giving records.',                           risk: 'critical' },
        { key: 'giving.enter',         label: 'Enter Giving',         desc: 'Record new giving transactions.',                                  risk: 'critical' },
        { key: 'giving.edit',          label: 'Edit Giving',          desc: 'Modify or delete existing giving records.',                        risk: 'critical' },
        { key: 'giving.statements',    label: 'Giving Statements',    desc: 'Generate and view giving statements for members.',                 risk: 'high' },
        { key: 'giving.pledges',       label: 'View Pledges',         desc: 'View pledge commitments.',                                         risk: 'medium' },
        { key: 'giving.pledges.edit',  label: 'Edit Pledges',         desc: 'Create and modify pledge records.',                                risk: 'high' },
      ]},
      { group: 'Discipleship & Growth', items: [
        { key: 'discipleship',                   label: 'Discipleship',           desc: 'Access discipleship pathways and progress tracking.',           risk: 'low' },
        { key: 'discipleship.paths',             label: 'View Pathways',          desc: 'Browse available discipleship pathways.',                       risk: 'low' },
        { key: 'discipleship.paths.edit',        label: 'Edit Pathways',          desc: 'Create and modify discipleship pathways.',                      risk: 'medium' },
        { key: 'discipleship.enroll',            label: 'Enroll Members',         desc: 'Enroll members into discipleship programs.',                    risk: 'low' },
        { key: 'discipleship.advance',           label: 'Advance Members',        desc: 'Move members through discipleship stages.',                     risk: 'medium' },
        { key: 'discipleship.mentoring.edit',    label: 'Edit Mentoring',         desc: 'Manage mentor-mentee assignments.',                            risk: 'medium' },
        { key: 'discipleship.assessments',       label: 'Assessments',            desc: 'View and manage discipleship assessments.',                     risk: 'medium' },
        { key: 'discipleship.certificates',      label: 'Certificates',           desc: 'View discipleship completion certificates.',                    risk: 'low' },
        { key: 'discipleship.certificates.issue',label: 'Issue Certificates',     desc: 'Issue certificates for completed pathways.',                    risk: 'medium' },
        { key: 'discipleship.resources.edit',    label: 'Edit Resources',         desc: 'Manage discipleship learning resources.',                       risk: 'medium' },
      ]},
      { group: 'Worship & Media', items: [
        { key: 'songs',               label: 'Song Library',          desc: 'View the worship song library.',                                    risk: 'low' },
        { key: 'songs.edit',          label: 'Edit Songs',            desc: 'Add and modify songs in the library.',                              risk: 'low' },
        { key: 'songs.setlist',       label: 'Set Lists',             desc: 'Create and manage worship set lists.',                              risk: 'low' },
        { key: 'services.edit',       label: 'Edit Services',         desc: 'Manage service schedules and details.',                             risk: 'medium' },
        { key: 'sermons.edit',        label: 'Edit Sermons',          desc: 'Add, edit, or remove sermon records.',                              risk: 'medium' },
        { key: 'sermons.upload',      label: 'Upload Sermons',        desc: 'Upload sermon audio and video files.',                              risk: 'low' },
        { key: 'sermons.approve',     label: 'Approve Sermons',       desc: 'Review and approve sermons for publication.',                       risk: 'medium' },
        { key: 'sermons.series',      label: 'Sermon Series',         desc: 'Manage sermon series and categories.',                              risk: 'low' },
        { key: 'albums',              label: 'Albums',                desc: 'View media albums.',                                                risk: 'low' },
        { key: 'albums.manage',       label: 'Manage Albums',         desc: 'Create and edit media albums.',                                     risk: 'low' },
        { key: 'content-admin',       label: 'Content Editor',        desc: 'Edit and publish app content.',                                     risk: 'medium' },
        { key: 'content-admin.publish',label: 'Publish Content',      desc: 'Approve and publish content to all members.',                       risk: 'medium' },
      ]},
      { group: 'Calendar, Events & Volunteers', items: [
        { key: 'calendar.create',   label: 'Create Events',          desc: 'Add new events to the calendar.',                                   risk: 'low' },
        { key: 'calendar.edit',     label: 'Edit Events',            desc: 'Modify existing calendar events.',                                  risk: 'low' },
        { key: 'calendar.delete',   label: 'Delete Events',          desc: 'Remove events from the calendar.',                                  risk: 'medium' },
        { key: 'calendar.share',    label: 'Share Events',           desc: 'Share events with groups or members.',                               risk: 'low' },
        { key: 'calendar.delegate', label: 'Delegate Calendar',      desc: 'Grant calendar management to others.',                               risk: 'high' },
        { key: 'events.edit',       label: 'Edit Event Details',     desc: 'Modify event registration and details.',                             risk: 'medium' },
        { key: 'events.rsvp-list',  label: 'View RSVP Lists',       desc: 'See who has registered for events.',                                 risk: 'low' },
        { key: 'volunteers',        label: 'Volunteer Access',       desc: 'View volunteer rosters and schedules.',                              risk: 'low' },
        { key: 'volunteers.manage', label: 'Manage Volunteers',      desc: 'Assign and schedule volunteers.',                                   risk: 'low' },
        { key: 'volunteers.swap',   label: 'Swap Volunteers',        desc: 'Reassign volunteer shifts between people.',                          risk: 'medium' },
      ]},
      { group: 'Communications', items: [
        { key: 'comms',                label: 'Communications Hub',    desc: 'Access the communications system.',                                risk: 'high' },
        { key: 'comms.send-individual',label: 'Send to Individuals',  desc: 'Send messages to individual members.',                             risk: 'medium' },
        { key: 'comms.send-group',     label: 'Send to Groups',       desc: 'Send messages to groups and teams.',                               risk: 'medium' },
        { key: 'comms.send-all',       label: 'Send to All',          desc: 'Send church-wide announcements to all members.',                   risk: 'high' },
        { key: 'comms.channels',       label: 'Manage Channels',      desc: 'Create and configure communication channels.',                     risk: 'high' },
        { key: 'comms.templates',      label: 'Message Templates',    desc: 'Create and manage message templates.',                              risk: 'medium' },
        { key: 'comms.delete',         label: 'Delete Messages',      desc: 'Permanently delete sent messages.',                                 risk: 'critical' },
      ]},
      { group: 'Missions', items: [
        { key: 'missions',               label: 'Missions Hub',          desc: 'Access mission trips, partnerships, and initiatives.',            risk: 'low' },
        { key: 'missions.registry',      label: 'Mission Registry',      desc: 'View the missions registry.',                                    risk: 'low' },
        { key: 'missions.registry.edit', label: 'Edit Registry',         desc: 'Add and modify mission registry entries.',                       risk: 'medium' },
        { key: 'missions.partners',      label: 'Mission Partners',      desc: 'View mission partner details.',                                  risk: 'low' },
        { key: 'missions.partners.edit', label: 'Edit Partners',         desc: 'Manage mission partner records.',                                risk: 'medium' },
        { key: 'missions.regions',       label: 'Mission Regions',       desc: 'View and manage mission regions.',                               risk: 'low' },
        { key: 'missions.prayer',        label: 'Mission Prayer',        desc: 'View mission prayer requests.',                                  risk: 'low' },
        { key: 'missions.prayer.edit',   label: 'Edit Mission Prayer',   desc: 'Manage mission prayer requests.',                                risk: 'medium' },
        { key: 'missions.updates',       label: 'Mission Updates',       desc: 'View mission field updates.',                                    risk: 'low' },
        { key: 'missions.updates.edit',  label: 'Edit Mission Updates',  desc: 'Post and manage mission updates.',                               risk: 'medium' },
      ]},
      { group: 'Member Cards', items: [
        { key: 'memberCards',           label: 'Member Cards Hub',       desc: 'Access the member cards system.',                                risk: 'medium' },
        { key: 'memberCards.directory', label: 'Card Directory',         desc: 'Browse the member card directory.',                              risk: 'low' },
        { key: 'memberCards.create',    label: 'Create Cards',           desc: 'Issue new member cards.',                                        risk: 'high' },
        { key: 'memberCards.edit',      label: 'Edit Cards',             desc: 'Modify existing member card records.',                           risk: 'high' },
        { key: 'memberCards.archive',   label: 'Archive Cards',          desc: 'Archive or deactivate member cards.',                            risk: 'critical' },
        { key: 'memberCards.links',     label: 'Card Links',             desc: 'Manage linked accounts on member cards.',                        risk: 'high' },
        { key: 'memberCards.views',     label: 'Card Views',             desc: 'Access advanced card viewing modes.',                            risk: 'medium' },
        { key: 'memberCards.bulk',      label: 'Bulk Card Operations',   desc: 'Perform bulk actions on member cards.',                          risk: 'critical' },
        { key: 'memberCards.scan',      label: 'Scan Cards',             desc: 'Scan member cards for check-in and verification.',               risk: 'low' },
      ]},
      { group: 'Reports & Analytics', items: [
        { key: 'reports',           label: 'Reports',                desc: 'Generate and view church-wide reports.',                             risk: 'medium' },
        { key: 'reports.sensitive', label: 'Sensitive Reports',      desc: 'Access reports containing PII and financial data.',                  risk: 'high' },
        { key: 'reports.export',    label: 'Export Reports',         desc: 'Download report data as spreadsheets.',                              risk: 'critical' },
        { key: 'statistics',        label: 'Statistics & Analytics', desc: 'View aggregate statistical dashboards.',                             risk: 'low' },
        { key: 'ministry',          label: 'Ministry Hub',           desc: 'Access the ministry management dashboard.',                          risk: 'medium' },
      ]},
      { group: 'Administration', items: [
        { key: 'audit',              label: 'Activity & Audit Log',  desc: 'View the complete log of all system actions.',                      risk: 'medium' },
        { key: 'users',              label: 'User Management',       desc: 'Access the user management system.',                                risk: 'critical' },
        { key: 'users.create',       label: 'Create Users',          desc: 'Create new user accounts.',                                         risk: 'critical' },
        { key: 'users.edit',         label: 'Edit Users',            desc: 'Modify user account details and roles.',                             risk: 'high' },
        { key: 'users.deactivate',   label: 'Deactivate Users',     desc: 'Disable user accounts.',                                             risk: 'critical' },
        { key: 'users.permissions',  label: 'Edit Permissions',      desc: 'Modify other users\' permission grants.',                           risk: 'critical' },
        { key: 'config',             label: 'System Settings',       desc: 'Access church-wide configuration.',                                  risk: 'critical' },
        { key: 'config.edit',        label: 'Edit Settings',         desc: 'Modify system settings \u2014 incorrect changes can break the app.', risk: 'critical' },
        { key: 'access',             label: 'Access Requests',       desc: 'View pending access requests.',                                      risk: 'high' },
        { key: 'access.approve',     label: 'Approve Access',        desc: 'Approve or deny access requests.',                                   risk: 'critical' },
        { key: 'bulk',               label: 'Bulk Operations',       desc: 'Access bulk data operations.',                                       risk: 'critical' },
        { key: 'bulk.import',        label: 'Bulk Import',           desc: 'Import data in bulk from files.',                                    risk: 'critical' },
        { key: 'bulk.export',        label: 'Bulk Export',           desc: 'Export data in bulk to files.',                                      risk: 'critical' },
        { key: 'church',             label: 'Church Profile',        desc: 'View church profile and settings.',                                   risk: 'high' },
        { key: 'church.edit',        label: 'Edit Church Profile',   desc: 'Modify church profile information.',                                  risk: 'critical' },
      ]},
    ];

    // Preset templates — stored on window so _applyPermTemplate can access
    window._fpPermTemplates = {
      member: [],
      leader: ['my-flock', 'care', 'care.create', 'care.edit', 'care.interactions', 'care.follow-ups', 'prayer-admin.public', 'compassion', 'compassion.resources', 'groups', 'groups.manage', 'attendance', 'attendance.record', 'outreach', 'outreach.contacts', 'outreach.follow-ups', 'discipleship', 'discipleship.paths', 'volunteers', 'volunteers.manage', 'events.rsvp-list', 'sermons.upload', 'albums', 'albums.manage', 'calendar.create', 'calendar.edit', 'calendar.share', 'songs.setlist'],
      deacon: ['my-flock', 'care', 'care.create', 'care.edit', 'care.interactions', 'care.follow-ups', 'care.view-all', 'prayer-admin.public', 'prayer-admin.confidential', 'compassion', 'compassion.resources', 'compassion.approve', 'compassion.amount', 'compassion.log', 'compassion.log.create', 'directory', 'directory.contact-details', 'groups', 'groups.manage', 'attendance', 'attendance.record', 'outreach', 'outreach.contacts', 'outreach.contacts.edit', 'outreach.follow-ups', 'discipleship', 'discipleship.paths', 'giving', 'giving.pledges', 'volunteers', 'volunteers.manage', 'volunteers.swap', 'events.rsvp-list', 'events.edit', 'sermons.upload', 'sermons.series', 'albums', 'albums.manage', 'calendar.create', 'calendar.edit', 'calendar.share', 'songs', 'songs.edit', 'songs.setlist', 'services.edit', 'comms.send-group', 'memberCards.directory', 'memberCards.scan', 'checkin.manage', 'checkin.sessions', 'missions', 'missions.prayer', 'missions.prayer.edit'],
      care: ['my-flock', 'care', 'care.create', 'care.edit', 'care.interactions', 'care.follow-ups', 'care.view-all', 'prayer-admin.public', 'prayer-admin.confidential', 'compassion', 'compassion.resources', 'compassion.log', 'compassion.approve', 'compassion.amount', 'outreach.contacts', 'outreach.follow-ups'],
      elder: ['my-flock', 'care', 'care.create', 'care.edit', 'care.interactions', 'care.follow-ups', 'care.view-all', 'care.edit-all', 'care.reassign', 'care.close', 'care.assignments', 'prayer-admin.public', 'prayer-admin.confidential', 'compassion', 'compassion.resources', 'compassion.approve', 'compassion.amount', 'compassion.log', 'compassion.log.create', 'compassion.notes', 'compassion.resources.edit', 'directory', 'directory.contact-details', 'groups', 'groups.manage', 'groups.create', 'attendance', 'attendance.record', 'attendance.edit-past', 'outreach', 'outreach.contacts', 'outreach.contacts.edit', 'outreach.campaigns', 'outreach.campaigns.edit', 'outreach.follow-ups', 'discipleship', 'discipleship.paths', 'discipleship.enroll', 'discipleship.advance', 'discipleship.mentoring.edit', 'discipleship.assessments', 'discipleship.certificates', 'giving', 'giving.individual', 'giving.pledges', 'volunteers', 'volunteers.manage', 'volunteers.swap', 'events.rsvp-list', 'events.edit', 'sermons.upload', 'sermons.series', 'albums', 'albums.manage', 'calendar.create', 'calendar.edit', 'calendar.delete', 'calendar.share', 'songs', 'songs.edit', 'songs.setlist', 'services.edit', 'comms.send-group', 'memberCards.directory', 'memberCards.scan', 'checkin.manage', 'checkin.sessions', 'reports', 'statistics', 'ministry'],
      timothy: ['my-flock', 'my-flock.full-directory', 'my-flock.add-edit-members', 'directory', 'directory.contact-details', 'care', 'care.create', 'care.edit', 'care.view-all', 'care.edit-all', 'care.close', 'care.reassign', 'care.interactions', 'care.follow-ups', 'care.assignments', 'prayer-admin', 'prayer-admin.public', 'prayer-admin.confidential', 'compassion', 'compassion.approve', 'compassion.amount', 'compassion.resources', 'compassion.resources.edit', 'compassion.log', 'compassion.log.create', 'groups', 'groups.manage', 'groups.create', 'attendance', 'attendance.record', 'attendance.edit-past', 'giving', 'giving.individual', 'giving.pledges', 'discipleship', 'discipleship.paths', 'discipleship.paths.edit', 'discipleship.enroll', 'discipleship.advance', 'discipleship.mentoring.edit', 'discipleship.assessments', 'discipleship.certificates', 'discipleship.certificates.issue', 'discipleship.resources.edit', 'outreach', 'outreach.contacts', 'outreach.contacts.edit', 'outreach.campaigns', 'outreach.campaigns.edit', 'outreach.follow-ups', 'missions', 'missions.registry', 'missions.registry.edit', 'missions.partners', 'missions.partners.edit', 'missions.regions', 'missions.prayer', 'missions.prayer.edit', 'missions.updates', 'missions.updates.edit', 'comms', 'comms.send-individual', 'comms.send-group', 'comms.channels', 'comms.templates', 'content-admin', 'content-admin.publish', 'sermons.edit', 'sermons.upload', 'sermons.approve', 'sermons.series', 'albums', 'albums.manage', 'calendar.create', 'calendar.edit', 'calendar.delete', 'calendar.share', 'events.edit', 'events.rsvp-list', 'services.edit', 'volunteers', 'volunteers.manage', 'volunteers.swap', 'memberCards', 'memberCards.directory', 'memberCards.create', 'memberCards.edit', 'memberCards.scan', 'checkin.manage', 'checkin.sessions', 'reports', 'reports.sensitive', 'statistics', 'ministry', 'songs', 'songs.edit', 'songs.setlist'],
      pastor: ['my-flock', 'my-flock.full-directory', 'my-flock.add-edit-members', 'my-flock.remove-members', 'directory', 'directory.contact-details', 'directory.export', 'care', 'care.create', 'care.edit', 'care.view-all', 'care.edit-all', 'care.close', 'care.reassign', 'care.interactions', 'care.follow-ups', 'care.assignments', 'care.notes', 'prayer-admin', 'prayer-admin.public', 'prayer-admin.confidential', 'prayer-admin.notes', 'compassion', 'compassion.approve', 'compassion.amount', 'compassion.notes', 'compassion.resources', 'compassion.resources.edit', 'compassion.log', 'compassion.log.create', 'groups', 'groups.manage', 'groups.create', 'attendance', 'attendance.record', 'attendance.edit-past', 'giving', 'giving.individual', 'giving.enter', 'giving.statements', 'giving.pledges', 'giving.pledges.edit', 'discipleship', 'discipleship.paths', 'discipleship.paths.edit', 'discipleship.enroll', 'discipleship.advance', 'discipleship.mentoring.edit', 'discipleship.assessments', 'discipleship.certificates', 'discipleship.certificates.issue', 'discipleship.resources.edit', 'outreach', 'outreach.contacts', 'outreach.contacts.edit', 'outreach.campaigns', 'outreach.campaigns.edit', 'outreach.follow-ups', 'missions', 'missions.registry', 'missions.registry.edit', 'missions.partners', 'missions.partners.edit', 'missions.regions', 'missions.prayer', 'missions.prayer.edit', 'missions.updates', 'missions.updates.edit', 'comms', 'comms.send-individual', 'comms.send-group', 'comms.send-all', 'comms.channels', 'comms.templates', 'content-admin', 'content-admin.publish', 'sermons.edit', 'sermons.upload', 'sermons.approve', 'sermons.series', 'albums', 'albums.manage', 'calendar.create', 'calendar.edit', 'calendar.delete', 'calendar.share', 'events.edit', 'events.rsvp-list', 'services.edit', 'volunteers', 'volunteers.manage', 'volunteers.swap', 'memberCards', 'memberCards.directory', 'memberCards.create', 'memberCards.edit', 'memberCards.scan', 'checkin.manage', 'checkin.sessions', 'reports', 'reports.sensitive', 'statistics', 'ministry', 'songs', 'songs.edit', 'songs.setlist', 'audit', 'users.edit', 'users.permissions'],
      admin: ['my-flock', 'my-flock.full-directory', 'my-flock.add-edit-members', 'my-flock.remove-members', 'directory', 'directory.contact-details', 'directory.export', 'care', 'care.create', 'care.edit', 'care.view-all', 'care.edit-all', 'care.close', 'care.reassign', 'care.interactions', 'care.follow-ups', 'care.assignments', 'care.notes', 'prayer-admin', 'prayer-admin.public', 'prayer-admin.confidential', 'prayer-admin.notes', 'compassion', 'compassion.approve', 'compassion.amount', 'compassion.notes', 'compassion.resources', 'compassion.resources.edit', 'compassion.log', 'compassion.log.create', 'groups', 'groups.manage', 'groups.create', 'attendance', 'attendance.record', 'attendance.edit-past', 'giving', 'giving.individual', 'giving.enter', 'giving.edit', 'giving.statements', 'giving.pledges', 'giving.pledges.edit', 'discipleship', 'discipleship.paths', 'discipleship.paths.edit', 'discipleship.enroll', 'discipleship.advance', 'discipleship.mentoring.edit', 'discipleship.assessments', 'discipleship.certificates', 'discipleship.certificates.issue', 'discipleship.resources.edit', 'outreach', 'outreach.contacts', 'outreach.contacts.edit', 'outreach.campaigns', 'outreach.campaigns.edit', 'outreach.follow-ups', 'missions', 'missions.registry', 'missions.registry.edit', 'missions.partners', 'missions.partners.edit', 'missions.regions', 'missions.prayer', 'missions.prayer.edit', 'missions.updates', 'missions.updates.edit', 'comms', 'comms.send-individual', 'comms.send-group', 'comms.send-all', 'comms.channels', 'comms.templates', 'comms.delete', 'content-admin', 'content-admin.publish', 'sermons.edit', 'sermons.upload', 'sermons.approve', 'sermons.series', 'albums', 'albums.manage', 'calendar.create', 'calendar.edit', 'calendar.delete', 'calendar.share', 'calendar.delegate', 'events.edit', 'events.rsvp-list', 'services.edit', 'volunteers', 'volunteers.manage', 'volunteers.swap', 'memberCards', 'memberCards.directory', 'memberCards.create', 'memberCards.edit', 'memberCards.archive', 'memberCards.links', 'memberCards.views', 'memberCards.bulk', 'memberCards.scan', 'checkin.manage', 'checkin.sessions', 'reports', 'reports.sensitive', 'reports.export', 'statistics', 'ministry', 'songs', 'songs.edit', 'songs.setlist', 'audit', 'users', 'users.create', 'users.edit', 'users.deactivate', 'users.delete', 'users.permissions', 'config', 'config.edit', 'access', 'access.approve', 'bulk', 'bulk.import', 'bulk.export', 'church', 'church.edit'],
      'church-office': ['my-flock', 'my-flock.full-directory', 'my-flock.add-edit-members', 'directory', 'directory.contact-details', 'care', 'prayer-admin.public', 'compassion', 'memberCards', 'memberCards.directory', 'memberCards.create', 'memberCards.edit', 'memberCards.scan', 'memberCards.archive', 'memberCards.links', 'memberCards.views', 'calendar.create', 'calendar.edit', 'calendar.delete', 'calendar.share', 'events.edit', 'events.rsvp-list', 'services.edit', 'volunteers', 'volunteers.manage', 'volunteers.swap', 'checkin.manage', 'checkin.sessions', 'attendance', 'attendance.record', 'attendance.edit-past', 'groups', 'groups.manage', 'groups.create', 'comms', 'comms.send-individual', 'comms.send-group', 'comms.channels', 'comms.templates', 'comms.delete', 'users', 'users.create', 'users.edit', 'users.permissions', 'reports', 'statistics'],
      worship: ['songs', 'songs.edit', 'songs.setlist', 'services.edit', 'sermons.upload', 'sermons.series', 'albums', 'albums.manage', 'calendar.create', 'calendar.edit', 'calendar.share', 'events.rsvp-list', 'comms.send-group', 'volunteers', 'volunteers.manage', 'volunteers.swap', 'attendance', 'attendance.record'],
      children: ['checkin.manage', 'checkin.sessions', 'groups', 'groups.manage', 'attendance', 'attendance.record', 'calendar.create', 'calendar.edit', 'calendar.share', 'events.rsvp-list', 'comms.send-group', 'volunteers', 'volunteers.manage'],
      media: ['content-admin', 'content-admin.publish', 'sermons.upload', 'sermons.approve', 'sermons.series', 'albums', 'albums.manage', 'comms.channels', 'comms.templates', 'calendar.create', 'calendar.share', 'events.rsvp-list'],
      tech: ['config', 'config.edit', 'audit', 'church', 'church.edit', 'bulk', 'bulk.import', 'bulk.export'],
      finance: ['giving', 'giving.individual', 'giving.enter', 'giving.edit', 'giving.statements', 'giving.pledges', 'giving.pledges.edit', 'memberCards', 'memberCards.directory', 'reports', 'reports.sensitive', 'reports.export', 'statistics', 'directory'],
    };

    var _riskMeta = {
      low:      { label: 'Low Risk',      color: '#16a34a', bg: '#16a34a18' },
      medium:   { label: 'Medium Risk',   color: '#b45309', bg: '#b4530918' },
      high:     { label: 'High Risk',     color: '#ea580c', bg: '#ea580c18' },
      critical: { label: 'Critical',      color: '#dc2626', bg: '#dc262618' },
    };

    var _roleMeta = {
      readonly:       { label: 'Read Only',      color: '#6b7280' },
      member:         { label: 'Member',         color: '#6b7280' },
      volunteer:      { label: 'Volunteer',      color: '#7c6f3e' },
      care:           { label: 'Care Team',      color: '#2d7d9a' },
      deacon:         { label: 'Deacon',         color: '#5a6e3a' },
      leader:         { label: 'Leader',         color: '#7c3aed' },
      elder:          { label: 'Elder',          color: '#1d6f5f' },
      timothy:        { label: 'Timothy',        color: '#8b5e3c' },
      pastor:         { label: 'Pastor',         color: '#b45309' },
      admin:          { label: 'Admin',          color: '#dc2626' },
      tech:           { label: 'Tech',           color: '#4f46e5' },
      finance:        { label: 'Finance',        color: '#0e7490' },
      'church-office': { label: 'Church Office', color: '#9333ea' },
    };
    var _rm = _roleMeta[memberRole.toLowerCase()] || { label: memberRole || 'No Role', color: '#6b7280' };

    var h = '';

    // ── Role badge ──
    if (memberRole) {
      h += '<div style="margin-bottom:18px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">';
      h += '<span style="font-size:0.82rem;color:var(--ink-muted);">System Role:</span>';
      h += '<span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:0.8rem;font-weight:700;letter-spacing:0.04em;'
        + 'background:' + _rm.color + '22;color:' + _rm.color + ';border:1px solid ' + _rm.color + '55;">'
        + _e(_rm.label) + '</span>';
      h += '<span style="font-size:0.76rem;color:var(--ink-faint);font-style:italic;">The role is informational only — access is determined entirely by the selections below.</span>';
      h += '</div>';
    }

    // ── Preset buttons ──
    h += '<div style="margin-bottom:20px;">';
    h += '<span style="font-size:0.82rem;color:var(--ink-muted);display:block;margin-bottom:8px;font-weight:600;">Quick Presets <span style="color:var(--ink-faint);font-weight:400;font-style:italic;"> — sets a standard starting point, then adjust individually below</span></span>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">';
    [
      { val: 'member', label: 'Member' },
      { val: 'leader', label: 'Leader' },
      { val: 'deacon', label: 'Deacon' },
      { val: 'care',   label: 'Care' },
      { val: 'elder',  label: 'Elder' },
      { val: 'timothy',label: 'Timothy' },
      { val: 'pastor', label: 'Pastor' },
      { val: 'admin',  label: 'Admin' },
    ].forEach(function(t) {
      h += '<button type="button" onclick="TheLife._applyPermTemplate(\'' + t.val + '\')"'
        + ' style="background:none;border:1px solid var(--line);border-radius:6px;padding:6px 16px;'
        + 'cursor:pointer;color:var(--ink);font-size:0.82rem;font-family:inherit;font-weight:600;">'
        + _e(t.label) + '</button>';
    });
    h += '</div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
    [
      { val: 'church-office', label: 'Church Office' },
      { val: 'worship',       label: 'Worship' },
      { val: 'children',      label: 'Children' },
      { val: 'media',         label: 'Media' },
      { val: 'tech',          label: 'Tech' },
      { val: 'finance',       label: 'Finance' },
    ].forEach(function(t) {
      h += '<button type="button" onclick="TheLife._applyPermTemplate(\'' + t.val + '\')"'
        + ' style="background:none;border:1px solid var(--line);border-radius:6px;padding:6px 14px;'
        + 'cursor:pointer;color:var(--ink-muted);font-size:0.78rem;font-family:inherit;font-weight:600;">'
        + _e(t.label) + '</button>';
    });
    h += '<button type="button" onclick="TheLife._applyPermTemplate(\'none\')"'
      + ' style="background:none;border:1px solid var(--line);border-radius:6px;padding:6px 16px;'
      + 'cursor:pointer;color:var(--ink-muted);font-size:0.82rem;font-family:inherit;">Clear All</button>';
    h += '</div></div>';

    // ── Matrix table — grouped by access level ──
    h += '<table style="width:100%;border-collapse:collapse;font-size:0.83rem;">';
    h += '<thead><tr style="border-bottom:2px solid var(--line);">';
    h += '<th style="text-align:left;padding:8px 12px;color:var(--ink-muted);font-weight:600;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;">Permission</th>';
    h += '<th style="text-align:center;padding:8px 12px;color:var(--ink-muted);font-weight:600;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;width:120px;">Access</th>';
    h += '</tr></thead><tbody>';

    // Flatten ROWS into risk buckets: low → medium → high → critical
    var _riskGroups = { low: [], medium: [], high: [], critical: [] };
    ROWS.forEach(function(section) {
      section.items.forEach(function(item) {
        var lvl = item.risk || 'low';
        if (_riskGroups[lvl]) _riskGroups[lvl].push({ item: item, group: section.group });
      });
    });

    ['low', 'medium', 'high', 'critical'].forEach(function(lvl) {
      var entries = _riskGroups[lvl];
      if (!entries.length) return;
      var rm = _riskMeta[lvl];
      var headId = 'fp-grp-' + lvl;
      h += '<tr><td style="padding:14px 12px 6px;border-top:2px solid var(--line);">';
      h += '<span style="display:inline-block;padding:3px 14px;border-radius:20px;font-size:0.72rem;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;'
         + 'background:' + rm.bg + ';color:' + rm.color + ';border:1px solid ' + rm.color + '55;">'
         + _e(rm.label) + '</span>';
      h += '</td>';
      h += '<td style="text-align:center;padding:14px 12px 6px;border-top:2px solid var(--line);vertical-align:middle;">'
         + '<input type="checkbox" id="' + headId + '" class="fp-grp-chk" data-risk-group="' + lvl + '"'
         + ' onchange="TheLife._onGrpChkChange(this)"'
         + ' style="width:18px;height:18px;accent-color:' + rm.color + ';cursor:pointer;"'
         + ' title="Toggle all ' + rm.label + ' permissions">'
         + '</td>';
      h += '</tr>';
      entries.forEach(function(e) {
        var item  = e.item;
        var group = e.group;
        var val   = ovMap[item.key] || 'none';
        var selId = 'psel-' + item.key.replace(/\./g, '-');
        h += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">';
        h += '<td style="padding:10px 12px;vertical-align:top;">';
        h += '<div style="font-weight:600;color:var(--ink);margin-bottom:2px;">' + _e(item.label) + '</div>';
        h += '<div style="font-size:0.77rem;color:var(--ink-muted);line-height:1.45;margin-bottom:2px;">' + _e(item.desc) + '</div>';
        h += '<div style="font-size:0.70rem;color:var(--ink-faint);font-style:italic;">' + _e(group) + '</div>';
        h += '</td>';
        h += '<td style="text-align:center;padding:10px 12px;vertical-align:middle;">';
        h += '<input type="checkbox" id="' + selId + '" class="fp-perm-chk" data-perm-key="' + _e(item.key) + '" data-risk="' + _e(item.risk || 'low') + '"'
           + (val === 'grant' ? ' checked' : '')
           + ' onchange="TheLife._onPermChkChange(this)"'
           + ' style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer;">';
        h += '</td></tr>';
      });
    });

    h += '</tbody></table>';

    // Single shared critical-permission confirmation box
    h += '<div id="fp-crit-confirm" style="display:none;border:2px solid #dc2626;border-radius:10px;background:#dc262610;padding:16px 18px;margin:16px 0;">'
       + '<div style="font-weight:800;color:#dc2626;font-size:0.8rem;letter-spacing:0.06em;margin-bottom:10px;">'
       + '\uD83D\uDD34 CRITICAL PERMISSION \u2014 CONFIRMATION REQUIRED</div>'
       + '<p style="font-size:0.84rem;color:var(--ink);margin:0 0 12px;">One or more critical permissions are selected. Please confirm before saving.</p>'
       + '<label style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;cursor:pointer;">'
       + '<input type="checkbox" id="fp-crit-chk" style="margin-top:2px;accent-color:#dc2626;">'
       + '<span style="font-size:0.84rem;color:var(--ink);">I understand this grants critical-level system access to this person</span>'
       + '</label>'
       + '<input type="text" id="fp-crit-txt" placeholder="Type Yes to confirm"'
       + ' style="border:1px solid #dc262666;border-radius:6px;padding:6px 12px;font-size:0.84rem;'
       + 'background:var(--bg);color:var(--ink);font-family:inherit;width:200px;">'
       + '<div style="font-size:0.76rem;color:var(--ink-muted);font-style:italic;margin-top:10px;">'
       + '\uD83D\uDCE3 Pastoral leads will be notified when critical permissions are granted.</div>'
       + '</div>';

    // ── Save button ──
    h += '<div style="margin-top:18px;display:flex;align-items:center;gap:12px;">';
    h += '<button type="button" onclick="TheLife.savePermissions()" style="background:var(--accent);color:var(--ink-inverse);border:none;border-radius:6px;padding:9px 22px;cursor:pointer;font-weight:700;font-size:0.86rem;font-family:inherit;">Save Permissions</button>';
    h += '<span id="fp-perm-status" style="font-size:0.82rem;color:var(--ink-muted);"></span>';
    h += '</div>';

    return h;
  }

  function _applyPermTemplate(templateKey) {
    var key = templateKey || '';
    var keys = key === 'none' ? [] : ((window._fpPermTemplates && window._fpPermTemplates[key]) || []);
    document.querySelectorAll('.fp-perm-chk').forEach(function(chk) {
      chk.checked = keys.indexOf(chk.getAttribute('data-perm-key')) !== -1;
    });
    _fpSyncAllGrpHeaders();
    _fpSyncCritConfirm();
  }

  /* ── Group header checkbox: toggle all child perms in that risk group ── */
  function _onGrpChkChange(grpChk) {
    var lvl = grpChk.getAttribute('data-risk-group');
    var isChecked = grpChk.checked;
    document.querySelectorAll('.fp-perm-chk').forEach(function(c) {
      if (c.getAttribute('data-risk') === lvl) c.checked = isChecked;
    });
    _fpSyncCritConfirm();
  }

  /* ── Individual perm checkbox: sync parent group header + crit box ── */
  function _onPermChkChange(chk) {
    var lvl = chk.getAttribute('data-risk');
    _fpSyncGrpHeader(lvl);
    _fpSyncCritConfirm();
  }

  function _fpSyncGrpHeader(lvl) {
    var grpChk = document.getElementById('fp-grp-' + lvl);
    if (!grpChk) return;
    var children = document.querySelectorAll('.fp-perm-chk[data-risk="' + lvl + '"]');
    var total = children.length, checked = 0;
    children.forEach(function(c) { if (c.checked) checked++; });
    grpChk.checked = (checked === total);
    grpChk.indeterminate = (checked > 0 && checked < total);
  }

  function _fpSyncAllGrpHeaders() {
    ['low', 'medium', 'high', 'critical'].forEach(_fpSyncGrpHeader);
  }

  function _fpSyncCritConfirm() {
    var anyCritChecked = false;
    document.querySelectorAll('.fp-perm-chk').forEach(function(c) {
      if (c.getAttribute('data-risk') === 'critical' && c.checked) anyCritChecked = true;
    });
    var box = document.getElementById('fp-crit-confirm');
    if (box) {
      box.style.display = anyCritChecked ? '' : 'none';
      if (!anyCritChecked) {
        var ck  = document.getElementById('fp-crit-chk');
        var txt = document.getElementById('fp-crit-txt');
        if (ck)  ck.checked = false;
        if (txt) txt.value  = '';
      }
    }
  }

  async function savePermissions() {
    var hasCritChecked = Array.from(document.querySelectorAll('.fp-perm-chk'))
      .some(function(c) { return c.checked && c.getAttribute('data-risk') === 'critical'; });
    if (hasCritChecked) {
      var critChk = document.getElementById('fp-crit-chk');
      var critTxt = document.getElementById('fp-crit-txt');
      if (!critChk || !critChk.checked || !critTxt || critTxt.value.trim() !== 'Yes') {
        _toast('Please confirm critical permissions: check the box and type \u201cYes\u201d before saving.', 'warning');
        var critBox = document.getElementById('fp-crit-confirm');
        if (critBox) critBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    var memberRec = _lookupMember(_fpMemberId);
    var targetEmail = memberRec.primaryEmail || memberRec.email ||
      (_fpMemberId && _fpMemberId.indexOf('@') !== -1 ? _fpMemberId : '');
    if (!targetEmail) {
      _toast('Cannot save permissions: this member has no email address.', 'error');
      return;
    }
    var grants = [];
    document.querySelectorAll('.fp-perm-chk').forEach(function(chk) {
      if (chk.checked) grants.push(chk.getAttribute('data-perm-key'));
    });
    var st = document.getElementById('fp-perm-status');
    if (st) st.textContent = 'Saving…';
    try {
      await TheVine.flock.permissions.setAll({ targetEmail: targetEmail, grants: grants, denies: [] });
      if (st) st.textContent = '\u2713 Saved';
      _toast('Permissions saved.', 'success');
      setTimeout(function() { backToHub(); }, 600);
    } catch(e) {
      if (st) st.textContent = 'Error';
      _toast('Failed to save permissions: ' + (e.message || e), 'error');
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // PDF / PRINT
  // ══════════════════════════════════════════════════════════════════════════

  /** Print care cases summary report via Modules._printReport */
  async function _careSummaryPrint() {
    var _pr = (typeof Modules !== 'undefined' && Modules._printReport) ? Modules._printReport : null;
    if (!_pr) { alert('Print not available.'); return; }
    var _esc = function(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    var toast = (typeof Modules !== 'undefined' && Modules._toast) ? Modules._toast : function() {};
    toast('Preparing care summary…', 'info');
    try {
      var res = await (_isFB() ? UpperRoom.listCareCases({}) : TheVine.flock.care.list({}));
      var rows = _rows(res);
      var open = rows.filter(function(c) { var s = (c.status || '').toLowerCase(); return s !== 'resolved' && s !== 'closed'; });
      var resolved = rows.length - open.length;
      var priorities = { urgent: 0, high: 0, normal: 0, low: 0 };
      open.forEach(function(c) {
        var p = (c.priority || 'normal').toLowerCase();
        if (p === 'urgent' || p === 'critical') priorities.urgent++;
        else if (p === 'high') priorities.high++;
        else if (p === 'low') priorities.low++;
        else priorities.normal++;
      });
      var statsHtml = '<div class="rpt-stats">'
        + '<div class="rpt-stat"><div class="rpt-stat-label">Open Cases</div><div class="rpt-stat-value">' + open.length + '</div></div>'
        + '<div class="rpt-stat"><div class="rpt-stat-label">Resolved</div><div class="rpt-stat-value">' + resolved + '</div></div>'
        + '<div class="rpt-stat"><div class="rpt-stat-label">Urgent / High</div><div class="rpt-stat-value">' + (priorities.urgent + priorities.high) + '</div></div>'
        + '<div class="rpt-stat"><div class="rpt-stat-label">Total Cases</div><div class="rpt-stat-value">' + rows.length + '</div></div>'
        + '</div>';
      var sorted = open.concat(rows.filter(function(c) { var s = (c.status || '').toLowerCase(); return s === 'resolved' || s === 'closed'; }));
      var html = '<table><thead><tr><th>Member</th><th>Care Type</th><th>Priority</th><th>Status</th><th>Opened</th><th>Summary</th></tr></thead><tbody>';
      sorted.forEach(function(c) {
        html += '<tr><td>' + _esc(_memberName(c.memberId) || c.memberId || '') + '</td>'
          + '<td>' + _esc(c.careType || c.type || '') + '</td>'
          + '<td>' + _esc(c.priority || '') + '</td>'
          + '<td>' + _esc(c.status || '') + '</td>'
          + '<td>' + _esc(_fmtDate(c.openedDate || c.createdAt || '')) + '</td>'
          + '<td>' + _esc((c.summary || '').substring(0, 60)) + '</td></tr>';
      });
      html += '</tbody></table>';
      _pr('Care Summary Report', statsHtml + html, { landscape: true });
    } catch (e) { toast('Error: ' + e.message, 'danger'); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  return {
    // Hub & Dashboard
    renderHub:       renderHub,
    refresh:         refresh,
    switchTab:       switchTab,
    backToHub:       backToHub,
    backToLoveInAction: backToLoveInAction,  // legacy alias
    openApp:         openApp,

    // Care Hub (inline)
    _careHubSwitch:            _careHubSwitch,
    _careHubSearch:            _careHubSearch,
    _careHubSearchAssignments: _careHubSearchAssignments,
    _careHubReassign:          _careHubReassign,
    _careHubEndAssignment:     _careHubEndAssignment,
    _careHubFollowUpDone:      _careHubFollowUpDone,

    // Members
    openAddMember:   openAddMember,
    saveMember:      saveMember,

    // Utilities (for sister modules)
    _memberName:     _memberName,
    _lookupMember:   _lookupMember,

    // Full-page editors: Care
    openCareCase:    openCareCase,
    saveCareCase:    saveCareCase,
    resolveCareCase: resolveCareCase,
    sendCareReach:   sendCareReach,
    addCareInteraction:   addCareInteraction,
    scheduleCareFollowUp: scheduleCareFollowUp,
    createLinkedCase:     createLinkedCase,
    viewMemberFromCase:   viewMemberFromCase,
    showFollowUps:        showFollowUps,
    showUnassignedCases:  showUnassignedCases,
    _autoAssignToLP:      _autoAssignToLP,
    _autoAssignCasesToLP: _autoAssignCasesToLP,
    showUnassignedPrayers: showUnassignedPrayers,
    _autoAssignPrayersToLP: _autoAssignPrayersToLP,
    loadMemberCareHistory: loadMemberCareHistory,
    _careSummaryPrint:     _careSummaryPrint,

    // Full-page editors: Prayer
    openPrayer:         openPrayer,
    savePrayer:         savePrayer,
    sendPrayerReply:    sendPrayerReply,
    addPrayerInteraction: addPrayerInteraction,
    convertPrayerToCare: convertPrayerToCare,
    _prayerPageNav:     _prayerPageNav,

    // Full-page editors: Compassion
    openCompassion:  openCompassion,
    saveCompassion:  saveCompassion,
    approveCompassion: approveCompassion,
    denyCompassion:    denyCompassion,
    addCompassionFollowUp: addCompassionFollowUp,

    // Full-page editors: Outreach
    openOutreach:    openOutreach,
    saveOutreach:    saveOutreach,
    archiveOutreach: archiveOutreach,
    addOutreachFollowUp: addOutreachFollowUp,

    // Utilities (exposed for onclick)
    _callPhone:  _callPhone,
    _smsPhone:   _smsPhone,
    _miniModal:         _miniModal,
    savePermissions:    savePermissions,
    _applyPermTemplate: _applyPermTemplate,
    _onPermChkChange:   _onPermChkChange,
    _onGrpChkChange:    _onGrpChkChange,
  };

})();
