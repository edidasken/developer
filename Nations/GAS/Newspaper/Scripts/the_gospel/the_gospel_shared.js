/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL — Shared helpers for every learning-hub module
   "Grow in the grace and knowledge of our Lord and Savior Jesus Christ." — 2 Peter 3:18

   Tiny utilities used by every module under Scripts/the_gospel/*. Nothing
   here touches the DOM directly — these are pure helpers + a single
   backend resolver that returns the active UpperRoom (Firestore) instance
   when authenticated, and the GAS-bridge fallback otherwise.
   ══════════════════════════════════════════════════════════════════════════════ */

/** Return the live Firestore-backed UpperRoom if it's ready; else null. */
export function ur() {
  const u = window.UpperRoom;
  if (u && typeof u.isReady === 'function' && u.isReady()) return u;
  return null;
}

/** Return the legacy TheVine backend (GAS RPC bridge) if present. */
export function vine() {
  return window.TheVine || null;
}

/** Current authenticated session ({email, displayName, …}) or empty {}. */
export function session() {
  try { return (window.TheVine && window.TheVine.session && window.TheVine.session()) || {}; }
  catch (_) { return {}; }
}

/** Normalise a backend response into a plain array of rows. */
export function rows(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.rows)) return res.rows;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.results)) return res.results;
  if (Array.isArray(res.items)) return res.items;
  return [];
}

/** HTML-escape any value safely. */
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Render a tiny markdown subset (**bold**, *italic*, paragraph breaks) safely.
 *  HTML-escapes first, then replaces markdown markers — never injects raw HTML. */
export function mdInline(s) {
  let out = esc(s);
  // Bold: **text**  (run before italic so * doesn't gobble it)
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  out = out.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  // Paragraph breaks on blank lines, single \n → <br>
  out = out.split(/\n{2,}/).map((p) => p.replace(/\n/g, '<br>')).join('</p><p>');
  return '<p>' + out + '</p>';
}

/** Strip markdown markers (for previews / card snippets where we don't want HTML). */
export function stripMd(s) {
  return String(s == null ? '' : s)
    .replace(/\*\*([^*\n]+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1$2');
}

/** Strip basic HTML for previews. */
export function stripHtml(s) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Truncate a string for card previews, ellipsising on word boundary. */
export function snip(s, n = 140) {
  const t = String(s == null ? '' : s).trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}

/** Format a date / Firestore Timestamp / millis / ISO string for the UI. */
export function fmtDate(ts, opts) {
  if (!ts) return '';
  const o = opts || { month: 'short', day: 'numeric', year: 'numeric' };
  try {
    const d = new Date(typeof ts === 'object' && ts.seconds ? ts.seconds * 1000 : ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, o);
  } catch (_) { return ''; }
}

/** Time-ago (rough) — for activity strips. */
export function timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'object' && ts.seconds ? ts.seconds * 1000 : ts);
  if (isNaN(d.getTime())) return '';
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
  const dy = Math.floor(h / 24); if (dy < 7) return dy + 'd ago';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Empty state — a polished placeholder used by every grow-module. */
export function emptyState({ icon, title, body, action } = {}) {
  return /* html */`
    <div class="grow-empty">
      ${icon ? `<div class="grow-empty-icon" aria-hidden="true">${icon}</div>` : ''}
      <div class="grow-empty-title">${esc(title || 'Nothing here yet')}</div>
      ${body ? `<div class="grow-empty-body">${esc(body)}</div>` : ''}
      ${action || ''}
    </div>
  `;
}

/** "Backend not loaded" message reused everywhere. */
export function backendOffline(label = 'Content backend not loaded.') {
  return emptyState({
    icon: '⛓️',
    title: label,
    body: 'Sign in to load live content from the church library.',
  });
}

/** Loading shimmer — a row-count of pulsing cards. */
export function loadingCards(n = 3) {
  return /* html */`
    <div class="grow-skel-grid">
      ${Array.from({ length: n }).map(() => `<div class="grow-skel-card"></div>`).join('')}
    </div>
  `;
}

/** Bible-link if the_bible_link helper is present; otherwise plain text. */
export function bibleLink(ref) {
  // the_scrolls/the_bible_link installs an idempotent observer that auto-links
  // any plain "John 3:16" text. So we just return the escaped string.
  return esc(ref);
}

/** Chip / pill tag (consistent across all modules). */
export function chip(text, variant = 'neutral') {
  return /* html */`<span class="grow-chip grow-chip--${variant}">${esc(text)}</span>`;
}

/** Section header used inside every grow-module. */
export function sectionHead(title, action) {
  return /* html */`
    <div class="grow-section-head">
      <h2 class="grow-section-title">${esc(title)}</h2>
      ${action || ''}
    </div>
  `;
}

/* ── ASK FOR HELP → PRAYER REQUEST ─────────────────────────────────────────
   Generates a prayer request from a learning-hub module summary. Wired into
   counseling, heart, mirror, and quiz-results "Ask for help" buttons.   */
export async function askForHelp({ summary, category = 'Discipleship', source = 'Grow', confidential = true } = {}) {
  const U = ur();
  const sess = session();
  const prayerText = String(summary || '').trim();
  if (!prayerText) {
    return { ok: false, error: 'Nothing to send.' };
  }
  if (!U || typeof U.createPrayer !== 'function') {
    // Fallback: copy to clipboard so the user still has something useful.
    try { await navigator.clipboard.writeText(prayerText); }
    catch (_) {}
    return { ok: false, offline: true, error: 'Sign in to send a prayer request. Summary copied to clipboard.' };
  }
  try {
    const id = await U.createPrayer({
      submitterName:     sess.displayName || sess.name || sess.email || 'Anonymous',
      submitterEmail:    sess.email || '',
      prayerText:        `[${source}] ${prayerText}`,
      category,
      isConfidential:    confidential ? 'TRUE' : 'FALSE',
      followUpRequested: 'TRUE',
    });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/** Render a small "Send to Prayer Chain" button + status row. */
export function helpButton({ label = 'Ask for help', dataAttr = 'help' } = {}) {
  return /* html */`
    <div class="grow-help-row" data-bind="${esc(dataAttr)}">
      <button type="button" class="grow-btn grow-btn--ghost" data-help-btn>
        🙏 ${esc(label)}
      </button>
      <span class="grow-help-status grow-muted" data-help-status></span>
    </div>
  `;
}

/** Wire the helpButton inside `root` to call askForHelp() with `summaryFn()`. */
export function wireHelp(root, summaryFn, opts = {}) {
  const btn  = root.querySelector('[data-help-btn]');
  const stat = root.querySelector('[data-help-status]');
  if (!btn || !stat) return;
  /* Store summaryFn so the public prayer hook in grow_public.js can read it */
  btn._prayerSummaryFn = summaryFn;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    stat.textContent = 'Sending…';
    let summary = '';
    try { summary = await summaryFn(); } catch (_) {}
    const r = await askForHelp({ summary, ...opts });
    btn.disabled = false;
    if (r.ok) {
      stat.textContent = '✓ Prayer request sent. A pastor will reach out.';
      stat.classList.add('grow-help-status--ok');
    } else {
      stat.textContent = r.error || 'Could not send.';
      stat.classList.add('grow-help-status--err');
    }
  });
}
