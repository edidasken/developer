/* ══════════════════════════════════════════════════════════════════════════════
   THE ANOINTING — Token / claims surfacing
   "You have an anointing from the Holy One, and you all know the truth." — 1 Jn 2:20
   ══════════════════════════════════════════════════════════════════════════════ */

const SESSION_KEY = 'flock_auth_session';

export function readToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && obj.token ? obj.token : null;
  } catch (_) {
    return null;
  }
}
