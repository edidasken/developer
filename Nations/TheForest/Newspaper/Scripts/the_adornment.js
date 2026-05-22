/* ═══════════════════════════════════════════════════════════════════
   THE ADORNMENT — Newspaper stub
   The Flock Herald uses a fixed broadsheet theme (data-theme="broadsheet")
   set inline in each page's <html> tag. Dynamic theme switching is not
   needed here. This stub silences the ES-module export errors that occur
   when the New Covenant source is loaded as a plain script.
═══════════════════════════════════════════════════════════════════ */
(function () {
  /* No-op shims for any external callers */
  window.Adornment = {
    choices:    function () { return []; },
    current:    function () { return 'broadsheet'; },
    applyTheme: function () {},
    applyAuto:  function () {},
    init:       function () {},
  };
})();
