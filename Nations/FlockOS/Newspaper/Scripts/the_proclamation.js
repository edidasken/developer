/**
 * the_proclamation.js — Flock Herald Content Engine
 *
 * Populates the #herald-main element with the Herald front page.
 *
 * Architecture:
 * - Reads window.HERALD_CHURCH_NAME + window.HERALD_CHURCH_ID (injected by C-Build)
 * - Reads localStorage('flock_herald_config') for editor overrides set by Editor's Desk
 * - Renders: lead article block, section preview grid, daily scripture card
 * - All content is organized into editorial "columns" matching the Newspaper design system
 *
 * Phase progression:
 *   Phase 0 (now):  Static skeleton with today's date, church name, section previews
 *   Phase 1:        Live scripture via Wellspring API, dynamic devotional
 *   Phase 2+:       Editor-driven overrides, Firestore announcements, etc.
 */

(function () {
  'use strict';

  // ── Section Preview Registry ───────────────────────────────────────────────
  // Each card in the front-page section grid.
  var SECTION_PREVIEWS = [
    {
      slug: 'tabernacle',
      label: 'The Tabernacle',
      deck: 'Worship & Devotional',
      color: 'var(--sec-tabernacle)',
      minRole: 0,
    },
    {
      slug: 'epistles',
      label: 'The Letters',
      deck: 'Church Communications',
      color: 'var(--sec-epistles)',
      minRole: 0,
    },
    {
      slug: 'straight_path',
      label: 'The Path',
      deck: 'Discipleship & Growth',
      color: 'var(--sec-straight-path)',
      minRole: -1,
    },
    {
      slug: 'living_water',
      label: 'The Wellspring',
      deck: 'Scripture & Reflection',
      color: 'var(--sec-living-water)',
      minRole: -1,
    },
    {
      slug: 'gatehouse',
      label: 'The Bulletin',
      deck: 'Announcements & Events',
      color: 'var(--sec-gatehouse)',
      minRole: 0,
    },
    {
      slug: 'pulpit',
      label: 'The Pulpit',
      deck: 'Sermons & Teaching',
      color: 'var(--sec-pulpit)',
      minRole: 3,
    },
    {
      slug: 'levites',
      label: 'The Cantors',
      deck: 'Music & Worship Planning',
      color: 'var(--sec-levites)',
      minRole: 3,
    },
    {
      slug: 'stage',
      label: 'The Stage',
      deck: 'Media & Presentation',
      color: 'var(--sec-stage)',
      minRole: 3,
    },
    {
      slug: 'genealogies',
      label: 'The Family Tree',
      deck: 'Congregation Records',
      color: 'var(--sec-genealogies)',
      minRole: 0,
    },
    {
      slug: 'great_commission',
      label: 'The Mission',
      deck: 'Outreach & Evangelism',
      color: 'var(--sec-commission)',
      minRole: 4,
    },
    {
      slug: 'harvest',
      label: 'The Harvest',
      deck: 'Giving & Stewardship',
      color: 'var(--sec-harvest)',
      minRole: 4,
    },
    {
      slug: 'scroll_room',
      label: 'The Archive',
      deck: 'Documents & Records',
      color: 'var(--sec-scroll-room)',
      minRole: 4,
    },
    {
      slug: 'cornerstone',
      label: "The Shepherd's Desk",
      deck: 'Pastoral Dashboard',
      color: 'var(--sec-cornerstone)',
      minRole: 4,
    },
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getUserRoleLevel() {
    if (typeof Nehemiah !== 'undefined' && Nehemiah.getSession) {
      var sess = Nehemiah.getSession();
      if (sess && typeof sess.roleLevel === 'number') return sess.roleLevel;
      if (sess && sess.role) {
        var LEVELS = { readonly: 0, volunteer: 1, care: 2, deacon: 2,
                       leader: 3, treasurer: 3, pastor: 4, admin: 5 };
        return LEVELS[sess.role] !== undefined ? LEVELS[sess.role] : -1;
      }
    }
    return -1;
  }

  function getEditorConfig() {
    try {
      var raw = localStorage.getItem('flock_herald_config');
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function sectionHref(slug) {
    return 'Sections/' + slug + '/index.html';
  }

  // ── Build Section Preview Card HTML ───────────────────────────────────────
  function buildSectionCard(sec) {
    return [
      '<a class="np-section-card" href="' + sectionHref(sec.slug) + '"',
      '   data-section="' + sec.slug + '"',
      '   style="border-left-color:' + sec.color + '">',
      '  <span class="np-section-card__label">' + sec.label + '</span>',
      '  <span class="np-section-card__deck">' + sec.deck + '</span>',
      '</a>',
    ].join('\n');
  }

  // ── Build Today's Scripture Placeholder ───────────────────────────────────
  function buildScriptureCard(cfg) {
    var verse = (cfg && cfg.scriptureVerse) || '';
    var text  = (cfg && cfg.scriptureText)  || '';

    if (!verse) {
      // Default to a classic morning verse for Phase 0
      verse = 'Lamentations 3:22–23';
      text  = 'The steadfast love of the Lord never ceases; his mercies never come to an end; they are new every morning; great is your faithfulness.';
    }

    return [
      '<div class="np-card np-card--gold" id="herald-scripture">',
      '  <p class="np-section-header">This Morning\u2019s Scripture</p>',
      '  <blockquote class="np-pull-quote">',
      '    <p>\u201c' + text + '\u201d</p>',
      '  </blockquote>',
      '  <p class="np-byline">' + verse + ' \u2014 ESV</p>',
      '</div>',
    ].join('\n');
  }

  // ── Build Lead Article ─────────────────────────────────────────────────────
  function buildLeadArticle(churchName, cfg) {
    var headline = (cfg && cfg.leadHeadline) || 'Welcome to ' + churchName;
    var subhead  = (cfg && cfg.leadSubhead)  || 'Your daily church paper, organized for the whole congregation.';

    return [
      '<div class="np-card np-card--gold" id="herald-lead">',
      '  <p class="np-section-header">Today\u2019s Edition</p>',
      '  <h2 class="np-headline">' + headline + '</h2>',
      '  <p class="np-byline">' + subhead + '</p>',
      '  <hr class="np-column-rule">',
      '  <p class="np-body">',
      '    The Flock Herald brings together everything your church does into one',
      '    beautifully organized paper. Each section below is a chapter of your',
      '    congregation\u2019s life \u2014 flip through and see what\u2019s on today.',
      '  </p>',
      '</div>',
    ].join('\n');
  }

  // ── Build Section Grid ─────────────────────────────────────────────────────
  function buildSectionGrid(userLevel) {
    var visible = SECTION_PREVIEWS.filter(function (s) {
      return s.minRole === -1 || (userLevel >= 0 && userLevel >= s.minRole);
    });

    if (!visible.length) return '';

    var cards = visible.map(buildSectionCard).join('\n');

    return [
      '<div class="np-section-header" style="margin-top:32px;">Sections of the Paper</div>',
      '<div class="np-section-grid" id="herald-section-grid">',
      cards,
      '</div>',
    ].join('\n');
  }

  // ── Inject Section Grid CSS (inline, additive) ────────────────────────────
  // the_broadsheet.css may not have .np-section-grid yet (Phase 1 CSS task);
  // inject a minimal inline style so Phase 0 looks correct now.
  function injectGridStyles() {
    if (document.getElementById('__proclamation_styles')) return;
    var style = document.createElement('style');
    style.id = '__proclamation_styles';
    style.textContent = [
      '.np-section-grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));',
      '  gap: 12px;',
      '  margin-bottom: 32px;',
      '}',
      '.np-section-card {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 4px;',
      '  padding: 14px 16px;',
      '  background: var(--paper-white);',
      '  border: 1px solid var(--rule-faint);',
      '  border-left: 3px solid var(--gold);',
      '  border-radius: 2px;',
      '  text-decoration: none;',
      '  transition: background 0.15s;',
      '}',
      '.np-section-card:hover { background: var(--paper-tint); }',
      '.np-section-card__label {',
      '  font-family: var(--font-headline);',
      '  font-size: 0.95rem;',
      '  color: var(--ink);',
      '  line-height: 1.3;',
      '}',
      '.np-section-card__deck {',
      '  font-family: var(--font-label);',
      '  font-size: 0.65rem;',
      '  font-variant: small-caps;',
      '  letter-spacing: 0.05em;',
      '  color: var(--ink-dim);',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Render Herald ──────────────────────────────────────────────────────────
  function renderHerald(userLevel) {
    var main = document.getElementById('herald-main');
    if (!main) return;

    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME
      : 'The Church';

    var cfg = getEditorConfig();

    injectGridStyles();

    main.innerHTML = [
      buildLeadArticle(churchName, cfg),
      buildScriptureCard(cfg),
      buildSectionGrid(userLevel),
    ].join('\n');
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function boot() {
    var initialLevel = getUserRoleLevel();
    renderHerald(initialLevel);

    // Re-render with full role once Nehemiah auth resolves
    if (typeof Nehemiah !== 'undefined' && typeof Nehemiah.onAuthResolved === 'function') {
      Nehemiah.onAuthResolved(function (sess) {
        var LEVELS = { readonly: 0, volunteer: 1, care: 2, deacon: 2,
                       leader: 3, treasurer: 3, pastor: 4, admin: 5 };
        var level = (sess && sess.role) ? (LEVELS[sess.role] !== undefined ? LEVELS[sess.role] : 0) : -1;
        renderHerald(level);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
