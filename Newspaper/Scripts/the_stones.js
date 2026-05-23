/* ══════════════════════════════════════════════════════════════════════════════
   THE STONES — Input validators
   "And the stones shall be according to the names of the children of Israel,
    twelve, according to their names." — Exodus 28:21

   Tiny declarative validator. Rules return { ok: true } or
   { ok: false, message: 'kind, actionable copy' }. UI uses the message
   verbatim — no stack traces, no shouting.

   Public API:
     weigh(value, rule)       — single rule
     weighAll(value, rules[]) — first failure wins
     rules                    — built-in rule registry

   Built-in rules:
     required, email, phone, minLength(n), maxLength(n), pattern(re, msg),
     passcode, url, oneOf(list)
   ══════════════════════════════════════════════════════════════════════════════ */

const _rx = {
  email:  /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone:  /^[+()\-\s\d]{7,}$/,
  url:    /^https?:\/\/\S+$/i,
};

export const rules = {
  required: (v) => _has(v) ? _ok() : _no('Please fill this in.'),
  email:    (v) => !_has(v) || _rx.email.test(String(v).trim()) ? _ok() : _no('That doesn’t look like an email.'),
  phone:    (v) => !_has(v) || _rx.phone.test(String(v).trim()) ? _ok() : _no('That phone number looks off.'),
  url:      (v) => !_has(v) || _rx.url.test(String(v).trim()) ? _ok() : _no('Use a full https:// link.'),
  passcode: (v) => !_has(v) || /^\d{4,8}$/.test(String(v)) ? _ok() : _no('Use 4–8 digits.'),
  minLength: (n) => (v) => !_has(v) || String(v).length >= n ? _ok() : _no(`At least ${n} characters, please.`),
  maxLength: (n) => (v) => !_has(v) || String(v).length <= n ? _ok() : _no(`Keep it to ${n} characters or fewer.`),
  pattern:   (re, msg = 'That format isn’t accepted.') => (v) => !_has(v) || re.test(String(v)) ? _ok() : _no(msg),
  oneOf:     (list) => (v) => !_has(v) || list.includes(v) ? _ok() : _no('Pick one of the options.'),
};

export function weigh(value, rule) {
  try { return typeof rule === 'function' ? rule(value) : _ok(); }
  catch (_) { return _no('Could not validate this value.'); }
}

export function weighAll(value, list = []) {
  for (const r of list) {
    const out = weigh(value, r);
    if (!out.ok) return out;
  }
  return _ok();
}

function _has(v) { return v != null && String(v).trim() !== ''; }
function _ok()   { return { ok: true }; }
function _no(message) { return { ok: false, message }; }
