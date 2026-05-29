/* ══════════════════════════════════════════════════════════════════════════════
   FIRM_FOUNDATION.js — The Secure Wall
   "So I sent messengers to them, saying, 'I am doing a great work
    and I cannot come down.'" — Nehemiah 6:3

   Nehemiah rebuilt the wall around Jerusalem to protect God's people.
   This module guards access to FlockOS — no one enters without passing
   through the gate.

   Responsibilities:
     1. Gate check — is the user authenticated?  (isAuthenticated)
     2. Login      — email + passcode → token    (login)
     3. Logout     — clear session + server       (logout)
     4. Register   — self-registration            (register)
     5. Forgot     — password reset request        (forgotPassword)
     6. Reset      — reset with code               (resetWithCode)
     7. Guard      — redirect unauthenticated      (guard)
     8. Role check — minimum role enforcement       (requireRole)
     9. Session    — expose session data            (getSession, getProfile)

   Depends on:
     TheVine  (the_true_vine.js) — all API calls flow through The Vine

   Usage:
     Nehemiah.guard();                              // redirect if not logged in
     Nehemiah.login('user@email.com', 'pass123');   // returns session or throws
     Nehemiah.logout();                             // clears everything
     Nehemiah.isAuthenticated();                    // true / false
     Nehemiah.requireRole('pastor');                // throws if insufficient
     Nehemiah.getSession();                         // { token, email, role, ... }
   ══════════════════════════════════════════════════════════════════════════════ */

var Nehemiah = (() => {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────

  // New Covenant is fully separated from the Old Covenant `FlockOS/Pages/`
  // layout. There is no shared `the_wall.html`. Instead, every app under
  // `New_Covenant/app.<name>/` provides its own standalone sign-in page at
  // `app.<name>/index.html` (the "Stand pattern"). The launcher lives at
  // `New_Covenant/index.html`.
  //
  // `LOGIN_PAGE` and `APP_PAGE` are computed per-call from the current URL so
  // that `guard()` always lands on the correct per-app login screen.

  function _currentAppFolder() {
    // Returns 'app.flockchat', 'app.feed', etc. when inside an app dir, else ''.
    var m = location.pathname.match(/\/(app\.[a-z0-9_-]+)(\/|$)/i);
    return m ? m[1] : '';
  }

  function _newCovenantBase() {
    // Absolute URL of the deployment root that contains the launcher
    // (New_Covenant/, Nations/<Church>/, or the site root).
    // Always ends with a trailing '/'.
    var p = location.pathname;

    // 1. Dev / source tree: /…/New_Covenant/…
    var idx = p.indexOf('/New_Covenant/');
    if (idx >= 0) {
      return location.origin + p.substring(0, idx + '/New_Covenant/'.length);
    }

    // 2. Production: /…/Nations/<Church>/…
    var nm = p.match(/^(.*\/Nations\/[^/]+\/)/);
    if (nm) {
      return location.origin + nm[1];
    }

    // 3. Fallback: strip the current app folder (so we don't double it),
    //    then strip the file segment so we land at the parent dir.
    var stripped = p.replace(/\/(app\.[a-z0-9_-]+)\/[^/]*$/i, '/');
    if (stripped !== p) {
      return location.origin + stripped;
    }
    return location.origin + p.replace(/[^/]*$/, '');
  }

  function _resolveLoginPage() {
    var app = _currentAppFolder();
    var base = _newCovenantBase();
    return app
      ? base + app + '/index.html'   // per-app sign-in
      : base + 'index.html';          // launcher (public)
  }

  function _resolveAppPage() {
    var app = _currentAppFolder();
    var base = _newCovenantBase();
    return app
      ? base + app + '/' + app + '.html'   // app.flockchat → app.flockchat.html
      : base + 'index.html';
  }

  // Public portal (FlockOS.html) — where users land after logout.
  // Portals store their own URL in sessionStorage so we can always return to
  // the correct church portal regardless of the app's script path depth.
  const PUBLIC_PORTAL = (() => {
    // First choice: portal page stored its own URL when it loaded
    var stored = sessionStorage.getItem('_flockos_portal');
    if (stored) return stored;
    // Fallback: derive from the script's absolute URL. Two layouts exist:
    //   • Deployed (Nations/<church>/FlockOS/Scripts/...) — portal at <church>/FlockOS.html
    //   • Source   (Covenant/Courts/TheTabernacle/Scripts/...) — portal at TheTabernacle/FlockOS.html
    // Strip the parent dir ONLY when it's the canonical "FlockOS" app folder.
    var s = document.querySelector('script[src*="firm_foundation"]');
    if (s && s.src) {
      var m = s.src.match(/^(.+\/)([^/]+)\/Scripts\/firm_foundation\.js/);
      if (m) {
        var parentDir = m[1];
        var appFolder = m[2];
        return appFolder === 'FlockOS'
          ? parentDir + 'FlockOS.html'
          : parentDir + appFolder + '/FlockOS.html';
      }
    }
    return window.location.origin + '/';
  })();
  const ROLE_LEVELS = { readonly: 0, volunteer: 1, care: 2, leader: 3, pastor: 4, admin: 5 };

  // ── Local Security Bypass ────────────────────────────────────────────────
  // Allows running FlockOS locally (file:// or localhost) without a live
  // GAS backend.  Injects a synthetic admin session into sessionStorage so
  // TheVine.session() and all downstream auth checks pass transparently.
  //
  // Activate:   Nehemiah.enableLocalBypass()
  // Deactivate: Nehemiah.disableLocalBypass()
  // Check:      Nehemiah.isLocalBypass()
  //
  // The flag persists in localStorage — survives page reloads but NOT
  // incognito/different-browser sessions (by design).

  const LOCAL_BYPASS_KEY = 'flock_local_bypass';

  /** True only when the page is served from file://, localhost, or 127.0.0.1. */
  function _isLocalEnv() {
    const h = location.hostname;
    return location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1';
  }

  function _isLocalBypass() {
    return _isLocalEnv() && localStorage.getItem(LOCAL_BYPASS_KEY) === 'true';
  }

  /** Build the synthetic session that stands in for a real server token. */
  function _syntheticSession() {
    // Build all-true permissions map for local dev
    const allPerms = {};
    const moduleKeys = [
      'dashboard','daily-bread','upper-room','reading-plan','devotionals',
      'prayer','my-requests','words','themes','sermons','songs','calendar',
      'events','services','ministries','volunteers','todo','checkin','journal',
      'directory','members','care','my-flock','prayer-admin','compassion','mirror',
      'groups','attendance','giving','discipleship','outreach','learning',
      'theology','library','comms','missions','statistics','reports',
      'users','config','audit','interface-studio'
    ];
    moduleKeys.forEach(k => { allPerms[k] = true; });

    return {
      token:       'local-bypass-' + Date.now(),
      email:       'local@flockos.dev',
      role:        'admin',
      roleLevel:   5,
      displayName: 'Local Developer',
      expiresAt:   Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      permissions: allPerms,
    };
  }

  /** Ensure the synthetic session exists in sessionStorage. */
  function _ensureBypassSession() {
    const key = 'flock_auth_session';
    const existing = sessionStorage.getItem(key);
    if (!existing) {
      sessionStorage.setItem(key, JSON.stringify(_syntheticSession()));
    }
    // Also inject a minimal profile so getProfile() works
    const profKey = 'flock_auth_profile';
    if (!sessionStorage.getItem(profKey)) {
      sessionStorage.setItem(profKey, JSON.stringify({
        email:       'local@flockos.dev',
        displayName: 'Local Developer',
        firstName:   'Local',
        lastName:    'Developer',
        role:        'admin',
        theme:       'Auto',
      }));
    }
  }

  /** Activate Local Security Bypass (only works on local origins). */
  function enableLocalBypass() {
    if (!_isLocalEnv()) {
      console.warn('[Nehemiah] Local Security Bypass is only available on file://, localhost, or 127.0.0.1.');
      return;
    }
    localStorage.setItem(LOCAL_BYPASS_KEY, 'true');
    _ensureBypassSession();
    console.log('%c[Nehemiah] Local Security Bypass ENABLED — admin session injected.', 'color:#e8a838;font-weight:bold');
  }

  /** Deactivate Local Security Bypass and clear the synthetic session. */
  function disableLocalBypass() {
    localStorage.removeItem(LOCAL_BYPASS_KEY);
    // Only clear if the session is the synthetic one
    try {
      const raw = sessionStorage.getItem('flock_auth_session');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.email === 'local@flockos.dev') {
          sessionStorage.removeItem('flock_auth_session');
          sessionStorage.removeItem('flock_auth_profile');
        }
      }
    } catch (_) { /* ignore */ }
    console.log('%c[Nehemiah] Local Security Bypass DISABLED.', 'color:#e8a838;font-weight:bold');
  }

  // Auto-restore bypass session on page load if the flag is set
  if (_isLocalBypass()) {
    _ensureBypassSession();
  }


  // ── Gate Check ───────────────────────────────────────────────────────────

  /** Returns true if a valid, non-expired session exists client-side. */
  function isAuthenticated() {
    if (_isLocalBypass()) return true;
    if (TheVine.session() !== null) return true;
    // Firebase Auth persists across page loads
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) return true;
    return false;
  }

  /** Returns the current session object or null. */
  function getSession() {
    if (_isLocalBypass()) { _ensureBypassSession(); }
    return TheVine.session();
  }

  /** Returns the cached profile or null. */
  function getProfile() {
    try {
      const raw = sessionStorage.getItem('flock_auth_profile');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  /**
   * Check if user is currently logged in.
   * @returns {FlockSession|null}
   */
  function session() {
    return getSession();
  }

  // ── Guard (page-level gate) ──────────────────────────────────────────────

  /**
   * Call at the top of every protected page.
   * Redirects to the login wall if the user has no valid session.
   * Returns the session object if authenticated (so callers can use it).
   */
  function guard() {
    if (_isLocalBypass()) { _ensureBypassSession(); }
    const session = getSession();
    if (!session) {
      // Check Firebase Auth as a fallback — the session may have been cleared
      // but Firebase Auth persists across tabs/refreshes automatically
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        // Firebase Auth is valid — restore a minimal session so the app works
        var fbUser = firebase.auth().currentUser;
        var restored = {
          token:       'fb-auth-' + Date.now(),
          email:       fbUser.email || '',
          role:        (fbUser.customClaims && fbUser.customClaims.role) || 'readonly',
          displayName: fbUser.displayName || fbUser.email || '',
          expiresAt:   Date.now() + 6 * 60 * 60 * 1000
        };
        try { sessionStorage.setItem('flock_auth_session', JSON.stringify(restored)); } catch (_) {}
        return restored;
      }
      window.location.replace(_resolveLoginPage());
      return null;
    }
    return session;
  }

  /**
   * Call on the login page itself — if already authenticated, skip to app.
   */
  function guardLogin() {
    if (_isLocalBypass()) {
      window.location.replace(_resolveAppPage());
      return;
    }
    if (isAuthenticated()) {
      window.location.replace(_resolveAppPage());
    }
  }


  // ── Role Enforcement ─────────────────────────────────────────────────────

  /**
   * Returns true if the current user meets the minimum role requirement.
   * @param {string} minRole — 'readonly' | 'volunteer' | 'care' | 'leader' | 'pastor' | 'admin'
   */
  function hasRole(minRole) {
    const session = getSession();
    if (!session || !session.role) return false;
    const userLevel = ROLE_LEVELS[session.role] ?? -1;
    const reqLevel  = ROLE_LEVELS[minRole] ?? 99;
    return userLevel >= reqLevel;
  }

  /**
   * Returns true if the current user has access to the given module.
   * Checks the permissions map returned by the server at login.
   * Falls back to role-level check if no permissions map exists.
   *
   * @param {string} moduleKey — e.g. 'events', 'giving', 'users'
   * @returns {boolean}
   */
  /**
   * Returns the user's group list as a lowercase array.
   * Checks both session.groups and profile.groups so it works regardless
   * of whether the server embeds groups in the session token or the profile.
   */
  function _getGroups() {
    const session = getSession();
    const profile = getProfile();
    const raw = (session && session.groups) || (profile && profile.groups) || '';
    if (!raw) return [];
    return String(raw).split(',').map(g => g.trim().toLowerCase()).filter(Boolean);
  }

  function canAccess(moduleKey) {
    const session = getSession();
    if (!session) return false;
    // Seed admin always has full access
    if (session.isSeed) return true;
    // Admin role (level 5) always has full access
    if ((session.roleLevel || 0) >= 5) return true;
    // Group-based master overrides — checked against both session and profile
    const groups = _getGroups();
    if (groups.indexOf('seed admin') !== -1) return true;
    if (groups.indexOf('lead pastor') !== -1) return true;
    if (groups.indexOf('master') !== -1) return true;
    if (groups.indexOf('admin') !== -1) return true;
    if (groups.indexOf('timothy') !== -1) return true;
    // Specific module grant via permissions map
    if (session.permissions && typeof session.permissions === 'object') {
      return session.permissions[moduleKey] === true;
    }
    // No permissions map — deny (need-to-know model)
    return false;
  }

  /**
   * Returns true for the given fine-grained capability key.
   * Seed admin and Lead Pastor bypass all checks and always return true.
   * All other users are evaluated against the permissions map returned at login.
   *
   * @param {string} capability — e.g. 'care.view-all', 'my-flock.add-edit-members'
   * @returns {boolean}
   */
  function can(capability) {
    const session = getSession();
    if (!session) return false;
    // Seed admin always has full access
    if (session.isSeed) return true;
    // Admin role (level 5) always has full access
    if ((session.roleLevel || 0) >= 5) return true;
    // Group-based master overrides
    const groups = _getGroups();
    if (groups.indexOf('seed admin') !== -1) return true;
    if (groups.indexOf('lead pastor') !== -1) return true;
    if (groups.indexOf('master') !== -1) return true;
    if (groups.indexOf('admin') !== -1) return true;
    if (groups.indexOf('timothy') !== -1) return true;
    if (session.permissions && typeof session.permissions === 'object') {
      // Exact match
      if (session.permissions[capability] === true) return true;
      // Walk up parent chain — 'care.view-all' → 'care', 'discipleship.paths.edit' → 'discipleship.paths' → 'discipleship'
      let key = capability;
      while (key.includes('.')) {
        key = key.substring(0, key.lastIndexOf('.'));
        if (session.permissions[key] === true) return true;
      }
      return false;
    }
    return false;
  }

  /**
   * Returns true if the current user belongs to the named group.
   * Checks the profile's groups field (comma-separated in AccessControl).
   * @param {string} groupName — e.g. 'Lead Pastor'
   */
  function hasGroup(groupName) {
    return _getGroups().indexOf(String(groupName).toLowerCase()) !== -1;
  }

  /**
   * Throws an Error if the user doesn't meet the minimum role.
   * Use for gating admin panels, pastor-only views, etc.
   */
  function requireRole(minRole) {
    if (!hasRole(minRole)) {
      throw new Error('Access denied. Requires ' + minRole + ' or higher.');
    }
  }


  // ── Login ────────────────────────────────────────────────────────────────

  /**
   * Authenticates with email + passcode via John (Flock API).
   * On success: saves session + profile to sessionStorage, returns session.
   * On failure: throws an Error with the server's message.
   *
   * @param {string} email
   * @param {string} passcode
   * @returns {Promise<Object>} session object { token, email, role, displayName, expiresAt }
   */
  async function login(email, passcode) {
    if (!email || !passcode) {
      throw new Error('Email and passcode are required.');
    }

    const result = await TheVine.john.auth.login({ email, passcode });

    if (!result || !result.ok) {
      throw new Error((result && result.error) || 'Login failed.');
    }

    // TheVine.john.auth.login already saves the session internally.
    // Cache profile if returned with the login response.
    if (result.profile) {
      try { sessionStorage.setItem('flock_auth_profile', JSON.stringify(result.profile)); } catch (_) {}
    }

    // If the login response didn't include a profile (or didn't include groups),
    // fetch it now — before redirecting — so group-based permission checks work
    // synchronously on the next page.
    if (!result.profile || !result.profile.groups) {
      try {
        const prof = await TheVine.john.auth.profile({});
        if (prof && (prof.groups || prof.permissions)) {
          try { sessionStorage.setItem('flock_auth_profile', JSON.stringify(prof)); } catch (_) {}
        }
      } catch (_) { /* best-effort — app will re-try on load */ }
    }

    // Authenticate with Firebase Auth immediately so subsequent pages
    // can verify auth via firebase.auth().currentUser (instant, no GAS).
    try {
      if (typeof UpperRoom !== 'undefined' && UpperRoom.init) {
        await UpperRoom.init();
        await UpperRoom.authenticate();
      }
    } catch (_) { /* Firebase auth is best-effort — GAS session still works */ }

    return result.session || result;
  }


  // ── Logout ───────────────────────────────────────────────────────────────

  // ── Logout farewell card ────────────────────────────────────────────────
  function _showLogoutCard() {
    var accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e8a838';
    var goldColor   = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()   || '#d4b870';

    // Inject keyframe animations
    var styleEl = document.createElement('style');
    styleEl.textContent =
      '@keyframes _logoutGlow{' +
        '0%,100%{box-shadow:0 32px 96px rgba(0,0,0,0.65),' +
          '0 0 0 1px rgba(232,168,56,0.35),' +
          '0 0 30px rgba(232,168,56,0.45),' +
          '0 0 70px rgba(232,168,56,0.28),' +
          '0 0 130px rgba(232,168,56,0.16),' +
          '0 0 220px rgba(232,168,56,0.08),' +
          'inset 0 1px 0 rgba(255,255,255,0.08);}' +
        '50%{box-shadow:0 32px 96px rgba(0,0,0,0.65),' +
          '0 0 0 1px rgba(232,168,56,0.65),' +
          '0 0 40px rgba(232,168,56,0.70),' +
          '0 0 90px rgba(232,168,56,0.45),' +
          '0 0 160px rgba(232,168,56,0.28),' +
          '0 0 280px rgba(232,168,56,0.14),' +
          'inset 0 1px 0 rgba(255,255,255,0.08);}' +
      '}' +
      '@keyframes _logoutPulse{' +
        '0%,100%{filter:drop-shadow(0 0 12px rgba(232,168,56,0.5));}' +
        '50%{filter:drop-shadow(0 0 22px rgba(232,168,56,0.85));}' +
      '}';
    document.head.appendChild(styleEl);

    var overlay = document.createElement('div');
    overlay.id = '_logout-overlay';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:999999;',
      'display:flex;align-items:flex-start;justify-content:center;',
      'overflow-y:auto;padding:48px 0 120px;',
      'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
      'background:rgba(15,20,40,0.72);',
      'opacity:0;transition:opacity .35s ease;'
    ].join('');

    var card = document.createElement('div');
    card.style.cssText = [
      'background:linear-gradient(145deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%);',
      'border:1px solid rgba(232,168,56,0.55);',
      'border-radius:22px;padding:44px 40px 36px;',
      'max-width:420px;width:88%;',
      'animation:_logoutGlow 3s ease-in-out 0.35s infinite;',
      'transform:translateY(12px);transition:transform .35s ease;'
    ].join('');

    card.innerHTML =
      '<div style="font-size:3rem;margin-bottom:18px;display:block;text-align:center;' +
        'animation:_logoutPulse 2.5s ease-in-out infinite;">\uD83D\uDD4A\uFE0F</div>' +
      '<h2 style="color:#e8a838;font-size:1.35rem;font-weight:700;margin:0 0 16px;' +
        'line-height:1.4;font-family:inherit;text-align:center;' +
        'text-shadow:0 0 20px rgba(232,168,56,0.3);">Thank you for trusting FlockOS!</h2>' +
      '<p style="color:rgba(255,255,255,0.82);font-size:0.97rem;line-height:1.5;' +
        'margin:0 0 20px;font-family:inherit;text-align:left;">' +
        'We are praying for you, and the success of the ministry that the Lord has entrusted to you. God Bless YOU!</p>' +
      '<p style="margin:0 0 20px;font-family:inherit;text-align:left;">' +
        '<span style="color:' + goldColor + ';font-style:italic;font-size:1.05rem;line-height:1.6;display:block;">' +
        '\u201CMay the Lord bless you and keep you; ' +
        'May the Lord make his face shine on you and be gracious to you; ' +
        'May the Lord turn his face toward you and give you peace.\u201D</span>' +
        '<span style="color:' + goldColor + ';font-style:italic;font-size:0.92rem;opacity:0.75;' +
          'display:block;text-align:right;margin-top:8px;">\u2014 Numbers 6:24\u201326</span>' +
      '</p>' +
      '<div style="background:rgba(255,255,255,0.1);border-radius:8px;height:5px;overflow:hidden;margin-bottom:14px;">' +
        '<div id="_logout-progress" style="height:100%;width:100%;border-radius:8px;' +
          'background:linear-gradient(90deg,' + accentColor + ',' + goldColor + ');' +
          'transition:width 25s linear;"></div>' +
      '</div>' +
      '<p style="color:rgba(255,255,255,0.35);font-size:0.75rem;letter-spacing:0.06em;' +
        'text-transform:uppercase;margin:0;font-family:inherit;">Signing you out\u2026</p>';

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Fade in overlay + slide up card
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.style.opacity = '1';
        card.style.transform = 'translateY(0)';
        // Start progress bar drain
        var bar = document.getElementById('_logout-progress');
        if (bar) bar.style.width = '0%';
      });
    });
  }

  /**
   * Clears local session and tells the server to invalidate the token.
   * Shows a farewell card for 25 s, then redirects to the public portal.
   */
  async function logout() {
    // Show goodbye card immediately
    _showLogoutCard();

    // Run auth cleanup in parallel with the countdown
    (async function() {
      try { await TheVine.john.auth.logout({}); } catch (_) {}
      try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
          await firebase.auth().signOut();
        }
        if (typeof UpperRoom !== 'undefined' && UpperRoom.signOut) {
          UpperRoom.signOut();
        }
      } catch (_) {}
    })();

    // Always honour the full 25 s so the card is readable, then go to launcher
    await new Promise(function(resolve) { setTimeout(resolve, 25000); });
    window.location.replace(_newCovenantBase() + 'index.html');
  }


  // ── Registration ─────────────────────────────────────────────────────────

  /**
   * Self-register a new account (if ALLOW_SELF_REGISTER is enabled).
   * Account starts in 'pending' status — admin must approve before login.
   *
   * @param {Object} opts — { email, passcode, firstName, lastName? }
   * @returns {Promise<Object>} server response
   */
  async function register(opts) {
    if (!opts.email || !opts.passcode || !opts.firstName) {
      throw new Error('Email, passcode, and first name are required.');
    }

    const result = await TheVine.john.auth.register(opts);

    if (!result || !result.ok) {
      throw new Error((result && result.error) || 'Registration failed.');
    }

    return result;
  }


  // ── Password Reset ───────────────────────────────────────────────────────

  /**
   * Request a password reset code (sent to email).
   * Returns a generic success message regardless of whether the email exists.
   */
  async function forgotPassword(email) {
    if (!email) throw new Error('Email is required.');

    const result = await TheVine.john.auth.forgotPassword({ email });

    if (!result || !result.ok) {
      throw new Error((result && result.error) || 'Request failed.');
    }

    return result;
  }

  /**
   * Reset password using the 6-digit code from email.
   */
  async function resetWithCode(email, resetCode, newPasscode) {
    if (!email || !resetCode || !newPasscode) {
      throw new Error('Email, reset code, and new passcode are required.');
    }

    const result = await TheVine.john.auth.resetWithToken({
      email, resetCode, newPasscode
    });

    if (!result || !result.ok) {
      throw new Error((result && result.error) || 'Reset failed.');
    }

    return result;
  }


  // ── Offline Vault Integration ────────────────────────────────────────────

  /**
   * Set up offline vault: encrypt current session with a PIN.
   * @param {string} pin — 6+ character PIN
   */
  async function setupVault(pin) {
    if (typeof TheWellspring === 'undefined' || !TheWellspring.vault) {
      throw new Error('Offline vault not available');
    }
    var s = getSession();
    if (!s) throw new Error('Must be logged in to set up offline vault');
    await TheWellspring.vault.setup(pin, {
      email: s.email,
      role: s.role,
      roleLevel: s.roleLevel,
      displayName: s.displayName,
      permissions: s.permissions || {},
      isSeed: s.isSeed || false,
    });
  }

  /**
   * Attempt offline login with PIN.
   * Decrypts the vault and creates a local session with offline:true flag.
   * @param {string} pin
   * @returns {Promise<FlockSession>}
   */
  async function loginOffline(pin) {
    if (typeof TheWellspring === 'undefined' || !TheWellspring.vault) {
      throw new Error('Offline vault not available');
    }
    var session = await TheWellspring.vault.unlock(pin);
    // reduced TTL: 4 hours
    session.expiresAt = Date.now() + (4 * 60 * 60 * 1000);
    session.token = 'offline-' + Date.now();
    sessionStorage.setItem('flock_auth_session', JSON.stringify(session));
    return session;
  }

  /**
   * Check if offline vault is available.
   * @returns {Promise<boolean>}
   */
  async function hasVault() {
    if (typeof TheWellspring === 'undefined' || !TheWellspring.vault) return false;
    return TheWellspring.vault.exists();
  }

  /**
   * Destroy the offline vault.
   */
  async function destroyVault() {
    if (typeof TheWellspring === 'undefined' || !TheWellspring.vault) return;
    return TheWellspring.vault.destroy();
  }


  // ── Public API ───────────────────────────────────────────────────────────

  return Object.freeze({
    // Gate
    isAuthenticated,
    guard,
    guardLogin,

    // Session
    getSession,
    getProfile,

    // Role
    hasRole,
    hasGroup,
    canAccess,
    can,
    requireRole,

    // Auth actions
    login,
    logout,
    register,
    forgotPassword,
    resetWithCode,

    // Offline Vault
    setupVault,
    loginOffline,
    hasVault,
    destroyVault,

    // Local Security Bypass
    enableLocalBypass,
    disableLocalBypass,
    isLocalBypass: _isLocalBypass,
  });

})();

// Expose globally so ES modules and standalone apps can access it
if (typeof window !== 'undefined') window.Nehemiah = Nehemiah;
