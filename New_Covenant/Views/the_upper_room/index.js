/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: THE UPPER ROOM — Devotional life
   "And when the day of Pentecost was fully come, they were all
    with one accord in one place." — Acts 2:1

   A tabbed sub-application within FlockOS that brings the Word front-and-
   centre. Mirrors the ATOG (A Touch of the Gospel) Upper Room surface
   from the legacy launcher.

     Tabs:
       • Devotional — today's reflection + scripture + question + prayer
       • Reading    — daily reading plan (OT / NT / Psalms / Proverbs)
       • Journal    — personal entries (Firestore: church/{id}/journal)
       • Prayer     — quick jump to the Prayer Chain

   Data sources:
     • UpperRoom.listAppContent('devotionals') — Firestore (preferred)
     • UpperRoom.listAppContent('reading')     — Firestore (preferred)
     • TheVine.app.devotionals() / .reading()  — fallback (GAS)
     • UpperRoom.listJournal / createJournal   — Firestore
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero }        from '../_frame.js';
import { mountDevotional } from './the_devotional.js';
import { mountReading }    from './the_reading.js';
import { mountJournal }    from './the_journal.js';
import { mountPrayer }     from './the_prayer.js';

export const name  = 'the_upper_room';
export const title = 'The Upper Room';

const TABS = [
  { id: 'devotional', label: "Today's Word",   icon: '🕯️' },
  { id: 'reading',    label: 'Reading Plan',   icon: '📖' },
  { id: 'journal',    label: 'Journal',        icon: '✍️' },
  { id: 'prayer',     label: 'Prayer',         icon: '🙏' },
];

export function render(params = {}) {
  const initial = TABS.some(t => t.id === params.tab) ? params.tab : 'devotional';
  return /* html */`
    <section class="upper-room ms-dash">
      ${pageHero({
        title: 'The Upper Room',
        subtitle: 'A daily place for the Word — devotion, reading, journal, and prayer.',
        scripture: 'Thy word is a lamp unto my feet, and a light unto my path. — Psalm 119:105',
      })}

      <div class="ur-tabs" role="tablist">
        ${TABS.map(t => `
          <button type="button" role="tab" class="ur-tab ${t.id === initial ? 'is-active' : ''}"
                  data-ur-tab="${t.id}" aria-selected="${t.id === initial}">
            <span class="ur-tab-icon" aria-hidden="true">${t.icon}</span>
            <span class="ur-tab-label">${t.label}</span>
          </button>
        `).join('')}
      </div>

      <div class="ur-panel" data-ur-panel="devotional" ${initial !== 'devotional' ? 'hidden' : ''}>
        <flock-skeleton rows="6"></flock-skeleton>
      </div>
      <div class="ur-panel" data-ur-panel="reading" ${initial !== 'reading' ? 'hidden' : ''}>
        <flock-skeleton rows="6"></flock-skeleton>
      </div>
      <div class="ur-panel" data-ur-panel="journal" ${initial !== 'journal' ? 'hidden' : ''}>
        <flock-skeleton rows="4"></flock-skeleton>
      </div>
      <div class="ur-panel" data-ur-panel="prayer" ${initial !== 'prayer' ? 'hidden' : ''}>
        <flock-skeleton rows="4"></flock-skeleton>
      </div>
    </section>
  `;
}

export function mount(root, ctx) {
  const stops = [];
  const mounted = { devotional: false, reading: false, journal: false, prayer: false };

  const activate = (tabId) => {
    root.querySelectorAll('[data-ur-tab]').forEach((el) => {
      const on = el.dataset.urTab === tabId;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', String(on));
    });
    root.querySelectorAll('[data-ur-panel]').forEach((el) => {
      el.hidden = el.dataset.urPanel !== tabId;
    });
    // Lazy-mount each tab the first time it is opened.
    if (tabId === 'devotional' && !mounted.devotional) {
      stops.push(mountDevotional(root.querySelector('[data-ur-panel="devotional"]'), ctx));
      mounted.devotional = true;
    }
    if (tabId === 'reading' && !mounted.reading) {
      stops.push(mountReading(root.querySelector('[data-ur-panel="reading"]'), ctx));
      mounted.reading = true;
    }
    if (tabId === 'journal' && !mounted.journal) {
      stops.push(mountJournal(root.querySelector('[data-ur-panel="journal"]'), ctx));
      mounted.journal = true;
    }
    if (tabId === 'prayer' && !mounted.prayer) {
      mountPrayer(root.querySelector('[data-ur-panel="prayer"]'), ctx);
      mounted.prayer = true;
    }
  };

  // Wire tab buttons.
  root.querySelectorAll('[data-ur-tab]').forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.dataset.urTab));
  });

  // Mount whichever tab is initially visible.
  const initial = root.querySelector('[data-ur-tab].is-active')?.dataset.urTab || 'devotional';
  activate(initial);

  return () => { stops.forEach((fn) => { try { fn && fn(); } catch (_) {} }); };
}
