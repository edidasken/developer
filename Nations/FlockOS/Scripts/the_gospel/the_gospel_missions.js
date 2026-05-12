/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · WORLD MISSIONS — Pray for every nation. Go to the unreached.
   "Go therefore and make disciples of all nations." — Matthew 28:19
   ══════════════════════════════════════════════════════════════════════════════ */

import { esc, emptyState, loadingCards } from './the_gospel_shared.js';

export const name        = 'the_gospel_missions';
export const title       = 'World Missions';
export const description = 'Pray for every nation. Explore gospel access, unreached peoples, and daily prayer targets around the world.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
export const accent      = '#059669';

let _state = { nations: [], query: '', filter: 'all', openId: null };

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function _dayOfYear() {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000);
}

function _accessClass(level) {
  if (!level) return 'ms-badge--partial';
  const l = level.toLowerCase();
  if (l === 'open')                               return 'ms-badge--open';
  if (l === 'limited' || l === 'partial')         return 'ms-badge--limited';
  if (l.includes('hostile') || l === 'none')      return 'ms-badge--hostile';
  return 'ms-badge--partial';
}

function _pct(val) {
  if (val == null || isNaN(+val)) return null;
  return (+val).toFixed(1) + '%';
}

function _fmtPop(val) {
  if (!val) return '';
  const n = +val;
  if (isNaN(n)) return String(val);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

function _filtered() {
  const q = _state.query.toLowerCase().trim();
  return _state.nations.filter(n => {
    if (q) {
      const inName   = (n.countryName || '').toLowerCase().includes(q);
      const inRegion = (n.region || '').toLowerCase().includes(q);
      if (!inName && !inRegion) return false;
    }
    if (_state.filter === '1040'    && !n.tenFortyWindow)         return false;
    if (_state.filter === 'limited' && n.gospelAccess === 'Open') return false;
    return true;
  });
}

/* ─── Render ──────────────────────────────────────────────────────────────── */
export function render() {
  return /* html */`
    <section class="grow-page" data-grow="missions">
      <style>
        /* ── Nation of the Day card ── */
        .ms-focus { background:var(--surface-raised,#fff); border-radius:16px; padding:20px 20px 16px; margin:0 0 24px; box-shadow:0 2px 14px rgba(0,0,0,0.08); border:1.5px solid rgba(5,150,105,.12); }
        .ms-focus-flag { font-size:3rem; line-height:1; display:block; margin-bottom:10px; }
        .ms-focus-name { font:700 1.25rem var(--font-ui); color:var(--ink,#1a1d2e); margin:0 0 2px; }
        .ms-focus-region { font:0.8rem var(--font-ui); color:var(--ink-muted,#7a7f96); margin:0 0 4px; }
        .ms-focus-detail { font:0.8rem var(--font-ui); color:var(--ink-muted,#7a7f96); margin:0 0 4px; }
        .ms-focus-meta { display:flex; flex-wrap:wrap; gap:7px; margin:12px 0 14px; }
        .ms-stat-pill { background:var(--surface,#f4f5f9); border-radius:20px; padding:4px 12px; font:0.78rem var(--font-ui); color:var(--ink-sub,#4a4f68); }
        .ms-stat-pill--warn { background:rgba(234,88,12,.08); color:#c2410c; }
        .ms-prayer-box { background:linear-gradient(135deg,rgba(5,150,105,.07),rgba(5,150,105,.02)); border-left:3px solid #059669; border-radius:0 10px 10px 0; padding:12px 14px; font:0.87rem/1.65 var(--font-body,sans-serif); color:var(--ink,#1a1d2e); margin:0 0 16px; }
        .ms-prayer-label { font:600 0.7rem var(--font-ui); letter-spacing:.07em; text-transform:uppercase; color:#059669; margin:0 0 6px; }
        .ms-pray-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 18px; background:#059669; color:#fff; border:none; border-radius:20px; font:600 0.83rem var(--font-ui); cursor:pointer; transition:background .15s; }
        .ms-pray-btn:hover { background:#047857; }
        /* ── Filters ── */
        .ms-filters { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:0 0 14px; }
        .ms-search { flex:1; min-width:160px; padding:9px 14px; border:1.5px solid var(--line,#e5e7ef); border-radius:10px; font:0.88rem var(--font-ui); background:var(--surface-raised,#fff); color:var(--ink,#1a1d2e); }
        .ms-search:focus { outline:none; border-color:#059669; box-shadow:0 0 0 2px rgba(5,150,105,.12); }
        .ms-filter-btn { padding:7px 14px; border-radius:20px; border:1.5px solid var(--line,#e5e7ef); background:var(--surface-raised,#fff); font:0.78rem var(--font-ui); cursor:pointer; color:var(--ink-sub,#4a4f68); transition:all .15s; }
        .ms-filter-btn.is-active { background:#059669; color:#fff; border-color:#059669; }
        /* ── Nations grid ── */
        .ms-count { font:0.78rem var(--font-ui); color:var(--ink-muted,#7a7f96); margin:0 0 10px; }
        .ms-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:10px; }
        .ms-card { background:var(--surface-raised,#fff); border-radius:12px; border:1.5px solid var(--line,#e5e7ef); padding:14px 16px; cursor:pointer; transition:box-shadow .15s,border-color .15s; text-align:left; width:100%; }
        .ms-card:hover { box-shadow:0 4px 18px rgba(0,0,0,0.09); border-color:#059669; }
        .ms-card.is-open { border-color:#059669; box-shadow:0 2px 12px rgba(5,150,105,.12); }
        .ms-card-flag { font-size:1.7rem; display:block; margin-bottom:6px; }
        .ms-card-name { font:600 0.93rem var(--font-ui); color:var(--ink,#1a1d2e); margin:0 0 2px; }
        .ms-card-region { font:0.73rem var(--font-ui); color:var(--ink-muted,#7a7f96); margin:0 0 8px; }
        .ms-card-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        /* ── Access badges ── */
        .ms-badge { display:inline-flex; align-items:center; padding:2px 9px; border-radius:12px; font:600 0.7rem var(--font-ui); letter-spacing:.03em; }
        .ms-badge--open    { background:#d1fae5; color:#065f46; }
        .ms-badge--partial { background:#fef3c7; color:#92400e; }
        .ms-badge--limited { background:#fee2e2; color:#991b1b; }
        .ms-badge--hostile { background:#1f2937; color:#f9fafb; }
        /* ── Expanded panel ── */
        .ms-expand { margin-top:12px; padding-top:12px; border-top:1px solid var(--line,#e5e7ef); display:none; }
        .ms-card.is-open .ms-expand { display:block; }
        .ms-expand-stat { font:0.83rem/1.5 var(--font-ui); color:var(--ink-sub,#4a4f68); margin:0 0 5px; }
        .ms-expand-prayer { font:0.82rem/1.6 var(--font-body,sans-serif); color:var(--ink,#1a1d2e); margin:8px 0 12px; }
        .ms-expand-pray-btn { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; background:#059669; color:#fff; border:none; border-radius:16px; font:600 0.78rem var(--font-ui); cursor:pointer; transition:background .15s; }
        .ms-expand-pray-btn:hover { background:#047857; }
        .ms-expand-pray-btn.prayed { background:#047857; }
        /* ── Prayer CTA (single, before nations grid) ── */
        .ms-prayer-cta { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; background:linear-gradient(135deg,rgba(5,150,105,.08),rgba(5,150,105,.02)); border:1.5px solid rgba(5,150,105,.25); border-radius:14px; padding:16px 20px; margin:0 0 22px; }
        .ms-prayer-cta-text { font:0.88rem/1.5 var(--font-ui); color:var(--ink,#1a1d2e); }
        .ms-prayer-cta-text strong { display:block; font-size:0.95rem; margin-bottom:2px; }
        .ms-prayer-cta-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 20px; background:#059669; color:#fff; border:none; border-radius:20px; font:700 0.85rem var(--font-ui); cursor:pointer; white-space:nowrap; transition:background .15s; flex-shrink:0; }
        .ms-prayer-cta-btn:hover { background:#047857; }

      </style>
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>
      <div data-bind="root">${loadingCards(3)}</div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  return () => {};
}

/* ─── Data load ───────────────────────────────────────────────────────────── */
async function _load(root) {
  const view = root.querySelector('[data-bind="root"]');
  try {
    const mod = await import('../../Data/missions.js');
    _state.nations = (mod.default || [])
      .slice()
      .sort((a, b) => (a.countryName || '').localeCompare(b.countryName || ''));
  } catch (e) {
    console.error('[gospel/missions] data load failed:', e);
  }

  if (!_state.nations.length) {
    view.innerHTML = emptyState({
      icon: '🌍',
      title: 'No missions data yet',
      body: 'Ask your shepherd to export the missions registry from Firestore.',
    });
    return;
  }

  _paint(view);
}

/* ─── Paint ───────────────────────────────────────────────────────────────── */
function _paint(view) {
  // Rotate featured nation by day of year
  const featured = _state.nations[_dayOfYear() % _state.nations.length];
  const prayer   = (featured.owPrayerChallenges || [])[0] || '';
  const evPct    = _pct(featured.evangelicalPercent);

  view.innerHTML = /* html */`
    <div class="grow-section-head">
      <span class="grow-section-title">Nation of the Day</span>
    </div>

    <div class="ms-focus">
      <span class="ms-focus-flag">${featured.icon || '🌍'}</span>
      <h2 class="ms-focus-name">${esc(featured.countryName)}</h2>
      <p class="ms-focus-region">${esc(featured.region || '')}</p>
      ${featured.capital ? `<p class="ms-focus-detail">📍 ${esc(featured.capital)}</p>` : ''}
      ${featured.population ? `<p class="ms-focus-detail">👥 Pop. ${_fmtPop(featured.population)}</p>` : ''}
      <div class="ms-focus-meta">
        ${featured.gospelAccess ? `<span class="ms-badge ${_accessClass(featured.gospelAccess)}">${esc(featured.gospelAccess)} Access</span>` : ''}
        ${evPct ? `<span class="ms-stat-pill">⛪ ${evPct} Evangelical</span>` : ''}
        ${_pct(featured.christianPercent) ? `<span class="ms-stat-pill">✝️ ${_pct(featured.christianPercent)} Christian</span>` : ''}
        ${featured.unreachedGroups != null ? `<span class="ms-stat-pill">👥 ${featured.unreachedGroups} unreached groups</span>` : ''}
        ${featured.tenFortyWindow ? `<span class="ms-stat-pill">🕊 10/40 Window</span>` : ''}
        ${featured.persecutionLabel ? `<span class="ms-stat-pill ms-stat-pill--warn">⚠️ ${esc(featured.persecutionLabel)}</span>` : ''}
      </div>
      ${prayer ? /* html */`
        <div class="ms-prayer-box">
          <div class="ms-prayer-label">Today's Prayer Point</div>
          ${esc(prayer)}
        </div>
      ` : ''}
      <button class="ms-pray-btn" data-pray-btn data-nation-id="${esc(featured._id || featured.countryName)}">
        🙏 Pray with Us${_prayCount(featured._id || featured.countryName) ? ` · ${_prayCount(featured._id || featured.countryName)}` : ''}
      </button>
    </div>

    <div class="grow-section-head">
      <span class="grow-section-title">Nations</span>
    </div>

    <div class="ms-prayer-cta">
      <div class="ms-prayer-cta-text">
        <strong>Need prayer or want to connect?</strong>
        Share a request — a shepherd will follow up with you personally.
      </div>
      <button class="ms-prayer-cta-btn" data-help-btn>✉️ Send a Prayer Request</button>
    </div>

    <div class="ms-filters">
      <input class="ms-search" type="search" placeholder="Search nations or regions…"
             data-bind="search" value="${esc(_state.query)}" autocomplete="off">
      <button class="ms-filter-btn ${_state.filter === 'all'     ? 'is-active' : ''}" data-filter="all">All</button>
      <button class="ms-filter-btn ${_state.filter === '1040'    ? 'is-active' : ''}" data-filter="1040">10/40 Window</button>
      <button class="ms-filter-btn ${_state.filter === 'limited' ? 'is-active' : ''}" data-filter="limited">Limited Access</button>
    </div>

    <div data-bind="grid"></div>
  `;

  _renderGrid(view);
  _wireControls(view);

  /* Attach prayer summary so the public prayer hook has meaningful context */
  const prayerBtn = view.querySelector('[data-help-btn]');
  if (prayerBtn) {
    prayerBtn._prayerSummaryFn = () => {
      const featured = _state.nations[0];
      const region   = featured?.region  || '';
      const name     = featured?.countryName || '';
      const prayer   = (featured?.owPrayerChallenges || [])[0] || '';
      const lines    = ['I\'m reading about World Missions and have a prayer request.'];
      if (name)   lines.push(`Featured nation: ${name}${region ? ' (' + region + ')' : ''}.`);
      if (prayer) lines.push(`Today\'s prayer point: ${prayer}`);
      lines.push('\nI\'d love to connect with a pastor about missions, outreach, or prayer.');
      return lines.join('\n');
    };
  }
}

/* _injectJpWidget removed — widget now uses a static <iframe> in _paint() HTML */

/* ─── Grid ────────────────────────────────────────────────────────────────── */
function _renderGrid(view) {
  const gridEl  = view.querySelector('[data-bind="grid"]');
  const nations = _filtered();

  if (!nations.length) {
    gridEl.innerHTML = `<p class="ms-count">No nations match your search.</p>`;
    return;
  }

  gridEl.innerHTML = /* html */`
    <p class="ms-count">${nations.length} nation${nations.length !== 1 ? 's' : ''}</p>
    <div class="ms-grid">
      ${nations.map(n => _cardHTML(n)).join('')}
    </div>
  `;

  // Toggle expand on card click (ignore clicks on the pray button)
  gridEl.querySelectorAll('.ms-card').forEach(card => {
    const _toggle = () => {
      const id = card.dataset.id;
      _state.openId = _state.openId === id ? null : id;
      gridEl.querySelectorAll('.ms-card').forEach(c =>
        c.classList.toggle('is-open', c.dataset.id === _state.openId)
      );
    };
    card.addEventListener('click', (e) => { if (!e.target.closest('[data-pray-btn]')) _toggle(); });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _toggle(); } });
  });
}

function _cardHTML(n) {
  const evPct   = _pct(n.evangelicalPercent);
  const prayer  = (n.owPrayerChallenges || [])[0] || '';
  const isOpen  = _state.openId === (n._id || n.countryName);

  return /* html */`
    <div class="ms-card${isOpen ? ' is-open' : ''}" data-id="${esc(n._id || n.countryName)}" role="button" tabindex="0">
      <span class="ms-card-flag">${n.icon || '🌍'}</span>
      <div class="ms-card-name">${esc(n.countryName)}</div>
      <div class="ms-card-region">${esc(n.region || '')}</div>
      <div class="ms-card-row">
        ${n.gospelAccess ? `<span class="ms-badge ${_accessClass(n.gospelAccess)}">${esc(n.gospelAccess)}</span>` : ''}
        ${evPct ? `<span class="ms-stat-pill" style="font-size:.7rem;padding:2px 8px;">${evPct} Evangelical</span>` : ''}
      </div>
      <div class="ms-expand">
        ${n.capital    ? `<p class="ms-expand-stat">📍 Capital: ${esc(n.capital)}</p>` : ''}
        ${n.population ? `<p class="ms-expand-stat">👥 Pop. ${_fmtPop(n.population)}</p>` : ''}
        ${_pct(n.christianPercent) ? `<p class="ms-expand-stat">✝️ ${_pct(n.christianPercent)} Christian</p>` : ''}
        ${n.persecutionLabel ? `<p class="ms-expand-stat">⚠️ ${esc(n.persecutionLabel)}</p>` : ''}
        ${n.unreachedGroups != null ? `<p class="ms-expand-stat"><strong>${n.unreachedGroups}</strong> unreached people group${n.unreachedGroups !== 1 ? 's' : ''}${n.totalPeopleGroups ? ` of ${n.totalPeopleGroups} total` : ''}</p>` : ''}
        ${n.tenFortyWindow ? `<p class="ms-expand-stat" style="color:#059669;">🕊 In the 10/40 Window</p>` : ''}
        ${prayer ? /* html */`
          <div class="ms-prayer-label" style="margin-top:10px;">Prayer Point</div>
          <p class="ms-expand-prayer">${esc(prayer)}</p>
        ` : ''}
        <button class="ms-expand-pray-btn${_prayCount(n._id || n.countryName) ? ' prayed' : ''}" data-pray-btn data-nation-id="${esc(n._id || n.countryName)}">
          🙏 Pray with Us${_prayCount(n._id || n.countryName) ? ` · ${_prayCount(n._id || n.countryName)}` : ''}
        </button>
      </div>
    </div>
  `;
}

/* ─── Prayer counter (localStorage) ──────────────────────────────────────── */
function _prayCount(id) {
  return parseInt(localStorage.getItem(`pray_${id}`) || '0', 10) || 0;
}
function _prayBump(id) {
  const n = _prayCount(id) + 1;
  localStorage.setItem(`pray_${id}`, n);
  return n;
}

/* ─── Controls ────────────────────────────────────────────────────────────── */
function _wireControls(view) {
  // Search
  view.querySelector('[data-bind="search"]').addEventListener('input', function () {
    _state.query = this.value;
    _renderGrid(view);
  });

  // Filter buttons
  view.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.filter = btn.dataset.filter;
      view.querySelectorAll('[data-filter]').forEach(b =>
        b.classList.toggle('is-active', b.dataset.filter === _state.filter)
      );
      _renderGrid(view);
    });
  });

  // Delegated pray-counter (all [data-pray-btn] anywhere in view)
  view.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pray-btn]');
    if (!btn) return;
    const id = btn.dataset.nationId;
    const count = _prayBump(id);
    btn.textContent = `🙏 Pray with Us · ${count}`;
    btn.classList.add('prayed');
  });
}


