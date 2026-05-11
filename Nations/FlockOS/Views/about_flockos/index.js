/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: About FlockOS — "The Why"
   "For it is God who works in you to will and to act." — Philippians 2:13

   Renders the embed-about.html page in an iframe so the canonical content
   lives in one place and is shared across GROW Public and the app.
   ══════════════════════════════════════════════════════════════════════════════ */

export const name  = 'about_flockos';
export const title = 'The Why';

const _SRC = (() => {
  // Resolve embed-about.html relative to New_Covenant/ regardless of deploy path.
  // embed-about.html lives inside app.embeds/ subfolder.
  const base = new URL('../..', import.meta.url).href.replace(/\/$/, '');
  return `${base}/app.embeds/embed-about.html`;
})();

export function render() {
  return /* html */`
    <div style="
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
