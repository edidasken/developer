/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · SHEPHERD'S MIRROR — Live comprehensive soul triage.
   "But be doers of the word, and not hearers only, deceiving yourselves." — James 1:22
   ══════════════════════════════════════════════════════════════════════════════ */

import {
  ur, vine, rows, esc, emptyState, backendOffline, loadingCards,
  bibleLink, helpButton, wireHelp,
} from './the_gospel_shared.js';

export const name        = 'the_gospel_mirror';
export const title       = 'Shepherd\u2019s Mirror';
export const description = 'A live, category-by-category soul triage. Answer honestly and receive Scripture-rooted prescriptions.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 21h6M12 15v6"/></svg>`;
export const accent      = '#7c3aed';

let _state = { rows: [], cats: {}, answers: {} };

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="mirror">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-split grow-split--heart">
        <article class="grow-split-main" data-bind="quiz">${loadingCards(4)}</article>
        <aside class="grow-split-aside" data-bind="plan"></aside>
      </div>
    </section>
  `;
}

export function mount(root) { _load(root); return () => {}; }

async function _load(root) {
  const quiz = root.querySelector('[data-bind="quiz"]');
  const U = ur(); const V = vine();

  /* No backend available — try static bundle before showing offline state. */
  if (!U && !V) {
    try {
      const mod = await import('../../Data/mirror.js');
      _state.rows = mod.default || [];
    } catch (e) {
      console.error('[gospel/mirror] static bundle failed:', e);
    }
    if (!_state.rows.length) { quiz.innerHTML = backendOffline('Mirror not loaded.'); return; }
    _state.cats = {};
    _state.rows.forEach((r) => {
      const cat = r['Category Title'] || r.categoryTitle || 'General';
      if (!_state.cats[cat]) _state.cats[cat] = { color: r.Color || r.color || accent, questions: [] };
      _state.cats[cat].questions.push(r);
    });
    _state.answers = {};
    _paint(root);
    return;
  }

  let res = null;
  try {
    if (U && typeof U.listAppContent === 'function') res = await U.listAppContent('mirror');
    else if (V && V.app && V.app.mirror)             res = await V.app.mirror();
  } catch (e) {
    console.error('[gospel/mirror] load:', e);
    quiz.innerHTML = emptyState({ icon: '\u26a0\ufe0f', title: 'Could not load Mirror', body: e.message || String(e) });
    return;
  }
  _state.rows = rows(res);
  if (!_state.rows.length) {
    quiz.innerHTML = emptyState({ icon: '\ud83d\udd0d', title: 'No triage data yet', body: 'Add Mirror questions in the Matthew spreadsheet.' });
    return;
  }
  _state.cats = {};
  _state.rows.forEach((r) => {
    const cat = r['Category Title'] || r.categoryTitle || 'General';
    if (!_state.cats[cat]) _state.cats[cat] = { color: r.Color || r.color || accent, questions: [] };
    _state.cats[cat].questions.push(r);
  });
  _state.answers = {};
  _paint(root);
}

function _paint(root) {
  const quiz = root.querySelector('[data-bind="quiz"]');
  const plan = root.querySelector('[data-bind="plan"]');
  let h = '';

  Object.entries(_state.cats).forEach(([cat, grp]) => {
    h += `<section class="grow-heart-cat" style="--heart-cat-color:${esc(grp.color)}">
      <h3 class="grow-heart-cat-title">
        <span class="grow-cat-bar"></span>
        ${esc(cat)}
      </h3>`;
    grp.questions.forEach((q, idx) => {
      const qid = q['Question ID'] || q.questionId || ('mq_' + cat + '_' + idx);
      q.__qid = qid;
      const ans = _state.answers[qid];
      h += `<div class="grow-heart-q">
        <p class="grow-heart-text">${esc(q.Question || q.question || '')}</p>
        <div class="grow-heart-ans">
          <button class="grow-ans-btn grow-ans-btn--neg ${ans === 'yes' ? 'is-active' : ''}" data-q="${esc(qid)}" data-ans="yes">Yes</button>
          <button class="grow-ans-btn grow-ans-btn--pos ${ans === 'no'  ? 'is-active' : ''}" data-q="${esc(qid)}" data-ans="no">No</button>
        </div>
      </div>`;
    });
    h += `</section>`;
  });
  quiz.innerHTML = h;
  quiz.querySelectorAll('[data-ans]').forEach((b) => {
    b.addEventListener('click', () => { _state.answers[b.dataset.q] = b.dataset.ans; _paint(root); });
  });

  // Right panel: per-category load + prescriptions
  const total = _state.rows.length;
  const answered = Object.keys(_state.answers).length;
  const flagged = _state.rows.filter((r) => _state.answers[r.__qid] === 'yes');

  let p = `<div class="grow-section-head"><h2 class="grow-section-title">Heart Load</h2></div>`;
  p += `<p class="grow-muted">${answered} of ${total} answered \u00b7 ${flagged.length} flagged</p>`;

  Object.entries(_state.cats).forEach(([cat, grp]) => {
    const items = grp.questions;
    const ansN  = items.filter((q) => _state.answers[q.__qid]).length;
    const yesN  = items.filter((q) => _state.answers[q.__qid] === 'yes').length;
    const pct   = items.length ? Math.round((yesN / items.length) * 100) : 0;
    p += `<div class="grow-mirror-bar-row" style="--heart-cat-color:${esc(grp.color)}">
      <div class="grow-mirror-bar-head">
        <span class="grow-mirror-bar-cat">${esc(cat)}</span>
        <span class="grow-muted">${yesN}/${items.length} (${ansN}/${items.length} answered)</span>
      </div>
      <div class="grow-progress"><div class="grow-progress-fill" style="width:${pct}%;"></div></div>
    </div>`;
  });

  if (flagged.length) {
    p += `<div class="grow-section-head grow-section-head--mt"><h2 class="grow-section-title">Strategic Action Plan</h2></div>`;
    flagged.slice(0, 6).forEach((q) => {
      const cat   = q['Category Title'] || q.categoryTitle || 'General';
      const color = (_state.cats[cat] && _state.cats[cat].color) || accent;
      const rx    = q.Prescription || q.prescription || '';
      const ref   = q.Scripture || q.scripture || q['Verse Reference'] || '';
      p += `<div class="grow-action-card" style="--action-color:${esc(color)}">
        <div class="grow-action-cat">${esc(cat)}</div>
        <p class="grow-action-q">${esc(q.Question || '')}</p>
        ${rx  ? `<p class="grow-action-rx"><strong>Step:</strong> ${esc(rx)}</p>` : ''}
        ${ref ? `<p class="grow-action-ref">${bibleLink(ref)}</p>` : ''}
      </div>`;
    });
    p += helpButton({ label: 'Send this triage to my pastor', dataAttr: 'help-mirror' });
  } else {
    p += `<p class="grow-muted grow-plan-empty">Complete the diagnostic to see your action plan…</p>`;
  }

  plan.innerHTML = p;

  if (flagged.length) {
    wireHelp(plan, () => {
      const lines = ['Shepherd\u2019s Mirror triage — areas I\u2019m wrestling with:'];
      flagged.forEach((q) => {
        const cat = q['Category Title'] || 'General';
        lines.push(`\u2022 [${cat}] ${q.Question || ''}`);
      });
      return lines.join('\n');
    }, { category: 'Soul Triage', source: 'Mirror', confidential: true });
  }
}
