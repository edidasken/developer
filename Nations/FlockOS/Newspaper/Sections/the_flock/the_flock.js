(function () {
  'use strict';

  const SECTION_KEY = 'the_flock';
  const STORAGE_KEY = 'newspaper:the_flock:cache';
  const SERVICE_WORKER_CANDIDATES = [
    '../../service-worker.js',
    '../../../service-worker.js',
    '../../sw.js',
    '../../../sw.js'
  ];

  const SUPPORT_SCRIPT_CANDIDATES = [
    '../../Scripts/the_true_vine.js'
  ];

  const FIREBASE_SCRIPT_CANDIDATES = [
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js'
  ];

  function getUpperRoomScriptCandidates() {
    return [];
  }

  const DEFAULT_DATA = {
    care: [
      {
        title: 'Morning care watch',
        summary: 'Check in on the households that asked for practical help this week.',
        details: 'Coordinate meals, rides, and follow-up calls. Mark any urgent needs for the next watch.',
        status: 'Active',
        updatedAt: 'Today'
      },
      {
        title: 'Hospital follow-up',
        summary: 'Continue care for those recovering and awaiting next steps.',
        details: 'Pray with the family, keep the contact list updated, and note any discharge changes.',
        status: 'Watching',
        updatedAt: 'Yesterday'
      }
    ],
    prayers: [
      {
        title: 'Peace for the anxious',
        summary: 'Lift those carrying stress, uncertainty, or grief.',
        details: 'Pray for steadied minds, gentle sleep, and the right help at the right time.',
        status: 'Prayer requested',
        updatedAt: 'Today'
      },
      {
        title: 'Praise for provision',
        summary: 'Give thanks for the needs already met and doors already opened.',
        details: 'Record testimonies and keep them near the front of the flock ledger.',
        status: 'Praise',
        updatedAt: 'This week'
      }
    ],
    songs: [],
    journal: []
  };

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((script) => script.src && script.src.indexOf(src) !== -1);
      if (existing) {
        if (window.TheVine || window.UpperRoom) {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load ' + src)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(script);
    });
  }

  async function ensureSupportScripts() {
    if (!window.TheVine) {
      for (const candidate of SUPPORT_SCRIPT_CANDIDATES) {
        try {
          await loadScript(candidate);
          if (window.TheVine) {
            break;
          }
        } catch (error) {
          // Try next candidate.
        }
      }
    }

    if (!window.firebase || !window.firebase.firestore) {
      for (const candidate of FIREBASE_SCRIPT_CANDIDATES) {
        try {
          await loadScript(candidate);
          if (window.firebase && window.firebase.firestore) {
            break;
          }
        } catch (error) {
          // Try next candidate.
        }
      }
    }

    if (!window.UpperRoom) {
      for (const candidate of getUpperRoomScriptCandidates()) {
        try {
          await loadScript(candidate);
          if (window.UpperRoom) {
            break;
          }
        } catch (error) {
          // Try next candidate.
        }
      }
    }

    if (window.UpperRoom && typeof window.UpperRoom.init === 'function') {
      try {
        await window.UpperRoom.init();
      } catch (error) {
        console.warn('[The Flock] UpperRoom.init() failed:', error);
      }
    }

    if (window.UpperRoom && typeof window.UpperRoom.authenticate === 'function') {
      try {
        await window.UpperRoom.authenticate();
      } catch (error) {
        console.warn('[The Flock] UpperRoom.authenticate() failed:', error);
      }
    }
  }

  function getAuthLevel() {
    if (window.FlockGates && typeof window.FlockGates.getUserRole === 'function') {
      return window.FlockGates.getUserRole();
    }
    return 2;
  }

  function initializeShell() {
    if (typeof window.initializeSectionShell !== 'function') {
      return;
    }

    try {
      window.initializeSectionShell({
        sectionId: SECTION_KEY,
        title: 'The Flock',
        authLevel: getAuthLevel(),
        pageRoot: document.getElementById('section-app')
      });
    } catch (error) {
      console.warn('[The Flock] Section shell bootstrap failed:', error);
    }
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    for (const candidate of SERVICE_WORKER_CANDIDATES) {
      try {
        await navigator.serviceWorker.register(candidate);
        return;
      } catch (error) {
        // Try the next candidate.
      }
    }
  }

  function setOfflineBannerVisible(visible) {
    const banner = document.getElementById('flock-offline-banner');
    if (!banner) {
      return;
    }
    banner.hidden = !visible;
  }

  function createCacheKey() {
    return STORAGE_KEY;
  }

  function readCachedData() {
    try {
      const raw = window.localStorage.getItem(createCacheKey());
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function writeCachedData(data) {
    try {
      window.localStorage.setItem(createCacheKey(), JSON.stringify(data));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function pickFirstCollection(source, keys) {
    if (!source || typeof source !== 'object') {
      return [];
    }

    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  function normalizeEntry(entry, fallbackStatus) {
    if (entry == null) {
      return {
        title: 'Untitled note',
        summary: '',
        details: '',
        status: fallbackStatus || 'Open',
        updatedAt: ''
      };
    }

    if (typeof entry === 'string') {
      return {
        title: entry,
        summary: '',
        details: '',
        status: fallbackStatus || 'Open',
        updatedAt: ''
      };
    }

    const title = entry.title || entry.name || entry.heading || entry.subject || 'Untitled note';
    const summary = entry.summary || entry.description || entry.note || entry.body || '';
    const details = entry.details || entry.content || entry.message || entry.body || summary || '';
    const status = entry.status || entry.state || fallbackStatus || 'Open';
    const updatedAt = entry.updatedAt || entry.updated || entry.time || entry.timestamp || '';

    return { title, summary, details, status, updatedAt };
  }

  function normalizeCollection(raw) {
    const care = pickFirstCollection(raw, ['care', 'careRequests', 'care_notes', 'careNotes']);
    const prayers = pickFirstCollection(raw, ['prayers', 'prayerRequests', 'prayer_notes', 'prayerNotes']);

    return {
      care: care.map((entry) => normalizeEntry(entry, 'Care')),
      prayers: prayers.map((entry) => normalizeEntry(entry, 'Prayer'))
    };
  }

  function extractRows(result) {
    if (Array.isArray(result)) {
      return result;
    }

    if (!result || typeof result !== 'object') {
      return [];
    }

    if (Array.isArray(result.rows)) {
      return result.rows;
    }

    if (Array.isArray(result.data)) {
      return result.data;
    }

    if (Array.isArray(result.items)) {
      return result.items;
    }

    if (Array.isArray(result.result)) {
      return result.result;
    }

    return [];
  }

  function normalizeLiveCollection(careSource, prayerSource, songsSource, journalSource) {
    return {
      care: extractRows(careSource).map((entry) => normalizeEntry(entry, 'Care')),
      prayers: extractRows(prayerSource).map((entry) => normalizeEntry(entry, 'Prayer')),
      songs: extractRows(songsSource).map((entry) => normalizeEntry(entry, 'Song')),
      journal: extractRows(journalSource).map((entry) => normalizeEntry(entry, 'Journal'))
    };
  }

  function createCollectionCard(title, subtitle, entries, emptyText) {
    const card = document.createElement('article');
    card.className = 'section-card';

    const header = document.createElement('header');
    header.className = 'card-header';

    const heading = document.createElement('h2');
    heading.textContent = title;

    const lead = document.createElement('p');
    lead.textContent = subtitle;

    header.appendChild(heading);
    header.appendChild(lead);
    card.appendChild(header);

    const list = document.createElement('ol');
    list.className = 'entry-list';
    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'drawer-empty';
      empty.textContent = String(emptyText || 'No data available yet.');
      list.appendChild(empty);
    } else {
      entries.forEach((entry) => list.appendChild(createEntryMarkup(entry)));
    }

    card.appendChild(list);
    return card;
  }

  function renderFirestoreCollections(data) {
    const main = document.getElementById('section-app');
    if (!main) {
      return;
    }

    const existing = document.getElementById('flock-firestore-collections');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const wrap = document.createElement('section');
    wrap.id = 'flock-firestore-collections';
    wrap.className = 'cards-grid';
    wrap.setAttribute('aria-label', 'Live Firestore collections');
    wrap.appendChild(createCollectionCard('Songs', 'Live worship songs from Firestore.', data.songs || [], 'No songs were returned from Firestore.'));
    wrap.appendChild(createCollectionCard('Journal', 'Private journal entries from Firestore.', data.journal || [], 'No journal entries were returned from Firestore.'));
    main.appendChild(wrap);
  }

  async function loadSectionData() {
    const upperRoom = window.UpperRoom;
    if (upperRoom) {
      try {
        const tasks = [
          upperRoom.listCareCases && typeof upperRoom.listCareCases === 'function'
            ? upperRoom.listCareCases({ limit: 6 })
            : Promise.resolve([]),
          upperRoom.listPrayers && typeof upperRoom.listPrayers === 'function'
            ? upperRoom.listPrayers({ limit: 6 })
            : Promise.resolve([]),
          upperRoom.listSongs && typeof upperRoom.listSongs === 'function'
            ? upperRoom.listSongs({ limit: 6 })
            : Promise.resolve([]),
          upperRoom.listJournal && typeof upperRoom.listJournal === 'function'
            ? upperRoom.listJournal({ limit: 6 })
            : Promise.resolve([])
        ];

        const [careResult, prayerResult, songsResult, journalResult] = await Promise.allSettled(tasks);
        const liveData = normalizeLiveCollection(
          careResult.status === 'fulfilled' ? careResult.value : DEFAULT_DATA.care,
          prayerResult.status === 'fulfilled' ? prayerResult.value : DEFAULT_DATA.prayers,
          songsResult.status === 'fulfilled' ? songsResult.value : DEFAULT_DATA.songs,
          journalResult.status === 'fulfilled' ? journalResult.value : DEFAULT_DATA.journal
        );
        if (liveData.care.length || liveData.prayers.length || liveData.songs.length || liveData.journal.length) {
          writeCachedData(liveData);
          return liveData;
        }
      } catch (error) {
        console.warn('[The Flock] Live Firestore load failed:', error);
      }
    }

    const manifest = window.NewspaperSections || {};
    const sectionManifest =
      manifest[SECTION_KEY] ||
      manifest.the_flock ||
      (manifest.sections && manifest.sections[SECTION_KEY]) ||
      {};

    if (sectionManifest && typeof sectionManifest.load === 'function') {
      const loaded = await sectionManifest.load();
      const normalized = normalizeCollection(loaded || {});
      writeCachedData(normalized);
      return Object.assign({}, DEFAULT_DATA, normalized);
    }

    if (sectionManifest && typeof sectionManifest.getData === 'function') {
      const loaded = await sectionManifest.getData();
      const normalized = normalizeCollection(loaded || {});
      writeCachedData(normalized);
      return Object.assign({}, DEFAULT_DATA, normalized);
    }

    const manifestData = normalizeCollection(sectionManifest.data || sectionManifest.content || sectionManifest.payload || sectionManifest || {});
    if (manifestData.care.length || manifestData.prayers.length) {
      writeCachedData(manifestData);
      return Object.assign({}, DEFAULT_DATA, manifestData);
    }

    const globals = normalizeCollection(
      window.__THE_FLOCK__ ||
        window.theFlockData ||
        window.the_flock ||
        (window.__SECTION_DATA__ && window.__SECTION_DATA__[SECTION_KEY]) ||
        window.__SECTION_DATA__ ||
        {}
    );
    if (globals.care.length || globals.prayers.length) {
      writeCachedData(globals);
      return Object.assign({}, DEFAULT_DATA, globals);
    }

    if (navigator.onLine) {
      const candidates = ['./the_flock.json', './data.json', './the_flock-data.json', './content.json'];
      for (const candidate of candidates) {
        try {
          const response = await fetch(candidate, { cache: 'no-store' });
          if (!response.ok) {
            continue;
          }
          const data = normalizeCollection(await response.json());
          if (data.care.length || data.prayers.length) {
            writeCachedData(data);
            return Object.assign({}, DEFAULT_DATA, data);
          }
        } catch (error) {
          // Try the next candidate.
        }
      }
    }

    const cached = readCachedData();
    if (cached) {
      return Object.assign({}, DEFAULT_DATA, normalizeCollection(cached));
    }

    return DEFAULT_DATA;
  }

  function createEntryMarkup(entry) {
    const item = document.createElement('li');
    item.className = 'entry-card';

    const head = document.createElement('div');
    head.className = 'entry-card__head';

    const title = document.createElement('h3');
    title.textContent = entry && entry.title ? String(entry.title) : 'Untitled note';

    const meta = document.createElement('div');
    meta.className = 'entry-card__meta';

    if (entry && entry.status) {
      const status = document.createElement('span');
      status.className = 'entry-status';
      status.textContent = String(entry.status);
      meta.appendChild(status);
    }

    if (entry && entry.updatedAt) {
      const updatedAt = document.createElement('span');
      updatedAt.className = 'entry-meta';
      updatedAt.textContent = 'Updated ' + String(entry.updatedAt);
      meta.appendChild(updatedAt);
    }

    head.appendChild(title);
    head.appendChild(meta);
    item.appendChild(head);

    if (entry && entry.summary) {
      const summary = document.createElement('p');
      summary.className = 'entry-summary';
      summary.textContent = String(entry.summary);
      item.appendChild(summary);
    }

    if (entry && entry.details) {
      const details = document.createElement('p');
      details.className = 'entry-details';
      details.textContent = String(entry.details);
      item.appendChild(details);
    }

    return item;
  }

  function renderList(container, entries) {
    if (!container) {
      return;
    }

    container.innerHTML = '';
    (entries || []).map(createEntryMarkup).forEach((node) => container.appendChild(node));
  }

  function renderDrawerList(container, entries, emptyLabel) {
    if (!container) {
      return;
    }

    if (!entries.length) {
      container.innerHTML = '';
      const empty = document.createElement('li');
      empty.className = 'drawer-empty';
      empty.textContent = String(emptyLabel || '');
      container.appendChild(empty);
      return;
    }

    container.innerHTML = '';
    entries.map(createEntryMarkup).forEach((node) => container.appendChild(node));
  }

  function closeAllDrawers() {
    document.querySelectorAll('.drawer.is-open').forEach((drawer) => {
      drawer.classList.remove('is-open');
      drawer.hidden = true;
      drawer.setAttribute('aria-hidden', 'true');
    });

    document.querySelectorAll('.drawer-backdrop').forEach((backdrop) => {
      backdrop.hidden = true;
    });
  }

  function openDrawer(drawerId) {
    const drawer = document.getElementById(drawerId);
    const backdrop = document.querySelector('.drawer-backdrop');
    if (!drawer) {
      return;
    }

    closeAllDrawers();
    drawer.hidden = false;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (backdrop) {
      backdrop.hidden = false;
    }
  }

  function bindDrawerControls() {
    document.querySelectorAll('[data-drawer-open]').forEach((button) => {
      button.addEventListener('click', () => openDrawer(button.getAttribute('data-drawer-open')));
    });

    document.querySelectorAll('[data-drawer-close]').forEach((button) => {
      button.addEventListener('click', closeAllDrawers);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAllDrawers();
      }
    });
  }

  async function initializePage() {
    await ensureSupportScripts();
    initializeShell();
    bindDrawerControls();

    const data = await loadSectionData();
    renderList(document.getElementById('care-list'), data.care);
    renderList(document.getElementById('prayer-list'), data.prayers);
    renderDrawerList(document.getElementById('care-drawer-list'), data.care, 'No care notes are available.');
    renderDrawerList(document.getElementById('prayer-drawer-list'), data.prayers, 'No prayer notes are available.');
    renderFirestoreCollections(data);

    setOfflineBannerVisible(!navigator.onLine);

    window.addEventListener('online', () => {
      setOfflineBannerVisible(false);
    });

    window.addEventListener('offline', async () => {
      setOfflineBannerVisible(true);
      const cached = readCachedData();
      if (cached) {
        const normalized = normalizeCollection(cached);
        renderList(document.getElementById('care-list'), normalized.care);
        renderList(document.getElementById('prayer-list'), normalized.prayers);
        renderDrawerList(document.getElementById('care-drawer-list'), normalized.care, 'No care notes are available.');
        renderDrawerList(document.getElementById('prayer-drawer-list'), normalized.prayers, 'No prayer notes are available.');
      }
    });

    registerServiceWorker().catch(() => {});
  }

  onReady(() => {
    initializePage().catch((error) => {
      console.error('[The Flock] Failed to initialize section:', error);
    });
  });
})();
