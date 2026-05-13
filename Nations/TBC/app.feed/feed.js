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

const SECTION_TYPES = ['intro','scripture','point','illustration','explanation','application','prayer','conclusion','transition'];

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
    explanation:  'Explanation',
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
    ],
    manuscript:   '',
    _msSeeded:    true, // true = manuscript is outline-derived; false = pastor has written custom prose
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
      const msChanged = _syncManuscriptToOutline(s);
      await _saveSermon(s);
      if (msChanged && S.activeTab === 'manuscript') {
        const area = _qs('bm-manuscript-area');
        if (area && !_msPreviewMode) area.value = s.manuscript || '';
        _refreshMsPreview();
      }
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
    explanation:  'Detailed explanation of this passage or point — historical background, original language, theological depth…',
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

/* Build the seeded block for a single section (what we'd write if seeding it fresh) */
function _buildSectionBlock(sec) {
  let block = `== ${(sec.title || '').toUpperCase()} ==\n`;
  if (sec.type === 'scripture' && sec.scriptureRef) block += `[${sec.scriptureRef}]\n${sec.scripture || ''}\n`;
  if (sec.notes) block += `\n${sec.notes}`;
  return block.trim();
}

/*
 * Sync outline → manuscript on every save:
 * - Missing sections are appended to the bottom.
 * - Existing section blocks whose body still matches the original seed (pastor
 *   hasn't expanded them yet) are updated in-place so title/notes/scripture
 *   changes show up immediately.
 * - Any block the pastor has genuinely written into is left untouched.
 * Returns true if the manuscript was modified.
 */
function _syncManuscriptToOutline(s) {
  if (!s || !s.sections || !s.sections.length) return false;

  // Full rebuild if manuscript is empty OR the pastor hasn't written custom prose yet.
  // _msSeeded stays true until the pastor types directly in the manuscript editor.
  if (_manuscriptIsEmpty(s.manuscript) || s._msSeeded !== false) {
    s.manuscript = _buildManuscriptFromOutline(s);
    return true;
  }

  let ms = (s.manuscript || '').trimEnd();
  let changed = false;

  // Split manuscript into blocks keyed by their == TITLE == header
  // We'll rebuild a map: titleUpper → {header, body, fullBlock}
  const blockRe = /(==\s*[^=\n]+\s*==)([\s\S]*?)(?=(?:==\s*[^=\n]+\s*==)|$)/g;
  const existingBlocks = {}; // key: normalized title → { header, body }
  let m;
  while ((m = blockRe.exec(ms)) !== null) {
    const header = m[1].trim();
    const body   = m[2];
    const key    = header.replace(/^==\s*/, '').replace(/\s*==$/, '').trim().toUpperCase();
    existingBlocks[key] = { header, body, full: m[0] };
  }

  s.sections.forEach(sec => {
    if (!sec.title || !sec.title.trim()) return;
    const key = sec.title.trim().toUpperCase();
    const newBlock = _buildSectionBlock(sec);

    if (!existingBlocks[key]) {
      // Section doesn't exist in the manuscript yet — append it
      ms = ms + '\n\n' + newBlock;
      changed = true;
    } else {
      // Section exists — check if the body still matches what the seed would
      // have produced (i.e., the pastor hasn't written custom prose in it yet).
      // If so, we can safely update it with the latest outline content.
      const existing = existingBlocks[key];
      const existingBody = existing.body.trim();

      // Build what the seed body would have been (everything after the header)
      const seedBlock = newBlock;
      const seedHeaderEnd = seedBlock.indexOf('\n');
      const seedBody = (seedHeaderEnd >= 0 ? seedBlock.slice(seedHeaderEnd) : '').trim();

      // Only auto-update if the current body == seed body (or the seed body is
      // non-empty and the current body is empty — same thing as "not expanded")
      const bodyMatchesSeed = existingBody === seedBody;
      const bodyIsEmpty = existingBody.length === 0;

      if (bodyMatchesSeed || bodyIsEmpty) {
        // Safe to update in-place: replace old full block with new seeded block
        if (existing.full.trim() !== newBlock) {
          // Use a replacer function so $ characters in newBlock aren't misinterpreted
          ms = ms.replace(existing.full, () => '\n' + newBlock + '\n');
          changed = true;
        }
      }
      // Otherwise: pastor has written custom content → leave it alone
    }
  });

  if (changed) {
    // Normalise double+ blank lines
    s.manuscript = ms.replace(/\n{3,}/g, '\n\n').trim();
  }
  return changed;
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
  // In preview mode always read from the sermon model (source of truth) so that
  // sync updates are visible immediately without needing a textarea round-trip.
  const raw = (_msPreviewMode || !area)
    ? (_active() ? (_active().manuscript || '') : '')
    : area.value;
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
  _renderBookOverview();
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
      if (f === 'passage' && S.activeTab === 'research') _renderBookOverview();
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
    s._msSeeded = false; // pastor is writing custom prose — stop auto-rebuilding from outline
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
  // Must wait for auth — Firestore rules require request.auth != null
  if (_fsFB()) {
    _doLexFirestore(query, isStrongs, blbUrl, res);
    return;
  }

  if (window.UpperRoom && typeof window.UpperRoom.waitReady === 'function') {
    // Show a "connecting" state and retry once auth resolves
    _qs('bm-lex-word').textContent    = query;
    _qs('bm-lex-strongs').textContent = '';
    _qs('bm-lex-translit').textContent = '';
    _qs('bm-lex-def').textContent     = 'Connecting to database…';
    _qs('bm-lex-origin').textContent  = '';
    res.classList.add('visible');
    window.UpperRoom.waitReady()
      .then(() => _doLexFirestore(query, isStrongs, blbUrl, res))
      .catch(() => _doLexFallback(query, blbUrl, res));
    return;
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

  _doLexFallback(query, blbUrl, res);
}

// Extracted Firestore query — called once auth is confirmed ready
function _doLexFirestore(query, isStrongs, blbUrl, res) {
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
      .then(doc => {
        if (doc.exists) { _applyDoc({ id: doc.id, ...doc.data() }); }
        else { _doLexFallback(query, blbUrl, res); }
      })
      .catch(e => { console.warn('[TheFeed] Lexicon lookup failed:', e); _doLexFallback(query, blbUrl, res); });
  } else {
    const lq = query.trim();
    Promise.all([
      db.collection('words').where('lemma', '==', lq).limit(1).get(),
      db.collection('words').where('kjv_def', '>=', lq.toLowerCase()).where('kjv_def', '<=', lq.toLowerCase() + '\uf8ff').limit(1).get()
    ]).then(([byLemma, byKjv]) => {
      const hit = !byLemma.empty ? byLemma.docs[0] : (!byKjv.empty ? byKjv.docs[0] : null);
      if (hit) { _applyDoc({ id: hit.id, ...hit.data() }); } else { _doLexFallback(query, blbUrl, res); }
    }).catch(e => { console.warn('[TheFeed] Lexicon lookup failed:', e); _doLexFallback(query, blbUrl, res); });
  }
}

function _doLexFallback(query, blbUrl, res) {
  _qs('bm-lex-word').textContent     = query;
  _qs('bm-lex-strongs').textContent  = '';
  _qs('bm-lex-translit').textContent = '';
  _qs('bm-lex-def').innerHTML        = `<a href="${blbUrl}" target="_blank" rel="noopener" style="color:var(--bm-accent)">Search BLB Lexicon ↗</a>`;
  _qs('bm-lex-origin').textContent   = '';
  if (res) res.classList.add('visible');
}

// ── Bible Book Overview ───────────────────────────────────────────────────────
const _BIBLE_BOOKS = {
  // Old Testament
  'genesis':        { name:'Genesis',         testament:'OT', author:'Moses',                                   date:'c. 1446–1406 BC', chapters:50,  purpose:'The beginning — God creates, humanity falls, covenant begins with Abraham, Isaac, Jacob, and Joseph.',          themes:['Creation','The Fall','Covenant','God\'s Faithfulness','Redemption'],                keyVerses:['Genesis 1:1','Genesis 3:15','Genesis 12:1-3','Genesis 50:20'] },
  'exodus':         { name:'Exodus',          testament:'OT', author:'Moses',                                   date:'c. 1446–1406 BC', chapters:40,  purpose:'God redeems Israel from Egypt and establishes His covenant at Sinai.',                                          themes:['Redemption','The Law','God\'s Presence','Passover','Worship'],                      keyVerses:['Exodus 3:14','Exodus 12:13','Exodus 20:1-17','Exodus 33:14'] },
  'leviticus':      { name:'Leviticus',        testament:'OT', author:'Moses',                                   date:'c. 1446–1406 BC', chapters:27,  purpose:'Instructions for holiness — how a holy God\'s people are to worship and live.',                               themes:['Holiness','Sacrifice','Atonement','Priesthood','Worship'],                          keyVerses:['Leviticus 11:44','Leviticus 17:11','Leviticus 19:18'] },
  'numbers':        { name:'Numbers',          testament:'OT', author:'Moses',                                   date:'c. 1446–1406 BC', chapters:36,  purpose:'Israel\'s wilderness journey — failure, discipline, and God\'s sustained faithfulness.',                      themes:['Faithfulness','Discipline','Wandering','Trust','God\'s Provision'],                 keyVerses:['Numbers 6:24-26','Numbers 14:18','Numbers 21:8-9'] },
  'deuteronomy':    { name:'Deuteronomy',      testament:'OT', author:'Moses',                                   date:'c. 1406 BC',       chapters:34,  purpose:'Moses\' farewell — covenant renewed, the greatest commandment, and the path to blessing.',                   themes:['Obedience','The Law','Covenant Renewal','Love for God','Blessing & Curse'],         keyVerses:['Deuteronomy 6:4-5','Deuteronomy 8:3','Deuteronomy 30:19'] },
  'joshua':         { name:'Joshua',           testament:'OT', author:'Joshua',                                  date:'c. 1405–1380 BC', chapters:24,  purpose:'Israel conquers and inherits the Promised Land under Joshua\'s leadership.',                                 themes:['Faith','Obedience','God\'s Promises','Victory','Inheritance'],                      keyVerses:['Joshua 1:8-9','Joshua 24:15'] },
  'judges':         { name:'Judges',           testament:'OT', author:'Unknown (Samuel?)',                        date:'c. 1380–1050 BC', chapters:21,  purpose:'A cycle of sin, oppression, repentance, and deliverance.',                                                   themes:['Sin Cycles','Repentance','Deliverance','Leadership','Idolatry'],                    keyVerses:['Judges 2:18-19','Judges 21:25'] },
  'ruth':           { name:'Ruth',             testament:'OT', author:'Unknown (Samuel?)',                        date:'c. 1100 BC',       chapters:4,   purpose:'Loyalty, redemption, and God\'s providence through a Moabite woman — ancestor of David and Jesus.',         themes:['Loyalty','Redemption','Providence','Faithfulness','Family'],                        keyVerses:['Ruth 1:16-17','Ruth 2:12','Ruth 4:14'] },
  '1samuel':        { name:'1 Samuel',         testament:'OT', author:'Samuel / Nathan / Gad',                   date:'c. 1050–1000 BC', chapters:31,  purpose:'Israel\'s transition to monarchy — Samuel, Saul, and the rise of David.',                                  themes:['Leadership','Obedience','God\'s Sovereignty','The Heart','Repentance'],             keyVerses:['1 Samuel 15:22','1 Samuel 16:7','1 Samuel 17:47'] },
  '2samuel':        { name:'2 Samuel',         testament:'OT', author:'Nathan / Gad',                            date:'c. 1000–965 BC',  chapters:24,  purpose:'David\'s reign — triumphs, failures, and the Davidic Covenant.',                                            themes:['The Davidic Covenant','Sin & Consequences','Worship','Kingship','Grace'],           keyVerses:['2 Samuel 7:12-13','2 Samuel 12:13'] },
  '1kings':         { name:'1 Kings',          testament:'OT', author:'Unknown (Jeremiah?)',                      date:'c. 560–540 BC',   chapters:22,  purpose:'Solomon\'s wisdom and temple, followed by the kingdom\'s division.',                                        themes:['Wisdom','Idolatry','Obedience','God\'s Faithfulness','Apostasy'],                   keyVerses:['1 Kings 3:9','1 Kings 8:27','1 Kings 18:21','1 Kings 19:12'] },
  '2kings':         { name:'2 Kings',          testament:'OT', author:'Unknown (Jeremiah?)',                      date:'c. 560–540 BC',   chapters:25,  purpose:'The downfall of both kingdoms — Israel and Judah — due to persistent sin.',                                themes:['Judgment','Idolatry','The Prophets','Exile','God\'s Patience'],                     keyVerses:['2 Kings 17:7-8','2 Kings 22:8','2 Kings 25:21'] },
  '1chronicles':    { name:'1 Chronicles',     testament:'OT', author:'Ezra',                                    date:'c. 450–430 BC',   chapters:29,  purpose:'David\'s legacy and preparations for the temple — from God\'s perspective.',                                themes:['Worship','David\'s Legacy','The Temple','Genealogy','God\'s Kingdom'],              keyVerses:['1 Chronicles 16:11','1 Chronicles 29:11-12'] },
  '2chronicles':    { name:'2 Chronicles',     testament:'OT', author:'Ezra',                                    date:'c. 450–430 BC',   chapters:36,  purpose:'Judah\'s history through the temple — obedience, worship, and eventual exile.',                             themes:['Worship','Repentance','Revival','The Temple','Consequences of Sin'],                keyVerses:['2 Chronicles 7:14','2 Chronicles 15:2','2 Chronicles 20:15'] },
  'ezra':           { name:'Ezra',             testament:'OT', author:'Ezra',                                    date:'c. 458–440 BC',   chapters:10,  purpose:'Return from exile — restoring the temple and covenant faithfulness.',                                        themes:['Restoration','God\'s Word','Obedience','Repentance','Community'],                   keyVerses:['Ezra 7:10','Ezra 9:6'] },
  'nehemiah':       { name:'Nehemiah',         testament:'OT', author:'Nehemiah',                                date:'c. 445–420 BC',   chapters:13,  purpose:'Rebuilding Jerusalem\'s walls and renewing covenant commitment.',                                            themes:['Prayer','Leadership','Perseverance','Community','Covenant Renewal'],               keyVerses:['Nehemiah 1:4','Nehemiah 6:3','Nehemiah 8:8','Nehemiah 8:10'] },
  'esther':         { name:'Esther',           testament:'OT', author:'Unknown (Mordecai?)',                      date:'c. 483–473 BC',   chapters:10,  purpose:'God\'s hidden providence preserving His people through Esther.',                                            themes:['Providence','Courage','God\'s Sovereignty','Deliverance','Identity'],               keyVerses:['Esther 4:14','Esther 8:17'] },
  'job':            { name:'Job',              testament:'OT', author:'Unknown',                                 date:'Unknown',          chapters:42,  purpose:'Suffering, sovereignty, and trust — why do the righteous suffer?',                                          themes:['Suffering','God\'s Sovereignty','Faith','Wisdom','Redemption'],                     keyVerses:['Job 1:21','Job 19:25-26','Job 38:4','Job 42:5'] },
  'psalms':         { name:'Psalms',           testament:'OT', author:'David, Asaph, Sons of Korah, Moses',      date:'c. 1400–400 BC',  chapters:150, purpose:'Israel\'s prayer book and hymnal — the full range of human emotion directed toward God.',                  themes:['Worship','Lament','Trust','Praise','God\'s Faithfulness'],                         keyVerses:['Psalm 1:1-2','Psalm 23:1','Psalm 51:10','Psalm 139:14'] },
  'proverbs':       { name:'Proverbs',         testament:'OT', author:'Solomon (primarily)',                      date:'c. 970–700 BC',   chapters:31,  purpose:'Practical wisdom for godly living — the fear of the Lord is the beginning of wisdom.',                   themes:['Wisdom','The Fear of God','Speech','Work','Family'],                                keyVerses:['Proverbs 1:7','Proverbs 3:5-6','Proverbs 11:2','Proverbs 22:6'] },
  'ecclesiastes':   { name:'Ecclesiastes',     testament:'OT', author:'Solomon',                                 date:'c. 935 BC',        chapters:12,  purpose:'The search for meaning apart from God is vanity — fear God and keep His commandments.',                    themes:['Meaning','Vanity','Wisdom','Time','Eternity'],                                      keyVerses:['Ecclesiastes 1:2','Ecclesiastes 3:1','Ecclesiastes 12:13'] },
  'songofsolomon':  { name:'Song of Solomon',  testament:'OT', author:'Solomon',                                 date:'c. 960 BC',        chapters:8,   purpose:'The beauty of covenant love — human love as a picture of God\'s love for His people.',                   themes:['Love','Marriage','Covenant','Desire','Faithfulness'],                               keyVerses:['Song of Solomon 2:16','Song of Solomon 8:6-7'] },
  'isaiah':         { name:'Isaiah',           testament:'OT', author:'Isaiah',                                  date:'c. 740–700 BC',   chapters:66,  purpose:'Judgment and hope — the coming Messiah and the new creation.',                                             themes:['The Messiah','Salvation','Holiness','Judgment','New Creation'],                     keyVerses:['Isaiah 6:8','Isaiah 9:6','Isaiah 40:31','Isaiah 53:5-6','Isaiah 55:11'] },
  'jeremiah':       { name:'Jeremiah',         testament:'OT', author:'Jeremiah',                                date:'c. 627–580 BC',   chapters:52,  purpose:'Warning of coming judgment and the promise of a new covenant.',                                             themes:['New Covenant','Judgment','Repentance','God\'s Word','Faithfulness'],                keyVerses:['Jeremiah 1:5','Jeremiah 17:9','Jeremiah 29:11','Jeremiah 31:33'] },
  'lamentations':   { name:'Lamentations',     testament:'OT', author:'Jeremiah',                                date:'c. 586 BC',        chapters:5,   purpose:'Grief over Jerusalem\'s destruction — yet God\'s mercies are new every morning.',                         themes:['Grief','God\'s Faithfulness','Suffering','Hope','Repentance'],                      keyVerses:['Lamentations 3:22-23','Lamentations 3:40'] },
  'ezekiel':        { name:'Ezekiel',          testament:'OT', author:'Ezekiel',                                 date:'c. 593–571 BC',   chapters:48,  purpose:'God\'s glory departs and returns — vision of restoration and the new temple.',                             themes:['God\'s Glory','Judgment','Restoration','The Spirit','New Temple'],                  keyVerses:['Ezekiel 18:31','Ezekiel 36:26','Ezekiel 37:14'] },
  'daniel':         { name:'Daniel',           testament:'OT', author:'Daniel',                                  date:'c. 605–535 BC',   chapters:12,  purpose:'Faithfulness under pressure and God\'s sovereignty over all kingdoms.',                                    themes:['God\'s Sovereignty','Faithfulness','End Times','Prayer','Courage'],                 keyVerses:['Daniel 1:8','Daniel 3:17-18','Daniel 6:10','Daniel 9:3'] },
  'hosea':          { name:'Hosea',            testament:'OT', author:'Hosea',                                   date:'c. 755–715 BC',   chapters:14,  purpose:'God\'s unfailing love for an unfaithful people — return to the Lord.',                                    themes:['God\'s Love','Unfaithfulness','Repentance','Restoration','Marriage'],               keyVerses:['Hosea 2:19-20','Hosea 6:6','Hosea 11:1','Hosea 14:4'] },
  'joel':           { name:'Joel',             testament:'OT', author:'Joel',                                    date:'c. 835 BC',        chapters:3,   purpose:'The Day of the Lord — call to repentance and the promise of the Spirit.',                                  themes:['The Day of the Lord','Repentance','The Holy Spirit','Restoration'],                 keyVerses:['Joel 2:12-13','Joel 2:28','Joel 2:32'] },
  'amos':           { name:'Amos',             testament:'OT', author:'Amos',                                    date:'c. 760–750 BC',   chapters:9,   purpose:'Social justice and judgment — let justice roll down like waters.',                                          themes:['Justice','Judgment','Social Responsibility','False Religion','Repentance'],         keyVerses:['Amos 3:7','Amos 5:24','Amos 7:7-8'] },
  'obadiah':        { name:'Obadiah',          testament:'OT', author:'Obadiah',                                 date:'c. 586 BC',        chapters:1,   purpose:'Judgment on Edom for pride and betrayal of Judah.',                                                         themes:['Pride','Judgment','Betrayal','God\'s Justice'],                                     keyVerses:['Obadiah 1:3','Obadiah 1:15'] },
  'jonah':          { name:'Jonah',            testament:'OT', author:'Jonah',                                   date:'c. 786–746 BC',   chapters:4,   purpose:'God\'s compassion for all nations — even Nineveh — and a reluctant prophet.',                             themes:['God\'s Compassion','Repentance','Obedience','Missions','Grace'],                    keyVerses:['Jonah 1:3','Jonah 2:9','Jonah 4:2'] },
  'micah':          { name:'Micah',            testament:'OT', author:'Micah',                                   date:'c. 735–700 BC',   chapters:7,   purpose:'Justice, mercy, and walking humbly with God.',                                                              themes:['Justice','Mercy','Humility','The Messiah','Judgment'],                              keyVerses:['Micah 5:2','Micah 6:8','Micah 7:18-19'] },
  'nahum':          { name:'Nahum',            testament:'OT', author:'Nahum',                                   date:'c. 663–612 BC',   chapters:3,   purpose:'God\'s judgment on Nineveh — the LORD is slow to anger but will not leave the guilty unpunished.',         themes:['God\'s Justice','Judgment','God\'s Power','Comfort'],                               keyVerses:['Nahum 1:7','Nahum 1:3'] },
  'habakkuk':       { name:'Habakkuk',         testament:'OT', author:'Habakkuk',                                date:'c. 612–589 BC',   chapters:3,   purpose:'Wrestling with God over injustice — the righteous shall live by faith.',                                  themes:['Faith','God\'s Sovereignty','Suffering','Prayer','Worship'],                        keyVerses:['Habakkuk 1:2','Habakkuk 2:4','Habakkuk 3:17-18'] },
  'zephaniah':      { name:'Zephaniah',        testament:'OT', author:'Zephaniah',                               date:'c. 640–609 BC',   chapters:3,   purpose:'The Day of the Lord is near — seek righteousness, seek humility.',                                          themes:['The Day of the Lord','Judgment','Humility','Restoration','Remnant'],                keyVerses:['Zephaniah 2:3','Zephaniah 3:17'] },
  'haggai':         { name:'Haggai',           testament:'OT', author:'Haggai',                                  date:'c. 520 BC',        chapters:2,   purpose:'Rebuild the temple — put God\'s priorities first and He will bless.',                                     themes:['Priorities','Worship','God\'s Presence','Obedience','Blessing'],                    keyVerses:['Haggai 1:7','Haggai 2:4','Haggai 2:9'] },
  'zechariah':      { name:'Zechariah',        testament:'OT', author:'Zechariah',                               date:'c. 520–480 BC',   chapters:14,  purpose:'Visions of restoration and messianic prophecy — the coming King.',                                         themes:['The Messiah','Restoration','God\'s Sovereignty','End Times','Worship'],             keyVerses:['Zechariah 4:6','Zechariah 9:9','Zechariah 12:10','Zechariah 14:9'] },
  'malachi':        { name:'Malachi',          testament:'OT', author:'Malachi',                                 date:'c. 430 BC',        chapters:4,   purpose:'Covenant faithfulness in the final OT book — prepare the way for the Lord.',                               themes:['Covenant','Faithfulness','Tithing','God\'s Love','Coming Messenger'],               keyVerses:['Malachi 3:1','Malachi 3:10','Malachi 4:2'] },
  // New Testament
  'matthew':        { name:'Matthew',          testament:'NT', author:'Matthew (Levi)',                          date:'c. AD 50–70',     chapters:28,  purpose:'Jesus is the promised Messiah, King of Kings — fulfillment of all the OT promises.',                       themes:['The Kingdom of Heaven','Discipleship','The Messiah','Fulfillment','The Church'],    keyVerses:['Matthew 5:3','Matthew 6:33','Matthew 16:18','Matthew 28:18-20'] },
  'mark':           { name:'Mark',             testament:'NT', author:'John Mark (from Peter)',                   date:'c. AD 55–65',     chapters:16,  purpose:'Jesus the Servant — the action-packed gospel of the Son of God who came to serve.',                      themes:['Service','Urgency','The Kingdom','Miracles','Discipleship'],                        keyVerses:['Mark 1:15','Mark 8:34','Mark 10:45','Mark 16:15'] },
  'luke':           { name:'Luke',             testament:'NT', author:'Luke (physician)',                         date:'c. AD 60–70',     chapters:24,  purpose:'Jesus the perfect Son of Man — compassion for the lost, poor, and outcast.',                             themes:['Compassion','Prayer','The Holy Spirit','The Lost','Women & Outcasts'],              keyVerses:['Luke 4:18-19','Luke 15:24','Luke 19:10','Luke 23:34'] },
  'john':           { name:'John',             testament:'NT', author:'Apostle John',                            date:'c. AD 85–90',     chapters:21,  purpose:'That you may believe Jesus is the Christ, the Son of God, and have life in His name.',                  themes:['Belief','Eternal Life','Light & Darkness','I AM Statements','The Word'],            keyVerses:['John 1:1','John 3:16','John 10:10','John 11:25','John 14:6','John 20:31'] },
  'acts':           { name:'Acts',             testament:'NT', author:'Luke',                                    date:'c. AD 62–70',     chapters:28,  purpose:'The birth and expansion of the Church through the power of the Holy Spirit.',                            themes:['The Holy Spirit','Missions','The Church','Persecution','Salvation'],                keyVerses:['Acts 1:8','Acts 2:38','Acts 4:12','Acts 16:31'] },
  'romans':         { name:'Romans',           testament:'NT', author:'Paul',                                    date:'c. AD 57',         chapters:16,  purpose:'The systematic presentation of the gospel — all have sinned, all can be saved.',                        themes:['Justification by Faith','Sin','Grace','The Gospel','Sanctification'],               keyVerses:['Romans 1:16','Romans 3:23','Romans 5:8','Romans 6:23','Romans 8:28','Romans 10:9'] },
  '1corinthians':   { name:'1 Corinthians',    testament:'NT', author:'Paul',                                    date:'c. AD 54–55',     chapters:16,  purpose:'Church unity, spiritual gifts, and love — the cross is the power of God.',                              themes:['Unity','Love','Spiritual Gifts','Resurrection','The Cross'],                        keyVerses:['1 Corinthians 1:18','1 Corinthians 2:2','1 Corinthians 13:4-7','1 Corinthians 15:3-4'] },
  '2corinthians':   { name:'2 Corinthians',    testament:'NT', author:'Paul',                                    date:'c. AD 55–56',     chapters:13,  purpose:'Ministry in weakness — God\'s power made perfect in weakness.',                                          themes:['Weakness & Strength','Ministry','Suffering','Reconciliation','Generosity'],        keyVerses:['2 Corinthians 1:3-4','2 Corinthians 5:17','2 Corinthians 5:21','2 Corinthians 12:9'] },
  'galatians':      { name:'Galatians',        testament:'NT', author:'Paul',                                    date:'c. AD 48–55',     chapters:6,   purpose:'Freedom from the law — justified by faith alone, not works.',                                            themes:['Grace','Justification by Faith','Freedom','The Spirit','The Law'],                  keyVerses:['Galatians 2:20','Galatians 3:28','Galatians 5:1','Galatians 5:22-23'] },
  'ephesians':      { name:'Ephesians',        testament:'NT', author:'Paul',                                    date:'c. AD 60–62',     chapters:6,   purpose:'The Church — our identity in Christ and our walk worthy of the calling.',                               themes:['Identity in Christ','The Church','Grace','Unity','Spiritual Warfare'],              keyVerses:['Ephesians 1:4','Ephesians 2:8-9','Ephesians 4:1','Ephesians 6:10-11'] },
  'philippians':    { name:'Philippians',      testament:'NT', author:'Paul',                                    date:'c. AD 61',         chapters:4,   purpose:'Joy in all circumstances — the mind of Christ and contentment in Him.',                                themes:['Joy','Contentment','Humility','The Mind of Christ','Partnership'],                  keyVerses:['Philippians 1:6','Philippians 2:5-8','Philippians 3:14','Philippians 4:7','Philippians 4:13'] },
  'colossians':     { name:'Colossians',       testament:'NT', author:'Paul',                                    date:'c. AD 60–62',     chapters:4,   purpose:'Christ is supreme over all creation — the fullness of God dwells in Him.',                              themes:['Supremacy of Christ','Fullness in Christ','Warning Against Heresy','Christian Living'], keyVerses:['Colossians 1:15-17','Colossians 2:9-10','Colossians 3:1-2','Colossians 3:17'] },
  '1thessalonians': { name:'1 Thessalonians',  testament:'NT', author:'Paul',                                    date:'c. AD 51',         chapters:5,   purpose:'Encouragement in persecution and instruction about the return of Christ.',                              themes:['The Second Coming','Holiness','Encouragement','Prayer','Hope'],                     keyVerses:['1 Thessalonians 4:16-17','1 Thessalonians 5:16-18','1 Thessalonians 5:23'] },
  '2thessalonians': { name:'2 Thessalonians',  testament:'NT', author:'Paul',                                    date:'c. AD 51–52',     chapters:3,   purpose:'Clarifying the Day of the Lord and calling for perseverance and faithfulness.',                        themes:['The Day of the Lord','Perseverance','Work','Judgment','God\'s Justice'],            keyVerses:['2 Thessalonians 1:11','2 Thessalonians 2:15','2 Thessalonians 3:3'] },
  '1timothy':       { name:'1 Timothy',        testament:'NT', author:'Paul',                                    date:'c. AD 62–64',     chapters:6,   purpose:'Pastoral instruction — guard the faith, lead well, pursue godliness.',                                 themes:['Church Leadership','Sound Doctrine','Godliness','Prayer','Faithfulness'],           keyVerses:['1 Timothy 1:15','1 Timothy 2:1-2','1 Timothy 4:12','1 Timothy 6:6','1 Timothy 6:12'] },
  '2timothy':       { name:'2 Timothy',        testament:'NT', author:'Paul',                                    date:'c. AD 66–67',     chapters:4,   purpose:'Paul\'s final charge — preach the Word, endure hardship, finish the race.',                           themes:['Perseverance','God\'s Word','Ministry','Legacy','Faithfulness'],                    keyVerses:['2 Timothy 1:7','2 Timothy 2:15','2 Timothy 3:16-17','2 Timothy 4:2','2 Timothy 4:7'] },
  'titus':          { name:'Titus',            testament:'NT', author:'Paul',                                    date:'c. AD 63–65',     chapters:3,   purpose:'Sound doctrine and godly living — the grace of God trains us to say no to ungodliness.',               themes:['Grace','Godliness','Sound Doctrine','Church Order','Good Works'],                   keyVerses:['Titus 1:5','Titus 2:11-13','Titus 3:5'] },
  'philemon':       { name:'Philemon',         testament:'NT', author:'Paul',                                    date:'c. AD 60–61',     chapters:1,   purpose:'A personal plea for forgiveness and reconciliation — receive Onesimus as a brother.',                  themes:['Forgiveness','Reconciliation','Brotherhood','Grace','Freedom'],                     keyVerses:['Philemon 1:10','Philemon 1:16','Philemon 1:18'] },
  'hebrews':        { name:'Hebrews',          testament:'NT', author:'Unknown (Paul? Apollos?)',                 date:'c. AD 60–70',     chapters:13,  purpose:'Jesus is greater — greater than angels, Moses, priests, and the old covenant.',                       themes:['Supremacy of Christ','Faith','The New Covenant','Perseverance','Priesthood'],       keyVerses:['Hebrews 4:12','Hebrews 4:16','Hebrews 11:1','Hebrews 12:1-2','Hebrews 13:8'] },
  'james':          { name:'James',            testament:'NT', author:'James (brother of Jesus)',                 date:'c. AD 45–50',     chapters:5,   purpose:'Faith without works is dead — practical godliness in everyday life.',                                  themes:['Practical Faith','Wisdom','Trials','Speech','Prayer'],                              keyVerses:['James 1:2-4','James 1:22','James 2:17','James 4:7','James 5:16'] },
  '1peter':         { name:'1 Peter',          testament:'NT', author:'Peter',                                   date:'c. AD 62–64',     chapters:5,   purpose:'Suffering and hope — stand firm as strangers and exiles; the God of all grace will restore.',         themes:['Suffering','Hope','Holiness','God\'s Grace','Identity'],                            keyVerses:['1 Peter 1:3','1 Peter 2:9','1 Peter 4:10','1 Peter 5:7','1 Peter 5:10'] },
  '2peter':         { name:'2 Peter',          testament:'NT', author:'Peter',                                   date:'c. AD 65–68',     chapters:3,   purpose:'Guard against false teachers and grow in grace and knowledge of Christ.',                              themes:['False Teaching','Godliness','God\'s Word','The Day of the Lord','Growth'],          keyVerses:['2 Peter 1:3-4','2 Peter 1:21','2 Peter 3:9'] },
  '1john':          { name:'1 John',           testament:'NT', author:'Apostle John',                            date:'c. AD 85–95',     chapters:5,   purpose:'Assurance of salvation — walk in the light, love one another, abide in Christ.',                     themes:['Love','Assurance','Fellowship with God','Truth vs. Falsehood','Abiding'],           keyVerses:['1 John 1:9','1 John 3:16','1 John 4:7-8','1 John 5:13'] },
  '2john':          { name:'2 John',           testament:'NT', author:'Apostle John',                            date:'c. AD 90',         chapters:1,   purpose:'Walk in truth and love; do not welcome false teachers.',                                               themes:['Truth','Love','False Teaching','Obedience'],                                        keyVerses:['2 John 1:6','2 John 1:9'] },
  '3john':          { name:'3 John',           testament:'NT', author:'Apostle John',                            date:'c. AD 90',         chapters:1,   purpose:'Support faithful workers; do not imitate evil but imitate what is good.',                             themes:['Hospitality','Truth','Leadership','Faithfulness'],                                  keyVerses:['3 John 1:4','3 John 1:11'] },
  'jude':           { name:'Jude',             testament:'NT', author:'Jude (brother of Jesus)',                  date:'c. AD 65–80',     chapters:1,   purpose:'Contend earnestly for the faith once delivered to the saints.',                                         themes:['Apostasy','Contending for Faith','False Teachers','God\'s Judgment','Perseverance'],keyVerses:['Jude 1:3','Jude 1:24-25'] },
  'revelation':     { name:'Revelation',       testament:'NT', author:'Apostle John',                            date:'c. AD 90–95',     chapters:22,  purpose:'The triumph of Christ over evil — God wins, and His people will dwell with Him forever.',            themes:['Christ\'s Victory','End Times','Worship','God\'s Sovereignty','New Creation'],      keyVerses:['Revelation 1:8','Revelation 3:20','Revelation 12:11','Revelation 21:4','Revelation 22:20'] },
};

/** Parse a passage string like "John 3:16" or "1 Cor 13:4–7" into a _BIBLE_BOOKS key */
function _parseBookFromPassage(passage) {
  if (!passage) return null;
  const raw = passage.trim();

  const aliases = {
    'gen':'genesis','exo':'exodus','exod':'exodus','lev':'leviticus','num':'numbers',
    'deu':'deuteronomy','deut':'deuteronomy','jos':'joshua','jdg':'judges','jud':'judges',
    'rut':'ruth','1sa':'1samuel','1sam':'1samuel','1 sam':'1samuel','1 samuel':'1samuel',
    '2sa':'2samuel','2sam':'2samuel','2 sam':'2samuel','2 samuel':'2samuel',
    '1ki':'1kings','1kgs':'1kings','1 kgs':'1kings','1 kings':'1kings',
    '2ki':'2kings','2kgs':'2kings','2 kgs':'2kings','2 kings':'2kings',
    '1ch':'1chronicles','1chr':'1chronicles','1 chr':'1chronicles','1 chron':'1chronicles','1 chronicles':'1chronicles',
    '2ch':'2chronicles','2chr':'2chronicles','2 chr':'2chronicles','2 chron':'2chronicles','2 chronicles':'2chronicles',
    'ezr':'ezra','neh':'nehemiah','est':'esther',
    'psa':'psalms','pss':'psalms','psalm':'psalms','ps':'psalms',
    'pro':'proverbs','prov':'proverbs','ecc':'ecclesiastes','eccl':'ecclesiastes','qoh':'ecclesiastes',
    'son':'songofsolomon','sos':'songofsolomon','sol':'songofsolomon',
    'song of songs':'songofsolomon','song of solomon':'songofsolomon','sng':'songofsolomon',
    'isa':'isaiah','jer':'jeremiah','lam':'lamentations','eze':'ezekiel','ezek':'ezekiel',
    'dan':'daniel','hos':'hosea','joe':'joel','amo':'amos','oba':'obadiah',
    'jon':'jonah','mic':'micah','nah':'nahum','hab':'habakkuk','zep':'zephaniah',
    'hag':'haggai','zec':'zechariah','zech':'zechariah','mal':'malachi',
    'mat':'matthew','matt':'matthew','mrk':'mark','luk':'luke',
    'joh':'john','jhn':'john','act':'acts','rom':'romans',
    '1co':'1corinthians','1cor':'1corinthians','1 cor':'1corinthians','1 corinthians':'1corinthians',
    '2co':'2corinthians','2cor':'2corinthians','2 cor':'2corinthians','2 corinthians':'2corinthians',
    'gal':'galatians','eph':'ephesians','phi':'philippians','php':'philippians','phl':'philippians',
    'col':'colossians',
    '1th':'1thessalonians','1 thess':'1thessalonians','1 thessalonians':'1thessalonians',
    '2th':'2thessalonians','2 thess':'2thessalonians','2 thessalonians':'2thessalonians',
    '1ti':'1timothy','1tim':'1timothy','1 tim':'1timothy','1 timothy':'1timothy',
    '2ti':'2timothy','2tim':'2timothy','2 tim':'2timothy','2 timothy':'2timothy',
    'tit':'titus','phm':'philemon','heb':'hebrews','jas':'james',
    '1pe':'1peter','1pet':'1peter','1 pet':'1peter','1 peter':'1peter',
    '2pe':'2peter','2pet':'2peter','2 pet':'2peter','2 peter':'2peter',
    '1jo':'1john','1joh':'1john','1 john':'1john','1jn':'1john',
    '2jo':'2john','2joh':'2john','2 john':'2john','2jn':'2john',
    '3jo':'3john','3joh':'3john','3 john':'3john','3jn':'3john',
    'jde':'jude','rev':'revelation','rvl':'revelation',
  };

  // Strip chapter:verse to get just the book portion
  const bookPart = raw.replace(/\s*\d+[:\s].*$/, '').replace(/\s*\d+[–\-]?\d*$/, '').trim().toLowerCase();
  if (_BIBLE_BOOKS[bookPart]) return bookPart;
  if (aliases[bookPart]) return aliases[bookPart];

  // More aggressive strip
  const stripped = raw.replace(/[\s:,\-–].*$/, '').trim().toLowerCase();
  if (_BIBLE_BOOKS[stripped]) return stripped;
  if (aliases[stripped]) return aliases[stripped];

  return null;
}

/** Render the book overview bar at the top of the Research pane */
function _renderBookOverview() {
  const el = _qs('bm-book-overview');
  if (!el) return;
  const s = _active();
  const passage = (s && s.passage) ? s.passage.trim() : '';
  const key  = _parseBookFromPassage(passage);
  const book = key ? _BIBLE_BOOKS[key] : null;

  if (!book) { el.style.display = 'none'; return; }

  el.style.display = '';
  el.innerHTML = `
    <div class="bm-book-ov-inner">
      <div class="bm-book-ov-header">
        <span class="bm-book-ov-name">${_e(book.name)}</span>
        <span class="bm-book-ov-badge ${book.testament.toLowerCase()}">${_e(book.testament)}</span>
        <span class="bm-book-ov-meta">${_e(book.chapters)} chapters &nbsp;·&nbsp; ${_e(book.author)} &nbsp;·&nbsp; ${_e(book.date)}</span>
      </div>
      <div class="bm-book-ov-purpose">${_e(book.purpose)}</div>
      <div class="bm-book-ov-row">
        <div class="bm-book-ov-themes">${book.themes.map(t => `<span class="bm-book-ov-theme-chip">${_e(t)}</span>`).join('')}</div>
        <div class="bm-book-ov-verses">${book.keyVerses.map(v =>
          `<span class="bm-book-ov-verse" data-ref="${_e(v)}">${_e(v)}</span>`
        ).join('')}</div>
      </div>
    </div>
  `;

  el.querySelectorAll('.bm-book-ov-verse').forEach(chip => {
    chip.addEventListener('click', () => _doScriptureLookup(chip.dataset.ref));
  });
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
