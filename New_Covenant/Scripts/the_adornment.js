/* ══════════════════════════════════════════════════════════════════════════════
   THE ADORNMENT — Theme controller (New Covenant redesign)
   "Strength and honour are her clothing." — Proverbs 31:25

   Owns theme selection for the new shell. New Covenant has ONE theme — its own
   fixed design palette defined in new_covenant.css. The theme selector here
   controls the legacy AG component token set (for FlockChat, ATOG, etc.),
   which live inside new_covenant.css (merged from american_garments.css).
   Themes are applied via attribute on <html>:

       <html data-theme="light">     (default)
       <html data-theme="dark">
       <html data-theme="garden">    (light green)
       <html data-theme="garden-dark">
       <html data-theme="violet">    (light)
       <html data-theme="violet-dark">
       <html data-theme="rose">      (light)
       <html data-theme="rose-dark">
       <html data-theme="constitution">
       <html data-theme="liberty">
       <html data-theme="ink">       (high-contrast dark)

   Persistence: localStorage key 'flock_theme'. 'auto' → respects
   prefers-color-scheme and tracks system changes live.

   Public API:
     applyTheme(name)        — set + persist + apply
     applyAuto()             — auto from system, persisted as 'auto'
     current()               — the resolved theme name
     choices()               — array of { id, label, scheme }
     init()                  — run once on boot
   ══════════════════════════════════════════════════════════════════════════════ */

const KEY = 'flock_theme';

const CHOICES = [
  { id: 'auto',           label: 'Auto (match system)',  scheme: 'auto'  },
  { id: 'light',          label: 'Light — Ocean',        scheme: 'light' },
  { id: 'dark',           label: 'Dark — Ocean',         scheme: 'dark'  },
  { id: 'garden',         label: 'Light — Garden',       scheme: 'light' },
  { id: 'garden-dark',    label: 'Dark — Garden',        scheme: 'dark'  },
  { id: 'violet',         label: 'Light — Violet',       scheme: 'light' },
  { id: 'violet-dark',    label: 'Dark — Violet',        scheme: 'dark'  },
  { id: 'rose',           label: 'Light — Rose',         scheme: 'light' },
  { id: 'rose-dark',      label: 'Dark — Rose',          scheme: 'dark'  },
  { id: 'constitution',   label: 'Light — Constitution', scheme: 'light' },
  { id: 'liberty',        label: 'Light — Liberty',      scheme: 'light' },
  { id: 'ink',            label: 'Dark — Ink (HC)',      scheme: 'dark'  },
];

let _mql = null;
let _autoListener = null;
let _resolved = 'light';

export function choices() { return CHOICES.slice(); }
export function current() { return _resolved; }

export function applyTheme(name) {
  if (!name) name = 'light';
  if (name === 'auto') return applyAuto();
  _detachAuto();
  _set(name);
  try { localStorage.setItem(KEY, name); } catch (_) {}
}

export function applyAuto() {
  _attachAuto();
  const dark = _mql && _mql.matches;
  _set(dark ? 'dark' : 'light');
  try { localStorage.setItem(KEY, 'auto'); } catch (_) {}
}

export function init() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (_) {}
  if (!saved) return applyAuto();
  if (saved === 'auto') return applyAuto();
  applyTheme(saved);
}

/* ── internals ───────────────────────────────────────────────────────────── */
function _set(name) {
  _resolved = name;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', name);
    // Keep the <meta name="theme-color"> in sync with the surface for nice
    // PWA chrome. Only adjust if a meta tag exists; never invent one.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const isDark = /dark|ink/i.test(name);
      meta.setAttribute('content', isDark ? '#0e1320' : '#ffffff');
    }
  }
}
function _attachAuto() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  if (_mql) return;
  _mql = window.matchMedia('(prefers-color-scheme: dark)');
  _autoListener = (e) => _set(e.matches ? 'dark' : 'light');
  if (_mql.addEventListener) _mql.addEventListener('change', _autoListener);
  else if (_mql.addListener) _mql.addListener(_autoListener);
}
function _detachAuto() {
  if (!_mql || !_autoListener) return;
  if (_mql.removeEventListener) _mql.removeEventListener('change', _autoListener);
  else if (_mql.removeListener) _mql.removeListener(_autoListener);
  _mql = null; _autoListener = null;
}
