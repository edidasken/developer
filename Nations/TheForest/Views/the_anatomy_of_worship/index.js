/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: The Anatomy of Worship
   "Worship the LORD in the beauty of holiness. — Psalm 29:2"
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';

export const name  = 'the_anatomy_of_worship';
export const title = 'The Anatomy of Worship';

const _e = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ── Service definitions ──────────────────────────────────────────────────── */
const SERVICES = [
  { id: 'sunday',  label: 'Sunday Morning',  time: '10:00 AM', date: 'May 11, 2026' },
  { id: 'evening', label: 'Sunday Evening',  time: '6:00 PM',  date: 'May 11, 2026' },
  { id: 'midweek', label: 'Wednesday Night', time: '7:00 PM',  date: 'May 13, 2026' },
];

const SEGMENT_TYPES = {
  prelude:    { icon: '🎵', color: '#7c3aed', label: 'Prelude'       },
  welcome:    { icon: '🙌', color: '#0ea5e9', label: 'Welcome'       },
  worship:    { icon: '🎶', color: '#e8a838', label: 'Worship Set'   },
  scripture:  { icon: '📖', color: '#059669', label: 'Scripture'     },
  sermon:     { icon: '🕊️', color: '#1b264f', label: 'Sermon'        },
  offering:   { icon: '🪙', color: '#e8a838', label: 'Offering'      },
  communion:  { icon: '🍞', color: '#dc2626', label: 'Communion'     },
  prayer:     { icon: '🙏', color: '#7c3aed', label: 'Prayer'        },
  dismiss:    { icon: '✝️', color: '#059669', label: 'Dismissal'     },
  responsive: { icon: '📣', color: '#0ea5e9', label: 'Responsive'    },
};

/* ── Default template (used when no saved data exists) ────────────────────── */
const DEFAULT_ORDER = [
  { type: 'prelude',    title: 'Prelude Music',              leader: 'Worship Team',   mins: 10, note: 'Instrumental — set a tone of reverence' },
  { type: 'welcome',    title: 'Welcome & Announcements',    leader: '',               mins: 5,  note: '' },
  { type: 'worship',    title: 'Opening Worship Set',        leader: 'Worship Team',   mins: 20, note: '"How Great Is Our God", "10,000 Reasons", "Great Are You Lord"' },
  { type: 'responsive', title: 'Call to Worship',            leader: 'Congregation',   mins: 3,  note: 'Psalm 100 — responsive reading' },
  { type: 'scripture',  title: 'Scripture Reading',          leader: '',               mins: 5,  note: 'John 15:1-17 — The Vine and the Branches' },
  { type: 'prayer',     title: 'Pastoral Prayer',            leader: '',               mins: 5,  note: 'Intercession for congregation + community' },
  { type: 'sermon',     title: 'Sermon: Abide in the Vine', leader: '',               mins: 40, note: 'Series: Kingdom Roots, Week 3' },
  { type: 'offering',   title: 'Tithes & Offerings',         leader: 'Deacon Board',   mins: 5,  note: 'Online giving available — tithes.flockos.app' },
  { type: 'communion',  title: "Lord's Supper",              leader: 'Elder Board',    mins: 10, note: 'Open to all baptized believers' },
  { type: 'worship',    title: 'Closing Worship',            leader: 'Worship Team',   mins: 8,  note: '"Doxology", "Blessed Be Your Name"' },
  { type: 'dismiss',    title: 'Benediction & Dismissal',    leader: '',               mins: 2,  note: '' },
];

/* ── Render shell — list content is injected by mount() ──────────────────── */
export function render() {
  return `
<section class="aow-view">
  ${pageHero({
    title: 'The Anatomy of Worship',
    subtitle: 'Liturgical structure, service flow, and worship arts.',
    scripture: 'Worship the LORD in the beauty of holiness. — Psalm 29:2',
  })}

  <!-- Service selector -->
  <div class="aow-header-row">
    <div class="aow-service-tabs">
      ${SERVICES.map((s, i) => `
      <button class="aow-service-tab ${i === 0 ? 'is-active' : ''}" data-svc="${_e(s.id)}">
        <span class="aow-tab-label">${_e(s.label)}</span>
        <span class="aow-tab-time">${_e(s.time)} &middot; ${_e(s.date)}</span>
      </button>`).join('')}
    </div>
  </div>

  <!-- Time budget bar -->
  <div class="aow-budget-row">
    <div class="aow-budget-label">Service length: <strong id="aow-total-mins">—</strong></div>
    <div class="aow-budget-track" id="aow-budget-track"></div>
    <span id="aow-save-status" style="font:600 0.74rem var(--font-ui,sans-serif);margin-left:8px;flex-shrink:0;"></span>
  </div>

  <!-- Editable segment list -->
  <div class="aow-segments" id="aow-list"></div>

  <div style="margin-top:10px;">
    <button class="aow-btn-add" id="aow-add-btn">+ Add Item</button>
  </div>

</section>`;
}

/* ── Mount — all state, editing, and rendering happens here ───────────────── */
export function mount(root) {
  const LS_KEY = 'aow_orders_v1';
  let activeService = 'sunday';
  let saving = false;

  /* ── Helpers ── */
  function _isFB() {
    return typeof UpperRoom !== 'undefined' && typeof UpperRoom.saveServiceOrder === 'function';
  }
  function _isGAS() {
    return typeof TheVine !== 'undefined' && TheVine.flock && TheVine.flock.serviceOrders;
  }

  /* ── Local cache (write-through, used for immediate render) ── */
  function loadLocal() {
    try { const r = localStorage.getItem(LS_KEY); if (r) return JSON.parse(r); } catch (_) {}
    return null;
  }
  function saveLocal(orders) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(orders)); } catch (_) {}
  }

  /* ── In-memory orders, seeded from cache first, then Firestore ── */
  let orders = loadLocal() || {
    sunday:  JSON.parse(JSON.stringify(DEFAULT_ORDER)),
    evening: JSON.parse(JSON.stringify(DEFAULT_ORDER)),
    midweek: JSON.parse(JSON.stringify(DEFAULT_ORDER)),
  };

  function getOrder() { return orders[activeService] || []; }

  /* ── Save to backend (+ update local cache) ── */
  async function saveOrder() {
    saveLocal(orders);
    if (!_isFB() && !_isGAS()) return;
    saving = true;
    setSaveStatus('saving');
    try {
      if (_isFB()) {
        await UpperRoom.saveServiceOrder(activeService, getOrder());
      } else {
        await TheVine.flock.serviceOrders.save({ id: activeService, items: getOrder() });
      }
      setSaveStatus('saved');
    } catch (err) {
      console.error('AOW: save failed', err);
      setSaveStatus('error');
    } finally {
      saving = false;
    }
  }

  function setSaveStatus(state) {
    const el = root.querySelector('#aow-save-status');
    if (!el) return;
    if (state === 'saving') { el.textContent = 'Saving…'; el.style.color = '#7a7f96'; }
    else if (state === 'saved') { el.textContent = 'Saved ✓'; el.style.color = '#059669'; setTimeout(() => { el.textContent = ''; }, 2000); }
    else if (state === 'error') { el.textContent = 'Save failed'; el.style.color = '#dc2626'; }
  }

  /* ── Load all three services from backend on mount ── */
  async function loadFromFirestore() {
    if (!_isFB() && !_isGAS()) return;
    try {
      const ids = ['sunday', 'evening', 'midweek'];
      let results;
      if (_isFB()) {
        results = await Promise.all(ids.map(id => UpperRoom.getServiceOrder(id)));
      } else {
        results = await Promise.all(ids.map(id => TheVine.flock.serviceOrders.get({ id })
          .then(r => r && r.items ? r : null).catch(() => null)));
      }
      let changed = false;
      ids.forEach((id, i) => {
        if (results[i] && Array.isArray(results[i].items) && results[i].items.length) {
          orders[id] = results[i].items;
          changed = true;
        }
      });
      if (changed) {
        saveLocal(orders);
        renderList();
      }
    } catch (err) {
      console.error('AOW: load failed', err);
    }
  }

  /* ── Build a read-only segment row ── */
  function segmentHTML(seg, i) {
    const def = SEGMENT_TYPES[seg.type] || SEGMENT_TYPES.worship;
    return `
    <div class="aow-segment" data-idx="${i}">
      <div class="aow-seg-grip">⠿</div>
      <div class="aow-seg-icon" style="background:${def.color}20;color:${def.color}">${def.icon}</div>
      <div class="aow-seg-body">
        <div class="aow-seg-title">${_e(seg.title)}</div>
        <div class="aow-seg-meta">
          <span class="aow-type-badge" style="background:${def.color}18;color:${def.color}">${_e(def.label)}</span>
          <span class="aow-seg-leader">👤 ${_e(seg.leader)}</span>
          ${seg.note ? `<span class="aow-seg-note">${_e(seg.note)}</span>` : ''}
        </div>
      </div>
      <div class="aow-seg-mins">
        <span class="aow-min-val">${seg.mins}</span>
        <span class="aow-min-unit">min</span>
      </div>
      <div class="aow-seg-actions">
        <button class="aow-btn-edit" data-idx="${i}" title="Edit">✏️</button>
        <button class="aow-btn-move" data-idx="${i}" data-dir="up"   title="Move up">↑</button>
        <button class="aow-btn-move" data-idx="${i}" data-dir="down" title="Move down">↓</button>
      </div>
    </div>`;
  }

  /* ── Build the inline edit form for a segment ── */
  function editFormHTML(seg, i) {
    const typeOptions = Object.entries(SEGMENT_TYPES).map(([k, v]) =>
      `<option value="${k}" ${k === seg.type ? 'selected' : ''}>${v.icon} ${v.label}</option>`
    ).join('');
    const def = SEGMENT_TYPES[seg.type] || SEGMENT_TYPES.worship;
    return `
    <div class="aow-segment aow-segment--editing" data-idx="${i}">
      <div class="aow-seg-icon" style="background:${def.color}20;color:${def.color}" id="aow-edit-icon-${i}">${def.icon}</div>
      <div class="aow-seg-edit-form">
        <div class="aow-edit-row">
          <select class="aow-edit-input aow-edit-type" data-edit-idx="${i}">
            ${typeOptions}
          </select>
          <input class="aow-edit-input aow-edit-title" type="text" value="${_e(seg.title)}" placeholder="Title">
          <input class="aow-edit-input aow-edit-mins" type="number" min="1" max="180" value="${seg.mins}" placeholder="Min">
        </div>
        <div class="aow-edit-row">
          <input class="aow-edit-input aow-edit-leader" type="text" value="${_e(seg.leader)}" placeholder="Leader / participant">
          <input class="aow-edit-input aow-edit-note" type="text" value="${_e(seg.note || '')}" placeholder="Notes">
        </div>
        <div class="aow-edit-actions">
          <button class="aow-edit-save">Save</button>
          <button class="aow-edit-cancel">Cancel</button>
          <button class="aow-edit-delete">Delete</button>
        </div>
      </div>
    </div>`;
  }

  /* ── Render / refresh the full list ── */
  function renderList() {
    const list = root.querySelector('#aow-list');
    if (!list) return;
    const order = getOrder();

    // Time budget
    const total = order.reduce((a, s) => a + (Number(s.mins) || 0), 0);
    const totalEl = root.querySelector('#aow-total-mins');
    if (totalEl) totalEl.textContent = total + ' min';
    const track = root.querySelector('#aow-budget-track');
    if (track && total > 0) {
      track.innerHTML = order.map(s => {
        const def = SEGMENT_TYPES[s.type] || SEGMENT_TYPES.worship;
        const w = ((Number(s.mins) / total) * 100).toFixed(1);
        return `<div class="aow-budget-seg" style="width:${w}%;background:${def.color}" title="${_e(def.label)}: ${s.mins}min"></div>`;
      }).join('');
    }

    list.innerHTML = order.map((seg, i) => segmentHTML(seg, i)).join('');
    bindListEvents();
  }

  /* ── Open inline edit for a segment ── */
  function openEdit(idx) {
    const order = getOrder();
    const seg = order[idx];
    if (!seg) return;
    const list = root.querySelector('#aow-list');
    const segEl = list.querySelector(`.aow-segment[data-idx="${idx}"]`);
    if (!segEl) return;

    segEl.outerHTML = editFormHTML(seg, idx);

    const editEl = list.querySelector(`.aow-segment[data-idx="${idx}"]`);
    if (!editEl) return;

    // Live-update icon when type changes
    editEl.querySelector('.aow-edit-type').addEventListener('change', function() {
      const def = SEGMENT_TYPES[this.value] || SEGMENT_TYPES.worship;
      const iconEl = editEl.querySelector(`#aow-edit-icon-${idx}`);
      if (iconEl) {
        iconEl.textContent = def.icon;
        iconEl.style.background = def.color + '20';
        iconEl.style.color = def.color;
      }
    });

    editEl.querySelector('.aow-edit-save').addEventListener('click', () => {
      const order = getOrder();
      order[idx] = {
        type:   editEl.querySelector('.aow-edit-type').value,
        title:  editEl.querySelector('.aow-edit-title').value.trim() || seg.title,
        leader: editEl.querySelector('.aow-edit-leader').value.trim(),
        mins:   Math.max(1, Number(editEl.querySelector('.aow-edit-mins').value) || seg.mins),
        note:   editEl.querySelector('.aow-edit-note').value.trim(),
      };
      saveOrder();
      renderList();
    });

    editEl.querySelector('.aow-edit-cancel').addEventListener('click', () => renderList());

    editEl.querySelector('.aow-edit-delete').addEventListener('click', () => {
      if (!confirm(`Delete "${seg.title}"?`)) return;
      getOrder().splice(idx, 1);
      saveOrder();
      renderList();
    });

    // Focus title field
    const titleInput = editEl.querySelector('.aow-edit-title');
    if (titleInput) titleInput.focus();
  }

  /* ── Wire up read-only row buttons ── */
  function bindListEvents() {
    const list = root.querySelector('#aow-list');
    if (!list) return;

    list.querySelectorAll('.aow-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => openEdit(Number(btn.dataset.idx)));
    });

    list.querySelectorAll('.aow-btn-move').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const dir = btn.dataset.dir;
        const order = getOrder();
        if (dir === 'up' && idx > 0) {
          [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
        } else if (dir === 'down' && idx < order.length - 1) {
          [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
        }
        saveOrder();
        renderList();
      });
    });
  }

  /* ── Add new segment ── */
  const addBtn = root.querySelector('#aow-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const order = getOrder();
      order.push({ type: 'worship', title: 'New Item', leader: '', mins: 5, note: '' });
      saveOrder();
      renderList();
      // Open edit immediately for the new item
      setTimeout(() => openEdit(order.length - 1), 30);
    });
  }

  /* ── Service tab switching ── */
  root.querySelectorAll('.aow-service-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      root.querySelectorAll('.aow-service-tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      activeService = tab.dataset.svc;
      renderList();
    });
  });

  /* ── Initial render + Firestore load ── */
  renderList();
  loadFromFirestore();

  return () => {};
}
