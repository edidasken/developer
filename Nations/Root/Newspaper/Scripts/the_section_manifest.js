/* ══════════════════════════════════════════════════════════════════════════════
   THE SECTION MANIFEST — canonical Newspaper registry
   Keeps every section on its own URL while exposing shared metadata for nav,
   auth filtering, shell bootstrap, and section lookup.
   ══════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /** @type {const} */
  const MANIFEST = [
    {
      id: 'herald',
      label: 'The Herald',
      shortLabel: 'Herald',
      url: '../herald/index.html',
      minRole: -1,
      publicAllowed: true,
      themeToken: '--gold',
      cssPath: '../../Styles/sections/herald.css',
      scriptPath: 'the_proclamation.js',
      layout: 'story',
      drawerEnabled: true,
      iconBg: '#7B4A28',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><rect x="10" y="6" width="8" height="4" rx="1"/><path d="M10 14h8M10 18h5"/></svg>',
    },
    {
      id: 'the_way',
      label: 'The Way',
      shortLabel: 'The Way',
      url: '../the_way/index.html',
      minRole: -1,
      publicAllowed: true,
      themeToken: '--accent',
      cssPath: '../../Styles/sections/the_way.css',
      scriptPath: 'the_way.js',
      layout: 'story',
      drawerEnabled: true,
      iconBg: '#2A7A4B',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"/><line x1="6" y1="8" x2="18" y2="8"/></svg>',
    },
    {
      id: 'the_sanctuary',
      label: 'The Sanctuary',
      shortLabel: 'Sanctuary',
      url: '../the_sanctuary/index.html',
      minRole: 3,
      publicAllowed: true,
      themeToken: '--lilac',
      cssPath: '../../Styles/sections/the_sanctuary.css',
      scriptPath: 'the_sanctuary.js',
      layout: 'grid',
      drawerEnabled: true,
      iconBg: '#2B4C8C',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4M10 4h4"/><path d="M4 10l8-6 8 6v11H4z"/><rect x="9" y="15" width="6" height="6"/></svg>',
    },
    {
      id: 'the_flock',
      label: 'The Flock',
      shortLabel: 'The Flock',
      url: '../the_flock/index.html',
      minRole: 2,
      publicAllowed: false,
      themeToken: '--mint',
      cssPath: '../../Styles/sections/the_flock.css',
      scriptPath: 'the_flock.js',
      layout: 'grid',
      drawerEnabled: true,
      iconBg: '#4A7A3A',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    },
    {
      id: 'the_mission',
      label: 'The Mission',
      shortLabel: 'Mission',
      url: '../the_mission/index.html',
      minRole: 4,
      publicAllowed: false,
      themeToken: '--peach',
      cssPath: '../../Styles/sections/the_mission.css',
      scriptPath: 'the_mission.js',
      layout: 'grid',
      drawerEnabled: true,
      iconBg: '#2A6A6A',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    },
    {
      id: 'the_family',
      label: 'The Family',
      shortLabel: 'Family',
      url: '../the_family/index.html',
      minRole: 0,
      publicAllowed: false,
      themeToken: '--sky',
      cssPath: '../../Styles/sections/the_family.css',
      scriptPath: 'the_family.js',
      layout: 'grid',
      drawerEnabled: true,
      iconBg: '#6B3A7A',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    },
    {
      id: 'the_shepherd',
      label: 'The Shepherd',
      shortLabel: 'Shepherd',
      url: '../the_shepherd/index.html',
      minRole: 4,
      publicAllowed: false,
      themeToken: '--warning',
      cssPath: '../../Styles/sections/the_shepherd.css',
      scriptPath: 'the_shepherd.js',
      layout: 'panel',
      drawerEnabled: true,
      iconBg: '#2A3C6A',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg>',
    },
    {
      id: 'the_calendar',
      label: 'The Calendar',
      shortLabel: 'Calendar',
      url: '../the_calendar/index.html',
      minRole: 0,
      publicAllowed: false,
      themeToken: '--success',
      cssPath: '../../Styles/sections/the_calendar.css',
      scriptPath: 'the_calendar.js',
      layout: 'panel',
      drawerEnabled: true,
      iconBg: '#8A5A20',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="8" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/></svg>',
    },
    {
      id: 'the_weavers',
      label: 'The Weavers',
      shortLabel: 'Weavers',
      url: '../the_weavers/index.html',
      minRole: 3,
      publicAllowed: false,
      themeToken: '--rose',
      cssPath: '../../Styles/sections/the_weavers.css',
      scriptPath: 'the_weavers.js',
      layout: 'panel',
      drawerEnabled: true,
      iconBg: '#7A2A3A',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
    },
  ];

  const MANIFEST_BY_ID = Object.create(null);
  const MANIFEST_BY_URL = Object.create(null);

  for (const section of MANIFEST) {
    MANIFEST_BY_ID[section.id] = section;
    MANIFEST_BY_URL[section.url] = section;
  }

  const SANCTUARY_LOGIN_TABS = new Set(['herald', 'the_way', 'the_sanctuary']);

  function getSectionManifest(sectionId) {
    if (!sectionId) return null;
    return MANIFEST_BY_ID[String(sectionId)] || null;
  }

  function getSectionManifests() {
    return MANIFEST.slice();
  }

  function getActiveSectionId(pathname) {
    const path = String(pathname || (typeof window !== 'undefined' && window.location ? window.location.pathname : '') || '');
    for (const section of MANIFEST) {
      if (path.includes('/' + section.id + '/')) return section.id;
    }
    return 'herald';
  }

  function isSectionVisible(section, authLevel) {
    if (!section) return false;
    const role = typeof authLevel === 'number' ? authLevel : -1;

    if (window._HERALD_SANCTUARY_LOGIN_REQUIRED) {
      return SANCTUARY_LOGIN_TABS.has(section.id);
    }

    if (role < section.minRole && !section.publicAllowed) {
      return false;
    }

    return true;
  }

  function buildSectionNav(activeSectionId, authLevel) {
    const nav = document.createElement('nav');
    nav.id = 'sec-nav';
    nav.className = 'sec-nav-bar';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Herald sections');

    const activeId = activeSectionId || getActiveSectionId();
    const role = typeof authLevel === 'number' ? authLevel : -1;

    for (const section of MANIFEST) {
      if (!isSectionVisible(section, role)) continue;

      const link = document.createElement('a');
      link.href = section.url;
      link.className = 'sec-nav-tab' + (section.id === activeId ? ' is-active' : '');
      link.setAttribute('role', 'tab');
      link.setAttribute('aria-selected', section.id === activeId ? 'true' : 'false');
      link.setAttribute('aria-label', section.label);
      link.dataset.sectionId = section.id;

      const icon = document.createElement('span');
      icon.className = 'tab-icon-badge';
      icon.style.setProperty('--badge-bg', section.iconBg);
      icon.innerHTML = section.svg;

      const label = document.createElement('span');
      label.textContent = section.shortLabel;

      link.appendChild(icon);
      link.appendChild(label);
      nav.appendChild(link);
    }

    const activeTab = nav.querySelector('.is-active');
    if (activeTab && typeof activeTab.scrollIntoView === 'function') {
      setTimeout(() => {
        try {
          activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } catch (_) {}
      }, 100);
    }

    return nav;
  }

  function getSectionFromUrl(url) {
    const candidate = String(url || '');
    return MANIFEST_BY_URL[candidate] || null;
  }

  const api = {
    sections: getSectionManifests(),
    getSectionManifest,
    getSectionManifests,
    getSectionFromUrl,
    getActiveSectionId,
    buildSectionNav,
    isSectionVisible,
  };

  if (typeof window !== 'undefined') {
    window.NewspaperSections = api;
    window.getSectionManifest = getSectionManifest;
    window.getSectionManifests = getSectionManifests;
    window.getSectionFromUrl = getSectionFromUrl;
    window.getActiveSectionId = getActiveSectionId;
    window.buildSectionNav = buildSectionNav;
    window.NewspaperSectionNav = buildSectionNav;
  }
})();
