/* ══════════════════════════════════════════════════════════════════════════════
   THE GARMENTS — Sign-in form UI
   "Let your priests be clothed with righteousness." — Psalm 132:9 (ESV)

   A proper, branded sign-in experience — dark and royal, matching the
   lampstand's visual language. CSS lives in new_covenant.css (.garments-*).
   ══════════════════════════════════════════════════════════════════════════════ */

import { weighAll, rules } from '../the_stones.js';

export async function renderGarments(/* { mode } */) {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'garments-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Sign in to FlockOS');

    root.innerHTML = `
      <form class="garments-card" novalidate>
        <h2 class="garments-title">Enter the Fold</h2>
        <p class="garments-sub">Tend the flock entrusted to you.</p>

        <div class="garments-field">
          <label class="garments-label" for="gc-email">Email</label>
          <input class="garments-input" id="gc-email" type="email" name="email"
                 autocomplete="email" required placeholder="you@church.org">
        </div>
        <div class="garments-field">
          <label class="garments-label" for="gc-passcode">Passcode</label>
          <input class="garments-input" id="gc-passcode" type="password" name="passcode"
                 autocomplete="current-password" inputmode="numeric" required placeholder="••••••">
        </div>

        <div class="garments-error" aria-live="polite"></div>

        <div class="garments-actions">
          <button type="submit"  class="garments-btn-submit" data-act="submit">
            <span class="garments-btn-label">Sign in</span>
          </button>
        </div>

        <p class="garments-scripture">
          "Let your priests be clothed with righteousness." — Psalm 132:9 (ESV)
        </p>

        <p class="garments-request-access">
          Not set up yet? <button type="button" class="garments-request-link" data-act="request-access">Request access</button>
          <span class="garments-request-sep">·</span>
          or <a href="../app.flocknews/flocknews.html" class="garments-request-link">Return to Home</a>
        </p>
      </form>
    `;

    const form     = root.querySelector('form');
    const errBox   = root.querySelector('.garments-error');
    const submitBtn = root.querySelector('.garments-btn-submit');
    const labelEl  = root.querySelector('.garments-btn-label');

    function _setLoading(on) {
      submitBtn.disabled = on;
      labelEl.textContent = on ? 'Signing in…' : 'Sign in';
      if (on) {
        const spinner = document.createElement('span');
        spinner.className = 'garments-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        submitBtn.insertBefore(spinner, submitBtn.firstChild);
      } else {
        const s = submitBtn.querySelector('.garments-spinner');
        if (s) s.remove();
      }
    }

    function close(result) {
      root.style.opacity = '0';
      root.style.transition = 'opacity 200ms ease';
      setTimeout(() => { if (root.parentNode) root.parentNode.removeChild(root); }, 210);
      resolve(result);
    }

    // Cancel button removed — login is required to enter the site.
    // Backdrop click is intentionally non-dismissible.

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.textContent = '';
      const email    = form.email.value.trim();
      const passcode = form.passcode.value;
      const v  = weighAll(email,    [rules.required, rules.email]);
      if (!v.ok)  { errBox.textContent = v.message; return; }
      const v2 = weighAll(passcode, [rules.required]);
      if (!v2.ok) { errBox.textContent = v2.message; return; }

      _setLoading(true);
      try {
        const N = window.Nehemiah;
        if (!N || typeof N.login !== 'function') {
          errBox.textContent = 'Sign-in is unavailable right now.';
          _setLoading(false);
          return;
        }
        // Nehemiah.login(email, passcode) — two separate args; throws on failure
        const session = await N.login(email, passcode);
        close({ ok: true, profile: (session && session.profile) || null });
      } catch (err) {
        _setLoading(false);
        errBox.textContent = err && err.message ? err.message : 'That didn\u2019t work. Check your details.';
      }
    });

    document.body.appendChild(root);
    setTimeout(() => form.querySelector('#gc-email').focus(), 30);

    root.querySelector('[data-act="request-access"]')?.addEventListener('click', () => {
      window.open('grow-public.html?signup=1', '_self');
    });
  });
}
