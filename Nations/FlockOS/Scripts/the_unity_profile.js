/* ══════════════════════════════════════════════════════════════════════════════
   THE UNITY PROFILE — Shared account sheet
   "Ye are a chosen generation, a royal priesthood." — 1 Peter 2:9

   Triggered by the gold-glow avatar button in the unity header. Renders the
   canonical 9-item profile menu:
     · Header (display name + email)
     · My Profile
     · Settings
     · Switch Church
     · ── divider ──
     · Prayer Requests
     · To-Do
     · Personal Calendar
     · Journal Logs
     · ── divider ──
     · Sign Out (danger)

   Sign Out delegates to the app-supplied onSignOut() callback. All other
   stub items emit a "Coming soon" toast — apps may override later by
   providing onAction(actionId).
   ══════════════════════════════════════════════════════════════════════════════ */

let _sheet = null;

const ITEMS = [
  { id: 'profile',       label: 'My Profile',        icon: 'user'     },
  { id: 'settings',      label: 'Settings',          icon: 'gear'     },
  { id: 'switch-church', label: 'Switch Church',     icon: 'church',  href: '../' },
  { divider: true },
  { id: 'prayer',        label: 'Prayer Requests',   icon: 'pray'     },
  { id: 'todo',          label: 'To-Do',             icon: 'check'    },
  { id: 'calendar',      label: 'Personal Calendar', icon: 'cal'      },
  { id: 'journal',       label: 'Journal Logs',      icon: 'book'     },
  { divider: true },
  { id: 'signout',       label: 'Sign Out',          icon: 'out', danger: true },
];

const ICON_SVG = {
  user: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  gear: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  church: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M10 4h4"/><path d="M5 22V11l7-4 7 4v11"/><path d="M9 22v-6h6v6"/></svg>',
  pray: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8 2 8 6 8 8v6"/><path d="M16 14V8c0-2 0-6-4-6"/><path d="M8 14H6a4 4 0 0 0-4 4v4h20v-4a4 4 0 0 0-4-4h-2"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  cal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  book: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  out: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

export function openUnityProfile(opts = {}) {
  const { user = null, onSignOut = null, onAction = null, appName = '', signInHref = null } = opts;

  // No user → public/unauth flow.
  // If the caller provided signInHref (e.g. GROW launcher, public apps),
  // simply navigate there — do NOT clear session or reload.
  // Otherwise hard-guard the authenticated apps: clear stale session and
  // reload so the app shell re-surfaces the sign-in gate.
  if (!user || !user.email) {
    if (signInHref) { location.assign(signInHref); return; }
    try { sessionStorage.removeItem('flock_auth_session'); } catch (_) {}
    try { sessionStorage.removeItem('flock_auth_profile'); } catch (_) {}
    location.reload();
    return;
  }

  ensureSheet();

  const display = user.displayName || user.name || user.email.split('@')[0];
  const email   = user.email;
  const photo   = user.photoURL || '';

  _sheet.querySelector('.unity-pp-name').textContent = display;
  _sheet.querySelector('.unity-pp-email').textContent = email || `Sign in to ${appName || 'FlockOS'}`;
  const av = _sheet.querySelector('.unity-pp-avatar');
  if (photo) { av.style.backgroundImage = `url(${photo})`; av.textContent = ''; }
  else      { av.style.backgroundImage = ''; av.textContent = (display[0] || '?').toUpperCase(); }

  _sheet.classList.add('is-open');
  document.body.classList.add('unity-modal-open');

  // (Re)wire item handlers
  _sheet.querySelectorAll('.unity-pp-item').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      if (id === 'signout') {
        closeUnityProfile();
        if (typeof onSignOut === 'function') { Promise.resolve().then(onSignOut); }
        else { _toast('Sign-out not configured for this app.'); }
        return;
      }
      if (typeof onAction === 'function') {
        const handled = onAction(id);
        if (handled !== false) { closeUnityProfile(); return; }
      }
      if (id === 'switch-church') {
        const item = ITEMS.find(x => x.id === 'switch-church');
        closeUnityProfile();
        if (item?.href) location.href = item.href;
        return;
      }
      _toast(`${btn.querySelector('.unity-pp-item-label').textContent}: coming soon.`);
      closeUnityProfile();
    };
  });
}

export function closeUnityProfile() {
  if (!_sheet) return;
  _sheet.classList.remove('is-open');
  document.body.classList.remove('unity-modal-open');
}

function ensureSheet() {
  if (_sheet) return;
  _sheet = document.createElement('div');
  _sheet.className = 'unity-profile-sheet';
  _sheet.setAttribute('role', 'dialog');
  _sheet.setAttribute('aria-modal', 'true');
  _sheet.setAttribute('aria-label', 'Account');
  _sheet.innerHTML = `
    <div class="unity-pp-backdrop" data-act="close"></div>
    <div class="unity-pp-card" role="menu">
      <header class="unity-pp-header">
        <div class="unity-pp-avatar" aria-hidden="true"></div>
        <div class="unity-pp-id">
          <div class="unity-pp-name"></div>
          <div class="unity-pp-email"></div>
        </div>
      </header>
      <div class="unity-pp-list">
        ${ITEMS.map(it => it.divider
          ? `<div class="unity-pp-divider"></div>`
          : `<button class="unity-pp-item ${it.danger ? 'unity-pp-item--danger' : ''}" role="menuitem" data-id="${it.id}">
               <span class="unity-pp-item-icon">${ICON_SVG[it.icon] || ''}</span>
               <span class="unity-pp-item-label">${it.label}</span>
             </button>`
        ).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(_sheet);

  _sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="close"]')) closeUnityProfile();
  });

  document.addEventListener('keydown', (e) => {
    if (_sheet.classList.contains('is-open') && e.key === 'Escape') closeUnityProfile();
  });
}

function _toast(msg) {
  // Lightweight toast that avoids importing app-specific toast modules
  const t = document.createElement('div');
  t.className = 'unity-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-on'));
  setTimeout(() => { t.classList.remove('is-on'); setTimeout(() => t.remove(), 240); }, 2400);
}
