/* ══════════════════════════════════════════════════════════════════════════════
   THE WINDOW BRIDGE — Tabernacle global promoter
   "And Moses said unto them, Stand still, and I will hear what the LORD
    will command concerning you." — Numbers 9:8

   The Tabernacle backend scripts declare their globals as top-level `const`
   in classic (non-module) scripts. Those bindings are not available through
   `window[...]` unless the legacy modules explicitly attach themselves.

   This bridge promotes the legacy globals to `window.*` without ever touching
   bare identifiers directly, so it cannot trip TDZ/initialization errors if a
   script is still loading. It retries briefly until every expected module is
   available.
   ══════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var map = [
    { key: 'Nehemiah',       source: 'Nehemiah' },
    { key: 'TheUpperRoom',   source: 'UpperRoom' },
    { key: 'TheShepherd',    source: 'TheShepherd' },
    { key: 'TheFold',        source: 'TheFold' },
    { key: 'TheScrolls',     source: 'TheScrolls' },
    { key: 'TheLife',        source: 'TheLife' },
    { key: 'TheHarvest',     source: 'TheHarvest' },
    { key: 'TheWay',         source: 'TheWay' },
    { key: 'TheTruth',       source: 'TheTruth' },
    { key: 'TheSeason',      source: 'TheSeason' },
    { key: 'TheWellspring',  source: 'TheWellspring' },
    { key: 'TheWell',        source: 'TheWell' },
    { key: 'TheVine',        source: 'TheVine' },
    { key: 'Trumpet',        source: 'Trumpet' },
  ];

  function _readLexical(name) {
    try {
      var getter = new Function(
        'try { return typeof ' + name + " !== 'undefined' ? " + name + " : null; } catch (_) { return null; }"
      );
      return getter();
    } catch (_) {
      return null;
    }
  }

  function _promoteOnce() {
    var loaded = [];
    map.forEach(function (pair) {
      var current = (typeof window !== 'undefined') ? window[pair.key] : null;
      if (current != null) {
        loaded.push(pair.key);
        return;
      }
      var val = _readLexical(pair.source);
      if (val != null && typeof window !== 'undefined') {
        window[pair.key] = val;
        loaded.push(pair.key);
      }
    });
    return loaded;
  }

  var loadedNow = _promoteOnce();

  if (loadedNow.length !== map.length) {
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      var loaded = _promoteOnce();
      if (loaded.length === map.length || tries >= 40) {
        clearInterval(timer);
        if (typeof console !== 'undefined') {
          console.log('[NewCovenant] Window bridge promoted: ' + (loaded.length ? loaded.join(', ') : '(none — backend scripts not loaded)'));
        }
      }
    }, 250);
  } else if (typeof console !== 'undefined') {
    console.log('[NewCovenant] Window bridge promoted: ' + loadedNow.join(', '));
  }
})();
