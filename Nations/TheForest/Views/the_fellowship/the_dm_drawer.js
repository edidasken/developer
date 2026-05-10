/* ══════════════════════════════════════════════════════════════════════════════
   THE DM DRAWER — Direct message threads
   "A friend loveth at all times." — Proverbs 17:17
   ══════════════════════════════════════════════════════════════════════════════ */

import { dms } from '../../Scripts/the_upper_room/index.js';
import { renderThread } from './the_thread.js';

// Mobile breakpoint — below this, we show list OR thread, not both.
const _MOBILE_BP = 600;

export function renderDmsPane(host /*, ctx */) {
  if (!host) return () => {};
  host.innerHTML = `
    <div class="dm-pane">
      <header class="dm-pane-hd">
        <button type="button" class="flock-icon-btn dm-back-btn" data-act="back" aria-label="Back to conversations" style="display:none;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <strong class="dm-pane-title">Direct Messages</strong>
        <button type="button" class="flock-btn flock-btn--primary flock-btn--sm" data-act="new-dm">+ New DM</button>
      </header>
      <div class="dm-body">
        <aside class="dm-list-col" data-bind="list">
          <flock-skeleton rows="5"></flock-skeleton>
        </aside>
        <div class="dm-thread-col" data-bind="thread">
          <div class="dm-thread-empty">Pick a conversation, or start one with "+ New DM" above.</div>
        </div>
      </div>
    </div>
  `;

  const listCol   = host.querySelector('[data-bind="list"]');
  const threadCol = host.querySelector('[data-bind="thread"]');
  const backBtn   = host.querySelector('[data-act="back"]');
  const titleEl   = host.querySelector('.dm-pane-title');

  let unwatch = () => {};
  let stop    = null;
  const _isMobile = () => window.innerWidth < _MOBILE_BP;

  // Show a thread — on mobile hides the list and shows a back button
  function _openThread(tid, label) {
    if (stop) try { stop(); } catch (_) {}
    stop = renderThread(threadCol, { channelId: tid });
    if (_isMobile()) {
      listCol.classList.add('dm-col--hidden');
      threadCol.classList.remove('dm-col--hidden');
      if (backBtn) backBtn.style.display = '';
      if (titleEl) titleEl.textContent = label || 'Conversation';
    }
  }

  // Back to list on mobile
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (stop) try { stop(); } catch (_) {}
      stop = null;
      threadCol.innerHTML = `<div class="dm-thread-empty">Pick a conversation, or start one with "+ New DM" above.</div>`;
      listCol.classList.remove('dm-col--hidden');
      threadCol.classList.add('dm-col--hidden');
      backBtn.style.display = 'none';
      if (titleEl) titleEl.textContent = 'Direct Messages';
    });
  }

  // Responsive layout — mobile: only show list initially; desktop: show both
  function _applyLayout() {
    if (_isMobile()) {
      const threadVisible = !threadCol.classList.contains('dm-col--hidden');
      if (!threadVisible) {
        listCol.classList.remove('dm-col--hidden');
        threadCol.classList.add('dm-col--hidden');
      }
    } else {
      listCol.classList.remove('dm-col--hidden');
      threadCol.classList.remove('dm-col--hidden');
      if (backBtn) backBtn.style.display = 'none';
      if (titleEl) titleEl.textContent = 'Direct Messages';
    }
  }
  _applyLayout();

  const _onResize = () => _applyLayout();
  window.addEventListener('resize', _onResize);

  dms.watch((rows = []) => {
    listCol.innerHTML = rows.length ? rows.map(_row).join('') :
      `<div class="dm-list-empty">No DMs yet.</div>`;
    listCol.querySelectorAll('[data-tid]').forEach((el) => {
      el.addEventListener('click', () => _openThread(el.dataset.tid, el.dataset.label));
    });
  }).then((u) => { unwatch = u; }).catch(() => {
    listCol.innerHTML = `<div class="dm-list-empty">DM backend unavailable.</div>`;
  });

  host.querySelector('[data-act="new-dm"]').addEventListener('click', async () => {
    const who = prompt('Member email or user ID to DM:');
    if (!who) return;
    try {
      const tid = await dms.openWith(who.trim());
      if (tid) _openThread(tid, who.trim());
    } catch (err) {
      console.error('[Fellowship] open DM:', err);
      alert(err?.message || 'Could not start a DM with that user.');
    }
  });

  return () => {
    window.removeEventListener('resize', _onResize);
    try { unwatch(); } catch (_) {}
    if (stop) try { stop(); } catch (_) {}
  };
}

// Called externally (e.g. from the Fold DM button) to open a DM with a user.
// Pass the host element of the DM pane so the thread can be rendered into it.
export async function openDmWith(who, host) {
  if (!who) return;
  try {
    const tid = await dms.openWith(String(who).trim());
    if (!tid || !host) return;
    // If the row already exists in the list, just click it
    const existing = host.querySelector('[data-tid="' + tid + '"]');
    if (existing) { existing.click(); return; }
    // Otherwise render directly into the thread column
    const threadCol = host.querySelector('[data-bind="thread"]');
    const listCol   = host.querySelector('[data-bind="list"]');
    const backBtn   = host.querySelector('[data-act="back"]');
    const titleEl   = host.querySelector('.dm-pane-title');
    if (threadCol) {
      import('./the_thread.js').then(({ renderThread }) => {
        renderThread(threadCol, { channelId: tid });
        if (window.innerWidth < _MOBILE_BP) {
          if (listCol)  listCol.classList.add('dm-col--hidden');
          threadCol.classList.remove('dm-col--hidden');
          if (backBtn)  backBtn.style.display = '';
          if (titleEl)  titleEl.textContent   = who;
        }
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[Fellowship] openDmWith:', err);
    alert(err?.message || 'Could not start a DM with that user.');
  }
}

function _row(t) {
  const who = t.title || (t.participants || []).join(' & ');
  return `
    <button type="button" class="dm-row" data-tid="${_e(t.id)}" data-label="${_e(who)}">
      <span class="dm-row-at">@</span>
      <span class="dm-row-name">${_e(who)}</span>
    </button>`;
}

function _e(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
