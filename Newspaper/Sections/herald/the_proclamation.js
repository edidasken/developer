// the_proclamation.js — Section 1: The Herald
// Phase 2: All 7 panels wired to live Firestore → localStorage → static Data/* fallbacks.
// Panels: Front Page · Today's Word · Announcements · Prayer Spotlight ·
//         Nation of the Week · Heart Check · Quiz Widget

(function () {
  'use strict';

  // ── Config & helpers ─────────────────────────────────────────────────────────

  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('flock_herald_config') || '{}'); }
    catch { return {}; }
  }

  /** Day-of-year index (0-based), stable per calendar day across sessions. */
  function dayIndex() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000) - 1; // 0 = Jan 1
  }

  /** Week-of-year index (0-based). */
  function weekIndex() {
    return Math.floor(dayIndex() / 7);
  }

  /** Safe modulo that always returns a non-negative index. */
  function idx(i, len) { return ((i % len) + len) % len; }

  /** Escape HTML to prevent XSS in dynamically-built innerHTML. */
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Replace a skeleton card with real content. */
  function swapCard(cardEl, html) {
    if (!cardEl) return;
    cardEl.innerHTML = html;
    cardEl.classList.remove('is-loading');
  }

  /** Build a standard card header string. */
  function cardHeader(title, byline) {
    return `<header class="card-header">
      <h2 class="card-headline">${esc(title)}</h2>
      ${byline ? `<p class="card-byline">${esc(byline)}</p>` : ''}
    </header>`;
  }

  // ── Panel builders ───────────────────────────────────────────────────────────

  /** Panel 1: Front Page — church name + date banner + daily scripture */
  async function buildFrontPage(cfg) {
    const card = document.querySelector('[aria-label="Loading front page"]');
    if (!card) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Church name: from firm_foundation session → localStorage → default
    let churchName = 'The Flock';
    try {
      if (window.Nehemiah && typeof window.Nehemiah.getChurchName === 'function') {
        churchName = window.Nehemiah.getChurchName() || churchName;
      } else {
        churchName = localStorage.getItem('flock_church_name') || churchName;
      }
    } catch (_) {}

    // Daily scripture: rotate through Psalms by day index
    let scriptureRef = '';
    let scriptureTitle = '';
    try {
      const { default: psalms } = await import('../../Data/psalms.js');
      if (psalms && psalms.byNumber) {
        const all = psalms.byNumber;
        const overrideIdx = cfg.devotionalIndex !== undefined ? cfg.devotionalIndex : null;
        const entry = all[idx(overrideIdx !== null ? overrideIdx : dayIndex(), all.length)];
        if (entry) {
          scriptureRef = `Psalm ${esc(entry.display)}`;
          scriptureTitle = entry.title || '';
        }
      }
    } catch (_) {}

    swapCard(card, `
      ${cardHeader(churchName, dateStr)}
      <div class="card-body">
        <p class="herald-dateline">${esc(dateStr)}</p>
        ${scriptureRef ? `
        <div class="herald-scripture">
          <span class="herald-scripture__ref">${scriptureRef}</span>
          ${scriptureTitle ? `<span class="herald-scripture__title"> — ${esc(scriptureTitle)}</span>` : ''}
        </div>` : ''}
        <p class="herald-tagline">Shepherding the flock by the power of the Word.</p>
      </div>
    `);
  }

  /** Panel 2: Today's Word — OYB daily reading plan */
  async function buildTodaysWord(cfg) {
    const card = document.querySelector('[aria-label="Loading today\'s word"]');
    if (!card) return;

    let entry = null;
    try {
      const { default: oyb } = await import('../../Data/one_year_bible.js');
      if (Array.isArray(oyb) && oyb.length) {
        const overrideIdx = cfg.devotionalIndex !== undefined ? cfg.devotionalIndex : null;
        entry = oyb[idx(overrideIdx !== null ? overrideIdx : dayIndex(), oyb.length)];
      }
    } catch (_) {}

    if (!entry) {
      swapCard(card, `
        ${cardHeader("Today's Word", "One Year Bible")}
        <div class="card-body">
          <p class="card-empty">Reading plan is loading — come back shortly.</p>
        </div>
      `);
      return;
    }

    swapCard(card, `
      ${cardHeader("Today's Word", "One Year Bible")}
      <div class="card-body oyb-passages">
        <dl class="oyb-list">
          <div class="oyb-row">
            <dt class="oyb-label">Old Testament</dt>
            <dd class="oyb-passage">${esc(entry.ot)}</dd>
          </div>
          <div class="oyb-row">
            <dt class="oyb-label">New Testament</dt>
            <dd class="oyb-passage">${esc(entry.nt)}</dd>
          </div>
          <div class="oyb-row">
            <dt class="oyb-label">Psalm</dt>
            <dd class="oyb-passage">${esc(entry.ps)}</dd>
          </div>
          <div class="oyb-row">
            <dt class="oyb-label">Proverbs</dt>
            <dd class="oyb-passage">${esc(entry.pr)}</dd>
          </div>
        </dl>
      </div>
    `);
  }

  /** Panel 3: Announcements — Firestore flockNews → empty state */
  async function buildAnnouncements(cfg) {
    const card = document.querySelector('[aria-label="Loading announcements"]');
    if (!card) return;

    let items = [];

    // Try UpperRoom.listFlockNews if available
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.listFlockNews === 'function' && UR.isReady && UR.isReady()) {
        const res = await UR.listFlockNews({ limit: 5, published: true });
        if (Array.isArray(res)) items = res;
        else if (res && Array.isArray(res.data)) items = res.data;
      }
    } catch (_) {}

    // Fallback: check localStorage cache
    if (!items.length) {
      try {
        const cached = JSON.parse(localStorage.getItem('flock_news_cache') || '[]');
        if (Array.isArray(cached) && cached.length) items = cached.slice(0, 5);
      } catch (_) {}
    }

    const visibilityOn = cfg.showAnnouncements !== false;

    if (!visibilityOn) {
      swapCard(card, `
        ${cardHeader('Announcements')}
        <div class="card-body">
          <p class="card-empty">Announcements are paused — check back soon.</p>
        </div>
      `);
      return;
    }

    if (!items.length) {
      swapCard(card, `
        ${cardHeader('Announcements')}
        <div class="card-body">
          <p class="card-empty">No announcements yet — the flock is at peace.</p>
        </div>
      `);
      return;
    }

    const rows = items.map(item => `
      <li class="announcement-item">
        <p class="announcement-title">${esc(item.title || item.subject || item.headline || 'Announcement')}</p>
        ${item.body || item.content || item.message
          ? `<p class="announcement-body">${esc(item.body || item.content || item.message)}</p>`
          : ''}
        ${item.date || item.createdAt
          ? `<p class="announcement-date">${esc(item.date || _fmtDate(item.createdAt))}</p>`
          : ''}
      </li>
    `).join('');

    swapCard(card, `
      ${cardHeader('Announcements')}
      <div class="card-body">
        <ul class="announcement-list" role="list">${rows}</ul>
      </div>
    `);
  }

  /** Panel 4: Prayer Spotlight — one public prayer request via UpperRoom.listPrayers */
  async function buildPrayerSpotlight() {
    // Inject a new card after announcements
    const grid = document.getElementById('herald-grid');
    if (!grid) return;

    const card = document.createElement('article');
    card.className = 'broadsheet-card';
    card.setAttribute('aria-label', 'Prayer Spotlight');
    grid.appendChild(card);

    let prayer = null;

    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.listPrayers === 'function') {
        const res = await UR.listPrayers({ limit: 20, allUsers: true });
        const list = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
        // Prefer prayers marked public or unanswered; rotate by day index
        const eligible = list.filter(p => !p.answeredAt && !p.archived);
        if (eligible.length) {
          prayer = eligible[idx(dayIndex(), eligible.length)];
        }
      }
    } catch (_) {}

    if (!prayer) {
      swapCard(card, `
        ${cardHeader('Prayer Spotlight')}
        <div class="card-body">
          <p class="card-empty">No prayer requests yet — the flock is at peace.</p>
        </div>
      `);
      return;
    }

    const requesterName = prayer.displayName || prayer.name || prayer.memberName || 'Anonymous';
    const requestText   = prayer.request || prayer.body || prayer.content || '';
    const dateStr       = prayer.createdAt ? _fmtDate(prayer.createdAt) : '';

    swapCard(card, `
      ${cardHeader('Prayer Spotlight', dateStr ? `Submitted ${dateStr}` : '')}
      <div class="card-body">
        <p class="prayer-name">${esc(requesterName)}</p>
        ${requestText ? `<p class="prayer-text">"${esc(requestText)}"</p>` : ''}
        <button class="btn btn--ghost prayer-pray-btn" type="button"
                aria-label="Pray for this request">🙏 Pray for this</button>
      </div>
    `);

    // "Pray for this" — brief encouragement toast, no data write
    card.querySelector('.prayer-pray-btn')?.addEventListener('click', () => {
      if (window.FlockGates && typeof window.FlockGates.toast === 'function') {
        window.FlockGates.toast('May God answer this prayer. 🙏');
      }
    });
  }

  /** Panel 5: Nation of the Week — rotating missions spotlight */
  async function buildNationOfWeek(cfg) {
    const grid = document.getElementById('herald-grid');
    if (!grid) return;

    const card = document.createElement('article');
    card.className = 'broadsheet-card';
    card.setAttribute('aria-label', 'Nation of the Week');
    grid.appendChild(card);

    let nation = null;
    try {
      const { default: missions } = await import('../../Data/missions.js');
      if (Array.isArray(missions) && missions.length) {
        const overrideIdx = cfg.nationIndex !== undefined ? cfg.nationIndex : null;
        nation = missions[idx(overrideIdx !== null ? overrideIdx : weekIndex(), missions.length)];
      }
    } catch (_) {}

    if (!nation) {
      swapCard(card, `
        ${cardHeader('Nation of the Week')}
        <div class="card-body">
          <p class="card-empty">Missions data is unavailable — pray for all nations.</p>
        </div>
      `);
      return;
    }

    const popFmt = nation.population
      ? (nation.population >= 1_000_000
          ? (nation.population / 1_000_000).toFixed(1) + 'M'
          : (nation.population / 1_000).toFixed(0) + 'K')
      : '';
    const christPct = nation.percentChristian != null
      ? Number(nation.percentChristian).toFixed(1) + '% Christian'
      : '';
    const summary = nation.owSummary
      ? nation.owSummary.slice(0, 240) + (nation.owSummary.length > 240 ? '…' : '')
      : '';
    const challenges = Array.isArray(nation.owPrayerChallenges) && nation.owPrayerChallenges.length
      ? nation.owPrayerChallenges[0]
      : '';

    swapCard(card, `
      ${cardHeader(
        (nation.icon ? nation.icon + ' ' : '') + esc(nation.countryName || nation.name || 'Unknown Nation'),
        [popFmt, christPct].filter(Boolean).join(' · ')
      )}
      <div class="card-body">
        ${summary ? `<p class="nation-summary">${esc(summary)}</p>` : ''}
        ${challenges ? `
        <div class="nation-prayer">
          <p class="nation-prayer__label">Pray for:</p>
          <p class="nation-prayer__text">${esc(challenges)}</p>
        </div>` : ''}
        ${nation.persecutionLevel ? `<p class="nation-persecution nation-persecution--${esc(nation.persecutionTier || 'unknown').toLowerCase()}">
          ⚠ ${esc(nation.persecutionLevel)} restrictions
        </p>` : ''}
      </div>
    `);
  }

  /** Panel 6: Heart Check — daily self-reflection question */
  async function buildHeartCheck(cfg) {
    const grid = document.getElementById('herald-grid');
    if (!grid) return;

    const card = document.createElement('article');
    card.className = 'broadsheet-card';
    card.setAttribute('aria-label', 'Heart Check');
    grid.appendChild(card);

    let question = null;
    try {
      const { default: heartData } = await import('../../Data/heart.js');
      if (Array.isArray(heartData) && heartData.length) {
        const overrideIdx = cfg.heartIndex !== undefined ? cfg.heartIndex : null;
        question = heartData[idx(overrideIdx !== null ? overrideIdx : dayIndex(), heartData.length)];
      }
    } catch (_) {}

    if (!question) {
      swapCard(card, `
        ${cardHeader('Heart Check', 'Daily self-inventory')}
        <div class="card-body">
          <p class="card-empty">"Search me, O God, and know my heart." — Psalm 139:23</p>
        </div>
      `);
      return;
    }

    const qText    = question['Question'] || question.question || '';
    const category = question['Category'] || question.category || '';
    const verse    = question['Verse Reference'] || question.verseReference || '';
    const rx       = question['Prescription'] || question.prescription || '';

    swapCard(card, `
      ${cardHeader('Heart Check', category || 'Daily self-inventory')}
      <div class="card-body">
        ${qText ? `<p class="heart-question">${esc(qText)}</p>` : ''}
        ${verse ? `<p class="heart-verse">— ${esc(verse)}</p>` : ''}
        ${rx ? `<details class="heart-rx">
          <summary class="heart-rx__toggle">Reflection</summary>
          <p class="heart-rx__text">${esc(rx)}</p>
        </details>` : ''}
      </div>
    `);
  }

  /** Panel 7: Quiz Widget — daily Bible quiz */
  async function buildQuiz(cfg) {
    const grid = document.getElementById('herald-grid');
    if (!grid) return;

    const card = document.createElement('article');
    card.className = 'broadsheet-card';
    card.setAttribute('aria-label', 'Bible Quiz');
    grid.appendChild(card);

    let q = null;
    try {
      const { default: quizData } = await import('../../Data/quiz.js');
      if (Array.isArray(quizData) && quizData.length) {
        const overrideIdx = cfg.quizIndex !== undefined ? cfg.quizIndex : null;
        q = quizData[idx(overrideIdx !== null ? overrideIdx : dayIndex(), quizData.length)];
      }
    } catch (_) {}

    if (!q) {
      swapCard(card, `
        ${cardHeader('Bible Quiz')}
        <div class="card-body">
          <p class="card-empty">No quiz available today. Check back tomorrow!</p>
        </div>
      `);
      return;
    }

    const opts = ['A', 'B', 'C', 'D'];
    const correct = (q.correctAnswer || '').toLowerCase();
    const optKeys = { a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD };

    const optButtons = opts
      .filter(o => optKeys[o.toLowerCase()])
      .map(o => `
        <button class="quiz-option" type="button"
                data-opt="${o.toLowerCase()}"
                aria-label="Option ${o}: ${esc(optKeys[o.toLowerCase()])}">
          <span class="quiz-opt-letter">${o}</span>
          <span class="quiz-opt-text">${esc(optKeys[o.toLowerCase()])}</span>
        </button>
      `).join('');

    swapCard(card, `
      ${cardHeader('Bible Quiz', `${esc(q.category || '')} · ${esc(q.difficulty || '')}`)}
      <div class="card-body quiz-body" data-correct="${esc(correct)}" data-answered="false">
        <p class="quiz-question">${esc(q.question)}</p>
        <div class="quiz-options" role="group" aria-label="Quiz options">${optButtons}</div>
        ${q.reference ? `<p class="quiz-ref" hidden>Reference: ${esc(q.reference)}</p>` : ''}
      </div>
    `);

    // Wire answer buttons
    card.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const body = card.querySelector('.quiz-body');
        if (body.dataset.answered === 'true') return;
        body.dataset.answered = 'true';
        const chosen  = btn.dataset.opt;
        const isRight = chosen === correct;

        card.querySelectorAll('.quiz-option').forEach(b => {
          const opt = b.dataset.opt;
          b.disabled = true;
          if (opt === correct) b.classList.add('quiz-option--correct');
          else if (opt === chosen && !isRight) b.classList.add('quiz-option--wrong');
        });

        const refEl = card.querySelector('.quiz-ref');
        if (refEl) refEl.hidden = false;

        if (window.FlockGates?.toast) {
          window.FlockGates.toast(isRight
            ? '✓ Correct! Well done.'
            : `The correct answer is ${correct.toUpperCase()}.`
          );
        }
      });
    });
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  function _fmtDate(val) {
    if (!val) return '';
    try {
      const ts = val.toDate ? val.toDate() : (val.seconds ? new Date(val.seconds * 1000) : new Date(val));
      return ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  async function init() {
    // Set date in masthead
    const dateEl = document.getElementById('herald-date');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }

    const cfg = loadConfig();

    // Run all panel builders concurrently — each is independent
    // First 3 panels replace existing skeleton cards; panels 4-7 append new cards
    await Promise.allSettled([
      buildFrontPage(cfg),
      buildTodaysWord(cfg),
      buildAnnouncements(cfg),
      buildPrayerSpotlight(),
      buildNationOfWeek(cfg),
      buildHeartCheck(cfg),
      buildQuiz(cfg),
    ]);
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose for Editor's Desk re-render trigger
  window.Herald = { reload: init, loadConfig };
})();
