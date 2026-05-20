/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: THE WALL — Admin & Church Settings
   "I have set watchmen on your walls, O Jerusalem." — Isaiah 62:6
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';

export const name  = 'the_wall';
export const title = 'Admin';

function _waitForUpperRoom(ms) {
  return new Promise(resolve => {
    const end = Date.now() + ms;
    const tick = () => {
      const UR = window.UpperRoom;
      if (UR && typeof UR.getAppConfig === 'function') return resolve(UR);
      if (Date.now() >= end) return resolve(null);
      setTimeout(tick, 250);
    };
    tick();
  });
}

const SECTIONS = [
  {
    key: 'general', label: 'Church',
    icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    custom: 'church',
  },
  {
    key: 'members', label: 'Membership',
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    custom: 'members',
  },
  {
    key: 'roles', label: 'Roles & Access',
    icon: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>',
    custom: 'roles',
  },
  {
    key: 'integrations', label: 'Integrations',
    icon: '<rect x="2" y="2" width="6" height="6" rx="1"/><rect x="16" y="2" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M5 8v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/>',
    get settings() {
      const projId = (window.FLOCK_FIREBASE_CONFIG && window.FLOCK_FIREBASE_CONFIG.projectId)
        || (window.UpperRoom && window.UpperRoom.isReady && window.UpperRoom.isReady() && window.firebase && window.firebase.apps.length && window.firebase.app().options.projectId)
        || (window.firebase && window.firebase.apps.length && window.firebase.app().options.projectId)
        || 'flockos-notify';
      return [
        { label: 'Firebase Project',  value: projId,                       type: 'text'  },
        { label: 'GAS Endpoint',      value: 'Connected (TheScrolls)',      type: 'badge', status: 'ok'   },
        { type: 'vapid' },
        { type: 'network-status-heading' },
        { type: 'missions-source', id: 'ms-src-flock', label: 'Flock Network Status', desc: 'Core Flock platform connectivity', url: 'https://www.yhwh.one' },
        { label: 'Joshua Project API', type: 'jp-api' },
        { label: 'api.bible',           type: 'bible-api' },
        { label: 'Checkr',              type: 'checkr-api' },
        { type: 'missions-sources-heading' },
        { type: 'missions-source', id: 'ms-src-jp',  label: 'Joshua Project',       desc: 'Unreached people groups & country profiles', url: 'https://joshuaproject.net' },
        { type: 'missions-source', id: 'ms-src-od',  label: 'Open Doors USA',        desc: 'World Watch List · Persecution data',          url: 'https://www.opendoorsusa.org' },
        { type: 'missions-source', id: 'ms-src-ow',  label: 'Operation World',       desc: 'Country-by-country prayer guide',              url: 'https://operationworld.org' },
        { type: 'missions-source', id: 'ms-src-vom', label: 'Voice of the Martyrs',  desc: 'Persecuted church news & prayer',              url: 'https://www.persecution.com' },
        { type: 'missions-source', id: 'ms-src-bal', label: 'Bible Access List',      desc: 'Scripture access restrictions by country',     url: 'https://bibleaccesslist.org' },
        { type: 'missions-source', id: 'ms-src-ftt', label: 'Finishing the Task',     desc: 'Zero UPG movement coordination',               url: 'https://finishingthetask.com' },
        { type: 'missions-source', id: 'ms-src-afb', label: 'AfghanBibles.net',        desc: 'Dari, Pashto & Turkmen scripture resources',   url: 'https://afghanbibles.net' },
      ];
    },
  },
  {
    key: 'notifications', label: 'Notifications',
    icon: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    custom: 'notifications',
  },
  {
    key: 'wellspring', label: 'The Wellspring',
    icon: '<path d="M12 2a5 5 0 0 1 5 5c0 5.25-5 11-5 11S7 12.25 7 7a5 5 0 0 1 5-5z"/><circle cx="12" cy="7" r="2"/>',
    custom: 'wellspring',
  },
  {
    key: 'audit', label: 'Audit & Initialize',
    icon: '<path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    custom: 'audit',
  },
  {
    key: 'maintenance', label: 'Maintenance',
    icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    custom: 'maintenance',
  },
  {
    key: 'depmap', label: 'Dependencies',
    icon: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    custom: 'depmap',
  },
];

export function render() {
  return /* html */`
    <section class="wall-view">
      ${pageHero({
        title:    'Admin',
        subtitle: 'Church settings, roles, integrations, and configuration.',
        scripture: 'I have set watchmen on your walls, O Jerusalem. — Isaiah 62:6',
      })}

      <div class="wall-layout">
        <!-- Sidebar nav -->
        <nav class="wall-nav">
          ${SECTIONS.map((s, i) => `
            <button class="wall-nav-item${i === 0 ? ' is-active' : ''}" data-wall-section="${s.key}" type="button">
              <svg class="wall-nav-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${s.icon}</svg>
              ${_e(s.label)}
            </button>
          `).join('')}
        </nav>

        <!-- Settings panels -->
        <div class="wall-panels">
          ${SECTIONS.map((s, i) => `
            <div class="wall-panel${i === 0 ? '' : ' wall-panel--hidden'}" data-wall-panel="${s.key}">
              <h2 class="wall-panel-title">${_e(s.label)}</h2>
              ${s.custom === 'audit'         ? _auditPanelMarkup()         :
                s.custom === 'maintenance'   ? _maintenancePanelMarkup()   :
                s.custom === 'depmap'        ? _depMapPanelMarkup()         :
                s.custom === 'wellspring'    ? _wellspringPanelMarkup()    :
                s.custom === 'church'        ? _churchPanelMarkup()        :
                s.custom === 'members'       ? _membersPanelMarkup()       :
                s.custom === 'roles'         ? _rolesPanelMarkup()         :
                s.custom === 'notifications' ? _notifPanelMarkup()         : `
                <div class="wall-settings-list">
                  ${s.settings.map(_settingRow).join('')}
                </div>
                <button class="flock-btn flock-btn--primary wall-save-btn">Save Changes</button>
              `}
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

export function mount(root) {
  const navBtns = root.querySelectorAll('[data-wall-section]');
  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      root.querySelectorAll('[data-wall-panel]').forEach(p => p.classList.add('wall-panel--hidden'));
      const panel = root.querySelector(`[data-wall-panel="${btn.dataset.wallSection}"]`);
      if (panel) panel.classList.remove('wall-panel--hidden');
      if (btn.dataset.wallSection === 'audit') _refreshAudit(root);
    });
  });

  // Toggle switches — exclude the Wellspring mode toggle which has its own dedicated handler
  root.querySelectorAll('.wall-toggle:not(#ws-mode-toggle)').forEach((t) => {
    t.addEventListener('click', () => t.classList.toggle('wall-toggle--on'));
  });

  // Church settings panel — load from Firestore and wire save
  _wireChurchPanel(root);

  // Membership settings panel
  _wireMembersPanel(root);

  // Roles & Access panel
  _wireRolesPanel(root);

  // Notifications panel
  _wireNotifPanel(root);

  // Audit panel wiring
  _wireAuditPanel(root);

  // Wellspring panel wiring
  _wireWellspringPanel(root);

  // Maintenance panel wiring
  _wireMaintenancePanel(root);

  // Dependencies panel wiring
  _wireDepMapPanel(root);

  // JP API panel wiring — load status immediately
  _wireIntegrationsPanel(root);

  // When navigating to integrations, refresh both API statuses
  navBtns.forEach((btn) => {
    if (btn.dataset.wallSection === 'integrations') {
      btn.addEventListener('click', () => {
        _loadJpStatus(root);
        _loadBibleApiStatus(root);
        _loadCheckrStatus(root);
        _pollMissionsSources(root);
      });
    }
    if (btn.dataset.wallSection === 'wellspring') {
      btn.addEventListener('click', () => _refreshWellspringStatus(root));
    }
  });

  return () => {};
}

/* ── Church settings panel ──────────────────────────────────────────────── */

const _CHURCH_FIELDS = [
  { key: 'church_name',     label: 'Church Name',      type: 'text',   placeholder: 'e.g. Grace Fellowship Church' },
  { key: 'church_website',  label: 'Website',          type: 'url',    placeholder: 'https://…' },
  { key: 'church_timezone', label: 'Time Zone',        type: 'tz',     placeholder: 'America/New_York' },
  { key: 'church_gathering',label: 'Weekly Gathering', type: 'text',   placeholder: 'e.g. Sunday, 10:00 AM'  },
  { key: 'church_address',  label: 'Address',          type: 'text',   placeholder: 'Street address'         },
  { key: 'church_phone',    label: 'Phone',            type: 'tel',    placeholder: '+1 (555) 000-0000'      },
  { key: 'church_email',    label: 'Contact Email',    type: 'email',  placeholder: 'info@church.org'        },
  { key: 'church_pastor',        label: 'Lead Pastor',            type: 'text',   placeholder: 'Full name'              },
  { key: 'LEAD_PASTOR_MEMBER_ID', label: 'Lead Pastor Member PIN',  type: 'text',   placeholder: 'e.g. M-00123',
    hint: 'The member PIN of the lead pastor. Used to auto-assign care cases and prayer requests.' },
];

const _TZ_OPTIONS = [
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Phoenix','America/Anchorage','Pacific/Honolulu',
  'America/Toronto','America/Vancouver','America/Mexico_City',
  'Europe/London','Europe/Paris','Europe/Berlin','Europe/Rome',
  'Africa/Lagos','Africa/Nairobi','Africa/Johannesburg',
  'Asia/Jerusalem','Asia/Kolkata','Asia/Singapore','Asia/Tokyo',
  'Australia/Sydney','Pacific/Auckland',
];

function _churchPanelMarkup() {
  return /* html */`
    <div class="wall-church-form" data-bind="church-form">
      <div class="wall-settings-list">
        ${_CHURCH_FIELDS.map(f => {
          if (f.type === 'tz') return `
            <div class="wall-setting-row" style="align-items:center">
              <label class="wall-setting-label" for="church-field-${f.key}">${_e(f.label)}</label>
              <select class="wall-church-input" id="church-field-${f.key}" data-church-key="${f.key}">
                ${_TZ_OPTIONS.map(tz => `<option value="${_e(tz)}">${_e(tz)}</option>`).join('')}
              </select>
            </div>`;
          return `
            <div class="wall-setting-row" style="align-items:${f.hint ? 'flex-start' : 'center'}">
              <label class="wall-setting-label" for="church-field-${f.key}">${_e(f.label)}</label>
              <div style="flex:1;min-width:0">
                <input class="wall-church-input" id="church-field-${f.key}"
                  type="${f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text'}"
                  data-church-key="${f.key}" placeholder="${_e(f.placeholder)}" value="">
                ${f.hint ? `<div class="wall-field-hint">${_e(f.hint)}</div>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>
      <div class="wall-church-status" data-bind="church-status" style="display:none;margin-top:8px;font-size:.85rem"></div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
        <button class="flock-btn flock-btn--primary" data-act="church-save">Save Changes</button>
        <span class="wall-church-saved" data-bind="church-saved" style="display:none;color:var(--success,#16a34a);font-size:.85rem">✓ Saved</span>
      </div>
    </div>`;
}

function _wireChurchPanel(root) {
  const panel = root.querySelector('[data-wall-panel="general"]');
  if (!panel) return;

  // Load stored values from Firestore
  _loadChurchSettings(root);

  // Wire save button
  panel.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-act="church-save"]')) return;
    await _saveChurchSettings(root);
  });
}

async function _loadChurchSettings(root) {
  const form = root.querySelector('[data-bind="church-form"]');
  if (!form) return;

  const UR = await _waitForUpperRoom(10000);
  if (!UR) return; // silently leave inputs blank if backend not ready

  await Promise.all(_CHURCH_FIELDS.map(async (f) => {
    try {
      const cfg = await UR.getAppConfig({ key: f.key });
      const val = cfg?.value || '';
      const el  = form.querySelector(`[data-church-key="${f.key}"]`);
      if (!el || !val) return;
      if (el.tagName === 'SELECT') el.value = val;
      else el.value = val;
    } catch (_) {}
  }));
}

async function _saveChurchSettings(root) {
  const form    = root.querySelector('[data-bind="church-form"]');
  const savedEl = root.querySelector('[data-bind="church-saved"]');
  const btn     = root.querySelector('[data-act="church-save"]');
  if (!form) return;

  const UR = window.UpperRoom;
  if (!UR) { alert('Backend not ready — try again in a moment.'); return; }

  btn.disabled = true; btn.textContent = 'Saving…';
  if (savedEl) savedEl.style.display = 'none';

  try {
    await Promise.all(_CHURCH_FIELDS.map(f => {
      const el  = form.querySelector(`[data-church-key="${f.key}"]`);
      const val = el ? el.value.trim() : '';
      return UR.setAppConfig({ key: f.key, value: val, category: 'church',
        description: f.label });
    }));
    if (savedEl) { savedEl.style.display = ''; setTimeout(() => { savedEl.style.display = 'none'; }, 3000); }
  } catch (err) {
    alert('Could not save: ' + (err?.message || String(err)));
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
}

/* ── Membership settings panel ──────────────────────────────────────────── */

const _MEMBERS_FIELDS = [
  {
    key: 'members_approval', label: 'Member Approval', type: 'select',
    options: ['Pastor Review Required', 'Elder Board Approval', 'Self-Approval (Open)'],
  },
  {
    key: 'members_visitor_autotag', label: 'Visitor Auto-Tag', type: 'toggle',
    hint: 'Automatically tag new sign-ups as Visitor',
  },
  {
    key: 'members_directory', label: 'Directory Visible To', type: 'select',
    options: ['Members Only', 'All Logged-In Users', 'Admins & Leaders Only', 'Hidden'],
  },
  {
    key: 'members_inactive_after', label: 'Mark Inactive After', type: 'select',
    options: ['30 days no attendance', '60 days no attendance', '90 days no attendance',
              '6 months no attendance', '1 year no attendance', 'Never (manual only)'],
  },
];

function _membersPanelMarkup() {
  return _genericAppConfigPanel('members', _MEMBERS_FIELDS);
}

function _wireMembersPanel(root) {
  _wireAppConfigPanel(root, 'members', _MEMBERS_FIELDS);
}

/* ── Roles & Access settings panel ─────────────────────────────────────── */

const _ROLES_FIELDS = [
  { key: 'roles_admin',   label: 'Admin Role',   type: 'text', placeholder: 'e.g. Pastor, Elder Board' },
  { key: 'roles_leader',  label: 'Leader Role',  type: 'text', placeholder: 'e.g. Deacons, Ministry Leaders' },
  { key: 'roles_member',  label: 'Member Role',  type: 'text', placeholder: 'e.g. All confirmed members' },
  { key: 'roles_visitor', label: 'Visitor Role', type: 'text', placeholder: 'e.g. Unapproved accounts' },
];

// Permission matrix — [visitor, member, leader, admin] defaults (1 = on, 0 = off)
const _PERMISSION_CATEGORIES = [
  {
    category: 'Membership',
    perms: [
      { key: 'perm_view_directory',     label: 'View Member Directory',       defaults: [0,1,1,1] },
      { key: 'perm_edit_profiles',      label: 'Edit Member Profiles',        defaults: [0,0,1,1] },
      { key: 'perm_invite_members',     label: 'Invite New Members',          defaults: [0,1,1,1] },
      { key: 'perm_approve_membership', label: 'Approve Membership Requests', defaults: [0,0,0,1] },
    ],
  },
  {
    category: 'Pastoral Care',
    perms: [
      { key: 'perm_view_care',       label: 'View Care Cases',       defaults: [0,0,1,1] },
      { key: 'perm_manage_care',     label: 'Manage Care Cases',     defaults: [0,0,1,1] },
      { key: 'perm_prayer_chain',    label: 'Prayer Chain Access',   defaults: [0,1,1,1] },
      { key: 'perm_compassion',      label: 'Submit Compassion Requests', defaults: [0,1,1,1] },
    ],
  },
  {
    category: 'Content & Announcements',
    perms: [
      { key: 'perm_view_announcements', label: 'View Announcements',           defaults: [1,1,1,1] },
      { key: 'perm_post_announcements', label: 'Post Announcements',           defaults: [0,0,1,1] },
      { key: 'perm_manage_content',     label: 'Manage Devotionals & Content', defaults: [0,0,0,1] },
      { key: 'perm_view_calendar',      label: 'View Church Calendar',         defaults: [1,1,1,1] },
    ],
  },
  {
    category: 'Giving & Stewardship',
    perms: [
      { key: 'perm_view_own_giving', label: 'View Own Giving History',  defaults: [0,1,1,1] },
      { key: 'perm_view_all_giving', label: 'View All Giving Records',  defaults: [0,0,0,1] },
      { key: 'perm_manage_giving',   label: 'Manage Giving Records',    defaults: [0,0,0,1] },
      { key: 'perm_pledge_manage',   label: 'Pledge Management',        defaults: [0,0,1,1] },
    ],
  },
  {
    category: 'Communications',
    perms: [
      { key: 'perm_send_dm',         label: 'Send Direct Messages',    defaults: [0,1,1,1] },
      { key: 'perm_group_messaging', label: 'Group Messaging',         defaults: [0,0,1,1] },
      { key: 'perm_mass_messaging',  label: 'Mass Church Messaging',   defaults: [0,0,0,1] },
    ],
  },
  {
    category: 'Analytics & Admin',
    perms: [
      { key: 'perm_view_analytics',      label: 'View Analytics',             defaults: [0,0,1,1] },
      { key: 'perm_access_admin',        label: 'Access Admin Panel',         defaults: [0,0,0,1] },
      { key: 'perm_manage_roles',        label: 'Manage Roles & Permissions', defaults: [0,0,0,1] },
      { key: 'perm_manage_integrations', label: 'Manage Integrations',        defaults: [0,0,0,1] },
    ],
  },
];

const _ROLE_COLS = [
  { key: 'visitor', label: 'Visitor' },
  { key: 'member',  label: 'Member'  },
  { key: 'leader',  label: 'Leader'  },
  { key: 'admin',   label: 'Admin'   },
];

function _permMatrixMarkup() {
  let html = `
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border)">
      <h3 style="font:600 .95rem var(--font-ui);margin:0 0 4px;color:var(--ink)">Permission Matrix</h3>
      <p style="font:.78rem var(--font-ui);color:var(--ink-muted);margin:0 0 14px">
        Check which capabilities each role can access. Changes apply immediately on save.
      </p>
      <div class="perm-matrix-wrap">
        <table class="perm-matrix">
          <thead>
            <tr>
              <th class="perm-matrix-label-col"></th>
              ${_ROLE_COLS.map(c => `<th class="perm-matrix-col-head">${_e(c.label)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>`;

  for (const cat of _PERMISSION_CATEGORIES) {
    html += `<tr class="perm-matrix-cat"><td colspan="5">${_e(cat.category)}</td></tr>`;
    for (const p of cat.perms) {
      html += `<tr class="perm-matrix-row">
        <td class="perm-matrix-label">${_e(p.label)}</td>`;
      _ROLE_COLS.forEach((col, ri) => {
        const checked = p.defaults[ri] ? ' checked' : '';
        html += `<td class="perm-matrix-cell">
          <input type="checkbox" class="perm-cb" data-perm="${_e(p.key)}" data-role="${_e(col.key)}"${checked}>
        </td>`;
      });
      html += `</tr>`;
    }
  }

  html += `</tbody>
        </table>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
        <button class="flock-btn flock-btn--primary" data-act="perms-save">Save Permissions</button>
        <span data-bind="perms-saved" style="display:none;color:var(--success,#16a34a);font-size:.85rem">✓ Saved</span>
      </div>
    </div>`;
  return html;
}

const _PASTORAL_SLOT_LABELS = [
  'Slot 1 — Lead Pastor',
  'Slot 2 — Timothy',
  'Slot 3 — Pastor / Elder',
  'Slot 4 — Pastor / Elder',
  'Slot 5 — Pastor / Elder',
  'Slot 6 — Pastor / Elder',
  'Slot 7 — Pastor / Elder',
  'Slot 8 — Pastor / Elder',
  'Slot 9 — Pastor / Elder',
  'Slot 10 — Pastor / Elder',
];

function _rolesPanelMarkup() {
  const slotsRows = _PASTORAL_SLOT_LABELS.map((label, i) => `
    <div class="wall-setting-row" style="align-items:center">
      <label class="wall-setting-label">${_e(label)}</label>
      <select class="wall-church-input" data-pastoral-slot="${i}" style="min-width:200px;max-width:280px">
        <option value="">— Unassigned —</option>
      </select>
    </div>`).join('');

  const pastoralSection = `
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border)">
      <h3 style="font:600 .95rem var(--font-ui);margin:0 0 14px;color:var(--ink)">Pastoral Hierarchy</h3>
      <div class="wall-settings-list">${slotsRows}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
        <button class="flock-btn flock-btn--primary" data-act="pastoral-save">Save Pastoral Slots</button>
        <span data-bind="pastoral-saved" style="display:none;color:var(--success,#16a34a);font-size:.85rem">✓ Saved</span>
      </div>
    </div>`;

  return _genericAppConfigPanel('roles', _ROLES_FIELDS) + _permMatrixMarkup() + pastoralSection;
}

function _wireRolesPanel(root) {
  _wireAppConfigPanel(root, 'roles', _ROLES_FIELDS);
  _wirePermMatrix(root);
  _wirePastoralSlots(root);
}

async function _wirePermMatrix(root) {
  const panel = root.querySelector('[data-wall-panel="roles"]');
  if (!panel) return;
  const UR = await _waitForUpperRoom(10000);
  if (!UR) return;

  // Load saved permissions — override defaults if a saved value exists
  try {
    const cfg = await UR.getAppConfig({ key: 'role_permissions' });
    if (cfg?.value) {
      const saved = JSON.parse(cfg.value);
      panel.querySelectorAll('.perm-cb').forEach(cb => {
        const key = `${cb.dataset.perm}::${cb.dataset.role}`;
        if (key in saved) cb.checked = !!saved[key];
      });
    }
  } catch (_) {}

  // Save
  panel.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-act="perms-save"]')) return;
    const btn = e.target.closest('[data-act="perms-save"]');
    btn.disabled = true; btn.textContent = 'Saving…';
    const perms = {};
    panel.querySelectorAll('.perm-cb').forEach(cb => {
      perms[`${cb.dataset.perm}::${cb.dataset.role}`] = cb.checked ? 1 : 0;
    });
    try {
      await UR.setAppConfig({
        key: 'role_permissions',
        value: JSON.stringify(perms),
        category: 'roles',
        description: 'Role Permission Matrix',
      });
      const savedEl = panel.querySelector('[data-bind="perms-saved"]');
      if (savedEl) { savedEl.style.display = ''; setTimeout(() => { savedEl.style.display = 'none'; }, 3000); }
    } catch (err) {
      alert('Could not save: ' + (err?.message || String(err)));
    } finally {
      btn.disabled = false; btn.textContent = 'Save Permissions';
    }
  });
}

async function _wirePastoralSlots(root) {
  const panel = root.querySelector('[data-wall-panel="roles"]');
  if (!panel) return;
  const UR = await _waitForUpperRoom(10000);
  if (!UR) return;

  // Load member list
  let members = [];
  try {
    if (typeof UR.listMembers === 'function') {
      members = (await UR.listMembers({ limit: 500 })) || [];
    }
  } catch (_) {}

  const getName = m => (
    m.preferredName ||
    (((m.firstName || '') + ' ' + (m.lastName || '')).trim()) ||
    m.displayName || m.email || ''
  );
  members = members.slice().sort((a, b) => getName(a).localeCompare(getName(b)));

  // Load saved pastoral slot assignments
  let savedSlots = {};
  try {
    const cfg = await UR.getAppConfig({ key: 'pastoral_slots' });
    if (cfg?.value) savedSlots = JSON.parse(cfg.value);
  } catch (_) {}

  // Populate dropdowns
  panel.querySelectorAll('[data-pastoral-slot]').forEach(sel => {
    const idx = parseInt(sel.dataset.pastoralSlot, 10);
    const savedId = savedSlots[idx]?.memberId || '';
    for (const m of members) {
      const id = m.id || m.uid || m.email || '';
      if (!id) continue;
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = getName(m);
      if (id === savedId) opt.selected = true;
      sel.appendChild(opt);
    }
  });

  // Wire save button
  panel.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-act="pastoral-save"]')) return;
    const btn = e.target.closest('[data-act="pastoral-save"]');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    const slots = {};
    panel.querySelectorAll('[data-pastoral-slot]').forEach(sel => {
      const idx = parseInt(sel.dataset.pastoralSlot, 10);
      const memberId = sel.value;
      const memberName = memberId ? (sel.options[sel.selectedIndex]?.textContent || '') : '';
      slots[idx] = { memberId, memberName };
    });
    try {
      await UR.setAppConfig({
        key: 'pastoral_slots',
        value: JSON.stringify(slots),
        category: 'roles',
        description: 'Pastoral Hierarchy Slots',
      });
      const savedEl = panel.querySelector('[data-bind="pastoral-saved"]');
      if (savedEl) { savedEl.style.display = ''; setTimeout(() => { savedEl.style.display = 'none'; }, 3000); }
    } catch (err) {
      alert('Could not save: ' + (err?.message || String(err)));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Pastoral Slots';
    }
  });
}

/* ── Notifications settings panel ───────────────────────────────────────── */

const _NOTIF_FIELDS = [
  {
    key: 'notif_prayer_request', label: 'New Prayer Request', type: 'multicheck',
    channels: ['Email', 'Push'], recipients: ['Pastors', 'Prayer Team', 'All Leaders'],
    recipientKey: 'notif_prayer_request_to',
  },
  {
    key: 'notif_new_visitor', label: 'New Visitor', type: 'multicheck',
    channels: ['Email', 'Push'], recipients: ['Welcome Team', 'Pastors', 'All Leaders'],
    recipientKey: 'notif_new_visitor_to',
  },
  {
    key: 'notif_urgent_care', label: 'Urgent Care Item', type: 'multicheck',
    channels: ['Email', 'Push'], recipients: ['Assigned Pastor', 'Pastors', 'All Leaders'],
    recipientKey: 'notif_urgent_care_to',
  },
  {
    key: 'notif_care_updates', label: 'Care Case Updates', type: 'select',
    hint: 'How aggressively to notify when a care case status changes',
    options: ['All updates', 'Major changes only', 'Resolved only', 'Off'],
  },
  {
    key: 'notif_weekly_summary', label: 'Weekly Summary', type: 'select',
    options: ['Off', 'Email → Admin (Monday)', 'Email → Admin (Friday)',
              'Email → All Leaders (Monday)', 'Email → All Leaders (Friday)'],
  },
];

function _notifPanelMarkup() {
  let html = '<div class="wall-church-form" data-bind="notif-form"><div class="wall-settings-list">';
  for (const f of _NOTIF_FIELDS) {
    if (f.type === 'multicheck') {
      html += `<div class="wall-setting-row wall-setting-row--col">
        <div class="wall-setting-label">${_e(f.label)}</div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            ${f.channels.map(c => `
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font:.86rem var(--font-ui)">
                <input type="checkbox" data-notif-key="${_e(f.key)}" data-notif-channel="${_e(c)}"
                  style="width:15px;height:15px;cursor:pointer"> ${_e(c)}
              </label>`).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:8px;font:.84rem var(--font-ui)">
            <span style="color:var(--ink-muted)">→</span>
            <select class="wall-church-input" data-notif-key="${_e(f.recipientKey)}" style="min-width:160px;max-width:200px">
              ${f.recipients.map(r => `<option value="${_e(r)}">${_e(r)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>`;
    } else if (f.type === 'select') {
      html += `<div class="wall-setting-row" style="align-items:center">
        <div style="display:flex;flex-direction:column;gap:2px">
          <label class="wall-setting-label">${_e(f.label)}</label>
          ${f.hint ? `<span style="font:.75rem var(--font-ui);color:var(--ink-muted)">${_e(f.hint)}</span>` : ''}
        </div>
        <select class="wall-church-input" data-notif-key="${_e(f.key)}" style="min-width:200px;max-width:280px">
          ${f.options.map(o => `<option value="${_e(o)}">${_e(o)}</option>`).join('')}
        </select>
      </div>`;
    }
  }
  html += `</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
      <button class="flock-btn flock-btn--primary" data-act="notif-save">Save Changes</button>
      <span data-bind="notif-saved" style="display:none;color:var(--success,#16a34a);font-size:.85rem">✓ Saved</span>
    </div>
  </div>`;
  return html;
}

function _wireNotifPanel(root) {
  const panel = root.querySelector('[data-wall-panel="notifications"]');
  if (!panel) return;
  _loadNotifSettings(root);
  panel.addEventListener('click', async (e) => {
    if (e.target.closest('[data-act="notif-save"]')) await _saveNotifSettings(root);
  });
}

async function _loadNotifSettings(root) {
  const form = root.querySelector('[data-bind="notif-form"]');
  if (!form) return;
  const UR = await _waitForUpperRoom(10000);
  if (!UR) return;
  for (const f of _NOTIF_FIELDS) {
    if (f.type === 'multicheck') {
      try {
        const cfg = await UR.getAppConfig({ key: f.key });
        const saved = (cfg?.value || '').split(',').map(s => s.trim());
        form.querySelectorAll(`[data-notif-key="${f.key}"]`).forEach(cb => {
          cb.checked = saved.includes(cb.dataset.notifChannel);
        });
        const recipCfg = await UR.getAppConfig({ key: f.recipientKey });
        const sel = form.querySelector(`[data-notif-key="${f.recipientKey}"]`);
        if (sel && recipCfg?.value) sel.value = recipCfg.value;
      } catch (_) {}
    } else if (f.type === 'select') {
      try {
        const cfg = await UR.getAppConfig({ key: f.key });
        const sel = form.querySelector(`[data-notif-key="${f.key}"]`);
        if (sel && cfg?.value) sel.value = cfg.value;
      } catch (_) {}
    }
  }
}

async function _saveNotifSettings(root) {
  const form    = root.querySelector('[data-bind="notif-form"]');
  const savedEl = root.querySelector('[data-bind="notif-saved"]');
  const btn     = root.querySelector('[data-act="notif-save"]');
  const UR = window.UpperRoom;
  if (!UR) { alert('Backend not ready — try again in a moment.'); return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  if (savedEl) savedEl.style.display = 'none';
  try {
    const writes = [];
    for (const f of _NOTIF_FIELDS) {
      if (f.type === 'multicheck') {
        const checked = [...form.querySelectorAll(`[data-notif-key="${f.key}"]`)]
          .filter(cb => cb.checked).map(cb => cb.dataset.notifChannel).join(', ');
        writes.push(UR.setAppConfig({ key: f.key, value: checked, category: 'notifications', description: f.label }));
        const sel = form.querySelector(`[data-notif-key="${f.recipientKey}"]`);
        if (sel) writes.push(UR.setAppConfig({ key: f.recipientKey, value: sel.value, category: 'notifications', description: f.label + ' recipients' }));
      } else if (f.type === 'select') {
        const sel = form.querySelector(`[data-notif-key="${f.key}"]`);
        if (sel) writes.push(UR.setAppConfig({ key: f.key, value: sel.value, category: 'notifications', description: f.label }));
      }
    }
    await Promise.all(writes);
    if (savedEl) { savedEl.style.display = ''; setTimeout(() => { savedEl.style.display = 'none'; }, 3000); }
  } catch (err) {
    alert('Could not save: ' + (err?.message || String(err)));
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
}

/* ── Generic app-config panel helpers (Membership, Roles) ───────────────── */

function _genericAppConfigPanel(panelKey, fields) {
  let html = `<div class="wall-church-form" data-bind="${panelKey}-form"><div class="wall-settings-list">`;
  for (const f of fields) {
    if (f.type === 'toggle') {
      html += `<div class="wall-setting-row" style="align-items:center">
        <div style="display:flex;flex-direction:column;gap:2px">
          <label class="wall-setting-label">${_e(f.label)}</label>
          ${f.hint ? `<span style="font:.75rem var(--font-ui);color:var(--ink-muted)">${_e(f.hint)}</span>` : ''}
        </div>
        <div class="wall-toggle" data-appconfig-key="${_e(f.key)}" role="switch" tabindex="0">
          <div class="wall-toggle-thumb"></div>
        </div>
      </div>`;
    } else if (f.type === 'select') {
      html += `<div class="wall-setting-row" style="align-items:center">
        <label class="wall-setting-label">${_e(f.label)}</label>
        <select class="wall-church-input" data-appconfig-key="${_e(f.key)}">
          ${f.options.map(o => `<option value="${_e(o)}">${_e(o)}</option>`).join('')}
        </select>
      </div>`;
    } else {
      html += `<div class="wall-setting-row" style="align-items:center">
        <label class="wall-setting-label">${_e(f.label)}</label>
        <input class="wall-church-input" type="text" data-appconfig-key="${_e(f.key)}"
          placeholder="${_e(f.placeholder || '')}" value="">
      </div>`;
    }
  }
  html += `</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
      <button class="flock-btn flock-btn--primary" data-act="${panelKey}-save">Save Changes</button>
      <span data-bind="${panelKey}-saved" style="display:none;color:var(--success,#16a34a);font-size:.85rem">✓ Saved</span>
    </div>
  </div>`;
  return html;
}

function _wireAppConfigPanel(root, panelKey, fields) {
  const panel = root.querySelector(`[data-wall-panel="${panelKey}"]`);
  if (!panel) return;

  // Wire toggles
  panel.querySelectorAll('.wall-toggle[data-appconfig-key]').forEach(t => {
    t.addEventListener('click', () => t.classList.toggle('wall-toggle--on'));
    t.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') t.classList.toggle('wall-toggle--on'); });
  });

  // Load values
  _loadAppConfigPanel(root, panelKey, fields);

  // Save
  panel.addEventListener('click', async (e) => {
    if (e.target.closest(`[data-act="${panelKey}-save"]`)) await _saveAppConfigPanel(root, panelKey, fields);
  });
}

async function _loadAppConfigPanel(root, panelKey, fields) {
  const panelEl = root.querySelector(`[data-wall-panel="${panelKey}"]`);
  if (!panelEl) return;
  const UR = await _waitForUpperRoom(10000);
  if (!UR) return;
  for (const f of fields) {
    try {
      const cfg = await UR.getAppConfig({ key: f.key });
      const val = cfg?.value || '';
      if (!val) continue;
      const el = panelEl.querySelector(`[data-appconfig-key="${f.key}"]`);
      if (!el) continue;
      if (f.type === 'toggle') {
        if (val === 'true' || val === '1' || val.toLowerCase() === 'enabled') {
          el.classList.add('wall-toggle--on');
        }
      } else if (el.tagName === 'SELECT') {
        el.value = val;
      } else {
        el.value = val;
      }
    } catch (_) {}
  }
}

async function _saveAppConfigPanel(root, panelKey, fields) {
  const panelEl = root.querySelector(`[data-wall-panel="${panelKey}"]`);
  const savedEl = root.querySelector(`[data-bind="${panelKey}-saved"]`);
  const btn     = root.querySelector(`[data-act="${panelKey}-save"]`);
  const UR = window.UpperRoom;
  if (!UR) { alert('Backend not ready — try again in a moment.'); return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  if (savedEl) savedEl.style.display = 'none';
  try {
    await Promise.all(fields.map(f => {
      const el = panelEl.querySelector(`[data-appconfig-key="${f.key}"]`);
      let val = '';
      if (f.type === 'toggle') val = el?.classList.contains('wall-toggle--on') ? 'enabled' : 'disabled';
      else val = el?.value?.trim() || '';
      return UR.setAppConfig({ key: f.key, value: val, category: panelKey, description: f.label });
    }));
    if (savedEl) { savedEl.style.display = ''; setTimeout(() => { savedEl.style.display = 'none'; }, 3000); }
  } catch (err) {
    alert('Could not save: ' + (err?.message || String(err)));
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
}

/* ── Joshua Project API integration ────────────────────────────────────── */

const JP_API_BASE = 'https://api.joshuaproject.net/v1';
const JP_CONFIG_KEY = 'jp_api_key';
const BIBLE_API_BASE   = 'https://rest.api.bible/v1';
const BIBLE_CONFIG_KEY = 'bible_api_key';

function _wireIntegrationsPanel(root) {
  const panel = root.querySelector('[data-wall-panel="integrations"]');
  if (!panel) return;
  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'jp-save-test') {
      const input = panel.querySelector('[data-bind="jp-key-input"]');
      const key = input?.value.trim();
      if (key) await _saveAndTestJpKey(root, key);
    }
    if (btn.dataset.act === 'bible-save-test') {
      const input = panel.querySelector('[data-bind="bible-key-input"]');
      const key = input?.value.trim();
      if (key) await _saveAndTestBibleApiKey(root, key);
    }
    if (btn.dataset.act === 'checkr-save') {
      const input = panel.querySelector('[data-bind="checkr-key-input"]');
      const key = input?.value.trim();
      if (key) await _saveCheckrKey(root, key);
    }
    if (btn.dataset.act === 'vapid-save') {
      const input = panel.querySelector('[data-bind="vapid-key-input"]');
      const key = input?.value.trim();
      if (key) await _saveVapidKey(root, key);
    }
  });
  // Load saved key statuses on first render
  _loadJpStatus(root);
  _loadBibleApiStatus(root);
  _loadVapidStatus(root);
  _loadCheckrStatus(root);
  _pollMissionsSources(root);
}

/* ── Push Notifications / VAPID key ─────────────────────────────────────── */

async function _loadVapidStatus(root) {
  const badge = root.querySelector('[data-bind="vapid-status"]');
  const input = root.querySelector('[data-bind="vapid-key-input"]');
  if (!badge) return;
  _setVapidBadge(badge, 'checking');
  try {
    const snap = await firebase.firestore().collection('settings').doc('notifications').get();
    const key  = (snap.exists && snap.data()?.vapidKey) || '';
    if (key) {
      if (input) input.placeholder = '••••••••  (key saved — paste new to replace)';
      _setVapidBadge(badge, 'ok');
    } else {
      _setVapidBadge(badge, 'not-set');
    }
  } catch (err) {
    console.warn('[wall/vapid] load failed', err);
    _setVapidBadge(badge, 'not-set');
  }
}

async function _saveVapidKey(root, key) {
  const badge = root.querySelector('[data-bind="vapid-status"]');
  const input = root.querySelector('[data-bind="vapid-key-input"]');
  if (!badge) return;
  _setVapidBadge(badge, 'saving');
  try {
    await firebase.firestore().collection('settings').doc('notifications')
      .set({ vapidKey: key }, { merge: true });
    if (input) {
      input.value = '';
      input.placeholder = '••••••••  (key saved — paste new to replace)';
    }
    _setVapidBadge(badge, 'ok');
  } catch (err) {
    console.warn('[wall/vapid] save failed', err);
    _setVapidBadge(badge, 'save-error');
  }
}

function _setVapidBadge(badge, state) {
  const map = {
    checking:     { status: 'muted', text: 'Checking…'     },
    saving:       { status: 'muted', text: 'Saving…'       },
    ok:           { status: 'ok',    text: 'Key set'        },
    'not-set':    { status: 'warn',  text: 'Not configured' },
    'save-error': { status: 'warn',  text: 'Save failed'   },
  };
  const { status, text } = map[state] || map['not-set'];
  badge.className = `wall-status-badge wall-status--${status}`;
  badge.textContent = text;
}

/* ── Checkr API key ─────────────────────────────────────────────────────── */

const CHECKR_CONFIG_KEY = 'checkr_api_key';

async function _loadCheckrStatus(root) {
  const badge = root.querySelector('[data-bind="checkr-status"]');
  const input = root.querySelector('[data-bind="checkr-key-input"]');
  if (!badge) return;
  _setCheckrBadge(badge, 'checking');
  const UR = await _waitForUpperRoom(10000);
  if (!UR) { _setCheckrBadge(badge, 'not-set'); return; }
  try {
    const cfg = await UR.getAppConfig({ key: CHECKR_CONFIG_KEY });
    if (cfg && cfg.value) {
      if (input) input.placeholder = '••••••••  (key saved — paste new to replace)';
      _setCheckrBadge(badge, 'ok');
    } else {
      _setCheckrBadge(badge, 'not-set');
    }
  } catch (err) {
    console.warn('[wall/checkr] load failed', err);
    _setCheckrBadge(badge, 'not-set');
  }
}

async function _saveCheckrKey(root, key) {
  const badge = root.querySelector('[data-bind="checkr-status"]');
  const input = root.querySelector('[data-bind="checkr-key-input"]');
  if (!badge) return;
  _setCheckrBadge(badge, 'saving');
  const UR = await _waitForUpperRoom(10000);
  if (!UR) { _setCheckrBadge(badge, 'not-set'); return; }
  try {
    await UR.setAppConfig({ key: CHECKR_CONFIG_KEY, value: key, category: 'integrations',
      description: 'Checkr Secret API key — api.checkr.com' });
    if (input) {
      input.value = '';
      input.placeholder = '••••••••  (key saved — paste new to replace)';
    }
    _setCheckrBadge(badge, 'ok');
  } catch (err) {
    console.warn('[wall/checkr] save failed', err);
    _setCheckrBadge(badge, 'save-error');
  }
}

function _setCheckrBadge(badge, state) {
  const map = {
    checking:     { status: 'muted', text: 'Checking…'     },
    saving:       { status: 'muted', text: 'Saving…'       },
    ok:           { status: 'ok',    text: 'Key saved'      },
    'not-set':    { status: 'warn',  text: 'Not configured' },
    'save-error': { status: 'error', text: 'Save failed'    },
  };
  const { status, text } = map[state] || map['not-set'];
  badge.className = `wall-status-badge wall-status--${status}`;
  badge.textContent = text;
}

async function _loadJpStatus(root) {
  const badge  = root.querySelector('[data-bind="jp-status"]');
  const input  = root.querySelector('[data-bind="jp-key-input"]');
  if (!badge) return;

  _setJpBadge(badge, 'checking');

  const UR = await _waitForUpperRoom(10000);
  if (!UR) { _setJpBadge(badge, 'no-backend'); return; }

  let storedKey = '';
  try {
    const cfg = await UR.getAppConfig({ key: JP_CONFIG_KEY });
    storedKey = cfg.value || '';
  } catch (_) { /* Firestore not ready */ }

  if (!storedKey) {
    _setJpBadge(badge, 'not-set');
    return;
  }

  // Mask the input so it's clear a key is saved without exposing it
  if (input) input.placeholder = '••••••••  (key saved — paste new to replace)';

  _setJpBadge(badge, 'testing');
  const ok = await _testJpApiKey(storedKey);
  _setJpBadge(badge, ok ? 'ok' : 'invalid');
}

async function _saveAndTestJpKey(root, key) {
  const badge = root.querySelector('[data-bind="jp-status"]');
  const input = root.querySelector('[data-bind="jp-key-input"]');
  if (!badge) return;

  _setJpBadge(badge, 'testing');

  const ok = await _testJpApiKey(key);
  if (!ok) { _setJpBadge(badge, 'invalid'); return; }

  const UR = window.UpperRoom;
  if (UR && UR.setAppConfig) {
    try {
      await UR.setAppConfig({ key: JP_CONFIG_KEY, value: key, category: 'integrations',
        description: 'Joshua Project API key — api.joshuaproject.net' });
    } catch (err) {
      _setJpBadge(badge, 'save-error');
      return;
    }
  }

  if (input) {
    input.value = '';
    input.placeholder = '••••••••  (key saved — paste new to replace)';
  }
  _setJpBadge(badge, 'ok');
}

async function _testJpApiKey(key) {
  try {
    const url = `${JP_API_BASE}/people_groups/daily_unreached.json?api_key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch (_) {
    return false;
  }
}

function _setJpBadge(badge, state) {
  const map = {
    checking:   { status: 'muted', text: 'Checking…'        },
    testing:    { status: 'muted', text: 'Testing…'         },
    ok:         { status: 'ok',   text: 'Connected'         },
    invalid:    { status: 'warn', text: 'Invalid key'       },
    'not-set':  { status: 'warn', text: 'Not connected'     },
    'no-backend': { status: 'warn', text: 'Backend offline' },
    'save-error': { status: 'warn', text: 'Save failed'     },
  };
  const { status, text } = map[state] || map['not-set'];
  badge.className = `wall-status-badge wall-status--${status}`;
  badge.textContent = text;
}

/* ── api.bible integration ──────────────────────────────────────────────── */

async function _loadBibleApiStatus(root) {
  const badge = root.querySelector('[data-bind="bible-status"]');
  const input = root.querySelector('[data-bind="bible-key-input"]');
  if (!badge) return;

  _setBibleBadge(badge, 'checking');

  const UR = await _waitForUpperRoom(10000);
  if (!UR) { _setBibleBadge(badge, 'no-backend'); return; }

  let storedKey = '';
  try {
    const cfg = await UR.getAppConfig({ key: BIBLE_CONFIG_KEY });
    storedKey = cfg.value || '';
  } catch (_) {}

  if (!storedKey) { _setBibleBadge(badge, 'not-set'); return; }

  if (input) input.placeholder = '••••••••  (key saved — paste new to replace)';

  _setBibleBadge(badge, 'testing');
  const ok = await _testBibleApiKey(storedKey);
  _setBibleBadge(badge, ok ? 'ok' : 'invalid');
}

async function _saveAndTestBibleApiKey(root, key) {
  const badge = root.querySelector('[data-bind="bible-status"]');
  const input = root.querySelector('[data-bind="bible-key-input"]');
  if (!badge) return;

  _setBibleBadge(badge, 'testing');
  const ok = await _testBibleApiKey(key);
  if (!ok) { _setBibleBadge(badge, 'invalid'); return; }

  const UR = window.UpperRoom;
  if (UR && UR.setAppConfig) {
    try {
      await UR.setAppConfig({ key: BIBLE_CONFIG_KEY, value: key, category: 'integrations',
        description: 'api.bible key — scripture.api.bible' });
    } catch (_) { _setBibleBadge(badge, 'save-error'); return; }
  }

  if (input) {
    input.value = '';
    input.placeholder = '••••••••  (key saved — paste new to replace)';
  }
  _setBibleBadge(badge, 'ok');
}

async function _testBibleApiKey(key) {
  try {
    const res = await fetch(`${BIBLE_API_BASE}/bibles`, {
      headers: { 'api-key': key },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data?.data) && data.data.length > 0;
  } catch (_) { return false; }
}

function _setBibleBadge(badge, state) {
  const map = {
    checking:     { status: 'muted', text: 'Checking…'        },
    testing:      { status: 'muted', text: 'Testing…'         },
    ok:           { status: 'ok',    text: 'Connected'         },
    invalid:      { status: 'warn',  text: 'Invalid key'       },
    'not-set':    { status: 'warn',  text: 'Not connected'     },
    'no-backend': { status: 'warn',  text: 'Backend offline'   },
    'save-error': { status: 'warn',  text: 'Save failed'       },
  };
  const { status, text } = map[state] || map['not-set'];
  badge.className = `wall-status-badge wall-status--${status}`;
  badge.textContent = text;
}

/* ── Missions sources polling ─────────────────────────────────────────────── */

const _MISSIONS_SOURCES = [
  { id: 'ms-src-flock', url: 'https://www.yhwh.one' },
  { id: 'ms-src-jp',  url: 'https://joshuaproject.net' },
  { id: 'ms-src-od',  url: 'https://www.opendoorsusa.org' },
  { id: 'ms-src-ow',  url: 'https://operationworld.org' },
  { id: 'ms-src-vom', url: 'https://www.persecution.com' },
  { id: 'ms-src-bal', url: 'https://bibleaccesslist.org' },
  { id: 'ms-src-ftt', url: 'https://finishingthetask.com' },
  { id: 'ms-src-afb', url: 'https://afghanbibles.net' },
];

// Poll each missions data source via a no-cors GET request.
// A network-level response (even opaque) means the server is reachable.
// Some servers block HEAD requests (returning 405/connection drop), so we use
// GET + no-cors — the browser receives an opaque response on any HTTP reply,
// only throwing on true network failures (DNS error, timeout, SSL error).
async function _pingSource(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    return true; // opaque response still means server answered
  } catch (_) {
    return false;
  }
}

function _pollMissionsSources(root) {
  _MISSIONS_SOURCES.forEach(async ({ id, url }) => {
    const badge = root.querySelector(`[data-bind="ms-src-badge-${id}"]`);
    if (!badge) return;
    badge.className = 'wall-status-badge wall-status--muted';
    badge.textContent = 'Checking…';
    const live = await _pingSource(url);
    badge.className = `wall-status-badge wall-status--${live ? 'ok' : 'warn'}`;
    badge.textContent = live ? 'Connected' : 'Unreachable';
  });
}

/* ── The Wellspring panel ───────────────────────────────────────────────────
   Local offline data engine. Loads a .xlsx church database into IndexedDB,
   then routes TheVine API calls through a local resolver — zero connectivity
   required. AES-GCM 256-bit PIN vault for offline credential storage.      */

function _wellspringPanelMarkup() {
  return /* html */`
    <p style="margin:0 0 18px;color:var(--ink-muted,#7a7f96);font-size:.9rem;line-height:1.7">
      The Wellspring lets FlockOS run <strong>completely offline</strong> from a single
      <code>.xlsx</code> file — no internet required. The file is imported into the browser's
      local IndexedDB and all data calls are routed through the local resolver.
      Credentials are stored in a <strong>256-bit AES-GCM PIN vault</strong> (PBKDF2, 100 000 iterations).
    </p>

    <!-- Status card -->
    <div class="wall-ws-status-card" data-bind="ws-status-card" style="
        display:flex;align-items:flex-start;gap:16px;
        background:var(--bg-raised,#fff);border:1px solid var(--line,#e5e7ef);
        border-radius:12px;padding:18px 20px;margin-bottom:20px">
      <div style="font-size:2rem;line-height:1;flex-shrink:0">💧</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
          <span style="font-weight:700;font-size:1rem;color:var(--ink,#1b264f)">Wellspring Status</span>
          <span class="wall-status-badge wall-status--muted" data-bind="ws-mode-badge">Checking…</span>
        </div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 14px;font-size:.84rem;color:var(--ink-muted,#7a7f96)">
          <span>File loaded:</span>   <span data-bind="ws-file-name" style="color:var(--ink,#1b264f);font-weight:500">—</span>
          <span>Tabs loaded:</span>   <span data-bind="ws-tabs">—</span>
          <span>Total rows:</span>    <span data-bind="ws-rows">—</span>
          <span>Vault:</span>         <span data-bind="ws-vault-status">—</span>
        </div>
      </div>
    </div>

    <!-- Mode toggle row -->
    <div class="wall-setting-row" style="align-items:center;margin-bottom:20px">
      <div style="display:flex;flex-direction:column;gap:3px">
        <label class="wall-setting-label" style="font-weight:700">Offline Mode</label>
        <span style="font-size:.78rem;color:var(--ink-muted,#7a7f96)">
          Route all TheVine API calls through local IndexedDB instead of cloud back-end.
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="wall-toggle" id="ws-mode-toggle" role="switch" tabindex="0" aria-label="Enable Wellspring offline mode">
          <div class="wall-toggle-thumb"></div>
        </div>
        <span data-bind="ws-toggle-label" style="font-size:.84rem;color:var(--ink-muted,#7a7f96)">Off</span>
      </div>
    </div>

    <!-- File import -->
    <div style="margin-bottom:20px">
      <div style="font-weight:600;color:var(--ink,#1b264f);margin-bottom:6px;font-size:.92rem">
        Load Church Database (.xlsx or .json)
      </div>
      <p style="font-size:.82rem;color:var(--ink-muted,#7a7f96);margin:0 0 10px;line-height:1.6">
        Export the complete FlockOS spreadsheet (all 200 tabs) from your Google Sheet, then load it here.
        You can also load a FlockOS-Firestore-JSON-v1 export file.
        The file is stored locally in IndexedDB — it never leaves the device.
      </p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label class="flock-btn flock-btn--ghost" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
          📂 Choose File
          <input type="file" accept=".xls,.xlsx,.json" id="ws-file-input" style="display:none">
        </label>
        <span data-bind="ws-import-status" style="font-size:.84rem;color:var(--ink-muted,#7a7f96)"></span>
      </div>
      <div class="wall-ws-progress" data-bind="ws-progress" style="display:none;margin-top:10px">
        <div style="height:4px;border-radius:2px;background:var(--line,#e5e7ef);overflow:hidden">
          <div data-bind="ws-progress-bar" style="height:100%;background:#38bdf8;border-radius:2px;width:0%;transition:width .3s ease"></div>
        </div>
        <div data-bind="ws-progress-label" style="font-size:.78rem;color:var(--ink-muted,#7a7f96);margin-top:4px">Importing…</div>
      </div>
    </div>

    <!-- PIN Vault section -->
    <div style="background:var(--bg-raised,#fff);border:1px solid var(--line,#e5e7ef);border-radius:12px;padding:18px 20px;margin-bottom:20px">
      <div style="font-weight:700;color:var(--ink,#1b264f);margin-bottom:4px;display:flex;align-items:center;gap:8px">
        🔐 Offline PIN Vault
        <span class="wall-status-badge wall-status--muted" data-bind="ws-vault-badge">Checking…</span>
      </div>
      <p style="font-size:.82rem;color:var(--ink-muted,#7a7f96);margin:0 0 12px;line-height:1.65">
        Store your login credentials encrypted in IndexedDB for fully offline access.
        Your PIN is never stored — it's used to derive an AES-256 key via PBKDF2.
        On the next visit without internet, enter your PIN to restore the session.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="display:flex;gap:6px;align-items:center">
          <input type="password" id="ws-pin-input" placeholder="Enter 6+ digit PIN"
            autocomplete="new-password" style="font-size:.85rem;padding:6px 10px;
            border:1px solid var(--line,#e5e7ef);border-radius:8px;width:180px;
            background:var(--bg-raised,#fff);color:var(--ink,#1b264f)">
          <button class="flock-btn flock-btn--primary flock-btn--sm" data-act="ws-vault-setup">Set PIN</button>
        </div>
        <button class="flock-btn flock-btn--ghost flock-btn--sm" data-act="ws-vault-test">
          Test Unlock
        </button>
        <button class="flock-btn flock-btn--ghost flock-btn--sm" data-act="ws-vault-destroy"
          style="color:#b91c1c;border-color:#fca5a5">
          Destroy Vault
        </button>
      </div>
      <div data-bind="ws-vault-msg" style="margin-top:8px;font-size:.82rem;min-height:1.2em"></div>
    </div>

    <!-- Export & Clear -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="flock-btn flock-btn--ghost" data-act="ws-export">
        ⬇ Export Database (.xlsx)
      </button>
      <button class="flock-btn flock-btn--ghost" data-act="ws-clear"
        style="color:#b91c1c;border-color:#fca5a5">
        🗑 Clear Local Data
      </button>
      <button class="flock-btn flock-btn--ghost flock-btn--sm" data-act="ws-refresh">
        ↻ Refresh Status
      </button>
    </div>
    <div data-bind="ws-action-msg" style="margin-top:10px;font-size:.84rem;min-height:1.2em"></div>

    <div style="margin-top:24px;padding:14px 16px;background:rgba(56,189,248,.06);
        border:1px solid rgba(56,189,248,.2);border-radius:10px">
      <div style="font-size:.78rem;color:var(--ink-muted,#7a7f96);line-height:1.75">
        <strong style="color:var(--ink,#1b264f)">John 4:14</strong> —
        <em>"Whoever drinks the water I give them will never thirst. Indeed, the water I give them will
        become in them a spring of water welling up to eternal life."</em>
      </div>
    </div>
  `;
}

function _wireWellspringPanel(root) {
  const panel = root.querySelector('[data-wall-panel="wellspring"]');
  if (!panel) return;

  // Load initial status
  _refreshWellspringStatus(root);

  // Mode toggle
  const toggle = panel.querySelector('#ws-mode-toggle');
  if (toggle) {
    toggle.addEventListener('click',  () => _toggleWellspring(root, toggle));
    toggle.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') _toggleWellspring(root, toggle); });
  }

  // File import
  const fileInput = panel.querySelector('#ws-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) await _importWellspringFile(root, file);
      fileInput.value = ''; // reset so same file can be reloaded
    });
  }

  // Vault + action buttons
  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'ws-vault-setup')   return _vaultSetup(root);
    if (act === 'ws-vault-test')    return _vaultTest(root);
    if (act === 'ws-vault-destroy') return _vaultDestroy(root, btn);
    if (act === 'ws-export')        return _wellspringExport(root, btn);
    if (act === 'ws-clear')         return _wellspringClear(root, btn);
    if (act === 'ws-refresh')       return _refreshWellspringStatus(root);
  });
}

function _getWS() { return window.TheWellspring || null; }

// SheetJS is not bundled in the main app shell (heavy library, rarely needed).
// We lazy-load it from CDN the first time import or export is triggered.
let _sheetJsPromise = null;
function _ensureSheetJS() {
  if (typeof XLSX !== 'undefined') return Promise.resolve();
  if (_sheetJsPromise) return _sheetJsPromise;
  _sheetJsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
    s.onload  = () => resolve();
    s.onerror = () => { _sheetJsPromise = null; reject(new Error('Could not load SheetJS. Check internet connection.')); };
    document.head.appendChild(s);
  });
  return _sheetJsPromise;
}

async function _refreshWellspringStatus(root) {
  const panel = root.querySelector('[data-wall-panel="wellspring"]');
  if (!panel) return;

  const WS = _getWS();
  const modeBadge  = panel.querySelector('[data-bind="ws-mode-badge"]');
  const fileName   = panel.querySelector('[data-bind="ws-file-name"]');
  const tabs       = panel.querySelector('[data-bind="ws-tabs"]');
  const rows       = panel.querySelector('[data-bind="ws-rows"]');
  const vaultStat  = panel.querySelector('[data-bind="ws-vault-status"]');
  const vaultBadge = panel.querySelector('[data-bind="ws-vault-badge"]');
  const toggle     = panel.querySelector('#ws-mode-toggle');
  const toggleLbl  = panel.querySelector('[data-bind="ws-toggle-label"]');

  if (!WS) {
    if (modeBadge) { modeBadge.className = 'wall-status-badge wall-status--warn'; modeBadge.textContent = 'Not loaded'; }
    return;
  }

  try {
    const st = await WS.status();
    const active = !!st.active;
    const loaded = !!st.loaded;

    if (modeBadge) {
      modeBadge.className = `wall-status-badge wall-status--${active ? 'ok' : loaded ? 'muted' : 'warn'}`;
      modeBadge.textContent = active ? 'Offline Mode ON' : loaded ? 'Data loaded — standby' : 'No data loaded';
    }
    if (toggle) {
      toggle.classList.toggle('wall-toggle--on', active);
      toggle.setAttribute('aria-checked', String(active));
    }
    if (toggleLbl) toggleLbl.textContent = active ? 'On' : 'Off';
    if (fileName) fileName.textContent = st.fileName || '—';
    if (tabs)     tabs.textContent = st.tabCount != null ? st.tabCount : '—';
    if (rows)     rows.textContent = st.totalRows != null ? st.totalRows.toLocaleString() : '—';

    // Vault
    const vaultExists = WS.vault && await WS.vault.exists();
    const vaultTxt = vaultExists ? '🔐 Set up (encrypted)' : '⚠ Not configured';
    if (vaultStat)  vaultStat.textContent  = vaultTxt;
    if (vaultBadge) {
      vaultBadge.className = `wall-status-badge wall-status--${vaultExists ? 'ok' : 'warn'}`;
      vaultBadge.textContent = vaultExists ? 'Vault active' : 'No vault';
    }
  } catch (err) {
    if (modeBadge) { modeBadge.className = 'wall-status-badge wall-status--warn'; modeBadge.textContent = 'Error'; }
    console.error('[wall/wellspring] status error', err);
  }
}

async function _toggleWellspring(root, toggle) {
  const WS = _getWS();
  if (!WS) return;
  const isOn = toggle.classList.contains('wall-toggle--on');
  const lbl = root.querySelector('[data-bind="ws-toggle-label"]');
  try {
    if (isOn) {
      await WS.disable();
    } else {
      await WS.enable();
    }
    await _refreshWellspringStatus(root);
  } catch (err) {
    const msg = root.querySelector('[data-bind="ws-action-msg"]');
    if (msg) { msg.textContent = 'Error: ' + (err?.message || String(err)); msg.style.color = '#b91c1c'; }
  }
}

async function _importWellspringFile(root, file) {
  const WS = _getWS();
  const statusEl   = root.querySelector('[data-bind="ws-import-status"]');
  const progressWr = root.querySelector('[data-bind="ws-progress"]');
  const progressBr = root.querySelector('[data-bind="ws-progress-bar"]');
  const progressLb = root.querySelector('[data-bind="ws-progress-label"]');

  const setStatus = (msg, color = 'var(--ink-muted,#7a7f96)') => {
    if (statusEl) { statusEl.textContent = msg; statusEl.style.color = color; }
  };
  const setProgress = (pct, label) => {
    if (progressWr) progressWr.style.display = '';
    if (progressBr) progressBr.style.width = pct + '%';
    if (progressLb) progressLb.textContent = label;
  };

  if (!WS) { setStatus('Wellspring not available.', '#b91c1c'); return; }

  const isJson = file.name.toLowerCase().endsWith('.json');

  if (!isJson) {
    setStatus('Loading spreadsheet library…');
    setProgress(0, 'Loading SheetJS…');
    try {
      await _ensureSheetJS();
    } catch (err) {
      setStatus('Could not load parser: ' + (err?.message || String(err)), '#b91c1c');
      if (progressWr) progressWr.style.display = 'none';
      return;
    }
  }

  setStatus('Importing… this may take a moment for large files.');
  setProgress(isJson ? 5 : 10, isJson ? 'Parsing JSON…' : 'Parsing spreadsheet…');
  try {
    await (isJson ? WS.loadJson(file) : WS.load(file));
    setProgress(100, 'Import complete.');
    setStatus(`✓ Imported "${file.name}" successfully.`, '#16a34a');
    if (progressWr) setTimeout(() => { progressWr.style.display = 'none'; }, 2500);
    await _refreshWellspringStatus(root);
  } catch (err) {
    setStatus('Import failed: ' + (err?.message || String(err)), '#b91c1c');
    if (progressWr) progressWr.style.display = 'none';
  }
}

async function _vaultSetup(root) {
  const WS = _getWS();
  const pinEl = root.querySelector('#ws-pin-input');
  const msg   = root.querySelector('[data-bind="ws-vault-msg"]');
  const pin   = pinEl?.value?.trim() || '';
  const setMsg = (text, color) => { if (msg) { msg.textContent = text; msg.style.color = color || 'var(--ink-muted,#7a7f96)'; } };

  if (!WS) return setMsg('Wellspring not available.', '#b91c1c');
  if (!pin || pin.length < 6) return setMsg('PIN must be at least 6 characters.', '#b91c1c');

  const UR = window.UpperRoom;
  const session = UR ? { email: (typeof UR.userEmail === 'function' ? UR.userEmail() : '') || '', role: 'admin', source: 'FlockOS' } : { role: 'admin', source: 'FlockOS' };

  try {
    setMsg('Encrypting vault…');
    await WS.vault.setup(pin, session);
    if (pinEl) pinEl.value = '';
    setMsg('✓ Vault created. Your PIN was used to encrypt credentials — it is never stored.', '#16a34a');
    await _refreshWellspringStatus(root);
  } catch (err) {
    setMsg('Vault setup failed: ' + (err?.message || String(err)), '#b91c1c');
  }
}

async function _vaultTest(root) {
  const WS = _getWS();
  const pinEl = root.querySelector('#ws-pin-input');
  const msg   = root.querySelector('[data-bind="ws-vault-msg"]');
  const pin   = pinEl?.value?.trim() || '';
  const setMsg = (text, color) => { if (msg) { msg.textContent = text; msg.style.color = color || 'var(--ink-muted,#7a7f96)'; } };

  if (!WS) return setMsg('Wellspring not available.', '#b91c1c');
  if (!pin) return setMsg('Enter your PIN first.', '#b91c1c');

  try {
    setMsg('Unlocking…');
    const session = await WS.vault.unlock(pin);
    if (pinEl) pinEl.value = '';
    setMsg(`✓ Vault unlocked. Session: ${_e(session.email || session.role || 'OK')}`, '#16a34a');
  } catch (err) {
    if (pinEl) pinEl.value = '';
    setMsg('Unlock failed: ' + (err?.message || String(err)), '#b91c1c');
  }
}

async function _vaultDestroy(root, btn) {
  if (!confirm('Destroy the offline PIN vault?\n\nYou will not be able to log in offline until you set up the vault again. Proceed?')) return;
  const WS = _getWS();
  const msg = root.querySelector('[data-bind="ws-vault-msg"]');
  const setMsg = (text, color) => { if (msg) { msg.textContent = text; msg.style.color = color || 'var(--ink-muted,#7a7f96)'; } };

  if (!WS) return setMsg('Wellspring not available.', '#b91c1c');

  btn.disabled = true;
  try {
    await WS.vault.destroy();
    setMsg('Vault destroyed.', '#b45309');
    await _refreshWellspringStatus(root);
  } catch (err) {
    setMsg('Failed: ' + (err?.message || String(err)), '#b91c1c');
  } finally {
    btn.disabled = false;
  }
}

async function _wellspringExport(root, btn) {
  const WS = _getWS();
  const msg = root.querySelector('[data-bind="ws-action-msg"]');
  const setMsg = (text, color) => { if (msg) { msg.textContent = text; msg.style.color = color || 'var(--ink-muted,#7a7f96)'; } };

  if (!WS) return setMsg('Wellspring not available.', '#b91c1c');

  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Loading…';
  setMsg('');

  try {
    await _ensureSheetJS();
  } catch (err) {
    setMsg('Could not load export library: ' + (err?.message || String(err)), '#b91c1c');
    btn.disabled = false; btn.textContent = orig;
    return;
  }

  btn.textContent = 'Exporting…';
  try {
    await WS.exportDB();
    setMsg('✓ Export downloaded.', '#16a34a');
  } catch (err) {
    setMsg('Export failed: ' + (err?.message || String(err)), '#b91c1c');
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

async function _wellspringClear(root, btn) {
  if (!confirm('Clear ALL local Wellspring data?\n\nThis removes the imported spreadsheet from IndexedDB. The PIN vault is NOT affected.\n\nProceed?')) return;
  const WS = _getWS();
  const msg = root.querySelector('[data-bind="ws-action-msg"]');
  const setMsg = (text, color) => { if (msg) { msg.textContent = text; msg.style.color = color || 'var(--ink-muted,#7a7f96)'; } };

  if (!WS) return setMsg('Wellspring not available.', '#b91c1c');

  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Clearing…';

  try {
    await WS.clearAll();
    await WS.disable();
    setMsg('Local data cleared and offline mode turned off.', '#b45309');
    await _refreshWellspringStatus(root);
  } catch (err) {
    setMsg('Clear failed: ' + (err?.message || String(err)), '#b91c1c');
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

/* ── Audit panel ────────────────────────────────────────────────────────── */
function _auditPanelMarkup() {
  return /* html */`
    <p class="wall-audit-intro" style="margin:0 0 14px;color:var(--ink-muted,#7a7f96);font-size:.9rem">
      Scans the live backend for well-known channels and collections this app expects.
      Anything missing can be created with one click — no manual Firestore work required.
    </p>
    <div class="wall-audit-actions" style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <button class="flock-btn flock-btn--ghost" data-act="audit-refresh" type="button">Re-scan</button>
      <button class="flock-btn flock-btn--primary" data-act="audit-init-all" type="button">Initialize all missing</button>
    </div>
    <div class="wall-audit-actions" style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <button class="flock-btn flock-btn--ghost" data-act="audit-export-xlsx" type="button">⬇ Export .xlsx</button>
      <button class="flock-btn flock-btn--ghost" data-act="audit-export-json" type="button">⬇ Export .json</button>
      <button class="flock-btn flock-btn--ghost" data-act="audit-download-seed" type="button">⬇ Download full seed .json</button>
      <label class="flock-btn flock-btn--ghost" style="cursor:pointer;margin:0" title="Import a FlockOS JSON file into live Firestore">
        ⬆ Import .json
        <input type="file" accept=".json" id="audit-import-input" style="display:none">
      </label>
    </div>
    <div data-bind="audit-export-msg" style="margin-bottom:10px;font-size:.84rem;min-height:1.2em"></div>
    <div class="wall-audit-list" data-bind="audit-list">
      <flock-skeleton rows="4"></flock-skeleton>
    </div>
  `;
}

function _wireAuditPanel(root) {
  const panel = root.querySelector('[data-wall-panel="audit"]');
  if (!panel) return;
  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'audit-refresh')       return _refreshAudit(root);
    if (act === 'audit-init-all')      return _initAllMissing(root);
    if (act === 'audit-init')          return _initOne(root, btn.dataset.id);
    if (act === 'audit-export-xlsx')   return _exportFirestoreXlsx(root, btn);
    if (act === 'audit-export-json')   return _exportFirestoreJson(root, btn);
    if (act === 'audit-download-seed') return _downloadSeedJson(root);
  });
  // Wire the import file input
  const fileInput = root.querySelector('#audit-import-input');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) await _importFirestoreJson(root, file);
      fileInput.value = '';
    });
  }
  // Initial load if user lands directly on audit (deep-link future-proof).
  if (!panel.classList.contains('wall-panel--hidden')) _refreshAudit(root);
}

// ── Audit — well-known Firestore sentinel documents ──────────────────────
// Each entry is a document path (relative to churches/{churchId}/) that the
// app expects to exist. The audit checks whether each doc is present and
// offers a one-click Create when it is missing.
// This is implemented entirely here using firebase.firestore() directly —
// it has NO dependency on UpperRoom.isReady(), UpperRoom.auditDirectories(),
// or any other method that doesn't exist.

function _auditChurchId() {
  const UR = window.UpperRoom;
  if (UR && typeof UR.churchId === 'function') return UR.churchId() || 'FlockOS';
  if (typeof window.FLOCK_CHURCH_ID === 'string' && window.FLOCK_CHURCH_ID) return window.FLOCK_CHURCH_ID;
  try {
    const m = window.location.pathname.match(/\/Nations\/([^/]+)\//);
    if (m) return m[1];
  } catch (_) {}
  return 'FlockOS';
}

function _auditDb() {
  if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
  return null;
}

// Well-known sentinel documents the app expects at the root of the Firebase project.
// The app uses a flat structure — each church has its own Firebase project, so
// collections live at the root (no churches/{churchId}/ nesting).
// Each entry: id, label, kind, rootPath (full Firestore doc path), defaults.
const _AUDIT_ITEMS = [
  {
    id:          'church-root',
    label:       'Church root document',
    kind:        'Document',
    rootPath:    null,  // no root doc in flat-project model — backend sets up project
    defaults:    { createdAt: null, name: '', setupComplete: false },
    backendOnly: true,
  },
  {
    id:       'config-app',
    label:    'App config (settings/app)',
    kind:     'Document',
    rootPath: 'settings/app',
    defaults: { commsMode: 'firebase', createdAt: null },
  },
  {
    id:       'channel-general',
    label:    '#general channel',
    kind:     'Channel',
    rootPath: 'conversations/general',
    defaults: { name: 'general', type: 'channel', createdAt: null, description: 'General discussion' },
  },
  {
    id:       'channel-announcements',
    label:    '#announcements channel',
    kind:     'Channel',
    rootPath: 'conversations/announcements',
    defaults: { name: 'announcements', type: 'channel', createdAt: null, description: 'Church announcements' },
  },
  {
    id:       'channel-prayer',
    label:    '#prayer-requests channel',
    kind:     'Channel',
    rootPath: 'conversations/prayer-requests',
    defaults: { name: 'prayer-requests', type: 'channel', createdAt: null, description: 'Prayer requests' },
  },
  {
    id:       'settings-notif',
    label:    'Notification settings scaffold',
    kind:     'Document',
    rootPath: 'settings/notifications',
    defaults: { createdAt: null },
  },
];

function _auditDocRef(db, rootPath) {
  if (!rootPath) return null;
  const parts = rootPath.split('/');
  let ref = db.collection(parts[0]).doc(parts[1]);
  for (let i = 2; i < parts.length - 1; i += 2) {
    ref = ref.collection(parts[i]).doc(parts[i + 1]);
  }
  return ref;
}

async function _auditCheckAll(db) {
  return Promise.all(_AUDIT_ITEMS.map(async (item) => {
    if (!item.rootPath) return { ...item, exists: false }; // backend-only, no ref
    try {
      const ref = _auditDocRef(db, item.rootPath);
      const snap = await ref.get();
      return { ...item, exists: snap.exists };
    } catch (_) {
      return { ...item, exists: false };
    }
  }));
}

async function _refreshAudit(root) {
  const host = root.querySelector('[data-bind="audit-list"]');
  if (!host) return;
  host.innerHTML = `<flock-skeleton rows="4"></flock-skeleton>`;

  const db = _auditDb();
  if (!db) {
    host.innerHTML = `<div class="life-empty">Firebase not loaded — refresh the page and try again.</div>`;
    return;
  }

  const churchId = _auditChurchId();
  try {
    const rows = await _auditCheckAll(db);
    _renderAuditRows(host, rows, churchId);
  } catch (err) {
    host.innerHTML = `<div class="life-empty" style="color:#b91c1c">Audit failed: ${_e(err?.message || String(err))}</div>`;
  }
}

function _renderAuditRows(host, rows, churchId) {
  if (!rows.length) {
    host.innerHTML = `<div class="life-empty">No items to audit.</div>`;
    return;
  }
  const cid = _e(churchId || _auditChurchId());
  host.innerHTML = rows.map((r) => {
    const ok = r.exists;
    const dot = ok
      ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;margin-right:8px"></span>'
      : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#e8a838;margin-right:8px"></span>';
    const status = ok ? 'Exists' : 'Missing';
    const action = ok
      ? `<span style="color:var(--ink-muted,#7a7f96);font-size:.85rem">OK</span>`
      : r.backendOnly
        ? `<span style="color:var(--ink-muted,#7a7f96);font-size:.8rem;font-style:italic">Backend only — run church setup</span>`
        : `<button class="flock-btn flock-btn--primary flock-btn--sm" data-act="audit-init" data-id="${_e(r.id)}" type="button">Create</button>`;
    const pathLabel = r.rootPath ? r.rootPath : '(backend-managed)';
    return `
      <div class="wall-setting-row" data-row-id="${_e(r.id)}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--line,#e5e7ef);border-radius:8px;margin-bottom:6px;background:var(--bg-raised,#fff)">
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
          <div style="font-weight:600;color:var(--ink,#1b264f)">${dot}${_e(r.label)}</div>
          <div style="font-size:.78rem;color:var(--ink-muted,#7a7f96)">${_e(r.kind)} · ${pathLabel} · ${status}</div>
        </div>
        <div data-bind="action">${action}</div>
      </div>`;
  }).join('');
}

async function _initOne(root, id) {
  const db = _auditDb();
  if (!db) return;
  const item = _AUDIT_ITEMS.find((i) => i.id === id);
  if (!item || !item.rootPath) return;
  const row = root.querySelector(`[data-row-id="${id}"] [data-bind="action"]`);
  if (row) row.innerHTML = `<span style="color:var(--ink-muted,#7a7f96);font-size:.85rem">Creating…</span>`;
  try {
    const ref = _auditDocRef(db, item.rootPath);
    const now = firebase.firestore.FieldValue.serverTimestamp();
    await ref.set({ ...item.defaults, createdAt: now }, { merge: true });
    await _refreshAudit(root);
  } catch (err) {
    if (row) row.innerHTML = `<span style="color:#b91c1c;font-size:.8rem">${_e(err?.message || 'Failed')}</span>`;
  }
}

async function _initAllMissing(root) {
  const db = _auditDb();
  const host = root.querySelector('[data-bind="audit-list"]');
  if (!db) {
    if (host) host.innerHTML = `<div class="life-empty">Firebase not loaded.</div>`;
    return;
  }
  if (host) host.innerHTML = `<div class="life-empty">Initializing missing items…</div>`;
  const churchId = _auditChurchId();
  const now = firebase.firestore.FieldValue.serverTimestamp();
  try {
    const rows = await _auditCheckAll(db);
    await Promise.all(
      rows.filter((r) => !r.exists && !r.backendOnly && r.rootPath).map((item) => {
        const ref = _auditDocRef(db, item.rootPath);
        return ref.set({ ...item.defaults, createdAt: now }, { merge: true }).catch(() => {});
      })
    );
    const refreshed = await _auditCheckAll(db);
    _renderAuditRows(host, refreshed, churchId);
  } catch (err) {
    if (host) host.innerHTML = `<div class="life-empty" style="color:#b91c1c">Initialization failed: ${_e(err?.message || String(err))}</div>`;
  }
}

/* ── Firestore → xlsx / json export + import ─────────────────────────────
   _FS_COLLECTIONS defines ALL known Firestore collections.
   All collections live at the Firebase project root (flat structure).
   skip: true  = backend-managed, never written by the client.             */
const _FS_COLLECTIONS = [
  // Backend-managed (skip during export/import)
  { name: 'churches',                skip: true                                      },
  // Church data collections
  { name: 'channels',                path: 'channels'                                },
  { name: 'config',                  path: 'config'                                  },
  { name: 'settings',                path: 'settings'                                },
  { name: 'members',                 path: 'members'                                 },
  { name: 'prayers',                 path: 'prayers'                                 },
  { name: 'journal',                 path: 'journal'                                 },
  { name: 'contactLog',              path: 'contactLog'                              },
  { name: 'pastoralNotes',           path: 'pastoralNotes'                           },
  { name: 'milestones',              path: 'milestones'                              },
  { name: 'households',              path: 'households'                              },
  { name: 'todos',                   path: 'todos'                                   },
  { name: 'attendance',              path: 'attendance'                              },
  { name: 'events',                  path: 'events'                                  },
  { name: 'rsvps',                   path: 'rsvps'                                   },
  { name: 'calendarEvents',          path: 'calendarEvents'                          },
  { name: 'checkinSessions',         path: 'checkinSessions'                         },
  { name: 'groups',                  path: 'groups'                                  },
  { name: 'groupMembers',            path: 'groupMembers'                            },
  { name: 'giving',                  path: 'giving'                                  },
  { name: 'pledges',                 path: 'pledges'                                 },
  { name: 'volunteers',              path: 'volunteers'                              },
  { name: 'conversations',           path: 'conversations'                           },
  { name: 'messages',                path: 'messages',            limit: 2000        },
  { name: 'notifications',           path: 'notifications'                           },
  { name: 'templates',               path: 'templates'                               },
  { name: 'broadcasts',              path: 'broadcasts'                              },
  { name: 'ministries',              path: 'ministries'                              },
  { name: 'servicePlans',            path: 'servicePlans'                            },
  { name: 'songs',                   path: 'songs'                                   },
  { name: 'albums',                  path: 'albums'                                  },
  { name: 'sermons',                 path: 'sermons'                                 },
  { name: 'sermonSeries',            path: 'sermonSeries'                            },
  { name: 'sermonReviews',           path: 'sermonReviews'                           },
  { name: 'careCases',               path: 'careCases'                               },
  { name: 'careInteractions',        path: 'careInteractions'                        },
  { name: 'careAssignments',         path: 'careAssignments'                         },
  { name: 'compassionRequests',      path: 'compassionRequests'                      },
  { name: 'compassionLogs',          path: 'compassionLogs'                          },
  { name: 'compassionResources',     path: 'compassionResources'                     },
  { name: 'outreachContacts',        path: 'outreachContacts'                        },
  { name: 'outreachCampaigns',       path: 'outreachCampaigns'                       },
  { name: 'outreachFollowUps',       path: 'outreachFollowUps'                       },
  { name: 'discipleshipPaths',       path: 'discipleshipPaths'                       },
  { name: 'discipleshipSteps',       path: 'discipleshipSteps'                       },
  { name: 'discipleshipEnrollments', path: 'discipleshipEnrollments'                 },
  { name: 'discipleshipMentoring',   path: 'discipleshipMentoring'                   },
  { name: 'discipleshipMeetings',    path: 'discipleshipMeetings'                    },
  { name: 'discipleshipAssessments', path: 'discipleshipAssessments'                 },
  { name: 'discipleshipMilestones',  path: 'discipleshipMilestones'                  },
  { name: 'discipleshipGoals',       path: 'discipleshipGoals'                       },
  { name: 'discipleshipCertificates',path: 'discipleshipCertificates'                },
  { name: 'learningTopics',          path: 'learningTopics'                          },
  { name: 'learningPlaylists',       path: 'learningPlaylists'                       },
  { name: 'learningPlaylistItems',   path: 'learningPlaylistItems'                   },
  { name: 'learningProgress',        path: 'learningProgress'                        },
  { name: 'learningNotes',           path: 'learningNotes'                           },
  { name: 'learningBookmarks',       path: 'learningBookmarks'                       },
  { name: 'learningRecommendations', path: 'learningRecommendations'                 },
  { name: 'learningQuizzes',         path: 'learningQuizzes'                         },
  { name: 'learningQuizResults',     path: 'learningQuizResults'                     },
  { name: 'learningCertificates',    path: 'learningCertificates'                    },
  { name: 'theologyCategories',      path: 'theologyCategories'                      },
  { name: 'theologySections',        path: 'theologySections'                        },
  { name: 'memberCards',             path: 'memberCards'                             },
  { name: 'cardLinks',               path: 'cardLinks'                               },
  { name: 'memberCardViews',         path: 'memberCardViews'                         },
  { name: 'statisticsConfig',        path: 'statisticsConfig'                        },
  { name: 'statisticsSnapshots',     path: 'statisticsSnapshots'                     },
  { name: 'statisticsViews',         path: 'statisticsViews'                         },
  { name: 'strategicGoals',          path: 'strategicGoals'                          },
  { name: 'strategicInitiatives',    path: 'strategicInitiatives'                    },
  { name: 'strategicKeyDates',       path: 'strategicKeyDates'                       },
  { name: 'accessControl',           path: 'accessControl'                           },
  { name: 'permissions',             path: 'permissions'                             },
  // Content collections
  { name: 'users',                   path: 'users'                                   },
  { name: 'books',                   path: 'books'                                   },
  { name: 'genealogy',               path: 'genealogy'                               },
  { name: 'counseling',              path: 'counseling'                              },
  { name: 'devotionals',             path: 'devotionals'                             },
  { name: 'heart',                   path: 'heart'                                   },
  { name: 'mirror',                  path: 'mirror'                                  },
  { name: 'theology',                path: 'theology'                                },
  { name: 'quiz',                    path: 'quiz'                                    },
  { name: 'apologetics',             path: 'apologetics'                             },
  { name: 'missionsRegistry',        path: 'missionsRegistry'                        },
  { name: 'missionsRegions',         path: 'missionsRegions'                         },
  { name: 'missionsCities',          path: 'missionsCities'                          },
  { name: 'missionsPartners',        path: 'missionsPartners'                        },
  { name: 'missionsPrayerFocus',     path: 'missionsPrayerFocus'                     },
  { name: 'missionsUpdates',         path: 'missionsUpdates'                         },
  { name: 'missionsTeams',           path: 'missionsTeams'                           },
  { name: 'missionsMetrics',         path: 'missionsMetrics'                         },
  { name: 'reading',                 path: 'reading'                                 },
  { name: 'readingPlans',            path: 'readingPlans'                            },
  { name: 'wordsGreek',              path: 'wordsGreek',          limit: 5000        },
  { name: 'wordsHebrew',             path: 'wordsHebrew',         limit: 5000        },
];

// Export spec list (used by xlsx/json exporters) — derived from _FS_COLLECTIONS.
const _FS_EXPORT_SPECS = _FS_COLLECTIONS
  .filter(c => !c.skip)
  .map(c => ({
    sheet: c.name,
    fetch: (db) => {
      let q = db.collection(c.path);
      if (c.limit) q = q.limit(c.limit);
      return q.get().then(s => s.docs.map(d => ({ _id: d.id, ...d.data() })));
    },
  }));

// Import map derived from _FS_COLLECTIONS (used by _importFirestoreJson)
const _IMPORT_MAP = Object.fromEntries(
  _FS_COLLECTIONS.filter(c => !c.skip).map(c => [c.name, c.path])
);

function _flattenForSheet(rows) {
  // Flatten Firestore Timestamps and nested objects one level deep.
  return rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (v && typeof v === 'object' && typeof v.toDate === 'function') {
        out[k] = v.toDate().toISOString();
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = JSON.stringify(v);
      } else if (Array.isArray(v)) {
        out[k] = v.join(', ');
      } else {
        out[k] = v ?? '';
      }
    }
    return out;
  });
}

async function _exportFirestoreXlsx(root, btn) {
  const msgEl = root.querySelector('[data-bind="audit-export-msg"]');
  const setMsg = (t, c) => { if (msgEl) { msgEl.textContent = t; msgEl.style.color = c || 'var(--ink-muted,#7a7f96)'; } };

  const db = _auditDb();
  if (!db) return setMsg('Firebase not connected — refresh and try again.', '#b91c1c');

  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Loading library…';
  setMsg('');

  try {
    await _ensureSheetJS();
  } catch (err) {
    setMsg('Could not load export library: ' + (err?.message || String(err)), '#b91c1c');
    btn.disabled = false; btn.textContent = orig; return;
  }

  btn.textContent = 'Fetching data…';
  const churchId = _auditChurchId();
  const wb = XLSX.utils.book_new();
  let totalRows = 0;

  for (const spec of _FS_EXPORT_SPECS) {
    try {
      const rows = await spec.fetch(db);
      if (!rows.length) continue;
      const flat = _flattenForSheet(rows);
      const ws = XLSX.utils.json_to_sheet(flat);
      XLSX.utils.book_append_sheet(wb, ws, spec.sheet);
      totalRows += rows.length;
    } catch (_) {
      // Permission denied or collection doesn't exist — skip silently.
    }
  }

  if (wb.SheetNames.length === 0) {
    setMsg('No readable data found. Check Firestore permissions.', '#b45309');
    btn.disabled = false; btn.textContent = orig; return;
  }

  const date   = new Date().toISOString().slice(0, 10);
  const fname  = `FlockOS-${_e(churchId)}-${date}.xlsx`;
  XLSX.writeFile(wb, fname);
  setMsg(`✓ Exported ${totalRows} rows across ${wb.SheetNames.length} sheet(s) → ${fname}`, '#16a34a');
  btn.disabled = false; btn.textContent = orig;
}

// Serialize Firestore Timestamps and nested objects faithfully for JSON round-trip.
function _serializeForJson(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj.toDate === 'function') {
    // Firestore Timestamp → { __type: 'timestamp', iso: '...' } so it can be restored
    return { __type: 'timestamp', iso: obj.toDate().toISOString() };
  }
  if (Array.isArray(obj)) return obj.map(_serializeForJson);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = _serializeForJson(v);
    return out;
  }
  return obj;
}

async function _exportFirestoreJson(root, btn) {
  const msgEl = root.querySelector('[data-bind="audit-export-msg"]');
  const setMsg = (t, c) => { if (msgEl) { msgEl.textContent = t; msgEl.style.color = c || 'var(--ink-muted,#7a7f96)'; } };

  const db = _auditDb();
  if (!db) return setMsg('Firebase not connected — refresh and try again.', '#b91c1c');

  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Fetching data…';
  setMsg('');

  const churchId = _auditChurchId();
  const exportDoc = {
    __meta: {
      exportedAt: new Date().toISOString(),
      churchId,
      format: 'FlockOS-Firestore-JSON-v1',
      note: 'Timestamps stored as { __type: "timestamp", iso: "..." } for lossless re-import.',
    },
    collections: {},
  };

  let totalDocs = 0;
  for (const spec of _FS_EXPORT_SPECS) {
    try {
      const rows = await spec.fetch(db);
      if (!rows.length) continue;
      exportDoc.collections[spec.sheet] = rows.map((r) => _serializeForJson(r));
      totalDocs += rows.length;
    } catch (_) {
      // Permission denied or missing — skip silently.
    }
  }

  if (!Object.keys(exportDoc.collections).length) {
    setMsg('No readable data found. Check Firestore permissions.', '#b45309');
    btn.disabled = false; btn.textContent = orig; return;
  }

  const json  = JSON.stringify(exportDoc, null, 2);
  const blob  = new Blob([json], { type: 'application/json' });
  const url   = URL.createObjectURL(blob);
  const date  = new Date().toISOString().slice(0, 10);
  const fname = `FlockOS-${churchId}-${date}.json`;
  const a     = Object.assign(document.createElement('a'), { href: url, download: fname });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const sheets = Object.keys(exportDoc.collections).join(', ');
  setMsg(`✓ Exported ${totalDocs} docs (${sheets}) → ${fname}`, '#16a34a');
  btn.disabled = false; btn.textContent = orig;
}

/* ── Seed database + JSON import ─────────────────────────────────────────
   _SEED_DB      — complete fresh-church Firestore structure (no real data)
   _downloadSeedJson — downloads seed as FlockOS-Firestore-JSON-v1
   _deserializeFromJson — restores { __type:'timestamp', iso } → Timestamp
   _importFirestoreJson — reads any v1 JSON and batch-writes to Firestore  */

// _IMPORT_MAP is now derived from _FS_COLLECTIONS above.
// _buildSeedDb is a minimal in-browser fallback (not used by the download button).
// The download button fetches Data/seed_database.json directly — the full 97-collection
// seed regenerated via: node Covenant/Bezalel/Scripts/generate_seed_db.mjs
function _buildSeedDb(churchId) {
  return {
    __meta: {
      exportedAt: new Date().toISOString(),
      churchId,
      format:  'FlockOS-Firestore-JSON-v1',
      version: 'seed-2.0-minimal',
      note:    'Minimal church setup seed (channels + config + settings). ' +
               'For the complete 93-collection seed with content data, run: ' +
               'node Covenant/Bezalel/Scripts/generate_seed_db.mjs',
    },
    collections: {
      churches:  [{ _id: churchId, name: churchId, setupComplete: false, createdAt: null }],
      channels: [
        { _id: 'general',         name: 'general',         slug: 'general',         type: 'channel', description: 'General discussion',   createdAt: null, messageCount: 0, sortOrder: 1 },
        { _id: 'announcements',   name: 'announcements',   slug: 'announcements',   type: 'channel', description: 'Church announcements',  createdAt: null, messageCount: 0, sortOrder: 2 },
        { _id: 'prayer-requests', name: 'prayer-requests', slug: 'prayer-requests', type: 'channel', description: 'Prayer requests',       createdAt: null, messageCount: 0, sortOrder: 3 },
      ],
      config:    [{ _id: 'general', setupComplete: false, createdAt: null }],
      settings:  [{ _id: 'notifications', emailEnabled: true, inAppEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00', createdAt: null }],
      members:   [],
      users:     [],
      messages:  [],
    },
  };
}

async function _downloadSeedJson(root) {
  const msgEl = root.querySelector('[data-bind="audit-export-msg"]');
  const setMsg = (t, c) => { if (msgEl) { msgEl.textContent = t; msgEl.style.color = c || 'var(--ink-muted,#7a7f96)'; } };
  const btn = root.querySelector('[data-act="audit-download-seed"]');
  const orig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Downloading…'; }
  setMsg('Fetching complete seed database…');
  try {
    const res = await fetch('Data/seed_database.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob  = await res.blob();
    const text  = await blob.text();
    const seed  = JSON.parse(text);
    const cols  = Object.keys(seed?.collections || {}).length;
    const docs  = seed?.__meta?.totalDocs ?? '?';
    const url   = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const fname = `FlockOS-seed_database.json`;
    const a     = Object.assign(document.createElement('a'), { href: url, download: fname });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMsg(`✓ Seed downloaded → ${fname}  (${cols} collections, ${docs} docs, import-ready)`, '#16a34a');
  } catch (err) {
    setMsg('Download failed: ' + (err?.message || String(err)), '#b91c1c');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
}

function _deserializeFromJson(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val.__type === 'timestamp' && val.iso) {
    return firebase.firestore.Timestamp.fromDate(new Date(val.iso));
  }
  if (Array.isArray(val)) return val.map(_deserializeFromJson);
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = _deserializeFromJson(v);
    return out;
  }
  return val;
}

// Promote null on known timestamp field names → serverTimestamp().
const _TS_FIELDS = new Set(['createdAt','updatedAt','lastUpdated','timestamp','sentAt','publishedAt','lastContact']);
function _resolveTimestamps(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    out[k] = (v === null && _TS_FIELDS.has(k))
      ? firebase.firestore.FieldValue.serverTimestamp()
      : v;
  }
  return out;
}

async function _importFirestoreJson(root, file) {
  const msgEl = root.querySelector('[data-bind="audit-export-msg"]');
  const setMsg = (t, c) => { if (msgEl) { msgEl.textContent = t; msgEl.style.color = c || 'var(--ink-muted,#7a7f96)'; } };

  const db = _auditDb();
  if (!db) return setMsg('Firebase not connected — refresh and try again.', '#b91c1c');

  setMsg('Reading file…');
  let parsed;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch (err) {
    return setMsg('Invalid JSON file: ' + (err?.message || String(err)), '#b91c1c');
  }

  if (parsed?.__meta?.format !== 'FlockOS-Firestore-JSON-v1') {
    return setMsg('Not a FlockOS JSON file (missing __meta.format). Only FlockOS-Firestore-JSON-v1 files are supported.', '#b91c1c');
  }

  const churchId = parsed.__meta?.churchId || _auditChurchId();
  const collections = parsed.collections || {};

  let totalWritten = 0;
  let totalSkipped = 0;
  const errors = [];

  for (const [sheetName, rows] of Object.entries(collections)) {
    const colPath = _IMPORT_MAP[sheetName];
    if (!colPath) { totalSkipped += (rows?.length || 0); continue; }
    if (!Array.isArray(rows) || !rows.length) continue;

    setMsg(`Importing ${sheetName} (${rows.length} docs)…`);

    // Batch in chunks of 400 (Firestore max is 500 per batch).
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400);
      const batch = db.batch();
      for (const rawDoc of chunk) {
        const { _id, ...fields } = rawDoc;
        if (!_id) continue;
        const deserialized = _deserializeFromJson(fields);
        const resolved     = _resolveTimestamps(deserialized);
        // All collections live at the project root (flat structure).
        const ref = db.collection(colPath).doc(String(_id));
        batch.set(ref, resolved, { merge: true });
      }
      try {
        await batch.commit();
        totalWritten += chunk.length;
      } catch (err) {
        errors.push(`${sheetName}: ${err?.message || String(err)}`);
      }
    }
  }

  if (errors.length) {
    setMsg(`⚠ Import finished with errors. Written: ${totalWritten}, Skipped: ${totalSkipped}. Errors: ${errors.slice(0,3).join(' | ')}`, '#b45309');
  } else {
    setMsg(`✓ Import complete — ${totalWritten} docs written to Firestore. Skipped: ${totalSkipped} (backend-only).`, '#16a34a');
    _refreshAudit(root);
  }
}

/* ── Maintenance panel ──────────────────────────────────────────────────
   One-shot utilities for after-the-fact data fixes (e.g. lead pastor
   handoff, lost assignments). Each action operates over the live
   Firestore collections via UpperRoom — no GAS bridge needed.          */
/* ── Maintenance: shared helpers ────────────────────────────────────────── */
// Canonical member PIN — used as the memberId in all assignment records.
// Preference: memberPin → memberNumber → Firestore doc id.
function _memberPinId(m) {
  return String(
    (m.memberPin && String(m.memberPin).trim()) ||
    (m.memberNumber && String(m.memberNumber).trim()) ||
    m.id || ''
  ).trim();
}

function _isGarbage(v) {
  if (v === undefined || v === null) return true;
  const s = String(v).trim().toLowerCase();
  return !s || s === 'undefined' || s === 'null';
}

function _maintRow({ title, desc, bindKey, actKey, btnLabel = 'Run now', danger = false }) {
  const pad  = danger ? '16px' : '14px';
  const bord = danger ? '2px solid #b45309' : '1px solid var(--line,#e5e7ef)';
  const bg   = danger ? 'linear-gradient(180deg,#fff7ed,#fffbf3)' : 'var(--bg-raised,#fff)';
  const clr  = danger ? '#7c2d12' : 'var(--ink,#1b264f)';
  const muted= danger ? '#7c2d12' : 'var(--ink-muted,#7a7f96)';
  const bang = danger
    ? '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#b45309;color:#fff;font-size:.75rem;font-weight:700">!</span>'
    : '';
  const btnStyle = danger ? 'flex-shrink:0;background:#b45309;border-color:#b45309' : 'flex-shrink:0';
  return `<div class="wall-setting-row" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:${pad};border:${bord};border-radius:10px;margin-bottom:10px;background:${bg};flex-wrap:wrap">
    <div style="flex:1;min-width:240px">
      <div style="font-weight:${danger?700:600};color:${clr};margin-bottom:2px;display:flex;align-items:center;gap:8px">${bang}${title}</div>
      <div style="font-size:.82rem;color:${muted};line-height:1.5">${desc}</div>
      <div class="wall-maint-status" data-bind="${bindKey}" style="margin-top:8px;font-size:.82rem;color:${muted}"></div>
    </div>
    <button class="flock-btn flock-btn--primary" data-act="${actKey}" type="button" style="${btnStyle}">${btnLabel}</button>
  </div>`;
}

function _maintSection(label) {
  return `<div style="font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted,#7a7f96);padding:12px 0 6px">${label}</div>`;
}

function _maintenancePanelMarkup() {
  return /* html */`
    <p class="wall-audit-intro" style="margin:0 0 14px;color:var(--ink-muted,#7a7f96);font-size:.9rem">
      Utilities for one-time data fixes. Use when the lead pastor changes, after a data import,
      or if care records need to be reset. <strong style="color:var(--ink,#1b264f)">Member PIN</strong>
      is used as the identifier in all assignment records — not the Firestore doc ID.
    </p>

    ${_maintSection('Lead Pastor Assignment')}

    ${_maintRow({
      title: 'Reset Care to Lead Pastor (master override)', danger: true,
      desc: 'Full reset: <strong>(1)</strong> reassigns every open care case, prayer, outreach contact &amp; compassion request to the LP, <strong>(2)</strong> sets every existing Active assignment\'s caregiverId to the LP PIN, <strong>(3)</strong> creates an Active Shepherd assignment (by PIN) for any member still without one.',
      bindKey: 'reset-status', actKey: 'reset-care-to-lp', btnLabel: 'Reset now',
    })}

    ${_maintRow({
      title: 'Assign Lead Pastor as caregiver for all members',
      desc: 'Creates an Active <strong>Shepherd</strong> assignment (by member PIN) to the LP for every member not yet covered. Any other existing Active assignment is demoted to <strong>Timothy</strong> role. Members already assigned to the LP are skipped.',
      bindKey: 'assign-all-status', actKey: 'assign-all-to-lp', btnLabel: 'Assign now',
    })}

    ${_maintRow({
      title: 'Reassign open care cases &amp; prayers to Lead Pastor',
      desc: 'Sets <code>primaryCaregiverId</code> on every open care case and <code>assignedTo</code> on every active prayer to the LP PIN. Terminal records (resolved, answered, closed) are skipped.',
      bindKey: 'reassign-status', actKey: 'reassign-to-lp', btnLabel: 'Reassign now',
    })}

    ${_maintRow({
      title: 'Reassign open compassion requests to Lead Pastor',
      desc: 'Sets <code>assignedTo</code> to the LP PIN on every compassion request that is not yet closed, resolved, or denied.',
      bindKey: 'compassion-reassign-status', actKey: 'reassign-compassion-to-lp', btnLabel: 'Reassign now',
    })}

    ${_maintRow({
      title: 'Reassign open outreach contacts to Lead Pastor',
      desc: 'Sets <code>assignedTo</code> to the LP PIN on every outreach contact that is not in a terminal status (converted, closed, archived, rejected, dropped).',
      bindKey: 'outreach-reassign-status', actKey: 'reassign-outreach-to-lp', btnLabel: 'Reassign now',
    })}

    ${_maintSection('Record Hygiene')}

    ${_maintRow({
      title: 'Fill blank assignments across all record types',
      desc: 'Finds care cases, prayers, outreach contacts, and compassion requests where the assignee field is blank, null, or the literal string "undefined" — and sets it to the LP PIN.',
      bindKey: 'fill-blank-status', actKey: 'fill-blank-assignments', btnLabel: 'Fix now',
    })}

    ${_maintRow({
      title: 'Deduplicate care assignments',
      desc: 'For each member, if more than one Active assignment exists for the same caregiverId, all duplicates are ended (status → Ended) — keeping only the oldest Active row per caregiver per member.',
      bindKey: 'dedup-status', actKey: 'dedup-care-assignments', btnLabel: 'Deduplicate now',
    })}

    ${_maintRow({
      title: 'Generate missing member PINs',
      desc: 'Finds every member record with a blank or missing <code>memberPin</code> field and generates a unique 9-digit PIN (xxx-xx-xxxx) for each. Does not overwrite existing PINs.',
      bindKey: 'pins-status', actKey: 'gen-member-pins', btnLabel: 'Generate now',
    })}

    ${_maintRow({
      title: 'End all non-Active care assignments',
      desc: 'Marks every care assignment whose status is not <strong>Active</strong> as <strong>Ended</strong> — cleaning up legacy "Inactive", "Paused", blank, or unknown-status rows.',
      bindKey: 'end-inactive-status', actKey: 'end-inactive-assignments', btnLabel: 'Clean up now',
    })}

    ${_maintSection('Member De-duplication')}

    <!-- Dedup scan -->
    <div style="border:1px solid var(--line,#e5e7ef);border-radius:10px;margin-bottom:10px;overflow:hidden;background:var(--bg-raised,#fff)">
      <div style="padding:14px;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:240px">
          <div style="font-weight:600;color:var(--ink,#1b264f);margin-bottom:2px">Find &amp; Merge Duplicate Members</div>
          <div style="font-size:.82rem;color:var(--ink-muted,#7a7f96);line-height:1.5">Scans all member records for likely duplicates — matched by email address, full name, or phone number. Review each pair, choose which record to keep, and merge any missing fields from the duplicate before archiving it.</div>
          <div data-bind="member-dedup-status" style="margin-top:6px;font-size:.82rem;color:var(--ink-muted)"></div>
        </div>
        <button class="flock-btn flock-btn--secondary" data-act="scan-member-dups" type="button" style="flex-shrink:0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:-1px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Scan for Duplicates
        </button>
      </div>
      <!-- Results populated by JS -->
      <div data-bind="member-dedup-results" style="display:none"></div>
    </div>

    ${_maintSection('Contact Import / Export')}

    <!-- VCF Export -->
    <div class="wall-setting-row" style="display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid var(--line,#e5e7ef);border-radius:10px 10px 0 0;margin-bottom:0;background:var(--bg-raised,#fff);flex-wrap:wrap">
      <div style="flex:1;min-width:240px">
        <div style="font-weight:600;color:var(--ink,#1b264f);margin-bottom:2px">Export Members as .vcf</div>
        <div style="font-size:.82rem;color:var(--ink-muted,#7a7f96);line-height:1.5">Download all member records as a standard vCard file — importable into Apple Contacts, Google Contacts, Outlook, and more. Use this to seed a new church deployment with existing contacts.</div>
        <div data-bind="vcf-export-status" style="margin-top:6px;font-size:.82rem;color:var(--ink-muted)"></div>
      </div>
      <button class="flock-btn flock-btn--primary" data-act="vcf-export" type="button" style="flex-shrink:0">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:-1px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export All (.vcf)
      </button>
    </div>

    <!-- VCF Import -->
    <div style="border:1px solid var(--line,#e5e7ef);border-top:none;border-radius:0 0 10px 10px;margin-bottom:10px;overflow:hidden;background:var(--bg-raised,#fff)">
      <div style="padding:14px;border-bottom:1px solid var(--line,#e5e7ef)">
        <div style="font-weight:600;color:var(--ink,#1b264f);margin-bottom:2px">Import Contacts from .vcf</div>
        <div style="font-size:.82rem;color:var(--ink-muted,#7a7f96);line-height:1.5;margin-bottom:12px">Upload a .vcf file to preview contacts, then choose all, some, or just one to import as new member records. Existing members are never overwritten — imports only create new records.</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <label style="display:inline-flex;align-items:center;gap:7px;cursor:pointer;padding:8px 16px;border:1.5px dashed var(--line-strong,#c5c8d6);border-radius:8px;background:var(--bg,#f7f8fb);color:var(--ink,#1b264f);font-size:.85rem;font-weight:600;transition:border-color .18s" data-bind="vcf-file-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Choose .vcf File
            <input type="file" accept=".vcf,text/vcard,text/x-vcard" data-bind="vcf-file-input" style="display:none">
          </label>
          <span data-bind="vcf-file-name" style="font-size:.82rem;color:var(--ink-muted)">No file chosen</span>
        </div>
      </div>
      <!-- Preview list — populated by JS after file parse -->
      <div data-bind="vcf-preview" style="display:none"></div>
    </div>
  `;
}

function _wireMaintenancePanel(root) {
  const panel = root.querySelector('[data-wall-panel="maintenance"]');
  if (!panel) return;
  panel.addEventListener('click', async (e) => {
    const resetBtn = e.target.closest('[data-act="reset-care-to-lp"]');
    if (resetBtn) {
      if (!confirm('RESET CARE TO LEAD PASTOR\n\nThis will:\n  • Reassign every open care case and active prayer to the LP\n  • Reassign every active outreach contact to the LP\n  • Reassign every existing Active care assignment to the LP\n  • Create an Active LP assignment for any member without one\n\nSecondary caregivers will need to be re-added manually afterward.\n\nProceed?')) return;
      return _resetCareToLeadPastor(root, resetBtn);
    }
    const reassignBtn = e.target.closest('[data-act="reassign-to-lp"]');
    if (reassignBtn) {
      if (!confirm('Reassign all open care cases and active prayer requests to the Lead Pastor?\n\nThis cannot be undone automatically.')) return;
      return _reassignAllToLeadPastor(root, reassignBtn);
    }
    const assignAllBtn = e.target.closest('[data-act="assign-all-to-lp"]');
    if (assignAllBtn) {
      if (!confirm('Assign Lead Pastor as Shepherd for every member?\n\nExisting non-LP assignments will be demoted to Timothy role.\nThis cannot be undone automatically.')) return;
      return _assignAllMembersToLeadPastor(root, assignAllBtn);
    }
    const compassionBtn = e.target.closest('[data-act="reassign-compassion-to-lp"]');
    if (compassionBtn) {
      if (!confirm('Reassign all open compassion requests to the Lead Pastor?\n\nThis cannot be undone automatically.')) return;
      return _reassignCompassionToLP(root, compassionBtn);
    }
    const outreachBtn = e.target.closest('[data-act="reassign-outreach-to-lp"]');
    if (outreachBtn) {
      if (!confirm('Reassign all open outreach contacts to the Lead Pastor?\n\nThis cannot be undone automatically.')) return;
      return _reassignOutreachToLP(root, outreachBtn);
    }
    const fillBtn = e.target.closest('[data-act="fill-blank-assignments"]');
    if (fillBtn) {
      if (!confirm('Fill all blank/null assignments across care cases, prayers, outreach, and compassion with the Lead Pastor PIN?\n\nThis cannot be undone automatically.')) return;
      return _fillBlankAssignments(root, fillBtn);
    }
    const dedupBtn = e.target.closest('[data-act="dedup-care-assignments"]');
    if (dedupBtn) {
      if (!confirm('Deduplicate care assignments?\n\nDuplicate Active assignments for the same caregiver+member pair will be ended (oldest kept).\n\nThis cannot be undone automatically.')) return;
      return _dedupCareAssignments(root, dedupBtn);
    }
    const pinsBtn = e.target.closest('[data-act="gen-member-pins"]');
    if (pinsBtn) {
      if (!confirm('Generate member PINs for any member missing one?\n\nExisting PINs will not be overwritten.')) return;
      return _genMissingMemberPins(root, pinsBtn);
    }
    const endInactiveBtn = e.target.closest('[data-act="end-inactive-assignments"]');
    if (endInactiveBtn) {
      if (!confirm('End all non-Active care assignments (Inactive, Paused, blank status, etc.)?\n\nThis cannot be undone automatically.')) return;
      return _endInactiveAssignments(root, endInactiveBtn);
    }

    // ── VCF Export ────────────────────────────────────────────────
    const vcfExportBtn = e.target.closest('[data-act="vcf-export"]');
    if (vcfExportBtn) return _vcfExport(root, vcfExportBtn);

    // ── Member de-duplication scan ────────────────────────────────
    const scanDupBtn = e.target.closest('[data-act="scan-member-dups"]');
    if (scanDupBtn) return _scanMemberDuplicates(root, scanDupBtn);

    // ── Member dedup: keep-A / keep-B radio (re-render summary) ──
    if (e.target.matches('input[data-dedup-radio]')) return; // no-op: radios are just checked

    // ── Member dedup: merge pair ──────────────────────────────────
    const mergeBtn = e.target.closest('[data-act="merge-member-pair"]');
    if (mergeBtn) return _mergeMemberPair(root, mergeBtn);

    // ── VCF Import: select all / deselect all ─────────────────────
    if (e.target.closest('[data-act="vcf-select-all"]')) {
      panel.querySelectorAll('[data-bind="vcf-preview"] input[type="checkbox"]').forEach(cb => { cb.checked = true; });
      return;
    }
    if (e.target.closest('[data-act="vcf-deselect-all"]')) {
      panel.querySelectorAll('[data-bind="vcf-preview"] input[type="checkbox"]').forEach(cb => { cb.checked = false; });
      return;
    }

    // ── VCF Import: import selected ───────────────────────────────
    const vcfImportBtn = e.target.closest('[data-act="vcf-import-selected"]');
    if (vcfImportBtn) return _vcfImportSelected(root, vcfImportBtn);
  });

  // File-input change handler — parse VCF, check for duplicates, then render preview
  const fileInput = panel.querySelector('[data-bind="vcf-file-input"]');
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files[0];
    const nameEl  = panel.querySelector('[data-bind="vcf-file-name"]');
    const preview = panel.querySelector('[data-bind="vcf-preview"]');
    if (!file) { if (nameEl) nameEl.textContent = 'No file chosen'; return; }
    if (nameEl) nameEl.textContent = file.name;
    if (preview) {
      preview.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-muted);font-size:.85rem">Parsing file…</div>';
      preview.style.display = '';
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const contacts = _parseVcf(ev.target.result || '');
      // Load existing members to detect duplicates
      if (preview) preview.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-muted);font-size:.85rem">Checking against existing members…</div>';
      const existingEmails = new Map(); // email.lower → member record
      const existingNames  = new Map(); // "first last".lower → member record
      try {
        const UR = await _waitForUpperRoom(5000);
        if (UR && UR.listMembers) {
          const rows = await UR.listMembers({ limit: 5000 }).catch(() => []);
          const list = Array.isArray(rows) ? rows : [];
          for (const m of list) {
            if (m.primaryEmail)   existingEmails.set(m.primaryEmail.toLowerCase().trim(), m);
            if (m.secondaryEmail) existingEmails.set(m.secondaryEmail.toLowerCase().trim(), m);
            if (m.email)          existingEmails.set(m.email.toLowerCase().trim(), m);
            // Index by firstName+lastName, and also by displayName/name for members
            // created before the firstName/lastName split was enforced
            const n = [m.firstName, m.lastName].filter(Boolean).join(' ').toLowerCase().trim();
            if (n) existingNames.set(n, m);
            const dn = (m.displayName || m.name || '').toLowerCase().trim();
            if (dn && !existingNames.has(dn)) existingNames.set(dn, m);
          }
        }
      } catch (_) {}
      _renderVcfPreview(root, contacts, existingEmails, existingNames);
    };
    reader.readAsText(file, 'UTF-8');
  });
}

async function _reassignAllToLeadPastor(root, btn) {
  const status = root.querySelector('[data-bind="reassign-status"]');
  const setStatus = (msg, color) => {
    if (!status) return;
    status.textContent = msg;
    status.style.color = color || 'var(--ink-muted,#7a7f96)';
  };
  btn.disabled = true;
  const origLabel = btn.textContent;
  btn.textContent = 'Working…';
  setStatus('Looking up Lead Pastor…');

  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.getAppConfig) {
    setStatus('Backend not ready.', '#b91c1c');
    btn.disabled = false; btn.textContent = origLabel;
    return;
  }

  try {
    const cfg = await UR.getAppConfig({ key: 'LEAD_PASTOR_MEMBER_ID' });
    const lpId = String((cfg && cfg.value) || '').trim();
    if (!lpId) {
      setStatus('No Lead Pastor Member PIN is configured under Church Settings.', '#b91c1c');
      btn.disabled = false; btn.textContent = origLabel;
      return;
    }

    setStatus(`Reassigning open cases and prayers to ${lpId}…`);
    console.log('[wall/reassign] lpId from AppConfig =', JSON.stringify(lpId));

    // ── Care cases ────────────────────────────────────────────────
    let caseChecked = 0, caseUpdated = 0, caseFailed = 0, caseSkipped = 0;
    if (UR.listCareCases && UR.updateCareCase) {
      const TERMINAL = new Set(['resolved','closed','archived','cancelled','completed','denied']);
      const allCases = await UR.listCareCases({ limit: 1000 });
      const cases = Array.isArray(allCases) ? allCases : (allCases?.results || []);
      console.log('[wall/reassign] loaded ' + cases.length + ' care cases');
      for (const c of cases) {
        caseChecked++;
        const st = String(c.status || '').toLowerCase();
        if (TERMINAL.has(st)) { caseSkipped++; continue; }
        // Only skip if the existing primaryCaregiverId is a real, non-empty,
        // non-"undefined"/"null" string that matches the lpId. Older save bugs
        // wrote literal strings "undefined" / "null" into Firestore — we must
        // still rewrite those.
        const cur = c.primaryCaregiverId;
        const curStr = (cur === undefined || cur === null) ? '' : String(cur).trim();
        if (curStr && curStr.toLowerCase() !== 'undefined' && curStr.toLowerCase() !== 'null' && curStr === lpId) {
          caseSkipped++;
          continue;
        }
        console.log('[wall/reassign] case', c.id, 'status=' + st, 'cur=' + JSON.stringify(cur), '→', lpId);
        try {
          await UR.updateCareCase({ id: c.id, primaryCaregiverId: lpId });
          caseUpdated++;
        } catch (err) {
          caseFailed++;
          console.error('[wall/reassign] case update failed', c.id, err);
        }
      }
    }

    // ── Prayers ───────────────────────────────────────────────────
    let prayerChecked = 0, prayerUpdated = 0, prayerFailed = 0, prayerSkipped = 0;
    if (UR.listPrayers && UR.updatePrayer) {
      const TERMINAL_P = new Set(['answered','closed','archived','resolved']);
      const all = await UR.listPrayers({ allUsers: true, limit: 1000 });
      const prayers = Array.isArray(all) ? all : (all?.results || []);
      console.log('[wall/reassign] loaded ' + prayers.length + ' prayers');
      for (const p of prayers) {
        prayerChecked++;
        const st = String(p.status || '').toLowerCase();
        if (TERMINAL_P.has(st)) { prayerSkipped++; continue; }
        const cur = p.assignedTo;
        const curStr = (cur === undefined || cur === null) ? '' : String(cur).trim();
        if (curStr && curStr.toLowerCase() !== 'undefined' && curStr.toLowerCase() !== 'null' && curStr === lpId) {
          prayerSkipped++;
          continue;
        }
        console.log('[wall/reassign] prayer', p.id, 'status=' + st, 'cur=' + JSON.stringify(cur), '→', lpId);
        try {
          await UR.updatePrayer(p.id, { assignedTo: lpId });
          prayerUpdated++;
        } catch (err) {
          prayerFailed++;
          console.error('[wall/reassign] prayer update failed', p.id, err);
        }
      }
    }

    const failMsg = (caseFailed || prayerFailed)
      ? ` · ${caseFailed + prayerFailed} failed (see console)`
      : '';
    setStatus(
      `Done. Cases: ${caseUpdated} reassigned, ${caseSkipped} already-LP/terminal, of ${caseChecked} total. ` +
      `Prayers: ${prayerUpdated} reassigned, ${prayerSkipped} already-LP/terminal, of ${prayerChecked} total.${failMsg}`,
      (caseFailed || prayerFailed) ? '#b45309' : '#16a34a'
    );
  } catch (err) {
    console.error('[wall] reassignAllToLeadPastor error', err);
    setStatus(`Failed: ${err?.message || String(err)}`, '#b91c1c');
  } finally {
    btn.disabled = false;
    btn.textContent = origLabel;
  }
}

async function _assignAllMembersToLeadPastor(root, btn) {
  const status = root.querySelector('[data-bind="assign-all-status"]');
  const setStatus = (msg, color) => {
    if (!status) return;
    status.textContent = msg;
    status.style.color = color || 'var(--ink-muted,#7a7f96)';
  };
  btn.disabled = true;
  const origLabel = btn.textContent;
  btn.textContent = 'Working…';
  setStatus('Looking up Lead Pastor…');

  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.getAppConfig || !UR.listMembers || !UR.listCareAssignments || !UR.createCareAssignment || !UR.updateCareAssignment) {
    setStatus('Backend not ready (or care-assignment APIs missing).', '#b91c1c');
    btn.disabled = false; btn.textContent = origLabel;
    return;
  }

  try {
    const cfg = await UR.getAppConfig({ key: 'LEAD_PASTOR_MEMBER_ID' });
    const lpId = String((cfg && cfg.value) || '').trim();
    if (!lpId) {
      setStatus('No Lead Pastor Member PIN is configured under Church Settings.', '#b91c1c');
      btn.disabled = false; btn.textContent = origLabel;
      return;
    }
    console.log('[wall/assign-all] lpId =', JSON.stringify(lpId));

    setStatus('Loading members and existing assignments…');
    const [members, existing] = await Promise.all([
      UR.listMembers({ limit: 5000 }).catch((e) => { console.error('[wall/assign-all] listMembers failed', e); return []; }),
      UR.listCareAssignments({ limit: 5000 }).catch((e) => { console.error('[wall/assign-all] listCareAssignments failed', e); return []; }),
    ]);
    const memberRows = Array.isArray(members) ? members : (members?.results || []);
    const assignRows = Array.isArray(existing) ? existing : (existing?.results || []);
    console.log('[wall/assign-all] members=' + memberRows.length + ', existing assignments=' + assignRows.length);

    // Group Active assignments by memberId
    const byMember = {}; // memberId → [assignment, ...]
    for (const a of assignRows) {
      const st = String(a.status || '').toLowerCase();
      if (st && st !== 'active') continue;
      if (!a.memberId) continue;
      const mid = String(a.memberId);
      (byMember[mid] = byMember[mid] || []).push(a);
    }

    setStatus(`Processing ${memberRows.length} members…`);

    let checked = 0, created = 0, demoted = 0, skipped = 0, failed = 0;
    for (const m of memberRows) {
      checked++;
      const memberId = _memberPinId(m);
      if (!memberId) { skipped++; continue; }
      // Skip the LP themselves
      if (memberId === lpId) {
        skipped++; continue;
      }

      const activeAssignments = byMember[memberId] || [];
      const hasLP = activeAssignments.some((a) => String(a.caregiverId || '').trim() === lpId);

      if (hasLP) {
        // LP already assigned as primary — demote any non-LP assignments to Timothy
        for (const a of activeAssignments) {
          if (String(a.caregiverId || '').trim() === lpId) continue; // leave LP alone
          if (String(a.role || '').toLowerCase() === 'timothy') continue; // already secondary
          try {
            await UR.updateCareAssignment({
              id: a.id,
              role: 'Timothy',
              notes: (a.notes ? a.notes + '\n' : '') + 'Demoted to secondary (Timothy) via Assign-All-to-LP',
            });
            demoted++;
          } catch (err) {
            failed++;
            console.error('[wall/assign-all] demote failed for assignment', a.id, err);
          }
        }
        skipped++; // LP was already there; counted as skipped for creation
        continue;
      }

      // No LP assignment yet — demote any existing non-LP assignments to Timothy first
      for (const a of activeAssignments) {
        if (String(a.role || '').toLowerCase() === 'timothy') continue;
        try {
          await UR.updateCareAssignment({
            id: a.id,
            role: 'Timothy',
            notes: (a.notes ? a.notes + '\n' : '') + 'Demoted to secondary (Timothy) via Assign-All-to-LP',
          });
          demoted++;
        } catch (err) {
          failed++;
          console.error('[wall/assign-all] demote failed for assignment', a.id, err);
        }
      }

      // Create LP as primary Shepherd
      try {
        await UR.createCareAssignment({
          memberId,
          caregiverId: lpId,
          role: 'Shepherd',
          status: 'Active',
          notes: 'Assigned via Admin → Maintenance (Assign All to LP)',
        });
        created++;
      } catch (err) {
        failed++;
        console.error('[wall/assign-all] create failed for member', memberId, err);
      }
    }

    const failMsg = failed ? ` · ${failed} failed (see console)` : '';
    setStatus(
      `Done. LP assigned to ${created} members · ${demoted} other assignments demoted to Timothy · ${skipped} already had LP.${failMsg}`,
      failed ? '#b45309' : '#16a34a'
    );
  } catch (err) {
    console.error('[wall] assignAllMembersToLeadPastor error', err);
    setStatus(`Failed: ${err?.message || String(err)}`, '#b91c1c');
  } finally {
    btn.disabled = false;
    btn.textContent = origLabel;
  }
}

async function _resetCareToLeadPastor(root, btn) {
  const status = root.querySelector('[data-bind="reset-status"]');
  const setStatus = (msg, color) => {
    if (!status) return;
    status.textContent = msg;
    status.style.color = color || '#7c2d12';
  };
  btn.disabled = true;
  const origLabel = btn.textContent;
  btn.textContent = 'Resetting…';
  setStatus('Looking up Lead Pastor…');

  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.getAppConfig) {
    setStatus('Backend not ready.', '#b91c1c');
    btn.disabled = false; btn.textContent = origLabel;
    return;
  }

  try {
    const cfg = await UR.getAppConfig({ key: 'LEAD_PASTOR_MEMBER_ID' });
    const lpId = String((cfg && cfg.value) || '').trim();
    if (!lpId) {
      setStatus('No Lead Pastor Member PIN is configured under Church Settings.', '#b91c1c');
      btn.disabled = false; btn.textContent = origLabel;
      return;
    }
    console.log('[wall/reset] lpId =', JSON.stringify(lpId));

    // ── Step 1: Care cases ───────────────────────────────────────
    setStatus('Step 1/6: Reassigning open care cases…');
    const TERMINAL_C = new Set(['resolved','closed','archived','cancelled','completed','denied']);
    let caseChecked = 0, caseUpdated = 0, caseSkipped = 0, caseFailed = 0;
    if (UR.listCareCases && UR.updateCareCase) {
      const all = await UR.listCareCases({ limit: 1000 }).catch(() => []);
      const cases = Array.isArray(all) ? all : (all?.results || []);
      for (const c of cases) {
        caseChecked++;
        const st = String(c.status || '').toLowerCase();
        if (TERMINAL_C.has(st)) { caseSkipped++; continue; }
        const cur = c.primaryCaregiverId;
        if (!_isGarbage(cur) && String(cur).trim() === lpId) { caseSkipped++; continue; }
        try {
          await UR.updateCareCase({ id: c.id, primaryCaregiverId: lpId });
          caseUpdated++;
        } catch (err) { caseFailed++; console.error('[wall/reset] case', c.id, err); }
      }
    }

    // ── Step 2: Prayers ──────────────────────────────────────────
    setStatus(`Step 2/6: Reassigning active prayers… (${caseUpdated} cases done)`);
    const TERMINAL_P = new Set(['answered','closed','archived','resolved']);
    let prayerChecked = 0, prayerUpdated = 0, prayerSkipped = 0, prayerFailed = 0;
    if (UR.listPrayers && UR.updatePrayer) {
      const all = await UR.listPrayers({ allUsers: true, limit: 1000 }).catch(() => []);
      const prayers = Array.isArray(all) ? all : (all?.results || []);
      for (const p of prayers) {
        prayerChecked++;
        const st = String(p.status || '').toLowerCase();
        if (TERMINAL_P.has(st)) { prayerSkipped++; continue; }
        const cur = p.assignedTo;
        if (!_isGarbage(cur) && String(cur).trim() === lpId) { prayerSkipped++; continue; }
        try {
          await UR.updatePrayer(p.id, { assignedTo: lpId });
          prayerUpdated++;
        } catch (err) { prayerFailed++; console.error('[wall/reset] prayer', p.id, err); }
      }
    }

    // ── Step 3: Outreach contacts ────────────────────────────────
    setStatus(`Step 3/6: Reassigning active outreach contacts…`);
    const TERMINAL_O = new Set(['converted','closed','archived','rejected','dropped']);
    let outChecked = 0, outUpdated = 0, outSkipped = 0, outFailed = 0;
    if (UR.listOutreachContacts && UR.updateOutreachContact) {
      const all = await UR.listOutreachContacts({ limit: 5000 }).catch(() => []);
      const contacts = Array.isArray(all) ? all : (all?.results || []);
      for (const o of contacts) {
        outChecked++;
        const st = String(o.status || '').toLowerCase();
        if (TERMINAL_O.has(st)) { outSkipped++; continue; }
        const cur = o.assignedTo;
        if (!_isGarbage(cur) && String(cur).trim() === lpId) { outSkipped++; continue; }
        try {
          await UR.updateOutreachContact({ id: o.id, assignedTo: lpId });
          outUpdated++;
        } catch (err) { outFailed++; console.error('[wall/reset] outreach', o.id, err); }
      }
    }

    // ── Step 4: Compassion requests ──────────────────────────────
    setStatus(`Step 4/6: Reassigning open compassion requests…`);
    const TERMINAL_CP = new Set(['closed','resolved','denied','archived']);
    let compChecked = 0, compUpdated = 0, compSkipped = 0, compFailed = 0;
    if (UR.listCompassionRequests && UR.updateCompassionRequest) {
      const all = await UR.listCompassionRequests({ limit: 5000 }).catch(() => []);
      const reqs = Array.isArray(all) ? all : (all?.results || []);
      for (const c of reqs) {
        compChecked++;
        const st = String(c.status || '').toLowerCase();
        if (TERMINAL_CP.has(st)) { compSkipped++; continue; }
        const cur = c.assignedTo;
        if (!_isGarbage(cur) && String(cur).trim() === lpId) { compSkipped++; continue; }
        try {
          await UR.updateCompassionRequest({ id: c.id, assignedTo: lpId });
          compUpdated++;
        } catch (err) { compFailed++; console.error('[wall/reset] compassion', c.id, err); }
      }
    }

    // ── Step 5: Reassign existing Active careAssignments ─────────
    setStatus(`Step 5/6: Reassigning existing care assignments to LP…`);
    let asgChecked = 0, asgReassigned = 0, asgSkipped = 0, asgFailed = 0;
    let existingAssignments = [];
    if (UR.listCareAssignments && UR.reassignCareAssignment) {
      const all = await UR.listCareAssignments({ limit: 5000 }).catch(() => []);
      existingAssignments = Array.isArray(all) ? all : (all?.results || []);
      for (const a of existingAssignments) {
        asgChecked++;
        const st = String(a.status || '').toLowerCase();
        if (st && st !== 'active') { asgSkipped++; continue; }
        const cur = a.caregiverId;
        if (!_isGarbage(cur) && String(cur).trim() === lpId) { asgSkipped++; continue; }
        try {
          await UR.reassignCareAssignment({
            id: a.id,
            newCaregiverId: lpId,
            notes: 'Reset to Lead Pastor via Admin → Maintenance',
          });
          asgReassigned++;
        } catch (err) { asgFailed++; console.error('[wall/reset] assignment', a.id, err); }
      }
    }

    // ── Step 6: Create LP assignment for members without one ─────
    setStatus(`Step 6/6: Creating LP assignments for members without one…`);
    let memChecked = 0, memCreated = 0, memSkipped = 0, memFailed = 0;
    if (UR.listMembers && UR.createCareAssignment) {
      // Build set of memberIds already covered by an Active LP assignment
      // (after Step 3 they should all be LP, but re-derive defensively)
      const covered = new Set();
      for (const a of existingAssignments) {
        const st = String(a.status || '').toLowerCase();
        if (st && st !== 'active') continue;
        // Account for the reassign we just did: any prior Active row is now LP
        if (a.memberId) covered.add(String(a.memberId));
      }
      const all = await UR.listMembers({ limit: 5000 }).catch(() => []);
      const members = Array.isArray(all) ? all : (all?.results || []);
      for (const m of members) {
        memChecked++;
        const memberId = _memberPinId(m);
        if (!memberId) { memSkipped++; continue; }
        // Skip the LP themselves
        if (memberId === lpId) { memSkipped++; continue; }
        if (covered.has(memberId)) { memSkipped++; continue; }
        try {
          await UR.createCareAssignment({
            memberId: String(memberId),
            caregiverId: lpId,
            role: 'Shepherd',
            status: 'Active',
            notes: 'Created during Reset to Lead Pastor',
          });
          memCreated++;
        } catch (err) { memFailed++; console.error('[wall/reset] member', memberId, err); }
      }
    }

    const totalFailed = caseFailed + prayerFailed + outFailed + compFailed + asgFailed + memFailed;
    const failMsg = totalFailed ? ` · ${totalFailed} failed (see console)` : '';
    setStatus(
      `Reset complete. ` +
      `Cases: ${caseUpdated}/${caseChecked} · ` +
      `Prayers: ${prayerUpdated}/${prayerChecked} · ` +
      `Outreach: ${outUpdated}/${outChecked} · ` +
      `Compassion: ${compUpdated}/${compChecked} · ` +
      `Assignments: ${asgReassigned}/${asgChecked} · ` +
      `New LP assignments: ${memCreated}/${memChecked}.${failMsg}`,
      totalFailed ? '#b45309' : '#16a34a'
    );
  } catch (err) {
    console.error('[wall] resetCareToLeadPastor error', err);
    setStatus(`Failed: ${err?.message || String(err)}`, '#b91c1c');
  } finally {
    btn.disabled = false;
    btn.textContent = origLabel;
  }
}

/* ── New maintenance actions ─────────────────────────────────────────── */

async function _reassignCompassionToLP(root, btn) {
  const status = root.querySelector('[data-bind="compassion-reassign-status"]');
  const setStatus = (msg, color) => { if (status) { status.textContent = msg; status.style.color = color || 'var(--ink-muted,#7a7f96)'; } };
  btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Working…';
  setStatus('Looking up Lead Pastor…');
  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.getAppConfig || !UR.listCompassionRequests || !UR.updateCompassionRequest) {
    setStatus('Backend not ready.', '#b91c1c'); btn.disabled = false; btn.textContent = orig; return;
  }
  try {
    const cfg = await UR.getAppConfig({ key: 'LEAD_PASTOR_MEMBER_ID' });
    const lpId = String((cfg && cfg.value) || '').trim();
    if (!lpId) { setStatus('No Lead Pastor PIN configured.', '#b91c1c'); btn.disabled = false; btn.textContent = orig; return; }
    const TERMINAL = new Set(['closed','resolved','denied','archived']);
    const all = await UR.listCompassionRequests({ limit: 5000 }).catch(() => []);
    const reqs = Array.isArray(all) ? all : (all?.results || []);
    let updated = 0, skipped = 0, failed = 0;
    for (const c of reqs) {
      const st = String(c.status || '').toLowerCase();
      if (TERMINAL.has(st)) { skipped++; continue; }
      if (!_isGarbage(c.assignedTo) && String(c.assignedTo).trim() === lpId) { skipped++; continue; }
      try { await UR.updateCompassionRequest({ id: c.id, assignedTo: lpId }); updated++; }
      catch (err) { failed++; console.error('[wall/compassion] update failed', c.id, err); }
    }
    setStatus(`Done. ${updated} reassigned, ${skipped} skipped, of ${reqs.length} total.${failed ? ` · ${failed} failed` : ''}`,
      failed ? '#b45309' : '#16a34a');
  } catch (err) {
    setStatus(`Failed: ${err?.message || String(err)}`, '#b91c1c');
  } finally { btn.disabled = false; btn.textContent = orig; }
}

async function _reassignOutreachToLP(root, btn) {
  const status = root.querySelector('[data-bind="outreach-reassign-status"]');
  const setStatus = (msg, color) => { if (status) { status.textContent = msg; status.style.color = color || 'var(--ink-muted,#7a7f96)'; } };
  btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Working…';
  setStatus('Looking up Lead Pastor…');
  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.getAppConfig || !UR.listOutreachContacts || !UR.updateOutreachContact) {
    setStatus('Backend not ready.', '#b91c1c'); btn.disabled = false; btn.textContent = orig; return;
  }
  try {
    const cfg = await UR.getAppConfig({ key: 'LEAD_PASTOR_MEMBER_ID' });
    const lpId = String((cfg && cfg.value) || '').trim();
    if (!lpId) { setStatus('No Lead Pastor PIN configured.', '#b91c1c'); btn.disabled = false; btn.textContent = orig; return; }
    const TERMINAL = new Set(['converted','closed','archived','rejected','dropped']);
    const all = await UR.listOutreachContacts({ limit: 5000 }).catch(() => []);
    const contacts = Array.isArray(all) ? all : (all?.results || []);
    let updated = 0, skipped = 0, failed = 0;
    for (const o of contacts) {
      const st = String(o.status || '').toLowerCase();
      if (TERMINAL.has(st)) { skipped++; continue; }
      if (!_isGarbage(o.assignedTo) && String(o.assignedTo).trim() === lpId) { skipped++; continue; }
      try { await UR.updateOutreachContact({ id: o.id, assignedTo: lpId }); updated++; }
      catch (err) { failed++; console.error('[wall/outreach] update failed', o.id, err); }
    }
    setStatus(`Done. ${updated} reassigned, ${skipped} skipped, of ${contacts.length} total.${failed ? ` · ${failed} failed` : ''}`,
      failed ? '#b45309' : '#16a34a');
  } catch (err) {
    setStatus(`Failed: ${err?.message || String(err)}`, '#b91c1c');
  } finally { btn.disabled = false; btn.textContent = orig; }
}

async function _fillBlankAssignments(root, btn) {
  const status = root.querySelector('[data-bind="fill-blank-status"]');
  const setStatus = (msg, color) => { if (status) { status.textContent = msg; status.style.color = color || 'var(--ink-muted,#7a7f96)'; } };
  btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Scanning…';
  setStatus('Looking up Lead Pastor…');
  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.getAppConfig) { setStatus('Backend not ready.', '#b91c1c'); btn.disabled = false; btn.textContent = orig; return; }
  try {
    const cfg = await UR.getAppConfig({ key: 'LEAD_PASTOR_MEMBER_ID' });
    const lpId = String((cfg && cfg.value) || '').trim();
    if (!lpId) { setStatus('No Lead Pastor PIN configured.', '#b91c1c'); btn.disabled = false; btn.textContent = orig; return; }
    let total = 0, fixed = 0, failed = 0;

    // Care cases — primaryCaregiverId
    if (UR.listCareCases && UR.updateCareCase) {
      const TERMINAL = new Set(['resolved','closed','archived','cancelled','completed','denied']);
      const all = await UR.listCareCases({ limit: 1000 }).catch(() => []);
      const rows = Array.isArray(all) ? all : (all?.results || []);
      for (const c of rows) {
        if (TERMINAL.has(String(c.status || '').toLowerCase())) continue;
        if (!_isGarbage(c.primaryCaregiverId)) continue;
        total++;
        try { await UR.updateCareCase({ id: c.id, primaryCaregiverId: lpId }); fixed++; }
        catch (err) { failed++; console.error('[wall/fill] case', c.id, err); }
      }
    }
    // Prayers — assignedTo
    if (UR.listPrayers && UR.updatePrayer) {
      const TERMINAL = new Set(['answered','closed','archived','resolved']);
      const all = await UR.listPrayers({ allUsers: true, limit: 1000 }).catch(() => []);
      const rows = Array.isArray(all) ? all : (all?.results || []);
      for (const p of rows) {
        if (TERMINAL.has(String(p.status || '').toLowerCase())) continue;
        if (!_isGarbage(p.assignedTo)) continue;
        total++;
        try { await UR.updatePrayer(p.id, { assignedTo: lpId }); fixed++; }
        catch (err) { failed++; console.error('[wall/fill] prayer', p.id, err); }
      }
    }
    // Outreach — assignedTo
    if (UR.listOutreachContacts && UR.updateOutreachContact) {
      const TERMINAL = new Set(['converted','closed','archived','rejected','dropped']);
      const all = await UR.listOutreachContacts({ limit: 5000 }).catch(() => []);
      const rows = Array.isArray(all) ? all : (all?.results || []);
      for (const o of rows) {
        if (TERMINAL.has(String(o.status || '').toLowerCase())) continue;
        if (!_isGarbage(o.assignedTo)) continue;
        total++;
        try { await UR.updateOutreachContact({ id: o.id, assignedTo: lpId }); fixed++; }
        catch (err) { failed++; console.error('[wall/fill] outreach', o.id, err); }
      }
    }
    // Compassion — assignedTo
    if (UR.listCompassionRequests && UR.updateCompassionRequest) {
      const TERMINAL = new Set(['closed','resolved','denied','archived']);
      const all = await UR.listCompassionRequests({ limit: 5000 }).catch(() => []);
      const rows = Array.isArray(all) ? all : (all?.results || []);
      for (const c of rows) {
        if (TERMINAL.has(String(c.status || '').toLowerCase())) continue;
        if (!_isGarbage(c.assignedTo)) continue;
        total++;
        try { await UR.updateCompassionRequest({ id: c.id, assignedTo: lpId }); fixed++; }
        catch (err) { failed++; console.error('[wall/fill] compassion', c.id, err); }
      }
    }
    setStatus(`Done. ${fixed} blank assignments filled with LP PIN (${total} found).${failed ? ` · ${failed} failed` : ''}`,
      failed ? '#b45309' : '#16a34a');
  } catch (err) {
    setStatus(`Failed: ${err?.message || String(err)}`, '#b91c1c');
  } finally { btn.disabled = false; btn.textContent = orig; }
}

async function _dedupCareAssignments(root, btn) {
  const status = root.querySelector('[data-bind="dedup-status"]');
  const setStatus = (msg, color) => { if (status) { status.textContent = msg; status.style.color = color || 'var(--ink-muted,#7a7f96)'; } };
  btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Scanning…';
  setStatus('Loading all care assignments…');
  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.listCareAssignments || !UR.endCareAssignment) {
    setStatus('Backend not ready.', '#b91c1c'); btn.disabled = false; btn.textContent = orig; return;
  }
  try {
    const all = await UR.listCareAssignments({ limit: 5000 }).catch(() => []);
    const rows = Array.isArray(all) ? all : (all?.results || []);
    // Group Active rows by memberId+caregiverId, keep first (oldest — Firestore returns desc, so last)
    const seen = {}; // "memberId|caregiverId" → true
    const toEnd = [];
    // Reverse so we process oldest first (want to keep oldest)
    const active = rows.filter((a) => String(a.status || '').toLowerCase() === 'active');
    const byKey = {};
    for (const a of active) {
      const key = `${String(a.memberId||'unknown')}|${String(a.caregiverId||'unknown')}`;
      (byKey[key] = byKey[key] || []).push(a);
    }
    for (const [, group] of Object.entries(byKey)) {
      if (group.length <= 1) continue;
      // Keep the first (oldest by createdAt); end the rest
      group.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || a.createdAt || 0;
        const tb = b.createdAt?.toMillis?.() || b.createdAt || 0;
        return ta - tb;
      });
      for (const dup of group.slice(1)) toEnd.push(dup.id);
    }
    let ended = 0, failed = 0;
    for (const id of toEnd) {
      try { await UR.endCareAssignment(id); ended++; }
      catch (err) { failed++; console.error('[wall/dedup] end failed', id, err); }
    }
    setStatus(
      toEnd.length === 0
        ? `No duplicates found across ${active.length} Active assignments.`
        : `Done. ${ended} duplicate assignments ended.${failed ? ` · ${failed} failed` : ''}`,
      failed ? '#b45309' : '#16a34a'
    );
  } catch (err) {
    setStatus(`Failed: ${err?.message || String(err)}`, '#b91c1c');
  } finally { btn.disabled = false; btn.textContent = orig; }
}

async function _genMissingMemberPins(root, btn) {
  const status = root.querySelector('[data-bind="pins-status"]');
  const setStatus = (msg, color) => { if (status) { status.textContent = msg; status.style.color = color || 'var(--ink-muted,#7a7f96)'; } };
  btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Working…';
  setStatus('Loading members…');
  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.listMembers || !UR.updateMember) {
    setStatus('Backend not ready.', '#b91c1c'); btn.disabled = false; btn.textContent = orig; return;
  }
  const genPin = () => { const n = String(Math.floor(Math.random() * 900000000) + 100000000); return n.slice(0,3)+'-'+n.slice(3,5)+'-'+n.slice(5); };
  try {
    const all = await UR.listMembers({ limit: 5000 }).catch(() => []);
    const members = Array.isArray(all) ? all : (all?.results || []);
    let generated = 0, skipped = 0, failed = 0;
    for (const m of members) {
      if (m.memberPin && String(m.memberPin).trim()) { skipped++; continue; }
      const pin = genPin();
      try { await UR.updateMember({ id: m.id, memberPin: pin }); generated++; }
      catch (err) { failed++; console.error('[wall/pins] update failed', m.id, err); }
    }
    setStatus(`Done. ${generated} PINs generated, ${skipped} members already had PINs.${failed ? ` · ${failed} failed` : ''}`,
      failed ? '#b45309' : '#16a34a');
  } catch (err) {
    setStatus(`Failed: ${err?.message || String(err)}`, '#b91c1c');
  } finally { btn.disabled = false; btn.textContent = orig; }
}

async function _endInactiveAssignments(root, btn) {
  const status = root.querySelector('[data-bind="end-inactive-status"]');
  const setStatus = (msg, color) => { if (status) { status.textContent = msg; status.style.color = color || 'var(--ink-muted,#7a7f96)'; } };
  btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Working…';
  setStatus('Loading care assignments…');
  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.listCareAssignments || !UR.endCareAssignment) {
    setStatus('Backend not ready.', '#b91c1c'); btn.disabled = false; btn.textContent = orig; return;
  }
  try {
    const all = await UR.listCareAssignments({ limit: 5000 }).catch(() => []);
    const rows = Array.isArray(all) ? all : (all?.results || []);
    let ended = 0, skipped = 0, failed = 0;
    for (const a of rows) {
      const st = String(a.status || '').toLowerCase();
      if (st === 'active') { skipped++; continue; }
      if (st === 'ended') { skipped++; continue; } // already clean
      try { await UR.endCareAssignment(a.id); ended++; }
      catch (err) { failed++; console.error('[wall/end-inactive] failed', a.id, err); }
    }
    setStatus(`Done. ${ended} assignments ended, ${skipped} skipped (Active or already Ended).${failed ? ` · ${failed} failed` : ''}`,
      failed ? '#b45309' : '#16a34a');
  } catch (err) {
    setStatus(`Failed: ${err?.message || String(err)}`, '#b91c1c');
  } finally { btn.disabled = false; btn.textContent = orig; }
}

function _settingRow(s) {
  if (s.type === 'jp-api') {
    return /* html */`
      <div class="wall-setting-row" style="align-items:flex-start;gap:12px">
        <div class="wall-setting-label" style="padding-top:6px">Joshua Project API</div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <span class="wall-status-badge wall-status--muted" data-bind="jp-status">Loading…</span>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            <input type="password" class="wall-jp-key-input" data-bind="jp-key-input"
              placeholder="Paste API key…"
              autocomplete="off" spellcheck="false"
              style="font-size:.82rem;padding:5px 8px;border:1px solid var(--line,#e5e7ef);border-radius:6px;width:210px;background:var(--bg-raised,#fff);color:var(--ink,#1b264f)" />
            <button class="flock-btn flock-btn--primary flock-btn--sm" data-act="jp-save-test" type="button">Save &amp; Test</button>
          </div>
          <a href="https://api.joshuaproject.net/" target="_blank" rel="noopener noreferrer"
            style="font-size:.75rem;color:var(--accent,#4a7fa5);text-decoration:none">Get an API key ↗</a>
        </div>
      </div>`;
  }
  if (s.type === 'bible-api') {
    return /* html */`
      <div class="wall-setting-row" style="align-items:flex-start;gap:12px">
        <div class="wall-setting-label" style="padding-top:6px">api.bible</div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <span class="wall-status-badge wall-status--muted" data-bind="bible-status">Loading…</span>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            <input type="password" class="wall-jp-key-input" data-bind="bible-key-input"
              placeholder="Paste API key…"
              autocomplete="off" spellcheck="false"
              style="font-size:.82rem;padding:5px 8px;border:1px solid var(--line,#e5e7ef);border-radius:6px;width:210px;background:var(--bg-raised,#fff);color:var(--ink,#1b264f)" />
            <button class="flock-btn flock-btn--primary flock-btn--sm" data-act="bible-save-test" type="button">Save &amp; Test</button>
          </div>
          <a href="https://scripture.api.bible/sign-up" target="_blank" rel="noopener noreferrer"
            style="font-size:.75rem;color:var(--accent,#4a7fa5);text-decoration:none">Get a free key at api.bible ↗</a>
        </div>
      </div>`;
  }
  if (s.type === 'vapid') {
    return /* html */`
      <div class="wall-setting-row" style="align-items:flex-start;gap:12px">
        <div class="wall-setting-label" style="padding-top:6px">Push Notifications</div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <span class="wall-status-badge wall-status--muted" data-bind="vapid-status">Loading…</span>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            <input type="password" class="wall-jp-key-input" data-bind="vapid-key-input"
              placeholder="Paste VAPID Web Push key…"
              autocomplete="off" spellcheck="false"
              style="font-size:.82rem;padding:5px 8px;border:1px solid var(--line,#e5e7ef);border-radius:6px;width:260px;background:var(--bg-raised,#fff);color:var(--ink,#1b264f)" />
            <button class="flock-btn flock-btn--primary flock-btn--sm" data-act="vapid-save" type="button">Save</button>
          </div>
          <a href="https://console.firebase.google.com/project/_/settings/cloudmessaging"
            target="_blank" rel="noopener noreferrer"
            style="font-size:.75rem;color:var(--accent,#4a7fa5);text-decoration:none"
            >Firebase Console → Cloud Messaging → Web Push certificates ↗</a>
        </div>
      </div>`;
  }
  if (s.type === 'checkr-api') {
    return /* html */`
      <div class="wall-setting-row" style="align-items:flex-start;gap:12px">
        <div class="wall-setting-label" style="padding-top:6px">Checkr Background Checks</div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <span class="wall-status-badge wall-status--muted" data-bind="checkr-status">Loading…</span>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            <input type="password" class="wall-jp-key-input" data-bind="checkr-key-input"
              placeholder="Paste Checkr Secret API key…"
              autocomplete="off" spellcheck="false"
              style="font-size:.82rem;padding:5px 8px;border:1px solid var(--line,#e5e7ef);border-radius:6px;width:260px;background:var(--bg-raised,#fff);color:var(--ink,#1b264f)" />
            <button class="flock-btn flock-btn--primary flock-btn--sm" data-act="checkr-save" type="button">Save</button>
          </div>
          <a href="https://dashboard.checkr.com/account/developer_settings" target="_blank" rel="noopener noreferrer"
            style="font-size:.75rem;color:var(--accent,#4a7fa5);text-decoration:none">Get your key at Checkr Dashboard ↗</a>
          <div style="margin-top:8px;padding:10px 12px;border-radius:8px;background:var(--bg-alt,#f5f6fa);border:1px solid var(--line,#e5e7ef);font-size:.77rem;line-height:1.55;color:var(--ink-muted,#7a7f96);max-width:320px;text-align:left">
            <strong style="color:var(--ink,#1b264f);display:block;margin-bottom:4px">After saving your key:</strong>
            1. Deploy Cloud Functions:<br>
            <code style="font-size:.73rem;background:var(--bg,#fff);padding:1px 4px;border-radius:3px;border:1px solid var(--line,#e5e7ef)">firebase deploy --only functions</code><br><br>
            2. In your <a href="https://dashboard.checkr.com/webhooks" target="_blank" rel="noopener noreferrer" style="color:var(--accent,#4a7fa5)">Checkr Webhook Settings ↗</a>, add:<br>
            <code style="font-size:.72rem;background:var(--bg,#fff);padding:1px 4px;border-radius:3px;border:1px solid var(--line,#e5e7ef);word-break:break-all">https://&lt;region&gt;-&lt;projectId&gt;.cloudfunctions.net/checkrWebhook</code><br><br>
            Subscribe to <strong style="color:var(--ink,#1b264f)">report.completed</strong> events.
          </div>
        </div>
      </div>`;
  }
  if (s.type === 'network-status-heading') {
    return /* html */`
      <div class="wall-setting-row" style="border-top:1px solid var(--line,#e5e7ef);margin-top:6px;padding-top:18px;align-items:center">
        <div style="font:700 0.78rem var(--font-ui);text-transform:uppercase;letter-spacing:.07em;color:var(--ink-muted,#7a7f96)">
          Network Status
        </div>
        <div style="font:0.77rem var(--font-ui);color:var(--ink-muted,#7a7f96);text-align:right">
          Live polling
        </div>
      </div>`;
  }
  if (s.type === 'missions-sources-heading') {
    return /* html */`
      <div class="wall-setting-row" style="border-top:1px solid var(--line,#e5e7ef);margin-top:6px;padding-top:18px;align-items:center">
        <div style="font:700 0.78rem var(--font-ui);text-transform:uppercase;letter-spacing:.07em;color:var(--ink-muted,#7a7f96)">
          Missions Data Sources
        </div>
        <div style="font:0.77rem var(--font-ui);color:var(--ink-muted,#7a7f96);text-align:right">
          Live polling — status reflects website availability
        </div>
      </div>`;
  }
  if (s.type === 'missions-source') {
    return /* html */`
      <div class="wall-setting-row wall-ms-src-row" data-ms-src-id="${_e(s.id)}" style="align-items:center;gap:14px">
        <div style="flex:1;min-width:0">
          <div style="font:600 0.88rem var(--font-ui);color:var(--ink,#1b264f)">${_e(s.label)}</div>
          <div style="font:0.77rem var(--font-ui);color:var(--ink-muted,#7a7f96);margin-top:2px">${_e(s.desc)}</div>
          <a href="${_e(s.url)}" target="_blank" rel="noopener noreferrer"
             style="font:0.74rem var(--font-ui);color:var(--accent,#4a7fa5);text-decoration:none">${_e(s.url.replace(/^https?:\/\//, ''))} ↗</a>
        </div>
        <span class="wall-status-badge wall-status--muted" data-bind="ms-src-badge-${_e(s.id)}">Checking…</span>
      </div>`;
  }
  if (s.type === 'toggle') {
    return /* html */`
      <div class="wall-setting-row">
        <div class="wall-setting-label">${_e(s.label)}</div>
        <div class="wall-toggle${s.on ? ' wall-toggle--on' : ''}" role="switch" aria-checked="${s.on}" tabindex="0">
          <div class="wall-toggle-thumb"></div>
        </div>
      </div>`;
  }
  if (s.type === 'badge') {
    return /* html */`
      <div class="wall-setting-row">
        <div class="wall-setting-label">${_e(s.label)}</div>
        <span class="wall-status-badge wall-status--${_e(s.status)}">${_e(s.value)}</span>
      </div>`;
  }
  return /* html */`
    <div class="wall-setting-row">
      <label class="wall-setting-label">${_e(s.label)}</label>
      <div class="wall-setting-value">${_e(s.value)}</div>
    </div>`;
}

function _e(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── Dependency map panel ────────────────────────────────────────────────── */

const _DEP_MAP = {
  generated: new Date().toISOString().split('T')[0],
  entry: 'New_Covenant/index.html',
  layers: [
    {
      name: 'Firebase compat SDK',
      type: 'defer-script',
      role: 'Cloud database, auth, and functions',
      scripts: [
        'firebase-app-compat.js',
        'firebase-firestore-compat.js',
        'firebase-auth-compat.js',
        'firebase-functions-compat.js',
      ],
    },
    {
      name: 'Classic Backend (defer)',
      type: 'defer-script',
      role: 'Tabernacle service layer — shared with legacy FlockOS shell',
      scripts: [
        { file: 'firm_foundation.js',    role: 'Boot utilities & GAS URL resolver' },
        { file: 'the_upper_room.js',     global: 'UpperRoom',      role: 'Realtime comms auth & Firestore' },
        { file: 'fine_linen.js',         role: 'Shared utility belt' },
        { file: 'the_true_vine.js',      global: 'TheVine',        role: 'GAS + Firestore API client (4 branches: flock/missions/extra/app)' },
        { file: 'the_wellspring.js',     global: 'TheWellspring',  role: 'Offline-first data engine' },
        { file: 'the_well.js',           global: 'TheWell',        role: 'In-memory & IndexedDB cache' },
        { file: 'the_tabernacle.js',     role: 'Legacy view engine (Tabernacle modules)' },
        { file: 'the_truth.js',          global: 'TheTruth',       role: 'Scripture & apologetics data' },
        { file: 'the_seasons.js',        global: 'TheSeason',      role: 'Calendar & church calendar data' },
        { file: 'the_way.js',            global: 'TheWay',         role: 'Discipleship paths' },
        { file: 'the_harvest.js',        global: 'TheHarvest',     role: 'Outreach & evangelism' },
        { file: 'the_life.js',           global: 'TheLife',        role: 'Pastoral care engine' },
        { file: 'the_shepherd.js',       global: 'TheShepherd',    role: 'Member & shepherding layer' },
        { file: 'the_fold.js',           global: 'TheFold',        role: 'Flock directory & groups' },
        { file: 'the_scrolls.js',        global: 'TheScrolls',     role: 'GAS file transmission' },
        { file: 'the_window_bridge.js',  role: 'Promotes all ↑ globals to window.*' },
      ],
    },
    {
      name: 'ES Module Boot (modulepreload)',
      type: 'module',
      role: 'New Covenant shell — loaded in parallel via <link rel=modulepreload>',
      scripts: [
        { file: 'the_ark.js',                    role: 'Entry point — mounts veil, registers views, handles routing' },
        { file: 'the_adornment.js',              role: 'Theme engine — dark/light mode, flash prevention' },
        { file: 'the_lampstand.js',              role: 'UI component library' },
        { file: 'the_oil.js',                    role: 'Session & auth state manager' },
        { file: 'the_watchmen.js',               role: 'Global error boundary & unhandled rejection reporter' },
        { file: 'the_living_water_register.js',  role: 'Service worker registration (PWA / offline)' },
        { file: 'the_legacy_bridge.js',          role: 'window.* → ES module bridge (polls globals)' },
        { file: 'the_manna.js',                  role: 'Offline-first data layer (IndexedDB queue)' },
        { file: 'the_cistern.js',                role: 'Cache utilities (TTL, stale-while-revalidate)' },
      ],
    },
    {
      name: 'Router — the_scribes/',
      type: 'module',
      role: 'Client-side router — hash/query routing, history, prefetch',
      scripts: ['index.js', 'the_path.js', 'the_chronicle.js', 'the_herald.js'],
    },
    {
      name: 'Chrome — the_veil/',
      type: 'module',
      role: 'App shell — topbar, sidebar nav, main content mount, footer',
      scripts: [
        { file: 'index.js',          role: 'Shell orchestrator' },
        { file: 'the_crown.js',      role: 'Topbar (search, profile, dark-mode toggle)' },
        { file: 'the_pillars.js',    role: 'Sidebar navigation (SECTIONS data + badge mounts)' },
        { file: 'the_courtyard.js',  role: 'Main content area (view mount / unmount)' },
        { file: 'the_hem.js',        role: 'Mobile footer tab bar' },
        { file: 'the_refresh.js',    role: 'Pull-to-refresh gesture handler for the courtyard scroll container' },
      ],
    },
    {
      name: 'Auth — the_priesthood/',
      type: 'module',
      role: 'Authentication, session tokens, RBAC guards',
      scripts: [
        { file: 'index.js',              role: 'Auth orchestrator' },
        { file: 'the_garments.js',       role: 'Session tokens & persistence' },
        { file: 'the_anointing.js',      role: 'Login / logout flow, sign-in UI' },
        { file: 'the_breastplate.js',    role: 'Role-based access control guards' },
      ],
    },
    {
      name: 'Realtime Comms — the_upper_room/ (ES module layer)',
      type: 'module',
      role: 'Firebase Firestore/Auth realtime layer for channels, DMs, presence',
      scripts: [
        'index.js', 'the_firebase_config.js', 'the_tenant.js', 'the_identity.js',
        'the_channels.js', 'the_messages.js', 'the_dms.js', 'the_presence.js',
        'the_typing.js', 'the_unread.js', 'the_mentions.js', 'the_emoji.js',
        'the_seeding.js', 'the_attachments.js', 'the_push.js',
      ],
    },
    {
      name: 'Care Module — the_life/ (ES module layer)',
      type: 'module',
      role: 'Pastoral care badge subscription and warm-up',
      scripts: ['index.js'],
    },
    {
      name: 'Scripture — the_scrolls/',
      type: 'module',
      role: 'Interaction ledger + auto-linkified scripture references',
      scripts: [
        { file: 'index.js',           role: 'Unified interaction ledger (touches, calls, texts, notes)' },
        { file: 'the_bible_link.js',  role: 'Auto-linkify scripture references → bible.com (ESV)' },
      ],
    },
    {
      name: 'Device APIs — the_trumpet/',
      type: 'module',
      role: 'Phone & device integration — browser-native, no external dependencies',
      scripts: [
        { file: 'index.js',  role: 'Calling, SMS, clipboard, share, contacts & device sensor facade' },
      ],
    },
    {
      name: 'Utility Modules (dynamic imports)',
      type: 'module',
      role: 'Helper modules loaded on demand by the shell and views',
      scripts: [
        { file: 'the_comms.js',                role: 'Unified comms façade across FlockChat, channels, and push surfaces' },
        { file: 'the_living_water_adapter.js',  role: 'Shared Firestore-first / GAS-fallback data factory' },
        { file: 'the_stones.js',               role: 'Input validators & form sanitizers' },
        { file: 'the_witness.js',              role: 'Runtime self-checks (dev only — activate with ?witness=1)' },
      ],
    },
    {
      name: 'UI Components — vessels/',
      type: 'module',
      role: 'Custom web components (<flock-input>, <flock-card>, etc.) — imported by views on demand',
      scripts: [
        'the_basin.js', 'the_censer.js', 'the_chalice.js', 'the_cup.js',
        'the_mantle.js', 'the_menorah.js', 'the_rod.js', 'the_seal.js',
        'the_signet.js', 'the_staff.js',
      ],
    },
  ],
  views: {
    Home:         ['the_good_shepherd'],
    Worship:      ['the_anatomy_of_worship', 'quarterly_worship', 'the_pentecost'],
    Mission:      ['the_great_commission', 'the_gospel_invitation', 'the_harvest', 'the_way', 'the_truth', 'fishing_for_men', 'fishing_for_data'],
    Comms:        ['the_fellowship', 'the_announcements', 'the_prayer_chain', 'the_upper_room'],
    Care:         ['the_fold', 'the_life', 'the_seasons', 'the_call_to_forgive', 'prayerful_action'],
    Discipleship: [
      'the_growth', 'the_gospel_courses', 'the_gospel_quizzes', 'the_gospel_reading',
      'the_gospel_theology', 'the_gospel_teaching_plans', 'the_gospel_lexicon',
      'the_gospel_library', 'the_gospel_devotionals', 'the_gospel_apologetics',
      'the_gospel_counseling', 'the_gospel_heart', 'the_gospel_mirror',
      'the_gospel_genealogy', 'the_gospel_journal', 'the_gospel_certificates',
      'the_gospel_analytics',
    ],
    Stewardship:  ['the_gift_drift', 'the_weavers_plan'],
    Legacy:       ['the_generations'],
    Build:        ['the_wall', 'bezalel', 'content-admin', 'the_invitation', 'software_deployment_referral', 'about_flockos', 'learn_more'],
  },
};

function _depMapPanelMarkup() {
  const totalScripts = _DEP_MAP.layers.reduce((n, l) => n + l.scripts.length, 0);
  const totalViews   = Object.values(_DEP_MAP.views).flat().length;
  const totalGlobals = _DEP_MAP.layers
    .flatMap(l => l.scripts)
    .filter(s => typeof s === 'object' && s.global).length;

  const pill = (label, color) =>
    `<span style="font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:99px;background:${color}20;color:${color};border:1px solid ${color}40;">${label}</span>`;

  const layerColors = {
    'defer-script': '#d97706',
    'module':       '#6366f1',
  };

  const scriptLine = (s, indent = '│   ') => {
    if (typeof s === 'string') {
      return `${indent}<span style="color:var(--ink-muted)">${_e(s)}</span>\n`;
    }
    const g = s.global ? ` <span style="color:#10b981;font-weight:600;">→ window.${_e(s.global)}</span>` : '';
    return `${indent}<span style="color:var(--ink)">${_e(s.file)}</span>${g}<span style="color:var(--ink-muted);font-size:.75em;">  ${_e(s.role)}</span>\n`;
  };

  const layerBlocks = _DEP_MAP.layers.map((l, i) => {
    const color = layerColors[l.type] || '#6366f1';
    const isLast = i === _DEP_MAP.layers.length - 1;
    const connector = isLast ? '└─' : '├─';
    const childPfx  = isLast ? '    ' : '│   ';
    const scripts = l.scripts.map(s => scriptLine(s, childPfx)).join('');
    return `${connector} <span style="color:${color};font-weight:700;">[${_e(l.name)}]</span>  <span style="color:var(--ink-muted);font-size:.8em;">${_e(l.role)}</span>\n${scripts}`;
  }).join('\n');

  const viewBlocks = Object.entries(_DEP_MAP.views).map(([cat, views], i, arr) => {
    const isLast = i === arr.length - 1;
    const connector = isLast ? '    └─' : '    ├─';
    const names = views.map(v => `<span style="color:#6366f1">${_e(v)}</span>`).join('  ');
    return `${connector} <span style="color:#0ea5e9;font-weight:600;">${_e(cat)}</span>  ${names}`;
  }).join('\n');

  const tree = `<span style="color:var(--gold);font-weight:700;">New Covenant PWA</span>  ·  <span style="color:var(--ink-muted)">index.html</span>
│
${layerBlocks}
├─ <span style="color:#0ea5e9;font-weight:700;">[Views]</span>  <span style="color:var(--ink-muted);font-size:.8em;">Lazy dynamic imports via the_ark.js — ${totalViews} registered</span>
${viewBlocks}`;

  return `
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
  <div class="inv-stat-card" style="flex:1;min-width:120px;padding:12px 16px;">
    <div class="inv-stat-n" style="color:#6366f1;font-size:1.4rem;">${totalScripts}</div>
    <div class="inv-stat-label">Scripts</div>
  </div>
  <div class="inv-stat-card" style="flex:1;min-width:120px;padding:12px 16px;">
    <div class="inv-stat-n" style="color:#0ea5e9;font-size:1.4rem;">${totalViews}</div>
    <div class="inv-stat-label">Views</div>
  </div>
  <div class="inv-stat-card" style="flex:1;min-width:120px;padding:12px 16px;">
    <div class="inv-stat-n" style="color:#10b981;font-size:1.4rem;">${totalGlobals}</div>
    <div class="inv-stat-label">Window Globals</div>
  </div>
  <div class="inv-stat-card" style="flex:1;min-width:120px;padding:12px 16px;">
    <div class="inv-stat-n" style="color:#d97706;font-size:1.4rem;">${_DEP_MAP.layers.length}</div>
    <div class="inv-stat-label">Layers</div>
  </div>
</div>

<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
  <div style="font-size:.82rem;color:var(--ink-muted);">
    Architecture tree — entry point → layers → views.
    ${pill('defer', '#d97706')} = classic script &nbsp; ${pill('module', '#6366f1')} = ES module &nbsp;
    <span style="color:#10b981;font-weight:600;">→ window.X</span> = global exposed via bridge
  </div>
  <div style="display:flex;gap:8px;">
    <button class="flock-btn flock-btn--ghost" style="font-size:.78rem;padding:6px 14px;" data-act="dm-copy-tree">📋 Copy tree</button>
    <button class="flock-btn flock-btn--ghost" style="font-size:.78rem;padding:6px 14px;" data-act="dm-copy-json">{ } Copy JSON</button>
  </div>
</div>

<pre id="dm-tree-pre" style="background:var(--bg-sunken);border:1px solid var(--line);border-radius:10px;
  padding:16px;font-size:.74rem;line-height:1.7;overflow-x:auto;white-space:pre-wrap;word-break:break-word;
  max-height:640px;overflow-y:auto;color:var(--ink);font-family:monospace;margin:0;">${tree}</pre>
`;
}

/* ══════════════════════════════════════════════════════════════════════════
   VCF IMPORT / EXPORT HELPERS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Parse a vCard (.vcf) text blob into an array of plain contact objects.
 * Handles multiple vCards per file, folded lines, and common property params.
 */
function _parseVcf(text) {
  // Unfold lines (RFC 2425: continuation lines begin with SPACE or TAB)
  const unfolded = text.replace(/\r\n([ \t])/g, '$1').replace(/\n([ \t])/g, '$1');
  const lines = unfolded.split(/\r\n|\r|\n/);

  const cards = [];
  let cur = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    const upper = line.toUpperCase();

    if (upper === 'BEGIN:VCARD') { cur = {}; continue; }
    if (upper === 'END:VCARD')   { if (cur) cards.push(cur); cur = null; continue; }
    if (!cur) continue;

    const colon = line.indexOf(':');
    if (colon < 0) continue;

    const propFull = line.slice(0, colon).toUpperCase();
    const value    = line.slice(colon + 1).trim();
    const parts    = propFull.split(';');
    const prop     = parts[0];
    const params   = parts.slice(1).join(';');

    switch (prop) {
      case 'FN':
        cur.fn = value;
        break;
      case 'N': {
        // N:Last;First;Middle;Prefix;Suffix
        const n = value.split(';');
        cur.lastName   = (n[0] || '').replace(/\\/g, '').trim();
        cur.firstName  = (n[1] || '').replace(/\\/g, '').trim();
        cur.middleName = (n[2] || '').replace(/\\/g, '').trim();
        cur.prefix     = (n[3] || '').replace(/\\/g, '').trim();
        cur.suffix     = (n[4] || '').replace(/\\/g, '').trim();
        break;
      }
      case 'EMAIL':
        if (!cur.primaryEmail)   cur.primaryEmail   = value.toLowerCase();
        else if (!cur.secondaryEmail) cur.secondaryEmail = value.toLowerCase();
        break;
      case 'TEL': {
        const clean = value.replace(/[^\d+\-()\s.ext]/gi, '').trim();
        const isCell = params.includes('CELL') || params.includes('MOBILE') || params.includes('IPHONE');
        const isWork = params.includes('WORK');
        const isHome = params.includes('HOME');
        if (isCell && !cur.cellPhone)       cur.cellPhone = clean;
        else if (isWork && !cur.workPhone)  cur.workPhone = clean;
        else if (isHome && !cur.homePhone)  cur.homePhone = clean;
        else if (!cur.cellPhone)            cur.cellPhone = clean; // first unlabelled → cell
        break;
      }
      case 'ADR': {
        // ADR:POBox;Extended;Street;City;State;ZIP;Country
        const a = value.split(';');
        if (!cur.streetAddress1) {
          cur.streetAddress1 = (a[2] || '').replace(/\\n/g, ' ').trim();
          cur.city           = (a[3] || '').trim();
          cur.state          = (a[4] || '').trim();
          cur.zipCode        = (a[5] || '').trim();
          cur.country        = (a[6] || '').trim();
        }
        break;
      }
      case 'BDAY': {
        // Accept YYYY-MM-DD or YYYYMMDD
        const bd = value.replace(/[^0-9]/g, '');
        if (bd.length === 8)
          cur.dateOfBirth = `${bd.slice(0,4)}-${bd.slice(4,6)}-${bd.slice(6,8)}`;
        else
          cur.dateOfBirth = value;
        break;
      }
      case 'GENDER':
        if (value === 'M') cur.gender = 'Male';
        else if (value === 'F') cur.gender = 'Female';
        break;
      case 'NOTE':
        cur.notes = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';');
        break;
      case 'ORG':
        cur.organization = value.split(';')[0].trim();
        break;
      case 'TITLE':
        cur.jobTitle = value;
        break;
    }
  }

  // Filter out empty/unparseable cards, then classify companies
  return cards
    .filter(c => c.fn || c.firstName || c.lastName || c.primaryEmail)
    .map(c => {
      const noPersonName = !c.firstName && !c.lastName;
      const fnMatchesOrg = c.organization && c.fn &&
        c.fn.trim().toLowerCase() === c.organization.trim().toLowerCase();
      // A company: has an org name but no individual name (or FN is just the org name)
      c.isCompany = !!(c.organization && (noPersonName || fnMatchesOrg));
      return c;
    });
}

/**
 * Convert an array of member records (from UpperRoom) to a multi-vCard VCF string.
 */
function _membersToVcfText(members) {
  function _vcfEsc(s) { return String(s || '').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
  return members.map(m => {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    const first = m.firstName  || '';
    const last  = m.lastName   || '';
    const full  = [first, last].filter(Boolean).join(' ') || m.displayName || m.name || '(Member)';
    lines.push(`FN:${_vcfEsc(full)}`);
    lines.push(`N:${_vcfEsc(last)};${_vcfEsc(first)};${_vcfEsc(m.middleName||'')};${_vcfEsc(m.prefix||'')};${_vcfEsc(m.suffix||'')}`);
    if (m.primaryEmail)   lines.push(`EMAIL;TYPE=INTERNET,PREF:${m.primaryEmail}`);
    if (m.secondaryEmail) lines.push(`EMAIL;TYPE=INTERNET:${m.secondaryEmail}`);
    // Read canonical 'phone' field first (Fold save handler), fall back to cellPhone/mobilePhone
    const mainPhone = m.phone || m.cellPhone || m.primaryPhone || m.mobilePhone || '';
    if (mainPhone)    lines.push(`TEL;TYPE=CELL,VOICE:${mainPhone}`);
    if (m.homePhone)  lines.push(`TEL;TYPE=HOME,VOICE:${m.homePhone}`);
    if (m.workPhone)  lines.push(`TEL;TYPE=WORK,VOICE:${m.workPhone}`);
    const addrParts = [m.streetAddress1, m.city, m.state, m.zipCode, m.country];
    if (addrParts.some(Boolean))
      lines.push(`ADR:;;${addrParts.map(_vcfEsc).join(';')}`);
    if (m.dateOfBirth) lines.push(`BDAY:${m.dateOfBirth}`);
    if (m.gender === 'Male')   lines.push('GENDER:M');
    if (m.gender === 'Female') lines.push('GENDER:F');
    if (m.notes) lines.push(`NOTE:${_vcfEsc(m.notes)}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }).join('\r\n');
}

/** Render the parsed-contacts preview list inside the import section. */
function _renderVcfPreview(root, contacts, existingEmails, existingNames) {
  existingEmails = existingEmails || new Map();
  existingNames  = existingNames  || new Map();
  const preview = root.querySelector('[data-bind="vcf-preview"]');
  if (!preview) return;
  preview.style.display = '';

  if (!contacts.length) {
    preview.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-muted);font-size:.85rem">No valid contacts found in this file. Make sure it is a valid .vcf (vCard) file.</div>';
    return;
  }

  // Split into people and companies
  const people    = contacts.filter(c => !c.isCompany);
  const companies = contacts.filter(c =>  c.isCompany);

  // Mark duplicates within people — store matched member for later merge
  people.forEach(c => {
    const emailKey   = (c.primaryEmail || '').toLowerCase().trim();
    const nameStr    = [c.firstName, c.lastName].filter(Boolean).join(' ').toLowerCase().trim();
    const fnKey      = (c.fn || '').toLowerCase().trim(); // FN field — full display name from vCard
    const matched    = (emailKey && existingEmails.get(emailKey))
                    || (nameStr && existingNames.get(nameStr))
                    || (fnKey   && existingNames.get(fnKey))
                    || null;
    c._isDuplicate   = !!matched;
    c._existingMember = matched; // full Firestore member record
  });

  const newPeople  = people.filter(c => !c._isDuplicate);
  const dupPeople  = people.filter(c =>  c._isDuplicate);

  // Build a contact row
  const _contactRow = (c, globalIdx, checked, dimmed) => {
    const name = _e(c.fn || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.organization || '(No Name)');
    const chips = [
      c.primaryEmail   ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;background:var(--bg,#f3f4f8);font-size:.78rem;color:var(--ink-muted)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' + _e(c.primaryEmail) + '</span>' : '',
      c.cellPhone      ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;background:var(--bg,#f3f4f8);font-size:.78rem;color:var(--ink-muted)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>' + _e(c.cellPhone) + '</span>' : '',
      c.homePhone      ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;background:var(--bg,#f3f4f8);font-size:.78rem;color:var(--ink-muted)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' + _e(c.homePhone) + '</span>' : '',
      c.workPhone      ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;background:var(--bg,#f3f4f8);font-size:.78rem;color:var(--ink-muted)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>' + _e(c.workPhone) + '</span>' : '',
      (c.city || c.state) ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;background:var(--bg,#f3f4f8);font-size:.78rem;color:var(--ink-muted)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' + _e([c.city, c.state].filter(Boolean).join(', ')) + '</span>' : '',
      c.dateOfBirth    ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;background:var(--bg,#f3f4f8);font-size:.78rem;color:var(--ink-muted)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + _e(c.dateOfBirth) + '</span>' : '',
      c.organization && !c.isCompany ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;background:var(--bg,#f3f4f8);font-size:.78rem;color:var(--ink-muted)">🏢 ' + _e(c.organization) + '</span>' : '',
    ].filter(Boolean).join('');
    const dupBadge = c._isDuplicate
      ? '<span style="display:inline-flex;align-items:center;padding:2px 9px;border-radius:99px;background:#fef9c3;border:1px solid #fbbf24;font-size:.72rem;font-weight:700;color:#92400e">✏️ Will fill blank fields</span>'
      : '';
    const rowBg = dimmed ? 'background:var(--bg-sunken,#f9fafb);' : '';
    return '<label style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line,#e5e7ef);cursor:pointer;' + rowBg + '" data-vcf-row="' + globalIdx + '">'
      + '<input type="checkbox" data-vcf-idx="' + globalIdx + '"' + (checked ? ' checked' : '') + ' style="margin-top:3px;flex-shrink:0;width:16px;height:16px;accent-color:var(--accent,#3d8b4f)">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-bottom:5px"><span style="font-weight:600;font-size:.9rem;color:var(--ink,#1b264f)">' + name + '</span>' + dupBadge + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:5px">' + (chips || '<span style="font-size:.78rem;color:var(--ink-muted)">No contact details</span>') + '</div>'
      + '</div></label>';
  };

  // Section header helper
  const _sectionHead = (label, count, color, note) =>
    '<div style="padding:9px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:' + color + ';border-bottom:1px solid var(--line,#e5e7ef)">'
    + '<div style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted)">' + _e(label) + ' <span style="font-weight:800;color:var(--ink)">' + count + '</span></div>'
    + (note ? '<div style="font-size:.75rem;color:var(--ink-muted)">' + note + '</div>' : '')
    + '</div>';

  // Build people rows (new first, then duplicates)
  let peopleHtml = '';
  if (newPeople.length) {
    peopleHtml += _sectionHead('New — ready to import', newPeople.length, 'var(--bg-sunken,#f3f4f8)', '');
    peopleHtml += newPeople.map(c => _contactRow(c, contacts.indexOf(c), true, false)).join('');
  }
  if (dupPeople.length) {
    peopleHtml += _sectionHead('Already in system', dupPeople.length, '#fffbeb', 'Check to fill in any blank fields — existing data is never overwritten');
    peopleHtml += dupPeople.map(c => _contactRow(c, contacts.indexOf(c), false, true)).join('');
  }
  if (!people.length) {
    peopleHtml = '<div style="padding:16px 14px;font-size:.85rem;color:var(--ink-muted)">No individual contacts found.</div>';
  }

  // Build companies section (collapsed by default)
  let companiesHtml = '';
  if (companies.length) {
    const compRows = companies.map(c => _contactRow(c, contacts.indexOf(c), false, true)).join('');
    companiesHtml = '<details style="border-top:2px solid var(--line,#e5e7ef)">'
      + '<summary style="padding:10px 14px;cursor:pointer;font-size:.82rem;font-weight:700;color:var(--ink-muted);list-style:none;display:flex;align-items:center;gap:8px;user-select:none">'
      + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>'
      + 'Companies / Organisations (' + companies.length + ') — unchecked by default — click to expand'
      + '</summary>'
      + '<div>' + compRows + '</div>'
      + '</details>';
  }

  const totalNew = newPeople.length;
  preview.innerHTML =
    '<div style="padding:12px 14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;background:var(--bg-sunken,#f3f4f8);border-bottom:1px solid var(--line,#e5e7ef)">'
    + '<div style="font-size:.88rem;font-weight:700;color:var(--ink,#1b264f)">'
    + contacts.length + ' card' + (contacts.length !== 1 ? 's' : '') + ' parsed'
    + ' &nbsp;·&nbsp; '
    + '<span style="color:#16a34a">' + newPeople.length + ' new</span>'
    + (dupPeople.length  ? ' &nbsp;·&nbsp; <span style="color:#d97706">' + dupPeople.length + ' already exist</span>' : '')
    + (companies.length  ? ' &nbsp;·&nbsp; <span style="color:var(--ink-muted)">' + companies.length + ' companies</span>' : '')
    + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="flock-btn flock-btn--ghost" style="font-size:.78rem;padding:5px 12px" data-act="vcf-select-all" type="button">Select All</button>'
    + '<button class="flock-btn flock-btn--ghost" style="font-size:.78rem;padding:5px 12px" data-act="vcf-deselect-all" type="button">Deselect All</button>'
    + '</div></div>'
    + '<div style="max-height:480px;overflow-y:auto" data-bind="vcf-contact-list">' + peopleHtml + companiesHtml + '</div>'
    + '<div style="padding:12px 14px;display:flex;align-items:center;gap:12px;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid var(--line,#e5e7ef)">'
    + '<span data-bind="vcf-import-status" style="flex:1;font-size:.82rem;color:var(--ink-muted)">'
    + (totalNew ? totalNew + ' new contact' + (totalNew !== 1 ? 's' : '') + ' pre-selected.' : 'All contacts already exist in the system.')
    + '</span>'
    + '<button class="flock-btn flock-btn--primary" data-act="vcf-import-selected" type="button">'
    + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:-1px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
    + 'Import Selected</button></div>';

  // Stash parsed contacts on the element so the import handler can read them
  preview._vcfContacts = contacts;
}

/** Export all members as a .vcf download. */
async function _vcfExport(root, btn) {
  const status = root.querySelector('[data-bind="vcf-export-status"]');
  const setS = (msg, col) => { if (status) { status.textContent = msg; status.style.color = col || 'var(--ink-muted)'; } };

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.textContent = 'Loading…';
  setS('Fetching members…');

  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.listMembers) {
    setS('Backend not available.', '#b91c1c');
    btn.disabled = false; btn.innerHTML = orig;
    return;
  }

  try {
    const members = await UR.listMembers({ limit: 5000 });
    if (!members.length) {
      setS('No members found.', '#b45309');
      btn.disabled = false; btn.innerHTML = orig;
      return;
    }

    const vcfText = _membersToVcfText(members);
    const blob = new Blob([vcfText], { type: 'text/vcard;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = `FlockOS_Members_${date}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    setS(`✓ Exported ${members.length} member${members.length !== 1 ? 's' : ''}.`, '#16a34a');
  } catch (err) {
    console.error('[wall/vcf-export]', err);
    setS('Export failed — see console.', '#b91c1c');
  }

  btn.disabled = false; btn.innerHTML = orig;
}

/** Import the checked contacts from the parsed VCF preview list.
 *  - New contacts → UR.createMember
 *  - Existing contacts → UR.updateMember with only BLANK fields filled in
 */
async function _vcfImportSelected(root, btn) {
  const preview  = root.querySelector('[data-bind="vcf-preview"]');
  const statusEl = root.querySelector('[data-bind="vcf-import-status"]');
  const contacts = preview?._vcfContacts || [];
  const setS = (msg, col) => { if (statusEl) { statusEl.textContent = msg; statusEl.style.color = col || 'var(--ink-muted)'; } };

  // Gather selected contacts
  const checkboxes = preview ? [...preview.querySelectorAll('input[type="checkbox"]')] : [];
  const selected   = checkboxes
    .filter(cb => cb.checked)
    .map(cb => contacts[parseInt(cb.dataset.vcfIdx, 10)])
    .filter(Boolean);

  if (!selected.length) { setS('No contacts selected.', '#b45309'); return; }

  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.createMember) {
    setS('Backend not available.', '#b91c1c');
    return;
  }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.textContent = `Working 0 / ${selected.length}…`;
  setS(`Processing ${selected.length} contact${selected.length !== 1 ? 's' : ''}…`);

  // Helper: build a full field map from a parsed VCF contact
  // NOTE: the app's canonical phone field is 'phone' (matches the Fold save handler).
  // VCF TEL types are mapped: CELL/unlabelled → phone, HOME → homePhone, WORK → workPhone.
  const _vcfFields = (c) => ({
    firstName:      c.firstName      || (c.fn ? c.fn.split(' ')[0] : ''),
    lastName:       c.lastName       || (c.fn ? c.fn.split(' ').slice(1).join(' ') : ''),
    middleName:     c.middleName     || '',
    prefix:         c.prefix         || '',
    suffix:         c.suffix         || '',
    primaryEmail:   c.primaryEmail   || '',
    secondaryEmail: c.secondaryEmail || '',
    phone:          c.cellPhone      || '',   // canonical field — Fold reads 'phone'
    homePhone:      c.homePhone      || '',
    workPhone:      c.workPhone      || '',
    streetAddress1: c.streetAddress1 || '',
    city:           c.city           || '',
    state:          c.state          || '',
    zipCode:        c.zipCode        || '',
    country:        c.country        || '',
    dateOfBirth:    c.dateOfBirth    || '',
    gender:         c.gender         || '',
    notes:          c.notes          || '',
  });

  let created = 0, merged = 0, mergedFields = 0, failed = 0;
  for (const c of selected) {
    try {
      if (c._isDuplicate && c._existingMember) {
        // Merge: only write fields that are blank in Firestore
        const existing = c._existingMember;
        const incoming = _vcfFields(c);
        const patch = {};
        for (const [key, val] of Object.entries(incoming)) {
          if (!val) continue; // nothing to contribute
          const cur = String(existing[key] || '').trim();
          if (!cur) patch[key] = val; // blank in Firestore → fill it in
        }
        if (Object.keys(patch).length > 0) {
          patch.id = existing.id;
          await UR.updateMember(patch);
          mergedFields += Object.keys(patch).length - 1; // subtract the id key
        }
        merged++;
      } else {
        // New contact → create
        await UR.createMember({
          ..._vcfFields(c),
          membershipStatus: 'Visitor',
          importedFromVcf:  true,
        });
        created++;
      }
      const total = created + merged;
      btn.textContent = `Working ${total} / ${selected.length}…`;
    } catch (err) {
      failed++;
      console.error('[wall/vcf-import] failed for', c.fn || c.primaryEmail, err);
    }
  }

  const parts = [];
  if (created)      parts.push(`${created} new contact${created !== 1 ? 's' : ''} added`);
  if (merged)       parts.push(`${merged} existing contact${merged !== 1 ? 's' : ''} updated (${mergedFields} field${mergedFields !== 1 ? 's' : ''} filled in)`);
  if (failed)       parts.push(`${failed} failed (see console)`);
  setS('✓ ' + (parts.join(' · ') || 'Nothing to do.'), failed ? '#b45309' : '#16a34a');
  btn.disabled = false; btn.innerHTML = orig;

  // Uncheck all if no failures
  if (!failed) {
    checkboxes.forEach(cb => { cb.checked = false; });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   MEMBER DE-DUPLICATION
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Scan all members for duplicates by email, name, or phone.
 * Groups them into pairs/sets and renders a review UI.
 */
async function _scanMemberDuplicates(root, btn) {
  const statusEl  = root.querySelector('[data-bind="member-dedup-status"]');
  const resultsEl = root.querySelector('[data-bind="member-dedup-results"]');
  const setS = (msg, col) => { if (statusEl) { statusEl.textContent = msg; statusEl.style.color = col || 'var(--ink-muted)'; } };

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.textContent = 'Scanning…';
  setS('Loading members…');
  if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }

  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.listMembers) {
    setS('Backend not available.', '#b91c1c');
    btn.disabled = false; btn.innerHTML = orig; return;
  }

  try {
    const raw  = await UR.listMembers({ limit: 5000 }).catch(() => []);
    const all  = (Array.isArray(raw) ? raw : (raw?.results || []))
      // Skip already-archived records from scan
      .filter(m => String(m.membershipStatus || '').toLowerCase() !== 'archived');

    // Build duplicate groups — each group is an array of member records
    const grouped = new Map(); // groupKey → Set of member ids
    const memberById = {};
    for (const m of all) memberById[m.id] = m;

    const _norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const _normPhone = s => String(s || '').replace(/\D/g, '');

    // email → ids
    const byEmail  = {};
    // name → ids
    const byName   = {};
    // phone → ids
    const byPhone  = {};

    for (const m of all) {
      const emails = [m.primaryEmail, m.secondaryEmail].map(_norm).filter(Boolean);
      for (const e of emails) {
        (byEmail[e] = byEmail[e] || []).push(m.id);
      }
      const name = _norm([m.firstName, m.lastName].filter(Boolean).join(' '));
      if (name) (byName[name] = byName[name] || []).push(m.id);

      const phones = [m.cellPhone, m.homePhone, m.workPhone].map(_normPhone).filter(p => p.length >= 7);
      for (const p of phones) {
        (byPhone[p] = byPhone[p] || []).push(m.id);
      }
    }

    // Collect pair groups (deduplicate pairs regardless of match source)
    const pairKey = (a, b) => [a, b].sort().join('||');
    const seenPairs = new Set();
    const groups = []; // [{ids: [id1, id2], reason: 'email'|'name'|'phone'}]

    const _addPairs = (idLists, reason) => {
      for (const ids of Object.values(idLists)) {
        if (ids.length < 2) continue;
        // Create all pairs from this group
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const key = pairKey(ids[i], ids[j]);
            if (seenPairs.has(key)) continue;
            seenPairs.add(key);
            groups.push({ ids: [ids[i], ids[j]], reason });
          }
        }
      }
    };

    _addPairs(byEmail, 'Same email');
    _addPairs(byName,  'Same name');
    _addPairs(byPhone, 'Same phone');

    if (!groups.length) {
      setS(`✓ No duplicates found across ${all.length} active members.`, '#16a34a');
      btn.disabled = false; btn.innerHTML = orig; return;
    }

    setS(`Found ${groups.length} likely duplicate pair${groups.length !== 1 ? 's' : ''} — review below.`, '#d97706');
    _renderDupResults(root, groups, memberById);
  } catch (err) {
    console.error('[wall/dedup-members] scan error', err);
    setS(`Scan failed: ${err?.message || err}`, '#b91c1c');
  }
  btn.disabled = false; btn.innerHTML = orig;
}

/** Render the duplicate review cards. */
function _renderDupResults(root, groups, memberById) {
  const resultsEl = root.querySelector('[data-bind="member-dedup-results"]');
  if (!resultsEl) return;

  const FIELDS = [
    { key: 'primaryEmail',   label: 'Email (primary)' },
    { key: 'secondaryEmail', label: 'Email (secondary)' },
    { key: 'cellPhone',      label: 'Cell phone' },
    { key: 'homePhone',      label: 'Home phone' },
    { key: 'workPhone',      label: 'Work phone' },
    { key: 'streetAddress1', label: 'Address' },
    { key: 'city',           label: 'City' },
    { key: 'state',          label: 'State' },
    { key: 'zipCode',        label: 'ZIP' },
    { key: 'dateOfBirth',    label: 'Birthday' },
    { key: 'gender',         label: 'Gender' },
    { key: 'membershipStatus', label: 'Status' },
    { key: 'memberPin',      label: 'Member PIN' },
    { key: 'notes',          label: 'Notes' },
  ];

  const _fieldVal = (m, key) => String(m[key] || '').trim();
  const _countFields = (m) => FIELDS.filter(f => _fieldVal(m, f.key)).length;

  const cards = groups.map((g, gi) => {
    const [mA, mB] = g.ids.map(id => memberById[id]).filter(Boolean);
    if (!mA || !mB) return '';

    const nameA = _e([mA.firstName, mA.lastName].filter(Boolean).join(' ') || mA.displayName || '(No name)');
    const nameB = _e([mB.firstName, mB.lastName].filter(Boolean).join(' ') || mB.displayName || '(No name)');

    // Auto-suggest keeping the one with more data
    const keepDefault = _countFields(mA) >= _countFields(mB) ? 'A' : 'B';

    const fieldRows = FIELDS.map(f => {
      const vA = _fieldVal(mA, f.key);
      const vB = _fieldVal(mB, f.key);
      if (!vA && !vB) return '';
      const match = vA && vB && vA.toLowerCase() === vB.toLowerCase();
      const cellStyle = 'padding:4px 8px;font-size:.8rem;vertical-align:top;';
      const aStyle = cellStyle + (!vA ? 'color:var(--ink-muted);font-style:italic;' : match ? '' : 'color:#1b264f;font-weight:600;');
      const bStyle = cellStyle + (!vB ? 'color:var(--ink-muted);font-style:italic;' : match ? '' : 'color:#1b264f;font-weight:600;');
      return `<tr style="border-bottom:1px solid var(--line,#e5e7ef)">
        <td style="${cellStyle}color:var(--ink-muted);white-space:nowrap">${_e(f.label)}</td>
        <td style="${aStyle}">${vA ? _e(vA) : '—'}</td>
        <td style="${bStyle}">${vB ? _e(vB) : '—'}</td>
      </tr>`;
    }).filter(Boolean).join('');

    return `<div data-dedup-group="${gi}" style="border-top:1px solid var(--line,#e5e7ef);padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div>
          <span style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-muted);margin-right:8px">${_e(g.reason)}</span>
          <span style="font-weight:700;font-size:.92rem;color:var(--ink)">${nameA}</span>
          <span style="color:var(--ink-muted);margin:0 6px">vs</span>
          <span style="font-weight:700;font-size:.92rem;color:var(--ink)">${nameB}</span>
        </div>
      </div>

      <!-- Side-by-side field comparison table -->
      <div style="overflow-x:auto;margin-bottom:10px">
        <table style="width:100%;border-collapse:collapse;font-size:.82rem">
          <thead>
            <tr style="background:var(--bg-sunken,#f3f4f8)">
              <th style="padding:5px 8px;text-align:left;font-size:.75rem;color:var(--ink-muted);font-weight:700;width:110px">Field</th>
              <th style="padding:5px 8px;text-align:left;font-size:.75rem;color:var(--ink-muted);font-weight:700">
                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
                  <input type="radio" name="dedup-keep-${gi}" value="A" ${keepDefault === 'A' ? 'checked' : ''} data-dedup-radio>
                  Keep: <strong style="color:var(--ink)">${nameA}</strong>
                </label>
              </th>
              <th style="padding:5px 8px;text-align:left;font-size:.75rem;color:var(--ink-muted);font-weight:700">
                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
                  <input type="radio" name="dedup-keep-${gi}" value="B" ${keepDefault === 'B' ? 'checked' : ''} data-dedup-radio>
                  Keep: <strong style="color:var(--ink)">${nameB}</strong>
                </label>
              </th>
            </tr>
          </thead>
          <tbody>${fieldRows || '<tr><td colspan="3" style="padding:8px;color:var(--ink-muted);font-size:.8rem">No differing fields found.</td></tr>'}</tbody>
        </table>
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="flex:1;font-size:.78rem;color:var(--ink-muted)">
          The selected record is kept. Any blank fields will be filled from the other record. The duplicate is then archived.
        </div>
        <span data-bind="dedup-merge-status-${gi}" style="font-size:.8rem"></span>
        <button class="flock-btn flock-btn--danger" style="font-size:.8rem;padding:6px 14px"
          data-act="merge-member-pair"
          data-dedup-group="${gi}"
          data-id-a="${_e(mA.id)}"
          data-id-b="${_e(mB.id)}"
          type="button">
          Merge &amp; Archive Duplicate
        </button>
      </div>
    </div>`;
  }).join('');

  resultsEl.innerHTML = `
    <div style="padding:10px 14px;background:var(--bg-sunken,#f3f4f8);border-top:1px solid var(--line,#e5e7ef);font-size:.82rem;color:var(--ink-muted)">
      ${groups.length} duplicate pair${groups.length !== 1 ? 's' : ''} found — review each and choose which record to keep.
      <strong style="color:var(--ink)">Bold fields differ between records.</strong>
      The radio button selects the primary (kept) record.
    </div>
    ${cards}
  `;
  resultsEl.style.display = '';
}

/** Merge one pair: fill blank fields on keeper, archive the duplicate. */
async function _mergeMemberPair(root, btn) {
  const gi    = btn.dataset.dedupGroup;
  const idA   = btn.dataset.idA;
  const idB   = btn.dataset.idB;
  const panel = root.querySelector('[data-wall-panel="maintenance"]');
  const statusEl = root.querySelector(`[data-bind="dedup-merge-status-${gi}"]`);
  const setS = (msg, col) => { if (statusEl) { statusEl.textContent = msg; statusEl.style.color = col || 'var(--ink-muted)'; } };

  // Which to keep?
  const radios  = panel ? [...panel.querySelectorAll(`input[name="dedup-keep-${gi}"]`)] : [];
  const keepVal = (radios.find(r => r.checked) || radios[0])?.value || 'A';
  const keepId  = keepVal === 'A' ? idA : idB;
  const removeId = keepVal === 'A' ? idB : idA;

  if (!confirm(`Merge & archive the duplicate?\n\n• Blank fields on the keeper will be filled from the duplicate.\n• The duplicate will be archived (not permanently deleted).\n\nThis cannot be automatically undone.`)) return;

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.textContent = 'Merging…';
  setS('Working…');

  const UR = await _waitForUpperRoom(10000);
  if (!UR || !UR.listMembers || !UR.updateMember) {
    setS('Backend not available.', '#b91c1c');
    btn.disabled = false; btn.innerHTML = orig; return;
  }

  try {
    // Fetch fresh copies (stale memberById may be missing recent updates)
    const all  = await UR.listMembers({ limit: 5000 }).catch(() => []);
    const list = Array.isArray(all) ? all : (all?.results || []);
    const keeper  = list.find(m => m.id === keepId);
    const removed = list.find(m => m.id === removeId);

    if (!keeper || !removed) {
      setS('Could not find one or both members — re-scan to refresh.', '#b91c1c');
      btn.disabled = false; btn.innerHTML = orig; return;
    }

    const MERGE_FIELDS = [
      'firstName','lastName','middleName','prefix','suffix',
      'primaryEmail','secondaryEmail',
      'cellPhone','homePhone','workPhone',
      'streetAddress1','streetAddress2','city','state','zipCode','country',
      'dateOfBirth','gender','notes','organization','jobTitle',
    ];

    const patch = { id: keepId };
    let filledCount = 0;
    for (const key of MERGE_FIELDS) {
      const cur = String(keeper[key] || '').trim();
      const src = String(removed[key] || '').trim();
      if (!cur && src) { patch[key] = src; filledCount++; }
    }

    // Update keeper with merged fields (if any)
    if (filledCount > 0) await UR.updateMember(patch);

    // Archive the duplicate
    await UR.updateMember({
      id: removeId,
      membershipStatus: 'Archived',
      mergedIntoMemberId: keepId,
      mergedAt: new Date().toISOString(),
    });

    const groupCard = root.querySelector(`[data-dedup-group="${gi}"]`);
    if (groupCard) {
      groupCard.style.opacity = '0.4';
      groupCard.style.pointerEvents = 'none';
    }

    setS(
      filledCount > 0
        ? `✓ Merged — ${filledCount} field${filledCount !== 1 ? 's' : ''} filled in, duplicate archived.`
        : `✓ Done — no new fields to fill, duplicate archived.`,
      '#16a34a'
    );
    console.log(`[wall/dedup] merged ${removeId} → ${keepId}, ${filledCount} fields filled`);
  } catch (err) {
    console.error('[wall/dedup] merge error', err);
    setS(`Failed: ${err?.message || err}`, '#b91c1c');
    btn.disabled = false; btn.innerHTML = orig;
  }
}

function _wireDepMapPanel(root) {
  const panel = root.querySelector('[data-wall-panel="depmap"]');
  if (!panel) return;

  const _copy = async (text, btn, label) => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = '✓ Copied!';
    } catch (_) {
      btn.textContent = 'Select text manually';
    }
    setTimeout(() => { btn.textContent = label; }, 2500);
  };

  panel.querySelector('[data-act="dm-copy-tree"]')?.addEventListener('click', (e) => {
    const pre = panel.querySelector('#dm-tree-pre');
    _copy(pre?.textContent || '', e.currentTarget, '📋 Copy tree');
  });

  panel.querySelector('[data-act="dm-copy-json"]')?.addEventListener('click', (e) => {
    _copy(JSON.stringify(_DEP_MAP, null, 2), e.currentTarget, '{ } Copy JSON');
  });
}

