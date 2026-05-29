/* ══════════════════════════════════════════════════════════════════════════════
   THE STAFF — <flock-toast>
   "Thy rod and thy staff they comfort me." — Psalm 23:4

   Tiny toast renderer. Used by the_watchmen for error reporting and by views
   for completion / undo moments.

   Public API:
     raiseToast({ tone, message, action?, duration? })
       tone:    'info' | 'good' | 'warn' | 'danger'   (default 'info')
       action:  { label, run } — optional inline button (e.g. Undo)
       duration: ms (default 4500; 0 = sticky until clicked)
   ══════════════════════════════════════════════════════════════════════════════ */

const HOST_ID = 'the-staff-host';
let hostObserver = null;

/**
 * @param {{ tone?: 'info'|'good'|'warn'|'danger'; message?: string; action?: { label?: string, run?: Function }; duration?: number }} [opts]
 */
export function raiseToast(opts = {}) {
  const { tone = 'info', message = '', action, duration = 4500 } = opts;
  const host = _ensureHost();
  const t = document.createElement('div');
  t.className = 'staff-toast staff-tone-' + tone;
  t.setAttribute('role', tone === 'danger' || tone === 'warn' ? 'alert' : 'status');
  t.innerHTML = `
    <span class="staff-msg"></span>
    ${action ? '<button type="button" class="staff-act"></button>' : ''}
    <button type="button" class="staff-close" aria-label="Dismiss">×</button>
  `;
  t.querySelector('.staff-msg').textContent = String(message);
  if (action) t.querySelector('.staff-act').textContent = String(action.label || 'Undo');

  const colors = {
    info:   { bg: '#1b264f', fg: '#ffffff' },
    good:   { bg: '#15803d', fg: '#ffffff' },
    warn:   { bg: '#b45309', fg: '#ffffff' },
    danger: { bg: '#b91c1c', fg: '#ffffff' },
  };
  const c = colors[tone] || colors.info;

  t.style.cssText = `
    background: ${c.bg}; color: ${c.fg};
    padding: 10px 12px 10px 16px; border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    display: flex; align-items: center; gap: 10px;
    font: 0.92rem 'Noto Sans', sans-serif;
    transform: translateY(8px); opacity: 0;
    transition: transform .26s ease, opacity .26s ease;
    max-width: min(420px, 92vw);
  `;
  Array.from(t.querySelectorAll('button')).forEach((b) => b.style.cssText = `
    background: rgba(255,255,255,0.16); color: inherit;
    border: 0; border-radius: 6px; padding: 4px 10px; cursor: pointer;
    font: inherit;
  `);

  host.appendChild(t);
  requestAnimationFrame(() => { t.style.transform = 'translateY(0)'; t.style.opacity = '1'; });

  function dismiss() {
    t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 280);
  }

  t.querySelector('.staff-close').addEventListener('click', dismiss);
  if (action) t.querySelector('.staff-act').addEventListener('click', () => {
    try { action.run(); } catch (_) {}
    dismiss();
  });

  if (duration > 0) setTimeout(dismiss, duration);
  return { dismiss };
}

function _ensureHost() {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = `
      position: fixed; right: 16px; bottom: 16px; z-index: 9500;
      display: flex; flex-direction: column; gap: 8px;
      pointer-events: none;
    `;
    host.addEventListener('click', () => {}, { passive: true });
    document.body.appendChild(host);
  }
  // Re-enable pointer-events on children.
  host.style.pointerEvents = 'none';
  Array.from(host.children).forEach((c) => c.style.pointerEvents = 'auto');
  // New children get pointer events at append time too.
  if (!hostObserver) {
    hostObserver = new MutationObserver((muts) => {
      muts.forEach((mu) => mu.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) n.style.pointerEvents = 'auto';
      }));
    });
    hostObserver.observe(host, { childList: true });
  }
  return host;
}
