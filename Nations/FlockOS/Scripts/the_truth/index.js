/* ══════════════════════════════════════════════════════════════════════════════
   THE TRUTH — FlockOS Content Editor (Firestore-backed)
   Full CRUD interface for all public-content tabs:
   Books, Theology, Genealogy, Counseling, Devotionals, Reading Plan, Lexicon,
   Heart Check, Mirror, Quiz, Apologetics.

   Data source:
     ROOT deployment → flockos-truth Firestore (the seed database)
     Church deployments → each church's own Firestore project
       (set window.FLOCK_TRUTH_USE_LOCAL = true before loading this script)

   Restricted to: Pastor + Admin roles only.

   "Sanctify them by the truth; your word is truth." — John 17:17
   ══════════════════════════════════════════════════════════════════════════════ */


  // ── Helpers (self-contained so this module has no internal dependencies) ──

  function _e(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _spinner() {
    return '<div style="text-align:center;padding:60px 20px;color:var(--ink-muted);">'
         + '<div style="margin:0 auto 16px;width:32px;height:32px;border:3px solid var(--line);'
         + 'border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite;"></div>'
         + 'Loading\u2026</div>';
  }

  function _errHtml(msg) {
    return '<div style="padding:24px;text-align:center;color:var(--danger);">'
         + '<p style="font-size:1rem;font-weight:600;">Error</p>'
         + '<p style="font-size:0.85rem;">' + _e(msg) + '</p></div>';
  }

  function _empty(icon, title, desc) {
    return '<div style="text-align:center;padding:60px 20px;color:var(--ink-muted);">'
         + '<div style="font-size:2.5rem;margin-bottom:12px;">' + icon + '</div>'
         + '<h2 style="font-size:1.1rem;margin-bottom:6px;color:var(--ink);">' + _e(title) + '</h2>'
         + '<p style="font-size:0.85rem;">' + _e(desc) + '</p></div>';
  }

  function _toast(msg, type) {
    if (typeof Modules !== 'undefined' && Modules._toast) { Modules._toast(msg, type); return; }
    alert(msg);
  }

  // ── State ─────────────────────────────────────────────────────────────────

  var _tab     = 'books';
  var _pages   = {};   // current page per tab key (1-based)
  var _allRows = {};   // full cached row set per tab key; cleared on save/delete
  var PAGE_SIZE = 50;

  // ── Firestore connection ──────────────────────────────────────────────────
  // ROOT: connects to flockos-truth (the seed database) via secondary Firebase app.
  // Churches: set window.FLOCK_TRUTH_USE_LOCAL = true to reuse UpperRoom's Firebase.

  var TRUTH_CONFIG = {
    apiKey:            'AIzaSyBZIZpYixNDpeRagDF_SozCvC8lJKTubHY',
    authDomain:        'flockos-truth.firebaseapp.com',
    projectId:         'flockos-truth',
    storageBucket:     'flockos-truth.firebasestorage.app',
    messagingSenderId: '102743161422',
    appId:             '1:102743161422:web:a81ca3c70b13546962611f'
  };

  var _truthDb    = null;
  var _truthReady = false;

  // ── Truth cache — weekly refresh every Monday at 6AM Pacific ─────────────
  // Offline persistence stores all truth reads in IndexedDB. Subsequent loads
  // serve from cache (zero Firestore reads) until the weekly refresh window.
  // Only applies to the ROOT flockos-truth database (not church-local deployments).

  var TRUTH_CACHE_KEY = 'flock_truth_refreshed';

  // Returns the UTC millisecond timestamp of the most recent Monday 6:00 AM Pacific.
  // DST-aware via Intl.DateTimeFormat with America/Los_Angeles.
  function _lastMonday6amPacificMs() {
    var now = Date.now();
    var fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'short', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', hour12: false
    });
    var parts = fmt.formatToParts(new Date(now));
    var get = function(type) {
      var p = parts.find(function(x) { return x.type === type; });
      return p ? p.value : '0';
    };
    var wd = get('weekday'); // 'Mon', 'Tue', etc.
    var yr = +get('year');
    var mo = +get('month') - 1;
    var dy = +get('day');
    var hr = +get('hour'); // 0-23

    // Days since last Monday (Mon=0, Tue=1, ..., Sun=6)
    var wdMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    var daysBack = (wdMap[wd] != null) ? wdMap[wd] : 0;
    // If today IS Monday but before 6AM, roll back 7 more days to previous Monday
    if (daysBack === 0 && hr < 6) daysBack = 7;

    // Calendar date of last Monday in Pacific time
    var monUTC = Date.UTC(yr, mo, dy - daysBack);
    var monDate = new Date(monUTC);
    var monYr = monDate.getUTCFullYear();
    var monMo = monDate.getUTCMonth();
    var monDy = monDate.getUTCDate();

    // Find UTC equivalent of Pacific 6:00 AM on that Monday.
    // Sample noon UTC on that day, read back as Pacific hour to get DST offset.
    var noonUTC = Date.UTC(monYr, monMo, monDy, 12, 0, 0);
    var noonFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', hour: '2-digit', hour12: false
    });
    var noonPacHr = +noonFmt.format(new Date(noonUTC)); // how many Pacific hours from midnight noon is
    var offsetHrs = noonPacHr - 12; // Pacific is UTC + offsetHrs (negative, e.g. -7 or -8)
    // Pacific 6AM → UTC = 6 - offsetHrs
    return Date.UTC(monYr, monMo, monDy, 6 - offsetHrs, 0, 0);
  }

  // Returns 'server' if a weekly refresh is due, 'cache' if still fresh.
  // Call setTruthRefreshed() after a successful server fetch.
  function _truthFetchSource() {
    try {
      var last = parseInt(localStorage.getItem(TRUTH_CACHE_KEY) || '0', 10);
      return (last < _lastMonday6amPacificMs()) ? 'server' : 'cache';
    } catch (_) {
      return 'server'; // localStorage unavailable (private browsing edge case)
    }
  }

  function _markTruthRefreshed() {
    try { localStorage.setItem(TRUTH_CACHE_KEY, String(Date.now())); } catch (_) {}
  }

  // ── Live bundle cache — for app renderers (the_way.js) ───────────────────
  // After each save/delete the record is merged into a localStorage bundle so
  // the Learning Hub picks up the change immediately without a redeploy.
  // A full Firestore sync is done in the background when a bundle is stale.
  // the_way.js renderers call TheTruth.liveBundle(key) to get fresh data.

  var BUNDLE_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  var BUNDLE_TABS = ['devotionals', 'counseling', 'quiz', 'words', 'apologetics', 'books', 'genealogy', 'theology', 'teachingPlans'];

  function _bundleKey(k)   { return 'flock_bundle_' + k; }
  function _bundleTsKey(k) { return 'flock_bundle_' + k + '_ts'; }

  function _isBundleStale(k) {
    try {
      var ts = parseInt(localStorage.getItem(_bundleTsKey(k)) || '0', 10);
      return !ts || (Date.now() - ts) > BUNDLE_STALE_MS;
    } catch (_) { return true; }
  }

  // Merge one record into the localStorage bundle array (no Firestore read needed)
  function _patchBundleRecord(k, docId, data) {
    try {
      var raw = localStorage.getItem(_bundleKey(k));
      if (!raw) return; // bundle not yet initialised — skip; full sync will populate
      var arr = JSON.parse(raw);
      var idx = arr.findIndex(function(r) { return r._docId === docId; });
      var rec = Object.assign({}, data, { _docId: docId });
      if (idx >= 0) arr[idx] = rec; else arr.push(rec);
      localStorage.setItem(_bundleKey(k), JSON.stringify(arr));
    } catch (_) {}
  }

  // Remove a record from the localStorage bundle
  function _dropBundleRecord(k, docId) {
    try {
      var raw = localStorage.getItem(_bundleKey(k));
      if (!raw) return;
      var arr = JSON.parse(raw).filter(function(r) { return r._docId !== docId; });
      localStorage.setItem(_bundleKey(k), JSON.stringify(arr));
    } catch (_) {}
  }

  // Full sync: pull all docs for one collection → localStorage.
  // Returns the record count, or 0 on error.
  export async function syncBundle(tabKey) {
    try {
      await _initTruth();
      var snap = await _truthDb.collection(tabKey).get({ source: 'server' });
      var arr = snap.docs.map(function(doc) {
        var d = doc.data();
        d._docId = doc.id;
        return d;
      });
      localStorage.setItem(_bundleKey(tabKey), JSON.stringify(arr));
      localStorage.setItem(_bundleTsKey(tabKey), String(Date.now()));
      return arr.length;
    } catch (e) {
      console.warn('[TheTruth] syncBundle failed for', tabKey, e.message);
      return 0;
    }
  }

  // Silently re-sync every bundle that has gone stale (called on editor open).
  async function _syncStaleInBackground() {
    for (var i = 0; i < BUNDLE_TABS.length; i++) {
      var k = BUNDLE_TABS[i];
      if (_isBundleStale(k)) {
        await syncBundle(k);
      }
    }
  }

  // Public: return parsed bundle array from localStorage, or null if absent.
  export function liveBundle(tabKey) {
    try {
      var raw = localStorage.getItem(_bundleKey(tabKey));
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  // Public: return ISO string of last full sync, or null.
  export function bundleLastSynced(tabKey) {
    try {
      var ts = parseInt(localStorage.getItem(_bundleTsKey(tabKey)) || '0', 10);
      return ts ? new Date(ts).toISOString() : null;
    } catch (_) { return null; }
  }

  async function _initTruth() {
    if (_truthReady) return;
    if (typeof firebase === 'undefined') throw new Error('Firebase SDK not loaded');

    if (window.FLOCK_TRUTH_USE_LOCAL) {
      // Church deployment: reuse the existing Firebase app (UpperRoom's project)
      _truthDb = firebase.firestore();
    } else {
      // ROOT: secondary Firebase app for flockos-truth (the seed database)
      var truthApp = null;
      try { truthApp = firebase.app('truth'); } catch (_) {}
      if (!truthApp) truthApp = firebase.initializeApp(TRUTH_CONFIG, 'truth');
      _truthDb = firebase.firestore(truthApp);
      try { _truthDb.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (_) {}

      // Enable offline persistence so reads are served from IndexedDB when cache is fresh.
      // synchronizeTabs: false — truth data is read-only for most users; single-tab is fine.
      try { await _truthDb.enablePersistence({ synchronizeTabs: false }); } catch (_) {}

      // Sign in anonymously for write access
      var truthAuth = firebase.auth(truthApp);
      if (!truthAuth.currentUser) {
        await truthAuth.signInAnonymously();
      }
    }
    _truthReady = true;
  }

  // ── Tab definitions (Firestore field names) ───────────────────────────────
  // Each field's `k` matches the Firestore document field name exactly.

  var TABS = [
    { key: 'books', name: 'Books', idField: 'bookName',
      listCols: ['bookName', 'testament', 'genre'],
      fields: [
        { k: 'bookName',             label: 'Book Name',             type: 'text',     required: true },
        { k: 'testament',            label: 'Testament',             type: 'select',   opts: ['Old', 'New'] },
        { k: 'genre',                label: 'Genre',                 type: 'text' },
        { k: 'summary',              label: 'Summary',               type: 'textarea' },
        { k: 'coreTheology',         label: 'Core Theology',         type: 'textarea' },
        { k: 'practicalApplication', label: 'Practical Application', type: 'textarea' },
      ]
    },
    { key: 'theology', name: 'Theology', idField: 'sectionTitle',
      listCols: ['categoryTitle', 'sectionTitle', 'status'],
      fields: [
        { k: 'categoryTitle',    label: 'Category Title',           type: 'text',     required: true },
        { k: 'categorySubtitle', label: 'Category Subtitle',        type: 'text' },
        { k: 'categoryIntro',    label: 'Category Intro',           type: 'textarea' },
        { k: 'categoryIcon',     label: 'Category Icon (emoji)',    type: 'text' },
        { k: 'categoryColor',    label: 'Category Color (CSS var)', type: 'text' },
        { k: 'sectionTitle',     label: 'Section Title',            type: 'text',     required: true },
        { k: 'content',          label: 'Content',                  type: 'textarea' },
        { k: 'summary',          label: 'Summary',                  type: 'textarea' },
        { k: 'scriptureRefs',    label: 'Scripture References',     type: 'text' },
        { k: 'keywords',         label: 'Keywords',                 type: 'text' },
        { k: 'status',           label: 'Status',                   type: 'select',   opts: ['Draft', 'Approved', 'Review'] },
        { k: 'approvedBy',       label: 'Approved By',              type: 'text' },
        { k: 'approvedAt',       label: 'Approved At',              type: 'text' },
      ]
    },
    { key: 'teachingPlans', name: 'Teaching Plans', idField: 'sessionTitle',
      listCols: ['planTitle', 'sessionNumber', 'sessionTitle', 'status'],
      fields: [
        { k: 'planId',          label: 'Plan ID (slug)',                       type: 'text',     required: true },
        { k: 'planTitle',       label: 'Plan Title',                           type: 'text',     required: true },
        { k: 'planDescription', label: 'Plan Description / Format',            type: 'textarea' },
        { k: 'planAudience',    label: 'Plan Audience',                        type: 'text' },
        { k: 'planGoal',        label: 'Plan Goal',                            type: 'textarea' },
        { k: 'sessionNumber',   label: 'Session Number',                       type: 'text',     required: true },
        { k: 'sessionTitle',    label: 'Session Title',                        type: 'text',     required: true },
        { k: 'memoryVerse',     label: 'Memory Verse',                         type: 'textarea' },
        { k: 'memoryVerseRef',  label: 'Memory Verse Reference',               type: 'text' },
        { k: 'outcome',         label: 'Outcome',                              type: 'textarea' },
        { k: 'durationMinutes', label: 'Duration (minutes)',                   type: 'text' },
        { k: 'segments',        label: 'Segments (JSON — prefer the importer)', type: 'textarea' },
        { k: 'scriptureRefs',   label: 'Scripture References',                 type: 'text' },
        { k: 'tags',            label: 'Tags (comma-separated)',               type: 'text' },
        { k: 'status',          label: 'Status',                               type: 'select',   opts: ['Draft', 'Approved', 'Review'] },
        { k: 'approvedBy',      label: 'Approved By',                          type: 'text' },
        { k: 'approvedAt',      label: 'Approved At',                          type: 'text' },
      ]
    },
    { key: 'genealogy', name: 'Genealogy', idField: 'name',
      listCols: ['name', 'title', 'lifespan'],
      fields: [
        { k: 'name',      label: 'Name',                       type: 'text',     required: true },
        { k: 'title',     label: 'Title / Role',               type: 'text' },
        { k: 'meaning',   label: 'Name Meaning',               type: 'text' },
        { k: 'lifespan',  label: 'Lifespan',                   type: 'text' },
        { k: 'bio',       label: 'Biography',                  type: 'textarea' },
        { k: 'reference', label: 'Scripture Reference',        type: 'text' },
        { k: 'children',  label: 'Children (comma-separated)', type: 'text' },
      ]
    },
    { key: 'counseling', name: 'Counseling', idField: 'title',
      listCols: ['title', 'definition'],
      fields: [
        { k: 'title',      label: 'Title',                       type: 'text',     required: true },
        { k: 'color',      label: 'Color (hex, e.g. #6366f1)',   type: 'text' },
        { k: 'icon',       label: 'Icon (emoji)',                type: 'text' },
        { k: 'definition', label: 'Definition',                  type: 'textarea' },
        { k: 'scriptures', label: 'Scriptures',                  type: 'textarea' },
        { k: 'steps',      label: 'Steps (semicolon-separated)', type: 'textarea' },
      ]
    },
    { key: 'devotionals', name: 'Devotionals', idField: 'date',
      listCols: ['date', 'title', 'theme'],
      fields: [
        { k: 'date',       label: 'Date (YYYY-MM-DD)',      type: 'text',     required: true },
        { k: 'title',      label: 'Title',                  type: 'text',     required: true },
        { k: 'scripture',  label: 'Scripture Reference',    type: 'text' },
        { k: 'theme',      label: 'Theme',                  type: 'text' },
        { k: 'reflection', label: 'Reflection',             type: 'textarea' },
        { k: 'prayer',     label: 'Prayer',                 type: 'textarea' },
        { k: 'question',   label: 'Reflection Question',    type: 'textarea' },
      ]
    },
    { key: 'reading', name: 'Reading Plan', idField: '_rowIndex',
      listCols: ['_rowIndex', 'oldTestament', 'newTestament'],
      fields: [
        { k: '_rowIndex',    label: 'Day # (1\u2013365)', type: 'number',   required: true },
        { k: 'oldTestament', label: 'Old Testament',      type: 'text' },
        { k: 'newTestament', label: 'New Testament',      type: 'text' },
        { k: 'psalms',       label: 'Psalms',             type: 'text' },
        { k: 'proverbs',     label: 'Proverbs',           type: 'text' },
      ]
    },
    { key: 'words', name: 'Lexicon', idField: 'original',
      listCols: ['original', 'english', 'theme'],
      fields: [
        { k: 'original',        label: 'Original Word (Hebrew/Greek)', type: 'text',     required: true },
        { k: 'english',         label: 'English Translation',          type: 'text' },
        { k: 'strongs',         label: "Strong\u2019s Number",         type: 'text' },
        { k: 'transliteration', label: 'Transliteration',              type: 'text' },
        { k: 'definition',      label: 'Definition',                   type: 'textarea' },
        { k: 'nuance',          label: 'Nuance',                       type: 'textarea' },
        { k: 'theme',           label: 'Theme / Category',             type: 'text' },
        { k: 'testament',       label: 'Testament',                    type: 'select',   opts: ['Old', 'New'] },
      ]
    },
    { key: 'heart', name: 'Heart Check', idField: 'questionId',
      listCols: ['questionId', 'category', 'question'],
      fields: [
        { k: 'questionId',     label: 'Question ID',   type: 'text',     required: true },
        { k: 'category',       label: 'Category',      type: 'text' },
        { k: 'chartAxis',      label: 'Chart Axis',    type: 'text' },
        { k: 'question',       label: 'Question',      type: 'textarea', required: true },
        { k: 'verseReference', label: 'Scripture',     type: 'text' },
        { k: 'prescription',   label: 'Prescription',  type: 'textarea' },
      ]
    },
    { key: 'mirror', name: 'Mirror', idField: 'categoryTitle',
      listCols: ['categoryTitle', 'chartLabel'],
      fields: [
        { k: 'categoryId',    label: 'Category ID',    type: 'text' },
        { k: 'categoryTitle', label: 'Category Title',  type: 'text',     required: true },
        { k: 'color',         label: 'Color',           type: 'text' },
        { k: 'chartLabel',    label: 'Chart Label',     type: 'text' },
        { k: 'questionId',    label: 'Question ID',     type: 'text' },
        { k: 'question',      label: 'Question',        type: 'textarea' },
        { k: 'prescription',  label: 'Prescription',    type: 'textarea' },
        { k: 'scripture',     label: 'Scripture',       type: 'text' },
      ]
    },
    { key: 'quiz', name: 'Quiz', idField: 'question',
      listCols: ['quizId', 'question', 'correctAnswer'],
      fields: [
        { k: 'quizId',         label: 'Quiz ID',             type: 'text' },
        { k: 'question',       label: 'Question',            type: 'textarea', required: true },
        { k: 'optionA',        label: 'Option A',            type: 'text',     required: true },
        { k: 'optionB',        label: 'Option B',            type: 'text',     required: true },
        { k: 'optionC',        label: 'Option C',            type: 'text' },
        { k: 'optionD',        label: 'Option D',            type: 'text' },
        { k: 'correctAnswer',  label: 'Correct Answer',      type: 'select',   opts: ['A', 'B', 'C', 'D'] },
        { k: 'reference',      label: 'Scripture Reference', type: 'text' },
      ]
    },
    { key: 'apologetics', name: 'Apologetics', idField: 'shortTitle',
      listCols: ['categoryTitle', 'shortTitle'],
      fields: [
        { k: 'categoryId',    label: 'Category ID',       type: 'text' },
        { k: 'categoryTitle', label: 'Category Title',    type: 'text',     required: true },
        { k: 'categoryColor', label: 'Category Color',    type: 'text' },
        { k: 'categoryIntro', label: 'Category Intro',    type: 'textarea' },
        { k: 'questionId',    label: 'Question ID',       type: 'text' },
        { k: 'questionTitle', label: 'Question Title',    type: 'text' },
        { k: 'shortTitle',    label: 'Short Title',       type: 'text',     required: true },
        { k: 'answerContent', label: 'Answer / Response', type: 'textarea' },
      ]
    },
  ];

  // ── Private helpers ───────────────────────────────────────────────────────

  function _getTab(key) {
    return TABS.find(function(t) { return t.key === key; }) || TABS[0];
  }

  function _fieldId(f) {
    return 'tt-fld-' + f.k.replace(/[^a-zA-Z0-9]/g, '_');
  }

  function _renderField(f, val) {
    var INP = 'width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--bg-raised);color:var(--ink);font-size:0.9rem;font-family:inherit;';
    var fid = _fieldId(f);
    var v   = (val !== undefined && val !== null) ? val : '';
    var lbl = '<label style="display:block;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted);margin-bottom:5px;">'
            + _e(f.label) + (f.required ? ' <span style="color:var(--danger);">*</span>' : '') + '</label>';
    var inp;
    if (f.type === 'textarea') {
      inp = '<textarea id="' + fid + '" rows="4" placeholder="' + _e(f.label) + '\u2026" style="' + INP + 'resize:vertical;line-height:1.6;">' + _e(v) + '</textarea>';
    } else if (f.type === 'select') {
      inp = '<select id="' + fid + '" style="' + INP + '"><option value="">\u2014 select \u2014</option>';
      (f.opts || []).forEach(function(o) {
        inp += '<option value="' + _e(o) + '"' + (String(o) === String(v) ? ' selected' : '') + '>' + _e(o) + '</option>';
      });
      inp += '</select>';
    } else if (f.type === 'number') {
      inp = '<input type="number" id="' + fid + '" value="' + _e(v) + '" placeholder="' + _e(f.label) + '" style="' + INP + '" />';
    } else {
      inp = '<input type="text" id="' + fid + '" value="' + _e(v) + '" placeholder="' + _e(f.label) + '" style="' + INP + '" />';
    }
    return '<div style="margin-bottom:14px;">' + lbl + inp + '</div>';
  }

  function _readField(f) {
    var el = document.getElementById(_fieldId(f));
    return el ? el.value : '';
  }

  // ── Firestore document ID helpers ─────────────────────────────────────────

  function _docId(tab, data) {
    var id = String(data[tab.idField] || '').trim();
    return id.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || ('doc_' + Date.now());
  }

  // ── Public: open add/edit modal ────────────────────────────────────────────

  export function openEditor(item, tabKey) {
    var tab   = _getTab(tabKey || _tab);
    var isNew = !item;
    var title = isNew ? ('Add \u2014 ' + tab.name) : ('Edit \u2014 ' + _e(String(item[tab.idField] || 'Row')));

    var fieldsHtml = tab.fields.map(function(f) {
      return _renderField(f, item ? item[f.k] : '');
    }).join('');

    var existing = document.getElementById('tt-modal');
    if (existing) existing.remove();

    var html = '<div id="tt-modal" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);padding:16px;">'
      + '<div style="background:var(--bg-raised,#ffffff);border-radius:16px;width:100%;max-width:580px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.4);">'
      + '<div style="padding:20px 22px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;">'
      + '<div style="flex:1;font-size:1.05rem;font-weight:800;color:var(--ink);">' + title + '</div>'
      + '<button onclick="document.getElementById(\'tt-modal\').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--ink-muted);line-height:1;padding:0;">&times;</button>'
      + '</div>'
      + '<div style="flex:1;overflow-y:auto;padding:20px 22px;">';

    if (!isNew && item._docId) {
      html += '<input type="hidden" id="tt-orig-docid" value="' + _e(item._docId) + '" />';
    }
    html += fieldsHtml;
    html += '</div>'
      + '<div style="padding:14px 22px;border-top:1px solid var(--line);display:flex;gap:10px;justify-content:flex-end;">'
      + '<button onclick="document.getElementById(\'tt-modal\').remove()" style="padding:10px 20px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--ink);font-size:0.88rem;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>'
      + '<button onclick="TheTruth.save(\'' + tab.key + '\',' + (isNew ? 'true' : 'false') + ')" style="padding:10px 22px;border-radius:10px;border:none;background:var(--accent);color:var(--ink-inverse);font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit;">&#10003; Save</button>'
      + '</div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
  }

  // ── Public: save (create or update) — writes directly to Firestore ────────

  export async function save(tabKey, isNew) {
    var tab  = _getTab(tabKey);
    var data = {};
    for (var fi = 0; fi < tab.fields.length; fi++) {
      var f = tab.fields[fi];
      var v = _readField(f);
      if (f.required && !String(v).trim()) { _toast(f.label + ' is required.', 'warn'); return; }
      // Skip synthetic _rowIndex from Firestore writes
      if (f.k === '_rowIndex') continue;
      data[f.k] = v;
    }

    try {
      await _initTruth();
      var col = _truthDb.collection(tab.key);

      if (isNew) {
        var newDocId = _docId(tab, data);
        await col.doc(newDocId).set(data);
      } else {
        var origEl = document.getElementById('tt-orig-docid');
        var docRef = origEl ? col.doc(origEl.value) : col.doc(_docId(tab, data));
        await docRef.set(data, { merge: true });
      }

      // Resolve the final doc ID for cache patching
      var savedDocId = isNew ? newDocId : (origEl ? origEl.value : _docId(tab, data));

      var modal = document.getElementById('tt-modal');
      if (modal) modal.remove();
      delete _allRows[tab.key];   // force fresh fetch on next render

      // Immediately update the localStorage live bundle so the_way.js sees the change
      _patchBundleRecord(tab.key, savedDocId, data);

      _toast((isNew ? 'Created' : 'Updated') + ' successfully.', 'success');
      var panel = document.querySelector('.tt-panel[data-key="' + tab.key + '"]');
      if (panel) renderList(panel, tab.key);
    } catch (e) {
      _toast('Save failed: ' + (e.message || e), 'danger');
    }
  }

  // ── Public: delete — deletes directly from Firestore ───────────────────────

  export async function del(tabKey, docId) {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    var tab = _getTab(tabKey);
    try {
      await _initTruth();
      var decodedId = decodeURIComponent(docId);
      await _truthDb.collection(tab.key).doc(decodedId).delete();
      delete _allRows[tab.key];

      // Remove from localStorage live bundle immediately
      _dropBundleRecord(tab.key, decodedId);

      _toast('Deleted.', 'success');
      var panel = document.querySelector('.tt-panel[data-key="' + tab.key + '"]');
      if (panel) renderList(panel, tab.key);
    } catch (e) {
      _toast('Delete failed: ' + (e.message || e), 'danger');
    }
  }

  // ── Private: pagination controls HTML ─────────────────────────────────────

  function _paginationHtml(tabKey, pg, totalPages) {
    var BTN   = 'padding:6px 14px;border-radius:8px;border:1px solid var(--line);background:var(--bg-raised);color:var(--ink);font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit;';
    var ACBTN = 'padding:6px 14px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--ink-inverse);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;';
    var html = '<div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:16px 0 4px;flex-wrap:wrap;">';

    if (pg <= 1) {
      html += '<button disabled style="' + BTN + 'opacity:0.35;cursor:default;">&larr; Prev</button>';
    } else {
      html += '<button onclick="TheTruth.goPage(\'' + tabKey + '\',' + (pg - 1) + ')" style="' + BTN + '">&larr; Prev</button>';
    }

    var pages = [];
    if (totalPages <= 7) {
      for (var i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (pg > 3) pages.push('\u2026');
      var lo = Math.max(2, pg - 1), hi = Math.min(totalPages - 1, pg + 1);
      for (var j = lo; j <= hi; j++) pages.push(j);
      if (pg < totalPages - 2) pages.push('\u2026');
      pages.push(totalPages);
    }
    pages.forEach(function(p) {
      if (p === '\u2026') {
        html += '<span style="color:var(--ink-muted);padding:0 2px;">\u2026</span>';
      } else {
        html += '<button onclick="TheTruth.goPage(\'' + tabKey + '\',' + p + ')" style="' + (p === pg ? ACBTN : BTN) + '">' + p + '</button>';
      }
    });

    if (pg >= totalPages) {
      html += '<button disabled style="' + BTN + 'opacity:0.35;cursor:default;">Next &rarr;</button>';
    } else {
      html += '<button onclick="TheTruth.goPage(\'' + tabKey + '\',' + (pg + 1) + ')" style="' + BTN + '">Next &rarr;</button>';
    }

    html += '</div>';
    return html;
  }

  // ── Private: render a row set into container ───────────────────────────────

  function _renderRows(container, tab, rows, totalAll, pg, totalPages) {
    if (!rows.length) {
      container.innerHTML = _empty('&#9998;', 'No items yet', 'Click \u201C+ Add ' + tab.name + '\u201D to create the first entry.');
      return;
    }

    var countLabel = (pg != null)
      ? (rows.length + ' item' + (rows.length !== 1 ? 's' : '') + (totalPages > 1 ? ' \u2014 page ' + pg + ' of ' + totalPages : ''))
      : (rows.length + ' result' + (rows.length !== 1 ? 's' : '') + ' of ' + totalAll);

    // Column header label — use the field label instead of raw camelCase key
    function _colLabel(col) {
      if (col === '_rowIndex') return 'Day #';
      for (var ti = 0; ti < tab.fields.length; ti++) {
        if (tab.fields[ti].k === col) return tab.fields[ti].label;
      }
      return col.replace(/([A-Z])/g, ' $1').replace(/^./, function(c) { return c.toUpperCase(); });
    }

    var html = '<div class="browse-search" style="margin-bottom:10px;">'
      + '<span class="browse-search-icon">&#128269;</span>'
      + '<input type="text" id="tt-search-' + tab.key + '" class="browse-search-input" '
      + 'placeholder="Search ' + totalAll + ' items\u2026" '
      + 'oninput="TheTruth.filter(this.value,\'' + tab.key + '\')">'
      + '</div>'
      + '<div style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:8px;">' + countLabel + '</div>';

    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.84rem;" id="tt-table-' + tab.key + '">';
    html += '<thead><tr style="background:var(--bg-sunken);">';
    tab.listCols.forEach(function(col) {
      html += '<th style="padding:9px 12px;text-align:left;font-weight:700;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted);white-space:nowrap;border-bottom:1px solid var(--line);">' + _e(_colLabel(col)) + '</th>';
    });
    html += '<th style="padding:9px 12px;text-align:right;font-weight:700;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted);border-bottom:1px solid var(--line);">Actions</th>';
    html += '</tr></thead><tbody>';

    rows.forEach(function(row) {
      var docId   = row._docId || '';
      var rowJson = _e(JSON.stringify(row));

      html += '<tr class="tt-row" '
        + 'style="border-bottom:1px solid var(--line);transition:background 0.15s;" '
        + 'onmouseenter="this.style.background=\'var(--bg-raised)\'" onmouseleave="this.style.background=\'\'">';
      tab.listCols.forEach(function(col) {
        var v = String(row[col] || '');
        if (col !== '_rowIndex' && v.length > 65) v = v.substring(0, 62) + '\u2026';
        html += '<td style="padding:9px 12px;color:var(--ink);vertical-align:middle;">' + _e(v) + '</td>';
      });
      html += '<td style="padding:9px 12px;text-align:right;white-space:nowrap;vertical-align:middle;">'
        + '<button data-row="' + rowJson + '" data-tab="' + tab.key + '" onclick="TheTruth.editFromTable(this)" '
        + 'style="padding:5px 12px;border-radius:7px;border:1px solid var(--accent);color:var(--accent);background:transparent;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:inherit;margin-right:6px;">Edit</button>'
        + '<button onclick="TheTruth.del(\'' + _e(tab.key) + '\',\'' + _e(encodeURIComponent(docId)) + '\')" '
        + 'style="padding:5px 12px;border-radius:7px;border:1px solid var(--danger,#e05);color:var(--danger,#e05);background:transparent;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:inherit;">Delete</button>'
        + '</td></tr>';
    });

    html += '</tbody></table></div>';

    if (pg != null && totalPages > 1) {
      html += _paginationHtml(tab.key, pg, totalPages);
    }

    container.innerHTML = html;

    var srchEl = document.getElementById('tt-search-' + tab.key);
    if (srchEl && _filterQuery[tab.key]) srchEl.value = _filterQuery[tab.key];
  }

  // ── Public: render list (lazy-loaded per tab, paginated) — Firestore ─────

  export async function renderList(container, tabKey, page) {
    var tab = _getTab(tabKey);
    var pg  = (page != null) ? page : (_pages[tab.key] || 1);
    _pages[tab.key] = pg;

    // Fetch and cache all rows from Firestore if not already loaded
    if (!_allRows[tab.key]) {
      container.innerHTML = _spinner();
      try {
        await _initTruth();
        var snap;
        if (window.FLOCK_TRUTH_USE_LOCAL) {
          // Church deployment — always fetch live (church data changes frequently)
          snap = await _truthDb.collection(tab.key).get();
        } else {
          // ROOT truth database — serve from IndexedDB cache unless weekly refresh is due
          var src = _truthFetchSource();
          try {
            snap = await _truthDb.collection(tab.key).get({ source: src });
            if (src === 'server') _markTruthRefreshed();
          } catch (_cacheErr) {
            // Cache miss (first load, cleared browser data, etc.) — fall back to server
            snap = await _truthDb.collection(tab.key).get({ source: 'server' });
            _markTruthRefreshed();
          }
        }
        _allRows[tab.key] = snap.docs.map(function(doc, i) {
          var d = doc.data();
          d._docId = doc.id;
          // For reading plan: synthesize row index from doc ID (day_001 → 1)
          if (tab.key === 'reading') {
            var m = doc.id.match(/(\d+)/);
            d._rowIndex = m ? String(parseInt(m[1], 10)) : String(i + 1);
          }
          return d;
        });
      } catch (e) {
        container.innerHTML = _errHtml(e.message);
        return;
      }
    }

    var all        = _allRows[tab.key];
    var totalPages = Math.ceil(all.length / PAGE_SIZE);
    pg = Math.max(1, Math.min(pg, totalPages || 1));
    _pages[tab.key] = pg;

    var start    = (pg - 1) * PAGE_SIZE;
    var pageRows = all.slice(start, start + PAGE_SIZE);

    if (_filterQuery[tab.key]) {
      var q = _filterQuery[tab.key].toLowerCase();
      var filtered = all.filter(function(row) {
        return tab.listCols.some(function(col) { return String(row[col] || '').toLowerCase().includes(q); });
      });
      _renderRows(container, tab, filtered, all.length, null, null);
    } else {
      _renderRows(container, tab, pageRows, all.length, pg, totalPages);
    }
  }

  // ── Public: go to a specific page ─────────────────────────────────────────

  export function goPage(tabKey, page) {
    _filterQuery[tabKey] = '';
    _pages[tabKey] = page;
    var panel = document.querySelector('.tt-panel[data-key="' + tabKey + '"]');
    if (panel) renderList(panel, tabKey, page);
  }

  // ── Public: edit from table row button ────────────────────────────────────

  export function editFromTable(btn) {
    var tabKey = btn.dataset.tab;
    var row    = {};
    try { row = JSON.parse(btn.dataset.row); } catch (_) {}
    openEditor(row, tabKey);
  }

  // ── Filter query state (per tab) ──────────────────────────────────────────

  var _filterQuery = {};

  // ── Public: filter ────────────────────────────────────────────────────────

  export function filter(query, tabKey) {
    var key = tabKey || _tab;
    var q   = (query || '').trim();
    _filterQuery[key] = q;

    var tab   = _getTab(key);
    var all   = _allRows[key] || [];
    var panel = document.querySelector('.tt-panel[data-key="' + key + '"]');
    if (!panel) return;

    if (!q) {
      _renderRows(panel, tab, all.slice((_pages[key] - 1) * PAGE_SIZE, _pages[key] * PAGE_SIZE),
        all.length, _pages[key], Math.ceil(all.length / PAGE_SIZE));
      return;
    }

    var ql = q.toLowerCase();
    var filtered = all.filter(function(row) {
      return tab.listCols.some(function(col) {
        return String(row[col] || '').toLowerCase().includes(ql);
      });
    });
    _renderRows(panel, tab, filtered, all.length, null, null);

    var srchEl = document.getElementById('tt-search-' + key);
    if (srchEl && srchEl.value !== q) srchEl.value = q;
  }

  // ── Public: switch tab ────────────────────────────────────────────────────

  export function switchTab(key) {
    _tab = key;
    document.querySelectorAll('.tt-tab-btn').forEach(function(btn) {
      var active = btn.dataset.key === key;
      btn.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
      btn.style.color        = active ? 'var(--accent)' : 'var(--ink-muted)';
      btn.style.fontWeight   = active ? '700' : '500';
    });
    var tab    = _getTab(key);
    var addBtn = document.getElementById('tt-add-btn');
    if (addBtn) addBtn.textContent = '+ Add ' + tab.name;
    document.querySelectorAll('.tt-panel').forEach(function(p) {
      p.style.display = (p.dataset.key === key) ? '' : 'none';
    });
    var panel = document.querySelector('.tt-panel[data-key="' + key + '"]');
    if (panel) {
      panel.dataset.loaded = '1';
      renderList(panel, key);
    }
  }

  // ── Public: current tab key ───────────────────────────────────────────────

  export function currentTab() { return _tab; }

  // ── Module render (registered with Modules via _def) ──────────────────────

  export async function render(el, session) {
    var s = session || (typeof TheVine !== 'undefined' && typeof TheVine.session === 'function' ? TheVine.session() : null);
    var allowed = !!s && (
      s.role === 'admin' ||
      s.role === 'superadmin' ||
      (s.roleLevel != null && s.roleLevel >= 2) ||
      (typeof Nehemiah !== 'undefined' && (Nehemiah.hasGroup('Master') || Nehemiah.hasGroup('Seed Admin') || Nehemiah.hasGroup('Lead Pastor')))
    );
    if (!allowed) {
      el.innerHTML = '<div style="text-align:center;padding:80px 20px;">'
        + '<div style="font-size:3rem;margin-bottom:12px;">&#128274;</div>'
        + '<p style="color:var(--ink-muted);">Pastor or Admin access required.</p></div>';
      return;
    }

    // Background sync: silently refresh any stale app-data bundles
    _syncStaleInBackground().catch(function() {});

    // Header — show project indicator for ROOT so admin knows they're editing the seed
    var tab = _getTab(_tab);
    var projectLabel = window.FLOCK_TRUTH_USE_LOCAL ? '' : ' <span style="font-size:0.72rem;color:var(--ink-muted);font-weight:500;">(flockos-truth seed)</span>';

    // Sync status line — show last time all bundles were synced to the app cache
    var oldestSync = null;
    BUNDLE_TABS.forEach(function(k) {
      try {
        var ts = parseInt(localStorage.getItem(_bundleTsKey(k)) || '0', 10);
        if (!oldestSync || (ts && ts < oldestSync)) oldestSync = ts || null;
      } catch (_) {}
    });
    var syncInfo = oldestSync
      ? 'App data last synced: ' + new Date(oldestSync).toLocaleDateString() + ' — updates propagate to members automatically.'
      : 'App data not yet synced — open this editor to trigger a background sync.';

    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:8px;">'
      + '<div>'
      + '<h1 style="font-size:1.4rem;font-weight:800;margin:0 0 2px;color:var(--ink);">&#9998; Content Editor' + projectLabel + '</h1>'
      + '<p style="font-size:0.82rem;color:var(--ink-muted);margin:0;">Add, edit, and update truth content across all categories.</p>'
      + '</div>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      + '<button id="tt-sync-btn" onclick="TheTruth.forceSyncAll(this)" '
      + 'style="padding:8px 16px;border-radius:10px;border:1px solid var(--line);background:var(--bg-raised);color:var(--ink);'
      + 'font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit;">&#8635; Sync App Data</button>'
      + '<button id="tt-add-btn" onclick="TheTruth.openEditor(null,TheTruth.currentTab())" '
      + 'style="padding:9px 18px;border-radius:10px;border:none;background:var(--accent);color:var(--ink-inverse);'
      + 'font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">+ Add ' + _e(tab.name) + '</button>'
      + '</div></div>'
      + '<p id="tt-sync-status" style="font-size:0.75rem;color:var(--ink-muted);margin:0 0 16px;">' + _e(syncInfo) + '</p>';

    // Tab bar
    var tabBar = '<div style="display:flex;gap:2px;overflow-x:auto;padding-bottom:2px;border-bottom:1px solid var(--line);margin-bottom:16px;">';
    TABS.forEach(function(t) {
      var isActive = t.key === _tab;
      tabBar += '<button class="tt-tab-btn" data-key="' + t.key + '" onclick="TheTruth.switchTab(\'' + t.key + '\')" '
        + 'style="padding:9px 14px;border:none;border-bottom:' + (isActive ? '2px solid var(--accent)' : '2px solid transparent') + ';'
        + 'background:transparent;color:' + (isActive ? 'var(--accent)' : 'var(--ink-muted)') + ';'
        + 'font-weight:' + (isActive ? '700' : '500') + ';font-size:0.82rem;white-space:nowrap;cursor:pointer;font-family:inherit;margin-bottom:-1px;">'
        + _e(t.name) + '</button>';
    });
    tabBar += '</div>';

    // Panels (lazy-loaded)
    var panels = '';
    TABS.forEach(function(t) {
      panels += '<div class="tt-panel" data-key="' + t.key + '" style="display:' + (t.key === _tab ? 'block' : 'none') + ';"></div>';
    });

    el.innerHTML += tabBar + panels;

    // Load active tab immediately
    var initPanel = el.querySelector('.tt-panel[data-key="' + _tab + '"]');
    if (initPanel) {
      initPanel.dataset.loaded = '1';
      await renderList(initPanel, _tab);
    }
  }

  // ── Public: forceSyncAll — manually triggered by "Sync App Data" button ──

  export async function forceSyncAll(btn) {
    if (btn) { btn.disabled = true; btn.textContent = '\u23F3 Syncing\u2026'; }
    var total = 0;
    for (var i = 0; i < BUNDLE_TABS.length; i++) {
      total += await syncBundle(BUNDLE_TABS[i]);
    }
    if (btn) { btn.disabled = false; btn.textContent = '\u8635 Sync App Data'; }
    var statusEl = document.getElementById('tt-sync-status');
    if (statusEl) {
      statusEl.textContent = '\u2713 Synced ' + total + ' records to app cache at ' + new Date().toLocaleTimeString() + '. Members will see updates on their next visit.';
      statusEl.style.color = 'var(--success)';
    }
    _toast('App data synced (' + total + ' records).', 'success');
  }

/* Expose as window.TheTruth for inline onclick= handlers */
if (typeof window !== 'undefined') {
  window.TheTruth = {
    syncBundle,
    liveBundle,
    bundleLastSynced,
    openEditor,
    save,
    del,
    renderList,
    goPage,
    editFromTable,
    filter,
    switchTab,
    currentTab,
    render,
    forceSyncAll,
  };
}
