/* ════════════════════════════════════════════════════════════════════════════
   FEED.JS — The Feed: Sermon Preparation & Management for FlockOS
   "Study to show thyself approved unto God, a workman that needeth not to
    be ashamed, rightly dividing the word of truth." — 2 Timothy 2:15

   Features:
     • Sermon library with search, series grouping, status tracking
     • Structured outline builder (intro, scripture, point, illustration,
       application, prayer, conclusion, transition) with drag reorder
     • Full manuscript editor with word count & delivery timing
     • Greek/Hebrew lexicon search (Strong's — loaded from Data/ if available)
     • Scripture lookup (pulls from GROW Bible data if loaded)
     • Cross-reference panel with standard sermon-critical passages
     • Delivery tab: timer, altar call, prayer prep, pre-sermon checklist
     • Series manager: group sermons by series with progress tracking
     • Firestore → GAS → localStorage tiered persistence
     • FlockOS auth gate (Nehemiah / firm_foundation.js)

   Storage key: 'bm_sermons_v1'
   GAS actions:  sermons.list, sermons.get, sermons.save, sermons.delete
   ════════════════════════════════════════════════════════════════════════════ */

// ── Constants ─────────────────────────────────────────────────────────────────
const BM_KEY        = 'bm_sermons_v1';
const BM_PREFS_KEY  = 'bm_prefs_v1';

const SECTION_TYPES = ['intro','scripture','point','illustration','application','prayer','conclusion','transition'];

const STATUS_CYCLE = ['draft', 'ready', 'preached'];
const STATUS_LABELS = { draft: 'Draft', ready: 'Ready', preached: 'Preached' };

// ── Helpers ───────────────────────────────────────────────────────────────────
const _uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const _e    = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const _qs   = id => document.getElementById(id);
const _now  = () => Date.now();

function _fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _wordCount(text) {
  return (String(text || '').trim().match(/\S+/g) || []).length;
}

// ── State ─────────────────────────────────────────────────────────────────────
const S = {
  user:         null,
  sermons:      [],   // full list
  activeId:     null,
  search:       '',
  filterStatus: 'all',   // 'all' | 'draft' | 'ready' | 'preached'
  sortBy:       'updated', // 'updated' | 'date' | 'title' | 'status'
  activeTab:    'outline',
  timer: {
    running:    false,
    elapsed:    0,
    interval:   null,
    startTs:    null,
  },
  checklist:    {},   // { key: bool }
  prefs: {
    targetDuration: 30,
  },
};

// ── Accessors ─────────────────────────────────────────────────────────────────
function _active() { return S.sermons.find(s => s.id === S.activeId) || null; }

// ── Model factories ───────────────────────────────────────────────────────────
function _makeSection(type = 'point', title = '') {
  return {
    id:         _uid(),
    type,
    title:      title || _sectionTitle(type),
    notes:      '',
    scripture:  '',
    scriptureRef: '',
  };
}

function _sectionTitle(type) {
  const defaults = {
    intro:        'Introduction',
    scripture:    'Scripture Reading',
    point:        'Main Point',
    illustration: 'Illustration',
    application:  'Application',
    prayer:       'Prayer',
    conclusion:   'Conclusion',
    transition:   'Transition',
  };
  return defaults[type] || type;
}

function _makeSermon(title = 'Untitled Sermon') {
  const now = _now();
  return {
    id:           _uid(),
    title,
    series:       '',
    date:         new Date().toISOString().slice(0, 10),
    speaker:      '',
    passage:      '',
    status:       'draft',
    sections:     [
      _makeSection('intro', 'Introduction'),
      _makeSection('scripture', 'Key Scripture'),
      _makeSection('point', 'Point 1'),
      _makeSection('application', 'Application'),
      _makeSection('conclusion', 'Conclusion'),
    ],
    manuscript:   '',
    researchNotes:'',
    researchQuotes:'',
    deliveryNotes:'',
    altarCall:    '',
    prayerPrep:   '',
    checklist:    {},
    createdAt:    now,
    updatedAt:    now,
  };
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function _toast(msg, type = 'info') {
  const host = _qs('bm-toasts');
  if (!host) return;
  const t = document.createElement('div');
  t.className = `bm-toast bm-toast--${type}`;
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('visible')); });
  setTimeout(() => {
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

// ── GAS API ───────────────────────────────────────────────────────────────────
function _fsFB() {
  return !!(window.UpperRoom &&
            typeof window.UpperRoom.isReady === 'function' &&
            window.UpperRoom.isReady());
}

async function _gasCall(action, params = {}) {
  const endpoint = String(window.PASTORAL_DB_V2_ENDPOINT || '').trim();
  if (!endpoint) return null;
  const N    = window.Nehemiah;
  const sess = (N && typeof N.getSession === 'function') ? N.getSession() : null;
  if (!sess) return null;
  const p = new URLSearchParams({ action, token: sess.token, email: sess.email, _: String(_now()) });
  Object.keys(params).forEach(k => { if (params[k] != null) p.set(k, String(params[k])); });
  try {
    const resp = await fetch(endpoint + '?' + p.toString(), { referrerPolicy: 'no-referrer' });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data && data.ok) ? data : null;
  } catch (e) {
    console.warn('[TheFeed] GAS call failed:', action, e);
    return null;
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────
function _lsSync() {
  try { localStorage.setItem(BM_KEY, JSON.stringify(S.sermons)); } catch (_) {}
}

async function _load() {
  // Firestore
  if (_fsFB()) {
    try {
      const result = await window.UpperRoom.listSermons({ limit: 500 });
      const rows = Array.isArray(result) ? result : (result.results || result.rows || []);
      if (rows.length > 0) {
        S.sermons = rows.map(r => { r._fsId = r.id; return r; });
        _lsSync();
        return;
      }
    } catch (e) { console.warn('[TheFeed] Firestore load failed:', e); }
  }
  // GAS
  const gasData = await _gasCall('sermons.list');
  if (gasData && Array.isArray(gasData.rows)) {
    S.sermons = gasData.rows.map(r => { r._gasId = r.id; return r; });
    _lsSync();
    return;
  }
  // localStorage
  try { S.sermons = JSON.parse(localStorage.getItem(BM_KEY) || '[]'); }
  catch (_) { S.sermons = []; }
}

async function _saveSermon(sermon) {
  sermon.updatedAt = _now();
  _lsSync();
  // Ensure UpperRoom is ready before attempting Firestore (timing race on new tab)
  if (window.UpperRoom && !_fsFB() && typeof window.UpperRoom.waitReady === 'function') {
    try { await window.UpperRoom.waitReady(); } catch (_) {}
  }
  // Firestore
  if (_fsFB()) {
    try {
      if (sermon._fsId) {
        // Strip local-only fields — sermon.id (local UID) must NOT overwrite id: sermon._fsId
        const { id: _localId, _fsId, _gasId, ...payload } = sermon;
        await window.UpperRoom.updateSermon({ id: _fsId, ...payload });
      } else {
        const res = await window.UpperRoom.createSermon(sermon);
        sermon._fsId = res.id;
        _lsSync(); // persist _fsId so next save uses updateSermon
      }
      return;
    } catch (e) { console.warn('[TheFeed] Firestore save failed:', e); }
  }
  // GAS
  const payload = JSON.stringify(sermon);
  if (sermon._gasId) {
    await _gasCall('sermons.save', { id: sermon._gasId, data: payload });
  } else {
    const res = await _gasCall('sermons.save', { data: payload });
    if (res && res.row) { sermon._gasId = res.row.id; _lsSync(); }
  }
}

async function _deleteSermon(sermon) {
  S.sermons = S.sermons.filter(s => s.id !== sermon.id);
  _lsSync();
  if (_fsFB() && sermon._fsId) {
    try { await window.UpperRoom.deleteSermon(sermon._fsId); } catch (_) {}
  } else if (sermon._gasId) {
    await _gasCall('sermons.delete', { id: sermon._gasId });
  }
}

// ── Auto-save (debounced) ─────────────────────────────────────────────────────
let _saveTimer = null;
function _queueSave() {
  const btn = _qs('bm-save-btn');
  if (btn) { btn.textContent = ''; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg> Saving…'; }
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    const s = _active();
    if (s) {
      await _saveSermon(s);
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Saved'; }
      _updateStats();
    }
  }, 1200);
}

// ── Completion score ──────────────────────────────────────────────────────────
function _computeCompletion(s) {
  if (!s) return 0;
  let score = 0, total = 7;
  if ((s.title || '').trim())              score++;
  if ((s.passage || '').trim())            score++;
  if ((s.sections || []).length >= 3)      score++;
  const hasNotes = (s.sections || []).some(x => (x.notes || '').trim().length > 20);
  if (hasNotes)                            score++;
  if (_wordCount(s.manuscript) > 100)      score++;
  if (Object.values(s.checklist || {}).filter(Boolean).length >= 3) score++;
  if ((s.altarCall || '').trim().length > 20) score++;
  return Math.round((score / total) * 100);
}

// ── Sidebar list ──────────────────────────────────────────────────────────────
function _renderList() {
  const container = _qs('bm-sermon-list');
  if (!container) return;
  const q = S.search.toLowerCase();
  let filtered = S.sermons.filter(s => {
    const matchesSearch = !q ||
      (s.title || '').toLowerCase().includes(q) ||
      (s.series || '').toLowerCase().includes(q) ||
      (s.passage || '').toLowerCase().includes(q);
    const matchesFilter = S.filterStatus === 'all' || (s.status || 'draft') === S.filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Sort
  const sortFns = {
    updated: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    date:    (a, b) => (b.date || '').localeCompare(a.date || ''),
    title:   (a, b) => (a.title || '').localeCompare(b.title || ''),
    status:  (a, b) => {
      const order = { draft: 0, ready: 1, preached: 2 };
      return (order[a.status] ?? 0) - (order[b.status] ?? 0);
    },
  };
  filtered.sort(sortFns[S.sortBy] || sortFns.updated);

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:16px 12px;font:0.78rem 'Plus Jakarta Sans',sans-serif;color:var(--bm-faint);text-align:center">${q || S.filterStatus !== 'all' ? 'No results.' : 'No sermons yet. Create one below.'}</div>`;
    return;
  }

  const statusDot = { draft: '#60a5fa', ready: '#34d399', preached: '#e8a838' };

  container.innerHTML = filtered.map(s => {
    const pct = _computeCompletion(s);
    const dotColor = statusDot[s.status || 'draft'] || '#60a5fa';
    return `
      <div class="bm-sermon-item${s.id === S.activeId ? ' is-active' : ''}" data-id="${_e(s.id)}">
        <div style="display:flex;align-items:center;gap:6px;min-width:0">
          <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0" title="${_e(STATUS_LABELS[s.status||'draft'])}"></span>
          <div class="bm-sermon-item-title">${_e(s.title || 'Untitled')}</div>
        </div>
        <div class="bm-sermon-item-meta">
          <span>${_fmtDate(s.date ? new Date(s.date + 'T00:00:00').getTime() : s.createdAt)}</span>
          ${s.series ? `<span class="bm-sermon-item-series">${_e(s.series)}</span>` : ''}
        </div>
        ${pct > 0 ? `<div style="margin-top:4px;height:3px;border-radius:2px;background:rgba(255,255,255,0.07);overflow:hidden"><div style="height:100%;width:${pct}%;background:${pct>=80?'#34d399':pct>=40?'#e8a838':'#60a5fa'};border-radius:2px;transition:width 0.3s"></div></div>` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.bm-sermon-item').forEach(el => {
    el.addEventListener('click', () => {
      _selectSermon(el.dataset.id);
      const sb = _qs('bm-sidebar');
      if (sb) sb.classList.remove('is-open');
    });
  });
}

// Editor fields
function _renderEditor() {
  const s = _active();
  if (!s) return;

  // Header fields
  _qs('bm-field-title').value   = s.title   || '';
  _qs('bm-field-series').value  = s.series  || '';
  _qs('bm-field-date').value    = s.date    || '';
  _qs('bm-field-speaker').value = s.speaker || '';
  _qs('bm-field-passage').value = s.passage || '';

  // Status
  _renderStatus(s);

  // Topbar title
  const titleEl = _qs('bm-active-title');
  if (titleEl) {
    titleEl.textContent = s.title || 'Untitled Sermon';
    titleEl.classList.toggle('has-sermon', !!s.title);
  }

  // Tabs
  _renderTab(S.activeTab);
}

function _renderStatus(s) {
  const btn = _qs('bm-status-btn');
  if (!btn) return;
  btn.className = `bm-status-chip ${s.status || 'draft'}`;
  btn.innerHTML = `<span class="bm-status-dot"></span><span id="bm-status-label">${STATUS_LABELS[s.status] || 'Draft'}</span>`;
}

// ── Outline sections ──────────────────────────────────────────────────────────
function _renderOutline() {
  const s = _active();
  const container = _qs('bm-sections-container');
  if (!s || !container) return;

  const typeOptions = SECTION_TYPES.map(t =>
    `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
  ).join('');

  container.innerHTML = (s.sections || []).map((sec, idx) => `
    <div class="bm-outline-section${sec._collapsed ? ' collapsed' : ''}" data-sid="${_e(sec.id)}" draggable="true">
      <div class="bm-section-header">
        <button class="bm-icon-btn bm-collapse-btn" data-action="toggle-collapse" data-sid="${_e(sec.id)}" title="${sec._collapsed ? 'Expand' : 'Collapse'}" aria-expanded="${!sec._collapsed}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <span class="bm-section-drag" title="Drag to reorder">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></svg>
        </span>
        <select class="bm-section-type-select ${_e(sec.type)}" data-field="type" data-sid="${_e(sec.id)}" title="Change section type">
          ${SECTION_TYPES.map(t => `<option value="${t}"${t === sec.type ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
        </select>
        <input class="bm-section-title-input" type="text" value="${_e(sec.title)}" placeholder="Section title…" data-field="title" data-sid="${_e(sec.id)}" autocomplete="off">
        <div class="bm-section-actions">
          <button class="bm-icon-btn" data-action="move-up" data-sid="${_e(sec.id)}" title="Move up"${idx === 0 ? ' disabled' : ''}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="bm-icon-btn" data-action="move-down" data-sid="${_e(sec.id)}" title="Move down"${idx === (s.sections.length-1) ? ' disabled' : ''}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="bm-icon-btn danger" data-action="delete-section" data-sid="${_e(sec.id)}" title="Remove section">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="bm-section-body">
        ${sec.type === 'scripture' ? `
          <div class="bm-scripture-block">
            <div class="bm-scripture-ref-row">
              <input class="bm-scripture-ref-input" type="text" value="${_e(sec.scriptureRef)}" placeholder="Reference (e.g. John 3:16–17)" data-field="scriptureRef" data-sid="${_e(sec.id)}" autocomplete="off">
            </div>
            <textarea class="bm-scripture-textarea" placeholder="Paste or type the scripture text here…" data-field="scripture" data-sid="${_e(sec.id)}">${_e(sec.scripture)}</textarea>
          </div>
        ` : ''}
        <textarea class="bm-notes-textarea" placeholder="${_sectionPlaceholder(sec.type)}" data-field="notes" data-sid="${_e(sec.id)}">${_e(sec.notes)}</textarea>
      </div>
    </div>
  `).join('');

  _bindOutlineEvents(container);
  _updateStats();
}

function _sectionPlaceholder(type) {
  const map = {
    intro:        'Hook, context, why this matters today, introduce the theme…',
    scripture:    'Notes, context, observations on this passage…',
    point:        'Main idea, supporting arguments, sub-points…',
    illustration: 'Story, analogy, real-world example that illustrates the truth…',
    application:  'How does this change how we live? Practical steps for the congregation…',
    prayer:       'Prayer prompt or congregational prayer script…',
    conclusion:   'Summary, call back to the main theme, landing the message…',
    transition:   'Brief bridge sentence moving to the next section…',
  };
  return map[type] || 'Notes…';
}

function _bindOutlineEvents(container) {
  // Text inputs / textareas / selects
  container.querySelectorAll('[data-field][data-sid]').forEach(el => {
    el.addEventListener('input', () => {
      const s = _active();
      if (!s) return;
      const sec = s.sections.find(x => x.id === el.dataset.sid);
      if (!sec) return;
      const field = el.dataset.field;
      sec[field] = el.tagName === 'SELECT' ? el.value : el.value;
      // If type changed, update CSS class on select and re-render so scripture block shows/hides
      if (field === 'type') {
        if (sec.title === _sectionTitle(SECTION_TYPES.find(t => t !== el.value) || 'point')) {
          sec.title = _sectionTitle(el.value);
        }
        _renderOutline(); // re-render to show/hide scripture block
        return;
      }
      _queueSave();
      _updateStats();
    });
    // Auto-expand textareas
    if (el.tagName === 'TEXTAREA') {
      _autoResize(el);
      el.addEventListener('input', () => _autoResize(el));
    }
  });

  // Action buttons
  container.querySelectorAll('[data-action][data-sid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = _active();
      if (!s) return;
      const sid = btn.dataset.sid;
      const idx = s.sections.findIndex(x => x.id === sid);
      if (idx === -1) return;
      const action = btn.dataset.action;
      if (action === 'toggle-collapse') {
        const sec = s.sections[idx];
        sec._collapsed = !sec._collapsed;
        const el = container.querySelector(`.bm-outline-section[data-sid="${sid}"]`);
        if (el) {
          el.classList.toggle('collapsed', !!sec._collapsed);
          btn.setAttribute('aria-expanded', String(!sec._collapsed));
          btn.title = sec._collapsed ? 'Expand' : 'Collapse';
        }
        // Don't trigger full save — just a view state change; persist quietly
        _lsSync();
      } else if (action === 'delete-section') {
        s.sections.splice(idx, 1);
        _renderOutline();
        _queueSave();
      } else if (action === 'move-up' && idx > 0) {
        [s.sections[idx-1], s.sections[idx]] = [s.sections[idx], s.sections[idx-1]];
        _renderOutline();
        _queueSave();
      } else if (action === 'move-down' && idx < s.sections.length - 1) {
        [s.sections[idx+1], s.sections[idx]] = [s.sections[idx], s.sections[idx+1]];
        _renderOutline();
        _queueSave();
      }
    });
  });

  // Drag & drop reorder
  let _dragSid = null;
  container.querySelectorAll('.bm-outline-section').forEach(el => {
    el.addEventListener('dragstart', e => {
      _dragSid = el.dataset.sid;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => el.style.opacity = '0.45', 0);
    });
    el.addEventListener('dragend', () => { el.style.opacity = ''; _dragSid = null; });
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const s = _active();
      if (!s || !_dragSid || _dragSid === el.dataset.sid) return;
      const fromIdx = s.sections.findIndex(x => x.id === _dragSid);
      const toIdx   = s.sections.findIndex(x => x.id === el.dataset.sid);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = s.sections.splice(fromIdx, 1);
      s.sections.splice(toIdx, 0, moved);
      _renderOutline();
      _queueSave();
    });
  });
}

function _autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.max(72, el.scrollHeight) + 'px';
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function _updateStats() {
  const s = _active();
  if (!s) return;
  const secs   = (s.sections || []).length;
  const scrips = (s.sections || []).filter(x => x.type === 'scripture').length;
  const outlineWords = (s.sections || []).reduce((n, x) =>
    n + _wordCount(x.notes) + _wordCount(x.scripture), 0);
  const msWords = _wordCount(s.manuscript);
  const totalWords = Math.max(outlineWords, msWords);
  const estMin = Math.round(totalWords / 130); // ~130 wpm speaking pace

  const $ = id => { const el = _qs(id); if (el) el.textContent = id === 'stat-min' ? `~${estMin}` : (id === 'stat-words' ? totalWords : (id === 'stat-sections' ? secs : scrips)); };
  $('stat-sections'); $('stat-scriptures'); $('stat-words'); $('stat-min');

  // Completion bar
  const pct = _computeCompletion(s);
  const pctEl = _qs('stat-completion');
  const barEl = _qs('stat-progress-bar');
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (barEl) {
    barEl.style.width = `${pct}%`;
    barEl.style.background = pct >= 80 ? 'linear-gradient(90deg,#16a34a,#34d399)' :
                             pct >= 40 ? 'linear-gradient(90deg,var(--bm-accent-dk),var(--bm-accent))' :
                                         'linear-gradient(90deg,#2563eb,#60a5fa)';
  }

  // Manuscript word count
  const msCountEl   = _qs('bm-ms-count');
  const msFooterEl  = _qs('bm-ms-word-count-footer');
  if (msCountEl)  msCountEl.textContent  = `${msWords.toLocaleString()} words`;
  if (msFooterEl) msFooterEl.textContent = msWords > 0 ? `${msWords.toLocaleString()} words — ~${Math.round(msWords/130)} min estimated delivery` : '';

  // Timer est
  const timerEst = _qs('bm-timer-est');
  if (timerEst) timerEst.textContent = `Estimated: ~${estMin} min (based on ${totalWords} words)`;

  // Save btn enable
  const saveBtn = _qs('bm-save-btn');
  if (saveBtn && saveBtn.disabled) { saveBtn.disabled = false; }
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function _renderTab(tab) {
  S.activeTab = tab;
  document.querySelectorAll('.bm-tab').forEach(t => t.classList.toggle('bm-tab--active', t.dataset.tab === tab));
  document.querySelectorAll('.bm-pane').forEach(p => { p.hidden = p.id !== `bm-pane-${tab}`; });

  if (tab === 'outline')    _renderOutline();
  if (tab === 'manuscript') _renderManuscript();
  if (tab === 'delivery')   _renderDelivery();
  if (tab === 'series')     _renderSeries();
  if (tab === 'research')   _renderResearch();
}

// ── Manuscript ────────────────────────────────────────────────────────────────
/* Returns true if manuscript is empty or contains only skeleton headers with no real content */
function _manuscriptIsEmpty(manuscript) {
  if (!manuscript || !manuscript.trim()) return true;
  // Strip all == HEADER == lines and whitespace; if nothing real remains, it's skeleton-only
  const stripped = manuscript.replace(/==\s*[^=]+\s*==/g, '').replace(/\[.*?\]/g, '').trim();
  return stripped.length < 10;
}

/* Build a structured draft from outline sections (shared by auto-seed + import btn) */
function _buildManuscriptFromOutline(s) {
  return (s.sections || []).map(sec => {
    let block = `== ${sec.title.toUpperCase()} ==\n`;
    if (sec.type === 'scripture' && sec.scriptureRef) block += `[${sec.scriptureRef}]\n${sec.scripture || ''}\n`;
    if (sec.notes) block += `\n${sec.notes}`;
    return block.trim();
  }).join('\n\n');
}

function _renderManuscript() {
  const s = _active();
  if (!s) return;
  const area = _qs('bm-manuscript-area');
  if (area) {
    // Auto-seed whenever the manuscript has no real content but the outline does
    if (_manuscriptIsEmpty(s.manuscript) && s.sections && s.sections.length) {
      s.manuscript = _buildManuscriptFromOutline(s);
      _queueSave();
    }
    area.value = s.manuscript || '';
    _autoResize(area);
  }
  // Always start in preview mode when loading a sermon
  _msPreviewMode = true;
  _refreshMsPreview();
  _updateStats();
}

// ── Manuscript preview renderer ───────────────────────────────────────────────
function _renderInlineCues(text) {
  // Escape HTML, then replace delivery cues with styled badges
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[PAUSE\]/g,    '<span class="bm-ms-cue bm-ms-cue--pause">PAUSE</span>')
    .replace(/\[EMPHASIS\]/g, '<span class="bm-ms-cue bm-ms-cue--emph">EMPH</span>')
    .replace(/\[STORY\]/g,    '<span class="bm-ms-cue bm-ms-cue--story">STORY</span>')
    .replace(/¶/g,            '<span class="bm-ms-cue bm-ms-cue--para">¶</span>');
}

function _buildMsHtml(raw) {
  if (!raw || !raw.trim()) {
    return '<div class="bm-ms-empty">No manuscript yet. Import your outline or switch to Edit to start writing.</div>';
  }

  const lines = raw.split('\n');
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Section header == TEXT ==
    const headerMatch = trimmed.match(/^==\s*(.+?)\s*==\s*$/);
    if (headerMatch) {
      html += `<div class="bm-ms-sec-head">${headerMatch[1]}</div>`;
      i++; continue;
    }

    // Scripture reference on its own line: [Ref]
    const scrRefMatch = trimmed.match(/^\[(.+?)\]$/);
    if (scrRefMatch) {
      html += `<div class="bm-ms-scripture-wrap"><div class="bm-ms-scripture-ref">${scrRefMatch[1]}</div>`;
      i++;
      // Collect subsequent non-header, non-bracket lines as scripture body
      let body = '';
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next || next.match(/^==/) || next.match(/^\[/)) break;
        body += (body ? ' ' : '') + next;
        i++;
      }
      if (body) html += `<div class="bm-ms-scripture-text">${_renderInlineCues(body)}</div>`;
      html += '</div>';
      continue;
    }

    // Empty line
    if (!trimmed) {
      i++; continue;
    }

    // Regular paragraph
    html += `<p class="bm-ms-para">${_renderInlineCues(trimmed)}</p>`;
    i++;
  }

  return html;
}

let _msPreviewMode = true;  // default: preview

function _refreshMsPreview() {
  const area    = _qs('bm-manuscript-area');
  const preview = document.getElementById('bm-ms-preview');
  const pane    = document.getElementById('bm-pane-manuscript');
  if (!preview) return;
  const raw = area ? area.value : (_active() ? (_active().manuscript || '') : '');
  preview.innerHTML = _buildMsHtml(raw);
  if (pane) pane.classList.toggle('bm-preview-mode', _msPreviewMode);
  // Use explicit display control instead of element.hidden for reliability
  if (area) { area.style.display = _msPreviewMode ? 'none' : ''; }
  preview.style.display = _msPreviewMode ? '' : 'none';
  // Sync toggle button active states
  const editBtn = document.getElementById('bm-ms-edit-btn');
  const viewBtn = document.getElementById('bm-ms-view-btn');
  if (editBtn) editBtn.classList.toggle('bm-active', !_msPreviewMode);
  if (viewBtn) viewBtn.classList.toggle('bm-active',  _msPreviewMode);
}

function _setMsMode(isPreview) {
  const area    = _qs('bm-manuscript-area');
  const s       = _active();
  // Switching TO edit: populate textarea from active sermon
  if (!isPreview && area && s) { area.value = s.manuscript || ''; _autoResize(area); }
  // Switching FROM edit: save any typed changes back before re-rendering
  if (isPreview && area && s)  { s.manuscript = area.value; _queueSave(); }
  _msPreviewMode = isPreview;
  _refreshMsPreview();
}

// ── Research ──────────────────────────────────────────────────────────────────
function _renderResearch() {
  const s = _active();
  if (!s) return;
  const rn = _qs('bm-research-notes');
  const rq = _qs('bm-research-quotes');
  if (rn) { rn.value = s.researchNotes || ''; _autoResize(rn); }
  if (rq) { rq.value = s.researchQuotes || ''; _autoResize(rq); }

  // Key words from scripture sections
  const kwEl = _qs('bm-key-words');
  if (kwEl) {
    const words = [];
    (s.sections || []).filter(x => x.type === 'scripture' && x.scriptureRef).forEach(x => {
      words.push(x.scriptureRef);
    });
    if (words.length > 0) {
      kwEl.innerHTML = words.map(w =>
        `<span class="bm-chip" style="cursor:default">${_e(w)}</span>`
      ).join('');
    } else {
      kwEl.innerHTML = `<span style="font:0.78rem 'Plus Jakarta Sans',sans-serif;color:var(--bm-faint)">Add scripture passages to the outline to see key references here.</span>`;
    }
  }
}

// ── Delivery ──────────────────────────────────────────────────────────────────
function _renderDelivery() {
  const s = _active();
  if (!s) return;
  const ac = _qs('bm-altar-call');
  const dn = _qs('bm-delivery-notes');
  const pp = _qs('bm-prayer-prep');
  if (ac) { ac.value = s.altarCall     || ''; _autoResize(ac); }
  if (dn) { dn.value = s.deliveryNotes || ''; _autoResize(dn); }
  if (pp) { pp.value = s.prayerPrep    || ''; _autoResize(pp); }

  // Checklist
  const cl = s.checklist || {};
  document.querySelectorAll('.bm-check-item').forEach(el => {
    el.classList.toggle('checked', !!cl[el.dataset.key]);
  });

  // Timer
  _renderTimer();
  _updateStats();
}

function _renderTimer() {
  const el = _qs('bm-timer-display');
  if (!el) return;
  const sec = Math.floor(S.timer.elapsed);
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s2 = String(sec % 60).padStart(2, '0');
  el.textContent = `${m}:${s2}`;
}

// ── Series ────────────────────────────────────────────────────────────────────
function _renderSeries() {
  const grid = _qs('bm-series-grid');
  if (!grid) return;

  // Group sermons by series
  const map = {};
  S.sermons.forEach(s => {
    const key = (s.series || '').trim() || '(No Series)';
    if (!map[key]) map[key] = [];
    map[key].push(s);
  });

  const keys = Object.keys(map).sort((a, b) => {
    if (a === '(No Series)') return 1;
    if (b === '(No Series)') return -1;
    return a.localeCompare(b);
  });

  if (keys.length === 0) {
    grid.innerHTML = `<div style="font:0.85rem 'Plus Jakarta Sans',sans-serif;color:var(--bm-faint);padding:20px 0">No sermons yet.</div>`;
    return;
  }

  grid.innerHTML = keys.map(k => {
    const items = map[k];
    const latest = items.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a), items[0]);
    const preached = items.filter(x => x.status === 'preached').length;
    return `
      <div class="bm-series-card" data-series="${_e(k)}">
        <div class="bm-series-name">${_e(k)}</div>
        <div class="bm-series-count">${items.length} sermon${items.length !== 1 ? 's' : ''} · ${preached} preached</div>
        <div class="bm-series-date">Last updated ${_fmtDate(latest.updatedAt)}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.bm-series-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.series;
      _qs('bm-search').value = name === '(No Series)' ? '' : name;
      S.search = name === '(No Series)' ? '' : name;
      _renderList();
      _renderTab('outline');
    });
  });
}

// ── Sermon selection ──────────────────────────────────────────────────────────
function _selectSermon(id) {
  S.activeId = id;
  const s = _active();
  if (!s) return;
  S.checklist = s.checklist || {};

  _qs('bm-empty').hidden  = true;
  _qs('bm-editor').hidden = false;
  const saveBtn = _qs('bm-save-btn');
  if (saveBtn) saveBtn.disabled = false;

  // Enable action buttons that require an active sermon
  const dupBtn  = _qs('bm-duplicate-btn');
  const cpyBtn  = _qs('bm-copy-outline-btn');
  const fsBtn   = _qs('bm-send-flockshow-btn');
  if (dupBtn)  dupBtn.disabled  = false;
  if (cpyBtn)  cpyBtn.disabled  = false;
  if (fsBtn)   fsBtn.disabled   = false;

  _renderList();
  _renderEditor();
}

// ── New sermon ────────────────────────────────────────────────────────────────
function _newSermon() {
  const s = _makeSermon();
  S.sermons.unshift(s);
  _lsSync();
  _selectSermon(s.id);
  _queueSave();
  _toast('New sermon created', 'info');
}

// ── Delete sermon ─────────────────────────────────────────────────────────────
// ── Duplicate + Copy + Print ──────────────────────────────────────────────────
function _duplicateSermon() {
  const s = _active();
  if (!s) return;
  const copy = JSON.parse(JSON.stringify(s));
  copy.id        = _uid();
  copy.title     = (s.title || 'Untitled') + ' (Copy)';
  copy.createdAt = copy.updatedAt = _now();
  delete copy._fsId;
  delete copy._gasId;
  S.sermons.unshift(copy);
  _lsSync();
  _selectSermon(copy.id);
  _queueSave();
  _toast('Sermon duplicated', 'success');
}

// ── Send to FlockShow ─────────────────────────────────────────────────────────
async function _sendToFlockShow() {
  const s = _active();
  if (!s) return;
  const slides = [];

  // Title slide
  slides.push({ type: 'announce', text: (s.title || 'Untitled Sermon') + (s.speaker ? '\n' + s.speaker : '') });

  // Passage slide if top-level passage field is set
  if (s.passage) {
    slides.push({ type: 'scripture', text: s.passage, ref: s.passage });
  }

  // One slide per section — scripture sections become scripture slides, points become lyrics
  (s.sections || []).forEach(sec => {
    if (sec.type === 'scripture' && (sec.scriptureRef || sec.scripture)) {
      slides.push({ type: 'scripture', ref: sec.scriptureRef || '', text: sec.scripture || sec.notes || '' });
    } else if (sec.type === 'point' || sec.type === 'intro' || sec.type === 'application') {
      slides.push({ type: 'lyrics', text: sec.title || sec.type, notes: sec.notes || '' });
    }
    // Other types (illustration, transition, prayer, conclusion) are skipped — they are prep material
  });

  // Altar call slide if present
  if (s.altarCall && s.altarCall.trim()) {
    slides.push({ type: 'announce', text: s.altarCall.trim() });
  }

  if (!slides.length) { _toast('No slideable content in this sermon', 'error'); return; }

  const btn = _qs('bm-send-flockshow-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const UR = window.UpperRoom;
    if (!UR || !UR.isReady()) throw new Error('FlockShow backend not available');
    await UR.createPresentation({ name: s.title || 'Untitled Sermon', slides, sermonId: s.id, serviceDate: s.date || '' });
    _toast('Sent to FlockShow ✓ — open FlockShow to view', 'success');
  } catch (err) {
    _toast('FlockShow send failed: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg><span class="bm-btn-label-hide">FlockShow</span>'; }
  }
}

async function _copyOutline() {  const s = _active();
  if (!s) return;
  const lines = [`${s.title || 'Untitled Sermon'}`, s.passage ? `Key Passage: ${s.passage}` : '', ''];
  (s.sections || []).forEach((sec, i) => {
    lines.push(`${i + 1}. [${sec.type.toUpperCase()}] ${sec.title || ''}`);
    if (sec.type === 'scripture' && sec.scriptureRef) {
      lines.push(`   ${sec.scriptureRef}${sec.scripture ? ': ' + sec.scripture.slice(0, 100) : ''}`);
    }
    if ((sec.notes || '').trim()) lines.push(`   ${sec.notes.trim()}`);
    lines.push('');
  });
  try {
    await navigator.clipboard.writeText(lines.join('\n').trim());
    _toast('Outline copied to clipboard', 'success');
  } catch {
    _toast('Could not access clipboard', 'error');
  }
}

function _bindKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Ctrl/Cmd+S — Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const s = _active();
      if (!s) return;
      clearTimeout(_saveTimer);
      _saveSermon(s).then(() => _toast('Saved', 'success'));
    }
    // Ctrl/Cmd+N — New sermon
    if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
      e.preventDefault();
      _newSermon();
    }
  });
}

// ── Input modal (replaces prompt() for text input) ────────────────────────────
function _openInputModal(placeholder, title, okLabel, onConfirm) {
  const modal  = _qs('bm-input-modal');
  const field  = _qs('bm-input-modal-field');
  const titleEl = _qs('bm-input-modal-h');
  const okBtn  = _qs('bm-input-modal-ok');
  const cancelBtn = _qs('bm-input-modal-cancel');
  const backdrop  = _qs('bm-input-modal-backdrop');
  if (!modal || !field) { onConfirm(placeholder); return; }

  if (titleEl) titleEl.textContent = title || 'Enter Name';
  if (okBtn)   okBtn.textContent   = okLabel || 'OK';
  field.value       = '';
  field.placeholder = placeholder || '';
  modal.hidden      = false;
  field.focus();

  function _close() {
    modal.hidden = true;
    okBtn.removeEventListener('click', _ok);
    cancelBtn.removeEventListener('click', _close);
    backdrop.removeEventListener('click', _close);
    field.removeEventListener('keydown', _key);
  }
  function _ok() {
    const val = field.value.trim();
    _close();
    onConfirm(val || null);
  }
  function _key(e) {
    if (e.key === 'Enter')  { e.preventDefault(); _ok(); }
    if (e.key === 'Escape') { _close(); }
  }
  okBtn.addEventListener('click', _ok);
  cancelBtn.addEventListener('click', _close);
  backdrop.addEventListener('click', _close);
  field.addEventListener('keydown', _key);
}

// ── Confirm delete ────────────────────────────────────────────────────────────
function _confirmDelete() {
  const s = _active();
  if (!s) return;
  _qs('bm-modal-h').textContent = 'Delete Sermon?';
  _qs('bm-modal-p').textContent = `"${s.title || 'Untitled'}" will be permanently deleted. This cannot be undone.`;
  _qs('bm-confirm-modal').hidden = false;
  _qs('bm-modal-confirm').onclick = async () => {
    _qs('bm-confirm-modal').hidden = true;
    const item = document.querySelector(`.bm-sermon-item[data-id="${_e(s.id)}"]`);
    if (item) { item.classList.add('removing'); await new Promise(r => setTimeout(r, 220)); }
    await _deleteSermon(s);
    S.activeId = null;
    _qs('bm-empty').hidden  = false;
    _qs('bm-editor').hidden = true;
    const titleEl = _qs('bm-active-title');
    if (titleEl) { titleEl.textContent = 'No sermon selected'; titleEl.classList.remove('has-sermon'); }
    const saveBtn = _qs('bm-save-btn');
    if (saveBtn) saveBtn.disabled = true;
    _renderList();
    _toast('Sermon deleted', 'error');
  };
  _qs('bm-modal-cancel').onclick = () => { _qs('bm-confirm-modal').hidden = true; };
  _qs('bm-modal-backdrop').onclick = () => { _qs('bm-confirm-modal').hidden = true; };
}

// ── Header field changes ──────────────────────────────────────────────────────
function _bindHeaderFields() {
  const fields = ['title','series','date','speaker','passage'];
  fields.forEach(f => {
    const el = _qs(`bm-field-${f}`);
    if (!el) return;
    el.addEventListener('input', () => {
      const s = _active();
      if (!s) return;
      s[f] = el.value;
      if (f === 'title') {
        const titleEl = _qs('bm-active-title');
        if (titleEl) { titleEl.textContent = el.value || 'Untitled Sermon'; titleEl.classList.toggle('has-sermon', !!el.value); }
        _renderList();
      }
      _queueSave();
    });
  });
}

// ── Status cycle ──────────────────────────────────────────────────────────────
function _cycleStatus() {
  const s = _active();
  if (!s) return;
  const cur = STATUS_CYCLE.indexOf(s.status || 'draft');
  s.status = STATUS_CYCLE[(cur + 1) % STATUS_CYCLE.length];
  _renderStatus(s);
  _renderList();
  _queueSave();
  _toast(`Status: ${STATUS_LABELS[s.status]}`, 'info');
}

// ── Manuscript area ───────────────────────────────────────────────────────────
function _bindManuscript() {
  const area = _qs('bm-manuscript-area');
  if (!area) return;
  area.addEventListener('input', () => {
    _autoResize(area);
    const s = _active();
    if (!s) return;
    s.manuscript = area.value;
    _queueSave();
    _updateStats();
  });

  // Toolbar formatting (only meaningful in edit mode)
  document.querySelectorAll('.bm-ms-tool[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      area.focus();
      document.execCommand(btn.dataset.cmd, false, null);
    });
  });
  document.querySelectorAll('.bm-ms-tool[data-insert]').forEach(btn => {
    btn.addEventListener('click', () => {
      // If in preview mode, switch to edit first
      if (_msPreviewMode) _setMsMode(false);
      area.focus();
      const start = area.selectionStart;
      const val   = area.value;
      const ins   = btn.dataset.insert;
      area.value  = val.slice(0, start) + ins + val.slice(area.selectionEnd);
      area.selectionStart = area.selectionEnd = start + ins.length;
      area.dispatchEvent(new Event('input'));
    });
  });

  // Edit / View toggle buttons
  const editBtn = document.getElementById('bm-ms-edit-btn');
  const viewBtn = document.getElementById('bm-ms-view-btn');
  if (editBtn) editBtn.addEventListener('click', () => _setMsMode(false));
  if (viewBtn) viewBtn.addEventListener('click', () => _setMsMode(true));

  // Click on preview → switch to edit at that position
  const preview = document.getElementById('bm-ms-preview');
  if (preview) preview.addEventListener('dblclick', () => _setMsMode(false));

  // Import from outline
  const importBtn = _qs('bm-ms-import-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const s = _active();
      if (!s || !s.sections.length) { _toast('No outline sections to import', 'error'); return; }
      const existing = (s.manuscript || '').trim();
      const imported = _buildManuscriptFromOutline(s);
      s.manuscript = (existing ? existing + '\n\n' : '') + imported;
      area.value = s.manuscript;
      _autoResize(area);
      _updateStats();
      _queueSave();
      _refreshMsPreview();
      if (!_msPreviewMode) { /* stay in edit */ } else { _setMsMode(true); }
      _toast('Outline imported to manuscript', 'success');
    });
  }
}

// ── Research fields ───────────────────────────────────────────────────────────
function _bindResearch() {
  const rn = _qs('bm-research-notes');
  const rq = _qs('bm-research-quotes');
  [rn, rq].forEach(el => {
    if (!el) return;
    el.addEventListener('input', () => {
      _autoResize(el);
      const s = _active();
      if (!s) return;
      if (el.id === 'bm-research-notes')  s.researchNotes  = el.value;
      if (el.id === 'bm-research-quotes') s.researchQuotes = el.value;
      _queueSave();
    });
  });

  // Scripture lookup button + Enter key
  const lookupInput = _qs('bm-lookup-input');
  const lookupBtn   = _qs('bm-lookup-btn');
  if (lookupInput) {
    lookupInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const ref = lookupInput.value.trim();
        if (ref) _doScriptureLookup(ref);
      }
    });
  }
  if (lookupBtn) {
    lookupBtn.addEventListener('click', () => {
      const ref = (lookupInput ? lookupInput.value.trim() : '');
      if (ref) _doScriptureLookup(ref);
    });
  }

  // Lexicon search (simple Strong's lookup using Data/ if loaded)
  const lexInput = _qs('bm-lex-input');
  if (lexInput) {
    lexInput.addEventListener('keydown', e => { if (e.key === 'Enter') _doLexLookup(lexInput.value.trim()); });
  }

  // Cross-ref clicks
  document.querySelectorAll('.bm-cross-ref-item').forEach(el => {
    el.addEventListener('click', () => {
      const ref = el.dataset.ref;
      if (ref) _doScriptureLookup(ref, true);
    });
  });
}

// ── Scripture lookup (sidebar) ────────────────────────────────────────────────
// ── Translation config ─────────────────────────────────────────────────────────
// apiCode: translation code for bible-api.com (null = copyrighted, use BLB link only)
// blbCode: translation code for blueletterbible.org URLs
// bibleComVersion: YouVersion version_id — when set, Go opens bible.com instead of showing a "licensed" message
const _TRANSLATIONS = {
  KJV:   { apiCode: 'kjv',   blbCode: 'KJV'                     },
  NKJV:  { apiCode: null,    blbCode: 'NKJV', bibleComVersion: 114 },
  ESV:   { apiCode: null,    blbCode: 'ESV',  bibleComVersion: 59  },
  NIV:   { apiCode: null,    blbCode: 'NIV',  bibleComVersion: 111 },
  NASB:  { apiCode: null,    blbCode: 'NASB', bibleComVersion: 100 },
  NLT:   { apiCode: null,    blbCode: 'NLT',  bibleComVersion: 116 },
  AMP:   { apiCode: null,    blbCode: 'AMP',  bibleComVersion: 1588 },
  CSB:   { apiCode: null,    blbCode: 'CSB',  bibleComVersion: 1713 },
  ASV:   { apiCode: 'asv',   blbCode: 'ASV'                     },
  WEB:   { apiCode: 'web',   blbCode: 'WEB'                     },
  YLT:   { apiCode: 'ylt',   blbCode: 'YLT'                     },
  DARBY: { apiCode: 'darby', blbCode: 'DARBY'                   },
};

function _blbMultiVerseUrl(ref, blbCode) {
  return `https://www.blueletterbible.org/tools/MultiVerse.cfm?t=${blbCode}&verses=${encodeURIComponent(ref)}`;
}

async function _doScriptureLookup(rawRef, suppressAdd = false) {
  const refEl   = _qs('bm-lookup-ref');
  const textEl  = _qs('bm-lookup-text');
  const resEl   = _qs('bm-lookup-result');
  const blbLink = _qs('bm-lookup-blb-link');
  if (!refEl || !textEl || !resEl) return;

  // Read selected translation
  const selectEl   = _qs('bm-translation-select');
  const transKey   = (selectEl ? selectEl.value : 'KJV') || 'KJV';
  const transConf  = _TRANSLATIONS[transKey] || _TRANSLATIONS.KJV;

  // Always wire the BLB MultiVerse link
  if (blbLink) {
    blbLink.href = _blbMultiVerseUrl(rawRef, transConf.blbCode);
    blbLink.textContent = `View on Blue Letter Bible (${transKey})`;
  }

  refEl.textContent  = `${rawRef}  ·  ${transKey}`;
  textEl.textContent = 'Looking up…';
  resEl.classList.add('visible');

  let text = '';

  if (transConf.apiCode) {
    // Public domain — fetch inline via bible-api.com
    try {
      const resp = await fetch(
        `https://bible-api.com/${encodeURIComponent(rawRef)}?translation=${transConf.apiCode}`
      );
      if (resp.ok) {
        const data = await resp.json();
        // Multi-verse refs return an array in data.verses; single refs return data.text
        if (Array.isArray(data.verses) && data.verses.length) {
          text = data.verses.map(v => `[${v.book_name} ${v.chapter}:${v.verse}] ${v.text.trim()}`).join('\n');
        } else {
          text = (data.text || '').trim();
        }
      }
    } catch (_) {}
    textEl.textContent = text || 'Verse not found. Check the reference (e.g. John 3:16 or John 3:16-18).';
  } else if (transConf.bibleComVersion) {
    // Licensed translation with YouVersion ID — open bible.com directly
    const bcUrl = `https://www.bible.com/search/bible?q=${encodeURIComponent(rawRef)}&version_id=${transConf.bibleComVersion}`;
    window.open(bcUrl, '_blank', 'noopener');
    textEl.innerHTML = `<a href="${bcUrl}" target="_blank" rel="noopener" style="color:var(--bm-accent)">${_e(rawRef)} · ${transKey} — Opening in Bible.com ↗</a>`;
    text = '';
  } else {
    // Copyrighted translation — can't fetch; direct to BLB
    textEl.innerHTML = `<em style="color:var(--bm-muted);font-style:normal;font-size:0.75rem">${transKey} is a licensed translation and cannot be fetched directly. Use the Blue Letter Bible link below to read it.</em>`;
    text = '';
  }

  const addBtn = _qs('bm-lookup-add-btn');
  if (addBtn) {
    addBtn.style.display = (!suppressAdd && text) ? '' : 'none';
    addBtn.onclick = () => {
      const s = _active();
      if (!s) { _toast('Select a sermon first', 'error'); return; }
      const sec = _makeSection('scripture', rawRef);
      sec.scriptureRef = rawRef;
      sec.scripture    = text || '';
      s.sections.push(sec);
      _renderOutline();
      _queueSave();
      _toast(`Added "${rawRef}" to outline`, 'success');
    };
  }
}

// Try to fetch verse from any Bible data loaded on window (legacy local cache)
function _fetchVerse(ref) {
  if (window._bibleKJV && typeof window._bibleKJV === 'object') {
    return window._bibleKJV[ref.trim()] || '';
  }
  return '';
}

// ── Lexicon lookup ────────────────────────────────────────────────────────────

/** Build a BLB MGNT/BDB lexicon URL for a Strong's number */
function _blbLexUrl(query) {
  const uq = query.toUpperCase();
  if (/^G\d+/i.test(uq)) {
    const num = uq.replace('G','');
    return `https://www.blueletterbible.org/lexicon/g${num}/nasb95/mgnt/0-1/`;
  }
  if (/^H\d+/i.test(uq)) {
    const num = uq.replace('H','');
    return `https://www.blueletterbible.org/lexicon/h${num}/nasb95/wlc/0-1/`;
  }
  return `https://www.blueletterbible.org/search/search.cfm?Criteria=${encodeURIComponent(query)}&t=NASB95`;
}

function _doLexLookup(query) {
  const res = _qs('bm-lex-result');
  if (!res || !query) return;

  const isStrongs = /^[GH]\d+$/i.test(query.trim());
  const blbUrl = _blbLexUrl(query.trim());

  // ── 1. Firestore words collection (flockos-notify) ────────────────────────
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
    const db = firebase.firestore();

    const _applyDoc = (docData) => {
      _qs('bm-lex-word').textContent     = docData.lemma       || query;
      _qs('bm-lex-strongs').textContent  = docData.strongs     || docData.id || '';
      _qs('bm-lex-translit').textContent = docData.xlit        || docData.pron || '';
      _qs('bm-lex-def').innerHTML        = `${_e(docData.strongs_def || docData.kjv_def || '')} <a href="${blbUrl}" target="_blank" rel="noopener" style="color:var(--bm-accent);font-size:0.78rem;white-space:nowrap">Open in BLB ↗</a>`;
      _qs('bm-lex-origin').textContent   = docData.derivation  || '';
      res.classList.add('visible');
    };

    if (isStrongs) {
      db.collection('words').doc(query.toUpperCase().trim()).get()
        .then(doc => { if (doc.exists) { _applyDoc({ id: doc.id, ...doc.data() }); } else { _applyFallback(); } })
        .catch(e => { console.warn('[TheFeed] Lexicon lookup failed:', e); _applyFallback(); });
      return;
    } else {
      const lq = query.trim();
      Promise.all([
        db.collection('words').where('lemma', '==', lq).limit(1).get(),
        db.collection('words').where('kjv_def', '>=', lq.toLowerCase()).where('kjv_def', '<=', lq.toLowerCase() + '\uf8ff').limit(1).get()
      ]).then(([byLemma, byKjv]) => {
        const hit = !byLemma.empty ? byLemma.docs[0] : (!byKjv.empty ? byKjv.docs[0] : null);
        if (hit) { _applyDoc({ id: hit.id, ...hit.data() }); } else { _applyFallback(); }
      }).catch(e => { console.warn('[TheFeed] Lexicon lookup failed:', e); _applyFallback(); });
      return;
    }
  }

  // ── 2. Legacy window globals fallback ─────────────────────────────────────
  let entry = null;
  if (isStrongs && /^G/i.test(query) && window._strongsGreek) {
    const num = query.toUpperCase().replace('G', '');
    entry = window._strongsGreek[num] || window._strongsGreek['G' + num];
  } else if (isStrongs && /^H/i.test(query) && window._strongsHebrew) {
    const num = query.toUpperCase().replace('H', '');
    entry = window._strongsHebrew[num] || window._strongsHebrew['H' + num];
  } else if (!isStrongs && (window._strongsGreek || window._strongsHebrew)) {
    const lq = query.toLowerCase();
    const gk = window._strongsGreek  ? Object.values(window._strongsGreek).find(e => (e.word || '').toLowerCase() === lq || (e.translit || '').toLowerCase() === lq) : null;
    const hb = window._strongsHebrew ? Object.values(window._strongsHebrew).find(e => (e.word || '').toLowerCase() === lq || (e.translit || '').toLowerCase() === lq) : null;
    entry = gk || hb;
  }
  if (entry) {
    _qs('bm-lex-word').textContent     = entry.word        || query;
    _qs('bm-lex-strongs').textContent  = entry.strongs     || '';
    _qs('bm-lex-translit').textContent = entry.translit    || '';
    _qs('bm-lex-def').innerHTML        = `${_e(entry.definition || entry.def || '')} <a href="${blbUrl}" target="_blank" rel="noopener" style="color:var(--bm-accent);font-size:0.78rem;white-space:nowrap">Open in BLB ↗</a>`;
    _qs('bm-lex-origin').textContent   = entry.origin      || '';
    res.classList.add('visible');
    return;
  }

  _applyFallback();

  function _applyFallback() {
    _qs('bm-lex-word').textContent     = query;
    _qs('bm-lex-strongs').textContent  = '';
    _qs('bm-lex-translit').textContent = '';
    _qs('bm-lex-def').innerHTML        = `<a href="${blbUrl}" target="_blank" rel="noopener" style="color:var(--bm-accent)">Search BLB Lexicon ↗</a>`;
    _qs('bm-lex-origin').textContent   = '';
    res.classList.add('visible');
  }
}

// ── Delivery fields ───────────────────────────────────────────────────────────
function _bindDelivery() {
  ['bm-altar-call','bm-delivery-notes','bm-prayer-prep'].forEach(id => {
    const el = _qs(id);
    if (!el) return;
    el.addEventListener('input', () => {
      _autoResize(el);
      const s = _active();
      if (!s) return;
      if (id === 'bm-altar-call')    s.altarCall     = el.value;
      if (id === 'bm-delivery-notes') s.deliveryNotes = el.value;
      if (id === 'bm-prayer-prep')   s.prayerPrep    = el.value;
      _queueSave();
    });
  });

  // Timer
  const startBtn  = _qs('bm-timer-start');
  const resetBtn  = _qs('bm-timer-reset');
  const durationEl = _qs('bm-duration-slider');
  const durationVal = _qs('bm-duration-val');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (S.timer.running) {
        // Pause
        S.timer.running = false;
        S.timer.elapsed += (_now() - S.timer.startTs) / 1000;
        clearInterval(S.timer.interval);
        startBtn.textContent = 'Resume';
      } else {
        S.timer.running = true;
        S.timer.startTs = _now();
        startBtn.textContent = 'Pause';
        S.timer.interval = setInterval(() => {
          S.timer.elapsed = Math.floor(S.timer.elapsed) + (_now() - S.timer.startTs) / 1000;
          _renderTimer();
        }, 1000);
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      S.timer.running = false;
      S.timer.elapsed = 0;
      S.timer.startTs = null;
      clearInterval(S.timer.interval);
      if (startBtn) startBtn.textContent = 'Start';
      _renderTimer();
    });
  }

  if (durationEl) {
    durationEl.addEventListener('input', () => {
      S.prefs.targetDuration = parseInt(durationEl.value, 10);
      if (durationVal) durationVal.textContent = durationEl.value + ' min';
      try { localStorage.setItem(BM_PREFS_KEY, JSON.stringify(S.prefs)); } catch (_) {}
    });
  }

  // Checklist
  document.querySelectorAll('.bm-check-item').forEach(el => {
    el.addEventListener('click', () => {
      const s = _active();
      if (!s) return;
      const key = el.dataset.key;
      if (!s.checklist) s.checklist = {};
      s.checklist[key] = !s.checklist[key];
      el.classList.toggle('checked', !!s.checklist[key]);
      _queueSave();
    });
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────
// The Feed uses the standalone login page at app.feed/index.html (mirrors Stand).
// If the user isn't authenticated, redirect them there. Otherwise run the app.
function _waitForAuth(cb) {
  const LOGIN_URL = 'app.feed/index.html';

  const tryAuth = () => {
    const N = window.Nehemiah;
    if (!N) return false;

    // Prefer onAuthReady if available — handles async session restore
    if (typeof N.onAuthReady === 'function') {
      N.onAuthReady(user => {
        if (user) { S.user = user; cb(user); }
        else { window.location.replace(LOGIN_URL); }
      });
      return true;
    }

    // Fallback: synchronous isAuthenticated()/getSession() (Stand pattern)
    if (typeof N.isAuthenticated === 'function') {
      if (!N.isAuthenticated()) { window.location.replace(LOGIN_URL); return true; }
      const sess = (N.getSession ? N.getSession() : null) || {};
      const user = {
        displayName: sess.displayName || sess.email || 'User',
        email:       sess.email || '',
        role:        sess.role  || 'member',
      };
      S.user = user;
      cb(user);
      return true;
    }
    return false;
  };

  if (tryAuth()) return;

  // Retry up to 5s for Nehemiah to load
  let tries = 0;
  const check = setInterval(() => {
    tries++;
    if (tryAuth()) { clearInterval(check); return; }
    if (tries > 50) {
      clearInterval(check);
      // Auth system never loaded — send to login screen
      window.location.replace(LOGIN_URL);
    }
  }, 100);
}

function _hideAuth(user) {
  // Login screen is a separate page; nothing to hide here.
  // User chip
  const avatar = _qs('bm-user-avatar');
  const name   = _qs('bm-user-name');
  if (avatar) avatar.textContent = (user.displayName || user.email || '?')[0].toUpperCase();
  if (name)   name.textContent   = user.displayName  || user.email || 'User';
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function _init() {
  // Load prefs
  try {
    const p = JSON.parse(localStorage.getItem(BM_PREFS_KEY) || '{}');
    Object.assign(S.prefs, p);
    const ds = _qs('bm-duration-slider');
    const dv = _qs('bm-duration-val');
    if (ds) { ds.value = S.prefs.targetDuration; }
    if (dv) { dv.textContent = S.prefs.targetDuration + ' min'; }
  } catch (_) {}

  _waitForAuth(async user => {
    _hideAuth(user);

    // Initialize Firestore (UpperRoom) if the login page didn't already do it.
    // On feed.html, UpperRoom is defined but never init'd unless we do it here.
    if (window.UpperRoom) {
      try {
        if (!window.UpperRoom.isReady()) {
          await window.UpperRoom.init();
          await window.UpperRoom.authenticate();
        }
        if (typeof window.UpperRoom.waitReady === 'function') {
          await window.UpperRoom.waitReady();
        }
      } catch (_) {}
    }

    await _load();
    _renderList();
    _renderSeries();
  });

  // Bindings
  _bindHeaderFields();
  _bindManuscript();
  _bindResearch();
  _bindDelivery();

  // New sermon buttons
  ['bm-new-btn','bm-empty-new-btn'].forEach(id => {
    const el = _qs(id);
    if (el) el.addEventListener('click', _newSermon);
  });

  // New series button (opens new sermon with series prompt)
  const nsBtn = _qs('bm-new-series-btn');
  if (nsBtn) {
    nsBtn.addEventListener('click', () => {
      _openInputModal('New Series', 'Series Name', 'Create', name => {
        if (!name) return;
        const s = _makeSermon(`${name} — Week 1`);
        s.series = name.trim();
        S.sermons.unshift(s);
        _lsSync();
        _selectSermon(s.id);
        _queueSave();
        _toast(`Series "${name}" created`, 'success');
      });
    });
  }

  // Delete
  const delBtn = _qs('bm-delete-btn');
  if (delBtn) delBtn.addEventListener('click', _confirmDelete);

  // Save
  const saveBtn = _qs('bm-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      clearTimeout(_saveTimer);
      const s = _active();
      if (!s) return;
      await _saveSermon(s);
      saveBtn.textContent = 'Saved ✓';
      _toast('Sermon saved', 'success');
    });
  }

  // Status
  const statusBtn = _qs('bm-status-btn');
  if (statusBtn) statusBtn.addEventListener('click', _cycleStatus);

  // Tab bar
  document.querySelectorAll('.bm-tab').forEach(btn => {
    btn.addEventListener('click', () => _renderTab(btn.dataset.tab));
  });

  // Search
  const searchEl = _qs('bm-search');
  if (searchEl) {
    searchEl.addEventListener('input', () => { S.search = searchEl.value; _renderList(); });
  }

  // Scripture lookup
  const lookupBtn   = _qs('bm-lookup-btn');
  const lookupInput = _qs('bm-lookup-input');
  if (lookupBtn && lookupInput) {
    lookupBtn.addEventListener('click', () => _doScriptureLookup(lookupInput.value.trim()));
    lookupInput.addEventListener('keydown', e => { if (e.key === 'Enter') _doScriptureLookup(lookupInput.value.trim()); });
  }

  // Suggest chips → append to active section note
  document.querySelectorAll('.bm-chip').forEach(el => {
    el.addEventListener('click', () => {
      const s = _active();
      if (!s || !s.sections.length) { _toast('Select a sermon first', 'error'); return; }
      const last = s.sections[s.sections.length - 1];
      last.notes = (last.notes ? last.notes + '\n' : '') + `[Theme: ${el.textContent}]`;
      if (S.activeTab === 'outline') _renderOutline();
      _queueSave();
      _toast(`Theme "${el.textContent}" added to last section`, 'info');
    });
  });

  // Add section buttons
  document.querySelectorAll('.bm-add-section-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = _active();
      if (!s) { _toast('Select a sermon first', 'error'); return; }
      s.sections.push(_makeSection(btn.dataset.type));
      _renderOutline();
      _queueSave();
    });
  });

  // Mobile hamburger
  const hamburger = _qs('bm-hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      const sb = _qs('bm-sidebar');
      if (sb) sb.classList.toggle('is-open');
    });
  }

  // Duplicate sermon
  const dupBtn = _qs('bm-duplicate-btn');
  if (dupBtn) dupBtn.addEventListener('click', _duplicateSermon);

  // Copy outline to clipboard
  const cpyBtn = _qs('bm-copy-outline-btn');
  if (cpyBtn) cpyBtn.addEventListener('click', _copyOutline);

  // Send to FlockShow
  const fsBtn = _qs('bm-send-flockshow-btn');
  if (fsBtn) fsBtn.addEventListener('click', _sendToFlockShow);

  // Print / export to PDF
  const printBtn = _qs('bm-print-btn');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  // Filter pills
  document.querySelectorAll('.bm-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      S.filterStatus = btn.dataset.filter || 'all';
      document.querySelectorAll('.bm-filter-pill').forEach(p =>
        p.classList.toggle('bm-filter-pill--active', p === btn)
      );
      _renderList();
    });
  });

  // Sort select
  const sortSel = _qs('bm-sort-select');
  if (sortSel) {
    sortSel.addEventListener('change', () => { S.sortBy = sortSel.value; _renderList(); });
  }

  // Keyboard shortcuts
  _bindKeyboardShortcuts();

  // User chip → sign out
  const userChip = _qs('bm-user-chip');
  if (userChip) {
    userChip.addEventListener('click', () => {
      const N = window.Nehemiah;
      if (N && typeof N.signOut === 'function') {
        if (confirm('Sign out of The Feed?')) N.signOut();
      }
    });
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}
