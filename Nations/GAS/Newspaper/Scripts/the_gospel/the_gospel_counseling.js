/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · COUNSELING — Biblical counsel for ordinary trials.
   "Cast all your anxiety on him, because he cares for you." — 1 Peter 5:7
   ══════════════════════════════════════════════════════════════════════════════ */

import {
  esc, emptyState, loadingCards,
  bibleLink, helpButton, wireHelp,
} from './the_gospel_shared.js';

export const name        = 'the_gospel_counseling';
export const title       = 'Counseling';
export const description = 'Biblical counsel for the trials we all face — anxiety, grief, marriage, addiction, parenting, and more.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.66l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21l8.84-8.62a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
export const accent      = '#16a34a';

// Map Tailwind palette names (and other casual color words used in the
// counseling bundle) to readable hex values that have sufficient contrast on
// a light background. Anything else is returned as-is so explicit hex values
// in the data still work. Unknown / pale CSS color words (cyan, yellow, lime,
// aqua, etc.) are normalized so they never render as unreadable neon.
const _COLOR_MAP = {
  // Tailwind 600/700-ish — accessible on white
  slate:   '#475569',
  gray:    '#4b5563',
  zinc:    '#52525b',
  stone:   '#57534e',
  red:     '#dc2626',
  orange:  '#ea580c',
  amber:   '#b45309',
  yellow:  '#a16207',
  lime:    '#4d7c0f',
  green:   '#16a34a',
  emerald: '#059669',
  teal:    '#0f766e',
  cyan:    '#0e7490',
  sky:     '#0369a1',
  blue:    '#2563eb',
  indigo:  '#4f46e5',
  violet:  '#7c3aed',
  purple:  '#9333ea',
  fuchsia: '#c026d3',
  pink:    '#db2777',
  rose:    '#e11d48',
  // Plain CSS color words that are too pale on white
  aqua:    '#0e7490',
  gold:    '#b45309',
  silver:  '#6b7280',
};

function _safeColor(c) {
  if (!c) return accent;
  const s = String(c).trim();
  if (!s) return accent;
  // Honor explicit hex / rgb / hsl / var(--…) / CSS custom values as-is.
  if (/^(#|rgb|hsl|var\()/i.test(s)) return s;
  const key = s.toLowerCase();
  return _COLOR_MAP[key] || s;
}

const _cache = {};      // id → full doc
let _stubs   = [];      // catalog stubs

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="counseling">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <input type="search" class="grow-search" data-bind="search" placeholder="🔍 Search topics…" />
      <div class="grow-grid grow-grid--counseling" data-bind="grid">${loadingCards(6)}</div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  const search = root.querySelector('[data-bind="search"]');
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase().trim();
      root.querySelectorAll('.coun-card').forEach((el) => {
        const hay = (el.dataset.search || '').toLowerCase();
        el.style.display = !q || hay.includes(q) ? '' : 'none';
      });
    });
  }
  return () => {};
}

async function _load(root) {
  const grid = root.querySelector('[data-bind="grid"]');

  // Load from static bundle (regenerated from Firestore via export_counseling_to_js.py)
  _stubs = [];
  try {
    const mod = await import('../../Data/counseling.js');
    const arr = mod.default || [];
    arr.forEach((d) => {
      const id = d._id || d.id || d.topicId;
      if (!id) return;
      _cache[id] = d;
      _stubs.push({
        id,
        title: d.title || d.Title || id,
        icon:  d.icon  || d.Icon  || '🌿',
        color: _safeColor(d.color || d.Color || accent),
      });
    });
  } catch (e) {
    console.error('[gospel/counseling] static bundle failed:', e);
  }

  // Fallback: try UpperRoom (authenticated FlockOS context)
  if (!_stubs.length && typeof UpperRoom !== 'undefined' && typeof UpperRoom.listAppContent === 'function') {
    try {
      const rows = await UpperRoom.listAppContent('counseling');
      (rows || []).forEach((d) => {
        const id = d._id || d.id || d.topicId;
        if (!id) return;
        _cache[id] = d;
        _stubs.push({
          id,
          title: d.title || d.Title || id,
          icon:  d.icon  || d.Icon  || '🌿',
          color: _safeColor(d.color || d.Color || accent),
        });
      });
    } catch (e) {
      console.error('[gospel/counseling] UpperRoom fallback failed:', e);
    }
  }

  if (!_stubs.length) {
    grid.innerHTML = emptyState({ icon: '💚', title: 'Counseling resources coming soon', body: 'Biblical counseling wisdom and protocols will appear here.' });
    return;
  }

  grid.innerHTML = _stubs.map(_card).join('');
  grid.querySelectorAll('.coun-card').forEach((el) => {
    el.addEventListener('click', (ev) => {
      // Ignore clicks inside the open body (so links/buttons work normally)
      if (ev.target.closest('.coun-card-body')) return;
      _toggle(el, el.dataset.id);
    });
  });
}

function _card(s) {
  const safeTitle = esc(s.title);
  const item      = _cache[s.id] || {};
  const rawDef    = (item.Definition || item.definition || '').trim();
  const teaser    = rawDef ? esc(rawDef.length > 92 ? rawDef.substring(0, 90) + '\u2026' : rawDef) : '';
  const chevSvg   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  return /* html */`
    <div class="grow-card grow-card--counsel coun-card"
         data-id="${esc(s.id)}"
         data-search="${safeTitle.toLowerCase()}"
         style="--grow-accent:${esc(s.color)}; cursor:pointer;">
      <div class="coun-card-head">
        <div class="coun-icon-badge" style="background:color-mix(in srgb,${esc(s.color)} 12%,transparent);">
          <span class="coun-icon-emoji" aria-hidden="true">${esc(s.icon)}</span>
        </div>
        <div class="coun-card-meta-col">
          <h3 class="grow-card-title">${safeTitle}</h3>
          ${teaser ? `<p class="coun-card-teaser">${teaser}</p>` : ''}
        </div>
        <span class="coun-card-chevron" aria-hidden="true">${chevSvg}</span>
      </div>
      <div class="coun-card-body"></div>
    </div>
  `;
}

async function _toggle(cardEl, id) {
  const body = cardEl.querySelector('.coun-card-body');
  if (!body) return;

  if (cardEl.classList.contains('is-open')) {
    body.style.display = 'none';
    cardEl.classList.remove('is-open');
    return;
  }

  // Close any other open card first (so only one is full-width at a time)
  cardEl.parentElement.querySelectorAll('.coun-card.is-open').forEach((other) => {
    if (other === cardEl) return;
    other.classList.remove('is-open');
    const ob = other.querySelector('.coun-card-body');
    if (ob) ob.style.display = 'none';
  });
  cardEl.classList.add('is-open');
  body.style.display = 'block';

  if (!_cache[id]) {
    body.innerHTML = `<div class="grow-muted" style="color:var(--err, #c0392b); padding:8px 0;">Content not found in bundle.</div>`;
    return;
  }
  const item = _cache[id];
  if (!item) {
    body.innerHTML = `<div class="grow-muted" style="color:var(--err, #c0392b); padding:8px 0;">Could not load content.</div>`;
    return;
  }
  body.innerHTML = _detailHtml(item) + helpButton({ label: 'Send a prayer request', dataAttr: 'help-' + id });
  const stub = _stubs.find((s) => s.id === id) || {};
  wireHelp(body, () => _summary(stub, item), { category: 'Counseling: ' + (item.Title || stub.title || id), source: 'Counseling' });
}

function _detailHtml(item) {
  const color   = _safeColor(item.Color || item.color || accent);
  const def     = item.Definition || item.definition || '';
  const scrips  = _parseScriptures(item.Scriptures || item.scriptures || '');
  const steps   = _parseSteps(item.Steps || item.steps || '');
  let h = '';
  if (def) h += `<p class="grow-counsel-def">${esc(def)}</p>`;
  if (scrips.length) {
    h += `<div class="grow-counsel-section-head" style="--counsel-color:${esc(color)}"><span class="grow-counsel-section-icon">📖</span> Scripture Foundation</div>`;
    scrips.forEach((s) => {
      h += `<div class="grow-counsel-scripture" style="--counsel-color:${esc(color)}">`;
      if (s.ref)  h += `<div class="grow-counsel-ref">${bibleLink(s.ref)}</div>`;
      if (s.text) h += `<div class="grow-counsel-verse">“${esc(s.text)}”</div>`;
      h += `</div>`;
    });
  }
  if (steps.length) {
    h += `<div class="grow-counsel-section-head" style="--counsel-color:${esc(color)}"><span class="grow-counsel-section-icon">💡</span> Faith Response Steps</div>`;
    h += `<ol class="grow-counsel-steps">`;
    steps.forEach((s) => { h += `<li>${esc(s)}</li>`; });
    h += `</ol>`;
  }
  if (!h) h = `<p class="grow-muted" style="padding:8px 0;">No details available.</p>`;
  return h;
}

function _parseScriptures(raw) {
  if (!raw) return [];
  const parts = String(raw).split(/(?=(?:[123]?\s?[A-Z][a-z]+\s+\d+:\d+))/g);
  const out = [];
  parts.forEach((p) => {
    p = p.trim(); if (!p) return;
    const m = p.match(/^([123]?\s?[A-Za-z]+\s+\d+:\d+(?:-\d+)?):?\s*([\s\S]*)/);
    if (m) out.push({ ref: m[1].trim(), text: m[2].replace(/[.;,\s]+$/, '').trim() });
    else   out.push({ ref: '', text: p.replace(/[.;,\s]+$/, '').trim() });
  });
  return out;
}
function _parseSteps(raw) {
  if (!raw) return [];
  // Split on explicit separators first (semicolons, newlines), then on
  // sentence boundaries: a period followed by a space and a capital letter.
  // This turns the single "steps" string in the bundle (sentences joined by
  // ". ") into one numbered item per sentence — much easier to read on mobile.
  const text = String(raw).trim();
  const parts = text.split(/(?:[;\n]+|(?<=\.)\s+(?=[A-Z(]))/);
  return parts
    .map((s) => s.trim().replace(/^[-•\d.\s]+/, '').trim())
    .filter(Boolean);
}

function _summary(stub, item) {
  const title = item.Title || item.title || stub.title || 'Counseling topic';
  const def   = (item.Definition || item.definition || '').slice(0, 280);
  return `I'm working through "${title}" in the Counseling library and would value pastoral prayer and follow-up.${def ? '\n\nTopic summary: ' + def : ''}`;
}
