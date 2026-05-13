/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: Prayerful Action
   "Pray without ceasing. — 1 Thessalonians 5:17"
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';
import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';

export const name  = 'prayerful_action';
export const title = 'Prayerful Action';

const _e = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ── Static config ─────────────────────────────────────────────────────────── */
const STATS = [
  { label: 'Active Requests', value: '0', icon: '🙏' },
  { label: 'Answered',        value: '0', icon: '✅' },
  { label: 'Praying Today',   value: '0', icon: '👥' },
  { label: 'Days This Streak',value: '—', icon: '🔥' },
];

const FILTERS = ['All', 'Intercession', 'Praise', 'Personal', 'Urgent'];

const LITURGY = [
  {
    id: 'dawn',
    time: 'Dawn',
    label: 'Morning Watch',
    icon: '🌅',
    text: '"O LORD, in the morning you hear my voice." — Psalm 5:3 (ESV)',
    range: [4, 11],   // 4:00am – 10:59am
    callToPrayer: 'Lord, open my lips, and my mouth shall declare Your praise.',
    scripture: {
      ref: 'Psalm 5:1-3 (ESV)',
      text: 'Give ear to my words, O LORD; consider my groaning. Give attention to the sound of my cry, my King and my God, for to you do I pray. O LORD, in the morning you hear my voice; in the morning I prepare a sacrifice for you and watch.'
    },
    intercession: [
      'For the work of my hands today — may it be done as unto the Lord.',
      'For my family, that the Lord would go before them.',
      'For my pastors, elders, and the church.',
      'For one person who does not yet know Christ.',
    ],
    closing: 'Direct, control, suggest this day all I design, do, or say; that all my powers, with all their might, in Thy sole glory may unite. Amen.'
  },
  {
    id: 'midday',
    time: '12:00 PM',
    label: 'Midday Pause',
    icon: '☀️',
    text: '"Seven times a day I praise you." — Psalm 119:164 (ESV)',
    range: [11, 14],
    callToPrayer: 'In the middle of the day, I lift my eyes to the hills.',
    scripture: {
      ref: 'Psalm 121:1-2 (ESV)',
      text: 'I lift up my eyes to the hills. From where does my help come? My help comes from the LORD, who made heaven and earth.'
    },
    intercession: [
      'A pause of thanksgiving for what God has already done today.',
      'For wisdom in this afternoon’s decisions and conversations.',
      'For the poor, the hungry, and the weary.',
      'For peace where there is conflict.',
    ],
    closing: 'Father, You who never slumber nor sleep, sustain me through this day. Amen.'
  },
  {
    id: 'three',
    time: '3:00 PM',
    label: 'Hour of Prayer',
    icon: '⛪',
    text: '"Now Peter and John were going up to the temple at the hour of prayer." — Acts 3:1 (ESV)',
    range: [14, 17],
    callToPrayer: 'At the ninth hour, the hour our Savior bowed His head and gave up His Spirit.',
    scripture: {
      ref: 'Luke 23:44-46 (ESV)',
      text: 'It was now about the sixth hour, and there was darkness over the whole land until the ninth hour, while the sun’s light failed. And the curtain of the temple was torn in two. Then Jesus, calling out with a loud voice, said, “Father, into your hands I commit my spirit!” And having said this he breathed his last.'
    },
    intercession: [
      'Thanksgiving for the cross, the empty tomb, the open way.',
      'For the lost — that the Lord would send laborers into His harvest.',
      'For the sick, the dying, and those who tend them.',
      'For my own soul — search me, O God, and know my heart.',
    ],
    closing: 'Jesus, by Your death You have abolished death; by Your rising again You have restored to us everlasting life. Amen.'
  },
  {
    id: 'vespers',
    time: 'Evening',
    label: 'Evening Prayers',
    icon: '🌙',
    text: '"Let my prayer be counted as incense before you." — Psalm 141:2 (ESV)',
    range: [17, 23],
    callToPrayer: 'O God, make speed to save me; O Lord, make haste to help me.',
    scripture: {
      ref: 'Psalm 141:1-2 (ESV)',
      text: 'O LORD, I call upon you; hasten to me! Give ear to my voice when I call to you! Let my prayer be counted as incense before you, and the lifting up of my hands as the evening sacrifice!'
    },
    intercession: [
      'A confession of today’s failures — in thought, word, and deed.',
      'Thanksgiving for the mercies of this day.',
      'For all who travel, who labor through the night, who cannot sleep.',
      'For peaceful rest, and waking to serve You again.',
    ],
    closing: 'Lighten our darkness, we beseech thee, O Lord; and by thy great mercy defend us from all perils and dangers of this night. Amen.'
  },
];

// Pick the current liturgical hour from local clock time. Defaults to Dawn.
function _currentHour() {
  const h = new Date().getHours();
  return LITURGY.find(l => h >= l.range[0] && h < l.range[1]) || LITURGY[0];
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function typeBadge(t) {
  const m = { Intercession: ['rgba(124,58,237,0.12)','#7c3aed'], Praise: ['rgba(232,168,56,0.14)','#b45309'], Personal: ['rgba(14,165,233,0.12)','#0369a1'], Urgent: ['rgba(220,38,38,0.12)','#dc2626'] };
  const [bg, c] = m[t] || ['rgba(113,113,122,0.1)','#52525b'];
  return `<span class="pray-type-badge" style="background:${bg};color:${c}">${_e(t)}</span>`;
}

/* ── Render ───────────────────────────────────────────────────────────────── */
export function render() {
  return `
<section class="pray-view">
  ${pageHero({
    title: 'Prayerful Action',
    subtitle: 'Prayer journal — requests, answers, and daily liturgy.',
    scripture: 'Pray without ceasing. — 1 Thessalonians 5:17',
  })}

  <!-- Stats -->
  <div class="pray-stats">
    ${STATS.map(s => `
    <div class="pray-stat-card">
      <div class="pray-stat-icon">${s.icon}</div>
      <div class="pray-stat-val">${_e(s.value)}</div>
      <div class="pray-stat-label">${_e(s.label)}</div>
    </div>`).join('')}
  </div>

  <!-- Main columns -->
  <div class="pray-columns">

    <!-- Left: prayer journal -->
    <div class="pray-journal">

      <!-- Toolbar -->
      <div class="pray-toolbar">
        <div class="pray-filters">
          ${FILTERS.map((f, i) => `<button class="pray-filter ${i === 0 ? 'is-active' : ''}" data-filter="${_e(f)}">${_e(f)}</button>`).join('')}
        </div>
        <button class="btn btn-primary" style="font-size:.8rem;padding:7px 16px" id="pray-add-btn">+ Add Request</button>
      </div>

      <!-- Active requests (filled live by mount) -->
      <div class="pray-section-label">Active</div>
      <div class="pray-list" id="pray-active-list">
        <div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Loading prayer requests…</div>
      </div>

      <!-- Answered (filled live by mount) -->
      <div class="pray-section-label" style="margin-top:8px">Answered</div>
      <div class="pray-list" id="pray-answered-list">
        <div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Loading…</div>
      </div>

    </div>

    <!-- Right: daily liturgy -->
    <div class="pray-liturgy-col">
      <div class="pray-liturgy-card">
        <div class="pray-liturgy-title">Daily Prayer Hours</div>
        <div class="pray-liturgy-verse">"Evening, morning and noon I cry out in distress, and he hears my voice." — Psalm 55:17</div>
        <div class="pray-liturgy-list">
          ${LITURGY.map(l => {
            const isNow = l.id === _currentHour().id;
            return `
            <div class="pray-liturgy-row${isNow ? ' is-now' : ''}" data-hour="${_e(l.id)}" tabindex="0" role="button" aria-label="Begin ${_e(l.label)}">
              <div class="pray-lit-icon">${l.icon}</div>
              <div class="pray-lit-body">
                <div class="pray-lit-time">${_e(l.time)} — ${_e(l.label)}${isNow ? ' <span class="pray-lit-now-pill">Now</span>' : ''}</div>
                <div class="pray-lit-text">${_e(l.text)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
        <button class="btn btn-outline" id="pray-begin-btn" style="width:100%;margin-top:16px;font-size:.82rem">Begin ${_e(_currentHour().label)}</button>
      </div>

      <!-- Scripture of the day -->
      <div class="pray-scripture-card">
        <div class="pray-scripture-label">Scripture of the Day</div>
        <div class="pray-scripture-ref">Philippians 4:6</div>
        <div class="pray-scripture-text">"Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God."</div>
      </div>
    </div>

  </div>

</section>`;
}

export function mount(root) {
  /* Filter chips */
  const filters = root.querySelectorAll('.pray-filter');
  function _applyFilter(f) {
    root.querySelectorAll('.pray-card').forEach(c => {
      c.style.display = (f === 'All' || c.dataset.type === f || (f === 'Urgent' && c.classList.contains('pray-card--urgent'))) ? '' : 'none';
    });
  }
  filters.forEach(btn => btn.addEventListener('click', () => {
    filters.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    _applyFilter(btn.dataset.filter);
  }));

  _wireInteractiveButtons(root);
  _loadPrayer(root, filters);

  // Add Request button
  root.querySelector('#pray-add-btn')?.addEventListener('click', () => _openAddRequestSheet(() => _loadPrayer(root, filters)));

  // Daily Prayer Hours — click any row, or the main Begin button, to open guided liturgy
  root.querySelector('#pray-begin-btn')?.addEventListener('click', () => _openLiturgySheet(_currentHour(), root));
  root.querySelectorAll('.pray-liturgy-row').forEach((row) => {
    const open = () => {
      const hour = LITURGY.find(l => l.id === row.dataset.hour);
      if (hour) _openLiturgySheet(hour, root);
    };
    row.addEventListener('click', open);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  return () => { _closePraySheet(); _closeLiturgySheet(); };
}

function _wireInteractiveButtons(root) {
  const UR = window.UpperRoom;
  const V  = window.TheVine;

  /* "I Prayed" counter bump — writes to UpperRoom (Firestore) first */
  root.querySelectorAll('.pray-pray-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.textContent.match(/\((\d+)\)/);
      if (!m) return;
      const newCount = +m[1] + 1;
      btn.textContent = btn.textContent.replace(/\(\d+\)/, `(${newCount})`);
      const rid = btn.dataset.rid;
      if (!rid || rid === 'demo') return;
      if (UR && typeof UR.updatePrayer === 'function') {
        UR.updatePrayer(rid, { prayCount: newCount }).catch(() => {});
      } else {
        V?.flock?.prayer?.update({ id: rid, prayCount: newCount }).catch(() => {});
      }
    });
  });

  /* Mark answered — remove card with live update */
  root.querySelectorAll('.pray-answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.pray-card');
      const rid  = btn.dataset.rid;
      if (rid && rid !== 'demo') {
        if (UR && typeof UR.updatePrayer === 'function') {
          UR.updatePrayer(rid, { status: 'Answered' }).catch(() => {});
        } else {
          V?.flock?.prayer?.update({ id: rid, status: 'Answered' }).catch(() => {});
        }
      }
      card.style.transition = 'opacity 300ms, transform 300ms';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(() => card.remove(), 320);
    });
  });
}

const _CLOSED_PRAY = new Set(['answered', 'closed', 'archived', 'deleted']);

function _normalizeCategory(raw) {
  const s = (raw || '').toLowerCase().replace(/[-_\s]/g, '');
  if (s.includes('praise') || s.includes('thanksgiving') || s.includes('gratitude')) return 'Praise';
  if (s.includes('urgent') || s.includes('crisis') || s.includes('emergency'))       return 'Urgent';
  if (s.includes('personal') || s.includes('family') || s.includes('marriage')
    || s.includes('health') || s.includes('job') || s.includes('financial'))         return 'Personal';
  return 'Intercession'; // default — church, missions, spiritual, general
}

function _liveCard(r, isAnswered) {
  const id    = r.id || r.requestId || 'demo';
  const type  = _normalizeCategory(r.category || r.type || '');
  const name  = r.submitterName  || r.name || 'Anonymous';
  const text  = r.prayerText     || r.text || r.description || '';
  const date  = _fmtDate(r.submittedAt || r.createdAt);
  const prays = Number(r.prayCount || r.prayerCount || 0);
  const urgent = type === 'Urgent' || (r.priority || '').toLowerCase() === 'urgent';
  const conf  = r.isConfidential === true || String(r.isConfidential || '').toUpperCase() === 'TRUE';

  const cardHtml = `
    <div class="pray-card${urgent ? ' pray-card--urgent' : ''}${isAnswered ? ' pray-card--answered' : ''}" data-type="${_e(type)}">
      <div class="pray-card-head">
        ${typeBadge(type)}
        ${urgent ? '<span class="pray-urgent-badge">Urgent</span>' : ''}
        ${isAnswered ? '<span class="pray-answered-badge">Answered ✅</span>' : ''}
        <span class="pray-card-date">${_e(date)}</span>
        ${conf ? '<span class="pray-conf-icon" title="Confidential">🔒</span>' : ''}
      </div>
      <div class="pray-card-name">${_e(name)}</div>
      <div class="pray-card-text">${_e(text)}</div>
      ${isAnswered
        ? `<div class="pray-card-prays" style="font:.72rem var(--font-ui);color:var(--ink-muted,#7a7f96);margin-top:4px">${prays || ''} ${prays ? 'people prayed' : ''}</div>`
        : `<div class="pray-card-foot">
             <button class="pray-pray-btn" data-rid="${_e(String(id))}">🙏 I Prayed (${prays})</button>
             <button class="pray-answer-btn" data-rid="${_e(String(id))}">✅ Mark Answered</button>
           </div>`}
    </div>`;
  return cardHtml;
}

function _fmtDate(ts) {
  if (!ts) return '';
  try {
    const ms = ts?.seconds ? ts.seconds * 1000 : new Date(ts).getTime();
    if (!ms || isNaN(ms)) return '';
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (_) { return ''; }
}

async function _loadPrayer(root, filterBtns) {
  const V  = window.TheVine;
  const MX = buildAdapter('flock.prayer', V);
  const UR = window.UpperRoom;

  // Loading state
  const activeList   = root.querySelector('#pray-active-list');
  const answeredList = root.querySelector('#pray-answered-list');
  if (activeList)   activeList.innerHTML   = '<div style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Loading prayer requests…</div>';
  if (answeredList) answeredList.innerHTML = '<div style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Loading…</div>';

  try {
    let all = [];
    // UpperRoom (Firestore prayers) is authoritative
    if (UR && typeof UR.listPrayers === 'function') {
      try {
        const r = await UR.listPrayers({ allUsers: true, limit: 100 });
        all = Array.isArray(r) ? r : (r?.rows ?? r?.data ?? []);
      } catch (_) {}
    }
    // Fallback to TheVine GAS via adapter
    if (!all.length) {
      try {
        const res = await MX.list({ limit: 50 });
        all = Array.isArray(res) ? res : (res?.rows ?? res?.data ?? []);
      } catch (_) {}
    }

    const _tsN = (v) => { if (!v) return 0; if (typeof v === 'object' && v.seconds) return v.seconds * 1000; return new Date(v).getTime() || 0; };
    const _byNewest = (a, b) => _tsN(b.submittedAt || b.createdAt) - _tsN(a.submittedAt || a.createdAt);
    const active   = all.filter(r => !_CLOSED_PRAY.has((r.status || 'new').toLowerCase())).sort(_byNewest);
    const answered = all.filter(r => (r.status || '').toLowerCase() === 'answered').sort(_byNewest);

    // Update stats strip with live counts
    const urgentN  = active.filter(r => _normalizeCategory(r.category || '') === 'Urgent').length;
    const answeredN = answered.length;
    const prayingN  = active.reduce((n, r) => n + Number(r.prayCount || 0), 0);
    const _setStat = (idx, val) => {
      const cards = root.querySelectorAll('.pray-stat-card');
      const el    = cards[idx]?.querySelector('.pray-stat-val');
      if (el) el.textContent = String(val);
    };
    _setStat(0, active.length);
    _setStat(1, answeredN);
    _setStat(2, prayingN || active.length);

    // Replace active list
    const activeList = root.querySelector('#pray-active-list');
    if (activeList) {
      const lbl = activeList.previousElementSibling;
      if (lbl && lbl.classList.contains('pray-section-label')) lbl.textContent = `Active (${active.length})`;
      activeList.innerHTML = active.length
        ? active.map(r => _liveCard(r, false)).join('')
        : `<div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">No active prayer requests right now.</div>`;
    }

    // Replace answered list
    const answeredList = root.querySelector('#pray-answered-list');
    if (answeredList) {
      const lbl = answeredList.previousElementSibling;
      if (lbl && lbl.classList.contains('pray-section-label')) lbl.textContent = `Answered (${answered.length})`;
      answeredList.innerHTML = answered.length
        ? answered.map(r => _liveCard(r, true)).join('')
        : `<div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">No answered prayers recorded yet.</div>`;
    }

    // Re-wire interactive buttons with live rids
    _wireInteractiveButtons(root);

    // Re-apply active filter
    const activeFilter = root.querySelector('.pray-filter.is-active');
    if (activeFilter) {
      root.querySelectorAll('.pray-card').forEach(c => {
        const f = activeFilter.dataset.filter;
        c.style.display = (f === 'All' || c.dataset.type === f || (f === 'Urgent' && c.classList.contains('pray-card--urgent'))) ? '' : 'none';
      });
    }
  } catch (err) {
    console.error('[PrayerfulAction] prayer.list failed:', err);
    if (activeList)   activeList.innerHTML   = '<div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Could not load prayer requests right now.</div>';
    if (answeredList) answeredList.innerHTML = '<div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Could not load answered prayers.</div>';
  }
}

// ── Add Prayer Request sheet ─────────────────────────────────────────────────
let _activePraySheet = null;

function _closePraySheet() {
  if (!_activePraySheet) return;
  const t = _activePraySheet;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activePraySheet === t) _activePraySheet = null; }, 320);
}

function _openAddRequestSheet(onReload) {
  _closePraySheet();
  const V  = window.TheVine;
  const MX = buildAdapter('flock.prayer', V);
  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="New Prayer Request">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">New Prayer Request</div>
          <div class="life-sheet-hd-meta">Submit a request to the church prayer team</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Name <span style="color:#6b7280;font-weight:400">(or leave blank for anonymous)</span></div>
          <input class="life-sheet-input" data-field="name" type="text" placeholder="Your name">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Prayer Request <span style="color:#dc2626">*</span></div>
          <textarea class="life-sheet-input" data-field="prayerText" rows="4" style="resize:vertical" placeholder="Share your prayer request…"></textarea>
        </div>
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Category</div>
            <select class="life-sheet-input" data-field="category">
              <option value="Intercession">Intercession</option>
              <option value="Praise">Praise &amp; Thanksgiving</option>
              <option value="Personal">Personal</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Priority</div>
            <select class="life-sheet-input" data-field="priority">
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div class="life-sheet-field" style="display:flex;align-items:center;gap:10px;margin-top:4px">
          <input type="checkbox" id="pray-conf-chk" data-field="isConfidential" style="width:16px;height:16px;cursor:pointer">
          <label for="pray-conf-chk" style="font:.88rem var(--font-ui);cursor:pointer">🔒 Keep confidential (prayer team only)</label>
        </div>
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>Submit Request</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activePraySheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    sheet.querySelector('[data-field="prayerText"]')?.focus();
  });

  const close = () => _closePraySheet();
  sheet.querySelector('[data-cancel]').addEventListener('click', close);
  sheet.querySelector('.life-sheet-close').addEventListener('click', close);

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl    = sheet.querySelector('[data-error]');
    const textVal  = sheet.querySelector('[data-field="prayerText"]').value.trim();
    if (!textVal) { errEl.textContent = 'Please enter a prayer request.'; errEl.style.display = ''; return; }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Submitting…';
    // Convert checkbox boolean → 'TRUE'/'FALSE' string (Firestore createPrayer expects strings)
    const isConfChecked = sheet.querySelector('[data-field="isConfidential"]').checked;
    const payload = {
      submitterName:   sheet.querySelector('[data-field="name"]').value.trim() || 'Anonymous',
      prayerText:      textVal,
      category:        sheet.querySelector('[data-field="category"]').value,
      priority:        sheet.querySelector('[data-field="priority"]').value,
      isConfidential:  isConfChecked ? 'TRUE' : 'FALSE',
      status:          'New',
    };
    try {
      const UR = window.UpperRoom;
      // Firestore (UpperRoom) is the source of truth — reads come from here
      if (UR && typeof UR.createPrayer === 'function') {
        await UR.createPrayer(payload);
      } else {
        // Legacy GAS fallback via adapter if Firestore isn't available
        await MX.create(payload);
      }
      _closePraySheet();
      onReload?.();
    } catch (err) {
      console.error('[PrayerfulAction] prayer.create error:', err);
      errEl.textContent = err?.message || 'Could not submit request. Please try again.';
      errEl.style.display = '';
      btn.disabled = false; btn.textContent = 'Submit Request';
    }
  });
}

// ── Daily Prayer Hours — guided liturgy sheet ────────────────────────────────
let _activeLiturgySheet = null;

function _closeLiturgySheet() {
  if (!_activeLiturgySheet) return;
  const t = _activeLiturgySheet;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activeLiturgySheet === t) _activeLiturgySheet = null; }, 320);
}

function _openLiturgySheet(hour, root) {
  _closeLiturgySheet();
  if (!hour) return;

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel pray-liturgy-sheet" role="dialog" aria-label="${_e(hour.label)}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${hour.icon} ${_e(hour.label)}</div>
          <div class="life-sheet-hd-meta">${_e(hour.time)} — Daily Prayer Hours</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">

        <!-- Step 1: Call to Prayer -->
        <div class="pray-lit-step" data-step="1">
          <div class="pray-lit-step-label">Step 1 — Call to Prayer</div>
          <div class="pray-lit-call">${_e(hour.callToPrayer)}</div>
        </div>

        <!-- Step 2: Scripture -->
        <div class="pray-lit-step" data-step="2">
          <div class="pray-lit-step-label">Step 2 — Scripture Reading</div>
          <div class="pray-lit-scripture-ref">${_e(hour.scripture.ref)}</div>
          <div class="pray-lit-scripture-text">${_e(hour.scripture.text)}</div>
        </div>

        <!-- Step 3: Intercession -->
        <div class="pray-lit-step" data-step="3">
          <div class="pray-lit-step-label">Step 3 — Intercession</div>
          <div class="pray-lit-intercession">
            ${hour.intercession.map((line, i) => `
              <label class="pray-lit-prompt">
                <input type="checkbox" data-prompt="${i}">
                <span>${_e(line)}</span>
              </label>`).join('')}
          </div>
        </div>

        <!-- Step 4: Closing -->
        <div class="pray-lit-step" data-step="4">
          <div class="pray-lit-step-label">Step 4 — Closing Prayer</div>
          <div class="pray-lit-closing">${_e(hour.closing)}</div>
        </div>

      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" data-cancel>Close</button>
        <button class="flock-btn flock-btn--primary" data-complete>Mark Complete (Amen)</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeLiturgySheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
  });

  const close = () => _closeLiturgySheet();
  sheet.querySelector('[data-cancel]').addEventListener('click', close);
  sheet.querySelector('.life-sheet-close').addEventListener('click', close);
  sheet.querySelector('.life-sheet-overlay').addEventListener('click', close);

  sheet.querySelector('[data-complete]').addEventListener('click', () => {
    // Local-only completion log so the streak stat can react. UpperRoom backend
    // hook can be added later — the schema isn't defined yet.
    try {
      const key = 'flockos:liturgy:' + new Date().toISOString().slice(0, 10);
      const done = JSON.parse(localStorage.getItem(key) || '[]');
      if (!done.includes(hour.id)) done.push(hour.id);
      localStorage.setItem(key, JSON.stringify(done));
      _updateStreakStat(root);
    } catch (_) {}
    _closeLiturgySheet();
  });
}

// Compute consecutive-day streak from local liturgy completion log.
function _updateStreakStat(root) {
  let streak = 0;
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = 'flockos:liturgy:' + d.toISOString().slice(0, 10);
      const done = JSON.parse(localStorage.getItem(key) || '[]');
      if (done.length > 0) streak++; else break;
    }
  } catch (_) {}
  const cards = root.querySelectorAll('.pray-stat-card');
  const el = cards[3]?.querySelector('.pray-stat-val');
  if (el) el.textContent = streak ? String(streak) : '—';
}
