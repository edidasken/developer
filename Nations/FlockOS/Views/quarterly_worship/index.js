/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: QUARTERLY WORSHIP PLANNER
   Full-featured spreadsheet grid with quarter navigation, Sunday auto-generation,
   per-service field editing, calendar views, and push/pull to service plans.
   "Sing unto the LORD a new song." — Psalm 96:1
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';
import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';

export const name  = 'quarterly_worship';
export const title = 'Quarterly Worship';

// ── Constants ────────────────────────────────────────────────────────────────
const FIELDS       = ['serviceTime','psalm','worship','announce','prayer','preacher','scripture','proverb','notes','sermonId'];
const QLIST        = ['Q1','Q2','Q3','Q4'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Module state ─────────────────────────────────────────────────────────────
const S = { rows: [], importedIds: {}, dirty: false, saveTimer: null, sermons: [] };
let _calMode  = 'grid';
let _calDate  = new Date();
let _activeDow = -1;
let _root = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function _e(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function mkRow(date) {
  return { id: uid(), date: date || '', serviceTime: '', psalm: '', worship: '',
    announce: '', prayer: '', preacher: '', scripture: '', proverb: '', notes: '', sermonId: '' };
}
function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function friendlyDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function qMonths(q) {
  return { Q1: [0,1,2], Q2: [3,4,5], Q3: [6,7,8], Q4: [9,10,11] }[q] || [0,1,2];
}
function quarterSundays(year, q) {
  const months = qMonths(q), sundays = [];
  months.forEach(m => {
    let d = new Date(year, m, 1);
    while (d.getDay() !== 0) d = new Date(year, m, d.getDate() + 1);
    while (d.getMonth() === m) { sundays.push(isoDate(d)); d = new Date(year, m, d.getDate() + 7); }
  });
  return sundays.sort();
}
function sundaysFromFirst(firstIso, year, q) {
  const months = qMonths(q);
  const qStart = new Date(year, months[0], 1);
  const qEnd   = new Date(year, months[months.length - 1] + 1, 0);
  const d = new Date(firstIso + 'T00:00:00'), sundays = [];
  while (d <= qEnd) { if (d >= qStart) sundays.push(isoDate(d)); d.setDate(d.getDate() + 7); }
  return sundays;
}

// ── Summary ───────────────────────────────────────────────────────────────────
function updateSummary() {
  if (!_root) return;
  const sm = k => _root.querySelector(`[data-sm="${k}"]`);
  if (sm('total'))   sm('total').textContent   = S.rows.length;
  if (sm('preach'))  sm('preach').textContent  = S.rows.filter(r => r.preacher.trim()).length;
  if (sm('worship')) sm('worship').textContent = S.rows.filter(r => r.worship.trim()).length;
  if (sm('full'))    sm('full').textContent    = S.rows.filter(r => r.date && r.worship.trim() && r.preacher.trim() && r.scripture.trim()).length;
  if (sm('synced'))  sm('synced').textContent  = Object.keys(S.importedIds).length;
  const rowCt = _root.querySelector('[data-rowct]');
  if (rowCt) rowCt.textContent = S.rows.length + (S.rows.length === 1 ? ' Sunday' : ' Sundays');
}

// ── Q nav label ───────────────────────────────────────────────────────────────
function updateQNavLabel() {
  if (!_root) return;
  const q = _root.querySelector('[data-qf="q"]')?.value || 'Q1';
  const y = _root.querySelector('[data-qf="y"]')?.value || new Date().getFullYear();
  const el = _root.querySelector('[data-qnavlabel]');
  if (el) el.textContent = `${q} ${y}`;
}

// ── Grid render ───────────────────────────────────────────────────────────────
function renderGrid() {
  if (!_root) return;
  const tbody = _root.querySelector('[data-tbody]');
  if (!tbody) return;
  const filtered = _activeDow === -1 ? S.rows : S.rows.filter(r => {
    if (!r.date) return true;
    const [y, m, d] = r.date.split('-').map(Number);
    return new Date(y, m - 1, d).getDay() === _activeDow;
  });
  if (!filtered.length) {
    tbody.innerHTML = `<tr class="qwp-empty-row"><td colspan="13">No rows yet — click ⟳ Generate to populate Sundays, or + Row to add one.</td></tr>`;
    updateSummary(); return;
  }
  tbody.innerHTML = filtered.map(row => {
    const pushed = !!S.importedIds[row.id];
    return `<tr class="${pushed ? 'is-pushed' : ''}" data-rid="${_e(row.id)}">
      <td><input class="qwp-cell-input" type="date"   data-field="date"        value="${_e(row.date)}"></td>
      <td><input class="qwp-cell-input" type="text"   data-field="serviceTime" value="${_e(row.serviceTime)}" placeholder="10 AM"></td>
      <td><input class="qwp-cell-input" type="text"   data-field="psalm"       value="${_e(row.psalm)}"       placeholder="Psalm 100"></td>
      <td><input class="qwp-cell-input" type="text"   data-field="worship"     value="${_e(row.worship)}"     placeholder="Worship leader"></td>
      <td><input class="qwp-cell-input" type="text"   data-field="announce"    value="${_e(row.announce)}"    placeholder="MC / emcee"></td>
      <td><input class="qwp-cell-input" type="text"   data-field="prayer"      value="${_e(row.prayer)}"      placeholder="Prayer"></td>
      <td><input class="qwp-cell-input" type="text"   data-field="preacher"    value="${_e(row.preacher)}"    placeholder="Preacher"></td>
      <td><input class="qwp-cell-input" type="text"   data-field="scripture"   value="${_e(row.scripture)}"   placeholder="Scripture"></td>
      <td><input class="qwp-cell-input" type="text"   data-field="proverb"     value="${_e(row.proverb)}"     placeholder="Proverb"></td>
      <td><input class="qwp-cell-input" type="text"   data-field="notes"       value="${_e(row.notes)}"       placeholder="Theme / notes"></td>
      <td><select class="qwp-cell-input" data-field="sermonId" style="max-width:160px">
        <option value="">— sermon —</option>
        ${S.sermons.map(sr => `<option value="${_e(sr.id)}"${row.sermonId===sr.id?' selected':''}>${_e(sr.title||'Untitled')}${sr.date?' ('+friendlyDate(sr.date)+')':''}</option>`).join('')}
      </select></td>
      <td style="text-align:center"><input type="checkbox" class="qwp-push-ck" data-id="${_e(row.id)}" ${pushed ? 'checked' : ''}></td>
      <td><div class="qwp-row-actions">
        <button class="qwp-row-btn"     data-dup="${_e(row.id)}" title="Duplicate row">⧉</button>
        <button class="qwp-row-btn del" data-del="${_e(row.id)}" title="Delete row">✕</button>
      </div></td>
    </tr>`;
  }).join('');
  updateSummary();
}

// ── Save status ───────────────────────────────────────────────────────────────
function setStatus(state, msg) {
  if (!_root) return;
  const dot = _root.querySelector('[data-syncdot]');
  const txt = _root.querySelector('[data-syncmsg]');
  if (dot) dot.className = 'qwp-sync-dot' + (state ? ` ${state}` : '');
  if (txt) txt.textContent = msg || '';
}

// ── Dirty tracking ────────────────────────────────────────────────────────────
function markDirty() {
  S.dirty = true; setStatus('pending', 'Unsaved changes');
  _saveLocal();
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(() => _saveToFirestore(true), 1400);
}

// ── localStorage ──────────────────────────────────────────────────────────────
function _draftKey() {
  const q = _root?.querySelector('[data-qf="q"]')?.value || 'Q1';
  const y = _root?.querySelector('[data-qf="y"]')?.value || new Date().getFullYear();
  return `flockos_qwp_${q}_${y}`;
}
function _saveLocal() {
  try {
    if (!_root) return;
    const payload = {
      q:  _root.querySelector('[data-qf="q"]')?.value,
      y:  _root.querySelector('[data-qf="y"]')?.value,
      st: _root.querySelector('[data-qf="st"]')?.value,
      fs: _root.querySelector('[data-qf="fs"]')?.value,
      at: new Date().toISOString(),
      rows: S.rows, importedIds: S.importedIds
    };
    localStorage.setItem(`flockos_qwp_local_${_draftKey()}`, JSON.stringify(payload));
  } catch(e) { /* storage full */ }
}
function _loadLocal() {
  try { const raw = localStorage.getItem(`flockos_qwp_local_${_draftKey()}`); return raw ? JSON.parse(raw) : null; }
  catch(e) { return null; }
}
function _clearLocal() { try { localStorage.removeItem(`flockos_qwp_local_${_draftKey()}`); } catch(e) {} }
function _fmtTs(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch(e) { return ''; }
}

// ── Firestore save/load ────────────────────────────────────────────────────────
function _planRef() {
  if (typeof firebase === 'undefined' || !firebase.firestore) return null;
  return firebase.firestore().collection('quarterlyPlans').doc(_draftKey());
}
async function _saveToFirestore(auto) {
  const ref = _planRef();
  if (!ref) { _saveLocal(); setStatus('error', 'Firestore unavailable — saved locally'); return; }
  try {
    setStatus('pending', 'Saving…');
    if (!_root) return;
    const ts = new Date().toISOString();
    await ref.set({
      q:  _root.querySelector('[data-qf="q"]')?.value,
      y:  _root.querySelector('[data-qf="y"]')?.value,
      st: _root.querySelector('[data-qf="st"]')?.value,
      fs: _root.querySelector('[data-qf="fs"]')?.value,
      at: ts, rows: S.rows, importedIds: S.importedIds
    });
    S.dirty = false; _clearLocal();
    setStatus('ready', '✓ Saved · ' + _fmtTs(ts));
    if (!auto) _toast('Saved ✓', 'success');
  } catch(e) {
    _saveLocal(); setStatus('error', '✗ Save failed — saved locally');
    if (!auto) _toast('Save failed — your work is saved locally', 'error');
  }
}
function _applyPlanData(p) {
  if (!_root) return;
  if (p.q  && _root.querySelector('[data-qf="q"]'))  _root.querySelector('[data-qf="q"]').value  = p.q;
  if (p.y  && _root.querySelector('[data-qf="y"]'))  _root.querySelector('[data-qf="y"]').value  = p.y;
  if (p.st && _root.querySelector('[data-qf="st"]')) _root.querySelector('[data-qf="st"]').value = p.st;
  if (_root.querySelector('[data-qf="fs"]')) _root.querySelector('[data-qf="fs"]').value = p.fs || '';
  S.rows = (p.rows || []).map(r => { const nr = mkRow(r.date); Object.assign(nr, r); if (!nr.id) nr.id = uid(); return nr; });
  S.importedIds = p.importedIds || {};
  updateQNavLabel(); renderGrid(); S.dirty = false;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function _toast(msg, type = 'info') {
  if (typeof window._flockToast === 'function') { window._flockToast(msg, type); return; }
  let el = document.querySelector('.qwp-toast-el');
  if (!el) {
    el = document.createElement('div'); el.className = 'qwp-toast-el';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:8px;font:600 0.85rem var(--font-ui,sans-serif);z-index:9999;transition:opacity 0.3s;pointer-events:none';
    document.body.appendChild(el);
  }
  const c = { success: '#059669', error: '#dc2626', info: '#6b7280', warning: '#d97706' };
  el.style.background = c[type] || c.info; el.style.color = '#fff'; el.textContent = msg; el.style.opacity = '1';
  clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; }, 3200);
}

// ── Generate ───────────────────────────────────────────────────────────────────
function generate(silent) {
  if (!_root) return;
  const q    = _root.querySelector('[data-qf="q"]')?.value || 'Q1';
  const year = parseInt(_root.querySelector('[data-qf="y"]')?.value, 10) || new Date().getFullYear();
  const first = _root.querySelector('[data-qf="fs"]')?.value || '';
  let sundays;
  if (first) {
    const d = new Date(first + 'T00:00:00');
    if (d.getDay() !== 0) { _toast(`That date is a ${DAYS_SHORT[d.getDay()]} — please pick a Sunday.`, 'error'); return; }
    sundays = sundaysFromFirst(first, year, q);
  } else {
    sundays = quarterSundays(year, q);
  }
  S.rows = sundays.map(iso => mkRow(iso)); S.importedIds = {};
  renderGrid();
  if (!silent) { markDirty(); _toast(`Generated ${S.rows.length} Sundays for ${q} ${year}`, 'success'); }
}

// ── Quarter navigation ─────────────────────────────────────────────────────────
async function navigateQuarter(dir) {
  if (!_root) return;
  if (S.dirty) { _saveLocal(); try { await _saveToFirestore(true); } catch(e) {} }
  let qi = QLIST.indexOf(_root.querySelector('[data-qf="q"]')?.value || 'Q1');
  let yr = parseInt(_root.querySelector('[data-qf="y"]')?.value, 10) || new Date().getFullYear();
  qi += dir;
  if (qi > 3) { qi = 0; yr++; } if (qi < 0) { qi = 3; yr--; }
  _root.querySelector('[data-qf="q"]').value = QLIST[qi];
  _root.querySelector('[data-qf="y"]').value = yr;
  _root.querySelector('[data-qf="fs"]').value = '';
  updateQNavLabel();
  let loaded = false;
  const ref = _planRef();
  if (ref) {
    try { const snap = await ref.get(); if (snap?.exists) { _applyPlanData(snap.data()); loaded = true; setStatus('ready', `✓ Loaded ${QLIST[qi]} ${yr}`); } }
    catch(e) {}
  }
  if (!loaded) {
    const local = _loadLocal();
    if (local?.rows?.length) { _applyPlanData(local); loaded = true; setStatus('ready', 'Loaded from local backup'); }
  }
  if (!loaded) {
    generate(true); S.dirty = false;
    setStatus('ready', `Generated ${QLIST[qi]} ${yr} — no saved data`);
    _toast(`No saved plan for ${QLIST[qi]} ${yr} — generated blank Sundays`, 'info');
  }
}

// ── Row operations ────────────────────────────────────────────────────────────
function addRow(date)  { S.rows.push(mkRow(date || '')); renderGrid(); markDirty(); }
function delRow(id)    {
  if (!confirm('Remove this row?')) return;
  S.rows = S.rows.filter(r => r.id !== id); renderGrid(); markDirty();
}
function dupRow(id)    {
  const src = S.rows.find(r => r.id === id); if (!src) return;
  const copy = mkRow(src.date); FIELDS.forEach(f => copy[f] = src[f]);
  S.rows.splice(S.rows.indexOf(src) + 1, 0, copy); renderGrid(); markDirty();
}
function dupLast()     { if (!S.rows.length) { addRow(); return; } dupRow(S.rows[S.rows.length - 1].id); }

// ── Calendar helpers ──────────────────────────────────────────────────────────
function _calIso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function _calRowsByDate() {
  const m = {};
  S.rows.forEach(r => { if (r.date) { if (!m[r.date]) m[r.date] = []; m[r.date].push(r); } });
  return m;
}
function _calSortedRows() {
  return S.rows.filter(r => r.date).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

function switchCalMode(mode) {
  _calMode = mode;
  if (!_root) return;
  _root.querySelectorAll('.qwp-mode-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const tscroll = _root.querySelector('[data-tscroll]');
  const dowBar  = _root.querySelector('[data-dowbar]');
  const calView = _root.querySelector('[data-calview]');
  const isGrid  = mode === 'grid';
  if (tscroll) tscroll.style.display = isGrid ? '' : 'none';
  if (dowBar)  dowBar.style.display  = isGrid ? '' : 'none';
  if (calView) calView.style.display = isGrid ? 'none' : '';
  if (isGrid) renderGrid(); else _renderCalView();
}

function _renderCalView() {
  const el = _root?.querySelector('[data-calview]');
  if (!el || _calMode === 'grid') return;
  el.innerHTML = '';
  if      (_calMode === 'month')  _calMonth(el);
  else if (_calMode === 'week')   _calWeek(el);
  else if (_calMode === 'day')    _calDay(el);
  else if (_calMode === 'agenda') _calAgenda(el);
}

function _calNavBar(label, prevFn, nextFn) {
  const bar = document.createElement('div'); bar.className = 'qwp-cal-toolbar';
  const prev = document.createElement('button'); prev.className = 'qwp-cal-nav'; prev.textContent = '◀';
  prev.addEventListener('click', () => { prevFn(); _renderCalView(); });
  const today = document.createElement('button'); today.className = 'qwp-cal-today'; today.textContent = 'Today';
  today.addEventListener('click', () => { _calDate = new Date(); _renderCalView(); });
  const lbl = document.createElement('span'); lbl.className = 'qwp-cal-period'; lbl.textContent = label;
  const next = document.createElement('button'); next.className = 'qwp-cal-nav'; next.textContent = '▶';
  next.addEventListener('click', () => { nextFn(); _renderCalView(); });
  bar.appendChild(prev); bar.appendChild(today); bar.appendChild(lbl); bar.appendChild(next);
  return bar;
}

// ── Month view ────────────────────────────────────────────────────────────────
function _calMonth(el) {
  const y = _calDate.getFullYear(), m = _calDate.getMonth();
  el.appendChild(_calNavBar(MONTHS_LONG[m] + ' ' + y,
    () => { _calDate = new Date(y, m - 1, 1); },
    () => { _calDate = new Date(y, m + 1, 1); }
  ));
  const wrap = document.createElement('div'); wrap.className = 'qwp-month';
  const hdr = document.createElement('div'); hdr.className = 'qwp-month-hdr';
  DAYS_SHORT.forEach(d => { const h = document.createElement('div'); h.className = 'qwp-dow-hdr'; h.textContent = d; hdr.appendChild(h); });
  wrap.appendChild(hdr);
  const body = document.createElement('div'); body.className = 'qwp-month-body';
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev  = new Date(y, m, 0).getDate();
  const byDate = _calRowsByDate(), todayIso = _calIso(new Date());
  for (let i = firstDow - 1; i >= 0; i--) {
    const c = document.createElement('div'); c.className = 'qwp-cal-cell other-month';
    const n = document.createElement('span'); n.className = 'qwp-day-num'; n.textContent = daysInPrev - i;
    c.appendChild(n); body.appendChild(c);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const c = document.createElement('div');
    c.className = 'qwp-cal-cell' + (iso === todayIso ? ' is-today' : '');
    const n = document.createElement('span'); n.className = 'qwp-day-num'; n.textContent = d;
    c.appendChild(n);
    (byDate[iso] || []).forEach(row => {
      const isFull = row.worship.trim() && row.preacher.trim() && row.scripture.trim();
      const chip = document.createElement('span');
      chip.className = 'qwp-chip' + (isFull ? ' is-full' : row.preacher.trim() ? ' has-preacher' : '');
      const label = row.preacher || row.worship || row.notes || row.serviceTime || 'Service';
      chip.textContent = label.length > 14 ? label.slice(0, 13) + '…' : label;
      chip.title = [row.serviceTime, row.preacher, row.worship, row.scripture].filter(Boolean).join(' · ');
      chip.addEventListener('click', e => { e.stopPropagation(); _calDate = new Date(iso + 'T00:00:00'); switchCalMode('day'); });
      c.appendChild(chip);
    });
    body.appendChild(c);
  }
  const total = firstDow + daysInMonth, trail = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let t = 1; t <= trail; t++) {
    const c = document.createElement('div'); c.className = 'qwp-cal-cell other-month';
    const n = document.createElement('span'); n.className = 'qwp-day-num'; n.textContent = t;
    c.appendChild(n); body.appendChild(c);
  }
  wrap.appendChild(body); el.appendChild(wrap);
}

// ── Week view ─────────────────────────────────────────────────────────────────
function _calWeek(el) {
  const sow = new Date(_calDate);
  sow.setDate(_calDate.getDate() - _calDate.getDay()); sow.setHours(0, 0, 0, 0);
  const eow = new Date(sow); eow.setDate(sow.getDate() + 6);
  const lbl = MONTHS_SHORT[sow.getMonth()] + ' ' + sow.getDate() + ' – ' +
    (sow.getMonth() !== eow.getMonth() ? MONTHS_SHORT[eow.getMonth()] + ' ' : '') +
    eow.getDate() + ', ' + eow.getFullYear();
  el.appendChild(_calNavBar(lbl,
    () => { _calDate = new Date(_calDate); _calDate.setDate(_calDate.getDate() - 7); },
    () => { _calDate = new Date(_calDate); _calDate.setDate(_calDate.getDate() + 7); }
  ));
  const byDate = _calRowsByDate(), todayIso = _calIso(new Date());
  const wrap = document.createElement('div'); wrap.className = 'qwp-week';
  const hdrGrid  = document.createElement('div'); hdrGrid.className  = 'qwp-week-grid';
  const bodyGrid = document.createElement('div'); bodyGrid.className = 'qwp-week-grid';
  for (let i = 0; i < 7; i++) {
    const day = new Date(sow); day.setDate(sow.getDate() + i);
    const iso = _calIso(day), isToday = iso === todayIso;
    const hdr = document.createElement('div');
    hdr.className = 'qwp-week-col-hdr' + (isToday ? ' is-today' : '');
    hdr.innerHTML = `<div style="font-size:.60rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted)">${DAYS_SHORT[day.getDay()]}</div>
      <div style="font-size:1.05rem;font-weight:800;line-height:1.1">${day.getDate()}</div>
      <div style="font-size:.60rem;color:var(--ink-muted)">${MONTHS_SHORT[day.getMonth()]}</div>`;
    hdrGrid.appendChild(hdr);
    const cell = document.createElement('div');
    cell.className = 'qwp-week-cell' + (isToday ? ' is-today' : '');
    (byDate[iso] || []).forEach(row => cell.appendChild(_calServiceCard(row, true)));
    bodyGrid.appendChild(cell);
  }
  wrap.appendChild(hdrGrid); wrap.appendChild(bodyGrid); el.appendChild(wrap);
}

// ── Day view ──────────────────────────────────────────────────────────────────
function _calDay(el) {
  const iso    = _calIso(_calDate);
  const dayLbl = _calDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  el.appendChild(_calNavBar(dayLbl,
    () => { _calDate = new Date(_calDate); _calDate.setDate(_calDate.getDate() - 1); },
    () => { _calDate = new Date(_calDate); _calDate.setDate(_calDate.getDate() + 1); }
  ));
  const body = document.createElement('div'); body.className = 'qwp-day-body';
  const rows = (_calRowsByDate()[iso] || []);
  if (!rows.length) {
    const empty = document.createElement('div'); empty.className = 'qwp-cal-empty';
    empty.innerHTML = '<div style="font-size:2rem;margin-bottom:8px">📅</div>No services scheduled for this day.';
    body.appendChild(empty);
  } else { rows.forEach(row => body.appendChild(_calServiceCard(row, false))); }
  el.appendChild(body);
}

// ── Agenda view ───────────────────────────────────────────────────────────────
function _calAgenda(el) {
  const bar = document.createElement('div'); bar.className = 'qwp-cal-toolbar';
  bar.innerHTML = `<span style="font-weight:700;color:var(--ink)">All Services — Agenda</span>
    <span style="font-size:.76rem;color:var(--ink-muted);margin-left:auto">${S.rows.filter(r => r.date).length} scheduled</span>`;
  el.appendChild(bar);
  const sorted = _calSortedRows();
  if (!sorted.length) {
    const empty = document.createElement('div'); empty.className = 'qwp-cal-empty'; empty.style.padding = '40px';
    empty.innerHTML = '<div style="font-size:2rem;margin-bottom:8px">📋</div>No services with dates yet. Generate or add rows in Grid view.';
    el.appendChild(empty); return;
  }
  const wrap = document.createElement('div'); wrap.className = 'qwp-agenda';
  const byMonth = {};
  sorted.forEach(row => { const key = row.date.slice(0, 7); if (!byMonth[key]) byMonth[key] = []; byMonth[key].push(row); });
  Object.keys(byMonth).sort().forEach(key => {
    const [ky, km] = key.split('-');
    const group = document.createElement('div'); group.className = 'qwp-agenda-group';
    const lbl = document.createElement('div'); lbl.className = 'qwp-agenda-month-lbl';
    lbl.textContent = MONTHS_LONG[parseInt(km, 10) - 1] + ' ' + ky;
    group.appendChild(lbl);
    byMonth[key].forEach(row => {
      const [ry, rm, rd] = row.date.split('-').map(Number);
      const d = new Date(ry, rm - 1, rd);
      const isFull = row.worship.trim() && row.preacher.trim() && row.scripture.trim();
      const item = document.createElement('div');
      item.className = 'qwp-agenda-item' + (isFull ? ' is-full' : '');
      item.addEventListener('click', () => { _calDate = new Date(row.date + 'T00:00:00'); switchCalMode('day'); });
      const dateDiv = document.createElement('div'); dateDiv.className = 'qwp-agenda-date';
      dateDiv.innerHTML = `<div class="qwp-ad-dow">${DAYS_SHORT[d.getDay()]}</div><div class="qwp-ad-day">${rd}</div><div class="qwp-ad-mon">${MONTHS_SHORT[rm - 1]}</div>`;
      const infoDiv = document.createElement('div'); infoDiv.className = 'qwp-agenda-info';
      const aTitle = row.notes || (row.preacher ? 'Message by ' + row.preacher : row.worship ? 'Worship: ' + row.worship : 'Service');
      const sub = [row.preacher && ('🎤 ' + row.preacher), row.worship && ('🎵 ' + row.worship), row.scripture && ('📖 ' + row.scripture)].filter(Boolean).join('  ·  ');
      infoDiv.innerHTML = (row.serviceTime ? `<div class="qwp-ai-time">⏰ ${_e(row.serviceTime)}</div>` : '') +
        `<div class="qwp-ai-title">${_e(aTitle)}</div>` + (sub ? `<div class="qwp-ai-sub">${_e(sub)}</div>` : '');
      item.appendChild(dateDiv); item.appendChild(infoDiv); group.appendChild(item);
    });
    wrap.appendChild(group);
  });
  el.appendChild(wrap);
}

// ── Service card (week & day views) ──────────────────────────────────────────
function _calServiceCard(row, compact) {
  const isFull = row.worship.trim() && row.preacher.trim() && row.scripture.trim();
  const card = document.createElement('div');
  card.className = 'qwp-service-card' + (isFull ? ' is-full' : '');
  if (row.serviceTime) {
    const td = document.createElement('div'); td.className = 'qwp-sc-time'; td.textContent = '⏰ ' + row.serviceTime;
    card.appendChild(td);
  }
  if (compact) {
    const p = document.createElement('div');
    p.style.cssText = 'font-size:.72rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)';
    p.textContent = [row.preacher, row.worship, row.scripture || row.notes].filter(Boolean).join(' · ') || 'Service';
    card.appendChild(p);
  } else {
    [{ l: 'Preacher',  v: row.preacher  }, { l: 'Scripture', v: row.scripture },
     { l: 'Worship',   v: row.worship   }, { l: 'Prayer',    v: row.prayer    },
     { l: 'Psalm',     v: row.psalm     }, { l: 'Proverb',   v: row.proverb   },
     { l: 'Announce',  v: row.announce  }, { l: 'Theme',     v: row.notes     }
    ].forEach(({ l, v }) => {
      if (!v?.trim()) return;
      const r = document.createElement('div'); r.className = 'qwp-sc-row';
      r.innerHTML = `<span class="qwp-sc-label">${l}</span><span>${_e(v)}</span>`;
      card.appendChild(r);
    });
  }
  return card;
}

// ── Push to Service Plans ─────────────────────────────────────────────────────
function _buildPayload(row, svcType, isUpdate) {
  const p = { serviceDate: row.date, serviceType: svcType, status: 'Scheduled' };
  const map = { serviceTime: 'serviceTime', notes: 'theme', psalm: 'psalmReader',
    scripture: 'scriptureFocus', worship: 'worshipLeader', preacher: 'preacher',
    announce: 'announcements', prayer: 'prayer', proverb: 'proverb' };
  Object.keys(map).forEach(rowKey => {
    const val = (row[rowKey] || '').trim();
    if (val || !isUpdate) p[map[rowKey]] = val;
  });
  if (row.sermonId) p.sermonId = row.sermonId;
  return p;
}

async function _doPush(rows, svcType, onProgress) {
  const V = window.TheVine;
  if (!V) throw new Error('Service plans backend not available');
  const MX = buildAdapter('flock.servicePlans', V);
  const q    = _root?.querySelector('[data-qf="q"]')?.value || 'Q1';
  const year = parseInt(_root?.querySelector('[data-qf="y"]')?.value, 10) || new Date().getFullYear();
  const months = qMonths(q);
  const qStart = year + '-' + String(months[0] + 1).padStart(2, '0') + '-01';
  const lastM  = months[months.length - 1];
  const lastDay = new Date(year, lastM + 1, 0).getDate();
  const qEnd   = year + '-' + String(lastM + 1).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
  const byDate = {};
  try {
    const existing = await MX.list({ startDate: qStart, endDate: qEnd, limit: 200 });
    const arr = Array.isArray(existing) ? existing : (existing?.rows || existing?.data || []);
    arr.forEach(p => { const d = p.serviceDate || p.date || ''; if (d) byDate[d] = p; });
  } catch(e) { /* non-fatal */ }
  let created = 0, updated = 0, skipped = 0, failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (onProgress) onProgress(i, rows.length, row);
    try {
      const ex = byDate[row.date];
      if (ex) {
        const payload = _buildPayload(row, svcType, true); payload.id = ex.id;
        await MX.update(payload); updated++; S.importedIds[row.id] = ex.id;
      } else {
        const payload = _buildPayload(row, svcType, false);
        const res = await MX.create(payload); created++; S.importedIds[row.id] = res?.id || row.id;
      }
    } catch(err) { failed++; }
  }
  return { created, updated, skipped, failed };
}

async function pushPlans() {
  if (!_root) return;
  const checkedIds = {};
  _root.querySelectorAll('.qwp-push-ck:checked').forEach(cb => { checkedIds[cb.dataset.id] = true; });
  const rows = S.rows.filter(r => r.date && checkedIds[r.id]);
  if (!rows.length) { _toast('No rows selected. Check the boxes for rows you want to push.', 'error'); return; }
  const svcType  = _root.querySelector('[data-qf="st"]')?.value || 'Sunday AM';
  const overlay  = _root.querySelector('[data-pushoverlay]');
  const logDiv   = _root.querySelector('[data-pushlog]');
  const prog     = _root.querySelector('[data-pushprog]');
  const closeBtn = _root.querySelector('[data-pushclose]');
  const titleEl  = _root.querySelector('[data-pushtitle]');
  const subEl    = _root.querySelector('[data-pushsub]');
  if (overlay)  overlay.classList.add('open');
  if (logDiv)   logDiv.innerHTML = '';
  if (prog)     prog.style.width = '0%';
  if (closeBtn) closeBtn.style.display = 'none';
  if (titleEl)  titleEl.textContent = 'Pushing to Service Plans…';
  if (subEl)    subEl.textContent   = 'Writing records…';
  function log(msg, cls) {
    if (!logDiv) return;
    const d = document.createElement('div'); d.className = cls || ''; d.textContent = msg;
    logDiv.appendChild(d); logDiv.scrollTop = logDiv.scrollHeight;
  }
  try {
    const result = await _doPush(rows, svcType, (i, total, row) => {
      if (prog) prog.style.width = Math.round(((i + 1) / total) * 100) + '%';
      log((S.importedIds[row.id] ? '✎ ' : '✓ ') + friendlyDate(row.date), 'ok');
    });
    if (prog)    prog.style.width = '100%';
    if (titleEl) titleEl.textContent = 'Done';
    if (subEl)   subEl.textContent   = `${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed.`;
    if (closeBtn) closeBtn.style.display = '';
    renderGrid(); updateSummary(); _saveToFirestore(true);
    _toast(`Pushed ${result.created + result.updated} service plan(s)`, 'success');
  } catch(e) {
    if (titleEl) titleEl.textContent = 'Error';
    if (subEl)   subEl.textContent   = e.message || 'Push failed.';
    if (closeBtn) closeBtn.style.display = '';
    _toast('Push failed: ' + (e.message || 'unknown error'), 'error');
  }
}

// ── Pull from Service Plans ───────────────────────────────────────────────────
async function pullPlans() {
  if (!_root) return;
  const V = window.TheVine;
  if (!V) { _toast('Service plans backend not available.', 'error'); return; }
  const MX = buildAdapter('flock.servicePlans', V);
  const q    = _root.querySelector('[data-qf="q"]')?.value || 'Q1';
  const year = parseInt(_root.querySelector('[data-qf="y"]')?.value, 10) || new Date().getFullYear();
  const months = qMonths(q);
  const qStart = year + '-' + String(months[0] + 1).padStart(2, '0') + '-01';
  const lastM  = months[months.length - 1];
  const lastDay = new Date(year, lastM + 1, 0).getDate();
  const qEnd   = year + '-' + String(lastM + 1).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
  setStatus('pending', 'Loading service plans…');
  let plans = [];
  try {
    const res = await MX.list({ startDate: qStart, endDate: qEnd, limit: 200 });
    const arr = Array.isArray(res) ? res : (res?.rows || res?.data || []);
    plans = arr.filter(p => { const d = p.serviceDate || p.date || ''; return d >= qStart && d <= qEnd; });
  } catch(e) { setStatus('error', 'Pull failed'); _toast('Could not load service plans: ' + (e.message || e), 'error'); return; }
  if (!plans.length) { setStatus('ready', ''); _toast(`No service plans found for ${q} ${year}`, 'info'); return; }
  const byDate = {};
  S.rows.forEach(r => { if (r.date) byDate[r.date] = r; });
  let added = 0, merged = 0;
  plans.forEach(p => {
    const date = p.serviceDate || p.date || '';
    if (!date) return;
    const ex = byDate[date];
    if (ex) {
      if (!ex.notes     && p.theme)          ex.notes     = p.theme;
      if (!ex.psalm     && p.psalmReader)    ex.psalm     = p.psalmReader;
      if (!ex.scripture && p.scriptureFocus) ex.scripture = p.scriptureFocus;
      if (!ex.worship   && p.worshipLeader)  ex.worship   = p.worshipLeader;
      if (!ex.preacher  && p.preacher)       ex.preacher  = p.preacher;
      if (!ex.announce  && p.announcements)  ex.announce  = p.announcements;
      if (!ex.prayer    && p.prayer)         ex.prayer    = p.prayer;
      if (!ex.proverb   && p.proverb)        ex.proverb   = p.proverb;
      merged++;
    } else {
      const nr = mkRow(date);
      nr.notes = p.theme || ''; nr.psalm = p.psalmReader || '';
      nr.scripture = p.scriptureFocus || ''; nr.worship = p.worshipLeader || '';
      nr.preacher = p.preacher || ''; nr.announce = p.announcements || '';
      nr.prayer = p.prayer || ''; nr.proverb = p.proverb || '';
      S.rows.push(nr); byDate[date] = nr; added++;
    }
  });
  S.rows.sort((a, b) => (a.date || '') < (b.date || '') ? -1 : (a.date || '') > (b.date || '') ? 1 : 0);
  renderGrid(); markDirty();
  const msg = [added && `${added} new row${added !== 1 ? 's' : ''} added`, merged && `${merged} merged`].filter(Boolean);
  _toast('Pull complete: ' + (msg.join(', ') || 'nothing to do'), 'success');
  setStatus('ready', '');
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV() {
  if (!_root) return;
  const q  = _root.querySelector('[data-qf="q"]')?.value || 'Q1';
  const yr = _root.querySelector('[data-qf="y"]')?.value || new Date().getFullYear();
  const hdr = ['Date','Service Time','Psalm','Worship Leader','Announcements','Prayer','Preacher','Scripture','Proverb','Theme'];
  const lines = [hdr.join(',')];
  S.rows.forEach(row => {
    const cells = [row.date, row.serviceTime, row.psalm, row.worship, row.announce,
      row.prayer, row.preacher, row.scripture, row.proverb, row.notes]
      .map(v => '"' + (v || '').replace(/"/g, '""') + '"');
    lines.push(cells.join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `FlockOS_${q}_${yr}_Worship.csv`; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  _toast(`Downloaded FlockOS_${q}_${yr}_Worship.csv`, 'success');
}

// ── CSV Import ────────────────────────────────────────────────────────────────
function _normalizeHeader(h) {
  h = (h || '').trim().toLowerCase();
  if (/^date|service\s*date|sunday/i.test(h))           return 'date';
  if (/psalm|introit|call.?to.?worship/i.test(h))       return 'psalm';
  if (/worship|song\s*lead|music/i.test(h))             return 'worship';
  if (/announc|mc|emcee|host/i.test(h))                 return 'announce';
  if (/prayer|pray|intercessi/i.test(h))                return 'prayer';
  if (/preach|speak|serm|pastor|minister/i.test(h))     return 'preacher';
  if (/scripture|text|reading|passage|bible/i.test(h))  return 'scripture';
  if (/proverb/i.test(h))                               return 'proverb';
  if (/service\s*time|time/i.test(h))                   return 'serviceTime';
  if (/note|theme|topic|title|subject/i.test(h))        return 'notes';
  return null;
}
function _parseCSV(text) {
  const raw = text.trim().split(/\r?\n/);
  if (raw.length < 2) return null;
  const sep = raw[0].includes('\t') ? '\t' : ',';
  function splitLine(line) {
    if (sep === '\t') return line.split('\t').map(c => c.trim());
    const cells = []; let cell = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQ)  { inQ = true; continue; }
      if (ch === '"' && inQ)   { if (line[i + 1] === '"') { cell += '"'; i++; } else { inQ = false; } continue; }
      if (ch === ',' && !inQ)  { cells.push(cell.trim()); cell = ''; continue; }
      cell += ch;
    }
    cells.push(cell.trim()); return cells;
  }
  const headers = splitLine(raw[0]).map(_normalizeHeader);
  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    if (!raw[i].trim()) continue;
    const cells = splitLine(raw[i]);
    const row = mkRow('');
    headers.forEach((field, idx) => {
      if (!field) return;
      let val = (cells[idx] || '').replace(/^"|"$/g, '').trim();
      if (field === 'date') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) { row.date = val; return; }
        const dt = new Date(val);
        if (!isNaN(dt)) row.date = isoDate(dt); else row.date = val;
      } else if (FIELDS.indexOf(field) !== -1 || field === 'serviceTime') { row[field] = val; }
    });
    if (row.date || FIELDS.some(f => row[f])) rows.push(row);
  }
  return rows;
}
function _mergeImportedRows(rows) {
  const byDate = {};
  S.rows.forEach(r => { if (r.date) byDate[r.date] = r; });
  let added = 0, updated = 0;
  rows.forEach(r => {
    if (r.date && byDate[r.date]) { FIELDS.forEach(f => { if (r[f]) byDate[r.date][f] = r[f]; }); updated++; }
    else { S.rows.push(r); if (r.date) byDate[r.date] = r; added++; }
  });
  renderGrid(); markDirty();
  _toast(`Imported: ${added} new row${added !== 1 ? 's' : ''}${updated ? ', ' + updated + ' updated' : ''}`, 'success');
}

// ── Manual save ───────────────────────────────────────────────────────────────
async function manualSave() {
  if (!_root) return;
  const btn = _root.querySelector('[data-btn="save"]');
  if (btn) { btn.disabled = true; btn.textContent = '…Saving'; }
  _saveLocal(); await _saveToFirestore(false);
  if (btn) { btn.disabled = false; btn.textContent = '💾 Save'; }
}

// ── render() ──────────────────────────────────────────────────────────────────
export function render() {
  return /* html */`
    <section class="qwp-view">
      ${pageHero({
        title:    'Quarterly Worship',
        subtitle: 'Plan each Sunday — assign preacher, worship, scripture, and more.',
        scripture: 'Sing unto the LORD a new song. — Psalm 96:1',
      })}

      <!-- Header: Q nav + summary stats + save status -->
      <div class="qwp-hdr">
        <div class="qwp-qnav">
          <button class="qwp-qnav-btn" data-btn="prevq">◀</button>
          <span class="qwp-qnav-label" data-qnavlabel>—</span>
          <button class="qwp-qnav-btn" data-btn="nextq">▶</button>
        </div>
        <div class="qwp-summary">
          <span><strong data-sm="total">0</strong> Sundays</span>
          <span><strong data-sm="preach">0</strong> Preacher</span>
          <span><strong data-sm="worship">0</strong> Worship</span>
          <span><strong class="is-full"   data-sm="full">0</strong> Full</span>
          <span><strong class="is-synced" data-sm="synced">0</strong> Synced</span>
        </div>
        <div class="qwp-sync-pill" style="margin-left:auto">
          <span class="qwp-sync-dot" data-syncdot></span>
          <span data-syncmsg>Loading…</span>
        </div>
      </div>

      <!-- Setup card: quarter/year/first-sunday/service-type + action buttons -->
      <div class="qwp-setup">
        <div class="qwp-controls">
          <div class="qwp-field">
            <label class="qwp-label" for="qwpQ">Quarter</label>
            <select id="qwpQ" class="qwp-select" data-qf="q">
              <option value="Q1">Q1 — Jan / Feb / Mar</option>
              <option value="Q2">Q2 — Apr / May / Jun</option>
              <option value="Q3">Q3 — Jul / Aug / Sep</option>
              <option value="Q4">Q4 — Oct / Nov / Dec</option>
            </select>
          </div>
          <div class="qwp-field" style="max-width:90px;flex:0 0 90px">
            <label class="qwp-label" for="qwpY">Year</label>
            <input id="qwpY" class="qwp-input" type="number" min="2020" max="2100" data-qf="y">
          </div>
          <div class="qwp-field">
            <label class="qwp-label" for="qwpFS">First Sunday</label>
            <input id="qwpFS" class="qwp-input" type="date" data-qf="fs" title="Pick the first Sunday of your quarter — all other Sundays auto-populate weekly from this date">
          </div>
          <div class="qwp-field">
            <label class="qwp-label" for="qwpST">Service Type</label>
            <select id="qwpST" class="qwp-select" data-qf="st">
              <option>Sunday AM</option>
              <option>Sunday PM</option>
              <option>Wednesday</option>
              <option>Special</option>
              <option>Good Friday</option>
              <option>Easter</option>
              <option>Christmas</option>
            </select>
          </div>
        </div>
        <div class="qwp-action-row">
          <button class="flock-btn flock-btn--primary" data-btn="gen"    title="Generate Sunday dates for the selected quarter">⟳ Generate</button>
          <button class="flock-btn"                    data-btn="addrow" title="Add a blank row">+ Row</button>
          <button class="flock-btn"                    data-btn="dup"    title="Duplicate the last row">⧉ Dup</button>
          <button class="flock-btn flock-btn--danger"  data-btn="reset"  title="Clear all rows">✕ Reset</button>
          <div class="qwp-divider"></div>
          <button class="flock-btn" data-btn="save"   title="Save draft to cloud">💾 Save</button>
          <button class="flock-btn" data-btn="import" title="Import from CSV file">📥 Import</button>
          <button class="flock-btn" data-btn="export" title="Export as CSV">📤 Export</button>
          <div class="qwp-divider"></div>
          <button class="flock-btn"                   data-btn="pull" title="Pull service plans into this grid">⬇ Pull</button>
          <button class="flock-btn flock-btn--primary" data-btn="push" title="Push checked rows to service plans">⬆ Push</button>
          <input type="file" data-importfile accept=".csv,.tsv,.txt" style="display:none">
        </div>
      </div>

      <!-- Grid card -->
      <div class="qwp-grid-card">
        <div class="qwp-grid-hdr">
          <div class="qwp-grid-hdr-row1">
            <span class="qwp-grid-title">⛪ Schedule Grid</span>
            <span class="qwp-row-count" data-rowct>0 Sundays</span>
            <div class="qwp-mode-bar">
              <button class="qwp-mode-tab active" data-mode="grid"   title="Spreadsheet grid">≡ Grid</button>
              <button class="qwp-mode-tab"         data-mode="month"  title="Month calendar">Month</button>
              <button class="qwp-mode-tab"         data-mode="week"   title="Week calendar">Week</button>
              <button class="qwp-mode-tab"         data-mode="day"    title="Day view">Day</button>
              <button class="qwp-mode-tab"         data-mode="agenda" title="Agenda list">Agenda</button>
            </div>
          </div>
          <div class="qwp-dow-bar" data-dowbar>
            <button class="qwp-dow-btn active" data-dow="-1">All</button>
            <button class="qwp-dow-btn" data-dow="0">Sun</button>
            <button class="qwp-dow-btn" data-dow="1">Mon</button>
            <button class="qwp-dow-btn" data-dow="2">Tue</button>
            <button class="qwp-dow-btn" data-dow="3">Wed</button>
            <button class="qwp-dow-btn" data-dow="4">Thu</button>
            <button class="qwp-dow-btn" data-dow="5">Fri</button>
            <button class="qwp-dow-btn" data-dow="6">Sat</button>
          </div>
        </div>
        <div class="qwp-tscroll" data-tscroll>
          <table class="qwp-table">
            <thead><tr>
              <th style="min-width:130px">Date</th>
              <th style="min-width:90px">Time</th>
              <th style="min-width:110px">Psalm</th>
              <th style="min-width:120px">Worship</th>
              <th style="min-width:120px">Announce</th>
              <th style="min-width:120px">Prayer</th>
              <th style="min-width:120px">Preacher</th>
              <th style="min-width:140px">Scripture</th>
              <th style="min-width:100px">Proverb</th>
              <th style="min-width:140px">Theme</th>
              <th style="min-width:160px">Sermon</th>
              <th style="width:36px;text-align:center"><input type="checkbox" data-ckall title="Select / deselect all for push"></th>
              <th style="width:50px"></th>
            </tr></thead>
            <tbody data-tbody></tbody>
          </table>
        </div>
        <div data-calview style="display:none"></div>
      </div>

      <!-- Push overlay -->
      <div class="qwp-push-overlay" data-pushoverlay>
        <div class="qwp-push-box">
          <div class="qwp-push-title" data-pushtitle>Pushing to Service Plans…</div>
          <div class="qwp-push-sub"   data-pushsub>Writing records…</div>
          <div class="qwp-prog-track"><div class="qwp-prog-fill" data-pushprog style="width:0%"></div></div>
          <div class="qwp-push-log"   data-pushlog></div>
          <button class="flock-btn flock-btn--primary" data-pushclose style="margin-top:16px;display:none">Done</button>
        </div>
      </div>
    </section>`;
}

// ── mount() ───────────────────────────────────────────────────────────────────
export function mount(root) {
  _root = root;
  _calMode   = 'grid';
  _activeDow = -1;
  S.rows = []; S.importedIds = {}; S.dirty = false;

  // Set quarter + year from today
  const now = new Date();
  const m0  = now.getMonth();
  const q0  = m0 < 3 ? 'Q1' : m0 < 6 ? 'Q2' : m0 < 9 ? 'Q3' : 'Q4';
  root.querySelector('[data-qf="q"]').value = q0;
  root.querySelector('[data-qf="y"]').value = now.getFullYear();
  updateQNavLabel();

  // Quarter navigation
  root.querySelector('[data-btn="prevq"]').addEventListener('click', () => navigateQuarter(-1));
  root.querySelector('[data-btn="nextq"]').addEventListener('click', () => navigateQuarter(1));
  root.querySelector('[data-qf="q"]').addEventListener('change', updateQNavLabel);
  root.querySelector('[data-qf="y"]').addEventListener('change', updateQNavLabel);

  // First-sunday validation
  root.querySelector('[data-qf="fs"]').addEventListener('change', function() {
    if (!this.value) return;
    const d = new Date(this.value + 'T00:00:00');
    if (d.getDay() !== 0) { _toast(`That is a ${DAYS_SHORT[d.getDay()]} — please pick a Sunday.`, 'error'); this.value = ''; }
  });

  // Action buttons
  root.querySelector('[data-btn="gen"]').addEventListener('click',    () => generate(false));
  root.querySelector('[data-btn="addrow"]').addEventListener('click', () => addRow());
  root.querySelector('[data-btn="dup"]').addEventListener('click',    dupLast);
  root.querySelector('[data-btn="reset"]').addEventListener('click',  () => {
    if (!confirm('Clear all rows?')) return;
    S.rows = []; S.importedIds = {}; renderGrid(); markDirty();
  });
  root.querySelector('[data-btn="save"]').addEventListener('click',   manualSave);
  root.querySelector('[data-btn="export"]').addEventListener('click', exportCSV);
  root.querySelector('[data-btn="import"]').addEventListener('click', () => root.querySelector('[data-importfile]').click());
  root.querySelector('[data-importfile]').addEventListener('change', function() {
    const file = this.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const rows = _parseCSV(e.target.result);
      if (!rows || !rows.length) { _toast('No data rows found in file.', 'error'); return; }
      _mergeImportedRows(rows);
    };
    reader.readAsText(file); this.value = '';
  });
  root.querySelector('[data-btn="push"]').addEventListener('click', pushPlans);
  root.querySelector('[data-btn="pull"]').addEventListener('click', pullPlans);

  // Select-all checkbox
  root.querySelector('[data-ckall]').addEventListener('change', function() {
    root.querySelectorAll('.qwp-push-ck').forEach(cb => { cb.checked = this.checked; });
  });

  // Calendar mode tabs
  root.querySelector('.qwp-mode-bar').addEventListener('click', e => {
    const btn = e.target.closest('.qwp-mode-tab'); if (!btn) return;
    if (_calMode === 'grid' && S.rows.length && S.rows[0].date) {
      const [fy, fm, fd] = S.rows[0].date.split('-').map(Number);
      _calDate = new Date(fy, fm - 1, fd);
    }
    switchCalMode(btn.dataset.mode);
  });

  // Day-of-week filter
  root.querySelector('[data-dowbar]').addEventListener('click', e => {
    const btn = e.target.closest('.qwp-dow-btn'); if (!btn) return;
    _activeDow = parseInt(btn.dataset.dow, 10);
    root.querySelectorAll('.qwp-dow-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderGrid();
  });

  // Grid body delegation — field edits + row actions
  function _handleCellInput(e) {
    const inp = e.target.closest('.qwp-cell-input'); if (!inp) return;
    const rid   = inp.closest('tr')?.dataset.rid;
    const field = inp.dataset.field;
    if (!rid || !field) return;
    const r = S.rows.find(r => r.id === rid);
    if (r) { r[field] = inp.value; markDirty(); }
  }
  root.querySelector('[data-tbody]').addEventListener('input',  _handleCellInput);
  root.querySelector('[data-tbody]').addEventListener('change', _handleCellInput);
  root.querySelector('[data-tbody]').addEventListener('click', e => {
    const dupBtn = e.target.closest('[data-dup]');
    const delBtn = e.target.closest('[data-del]');
    if (dupBtn) dupRow(dupBtn.dataset.dup);
    if (delBtn) delRow(delBtn.dataset.del);
  });

  // Push overlay close
  root.querySelector('[data-pushclose]').addEventListener('click', () => {
    root.querySelector('[data-pushoverlay]').classList.remove('open');
  });

  // Auto-load plan for current quarter
  setStatus('pending', 'Loading…');
  (async () => {
    const localData = _loadLocal();
    const ref = _planRef();
    if (ref) {
      try {
        const snap = await ref.get();
        if (snap?.exists) {
          const fbData = snap.data();
          if (localData?.at && fbData.at && localData.at > fbData.at) {
            _applyPlanData(localData); setStatus('pending', 'Recovered unsaved changes — syncing…');
            await _saveToFirestore(true);
          } else {
            _applyPlanData(fbData); _clearLocal(); setStatus('ready', '✓ Saved · ' + _fmtTs(fbData.at));
          }
        } else if (localData?.rows?.length) {
          _applyPlanData(localData); setStatus('pending', 'Recovered local data — syncing…');
          await _saveToFirestore(true);
        } else {
          generate(true); S.dirty = false; setStatus('', 'Not yet saved');
        }
      } catch(e) {
        if (localData?.rows?.length) { _applyPlanData(localData); setStatus('error', 'Offline — loaded from local backup'); }
        else { generate(true); setStatus('error', 'Offline — working locally'); }
      }
    } else {
      if (localData?.rows?.length) { _applyPlanData(localData); setStatus('', 'Loaded from local storage'); }
      else { generate(true); S.dirty = false; setStatus('', ''); }
    }
  })();

  // Pre-fetch sermon list for the sermonId dropdowns (best-effort, silent)
  (async () => {
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.listSermons === 'function') {
        const rows = await UR.listSermons({ limit: 200 });
        S.sermons = Array.isArray(rows) ? rows : (rows?.results || rows?.rows || []);
        renderGrid(); // re-render so dropdowns are populated
      }
    } catch (_) { /* non-fatal */ }
  })();

  // Periodic retry when dirty
  const _retryInterval = setInterval(() => {
    if (!S.dirty) return;
    const ref = _planRef(); if (ref) _saveToFirestore(true);
  }, 30000);

  return () => {
    clearInterval(_retryInterval);
    clearTimeout(S.saveTimer);
    if (S.dirty) _saveLocal();
    _root = null;
  };
}
