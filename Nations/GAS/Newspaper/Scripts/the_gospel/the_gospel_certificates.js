/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · CERTIFICATES — Earned course completions, printable.
   "Well done, good and faithful servant." — Matthew 25:23
   ══════════════════════════════════════════════════════════════════════════════ */

import { ur, rows, esc, fmtDate, emptyState, backendOffline, loadingCards, chip } from './the_gospel_shared.js';

export const name        = 'the_gospel_certificates';
export const title       = 'Certificates';
export const description = 'A record of finished journeys — print or share what God has carried you through.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M9 14l-2 7 5-3 5 3-2-7"/></svg>`;
export const accent      = '#ca8a04';

let _state = { rows: [] };

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="certificates">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-grid grow-grid--certs" data-bind="grid">${loadingCards(3)}</div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  return () => {};
}

async function _load(root) {
  const grid = root.querySelector('[data-bind="grid"]');
  const U = ur();
  if (!U || typeof U.listLrnCertificates !== 'function') { grid.innerHTML = backendOffline('Certificates not loaded.'); return; }
  try {
    const res = await U.listLrnCertificates({ limit: 200 });
    _state.rows = rows(res);
    if (!_state.rows.length) { grid.innerHTML = emptyState({ icon: '🏆', title: 'No certificates yet', body: 'Complete a course to earn one.' }); return; }
    grid.innerHTML = _state.rows.map(_card).join('');
    grid.querySelectorAll('[data-cert]').forEach((el) => el.addEventListener('click', () => _print(_state.rows.find((r) => r.id === el.dataset.cert))));
  } catch (e) {
    console.error('[gospel/certificates] load:', e);
    grid.innerHTML = emptyState({ icon: '⚠️', title: 'Could not load certificates', body: e.message || String(e) });
  }
}

function _card(c) {
  return /* html */`
    <article class="grow-card grow-card--cert" data-cert="${esc(c.id || '')}">
      <div class="grow-cert-seal">${icon}</div>
      <h3 class="grow-card-title">${esc(c.courseName || c.playlistTitle || 'Course')}</h3>
      <p class="grow-card-desc">Earned ${esc(fmtDate(c.issuedAt || c.completedAt))}</p>
      <div class="grow-card-foot">
        ${chip('Certificate', 'level')}
        <button class="grow-btn grow-btn--ghost">View / Print</button>
      </div>
    </article>
  `;
}

function _print(c) {
  if (!c) return;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  const html = /* html */`
    <!doctype html><html><head><meta charset="utf-8"><title>Certificate</title>
    <style>
      body{font-family:'Georgia',serif;background:#fdf6e3;color:#2d2a26;margin:0;padding:48px;}
      .cert{max-width:880px;margin:0 auto;border:6px double ${accent};padding:48px;background:#fffef8;text-align:center;}
      h1{font-size:42px;letter-spacing:.3em;margin:0 0 8px;color:${accent};}
      h2{font-size:18px;letter-spacing:.4em;margin:0 0 32px;color:#7a6a4f;font-weight:400;}
      .who{font-size:36px;font-style:italic;margin:24px 0;}
      .for{font-size:16px;color:#5a5040;margin-bottom:24px;}
      .course{font-size:24px;font-weight:600;margin-bottom:48px;}
      .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid #d8c8a8;padding-top:16px;font-size:13px;color:#7a6a4f;}
      @media print { body{padding:0;} .cert{border-width:6px;} }
      @media screen and (max-width:720px) {
        body{padding:16px;}
        .cert{padding:24px 16px;border-width:3px;}
        h1{font-size:26px;letter-spacing:.12em;}
        h2{font-size:13px;letter-spacing:.2em;margin-bottom:20px;}
        .who{font-size:22px;margin:16px 0;}
        .course{font-size:16px;margin-bottom:28px;}
      }
    </style></head><body><div class="cert">
      <h1>Certificate</h1><h2>of Completion</h2>
      <p class="for">This certifies that</p>
      <p class="who">${esc(c.memberName || c.userName || 'Beloved Saint')}</p>
      <p class="for">has faithfully completed the course</p>
      <p class="course">${esc(c.courseName || c.playlistTitle || 'Course')}</p>
      <div class="meta">
        <span>Issued ${esc(fmtDate(c.issuedAt || c.completedAt))}</span>
        <span>${esc(c.churchName || '')}</span>
        <span>ID: ${esc((c.id || '').slice(0, 12))}</span>
      </div>
    </div><script>window.onload=()=>setTimeout(()=>window.print(),300);</script></body></html>`;
  w.document.write(html); w.document.close();
}
