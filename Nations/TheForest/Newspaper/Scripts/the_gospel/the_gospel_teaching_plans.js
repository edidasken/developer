/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · TEACHING PLANS — Pre-built lessons for discipleship moments.
   "And what you have heard from me in the presence of many witnesses entrust to
    faithful men, who will be able to teach others also." — 2 Timothy 2:2
   ══════════════════════════════════════════════════════════════════════════════ */

import { esc, snip, emptyState, loadingCards, sectionHead } from './the_gospel_shared.js';

export const name        = 'the_gospel_teaching_plans';
export const title       = 'Teaching Plans';
export const description = 'Ready-to-lead lessons for one-on-one discipleship — baptism prep, new-member orientation, and more.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 4v14"/><path d="M9 8h6M9 12h6"/></svg>`;
export const accent      = '#0e7490';

let _state = { plans: [], openPlanId: null, openSession: 0 };

/* ── Render shell ─────────────────────────────────────────────────────── */
export function render() {
  return /* html */`
    <section class="grow-page" data-grow="teaching-plans">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-split">
        <aside class="grow-split-aside">
          ${sectionHead('Plans')}
          <div class="grow-cat-list" data-bind="plans">${loadingCards(3)}</div>
        </aside>
        <article class="grow-split-main" data-bind="detail">
          <p class="grow-muted">Select a teaching plan to see its sessions, memory verses, and segment-by-segment outline.</p>
        </article>
      </div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  return () => {};
}

/* ── Load bundle (Truth liveBundle → static fallback) ─────────────────── */
async function _load(root) {
  const listEl = root.querySelector('[data-bind="plans"]');
  let bundle = null;

  // Prefer the live bundle (kept fresh by TheTruth)
  try {
    if (window.TheTruth && typeof window.TheTruth.liveBundle === 'function') {
      bundle = window.TheTruth.liveBundle('teachingPlans');
    }
  } catch (_) {}

  // Fallback to the static snapshot shipped in /Data/teaching_plans.js
  if (!bundle || !bundle.length) {
    try {
      const mod = await import('../../Data/teaching_plans.js');
      bundle = mod.default || [];
    } catch (e) {
      console.error('[gospel/teaching-plans] load static bundle failed:', e);
      listEl.innerHTML = emptyState({
        icon: '⚠️',
        title: 'Could not load teaching plans',
        body: e.message || String(e),
      });
      return;
    }
  }

  _state.plans = _groupByPlan(bundle);
  if (_state.plans.length && !_state.openPlanId) {
    _state.openPlanId = _state.plans[0].planId;
  }
  _paint(root);
}

/* ── Group flat session rows into plans → sessions[] ──────────────────── */
function _groupByPlan(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const id = r.planId || 'untitled';
    if (!map.has(id)) {
      map.set(id, {
        planId:          id,
        planTitle:       r.planTitle || id,
        planDescription: r.planDescription || '',
        planAudience:    r.planAudience || '',
        planGoal:        r.planGoal || '',
        sessions:        [],
      });
    }
    map.get(id).sessions.push(r);
  });
  // Sort sessions by sessionNumber within each plan
  const out = Array.from(map.values());
  out.forEach((p) => {
    p.sessions.sort((a, b) =>
      (parseInt(a.sessionNumber, 10) || 0) - (parseInt(b.sessionNumber, 10) || 0));
  });
  return out;
}

/* ── Sidebar list of plans ────────────────────────────────────────────── */
function _paint(root) {
  const listEl = root.querySelector('[data-bind="plans"]');
  if (!_state.plans.length) {
    listEl.innerHTML = emptyState({
      icon: '✎',
      title: 'No teaching plans yet',
      body: 'Run the import script to add your first plan.',
    });
    return;
  }
  listEl.innerHTML = _state.plans.map((p) => `
    <button class="grow-cat ${_state.openPlanId === p.planId ? 'is-active' : ''}"
            data-plan="${esc(p.planId)}">
      <span class="grow-cat-title">${esc(p.planTitle)}</span>
      <span class="grow-cat-count">${p.sessions.length}</span>
    </button>
  `).join('');
  listEl.querySelectorAll('[data-plan]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _state.openPlanId = btn.getAttribute('data-plan');
      _state.openSession = 0;
      _paint(root);
    });
  });
  _paintDetail(root);
}

/* ── Detail pane ──────────────────────────────────────────────────────── */
function _paintDetail(root) {
  const detEl = root.querySelector('[data-bind="detail"]');
  const plan  = _state.plans.find((p) => p.planId === _state.openPlanId);
  if (!plan) {
    detEl.innerHTML = `<p class="grow-muted">Plan not found.</p>`;
    return;
  }

  const session = plan.sessions[_state.openSession] || plan.sessions[0];
  const sessionTabs = plan.sessions.map((s, i) => `
    <button class="grow-session-tab ${i === _state.openSession ? 'is-active' : ''}"
            data-session-idx="${i}" type="button">
      Session ${esc(s.sessionNumber || (i + 1))}
    </button>
  `).join('');

  detEl.innerHTML = /* html */`
    <h2 class="grow-detail-title">${esc(plan.planTitle)}</h2>
    ${plan.planAudience ? `<p class="grow-detail-sub"><strong>Audience:</strong> ${esc(plan.planAudience)}</p>` : ''}
    ${plan.planGoal ? `<p class="grow-detail-sub">${esc(snip(plan.planGoal, 400))}</p>` : ''}

    <div class="grow-session-tabs" role="tablist">${sessionTabs}</div>

    ${session ? _renderSession(session) : `<p class="grow-muted">No sessions in this plan.</p>`}
  `;

  detEl.querySelectorAll('[data-session-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _state.openSession = parseInt(btn.getAttribute('data-session-idx'), 10) || 0;
      _paintDetail(root);
    });
  });
}

/* ── One session render ───────────────────────────────────────────────── */
function _renderSession(s) {
  const segments = Array.isArray(s.segments) ? s.segments : [];
  const meta = [
    s.durationMinutes ? `<span class="grow-pill">${esc(s.durationMinutes)} min</span>` : '',
    s.memoryVerseRef ? `<span class="grow-pill">📖 ${esc(s.memoryVerseRef)}</span>` : '',
  ].filter(Boolean).join('');

  return /* html */`
    <article class="grow-doctrine">
      <h3 class="grow-doctrine-title">Session ${esc(s.sessionNumber)} — ${esc(s.sessionTitle)}</h3>
      ${meta ? `<div class="grow-pills">${meta}</div>` : ''}
      ${s.memoryVerse ? `
        <blockquote class="grow-quote">
          “${esc(s.memoryVerse)}”
          ${s.memoryVerseRef ? `<cite> — ${esc(s.memoryVerseRef)}</cite>` : ''}
        </blockquote>` : ''}
      ${s.outcome ? `<p class="grow-doctrine-body"><strong>Outcome:</strong> ${esc(s.outcome)}</p>` : ''}

      ${segments.length ? `
        <div class="grow-segments">
          ${segments.map(_renderSegment).join('')}
        </div>` : `<p class="grow-muted">No segments defined for this session.</p>`}
    </article>
  `;
}

function _renderSegment(seg) {
  const minutes = seg.minutes ? `<span class="grow-pill">${esc(seg.minutes)} min</span>` : '';
  return /* html */`
    <details class="grow-segment">
      <summary>
        <span class="grow-segment-title">${esc(seg.title || 'Untitled segment')}</span>
        ${minutes}
      </summary>
      <div class="grow-segment-body">${_mdToHtml(seg.bodyMarkdown || '')}</div>
    </details>
  `;
}

/* ── Tiny Markdown → HTML (headings, bold, italics, lists, tables) ────── */
function _mdToHtml(md) {
  if (!md) return '';
  let html = esc(md);

  // Tables (simple GitHub-flavored — treat any block of `| … |` lines)
  html = html.replace(/((?:^\|.*\|\s*\n?)+)/gm, (block) => {
    const lines = block.trim().split('\n');
    if (lines.length < 2) return block;
    const sep = lines[1].replace(/\s/g, '');
    if (!/^\|[-:|]+\|$/.test(sep)) return block;
    const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const head = cells(lines[0]).map((c) => `<th>${c}</th>`).join('');
    const body = lines.slice(2).map((row) =>
      `<tr>${cells(row).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
    return `<div class="grow-table-wrap"><table class="grow-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  });

  // Headings
  html = html.replace(/^####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^###\s+(.+)$/gm,  '<h4>$1</h4>');
  html = html.replace(/^##\s+(.+)$/gm,   '<h3>$1</h3>');
  // Blockquotes
  html = html.replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>');
  // Bold + italics
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // Lists (- or *)
  html = html.replace(/(^|\n)(?:[-*]\s+.+(?:\n|$))+?/g, (block) => {
    const items = block.trim().split('\n').map((l) =>
      `<li>${l.replace(/^[-*]\s+/, '')}</li>`).join('');
    return `\n<ul>${items}</ul>`;
  });
  // Paragraphs (split on blank lines)
  html = html.split(/\n{2,}/).map((p) =>
    /^<(h\d|ul|ol|table|blockquote)/.test(p.trim()) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`
  ).join('\n');

  return html;
}
