/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · QUIZZES — Bible challenges & course assessments.
   "Examine yourselves to see whether you are in the faith." — 2 Corinthians 13:5
   ══════════════════════════════════════════════════════════════════════════════ */

import {
  esc, snip, emptyState, loadingCards, chip,
  helpButton, wireHelp,
} from './the_gospel_shared.js';

export const name        = 'the_gospel_quizzes';
export const title       = 'Quizzes';
export const description = 'Bible challenges, course assessments, and self-checks — track what you know and where to grow.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>`;
export const accent      = '#0ea5e9';

let _state = {
  course:  [],   // course-level quizzes from learning system
  bible:   [],   // app-level Bible Q&A from Matthew
  picked:  [],
  idx:     0,
  answers: {},
  mode:    'lobby',  // 'lobby' | 'taking' | 'results'
};

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="quizzes">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>
      <div data-bind="root">${loadingCards(4)}</div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  return () => {};
}

async function _load(root) {
  const view = root.querySelector('[data-bind="root"]');
  // Load bible quiz questions from static bundle (regenerated via export_quiz_to_js.py)
  // Course/structured quizzes are user-created content — not yet bundled
  try {
    const mod = await import('../../Data/quiz.js');
    _state.bible  = mod.default || [];
    _state.course = [];
  } catch (e) {
    console.error('[gospel/quizzes] static bundle failed:', e);
    view.innerHTML = emptyState({ icon: '⚠️', title: 'Could not load quizzes', body: e.message || String(e) });
    return;
  }
  _state.mode = 'lobby';
  _paintLobby(root);
}

function _paintLobby(root) {
  const view = root.querySelector('[data-bind="root"]');

  // Gather category stats
  const catCounts = {};
  _state.bible.forEach((q) => { const c = q.category || q.Category || 'General'; catCounts[c] = (catCounts[c] || 0) + 1; });
  const cats = Object.entries(catCounts).slice(0, 6);

  let html = '';
  if (_state.bible.length) {
    html += `
      <div class="grow-quiz-lobby">
        <div class="grow-quiz-lobby-left">
          <div class="grow-quiz-big-num">${_state.bible.length}</div>
          <div class="grow-quiz-big-label">Bible Questions</div>
          <p class="grow-quiz-lobby-desc">Test your knowledge of scripture — 10 random questions drawn from ${cats.length} categories.</p>
          <button type="button" class="grow-quiz-launch" data-start-bible>
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
            Start Bible Quiz
          </button>
        </div>
        <div class="grow-quiz-cats">
          ${cats.map(([cat, n]) => `<div class="grow-quiz-cat-chip"><span class="grow-quiz-cat-name">${esc(cat)}</span><span class="grow-quiz-cat-n">${n}</span></div>`).join('')}
        </div>
      </div>
    `;
  }

  if (_state.course.length) {
    html += `
      <div class="grow-section-head grow-section-head--mt"><h2 class="grow-section-title">Course Quizzes</h2></div>
      <div class="grow-grid grow-grid--quizzes">${_state.course.map(_courseCard).join('')}</div>
    `;
  }

  if (!_state.bible.length && !_state.course.length) {
    html = emptyState({ icon: '❓', title: 'No quizzes yet', body: 'Quizzes appear here as your shepherd publishes them.' });
  }

  view.innerHTML = html;
  const startBtn = view.querySelector('[data-start-bible]');
  if (startBtn) startBtn.addEventListener('click', () => _startBible(root));
}

function _courseCard(q) {
  const diff = q.difficulty ? chip(q.difficulty, 'level') : '';
  const cnt  = q.questionCount ? chip(q.questionCount + ' qs', 'neutral') : '';
  const time = q.timeLimitMins ? chip(q.timeLimitMins + ' min', 'neutral') : '';
  return /* html */`
    <article class="grow-card grow-card--quiz" tabindex="0" style="--grow-accent:${accent};">
      <div class="grow-card-cover grow-card-cover--placeholder">
        <div class="grow-card-cover-icon">${icon}</div>
      </div>
      <div class="grow-card-body">
        <div class="grow-card-tags">${diff}${cnt}${time}</div>
        <h3 class="grow-card-title">${esc(q.title || 'Untitled quiz')}</h3>
        ${q.description ? `<p class="grow-card-desc">${esc(snip(q.description, 140))}</p>` : ''}
      </div>
    </article>
  `;
}

/* ── Bible quiz flow ─────────────────────────────────────────────────── */

function _startBible(root) {
  const all = _state.bible.slice().sort(() => Math.random() - 0.5);
  _state.picked  = all.slice(0, Math.min(10, all.length));
  _state.idx     = 0;
  _state.answers = {};
  _state.mode    = 'taking';
  _paintQ(root);
}

function _paintQ(root) {
  const view  = root.querySelector('[data-bind="root"]');
  const total = _state.picked.length;
  const i     = _state.idx;
  const q     = _state.picked[i];
  if (!q) return;

  const opts   = ['A', 'B', 'C', 'D'].map((k) => ({ key: k.toLowerCase(), text: q['option' + k] || q['Option ' + k] })).filter((o) => o.text);
  const saved  = _state.answers[i] || '';
  const pct    = Math.round(((i + 1) / total) * 100);

  let html = `
    <div class="grow-quiz-progress-bar">
      <div class="grow-quiz-progress-meta">
        <span>Question ${i + 1} of ${total}</span>
        <span>${pct}% through</span>
      </div>
      <div class="grow-progress"><div class="grow-progress-fill" style="width:${pct}%; background:${accent};"></div></div>
    </div>
    <div class="grow-quiz-q-card">
      <div class="grow-quiz-q-num">${i + 1}</div>
      <h3 class="grow-quiz-q-text">${esc(q.question || q.Question || '')}</h3>
      ${q.category || q.Category ? `<div class="grow-quiz-q-meta">${chip(q.category || q.Category, 'topic')}${q.difficulty || q.Difficulty ? ' ' + chip(q.difficulty || q.Difficulty, (q.difficulty || q.Difficulty) === 'Hard' ? 'danger' : (q.difficulty || q.Difficulty) === 'Medium' ? 'warn' : 'good') : ''}</div>` : ''}
      <div class="grow-quiz-opts">
        ${opts.map((o) => `
          <button type="button" class="grow-quiz-opt ${saved === o.key ? 'is-selected' : ''}" data-val="${esc(o.key)}">
            <span class="grow-quiz-opt-letter">${o.key.toUpperCase()}</span>
            <span class="grow-quiz-opt-text">${esc(o.text)}</span>
          </button>
        `).join('')}
      </div>
    </div>
    <div class="grow-quiz-nav">
      ${i > 0 ? '<button type="button" class="grow-btn grow-btn--ghost" data-nav="-1">◀ Prev</button>' : '<span></span>'}
      ${i < total - 1
        ? '<button type="button" class="grow-btn" data-nav="1">Next ▶</button>'
        : '<button type="button" class="grow-btn" data-score>Score Quiz ✓</button>'}
    </div>`;

  view.innerHTML = html;
  view.querySelectorAll('.grow-quiz-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      _state.answers[i] = btn.dataset.val;
      view.querySelectorAll('.grow-quiz-opt').forEach((b) => b.classList.toggle('is-selected', b === btn));
    });
  });
  view.querySelectorAll('[data-nav]').forEach((b) => {
    b.addEventListener('click', () => {
      _state.idx = Math.max(0, Math.min(total - 1, i + Number(b.dataset.nav)));
      _paintQ(root);
    });
  });
  const scoreBtn = view.querySelector('[data-score]');
  if (scoreBtn) scoreBtn.addEventListener('click', () => _paintResults(root));
}

function _paintResults(root) {
  const view = root.querySelector('[data-bind="root"]');
  let correct = 0;
  const wrong = [];
  _state.picked.forEach((q, i) => {
    const ans   = String(_state.answers[i] || '').toLowerCase().trim();
    const right = String(q.correctAnswer || q['Correct Answer'] || '').toLowerCase().trim();
    if (ans && ans === right) correct++;
    else wrong.push({ q, ans, right });
  });
  const pct  = Math.round((correct / _state.picked.length) * 100);
  const tone = pct >= 80 ? '#059669' : pct >= 60 ? '#d97706' : '#dc2626';
  const msg  = pct >= 80 ? 'Well done!' : pct >= 60 ? 'Good effort!' : 'Keep studying!';
  const r = 52; const circ = 2 * Math.PI * r; const dash = circ - (pct / 100) * circ;

  let html = `
    <div class="grow-quiz-results">
      <div class="grow-quiz-score-ring">
        <svg viewBox="0 0 120 120" width="120" height="120">
          <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--border,rgba(0,0,0,.1))" stroke-width="8"/>
          <circle cx="60" cy="60" r="${r}" fill="none" stroke="${tone}" stroke-width="8"
            stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${dash.toFixed(1)}"
            stroke-linecap="round" transform="rotate(-90 60 60)"/>
        </svg>
        <div class="grow-quiz-score-inner">
          <div class="grow-quiz-score-pct" style="--score-tone:${tone};">${pct}%</div>
          <div class="grow-quiz-score-msg">${msg}</div>
        </div>
      </div>
      <p class="grow-quiz-score-detail">${correct} of ${_state.picked.length} correct</p>
      <div class="grow-quiz-results-btns">
        <button type="button" class="grow-btn" data-retry>Try another</button>
        <button type="button" class="grow-btn grow-btn--ghost" data-back>Back</button>
      </div>
    </div>`;

  if (wrong.length) {
    html += `<div class="grow-section-head grow-section-head--mt"><h2 class="grow-section-title">Review missed questions</h2></div>`;
    html += `<div class="grow-list">`;
    wrong.forEach(({ q, ans, right }) => {
      html += `<div class="grow-quiz-review-card">
        <p class="grow-quiz-review-q">${esc(q.question || q.Question || '')}</p>
        <div class="grow-quiz-review-answers">
          <span class="grow-quiz-review-wrong">Your answer: ${esc((ans || '—').toUpperCase())}</span>
          <span class="grow-quiz-review-right">Correct: ${esc(right.toUpperCase())}</span>
        </div>
        ${q.reference || q.Reference ? `<p class="grow-quiz-review-ref">${esc(q.reference || q.Reference)}</p>` : ''}
      </div>`;
    });
    html += `</div>`;
  }

  html += helpButton({ label: 'Ask a pastor for prayer + study help', dataAttr: 'help-quiz' });

  view.innerHTML = html;
  view.querySelector('[data-retry]').addEventListener('click', () => _startBible(root));
  view.querySelector('[data-back]').addEventListener('click',  () => { _state.mode = 'lobby'; _paintLobby(root); });
  wireHelp(view, () => {
    return `I just took the Bible Quiz and scored ${pct}% (${correct}/${_state.picked.length}).` +
      (wrong.length ? ` I'd value prayer and study guidance on these areas: ${wrong.slice(0, 5).map((w) => w.q.category || w.q.Category || w.q.question).filter(Boolean).join('; ')}` : '');
  }, { category: 'Discipleship: Bible Quiz', source: 'Bible Quiz', confidential: false });
}
