/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: THE HARVEST — Missions & Kingdom Growth
   "The harvest is plentiful but the workers are few." — Matthew 9:37
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';
import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';

export const name  = 'the_harvest';
export const title = 'Harvest';

let _activeHarvestSheet = null;
let _liveMissMap        = {};
let _liveOutreachMap    = {};

const YEAR = new Date().getFullYear();

const STAT_DEFS = [
  { key: 'decisions', label: 'Decisions for Christ', icon: '✝️', color: 'var(--c-violet)' },
  { key: 'baptisms',  label: 'Baptisms',             icon: '💧', color: 'var(--c-sky)' },
  { key: 'newMembers',label: 'New Members',          icon: '🌱', color: 'var(--c-emerald)' },
  { key: 'contacts',  label: 'Gospel Contacts',      icon: '🌍', color: 'var(--gold)' },
];

export function render() {
  return /* html */`
    <section class="harvest-view">
      ${pageHero({
        title:    'Harvest',
        subtitle: `Missions, evangelism, baptisms, and kingdom growth — ${YEAR} at a glance.`,
        scripture: 'The harvest is plentiful but the workers are few. — Matthew 9:37',
      })}

      <!-- Kingdom stats -->
      <div class="harvest-stats" data-bind="stats">
        ${STAT_DEFS.map(s => `
          <div class="harvest-stat-card" data-stat="${s.key}">
            <div class="harvest-stat-icon">${s.icon}</div>
            <div class="harvest-stat-n" style="color:${s.color}">—</div>
            <div class="harvest-stat-label">${_e(s.label)}</div>
            <div class="harvest-stat-delta">Loading…</div>
          </div>
        `).join('')}
      </div>

      <!-- Missionaries -->
      <div class="way-section-header" style="margin-top:28px;">
        <h2 class="way-section-title">Supported Missionaries</h2>
        <button class="flock-btn flock-btn--ghost">Manage Support</button>
      </div>
      <div class="harvest-missionaries">
        <div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Loading missionaries…</div>
      </div>

      <!-- Local Outreach -->
      <div class="way-section-header" style="margin-top:28px;">
        <h2 class="way-section-title">Local Outreach</h2>
        <button class="flock-btn flock-btn--primary">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          New Effort
        </button>
      </div>
      <div class="harvest-outreach">
        <div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Loading outreach…</div>
      </div>
    </section>
  `;
}

export function mount(root) {
  // New Effort button
  root.querySelectorAll('.flock-btn--primary').forEach(btn => {
    if (btn.textContent.includes('New Effort')) {
      btn.addEventListener('click', () => _openOutreachSheet(null, () => _loadHarvest(root)));
    }
  });
  // Manage Support
  root.querySelectorAll('.flock-btn--ghost').forEach(btn => {
    if (btn.textContent.includes('Manage Support')) {
      btn.addEventListener('click', () => _openMissionarySheet(null, () => _loadHarvest(root)));
    }
  });
  _loadHarvest(root);
  return () => { _closeHarvestSheet(); };
}

async function _loadHarvest(root) {
  const V   = window["TheVine"];
  const MXP = buildAdapter('missions.partners', V);
  const MXR = buildAdapter('missions.registry', V);
  const MXE = buildAdapter('flock.events', V);
  const missionEl  = root.querySelector('.harvest-missionaries');
  const outreachEl = root.querySelector('.harvest-outreach');
  const statsEl    = root.querySelector('[data-bind="stats"]');

  if (!V) {
    if (missionEl)  missionEl.innerHTML  = '<div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Harvest backend not loaded.</div>';
    if (outreachEl) outreachEl.innerHTML = '<div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Harvest backend not loaded.</div>';
    _setAllStats(statsEl, '—', 'Unavailable');
    return;
  }
  // Missionaries — registry may also contain people-group / country records
  // (imported from Joshua Project / Bible Access List). Only treat a record as
  // a supported missionary if it has an actual personal name AND a giving goal.
  if (missionEl) {
    missionEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Loading missionaries…</div>';
    try {
      // Try partners list first (contains supported missionaries / orgs with giving goals),
      // then fall back to registry records that look like personal missionary profiles.
      let missionaries = [];
      const [partnersRes, registryRes] = await Promise.allSettled([
        MXP.list({ limit: 100 }),
        MXR.list().catch(() => null),
      ]);
      if (partnersRes.status === 'fulfilled') {
        const all = _rows(partnersRes.value);
        missionaries = all.filter(m => {
          const hasGoal = Number(m.monthlyGoal || m.monthlyTarget || m.goal || 0) > 0
                       || Number(m.monthlyGiving || m.monthlySupport || m.giving || 0) > 0;
          return hasGoal;
        });
      }
      if (!missionaries.length && registryRes.status === 'fulfilled') {
        const all = _rows(registryRes.value);
        missionaries = all.filter(m => {
          const hasName = !!(m.missionaryName || m.name);
          const hasGoal = Number(m.monthlyGoal || m.goal || 0) > 0
                       || Number(m.monthlyGiving || m.monthlySupport || m.giving || 0) > 0;
          return hasName && hasGoal;
        });
      }
      missionEl.innerHTML = missionaries.length
        ? missionaries
            .slice()
            .sort((a, b) => (a.missionaryName || a.name || '').localeCompare(b.missionaryName || b.name || ''))
            .map(_liveMissionCard).join('')
        : '<div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">No missionary partners on file yet.</div>';
      // Wire edit clicks for live missionaries
      if (missionaries.length) {
        _liveMissMap = {};
        missionaries.forEach(m => { if (m.id) _liveMissMap[String(m.id)] = m; });
        const mReload = () => _loadHarvest(root);
        missionEl.querySelectorAll('.harvest-mission-card[data-id]').forEach(card => {
          card.style.cursor = 'pointer';
          card.addEventListener('click', () => {
            const rec = _liveMissMap[card.dataset.id];
            if (rec) _openMissionarySheet(rec, mReload);
          });
        });
      }
    } catch (err) {
      console.error('[TheHarvest] missions load error:', err);
      missionEl.innerHTML = '<div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Could not load missionary partners.</div>';
    }
  }

  // Local outreach
  if (outreachEl) {
    outreachEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Loading outreach…</div>';
    try {
      const res  = await MXE.list({ limit: 200 });
      const all  = _rows(res);
      // Filter client-side — field may be 'type' or 'eventType'
      const rows = all.filter(r => {
        const t = (r.type || r.eventType || r.category || '').toLowerCase();
        return t.includes('outreach') || t.includes('community') || t.includes('service');
      });
      // Sort newest (most recent start date) first
      const _tsN = (v) => { if (!v) return 0; if (typeof v === 'object' && v.seconds) return v.seconds * 1000; return new Date(v).getTime() || 0; };
      rows.sort((a, b) => _tsN(b.startDate || b.createdAt) - _tsN(a.startDate || a.createdAt));
      outreachEl.innerHTML = rows.length
        ? rows.map(_liveOutreachRow).join('')
        : '<div style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">No outreach events on file.</div>';
      // Wire edit clicks for live outreach
      if (rows.length) {
        _liveOutreachMap = {};
        rows.forEach(r => { if (r.id) _liveOutreachMap[String(r.id)] = r; });
        const oReload = () => _loadHarvest(root);
        outreachEl.querySelectorAll('.harvest-outreach-row[data-id]').forEach(card => {
          card.style.cursor = 'pointer';
          card.addEventListener('click', () => {
            const rec = _liveOutreachMap[card.dataset.id];
            if (rec) _openOutreachSheet(rec, oReload);
          });
        });
      }
    } catch (err) {
      console.error('[TheHarvest] events.list outreach error:', err);
      outreachEl.innerHTML = '<div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Outreach data unavailable.</div>';
    }
  }

  // Kingdom stats — derive from registry where possible
  await _loadHarvestStats(V, statsEl);
}

async function _loadHarvestStats(V, statsEl) {
  if (!statsEl) return;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const qStart    = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1);
  const inRange = (raw, since) => {
    if (!raw) return false;
    const dt = new Date(typeof raw === 'object' && raw.seconds ? raw.seconds * 1000 : raw);
    return dt >= since;
  };

  const [bapRes, decRes, memRes] = await Promise.allSettled([
    V.flock?.baptisms?.list?.({ limit: 500 }),
    V.flock?.decisions?.list?.({ limit: 500 }),
    V.flock?.members?.list?.({ limit: 1000 }),
  ]);

  // Baptisms (year-to-date + quarter delta)
  if (bapRes.status === 'fulfilled') {
    const all = _rows(bapRes.value);
    const ytd = all.filter(b => inRange(b.baptismDate || b.date || b.createdAt, yearStart)).length;
    const qtd = all.filter(b => inRange(b.baptismDate || b.date || b.createdAt, qStart)).length;
    _setStat(statsEl, 'baptisms', String(ytd), qtd ? `+${qtd} this quarter` : 'This year');
  } else { _setStat(statsEl, 'baptisms', '—', 'Unavailable'); }

  // Decisions for Christ
  if (decRes.status === 'fulfilled') {
    const all = _rows(decRes.value);
    const ytd = all.filter(d => inRange(d.decisionDate || d.date || d.createdAt, yearStart)).length;
    const qtd = all.filter(d => inRange(d.decisionDate || d.date || d.createdAt, qStart)).length;
    _setStat(statsEl, 'decisions', String(ytd), qtd ? `+${qtd} this quarter` : 'This year');
  } else { _setStat(statsEl, 'decisions', '—', 'Unavailable'); }

  // New members (this year + this quarter delta)
  if (memRes.status === 'fulfilled') {
    const all = _rows(memRes.value);
    const ytd = all.filter(m => inRange(m.joinDate || m.createdAt, yearStart)).length;
    const qtd = all.filter(m => inRange(m.joinDate || m.createdAt, qStart)).length;
    _setStat(statsEl, 'newMembers', String(ytd), qtd ? `+${qtd} this quarter` : 'This year');
  } else { _setStat(statsEl, 'newMembers', '—', 'Unavailable'); }

  // Gospel contacts — no backend yet, show placeholder
  _setStat(statsEl, 'contacts', '—', 'Track in Outreach');
}

function _setStat(statsEl, key, n, delta) {
  const card = statsEl.querySelector(`[data-stat="${key}"]`);
  if (!card) return;
  const nEl = card.querySelector('.harvest-stat-n');
  const dEl = card.querySelector('.harvest-stat-delta');
  if (nEl) nEl.textContent = n;
  if (dEl) dEl.textContent = delta;
}

function _setAllStats(statsEl, n, delta) {
  if (!statsEl) return;
  STAT_DEFS.forEach(s => _setStat(statsEl, s.key, n, delta));
}

function _rows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

function _liveMissionCard(m) {
  const name    = m.missionaryName || m.name || 'Missionary';
  const region  = m.region || m.country || '';
  const org     = m.organization || m.org || '';
  const giving  = Number(m.monthlyGiving || m.monthlySupport || m.giving || 0);
  const goal    = Number(m.monthlyGoal   || m.goal || giving || 1);
  const pct     = Math.min(100, Math.round((giving / goal) * 100));
  const needs   = giving < goal;
  const initials = name.split(/[&\s]+/).filter(Boolean).map(w => w[0] || '').slice(0,2).join('').toUpperCase();
  return /* html */`
    <article class="harvest-mission-card${needs ? ' harvest-mission--needs' : ''}"${m.id ? ` data-id="${_e(String(m.id))}"` : ''}>
      <div class="harvest-mission-avatar">${initials}</div>
      <div class="harvest-mission-body">
        <div class="harvest-mission-name">${_e(name)}</div>
        <div class="harvest-mission-meta">
          ${region ? `<span>${_e(region)}</span><span>·</span>` : ''}
          ${org    ? `<span>${_e(org)}</span>` : ''}
        </div>
        <div class="harvest-giving-bar">
          <div class="harvest-giving-fill" style="width:${pct}%"></div>
        </div>
        <div class="harvest-giving-label">$${giving}/mo of $${goal}/mo goal (${pct}%)</div>
      </div>
      ${needs ? '<div class="harvest-needs-badge">Needs Support</div>' : ''}
    </article>`;
}

function _liveOutreachRow(o) {
  const title   = o.title || o.name || 'Outreach Event';
  const date    = o.startDate || o.date ? _fmtDate(o.startDate || o.date) : '';
  const team    = o.teamSize || o.volunteers || '';
  const status  = (o.status || 'upcoming').toLowerCase();
  const contacts = o.contacts || o.rsvpCount || '';
  const statusColor = status === 'complete' ? '#059669' : status === 'active' ? '#0ea5e9' : '#e8a838';
  const statusBg    = status === 'complete' ? 'rgba(5,150,105,0.10)' : status === 'active' ? 'rgba(14,165,233,0.10)' : 'rgba(232,168,56,0.13)';
  return /* html */`
    <article class="harvest-outreach-row"${o.id ? ` data-id="${_e(String(o.id))}"` : ''} tabindex="0">
      <div class="harvest-outreach-body">
        <div class="harvest-outreach-title">${_e(title)}</div>
        <div class="harvest-outreach-meta">
          ${date ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> ${_e(date)}` : ''}
          ${team ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="margin-left:8px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> ${_e(String(team))} team` : ''}
          ${contacts ? `<span style="margin-left:8px; color:var(--ink-muted)">${_e(String(contacts))}</span>` : ''}
        </div>
      </div>
      <span class="harvest-outreach-status" style="color:${statusColor}; background:${statusBg}">${status}</span>
    </article>`;
}

function _fmtDate(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch (_) { return String(ts); }
}

function _e(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Harvest sheets (outreach + missionary) ────────────────────────────────
function _closeHarvestSheet() {
  if (!_activeHarvestSheet) return;
  const t = _activeHarvestSheet;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activeHarvestSheet === t) _activeHarvestSheet = null; }, 320);
}

const OUTREACH_STATUSES = ['upcoming', 'active', 'complete', 'cancelled'];

function _openOutreachSheet(ev, onReload) {
  _closeHarvestSheet();
  const V   = window.TheVine;
  const MXE = buildAdapter('flock.events', V);
  const isNew = !ev;
  const uid   = ev?.id ? String(ev.id) : '';
  const title = ev?.title || ev?.name || '';
  const date  = ev?.startDate ? String(ev.startDate).substring(0,10) : '';
  const location  = ev?.location || '';
  const teamSize  = ev?.teamSize || ev?.volunteers || '';
  const status    = ev?.status   || 'upcoming';
  const description = ev?.description || ev?.notes || '';

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isNew ? 'New Outreach Effort' : 'Edit Outreach Effort'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${isNew ? 'New Outreach Effort' : 'Edit Outreach'}</div>
          <div class="life-sheet-hd-meta">${isNew ? 'Log a local evangelism or service event' : _e(title)}</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Effort Title <span style="color:#dc2626">*</span></div>
          <input class="life-sheet-input" data-field="title" type="text" value="${_e(title)}" placeholder="e.g. Downtown Gospel Rally">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Date</div>
          <input class="life-sheet-input" data-field="startDate" type="date" value="${_e(date)}">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Location</div>
          <input class="life-sheet-input" data-field="location" type="text" value="${_e(location)}" placeholder="e.g. Community Park">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Team Size</div>
          <input class="life-sheet-input" data-field="teamSize" type="number" min="1" value="${_e(String(teamSize))}" placeholder="e.g. 12">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Status</div>
          <select class="life-sheet-input" data-field="status">
            ${OUTREACH_STATUSES.map(s => `<option value="${s}"${s === status ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Notes / Description</div>
          <textarea class="life-sheet-input" data-field="description" rows="3" style="resize:vertical" placeholder="Describe the effort, goals, and follow-up…">${_e(description)}</textarea>
        </div>
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        ${!isNew ? '<button class="flock-btn flock-btn--danger" data-delete style="margin-right:auto">Delete Effort</button>' : ''}
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>${isNew ? 'Create Effort' : 'Save Changes'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeHarvestSheet = sheet;

  /** @type {HTMLElement | null} */
  const overlayEl = sheet.querySelector('.life-sheet-overlay');
  /** @type {HTMLElement | null} */
  const panelEl = sheet.querySelector('.life-sheet-panel');
  /** @type {HTMLButtonElement | null} */
  const cancelBtn = sheet.querySelector('[data-cancel]');
  /** @type {HTMLButtonElement | null} */
  const closeBtn = sheet.querySelector('.life-sheet-close');
  /** @type {HTMLElement | null} */
  const errEl = sheet.querySelector('[data-error]');
  /** @type {HTMLInputElement | null} */
  const titleInput = sheet.querySelector('[data-field="title"]');
  /** @type {HTMLButtonElement | null} */
  const saveBtn = sheet.querySelector('[data-save]');
  /** @type {HTMLInputElement | null} */
  const teamSizeInput = sheet.querySelector('[data-field="teamSize"]');
  /** @type {HTMLInputElement | null} */
  const dateInput = sheet.querySelector('[data-field="startDate"]');
  /** @type {HTMLInputElement | null} */
  const locationInput = sheet.querySelector('[data-field="location"]');
  /** @type {HTMLSelectElement | null} */
  const statusInput = sheet.querySelector('[data-field="status"]');
  /** @type {HTMLTextAreaElement | null} */
  const descriptionInput = sheet.querySelector('[data-field="description"]');
  /** @type {HTMLButtonElement | null} */
  const deleteBtn = sheet.querySelector('[data-delete]');

  requestAnimationFrame(() => {
    overlayEl?.classList.add('is-open');
    panelEl?.classList.add('is-open');
    if (isNew) titleInput?.focus();
  });

  const close = () => _closeHarvestSheet();
  cancelBtn?.addEventListener('click', close);
  closeBtn?.addEventListener('click', close);

  saveBtn?.addEventListener('click', async () => {
    const titleVal = titleInput?.value.trim() || '';
    if (!titleVal) {
      if (errEl) {
        errEl.textContent = 'Title is required.';
        errEl.style.display = '';
      }
      return;
    }
    if (!V) {
      if (errEl) {
        errEl.textContent = 'Harvest backend not loaded.';
        errEl.style.display = '';
      }
      return;
    }
    if (errEl) errEl.style.display = 'none';
    saveBtn.disabled = true;
    saveBtn.textContent = isNew ? 'Creating…' : 'Saving…';

    const teamVal = parseFloat(teamSizeInput?.value || '');
    const payload = {
      title: titleVal,
      type: 'Outreach',
      startDate: dateInput?.value || undefined,
      location: locationInput?.value.trim() || undefined,
      teamSize: isNaN(teamVal) ? undefined : teamVal,
      status: statusInput?.value || undefined,
      description: descriptionInput?.value.trim() || undefined,
    };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    if (!isNew) payload.id = uid;
    try {
      if (isNew) { await MXE.create(payload); }
      else       { await MXE.update(payload); }
      _closeHarvestSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheHarvest] outreach save error:', err);
      if (errEl) {
        errEl.textContent = err?.message || 'Could not save.';
        errEl.style.display = '';
      }
      saveBtn.disabled = false;
      saveBtn.textContent = isNew ? 'Create Effort' : 'Save Changes';
    }
  });

  deleteBtn?.addEventListener('click', async () => {
    const ok = confirm(`Delete "${title}"? This cannot be undone.`);
    if (!ok) return;
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting…';
    try {
      await MXE.cancel({ id: uid });
      _closeHarvestSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheHarvest] outreach delete error:', err);
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete Effort';
      alert(err?.message || 'Could not delete outreach effort.');
    }
  });
}

const PARTNER_TYPES = ['Sending Agency', 'Field Partner', 'Training Ministry', 'Relief & Development', 'Church Plant', 'Other'];

function _openMissionarySheet(m, onReload) {
  _closeHarvestSheet();
  const V     = window["TheVine"];
  const MXP   = buildAdapter('missions.partners', V);
  const isNew = !m;
  const uid   = m?.id ? String(m.id) : '';
  const name  = m ? (m.missionaryName || m.name || '') : '';
  const region = m?.region || m?.country || '';
  const org    = m?.organization || m?.org || '';
  const pType  = m?.partnerType || m?.type || '';
  const goal   = m?.monthlyGoal || m?.goal || '';
  const website = m?.website || '';
  const description = m?.description || '';

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isNew ? 'Add Missionary Partner' : 'Edit Missionary Partner'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${isNew ? 'Add Missionary Partner' : 'Edit Missionary'}</div>
          <div class="life-sheet-hd-meta">${isNew ? 'Add a supported missionary or mission partner' : _e(name)}</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Name / Organization <span style="color:#dc2626">*</span></div>
          <input class="life-sheet-input" data-field="name" type="text" value="${_e(name)}" placeholder="e.g. Thomas & Grace Adu">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Region / Country</div>
          <input class="life-sheet-input" data-field="region" type="text" value="${_e(region)}" placeholder="e.g. West Africa">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Sending Organization</div>
          <input class="life-sheet-input" data-field="org" type="text" value="${_e(org)}" placeholder="e.g. SIM, ABWE, OM">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Partner Type</div>
          <select class="life-sheet-input" data-field="partnerType">
            <option value="">— select —</option>
            ${PARTNER_TYPES.map(t => `<option value="${_e(t)}"${t === pType ? ' selected' : ''}>${_e(t)}</option>`).join('')}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Monthly Support Goal ($)</div>
          <input class="life-sheet-input" data-field="monthlyGoal" type="number" min="0" value="${_e(String(goal))}" placeholder="e.g. 1500">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Website</div>
          <input class="life-sheet-input" data-field="website" type="url" value="${_e(website)}" placeholder="https://…">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Notes</div>
          <textarea class="life-sheet-input" data-field="description" rows="3" style="resize:vertical" placeholder="Ministry focus, prayer needs, relationship history…">${_e(description)}</textarea>
        </div>
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        ${!isNew ? '<button class="flock-btn flock-btn--danger" data-delete style="margin-right:auto">Remove Partner</button>' : ''}
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>${isNew ? 'Add Partner' : 'Save Changes'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeHarvestSheet = sheet;

  /** @type {HTMLElement | null} */
  const overlayEl = sheet.querySelector('.life-sheet-overlay');
  /** @type {HTMLElement | null} */
  const panelEl = sheet.querySelector('.life-sheet-panel');
  /** @type {HTMLButtonElement | null} */
  const cancelBtn = sheet.querySelector('[data-cancel]');
  /** @type {HTMLButtonElement | null} */
  const closeBtn = sheet.querySelector('.life-sheet-close');
  /** @type {HTMLElement | null} */
  const errEl = sheet.querySelector('[data-error]');
  /** @type {HTMLInputElement | null} */
  const nameInput = sheet.querySelector('[data-field="name"]');
  /** @type {HTMLButtonElement | null} */
  const saveBtn = sheet.querySelector('[data-save]');
  /** @type {HTMLInputElement | null} */
  const goalInput = sheet.querySelector('[data-field="monthlyGoal"]');
  /** @type {HTMLInputElement | null} */
  const regionInput = sheet.querySelector('[data-field="region"]');
  /** @type {HTMLInputElement | null} */
  const orgInput = sheet.querySelector('[data-field="org"]');
  /** @type {HTMLSelectElement | null} */
  const partnerTypeInput = sheet.querySelector('[data-field="partnerType"]');
  /** @type {HTMLInputElement | null} */
  const websiteInput = sheet.querySelector('[data-field="website"]');
  /** @type {HTMLTextAreaElement | null} */
  const descriptionInput = sheet.querySelector('[data-field="description"]');
  /** @type {HTMLButtonElement | null} */
  const deleteBtn = sheet.querySelector('[data-delete]');

  requestAnimationFrame(() => {
    overlayEl?.classList.add('is-open');
    panelEl?.classList.add('is-open');
    if (isNew) nameInput?.focus();
  });

  const close = () => _closeHarvestSheet();
  cancelBtn?.addEventListener('click', close);
  closeBtn?.addEventListener('click', close);

  saveBtn?.addEventListener('click', async () => {
    const nameVal = nameInput?.value.trim() || '';
    if (!nameVal) {
      if (errEl) {
        errEl.textContent = 'Name is required.';
        errEl.style.display = '';
      }
      return;
    }
    if (!V) {
      if (errEl) {
        errEl.textContent = 'Harvest backend not loaded.';
        errEl.style.display = '';
      }
      return;
    }
    if (errEl) errEl.style.display = 'none';
    saveBtn.disabled = true;
    saveBtn.textContent = isNew ? 'Adding…' : 'Saving…';

    const goalVal = parseFloat(goalInput?.value || '');
    const payload = {
      organizationName: nameVal,
      region: regionInput?.value.trim() || undefined,
      organization: orgInput?.value.trim() || undefined,
      partnerType: partnerTypeInput?.value || undefined,
      monthlyGoal: isNaN(goalVal) ? undefined : goalVal,
      website: websiteInput?.value.trim() || undefined,
      description: descriptionInput?.value.trim() || undefined,
    };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    if (!isNew) payload.id = uid;
    try {
      if (isNew) { await MXP.create(payload); }
      else       { await MXP.update(payload); }
      _closeHarvestSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheHarvest] missionary save error:', err);
      if (errEl) {
        errEl.textContent = err?.message || 'Could not save.';
        errEl.style.display = '';
      }
      saveBtn.disabled = false;
      saveBtn.textContent = isNew ? 'Add Partner' : 'Save Changes';
    }
  });

  deleteBtn?.addEventListener('click', async () => {
    const ok = confirm(`Remove "${name}" from missionary support? This cannot be undone.`);
    if (!ok) return;
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Removing…';
    try {
      await MXP.update({ id: uid, status: 'Deleted' });
      _closeHarvestSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheHarvest] missionary delete error:', err);
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Remove Partner';
      alert(err?.message || 'Could not remove missionary partner.');
    }
  });
}
