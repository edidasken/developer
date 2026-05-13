/* ══════════════════════════════════════════════════════════════════════════════
   THE CROWN — Top bar (the_veil)
   "And on his head were many crowns." — Revelation 19:12

   Visual shell: brand · search trigger (⌘K) · notifications · account avatar.
   Behavior delegates to the_herald (palette), the_priesthood (account drawer),
   and the_upper_room (push toggle). Pure markup; styles live in
   New_Covenant/Styles/new_covenant.css.
   ══════════════════════════════════════════════════════════════════════════════ */

import { profile } from '../the_priesthood/index.js';

const ICON = {
  bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
};

export function mountCrown(host) {
  if (!host) return;
  host.classList.add('veil-top');
  host.innerHTML = `
    <button class="veil-action veil-menu" data-act="toggle-side" aria-label="Open navigation">${ICON.menu}</button>
    <button class="veil-brand" data-act="home" aria-label="FlockOS home">
      <span class="veil-brand-text">FlockOS</span>
    </button>
    <div class="veil-spacer"></div>
    <button class="veil-search" data-act="open-herald" aria-label="Open command palette (⌘K)">
      ${ICON.search}<span>Search anything…</span><kbd>⌘K</kbd>
    </button>
    <button class="veil-action" data-act="open-notifications" aria-label="Notifications">${ICON.bell}</button>
    <button class="veil-avatar" data-act="open-account" aria-label="Account" data-bind="avatar">
      <img class="veil-avatar-logo" alt="" src="Images/FlockOS.png" onerror="this.style.display='none'">
    </button>
  `;
  _paintAvatar(host);

  host.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'home')               { import('../the_scribes/index.js').then(m => m.go && m.go('the_good_shepherd')).catch(() => {}); }
    else if (act === 'open-herald')   { import('../the_scribes/the_herald.js').then(m => m.toggle && m.toggle()); }
    else if (act === 'toggle-side')   { document.body.classList.toggle('veil-side-open'); }
    else if (act === 'open-account')  { import('../the_priesthood/index.js').then(m => m.openAccountSheet()); }
    else if (act === 'open-notifications') {
      import('../vessels/the_staff.js').then(m => m.raiseToast({ message: 'Notifications coming online.' }));
    }
  });

  // Refresh avatar shortly after boot in case the_priesthood resolves later.
  setTimeout(() => _paintAvatar(host), 800);
  setTimeout(() => _paintAvatar(host), 2400);
}

function _paintAvatar(host) {
  // Avatar now displays the FlockOS logo image (set in markup); no initials needed.
  // Function kept as a no-op so existing setTimeout calls remain safe.
  return host;
}
