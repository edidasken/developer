/* ══════════════════════════════════════════════════════════════════════════════
   THE UNITY PROFILE — Shared account sheet v2
   "Ye are a chosen generation, a royal priesthood." — 1 Peter 2:9

   Multi-view sliding panel.  Clicking an item with `subview` pushes a named
   sub-view into the card; the back button pops it back to main.

   Views:
     main     — top-level menu (always the root)
     profile  — My Profile: edit display name & photo URL, view email
     settings — Push-notification toggle, app version info
     todo     — Personal To-Do list (localStorage, keyed by email)
     journal  — Personal Journal entries (localStorage, keyed by email)
     calendar — Personal Calendar (monthly grid, events, localStorage)
   ══════════════════════════════════════════════════════════════════════════════ */

let _sheet      = null;   // single DOM node, persists for the page lifetime
let _opts       = {};     // last openUnityProfile() options (user, callbacks…)
let _activeView = 'main';

// ── Menu item registry ─────────────────────────────────────────────────────────
const ITEMS = [
  { id: 'profile',       label: 'My Profile',        icon: 'user',   subview: 'profile'  },
  { id: 'settings',      label: 'Settings',          icon: 'gear',   subview: 'settings' },
  { id: 'switch-church', label: 'Switch Church',     icon: 'church', href: '../'         },
  { divider: true },
  { id: 'prayer',        label: 'Prayer Requests',   icon: 'pray',   href: '../app.stand/' },
  { id: 'todo',          label: 'To-Do',             icon: 'check',  subview: 'todo'     },
  { id: 'calendar',      label: 'Personal Calendar', icon: 'cal',    subview: 'calendar' },
  { id: 'journal',       label: 'Journal Logs',      icon: 'book',   subview: 'journal'  },
  { divider: true },
  { id: 'signout',       label: 'Sign Out',          icon: 'out',    danger: true        },
];

// ── SVG icon library ──────────────────────────────────────────────────────────
const IC = {
  user:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  gear:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  church:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M10 4h4"/><path d="M5 22V11l7-4 7 4v11"/><path d="M9 22v-6h6v6"/></svg>',
  pray:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8 2 8 6 8 8v6"/><path d="M16 14V8c0-2 0-6-4-6"/><path d="M8 14H6a4 4 0 0 0-4 4v4h20v-4a4 4 0 0 0-4-4h-2"/></svg>',
  check:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  cal:        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  book:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  out:        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  back:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  plus:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  trash:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>',
  checkFill:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  checkEmpty: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
  bell:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  chevron:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
};

// ── Public API ─────────────────────────────────────────────────────────────────

export function openUnityProfile(opts = {}) {
  const { user = null, signInHref = null } = opts;

  // Unauthenticated guard
  if (!user || !user.email) {
    if (signInHref) { location.assign(signInHref); return; }
    try { sessionStorage.removeItem('flock_auth_session'); } catch (_) {}
    try { sessionStorage.removeItem('flock_auth_profile'); } catch (_) {}
    location.reload();
    return;
  }

  _opts = { ...opts };
  ensureSheet();
  _populateMainHeader();
  _showView('main');
  _sheet.classList.add('is-open');
  document.body.classList.add('unity-modal-open');
}

export function closeUnityProfile() {
  if (!_sheet) return;
  _sheet.classList.remove('is-open');
  document.body.classList.remove('unity-modal-open');
  _activeView = 'main';
}

// ── View engine ────────────────────────────────────────────────────────────────

function _showView(name) {
  // Slide from left only when navigating Back inside an already-open panel.
  // When the panel opens fresh, is-open hasn't been added yet → slide from right.
  const panelOpen = _sheet.classList.contains('is-open');
  const animClass = (panelOpen && name === 'main') ? 'pp-view-back' : 'pp-view-in';
  _activeView = name;
  _sheet.querySelector('.unity-pp-card').scrollTop = 0;
  _sheet.querySelectorAll('.unity-pp-view').forEach(v => {
    const active = v.dataset.view === name;
    v.hidden = !active;
    if (active) {
      v.classList.remove('pp-view-in', 'pp-view-back');
      void v.offsetWidth; // force reflow to restart animation
      v.classList.add(animClass);
    }
  });
  if (name !== 'main') {
    _renderSubView(name);
    requestAnimationFrame(() => _sheet.querySelector(`[data-view="${name}"] .unity-sv-back`)?.focus());
  }
}

function _renderSubView(name) {
  if      (name === 'profile')  _renderProfileView();
  else if (name === 'settings') _renderSettingsView();
  else if (name === 'todo')     _renderTodoView();
  else if (name === 'journal')  _renderJournalView();
  else if (name === 'calendar') _renderCalendarView();
}

// ── Shell construction ─────────────────────────────────────────────────────────

function ensureSheet() {
  if (_sheet) return; // already built

  _sheet = document.createElement('div');
  _sheet.className = 'unity-profile-sheet';
  _sheet.setAttribute('role', 'dialog');
  _sheet.setAttribute('aria-modal', 'true');
  _sheet.setAttribute('aria-label', 'Account');

  _sheet.innerHTML = `
    <div class="unity-pp-backdrop" data-act="close"></div>
    <div class="unity-pp-card">

      <!-- ── main view ───────────────────────────────────────────────── -->
      <div class="unity-pp-view" data-view="main">
        <header class="unity-pp-header">
          <div class="unity-pp-avatar" aria-hidden="true"></div>
          <div class="unity-pp-id">
            <div class="unity-pp-name"></div>
            <div class="unity-pp-email"></div>
          </div>
        </header>
        <div class="unity-pp-list">
          ${ITEMS.map(it => it.divider
            ? `<div class="unity-pp-divider"></div>`
            : `<button class="unity-pp-item${it.danger ? ' unity-pp-item--danger' : ''}" role="menuitem" data-id="${it.id}">
                 <span class="unity-pp-item-icon">${IC[it.icon] || ''}</span>
                 <span class="unity-pp-item-label">${it.label}</span>
                 ${it.subview ? `<span class="unity-pp-item-chevron" aria-hidden="true">${IC.chevron}</span>` : ''}
               </button>`
          ).join('')}
        </div>
      </div>

      <!-- ── sub-view slots (rendered on demand) ─────────────────────── -->
      <div class="unity-pp-view" data-view="profile"  hidden></div>
      <div class="unity-pp-view" data-view="settings" hidden></div>
      <div class="unity-pp-view" data-view="todo"     hidden></div>
      <div class="unity-pp-view" data-view="journal"  hidden></div>
      <div class="unity-pp-view" data-view="calendar" hidden></div>

    </div>
  `;

  document.body.appendChild(_sheet);
  _wireMainItems();

  // Backdrop click → close
  _sheet.addEventListener('click', e => {
    if (e.target.closest('[data-act="close"]')) closeUnityProfile();
  });

  // Escape: pop sub-view or close panel
  document.addEventListener('keydown', e => {
    if (!_sheet.classList.contains('is-open')) return;
    if (e.key === 'Escape') {
      if (_activeView !== 'main') _showView('main');
      else closeUnityProfile();
    }
  });
}

function _populateMainHeader() {
  if (!_sheet) return;
  const { user } = _opts;
  if (!user) return;
  const display = user.displayName || user.name || user.email.split('@')[0];
  const photo   = user.photoURL || '';
  const av = _sheet.querySelector('.unity-pp-avatar');
  if (photo) { av.style.backgroundImage = `url(${photo})`; av.textContent = ''; }
  else        { av.style.backgroundImage = ''; av.textContent = (display[0] || '?').toUpperCase(); }
  _sheet.querySelector('.unity-pp-name').textContent  = display;
  _sheet.querySelector('.unity-pp-email').textContent = user.email;
}

function _wireMainItems() {
  _sheet.querySelector('.unity-pp-list').addEventListener('click', e => {
    const btn = e.target.closest('.unity-pp-item');
    if (!btn) return;
    const id   = btn.dataset.id;
    const item = ITEMS.find(it => it.id === id);
    if (!item) return;

    if (id === 'signout') {
      closeUnityProfile();
      const { onSignOut } = _opts;
      if (typeof onSignOut === 'function') Promise.resolve().then(onSignOut);
      else _toast('Sign-out not configured for this app.');
      return;
    }
    if (item.href) {
      closeUnityProfile();
      location.href = item.href;
      return;
    }
    if (item.subview) {
      _showView(item.subview);
      return;
    }
    const { onAction } = _opts;
    if (typeof onAction === 'function') {
      const handled = onAction(id);
      if (handled !== false) { closeUnityProfile(); return; }
    }
    _toast(`${item.label}: coming soon.`);
    closeUnityProfile();
  });
}

// ── My Profile sub-view ────────────────────────────────────────────────────────

function _renderProfileView() {
  const { user } = _opts;
  const view    = _sheet.querySelector('[data-view="profile"]');
  const display = user.displayName || user.name || user.email.split('@')[0];
  const photo   = user.photoURL || '';

  const avatarContent = photo
    ? `<img src="${_ea(photo)}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="font-size:2rem;font-weight:700;color:#e8a838">${_e(display[0] || '?').toUpperCase()}</span>`;

  view.innerHTML = `
    <div class="unity-sv-header">
      <button class="unity-sv-back" data-pp-back aria-label="Back">${IC.back}</button>
      <span class="unity-sv-title">My Profile</span>
    </div>
    <div class="unity-sv-body">
      <div class="unity-sv-avatar-wrap">
        <div class="unity-sv-avatar-lg" id="pp-photo-preview">${avatarContent}</div>
      </div>
      <div class="unity-sv-field">
        <label class="unity-sv-label" for="pp-name">Display Name</label>
        <input class="unity-sv-input" id="pp-name" type="text" value="${_ea(display)}" placeholder="Your name" autocomplete="name" maxlength="60">
      </div>
      <div class="unity-sv-field">
        <label class="unity-sv-label" for="pp-email">Email</label>
        <input class="unity-sv-input unity-sv-input--readonly" id="pp-email" type="email" value="${_ea(user.email)}" readonly>
      </div>
      <div class="unity-sv-field">
        <label class="unity-sv-label" for="pp-photo">Photo URL</label>
        <input class="unity-sv-input" id="pp-photo" type="url" value="${_ea(photo)}" placeholder="https://…">
        <div class="unity-sv-field-hint">Paste a link to your profile picture</div>
      </div>
      <button class="unity-sv-btn unity-sv-btn--primary" id="pp-save">Save Changes</button>
    </div>
  `;

  view.querySelector('[data-pp-back]').onclick = () => _showView('main');

  // Live photo preview
  const photoInput = view.querySelector('#pp-photo');
  const nameInput  = view.querySelector('#pp-name');
  const preview    = view.querySelector('#pp-photo-preview');

  const updatePreview = () => {
    const url = photoInput.value.trim();
    preview.innerHTML = url
      ? `<img src="${_ea(url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none'">`
      : `<span style="font-size:2rem;font-weight:700;color:#e8a838">${_e((nameInput.value || display)[0] || '?').toUpperCase()}</span>`;
  };

  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); view.querySelector('#pp-save').click(); }
  });
  nameInput.addEventListener('input', () => { if (!photoInput.value.trim()) updatePreview(); });
  photoInput.addEventListener('input', () => {
    updatePreview();
  });

  view.querySelector('#pp-save').onclick = () => {
    const newName  = nameInput.value.trim() || display;
    const newPhoto = photoInput.value.trim();
    _opts.user = { ..._opts.user, displayName: newName, photoURL: newPhoto };
    _persistProfile(newName, newPhoto);
    _populateMainHeader();
    _toast('Profile saved.');
    _showView('main');
  };
}

function _persistProfile(displayName, photoURL) {
  ['flock_auth_session', 'flock_auth_profile'].forEach(key => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const s = JSON.parse(raw);
      s.displayName = displayName;
      s.name        = displayName; // keep both fields in sync
      s.photoURL    = photoURL;
      sessionStorage.setItem(key, JSON.stringify(s));
    } catch (_) {}
  });
}

// ── Settings sub-view ──────────────────────────────────────────────────────────

function _renderSettingsView() {
  const view         = _sheet.querySelector('[data-view="settings"]');
  const notifUnavail = typeof Notification === 'undefined';
  const notifDenied  = !notifUnavail && Notification.permission === 'denied';
  const notifGranted = !notifUnavail && Notification.permission === 'granted';

  view.innerHTML = `
    <div class="unity-sv-header">
      <button class="unity-sv-back" data-pp-back aria-label="Back">${IC.back}</button>
      <span class="unity-sv-title">Settings</span>
    </div>
    <div class="unity-sv-body">
      <div class="unity-sv-section-label">Notifications</div>
      <div class="unity-sv-toggle-row">
        <div class="unity-sv-toggle-info">
          <span class="unity-sv-toggle-icon">${IC.bell}</span>
          <div>
            <div class="unity-sv-toggle-title">Push Notifications</div>
            <div class="unity-sv-toggle-sub">${
              notifUnavail ? 'Not supported in this browser'
              : notifDenied  ? 'Blocked — open browser settings to allow'
              : 'Allow FlockOS to send alerts'
            }</div>
          </div>
        </div>
        <label class="unity-sv-toggle" aria-label="Toggle push notifications">
          <input type="checkbox" id="pp-notif-toggle"${notifGranted ? ' checked' : ''}${(notifUnavail || notifDenied) ? ' disabled' : ''}>
          <span class="unity-sv-toggle-track"></span>
        </label>
      </div>
      <div class="unity-sv-section-label" style="margin-top:20px">About</div>
      <div class="unity-sv-info-row">
        <span>App Version</span>
        <span class="unity-sv-info-val">NC v1.01</span>
      </div>
      <div class="unity-sv-info-row">
        <span>Platform</span>
        <span class="unity-sv-info-val">FlockOS</span>
      </div>
      <div class="unity-sv-info-row">
        <span>Church</span>
        <span class="unity-sv-info-val">${_e(_opts.appName || 'FlockOS')}</span>
      </div>
    </div>
  `;

  view.querySelector('[data-pp-back]').onclick = () => _showView('main');

  if (!notifUnavail && !notifDenied) {
    const toggle = view.querySelector('#pp-notif-toggle');
    toggle.addEventListener('change', async () => {
      if (toggle.checked) {
        const perm = await Notification.requestPermission().catch(() => 'denied');
        if (perm !== 'granted') {
          toggle.checked = false;
          _toast('Permission denied — check your browser settings.');
        } else {
          _toast('Push notifications enabled.');
        }
      } else {
        _toast('Disabled. Revoke via browser settings to fully block.');
      }
    });
  }
}

// ── To-Do sub-view ─────────────────────────────────────────────────────────────

function _renderTodoView() {
  const view = _sheet.querySelector('[data-view="todo"]');
  const key  = `unity_todo_${_opts.user?.email || 'anon'}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
  const save = t  => localStorage.setItem(key, JSON.stringify(t));

  const render = () => {
    const tasks = load();
    const open  = tasks.filter(t => !t.done);
    const done  = tasks.filter(t =>  t.done);

    const taskRow = (t, realIdx) => `
      <li class="unity-sv-task${t.done ? ' is-done' : ''}">
        <button class="unity-sv-task-check" data-check="${realIdx}" aria-label="${t.done ? 'Mark incomplete' : 'Mark complete'}">${t.done ? IC.checkFill : IC.checkEmpty}</button>
        <span class="unity-sv-task-text">${_e(t.text)}</span>
        <button class="unity-sv-task-del" data-del="${realIdx}" aria-label="Delete task">${IC.trash}</button>
      </li>`;

    view.innerHTML = `
      <div class="unity-sv-header">
        <button class="unity-sv-back" data-pp-back aria-label="Back">${IC.back}</button>
        <span class="unity-sv-title">To-Do</span>
      </div>
      <div class="unity-sv-body">
        <div class="unity-sv-add-row">
          <input class="unity-sv-input unity-sv-input--grow" id="pp-todo-input" type="text" placeholder="Add a task…" maxlength="120" autocomplete="off">
          <button class="unity-sv-btn unity-sv-btn--icon" id="pp-todo-add" aria-label="Add task">${IC.plus}</button>
        </div>
        <ul class="unity-sv-task-list">
          ${open.map(t => taskRow(t, tasks.indexOf(t))).join('')}
          ${tasks.length === 0 ? '<li class="unity-sv-empty">No tasks yet — add one above.</li>' : ''}
          ${done.length > 0 ? `<li class="unity-sv-task-group-label">Completed (${done.length})</li>${done.map(t => taskRow(t, tasks.indexOf(t))).join('')}` : ''}
        </ul>
      </div>
    `;

    view.querySelector('[data-pp-back]').onclick = () => _showView('main');

    const input  = view.querySelector('#pp-todo-input');
    const addBtn = view.querySelector('#pp-todo-add');
    const doAdd  = () => {
      const text = input.value.trim();
      if (!text) return;
      const t = load();
      t.push({ text, done: false, created: Date.now() });
      save(t);
      input.value = '';
      render();
      view.querySelector('#pp-todo-input')?.focus();
    };
    addBtn.onclick = doAdd;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });

    view.querySelectorAll('[data-check]').forEach(btn => {
      btn.onclick = () => {
        const t = load();
        t[+btn.dataset.check].done = !t[+btn.dataset.check].done;
        save(t); render();
      };
    });
    view.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        const t = load();
        t.splice(+btn.dataset.del, 1);
        save(t); render();
      };
    });
  };

  render();
}

// ── Journal sub-view ───────────────────────────────────────────────────────────

function _renderJournalView() {
  const view = _sheet.querySelector('[data-view="journal"]');
  const key  = `unity_journal_${_opts.user?.email || 'anon'}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
  const save = e  => localStorage.setItem(key, JSON.stringify(e));
  const fmt  = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  let mode    = 'list';
  let readIdx = -1;

  const render = () => {
    const entries = load();

    if (mode === 'list') {
      const sorted = entries.map((e, i) => ({ ...e, _i: i })).reverse();
      view.innerHTML = `
        <div class="unity-sv-header">
          <button class="unity-sv-back" data-pp-back aria-label="Back">${IC.back}</button>
          <span class="unity-sv-title">Journal</span>
          <button class="unity-sv-header-action" id="pp-j-new" aria-label="New entry" title="New entry">${IC.plus}</button>
        </div>
        <div class="unity-sv-body unity-sv-body--list">
          <ul class="unity-sv-journal-list">
            ${sorted.length
              ? sorted.map(e => `
                  <li class="unity-sv-journal-item" data-read="${e._i}" role="button" tabindex="0">
                    <div class="unity-sv-journal-item-inner">
                      <div class="unity-sv-journal-title">${_e(e.title || 'Untitled')}</div>
                      <div class="unity-sv-journal-meta">${fmt(e.created)}</div>
                    </div>
                    <span class="unity-sv-journal-chevron" aria-hidden="true">${IC.chevron}</span>
                  </li>`).join('')
              : '<li class="unity-sv-empty">No journal entries yet.</li>'}
          </ul>
        </div>
      `;
      view.querySelector('[data-pp-back]').onclick = () => _showView('main');
      view.querySelector('#pp-j-new').onclick      = () => { mode = 'new'; render(); };
      view.querySelectorAll('[data-read]').forEach(li => {
        li.onclick = () => { readIdx = +li.dataset.read; mode = 'read'; render(); };
        li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') li.click(); });
      });

    } else if (mode === 'new') {
      view.innerHTML = `
        <div class="unity-sv-header">
          <button class="unity-sv-back" data-pp-back aria-label="Back">${IC.back}</button>
          <span class="unity-sv-title">New Entry</span>
        </div>
        <div class="unity-sv-body">
          <div class="unity-sv-field">
            <label class="unity-sv-label" for="pp-j-title">Title <span class="unity-sv-optional">(optional)</span></label>
            <input class="unity-sv-input" id="pp-j-title" type="text" placeholder="Give it a title…" maxlength="80" autocomplete="off">
          </div>
          <div class="unity-sv-field">
            <label class="unity-sv-label" for="pp-j-body">Your Thoughts</label>
            <textarea class="unity-sv-textarea" id="pp-j-body" placeholder="Write freely…" rows="7"></textarea>
          </div>
          <button class="unity-sv-btn unity-sv-btn--primary" id="pp-j-save">Save Entry</button>
        </div>
      `;
      view.querySelector('[data-pp-back]').onclick = () => { mode = 'list'; render(); };
      view.querySelector('#pp-j-save').onclick     = () => {
        const title = view.querySelector('#pp-j-title').value.trim();
        const body  = view.querySelector('#pp-j-body').value.trim();
        if (!body) { _toast('Write something first.'); return; }
        const e = load();
        e.push({ title, body, created: Date.now() });
        save(e);
        mode = 'list'; render(); _toast('Entry saved.');
      };
      requestAnimationFrame(() => view.querySelector('#pp-j-body')?.focus());

    } else if (mode === 'read') {
      const entry = entries[readIdx];
      if (!entry) { mode = 'list'; render(); return; }
      view.innerHTML = `
        <div class="unity-sv-header">
          <button class="unity-sv-back" data-pp-back aria-label="Back">${IC.back}</button>
          <span class="unity-sv-title unity-sv-title--sm">${_e(entry.title || 'Entry')}</span>
          <button class="unity-sv-header-action unity-sv-header-action--danger" id="pp-j-del" aria-label="Delete entry" title="Delete entry">${IC.trash}</button>
        </div>
        <div class="unity-sv-body unity-sv-body--list">
          <p class="unity-sv-journal-date">${fmt(entry.created)}</p>
          <p class="unity-sv-journal-body">${_e(entry.body).replace(/\n/g, '<br>')}</p>
        </div>
      `;
      view.querySelector('[data-pp-back]').onclick = () => { mode = 'list'; render(); };
      view.querySelector('#pp-j-del').onclick      = () => {
        const all = load(); all.splice(readIdx, 1); save(all);
        mode = 'list'; render();
      };
    }
  };

  render();
}

// ── Personal Calendar ─────────────────────────────────────────────────────────
// Events stored in localStorage as:
//   { id: number, date: 'YYYY-MM-DD', title: string, time: string, created: number }

function _renderCalendarView() {
  const view = _sheet.querySelector('[data-view="calendar"]');
  const key  = `unity_cal_${_opts.user?.email || 'anon'}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
  const save = ev => localStorage.setItem(key, JSON.stringify(ev));

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const toKey  = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const today     = new Date();
  const todayKey  = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  // 12-hour time formatter for display
  const fmtTime = t => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  let viewYear  = today.getFullYear();
  let viewMonth = today.getMonth();  // 0-based
  let selDate   = todayKey;          // auto-select today on open
  let addMode   = false;

  const render = () => {
    const events      = load();
    const byDate      = {};
    events.forEach(e => { (byDate[e.date] ||= []).push(e); });

    // Build grid cells
    const firstDow    = new Date(viewYear, viewMonth, 1).getDay();        // 0–6
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();
    const totalCells  = Math.ceil((firstDow + daysInMonth) / 7) * 7;

    const cells = [];
    for (let i = firstDow - 1; i >= 0; i--)              cells.push({ day: daysInPrev - i, other: true });
    for (let d = 1; d <= daysInMonth; d++)                cells.push({ day: d,              other: false });
    for (let d = 1; cells.length < totalCells; d++)       cells.push({ day: d,              other: true });

    // Selected-day data
    const selEvents = selDate ? (byDate[selDate] || []).slice().sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')) : [];
    const selLabel  = selDate ? (() => {
      const [y, mo, d] = selDate.split('-').map(Number);
      return new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    })() : null;

    view.innerHTML = `
      <div class="unity-sv-header">
        <button class="unity-sv-back" data-pp-back aria-label="Back">${IC.back}</button>
        <span class="unity-sv-title">Calendar</span>
      </div>
      <div class="unity-sv-body unity-sv-body--cal">

        <div class="unity-cal-nav">
          <button class="unity-cal-nav-btn" data-cal-prev aria-label="Previous month">${IC.back}</button>
          <span class="unity-cal-month-label">${MONTHS[viewMonth]} ${viewYear}</span>
          <button class="unity-cal-nav-btn" data-cal-next aria-label="Next month">${IC.chevron}</button>
        </div>

        <div class="unity-cal-grid">
          ${DAYS.map(d => `<div class="unity-cal-dow">${d}</div>`).join('')}
          ${cells.map(c => {
            if (c.other) return `<div class="unity-cal-day other" aria-hidden="true"><span class="unity-cal-day-num">${c.day}</span></div>`;
            const dk        = toKey(viewYear, viewMonth, c.day);
            const hasEvents = (byDate[dk]?.length || 0) > 0;
            const isToday   = dk === todayKey;
            const isSel     = dk === selDate;
            return `<button
              class="unity-cal-day${isToday ? ' today' : ''}${isSel ? ' selected' : ''}"
              data-cal-day="${dk}"
              aria-label="${c.day}${isToday ? ', today' : ''}${hasEvents ? ', has events' : ''}"
              aria-pressed="${isSel}"
            ><span class="unity-cal-day-num">${c.day}</span>${hasEvents ? '<span class="unity-cal-dot" aria-hidden="true"></span>' : ''}</button>`;
          }).join('')}
        </div>

        ${selDate ? `
          <div class="unity-cal-detail">
            <div class="unity-cal-detail-header">
              <span class="unity-cal-detail-label">${_e(selLabel)}</span>
              <button class="unity-sv-header-action" id="pp-cal-add-btn" aria-label="Add event" title="Add event">${IC.plus}</button>
            </div>
            ${addMode ? `
              <div class="unity-cal-add-form">
                <input class="unity-sv-input" id="pp-cal-title" type="text" placeholder="Event title…" maxlength="80" autocomplete="off">
                <div class="unity-cal-add-row">
                  <input class="unity-sv-input unity-sv-input--time" id="pp-cal-time" type="time">
                  <button class="unity-sv-btn unity-sv-btn--primary unity-sv-btn--sm" id="pp-cal-save">Add</button>
                  <button class="unity-sv-btn unity-sv-btn--ghost unity-sv-btn--sm" id="pp-cal-cancel">Cancel</button>
                </div>
              </div>
            ` : ''}
            <ul class="unity-cal-event-list">
              ${selEvents.length
                ? selEvents.map(ev => `
                    <li class="unity-cal-event-item">
                      ${ev.time ? `<span class="unity-cal-event-time">${_e(fmtTime(ev.time))}</span>` : ''}
                      <span class="unity-cal-event-title">${_e(ev.title)}</span>
                      <button class="unity-sv-task-del" data-cal-del="${ev.id}" aria-label="Delete event">${IC.trash}</button>
                    </li>`).join('')
                : `<li class="unity-sv-empty" style="padding:10px 0">No events — tap + to add one.</li>`}
            </ul>
          </div>
        ` : `<p class="unity-cal-tap-hint">Tap a day to view or add events.</p>`}

      </div>
    `;

    // ── Wire interactions ──────────────────────────────────────────────────────
    view.querySelector('[data-pp-back]').onclick = () => _showView('main');

    const isCurrentMonth = () => viewYear === today.getFullYear() && viewMonth === today.getMonth();
    view.querySelector('[data-cal-prev]').onclick = () => {
      viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      selDate = isCurrentMonth() ? todayKey : null; addMode = false; render();
    };
    view.querySelector('[data-cal-next]').onclick = () => {
      viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      selDate = isCurrentMonth() ? todayKey : null; addMode = false; render();
    };

    view.querySelectorAll('[data-cal-day]').forEach(btn => {
      btn.onclick = () => {
        selDate  = btn.dataset.calDay;
        addMode  = false;
        render();
        requestAnimationFrame(() =>
          view.querySelector('.unity-cal-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        );
      };
    });

    view.querySelector('#pp-cal-add-btn')?.addEventListener('click', () => {
      addMode = !addMode; render();
      requestAnimationFrame(() => view.querySelector('#pp-cal-title')?.focus());
    });

    const doSave = () => {
      const title = view.querySelector('#pp-cal-title')?.value.trim();
      if (!title) { _toast('Enter an event title.'); return; }
      const time  = view.querySelector('#pp-cal-time')?.value || '';
      const evts  = load();
      evts.push({ id: Date.now(), date: selDate, title, time, created: Date.now() });
      save(evts); addMode = false; render();
    };
    view.querySelector('#pp-cal-save')?.addEventListener('click', doSave);
    view.querySelector('#pp-cal-cancel')?.addEventListener('click', () => { addMode = false; render(); });
    view.querySelector('#pp-cal-title')?.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); doSave(); }
      if (e.key === 'Escape') { addMode = false; render(); }
    });

    view.querySelectorAll('[data-cal-del]').forEach(btn => {
      btn.onclick = () => {
        const evts = load();
        const idx  = evts.findIndex(ev => ev.id === +btn.dataset.calDel);
        if (idx > -1) { evts.splice(idx, 1); save(evts); render(); }
      };
    });
  };

  render();
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function _e(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _ea(s) { return _e(s); }

function _toast(msg) {
  const t = document.createElement('div');
  t.className = 'unity-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-on'));
  setTimeout(() => { t.classList.remove('is-on'); setTimeout(() => t.remove(), 240); }, 2600);
}
