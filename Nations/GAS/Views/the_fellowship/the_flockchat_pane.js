/* ══════════════════════════════════════════════════════════════════════════════
   THE FLOCKCHAT PANE — Embedded standalone FlockChat
   "Let no corrupt communication proceed out of your mouth." — Ephesians 4:29

   The standalone PWA is the source of truth for the public chat surface
   (legacy + offline + all the polish that already lives in the_word.js).
   We embed it here so the user never leaves FlockOS to use it.
   ══════════════════════════════════════════════════════════════════════════════ */

import { flockchat } from '../../Scripts/the_comms.js';

export function renderFlockchatPane(host, ctx = {}) {
  if (!host) return () => {};
  host.innerHTML = `
    <div class="fc-pane" style="display:flex; flex-direction:column; gap:8px; height:70vh;">
      <div style="display:flex; align-items:center; gap:8px; color:var(--ink-muted,#7a7f96); font-size:0.85rem;">
        <span style="flex:1;">FlockChat — embedded for this church.</span>
        <a data-bind="open" target="_blank" rel="noopener"
           style="color:var(--accent,#e8a838); text-decoration:none;">Open in new tab ↗</a>
      </div>
      <div data-bind="frame" style="flex:1; min-height:0;"></div>
    </div>
  `;

  const frameHost = host.querySelector('[data-bind="frame"]');
  const openLink  = host.querySelector('[data-bind="open"]');
  const handoff   = buildHandoff(ctx);
  const url       = flockchat.url(handoff);

  openLink.href = url;
  flockchat.embed(frameHost, handoff);

  return () => { /* iframe disposed with host */ };
}

function buildHandoff(ctx = {}) {
  const query = ctx?.handoff || ctx?.launchIntent || ctx || {};
  const handoff = {};

  if (query.church) handoff.church = query.church;
  if (query.conversationId) handoff.conversationId = query.conversationId;
  if (query.channel) handoff.channel = query.channel;
  if (query.dm) handoff.dm = query.dm;
  if (query.source) handoff.source = query.source;
  if (query.return) handoff.return = query.return;
  if (query.returnTo) handoff.return = query.returnTo;

  if (!handoff.source) handoff.source = 'the_fellowship';
  if (!handoff.return) handoff.return = window.location.href;

  return handoff;
}
