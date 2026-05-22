/* ══════════════════════════════════════════════════════════════════════════════
   THE WITNESS — Runtime self-checks (dev only)
   "Out of the mouth of two or three witnesses every word may be established." — 2 Cor 13:1

   Quick assertions for the new shell. Activate by visiting with ?witness=1.
   Logs a single grouped report to the console; never throws to the user.
   ══════════════════════════════════════════════════════════════════════════════ */

export async function check() {
  if (!new URLSearchParams(location.search).has('witness')) return;
  const findings = [];
  const ok       = (label) => findings.push({ ok: true,  label });
  const fail     = (label) => findings.push({ ok: false, label });

  document.getElementById('the-veil-top')   ? ok('crown mounted')   : fail('crown missing');
  document.getElementById('the-veil-side')  ? ok('pillars mounted') : fail('pillars missing');
  document.getElementById('the-holy-place') ? ok('courtyard mount slot present') : fail('courtyard slot missing');
  document.getElementById('the-veil-foot')  ? ok('hem mounted')     : fail('hem missing');

  // Vessels registered?
  ['flock-card','flock-button','flock-input','flock-skeleton','flock-modal',
   'flock-tabs','flock-toggle','flock-select','flock-progress']
    .forEach((tag) => customElements.get(tag) ? ok(`${tag} registered`) : fail(`${tag} not registered`));

  // Globals
  globalThis.flock                                ? ok('globalThis.flock present') : fail('flock global missing');
  typeof window.Nehemiah !== 'undefined'          ? ok('Nehemiah present')         : fail('Nehemiah not loaded (expected in legacy bundle)');

  /* eslint-disable no-console */
  console.groupCollapsed('🕯  the_witness  — runtime self-check');
  findings.forEach((f) => console[f.ok ? 'log' : 'warn'](`${f.ok ? '✓' : '✗'}  ${f.label}`));
  const failed = findings.filter((f) => !f.ok).length;
  console.log(`— ${findings.length - failed} ok / ${failed} failed`);
  console.groupEnd();
  /* eslint-enable no-console */
}
