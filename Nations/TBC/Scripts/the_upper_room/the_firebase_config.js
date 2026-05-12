/* ══════════════════════════════════════════════════════════════════════════════
   THE FIREBASE CONFIG — Per-church Firebase web config resolution
   "Except the LORD build the house, they labour in vain that build it." — Ps 127:1

   Reads window.FLOCK_FIREBASE_CONFIG (injected per-church by the build), with
   a safe fallback to the shared flockos-notify project for churches that
   haven't been migrated to their own Firebase yet.

   Public API:
     getConfig()  — { apiKey, authDomain, projectId, ... }
     getVapidKey() — string (FCM web push key) or null
     getProjectId() — convenience
     hasOwnProject() — true if church has its own Firebase project
   ══════════════════════════════════════════════════════════════════════════════ */

const SHARED_FALLBACK_PROJECT = 'flockos-notify';

// Shared flockos-notify config used as fallback for churches that haven't
// migrated to their own Firebase project yet.
// Firebase API keys are public identifiers — security is enforced by rules.
const _SHARED_FALLBACK_CONFIG = {
  apiKey:            'AIzaSyBA-fkxjABbwIHn0i6MPiXbGwahfJmuJeo',
  authDomain:        'flockos-notify.firebaseapp.com',
  projectId:         'flockos-notify',
  storageBucket:     'flockos-notify.firebasestorage.app',
  messagingSenderId: '321766738616',
  appId:             '1:321766738616:web:d2c1c53ad7493fcde4c24d'
};

export function getConfig() {
  const inj = (typeof window !== 'undefined') ? window.FLOCK_FIREBASE_CONFIG : null;
  if (inj && inj.projectId) return inj;
  // Respect explicit opt-out (e.g. GAS-only churches that don't use Firestore).
  if (typeof window !== 'undefined' && window.FLOCK_NO_FIREBASE === true) return null;
  // Only Root (id: 'flockos') is permitted to fall back to the shared flockos-notify project.
  // Any other church without its own config gets null and a warning — never someone else's data.
  const churchId = (typeof window !== 'undefined') ? (window.FLOCK_CHURCH_ID || '') : '';
  if (churchId && churchId !== 'flockos') {
    console.warn('[FlockOS] Firebase config not set for church "' + churchId + '". A Firebase project must be configured before Firestore will work.');
    return null;
  }
  return _SHARED_FALLBACK_CONFIG;
}

export function getVapidKey() {
  if (typeof window === 'undefined') return null;
  return window.FLOCK_VAPID_KEY || null;
}

export function getProjectId() {
  const c = getConfig();
  return c && c.projectId ? c.projectId : SHARED_FALLBACK_PROJECT;
}

export function hasOwnProject() {
  return getProjectId() !== SHARED_FALLBACK_PROJECT;
}
