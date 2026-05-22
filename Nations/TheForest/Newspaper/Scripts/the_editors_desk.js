/**
 * the_editors_desk.js — Herald Front Page Configuration UI
 *
 * Renders an editorial control panel in The Editor's Desk section.
 * Lets authorized users (minRole: 4 — pastor/admin) override the Herald's
 * front page content via localStorage('flock_herald_config').
 *
 * Sections:
 *   1. Banner — church headline + deck tagline
 *   2. Lead Article — headline, subhead, body paragraphs
 *   3. Scripture — verse reference, translation, text
 *   4. Actions — Save / Preview / Reset
 *
 * The saved config is read by the_proclamation.js on the Herald front page.
 */

(function () {
  'use strict';

  var CONFIG_KEY = 'flock_herald_config';

  // ── Helpers ───────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadConfig() {
    try {
      var raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function saveConfig(cfg) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
      return true;
    } catch (_) { return false; }
  }

  function clearConfig() {
    try { localStorage.removeItem(CONFIG_KEY); } catch (_) {}
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  // ── Auth guard ────────────────────────────────────────────────────────────
  function getUserRoleLevel() {
    if (typeof Nehemiah !== 'undefined' && Nehemiah.getSession) {
      try {
        var sess = Nehemiah.getSession();
        var ROLE_MAP = { readonly: 0, volunteer: 1, care: 2, deacon: 2,
                         leader: 3, treasurer: 3, pastor: 4, admin: 5 };
        if (sess && typeof sess.roleLevel === 'number') return sess.roleLevel;
        if (sess && sess.role && ROLE_MAP[sess.role] !== undefined) return ROLE_MAP[sess.role];
      } catch (_) {}
    }
    return -1;
  }

  // ── Field builder ─────────────────────────────────────────────────────────
  function field(id, label, placeholder, value, isTextarea) {
    var tag  = isTextarea ? 'textarea' : 'input';
    var rows = isTextarea ? ' rows="4"' : '';
    var type = isTextarea ? '' : ' type="text"';
    return [
      '<div class="ed-field">',
      '  <label class="ed-label" for="' + id + '">' + esc(label) + '</label>',
      '  <' + tag + type + rows + ' id="' + id + '" class="ed-input" placeholder="' + esc(placeholder) + '">' +
        (isTextarea ? esc(value) : '') +
        '</' + tag + '>',
    ].join('\n') +
    (!isTextarea ? '\n  <!-- input value set by JS -->' : '') +
    '\n</div>';
  }

  // ── Render UI ──────────────────────────────────────────────────────────────
  function renderDesk(userLevel) {
    var main = document.getElementById('section-main');
    if (!main) return;

    // Role gate
    if (userLevel < 4) {
      main.innerHTML = [
        '<div class="np-broadsheet">',
        '<div class="np-banner" style="border-bottom-color:var(--ed-bg)">',
        '  <p class="np-banner__flag" style="color:var(--ed-bg)">The Flock Herald &mdash; Editor\'s Desk</p>',
        '  <h2 class="np-banner__headline">Editor\'s Desk</h2>',
        '  <p class="np-banner__deck">Herald configuration &mdash; authorized personnel only.</p>',
        '</div>',
        '<div style="padding:40px 20px;text-align:center;">',
        '  <p class="np-byline" style="font-size:1rem;">',
        '    This section requires pastor or administrator access.',
        '  </p>',
        '</div>',
        '</div>',
      ].join('\n');
      return;
    }

    var cfg = loadConfig();
    var hasOverrides = Object.keys(cfg).length > 0;

    main.innerHTML = [
      '<div class="np-broadsheet">',

      // Banner
      '<div class="np-banner" style="border-bottom-color:var(--ed-bg)">',
      '  <p class="np-banner__flag" style="color:var(--ed-bg)">The Flock Herald &mdash; Editor\'s Desk</p>',
      '  <h2 class="np-banner__headline">Configure Today\'s Edition</h2>',
      '  <p class="np-banner__deck">',
      '    Overrides apply to the Herald front page for all readers on this device.',
      '    ' + (hasOverrides ? '<span class="ed-badge ed-badge--active">Overrides active</span>' :
                               '<span class="ed-badge">Using defaults</span>'),
      '  </p>',
      '</div>',

      '<div class="np-cols ed-cols">',

      // Left col: Banner + Lead Article fields
      '<div class="np-col" style="grid-column:span 2">',

      '<div class="ed-section">',
      '  <p class="ed-section__title">Banner</p>',
      '  <p class="ed-section__desc">The full-width headline above the columns on the front page.</p>',
      '  ' + field('ed-bannerHeadline', 'Banner Headline',
          'Church name — The Flock Herald', cfg.bannerHeadline || ''),
      '  ' + field('ed-bannerDeck', 'Banner Tagline',
          'All the news of the congregation, set in type each morning.', cfg.bannerDeck || ''),
      '</div>',

      '<div class="ed-section">',
      '  <p class="ed-section__title">Lead Article</p>',
      '  <p class="ed-section__desc">The main story in column one of today\'s front page.</p>',
      '  ' + field('ed-leadHeadline', 'Headline',
          'Welcome to [Church Name]', cfg.leadHeadline || ''),
      '  ' + field('ed-leadSubhead', 'Subhead / Byline',
          'Your daily church paper, organized for the whole congregation.', cfg.leadSubhead || ''),
      '  ' + field('ed-leadBody1', 'Body — First Paragraph',
          'The lead paragraph (starts with a drop cap)…', cfg.leadBody1 || '', true),
      '  ' + field('ed-leadBody2', 'Body — Second Paragraph',
          'The closing paragraph…', cfg.leadBody2 || '', true),
      '</div>',

      '</div>', // end left col

      // Right col: Scripture
      '<div class="np-col">',

      '<div class="ed-section">',
      '  <p class="ed-section__title">Morning Scripture</p>',
      '  <p class="ed-section__desc">The pull quote in column two. Displayed as a styled blockquote.</p>',
      '  ' + field('ed-scriptureVerse', 'Verse Reference',
          'Lamentations 3:22–23', cfg.scriptureVerse || ''),
      '  ' + field('ed-scriptureRef', 'Translation',
          'ESV', cfg.scriptureRef || ''),
      '  ' + field('ed-scriptureText', 'Scripture Text',
          'The steadfast love of the Lord never ceases…', cfg.scriptureText || '', true),
      '</div>',

      // Save/Reset actions
      '<div class="ed-actions">',
      '  <button class="ed-btn ed-btn--save" id="ed-save">Save to Herald</button>',
      '  <button class="ed-btn ed-btn--preview" id="ed-preview">Preview Herald</button>',
      '  <button class="ed-btn ed-btn--reset" id="ed-reset">' +
          (hasOverrides ? 'Reset to Defaults' : 'Defaults Active') + '</button>',
      '</div>',

      '<div id="ed-status" class="ed-status" aria-live="polite"></div>',

      '</div>', // end right col

      '</div>', // end np-cols
      '</div>', // end np-broadsheet
    ].join('\n');

    // Set input values (input tags need .value, not innerHTML)
    [
      ['ed-bannerHeadline', cfg.bannerHeadline],
      ['ed-bannerDeck',     cfg.bannerDeck],
      ['ed-leadHeadline',   cfg.leadHeadline],
      ['ed-leadSubhead',    cfg.leadSubhead],
    ].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el && pair[1]) el.value = pair[1];
    });

    wireActions();
  }

  // ── Wire save/preview/reset ───────────────────────────────────────────────
  function wireActions() {
    var saveBtn    = document.getElementById('ed-save');
    var previewBtn = document.getElementById('ed-preview');
    var resetBtn   = document.getElementById('ed-reset');
    var status     = document.getElementById('ed-status');

    function showStatus(msg, type) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'ed-status ed-status--' + (type || 'ok');
      clearTimeout(status._timer);
      status._timer = setTimeout(function () {
        status.textContent = '';
        status.className = 'ed-status';
      }, 3500);
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var cfg = {
          bannerHeadline: val('ed-bannerHeadline'),
          bannerDeck:     val('ed-bannerDeck'),
          leadHeadline:   val('ed-leadHeadline'),
          leadSubhead:    val('ed-leadSubhead'),
          leadBody1:      val('ed-leadBody1'),
          leadBody2:      val('ed-leadBody2'),
          scriptureVerse: val('ed-scriptureVerse'),
          scriptureRef:   val('ed-scriptureRef'),
          scriptureText:  val('ed-scriptureText'),
        };
        // Remove blank fields so defaults fill in
        Object.keys(cfg).forEach(function (k) {
          if (!cfg[k]) delete cfg[k];
        });
        if (saveConfig(cfg)) {
          showStatus('Saved. The Herald will reflect these changes.', 'ok');
          var badge = document.querySelector('.ed-badge');
          if (badge) { badge.textContent = 'Overrides active'; badge.classList.add('ed-badge--active'); }
          if (resetBtn) resetBtn.textContent = 'Reset to Defaults';
        } else {
          showStatus('Save failed — localStorage may be unavailable.', 'error');
        }
      });
    }

    if (previewBtn) {
      previewBtn.addEventListener('click', function () {
        window.location.href = '../../index.html';
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        clearConfig();
        showStatus('Reset to defaults. Herald will use auto-generated content.', 'ok');
        var badge = document.querySelector('.ed-badge');
        if (badge) { badge.textContent = 'Using defaults'; badge.classList.remove('ed-badge--active'); }
        resetBtn.textContent = 'Defaults Active';
        // Clear all input values
        ['ed-bannerHeadline','ed-bannerDeck','ed-leadHeadline','ed-leadSubhead',
         'ed-leadBody1','ed-leadBody2','ed-scriptureVerse','ed-scriptureRef','ed-scriptureText'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.value = '';
        });
      });
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function boot() {
    var level = getUserRoleLevel();
    renderDesk(level);

    if (typeof Nehemiah !== 'undefined' && typeof Nehemiah.onAuthResolved === 'function') {
      Nehemiah.onAuthResolved(function (sess) {
        var ROLE_MAP = { readonly: 0, volunteer: 1, care: 2, deacon: 2,
                         leader: 3, treasurer: 3, pastor: 4, admin: 5 };
        var l = (sess && sess.role && ROLE_MAP[sess.role] !== undefined)
          ? ROLE_MAP[sess.role] : 0;
        renderDesk(l);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
