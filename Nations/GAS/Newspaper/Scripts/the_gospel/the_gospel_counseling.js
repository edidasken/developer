/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · COUNSELING — Biblical counsel for ordinary trials.
   "Cast all your anxiety on him, because he cares for you." — 1 Peter 5:7
   ══════════════════════════════════════════════════════════════════════════════ */

import {
  esc, emptyState, loadingCards,
  bibleLink, helpButton, wireHelp,
} from './the_gospel_shared.js';

export const name        = 'the_gospel_counseling';
export const title       = 'Counseling';
export const description = 'Biblical counsel for the trials we all face — anxiety, grief, marriage, addiction, parenting, and more.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.66l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21l8.84-8.62a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
export const accent      = '#16a34a';

// Map Tailwind palette names (and other casual color words used in the
// counseling bundle) to readable hex values that have sufficient contrast on
// a light background. Anything else is returned as-is so explicit hex values
// in the data still work. Unknown / pale CSS color words (cyan, yellow, lime,
// aqua, etc.) are normalized so they never render as unreadable neon.
const _COLOR_MAP = {
  // Tailwind 600/700-ish — accessible on white
  slate:   '#475569',
  gray:    '#4b5563',
  zinc:    '#52525b',
  stone:   '#57534e',
  red:     '#dc2626',
  orange:  '#ea580c',
  amber:   '#b45309',
  yellow:  '#a16207',
  lime:    '#4d7c0f',
  green:   '#16a34a',
  emerald: '#059669',
  teal:    '#0f766e',
  cyan:    '#0e7490',
  sky:     '#0369a1',
  blue:    '#2563eb',
  indigo:  '#4f46e5',
  violet:  '#7c3aed',
  purple:  '#9333ea',
  fuchsia: '#c026d3',
  pink:    '#db2777',
  rose:    '#e11d48',
  // Plain CSS color words that are too pale on white
  aqua:    '#0e7490',
  gold:    '#b45309',
  silver:  '#6b7280',
};

function _safeColor(c) {
  if (!c) return accent;
  const s = String(c).trim();
  if (!s) return accent;
  // Honor explicit hex / rgb / hsl / var(--…) / CSS custom values as-is.
  if (/^(#|rgb|hsl|var\()/i.test(s)) return s;
  const key = s.toLowerCase();
  return _COLOR_MAP[key] || s;
}

/* ─── Per-topic SVG icons (Lucide-quality, 24×24 stroke) ──────────────────── */
const ICONS = {
  abuse:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  addiction:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  aging:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>`,
  anger:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  anxiety:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  bitterness:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
  burnout:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="16" height="10" rx="1"/><path d="M22 11v2"/><line x1="6" y1="12" x2="9" y2="12"/></svg>`,
  discipline:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14 5-3 3 2 7-7-3 3-3"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  conflict:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3-5 5 5 5"/><path d="M3 8h13a5 5 0 0 1 0 10h-1"/><path d="m16 21 5-5-5-5"/></svg>`,
  contentment:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  decision:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  depression:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 19v2M12 19v2M16 19v2"/></svg>`,
  doubt:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  envy:          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  fearofman:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  finances:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  forgiveness:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="m9 12 2 2 4-4"/></svg>`,
  gluttony:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  gossip:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  grief:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 15s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  hypocrisy:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a5 5 0 0 0 5 5 8 8 0 0 1 10 0 5 5 0 0 0 5-5V7h-5a8 8 0 0 0-10 0H2z"/></svg>`,
  identity:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`,
  idolatry:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  injustice:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21H17M12 3v18M3.5 8h5M13.5 8h5"/></svg>`,
  jealousy:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  legalism:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 3H8.5a2.5 2.5 0 0 0 0 5H12"/></svg>`,
  loneliness:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  deceit:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  marriage:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>`,
  parenting:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="19" cy="7" r="2"/><path d="M19 9v3m0 3h.01"/></svg>`,
  pastoralcare:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.66l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21l8.84-8.62a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  patience:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  perfectionism: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  pride:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="m3 9 4 2 5-7 5 7 4-2-2 11H5L3 9z"/></svg>`,
  purity:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`,
  authority:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
  rejection:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/></svg>`,
  selfharm:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  shame:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  singleness:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M8 21a4 4 0 1 1 8 0"/></svg>`,
  sloth:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  spiritualabuse:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  suffering:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  suicide:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>`,
  trauma:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  trusting:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/><circle cx="12" cy="12" r="4"/></svg>`,
  vanity:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.45 2.9L16.9 6.6l-2.2 2.15.52 3.02L12 10.25l-3.22 1.52.52-3.02L7.1 6.6l3.45-.7L12 3z"/><path d="M5.5 18l1.05 2.1 2.32-.47-.47 2.32L10.5 23l-1.5-2H15l-1.5 2 2.1-1.05-.47-2.32 2.32.47L18.5 18H5.5z"/></svg>`,
  commitments:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  work:          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  worldliness:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
};

/* ─── Bible.com ESV link builder (version 59 = ESV) ─────────────────────── */
const _USFM = {
  genesis:'GEN',gen:'GEN',exodus:'EXO',exo:'EXO',ex:'EXO',leviticus:'LEV',lev:'LEV',
  numbers:'NUM',num:'NUM',deuteronomy:'DEU',deu:'DEU',deut:'DEU',joshua:'JOS',jos:'JOS',
  josh:'JOS',judges:'JDG',judg:'JDG',ruth:'RUT',rut:'RUT',
  '1 samuel':'1SA','1sa':'1SA','1sam':'1SA','2 samuel':'2SA','2sa':'2SA','2sam':'2SA',
  '1 kings':'1KI','1ki':'1KI','1kgs':'1KI','2 kings':'2KI','2ki':'2KI','2kgs':'2KI',
  '1 chronicles':'1CH','1ch':'1CH','1chr':'1CH','2 chronicles':'2CH','2ch':'2CH','2chr':'2CH',
  ezra:'EZR',ezr:'EZR',nehemiah:'NEH',neh:'NEH',esther:'EST',est:'EST',job:'JOB',
  psalm:'PSA',psalms:'PSA',psa:'PSA',ps:'PSA',proverbs:'PRO',prov:'PRO',pro:'PRO',
  ecclesiastes:'ECC',ecc:'ECC',eccl:'ECC','song of solomon':'SNG','song of songs':'SNG',
  song:'SNG',sos:'SNG',isaiah:'ISA',isa:'ISA',jeremiah:'JER',jer:'JER',
  lamentations:'LAM',lam:'LAM',ezekiel:'EZK',ezek:'EZK',ezk:'EZK',daniel:'DAN',dan:'DAN',
  hosea:'HOS',hos:'HOS',joel:'JOL',jol:'JOL',amos:'AMO',amo:'AMO',obadiah:'OBA',oba:'OBA',
  jonah:'JON',jon:'JON',micah:'MIC',mic:'MIC',nahum:'NAM',nah:'NAM',nam:'NAM',
  habakkuk:'HAB',hab:'HAB',zephaniah:'ZEP',zeph:'ZEP',zep:'ZEP',haggai:'HAG',hag:'HAG',
  zechariah:'ZEC',zech:'ZEC',zec:'ZEC',malachi:'MAL',mal:'MAL',
  matthew:'MAT',matt:'MAT',mat:'MAT',mark:'MRK',mrk:'MRK',mk:'MRK',luke:'LUK',luk:'LUK',
  lk:'LUK',john:'JHN',jhn:'JHN',jn:'JHN',acts:'ACT',act:'ACT',romans:'ROM',rom:'ROM',
  '1 corinthians':'1CO','1co':'1CO','1cor':'1CO','2 corinthians':'2CO','2co':'2CO','2cor':'2CO',
  galatians:'GAL',gal:'GAL',ephesians:'EPH',eph:'EPH',philippians:'PHP',phil:'PHP',php:'PHP',
  colossians:'COL',col:'COL','1 thessalonians':'1TH','1th':'1TH','1thes':'1TH',
  '2 thessalonians':'2TH','2th':'2TH','2thes':'2TH','1 timothy':'1TI','1ti':'1TI','1tim':'1TI',
  '2 timothy':'2TI','2ti':'2TI','2tim':'2TI',titus:'TIT',tit:'TIT',philemon:'PHM',phm:'PHM',
  hebrews:'HEB',heb:'HEB',james:'JAS',jas:'JAS','1 peter':'1PE','1pe':'1PE','1pet':'1PE',
  '2 peter':'2PE','2pe':'2PE','2pet':'2PE','1 john':'1JN','1jn':'1JN','1joh':'1JN',
  '2 john':'2JN','2jn':'2JN','2joh':'2JN','3 john':'3JN','3jn':'3JN','3joh':'3JN',
  jude:'JUD',jud:'JUD',revelation:'REV',rev:'REV',
};
function _bibleComUrl(ref) {
  if (!ref) return null;
  const m = ref.trim().match(/^(\d\s+)?([A-Za-z ]+?)\s+(\d+):(\d+)(?:-\d+)?$/);
  if (!m) return null;
  const prefix  = (m[1] || '').trim();
  const bookRaw = (prefix ? prefix + ' ' + m[2] : m[2]).trim().toLowerCase();
  const code    = _USFM[bookRaw];
  if (!code) return null;
  return `https://www.bible.com/bible/59/${code}.${m[3]}.${m[4]}.ESV`;
}

const _cache = {};      // id → full doc
let _stubs   = [];      // catalog stubs

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="counseling">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <input type="search" class="grow-search" data-bind="search" placeholder="Search topics…" />
      <div class="grow-grid grow-grid--counseling" data-bind="grid">${loadingCards(6)}</div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  const search = root.querySelector('[data-bind="search"]');
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase().trim();
      root.querySelectorAll('.coun-card').forEach((el) => {
        const hay = (el.dataset.search || '').toLowerCase();
        el.style.display = !q || hay.includes(q) ? '' : 'none';
      });
    });
  }
  return () => {};
}

async function _load(root) {
  const grid = root.querySelector('[data-bind="grid"]');

  // Load from static bundle (regenerated from Firestore via export_counseling_to_js.py)
  _stubs = [];
  try {
    const mod = await import('../../Data/counseling.js');
    const arr = mod.default || [];
    arr.forEach((d) => {
      const id = d._id || d.id || d.topicId;
      if (!id) return;
      _cache[id] = d;
      _stubs.push({
        id,
        title: d.title || d.Title || id,
        icon:  ICONS[id] || d.icon  || d.Icon  || '🌿',
        color: _safeColor(d.color || d.Color || accent),
      });
    });
  } catch (e) {
    console.error('[gospel/counseling] static bundle failed:', e);
  }

  // Fallback: try UpperRoom (authenticated FlockOS context)
  if (!_stubs.length && typeof UpperRoom !== 'undefined' && typeof UpperRoom.listAppContent === 'function') {
    try {
      const rows = await UpperRoom.listAppContent('counseling');
      (rows || []).forEach((d) => {
        const id = d._id || d.id || d.topicId;
        if (!id) return;
        _cache[id] = d;
        _stubs.push({
          id,
          title: d.title || d.Title || id,
          icon:  ICONS[id] || d.icon  || d.Icon  || '🌿',
          color: _safeColor(d.color || d.Color || accent),
        });
      });
    } catch (e) {
      console.error('[gospel/counseling] UpperRoom fallback failed:', e);
    }
  }

  if (!_stubs.length) {
    grid.innerHTML = emptyState({ icon: '💚', title: 'Counseling resources coming soon', body: 'Biblical counseling wisdom and protocols will appear here.' });
    return;
  }

  grid.innerHTML = _stubs.map(_card).join('');
  grid.querySelectorAll('.coun-card').forEach((el) => {
    el.addEventListener('click', (ev) => {
      // Ignore clicks inside the open body (so links/buttons work normally)
      if (ev.target.closest('.coun-card-body')) return;
      _toggle(el, el.dataset.id);
    });
  });
}

function _card(s) {
  const safeTitle = esc(s.title);
  const item      = _cache[s.id] || {};
  const rawDef    = (item.Definition || item.definition || '').trim();
  const teaser    = rawDef ? esc(rawDef.length > 92 ? rawDef.substring(0, 90) + '\u2026' : rawDef) : '';
  const chevSvg   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  return /* html */`
    <div class="grow-card grow-card--counsel coun-card"
         data-id="${esc(s.id)}"
         data-search="${safeTitle.toLowerCase()}"
         style="--grow-accent:${esc(s.color)}; cursor:pointer;">
      <div class="coun-card-head">
        <div class="coun-icon-badge" style="background:color-mix(in srgb,${esc(s.color)} 12%,transparent); color:${esc(s.color)}">
          ${String(s.icon).trimStart().startsWith('<svg') ? `<span class="coun-icon-svg" aria-hidden="true">${s.icon}</span>` : `<span class="coun-icon-emoji" aria-hidden="true">${esc(s.icon)}</span>`}
        </div>
        <div class="coun-card-meta-col">
          <h3 class="grow-card-title">${safeTitle}</h3>
          ${teaser ? `<p class="coun-card-teaser">${teaser}</p>` : ''}
        </div>
        <span class="coun-card-chevron" aria-hidden="true">${chevSvg}</span>
      </div>
      <div class="coun-card-body"></div>
    </div>
  `;
}

async function _toggle(cardEl, id) {
  const body = cardEl.querySelector('.coun-card-body');
  if (!body) return;

  if (cardEl.classList.contains('is-open')) {
    body.style.display = 'none';
    cardEl.classList.remove('is-open');
    return;
  }

  // Close any other open card first (so only one is full-width at a time)
  cardEl.parentElement.querySelectorAll('.coun-card.is-open').forEach((other) => {
    if (other === cardEl) return;
    other.classList.remove('is-open');
    const ob = other.querySelector('.coun-card-body');
    if (ob) ob.style.display = 'none';
  });
  cardEl.classList.add('is-open');
  body.style.display = 'block';

  if (!_cache[id]) {
    body.innerHTML = `<div class="grow-muted" style="color:var(--err, #c0392b); padding:8px 0;">Content not found in bundle.</div>`;
    return;
  }
  const item = _cache[id];
  if (!item) {
    body.innerHTML = `<div class="grow-muted" style="color:var(--err, #c0392b); padding:8px 0;">Could not load content.</div>`;
    return;
  }
  body.innerHTML = _detailHtml(item) + helpButton({ label: 'Send a prayer request', dataAttr: 'help-' + id });
  const stub = _stubs.find((s) => s.id === id) || {};
  wireHelp(body, () => _summary(stub, item), { category: 'Counseling: ' + (item.Title || stub.title || id), source: 'Counseling' });
}

function _detailHtml(item) {
  const color   = _safeColor(item.Color || item.color || accent);
  const def     = item.Definition || item.definition || '';
  const scrips  = _parseScriptures(item.Scriptures || item.scriptures || '');
  const steps   = _parseSteps(item.Steps || item.steps || '');
  let h = '';
  if (def) h += `<p class="grow-counsel-def">${esc(def)}</p>`;
  if (scrips.length) {
    h += `<div class="grow-counsel-section-head" style="--counsel-color:${esc(color)}"><span class="grow-counsel-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span> Scripture Foundation</div>`;
    scrips.forEach((s) => {
      h += `<div class="grow-counsel-scripture" style="--counsel-color:${esc(color)}">`;
      if (s.ref) { const _url = _bibleComUrl(s.ref); h += `<div class="grow-counsel-ref">${_url ? `<a href="${_url}" target="_blank" rel="noopener noreferrer">${esc(s.ref)}</a>` : esc(s.ref)}</div>`; }
      if (s.text) h += `<div class="grow-counsel-verse">“${esc(s.text)}”</div>`;
      h += `</div>`;
    });
  }
  if (steps.length) {
    h += `<div class="grow-counsel-section-head" style="--counsel-color:${esc(color)}"><span class="grow-counsel-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26C17.81 13.47 19 11.38 19 9c0-3.87-3.13-7-7-7z"/></svg></span> Faith Response Steps</div>`;
    h += `<ol class="grow-counsel-steps">`;
    steps.forEach((s) => { h += `<li>${esc(s)}</li>`; });
    h += `</ol>`;
  }
  if (!h) h = `<p class="grow-muted" style="padding:8px 0;">No details available.</p>`;
  return h;
}

function _parseScriptures(raw) {
  if (!raw) return [];
  const parts = String(raw).split(/(?=(?:[123]?\s?[A-Z][a-z]+\s+\d+:\d+))/g);
  const out = [];
  parts.forEach((p) => {
    p = p.trim(); if (!p) return;
    const m = p.match(/^([123]?\s?[A-Za-z]+\s+\d+:\d+(?:-\d+)?):?\s*([\s\S]*)/);
    if (m) out.push({ ref: m[1].trim(), text: m[2].replace(/[.;,\s]+$/, '').trim() });
    else   out.push({ ref: '', text: p.replace(/[.;,\s]+$/, '').trim() });
  });
  return out;
}
function _parseSteps(raw) {
  if (!raw) return [];
  // Split on explicit separators first (semicolons, newlines), then on
  // sentence boundaries: a period followed by a space and a capital letter.
  // This turns the single "steps" string in the bundle (sentences joined by
  // ". ") into one numbered item per sentence — much easier to read on mobile.
  const text = String(raw).trim();
  const parts = text.split(/(?:[;\n]+|(?<=\.)\s+(?=[A-Z(]))/);
  return parts
    .map((s) => s.trim().replace(/^[-•\d.\s]+/, '').trim())
    .filter(Boolean);
}

function _summary(stub, item) {
  const title = item.Title || item.title || stub.title || 'Counseling topic';
  const def   = (item.Definition || item.definition || '').slice(0, 280);
  return `I'm working through "${title}" in the Counseling library and would value pastoral prayer and follow-up.${def ? '\n\nTopic summary: ' + def : ''}`;
}
