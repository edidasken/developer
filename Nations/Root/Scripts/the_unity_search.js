/* ══════════════════════════════════════════════════════════════════════════════
   THE UNITY SEARCH — Shared in-app feature/module search palette
   "Seek, and ye shall find." — Matthew 7:7

   One palette. Every app. Each app registers its searchable
   modules/features at boot. The search button in the unity header opens this
   modal; user types; matching items run their handlers.

   API:
     registerFeatures(appId, [
       { id, label, hint?, keywords?, run() }
     ])
     openUnitySearch({ appId, appName })
     closeUnitySearch()
   ══════════════════════════════════════════════════════════════════════════════ */

const REGISTRY = new Map();   // appId -> features[]
let _modal = null;
let _input = null;
let _list  = null;
let _ctx   = null;
let _items = [];

export function registerFeatures(appId, features) {
  if (!appId || !Array.isArray(features)) return;
  REGISTRY.set(appId, features.slice());
}

export function getFeatures(appId) {
  return REGISTRY.get(appId) || [];
}

export function openUnitySearch(ctx = {}) {
  _ctx = ctx;
  ensureModal();
  _modal.classList.add('is-open');
  document.body.classList.add('unity-modal-open');
  _items = getFeatures(ctx.appId).slice();
  render('');
  setTimeout(() => _input && _input.focus(), 30);
}

export function closeUnitySearch() {
  if (!_modal) return;
  _modal.classList.remove('is-open');
  document.body.classList.remove('unity-modal-open');
}

function ensureModal() {
  if (_modal) return;
  _modal = document.createElement('div');
  _modal.className = 'unity-search-modal';
  _modal.setAttribute('role', 'dialog');
  _modal.setAttribute('aria-modal', 'true');
  _modal.setAttribute('aria-label', 'Search');
  _modal.innerHTML = `
    <div class="unity-search-backdrop" data-act="close"></div>
    <div class="unity-search-card">
      <div class="unity-search-input-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input class="unity-search-input" type="search" placeholder="Search…" autocomplete="off" spellcheck="false">
        <button class="unity-search-close" data-act="close" aria-label="Close">×</button>
      </div>
      <div class="unity-search-results" role="listbox"></div>
      <div class="unity-search-foot"><kbd>↑↓</kbd> navigate · <kbd>↵</kbd> open · <kbd>Esc</kbd> close</div>
    </div>
  `;
  document.body.appendChild(_modal);
  _input = _modal.querySelector('.unity-search-input');
  _list  = _modal.querySelector('.unity-search-results');

  _modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="close"]')) closeUnitySearch();
    const item = e.target.closest('.unity-search-item');
    if (item) runByIndex(+item.dataset.idx);
  });

  _input.addEventListener('input', () => render(_input.value));

  document.addEventListener('keydown', (e) => {
    if (!_modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeUnitySearch(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveSel(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter') {
      const sel = _list.querySelector('.unity-search-item.is-sel');
      if (sel) { e.preventDefault(); runByIndex(+sel.dataset.idx); }
    }
  });
}

function render(q) {
  const query = (q || '').trim().toLowerCase();
  const matches = !query
    ? _items.slice(0, 20)
    : _items.filter(f => {
        const hay = `${f.label || ''} ${f.hint || ''} ${(f.keywords || []).join(' ')}`.toLowerCase();
        return hay.includes(query);
      }).slice(0, 50);

  if (!matches.length) {
    _list.innerHTML = `<div class="unity-search-empty">${_items.length ? 'No matches.' : `No features registered for <strong>${escapeHtml(_ctx?.appName || 'this app')}</strong>.`}</div>`;
    return;
  }

  _list.innerHTML = matches.map((f, i) => `
    <button class="unity-search-item ${i === 0 ? 'is-sel' : ''}" role="option" data-idx="${_items.indexOf(f)}">
      <div class="unity-search-item-label">${escapeHtml(f.label || '')}</div>
      ${f.hint ? `<div class="unity-search-item-hint">${escapeHtml(f.hint)}</div>` : ''}
    </button>
  `).join('');
}

function moveSel(dir) {
  const items = Array.from(_list.querySelectorAll('.unity-search-item'));
  if (!items.length) return;
  let idx = items.findIndex(el => el.classList.contains('is-sel'));
  idx = (idx + dir + items.length) % items.length;
  items.forEach(el => el.classList.remove('is-sel'));
  items[idx].classList.add('is-sel');
  items[idx].scrollIntoView({ block: 'nearest' });
}

function runByIndex(i) {
  const f = _items[i];
  if (!f) return;
  closeUnitySearch();
  try { f.run && f.run(); } catch (err) { console.error('[unity-search] run failed', err); }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
