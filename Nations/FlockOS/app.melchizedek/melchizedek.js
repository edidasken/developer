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
let _sortField   = 'lastName';  // 'lastName' | 'firstName' | 'role' | 'status'
let _sortDir     = 'asc';       // 'asc' | 'desc'

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
    case 'about':        content.innerHTML = _viewAbout();       break;
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

function _viewAbout() {
  return `
<div style="max-width:780px;padding-bottom:48px">

  <!-- Header -->
  <div style="margin-bottom:28px">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px">
      <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#92400e,#e8a838);
        display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/></svg>
      </div>
      <div>
        <div style="font:700 1.9rem/1.1 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">Melchizedek</div>
        <div style="font:500 1.05rem/1.4 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96)">
          Background Check &amp; AB-506 Compliance Management
        </div>
      </div>
    </div>
  </div>

  <!-- Scripture origin -->
  <div style="background:linear-gradient(135deg,#1b264f 0%,#2d3a6b 100%);border-radius:14px;
    padding:22px 24px;margin-bottom:28px;border-left:4px solid #e8a838">
    <div style="font:700 0.88rem/1 var(--font-ui,sans-serif);text-transform:uppercase;
      letter-spacing:.1em;color:#e8a838;margin-bottom:10px">The Name · Genesis 14:18–20 &amp; Hebrews 7:1–3</div>
    <p style="font:400 1.15rem/1.75 Georgia,serif;color:#f0f2f8;margin:0 0 12px">
      "And Melchizedek king of Salem brought out bread and wine. He was priest of God Most High.
      And he blessed him and said, 'Blessed be Abram by God Most High, Possessor of heaven and earth;
      and blessed be God Most High, who has delivered your enemies into your hand!'"
    </p>
    <p style="font:400 1.05rem/1.7 Georgia,serif;color:#c9cde0;margin:0">
      "For this Melchizedek, king of Salem, priest of the Most High God, met Abraham returning from the slaughter
      of the kings and blessed him… He is first, by translation of his name, king of righteousness, and then
      he is also king of Salem, that is, king of peace. He is without father or mother or genealogy, having
      neither beginning of days nor end of life, but resembling the Son of God he continues a priest forever."
      — Hebrews 7:1–3
    </p>
    <div style="margin-top:14px;font:400 0.95rem/1.6 var(--font-ui,sans-serif);color:#8892b0">
      <strong style="color:#e8a838">Why this name?</strong> Melchizedek appeared without a recorded past,
      vouched for by God alone — a priest whose legitimacy required no human credentials, only righteousness.
      This module applies that same principle to those who serve the Little Flock: every worker's
      fitness to serve is verified through objective, documented evidence, not assumption.
    </div>
  </div>

  <!-- Section 1 -->
  ${_aboutSection('1', 'The Legal Imperative — California AB-506',
    `<p>Enacted under the California Business and Professions Code, <strong>Assembly Bill 506 (AB-506)</strong>
    mandates strict child abuse prevention protocols for all youth-serving organizations. Compliance is not
    optional — it is a legal requirement to protect children and limit organizational liability.</p>
    <div style="display:grid;gap:10px;margin-top:16px">
      ${_aboutCallout('⏱ The Regular Volunteer Threshold',
        'Under Cal. Bus. &amp; Prof. Code §18975(e)(1), a "regular volunteer" is any person 18 or older who has direct contact with, or supervision of, children for more than <strong>16 hours per month</strong> or <strong>32 hours per year</strong>. Administrators and employees are covered regardless of hours.')}
      ${_aboutCallout('📋 Mandated Reporter Training',
        'Every administrator, employee, and regular volunteer must complete training in child abuse and neglect <em>identification</em> and <em>reporting</em> before serving. The requirement is satisfied by completing the free online training provided by the California Office of Child Abuse Prevention (OCAP) within the State Department of Social Services.')}
      ${_aboutCallout('🔍 LiveScan Fingerprinting',
        'Every qualifying person must submit to a fingerprint-based background check pursuant to Cal. Penal Code §11105.3, processed through the California Department of Justice (DOJ). The check searches state and federal criminal history records and is tied to the organization\'s unique DOJ-issued ORI number.')}
      ${_aboutCallout('👥 Two Mandated Reporters Policy',
        '§18975(c)(2) requires organizations to establish policies ensuring, <em>to the greatest extent possible</em>, that at least two mandated reporters are present whenever staff or volunteers are in contact with or supervising children. This eliminates unsupervised one-on-one access.')}
      ${_aboutCallout('🔒 Non-Transferability',
        'LiveScan results are issued exclusively to the requesting organization\'s ORI and cannot be reused or transferred. A volunteer fingerprinted for a school, another church, or any other ministry <em>must</em> submit new prints tied specifically to Little Flock\'s ORI — even if they were cleared elsewhere last week.')}
    </div>`
  )}

  <!-- Section 2 -->
  ${_aboutSection('2', 'Why Automation — The Case for Melchizedek',
    `<p>Manually tracking AB-506 compliance introduces serious operational and legal risk. Melchizedek
    eliminates that risk by converting every manual step into an automated, auditable workflow.</p>
    <div style="overflow-x:auto;margin-top:16px">
      <table style="width:100%;border-collapse:collapse;font:400 0.95rem/1.6 var(--font-ui,sans-serif)">
        <thead>
          <tr style="background:var(--bg-raised,#f5f6fa)">
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:var(--ink,#1b264f);
              border-bottom:2px solid var(--line,#e5e7ef);width:50%">Manual Challenge</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:var(--ink,#1b264f);
              border-bottom:2px solid var(--line,#e5e7ef)">Melchizedek Solution</th>
          </tr>
        </thead>
        <tbody>
          ${_aboutTableRow(
            'Tracking volunteer hours to identify who crosses the 16 hrs/month or 32 hrs/year threshold.',
            'FlockOS tracks shift schedules, flags profiles approaching the threshold, and triggers the check workflow <em>before</em> limits are breached.'
          )}
          ${_aboutTableRow(
            'Managing DOJ LiveScan paperwork and matching Form 8016 data to volunteer profiles.',
            'Automatically generates pre-filled BCIA 8016 forms with Little Flock\'s ORI, ensuring exact name and demographic matching to prevent DOJ rejection.'
          )}
          ${_aboutTableRow(
            'Validating static background checks that quickly become outdated.',
            'Checkr Continuous Criminal (Continuous Crim) monitoring alerts leadership instantly if a cleared worker has a subsequent arrest.'
          )}
          ${_aboutTableRow(
            'Chasing volunteers via email to complete Mandated Reporter Training.',
            'Automated email sequences, in-app notifications, and certificate upload tracking within the FlockOS dashboard.'
          )}
        </tbody>
      </table>
    </div>`
  )}

  <!-- Section 3 -->
  ${_aboutSection('3', 'Checkr API &amp; LiveScan Integration',
    `<p>LiveScan satisfies California\'s DOJ fingerprint requirement. Pairing it with the Checkr API delivers
    a comprehensive, modern trust-and-safety framework that goes far beyond a one-time check.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px">
      <div style="background:var(--bg-raised,#f5f6fa);border-radius:10px;padding:16px;
        border-top:3px solid #e8a838">
        <div style="font:700 0.9rem/1 var(--font-ui,sans-serif);text-transform:uppercase;
          letter-spacing:.07em;color:#e8a838;margin-bottom:10px">Checkr API</div>
        ${_aboutBullet('Instant Initiation', 'Only a candidate email address is needed to kickstart screening natively from the FlockOS dashboard.')}
        ${_aboutBullet('Continuous Monitoring', 'Checkr\'s data network monitors for post-hire offenses and pushes real-time webhook updates back to FlockOS.')}
        ${_aboutBullet('AI-Powered Adjudication', 'Machine learning classifiers filter non-reportable information per local law, delivering clean Clear / Review statuses.')}
      </div>
      <div style="background:var(--bg-raised,#f5f6fa);border-radius:10px;padding:16px;
        border-top:3px solid #4a7fa5">
        <div style="font:700 0.9rem/1 var(--font-ui,sans-serif);text-transform:uppercase;
          letter-spacing:.07em;color:#4a7fa5;margin-bottom:10px">LiveScan Workflow</div>
        ${_aboutBullet('ORI Integration', 'Little Flock\'s DOJ-issued ORI is stored securely; every initiated check outputs a customized Request for Live Scan Service form.')}
        ${_aboutBullet('Applicant Tracking', 'Volunteers visit a local fingerprint roller with provided documentation. The ATI (Applicant Tracking Identifier) is logged securely.')}
        ${_aboutBullet('DOJ Clearance Syncing', 'Once the DOJ issues a clearance (SCN/OSCN), Melchizedek updates the worker\'s internal risk status, unlocking youth-event scheduling.')}
      </div>
    </div>`
  )}

  <!-- Section 4 -->
  ${_aboutSection('4', 'Technical Architecture — The Onboarding Pipeline',
    `<p>Melchizedek transforms a high-risk administrative chore into a seamless, fully auditable pipeline.</p>
    <div style="margin-top:16px;display:flex;flex-direction:column;gap:0">
      ${_aboutStep('1', '#e8a838', 'Trigger',
        'A FlockOS member is assigned to a youth ministry role, or their attendance tracking hits the AB-506 hour threshold. Melchizedek flags the profile automatically.')}
      ${_aboutStep('2', '#4a7fa5', 'API Call',
        'Melchizedek pings the Checkr API via <code>/v1/candidates</code> to initiate the national check and enroll the candidate in continuous monitoring.')}
      ${_aboutStep('3', '#059669', 'Document Generation',
        'A pre-filled LiveScan Form 8016 is generated with Little Flock\'s ORI. Instructions and a link to the California state Mandated Reporter Training portal are sent to the candidate.')}
      ${_aboutStep('4', '#7c3aed', 'Status Webhooks',
        'As Checkr completes screening, it sends a secure <code>check.completed</code> webhook to FlockOS, automatically updating the member\'s dashboard record in real time.')}
      ${_aboutStep('5', '#1b264f', 'Final Adjudication',
        'Leadership reviews the consolidated Melchizedek dashboard — Checkr result and DOJ LiveScan clearance in one view — and approves or flags the worker for follow-up.')}
    </div>`
  )}

  <!-- Footer note -->
  <div style="margin-top:32px;padding:18px 20px;background:var(--bg-raised,#f5f6fa);
    border-radius:10px;border-left:3px solid #e8a838;
    font:400 0.95rem/1.7 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96)">
    <strong style="color:var(--ink,#1b264f)">A note on security:</strong> The Checkr API key is
    <em>never</em> called client-side. All Checkr API calls route through a Firebase Cloud Function
    that reads the key server-side, ensuring credentials are never exposed in the browser.
    Access to this module is restricted to pastor and admin roles only.
  </div>

</div>`;
}

function _aboutSection(num, title, body) {
  return `
    <div style="margin-bottom:28px">
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:14px">
        <span style="font:700 0.88rem/1 var(--font-ui,sans-serif);background:#e8a838;color:#1b264f;
          border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;
          justify-content:center;flex-shrink:0">${_e(num)}</span>
        <span style="font:700 1.2rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">${title}</span>
      </div>
      <div style="font:400 1rem/1.7 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">${body}</div>
    </div>`;
}

function _aboutCallout(label, text) {
  return `
    <div style="background:var(--bg-raised,#f5f6fa);border-radius:8px;padding:12px 14px;
      display:flex;gap:10px;align-items:flex-start">
      <span style="font-size:1rem;flex-shrink:0">${label.split(' ')[0]}</span>
      <div>
        <div style="font:600 0.95rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:4px">
          ${_e(label.split(' ').slice(1).join(' '))}
        </div>
        <div style="font:400 0.92rem/1.55 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96)">${text}</div>
      </div>
    </div>`;
}

function _aboutTableRow(challenge, solution) {
  return `
    <tr style="border-bottom:1px solid var(--line,#e5e7ef)">
      <td style="padding:10px 14px;color:var(--ink-muted,#7a7f96);vertical-align:top">${challenge}</td>
      <td style="padding:10px 14px;color:var(--ink,#1b264f);vertical-align:top">${solution}</td>
    </tr>`;
}

function _aboutBullet(label, text) {
  return `<div style="margin-bottom:9px">
    <div style="font:600 0.95rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">${_e(label)}</div>
    <div style="font:400 0.92rem/1.55 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96)">${text}</div>
  </div>`;
}

function _aboutStep(num, color, label, text) {
  const last = num === '5';
  return `
    <div style="display:flex;gap:14px;align-items:stretch">
      <div style="display:flex;flex-direction:column;align-items:center;width:36px;flex-shrink:0">
        <div style="width:36px;height:36px;border-radius:50%;background:${color};
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
          font:700 0.92rem var(--font-ui,sans-serif);color:#fff;z-index:1">${_e(num)}</div>
        ${last ? '' : `<div style="width:2px;flex:1;background:var(--line,#e5e7ef);margin:4px 0"></div>`}
      </div>
      <div style="padding:4px 0 ${last ? '0' : '20px'};flex:1">
        <div style="font:700 1rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:4px">${_e(label)}</div>
        <div style="font:400 0.95rem/1.6 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96)">${text}</div>
      </div>
    </div>`;
}

function _sortedMembers(members) {
  const STATUS_ORDER = { clear: 0, pending: 1, consider: 2, '': 3 };
  return [...members].sort((a, b) => {
    const uid_a = a.id || a.memberNumber || a.email || '';
    const uid_b = b.id || b.memberNumber || b.email || '';
    let av, bv;
    switch (_sortField) {
      case 'firstName':
        av = (a.firstName || a.displayName || a.name || '').toLowerCase();
        bv = (b.firstName || b.displayName || b.name || '').toLowerCase();
        break;
      case 'role':
        av = (a.role || a.memberType || '').toLowerCase();
        bv = (b.role || b.memberType || '').toLowerCase();
        break;
      case 'status': {
        const sa = _checksMap[uid_a]?.status || '';
        const sb = _checksMap[uid_b]?.status || '';
        av = STATUS_ORDER[sa] ?? 3;
        bv = STATUS_ORDER[sb] ?? 3;
        break;
      }
      default: // lastName
        av = (a.lastName || a.displayName || a.name || '').toLowerCase();
        bv = (b.lastName || b.displayName || b.name || '').toLowerCase();
    }
    if (av < bv) return _sortDir === 'asc' ? -1 : 1;
    if (av > bv) return _sortDir === 'asc' ?  1 : -1;
    return 0;
  });
}

function _sortBar() {
  const fields = [
    { key: 'lastName',  label: 'Last Name' },
    { key: 'firstName', label: 'First Name' },
    { key: 'role',      label: 'Role' },
    { key: 'status',    label: 'Check Status' },
  ];
  const pills = fields.map(f => {
    const active = f.key === _sortField;
    const arrow  = active ? (_sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    return `<button class="flock-btn flock-btn--sm${active ? ' flock-btn--primary' : ' flock-btn--ghost'}" data-act="sort" data-sort-field="${f.key}" style="min-width:0">${_e(f.label)}${arrow}</button>`;
  }).join('');
  return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:12px">
    <span style="font:600 0.75rem/1 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);text-transform:uppercase;letter-spacing:.05em;margin-right:4px">Sort:</span>
    ${pills}
  </div>`;
}

function _renderMemberList(members, opts = {}) {
  if (!members.length) return '<div class="life-empty">No members found.</div>';
  const sorted = _sortedMembers(members);
  return `${_sortBar()}<div style="display:flex;flex-direction:column;gap:8px">${sorted.map(m => _memberRow(m, opts)).join('')}</div>`;
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
  root.querySelectorAll('[data-act="sort"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.sortField;
      if (_sortField === field) {
        _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        _sortField = field;
        _sortDir   = 'asc';
      }
      _renderView(_currentView);
    });
  });

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
