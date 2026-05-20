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
let _sortField   = 'firstName'; // 'lastName' | 'firstName' | 'role' | 'status'
let _sortDir     = 'asc';       // 'asc' | 'desc'
let _orgName     = '';          // loaded from Firestore appConfig/church_name

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
    // Note: <base href="../"> in the HTML means 'app.melchizedek/index.html'
    // resolves correctly to /app.melchizedek/index.html
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
      signInHref:  'app.melchizedek/index.html',
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
        { id: 'view-compliance',   label: 'Compliance',   hint: 'Navigate', run: () => _wireNavTo('compliance') },
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

  // Load org name from appConfig
  if (db) {
    try {
      const cfgDoc = await db.collection('appConfig').doc('church_name').get();
      _orgName = cfgDoc.exists ? (cfgDoc.data()?.value || '') : '';
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
    case 'compliance':   content.innerHTML = _viewCompliance(); break;
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
    ${_complianceAlerts()}
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
  const parentNotifBanner = status === 'consider' && members.length ? `
    <div style="padding:14px 16px;background:#fff7ed;border-radius:10px;border-left:4px solid #d97706;
      margin-bottom:18px;font:400 0.9rem/1.6 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">
      <strong style="color:#92400e">⚠ Pen. Code §11105.3(c)(1) — Mandatory Parent Notification</strong><br>
      If your organization proceeds with placing any of these individuals in a role supervising minors,
      you are legally required to notify affected parents/guardians in writing at least
      <strong>10 days before that person begins duties</strong>. Use the "Document Notification" button
      on each record to log compliance.
    </div>` : '';
  return `
    <div style="margin-bottom:20px">
      <div style="font:700 1.2rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:4px">${_e(title)}</div>
      <div style="font:400 0.85rem/1.5 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96)">${_e(subtitle)}</div>
    </div>
    ${parentNotifBanner}
    ${members.length
      ? _renderMemberList(members, { showInitiateBtn: status === 'consider', showParentNotif: status === 'consider' })
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
    `<p>Originally enacted in 2021 and <strong>fully in force as of January 1, 2024</strong> (amended by AB 1754,
    Stats. 2023, Ch. 131), <strong>Assembly Bill 506</strong> — codified at Cal. Bus. &amp; Prof. Code §18975 —
    requires every qualifying youth-serving organization to implement a comprehensive child abuse prevention
    program. The transitional exemption previously granted to legacy organizations has expired. Full compliance
    is now mandatory with no exceptions.</p>
    <div style="display:grid;gap:10px;margin-top:16px">
      ${_aboutCallout('⏱ The Regular Volunteer Threshold',
        '<strong>§18975(e)(1):</strong> A &ldquo;regular volunteer&rdquo; is any person <strong>18 or older</strong> who has direct contact with, or supervision of, children for more than <strong>16 hours per month</strong> or <strong>32 hours per year</strong>. Administrators and paid employees are subject to all requirements regardless of hours.')}
      ${_aboutCallout('📋 Mandated Reporter Training',
        '<strong>§18975(a):</strong> Every administrator, employee, and regular volunteer must complete state-approved training in child abuse and neglect <em>identification</em> and child abuse and neglect <em>reporting</em> before beginning service. These workers are legally designated mandated reporters under Pen. Code §11165.7(a)(7). The requirement may be satisfied by the free online course offered by the California Office of Child Abuse Prevention (OCAP) at the State Department of Social Services.')}
      ${_aboutCallout('🔍 Fingerprint Background Check &amp; Annual Waiver',
        '<strong>§18975(b) / Pen. Code §11105.3:</strong> Every qualifying person must submit to a state and federal fingerprint-based criminal history background check processed through the California Department of Justice. <strong>DOJ processing is free for nonprofits</strong> (§11105.3(b)(1)). Organizations must also maintain a signed annual waiver from each worker authorizing release of their criminal history — this waiver must be renewed every year (§11105.3(b)(2)(C)).')}
      ${_aboutCallout('👥 Two Mandated Reporters Policy',
        '<strong>§18975(c)(2)(A):</strong> Organizations must adopt written policies requiring, <em>to the greatest extent possible</em>, the presence of at least two mandated reporters whenever staff or volunteers are in contact with or supervising children. <em>Narrow exception (§18975(c)(2)(B)):</em> one-to-one mentoring programs may substitute this requirement by adopting comprehensive screening, volunteer and parent training, and regular parent contact policies.')}
      ${_aboutCallout('📢 Mandatory Parent Notification',
        '<strong>Pen. Code §11105.3(c)(1):</strong> If a background check reveals a disqualifying conviction — including sex offenses under §290, child abuse offenses under §§273a or 273d, or assault under §220 — and the organization still places that person in a role supervising minors, it <em>must</em> notify the parents or guardians of affected children at least <strong>10 days before that person begins duties</strong>. This obligation cannot be waived.')}
      ${_aboutCallout('🔒 Non-Transferability of Criminal History Records',
        '<strong>Pen. Code §11105.3(g):</strong> DOJ criminal history records are confidential to the specific requesting agency and may not be transferred, shared, or relied upon by any other organization. A volunteer cleared by a school, another church, or any other ministry must submit new fingerprints tied to Little Flock\'s own ORI — prior clearances have no legal standing here.')}
    </div>
    ${_aboutRefPills([
      { label: 'BPC §18975 — Full Text', url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=18975.&lawCode=BPC' },
      { label: 'Pen. Code §11105.3', url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=11105.3.&lawCode=PEN' },
      { label: 'OCAP Mandated Reporter Training', url: 'https://www.cdss.ca.gov/inforesources/ocap' },
      { label: 'DOJ Agency Authorization', url: 'https://oag.ca.gov/fingerprints/agencies' },
      { label: 'LiveScan Locations', url: 'https://oag.ca.gov/fingerprints/locations' }
    ])}`
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
        ${_aboutBullet('ORI Integration', 'Little Flock\'s DOJ-issued ORI is stored securely; every initiated check outputs a customized BCIA 8016 Request for Live Scan Service form pre-filled with the correct agency data.')}
        ${_aboutBullet('Applicant Tracking', 'Volunteers visit an authorized Live Scan operator with provided documentation. The ATI (Applicant Tracking Identifier) is logged in the Melchizedek record.')}
        ${_aboutBullet('DOJ Clearance Syncing', 'Once the DOJ issues a clearance, Melchizedek updates the worker\'s compliance status, unlocking youth-event scheduling assignments.')}
        ${_aboutBullet('Subsequent Arrest Notification', 'Per Pen. Code §11105.3(i)(2), organizations may enroll cleared workers in the DOJ\'s ongoing <em>Subsequent Arrest Notification</em> service — the California equivalent of continuous monitoring. Melchizedek manages enrollment and routes any future notifications to leadership automatically.')}
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

  <!-- Section 5 -->
  ${_aboutSection('5', 'Going Further — How FlockOS Cares for the Little Flock',
    `<p>AB-506 sets the legal floor. Melchizedek is built to go well beyond it — transforming compliance
    from a checklist into a living, breathing layer of pastoral care for every person who serves.</p>
    <div style="display:grid;gap:10px;margin-top:16px">
      ${_aboutCallout('📡 Hour Threshold Watchdog',
        'FlockOS tracks every member\'s ministry involvement hours in real time. When a volunteer approaches the 16 hr/month or 32 hr/year threshold, Melchizedek flags the profile and opens the compliance workflow — <em>before</em> the legal line is crossed, not after.')}
      ${_aboutCallout('🔔 Dual Continuous Monitoring',
        'Cleared workers are enrolled in both the California DOJ\'s Subsequent Arrest Notification service (§11105.3(i)(2)) and Checkr\'s national Continuous Criminal monitoring simultaneously — providing state-level and national-level post-clearance surveillance in a single dashboard.')}
      ${_aboutCallout('📅 Annual Waiver Auto-Renewal',
        'California law requires a fresh signed waiver from each worker every year (§11105.3(b)(2)(C)). Melchizedek auto-generates and routes renewal requests 30 days before expiry, tracks completion, and locks the worker\'s scheduling access until the waiver is re-signed.')}
      ${_aboutCallout('📜 OCAP Training Certificate Vault',
        'Every worker\'s OCAP completion certificate is uploaded, stored, and tracked within their Melchizedek profile. The system flags certificates as they age and resurfaces the renewal workflow — because mandated reporter training is not a one-time event.')}
      ${_aboutCallout('🗓 Two-Reporter Scheduling Guard',
        'When a youth-event shift is being scheduled in FlockOS, Melchizedek cross-references §18975(c)(2)(A) and blocks any assignment that would leave a single worker alone with children. The scheduling UI surfaces the policy requirement and prompts leadership to add a second cleared reporter before saving.')}
      ${_aboutCallout('📣 Parent Notification Workflow',
        'If a background check returns a Review result that leadership chooses to manually override, Melchizedek immediately surfaces the §11105.3(c)(1) parent notification obligation — generates the required written notice, tracks the 10-day window, and records confirmation of delivery in the audit log.')}
      ${_aboutCallout('📊 Insurance Compliance Record',
        'Under §18975(d), insurers may request proof of compliance before writing liability coverage for a youth-serving organization. Melchizedek generates a complete compliance report on demand — training completions, background check dates, waiver status, and policy acknowledgments — providing everything needed to satisfy an insurer\'s loss control audit.')}
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

function _aboutRefPills(refs) {
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:18px">
    ${refs.map(r =>
      `<a href="${r.url}" target="_blank" rel="noopener"
        style="display:inline-flex;align-items:center;gap:5px;padding:6px 13px;
          background:var(--bg-raised,#f5f6fa);border:1px solid var(--line,#e5e7ef);
          border-radius:20px;font:500 0.85rem/1 var(--font-ui,sans-serif);
          color:#4a7fa5;text-decoration:none;white-space:nowrap">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        ${_e(r.label)}</a>`
    ).join('')}
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
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        ${badge}
        ${_liveScanBadge(check?.liveScan)}
        <button class="flock-btn flock-btn--ghost flock-btn--sm" data-act="open-admin-modal"
          data-member-id="${_e(uid)}" data-name="${_e(name)}" data-email="${_e(email)}"
          ${opts.showInitiateBtn ? 'data-show-initiate="1"' : ''}
          ${opts.showParentNotif ? 'data-show-parent-notif="1"' : ''}
          ${check?.invitationUrl ? `data-invitation-url="${_e(check.invitationUrl)}"` : ''}
          style="font-weight:600">Admin</button>
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

/* ── Admin modal (overview + member list rows) ───────────────────────────── */
function _ensureAdminModal() {
  let modal = document.getElementById('melch-adm-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'melch-adm-modal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.45);align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = '<div class="melch-adm-card" style="background:var(--surface,#fff);border-radius:16px;width:100%;max-width:400px;max-height:88vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.22)"></div>';
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  document.body.appendChild(modal);
  return modal;
}

function _openAdminModal(btn) {
  const uid          = btn.dataset.memberId || '';
  const dname        = btn.dataset.name || '';
  const email        = btn.dataset.email || '';
  const showInitiate = btn.hasAttribute('data-show-initiate');
  const showPNtf     = btn.hasAttribute('data-show-parent-notif');
  const showComp     = btn.hasAttribute('data-show-compliance');
  const invUrl       = btn.dataset.invitationUrl || '';

  const m     = _allMembers.find(x => (x.id || x.memberNumber || x.email || '') === uid) || {};
  const check = _checksMap[uid] || {};
  const ws    = _waiverStatus(check);
  const os    = _ocapStatus(check);
  const hs    = _hoursStatus(check);

  const initials = ((m.firstName?.[0] || dname[0] || '') + (m.lastName?.[0] || dname[1] || '')).toUpperCase().slice(0, 2);
  const color    = _AVATAR_COLORS[(dname.charCodeAt(0) + (dname.charCodeAt(1) || 0)) % _AVATAR_COLORS.length];
  const san      = check.sanEnrolled ? _statusPill('SAN Enrolled', '#059669') : _statusPill('SAN Not Enrolled', '#7a7f96');
  const pn       = check.parentNotif?.sent
    ? _statusPill('Notif Sent ' + _fmtDate(check.parentNotif.sentDate), '#059669')
    : _statusPill('No Parent Notif', '#7a7f96');

  const modal = _ensureAdminModal();
  const card  = modal.querySelector('.melch-adm-card');

  card.innerHTML = `
    <div style="padding:16px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border,#e8eaf6)">
      <div style="width:40px;height:40px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;font:700 0.82rem var(--font-ui,sans-serif);color:#fff">${_e(initials)}</div>
      <div style="flex:1;min-width:0">
        <div style="font:700 1rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">${_e(dname)}</div>
        <div style="font:400 0.78rem/1 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.role ? _e(m.role) : ''}${email ? (m.role ? ' · ' : '') + _e(email) : ''}</div>
      </div>
      <button data-act="close-adm-modal" style="background:none;border:none;cursor:pointer;font-size:1.2rem;line-height:1;color:var(--ink-muted,#7a7f96);padding:4px 6px;border-radius:6px;flex-shrink:0" aria-label="Close">✕</button>
    </div>
    <div style="padding:14px 18px;display:flex;flex-direction:column;gap:0;border-bottom:1px solid var(--border,#e8eaf6)">
      ${_amRow('Checkr',        _statusBadge(check.status))}
      ${_amRow('Live Scan',     _liveScanBadge(check.liveScan))}
      ${_amRow('Annual Waiver', _statusPill(ws.label, ws.color))}
      ${_amRow('OCAP Cert',     _statusPill(os.label, os.color))}
      ${_amRow('Hours',         _statusPill(hs.label, hs.color))}
      ${_amRow('SAN',           san)}
      ${_amRow('Parent Notif',  pn)}
    </div>
    <div style="padding:14px 18px;display:flex;flex-wrap:wrap;gap:8px">
      ${showInitiate && email ? `
        <button class="flock-btn flock-btn--primary flock-btn--sm" data-act="modal-initiate-check"
          data-member-id="${_e(uid)}" data-email="${_e(email)}" data-name="${_e(dname)}">
          ${check.status ? 'Re-check' : 'Initiate Check'}
        </button>` : ''}
      <button class="flock-btn flock-btn--ghost flock-btn--sm" data-act="modal-record-livescan">
        ${check.liveScan ? 'Update LS' : '+ Live Scan'}
      </button>
      ${(showPNtf || check.status === 'consider') ? `
        <button class="flock-btn flock-btn--sm" data-act="modal-parent-notif"
          style="background:${check.parentNotif?.sent ? '#dcfce7' : '#fff7ed'};color:${check.parentNotif?.sent ? '#059669' : '#92400e'};border:1px solid ${check.parentNotif?.sent ? '#bbf7d0' : '#fde68a'}">
          ${check.parentNotif?.sent ? '✓ Notified ' + _fmtDate(check.parentNotif.sentDate) : '§ Document Notification'}
        </button>` : ''}
      ${invUrl ? `
        <a href="${_e(invUrl)}" target="_blank" rel="noopener noreferrer"
          class="flock-btn flock-btn--sm" style="text-decoration:none">View Report ↗</a>` : ''}
      ${showComp ? `
        <button class="flock-btn flock-btn--ghost flock-btn--sm" data-act="modal-edit-compliance">Edit Compliance</button>
        <button class="flock-btn flock-btn--ghost flock-btn--sm" data-act="modal-generate-waiver"
          style="color:#059669;border-color:#bbf7d0">Waiver ↓</button>` : ''}
    </div>`;

  card.querySelector('[data-act="close-adm-modal"]').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  card.querySelector('[data-act="modal-record-livescan"]')?.addEventListener('click', () => {
    modal.style.display = 'none';
    _showLiveScanModal(uid, dname);
  });
  card.querySelector('[data-act="modal-parent-notif"]')?.addEventListener('click', () => {
    modal.style.display = 'none';
    _showParentNotifModal(uid, dname);
  });
  card.querySelector('[data-act="modal-edit-compliance"]')?.addEventListener('click', () => {
    modal.style.display = 'none';
    _showComplianceModal(uid, dname);
  });
  card.querySelector('[data-act="modal-generate-waiver"]')?.addEventListener('click', () => {
    modal.style.display = 'none';
    window.open(`app.melchizedek/waiver-sign.html?uid=${encodeURIComponent(uid)}`, '_blank');
  });

  const initiateBtn = card.querySelector('[data-act="modal-initiate-check"]');
  if (initiateBtn) {
    initiateBtn.addEventListener('click', async () => {
      const ok = confirm(`Initiate a background check for ${dname}?\n\nCheckr will send an email to ${email} with a secure link to submit their information.`);
      if (!ok) return;
      initiateBtn.disabled = true;
      const orig = initiateBtn.textContent;
      initiateBtn.textContent = 'Sending…';
      try {
        await _initiateCheck({ memberId: uid, email, name: dname });
        initiateBtn.textContent = 'Sent ✓';
        setTimeout(() => { initiateBtn.disabled = false; initiateBtn.textContent = 'Re-check'; }, 3000);
      } catch (err) {
        console.error('[Melchizedek] initiateCheck error', err);
        alert(`Could not initiate check: ${err?.message || String(err)}`);
        initiateBtn.disabled = false;
        initiateBtn.textContent = orig;
      }
    });
  }

  modal.style.display = 'flex';
}

function _amRow(label, value) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--border,#e8eaf6)">
      <span style="font:500 0.8rem/1 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);flex-shrink:0">${label}</span>
      <span style="flex-shrink:0">${value}</span>
    </div>`;
}

/* ── Action wiring ───────────────────────────────────────────────────────── */
function _wireContentActions(root) {
  root.querySelectorAll('[data-act="open-admin-modal"]').forEach(btn => {
    btn.addEventListener('click', () => _openAdminModal(btn));
  });

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

  root.querySelectorAll('[data-act="edit-compliance"]').forEach(btn => {
    btn.addEventListener('click', () => {
      _showComplianceModal(btn.dataset.memberId, btn.dataset.name);
    });
  });

  root.querySelectorAll('[data-act="document-parent-notif"]').forEach(btn => {
    btn.addEventListener('click', () => {
      _showParentNotifModal(btn.dataset.memberId, btn.dataset.name);
    });
  });

  root.querySelectorAll('[data-act="print-compliance"]').forEach(btn => {
    btn.addEventListener('click', () => window.print());
  });

  root.querySelectorAll('[data-act="generate-waiver"]').forEach(btn => {
    btn.addEventListener('click', () =>
      window.open(`app.melchizedek/waiver-sign.html?uid=${encodeURIComponent(btn.dataset.memberId)}`, '_blank'));
  });

  // In-content navigation links (e.g. compliance alert cards)
  root.querySelectorAll('[data-melch-view]').forEach(el => {
    el.addEventListener('click', () => _wireNavTo(el.dataset.melchView));
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

// ═══════════════════════════════════════════════════════════════════════════
// ── COMPLIANCE TRACKING ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// ── Status helpers ─────────────────────────────────────────────────────── //

function _waiverStatus(check) {
  const d = check?.waiverSignedDate;
  if (!d) return { status: 'missing', label: 'Not Signed', color: '#7a7f96' };
  const signed   = new Date(d);
  const expires  = new Date(signed);
  expires.setFullYear(expires.getFullYear() + 1);
  const daysLeft = Math.floor((expires - new Date()) / 86400000);
  if (daysLeft <   0) return { status: 'expired',  label: `Expired`,                          color: '#dc2626' };
  if (daysLeft <= 30) return { status: 'expiring', label: `Expires ${_fmtDate(expires.toISOString())}`, color: '#d97706' };
  return { status: 'current',  label: `Current · Exp ${_fmtDate(expires.toISOString())}`,     color: '#059669' };
}

function _ocapStatus(check) {
  const d = check?.ocapCertDate;
  if (!d) return { status: 'missing', label: 'Not on File', color: '#7a7f96' };
  const cert    = new Date(d);
  const expires = new Date(cert);
  expires.setFullYear(expires.getFullYear() + 2); // 2-year renewal cycle
  const daysLeft = Math.floor((expires - new Date()) / 86400000);
  if (daysLeft <   0) return { status: 'expired',  label: `Cert Expired`,  color: '#dc2626' };
  if (daysLeft <= 60) return { status: 'expiring', label: `Renew Soon`,    color: '#d97706' };
  return { status: 'current',  label: `Current · ${_fmtDate(d)}`,         color: '#059669' };
}

function _hoursStatus(check) {
  const mo = Number(check?.monthlyHours ?? 0);
  const yr = Number(check?.yearlyHours  ?? 0);
  if (mo > 16 || yr > 32) return { status: 'over',    label: `${mo}h/mo · ${yr}h/yr`, color: '#dc2626' };
  if (mo >= 12 || yr >= 26) return { status: 'near',  label: `${mo}h/mo · ${yr}h/yr`, color: '#d97706' };
  if (mo === 0 && yr === 0) return { status: 'unknown', label: '—',                    color: '#7a7f96' };
  return { status: 'ok', label: `${mo}h/mo · ${yr}h/yr`, color: '#059669' };
}

function _memberDisplayName(m) {
  const first = m.firstName || '';
  const last  = m.lastName  || '';
  return m.displayName || m.name || `${first} ${last}`.trim() || '(Unknown)';
}

function _statusPill(label, color) {
  return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font:600 0.76rem/1.4 var(--font-ui,sans-serif);
    background:${color}18;color:${color};white-space:nowrap">${_e(label)}</span>`;
}

// ── Compliance alerts (used in Overview) ──────────────────────────────── //

function _complianceAlerts() {
  const expiring = [], missingOcap = [], overHours = [], notSan = [], needsNotif = [];

  // Only alert on members who have a background check record (tracked volunteers)
  const tracked = _allMembers.filter(m => {
    const uid = m.id || m.memberNumber || m.email || '';
    return !!_checksMap[uid];
  });

  for (const m of tracked) {
    const uid   = m.id || m.memberNumber || m.email || '';
    const check = _checksMap[uid];
    const ws = _waiverStatus(check);
    const os = _ocapStatus(check);
    const hs = _hoursStatus(check);
    if (ws.status === 'expired' || ws.status === 'expiring') expiring.push(_memberDisplayName(m));
    if (os.status === 'expired' || os.status === 'missing') missingOcap.push(_memberDisplayName(m));
    if (hs.status === 'over' || hs.status === 'near')       overHours.push(_memberDisplayName(m));
    if (!check?.sanEnrolled) notSan.push(_memberDisplayName(m));
    if (check?.status === 'consider' && !check?.parentNotif?.sent) needsNotif.push(_memberDisplayName(m));
  }

  const alerts = [];
  if (expiring.length)    alerts.push({ icon: '📋', color: '#d97706', bg: '#fffbeb', text: `<strong>${expiring.length} volunteer${expiring.length > 1 ? 's' : ''}</strong> ha${expiring.length > 1 ? 've' : 's'} an annual waiver expiring or already expired.`, link: 'compliance' });
  if (missingOcap.length) alerts.push({ icon: '📚', color: '#d97706', bg: '#fffbeb', text: `<strong>${missingOcap.length} volunteer${missingOcap.length > 1 ? 's' : ''}</strong> ${missingOcap.length > 1 ? 'are' : 'is'} missing a current OCAP mandated reporter certification.`, link: 'compliance' });
  if (overHours.length)   alerts.push({ icon: '⏱', color: '#dc2626', bg: '#fef2f2', text: `<strong>${overHours.length} volunteer${overHours.length > 1 ? 's' : ''}</strong> ${overHours.length > 1 ? 'are' : 'is'} at or above the volunteer hour threshold — enhanced screening required.`, link: 'compliance' });
  if (needsNotif.length)  alerts.push({ icon: '📬', color: '#dc2626', bg: '#fef2f2', text: `<strong>${needsNotif.length} volunteer${needsNotif.length > 1 ? 's' : ''}</strong> with "Consider" status require documented parent/guardian notification (§11105.3(c)(1)).`, link: 'not-approved' });
  if (notSan.length > 0 && tracked.length > 0) alerts.push({ icon: '🔔', color: '#7a7f96', bg: '#f8f9ff', text: `<strong>${notSan.length} volunteer${notSan.length > 1 ? 's' : ''}</strong> ${notSan.length > 1 ? 'are' : 'is'} not enrolled in DOJ Subsequent Arrest Notification (SAN).`, link: 'compliance' });

  if (!alerts.length) return '';

  return `
    <div style="margin-top:28px">
      <div style="font:600 0.82rem/1 var(--font-ui,sans-serif);text-transform:uppercase;letter-spacing:.07em;
        color:var(--ink-muted,#7a7f96);margin-bottom:12px">Compliance Alerts</div>
      ${alerts.map(a => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;
          background:${a.bg};border-left:4px solid ${a.color};border-radius:8px;margin-bottom:10px;cursor:pointer"
          data-melch-view="${a.link}">
          <span style="font-size:1.1rem;line-height:1.4">${a.icon}</span>
          <span style="font:400 0.88rem/1.5 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">${a.text}
            <span style="color:${a.color};font-weight:600;margin-left:4px">View →</span>
          </span>
        </div>`).join('')}
    </div>`;
}

// ── Compliance view ────────────────────────────────────────────────────── //

function _viewCompliance() {
  const sorted = _sortedMembers(_allMembers);

  // Aggregate stats
  let cntWaiverOk = 0, cntWaiverWarn = 0, cntOcapOk = 0, cntOcapWarn = 0, cntSan = 0;
  for (const m of _allMembers) {
    const uid   = m.id || m.memberNumber || m.email || '';
    const check = _checksMap[uid];
    const ws = _waiverStatus(check);
    const os = _ocapStatus(check);
    if (ws.status === 'current')  cntWaiverOk++;   else cntWaiverWarn++;
    if (os.status === 'current')  cntOcapOk++;     else cntOcapWarn++;
    if (check?.sanEnrolled)       cntSan++;
  }

  const statCard = (label, ok, warn, icon) => `
    <div style="flex:1;min-width:130px;padding:14px 16px;background:var(--surface,#fff);
      border-radius:10px;border:1px solid var(--border,#e8eaf6)">
      <div style="font:600 0.78rem/1 var(--font-ui,sans-serif);text-transform:uppercase;
        letter-spacing:.06em;color:var(--ink-muted,#7a7f96);margin-bottom:8px">${icon} ${label}</div>
      <div style="font:700 1.4rem/1 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">${ok}</div>
      <div style="font:400 0.8rem/1 var(--font-ui,sans-serif);margin-top:4px;
        color:${warn > 0 ? '#d97706' : '#7a7f96'}">${warn} need attention</div>
    </div>`;

  const rows = sorted.map(m => {
    const uid   = m.id || m.memberNumber || m.email || '';
    const dname = _memberDisplayName(m);
    const check = _checksMap[uid] || {};
    // Quick status dot: red if any critical issue, amber if any warning, green if all clear
    const ws = _waiverStatus(check);
    const os = _ocapStatus(check);
    const hs = _hoursStatus(check);
    const hasCritical = [ws, os].some(s => s.status === 'expired' || s.status === 'missing') ||
                        hs.status === 'over' || check.status === 'consider';
    const hasWarn     = [ws, os].some(s => s.status === 'expiring') || hs.status === 'near';
    const dotColor    = hasCritical ? '#dc2626' : hasWarn ? '#d97706' : '#059669';
    return `<tr class="mcvt-row" style="border-bottom:1px solid var(--border,#e8eaf6)">
      <td class="mcvt-cell" data-label="Member" style="padding:10px 14px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0" title="${hasCritical ? 'Needs attention' : hasWarn ? 'Expiring soon' : 'All clear'}"></span>
          <div>
            <div style="font:600 0.9rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">${_e(dname)}</div>
            ${m.role ? `<div style="font:400 0.76rem/1 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-top:2px">${_e(m.role)}</div>` : ''}
          </div>
        </div>
      </td>
      <td class="mcvt-cell" data-label="Admin" style="padding:8px 14px;text-align:right;width:1%">
        <button class="flock-btn flock-btn--ghost flock-btn--sm" data-act="open-admin-modal"
          data-member-id="${_e(uid)}" data-name="${_e(dname)}"
          data-show-compliance="1" style="font-weight:600;white-space:nowrap">Admin</button>
      </td>
    </tr>`;
  }).join('');

  return `
    <div id="melch-cc">
    <style>
    #melch-cc .mcv-stats{display:flex;flex-wrap:wrap;gap:12px}
    #melch-cc .mcvt-wrap{overflow-x:auto;border-radius:10px;border:1px solid var(--border,#e8eaf6)}
    @media(max-width:640px){
      #melch-cc .mcv-hdr{flex-direction:column!important;align-items:flex-start!important}
      #melch-cc .mcv-stats{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}
      #melch-cc .mcvt-wrap{border:none!important;border-radius:0!important}
      #melch-cc .mcvt-head{display:none!important}
      #melch-cc .mcvt-row{display:flex!important;align-items:center!important;justify-content:space-between!important;background:var(--surface,#fff);border:1px solid var(--border,#e8eaf6)!important;border-radius:10px;margin-bottom:8px;padding:2px 0;gap:8px}
      #melch-cc .mcvt-cell[data-label="Member"]{flex:1;min-width:0;padding:10px 12px!important}
      #melch-cc .mcvt-cell[data-label="Admin"]{padding:8px 12px!important;flex-shrink:0}
    }
    @media(max-width:380px){
      #melch-cc .mcv-stats{grid-template-columns:1fr!important}
    }
    </style>
    <div class="mcv-hdr" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <div style="font:700 1.2rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:4px">Compliance Tracker</div>
        <div style="font:400 0.85rem/1.5 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96)">
          Annual waivers · OCAP certifications · Hour thresholds · DOJ SAN enrollment · Parent notification records
        </div>
      </div>
      <button class="flock-btn flock-btn--ghost flock-btn--sm" data-act="print-compliance"
        style="display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Print Report
      </button>
    </div>

    <div class="mcv-stats" style="margin-bottom:24px">
      ${statCard('Annual Waivers', cntWaiverOk, cntWaiverWarn, '📋')}
      ${statCard('OCAP Certs', cntOcapOk, cntOcapWarn, '📚')}
      <div style="flex:1;min-width:130px;padding:14px 16px;background:var(--surface,#fff);
        border-radius:10px;border:1px solid var(--border,#e8eaf6)">
        <div style="font:600 0.78rem/1 var(--font-ui,sans-serif);text-transform:uppercase;
          letter-spacing:.06em;color:var(--ink-muted,#7a7f96);margin-bottom:8px">🔔 DOJ SAN</div>
        <div style="font:700 1.4rem/1 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">${cntSan}</div>
        <div style="font:400 0.8rem/1 var(--font-ui,sans-serif);margin-top:4px;
          color:${(_allMembers.length - cntSan) > 0 ? '#d97706' : '#7a7f96'}">${_allMembers.length - cntSan} not enrolled</div>
      </div>
    </div>

    ${_sortBar()}

    <div class="mcvt-wrap" style="overflow-x:auto;border-radius:10px;border:1px solid var(--border,#e8eaf6)">
      <table style="width:100%;border-collapse:collapse;font:400 0.85rem/1.4 var(--font-ui,sans-serif)">
        <thead class="mcvt-head">
          <tr style="background:var(--surface,#f8f9ff)">
            <th style="padding:10px 14px;text-align:left;font:600 0.78rem/1 var(--font-ui,sans-serif);
              text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted,#7a7f96)">Member</th>
            <th style="padding:10px 14px;text-align:right;font:600 0.78rem/1 var(--font-ui,sans-serif);
              text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted,#7a7f96);width:1%"></th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="2" style="padding:20px;text-align:center;color:var(--ink-muted,#7a7f96)">No members loaded.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div style="margin-top:14px;font:400 0.78rem/1.5 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96)">
      Hour thresholds: ≥12 hrs/month or ≥26 hrs/year = near threshold (enhanced screening advised);
      >16 hrs/month or >32 hrs/year = over threshold (required).
      Annual waiver expires 1 year from signing (BPC §18975). OCAP cert renewal: 2-year cycle.
    </div>
    </div>`;
}

// ── Compliance edit modal ──────────────────────────────────────────────── //

function _showComplianceModal(memberId, name) {
  const check = _checksMap[memberId] || {};

  document.getElementById('melch-compliance-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'melch-compliance-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:20px';

  const fieldLabel = (text) =>
    `<div style="font:600 0.78rem var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-bottom:4px">${text}</div>`;
  const inputStyle = 'width:100%;padding:8px 10px;border:1px solid var(--line,#e5e7ef);border-radius:7px;font:0.88rem var(--font-ui,sans-serif);background:var(--bg,#fff);color:var(--ink,#1b264f);box-sizing:border-box';
  const fieldWrap  = 'margin-bottom:16px';

  modal.innerHTML = `
    <div style="background:var(--bg-raised,#fff);border-radius:14px;padding:28px 24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 48px rgba(0,0,0,.22)">
      <div style="font:700 1rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:4px">Compliance Record</div>
      <div style="font:400 0.82rem/1.5 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-bottom:20px">${_e(name)}</div>

      <label style="display:block;${fieldWrap}">
        ${fieldLabel('Annual Waiver Signed Date — BPC §18975(b)(2)(C)')}
        <input type="date" id="mc-waiver-date" style="${inputStyle}" value="${_isoDate(check.waiverSignedDate) || ''}">
        <div id="mc-waiver-status" style="margin-top:4px;font:400 0.8rem/1 var(--font-ui,sans-serif)"></div>
      </label>

      <label style="display:block;${fieldWrap}">
        ${fieldLabel('OCAP Mandated Reporter Cert Date')}
        <input type="date" id="mc-ocap-date" style="${inputStyle}" value="${_isoDate(check.ocapCertDate) || ''}">
        <div id="mc-ocap-status" style="margin-top:4px;font:400 0.8rem/1 var(--font-ui,sans-serif)"></div>
      </label>

      <div style="display:flex;gap:14px;${fieldWrap}">
        <label style="flex:1;display:block">
          ${fieldLabel('Monthly Hours (this month)')}
          <input type="number" id="mc-monthly-hours" min="0" max="744" placeholder="0"
            style="${inputStyle}" value="${check.monthlyHours ?? ''}">
        </label>
        <label style="flex:1;display:block">
          ${fieldLabel('Yearly Hours (this year)')}
          <input type="number" id="mc-yearly-hours" min="0" max="8784" placeholder="0"
            style="${inputStyle}" value="${check.yearlyHours ?? ''}">
        </label>
      </div>

      <div style="${fieldWrap}">
        ${fieldLabel('DOJ Subsequent Arrest Notification (SAN)')}
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="mc-san-enrolled" style="width:16px;height:16px"
            ${check.sanEnrolled ? 'checked' : ''}>
          <span style="font:400 0.88rem/1 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">Enrolled in DOJ SAN</span>
        </label>
        <div id="mc-san-date-row" style="margin-top:10px;display:${check.sanEnrolled ? 'block' : 'none'}">
          ${fieldLabel('SAN Enrollment Date')}
          <input type="date" id="mc-san-date" style="${inputStyle}" value="${_isoDate(check.sanEnrolledDate) || ''}">
        </div>
      </div>

      <label style="display:block;${fieldWrap}">
        ${fieldLabel('Compliance Notes')}
        <textarea id="mc-notes" rows="3" placeholder="Internal notes…"
          style="${inputStyle};resize:vertical">${_e(check.complianceNotes || '')}</textarea>
      </label>

      <div id="mc-error" style="display:none;padding:10px;background:#fef2f2;border-radius:6px;
        font:400 0.85rem/1.5 var(--font-ui,sans-serif);color:#dc2626;margin-bottom:14px"></div>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="mc-cancel" class="flock-btn flock-btn--ghost flock-btn--sm">Cancel</button>
        <button id="mc-save"   class="flock-btn flock-btn--primary flock-btn--sm">Save Record</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const waiverIn = modal.querySelector('#mc-waiver-date');
  const ocapIn   = modal.querySelector('#mc-ocap-date');
  const sanCb    = modal.querySelector('#mc-san-enrolled');
  const sanRow   = modal.querySelector('#mc-san-date-row');

  const updateWaiverStatus = () => {
    const el = modal.querySelector('#mc-waiver-status');
    const ws = _waiverStatus({ waiverSignedDate: waiverIn.value });
    el.textContent = ws.label; el.style.color = ws.color;
  };
  const updateOcapStatus = () => {
    const el = modal.querySelector('#mc-ocap-status');
    const os = _ocapStatus({ ocapCertDate: ocapIn.value });
    el.textContent = os.label; el.style.color = os.color;
  };
  waiverIn.addEventListener('change', updateWaiverStatus);
  ocapIn.addEventListener('change', updateOcapStatus);
  updateWaiverStatus(); updateOcapStatus();

  sanCb.addEventListener('change', () => { sanRow.style.display = sanCb.checked ? 'block' : 'none'; });

  modal.querySelector('#mc-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#mc-save').addEventListener('click', async () => {
    const btn = modal.querySelector('#mc-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await _saveComplianceFields({
        memberId, name,
        waiverDate:     waiverIn.value   || null,
        ocapDate:       ocapIn.value     || null,
        monthlyHours:   Number(modal.querySelector('#mc-monthly-hours').value) || 0,
        yearlyHours:    Number(modal.querySelector('#mc-yearly-hours').value)  || 0,
        sanEnrolled:    sanCb.checked,
        sanEnrolledDate: sanCb.checked ? (modal.querySelector('#mc-san-date').value || null) : null,
        notes:          modal.querySelector('#mc-notes').value.trim() || null,
      });
      modal.remove();
    } catch (err) {
      const errEl = modal.querySelector('#mc-error');
      errEl.textContent = err.message; errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Save Record';
    }
  });
}

async function _saveComplianceFields({ memberId, name, waiverDate, ocapDate, monthlyHours, yearlyHours, sanEnrolled, sanEnrolledDate, notes }) {
  const db = window.firebase?.firestore?.();
  if (!db) throw new Error('Firestore not available.');
  const payload = {
    memberId,
    name,
    updatedAt: new Date().toISOString(),
    ...(waiverDate      != null ? { waiverSignedDate: waiverDate }    : {}),
    ...(ocapDate        != null ? { ocapCertDate: ocapDate }          : {}),
    ...(monthlyHours    != null ? { monthlyHours }                    : {}),
    ...(yearlyHours     != null ? { yearlyHours }                     : {}),
    ...(sanEnrolled     != null ? { sanEnrolled }                     : {}),
    ...(sanEnrolledDate != null ? { sanEnrolledDate }                 : {}),
    ...(notes           != null ? { complianceNotes: notes }          : {}),
  };
  await db.collection(BG_COLLECTION).doc(memberId).set(payload, { merge: true });
  // Optimistic local update
  _checksMap[memberId] = { ...(_checksMap[memberId] || {}), ...payload };
  _renderView(_currentView);
}

// ── Parent notification modal (§11105.3(c)(1)) ────────────────────────── //

function _showParentNotifModal(memberId, name) {
  const check = _checksMap[memberId] || {};
  const pn    = check.parentNotif   || {};

  document.getElementById('melch-parentnotif-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'melch-parentnotif-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:20px';

  const inputStyle = 'width:100%;padding:8px 10px;border:1px solid var(--line,#e5e7ef);border-radius:7px;font:0.88rem var(--font-ui,sans-serif);background:var(--bg,#fff);color:var(--ink,#1b264f);box-sizing:border-box';
  const fieldLabel = (text) =>
    `<div style="font:600 0.78rem var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-bottom:4px">${text}</div>`;

  modal.innerHTML = `
    <div style="background:var(--bg-raised,#fff);border-radius:14px;padding:28px 24px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 48px rgba(0,0,0,.22)">
      <div style="font:700 1rem/1.2 var(--font-ui,sans-serif);color:var(--ink,#1b264f);margin-bottom:4px">Parent / Guardian Notification</div>
      <div style="font:400 0.82rem/1.5 var(--font-ui,sans-serif);color:var(--ink-muted,#7a7f96);margin-bottom:16px">${_e(name)}</div>

      <div style="padding:12px 14px;background:#fff7ed;border-radius:8px;border-left:4px solid #d97706;
        margin-bottom:20px;font:400 0.82rem/1.5 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">
        <strong>Pen. Code §11105.3(c)(1)</strong> — If this individual will supervise minors, affected
        parents/guardians must receive written notification at least
        <strong>10 days before they begin duties</strong>.
      </div>

      <label style="display:block;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="pn-sent" style="width:16px;height:16px"
            ${pn.sent ? 'checked' : ''}>
          <span style="font:600 0.88rem/1 var(--font-ui,sans-serif);color:var(--ink,#1b264f)">Written notification was sent</span>
        </div>
      </label>

      <div id="pn-details-row" style="display:${pn.sent ? 'block' : 'none'}">
        <label style="display:block;margin-bottom:14px">
          ${fieldLabel('Date Sent')}
          <input type="date" id="pn-sent-date" style="${inputStyle}" value="${_isoDate(pn.sentDate) || ''}">
        </label>

        <label style="display:block;margin-bottom:14px">
          ${fieldLabel('Method')}
          <select id="pn-method" style="${inputStyle}">
            <option value="">— select —</option>
            <option value="written-mail"  ${pn.method === 'written-mail'  ? 'selected' : ''}>Written letter (mail)</option>
            <option value="written-email" ${pn.method === 'written-email' ? 'selected' : ''}>Written letter (email)</option>
            <option value="in-person"     ${pn.method === 'in-person'     ? 'selected' : ''}>In-person delivery</option>
          </select>
        </label>

        <label style="display:block;margin-bottom:14px">
          ${fieldLabel('Date Confirmed / Acknowledged (optional)')}
          <input type="date" id="pn-confirmed-date" style="${inputStyle}" value="${_isoDate(pn.confirmedDate) || ''}">
        </label>
      </div>

      <div id="pn-error" style="display:none;padding:10px;background:#fef2f2;border-radius:6px;
        font:400 0.85rem/1.5 var(--font-ui,sans-serif);color:#dc2626;margin-bottom:14px"></div>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="pn-cancel" class="flock-btn flock-btn--ghost flock-btn--sm">Cancel</button>
        <button id="pn-save"   class="flock-btn flock-btn--primary flock-btn--sm">Save Record</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const sentCb = modal.querySelector('#pn-sent');
  const detRow = modal.querySelector('#pn-details-row');
  sentCb.addEventListener('change', () => { detRow.style.display = sentCb.checked ? 'block' : 'none'; });

  modal.querySelector('#pn-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#pn-save').addEventListener('click', async () => {
    const btn = modal.querySelector('#pn-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await _saveParentNotif({
        memberId,
        sent:          sentCb.checked,
        sentDate:      modal.querySelector('#pn-sent-date').value      || null,
        method:        modal.querySelector('#pn-method').value         || null,
        confirmedDate: modal.querySelector('#pn-confirmed-date').value || null,
      });
      modal.remove();
    } catch (err) {
      const errEl = modal.querySelector('#pn-error');
      errEl.textContent = err.message; errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Save Record';
    }
  });
}

/* ── Generate AB-506 Annual Waiver Form ─────────────────────────────────── */
function _generateWaiver(memberId, displayName) {
  const check  = _checksMap[memberId] || {};
  const member = _allMembers.find(m => (m.id || m.memberNumber || m.email || '') === memberId) || {};
  const org    = _orgName || '[Organization Name]';
  const today  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const dob    = check.dateOfBirth || member.dateOfBirth || member.dob || '';
  const dobLine = dob ? `<strong>Date of Birth:</strong> ${_e(dob)}<br>` : '';
  const memberNo = member.memberNumber || member.id || '';
  const memberNoLine = memberNo ? `<strong>Member ID:</strong> ${_e(memberNo)}<br>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AB-506 Annual Waiver — ${_e(displayName)}</title>
  <style>
    @page { size: letter; margin: 0.85in 1in; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 24px 32px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #111;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .org-name {
      font-size: 16pt;
      font-weight: bold;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .doc-title {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 6px;
    }
    .doc-subtitle {
      font-size: 10pt;
      color: #444;
      margin-top: 2px;
    }
    .section {
      margin-bottom: 18px;
    }
    .section-title {
      font-weight: bold;
      font-size: 11pt;
      text-transform: uppercase;
      letter-spacing: .05em;
      border-bottom: 1px solid #aaa;
      margin-bottom: 8px;
      padding-bottom: 3px;
    }
    .member-info {
      background: #f8f8f8;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 12px 16px;
      margin-bottom: 18px;
      font-size: 11pt;
      line-height: 1.8;
    }
    .indent {
      margin-left: 24px;
    }
    .sign-block {
      margin-top: 10px;
    }
    .sign-line {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      margin-bottom: 12px;
    }
    .sign-label {
      flex-shrink: 0;
      min-width: 160px;
      font-size: 10pt;
    }
    .sign-rule {
      flex: 1;
      border-bottom: 1px solid #111;
      margin-bottom: 2px;
    }
    .admin-box {
      border: 1px solid #aaa;
      border-radius: 4px;
      padding: 12px 16px;
      margin-top: 6px;
      background: #fcfcfc;
    }
    .admin-row {
      display: flex;
      gap: 24px;
      margin-bottom: 10px;
    }
    .admin-field {
      flex: 1;
      border-bottom: 1px solid #aaa;
      min-height: 22px;
    }
    .admin-label {
      font-size: 9pt;
      color: #555;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .statutory {
      font-size: 9.5pt;
      color: #333;
      background: #f4f4f4;
      border-left: 3px solid #aaa;
      padding: 8px 12px;
      margin: 10px 0;
      line-height: 1.6;
    }
    .footer {
      margin-top: 30px;
      font-size: 8.5pt;
      color: #666;
      text-align: center;
      border-top: 1px solid #ccc;
      padding-top: 8px;
    }
    @media print {
      body { font-size: 10.5pt; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- PRINT BUTTON (hidden when printing) -->
  <div class="no-print" style="text-align:right;margin-bottom:14px">
    <button onclick="window.print()" style="padding:8px 20px;font:bold 11pt sans-serif;background:#1b264f;color:#fff;border:none;border-radius:6px;cursor:pointer">Save as PDF / Print</button>
  </div>

<div class="page">

  <div class="header">
    <div class="org-name">${_e(org)}</div>
    <div class="doc-title">Annual Authorization for Background Check</div>
    <div class="doc-subtitle">Pursuant to California Business &amp; Professions Code §18975 (AB 506)</div>
  </div>

  <!-- MEMBER INFO -->
  <div class="member-info">
    <strong>Member Name:</strong> ${_e(displayName)}<br>
    ${dobLine}
    ${memberNoLine}
    <strong>Date of Form:</strong> ${_e(today)}
  </div>

  <!-- SECTION 1 — CONSENT -->
  <div class="section">
    <div class="section-title">1. Consent &amp; Authorization</div>
    <p>
      I, <strong>${_e(displayName)}</strong>, hereby voluntarily authorize <strong>${_e(org)}</strong>
      (the &ldquo;Organization&rdquo;) and its authorized agents to obtain a background investigation
      report concerning me from one or more consumer reporting agencies, law enforcement databases,
      the California Department of Justice (DOJ), and/or other authorized sources.
    </p>
    <p>
      I understand that this authorization is required under California AB 506 (Business &amp; Professions
      Code §18975) for any person who has direct contact with minors in a youth-serving organization
      and who is not required to obtain a criminal background check under any other law.
    </p>
    <p>
      I understand that this authorization is valid for one (1) year from the date signed, and that
      I may be asked to re-authorize annually in accordance with the Organization&rsquo;s child
      safety policy.
    </p>
  </div>

  <!-- SECTION 2 — STATUTORY DISCLOSURE -->
  <div class="section">
    <div class="section-title">2. Statutory Disclosure (BPC §18975)</div>
    <div class="statutory">
      California Business &amp; Professions Code §18975 requires youth-serving organizations to
      obtain criminal background checks on employees and volunteers who have direct contact with
      minors. A &ldquo;youth-serving organization&rdquo; means any organization that provides
      services to, is organized for, or has as one of its primary purposes the provision of
      programs or activities for persons under 18 years of age. The required check includes
      a search of DOJ records and, where applicable, an FBI check. A disqualifying offense may
      result in the individual being prohibited from having direct contact with minors.
    </div>
    <p class="indent">
      I understand and acknowledge the above disclosure and consent to the background check
      described herein.
    </p>
  </div>

  <!-- SECTION 3 — DOJ SAN ENROLLMENT -->
  <div class="section">
    <div class="section-title">3. DOJ Subsequent Arrest Notification (SAN) Enrollment</div>
    <p>
      I acknowledge that the Organization may elect to enroll me in the California Department of
      Justice Subsequent Arrest Notification (SAN) program, which provides ongoing notifications
      to the Organization if I am arrested for a qualifying offense after my initial background
      check is complete. By signing this form, I consent to such enrollment for the duration of
      my service with the Organization.
    </p>
  </div>

  <!-- SECTION 4 — CHILD SAFETY POLICY ACKNOWLEDGMENT -->
  <div class="section">
    <div class="section-title">4. Child Safety Policy Acknowledgment</div>
    <p>
      I confirm that I have received, read, and agree to comply with the Organization&rsquo;s
      Child Safety Policy (the &ldquo;Policy&rdquo;). I understand that any violation of the
      Policy may result in immediate removal from ministry and, where applicable, reporting to
      law enforcement.
    </p>
  </div>

  <!-- SECTION 5 — ANNUAL RENEWAL -->
  <div class="section">
    <div class="section-title">5. Annual Renewal</div>
    <p>
      I understand that this authorization expires one (1) year from the date of my signature
      below and that continued service in a role that involves direct contact with minors requires
      annual renewal. I agree to re-sign this form each program year upon request.
    </p>
  </div>

  <!-- SIGNATURE -->
  <div class="section">
    <div class="section-title">6. Signature</div>
    ${check.waiverSignature ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:14px 16px;margin-top:8px">
      <div style="font-size:8.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:#059669;margin-bottom:8px">✅ Electronically Signed</div>
      <img src="${check.waiverSignature}" style="max-height:64px;max-width:280px;display:block;margin:4px 0">
      <div style="font-size:9.5pt;margin-top:6px"><strong>Printed Name:</strong> ${_e(check.waiverSignedName || displayName)}</div>
      <div style="font-size:9.5pt"><strong>Date:</strong> ${_e(check.waiverSignedDate ? new Date(check.waiverSignedDate?.toDate?.() || check.waiverSignedDate).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : today)}</div>
      <div style="font-size:8pt;color:#555;margin-top:6px">This electronic signature was captured via the Melchizedek compliance system and is stored securely in the Organization's database.</div>
    </div>` : `
    <div class="sign-block">
      <div class="sign-line">
        <span class="sign-label">Volunteer/Staff Signature:</span>
        <span class="sign-rule"></span>
      </div>
      <div class="sign-line">
        <span class="sign-label">Printed Name:</span>
        <span class="sign-rule"></span>
      </div>
      <div class="sign-line">
        <span class="sign-label">Date:</span>
        <span class="sign-rule"></span>
      </div>
      <div class="sign-line">
        <span class="sign-label">Witness Signature:</span>
        <span class="sign-rule"></span>
      </div>
      <div class="sign-line">
        <span class="sign-label">Witness Printed Name:</span>
        <span class="sign-rule"></span>
      </div>
      <div class="sign-line">
        <span class="sign-label">Witness Date:</span>
        <span class="sign-rule"></span>
      </div>
    </div>`}
  </div>

  <!-- ADMIN USE ONLY -->
  <div class="section">
    <div class="section-title">For Office Use Only</div>
    <div class="admin-box">
      <div class="admin-row">
        <div>
          <div class="admin-field"></div>
          <div class="admin-label">Background Check Submitted Date</div>
        </div>
        <div>
          <div class="admin-field"></div>
          <div class="admin-label">Result Received Date</div>
        </div>
        <div>
          <div class="admin-field"></div>
          <div class="admin-label">Result (Clear / Pending / Disqualified)</div>
        </div>
      </div>
      <div class="admin-row">
        <div>
          <div class="admin-field"></div>
          <div class="admin-label">SAN Enrolled (Y/N) &amp; Date</div>
        </div>
        <div>
          <div class="admin-field"></div>
          <div class="admin-label">Reviewed By (Staff Initials)</div>
        </div>
        <div>
          <div class="admin-field"></div>
          <div class="admin-label">Next Renewal Due</div>
        </div>
      </div>
      <div class="admin-row">
        <div style="flex:1">
          <div class="admin-field"></div>
          <div class="admin-label">Notes</div>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    ${_e(org)} &nbsp;|&nbsp; AB-506 Annual Authorization Form &nbsp;|&nbsp; Generated ${_e(today)}
    &nbsp;|&nbsp; Retain in personnel/volunteer file for a minimum of 7 years.
  </div>

</div>

<script>
  // Auto-open Save as PDF dialog after page renders
  window.addEventListener('load', () => {
    setTimeout(() => window.print(), 400);
  });
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (!win) {
    // Fallback: download the HTML file if popup truly blocked
    const a = document.createElement('a');
    const safeName = (displayName || 'Member').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
    a.href = url; a.download = `AB506-Waiver-${safeName}-${new Date().getFullYear()}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function _saveParentNotif({ memberId, sent, sentDate, method, confirmedDate }) {
  const db = window.firebase?.firestore?.();
  if (!db) throw new Error('Firestore not available.');
  const payload = {
    memberId,
    updatedAt: new Date().toISOString(),
    parentNotif: { sent: !!sent, sentDate: sentDate || null, method: method || null, confirmedDate: confirmedDate || null },
  };
  await db.collection(BG_COLLECTION).doc(memberId).set(payload, { merge: true });
  _checksMap[memberId] = { ...(_checksMap[memberId] || {}), ...payload };
  _renderView(_currentView);
}
