/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL: THE WHY — About FlockOS
   "For it is God who works in you to will and to act." — Philippians 2:13

   Public-facing module for GROW. Renders the canonical embed-about.html page
   in an iframe so the content lives in one place.
   ══════════════════════════════════════════════════════════════════════════════ */

// Resolve embed-about.html relative to this module's location.
// This module is at Scripts/the_gospel/the_gospel_why.js,
// so ../../app.embeds/embed-about.html → New_Covenant/app.embeds/embed-about.html.
const _SRC = (() => {
  try {
    return new URL('../../app.embeds/embed-about.html', import.meta.url).href;
  } catch (_) {
    return '../../app.embeds/embed-about.html';
  }
})();

export function render() {
  return /* html */`
    <div class="gw-why-host" style="
      height: calc(100vh - var(--topbar-h, 60px) - 48px);
      min-height: 480px;
      display: flex;
      flex-direction: column;
    ">
      <iframe
        src="${_SRC}"
        title="The Why — About FlockOS"
        style="
          flex: 1;
          width: 100%;
          border: none;
          border-radius: 16px;
          background: #f7f8fb;
          display: block;
        "
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      ></iframe>
    </div>
  `;
}

export function mount(_root) {
  return () => {};
}
