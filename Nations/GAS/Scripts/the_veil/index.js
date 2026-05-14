/* ══════════════════════════════════════════════════════════════════════════════
   THE VEIL — Shell chrome (public API)
   "And behold, the veil of the temple was rent in twain
    from the top to the bottom." — Matthew 27:51

   The Veil dresses the page: top bar, side nav, main slot, footer.
   It mounts the structural skeleton ONCE, then hands the inner slot to
   the_scribes for view rendering.
   ══════════════════════════════════════════════════════════════════════════════ */

import { mountCrown }    from './the_crown.js';
import { mountPillars }  from './the_pillars.js';
import { mountCourtyard } from './the_courtyard.js';
import { mountHem }      from './the_hem.js';
import { setMountSlot, reload } from '../the_scribes/index.js';
import { mountRefresh }  from './the_refresh.js';

let _dressed = false;

export async function dress() {
  if (_dressed) return;
  _dressed = true;

  // The new shell expects a single <main id="the-holy-place"> already in HTML.
  // If not present (running inside the legacy index.html), build the skeleton.
  let host = document.getElementById('the-holy-place');
  if (!host) host = _buildSkeleton();

  mountCrown(document.getElementById('the-veil-top'));
  mountPillars(document.getElementById('the-veil-side'));
  mountHem(document.getElementById('the-veil-foot'));
  const slot = mountCourtyard(host);
  setMountSlot(slot);
  mountRefresh(host, () => reload());

  // Close mobile nav when tapping the backdrop (the ::after pseudo-element)
  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('veil-side-open')) return;
    const side = document.getElementById('the-veil-side');
    // Don't close if clicking the hamburger button or inside the sidebar
    if (side && !side.contains(e.target) && !e.target.closest('[data-act="menu"]')) {
      document.body.classList.remove('veil-side-open');
    }
  });
}

function _buildSkeleton() {
  const wrap = document.createElement('div');
  wrap.className = 'veil-wrap';
  wrap.innerHTML = `
    <header id="the-veil-top"  class="veil-top"></header>
    <nav    id="the-veil-side" class="veil-side"></nav>
    <main   id="the-holy-place" class="veil-main"></main>
    <footer id="the-veil-foot" class="veil-foot"></footer>
    <div    id="the-staff-host" class="staff-host" aria-live="polite"></div>
  `;
  document.body.appendChild(wrap);
  return wrap.querySelector('#the-holy-place');
}
