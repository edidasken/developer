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
const BG_COLLECTION       = 'backgroundChecks';
const CANDIDATE_COLLECTION = 'checkrCandidates';
const DEFAULT_PACKAGE      = 'tasker_standard';

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

    // Authenticate
    if (!N.isAuthenticated()) {
      await UR.authenticate();
    }

    // Role check — pastor+ only
    const profile  = N.getProfile ? N.getProfile() : null;
    const role     = (profile?.role || '').toLowerCase();
    if (_roleLevel(role) < 4) {
      _showAccessDenied(profile);
      return;
    }

    // Mount app
    document.getElementById('melch-boot').style.display = 'none';
    document.getElementById('melch-app').hidden = false;

    _wireNav();
    await _loadData();
    _renderView('overview');
    _subscribeChecks();

  } catch (err) {
    console.error('[Melchizedek] init error', err);
    _showBootError(err);
  }
});

/* ── Auth / Access ──────────────────────────────────────────────────────── */
function _showAccessDenied(profile) {
  document.getElementById('melch-boot').style.display = 'none';
  const overlay = document.getElementById('melch-auth-overlay');
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="melch-auth-card">
      <div class="melch-auth-icon">🛡️</div>
      <div class="melch-auth-title">Access Restricted</div>
      <div class="melch-auth-msg">
        Background check management requires Pastor or Admin access.
        ${profile?.displayName ? `Signed in as <strong>${_e(profile.displayName)}</strong>.` : ''}
      </div>
      <a href="../" class="flock-btn flock-btn--primary" style="display:inline-block;text-decoration:none;">← Back to Launcher</a>
    </div>`;
}

function _showBootError(err) {
  document.getElementById('melch-boot').style.display = 'none';
  const overlay = document.getElementById('melch-auth-overlay');
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="melch-auth-card">
      <div class="melch-auth-icon">⚠️</div>
      <div class="melch-auth-title">Could not load app</div>
      <div class="melch-auth-msg">${_e(err?.message || String(err))}</div>
      <button class="flock-btn flock-btn--primary" onclick="location.reload()">Try Again</button>
    </div>`;
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
    });
  });
}

/* ── Data loading ───────────────────────────────────────────────────────── */
async function _loadData() {
  const V   = window.TheVine;
  const db  = window.firebase?.firestore?.();

  // Load members
  if (V) {
    try {
      const res = await (window.TheScrolls
        ? window.TheScrolls.listMembers({ limit: 500 })
        : Promise.resolve([]));
      _allMembers = _normalizeRows(res);
    } catch (_) {
      _allMembers = [];
    }
    // Fallback: try Firestore members collection
    if (!_allMembers.length && db) {
      try {
        const snap = await db.collection('members').limit(500).get();
        _allMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (_) {}
    }
  } else if (db) {
    try {
      const snap = await db.collection('members').limit(500).get();
      _allMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (_) {}
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

function _normalizeRows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
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
  const total     = _allMembers.length;
  const checked   = Object.keys(_checksMap).length;
  const approved  = Object.values(_checksMap).filter(c => c.status === 'clear').length;
  const notApproved = Object.values(_checksMap).filter(c => c.status === 'consider').length;
  const pending   = Object.values(_checksMap).filter(c => c.status === 'pending').length;
  const noCheck   = total - checked;

  return `
    <div style="margin-bottom:24px">
      <div style="font:700 1.4rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:4px">Background Checks</div>
      <div style="font:400 0.88rem/1.5 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96)">"And Melchizedek king of Salem brought out bread and wine." — Genesis 14:18</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:28px">
      ${_statCard('Total Members', total, 'var(--accent,#4a7fa5)')}
      ${_statCard('Approved', approved, '#059669')}
      ${_statCard('Not Approved', notApproved, '#dc2626')}
      ${_statCard('Pending', pending, '#d97706')}
      ${_statCard('No Check', noCheck, 'var(--ink-muted,#7a7f96)')}
    </div>

    <div style="font:600 0.82rem/1 var(--font-ui,sans-serif);text-transform:uppercase;letter-spacing:.07em;color:var(--ink-muted,#7a7f96);margin-bottom:12px">Members Without a Check</div>
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
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        ${badge}
        ${opts.showInitiateBtn && email ? `
          <button class="flock-btn flock-btn--sm" data-act="initiate-check"
            data-member-id="${_e(uid)}" data-email="${_e(email)}" data-name="${_e(name)}"
            style="white-space:nowrap">
            ${check ? 'Re-check' : 'Initiate Check'}
          </button>` : ''}
        ${check?.invitationUrl ? `
          <a href="${_e(check.invitationUrl)}" target="_blank" rel="noopener noreferrer"
            class="flock-btn flock-btn--sm" style="text-decoration:none;white-space:nowrap">
            View Report ↗
          </a>` : ''}
      </div>
    </div>`;
}

function _statusBadge(status) {
  switch (status) {
    case 'clear':
      return '<span class="wall-status-badge wall-status--ok">APPROVED</span>';
    case 'consider':
      return '<span class="wall-status-badge wall-status--error">NOT APPROVED</span>';
    case 'pending':
      return '<span class="wall-status-badge wall-status--warn">PENDING</span>';
    default:
      return '<span class="wall-status-badge wall-status--muted">No Check</span>';
  }
}

/* ── Action wiring ───────────────────────────────────────────────────────── */
function _wireContentActions(root) {
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
