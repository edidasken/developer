/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · DEVOTIONALS — Daily devotions to feed the soul.
   "Man shall not live by bread alone, but by every word from God." — Matthew 4:4
   ══════════════════════════════════════════════════════════════════════════════ */

import { esc, snip, emptyState, loadingCards, chip } from './the_gospel_shared.js';

export const name        = 'the_gospel_devotionals';
export const title       = 'Devotionals';
export const description = 'Daily devotions — a passage of scripture, a reflection, a prayer. Feed the soul before the rush.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v3M5.6 5.6l2.1 2.1M2 12h3M5.6 18.4l2.1-2.1M12 22v-3M18.4 18.4l-2.1-2.1M22 12h-3M18.4 5.6l-2.1 2.1"/><circle cx="12" cy="12" r="3.5"/></svg>`;
export const accent      = '#e8a838';

let _state = { rows: [], expanded: new Set() };

// Readable month/day from ISO date
function _readableDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

// Day-of-year from ISO date string
function _dayOfYear(iso) {
  try {
    const d = new Date(iso + 'T12:00:00');
    const start = new Date(d.getFullYear(), 0, 1);
    return Math.floor((d - start) / 86400000) + 1;
  } catch { return 0; }
}

function _todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="devotionals">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>
      <div data-bind="root">${loadingCards(3)}</div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  return () => {};
}

async function _load(root) {
  const view = root.querySelector('[data-bind="root"]');
  try {
    const mod = await import('../../Data/devotionals.js');
    // Sort by date descending so most-recent is first
    _state.rows = (mod.default || []).slice().sort((a, b) => {
      const da = a.date || a.Date || '';
      const db = b.date || b.Date || '';
      return db.localeCompare(da);
    });
  } catch (e) {
    console.error('[gospel/devotionals] static bundle failed:', e);
    view.innerHTML = emptyState({ icon: '⚠️', title: 'Could not load devotionals', body: e.message || String(e) });
    return;
  }
  if (!_state.rows.length) { view.innerHTML = emptyState({ icon: '🌅', title: 'No devotionals yet' }); return; }
  _paint(view);
}

function _paint(view) {
  const today = _todayISO();
  const future30 = new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().slice(0, 10);
  // Pick the most recent entry that is on or before today
  const todayDevo = _state.rows.find((d) => (d.date || d.Date || '') <= today) || _state.rows[_state.rows.length - 1];
  // "Upcoming" = after today, within the next 30 days
  const rest = _state.rows.filter((d) => {
    const dt = d.date || d.Date || '';
    return d !== todayDevo && dt > today && dt <= future30;
  });

  view.innerHTML = `
    <div class="grow-devo-featured" data-featured="${esc(todayDevo._id || todayDevo.date || '')}">
      ${_featured(todayDevo)}
    </div>
    ${rest.length ? `
    <div class="grow-devo-feed-head">
      <span class="grow-section-title">Upcoming Devotionals</span>
    </div>
    <div class="grow-devo-feed">
      ${rest.map((d) => _feedCard(d)).join('')}
    </div>` : ''}
  `;

  // Wire expand/collapse on feed cards
  view.querySelectorAll('.grow-devo-feed-card').forEach((card) => {
    card.querySelector('.grow-devo-feed-summary').addEventListener('click', () => {
      const id = card.dataset.id;
      const body = card.querySelector('.grow-devo-feed-body');
      if (_state.expanded.has(id)) {
        _state.expanded.delete(id);
        card.classList.remove('is-open');
        body.style.display = 'none';
      } else {
        _state.expanded.add(id);
        card.classList.add('is-open');
        body.style.display = '';
      }
    });
  });
}

function _featured(d) {
  const date       = _readableDate(d.date || d.Date);
  const theme      = d.theme || d.Theme || '';
  const title      = d.title || d.Title || 'Today\'s Devotional';
  const scripture  = d.scripture || d.Scripture || '';
  const reflection = d.reflection || d.Reflection || '';
  const question   = d.question || d.Question || '';
  const prayer     = d.prayer || d.Prayer || '';

  return /* html */`
    <div class="grow-devo-feat-badge">
      ${date ? `<span class="grow-devo-feat-date">${esc(date)}</span>` : ''}
      ${theme ? `<span class="grow-devo-feat-theme">${esc(theme)}</span>` : ''}
    </div>
    <h2 class="grow-devo-feat-title">${esc(title)}</h2>
    ${scripture ? `<div class="grow-devo-feat-scripture">${esc(scripture)}</div>` : ''}
    ${reflection ? `<p class="grow-devo-feat-reflection">${esc(reflection)}</p>` : ''}
    ${question ? `<div class="grow-devo-feat-question">
      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" style="flex-shrink:0;opacity:.7"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"/></svg>
      <em>${esc(question)}</em>
    </div>` : ''}
    ${prayer ? `<div class="grow-devo-feat-prayer">
      <span class="grow-devo-feat-prayer-label">Prayer</span>
      <p>${esc(prayer)}</p>
    </div>` : ''}
  `;
}

function _feedCard(d) {
  const id         = d._id || d.date || Math.random();
  const date       = _readableDate(d.date || d.Date);
  const theme      = d.theme || d.Theme || '';
  const title      = d.title || d.Title || 'Devotional';
  const scripture  = d.scripture || d.Scripture || '';
  const reflection = d.reflection || d.Reflection || '';
  const question   = d.question || d.Question || '';
  const prayer     = d.prayer || d.Prayer || '';
  const isOpen     = _state.expanded.has(String(id));

  return /* html */`
    <div class="grow-devo-feed-card ${isOpen ? 'is-open' : ''}" data-id="${esc(String(id))}">
      <button class="grow-devo-feed-summary" type="button">
        <div class="grow-devo-feed-meta">
          ${date ? `<span class="grow-devo-feed-date">${esc(date)}</span>` : ''}
          ${theme ? `<span class="grow-devo-feed-theme">${esc(theme)}</span>` : ''}
        </div>
        <h3 class="grow-devo-feed-title">${esc(title)}</h3>
        ${scripture ? `<p class="grow-devo-feed-verse">${esc(snip(scripture, 100))}</p>` : ''}
        <svg class="grow-devo-chevron" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
      </button>
      <div class="grow-devo-feed-body" style="display:${isOpen ? '' : 'none'};">
        ${reflection ? `<p class="grow-devo-feed-reflection">${esc(reflection)}</p>` : ''}
        ${question   ? `<div class="grow-devo-feat-question" style="margin:14px 0;">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style="flex-shrink:0;opacity:.7"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"/></svg>
          <em>${esc(question)}</em>
        </div>` : ''}
        ${prayer ? `<p class="grow-devo-feed-prayer"><em>${esc(prayer)}</em></p>` : ''}
      </div>
    </div>
  `;
}

