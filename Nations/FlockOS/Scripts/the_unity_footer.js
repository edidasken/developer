/* ══════════════════════════════════════════════════════════════════════════════
   THE UNITY FOOTER — Shared app-shell footer
   "That they all may be one." — John 17:21

   Minimal, dependency-free footer used across New Covenant apps.
   ══════════════════════════════════════════════════════════════════════════════ */

const STYLE_ID = 'unity-footer-style';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.unity-footer{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:10px 14px;
  border-top:1px solid rgba(255,255,255,.08);
  background:linear-gradient(180deg, rgba(17,27,68,.92), rgba(10,16,40,.96));
  color:#dbe3ff;
  font:600 .78rem 'Plus Jakarta Sans',system-ui,sans-serif;
  letter-spacing:.01em;
  min-height:44px;
}
.unity-footer-left{
  display:flex;
  flex-direction:column;
  gap:2px;
  min-width:0;
}
.unity-footer-app{
  font-weight:800;
  color:#eef1fb;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.unity-footer-sub{
  font-size:.68rem;
  color:#9ba8d0;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.unity-footer-link{
  flex-shrink:0;
  color:#a0beff;
  text-decoration:none;
  border:1px solid rgba(160,190,255,.18);
  background:rgba(160,190,255,.08);
  padding:5px 10px;
  border-radius:999px;
  transition:background .12s,border-color .12s,color .12s;
}
.unity-footer-link:hover{
  background:rgba(160,190,255,.14);
  border-color:rgba(160,190,255,.3);
  color:#fff;
}
@media (max-width: 640px){
  .unity-footer{
    padding:9px 12px;
    font-size:.72rem;
  }
  .unity-footer-sub{
    display:none;
  }
}
  `;
  document.head.appendChild(style);
}

export function mountUnityFooter(host, cfg = {}) {
  if (!host) return null;
  ensureStyles();

  const {
    appName = 'FlockOS',
    appId = 'flockos',
    homeHref = '../',
    footerText = 'New Covenant · Shared app shell',
    showHomeLink = true,
  } = cfg;

  host.classList.add('unity-footer');
  host.dataset.app = appId;
  host.textContent = '';

  const left = document.createElement('div');
  left.className = 'unity-footer-left';

  const appLine = document.createElement('div');
  appLine.className = 'unity-footer-app';
  appLine.textContent = appName;

  const subLine = document.createElement('div');
  subLine.className = 'unity-footer-sub';
  subLine.textContent = footerText;

  left.appendChild(appLine);
  left.appendChild(subLine);
  host.appendChild(left);

  if (showHomeLink) {
    const link = document.createElement('a');
    link.className = 'unity-footer-link';
    link.href = homeHref;
    link.textContent = 'Back to launcher';
    link.setAttribute('aria-label', 'Back to launcher');
    host.appendChild(link);
  }

  return {
    update(partial = {}) {
      if (partial.appName != null) appLine.textContent = String(partial.appName);
      if (partial.footerText != null) subLine.textContent = String(partial.footerText);
      if (partial.homeHref != null && showHomeLink) host.querySelector('.unity-footer-link')?.setAttribute('href', String(partial.homeHref));
    }
  };
}
