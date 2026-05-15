/* ══════════════════════════════════════════════════════════════════════════════
   THE BREASTPLATE — Account / personal-settings panel
   "Take the breastplate of righteousness." — Ephesians 6:14

   Slide-from-right drawer. Three tabs:
     • Profile       — identity, role, member card
     • Preferences   — email forwarding, notification toggles
     • Connections   — personal iCal feed (copy / regenerate)

   Backed by window.UpperRoom (Firestore-first):
     getNotifPrefs / updateNotifPrefs   →  forwarding email + toggles
     getCalendarShareToken              →  personal iCal URL
     searchMemberCards                  →  member-card lookup by email

   Pure markup; styles in New_Covenant/Styles/new_covenant.css (.bp-*)
   ══════════════════════════════════════════════════════════════════════════════ */

let _root = null;
let _onSignOut = null;

export function renderBadge(profile, opts = {}) {
  if (!profile) return;
  _onSignOut = opts.onSignOut || null;

  if (_root && _root.parentNode) { _close(); }

  _root = document.createElement('div');
  _root.className = 'bp-overlay';
  _root.setAttribute('role', 'dialog');
  _root.setAttribute('aria-label', 'Account');
  _root.innerHTML = _shell(profile);
  document.body.appendChild(_root);

  requestAnimationFrame(() => _root.classList.add('is-open'));

  _wire(profile);
  _loadAll(profile);

  document.addEventListener('keydown', _onKey);
}

/* ── Layout ──────────────────────────────────────────────────────────────── */

function _shell(p) {
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.displayName || p.email || 'Member';
  const role     = p.role || 'Member';
  const email    = p.email || '';
  return `
    <div class="bp-panel" role="document">
      <header class="bp-head">
        <div class="bp-mono" aria-hidden="true">
          <img alt="" src="Images/icon-flockos.svg" onerror="this.style.display='none'">
        </div>
        <div class="bp-id">
          <div class="bp-name">${_e(fullName)}</div>
          <div class="bp-meta">
            <span class="bp-role">${_e(role)}</span>
            <span class="bp-dot">·</span>
            <span class="bp-email">${_e(email)}</span>
          </div>
        </div>
        <button class="bp-close" type="button" data-act="close" aria-label="Close">&#10005;</button>
      </header>

      <nav class="bp-tabs" role="tablist">
        <button class="bp-tab is-active" type="button" role="tab" data-tab="profile" aria-selected="true">
          <span class="bp-tab-icon">${_ICON.user}</span><span>Profile</span>
        </button>
        <button class="bp-tab" type="button" role="tab" data-tab="prefs" aria-selected="false">
          <span class="bp-tab-icon">${_ICON.bell}</span><span>Preferences</span>
        </button>
        <button class="bp-tab" type="button" role="tab" data-tab="connect" aria-selected="false">
          <span class="bp-tab-icon">${_ICON.link}</span><span>Connections</span>
        </button>
      </nav>

      <div class="bp-body">
        <section class="bp-pane is-active" data-pane="profile">${_paneProfile(p)}</section>
        <section class="bp-pane" data-pane="prefs" hidden>${_panePrefs()}</section>
        <section class="bp-pane" data-pane="connect" hidden>${_paneConnect()}</section>
      </div>

      <footer class="bp-foot">
        <button class="bp-btn bp-btn--ghost"  type="button" data-act="close">Close</button>
        <button class="bp-btn bp-btn--danger" type="button" data-act="sign-out">Sign out</button>
      </footer>
    </div>
  `;
}

function _paneProfile(p) {
  return `
    <div class="bp-section">
      <div class="bp-section-title">Identity</div>
      <div class="bp-grid">
        <label class="bp-field">
          <span class="bp-label">First name</span>
          <input class="bp-input" type="text" value="${_e(p.firstName || '')}" disabled>
        </label>
        <label class="bp-field">
          <span class="bp-label">Last name</span>
          <input class="bp-input" type="text" value="${_e(p.lastName || '')}" disabled>
        </label>
        <label class="bp-field bp-field--wide">
          <span class="bp-label">Email <span class="bp-hint">(used for sign-in)</span></span>
          <input class="bp-input" type="email" value="${_e(p.email || '')}" disabled>
        </label>
        <label class="bp-field">
          <span class="bp-label">Role</span>
          <input class="bp-input" type="text" value="${_e(p.role || 'Member')}" disabled>
        </label>
      </div>
      <p class="bp-note">To change your name or role, contact your church administrator.</p>
    </div>

    <div class="bp-section">
      <div class="bp-section-title">Member card</div>
      <div class="bp-card-slot" data-bind="member-card">
        <div class="bp-skel"></div>
      </div>
    </div>
  `;
}

function _panePrefs() {
  return `
    <div class="bp-section">
      <div class="bp-section-title">Email forwarding</div>
      <p class="bp-note">Send a copy of announcements, prayer alerts, and care notes to a second address.</p>
      <label class="bp-field">
        <span class="bp-label">Forward to</span>
        <input class="bp-input" type="email" data-bind="forwarding" placeholder="you@example.com">
      </label>
    </div>

    <div class="bp-section">
      <div class="bp-section-title">Notifications</div>
      <ul class="bp-toggles">
        <li class="bp-toggle">
          <div>
            <div class="bp-toggle-title">Push notifications</div>
            <div class="bp-toggle-sub">Pings for new messages, prayers, and announcements.</div>
          </div>
          <label class="bp-switch"><input type="checkbox" data-bind="pref-push" checked><span></span></label>
        </li>
        <li class="bp-toggle">
          <div>
            <div class="bp-toggle-title">Email digest</div>
            <div class="bp-toggle-sub">A daily summary of activity from your community.</div>
          </div>
          <label class="bp-switch"><input type="checkbox" data-bind="pref-email" checked><span></span></label>
        </li>
        <li class="bp-toggle">
          <div>
            <div class="bp-toggle-title">Prayer chain alerts</div>
            <div class="bp-toggle-sub">Be notified when a new prayer is added to the chain.</div>
          </div>
          <label class="bp-switch"><input type="checkbox" data-bind="pref-prayer" checked><span></span></label>
        </li>
        <li class="bp-toggle">
          <div>
            <div class="bp-toggle-title">Care follow-ups</div>
            <div class="bp-toggle-sub">Reminders when a pastoral case is assigned to you.</div>
          </div>
          <label class="bp-switch"><input type="checkbox" data-bind="pref-care" checked><span></span></label>
        </li>
      </ul>

      <div class="bp-row-end">
        <span class="bp-status" data-bind="prefs-status"></span>
        <button class="bp-btn bp-btn--primary" type="button" data-act="save-prefs">Save preferences</button>
      </div>
    </div>

    <div class="bp-section">
      <div class="bp-section-title">App &amp; Cache</div>
      <p class="bp-note">Clear all locally cached data and reload the app. Your account session will be preserved.</p>
      <div class="bp-row-end">
        <span class="bp-status" data-bind="cache-status"></span>
        <button class="bp-btn bp-btn--ghost" type="button" data-act="clear-cache">Clear cache &amp; reload</button>
      </div>
    </div>
  `;
}

function _paneConnect() {
  return `
    <div class="bp-section">
      <div class="bp-section-title">Personal calendar (iCal)</div>
      <p class="bp-note">Subscribe to your personal calendar in Apple Calendar, Google Calendar, or Outlook. Keep this URL private &mdash; anyone with the link can view your church events.</p>
      <div class="bp-copy-row">
        <input class="bp-input bp-input--mono" type="text" data-bind="ical" readonly placeholder="Loading\u2026">
        <button class="bp-btn bp-btn--ghost"   type="button" data-act="copy-ical">Copy</button>
      </div>
      <div class="bp-row-end">
        <span class="bp-status" data-bind="ical-status"></span>
        <button class="bp-btn bp-btn--ghost bp-btn--small" type="button" data-act="regen-ical">Regenerate link</button>
      </div>
    </div>

    <div class="bp-section">
      <div class="bp-section-title">Member card link</div>
      <p class="bp-note">Quick-link to your member card &mdash; share or print at any time.</p>
      <div class="bp-copy-row">
        <input class="bp-input bp-input--mono" type="text" data-bind="card-link" readonly placeholder="Loading\u2026">
        <button class="bp-btn bp-btn--ghost"   type="button" data-act="copy-card">Copy</button>
      </div>
    </div>
  `;
}

/* ── Wiring ──────────────────────────────────────────────────────────────── */

function _wire(p) {
  _root.addEventListener('click', async (e) => {
    if (e.target === _root) return _close();

    const tab = e.target.closest('[data-tab]');
    if (tab) return _switchTab(tab.dataset.tab);

    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'close')       return _close();
    if (act === 'sign-out')    { _close(); if (_onSignOut) _onSignOut(); return; }
    if (act === 'save-prefs')  return _savePrefs(btn);
    if (act === 'copy-ical')   return _copyField('ical');
    if (act === 'copy-card')   return _copyField('card-link');
    if (act === 'regen-ical')  return _regenIcal(btn);
    if (act === 'clear-cache') return _clearCache(btn);
  });
}

function _switchTab(name) {
  _root.querySelectorAll('.bp-tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  _root.querySelectorAll('.bp-pane').forEach((s) => {
    const on = s.dataset.pane === name;
    s.classList.toggle('is-active', on);
    s.hidden = !on;
  });
}

/* ── Data load ───────────────────────────────────────────────────────────── */

async function _loadAll(p) {
  _loadPrefs().catch(() => {});
  _loadIcal().catch(() => {});
  _loadMemberCard(p).catch(() => {});
}

async function _loadPrefs() {
  const UR = window.UpperRoom;
  if (!UR || typeof UR.getNotifPrefs !== 'function') return;
  const prefs = (await UR.getNotifPrefs()) || {};
  _set('forwarding',   prefs.forwardingEmail || '');
  _check('pref-push',  prefs.push   !== false);
  _check('pref-email', prefs.email  !== false);
  _check('pref-prayer',prefs.prayer !== false);
  _check('pref-care',  prefs.care   !== false);
}

async function _savePrefs(btn) {
  const UR = window.UpperRoom;
  if (!UR || typeof UR.updateNotifPrefs !== 'function') {
    return _status('prefs-status', 'Service unavailable.', 'err');
  }
  btn.disabled = true;
  _status('prefs-status', 'Saving\u2026', '');
  const payload = {
    forwardingEmail: _get('forwarding').trim(),
    push:    _isChecked('pref-push'),
    email:   _isChecked('pref-email'),
    prayer:  _isChecked('pref-prayer'),
    care:    _isChecked('pref-care'),
    updatedAt: Date.now(),
  };
  try {
    await UR.updateNotifPrefs(payload);
    _status('prefs-status', 'Saved.', 'ok');
    setTimeout(() => _status('prefs-status', '', ''), 2400);
  } catch (err) {
    _status('prefs-status', 'Could not save: ' + (err && err.message || 'unknown'), 'err');
  } finally {
    btn.disabled = false;
  }
}

async function _loadIcal() {
  const UR = window.UpperRoom;
  if (!UR || typeof UR.getCalendarShareToken !== 'function') {
    _set('ical', 'Calendar service unavailable');
    return;
  }
  try {
    const { feedUrl } = await UR.getCalendarShareToken();
    _set('ical', feedUrl || '');
  } catch (_) {
    _set('ical', 'Could not load calendar link');
  }
}

async function _regenIcal(btn) {
  if (!confirm('Regenerate your iCal link? Your existing link will stop working immediately.')) return;
  const UR = window.UpperRoom;
  if (!UR || typeof UR.getCalendarShareToken !== 'function') return;
  btn.disabled = true;
  _status('ical-status', 'Regenerating\u2026', '');
  try {
    const { feedUrl } = await UR.getCalendarShareToken({ regenerate: true });
    _set('ical', feedUrl || '');
    _status('ical-status', 'New link ready.', 'ok');
    setTimeout(() => _status('ical-status', '', ''), 2400);
  } catch (err) {
    _status('ical-status', 'Failed: ' + (err && err.message || 'unknown'), 'err');
  } finally {
    btn.disabled = false;
  }
}

async function _clearCache(btn) {
  btn.disabled = true;
  _status('cache-status', 'Clearing…', '');
  try {
    // Clear Service Worker caches.
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    // Clear IndexedDB cistern (app data cache, not auth).
    try {
      const { clear: clearCistern } = await import('../the_cistern.js');
      if (typeof clearCistern === 'function') await clearCistern();
    } catch (_) { /* cistern unavailable — continue */ }
    // Brief pause so the user sees the status before reload.
    _status('cache-status', 'Done. Reloading…', 'ok');
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    _status('cache-status', 'Failed: ' + (err && err.message || 'unknown'), 'err');
    btn.disabled = false;
  }
}

async function _loadMemberCard(p) {
  const slot = _root && _root.querySelector('[data-bind="member-card"]');
  if (!slot) return;
  const UR = window.UpperRoom;
  const link = _root.querySelector('[data-bind="card-link"]');

  const base = location.origin + location.pathname + '?covenant=new&view=the_fold';

  if (!UR || typeof UR.searchMemberCards !== 'function' || !p.email) {
    slot.innerHTML = `<div class="bp-empty">No member card on file.</div>`;
    if (link) link.value = base;
    return;
  }
  try {
    const rows = await UR.searchMemberCards(p.email);
    const card = (rows && rows[0]) || null;
    if (!card) {
      slot.innerHTML = `<div class="bp-empty">No member card on file. <a href="?covenant=new&amp;view=the_fold">Open The Fold &rarr;</a></div>`;
      if (link) link.value = base;
      return;
    }
    const num   = card.memberNumber || card.id || '';
    const since = card.joinedDate || card.createdAt || '';
    const url   = base + (num ? '&card=' + encodeURIComponent(num) : '');
    if (link) link.value = url;
    slot.innerHTML = `
      <div class="bp-card">
        <div class="bp-card-num">#${_e(num)}</div>
        <div class="bp-card-info">
          <div class="bp-card-name">${_e(card.firstName || '')} ${_e(card.lastName || '')}</div>
          ${since ? `<div class="bp-card-since">Member since ${_e(_dateStr(since))}</div>` : ''}
        </div>
        <a class="bp-card-go" href="${_e(url)}">Open &rarr;</a>
      </div>
    `;
  } catch (_) {
    slot.innerHTML = `<div class="bp-empty">Could not load member card.</div>`;
    if (link) link.value = base;
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function _copyField(bind) {
  const el = _root && _root.querySelector(`[data-bind="${bind}"]`);
  if (!el || !el.value) return;
  el.select();
  try { navigator.clipboard.writeText(el.value); } catch (_) { document.execCommand && document.execCommand('copy'); }
  const status = bind === 'ical' ? 'ical-status' : null;
  if (status) { _status(status, 'Copied to clipboard.', 'ok'); setTimeout(() => _status(status, '', ''), 1800); }
  else {
    el.classList.add('bp-flash');
    setTimeout(() => el.classList.remove('bp-flash'), 600);
  }
}

function _set(bind, value) {
  const el = _root && _root.querySelector(`[data-bind="${bind}"]`);
  if (el && 'value' in el) el.value = value || '';
}
function _get(bind) {
  const el = _root && _root.querySelector(`[data-bind="${bind}"]`);
  return el ? (el.value || '') : '';
}
function _check(bind, on) {
  const el = _root && _root.querySelector(`[data-bind="${bind}"]`);
  if (el) el.checked = !!on;
}
function _isChecked(bind) {
  const el = _root && _root.querySelector(`[data-bind="${bind}"]`);
  return !!(el && el.checked);
}
function _status(bind, msg, kind) {
  const el = _root && _root.querySelector(`[data-bind="${bind}"]`);
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'bp-status' + (kind ? ' bp-status--' + kind : '');
}
function _dateStr(v) {
  try {
    const d = (v && typeof v === 'object' && v.seconds) ? new Date(v.seconds * 1000) : new Date(v);
    if (isNaN(+d)) return String(v);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) { return String(v); }
}
function _onKey(e) {
  if (e.key === 'Escape') _close();
}
function _close() {
  if (!_root) return;
  document.removeEventListener('keydown', _onKey);
  _root.classList.remove('is-open');
  const r = _root;
  _root = null;
  setTimeout(() => { if (r && r.parentNode) r.parentNode.removeChild(r); }, 220);
}
function _e(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const _ICON = {
  user: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  bell: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  link: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1-1"/></svg>',
};
