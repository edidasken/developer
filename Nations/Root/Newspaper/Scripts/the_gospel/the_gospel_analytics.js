/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · ANALYTICS — Discipleship at a glance.
   "Be diligent to know the state of your flocks." — Proverbs 27:23
   ══════════════════════════════════════════════════════════════════════════════ */

import { ur, rows, esc, emptyState, backendOffline, loadingCards, sectionHead } from './the_gospel_shared.js';

export const name        = 'the_gospel_analytics';
export const title       = 'Learning Analytics';
export const description = 'Discipleship at a glance — your reading streaks, course progress, quiz results, and certificates.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><rect x="5" y="11" width="3" height="8" rx="1"/><rect x="10.5" y="7" width="3" height="12" rx="1"/><rect x="16" y="14" width="3" height="5" rx="1"/></svg>`;
export const accent      = '#2563eb';

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="analytics">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-stats" data-bind="stats">${loadingCards(4)}</div>

      ${sectionHead('Activity')}
      <div class="grow-activity" data-bind="activity"></div>

      ${sectionHead('Recent quiz results')}
      <div class="grow-list" data-bind="quizzes"></div>

      ${sectionHead('Certificates')}
      <div class="grow-list" data-bind="certs"></div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  return () => {};
}

async function _load(root) {
  const U = ur();
  const stats = root.querySelector('[data-bind="stats"]');
  if (!U) { stats.innerHTML = backendOffline('Analytics not loaded.'); return; }

  let summary = null, quizRes = [], certs = [], progress = [];
  try {
    if (typeof U.lrnDashboard === 'function')      summary = await U.lrnDashboard().catch(() => null);
    if (!summary && typeof U.lrnProgressStats === 'function') summary = await U.lrnProgressStats().catch(() => null);
    if (typeof U.listLrnQuizResults === 'function') quizRes = rows(await U.listLrnQuizResults({ limit: 25 }).catch(() => null));
    if (typeof U.listLrnCertificates === 'function') certs   = rows(await U.listLrnCertificates({ limit: 25 }).catch(() => null));
    if (typeof U.listLrnProgress === 'function')    progress = rows(await U.listLrnProgress({ limit: 100 }).catch(() => null));
  } catch (e) {
    console.error('[gospel/analytics] load:', e);
    stats.innerHTML = emptyState({ icon: '⚠️', title: 'Could not load analytics', body: e.message || String(e) });
    return;
  }

  // Stat tiles
  const tiles = [
    { label: 'Lessons completed', value: (summary && (summary.lessonsCompleted ?? summary.completed)) ?? progress.filter((p) => p.status === 'complete').length },
    { label: 'Quizzes taken',     value: quizRes.length },
    { label: 'Certificates',      value: certs.length },
    { label: 'Avg quiz score',    value: _avgScore(quizRes) },
  ];
  stats.innerHTML = tiles.map((t) => `
    <div class="grow-stat-tile">
      <div class="grow-stat-num">${esc(String(t.value))}</div>
      <div class="grow-stat-label">${esc(t.label)}</div>
    </div>
  `).join('');

  // Activity heatmap (last 12 weeks)
  const act = root.querySelector('[data-bind="activity"]');
  act.innerHTML = _heatmap(progress.concat(quizRes));

  // Recent quizzes
  const qEl = root.querySelector('[data-bind="quizzes"]');
  qEl.innerHTML = quizRes.length ? quizRes.slice(0, 10).map((q) => `
    <div class="grow-row">
      <span>${esc(q.quizTitle || q.title || 'Quiz')}</span>
      <span class="grow-muted">${esc(String(q.score ?? q.percent ?? '—'))}%</span>
    </div>
  `).join('') : `<p class="grow-muted">No quiz attempts yet.</p>`;

  // Certificates
  const cEl = root.querySelector('[data-bind="certs"]');
  cEl.innerHTML = certs.length ? certs.slice(0, 10).map((c) => `
    <div class="grow-row">
      <span>${esc(c.courseName || c.playlistTitle || 'Course')}</span>
      <span class="grow-muted">${esc((c.issuedAt || '').toString().slice(0, 10))}</span>
    </div>
  `).join('') : `<p class="grow-muted">Complete a course to earn a certificate.</p>`;
}

function _avgScore(arr) {
  if (!arr.length) return '—';
  const nums = arr.map((q) => Number(q.score ?? q.percent ?? 0)).filter(Number.isFinite);
  if (!nums.length) return '—';
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function _heatmap(items) {
  // bucket events by yyyy-mm-dd
  const map = {};
  items.forEach((it) => {
    const t = it.completedAt || it.takenAt || it.createdAt || it.date;
    if (!t) return;
    const k = (typeof t === 'number' ? new Date(t) : new Date(t)).toISOString().slice(0, 10);
    map[k] = (map[k] || 0) + 1;
  });
  const cells = [];
  const today = new Date();
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    const n = map[k] || 0;
    const lvl = n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 3;
    cells.push(`<i class="grow-heat grow-heat--${lvl}" title="${k}: ${n} events"></i>`);
  }
  return `<div class="grow-heat-grid">${cells.join('')}</div>`;
}
