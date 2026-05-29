/* ══════════════════════════════════════════════════════════════════════════════
   THE LEGACY BRIDGE — Adapter to the legacy global-namespace modules
   "I am not come to destroy, but to fulfil." — Matthew 5:17

   The new shell ships ahead of the file splits. Every existing module
   (TheShepherd, TheFold, …) currently lives on `window` from the legacy
   bundle. This bridge gives the new ES-module world a single, predictable
   way to reach them — and a single place to swap when each module is
   actually split into files.

   Public API:
     bridge(globalName, fallback?)  — returns the live legacy export
     when(globalName)               — Promise that resolves once it appears
     callWhen(globalName, method, …args) — call the legacy method when ready

   Each split-module shim (Scripts/the_shepherd/index.js, etc.) imports from
   here. When a real split lands, the shim replaces its bridge() call with
   real exports — call sites don't change.
   ══════════════════════════════════════════════════════════════════════════════ */

const _waiters = new Map(); // globalName -> Promise

function _readLegacyGlobal(globalName) {
  if (typeof window !== 'undefined' && window[globalName] != null) {
    return window[globalName];
  }

  try {
    // Resolve lexical globals from classic scripts without touching TDZ-prone
    // bare identifiers in this bridge scope.
    var getter = new Function(
      'try { return typeof ' + globalName + " !== 'undefined' ? " + globalName + " : null; } catch (_) { return null; }"
    );
    return getter();
  } catch (_) {
    return null;
  }
}

function _resolveLegacyGlobal(globalName, fallback) {
  var value = _readLegacyGlobal(globalName);
  if (value != null && typeof window !== 'undefined' && window[globalName] == null) {
    window[globalName] = value;
  }
  return value != null ? value : fallback;
}

export function bridge(globalName, fallback = null) {
  return _resolveLegacyGlobal(globalName, fallback);
}

export function when(globalName, { timeoutMs = 8000, intervalMs = 50 } = {}) {
  var existing = bridge(globalName);
  if (existing) return Promise.resolve(existing);
  if (_waiters.has(globalName)) return _waiters.get(globalName);
  const p = new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const value = bridge(globalName);
      if (value) return resolve(value);
      if (Date.now() - t0 > timeoutMs) return reject(new Error(`legacy '${globalName}' never appeared`));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
  _waiters.set(globalName, p);
  return p;
}

export async function callWhen(globalName, method, ...args) {
  const M = await when(globalName);
  if (!M || typeof M[method] !== 'function') {
    throw new Error(`legacy '${globalName}.${method}' not callable`);
  }
  return M[method](...args);
}
