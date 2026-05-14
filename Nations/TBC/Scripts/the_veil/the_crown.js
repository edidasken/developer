/* ══════════════════════════════════════════════════════════════════════════════
   THE CROWN — FlockOS topbar (delegates to the unified unity-header)
   "And on his head were many crowns." — Revelation 19:12

   Thin adapter: mounts the shared unity-header
   (New_Covenant/Scripts/the_unity_header.js) configured for FlockOS, then
   wires FlockOS-specific behaviour (notifications extra, account sheet,
   feature search registry).
   ══════════════════════════════════════════════════════════════════════════════ */

import { mountUnityHeader } from '../the_unity_header.js';
import { profile } from '../the_priesthood/index.js';

const FLOCKOS_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>';
const BELL_ICON    = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

export function mountCrown(host) {
  if (!host) return;

  const features = [
    { id: 'home',     label: 'Good Shepherd (Home)', hint: 'FlockOS dashboard',      keywords: ['home','shepherd','dashboard'],
      run: () => import('../the_scribes/index.js').then(m => m.go && m.go('the_good_shepherd')).catch(() => { location.hash = '#the_good_shepherd'; }) },
    { id: 'members',  label: 'Members',              hint: 'Directory of the flock', keywords: ['people','directory'],
      run: () => import('../the_scribes/index.js').then(m => m.go && m.go('members')).catch(() => { location.hash = '#members'; }) },
    { id: 'calendar', label: 'Calendar',             hint: 'Church events',          keywords: ['events','schedule'],
      run: () => import('../the_scribes/index.js').then(m => m.go && m.go('calendar')).catch(() => { location.hash = '#calendar'; }) },
    { id: 'settings', label: 'Settings',             hint: 'App preferences',        keywords: ['preferences','config'],
      run: () => import('../the_scribes/index.js').then(m => m.go && m.go('settings')).catch(() => { location.hash = '#settings'; }) },
    { id: 'palette',  label: 'Open Command Palette', hint: 'Legacy ⌘K palette',      keywords: ['command','palette','herald'],
      run: () => import('../the_scribes/the_herald.js').then(m => m.toggle && m.toggle()).catch(() => {}) },
  ];

  const ctrl = mountUnityHeader(host, {
    appId:       'flockos',
    appName:     'FlockOS',
    appIconSvg:  FLOCKOS_ICON,
    appAccent:   '#3b82f6',
    appAccentDk: '#1e3a8a',
    homeHref:    '#the_good_shepherd',
    user:        profile() || null,
    onSignOut:   async () => {
      const m = await import('../the_priesthood/index.js');
      return m.depart();
    },
    onHamburger: () => document.body.classList.toggle('veil-side-open'),
    extras: [
      { html: BELL_ICON, aria: 'Notifications', title: 'Notifications', onClick: () => {
          import('../vessels/the_staff.js').then(m => m.raiseToast({ message: 'Notifications coming online.' })).catch(() => {});
        } },
    ],
    features,
  });

  // Refresh user once the_priesthood resolves
  setTimeout(() => ctrl?.update?.({ user: profile() || null }), 800);
  setTimeout(() => ctrl?.update?.({ user: profile() || null }), 2400);
}
