/* ══════════════════════════════════════════════════════════════════════════════
   THE TABERNACLE — compatibility loader
   Legacy shells may still load Scripts/the_tabernacle.js directly.
   The split implementation now lives at Scripts/the_tabernacle/index.js.
   ══════════════════════════════════════════════════════════════════════════════ */

(function () {
  if (typeof window === 'undefined') return;

  // If the split entrypoint has already run, do nothing.
  if (window.Modules && typeof window.Modules.renderHub === 'function') return;

  var SPLIT_SRC = 'Scripts/the_tabernacle/index.js';

  function loadSplitSynchronously() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', SPLIT_SRC, false);
      xhr.send(null);

      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
        (0, eval)(xhr.responseText + '\n//# sourceURL=' + SPLIT_SRC);
        return true;
      }

      console.error('[Tabernacle] Failed to load split entrypoint', SPLIT_SRC, 'status', xhr.status);
    } catch (err) {
      console.error('[Tabernacle] Compatibility loader failed for', SPLIT_SRC, err);
    }
    return false;
  }

  if (!loadSplitSynchronously()) {
    // Last-resort async fallback for environments that block sync XHR.
    var s = document.createElement('script');
    s.src = SPLIT_SRC;
    s.defer = true;
    document.head.appendChild(s);
  }
})();
