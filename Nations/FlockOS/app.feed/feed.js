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
    id:           _uid(),
    type,
    title:        title || _sectionTitle(type),
    notes:        '',
    scripture:    '',
    scriptureRef: '',
    // Whether this section is included when the sermon is pushed to FlockShow.
    // Transitions default to OFF (they're stage notes, not slides); everything
    // else defaults to ON.
    includeInShow: type !== 'transition',
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

  // Live totals for the helper banner: how many sections are checked,
  // and how many slides they'll add up to in FlockShow.
  const sections = s.sections || [];
  let bannerIncluded = 0, bannerSlides = 0;
  sections.forEach(sec => {
    if (typeof sec.includeInShow !== 'boolean') {
      sec.includeInShow = sec.type !== 'transition';
    }
    if (sec.includeInShow) {
      bannerIncluded += 1;
      bannerSlides += _estimateSlidesForSection(sec);
    }
  });
  const bannerHtml = `
    <div class="bm-outline-banner">
      <span class="bm-outline-banner-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </span>
      <span class="bm-outline-banner-msg">
        Tick a section to include it in <strong>FlockShow</strong>. Long paragraphs auto-split into multiple slides at sentence boundaries.
      </span>
      <span class="bm-outline-banner-count" id="bm-outline-banner-count">${bannerIncluded} of ${sections.length} \u00b7 ${bannerSlides} slide${bannerSlides === 1 ? '' : 's'}</span>
    </div>
  `;

  container.innerHTML = bannerHtml + (s.sections || []).map((sec, idx) => {
    // Backfill the include flag on older sections that pre-date this field.
    if (typeof sec.includeInShow !== 'boolean') {
      sec.includeInShow = sec.type !== 'transition';
    }
    const slideEst = _estimateSlidesForSection(sec);
    const slideMeta = sec.includeInShow
      ? (slideEst === 0
          ? 'No slides yet \u2014 add notes to generate'
          : `\u2192 ${slideEst} slide${slideEst === 1 ? '' : 's'} in FlockShow`)
      : 'Skipped in FlockShow';
    return `
    <div class="bm-outline-section${sec._collapsed ? ' collapsed' : ''}${sec.includeInShow ? '' : ' not-in-show'}" data-sid="${_e(sec.id)}" draggable="true">
      <div class="bm-section-header">
        <button class="bm-icon-btn bm-collapse-btn" data-action="toggle-collapse" data-sid="${_e(sec.id)}" title="${sec._collapsed ? 'Expand' : 'Collapse'}" aria-expanded="${!sec._collapsed}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <label class="bm-section-include" title="Include this section when pushing to FlockShow">
          <input type="checkbox" class="bm-section-include-cb" data-action="toggle-include" data-sid="${_e(sec.id)}" ${sec.includeInShow ? 'checked' : ''} aria-label="Include in FlockShow">
          <span class="bm-section-include-box" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 10 17 19 7"/></svg>
          </span>
        </label>
        <span class="bm-section-drag" title="Drag to reorder">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></svg>
        </span>
        <select class="bm-section-type-select ${_e(sec.type)}" data-field="type" data-sid="${_e(sec.id)}" title="Change section type">
          ${SECTION_TYPES.map(t => `<option value="${t}"${t === sec.type ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
        </select>
        <div class="bm-section-title-wrap">
          <input class="bm-section-title-input" type="text" value="${_e(sec.title)}" placeholder="Section title…" data-field="title" data-sid="${_e(sec.id)}" autocomplete="off">
          <div class="bm-section-slide-meta" data-slide-meta="${_e(sec.id)}">${_e(slideMeta)}</div>
        </div>
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
        <div class="bm-fmt-toolbar">
          <button type="button" class="bm-fmt-btn" data-fmt-open="**" data-fmt-close="**" title="Bold — select text first"><strong>B</strong></button>
          <button type="button" class="bm-fmt-btn" data-fmt-open="__" data-fmt-close="__" title="Underline — select text first"><u>U</u></button>
          <button type="button" class="bm-fmt-btn" data-fmt-open="==" data-fmt-close="==" title="Highlight — select text first" style="color:rgba(232,168,56,0.85)">H</button>
          <span class="bm-fmt-hint">Select text → B / U / H</span>
        </div>
      </div>
    </div>`;
  }).join('');

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

// Wrap the currently-selected text in a textarea with open/close markers.
// Clicking the same button again on a wrapped selection toggles the markers off.
function _formatTag(el, open, close) {
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  const val   = el.value;
  const sel   = val.slice(start, end);
  if (!sel) return;
  const before = val.slice(0, start);
  const after  = val.slice(end);
  if (sel.startsWith(open) && sel.endsWith(close) && sel.length > open.length + close.length) {
    const inner = sel.slice(open.length, sel.length - close.length);
    el.value = before + inner + after;
    el.selectionStart = start;
    el.selectionEnd   = start + inner.length;
  } else {
    el.value = before + open + sel + close + after;
    el.selectionStart = start + open.length;
    el.selectionEnd   = end   + open.length;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
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
      // Notes / scripture edits change the slide estimate — update it live.
      if (field === 'notes' || field === 'scripture' || field === 'scriptureRef' || field === 'title') {
        _refreshSlideMeta(sec, container);
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

  // Include-in-FlockShow checkboxes (separate from action buttons because
  // they're <input> elements that fire 'change', not 'click').
  container.querySelectorAll('input.bm-section-include-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const s = _active();
      if (!s) return;
      const sec = s.sections.find(x => x.id === cb.dataset.sid);
      if (!sec) return;
      sec.includeInShow = !!cb.checked;
      const wrap = container.querySelector(`.bm-outline-section[data-sid="${sec.id}"]`);
      if (wrap) wrap.classList.toggle('not-in-show', !sec.includeInShow);
      _refreshSlideMeta(sec, container);
      _queueSave();
    });
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

  // Inline format toolbar (B / U / H) — targets the notes textarea in the same section
  container.querySelectorAll('.bm-fmt-btn').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault(); // keep textarea focused
      const section = btn.closest('.bm-outline-section');
      const ta = section?.querySelector('.bm-notes-textarea');
      if (ta) _formatTag(ta, btn.dataset.fmtOpen, btn.dataset.fmtClose);
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

  // Show close (X) button when a sermon is open
  const closeBtn = _qs('bm-close-sermon-btn');
  if (closeBtn) closeBtn.style.display = '';

  // Enable action buttons that require an active sermon
  const dupBtn  = _qs('bm-duplicate-btn');
  const cpyBtn  = _qs('bm-copy-outline-btn');
  const fsBtn   = _qs('bm-send-flockshow-btn');
  const presBtn = _qs('bm-present-btn');
  if (dupBtn)  dupBtn.disabled  = false;
  if (cpyBtn)  cpyBtn.disabled  = false;
  if (fsBtn)   fsBtn.disabled   = false;
  if (presBtn) presBtn.disabled = false;

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
//
// Builds a fully-formed FlockShow presentation from the sermon and
// either CREATES a new presentation in Firestore or UPDATES the
// existing one (linked by `sermon._showId` written back on first send).
//
// Slide auto-generation rules — chosen to give the pastor a deck that
// is "ready to GO" straight from the outline:
//
//   • Title slide (announce)        — title + speaker
//   • Series/date slide (announce)  — only if series or date is set
//   • For each section, in order:
//        – Section TITLE slide (announce) using the section heading
//        – SCRIPTURE sections → one slide per verse (split by line/verse-num)
//                              with the reference set on every slide
//        – All other sections → notes are split into slide-sized chunks:
//             1. split on blank lines (paragraphs)
//             2. any paragraph > SLIDE_CHAR_TARGET is re-split on sentence
//                boundaries, packing sentences until the slide is full
//        – The section title is also written into slide.notes so the
//          pastor sees it in the projector stage-notes corner
//   • Altar call slide (announce) — last, only if filled
//
// The TRANSITION type is intentionally rendered as a stage-note-only
// slide (blank screen, projector shows nothing, but pastor still sees
// the transition cue in stage notes).
//
const SLIDE_CHAR_TARGET = 260;   // soft max chars per content slide
const SLIDE_CHAR_HARD   = 360;   // hard max — never exceed this on one slide

// Map FEED section type → FlockShow slide type
const _FEED_TO_SHOW_TYPE = {
  intro:        'lyrics',
  scripture:    'scripture',
  point:        'lyrics',
  illustration: 'lyrics',
  explanation:  'lyrics',
  application:  'lyrics',
  prayer:       'announce',
  conclusion:   'announce',
  transition:   'blank',
};

// Generate a stable-ish unique id without bringing in a uuid lib
function _showSlideId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Build a single FlockShow-shaped slide
function _mkShowSlide(type, text, opts) {
  opts = opts || {};
  return {
    id:        _showSlideId(),
    type:      type || 'lyrics',
    text:      String(text || ''),
    reference: opts.reference || '',
    bgColor:   '',
    textColor: '',
    notes:     opts.notes || '',
    fontSize:  0,
  };
}

// Split a long block of prose into slide-sized chunks.  Splits first on
// paragraph boundaries (blank lines); paragraphs that are still too long
// are re-split on sentence boundaries, with sentences packed onto the
// same slide until SLIDE_CHAR_TARGET is reached.
// Break a long string at word boundaries, never mid-word.
function _wordBoundaryWrap(str, maxLen) {
  const out = [];
  str = str.trim();
  while (str.length > maxLen) {
    let cut = maxLen;
    // Walk back to the nearest space so we don't slice a word in half
    while (cut > 0 && str[cut] !== ' ') cut--;
    if (cut === 0) cut = maxLen; // no space found — force break at limit
    out.push(str.slice(0, cut).trim());
    str = str.slice(cut).trim();
  }
  if (str) out.push(str);
  return out;
}

function _chunkProseToSlides(text, targetLen) {
  targetLen = targetLen || SLIDE_CHAR_TARGET;
  const out = [];
  if (!text || !String(text).trim()) return out;

  const paragraphs = String(text)
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  paragraphs.forEach(para => {
    if (para.length <= targetLen) { out.push(para); return; }

    // Split on sentence-ending punctuation so we never break mid-sentence.
    // Keeps punctuation attached to the sentence it belongs to.
    const sentences = para.match(/[^.!?]+[.!?]+[")'\]]*\s*|[^.!?]+$/g) || [para];
    let bucket = '';
    sentences.forEach(raw => {
      const s = raw.trim();
      if (!s) return;
      // A single sentence longer than the hard cap — split at word boundaries,
      // never at an arbitrary character position.
      if (s.length > SLIDE_CHAR_HARD) {
        if (bucket) { out.push(bucket.trim()); bucket = ''; }
        _wordBoundaryWrap(s, SLIDE_CHAR_HARD).forEach(chunk => out.push(chunk));
        return;
      }
      // Pack sentences together until we exceed the target length
      if (bucket && (bucket.length + 1 + s.length) > targetLen) {
        out.push(bucket.trim());
        bucket = s;
      } else {
        bucket = bucket ? (bucket + ' ' + s) : s;
      }
    });
    if (bucket.trim()) out.push(bucket.trim());
  });

  return out;
}

// Split scripture text (often multiple verses) into one slide per verse.
// Accepts both "1 In the beginning... 2 And the earth was..." and
// line-separated forms.  Always tags every slide with the reference.
function _scriptureToSlides(verseText, ref) {
  if (!verseText || !String(verseText).trim()) {
    // Reference only — single slide with just the citation
    if (ref) return [_mkShowSlide('scripture', '', { reference: ref })];
    return [];
  }
  let text = String(verseText).replace(/\r\n/g, '\n').trim();

  // Form 1: numbered prose like "1 In the beginning 2 And the earth..."
  // Insert a newline before every standalone verse number.
  let verses;
  if (/\s\d+\s+\S/.test(text) || /^\d+\s+/.test(text)) {
    const split = text.split(/\s(?=\d+\s+[A-Z“"‘'])/);
    verses = split.map(v => v.trim()).filter(Boolean);
  } else {
    // Form 2: line-separated (one verse per line)
    verses = text.split(/\n+/).map(v => v.trim()).filter(Boolean);
  }

  if (verses.length <= 1) {
    // Couldn't split — chunk the prose instead, but keep type=scripture
    const chunks = _chunkProseToSlides(text);
    return chunks.map(c => _mkShowSlide('scripture', c, { reference: ref }));
  }
  return verses.map(v => _mkShowSlide('scripture', v, { reference: ref }));
}

// Build the FULL FlockShow show object from a sermon

// Estimate how many FlockShow slides a single section would emit if it were
// included.  Mirrors the logic in `_buildShowFromSermon` so the outline can
// show users a live count.
function _estimateSlidesForSection(sec) {
  if (!sec) return 0;
  const heading = (sec.title || _sectionTitle(sec.type) || '').trim();
  const notes   = (sec.notes || '').trim();
  let count = heading ? 1 : 0; // section TITLE slide
  if (sec.type === 'scripture') {
    const ref = (sec.scriptureRef || heading || '').trim();
    count += _scriptureToSlides(sec.scripture || notes, ref).length;
    return count;
  }
  if (sec.type === 'transition') {
    // Transition emits a blank stage-note slide only when there are notes.
    return notes ? (count + 1) : count;
  }
  if (notes) count += _chunkProseToSlides(notes).length;
  return count;
}

// Recompute the "X of Y · N slides" totals shown in the outline banner.
function _refreshOutlineBanner() {
  const s = _active();
  const node = document.getElementById('bm-outline-banner-count');
  if (!s || !node) return;
  const sections = s.sections || [];
  let inc = 0, slides = 0;
  sections.forEach(sec => {
    if (sec.includeInShow !== false) {
      inc += 1;
      slides += _estimateSlidesForSection(sec);
    }
  });
  node.textContent = `${inc} of ${sections.length} \u00b7 ${slides} slide${slides === 1 ? '' : 's'}`;
}

// Update just the meta line under one section's header in-place (no full re-render).
function _refreshSlideMeta(sec, container) {
  if (!sec || !container) return;
  const node = container.querySelector(`[data-slide-meta="${sec.id}"]`);
  if (!node) return;
  const wrap = container.querySelector(`.bm-outline-section[data-sid="${sec.id}"]`);
  if (sec.includeInShow === false) {
    node.textContent = 'Skipped in FlockShow';
  } else {
    const n = _estimateSlidesForSection(sec);
    node.textContent = n === 0
      ? 'No slides yet \u2014 add notes to generate'
      : `\u2192 ${n} slide${n === 1 ? '' : 's'} in FlockShow`;
  }
  if (wrap) wrap.classList.toggle('not-in-show', sec.includeInShow === false);
  _refreshOutlineBanner();
}

// ---------------------------------------------------------------------------
// Auto-format: add visual emphasis markers to sermon-generated slide text.
// Applied to prose chunks (point bodies, illustrations, altar calls, etc.).
// Never touches scripture quotes (those stay clean).
// Markers used by FlockShow renderer:
//   **text**  = bold   __text__  = underline   _text_  = italic   ==text==  = highlight
// ---------------------------------------------------------------------------
function _autoFormat(text) {
  if (!text) return text;
  const lines = text.split('\n');
  const TRANSITION_WORDS = /^(Therefore|So then|But|Because|And so|For|However|Remember|Notice|Consider|In other words|Note:|Key:|Application:|The point is|Here['']s the thing|Think about|The truth is)\b/i;
  const SCRIPTURE_REF    = /\b([1-3]?\s*[A-Z][a-z]+\.?\s+\d+[:\u2013\-]\d+[\u2013\-]?\d*)\b/g;
  const POINT_PREFIX     = /^(Point\s+\d+[:.)]?\s*|\d+[:.]\s+|[A-Z][.)]\s+)/;
  const ALLCAPS_WORD     = /\b([A-Z]{3,})\b/g;
  const OPEN_QUOTE       = /[\u201c\u2018\u0022]/g;
  const CLOSE_QUOTE      = /[\u201d\u2019\u0022]/g;

  return lines.map(raw => {
    let line = raw;

    // 1. Point prefix → bold the heading label ("1. ", "Point 2:", "A. ")
    const pmatch = line.match(POINT_PREFIX);
    if (pmatch) {
      const prefix = pmatch[0];
      const rest   = line.slice(prefix.length);
      // Only apply if not already formatted
      if (!/^\*\*/.test(prefix.trim())) {
        line = `**${prefix.trimEnd()}** ${rest}`;
      }
    }

    // 2. Scripture references → underline (e.g. "John 3:16", "Romans 8:28-30")
    line = line.replace(SCRIPTURE_REF, (m, ref) => `__${ref}__`);

    // 3. ALL-CAPS emphasis words → bold (skip common filler and already-marked words)
    const COMMON = /^(AND|THE|FOR|BUT|NOT|ARE|ALL|HIS|HER|ITS|OUR|WAS|HIM|YOU|GOD|LORD|TO|IN|OF|ON|AT|BY|BE|AS|OR|SO|IF|IT)$/;
    line = line.replace(ALLCAPS_WORD, (m, word) => {
      if (COMMON.test(word)) return m;             // keep as-is
      if (line.indexOf(`**${word}**`) !== -1) return m;  // already bold
      return `**${word}**`;
    });

    // 4. Transition words at start of line → italic
    if (TRANSITION_WORDS.test(line)) {
      const tmatch = line.match(TRANSITION_WORDS);
      if (tmatch && !line.startsWith('_')) {
        line = `_${tmatch[0]}_ ${line.slice(tmatch[0].length).trimStart()}`;
      }
    }

    // 5. Quoted text → italic (simple open/close quote detection)
    line = line.replace(/[\u201c\u2018](.*?)[\u201d\u2019]/g, (m, inner) => `_${inner.trim()}_`);

    return line;
  }).join('\n');
}

function _buildShowFromSermon(s) {
  const slides = [];

  // 1. Title slide
  const titleLines = [s.title || 'Untitled Sermon'];
  if (s.speaker) titleLines.push(s.speaker);
  const titleSlide = _mkShowSlide('announce', titleLines.join('\n'));
  titleSlide.sourceType = 'title';
  slides.push(titleSlide);

  // 2. Series + date slide (optional)
  const dateStr = s.date
    ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US',
        { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  if (s.series || dateStr) {
    const subParts = [s.series, dateStr].filter(Boolean);
    const seriesSlide = _mkShowSlide('announce', subParts.join('\n'));
    seriesSlide.sourceType = 'series';
    slides.push(seriesSlide);
  }

  // 3. Top-level passage
  if (s.passage) {
    const passageSlide = _mkShowSlide('scripture', '', { reference: s.passage });
    passageSlide.sourceType = 'passage';
    slides.push(passageSlide);
  }

  // 4. Walk every section in order — skip those the user opted out of.
  (s.sections || []).filter(sec => sec.includeInShow !== false).forEach((sec, idx, arr) => {
    const showType = _FEED_TO_SHOW_TYPE[sec.type] || 'lyrics';
    const heading  = (sec.title || _sectionTitle(sec.type) || '').trim();
    const notes    = (sec.notes || '').trim();

    // Section TITLE slide (gives the pastor a visual breath between blocks)
    // No sourceType badge on heading slides — the text IS the label
    if (heading) {
      slides.push(_mkShowSlide('announce', heading, {
        notes: `Section ${idx + 1} of ${arr.length}`,
      }));
    }

    if (sec.type === 'scripture') {
      const ref = (sec.scriptureRef || heading || '').trim();
      const verses = _scriptureToSlides(sec.scripture || notes, ref);
      verses.forEach(v => { v.notes = heading || ref || ''; v.sourceType = 'scripture'; slides.push(v); });
      return;
    }

    if (sec.type === 'transition') {
      // Blank screen + the transition text as stage notes only
      if (notes) {
        slides.push(_mkShowSlide('blank', '', { notes: `[Transition] ${notes}` }));
      }
      return;
    }

    if (!notes) return;   // heading was already emitted; nothing more to show

    // Auto-break long notes into slide-sized chunks
    const chunks = _chunkProseToSlides(notes);
    chunks.forEach((chunk, i) => {
      // Apply auto-formatting to non-scripture prose slides
      const formattedChunk = (showType !== 'scripture') ? _autoFormat(chunk) : chunk;
      const sl = _mkShowSlide(showType, formattedChunk, {
        notes: chunks.length > 1
          ? `${heading} (${i + 1}/${chunks.length})`
          : heading,
      });
      sl.sourceType = sec.type;   // 'intro', 'point', 'illustration', 'prayer', etc.
      slides.push(sl);
    });
  });

  // 5. Altar call
  if (s.altarCall && s.altarCall.trim()) {
    const altarChunks = _chunkProseToSlides(s.altarCall.trim());
    altarChunks.forEach((chunk, i) => {
      const sl = _mkShowSlide('announce', _autoFormat(chunk), {
        notes: altarChunks.length > 1
          ? `Altar Call (${i + 1}/${altarChunks.length})`
          : 'Altar Call',
      });
      sl.sourceType = 'altar-call';
      slides.push(sl);
    });
  }

  // Uniform 34px font on all sermon slides (non-blank)
  slides.forEach(sl => { if (sl.type !== 'blank') sl.fontSize = 34; });

  return {
    name:        s.title || 'Untitled Sermon',
    speaker:     s.speaker || s.preacher || '',
    sermonTitle: s.title || '',
    slides,
    sermonId:    s.id,
    serviceDate: s.date || '',
    theme:       { bg: 'linear-gradient(135deg,#0d1a2b,#0a2040)', tc: '#7dd3fc' },
  };
}

// Locate an existing presentation in Firestore previously created from
// THIS sermon.  Preferred path: sermon._showId.  Fallback: scan recent
// presentations for one whose `sermonId` field matches.
async function _findExistingShowForSermon(s, UR) {
  if (s._showId) {
    try {
      const existing = await UR.getPresentation(s._showId);
      if (existing && existing.id) return existing;
    } catch (_) { /* show was deleted on FlockShow side; fall through to create */ }
  }
  // Scan most recent 100 presentations as a fallback
  try {
    const res = await UR.listPresentations({ limit: 100 });
    const rows = Array.isArray(res) ? res : (res.results || res.rows || []);
    const match = rows.find(r => r.sermonId === s.id);
    return match || null;
  } catch (_) {
    return null;
  }
}

async function _sendToFlockShow() {
  const s = _active();
  if (!s) return;

  const show = _buildShowFromSermon(s);
  if (!show.slides.length) {
    _toast('No slideable content in this sermon', 'error');
    return;
  }

  const btn = _qs('bm-send-flockshow-btn');
  const restoreBtn = () => {
    if (!btn) return;
    btn.disabled = false;
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg><span class="bm-btn-label-hide">FlockShow</span>';
  };
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    const UR = window.UpperRoom;
    if (!UR || !UR.isReady()) throw new Error('FlockShow backend not available');

    const existing = await _findExistingShowForSermon(s, UR);
    if (existing) {
      await UR.updatePresentation({
        id:          existing.id,
        name:        show.name,
        slides:      show.slides,
        sermonId:    show.sermonId,
        serviceDate: show.serviceDate,
        theme:       existing.theme || show.theme, // preserve any theme edits
      });
      s._showId = existing.id;
      _toast(`Updated FlockShow ✓ (${show.slides.length} slides)`, 'success');
    } else {
      const res = await UR.createPresentation(show);
      if (res && res.id) s._showId = res.id;
      _toast(`Sent to FlockShow ✓ (${show.slides.length} slides)`, 'success');
    }
    _lsSync();
    _queueSave();
  } catch (err) {
    _toast('FlockShow send failed: ' + err.message, 'error');
  } finally {
    restoreBtn();
  }
}


function _doPrint() {
  const s = _active();
  if (!s) { _toast('No sermon selected', 'error'); return; }

  // Section type → print accent color + label
  const _TYPE = {
    intro:        { label: 'INTRO',        color: '#0284c7' },
    scripture:    { label: 'SCRIPTURE',    color: '#c48a20' },
    point:        { label: 'POINT',        color: '#7c3aed' },
    illustration: { label: 'ILLUSTRATION', color: '#059669' },
    explanation:  { label: 'EXPLANATION',  color: '#0f766e' },
    application:  { label: 'APPLICATION',  color: '#ea580c' },
    prayer:       { label: 'PRAYER',       color: '#7c3aed' },
    conclusion:   { label: 'CONCLUSION',   color: '#c48a20' },
    transition:   { label: 'TRANSITION',   color: '#94a3b8' },
  };

  const dateStr = s.date
    ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  // ── Sermon header ──────────────────────────────────────────────────────────
  let html = '<div id="bmp-wrap">';

  html += `
    <div id="bmp-header">
      <div id="bmp-header-bar"></div>
      <div id="bmp-header-body">
        <div id="bmp-header-top">
          ${s.series ? `<span id="bmp-series">${_e(s.series)}</span>` : '<span></span>'}
          ${dateStr ? `<span id="bmp-date">${_e(dateStr)}</span>` : ''}
        </div>
        <h1 id="bmp-title">${_e(s.title || 'Untitled Sermon')}</h1>
        <div id="bmp-meta-row">
          ${s.passage ? `<span class="bmp-meta-chip">&#128214; ${_e(s.passage)}</span>` : ''}
          ${s.speaker ? `<span class="bmp-meta-chip">&#9998; ${_e(s.speaker)}</span>` : ''}
        </div>
      </div>
    </div>
  `;

  // ── Outline sections ───────────────────────────────────────────────────────
  html += '<div id="bmp-sections">';

  // Trim trailing whitespace and collapse 3+ consecutive newlines to 2 — keeps
  // intentional paragraph breaks but strips empty trailing space that was making
  // section cards balloon to the bottom of the page.
  const _cleanNotes = (raw) => (raw || '')
    .replace(/[ \t]+$/gm, '')        // trim trailing spaces per line
    .replace(/\n{3,}/g, '\n\n')      // collapse runs of blank lines
    .replace(/\s+$/, '');           // strip trailing whitespace at end

  const prayerSections = [];
  (s.sections || []).forEach(sec => {
    if (sec.type === 'prayer') { prayerSections.push(sec); return; }

    const t      = _TYPE[sec.type] || _TYPE.point;
    const title  = (sec.title       || '').trim();
    const notes  = _cleanNotes(sec.notes);
    const ref    = (sec.scriptureRef|| '').trim();
    const verse  = (sec.scripture   || '').trim();
    if (!title && !notes && !ref && !verse) return;

    const isTransition = sec.type === 'transition';
    html += `
      <div class="bmp-section${isTransition ? ' bmp-transition-section' : ''}">
        <div class="bmp-section-accent" style="background:${t.color}"></div>
        <div class="bmp-section-content">
          <div class="bmp-section-head">
            <span class="bmp-type-pill" style="color:${t.color};border-color:${t.color}">${t.label}</span>
            ${title ? `<span class="bmp-section-title">${_e(title)}</span>` : ''}
          </div>
          ${sec.type === 'scripture' && (ref || verse) ? `
            <div class="bmp-verse-block">
              ${ref   ? `<div class="bmp-verse-ref">${_e(ref)}</div>` : ''}
              ${verse ? `<div class="bmp-verse-text">${_e(verse)}</div>` : ''}
            </div>
          ` : ''}
          ${notes ? `<div class="bmp-notes">${_e(notes).replace(/\n/g, '<br>')}</div>` : ''}
        </div>
      </div>
    `;
  });

  html += '</div>'; // #bmp-sections

  // ── Prayer points ──────────────────────────────────────────────────────────
  const prepEl   = document.getElementById('bm-prayer-prep');
  const prepText = prepEl ? prepEl.value.trim() : '';

  if (prayerSections.length || prepText) {
    html += '<div id="bmp-prayer">';
    html += `
      <div id="bmp-prayer-hero">
        <div id="bmp-prayer-eyebrow">PRAYER POINTS</div>
        <h2 id="bmp-prayer-title">${_e(s.title || 'Sermon')}</h2>
        ${s.scriptureRef ? `<div id="bmp-prayer-ref">${_e(s.scriptureRef)}</div>` : ''}
        <div id="bmp-prayer-rule"></div>
      </div>
    `;
    let n = 0;
    if (prepText) {
      n++;
      html += `<div class="bmp-prayer-item">
        <div class="bmp-prayer-num">${n}</div>
        <div class="bmp-prayer-body">
          <div class="bmp-prayer-item-title">Pre-Sermon Prayer</div>
          <div class="bmp-prayer-item-notes">${_e(prepText).replace(/\n/g, '<br>')}</div>
        </div>
      </div>`;
    }
    prayerSections.forEach(sec => {
      const title = (sec.title || '').trim();
      const notes = _cleanNotes(sec.notes);
      if (!title && !notes) return;
      n++;
      html += `<div class="bmp-prayer-item">
        <div class="bmp-prayer-num">${n}</div>
        <div class="bmp-prayer-body">
          ${title ? `<div class="bmp-prayer-item-title">${_e(title)}</div>` : ''}
          ${notes ? `<div class="bmp-prayer-item-notes">${_e(notes).replace(/\n/g, '<br>')}</div>` : ''}
        </div>
      </div>`;
    });
    html += '</div>'; // #bmp-prayer
  }

  html += '</div>'; // #bmp-wrap

  // ── Open in a standalone window with embedded styles + auto-print ──────────
  // This pattern works reliably on iOS/iPadOS/Android/desktop because the new
  // window exposes the browser's native print sheet (which includes "Save to
  // PDF", "Save to Files", and Share on iOS). The previous in-place approach
  // (inject-element + window.print() + immediate-remove) failed on tablets
  // because mobile browsers render print previews asynchronously, so the
  // injected element was removed before it was captured.
  _openPrintWindow(s, html);
}

/* ────────────────────────────────────────────────────────────────────────
   _openPrintWindow — render sermon in a new tab/window with full styles,
   visible Print + Close toolbar, and auto-trigger native print sheet.
   Mobile-friendly: works in iOS Safari, iPad, Android Chrome, desktop, PWA.
──────────────────────────────────────────────────────────────────────── */
function _openPrintWindow(s, bodyHtml) {
  const title = (s.title || 'Sermon').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));

  // Print styles — extracted from feed.html @media print block, applied
  // unconditionally inside this standalone document (this entire window
  // exists for printing/PDF export).
  const printCss = `
    @page { margin: 0.7in 0.8in; }
    html, body { margin: 0; padding: 0; background: #ffffff; font-family: 'Plus Jakarta Sans', sans-serif; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { padding: 0 24px 32px; max-width: 8.5in; margin: 0 auto; box-sizing: border-box; }
    #bm-print-document { font-family: 'Plus Jakarta Sans', sans-serif; color: #1a1a1a; }
    #bmp-wrap { max-width: 100%; }
    #bmp-header { margin-bottom: 20pt; }
    #bmp-header-bar { height: 5pt; background: linear-gradient(90deg, #c48a20, #e8a838); border-radius: 2pt; margin-bottom: 14pt; }
    #bmp-header-body { padding: 0; }
    #bmp-header-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4pt; }
    #bmp-series { font: 600 9pt 'Plus Jakarta Sans', sans-serif; color: #c48a20; text-transform: uppercase; letter-spacing: .08em; }
    #bmp-date { font: 400 9pt 'Plus Jakarta Sans', sans-serif; color: #888; }
    #bmp-title { font: 700 24pt 'Plus Jakarta Sans', sans-serif; color: #0f0f0f; margin: 0 0 8pt; line-height: 1.15; }
    #bmp-meta-row { display: flex; gap: 14pt; flex-wrap: wrap; margin-top: 5pt; padding-top: 7pt; border-top: 1.5pt solid #e8a838; }
    .bmp-meta-chip { font: 500 9pt 'Plus Jakarta Sans', sans-serif; color: #555; }
    #bmp-sections { display: flex; flex-direction: column; gap: 9pt; }
    .bmp-section { display: flex; break-inside: avoid; border: 1pt solid #e2ded8; border-radius: 4pt; overflow: hidden; background: #fff; }
    .bmp-section-accent { width: 4.5pt; flex-shrink: 0; }
    .bmp-section-content { flex: 1; padding: 8pt 12pt; }
    .bmp-section-head { display: flex; align-items: baseline; gap: 7pt; margin-bottom: 5pt; flex-wrap: wrap; }
    .bmp-type-pill { font: 700 8pt 'Plus Jakarta Sans', sans-serif; text-transform: uppercase; letter-spacing: .10em; border: 1pt solid; padding: 2pt 6pt; border-radius: 3pt; flex-shrink: 0; }
    .bmp-section-title { font: 600 14pt 'Plus Jakarta Sans', sans-serif; color: #111; line-height: 1.3; }
    .bmp-transition-section { display: flex; align-items: center; gap: 8pt; padding: 5pt 10pt; border: none; border-top: 1pt dashed #ccc; border-bottom: 1pt dashed #ccc; background: transparent !important; }
    .bmp-transition-section .bmp-section-accent { display: none; }
    .bmp-prayer-inline { background: #faf5ff !important; border-color: #e9d5ff !important; }
    .bmp-verse-block { margin: 6pt 0; padding: 9pt 12pt 9pt 13pt; background: #fef9ec; border-left: 3pt solid #e8a838; }
    .bmp-verse-ref { font: 700 11.5pt 'Plus Jakarta Sans', sans-serif; color: #c48a20; margin-bottom: 4pt; }
    .bmp-verse-text { font: italic 13pt/1.7 Georgia, serif; color: #2c2c2c; }
    .bmp-notes { font: 13pt/1.6 Georgia, serif; color: #2c2c2c; }
    /* ── Prayer points: own page, hero header, numbered cards ──────────── */
    #bmp-prayer { page-break-before: always; break-before: page; padding-top: 0; }
    #bmp-prayer-hero { text-align: center; padding: 6pt 0 18pt; margin-bottom: 18pt; border-bottom: 2pt solid #7c3aed; }
    #bmp-prayer-eyebrow { font: 700 10pt 'Plus Jakarta Sans', sans-serif; color: #7c3aed; text-transform: uppercase; letter-spacing: .22em; margin-bottom: 8pt; }
    #bmp-prayer-title { font: 700 22pt 'Plus Jakarta Sans', sans-serif; color: #0f0f0f; margin: 0 0 6pt; line-height: 1.2; }
    #bmp-prayer-ref { font: 500 11pt 'Plus Jakarta Sans', sans-serif; color: #888; }
    #bmp-prayer-rule { display: none; }
    .bmp-prayer-item { display: flex; gap: 12pt; align-items: flex-start; break-inside: avoid; margin-bottom: 14pt; padding: 10pt 12pt; background: #faf7ff; border: 1pt solid #ede4ff; border-left: 3pt solid #7c3aed; border-radius: 4pt; }
    .bmp-prayer-num { flex-shrink: 0; width: 22pt; height: 22pt; border-radius: 50%; background: #7c3aed; color: #fff; font: 700 11pt 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; justify-content: center; }
    .bmp-prayer-body { flex: 1; min-width: 0; }
    .bmp-prayer-item-title { font: 700 13pt 'Plus Jakarta Sans', sans-serif; color: #1a1a1a; margin-bottom: 4pt; line-height: 1.3; }
    .bmp-prayer-item-notes { font: 13pt/1.55 Georgia, serif; color: #333; }

    /* ── On-screen toolbar (hidden when printing) ─────────────────────── */
    .pd-toolbar {
      position: sticky; top: 0; z-index: 100;
      display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
      padding: 12px 16px; margin: 0 -24px 24px;
      background: #1a1320; color: #f5e9c8;
      border-bottom: 2px solid #c48a20;
      font: 600 0.85rem 'Plus Jakarta Sans', sans-serif;
      padding-top: calc(12px + env(safe-area-inset-top, 0px));
    }
    .pd-toolbar-title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 8px; }
    .pd-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.20);
      background: rgba(255,255,255,0.08); color: #fff;
      font: 600 0.82rem 'Plus Jakarta Sans', sans-serif;
      cursor: pointer; transition: background .15s; white-space: nowrap;
    }
    .pd-btn:hover, .pd-btn:focus { background: rgba(255,255,255,0.18); outline: none; }
    .pd-btn--primary { background: #c48a20; border-color: #c48a20; color: #1a1320; }
    .pd-btn--primary:hover { background: #e8a838; border-color: #e8a838; }
    .pd-hint { font: 400 0.72rem 'Plus Jakarta Sans', sans-serif; color: rgba(245,233,200,0.65); padding: 8px 4px 0; text-align: center; }

    @media print {
      .pd-toolbar, .pd-hint { display: none !important; }
      body { padding: 0; max-width: none; background: #fff; }
    }
    @media (max-width: 600px) {
      body { padding: 0 14px 24px; }
      .pd-toolbar { margin: 0 -14px 16px; padding: 10px 14px; padding-top: calc(10px + env(safe-area-inset-top, 0px)); }
      #bmp-title { font-size: 20pt; }
    }
  `;

  const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} — Sermon</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${printCss}</style>
</head>
<body>
<div class="pd-toolbar" role="toolbar" aria-label="Sermon export">
  <span class="pd-toolbar-title">${title}</span>
  <button type="button" class="pd-btn pd-btn--primary" id="pd-print">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    Print / Save PDF
  </button>
  <button type="button" class="pd-btn" id="pd-close">Close</button>
</div>
<div class="pd-hint">On iPhone / iPad: tap <strong>Print / Save PDF</strong>, then pinch the preview to open the share sheet for AirDrop, Files, Mail, or Messages.</div>
<div id="bm-print-document">${bodyHtml}</div>
<script>
  document.getElementById('pd-print').addEventListener('click', function(){ try { window.print(); } catch(e) { alert('Print failed: ' + e.message); } });
  document.getElementById('pd-close').addEventListener('click', function(){ try { window.close(); } catch(e) {} });
  // Auto-trigger print once fonts/layout settle. Wrapped in setTimeout to give
  // iOS Safari time to render before invoking the native print sheet.
  window.addEventListener('load', function(){
    setTimeout(function(){ try { window.focus(); window.print(); } catch(e) {} }, 450);
  });
<\/script>
</body>
</html>`;

  // Open the new window. Must be invoked synchronously from the user click
  // handler upstream to avoid pop-up blockers.
  let win;
  try { win = window.open('', '_blank'); } catch (e) { win = null; }

  if (!win) {
    // Fallback: blob URL + anchor click — works when popups are blocked
    // (some PWAs and embedded browsers).
    try {
      const blob = new Blob([fullDoc], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      _toast('Opened sermon in new tab — use Print / Save PDF', 'success');
    } catch (err) {
      _toast('Could not open print window. Please allow pop-ups.', 'error');
    }
    return;
  }

  win.document.open();
  win.document.write(fullDoc);
  win.document.close();
}

/* ════════════════════════════════════════════════════════════════════════
   PRESENTATION MODE — fullscreen, wake-locked, mobile-responsive
═════════════════════════════════════════════════════════════════════════ */
let _presentWakeLock = null;
let _presentScale = 1;

function _buildPresentHtml(s) {
  const _TYPE = {
    intro:        { label: 'INTRO',        color: '#0284c7' },
    scripture:    { label: 'SCRIPTURE',    color: '#c48a20' },
    point:        { label: 'POINT',        color: '#7c3aed' },
    illustration: { label: 'ILLUSTRATION', color: '#059669' },
    explanation:  { label: 'EXPLANATION',  color: '#0f766e' },
    application:  { label: 'APPLICATION',  color: '#ea580c' },
    prayer:       { label: 'PRAYER',       color: '#7c3aed' },
    conclusion:   { label: 'CONCLUSION',   color: '#c48a20' },
    transition:   { label: 'TRANSITION',   color: '#94a3b8' },
  };
  const dateStr = s.date
    ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  let html = '<div id="bmp-wrap">';
  html += `
    <div id="bmp-header">
      <div id="bmp-header-bar"></div>
      <div id="bmp-header-body">
        <div id="bmp-header-top">
          ${s.series ? `<span id="bmp-series">${_e(s.series)}</span>` : '<span></span>'}
          ${dateStr ? `<span id="bmp-date">${_e(dateStr)}</span>` : ''}
        </div>
        <h1 id="bmp-title">${_e(s.title || 'Untitled Sermon')}</h1>
        <div id="bmp-meta-row">
          ${s.passage ? `<span class="bmp-meta-chip">&#128214; ${_e(s.passage)}</span>` : ''}
          ${s.speaker ? `<span class="bmp-meta-chip">&#9998; ${_e(s.speaker)}</span>` : ''}
        </div>
      </div>
    </div>
  `;

  html += '<div id="bmp-sections">';
  const prayerSections = [];
  (s.sections || []).forEach(sec => {
    const t      = _TYPE[sec.type] || _TYPE.point;
    const title  = (sec.title       || '').trim();
    const notes  = (sec.notes       || '').trim();
    const ref    = (sec.scriptureRef|| '').trim();
    const verse  = (sec.scripture   || '').trim();
    if (!title && !notes && !ref && !verse) return;
    if (sec.type === 'prayer') {
      // Collect for bottom summary AND render in-flow
      prayerSections.push(sec);
      html += `
        <div class="bmp-section bmp-prayer-inline">
          <div class="bmp-section-accent" style="background:${t.color}"></div>
          <div class="bmp-section-content">
            <div class="bmp-section-head">
              <span class="bmp-type-pill" style="color:${t.color};border-color:${t.color}">${t.label}</span>
              ${title ? `<span class="bmp-section-title">${_e(title)}</span>` : ''}
            </div>
            ${notes ? `<div class="bmp-notes">${_e(notes).replace(/\n/g, '<br>')}</div>` : ''}
          </div>
        </div>
      `;
      return;
    }
    const isTransition = sec.type === 'transition';
    html += `
      <div class="bmp-section${isTransition ? ' bmp-transition-section' : ''}">
        <div class="bmp-section-accent" style="background:${t.color}"></div>
        <div class="bmp-section-content">
          <div class="bmp-section-head">
            <span class="bmp-type-pill" style="color:${t.color};border-color:${t.color}">${t.label}</span>
            ${title ? `<span class="bmp-section-title">${_e(title)}</span>` : ''}
          </div>
          ${sec.type === 'scripture' && (ref || verse) ? `
            <div class="bmp-verse-block">
              ${ref   ? `<div class="bmp-verse-ref">${_e(ref)}</div>` : ''}
              ${verse ? `<div class="bmp-verse-text">${_e(verse)}</div>` : ''}
            </div>
          ` : ''}
          ${notes ? `<div class="bmp-notes">${_e(notes).replace(/\n/g, '<br>')}</div>` : ''}
        </div>
      </div>
    `;
  });
  html += '</div>';

  const prepEl   = document.getElementById('bm-prayer-prep');
  const prepText = prepEl ? prepEl.value.trim() : '';
  if (prayerSections.length || prepText) {
    html += '<div id="bmp-prayer">';
    html += `
      <div id="bmp-prayer-head">
        <div id="bmp-prayer-bar"></div>
        <span id="bmp-prayer-label">PRAYER POINTS</span>
      </div>
    `;
    if (prepText) {
      html += `<div class="bmp-prayer-item">
        <div class="bmp-prayer-item-title">Pre-Sermon Prayer</div>
        <div class="bmp-prayer-item-notes">${_e(prepText).replace(/\n/g, '<br>')}</div>
      </div>`;
    }
    prayerSections.forEach(sec => {
      const title = (sec.title || '').trim();
      const notes = (sec.notes || '').trim();
      if (!title && !notes) return;
      html += `<div class="bmp-prayer-item">
        ${title ? `<div class="bmp-prayer-item-title">${_e(title)}</div>` : ''}
        ${notes ? `<div class="bmp-prayer-item-notes">${_e(notes).replace(/\n/g, '<br>')}</div>` : ''}
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}

async function _acquireWakeLock(dotEl) {
  if (!('wakeLock' in navigator)) {
    if (dotEl) { dotEl.classList.add('is-off'); dotEl.title = 'Wake Lock not supported on this browser'; }
    return;
  }
  try {
    _presentWakeLock = await navigator.wakeLock.request('screen');
    if (dotEl) { dotEl.classList.remove('is-off'); dotEl.title = 'Screen will stay awake'; }
    _presentWakeLock.addEventListener('release', () => {
      if (dotEl) dotEl.classList.add('is-off');
    });
  } catch (err) {
    if (dotEl) { dotEl.classList.add('is-off'); dotEl.title = 'Wake Lock denied: ' + (err && err.message || err); }
  }
}

async function _releaseWakeLock() {
  try { if (_presentWakeLock) await _presentWakeLock.release(); } catch {}
  _presentWakeLock = null;
}

function _applyPresentScale(overlay) {
  const scroll = overlay.querySelector('.bm-present-scroll');
  if (scroll) scroll.style.setProperty('--bmpres-scale', _presentScale + 'rem');
}

function _exitPresent() {
  const overlay = document.getElementById('bm-present-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  _releaseWakeLock();
  document.removeEventListener('keydown', _presentKeyHandler);
  document.removeEventListener('visibilitychange', _presentVisHandler);
  setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 50);
}

function _presentKeyHandler(e) {
  if (e.key === 'Escape') { e.preventDefault(); _exitPresent(); }
}
function _presentVisHandler() {
  // Re-acquire wake lock when tab returns to foreground (lock auto-released on visibility change)
  if (document.visibilityState === 'visible' && document.getElementById('bm-present-overlay')) {
    const dot = document.getElementById('bm-present-wake-dot');
    _acquireWakeLock(dot);
  }
}

function _doPresent() {
  const s = _active();
  if (!s) { _toast('No sermon selected', 'error'); return; }

  // Remove any existing overlay
  const existing = document.getElementById('bm-present-overlay');
  if (existing) existing.parentNode.removeChild(existing);

  _presentScale = 1;
  const overlay = document.createElement('div');
  overlay.id = 'bm-present-overlay';
  overlay.innerHTML = `
    <div class="bm-present-titlebar">
      <span class="bm-present-wake-dot is-off" id="bm-present-wake-dot" title="Screen wake status"></span>
      <span class="bm-present-toolbar-title">${_e(s.title || 'Untitled Sermon')}</span>
    </div>
    <div class="bm-present-scroll" id="bm-present-scroll"></div>
    <div class="bm-present-toolbar bm-present-toolbar--bottom">
      <div class="bm-present-fontsize" title="Adjust text size">
        <button type="button" id="bm-present-font-down" aria-label="Decrease text size">A−</button>
        <button type="button" id="bm-present-font-up" aria-label="Increase text size">A+</button>
      </div>
      <button type="button" class="bm-present-btn bm-present-btn--icon" id="bm-present-fs-btn" title="Toggle fullscreen" aria-label="Toggle fullscreen">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/></svg>
      </button>
      <button type="button" class="bm-present-btn bm-present-btn--exit" id="bm-present-exit-btn" title="Exit presentation (Esc)">Exit</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const scroll = overlay.querySelector('#bm-present-scroll');
  scroll.innerHTML = _buildPresentHtml(s);
  _applyPresentScale(overlay);

  overlay.classList.add('is-open');

  // Wire toolbar buttons
  const dot = overlay.querySelector('#bm-present-wake-dot');
  overlay.querySelector('#bm-present-exit-btn').addEventListener('click', _exitPresent);
  overlay.querySelector('#bm-present-fs-btn').addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      overlay.requestFullscreen().catch(() => {});
    }
  });
  overlay.querySelector('#bm-present-font-up').addEventListener('click', () => {
    _presentScale = Math.min(1.8, _presentScale + 0.1);
    _applyPresentScale(overlay);
  });
  overlay.querySelector('#bm-present-font-down').addEventListener('click', () => {
    _presentScale = Math.max(0.7, _presentScale - 0.1);
    _applyPresentScale(overlay);
  });

  // Keyboard + visibility listeners
  document.addEventListener('keydown', _presentKeyHandler);
  document.addEventListener('visibilitychange', _presentVisHandler);

  // Request fullscreen + wake lock (user gesture preserved)
  if (overlay.requestFullscreen) {
    overlay.requestFullscreen().catch(() => { /* user can toggle later */ });
  }
  _acquireWakeLock(dot);
}

async function _copyOutline() {  const s = _active();
  if (!s) return;
  const lines = [`${s.title || 'Untitled Sermon'}`, s.passage ? `Key Passage: ${s.passage}` : '', ''];
  (s.sections || []).forEach((sec, i) => {
    lines.push(`${i + 1}. [${sec.type.toUpperCase()}] ${sec.title || ''}`);
    if (sec.type === 'scripture' && sec.scriptureRef) {
      lines.push(`   ${sec.scriptureRef}${sec.scripture ? ': ' + sec.scripture : ''}`);
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

// ── Confirm delete (two-step) ────────────────────────────────────────────────
function _confirmDelete() {
  const s = _active();
  if (!s) return;
  const modal     = _qs('bm-confirm-modal');
  const headEl    = _qs('bm-modal-h');
  const bodyEl    = _qs('bm-modal-p');
  const okBtn     = _qs('bm-modal-confirm');
  const cancelBtn = _qs('bm-modal-cancel');
  const backdrop  = _qs('bm-modal-backdrop');
  const title     = s.title || 'Untitled';
  const closeModal = () => { modal.hidden = true; };

  const performDelete = async () => {
    closeModal();
    const item = document.querySelector(`.bm-sermon-item[data-id="${_e(s.id)}"]`);
    if (item) { item.classList.add('removing'); await new Promise(r => setTimeout(r, 220)); }
    await _deleteSermon(s);
    S.activeId = null;
    _qs('bm-empty').hidden  = false;
    _qs('bm-editor').hidden = true;
    const titleEl = _qs('bm-active-title');
    if (titleEl) { titleEl.textContent = 'FEED'; titleEl.classList.remove('has-sermon'); }
    const saveBtn = _qs('bm-save-btn');
    if (saveBtn) saveBtn.disabled = true;
    const closeBtn = _qs('bm-close-sermon-btn');
    if (closeBtn) closeBtn.style.display = 'none';
    _renderList();
    _renderLanding();
    _toast('Sermon deleted', 'error');
  };

  // ── Step 2: final "are you absolutely sure?" prompt ──
  const showStepTwo = () => {
    headEl.textContent = 'Are you absolutely sure?';
    bodyEl.textContent = `This will permanently delete "${title}". There is no undo. Click "Delete Permanently" to confirm.`;
    okBtn.textContent  = 'Delete Permanently';
    modal.hidden = false;
    okBtn.onclick      = performDelete;
    cancelBtn.onclick  = closeModal;
    backdrop.onclick   = closeModal;
  };

  // ── Step 1: initial confirmation ──
  headEl.textContent = 'Delete Sermon?';
  bodyEl.textContent = `"${title}" will be permanently deleted. This cannot be undone.`;
  okBtn.textContent  = 'Delete';
  modal.hidden = false;
  okBtn.onclick      = showStepTwo;
  cancelBtn.onclick  = closeModal;
  backdrop.onclick   = closeModal;
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
// bibleComVersion: YouVersion version_id — when set, Go opens bible.com directly
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

// Compact book-name → YouVersion USFM code map for direct bible.com verse URLs.
// Same pattern as the_bible_link.js / Grow referenceUrl format: /bible/59/JHN.3.16.ESV
const _BC_BOOKS = {
  'genesis':'GEN','gen':'GEN','exodus':'EXO','exo':'EXO','exod':'EXO',
  'leviticus':'LEV','lev':'LEV','numbers':'NUM','num':'NUM',
  'deuteronomy':'DEU','deut':'DEU','deu':'DEU','joshua':'JOS','josh':'JOS','jos':'JOS',
  'judges':'JDG','judg':'JDG','jdg':'JDG','ruth':'RUT','rut':'RUT',
  '1 samuel':'1SA','1samuel':'1SA','1 sam':'1SA','1sam':'1SA',
  '2 samuel':'2SA','2samuel':'2SA','2 sam':'2SA','2sam':'2SA',
  '1 kings':'1KI','1kings':'1KI','1 kgs':'1KI','1kgs':'1KI',
  '2 kings':'2KI','2kings':'2KI','2 kgs':'2KI','2kgs':'2KI',
  '1 chronicles':'1CH','1chronicles':'1CH','1 chr':'1CH','1chr':'1CH',
  '2 chronicles':'2CH','2chronicles':'2CH','2 chr':'2CH','2chr':'2CH',
  'ezra':'EZR','ezr':'EZR','nehemiah':'NEH','neh':'NEH','esther':'EST','est':'EST','job':'JOB',
  'psalm':'PSA','psalms':'PSA','ps':'PSA','psa':'PSA',
  'proverbs':'PRO','prov':'PRO','pro':'PRO',
  'ecclesiastes':'ECC','eccl':'ECC','ecc':'ECC',
  'song of solomon':'SNG','song of songs':'SNG','song':'SNG','sng':'SNG','sos':'SNG','canticles':'SNG',
  'isaiah':'ISA','isa':'ISA','jeremiah':'JER','jer':'JER','lamentations':'LAM','lam':'LAM',
  'ezekiel':'EZK','ezek':'EZK','ezk':'EZK','daniel':'DAN','dan':'DAN',
  'hosea':'HOS','hos':'HOS','joel':'JOL','jol':'JOL','amos':'AMO','amo':'AMO',
  'obadiah':'OBA','oba':'OBA','jonah':'JON','jon':'JON','micah':'MIC','mic':'MIC',
  'nahum':'NAM','nah':'NAM','nam':'NAM','habakkuk':'HAB','hab':'HAB',
  'zephaniah':'ZEP','zeph':'ZEP','zep':'ZEP','haggai':'HAG','hag':'HAG',
  'zechariah':'ZEC','zech':'ZEC','zec':'ZEC','malachi':'MAL','mal':'MAL',
  'matthew':'MAT','matt':'MAT','mat':'MAT','mark':'MRK','mrk':'MRK','mk':'MRK',
  'luke':'LUK','luk':'LUK','lk':'LUK','john':'JHN','jhn':'JHN','jn':'JHN',
  'acts':'ACT','act':'ACT','romans':'ROM','rom':'ROM',
  '1 corinthians':'1CO','1corinthians':'1CO','1 cor':'1CO','1cor':'1CO',
  '2 corinthians':'2CO','2corinthians':'2CO','2 cor':'2CO','2cor':'2CO',
  'galatians':'GAL','gal':'GAL','ephesians':'EPH','eph':'EPH',
  'philippians':'PHP','phil':'PHP','php':'PHP','colossians':'COL','col':'COL',
  '1 thessalonians':'1TH','1thessalonians':'1TH','1 thess':'1TH','1 thes':'1TH',
  '2 thessalonians':'2TH','2thessalonians':'2TH','2 thess':'2TH','2 thes':'2TH',
  '1 timothy':'1TI','1timothy':'1TI','1 tim':'1TI','1tim':'1TI',
  '2 timothy':'2TI','2timothy':'2TI','2 tim':'2TI','2tim':'2TI',
  'titus':'TIT','tit':'TIT','philemon':'PHM','philem':'PHM','phm':'PHM',
  'hebrews':'HEB','heb':'HEB','james':'JAS','jas':'JAS',
  '1 peter':'1PE','1peter':'1PE','1 pet':'1PE','1pet':'1PE',
  '2 peter':'2PE','2peter':'2PE','2 pet':'2PE','2pet':'2PE',
  '1 john':'1JN','1john':'1JN','1 jn':'1JN','1jn':'1JN',
  '2 john':'2JN','2john':'2JN','2 jn':'2JN','2jn':'2JN',
  '3 john':'3JN','3john':'3JN','3 jn':'3JN','3jn':'3JN',
  'jude':'JUD','revelation':'REV','rev':'REV','revelations':'REV',
};

/**
 * Parse a freeform reference (e.g. "John 3:16", "1 Cor 13:4-7", "Proverbs 11:23-25")
 * and return a direct bible.com URL using the YouVersion USFM path format:
 *   https://www.bible.com/bible/{versionId}/{CODE}.{chapter}.{verse(-end)}.ABBREV
 * Returns null if the reference can't be parsed.
 */
function _bibleComDirectUrl(rawRef, versionId, abbrev) {
  const s = rawRef.toLowerCase().replace(/\s+/g, ' ').trim();
  // Match: optional numbered prefix (1/2/3/i/ii/iii) + book name + chapter + optional :verse(-end)
  const m = s.match(/^((?:[1-3]|i{1,3}v?|iv)\s+)?([a-z]+(?:\s[a-z]+)*)\s+(\d+)(?::(\d+)(?:[\-\u2013](\d+))?)?$/);
  if (!m) return null;
  const prefix  = (m[1] || '').replace(/\s$/, '');
  const rawBook = (prefix ? prefix + ' ' + m[2] : m[2]).trim();
  const chapter  = m[3];
  const verse    = m[4];
  const verseEnd = m[5];

  const code = _BC_BOOKS[rawBook] || _BC_BOOKS[m[2].trim()];
  if (!code) return null;

  let path = `${code}.${chapter}`;
  if (verse) {
    path += `.${verse}`;
    if (verseEnd) path += `-${verseEnd}`;
  }
  if (abbrev) path += `.${abbrev}`;
  return `https://www.bible.com/bible/${versionId}/${path}`;
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
    // Licensed translation — build a direct USFM verse URL (same pattern as Grow referenceUrls)
    const directUrl = _bibleComDirectUrl(rawRef, transConf.bibleComVersion, transKey);
    const fallbackUrl = `https://www.bible.com/search/bible?q=${encodeURIComponent(rawRef)}&version_id=${transConf.bibleComVersion}`;
    const bcUrl = directUrl || fallbackUrl;
    textEl.innerHTML = `<a class="bm-lookup-bible-link" href="${bcUrl}" target="_blank" rel="noopener">Open ${_e(rawRef)} · ${transKey} on Bible.com ↗</a>`;
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

// ════════════════════════════════════════════════════════════════════════════
// FEED LANDING PAGE — sermon prep & study dashboard
// ════════════════════════════════════════════════════════════════════════════

const BM_SCRATCH_KEY = 'bm_feed_scratch_v1';

// Verse-of-the-day rotation (deterministic by day-of-year)
const _VOTD = [
  { ref: 'Romans 10:17',     text: 'So then faith comes by hearing, and hearing by the word of God.' },
  { ref: 'Psalm 119:105',    text: 'Your word is a lamp to my feet and a light to my path.' },
  { ref: 'Hebrews 4:12',     text: 'For the word of God is living and active, sharper than any two-edged sword…' },
  { ref: '2 Timothy 3:16',   text: 'All Scripture is breathed out by God and profitable for teaching, for reproof, for correction, and for training in righteousness.' },
  { ref: 'Isaiah 55:11',     text: 'So shall my word be that goes out from my mouth; it shall not return to me empty…' },
  { ref: 'Joshua 1:8',       text: 'This Book of the Law shall not depart from your mouth, but you shall meditate on it day and night…' },
  { ref: 'Matthew 4:4',      text: 'Man shall not live by bread alone, but by every word that comes from the mouth of God.' },
  { ref: 'John 1:1',         text: 'In the beginning was the Word, and the Word was with God, and the Word was God.' },
  { ref: 'Psalm 19:7',       text: 'The law of the LORD is perfect, reviving the soul; the testimony of the LORD is sure, making wise the simple.' },
  { ref: '1 Peter 2:2',      text: 'Like newborn infants, long for the pure spiritual milk, that by it you may grow up into salvation.' },
  { ref: 'James 1:22',       text: 'But be doers of the word, and not hearers only, deceiving yourselves.' },
  { ref: 'Colossians 3:16',  text: 'Let the word of Christ dwell in you richly, teaching and admonishing one another in all wisdom…' },
  { ref: 'Acts 17:11',       text: '…they received the word with all eagerness, examining the Scriptures daily to see if these things were so.' },
  { ref: 'Psalm 1:2',        text: '…his delight is in the law of the LORD, and on his law he meditates day and night.' }
];

function _votdToday() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const day = Math.floor((d - start) / 86400000);
  return _VOTD[day % _VOTD.length];
}

function _firstName() {
  try {
    const u = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
    const n = (u && (u.displayName || u.email)) || '';
    return (n.split(/[\s@]/)[0] || '').replace(/^./, c => c.toUpperCase());
  } catch (_) { return ''; }
}

function _fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function _fmtAgo(ts) {
  if (!ts) return '';
  const ms = Date.now() - ts;
  const min = Math.floor(ms / 60000);
  if (min < 1)   return 'just now';
  if (min < 60)  return min + 'm ago';
  const hr  = Math.floor(min / 60);
  if (hr  < 24)  return hr  + 'h ago';
  const day = Math.floor(hr / 24);
  if (day < 7)   return day + 'd ago';
  return _fmtDate(ts);
}

function _renderLanding() {
  // Greeting
  const greet = _qs('bm-land-greeting');
  if (greet) {
    const fn = _firstName();
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');
    greet.textContent = fn ? `${part}, ${fn}` : 'Welcome to FEED';
  }

  // Verse of the Day
  const v = _votdToday();
  const vtxt = _qs('bm-land-votd-text');
  const vref = _qs('bm-land-votd-ref');
  if (vtxt) vtxt.textContent = '"' + v.text + '"';
  if (vref) vref.textContent = '— ' + v.ref;

  _renderLandingRecent();
  _renderLandingTopics();
  _renderLandingArchive();
  _renderLandingUpcoming();
  _renderLandingJournal();
  _renderLandingPlan();
  _renderLandingPrayers();

  // Restore scratchpad
  const scr = _qs('bm-land-scratch');
  if (scr && !scr.dataset._init) {
    scr.dataset._init = '1';
    try { scr.value = localStorage.getItem(BM_SCRATCH_KEY) || ''; } catch (_) {}
  }
}

function _renderLandingRecent() {
  const list = _qs('bm-land-recent-list');
  if (!list) return;
  const recent = (S.sermons || [])
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 5);
  if (!recent.length) {
    list.innerHTML = '<div class="bm-land-empty-line">No sermons yet — click <strong>New Sermon</strong> to begin.</div>';
    return;
  }
  list.innerHTML = recent.map(s => `
    <div class="bm-land-list-item" data-sermon-id="${_e(s.id)}">
      <div class="bm-land-list-item-title">${_e(s.title || 'Untitled')}</div>
      <div class="bm-land-list-item-meta">${_e(_fmtAgo(s.updatedAt))}</div>
    </div>
  `).join('');
  list.querySelectorAll('.bm-land-list-item').forEach(el => {
    el.addEventListener('click', () => _selectSermon(el.dataset.sermonId));
  });
}

function _renderLandingTopics() {
  const wrap = _qs('bm-land-topics-tags');
  if (!wrap) return;
  const counts = new Map();
  (S.sermons || []).forEach(s => {
    const tags = []
      .concat(s.tags || [])
      .concat(s.themes || [])
      .concat(s.series ? [s.series] : []);
    tags.forEach(t => {
      const k = String(t || '').trim();
      if (!k) return;
      counts.set(k, (counts.get(k) || 0) + 1);
    });
  });
  if (!counts.size) {
    wrap.innerHTML = '<div class="bm-land-empty-line">Add tags or a series to a sermon to build a topic library.</div>';
    return;
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
  wrap.innerHTML = sorted.map(([t, n]) => `
    <button class="bm-land-tag" data-topic="${_e(t)}">${_e(t)}<span class="bm-land-tag-count">${n}</span></button>
  `).join('');
  wrap.querySelectorAll('.bm-land-tag').forEach(el => {
    el.addEventListener('click', () => {
      const search = _qs('bm-land-archive-search');
      if (search) { search.value = el.dataset.topic; _renderLandingArchive(); search.focus(); }
    });
  });
}

function _renderLandingArchive() {
  const grid = _qs('bm-land-archive-grid');
  const cnt  = _qs('bm-land-archive-count');
  const inp  = _qs('bm-land-archive-search');
  if (!grid) return;
  const q = ((inp && inp.value) || '').trim().toLowerCase();
  let rows = (S.sermons || []).slice();
  if (q) {
    rows = rows.filter(s => {
      const hay = [s.title, s.series, s.passage, s.speaker, (s.tags || []).join(' '), (s.themes || []).join(' ')]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  rows.sort((a, b) => (b.date || b.updatedAt || 0) - (a.date || a.updatedAt || 0));
  if (cnt) cnt.textContent = rows.length + (rows.length === 1 ? ' sermon' : ' sermons');
  if (!rows.length) {
    grid.innerHTML = '<div class="bm-land-empty-line">' + (q ? 'No matches.' : 'No sermons yet.') + '</div>';
    return;
  }
  grid.innerHTML = rows.slice(0, 60).map(s => {
    const meta = [s.series, s.passage, s.date ? _fmtDate(s.date) : ''].filter(Boolean).join(' · ');
    return `<div class="bm-land-archive-item" data-sermon-id="${_e(s.id)}">
      <div class="bm-land-archive-title">${_e(s.title || 'Untitled')}</div>
      <div class="bm-land-archive-meta">${_e(meta || _fmtAgo(s.updatedAt))}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.bm-land-archive-item').forEach(el => {
    el.addEventListener('click', () => _selectSermon(el.dataset.sermonId));
  });
}

async function _renderLandingUpcoming() {
  const body = _qs('bm-land-upcoming-body');
  if (!body) return;

  // Try a sermon with a future scheduled date first (uses local sermon list)
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const upcoming = (S.sermons || [])
      .map(s => {
        const t = s.date ? new Date(s.date).getTime() : 0;
        return t ? { s, t } : null;
      })
      .filter(x => x && x.t >= today.getTime())
      .sort((a, b) => a.t - b.t);
    if (upcoming.length) {
      const top = upcoming[0];
      body.innerHTML = `
        <div class="bm-land-list-item" data-sermon-id="${_e(top.s.id)}">
          <div class="bm-land-list-item-title">${_e(top.s.title || 'Untitled')}</div>
          <div class="bm-land-list-item-meta">${_e(_fmtDate(top.t))}</div>
        </div>
      `;
      const item = body.querySelector('.bm-land-list-item');
      if (item) item.addEventListener('click', () => _selectSermon(item.dataset.sermonId));
      return;
    }
  } catch (_) {}

  body.innerHTML = '<div class="bm-land-empty-line">No scheduled sermon yet. Set a date on a sermon to see it here.</div>';
}

async function _renderLandingJournal() {
  const list = _qs('bm-land-journal-list');
  if (!list) return;
  if (!(window.UpperRoom && typeof window.UpperRoom.listJournal === 'function')) {
    return; // leave default empty line
  }
  try {
    const res = await window.UpperRoom.listJournal({ limit: 5 });
    const rows = (res && (res.rows || res.items || res)) || [];
    if (!rows.length) {
      list.innerHTML = '<div class="bm-land-empty-line">No journal entries yet.</div>';
      return;
    }
    list.innerHTML = rows.slice(0, 5).map(e => {
      const title = e.title || e.summary || e.text || 'Journal entry';
      const ts = e.updatedAt || e.createdAt || e.date || 0;
      return `<div class="bm-land-list-item">
        <div class="bm-land-list-item-title">${_e(String(title).slice(0, 80))}</div>
        <div class="bm-land-list-item-meta">${_e(_fmtAgo(typeof ts === 'number' ? ts : new Date(ts).getTime()))}</div>
      </div>`;
    }).join('');
  } catch (_) { /* silent */ }
}

// ── Strong's quick search on the landing page ────────────────────────────────
function _bindLandingStrongs() {
  const input = _qs('bm-land-strongs-input');
  const out   = _qs('bm-land-strongs-result');
  if (!input || !out) return;
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) {
      out.innerHTML = '<div class="bm-land-empty-line">Enter a Strong\'s number or English word.</div>';
      return;
    }
    timer = setTimeout(() => _doLandingStrongs(q, out), 300);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { clearTimeout(timer); _doLandingStrongs(input.value.trim(), out); }
  });
}

// Normalize a word/Firestore lex entry to a single shape for landing rendering.
function _landingNormalizeLex(e, fallbackId) {
  if (!e) return null;
  return {
    strongs : e.strongs || e.id || fallbackId || '',
    lemma   : e.lemma || e.word || '',
    translit: e.xlit  || e.translit || e.pron || '',
    def     : e.strongs_def || e.kjv_def || e.definition || e.def || ''
  };
}

function _landingRenderLexList(out, items) {
  if (!items || !items.length) {
    out.innerHTML = '<div class="bm-land-empty-line">No matches.</div>';
    return;
  }
  out.innerHTML = items.slice(0, 6).map(w => `
    <div class="bm-land-list-item">
      <div class="bm-land-list-item-title"><strong>${_e(w.strongs)}</strong>${w.lemma ? ' &middot; ' + _e(w.lemma) : ''}${w.translit ? ' <span style="opacity:0.7">(' + _e(w.translit) + ')</span>' : ''}</div>
      <div class="bm-land-list-item-meta">${_e((w.def || '').slice(0, 90))}</div>
    </div>
  `).join('');
}

// Search the in-memory Strong's globals (window._strongsGreek / _strongsHebrew)
// for English word, transliteration, or definition matches. Returns normalized list.
function _landingSearchInMemory(lq) {
  const out = [];
  const buckets = [
    [window._strongsGreek,  'G'],
    [window._strongsHebrew, 'H']
  ];
  for (const [bucket] of buckets) {
    if (!bucket) continue;
    for (const k of Object.keys(bucket)) {
      const e = bucket[k];
      if (!e) continue;
      const word     = (e.word || e.lemma || '').toLowerCase();
      const translit = (e.translit || e.xlit || '').toLowerCase();
      const def      = (e.definition || e.def || e.kjv_def || e.strongs_def || '').toLowerCase();
      if (!word && !translit && !def) continue;
      let score = 0;
      if (word === lq || translit === lq) score = 100;
      else if (word.startsWith(lq) || translit.startsWith(lq)) score = 60;
      else if (def && new RegExp('\\b' + lq.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '\\b').test(def)) score = 30;
      if (score) out.push({ score, entry: _landingNormalizeLex(e, (e.strongs || k)) });
      if (out.length > 200) break;
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.map(x => x.entry);
}

// Lazy-load the Strong's Greek/Hebrew dictionaries (~3MB total) the first time
// the landing search is used. Cached on window so subsequent calls are instant.
let _strongsLoadPromise = null;
function _loadStrongsDicts() {
  if (window._strongsGreek && window._strongsHebrew) return Promise.resolve();
  if (_strongsLoadPromise) return _strongsLoadPromise;
  _strongsLoadPromise = (async () => {
    try {
      // Dynamic import() resolves URLs relative to the *script* URL, ignoring
      // <base href>. feed.html sets <base href="../"> so document.baseURI is
      // the New_Covenant/ directory — build absolute URLs from it so the
      // imports land on /New_Covenant/Data/* instead of /app.feed/Data/*.
      const greekURL  = new URL('Data/strongs-greek.js',  document.baseURI).href;
      const hebrewURL = new URL('Data/strongs-hebrew.js', document.baseURI).href;
      const [gk, hb] = await Promise.all([
        import(greekURL).catch(e => { console.warn('[TheFeed] Greek dict load failed:', e); return null; }),
        import(hebrewURL).catch(e => { console.warn('[TheFeed] Hebrew dict load failed:', e); return null; })
      ]);
      if (gk && gk.default) window._strongsGreek  = gk.default;
      if (hb && hb.default) window._strongsHebrew = hb.default;
    } catch (e) {
      console.warn('[TheFeed] Strong\'s dictionaries failed to load:', e);
    }
  })();
  return _strongsLoadPromise;
}

async function _doLandingStrongs(q, out) {
  if (!q) return;
  out.innerHTML = '<div class="bm-land-empty-line">Searching…</div>';
  const isStrongs = /^[GH]\d+$/i.test(q);
  try {
    // Make sure the dictionaries are loaded before searching.
    await _loadStrongsDicts();

    // ── Strong's-number lookup ────────────────────────────────────────────
    if (isStrongs) {
      const id = q.toUpperCase();
      // In-memory first
      const num    = id.slice(1);
      const bucket = id[0] === 'G' ? window._strongsGreek : window._strongsHebrew;
      const local  = bucket ? (bucket[num] || bucket[id]) : null;
      if (local) { _landingRenderLexList(out, [_landingNormalizeLex(local, id)]); return; }
      // Then Firestore by doc id
      if (window.firebase && firebase.firestore) {
        try {
          const doc = await firebase.firestore().collection('words').doc(id).get();
          if (doc.exists) { _landingRenderLexList(out, [_landingNormalizeLex(doc.data(), id)]); return; }
        } catch (_) {}
      }
      out.innerHTML = '<div class="bm-land-empty-line">No matches.</div>';
      return;
    }

    // ── Word / transliteration / definition lookup ───────────────────────
    const lq = q.toLowerCase();
    const results = [];
    const seen = new Set();
    const push = (it) => { if (it && it.strongs && !seen.has(it.strongs)) { seen.add(it.strongs); results.push(it); } };

    // 1. In-memory dictionaries (fast, works offline once loaded)
    for (const it of _landingSearchInMemory(lq)) push(it);

    // 2. Firestore queries: exact lemma, exact xlit, kjv_def prefix
    if (results.length < 6 && window.firebase && firebase.firestore) {
      const db = firebase.firestore();
      try {
        const queries = [
          db.collection('words').where('lemma', '==', q).limit(4).get(),
          db.collection('words').where('xlit',  '==', lq).limit(4).get(),
          db.collection('words').where('kjv_def', '>=', lq).where('kjv_def', '<=', lq + '\uf8ff').limit(4).get()
        ];
        const snaps = await Promise.all(queries.map(p => p.catch(() => null)));
        for (const snap of snaps) {
          if (!snap || snap.empty) continue;
          snap.forEach(doc => push(_landingNormalizeLex(doc.data(), doc.id)));
        }
      } catch (_) {}
    }

    _landingRenderLexList(out, results);
  } catch (_) {
    out.innerHTML = '<div class="bm-land-empty-line">Search unavailable.</div>';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// BIBLE READING PLAN — chapter-by-chapter walk through the whole Bible
// ════════════════════════════════════════════════════════════════════════════

const BM_PLAN_KEY = 'bm_feed_plan_v1';

// Canonical 66-book chapter counts (Protestant canon, KJV/standard order)
const BM_BIBLE_BOOKS = [
  ['Genesis',50],['Exodus',40],['Leviticus',27],['Numbers',36],['Deuteronomy',34],
  ['Joshua',24],['Judges',21],['Ruth',4],['1 Samuel',31],['2 Samuel',24],
  ['1 Kings',22],['2 Kings',25],['1 Chronicles',29],['2 Chronicles',36],['Ezra',10],
  ['Nehemiah',13],['Esther',10],['Job',42],['Psalms',150],['Proverbs',31],
  ['Ecclesiastes',12],['Song of Solomon',8],['Isaiah',66],['Jeremiah',52],['Lamentations',5],
  ['Ezekiel',48],['Daniel',12],['Hosea',14],['Joel',3],['Amos',9],
  ['Obadiah',1],['Jonah',4],['Micah',7],['Nahum',3],['Habakkuk',3],
  ['Zephaniah',3],['Haggai',2],['Zechariah',14],['Malachi',4],
  ['Matthew',28],['Mark',16],['Luke',24],['John',21],['Acts',28],
  ['Romans',16],['1 Corinthians',16],['2 Corinthians',13],['Galatians',6],['Ephesians',6],
  ['Philippians',4],['Colossians',4],['1 Thessalonians',5],['2 Thessalonians',3],
  ['1 Timothy',6],['2 Timothy',4],['Titus',3],['Philemon',1],['Hebrews',13],
  ['James',5],['1 Peter',5],['2 Peter',3],['1 John',5],['2 John',1],
  ['3 John',1],['Jude',1],['Revelation',22]
];
const BM_BIBLE_TOTAL = BM_BIBLE_BOOKS.reduce((a, b) => a + b[1], 0); // 1189

function _planLoad() {
  try {
    const raw = localStorage.getItem(BM_PLAN_KEY);
    if (!raw) return { done: 0, last: 0 };
    const p = JSON.parse(raw);
    return { done: Math.max(0, Math.min(BM_BIBLE_TOTAL, p.done | 0)), last: p.last || 0 };
  } catch (_) { return { done: 0, last: 0 }; }
}
function _planSave(p) {
  try { localStorage.setItem(BM_PLAN_KEY, JSON.stringify(p)); } catch (_) {}
}
function _planRefAt(idx) {
  // idx is 0-based chapter index across whole Bible
  let n = idx;
  for (const [book, count] of BM_BIBLE_BOOKS) {
    if (n < count) return { book, chapter: n + 1, ref: book + ' ' + (n + 1) };
    n -= count;
  }
  return { book: 'Revelation', chapter: 22, ref: 'Revelation 22' };
}
function _renderLandingPlan() {
  const cur  = _qs('bm-land-plan-current');
  const bar  = _qs('bm-land-plan-bar');
  const sub  = _qs('bm-land-plan-sub');
  const undo = _qs('bm-land-plan-undo-btn');
  if (!cur || !bar) return;
  const p = _planLoad();
  if (p.done >= BM_BIBLE_TOTAL) {
    cur.textContent = '🎉 You finished the Bible! Tap Undo to revisit, or restart.';
    bar.style.width = '100%';
    if (sub) sub.textContent = BM_BIBLE_TOTAL + ' / ' + BM_BIBLE_TOTAL + ' chapters';
    if (undo) undo.disabled = false;
    return;
  }
  const next = _planRefAt(p.done);
  cur.innerHTML = '<strong>Today: ' + _e(next.ref) + '</strong>';
  bar.style.width = ((p.done / BM_BIBLE_TOTAL) * 100).toFixed(2) + '%';
  if (sub) sub.textContent = p.done + ' / ' + BM_BIBLE_TOTAL + ' chapters · ' + Math.round((p.done / BM_BIBLE_TOTAL) * 100) + '%';
  if (undo) undo.disabled = (p.done === 0);
}
function _bindLandingPlan() {
  const doneBtn = _qs('bm-land-plan-done-btn');
  const undoBtn = _qs('bm-land-plan-undo-btn');
  const lookBtn = _qs('bm-land-plan-lookup-btn');
  if (doneBtn) {
    doneBtn.addEventListener('click', () => {
      const p = _planLoad();
      if (p.done >= BM_BIBLE_TOTAL) return;
      const ref = _planRefAt(p.done).ref;
      p.done += 1;
      p.last = Date.now();
      _planSave(p);
      _renderLandingPlan();
      if (typeof _toast === 'function') _toast('Marked complete: ' + ref, 'success');
    });
  }
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      const p = _planLoad();
      if (p.done === 0) return;
      p.done -= 1;
      _planSave(p);
      _renderLandingPlan();
    });
  }
  if (lookBtn) {
    lookBtn.addEventListener('click', () => {
      const p = _planLoad();
      const ref = _planRefAt(Math.min(p.done, BM_BIBLE_TOTAL - 1)).ref;
      // Switch to research tab and run scripture lookup
      const inp = _qs('bm-lookup-input');
      if (inp) {
        inp.value = ref;
        if (typeof _renderTab === 'function') _renderTab('research');
        if (typeof _doScriptureLookup === 'function') _doScriptureLookup(ref);
      } else if (typeof _toast === 'function') {
        _toast('Today: ' + ref, 'info');
      }
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PRAYER LIST — personal, localStorage-backed
// ════════════════════════════════════════════════════════════════════════════

const BM_PRAYER_KEY = 'bm_feed_prayers_v1';

function _prayersLoad() {
  try {
    const raw = localStorage.getItem(BM_PRAYER_KEY);
    return raw ? (JSON.parse(raw) || []) : [];
  } catch (_) { return []; }
}
function _prayersSave(arr) {
  try { localStorage.setItem(BM_PRAYER_KEY, JSON.stringify(arr || [])); } catch (_) {}
}
function _renderLandingPrayers() {
  const list = _qs('bm-land-prayer-list');
  const cnt  = _qs('bm-land-prayer-count');
  if (!list) return;
  const all = _prayersLoad();
  // Active first, answered after
  const sorted = all.slice().sort((a, b) => {
    if (!!a.answered !== !!b.answered) return a.answered ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  const active = all.filter(p => !p.answered).length;
  if (cnt) cnt.textContent = active + (active === 1 ? ' active' : ' active');
  if (!sorted.length) {
    list.innerHTML = '<div class="bm-land-empty-line">No active prayers. Add one above.</div>';
    return;
  }
  list.innerHTML = sorted.map(p => {
    const when = _fmtAgo(p.createdAt || 0);
    const meta = p.answered
      ? 'Answered ' + (p.answeredAt ? _fmtAgo(p.answeredAt) : '')
      : 'Added ' + when;
    return '<div class="bm-land-prayer-item' + (p.answered ? ' is-answered' : '') + '" data-id="' + _e(p.id) + '">'
      + '<div style="flex:1;min-width:0">'
      +   '<div class="bm-land-prayer-text">' + _e(p.text || '') + '</div>'
      +   '<div class="bm-land-prayer-meta">' + _e(meta) + '</div>'
      + '</div>'
      + '<div class="bm-land-prayer-actions">'
      +   '<button class="bm-land-prayer-icon is-answer" data-act="toggle" title="' + (p.answered ? 'Mark active' : 'Mark answered') + '" aria-label="Toggle answered">'
      +     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      +   '</button>'
      +   '<button class="bm-land-prayer-icon is-delete" data-act="delete" title="Delete" aria-label="Delete">'
      +     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      +   '</button>'
      + '</div>'
      + '</div>';
  }).join('');
  list.querySelectorAll('.bm-land-prayer-item').forEach(el => {
    const id = el.dataset.id;
    el.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const arr = _prayersLoad();
        const i = arr.findIndex(x => x.id === id);
        if (i < 0) return;
        if (btn.dataset.act === 'toggle') {
          arr[i].answered = !arr[i].answered;
          arr[i].answeredAt = arr[i].answered ? Date.now() : 0;
        } else if (btn.dataset.act === 'delete') {
          arr.splice(i, 1);
        }
        _prayersSave(arr);
        _renderLandingPrayers();
      });
    });
  });
}
function _bindLandingPrayers() {
  const form = _qs('bm-land-prayer-form');
  const inp  = _qs('bm-land-prayer-input');
  if (!form || !inp) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = (inp.value || '').trim();
    if (!text) return;
    const arr = _prayersLoad();
    arr.unshift({
      id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: text.slice(0, 280),
      createdAt: Date.now(),
      answered: false,
      answeredAt: 0
    });
    _prayersSave(arr);
    inp.value = '';
    _renderLandingPrayers();
  });
}

// ── Sermon Idea scratchpad (localStorage-backed) ─────────────────────────────
function _bindLandingScratch() {
  const t = _qs('bm-land-scratch');
  const h = _qs('bm-land-scratch-hint');
  if (!t) return;
  let timer = null;
  t.addEventListener('input', () => {
    clearTimeout(timer);
    if (h) h.textContent = 'Saving…';
    timer = setTimeout(() => {
      try { localStorage.setItem(BM_SCRATCH_KEY, t.value || ''); } catch (_) {}
      if (h) h.textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 400);
  });
}

// ── Close sermon → return to landing ─────────────────────────────────────────
function _closeSermon() {
  // Save any pending edits first
  try { if (typeof _saveTimer !== 'undefined') clearTimeout(_saveTimer); } catch (_) {}
  const cur = _active();
  if (cur) { try { _saveSermon(cur); } catch (_) {} }
  S.activeId = null;

  const empty = _qs('bm-empty');
  const editor = _qs('bm-editor');
  if (empty)  empty.hidden  = false;
  if (editor) editor.hidden = true;

  const titleEl = _qs('bm-active-title');
  if (titleEl) { titleEl.textContent = 'FEED'; titleEl.classList.remove('has-sermon'); }

  // Disable sermon-only buttons
  ['bm-save-btn','bm-duplicate-btn','bm-copy-outline-btn','bm-send-flockshow-btn','bm-present-btn'].forEach(id => {
    const el = _qs(id); if (el) el.disabled = true;
  });

  // Hide close (X) button
  const closeBtn = _qs('bm-close-sermon-btn');
  if (closeBtn) closeBtn.style.display = 'none';

  // Refresh list selection state
  if (typeof _renderList === 'function') _renderList();
  _renderLanding();
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

    // Render landing dashboard immediately from local data so the welcome page
    // is never blocked by Firestore/UpperRoom init or a slow sermons fetch.
    try {
      S.sermons = JSON.parse(localStorage.getItem(BM_KEY) || '[]');
    } catch (_) { S.sermons = []; }
    try { _renderList(); } catch (e) { console.warn('[TheFeed] _renderList failed:', e); }
    try { _renderSeries(); } catch (e) { console.warn('[TheFeed] _renderSeries failed:', e); }
    try { _renderLanding(); } catch (e) { console.warn('[TheFeed] _renderLanding failed:', e); }

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

    // Now hydrate from server (Firestore / GAS) and re-render with fresh data.
    try { await _load(); } catch (e) { console.warn('[TheFeed] _load failed:', e); }
    try { _renderList(); } catch (_) {}
    try { _renderSeries(); } catch (_) {}
    try { _renderLanding(); } catch (_) {}
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

  // Browse Sermons button (empty state) — opens sidebar on mobile, focuses list on desktop
  const browseBtn = _qs('bm-empty-browse-btn');
  if (browseBtn) {
    browseBtn.addEventListener('click', () => {
      const sb = _qs('bm-sidebar');
      if (sb) sb.classList.add('is-open');
    });
  }

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

  // Sermon header accordion toggle (mobile)
  const headerEl = _qs('bm-sermon-header');
  const headerToggle = _qs('bm-header-toggle');
  if (headerEl && headerToggle) {
    // Default: collapsed on narrow viewports
    if (window.innerWidth <= 600) {
      headerEl.classList.add('is-collapsed');
      headerToggle.setAttribute('aria-expanded', 'false');
    }
    headerToggle.addEventListener('click', () => {
      const collapsed = headerEl.classList.toggle('is-collapsed');
      headerToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
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

  // Present (fullscreen)
  const presBtn = _qs('bm-present-btn');
  if (presBtn) presBtn.addEventListener('click', _doPresent);

  // Print / export to PDF
  const printBtn = _qs('bm-print-btn');
  if (printBtn) printBtn.addEventListener('click', _doPrint);

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
        if (confirm('Sign out of FEED?')) N.signOut();
      }
    });
  }

  // ── FEED Landing bindings ─────────────────────────────────────────────
  const closeBtn = _qs('bm-close-sermon-btn');
  if (closeBtn) closeBtn.addEventListener('click', _closeSermon);

  // Clicking the logo: if a sermon is open, return to landing instead of navigating
  const logo = _qs('bm-logo');
  if (logo) {
    logo.addEventListener('click', e => {
      if (S.activeId) {
        e.preventDefault();
        _closeSermon();
      }
    });
  }

  // Archive search
  const archInp = _qs('bm-land-archive-search');
  if (archInp) archInp.addEventListener('input', () => _renderLandingArchive());

  // Strong's quick search + scratchpad
  _bindLandingStrongs();
  _bindLandingScratch();
  _bindLandingTools();
  _bindLandingPlan();
  _bindLandingPrayers();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDY TOOLS — Cross-Refs · Topical Index · Quote Library · Liturgical Calendar
// ═══════════════════════════════════════════════════════════════════════════════

const BM_QUOTE_KEY = 'bm_feed_quotes_v1';

// Curated cross-reference dataset for popular preaching texts.
// Keyed loosely; lookup matches case-insensitive substring of the canonical key.
const BM_XREFS = {
  'john 3:16':       [['Romans 5:8','But God demonstrates his own love for us…'],['1 John 4:9','In this the love of God was made manifest…'],['John 1:14','And the Word became flesh and dwelt among us…'],['Ephesians 2:8','For by grace you have been saved through faith…']],
  'romans 8:28':     [['Genesis 50:20','You meant evil against me, but God meant it for good…'],['Jeremiah 29:11','For I know the plans I have for you…'],['Ephesians 1:11','Predestined according to the purpose of him who works all things…'],['2 Corinthians 4:17','Light momentary affliction is preparing for us an eternal weight of glory…']],
  'romans 12:1':     [['1 Corinthians 6:19-20','Your body is a temple of the Holy Spirit…'],['Hebrews 13:15','Let us continually offer up a sacrifice of praise…'],['Philippians 2:17','Even if I am to be poured out as a drink offering…'],['1 Peter 2:5','You yourselves like living stones are being built up as a spiritual house…']],
  'philippians 4:13':[['2 Corinthians 12:9','My grace is sufficient for you, for my power is made perfect in weakness.'],['Isaiah 40:29','He gives power to the faint…'],['Ephesians 3:16','Strengthened with power through his Spirit in your inner being…'],['Colossians 1:11','Strengthened with all power according to his glorious might…']],
  'philippians 4:6': [['1 Peter 5:7','Casting all your anxieties on him, because he cares for you.'],['Matthew 6:25-34','Do not be anxious about your life…'],['Psalm 55:22','Cast your burden on the LORD…'],['Isaiah 26:3','You keep him in perfect peace whose mind is stayed on you…']],
  'matthew 28:18':   [['Acts 1:8','You will receive power when the Holy Spirit has come upon you…'],['Mark 16:15','Go into all the world and proclaim the gospel…'],['Luke 24:47','Repentance for the forgiveness of sins should be proclaimed in his name to all nations…'],['John 20:21','As the Father has sent me, even so I am sending you.']],
  'matthew 6:33':    [['Psalm 37:4','Delight yourself in the LORD, and he will give you the desires of your heart.'],['1 Kings 3:11-13','Because you have asked this, and have not asked for yourself long life…'],['Proverbs 3:5-6','Trust in the LORD with all your heart…'],['Luke 12:31','Instead, seek his kingdom, and these things will be added to you.']],
  'psalm 23':        [['John 10:11','I am the good shepherd. The good shepherd lays down his life for the sheep.'],['Ezekiel 34:11-16','I myself will search for my sheep and will seek them out.'],['Isaiah 40:11','He will tend his flock like a shepherd…'],['Revelation 7:17','For the Lamb in the midst of the throne will be their shepherd…']],
  'psalm 1':         [['Jeremiah 17:7-8','Blessed is the man who trusts in the LORD…'],['Joshua 1:8','This Book of the Law shall not depart from your mouth…'],['Matthew 7:24-27','Everyone then who hears these words of mine and does them…'],['Galatians 6:7-8','Whatever one sows, that will he also reap.']],
  'genesis 1:1':     [['John 1:1-3','In the beginning was the Word…'],['Colossians 1:16','For by him all things were created…'],['Hebrews 11:3','By faith we understand that the universe was created by the word of God…'],['Psalm 33:6','By the word of the LORD the heavens were made…']],
  'isaiah 53':       [['1 Peter 2:24','He himself bore our sins in his body on the tree…'],['John 1:29','Behold, the Lamb of God, who takes away the sin of the world!'],['2 Corinthians 5:21','For our sake he made him to be sin who knew no sin…'],['Acts 8:32-35','Beginning with this Scripture he told him the good news about Jesus.']],
  'ephesians 2:8':   [['Romans 3:24','And are justified by his grace as a gift, through the redemption that is in Christ Jesus.'],['Titus 3:5','He saved us, not because of works done by us in righteousness…'],['Galatians 2:16','A person is not justified by works of the law but through faith in Jesus Christ…'],['Romans 4:5','To the one who does not work but trusts him who justifies the ungodly…']],
  'galatians 5:22':  [['John 15:5','I am the vine; you are the branches…'],['Romans 8:13','If by the Spirit you put to death the deeds of the body, you will live.'],['Colossians 3:12-14','Put on then, as God\u2019s chosen ones, holy and beloved, compassionate hearts…'],['2 Peter 1:5-7','Make every effort to supplement your faith with virtue…']],
  'jeremiah 29:11':  [['Romans 8:28','And we know that for those who love God all things work together for good…'],['Proverbs 19:21','Many are the plans in the mind of a man, but it is the purpose of the LORD that will stand.'],['Isaiah 55:8-9','For my thoughts are not your thoughts, neither are your ways my ways…'],['Ephesians 2:10','For we are his workmanship, created in Christ Jesus for good works…']],
  'proverbs 3:5':    [['Psalm 37:5','Commit your way to the LORD; trust in him, and he will act.'],['Isaiah 55:8-9','For my thoughts are not your thoughts…'],['James 1:5','If any of you lacks wisdom, let him ask God…'],['Jeremiah 17:7','Blessed is the man who trusts in the LORD, whose trust is the LORD.']],
};

// Topical index: theme → array of [reference, snippet]
const BM_TOPICS = {
  'Love':         [['1 Corinthians 13:4-7','Love is patient and kind…'],['1 John 4:7-8','Beloved, let us love one another, for love is from God…'],['John 13:34-35','A new commandment I give to you, that you love one another…'],['Romans 5:8','But God shows his love for us in that while we were still sinners, Christ died for us.']],
  'Faith':        [['Hebrews 11:1','Now faith is the assurance of things hoped for…'],['Romans 10:17','So faith comes from hearing, and hearing through the word of Christ.'],['Ephesians 2:8-9','For by grace you have been saved through faith…'],['James 2:17','So also faith by itself, if it does not have works, is dead.']],
  'Hope':         [['Romans 15:13','May the God of hope fill you with all joy and peace in believing…'],['Hebrews 6:19','We have this as a sure and steadfast anchor of the soul…'],['1 Peter 1:3','He has caused us to be born again to a living hope…'],['Lamentations 3:22-23','His mercies never come to an end; they are new every morning.']],
  'Prayer':       [['Philippians 4:6-7','Do not be anxious about anything…'],['1 Thessalonians 5:16-18','Pray without ceasing.'],['Matthew 6:9-13','Pray then like this: Our Father in heaven…'],['James 5:16','The prayer of a righteous person has great power as it is working.']],
  'Forgiveness':  [['Ephesians 4:32','Be kind to one another, tenderhearted, forgiving one another…'],['Colossians 3:13','Bearing with one another and, if one has a complaint against another, forgiving each other…'],['Matthew 6:14-15','For if you forgive others their trespasses, your heavenly Father will also forgive you…'],['1 John 1:9','If we confess our sins, he is faithful and just to forgive us our sins…']],
  'Grace':        [['Ephesians 2:8-9','For by grace you have been saved through faith…'],['2 Corinthians 12:9','My grace is sufficient for you, for my power is made perfect in weakness.'],['Titus 2:11-12','For the grace of God has appeared, bringing salvation for all people…'],['Romans 5:20','Where sin increased, grace abounded all the more.']],
  'Joy':          [['Nehemiah 8:10','The joy of the LORD is your strength.'],['Psalm 16:11','In your presence there is fullness of joy…'],['John 15:11','These things I have spoken to you, that my joy may be in you, and that your joy may be full.'],['James 1:2-3','Count it all joy, my brothers, when you meet trials of various kinds…']],
  'Peace':        [['John 14:27','Peace I leave with you; my peace I give to you.'],['Philippians 4:7','And the peace of God, which surpasses all understanding…'],['Isaiah 26:3','You keep him in perfect peace whose mind is stayed on you…'],['Romans 5:1','Therefore, since we have been justified by faith, we have peace with God…']],
  'Salvation':    [['Romans 10:9','If you confess with your mouth that Jesus is Lord and believe in your heart…'],['Acts 4:12','And there is salvation in no one else…'],['John 3:16','For God so loved the world…'],['Ephesians 1:7','In him we have redemption through his blood…']],
  'Discipleship': [['Matthew 28:19-20','Go therefore and make disciples of all nations…'],['Luke 9:23','If anyone would come after me, let him deny himself and take up his cross daily…'],['John 13:35','By this all people will know that you are my disciples…'],['2 Timothy 2:2','What you have heard from me… entrust to faithful men…']],
  'Suffering':    [['Romans 5:3-5','We rejoice in our sufferings, knowing that suffering produces endurance…'],['2 Corinthians 4:17','For this light momentary affliction…'],['1 Peter 4:12-13','Beloved, do not be surprised at the fiery trial…'],['James 1:2-4','Count it all joy, my brothers, when you meet trials…']],
  'Worship':      [['John 4:24','God is spirit, and those who worship him must worship in spirit and truth.'],['Psalm 95:6','Oh come, let us worship and bow down…'],['Romans 12:1','Present your bodies as a living sacrifice…'],['Hebrews 13:15','Let us continually offer up a sacrifice of praise to God…']],
  'Wisdom':       [['James 1:5','If any of you lacks wisdom, let him ask God…'],['Proverbs 9:10','The fear of the LORD is the beginning of wisdom…'],['Proverbs 3:5-7','Trust in the LORD with all your heart…'],['1 Corinthians 1:30','Christ Jesus, who became to us wisdom from God…']],
  'Holiness':     [['1 Peter 1:15-16','But as he who called you is holy, you also be holy in all your conduct…'],['Hebrews 12:14','Strive for peace with everyone, and for the holiness without which no one will see the Lord.'],['Leviticus 19:2','You shall be holy, for I the LORD your God am holy.'],['Romans 12:1-2','Do not be conformed to this world, but be transformed by the renewal of your mind…']],
  'Generosity':   [['2 Corinthians 9:7','Each one must give as he has decided in his heart…'],['Acts 20:35','It is more blessed to give than to receive.'],['Proverbs 11:25','Whoever brings blessing will be enriched…'],['Luke 6:38','Give, and it will be given to you…']],
  'Family':       [['Deuteronomy 6:6-7','You shall teach them diligently to your children…'],['Ephesians 6:1-4','Children, obey your parents in the Lord…'],['Joshua 24:15','As for me and my house, we will serve the LORD.'],['Proverbs 22:6','Train up a child in the way he should go…']],
  'Marriage':     [['Ephesians 5:25-33','Husbands, love your wives, as Christ loved the church…'],['Genesis 2:24','Therefore a man shall leave his father and his mother and hold fast to his wife…'],['1 Corinthians 13','Love is patient and kind…'],['Hebrews 13:4','Let marriage be held in honor among all…']],
  'Justice':      [['Micah 6:8','He has told you, O man, what is good… to do justice, and to love kindness…'],['Isaiah 1:17','Learn to do good; seek justice, correct oppression…'],['Amos 5:24','But let justice roll down like waters, and righteousness like an ever-flowing stream.'],['Proverbs 21:3','To do righteousness and justice is more acceptable to the LORD than sacrifice.']],
  'Mission':      [['Matthew 28:18-20','Go therefore and make disciples of all nations…'],['Acts 1:8','You will be my witnesses in Jerusalem and in all Judea…'],['Romans 10:14-15','How then will they call on him in whom they have not believed?'],['Isaiah 6:8','Here I am! Send me.']],
  'Resurrection': [['1 Corinthians 15:3-8','Christ died for our sins… he was buried, that he was raised on the third day…'],['John 11:25','I am the resurrection and the life.'],['Romans 6:4-5','We were buried therefore with him by baptism into death…'],['Philippians 3:10','That I may know him and the power of his resurrection…']],
};

function _bibleGatewayUrl(ref) {
  return 'https://www.biblegateway.com/passage/?search=' + encodeURIComponent(ref) + '&version=ESV';
}

function _bindLandingTools() {
  const cards = document.querySelectorAll('.bm-land-tool-card[data-tool]');
  cards.forEach((card) => {
    card.addEventListener('click', () => _openTool(card.dataset.tool));
  });
  const drawer = _qs('bm-tool-drawer');
  if (drawer && !drawer.dataset._init) {
    drawer.dataset._init = '1';
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) _closeTool();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !drawer.hidden) _closeTool();
    });
  }
}

function _openTool(name) {
  const drawer = _qs('bm-tool-drawer');
  const eyebrow = _qs('bm-tool-drawer-eyebrow');
  const head = _qs('bm-tool-drawer-h');
  const body = _qs('bm-tool-drawer-body');
  if (!drawer || !head || !body) return;
  eyebrow.textContent = 'Study Tools';
  drawer.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  if      (name === 'cross-ref')  { head.textContent = 'Cross-References';            _renderCrossRef(body); }
  else if (name === 'topical')    { head.textContent = 'Topical Index';               _renderTopical(body); }
  else if (name === 'quotes')     { head.textContent = 'Quote & Illustration Library';_renderQuotes(body); }
  else if (name === 'liturgical') { head.textContent = 'Liturgical Calendar';         _renderLiturgical(body); }
  else if (name === 'apologetics'){ head.textContent = 'Apologetics';                 _renderApologetics(body); }
  else if (name === 'counseling') { head.textContent = 'Biblical Counseling';         _renderCounseling(body); }
  else if (name === 'creeds')     { head.textContent = 'Creeds & Confessions';        _renderCreeds(body); }
  else if (name === 'words')      { head.textContent = 'Hebrew & Greek Word Study';   _renderWords(body); }
  else if (name === 'templates')  { head.textContent = 'Sermon Templates';            _renderTemplates(body); }
  else if (name === 'prayers')    { head.textContent = 'Prayers & Liturgies';         _renderPrayers(body); }
  else if (name === 'voices')     { head.textContent = 'Voices of the Church';        _renderVoices(body); }
  else { _closeTool(); }
}

function _closeTool() {
  const drawer = _qs('bm-tool-drawer');
  if (!drawer) return;
  drawer.hidden = true;
  drawer.setAttribute('aria-hidden', 'true');
}

// ── Cross-References ──────────────────────────────────────────────────────────
function _renderCrossRef(body) {
  body.innerHTML = `
    <div class="bm-tool-section-h">Look up parallel passages</div>
    <input class="bm-tool-input" id="bm-xref-input" type="text"
           placeholder="e.g., John 3:16, Romans 8:28, Psalm 23"
           autocomplete="off" spellcheck="false">
    <div id="bm-xref-results" style="display:flex;flex-direction:column;gap:8px;"></div>
    <div class="bm-tool-section-h" style="margin-top:6px;">Popular passages</div>
    <div class="bm-topic-chips" id="bm-xref-suggest"></div>
  `;
  const input = body.querySelector('#bm-xref-input');
  const results = body.querySelector('#bm-xref-results');
  const suggest = body.querySelector('#bm-xref-suggest');
  const POPULAR = ['John 3:16','Romans 8:28','Romans 12:1','Philippians 4:13','Psalm 23','Matthew 6:33','Ephesians 2:8','Galatians 5:22','Isaiah 53','Jeremiah 29:11'];
  suggest.innerHTML = POPULAR.map(r => `<button class="bm-topic-chip" data-q="${_e(r)}">${_e(r)}</button>`).join('');
  suggest.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => { input.value = b.dataset.q; _xrefRender(input.value, results); input.focus(); });
  });
  input.addEventListener('input', () => _xrefRender(input.value, results));
  _xrefRender('', results);
  setTimeout(() => input.focus(), 50);
}

function _xrefRender(query, target) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    target.innerHTML = `<div class="bm-tool-empty">Type a verse reference to see parallel passages.<br>Try a popular passage below.</div>`;
    return;
  }
  // Find best match: exact key, then prefix, then substring
  const keys = Object.keys(BM_XREFS);
  let key = keys.find(k => k === q)
        || keys.find(k => k.startsWith(q))
        || keys.find(k => q.startsWith(k))
        || keys.find(k => k.includes(q));
  if (!key) {
    target.innerHTML = `
      <div class="bm-tool-empty">
        No curated cross-references for that verse yet.<br>
        <a href="${_bibleGatewayUrl(query)}" target="_blank" rel="noopener"
           style="color:var(--bm-accent,#e8a838);font-weight:600;">Open "${_e(query)}" on BibleGateway →</a>
      </div>`;
    return;
  }
  const matched = key.replace(/\b\w/g, c => c.toUpperCase());
  const rows = BM_XREFS[key];
  target.innerHTML = `
    <div class="bm-tool-section-h" style="color:var(--bm-accent,#e8a838);margin-top:0;">Parallels for ${_e(matched)}</div>
    ${rows.map(([ref, snip]) => `
      <div class="bm-xref-row">
        <strong>${_e(ref)}</strong>
        <span>${_e(snip)}</span>
        <a href="${_bibleGatewayUrl(ref)}" target="_blank" rel="noopener">Read on BibleGateway →</a>
      </div>
    `).join('')}
  `;
}

// ── Topical Index ─────────────────────────────────────────────────────────────
function _renderTopical(body) {
  const topics = Object.keys(BM_TOPICS).sort();
  body.innerHTML = `
    <div class="bm-tool-section-h">Choose a topic</div>
    <div class="bm-topic-chips" id="bm-topic-chips">
      ${topics.map(t => `<button class="bm-topic-chip" data-topic="${_e(t)}">${_e(t)}</button>`).join('')}
    </div>
    <div id="bm-topic-results" style="display:flex;flex-direction:column;gap:8px;"></div>
  `;
  const chips = body.querySelector('#bm-topic-chips');
  const results = body.querySelector('#bm-topic-results');
  chips.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      chips.querySelectorAll('button').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      _topicRender(b.dataset.topic, results);
    });
  });
  // Auto-pick first topic
  const first = chips.querySelector('button');
  if (first) { first.classList.add('is-active'); _topicRender(first.dataset.topic, results); }
}

function _topicRender(topic, target) {
  const verses = BM_TOPICS[topic] || [];
  if (!verses.length) { target.innerHTML = `<div class="bm-tool-empty">No verses for "${_e(topic)}" yet.</div>`; return; }
  target.innerHTML = `
    <div class="bm-tool-section-h" style="color:var(--bm-accent,#e8a838);">Verses on ${_e(topic)}</div>
    ${verses.map(([ref, snip]) => `
      <div class="bm-topic-verse">
        <strong>${_e(ref)}</strong>
        <span>${_e(snip)}</span>
        <a href="${_bibleGatewayUrl(ref)}" target="_blank" rel="noopener">Read on BibleGateway →</a>
      </div>
    `).join('')}
  `;
}

// ── Quote & Illustration Library ──────────────────────────────────────────────
function _quotesLoad() {
  try { return JSON.parse(localStorage.getItem(BM_QUOTE_KEY) || '[]'); }
  catch (_) { return []; }
}
function _quotesSave(list) {
  try { localStorage.setItem(BM_QUOTE_KEY, JSON.stringify(list)); } catch (_) {}
}

// Library cache (Firestore-backed, read-once per page load)
const _libCache = { quotes: null, illustrations: null, loadingPromise: null };

async function _loadLibrary() {
  if (_libCache.quotes && _libCache.illustrations) return _libCache;
  if (_libCache.loadingPromise) return _libCache.loadingPromise;
  _libCache.loadingPromise = (async () => {
    try {
      // Make sure Firestore is wired up via UpperRoom (mirrors the lex pattern).
      if (window.UpperRoom && typeof window.UpperRoom.waitReady === 'function') {
        try { await window.UpperRoom.waitReady(); } catch (_) {}
      }
      if (typeof firebase === 'undefined' || !firebase.firestore) {
        _libCache.quotes = []; _libCache.illustrations = [];
        return _libCache;
      }
      const db = firebase.firestore();
      const [qSnap, iSnap] = await Promise.all([
        db.collection('quotes').get().catch(e => { console.warn('[TheFeed] quotes load failed:', e); return null; }),
        db.collection('illustrations').get().catch(e => { console.warn('[TheFeed] illustrations load failed:', e); return null; }),
      ]);
      const norm = (snap, kind) => {
        if (!snap) return [];
        const out = [];
        snap.forEach(doc => {
          const d = doc.data() || {};
          out.push({
            id: doc.id,
            kind,
            text: d.text || '',
            source: d.source || (d.author ? d.author : '') || (d.passage ? d.passage : ''),
            author: d.author || '',
            title: d.title || '',
            passage: d.passage || '',
            book: d.book || '',
            tags: Array.isArray(d.tags) ? d.tags : (d.tag ? [d.tag] : []),
            scriptureRefs: Array.isArray(d.scriptureRefs) ? d.scriptureRefs : [],
            isLibrary: true,
          });
        });
        return out;
      };
      _libCache.quotes        = norm(qSnap, 'quote');
      _libCache.illustrations = norm(iSnap, 'illustration');
    } catch (e) {
      console.warn('[TheFeed] library load error:', e);
      _libCache.quotes = _libCache.quotes || [];
      _libCache.illustrations = _libCache.illustrations || [];
    } finally {
      _libCache.loadingPromise = null;
    }
    return _libCache;
  })();
  return _libCache.loadingPromise;
}

function _renderQuotes(body) {
  body.innerHTML = `
    <div class="bm-tool-section-h">Add a quote or illustration</div>
    <textarea class="bm-tool-input" id="bm-quote-text" rows="3"
              placeholder="Paste or type the quote, illustration, or story…"
              style="resize:vertical;min-height:72px;"></textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <input class="bm-tool-input" id="bm-quote-source" type="text"
             placeholder="Source (e.g., C.S. Lewis, Mere Christianity)"
             style="flex:2 1 220px;min-width:160px;">
      <input class="bm-tool-input" id="bm-quote-tag" type="text"
             placeholder="Tag (grace, hope…)"
             style="flex:1 1 140px;min-width:120px;">
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <button class="bm-btn bm-btn--primary bm-btn--sm" id="bm-quote-save">Save quote</button>
      <span style="color:var(--bm-faint);font:0.74rem 'Plus Jakarta Sans',sans-serif;">Saved here syncs only to this browser. Library is shared.</span>
    </div>
    <div class="bm-tool-section-h" style="margin-top:14px;display:flex;align-items:center;gap:8px;">
      <span>Library &amp; Saved (<span id="bm-quote-count">0</span>)</span>
      <span style="margin-left:auto;display:inline-flex;gap:4px;" id="bm-quote-tabs">
        <button class="bm-btn bm-btn--sm bm-quote-tab" data-tab="all"   aria-pressed="true">All</button>
        <button class="bm-btn bm-btn--sm bm-quote-tab" data-tab="mine"  aria-pressed="false">Mine</button>
        <button class="bm-btn bm-btn--sm bm-quote-tab" data-tab="quote" aria-pressed="false">Quotes</button>
        <button class="bm-btn bm-btn--sm bm-quote-tab" data-tab="illustration" aria-pressed="false">Illustrations</button>
      </span>
    </div>
    <input class="bm-tool-input" id="bm-quote-search" type="text" placeholder="Search library &amp; saved…">
    <div id="bm-quote-list" style="display:flex;flex-direction:column;gap:8px;"></div>
  `;
  body.dataset.tab = 'all';
  const txt    = body.querySelector('#bm-quote-text');
  const src    = body.querySelector('#bm-quote-source');
  const tag    = body.querySelector('#bm-quote-tag');
  const save   = body.querySelector('#bm-quote-save');
  const search = body.querySelector('#bm-quote-search');
  save.addEventListener('click', () => {
    const t = (txt.value || '').trim();
    if (!t) { txt.focus(); return; }
    const list = _quotesLoad();
    list.unshift({
      id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      text: t,
      source: (src.value || '').trim(),
      tag: (tag.value || '').trim(),
      createdAt: Date.now(),
    });
    _quotesSave(list);
    txt.value = ''; src.value = ''; tag.value = '';
    _quotesRender(body, search.value);
    if (typeof _toast === 'function') _toast('Quote saved.', 'success');
  });
  search.addEventListener('input', () => _quotesRender(body, search.value));
  body.querySelectorAll('.bm-quote-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      body.dataset.tab = btn.dataset.tab || 'all';
      body.querySelectorAll('.bm-quote-tab').forEach(b =>
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      _quotesRender(body, search.value);
    });
  });
  _quotesRender(body, '');
  // Kick off the async library load; re-render when ready.
  _loadLibrary().then(() => _quotesRender(body, body.querySelector('#bm-quote-search').value));
}

function _quotesRender(body, query) {
  const mine = _quotesLoad().map(it => ({
    id: it.id,
    kind: 'mine',
    text: it.text || '',
    source: it.source || '',
    author: '',
    title: '',
    passage: '',
    tags: it.tag ? [it.tag] : [],
    scriptureRefs: [],
    createdAt: it.createdAt || 0,
    isMine: true,
  }));
  const lib = _libCache;
  const libQuotes = (lib && Array.isArray(lib.quotes)) ? lib.quotes : [];
  const libIllus  = (lib && Array.isArray(lib.illustrations)) ? lib.illustrations : [];
  const tab = body.dataset.tab || 'all';
  let combined;
  if (tab === 'mine')         combined = mine;
  else if (tab === 'quote')   combined = [...mine, ...libQuotes];
  else if (tab === 'illustration') combined = libIllus;
  else                        combined = [...mine, ...libQuotes, ...libIllus];

  const target = body.querySelector('#bm-quote-list');
  const count  = body.querySelector('#bm-quote-count');
  if (count) count.textContent = String(combined.length);
  if (!combined.length) {
    const msg = (lib && lib.loadingPromise) ? 'Loading library…' :
      (tab === 'mine' ? 'No quotes saved yet. Add one above to start your library.' :
                       'No items to show.');
    target.innerHTML = `<div class="bm-tool-empty">${_e(msg)}</div>`;
    return;
  }
  const q = String(query || '').toLowerCase().trim();
  const matches = (it) => {
    if (!q) return true;
    return (it.text || '').toLowerCase().includes(q)
        || (it.source || '').toLowerCase().includes(q)
        || (it.author || '').toLowerCase().includes(q)
        || (it.title || '').toLowerCase().includes(q)
        || (it.passage || '').toLowerCase().includes(q)
        || (Array.isArray(it.tags) && it.tags.some(t => String(t).toLowerCase().includes(q)))
        || (Array.isArray(it.scriptureRefs) && it.scriptureRefs.some(r => String(r).toLowerCase().includes(q)));
  };
  const filtered = combined.filter(matches);
  if (!filtered.length) { target.innerHTML = `<div class="bm-tool-empty">No matches for "${_e(query)}".</div>`; return; }
  target.innerHTML = filtered.map(it => {
    const isMine = !!it.isMine;
    const badge = isMine ? '<span class="bm-quote-meta-tag" style="background:#e7f3ff;color:#1366c4;">Mine</span>'
      : (it.kind === 'illustration'
          ? '<span class="bm-quote-meta-tag" style="background:#fff2d6;color:#9a6800;">Illustration</span>'
          : '<span class="bm-quote-meta-tag" style="background:#eef7e8;color:#2d6a1c;">Library</span>');
    const headLine = it.title ? `<div style="font-weight:600;margin-bottom:4px;">${_e(it.title)}</div>` : '';
    const sourceLabel = it.source || it.author || it.passage || '';
    const tagBits = (Array.isArray(it.tags) ? it.tags : []).slice(0, 4)
      .map(t => `<span class="bm-quote-meta-tag">${_e(t)}</span>`).join('');
    return `
    <div class="bm-quote-card" data-id="${_e(it.id)}" data-kind="${_e(isMine ? 'mine' : it.kind)}">
      ${headLine}
      <div class="bm-quote-text">${_e(it.text)}</div>
      <div class="bm-quote-meta">
        ${sourceLabel ? `<span>— ${_e(sourceLabel)}</span>` : ''}
        ${tagBits}
        ${badge}
        ${isMine && it.createdAt ? `<span style="margin-left:auto;">${_e(_fmtAgo(it.createdAt))}</span>` : '<span style="margin-left:auto;"></span>'}
      </div>
      <div class="bm-quote-actions">
        <button class="bm-quote-copy" title="Copy">Copy</button>
        ${isMine
          ? '<button class="bm-quote-del" title="Delete">Delete</button>'
          : '<button class="bm-quote-savemine" title="Save to my list">Save to Mine</button>'}
      </div>
    </div>`;
  }).join('');
  target.querySelectorAll('.bm-quote-card').forEach(card => {
    const id   = card.dataset.id;
    const kind = card.dataset.kind;
    const find = () => {
      if (kind === 'mine') return mine.find(x => x.id === id);
      if (kind === 'illustration') return libIllus.find(x => x.id === id);
      return libQuotes.find(x => x.id === id);
    };
    const copyBtn = card.querySelector('.bm-quote-copy');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      const item = find(); if (!item) return;
      const tail = item.source || item.author || item.passage || '';
      const text = '"' + item.text + '"' + (tail ? '\n— ' + tail : '');
      try { navigator.clipboard.writeText(text); if (typeof _toast === 'function') _toast('Copied.', 'success'); } catch (_) {}
    });
    const delBtn = card.querySelector('.bm-quote-del');
    if (delBtn) delBtn.addEventListener('click', () => {
      const next = _quotesLoad().filter(x => x.id !== id);
      _quotesSave(next);
      _quotesRender(body, body.querySelector('#bm-quote-search').value);
    });
    const saveBtn = card.querySelector('.bm-quote-savemine');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      const item = find(); if (!item) return;
      const list = _quotesLoad();
      // De-dupe by source library id.
      if (list.some(x => x.fromLibraryId === id)) {
        if (typeof _toast === 'function') _toast('Already in your list.', 'info');
        return;
      }
      list.unshift({
        id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        fromLibraryId: id,
        text: item.text,
        source: item.source || item.author || item.passage || '',
        tag: (item.tags && item.tags[0]) || '',
        createdAt: Date.now(),
      });
      _quotesSave(list);
      if (typeof _toast === 'function') _toast('Saved to your list.', 'success');
      _quotesRender(body, body.querySelector('#bm-quote-search').value);
    });
  });
}

// ── Liturgical Calendar ───────────────────────────────────────────────────────
// Computus (Easter) — Anonymous Gregorian algorithm.
function _easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day   = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function _addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function _fmtLitDate(d) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function _liturgicalEvents(year) {
  // Fixed feasts
  const christmas = new Date(year, 11, 25);
  const epiphany  = new Date(year, 0, 6);
  // Advent: 4th Sunday before Christmas (always begins on a Sunday)
  let advent1 = new Date(year, 11, 25);
  advent1 = _addDays(advent1, -((advent1.getDay() + 21))); // back up to Sun-21d (4 sundays earlier or so)
  // Cleaner: walk back to the nearest Sunday before Dec 25, then back 3 more weeks
  const dow = new Date(year, 11, 25).getDay(); // 0=Sun
  const sundayBefore = _addDays(new Date(year, 11, 25), -(dow === 0 ? 7 : dow));
  advent1 = _addDays(sundayBefore, -21);

  const easter   = _easterDate(year);
  const ashWed   = _addDays(easter, -46);
  const palmSun  = _addDays(easter, -7);
  const goodFri  = _addDays(easter, -2);
  const ascension = _addDays(easter, 39);
  const pentecost = _addDays(easter, 49);
  const trinity   = _addDays(easter, 56);

  return [
    { date: epiphany,  name: 'Epiphany',                        season: 'Epiphany',   color: '#16a34a' },
    { date: ashWed,    name: 'Ash Wednesday',                   season: 'Lent',       color: '#7c3aed' },
    { date: palmSun,   name: 'Palm Sunday',                     season: 'Holy Week',  color: '#dc2626' },
    { date: goodFri,   name: 'Good Friday',                     season: 'Holy Week',  color: '#000000' },
    { date: easter,    name: 'Easter Sunday',                   season: 'Easter',     color: '#facc15' },
    { date: ascension, name: 'Ascension Day',                   season: 'Easter',     color: '#facc15' },
    { date: pentecost, name: 'Pentecost',                       season: 'Pentecost',  color: '#dc2626' },
    { date: trinity,   name: 'Trinity Sunday',                  season: 'Ordinary',   color: '#16a34a' },
    { date: advent1,   name: 'First Sunday of Advent',          season: 'Advent',     color: '#7c3aed' },
    { date: christmas, name: 'Christmas Day',                   season: 'Christmas',  color: '#facc15' },
  ];
}

function _currentSeason(today) {
  const y = today.getFullYear();
  const events = _liturgicalEvents(y).concat(_liturgicalEvents(y - 1)).concat(_liturgicalEvents(y + 1));
  // Season boundaries (start dates)
  const e  = (n, yr) => events.find(x => x.name === n && x.date.getFullYear() === yr);
  const seasons = [];
  for (const yr of [y - 1, y, y + 1]) {
    const ev = _liturgicalEvents(yr);
    const adv = ev.find(x => x.name === 'First Sunday of Advent').date;
    const xmas = ev.find(x => x.name === 'Christmas Day').date;
    const epi = ev.find(x => x.name === 'Epiphany').date;
    const ash = ev.find(x => x.name === 'Ash Wednesday').date;
    const palm = ev.find(x => x.name === 'Palm Sunday').date;
    const east = ev.find(x => x.name === 'Easter Sunday').date;
    const pent = ev.find(x => x.name === 'Pentecost').date;
    seasons.push({ name: 'Advent',     start: adv,                          color: '#7c3aed' });
    seasons.push({ name: 'Christmas',  start: xmas,                         color: '#facc15' });
    seasons.push({ name: 'Epiphany',   start: epi,                          color: '#16a34a' });
    seasons.push({ name: 'Ordinary Time', start: _addDays(epi, 1),         color: '#16a34a' });
    seasons.push({ name: 'Lent',       start: ash,                          color: '#7c3aed' });
    seasons.push({ name: 'Holy Week',  start: palm,                         color: '#dc2626' });
    seasons.push({ name: 'Easter',     start: east,                         color: '#facc15' });
    seasons.push({ name: 'Pentecost',  start: pent,                         color: '#dc2626' });
    seasons.push({ name: 'Ordinary Time', start: _addDays(pent, 1),        color: '#16a34a' });
  }
  seasons.sort((a, b) => a.start - b.start);
  let current = seasons[0];
  for (const s of seasons) { if (s.start <= today) current = s; else break; }
  return current;
}

function _renderLiturgical(body) {
  const today = new Date(); today.setHours(0,0,0,0);
  const year = today.getFullYear();
  const cur = _currentSeason(today);
  // Build event list across this year and next, show all upcoming + recent past
  const events = _liturgicalEvents(year).concat(_liturgicalEvents(year + 1));
  events.sort((a, b) => a.date - b.date);
  const trimmed = events.filter(ev => {
    const diff = (ev.date - today) / (1000 * 60 * 60 * 24);
    return diff >= -7 && diff <= 400;
  });
  body.innerHTML = `
    <div class="bm-litu-now">
      <div class="bm-litu-now-season">${_e(cur.name)}</div>
      <div class="bm-litu-now-meta">Current liturgical season · ${_e(today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}</div>
    </div>
    <div class="bm-tool-section-h" style="margin-top:8px;">Upcoming feasts &amp; holy days</div>
    <div>
      ${trimmed.map(ev => {
        const isPast = ev.date < today;
        const sameDay = ev.date.toDateString() === today.toDateString();
        const cls = sameDay ? 'is-now' : (isPast ? 'is-past' : '');
        return `
          <div class="bm-litu-row ${cls}">
            <div class="bm-litu-date">${_e(_fmtLitDate(ev.date))}, ${ev.date.getFullYear()}</div>
            <div class="bm-litu-name">${_e(ev.name)}</div>
            <div class="bm-litu-color" style="--c:${ev.color};${ev.color === '#000000' ? 'color:#fff;' : ''}">${_e(ev.season)}</div>
          </div>
        `;
      }).join('')}
    </div>
    <div class="bm-tool-section-h" style="margin-top:14px;">Color guide</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      <span class="bm-litu-color" style="--c:#7c3aed;">Purple · Advent / Lent</span>
      <span class="bm-litu-color" style="--c:#facc15;color:#1b264f;">Gold/White · Christmas / Easter</span>
      <span class="bm-litu-color" style="--c:#dc2626;">Red · Pentecost / Holy Week</span>
      <span class="bm-litu-color" style="--c:#16a34a;">Green · Ordinary Time</span>
    </div>
  `;
}


// ─────────────────────────────────────────────────────────────
// APOLOGETICS — common objections, biblical/historical answers
// ─────────────────────────────────────────────────────────────
const BM_APOLOGETICS = [
  // ───── EXISTENCE OF GOD ─────
  { cat: 'Existence of God', q: 'Does God exist?',
    a: 'Yes — and the evidence is layered. The universe had a beginning (Kalam cosmological argument), it is finely tuned for life (teleological), it is intelligible to the human mind (a sign of mind behind matter), and humans share an intuition of objective moral law (moral argument). Each line of evidence is consistent with the God revealed in Scripture: eternal, powerful, personal, and good.',
    v: [
      ['Romans 1:19-20', 'What can be known about God is plain to them, because God has shown it to them. For his invisible attributes, namely, his eternal power and divine nature, have been clearly perceived ever since the creation of the world.'],
      ['Psalm 19:1', 'The heavens declare the glory of God, and the sky above proclaims his handiwork.'],
      ['Hebrews 11:6', 'Without faith it is impossible to please him, for whoever would draw near to God must believe that he exists and that he rewards those who seek him.'],
    ]
  },
  { cat: 'Existence of God', q: 'If God made everything, who made God?',
    a: 'The argument is not "everything has a cause" but "everything that begins to exist has a cause." God is, by definition, the eternal, uncaused First Cause — not a being inside the universe but the Being on whom the universe depends. Asking "who made God?" is like asking "what is north of the North Pole?" — a category error.',
    v: [
      ['Psalm 90:2', 'Before the mountains were brought forth, or ever you had formed the earth and the world, from everlasting to everlasting you are God.'],
      ['Isaiah 40:28', 'The LORD is the everlasting God, the Creator of the ends of the earth. He does not faint or grow weary; his understanding is unsearchable.'],
      ['Revelation 1:8', 'I am the Alpha and the Omega, says the Lord God, who is and who was and who is to come, the Almighty.'],
    ]
  },
  { cat: 'Existence of God', q: 'Why does God hide Himself?',
    a: 'God is not hidden — He has revealed Himself in creation, in conscience, in Scripture, and supremely in the person of Jesus Christ. What looks like hiddenness is often human suppression of what we already know (Rom 1) or God\u2019s mercy giving time for repentance. He promises to be found by all who seek Him with their whole heart.',
    v: [
      ['Jeremiah 29:13', 'You will seek me and find me, when you seek me with all your heart.'],
      ['John 1:18', 'No one has ever seen God; the only God, who is at the Father\u2019s side, he has made him known.'],
      ['Acts 17:27', 'That they should seek God, in the hope that they might feel their way toward him and find him. Yet he is actually not far from each one of us.'],
    ]
  },

  // ───── PROBLEM OF EVIL ─────
  { cat: 'Problem of Evil', q: 'If God is good and powerful, why is there evil and suffering?',
    a: 'The Bible never minimizes evil — it confronts it. Evil entered the world through the rebellion of free creatures (Gen 3), not by God\u2019s design. God permits evil for a season but is not its author, and He is bringing it to a final reckoning. The cross is the deepest answer: God Himself entered our suffering and conquered it through resurrection. We may not always know the "why," but we know the "Who."',
    v: [
      ['Genesis 50:20', 'As for you, you meant evil against me, but God meant it for good, to bring it about that many people should be kept alive.'],
      ['Romans 8:28', 'And we know that for those who love God all things work together for good, for those who are called according to his purpose.'],
      ['Revelation 21:4', 'He will wipe away every tear from their eyes, and death shall be no more, neither shall there be mourning, nor crying, nor pain anymore, for the former things have passed away.'],
    ]
  },
  { cat: 'Problem of Evil', q: 'How can a loving God send anyone to hell?',
    a: 'God does not "send" people to hell arbitrarily. Hell is the just consequence of persistent rejection of the One who is life itself. God lovingly pursues sinners, sent His Son to die for them, and pleads with them to be reconciled. To refuse Him is to choose separation. As C.S. Lewis put it, "The doors of hell are locked on the inside."',
    v: [
      ['2 Peter 3:9', 'The Lord is not slow to fulfill his promise as some count slowness, but is patient toward you, not wishing that any should perish, but that all should reach repentance.'],
      ['Ezekiel 33:11', 'As I live, declares the Lord GOD, I have no pleasure in the death of the wicked, but that the wicked turn from his way and live.'],
      ['John 3:36', 'Whoever believes in the Son has eternal life; whoever does not obey the Son shall not see life, but the wrath of God remains on him.'],
    ]
  },
  { cat: 'Problem of Evil', q: 'Why does God allow natural disasters?',
    a: 'The Bible teaches that creation itself groans under the curse of human sin (Rom 8). Earthquakes, storms, and disease are not signs that God has lost control — they are signs that the world is not what it was made to be, and a foretaste of why it must be remade. God still rules over every storm (Ps 107) and uses creation\u2019s instability to call us back to the Creator.',
    v: [
      ['Romans 8:20-22', 'For the creation was subjected to futility... in hope that the creation itself will be set free from its bondage to corruption... For we know that the whole creation has been groaning together in the pains of childbirth until now.'],
      ['Psalm 46:1-3', 'God is our refuge and strength, a very present help in trouble. Therefore we will not fear though the earth gives way...'],
      ['Luke 13:4-5', 'Those eighteen on whom the tower in Siloam fell... do you think that they were worse offenders than all the others...? No, I tell you; but unless you repent, you will all likewise perish.'],
    ]
  },

  // ───── BIBLE & HISTORY ─────
  { cat: 'The Bible', q: 'Can we trust the Bible historically?',
    a: 'The New Testament is the best-attested document of antiquity — over 5,800 Greek manuscripts, with the earliest fragments within a generation of the originals. Archaeology repeatedly confirms biblical persons, places, and customs (the Pilate inscription, the pool of Bethesda, Hezekiah\u2019s tunnel, etc.). The Gospels were written within the lifetime of eyewitnesses who would have refuted falsehood.',
    v: [
      ['Luke 1:1-4', 'Inasmuch as many have undertaken to compile a narrative of the things that have been accomplished among us, just as those who from the beginning were eyewitnesses... it seemed good to me also... to write an orderly account... that you may have certainty concerning the things you have been taught.'],
      ['2 Peter 1:16', 'For we did not follow cleverly devised myths when we made known to you the power and coming of our Lord Jesus Christ, but we were eyewitnesses of his majesty.'],
      ['1 John 1:1', 'That which was from the beginning, which we have heard, which we have seen with our eyes, which we looked upon and have touched with our hands, concerning the word of life...'],
    ]
  },
  { cat: 'The Bible', q: 'Hasn\u2019t the Bible been changed and corrupted over time?',
    a: 'No. The manuscript tradition is so vast that variants can be tracked precisely. Of approximately 400,000 textual variants, fewer than 1% affect meaning, and none affects any core Christian doctrine. The Dead Sea Scrolls (c. 100 BC) showed that the Hebrew Old Testament was preserved with stunning accuracy over a thousand years. We can read essentially what the apostles and prophets wrote.',
    v: [
      ['Isaiah 40:8', 'The grass withers, the flower fades, but the word of our God will stand forever.'],
      ['Matthew 5:18', 'For truly, I say to you, until heaven and earth pass away, not an iota, not a dot, will pass from the Law until all is accomplished.'],
      ['1 Peter 1:25', 'But the word of the Lord remains forever. And this word is the good news that was preached to you.'],
    ]
  },
  { cat: 'The Bible', q: 'Aren\u2019t there contradictions in the Bible?',
    a: 'Apparent contradictions usually dissolve under careful reading: different perspectives on the same event (like four Gospel accounts), different time frames, summary versus detail, or genre (poetry vs. narrative). The Bible was written by ~40 authors across 1,500 years, three continents, and three languages — and yet tells one coherent story of redemption centered on Christ. That unity is itself remarkable evidence of inspiration.',
    v: [
      ['2 Timothy 3:16-17', 'All Scripture is breathed out by God and profitable for teaching, for reproof, for correction, and for training in righteousness, that the man of God may be complete, equipped for every good work.'],
      ['2 Peter 1:20-21', 'No prophecy of Scripture comes from someone\u2019s own interpretation. For no prophecy was ever produced by the will of man, but men spoke from God as they were carried along by the Holy Spirit.'],
      ['Psalm 119:160', 'The sum of your word is truth, and every one of your righteous rules endures forever.'],
    ]
  },

  // ───── JESUS CHRIST ─────
  { cat: 'Jesus Christ', q: 'Did Jesus really exist?',
    a: 'Yes — and not just in Christian sources. Roman historians Tacitus and Suetonius, Jewish historian Josephus, and the Jewish Talmud all reference Jesus of Nazareth. The historical existence of Jesus is one of the most well-attested facts of antiquity. The real question isn\u2019t whether He existed, but who He is.',
    v: [
      ['John 1:14', 'And the Word became flesh and dwelt among us, and we have seen his glory, glory as of the only Son from the Father, full of grace and truth.'],
      ['1 Timothy 3:16', 'Great indeed, we confess, is the mystery of godliness: He was manifested in the flesh, vindicated by the Spirit, seen by angels, proclaimed among the nations, believed on in the world, taken up in glory.'],
      ['Galatians 4:4', 'But when the fullness of time had come, God sent forth his Son, born of woman, born under the law.'],
    ]
  },
  { cat: 'Jesus Christ', q: 'Is Jesus really God, or just a great teacher?',
    a: 'Jesus claimed authority belonging only to God: forgiving sins (Mark 2), receiving worship (Matt 14), claiming preexistence (John 8:58 — "before Abraham was, I AM"), and accepting Thomas\u2019s confession "My Lord and my God!" (John 20:28). C.S. Lewis\u2019s trilemma stands: He is either Lord, liar, or lunatic — but the moral grandeur and resurrection rule out the latter two.',
    v: [
      ['John 1:1', 'In the beginning was the Word, and the Word was with God, and the Word was God.'],
      ['Colossians 2:9', 'For in him the whole fullness of deity dwells bodily.'],
      ['John 10:30', 'I and the Father are one.'],
    ]
  },
  { cat: 'Jesus Christ', q: 'Did Jesus rise from the dead?',
    a: 'The minimal facts agreed on by virtually all critical scholars: (1) Jesus was crucified and buried, (2) the tomb was found empty, (3) numerous individuals and groups claimed to see Him alive, (4) the disciples were transformed from terrified deserters into bold martyrs, (5) the church exploded in Jerusalem — the very city where the body could be produced. The best explanation: He really rose.',
    v: [
      ['1 Corinthians 15:3-6', 'Christ died for our sins in accordance with the Scriptures, that he was buried, that he was raised on the third day in accordance with the Scriptures, and that he appeared to Cephas, then to the twelve. Then he appeared to more than five hundred brothers at one time, most of whom are still alive.'],
      ['Romans 1:4', 'Declared to be the Son of God in power according to the Spirit of holiness by his resurrection from the dead, Jesus Christ our Lord.'],
      ['Acts 2:32', 'This Jesus God raised up, and of that we all are witnesses.'],
    ]
  },

  // ───── SCIENCE & FAITH ─────
  { cat: 'Science & Faith', q: 'Hasn\u2019t science disproved God?',
    a: 'No — science describes how the natural world functions; it cannot, by its method, address whether there is anything beyond the natural. Most founders of modern science (Newton, Kepler, Boyle, Faraday, Maxwell) were devout believers who saw their work as "thinking God\u2019s thoughts after Him." The orderliness of the universe — the very thing that makes science possible — is precisely what biblical theism predicts.',
    v: [
      ['Genesis 1:1', 'In the beginning, God created the heavens and the earth.'],
      ['Colossians 1:16-17', 'For by him all things were created, in heaven and on earth, visible and invisible... all things were created through him and for him. And he is before all things, and in him all things hold together.'],
      ['Psalm 111:2', 'Great are the works of the LORD, studied by all who delight in them.'],
    ]
  },
  { cat: 'Science & Faith', q: 'What about evolution and Genesis?',
    a: 'Faithful Christians hold a range of views — young-earth creation, old-earth creation, theistic evolution — but all affirm: God created, humanity is made in His image, and the Fall is real. The Bible is not a science textbook but God\u2019s truthful self-revelation. Where Scripture and a scientific claim seem to conflict, we hold Scripture firmly and our interpretation of both humbly.',
    v: [
      ['Genesis 1:27', 'So God created man in his own image, in the image of God he created him; male and female he created them.'],
      ['Hebrews 11:3', 'By faith we understand that the universe was created by the word of God, so that what is seen was not made out of things that are visible.'],
      ['Job 38:4', 'Where were you when I laid the foundation of the earth? Tell me, if you have understanding.'],
    ]
  },

  // ───── MORALITY & TRUTH ─────
  { cat: 'Morality & Truth', q: 'Can\u2019t you be moral without God?',
    a: 'Of course people without faith can act morally — the question is whether morality has any binding force without God. If there is no Lawgiver, "morality" reduces to opinion or social contract. Concepts like human dignity, justice, and inalienable rights make sense only if humans are made in the image of a good God. Atheism can borrow moral capital from Christianity, but it cannot generate it.',
    v: [
      ['Romans 2:14-15', 'For when Gentiles, who do not have the law, by nature do what the law requires... they show that the work of the law is written on their hearts.'],
      ['Micah 6:8', 'He has told you, O man, what is good; and what does the LORD require of you but to do justice, and to love kindness, and to walk humbly with your God?'],
      ['James 4:12', 'There is only one lawgiver and judge, he who is able to save and to destroy. But who are you to judge your neighbor?'],
    ]
  },
  { cat: 'Morality & Truth', q: 'Isn\u2019t truth relative? Who are you to say Christianity is the only way?',
    a: 'The claim "all truth is relative" is itself an absolute claim — it self-destructs. Jesus did not present Himself as one path among many; He claimed to be the path (John 14:6). The exclusivity is not Christian arrogance but the nature of reality: if Christ truly rose from the dead, His claims must be reckoned with. Christianity is exclusive in truth and inclusive in invitation — "whosoever will may come."',
    v: [
      ['John 14:6', 'I am the way, and the truth, and the life. No one comes to the Father except through me.'],
      ['Acts 4:12', 'There is salvation in no one else, for there is no other name under heaven given among men by which we must be saved.'],
      ['Revelation 22:17', 'The Spirit and the Bride say, "Come." And let the one who hears say, "Come." And let the one who is thirsty come; let the one who desires take the water of life without price.'],
    ]
  },

  // ───── OTHER RELIGIONS ─────
  { cat: 'Other Religions', q: 'Aren\u2019t all religions basically the same?',
    a: 'They are similar in some ethics (be kind, don\u2019t lie, etc.) but radically different in their core claims about God, humanity, salvation, and eternity. Hinduism: many gods or impersonal Brahman; Buddhism: no Creator, escape suffering through detachment; Islam: one God, salvation by works and submission; Christianity: one God in three persons, salvation by grace through a crucified and risen Savior. These cannot all be true.',
    v: [
      ['Isaiah 45:5-6', 'I am the LORD, and there is no other, besides me there is no God... that people may know, from the rising of the sun and from the west, that there is none besides me.'],
      ['1 Corinthians 8:6', 'Yet for us there is one God, the Father, from whom are all things and for whom we exist, and one Lord, Jesus Christ, through whom are all things and through whom we exist.'],
      ['Ephesians 2:8-9', 'For by grace you have been saved through faith. And this is not your own doing; it is the gift of God, not a result of works, so that no one may boast.'],
    ]
  },
  { cat: 'Other Religions', q: 'What about people who never heard of Jesus?',
    a: 'God is perfectly just (Gen 18:25) and perfectly good. He judges everyone according to the light they had — through creation, conscience, and Scripture (Rom 1-2). No one will be condemned unjustly. But the Bible never treats this as an excuse for our inaction; instead, it fuels missions: how shall they hear without a preacher? (Rom 10:14). The unreached are God\u2019s concern — and ours.',
    v: [
      ['Romans 1:20', 'For his invisible attributes, namely, his eternal power and divine nature, have been clearly perceived... So they are without excuse.'],
      ['Romans 10:14', 'How then will they call on him in whom they have not believed? And how are they to believe in him of whom they have never heard?'],
      ['Acts 17:30-31', 'The times of ignorance God overlooked, but now he commands all people everywhere to repent, because he has fixed a day on which he will judge the world in righteousness by a man whom he has appointed.'],
    ]
  },

  // ───── MIRACLES ─────
  { cat: 'Miracles', q: 'Can a thinking person believe in miracles?',
    a: 'Only if you assume in advance that miracles cannot happen will the evidence for them seem weak. If God exists, miracles are entirely possible — the universe itself is the biggest one. The question is not whether miracles are possible but whether the evidence in a particular case warrants belief. The resurrection of Jesus has the strongest historical evidence of any miracle claim in human history.',
    v: [
      ['Jeremiah 32:17', 'Ah, Lord GOD! It is you who have made the heavens and the earth by your great power and by your outstretched arm! Nothing is too hard for you.'],
      ['Luke 1:37', 'For nothing will be impossible with God.'],
      ['John 20:30-31', 'Now Jesus did many other signs in the presence of the disciples, which are not written in this book; but these are written so that you may believe that Jesus is the Christ, the Son of God.'],
    ]
  },
];

function _renderApologetics(body) {
  // group by category
  const cats = {};
  BM_APOLOGETICS.forEach((item, i) => {
    if (!cats[item.cat]) cats[item.cat] = [];
    cats[item.cat].push({ ...item, _i: i });
  });
  const catNames = Object.keys(cats);
  body.innerHTML = `
    <input type="text" class="bm-tool-input" id="bm-apol-search" placeholder="Search objections, topics, or keywords…">
    <div id="bm-apol-list" style="display:flex;flex-direction:column;gap:14px;"></div>
  `;
  const list = _qs('bm-apol-list');
  function paint(query) {
    const q = (query || '').trim().toLowerCase();
    let html = '';
    catNames.forEach(cat => {
      const items = cats[cat].filter(it => {
        if (!q) return true;
        return (it.q + ' ' + it.a + ' ' + it.cat).toLowerCase().includes(q)
          || it.v.some(([ref, txt]) => (ref + ' ' + txt).toLowerCase().includes(q));
      });
      if (!items.length) return;
      html += `<div><div class="bm-apol-cat">${_e(cat)}</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;">`;
      items.forEach(it => {
        const versesHtml = it.v.map(([ref, txt]) => `
          <div class="bm-apol-verse">
            <strong>${_e(ref)}</strong>
            <span>${_e(txt)}</span>
            <a href="${_bibleGatewayUrl(ref)}" target="_blank" rel="noopener">Open on BibleGateway →</a>
          </div>`).join('');
        html += `
          <div class="bm-apol-card" data-idx="${it._i}">
            <button type="button" class="bm-apol-q" data-toggle="${it._i}">
              <span>${_e(it.q)}</span>
              <span class="bm-apol-chev">›</span>
            </button>
            <div class="bm-apol-body">
              <div class="bm-apol-section">Answer</div>
              <div class="bm-apol-answer">${_e(it.a)}</div>
              <div class="bm-apol-section">Scripture</div>
              <div class="bm-apol-verses">${versesHtml}</div>
            </div>
          </div>`;
      });
      html += `</div></div>`;
    });
    if (!html) html = `<div class="bm-tool-empty">No matching objections.</div>`;
    list.innerHTML = html;
  }
  paint('');
  _qs('bm-apol-search').addEventListener('input', e => paint(e.target.value));
  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;
    const card = btn.closest('.bm-apol-card');
    if (card) card.classList.toggle('is-open');
  });
}

// ─────────────────────────────────────────────────────────────
// BIBLICAL COUNSELING — situations, Scripture, pastoral counsel
// ─────────────────────────────────────────────────────────────
const BM_COUNSELING = [
  // ── ANXIETY / FEAR ──
  { cat: 'Anxiety & Fear', q: 'Anxiety, worry, panic',
    a: 'Anxiety is the soul stretched between the present and an imagined future. Scripture does not shame the anxious — it invites them to bring every worry to the Father. Practice three things: (1) Name the fear specifically. (2) Cast it on God in honest prayer (1 Pet 5:7). (3) Replace rumination with thanksgiving and Scripture. Anxiety often fades not when circumstances change but when the soul rests in God\u2019s sovereign goodness.',
    v: [
      ['Philippians 4:6-7', 'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.'],
      ['1 Peter 5:6-7', 'Humble yourselves, therefore, under the mighty hand of God so that at the proper time he may exalt you, casting all your anxieties on him, because he cares for you.'],
      ['Matthew 6:34', 'Therefore do not be anxious about tomorrow, for tomorrow will be anxious for itself. Sufficient for the day is its own trouble.'],
      ['Isaiah 41:10', 'Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you, I will uphold you with my righteous right hand.'],
    ]
  },
  { cat: 'Anxiety & Fear', q: 'Fear of the future / making decisions',
    a: 'Fear of the future often hides a desire for control. The cure is not certainty about tomorrow but trust in the God who holds it. Make decisions prayerfully (James 1:5), in counsel (Prov 15:22), in line with Scripture, and then act — trusting God to redirect if needed (Prov 16:9). A closed door is not a failure; it is His guidance.',
    v: [
      ['Proverbs 3:5-6', 'Trust in the LORD with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths.'],
      ['Jeremiah 29:11', 'For I know the plans I have for you, declares the LORD, plans for welfare and not for evil, to give you a future and a hope.'],
      ['James 1:5', 'If any of you lacks wisdom, let him ask God, who gives generously to all without reproach, and it will be given him.'],
    ]
  },

  // ── DEPRESSION / DISCOURAGEMENT ──
  { cat: 'Depression & Discouragement', q: 'Depression, hopelessness, despair',
    a: 'Depression is real and complex — sometimes physical, sometimes circumstantial, sometimes spiritual, often all three. Take it seriously: care for the body (sleep, food, sunlight, exercise), pursue medical help when needed, and tend the soul. Read the Psalms aloud — they give voice to the very griefs you may be feeling. You are not alone; even Elijah, David, and Spurgeon walked this valley. Christ does not despise the bruised reed.',
    v: [
      ['Psalm 42:5', 'Why are you cast down, O my soul, and why are you in turmoil within me? Hope in God; for I shall again praise him, my salvation and my God.'],
      ['Psalm 34:18', 'The LORD is near to the brokenhearted and saves the crushed in spirit.'],
      ['Isaiah 42:3', 'A bruised reed he will not break, and a faintly burning wick he will not quench.'],
      ['2 Corinthians 4:8-9', 'We are afflicted in every way, but not crushed; perplexed, but not driven to despair; persecuted, but not forsaken; struck down, but not destroyed.'],
    ]
  },
  { cat: 'Depression & Discouragement', q: 'Suicidal thoughts',
    a: 'If you or someone you love is in immediate danger, please call emergency services or a suicide hotline now. Then remember: your life is not your own — you were bought with a price (1 Cor 6:19-20). The enemy lies that the world would be better without you; God says you were knit together by Him for purpose (Ps 139). Reach out to a trusted pastor or counselor today. Hope is not extinguished — it is sometimes carried by others until you can carry it again.',
    v: [
      ['Psalm 139:13-14', 'For you formed my inward parts; you knitted me together in my mother\u2019s womb. I praise you, for I am fearfully and wonderfully made.'],
      ['Lamentations 3:21-23', 'But this I call to mind, and therefore I have hope: The steadfast love of the LORD never ceases; his mercies never come to an end; they are new every morning; great is your faithfulness.'],
      ['John 10:10', 'The thief comes only to steal and kill and destroy. I came that they may have life and have it abundantly.'],
    ]
  },

  // ── GRIEF & LOSS ──
  { cat: 'Grief & Loss', q: 'Loss of a loved one',
    a: 'Grief is the price of love — and Jesus Himself wept at a friend\u2019s grave (John 11:35). Do not rush yourself or others through it. Weep, remember, give thanks. Christians grieve, but not as those without hope: death is real, but it is not the end. The same Christ who raised Lazarus has conquered the grave and will raise all who are His.',
    v: [
      ['1 Thessalonians 4:13-14', 'We do not want you to be uninformed, brothers, about those who are asleep, that you may not grieve as others do who have no hope. For since we believe that Jesus died and rose again, even so, through Jesus, God will bring with him those who have fallen asleep.'],
      ['Psalm 116:15', 'Precious in the sight of the LORD is the death of his saints.'],
      ['Revelation 21:4', 'He will wipe away every tear from their eyes, and death shall be no more, neither shall there be mourning, nor crying, nor pain anymore.'],
      ['John 11:25-26', 'I am the resurrection and the life. Whoever believes in me, though he die, yet shall he live, and everyone who lives and believes in me shall never die.'],
    ]
  },
  { cat: 'Grief & Loss', q: 'Miscarriage or loss of a child',
    a: 'There are no easy words for this grief. Know that your child was known, loved, and counted by God before you ever knew them (Ps 139:13-16). David\u2019s words after losing his infant son comfort us still: "I shall go to him, but he will not return to me" (2 Sam 12:23) — a quiet hope that little ones are safe with Him. Your tears are not weakness; they are love with nowhere else to go.',
    v: [
      ['2 Samuel 12:23', 'But now he is dead. Why should I fast? Can I bring him back again? I shall go to him, but he will not return to me.'],
      ['Matthew 19:14', 'Let the little children come to me and do not hinder them, for to such belongs the kingdom of heaven.'],
      ['Psalm 34:18', 'The LORD is near to the brokenhearted and saves the crushed in spirit.'],
    ]
  },

  // ── MARRIAGE ──
  { cat: 'Marriage', q: 'Marriage struggles, conflict, distance',
    a: 'Every marriage is two sinners covenanted together — conflict is normal, contempt is corrosive. Re-anchor on the gospel: husband and wife reflect Christ and the church (Eph 5). Practice the slow disciplines: listen before answering (Jas 1:19), confess specifically and ask forgiveness, pray together daily (even one minute), and seek a wise pastor or biblical counselor early — not as a last resort.',
    v: [
      ['Ephesians 5:25', 'Husbands, love your wives, as Christ loved the church and gave himself up for her.'],
      ['Ephesians 4:32', 'Be kind to one another, tenderhearted, forgiving one another, as God in Christ forgave you.'],
      ['1 Corinthians 13:4-7', 'Love is patient and kind; love does not envy or boast; it is not arrogant or rude. It does not insist on its own way; it is not irritable or resentful... Love bears all things, believes all things, hopes all things, endures all things.'],
      ['Colossians 3:13', 'Bearing with one another and, if one has a complaint against another, forgiving each other; as the Lord has forgiven you, so you also must forgive.'],
    ]
  },
  { cat: 'Marriage', q: 'Adultery / unfaithfulness in marriage',
    a: 'Adultery is a grievous sin — but not unforgivable. For the betrayed: your pain is heard by God, and you have biblical grounds for divorce, though reconciliation is also possible by grace. For the unfaithful: confess fully, end all contact with the third party, accept accountability, and pursue long, patient repentance. Both spouses need a pastor and skilled counsel. Healing is slow but possible — many marriages have come back stronger.',
    v: [
      ['Hebrews 13:4', 'Let marriage be held in honor among all, and let the marriage bed be undefiled, for God will judge the sexually immoral and adulterous.'],
      ['Hosea 3:1', 'Go again, love a woman who is loved by another man and is an adulteress, even as the LORD loves the children of Israel, though they turn to other gods.'],
      ['1 John 1:9', 'If we confess our sins, he is faithful and just to forgive us our sins and to cleanse us from all unrighteousness.'],
    ]
  },

  // ── PARENTING ──
  { cat: 'Parenting', q: 'Wayward / prodigal child',
    a: 'A wayward child is one of the deepest griefs a parent can know. Remember: your child\u2019s salvation is ultimately God\u2019s work, not your performance. Repent of any harshness or hypocrisy you can see; keep the door open without endorsing the sin; pray ceaselessly. Like the father in Luke 15, watch the road. Many prodigals have come home — sometimes after years.',
    v: [
      ['Luke 15:20', 'And he arose and came to his father. But while he was still a long way off, his father saw him and felt compassion, and ran and embraced him and kissed him.'],
      ['Proverbs 22:6', 'Train up a child in the way he should go; even when he is old he will not depart from it.'],
      ['Isaiah 49:25', 'I will contend with those who contend with you, and I will save your children.'],
    ]
  },
  { cat: 'Parenting', q: 'Discipline, frustration, feeling overwhelmed',
    a: 'Parenting exposes our sin faster than almost anything else — that is grace, not failure. Discipline (in the biblical sense) is not punishment but training, always rooted in love (Heb 12:6). Beware exasperating your children (Eph 6:4); ask forgiveness when you sin against them. The goal is not perfect kids but pointing them to a perfect Savior. Rest is not optional — even Jesus withdrew.',
    v: [
      ['Ephesians 6:4', 'Fathers, do not provoke your children to anger, but bring them up in the discipline and instruction of the Lord.'],
      ['Deuteronomy 6:6-7', 'These words that I command you today shall be on your heart. You shall teach them diligently to your children, and shall talk of them when you sit in your house, and when you walk by the way.'],
      ['Psalm 127:3', 'Behold, children are a heritage from the LORD, the fruit of the womb a reward.'],
    ]
  },

  // ── ANGER ──
  { cat: 'Anger', q: 'Anger, bitterness, resentment',
    a: 'Anger itself is not always sin — God Himself is angry at evil — but unrighteous anger destroys (Jas 1:20). Trace your anger to its root: usually a thwarted desire or wounded pride. Confess it specifically, forgive as you have been forgiven, and "do not let the sun go down on your anger" (Eph 4:26). Bitterness is anger that has put down roots; pull it up early.',
    v: [
      ['Ephesians 4:26-27', 'Be angry and do not sin; do not let the sun go down on your anger, and give no opportunity to the devil.'],
      ['James 1:19-20', 'Let every person be quick to hear, slow to speak, slow to anger; for the anger of man does not produce the righteousness of God.'],
      ['Hebrews 12:15', 'See to it that no one fails to obtain the grace of God; that no "root of bitterness" springs up and causes trouble, and by it many become defiled.'],
      ['Proverbs 15:1', 'A soft answer turns away wrath, but a harsh word stirs up anger.'],
    ]
  },

  // ── ADDICTION ──
  { cat: 'Addiction', q: 'Addiction (alcohol, drugs, pornography, gambling)',
    a: 'Addiction is sin enslaving the body, but it is also a disorder of worship — looking to a created thing for what only God can give. Freedom requires honesty, accountability, and the Spirit\u2019s power. Confess to God and to a trusted brother/sister (Jas 5:16). Cut off access — block, delete, change routes. Pursue Christian recovery groups. Replace the false comfort with real ones: prayer, Word, fellowship, service. Relapse is real but not final.',
    v: [
      ['1 Corinthians 6:12', 'All things are lawful for me, but not all things are helpful. All things are lawful for me, but I will not be enslaved by anything.'],
      ['1 Corinthians 10:13', 'No temptation has overtaken you that is not common to man. God is faithful, and he will not let you be tempted beyond your ability, but with the temptation he will also provide the way of escape.'],
      ['James 5:16', 'Confess your sins to one another and pray for one another, that you may be healed. The prayer of a righteous person has great power.'],
      ['Galatians 5:1', 'For freedom Christ has set us free; stand firm therefore, and do not submit again to a yoke of slavery.'],
    ]
  },

  // ── SEXUAL SIN ──
  { cat: 'Sexual Sin', q: 'Lust, pornography, sexual immorality',
    a: 'Sexual sin is serious — Paul says to flee it (1 Cor 6:18), not negotiate. Yet in Christ there is full forgiveness and real freedom. Get specific accountability today (not someday). Remove access. Deal with the deeper hungers — loneliness, escape, identity — by feeding on Christ. Marriage, where applicable, is part of God\u2019s good provision (1 Cor 7:2). You are not your sin; you are God\u2019s child.',
    v: [
      ['1 Corinthians 6:18-20', 'Flee from sexual immorality. Every other sin a person commits is outside the body, but the sexually immoral person sins against his own body... You are not your own, for you were bought with a price. So glorify God in your body.'],
      ['Matthew 5:28', 'But I say to you that everyone who looks at a woman with lustful intent has already committed adultery with her in his heart.'],
      ['1 Thessalonians 4:3-5', 'For this is the will of God, your sanctification: that you abstain from sexual immorality; that each one of you know how to control his own body in holiness and honor.'],
      ['Romans 6:14', 'For sin will have no dominion over you, since you are not under law but under grace.'],
    ]
  },

  // ── GUILT & SHAME ──
  { cat: 'Guilt & Shame', q: 'Guilt over past sin / cannot forgive yourself',
    a: '"Forgiving yourself" can be unhelpful framing — what you actually need is to receive the forgiveness God has already given. If you have repented and trusted Christ, your sin is gone (Ps 103:12), the record is nailed to the cross (Col 2:14), and there is no condemnation (Rom 8:1). Lingering guilt may be the enemy\u2019s accusation rather than the Spirit\u2019s conviction. Preach the gospel to yourself daily.',
    v: [
      ['Romans 8:1', 'There is therefore now no condemnation for those who are in Christ Jesus.'],
      ['Psalm 103:12', 'As far as the east is from the west, so far does he remove our transgressions from us.'],
      ['1 John 1:9', 'If we confess our sins, he is faithful and just to forgive us our sins and to cleanse us from all unrighteousness.'],
      ['Isaiah 1:18', 'Though your sins are like scarlet, they shall be as white as snow; though they are red like crimson, they shall become like wool.'],
    ]
  },
  { cat: 'Guilt & Shame', q: 'Shame from past abuse or trauma',
    a: 'Shame from another\u2019s sin against you is not yours to carry. What was done to you was wrong; God sees, God names it as evil, and God will judge it justly. He is the Father of compassion who heals the broken (Ps 147:3). Healing is rarely instant — seek a trusted Christian counselor, lean on safe community, and let the Word slowly rewrite the lies. You are seen, you are loved, and you are not alone.',
    v: [
      ['Psalm 147:3', 'He heals the brokenhearted and binds up their wounds.'],
      ['Isaiah 61:1-3', 'The Spirit of the Lord GOD is upon me... to bind up the brokenhearted... to comfort all who mourn... to give them a beautiful headdress instead of ashes, the oil of gladness instead of mourning.'],
      ['2 Corinthians 1:3-4', 'Blessed be the God and Father of our Lord Jesus Christ, the Father of mercies and God of all comfort, who comforts us in all our affliction.'],
    ]
  },

  // ── FORGIVENESS ──
  { cat: 'Forgiveness', q: 'Cannot forgive someone who hurt me',
    a: 'Forgiveness is not pretending it didn\u2019t happen, excusing the wrong, or instantly restoring trust. It is releasing the right to take revenge and entrusting justice to God (Rom 12:19). It is often a process, not a moment. Forgive because you have been forgiven much (Eph 4:32). Reconciliation requires repentance from the offender and may take time or wisdom; forgiveness is something you can do regardless.',
    v: [
      ['Ephesians 4:32', 'Be kind to one another, tenderhearted, forgiving one another, as God in Christ forgave you.'],
      ['Matthew 6:14-15', 'For if you forgive others their trespasses, your heavenly Father will also forgive you, but if you do not forgive others their trespasses, neither will your Father forgive your trespasses.'],
      ['Romans 12:19', 'Beloved, never avenge yourselves, but leave it to the wrath of God, for it is written, "Vengeance is mine, I will repay, says the Lord."'],
    ]
  },

  // ── FINANCES & WORK ──
  { cat: 'Finances & Work', q: 'Financial pressure, debt, job loss',
    a: 'Money troubles touch everything — sleep, marriage, faith. Begin with honest assessment: a written budget, total debt, real income. Cut what you can; ask wise counsel; communicate with creditors. Then bring the burden to God, who has fed every sparrow (Matt 6). Tithing in lean times is faith, not folly — but legalistic guilt is not from God either. Generosity, contentment, and patience are forged here.',
    v: [
      ['Matthew 6:31-33', 'Do not be anxious, saying, "What shall we eat?" or "What shall we drink?"... Your heavenly Father knows that you need them all. But seek first the kingdom of God and his righteousness, and all these things will be added to you.'],
      ['Philippians 4:19', 'And my God will supply every need of yours according to his riches in glory in Christ Jesus.'],
      ['Hebrews 13:5', 'Keep your life free from love of money, and be content with what you have, for he has said, "I will never leave you nor forsake you."'],
      ['Proverbs 22:7', 'The rich rules over the poor, and the borrower is the slave of the lender.'],
    ]
  },

  // ── LONELINESS ──
  { cat: 'Loneliness', q: 'Loneliness, isolation, no real friends',
    a: 'Loneliness is one of the deepest human pains, and it grew sharper after the Fall. Begin with God Himself — He has promised never to leave you (Heb 13:5). Then take small risks toward others: a local church, a small group, serving the lonely (which often heals our own). Friendship, like a garden, is slow. Be the friend you wish you had (Prov 18:24).',
    v: [
      ['Hebrews 13:5', 'I will never leave you nor forsake you.'],
      ['Psalm 68:6', 'God settles the solitary in a home; he leads out the prisoners to prosperity.'],
      ['Proverbs 18:24', 'A man of many companions may come to ruin, but there is a friend who sticks closer than a brother.'],
      ['Matthew 28:20', 'Behold, I am with you always, to the end of the age.'],
    ]
  },

  // ── DOUBT ──
  { cat: 'Doubt', q: 'Doubting God / faith struggles',
    a: 'Doubt is not the opposite of faith — unbelief is. Many of God\u2019s people have wrestled (Job, the Psalms, John the Baptist, Thomas). Bring doubts into the light: name them, study them, talk with a mature believer. Don\u2019t isolate, and don\u2019t pretend. Often doubts are emotional or moral underneath an intellectual surface; deal with both. The Father of the demoniac\u2019s son prayed honestly, "I believe; help my unbelief."',
    v: [
      ['Mark 9:24', 'Immediately the father of the child cried out and said, "I believe; help my unbelief!"'],
      ['Jude 1:22', 'And have mercy on those who doubt.'],
      ['John 20:27-29', 'Then he said to Thomas, "Put your finger here, and see my hands; and put out your hand, and place it in my side. Do not disbelieve, but believe."... Jesus said to him, "Have you believed because you have seen me? Blessed are those who have not seen and yet have believed."'],
    ]
  },

  // ── CHRONIC ILLNESS ──
  { cat: 'Suffering & Illness', q: 'Chronic pain or illness',
    a: 'Long suffering is a hard school. God can heal in a moment, but more often He sustains through. Paul prayed three times for his thorn to be removed; God gave grace instead (2 Cor 12:9). That is not consolation prize — it is a deeper gift. Honest lament is welcome (read the Psalms). Receive ordinary means of help: medicine, rest, community. And remember: this body is not your final form (Phil 3:21).',
    v: [
      ['2 Corinthians 12:9-10', 'My grace is sufficient for you, for my power is made perfect in weakness... For when I am weak, then I am strong.'],
      ['2 Corinthians 4:16-17', 'So we do not lose heart. Though our outer self is wasting away, our inner self is being renewed day by day. For this light momentary affliction is preparing for us an eternal weight of glory beyond all comparison.'],
      ['Romans 8:18', 'For I consider that the sufferings of this present time are not worth comparing with the glory that is to be revealed to us.'],
    ]
  },

  // ── SINGLENESS ──
  { cat: 'Singleness', q: 'Singleness — longing for marriage',
    a: 'Singleness is not a deficiency, and Scripture calls it a gift (1 Cor 7). Yet the longing for marriage is also good, given by God. Hold both honestly. Don\u2019t put life on pause waiting; live fully now — serve, grow, give, love. Pray for what you long for, and trust God\u2019s timing and wisdom. Many godly singles have found that contentment, not marriage, was the deeper need being met.',
    v: [
      ['1 Corinthians 7:7-8', 'I wish that all were as I myself am. But each has his own gift from God, one of one kind and one of another. To the unmarried and the widows I say that it is good for them to remain single, as I am.'],
      ['Psalm 37:4', 'Delight yourself in the LORD, and he will give you the desires of your heart.'],
      ['Philippians 4:11-12', 'I have learned, in whatever situation I am, to be content. I know how to be brought low, and I know how to abound. In any and every circumstance, I have learned the secret of facing plenty and hunger, abundance and need.'],
    ]
  },

  // ── PURPOSE ──
  { cat: 'Purpose & Identity', q: 'Identity / who am I in Christ',
    a: 'Your identity is not what you do, what others say, or what you feel — it is who God says you are. In Christ you are: chosen (Eph 1:4), adopted (Eph 1:5), forgiven (Eph 1:7), sealed with the Spirit (Eph 1:13), a new creation (2 Cor 5:17), a citizen of heaven (Phil 3:20), and a beloved child of the Father (1 John 3:1). Preach this to yourself daily; the world will try to overwrite it hourly.',
    v: [
      ['2 Corinthians 5:17', 'Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.'],
      ['1 John 3:1', 'See what kind of love the Father has given to us, that we should be called children of God; and so we are.'],
      ['Galatians 2:20', 'I have been crucified with Christ. It is no longer I who live, but Christ who lives in me.'],
      ['Ephesians 2:10', 'For we are his workmanship, created in Christ Jesus for good works, which God prepared beforehand, that we should walk in them.'],
    ]
  },

  // ── DEATH / DYING ──
  { cat: 'Death & Eternity', q: 'Facing death — your own or a loved one\u2019s',
    a: 'For the believer, death is not the end but the door home. To be absent from the body is to be present with the Lord (2 Cor 5:8). Use this season for what matters: reconciliation, blessing, prayer, the giving of love and wisdom. Tell those you love how you love them. Receive ministry; do not always insist on being the strong one. Christ has gone before — He has tasted death so we may pass through with hope.',
    v: [
      ['2 Corinthians 5:8', 'We are of good courage, and we would rather be away from the body and at home with the Lord.'],
      ['Philippians 1:21-23', 'For to me to live is Christ, and to die is gain... My desire is to depart and be with Christ, for that is far better.'],
      ['Psalm 23:4', 'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me.'],
      ['1 Corinthians 15:54-57', 'Death is swallowed up in victory. O death, where is your victory? O death, where is your sting?... thanks be to God, who gives us the victory through our Lord Jesus Christ.'],
    ]
  },
];

function _renderCounseling(body) {
  const cats = {};
  BM_COUNSELING.forEach((it, i) => { (cats[it.cat] = cats[it.cat] || []).push({ ...it, _i: i }); });
  const catNames = Object.keys(cats);
  body.innerHTML = `
    <input type="text" class="bm-tool-input" id="bm-coun-search" placeholder="Search by issue, situation, or keyword…">
    <div class="bm-tool-empty" style="margin-top:-2px;">Pastoral counsel for real situations. Always rooted in Scripture; never a substitute for a pastor or licensed counselor.</div>
    <div id="bm-coun-list" style="display:flex;flex-direction:column;gap:14px;margin-top:6px;"></div>
  `;
  const list = _qs('bm-coun-list');
  function paint(query) {
    const q = (query || '').trim().toLowerCase();
    let html = '';
    catNames.forEach(cat => {
      const items = cats[cat].filter(it => {
        if (!q) return true;
        return (it.q + ' ' + it.a + ' ' + it.cat).toLowerCase().includes(q)
          || it.v.some(([ref, txt]) => (ref + ' ' + txt).toLowerCase().includes(q));
      });
      if (!items.length) return;
      html += `<div><div class="bm-apol-cat">${_e(cat)}</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;">`;
      items.forEach(it => {
        const versesHtml = it.v.map(([ref, txt]) => `
          <div class="bm-apol-verse">
            <strong>${_e(ref)}</strong>
            <span>${_e(txt)}</span>
            <a href="${_bibleGatewayUrl(ref)}" target="_blank" rel="noopener">Open on BibleGateway →</a>
          </div>`).join('');
        html += `
          <div class="bm-apol-card" data-idx="${it._i}">
            <button type="button" class="bm-apol-q" data-toggle="${it._i}">
              <span>${_e(it.q)}</span>
              <span class="bm-apol-chev">›</span>
            </button>
            <div class="bm-apol-body">
              <div class="bm-apol-section">Pastoral counsel</div>
              <div class="bm-apol-answer">${_e(it.a)}</div>
              <div class="bm-apol-section">Scripture</div>
              <div class="bm-apol-verses">${versesHtml}</div>
            </div>
          </div>`;
      });
      html += `</div></div>`;
    });
    if (!html) html = `<div class="bm-tool-empty">No matching topics.</div>`;
    list.innerHTML = html;
  }
  paint('');
  _qs('bm-coun-search').addEventListener('input', e => paint(e.target.value));
  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;
    const card = btn.closest('.bm-apol-card');
    if (card) card.classList.toggle('is-open');
  });
}


// ─────────────────────────────────────────────────────────────
// CREEDS & CONFESSIONS — historic Christian statements
// ─────────────────────────────────────────────────────────────
const BM_CREEDS = [
  // ── EARLY CHURCH ──
  { cat: 'Early Church', q: 'The Apostles\u2019 Creed (c. 2nd–4th century)',
    a: 'I believe in God, the Father almighty, creator of heaven and earth.\n\nI believe in Jesus Christ, his only Son, our Lord, who was conceived by the Holy Spirit, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died, and was buried; he descended to the dead. On the third day he rose again; he ascended into heaven, he is seated at the right hand of the Father, and he will come to judge the living and the dead.\n\nI believe in the Holy Spirit, the holy Christian Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and the life everlasting. Amen.',
    v: [
      ['1 Corinthians 15:3-4', 'Christ died for our sins in accordance with the Scriptures, that he was buried, that he was raised on the third day in accordance with the Scriptures.'],
      ['Acts 1:11', 'This Jesus, who was taken up from you into heaven, will come in the same way as you saw him go into heaven.'],
      ['1 Timothy 3:16', 'Great indeed, we confess, is the mystery of godliness: He was manifested in the flesh, vindicated by the Spirit, seen by angels, proclaimed among the nations, believed on in the world, taken up in glory.'],
    ]
  },
  { cat: 'Early Church', q: 'The Nicene Creed (325 / 381)',
    a: 'We believe in one God, the Father almighty, maker of heaven and earth, of all things visible and invisible.\n\nAnd in one Lord Jesus Christ, the only begotten Son of God, begotten of the Father before all worlds; God of God, Light of Light, very God of very God; begotten, not made, being of one substance (homoousios) with the Father, by whom all things were made. Who, for us men and for our salvation, came down from heaven, and was incarnate by the Holy Spirit of the Virgin Mary, and was made man; and was crucified also for us under Pontius Pilate; he suffered and was buried; and the third day he rose again, according to the Scriptures; and ascended into heaven, and sits at the right hand of the Father; and he shall come again, with glory, to judge both the living and the dead; whose kingdom shall have no end.\n\nAnd we believe in the Holy Spirit, the Lord and Giver of Life, who proceeds from the Father (and the Son), who with the Father and the Son together is worshiped and glorified, who spoke by the prophets.\n\nAnd we believe in one holy Christian and apostolic Church. We acknowledge one baptism for the remission of sins. And we look for the resurrection of the dead, and the life of the world to come. Amen.',
    v: [
      ['John 1:1-3', 'In the beginning was the Word, and the Word was with God, and the Word was God... All things were made through him, and without him was not any thing made that was made.'],
      ['Colossians 1:15-17', 'He is the image of the invisible God, the firstborn of all creation. For by him all things were created... all things were created through him and for him.'],
      ['Hebrews 1:3', 'He is the radiance of the glory of God and the exact imprint of his nature.'],
    ]
  },
  { cat: 'Early Church', q: 'The Chalcedonian Definition (451)',
    a: 'We confess one and the same Son, our Lord Jesus Christ, the same perfect in Godhead and also perfect in manhood; truly God and truly man, of a reasonable soul and body; consubstantial with the Father according to the Godhead, and consubstantial with us according to the manhood; in all things like unto us, without sin... to be acknowledged in two natures, inconfusedly, unchangeably, indivisibly, inseparably; the distinction of natures being by no means taken away by the union, but rather the property of each nature being preserved, and concurring in one Person and one Subsistence, not parted or divided into two persons, but one and the same Son, and only begotten God, the Word, the Lord Jesus Christ.',
    v: [
      ['John 1:14', 'And the Word became flesh and dwelt among us, and we have seen his glory, glory as of the only Son from the Father, full of grace and truth.'],
      ['Philippians 2:6-7', 'Who, though he was in the form of God, did not count equality with God a thing to be grasped, but emptied himself, by taking the form of a servant, being born in the likeness of men.'],
      ['Hebrews 4:15', 'For we do not have a high priest who is unable to sympathize with our weaknesses, but one who in every respect has been tempted as we are, yet without sin.'],
    ]
  },
  { cat: 'Early Church', q: 'The Athanasian Creed (excerpt)',
    a: 'Whoever desires to be saved must, above all, hold the Christian faith. And the Christian faith is this: that we worship one God in Trinity, and Trinity in Unity, neither confounding the persons, nor dividing the substance.\n\nFor there is one person of the Father, another of the Son, and another of the Holy Spirit. But the Godhead of the Father, of the Son, and of the Holy Spirit is all one: the glory equal, the majesty coeternal. Such as the Father is, such is the Son, and such is the Holy Spirit. The Father uncreated, the Son uncreated, and the Holy Spirit uncreated... And yet they are not three eternals, but one Eternal... So the Father is God, the Son is God, and the Holy Spirit is God. And yet they are not three Gods, but one God.',
    v: [
      ['Matthew 28:19', 'Go therefore and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit.'],
      ['2 Corinthians 13:14', 'The grace of the Lord Jesus Christ and the love of God and the fellowship of the Holy Spirit be with you all.'],
      ['Deuteronomy 6:4', 'Hear, O Israel: The LORD our God, the LORD is one.'],
    ]
  },

  // ── REFORMATION ──
  { cat: 'Reformation', q: 'The Five Solas of the Reformation',
    a: 'Sola Scriptura — Scripture alone is the supreme authority for faith and life.\n\nSola Fide — We are justified by faith alone, not by works.\n\nSola Gratia — Salvation is by grace alone, the unmerited favor of God.\n\nSolus Christus — Christ alone is our mediator, sacrifice, and Lord.\n\nSoli Deo Gloria — All of life is to be lived for the glory of God alone.',
    v: [
      ['2 Timothy 3:16-17', 'All Scripture is breathed out by God and profitable for teaching, for reproof, for correction, and for training in righteousness.'],
      ['Ephesians 2:8-9', 'For by grace you have been saved through faith. And this is not your own doing; it is the gift of God, not a result of works, so that no one may boast.'],
      ['1 Timothy 2:5', 'For there is one God, and there is one mediator between God and men, the man Christ Jesus.'],
      ['1 Corinthians 10:31', 'So, whether you eat or drink, or whatever you do, do all to the glory of God.'],
    ]
  },
  { cat: 'Reformation', q: 'Heidelberg Catechism — Q&A 1 (1563)',
    a: 'Q. What is your only comfort in life and in death?\n\nA. That I am not my own, but belong with body and soul, both in life and in death, to my faithful Savior Jesus Christ. He has fully paid for all my sins with his precious blood, and has set me free from all the power of the devil. He also preserves me in such a way that without the will of my heavenly Father not a hair can fall from my head; indeed, all things must work together for my salvation. Therefore, by his Holy Spirit he also assures me of eternal life and makes me heartily willing and ready from now on to live for him.',
    v: [
      ['1 Corinthians 6:19-20', 'You are not your own, for you were bought with a price. So glorify God in your body.'],
      ['Romans 14:7-8', 'For none of us lives to himself, and none of us dies to himself. For if we live, we live to the Lord, and if we die, we die to the Lord. So then, whether we live or whether we die, we are the Lord\u2019s.'],
      ['Matthew 10:29-30', 'Are not two sparrows sold for a penny? And not one of them will fall to the ground apart from your Father. But even the hairs of your head are all numbered.'],
      ['Romans 8:28', 'And we know that for those who love God all things work together for good, for those who are called according to his purpose.'],
    ]
  },
  { cat: 'Reformation', q: 'Westminster Shorter Catechism — Q&A 1 (1647)',
    a: 'Q. What is the chief end of man?\n\nA. Man\u2019s chief end is to glorify God, and to enjoy him forever.\n\nThis single sentence has shaped Reformed and evangelical piety for nearly four centuries. We were not made primarily for self-fulfillment, success, or even moral achievement — but for God Himself: His glory, and the joyful knowledge of Him that lasts forever.',
    v: [
      ['1 Corinthians 10:31', 'So, whether you eat or drink, or whatever you do, do all to the glory of God.'],
      ['Psalm 73:25-26', 'Whom have I in heaven but you? And there is nothing on earth that I desire besides you. My flesh and my heart may fail, but God is the strength of my heart and my portion forever.'],
      ['John 17:3', 'And this is eternal life, that they know you, the only true God, and Jesus Christ whom you have sent.'],
    ]
  },
  { cat: 'Reformation', q: 'Augsburg Confession — Article IV: Justification (1530)',
    a: 'Our churches teach that men cannot be justified before God by their own powers, merits, or works. But they are justified freely on account of Christ, through faith, when they believe that they are received into favor and that their sins are forgiven on account of Christ, who by his death made satisfaction for our sins. This faith God imputes for righteousness in his sight (Rom. 3 and 4).\n\nThis is the article on which the church stands or falls (articulus stantis et cadentis ecclesiae) — Luther\u2019s line — because it touches the very heart of the gospel: salvation is by grace alone, through faith alone, on account of Christ alone.',
    v: [
      ['Romans 3:23-24', 'For all have sinned and fall short of the glory of God, and are justified by his grace as a gift, through the redemption that is in Christ Jesus.'],
      ['Romans 4:5', 'And to the one who does not work but believes in him who justifies the ungodly, his faith is counted as righteousness.'],
      ['Galatians 2:16', 'A person is not justified by works of the law but through faith in Jesus Christ.'],
    ]
  },
  { cat: 'Reformation', q: 'Belgic Confession — Article 1: The Only God (1561)',
    a: 'We all believe in our hearts and confess with our mouths that there is one only simple and spiritual Being, which we call God; and that he is eternal, incomprehensible, invisible, immutable, infinite, almighty, perfectly wise, just, good, and the overflowing fountain of all good.',
    v: [
      ['Deuteronomy 6:4', 'Hear, O Israel: The LORD our God, the LORD is one.'],
      ['1 Timothy 1:17', 'To the King of the ages, immortal, invisible, the only God, be honor and glory forever and ever. Amen.'],
      ['James 1:17', 'Every good gift and every perfect gift is from above, coming down from the Father of lights with whom there is no variation or shadow due to change.'],
    ]
  },

  // ── MODERN ──
  { cat: 'Modern', q: 'The Lausanne Covenant (1974) — excerpt on Evangelism',
    a: 'To evangelize is to spread the good news that Jesus Christ died for our sins and was raised from the dead according to the Scriptures, and that as the reigning Lord he now offers the forgiveness of sins and the liberating gifts of the Spirit to all who repent and believe. Our Christian presence in the world is indispensable to evangelism, and so is that kind of dialogue whose purpose is to listen sensitively in order to understand. But evangelism itself is the proclamation of the historical, biblical Christ as Saviour and Lord, with a view to persuading people to come to him personally and so be reconciled to God.',
    v: [
      ['Matthew 28:19-20', 'Go therefore and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit, teaching them to observe all that I have commanded you.'],
      ['Romans 10:14-15', 'How then will they call on him in whom they have not believed? And how are they to believe in him of whom they have never heard? And how are they to hear without someone preaching?'],
      ['2 Corinthians 5:18-20', 'God... gave us the ministry of reconciliation... Therefore, we are ambassadors for Christ, God making his appeal through us.'],
    ]
  },
  { cat: 'Modern', q: 'The Chicago Statement on Biblical Inerrancy (1978) — Short Statement',
    a: '1. God, who is Himself Truth and speaks truth only, has inspired Holy Scripture in order thereby to reveal Himself to lost mankind through Jesus Christ as Creator and Lord, Redeemer and Judge. Holy Scripture is God\u2019s witness to Himself.\n\n2. Holy Scripture, being God\u2019s own Word, written by men prepared and superintended by His Spirit, is of infallible divine authority in all matters upon which it touches.\n\n3. The Holy Spirit, its divine Author, both authenticates it to us by His inward witness and opens our minds to understand its meaning.\n\n4. Being wholly and verbally God-given, Scripture is without error or fault in all its teaching.\n\n5. The authority of Scripture is inescapably impaired if this total divine inerrancy is in any way limited or disregarded.',
    v: [
      ['2 Timothy 3:16', 'All Scripture is breathed out by God and profitable for teaching, for reproof, for correction, and for training in righteousness.'],
      ['2 Peter 1:20-21', 'No prophecy of Scripture comes from someone\u2019s own interpretation. For no prophecy was ever produced by the will of man, but men spoke from God as they were carried along by the Holy Spirit.'],
      ['Psalm 119:160', 'The sum of your word is truth, and every one of your righteous rules endures forever.'],
    ]
  },
];

function _renderCreeds(body) { _renderAccordion(body, BM_CREEDS, 'bm-creed', 'Search creeds, doctrines, or keywords…', 'Text', 'Scripture'); }

// ─────────────────────────────────────────────────────────────
// HEBREW & GREEK — key biblical words in the original languages
// ─────────────────────────────────────────────────────────────
const BM_WORDS = [
  // ── HEBREW ──
  { cat: 'Hebrew', q: 'חֶסֶד · chesed — steadfast covenant love',
    a: 'Pronounced KHEH-sed. Used 245+ times in the OT. Often translated "lovingkindness," "steadfast love," "mercy," or "faithful love." It denotes loyal, covenant-keeping love that endures even when undeserved — God\u2019s commitment to His people that does not let go. The defining word for Yahweh\u2019s character (Exod 34:6).',
    v: [
      ['Exodus 34:6', 'The LORD passed before him and proclaimed, "The LORD, the LORD, a God merciful and gracious, slow to anger, and abounding in steadfast love (chesed) and faithfulness."'],
      ['Lamentations 3:22-23', 'The steadfast love (chesed) of the LORD never ceases; his mercies never come to an end; they are new every morning; great is your faithfulness.'],
      ['Psalm 136', 'Give thanks to the LORD, for he is good, for his steadfast love (chesed) endures forever. (Refrain repeated in all 26 verses.)'],
    ]
  },
  { cat: 'Hebrew', q: 'שָׁלוֹם · shalom — wholeness, peace, flourishing',
    a: 'Far more than the absence of conflict. Shalom is the complete well-being of a thing as it was meant to be — physical, relational, social, spiritual. When God promises shalom, He promises that things will be put right, restored, made whole. Cornelius Plantinga: "the way things ought to be."',
    v: [
      ['Numbers 6:24-26', 'The LORD bless you and keep you; the LORD make his face to shine upon you and be gracious to you; the LORD lift up his countenance upon you and give you peace (shalom).'],
      ['Isaiah 9:6', 'For to us a child is born... and his name shall be called Wonderful Counselor, Mighty God, Everlasting Father, Prince of Peace (Sar Shalom).'],
      ['Isaiah 53:5', 'Upon him was the chastisement that brought us peace (shalom), and with his wounds we are healed.'],
    ]
  },
  { cat: 'Hebrew', q: 'רוּחַ · ruach — spirit, breath, wind',
    a: 'Pronounced ROO-akh. The same word covers wind, breath, and spirit — including the Spirit of God. The Spirit hovers (rachaph) over the waters in Gen 1:2; God breathes ruach into Adam in Gen 2:7. The OT often blurs the boundary between physical breath and spiritual life because both come from God.',
    v: [
      ['Genesis 1:2', 'The earth was without form and void, and darkness was over the face of the deep. And the Spirit (Ruach) of God was hovering over the face of the waters.'],
      ['Ezekiel 37:9-10', 'Then he said to me, "Prophesy to the breath; prophesy, son of man, and say to the breath (ruach)... come from the four winds, O breath, and breathe on these slain, that they may live."'],
      ['Psalm 51:10-11', 'Create in me a clean heart, O God, and renew a right spirit (ruach) within me. Cast me not away from your presence, and take not your Holy Spirit (Ruach Qadosh) from me.'],
    ]
  },
  { cat: 'Hebrew', q: 'קָדוֹשׁ · qadosh — holy, set apart',
    a: 'The root meaning is "set apart, separate." When applied to God it points to His utter otherness — morally pure, transcendent, distinct from all creation. When applied to His people, places, or objects, it means devoted to God for His use. The only attribute of God repeated three times in Scripture: "Holy, holy, holy" (Isa 6:3; Rev 4:8).',
    v: [
      ['Isaiah 6:3', 'And one called to another and said, "Holy, holy, holy (qadosh, qadosh, qadosh) is the LORD of hosts; the whole earth is full of his glory!"'],
      ['Leviticus 11:44', 'For I am the LORD your God. Consecrate yourselves therefore, and be holy (qadosh), for I am holy.'],
      ['Exodus 15:11', 'Who is like you, O LORD, among the gods? Who is like you, majestic in holiness (qodesh), awesome in glorious deeds, doing wonders?'],
    ]
  },
  { cat: 'Hebrew', q: 'צֶדֶק · tzedek / tzedakah — righteousness, justice',
    a: 'Closely paired with mishpat ("justice"). Tzedek is right behavior measured by God\u2019s character; tzedakah is righteousness expressed in active, just dealing — including generous care for the vulnerable. In later Hebrew, tzedakah came to mean almsgiving, because to be righteous is to share with the poor.',
    v: [
      ['Micah 6:8', 'He has told you, O man, what is good; and what does the LORD require of you but to do justice (mishpat), and to love kindness (chesed), and to walk humbly with your God?'],
      ['Genesis 15:6', 'And he believed the LORD, and he counted it to him as righteousness (tzedakah).'],
      ['Isaiah 1:17', 'Learn to do good; seek justice (mishpat), correct oppression; bring justice to the fatherless, plead the widow\u2019s cause.'],
    ]
  },
  { cat: 'Hebrew', q: 'הִנֵּנִי · hineni — Here I am',
    a: 'Literally "Behold me." The covenant response of availability before God. Spoken by Abraham at the binding of Isaac (Gen 22:1, 11), by Moses at the burning bush (Exod 3:4), by Samuel as a boy (1 Sam 3:4), and by Isaiah at his commissioning (Isa 6:8). It is the posture of a servant ready for whatever the Master commands.',
    v: [
      ['Genesis 22:1', 'After these things God tested Abraham and said to him, "Abraham!" And he said, "Here I am (hineni)."'],
      ['Isaiah 6:8', 'And I heard the voice of the Lord saying, "Whom shall I send, and who will go for us?" Then I said, "Here I am (hineni)! Send me."'],
      ['1 Samuel 3:4', 'Then the LORD called Samuel, and he said, "Here I am (hineni)!"'],
    ]
  },
  { cat: 'Hebrew', q: 'נֶפֶשׁ · nephesh — soul, life, being',
    a: 'Often translated "soul," but it does not mean a disembodied spirit (as in Greek thought). Nephesh refers to the whole living person — body and inner life together. "Living nephesh" (Gen 2:7) describes Adam as a living being. The OT does not split a human into parts; you are a nephesh.',
    v: [
      ['Genesis 2:7', 'Then the LORD God formed the man of dust from the ground and breathed into his nostrils the breath of life, and the man became a living creature (nephesh chayyah).'],
      ['Psalm 103:1-2', 'Bless the LORD, O my soul (nephesh), and all that is within me, bless his holy name! Bless the LORD, O my soul, and forget not all his benefits.'],
      ['Deuteronomy 6:5', 'You shall love the LORD your God with all your heart and with all your soul (nephesh) and with all your might.'],
    ]
  },
  { cat: 'Hebrew', q: 'יְהוָה · YHWH — the covenant name of God',
    a: 'The personal name God revealed to Moses at the burning bush (Exod 3:14-15). Probably pronounced "Yahweh." Connected to the Hebrew verb "to be" — "I AM WHO I AM." Out of reverence, Jews traditionally read "Adonai" (Lord) when YHWH appears, which is why most English Bibles render it "LORD" in small caps. It identifies God as the self-existent, covenant-keeping One.',
    v: [
      ['Exodus 3:14-15', 'God said to Moses, "I AM WHO I AM... Say this to the people of Israel: \'The LORD (YHWH), the God of your fathers... has sent me to you.\' This is my name forever, and thus I am to be remembered throughout all generations."'],
      ['Exodus 6:2-3', 'God spoke to Moses and said to him, "I am the LORD (YHWH). I appeared to Abraham, to Isaac, and to Jacob, as God Almighty (El Shaddai), but by my name the LORD I did not make myself known to them."'],
      ['John 8:58', 'Jesus said to them, "Truly, truly, I say to you, before Abraham was, I am."'],
    ]
  },

  // ── GREEK ──
  { cat: 'Greek', q: 'ἀγάπη · agape — self-giving love',
    a: 'The dominant NT word for love. Distinguished from eros (romantic) and philia (friendship), agape is willed, sacrificial, self-giving love that seeks the good of the other regardless of return. It is the love by which God loves us (John 3:16) and which He pours into our hearts by the Spirit (Rom 5:5). The verb form (agapao) describes both God\u2019s love and Christ\u2019s love for the Father.',
    v: [
      ['John 3:16', 'For God so loved (egapesen — from agapao) the world, that he gave his only Son.'],
      ['1 Corinthians 13:4-7', 'Love (agape) is patient and kind; love does not envy or boast; it is not arrogant or rude... Love bears all things, believes all things, hopes all things, endures all things.'],
      ['1 John 4:8-10', 'Anyone who does not love does not know God, because God is love (agape). In this the love of God was made manifest among us, that God sent his only Son into the world, so that we might live through him.'],
    ]
  },
  { cat: 'Greek', q: 'λόγος · logos — word, reason, discourse',
    a: 'In Greek philosophy, the rational principle ordering the universe. John takes the term and applies it to Jesus: the eternal Word who was with God and who was God, through whom all things were made (John 1:1-3). This is one of the highest Christological statements in Scripture — Jesus is the divine self-expression, the rational meaning of all reality.',
    v: [
      ['John 1:1-3', 'In the beginning was the Word (Logos), and the Word was with God, and the Word was God. He was in the beginning with God. All things were made through him, and without him was not any thing made that was made.'],
      ['John 1:14', 'And the Word (Logos) became flesh and dwelt among us, and we have seen his glory, glory as of the only Son from the Father, full of grace and truth.'],
      ['Hebrews 4:12', 'For the word (logos) of God is living and active, sharper than any two-edged sword, piercing to the division of soul and of spirit.'],
    ]
  },
  { cat: 'Greek', q: 'χάρις · charis — grace, unmerited favor',
    a: 'Used 155+ times in the NT. The defining word of the gospel: God\u2019s undeserved kindness shown to sinners. Not merely an attribute but a power — grace teaches, trains, abounds, reigns. It is the opposite of debt or wages (Rom 4:4); it cannot be earned and can only be received. Eucharisteo ("give thanks") shares the same root.',
    v: [
      ['Ephesians 2:8-9', 'For by grace (charis) you have been saved through faith. And this is not your own doing; it is the gift of God, not a result of works, so that no one may boast.'],
      ['2 Corinthians 12:9', 'But he said to me, "My grace (charis) is sufficient for you, for my power is made perfect in weakness."'],
      ['Titus 2:11-12', 'For the grace (charis) of God has appeared, bringing salvation for all people, training us to renounce ungodliness and worldly passions.'],
    ]
  },
  { cat: 'Greek', q: 'πίστις · pistis — faith, trust, faithfulness',
    a: 'More than mere belief — pistis is trust, reliance, faithfulness. It carries the idea of personal commitment, not just intellectual assent. The same word can mean "faith" (our trust in God) or "faithfulness" (God\u2019s reliability), depending on context. The "righteous shall live by pistis" (Hab 2:4 / Rom 1:17) is the verse that opened Luther\u2019s eyes.',
    v: [
      ['Hebrews 11:1', 'Now faith (pistis) is the assurance of things hoped for, the conviction of things not seen.'],
      ['Romans 1:17', 'For in it the righteousness of God is revealed from faith (pistis) for faith, as it is written, "The righteous shall live by faith."'],
      ['Galatians 2:20', 'I have been crucified with Christ. It is no longer I who live, but Christ who lives in me. And the life I now live in the flesh I live by faith (pistis) in the Son of God.'],
    ]
  },
  { cat: 'Greek', q: 'μετάνοια · metanoia — repentance, change of mind',
    a: 'Literally "after-mind" or "change of mind." Far deeper than feeling sorry: a radical reorientation of heart, mind, and direction — turning from sin and self toward God. This is the first word of Jesus\u2019s public preaching (Matt 4:17) and the first word of the church\u2019s on Pentecost (Acts 2:38). Without it, there is no entrance to the kingdom.',
    v: [
      ['Matthew 4:17', 'From that time Jesus began to preach, saying, "Repent (metanoeite), for the kingdom of heaven is at hand."'],
      ['Acts 2:38', 'And Peter said to them, "Repent (metanoesate) and be baptized every one of you in the name of Jesus Christ for the forgiveness of your sins."'],
      ['2 Corinthians 7:10', 'For godly grief produces a repentance (metanoia) that leads to salvation without regret, whereas worldly grief produces death.'],
    ]
  },
  { cat: 'Greek', q: 'ἐκκλησία · ekklesia — church, assembly',
    a: 'Literally "the called-out ones" (ek = out + kaleo = call). In secular Greek it referred to a citizens\u2019 assembly. In the NT it becomes the gathered people of God — both the local congregation and the universal church. The church is not a building but the community Jesus is building (Matt 16:18).',
    v: [
      ['Matthew 16:18', 'And I tell you, you are Peter, and on this rock I will build my church (ekklesia), and the gates of hell shall not prevail against it.'],
      ['Acts 2:42', 'And they devoted themselves to the apostles\u2019 teaching and the fellowship, to the breaking of bread and the prayers.'],
      ['Ephesians 5:25', 'Husbands, love your wives, as Christ loved the church (ekklesia) and gave himself up for her.'],
    ]
  },
  { cat: 'Greek', q: 'κοινωνία · koinonia — fellowship, partnership, sharing',
    a: 'Often translated "fellowship," but richer than that — koinonia is shared life, common participation, partnership. The early Christians had koinonia in the apostles\u2019 teaching, in the breaking of bread, and in financial sharing (Acts 2:42-45). It is the bond of communal life created by the Spirit.',
    v: [
      ['Acts 2:42', 'And they devoted themselves to the apostles\u2019 teaching and the fellowship (koinonia), to the breaking of bread and the prayers.'],
      ['1 John 1:3', 'That which we have seen and heard we proclaim also to you, so that you too may have fellowship (koinonia) with us; and indeed our fellowship is with the Father and with his Son Jesus Christ.'],
      ['Philippians 1:5', 'Because of your partnership (koinonia) in the gospel from the first day until now.'],
    ]
  },
  { cat: 'Greek', q: 'δικαιοσύνη · dikaiosyne — righteousness, justice',
    a: 'The standing of being right before God. Can mean the righteousness God requires (Matt 6:33) or the righteousness God gives in Christ (Rom 3:21-22). Paul\u2019s great theme: a righteousness from God by faith, apart from law-keeping, credited to all who trust in Jesus.',
    v: [
      ['Romans 3:21-22', 'But now the righteousness (dikaiosyne) of God has been manifested apart from the law... the righteousness of God through faith in Jesus Christ for all who believe.'],
      ['2 Corinthians 5:21', 'For our sake he made him to be sin who knew no sin, so that in him we might become the righteousness (dikaiosyne) of God.'],
      ['Matthew 5:6', 'Blessed are those who hunger and thirst for righteousness (dikaiosyne), for they shall be satisfied.'],
    ]
  },
  { cat: 'Greek', q: 'σωτηρία · soteria — salvation, deliverance',
    a: 'Means rescue, deliverance, preservation, healing. Used both for spiritual salvation and for physical deliverance/healing (Mark 5:34 — "your faith has saved/healed you"). NT salvation has past, present, and future tenses: we have been saved (from sin\u2019s penalty), are being saved (from sin\u2019s power), and will be saved (from sin\u2019s presence).',
    v: [
      ['Romans 1:16', 'For I am not ashamed of the gospel, for it is the power of God for salvation (soterian) to everyone who believes, to the Jew first and also to the Greek.'],
      ['Acts 4:12', 'And there is salvation (soteria) in no one else, for there is no other name under heaven given among men by which we must be saved.'],
      ['Hebrews 5:9', 'And being made perfect, he became the source of eternal salvation (soterias) to all who obey him.'],
    ]
  },
  { cat: 'Greek', q: 'παρουσία · parousia — coming, arrival, presence',
    a: 'Used for the return of Christ at the end of the age. In the Greco-Roman world, parousia denoted the official visit of a king or emperor — a fitting word for the King\u2019s return in glory. The NT longing is "Maranatha" — "Our Lord, come!"',
    v: [
      ['Matthew 24:27', 'For as the lightning comes from the east and shines as far as the west, so will be the coming (parousia) of the Son of Man.'],
      ['1 Thessalonians 4:15-16', 'For this we declare to you by a word from the Lord, that we who are alive, who are left until the coming (parousia) of the Lord, will not precede those who have fallen asleep.'],
      ['2 Peter 3:12', 'Waiting for and hastening the coming of the day of God.'],
    ]
  },
  { cat: 'Greek', q: 'κένωσις · kenosis — self-emptying',
    a: 'From the verb kenoo, "to empty." Used in Phil 2:7 to describe how Christ "emptied himself" in the incarnation — not surrendering His deity but veiling His glory and taking the form of a servant. The pattern of kenosis is the pattern for all Christian discipleship: downward, sacrificial, humble.',
    v: [
      ['Philippians 2:6-8', 'Who, though he was in the form of God... emptied himself (heauton ekenosen), by taking the form of a servant, being born in the likeness of men. And being found in human form, he humbled himself by becoming obedient to the point of death, even death on a cross.'],
      ['2 Corinthians 8:9', 'For you know the grace of our Lord Jesus Christ, that though he was rich, yet for your sake he became poor, so that you by his poverty might become rich.'],
      ['Mark 10:45', 'For even the Son of Man came not to be served but to serve, and to give his life as a ransom for many.'],
    ]
  },
  { cat: 'Greek', q: 'δόξα · doxa — glory, honor, splendor',
    a: 'In the Septuagint, doxa translates the Hebrew kavod ("weight, heaviness") — God\u2019s manifest weight, splendor, the visible radiance of His invisible greatness. We were made to behold and reflect His doxa; sin is "falling short" of it (Rom 3:23). Doxology = "doxa-word" = a speech of glory.',
    v: [
      ['Romans 3:23', 'For all have sinned and fall short of the glory (doxa) of God.'],
      ['John 1:14', 'And the Word became flesh and dwelt among us, and we have seen his glory (doxa), glory as of the only Son from the Father, full of grace and truth.'],
      ['2 Corinthians 3:18', 'And we all, with unveiled face, beholding the glory (doxa) of the Lord, are being transformed into the same image from one degree of glory to another.'],
    ]
  },
];

function _renderWords(body) { _renderAccordion(body, BM_WORDS, 'bm-word', 'Search Hebrew/Greek words, meanings, or English keywords…', 'Meaning & nuance', 'Scripture'); }

// ─────────────────────────────────────────────────────────────
// SERMON TEMPLATES — proven preaching structures
// ─────────────────────────────────────────────────────────────
const BM_TEMPLATES = [
  { cat: 'Expository', q: 'Verse-by-Verse Expository',
    a: 'Walk the congregation through a passage line by line, explaining the original meaning and pressing it into the present.\n\nStructure:\n1. INTRODUCTION — Hook + read the passage + state the big idea.\n2. CONTEXT — Where does this fit in the book? Who wrote, to whom, why?\n3. TEXT — Work through the passage in 2–4 natural divisions, observing what it says, explaining what it means, applying it.\n4. APPLICATION — Specific, concrete steps for hearers (head, heart, hands).\n5. CONCLUSION — Re-state the big idea and call for response.\n\nStrengths: deepens trust in Scripture, prevents hobby-horse preaching, models how to read the Bible.',
    v: [
      ['Nehemiah 8:8', 'They read from the book, from the Law of God, clearly, and they gave the sense, so that the people understood the reading.'],
      ['2 Timothy 4:2', 'Preach the word; be ready in season and out of season; reprove, rebuke, and exhort, with complete patience and teaching.'],
      ['Acts 20:27', 'For I did not shrink from declaring to you the whole counsel of God.'],
    ]
  },
  { cat: 'Expository', q: 'Christ-Centered / Redemptive-Historical',
    a: 'Show how the passage fits into the unfolding storyline of redemption that climaxes in Christ. Avoid moralism ("be like David") and ask: what does this text reveal about the Redeemer and the gospel of grace?\n\nStructure:\n1. THE TEXT IN ITS CONTEXT — What is going on here?\n2. THE TEXT IN THE STORY — Where does it fit in creation–fall–redemption–restoration?\n3. THE TEXT TO CHRIST — How does this point to, prepare for, or unfold who Christ is and what He has done?\n4. THE TEXT TO US — How does the gospel here change us today?\n\nGuard rail: every sermon ends at the cross and the empty tomb, not at moral effort.',
    v: [
      ['Luke 24:27', 'And beginning with Moses and all the Prophets, he interpreted to them in all the Scriptures the things concerning himself.'],
      ['John 5:39', 'You search the Scriptures because you think that in them you have eternal life; and it is they that bear witness about me.'],
      ['1 Corinthians 2:2', 'For I decided to know nothing among you except Jesus Christ and him crucified.'],
    ]
  },
  { cat: 'Topical', q: 'Topical Sermon (Scripture-driven)',
    a: 'Address a single topic (anxiety, marriage, money, suffering) by gathering and exegeting a small set of key passages — never proof-texting.\n\nStructure:\n1. INTRODUCTION — Why this topic matters, today, here.\n2. WHAT THE BIBLE SAYS — 2–4 anchor passages, each opened briefly in context.\n3. WHAT IT MEANS — Synthesize into a clear biblical teaching.\n4. WHAT IT LOOKS LIKE — Concrete application across age/life-stage.\n5. CONCLUSION — Press home one big call to response.\n\nDanger to avoid: stringing verses together out of context to prove a pre-formed point. Let the texts shape the message.',
    v: [
      ['2 Timothy 3:16-17', 'All Scripture is breathed out by God and profitable for teaching, for reproof, for correction, and for training in righteousness, that the man of God may be complete, equipped for every good work.'],
      ['Acts 17:11', 'Now these Jews were more noble than those in Thessalonica; they received the word with all eagerness, examining the Scriptures daily to see if these things were so.'],
      ['Titus 2:1', 'But as for you, teach what accords with sound doctrine.'],
    ]
  },
  { cat: 'Topical', q: 'Three-Point Sermon (Classic)',
    a: 'A timeless structure that helps hearers remember and apply.\n\nStructure:\n1. INTRODUCTION + Big Idea in one sentence.\n2. POINT 1 — Statement, explanation, illustration, application.\n3. POINT 2 — Statement, explanation, illustration, application.\n4. POINT 3 — Statement, explanation, illustration, application.\n5. CONCLUSION — Restate big idea + call to response.\n\nMake the three points parallel (alliteration, repeated structure) — they should feel like one sermon, not three. Each point should be a window into the same truth, not a different truth.',
    v: [
      ['Ecclesiastes 4:12', 'A threefold cord is not quickly broken.'],
      ['Matthew 7:24', 'Everyone then who hears these words of mine and does them will be like a wise man who built his house on the rock.'],
      ['1 Corinthians 14:9', 'So with yourselves, if with your tongue you utter speech that is not intelligible, how will anyone know what is said? For you will be speaking into the air.'],
    ]
  },
  { cat: 'Narrative', q: 'Narrative Sermon (Story-driven)',
    a: 'Best for biblical narratives (David, Ruth, the prodigal son, the woman at the well). Tell the story, then turn it on the hearer.\n\nStructure:\n1. SET THE SCENE — Cultural and historical setting.\n2. TRACE THE STORY — Walk through the narrative with vivid detail; let the tension build.\n3. THE TURN — The moment of revelation: who God is, what He does, what changes.\n4. CONNECT TO US — Where are you in this story? Where is Christ?\n5. CALL — One clear response.\n\nUse character voices, sensory detail, and tension. Let the text\u2019s genre shape your delivery.',
    v: [
      ['Luke 8:1', 'Soon afterward he went on through cities and villages, proclaiming and bringing the good news of the kingdom of God.'],
      ['Mark 4:33-34', 'With many such parables he spoke the word to them, as they were able to hear it. He did not speak to them without a parable.'],
      ['Hebrews 11', '(The hall of faith — narrative theology in action.)'],
    ]
  },
  { cat: 'Inductive', q: 'Problem–Solution',
    a: 'Surface a real problem the hearers feel, then bring Scripture\u2019s answer.\n\nStructure:\n1. THE PROBLEM — Name the felt need with empathy and specificity (no straw-men).\n2. THE WRONG ANSWERS — Briefly examine the world\u2019s common solutions and where they fall short.\n3. THE BIBLICAL ANSWER — Open the text, show God\u2019s diagnosis and remedy.\n4. THE GOSPEL ROOT — Connect the answer to Christ and the gospel.\n5. THE RESPONSE — Specific steps of obedience.\n\nGreat for outreach services and felt-need topics. Risk: turning the sermon into life-coaching with a verse on top. Stay anchored in the text.',
    v: [
      ['John 4:13-14', 'Jesus said to her, "Everyone who drinks of this water will be thirsty again, but whoever drinks of the water that I will give him will never be thirsty again."'],
      ['Matthew 11:28', 'Come to me, all who labor and are heavy laden, and I will give you rest.'],
      ['Isaiah 55:1-2', '"Come, everyone who thirsts, come to the waters... Why do you spend your money for that which is not bread, and your labor for that which does not satisfy?"'],
    ]
  },
  { cat: 'Inductive', q: 'Hook–Book–Look–Took (HBLT)',
    a: 'A teaching framework popularized by Lawrence Richards and used widely in Bible teaching.\n\nStructure:\n1. HOOK — Capture attention; raise the question; create the felt need.\n2. BOOK — Open the Word; explain what the text says, in context.\n3. LOOK — Help them see how the text addresses real life; bridge ancient to modern.\n4. TOOK — Concrete take-away; what will they do this week because of this truth?\n\nClean, memorable, and especially helpful for teaching teams and small groups. Each section should be roughly proportional but Book is the heart.',
    v: [
      ['James 1:22', 'But be doers of the word, and not hearers only, deceiving yourselves.'],
      ['Matthew 7:24-25', 'Everyone then who hears these words of mine and does them will be like a wise man who built his house on the rock.'],
      ['Ezra 7:10', 'For Ezra had set his heart to study the Law of the LORD, and to do it and to teach his statutes and rules in Israel.'],
    ]
  },
  { cat: 'Inductive', q: 'Big Idea Preaching (Haddon Robinson)',
    a: 'Every sermon should have ONE big idea — a single sentence that captures the message of the text and the message of the sermon. Everything supports the big idea.\n\nProcess:\n1. EXEGETICAL IDEA — In one sentence, what is this passage about? (Subject + complement)\n2. HOMILETICAL IDEA — Restate the same truth in a memorable, contemporary sentence.\n3. PURPOSE — What do I want hearers to know, feel, do?\n4. STRUCTURE — What outline best carries this idea to these hearers?\n5. INTRODUCTION & CONCLUSION — Both serve the big idea.\n\nIf you cannot say it in one sentence, you do not yet know your sermon.',
    v: [
      ['Proverbs 25:11', 'A word fitly spoken is like apples of gold in a setting of silver.'],
      ['1 Corinthians 14:8', 'And if the bugle gives an indistinct sound, who will get ready for battle?'],
      ['Matthew 5:37', 'Let what you say be simply "Yes" or "No"; anything more than this comes from evil.'],
    ]
  },
  { cat: 'Special', q: 'Funeral Sermon',
    a: 'Honor the deceased; comfort the grieving; preach the gospel honestly and tenderly.\n\nStructure:\n1. WELCOME & PRAYER — Brief, warm.\n2. SCRIPTURE READING — Psalm 23, John 14, Rom 8:35-39, 1 Cor 15, or Rev 21 are classics.\n3. TRIBUTE — Honor the person honestly; share specific memories.\n4. TEACHING — Open the text; speak about life, death, and eternity through the lens of the resurrection.\n5. GOSPEL CALL — The grave is open today; do not assume your hearers are ready.\n6. PRAYER & BENEDICTION — Lead the family in committing their loved one and their grief to Christ.\n\nLength: typically 15–20 minutes. Avoid extravagant claims about the eternal state of the deceased; trust God and speak with hope and humility.',
    v: [
      ['1 Thessalonians 4:13-14', 'We do not want you to be uninformed, brothers, about those who are asleep, that you may not grieve as others do who have no hope.'],
      ['John 11:25-26', 'I am the resurrection and the life. Whoever believes in me, though he die, yet shall he live.'],
      ['Revelation 14:13', 'Blessed are the dead who die in the Lord from now on. "Blessed indeed," says the Spirit, "that they may rest from their labors, for their deeds follow them!"'],
    ]
  },
  { cat: 'Special', q: 'Wedding Homily',
    a: 'Brief (8–12 minutes), pastoral, gospel-saturated.\n\nStructure:\n1. WELCOME & WHY WE GATHER — Marriage is a covenant before God.\n2. WORD OF SCRIPTURE — Eph 5, 1 Cor 13, or a passage chosen by the couple.\n3. CHARGE TO THE COUPLE — Specific, kind, biblical: love, sacrifice, forgive, persevere.\n4. THE GREATER MARRIAGE — Point to Christ and the church; this marriage is a sign.\n5. CHARGE TO THE CONGREGATION — Family and friends, support this covenant.\n6. PRAYER OF BLESSING.\n\nKeep the focus on God\u2019s design, not on roast or celebrity-speech humor. The bride and groom will remember the gospel you preach over them.',
    v: [
      ['Genesis 2:24', 'Therefore a man shall leave his father and his mother and hold fast to his wife, and they shall become one flesh.'],
      ['Ephesians 5:31-32', '"Therefore a man shall leave his father and mother and hold fast to his wife, and the two shall become one flesh." This mystery is profound, and I am saying that it refers to Christ and the church.'],
      ['1 Corinthians 13:4-7', 'Love is patient and kind... Love bears all things, believes all things, hopes all things, endures all things.'],
    ]
  },
];

function _renderTemplates(body) { _renderAccordion(body, BM_TEMPLATES, 'bm-tmpl', 'Search by structure, occasion, or keyword…', 'Structure', 'Scripture'); }

// ─────────────────────────────────────────────────────────────
// Shared accordion renderer (Creeds / Words / Templates)
// ─────────────────────────────────────────────────────────────
function _renderAccordion(body, dataset, prefix, placeholder, answerLabel, scriptureLabel) {
  const cats = {};
  dataset.forEach((it, i) => { (cats[it.cat] = cats[it.cat] || []).push({ ...it, _i: i }); });
  const catNames = Object.keys(cats);
  body.innerHTML = `
    <input type="text" class="bm-tool-input" id="${prefix}-search" placeholder="${_e(placeholder)}">
    <div id="${prefix}-list" style="display:flex;flex-direction:column;gap:14px;margin-top:6px;"></div>
  `;
  const list = _qs(prefix + '-list');
  function paint(query) {
    const q = (query || '').trim().toLowerCase();
    let html = '';
    catNames.forEach(cat => {
      const items = cats[cat].filter(it => {
        if (!q) return true;
        return (it.q + ' ' + it.a + ' ' + it.cat).toLowerCase().includes(q)
          || it.v.some(([ref, txt]) => (ref + ' ' + txt).toLowerCase().includes(q));
      });
      if (!items.length) return;
      html += `<div><div class="bm-apol-cat">${_e(cat)}</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;">`;
      items.forEach(it => {
        const versesHtml = it.v.map(([ref, txt]) => `
          <div class="bm-apol-verse">
            <strong>${_e(ref)}</strong>
            <span>${_e(txt)}</span>
            <a href="${_bibleGatewayUrl(ref)}" target="_blank" rel="noopener">Open on BibleGateway →</a>
          </div>`).join('');
        // preserve newlines in answer text
        const answerHtml = _e(it.a).replace(/\n/g, '<br>');
        html += `
          <div class="bm-apol-card" data-idx="${it._i}">
            <button type="button" class="bm-apol-q" data-toggle="${it._i}">
              <span>${_e(it.q)}</span>
              <span class="bm-apol-chev">›</span>
            </button>
            <div class="bm-apol-body">
              <div class="bm-apol-section">${_e(answerLabel)}</div>
              <div class="bm-apol-answer">${answerHtml}</div>
              <div class="bm-apol-section">${_e(scriptureLabel)}</div>
              <div class="bm-apol-verses">${versesHtml}</div>
            </div>
          </div>`;
      });
      html += `</div></div>`;
    });
    if (!html) html = `<div class="bm-tool-empty">No matches.</div>`;
    list.innerHTML = html;
  }
  paint('');
  _qs(prefix + '-search').addEventListener('input', e => paint(e.target.value));
  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;
    const card = btn.closest('.bm-apol-card');
    if (card) card.classList.toggle('is-open');
  });
}


// ─────────────────────────────────────────────────────────────
// PRAYERS & LITURGIES — historic Christian prayers
// ─────────────────────────────────────────────────────────────
const BM_PRAYERS = [
  // ── THE LORD'S PRAYER ──
  { cat: 'The Lord\u2019s Prayer', q: 'The Lord\u2019s Prayer (traditional)',
    a: 'Our Father, who art in heaven, hallowed be thy name. Thy kingdom come, thy will be done, on earth as it is in heaven. Give us this day our daily bread, and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation, but deliver us from evil. For thine is the kingdom, and the power, and the glory, for ever and ever. Amen.',
    v: [
      ['Matthew 6:9-13', 'Pray then like this: "Our Father in heaven, hallowed be your name. Your kingdom come, your will be done, on earth as it is in heaven..."'],
      ['Luke 11:2-4', 'And he said to them, "When you pray, say: \'Father, hallowed be your name. Your kingdom come...\'"'],
    ]
  },

  // ── DAILY PRAYER ──
  { cat: 'Daily Prayer', q: 'Morning Prayer (BCP, condensed)',
    a: 'O Lord, our heavenly Father, almighty and everlasting God, you have safely brought us to the beginning of this day: defend us in the same with your mighty power; and grant that this day we fall into no sin, neither run into any kind of danger; but that all our doings, being ordered by your governance, may be righteous in your sight; through Jesus Christ our Lord. Amen.',
    v: [
      ['Psalm 5:3', 'O LORD, in the morning you hear my voice; in the morning I prepare a sacrifice for you and watch.'],
      ['Lamentations 3:22-23', 'The steadfast love of the LORD never ceases; his mercies never come to an end; they are new every morning.'],
    ]
  },
  { cat: 'Daily Prayer', q: 'Evening Prayer / Compline',
    a: 'Be present, O merciful God, and protect us through the hours of this night, so that we who are wearied by the changes and chances of this life may rest in your eternal changelessness; through Jesus Christ our Lord. Amen.\n\nKeep watch, dear Lord, with those who work, or watch, or weep this night, and give your angels charge over those who sleep. Tend the sick, Lord Christ; give rest to the weary, bless the dying, soothe the suffering, pity the afflicted, shield the joyous; and all for your love\u2019s sake. Amen.',
    v: [
      ['Psalm 4:8', 'In peace I will both lie down and sleep; for you alone, O LORD, make me dwell in safety.'],
      ['Psalm 121:3-4', 'He will not let your foot be moved; he who keeps you will not slumber. Behold, he who keeps Israel will neither slumber nor sleep.'],
    ]
  },
  { cat: 'Daily Prayer', q: 'Prayer of St. Patrick (excerpt — the Lorica)',
    a: 'Christ with me, Christ before me, Christ behind me,\nChrist in me, Christ beneath me, Christ above me,\nChrist on my right, Christ on my left,\nChrist when I lie down, Christ when I sit down, Christ when I arise,\nChrist in the heart of every man who thinks of me,\nChrist in the mouth of every man who speaks of me,\nChrist in every eye that sees me,\nChrist in every ear that hears me. Amen.',
    v: [
      ['Galatians 2:20', 'I have been crucified with Christ. It is no longer I who live, but Christ who lives in me.'],
      ['Colossians 3:11', 'But Christ is all, and in all.'],
    ]
  },
  // ── PASTORAL ──
  { cat: 'Pastoral Prayer', q: 'Prayer for those who suffer',
    a: 'Almighty God, whose Son Jesus Christ lived among us as one acquainted with grief: look with mercy on all who suffer in body, mind, or spirit. Comfort them with the knowledge of your love; lift up those who are bowed down; bind up the broken-hearted; and grant that, in the fellowship of his sufferings, they may find the surpassing peace of his presence; through Jesus Christ our Lord. Amen.',
    v: [
      ['Psalm 34:18', 'The LORD is near to the brokenhearted and saves the crushed in spirit.'],
      ['2 Corinthians 1:3-4', 'Blessed be the God and Father of our Lord Jesus Christ, the Father of mercies and God of all comfort, who comforts us in all our affliction.'],
      ['Isaiah 53:3', 'He was despised and rejected by men, a man of sorrows and acquainted with grief.'],
    ]
  },
  { cat: 'Pastoral Prayer', q: 'Prayer for the sick',
    a: 'O God, the source of all health: so fill our hearts with faith in your love that, with calm expectancy, we may make room for your power to possess us, and gracious purpose to work in our healing; for the sake of Jesus Christ our Lord. Amen.',
    v: [
      ['James 5:14-15', 'Is anyone among you sick? Let him call for the elders of the church, and let them pray over him, anointing him with oil in the name of the Lord. And the prayer of faith will save the one who is sick, and the Lord will raise him up.'],
      ['Psalm 103:2-3', 'Bless the LORD, O my soul, and forget not all his benefits, who forgives all your iniquity, who heals all your diseases.'],
    ]
  },
  { cat: 'Pastoral Prayer', q: 'Prayer at a time of decision',
    a: 'O God, by whom the meek are guided in judgment, and light rises up in darkness for the godly: grant us, in all our doubts and uncertainties, the grace to ask what you would have us do; that the spirit of wisdom may save us from all false choices, and that in your light we may see light, and in your straight path may not stumble; through Jesus Christ our Lord. Amen.',
    v: [
      ['James 1:5', 'If any of you lacks wisdom, let him ask God, who gives generously to all without reproach, and it will be given him.'],
      ['Proverbs 3:5-6', 'Trust in the LORD with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths.'],
    ]
  },
  { cat: 'Pastoral Prayer', q: 'Prayer of confession (general)',
    a: 'Most merciful God, we confess that we have sinned against you in thought, word, and deed, by what we have done, and by what we have left undone. We have not loved you with our whole heart; we have not loved our neighbors as ourselves. We are truly sorry and we humbly repent. For the sake of your Son Jesus Christ, have mercy on us and forgive us; that we may delight in your will, and walk in your ways, to the glory of your Name. Amen.',
    v: [
      ['1 John 1:9', 'If we confess our sins, he is faithful and just to forgive us our sins and to cleanse us from all unrighteousness.'],
      ['Psalm 51:1-2', 'Have mercy on me, O God, according to your steadfast love; according to your abundant mercy blot out my transgressions. Wash me thoroughly from my iniquity, and cleanse me from my sin!'],
      ['Psalm 32:5', 'I acknowledged my sin to you, and I did not cover my iniquity; I said, "I will confess my transgressions to the LORD," and you forgave the iniquity of my sin.'],
    ]
  },

  // ── BENEDICTIONS ──
  { cat: 'Benedictions', q: 'The Aaronic Blessing',
    a: 'The LORD bless you and keep you;\nthe LORD make his face to shine upon you and be gracious to you;\nthe LORD lift up his countenance upon you and give you peace. Amen.',
    v: [
      ['Numbers 6:24-26', 'The LORD bless you and keep you; the LORD make his face to shine upon you and be gracious to you; the LORD lift up his countenance upon you and give you peace.'],
    ]
  },
  { cat: 'Benedictions', q: 'Pauline Benediction (2 Cor 13:14)',
    a: 'The grace of the Lord Jesus Christ, and the love of God, and the fellowship of the Holy Spirit be with you all. Amen.',
    v: [
      ['2 Corinthians 13:14', 'The grace of the Lord Jesus Christ and the love of God and the fellowship of the Holy Spirit be with you all.'],
    ]
  },
  { cat: 'Benedictions', q: 'The Hebrews Benediction (Heb 13:20-21)',
    a: 'Now may the God of peace, who brought again from the dead our Lord Jesus, the great Shepherd of the sheep, by the blood of the eternal covenant, equip you with everything good that you may do his will, working in us that which is pleasing in his sight, through Jesus Christ, to whom be glory forever and ever. Amen.',
    v: [
      ['Hebrews 13:20-21', 'Now may the God of peace who brought again from the dead our Lord Jesus, the great shepherd of the sheep, by the blood of the eternal covenant, equip you with everything good that you may do his will.'],
    ]
  },
  { cat: 'Benedictions', q: 'The Jude Doxology',
    a: 'Now to him who is able to keep you from stumbling and to present you blameless before the presence of his glory with great joy, to the only God, our Savior, through Jesus Christ our Lord, be glory, majesty, dominion, and authority, before all time and now and forever. Amen.',
    v: [
      ['Jude 1:24-25', 'Now to him who is able to keep you from stumbling and to present you blameless before the presence of his glory with great joy.'],
    ]
  },
  { cat: 'Benedictions', q: 'The Romans Doxology (Rom 11:33-36)',
    a: 'Oh, the depth of the riches and wisdom and knowledge of God! How unsearchable are his judgments and how inscrutable his ways! For who has known the mind of the Lord, or who has been his counselor? For from him and through him and to him are all things. To him be glory forever. Amen.',
    v: [
      ['Romans 11:33-36', 'Oh, the depth of the riches and wisdom and knowledge of God!... For from him and through him and to him are all things. To him be glory forever. Amen.'],
    ]
  },

  // ── COMMUNION ──
  { cat: 'Communion / Eucharist', q: 'Sursum Corda (Lift up your hearts)',
    a: 'Minister: The Lord be with you.\nPeople: And also with you.\nMinister: Lift up your hearts.\nPeople: We lift them to the Lord.\nMinister: Let us give thanks to the Lord our God.\nPeople: It is right to give him thanks and praise.',
    v: [
      ['Lamentations 3:41', 'Let us lift up our hearts and hands to God in heaven.'],
      ['Psalm 95:1-2', 'Oh come, let us sing to the LORD; let us make a joyful noise to the rock of our salvation! Let us come into his presence with thanksgiving.'],
    ]
  },
  { cat: 'Communion / Eucharist', q: 'Words of Institution',
    a: 'On the night in which he was betrayed, our Lord Jesus took bread, and when he had given thanks, he broke it, and gave it to his disciples, saying: "Take, eat; this is my body, which is given for you. Do this in remembrance of me."\n\nIn the same way, after supper, he took the cup, and when he had given thanks, he gave it to them, saying: "Drink from this, all of you; this cup is the new covenant in my blood, shed for you and for many for the forgiveness of sins. Do this, as often as you drink it, in remembrance of me."',
    v: [
      ['1 Corinthians 11:23-26', 'For I received from the Lord what I also delivered to you, that the Lord Jesus on the night when he was betrayed took bread...'],
      ['Matthew 26:26-28', 'Now as they were eating, Jesus took bread, and after blessing it broke it and gave it to the disciples, and said, "Take, eat; this is my body."'],
    ]
  },
  { cat: 'Communion / Eucharist', q: 'Agnus Dei (Lamb of God)',
    a: 'Lamb of God, you take away the sin of the world, have mercy on us.\nLamb of God, you take away the sin of the world, have mercy on us.\nLamb of God, you take away the sin of the world, grant us your peace. Amen.',
    v: [
      ['John 1:29', 'The next day he saw Jesus coming toward him, and said, "Behold, the Lamb of God, who takes away the sin of the world!"'],
      ['Revelation 5:12', 'Worthy is the Lamb who was slain, to receive power and wealth and wisdom and might and honor and glory and blessing!'],
    ]
  },

  // ── BAPTISM ──
  { cat: 'Baptism', q: 'Trinitarian Baptismal Formula',
    a: '[Name], I baptize you in the name of the Father, and of the Son, and of the Holy Spirit. Amen.',
    v: [
      ['Matthew 28:19', 'Go therefore and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit.'],
      ['Acts 2:38', 'Repent and be baptized every one of you in the name of Jesus Christ for the forgiveness of your sins.'],
    ]
  },
  { cat: 'Baptism', q: 'Baptismal Vows (renunciation & confession)',
    a: 'Question: Do you renounce the devil and all his works?\nAnswer: I renounce them.\n\nQuestion: Do you renounce the empty promises and deadly deceits of this world?\nAnswer: I renounce them.\n\nQuestion: Do you renounce the sinful desires of the flesh?\nAnswer: I renounce them.\n\nQuestion: Do you turn to Jesus Christ and accept him as your Savior?\nAnswer: I do.\n\nQuestion: Do you put your whole trust in his grace and love?\nAnswer: I do.\n\nQuestion: Do you promise to follow and obey him as your Lord?\nAnswer: I do.',
    v: [
      ['Romans 6:3-4', 'Do you not know that all of us who have been baptized into Christ Jesus were baptized into his death? We were buried therefore with him by baptism into death, in order that, just as Christ was raised from the dead by the glory of the Father, we too might walk in newness of life.'],
      ['Galatians 3:27', 'For as many of you as were baptized into Christ have put on Christ.'],
    ]
  },

  // ── LITURGICAL YEAR (collects) ──
  { cat: 'Collects (Church Year)', q: 'Collect for Advent 1',
    a: 'Almighty God, give us grace to cast away the works of darkness and put on the armor of light, now in the time of this mortal life in which your Son Jesus Christ came to visit us in great humility; that on the last day, when he shall come again in his glorious majesty to judge both the living and the dead, we may rise to the life immortal; through him who lives and reigns with you and the Holy Spirit, one God, now and forever. Amen.',
    v: [
      ['Romans 13:11-12', 'Besides this you know the time, that the hour has come for you to wake from sleep... let us cast off the works of darkness and put on the armor of light.'],
    ]
  },
  { cat: 'Collects (Church Year)', q: 'Collect for Christmas',
    a: 'Almighty God, you have given us your only-begotten Son to take our nature upon him, and to be born this day of a pure virgin: grant that we, who have been born again and made your children by adoption and grace, may daily be renewed by your Holy Spirit; through our Lord Jesus Christ, to whom with you and the same Spirit be honor and glory, now and forever. Amen.',
    v: [
      ['John 1:14', 'And the Word became flesh and dwelt among us, and we have seen his glory, glory as of the only Son from the Father, full of grace and truth.'],
      ['Galatians 4:4-5', 'But when the fullness of time had come, God sent forth his Son, born of woman, born under the law, to redeem those who were under the law, so that we might receive adoption as sons.'],
    ]
  },
  { cat: 'Collects (Church Year)', q: 'Collect for Ash Wednesday',
    a: 'Almighty and everlasting God, you hate nothing you have made and forgive the sins of all who are penitent: create and make in us new and contrite hearts, that we, worthily lamenting our sins and acknowledging our wretchedness, may obtain of you, the God of all mercy, perfect remission and forgiveness; through Jesus Christ our Lord. Amen.',
    v: [
      ['Joel 2:12-13', '"Yet even now," declares the LORD, "return to me with all your heart, with fasting, with weeping, and with mourning..."'],
      ['Psalm 51:17', 'The sacrifices of God are a broken spirit; a broken and contrite heart, O God, you will not despise.'],
    ]
  },
  { cat: 'Collects (Church Year)', q: 'Collect for Good Friday',
    a: 'Almighty God, we pray you graciously to behold this your family, for whom our Lord Jesus Christ was willing to be betrayed, and given into the hands of sinners, and to suffer death upon the cross; who now lives and reigns with you and the Holy Spirit, one God, for ever and ever. Amen.',
    v: [
      ['Isaiah 53:5', 'But he was pierced for our transgressions; he was crushed for our iniquities; upon him was the chastisement that brought us peace, and with his wounds we are healed.'],
      ['1 Peter 2:24', 'He himself bore our sins in his body on the tree, that we might die to sin and live to righteousness. By his wounds you have been healed.'],
    ]
  },
  { cat: 'Collects (Church Year)', q: 'Collect for Easter Day',
    a: 'Almighty God, who through your only-begotten Son Jesus Christ overcame death and opened to us the gate of everlasting life: grant that we, who celebrate with joy the day of the Lord\u2019s resurrection, may be raised from the death of sin by your life-giving Spirit; through Jesus Christ our Lord, who lives and reigns with you and the Holy Spirit, one God, now and forever. Amen.',
    v: [
      ['1 Corinthians 15:20', 'But in fact Christ has been raised from the dead, the firstfruits of those who have fallen asleep.'],
      ['Romans 6:4', 'We were buried therefore with him by baptism into death, in order that, just as Christ was raised from the dead... we too might walk in newness of life.'],
    ]
  },
  { cat: 'Collects (Church Year)', q: 'Collect for Pentecost',
    a: 'O God, who on this day taught the hearts of your faithful people by sending to them the light of your Holy Spirit: grant us by the same Spirit to have a right judgment in all things, and evermore to rejoice in his holy comfort; through the merits of Christ Jesus our Savior, who lives and reigns with you, in the unity of the same Spirit, one God, for ever and ever. Amen.',
    v: [
      ['Acts 2:1-4', 'When the day of Pentecost arrived, they were all together in one place. And suddenly there came from heaven a sound like a mighty rushing wind...'],
      ['John 14:26', 'But the Helper, the Holy Spirit, whom the Father will send in my name, he will teach you all things and bring to your remembrance all that I have said to you.'],
    ]
  },

  // ── PRAYERS BEFORE MINISTRY ──
  { cat: 'Before Ministry', q: 'Prayer before preaching',
    a: 'Lord Jesus Christ, you are the living Word and the Word made flesh. As I open the Scriptures and stand before your people, may I decrease and you increase. Open my mouth, fill it with your truth, and let nothing of myself stand between your sheep and your voice. Make me faithful to the text, fearless before the faces of men, and tender toward the souls you have redeemed by your blood. May this hour bear fruit that remains, for the glory of your name. Amen.',
    v: [
      ['John 3:30', 'He must increase, but I must decrease.'],
      ['1 Peter 4:11', 'Whoever speaks, as one who speaks oracles of God; whoever serves, as one who serves by the strength that God supplies — in order that in everything God may be glorified through Jesus Christ.'],
      ['Colossians 1:28-29', 'Him we proclaim, warning everyone and teaching everyone with all wisdom, that we may present everyone mature in Christ.'],
    ]
  },
  { cat: 'Before Ministry', q: 'Prayer before reading Scripture (Illumination)',
    a: 'Blessed Lord, who caused all holy Scriptures to be written for our learning: grant us so to hear them, read, mark, learn, and inwardly digest them, that, by patience and the comfort of your holy Word, we may embrace and ever hold fast the blessed hope of everlasting life, which you have given us in our Savior Jesus Christ. Amen.\n\n— Thomas Cranmer, BCP 1549',
    v: [
      ['Psalm 119:18', 'Open my eyes, that I may behold wondrous things out of your law.'],
      ['Luke 24:32', 'Did not our hearts burn within us while he talked to us on the road, while he opened to us the Scriptures?'],
      ['John 16:13', 'When the Spirit of truth comes, he will guide you into all the truth.'],
    ]
  },
];

function _renderPrayers(body) { _renderAccordion(body, BM_PRAYERS, 'bm-pray', 'Search prayers, occasions, or keywords…', 'Prayer', 'Scripture'); }

// ─────────────────────────────────────────────────────────────
// VOICES OF THE CHURCH — quotes from Fathers, Reformers, Puritans, modern preachers
// ─────────────────────────────────────────────────────────────
const BM_VOICES = [
  // ── REFORMATION ──
  { cat: 'Reformation', q: 'Martin Luther (1483–1546)',
    a: '"Here I stand. I can do no other. God help me. Amen." — Diet of Worms, 1521\n\n"A safe stronghold our God is still, a trusty shield and weapon." — A Mighty Fortress\n\n"Pray, and let God worry."\n\n"The Bible is alive, it speaks to me; it has feet, it runs after me; it has hands, it lays hold of me."\n\n"To be a Christian without prayer is no more possible than to be alive without breathing."\n\n"If you preach the Gospel in all aspects with the exception of the issues which deal specifically with your time, you are not preaching the Gospel at all."',
    v: [
      ['Romans 1:17', 'For in it the righteousness of God is revealed from faith for faith, as it is written, "The righteous shall live by faith."'],
      ['Psalm 46:1', 'God is our refuge and strength, a very present help in trouble.'],
    ]
  },
  { cat: 'Reformation', q: 'John Calvin (1509–1564)',
    a: '"There is not one blade of grass, there is no color in this world that is not intended to make us rejoice." — Sermons on Job\n\n"All wisdom worth having is comprised under two parts — the knowledge of God, and of ourselves." — Institutes 1.1.1\n\n"My heart I offer to you, Lord, promptly and sincerely." (Cor meum tibi offero, Domine, prompte et sincere) — his personal seal\n\n"Wherever we cast our eyes, all things they meet are works of God." — Institutes',
    v: [
      ['Psalm 19:1', 'The heavens declare the glory of God, and the sky above proclaims his handiwork.'],
      ['Proverbs 9:10', 'The fear of the LORD is the beginning of wisdom, and the knowledge of the Holy One is insight.'],
    ]
  },
  { cat: 'Reformation', q: 'John Knox (c. 1514–1572)',
    a: '"Give me Scotland, or I die!" — attributed prayer\n\n"A man with God is always in the majority."\n\n"You cannot antagonize and influence at the same time."',
    v: [
      ['Romans 8:31', 'What then shall we say to these things? If God is for us, who can be against us?'],
      ['Acts 4:31', 'And when they had prayed, the place in which they were gathered together was shaken, and they were all filled with the Holy Spirit and continued to speak the word of God with boldness.'],
    ]
  },

  // ── PURITANS ──
  { cat: 'Puritans', q: 'John Owen (1616–1683)',
    a: '"Be killing sin, or it will be killing you." — Mortification of Sin\n\n"There is no death of sin without the death of Christ." — Mortification of Sin\n\n"It is the Holy Ghost that effectually presseth the Word upon the soul, that makes it to be a converting word."\n\n"A minister may fill his pews, his communion roll, the mouths of the public, but what that minister is on his knees in secret before God Almighty, that he is and no more."',
    v: [
      ['Romans 8:13', 'For if you live according to the flesh you will die, but if by the Spirit you put to death the deeds of the body, you will live.'],
      ['Colossians 3:5', 'Put to death therefore what is earthly in you: sexual immorality, impurity, passion, evil desire, and covetousness, which is idolatry.'],
    ]
  },
  { cat: 'Puritans', q: 'Richard Baxter (1615–1691)',
    a: '"I preached as never sure to preach again, and as a dying man to dying men." — Poetical Fragments\n\n"In necessary things, unity; in doubtful things, liberty; in all things, charity." (often attributed)\n\n"Take heed to yourselves, lest your example contradict your doctrine, and lest you lay such stumbling-blocks before the blind, as may be the occasion of their ruin." — The Reformed Pastor',
    v: [
      ['1 Timothy 4:16', 'Keep a close watch on yourself and on the teaching. Persist in this, for by so doing you will save both yourself and your hearers.'],
      ['Acts 20:28', 'Pay careful attention to yourselves and to all the flock, in which the Holy Spirit has made you overseers, to care for the church of God.'],
    ]
  },
  { cat: 'Puritans', q: 'Thomas Watson (c. 1620–1686)',
    a: '"The angels above us, and the worms below us, praise God; and shall we be silent?"\n\n"Repentance is a grace of God\u2019s Spirit whereby a sinner is inwardly humbled and visibly reformed." — The Doctrine of Repentance\n\n"Till sin be bitter, Christ will not be sweet."\n\n"A holy life is a voice; it speaks when the tongue is silent, and is either a constant attraction or a perpetual reproof."',
    v: [
      ['2 Corinthians 7:10', 'For godly grief produces a repentance that leads to salvation without regret.'],
      ['Matthew 5:16', 'Let your light shine before others, so that they may see your good works and give glory to your Father who is in heaven.'],
    ]
  },
  { cat: 'Puritans', q: 'John Bunyan (1628–1688)',
    a: '"You have not lived today until you have done something for someone who can never repay you."\n\n"Prayer is a shield to the soul, a sacrifice to God, and a scourge for Satan."\n\n"In prayer it is better to have a heart without words than words without a heart." — Pilgrim\u2019s Progress\n\n"He who runs from God in the morning will scarcely find him the rest of the day."',
    v: [
      ['Hebrews 13:16', 'Do not neglect to do good and to share what you have, for such sacrifices are pleasing to God.'],
      ['Psalm 5:3', 'O LORD, in the morning you hear my voice; in the morning I prepare a sacrifice for you and watch.'],
    ]
  },

  // ── MODERN (18th–20th century) ──
  { cat: 'Modern', q: 'Jonathan Edwards (1703–1758)',
    a: '"Resolved, that I will live so as I shall wish I had done when I come to die." — Resolution 17 (age 19)\n\n"Resolved, never to lose one moment of time; but improve it the most profitable way I possibly can." — Resolution 5\n\n"The seeking of the kingdom of God is the chief business of the Christian life."\n\n"All the changes which are wrought in the souls of the godly are wrought in them by means of the Word of God." — Religious Affections',
    v: [
      ['Psalm 90:12', 'So teach us to number our days that we may get a heart of wisdom.'],
      ['Matthew 6:33', 'But seek first the kingdom of God and his righteousness, and all these things will be added to you.'],
    ]
  },
  { cat: 'Modern', q: 'Charles Spurgeon (1834–1892) — "The Prince of Preachers"',
    a: '"A Bible that\u2019s falling apart usually belongs to someone who isn\u2019t."\n\n"Anxiety does not empty tomorrow of its sorrows, but only empties today of its strength."\n\n"It is not great faith, but true faith, that saves; and the salvation lies not in the faith, but in the Christ in whom faith trusts."\n\n"I have learned to kiss the wave that throws me against the Rock of Ages."\n\n"Discernment is not knowing the difference between right and wrong. It is knowing the difference between right and almost right."\n\n"If sinners be damned, at least let them leap to hell over our dead bodies. And if they perish, let them perish with our arms wrapped about their knees, imploring them to stay."',
    v: [
      ['Matthew 6:34', 'Therefore do not be anxious about tomorrow, for tomorrow will be anxious for itself.'],
      ['1 Corinthians 9:22', 'I have become all things to all people, that by all means I might save some.'],
    ]
  },
  { cat: 'Modern', q: 'D. L. Moody (1837–1899)',
    a: '"The world has yet to see what God will do with and for and through and in and by the man who is fully consecrated to him." (the line that ignited his ministry)\n\n"Character is what you are in the dark."\n\n"Out of one hundred men, one will read the Bible, the ninety-nine will read the Christian."\n\n"If I could relive my life, I would devote my entire ministry to reaching children for God."',
    v: [
      ['Romans 12:1', 'I appeal to you therefore, brothers, by the mercies of God, to present your bodies as a living sacrifice, holy and acceptable to God.'],
      ['Mark 10:14', 'Let the children come to me; do not hinder them, for to such belongs the kingdom of God.'],
    ]
  },
  { cat: 'Modern', q: 'C. S. Lewis (1898–1963)',
    a: '"You can\u2019t go back and change the beginning, but you can start where you are and change the ending."\n\n"I believe in Christianity as I believe that the sun has risen — not only because I see it, but because by it I see everything else." — Is Theology Poetry?\n\n"If we find ourselves with a desire that nothing in this world can satisfy, the most probable explanation is that we were made for another world." — Mere Christianity\n\n"Aim at heaven and you will get earth thrown in. Aim at earth and you get neither." — Mere Christianity\n\n"A man can no more diminish God\u2019s glory by refusing to worship him than a lunatic can put out the sun by scribbling the word \'darkness\' on the walls of his cell." — The Problem of Pain\n\n"Either this man was, and is, the Son of God: or else a madman or something worse." — Mere Christianity (the Trilemma)',
    v: [
      ['Ecclesiastes 3:11', 'He has made everything beautiful in its time. Also, he has put eternity into man\u2019s heart.'],
      ['Colossians 3:2', 'Set your minds on things that are above, not on things that are on earth.'],
    ]
  },
  { cat: 'Modern', q: 'A. W. Tozer (1897–1963)',
    a: '"What comes into our minds when we think about God is the most important thing about us." — The Knowledge of the Holy\n\n"To have found God and still to pursue Him is the soul\u2019s paradox of love." — The Pursuit of God\n\n"If the Holy Spirit was withdrawn from the church today, 95 percent of what we do would go on and no one would know the difference. If the Holy Spirit had been withdrawn from the New Testament church, 95 percent of what they did would stop, and everybody would know the difference."',
    v: [
      ['Psalm 27:4', 'One thing have I asked of the LORD, that will I seek after: that I may dwell in the house of the LORD all the days of my life, to gaze upon the beauty of the LORD and to inquire in his temple.'],
      ['Acts 1:8', 'But you will receive power when the Holy Spirit has come upon you.'],
    ]
  },
  { cat: 'Modern', q: 'Dietrich Bonhoeffer (1906–1945)',
    a: '"Cheap grace is the deadly enemy of our church. We are fighting today for costly grace." — The Cost of Discipleship\n\n"When Christ calls a man, he bids him come and die." — The Cost of Discipleship\n\n"Silence in the face of evil is itself evil: God will not hold us guiltless. Not to speak is to speak. Not to act is to act."\n\n"The Church is the Church only when it exists for others."\n\n"He who loves his dream of community more than the Christian community itself becomes a destroyer of the latter." — Life Together',
    v: [
      ['Luke 9:23', 'And he said to all, "If anyone would come after me, let him deny himself and take up his cross daily and follow me."'],
      ['Galatians 2:20', 'I have been crucified with Christ. It is no longer I who live, but Christ who lives in me.'],
    ]
  },
  { cat: 'Modern', q: 'Corrie ten Boom (1892–1983)',
    a: '"There is no pit so deep that God\u2019s love is not deeper still." (often quoted from her sister Betsie at Ravensbrück)\n\n"Worry does not empty tomorrow of its sorrow; it empties today of its strength."\n\n"Forgiveness is to set a prisoner free, and to realize the prisoner was you."\n\n"Never be afraid to trust an unknown future to a known God."',
    v: [
      ['Romans 8:38-39', 'For I am sure that neither death nor life... nor anything else in all creation, will be able to separate us from the love of God in Christ Jesus our Lord.'],
      ['Ephesians 4:32', 'Be kind to one another, tenderhearted, forgiving one another, as God in Christ forgave you.'],
    ]
  },
  { cat: 'Modern', q: 'Elisabeth Elliot (1926–2015)',
    a: '"He is no fool who gives what he cannot keep to gain what he cannot lose." — quoting her husband Jim Elliot\n\n"God\u2019s training is for now, not for then. His purpose is for this very minute, not for sometime in the future."\n\n"The fact that I am a woman does not make me a different kind of Christian, but the fact that I am a Christian does make me a different kind of woman."\n\n"Don\u2019t dig up in doubt what you planted in faith."',
    v: [
      ['Matthew 16:25', 'For whoever would save his life will lose it, but whoever loses his life for my sake will find it.'],
      ['Philippians 1:21', 'For to me to live is Christ, and to die is gain.'],
    ]
  },
  { cat: 'Modern', q: 'A. W. Pink (1886–1952)',
    a: '"The Lord is good to all His creatures, but especially to those who are His sons by faith in Christ Jesus."\n\n"Faith is opposite to sight. Where there is sight, there is no need for faith. Faith is the eye of the soul that sees the invisible."\n\n"The Christian life is not a playground; it is a battleground."',
    v: [
      ['2 Corinthians 5:7', 'For we walk by faith, not by sight.'],
      ['Ephesians 6:12', 'For we do not wrestle against flesh and blood, but against the rulers, against the authorities... against the spiritual forces of evil in the heavenly places.'],
    ]
  },
  { cat: 'Modern', q: 'J. I. Packer (1926–2020)',
    a: '"Knowing God is a matter of personal involvement — mind, will, and feeling. It would not, indeed, be a fully personal relationship otherwise." — Knowing God\n\n"The Christian\u2019s motto should not be \'Let go and let God\' but \'Trust God and get going!\'"\n\n"The popular image of God as a smiling father indulging his children\u2019s every whim is a flat denial of the biblical revelation."',
    v: [
      ['John 17:3', 'And this is eternal life, that they know you, the only true God, and Jesus Christ whom you have sent.'],
      ['Hebrews 12:6', 'For the Lord disciplines the one he loves, and chastises every son whom he receives.'],
    ]
  },
  { cat: 'Modern', q: 'Tim Keller (1950–2023)',
    a: '"The gospel is this: We are more sinful and flawed in ourselves than we ever dared believe, yet at the very same time we are more loved and accepted in Jesus Christ than we ever dared hope."\n\n"To be loved but not known is comforting but superficial. To be known and not loved is our greatest fear. But to be fully known and truly loved is, well, a lot like being loved by God." — The Meaning of Marriage\n\n"Idolatry is not just a failure to obey God, it is a setting of the whole heart on something besides God." — Counterfeit Gods\n\n"Religion says, \'I obey, therefore I am accepted.\' The gospel says, \'I am accepted, therefore I obey.\'"',
    v: [
      ['Romans 5:8', 'But God shows his love for us in that while we were still sinners, Christ died for us.'],
      ['1 John 5:21', 'Little children, keep yourselves from idols.'],
    ]
  },
  { cat: 'Modern', q: 'Billy Graham (1918–2018)',
    a: '"The greatest legacy one can pass on to one\u2019s children and grandchildren is not money or other material things accumulated in one\u2019s life, but rather a legacy of character and faith."\n\n"My home is in Heaven. I\u2019m just traveling through this world."\n\n"Someday you will read or hear that Billy Graham is dead. Don\u2019t you believe a word of it. I shall be more alive than I am now."\n\n"The Bible is God\u2019s ‘Love Letter\' to us, telling us not only that He loves us, but showing us what He has done to demonstrate His love."',
    v: [
      ['2 Corinthians 5:8', 'We are of good courage, and we would rather be away from the body and at home with the Lord.'],
      ['Philippians 3:20', 'But our citizenship is in heaven, and from it we await a Savior, the Lord Jesus Christ.'],
    ]
  },
  { cat: 'Modern', q: 'Martyn Lloyd-Jones (1899–1981)',
    a: '"Have you realized that most of your unhappiness in life is due to the fact that you are listening to yourself instead of talking to yourself?" — Spiritual Depression\n\n"Preaching is theology coming through a man who is on fire."\n\n"The first thing we have to learn about the Holy Spirit is that we cannot use Him; it is He who must use us."\n\n"What is the chief end of preaching? I like to think it is this: It is to give men and women a sense of God and His presence."',
    v: [
      ['Psalm 42:5', 'Why are you cast down, O my soul, and why are you in turmoil within me? Hope in God; for I shall again praise him.'],
      ['Acts 1:8', 'But you will receive power when the Holy Spirit has come upon you.'],
    ]
  },

  // ── CONTEMPORARY ──
  { cat: 'Contemporary', q: 'John MacArthur (b. 1939)',
    a: '"The highest, most noble pursuit of life is the knowledge of God."\n\n"Faithfulness in the small things is what God uses to display His glory through us."\n\n"The Bible is not a book of human ideas about God, but a book of God\'s ideas about human beings."\n\n"You have no greater priority than to know God."\n\n"The pulpit is the Throne for the Word of God."',
    v: [
      ['2 Timothy 4:2', 'Preach the word; be ready in season and out of season; reprove, rebuke, and exhort, with complete patience and teaching.'],
      ['Philippians 3:8', 'I count everything as loss because of the surpassing worth of knowing Christ Jesus my Lord.'],
    ]
  },
  { cat: 'Contemporary', q: 'Greg Laurie (b. 1952)',
    a: '"God\'s plan for your life far exceeds the circumstances of your day."\n\n"The proof that you are a Christian is that you live like a Christian."\n\n"You can\'t change the past, but you can change the future."\n\n"If God has called you to be a witness, do not stoop to be a king."\n\n"The greatest evidence of the existence of God is those who know Him."',
    v: [
      ['Acts 1:8', 'But you will receive power when the Holy Spirit has come upon you, and you will be my witnesses in Jerusalem and in all Judea and Samaria, and to the end of the earth.'],
      ['Mark 16:15', 'Go into all the world and proclaim the gospel to the whole creation.'],
    ]
  },
  { cat: 'Contemporary', q: 'Chuck Smith (1927–2013)',
    a: '"The Bible is meant to be bread for daily use, not cake for special occasions."\n\n"God always gives His best to those who leave the choice with Him."\n\n"Let\'s just teach the Word of God simply, all the way through, from cover to cover." — on Calvary Chapel\'s verse-by-verse method\n\n"The Holy Spirit will never lead you contrary to the Word of God."\n\n"When God closes a door, He always opens a window."',
    v: [
      ['2 Timothy 3:16-17', 'All Scripture is breathed out by God and profitable for teaching, for reproof, for correction, and for training in righteousness.'],
      ['Acts 20:27', 'For I did not shrink from declaring to you the whole counsel of God.'],
    ]
  },
  { cat: 'Contemporary', q: 'Paul Washer (b. 1961)',
    a: '"A real Christian is someone whose love for God is greater than their love for themselves and for the things of this world."\n\n"It is the greatest of all impertinences for any man to lay claim to a saving knowledge of God who hates his brother."\n\n"You cannot pursue holiness apart from the Word of God. It will not happen."\n\n"The greatest heresy in the American evangelical and Protestant church is that if you pray and ask Jesus Christ to come into your heart, He will definitely come in."\n\n"Brethren, we must preach the doctrines; we must emphasize the doctrines; we must go back to the doctrines. I fear that the new generation does not know the doctrines as our forefathers knew them."',
    v: [
      ['Matthew 7:21-23', 'Not everyone who says to me, "Lord, Lord," will enter the kingdom of heaven, but the one who does the will of my Father who is in heaven.'],
      ['1 John 2:3-4', 'And by this we know that we have come to know him, if we keep his commandments.'],
    ]
  },
];

function _renderVoices(body) { _renderAccordion(body, BM_VOICES, 'bm-voice', 'Search by name, era, topic, or keyword…', 'Quotes', 'Scripture'); }
