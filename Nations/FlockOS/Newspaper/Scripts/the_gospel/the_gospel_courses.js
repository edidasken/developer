/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · COURSES — Discipleship playlists & guided study tracks.
   "Make disciples of all nations… teaching them to obey." — Matthew 28:19-20
   ══════════════════════════════════════════════════════════════════════════════ */

import { ur, vine, rows, esc, snip, fmtDate, emptyState, backendOffline, loadingCards, sectionHead, chip } from './the_gospel_shared.js';

export const name        = 'the_gospel_courses';
export const title       = 'Courses';
export const description = 'Guided discipleship tracks — sermon series, theology playlists, and member-led learning paths.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 4v12a4 4 0 0 0 4 4"/><path d="M9 9h6M9 13h6"/></svg>`;
export const accent      = '#7c3aed';

let _state = { rows: [], filter: 'all', q: '' };

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="courses">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-toolbar">
        <input class="grow-search" data-q placeholder="Search courses, topics, curators…" type="search">
        <div class="grow-filters">
          <button class="grow-filter is-active" data-f="all">All</button>
          <button class="grow-filter" data-f="active">Active</button>
          <button class="grow-filter" data-f="draft">Draft</button>
          <button class="grow-filter" data-f="mine">Subscribed</button>
        </div>
      </div>

      <div class="grow-grid grow-grid--courses" data-bind="grid">${loadingCards(6)}</div>
    </section>
  `;
}

export function mount(root) {
  const grid  = root.querySelector('[data-bind="grid"]');
  const qEl   = root.querySelector('[data-q]');
  const fBtns = root.querySelectorAll('[data-f]');

  qEl.addEventListener('input', () => { _state.q = qEl.value.trim().toLowerCase(); _paint(grid); });
  fBtns.forEach(b => b.addEventListener('click', () => {
    fBtns.forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    _state.filter = b.dataset.f;
    _paint(grid);
  }));

  _load(grid);
  return () => {};
}

async function _load(grid) {
  const U = ur(); const V = vine();
  if (!U && !V) {
    grid.innerHTML = `
      <div class="grow-courses-gate">
        <div class="grow-courses-gate-icon" style="--grow-accent:${accent}">${icon}</div>
        <h3 class="grow-courses-gate-title">Member Content</h3>
        <p class="grow-courses-gate-desc">Guided discipleship tracks, theology playlists, and curated study paths live here. Sign in to access the full course library.</p>
        <div class="grow-courses-gate-features">
          <div class="grow-courses-gate-feat">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>
            <span>Sermon series tracks</span>
          </div>
          <div class="grow-courses-gate-feat">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>
            <span>Theology playlists</span>
          </div>
          <div class="grow-courses-gate-feat">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>
            <span>Member-curated learning paths</span>
          </div>
        </div>
      </div>
    `;
    return;
  }
  try {
    const res = U
      ? await U.listLrnPlaylists({ limit: 200 })
      : await V.flock.call('learning.playlists.list', { limit: 200 }, { skipAuth: true });
    _state.rows = rows(res);
    _paint(grid);
  } catch (e) {
    console.error('[gospel/courses] load:', e);
    grid.innerHTML = emptyState({ icon: '⚠️', title: 'Could not load courses', body: e.message || String(e) });
  }
}

function _paint(grid) {
  const list = _state.rows.filter((c) => {
    if (_state.filter === 'active' && (c.status || '').toLowerCase() !== 'active') return false;
    if (_state.filter === 'draft'  && (c.status || '').toLowerCase() !== 'draft')  return false;
    if (_state.filter === 'mine'   && !c.subscribed) return false;
    if (_state.q) {
      const hay = (c.title + ' ' + (c.description || '') + ' ' + (c.curatorName || '') + ' ' + ((c.topicNames || []).join(' '))).toLowerCase();
      if (!hay.includes(_state.q)) return false;
    }
    return true;
  });

  if (!list.length) {
    grid.innerHTML = emptyState({ icon: '📚', title: 'No courses match those filters', body: 'Try clearing the search or asking your shepherd to publish a track.' });
    return;
  }
  grid.innerHTML = list.map(_card).join('');
}

function _card(c) {
  const cover  = c.coverImageUrl ? `<img class="grow-card-cover" src="${esc(c.coverImageUrl)}" alt="" loading="lazy">` : '';
  const topics = (c.topicNames || []).slice(0, 3).map((t) => chip(t, 'topic')).join('');
  const diff   = c.difficultyLevel ? chip(c.difficultyLevel, 'level') : '';
  const status = c.status === 'active' ? chip('Active', 'good') : (c.status ? chip(c.status, 'neutral') : '');
  return /* html */`
    <article class="grow-card grow-card--course" data-id="${esc(c.id || '')}" tabindex="0">
      ${cover || `<div class="grow-card-cover grow-card-cover--placeholder" style="--grow-accent:${accent}"></div>`}
      <div class="grow-card-body">
        <div class="grow-card-tags">${diff}${status}</div>
        <h3 class="grow-card-title">${esc(c.title || 'Untitled course')}</h3>
        ${c.description ? `<p class="grow-card-desc">${esc(snip(c.description, 140))}</p>` : ''}
        <div class="grow-card-foot">
          ${c.curatorName ? `<span class="grow-card-by">by ${esc(c.curatorName)}</span>` : ''}
          ${c.lessonCount ? `<span class="grow-card-meta">${c.lessonCount} lessons</span>` : ''}
        </div>
        ${topics ? `<div class="grow-card-topics">${topics}</div>` : ''}
      </div>
    </article>
  `;
}
