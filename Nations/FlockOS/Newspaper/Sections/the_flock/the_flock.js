// the_flock.js — Section 4: The Flock
// Care board, prayer chain, and compassion stub wired Firestore-first via
// the_living_water_adapter.js with GAS + localStorage fallback.

import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';

const DEFAULT_LIMIT = 50;
const MAX_LIST_ITEMS = 12;

const LS_KEYS = {
  cases: 'flock_cases_v2',
  prayers: 'flock_prayers_v2',
  assignments: 'flock_assignments_v2',
};

const CARE_TYPES = [
  'Crisis',
  'Grief',
  'Medical',
  'Marriage',
  'Addiction',
  'Family',
  'Housing',
  'Employment',
  'Financial',
  'Counseling',
  'Hospitalization',
  'Bereavement',
  'Salvation',
  'Discipleship',
  'Relocation',
  'Loneliness',
  'Hospital Visit',
  'New Baby',
  'Funeral',
  'Relationship',
  'Youth',
  'Mental Health',
  'Restoration',
  'Follow-Up',
  'Other',
];

const CARE_STATUSES = ['Open', 'Active', 'Praying', 'Resolved', 'Closed'];
const PRAYER_STATUSES = ['Open', 'Answered', 'Archived'];

const adapter = {
  care: buildAdapter('flock.care', window.TheVine),
  interactions: buildAdapter('flock.care.interactions', window.TheVine),
  assignments: buildAdapter('flock.care.assignments', window.TheVine),
  prayers: buildAdapter('flock.prayer', window.TheVine),
};

const state = {
  profile: null,
  cases: [],
  prayers: [],
  assignments: [],
  myAssignments: [],
  caseQuery: '',
  caseFilter: 'all',
  prayerQuery: '',
  prayerFilter: 'all',
  source: {
    cases: 'loading',
    prayers: 'loading',
    assignments: 'loading',
  },
};

function _qs(id) {
  return document.getElementById(id);
}

function _e(value) {
  return String(value ?? '');
}

function _now() {
  return Date.now();
}

function _toast(message, type = 'info') {
  const gates = window.FlockGates || {};
  const fn = gates.showToast || gates.toast;
  if (typeof fn === 'function') {
    fn.call(gates, message, type);
  }
}

function _openDrawer(title, html) {
  if (window.FlockGates && typeof window.FlockGates.openDrawer === 'function') {
    window.FlockGates.openDrawer(title, html);
  }
}

function _formatDate(value) {
  try {
    if (!value) return '';
    if (typeof value === 'object' && value !== null && typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (_) {
    return '';
  }
}

function _statusLabel(value, fallback = 'Open') {
  return value || fallback;
}

function _rowValue(row, keys, fallback = '') {
  for (const key of keys) {
    const value = row && row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  }
  return fallback;
}

function _normalizeRows(result) {
  if (Array.isArray(result)) return result;
  if (!result) return [];
  if (Array.isArray(result.results)) return result.results;
  if (Array.isArray(result.rows)) return result.rows;
  if (Array.isArray(result.items)) return result.items;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.docs)) {
    return result.docs.map(doc => {
      if (!doc) return null;
      if (typeof doc.data === 'function') return { id: doc.id, ...doc.data() };
      return { id: doc.id, ...doc };
    }).filter(Boolean);
  }
  return [];
}

function _readCache(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function _writeCache(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify(rows || []));
  } catch (_) {}
}

function _sourceLabel(source) {
  if (source === 'firestore') return 'Live Firestore';
  if (source === 'gas') return 'GAS fallback';
  if (source === 'cache') return 'Cached';
  return 'Empty';
}

function _isClosed(status) {
  const label = String(status || '').toLowerCase();
  return ['resolved', 'closed', 'archived'].includes(label);
}

function _caseTitle(item) {
  return _rowValue(item, ['name', 'memberName', 'subject', 'title', 'summary'], 'Untitled care case');
}

function _caseType(item) {
  return _rowValue(item, ['type', 'category'], 'Care');
}

function _caseStatus(item) {
  return _rowValue(item, ['status', 'state'], 'Open');
}

function _caseAssignedTo(item) {
  return _rowValue(item, ['assignedTo', 'caregiverName', 'caregiverId', 'primaryCaregiverId'], 'Unassigned');
}

function _caseFollowUp(item) {
  return _rowValue(item, ['nextFollowUp', 'followUpDate', 'followUpAt'], '');
}

function _prayerText(item) {
  return _rowValue(item, ['prayerText', 'request', 'text', 'message', 'note'], 'Prayer request');
}

function _prayerName(item) {
  return _rowValue(item, ['submitterName', 'name', 'memberName', 'requester', 'author'], 'Anonymous');
}

function _prayerCategory(item) {
  return _rowValue(item, ['category', 'type', 'group'], 'Prayer');
}

async function _loadRows(adapterRef, params, cacheKey, sourceKey) {
  try {
    const result = await adapterRef.list(params);
    const rows = _normalizeRows(result);
    if (rows.length) {
      _writeCache(cacheKey, rows);
      state.source[sourceKey] = adapterRef.isFirestore && adapterRef.isFirestore() ? 'firestore' : 'gas';
      return rows;
    }
  } catch (err) {
    console.warn('[the_flock] live load failed for ' + sourceKey + ':', err);
  }

  const cached = _readCache(cacheKey);
  if (cached.length) {
    state.source[sourceKey] = 'cache';
    return cached;
  }

  state.source[sourceKey] = 'empty';
  return [];
}

async function loadProfile() {
  let profile = null;
  try {
    const module = await import('../../Scripts/the_priesthood/index.js');
    if (typeof module.whoAmI === 'function') {
      profile = await module.whoAmI();
    }
  } catch (err) {
    console.warn('[the_flock] profile import failed', err);
  }

  if (!profile && window.Nehemiah && typeof window.Nehemiah.getProfile === 'function') {
    profile = window.Nehemiah.getProfile();
  }

  if (!profile && window.Nehemiah && typeof window.Nehemiah.getSession === 'function') {
    profile = window.Nehemiah.getSession();
  }

  return profile || null;
}

async function ensureUpperRoom() {
  const UR = window.UpperRoom;
  if (!UR) return null;
  if (typeof UR.isReady === 'function' && UR.isReady()) return UR;
  if (typeof UR.init === 'function') {
    try { await UR.init(); } catch (_) {}
  }
  return UR;
}

async function loadMemberCard(profile) {
  const statusEl = _qs('flock-account-status');
  if (!statusEl) return;

  if (!profile) {
    statusEl.innerHTML = '<div class="flock-card-note">Signed-out or locked.</div>';
    return;
  }

  const name = _e(profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Member');
  const role = _e(profile.role || 'Member');
  const email = _e(profile.email || 'No email');

  statusEl.innerHTML = `
    <div class="flock-summary-grid">
      <div class="flock-summary-card">
        <span class="flock-summary-label">Name</span>
        <strong>${name}</strong>
      </div>
      <div class="flock-summary-card">
        <span class="flock-summary-label">Role</span>
        <strong>${role}</strong>
      </div>
      <div class="flock-summary-card">
        <span class="flock-summary-label">Email</span>
        <strong>${email}</strong>
      </div>
    </div>
    <div class="flock-member-card-slot" id="flock-member-card-slot"><div class="flock-card-note">Loading member card…</div></div>
  `;

  const slot = _qs('flock-member-card-slot');
  if (!slot) return;

  try {
    const UR = await ensureUpperRoom();
    if (!UR || typeof UR.searchMemberCards !== 'function' || !profile.email) {
      slot.innerHTML = '<div class="flock-card-note">Open The Fold to link your member card and finish setup.</div>';
      return;
    }

    const rows = await UR.searchMemberCards(profile.email);
    const list = _normalizeRows(rows);
    const card = list[0];
    if (!card) {
      slot.innerHTML = `<div class="flock-card-note">No member card found. <a href="${location.origin + location.pathname.split('?')[0] + '?covenant=new&view=the_fold'}">Open The Fold</a> to complete setup.</div>`;
      return;
    }

    const number = _e(card.memberNumber || card.id || '—');
    const joined = card.joinedDate || card.createdAt || card.created || '';
    const since = joined ? _formatDate(joined) : '';
    const displayName = _e([card.firstName, card.lastName].filter(Boolean).join(' ') || card.name || profile.displayName || 'Member');

    slot.innerHTML = `
      <div class="flock-member-card">
        <div class="flock-member-card-title">${displayName}</div>
        <div class="flock-member-card-meta">Card #${number}${since ? ' · joined ' + since : ''}</div>
        <a class="flock-link-button" href="${location.origin + location.pathname.split('?')[0] + '?covenant=new&view=the_fold'}">View in The Fold</a>
      </div>
    `;
  } catch (err) {
    console.warn('[the_flock] member card load failed', err);
    slot.innerHTML = '<div class="flock-card-note">Could not load member card.</div>';
  }
}

function renderLoading(message = 'Loading…') {
  return `<div class="flock-empty-state"><div class="flock-empty-state__icon">⏳</div><p class="flock-empty-state__copy">${_e(message)}</p></div>`;
}

function renderEmpty(message, icon = '🐑') {
  return `<div class="flock-empty-state"><div class="flock-empty-state__icon">${icon}</div><p class="flock-empty-state__copy">${_e(message)}</p></div>`;
}

function renderSourceBadge(sourceKey) {
  return `<span class="flock-source-badge">${_sourceLabel(state.source[sourceKey])}</span>`;
}

function renderStatusPill(value) {
  const status = _statusLabel(value);
  return `<span class="flock-pill flock-pill--status">${_e(status)}</span>`;
}

function renderMetaLine(parts) {
  const content = parts.filter(Boolean).join(' · ');
  return content ? `<div class="flock-item-meta">${_e(content)}</div>` : '';
}

function renderCareRow(item) {
  const id = _e(item.id || '');
  const title = _e(_caseTitle(item));
  const type = _e(_caseType(item));
  const status = _e(_caseStatus(item));
  const assigned = _e(_caseAssignedTo(item));
  const followUp = _formatDate(_caseFollowUp(item));
  const openClass = _isClosed(status) ? '' : ' flock-list-item--open';

  return `
    <li class="flock-list-item flock-list-item--clickable${openClass}" data-action="open-care-case" data-case-id="${id}">
      <div class="flock-list-item__main">
        <strong>${title}</strong>
        ${renderMetaLine([type, status, 'Assigned to ' + assigned, followUp ? 'Follow-up ' + followUp : ''])}
      </div>
      <div class="flock-list-item__aside">${renderStatusPill(status)}</div>
    </li>
  `;
}

function renderPrayerRow(item) {
  const id = _e(item.id || '');
  const name = _e(_prayerName(item));
  const prayerText = _e(_prayerText(item));
  const category = _e(_prayerCategory(item));
  const status = _e(_statusLabel(_rowValue(item, ['status'], 'Open')));
  const submitted = _formatDate(_rowValue(item, ['createdAt', 'submittedAt', 'updatedAt'], ''));

  return `
    <li class="flock-list-item flock-list-item--clickable" data-action="open-prayer" data-prayer-id="${id}">
      <div class="flock-list-item__main">
        <strong>${name}</strong>
        <div class="flock-item-copy">${prayerText}</div>
        ${renderMetaLine([category, status, submitted])}
      </div>
      <div class="flock-list-item__aside">${renderStatusPill(status)}</div>
    </li>
  `;
}

function renderAssignmentRow(item) {
  const assignedTo = _e(_rowValue(item, ['caregiverName', 'caregiverId'], 'Unassigned'));
  const member = _e(_rowValue(item, ['memberName', 'memberId'], 'Member'));
  const status = _e(_statusLabel(_rowValue(item, ['status'], 'Active')));
  const notes = _e(_rowValue(item, ['notes', 'summary'], ''));
  return `
    <li class="flock-list-item">
      <div class="flock-list-item__main">
        <strong>${member}</strong>
        ${renderMetaLine(['Assigned to ' + assignedTo, status])}
        ${notes ? `<div class="flock-item-copy">${notes}</div>` : ''}
      </div>
      <div class="flock-list-item__aside">${renderStatusPill(status)}</div>
    </li>
  `;
}

function renderCarePanel() {
  const body = _qs('flock-care-body');
  if (!body) return;

  const q = state.caseQuery.trim().toLowerCase();
  const filtered = state.cases.filter(item => {
    const title = _caseTitle(item).toLowerCase();
    const type = _caseType(item).toLowerCase();
    const status = _caseStatus(item).toLowerCase();
    const assigned = _caseAssignedTo(item).toLowerCase();
    const matchesQuery = !q || [title, type, status, assigned].some(v => v.includes(q));
    const matchesFilter = state.caseFilter === 'all' || status === state.caseFilter.toLowerCase();
    return matchesQuery && matchesFilter;
  }).sort((a, b) => {
    const aClosed = _isClosed(_caseStatus(a));
    const bClosed = _isClosed(_caseStatus(b));
    if (aClosed && !bClosed) return 1;
    if (!aClosed && bClosed) return -1;
    const aTime = new Date(_rowValue(a, ['updatedAt', 'createdAt'], 0)).getTime() || 0;
    const bTime = new Date(_rowValue(b, ['updatedAt', 'createdAt'], 0)).getTime() || 0;
    return bTime - aTime;
  });

  const openCases = state.cases.filter(item => !_isClosed(_caseStatus(item))).length;
  const dueThisWeek = state.cases.filter(item => {
    const date = _caseFollowUp(item);
    return date && !Number.isNaN(new Date(date).getTime());
  }).length;
  const assignmentCount = state.assignments.length;
  const myAssignmentsCount = state.myAssignments.length;

  body.innerHTML = `
    <div class="flock-summary-grid">
      <div class="flock-summary-card">
        <span class="flock-summary-label">Open cases</span>
        <strong>${openCases}</strong>
      </div>
      <div class="flock-summary-card">
        <span class="flock-summary-label">Follow-ups</span>
        <strong>${dueThisWeek}</strong>
      </div>
      <div class="flock-summary-card">
        <span class="flock-summary-label">Assignments</span>
        <strong>${assignmentCount}</strong>
      </div>
      <div class="flock-summary-card">
        <span class="flock-summary-label">My flock</span>
        <strong>${myAssignmentsCount}</strong>
      </div>
    </div>

    <div class="flock-panel-toolbar">
      <input id="flock-care-search" class="flock-input" type="search" placeholder="Search care cases" value="${_e(state.caseQuery)}" autocomplete="off">
      <select id="flock-care-filter" class="flock-select" aria-label="Filter care cases">
        <option value="all"${state.caseFilter === 'all' ? ' selected' : ''}>All statuses</option>
        ${CARE_STATUSES.map(status => `<option value="${_e(status.toLowerCase())}"${state.caseFilter === status.toLowerCase() ? ' selected' : ''}>${_e(status)}</option>`).join('')}
      </select>
      <button class="flock-btn flock-btn--primary" type="button" data-action="new-care-case">New Care Case</button>
    </div>

    <div class="flock-source-line">${renderSourceBadge('cases')}</div>

    ${filtered.length ? `<ul class="flock-list">${filtered.slice(0, MAX_LIST_ITEMS).map(renderCareRow).join('')}</ul>` : renderEmpty(state.cases.length ? 'No care cases match that search.' : 'No care cases yet — the flock is resting in peace.')}

    <div class="flock-panel-subhead">Assignments Log</div>
    ${state.assignments.length ? `<ul class="flock-list">${state.assignments.slice(0, 6).map(renderAssignmentRow).join('')}</ul>` : '<div class="flock-card-note">No assignment records yet.</div>'}
  `;

  const search = _qs('flock-care-search');
  if (search) {
    search.addEventListener('input', () => {
      state.caseQuery = search.value || '';
      renderCarePanel();
    });
  }

  const filter = _qs('flock-care-filter');
  if (filter) {
    filter.addEventListener('change', () => {
      state.caseFilter = filter.value || 'all';
      renderCarePanel();
    });
  }
}

function renderPrayerPanel() {
  const body = _qs('flock-prayer-body');
  if (!body) return;

  const q = state.prayerQuery.trim().toLowerCase();
  const filtered = state.prayers.filter(item => {
    const name = _prayerName(item).toLowerCase();
    const text = _prayerText(item).toLowerCase();
    const category = _prayerCategory(item).toLowerCase();
    const status = _rowValue(item, ['status'], 'Open').toLowerCase();
    const matchesQuery = !q || [name, text, category, status].some(v => v.includes(q));
    const matchesFilter = state.prayerFilter === 'all' || status === state.prayerFilter.toLowerCase();
    return matchesQuery && matchesFilter;
  });

  const openPrayers = state.prayers.filter(item => String(_rowValue(item, ['status'], 'Open')).toLowerCase() !== 'answered').length;
  const answered = state.prayers.filter(item => String(_rowValue(item, ['status'], 'Open')).toLowerCase() === 'answered').length;

  body.innerHTML = `
    <div class="flock-summary-grid">
      <div class="flock-summary-card">
        <span class="flock-summary-label">Open prayers</span>
        <strong>${openPrayers}</strong>
      </div>
      <div class="flock-summary-card">
        <span class="flock-summary-label">Answered</span>
        <strong>${answered}</strong>
      </div>
    </div>

    <div class="flock-panel-toolbar">
      <input id="flock-prayer-search" class="flock-input" type="search" placeholder="Search prayer requests" value="${_e(state.prayerQuery)}" autocomplete="off">
      <select id="flock-prayer-filter" class="flock-select" aria-label="Filter prayer requests">
        <option value="all"${state.prayerFilter === 'all' ? ' selected' : ''}>All statuses</option>
        ${PRAYER_STATUSES.map(status => `<option value="${_e(status.toLowerCase())}"${state.prayerFilter === status.toLowerCase() ? ' selected' : ''}>${_e(status)}</option>`).join('')}
      </select>
      <button class="flock-btn flock-btn--primary" type="button" data-action="new-prayer">New Prayer Request</button>
    </div>

    <div class="flock-source-line">${renderSourceBadge('prayers')}</div>

    ${filtered.length ? `<ul class="flock-list">${filtered.slice(0, MAX_LIST_ITEMS).map(renderPrayerRow).join('')}</ul>` : renderEmpty(state.prayers.length ? 'No prayer requests match that search.' : 'No prayer requests yet — the flock is at peace.', '🙏')}
  `;

  const search = _qs('flock-prayer-search');
  if (search) {
    search.addEventListener('input', () => {
      state.prayerQuery = search.value || '';
      renderPrayerPanel();
    });
  }

  const filter = _qs('flock-prayer-filter');
  if (filter) {
    filter.addEventListener('change', () => {
      state.prayerFilter = filter.value || 'all';
      renderPrayerPanel();
    });
  }
}

function renderCompassionPanel() {
  const body = _qs('flock-compassion-body');
  if (!body) return;
  body.innerHTML = `
    <div class="flock-card-note">Compassion requests are coming soon. The collection is not seeded yet, so this panel stays in waiting mode.</div>
    <div class="flock-card-note">Until then, use The Fold for active care intake and prayer logging.</div>
  `;
}

function renderAllPanels() {
  renderCarePanel();
  renderPrayerPanel();
  renderCompassionPanel();
}

async function openNewCareCaseDrawer() {
  const html = `
    <div class="flock-drawer-form">
      <div class="flock-drawer-section">
        <label class="flock-drawer-label" for="care-name">Member / Family Name</label>
        <input id="care-name" class="flock-input" type="text" autocomplete="off" placeholder="Enter name">
      </div>

      <div class="flock-drawer-grid">
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="care-type">Care Type</label>
          <select id="care-type" class="flock-select">
            ${CARE_TYPES.map(type => `<option value="${_e(type)}">${_e(type)}</option>`).join('')}
          </select>
        </div>

        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="care-status">Status</label>
          <select id="care-status" class="flock-select">
            ${CARE_STATUSES.map(status => `<option value="${_e(status)}"${status === 'Open' ? ' selected' : ''}>${_e(status)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="flock-drawer-grid">
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="care-assigned">Assigned To</label>
          <input id="care-assigned" class="flock-input" type="text" autocomplete="off" placeholder="Caregiver name or email">
        </div>

        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="care-follow-up">Next Follow-Up</label>
          <input id="care-follow-up" class="flock-input" type="date">
        </div>
      </div>

      <div class="flock-drawer-section">
        <label class="flock-drawer-label" for="care-member-id">Member ID</label>
        <input id="care-member-id" class="flock-input" type="text" autocomplete="off" placeholder="Optional Firestore member id">
      </div>

      <div class="flock-drawer-section">
        <label class="flock-drawer-label" for="care-notes">Care Notes</label>
        <textarea id="care-notes" class="flock-textarea" rows="5" placeholder="Summarize the care need, prayer, and any next steps"></textarea>
      </div>

      <div class="flock-drawer-actions">
        <button class="flock-btn flock-btn--primary" type="button" id="care-create-btn">Create Case</button>
      </div>
    </div>
  `;

  _openDrawer('New Care Case', html);

  const createBtn = _qs('care-create-btn');
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const payload = {
        name: (_qs('care-name') || {}).value || '',
        memberName: (_qs('care-name') || {}).value || '',
        type: (_qs('care-type') || {}).value || 'Care',
        status: (_qs('care-status') || {}).value || 'Open',
        assignedTo: (_qs('care-assigned') || {}).value || '',
        memberId: (_qs('care-member-id') || {}).value || '',
        notes: (_qs('care-notes') || {}).value || '',
        nextFollowUp: (_qs('care-follow-up') || {}).value || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!payload.name.trim()) {
        _toast('Please enter a name before creating a case.', 'warning');
        return;
      }

      try {
        await adapter.care.create(payload);
        _toast('Care case created', 'success');
        await refreshAll();
        _openDrawer('Care case saved', `<div class="flock-drawer-form"><div class="flock-empty-state"><div class="flock-empty-state__icon">✅</div><p class="flock-empty-state__copy">The case was created successfully.</p></div></div>`);
      } catch (err) {
        console.warn('[the_flock] create care case failed', err);
        _toast('We could not create that care case.', 'error');
      }
    });
  }
}

async function loadCareCaseDetail(caseId) {
  const current = state.cases.find(item => String(item.id) === String(caseId));
  if (!current) return null;

  let interactions = [];
  let assignments = [];

  try {
    const rows = await adapter.interactions.list({ caseId, limit: DEFAULT_LIMIT });
    interactions = _normalizeRows(rows);
  } catch (err) {
    console.warn('[the_flock] interactions load failed', err);
  }

  try {
    const rows = await adapter.assignments.list({ limit: DEFAULT_LIMIT * 2 });
    assignments = _normalizeRows(rows).filter(item => {
      const itemCaseId = String(item.caseId || item.careCaseId || item.case_id || '');
      const itemMemberId = String(item.memberId || item.member_id || '');
      return itemCaseId === String(caseId) || (current.memberId && itemMemberId === String(current.memberId));
    });
  } catch (err) {
    console.warn('[the_flock] assignments load failed', err);
  }

  return { current, interactions, assignments };
}

function _renderInteractionList(rows) {
  if (!rows.length) {
    return '<div class="flock-card-note">No care interactions logged yet.</div>';
  }

  return `
    <ul class="flock-note-list">
      ${rows.map(row => `
        <li class="flock-note-item">
          <strong>${_e(_rowValue(row, ['title', 'subject', 'noteType'], 'Interaction'))}</strong>
          <div class="flock-item-copy">${_e(_rowValue(row, ['note', 'notes', 'summary', 'body'], ''))}</div>
          ${renderMetaLine([_rowValue(row, ['createdBy', 'createdByName'], ''), _formatDate(_rowValue(row, ['createdAt', 'updatedAt'], ''))])}
        </li>
      `).join('')}
    </ul>
  `;
}

function _renderAssignmentList(rows) {
  if (!rows.length) {
    return '<div class="flock-card-note">No assignment records linked to this case.</div>';
  }

  return `
    <ul class="flock-note-list">
      ${rows.map(row => `
        <li class="flock-note-item">
          <strong>${_e(_rowValue(row, ['caregiverName', 'caregiverId'], 'Assignment'))}</strong>
          <div class="flock-item-copy">${_e(_rowValue(row, ['notes', 'summary'], ''))}</div>
          ${renderMetaLine([_statusLabel(_rowValue(row, ['status'], 'Active')), _formatDate(_rowValue(row, ['createdAt', 'updatedAt'], ''))])}
        </li>
      `).join('')}
    </ul>
  `;
}

async function openCareCaseDrawer(caseId) {
  const payload = await loadCareCaseDetail(caseId);
  if (!payload) {
    _toast('We could not find that care case.', 'warning');
    return;
  }

  const { current, interactions, assignments } = payload;
  const html = `
    <div class="flock-drawer-form">
      <div class="flock-drawer-section">
        <label class="flock-drawer-label" for="care-edit-name">Member / Family Name</label>
        <input id="care-edit-name" class="flock-input" type="text" value="${_e(_caseTitle(current))}" autocomplete="off">
      </div>

      <div class="flock-drawer-grid">
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="care-edit-type">Care Type</label>
          <select id="care-edit-type" class="flock-select">
            ${CARE_TYPES.map(type => `<option value="${_e(type)}"${_caseType(current) === type ? ' selected' : ''}>${_e(type)}</option>`).join('')}
          </select>
        </div>

        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="care-edit-status">Status</label>
          <select id="care-edit-status" class="flock-select">
            ${CARE_STATUSES.map(status => `<option value="${_e(status)}"${_caseStatus(current) === status ? ' selected' : ''}>${_e(status)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="flock-drawer-grid">
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="care-edit-assigned">Assigned To</label>
          <input id="care-edit-assigned" class="flock-input" type="text" value="${_e(_caseAssignedTo(current))}" autocomplete="off">
        </div>

        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="care-edit-follow-up">Next Follow-Up</label>
          <input id="care-edit-follow-up" class="flock-input" type="date" value="${_e(_caseFollowUp(current))}">
        </div>
      </div>

      <div class="flock-drawer-section">
        <label class="flock-drawer-label" for="care-edit-member-id">Member ID</label>
        <input id="care-edit-member-id" class="flock-input" type="text" value="${_e(_rowValue(current, ['memberId'], ''))}" autocomplete="off">
      </div>

      <div class="flock-drawer-section">
        <label class="flock-drawer-label" for="care-edit-notes">Care Notes</label>
        <textarea id="care-edit-notes" class="flock-textarea" rows="5">${_e(_rowValue(current, ['notes', 'summary', 'description'], ''))}</textarea>
      </div>

      <div class="flock-drawer-actions">
        <button class="flock-btn flock-btn--primary" type="button" id="care-save-btn">Save Changes</button>
        <button class="flock-btn" type="button" id="care-resolve-btn">Mark Resolved</button>
        <button class="flock-btn flock-btn--ghost" type="button" id="care-assign-me-btn"${state.profile && state.profile.email ? '' : ' disabled'}>Assign to Me</button>
      </div>

      <div class="flock-drawer-divider"></div>
      <div class="flock-drawer-subhead">Care Interactions</div>
      ${_renderInteractionList(interactions)}

      <div class="flock-drawer-section">
        <label class="flock-drawer-label" for="care-new-note">Add Interaction Note</label>
        <textarea id="care-new-note" class="flock-textarea" rows="4" placeholder="Write a pastoral note, prayer, or follow-up"></textarea>
      </div>
      <div class="flock-drawer-actions">
        <button class="flock-btn flock-btn--primary" type="button" id="care-add-note-btn">Add Note</button>
      </div>

      <div class="flock-drawer-divider"></div>
      <div class="flock-drawer-subhead">Assignment Log</div>
      ${_renderAssignmentList(assignments)}
    </div>
  `;

  _openDrawer(_caseTitle(current), html);

  const saveBtn = _qs('care-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const payload = {
        id: current.id,
        name: (_qs('care-edit-name') || {}).value || '',
        memberName: (_qs('care-edit-name') || {}).value || '',
        type: (_qs('care-edit-type') || {}).value || _caseType(current),
        status: (_qs('care-edit-status') || {}).value || _caseStatus(current),
        assignedTo: (_qs('care-edit-assigned') || {}).value || '',
        memberId: (_qs('care-edit-member-id') || {}).value || '',
        notes: (_qs('care-edit-notes') || {}).value || '',
        nextFollowUp: (_qs('care-edit-follow-up') || {}).value || '',
        updatedAt: new Date().toISOString(),
      };

      try {
        await adapter.care.update(payload);
        _toast('Care case saved', 'success');
        await refreshAll();
      } catch (err) {
        console.warn('[the_flock] care update failed', err);
        _toast('We could not save that care case.', 'error');
      }
    });
  }

  const resolveBtn = _qs('care-resolve-btn');
  if (resolveBtn) {
    resolveBtn.addEventListener('click', async () => {
      try {
        await adapter.care.resolve({ id: current.id });
        _toast('Care case marked resolved', 'success');
        await refreshAll();
      } catch (err) {
        console.warn('[the_flock] care resolve failed', err);
        _toast('We could not mark that care case resolved.', 'error');
      }
    });
  }

  const assignBtn = _qs('care-assign-me-btn');
  if (assignBtn) {
    assignBtn.addEventListener('click', async () => {
      if (!state.profile || !state.profile.email) {
        _toast('No signed-in profile is available for assignment.', 'warning');
        return;
      }

      try {
        await adapter.care.update({
          id: current.id,
          assignedTo: state.profile.displayName || state.profile.email,
          updatedAt: new Date().toISOString(),
        });

        if (_rowValue(current, ['memberId'], '')) {
          await adapter.assignments.create({
            memberId: _rowValue(current, ['memberId'], ''),
            memberName: _caseTitle(current),
            caregiverId: state.profile.email,
            caregiverName: state.profile.displayName || state.profile.email,
            status: 'Active',
            notes: 'Assigned from The Flock',
            createdAt: new Date().toISOString(),
          });
        }

        _toast('Assignment saved', 'success');
        await refreshAll();
      } catch (err) {
        console.warn('[the_flock] assign to me failed', err);
        _toast('We could not save that assignment.', 'error');
      }
    });
  }

  const addNoteBtn = _qs('care-add-note-btn');
  if (addNoteBtn) {
    addNoteBtn.addEventListener('click', async () => {
      const note = (_qs('care-new-note') || {}).value || '';
      if (!String(note).trim()) {
        _toast('Write a note before saving.', 'warning');
        return;
      }

      try {
        await adapter.interactions.create({
          caseId: current.id,
          memberId: _rowValue(current, ['memberId'], ''),
          memberName: _caseTitle(current),
          title: 'Pastoral Note',
          note,
          createdBy: state.profile && state.profile.email ? state.profile.email : '',
          createdByName: state.profile && state.profile.displayName ? state.profile.displayName : '',
          createdAt: new Date().toISOString(),
        });
        _toast('Interaction note added', 'success');
        await refreshAll();
      } catch (err) {
        console.warn('[the_flock] add interaction failed', err);
        _toast('We could not add that note.', 'error');
      }
    });
  }
}

async function openNewPrayerDrawer() {
  const html = `
    <div class="flock-drawer-form">
      <div class="flock-drawer-grid">
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="prayer-name">Name</label>
          <input id="prayer-name" class="flock-input" type="text" autocomplete="off" placeholder="Submitter name">
        </div>
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="prayer-category">Category</label>
          <input id="prayer-category" class="flock-input" type="text" autocomplete="off" placeholder="Prayer category">
        </div>
      </div>

      <div class="flock-drawer-section">
        <label class="flock-drawer-label" for="prayer-text">Prayer Request</label>
        <textarea id="prayer-text" class="flock-textarea" rows="6" placeholder="Share the prayer request"></textarea>
      </div>

      <div class="flock-drawer-grid">
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="prayer-status">Status</label>
          <select id="prayer-status" class="flock-select">
            ${PRAYER_STATUSES.map(status => `<option value="${_e(status)}"${status === 'Open' ? ' selected' : ''}>${_e(status)}</option>`).join('')}
          </select>
        </div>
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="prayer-anonymity">Visibility</label>
          <select id="prayer-anonymity" class="flock-select">
            <option value="public">Public / shared</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>

      <div class="flock-drawer-actions">
        <button class="flock-btn flock-btn--primary" type="button" id="prayer-create-btn">Create Prayer Request</button>
      </div>
    </div>
  `;

  _openDrawer('New Prayer Request', html);

  const createBtn = _qs('prayer-create-btn');
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const payload = {
        submitterName: (_qs('prayer-name') || {}).value || '',
        prayerText: (_qs('prayer-text') || {}).value || '',
        category: (_qs('prayer-category') || {}).value || 'Prayer',
        status: (_qs('prayer-status') || {}).value || 'Open',
        visibility: (_qs('prayer-anonymity') || {}).value || 'public',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!String(payload.prayerText).trim()) {
        _toast('Please enter a prayer request first.', 'warning');
        return;
      }

      try {
        await adapter.prayers.create(payload);
        _toast('Prayer request created', 'success');
        await refreshAll();
        _openDrawer('Prayer request saved', `<div class="flock-drawer-form"><div class="flock-empty-state"><div class="flock-empty-state__icon">🙏</div><p class="flock-empty-state__copy">The request was created successfully.</p></div></div>`);
      } catch (err) {
        console.warn('[the_flock] create prayer failed', err);
        _toast('We could not create that prayer request.', 'error');
      }
    });
  }
}

async function loadPrayerDetail(prayerId) {
  const item = state.prayers.find(row => String(row.id) === String(prayerId));
  return item || null;
}

async function openPrayerDrawer(prayerId) {
  const current = await loadPrayerDetail(prayerId);
  if (!current) {
    _toast('We could not find that prayer request.', 'warning');
    return;
  }

  const html = `
    <div class="flock-drawer-form">
      <div class="flock-drawer-grid">
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="prayer-edit-name">Name</label>
          <input id="prayer-edit-name" class="flock-input" type="text" value="${_e(_prayerName(current))}" autocomplete="off">
        </div>
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="prayer-edit-category">Category</label>
          <input id="prayer-edit-category" class="flock-input" type="text" value="${_e(_prayerCategory(current))}" autocomplete="off">
        </div>
      </div>

      <div class="flock-drawer-section">
        <label class="flock-drawer-label" for="prayer-edit-text">Prayer Request</label>
        <textarea id="prayer-edit-text" class="flock-textarea" rows="6">${_e(_prayerText(current))}</textarea>
      </div>

      <div class="flock-drawer-grid">
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="prayer-edit-status">Status</label>
          <select id="prayer-edit-status" class="flock-select">
            ${PRAYER_STATUSES.map(status => `<option value="${_e(status)}"${_rowValue(current, ['status'], 'Open') === status ? ' selected' : ''}>${_e(status)}</option>`).join('')}
          </select>
        </div>
        <div class="flock-drawer-section">
          <label class="flock-drawer-label" for="prayer-edit-visibility">Visibility</label>
          <select id="prayer-edit-visibility" class="flock-select">
            <option value="public"${_rowValue(current, ['visibility'], 'public') === 'public' ? ' selected' : ''}>Public / shared</option>
            <option value="private"${_rowValue(current, ['visibility'], 'public') === 'private' ? ' selected' : ''}>Private</option>
          </select>
        </div>
      </div>

      <div class="flock-drawer-actions">
        <button class="flock-btn flock-btn--primary" type="button" id="prayer-save-btn">Save Changes</button>
        <button class="flock-btn" type="button" id="prayer-answered-btn">Mark Answered</button>
        <button class="flock-btn flock-btn--ghost" type="button" id="prayer-archive-btn">Archive</button>
      </div>
    </div>
  `;

  _openDrawer(_prayerName(current), html);

  const saveBtn = _qs('prayer-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        await adapter.prayers.update({
          id: current.id,
          submitterName: (_qs('prayer-edit-name') || {}).value || '',
          prayerText: (_qs('prayer-edit-text') || {}).value || '',
          category: (_qs('prayer-edit-category') || {}).value || 'Prayer',
          status: (_qs('prayer-edit-status') || {}).value || 'Open',
          visibility: (_qs('prayer-edit-visibility') || {}).value || 'public',
          updatedAt: new Date().toISOString(),
        });
        _toast('Prayer request saved', 'success');
        await refreshAll();
      } catch (err) {
        console.warn('[the_flock] prayer save failed', err);
        _toast('We could not save that prayer request.', 'error');
      }
    });
  }

  const answeredBtn = _qs('prayer-answered-btn');
  if (answeredBtn) {
    answeredBtn.addEventListener('click', async () => {
      try {
        await adapter.prayers.update({
          id: current.id,
          status: 'Answered',
          answeredAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        _toast('Prayer request marked answered', 'success');
        await refreshAll();
      } catch (err) {
        console.warn('[the_flock] prayer answered failed', err);
        _toast('We could not mark that prayer answered.', 'error');
      }
    });
  }

  const archiveBtn = _qs('prayer-archive-btn');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', async () => {
      try {
        if (adapter.prayers.remove) {
          await adapter.prayers.remove({ id: current.id });
        } else if (adapter.prayers.delete) {
          await adapter.prayers.delete({ id: current.id });
        }
        _toast('Prayer archived', 'success');
        await refreshAll();
      } catch (err) {
        console.warn('[the_flock] prayer archive failed', err);
        _toast('We could not archive that prayer request.', 'error');
      }
    });
  }
}

function wireGlobalEvents() {
  const page = _qs('the-flock-grid') || document.querySelector('.broadsheet-grid');
  if (!page) return;

  page.addEventListener('click', event => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    if (action === 'open-care-case') {
      event.preventDefault();
      openCareCaseDrawer(actionEl.dataset.caseId);
      return;
    }

    if (action === 'open-prayer') {
      event.preventDefault();
      openPrayerDrawer(actionEl.dataset.prayerId);
      return;
    }

    if (action === 'new-care-case') {
      event.preventDefault();
      openNewCareCaseDrawer();
      return;
    }

    if (action === 'new-prayer') {
      event.preventDefault();
      openNewPrayerDrawer();
      return;
    }

    if (action === 'open-account') {
      event.preventDefault();
      openAccountPanel();
      return;
    }

    if (action === 'open-fold') {
      event.preventDefault();
      location.href = location.origin + location.pathname.split('?')[0] + '?covenant=new&view=the_fold';
    }
  });
}

async function openAccountPanel() {
  try {
    const module = await import('../../Scripts/the_priesthood/index.js');
    if (typeof module.openAccountSheet === 'function') {
      await module.openAccountSheet();
      return;
    }
  } catch (err) {
    console.warn('[the_flock] could not load account panel:', err);
  }
  _toast('Account panel unavailable.', 'warning');
}

async function refreshAll() {
  const [cases, prayers, assignments] = await Promise.allSettled([
    _loadRows(adapter.care, { limit: DEFAULT_LIMIT }, LS_KEYS.cases, 'cases'),
    _loadRows(adapter.prayers, { limit: DEFAULT_LIMIT, allUsers: true }, LS_KEYS.prayers, 'prayers'),
    _loadRows(adapter.assignments, { limit: DEFAULT_LIMIT * 2 }, LS_KEYS.assignments, 'assignments'),
  ]);

  state.cases = cases.status === 'fulfilled' ? cases.value : [];
  state.prayers = prayers.status === 'fulfilled' ? prayers.value : [];
  state.assignments = assignments.status === 'fulfilled' ? assignments.value : [];

  if (state.profile && state.profile.email && typeof adapter.assignments.myFlock === 'function') {
    try {
      const rows = await adapter.assignments.myFlock(state.profile.email);
      state.myAssignments = _normalizeRows(rows);
    } catch (err) {
      console.warn('[the_flock] my flock assignments failed', err);
      state.myAssignments = [];
    }
  } else {
    state.myAssignments = [];
  }

  renderAllPanels();
}

async function init() {
  wireGlobalEvents();

  const fontBtn = _qs('font-scale-btn');
  if (fontBtn && window.FlockGates && typeof window.FlockGates.openFontScalePicker === 'function') {
    fontBtn.addEventListener('click', () => window.FlockGates.openFontScalePicker(fontBtn));
  }

  const profile = await loadProfile();
  state.profile = profile;
  await loadMemberCard(profile);

  const careBody = _qs('flock-care-body');
  const prayerBody = _qs('flock-prayer-body');
  const compassionBody = _qs('flock-compassion-body');
  if (careBody) careBody.innerHTML = renderLoading('Loading care cases…');
  if (prayerBody) prayerBody.innerHTML = renderLoading('Loading prayer requests…');
  if (compassionBody) compassionBody.innerHTML = renderLoading('Loading compassion panel…');

  await ensureUpperRoom();
  await refreshAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
