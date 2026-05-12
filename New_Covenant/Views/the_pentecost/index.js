/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: THE PENTECOST — Special Services & Spiritual Milestones
   "And suddenly there came a sound from heaven as of a rushing mighty wind." — Acts 2:2
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';
import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';

export const name  = 'the_pentecost';
export const title = 'The Pentecost';

let _activePentSheet = null;
let _livePentMap     = {};

const _e = s => String(s ?? '').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const SPECIAL_TYPES = new Set(['baptism','revival','special','retreat','conference','ordination','communion','memorial','dedication']);

const TYPE_META = {
  baptism:     { color: '#0ea5e9', bg: 'rgba(14,165,233,0.11)',  icon: '💧', label: 'Baptism'      },
  revival:     { color: '#7c3aed', bg: 'rgba(124,58,237,0.11)', icon: '🔥', label: 'Revival'      },
  retreat:     { color: '#059669', bg: 'rgba(5,150,105,0.11)',   icon: '⛺', label: 'Retreat'      },
  special:     { color: '#e8a838', bg: 'rgba(232,168,56,0.13)',  icon: '✝️', label: 'Special'      },
  conference:  { color: '#6366f1', bg: 'rgba(99,102,241,0.11)', icon: '🎤', label: 'Conference'   },
  ordination:  { color: '#1b264f', bg: 'rgba(27,38,79,0.10)',   icon: '🙌', label: 'Ordination'   },
  communion:   { color: '#dc2626', bg: 'rgba(220,38,38,0.10)',  icon: '🍞', label: 'Communion'    },
  memorial:    { color: '#6b7280', bg: 'rgba(107,114,128,0.10)',icon: '🕯️', label: 'Memorial'     },
  dedication:  { color: '#c05818', bg: 'rgba(192,88,24,0.11)',  icon: '🌹', label: 'Dedication'   },
};

export function render() {
  return /* html */`
    <section class="pent-view">
      ${pageHero({
        title:    'The Pentecost',
        subtitle: 'Baptisms, revivals, retreats, and special services — Spirit-led moments in the life of the church.',
        scripture: 'And suddenly there came a sound from heaven as of a rushing mighty wind. — Acts 2:2',
      })}

      <!-- Upcoming special services -->
      <div class="way-section-header">
        <h2 class="way-section-title">Upcoming Special Services</h2>
        <button class="flock-btn flock-btn--primary" style="display:flex;align-items:center;gap:6px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Schedule Event
        </button>
      </div>
      <div class="pent-list" data-bind="upcoming">
        <div class="life-empty" style="padding:24px 8px;color:var(--ink-muted,#7a7f96);text-align:center">Loading upcoming services…</div>
      </div>

      <!-- Past milestones -->
      <div class="way-section-header" style="margin-top:28px;">
        <h2 class="way-section-title">Past Milestones</h2>
      </div>
      <div class="pent-list pent-list--past" data-bind="past">
        <div class="life-empty" style="padding:24px 8px;color:var(--ink-muted,#7a7f96);text-align:center">Loading past milestones…</div>
      </div>
    </section>
  `;
}

export function mount(root) {
  // Schedule Event button
  root.querySelectorAll('.flock-btn--primary').forEach(btn => {
    if (btn.textContent.includes('Schedule Event')) {
      btn.addEventListener('click', () => _openPentEventSheet(null, () => _loadPentecost(root)));
    }
  });
  _loadPentecost(root);
  return () => { _closePentSheet(); };
}

function _rows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

async function _loadPentecost(root) {
  const upEl   = root.querySelector('[data-bind="upcoming"]');
  const pastEl = root.querySelector('[data-bind="past"]');
  const errMsg = (msg) => `<div class="life-empty" style="padding:24px 8px;color:var(--ink-muted,#7a7f96);text-align:center">${msg}</div>`;

  const V = window.TheVine;
  const MX = buildAdapter('flock.events', V);
  if (!V) {
    if (upEl)   upEl.innerHTML   = errMsg('Events backend not loaded.');
    if (pastEl) pastEl.innerHTML = errMsg('Events backend not loaded.');
    return;
  }

  try {
    const res  = await MX.list({ limit: 100 });
    const all  = _rows(res).filter(ev => ev.status !== 'Cancelled');
    const special = all.filter(ev => {
      const t = (ev.type || ev.eventType || ev.category || '').toLowerCase();
      return SPECIAL_TYPES.has(t) || t.includes('baptism') || t.includes('revival') || t.includes('retreat') || t.includes('special');
    });

    const now = new Date(); now.setHours(0,0,0,0);
    special.sort((a, b) => new Date(a.startDate || a.date) - new Date(b.startDate || b.date));
    const upcoming = special.filter(ev => new Date(ev.startDate || ev.date) >= now);
    const past     = special.filter(ev => new Date(ev.startDate || ev.date) < now).reverse();

    if (upEl)   upEl.innerHTML   = upcoming.length ? upcoming.map(_liveEventCard).join('') : errMsg('No upcoming special services scheduled.');
    if (pastEl) pastEl.innerHTML = past.length     ? past.map(_liveEventCard).join('')     : errMsg('No past milestones on record.');

    // Build map + wire edit clicks
    _livePentMap = {};
    [...upcoming, ...past].forEach(ev => { if (ev.id) _livePentMap[String(ev.id)] = ev; });
    const reload = () => _loadPentecost(root);
    root.querySelectorAll('.pent-card[data-id]').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const rec = _livePentMap[card.dataset.id];
        if (rec) _openPentEventSheet(rec, reload);
      });
    });
  } catch (err) {
    console.error('[ThePentecost] events.list error:', err);
    if (upEl)   upEl.innerHTML   = errMsg('Could not load upcoming services.');
    if (pastEl) pastEl.innerHTML = errMsg('Could not load past milestones.');
  }
}

function _liveEventCard(ev) {
  const title    = ev.title || ev.name || 'Event';
  const rawType  = (ev.type || ev.eventType || ev.category || 'special').toLowerCase();
  const type     = Object.keys(TYPE_META).find(k => rawType.includes(k)) || 'special';
  const meta     = TYPE_META[type];
  const dateMs   = ev.startDate || ev.date ? new Date(ev.startDate || ev.date).getTime() : 0;
  const date     = dateMs ? new Date(dateMs).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const notes    = ev.description || ev.notes || '';
  const now      = new Date(); now.setHours(0,0,0,0);
  const isPast   = dateMs && new Date(dateMs) < now;
  return _cardHTML({ id: ev.id ? String(ev.id) : undefined, title, date, type, meta, notes, candidates: 0, isPast });
}

function _cardHTML({ id, title, date, type, meta, notes, candidates, isPast }) {
  return /* html */`
    <article class="pent-card${isPast ? ' pent-card--past' : ''}"${id ? ` data-id="${_e(id)}"` : ''} tabindex="0">
      <div class="pent-card-icon" style="background:${meta.bg};color:${meta.color}">${meta.icon}</div>
      <div class="pent-card-body">
        <div class="pent-card-title">${_e(title)}</div>
        <div class="pent-card-meta">
          <span class="pent-type-badge" style="color:${meta.color};background:${meta.bg}">${meta.label}</span>
          ${date ? `<span class="pent-date">${_e(date)}</span>` : ''}
          ${candidates > 0 ? `<span class="pent-candidates">💧 ${candidates} candidates</span>` : ''}
          ${isPast ? '<span class="pent-past-badge">Complete</span>' : ''}
        </div>
        ${notes ? `<div class="pent-notes">${_e(notes)}</div>` : ''}
      </div>
    </article>`;
}

// ── Special event sheet ───────────────────────────────────────────────────────
function _closePentSheet() {
  if (!_activePentSheet) return;
  const t = _activePentSheet;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activePentSheet === t) _activePentSheet = null; }, 320);
}

const PENT_TYPES = Object.keys(TYPE_META);

function _openPentEventSheet(ev, onReload) {
  _closePentSheet();
  const V     = window.TheVine;
  const MX    = buildAdapter('flock.events', V);
  const isNew = !ev;
  const uid   = ev?.id ? String(ev.id) : '';
  const title   = ev?.title || ev?.name || '';
  const rawType = (ev?.type || ev?.eventType || 'baptism').toLowerCase();
  const type    = PENT_TYPES.find(k => rawType.includes(k)) || 'special';
  const date    = ev?.startDate || ev?.date ? String(ev.startDate || ev.date).substring(0,10) : '';
  const notes   = ev?.description || ev?.notes || '';

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isNew ? 'Schedule Special Event' : 'Edit Special Event'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${isNew ? 'Schedule Special Event' : 'Edit Special Event'}</div>
          <div class="life-sheet-hd-meta">${isNew ? 'Baptism, revival, retreat, or milestone service' : _e(title)}</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Event Title <span style="color:#dc2626">*</span></div>
          <input class="life-sheet-input" data-field="title" type="text" value="${_e(title)}" placeholder="e.g. Baptism Sunday">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Type</div>
          <select class="life-sheet-input" data-field="type">
            ${PENT_TYPES.map(t => `<option value="${t}"${t === type ? ' selected' : ''}>${(TYPE_META[t]?.label || t)}</option>`).join('')}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Date</div>
          <input class="life-sheet-input" data-field="startDate" type="date" value="${_e(date)}">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Notes / Description</div>
          <textarea class="life-sheet-input" data-field="description" rows="3" style="resize:vertical" placeholder="Details, speaker, preparation notes…">${_e(notes)}</textarea>
        </div>
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        ${!isNew ? '<button class="flock-btn flock-btn--danger" data-delete style="margin-right:auto">Cancel Event</button>' : ''}
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>${isNew ? 'Schedule' : 'Save Changes'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activePentSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    if (isNew) sheet.querySelector('[data-field="title"]')?.focus();
  });

  const close = () => _closePentSheet();
  sheet.querySelector('[data-cancel]').addEventListener('click', close);
  sheet.querySelector('.life-sheet-close').addEventListener('click', close);

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl    = sheet.querySelector('[data-error]');
    const titleVal = sheet.querySelector('[data-field="title"]').value.trim();
    if (!titleVal) { errEl.textContent = 'Title is required.'; errEl.style.display = ''; return; }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = isNew ? 'Scheduling…' : 'Saving…';
    const typeVal = sheet.querySelector('[data-field="type"]').value;
    const payload = {
      title:       titleVal,
      type:        typeVal,
      eventType:   typeVal,
      startDate:   sheet.querySelector('[data-field="startDate"]').value || undefined,
      description: sheet.querySelector('[data-field="description"]').value.trim() || undefined,
    };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    if (!isNew) payload.id = uid;
    try {
      if (!V) throw new Error('Events backend not available.');
      if (isNew) { await MX.create(payload); }
      else       { await MX.update(payload); }
      _closePentSheet();
      onReload?.();
    } catch (err) {
      errEl.textContent = err?.message || 'Could not save.';
      errEl.style.display = '';
      btn.disabled = false; btn.textContent = isNew ? 'Schedule' : 'Save Changes';
    }
  });

  sheet.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const ok = confirm(`Cancel "${title}"? This cannot be undone.`);
    if (!ok) return;
    const btn = sheet.querySelector('[data-delete]');
    btn.disabled = true; btn.textContent = 'Cancelling…';
    try {
      await MX.delete({ id: uid });
      _closePentSheet();
      onReload?.();
    } catch (err) { btn.disabled = false; btn.textContent = 'Cancel Event'; }
  });
}

