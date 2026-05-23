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

/* ─── SVG Icon Set ────────────────────────────────────────────────────────── */
const I = {
  pin:     `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5a4 4 0 0 1 4 4c0 3.5-4 9-4 9s-4-5.5-4-9a4 4 0 0 1 4-4z"/><circle cx="8" cy="5.5" r="1.3"/></svg>`,
  people:  `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2.2"/><path d="M1.5 14c0-2.5 2-4.2 4.5-4.2S10.5 11.5 10.5 14"/><circle cx="12" cy="5.5" r="1.8"/><path d="M14.5 14c0-2-1.4-3.4-2.7-3.6"/></svg>`,
  cross:   `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="8" y1="1.5" x2="8" y2="14.5"/><line x1="2.5" y1="5.5" x2="13.5" y2="5.5"/></svg>`,
  shield:  `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5 L14 4 L14 9C14 12.5 8 14.5 8 14.5C8 14.5 2 12.5 2 9L2 4Z"/></svg>`,
  book:    `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h5a2 2 0 0 1 2 2v9a1.5 1.5 0 0 0-1.5-1.5H2z"/><path d="M14 3H9a2 2 0 0 0-2 2v9a1.5 1.5 0 0 1 1.5-1.5H14z"/></svg>`,
  globe:   `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><line x1="2" y1="8" x2="14" y2="8"/><path d="M8 2a9 9 0 0 1 2.5 6A9 9 0 0 1 8 14 9 9 0 0 1 5.5 8 9 9 0 0 1 8 2z"/></svg>`,
  compass: `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><polygon points="10.5,5.5 6.5,8 5.5,10.5 9.5,8" fill="currentColor" stroke="none"/></svg>`,
  warn:    `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5 L15 14.5 H1 Z"/><line x1="8" y1="7" x2="8" y2="10.5"/><circle cx="8" cy="12.5" r=".6" fill="currentColor" stroke="none"/></svg>`,
  window:  `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1.5"/><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>`,
  pray:    `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 13.5 C5.5 9.5 2.5 8 2.5 5a3 3 0 0 1 6 0"/><path d="M10.5 13.5 C10.5 9.5 13.5 8 13.5 5a3 3 0 0 0-6 0"/><line x1="8" y1="5" x2="8" y2="13.5"/></svg>`,
  mail:    `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/><path d="M1.5 4.5 L8 9.5 L14.5 4.5"/></svg>`,
  church:  `<svg class="ms-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14 V7.5 L8 3.5 L14 7.5 V14"/><rect x="6" y="9" width="4" height="5"/><line x1="8" y1="1" x2="8" y2="4.5"/><line x1="6.5" y1="2.5" x2="9.5" y2="2.5"/></svg>`,
};

const FLAG_CDN = 'https://flagcdn.com';

function _flagUrl(isoCode) {
  const code = String(isoCode || '').trim().toLowerCase();
  return code ? `${FLAG_CDN}/${code}.svg` : '';
}

function _flagMarkup(isoCode) {
  const code = String(isoCode || '').trim().toLowerCase();
  if (!code) {
    return `<span class="ms-flag ms-flag--fallback" aria-hidden="true">${I.globe}</span>`;
  }
  return `<img class="ms-flag" src="${_flagUrl(code)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
}

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

/* ─── Religion label normaliser (mirrors herald) ──────────────────────────── */
function _relLabel(key) {
  const map = { islam:'Islam', christianity:'Christianity', hinduism:'Hinduism',
    buddhism:'Buddhism', ethnic:'Ethnic Religions', nonreligious:'Non-Religious',
    other:'Other', unknown:'Unknown', jewish:'Judaism', sikh:'Sikhism',
    spiritist:'Spiritism', bahai:'Baháʼí' };
  return map[key.toLowerCase()] || key;
}

/* ─── Visual helpers ─────────────────────────────────────────────────────── */
const _REL_COLORS = {
  christianity:'#059669', islam:'#0891b2', hinduism:'#ea580c',
  buddhism:'#7c3aed',    ethnic:'#d97706', nonreligious:'#6b7280',
  jewish:'#1d4ed8',      sikh:'#b45309',   spiritist:'#9333ea',
  bahai:'#0d9488',       other:'#64748b',
};
function _relColor(key) { return _REL_COLORS[key.toLowerCase()] || '#64748b'; }

function _rankColor(rank) {
  if (rank == null) return '#6b7280';
  if (rank <= 10)   return '#dc2626';
  if (rank <= 20)   return '#ea580c';
  if (rank <= 30)   return '#d97706';
  if (rank <= 40)   return '#ca8a04';
  return '#6b7280';
}

function _severityDots(rank, max = 50) {
  if (rank == null) return '';
  const level = Math.ceil((1 - (rank - 1) / (max - 1)) * 5);
  return Array.from({length: 5}, (_, i) =>
    `<span class="ms-dot${i < level ? ' ms-dot--on' : ''}"></span>`
  ).join('');
}

function _perTierClass(tier) {
  const t = (tier || '').toLowerCase();
  if (t.includes('extreme'))                     return 'ms-tier--extreme';
  if (t.includes('very high') || t.includes('veryhigh')) return 'ms-tier--very-high';
  if (t.includes('high'))                        return 'ms-tier--high';
  if (t.includes('medium') || t.includes('moderate')) return 'ms-tier--medium';
  return 'ms-tier--low';
}

function _miniBar(pct, color = '#059669') {
  if (pct == null || isNaN(+pct)) return '';
  const w = Math.min(+pct, 100).toFixed(1);
  return `<div class="ms-mini-bar-track"><div class="ms-mini-bar-fill" style="width:${w}%;background:${color}"></div></div>`;
}

/* ─── Full Dossier HTML builder ───────────────────────────────────────────── */
function _dossierHTML(n) {
  const xChrist     = n.christianPercent ?? n.percentChristian;
  const xEvan       = n.evangelicalPercent;
  const wwlRank     = n.worldWatchListRank != null ? n.worldWatchListRank : null;
  const perRank     = n.persecutionRank    != null ? n.persecutionRank    : null;
  const perTier     = n.persecutionTier    || n.persecutionLevel || '';
  const perLabel    = n.persecutionLabel   || n.persecutionLevel || '';
  const balRank     = n.restrictionsRank   != null ? n.restrictionsRank   : null;
  const balSource   = n.restrictionsSource || '';
  const bsRank      = n.bibleShortageRank  != null ? n.bibleShortageRank  : null;
  const bsTier      = n.bibleShortageTier  || '';
  const bsRange     = n.bibleShortageRange || '';
  const bsNeed      = n.bibleShortageNeed  || '';
  const bsSource    = n.bibleShortageSource || '';
  const owSum       = n.owSummary          || '';
  const owSource    = n.owSource           || '';
  const owChall     = Array.isArray(n.owPrayerChallenges) ? n.owPrayerChallenges : [];
  const owAns       = Array.isArray(n.owPrayerAnswers)    ? n.owPrayerAnswers    : [];
  const profileUrl  = n.jpProfileUrl || n.profileUrl || '';
  const jpUpdatedAt = n.jpUpdatedAt  || '';
  const unreached   = n.unreachedGroups   != null ? n.unreachedGroups   : null;
  const totalGroups = n.totalPeopleGroups != null ? n.totalPeopleGroups : null;
  const domRel      = n.dominantReligion  || '';

  // Religion breakdown — inject Christianity if missing
  const breakdown = Object.assign({}, n.religionBreakdown || {});
  if (!('christianity' in breakdown) && xChrist != null && +xChrist > 0) {
    breakdown.christianity = +xChrist;
  }
  const relEntries = Object.entries(breakdown)
    .filter(e => +e[1] >= 0.1)
    .sort((a, b) => b[1] - a[1]);

  const relBarsHTML = relEntries.map(e => {
    const pct = Math.min(+e[1], 100).toFixed(1);
    const col = _relColor(e[0]);
    return /* html */`
      <div class="ms-rel-row">
        <span class="ms-rel-dot" style="background:${col}"></span>
        <span class="ms-rel-name">${esc(_relLabel(e[0]))}</span>
        <div class="ms-rel-track"><div class="ms-rel-fill" style="width:${pct}%;background:${col}"></div></div>
        <span class="ms-rel-pct">${pct}%</span>
      </div>`;
  }).join('');

  const prayId = esc(n._id || n.countryName);
  const wwlColor = _rankColor(wwlRank);
  const perColor = _rankColor(perRank ?? wwlRank);

  return /* html */`
    <!-- Stats grid -->
    <div class="ms-stats-grid">
      ${n.population ? `
        <div class="ms-stat-cell ms-stat-cell--pop">
          <div class="ms-stat-val">${_fmtPop(n.population)}</div>
          <div class="ms-stat-lbl">Population</div>
        </div>` : ''}
      ${n.jpPopulation && n.jpPopulation !== n.population ? `
        <div class="ms-stat-cell">
          <div class="ms-stat-val">${_fmtPop(n.jpPopulation)}</div>
          <div class="ms-stat-lbl">JP Population</div>
        </div>` : ''}
      ${xChrist != null ? `
        <div class="ms-stat-cell ms-stat-cell--christian">
          <div class="ms-stat-val">${_pct(xChrist)}</div>
          <div class="ms-stat-lbl">Christian</div>
          ${_miniBar(xChrist, '#059669')}
        </div>` : ''}
      ${xEvan != null ? `
        <div class="ms-stat-cell ms-stat-cell--evan">
          <div class="ms-stat-val">${_pct(xEvan)}</div>
          <div class="ms-stat-lbl">Evangelical</div>
          ${_miniBar(xEvan, '#10b981')}
        </div>` : ''}
      ${unreached != null ? `
        <div class="ms-stat-cell ms-stat-cell--unreached">
          <div class="ms-stat-val">${unreached}${totalGroups != null ? '<span class="ms-stat-denom">/' + totalGroups + '</span>' : ''}</div>
          <div class="ms-stat-lbl">Unreached${totalGroups != null ? ' / Total' : ''} Groups</div>
        </div>` : ''}
      ${n.gospelAccess ? `
        <div class="ms-stat-cell ms-stat-cell--access ${_accessClass(n.gospelAccess)}">
          <div class="ms-stat-val">${esc(n.gospelAccess)}</div>
          <div class="ms-stat-lbl">Gospel Access</div>
        </div>` : ''}
    </div>

    <!-- Badge row -->
    <div class="ms-badge-row">
      ${n.tenFortyWindow ? `<span class="ms-tag ms-tag--window">${I.window} 10/40 Window</span>` : ''}
      ${perLabel         ? `<span class="ms-tag ${_perTierClass(perTier)}">${I.warn} ${esc(perLabel)}</span>` : ''}
    </div>

    <!-- World Watch -->
    ${(wwlRank != null || perRank != null || perTier) ? /* html */`
      <div class="ms-section ms-section--ww">
        <div class="ms-section-head">${I.shield} World Watch</div>
        <div class="ms-ww-body">
          ${wwlRank != null ? `
            <div class="ms-rank-badge" style="--rank-color:${wwlColor}">
              <span class="ms-rank-num">#${wwlRank}</span>
              <span class="ms-rank-lbl">World Watch</span>
              <div class="ms-dots">${_severityDots(wwlRank)}</div>
            </div>` : ''}
          ${perRank != null && perRank !== wwlRank ? `
            <div class="ms-rank-badge" style="--rank-color:${perColor}">
              <span class="ms-rank-num">#${perRank}</span>
              <span class="ms-rank-lbl">Persecution Rank</span>
              <div class="ms-dots">${_severityDots(perRank)}</div>
            </div>` : ''}
          ${perTier ? `
            <span class="ms-tier-pill ${_perTierClass(perTier)}">${esc(perTier)}</span>` : ''}
        </div>
        ${perLabel && perLabel !== perTier ? `<p class="ms-note" style="margin-top:8px">${esc(perLabel)}</p>` : ''}
      </div>
    ` : ''}

    <!-- Religion Breakdown -->
    ${relEntries.length ? /* html */`
      <div class="ms-section">
        <div class="ms-section-head">${I.cross} Religion Breakdown</div>
        ${domRel ? `<p class="ms-note" style="margin-bottom:10px">Dominant: <strong>${esc(domRel)}</strong></p>` : ''}
        <div class="ms-rel-list">${relBarsHTML}</div>
      </div>
    ` : ''}

    <!-- Bible Access -->
    ${(balRank != null || bsRank != null || bsTier || bsRange) ? /* html */`
      <div class="ms-section ms-section--bible">
        <div class="ms-section-head">${I.book} Bible Access</div>
        <div class="ms-bible-body">
          ${balRank != null ? `
            <div class="ms-rank-badge" style="--rank-color:${_rankColor(balRank)}">
              <span class="ms-rank-num">#${balRank}</span>
              <span class="ms-rank-lbl">Restrictions Rank</span>
              <div class="ms-dots">${_severityDots(balRank, 100)}</div>
            </div>` : ''}
          ${bsRank != null ? `
            <div class="ms-rank-badge" style="--rank-color:${_rankColor(bsRank, 100)}">
              <span class="ms-rank-num">#${bsRank}</span>
              <span class="ms-rank-lbl">Shortage Rank</span>
            </div>` : ''}
          ${bsTier ? `<span class="ms-tier-pill ms-tier--medium">${esc(bsTier)}</span>` : ''}
        </div>
        ${bsRange                       ? `<p class="ms-note" style="margin-top:8px">${esc(bsRange)}</p>` : ''}
        ${bsNeed && bsNeed !== bsRange  ? `<p class="ms-note">${esc(bsNeed)}</p>` : ''}
        ${balSource || bsSource ? `<p class="ms-source">${[balSource, bsSource].filter((s,i,a) => s && a.indexOf(s) === i).map(esc).join(' · ')}</p>` : ''}
      </div>
    ` : ''}

    <!-- Operation World -->
    ${(owSum || owChall.length) ? /* html */`
      <div class="ms-section ms-section--ow">
        <div class="ms-section-head">${I.globe} Operation World</div>
        ${owSum ? `<p class="ms-ow-body">${esc(owSum)}</p>` : ''}
        ${owChall.length ? /* html */`
          <p class="ms-sub-head">Prayer Challenges</p>
          <ol class="ms-list">${owChall.map(c => `<li>${esc(c)}</li>`).join('')}</ol>
        ` : ''}
        ${owAns.length ? /* html */`
          <p class="ms-sub-head">Prayer Answers</p>
          <ol class="ms-list">${owAns.map(a => `<li>${esc(a)}</li>`).join('')}</ol>
        ` : ''}
        ${owSource ? `<p class="ms-source">${esc(owSource)}</p>` : `<p class="ms-source">OperationWorld.org</p>`}
      </div>
    ` : ''}

    <!-- Joshua Project -->
    ${profileUrl ? /* html */`
      <div class="ms-section ms-section--jp">
        <a class="ms-jp-link" href="${esc(profileUrl)}" target="_blank" rel="noopener">
          ${I.compass} View on Joshua Project ↗
        </a>
        ${jpUpdatedAt ? `<p class="ms-source">JP data: ${esc(jpUpdatedAt)}</p>` : ''}
      </div>
    ` : ''}

    <!-- Pray button -->
    <button class="ms-pray-btn${_prayCount(prayId) ? ' prayed' : ''}" data-pray-btn data-nation-id="${prayId}">
      ${I.pray} Pray with Us${_prayCount(prayId) ? ` · ${_prayCount(prayId)}` : ''}
    </button>
  `;
}

/* ─── Render ──────────────────────────────────────────────────────────────── */
export function render() {
  return /* html */`
    <section class="grow-page" data-grow="missions">
      <style>
        /* ── SVG icons ── */
        .ms-ico { width:12px; height:12px; flex-shrink:0; display:inline-block; vertical-align:middle; }
        /* ── Featured nation of the day ── */
        .ms-focus { background:var(--surface-raised,#fff); border-radius:16px; padding:20px 20px 16px; margin:0 0 24px; box-shadow:0 2px 14px rgba(0,0,0,0.08); border:1.5px solid rgba(5,150,105,.2); border-top:4px solid #059669; }
        .ms-focus-flag { display:flex; align-items:center; justify-content:flex-start; margin-bottom:10px; }
        .ms-focus-flag .ms-flag { width:64px; height:48px; object-fit:contain; display:block; border-radius:10px; box-shadow:0 1px 0 rgba(0,0,0,0.06); }
        .ms-focus-flag .ms-flag--fallback { width:64px; height:48px; display:flex; align-items:center; justify-content:center; background:var(--surface,#f4f5f9); border:1px solid var(--line,#e5e7ef); border-radius:10px; }
        .ms-focus-name { font:700 1.25rem var(--font-ui); color:var(--ink,#1a1d2e); margin:0 0 2px; }
        .ms-focus-region { font:0.8rem var(--font-ui); color:var(--ink-muted,#7a7f96); margin:0 0 14px; }
        /* ── Stats grid ── */
        .ms-stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(105px,1fr)); gap:7px; margin:0 0 10px; }
        .ms-stat-cell { background:var(--surface,#f4f5f9); border-radius:10px; padding:10px 10px 8px; text-align:center; border-top:3px solid transparent; }
        .ms-stat-cell--pop        { border-top-color:#6366f1; }
        .ms-stat-cell--christian  { border-top-color:#059669; }
        .ms-stat-cell--evan       { border-top-color:#10b981; }
        .ms-stat-cell--unreached  { border-top-color:#f59e0b; }
        .ms-stat-cell--access.ms-badge--open    { border-top-color:#059669; background:#f0fdf4; }
        .ms-stat-cell--access.ms-badge--partial { border-top-color:#d97706; background:#fffbeb; }
        .ms-stat-cell--access.ms-badge--limited { border-top-color:#dc2626; background:#fef2f2; }
        .ms-stat-cell--access.ms-badge--hostile { border-top-color:#1f2937; background:#f9fafb; }
        .ms-stat-val { font:700 1.05rem var(--font-ui); color:var(--ink,#1a1d2e); line-height:1.2; }
        .ms-stat-denom { font-weight:400; font-size:.85em; color:var(--ink-muted,#7a7f96); }
        .ms-stat-lbl { font:0.63rem var(--font-ui); color:var(--ink-muted,#7a7f96); margin-top:3px; }
        .ms-mini-bar-track { background:rgba(0,0,0,0.08); border-radius:3px; height:4px; overflow:hidden; margin-top:6px; }
        .ms-mini-bar-fill { height:100%; border-radius:3px; }
        /* ── Badge / tag row ── */
        .ms-badge-row { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 12px; }
        .ms-tag { display:inline-flex; align-items:center; gap:4px; padding:4px 11px; border-radius:20px; font:600 0.7rem var(--font-ui); letter-spacing:.04em; }
        .ms-tag--window { background:rgba(99,102,241,.1); color:#4338ca; }
        .ms-tag--window .ms-ico { color:#4338ca; }
        /* ── Tier pills (persecution / bible) ── */
        .ms-tier-pill { display:inline-flex; align-items:center; padding:4px 12px; border-radius:20px; font:700 0.72rem var(--font-ui); letter-spacing:.04em; }
        .ms-tier--extreme  { background:#fef2f2; color:#991b1b; border:1px solid #fca5a5; }
        .ms-tier--very-high { background:#fff7ed; color:#9a3412; border:1px solid #fdba74; }
        .ms-tier--high     { background:#fffbeb; color:#92400e; border:1px solid #fcd34d; }
        .ms-tier--medium   { background:#fefce8; color:#713f12; border:1px solid #fde047; }
        .ms-tier--low      { background:#f0fdf4; color:#065f46; border:1px solid #6ee7b7; }
        /* use tier-pill colors also for ms-tag persecution */
        .ms-tag.ms-tier--extreme  { background:#fef2f2; color:#991b1b; }
        .ms-tag.ms-tier--extreme .ms-ico { color:#991b1b; }
        .ms-tag.ms-tier--very-high { background:#fff7ed; color:#9a3412; }
        .ms-tag.ms-tier--very-high .ms-ico { color:#9a3412; }
        .ms-tag.ms-tier--high     { background:#fffbeb; color:#92400e; }
        .ms-tag.ms-tier--high .ms-ico { color:#92400e; }
        .ms-tag.ms-tier--medium   { background:#fefce8; color:#713f12; }
        .ms-tag.ms-tier--medium .ms-ico { color:#713f12; }
        .ms-tag--warn { background:rgba(220,38,38,.08); color:#b91c1c; }
        .ms-tag--warn .ms-ico { color:#b91c1c; }
        /* ── Section containers ── */
        .ms-section { margin:0 0 10px; padding:12px 14px; background:var(--surface,#f4f5f9); border-radius:12px; }
        .ms-section--ww   { background:linear-gradient(135deg,rgba(220,38,38,.04),rgba(220,38,38,.01)); border:1px solid rgba(220,38,38,.12); }
        .ms-section--bible { background:linear-gradient(135deg,rgba(29,78,216,.04),rgba(29,78,216,.01)); border:1px solid rgba(29,78,216,.1); }
        .ms-section--ow   { background:linear-gradient(135deg,rgba(5,150,105,.04),rgba(5,150,105,.01)); border:1px solid rgba(5,150,105,.12); }
        .ms-section--jp { background:none; padding:6px 0 0; }
        .ms-section-head { display:flex; align-items:center; gap:5px; font:700 0.68rem var(--font-ui); letter-spacing:.12em; text-transform:uppercase; color:#059669; border-bottom:1px solid var(--line,#e5e7ef); padding-bottom:7px; margin-bottom:10px; }
        .ms-section--ww .ms-section-head   { color:#dc2626; }
        .ms-section--ww .ms-section-head .ms-ico { color:#dc2626; }
        .ms-section--bible .ms-section-head { color:#1d4ed8; }
        .ms-section--bible .ms-section-head .ms-ico { color:#1d4ed8; }
        .ms-section-head .ms-ico { color:#059669; }
        /* ── World Watch rank badges ── */
        .ms-ww-body { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
        .ms-bible-body { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
        .ms-rank-badge { display:flex; flex-direction:column; align-items:center; background:var(--surface-raised,#fff); border:2px solid var(--rank-color,#6b7280); border-radius:12px; padding:8px 14px; min-width:82px; }
        .ms-rank-num { font:800 1.3rem var(--font-ui); color:var(--rank-color,#6b7280); line-height:1; }
        .ms-rank-lbl { font:0.6rem var(--font-ui); color:var(--ink-muted,#7a7f96); margin-top:2px; text-align:center; }
        .ms-dots { display:flex; gap:3px; margin-top:6px; }
        .ms-dot { width:8px; height:8px; border-radius:50%; background:rgba(0,0,0,0.12); }
        .ms-dot--on { background:var(--rank-color,#dc2626); }
        /* ── Religion breakdown ── */
        .ms-rel-list { display:flex; flex-direction:column; gap:6px; }
        .ms-rel-row { display:grid; grid-template-columns:10px 80px 1fr 44px; align-items:center; gap:6px; }
        .ms-rel-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
        .ms-rel-name { font:0.8rem var(--font-ui); color:var(--ink,#1a1d2e); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ms-rel-track { background:rgba(0,0,0,0.08); border-radius:5px; height:9px; overflow:hidden; }
        .ms-rel-fill { height:100%; border-radius:5px; }
        .ms-rel-pct { font:700 0.74rem var(--font-ui); color:var(--ink-sub,#4a4f68); text-align:right; }
        /* ── Operation World ── */
        .ms-ow-body { font:0.86rem/1.7 var(--font-body,serif); color:var(--ink,#1a1d2e); margin:0 0 8px; }
        .ms-sub-head { font:700 0.68rem var(--font-ui); letter-spacing:.08em; text-transform:uppercase; color:var(--ink-muted,#7a7f96); margin:10px 0 5px; }
        .ms-list { padding-left:0; list-style:none; font:0.83rem/1.65 var(--font-body,serif); color:var(--ink,#1a1d2e); display:flex; flex-direction:column; gap:4px; }
        .ms-list li { display:flex; gap:8px; align-items:baseline; }
        .ms-list li::before { content:counter(li); counter-increment:li; flex-shrink:0; width:20px; height:20px; background:#059669; color:#fff; border-radius:50%; font:700 0.65rem var(--font-ui); display:flex; align-items:center; justify-content:center; margin-top:1px; }
        .ms-list { counter-reset:li; }
        /* ── Misc ── */
        .ms-note { font:0.78rem var(--font-ui); color:var(--ink-sub,#4a4f68); margin:3px 0; }
        .ms-source { font:0.68rem var(--font-ui); color:var(--ink-muted,#7a7f96); margin:6px 0 0; }
        .ms-jp-link { display:inline-flex; align-items:center; gap:5px; font:600 0.83rem var(--font-ui); color:#059669; text-decoration:none; }
        .ms-jp-link:hover { text-decoration:underline; }
        .ms-jp-link .ms-ico { color:#059669; }
        .ms-pray-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 20px; background:#059669; color:#fff; border:none; border-radius:20px; font:600 0.85rem var(--font-ui); cursor:pointer; transition:background .15s; margin-top:14px; }
        .ms-pray-btn:hover { background:#047857; }
        .ms-pray-btn.prayed { background:#047857; }
        .ms-pray-btn .ms-ico { color:#fff; }
        /* ── Filters ── */
        .ms-filters { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:0 0 14px; }
        .ms-search { flex:1; min-width:160px; padding:9px 14px; border:1.5px solid var(--line,#e5e7ef); border-radius:10px; font:0.88rem var(--font-ui); background:var(--surface-raised,#fff); color:var(--ink,#1a1d2e); }
        .ms-search:focus { outline:none; border-color:#059669; box-shadow:0 0 0 2px rgba(5,150,105,.12); }
        .ms-filter-btn { padding:7px 14px; border-radius:20px; border:1.5px solid var(--line,#e5e7ef); background:var(--surface-raised,#fff); font:0.78rem var(--font-ui); cursor:pointer; color:var(--ink-sub,#4a4f68); transition:all .15s; }
        .ms-filter-btn.is-active { background:#059669; color:#fff; border-color:#059669; }
        /* ── Nations grid ── */
        .ms-count { font:0.78rem var(--font-ui); color:var(--ink-muted,#7a7f96); margin:0 0 10px; }
        .ms-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; align-items:start; }
        .ms-card { background:var(--surface-raised,#fff); border-radius:12px; border:1.5px solid var(--line,#e5e7ef); padding:14px 16px; cursor:pointer; transition:box-shadow .15s,border-color .15s; text-align:left; width:100%; }
        .ms-card:hover { box-shadow:0 4px 18px rgba(0,0,0,0.09); border-color:#059669; }
        .ms-card.is-open { border-color:#059669; box-shadow:0 2px 16px rgba(5,150,105,.14); grid-column:1/-1; cursor:default; }
        .ms-card-flag { display:flex; align-items:center; justify-content:flex-start; margin-bottom:6px; }
        .ms-card-flag .ms-flag { width:34px; height:26px; object-fit:contain; display:block; border-radius:5px; box-shadow:0 1px 0 rgba(0,0,0,0.06); }
        .ms-card-flag .ms-flag--fallback { width:34px; height:26px; display:flex; align-items:center; justify-content:center; background:var(--surface,#f4f5f9); border:1px solid var(--line,#e5e7ef); border-radius:5px; }
        .ms-card-name { font:600 0.93rem var(--font-ui); color:var(--ink,#1a1d2e); margin:0 0 2px; }
        .ms-card-region { font:0.73rem var(--font-ui); color:var(--ink-muted,#7a7f96); margin:0 0 8px; }
        .ms-card-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        /* ── Access badges ── */
        .ms-badge { display:inline-flex; align-items:center; padding:2px 9px; border-radius:12px; font:600 0.7rem var(--font-ui); letter-spacing:.03em; }
        .ms-badge--open    { background:#d1fae5; color:#065f46; }
        .ms-badge--partial { background:#fef3c7; color:#92400e; }
        .ms-badge--limited { background:#fee2e2; color:#991b1b; }
        .ms-badge--hostile { background:#1f2937; color:#f9fafb; }
        .ms-stat-pill { background:var(--surface,#f4f5f9); border-radius:20px; padding:2px 8px; font:0.7rem var(--font-ui); color:var(--ink-sub,#4a4f68); }
        /* ── Expanded dossier panel ── */
        .ms-expand { margin-top:14px; padding-top:14px; border-top:1px solid var(--line,#e5e7ef); display:none; }
        .ms-card.is-open .ms-expand { display:block; }
        /* ── Prayer CTA ── */
        .ms-prayer-cta { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; background:linear-gradient(135deg,rgba(5,150,105,.08),rgba(5,150,105,.02)); border:1.5px solid rgba(5,150,105,.25); border-radius:14px; padding:16px 20px; margin:0 0 22px; }
        .ms-prayer-cta-text { font:0.88rem/1.5 var(--font-ui); color:var(--ink,#1a1d2e); }
        .ms-prayer-cta-text strong { display:block; font-size:0.95rem; margin-bottom:2px; }
        .ms-prayer-cta-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 20px; background:#059669; color:#fff; border:none; border-radius:20px; font:700 0.85rem var(--font-ui); cursor:pointer; white-space:nowrap; transition:background .15s; flex-shrink:0; }
        .ms-prayer-cta-btn:hover { background:#047857; }
        .ms-prayer-cta-btn .ms-ico { color:#fff; }
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
  const featured = _state.nations[_dayOfYear() % _state.nations.length];

  view.innerHTML = /* html */`
    <div class="grow-section-head">
      <span class="grow-section-title">Nation of the Day</span>
    </div>

    <div class="ms-focus">
      <span class="ms-focus-flag">${_flagMarkup(featured.isoCode)}</span>
      <h2 class="ms-focus-name">${esc(featured.countryName)}</h2>
      <p class="ms-focus-region">${esc(featured.region || '')}${featured.capital ? ` · ${I.pin} ${esc(featured.capital)}` : ''}</p>
      ${_dossierHTML(featured)}
    </div>

    <div class="grow-section-head">
      <span class="grow-section-title">Nations</span>
    </div>

    <div class="ms-prayer-cta">
      <div class="ms-prayer-cta-text">
        <strong>Need prayer or want to connect?</strong>
        Share a request — a shepherd will follow up with you personally.
      </div>
      <button class="ms-prayer-cta-btn" data-help-btn>${I.mail} Send a Prayer Request</button>
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

  const prayerBtn = view.querySelector('[data-help-btn]');
  if (prayerBtn) {
    prayerBtn._prayerSummaryFn = () => {
      const f      = _state.nations[0];
      const lines  = ['I\'m reading about World Missions and have a prayer request.'];
      if (f?.countryName) lines.push(`Featured nation: ${f.countryName}${f.region ? ' (' + f.region + ')' : ''}.`);
      const p = (f?.owPrayerChallenges || [])[0] || '';
      if (p) lines.push(`Today's prayer point: ${p}`);
      lines.push('\nI\'d love to connect with a pastor about missions, outreach, or prayer.');
      return lines.join('\n');
    };
  }
}

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

  gridEl.querySelectorAll('.ms-card').forEach(card => {
    const _toggle = () => {
      const id = card.dataset.id;
      _state.openId = _state.openId === id ? null : id;
      gridEl.querySelectorAll('.ms-card').forEach(c =>
        c.classList.toggle('is-open', c.dataset.id === _state.openId)
      );
      if (_state.openId === id) {
        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      }
    };
    card.addEventListener('click', (e) => { if (!e.target.closest('[data-pray-btn]') && !e.target.closest('a')) _toggle(); });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _toggle(); } });
  });
}

function _cardHTML(n) {
  const evPct  = _pct(n.evangelicalPercent);
  const isOpen = _state.openId === (n._id || n.countryName);

  return /* html */`
    <div class="ms-card${isOpen ? ' is-open' : ''}" data-id="${esc(n._id || n.countryName)}" role="button" tabindex="0">
      <span class="ms-card-flag">${_flagMarkup(n.isoCode)}</span>
      <div class="ms-card-name">${esc(n.countryName)}</div>
      <div class="ms-card-region">${esc(n.region || '')}</div>
      <div class="ms-card-row">
        ${n.gospelAccess ? `<span class="ms-badge ${_accessClass(n.gospelAccess)}">${esc(n.gospelAccess)}</span>` : ''}
        ${evPct ? `<span class="ms-stat-pill">${evPct} Evangelical</span>` : ''}
      </div>
      <div class="ms-expand">
        ${_dossierHTML(n)}
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
  view.querySelector('[data-bind="search"]').addEventListener('input', function () {
    _state.query = this.value;
    _renderGrid(view);
  });

  view.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.filter = btn.dataset.filter;
      view.querySelectorAll('[data-filter]').forEach(b =>
        b.classList.toggle('is-active', b.dataset.filter === _state.filter)
      );
      _renderGrid(view);
    });
  });

  view.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pray-btn]');
    if (!btn) return;
    const id    = btn.dataset.nationId;
    const count = _prayBump(id);
    btn.innerHTML = `${I.pray} Pray with Us · ${count}`;
    btn.classList.add('prayed');
  });
}
