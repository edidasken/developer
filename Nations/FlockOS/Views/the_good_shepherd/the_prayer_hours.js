/* ══════════════════════════════════════════════════════════════════════════════
   THE PRAYER HOURS — Daily Prayer Hours widget for the home dashboard
   "Evening, morning and noon I cry out in distress, and he hears my voice."
   — Psalm 55:17

   Compact, static widget — no API calls. Uses the same pray-liturgy-* classes
   as the full Prayerful Action page so it looks identical.
   ══════════════════════════════════════════════════════════════════════════════ */

const _e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const LITURGY = [
  { id: 'dawn',    time: 'Dawn',     label: 'Morning Watch',   icon: '🌅', range: [4,  11], text: '"O LORD, in the morning you hear my voice." — Psalm 5:3 (ESV)' },
  { id: 'midday',  time: '12:00 PM', label: 'Midday Pause',    icon: '☀️',  range: [11, 14], text: '"Seven times a day I praise you." — Psalm 119:164 (ESV)' },
  { id: 'three',   time: '3:00 PM',  label: 'Hour of Prayer',  icon: '⛪',  range: [14, 17], text: '"Now Peter and John were going up to the temple at the hour of prayer." — Acts 3:1 (ESV)' },
  { id: 'vespers', time: 'Evening',  label: 'Evening Prayers', icon: '🌙', range: [17, 23], text: '"Let my prayer be counted as incense before you." — Psalm 141:2 (ESV)' },
];

function _currentHour() {
  const h = new Date().getHours();
  return LITURGY.find((l) => h >= l.range[0] && h < l.range[1]) || LITURGY[0];
}

export function mountPrayerHours(host, ctx) {
  if (!host) return () => {};

  const now = _currentHour();

  host.innerHTML = `
    <div class="pray-liturgy-card">
      <div class="pray-liturgy-title">Daily Prayer Hours</div>
      <div class="pray-liturgy-verse">&ldquo;Evening, morning and noon I cry out in distress, and he hears my voice.&rdquo; &mdash; Psalm 55:17</div>
      <div class="pray-liturgy-list">
        ${LITURGY.map((l) => {
          const isNow = l.id === now.id;
          return `
        <div class="pray-liturgy-row${isNow ? ' is-now' : ''}" data-hour="${_e(l.id)}" tabindex="0" role="button" aria-label="Begin ${_e(l.label)}">
          <div class="pray-lit-icon">${l.icon}</div>
          <div class="pray-lit-body">
            <div class="pray-lit-time">${_e(l.time)} &mdash; ${_e(l.label)}${isNow ? ' <span class="pray-lit-now-pill">Now</span>' : ''}</div>
            <div class="pray-lit-text">${_e(l.text)}</div>
          </div>
        </div>`;
        }).join('')}
      </div>
      <button class="flock-btn flock-btn--ghost devo-dark-btn ph-begin-btn" id="ph-begin-btn" style="width:100%;margin-top:16px;color:#fff;border-color:rgba(255,255,255,.25)">
        Begin ${_e(now.label)}
      </button>
    </div>`;

  const go = () => {
    if (ctx && ctx.go) ctx.go('prayerful_action');
    else if (typeof navigate === 'function') navigate('prayerful_action');
  };

  host.querySelector('#ph-begin-btn')?.addEventListener('click', go);
  host.querySelectorAll('.pray-liturgy-row').forEach((row) => {
    row.addEventListener('click', go);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });

  return () => {};
}
