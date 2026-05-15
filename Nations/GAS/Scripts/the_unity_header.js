/* ══════════════════════════════════════════════════════════════════════════════
   THE UNITY HEADER — Single shared app-shell topbar
   "That they all may be one." — John 17:21

   Every New Covenant app mounts this header. Strict canonical layout:
     [☰ hamburger] [App Name] [...app extras...] [spacer]
     [🔍 search-btn] [⚏ app-switcher] [● gold-glow avatar]

   All buttons (search / switcher / avatar) share size + radius for visual
   parity. Avatar opens the unified profile sheet (the_unity_profile.js) which
   delegates sign-out to the app-supplied handler.

   USAGE (any app):
     import { mountUnityHeader } from '../Scripts/the_unity_header.js';
     mountUnityHeader(headerEl, {
       appId:       'flockchat',
       appName:     'FlockChat',
       appIconSvg:  '<svg ...></svg>',
       appAccent:   '#06b6d4',                  // brand-icon gradient stop
       homeHref:    './',                       // brand click destination
       features:    [{ id, label, hint, run() }],
       user:        { displayName, email, photoURL } | null,
       onSignOut:   async () => { ... },
       extras:      [{ html, onClick, aria }],  // optional app-specific buttons
     });
   ══════════════════════════════════════════════════════════════════════════════ */

import { mountSwitcher } from './the_app_switcher.js';
import { openUnitySearch, registerFeatures } from './the_unity_search.js';
import { openUnityProfile } from './the_unity_profile.js';

const ICONS = {
  hamburger: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  search:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

export function mountUnityHeader(host, cfg = {}) {
  if (!host) return;
  const {
    appId      = 'flockos',
    appName    = 'FlockOS',
    appIconSvg = '',
    appAccent  = '#3b82f6',
    appAccentDk= '#1e3a8a',
    homeHref   = './',
    features   = [],
    user       = null,
    onSignOut  = null,
    onHamburger= null,
    hideHamburger = false,
    extras     = [],
    avatarSrc  = 'Images/FlockIcon-512.webp',
    signInHref = null,    // public/unauth apps: where to send the avatar click when no user
    onAccount  = null,    // optional override for avatar click; if set, takes precedence over the profile sheet
  } = cfg;

  if (Array.isArray(features) && features.length) registerFeatures(appId, features);

  host.classList.add('unity-header');
  host.dataset.app = appId;

  const extrasHtml = extras.map((x, i) =>
    `<button class="unity-action unity-extra" data-extra-idx="${i}" aria-label="${(x.aria || '').replace(/"/g, '&quot;')}" title="${(x.title || x.aria || '').replace(/"/g, '&quot;')}">${x.html || ''}</button>`
  ).join('');

  const hamburgerHtml = hideHamburger ? '' : `<button class="unity-action unity-hamburger" data-act="menu" aria-label="Open menu">${ICONS.hamburger}</button>`;

  host.innerHTML = `
    ${hamburgerHtml}
    <a class="unity-brand" data-act="home" href="${escapeAttr(homeHref)}" aria-label="${escapeAttr(appName)} home">
      <span class="unity-brand-icon" aria-hidden="true" style="background:linear-gradient(135deg, ${escapeAttr(appAccentDk)}, ${escapeAttr(appAccent)})">${appIconSvg}</span>
      <span class="unity-brand-text">${escapeHtml(appName)}</span>
    </a>
    ${extrasHtml}
    <div class="unity-spacer"></div>
    <button class="unity-action unity-search-btn" data-act="search" aria-label="Search ${escapeAttr(appName)}" title="Search (⌘K)">${ICONS.search}</button>
    <button class="unity-action unity-switcher" data-app-switcher data-app-switcher-current="${escapeAttr(appId)}" aria-label="Switch app" title="Switch app"></button>
    <button class="unity-avatar" data-act="account" aria-label="Account">
      <img class="unity-avatar-img" alt="" src="${escapeAttr(avatarSrc)}" onerror="this.style.display='none'">
    </button>
  `;

  // Mount cross-app switcher
  const switcherHost = host.querySelector('[data-app-switcher]');
  if (switcherHost) mountSwitcher(switcherHost, { current: appId });

  // Click delegation (with touch fallback for PWA)
  function handleAction(e) {
    const btn = e.target.closest('[data-act],[data-extra-idx]');
    if (!btn) return;

    if (btn.dataset.extraIdx != null) {
      const ex = extras[+btn.dataset.extraIdx];
      if (ex && typeof ex.onClick === 'function') ex.onClick(e);
      return;
    }

    const act = btn.dataset.act;
    if (act === 'menu') {
      e.preventDefault(); // Prevent double-fire in PWA
      if (typeof onHamburger === 'function') onHamburger();
      else document.body.classList.toggle('veil-side-open');
    } else if (act === 'home') {
      // Native anchor handles navigation; nothing to do
    } else if (act === 'search') {
      e.preventDefault();
      openUnitySearch({ appId, appName });
    } else if (act === 'account') {
      e.preventDefault();
      if (typeof onAccount === 'function') { onAccount(e); return; }
      openUnityProfile({ appId, appName, user: cfg.user, onSignOut, signInHref });
    }
  }

  host.addEventListener('click', handleAction);
  
  // PWA touch fallback — iOS PWAs sometimes don't convert touches to clicks
  host.addEventListener('touchend', (e) => {
    const btn = e.target.closest('[data-act],[data-extra-idx]');
    if (btn) {
      e.preventDefault(); // Prevent click from also firing
      handleAction(e);
    }
  });

  // ⌘K / Ctrl+K opens search globally for this app
  if (!host.__unityKeydown) {
    host.__unityKeydown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openUnitySearch({ appId, appName });
      }
    };
    document.addEventListener('keydown', host.__unityKeydown);
  }

  return {
    setUser(u) { /* user is captured in closure for profile open; update via remount if needed */ cfg.user = u; },
    update(partial) { Object.assign(cfg, partial); }
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
