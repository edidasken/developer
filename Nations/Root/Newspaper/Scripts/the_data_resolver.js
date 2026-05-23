/* ══════════════════════════════════════════════════════════════════════════════
   THE DATA RESOLVER — shared Firestore → GAS → localStorage → static ladder
   Keeps Newspaper page code small and preserves offline / cached fallbacks.
   ══════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const SOURCE = Object.freeze({
    FIRESTORE: 'firestore',
    GAS: 'gas',
    LOCAL: 'localStorage',
    STATIC: 'static',
  });

  function _safeLocalStorage() {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage;
    } catch (_) {
      return null;
    }
  }

  function _readCache(key) {
    const store = _safeLocalStorage();
    if (!store || !key) return null;

    try {
      const raw = store.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'data')) {
        return parsed.data;
      }

      return parsed;
    } catch (_) {
      return null;
    }
  }

  function _writeCache(key, data, source) {
    const store = _safeLocalStorage();
    if (!store || !key) return;

    try {
      store.setItem(key, JSON.stringify({
        data,
        source: source || SOURCE.LOCAL,
        updatedAt: new Date().toISOString(),
      }));
    } catch (_) {}
  }

  function _isUsable(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }

  async function _tryStep(step) {
    if (typeof step !== 'function') return { ok: false, value: null };
    try {
      const value = await step();
      return { ok: true, value };
    } catch (error) {
      return { ok: false, error, value: null };
    }
  }

  async function resolveSectionData(options) {
    const cfg = options || {};
    const key = String(cfg.key || '').trim();

    const liveStep = await _tryStep(cfg.live);
    if (liveStep.ok && _isUsable(liveStep.value)) {
      if (key) _writeCache(key, liveStep.value, SOURCE.FIRESTORE);
      return {
        data: liveStep.value,
        source: SOURCE.FIRESTORE,
        stale: false,
      };
    }

    const gasStep = await _tryStep(cfg.gas);
    if (gasStep.ok && _isUsable(gasStep.value)) {
      if (key) _writeCache(key, gasStep.value, SOURCE.GAS);
      return {
        data: gasStep.value,
        source: SOURCE.GAS,
        stale: false,
      };
    }

    if (typeof cfg.local === 'function') {
      const localStep = await _tryStep(cfg.local);
      if (localStep.ok && _isUsable(localStep.value)) {
        return {
          data: localStep.value,
          source: SOURCE.LOCAL,
          stale: true,
        };
      }
    }

    if (key) {
      const cached = _readCache(key);
      if (_isUsable(cached)) {
        return {
          data: cached,
          source: SOURCE.LOCAL,
          stale: true,
        };
      }
    }

    if (_isUsable(cfg.staticValue)) {
      return {
        data: cfg.staticValue,
        source: SOURCE.STATIC,
        stale: true,
      };
    }

    return {
      data: cfg.staticValue,
      source: SOURCE.STATIC,
      stale: true,
      error: 'No data source returned usable content.',
    };
  }

  function readCachedData(key, fallback) {
    const cached = _readCache(String(key || '').trim());
    return _isUsable(cached) ? cached : fallback;
  }

  function writeCachedData(key, data, source) {
    _writeCache(String(key || '').trim(), data, source);
  }

  const api = {
    SOURCE,
    resolveSectionData,
    readCachedData,
    writeCachedData,
  };

  if (typeof window !== 'undefined') {
    window.NewspaperDataResolver = api;
    window.resolveSectionData = resolveSectionData;
    window.readCachedData = readCachedData;
    window.writeCachedData = writeCachedData;
  }
})();
