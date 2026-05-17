/* ══════════════════════════════════════════════════════════════════════════════
   THE WELLSPRING — FlockOS Local Data Layer
   "Whoever drinks the water I give them will never thirst.
    Indeed, the water I give them will become in them a spring of water
    welling up to eternal life." — John 4:14

   Enables FlockOS to run entirely from a single local .xls/.xlsx file
   loaded via the browser, stored in IndexedDB, and served through TheVine's
   resolver hook — no backend server required.

   When activated, TheVine routes API calls through TheWellspring.resolve()
   instead of fetching from Google Apps Script endpoints. The cloud-hosted
   HTML/JS/CSS remain unchanged; only the data source changes.

   The single file contains all 200 tabs from the unified FlockOS Database
   spreadsheet — a complete local copy of the church's data.

   Usage:
     TheWellspring.enable()                 // Activate local mode
     TheWellspring.disable()                // Return to cloud mode
     TheWellspring.load(file)               // Import .xls file into IndexedDB
     TheWellspring.exportDB()               // Download all data as .xlsx
     TheWellspring.status()                 // { active, loaded, tabs, rows, fileName }
   ══════════════════════════════════════════════════════════════════════════════ */

const TheWellspring = (() => {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────
  const DB_NAME    = 'FlockOS_Wellspring';
  const DB_VERSION = 104; // 104 = New Covenant v1.04 — all three stores (sheets, meta, vault)
  const STORE_NAME = 'sheets';
  const META_STORE = 'meta';
  const META_KEY   = 'database';
  const LS_KEY     = 'flock_wellspring_mode';
  const VAULT_STORE = 'vault';
  const VAULT_KEY   = 'credentials';
  const VAULT_ITERATIONS = 100000;

  let _db = null;
  let _active = false;


  // ── IndexedDB Setup ──────────────────────────────────────────────────────

  function _openDB() {
    if (_db) return Promise.resolve(_db);
    // Guard: IndexedDB is unavailable in some private-browsing / iOS Safari modes
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      return Promise.reject(new Error('Wellspring: IndexedDB is not available in this browser/mode'));
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Remove stores from any previous schema (including old v2/v3 split)
        for (const name of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(name);
        }
        db.createObjectStore(STORE_NAME); // key = tab name
        db.createObjectStore(META_STORE); // key = 'database' → metadata
        db.createObjectStore(VAULT_STORE); // key = 'credentials' → encrypted blob
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror  = () => reject(new Error('Wellspring: IndexedDB open failed — ' + (req.error?.message || 'unknown error')));
      req.onblocked = () => console.warn('[Wellspring] IndexedDB upgrade blocked by an open tab — close other tabs and reload.');
    });
  }

  function _tx(storeName, mode) {
    return _db.transaction(storeName, mode).objectStore(storeName);
  }

  function _put(storeName, key, value) {
    return new Promise((resolve, reject) => {
      const req = _tx(storeName, 'readwrite').put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function _get(storeName, key) {
    return new Promise((resolve, reject) => {
      const req = _tx(storeName, 'readonly').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function _del(storeName, key) {
    return new Promise((resolve, reject) => {
      const req = _tx(storeName, 'readwrite').delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function _allKeys(storeName) {
    return new Promise((resolve, reject) => {
      const req = _tx(storeName, 'readonly').getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }


  // ── .xls/.xlsx Parser (SheetJS) ─────────────────────────────────────────

  /**
   * Parse an Excel file and store all worksheets into IndexedDB.
   * This creates a single-file local copy of the entire FlockOS database.
   * @param {File} file - File object from <input type="file">
   * @returns {Promise<{ tabs: string[], rowCounts: Object, totalRows: number }>}
   */
  async function load(file) {
    if (typeof XLSX === 'undefined') throw new Error('Wellspring: SheetJS (XLSX) library not loaded. Add the CDN script tag.');

    await _openDB();

    // Clear existing data
    const existingKeys = await _allKeys(STORE_NAME);
    for (const key of existingKeys) await _del(STORE_NAME, key);

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const tabs = workbook.SheetNames;
    const rowCounts = {};
    let totalRows = 0;

    for (const tabName of tabs) {
      const sheet = workbook.Sheets[tabName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      await _put(STORE_NAME, tabName, rows);
      rowCounts[tabName] = rows.length;
      totalRows += rows.length;
    }

    // Store metadata
    await _put(META_STORE, META_KEY, {
      loadedAt: new Date().toISOString(),
      fileName: file.name,
      fileSize: file.size,
      tabCount: tabs.length,
      totalRows: totalRows,
      tabs: tabs,
      rowCounts: rowCounts,
    });

    return { tabs, rowCounts, totalRows };
  }


  // ── JSON Parser (Native — no external deps!) ────────────────────────────

  /**
   * Load a JSON database directly into IndexedDB.
   * Expected format: { "TableName": [ {row1}, {row2}, ... ], ... }
   * @param {Object} data - Parsed JSON object with table names as keys
   * @returns {Promise<{ tabs: string[], rowCounts: Object, totalRows: number }>}
   */
  async function loadJSON(data) {
    await _openDB();

    // Clear existing data
    const existingKeys = await _allKeys(STORE_NAME);
    for (const key of existingKeys) await _del(STORE_NAME, key);

    const tabs = Object.keys(data);
    const rowCounts = {};
    let totalRows = 0;

    for (const tabName of tabs) {
      const rows = data[tabName];
      if (!Array.isArray(rows)) {
        throw new Error(`Invalid data format for table "${tabName}" — expected an array`);
      }
      await _put(STORE_NAME, tabName, rows);
      rowCounts[tabName] = rows.length;
      totalRows += rows.length;
    }

    // Store metadata
    await _put(META_STORE, META_KEY, {
      loadedAt: new Date().toISOString(),
      fileName: 'database.json',
      fileSize: JSON.stringify(data).length,
      tabCount: tabs.length,
      totalRows: totalRows,
      tabs: tabs,
      rowCounts: rowCounts,
    });

    return { tabs, rowCounts, totalRows };
  }


  // ── Data Access ──────────────────────────────────────────────────────────

  /**
   * Read all rows from a tab.
   * @param {string} tabName - worksheet name (e.g. 'Members', 'Books')
   * @returns {Promise<Array<Object>>}
   */
  async function getTab(tabName) {
    await _openDB();
    const data = await _get(STORE_NAME, tabName);
    return data || [];
  }

  /**
   * Find a row by its ID field (first column or 'id' key).
   * @returns {Promise<{ rowIndex: number, row: Object }|null>}
   */
  async function findById(tabName, id) {
    const rows = await getTab(tabName);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowId = row.id || row.Id || row.ID || Object.values(row)[0];
      if (String(rowId) === String(id)) {
        return { rowIndex: i, row };
      }
    }
    return null;
  }

  /**
   * Append a row to a tab.
   */
  async function appendRow(tabName, rowData) {
    const rows = await getTab(tabName);
    rows.push(rowData);
    await _put(STORE_NAME, tabName, rows);
    return rowData;
  }

  /**
   * Update a row by ID.
   */
  async function updateRow(tabName, id, updates) {
    const rows = await getTab(tabName);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowId = row.id || row.Id || row.ID || Object.values(row)[0];
      if (String(rowId) === String(id)) {
        Object.assign(rows[i], updates);
        await _put(STORE_NAME, tabName, rows);
        return rows[i];
      }
    }
    return null;
  }

  /**
   * Delete a row by ID.
   */
  async function deleteRow(tabName, id) {
    const rows = await getTab(tabName);
    const before = rows.length;
    const filtered = rows.filter(row => {
      const rowId = row.id || row.Id || row.ID || Object.values(row)[0];
      return String(rowId) !== String(id);
    });
    if (filtered.length === before) return false;
    await _put(STORE_NAME, tabName, filtered);
    return true;
  }


  // ── Action Resolver ──────────────────────────────────────────────────────

  /**
   * The main resolver function. Registered with TheVine.configure({ LOCAL_RESOLVER: resolve }).
   * @param {string} action - e.g. 'members.list', 'app.tab', 'auth.login'
   * @param {Object} params - action parameters
   * @returns {Promise<Object|undefined>} — return undefined to fall through to cloud
   */
  async function resolve(action, params) {
    params = params || {};

    // ── APP API — public content tabs ──
    if (action === 'app.tab') {
      const tabName = params.tab;
      if (!tabName) return { ok: false, error: 'Missing tab name' };
      const rows = await getTab(tabName);
      return rows; // APP API returns raw arrays
    }

    // ── Health check ──
    if (action === 'health') {
      return { ok: true, mode: 'local', source: 'TheWellspring', timestamp: new Date().toISOString() };
    }

    // ── Route by action pattern ──
    const parts = action.split('.');
    const entity = parts.length > 1 ? parts.slice(0, -1).join('.') : parts[0];
    const verb = parts[parts.length - 1];

    // Map entity to tab name
    const tabName = _entityToTab(entity);
    if (!tabName) return undefined; // unknown entity → fall through to cloud

    // ── CRUD routing ──
    switch (verb) {
      case 'list': {
        let rows = await getTab(tabName);
        rows = _applyFilters(rows, params);
        return { ok: true, data: rows, count: rows.length };
      }

      case 'get': {
        if (!params.id) return { ok: false, error: 'Missing id' };
        const found = await findById(tabName, params.id);
        if (!found) return { ok: false, error: 'Not found' };
        return { ok: true, data: found.row };
      }

      case 'create': {
        if (!params.id) params.id = _uuid();
        params.createdAt = params.createdAt || new Date().toISOString();
        params.updatedAt = params.updatedAt || params.createdAt;
        const newRow = await appendRow(tabName, params);
        return { ok: true, data: newRow };
      }

      case 'update': {
        if (!params.id) return { ok: false, error: 'Missing id' };
        params.updatedAt = new Date().toISOString();
        const updated = await updateRow(tabName, params.id, params);
        if (!updated) return { ok: false, error: 'Not found' };
        return { ok: true, data: updated };
      }

      case 'delete': {
        if (!params.id) return { ok: false, error: 'Missing id' };
        const deleted = await deleteRow(tabName, params.id);
        return { ok: deleted, message: deleted ? 'Deleted' : 'Not found' };
      }

      case 'search': {
        let rows = await getTab(tabName);
        if (params.q) {
          const q = String(params.q).toLowerCase();
          rows = rows.filter(r => JSON.stringify(Object.values(r)).toLowerCase().includes(q));
        }
        return { ok: true, data: rows, count: rows.length };
      }

      case 'summary':
      case 'dashboard': {
        const rows = await getTab(tabName);
        return { ok: true, data: rows, count: rows.length, source: 'local' };
      }

      default:
        return undefined; // fall through to cloud
    }
  }


  // ── Entity → Tab Name mapping ────────────────────────────────────────────

  function _entityToTab(entity) {
    const MAP = {
      // Core
      'auth':             'AuthUsers',
      'users':            'AuthUsers',
      'access':           'AccessControl',
      'config':           'AppConfig',
      'members':          'Members',
      'prayer':           'PrayerRequests',
      'journal':          'JournalEntries',
      'contacts':         'ContactLog',
      'notes':            'PastoralNotes',
      'milestones':       'Milestones',
      'households':       'Households',
      'todo':             'ToDo',
      'attendance':       'Attendance',
      'events':           'Events',
      'groups':           'SmallGroups',
      'audit':            'AuditLog',

      // Giving
      'giving':           'Giving',
      'giving.pledges':   'GivingPledges',

      // Volunteers
      'volunteers':       'VolunteerSchedule',

      // Communications
      'comms':            'CommsMessages',
      'comms.messages':   'CommsMessages',
      'comms.threads':    'CommsThreads',
      'comms.notifications': 'CommsNotifications',
      'comms.notifPrefs': 'CommsNotifPrefs',
      'comms.channels':   'CommsChannels',
      'comms.templates':  'CommsTemplates',
      'comms.readReceipts': 'CommsReadReceipts',
      'comms.broadcast':  'CommsBroadcasts',

      // Check-in
      'checkin':          'CheckInSessions',

      // Ministries
      'ministries':       'Ministries',
      'ministryMembers':  'MinistryMembers',

      // Service planning
      'servicePlans':     'ServicePlans',
      'serviceItems':     'ServicePlanItems',

      // Care
      'care':             'SpiritualCareCases',
      'care.interactions':'SpiritualCareInteractions',
      'care.followUps':   'SpiritualCareCases',
      'care.assignments': 'CareAssignments',

      // Outreach
      'outreach':         'OutreachContacts',
      'outreach.contacts':'OutreachContacts',
      'outreach.campaigns':'OutreachCampaigns',
      'outreach.followUps':'OutreachContacts',

      // Sermons
      'sermons':          'Sermons',
      'sermonSeries':     'SermonSeries',
      'sermonReviews':    'SermonReviews',

      // Songs
      'songs':            'Songs',

      // Compassion
      'compassion':           'CompassionRequests',
      'compassion.requests':  'CompassionRequests',
      'compassion.followUps': 'CompassionRequests',
      'compassion.resources': 'CompassionResources',
      'compassion.log':       'CompassionLog',

      // Discipleship
      'discipleship':               'DiscipleshipPaths',
      'discipleship.paths':         'DiscipleshipPaths',
      'discipleship.steps':         'DiscipleshipSteps',
      'discipleship.enrollments':   'DiscipleshipEnrollments',
      'discipleship.mentoring':     'DiscipleshipMentoring',
      'discipleship.meetings':      'DiscipleshipMeetings',
      'discipleship.assessments':   'DiscipleshipAssessments',
      'discipleship.resources':     'DiscipleshipResources',
      'discipleship.milestones':    'DiscipleshipMilestones',
      'discipleship.goals':         'DiscipleshipGoals',
      'discipleship.certificates':  'DiscipleshipCertificates',

      // Learning
      'learning':                 'LearningTopics',
      'learning.topics':          'LearningTopics',
      'learning.playlists':       'LearningPlaylists',
      'learning.playlistItems':   'LearningPlaylistItems',
      'learning.progress':        'LearningProgress',
      'learning.notes':           'LearningNotes',
      'learning.bookmarks':       'LearningBookmarks',
      'learning.recommendations': 'LearningRecommendations',
      'learning.quizzes':         'LearningQuizzes',
      'learning.quizResults':     'LearningQuizResults',
      'learning.certificates':    'LearningCertificates',
      'learning.sermons':         'Sermons',

      // Theology
      'theology':               'TheologyCategories',
      'theology.categories':    'TheologyCategories',
      'theology.sections':      'TheologySections',
      'theology.scriptures':    'TheologyScriptures',
      'theology.revisions':     'TheologyRevisions',

      // Member Cards
      'memberCards':       'MemberCards',
      'memberCards.links': 'MemberCardLinks',
      'memberCards.views': 'MemberCardViews',

      // Reports & User prefs
      'reports':           'Members',
      'user.preferences':  'UserProfiles',
      'church':            'AppConfig',
      'bulk':              'Members',

      // Missions
      'missions':              'MissionsRegistry',
      'missions.registry':     'MissionsRegistry',
      'missions.regions':      'MissionsRegions',
      'missions.cities':       'MissionsCities',
      'missions.partners':     'MissionsPartners',
      'missions.prayerFocus':  'MissionsPrayerFocus',
      'missions.updates':      'MissionsUpdates',
      'missions.teams':        'MissionsTeams',
      'missions.metrics':      'MissionsMetrics',

      // Statistics
      'statistics':            'StatisticsConfig',
      'statistics.config':     'StatisticsConfig',
      'statistics.snapshots':  'StatisticsSnapshots',
      'statistics.views':      'StatisticsViews',
    };

    return MAP[entity] || null;
  }


  // ── Filter helper ────────────────────────────────────────────────────────

  function _applyFilters(rows, params) {
    const skip = ['action', 'token', 'authEmail', 'email', '_', 'limit', 'offset'];
    const filters = {};
    for (const k of Object.keys(params)) {
      if (!skip.includes(k) && params[k] !== '' && params[k] != null) {
        filters[k] = String(params[k]).toLowerCase();
      }
    }
    if (Object.keys(filters).length === 0) return rows;

    return rows.filter(row => {
      for (const [key, val] of Object.entries(filters)) {
        const rowVal = row[key];
        if (rowVal == null) return false;
        if (String(rowVal).toLowerCase() !== val) return false;
      }
      return true;
    });
  }


  // ── UUID generator ───────────────────────────────────────────────────────

  function _uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }


  // ── Enable / Disable ────────────────────────────────────────────────────

  async function enable() {
    await _openDB();
    _active = true;
    localStorage.setItem(LS_KEY, 'true');
    if (typeof TheVine !== 'undefined') {
      TheVine.configure({ LOCAL_RESOLVER: resolve });
    }
    if (localStorage.getItem('FLOCKOS_DEBUG')) console.log('[Wellspring] Local data mode ENABLED');
  }

  function disable() {
    _active = false;
    localStorage.removeItem(LS_KEY);
    if (typeof TheVine !== 'undefined') {
      TheVine.configure({ LOCAL_RESOLVER: null });
    }
    if (localStorage.getItem('FLOCKOS_DEBUG')) console.log('[Wellspring] Local data mode DISABLED');
  }

  function isActive() {
    return _active;
  }


  // ── Export ───────────────────────────────────────────────────────────────

  /**
   * Export the entire local database to a single .xlsx file for download.
   * @returns {Promise<string>} the downloaded file name
   */
  async function exportDB() {
    if (typeof XLSX === 'undefined') throw new Error('Wellspring: SheetJS not loaded.');

    await _openDB();
    const meta = await _get(META_STORE, META_KEY);
    if (!meta || !meta.tabs) throw new Error('No local data loaded. Import a database file first.');

    const workbook = XLSX.utils.book_new();
    for (const tabName of meta.tabs) {
      const rows = await getTab(tabName);
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, tabName);
    }

    const fileName = 'FlockOS_Database_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    XLSX.writeFile(workbook, fileName);
    return fileName;
  }


  /**
   * Export the entire local database as JSON (much faster & smaller than Excel).
   * @returns {Promise<string>} the downloaded file name
   */
  async function exportJSON() {
    await _openDB();
    const meta = await _get(META_STORE, META_KEY);
    if (!meta || !meta.tabs) throw new Error('No local data loaded. Import a database file first.');

    // Build JSON object: { "TableName": [...rows], ... }
    const data = {};
    for (const tabName of meta.tabs) {
      data[tabName] = await getTab(tabName);
    }

    // Download as file
    const fileName = 'FlockOS_Database_' + new Date().toISOString().slice(0, 10) + '.json';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 250);
    return fileName;
  }


  // ── Export from Firestore ────────────────────────────────────────────────

  /**
   * Export all Firestore data to JSON and download as file.
   * Requires firebase/firestore to be loaded and initialized.
   * @param {object} firestore - initialized Firestore instance (from firebase.firestore())
   * @param {array} collections - array of collection names to export (e.g. ['Members', 'Books'])
   * @returns {Promise<string>} fileName
   */
  async function exportFromFirestore(firestore, collections) {
    if (!firestore || typeof firestore.collection !== 'function') {
      throw new Error('Invalid Firestore instance. Pass firebase.firestore().');
    }
    if (!Array.isArray(collections) || collections.length === 0) {
      throw new Error('Provide an array of collection names to export.');
    }

    const data = {};
    let totalDocs = 0;

    for (const collectionName of collections) {
      const snapshot = await firestore.collection(collectionName).get();
      const rows = [];
      snapshot.forEach(doc => {
        rows.push({ id: doc.id, ...doc.data() });
      });
      data[collectionName] = rows;
      totalDocs += rows.length;
    }

    // Download as file
    const fileName = 'FlockOS_Firestore_' + new Date().toISOString().slice(0, 10) + '.json';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 250);

    return { fileName, collections: collections.length, totalDocs };
  }


  // ── Import from URL ──────────────────────────────────────────────────────

  /**
   * Load JSON database from a URL (Google Drive, direct JSON URL, etc.).
   * Automatically converts Google Drive sharing links to direct download URLs.
   * @param {string} url - URL to JSON file
   * @returns {Promise<{ tabs: string[], rowCounts: Object, totalRows: number }>}
   */
  async function loadFromURL(url) {
    if (!url || typeof url !== 'string') throw new Error('Provide a valid URL');

    // Convert Google Drive sharing links to direct download
    // Format: https://drive.google.com/file/d/FILE_ID/view → https://drive.google.com/uc?export=download&id=FILE_ID
    let fetchURL = url;
    const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gdriveMatch) {
      fetchURL = `https://drive.google.com/uc?export=download&id=${gdriveMatch[1]}`;
    }

    // Fetch JSON
    const response = await fetch(fetchURL);
    if (!response.ok) {
      throw new Error(`Failed to fetch JSON from URL: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Load into IndexedDB using existing loadJSON function
    return await loadJSON(data);
  }


  // ── Status ───────────────────────────────────────────────────────────────

  async function status() {
    await _openDB();
    const meta = await _get(META_STORE, META_KEY);
    if (meta) {
      return {
        active: _active,
        loaded: true,
        fileName: meta.fileName,
        fileSize: meta.fileSize,
        tabCount: meta.tabCount,
        totalRows: meta.totalRows,
        loadedAt: meta.loadedAt,
      };
    }
    return { active: _active, loaded: false };
  }


  // ── Clear all data ───────────────────────────────────────────────────────

  async function clearAll() {
    await _openDB();
    const keys = await _allKeys(STORE_NAME);
    for (const key of keys) await _del(STORE_NAME, key);
    await _del(META_STORE, META_KEY);
  }


  // ── Auto-enable on page load if previously active ────────────────────────

  function _autoInit() {
    if (localStorage.getItem(LS_KEY) === 'true') {
      setTimeout(() => {
        enable().catch(e => {
          // IndexedDB unavailable (private browsing, iOS Safari, storage full).
          // Clear the flag so the app falls through to cloud mode instead of hanging.
          console.warn('[Wellspring] Auto-enable failed — clearing local-mode flag and falling back to cloud:', e.message);
          localStorage.removeItem(LS_KEY);
          _active = false;
        });
      }, 0);
    }
  }

  _autoInit();


  // ── Public Surface ───────────────────────────────────────────────────────

  return Object.freeze({
    // Core operations
    enable,
    disable,
    isActive,
    resolve,

    // Data import/export
    load,               // Excel (.xlsx/.xls) — requires SheetJS
    loadJSON,           // JSON (native, faster, no deps)
    loadFromURL,        // JSON from URL (Google Drive, direct link)
    exportDB,           // Export as Excel
    exportJSON,         // Export as JSON (recommended)
    exportFromFirestore, // Export Firestore → JSON file

    // Data access (for direct use if needed)
    getTab,
    findById,
    appendRow,
    updateRow,
    deleteRow,

    // Status & management
    status,
    clearAll,

    // Offline Vault (encrypted credential storage)
    vault: Object.freeze({
      setup:   _vaultSetup,
      unlock:  _vaultUnlock,
      exists:  _vaultExists,
      destroy: _vaultDestroy,
    }),
  });


  /* ═══════════════════════════════════════════════════════════════════════════
     OFFLINE VAULT — AES-GCM encrypted credential store
     PIN → PBKDF2 key → AES-GCM encrypt/decrypt session blob in IndexedDB.
     PIN is NEVER stored. Brute force is mitigated by PBKDF2 cost.
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * Setup: encrypt session with PIN and store in IndexedDB.
   * @param {string} pin — user-chosen 6+ digit PIN
   * @param {object} sessionData — session object (email, role, permissions, etc.)
   * @returns {Promise<void>}
   */
  async function _vaultSetup(pin, sessionData) {
    if (!pin || pin.length < 6) throw new Error('PIN must be at least 6 characters');
    await _openDB();
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv   = crypto.getRandomValues(new Uint8Array(12));
    var key  = await _deriveKey(pin, salt);
    var plain = new TextEncoder().encode(JSON.stringify(sessionData));
    var cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plain);
    var blob = {
      salt: Array.from(salt),
      iv: Array.from(iv),
      cipher: Array.from(new Uint8Array(cipher)),
      createdAt: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days default
    };
    return new Promise(function(resolve, reject) {
      var tx = _db.transaction(VAULT_STORE, 'readwrite');
      tx.objectStore(VAULT_STORE).put(blob, VAULT_KEY);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(new Error('Vault write failed')); };
    });
  }

  /**
   * Unlock: decrypt vault with PIN.
   * @param {string} pin
   * @returns {Promise<object>} decrypted session object
   */
  async function _vaultUnlock(pin) {
    await _openDB();
    var blob = await new Promise(function(resolve, reject) {
      var tx = _db.transaction(VAULT_STORE, 'readonly');
      var req = tx.objectStore(VAULT_STORE).get(VAULT_KEY);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(new Error('Vault read failed')); };
    });
    if (!blob) throw new Error('No vault found — set up offline access first');
    if (blob.expiresAt && Date.now() > blob.expiresAt) {
      await _vaultDestroy();
      throw new Error('Vault expired — please log in online to re-enable offline access');
    }
    var salt = new Uint8Array(blob.salt);
    var iv = new Uint8Array(blob.iv);
    var cipher = new Uint8Array(blob.cipher);
    var key = await _deriveKey(pin, salt);
    try {
      var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cipher);
      var session = JSON.parse(new TextDecoder().decode(plain));
      session.offline = true;
      session.offlineUnlockedAt = Date.now();
      return session;
    } catch(_) {
      throw new Error('Invalid PIN');
    }
  }

  /**
   * Check whether a vault exists.
   * @returns {Promise<boolean>}
   */
  async function _vaultExists() {
    try {
      await _openDB();
      var blob = await new Promise(function(resolve, reject) {
        var tx = _db.transaction(VAULT_STORE, 'readonly');
        var req = tx.objectStore(VAULT_STORE).get(VAULT_KEY);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { resolve(null); };
      });
      return !!blob && (!blob.expiresAt || Date.now() < blob.expiresAt);
    } catch(_) { return false; }
  }

  /**
   * Destroy the vault.
   * @returns {Promise<void>}
   */
  async function _vaultDestroy() {
    await _openDB();
    return new Promise(function(resolve, reject) {
      var tx = _db.transaction(VAULT_STORE, 'readwrite');
      tx.objectStore(VAULT_STORE).delete(VAULT_KEY);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(new Error('Vault delete failed')); };
    });
  }

  /**
   * Derive AES-256-GCM key from PIN via PBKDF2.
   */
  async function _deriveKey(pin, salt) {
    var raw = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: VAULT_ITERATIONS, hash: 'SHA-256' },
      raw,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

})();

// Expose to global scope for non-module scripts
if (typeof window !== 'undefined') {
  window.TheWellspring = TheWellspring;
}
