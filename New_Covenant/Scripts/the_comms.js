/* ══════════════════════════════════════════════════════════════════════════════
   THE COMMS — Unified comms façade across all three surfaces
   "How shall they hear without a preacher?" — Romans 10:14

   FlockOS speaks through THREE distinct comms surfaces, each owning a slice
   of the conversation. This module is the ONE place that knows about all
   three, so views never have to. It does not invent a new wire — it makes
   the existing wires reachable from one import.

     1. GAS / TheScrolls
        Pastoral interaction ledger (calls, sms, emails, visits, notes,
        prayers, pastoral actions) — backed by Google Apps Script via
        TheVine. Source of truth for "did we touch this person, when, why".
        → comms.scrolls.*

     2. Firebase Comms / TheUpperRoom
        Live channels, DMs, presence, push — runs on each church's own
        Firebase project. Source of truth for "what's being said now".
        → comms.upper.* (channels, messages, dms, presence, …)

     3. FlockChat (standalone)
        The proven, public chat app at flockchat.com / Covenant/Courts/
        TheFellowship/FlockChat/. Stays alive as a standalone PWA; we surface
        it inside FlockOS via an iframe whose ?church=<id> matches the active
        tenant — no second login (when SSO is wired) and no bookmark gymnastics.
        → comms.flockchat.url(), comms.flockchat.embed(host)

   Public API:
     scrolls    — namespace re-export of Scripts/the_scrolls/index.js
     upper      — namespace re-export of Scripts/the_upper_room/index.js
     flockchat  — { url(opts?), embed(host, opts?) }
     summary()  — Promise<{ unread, pendingCare, recentInteractions }>
   ══════════════════════════════════════════════════════════════════════════════ */

import * as scrolls from './the_scrolls/index.js';
import * as upper   from './the_upper_room/index.js';
import * as life    from './the_life/index.js';

/* ── 3) FlockChat embed surface ──────────────────────────────────────────── */
// Deployed FlockChat PWA (Firebase Hosting / flockos-comms project).
// flockchat.com is reserved for future custom-domain mapping; use the canonical
// hosting URL until that's wired so the iframe doesn't time out on DNS.
const FLOCKCHAT_BASE = 'https://flockos-comms.web.app/';

/**
 * @param {{ church?: string, conversationId?: string, channel?: string, dm?: string, source?: string, return?: string }} [opts]
 */
function _flockchatUrl(opts = {}) {
  const { church, conversationId, channel, dm, source, return: returnTo } = opts;
  const cid = church || (upper.tenant && upper.tenant.churchId && upper.tenant.churchId());
  const u = new URL(FLOCKCHAT_BASE);
  if (cid)            u.searchParams.set('church', cid);
  if (conversationId) u.searchParams.set('conversationId', conversationId);
  if (channel)        u.searchParams.set('channel', channel);
  if (dm)             u.searchParams.set('dm', dm);
  if (source)         u.searchParams.set('source', source);
  if (returnTo)       u.searchParams.set('return', returnTo);
  u.searchParams.set('embed', '1');
  return u.toString();
}

function _flockchatEmbed(host, opts = {}) {
  if (!host) return null;
  let frame = host.querySelector(':scope > iframe[data-flockchat]');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.setAttribute('data-flockchat', '');
    frame.setAttribute('title', 'FlockChat');
    frame.setAttribute('allow', 'autoplay; clipboard-read; clipboard-write; microphone; camera; notifications; web-share');
    frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    frame.style.cssText = `
      border: 0; width: 100%; height: 100%; min-height: 480px;
      background: var(--bg, #f7f8fb); border-radius: 12px;
    `;
    host.appendChild(frame);
  }
  frame.src = _flockchatUrl(opts);
  return frame;
}

export const flockchat = {
  url:   _flockchatUrl,
  embed: _flockchatEmbed,
};

/* ── Aggregate summary across all three surfaces ─────────────────────────── */
export async function summary() {
  const out = { unread: 0, pendingCare: 0, recentInteractions: [] };

  // Firebase Comms — unread badge total.
  try { out.unread = await upper.unreadTotal(); } catch (_) {}

  // GAS pastoral — pending care follow-ups.
  try { out.pendingCare = (await life.pendingCount()) || 0; } catch (_) {}

  // GAS interaction ledger — last 5 entries (any person).
  try {
    const tl = await scrolls.timeline(null, 5);
    out.recentInteractions = Array.isArray(tl) ? tl : [];
  } catch (_) {}

  return out;
}

export { scrolls, upper };
