/* ══════════════════════════════════════════════════════════════════════════════
   THE GROWTH — "Grow" dashboard. The single navbar entry that gathers every
   learning-hub module into one welcoming page.
   "But grow in the grace and knowledge of our Lord and Savior Jesus Christ." — 2 Peter 3:18
   ══════════════════════════════════════════════════════════════════════════════ */

import * as Courses      from '../../Scripts/the_gospel/the_gospel_courses.js';
import * as Quizzes      from '../../Scripts/the_gospel/the_gospel_quizzes.js';
import * as Reading      from '../../Scripts/the_gospel/the_gospel_reading.js';
import * as Theology      from '../../Scripts/the_gospel/the_gospel_theology.js';
import * as TeachingPlans from '../../Scripts/the_gospel/the_gospel_teaching_plans.js';
import * as Lexicon       from '../../Scripts/the_gospel/the_gospel_lexicon.js';
import * as Library      from '../../Scripts/the_gospel/the_gospel_library.js';
import * as Devotionals  from '../../Scripts/the_gospel/the_gospel_devotionals.js';
import * as Apologetics  from '../../Scripts/the_gospel/the_gospel_apologetics.js';
import * as Counseling   from '../../Scripts/the_gospel/the_gospel_counseling.js';
import * as Sermons      from '../../Scripts/the_gospel/the_gospel_sermons.js';
import * as Heart        from '../../Scripts/the_gospel/the_gospel_heart.js';
import * as Mirror       from '../../Scripts/the_gospel/the_gospel_mirror.js';
import * as Genealogy    from '../../Scripts/the_gospel/the_gospel_genealogy.js';
import * as Journal      from '../../Scripts/the_gospel/the_gospel_journal.js';
import * as Certificates from '../../Scripts/the_gospel/the_gospel_certificates.js';
import * as Analytics    from '../../Scripts/the_gospel/the_gospel_analytics.js';

export const name  = 'the_growth';
export const title = 'Grow';

const SECTIONS = [
  {
    title:   'Daily Practice',
    blurb:   'Habits to walk with the Lord this week.',
    modules: [Reading, Devotionals, Journal, Heart, Mirror],
  },
  {
    title:   'Study & Discipleship',
    blurb:   'Go deep — courses, doctrine, words, and lives.',
    modules: [Courses, Quizzes, Theology, TeachingPlans, Lexicon, Library, Apologetics, Counseling, Genealogy],
  },
  {
    title:   'From the Pulpit',
    blurb:   'Sermons preached by your shepherd.',
    modules: [Sermons],
  },
  {
    title:   'Your Walk',
    blurb:   'See how you are growing.',
    modules: [Certificates, Analytics],
  },
];

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

function _card(m) {
  const accent = m.accent || '#475569';
  return /* html */`
    <button class="growth-card" data-go="${esc(m.name)}" style="--grow-accent:${esc(accent)}">
      <span class="growth-card-icon" aria-hidden="true">${m.icon || ''}</span>
      <span class="growth-card-text">
        <span class="growth-card-title">${esc(m.title)}</span>
        <span class="growth-card-desc">${esc(m.description || '')}</span>
      </span>
    </button>
  `;
}

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="growth">
      <header class="grow-hero" style="--grow-accent:#0ea572">
        <div class="grow-hero-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22V8"/><path d="M5 12c0-3 3-5 7-4 0 4-3 7-7 4z"/><path d="M19 8c0-3-3-5-7-4 0 4 3 7 7 4z"/>
          </svg>
        </div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">Grow</h1>
          <p class="grow-hero-sub">Your library, your habits, your discipleship — all in one place. Pick where to start.</p>
        </div>
      </header>

      ${SECTIONS.map((s) => /* html */`
        <section class="growth-section">
          <header class="growth-section-head">
            <h2 class="growth-section-title">${esc(s.title)}</h2>
            <p class="growth-section-blurb">${esc(s.blurb)}</p>
          </header>
          <div class="growth-grid">
            ${s.modules.map(_card).join('')}
          </div>
        </section>
      `).join('')}
    </section>
  `;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-go');
      if (ctx && typeof ctx.go === 'function') ctx.go(target);
      else if (window.TheScribes && typeof window.TheScribes.go === 'function') window.TheScribes.go(target);
    });
  });
  return () => {};
}
