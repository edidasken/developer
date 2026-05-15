/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: THE GENERATIONS — Church History & Milestones
   "One generation shall praise thy works to another." — Psalm 145:4
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';
import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';

export const name  = 'the_generations';
export const title = 'The Generations';

let _activeGenSheet    = null;
let _liveMilestonesMap = {};

const _e = s => String(s ?? '').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const CAT_META = {
  founding:   { color: '#7c3aed', bg: 'rgba(124,58,237,0.11)', icon: '✝️'  },
  building:   { color: '#0ea5e9', bg: 'rgba(14,165,233,0.11)', icon: '⛪'  },
  growth:     { color: '#059669', bg: 'rgba(5,150,105,0.11)',  icon: '🌱'  },
  missions:   { color: '#e8a838', bg: 'rgba(232,168,56,0.13)', icon: '🌍'  },
  leadership: { color: '#1b264f', bg: 'rgba(27,38,79,0.10)',   icon: '🙌'  },
  tech:       { color: '#6366f1', bg: 'rgba(99,102,241,0.11)', icon: '⚙️'  },
  outreach:   { color: '#c05818', bg: 'rgba(192,88,24,0.11)',  icon: '🤝'  },
};

const CURRENT_YEAR = new Date().getFullYear();

export function render() {
  return /* html */`
    <section class="gen-view">
      ${pageHero({
        title:    'The Generations',
        subtitle: 'The long story of the church — founding, growth, missions, and covenant moments.',
        scripture: 'One generation shall praise thy works to another. — Psalm 145:4',
      })}

      <!-- Stats strip -->
      <div class="gen-stats" data-bind="stats">
        <div class="gen-stat-card">
          <div class="gen-stat-n" style="color:var(--c-violet)" data-stat="years">—</div>
          <div class="gen-stat-label">Years of Ministry</div>
        </div>
        <div class="gen-stat-card">
          <div class="gen-stat-n" style="color:var(--c-emerald)" data-stat="milestones">—</div>
          <div class="gen-stat-label">Milestones</div>
        </div>
        <div class="gen-stat-card">
          <div class="gen-stat-n" style="color:var(--gold)" data-stat="leadership">—</div>
          <div class="gen-stat-label">Leadership Moments</div>
        </div>
        <div class="gen-stat-card">
          <div class="gen-stat-n" style="color:var(--c-sky)" data-stat="missions">—</div>
          <div class="gen-stat-label">Missions Moments</div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="way-section-header" style="margin-top:24px;">
        <h2 class="way-section-title">Church Timeline</h2>
        <button class="flock-btn flock-btn--ghost" data-act="add-milestone">Add Milestone</button>
      </div>
      <div class="gen-timeline" data-bind="timeline">
        <div class="life-empty" style="padding:24px 8px;color:var(--ink-muted,#7a7f96);text-align:center">Loading church timeline…</div>
      </div>
    </section>
  `;
}

export function mount(root) {
  const reload = () => _loadGenerations(root);
  _loadGenerations(root);
  root.querySelector('[data-act="add-milestone"]')?.addEventListener('click', () => _openMilestoneSheet(null, reload));
  return () => { _closeGenSheet(); };
}

function _rows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

async function _loadGenerations(root) {
  const tlEl = root.querySelector('[data-bind="timeline"]');
  if (!tlEl) return;
  const errMsg = (msg) => `<div class="life-empty" style="padding:24px 8px;color:var(--ink-muted,#7a7f96);text-align:center">${msg}</div>`;

  const V = window.TheVine;
  if (!V) { tlEl.innerHTML = errMsg('Milestones backend not loaded.'); return; }
  const MX = buildAdapter('flock.milestones', V);

  const MILESTONE_LIMIT = 100;
  try {
    const res  = await MX.list({ limit: MILESTONE_LIMIT });
    const rows = _rows(res);

    if (!rows.length) {
      tlEl.innerHTML = errMsg('No church milestones recorded yet. Click "Add Milestone" to begin the story.');
      _updateGenStats(root, []);
      return;
    }

    const _msDate = m => {
      if (m.date) return new Date(m.date);
      if (m.year) return new Date(`${m.year}-01-01`);
      return new Date(0);
    };
    const sorted = [...rows].sort((a, b) => _msDate(b) - _msDate(a));

    _updateGenStats(root, sorted, sorted.length >= MILESTONE_LIMIT);

    tlEl.innerHTML = sorted.map(m => {
      const d = _msDate(m);
      const label = d.getTime() > 0
        ? (m.date
            ? `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${d.getUTCFullYear()}`
            : String(m.year))
        : '';
      const title = m.title || m.name || 'Milestone';
      const cat   = (m.category || m.type || 'growth').toLowerCase();
      const desc  = m.description || m.notes || m.desc || '';
      const meta  = CAT_META[cat] || CAT_META.growth;
      const mid   = m.id ? ` data-id="${_e(String(m.id))}"` : '';
      return /* html */`
        <div class="gen-milestone"${mid}>
          <div class="gen-milestone-year">${label}</div>
          <div class="gen-milestone-dot" style="background:${meta.color}"></div>
          <div class="gen-milestone-body">
            <div class="gen-milestone-head">
              <span class="gen-milestone-icon" style="background:${meta.bg};color:${meta.color}">${meta.icon}</span>
              <span class="gen-milestone-title">${_e(title)}</span>
            </div>
            ${desc ? `<div class="gen-milestone-desc">${_e(desc)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
    _liveMilestonesMap = {};
    sorted.forEach(m => { if (m.id) _liveMilestonesMap[String(m.id)] = m; });
    tlEl.querySelectorAll('.gen-milestone[data-id]').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const rec = _liveMilestonesMap[card.dataset.id];
        if (rec) _openMilestoneSheet(rec, () => _loadGenerations(root));
      });
    });
  } catch (err) {
    console.error('[TheGenerations] milestones.list error:', err);
    tlEl.innerHTML = errMsg('Could not load church timeline.');
  }
}

function _updateGenStats(root, rows, atLimit = false) {
  const set = (key, val) => {
    const el = root.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = String(val);
  };
  if (!rows.length) { set('years','—'); set('milestones','0'); set('leadership','0'); set('missions','0'); return; }
  const years = rows.map(m => m.year || (m.date ? new Date(m.date).getFullYear() : 0)).filter(Boolean);
  const earliest = Math.min(...years);
  set('years', earliest ? (CURRENT_YEAR - earliest) : '—');
  set('milestones', atLimit ? `${rows.length}+` : rows.length);
  set('leadership', rows.filter(m => (m.category || m.type || '').toLowerCase() === 'leadership').length);
  set('missions',   rows.filter(m => (m.category || m.type || '').toLowerCase() === 'missions').length);
}

// ── Milestone sheet ───────────────────────────────────────────────────────────
const GEN_CATEGORIES = Object.keys(CAT_META);

function _closeGenSheet() {
  if (!_activeGenSheet) return;
  const t = _activeGenSheet;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activeGenSheet === t) _activeGenSheet = null; }, 320);
}

function _openMilestoneSheet(m, onReload) {
  _closeGenSheet();
  const V     = window.TheVine;
  const MX    = buildAdapter('flock.milestones', V);
  const isNew = !m;
  const uid   = m?.id ? String(m.id) : '';

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isNew ? 'Add Milestone' : 'Edit Milestone'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${isNew ? 'Add Milestone' : 'Edit Milestone'}</div>
          <div class="life-sheet-hd-meta">${isNew ? 'Record a new chapter in the church story' : _e(m?.title || 'Milestone')}</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Date <span style="color:#dc2626">*</span></div>
          <input class="life-sheet-input" data-field="date" type="date" value="${m?.date || (m?.year ? m.year + '-01-01' : new Date().toISOString().slice(0,10))}">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Title <span style="color:#dc2626">*</span></div>
          <input class="life-sheet-input" data-field="title" type="text" value="${_e(m?.title || '')}" placeholder="Name this milestone…">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Category</div>
          <select class="life-sheet-input" data-field="category">
            ${GEN_CATEGORIES.map(c => `<option value="${_e(c)}"${c === (m?.category || m?.type || 'growth') ? ' selected' : ''}>${_e(c.charAt(0).toUpperCase() + c.slice(1))}</option>`).join('')}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Description</div>
          <textarea class="life-sheet-input" data-field="description" rows="3" style="resize:vertical" placeholder="Describe this chapter of the church story…">${_e(m?.description || m?.notes || m?.desc || '')}</textarea>
        </div>
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        ${!isNew ? '<button class="flock-btn flock-btn--danger" data-delete>Delete</button>' : ''}
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>${isNew ? 'Add Milestone' : 'Save Changes'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeGenSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    sheet.querySelector('[data-field="title"]')?.focus();
  });

  const close = () => _closeGenSheet();
  sheet.querySelector('[data-cancel]').addEventListener('click', close);
  sheet.querySelector('.life-sheet-close').addEventListener('click', close);

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl = sheet.querySelector('[data-error]');
    const dt    = sheet.querySelector('[data-field="date"]').value;
    const ttl   = sheet.querySelector('[data-field="title"]').value.trim();
    if (!ttl) { errEl.textContent = 'Title is required.'; errEl.style.display = ''; return; }
    if (!dt)  { errEl.textContent = 'A date is required.'; errEl.style.display = ''; return; }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Saving…';
    const payload = {
      date:        sheet.querySelector('[data-field="date"]').value,
      year:        new Date(sheet.querySelector('[data-field="date"]').value).getUTCFullYear() || undefined,
      title:       ttl,
      category:    sheet.querySelector('[data-field="category"]').value,
      description: sheet.querySelector('[data-field="description"]').value.trim() || undefined,
    };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    if (!isNew) payload.id = uid;
    try {
      if (!V) throw new Error('Milestones backend not available.');
      if (isNew) { await MX.create(payload); }
      else       { await MX.update(payload); }
      _closeGenSheet();
      onReload?.();
    } catch (err) {
      errEl.textContent = err?.message || 'Could not save.';
      errEl.style.display = '';
      btn.disabled = false; btn.textContent = isNew ? 'Add Milestone' : 'Save Changes';
    }
  });

  sheet.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const ok = confirm(`Delete "${m?.title || 'this milestone'}"? This cannot be undone.`);
    if (!ok) return;
    const btn = sheet.querySelector('[data-delete]');
    btn.disabled = true; btn.textContent = 'Deleting…';
    try {
      await MX.delete({ id: uid });
      _closeGenSheet();
      onReload?.();
    } catch (_) { btn.disabled = false; btn.textContent = 'Delete'; }
  });
}

