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

    let psalmRef = '', psalmTitle = '', psalmSummary = '';
    try {
      const { default: psalms } = await import('../../Data/psalms.js');
      if (psalms && psalms.byNumber) {
        const all = psalms.byNumber;
        const override = cfg.devotionalIndex != null ? cfg.devotionalIndex : null;
        const entry = all[idx(override != null ? override : dayIndex(), all.length)];
        if (entry) {
          psalmRef    = `Psalm ${entry.display || entry.number}`;
          psalmTitle  = entry.title || '';
          psalmSummary = entry.summary || '';
          _drawers['front-page'] = `
            <p class="story-kicker">DAILY DEVOTIONAL · ${esc(shortDate)}</p>
            <h2 style="font-family:'Lora',Georgia,serif;font-size:1.375rem;line-height:1.25;margin:0.5rem 0 0.25rem">${esc(psalmRef)}</h2>
            ${psalmTitle ? `<p style="font-family:'Lora',Georgia,serif;font-style:italic;color:var(--ink-muted);font-size:1rem;margin:0 0 1rem">${esc(psalmTitle)}</p>` : ''}
            ${psalmSummary ? `<p style="line-height:1.75;color:var(--ink)">${esc(psalmSummary)}</p>` : ''}`;
        }
      }
    } catch (_) {}

    const hed  = psalmTitle || psalmRef || `The Flock Herald — ${shortDate}`;
    const deck = psalmRef
      ? `${psalmRef}${psalmTitle ? ' \u2014 ' + psalmTitle : ''}`
      : 'Shepherding the flock by the power of the Word.';

    // Scripture pull-quote block (uses existing .herald-scripture styles in herald.css)
    const scriptureBlock = psalmRef
      ? `<div class="herald-scripture">
          <p class="herald-scripture__ref">${esc(psalmRef)}</p>
          ${psalmTitle ? `<p class="herald-scripture__title">${esc(psalmTitle)}</p>` : ''}
         </div>`
      : '';

    const hedInner = _drawers['front-page']
      ? `<button class="story-hed-btn" type="button" data-open-drawer="front-page">${esc(hed)}</button>`
      : `<span class="story-hed-btn" style="cursor:default;pointer-events:none">${esc(hed)}</span>`;

    return `<article class="story story--lead">
      <p class="story-kicker">THE FLOCK HERALD \u00b7\u00a0${esc(dateStr.toUpperCase())}</p>
      <h2 class="story-hed">${hedInner}</h2>
      <p class="story-deck">${esc(deck)}</p>
      <p class="story-byline">${esc(churchName)} \u00b7 ${esc(shortDate)}</p>
      <p class="story-body story-body--lead story-dropcap">Today the flock gathers around the living Word. May God's truth shepherd your steps, strengthen your hands, and fill your heart with his peace as you read this edition.</p>
      ${scriptureBlock}
      <hr class="story-rule">
    </article>`;
  }

  /** § 1 — Today's Readings (One Year Bible) */
  async function buildOYBStory(cfg) {
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

    const rows = [
      entry.ot ? `<div class="oyb-row"><dt class="oyb-label">Old Testament</dt><dd class="oyb-passage">${esc(entry.ot)}</dd></div>` : '',
      entry.nt ? `<div class="oyb-row"><dt class="oyb-label">New Testament</dt><dd class="oyb-passage">${esc(entry.nt)}</dd></div>` : '',
      entry.ps ? `<div class="oyb-row"><dt class="oyb-label">Psalm</dt><dd class="oyb-passage">${esc(entry.ps)}</dd></div>` : '',
      entry.pr ? `<div class="oyb-row"><dt class="oyb-label">Proverbs</dt><dd class="oyb-passage">${esc(entry.pr)}</dd></div>` : '',
    ].filter(Boolean).join('');

    _drawers['oyb'] = `
      <p class="story-kicker">§\u00a01 · DAILY READINGS · ONE YEAR BIBLE</p>
      <h2 style="font-family:'Lora',Georgia,serif;font-size:1.25rem;margin:0.5rem 0 1rem">Today's Readings</h2>
      <dl class="oyb-list">${rows}</dl>`;

    return _story({
      num:      1,
      category: 'DAILY READINGS',
      section:  'ONE YEAR BIBLE',
      hed:      "Today's Readings",
      deck:     entry.ot || entry.nt || 'Scripture readings for today',
      byline:   'ONE YEAR BIBLE PLAN',
      bodyHtml: `<dl class="oyb-list">${rows}</dl>`,
      drawer:   'oyb',
    });
  }

  /** § 2 — Announcements */
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
        num:      2,
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

    _drawers['announcements'] = `
      <p class="story-kicker">§\u00a02 · FROM THE CHURCH · ANNOUNCEMENTS</p>
      <ul class="announcement-list" style="margin-top:1rem">${items.map(item =>
        `<li class="announcement-item">
          <p class="announcement-title">${esc(item.title || item.subject || 'Announcement')}</p>
          ${item.body ? `<p class="announcement-body">${esc(item.body)}</p>` : ''}
          ${item.date ? `<p class="announcement-date">${esc(item.date)}</p>` : ''}
         </li>`).join('')}</ul>`;

    return _story({
      num:      2,
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
      return _story({ num: 3, category: 'THE PRAYER WALL', section: 'SPOTLIGHT', hed: 'Prayer Spotlight', deck: 'No prayer requests yet — the flock is at peace.', byline: 'PRAYER WALL' });
    }

    const name    = prayer.displayName || prayer.name || prayer.memberName || 'Anonymous';
    const text    = prayer.request || prayer.body || prayer.content || '';
    const dateStr = prayer.createdAt ? _fmtDate(prayer.createdAt) : '';

    _drawers['prayer'] = `
      <p class="story-kicker">§\u00a03 · THE PRAYER WALL · SPOTLIGHT</p>
      <h2 style="font-family:'Lora',Georgia,serif;font-size:1.25rem;margin:0.5rem 0">${esc(name)}</h2>
      ${dateStr ? `<p style="font-size:0.75rem;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;margin:0 0 0.75rem">Submitted ${esc(dateStr)}</p>` : ''}
      ${text ? `<p class="prayer-text">"${esc(text)}"</p>` : ''}
      <button class="prayer-pray-btn btn btn--ghost" type="button" id="drawer-pray-btn" style="margin-top:0.5rem">🙏 Pray for this</button>`;

    const deckText = text ? `"${text.slice(0, 100)}${text.length > 100 ? '…' : ''}"` : 'A request from your church family.';

    return _story({
      num:      3,
      category: 'THE PRAYER WALL',
      section:  'SPOTLIGHT',
      hed:      name,
      deck:     deckText,
      byline:   `PRAYER SPOTLIGHT${dateStr ? ' · ' + dateStr : ''}`,
      drawer:   'prayer',
    });
  }

  // ── Aside column panel builders ───────────────────────────────────────────────

  /** § 4 — Nation of the Week */
  async function buildNationAside(cfg) {
    let nation = null;
    try {
      const { default: missions } = await import('../../Data/missions.js');
      if (Array.isArray(missions) && missions.length) {
        const override = cfg.nationIndex != null ? cfg.nationIndex : null;
        nation = missions[idx(override != null ? override : weekIndex(), missions.length)];
      }
    } catch (_) {}

    if (!nation) {
      return `<div class="section-rule"><span class="section-label">§\u00a04 · MISSIONS</span></div>
        <p class="story-kicker">NATION OF THE WEEK</p>
        <p class="story-body" style="color:var(--ink-muted)">Missions data unavailable — pray for all nations.</p>
        <hr class="story-rule">`;
    }

    const popFmt  = nation.population
      ? (nation.population >= 1e6 ? (nation.population / 1e6).toFixed(1) + 'M' : (nation.population / 1e3).toFixed(0) + 'K')
      : '';
    const christPct  = nation.percentChristian != null ? Number(nation.percentChristian).toFixed(1) + '% Christian' : '';
    const nationName = (nation.icon ? nation.icon + ' ' : '') + (nation.countryName || nation.name || 'Unknown Nation');
    const summary    = nation.owSummary ? nation.owSummary.slice(0, 180) + (nation.owSummary.length > 180 ? '…' : '') : '';
    const challenge  = Array.isArray(nation.owPrayerChallenges) && nation.owPrayerChallenges.length ? nation.owPrayerChallenges[0] : '';

    _drawers['nation'] = `
      <p class="story-kicker">§\u00a04 · NATION OF THE WEEK · MISSIONS</p>
      <h2 style="font-family:'Lora',Georgia,serif;font-size:1.25rem;margin:0.5rem 0">${esc(nationName)}</h2>
      <p style="font-size:0.8125rem;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;margin:0 0 0.75rem">${[popFmt, christPct].filter(Boolean).join(' · ')}</p>
      ${summary ? `<p style="line-height:1.75;margin-bottom:1rem">${esc(summary)}</p>` : ''}
      ${challenge ? `<div class="nation-prayer"><p class="nation-prayer__label">Pray for:</p><p class="nation-prayer__text">${esc(challenge)}</p></div>` : ''}
      ${nation.persecutionLevel ? `<p class="nation-persecution" style="margin-top:0.5rem">⚠ ${esc(nation.persecutionLevel)} restrictions</p>` : ''}`;

    return `<div class="section-rule"><span class="section-label">§\u00a04 · MISSIONS</span></div>
      <article class="story">
        <p class="story-kicker">NATION OF THE WEEK</p>
        <h2 class="story-hed"><button class="story-hed-btn" type="button" data-open-drawer="nation" style="font-size:1.0625rem">${esc(nationName)}</button></h2>
        <p class="story-byline">${[popFmt, christPct].filter(Boolean).join(' · ')}</p>
        ${summary ? `<p class="story-body">${esc(summary)}</p>` : ''}
        ${nation.persecutionLevel ? `<p class="nation-persecution" style="margin-top:0.25rem">⚠ ${esc(nation.persecutionLevel)} restrictions</p>` : ''}
        <hr class="story-rule">
      </article>`;
  }

  /** § 5 — Heart Check */
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
      return `<div class="section-rule"><span class="section-label">§\u00a05 · HEART CHECK</span></div>
        <p class="story-body" style="font-style:italic;color:var(--ink-muted)">"Search me, O God, and know my heart." — Psalm 139:23</p>
        <hr class="story-rule">`;
    }

    const qText    = question['Question']       || question.question       || '';
    const category = question['Category']       || question.category       || '';
    const verse    = question['Verse Reference'] || question.verseReference || '';
    const rx       = question['Prescription']    || question.prescription   || '';

    _drawers['heart'] = `
      <p class="story-kicker">§\u00a05 · HEART CHECK · DAILY SELF-INVENTORY</p>
      <h2 style="font-family:'Lora',Georgia,serif;font-size:1.125rem;line-height:1.4;margin:0.5rem 0">${esc(qText)}</h2>
      ${verse ? `<p class="heart-verse">— ${esc(verse)}</p>` : ''}
      ${rx ? `<p style="font-size:0.9375rem;line-height:1.7;color:var(--ink-muted);margin-top:0.75rem">${esc(rx)}</p>` : ''}`;

    return `<div class="section-rule"><span class="section-label">§\u00a05 · HEART CHECK</span></div>
      <article class="story">
        <p class="story-kicker">${esc(category || 'DAILY SELF-INVENTORY')}</p>
        <h2 class="story-hed"><button class="story-hed-btn" type="button" data-open-drawer="heart" style="font-size:1rem">${esc(qText)}</button></h2>
        ${verse ? `<p class="story-byline">${esc(verse)}</p>` : ''}
        <hr class="story-rule">
      </article>`;
  }

  /** § 6 — Bible Quiz (interactive inline — no drawer) */
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
      return `<div class="section-rule"><span class="section-label">§\u00a06 · BIBLE QUIZ</span></div>
        <p class="story-body" style="color:var(--ink-muted)">No quiz available today — check back tomorrow.</p>`;
    }

    const opts    = ['A', 'B', 'C', 'D'];
    const correct = (q.correctAnswer || '').toLowerCase();
    const optKeys = { a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD };
    const optButtons = opts
      .filter(o => optKeys[o.toLowerCase()])
      .map(o => `<button class="quiz-option" type="button" data-opt="${o.toLowerCase()}" aria-label="Option ${o}: ${esc(optKeys[o.toLowerCase()])}">
        <span class="quiz-opt-letter">${o}</span>
        <span class="quiz-opt-text">${esc(optKeys[o.toLowerCase()])}</span>
      </button>`).join('');

    return `<div class="section-rule"><span class="section-label">§\u00a06 · BIBLE QUIZ</span></div>
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
      buildOYBStory(cfg),           // main col 2
      buildAnnouncementsStory(cfg), // main col 3
      buildPrayerStory(),           // main col 4
      buildNationAside(cfg),        // aside 1
      buildHeartAside(cfg),         // aside 2
      buildQuizAside(cfg),          // aside 3
    ]);

    const html = results.map(r => r.status === 'fulfilled' ? r.value : '');

    const mainEl  = document.getElementById('herald-main');
    const asideEl = document.getElementById('herald-aside');
    if (mainEl)  mainEl.innerHTML  = html.slice(0, 4).join('');
    if (asideEl) asideEl.innerHTML = html.slice(4).join('');
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose for Editor's Desk re-render trigger
  window.Herald = { reload: init, loadConfig };
})();
