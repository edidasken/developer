/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: Bezalel — Deployment Docs & Build Tools
   "I have called by name Bezalel… and filled him with the Spirit of God. — Exodus 31:2-3"

   Tabs:
     • GAS Files    — fetches & displays B/C/D/E deployment docs with copy-to-clipboard
     • Church Setup — per-church DEPLOY_CONFIG generator (no secrets)
     • Deployments  — live church deployment status list

   Role gate: pastor+ (roleLevel ≥ 4)
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';

export const name  = 'bezalel';
export const title = 'Bezalel';

const _e = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ── Role constants ────────────────────────────────────────────────────────── */
const ROLE_LEVELS = { readonly:0, volunteer:1, care:2, deacon:2, leader:3, treasurer:3, pastor:4, admin:5 };

function _roleLevel(role) {
  return ROLE_LEVELS[String(role || '').toLowerCase()] ?? -1;
}

function _isPastorPlus() {
  try {
    const N = window.Nehemiah;
    if (!N) return false;
    const sess = typeof N.getSession === 'function' ? N.getSession() : null;
    if (!sess) return false;
    return _roleLevel(sess.role) >= 4;
  } catch (_) { return false; }
}

/* ── GAS deployment doc definitions ────────────────────────────────────────── */
const GAS_DOCS = [
  {
    id: 'code',
    label: 'Code.gs',
    filename: 'B-Master Code.md',
    path: new URL('../../Architechtural Docs/B-Master Code.md', import.meta.url).href,
    description: 'Main GAS backend — paste as Code.gs. Contains all CRUD handlers, dispatcher, camelCase normalization, setupFlockOS(), and DEPLOY_CONFIG.',
  },
];

/* ── Church deployment definitions ────────────────────────────────────────── */
const CHURCHES = [
  {
    id: 'root',
    name: 'FlockOS Root',
    url: 'flockos.app',
    firebaseProject: 'flockos-notify',
    timezone: 'America/New_York',
    status: 'live',
    version: '2.0.0',
    gasUrl: 'https://script.google.com/macros/s/…ROOT…/exec',
  },
  {
    id: 'gas',
    name: 'GAS',
    url: 'gas.flockos.app',
    firebaseProject: null,          // GAS-only — no Firestore project
    timezone: 'America/New_York',
    status: 'live',
    version: '2.0.0',
    gasUrl: 'https://script.google.com/macros/s/…GAS…/exec',
  },
  {
    id: 'tbc',
    name: 'Trinity Bible Church',
    url: 'tbc.flockos.app',
    firebaseProject: 'flockos-trinity',
    timezone: 'America/New_York',
    status: 'live',
    version: '2.0.0',
    gasUrl: 'https://script.google.com/macros/s/…TBC…/exec',
  },
  {
    id: 'theforest',
    name: 'The Forest',
    url: 'theforest.flockos.app',
    firebaseProject: 'flockos-theforest',
    timezone: 'America/Chicago',
    status: 'live',
    version: '2.0.0',
    gasUrl: 'https://script.google.com/macros/s/…FOREST…/exec',
  },
  {
    id: 'comms',
    name: 'FlockChat (Comms)',
    url: 'comms.flockos.app',
    firebaseProject: 'flockos-comms',
    timezone: 'America/New_York',
    status: 'live',
    version: '1.4.2',
    gasUrl: 'https://script.google.com/macros/s/…COMMS…/exec',
  },
];


/* ── Render ───────────────────────────────────────────────────────────────── */
export function render() {
  return `<section class="bz-view" id="bz-root"></section>`;
}

/* ── Mount ────────────────────────────────────────────────────────────────── */
export function mount(root) {
  _render(root);
  return () => {};
}

/* ── Internal renderer ────────────────────────────────────────────────────── */
function _render(root, tab) {
  const activeTab = (tab === 'gas-files' ? 'church-setup' : tab) || 'church-setup';

  if (!_isPastorPlus()) {
    root.innerHTML = `
      ${pageHero({ title: 'Bezalel', subtitle: 'Build & deployment tools.', scripture: 'I have called by name Bezalel… and filled him with the Spirit of God. — Exodus 31:2-3' })}
      <div class="life-empty" style="padding:20px;text-align:center;color:var(--ink-muted);">
        <div style="font-size:2.5rem;margin-bottom:12px;">🔒</div>
        <p style="font-size:0.95rem;font-weight:600;">Pastor+ access required.</p>
        <p style="font-size:0.82rem;margin-top:6px;">This area is reserved for pastors and administrators.</p>
      </div>`;
    return;
  }

  const tabs = [
    { id: 'church-setup', label: '⚙ Church Setup'  },
    { id: 'deployments',  label: '🚀 Deployments'  },
  ];

  const tabBar = `<div class="bz-tabbar" style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 18px;">
    ${tabs.map(t => `<button class="bz-tab${activeTab === t.id ? ' bz-tab--active' : ''}" data-tab="${_e(t.id)}"
      style="${activeTab === t.id
        ? 'background:var(--accent);color:var(--ink-inverse);font-weight:700;border:none;'
        : 'background:none;color:var(--ink);border:1px solid var(--line);'}
      border-radius:6px;padding:7px 14px;cursor:pointer;font-size:0.82rem;font-family:inherit;white-space:nowrap;"
    >${_e(t.label)}</button>`).join('')}
  </div>`;

  let body = '';
  if (activeTab === 'church-setup') body = _churchSetupTab();
  else if (activeTab === 'deployments')  body = _deploymentsTab();

  root.innerHTML = `
    ${pageHero({ title: 'Bezalel', subtitle: 'Build, deploy, and manage the FlockOS church network.', scripture: 'I have called by name Bezalel… and filled him with the Spirit of God. — Exodus 31:2-3' })}
    ${tabBar}
    <div id="bz-tab-body">${body}</div>`;

  /* Wire tab buttons */
  root.querySelectorAll('.bz-tab').forEach(btn => {
    btn.addEventListener('click', () => _render(root, btn.dataset.tab));
  });

  /* Wire church setup generator + embedded GAS Files fetch buttons */
  if (activeTab === 'church-setup') {
    _wireChurchSetup(root);
    root.querySelectorAll('.bz-fetch-btn').forEach(btn => {
      btn.addEventListener('click', () => _fetchAndShow(root, btn.dataset.docId));
    });
  }

  /* Wire index copy buttons */
  if (activeTab === 'deployments') {
    _wireDeployments(root);
  }
}

/* ── GAS Files tab ────────────────────────────────────────────────────────── */
function _gasFilesTab() {
  return `
<div style="display:grid;gap:14px;">
  ${GAS_DOCS.map(doc => `
  <div class="bz-card" style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;padding:16px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
      <div>
        <div style="font-size:1rem;font-weight:700;color:var(--ink);">${_e(doc.label)}</div>
        <div style="font-size:0.76rem;color:var(--ink-muted);margin-top:3px;">${_e(doc.filename)}</div>
      </div>
      <button class="bz-fetch-btn btn btn-primary" data-doc-id="${_e(doc.id)}" style="font-size:0.8rem;padding:7px 14px;white-space:nowrap;">
        📋 Load &amp; Copy
      </button>
    </div>
    <p style="font-size:0.82rem;color:var(--ink-muted);line-height:1.55;margin:0 0 10px;">${_e(doc.description)}</p>
    <div id="bz-doc-${_e(doc.id)}" style="display:none;">
      <pre id="bz-pre-${_e(doc.id)}" style="background:var(--bg-sunken);border:1px solid var(--line);border-radius:8px;
        padding:14px;font-size:0.76rem;line-height:1.55;overflow-x:auto;white-space:pre-wrap;word-break:break-word;
        max-height:420px;overflow-y:auto;color:var(--ink);font-family:monospace;"></pre>
    </div>
  </div>`).join('')}
</div>
<div style="margin-top:16px;padding:12px 14px;background:rgba(232,168,56,0.08);border:1px solid rgba(232,168,56,0.25);border-radius:8px;font-size:0.8rem;color:var(--ink-muted);line-height:1.5;">
  <strong style="color:var(--ink);">How to deploy a new church:</strong>
  Open the church's Google Sheet → Extensions → Apps Script → paste <strong>Code.gs</strong> →
  Set Script Properties via Church Setup tab (FIREBASE_SERVICE_ACCOUNT, TRUTH_SERVICE_ACCOUNT required) →
  Run <code style="background:rgba(0,0,0,0.1);padding:1px 5px;border-radius:3px;font-family:monospace;">setupFlockOS()</code> once. FirestoreSync, SyncHandler, and camelCase normalization are all included in Code.gs.
</div>`;
}

/* Fetch a doc file and show/copy it */
async function _fetchAndShow(root, docId) {
  const doc = GAS_DOCS.find(d => d.id === docId);
  if (!doc) return;

  const btn = root.querySelector(`.bz-fetch-btn[data-doc-id="${docId}"]`);
  const pre = root.querySelector(`#bz-pre-${docId}`);
  const box = root.querySelector(`#bz-doc-${docId}`);
  if (!btn || !pre || !box) return;

  btn.disabled = true;
  btn.textContent = '⏳ Loading…';

  const _finish = (text) => {
    pre.textContent = text;
    box.style.display = '';
    try {
      navigator.clipboard.writeText(text).then(() => {
        btn.disabled = false;
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = '📋 Load & Copy'; }, 3000);
      }).catch(() => {
        btn.disabled = false;
        btn.textContent = '📋 Loaded (select & copy)';
      });
    } catch (_) {
      btn.disabled = false;
      btn.textContent = '📋 Loaded (select & copy)';
    }
  };

  const _error = (msg) => {
    btn.disabled = false;
    btn.textContent = '⚠ Error loading';
    pre.textContent = msg;
    box.style.display = '';
  };

  /* Code.gs: use pre-embedded window.BEZALEL_CODE_GS, lazy-loading
     bezalel_codex.js if needed — avoids fetching the gitignored source file */
  if (docId === 'code') {
    if (window.BEZALEL_CODE_GS) {
      _finish(window.BEZALEL_CODE_GS);
      return;
    }
    const base = new URL('.', import.meta.url).href.split('/Views/')[0];
    const scriptSrc = base + '/Scripts/bezalel_codex.js';
    const s = document.createElement('script');
    s.src = scriptSrc;
    s.onload = () => {
      if (window.BEZALEL_CODE_GS) { _finish(window.BEZALEL_CODE_GS); }
      else { _error('Error: BEZALEL_CODE_GS not found in bezalel_codex.js'); }
    };
    s.onerror = () => _error(`Error: failed to load bezalel_codex.js\n\nFallback: open the file directly at:\n${doc.path}`);
    document.head.appendChild(s);
    return;
  }

  try {
    const resp = await fetch(doc.path);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    _finish(await resp.text());
  } catch (err) {
    _error(`Error: ${err.message}\n\nFallback: open the file directly at:\n${doc.path}`);
  }
}

/* ── Church Setup tab ─────────────────────────────────────────────────────── */

const _CHURCH_PRESETS = {
  flockos: {
    CHURCH_NAME:          'FlockOS',
    CHURCH_TIMEZONE:      'America/New_York',
    FIRESTORE_PROJECT_ID: '',
    FIRESTORE_CHURCH_ID:  'FlockOS',
    CHURCH_APP_URL:       'https://script.google.com/macros/s/AKfycbx2pemG039LB609OlVY-OcqLWK75qRV2ZgZNyf4Oc7dGogCR2HC4C__iWUqlG9JfYLt/exec',
  },
  tbc: {
    CHURCH_NAME:          'Trinity Baptist Church',
    CHURCH_TIMEZONE:      'America/New_York',
    FIRESTORE_PROJECT_ID: 'flockos-trinity',
    FIRESTORE_CHURCH_ID:  'TBC',
    CHURCH_APP_URL:       'https://script.google.com/macros/s/AKfycbwAFp0BQvt0DiDJBjzBrycMripfUHOkP0PwiB_DSXgGVezP_y8jCOVxZWweTp58gai7/exec',
  },
  theforest: {
    CHURCH_NAME:          'The Forest',
    CHURCH_TIMEZONE:      'America/Chicago',
    FIRESTORE_PROJECT_ID: 'flockos-theforest',
    FIRESTORE_CHURCH_ID:  'TheForest',
    CHURCH_APP_URL:       'https://script.google.com/macros/s/AKfycbwH7HY6_HK8NnP2R4IXfhsVQYnyAhWRStV8t5KJwaD7pnga0QKNj1mxwX5OAYwxEKDI/exec',
  },
  custom: {
    CHURCH_NAME: '', CHURCH_TIMEZONE: 'America/New_York',
    FIRESTORE_PROJECT_ID: '', FIRESTORE_CHURCH_ID: '', CHURCH_APP_URL: '',
  },
};

const _FIELD_ORDER = [
  'CHURCH_NAME', 'CHURCH_TIMEZONE', 'FIRESTORE_PROJECT_ID', 'FIRESTORE_CHURCH_ID',
  'SYNC_SECRET', 'MASTER_SYNC_SECRET', 'FIREBASE_SERVICE_ACCOUNT', 'TRUTH_SERVICE_ACCOUNT',
  'ADMIN_EMAIL', 'ADMIN_FIRST', 'ADMIN_LAST', 'ADMIN_PASSWORD', 'NOTIFY_EMAIL',
  'CHURCH_APP_URL',
  'TWILIO_SID', 'TWILIO_TOKEN', 'TWILIO_NUMBER',
  'CHURCH_FOLDER_ID',
];

const _TZ_OPTIONS = [
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Phoenix','America/Anchorage','Pacific/Honolulu','America/Puerto_Rico',
  'Europe/London','Europe/Berlin','Africa/Lagos','Asia/Kolkata','Asia/Manila','Australia/Sydney',
];

function _secretField(id, label, { hint = '', required = false, withGen = false } = {}) {
  const req = required ? ' <span style="color:#b91c1c">*</span>' : '';
  const genBtn = withGen
    ? `<button type="button" data-gen="${_e(id)}" title="Generate random secret"
        style="position:absolute;right:${withGen ? '64px' : '36px'};top:50%;transform:translateY(-50%);
          background:none;border:none;cursor:pointer;color:var(--accent);font-size:1rem;padding:4px;"
      >⚡</button>` : '';
  return `
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label for="${_e(id)}" style="font-size:0.78rem;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:0.04em;">${_e(label)}${req}</label>
      <div style="position:relative;">
        <input id="${_e(id)}" type="password" autocomplete="off"
          style="padding:8px 70px 8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font-size:0.85rem;font-family:inherit;width:100%;box-sizing:border-box;">
        ${genBtn}
        <button type="button" data-eye="${_e(id)}" title="Show/hide"
          style="position:absolute;right:8px;top:50%;transform:translateY(-50%);
            background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:1rem;padding:4px;">👁</button>
      </div>
      ${hint ? `<div style="font-size:0.74rem;color:var(--ink-muted);line-height:1.4;">${hint}</div>` : ''}
    </div>`;
}

function _textField(id, label, { placeholder = '', hint = '', required = false, type = 'text' } = {}) {
  const req = required ? ' <span style="color:#b91c1c">*</span>' : '';
  return `
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label for="${_e(id)}" style="font-size:0.78rem;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:0.04em;">${_e(label)}${req}</label>
      <input id="${_e(id)}" type="${_e(type)}" placeholder="${_e(placeholder)}" autocomplete="off"
        style="padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font-size:0.85rem;font-family:inherit;width:100%;box-sizing:border-box;">
      ${hint ? `<div style="font-size:0.74rem;color:var(--ink-muted);line-height:1.4;">${hint}</div>` : ''}
    </div>`;
}

function _churchSetupTab() {
  const tzOpts = _TZ_OPTIONS.map(tz =>
    `<option value="${_e(tz)}">${_e(tz)}</option>`
  ).join('');

  const card = (title, body) => `
    <div class="bz-card" style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:0;">
      <div style="font-size:0.78rem;font-weight:700;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">${title}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;">${body}</div>
    </div>`;

  return `
<div style="display:grid;gap:14px;">

  <!-- Security warning -->
  <div style="display:flex;gap:10px;padding:12px 14px;background:rgba(185,28,28,0.06);border:1px solid rgba(185,28,28,0.25);border-radius:8px;font-size:0.82rem;color:var(--ink);line-height:1.5;">
    <span style="font-size:1.1rem;flex-shrink:0;">⚠️</span>
    <div>
      <strong>Security:</strong> Secrets entered here never leave your browser — generation is entirely client-side.
      Do <strong>not</strong> share the generated output. After running <code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px;">setAllScriptProperties_()</code>
      in Apps Script, <strong>delete Setup.gs immediately</strong>. Then delete <code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px;">ADMIN_PASSWORD</code> from Script Properties after first login.
    </div>
  </div>

  <!-- Church selector -->
  <div class="bz-card" style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;padding:16px;">
    <div style="font-size:0.78rem;font-weight:700;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Select Church Node</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;" id="bz-church-selector">
      ${[['flockos','🕊 FlockOS'],['tbc','⛪ Trinity Baptist'],['theforest','🌲 The Forest'],['custom','✚ New Church']].map(([id, label]) =>
        `<button class="bz-church-btn" data-church="${_e(id)}" type="button"
          style="padding:8px 16px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);
            font-size:0.82rem;font-family:inherit;cursor:pointer;white-space:nowrap;"
        >${_e(label)}</button>`
      ).join('')}
    </div>
  </div>

  <!-- Identity -->
  ${card('◆ Identity', `
    <div style="display:flex;flex-direction:column;gap:4px;grid-column:1/-1;">
      <label for="bz-CHURCH_NAME" style="font-size:0.78rem;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:0.04em;">Church Name <span style="color:#b91c1c">*</span></label>
      <input id="bz-CHURCH_NAME" type="text" placeholder="e.g. Grace Community Church"
        style="padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font-size:0.85rem;font-family:inherit;width:100%;box-sizing:border-box;">
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label for="bz-CHURCH_TIMEZONE" style="font-size:0.78rem;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:0.04em;">Timezone <span style="color:#b91c1c">*</span></label>
      <select id="bz-CHURCH_TIMEZONE" style="padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font-size:0.85rem;font-family:inherit;">${tzOpts}</select>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label for="bz-CHURCH_APP_URL" style="font-size:0.78rem;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:0.04em;">Church App URL <span style="font-size:0.72rem;font-weight:400;text-transform:none;color:var(--ink-muted);">Set after Web App deploy</span></label>
      <input id="bz-CHURCH_APP_URL" type="text" placeholder="https://script.google.com/macros/s/…/exec"
        style="padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font-size:0.85rem;font-family:inherit;width:100%;box-sizing:border-box;">
    </div>
  `)}

  <!-- Firestore -->
  ${card('◆ Firestore', `
    ${_textField('bz-FIRESTORE_PROJECT_ID', 'Firestore Project ID', { placeholder: 'flockos-yourchurch', required: true })}
    <div style="display:flex;flex-direction:column;gap:4px;">
      ${_textField('bz-FIRESTORE_CHURCH_ID', 'Firestore Church ID', { placeholder: 'YourChurch', required: true, hint: 'The key under churches/ in Firestore' })}
    </div>
  `)}

  <!-- Secrets -->
  <div class="bz-card" style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;padding:16px;">
    <div style="font-size:0.78rem;font-weight:700;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">◆ Secrets</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;">
      ${_secretField('bz-SYNC_SECRET', 'Sync Secret', { required: true, withGen: true, hint: 'Must match churches/{id}.syncSecret in Firestore. Change both together.' })}
      ${_secretField('bz-MASTER_SYNC_SECRET', 'Master Sync Secret', { required: true, withGen: true, hint: 'Same value across all churches — from master-api.json.' })}
      <div style="grid-column:1/-1;">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <label for="bz-FIREBASE_SERVICE_ACCOUNT" style="font-size:0.78rem;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:0.04em;">Firebase Service Account JSON <span style="color:#b91c1c">*</span></label>
            <button type="button" data-sa-load="bz-FIREBASE_SERVICE_ACCOUNT" style="font-size:0.72rem;padding:2px 10px;border:1px solid var(--line);border-radius:5px;background:var(--bg);color:var(--ink);cursor:pointer;font-family:inherit;">📂 Load file</button>
          </div>
          <textarea id="bz-FIREBASE_SERVICE_ACCOUNT" rows="4" placeholder='{"type":"service_account","project_id":"..."}'
            style="padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font-size:0.78rem;font-family:monospace;width:100%;box-sizing:border-box;resize:vertical;"></textarea>
          <div style="font-size:0.74rem;color:var(--ink-muted);">Load the JSON file for this church's Firebase project, or paste it directly.</div>
        </div>
      </div>
      <div style="grid-column:1/-1;">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <label for="bz-TRUTH_SERVICE_ACCOUNT" style="font-size:0.78rem;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:0.04em;">Truth Service Account JSON <span style="color:#b91c1c">*</span></label>
            <button type="button" data-sa-load="bz-TRUTH_SERVICE_ACCOUNT" style="font-size:0.72rem;padding:2px 10px;border:1px solid var(--line);border-radius:5px;background:var(--bg);color:var(--ink);cursor:pointer;font-family:inherit;">📂 Load file</button>
          </div>
          <textarea id="bz-TRUTH_SERVICE_ACCOUNT" rows="4" placeholder='{"type":"service_account","project_id":"flockos-truth","client_email":"..."}'
            style="padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font-size:0.78rem;font-family:monospace;width:100%;box-sizing:border-box;resize:vertical;"></textarea>
          <div style="font-size:0.74rem;color:var(--ink-muted);">Load the flockos-truth service account JSON, or paste it directly. Seeds Books, Devotionals, Theology, etc. during setup.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Admin Setup -->
  <div class="bz-card" style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;padding:16px;">
    <div style="font-size:0.78rem;font-weight:700;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">◆ Admin Setup</div>
    <div style="font-size:0.74rem;color:#b45309;margin-bottom:14px;">Delete ADMIN_PASSWORD from Script Properties immediately after first login.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;">
      ${_textField('bz-ADMIN_EMAIL', 'Admin Email', { type: 'email', placeholder: 'pastor@yourchurch.org', required: true })}
      ${_textField('bz-NOTIFY_EMAIL', 'Notify Email', { type: 'email', placeholder: 'Same as admin, or notification inbox' })}
      ${_textField('bz-ADMIN_FIRST', 'Admin First Name', { placeholder: 'First', required: true })}
      ${_textField('bz-ADMIN_LAST', 'Admin Last Name', { placeholder: 'Last', required: true })}
      <div style="grid-column:1/-1;">
        ${_secretField('bz-ADMIN_PASSWORD', 'Admin Password', { required: true, withGen: true, hint: 'Initial password — delete from Script Properties after setup. To reset later, set a new value and run setupFlockOS() again.' })}
      </div>
    </div>
  </div>

  <!-- Optional -->
  ${card('◆ Optional (Twilio / Drive)', `
    ${_textField('bz-TWILIO_SID', 'Twilio SID', { placeholder: 'ACxxxxxxxx' })}
    ${_secretField('bz-TWILIO_TOKEN', 'Twilio Auth Token')}
    ${_textField('bz-TWILIO_NUMBER', 'Twilio Number', { placeholder: '+15551234567' })}
    ${_textField('bz-CHURCH_FOLDER_ID', 'Church Drive Folder ID', { placeholder: 'Google Drive folder ID' })}
  `)}

  <!-- Output -->
  <div class="bz-card" style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;padding:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
      <div style="font-size:0.9rem;font-weight:700;color:var(--ink);">Setup.gs — <code style="font-family:monospace;font-size:0.85em;">setAllScriptProperties_()</code></div>
      <div style="display:flex;gap:8px;">
        <button id="bz-setup-copy" class="btn btn-primary" type="button" style="font-size:0.8rem;padding:7px 16px;">📋 Copy</button>
        <button id="bz-setup-clear" class="btn" type="button"
          style="font-size:0.8rem;padding:7px 14px;background:none;border:1px solid rgba(185,28,28,0.4);color:#b91c1c;border-radius:6px;cursor:pointer;font-family:inherit;">✕ Clear</button>
      </div>
    </div>
    <pre id="bz-setup-pre" style="background:var(--bg-sunken);border:1px solid var(--line);border-radius:8px;
      padding:14px;font-size:0.76rem;line-height:1.6;overflow-x:auto;white-space:pre-wrap;word-break:break-word;
      max-height:420px;overflow-y:auto;color:var(--ink);font-family:monospace;margin:0;"></pre>
    <div style="margin-top:12px;padding:10px 14px;background:rgba(185,28,28,0.05);border:1px solid rgba(185,28,28,0.2);border-radius:8px;font-size:0.79rem;color:var(--ink);line-height:1.6;">
      <strong>Steps:</strong>
      In Apps Script, create <code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px;">Setup.gs</code> → paste → run <code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px;">setAllScriptProperties_()</code>
      → <strong style="color:#b91c1c;">delete Setup.gs immediately</strong>
      → run <code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px;">setupFlockOS()</code> in Code.gs
      → deploy as Web App → paste URL into <code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px;">CHURCH_APP_URL</code> above and re-generate → run <code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px;">registerChurchUrl()</code>
      → <strong style="color:#b45309;">delete ADMIN_PASSWORD from Script Properties.</strong>
    </div>
  </div>

  <!-- GAS Files section -->
  <div style="font-size:0.9rem;font-weight:700;color:var(--ink);margin-top:6px;">📄 GAS Files</div>
  <div style="font-size:0.82rem;color:var(--ink-muted);margin-bottom:4px;">Load and copy Apps Script source files to deploy or update a church node.</div>
  <div style="display:grid;gap:14px;">
    ${GAS_DOCS.map(doc => `
    <div class="bz-card" style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;padding:16px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
        <div>
          <div style="font-size:1rem;font-weight:700;color:var(--ink);">\${_e(doc.label)}</div>
          <div style="font-size:0.76rem;color:var(--ink-muted);margin-top:3px;">\${_e(doc.filename)}</div>
        </div>
        <button class="bz-fetch-btn btn btn-primary" data-doc-id="\${_e(doc.id)}" style="font-size:0.8rem;padding:7px 14px;white-space:nowrap;">
          📋 Load &amp; Copy
        </button>
      </div>
      <p style="font-size:0.82rem;color:var(--ink-muted);line-height:1.55;margin:0 0 10px;">\${_e(doc.description)}</p>
      <div id="bz-doc-\${_e(doc.id)}" style="display:none;">
        <pre id="bz-pre-\${_e(doc.id)}" style="background:var(--bg-sunken);border:1px solid var(--line);border-radius:8px;
          padding:14px;font-size:0.76rem;line-height:1.55;overflow-x:auto;white-space:pre-wrap;word-break:break-word;
          max-height:420px;overflow-y:auto;color:var(--ink);font-family:monospace;"></pre>
      </div>
    </div>`).join('')}
  </div>
  <div style="margin-top:4px;padding:12px 14px;background:rgba(232,168,56,0.08);border:1px solid rgba(232,168,56,0.25);border-radius:8px;font-size:0.8rem;color:var(--ink-muted);line-height:1.5;">
    <strong style="color:var(--ink);">How to deploy a new church:</strong>
    Open the church's Google Sheet → Extensions → Apps Script → paste <strong>Code.gs</strong> →
    Set Script Properties using the Church Setup form above (FIREBASE_SERVICE_ACCOUNT, TRUTH_SERVICE_ACCOUNT required) →
    Run <code style="background:rgba(0,0,0,0.1);padding:1px 5px;border-radius:3px;font-family:monospace;">setupFlockOS()</code> once. FirestoreSync, SyncHandler, and camelCase normalization are all included in Code.gs.
  </div>

</div>`;
}

function _wireChurchSetup(root) {
  // Church selector pre-fill
  root.querySelectorAll('.bz-church-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.bz-church-btn').forEach(b => {
        b.style.background = 'var(--bg)';
        b.style.borderColor = 'var(--line)';
        b.style.color = 'var(--ink)';
        b.style.fontWeight = '';
      });
      btn.style.background = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
      btn.style.color = 'var(--ink-inverse, #fff)';
      btn.style.fontWeight = '700';
      const preset = _CHURCH_PRESETS[btn.dataset.church] || {};
      Object.entries(preset).forEach(([key, val]) => {
        const el = root.querySelector(`#bz-${key}`);
        if (!el) return;
        if (el.tagName === 'SELECT') { el.value = val; }
        else if (!el.value.trim()) { el.value = val; }
      });
      _bzUpdateOutput(root);
    });
  });

  // File picker buttons for SA JSON fields
  const _SA_KEYS = ['FIREBASE_SERVICE_ACCOUNT', 'TRUTH_SERVICE_ACCOUNT'];
  root.querySelectorAll('[data-sa-load]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          const el = root.querySelector(`#${btn.dataset.saLoad}`);
          if (!el) return;
          el.value = e.target.result.trim();
          localStorage.setItem('bz_' + btn.dataset.saLoad.replace('bz-', ''), el.value);
          _bzUpdateOutput(root);
        };
        reader.readAsText(file);
      };
      input.click();
    });
  });

  // Auto-load persisted SA credentials from localStorage (survives until cache clear)
  _SA_KEYS.forEach(key => {
    const stored = localStorage.getItem('bz_' + key);
    if (stored) {
      const el = root.querySelector(`#bz-${key}`);
      if (el && !el.value.trim()) el.value = stored;
    }
  });

  // Live update on any input; persist SA fields to localStorage
  root.querySelectorAll('[id^="bz-"]').forEach(el => {
    el.addEventListener('input', () => {
      if (_SA_KEYS.some(k => el.id === 'bz-' + k) && el.value.trim()) {
        localStorage.setItem('bz_' + el.id.replace('bz-', ''), el.value.trim());
      }
      _bzUpdateOutput(root);
    });
    el.addEventListener('change', () => _bzUpdateOutput(root));
  });

  // Eye toggles
  root.querySelectorAll('[data-eye]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = root.querySelector(`#${btn.dataset.eye}`);
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      btn.textContent = inp.type === 'password' ? '👁' : '🙈';
    });
  });

  // Generate buttons
  root.querySelectorAll('[data-gen]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = root.querySelector(`#${btn.dataset.gen}`);
      if (!inp) return;
      inp.value = _bzGenSecret(20);
      inp.type = 'text';
      const eyeBtn = root.querySelector(`[data-eye="${btn.dataset.gen}"]`);
      if (eyeBtn) eyeBtn.textContent = '🙈';
      _bzUpdateOutput(root);
    });
  });

  // Copy
  root.querySelector('#bz-setup-copy')?.addEventListener('click', async (e) => {
    const text = _bzPlainOutput(root);
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy'; }, 2500);
    } catch (_) { btn.textContent = 'Select & copy manually'; }
  });

  // Clear — wipes form values AND localStorage SA entries
  root.querySelector('#bz-setup-clear')?.addEventListener('click', () => {
    if (!confirm('Clear all entered values?')) return;
    _SA_KEYS.forEach(key => localStorage.removeItem('bz_' + key));
    root.querySelectorAll('[id^="bz-"]').forEach(el => {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = '';
    });
    root.querySelectorAll('.bz-church-btn').forEach(b => {
      b.style.background = 'var(--bg)';
      b.style.borderColor = 'var(--line)';
      b.style.color = 'var(--ink)';
      b.style.fontWeight = '';
    });
    _bzUpdateOutput(root);
  });

  _bzUpdateOutput(root);
}

function _bzGenSecret(len) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  let out = '';
  const arr = new Uint8Array(len * 2);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length && out.length < len; i++) {
    const idx = arr[i] % chars.length;
    out += chars[idx];
  }
  return out;
}

function _bzVal(root, key) {
  const el = root.querySelector(`#bz-${key}`);
  return el ? el.value.trim() : '';
}

function _bzEsc(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
}

function _bzEscJson(str) {
  try {
    const compact = JSON.stringify(JSON.parse(str));
    return compact.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  } catch (_) { return _bzEsc(str); }
}

function _bzPlainOutput(root) {
  const props = {};
  _FIELD_ORDER.forEach(key => {
    const raw = _bzVal(root, key);
    if (raw) props[key] = raw;
  });
  if (!Object.keys(props).length) return '// No values entered yet.';
  const lines = [
    '// ── Paste into Apps Script, run ONCE, then DELETE immediately ───',
    'function setAllScriptProperties_() {',
    '  var props = PropertiesService.getScriptProperties();',
    '  props.setProperties({',
  ];
  Object.entries(props).forEach(([key, raw]) => {
    const escaped = (key === 'FIREBASE_SERVICE_ACCOUNT' || key === 'TRUTH_SERVICE_ACCOUNT') ? _bzEscJson(raw) : _bzEsc(raw);
    lines.push(`    '${key}': '${escaped}',`);
  });
  lines.push('  });');
  lines.push("  Logger.log('✅ Script Properties set.');");
  lines.push("  Logger.log('⚠️  Delete this file now.');");
  lines.push('}');
  return lines.join('\n');
}

function _bzUpdateOutput(root) {
  const pre = root.querySelector('#bz-setup-pre');
  if (pre) pre.textContent = _bzPlainOutput(root);
}

/* ── Deployments tab ──────────────────────────────────────────────────────── */
function _deploymentsTab(churches) {
  const list = churches || CHURCHES;
  const rows = list.map((c, i) => {
    const dot = c.status === 'live'
      ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;"></span>'
      : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span>';
    return `
    <tr style="border-bottom:1px solid var(--line);" data-row="${i}">
      <td style="padding:10px 8px;">${dot}</td>
      <td style="padding:10px 8px;font-weight:600;color:var(--ink);">${_e(c.name)}</td>
      <td style="padding:10px 8px;font-size:0.8rem;color:var(--ink-muted);">
        <a href="https://${_e(c.url)}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;text-decoration-style:dotted;">${_e(c.url)}</a>
      </td>
      <td style="padding:10px 8px;font-size:0.78rem;color:var(--ink-muted);font-family:monospace;">${_e(c.firebaseProject ?? 'null')}</td>
      <td style="padding:10px 8px;"><span style="font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:99px;background:${c.status === 'live' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)'};color:${c.status === 'live' ? '#16a34a' : '#d97706'};border:1px solid ${c.status === 'live' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'};">${_e(c.status)}</span></td>
      <td style="padding:10px 8px;font-size:0.78rem;color:var(--ink-muted);">v${_e(c.version)}</td>
      <td style="padding:10px 8px;white-space:nowrap;">
        <button class="bz-edit-church" data-idx="${i}" style="font-size:0.74rem;padding:4px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);cursor:pointer;font-family:inherit;margin-right:4px;">✏ Edit</button>
        <button class="bz-del-church" data-idx="${i}" style="font-size:0.74rem;padding:4px 10px;border:1px solid rgba(185,28,28,0.3);border-radius:6px;background:transparent;color:#b91c1c;cursor:pointer;font-family:inherit;">✕</button>
      </td>
    </tr>`;
  }).join('');

  return `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
  <div style="font-size:0.82rem;color:var(--ink-muted);" id="bz-deploy-status">Loading…</div>
  <button id="bz-add-church" style="font-size:0.82rem;padding:8px 16px;border:none;border-radius:8px;background:var(--accent);color:var(--ink-inverse);cursor:pointer;font-family:inherit;font-weight:700;">+ Add Church</button>
</div>
<div class="bz-card" style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;overflow:hidden;" id="bz-church-table-wrap">
  <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
    <thead>
      <tr style="border-bottom:2px solid var(--line);background:var(--bg-sunken);">
        <th style="padding:10px 8px;text-align:left;font-size:0.7rem;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;"></th>
        <th style="padding:10px 8px;text-align:left;font-size:0.7rem;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;">Church</th>
        <th style="padding:10px 8px;text-align:left;font-size:0.7rem;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;">URL</th>
        <th style="padding:10px 8px;text-align:left;font-size:0.7rem;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;">Firebase Project</th>
        <th style="padding:10px 8px;text-align:left;font-size:0.7rem;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;">Status</th>
        <th style="padding:10px 8px;text-align:left;font-size:0.7rem;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;">Version</th>
        <th style="padding:10px 8px;text-align:left;font-size:0.7rem;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;">Actions</th>
      </tr>
    </thead>
    <tbody id="bz-church-tbody">${rows}</tbody>
  </table>
</div>

<div class="bz-card" style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:14px;">
  <div style="font-size:0.9rem;font-weight:700;color:var(--ink);margin-bottom:10px;">🗂 Firestore Index Deploy</div>
  <p style="font-size:0.82rem;color:var(--ink-muted);line-height:1.55;margin:0 0 12px;">
    Indexes auto-deploy on every BCP (<code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 5px;border-radius:3px;">--deploy-comms</code>).
    To deploy indexes manually to a single project, copy the command below.
  </p>
  <div style="display:grid;gap:8px;" id="bz-idx-list">
    ${list.filter(c => c.firebaseProject).map(c => `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="font-size:0.78rem;font-weight:600;color:var(--ink);min-width:140px;">${_e(c.name)}</span>
      <code id="bz-idx-cmd-${_e(c.id)}" style="flex:1;background:var(--bg-sunken);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:0.75rem;font-family:monospace;color:var(--ink);white-space:nowrap;overflow-x:auto;">firebase deploy --only firestore:indexes --project ${_e(c.firebaseProject)}</code>
      <button class="bz-idx-copy btn btn-outline" data-target="bz-idx-cmd-${_e(c.id)}" style="font-size:0.75rem;padding:5px 10px;white-space:nowrap;">📋 Copy</button>
    </div>`).join('')}
  </div>
</div>

<div class="bz-card" style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:14px;">
  <div style="font-size:0.9rem;font-weight:700;color:var(--ink);margin-bottom:10px;">🔒 Firestore Rules Deploy</div>
  <p style="font-size:0.82rem;color:var(--ink-muted);line-height:1.55;margin:0 0 12px;">
    Rules auto-deploy on every BCP (<code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 5px;border-radius:3px;">--deploy-comms</code>) using
    <code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 5px;border-radius:3px;">Deployment/Firestore/firestore.rules</code> as the master.
    To deploy rules to all projects at once, run the standalone script. To deploy a single church project manually, copy the command below.
    <br><br>
    <strong>Standalone (all projects):</strong>
  </p>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
    <code id="bz-rules-all-cmd" style="flex:1;background:var(--bg-sunken);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:0.75rem;font-family:monospace;color:var(--ink);white-space:nowrap;overflow-x:auto;">bash "Iris/Bezalel/Scripts/Z-Deploy_Firestore_Rules.sh"</code>
    <button class="bz-rules-copy btn btn-outline" data-target="bz-rules-all-cmd" style="font-size:0.75rem;padding:5px 10px;white-space:nowrap;">📋 Copy</button>
  </div>
  <div style="font-size:0.78rem;font-weight:700;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Per Church Project</div>
  <div style="display:grid;gap:8px;" id="bz-rules-list">
    ${list.filter(c => c.firebaseProject).map(c => `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="font-size:0.78rem;font-weight:600;color:var(--ink);min-width:140px;">${_e(c.name)}</span>
      <code id="bz-rules-cmd-${_e(c.id)}" style="flex:1;background:var(--bg-sunken);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:0.75rem;font-family:monospace;color:var(--ink);white-space:nowrap;overflow-x:auto;">firebase deploy --only firestore:rules --config church-firestore.json --project ${_e(c.firebaseProject)}</code>
      <button class="bz-rules-copy btn btn-outline" data-target="bz-rules-cmd-${_e(c.id)}" style="font-size:0.75rem;padding:5px 10px;white-space:nowrap;">📋 Copy</button>
    </div>`).join('')}
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;padding-top:10px;border-top:1px solid var(--line);">
      <span style="font-size:0.78rem;font-weight:600;color:var(--ink);min-width:140px;">FlockChat (comms)</span>
      <code id="bz-rules-cmd-comms" style="flex:1;background:var(--bg-sunken);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:0.75rem;font-family:monospace;color:var(--ink);white-space:nowrap;overflow-x:auto;">bash "Iris/Bezalel/Scripts/Z-Deploy_Firestore_Rules.sh" --project flockos-comms</code>
      <button class="bz-rules-copy btn btn-outline" data-target="bz-rules-cmd-comms" style="font-size:0.75rem;padding:5px 10px;white-space:nowrap;">📋 Copy</button>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="font-size:0.78rem;font-weight:600;color:var(--ink);min-width:140px;">Truth (content DB)</span>
      <code id="bz-rules-cmd-truth" style="flex:1;background:var(--bg-sunken);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:0.75rem;font-family:monospace;color:var(--ink);white-space:nowrap;overflow-x:auto;">bash "Iris/Bezalel/Scripts/Z-Deploy_Firestore_Rules.sh" --project flockos-truth</code>
      <button class="bz-rules-copy btn btn-outline" data-target="bz-rules-cmd-truth" style="font-size:0.75rem;padding:5px 10px;white-space:nowrap;">📋 Copy</button>
    </div>
  </div>
</div>

<!-- Inline edit sheet (hidden by default) -->
<div id="bz-church-sheet" style="display:none;position:fixed;inset:0;z-index:9000;background:rgba(10,14,33,0.55);backdrop-filter:blur(6px);align-items:flex-start;justify-content:center;padding:40px 12px 80px;overflow-y:auto;">
  <div style="background:var(--bg-raised);border:1px solid var(--line);border-radius:16px;padding:24px;max-width:520px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,0.45);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 id="bz-sheet-title" style="margin:0;font-size:1rem;color:var(--ink);">Add Church</h3>
      <button id="bz-sheet-close" style="background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:1.3rem;line-height:1;padding:4px;">✕</button>
    </div>
    <div style="display:grid;gap:12px;">
      <div>
        <label style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted);display:block;margin-bottom:4px;">Church Name *</label>
        <input id="bz-sf-name" type="text" placeholder="e.g. Grace Community Church" style="width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:0.88rem;font-family:inherit;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted);display:block;margin-bottom:4px;">URL (domain only) *</label>
        <input id="bz-sf-url" type="text" placeholder="e.g. mychurch.flockos.app" style="width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:0.88rem;font-family:inherit;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted);display:block;margin-bottom:4px;">Firebase Project ID</label>
        <input id="bz-sf-firebase" type="text" placeholder="e.g. flockos-mychurch (leave blank for GAS-only)" style="width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:0.88rem;font-family:inherit;box-sizing:border-box;">
      </div>
      <div>
        <label style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted);display:block;margin-bottom:4px;">GAS Endpoint URL</label>
        <input id="bz-sf-gas" type="url" placeholder="https://script.google.com/macros/s/…/exec" style="width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:0.88rem;font-family:inherit;box-sizing:border-box;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted);display:block;margin-bottom:4px;">Status</label>
          <select id="bz-sf-status" style="width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:0.88rem;font-family:inherit;">
            <option value="live">live</option>
            <option value="building">building</option>
            <option value="offline">offline</option>
          </select>
        </div>
        <div>
          <label style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted);display:block;margin-bottom:4px;">Version</label>
          <input id="bz-sf-version" type="text" placeholder="e.g. 2.0.0" style="width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:0.88rem;font-family:inherit;box-sizing:border-box;">
        </div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
      <button id="bz-sheet-cancel" style="padding:9px 18px;border:1px solid var(--line);border-radius:8px;background:none;color:var(--ink);cursor:pointer;font-family:inherit;font-size:0.88rem;">Cancel</button>
      <button id="bz-sheet-save" style="padding:9px 20px;border:none;border-radius:8px;background:var(--accent);color:var(--ink-inverse);cursor:pointer;font-family:inherit;font-size:0.88rem;font-weight:700;">Save Church</button>
    </div>
  </div>
</div>`;
}

function _wireDeployments(root) {
  const UR = window.UpperRoom;
  const STORE_KEY = 'bezalel_churches';
  let _churches = null; // loaded list

  /* ── Copy index commands ─────────────────────────────────────────────── */
  root.querySelectorAll('.bz-idx-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const el = root.querySelector(`#${btn.dataset.target}`);
      const text = el?.textContent?.trim() || '';
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = '📋 Copy'; }, 2500);
      } catch (_) { btn.textContent = 'Select & copy'; }
    });
  });

  /* ── Load from Firestore, fall back to hardcoded ─────────────────────── */
  async function _load() {
    if (UR && typeof UR.getAppConfig === 'function') {
      try {
        const res = await UR.getAppConfig({ key: STORE_KEY });
        if (res?.value) {
          const parsed = JSON.parse(res.value);
          if (Array.isArray(parsed) && parsed.length) return parsed;
        }
      } catch (_) {}
    }
    return JSON.parse(JSON.stringify(CHURCHES)); // deep clone default
  }

  /* ── Persist to Firestore ─────────────────────────────────────────────── */
  async function _save(list) {
    if (UR && typeof UR.setAppConfig === 'function') {
      await UR.setAppConfig({ key: STORE_KEY, value: JSON.stringify(list) });
    }
  }

  /* ── Re-render table body + index list ──────────────────────────────────  */
  function _refreshTable() {
    const tbody = root.querySelector('#bz-church-tbody');
    const idxList = root.querySelector('#bz-idx-list');
    const statusEl = root.querySelector('#bz-deploy-status');
    if (!tbody) return;

    tbody.innerHTML = _churches.map((c, i) => {
      const dot = c.status === 'live'
        ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;"></span>'
        : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span>';
      return `
      <tr style="border-bottom:1px solid var(--line);" data-row="${i}">
        <td style="padding:10px 8px;">${dot}</td>
        <td style="padding:10px 8px;font-weight:600;color:var(--ink);">${_e(c.name)}</td>
        <td style="padding:10px 8px;font-size:0.8rem;color:var(--ink-muted);">
          <a href="https://${_e(c.url)}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;text-decoration-style:dotted;">${_e(c.url)}</a>
        </td>
        <td style="padding:10px 8px;font-size:0.78rem;color:var(--ink-muted);font-family:monospace;">${_e(c.firebaseProject ?? 'null')}</td>
        <td style="padding:10px 8px;"><span style="font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:99px;background:${c.status === 'live' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)'};color:${c.status === 'live' ? '#16a34a' : '#d97706'};border:1px solid ${c.status === 'live' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'};">${_e(c.status)}</span></td>
        <td style="padding:10px 8px;font-size:0.78rem;color:var(--ink-muted);">v${_e(c.version)}</td>
        <td style="padding:10px 8px;white-space:nowrap;">
          <button class="bz-edit-church" data-idx="${i}" style="font-size:0.74rem;padding:4px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);cursor:pointer;font-family:inherit;margin-right:4px;">✏ Edit</button>
          <button class="bz-del-church" data-idx="${i}" style="font-size:0.74rem;padding:4px 10px;border:1px solid rgba(185,28,28,0.3);border-radius:6px;background:transparent;color:#b91c1c;cursor:pointer;font-family:inherit;">✕</button>
        </td>
      </tr>`;
    }).join('');

    if (idxList) {
      idxList.innerHTML = _churches.filter(c => c.firebaseProject).map(c => `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:0.78rem;font-weight:600;color:var(--ink);min-width:140px;">${_e(c.name)}</span>
          <code id="bz-idx-cmd-${_e(c.id)}" style="flex:1;background:var(--bg-sunken);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:0.75rem;font-family:monospace;color:var(--ink);white-space:nowrap;overflow-x:auto;">firebase deploy --only firestore:indexes --project ${_e(c.firebaseProject)}</code>
          <button class="bz-idx-copy btn btn-outline" data-target="bz-idx-cmd-${_e(c.id)}" style="font-size:0.75rem;padding:5px 10px;white-space:nowrap;">📋 Copy</button>
        </div>`).join('');
      // Re-wire copy buttons
      idxList.querySelectorAll('.bz-idx-copy').forEach(btn => {
        btn.addEventListener('click', async () => {
          const el = root.querySelector(`#${btn.dataset.target}`);
          const text = el?.textContent?.trim() || '';
          try {
            await navigator.clipboard.writeText(text);
            btn.textContent = '✓ Copied!';
            setTimeout(() => { btn.textContent = '📋 Copy'; }, 2500);
          } catch (_) { btn.textContent = 'Select & copy'; }
        });
      });
    }

    const rulesList = root.querySelector('#bz-rules-list');
    if (rulesList) {
      const churchRows = _churches.filter(c => c.firebaseProject).map(c => `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:0.78rem;font-weight:600;color:var(--ink);min-width:140px;">${_e(c.name)}</span>
          <code id="bz-rules-cmd-${_e(c.id)}" style="flex:1;background:var(--bg-sunken);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:0.75rem;font-family:monospace;color:var(--ink);white-space:nowrap;overflow-x:auto;">firebase deploy --only firestore:rules --config church-firestore.json --project ${_e(c.firebaseProject)}</code>
          <button class="bz-rules-copy btn btn-outline" data-target="bz-rules-cmd-${_e(c.id)}" style="font-size:0.75rem;padding:5px 10px;white-space:nowrap;">📋 Copy</button>
        </div>`).join('');
      const staticRows = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;padding-top:10px;border-top:1px solid var(--line);">
          <span style="font-size:0.78rem;font-weight:600;color:var(--ink);min-width:140px;">FlockChat (comms)</span>
          <code id="bz-rules-cmd-comms" style="flex:1;background:var(--bg-sunken);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:0.75rem;font-family:monospace;color:var(--ink);white-space:nowrap;overflow-x:auto;">bash "Iris/Bezalel/Scripts/Z-Deploy_Firestore_Rules.sh" --project flockos-comms</code>
          <button class="bz-rules-copy btn btn-outline" data-target="bz-rules-cmd-comms" style="font-size:0.75rem;padding:5px 10px;white-space:nowrap;">📋 Copy</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:0.78rem;font-weight:600;color:var(--ink);min-width:140px;">Truth (content DB)</span>
          <code id="bz-rules-cmd-truth" style="flex:1;background:var(--bg-sunken);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:0.75rem;font-family:monospace;color:var(--ink);white-space:nowrap;overflow-x:auto;">bash "Iris/Bezalel/Scripts/Z-Deploy_Firestore_Rules.sh" --project flockos-truth</code>
          <button class="bz-rules-copy btn btn-outline" data-target="bz-rules-cmd-truth" style="font-size:0.75rem;padding:5px 10px;white-space:nowrap;">📋 Copy</button>
        </div>`;
      rulesList.innerHTML = churchRows + staticRows;
      // Re-wire copy buttons
      rulesList.querySelectorAll('.bz-rules-copy').forEach(btn => {
        btn.addEventListener('click', async () => {
          const el = root.querySelector(`#${btn.dataset.target}`);
          const text = el?.textContent?.trim() || '';
          try {
            await navigator.clipboard.writeText(text);
            btn.textContent = '✓ Copied!';
            setTimeout(() => { btn.textContent = '📋 Copy'; }, 2500);
          } catch (_) { btn.textContent = 'Select & copy'; }
        });
      });
    }

    if (statusEl) statusEl.textContent = `${_churches.length} church${_churches.length !== 1 ? 'es' : ''} — changes saved to Firestore`;

    // Re-wire edit/delete
    _wireRowActions();
  }

  /* ── Sheet open/close ────────────────────────────────────────────────── */
  const sheet   = root.querySelector('#bz-church-sheet');
  const sheetTitle = root.querySelector('#bz-sheet-title');
  const saveBtn = root.querySelector('#bz-sheet-save');
  let _editIdx  = -1; // -1 = add new

  function _openSheet(idx) {
    _editIdx = idx;
    const c = idx >= 0 ? _churches[idx] : null;
    if (sheetTitle) sheetTitle.textContent = idx >= 0 ? 'Edit Church' : 'Add Church';
    root.querySelector('#bz-sf-name').value    = c?.name            || '';
    root.querySelector('#bz-sf-url').value     = c?.url             || '';
    root.querySelector('#bz-sf-firebase').value= c?.firebaseProject || '';
    root.querySelector('#bz-sf-gas').value     = c?.gasUrl          || '';
    root.querySelector('#bz-sf-status').value  = c?.status          || 'live';
    root.querySelector('#bz-sf-version').value = c?.version         || '2.0.0';
    sheet.style.display = 'flex';
    setTimeout(() => root.querySelector('#bz-sf-name').focus(), 80);
  }

  function _closeSheet() {
    sheet.style.display = 'none';
    _editIdx = -1;
  }

  root.querySelector('#bz-sheet-close')?.addEventListener('click', _closeSheet);
  root.querySelector('#bz-sheet-cancel')?.addEventListener('click', _closeSheet);
  sheet?.addEventListener('click', e => { if (e.target === sheet) _closeSheet(); });

  /* ── Save (add or update) ────────────────────────────────────────────── */
  saveBtn?.addEventListener('click', async () => {
    const name    = root.querySelector('#bz-sf-name').value.trim();
    const url     = root.querySelector('#bz-sf-url').value.trim().replace(/^https?:\/\//, '');
    const fbProj  = root.querySelector('#bz-sf-firebase').value.trim() || null;
    const gasUrl  = root.querySelector('#bz-sf-gas').value.trim();
    const status  = root.querySelector('#bz-sf-status').value;
    const version = root.querySelector('#bz-sf-version').value.trim() || '2.0.0';

    if (!name || !url) {
      root.querySelector('#bz-sf-name').style.borderColor = name ? 'var(--line)' : '#b91c1c';
      root.querySelector('#bz-sf-url').style.borderColor  = url  ? 'var(--line)' : '#b91c1c';
      return;
    }

    const entry = {
      id:              _editIdx >= 0 ? (_churches[_editIdx].id || url.split('.')[0]) : url.split('.')[0],
      name, url, firebaseProject: fbProj, gasUrl, status, version,
    };

    if (_editIdx >= 0) {
      _churches[_editIdx] = entry;
    } else {
      _churches.push(entry);
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving…';
    try {
      await _save(_churches);
      saveBtn.textContent = '✓ Saved';
    } catch (_) {
      saveBtn.textContent = 'Save Church';
    }
    saveBtn.disabled = false;

    _closeSheet();
    _refreshTable();
  });

  /* ── Wire edit / delete row buttons ─────────────────────────────────── */
  function _wireRowActions() {
    root.querySelectorAll('.bz-edit-church').forEach(btn => {
      btn.addEventListener('click', () => _openSheet(Number(btn.dataset.idx)));
    });
    root.querySelectorAll('.bz-del-church').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.dataset.idx);
        const name = _churches[idx]?.name || 'this church';
        if (!confirm(`Remove "${name}" from the deployments list?`)) return;
        _churches.splice(idx, 1);
        await _save(_churches);
        _refreshTable();
      });
    });
  }

  /* ── Add Church button ───────────────────────────────────────────────── */
  root.querySelector('#bz-add-church')?.addEventListener('click', () => _openSheet(-1));

  /* ── Bootstrap: load data, then wire ────────────────────────────────── */
  const statusEl = root.querySelector('#bz-deploy-status');
  if (statusEl) statusEl.textContent = 'Loading…';

  _load().then(list => {
    _churches = list;
    _refreshTable();
    // Initial row wiring (table was already rendered with default CHURCHES)
    _wireRowActions();
  }).catch(() => {
    _churches = JSON.parse(JSON.stringify(CHURCHES));
    _refreshTable();
    _wireRowActions();
  });
}

