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

  // Always show Prayer Chain CTA
  panel.innerHTML = /* html */`
    <div class="ur-prayer-cta">
      <h3>Pray with the flock</h3>
      <p>Standing requests, the prayer chain, and live updates from your church family.</p>
      <button type="button" class="flock-btn flock-btn--primary" data-ur-jump="the_prayer_chain">
        Open the Prayer Chain
      </button>
    </div>
    <div id="ur-my-submissions" style="padding:0 0 32px;">
      <div style="text-align:center;padding:32px 0;color:var(--ink-faint,#94a3b8);font:0.88rem var(--font-ui,sans-serif);">
        <div style="width:28px;height:28px;border:2.5px solid var(--line,#e5e7ef);border-top-color:var(--gold,#e8a838);border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 10px;"></div>
        Loading your submissions…
      </div>
    </div>
  `;

  // Wire prayer chain button
  panel.querySelector('[data-ur-jump]')?.addEventListener('click', () => {
    ctx?.go?.('the_prayer_chain');
  });

  const sub = panel.querySelector('#ur-my-submissions');

  if (!UR || !UR.isReady()) {
    sub.innerHTML = `<p style="font:0.85rem var(--font-ui,sans-serif);color:var(--ink-faint,#94a3b8);padding:8px 0;">Sign in to see your submitted requests.</p>`;
    return;
  }

  const email = UR.userEmail();
  if (!email) {
    sub.innerHTML = `<p style="font:0.85rem var(--font-ui,sans-serif);color:var(--ink-faint,#94a3b8);padding:8px 0;">Sign in to see your submitted requests.</p>`;
    return;
  }

  // Fetch both in parallel
  Promise.all([
    UR.listPrayers({ limit: 20 }).catch(() => []),
    UR.listOutreachContacts({ byEmail: email, limit: 20 }).catch(() => []),
  ]).then(([prayers, contacts]) => {
    // Sort contacts by createdAt descending (done client-side because we skip orderBy)
    contacts.sort((a, b) => {
      const ta = a.createdAt?.seconds ?? 0;
      const tb = b.createdAt?.seconds ?? 0;
      return tb - ta;
    });

    let html = '';

    // Prayer requests
    if (prayers.length) {
      const cards = prayers.map(p => _card({
        icon: '🙏',
        label: p.category || 'Prayer Request',
        date: _fmt(p.submittedAt),
        status: p.status || 'New',
        body: p.prayerText,
      })).join('');
      html += _section('My Prayer Requests', cards);
    } else {
      html += _section('My Prayer Requests', _empty('No prayer requests submitted yet.'));
    }

    // Contact / outreach forms
    if (contacts.length) {
      const cards = contacts.map(c => _card({
        icon: '✉️',
        label: c.requestType || 'Contact Form',
        date: _fmt(c.createdAt),
        status: c.status || 'New',
        body: c.message,
      })).join('');
      html += _section('My Contact Forms', cards);
    } else {
      html += _section('My Contact Forms', _empty('No contact forms submitted yet.'));
    }

    sub.innerHTML = html;
  }).catch(() => {
    sub.innerHTML = `<p style="font:0.85rem var(--font-ui,sans-serif);color:var(--ink-faint,#94a3b8);padding:8px 0;">Could not load submissions. Please try again later.</p>`;
  });
}
