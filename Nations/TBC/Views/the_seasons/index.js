/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: THE SEASONS — Events calendar
   "To everything there is a season, and a time for every purpose under heaven."
   — Ecclesiastes 3:1
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';
import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';

export const name  = 'the_seasons';
export const title = 'Seasons';

const TYPE_META = {
  service:  { label: 'Service',   color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  prayer:   { label: 'Prayer',    color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  ministry: { label: 'Ministry',  color: '#059669', bg: 'rgba(5,150,105,0.12)'  },
  outreach: { label: 'Outreach',  color: '#e8a838', bg: 'rgba(232,168,56,0.14)' },
  admin:    { label: 'Admin',     color: '#6b7280', bg: 'rgba(107,114,128,0.12)'},
  special:  { label: 'Special',   color: '#db2777', bg: 'rgba(219,39,119,0.12)' },
  training: { label: 'Training',  color: '#c05818', bg: 'rgba(192,88,24,0.12)'  },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const EVENT_TYPES = ['service','prayer','ministry','outreach','admin','special','training','other'];

const RECURRENCE_RULES = [
  { value: 'None',       label: 'Does not repeat' },
  { value: 'Daily',      label: 'Daily' },
  { value: 'Weekly',     label: 'Weekly' },
  { value: 'Biweekly',   label: 'Every 2 weeks' },
  { value: 'Monthly',    label: 'Monthly (same date)' },
  { value: 'MonthlyDow', label: 'Monthly (day of week)' },
  { value: 'Yearly',     label: 'Yearly' },
];

const DOW_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const ORD_NAMES = ['1st','2nd','3rd','4th','Last'];

const ALERT_OPTIONS = [
  { value: '',     label: 'No alert' },
  { value: '5',    label: '5 minutes before' },
  { value: '10',   label: '10 minutes before' },
  { value: '15',   label: '15 minutes before' },
  { value: '30',   label: '30 minutes before' },
  { value: '60',   label: '1 hour before' },
  { value: '120',  label: '2 hours before' },
  { value: '1440', label: '1 day before' },
];

const VISIBILITY_OPTIONS = [
  { value: 'private', label: '🔒 Private (only me)' },
  { value: 'members', label: '👥 Members' },
  { value: 'leaders', label: '🛡️ Leaders' },
  { value: 'public',  label: '🌐 Public' },
];

const TODO_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const TODO_STATUSES   = ['Not Started', 'In Progress', 'Done', 'Archived'];
const TODO_CATEGORIES = ['Follow-Up', 'Visit', 'Phone Call', 'Admin', 'Event', 'Personal', 'Other'];

let _activeSeasonSheet   = null;
let _activePersonalSheet = null;
let _activeTodoSheet     = null;
let _liveEventsMap       = {};

export function render() {
  const now = new Date();
  const m1  = now.getMonth();
  const m2  = (m1 + 1) % 12;
  const y1  = now.getFullYear();
  const y2  = m2 === 0 ? y1 + 1 : y1;

  const _tabBtn = (id, label, active) => /* html */`
    <button class="seasons-tab${active ? ' is-active' : ''}" data-tab="${id}"
      style="padding:9px 20px;border:none;background:none;cursor:pointer;font-size:.9rem;font-weight:600;
             border-bottom:2px solid ${active ? 'var(--accent,#7c3aed)' : 'transparent'};margin-bottom:-2px;
             color:${active ? 'var(--accent,#7c3aed)' : 'var(--ink-muted,#6b7280)'};font-family:inherit;
             transition:color .15s,border-color .15s;">${label}</button>`;

  return /* html */`
    <section class="seasons-view">
      ${pageHero({
        title: 'Seasons',
        subtitle: 'Upcoming services, gatherings, and ministry events — all in one place.',
        scripture: 'To everything there is a season, and a time for every purpose under heaven. — Ecclesiastes 3:1',
      })}

      <!-- Tab bar -->
      <div style="display:flex;gap:2px;border-bottom:2px solid var(--line,#e5e7eb);margin-bottom:24px;padding-bottom:0;flex-wrap:wrap;">
        ${_tabBtn('church',   '📅 Church Events', true)}
        ${_tabBtn('personal', '🔒 My Events',      false)}
        ${_tabBtn('todos',    '✅ To-Dos',          false)}
      </div>

      <!-- Panel: Church Events -->
      <div data-panel="church">
        <div class="seasons-layout">
          <div class="seasons-list-col">
            <div class="seasons-list-header">
              <h2 class="seasons-list-title">Upcoming Events</h2>
              <button class="flock-btn flock-btn--primary seasons-add-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                New Event
              </button>
            </div>
            <div class="seasons-list">
              <div class="life-empty">Loading events…</div>
            </div>
            <!-- RSVPs -->
            <div class="seasons-list-header" style="margin-top:32px;">
              <h2 class="seasons-list-title">RSVPs</h2>
              <button class="flock-btn flock-btn--primary flock-btn--sm seasons-rsvp-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Record RSVP
              </button>
            </div>
            <div data-bind="rsvps">
              <div class="life-empty">Loading RSVPs…</div>
            </div>
          </div>
          <div class="seasons-calendar-col">
            ${_miniCalendarLive(y1, m1, [])}
            ${_miniCalendarLive(y2, m2, [])}
          </div>
        </div>
      </div>

      <!-- Panel: Personal / Private Events -->
      <div data-panel="personal" hidden>
        <div class="seasons-layout">
          <div class="seasons-list-col">
            <div class="seasons-list-header">
              <h2 class="seasons-list-title">My Personal Events</h2>
              <button class="flock-btn flock-btn--primary seasons-personal-add-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                New Personal Event
              </button>
            </div>
            <p style="font-size:.82rem;color:var(--ink-muted,#6b7280);margin:0 0 16px;">
              Events default to <strong>Private</strong> — visible only to you. Change visibility in the form to share more widely.
            </p>
            <div class="seasons-personal-list">
              <div class="life-empty">Loading your events…</div>
            </div>
          </div>
          <div class="seasons-calendar-col" data-personal-cal>
            ${_miniCalendarLive(y1, m1, [])}
            ${_miniCalendarLive(y2, m2, [])}
          </div>
        </div>
      </div>

      <!-- Panel: To-Dos & Tasks -->
      <div data-panel="todos" hidden>
        <div class="seasons-list-header">
          <h2 class="seasons-list-title">To-Dos &amp; Tasks</h2>
          <button class="flock-btn flock-btn--primary seasons-todo-add-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            New Task
          </button>
        </div>
        <div class="seasons-todo-list" style="margin-top:16px;">
          <div class="life-empty">Loading tasks…</div>
        </div>
      </div>

    </section>
  `;
}

export function mount(root) {
  // ── Tab switching ──────────────────────────────────────────────────────
  let _personalLoaded = false;
  let _todosLoaded    = false;

  root.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      // Update tab button styles
      root.querySelectorAll('[data-tab]').forEach(b => {
        const active = b.dataset.tab === tab;
        b.style.borderBottomColor = active ? 'var(--accent,#7c3aed)' : 'transparent';
        b.style.color             = active ? 'var(--accent,#7c3aed)' : 'var(--ink-muted,#6b7280)';
      });
      // Show / hide panels
      root.querySelectorAll('[data-panel]').forEach(p => {
        p.hidden = p.dataset.panel !== tab;
      });
      // Lazy-load panels on first visit
      if (tab === 'personal' && !_personalLoaded) {
        _personalLoaded = true;
        _loadPersonalEvents(root);
      }
      if (tab === 'todos' && !_todosLoaded) {
        _todosLoaded = true;
        _loadTodos(root);
      }
    });
  });

  // ── Type filter chips ──────────────────────────────────────────────────
  root.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.typeFilter;
      root.querySelectorAll('.seasons-card').forEach((card) => {
        card.style.display = (!type || card.dataset.type === type) ? '' : 'none';
      });
    });
  });

  // ── Church events ──────────────────────────────────────────────────────
  const addBtn = root.querySelector('.seasons-add-btn');
  if (addBtn) addBtn.addEventListener('click', () => _openEventSheet(null, () => _loadEvents(root)));

  const rsvpBtn = root.querySelector('.seasons-rsvp-btn');
  if (rsvpBtn) rsvpBtn.addEventListener('click', () => _openRsvpSheet(null, _liveEventsMap, () => _loadRsvps(root)));

  // ── Personal events ────────────────────────────────────────────────────
  const personalAddBtn = root.querySelector('.seasons-personal-add-btn');
  if (personalAddBtn) personalAddBtn.addEventListener('click', () => _openPersonalSheet(null, () => _loadPersonalEvents(root)));

  // ── To-Dos ─────────────────────────────────────────────────────────────
  const todoAddBtn = root.querySelector('.seasons-todo-add-btn');
  if (todoAddBtn) todoAddBtn.addEventListener('click', () => _openTodoSheet(null, () => _loadTodos(root)));

  // ── Initial loads & alert system ───────────────────────────────────────
  _loadEvents(root);
  _loadRsvps(root);
  _alertStart();

  return () => {
    _closeEventSheet();
    _closeRsvpSheet();
    _closePersonalSheet();
    _closeTodoSheet();
  };
}

async function _loadEvents(root) {
  const V = window.TheVine;
  const MX = buildAdapter('flock.events', V);
  const listEl = root.querySelector('.seasons-list');
  const calCol = root.querySelector('.seasons-calendar-col');
  if (!listEl) return;
  if (!V) {
    listEl.innerHTML = '<div class="life-empty">Events backend not loaded.</div>';
    return;
  }

  listEl.innerHTML = '<div class="life-empty">Loading events…</div>';
  try {
    const res  = await MX.list();
    const rows = _rows(res);
    if (!rows.length) {
      listEl.innerHTML = '<div class="life-empty">No events yet. Click “New Event” to add one.</div>';
      return;
    }
    const now = new Date(); now.setHours(0,0,0,0);
    const upcoming = rows
      .filter((ev) => ev.status !== 'Cancelled')
      .map((ev) => {
        const raw = ev.startDate || ev.date || ev.createdAt || '';
        // Date-only strings (YYYY-MM-DD) must be parsed as local noon to avoid UTC off-by-one
        const d = /^\d{4}-\d{2}-\d{2}$/.test(String(raw))
          ? new Date(raw + 'T12:00:00')
          : new Date(raw);
        return { ...ev, _date: d };
      })
      .filter((ev) => ev._date >= now)
      .sort((a, b) => a._date - b._date);

    listEl.innerHTML = upcoming.length
      ? upcoming.map(_liveEventCard).join('')
      : '<div class="life-empty">No upcoming events.</div>';

    // Build lookup and wire card clicks
    _liveEventsMap = {};
    upcoming.forEach(ev => { if (ev.id) _liveEventsMap[String(ev.id)] = ev; });
    const reload = () => _loadEvents(root);
    listEl.querySelectorAll('.seasons-card').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const ev = _liveEventsMap[card.dataset.id];
        if (ev) _openEventSheet(ev, reload);
      });
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
    });

    // Rebuild mini-calendars from live event dates
    if (calCol) {
      const eventDates = upcoming.map((ev) => ev._date);
      const months = _uniqueMonths(eventDates, 2);
      calCol.innerHTML = months.map(([y, m]) => _miniCalendarLive(y, m, eventDates)).join('');
    }
  } catch (err) {
    console.error('[TheSeasons] events.list error:', err);
    listEl.innerHTML = '<div class="life-empty">Could not load events right now.</div>';
  }
}

function _rows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

function _uniqueMonths(dates, limit = 2) {
  const seen = new Set();
  const now  = new Date();
  // Always include current month
  seen.add(`${now.getFullYear()}-${now.getMonth()}`);
  for (const d of dates) {
    seen.add(`${d.getFullYear()}-${d.getMonth()}`);
    if (seen.size >= limit) break;
  }
  return [...seen].slice(0, limit).map((k) => k.split('-').map(Number));
}

function _liveEventCard(ev) {
  const d     = ev._date;
  const title = ev.title || ev.name || 'Event';
  const type  = (ev.type || ev.category || 'service').toLowerCase();
  const time  = ev.startTime || ev.time || '';
  const loc   = ev.location  || ev.loc  || '';
  const rsvp  = ev.rsvpCount || ev.attendees || 0;
  const meta  = TYPE_META[type] || TYPE_META.service;
  const now   = new Date(); now.setHours(0,0,0,0);
  const isToday = d.toDateString() === now.toDateString();
  const rsvpStr = rsvp > 0 ? `<span class="seasons-rsvp">${rsvp} attending</span>` : '';

  return /* html */`
    <article class="seasons-card${isToday ? ' is-today' : ''}" data-type="${_e(type)}" data-id="${_e(String(ev.id || ''))}" tabindex="0">
      <div class="seasons-card-date">
        <div class="seasons-card-day">${d.getDate()}</div>
        <div class="seasons-card-mon">${MONTHS[d.getMonth()].slice(0,3).toUpperCase()}</div>
      </div>
      <div class="seasons-card-body">
        <div class="seasons-card-title">${_e(title)}</div>
        <div class="seasons-card-meta">
          <span class="seasons-type-badge" style="color:${meta.color}; background:${meta.bg}">${meta.label}</span>
          ${time ? `<span class="seasons-time">${_e(time)}</span>` : ''}
          ${loc  ? `<span class="seasons-loc"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${_e(loc)}</span>` : ''}
          ${rsvpStr}
        </div>
      </div>
      ${isToday ? '<div class="seasons-today-dot"></div>' : ''}
    </article>`;
}

function _miniCalendarLive(year, month, eventDates) {
  const label     = `${MONTHS[month]} ${year}`;
  const firstDay  = new Date(year, month, 1).getDay();
  const daysInMo  = new Date(year, month + 1, 0).getDate();
  const eventDaySet = new Set(
    eventDates.filter((d) => d.getFullYear() === year && d.getMonth() === month).map((d) => d.getDate())
  );
  const now = new Date();
  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += '<div class="cal-empty"></div>';
  for (let d = 1; d <= daysInMo; d++) {
    const isToday = year === now.getFullYear() && month === now.getMonth() && d === now.getDate();
    const hasEv   = eventDaySet.has(d);
    cells += `<div class="cal-day${isToday ? ' cal-today' : ''}${hasEv ? ' cal-has-event' : ''}">${d}</div>`;
  }
  return /* html */`
    <div class="mini-cal">
      <div class="mini-cal-header">${label}</div>
      <div class="mini-cal-grid">
        ${DAYS.map(d => `<div class="cal-label">${d}</div>`).join('')}
        ${cells}
      </div>
    </div>`;
}

// ── Builders ────────────────────────────────────────────────
function _e(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Event sheet (create / edit) ──────────────────────────────────────────────
function _closeEventSheet() {
  if (!_activeSeasonSheet) return;
  const target = _activeSeasonSheet;
  target.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  target.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { target.remove(); if (_activeSeasonSheet === target) _activeSeasonSheet = null; }, 320);
}

function _isoDate(d) {
  if (!d) return '';
  try {
    const ms = d?.seconds ? d.seconds * 1000 : +new Date(d);
    if (isNaN(ms)) return '';
    const dt = new Date(ms);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  } catch { return ''; }
}

function _openEventSheet(ev, onReload) {
  _closeEventSheet();
  const V      = window.TheVine;
  const MX     = buildAdapter('flock.events', V);
  const isNew  = !ev;
  const uid    = ev?.id   ? String(ev.id) : '';
  const title  = ev?.title || ev?.name    || '';
  const type   = (ev?.type || ev?.category || 'service').toLowerCase();
  const loc    = ev?.location || ev?.loc  || '';
  const sDate   = _isoDate(ev?._date || ev?.startDate || ev?.date);
  const sTime   = ev?.startTime || ev?.time || '';
  const eDate   = _isoDate(ev?.endDate);
  const eTime   = ev?.endTime || '';
  const desc    = ev?.description || ev?.notes || '';
  const rsvpN   = ev?.rsvpCount || ev?.rsvp || '';
  const rsvpReq = ev?.rsvpRequired || false;

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isNew ? 'New Event' : 'Edit Event'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${isNew ? 'New Event' : 'Edit Event'}</div>
          <div class="life-sheet-hd-meta">${isNew ? 'Add to the calendar' : _e(title)}</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Event Title <span style="color:#dc2626">*</span></div>
          <input class="life-sheet-input" data-field="title" type="text" value="${_e(title)}" placeholder="e.g. Sunday Worship Service">
        </div>
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Start Date <span style="color:#dc2626">*</span></div>
            <input class="life-sheet-input" data-field="startDate" type="date" value="${_e(sDate)}">
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Start Time</div>
            <input class="life-sheet-input" data-field="startTime" type="time" value="${_e(sTime)}">
          </div>
        </div>
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">End Date</div>
            <input class="life-sheet-input" data-field="endDate" type="date" value="${_e(eDate)}">
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">End Time</div>
            <input class="life-sheet-input" data-field="endTime" type="time" value="${_e(eTime)}">
          </div>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Location</div>
          <input class="life-sheet-input" data-field="location" type="text" value="${_e(loc)}" placeholder="Main Sanctuary, Chapel, Online…">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Event Type</div>
          <select class="life-sheet-input" data-field="type">
            ${EVENT_TYPES.map(t => `<option value="${_e(t)}"${t === type ? ' selected' : ''}>${_e(t.charAt(0).toUpperCase()+t.slice(1))}</option>`).join('')}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Description / Notes</div>
          <textarea class="life-sheet-input" data-field="description" rows="3" style="resize:vertical">${_e(desc)}</textarea>
        </div>
        <div class="life-sheet-field" style="display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="event-rsvp-chk" data-field="rsvpRequired" style="width:16px;height:16px;cursor:pointer"${rsvpReq ? ' checked' : ''}>
          <label for="event-rsvp-chk" style="cursor:pointer;font-size:.9rem;">RSVP required for this event</label>
        </div>
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        ${!isNew ? '<button class="flock-btn flock-btn--danger" data-delete style="margin-right:auto">Cancel Event</button>' : ''}
        <button class="flock-btn" data-cancel>Close</button>
        <button class="flock-btn flock-btn--primary" data-save>${isNew ? 'Create Event' : 'Save Changes'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeSeasonSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    if (isNew) sheet.querySelector('[data-field="title"]')?.focus();
  });

  const close = () => _closeEventSheet();
  sheet.querySelector('[data-cancel]').addEventListener('click', close);
  sheet.querySelector('.life-sheet-close').addEventListener('click', close);

  // Save / Create
  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl    = sheet.querySelector('[data-error]');
    const titleVal = sheet.querySelector('[data-field="title"]').value.trim();
    const dateVal  = sheet.querySelector('[data-field="startDate"]').value;
    if (!titleVal) { errEl.textContent = 'Title is required.'; errEl.style.display = ''; return; }
    if (!dateVal)  { errEl.textContent = 'Date is required.'; errEl.style.display = ''; return; }
    if (!V?.flock?.events) { errEl.textContent = 'Events backend not loaded — cannot save.'; errEl.style.display = ''; return; }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = isNew ? 'Creating…' : 'Saving…';
    const endDateVal   = sheet.querySelector('[data-field="endDate"]').value || undefined;
    const endTimeVal   = sheet.querySelector('[data-field="endTime"]').value || undefined;
    const eventTypeVal = sheet.querySelector('[data-field="type"]').value;
    const payload = {
      title:        titleVal,
      startDate:    dateVal,
      startTime:    sheet.querySelector('[data-field="startTime"]').value || undefined,
      endDate:      endDateVal,
      endTime:      endTimeVal,
      location:     sheet.querySelector('[data-field="location"]').value.trim() || undefined,
      type:         eventTypeVal,   // GAS fallback
      eventType:    eventTypeVal,   // Firestore field
      description:  sheet.querySelector('[data-field="description"]').value.trim() || undefined,
      rsvpRequired: sheet.querySelector('[data-field="rsvpRequired"]').checked,
    };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    if (!isNew) payload.id = uid;
    try {
      if (isNew) { await MX.create(payload); }
      else       { await MX.update(payload); }
      _closeEventSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheSeasons] event save error:', err);
      errEl.textContent = err?.message || 'Could not save event. Please try again.';
      errEl.style.display = '';
      btn.disabled = false; btn.textContent = isNew ? 'Create Event' : 'Save Changes';
    }
  });

  // Cancel/Delete event
  sheet.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const ok = confirm(`Cancel "${title}"? This will remove it from the calendar.`);
    if (!ok) return;
    const btn = sheet.querySelector('[data-delete]');
    btn.disabled = true; btn.textContent = 'Cancelling…';
    try {
      await MX.delete({ id: uid });
      _closeEventSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheSeasons] event cancel error:', err);
      btn.disabled = false; btn.textContent = 'Cancel Event';
      alert(err?.message || 'Could not cancel event.');
    }
  });
}

// ── RSVPs ─────────────────────────────────────────────────────────────────────
const RSVP_RESPONSES = ['Attending', 'Maybe', 'Not Attending'];

function _closeRsvpSheet() {
  if (!_activeRsvpSheet) return;
  const t = _activeRsvpSheet;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activeRsvpSheet === t) _activeRsvpSheet = null; }, 320);
}

async function _loadRsvps(root) {
  const host = root.querySelector('[data-bind="rsvps"]');
  if (!host) return;
  const UR = window.UpperRoom;
  if (!UR || typeof UR.listRsvps !== 'function') {
    host.innerHTML = '<div class="life-empty">RSVPs require Firestore (UpperRoom) — not available.</div>';
    return;
  }
  host.innerHTML = '<div class="life-empty">Loading RSVPs…</div>';
  try {
    const rows = await UR.listRsvps({ limit: 100 });
    if (!rows || !rows.length) {
      host.innerHTML = '<div class="life-empty">No RSVPs recorded yet.</div>';
      return;
    }
    host.innerHTML = rows.map(r => _rsvpRow(r)).join('');
  } catch (err) {
    console.error('[TheSeasons] listRsvps:', err);
    host.innerHTML = '<div class="life-empty">Could not load RSVPs right now.</div>';
  }
}

function _rsvpRow(r) {
  const name     = r.memberName || r.memberId || '—';
  const eventLbl = r.eventTitle || r.eventId  || '—';
  const resp     = r.response || 'Attending';
  const guests   = r.guestCount > 0 ? `+${r.guestCount} guest${r.guestCount > 1 ? 's' : ''}` : '';
  const ts       = r.respondedAt?.seconds
    ? new Date(r.respondedAt.seconds * 1000).toLocaleDateString()
    : (r.respondedAt ? new Date(r.respondedAt).toLocaleDateString() : '');
  const respC  = resp === 'Attending' ? '#059669' : resp === 'Maybe' ? '#e8a838' : '#6b7280';
  const respBg = resp === 'Attending' ? 'rgba(5,150,105,0.10)' : resp === 'Maybe' ? 'rgba(232,168,56,0.13)' : 'rgba(107,114,128,0.10)';
  const initials = name === '—' ? '👤' : name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('');

  return /* html */`
    <div class="gift-tx-row" style="align-items:center;">
      <div class="gift-tx-avatar">${initials}</div>
      <div class="gift-tx-body">
        <div class="gift-tx-name">${_e(name)}</div>
        <div class="gift-tx-fund">${_e(eventLbl)}${guests ? ' &bull; ' + _e(guests) : ''}</div>
      </div>
      <span class="gift-method-badge" style="background:${respBg};color:${respC}">${_e(resp)}</span>
      <div class="gift-tx-date">${_e(ts)}</div>
    </div>`;
}

function _openRsvpSheet(item, eventsMap, onSave) {
  _closeRsvpSheet();
  const UR    = window.UpperRoom;
  if (!UR) return;
  const isNew = !item;
  // Build event list from _liveEventsMap (populated by _loadEvents)
  const eventOptions = Object.values(eventsMap || {}).map(ev => {
    const label = `${ev.title || ev.name || 'Event'} — ${_isoDate(ev._date || ev.startDate)}`;
    return `<option value="${_e(String(ev.id))}"${ev.id === item?.eventId ? ' selected' : ''}>${_e(label)}</option>`;
  });

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="Record RSVP">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info"><div class="life-sheet-hd-name">Record RSVP</div></div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Event <span style="color:#dc2626">*</span></div>
          <select class="life-sheet-input" data-field="eventId">
            <option value="">— Select event —</option>
            ${eventOptions.join('')}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Member / Attendee <span style="color:#dc2626">*</span></div>
          <input class="life-sheet-input" data-field="memberId" type="text" value="${_e(item?.memberId || '')}" placeholder="Email or name">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Response</div>
          <div class="life-status-row">
            ${RSVP_RESPONSES.map(r => `<button class="life-status-pill${r === (item?.response || 'Attending') ? ' is-active' : ''}" data-resp="${_e(r)}">${_e(r)}</button>`).join('')}
          </div>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Additional Guests</div>
          <input class="life-sheet-input" data-field="guestCount" type="number" min="0" value="${item?.guestCount || 0}">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Notes</div>
          <textarea class="life-sheet-input" data-field="notes" rows="2" placeholder="Dietary restrictions, accessibility, etc.">${_e(item?.notes || '')}</textarea>
        </div>
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>Record RSVP</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeRsvpSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
  });

  sheet.querySelectorAll('[data-resp]').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('[data-resp]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  const close = () => _closeRsvpSheet();
  sheet.querySelector('[data-cancel]').addEventListener('click', close);
  sheet.querySelector('.life-sheet-close').addEventListener('click', close);

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl    = sheet.querySelector('[data-error]');
    const eventId  = sheet.querySelector('[data-field="eventId"]').value;
    const memberId = sheet.querySelector('[data-field="memberId"]').value.trim();
    if (!eventId)  { errEl.textContent = 'Please select an event.'; errEl.style.display = ''; return; }
    if (!memberId) { errEl.textContent = 'Member / attendee is required.'; errEl.style.display = ''; return; }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await UR.rsvpEvent({
        eventId,
        memberId,
        response:   sheet.querySelector('[data-resp].is-active')?.dataset.resp || 'Attending',
        guestCount: parseInt(sheet.querySelector('[data-field="guestCount"]').value, 10) || 0,
        notes:      sheet.querySelector('[data-field="notes"]').value.trim() || '',
      });
      _closeRsvpSheet();
      if (onSave) onSave();
    } catch (err) {
      console.error('[TheSeasons] rsvpEvent:', err);
      errEl.textContent = err?.message || 'Could not record RSVP.'; errEl.style.display = '';
      btn.disabled = false; btn.textContent = 'Record RSVP';
    }
  });
}


// ═══════════════════════════════════════════════════════════════════════════════
// PERSONAL / PRIVATE EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

function _closePersonalSheet() {
  if (!_activePersonalSheet) return;
  const t = _activePersonalSheet;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activePersonalSheet === t) _activePersonalSheet = null; }, 320);
}

async function _loadPersonalEvents(root) {
  const listEl = root.querySelector('.seasons-personal-list');
  const calEl  = root.querySelector('[data-personal-cal]');
  if (!listEl) return;

  const V  = window.TheVine;
  const UR = window.UpperRoom;
  listEl.innerHTML = '<div class="life-empty">Loading…</div>';

  try {
    let rows = [];
    if (UR && typeof UR.listCalendarEvents === 'function') {
      const res = await UR.listCalendarEvents({});
      rows = Array.isArray(res) ? res : (res?.rows || res?.data || []);
    } else if (V?.flock?.call) {
      const res = await V.flock.call('calendar.list', {});
      rows = Array.isArray(res) ? res : (res?.rows || res?.data || []);
    }

    if (!rows.length) {
      listEl.innerHTML = '<div class="life-empty">No personal events yet. Click "New Personal Event" to add one.</div>';
      return;
    }

    // Cache for alert checker
    try { localStorage.setItem('flock_personal_events_cache', JSON.stringify(rows)); } catch (_) {}

    const now = new Date(); now.setHours(0,0,0,0);
    const sorted = rows
      .map(r => ({ ...r, _date: new Date((r.StartDateTime || r.startDate || r.date || '') + (!(r.StartDateTime || '').includes('T') ? 'T12:00:00' : '')) }))
      .sort((a, b) => a._date - b._date);

    listEl.innerHTML = sorted.map(_personalEventCard).join('');

    // Wire card clicks
    listEl.querySelectorAll('.seasons-personal-card').forEach(card => {
      card.style.cursor = 'pointer';
      const id = card.dataset.id;
      card.addEventListener('click', () => {
        const ev = sorted.find(r => String(r.EventID || r.id) === id);
        if (ev) _openPersonalSheet(ev, () => _loadPersonalEvents(root));
      });
    });

    // Rebuild mini-calendars
    if (calEl) {
      const eventDates = sorted.map(r => r._date);
      const months = _uniqueMonths(eventDates, 2);
      calEl.innerHTML = months.map(([y, m]) => _miniCalendarLive(y, m, eventDates)).join('');
    }
  } catch (err) {
    console.error('[TheSeasons] personal events error:', err);
    listEl.innerHTML = '<div class="life-empty">Could not load personal events.</div>';
  }
}

function _personalEventCard(ev) {
  const d       = ev._date;
  const title   = ev.Title || ev.title || 'Event';
  const vis     = (ev.Visibility || ev.visibility || 'private').toLowerCase();
  const time    = ev.StartDateTime ? ev.StartDateTime.substring(11, 16) : (ev.startTime || ev.time || '');
  const loc     = ev.Location || ev.location || '';
  const recur      = ev.RecurrenceRule || ev.recurring || '';
  const recurDay   = ev.RecurringDay || '';
  const alert      = ev.AlertMinutes || ev.alertMinutes || '';
  const id         = String(ev.EventID || ev.id || '');

  const visLabel = { private: '🔒 Private', members: '👥 Members', leaders: '🛡️ Leaders', public: '🌐 Public' }[vis] || vis;
  const visColor = vis === 'private' ? '#6366f1' : vis === 'public' ? '#059669' : '#e8a838';

  let alertLabel = '';
  if (alert) {
    const am = parseInt(alert, 10);
    alertLabel = am >= 1440 ? '⏰ 1 day' : am >= 60 ? `⏰ ${am/60}h` : `⏰ ${am}m`;
  }
  const recurLabel = recur === 'MonthlyDow'
    ? `Monthly · ${recurDay || 'day of week'}`
    : recur;

  const isValid = d && !isNaN(d.getTime());
  return /* html */`
    <article class="seasons-personal-card seasons-card" data-id="${_e(id)}" tabindex="0"
      style="display:flex;align-items:flex-start;gap:14px;padding:14px 16px;border-radius:10px;
             border:1px solid var(--line,#e5e7eb);background:var(--bg-raised,#fff);margin-bottom:10px;">
      <div style="text-align:center;min-width:42px;padding:6px 4px;background:#6366f1;border-radius:8px;color:#fff;">
        <div style="font-size:1.3rem;font-weight:800;line-height:1;">${isValid ? d.getDate() : '—'}</div>
        <div style="font-size:.65rem;font-weight:600;opacity:.85;">${isValid ? MONTHS[d.getMonth()].slice(0,3).toUpperCase() : ''}</div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:.95rem;margin-bottom:4px;">${_e(title)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.75rem;color:var(--ink-muted,#6b7280);">
          <span style="color:${visColor};font-weight:600;">${visLabel}</span>
          ${time ? `<span>🕐 ${_e(time)}</span>` : ''}
          ${loc  ? `<span>📍 ${_e(loc)}</span>`  : ''}
          ${recurLabel && recurLabel !== 'None' ? `<span>🔁 ${_e(recurLabel)}</span>` : ''}
          ${alertLabel ? `<span>${alertLabel} alert</span>` : ''}
        </div>
      </div>
    </article>`;
}

function _openPersonalSheet(ev, onReload) {
  _closePersonalSheet();
  const V  = window.TheVine;
  const UR = window.UpperRoom;
  const isNew = !ev;
  const id    = ev ? String(ev.EventID || ev.id || '') : '';
  const title = ev?.Title || ev?.title || '';
  const sDate = ev?.StartDateTime ? ev.StartDateTime.substring(0, 10) : _isoDate(ev?._date);
  const sTime = ev?.StartDateTime ? ev.StartDateTime.substring(11, 16) : (ev?.startTime || ev?.time || '');
  const eTime = ev?.EndDateTime   ? ev.EndDateTime.substring(11, 16)   : (ev?.endTime || '');
  const loc   = ev?.Location || ev?.location || '';
  const desc  = ev?.Description || ev?.description || '';
  const color = ev?.Color || '#6366f1';
  const recurVal    = ev?.RecurrenceRule || ev?.recurring || 'None';
  const recurUntil  = ev?.RecurringUntil ? ev.RecurringUntil.substring(0, 10) : '';
  const recurDayVal = ev?.RecurringDay || '';
  const [recurOrdinal = '1st', recurDayName = 'Sunday'] = recurDayVal ? recurDayVal.split(' ') : [];
  const alertVal = ev?.AlertMinutes || ev?.alertMinutes || '';
  const visVal   = ev?.Visibility || ev?.visibility || 'private';
  const isAllDay = ev?.IsAllDay || false;

  const recurOptions = RECURRENCE_RULES.map(r =>
    `<option value="${_e(r.value)}"${r.value === recurVal ? ' selected' : ''}>${_e(r.label)}</option>`
  ).join('');
  const ordinalOptions = ORD_NAMES.map(o =>
    `<option value="${o}"${o === recurOrdinal ? ' selected' : ''}>${o}</option>`
  ).join('');
  const dowOptions = DOW_NAMES.map(d =>
    `<option value="${d}"${d === recurDayName ? ' selected' : ''}>${d}</option>`
  ).join('');
  const alertOptions = ALERT_OPTIONS.map(a =>
    `<option value="${_e(a.value)}"${a.value === String(alertVal) ? ' selected' : ''}>${_e(a.label)}</option>`
  ).join('');
  const visOptions = VISIBILITY_OPTIONS.map(v =>
    `<option value="${_e(v.value)}"${v.value === visVal ? ' selected' : ''}>${_e(v.label)}</option>`
  ).join('');

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isNew ? 'New Personal Event' : 'Edit Personal Event'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${isNew ? '🔒 New Personal Event' : '✏️ Edit Personal Event'}</div>
          <div class="life-sheet-hd-meta">${isNew ? 'Defaults to Private — only you will see it' : _e(title)}</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Title <span style="color:#dc2626">*</span></div>
          <input class="life-sheet-input" data-field="Title" type="text" value="${_e(title)}" placeholder="e.g. Doctor Appointment">
        </div>
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Date <span style="color:#dc2626">*</span></div>
            <input class="life-sheet-input" data-field="startDate" type="date" value="${_e(sDate)}">
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">All Day</div>
            <select class="life-sheet-input" data-field="IsAllDay">
              <option value="false"${!isAllDay ? ' selected' : ''}>No</option>
              <option value="true"${isAllDay  ? ' selected' : ''}>Yes</option>
            </select>
          </div>
        </div>
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Start Time</div>
            <input class="life-sheet-input" data-field="startTime" type="time" value="${_e(sTime)}">
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">End Time</div>
            <input class="life-sheet-input" data-field="endTime" type="time" value="${_e(eTime)}">
          </div>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Location</div>
          <input class="life-sheet-input" data-field="Location" type="text" value="${_e(loc)}" placeholder="Optional">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Description / Notes</div>
          <textarea class="life-sheet-input" data-field="Description" rows="2" style="resize:vertical">${_e(desc)}</textarea>
        </div>
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Repeats</div>
            <select class="life-sheet-input" data-field="RecurrenceRule">${recurOptions}</select>
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Repeat Until</div>
            <input class="life-sheet-input" data-field="RecurringUntil" type="date" value="${_e(recurUntil)}">
          </div>
        </div>
        <div class="fold-form-row" data-dow-row style="display:${recurVal === 'MonthlyDow' ? '' : 'none'}">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Occurrence</div>
            <select class="life-sheet-input" data-field="recurOrdinal">${ordinalOptions}</select>
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Day of Week</div>
            <select class="life-sheet-input" data-field="recurDay">${dowOptions}</select>
          </div>
        </div>
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Alert</div>
            <select class="life-sheet-input" data-field="AlertMinutes">${alertOptions}</select>
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Color</div>
            <input class="life-sheet-input" data-field="Color" type="color" value="${_e(color)}" style="height:40px;padding:4px;">
          </div>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Visibility</div>
          <select class="life-sheet-input" data-field="Visibility">${visOptions}</select>
          <div style="font-size:.76rem;color:var(--ink-muted,#6b7280);margin-top:4px;">
            Private events are only visible to you, always.
          </div>
        </div>
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        ${!isNew ? '<button class="flock-btn flock-btn--danger" data-delete style="margin-right:auto">Delete</button>' : ''}
        <button class="flock-btn" data-cancel>Close</button>
        <button class="flock-btn flock-btn--primary" data-save>${isNew ? 'Create Event' : 'Save Changes'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activePersonalSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    if (isNew) sheet.querySelector('[data-field="Title"]')?.focus();
  });

  const close = () => _closePersonalSheet();
  sheet.querySelector('[data-cancel]').addEventListener('click', close);
  sheet.querySelector('.life-sheet-close').addEventListener('click', close);

  // Show/hide day-of-week sub-row + auto-suggest from start date
  const _recurSel = sheet.querySelector('[data-field="RecurrenceRule"]');
  const _dowRow   = sheet.querySelector('[data-dow-row]');
  const _dateSel  = sheet.querySelector('[data-field="startDate"]');
  const _autoSuggestDow = () => {
    if (_recurSel.value !== 'MonthlyDow') return;
    const raw = _dateSel.value;
    if (!raw) return;
    const d = new Date(raw + 'T12:00:00');
    const dayName = DOW_NAMES[d.getDay()];
    const weekNum = Math.ceil(d.getDate() / 7);
    const ordName = weekNum <= 4 ? ORD_NAMES[weekNum - 1] : 'Last';
    sheet.querySelector('[data-field="recurOrdinal"]').value = ordName;
    sheet.querySelector('[data-field="recurDay"]').value = dayName;
  };
  _recurSel.addEventListener('change', () => {
    _dowRow.style.display = _recurSel.value === 'MonthlyDow' ? '' : 'none';
    _autoSuggestDow();
  });
  _dateSel.addEventListener('change', _autoSuggestDow);

  const _myEmail = () => window.Nehemiah?.getSession?.()?.email || window.TheVine?.session?.()?.email || '';

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl   = sheet.querySelector('[data-error]');
    const titleV  = sheet.querySelector('[data-field="Title"]').value.trim();
    const dateV   = sheet.querySelector('[data-field="startDate"]').value;
    if (!titleV) { errEl.textContent = 'Title is required.'; errEl.style.display = ''; return; }
    if (!dateV)  { errEl.textContent = 'Date is required.';  errEl.style.display = ''; return; }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = isNew ? 'Creating…' : 'Saving…';

    const startTimeV = sheet.querySelector('[data-field="startTime"]').value;
    const endTimeV   = sheet.querySelector('[data-field="endTime"]').value;
    const recurRuleV = sheet.querySelector('[data-field="RecurrenceRule"]').value;
    const payload = {
      Title:          titleV,
      StartDateTime:  dateV + (startTimeV ? 'T' + startTimeV : ''),
      EndDateTime:    dateV + (endTimeV   ? 'T' + endTimeV   : ''),
      Location:       sheet.querySelector('[data-field="Location"]').value.trim() || '',
      Description:    sheet.querySelector('[data-field="Description"]').value.trim() || '',
      Color:          sheet.querySelector('[data-field="Color"]').value,
      IsAllDay:       sheet.querySelector('[data-field="IsAllDay"]').value === 'true',
      RecurrenceRule: recurRuleV,
      RecurringDay:   recurRuleV === 'MonthlyDow'
        ? `${sheet.querySelector('[data-field="recurOrdinal"]').value} ${sheet.querySelector('[data-field="recurDay"]').value}`
        : '',
      RecurringUntil: sheet.querySelector('[data-field="RecurringUntil"]').value || '',
      AlertMinutes:   sheet.querySelector('[data-field="AlertMinutes"]').value || '',
      Visibility:     sheet.querySelector('[data-field="Visibility"]').value || 'private',
      CreatedBy:      _myEmail(),
    };
    if (!isNew) payload.EventID = id;

    try {
      if (UR && typeof UR.createCalendarEvent === 'function') {
        if (isNew) { await UR.createCalendarEvent(payload); }
        else       { await UR.updateCalendarEvent(payload); }
      } else if (V?.flock?.call) {
        if (isNew) { await V.flock.call('calendar.create', payload); }
        else       { await V.flock.call('calendar.update', payload); }
      }
      _closePersonalSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheSeasons] personal save error:', err);
      errEl.textContent = err?.message || 'Could not save event.';
      errEl.style.display = '';
      btn.disabled = false; btn.textContent = isNew ? 'Create Event' : 'Save Changes';
    }
  });

  sheet.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const btn = sheet.querySelector('[data-delete]');
    btn.disabled = true; btn.textContent = 'Deleting…';
    try {
      if (UR && typeof UR.deleteCalendarEvent === 'function') {
        await UR.deleteCalendarEvent(id);
      } else if (V?.flock?.call) {
        await V.flock.call('calendar.delete', { EventID: id });
      }
      _closePersonalSheet();
      onReload?.();
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Delete';
      alert(err?.message || 'Could not delete event.');
    }
  });
}


// ═══════════════════════════════════════════════════════════════════════════════
// TO-DOS & TASKS
// ═══════════════════════════════════════════════════════════════════════════════

function _closeTodoSheet() {
  if (!_activeTodoSheet) return;
  const t = _activeTodoSheet;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activeTodoSheet === t) _activeTodoSheet = null; }, 320);
}

async function _loadTodos(root) {
  const listEl = root.querySelector('.seasons-todo-list');
  if (!listEl) return;
  const V  = window.TheVine;
  const UR = window.UpperRoom;
  listEl.innerHTML = '<div class="life-empty">Loading tasks…</div>';

  try {
    let rows = [];
    if (UR && typeof UR.myTodos === 'function') {
      rows = await UR.myTodos();
      if (!Array.isArray(rows)) rows = rows?.rows || rows?.data || [];
    } else if (V?.flock?.todo?.myTasks) {
      const res = await V.flock.todo.myTasks({});
      rows = Array.isArray(res) ? res : (res?.rows || res?.data || []);
    } else if (V?.flock?.todo?.list) {
      const res = await V.flock.todo.list({});
      rows = Array.isArray(res) ? res : (res?.rows || res?.data || []);
    }

    if (!rows.length) {
      listEl.innerHTML = '<div class="life-empty">No tasks yet. Click "New Task" to add one.</div>';
      return;
    }

    // Sort: overdue first, then by priority, then by due date
    const pw = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
    const today = new Date().toISOString().substring(0, 10);
    const active = rows.filter(r => r.status !== 'Archived');
    active.sort((a, b) => {
      const ao = (a.dueDate && a.dueDate < today && a.status !== 'Done') ? 0 : 1;
      const bo = (b.dueDate && b.dueDate < today && b.status !== 'Done') ? 0 : 1;
      if (ao !== bo) return ao - bo;
      if ((pw[b.priority] || 0) !== (pw[a.priority] || 0)) return (pw[b.priority] || 0) - (pw[a.priority] || 0);
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });

    listEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">${active.map(_todoCard).join('')}</div>`;

    // Wire buttons
    listEl.querySelectorAll('[data-todo-complete]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const id = btn.dataset.todoComplete;
        if (!confirm('Mark as Done?')) return;
        try {
          if (UR?.completeTodo) { await UR.completeTodo(id); }
          else if (V?.flock?.todo?.complete) { await V.flock.todo.complete({ id }); }
          _loadTodos(root);
        } catch (err) { alert(err?.message || 'Could not complete task.'); }
      });
    });
    listEl.querySelectorAll('[data-todo-edit]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.todoEdit;
        const ev = rows.find(r => String(r.id) === id);
        if (ev) _openTodoSheet(ev, () => _loadTodos(root));
      });
    });
    listEl.querySelectorAll('[data-todo-delete]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const id = btn.dataset.todoDelete;
        const task = rows.find(r => String(r.id) === id);
        if (!confirm(`Delete "${task?.title || 'task'}"? This cannot be undone.`)) return;
        try {
          if (UR?.deleteTodo) { await UR.deleteTodo(id); }
          else if (V?.flock?.todo?.delete) { await V.flock.todo.delete({ id }); }
          _loadTodos(root);
        } catch (err) { alert(err?.message || 'Could not delete task.'); }
      });
    });
  } catch (err) {
    console.error('[TheSeasons] todos error:', err);
    listEl.innerHTML = '<div class="life-empty">Could not load tasks.</div>';
  }
}

function _todoCard(r) {
  const done    = r.status === 'Done';
  const today   = new Date().toISOString().substring(0, 10);
  const overdue = r.dueDate && r.dueDate < today && !done;
  const id      = String(r.id || '');
  const prioColor = { Urgent: '#dc2626', High: '#f59e0b', Medium: '#6366f1', Low: '#6b7280' }[r.priority] || '#6b7280';
  const prioIcon  = { Urgent: '⚠', High: '⬆', Medium: '➖', Low: '⬇' }[r.priority] || '➖';
  const borderColor = overdue ? '#dc2626' : done ? '#059669' : 'var(--line,#e5e7eb)';

  return /* html */`
    <div style="border:1px solid ${borderColor};border-radius:10px;padding:14px 16px;
                background:var(--bg-raised,#fff);display:flex;flex-direction:column;gap:8px;opacity:${done ? '.6' : '1'};">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:${prioColor};font-size:1rem;" title="${_e(r.priority || 'Medium')}">${prioIcon}</span>
        <span style="flex:1;font-weight:600;font-size:.92rem;${done ? 'text-decoration:line-through;color:#9ca3af;' : ''}">${_e(r.title || 'Untitled')}</span>
        ${!done ? `<button data-todo-complete="${_e(id)}" title="Mark Done"
          style="background:none;border:1px solid #059669;color:#059669;border-radius:50%;width:26px;height:26px;
                 cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✓</button>` : ''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:.72rem;">
        ${r.dueDate ? `<span style="font-weight:600;color:${overdue ? '#dc2626' : 'var(--ink,#111)'};">${overdue ? '⏰ ' : ''}${_e(r.dueDate)}</span>` : '<span style="color:#9ca3af;">No due date</span>'}
        <span style="padding:2px 7px;border-radius:4px;background:rgba(0,0,0,.05);color:${prioColor};">${_e(r.priority || 'Medium')}</span>
        <span style="padding:2px 7px;border-radius:4px;background:rgba(0,0,0,.05);color:var(--ink,#111);">${_e(r.status || 'Not Started')}</span>
        ${r.category ? `<span style="padding:2px 7px;border-radius:4px;background:rgba(99,102,241,.1);color:#6366f1;">${_e(r.category)}</span>` : ''}
        ${r.recurring ? `<span style="padding:2px 7px;border-radius:4px;background:rgba(0,0,0,.05);color:#e8a838;">🔁 ${_e(r.recurrenceRule || 'Repeating')}</span>` : ''}
      </div>
      ${r.description ? `<div style="font-size:.8rem;color:#6b7280;line-height:1.4;">${_e(r.description.length > 100 ? r.description.substring(0,100) + '…' : r.description)}</div>` : ''}
      <div style="display:flex;gap:6px;margin-top:2px;">
        <button data-todo-edit="${_e(id)}" style="background:none;border:1px solid var(--line,#e5e7eb);color:var(--ink,#111);border-radius:5px;padding:4px 10px;cursor:pointer;font-size:.76rem;font-family:inherit;">Edit</button>
        <button data-todo-delete="${_e(id)}" style="background:none;border:1px solid #dc2626;color:#dc2626;border-radius:5px;padding:4px 10px;cursor:pointer;font-size:.76rem;font-family:inherit;">Delete</button>
      </div>
    </div>`;
}

function _openTodoSheet(task, onReload) {
  _closeTodoSheet();
  const V  = window.TheVine;
  const UR = window.UpperRoom;
  const isNew = !task;
  const id    = task ? String(task.id || '') : '';

  const prioOptions  = TODO_PRIORITIES.map(p  => `<option${p  === (task?.priority || 'Medium') ? ' selected' : ''}>${_e(p)}</option>`).join('');
  const statusOptions= TODO_STATUSES.map(s   => `<option${s  === (task?.status   || 'Not Started') ? ' selected' : ''}>${_e(s)}</option>`).join('');
  const catOptions   = TODO_CATEGORIES.map(c => `<option${c  === (task?.category || 'Personal') ? ' selected' : ''}>${_e(c)}</option>`).join('');
  const recurOptions = [{ value: '', label: 'No' }, { value: 'true', label: 'Yes' }]
    .map(o => `<option value="${o.value}"${String(task?.recurring || '') === o.value ? ' selected' : ''}>${o.label}</option>`).join('');
  const recurRuleOptions = ['','Daily','Weekly','Biweekly','Monthly','Quarterly','Yearly']
    .map(v => `<option${v === (task?.recurrenceRule || '') ? ' selected' : ''}>${_e(v || '(none)')}</option>`).join('');

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isNew ? 'New Task' : 'Edit Task'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${isNew ? '✅ New Task' : '✏️ Edit Task'}</div>
          <div class="life-sheet-hd-meta">${isNew ? 'Add a to-do or personal task' : _e(task?.title || '')}</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Title <span style="color:#dc2626">*</span></div>
          <input class="life-sheet-input" data-field="title" type="text" value="${_e(task?.title || '')}" placeholder="e.g. Call the Johnsons">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Description</div>
          <textarea class="life-sheet-input" data-field="description" rows="2" style="resize:vertical">${_e(task?.description || '')}</textarea>
        </div>
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Due Date</div>
            <input class="life-sheet-input" data-field="dueDate" type="date" value="${_e(task?.dueDate || '')}">
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Priority</div>
            <select class="life-sheet-input" data-field="priority">${prioOptions}</select>
          </div>
        </div>
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Status</div>
            <select class="life-sheet-input" data-field="status">${statusOptions}</select>
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Category</div>
            <select class="life-sheet-input" data-field="category">${catOptions}</select>
          </div>
        </div>
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Repeating</div>
            <select class="life-sheet-input" data-field="recurring">${recurOptions}</select>
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Repeat Rule</div>
            <select class="life-sheet-input" data-field="recurrenceRule">${recurRuleOptions}</select>
          </div>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Notes</div>
          <textarea class="life-sheet-input" data-field="notes" rows="2" style="resize:vertical">${_e(task?.notes || '')}</textarea>
        </div>
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        ${!isNew ? '<button class="flock-btn flock-btn--danger" data-delete style="margin-right:auto">Delete</button>' : ''}
        <button class="flock-btn" data-cancel>Close</button>
        <button class="flock-btn flock-btn--primary" data-save>${isNew ? 'Create Task' : 'Save Changes'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeTodoSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    if (isNew) sheet.querySelector('[data-field="title"]')?.focus();
  });

  const close = () => _closeTodoSheet();
  sheet.querySelector('[data-cancel]').addEventListener('click', close);
  sheet.querySelector('.life-sheet-close').addEventListener('click', close);

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl  = sheet.querySelector('[data-error]');
    const titleV = sheet.querySelector('[data-field="title"]').value.trim();
    if (!titleV) { errEl.textContent = 'Title is required.'; errEl.style.display = ''; return; }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = isNew ? 'Creating…' : 'Saving…';
    const payload = {
      title:          titleV,
      description:    sheet.querySelector('[data-field="description"]').value.trim() || '',
      dueDate:        sheet.querySelector('[data-field="dueDate"]').value || '',
      priority:       sheet.querySelector('[data-field="priority"]').value,
      status:         sheet.querySelector('[data-field="status"]').value,
      category:       sheet.querySelector('[data-field="category"]').value,
      recurring:      sheet.querySelector('[data-field="recurring"]').value === 'true',
      recurrenceRule: sheet.querySelector('[data-field="recurrenceRule"]').value || '',
      notes:          sheet.querySelector('[data-field="notes"]').value.trim() || '',
    };
    if (!isNew) payload.id = id;
    try {
      if (UR?.createTodo && isNew)   { await UR.createTodo(payload); }
      else if (UR?.updateTodo && !isNew) { await UR.updateTodo(id, payload); }
      else if (V?.flock?.todo?.create && isNew)  { await V.flock.todo.create(payload); }
      else if (V?.flock?.todo?.update && !isNew) { await V.flock.todo.update(payload); }
      _closeTodoSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheSeasons] todo save error:', err);
      errEl.textContent = err?.message || 'Could not save task.';
      errEl.style.display = '';
      btn.disabled = false; btn.textContent = isNew ? 'Create Task' : 'Save Changes';
    }
  });

  sheet.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm(`Delete this task? This cannot be undone.`)) return;
    const btn = sheet.querySelector('[data-delete]');
    btn.disabled = true; btn.textContent = 'Deleting…';
    try {
      if (UR?.deleteTodo) { await UR.deleteTodo(id); }
      else if (V?.flock?.todo?.delete) { await V.flock.todo.delete({ id }); }
      _closeTodoSheet();
      onReload?.();
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Delete';
      alert(err?.message || 'Could not delete task.');
    }
  });
}


// ═══════════════════════════════════════════════════════════════════════════════
// BROWSER ALERT / REMINDER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

let _alertIntervalId    = null;
const _ALERTS_FIRED_KEY = 'flock_alerts_fired_';

function _alertFiredKey() {
  return _ALERTS_FIRED_KEY + new Date().toISOString().substring(0, 10);
}
function _alertGetFired() {
  try { return JSON.parse(localStorage.getItem(_alertFiredKey()) || '[]'); } catch (_) { return []; }
}
function _alertMarkFired(key) {
  const fired = _alertGetFired();
  if (!fired.includes(key)) { fired.push(key); localStorage.setItem(_alertFiredKey(), JSON.stringify(fired)); }
}

function _alertFire(title, time, loc, alertMins) {
  const minsLabel = alertMins >= 1440 ? '1 day'
    : alertMins >= 60 ? `${alertMins / 60} hour${alertMins / 60 > 1 ? 's' : ''}`
    : `${alertMins} min`;
  const body = `In ${minsLabel}: ${title}${time ? ' at ' + time : ''}${loc ? ' · ' + loc : ''}`;
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification('📅 FlockOS Reminder', { body, icon: '/favicon.ico' }); } catch (_) {}
  }
  // In-app toast
  const toast = document.createElement('div');
  toast.textContent = '⏰ ' + body;
  toast.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;font-size:.85rem;'
    + 'z-index:99999;color:#fff;background:#6366f1;box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:360px;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

function _alertCheck() {
  const V  = window.TheVine;
  const UR = window.UpperRoom;
  if (!UR && !V) return;
  const now   = new Date();
  const fired = _alertGetFired();

  // Check personal calendar events stored in localStorage cache
  const cacheKey = 'flock_personal_events_cache';
  let events = [];
  try { events = JSON.parse(localStorage.getItem(cacheKey) || '[]'); } catch (_) {}

  events.forEach(ev => {
    const alertMins = parseInt(ev.AlertMinutes || ev.alertMinutes || '0', 10);
    if (!alertMins) return;
    const dtStr = ev.StartDateTime || (ev.startDate ? ev.startDate + (ev.startTime ? 'T' + ev.startTime : '') : '');
    if (!dtStr) return;
    const eventDt  = new Date(dtStr);
    if (isNaN(eventDt.getTime())) return;
    const alertTime = new Date(eventDt.getTime() - alertMins * 60000);
    const diff      = now.getTime() - alertTime.getTime();
    const alertKey  = String(ev.EventID || ev.id || ev.Title) + '_' + dtStr + '_' + alertMins;
    if (diff >= 0 && diff < 60000 && !fired.includes(alertKey)) {
      _alertMarkFired(alertKey);
      const time = dtStr.includes('T') ? dtStr.substring(11, 16) : '';
      _alertFire(ev.Title || ev.title || 'Event', time, ev.Location || ev.location || '', alertMins);
    }
  });
}

function _alertStart() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
  if (_alertIntervalId) return;
  _alertCheck();
  _alertIntervalId = setInterval(_alertCheck, 60000);
}
