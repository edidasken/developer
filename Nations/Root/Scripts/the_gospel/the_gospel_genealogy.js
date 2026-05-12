/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · GENEALOGY — Faces and families of the redemption story.
   "These are the generations…" — Genesis 5:1
   ══════════════════════════════════════════════════════════════════════════════ */

import { esc, snip, emptyState, loadingCards, chip } from './the_gospel_shared.js';

export const name        = 'the_gospel_genealogy';
export const title       = 'Genealogy';
export const description = 'Faces and families across the redemption story — meaning of names, lifespans, and how each life moves the promise forward.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M12 9v3M9 18h6"/></svg>`;
export const accent      = '#a16207';

let _state = { rows: [], q: '', selected: null };

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="genealogy">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-toolbar">
        <input class="grow-search" data-q placeholder="Search a name…" type="search">
      </div>

      <div class="grow-split">
        <aside class="grow-split-aside">
          <div class="grow-gen-list grow-gen-list--scroll" data-bind="list">${loadingCards(8)}</div>
        </aside>
        <article class="grow-split-main grow-gen-detail-panel" data-bind="detail">
          <p class="grow-muted" style="padding:20px; margin:0;">Pick a name to read their story.</p>
        </article>
      </div>
    </section>
  `;
}

export function mount(root) {
  const qEl = root.querySelector('[data-q]');
  qEl.addEventListener('input', () => { _state.q = qEl.value.trim().toLowerCase(); _paint(root); });
  _load(root);
  return () => {};
}

async function _load(root) {
  const list = root.querySelector('[data-bind="list"]');
  // Load from static bundle (regenerated from Firestore via export_genealogy_to_js.py)
  try {
    const mod = await import('../../Data/genealogy.js');
    _state.rows = mod.default || [];
    _paint(root);
  } catch (e) {
    console.error('[gospel/genealogy] static bundle failed:', e);
    list.innerHTML = emptyState({ icon: '⚠️', title: 'Could not load genealogy', body: e.message || String(e) });
  }
}

function _filtered() {
  if (!_state.q) return _state.rows;
  // data uses lowercase keys: name, title, meaning
  return _state.rows.filter((p) => ((p.name || '') + ' ' + (p.title || '') + ' ' + (p.meaning || '')).toLowerCase().includes(_state.q));
}

function _initial(name) {
  const parts = (name || '?').trim().split(/\s+/);
  return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0][0] || '?').toUpperCase();
}

function _paint(root) {
  const list = _filtered();
  const listEl = root.querySelector('[data-bind="list"]');
  if (!list.length) { listEl.innerHTML = emptyState({ icon: '🌳', title: 'No matches' }); return; }
  listEl.innerHTML = list.map((p, i) => {
    const nm = p.name || '';
    const key = nm || String(i);
    const isActive = _state.selected === key;
    const ini = _initial(nm);
    return `
    <button class="grow-gen-row ${isActive ? 'is-active' : ''}" data-p="${esc(key)}">
      <span class="grow-gen-avatar" aria-hidden="true">${esc(ini)}</span>
      <span class="grow-gen-info">
        <span class="grow-gen-name">${esc(nm || '(unnamed)')}</span>
        ${p.title ? `<span class="grow-gen-role">${esc(p.title)}</span>` : (p.meaning ? `<span class="grow-gen-meaning">${esc(p.meaning)}</span>` : '')}
      </span>
    </button>`;
  }).join('');
  listEl.querySelectorAll('[data-p]').forEach((btn) => btn.addEventListener('click', () => {
    _state.selected = btn.dataset.p; _paint(root); _paintDetail(root);
  }));
  _paintDetail(root);
}

function _paintDetail(root) {
  const det = root.querySelector('[data-bind="detail"]');
  if (!_state.selected) return;
  const list = _filtered();
  const p = list.find((x, i) => String(x.name || i) === String(_state.selected));
  if (!p) return;
  const nm = p.name || '';
  const refs = (p.reference || '').split(/[,;]/).map((v) => v.trim()).filter(Boolean);
  const children = (p.children || '').split(/[,;]/).map((c) => c.trim()).filter(Boolean);
  det.innerHTML = /* html */`
    <div class="grow-gen-detail-head">
      <div class="grow-gen-avatar grow-gen-avatar--lg" aria-hidden="true">${esc(_initial(nm))}</div>
      <div>
        <h2 class="grow-gen-name grow-gen-name--hero">${esc(nm)}</h2>
        ${p.title ? `<p class="grow-gen-role grow-gen-role--hero">${esc(p.title)}</p>` : ''}
      </div>
    </div>
    <div class="gene-hero-badges grow-gen-badges">
      ${p.lifespan ? `<span class="gene-hero-badge gene-hero-badge-gold">${esc(p.lifespan)}</span>` : ''}
      ${p.meaning  ? `<span class="gene-hero-badge gene-hero-badge-accent">\u201c${esc(p.meaning)}\u201d</span>` : ''}
      ${refs.length ? `<span class="gene-hero-badge">${esc(refs[0])}</span>` : ''}
    </div>
    <div class="gene-sections">
      ${p.bio ? `<div class="gene-section gene-section-lilac"><div class="gene-section-label">Biography</div><p>${esc(snip(p.bio, 1200))}</p></div>` : ''}
      ${refs.length > 0 ? `<div class="gene-section gene-section-peach"><div class="gene-section-label">Scripture</div><div class="gene-ref-pills">${refs.map((v) => `<span class="gene-ref-pill">${esc(v)}</span>`).join('')}</div></div>` : ''}
      ${children.length ? `<div class="gene-section gene-section-mint"><div class="gene-section-label">Children</div><p>${esc(children.join(', '))}</p></div>` : ''}
    </div>
  `;
}
