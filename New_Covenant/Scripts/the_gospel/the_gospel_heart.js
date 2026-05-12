/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · HEART CHECK — A spiritual diagnostic for honest reflection.
   "Search me, O God, and know my heart!" — Psalm 139:23
   ══════════════════════════════════════════════════════════════════════════════ */

import { ur, vine, rows, esc, emptyState, backendOffline, loadingCards, sectionHead, helpButton, wireHelp, bibleLink } from './the_gospel_shared.js';

export const name        = 'the_gospel_heart';
export const title       = 'Heart Check';
export const description = 'A simple, honest diagnostic — answer Yes or No to walk with the Lord into the corners we ignore.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.66l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21l8.84-8.62a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
export const accent      = '#dc2626';

let _state = { rows: [], answers: {} };

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="heart">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-split grow-split--heart">
        <article class="grow-split-main" data-bind="quiz">${loadingCards(4)}</article>
        <aside class="grow-split-aside" data-bind="scan"></aside>
      </div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  return () => {};
}

async function _load(root) {
  const quiz = root.querySelector('[data-bind="quiz"]');
  const U = ur(); const V = vine();

  /* No backend available — try static bundle before showing offline state. */
  if (!U && !V) {
    try {
      const mod = await import('../../Data/heart.js');
      _state.rows = mod.default || [];
    } catch (e) {
      console.error('[gospel/heart] static bundle failed:', e);
    }
    if (!_state.rows.length) { quiz.innerHTML = backendOffline('Heart check not loaded.'); return; }
    _paint(root);
    return;
  }

  let res = null;
  try {
    if (U && typeof U.listAppContent === 'function')   res = await U.listAppContent('heart');
    else if (V && V.app && V.app.heart)                res = await V.app.heart();
  } catch (e) {
    console.error('[gospel/heart] load:', e);
    quiz.innerHTML = emptyState({ icon: '⚠️', title: 'Could not load heart check', body: e.message || String(e) });
    return;
  }
  _state.rows = rows(res);
  if (!_state.rows.length) { quiz.innerHTML = emptyState({ icon: '❤️', title: 'No questions yet' }); return; }
  _paint(root);
}

function _paint(root) {
  const quiz = root.querySelector('[data-bind="quiz"]');
  const scan = root.querySelector('[data-bind="scan"]');

  // Group by category
  const groups = {};
  _state.rows.forEach((q) => {
    const k = q.Category || q.category || 'Reflection';
    (groups[k] = groups[k] || []).push(q);
  });
  quiz.innerHTML = Object.entries(groups).map(([cat, items]) => /* html */`
    <section class="grow-heart-cat">
      <h3 class="grow-heart-cat-title">${esc(cat)}</h3>
      ${items.map(_qRow).join('')}
    </section>
  `).join('');

  quiz.querySelectorAll('[data-ans]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.q;
      const v  = btn.dataset.ans;
      _state.answers[id] = v;
      _paint(root);
    });
  });

  // Scan
  const total = _state.rows.length;
  const answered = Object.keys(_state.answers).length;
  const pct = total ? Math.round((answered / total) * 100) : 0;
  // category breakdown
  const breakdown = {};
  _state.rows.forEach((q) => {
    const k = q.Category || q.category || 'Reflection';
    breakdown[k] = breakdown[k] || { total: 0, ans: 0, yes: 0 };
    breakdown[k].total++;
    if (_state.answers[q['Question ID'] || q.id]) {
      breakdown[k].ans++;
      if (_state.answers[q['Question ID'] || q.id] === 'yes') breakdown[k].yes++;
    }
  });
  scan.innerHTML = /* html */`
    ${sectionHead('Vitality scan')}
    <div class="grow-scan-pct">${pct}%</div>
    <p class="grow-muted">${answered} of ${total} questions answered</p>
    <div class="grow-scan-bars">
      ${Object.entries(breakdown).map(([k, v]) => `
        <div class="grow-scan-row">
          <span class="grow-scan-label">${esc(k)}</span>
          <div class="grow-progress"><div class="grow-progress-fill" style="width:${v.total ? Math.round((v.ans/v.total)*100):0}%; background:${accent}"></div></div>
          <span class="grow-scan-meta">${v.ans}/${v.total}</span>
        </div>
      `).join('')}
    </div>
    ${answered ? _prescriptionsHtml() : ''}
    ${answered ? helpButton({ label: 'Send this heart check to my pastor', dataAttr: 'help-heart' }) : ''}
  `;
  if (answered) {
    wireHelp(scan, () => {
      const flagged = _state.rows.filter((q) => _state.answers[q['Question ID'] || q.id] === 'yes');
      const lines = ['Heart Check — areas where I answered “Yes” (struggling):'];
      flagged.forEach((q) => {
        const cat = q.Category || q.category || 'Reflection';
        lines.push(`\u2022 [${cat}] ${q.Question || q.question || ''}`);
      });
      return lines.join('\n');
    }, { category: 'Heart Check', source: 'Heart Check', confidential: true });
  }
}

function _prescriptionsHtml() {
  const flagged = _state.rows.filter((q) => _state.answers[q['Question ID'] || q.id] === 'yes');
  if (!flagged.length) return '';
  let h = `<div class="grow-section-head grow-section-head--mt"><h2 class="grow-section-title">Prescriptions</h2></div>`;
  flagged.slice(0, 6).forEach((q) => {
    const rx  = q.Prescription || q.prescription || '';
    const ref = q['Verse Reference'] || q.verseReference || '';
    h += `<div class="grow-rx-card">
      <p class="grow-action-q">${esc(q.Question || '')}</p>
      ${rx  ? `<p class="grow-action-rx"><strong>Step:</strong> ${esc(rx)}</p>` : ''}
      ${ref ? `<p class="grow-action-ref">${bibleLink(ref)}</p>` : ''}
    </div>`;
  });
  return h;
}

function _qRow(q) {
  const id  = q['Question ID'] || q.id;
  const ans = _state.answers[id];
  return /* html */`
    <div class="grow-heart-q">
      <p class="grow-heart-text">${esc(q.Question || q.question || '')}</p>
      <div class="grow-heart-ans">
        <button class="grow-ans-btn grow-ans-btn--neg ${ans === 'yes' ? 'is-active' : ''}" data-q="${esc(String(id))}" data-ans="yes">Yes</button>
        <button class="grow-ans-btn grow-ans-btn--pos ${ans === 'no'  ? 'is-active' : ''}" data-q="${esc(String(id))}" data-ans="no">No</button>
      </div>
    </div>
  `;
}
