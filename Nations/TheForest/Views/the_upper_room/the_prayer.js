/* ══════════════════════════════════════════════════════════════════════════════
   THE UPPER ROOM — Prayer tab
   Shows the Prayer Chain CTA and the logged-in user's own submissions:
   prayer requests (churches/{id}/prayers) and contact/outreach forms
   (churches/{id}/outreachContacts filtered by email).
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function _fmt(ts) {
  if (!ts) return '';
  let d;
  if (ts && typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts && ts.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CHIP = {
  // Prayer
  'New':       { bg: 'rgba(91,141,238,0.14)', fg: '#5b8dee' },
  'Praying':   { bg: 'rgba(124,58,237,0.14)', fg: '#7c3aed' },
  'Answered':  { bg: 'rgba(16,185,129,0.14)', fg: '#10b981' },
  'Closed':    { bg: 'rgba(100,116,139,0.12)', fg: '#64748b' },
  'Archived':  { bg: 'rgba(100,116,139,0.12)', fg: '#64748b' },
  // Outreach
  'In Progress': { bg: 'rgba(234,179,8,0.14)', fg: '#b45309' },
  'Converted':   { bg: 'rgba(16,185,129,0.14)', fg: '#10b981' },
};
function _chip(status) {
  const s = STATUS_CHIP[status] || STATUS_CHIP['New'];
  return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font:600 0.72rem var(--font-ui,sans-serif);background:${s.bg};color:${s.fg}">${status || 'New'}</span>`;
}

function _card({ label, date, status, body, icon }) {
  return /* html */`
    <div style="border:1px solid var(--line,rgba(0,0,0,.08));border-radius:14px;padding:14px 16px;background:var(--bg-card,#fff);display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font:600 0.82rem var(--font-ui,sans-serif);color:var(--ink-muted,#6b7280);flex:none;">${icon} ${label}</span>
        ${_chip(status)}
        ${date ? `<span style="font:0.75rem var(--font-ui,sans-serif);color:var(--ink-faint,#94a3b8);margin-left:auto;">${date}</span>` : ''}
      </div>
      ${body ? `<p style="margin:0;font:0.88rem var(--font-ui,sans-serif);color:var(--ink,#1b264f);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${body}</p>` : ''}
    </div>
  `;
}

function _section(title, cardsHtml) {
  return /* html */`
    <div style="margin-top:24px;">
      <h4 style="font:700 0.78rem var(--font-ui,sans-serif);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint,#94a3b8);margin:0 0 10px;">${title}</h4>
      <div style="display:flex;flex-direction:column;gap:8px;">${cardsHtml}</div>
    </div>
  `;
}

function _empty(text) {
  return `<p style="font:0.88rem var(--font-ui,sans-serif);color:var(--ink-faint,#94a3b8);margin:0;padding:12px 0 4px;">${text}</p>`;
}

/* ── Main mount ──────────────────────────────────────────────────────────── */
export function mountPrayer(panel, ctx) {
  const UR = window.UpperRoom;

  // Derive FlockChat URL from current page location so it works on any host
  // (GitHub Pages, Firebase Hosting, local dev server, etc.)
  // Page lives at: …/app.flockos/app.flockos.html
  // FlockChat lives at: …/app.flockchat/app.flockchat.html
  const _chatUrl = (() => {
    const base = window.location.href.replace(/\/app\.flockos\/[^?#]*.*$/, '');
    return base + '/app.flockchat/app.flockchat.html';
  })();

  // Always show Prayer Chain CTA with embedded FlockChat
  panel.innerHTML = /* html */`
    <div class="ur-prayer-cta">
      <h3>Pray with the flock</h3>
      <p>Standing requests, the prayer chain, and live updates from your church family.</p>
      <iframe
        src="${_chatUrl}"
        title="FlockChat"
        allow="clipboard-read; clipboard-write; microphone; camera; autoplay"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerpolicy="strict-origin-when-cross-origin"
        loading="eager"
        style="display:block;width:100%;height:520px;border:0;border-radius:14px;margin-top:16px;overflow:hidden;">
      </iframe>
    </div>
  `;
}
