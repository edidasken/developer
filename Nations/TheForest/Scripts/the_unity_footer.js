/* ══════════════════════════════════════════════════════════════════════════════
   THE UNITY FOOTER — Single shared app-shell footer
   "Go therefore and make disciples of all nations." — Matthew 28:19

   Every New Covenant app mounts this footer. Canonical layout:
     [↑ Back to Top] [🏠 Home] [✉️ Invite] [🙏 Prayer] [📞 Call] [📍 Map]
     ─────────────────────────────────────────────────────────────
     FlockOS - Built to be Shared!

   USAGE (any app):
     import { mountUnityFooter } from '../Scripts/the_unity_footer.js';
     mountUnityFooter(footerEl, {
       appId:       'flockos',
       appAccent:   '#3b82f6',
       appAccentDk: '#1e3a8a',
       homeHref:    'https://trinity.flock.app/',
       inviteHref:  '../app.invite/',
       prayerHref:  'https://trinity.flock.app/prayer',
       phone:       '+15551234567',
       mapsUrl:     'https://maps.google.com/?q=123+Main+St'
     });
   ══════════════════════════════════════════════════════════════════════════════ */

const ICONS = {
  top:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  home:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  invite: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  prayer: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/></svg>',
  phone:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  map:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
};

export function mountUnityFooter(host, cfg = {}) {
  if (!host) return;

  const {
    appId      = 'flockos',
    appAccent  = '#3b82f6',
    appAccentDk= '#1e3a8a',
    homeHref   = './',
    inviteHref = '../app.invite/',
    prayerHref = './prayer',
    phone      = '',
    mapsUrl    = '',
  } = cfg;

  // Helper to check if a value is an unreplaced template variable
  const isTemplate = (val) => typeof val === 'string' && val.includes('{{') && val.includes('}}');

  host.classList.add('unity-footer');
  host.dataset.app = appId;

  // Build actions array
  const actions = [
    { id: 'top',    label: 'Back to Top', icon: ICONS.top,    href: '#top',    act: 'scroll-top' },
    { id: 'home',   label: 'Home',        icon: ICONS.home,   href: homeHref },
    { id: 'invite', label: 'Invite',      icon: ICONS.invite, href: inviteHref },
    { id: 'prayer', label: 'Prayer',      icon: ICONS.prayer, href: '#prayer', act: 'open-prayer' },
  ];

  // Only add phone button if phone is provided and not a template variable
  if (phone && !isTemplate(phone)) {
    actions.push({ id: 'phone', label: 'Call', icon: ICONS.phone, href: `tel:${phone}` });
  }
  
  // Only add map button if mapsUrl is provided and not a template variable
  if (mapsUrl && !isTemplate(mapsUrl)) {
    actions.push({ id: 'map', label: 'Map', icon: ICONS.map, href: mapsUrl, target: '_blank' });
  }

  const actionsHtml = actions.map(a => {
    const targetAttr = a.target ? ` target="${escapeAttr(a.target)}"` : '';
    const dataAct = a.act ? ` data-act="${escapeAttr(a.act)}"` : '';
    return `<a class="unity-footer-btn" href="${escapeAttr(a.href)}"${targetAttr}${dataAct} aria-label="${escapeAttr(a.label)}">${a.icon}<span>${escapeHtml(a.label)}</span></a>`;
  }).join('');

  host.innerHTML = `
    <div class="unity-footer-actions">
      ${actionsHtml}
    </div>
  `;

  // Click delegation for special actions
  host.addEventListener('click', (e) => {
    const link = e.target.closest('[data-act]');
    if (!link) return;

    const act = link.dataset.act;
    if (act === 'scroll-top') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    else if (act === 'open-prayer') {
      e.preventDefault();
      // Try in-page handlers first (GROW public, Upper Room, etc.)
      if (typeof window._openOutreachModal === 'function') {
        window._openOutreachModal('', { name: 'prayer', title: 'Prayer Request', source: 'UnityFooter' });
      }
      else if (typeof window.openPrayerRequest === 'function') {
        window.openPrayerRequest();
      }
      else if (window.UpperRoom && typeof window.UpperRoom.openPrayerChain === 'function') {
        window.UpperRoom.openPrayerChain();
      }
      else {
        // Lazy-load the shared prayer modal module (works on every NC app
        // because they all set window.FLOCK_FIREBASE_CONFIG and load the
        // Firebase compat SDK). Falls back to external href if even that fails.
        import('https://flock-os.github.io/FlockOS/New_Covenant/Scripts/the_prayer_modal.js')
          .then(m => m.openPrayerModal('', { name: 'prayer', title: 'Prayer Request', source: 'UnityFooter' }))
          .catch(() => {
            if (prayerHref && !isTemplate(prayerHref) && prayerHref !== '#prayer') {
              window.open(prayerHref, '_blank');
            } else {
              console.warn('Prayer modal failed to load.');
            }
          });
      }
    }
  });

  return {
    update(partial) { Object.assign(cfg, partial); }
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
