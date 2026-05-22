/* ══════════════════════════════════════════════════════════════════════════════
   THE CHRONICLE — History stack wrapper
   "These are the chronicles of the kings of Israel." — 1 Kings 14:19
   ══════════════════════════════════════════════════════════════════════════════ */

export function push(url, state) {
  try { history.pushState(state, '', url); }
  catch (_) { /* security errors in some embedded contexts — silent */ }
}

export function replace(url, state) {
  try { history.replaceState(state, '', url); }
  catch (_) { /* silent */ }
}

export function current() {
  return history.state || null;
}
