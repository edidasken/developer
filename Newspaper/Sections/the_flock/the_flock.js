// the_flock.js — Section 4: The Flock
// Phase 5 implementation: care board, prayer chain, compassion ministry,
// member setup, and FlockOS Fold / account panel integration.

import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';

const FOLD_QUERY = '?covenant=new&view=the_fold';
const FOLD_URL = location.origin + location.pathname.split('?')[0] + FOLD_QUERY;
const DEFAULT_LIMIT = 5;

function renderEmpty(message) {
  return `<div class="empty-state"><div class="empty-state__icon">🐑</div><p class="empty-state__title">${message}</p></div>`;
}

function renderLoading() {
  return `<div class="empty-state"><div class="empty-state__icon">⏳</div><p class="empty-state__title">Loading…</p></div>`;
}

function renderItemList(items) {
  if (!items || !items.length) {
    return `<div class="flock-list-empty">No recent items found.</div>`;
  }
  return `<ul class="flock-list">${items.map(item => {
    const title = item.title || item.request || item.subject || item.summary || item.name || 'Untitled item';
    const note = item.status || item.method || item.category || '';
    const date = item.updatedAt || item.createdAt || item.created || '';
    return `
      <li class="flock-list-item">
        <strong>${escapeHtml(String(title).slice(0, 80))}</strong>
        ${note ? `<span class="flock-item-meta">${escapeHtml(String(note))}</span>` : ''}
        ${date ? `<span class="flock-item-date">${formatDate(date)}</span>` : ''}
      </li>`;
  }).join('')}</ul>`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function formatDate(value) {
  try {
    const date = typeof value === 'object' && value !== null && value.seconds ? new Date(value.seconds * 1000) : new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (err) {
    return '';
  }
}

function bindActions() {
  document.body.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    if (action === 'open-account') {
      event.preventDefault();
      await openAccountPanel();
      return;
    }

    if (action === 'open-fold') {
      event.preventDefault();
      location.href = FOLD_URL;
      return;
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
  if (window.FlockGates && typeof window.FlockGates.showToast === 'function') {
    window.FlockGates.showToast('Account panel unavailable.', 3200);
  }
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

function renderAccountSummary(profile) {
  const statusEl = document.getElementById('flock-account-status');
  if (!statusEl) return;
  if (!profile) {
    statusEl.innerHTML = renderEmpty('Signed-out or locked.');
    return;
  }

  const name = escapeHtml(profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Member');
  const role = escapeHtml(profile.role || 'Member');
  const email = escapeHtml(profile.email || 'No email');

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
    <div class="flock-member-card-slot" id="flock-member-card-slot">${renderLoading()}</div>
  `;
}

async function loadMemberCard(profile) {
  const slot = document.getElementById('flock-member-card-slot');
  if (!slot) return;
  if (!profile) {
    slot.innerHTML = renderEmpty('No member profile available.');
    return;
  }

  const UR = await ensureUpperRoom();
  if (!UR || typeof UR.searchMemberCards !== 'function' || !profile.email) {
    slot.innerHTML = `<div class="flock-card-note">Open The Fold to link your member card and finish your setup.</div>`;
    return;
  }

  try {
    const rows = await UR.searchMemberCards(profile.email);
    const card = Array.isArray(rows) ? rows[0] : null;
    if (!card) {
      slot.innerHTML = `<div class="flock-card-note">No member card found. <a href="${FOLD_URL}">Open The Fold</a> to complete setup.</div>`;
      return;
    }

    const number = escapeHtml(card.memberNumber || card.id || '—');
    const joined = card.joinedDate || card.createdAt || card.created || '';
    const since = joined ? formatDate(joined) : '';
    const displayName = escapeHtml([card.firstName, card.lastName].filter(Boolean).join(' ') || card.name || profile.displayName || 'Member');

    slot.innerHTML = `
      <div class="flock-member-card">
        <div class="flock-member-card-title">${displayName}</div>
        <div class="flock-member-card-meta">Card #${number}${since ? ` · joined ${since}` : ''}</div>
        <a class="flock-link-button" href="${FOLD_URL}">View in The Fold</a>
      </div>
    `;
  } catch (err) {
    console.warn('[the_flock] member card load failed', err);
    slot.innerHTML = renderEmpty('Could not load member card.');
  }
}

async function loadCareSummary() {
  const body = document.getElementById('flock-care-body');
  if (!body) return;
  body.innerHTML = renderLoading();

  try {
    const adapter = buildAdapter('flock.care', window.TheVine);
    const result = await adapter.list({ limit: DEFAULT_LIMIT });
    const cases = Array.isArray(result) ? result : (result && result.results) ? result.results : [];
    const count = cases.length;
    body.innerHTML = `
      <div class="flock-summary-text">${count} open care case${count === 1 ? '' : 's'} found.</div>
      ${renderItemList(cases.slice(0, 3))}
    `;
  } catch (err) {
    console.warn('[the_flock] care summary failed', err);
    body.innerHTML = `<div class="flock-card-note">Unable to load care board summary. <a href="${FOLD_URL}">Open The Fold</a>.</div>`;
  }
}

async function loadPrayerSummary() {
  const body = document.getElementById('flock-prayer-body');
  if (!body) return;
  body.innerHTML = renderLoading();

  try {
    const adapter = buildAdapter('flock.prayer', window.TheVine);
    const result = await adapter.list({ limit: DEFAULT_LIMIT });
    const prayers = Array.isArray(result) ? result : (result && result.results) ? result.results : [];
    const count = prayers.length;
    body.innerHTML = `
      <div class="flock-summary-text">${count} active prayer request${count === 1 ? '' : 's'}.</div>
      ${renderItemList(prayers.slice(0, 3))}
    `;
  } catch (err) {
    console.warn('[the_flock] prayer summary failed', err);
    body.innerHTML = `<div class="flock-card-note">Unable to load prayer chain summary. <a href="${FOLD_URL}">Open The Fold</a>.</div>`;
  }
}

async function loadCompassionSummary() {
  const body = document.getElementById('flock-compassion-body');
  if (!body) return;
  body.innerHTML = renderLoading();

  try {
    const adapter = buildAdapter('flock.touches', window.TheVine);
    const result = await adapter.list({ limit: DEFAULT_LIMIT });
    const touches = Array.isArray(result) ? result : (result && result.results) ? result.results : [];
    const count = touches.length;
    body.innerHTML = `
      <div class="flock-summary-text">${count} recent compassion touch${count === 1 ? '' : 'es'}.</div>
      ${renderItemList(touches.slice(0, 3))}
    `;
  } catch (err) {
    console.warn('[the_flock] compassion summary failed', err);
    body.innerHTML = `<div class="flock-card-note">Unable to load compassion data. <a href="${FOLD_URL}">Open The Fold</a>.</div>`;
  }
}

async function init() {
  bindActions();
  const profile = await loadProfile();
  renderAccountSummary(profile);
  await loadMemberCard(profile);
  await Promise.all([loadCareSummary(), loadPrayerSummary(), loadCompassionSummary()]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
