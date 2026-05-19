/* ═══════════════════════════════════════════════════════════════════════════
   MELCHIZEDEK — Background Check Management
   "And Melchizedek king of Salem brought out bread and wine.
    He was priest of God Most High." — Genesis 14:18

   Manages Checkr background checks for church members.
   Requires pastor/admin role. API key stored via Admin → Integrations → Checkr.

   Security: Checkr API is NEVER called client-side. All Checkr calls go through
   the initiateBackgroundCheck Cloud Function which reads the key server-side.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Constants ──────────────────────────────────────────────────────────── */
const BG_COLLECTION        = 'backgroundChecks';
const CANDIDATE_COLLECTION = 'checkrCandidates';
const DEFAULT_PACKAGE      = 'tasker_standard';

// Live Scan result values (California DOJ fingerprint-based check — AB 506)
// 'clear' = DOJ returned no disqualifying record
// 'pending' = submitted, awaiting DOJ response
// 'failed' = DOJ returned disqualifying record

const ROLE_LEVELS = { readonly: 0, volunteer: 1, care: 2, deacon: 2, leader: 3, treasurer: 3, pastor: 4, admin: 5 };

/* ── State ──────────────────────────────────────────────────────────────── */
let _allMembers  = [];
let _checksMap   = {}; // memberId → { status, checkrCandidateId, checkrReportId, invitationSentAt, updatedAt }
let _currentView = 'overview';
let _unsubChecks = null;

/* ── Helpers ────────────────────────────────────────────────────────────── */
const _e = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function _roleLevel(role) {
  return ROLE_LEVELS[String(role || '').toLowerCase()] ?? -1;
}

async function _poll(fn, timeout = 8000, interval = 120) {
  const deadline = Date.now() + timeout;
  return new Promise((resolve, reject) => {
    const check = () => {
      if (fn()) return resolve(true);
      if (Date.now() > deadline) return reject(new Error('Timeout waiting for dependency'));
      setTimeout(check, interval);
    };
    check();
  });
}

/* ── Boot ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Wait for UpperRoom + Nehemiah to load (script defer)
    await _poll(() => window.UpperRoom && window.Nehemiah && typeof window.Nehemiah.isAuthenticated === 'function');

    const UR = window.UpperRoom;
    const N  = window.Nehemiah;

    // Auth guard — redirect to sign-in if no active session
    if (!N.isAuthenticated()) {
      window.location.replace('app.melchizedek/index.html');
      return;
    }

    // Role check — pastor+ only; redirect to sign-in if insufficient
    const profile  = N.getProfile ? N.getProfile() : null;
    const role     = (profile?.role || '').toLowerCase();
    if (_roleLevel(role) < 4) {
      window.location.replace('app.melchizedek/index.html');
      return;
    }

    // Wait for Firebase Auth token to be fully restored before any Firestore reads
    await new Promise(resolve => {
      const unsub = window.firebase?.auth?.().onAuthStateChanged(user => {
        unsub?.();
        resolve(user);
      });
      if (!window.firebase?.auth) resolve(null); // no-op if firebase not ready
    });

    // Mount app
    document.getElementById('melch-boot').style.display = 'none';
    document.getElementById('melch-app').hidden = false;

    _wireNav();
    _wireHeader(profile);
    await _loadData();
    _renderView('overview');
    _subscribeChecks();

  } catch (err) {
    console.error('[Melchizedek] init error', err);
    _showBootError(err);
  }
});

/* ── Boot error ─────────────────────────────────────────────────────────── */
function _showBootError(err) {
  document.getElementById('melch-boot').style.display = 'none';
  document.body.insertAdjacentHTML('beforeend', `
    <div style="position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:var(--bg,#0e1628);padding:24px">
      <div style="background:var(--bg-raised,#fff);border-radius:16px;padding:36px 28px;max-width:360px;width:100%;text-align:center;box-shadow:0 4px 32px rgba(0,0,0,.18)">
        <div style="font-size:2.4rem;margin-bottom:12px">⚠️</div>
        <div style="font:700 1.1rem/1.3 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:8px">Could not load app</div>
        <div style="font:400 0.87rem/1.5 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-bottom:20px">${_e(err?.message || String(err))}</div>
        <button class="flock-btn flock-btn--primary" onclick="location.reload()">Try Again</button>
      </div>
    </div>`);
}

/* ── Header ─────────────────────────────────────────────────────────────── */
const MELCH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><polyline points="9,12 11,14 15,10"/></svg>';

function _wireHeader(profile) {
  const host = document.getElementById('melch-topbar');
  if (!host) return;

  import('../Scripts/the_unity_header.js').then(({ mountUnityHeader }) => {
    const ctrl = mountUnityHeader(host, {
      appId:       'melchizedek',
      appName:     'Melchizedek',
      appIconSvg:  MELCH_ICON,
      appAccent:   '#e8a838',
      appAccentDk: '#92400e',
      homeHref:    'app.melchizedek/',
      user:        profile || null,
      onSignOut:   async () => {
        try { await window.Nehemiah?.signOut?.(); } catch (_) {}
        window.location.replace('app.melchizedek/index.html');
      },
      onHamburger: () => {
        document.body.classList.toggle('veil-side-open');
      },
      features: [
        { id: 'view-overview',     label: 'Overview',     hint: 'Navigate', run: () => _wireNavTo('overview') },
        { id: 'view-members',      label: 'All Members',  hint: 'Navigate', run: () => _wireNavTo('members') },
        { id: 'view-pending',      label: 'Pending',      hint: 'Navigate', run: () => _wireNavTo('pending') },
        { id: 'view-approved',     label: 'Approved',     hint: 'Navigate', run: () => _wireNavTo('approved') },
        { id: 'view-not-approved', label: 'Not Approved', hint: 'Navigate', run: () => _wireNavTo('not-approved') },
      ],
    });
    setTimeout(() => { try { ctrl?.update?.({ user: profile || null }); } catch (_) {} }, 1200);
  }).catch(err => console.warn('[Melchizedek] Unity header mount failed:', err));

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    const side = document.getElementById('the-veil-side');
    if (side && document.body.classList.contains('veil-side-open') &&
        !side.contains(e.target) && !e.target.closest('.unity-header')) {
      document.body.classList.remove('veil-side-open');
    }
  });
}

function _wireNavTo(view) {
  document.querySelectorAll('[data-melch-view]').forEach(b => {
    b.classList.toggle('is-active', b.dataset.melchView === view);
    b.setAttribute('aria-current', b.dataset.melchView === view ? 'page' : 'false');
  });
  _currentView = view;
  _renderView(view);
  document.body.classList.remove('veil-side-open');
}

/* ── Navigation ─────────────────────────────────────────────────────────── */
function _wireNav() {
  document.querySelectorAll('[data-melch-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.melchView;
      document.querySelectorAll('[data-melch-view]').forEach(b => {
        b.classList.toggle('is-active', b.dataset.melchView === view);
        b.setAttribute('aria-current', b.dataset.melchView === view ? 'page' : 'false');
      });
      _currentView = view;
      _renderView(view);
      // Close mobile sidebar after nav
      document.body.classList.remove('veil-side-open');
    });
  });
}

/* ── Data loading ───────────────────────────────────────────────────────── */
async function _loadData() {
  const db = window.firebase?.firestore?.();

  // Load members directly from Firestore
  if (db) {
    try {
      const snap = await db.collection('members').limit(500).get();
      _allMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[Melchizedek] members load error', err);
      _allMembers = [];
    }
  }

  // Filter inactive
  _allMembers = _allMembers.filter(r => {
    const ms = String(r.membershipStatus || '').toLowerCase();
    const s  = String(r.status || r.active || '').toLowerCase();
    return ms !== 'archived' && s !== 'inactive' && s !== 'false' && s !== '0' && s !== 'archived';
  });

  // Load background checks snapshot
  if (db) {
    try {
      const snap = await db.collection(BG_COLLECTION).get();
      _checksMap = {};
      snap.docs.forEach(d => { _checksMap[d.id] = d.data(); });
    } catch (_) {}
  }
}

/* ── Live subscription ───────────────────────────────────────────────────── */
function _subscribeChecks() {
  const db = window.firebase?.firestore?.();
  if (!db) return;
  if (_unsubChecks) _unsubChecks();
  _unsubChecks = db.collection(BG_COLLECTION).onSnapshot(snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'removed') {
        delete _checksMap[change.doc.id];
      } else {
        _checksMap[change.doc.id] = change.doc.data();
      }
    });
    // Re-render current view
    _renderView(_currentView);
  }, err => console.warn('[Melchizedek] checks subscription error', err));
}

/* ── Views ──────────────────────────────────────────────────────────────── */
function _renderView(view) {
  const content = document.getElementById('melch-content');
  if (!content) return;

  switch (view) {
    case 'overview':    content.innerHTML = _viewOverview();    break;
    case 'members':     content.innerHTML = _viewMembers(_allMembers);  break;
    case 'pending':     content.innerHTML = _viewFiltered('pending',     'Pending Checks',  'Checks sent and awaiting results.'); break;
    case 'approved':    content.innerHTML = _viewFiltered('clear',       'Approved',        'Members whose background check came back clear.'); break;
    case 'not-approved': content.innerHTML = _viewFiltered('consider',   'Not Approved',    'Members whose background check requires further review.'); break;
    default:            content.innerHTML = _viewOverview();
  }
  _wireContentActions(content);
}

function _viewOverview() {
  const total       = _allMembers.length;
  const checked     = Object.keys(_checksMap).length;
  const approved    = Object.values(_checksMap).filter(c => c.status === 'clear').length;
  const notApproved = Object.values(_checksMap).filter(c => c.status === 'consider').length;
  const pending     = Object.values(_checksMap).filter(c => c.status === 'pending').length;
  const noCheck     = total - checked;

  // Live Scan stats (CA DOJ fingerprint — manual record)
  const lsCleared  = Object.values(_checksMap).filter(c => c.liveScan?.result === 'clear').length;
  const lsPending  = Object.values(_checksMap).filter(c => c.liveScan?.result === 'pending').length;
  const lsFailed   = Object.values(_checksMap).filter(c => c.liveScan?.result === 'failed').length;
  const lsNone     = total - Object.values(_checksMap).filter(c => c.liveScan?.result).length;

  return `
    <div style="margin-bottom:24px">
      <div style="font:700 1.4rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:4px">Background Checks</div>
      <div style="font:400 0.88rem/1.5 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96)">"And Melchizedek king of Salem brought out bread and wine." — Genesis 14:18</div>
    </div>

    <div style="font:600 0.82rem/1 var(--font-ui,sans-serif);text-transform:uppercase;letter-spacing:.07em;color:var(--ink-muted,#7a7f96);margin-bottom:8px">Checkr</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:24px">
      ${_statCard('Total Members', total, 'var(--accent,#4a7fa5)')}
      ${_statCard('Approved', approved, '#059669')}
      ${_statCard('Not Approved', notApproved, '#dc2626')}
      ${_statCard('Pending', pending, '#d97706')}
      ${_statCard('No Check', noCheck, 'var(--ink-muted,#7a7f96)')}
    </div>

    <div style="font:600 0.82rem/1 var(--font-ui,sans-serif);text-transform:uppercase;letter-spacing:.07em;color:var(--ink-muted,#7a7f96);margin-bottom:8px">
      Live Scan <span style="font-weight:400;font-size:.72rem;text-transform:none;letter-spacing:0">— CA DOJ Fingerprint (manual record)</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:28px">
      ${_statCard('LS Cleared', lsCleared, '#059669')}
      ${_statCard('LS Pending', lsPending, '#d97706')}
      ${_statCard('LS Failed', lsFailed, '#dc2626')}
      ${_statCard('No Live Scan', lsNone, 'var(--ink-muted,#7a7f96)')}
    </div>

    <div style="font:600 0.82rem/1 var(--font-ui,sans-serif);text-transform:uppercase;letter-spacing:.07em;color:var(--ink-muted,#7a7f96);margin-bottom:12px">Members Without a Checkr Check</div>
    ${_renderMemberList(_allMembers.filter(m => {
      const uid = m.id || m.memberNumber || m.email || '';
      return !_checksMap[uid];
    }), { showInitiateBtn: true })}
  `;
}

function _statCard(label, count, color) {
  return `
    <div class="ms-stat-card" style="text-align:center">
      <div style="font:700 2rem/1 var(--font-ui,sans-serif);color:${color}">${count}</div>
      <div style="font:500 0.78rem/1.3 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-top:4px">${_e(label)}</div>
    </div>`;
}

function _viewMembers(members) {
  return `
    <div style="font:700 1.2rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:16px">All Members</div>
    ${_renderMemberList(members, { showInitiateBtn: true })}
  `;
}

function _viewFiltered(status, title, subtitle) {
  const members = _allMembers.filter(m => {
    const uid = m.id || m.memberNumber || m.email || '';
    return (_checksMap[uid]?.status || '') === status;
  });
  return `
    <div style="margin-bottom:20px">
      <div style="font:700 1.2rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:4px">${_e(title)}</div>
      <div style="font:400 0.85rem/1.5 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96)">${_e(subtitle)}</div>
    </div>
    ${members.length
      ? _renderMemberList(members, { showInitiateBtn: status === 'consider' })
      : `<div class="life-empty">No members in this category.</div>`}
  `;
}

/* ── Member list renderer ────────────────────────────────────────────────── */
const _AVATAR_COLORS = ['#7c3aed','#0ea5e9','#059669','#c05818','#db2777','#6366f1','#0891b2','#b45309','#be185d','#4f46e5'];

function _renderMemberList(members, opts = {}) {
  if (!members.length) return '<div class="life-empty">No members found.</div>';
  return `<div style="display:flex;flex-direction:column;gap:8px">${members.map(m => _memberRow(m, opts)).join('')}</div>`;
}

function _memberRow(p, opts = {}) {
  const first    = p.firstName || '';
  const last     = p.lastName || '';
  const name     = p.displayName || p.name || `${first} ${last}`.trim() || 'Unknown';
  const role     = (p.role || p.memberType || 'member').toLowerCase();
  const email    = (p.email || p.primaryEmail || '').trim();
  const uid      = p.id || p.memberNumber || p.email || '';
  const initials = (first ? first[0] : (name[0] || '')) + (last ? last[0] : (name[1] || ''));
  const color    = _AVATAR_COLORS[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % _AVATAR_COLORS.length];
  const check    = _checksMap[uid] || null;
  const badge    = _statusBadge(check?.status);

  return `
    <div class="melch-member-row" data-member-id="${_e(uid)}" style="
      display:flex;align-items:center;gap:12px;padding:12px 14px;
      background:var(--bg-raised,#fff);border-radius:10px;
      border:1px solid var(--line,#e5e7ef);
    ">
      <div style="width:36px;height:36px;border-radius:50%;background:${color};
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
        font:700 0.75rem var(--font-ui,sans-serif);color:#fff">
        ${_e(initials.toUpperCase().slice(0,2))}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font:600 0.92rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_e(name)}</div>
        <div style="font:400 0.78rem/1.4 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_e(role)}${email ? ' · ' + _e(email) : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
        ${badge}
        ${_liveScanBadge(check?.liveScan)}
        ${opts.showInitiateBtn && email ? `
          <button class="flock-btn flock-btn--primary flock-btn--sm" data-act="initiate-check"
            data-member-id="${_e(uid)}" data-email="${_e(email)}" data-name="${_e(name)}">
            ${check ? 'Re-check' : 'Initiate Check'}
          </button>` : ''}
        <button class="flock-btn flock-btn--ghost flock-btn--sm" data-act="record-livescan"
          data-member-id="${_e(uid)}" data-name="${_e(name)}">
          ${check?.liveScan ? 'Update LS' : '+ Live Scan'}
        </button>
        ${check?.invitationUrl ? `
          <a href="${_e(check.invitationUrl)}" target="_blank" rel="noopener noreferrer"
            class="flock-btn flock-btn--sm" style="text-decoration:none">
            View Report ↗
          </a>` : ''}
      </div>
    </div>`;
}

function _statusBadge(status) {
  switch (status) {
    case 'clear':
      return '<span class="wall-status-badge wall-status--ok" title="Checkr: Approved">APPROVED</span>';
    case 'consider':
      return '<span class="wall-status-badge wall-status--error" title="Checkr: Not Approved">NOT APPROVED</span>';
    case 'pending':
      return '<span class="wall-status-badge wall-status--warn" title="Checkr: Pending">PENDING</span>';
    default:
      return '<span class="wall-status-badge wall-status--muted" title="No Checkr check">No Check</span>';
  }
}

function _liveScanBadge(ls) {
  if (!ls?.result) return '<span class="wall-status-badge wall-status--muted" title="No Live Scan on file">No LS</span>';
  switch (ls.result) {
    case 'clear':
      return `<span class="wall-status-badge wall-status--ok" title="Live Scan cleared${ls.clearedAt ? ' · ' + _fmtDate(ls.clearedAt) : ''}">LS CLEAR</span>`;
    case 'pending':
      return `<span class="wall-status-badge wall-status--warn" title="Live Scan submitted${ls.submittedAt ? ' · ' + _fmtDate(ls.submittedAt) : ''}">LS PENDING</span>`;
    case 'failed':
      return `<span class="wall-status-badge wall-status--error" title="Live Scan failed${ls.clearedAt ? ' · ' + _fmtDate(ls.clearedAt) : ''}">LS FAILED</span>`;
    default:
      return '<span class="wall-status-badge wall-status--muted">LS ?</span>';
  }
}

function _fmtDate(val) {
  if (!val) return '';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) { return ''; }
}

/* ── Action wiring ───────────────────────────────────────────────────────── */
function _wireContentActions(root) {
  root.querySelectorAll('[data-act="record-livescan"]').forEach(btn => {
    btn.addEventListener('click', () => {
      _showLiveScanModal(btn.dataset.memberId, btn.dataset.name);
    });
  });

  root.querySelectorAll('[data-act="initiate-check"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const memberId = btn.dataset.memberId;
      const email    = btn.dataset.email;
      const name     = btn.dataset.name;
      if (!email) {
        alert('This member has no email address. Add an email before initiating a background check.');
        return;
      }
      const ok = confirm(`Initiate a background check for ${name}?\n\nCheckr will send an email to ${email} with a secure link to submit their information.`);
      if (!ok) return;

      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = 'Sending…';

      try {
        await _initiateCheck({ memberId, email, name });
        btn.textContent = 'Sent ✓';
        setTimeout(() => { btn.disabled = false; btn.textContent = 'Re-check'; }, 3000);
      } catch (err) {
        console.error('[Melchizedek] initiateCheck error', err);
        alert(`Could not initiate check: ${err?.message || String(err)}`);
        btn.disabled = false;
        btn.textContent = orig;
      }
    });
  });
}

/* ── Live Scan modal (California DOJ fingerprint — AB 506 — manual entry) ── */
function _showLiveScanModal(memberId, name) {
  const existing = _checksMap[memberId]?.liveScan || {};

  // Remove any existing modal
  document.getElementById('melch-ls-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'melch-ls-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg-raised,#fff);border-radius:14px;padding:28px 24px;width:100%;max-width:400px;box-shadow:0 8px 48px rgba(0,0,0,.22)">
      <div style="font:700 1rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:4px">Live Scan Record</div>
      <div style="font:400 0.82rem/1.5 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-bottom:20px">
        ${_e(name)} — California DOJ Fingerprint (AB 506)
      </div>

      <label style="display:block;margin-bottom:14px">
        <div style="font:600 0.78rem var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-bottom:4px">Result</div>
        <select id="ls-result" style="width:100%;padding:8px 10px;border:1px solid var(--line,#e5e7ef);border-radius:7px;font:0.88rem var(--font-ui,sans-serif);background:var(--bg,#fff);color:var(--ink,#1b264f)">
          <option value="pending" ${existing.result === 'pending' ? 'selected' : ''}>Pending — submitted, awaiting DOJ response</option>
          <option value="clear"   ${existing.result === 'clear'   ? 'selected' : ''}>Cleared — DOJ returned no disqualifying record</option>
          <option value="failed"  ${existing.result === 'failed'  ? 'selected' : ''}>Failed — DOJ returned disqualifying record</option>
        </select>
      </label>

      <label style="display:block;margin-bottom:14px">
        <div style="font:600 0.78rem var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-bottom:4px">Date Submitted to Live Scan Station</div>
        <input type="date" id="ls-submitted" value="${_isoDate(existing.submittedAt)}"
          style="width:100%;padding:8px 10px;border:1px solid var(--line,#e5e7ef);border-radius:7px;font:0.88rem var(--font-ui,sans-serif);background:var(--bg,#fff);color:var(--ink,#1b264f)">
      </label>

      <label style="display:block;margin-bottom:20px">
        <div style="font:600 0.78rem var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-bottom:4px">Date Result Received from DOJ</div>
        <input type="date" id="ls-received" value="${_isoDate(existing.clearedAt)}"
          style="width:100%;padding:8px 10px;border:1px solid var(--line,#e5e7ef);border-radius:7px;font:0.88rem var(--font-ui,sans-serif);background:var(--bg,#fff);color:var(--ink,#1b264f)">
      </label>

      <div style="font:400 0.74rem/1.55 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);padding:10px 12px;background:var(--bg-alt,#f5f6fa);border-radius:7px;margin-bottom:20px">
        Live Scan is done in person at a CA DOJ-approved fingerprint station. Results go directly from DOJ to your organization — record the result here to keep your roster current.
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="ls-cancel" class="flock-btn flock-btn--ghost flock-btn--sm">Cancel</button>
        <button id="ls-save"   class="flock-btn flock-btn--primary flock-btn--sm">Save Record</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector('#ls-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#ls-save').addEventListener('click', async () => {
    const result    = modal.querySelector('#ls-result').value;
    const submitted = modal.querySelector('#ls-submitted').value;
    const received  = modal.querySelector('#ls-received').value;
    const saveBtn   = modal.querySelector('#ls-save');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      await _saveLiveScan({ memberId, name, result, submitted, received });
      modal.remove();
    } catch (err) {
      console.error('[Melchizedek] saveLiveScan error', err);
      alert(`Could not save: ${err?.message || String(err)}`);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Record';
    }
  });
}

async function _saveLiveScan({ memberId, name, result, submitted, received }) {
  const db = window.firebase?.firestore?.();
  if (!db) throw new Error('Firestore not available.');

  const lsData = {
    result,
    submittedAt: submitted || null,
    clearedAt:   received  || null,
    recordedAt:  new Date().toISOString(),
  };

  await db.collection(BG_COLLECTION).doc(memberId).set({
    memberId,
    name,
    liveScan:  lsData,
    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // Optimistic local update
  if (!_checksMap[memberId]) _checksMap[memberId] = { memberId, name };
  _checksMap[memberId].liveScan  = lsData;
  _checksMap[memberId].updatedAt = new Date().toISOString();
  _renderView(_currentView);
}

function _isoDate(val) {
  if (!val) return '';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toISOString().split('T')[0];
  } catch (_) { return ''; }
}

/* ── Checkr API proxy (via Cloud Function) ──────────────────────────────── */
async function _initiateCheck({ memberId, email, name, packageSlug = DEFAULT_PACKAGE }) {
  // Confirm the Cloud Function is available
  const funcs = window.firebase?.functions?.();
  if (!funcs) throw new Error('Firebase Functions not available. Ensure the app is connected to Firebase.');

  const fn = funcs.httpsCallable('initiateBackgroundCheck');
  const result = await fn({ memberId, email, name, packageSlug });

  if (!result.data?.ok) {
    throw new Error(result.data?.error || 'Unknown error from background check service.');
  }

  // Optimistically update local state
  _checksMap[memberId] = {
    status: 'pending',
    memberId,
    email,
    name,
    invitationSentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...(result.data.candidateId ? { checkrCandidateId: result.data.candidateId } : {}),
  };
  _renderView(_currentView);
}
