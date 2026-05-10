/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: The Gift Drift
   "Every man according as he purposeth in his heart, so let him give. — 2 Corinthians 9:7"
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';
import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';

export const name  = 'the_gift_drift';
export const title = 'Generosity';

const _e = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ── KPI scaffold labels (values filled by backend) ─────────────────────── */
const KPI_DEFS = [
  { label: 'This Month'    },
  { label: 'YTD Giving'    },
  { label: 'Avg Gift'      },
  { label: 'Active Givers' },
];

let _activeGiftSheet   = null;

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function methodBadge(m) {
  const bg = m === 'Online' ? 'rgba(124,58,237,0.12)' : m === 'ACH' ? 'rgba(5,150,105,0.12)' : 'rgba(113,113,122,0.12)';
  const c  = m === 'Online' ? 'var(--c-violet,#7c3aed)' : m === 'ACH' ? 'var(--c-emerald,#059669)' : '#52525b';
  return `<span class="gift-method-badge" style="background:${bg};color:${c}">${_e(m)}</span>`;
}

/* ── Render ───────────────────────────────────────────────────────────────── */
export function render() {
  return `
<section class="gift-view">
  ${pageHero({
    title: 'Generosity',
    subtitle: 'Giving, stewardship, and generosity.',
    scripture: 'Every man according as he purposeth in his heart, so let him give. — 2 Corinthians 9:7',
  })}

  <!-- KPI strip -->
  <div class="gift-kpi-strip" data-gift-kpi>
    ${KPI_DEFS.map(k => `
    <div class="gift-kpi-card">
      <div class="gift-kpi-value">—</div>
      <div class="gift-kpi-label">${_e(k.label)}</div>
      <div class="gift-kpi-delta" style="color:var(--ink-muted,#7a7f96)">Loading…</div>
    </div>`).join('')}
  </div>

  <!-- Charts row -->
  <div class="gift-charts-row">

    <!-- Monthly trend -->
    <div class="gift-card">
      <div class="gift-card-header">
        <h3 class="gift-card-title">Monthly Giving Trend</h3>
        <span class="gift-forecast-note">Live data</span>
      </div>
      <div class="gift-bar-chart">
        <div class="life-empty">Loading giving trend…</div>
      </div>
    </div>

    <!-- Fund breakdown -->
    <div class="gift-card">
      <div class="gift-card-header">
        <h3 class="gift-card-title">This Month by Fund</h3>
        <span class="gift-card-sub"></span>
      </div>
      <div class="gift-funds">
        <div class="life-empty">Loading funds…</div>
      </div>
    </div>

  </div>

  <!-- Recent gifts -->
  <div class="gift-card">
    <div class="gift-card-header">
      <h3 class="gift-card-title">Recent Gifts</h3>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="flock-btn flock-btn--primary flock-btn--sm" data-act="record-gift">+ Record Gift</button>
        <button class="btn btn-outline" style="font-size:.8rem;padding:6px 14px">Export CSV</button>
      </div>
    </div>
    <div class="gift-transactions" data-bind="transactions">
      <div class="life-empty">Loading transactions…</div>
    </div>
  </div>

  <!-- Pledges -->
  <div class="gift-card" style="margin-top:24px;">
    <div class="gift-card-header">
      <h3 class="gift-card-title">Pledges</h3>
      <button class="flock-btn flock-btn--primary flock-btn--sm" data-act="new-pledge">+ New Pledge</button>
    </div>
    <div data-bind="pledges">
      <div class="life-empty">Loading pledges…</div>
    </div>
  </div>

</section>`;
}

export function mount(root) {
  _loadGiving(root);
  _loadPledges(root);
  root.querySelector('[data-act="record-gift"]')?.addEventListener('click', () => {
    _openGiftSheet(null, () => _loadGiving(root));
  });
  root.querySelector('[data-act="new-pledge"]')?.addEventListener('click', () => {
    _openPledgeSheet(null, () => _loadPledges(root));
  });
  return () => { _closeGiftSheet(); _closePledgeSheet(); };
}

function _rows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

async function _loadGiving(root) {
  const V = window.TheVine;
  const MX = buildAdapter('flock.giving', V);
  const txEl    = root.querySelector('[data-bind="transactions"]');
  const barEl   = root.querySelector('.gift-bar-chart');
  const fundsEl = root.querySelector('.gift-funds');
  const UR = window.UpperRoom;
  if (!V && (!UR || !UR.isReady || !UR.isReady())) {
    if (txEl)    txEl.innerHTML    = '<div class="life-empty">Giving backend not loaded.</div>';
    if (barEl)   barEl.innerHTML   = '<div class="life-empty">Giving backend not loaded.</div>';
    if (fundsEl) fundsEl.innerHTML = '<div class="life-empty">Giving backend not loaded.</div>';
    return;
  }

  const [summaryRes, listRes] = await Promise.allSettled([
    MX.summary(),
    MX.list({ limit: 20 }),
  ]);

  // ── KPI strip ───────────────────────────────────────────────────────────
  if (summaryRes.status === 'fulfilled' && summaryRes.value) {
    const s       = summaryRes.value;
    const monthly = s.monthlyTotal ?? s.thisMonth ?? s.total ?? 0;
    const ytd     = s.ytdTotal     ?? s.yearToDate ?? 0;
    const avg     = s.averageGift  ?? s.avgGift    ?? 0;
    const givers  = s.activeGivers ?? s.uniqueGivers ?? 0;

    const kpiEl = root.querySelector('.gift-kpi-strip');
    if (kpiEl) {
      const cards = kpiEl.querySelectorAll('.gift-kpi-card');
      const _set  = (i, v) => {
        const el = cards[i]?.querySelector('.gift-kpi-value');
        if (el && v) el.textContent = v;
      };
      if (monthly > 0) _set(0, `$${monthly.toLocaleString()}`);
      if (ytd     > 0) _set(1, `$${ytd.toLocaleString()}`);
      if (avg     > 0) _set(2, `$${Math.round(avg).toLocaleString()}`);
      if (givers  > 0) _set(3, String(givers));
    }

    // ── Bar chart from monthly breakdown ──────────────────────────────────
    const monthlyData = s.monthly || s.monthlyBreakdown || s.byMonth || [];
    if (Array.isArray(monthlyData) && monthlyData.length) {
      const maxA = Math.max(...monthlyData.map(m => m.amount || m.total || 0), 1);
      const barEl = root.querySelector('.gift-bar-chart');
      if (barEl) {
        barEl.innerHTML = monthlyData.map(m => {
          const amt  = m.amount || m.total || 0;
          const lbl  = m.label  || m.month || '';
          const h    = Math.round((amt / maxA) * 140);
          const isForecast = m.forecast === true;
          return `
            <div class="gift-bar-col">
              <div class="gift-bar-val">$${(amt / 1000).toFixed(1)}k</div>
              <div class="gift-bar-wrap">
                <div class="gift-bar${isForecast ? ' gift-bar--forecast' : ''}" style="height:${h}px"></div>
              </div>
              <div class="gift-bar-label">${_e(lbl)}</div>
            </div>`;
        }).join('');
      }
    }

    // ── Fund breakdown ─────────────────────────────────────────────────────
    const fundData = s.funds || s.byFund || s.fundBreakdown || [];
    if (Array.isArray(fundData) && fundData.length) {
      const fundsEl = root.querySelector('.gift-funds');
      if (fundsEl) {
        const total = fundData.reduce((sum, f) => sum + (f.amount || f.total || 0), 0) || 1;
        const FUND_COLORS = ['var(--c-violet,#7c3aed)','var(--gold,#e8a838)','var(--c-sky,#0ea5e9)','var(--c-emerald,#059669)','#db2777','#c05818'];
        fundsEl.innerHTML = fundData.map((f, i) => {
          const amt = f.amount || f.total || 0;
          const pct = Math.round((amt / total) * 100);
          const col = FUND_COLORS[i % FUND_COLORS.length];
          return `
            <div class="gift-fund-row">
              <div class="gift-fund-head">
                <span class="gift-fund-dot" style="background:${col}"></span>
                <span class="gift-fund-name">${_e(f.name || f.fund || `Fund ${i + 1}`)}</span>
                <span class="gift-fund-pct">${pct}%</span>
                <span class="gift-fund-amount">$${amt.toLocaleString()}</span>
              </div>
              <div class="gift-fund-bar-wrap">
                <div class="gift-fund-bar" style="width:${pct}%;background:${col}"></div>
              </div>
            </div>`;
        }).join('');
      }
    }
  }

  // ── Recent gifts table ──────────────────────────────────────────────────
  if (listRes.status === 'fulfilled') {
    const gifts = _rows(listRes.value);
    if (gifts.length) {
      const txEl = root.querySelector('[data-bind="transactions"]');
      if (txEl) {
        // Sort newest first before rendering
        const _tsN = (g) => g.createdAt?.seconds ? g.createdAt.seconds * 1000 : (g.giftDate || g.date ? new Date(g.giftDate || g.date).getTime() : 0);
        gifts.sort((a, b) => _tsN(b) - _tsN(a));
        txEl.innerHTML = gifts.map(g => {
          const name   = g.name || g.displayName || g.giverName || 'Anonymous';
          const fund   = g.fund || g.fundName || g.designatedFund || 'General Fund';
          const raw    = g.amount || g.totalAmount || 0;
          const amt    = typeof raw === 'number' ? `$${raw.toLocaleString()}` : String(raw);
          const method = g.method || g.paymentMethod || g.type || 'Online';
          const dateMs = g.createdAt?.seconds
            ? g.createdAt.seconds * 1000
            : (g.giftDate || g.date ? new Date(g.giftDate || g.date).getTime() : 0);
          const date   = dateMs ? new Date(dateMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
          const initials = name === 'Anonymous' ? '🙏' : name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('');
          return `
            <div class="gift-tx-row">
              <div class="gift-tx-avatar">${initials}</div>
              <div class="gift-tx-body">
                <div class="gift-tx-name">${_e(name)}</div>
                <div class="gift-tx-fund">${_e(fund)}</div>
              </div>
              ${methodBadge(method)}
              <div class="gift-tx-amount">${_e(amt)}</div>
              <div class="gift-tx-date">${_e(date)}</div>
            </div>`;
        }).join('');
      }
    }
  }
}

// ── Gift sheet ───────────────────────────────────────────────────────────────
const GIFT_METHODS = ['Online', 'ACH', 'Check', 'Cash', 'Card', 'Other'];
const GIFT_FUNDS   = ['General Fund', 'Missions', 'Building Fund', 'Benevolence', 'Other'];

function _closeGiftSheet() {
  if (!_activeGiftSheet) return;
  const t = _activeGiftSheet;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activeGiftSheet === t) _activeGiftSheet = null; }, 320);
}

function _openGiftSheet(g, onReload) {
  _closeGiftSheet();
  const V     = window.TheVine;
  const MX    = buildAdapter('flock.giving', V);
  const isNew = !g;
  const uid   = g?.id ? String(g.id) : '';

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="Record Gift">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${isNew ? 'Record Gift' : 'Edit Gift Record'}</div>
          <div class="life-sheet-hd-meta">${isNew ? 'Log a giving record' : _e(g?.name || g?.giverName || 'Gift record')}</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Giver Name <span style="color:#6b7280;font-weight:400">(optional)</span></div>
          <input class="life-sheet-input" data-field="name" type="text" value="${_e(g?.name || g?.giverName || '')}" placeholder="Leave blank for Anonymous">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Amount <span style="color:#dc2626">*</span></div>
          <input class="life-sheet-input" data-field="amount" type="number" min="0" step="0.01" value="${g?.amount || ''}" placeholder="0.00">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Fund</div>
          <select class="life-sheet-input" data-field="fund">
            ${GIFT_FUNDS.map(f => `<option value="${_e(f)}"${f === (g?.fund || g?.fundName || 'General Fund') ? ' selected' : ''}>${_e(f)}</option>`).join('')}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Payment Method</div>
          <select class="life-sheet-input" data-field="method">
            ${GIFT_METHODS.map(m => `<option value="${_e(m)}"${m === (g?.method || g?.paymentMethod || 'Online') ? ' selected' : ''}>${_e(m)}</option>`).join('')}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Gift Date</div>
          <input class="life-sheet-input" data-field="giftDate" type="date" value="${g?.giftDate || g?.date || ''}">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Notes</div>
          <textarea class="life-sheet-input" data-field="notes" rows="2" placeholder="Optional memo…">${_e(g?.notes || '')}</textarea>
        </div>
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        ${!isNew ? '<button class="flock-btn flock-btn--danger" data-delete>Delete Record</button>' : ''}
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>${isNew ? 'Record Gift' : 'Save Changes'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeGiftSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    sheet.querySelector('[data-field="amount"]')?.focus();
  });

  const close = () => _closeGiftSheet();
  sheet.querySelector('[data-cancel]').addEventListener('click', close);
  sheet.querySelector('.life-sheet-close').addEventListener('click', close);

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl = sheet.querySelector('[data-error]');
    const rawAmt = parseFloat(sheet.querySelector('[data-field="amount"]').value);
    if (!rawAmt || isNaN(rawAmt) || rawAmt <= 0) {
      errEl.textContent = 'A valid gift amount is required.';
      errEl.style.display = '';
      return;
    }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = isNew ? 'Saving…' : 'Saving…';
    const payload = {
      name:       sheet.querySelector('[data-field="name"]').value.trim() || 'Anonymous',
      amount:     rawAmt,
      fund:       sheet.querySelector('[data-field="fund"]').value,
      method:     sheet.querySelector('[data-field="method"]').value,
      date:       sheet.querySelector('[data-field="giftDate"]').value || undefined, // Firestore field
      giftDate:   sheet.querySelector('[data-field="giftDate"]').value || undefined, // GAS fallback
      notes:      sheet.querySelector('[data-field="notes"]').value.trim() || undefined,
    };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    if (!isNew) payload.id = uid;
    if (!V) { errEl.textContent = 'Giving backend not loaded — cannot save.'; errEl.style.display = ''; btn.disabled = false; btn.textContent = isNew ? 'Record Gift' : 'Save Changes'; return; }
    try {
      if (isNew) { await MX.create(payload); }
      else       { await MX.update(payload); }
      _closeGiftSheet();
      onReload?.();
    } catch (err) {
      errEl.textContent = err?.message || 'Could not save gift record.';
      errEl.style.display = '';
      btn.disabled = false; btn.textContent = isNew ? 'Record Gift' : 'Save Changes';
    }
  });

  sheet.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const ok = confirm('Delete this giving record? This action cannot be undone.');
    if (!ok) return;
    const btn = sheet.querySelector('[data-delete]');
    btn.disabled = true; btn.textContent = 'Deleting…';
    try {
      await MX.update({ id: uid, status: 'Deleted' });
      _closeGiftSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheGiftDrift] gift delete:', err);
      btn.disabled = false; btn.textContent = 'Delete Record';
      alert(err?.message || 'Could not delete gift record.');
    }
  });
}

// ── Pledges ───────────────────────────────────────────────────────────────────
let _activePledgeSheet = null;
const PLEDGE_STATUSES = ['Active', 'Fulfilled', 'Cancelled', 'Lapsed'];
const PLEDGE_FUNDS    = ['General Fund', 'Missions', 'Building Fund', 'Benevolence', 'Other'];

function _closePledgeSheet() {
  if (!_activePledgeSheet) return;
  const t = _activePledgeSheet;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activePledgeSheet === t) _activePledgeSheet = null; }, 320);
}

async function _loadPledges(root) {
  const host = root.querySelector('[data-bind="pledges"]');
  if (!host) return;
  const UR = window.UpperRoom;
  if (!UR || typeof UR.listPledges !== 'function') {
    host.innerHTML = '<div class="life-empty">Pledges require Firestore (UpperRoom) — not available.</div>';
    return;
  }
  host.innerHTML = '<div class="life-empty">Loading pledges…</div>';
  try {
    const rows = await UR.listPledges({ limit: 100 });
    if (!rows || !rows.length) {
      host.innerHTML = '<div class="life-empty">No pledges on record. Use “New Pledge” to log one.</div>';
      return;
    }    // Sort newest first
    const _tsN = (v) => { if (!v) return 0; if (typeof v === 'object' && v.seconds) return v.seconds * 1000; return new Date(v).getTime() || 0; };
    rows.sort((a, b) => _tsN(b.createdAt || b.pledgeDate) - _tsN(a.createdAt || a.pledgeDate));    host.innerHTML = rows.map(p => _pledgeRow(p)).join('');
    host.querySelectorAll('[data-pledge-id]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.pledgeId;
        const item = rows.find(r => String(r.id) === id);
        if (item) _openPledgeSheet(item, () => _loadPledges(root));
      });
    });
  } catch (err) {
    console.error('[TheGiftDrift] listPledges:', err);
    host.innerHTML = '<div class="life-empty">Could not load pledges right now.</div>';
  }
}

function _pledgeRow(p) {
  const name   = p.name || p.giverName || p.memberName || 'Anonymous';
  const fund   = p.fund || p.fundName || 'General Fund';
  const total  = p.totalAmount || p.amount || 0;
  const paid   = p.paidAmount  || p.amountPaid || 0;
  const status = p.status || 'Active';
  const pct    = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const fulfilled = status === 'Fulfilled';
  const statusBg  = fulfilled ? 'rgba(5,150,105,0.10)' : status === 'Active' ? 'rgba(14,165,233,0.10)' : 'rgba(107,114,128,0.10)';
  const statusC   = fulfilled ? '#059669' : status === 'Active' ? '#0ea5e9' : '#6b7280';
  const initials  = name === 'Anonymous' ? '🙏' : name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('');

  return /* html */`
    <div class="gift-tx-row" data-pledge-id="${_e(String(p.id || ''))}" style="cursor:pointer;" tabindex="0">
      <div class="gift-tx-avatar">${initials}</div>
      <div class="gift-tx-body">
        <div class="gift-tx-name">${_e(name)}</div>
        <div class="gift-tx-fund">${_e(fund)} &bull; ${pct}% fulfilled</div>
        <div style="background:#e5e7eb;border-radius:4px;height:4px;margin-top:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${statusC};border-radius:4px;transition:width .3s"></div>
        </div>
      </div>
      <span class="gift-method-badge" style="background:${statusBg};color:${statusC}">${_e(status)}</span>
      <div class="gift-tx-amount">$${Number(total).toLocaleString()}</div>
      <div class="gift-tx-date">${paid > 0 ? `$${Number(paid).toLocaleString()} paid` : '—'}</div>
    </div>`;
}

function _openPledgeSheet(item, onReload) {
  _closePledgeSheet();
  const UR    = window.UpperRoom;
  const isNew = !item;
  const fmtDate = (v) => {
    if (!v) return '';
    try {
      const ms = v?.seconds ? v.seconds * 1000 : +new Date(v);
      if (!ms || isNaN(ms)) return '';
      return new Date(ms).toISOString().slice(0, 10);
    } catch { return typeof v === 'string' ? v : ''; }
  };

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isNew ? 'New Pledge' : 'Edit Pledge'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${isNew ? 'New Pledge' : 'Edit Pledge'}</div>
          <div class="life-sheet-hd-meta">${isNew ? 'Record a giving pledge' : _e(item?.name || item?.giverName || 'Pledge record')}</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Giver Name <span style="color:#6b7280;font-weight:400">(optional)</span></div>
          <input class="life-sheet-input" data-field="name" type="text" value="${_e(item?.name || item?.giverName || '')}" placeholder="Leave blank for Anonymous">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Pledge Total <span style="color:#dc2626">*</span></div>
          <input class="life-sheet-input" data-field="totalAmount" type="number" min="0" step="0.01" value="${item?.totalAmount || item?.amount || ''}" placeholder="0.00">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Amount Paid So Far</div>
          <input class="life-sheet-input" data-field="paidAmount" type="number" min="0" step="0.01" value="${item?.paidAmount || item?.amountPaid || ''}" placeholder="0.00">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Fund</div>
          <select class="life-sheet-input" data-field="fund">
            ${PLEDGE_FUNDS.map(f => `<option value="${_e(f)}"${f === (item?.fund || item?.fundName || 'General Fund') ? ' selected' : ''}>${_e(f)}</option>`).join('')}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Status</div>
          <div class="life-status-row">
            ${PLEDGE_STATUSES.map(s => `<button class="life-status-pill${s === (item?.status || 'Active') ? ' is-active' : ''}" data-status="${_e(s)}">${_e(s)}</button>`).join('')}
          </div>
        </div>
        <div class="fold-form-row">
          <div class="life-sheet-field">
            <div class="life-sheet-label">Pledge Date</div>
            <input class="life-sheet-input" data-field="pledgeDate" type="date" value="${_e(fmtDate(item?.pledgeDate || item?.createdAt))}">
          </div>
          <div class="life-sheet-field">
            <div class="life-sheet-label">Fulfillment Date</div>
            <input class="life-sheet-input" data-field="fulfillmentDate" type="date" value="${_e(fmtDate(item?.fulfillmentDate))}">
          </div>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Notes</div>
          <textarea class="life-sheet-input" data-field="notes" rows="2" placeholder="Optional memo…">${_e(item?.notes || '')}</textarea>
        </div>
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>${isNew ? 'Record Pledge' : 'Save Changes'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activePledgeSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
  });

  sheet.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('[data-status]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  const close = () => _closePledgeSheet();
  sheet.querySelector('[data-cancel]').addEventListener('click', close);
  sheet.querySelector('.life-sheet-close').addEventListener('click', close);

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl    = sheet.querySelector('[data-error]');
    const totalVal = parseFloat(sheet.querySelector('[data-field="totalAmount"]').value);
    if (!totalVal || isNaN(totalVal) || totalVal <= 0) {
      errEl.textContent = 'A valid pledge total is required.'; errEl.style.display = ''; return;
    }
    if (!UR || typeof UR.createPledge !== 'function') { errEl.textContent = 'Pledge backend not loaded — cannot save.'; errEl.style.display = ''; return; }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Saving…';
    const payload = {
      name:            sheet.querySelector('[data-field="name"]').value.trim() || 'Anonymous',
      totalAmount:     totalVal,
      paidAmount:      parseFloat(sheet.querySelector('[data-field="paidAmount"]').value) || 0,
      fund:            sheet.querySelector('[data-field="fund"]').value,
      status:          sheet.querySelector('[data-status].is-active')?.dataset.status || 'Active',
      pledgeDate:      sheet.querySelector('[data-field="pledgeDate"]').value || undefined,
      fulfillmentDate: sheet.querySelector('[data-field="fulfillmentDate"]').value || undefined,
      notes:           sheet.querySelector('[data-field="notes"]').value.trim() || undefined,
    };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    try {
      if (isNew) {
        await UR.createPledge(payload);
      } else {
        await UR.updatePledge(Object.assign({}, payload, { id: item.id }));
      }
      _closePledgeSheet();
      onReload?.();
    } catch (err) {
      console.error('[TheGiftDrift] pledge save:', err);
      errEl.textContent = err?.message || 'Could not save pledge.'; errEl.style.display = '';
      btn.disabled = false; btn.textContent = isNew ? 'Record Pledge' : 'Save Changes';
    }
  });
}
