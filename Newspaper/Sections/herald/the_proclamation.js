// the_proclamation.js — Section 1: The Herald
// Phase 3: broadsheet newspaper layout — card grid → story treatment
// Main col: Lead (today's scripture) · OYB Readings · Announcements · Prayer Spotlight
// Aside col: Nation of the Week · Heart Check · Bible Quiz
// Data: Firestore → localStorage → static Data/* fallbacks (unchanged from Phase 2)

(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('flock_herald_config') || '{}'); }
    catch (_) { return {}; }
  }

  function dayIndex() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000) - 1;
  }

  function weekIndex() { return Math.floor(dayIndex() / 7); }

  function idx(i, len) { return ((i % len) + len) % len; }

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _fmtDate(val) {
    if (!val) return '';
    try {
      const ts = val.toDate ? val.toDate() : (val.seconds ? new Date(val.seconds * 1000) : new Date(val));
      return ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) { return ''; }
  }

  // ── Drawer content registry ───────────────────────────────────────────────────
  const _drawers = {};

  // ── Story HTML builder ────────────────────────────────────────────────────────

  /**
   * Returns a <article class="story"> HTML string.
   * opts: { num, category, section, hed, deck, byline, bodyHtml, isLead, drawer }
   *   num:       kicker section number (omit for lead)
   *   category:  kicker category text (uppercase)
   *   section:   kicker section name (uppercase)
   *   hed:       headline text
   *   deck:      sub-headline text (optional)
   *   byline:    byline text (optional)
   *   bodyHtml:  already-escaped/formatted HTML for story body (optional)
   *   isLead:    boolean — applies story--lead + dropcap
   *   drawer:    key into _drawers registry — makes hed a button that opens drawer
   */
  function _story(opts) {
    const num    = opts.num != null ? `\u00a7\u00a0${opts.num}\u00a0\u00b7\u00a0\u00a0` : '';
    const kicker = `${num}${esc(opts.category || '')}${opts.section ? `\u00a0\u00b7\u00a0\u00a0${esc(opts.section)}` : ''}`;
    const ledCls = opts.isLead ? ' story--lead' : '';
    const bodyCls = opts.isLead ? ' story-body--lead story-dropcap' : '';
    const hedInner = opts.drawer
      ? `<button class="story-hed-btn" type="button" data-open-drawer="${esc(opts.drawer)}">${esc(opts.hed)}</button>`
      : `<span class="story-hed-btn" style="cursor:default;pointer-events:none">${esc(opts.hed)}</span>`;

    return `<article class="story${ledCls}">
      <p class="story-kicker">${kicker}</p>
      <h2 class="story-hed">${hedInner}</h2>
      ${opts.deck   ? `<p class="story-deck">${esc(opts.deck)}</p>` : ''}
      ${opts.byline ? `<p class="story-byline">${esc(opts.byline)}</p>` : ''}
      ${opts.bodyHtml ? `<div class="story-body${bodyCls}">${opts.bodyHtml}</div>` : ''}
      ${opts.drawer ? `<p class="story-readmore-strip" data-open-drawer="${esc(opts.drawer)}"><span>Read more</span><span class="story-readmore-strip__rule"></span><span>&#8594;</span></p>` : ''}
      <hr class="story-rule">
    </article>`;
  }

  // ── Main column panel builders (return HTML strings) ─────────────────────────

  /** Lead story: today's Psalm as front-page banner with scripture pull quote */
  async function buildLeadStory(cfg) {
    const now       = new Date();
    const dateStr   = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const shortDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    let churchName = 'The Flock';
    try {
      if (window.Nehemiah && typeof window.Nehemiah.getChurchName === 'function') {
        churchName = window.Nehemiah.getChurchName() || churchName;
      } else {
        churchName = localStorage.getItem('flock_church_name') || churchName;
      }
    } catch (_) {}

    let devTitle = '', devTheme = '', devReflection = '', devScripture = '', devQuestion = '', devPrayer = '';
    try {
      const { default: devotionals } = await import('../../Data/devotionals.js');
      if (Array.isArray(devotionals) && devotionals.length) {
        const override = cfg.devotionalIndex != null ? cfg.devotionalIndex : null;
        const entry = devotionals[idx(override != null ? override : dayIndex(), devotionals.length)];
        if (entry) {
          devTitle      = entry.title || '';
          devTheme      = entry.theme || '';
          devReflection = entry.reflection || '';
          devScripture  = entry.scripture || '';
          devQuestion   = entry.question || '';
          devPrayer     = entry.prayer || '';

          const _svgBook   = `<svg class="herald-devo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
          const _svgReflect= `<svg class="herald-devo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.8-3.5 6.1L15 17H9l-.5-1.9C6.4 13.8 5 11.6 5 9a7 7 0 0 1 7-7z"/></svg>`;
          const _svgPrayer = `<svg class="herald-devo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 3a3 3 0 0 0-3 3l-4 9-4-9a3 3 0 1 0-2.7 4.3L9 20h6l4.7-9.7A3 3 0 0 0 18 3z"/></svg>`;

          _drawers['front-page'] = `<div class="drawer-article">
            <p class="drawer-article__kicker">DAILY DEVOTIONAL \u00b7 ${esc(shortDate)}</p>
            ${devTheme ? `<p class="drawer-article__theme">${esc(devTheme)}</p>` : ''}
            <h2 class="drawer-article__hed">${esc(devTitle)}</h2>
            ${devScripture ? `<blockquote class="drawer-article__scripture">
              <span class="drawer-article__scripture-icon">${_svgBook}</span>
              <span>${esc(devScripture)}</span>
            </blockquote>` : ''}
            ${devReflection ? `<p class="drawer-article__body drawer-article__dropcap">${esc(devReflection)}</p>` : ''}
            ${devQuestion ? `<div class="drawer-article__question">
              ${_svgReflect}
              <em>${esc(devQuestion)}</em>
            </div>` : ''}
            ${devPrayer ? `<div class="drawer-article__prayer">
              <span class="drawer-article__prayer-label">${_svgPrayer} Prayer</span>
              <p>${esc(devPrayer)}</p>
            </div>` : ''}
          </div>`;
        }
      }
    } catch (_) {}

    const hed  = devTitle || `The Flock Herald \u2014 ${shortDate}`;

    const _svgBook   = `<svg class="herald-devo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
    const _svgReflect= `<svg class="herald-devo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.8-3.5 6.1L15 17H9l-.5-1.9C6.4 13.8 5 11.6 5 9a7 7 0 0 1 7-7z"/></svg>`;
    const _svgPrayer = `<svg class="herald-devo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 3a3 3 0 0 0-3 3l-4 9-4-9a3 3 0 1 0-2.7 4.3L9 20h6l4.7-9.7A3 3 0 0 0 18 3z"/></svg>`;

    const hedInner = _drawers['front-page']
      ? `<button class="story-hed-btn" type="button" data-open-drawer="front-page">${esc(hed)}</button>`
      : `<span class="story-hed-btn" style="cursor:default;pointer-events:none">${esc(hed)}</span>`;

    return `<article class="story story--lead">
      <p class="story-kicker">DAILY DEVOTIONAL \u00b7\u00a0${esc(dateStr.toUpperCase())}</p>
      <h2 class="story-hed">${hedInner}</h2>
      ${devTheme ? `<p class="story-deck">${esc(devTheme)}</p>` : ''}
      <p class="story-byline">${esc(churchName)} \u00b7 ${esc(shortDate)}</p>
      <div class="story-body story-body--lead">
        ${devScripture ? `<blockquote class="herald-devo-scripture">
          <span class="herald-devo-scripture__icon">${_svgBook}</span>
          <span>${esc(devScripture)}</span>
        </blockquote>` : ''}
        ${devReflection ? `<p class="herald-devo-reflection story-dropcap">${esc(devReflection)}</p>` : '<p>Today the flock gathers around the living Word.</p>'}
        ${devQuestion ? `<div class="herald-devo-question">
          ${_svgReflect}
          <em>${esc(devQuestion)}</em>
        </div>` : ''}
        ${devPrayer ? `<div class="herald-devo-prayer">
          <span class="herald-devo-prayer__label">${_svgPrayer} Prayer</span>
          <p>${esc(devPrayer)}</p>
        </div>` : ''}
      </div>
      <hr class="story-rule">
    </article>`;
  }

  /** § 1 — Today's Readings (One Year Bible) */
  async function buildOYBStory(cfg) {
    // Bible.com ESV (version 59) URL for a chapter reference.
    // Handles ranges like "2 Chronicles 3–4" → links to 2CH.3.1.ESV
    const _BC = {
      'genesis':'GEN','exodus':'EXO','leviticus':'LEV','numbers':'NUM','deuteronomy':'DEU',
      'joshua':'JOS','judges':'JDG','ruth':'RUT',
      '1 samuel':'1SA','2 samuel':'2SA','1 kings':'1KI','2 kings':'2KI',
      '1 chronicles':'1CH','2 chronicles':'2CH','ezra':'EZR','nehemiah':'NEH','esther':'EST',
      'job':'JOB','psalm':'PSA','psalms':'PSA','proverbs':'PRO','ecclesiastes':'ECC',
      'song of solomon':'SNG','song of songs':'SNG','isaiah':'ISA','jeremiah':'JER',
      'lamentations':'LAM','ezekiel':'EZK','daniel':'DAN','hosea':'HOS','joel':'JOL',
      'amos':'AMO','obadiah':'OBA','jonah':'JON','micah':'MIC','nahum':'NAM',
      'habakkuk':'HAB','zephaniah':'ZEP','haggai':'HAG','zechariah':'ZEC','malachi':'MAL',
      'matthew':'MAT','mark':'MRK','luke':'LUK','john':'JHN','acts':'ACT','romans':'ROM',
      '1 corinthians':'1CO','2 corinthians':'2CO','galatians':'GAL','ephesians':'EPH',
      'philippians':'PHP','colossians':'COL','1 thessalonians':'1TH','2 thessalonians':'2TH',
      '1 timothy':'1TI','2 timothy':'2TI','titus':'TIT','philemon':'PHM','hebrews':'HEB',
      'james':'JAS','1 peter':'1PE','2 peter':'2PE','1 john':'1JN','2 john':'2JN',
      '3 john':'3JN','jude':'JUD','revelation':'REV',
    };
    function _oybUrl(ref) {
      // Normalize dashes and lowercase
      const s = ref.toLowerCase().replace(/[\u2013\u2014\-]/g, '-').trim();
      // Match: optional number prefix + book words + chapter (take first chapter of range)
      const m = s.match(/^((?:[1-3]\s+)?)([a-z]+(?:\s+[a-z]+)*)\s+(\d+)/);
      if (!m) return null;
      const bookKey = ((m[1] || '').trim() + ' ' + m[2].trim()).replace(/^\s/, '').trim();
      const chapter = m[3];
      const code = _BC[bookKey] || _BC[m[2].trim()];
      if (!code) return null;
      return `https://www.bible.com/bible/59/${code}.${chapter}.1.ESV`;
    }
    const _ICONS = {
      ot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      nt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"/><line x1="5" y1="9" x2="19" y2="9"/></svg>`,
      ps: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
      pr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.8-3.5 6.1L15 17H9l-.5-1.9C6.4 13.8 5 11.6 5 9a7 7 0 0 1 7-7z"/></svg>`,
    };
    let entry = null;
    try {
      const { default: oyb } = await import('../../Data/one_year_bible.js');
      if (Array.isArray(oyb) && oyb.length) {
        const override = cfg.devotionalIndex != null ? cfg.devotionalIndex : null;
        entry = oyb[idx(override != null ? override : dayIndex(), oyb.length)];
      }
    } catch (_) {}

    if (!entry) {
      return _story({ num: 1, category: 'DAILY READINGS', section: 'ONE YEAR BIBLE', hed: "Today's Readings", deck: 'Reading plan unavailable — check back shortly.', byline: 'ONE YEAR BIBLE PLAN' });
    }

    function _oybRow(label, ref, iconKey) {
      const url = _oybUrl(ref);
      const tag = url ? 'a' : 'div';
      const attrs = url ? ` href="${url}" target="_blank" rel="noopener noreferrer"` : '';
      return `<${tag} class="oyb-row"${attrs}>
        <span class="oyb-icon">${_ICONS[iconKey]}</span>
        <dt class="oyb-label">${label}</dt>
        <dd class="oyb-passage">${esc(ref)}</dd>
        ${url ? '<span class="oyb-arrow">↗</span>' : ''}
      </${tag}>`;
    }

    const rows = [
      entry.ot ? _oybRow('Old Testament', entry.ot, 'ot') : '',
      entry.nt ? _oybRow('New Testament', entry.nt, 'nt') : '',
      entry.ps ? _oybRow('Psalm',         entry.ps, 'ps') : '',
      entry.pr ? _oybRow('Proverbs',      entry.pr, 'pr') : '',
    ].filter(Boolean).join('');

    _drawers['oyb'] = `<div class="drawer-article">
      <div class="dwr-head">
        <div class="dwr-chip" style="--chip:#2B4C8C">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        <div class="dwr-head__meta">
          <p class="drawer-article__kicker">§\u00a01 · ONE YEAR BIBLE</p>
          <h2 class="drawer-article__hed">Today\u2019s Readings</h2>
        </div>
      </div>
      <dl class="oyb-list">${rows}</dl>
    </div>`;

    const SPURGEON_QUOTES = [
      '\u201cA Bible that\u2019s falling apart usually belongs to someone who isn\u2019t.\u201d',
      '\u201cVisit many good books, but live in the Bible.\u201d',
      '\u201cNo man can do me a truer kindness in this world than to pray for me.\u201d',
      '\u201cThe Word of God is like a lion. You don\u2019t have to defend a lion. All you have to do is let the lion loose.\u201d',
      '\u201cIt is not how much we have, but how much we enjoy, that makes happiness.\u201d',
      '\u201cRead the Bible to be wise, believe it to be safe, practice it to be holy.\u201d',
      '\u201cThe more you read the Bible, and the more you meditate on it, the more you will be astonished with it.\u201d',
    ];
    const spurgeon = SPURGEON_QUOTES[dayIndex() % SPURGEON_QUOTES.length];

    return _story({
      num:      1,
      category: 'DAILY READINGS',
      section:  'ONE YEAR BIBLE',
      hed:      "Today\u2019s Readings",
      deck:     spurgeon,
      byline:   '\u2014 Charles Spurgeon',
      bodyHtml: `<dl class="oyb-list">${rows}</dl>`,
      drawer:   'oyb',
    });
  }

  /** § 2 — Bible Book Overview */
  async function buildBibleBookStory(cfg) {
    let book = null;
    try {
      const { default: books } = await import('../../Data/books-of-the-bible.js');
      if (Array.isArray(books) && books.length) {
        const override = cfg.bibleBookIndex != null ? cfg.bibleBookIndex : null;
        book = books[idx(override != null ? override : dayIndex(), books.length)];
      }
    } catch (_) {}

    if (!book) {
      return _story({ num: 2, category: 'THE WORD', section: 'BIBLE OVERVIEW', hed: 'Bible Book Overview', deck: 'Book data unavailable today.' });
    }

    const isNT      = book.testament === 'New';
    const accentHex = isNT ? '#2563eb' : '#b45309';
    const tintHex   = isNT ? '#eff6ff' : '#fefce8';

    // Build drawer content
    const _svgBook  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.1rem;height:1.1rem"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
    const _svgCross = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="width:1.1rem;height:1.1rem"><line x1="12" y1="3" x2="12" y2="21"/><line x1="5" y1="9" x2="19" y2="9"/></svg>`;
    const _svgStar  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.1rem;height:1.1rem"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    function _bibSect(label, icon, content) {
      return `<div class="bib-drawer__sect">
        <span class="bib-drawer__sect-label" style="color:${accentHex}">${icon} ${label}</span>
        <p class="bib-drawer__text">${content}</p>
      </div>`;
    }

    _drawers['bible-book'] = `<div class="bib-drawer">
      <div class="bib-drawer__banner" style="background:${accentHex}">
        <div class="bib-drawer__banner-inner">
          <span class="bib-drawer__testament-badge">${esc((book.testament || '') + ' Testament')}</span>
          <h2 class="bib-drawer__title">${esc(book.bookName || '')}</h2>
          <span class="bib-drawer__meta">${esc(book.genre || '')}${book.author ? ' · ' + esc(book.author) : ''}${book.timePeriod ? ' · ' + esc(book.timePeriod) : ''}</span>
        </div>
      </div>
      <div class="bib-drawer__body">
        ${book.summary   ? _bibSect('Overview',            _svgBook,  esc(book.summary))   : ''}
        ${book.keyVerse  ? `<blockquote class="bib-drawer__key-verse" style="--bib-accent:${accentHex}">${esc(book.keyVerse)}</blockquote>` : ''}
        ${book.themes    ? _bibSect('Key Themes',          _svgStar,  esc(book.themes))    : ''}
        ${book.christInBook ? _bibSect('Christ in This Book', _svgCross, esc(book.christInBook)) : ''}
        ${book.application  ? _bibSect('Application',         _svgBook,  esc(book.application))  : ''}
      </div>
    </div>`;

    // Inline card body: full overview — all sections
    function _bibCardSect(label, icon, content) {
      return `<div class="bib-card__sect">
        <span class="bib-card__sect-label" style="color:${accentHex}">${icon} ${label}</span>
        <p class="bib-card__text">${content}</p>
      </div>`;
    }

    const bodyHtml = `
      ${book.summary ? `<p class="bib-card__summary">${esc(book.summary)}</p>` : ''}
      ${book.keyVerse ? `<blockquote class="bib-card__verse" style="--bib-accent:${accentHex};--bib-tint:${tintHex}">${esc(book.keyVerse)}</blockquote>` : ''}
      ${book.themes ? _bibCardSect('Key Themes', _svgStar, esc(book.themes)) : ''}
      ${book.christInBook ? _bibCardSect('Christ in This Book', _svgCross, esc(book.christInBook)) : ''}
      ${book.application ? _bibCardSect('Application', _svgBook, esc(book.application)) : ''}
    `;
    const metaLine  = [book.genre, book.author, book.timePeriod].filter(Boolean).map(esc).join(' · ');

    return _story({
      num:      2,
      category: 'THE WORD',
      section:  (book.testament || '').toUpperCase() + ' TESTAMENT · BIBLE OVERVIEW',
      hed:      book.bookName || 'Bible Book',
      deck:     '',
      byline:   metaLine,
      bodyHtml,
      drawer:   'bible-book',
    });
  }

  /** § 3 — Announcements */
  async function buildAnnouncementsStory(cfg) {
    let items = [];
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.listFlockNews === 'function' && UR.isReady && UR.isReady()) {
        const res = await UR.listFlockNews({ limit: 5, published: true });
        if (Array.isArray(res)) items = res;
        else if (res && Array.isArray(res.data)) items = res.data;
      }
    } catch (_) {}

    if (!items.length) {
      try {
        const cached = JSON.parse(localStorage.getItem('flock_news_cache') || '[]');
        if (Array.isArray(cached) && cached.length) items = cached.slice(0, 5);
      } catch (_) {}
    }

    if (!items.length || cfg.showAnnouncements === false) {
      return _story({
        num:      3,
        category: 'FROM THE CHURCH',
        section:  'ANNOUNCEMENTS',
        hed:      'From the Flock',
        deck:     cfg.showAnnouncements === false
          ? 'Announcements are paused — check back soon.'
          : 'No announcements — the flock is at peace.',
        byline:   'CHURCH OFFICE',
      });
    }

    const first = items[0];
    const hed   = first.title || first.subject || first.headline || 'Announcement';
    const body  = first.body  || first.content || first.message  || '';
    const rest  = items.slice(1);

    const restHtml = rest.length
      ? `<ul class="announcement-list" style="margin-top:0.75rem">${rest.map(item =>
          `<li class="announcement-item">
            <p class="announcement-title">${esc(item.title || item.subject || 'Announcement')}</p>
            ${item.body ? `<p class="announcement-body">${esc(item.body.slice(0, 120))}${item.body.length > 120 ? '…' : ''}</p>` : ''}
           </li>`).join('')}</ul>`
      : '';

    _drawers['announcements'] = `<div class="drawer-article">
      <div class="dwr-head">
        <div class="dwr-chip" style="--chip:#5B3B8C">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 11l19-9-9 19-2-8-8-2z"/>
          </svg>
        </div>
        <div class="dwr-head__meta">
          <p class="drawer-article__kicker">§\u00a03 · FROM THE CHURCH</p>
          <h2 class="drawer-article__hed">Announcements</h2>
        </div>
      </div>
      <ul class="announcement-list">${items.map(item =>
        `<li class="announcement-item">
          <p class="announcement-title">${esc(item.title || item.subject || 'Announcement')}</p>
          ${item.body ? `<p class="announcement-body">${esc(item.body)}</p>` : ''}
          ${item.date ? `<p class="announcement-date">${esc(item.date)}</p>` : ''}
         </li>`).join('')}</ul>
    </div>`;

    return _story({
      num:      3,
      category: 'FROM THE CHURCH',
      section:  'ANNOUNCEMENTS',
      hed,
      deck:     body ? body.slice(0, 120) + (body.length > 120 ? '…' : '') : '',
      byline:   `CHURCH OFFICE${first.date ? ' · ' + esc(first.date) : ''}`,
      bodyHtml: restHtml,
      drawer:   'announcements',
    });
  }

  /** § 3 — Prayer Spotlight */
  async function buildPrayerStory() {
    let prayer = null;
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.listPrayers === 'function') {
        const res = await UR.listPrayers({ limit: 20, allUsers: true });
        const list = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
        const eligible = list.filter(p => !p.answeredAt && !p.archived);
        if (eligible.length) prayer = eligible[idx(dayIndex(), eligible.length)];
      }
    } catch (_) {}

    if (!prayer) {
      return _story({ num: 4, category: 'THE PRAYER WALL', section: 'SPOTLIGHT', hed: 'Prayer Spotlight', deck: 'No prayer requests yet — the flock is at peace.', byline: 'PRAYER WALL' });
    }

    const name    = prayer.displayName || prayer.name || prayer.memberName || 'Anonymous';
    const text    = prayer.request || prayer.body || prayer.content || '';
    const dateStr = prayer.createdAt ? _fmtDate(prayer.createdAt) : '';

    _drawers['prayer'] = `<div class="drawer-article">
      <div class="dwr-head">
        <div class="dwr-chip" style="--chip:#16a34a">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 3a3 3 0 0 0-3 3l-4 9-4-9a3 3 0 1 0-2.7 4.3L9 20h6l4.7-9.7A3 3 0 0 0 18 3z"/>
          </svg>
        </div>
        <div class="dwr-head__meta">
          <p class="drawer-article__kicker">§\u00a04 · PRAYER WALL · SPOTLIGHT</p>
          <h2 class="drawer-article__hed">${esc(name)}</h2>
          ${dateStr ? `<p class="drawer-article__theme">Submitted ${esc(dateStr)}</p>` : ''}
        </div>
      </div>
      ${text ? `<blockquote class="drawer-article__scripture">
        <span class="drawer-article__scripture-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.1rem;height:1.1rem"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </span>
        <span>\u201c${esc(text)}\u201d</span>
      </blockquote>` : ''}
      <button class="prayer-pray-btn btn btn--ghost" type="button" id="drawer-pray-btn">\u{1F64F} Pray for this</button>
    </div>`;

    const deckText = text ? `"${text.slice(0, 100)}${text.length > 100 ? '…' : ''}"` : 'A request from your church family.';

    return _story({
      num:      4,
      category: 'THE PRAYER WALL',
      section:  'SPOTLIGHT',
      hed:      name,
      deck:     deckText,
      byline:   `PRAYER SPOTLIGHT${dateStr ? ' · ' + dateStr : ''}`,
      drawer:   'prayer',
    });
  }

  // ── Aside column panel builders ───────────────────────────────────────────────

  // ── Joshua Project API helpers ──────────────────────────────────────────────
  const _JP_API_BASE = 'https://api.joshuaproject.net/v1';

  async function _getJpApiKey() {
    // 1. Cached in localStorage
    const cached = localStorage.getItem('flock_jp_api_key');
    if (cached) return cached;
    // 2. Read from flockos-notify root appConfig — baked into the platform
    try {
      const fb = window.firebase;
      if (!fb) return null;
      const fbCfg = {
        apiKey:    'AIzaSyBA-fkxjABbwIHn0i6MPiXbGwahfJmuJeo',
        authDomain:'flockos-notify.firebaseapp.com',
        projectId: 'flockos-notify',
      };
      const appName = 'herald-missions';
      const app = fb.apps.find(function(a) { return a.name === appName; })
                  || fb.initializeApp(fbCfg, appName);
      const db  = app.firestore();
      const doc = await db.collection('appConfig').doc('jp_api_key').get();
      if (doc.exists && doc.data().value) {
        const key = doc.data().value;
        localStorage.setItem('flock_jp_api_key', key);
        return key;
      }
    } catch (_) {}
    return null;
  }

  async function _fetchJpGroups(isoCode, apiKey) {
    try {
      const fields = 'PeopNameInCountry,Population,PercentEvangelical,PrimaryReligion,JPScaleText,Ctry';
      const url = `${_JP_API_BASE}/people_groups.json`
        + `?api_key=${encodeURIComponent(apiKey)}`
        + `&countries=${encodeURIComponent(isoCode)}`
        + `&is_frontier=1&limit=5&fields=${fields}`;
      const res = await Promise.race([
        fetch(url),
        new Promise(function(_, rej) { setTimeout(function() { rej(new Error('timeout')); }, 5000); })
      ]);
      if (!res.ok) return [];
      return await res.json();
    } catch (_) { return []; }
  }

  function _fmtPop(n) {
    if (!n) return '';
    return n >= 1e9 ? (n / 1e9).toFixed(1) + 'B'
         : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
         : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K'
         : String(n);
  }

  function _relLabel(key) {
    const map = { islam:'Islam', christianity:'Christianity', hinduism:'Hinduism',
      buddhism:'Buddhism', nonReligious:'Non-Religious', ethnic:'Ethnic Religions',
      other:'Other', unknown:'Unknown' };
    return map[key] || (key.charAt(0).toUpperCase() + key.slice(1));
  }

  // ── Dossier section SVG icons ────────────────────────────────────────────
  // ── Counseling color map (Tailwind names → accessible hex) ────────────────
  const _COUNSEL_COLORS = {
    slate:'#475569', gray:'#4b5563', zinc:'#52525b', stone:'#57534e',
    red:'#dc2626', orange:'#ea580c', amber:'#b45309', yellow:'#a16207',
    lime:'#4d7c0f', green:'#16a34a', emerald:'#059669', teal:'#0f766e',
    cyan:'#0e7490', sky:'#0369a1', blue:'#2563eb', indigo:'#4f46e5',
    violet:'#7c3aed', purple:'#9333ea', fuchsia:'#c026d3', pink:'#db2777',
    rose:'#e11d48', aqua:'#0e7490', gold:'#b45309', silver:'#6b7280',
  };
  function _counselColor(c) {
    if (!c) return '#16a34a';
    const s = String(c).trim();
    if (/^(#|rgb|hsl|var\()/i.test(s)) return s;
    return _COUNSEL_COLORS[s.toLowerCase()] || '#16a34a';
  }
  // Lighten a hex color for tinted card backgrounds (mix toward white)
  function _tintHex(hex, amount) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const tr = Math.round(r + (255-r)*amount), tg = Math.round(g + (255-g)*amount), tb = Math.round(b + (255-b)*amount);
    return '#' + [tr,tg,tb].map(v => v.toString(16).padStart(2,'0')).join('');
  }

  /** § 4 — Counseling Corner */
  async function buildCounselingCorner(cfg) {
    let topics = [];
    try {
      const { default: data } = await import('../../Data/counseling.js');
      if (Array.isArray(data) && data.length) {
        const override = cfg.counselingIndex != null ? cfg.counselingIndex : null;
        const base = override != null ? override : dayIndex();
        // Pick 2 topics spaced apart through the dataset
        const a = data[idx(base, data.length)];
        const b = data[idx(base + Math.ceil(data.length / 2), data.length)];
        topics = [a, b].filter(Boolean);
      }
    } catch (_) {}

    if (!topics.length) {
      return `<div class="section-rule"><span class="section-label">§\u00a04 · COUNSELING CORNER</span></div>
        <p class="story-body" style="color:var(--ink-muted)">Biblical counsel is unavailable — trust God today.</p>
        <hr class="story-rule">`;
    }

    function _counselDrawerKey(t) { return 'counsel-' + (t.topicId || t._id || t.title || ''); }

    function _counselDrawerHtml(t) {
      const color = _counselColor(t.color);
      const tint  = _tintHex(color.startsWith('#') ? color : '#16a34a', 0.92);
      // Parse scriptures: "Ref: text. Ref2: text2." split on ". " boundaries
      const scriptureLines = t.scriptures
        ? t.scriptures.split(/(?<=\.)\s+(?=[A-Z1-9])/).filter(Boolean)
        : [];
      return `<div class="counsel-drawer">
        <div class="counsel-drawer__banner" style="background:${color}">
          <span class="counsel-drawer__icon" aria-hidden="true">${t.icon || '💬'}</span>
          <span class="counsel-drawer__topic-label">COUNSELING CORNER</span>
        </div>
        <div class="counsel-drawer__body">
          <h2 class="counsel-drawer__title">${esc(t.title || '')}</h2>
          ${t.definition ? `<p class="counsel-drawer__def">${esc(t.definition)}</p>` : ''}
          ${t.steps ? `<div class="counsel-drawer__sect">
            <span class="counsel-drawer__sect-label" style="color:${color}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.8-3.5 6.1L15 17H9l-.5-1.9C6.4 13.8 5 11.6 5 9a7 7 0 0 1 7-7z"/></svg>
              Faith Response
            </span>
            <p class="counsel-drawer__steps">${esc(t.steps)}</p>
          </div>` : ''}
          ${scriptureLines.length ? `<div class="counsel-drawer__sect">
            <span class="counsel-drawer__sect-label" style="color:${color}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Scripture Foundation
            </span>
            ${scriptureLines.map(s => `<p class="counsel-drawer__scripture">${esc(s)}</p>`).join('')}
          </div>` : ''}
        </div>
      </div>`;
    }

    const cards = topics.map((t, i) => {
      const color = _counselColor(t.color);
      const tint  = color.startsWith('#') ? _tintHex(color, 0.91) : '#f8f8f0';
      const key   = _counselDrawerKey(t);
      _drawers[key] = _counselDrawerHtml(t);
      const defSnippet = t.definition ? t.definition.slice(0, 90) + (t.definition.length > 90 ? '…' : '') : '';
      return `<div class="counsel-corner-card" style="--cc-color:${color};--cc-tint:${tint}" data-open-drawer="${esc(key)}">
        <div class="counsel-corner-card__stripe"></div>
        <div class="counsel-corner-card__inner">
          <div class="counsel-corner-card__head">
            <span class="counsel-corner-card__icon" aria-hidden="true">${t.icon || '💬'}</span>
            <span class="counsel-corner-card__title">${esc(t.title || '')}</span>
          </div>
          ${defSnippet ? `<p class="counsel-corner-card__def">${esc(defSnippet)}</p>` : ''}
          <span class="counsel-corner-card__cta">Read counsel &#8594;</span>
        </div>
      </div>`;
    }).join('');

    return `<div class="section-rule section-rule--counsel"><span class="section-label">§\u00a04 · COUNSELING CORNER</span></div>
      <div class="counsel-corner-grid">${cards}</div>
      <hr class="story-rule">`;
  }

  const _SVG_SHIELD  = '<svg class="nation-section__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  const _SVG_BOOK    = '<svg class="nation-section__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
  const _SVG_GLOBE   = '<svg class="nation-section__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  const _SVG_COMPASS = '<svg class="nation-section__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
  const _SVG_CROSS   = '<svg class="nation-section__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="2" x2="12" y2="22"/><line x1="5" y1="9" x2="19" y2="9"/></svg>';

  /** § 5 — Nation of the Day */
  async function buildNationAside(cfg) {
    let nation = null;
    try {
      const { default: missions } = await import('../../Data/missions.js');
      if (Array.isArray(missions) && missions.length) {
        const override = cfg.nationIndex != null ? cfg.nationIndex : null;
        nation = missions[idx(override != null ? override : dayIndex(), missions.length)];
      }
    } catch (_) {}

    if (!nation) {
      return `<div class="section-rule"><span class="section-label">§\u00a05 · MISSIONS</span></div>
        <p class="story-kicker">NATION OF THE DAY</p>
        <p class="story-body" style="color:var(--ink-muted)">Missions data unavailable — pray for all nations.</p>
        <hr class="story-rule">`;
    }

    // ── Format core fields ──────────────────────────────────────────────────
    const popRaw      = nation.population || nation.jpPopulation || 0;
    const popFmt      = _fmtPop(popRaw);
    const jpPopRaw    = nation.jpPopulation != null && nation.jpPopulation !== nation.population ? nation.jpPopulation : 0;
    const jpPopFmt    = jpPopRaw ? _fmtPop(jpPopRaw) : '';
    const popUnrRaw   = nation.populationUnreached || 0;
    const popUnrFmt   = _fmtPop(popUnrRaw);
    // Field aliases: some countries use percentChristian, others use christianPercent
    const xChrist     = nation.percentChristian   != null ? nation.percentChristian   : nation.christianPercent;
    const xEval       = nation.percentEvangelical != null ? nation.percentEvangelical : nation.evangelicalPercent;
    const christPct   = xChrist != null ? (+xChrist).toFixed(1) + '%' : '';
    const evalPct     = xEval   != null ? (+xEval).toFixed(1)   + '%' : '';
    const unreached   = nation.unreachedGroups   != null ? nation.unreachedGroups   : null;
    const totalGroups = nation.totalPeopleGroups != null ? nation.totalPeopleGroups : null;
    const nameRaw     = nation.countryName || nation.name || 'Unknown Nation';
    const nationName  = (nation.icon ? nation.icon + '\u00a0' : '') + nameRaw;
    const isoCode     = nation.isoCode || '';
    const capital     = nation.capital || '';
    const region      = nation.region  || '';
    const continent   = nation.continent || '';
    const in1040      = !!nation.tenFortyWindow;
    const domRel      = nation.dominantReligion || '';
    const gospelAccess= nation.gospelAccess || '';
    const perLabel    = nation.persecutionLabel || nation.persecutionLevel || '';
    const perTier     = nation.persecutionTier  || nation.persecutionLevel || '';
    const perRank     = nation.persecutionRank  != null ? nation.persecutionRank  : null;
    const wwlRank     = nation.worldWatchListRank != null ? nation.worldWatchListRank : null;
    const balRank     = nation.restrictionsRank   != null ? nation.restrictionsRank   : null;
    const balSource   = nation.restrictionsSource || '';
    const bsRank      = nation.bibleShortageRank  != null ? nation.bibleShortageRank  : null;
    const shortageTier= nation.bibleShortageTier  || '';
    const shortageRange= nation.bibleShortageRange || '';
    const shortageNeed = nation.bibleShortageNeed || '';
    const shortageSource = nation.bibleShortageSource || '';
    const profileUrl  = nation.jpProfileUrl || nation.profileUrl || '';
    const jpUpdatedAt = nation.jpUpdatedAt || '';

    const summaryFull = nation.owSummary || '';
    const summaryCard = summaryFull ? summaryFull.slice(0, 200) + (summaryFull.length > 200 ? '\u2026' : '') : '';
    const owSource    = nation.owSource || '';
    const challenges  = Array.isArray(nation.owPrayerChallenges) ? nation.owPrayerChallenges : [];
    const answers     = Array.isArray(nation.owPrayerAnswers)    ? nation.owPrayerAnswers    : [];

    // ── Religion breakdown bars — synthesize full breakdown incl. Christianity ─
    let relBarsHtml = '';
    {
      const breakdown = Object.assign({}, nation.religionBreakdown || {});
      // religionBreakdown never includes Christianity — inject it from percent field
      if (!('christianity' in breakdown) && xChrist != null && +xChrist > 0) {
        breakdown.christianity = +xChrist;
      }
      const entries = Object.entries(breakdown)
        .filter(function(e) { return +e[1] >= 0.1; })
        .sort(function(a, b) { return b[1] - a[1]; });
      if (entries.length) {
        relBarsHtml = '<div class="nation-rel-list">'
          + entries.map(function(e) {
              const pct = Math.min(+e[1], 100).toFixed(1);
              return `<div class="nation-rel-row">
                <span class="nation-rel-name">${esc(_relLabel(e[0]))}</span>
                <div class="nation-rel-track"><div class="nation-rel-fill" style="width:${Math.min(+e[1],100)}%"></div></div>
                <span class="nation-rel-pct">${pct}%</span>
              </div>`;
            }).join('')
          + '</div>';
      }
    }

    // ── JP API — fetch frontier groups ──────────────────────────────────────
    let jpGroupsHtml = '';
    if (isoCode) {
      const jpKey = await _getJpApiKey();
      if (jpKey) {
        const groups = await _fetchJpGroups(isoCode, jpKey);
        if (groups.length) {
          jpGroupsHtml = groups.map(function(g) {
            const gName = g.PeopNameInCountry || g.PeopName || '';
            const gPop  = _fmtPop(g.Population);
            const gRel  = g.PrimaryReligion || '';
            const gEval = g.PercentEvangelical != null ? (+g.PercentEvangelical).toFixed(2) + '% evangelical' : '';
            const gScale= g.JPScaleText || '';
            return `<div class="nation-jp-group">
              <span class="nation-jp-group__name">${esc(gName)}</span>
              <span class="nation-jp-group__meta">${[gPop, gRel, gEval].filter(Boolean).join(' · ')}</span>
              ${gScale ? `<span class="nation-jp-group__scale">${esc(gScale)}</span>` : ''}
            </div>`;
          }).join('');
        }
      }
    }

    // ── Build drawer dossier HTML ───────────────────────────────────────────
    const persecutionColor = perTier === 'Extreme' ? 'var(--error,#b00020)'
      : perTier === 'Very High' ? '#c0580a'
      : 'var(--ink-muted)';

    // Build location line: capital · region / continent
    const locationParts = [capital, region, (continent && continent !== region) ? continent : ''].filter(Boolean);

    _drawers['nation'] = `<div class="drawer-article"><div class="nation-dossier">
      <div class="dwr-head">
        <div class="dwr-chip" style="--chip:#8B7028">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        <div class="dwr-head__meta">
          <p class="drawer-article__kicker">§\u00a05 · NATION OF THE DAY · MISSIONS</p>
        <h2 class="drawer-article__hed">${esc(nationName)}</h2>
        ${locationParts.length ? `<p class="nation-dossier__meta">${locationParts.map(esc).join(' · ')}</p>` : ''}
        <div class="nation-dossier__badges">
          ${in1040 ? `<span class="nation-badge nation-badge--1040">10/40 Window</span>` : ''}
          ${perLabel ? `<span class="nation-badge nation-badge--persecution" style="--per-color:${persecutionColor}">\u26a0 ${esc(perLabel)}</span>` : ''}
        </div>
      </div>
      </div>

      <div class="nation-stats-grid">
        ${popFmt      ? `<div class="nation-stat"><span class="nation-stat__val">${esc(popFmt)}</span><span class="nation-stat__label">Population</span></div>` : ''}
        ${jpPopFmt    ? `<div class="nation-stat"><span class="nation-stat__val">${esc(jpPopFmt)}</span><span class="nation-stat__label">JP Population</span></div>` : ''}
        ${popUnrFmt   ? `<div class="nation-stat"><span class="nation-stat__val">${esc(popUnrFmt)}</span><span class="nation-stat__label">Unreached Pop.</span></div>` : ''}
        ${christPct   ? `<div class="nation-stat"><span class="nation-stat__val">${esc(christPct)}</span><span class="nation-stat__label">Christian</span></div>` : ''}
        ${evalPct     ? `<div class="nation-stat"><span class="nation-stat__val">${esc(evalPct)}</span><span class="nation-stat__label">Evangelical</span></div>` : ''}
        ${unreached != null ? `<div class="nation-stat"><span class="nation-stat__val">${totalGroups != null ? esc(String(unreached)) + ' / ' + esc(String(totalGroups)) : esc(String(unreached))}</span><span class="nation-stat__label">Unreached Groups${totalGroups != null ? ' / Total' : ''}</span></div>` : ''}
        ${gospelAccess ? `<div class="nation-stat"><span class="nation-stat__val">${esc(gospelAccess)}</span><span class="nation-stat__label">Gospel Access</span></div>` : ''}
      </div>

      ${(wwlRank != null || perRank != null || perTier || perLabel) ? `<div class="nation-section">
        <p class="nation-section__head">${_SVG_SHIELD} World Watch</p>
        <div class="nation-access-grid">
          ${wwlRank != null ? `<div class="nation-access-item"><span class="nation-access-item__val">#${esc(String(wwlRank))}</span><span class="nation-access-item__label">World Watch Rank</span></div>` : ''}
          ${perRank != null && perRank !== wwlRank ? `<div class="nation-access-item"><span class="nation-access-item__val">#${esc(String(perRank))}</span><span class="nation-access-item__label">Persecution Rank</span></div>` : ''}
          ${perTier ? `<div class="nation-access-item"><span class="nation-access-item__val">${esc(perTier)}</span><span class="nation-access-item__label">Persecution Level</span></div>` : ''}
        </div>
        ${perLabel && perLabel !== perTier ? `<p class="nation-shortage-note">${esc(perLabel)}</p>` : ''}
      </div>` : ''}

      ${domRel ? `<p class="nation-dom-religion">Dominant religion: <strong>${esc(domRel)}</strong></p>` : ''}

      ${relBarsHtml ? `<div class="nation-section">
        <p class="nation-section__head">${_SVG_CROSS} Religion Breakdown</p>
        ${relBarsHtml}
      </div>` : ''}

      ${(balRank != null || bsRank != null || shortageTier || shortageRange || shortageNeed) ? `<div class="nation-section">
        <p class="nation-section__head">${_SVG_BOOK} Bible Access</p>
        <div class="nation-access-grid">
          ${balRank != null  ? `<div class="nation-access-item"><span class="nation-access-item__val">#${esc(String(balRank))}</span><span class="nation-access-item__label">BAL Restrictions Rank</span></div>` : ''}
          ${bsRank != null   ? `<div class="nation-access-item"><span class="nation-access-item__val">#${esc(String(bsRank))}</span><span class="nation-access-item__label">Shortage Rank</span></div>` : ''}
          ${shortageTier     ? `<div class="nation-access-item"><span class="nation-access-item__val">${esc(shortageTier)}</span><span class="nation-access-item__label">Shortage Tier</span></div>` : ''}
        </div>
        ${shortageRange ? `<p class="nation-shortage-note">${esc(shortageRange)}</p>` : ''}
        ${shortageNeed && shortageNeed !== shortageRange ? `<p class="nation-shortage-note">${esc(shortageNeed)}</p>` : ''}
        ${balSource || shortageSource ? `<p class="nation-data-source">${[balSource, shortageSource].filter(function(s,i,a){ return s && a.indexOf(s)===i; }).map(esc).join(' · ')}</p>` : ''}
      </div>` : ''}

      ${summaryFull ? `<div class="nation-section">
        <p class="nation-section__head">${_SVG_GLOBE} Operation World — Country Overview</p>
        <p class="nation-ow-body">${esc(summaryFull)}</p>
        ${challenges.length ? `<p class="nation-section__subhead">Prayer Challenges</p>
        <ol class="nation-challenge-list">
          ${challenges.map(function(c) { return `<li>${esc(c)}</li>`; }).join('')}
        </ol>` : ''}
        ${answers.length ? `<p class="nation-section__subhead">Prayer Answers</p>
        <ol class="nation-challenge-list nation-prayer-answers">
          ${answers.map(function(a) { return `<li>${esc(a)}</li>`; }).join('')}
        </ol>` : ''}
        ${owSource ? `<p class="nation-data-source">${esc(owSource)}</p>` : ''}
      </div>` : ''}

      ${jpGroupsHtml ? `<div class="nation-section nation-jp-section">
        <p class="nation-section__head">${_SVG_COMPASS} Joshua Project · Frontier Groups</p>
        ${jpGroupsHtml}
      </div>` : ''}

      ${profileUrl ? `<a class="nation-jp-link" href="${esc(profileUrl)}" target="_blank" rel="noopener noreferrer">View on Joshua Project ↗</a>` : ''}
      ${jpUpdatedAt ? `<p class="nation-data-source" style="margin-top:0.75rem">JP data: ${esc(jpUpdatedAt)}</p>` : ''}
    </div></div>`;

    // ── Build aside card HTML ───────────────────────────────────────────────
    const cardStats = [
      popFmt     ? popFmt + ' people'   : '',
      christPct  ? christPct + ' Christian' : '',
      evalPct    ? evalPct  + ' Evangelical' : '',
    ].filter(Boolean).join(' · ');

    const unreachedLine = unreached != null
      ? `<p class="story-body" style="font-size:0.8125rem;color:var(--ink-muted);margin:0.25rem 0">${totalGroups != null ? unreached + ' of ' + totalGroups + ' groups unreached' : unreached + ' unreached people groups'}</p>` : '';

    return `<div class="section-rule"><span class="section-label">§\u00a05 · MISSIONS</span></div>
      <article class="story">
        <p class="story-kicker">NATION OF THE DAY</p>
        <h2 class="story-hed"><button class="story-hed-btn" type="button" data-open-drawer="nation" style="font-size:1.0625rem">${esc(nationName)}</button></h2>
        ${locationParts.length ? `<p class="story-byline">${locationParts.map(esc).join(' · ')}</p>` : ''}
        ${cardStats ? `<p class="story-body" style="font-size:0.8125rem;color:var(--ink-muted);margin:0.25rem 0 0">${esc(cardStats)}</p>` : ''}
        ${unreachedLine}
        ${summaryCard ? `<p class="story-body">${esc(summaryCard)}</p>` : ''}
        ${perLabel ? `<p class="nation-persecution">⚠ ${esc(perLabel)}</p>` : ''}
        <p class="story-readmore-strip" data-open-drawer="nation"><span>Read more</span><span class="story-readmore-strip__rule"></span><span>&#8594;</span></p>
        <hr class="story-rule">
      </article>`;
  }

  /** § 6 — Heart Check */
  async function buildHeartAside(cfg) {
    let question = null;
    try {
      const { default: heartData } = await import('../../Data/heart.js');
      if (Array.isArray(heartData) && heartData.length) {
        const override = cfg.heartIndex != null ? cfg.heartIndex : null;
        question = heartData[idx(override != null ? override : dayIndex(), heartData.length)];
      }
    } catch (_) {}

    if (!question) {
      return `<div class="section-rule"><span class="section-label">§\u00a06 · HEART CHECK</span></div>
        <p class="story-body" style="font-style:italic;color:var(--ink-muted)">"Search me, O God, and know my heart." — Psalm 139:23</p>
        <hr class="story-rule">`;
    }

    const qText    = question['Question']       || question.question       || '';
    const category = question['Category']       || question.category       || '';
    const verse    = question['Verse Reference'] || question.verseReference || '';
    const rx       = question['Prescription']    || question.prescription   || '';

    _drawers['heart'] = `<div class="drawer-article">
      <div class="dwr-head">
        <div class="dwr-chip" style="--chip:#dc2626">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <div class="dwr-head__meta">
          <p class="drawer-article__kicker">§\u00a06 · HEART CHECK</p>
          ${category ? `<p class="drawer-article__theme">${esc(category)}</p>` : ''}
          <h2 class="drawer-article__hed">${esc(qText)}</h2>
        </div>
      </div>
      ${verse ? `<blockquote class="drawer-article__scripture">
        <span class="drawer-article__scripture-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.1rem;height:1.1rem"><line x1="12" y1="2" x2="12" y2="22"/><line x1="5" y1="9" x2="19" y2="9"/></svg>
        </span>
        <span>\u2014 ${esc(verse)}</span>
      </blockquote>` : ''}
      ${rx ? `<div class="drawer-article__prayer">
        <span class="drawer-article__prayer-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="herald-devo-icon"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          Prescription
        </span>
        <p>${esc(rx)}</p>
      </div>` : ''}
    </div>`;

    return `<div class="section-rule"><span class="section-label">§\u00a06 · HEART CHECK</span></div>
      <article class="story">
        <p class="story-kicker">${esc(category || 'DAILY SELF-INVENTORY')}</p>
        <h2 class="story-hed"><button class="story-hed-btn" type="button" data-open-drawer="heart" style="font-size:1rem">${esc(qText)}</button></h2>
        ${verse ? `<p class="story-byline">${esc(verse)}</p>` : ''}
        <p class="story-readmore-strip" data-open-drawer="heart"><span>Read more</span><span class="story-readmore-strip__rule"></span><span>&#8594;</span></p>
        <hr class="story-rule">
      </article>`;
  }

  /** § 7 — Bible Quiz (interactive inline — no drawer) */
  async function buildQuizAside(cfg) {
    let q = null;
    try {
      const { default: quizData } = await import('../../Data/quiz.js');
      if (Array.isArray(quizData) && quizData.length) {
        const override = cfg.quizIndex != null ? cfg.quizIndex : null;
        q = quizData[idx(override != null ? override : dayIndex(), quizData.length)];
      }
    } catch (_) {}

    if (!q) {
      return `<div class="section-rule"><span class="section-label">§\u00a07 · BIBLE QUIZ</span></div>
        <p class="story-body" style="color:var(--ink-muted)">No quiz available today — check back tomorrow.</p>`;
    }

    const opts    = ['A', 'B', 'C', 'D'];
    const correct = (q.correctAnswer || '').toLowerCase();
    const optKeys = { a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD };
    const optButtons = opts
      .filter(o => optKeys[o.toLowerCase()])
      .map(o => `<button class="quiz-option" type="button" data-opt="${o.toLowerCase()}" aria-label="Option ${o}: ${esc(optKeys[o.toLowerCase()])}">
        <span class="quiz-opt-letter" aria-hidden="true"><svg class="quiz-opt-svg" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="12.5" stroke="currentColor" stroke-width="1.6"/><text x="14" y="19" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor" font-family="inherit">${o}</text></svg></span>
        <span class="quiz-opt-text">${esc(optKeys[o.toLowerCase()])}</span>
      </button>`).join('');

    return `<div class="section-rule"><span class="section-label">§\u00a07 · BIBLE QUIZ</span></div>
      <article class="story" id="quiz-story">
        <p class="story-kicker">${esc(q.category || 'THEOLOGY')} · ${esc(q.difficulty || 'MEDIUM')}</p>
        <p class="quiz-question">${esc(q.question)}</p>
        <div class="quiz-body" data-correct="${esc(correct)}" data-answered="false">
          <div class="quiz-options" role="group" aria-label="Quiz options">${optButtons}</div>
          ${q.reference ? `<p class="quiz-ref" hidden>Reference: ${esc(q.reference)}</p>` : ''}
        </div>
      </article>`;
  }

  // ── Event wiring (event delegation — wire once, before DOM injection) ─────────

  function wireEvents() {
    // Drawer opens — story headline buttons
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-open-drawer]');
      if (!btn) return;
      const key     = btn.dataset.openDrawer;
      const content = _drawers[key];
      if (!content) return;
      if (window.FlockGates && typeof window.FlockGates.openDrawer === 'function') {
        window.FlockGates.openDrawer('', content);
        // Wire prayer "Pray for this" button that lives inside the drawer
        setTimeout(() => {
          const prayBtn = document.getElementById('drawer-pray-btn');
          if (prayBtn) {
            prayBtn.addEventListener('click', () => {
              if (window.FlockGates?.toast) window.FlockGates.toast('May God answer this prayer. 🙏');
            });
          }
        }, 50);
      }
    });

    // Quiz answer buttons
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.quiz-option');
      if (!btn) return;
      const body = btn.closest('.quiz-body');
      if (!body || body.dataset.answered === 'true') return;
      body.dataset.answered = 'true';
      const chosen  = btn.dataset.opt;
      const correct = body.dataset.correct;
      const isRight = chosen === correct;
      body.querySelectorAll('.quiz-option').forEach(b => {
        b.disabled = true;
        if (b.dataset.opt === correct)             b.classList.add('quiz-option--correct');
        else if (b.dataset.opt === chosen && !isRight) b.classList.add('quiz-option--wrong');
      });
      const refEl = body.querySelector('.quiz-ref');
      if (refEl) refEl.hidden = false;
      if (window.FlockGates?.toast) {
        window.FlockGates.toast(isRight ? '✓ Correct! Well done.' : `The correct answer is ${correct.toUpperCase()}.`);
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  async function init() {
    // Masthead date
    const dateEl = document.getElementById('herald-date');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
    }

    // Wire events once via delegation (before any DOM injection)
    wireEvents();

    const cfg = loadConfig();

    // Load all stories concurrently
    const results = await Promise.allSettled([
      buildLeadStory(cfg),          // main col 1
      buildOYBStory(cfg),           // main col 2 — § 1
      buildBibleBookStory(cfg),     // main col 3 — § 2
      buildAnnouncementsStory(cfg), // main col 4 — § 3
      buildPrayerStory(),           // main col 5 — § 4
      buildCounselingCorner(cfg),   // aside 1 — § 4
      buildNationAside(cfg),        // aside 2 — § 5
      buildHeartAside(cfg),         // aside 3 — § 6
      buildQuizAside(cfg),          // aside 4 — § 7
    ]);

    const html = results.map(r => r.status === 'fulfilled' ? r.value : '');

    const mainEl  = document.getElementById('herald-main');
    const asideEl = document.getElementById('herald-aside');
    if (mainEl)  mainEl.innerHTML  = html.slice(0, 5).join('');
    if (asideEl) asideEl.innerHTML = html.slice(5).join('');
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose for Editor's Desk re-render trigger
  window.Herald = { reload: init, loadConfig };
})();
