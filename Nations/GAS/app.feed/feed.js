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
    // Auto-seed from outline the first time the manuscript tab is opened
    if (!s.manuscript && s.sections && s.sections.length) {
      s.manuscript = _buildManuscriptFromOutline(s);
      _queueSave();
    }
    area.value = s.manuscript || '';
    _autoResize(area);
  }
  _updateStats();
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
  if (dupBtn)  dupBtn.disabled  = false;
  if (cpyBtn)  cpyBtn.disabled  = false;

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

async function _copyOutline() {
  const s = _active();
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

  // Toolbar
  document.querySelectorAll('.bm-ms-tool[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      area.focus();
      document.execCommand(btn.dataset.cmd, false, null);
    });
  });
  document.querySelectorAll('.bm-ms-tool[data-insert]').forEach(btn => {
    btn.addEventListener('click', () => {
      area.focus();
      const start = area.selectionStart;
      const val   = area.value;
      const ins   = btn.dataset.insert;
      area.value  = val.slice(0, start) + ins + val.slice(area.selectionEnd);
      area.selectionStart = area.selectionEnd = start + ins.length;
      area.dispatchEvent(new Event('input'));
    });
  });

  // Import from outline
  const importBtn = _qs('bm-ms-import-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const s = _active();
      if (!s || !s.sections.length) { _toast('No outline sections to import', 'error'); return; }
      const existing = area.value.trim();
      const imported = _buildManuscriptFromOutline(s);
      area.value = (existing ? existing + '\n\n' : '') + imported;
      s.manuscript = area.value;
      _autoResize(area);
      _updateStats();
      _queueSave();
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
function _doScriptureLookup(rawRef, suppressAdd = false) {
  // Try to pull from window._bibleData if loaded by GROW
  const refEl  = _qs('bm-lookup-ref');
  const textEl = _qs('bm-lookup-text');
  const resEl  = _qs('bm-lookup-result');
  if (!refEl || !textEl || !resEl) return;

  const text = _fetchVerse(rawRef);
  refEl.textContent  = rawRef;
  textEl.textContent = text || 'Scripture text not available offline. Add passage manually.';
  resEl.classList.add('visible');

  const addBtn = _qs('bm-lookup-add-btn');
  if (addBtn && !suppressAdd) {
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

// Try to fetch verse from any Bible data loaded on window
function _fetchVerse(ref) {
  // GROW may expose window._bibleKJV or similar
  if (window._bibleKJV && typeof window._bibleKJV === 'object') {
    const norm = ref.trim();
    return window._bibleKJV[norm] || '';
  }
  return '';
}

// ── Lexicon lookup ────────────────────────────────────────────────────────────
function _doLexLookup(query) {
  const res = _qs('bm-lex-result');
  if (!res) return;
  if (!query) return;

  let entry = null;

  // Try Greek or Hebrew lexicon if loaded via Data/
  const isGreek  = /^G\d+$/i.test(query);
  const isHebrew = /^H\d+$/i.test(query);

  if (isGreek && window._strongsGreek) {
    const num = query.toUpperCase().replace('G','');
    entry = window._strongsGreek[num] || window._strongsGreek['G' + num];
  } else if (isHebrew && window._strongsHebrew) {
    const num = query.toUpperCase().replace('H','');
    entry = window._strongsHebrew[num] || window._strongsHebrew['H' + num];
  } else if (window._strongsGreek || window._strongsHebrew) {
    // Text search
    const lq = query.toLowerCase();
    const gk = window._strongsGreek  ? Object.values(window._strongsGreek).find(e => (e.word || '').toLowerCase() === lq || (e.translit || '').toLowerCase() === lq) : null;
    const hb = window._strongsHebrew ? Object.values(window._strongsHebrew).find(e => (e.word || '').toLowerCase() === lq || (e.translit || '').toLowerCase() === lq) : null;
    entry = gk || hb;
  }

  if (!entry) {
    _qs('bm-lex-word').textContent    = query;
    _qs('bm-lex-strongs').textContent = '';
    _qs('bm-lex-translit').textContent= '';
    _qs('bm-lex-def').textContent     = 'No entry found. Make sure the lexicon data is loaded, or try a Strong\'s number (e.g. G3056 or H1254).';
    _qs('bm-lex-origin').textContent  = '';
    res.classList.add('visible');
    return;
  }

  _qs('bm-lex-word').textContent    = entry.word        || query;
  _qs('bm-lex-strongs').textContent = entry.strongs     || '';
  _qs('bm-lex-translit').textContent= entry.translit    || '';
  _qs('bm-lex-def').textContent     = entry.definition  || entry.def || '';
  _qs('bm-lex-origin').textContent  = entry.origin      || '';
  res.classList.add('visible');
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
