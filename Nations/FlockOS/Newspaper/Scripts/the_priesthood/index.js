/* ══════════════════════════════════════════════════════════════════════════════
   THE PRIESTHOOD — Auth UI shell (public API)
   "But ye are a chosen generation, a royal priesthood." — 1 Peter 2:9

   Thin wrapper over Nehemiah (firm_foundation.js). Phase I responsibilities:
     • whoAmI()  — resolve the current user (no UI block)
     • enter()   — open sign-in sheet (delegates to Nehemiah)
     • depart()  — sign out
     • openAccountSheet() — small account drawer triggered from the_crown
   ══════════════════════════════════════════════════════════════════════════════ */

import { renderGarments } from './the_garments.js';
import { readToken }      from './the_anointing.js';
import { renderBadge }    from './the_breastplate.js';

let _profile = null;

export async function whoAmI() {
  // Nehemiah lives on window when loaded by the legacy bundle.
  const N = window.Nehemiah;
  if (!N) { _profile = null; return null; }
  try {
    // Prefer stored profile; fall back to session email so auth gate can pass.
    if (typeof N.getProfile === 'function') _profile = N.getProfile() || null;
    if (!_profile && typeof N.isAuthenticated === 'function' && N.isAuthenticated()) {
      const sess = typeof N.getSession === 'function' ? N.getSession() : null;
      _profile = sess ? { email: sess.email, role: sess.role, displayName: sess.displayName || sess.email } : { authenticated: true };
    }
  } catch (_) {
    _profile = null;
  }
  return _profile;
}

export function profile() { return _profile; }

export async function enter() {
  return renderGarments({ mode: 'login' });
}

export async function depart() {
  const N = window.Nehemiah;
  if (N && typeof N.logout === 'function') {
    try { await N.logout(); } catch (_) { /* graceful */ }
  }
  _profile = null;
  location.search = '?covenant=new';
}

export async function openAccountSheet() {
  if (!_profile) await whoAmI();
  if (!_profile) return enter();
  return renderBadge(_profile, { onSignOut: depart });
}

export { readToken };
