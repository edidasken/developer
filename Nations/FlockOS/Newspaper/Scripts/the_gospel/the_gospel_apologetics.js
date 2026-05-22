/* ═════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · APOLOGETICS — Reasons for the hope that is in you.
   "Always be prepared to give an answer to everyone who asks you to give the
    reason for the hope that you have." — 1 Peter 3:15
   ═════════════════════════════════════════════════════════════════════════════ */

import { esc, emptyState, loadingCards } from './the_gospel_shared.js';

export const name        = 'the_gospel_apologetics';
export const title       = 'Apologetics';
export const description = 'Common objections to the faith — answered with scripture, reason, and a steady tone.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M3 7l9 3 9-3"/><path d="M3 17l9-3 9 3"/></svg>`;
export const accent      = '#6b5b9a';

let _state = { rows: [], q: '', expanded: new Set() };

function _dayOfYear() {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000);
}

export function render() {
  return `
    <section class="grow-page" data-grow="apologetics">
      <style>
        .apo-today { background:var(--surface-raised,#fff); border-radius:18px; border:1.5px solid rgba(107,91,154,.2); border-top:4px solid #6b5b9a; padding:22px 22px 20px; margin:0 0 28px; box-shadow:0 3px 22px rgba(107,91,154,.1); }
        .apo-today-label { display:inline-flex; align-items:center; gap:5px; font:700 0.68rem var(--font-ui); letter-spacing:.1em; text-transform:uppercase; color:#6b5b9a; margin-bottom:10px; }
        .apo-today-cat { display:inline-flex; align-items:center; gap:4px; padding:3px 11px; border-radius:20px; font:700 0.65rem var(--font-ui); letter-spacing:.07em; text-transform:uppercase; border:1.5px solid currentColor; margin-bottom:12px; }
        .apo-today-q { font-family:var(--font-headline,'Lora',Georgia,serif); font-size:1.35rem; font-weight:700; color:var(--ink,#1a1d2e); margin:0 0 16px; line-height:1.25; }
        .apo-today-answer { font-size:0.94rem; line-height:1.78; color:var(--ink,#1a1d2e); margin:0 0 14px; }
        .apo-today-quote { border-left:3px solid #6b5b9a; padding:10px 16px; background:rgba(107,91,154,.05); border-radius:0 8px 8px 0; margin:0 0 8px; }
        .apo-today-quote p { font-family:var(--font-headline,'Lora',Georgia,serif); font-style:italic; font-size:1.0rem; line-height:1.72; color:var(--ink,#1a1d2e); margin:0 0 6px; }
        .apo-today-quote cite { font:600 0.75rem var(--font-ui); color:#6b5b9a; font-style:normal; }
        .apo-today-ref { font:600 0.76rem var(--font-ui); color:#6b5b9a; text-decoration:none; }
        .apo-today-ref:hover { opacity:.75; }
        .apo-search-wrap { margin:0 0 22px; }
        .apo-section { margin-bottom:28px; }
        .apo-section-head { margin-bottom:14px; border-bottom:2px solid; padding-bottom:10px; }
        .apo-section-title { font-family:var(--font-headline,'Lora',Georgia,serif); font-size:1.2rem; font-weight:700; color:var(--ink,#1a1d2e); margin:0 0 4px; display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
        .apo-section-count { font:700 0.65rem var(--font-ui); letter-spacing:.09em; text-transform:uppercase; padding:2px 8px; border-radius:12px; background:currentColor; color:#fff; }
        .apo-section-intro { font:0.84rem/1.65 var(--font-body); color:var(--ink-muted,#6b6b6b); margin:5px 0 0; }
        .apo-cards { display:flex; flex-direction:column; gap:6px; }
        .apo-card { background:var(--surface-raised,#fff); border-radius:10px; border:1.5px solid var(--line,#e5e7ef); overflow:hidden; transition:border-color .15s,box-shadow .15s; }
        .apo-card:hover { border-color:rgba(107,91,154,.4); }
        .apo-card.is-open { border-color:#6b5b9a; box-shadow:0 2px 14px rgba(107,91,154,.12); }
        .apo-q-btn { display:grid; grid-template-columns:32px 1fr 20px; align-items:center; gap:10px; background:none; border:none; width:100%; text-align:left; padding:12px 14px; cursor:pointer; }
        .apo-num { font:700 0.65rem var(--font-ui); color:#6b5b9a; background:rgba(107,91,154,.1); border-radius:6px; width:26px; height:26px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .apo-qtext { font:600 0.91rem var(--font-ui); color:var(--ink,#1a1d2e); line-height:1.4; }
        .apo-chevron { color:var(--ink-muted,#6b6b6b); transition:transform .2s; flex-shrink:0; }
        .apo-card.is-open .apo-chevron { transform:rotate(180deg); }
        .apo-body { display:none; border-top:1px solid var(--line,#e5e7ef); padding:16px 18px 18px; background:var(--surface,#f9fafb); }
        .apo-card.is-open .apo-body { display:block; }
        .apo-answer { font:0.9rem/1.8 var(--font-body); color:var(--ink,#1a1d2e); margin:0 0 14px; }
        .apo-quote-block { border-left:3px solid #6b5b9a; padding:9px 14px; background:rgba(107,91,154,.05); border-radius:0 8px 8px 0; margin:0 0 10px; }
        .apo-quote-block p { font-family:var(--font-headline,'Lora',Georgia,serif); font-style:italic; font-size:0.92rem; line-height:1.7; color:var(--ink,#1a1d2e); margin:0 0 5px; }
        .apo-quote-block cite { font:600 0.72rem var(--font-ui); color:#6b5b9a; font-style:normal; }
        .apo-ref-link { font:600 0.73rem var(--font-ui); color:#6b5b9a; text-decoration:none; }
        .apo-ref-link:hover { opacity:.75; }
        .apo-topic { font:italic 0.8rem var(--font-body); color:var(--ink-muted,#6b6b6b); margin:0 0 10px; }
      </style>
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
    const mod = await import('../../Data/apologetics.js');
    _state.rows = (mod.default || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  } catch (e) {
    view.innerHTML = emptyState({ icon: '⚠️', title: 'Could not load', body: String(e) });
    return;
  }
  if (!_state.rows.length) {
    view.innerHTML = emptyState({ icon: '⚖️', title: 'No questions yet' });
    return;
  }
  _paint(view);
}

function _paint(view) {
  const q = _state.q;
  const rows = q
    ? _state.rows.filter(r => ((r.questionTitle || '') + ' ' + (r.answerContent || '') + ' ' + (r.categoryTitle || '')).toLowerCase().includes(q))
    : _state.rows;

  const todayQ = _state.rows[_dayOfYear() % _state.rows.length];

  const catMap = new Map();
  rows.forEach(r => {
    const cat = r.categoryTitle || 'General';
    if (!catMap.has(cat)) catMap.set(cat, { color: r.categoryColor || accent, intro: r.categoryIntro || '', items: [] });
    catMap.get(cat).items.push(r);
  });

  view.innerHTML =
    (!q ? _todayCard(todayQ) : '')
    + '<div class="grow-section-head"><span class="grow-section-title">All Questions</span></div>'
    + '<div class="apo-search-wrap"><input class="grow-search" data-q placeholder="Search questions\u2026" type="search" value="' + esc(q) + '"></div>'
    + (rows.length === 0 ? emptyState({ icon: '⚖️', title: 'No matches' }) : '')
    + [...catMap.entries()].map(([cat, { color, intro, items }]) => _catSection(cat, color, intro, items)).join('');

  const qEl = view.querySelector('[data-q]');
  if (qEl) qEl.addEventListener('input', () => { _state.q = qEl.value.trim().toLowerCase(); _paint(view); });

  view.querySelectorAll('.apo-card').forEach(card => {
    if (_state.expanded.has(card.dataset.id)) card.classList.add('is-open');
    card.querySelector('.apo-q-btn').addEventListener('click', () => {
      const id = card.dataset.id;
      if (_state.expanded.has(id)) { _state.expanded.delete(id); card.classList.remove('is-open'); }
      else { _state.expanded.add(id); card.classList.add('is-open'); card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    });
  });
}

function _todayCard(q) {
  if (!q) return '';
  const qtitle = (q.questionTitle || '').replace(/^\d+\.\s*/, '');
  const color  = q.categoryColor || accent;
  return '<div class="apo-today">'
    + '<div class="apo-today-label">\u2696 Today\u2019s Question</div>'
    + (q.categoryTitle ? '<div class="apo-today-cat" style="border-color:' + esc(color) + ';color:' + esc(color) + '">' + esc(q.categoryTitle) + '</div>' : '')
    + '<h2 class="apo-today-q">' + esc(qtitle) + '</h2>'
    + (q.answerContent ? '<p class="apo-today-answer">' + esc(q.answerContent) + '</p>' : '')
    + (q.quoteText ? '<blockquote class="apo-today-quote"><p>' + esc(q.quoteText) + '</p>'
        + (q.referenceText ? '<cite>' + (q.referenceUrl ? '<a class="apo-today-ref" href="' + esc(q.referenceUrl) + '" target="_blank" rel="noopener">' + esc(q.referenceText) + '</a>' : esc(q.referenceText)) + '</cite>' : '')
        + '</blockquote>' : '')
    + '</div>';
}

function _catSection(cat, color, intro, items) {
  return '<div class="apo-section">'
    + '<div class="apo-section-head" style="border-color:' + esc(color) + '">'
    + '<h3 class="apo-section-title" style="color:' + esc(color) + '">' + esc(cat)
    + ' <span class="apo-section-count" style="background:' + esc(color) + '">' + items.length + ' question' + (items.length !== 1 ? 's' : '') + '</span></h3>'
    + (intro ? '<p class="apo-section-intro">' + esc(intro) + '</p>' : '')
    + '</div>'
    + '<div class="apo-cards">' + items.map(r => _card(r)).join('') + '</div>'
    + '</div>';
}

function _card(q) {
  const id     = q._id || q.questionId || String(q.sortOrder);
  const qtitle = (q.questionTitle || '').replace(/^\d+\.\s*/, '');
  const short  = (q.shortTitle || '').replace(/^\d+\.\s*/, '');
  return '<div class="apo-card" data-id="' + esc(id) + '">'
    + '<button class="apo-q-btn" type="button">'
    + '<span class="apo-num">' + (q.sortOrder || '') + '</span>'
    + '<span class="apo-qtext">' + esc(qtitle) + '</span>'
    + '<svg class="apo-chevron" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>'
    + '</button>'
    + '<div class="apo-body">'
    + (short && short !== qtitle ? '<p class="apo-topic">' + esc(short) + '</p>' : '')
    + (q.answerContent ? '<p class="apo-answer">' + esc(q.answerContent) + '</p>' : '')
    + (q.quoteText ? '<blockquote class="apo-quote-block"><p>' + esc(q.quoteText) + '</p>'
        + (q.referenceText ? '<cite>' + (q.referenceUrl ? '<a class="apo-ref-link" href="' + esc(q.referenceUrl) + '" target="_blank" rel="noopener">' + esc(q.referenceText) + '</a>' : esc(q.referenceText)) + '</cite>' : '')
        + '</blockquote>' : '')
    + '</div></div>';
}
