/* ══════════════════════════════════════════════════════════════════════════════
   THE CISTERN — IndexedDB persistence helper
   "They have forsaken me, the spring of living water,
    and have dug their own cisterns, broken cisterns
    that cannot hold water." — Jeremiah 2:13

   A tiny IndexedDB wrapper for things that must survive a reload but are too
   big for localStorage (cached SSO tokens, FlockChat unread maps, last-known
   collection snapshots). Wellspring still owns the .xlsx-style local mode;
   this is for shell-layer use.

   Public API:
     read(key)              — Promise<value | undefined>
     write(key, value)      — Promise<void>
     remove(key)            — Promise<void>
     clear()                — Promise<void>
     keys()                 — Promise<string[]>
   ══════════════════════════════════════════════════════════════════════════════ */

const DB_NAME  = 'flockos_cistern';
const STORE    = 'kv';
const VERSION  = 1;

let _dbPromise = null;

function _open() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return _dbPromise;
}

function _tx(mode) {
  return _open().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

function _wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function read(key) {
  try { return await _wrap((await _tx('readonly')).get(key)); }
  catch (_) { return undefined; }
}

export async function write(key, value) {
  try { await _wrap((await _tx('readwrite')).put(value, key)); }
  catch (_) { /* graceful */ }
}

export async function remove(key) {
  try { await _wrap((await _tx('readwrite')).delete(key)); }
  catch (_) { /* graceful */ }
}

export async function clear() {
  try { await _wrap((await _tx('readwrite')).clear()); }
  catch (_) { /* graceful */ }
}

export async function keys() {
  try {
    const all = await _wrap((await _tx('readonly')).getAllKeys());
    return Array.isArray(all) ? all.map(String) : [];
  } catch (_) { return []; }
}
