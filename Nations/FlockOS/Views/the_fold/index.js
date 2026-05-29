/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: THE FOLD — Member directory
   "I am the good shepherd; I know my sheep and my sheep know me." — John 10:14
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';
import { openContactComposer } from '../the_life/index.js';
import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';
import { go } from '../../Scripts/the_scribes/index.js';
import { dms } from '../../Scripts/the_upper_room/index.js';

export const name  = 'the_fold';
export const title = 'The Fold';

export function render() {
  return /* html */`
    <section class="fold-view">
      ${pageHero({
        title: 'The Fold',
        subtitle: 'Everyone in your congregation — members, visitors, and families.',
        scripture: 'I am the good shepherd; I know my sheep and my sheep know me. — John 10:14',
      })}

      <!-- Toolbar: search + filters + actions -->
      <div class="fold-toolbar">
        <div class="fold-search-wrap">
          <svg class="fold-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input class="fold-search" type="search" placeholder="Search by name, email, or phone…" aria-label="Search members" data-bind="search">
        </div>
        <div class="fold-filters">
          <button class="fold-filter is-active" data-filter="all">All</button>
          <button class="fold-filter" data-filter="member">Members</button>
          <button class="fold-filter" data-filter="visitor">Visitors</button>
          <button class="fold-filter" data-filter="leader">Leaders</button>
        </div>
        <div class="fold-sorts" aria-label="Sort members by">
          <span class="fold-sort-label">Sort:</span>
          <button class="fold-sort" data-sort="firstName">First Name</button>
          <button class="fold-sort" data-sort="lastName">Last Name</button>
          <button class="fold-sort" data-sort="role">Role</button>
          <button class="fold-sort" data-sort="joinDate">Joined</button>
        </div>
        <button class="flock-btn flock-btn--primary fold-add-btn" data-act="add-person">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add Person
        </button>
      </div>

      <!-- Stats strip -->
      <div class="fold-stats" data-bind="stats">
        ${_loadingStats()}
      </div>

      <!-- Member grid -->
      <div class="fold-grid" data-bind="members" role="list">
        <div class="life-empty">Loading members…</div>
      </div>
    </section>
  `;
}

export function mount(root) {
  // Restore saved sort and mark active button
  _paintSortButtons(root);

  // Sort buttons — re-sort in place without a network round-trip
  root.querySelectorAll('.fold-sort').forEach((btn) => {
    btn.addEventListener('click', () => {
      _currentSort = btn.dataset.sort;
      try { localStorage.setItem('flock_fold_sort', _currentSort); } catch (_) {}
      _paintSortButtons(root);
      const grid = root.querySelector('[data-bind="members"]');
      if (grid && Object.keys(_personMap).length) {
        const sorted = _sortRows(Object.values(_personMap));
        grid.innerHTML = sorted.map(_liveCard).join('');
        _wireCards(grid, root);
      }
    });
  });

  // Filter buttons
  root.querySelectorAll('.fold-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.fold-filter').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      _applyFilter(root, btn.dataset.filter);
    });
  });

  // Live search
  const searchEl = root.querySelector('[data-bind="search"]');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      const q = searchEl.value.toLowerCase().trim();
      root.querySelectorAll('.fold-card').forEach((card) => {
        const name = (card.dataset.name || '').toLowerCase();
        card.style.display = (!q || name.includes(q)) ? '' : 'none';
      });
    });
  }

  // Load live members — replaces demo grid when backend is ready
  _loadMembers(root);

  // Add Person button
  const addBtn = root.querySelector('[data-act="add-person"]');
  if (addBtn) addBtn.addEventListener('click', () => _openNewMemberSheet(() => _loadMembers(root)));

  return () => { _closeMemberSheet(); };
}

let _personMap = {};
let _activeFoldSheet = null;
let _bgCheckMap = {}; // memberId → { status } — populated from backgroundChecks collection

// ── Touch logging ─────────────────────────────────────────────────────────────
// Fire-and-forget — never blocks UI or raises visible errors.
function _logTouch(memberId, memberName, channel) {
  if (!memberId) return;
  const V  = window.TheVine;
  const UR = window.UpperRoom;
  const payload = { memberId, memberName, channel };
  if (UR && typeof UR.createTouch === 'function') {
    UR.createTouch(payload).catch(() => {});
  } else if (V) {
    const MXT = buildAdapter('flock.touches', V);
    MXT.create(payload).catch(() => {});
  }
}

// Sort state — persists across view switches via localStorage
let _currentSort = (() => {
  try { return localStorage.getItem('flock_fold_sort') || 'firstName'; } catch (_) { return 'firstName'; }
})();

function _paintSortButtons(root) {
  root.querySelectorAll('.fold-sort').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.sort === _currentSort);
  });
}

function _sortRows(rows) {
  const sorted = rows.slice();
  sorted.sort((a, b) => {
    switch (_currentSort) {
      case 'lastName': {
        const la = (a.lastName  || a.displayName || '').toLowerCase();
        const lb = (b.lastName  || b.displayName || '').toLowerCase();
        return la < lb ? -1 : la > lb ? 1 : 0;
      }
      case 'role': {
        const ra = (a.role || a.memberType || '').toLowerCase();
        const rb = (b.role || b.memberType || '').toLowerCase();
        return ra < rb ? -1 : ra > rb ? 1 : 0;
      }
      case 'joinDate': {
        const da = a.joinDate || a.memberSince || a.createdAt || '';
        const db = b.joinDate || b.memberSince || b.createdAt || '';
        return da < db ? -1 : da > db ? 1 : 0;
      }
      case 'firstName':
      default: {
        const fa = (a.firstName || a.displayName || '').toLowerCase();
        const fb = (b.firstName || b.displayName || '').toLowerCase();
        return fa < fb ? -1 : fa > fb ? 1 : 0;
      }
    }
  });
  return sorted;
}

function _wireCards(grid, root) {
  const V = window.TheVine;
  grid.querySelectorAll('.fold-card').forEach((card) => {
    card.querySelectorAll('.fold-contact-btn[data-contact]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const kind  = btn.dataset.contact;
        const name  = btn.dataset.name || '';
        const value = btn.dataset.value || '';
        const tel   = btn.dataset.tel   || value.replace(/[^\d+]/g, '');
        const pid   = card.dataset.id   || '';
        _logTouch(pid, name, kind);
        if (kind === 'text')  openContactComposer({ channel: 'text',  name, recipient: value, target: tel });
        if (kind === 'email') openContactComposer({ channel: 'email', name, recipient: value, target: value });
      });
    });

    const dmBtn = card.querySelector('[data-fold-dm]');
    if (dmBtn) {
      dmBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const email = dmBtn.dataset.foldDm;
        if (!email) return;
        try {
          await dms.openWith(email);
          go('the_fellowship', { tab: 'dms' });
        } catch (err) {
          console.error('[TheFold] DM error:', err);
          alert(err?.message || 'Could not start a DM with that user.');
        }
      });
    }
    const open = () => {
      const person = _personMap[card.dataset.id];
      if (person) _openMemberSheet(person, V, () => _loadMembers(root));
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });
}

function _awaitBackend(ms = 15_000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const check = () => {
      const UR = (typeof window !== 'undefined') ? (window.UpperRoom || window.TheUpperRoom || null) : null;
      const V  = (typeof window !== 'undefined') ? window.TheVine   : null;
      const fsReady = !!(UR && typeof UR.isReady === 'function' && UR.isReady());
      if (fsReady || V) return resolve({ UR, V, fsReady });
      if (Date.now() - t0 >= ms) return resolve({ UR, V, fsReady: false });
      setTimeout(check, 200);
    };
    check();
  });
}

async function _loadMembers(root) {
  const { V, fsReady } = await _awaitBackend(15_000);
  const MXM = buildAdapter('flock.members', V);
  const grid  = root.querySelector('[data-bind="members"]');
  const stats = root.querySelector('[data-bind="stats"]');
  if (!grid) return;
  if (!MXM.isFirestore() && !V && !fsReady) {
    grid.innerHTML = '<div class="life-empty">Loading members…</div>';
    if (stats) stats.innerHTML = _loadingStats();
    setTimeout(() => { if (root.isConnected) _loadMembers(root); }, 500);
    return;
  }
  grid.innerHTML = '<div class="life-empty">Loading members…</div>';
  try {
    const res  = await MXM.list({ limit: 500 });
    const all  = _rows(res);
    // Filter client-side: keep active/non-inactive members
    const rows = all.filter(r => {
      const ms = String(r.membershipStatus || '').toLowerCase();
      const s  = String(r.status || r.active || r.Status || '').toLowerCase();
      return ms !== 'archived' && s !== 'inactive' && s !== 'false' && s !== '0' && s !== 'archived';
    });
    if (!rows.length) {
      grid.innerHTML = '<div class="life-empty">No members found yet. Click “Add Person” to begin.</div>';
      if (stats) stats.innerHTML = _loadingStats();
      return;
    }
    // Build lookup map
    _personMap = {};
    rows.forEach(r => {
      const key = r.id || r.memberNumber || r.email || '';
      if (key) _personMap[key] = r;
    });
    const sorted = _sortRows(rows);
    grid.innerHTML = sorted.map(_liveCard).join('');
    if (stats) stats.innerHTML = _liveStats(rows);
    _wireCards(grid, root);
    // Load background check statuses (non-blocking — re-renders cards with badges when ready)
    _loadBgChecks().then(() => {
      grid.innerHTML = sorted.map(_liveCard).join('');
      _wireCards(grid, root);
    }).catch(() => {});
  } catch (err) {
    console.error('[TheFold] members.list error:', err);
    grid.innerHTML = '<div class="life-empty">Could not load members right now.</div>';
  }
}

function _rows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

async function _loadBgChecks() {
  const db = window.firebase?.firestore?.();
  if (!db) return;
  try {
    const snap = await db.collection('backgroundChecks').get();
    _bgCheckMap = {};
    snap.docs.forEach(d => { _bgCheckMap[d.id] = d.data(); });
  } catch (_) {}
}

const _AVATAR_COLORS = ['#7c3aed','#0ea5e9','#059669','#c05818','#db2777','#6366f1','#0891b2','#b45309','#be185d','#4f46e5'];

function _liveCard(p) {
  const first    = p.firstName || '';
  const last     = p.lastName  || '';
  const name     = p.displayName || p.name || `${first} ${last}`.trim() || 'Unknown';
  const role     = (p.role || p.memberType || 'member').toLowerCase();
  const initials = (first ? first[0] : (name[0] || '')) + (last ? last[0] : (name[1] || ''));
  const yr       = p.joinDate ? new Date(p.joinDate).getFullYear() : (p.createdAt ? new Date(p.createdAt).getFullYear() : '');
  const color    = _AVATAR_COLORS[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % _AVATAR_COLORS.length];
  const uid      = p.id || p.memberNumber || p.memberPin || p.email || '';
  const email    = (p.email || p.primaryEmail || '').trim();
  const phoneRaw = (p.phone || p.primaryPhone || p.mobilePhone || '').trim();
  const phoneTel = phoneRaw.replace(/[^\d+]/g, '');
  const bgCheck  = _bgCheckMap[uid] || null;
  const bgBadge  = bgCheck?.status === 'clear'
    ? `<span class="wall-status-badge wall-status--ok" style="font-size:.66rem;padding:2px 7px">APPROVED</span>`
    : bgCheck?.status === 'consider'
      ? `<span class="wall-status-badge wall-status--error" style="font-size:.66rem;padding:2px 7px">NOT APPROVED</span>`
      : bgCheck?.status === 'pending'
        ? `<span class="wall-status-badge wall-status--warn" style="font-size:.66rem;padding:2px 7px">BG PENDING</span>`
        : '';
  const lsScan   = bgCheck?.liveScan;
  const lsBadge  = lsScan?.result === 'clear'
    ? `<span class="wall-status-badge wall-status--ok" style="font-size:.66rem;padding:2px 7px">LS CLEAR</span>`
    : lsScan?.result === 'pending'
      ? `<span class="wall-status-badge wall-status--warn" style="font-size:.66rem;padding:2px 7px">LS PENDING</span>`
      : lsScan?.result === 'failed'
        ? `<span class="wall-status-badge wall-status--error" style="font-size:.66rem;padding:2px 7px">LS FAILED</span>`
        : '';
  return `
    <article class="fold-card" role="listitem" tabindex="0"
             data-name="${_e(name.toLowerCase())}" data-role="${_e(role)}" data-id="${_e(uid)}">
      <div class="fold-avatar" style="background:${color}">${_e(initials.toUpperCase().slice(0,2))}</div>
      <div class="fold-card-body">
        <div class="fold-name">${_e(name)}</div>
        <div class="fold-meta">
          <span class="fold-role-badge fold-role-${_e(role)}">${_e(role)}</span>
          ${yr ? `<span class="fold-joined">Since ${yr}</span>` : ''}
          ${bgBadge}
          ${lsBadge}
        </div>
      </div>
      ${(phoneTel || email) ? `
      <div class="fold-card-actions" role="group" aria-label="Contact ${_e(name)}">
        ${phoneTel ? `
          <button type="button" class="flock-icon-btn flock-icon-btn--sm fold-contact-btn" data-contact="text" data-name="${_e(name)}" data-value="${_e(phoneRaw)}" data-tel="${_e(phoneTel)}" title="Text ${_e(name)}" aria-label="Text ${_e(name)}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.7-.8L3 21l1.9-5.3A8.4 8.4 0 1 1 21 11.5z"/></svg>
          </button>
          <a class="flock-icon-btn flock-icon-btn--sm fold-contact-btn" href="tel:${_e(phoneTel)}" data-contact="call" data-name="${_e(name)}" data-value="${_e(phoneRaw)}" title="Call ${_e(name)}" aria-label="Call ${_e(name)}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></svg>
          </a>` : ''}
        ${email ? `
          <button type="button" class="flock-icon-btn flock-icon-btn--sm fold-contact-btn" data-contact="email" data-name="${_e(name)}" data-value="${_e(email)}" title="Email ${_e(name)}" aria-label="Email ${_e(name)}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>
          </button>
          <button type="button" class="flock-btn flock-btn--sm fold-dm-btn" data-fold-dm="${_e(email)}" title="DM ${_e(name)}" aria-label="DM ${_e(name)}">DM</button>` : ''}
      </div>` : ''}
      <svg class="fold-card-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
    </article>`;
}

function _liveStats(rows) {
  const total    = rows.length;
  const leaders  = rows.filter(r => ['leader','elder','deacon','pastor','admin'].includes((r.role || r.memberType || '').toLowerCase())).length;
  const visitors = rows.filter(r => (r.role || r.memberType || '').toLowerCase() === 'visitor').length;
  const members  = total - leaders - visitors;
  return [
    { label: 'Total',    n: total,    color: 'var(--c-violet)' },
    { label: 'Members',  n: members,  color: 'var(--c-sky)' },
    { label: 'Visitors', n: visitors, color: 'var(--c-emerald)' },
    { label: 'Leaders',  n: leaders,  color: 'var(--gold)' },
  ].map((s) => `
    <div class="fold-stat-chip">
      <span class="fold-stat-dot" style="background:${s.color}"></span>
      <strong>${s.n}</strong> <span>${s.label}</span>
    </div>`).join('');
}

function _applyFilter(root, filter) {
  root.querySelectorAll('.fold-card').forEach((card) => {
    const role = card.dataset.role || 'member';
    card.style.display = (filter === 'all' || role === filter) ? '' : 'none';
  });
}

function _loadingStats() {
  return ['Total','Members','Visitors','Leaders'].map((label) => `
    <div class="fold-stat-chip">
      <span class="fold-stat-dot" style="background:var(--ink-muted,#7a7f96)"></span>
      <strong>—</strong> <span>${label}</span>
    </div>
  `).join('');
}

// ── Member detail sheet ──────────────────────────────────────────────────────
const MEMBER_TYPES = ['Visitor','Member','Volunteer','Leader','Deacon','Elder','Pastor','Admin'];
const ACCESS_ROLES = [
  { value: 'readonly',  label: 'Read Only — view-only access' },
  { value: 'volunteer', label: 'Volunteer — serving areas only' },
  { value: 'care',      label: 'Care Worker — pastoral care access' },
  { value: 'leader',   label: 'Leader — ministry leadership' },
  { value: 'pastor',   label: 'Pastor — full ministry access' },
  { value: 'admin',    label: 'Admin — complete access' },
];

function _closeMemberSheet(el) {
  const target = el || _activeFoldSheet;
  if (!target) return;
  const overlay = target.querySelector('.life-sheet-overlay');
  const panel   = target.querySelector('.life-sheet-panel');
  if (overlay) overlay.classList.remove('is-open');
  if (panel)   panel.classList.remove('is-open');
  setTimeout(() => { target.remove(); if (_activeFoldSheet === target) _activeFoldSheet = null; }, 320);
}

function _openMemberSheet(person, V, onReload) {
  _closeMemberSheet();
  const MXM = buildAdapter('flock.members', V);
  const MXP = buildAdapter('flock.permissions', V);
  const first   = person.firstName || '';
  const last    = person.lastName  || '';
  const name    = person.displayName || person.name || `${first} ${last}`.trim() || 'Unknown';
  const role    = (person.role || person.memberType || 'member');
  const docId   = person.id || '';                                               // Firestore document ID — always use for writes
  const uid     = person.memberNumber || person.memberPin || person.id || person.email || ''; // display / copy ID
  const initials = (first ? first[0] : (name[0] || '')) + (last ? last[0] : (name[1] || ''));
  const color   = _AVATAR_COLORS[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % _AVATAR_COLORS.length];
  const email    = (person.email || person.primaryEmail || '').trim();
  const phoneRaw = (person.phone || person.primaryPhone || person.mobilePhone || '').trim();
  const phoneTel = phoneRaw.replace(/[^\d+]/g, '');

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="Edit Member — ${_e(name)}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="fold-avatar" style="background:${color};width:38px;height:38px;font-size:0.88rem;flex-shrink:0;">${_e(initials.toUpperCase().slice(0,2))}</div>
          <div class="life-sheet-hd-info">
            <div class="life-sheet-hd-name">${_e(name)}</div>
            <div class="life-sheet-hd-meta">${_e(role)}</div>
            ${(phoneTel || email) ? `
            <div class="life-contact-actions" role="group" aria-label="Contact ${_e(name)}">
              ${phoneTel ? `
                <button type="button" class="flock-icon-btn life-contact-btn" data-contact="text" data-name="${_e(name)}" data-value="${_e(phoneRaw)}" data-tel="${_e(phoneTel)}" title="Text ${_e(name)} (${_e(phoneRaw)})" aria-label="Text ${_e(name)}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.7-.8L3 21l1.9-5.3A8.4 8.4 0 1 1 21 11.5z"/></svg>
                </button>
                <a class="flock-icon-btn life-contact-btn" href="tel:${_e(phoneTel)}" title="Call ${_e(name)} (${_e(phoneRaw)})" aria-label="Call ${_e(name)}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></svg>
                </a>` : ''}
              ${email ? `
                <button type="button" class="flock-icon-btn life-contact-btn" data-contact="email" data-name="${_e(name)}" data-value="${_e(email)}" title="Email ${_e(name)} (${_e(email)})" aria-label="Email ${_e(name)}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>
                </button>` : ''}
            </div>` : ''}
          </div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <!-- Quick Care Actions -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;padding:10px 0 14px;border-bottom:1px solid var(--border,#e5e7eb);margin-bottom:14px;">
          <button type="button" class="flock-btn flock-btn--sm" data-care-act="new-case" style="flex:1;min-width:100px;gap:5px;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
            New Case
          </button>
          <button type="button" class="flock-btn flock-btn--sm" data-care-act="new-prayer" style="flex:1;min-width:100px;gap:5px;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            New Prayer
          </button>
          <button type="button" class="flock-btn flock-btn--sm" data-care-act="new-connected" style="flex:1;min-width:100px;gap:5px;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            New Connected Case
          </button>
        </div>
        <!-- ID row -->
        <div class="fold-id-row">
          <span class="fold-id-label">Member ID</span>
          <code class="fold-id-code">${_e(uid || '—')}</code>
          <button class="fold-copy-btn" data-copy="${_e(uid)}" title="Copy ID" ${uid ? '' : 'disabled'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy ID
          </button>
        </div>
        <!-- Touch / Contact History -->
        <div class="fold-touches" data-bind="touches">
          <div class="fold-touches-hd">
            <span class="fold-touches-title">Contact History</span>
            <span class="fold-touches-count" data-bind="touch-count"></span>
          </div>
          <div class="fold-touches-list" data-bind="touch-list">
            <div class="fold-touches-empty">Loading…</div>
          </div>
        </div>
        <!-- Name -->
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">First Name</div>
            <input class="life-sheet-input" data-field="firstName" type="text" value="${_e(first)}" placeholder="First name">
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Last Name</div>
            <input class="life-sheet-input" data-field="lastName" type="text" value="${_e(last)}" placeholder="Last name">
          </div>
        </div>
        <!-- Contact -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Email</div>
          <input class="life-sheet-input" data-field="email" type="email" value="${_e(person.email || person.primaryEmail || '')}" placeholder="Email address">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Phone</div>
          <input class="life-sheet-input" data-field="phone" type="tel" value="${_e(person.phone || person.primaryPhone || person.mobilePhone || '')}" placeholder="Phone number">
        </div>
        <!-- Member Type -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Member Type</div>
          <select class="life-sheet-input" data-field="memberType">
            ${MEMBER_TYPES.map(t => `<option value="${_e(t.toLowerCase())}"${role.toLowerCase() === t.toLowerCase() ? ' selected' : ''}>${_e(t)}</option>`).join('')}
          </select>
        </div>
        <!-- Personal details -->
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Date of Birth</div>
            <input class="life-sheet-input" data-field="birthDate" type="date" value="${_e(person.birthDate || person.birthdate || '')}">
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Gender</div>
            <select class="life-sheet-input" data-field="gender">
              <option value="">— Select —</option>
              ${['Male','Female'].map(g => `<option value="${_e(g)}"${(person.gender||'') === g ? ' selected' : ''}>${_e(g)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Join Date</div>
          <input class="life-sheet-input" data-field="joinDate" type="date" value="${_e(person.joinDate || person.memberSince || '')}">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Notes</div>
          <textarea class="life-sheet-input" data-field="notes" rows="2" style="resize:vertical" placeholder="Pastoral notes, household info, etc.">${_e(person.notes || '')}</textarea>
        </div>
        <!-- Permissions -->
        <div class="fold-perm-section">
          <div class="fold-perm-section-title">🔐 FlockOS Access Level</div>
          <div class="fold-perm-section-sub">Controls what this person can see and do inside FlockOS.</div>
          <select class="life-sheet-input" data-field="accessRole" style="margin-top:8px;">
            <option value="">— No access (not a FlockOS user) —</option>
            ${ACCESS_ROLES.map(r => `<option value="${_e(r.value)}">${_e(r.label)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-icon-btn flock-icon-btn--warn" data-archive title="Archive member" aria-label="Archive member" style="margin-right:6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>
        </button>
        <button class="flock-icon-btn flock-icon-btn--danger" data-delete title="Delete member permanently" aria-label="Delete member permanently" style="margin-right:auto;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>Save Changes</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeFoldSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
  });

  // ── Fresh-data fetch — backfill form with latest Firestore values ──────────
  // The sheet opened with data from _personMap (built from list()). If that
  // list used the GAS fallback or had stale cache, fields may be wrong/empty.
  // A direct getMember() read always returns the current Firestore document.
  const _freshId = docId || uid;
  if (_freshId) {
    MXM.get(_freshId).then(fresh => {
      if (!fresh || !_activeFoldSheet) return;
      const _set = (field, val) => {
        if (val == null || val === '') return;
        const el = sheet.querySelector(`[data-field="${field}"]`);
        if (el) el.value = val;
      };
      _set('firstName',  fresh.firstName);
      _set('lastName',   fresh.lastName);
      _set('email',      fresh.email || fresh.primaryEmail);
      _set('phone',      fresh.phone || fresh.primaryPhone || fresh.mobilePhone);
      _set('memberType', (fresh.memberType || fresh.role || '').toLowerCase());
      _set('birthDate',  fresh.birthDate || fresh.birthdate);
      _set('gender',     fresh.gender);
      _set('joinDate',   fresh.joinDate || fresh.memberSince);
      const notesEl = sheet.querySelector('[data-field="notes"]');
      if (notesEl && fresh.notes != null) notesEl.value = fresh.notes;
    }).catch(() => { /* keep cached data on error */ });
  }

  // Load current permissions
  if (V && uid) {
    MXP.get({ memberId: uid }).then(res => {
      const currentRole = (res && (res.role || res.accessRole || res.level || '')) || '';
      const sel = sheet.querySelector('[data-field="accessRole"]');
      if (sel && currentRole) sel.value = currentRole.toLowerCase();
    }).catch(() => {});
  }

  // Load touch / contact history
  _loadTouches(sheet, docId || uid, V);

  // Copy ID
  sheet.querySelector('[data-copy]')?.addEventListener('click', async (e) => {
    const id = e.currentTarget.dataset.copy;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      const btn = e.currentTarget;
      const orig = btn.innerHTML;
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 1800);
    } catch {
      prompt('Copy this member ID:', id);
    }
  });

  // Quick Care Action buttons
  sheet.querySelectorAll('[data-care-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.careAct;
      if (act === 'new-case')       _openFoldCareSheet(person, { connected: false });
      if (act === 'new-prayer')     _openFoldPrayerSheet(person);
      if (act === 'new-connected')  _openFoldCareSheet(person, { connected: true });
    });
  });

  // Close
  sheet.querySelector('[data-cancel]').addEventListener('click', () => _closeMemberSheet());
  sheet.querySelector('.life-sheet-close').addEventListener('click', () => _closeMemberSheet());

  // Contact buttons in sheet header
  sheet.querySelectorAll('[data-contact]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      const kind  = btn.dataset.contact;
      const n     = btn.dataset.name  || name;
      const value = btn.dataset.value || '';
      const tel   = btn.dataset.tel   || value.replace(/[^\d+]/g, '');
      _logTouch(docId || uid, n, kind);
      if (kind === 'text')  { ev.preventDefault(); openContactComposer({ channel: 'text',  name: n, recipient: value, target: tel }); }
      if (kind === 'email') { ev.preventDefault(); openContactComposer({ channel: 'email', name: n, recipient: value, target: value }); }
      // 'call' falls through to native <a href="tel:"> — touch is logged above
    });
  });

  // Save
  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Saving…';
    const updates = {
      id:         docId || uid,
      firstName:  sheet.querySelector('[data-field="firstName"]').value.trim(),
      lastName:   sheet.querySelector('[data-field="lastName"]').value.trim(),
      email:      sheet.querySelector('[data-field="email"]').value.trim(),
      phone:      sheet.querySelector('[data-field="phone"]').value.trim(),
      memberType: sheet.querySelector('[data-field="memberType"]').value,
      birthDate:  sheet.querySelector('[data-field="birthDate"]').value || undefined,
      gender:     sheet.querySelector('[data-field="gender"]').value || undefined,
      joinDate:   sheet.querySelector('[data-field="joinDate"]').value || undefined,
      notes:      sheet.querySelector('[data-field="notes"]').value.trim() || undefined,
    };
    // Firestore rejects `undefined` field values — strip empty optional fields.
    Object.keys(updates).forEach(k => { if (updates[k] === undefined) delete updates[k]; });
    const accessRole = sheet.querySelector('[data-field="accessRole"]').value;
    try {
      if (!MXM.isFirestore() && !window.TheVine?.flock?.members?.update) {
        throw new Error('Directory sync is not ready yet. Please wait a moment and try again.');
      }
      const result = await MXM.update(updates);
      // Guard against silent GAS no-op (adapter returns null when verb is unimplemented)
      if (result === null && !MXM.isFirestore()) {
        throw new Error('Member could not be saved — directory sync unavailable. Please try again.');
      }
      if (accessRole && uid) {
        await MXP.set({ memberId: uid, role: accessRole });
      }
      _closeMemberSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheFold] member update error:', err);
      btn.disabled = false; btn.textContent = 'Save Changes';
      alert(err?.message || 'Could not save member changes.');
    }
  });

  // ── Inline confirmation modal helper ─────────────────────────────────────
  // Shows a modal layered over the sheet panel itself — no browser dialog.
  // opts: { title, body, confirmLabel, confirmClass, requireInput, inputPlaceholder, inputExpected, onConfirm }
  function _sheetConfirm(opts) {
    const existing = sheet.querySelector('.fold-sheet-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'fold-sheet-modal';
    modal.style.cssText = [
      'position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;',
      'background:rgba(0,0,0,.45);backdrop-filter:blur(2px);border-radius:inherit;padding:20px;',
    ].join('');

    const inputHtml = opts.requireInput ? `
      <input type="text" class="life-sheet-input fold-sheet-modal-input" placeholder="${_e(opts.inputPlaceholder || '')}" autocomplete="off"
        style="margin:10px 0 4px;font-size:.92rem;" />
      <div class="fold-sheet-modal-hint" style="font-size:.75rem;color:var(--ink-muted);margin-bottom:4px">${_e(opts.inputHint || '')}</div>
    ` : '';

    modal.innerHTML = `
      <div style="background:var(--bg-raised,#fff);border-radius:14px;padding:22px 20px 18px;
        box-shadow:0 8px 32px rgba(0,0,0,.22);max-width:340px;width:100%;">
        <div style="font-weight:700;font-size:1rem;color:var(--ink,#1b264f);margin-bottom:8px">${opts.title || 'Are you sure?'}</div>
        <div style="font-size:.85rem;color:var(--ink-muted);line-height:1.55;margin-bottom:12px">${opts.body || ''}</div>
        ${inputHtml}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="flock-btn" data-modal-cancel type="button">Cancel</button>
          <button class="flock-btn ${opts.confirmClass || 'flock-btn--primary'}" data-modal-confirm type="button"
            ${opts.requireInput ? 'disabled' : ''}>${_e(opts.confirmLabel || 'Confirm')}</button>
        </div>
      </div>`;

    // Position relative anchor on the panel
    const panel = sheet.querySelector('.life-sheet-panel');
    panel.style.position = 'relative';
    panel.appendChild(modal);

    const confirmBtn = modal.querySelector('[data-modal-confirm]');
    const cancelBtn  = modal.querySelector('[data-modal-cancel]');

    if (opts.requireInput) {
      const inp = modal.querySelector('.fold-sheet-modal-input');
      inp.addEventListener('input', () => {
        confirmBtn.disabled = inp.value.trim().toLowerCase() !== opts.inputExpected.trim().toLowerCase();
      });
      inp.focus();
    }

    cancelBtn.addEventListener('click', () => modal.remove());
    confirmBtn.addEventListener('click', () => {
      modal.remove();
      opts.onConfirm();
    });
  }

  // Archive (soft — hide from directory)
  sheet.querySelector('[data-archive]').addEventListener('click', () => {
    _sheetConfirm({
      title: `Archive ${name}?`,
      body: 'They will be hidden from the directory but their records are preserved. You can restore them from Admin later.',
      confirmLabel: 'Archive',
      confirmClass: 'flock-btn--secondary',
      onConfirm: async () => {
        const btn = sheet.querySelector('[data-archive]');
        btn.disabled = true;
        try {
          await MXM.update({ id: docId || uid, status: 'Inactive', membershipStatus: 'Archived' });
          _closeMemberSheet();
          onReload?.();
        } catch (err) {
          console.error('[TheFold] member archive error:', err);
          btn.disabled = false;
          _sheetConfirm({
            title: 'Archive failed',
            body: err?.message || 'Could not archive this person. Please try again.',
            confirmLabel: 'OK',
            onConfirm: () => {},
          });
        }
      },
    });
  });

  // Delete (hard — destructive, type-to-confirm)
  sheet.querySelector('[data-delete]').addEventListener('click', () => {
    const expected = (first || name.split(' ')[0] || name).trim().toLowerCase();
    _sheetConfirm({
      title: `Permanently delete ${name}?`,
      body: `<strong style="color:#b91c1c">This cannot be undone.</strong> All records for this person will be permanently removed.`,
      confirmLabel: 'Delete permanently',
      confirmClass: 'flock-btn--danger',
      requireInput: true,
      inputPlaceholder: `Type "${first || name.split(' ')[0] || name}" to confirm`,
      inputHint: `Type the first name exactly to enable the delete button.`,
      inputExpected: expected,
      onConfirm: async () => {
        const btn = sheet.querySelector('[data-delete]');
        btn.disabled = true;
        try {
          await MXM.delete(docId || uid);
          _closeMemberSheet();
          onReload?.();
        } catch (err) {
          console.error('[TheFold] member delete error:', err);
          btn.disabled = false;
          _sheetConfirm({
            title: 'Delete failed',
            body: err?.message || 'Could not delete this person. Please try again.',
            confirmLabel: 'OK',
            onConfirm: () => {},
          });
        }
      },
    });
  });
}

// ── Touch log loader & renderer ──────────────────────────────────────────────
const _TOUCH_ICONS = {
  text:    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.7-.8L3 21l1.9-5.3A8.4 8.4 0 1 1 21 11.5z"/></svg>',
  call:    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></svg>',
  email:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
  unknown: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
};
const _TOUCH_LABELS = { text: 'Texted', call: 'Called', email: 'Emailed', unknown: 'Contacted' };

function _fmtTouchDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

async function _loadTouches(sheet, memberId, V) {
  const listEl  = sheet.querySelector('[data-bind="touch-list"]');
  const countEl = sheet.querySelector('[data-bind="touch-count"]');
  if (!listEl) return;

  try {
    const UR = window.UpperRoom;
    let touches = [];
    if (UR && typeof UR.listTouches === 'function') {
      touches = await UR.listTouches({ memberId, limit: 50 });
    } else if (V) {
      const MXT = buildAdapter('flock.touches', V);
      const res = await MXT.list({ memberId, limit: 50 });
      touches = Array.isArray(res) ? res : (res?.rows || res?.data || []);
    }

    if (countEl) countEl.textContent = touches.length ? `${touches.length}` : '';

    if (!touches.length) {
      listEl.innerHTML = '<div class="fold-touches-empty">No contacts logged yet.</div>';
      return;
    }

    listEl.innerHTML = touches.map(t => {
      const ch      = t.channel || 'unknown';
      const icon    = _TOUCH_ICONS[ch] || _TOUCH_ICONS.unknown;
      const label   = _TOUCH_LABELS[ch] || 'Contacted';
      const when    = _fmtTouchDate(t.loggedAt);
      const by      = t.loggedBy ? `by ${_e(t.loggedBy)}` : '';
      const note    = t.note     ? `<div class="fold-touch-note">${_e(t.note)}</div>` : '';
      return `<div class="fold-touch-row">
        <span class="fold-touch-icon fold-touch-icon--${_e(ch)}">${icon}</span>
        <div class="fold-touch-body">
          <span class="fold-touch-label">${_e(label)}</span>
          ${when ? `<span class="fold-touch-when">${_e(when)}</span>` : ''}
          ${by   ? `<span class="fold-touch-by">${by}</span>` : ''}
          ${note}
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    if (listEl) listEl.innerHTML = '<div class="fold-touches-empty" style="color:#b91c1c">Could not load contact history.</div>';
    console.warn('[TheFold] touches load error:', err);
  }
}

function _e(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Quick-access Care Case sheet (New Case + New Connected Case) ─────────────
let _activeFoldCareSheet = null;

function _closeFoldCareSheet() {
  const t = _activeFoldCareSheet;
  if (!t) return;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activeFoldCareSheet === t) _activeFoldCareSheet = null; }, 320);
}

const _FOLD_CARE_TYPES = [
  { group: 'Crisis & Safety',            options: [['Crisis','🚨 Crisis'],['Abuse / Domestic Violence','🛡️ Abuse / DV']] },
  { group: 'Medical & Physical',         options: [['Hospital Visit','🏥 Hospital Visit'],['Medical','🩺 Medical'],['Elder Care','🧓 Elder Care'],['Terminal Illness / End of Life','🕯️ Terminal / End of Life']] },
  { group: 'Grief & Loss',               options: [['Grief','🤍 Grief'],['Pregnancy & Infant Loss','🕊️ Pregnancy & Infant Loss']] },
  { group: 'Relationships',              options: [['Marriage','💍 Marriage'],['Pre-Marriage','💑 Pre-Marriage'],['Family','👨‍👩‍👧 Family']] },
  { group: 'Addiction & Recovery',       options: [['Addiction','🔗 Addiction'],['Pornography / Sexual Addiction','🔒 Sexual Addiction']] },
  { group: 'Mental & Emotional Health',  options: [['Mental Health','🧠 Mental Health'],['Counseling','💬 Counseling']] },
  { group: 'Discipleship & Growth',      options: [['New Believer','✨ New Believer'],['New Member Integration','🤝 New Member Integration'],['Discipleship','📚 Discipleship'],['Shepherding','🐑 Shepherding'],['Restoration','🔄 Restoration']] },
  { group: 'Life Situations',            options: [['Financial','💰 Financial'],['Immigration / Deportation','✈️ Immigration / Deportation'],['Incarceration & Re-Entry','🔑 Incarceration & Re-Entry'],['Gender Identity / Sexuality','✝️ Gender Identity / Sexuality']] },
  { group: 'General',                    options: [['Prayer Request','🙏 Prayer Request'],['Follow-Up','📞 Follow-Up'],['Life Milestone','🎉 Life Milestone'],['Other','🫱 Other']] },
];

const _FOLD_PRIORITIES = ['urgent', 'high', 'normal', 'low'];
const _FOLD_PRIORITY_LABELS = { urgent: '🚨 Urgent', high: '🔴 High', normal: '🟡 Normal', low: '🟢 Low' };

function _openFoldCareSheet(person, { connected = false } = {}) {
  _closeFoldCareSheet();
  const V   = window.TheVine;
  const MXC = buildAdapter('flock.care', V);
  const first = person.firstName || '';
  const last  = person.lastName  || '';
  const name  = person.displayName || person.name || `${first} ${last}`.trim() || 'Unknown';
  const uid   = person.id || person.memberNumber || person.memberPin || person.email || '';
  const color = _AVATAR_COLORS[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % _AVATAR_COLORS.length];
  const initials = (first ? first[0] : (name[0] || '')) + (last ? last[0] : (name[1] || ''));

  const title = connected ? 'New Connected Case' : 'New Care Case';

  const careTypeOptions = _FOLD_CARE_TYPES.map(g =>
    `<optgroup label="${_e(g.group)}">${g.options.map(([v,l]) => `<option value="${_e(v)}">${_e(l)}</option>`).join('')}</optgroup>`
  ).join('');

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${_e(title)} — ${_e(name)}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="fold-avatar" style="background:${color};width:34px;height:34px;font-size:0.82rem;flex-shrink:0;">${_e(initials.toUpperCase().slice(0,2))}</div>
          <div class="life-sheet-hd-info">
            <div class="life-sheet-hd-name">${_e(title)}</div>
            <div class="life-sheet-hd-meta">${_e(name)}</div>
          </div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <!-- Care Type -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Care Type <span style="color:#dc2626">*</span></div>
          <select class="life-sheet-input" data-field="careType" autofocus>
            <option value="">— Select a care type —</option>
            ${careTypeOptions}
          </select>
        </div>
        <!-- Priority pills -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Priority</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
            ${_FOLD_PRIORITIES.map(p => `<button type="button" class="life-status-pill${p === 'normal' ? ' is-active' : ''}" data-priority="${_e(p)}" style="cursor:pointer">${_e(_FOLD_PRIORITY_LABELS[p])}</button>`).join('')}
          </div>
        </div>
        ${connected ? `
        <!-- Link to existing case -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Linked Case ID <span style="color:#6b7280;font-weight:400">(optional)</span></div>
          <input class="life-sheet-input" data-field="connectedCaseId" type="text" placeholder="Parent or related case ID">
          <div data-cases-loading style="font-size:.8rem;color:var(--ink-muted,#7a7f96);margin-top:4px;">Loading existing cases…</div>
          <select class="life-sheet-input" data-case-select style="margin-top:6px;display:none;">
            <option value="">— Pick an existing case —</option>
          </select>
        </div>` : ''}
        <!-- Summary -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Summary</div>
          <textarea class="life-sheet-input" data-field="summary" rows="3" placeholder="What's the situation?"></textarea>
        </div>
        <!-- Error -->
        <div data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:4px;"></div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>${connected ? 'Create Connected Case' : 'Create Case'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeFoldCareSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    sheet.querySelector('[data-field="careType"]')?.focus();
  });

  // Priority pills
  sheet.querySelectorAll('[data-priority]').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('[data-priority]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  // If connected case mode: load this person's existing cases for quick linking
  if (connected && uid) {
    const UR = window.UpperRoom;
    const caseInput  = sheet.querySelector('[data-field="connectedCaseId"]');
    const caseSel    = sheet.querySelector('[data-case-select]');
    const caseLoader = sheet.querySelector('[data-cases-loading]');
    const loadCases = async () => {
      try {
        let rows = [];
        if (UR && typeof UR.listCareCases === 'function') {
          const res = await UR.listCareCases({ memberId: uid });
          rows = Array.isArray(res) ? res : (res?.cases || []);
        } else {
          const res = await MXC.list({ memberId: uid, limit: 50 });
          rows = Array.isArray(res) ? res : (res?.rows || res?.data || []);
        }
        if (caseLoader) caseLoader.style.display = 'none';
        if (rows.length && caseSel) {
          rows.forEach(c => {
            const opt = document.createElement('option');
            opt.value       = c.id || '';
            const label     = [c.careType || c.type || 'Case', c.summary ? `— ${c.summary.slice(0, 40)}` : '', c.status ? `[${c.status}]` : ''].filter(Boolean).join(' ');
            opt.textContent = label;
            caseSel.appendChild(opt);
          });
          caseSel.style.display = '';
          caseSel.addEventListener('change', () => {
            if (caseSel.value && caseInput) caseInput.value = caseSel.value;
          });
        } else if (caseLoader) {
          caseLoader.textContent = 'No existing cases found — enter a case ID manually.';
          caseLoader.style.display = '';
        }
      } catch {
        if (caseLoader) { caseLoader.textContent = 'Could not load existing cases.'; caseLoader.style.display = ''; }
      }
    };
    loadCases();
  } else {
    const caseLoader = sheet.querySelector('[data-cases-loading]');
    if (caseLoader) caseLoader.style.display = 'none';
  }

  sheet.querySelector('[data-cancel]').addEventListener('click', () => _closeFoldCareSheet());
  sheet.querySelector('.life-sheet-close').addEventListener('click', () => _closeFoldCareSheet());

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl    = sheet.querySelector('[data-error]');
    const careType = sheet.querySelector('[data-field="careType"]').value;
    if (!careType) {
      errEl.textContent = 'Please select a care type.';
      errEl.style.display = '';
      sheet.querySelector('[data-field="careType"]')?.focus();
      return;
    }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Creating…';
    const priority = sheet.querySelector('[data-priority].is-active')?.dataset.priority || 'normal';
    const summary  = sheet.querySelector('[data-field="summary"]')?.value.trim() || '';
    const connectedCaseId = connected ? (sheet.querySelector('[data-field="connectedCaseId"]')?.value.trim() || '') : '';
    const payload = { memberId: uid, careType, priority, status: 'Open' };
    if (summary)         payload.summary         = summary;
    if (connectedCaseId) payload.connectedCaseId = connectedCaseId;
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.createCareCase === 'function') {
        await UR.createCareCase(payload);
      } else {
        await MXC.create(payload);
      }
      _closeFoldCareSheet();
    } catch (err) {
      console.error('[TheFold] care case create error:', err);
      errEl.textContent = err?.message || 'Could not create case. Please try again.';
      errEl.style.display = '';
      btn.disabled = false;
      btn.textContent = connected ? 'Create Connected Case' : 'Create Case';
    }
  });
}

// ── Quick-access Prayer Request sheet ────────────────────────────────────────
let _activeFoldPrayerSheet = null;

function _closeFoldPrayerSheet() {
  const t = _activeFoldPrayerSheet;
  if (!t) return;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activeFoldPrayerSheet === t) _activeFoldPrayerSheet = null; }, 320);
}

const _FOLD_PR_CATEGORIES = ['Intercession','Praise','Personal','Urgent','Healing','Guidance','Family'];

function _openFoldPrayerSheet(person) {
  _closeFoldPrayerSheet();
  const V  = window.TheVine;
  const MX = buildAdapter('flock.prayer', V);
  const first = person.firstName || '';
  const last  = person.lastName  || '';
  const name  = person.displayName || person.name || `${first} ${last}`.trim() || 'Unknown';
  const color = _AVATAR_COLORS[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % _AVATAR_COLORS.length];
  const initials = (first ? first[0] : (name[0] || '')) + (last ? last[0] : (name[1] || ''));

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="New Prayer Request — ${_e(name)}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="fold-avatar" style="background:${color};width:34px;height:34px;font-size:0.82rem;flex-shrink:0;">${_e(initials.toUpperCase().slice(0,2))}</div>
          <div class="life-sheet-hd-info">
            <div class="life-sheet-hd-name">New Prayer Request</div>
            <div class="life-sheet-hd-meta">${_e(name)}</div>
          </div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Prayer Request <span style="color:#dc2626">*</span></div>
          <textarea class="life-sheet-input" data-field="prayerText" rows="4" style="resize:vertical" placeholder="Share the prayer need…"></textarea>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Category</div>
          <select class="life-sheet-input" data-field="category">
            <option value="">— select —</option>
            ${_FOLD_PR_CATEGORIES.map(c => `<option value="${_e(c)}">${_e(c)}</option>`).join('')}
          </select>
        </div>
        <div class="life-sheet-field" style="display:flex;align-items:center;gap:10px;">
          <input type="checkbox" data-field="isConfidential" id="fold-pr-conf" style="width:auto">
          <label for="fold-pr-conf" class="life-sheet-label" style="margin:0">🔒 Mark as confidential (pastoral eyes only)</label>
        </div>
        <div data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:4px;"></div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>Add Prayer</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeFoldPrayerSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    sheet.querySelector('[data-field="prayerText"]')?.focus();
  });

  sheet.querySelector('[data-cancel]').addEventListener('click', () => _closeFoldPrayerSheet());
  sheet.querySelector('.life-sheet-close').addEventListener('click', () => _closeFoldPrayerSheet());

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl   = sheet.querySelector('[data-error]');
    const txtVal  = sheet.querySelector('[data-field="prayerText"]').value.trim();
    if (!txtVal) {
      errEl.textContent = 'Prayer request text is required.';
      errEl.style.display = '';
      sheet.querySelector('[data-field="prayerText"]')?.focus();
      return;
    }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Submitting…';
    const isConf  = sheet.querySelector('[data-field="isConfidential"]').checked;
    const payload = {
      submitterName:  name,
      prayerText:     txtVal,
      category:       sheet.querySelector('[data-field="category"]').value || undefined,
      isConfidential: isConf ? 'TRUE' : 'FALSE',
      status:         'New',
    };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.createPrayer === 'function') {
        await UR.createPrayer(payload);
      } else {
        await MX.create(payload);
      }
      _closeFoldPrayerSheet();
    } catch (err) {
      console.error('[TheFold] prayer create error:', err);
      errEl.textContent = err?.message || 'Could not submit prayer request. Please try again.';
      errEl.style.display = '';
      btn.disabled = false; btn.textContent = 'Add Prayer';
    }
  });
}
function _openNewMemberSheet(onReload) {
  _closeMemberSheet();
  const V   = window.TheVine;
  const MXM = buildAdapter('flock.members', V);
  const MXP = buildAdapter('flock.permissions', V);
  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="Add New Person">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="fold-avatar" style="background:var(--c-violet);width:38px;height:38px;font-size:1.2rem;flex-shrink:0;">✝</div>
          <div class="life-sheet-hd-info">
            <div class="life-sheet-hd-name">Add New Person</div>
            <div class="life-sheet-hd-meta">New member, visitor, or leader</div>
          </div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <!-- Name -->
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">First Name <span style="color:#dc2626">*</span></div>
            <input class="life-sheet-input" data-field="firstName" type="text" placeholder="First name" autofocus>
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Last Name</div>
            <input class="life-sheet-input" data-field="lastName" type="text" placeholder="Last name">
          </div>
        </div>
        <!-- Contact -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Email</div>
          <input class="life-sheet-input" data-field="email" type="email" placeholder="Email address">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Phone</div>
          <input class="life-sheet-input" data-field="phone" type="tel" placeholder="Phone number">
        </div>
        <!-- Member Type -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Member Type</div>
          <select class="life-sheet-input" data-field="memberType">
            ${MEMBER_TYPES.map(t => `<option value="${_e(t.toLowerCase())}"${t === 'Visitor' ? ' selected' : ''}>${_e(t)}</option>`).join('')}
          </select>
        </div>
        <!-- Personal details -->
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Date of Birth</div>
            <input class="life-sheet-input" data-field="birthDate" type="date">
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Gender</div>
            <select class="life-sheet-input" data-field="gender">
              <option value="">— Select —</option>
              ${['Male','Female'].map(g => `<option value="${_e(g)}">${_e(g)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Notes</div>
          <textarea class="life-sheet-input" data-field="notes" rows="2" style="resize:vertical" placeholder="Any additional notes…"></textarea>
        </div>
        <div class="fold-perm-section">
          <div class="fold-perm-section-title">🔐 FlockOS Access Level</div>
          <div class="fold-perm-section-sub">Optional — grant access so they can log in to FlockOS.</div>
          <select class="life-sheet-input" data-field="accessRole" style="margin-top:8px;">
            <option value="">— No access —</option>
            ${ACCESS_ROLES.map(r => `<option value="${_e(r.value)}">${_e(r.label)}</option>`).join('')}
          </select>
          <div data-passcode-row style="display:none;margin-top:10px">
            <div class="life-sheet-label" style="margin-bottom:4px">Initial Passcode <span style="color:#dc2626">*</span></div>
            <input class="life-sheet-input" data-field="passcode" type="password" placeholder="Min. 6 characters" autocomplete="new-password">
            <div style="font-size:.78rem;color:var(--c-muted,#888);margin-top:4px">The person will use this to log in. They can change it later.</div>
          </div>
        </div>
        <!-- Error slot -->
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>Add Person</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeFoldSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    sheet.querySelector('[data-field="firstName"]')?.focus();
  });

  sheet.querySelector('[data-cancel]').addEventListener('click', () => _closeMemberSheet());
  sheet.querySelector('.life-sheet-close').addEventListener('click', () => _closeMemberSheet());

  // Show/hide passcode field based on access role selection
  sheet.querySelector('[data-field="accessRole"]').addEventListener('change', function() {
    const row = sheet.querySelector('[data-passcode-row]');
    if (row) row.style.display = this.value ? '' : 'none';
  });

    sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const firstName = sheet.querySelector('[data-field="firstName"]').value.trim();
    const errEl     = sheet.querySelector('[data-error]');
    if (!firstName) { errEl.textContent = 'First name is required.'; errEl.style.display = ''; return; }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Adding…';
    const payload = {
      firstName,
      lastName:   sheet.querySelector('[data-field="lastName"]').value.trim(),
      email:      sheet.querySelector('[data-field="email"]').value.trim(),
      phone:      sheet.querySelector('[data-field="phone"]').value.trim(),
      memberType: sheet.querySelector('[data-field="memberType"]').value,
      birthDate:  sheet.querySelector('[data-field="birthDate"]').value || undefined,
      gender:     sheet.querySelector('[data-field="gender"]').value || undefined,
      notes:      sheet.querySelector('[data-field="notes"]').value.trim() || undefined,
    };
    // Firestore rejects `undefined` field values — strip empty optional fields.
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    const accessRole = sheet.querySelector('[data-field="accessRole"]').value;
    const passcode    = sheet.querySelector('[data-field="passcode"]')?.value.trim() || '';

    // Validate access requirements before hitting the server
    if (accessRole) {
      if (!payload.email) {
        errEl.textContent = 'Email is required when granting FlockOS access.'; errEl.style.display = ''; btn.disabled = false; btn.textContent = 'Add Person'; return;
      }
      if (passcode.length < 6) {
        errEl.textContent = 'Passcode must be at least 6 characters.'; errEl.style.display = ''; btn.disabled = false; btn.textContent = 'Add Person'; return;
      }
    }

    try {
      const res = await MXM.create(payload);
      const newId = res?.id || res?.memberId || res?.memberNumber;

      if (accessRole && newId) {
        // 1. Write Firestore memberRole doc
        await MXP.set({ memberId: newId, role: accessRole });

        // 2. Create GAS auth credentials (AuthUsers + AccessControl sheets)
        // Use flock.call() directly to bypass TheVine's camelCase→Title Case
        // normalization (_WRITE_VERBS), which would mangle the param keys
        // (email→Email, passcode→Passcode) before GAS reads them.
        if (V && payload.email) {
          try {
            await V.flock.call('users.create', {
              targetEmail: payload.email,
              role:        accessRole,
              passcode,
              firstName:   payload.firstName || '',
              lastName:    payload.lastName  || '',
            });
          } catch (authErr) {
            // Member + role saved — surface the auth failure non-fatally
            console.warn('[TheFold] GAS user create failed:', authErr);
            errEl.textContent = `Member added, but login account could not be created: ${authErr?.message || authErr}. Use Admin → Users to set their passcode manually.`;
            errEl.style.display = '';
            setTimeout(() => { _closeMemberSheet(); onReload?.(); }, 4000);
            return;
          }
        }
      }

      _closeMemberSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheFold] member create error:', err);
      errEl.textContent = err?.message || 'Could not create member. Please try again.';
      errEl.style.display = '';
      btn.disabled = false; btn.textContent = 'Add Person';
    }
  });
}
