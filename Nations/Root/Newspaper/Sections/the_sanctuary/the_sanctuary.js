(function () {
  'use strict';

  const SECTION_KEY = 'the_sanctuary';
  const STORAGE_KEY = 'newspaper:the_sanctuary:leader-session';
  const SERVICE_WORKER_CANDIDATES = [
    '../../service-worker.js',
    '../../../service-worker.js',
    '../../sw.js',
    '../../../sw.js'
  ];
  const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  }

  function ensureSupportScripts() {
    return Promise.resolve();
  }

  function getAuthLevel() {
    if (window.FlockGates && typeof window.FlockGates.getUserRole === 'function') {
      return window.FlockGates.getUserRole();
    }
    return 3;
  }

  function initializeShell() {
    if (typeof window.initializeSectionShell !== 'function') {
      return;
    }

    try {
      window.initializeSectionShell({
        sectionId: SECTION_KEY,
        title: 'The Sanctuary',
        authLevel: getAuthLevel(),
        pageRoot: document.getElementById('sanctuary-app')
      });
    } catch (error) {
      console.warn('[The Sanctuary] Section shell bootstrap failed:', error);
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
    const banner = document.getElementById('sanctuary-offline-banner');
    if (!banner) {
      return;
    }
    banner.hidden = !visible;
  }

  function getGates() {
    return window.FlockGates || {};
  }

  function setNavLocked(locked) {
    const gates = getGates();

    if (locked) {
      if (typeof gates.lockNav === 'function') {
        gates.lockNav();
      } else if (typeof gates.setNavLocked === 'function') {
        gates.setNavLocked(true);
      }
      document.body.classList.add('nav-locked');
      return;
    }

    if (typeof gates.unlockNav === 'function') {
      gates.unlockNav();
    } else if (typeof gates.setNavLocked === 'function') {
      gates.setNavLocked(false);
    }
    document.body.classList.remove('nav-locked');
  }

  function normalizeStoredSession(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    if (typeof payload.unlockedAt === 'number' && Date.now() - payload.unlockedAt <= SESSION_TTL_MS) {
      return payload;
    }

    return null;
  }

  function readStoredSession() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return normalizeStoredSession(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  function writeStoredSession(payload) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function clearStoredSession() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function setOverlayVisible(visible) {
    const overlay = document.getElementById('leader-overlay');
    const content = document.getElementById('sanctuary-content');
    const chip = document.getElementById('sanctuary-access-chip');
    const copy = document.getElementById('sanctuary-status-copy');

    if (overlay) {
      overlay.hidden = !visible;
    }

    if (content) {
      content.setAttribute('aria-hidden', String(visible));
    }

    if (chip) {
      chip.textContent = visible ? 'Locked' : 'Unlocked';
      chip.classList.toggle('is-locked', visible);
      chip.classList.toggle('is-unlocked', !visible);
    }

    if (copy) {
      copy.textContent = visible
        ? 'Enter the leader access code to unlock the room and release the nav lock.'
        : 'Leader access confirmed. Navigation is available and the sanctuary is open.';
    }

    document.body.classList.toggle('nav-locked', visible);
  }

  function showAuthError(message) {
    const errorNode = document.getElementById('leader-auth-error');
    if (!errorNode) {
      return;
    }
    errorNode.textContent = message;
    errorNode.hidden = !message;
  }

  function getAccessCodeInput() {
    return document.getElementById('leader-access-code');
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

  function normalizeSummaryEntry(entry, fallbackTitle) {
    if (!entry || typeof entry !== 'object') {
      return {
        title: String(fallbackTitle || 'Untitled item'),
        summary: '',
        updatedAt: ''
      };
    }

    return {
      title: String(entry.title || entry.name || entry.heading || entry.subject || entry.songTitle || entry.sermonTitle || entry.planName || fallbackTitle || 'Untitled item'),
      summary: String(entry.summary || entry.description || entry.note || entry.body || entry.scripture || entry.ref || ''),
      updatedAt: String(entry.updatedAt || entry.updated || entry.time || entry.timestamp || '')
    };
  }

  function buildSummaryList(rows, emptyText) {
    const list = document.createElement('ol');
    list.className = 'entry-list';

    if (!rows.length) {
      const empty = document.createElement('li');
      empty.className = 'drawer-empty';
      empty.textContent = String(emptyText || 'No data available yet.');
      list.appendChild(empty);
      return list;
    }

    rows.forEach((row) => {
      const item = normalizeSummaryEntry(row);
      const li = document.createElement('li');
      li.className = 'entry-card';

      const head = document.createElement('div');
      head.className = 'entry-card__head';

      const title = document.createElement('h3');
      title.textContent = item.title;

      const meta = document.createElement('div');
      meta.className = 'entry-card__meta';

      if (item.updatedAt) {
        const updatedAt = document.createElement('span');
        updatedAt.className = 'entry-meta';
        updatedAt.textContent = 'Updated ' + item.updatedAt;
        meta.appendChild(updatedAt);
      }

      head.appendChild(title);
      head.appendChild(meta);
      li.appendChild(head);

      if (item.summary) {
        const summary = document.createElement('p');
        summary.className = 'entry-summary';
        summary.textContent = item.summary;
        li.appendChild(summary);
      }

      list.appendChild(li);
    });

    return list;
  }

  function buildDataCard(title, subtitle, rows, emptyText) {
    const card = document.createElement('article');
    card.className = 'section-card sanctuary-card';

    const header = document.createElement('header');
    header.className = 'card-header';

    const heading = document.createElement('h2');
    heading.textContent = title;

    const lead = document.createElement('p');
    lead.textContent = subtitle;

    header.appendChild(heading);
    header.appendChild(lead);
    card.appendChild(header);
    card.appendChild(buildSummaryList(rows, emptyText));

    return card;
  }

  function renderLiveDashboard(data) {
    const content = document.getElementById('sanctuary-content');
    if (!content) {
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'sanctuary-grid';

    grid.appendChild(buildDataCard('Sermons', 'Live preached sermons from Firestore.', data.sermons, 'No preached sermons found yet.'));
    grid.appendChild(buildDataCard('Songs', 'Live songs and worship sets from Firestore.', data.songs, 'No songs were returned.'));
    grid.appendChild(buildDataCard('Service Plans', 'Live service planning records from Firestore.', data.servicePlans, 'No service plans found yet.'));
    grid.appendChild(buildDataCard('Journal Entries', 'Private journal entries from Firestore.', data.journal, 'No journal entries were returned.'));

    content.innerHTML = '';
    content.appendChild(grid);
    content.setAttribute('aria-hidden', 'false');
  }

  function normalizeLiveResult(result) {
    return extractRows(result).map((entry) => normalizeSummaryEntry(entry));
  }

  async function loadLiveDashboard() {
    const upperRoom = window.UpperRoom;
    if (!upperRoom) {
      return null;
    }

    const tasks = [
      upperRoom.listSermons && typeof upperRoom.listSermons === 'function'
        ? upperRoom.listSermons({ status: 'Preached', limit: 6 })
        : Promise.resolve([]),
      upperRoom.listSongs && typeof upperRoom.listSongs === 'function'
        ? upperRoom.listSongs({ limit: 6 })
        : Promise.resolve([]),
      upperRoom.listServicePlans && typeof upperRoom.listServicePlans === 'function'
        ? upperRoom.listServicePlans({ limit: 6 })
        : Promise.resolve([]),
      upperRoom.listJournal && typeof upperRoom.listJournal === 'function'
        ? upperRoom.listJournal({ limit: 6 })
        : Promise.resolve([])
    ];

    const [sermons, songs, servicePlans, journal] = await Promise.allSettled(tasks);

    return {
      sermons: normalizeLiveResult(sermons.status === 'fulfilled' ? sermons.value : []),
      songs: normalizeLiveResult(songs.status === 'fulfilled' ? songs.value : []),
      servicePlans: normalizeLiveResult(servicePlans.status === 'fulfilled' ? servicePlans.value : []),
      journal: normalizeLiveResult(journal.status === 'fulfilled' ? journal.value : [])
    };
  }

  async function verifyLeaderAccess(code) {
    const gates = getGates();
    const input = String(code || '').trim();

    if (typeof gates.authenticateLeader === 'function') {
      return !!(await gates.authenticateLeader(input, { section: SECTION_KEY }));
    }

    if (typeof gates.requestLeaderAccess === 'function') {
      return !!(await gates.requestLeaderAccess(input, { section: SECTION_KEY }));
    }

    if (typeof gates.verifyLeaderAccess === 'function') {
      return !!(await gates.verifyLeaderAccess(input, { section: SECTION_KEY }));
    }

    if (typeof gates.validateLeader === 'function') {
      return !!(await gates.validateLeader(input, { section: SECTION_KEY }));
    }

    if (typeof gates.checkLeaderKey === 'function') {
      return !!(await gates.checkLeaderKey(input, { section: SECTION_KEY }));
    }

    if (typeof gates.getLeaderKey === 'function') {
      const expected = await gates.getLeaderKey({ section: SECTION_KEY });
      return input === String(expected || '').trim();
    }

    if (typeof gates.leaderKey === 'string' && gates.leaderKey.trim()) {
      return input === gates.leaderKey.trim();
    }

    if (typeof gates.accessCode === 'string' && gates.accessCode.trim()) {
      return input === gates.accessCode.trim();
    }

    // Fallback for environments without a configured gate helper.
    return input.length >= 4;
  }

  function applyUnlockedState() {
    setNavLocked(false);
    setOverlayVisible(false);
    showAuthError('');
    writeStoredSession({ unlockedAt: Date.now() });

    loadLiveDashboard()
      .then((data) => {
        if (data) {
          renderLiveDashboard(data);
        }
      })
      .catch((error) => {
        console.warn('[The Sanctuary] Live dashboard load failed:', error);
      });
  }

  function applyLockedState() {
    setNavLocked(true);
    setOverlayVisible(true);

    window.requestAnimationFrame(() => {
      const input = getAccessCodeInput();
      if (input) {
        input.focus();
      }
    });
  }

  function openSanctuary() {
    const session = readStoredSession();
    if (session) {
      applyUnlockedState();
      return true;
    }

    applyLockedState();
    return false;
  }

  function bindAuthForm() {
    const form = document.getElementById('leader-auth-form');
    const input = getAccessCodeInput();
    if (!form || !input) {
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      showAuthError('');

      const code = input.value.trim();
      if (!code) {
        showAuthError('Enter the access code to continue.');
        input.focus();
        return;
      }

      try {
        const authorized = await verifyLeaderAccess(code);
        if (!authorized) {
          showAuthError('That code did not unlock the sanctuary.');
          input.select();
          return;
        }

        applyUnlockedState();
      } catch (error) {
        console.warn('[The Sanctuary] Leader verification failed:', error);
        showAuthError('Unable to verify access right now.');
      }
    });
  }

  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('nav-locked')) {
        const input = getAccessCodeInput();
        if (input) {
          input.focus();
        }
      }
    });
  }

  async function initializePage() {
    await ensureSupportScripts();
    initializeShell();
    bindAuthForm();
    bindKeyboardShortcuts();

    const storedSession = readStoredSession();
    if (storedSession) {
      applyUnlockedState();
    } else {
      applyLockedState();
    }

    setOfflineBannerVisible(!navigator.onLine);

    window.addEventListener('online', () => {
      setOfflineBannerVisible(false);
    });

    window.addEventListener('offline', () => {
      setOfflineBannerVisible(true);
    });

    registerServiceWorker().catch(() => {});

    // If the gate helper can auto-resolve access without a stored session, honor it.
    try {
      const gates = getGates();
      if (typeof gates.hasLeaderAccess === 'function' && gates.hasLeaderAccess()) {
        applyUnlockedState();
      }
    } catch (error) {
      // Ignore gate helper errors and keep the existing state.
    }
  }

  onReady(() => {
    initializePage().catch((error) => {
      console.error('[The Sanctuary] Failed to initialize section:', error);
    });
  });
})();
