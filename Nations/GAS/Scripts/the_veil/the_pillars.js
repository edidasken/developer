/* ══════════════════════════════════════════════════════════════════════════════
   THE PILLARS — Side navigation (the_veil)
   "Wisdom hath builded her house, she hath hewn out her seven pillars." — Pr 9:1

   Sectioned navigation with icons, badges, and active-state highlighting.
   Listens to the_scribes for active view; pure markup, styles in
   New_Covenant/Styles/new_covenant.css.
   ══════════════════════════════════════════════════════════════════════════════ */

import { go, current } from '../the_scribes/index.js';
import { unreadTotal } from '../the_upper_room/index.js';
import { pendingCount, subscribeOpenCareCount } from '../the_life/index.js';

const I = (path) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const ICON = {
  home:       I('<path d="M3 12 12 4l9 8"/><path d="M5 10v10h14V10"/>'),
  fold:       I('<path d="M3 7c4 0 4 3 8 3s4-3 8-3"/><path d="M3 17c4 0 4 3 8 3s4-3 8-3"/><path d="M3 12h18"/>'),
  chat:       I('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  bullhorn:   I('<path d="M3 11v2a3 3 0 0 0 3 3h1l4 4V4l-4 4H6a3 3 0 0 0-3 3z"/><path d="M14 7v10"/><path d="M18 5v14"/>'),
  hands:      I('<path d="M9 11V5a2 2 0 1 1 4 0v8"/><path d="M13 13V3a2 2 0 1 1 4 0v12"/><path d="M17 14V6a2 2 0 1 1 4 0v9a7 7 0 0 1-7 7H9a4 4 0 0 1-4-4l-2-7a2 2 0 0 1 4-1l1 4"/>'),
  calendar:   I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  harvest:    I('<path d="M12 22V8"/><path d="M5 12c2-3 5-3 7-1 2-2 5-2 7 1"/><path d="M5 18c2-3 5-3 7-1 2-2 5-2 7 1"/>'),
  cross:      I('<path d="M12 3v18M5 9h14"/>'),
  heart:      I('<path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.66l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21l8.84-8.62a5.5 5.5 0 0 0 0-7.78z"/>'),
  pen:        I('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  shield:     I('<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>'),
  globe:      I('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
  fish:       I('<path d="M2 12c4-6 14-6 18 0-4 6-14 6-18 0z"/><circle cx="16" cy="12" r="1"/>'),
  chart:      I('<path d="M3 21V3"/><path d="M7 17V11M11 17V7M15 17V13M19 17V9"/>'),
  hammer:     I('<path d="M14 8 6 16l4 4 8-8"/><path d="M14 8l4-4 6 6-4 4z"/>'),
  question:   I('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>'),
  /* ── New icons for expanded nav ─────────────────────────────────────── */
  music:      I('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  flame:      I('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
  bell:       I('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
  clipboard:  I('<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>'),
  notebook:   I('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="7" x2="17" y2="7"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="17" x2="13" y2="17"/>'),
  scales:     I('<path d="M12 3v18"/><path d="M3 7l9 3 9-3"/><path d="M3 17l9-3 9 3"/>'),
  dollar:     I('<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
  target:     I('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  clock:      I('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  userplus:   I('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>'),
  upload:     I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
  info:       I('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
  sprout:     I('<path d="M12 22V11"/><path d="M5 13c0-3 3-5 7-4 0 4-3 6-7 4z"/><path d="M19 9c0-3-3-5-7-4 0 4 3 6 7 4z"/>'),
  envelope:   I('<path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/>'),
  screen:     I('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4M8 21h8"/>'),
};

const SECTIONS = [
  /* ── Home ────────────────────────────────────────────────────────────── */
  {
    title: '',
    items: [{ name: 'the_good_shepherd', label: 'Home', icon: ICON.home }],
  },
  /* ── Word ────────────────────────────────────────────────────────────── */
  {
    title: 'Word',
    items: [
      { name: 'the_upper_room',        label: 'The Upper Room',     icon: ICON.flame },
      { name: 'the_growth',            label: 'Grow',               icon: ICON.sprout },
    ],
  },
  /* ── Comms ───────────────────────────────────────────────────────────── */
  {
    title: 'Comms',
    items: [
      { name: 'the_fellowship',        label: 'Fellowship',         icon: ICON.chat,      badge: 'fellowship' },
      { name: 'the_announcements',     label: 'Announcements',      icon: ICON.bullhorn },
      { name: 'the_prayer_chain',      label: 'Prayer Chain',       icon: ICON.hands },
    ],
  },
  /* ── Care ────────────────────────────────────────────────────────────── */
  {
    title: 'Care',
    items: [
      { name: 'the_fold',              label: 'The Fold',           icon: ICON.fold },
      { name: 'the_life',              label: 'Pastoral Care',      icon: ICON.heart,     badge: 'care' },
      { name: 'the_call_to_forgive',   label: 'Reconciliation',     icon: ICON.scales },
      { name: 'prayerful_action',      label: 'Prayer Journal',     icon: ICON.notebook },
      { name: 'the_seasons',           label: 'Seasons',            icon: ICON.calendar },
    ],
  },
  /* ── Worship ─────────────────────────────────────────────────────────── */
  {
    title: 'Worship',
    items: [
      { name: 'the_anatomy_of_worship', label: 'Service Order',     icon: ICON.clipboard },
      { name: 'quarterly_worship',       label: 'Worship Plan',      icon: ICON.music },
      { name: 'the_pentecost',           label: 'Special Services',  icon: ICON.flame },
      { name: 'music_stand',             label: 'FlockStand',       icon: ICON.music, href: 'app.stand/' },
      { name: 'the_feed',                label: 'Sermon Builder',    icon: ICON.pen,   href: 'app.feed/feed.html' },
      { name: 'flockshow',               label: 'FlockShow',         icon: ICON.screen, href: 'app.flockshow/app.flockshow.html' },
    ],
  },
  /* ── Mission ─────────────────────────────────────────────────────────── */
  {
    title: 'Mission',
    items: [
      { name: 'the_great_commission',  label: 'Missions',           icon: ICON.globe },
      { name: 'the_gospel_invitation', label: 'The Invitation',     icon: ICON.envelope },
      { name: 'the_harvest',           label: 'Harvest',            icon: ICON.harvest },
      { name: 'the_way',               label: 'The Way',            icon: ICON.cross },
      { name: 'the_truth',             label: 'Content',            icon: ICON.pen },
      { name: 'fishing_for_men',       label: 'Outreach',           icon: ICON.fish },
      { name: 'fishing_for_data',      label: 'Analytics',          icon: ICON.chart },
    ],
  },
  /* ── Stewardship ─────────────────────────────────────────────────────── */
  {
    title: 'Stewardship',
    items: [
      { name: 'the_gift_drift',        label: 'Giving',             icon: ICON.dollar },
      { name: 'the_weavers_plan',      label: "The Weaver's Plan",  icon: ICON.target },
    ],
  },
  /* ── Legacy ──────────────────────────────────────────────────────────── */
  {
    title: 'Legacy',
    items: [
      { name: 'the_generations',       label: 'The Generations',    icon: ICON.clock },
    ],
  },
  /* ── Build ───────────────────────────────────────────────────────────── */
  {
    title: 'Build',
    items: [
      { name: 'the_wall',                    label: 'Admin',          icon: ICON.shield },
      { name: 'bezalel',                     label: 'Bezalel',        icon: ICON.hammer },
      { name: 'content-admin',               label: 'Truth Editor',   icon: ICON.pen },
      { name: 'the_invitation',              label: 'Invitations',    icon: ICON.userplus },
      { name: 'software_deployment_referral', label: 'Deploy & Refer', icon: ICON.upload },
      { name: 'learn_more',                  label: 'Learn More',     icon: ICON.info },
      { name: 'about_flockos',               label: 'The Why',        icon: ICON.question },
    ],
  },
];

export function mountPillars(host) {
  if (!host) return;
  host.classList.add('veil-side');
  host.innerHTML = SECTIONS.map(_section).join('');

  const items = Array.from(host.querySelectorAll('.pillars-item'));
  items.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.href) {
        window.open(btn.dataset.href, '_blank', 'noopener');
        return;
      }
      go(btn.dataset.view).catch((err) => console.warn('[pillars]', err));
      document.body.classList.remove('veil-side-open');
    });
  });

  // Active highlighting
  function paintActive() {
    const cur = current() && current().name;
    items.forEach((b) => {
      const on = b.dataset.view === cur;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  paintActive();
  window.addEventListener('popstate', paintActive);
  // Re-check on a short interval — the_scribes doesn't broadcast yet.
  const tick = setInterval(paintActive, 700);

  // Badges
  _refreshBadges(host);
  // Refresh badges every 2 minutes — counts don't need real-time freshness
  // and this is the single biggest idle-cost reduction in the app.
  const badgeTick = setInterval(() => _refreshBadges(host), 120_000);
  // Allow views (the_life resolve, the_fellowship read) to ping us so badges
  // update immediately instead of waiting up to 2 minutes.
  const onBadgeRefresh = () => _refreshBadges(host);
  window.addEventListener('flockos:badges:refresh', onBadgeRefresh);
  // Real-time open-care-case count via Firestore onSnapshot. Updates the
  // badge immediately on any case create/resolve/reassign — no cache, no
  // off-by-one, no waiting for the 2-minute tick.
  const careUnsub = subscribeOpenCareCount((n) => {
    const el = host.querySelector('[data-badge="care"]');
    if (!el) return;
    if (n && n > 0) { el.textContent = n > 99 ? '99+' : String(n); el.hidden = false; }
    else { el.hidden = true; }
  });

  return () => {
    clearInterval(tick);
    clearInterval(badgeTick);
    window.removeEventListener('flockos:badges:refresh', onBadgeRefresh);
    try { careUnsub(); } catch (_) {}
  };
}

function _section(s) {
  const head = s.title ? `<div class="pillars-section">${s.title}</div>` : '';
  const slug = (s.title || 'home').toLowerCase().replace(/\s+/g, '-');
  const items = s.items.map((it) => `
    <button class="pillars-item" type="button" data-view="${it.name}" data-section="${slug}"${it.href ? ` data-href="${it.href}"` : ''}>
      <span class="pillars-icon" aria-hidden="true">${it.icon}</span>
      <span class="pillars-label">${it.label}</span>
      ${it.badge ? `<span class="pillars-badge" data-badge="${it.badge}" hidden></span>` : ''}
    </button>
  `).join('');
  return head + items;
}

async function _refreshBadges(host) {
  const set = (key, n) => {
    const el = host.querySelector(`[data-badge="${key}"]`);
    if (!el) return;
    if (n && n > 0) { el.textContent = n > 99 ? '99+' : String(n); el.hidden = false; }
    else { el.hidden = true; }
  };
  try { set('fellowship', _toN(await unreadTotal())); } catch (_) {}
  try { set('care',       _toN(await pendingCount())); } catch (_) {}
}
function _toN(v) {
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object' && typeof v.count === 'number') return v.count;
  return 0;
}
