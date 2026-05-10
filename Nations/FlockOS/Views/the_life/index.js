/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: THE LIFE — Pastoral Care
   "Shepherd the flock of God that is among you." — 1 Peter 5:2
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';
import { profile } from '../../Scripts/the_priesthood/index.js';
import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';
import { getWarmCareRows, subscribeOpenCareRows, setOpenCareCount } from '../../Scripts/the_life/index.js';

export const name  = 'the_life';
export const title = 'Pastoral Care';

const _TERMINAL = new Set(['resolved','closed','archived','cancelled','denied','completed','answered','inactive','deleted']);

// Cached AppConfig: SSN-style member id of the Lead Pastor (set in The Wall ▸ Admin).
// Loaded once during _loadCare; consulted by _findLeadPastor() and the new-case modal
// so cases auto-default to the configured Lead Pastor as primary caregiver.
let _lpConfigId = '';
// Cached merged member directory (GAS + Firestore). Set by _loadCare so that
// _liveCareCard's Lead-Pastor fallback can search the directory even when its
// own argument is a name-lookup Map rather than the raw array.
let _memberDirCache = [];
// Cached resolved Lead Pastor record (memory + localStorage). Once we resolve
// the LP from any directory we persist it so subsequent renders never have to
// re-resolve — even if the member directory is empty/slow on a later load.
// localStorage key includes the lpConfigId so changing the LP auto-busts it.
let _lpRecordCache = null;
const _LP_LS_KEY = 'theLife.lpRecord.v1';
function _loadLpFromLocalStorage(cfgId) {
  try {
    const raw = localStorage.getItem(_LP_LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || obj.cfgId !== cfgId || !obj.record) return null;
    return obj.record;
  } catch { return null; }
}
function _saveLpToLocalStorage(cfgId, record) {
  try { localStorage.setItem(_LP_LS_KEY, JSON.stringify({ cfgId, record })); } catch (_) {}
}
async function _loadLpConfigId() {
  try {
    const UR = window.UpperRoom;
    if (!UR || typeof UR.getAppConfig !== 'function') return '';
    const cfg = await UR.getAppConfig({ key: 'LEAD_PASTOR_MEMBER_ID' });
    _lpConfigId = String((cfg && (cfg.value || cfg.val)) || '').trim();
    // Hydrate the LP record cache from localStorage on first config load so the
    // very first paint after navigation has a name to render even before the
    // member directory finishes resolving.
    if (_lpConfigId && !_lpRecordCache) {
      const persisted = _loadLpFromLocalStorage(_lpConfigId);
      if (persisted) _lpRecordCache = persisted;
    }
    return _lpConfigId;
  } catch { return ''; }
}

/* ── Sidebar badge ────────────────────────────────────────────────────────────
   the_pillars imports `pendingCount` and `subscribeOpenCareCount` and shows
   the open-case count next to "Pastoral Care".

   Two paths:
   • pendingCount() — one-shot count. Awaits backend readiness so the badge
     appears as soon as auth completes (was returning 0 immediately on fresh
     login, leaving the badge hidden until the next 2-minute tick).
   • subscribeOpenCareCount(cb) — Firestore real-time listener. Once a backend
     is ready, the badge auto-updates whenever a case is created, resolved,
     reassigned, etc. — no cache, no off-by-one, no waiting.                 */
let _pendingCache = null;
let _pendingCachedAt = 0;
const _PENDING_TTL = 30_000; // 30 sec

// Public: invalidate the badge cache so the next pendingCount() call refetches.
// Also dispatches a global event so the_pillars can refresh badges immediately
// instead of waiting for its 2-minute tick.
export function bustPendingCache() {
  _pendingCache = null;
  _pendingCachedAt = 0;
  try { window.dispatchEvent(new CustomEvent('flockos:badges:refresh')); } catch (_) {}
}

// Wait up to `ms` for either Firestore (UpperRoom) or GAS (TheVine) to be ready.
function _awaitBackend(ms = 15_000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const check = () => {
      const UR = (typeof window !== 'undefined') ? window.UpperRoom : null;
      const V  = (typeof window !== 'undefined') ? window.TheVine   : null;
      const fsReady = !!(UR && typeof UR.isReady === 'function' && UR.isReady());
      if (fsReady || V) return resolve({ UR, V, fsReady });
      if (Date.now() - t0 >= ms) return resolve({ UR, V, fsReady: false });
      setTimeout(check, 200);
    };
    check();
  });
}

export async function pendingCount() {
  const now = Date.now();
  if (_pendingCache !== null && (now - _pendingCachedAt) < _PENDING_TTL) {
    return _pendingCache;
  }
  // Wait briefly for a backend to come online so the very first call after
  // a fresh login doesn't silently return 0 and leave the badge hidden until
  // the next 2-minute tick.
  const { V, fsReady } = await _awaitBackend(15_000);
  if (!V && !fsReady) return 0;
  const MX = buildAdapter('flock.care', V);
  try {
    const res = await MX.list({});
    const rows = Array.isArray(res) ? res : (res?.rows || res?.data || []);
    const open = rows.filter(r => {
      const s = String(r.status || r.Status || '').trim().toLowerCase();
      return !_TERMINAL.has(s);
    }).length;
    _pendingCache = open;
    _pendingCachedAt = now;
    return open;
  } catch (_) {
    return _pendingCache || 0;
  }
}

/* Real-time open-case count via Firestore onSnapshot.
   Returns an unsubscribe function. Falls back to a one-shot count + polling
   if Firestore isn't available. The_pillars subscribes once at mount so the
   badge is always accurate without polling.                                  */
export function subscribeOpenCareCount(cb) {
  if (typeof cb !== 'function') return () => {};
  let unsub = () => {};
  let cancelled = false;

  (async () => {
    const { UR, fsReady } = await _awaitBackend(15_000);
    if (cancelled) return;

    // Firestore real-time path
    if (fsReady && UR && typeof UR.careCasesRef === 'function') {
      try {
        unsub = UR.careCasesRef().onSnapshot((snap) => {
          let open = 0;
          snap.forEach((doc) => {
            const d = doc.data() || {};
            const s = String(d.status || d.Status || '').trim().toLowerCase();
            if (!_TERMINAL.has(s)) open++;
          });
          _pendingCache = open;
          _pendingCachedAt = Date.now();
          try { cb(open); } catch (_) {}
        }, (_err) => { /* swallow — fallback below covers it */ });
        return;
      } catch (_) { /* fall through to polling */ }
    }

    // Polling fallback (GAS-only deploys or Firestore listener unavailable)
    try { cb(await pendingCount()); } catch (_) {}
    const tick = setInterval(async () => {
      if (cancelled) return clearInterval(tick);
      try {
        bustPendingCache();
        cb(await pendingCount());
      } catch (_) {}
    }, 60_000);
    unsub = () => clearInterval(tick);
  })();

  return () => { cancelled = true; try { unsub(); } catch (_) {} };
}


const PRIORITY = {
  urgent: { label: 'Urgent', color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
  high:   { label: 'High',   color: '#e8a838', bg: 'rgba(232,168,56,0.13)' },
  normal: { label: 'Normal', color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)' },
  low:    { label: 'Low',    color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
};

// Canonical care types — keys match Firestore careType values exactly
const CARE_TYPES = {
  // ── Crisis & Safety ───────────────────────────────────────────────────────
  'Crisis':                         { icon: '🚨', label: 'Crisis',                         priority: 'urgent' },
  'Abuse / Domestic Violence':      { icon: '🛡️', label: 'Abuse / Domestic Violence',      priority: 'urgent' },
  // ── Medical & Physical ────────────────────────────────────────────────────
  'Hospital Visit':                 { icon: '🏥', label: 'Hospital Visit',                 priority: 'urgent' },
  'Medical':                        { icon: '🩺', label: 'Medical',                        priority: 'high'   },
  'Terminal Illness / End of Life': { icon: '🕯️', label: 'Terminal Illness / End of Life', priority: 'high'   },
  'Elder Care':                     { icon: '🧓', label: 'Elder Care',                     priority: 'high'   },
  // ── Grief & Loss ──────────────────────────────────────────────────────────
  'Grief':                          { icon: '🤍', label: 'Grief',                          priority: 'high'   },
  'Pregnancy & Infant Loss':        { icon: '🕊️', label: 'Pregnancy & Infant Loss',        priority: 'high'   },
  // ── Relationships ─────────────────────────────────────────────────────────
  'Marriage':                       { icon: '💍', label: 'Marriage',                       priority: 'normal' },
  'Pre-Marriage':                   { icon: '💑', label: 'Pre-Marriage',                   priority: 'normal' },
  'Family':                         { icon: '👨‍👩‍👧', label: 'Family',                          priority: 'normal' },
  // ── Addiction & Recovery ─────────────────────────────────────────────────
  'Addiction':                      { icon: '🔗', label: 'Addiction',                      priority: 'high'   },
  'Pornography / Sexual Addiction': { icon: '🔒', label: 'Pornography / Sexual Addiction', priority: 'high'   },
  // ── Mental & Emotional Health ─────────────────────────────────────────────
  'Mental Health':                  { icon: '🧠', label: 'Mental Health',                  priority: 'normal' },
  'Counseling':                     { icon: '💬', label: 'Counseling',                     priority: 'normal' },
  // ── Spiritual Growth & Discipleship ─────────────────────────────────────
  'New Believer':                   { icon: '✨', label: 'New Believer',                   priority: 'normal' },
  'New Member Integration':         { icon: '🤝', label: 'New Member Integration',         priority: 'normal' },
  'Discipleship':                   { icon: '📚', label: 'Discipleship',                   priority: 'low'    },
  'Shepherding':                    { icon: '🐑', label: 'Shepherding',                    priority: 'low'    },
  'Restoration':                    { icon: '🔄', label: 'Restoration',                    priority: 'high'   },
  // ── Life Situations ───────────────────────────────────────────────────────
  'Financial':                      { icon: '💰', label: 'Financial',                      priority: 'normal' },
  'Immigration / Deportation':      { icon: '✈️', label: 'Immigration / Deportation',      priority: 'high'   },
  'Incarceration & Re-Entry':       { icon: '🔑', label: 'Incarceration & Re-Entry',       priority: 'high'   },
  'Gender Identity / Sexuality':    { icon: '✝️', label: 'Gender Identity / Sexuality',    priority: 'normal' },
  // ── General ───────────────────────────────────────────────────────────────
  'Prayer Request':                 { icon: '🙏', label: 'Prayer Request',                 priority: 'normal' },
  'Follow-Up':                      { icon: '📞', label: 'Follow-Up',                      priority: 'normal' },
  'Life Milestone':                 { icon: '🎉', label: 'Life Milestone',                 priority: 'normal' },
  'Other':                          { icon: '🫱', label: 'Other',                          priority: 'normal' },
  // ── Backward-compat aliases (old camelCase keys) ──────────────────────────
  prayer:     { icon: '🙏', label: 'Prayer Request',   priority: 'normal' },
  visit:      { icon: '🏥', label: 'Hospital Visit',   priority: 'urgent' },
  followup:   { icon: '📞', label: 'Follow-Up',        priority: 'normal' },
  grief:      { icon: '🤍', label: 'Grief',            priority: 'high'   },
  counseling: { icon: '💬', label: 'Counseling',       priority: 'normal' },
  welcome:    { icon: '✨', label: 'New Believer',     priority: 'normal' },
  milestone:  { icon: '🎉', label: 'Life Milestone',  priority: 'normal' },
};

// Workflow guide config per care type — stages, notes template, watchFor, closureChecklist
const _SEP = '────────────────────────────────';
const CARE_CFG = {
  'Crisis': {
    color: '#c94c4c',
    stages: [
      { t: 'Stage 1 — Immediate Response',  d: 'Contact within hours. Confirm physical safety. Never leave a crisis unacknowledged.' },
      { t: 'Stage 2 — Safety Assessment',   d: 'Danger? Self-harm? Housing secure? Children safe? If yes → involve authorities. Document everything.' },
      { t: 'Stage 3 — Resource Connection', d: 'Connect to: 988 Lifeline, DV shelter, ER, or housing agency. The church walks alongside — it does not replace professional help.' },
      { t: 'Stage 4 — Stabilization',       d: 'Daily check-ins until stable. Log every contact. Assign secondary caregiver. No single point of failure.' },
      { t: 'Stage 5 — Transition',          d: 'Once stable: convert to Counseling, Grief, Restoration, or Shepherding. Close this case.' },
    ],
    notes: `CRISIS INTAKE\n${_SEP}\nNature of Crisis:\n\n\nImmediate Safety Concerns (self-harm, danger, housing):\n\n\nPeople Involved:\n\n\n${_SEP}\nResources Contacted:\nReferrals Made:\nFollow-Up Plan:\nNext Check-In:`,
    watchFor: [
      'Escalating language: hopelessness, finality, giving away possessions',
      'Dissociation: flat affect, disconnect from reality',
      'Substance use as coping',
      'Complete isolation from all support',
      'Return to the environment or person that caused the crisis',
    ],
    closureChecklist: ['Immediate safety confirmed', 'Professional resources connected', 'Transition case opened', 'Member stable for 7+ consecutive days', 'Final pastoral note'],
  },
  'Grief': {
    color: '#9b7ec8',
    stages: [
      { t: 'Stage 1 — First Contact (24 hrs)', d: 'Reach out within 24 hours of learning of the loss. Show up — do not send a text and wait.' },
      { t: 'Stage 2 — Presence & Listening',  d: 'First visit: listen only. Do not minimize or problem-solve. Coordinate practical needs: meals, childcare, funeral logistics.' },
      { t: 'Stage 3 — Practical Support',     d: 'Activate Compassion team: meals 2 weeks, transportation, childcare. Handle memorial coordination.' },
      { t: 'Stage 4 — Ongoing Presence',      d: 'Week 1: daily. Month 1: weekly. After: bi-weekly. Grief peaks at 3–6 months — do not disappear then.' },
      { t: 'Stage 5 — Milestone Check-Ins',   d: 'Mark: 3 months, 6 months, 1 year, anniversary, first holidays. Calendar these at case creation.' },
    ],
    notes: `GRIEF INTAKE\n${_SEP}\nLoss (what / whom / when):\n\n\nRelationship to Deceased:\n\nFamily Situation:\n\n\n${_SEP}\nImmediate Practical Needs:\nSpiritual State:\nSupport System:\nNext Contact:`,
    watchFor: [
      'Isolation: declining all invitations, not attending church',
      'Complicated grief: inability to function 6+ months post-loss',
      'Self-medication: increased alcohol use, sleep medication dependence',
      'Anniversary reactions: predictable spikes around holidays, birthdays, death anniversary',
    ],
    closureChecklist: ['All milestone dates contacted', 'Member confirms readiness for closure', 'Ongoing community connection confirmed', 'Final pastoral note'],
  },
  'Marriage': {
    color: '#c47878',
    stages: [
      { t: 'Stage 1 — Initial Contact', d: 'Often one spouse reaches out first. Listen without taking sides. Affirm the goal is to help the marriage, not adjudicate it.' },
      { t: 'Stage 2 — Joint Meeting',   d: 'Meet with both spouses when safe. No ongoing work with one spouse only. Danger present → handle separately, refer professionally.' },
      { t: 'Stage 3 — Counseling Plan', d: 'Define cadence (weekly recommended). Refer professionally if no progress after 6 sessions.' },
      { t: 'Stage 4 — Sessions',        d: 'Focus on communication, covenant, Christ-centered vision. Log key themes as Interactions — not full session details.' },
      { t: 'Stage 5 — Referral if Needed', d: 'Abuse, trauma, addiction, mental health: refer professionally. Coordinate — do not abandon the couple.' },
      { t: 'Stage 6 — Close & Follow-Up',  d: 'Resolved: close the case. Schedule 3- and 6-month check-ins. Marriage is discipleship, not a problem to fix.' },
    ],
    notes: `MARRIAGE INTAKE (CONFIDENTIAL)\n${_SEP}\nPresenting Issue:\n\n\nSpouse 1 Perspective:\n\n\nSpouse 2 Perspective:\n\n\nHow long has this been a struggle:\n\n${_SEP}\nChildren involved: YES / NO\nPrior counseling: YES / NO\nBoth willing to engage: YES / NO\nSession Cadence:\nReferral Needed:`,
    watchFor: [
      'One spouse disengaging from the process',
      'Escalation of conflict between sessions',
      'Disclosure of infidelity during counseling',
      'Signs of domestic violence surfacing (activate DV protocol)',
    ],
    closureChecklist: ['Both spouses agree care is no longer needed', 'DV screening completed at intake', '3-month and 6-month check-ins scheduled', 'Final pastoral note'],
  },
  'Pre-Marriage': {
    color: '#c47878',
    stages: [
      { t: 'Stage 1 — Engagement Contact',      d: 'Contact within 1 week of learning of the engagement. Frame it as a gift: "We want to help you both start well."' },
      { t: 'Stage 2 — Initial Assessment',      d: 'Meet individually with each person first. Assess: family of origin, communication, conflict history, finances, faith alignment. Consider PREPARE/ENRICH.' },
      { t: 'Stage 3 — Structured Preparation',  d: '6 sessions minimum: (1) Covenant & Commitment, (2) Communication & Conflict, (3) Family of Origin, (4) Finances, (5) Roles & Expectations, (6) Faith & Spiritual Life.' },
      { t: 'Stage 4 — Pre-Wedding Meeting',     d: 'Within 30 days of the wedding. Ceremony content, Scripture. Ask both: "Is there anything on your heart as you enter this covenant?" Pray together.' },
      { t: 'Stage 5 — Post-Wedding Follow-Up',  d: 'Check in at 3 months, 6 months, and 1 year. These contacts are the bridge to the Marriage workflow if ever needed.' },
    ],
    notes: `PRE-MARRIAGE INTAKE\n${_SEP}\nWedding Date:\n\nSpouse 1 Name:\n\nSpouse 2 Name:\n\nPrior Marriage (either): YES / NO\nChildren from Prior Relationship: YES / NO\n\n${_SEP}\nAssessment Tool Used:\nMentor Couple Assigned:\nSessions Completed:\nKey Topics / Themes:\nPost-Wedding Check-In Dates:`,
    closureChecklist: ['All 6 preparation sessions completed', 'Pre-wedding meeting conducted', 'Post-wedding follow-ups scheduled (3, 6, 12 months)', 'Final pastoral note'],
  },
  'Addiction': {
    color: '#d4853a',
    stages: [
      { t: 'Stage 1 — Confidential Intake',     d: 'Zero condemnation. Be explicit about who will and will not know. This posture determines whether they stay or flee.' },
      { t: 'Stage 2 — Assessment',              d: 'Substance/behavior, duration, family awareness, professional support, safety risks (some withdrawal needs medical care).' },
      { t: 'Stage 3 — Accountability',          d: 'Assign an accountability partner (same-sex, mature believer). Weekly minimum check-ins. Document triggers in Notes.' },
      { t: 'Stage 4 — Professional Referral',   d: 'AA/NA/Celebrate Recovery, licensed counselor, or treatment program. The church walks alongside — it does not replace.' },
      { t: 'Stage 5 — Ongoing Through Relapse', d: 'Relapse is common. Do not withdraw. Recommit to the plan. Celebrate milestones: 30d, 90d, 6mo, 1yr.' },
      { t: 'Stage 6 — Long-Term Follow-Up',     d: 'Recovery is measured in years. Maintain connection even in stable sobriety. New identity in Christ is the goal.' },
    ],
    notes: `ADDICTION INTAKE (CONFIDENTIAL)\n${_SEP}\nSubstance / Behavior:\n\nDuration / History:\n\nCurrent Status (active / recovery / relapse):\n\nFamily Awareness: YES / NO\n\n${_SEP}\nAccountability Partner:\nProfessional Support (AA / therapist / program):\nChurch Support Plan:\nNext Check-In:`,
    watchFor: [
      'Return to previous social environments (people, places, patterns)',
      'Sudden improvement in mood without explanation',
      'Financial irregularities: unexplained spending, borrowing',
      'Missed accountability check-ins',
      'Stopping professional treatment without consultation',
    ],
    closureChecklist: ['Accountability partner active', 'Professional support connected', '12 months of sustained recovery', 'Transition to Shepherding', 'Final pastoral note'],
  },
  'Pornography / Sexual Addiction': {
    color: '#d4853a',
    stages: [
      { t: 'Stage 1 — Disclosure',               d: 'Receive without shock or lecture. Same-sex pastor/elder responds. Say: "Thank you. This took courage. You are not alone." Establish strict confidentiality.' },
      { t: 'Stage 2 — Assessment',               d: 'Duration, frequency, triggers, escalation, spouse awareness. If married: do not advise spouse disclosure — refer to licensed therapist trained in sexual addiction.' },
      { t: 'Stage 3 — Accountability Structure', d: 'Assign same-sex accountability partner. Install accountability software (Covenant Eyes). Weekly check-ins with specific questions.' },
      { t: 'Stage 4 — Professional Referral',    d: 'CSAT (findacsat.com), Pure Desire Ministries, Celebrate Recovery. If married: refer spouse to betrayal trauma therapist.' },
      { t: 'Stage 5 — Recovery & Relapse',       d: 'Contact within 24 hours of relapse. Lead with grace, not shame. Celebrate: 30d, 90d, 6mo, 1yr.' },
      { t: 'Stage 6 — Long-Term Freedom',        d: '12- and 24-month formal reviews. Invite them to give back as accountability partner. Close → Shepherding.' },
    ],
    notes: `SEXUAL ADDICTION INTAKE (CONFIDENTIAL)\n${_SEP}\nDuration / History:\n\nPattern / Frequency:\n\nEscalation (has it changed over time): YES / NO\n\nSpouse / Family Aware: YES / NO\nProfessional Help in Place: YES / NO\n\n${_SEP}\nAccountability Partner Assigned:\nAccountability Software Installed: YES / NO\nReferral Made:\nMarriage Case Opened: YES / NO\nNext Check-In:`,
    watchFor: [
      'Accountability software disabled or bypassed',
      'Spouse betrayal trauma symptoms',
      'Escalation in behavior pattern over time',
      'Isolation from accountability partner or community',
    ],
    closureChecklist: ['Accountability partner active', 'Software installed and reporting', 'Professional referral made', '12- and 24-month reviews completed', 'Transition to Shepherding'],
  },
  'Hospital Visit': {
    color: '#5b9bd5',
    stages: [
      { t: 'Stage 1 — Contact Within 24 Hours', d: 'Never let a member be hospitalized without pastoral contact in 24 hours. Call if you cannot visit immediately.' },
      { t: 'Stage 2 — Visit & Pray',            d: 'Show up. Read Scripture (Psalm 23, Psalm 46, John 14). Pray specifically. Brief is fine — the point is presence.' },
      { t: 'Stage 3 — Follow the Family',       d: 'The waiting room needs pastoral care too. A call to the spouse or adult child carrying the weight matters.' },
      { t: 'Stage 4 — Discharge & Recovery',    d: 'Follow up within 48 hours of discharge. Arrange meals or help. Check in weekly until clearly recovering.' },
      { t: 'Stage 5 — Close or Transition',     d: 'Full recovery → resolve. Long-term illness → Elder Care or Shepherding. Member passes → open Grief case for family.' },
    ],
    notes: `HOSPITAL VISIT\n${_SEP}\nHospital / Facility:\n\nRoom / Unit:\n\nNature of Illness / Procedure:\n\nFamily Present:\n\n${_SEP}\nVisit Date:\nPrayer Topics:\nExpected Discharge:\nFamily Needs:`,
    closureChecklist: ['Post-discharge follow-up completed', 'Practical needs addressed (meals, transport)', 'If long-term: transitioned to appropriate care type', 'If member passed: Grief case opened for family', 'Final pastoral note'],
  },
  'Medical': {
    color: '#3d9fbf',
    stages: [
      { t: 'Stage 1 — Initial Notification',    d: 'Contact within 48 hours of learning of the diagnosis. Do not wait for them to reach out — the silence of the church in a health crisis is a wound that lasts.' },
      { t: 'Stage 2 — Pastoral Visit & Prayer', d: 'Arrange an in-person or video visit. Listen before advising. Read Scripture (Psalm 23, 103, Romans 8:18-28). Pray specifically.' },
      { t: 'Stage 3 — Practical Support',       d: 'Activate Compassion team: meals during treatment, transportation to appointments, household and childcare help.' },
      { t: 'Stage 4 — Family Coordination',     d: 'Identify the primary family caregiver. They are carrying weight too. Care for the caregiver.' },
      { t: 'Stage 5 — Care Through Treatment',  d: 'Track treatment phases. Reach out before and after each major procedure. Do not disappear between appointments.' },
      { t: 'Stage 6 — Close or Transition',     d: 'Full recovery → celebrate and resolve. Chronic/terminal → Elder Care. Member passes → open Grief case for family.' },
    ],
    notes: `MEDICAL CARE INTAKE\n${_SEP}\nDiagnosis / Medical Situation:\n\nTreatment Plan (surgery / chemo / procedure / other):\n\nExpected Timeline:\n\n\n${_SEP}\nPrimary Family Contact & Relationship:\n\nPractical Needs (meals / transport / household / childcare):\n\nSpiritual State:\n\nPrayer Requests:\n\nNext Contact:`,
    watchFor: [
      'Increased isolation during treatment phases',
      'Spiritual drift or questioning God during prolonged illness',
      'Caregiver breakdown: family member carrying primary burden showing exhaustion',
      'Depression developing alongside the physical condition',
    ],
    closureChecklist: ['Treatment phase documented', 'Caregiver fatigue assessed', 'If terminal: transitioned to Terminal Illness workflow', 'If member passed: Grief case opened', 'Final pastoral note'],
  },
  'Terminal Illness / End of Life': {
    color: '#9b7ec8',
    stages: [
      { t: 'Stage 1 — Receiving the News',   d: 'Contact within 24 hours. Lead with presence and prayer. Do not say "God will heal you" unless they say it first. Ask about the family.' },
      { t: 'Stage 2 — Walking the Journey',  d: 'Weekly visits minimum. Pray specifically. Walk through over time: their life story, what they believe about what comes next, forgiveness, legacy.' },
      { t: 'Stage 3 — Family Care',          d: 'Family is in anticipatory grief — name it and tend to it. Separate pastoral care for the primary caregiver. Partner with hospice team.' },
      { t: 'Stage 4 — Active Dying Phase',   d: 'Pastor personally reachable at all hours. Be present in the vigil if wanted. Read Scripture aloud — hearing is often the last sense to fade.' },
      { t: 'Stage 5 — Immediate Family Care', d: 'Remain with the family after death. Activate the Grief workflow. Coordinate memorial/funeral. Personal contact every week for the first 30 days.' },
    ],
    notes: `TERMINAL ILLNESS INTAKE\n${_SEP}\nDiagnosis:\n\nPrognosis / Timeline:\n\nHospice Enrolled: YES / NO\nHospice Team:\n\nFamily Situation:\n\n\n${_SEP}\nPrimary Family Caregiver:\nAdvance Directive in Place: YES / NO\nSpiritual State:\nKey Topics to Walk Through:\nNext Visit:`,
    watchFor: [
      'Family conflict over end-of-life decisions',
      'Patient expressing unresolved guilt, fear, or anger',
      'Caregiver collapse: primary family member breaking down',
      'Hospice team and church team working in isolation — coordinate intentionally',
    ],
    closureChecklist: ['Advance directive conversation completed', 'Hospice team coordinated', 'At passing: Grief case opened for family', 'Memorial/funeral coordination completed', '30-day post-loss plan active'],
  },
  'Elder Care': {
    color: '#d4b870',
    stages: [
      { t: 'Stage 1 — Referral',               d: 'Case opened within 24 hrs. Notify lead pastor.' },
      { t: 'Stage 2 — Assessment (48 hrs)',    d: 'In-person visit. Assess: Spiritual · Physical · Practical · Relational. Document in Notes.' },
      { t: 'Stage 3 — Care Plan',              d: 'Assign Primary + Secondary Caregiver. Set visit cadence. Slot volunteers for meals, transport, companionship.' },
      { t: 'Stage 4 — Active Care',            d: 'Log every contact as an Interaction. Monthly report to pastor. Pray on every visit.' },
      { t: 'Stage 5 — Escalation',             d: 'Signs of decline → elevate to Urgent, increase visits, pastor personally attends.' },
      { t: 'Stage 6 — Transition',             d: 'Facility/hospice: visit within first week. When member passes → open Grief case for family.' },
    ],
    notes: `ELDER CARE ASSESSMENT\n${_SEP}\nSpiritual (peace, connection, foundation):\n\n\nPhysical (meals, mobility, medication, safety):\n\n\nPractical (transport, bills, home, errands):\n\n\nRelational (family involvement, isolation):\n\n\n${_SEP}\nVisit Cadence: Weekly\nFamily Contact:\nNext Review Date:`,
    watchFor: [
      'Cognitive decline: confusion, repeating questions, forgetting names',
      'Hygiene deterioration: unwashed clothing, unkempt appearance',
      'Weight loss or inability to cook',
      'Medication confusion: missed doses, double doses, expired prescriptions',
      'Fall risk: bruises, unsteady gait, clutter in walking paths',
      'Financial exploitation: unexplained withdrawals, new "friends" managing money',
    ],
    closureChecklist: ['All interactions logged', 'Family notified and connected', 'If member passed: Grief case opened for family', 'If transitioned to facility: visitation cadence established', 'Final pastoral note'],
  },
  'Mental Health': {
    color: '#7eaacc',
    stages: [
      { t: 'Stage 1 — Safe Disclosure',        d: 'Respond immediately. Assess safety first: any risk of self-harm? If yes → Crisis workflow immediately. Establish confidentiality explicitly.' },
      { t: 'Stage 2 — Understanding Situation', d: 'What is the condition? How long? In treatment? What does a hard day cost them? What role does their faith play? Do not attempt to diagnose.' },
      { t: 'Stage 3 — Pastoral Care Plan',     d: 'Assign a caregiver with emotional stability and clear boundaries. Weekly check-in texts often preferred. If not in professional care: provide a specific referral.' },
      { t: 'Stage 4 — Long-Term Presence',     d: 'Do not disappear during stable seasons. Watch for: stopping medication, increased isolation, sudden calm after despair (safety risk).' },
      { t: 'Stage 5 — Crisis Response',        d: 'Suicidal ideation: do not leave them alone. Call 988 together if needed. Activate Crisis workflow. Keep this case open for the ongoing journey.' },
      { t: 'Stage 6 — Long-Term Review',       d: 'Formal review at 6 and 12 months. Some cases remain open indefinitely. When thriving: close → convert to Shepherding.' },
    ],
    notes: `MENTAL HEALTH INTAKE (CONFIDENTIAL)\n${_SEP}\nPresenting Condition (as member describes it):\n\nDuration:\n\nCurrently in Professional Treatment: YES / NO\nTherapist / Psychiatrist:\n\nMedication in Place: YES / NO\n\n\n${_SEP}\nSafety Concern: YES / NO — If YES: Crisis workflow activated\nCaregiver Assigned:\nContact Cadence:\nReferral Made:\nNext Contact:`,
    watchFor: [
      'Medication non-compliance without professional guidance',
      'Increased isolation during stable seasons',
      'Sudden calm after prolonged distress (may indicate suicidal decision — activate Crisis)',
      'Caregiver compassion fatigue: mental health accompaniment is emotionally heavy long-term work',
    ],
    closureChecklist: ['Member stable and in ongoing professional care', '6-month and 12-month reviews completed', 'No active safety concerns', 'Transitioned to Shepherding', 'Final pastoral note'],
  },
  'Counseling': {
    color: '#5b9bd5',
    stages: [
      { t: 'Stage 1 — Intake',               d: 'Understand the presenting issue and goals. Is this within pastoral scope or does it need a licensed professional from the start?' },
      { t: 'Stage 2 — First Session: Listen', d: 'Entirely listening. Resist the urge to fix. Help them articulate the root, not just the symptom.' },
      { t: 'Stage 3 — Ongoing Sessions',      d: 'Weekly or bi-weekly. Bring Scripture naturally. Assign homework and follow up on it.' },
      { t: 'Stage 4 — Refer if Needed',       d: 'Mental illness, trauma, addiction, suicidal ideation, DV: refer professionally. Coordinate both tracks.' },
      { t: 'Stage 5 — Close',                 d: 'Presenting issue resolved or tools in hand: close with prayer, reflection, and a 30-day check-in.' },
    ],
    notes: `COUNSELING INTAKE\n${_SEP}\nPresenting Issue:\n\n\nBackground:\n\nGoals for Counseling:\n\n\n${_SEP}\nSession Cadence:\nReferral Needed: YES / NO\nReferral Resource:\nNext Session:`,
    watchFor: [
      'Issues beyond pastoral scope being treated as pastoral counseling',
      'Dependency: member becoming emotionally reliant on the counseling relationship',
      'Stalled progress: sessions continuing without clear direction',
    ],
    closureChecklist: ['Presenting issue resolved or member has tools to continue', 'Professional referral made if clinical issues surfaced', '30-day check-in scheduled', 'Final pastoral note'],
  },
  'New Believer': {
    color: '#4caf8a',
    stages: [
      { t: 'Stage 1 — Immediate Connection',     d: 'Contact within 48 hours. Make them feel found, not processed.' },
      { t: 'Stage 2 — Assign a Mentor',           d: 'Same-sex, mature believer. Not the pastor — discipleship at the body level. Chemistry matters.' },
      { t: 'Stage 3 — Foundations (4–8 wks)',    d: 'Who is God? Jesus? The Bible, prayer, the church, sin, and grace. Structured guide. Write answers together.' },
      { t: 'Stage 4 — Community Integration',    d: 'Into a small group within 30 days. Belonging precedes behaving. Introduce them personally.' },
      { t: 'Stage 5 — Baptism Conversation',     d: 'When they understand what they believe and why: have the conversation. Milestone, not checkbox.' },
      { t: 'Stage 6 — Close & Celebrate',        d: 'At 6 months: in community, growing, serving? Celebrate and close. A sheep is in the fold.' },
    ],
    notes: `NEW BELIEVER INTAKE\n${_SEP}\nHow they came to faith:\n\n\nBackground (church history, prior faith):\n\nImmediate Questions / Concerns:\n\n\n${_SEP}\nMentor Assigned:\nFoundations Curriculum:\nSmall Group:\nBaptism Interest: YES / NO\nNext Meeting:`,
    watchFor: [
      'Isolation from the faith community within the first 90 days (highest dropout risk)',
      'Pressure from family or friends hostile to the decision',
      'Theological confusion from online sources or fringe teaching',
      'Mentor mismatch: lack of chemistry, missed meetings, fading engagement',
    ],
    closureChecklist: ['Mentor assigned and active', 'Foundations curriculum completed', 'Connected to a small group', 'Baptism conversation had', 'Final pastoral note'],
  },
  'New Member Integration': {
    color: '#4caf8a',
    stages: [
      { t: 'Stage 1 — Connection at Joining', d: 'Personal contact within 48 hours. Learn their story: background, what brought them here, what they\'re hoping for.' },
      { t: 'Stage 2 — 30 Days: Belonging',    d: 'Personal introduction to a small group within 30 days. Introduce them to 3–5 members who share something in common. Ensure the whole household is connected.' },
      { t: 'Stage 3 — 60 Days: Serving',      d: 'Conversation: where are your gifts? Make a specific invitation to a serving team — not a generic ask.' },
      { t: 'Stage 4 — 90-Day Assessment',     d: 'In a small group? At least one meaningful friendship? Connected to serving? If yes: close and celebrate. If no: identify the barrier.' },
      { t: 'Stage 5 — Transfer to Shepherding', d: 'When integrated: close this case, open a Shepherding case. Note their small group, serving role, and key relationships.' },
    ],
    notes: `NEW MEMBER INTEGRATION\n${_SEP}\nName(s):\n\nJoining Date:\n\nBackground (prior church, transfer, returning):\n\nFamily / Household Members:\n\n\n${_SEP}\nWelcome Elder / Deacon Assigned:\nSmall Group Connected: YES / NO  ► Date:\nServing Team Connected: YES / NO  ► Team:\n90-Day Assessment Date:\nNotes:`,
    watchFor: [
      'Quiet disappearance: member stops attending, no one notices for weeks',
      'Surface connection only: attending but never belonging',
      'Spouse or family left out of the integration process',
    ],
    closureChecklist: ['Connected to a small group', 'At least one meaningful friendship formed', '90-day assessment completed', 'Shepherding case opened', 'Final pastoral note'],
  },
  'Discipleship': {
    color: '#4caf8a',
    stages: [
      { t: 'Stage 1 — Match with Disciple-Maker', d: 'Same-sex, mature believer who models what the disciple needs to become. Chemistry matters — do not force a bad match.' },
      { t: 'Stage 2 — Define Goals',              d: 'What do you want to look different in 6 months? Write the goals. Undefined discipleship drifts.' },
      { t: 'Stage 3 — Regular Meetings',           d: 'Weekly is ideal. A curriculum gives structure — but the conversation, not the content, is the point.' },
      { t: 'Stage 4 — Milestone Celebration',      d: 'Mark growth moments: first Bible study completed, sharing faith, serving, baptism. Log each as an Interaction.' },
      { t: 'Stage 5 — Multiply',                   d: 'The goal is a disciple who makes disciples. When ready: identify someone younger in faith to walk with.' },
    ],
    notes: `DISCIPLESHIP PLAN\n${_SEP}\nDisciple-Maker Assigned:\n\nGoals (spiritual growth areas):\n\nCurrent Spiritual Disciplines:\n\n\n${_SEP}\nMeeting Cadence:\nCurriculum / Study:\nMilestones:\nTarget Completion:`,
    watchFor: [
      'Stalled progress: meetings happening but no growth',
      'Knowledge without obedience: studying but not applying',
      'Disciple-maker burnout: carrying too many relationships at once',
    ],
    closureChecklist: ['Goals defined at intake have been met', 'Curriculum completed', 'Multiplication conversation had', 'Final pastoral note'],
  },
  'Shepherding': {
    color: '#7eaacc',
    stages: [
      { t: 'Stage 1 — Connection',            d: 'Initiate contact. Often proactive — the member may not know they are being shepherded. Know your sheep before they need rescue.' },
      { t: 'Stage 2 — Regular Check-Ins',     d: 'Monthly minimum. Spiritual, relational, and practical state. A shepherd who only acts in crisis is not shepherding.' },
      { t: 'Stage 3 — Identify Deeper Needs', d: 'Shepherding often reveals what the member would not have initiated. Watch for withdrawal, spiritual drift, stress.' },
      { t: 'Stage 4 — Close or Escalate',     d: '3 healthy months: resolve (the relationship continues). Deeper need surfaces: convert to the appropriate care type.' },
    ],
    notes: `SHEPHERDING NOTES\n${_SEP}\nReason for case:\n\nSpiritual State:\n\nLife Circumstances:\n\n\n${_SEP}\nConnection Goal:\nVisit Cadence:\nNext Contact:`,
    watchFor: [
      'Gradual withdrawal: attendance drops, responses become shorter, engagement fades',
      'Life transitions not disclosed: job loss, health change, relational strain',
      'Spiritual drift: going through the motions without growth',
      'Case sitting idle: no Interactions logged for 60 days',
    ],
    closureChecklist: ['3 consecutive months of healthy engagement', 'No pending concerns', 'Member connected to ongoing church community', 'Final pastoral note'],
  },
  'Restoration': {
    color: '#d4a93a',
    stages: [
      { t: 'Stage 1 — Sensitive Intake',         d: 'Lead with grace. Establish the goal is restoration, not punishment. Be explicit about who will know.' },
      { t: 'Stage 2 — Understand the Situation', d: 'What happened? Who was harmed? Ongoing or past? Is repentance genuine? Legal implications?' },
      { t: 'Stage 3 — Accountability Plan',      d: 'Named elder/leader as sponsor. Weekly check-ins. Agreed-upon boundaries. Defined timeline with review points.' },
      { t: 'Stage 4 — Community Reintegration',  d: 'Gradual, not sudden. Protect the community. Those harmed must not be retraumatized. Process, not event.' },
      { t: 'Stage 5 — Long-Term Review',         d: '3- and 6-month reviews. Flourishing, serving appropriately, no new concerns → then and only then resolve.' },
    ],
    notes: `RESTORATION INTAKE (CONFIDENTIAL)\n${_SEP}\nSituation Summary:\n\n\nRepentance Indicators:\n\nPeople Affected:\n\n\n${_SEP}\nAccountability Structure:\nRestoration Steps Agreed:\nElder / Pastor Oversight:\nTimeline for Review:`,
    watchFor: [
      'Premature restoration: community pressure to "move on" before the process is complete',
      'Victim being sidelined: harmed person\'s needs overshadowed by the offender\'s restoration',
      'Legal issues quietly dropped: ensure the church does not obstruct any civil or criminal process',
    ],
    closureChecklist: ['Accountability plan completed (3–6 month minimum)', 'Formal reviews at 3 and 6 months completed', 'Victim care addressed separately (if applicable)', 'Final pastoral note'],
  },
  'Family': {
    color: '#c47878',
    stages: [
      { t: 'Stage 1 — Intake',              d: 'Who is reaching out? Who else is involved? Safety concern? The caller is often carrying weight for the whole family.' },
      { t: 'Stage 2 — Family Dynamics',     d: 'Prodigal child, estrangement, parenting struggle, blended family tension? Listen before advising.' },
      { t: 'Stage 3 — Care Plan',           d: 'Pastoral listening, practical resources (parenting class, therapy referral), or safety need? Assign caregiver and cadence.' },
      { t: 'Stage 4 — Ongoing Support',     d: 'Family situations are rarely quick. Commit to the long view. Pray specifically for the relational dynamics at play.' },
      { t: 'Stage 5 — Referral if Needed',  d: 'Family therapy for severe dysfunction; legal counsel for custody/estate; DV resources if safety is a concern.' },
    ],
    notes: `FAMILY CARE INTAKE\n${_SEP}\nPresenting Situation:\n\n\nFamily Members Involved:\n\nChildren Present: YES / NO\n\n\n${_SEP}\nKey Needs (spiritual / relational / practical):\nReferral Needed:\nFollow-Up Plan:\nNext Contact:`,
    watchFor: [
      'Safety concerns masked as "family conflict" — always assess for domestic violence',
      'Children caught in the middle of adult conflict',
      'Estrangement reinforced by church members taking sides',
    ],
    closureChecklist: ['Presenting issue addressed or stabilized', 'Professional referral made if needed', 'Safety concerns resolved', 'All affected family members offered care', 'Final pastoral note'],
  },
  'Financial': {
    color: '#4caf8a',
    stages: [
      { t: 'Stage 1 — Confidential Intake',      d: 'Financial need carries shame. Make them feel safe, not judged. Be explicit about confidentiality.' },
      { t: 'Stage 2 — Needs Assessment',         d: 'Immediate need (rent, utilities, food, medical)? Cause? One-time crisis or recurring pattern? Household size?' },
      { t: 'Stage 3 — Stewardship Counsel',      d: 'Crown Financial, Good Sense, or budget coaching. Offer this regardless of whether assistance is provided.' },
      { t: 'Stage 4 — Assistance if Applicable', d: 'Benevolence Fund: follow church policy. Document. Aid is a hand-up, not a hand-out. Connect to a stewardship plan.' },
      { t: 'Stage 5 — Follow-Up',                d: 'Check in at 30 and 90 days. Is the situation improving? Is there a trajectory toward stability?' },
    ],
    notes: `FINANCIAL CARE INTAKE (CONFIDENTIAL)\n${_SEP}\nPresenting Need:\n\nCause (job loss / medical / other):\n\nHousehold Size:\n\n\n${_SEP}\nImmediate Assistance Needed: YES / NO\nAmount / Type Requested:\nBenevolence Eligibility:\nStewardship Resources Shared:\nFollow-Up Date:`,
    watchFor: [
      'Recurring crises: repeated emergency requests may indicate addiction, exploitation, or mental health issues',
      'Benevolence dependency: assistance without a stewardship plan creating a cycle',
      'Marital strain caused by or worsened by financial stress',
    ],
    closureChecklist: ['Immediate need addressed', 'Stewardship plan offered', '30- and 90-day follow-ups completed', 'Trajectory toward stability confirmed', 'Final pastoral note'],
  },
  'Abuse / Domestic Violence': {
    color: '#c94c4c',
    stages: [
      { t: 'Stage 1 — Disclosure & Response',     d: 'Believe them. Create a private setting immediately — never in the presence of the abuser. Ask: Are you safe? Are your children safe? Do NOT contact or confront the abuser.' },
      { t: 'Stage 2 — Safety Planning',            d: 'Safe people, safe location, go-bag, documents. Refer to local DV shelter. Do not pressure a timeline — victims leave an average of 7 times before leaving for good.' },
      { t: 'Stage 3 — Sustained Pastoral Care',    d: 'Assign same-sex caregiver. Weekly contact minimum. Never place victim in a setting with the abuser without their explicit consent.' },
      { t: 'Stage 4 — Legal & Practical Support',  d: 'Accompany to court if requested. Connect to legal aid. Coordinate Compassion team: housing, meals, childcare, transport.' },
      { t: 'Stage 5 — Long-Term Care',             d: 'Healing is measured in years. Watch for re-entry into abusive relationship (no condemnation), PTSD, spiritual wounds. 6-month formal review.' },
    ],
    notes: `ABUSE / DV INTAKE (CONFIDENTIAL — DO NOT SHARE)\n${_SEP}\nNature of Abuse (physical / emotional / financial / sexual / spiritual):\n\nDuration:\n\nChildren in home: YES / NO\n\n\n${_SEP}\nImmediate Safety: SAFE / AT RISK\nShelter / Safe Location Identified:\nLegal Action Desired: YES / NO / UNSURE\nMandatory Report Filed: YES / NO / N/A\nNext Contact:`,
    watchFor: [
      'Re-entry into the abusive relationship (no condemnation — maintain care)',
      'PTSD symptoms: hypervigilance, nightmares, startle response',
      'Abuser showing up at church or using church systems to locate victim',
      'Children exhibiting behavioral changes: aggression, withdrawal, regression',
    ],
    closureChecklist: ['Victim is physically safe', 'Victim confirmed ready for closure', 'Professional support connected', 'No information accessible to the abuser', 'Shepherding case opened for ongoing oversight'],
  },
  'Immigration / Deportation': {
    color: '#5b9bd5',
    stages: [
      { t: 'Stage 1 — Confidential Disclosure',     d: 'Absolute confidentiality — immigration status disclosure can cause direct, irreversible harm. If active enforcement is underway: Crisis protocol + this workflow simultaneously.' },
      { t: 'Stage 2 — Legal Resource Connection',   d: 'Connect immediately to qualified immigration legal help (CLINIC, Immigration Advocates Network). Warn against notarios and unlicensed consultants.' },
      { t: 'Stage 3 — Practical & Safety Planning', d: 'Organize critical documents. Build family emergency plan: who cares for children, power of attorney. Compassion team: meals, transport, financial assistance.' },
      { t: 'Stage 4 — If Detention Occurs',         d: 'Contact immigration attorney immediately. Visit if facility allows. Support the family remaining at home — they are now in their own crisis.' },
      { t: 'Stage 5 — If Deportation Occurs',       d: 'Continue care for the family remaining. Maintain contact with deported member. Long-term separation care is multi-year work.' },
      { t: 'Stage 6 — Sustained Accompaniment',     d: 'Immigration situations extend for months or years. Remain present through every court date. Case review every 6 months.' },
    ],
    notes: `IMMIGRATION CARE INTAKE (CONFIDENTIAL — DO NOT DISCLOSE STATUS)\n${_SEP}\nGeneral Situation (no status details in this field — verbal only):\n\nFamily Members Affected:\n\nU.S.-Citizen Children: YES / NO\n\n\n${_SEP}\nEnforcement Action Active: YES / NO\nLegal Counsel Connected: YES / NO\nFamily Emergency Plan in Place: YES / NO\nNext Contact:`,
    closureChecklist: ['Legal counsel connected', 'Family emergency plan in place', 'All family members accounted for', 'If deportation occurred: family case remains open', '6-month review completed', 'Final pastoral note'],
  },
  'Incarceration & Re-Entry': {
    color: '#7eaacc',
    stages: [
      { t: 'Stage 1 — Arrest / Sentencing',   d: 'Contact the family immediately. Open a separate Family case for the household. Do not withdraw from the incarcerated member — the fold extends inside.' },
      { t: 'Stage 2 — Ministry Inside',       d: 'Establish visitation schedule. Send letters and cards. Ensure member has a Bible. Explore chaplaincy volunteer access.' },
      { t: 'Stage 3 — Family on the Outside', d: 'Spouse and children experience a distinct grief. Activate Compassion: meals, financial, transport.' },
      { t: 'Stage 4 — Pre-Release Planning',  d: 'Begin 60–90 days before release: housing, employment (re-entry-friendly employers), community, parole/probation terms.' },
      { t: 'Stage 5 — Re-Entry',              d: 'Be present near release day — this is the highest-risk moment. Assign accountability partner. Weekly check-ins for first 90 days.' },
      { t: 'Stage 6 — Long-Term Stability',   d: 'Keep case open 12 months minimum. Watch for return to prior environments and isolation. Close → transition to Discipleship or Shepherding.' },
    ],
    notes: `INCARCERATION INTAKE\n${_SEP}\nCurrent Status (incarcerated / pre-sentencing / re-entry):\n\nFacility / Location:\n\nExpected Release Date:\n\nFamily Members Affected:\n\n\n${_SEP}\nFamily Care Case Opened: YES / NO\nVisitation Registration Needed: YES / NO\nKey Re-Entry Barriers:\nAccountability Partner:\nNext Contact:`,
    watchFor: [
      'Return to previous relationships and environments post-release',
      'Substance use relapse during re-entry period',
      'Employment instability or inability to find re-entry-friendly work',
      'Isolation from church community after release',
    ],
    closureChecklist: ['Re-entry plan executed (housing, employment, community)', 'Accountability partner active', '12 months of stable community participation', 'Transition to Discipleship or Shepherding', 'Final pastoral note'],
  },
  'Pregnancy & Infant Loss': {
    color: '#9b7ec8',
    stages: [
      { t: 'Stage 1 — First Contact (24 hrs)',    d: 'Contact within 24 hours. Lead with presence, not words. Acknowledge the father explicitly — his grief is real and often invisible. Do NOT say: "At least it was early" or "God needed an angel."' },
      { t: 'Stage 2 — Presence & Acknowledgment', d: 'Visit in person. Ask about the baby by name if given. Activate Compassion: meals 2+ weeks, childcare, errands.' },
      { t: 'Stage 3 — Ongoing Grief Journey',     d: 'Calendar grief spikes: original due date, first Mother\'s/Father\'s Day, anniversary of loss, subsequent pregnancies.' },
      { t: 'Stage 4 — Referral & Community',      d: 'Refer to SHARE Pregnancy & Infant Loss Support (nationalshare.org). For infertility: long-term care with no defined endpoint is right.' },
      { t: 'Stage 5 — Close or Transition',       d: 'Close when family is stabilized. Leave the door open explicitly. Recurring loss or infertility: convert to Shepherding.' },
    ],
    notes: `PREGNANCY & INFANT LOSS INTAKE\n${_SEP}\nType of Loss (miscarriage / stillbirth / infant death / infertility / other):\n\nDate of Loss:\n\nOriginal Due Date (if applicable):\n\nFather / Partner Acknowledged: YES\n\n\n${_SEP}\nPractical Needs:\nSpiritual State:\nReferral Made: YES / NO\nGrief Milestone Dates Calendared: YES / NO\nNext Contact:`,
    watchFor: [
      'Isolation and withdrawal — same patterns as Grief',
      'Father/partner grief being invisible or dismissed',
      'Anniversary reactions: original due date, loss anniversary, Mother\'s/Father\'s Day',
      'Subsequent pregnancy triggering intense anxiety or fear',
    ],
    closureChecklist: ['Father/partner included throughout', 'Grief milestone dates calendared and contacted', 'Referral to support group made', 'Door left explicitly open', 'Final pastoral note'],
  },
  'Gender Identity / Sexuality': {
    color: '#7eaacc',
    stages: [
      { t: 'Stage 1 — Safe Disclosure',          d: 'Receive with calm, unhurried presence. Listen fully before responding. Same-sex pastor/elder responds whenever possible. Establish confidentiality explicitly.' },
      { t: 'Stage 2 — Understanding Their World', d: 'What is the nature of the struggle? What do they believe theologically? What are they asking for from the church right now?' },
      { t: 'Stage 3 — Pastoral Care Plan',        d: 'Assign same-sex, spiritually mature caregiver. Regular meetings (monthly minimum). Affirm: their place in this community is not conditional on their struggle.' },
      { t: 'Stage 4 — Community & Belonging',     d: 'Isolation is the enemy. Ensure genuine community: small group, friendships, belonging. If married: spouse needs their own pastoral care.' },
      { t: 'Stage 5 — Long-Term Accompaniment',  d: 'This is rarely a short journey. Celebrate faithfulness. If member steps away from biblical teaching: maintain relationship and hold truth in love.' },
    ],
    notes: `GENDER IDENTITY / SEXUALITY INTAKE (CONFIDENTIAL)\n${_SEP}\nNature of Struggle (as member describes it):\n\nTheological Stance (member's understanding):\n\nWhat They Are Seeking from the Church:\n\nFamily / Spouse Aware: YES / NO\n\n\n${_SEP}\nCaregiver Assigned (same sex):\nProfessional Referral Made: YES / NO\nCommunity Connection Plan:\nNext Meeting:`,
    watchFor: [
      'Isolation: pulling away from community out of shame or fear',
      'Online influence: theology and community from internet sources contradicting the church\'s framework',
      'Spouse distress: if married, the spouse may be processing their own grief or fear — open a separate case',
    ],
    closureChecklist: ['Connected to ongoing community', 'Professional counselor referral made if desired', '6-month formal reviews completed', 'Transitioned to Shepherding', 'Final pastoral note'],
  },
};

const STATUSES = ['Open', 'In Progress', 'Follow-Up', 'Referred'];

// Demo care cases — shown when a filter type has no live data
const _D = Date.now();
const DEMO_CARE_CASES = [];

export function render() {
  return /* html */`
    <section class="life-view">
      ${pageHero({
        title:    'Pastoral Care',
        subtitle: 'Follow-ups, prayer requests, visits, and life moments — nobody falls through the cracks.',
        scripture: 'Shepherd the flock of God that is among you. — 1 Peter 5:2',
      })}

      <!-- Quick stats -->
      <div class="life-stats">
        <div class="life-stat-card life-stat--urgent">
          <div class="life-stat-n">—</div>
          <div class="life-stat-label">Urgent</div>
        </div>
        <div class="life-stat-card life-stat--high">
          <div class="life-stat-n">—</div>
          <div class="life-stat-label">High Priority</div>
        </div>
        <div class="life-stat-card life-stat--normal">
          <div class="life-stat-n">—</div>
          <div class="life-stat-label">Normal</div>
        </div>
        <div class="life-stat-card life-stat--total">
          <div class="life-stat-n">—</div>
          <div class="life-stat-label">Total Open</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="life-toolbar">
        <div class="fold-filters">
          <button class="fold-filter is-active" data-life-filter="all">All</button>
          <button class="fold-filter" data-life-filter="urgent">Urgent</button>
          <button class="fold-filter" data-life-filter="prayer">Prayer</button>
          <button class="fold-filter" data-life-filter="visit">Visits</button>
          <button class="fold-filter" data-life-filter="followup">Follow-ups</button>
          <button class="fold-filter" data-life-filter="assignments">Care Assignments</button>
          <button class="fold-filter" data-life-filter="compassion">Compassion Requests</button>
        </div>
        <button class="flock-btn flock-btn--primary" data-care-new style="margin-left:auto;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          New Care Item
        </button>
        <button class="flock-btn flock-btn--primary" data-new-assign style="margin-left:auto;display:none;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Assign
        </button>
        <button class="flock-btn flock-btn--primary" data-new-compassion style="margin-left:auto;display:none;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          New Request
        </button>
      </div>

      <!-- Queue (hidden when a tab panel is active) -->
      <div class="life-queue" data-bind="queue">
        <div class="life-loading">Loading care queue…</div>
      </div>

      <!-- Care Assignments panel -->
      <div data-tab-panel="assignments" style="display:none;">
        <div data-bind="assignments">
          <div class="life-loading">Loading assignments…</div>
        </div>
      </div>

      <!-- Compassion Requests panel -->
      <div data-tab-panel="compassion" style="display:none;">
        <div data-bind="compassion">
          <div class="life-loading">Loading compassion requests…</div>
        </div>
      </div>

      <!-- Todos -->
      <div class="way-section-header" style="margin-top:32px;">
        <h2 class="way-section-title">Todos</h2>
        <button class="flock-btn flock-btn--primary" data-new-todo>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add Todo
        </button>
      </div>
      <div data-bind="todos">
        <div class="life-loading">Loading todos…</div>
      </div>
    </section>
  `;
}

export function mount(root) {
  let _memberDir = [];
  const _caseMap = {};

  function _wireFilters() {
    const queueEl        = root.querySelector('[data-bind="queue"]');
    const assignPanel    = root.querySelector('[data-tab-panel="assignments"]');
    const compassionPanel = root.querySelector('[data-tab-panel="compassion"]');
    const newCareBtn      = root.querySelector('[data-care-new]');
    const newAssignBtn    = root.querySelector('[data-new-assign]');
    const newCompassionBtn = root.querySelector('[data-new-compassion]');

    // Map filter key → { panel, actionBtn }
    const _PANELS = {
      assignments: { panel: assignPanel,     btn: newAssignBtn },
      compassion:  { panel: compassionPanel, btn: newCompassionBtn },
    };

    root.querySelectorAll('[data-life-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('[data-life-filter]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const f = btn.dataset.lifeFilter;

        if (_PANELS[f]) {
          // Show the matching tab panel; hide queue + New Care Item
          if (queueEl)   queueEl.style.display  = 'none';
          if (newCareBtn) newCareBtn.style.display = 'none';
          Object.entries(_PANELS).forEach(([key, { panel, btn: ab }]) => {
            if (panel) panel.style.display = (key === f) ? '' : 'none';
            if (ab)    ab.style.display    = (key === f) ? '' : 'none';
          });
        } else {
          // Queue view — hide all panels and their action buttons
          if (queueEl)   queueEl.style.display  = '';
          if (newCareBtn) newCareBtn.style.display = '';
          Object.values(_PANELS).forEach(({ panel, btn: ab }) => {
            if (panel) panel.style.display = 'none';
            if (ab)    ab.style.display    = 'none';
          });
          // Apply card-level filter
          root.querySelectorAll('.life-card').forEach((card) => {
            const show = f === 'all' || card.dataset.type === f || card.dataset.priority === f;
            card.style.display = show ? '' : 'none';
          });
        }
      });
    });
  }

  function _wireCards() {
    root.querySelectorAll('.life-card').forEach((card) => {
      const cid = card.dataset.cid;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.life-card-actions')) return;
        const c = cid && _caseMap[cid];
        if (c) _openSheet(c, _memberDir, _reload);
      });

      const resolveBtn = card.querySelector('[data-care-complete]');
      if (resolveBtn) {
        // Two-step confirm: first click arms the button (turns red, label
        // changes to "Confirm?"); second click within 4s actually resolves.
        // Clicking anywhere else, or the timeout, disarms.
        let armed = false;
        let armTimer = 0;
        const _disarm = () => {
          armed = false;
          if (armTimer) { clearTimeout(armTimer); armTimer = 0; }
          resolveBtn.classList.remove('is-armed');
          resolveBtn.setAttribute('title', 'Mark complete');
          resolveBtn.setAttribute('aria-label', 'Complete');
        };
        const _onOutside = (ev) => {
          if (!armed) return;
          if (ev.target === resolveBtn || resolveBtn.contains(ev.target)) return;
          _disarm();
          document.removeEventListener('click', _onOutside, true);
        };
        resolveBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!armed) {
            armed = true;
            resolveBtn.classList.add('is-armed');
            resolveBtn.setAttribute('title', 'Tap again to confirm resolved');
            resolveBtn.setAttribute('aria-label', 'Tap again to confirm resolved');
            document.addEventListener('click', _onOutside, true);
            armTimer = setTimeout(() => {
              _disarm();
              document.removeEventListener('click', _onOutside, true);
            }, 4000);
            return;
          }
          // Second click — actually resolve.
          _disarm();
          document.removeEventListener('click', _onOutside, true);
          await _resolveCase(cid, card, root);
        });
      }

      const noteBtn = card.querySelector('[data-care-note]');
      if (noteBtn) {
        noteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const c = cid && _caseMap[cid];
          const personName = c ? (_resolveName(c.memberId, _memberDir) || c.memberName || c.name || '') : '';
          _quickNote(cid, personName);
        });
      }
    });
  }

  function _wireNewBtn() {
    const btn = root.querySelector('[data-care-new]');
    if (!btn) return;
    const fresh = btn.cloneNode(true);
    btn.replaceWith(fresh);
    fresh.addEventListener('click', () => _newCareModal(_memberDir, _reload));
  }

  function _wireSecondaryNewBtns() {
    const wireOnce = (sel, openFn, reloadFn) => {
      const btn = root.querySelector(sel);
      if (!btn) return;
      const fresh = btn.cloneNode(true);
      btn.replaceWith(fresh);
      fresh.addEventListener('click', () => openFn(null, _memberDir, reloadFn));
    };
    // [data-new-assign] may appear in the toolbar (tab view) — wire both
    root.querySelectorAll('[data-new-assign]').forEach((btn) => {
      const fresh = btn.cloneNode(true);
      btn.replaceWith(fresh);
      fresh.addEventListener('click', () => _openAssignSheet(null, _memberDir, () => _loadAssignments(root, _memberDir)));
    });
    // [data-new-compassion] may appear in the toolbar (tab view)
    root.querySelectorAll('[data-new-compassion]').forEach((btn) => {
      const fresh = btn.cloneNode(true);
      btn.replaceWith(fresh);
      fresh.addEventListener('click', () => _openCompassionSheet(null, _memberDir, () => _loadCompassion(root, _memberDir)));
    });
    wireOnce('[data-new-todo]',       _openTodoSheet,       () => _loadTodos(root, _memberDir));
  }

  async function _reload() {
    const result = await _loadCare(root, _caseMap);
    if (result) _memberDir = result.memberDir;
    _wireCards();
    _wireFilters();
    _wireNewBtn();
    _wireSecondaryNewBtns();
    _loadAssignments(root, _memberDir);
    _loadCompassion(root, _memberDir);
    _loadTodos(root, _memberDir);
  }

  _wireFilters();
  _wireNewBtn();
  _wireSecondaryNewBtns();
  _reload();

  // Keep stats live while view is mounted — the warm Firestore listener
  // already pushes every change in careCases, so subscribing here means
  // a brand-new case shows up in the tiles without waiting for _reload.
  const _unsubLiveRows = subscribeOpenCareRows((openRows) => {
    try { _updateStats(root, openRows); } catch (_) {}
  });

  return () => { _closeSheet(); try { _unsubLiveRows(); } catch (_) {} };
}

async function _loadCare(root, caseMap) {
  const V   = window.TheVine;
  const MXC = buildAdapter('flock.care', V);
  const MXM = buildAdapter('flock.members', V);
  if (!V) return null;
  const queue = root.querySelector('[data-bind="queue"]');
  if (!queue) return null;

  // Instant paint from the warm cache (populated by the_life/index.js's
  // eager Firestore listener that started at login). Stats fill in the
  // moment the page renders, even before listMembers/listCases finish.
  const warmRows = getWarmCareRows();
  if (Array.isArray(warmRows) && warmRows.length) {
    _updateStats(root, warmRows);
    queue.innerHTML = '<div class="life-loading">Loading care queue…</div>';
  } else {
    queue.innerHTML = '<div class="life-loading">Loading care queue…</div>';
  }

  try {
    const UR = window.UpperRoom;
    const [careRes, gasMembersRes, fbMembersRes] = await Promise.all([
      // limit:500 — listCareCases defaults to 25 (page-1 only), which silently
      // hides older open cases and makes the queue disagree with the sidebar
      // badge (which reads the full collection). Always pull a full page.
      MXC.list({ limit: 500 }),
      MXM.list({ limit: 500 }).catch(() => []),
      // Firestore is the source of truth for care-assignment memberIds, so we MUST
      // include UpperRoom members in the directory or those IDs won't resolve.
      (UR && typeof UR.listMembers === 'function')
        ? UR.listMembers({ limit: 500 }).catch(() => [])
        : Promise.resolve([]),
      // Refresh Lead Pastor AppConfig BEFORE we render cards so the fallback
      // ("default to LP when no caregiver assigned") works on first paint.
      _loadLpConfigId(),
    ]);
    const memberDir = _mergeMemberDirs(_rows(gasMembersRes), _rows(fbMembersRes));
    _memberDirCache = memberDir;
    const all  = _rows(careRes);
    const rows = all.filter(r => !_TERMINAL.has((r.status || r.Status || '').toLowerCase()));
    // Populate caseMap
    Object.keys(caseMap).forEach(k => delete caseMap[k]);
    rows.forEach(c => { caseMap[String(c.id || c.caseId || '')] = c; });
    const memberMap = _buildMemberIndex(memberDir);
    if (!rows.length) {
      queue.innerHTML = '<div class="life-empty" style="padding:40px;text-align:center;color:var(--ink-muted,#7a7f96)">No open care cases. Use "New Case" to create one.</div>';
      _updateStats(root, []);
      return { rows: [], memberDir };
    }
    // Sort newest first — prefer updatedAt so recently-touched cases float up,
    // fall back to createdAt. Handles both Firestore Timestamps ({seconds}) and
    // plain ISO strings / epoch numbers.
    const _tsNum = (v) => {
      if (!v) return 0;
      if (typeof v === 'object' && v.seconds) return v.seconds * 1000;
      return new Date(v).getTime() || 0;
    };
    rows.sort((a, b) => _tsNum(b.updatedAt || b.createdAt) - _tsNum(a.updatedAt || a.createdAt));
    queue.innerHTML = rows.map(c => _liveCareCard(c, memberMap)).join('');
    _updateStats(root, rows);
    return { rows, memberDir };
  } catch (err) {
    console.error('[TheLife] care.list error:', err);
    queue.innerHTML = '<div class="life-loading">Could not load care queue right now.</div>';
    return null;
  }
}

function _rows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

function _updateStats(root, rows) {
  let urgent = 0, high = 0, normal = 0;
  for (const r of rows) {
    const p = (r.priority || 'normal').toLowerCase();
    if (p === 'urgent') urgent++;
    else if (p === 'high') high++;
    else normal++;
  }
  const set = (sel, val) => { const el = root.querySelector(sel); if (el) el.textContent = val; };
  set('.life-stat--urgent .life-stat-n', urgent);
  set('.life-stat--high .life-stat-n',   high);
  set('.life-stat--normal .life-stat-n', normal);
  set('.life-stat--total .life-stat-n',  rows.length);
  // The visible tiles are the source of truth — push that exact count to
  // the sidebar badge so the two CANNOT disagree.
  try { setOpenCareCount(rows.length, rows); } catch (_) {}
}

function _normalizeType(rawType) {
  const s = rawType.replace(/[-_\s]/g, '');
  if (s.includes('prayer'))                              return 'prayer';
  if (s.includes('visit') || s.includes('hosp'))        return 'visit';
  if (s.includes('followup') || s.includes('checkin'))  return 'followup';
  if (s.includes('crisis'))                             return 'crisis';
  if (s.includes('grief'))                              return 'grief';
  if (s.includes('counsel'))                            return 'counseling';
  if (s.includes('milestone') || s.includes('lifemoment')) return 'milestone';
  if (s.includes('newvisitor') || s.includes('newbeliever') || s.includes('welcome')) return 'welcome';
  return s || 'other';
}

// Build an O(1) name-lookup Map keyed by every identifier field
function _buildMemberIndex(memberDir) {
  const map = new Map();
  for (const m of memberDir) {
    const name = m.preferredName
      || ((m.firstName || '') + ' ' + (m.lastName || '')).trim()
      || m.displayName
      || m.name
      || m.fullName
      || '';
    if (!name) continue;
    for (const k of [m.email, m.primaryEmail, m.id, m.uid, m.docId, m.memberNumber, m.memberPin]) {
      if (k) { const s = String(k); map.set(s, name); map.set(s.toLowerCase(), name); }
    }
  }
  return map;
}

// Merge two member directories (e.g. GAS + Firestore). Keeps both rows even
// when emails match — they may have distinct IDs (Firestore docId vs GAS id),
// and we need BOTH IDs to resolve to the same name. _buildMemberIndex de-dupes
// at the Map level by overwriting with the same name string, which is fine.
function _mergeMemberDirs(a = [], b = []) {
  return [].concat(a || [], b || []);
}

// Dedupe a member list for display purposes (pickers/dropdowns).
// Same person may appear twice when GAS+Firestore directories are merged.
// Keys on lowercased email when present, else lowercased name.
function _dedupeMembers(members) {
  const seen = new Set();
  const out  = [];
  for (const m of (members || [])) {
    const e = (m.email || m.primaryEmail || '').toLowerCase();
    const n = _memberName(m).toLowerCase();
    const key = e || n;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

// Resolve a memberId/email to a display name — accepts a member array or a pre-built Map
function _resolveName(idOrEmail, memberDirOrMap) {
  if (!idOrEmail) return '';
  const s = String(idOrEmail);
  if (memberDirOrMap instanceof Map) {
    return memberDirOrMap.get(s) || memberDirOrMap.get(s.toLowerCase()) || (s.includes(' ') ? s : '');
  }
  const key = s.toLowerCase();
  for (const m of memberDirOrMap) {
    if ((m.email && m.email.toLowerCase() === key)
      || (m.primaryEmail && m.primaryEmail.toLowerCase() === key)
      || m.id === s || m.uid === s || m.docId === s
      || m.memberNumber === s || m.memberPin === s) {
      return (m.preferredName || ((m.firstName || '') + ' ' + (m.lastName || '')).trim() || m.displayName || s);
    }
  }
  return s.includes(' ') ? s : '';
}

function _liveCareCard(c, memberDirOrMap, isDemo = false) {
  memberDirOrMap = memberDirOrMap || [];
  const priority    = (c.priority || 'Normal').toLowerCase();
  // Preserve original casing for CARE_TYPES lookup; normalize to lowercase for the filter data-type attr
  const rawTypeOrig = c.careType || c.type || c.caseType || '';
  const rawType     = rawTypeOrig.toLowerCase();
  const type        = rawType ? _normalizeType(rawType) : 'other';
  // Name: first try direct name fields, then resolve memberId from directory
  const name     = c.memberName
                || c.name
                || _resolveName(c.memberId, memberDirOrMap)
                || c.memberId
                || 'Unknown';
  // Assigned: primaryCaregiverId is the canonical field; assignedTo is a fallback.
  // When NOTHING is set, fall back to the Lead Pastor so cases never look orphaned.
  // Treat literal "undefined"/"null" strings (older save-bug residue) as empty.
  let assigneeRaw = c.primaryCaregiverId || c.assignedTo || c.assignedName || c.assignee || '';
  if (typeof assigneeRaw === 'string') {
    const t = assigneeRaw.trim().toLowerCase();
    if (t === 'undefined' || t === 'null') assigneeRaw = '';
  }
  let assignee, assigneeIsLP = false;
  // _liveCareCard is often called with a name-lookup Map rather than the raw
  // member array. Always search the cached directory array for the LP fallback,
  // otherwise _findLeadPastor receives [] and we wrongly render "Unassigned".
  const lpSearchDir = Array.isArray(memberDirOrMap) ? memberDirOrMap : _memberDirCache;
  if (assigneeRaw) {
    // If assigneeRaw matches the configured LP id, prefer the LP's full name.
    if (_lpConfigId && String(assigneeRaw) === String(_lpConfigId)) {
      const lp = _findLeadPastor(lpSearchDir, _lpConfigId);
      assignee = lp ? _memberName(lp) : (_resolveName(assigneeRaw, memberDirOrMap) || assigneeRaw);
      assigneeIsLP = !!lp;
    } else {
      assignee = _resolveName(assigneeRaw, memberDirOrMap) || assigneeRaw;
    }
  } else {
    const lp = _findLeadPastor(lpSearchDir, _lpConfigId);
    if (lp) { assignee = _memberName(lp); assigneeIsLP = true; }
    else    { assignee = 'Unassigned'; }
  }
  const note     = c.summary || c.description || c.notes || c.note || '';
  const p        = PRIORITY[priority]  || PRIORITY.normal;
  const t        = CARE_TYPES[rawTypeOrig] || CARE_TYPES[type] || CARE_TYPES[rawType] || { icon: '🫱', label: rawTypeOrig || 'Other' };
  const unassigned = !assigneeRaw && !assigneeIsLP;
  const ts       = c.updatedAt || c.createdAt;
  const daysStr  = ts ? _daysAgo(ts) : '';
  const cid      = _e(String(c.id || c.caseId || ''));

  return /* html */`
    <article class="life-card${isDemo ? ' life-card--demo' : ''}" data-cid="${cid}" data-type="${_e(type)}" data-priority="${_e(priority)}" tabindex="0">
      ${isDemo ? '<span class="life-demo-badge">Example</span>' : ''}
      <div class="life-card-icon">${t.icon}</div>
      <div class="life-card-body">
        <div class="life-card-top">
          <span class="life-card-name">${_e(name)}</span>
          <span class="life-priority-badge" style="color:${p.color}; background:${p.bg}">${p.label}</span>
          <span class="life-type-badge">${t.label}</span>
        </div>
        <div class="life-card-note">${_e(note)}</div>
        <div class="life-card-foot">
          <span class="life-assignee${unassigned ? ' life-assignee--empty' : ''}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${_e(assignee)}
          </span>
          ${daysStr ? `<span class="life-days">${daysStr}</span>` : ''}
        </div>
      </div>
      <div class="life-card-actions">
        <button class="life-action-btn" title="Mark complete" data-care-complete="${cid}" aria-label="Complete">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="life-action-btn" title="Add note" data-care-note="${cid}" aria-label="Note">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
        </button>
      </div>
    </article>`;
}

function _daysAgo(ts) {
  // Handle Firestore Timestamp objects ({ seconds, nanoseconds }) and plain date strings/numbers
  const ms = ts?.seconds ? ts.seconds * 1000 : new Date(ts).getTime();
  if (!ms || isNaN(ms)) return '';
  const delta = Math.floor((Date.now() - ms) / 86_400_000);
  if (delta <= 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  return `${delta}d ago`;
}

function _e(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Resolve a case ────────────────────────────────────────────────────────────
async function _resolveCase(cid, card, root) {
  const V  = window.TheVine;
  const MX = buildAdapter('flock.care', V);
  if (!cid) return;
  try {
    await MX.resolve({ id: cid });
  } catch {
    try { await MX.update({ id: cid, status: 'Resolved' }); } catch (err) {
      console.error('[TheLife] resolve error:', err);
      return;
    }
  }
  card.style.transition = 'opacity 300ms, transform 300ms';
  card.style.opacity = '0';
  card.style.transform = 'scale(0.96)';
  setTimeout(() => { card.remove(); _decrementTotal(root); }, 320);
  // Open-case count just changed — invalidate the badge cache and ping the
  // sidebar so the badge updates immediately instead of waiting up to 2 min
  // (or until the next session, which is what was happening before).
  bustPendingCache();
}

function _decrementTotal(root) {
  if (!root) return;
  const el = root.querySelector('.life-stat--total .life-stat-n');
  if (el) el.textContent = Math.max(0, parseInt(el.textContent || '0', 10) - 1);
}

// ── Detail sheet ─────────────────────────────────────────────────────────────
let _activeSheet = null;

function _findMemberRec(idOrEmail, memberDir) {
  if (!idOrEmail) return null;
  // Accept a name-lookup Map by falling back to the cached array directory.
  const dir = Array.isArray(memberDir) ? memberDir : _memberDirCache;
  if (!Array.isArray(dir) || !dir.length) return null;
  const k = String(idOrEmail).toLowerCase();
  return dir.find(m =>
       (m.memberPin   && String(m.memberPin).toLowerCase()   === k)
    || (m.memberNumber&& String(m.memberNumber).toLowerCase()=== k)
    || (m.id          && String(m.id).toLowerCase()          === k)
    || (m.uid         && String(m.uid).toLowerCase()         === k)
    || (m.docId       && String(m.docId).toLowerCase()       === k)
    || (m.email        && m.email.toLowerCase()        === k)
    || (m.primaryEmail && m.primaryEmail.toLowerCase() === k)
  ) || null;
}

function _openSheet(c, memberDir, onSave) {
  _closeSheet();
  const V    = window.TheVine;
  const MXC  = buildAdapter('flock.care', V);
  const MXCI = buildAdapter('flock.care.interactions', V);
  const cid = String(c.id || c.caseId || '');
  const name = c.memberName || c.name || _resolveName(c.memberId, memberDir) || c.memberId || 'Unknown';
  const memberRec     = _findMemberRec(c.memberId, memberDir);
  const memberEmail   = (memberRec?.email || memberRec?.primaryEmail || c.memberEmail || '').trim();
  const memberPhoneRaw= (memberRec?.phone || memberRec?.primaryPhone || memberRec?.mobilePhone || memberRec?.cellPhone || c.memberPhone || '').trim();
  const memberPhoneTel= memberPhoneRaw.replace(/[^\d+]/g, '');
  const assigneeRaw   = c.primaryCaregiverId   || c.assignedTo || c.assignedName || '';
  const secondaryRaw  = c.secondaryCaregiverId || c.secondaryCaregiver || '';
  const currentStatus = c.status || 'Open';
  const rawType       = c.careType || c.type || '';
  const cfg           = _cfgFor(rawType);
  const hasMemberDir  = memberDir && memberDir.length > 0;
  const isPastoral    = _isLeadPastorGroup(memberDir || []);

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="Care Case - ${_e(name)}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${_e(name)}</div>
          <div class="life-sheet-hd-meta">${_e(rawType)} &bull; ${_e(currentStatus)}</div>
          <!-- Contact buttons are ALWAYS rendered. The click handler resolves
               the member's phone/email at click-time from the latest member
               directory (or prompts) so the row never disappears just because
               the directory hadn't finished loading at sheet-render time. -->
          <div class="life-contact-actions" role="group" aria-label="Contact ${_e(name)}">
            <button type="button" class="flock-icon-btn life-contact-btn" data-contact="text" data-contact-value="${_e(memberPhoneRaw)}" data-contact-tel="${_e(memberPhoneTel)}" title="Text ${_e(name)}${memberPhoneRaw ? ' (' + _e(memberPhoneRaw) + ')' : ''}" aria-label="Text ${_e(name)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.7-.8L3 21l1.9-5.3A8.4 8.4 0 1 1 21 11.5z"/></svg>
            </button>
            <a class="flock-icon-btn life-contact-btn" href="${memberPhoneTel ? 'tel:' + _e(memberPhoneTel) : '#'}" data-contact="call" data-contact-value="${_e(memberPhoneRaw)}" title="Call ${_e(name)}${memberPhoneRaw ? ' (' + _e(memberPhoneRaw) + ')' : ''}" aria-label="Call ${_e(name)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></svg>
            </a>
            <button type="button" class="flock-icon-btn life-contact-btn" data-contact="email" data-contact-value="${_e(memberEmail)}" title="Email ${_e(name)}${memberEmail ? ' (' + _e(memberEmail) + ')' : ''}" aria-label="Email ${_e(name)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>
            </button>
          </div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <!-- Status pills -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Status</div>
          <div class="life-status-row">
            ${STATUSES.map(s => `<button class="life-status-pill${s === currentStatus ? ' is-active' : ''}" data-status="${_e(s)}">${_e(s)}</button>`).join('')}
          </div>
        </div>
        <!-- Priority -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Priority</div>
          <div class="life-priority-row">
            ${['urgent','high','normal','low'].map(p => {
              const pr = PRIORITY[p] || {};
              const isActive = (c.priority || 'normal').toLowerCase() === p;
              return `<button class="life-priority-pill${isActive ? ' is-active' : ''}" data-priority="${p}" style="${isActive ? `background:${pr.bg};color:${pr.color};border-color:${pr.color}` : ''}">${_e(pr.label || p)}</button>`;
            }).join('')}
          </div>
        </div>
        <!-- Primary Caregiver -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Assigned To</div>
          ${hasMemberDir
            ? _caregiverSelect(memberDir, 'assignee', assigneeRaw, '— Unassigned —')
            : `<input class="life-sheet-input" data-field="assignee" type="text" value="${_e(_resolveName(assigneeRaw, memberDir) || assigneeRaw)}" placeholder="Caregiver name or email">`}
        </div>
        <!-- Secondary Caregiver -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">
            Secondary Caregiver
            <span class="life-field-hint">Also has access to view this case</span>
          </div>
          ${hasMemberDir
            ? _caregiverSelect(memberDir, 'secondary', secondaryRaw, '— None —')
            : `<input class="life-sheet-input" data-field="secondary" type="text" value="${_e(_resolveName(secondaryRaw, memberDir) || secondaryRaw)}" placeholder="Secondary caregiver (optional)">`}
        </div>
        <!-- Summary -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Summary / Notes</div>
          <textarea class="life-sheet-ta" data-field="summary" rows="3" placeholder="What's happening?">${_e(c.summary || c.description || '')}</textarea>
        </div>
        <!-- Workflow guide (collapsible, visible to all caregivers) -->
        ${rawType ? `<div class="life-sheet-field life-wg-field">${_workflowGuideHtml(rawType)}</div>` : ''}
        <!-- Lead Pastor Eyes Only -->
        ${isPastoral ? `
        <div class="life-sheet-field life-pastoral-field">
          <div class="life-sheet-label">
            🔐 Lead Pastor Eyes Only
            <span class="life-field-hint life-pastoral-hint">Not visible to other caregivers</span>
          </div>
          <textarea class="life-sheet-ta life-pastoral-ta" data-field="pastoralNotes" rows="6" placeholder="Confidential notes, discernment, workflow tracking…">${_e(c.pastoralNotes || (cfg && cfg.notes ? cfg.notes : ''))}</textarea>
        </div>` : ''}
        <!-- Interactions -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Interactions</div>
          <div class="life-ix-list" data-ix><div class="life-ix-empty">Loading…</div></div>
          <div class="life-note-form">
            <textarea class="life-note-ta" rows="2" placeholder="Add a note…"></textarea>
            <button class="flock-btn flock-btn--sm" data-add-note>Add Note</button>
          </div>
        </div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn flock-btn--danger life-delete-btn" data-delete style="margin-right:auto">Delete Case</button>
        <button class="flock-btn life-resolve-btn" data-resolve>Resolve Case</button>
        <button class="flock-btn flock-btn--primary" data-save>Save Changes</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeSheet = sheet;

  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
  });

  // Shared helpers — must be at _openSheet scope so _reloadIx can call them
  const _ixRows = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    for (const k of ['rows', 'data', 'interactions', 'items', 'results', 'records']) {
      if (Array.isArray(res[k])) return res[k];
    }
    return [];
  };
  const _ixTs = (v) => {
    if (!v) return '';
    const ms = v?.seconds ? v.seconds * 1000 : new Date(v).getTime();
    return ms && !isNaN(ms) ? new Date(ms).toLocaleString() : '';
  };
  const _renderIx = (items, ix) => {
    if (!items.length) { ix.innerHTML = '<div class="life-ix-empty">No interactions yet.</div>'; return; }
    ix.innerHTML = items.map(i => {
      const ts = _ixTs(i.createdAt || i.timestamp || i.date || i.interactionDate);
      const noteText = i.notes || i.note || i.content || i.body || i.text || i.summary || i.message || '';
      const channel  = i.interactionType || i.channel || i.type || '';
      const channelTag = channel ? `<span class="life-ix-tag">${_e(channel)}</span> ` : '';
      return `<div class="life-ix-item"><div class="life-ix-note">${channelTag}${_e(noteText)}</div><div class="life-ix-meta">${_e(i.author || i.authorName || i.createdBy || '')}${ts ? ' &bull; ' + _e(ts) : ''}</div></div>`;
    }).join('');
  };

  // Load interactions — UpperRoom (Firestore) first, then TheVine GAS fallback
  if (cid) {
    const _ixRows2 = _ixRows; // alias keeps block below working without changes

    // Try UpperRoom (Firestore careInteractions) first — authoritative source
    const UR = window.UpperRoom;
    if (UR && typeof UR.listCareInteractions === 'function') {
      UR.listCareInteractions({ caseId: cid })
        .then(items => {
          const rows = _ixRows(items);
          const ix   = sheet.querySelector('[data-ix]');
          if (!ix) return;
          if (rows.length) { _renderIx(rows, ix); return; }
          // If Firestore had none, fall back to TheVine GAS
          if (!V) { _renderIx([], ix); return; }
          MXCI.list({ caseId: cid })
            .then(r => _renderIx(_ixRows(r), ix))
            .catch(() => _renderIx([], ix));
        })
        .catch(() => {
          const ix = sheet.querySelector('[data-ix]');
          if (ix) ix.innerHTML = '<div class="life-ix-empty">Could not load interactions.</div>';
        });
    } else {
      MXCI.list({ caseId: cid })
        .then(res => {
          const items = _ixRows(res);
          if (items.length) return items;
          return MXCI.list({ id: cid }).then(_ixRows).catch(() => []);
        })
        .then((items) => {
          const ix = sheet.querySelector('[data-ix]');
          if (ix) _renderIx(items, ix);
        })
        .catch(() => {
          const ix = sheet.querySelector('[data-ix]');
          if (ix) ix.innerHTML = '<div class="life-ix-empty">Could not load interactions.</div>';
        });
    }
  }

  // Status pill wiring
  sheet.querySelectorAll('.life-status-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('.life-status-pill').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  // Priority pill wiring
  sheet.querySelectorAll('.life-priority-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('.life-priority-pill').forEach(b => {
        b.classList.remove('is-active');
        b.style.cssText = '';
      });
      btn.classList.add('is-active');
      const p  = btn.dataset.priority;
      const pr = PRIORITY[p] || {};
      btn.style.background   = pr.bg    || '';
      btn.style.color        = pr.color || '';
      btn.style.borderColor  = pr.color || '';
    });
  });

  // Reload interactions from whichever backend is available
  async function _reloadIx() {
    if (!cid) return;
    const ix = sheet.querySelector('[data-ix]');
    if (!ix) return;
    const UR = window.UpperRoom;
    let items = [];
    try {
      if (UR && typeof UR.listCareInteractions === 'function') {
        const res = await UR.listCareInteractions({ caseId: cid });
        items = Array.isArray(res) ? res : (res?.rows || res?.data || res?.items || []);
        if (!items.length) {
          const r2 = await MXCI.list({ caseId: cid }).catch(() => []);
          items = Array.isArray(r2) ? r2 : (r2?.rows || r2?.data || []);
        }
      } else {
        const res = await MXCI.list({ caseId: cid });
        items = Array.isArray(res) ? res : (res?.rows || res?.data || []);
      }
    } catch (e) { console.error('[the_life] reload interactions failed', e); }
    _renderIx(items, ix);
  }
  // Expose for the standalone _quickNote sheet (which closes itself on save
  // and needs to refresh whatever case sheet is underneath it).
  window.__lifeReloadIx = (forCid) => { if (!forCid || forCid === cid) return _reloadIx(); };

  // Contact action buttons — open custom composer (text/email) or native dialer (call)
  sheet.querySelectorAll('[data-contact]').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      const kind  = btn.dataset.contact;
      // Resolve contact info LAZILY at click time. If the directory wasn't
      // loaded when the sheet was rendered, look it up now from the cached
      // directory using the case's memberId. This way the buttons are always
      // present and just-work the moment the directory is available.
      let value = btn.dataset.contactValue || '';
      let tel   = btn.dataset.contactTel   || '';
      if (!value || (kind === 'text' && !tel) || (kind === 'call' && !tel)) {
        const rec = _findMemberRec(c.memberId, _memberDirCache);
        if (rec) {
          if (kind === 'email') {
            value = (rec.email || rec.primaryEmail || value || '').trim();
          } else {
            const raw = (rec.phone || rec.primaryPhone || rec.mobilePhone || rec.cellPhone || value || '').trim();
            value = raw;
            tel   = raw.replace(/[^\d+]/g, '');
          }
          // Update dataset so subsequent clicks are instant.
          btn.dataset.contactValue = value;
          if (tel) btn.dataset.contactTel = tel;
          if (kind === 'call' && tel) btn.setAttribute('href', 'tel:' + tel);
        }
      }
      if (!value || (kind !== 'email' && !tel)) {
        ev.preventDefault();
        alert(`No ${kind === 'email' ? 'email address' : 'phone number'} on file for ${name}.`);
        return;
      }

      // Phone calls: log immediately, let the <a href="tel:"> navigate.
      if (kind === 'call') {
        if (!cid) return;
        const session = window.TheVine?.session?.();
        const note = `📞 Called ${name}${value ? ' (' + value + ')' : ''} via app`;
        try {
          const UR = window.UpperRoom;
          const payload = { caseId: cid, notes: note, interactionType: 'Phone Call', createdBy: session?.email || '', author: session?.email || '' };
          if (UR && typeof UR.createCareInteraction === 'function') {
            await UR.createCareInteraction(payload);
          } else {
            await MXCI.create(payload);
          }
          _reloadIx();
        } catch (e) { console.error('[the_life] log call failed', e); }
        return;
      }

      // Text / Email: open custom composer (no native href to follow)
      ev.preventDefault();
      if (kind === 'text') {
        _openComposer({
          channel: 'text',
          name, recipient: value, target: tel || value,
          caseId: cid, sheet,
          onLogged: _reloadIx,
        });
      } else if (kind === 'email') {
        _openComposer({
          channel: 'email',
          name, recipient: value, target: value,
          caseId: cid, sheet,
          onLogged: _reloadIx,
        });
      }
    });
  });

  // Add note — UpperRoom (Firestore) first, then TheVine fallback
  sheet.querySelector('[data-add-note]').addEventListener('click', async () => {
    const ta = sheet.querySelector('.life-note-ta');
    const note = (ta.value || '').trim();
    if (!note || !cid) return;
    const btn = sheet.querySelector('[data-add-note]');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    const UR = window.UpperRoom;
    const session = window.TheVine?.session?.();
    const payload = {
      caseId: cid,
      notes: note,
      interactionType: 'Note',
      createdBy: session?.email || '',
      author:    session?.email || '',
    };
    try {
      if (UR && typeof UR.createCareInteraction === 'function') {
        await UR.createCareInteraction(payload);
      } else {
        await MXCI.create(payload);
      }
      ta.value = '';
      await _reloadIx();
    } catch (err) { console.error('[TheLife] add note error:', err); }
    btn.disabled = false;
    btn.textContent = 'Add Note';
  });

  // Save
  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    const activeStatus  = sheet.querySelector('.life-status-pill.is-active')?.dataset.status || currentStatus;
    const newPriority   = sheet.querySelector('.life-priority-pill.is-active')?.dataset.priority || (c.priority || 'normal').toLowerCase();
    const oldPriority   = (c.priority || 'normal').toLowerCase();
    const assigneeVal   = sheet.querySelector('[data-field="assignee"]')?.value?.trim() || '';
    const secondaryVal  = sheet.querySelector('[data-field="secondary"]')?.value?.trim() || '';
    const summaryVal    = sheet.querySelector('[data-field="summary"]').value.trim();
    const pastoralVal   = isPastoral ? (sheet.querySelector('[data-field="pastoralNotes"]')?.value ?? null) : undefined;
    try {
      const patch = { id: cid, status: activeStatus, priority: newPriority };
      if (assigneeVal)  patch.primaryCaregiverId   = assigneeVal;
      if (secondaryVal) patch.secondaryCaregiverId = secondaryVal;
      if (summaryVal)   patch.summary              = summaryVal;
      if (isPastoral && pastoralVal !== null && pastoralVal !== undefined) {
        patch.pastoralNotes = pastoralVal;
      }
      await MXC.update(patch);
      // Log a priority-change interaction if the priority actually changed
      if (newPriority !== oldPriority) {
        const session   = window.TheVine?.session?.();
        const fromLabel = PRIORITY[oldPriority]?.label || oldPriority;
        const toLabel   = PRIORITY[newPriority]?.label || newPriority;
        const ixPayload = {
          caseId: cid,
          notes: `Priority changed from ${fromLabel} → ${toLabel}`,
          interactionType: 'Priority Change',
          createdBy: session?.email || '',
          author:    session?.email || '',
        };
        try {
          const UR2 = window.UpperRoom;
          if (UR2 && typeof UR2.createCareInteraction === 'function') {
            await UR2.createCareInteraction(ixPayload);
          } else {
            await MXCI.create(ixPayload);
          }
        } catch (e) { console.error('[TheLife] priority log error:', e); }
      }
      _closeSheet();
      if (onSave) onSave();
    } catch (err) {
      console.error('[TheLife] update error:', err);
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });

  // Resolve
  sheet.querySelector('[data-resolve]').addEventListener('click', async () => {
    const btn = sheet.querySelector('[data-resolve]');
    btn.disabled = true;
    btn.textContent = 'Resolving…';
    try {
      await MXC.resolve({ id: cid });
    } catch {
      try { await MXC.update({ id: cid, status: 'Resolved' }); } catch (err) {
        console.error('[TheLife] resolve error:', err);
        btn.disabled = false; btn.textContent = 'Resolve Case'; return;
      }
    }
    _closeSheet();
    if (onSave) onSave();
  });

  // Delete case
  sheet.querySelector('[data-delete]').addEventListener('click', async () => {
    const ok = confirm(`Delete care case for ${name}? This cannot be undone.`);
    if (!ok) return;
    const btn = sheet.querySelector('[data-delete]');
    btn.disabled = true; btn.textContent = 'Deleting…';
    try {
      await MXC.update({ id: cid, status: 'Deleted' });
    } catch {
      try { await MXC.update({ id: cid, status: 'Archived' }); } catch (err) {
        console.error('[TheLife] delete error:', err);
        btn.disabled = false; btn.textContent = 'Delete Case'; return;
      }
    }
    _closeSheet();
    if (onSave) onSave();
  });

  // Close (explicit close button only — swipe-to-dismiss intentionally disabled
  // so scrolling the case body back to the top cannot accidentally close the sheet)
  sheet.querySelector('.life-sheet-close').addEventListener('click', () => _closeSheet());
}

function _closeSheet(el) {
  const target = el || _activeSheet;
  if (!target) return;
  const overlay = target.querySelector('.life-sheet-overlay');
  const panel   = target.querySelector('.life-sheet-panel');
  if (overlay) overlay.classList.remove('is-open');
  if (panel)   panel.classList.remove('is-open');
  setTimeout(() => { target.remove(); if (_activeSheet === target) _activeSheet = null; }, 320);
}

// ── Quick note sheet ─────────────────────────────────────────────────────────
function _quickNote(cid, personName) {
  _closeSheet();
  const V    = window.TheVine;
  const MXCI = buildAdapter('flock.care.interactions', V);
  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel life-sheet-panel--sm" role="dialog">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">Add Note${personName ? ' — ' + _e(personName) : ''}</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <textarea class="life-note-ta" rows="4" placeholder="What happened? What was said?…" style="width:100%"></textarea>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>Add Note</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    sheet.querySelector('.life-note-ta').focus();
  });

  sheet.querySelector('[data-cancel]').addEventListener('click', () => _closeSheet());
  sheet.querySelector('.life-sheet-close').addEventListener('click', () => _closeSheet());

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const ta  = sheet.querySelector('.life-note-ta');
    const note = (ta.value || '').trim();
    if (!note || !cid) return;
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Saving…';
    const UR      = window.UpperRoom;
    const session = window.TheVine?.session?.();
    const payload = {
      caseId: cid,
      notes: note,
      interactionType: 'Note',
      createdBy: session?.email || '',
      author:    session?.email || '',
    };
    try {
      if (UR && typeof UR.createCareInteraction === 'function') {
        await UR.createCareInteraction(payload);
      } else {
        await MXCI.create(payload);
      }
      _closeSheet();
      // Refresh the underlying case sheet's interactions list, if open.
      try {
        if (typeof window.__lifeReloadIx === 'function') await window.__lifeReloadIx(cid);
      } catch (_) { /* ignore */ }
    } catch (err) {
      console.error('[TheLife] quick note error:', err);
      btn.disabled = false; btn.textContent = 'Add Note';
    }
  });
}

// ── New care modal ─────────────────────────────────────────────────────────────
const PRIORITY_LABELS = ['Low', 'Normal', 'High', 'Urgent'];

// Pre-built case-insensitive lookup for CARE_CFG (e.g. 'crisis' → 'Crisis')
const _CARE_CFG_LC = Object.fromEntries(Object.keys(CARE_CFG).map(k => [k.toLowerCase(), k]));

// Resolve CARE_CFG entry — exact match first, then case-insensitive fallback
function _cfgFor(careTypeValue) {
  if (!careTypeValue) return null;
  return CARE_CFG[careTypeValue] || CARE_CFG[_CARE_CFG_LC[careTypeValue.toLowerCase()]] || null;
}

// Render a workflow guide <details> block for a given care type value
function _workflowGuideHtml(careTypeValue) {
  const cfg = _cfgFor(careTypeValue);
  const t   = CARE_TYPES[careTypeValue] || CARE_TYPES[careTypeValue?.toLowerCase()] || {};
  if (!cfg || !cfg.stages) return '';
  const color = cfg.color || '#5b9bd5';
  const stagesHtml = cfg.stages.map(s =>
    `<div class="life-wg-stage"><div class="life-wg-stage-t">${_e(s.t)}</div><div class="life-wg-stage-d">${_e(s.d)}</div></div>`
  ).join('');
  const watchHtml = cfg.watchFor?.length
    ? `<details class="life-wg-watch"><summary>⚠ Watch For</summary><div class="life-wg-watch-body">${
        cfg.watchFor.map(w => `<div class="life-wg-watch-item">${_e(w)}</div>`).join('')
      }</div></details>`
    : '';
  const checklistHtml = cfg.closureChecklist?.length
    ? `<details class="life-wg-check"><summary>✓ Closure Checklist</summary><div class="life-wg-check-body">${
        cfg.closureChecklist.map(c => `<label class="life-wg-check-item"><input type="checkbox"> ${_e(c)}</label>`).join('')
      }</div></details>`
    : '';
  return `<details class="life-workflow-guide" style="--wg-color:${color}">
    <summary class="life-wg-summary">${t.icon || '🫱'} ${_e(careTypeValue)} — Workflow Guide</summary>
    <div class="life-wg-body">
      <div class="life-wg-stages">${stagesHtml}</div>
      ${watchHtml}${checklistHtml}
    </div>
  </details>`;
}

// ── Member name helper ────────────────────────────────────────────────────────
function _memberName(m) {
  return m.preferredName
    || (((m.firstName || '') + ' ' + (m.lastName || '')).trim())
    || m.displayName || m.name || m.email || '';
}

// ── Find Lead Pastor from member directory ────────────────────────────────────
// Self-healing resolver. Priority:
//   (0) Cached LP record (in-memory + localStorage) — survives empty member
//       directory loads, Map-vs-array param confusion, and view re-mounts.
//   (1) Match by configured LEAD_PASTOR_MEMBER_ID AppConfig (memberPin/id/
//       memberNumber/uid/email) inside the supplied directory.
//   (2) Fall back to role/memberType containing "pastor".
// On every successful resolution we update the cache so the next call cannot
// regress to "Unassigned" even if upstream loads fail.
function _findLeadPastor(members, lpConfigId) {
  const list = Array.isArray(members) ? members : [];
  const cfgId = String(lpConfigId || _lpConfigId || '').trim();

  // (0) Cached record — verify it still belongs to the current LP config.
  if (_lpRecordCache) {
    const r = _lpRecordCache;
    const matchesCfg = !cfgId
      || r.memberPin === cfgId
      || r.memberNumber === cfgId
      || r.id === cfgId
      || r.uid === cfgId
      || r.docId === cfgId
      || (r.email && r.email.toLowerCase() === cfgId.toLowerCase());
    if (matchesCfg) {
      // Refresh from directory if a fresher copy exists, but always succeed.
      if (cfgId && list.length) {
        const fresh = list.find(m =>
          m.memberPin === cfgId
          || m.memberNumber === cfgId
          || m.id === cfgId
          || m.uid === cfgId
          || m.docId === cfgId
          || (m.email && m.email.toLowerCase() === cfgId.toLowerCase())
        );
        if (fresh) {
          _lpRecordCache = fresh;
          _saveLpToLocalStorage(cfgId, fresh);
          return fresh;
        }
      }
      return _lpRecordCache;
    }
    // Cache no longer matches the configured LP — invalidate it.
    _lpRecordCache = null;
  }

  // (1) Resolve from directory by configured id.
  if (cfgId) {
    const byId = list.find(m =>
      m.memberPin === cfgId
      || m.memberNumber === cfgId
      || m.id === cfgId
      || m.uid === cfgId
      || m.docId === cfgId
      || (m.email && m.email.toLowerCase() === cfgId.toLowerCase())
    );
    if (byId) {
      _lpRecordCache = byId;
      _saveLpToLocalStorage(cfgId, byId);
      return byId;
    }
  }

  // (2) Last resort: role-based lookup.
  const PASTOR_ROLES = ['lead pastor','senior pastor','lead','pastor'];
  const byRole = list.find(m => {
    const r = String(m.role || m.memberType || '').toLowerCase();
    return PASTOR_ROLES.some(pr => r === pr || r.startsWith(pr));
  });
  if (byRole) {
    _lpRecordCache = byRole;
    if (cfgId) _saveLpToLocalStorage(cfgId, byRole);
  }
  return byRole;
}

// Returns true if the currently signed-in user is in the Lead Pastor Group
function _isLeadPastorGroup(members) {
  try {
    const PASTOR_ROLES = ['lead pastor', 'senior pastor', 'lead', 'pastor'];
    const _matchRole = (r) => { const s = String(r || '').toLowerCase(); return PASTOR_ROLES.some(pr => s === pr || s.startsWith(pr)); };
    // 1. Nehemiah session profile (most reliable — auth goes through GAS, not Firebase)
    const p = typeof profile === 'function' ? profile() : null;
    if (p) {
      if (_matchRole(p.role || p.memberType)) return true;
      // Also check against member directory by email if role not on profile
      const pEmail = (p.email || '').toLowerCase();
      if (pEmail) {
        const m = members.find(m => (m.email || '').toLowerCase() === pEmail);
        if (m && _matchRole(m.role || m.memberType)) return true;
      }
    }
    // 2. Firebase auth fallback
    const fb    = typeof firebase !== 'undefined' && firebase.auth?.();
    const uid   = fb?.currentUser?.uid   || '';
    const email = (fb?.currentUser?.email || '').toLowerCase();
    if (!uid && !email) return false;
    return members.some(m => {
      const isMe = (uid   && (m.id === uid || m.uid === uid || m.docId === uid))
                || (email && (m.email || '').toLowerCase() === email);
      return isMe && _matchRole(m.role || m.memberType);
    });
  } catch { return false; }
}

// ── Build a caregiver <select> (all members, sorted) ────────────────────────
function _caregiverSelect(members, fieldName, defaultId, placeholder) {
  const sorted = _dedupeMembers(members).sort((a, b) => _memberName(a).localeCompare(_memberName(b)));
  // Resolve ID: try several common field names
  function _mid(m) { return m.memberPin || m.memberNumber || m.id || m.uid || m.docId || m.email || ''; }
  // Match defaultId against EVERY identifier we know about — care cases store
  // memberPin (SSN-style) here, but other surfaces may store docId/uid/email.
  // If any field matches, render the option value AS defaultId so an unchanged
  // submit doesn't silently rewrite the stored id format.
  const dRaw = defaultId == null ? '' : String(defaultId).trim();
  const dLow = dRaw.toLowerCase();
  function _matchesDefault(m) {
    if (!dRaw) return false;
    return m.memberPin    === dRaw
        || m.memberNumber === dRaw
        || m.id           === dRaw
        || m.uid          === dRaw
        || m.docId        === dRaw
        || (m.email        && m.email.toLowerCase()        === dLow)
        || (m.primaryEmail && m.primaryEmail.toLowerCase() === dLow);
  }
  return `<select class="life-sheet-input" data-field="${_e(fieldName)}">
    <option value="">${_e(placeholder || '— None —')}</option>
    ${sorted.map(m => {
      const matches = _matchesDefault(m);
      const value   = matches ? dRaw : _mid(m);
      const sel     = matches ? ' selected' : '';
      const role = m.role || m.memberType || '';
      return `<option value="${_e(value)}"${sel}>${_e(_memberName(m))}${role ? '  (' + role + ')' : ''}</option>`;
    }).join('')}
  </select>`;
}

// ── Build a member picker: search + select that collapses to a chip ──────────
function _memberPickerHtml(members, fieldName) {
  const sorted = _dedupeMembers(members).sort((a, b) => _memberName(a).localeCompare(_memberName(b)));
  function _mid(m) { return m.id || m.uid || m.docId || m.memberNumber || m.email || ''; }
  return `
    <div class="life-member-picker" data-picker-for="${_e(fieldName)}">
      <input type="hidden" data-field="${_e(fieldName)}" value="">
      <div class="life-member-picker-search-wrap">
        <input class="life-member-search" type="search" placeholder="Search members…"
               aria-label="Search members" autocomplete="off">
        <select class="life-member-select" size="5" data-member-sel="${_e(fieldName)}">
          <option value="">— Select a member —</option>
          ${sorted.map(m => {
            const id   = _mid(m);
            const disp = _memberName(m);
            const role = m.role || m.memberType || '';
            return `<option value="${_e(id)}" data-n="${_e(disp.toLowerCase())}">${_e(disp)}${role ? '  (' + role + ')' : ''}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="life-member-chip" style="display:none">
        <span class="life-member-chip-name"></span>
        <button type="button" class="life-member-chip-clear" aria-label="Clear member selection">&#x2715;</button>
      </div>
    </div>`;
}

function _newCareModal(memberDir, onSave) {
  _closeSheet();
  const V   = window.TheVine;
  const MXC = buildAdapter('flock.care', V);
  const hasMemberDir = memberDir && memberDir.length > 0;
  const leadPastor   = _findLeadPastor(memberDir || [], _lpConfigId);
  const lpId         = leadPastor ? (leadPastor.id || leadPastor.uid || leadPastor.docId || leadPastor.memberNumber || leadPastor.email || '') : '';

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="New Care Case">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info"><div class="life-sheet-hd-name">New Care Case</div></div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <!-- Member picker -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Member</div>
          ${hasMemberDir
            ? _memberPickerHtml(memberDir, 'memberId')
            : `<input class="life-sheet-input" data-field="memberId" type="text" placeholder="Member email or ID">`}
        </div>
        <!-- Care Type -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Care Type</div>
          <select class="life-sheet-input" data-field="careType">
            <optgroup label="Crisis & Safety">
              <option value="Crisis">🚨 Crisis</option>
              <option value="Abuse / Domestic Violence">🛡️ Abuse / Domestic Violence</option>
            </optgroup>
            <optgroup label="Medical & Physical">
              <option value="Hospital Visit">🏥 Hospital Visit</option>
              <option value="Medical">🩺 Medical</option>
              <option value="Elder Care">🧓 Elder Care</option>
              <option value="Terminal Illness / End of Life">🕯️ Terminal Illness / End of Life</option>
            </optgroup>
            <optgroup label="Grief & Loss">
              <option value="Grief">🤍 Grief</option>
              <option value="Pregnancy &amp; Infant Loss">🕊️ Pregnancy &amp; Infant Loss</option>
            </optgroup>
            <optgroup label="Relationships">
              <option value="Marriage">💍 Marriage</option>
              <option value="Pre-Marriage">💑 Pre-Marriage</option>
              <option value="Family">👨‍👩‍👧 Family</option>
            </optgroup>
            <optgroup label="Addiction &amp; Recovery">
              <option value="Addiction">🔗 Addiction</option>
              <option value="Pornography / Sexual Addiction">🔒 Pornography / Sexual Addiction</option>
            </optgroup>
            <optgroup label="Mental &amp; Emotional Health">
              <option value="Mental Health">🧠 Mental Health</option>
              <option value="Counseling">💬 Counseling</option>
            </optgroup>
            <optgroup label="Discipleship &amp; Growth">
              <option value="New Believer">✨ New Believer</option>
              <option value="New Member Integration">🤝 New Member Integration</option>
              <option value="Discipleship">📚 Discipleship</option>
              <option value="Shepherding">🐑 Shepherding</option>
              <option value="Restoration">🔄 Restoration</option>
            </optgroup>
            <optgroup label="Life Situations">
              <option value="Financial">💰 Financial</option>
              <option value="Immigration / Deportation">✈️ Immigration / Deportation</option>
              <option value="Incarceration &amp; Re-Entry">🔑 Incarceration &amp; Re-Entry</option>
              <option value="Gender Identity / Sexuality">✝️ Gender Identity / Sexuality</option>
            </optgroup>
            <optgroup label="General">
              <option value="Prayer Request">🙏 Prayer Request</option>
              <option value="Follow-Up">📞 Follow-Up</option>
              <option value="Life Milestone">🎉 Life Milestone</option>
              <option value="Other">🫱 Other</option>
            </optgroup>
          </select>
        </div>
        <!-- Priority -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Priority</div>
          <div class="life-status-row">
            ${PRIORITY_LABELS.map((p) => `<button class="life-status-pill" data-priority="${_e(p.toLowerCase())}">${_e(p)}</button>`).join('')}
          </div>
        </div>
        <!-- Workflow guide (updates dynamically with care type) -->
        <div class="life-wg-field" data-wg-placeholder></div>
        <!-- Assigned To (Lead Pastor default) -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">
            Assigned To
            ${leadPastor ? `<span class="life-field-hint">Defaulting to Lead Pastor</span>` : ''}
          </div>
          ${hasMemberDir
            ? _caregiverSelect(memberDir, 'assignee', lpId, '— Unassigned —')
            : `<input class="life-sheet-input" data-field="assignee" type="text" placeholder="Caregiver name or email" value="${_e(leadPastor ? _memberName(leadPastor) : '')}">`}
        </div>
        <!-- Secondary Caregiver -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">
            Secondary Caregiver
            <span class="life-field-hint">Also gets access to view this case</span>
          </div>
          ${hasMemberDir
            ? _caregiverSelect(memberDir, 'secondary', '', '— None —')
            : `<input class="life-sheet-input" data-field="secondary" type="text" placeholder="Secondary caregiver (optional)">`}
        </div>
        <!-- Summary -->
        <div class="life-sheet-field">
          <div class="life-sheet-label">Summary</div>
          <textarea class="life-sheet-ta" data-field="summary" rows="3" placeholder="What's the situation?"></textarea>
        </div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>Create Case</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
  });

  // Member picker: search filter + collapse-to-chip on selection
  const pickerEl = sheet.querySelector('[data-picker-for]');
  if (pickerEl) {
    const hiddenInput = pickerEl.querySelector('[data-field]');
    const searchInput = pickerEl.querySelector('.life-member-search');
    const selEl       = pickerEl.querySelector('[data-member-sel]');
    const searchWrap  = pickerEl.querySelector('.life-member-picker-search-wrap');
    const chipEl      = pickerEl.querySelector('.life-member-chip');
    const chipName    = chipEl.querySelector('.life-member-chip-name');
    const chipClear   = chipEl.querySelector('.life-member-chip-clear');

    searchInput?.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      Array.from(selEl.options).forEach(opt => {
        opt.hidden = !!(q && opt.value && !opt.dataset.n?.includes(q));
      });
    });

    selEl?.addEventListener('change', () => {
      const val = selEl.value;
      if (!val) return;
      const rawLabel = selEl.options[selEl.selectedIndex]?.text || val;
      const label    = rawLabel.replace(/\s{2,}\(.*\)$/, '').trim(); // strip role suffix
      hiddenInput.value     = val;
      chipName.textContent  = label;
      searchWrap.style.display = 'none';
      chipEl.style.display    = 'flex';
    });

    chipClear?.addEventListener('click', () => {
      hiddenInput.value = '';
      selEl.value       = '';
      if (searchInput) searchInput.value = '';
      Array.from(selEl.options).forEach(opt => { opt.hidden = false; });
      chipEl.style.display    = 'none';
      searchWrap.style.display = '';
      searchInput?.focus();
    });
  }

  // Priority pills
  sheet.querySelectorAll('[data-priority]').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('[data-priority]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  // Care type wiring: auto-set priority + fill notes template + update workflow guide
  const careTypeSel   = sheet.querySelector('[data-field="careType"]');
  const summaryTa     = sheet.querySelector('[data-field="summary"]');
  const wgPlaceholder = sheet.querySelector('[data-wg-placeholder]');

  let _lastAppliedType = null;
  function _applyModalType(val) {
    if (!val) return;
    const t = CARE_TYPES[val] || {};
    // Auto-set priority pill
    const pri = t.priority || 'normal';
    sheet.querySelectorAll('[data-priority]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.priority === pri);
    });
    // NOTE: do NOT pre-fill the Summary textarea with the care-type notes
    // template. That template is meant to populate the case notes for the
    // Lead Pastor AFTER the case is created \u2014 not to overwrite the
    // intake summary the reporter is typing in this modal.
    // Update workflow guide
    if (wgPlaceholder) wgPlaceholder.innerHTML = _workflowGuideHtml(val);
    _lastAppliedType = val;
  }

  if (careTypeSel) {
    careTypeSel.addEventListener('change', () => _applyModalType(careTypeSel.value));
    // Apply immediately on open so the guide shows and default priority is set
    _applyModalType(careTypeSel.value);
  }

  sheet.querySelector('[data-cancel]').addEventListener('click', () => _closeSheet());
  sheet.querySelector('.life-sheet-close').addEventListener('click', () => _closeSheet());

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const memberId  = sheet.querySelector('[data-field="memberId"]').value.trim();
    const careType  = sheet.querySelector('[data-field="careType"]').value;
    const priority  = sheet.querySelector('[data-priority].is-active')?.dataset.priority || 'normal';
    const assignee  = sheet.querySelector('[data-field="assignee"]')?.value?.trim() || '';
    const secondary = sheet.querySelector('[data-field="secondary"]')?.value?.trim() || '';
    const summary   = sheet.querySelector('[data-field="summary"]').value.trim();
    if (!memberId) { sheet.querySelector('[data-field="memberId"]').focus(); return; }
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      // Auto-assign to the configured Lead Pastor when no caregiver was picked.
      const finalAssignee = assignee || lpId || '';
      const payload = {
        memberId,
        careType,
        priority,
        status: 'Open',
      };
      if (finalAssignee) payload.primaryCaregiverId   = finalAssignee;
      if (secondary)     payload.secondaryCaregiverId = secondary;
      if (summary)       payload.summary              = summary;
      await MXC.create(payload);
      _closeSheet();
      if (onSave) onSave();
    } catch (err) {
      console.error('[TheLife] care.create error:', err);
      btn.disabled = false; btn.textContent = 'Create Case';
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// CARE ASSIGNMENTS / COMPASSION REQUESTS / TODOS
// ══════════════════════════════════════════════════════════════════════════════

const TODO_STATUSES       = ['Not Started', 'In Progress', 'Done', 'Archived'];
const TODO_PRIORITIES     = ['Low', 'Medium', 'High', 'Urgent'];
const COMPASSION_STATUSES = ['Pending', 'Approved', 'Denied', 'Resolved'];
const COMPASSION_TYPES    = ['Financial', 'Food', 'Housing', 'Transportation', 'Medical', 'Utility', 'Other'];
const ASSIGN_ROLES        = ['Shepherd', 'Mentor', 'Care Team', 'Discipleship', 'Other'];

function _ts(v) {
  if (!v) return '';
  const ms = v?.seconds ? v.seconds * 1000 : new Date(v).getTime();
  return ms && !isNaN(ms) ? ms : '';
}

function _fmtDate(v) {
  const ms = _ts(v);
  if (!ms) return '';
  return new Date(ms).toLocaleDateString();
}

function _emptyState(msg) {
  return `<div class="life-empty" style="padding:32px;text-align:center;color:var(--ink-muted,#7a7f96)">${_e(msg)}</div>`;
}

// ── CARE ASSIGNMENTS ─────────────────────────────────────────────────────────
async function _loadAssignments(root, memberDir) {
  const host = root.querySelector('[data-bind="assignments"]');
  if (!host) return;
  const UR = window.UpperRoom;
  if (!UR || typeof UR.listCareAssignments !== 'function') {
    host.innerHTML = _emptyState('Assignments require Firestore (UpperRoom) — not available.');
    return;
  }
  host.innerHTML = '<div class="life-loading">Loading assignments…</div>';
  try {
    const rows = await UR.listCareAssignments({ limit: 80 });
    if (!rows || !rows.length) {
      host.innerHTML = _emptyState('No active care assignments. Use "Assign" to pair a member with a caregiver.');
      return;
    }
    const memberMap = _buildMemberIndex(memberDir || []);
    host.innerHTML = `<div class="life-queue">${rows.map(r => _assignCard(r, memberMap)).join('')}</div>`;
    host.querySelectorAll('[data-assign-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-end-assign]')) return;
        const id = card.dataset.assignId;
        const item = rows.find(r => String(r.id) === id);
        if (item) _openAssignSheet(item, memberDir, () => _loadAssignments(root, memberDir));
      });
      const endBtn = card.querySelector('[data-end-assign]');
      if (endBtn) {
        endBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = card.dataset.assignId;
          if (!confirm('End this assignment?')) return;
          try { await UR.endCareAssignment(id); _loadAssignments(root, memberDir); }
          catch (err) { console.error('[TheLife] endCareAssignment:', err); }
        });
      }
    });
  } catch (err) {
    console.error('[TheLife] listCareAssignments:', err);
    host.innerHTML = _emptyState('Could not load assignments right now.');
  }
}

function _assignCard(a, memberMap) {
  const memberName    = _resolveName(a.memberId, memberMap)    || a.memberName    || a.memberId    || '—';
  const caregiverName = _resolveName(a.caregiverId, memberMap) || a.caregiverName || a.caregiverId || '—';
  const role   = a.role || 'Shepherd';
  const status = a.status || 'Active';
  const isActive = status === 'Active';
  return /* html */`
    <article class="life-card" data-assign-id="${_e(String(a.id || ''))}" tabindex="0">
      <div class="life-card-icon">🤝</div>
      <div class="life-card-body">
        <div class="life-card-top">
          <span class="life-card-name">${_e(memberName)}</span>
          <span class="life-type-badge">${_e(role)}</span>
          <span class="life-priority-badge" style="color:${isActive ? '#0ea5e9' : '#6b7280'}; background:${isActive ? 'rgba(14,165,233,0.10)' : 'rgba(107,114,128,0.10)'}">${_e(status)}</span>
        </div>
        <div class="life-card-note">Caregiver: ${_e(caregiverName)}${a.notes ? ' &bull; ' + _e(a.notes) : ''}</div>
        <div class="life-card-foot">
          <span class="life-days">${_e(_fmtDate(a.createdAt) || '')}</span>
        </div>
      </div>
      ${isActive ? `<div class="life-card-actions">
        <button class="life-action-btn" title="End assignment" data-end-assign aria-label="End">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>` : ''}
    </article>`;
}

function _openAssignSheet(item, memberDir, onSave) {
  _closeSheet();
  const UR = window.UpperRoom;
  if (!UR) return;
  const isEdit = !!item;
  const hasDir = memberDir && memberDir.length > 0;

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isEdit ? 'Edit Assignment' : 'New Assignment'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info"><div class="life-sheet-hd-name">${isEdit ? 'Reassign Caregiver' : 'New Care Assignment'}</div></div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Member</div>
          ${hasDir
            ? (isEdit
                ? `<input class="life-sheet-input" type="text" value="${_e(_resolveName(item.memberId, _buildMemberIndex(memberDir)) || item.memberId || '')}" disabled>
                   <input type="hidden" data-field="memberId" value="${_e(item.memberId || '')}">`
                : _memberPickerHtml(memberDir, 'memberId'))
            : `<input class="life-sheet-input" data-field="memberId" type="text" value="${_e(item?.memberId || '')}" placeholder="Member email or ID" ${isEdit ? 'disabled' : ''}>`}
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">${isEdit ? 'New Caregiver' : 'Caregiver'}</div>
          ${hasDir
            ? _caregiverSelect(memberDir, 'caregiverId', isEdit ? '' : (item?.caregiverId || ''), '— Select caregiver —')
            : `<input class="life-sheet-input" data-field="caregiverId" type="text" value="${_e(item?.caregiverId || '')}" placeholder="Caregiver email or ID">`}
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Role</div>
          <select class="life-sheet-input" data-field="role">
            ${ASSIGN_ROLES.map(r => `<option value="${_e(r)}"${(item?.role || 'Shepherd') === r ? ' selected' : ''}>${_e(r)}</option>`).join('')}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Notes</div>
          <textarea class="life-sheet-ta" data-field="notes" rows="3" placeholder="Why this pairing? Boundaries, scope…">${_e(item?.notes || '')}</textarea>
        </div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>${isEdit ? 'Reassign' : 'Create Assignment'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
  });

  // Member picker wiring (new only)
  if (!isEdit) _wireMemberPicker(sheet);

  sheet.querySelector('[data-cancel]').addEventListener('click', () => _closeSheet());
  sheet.querySelector('.life-sheet-close').addEventListener('click', () => _closeSheet());

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const memberId    = sheet.querySelector('[data-field="memberId"]').value.trim();
    const caregiverId = sheet.querySelector('[data-field="caregiverId"]').value.trim();
    const role        = sheet.querySelector('[data-field="role"]').value;
    const notes       = sheet.querySelector('[data-field="notes"]').value.trim();
    if (!memberId)    { sheet.querySelector('[data-field="memberId"]').focus(); return; }
    if (!caregiverId) { sheet.querySelector('[data-field="caregiverId"]').focus(); return; }
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (isEdit) {
        await UR.reassignCareAssignment({ id: item.id, newCaregiverId: caregiverId, notes });
      } else {
        await UR.createCareAssignment({ memberId, caregiverId, role, notes, status: 'Active' });
      }
      _closeSheet();
      if (onSave) onSave();
    } catch (err) {
      console.error('[TheLife] save assignment:', err);
      btn.disabled = false; btn.textContent = isEdit ? 'Reassign' : 'Create Assignment';
    }
  });
}

// ── COMPASSION REQUESTS ──────────────────────────────────────────────────────
async function _loadCompassion(root, memberDir) {
  const host = root.querySelector('[data-bind="compassion"]');
  if (!host) return;
  const UR = window.UpperRoom;
  if (!UR || typeof UR.listCompassionRequests !== 'function') {
    host.innerHTML = _emptyState('Compassion requests require Firestore (UpperRoom) — not available.');
    return;
  }
  host.innerHTML = '<div class="life-loading">Loading compassion requests…</div>';
  try {
    const res  = await UR.listCompassionRequests({ limit: 80 });
    const rows = Array.isArray(res) ? res : (res?.results || res?.rows || []);
    if (!rows.length) {
      host.innerHTML = _emptyState('No compassion requests on file. Use "New Request" to log one.');
      return;
    }
    const memberMap = _buildMemberIndex(memberDir || []);
    host.innerHTML = `<div class="life-queue">${rows.map(r => _compassionCard(r, memberMap)).join('')}</div>`;
    host.querySelectorAll('[data-compassion-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.compassionId;
        const item = rows.find(r => String(r.id) === id);
        if (item) _openCompassionSheet(item, memberDir, () => _loadCompassion(root, memberDir));
      });
    });
  } catch (err) {
    console.error('[TheLife] listCompassionRequests:', err);
    host.innerHTML = _emptyState('Could not load compassion requests right now.');
  }
}

function _compassionCard(r, memberMap) {
  const name = _resolveName(r.memberId, memberMap) || r.memberName || r.requesterName || r.memberId || '—';
  const type = r.type || r.requestType || 'Other';
  const amt  = r.amount ? `$${Number(r.amount).toLocaleString()}` : '';
  const status = r.status || 'Pending';
  const statusColor = status === 'Approved' ? '#10b981' : status === 'Denied' ? '#dc2626' : status === 'Resolved' ? '#6b7280' : '#e8a838';
  const statusBg    = status === 'Approved' ? 'rgba(16,185,129,0.10)' : status === 'Denied' ? 'rgba(220,38,38,0.10)' : status === 'Resolved' ? 'rgba(107,114,128,0.10)' : 'rgba(232,168,56,0.13)';
  const desc = r.description || r.summary || r.notes || '';
  return /* html */`
    <article class="life-card" data-compassion-id="${_e(String(r.id || ''))}" tabindex="0">
      <div class="life-card-icon">💝</div>
      <div class="life-card-body">
        <div class="life-card-top">
          <span class="life-card-name">${_e(name)}</span>
          <span class="life-type-badge">${_e(type)}${amt ? ' &bull; ' + _e(amt) : ''}</span>
          <span class="life-priority-badge" style="color:${statusColor};background:${statusBg}">${_e(status)}</span>
        </div>
        <div class="life-card-note">${_e(desc)}</div>
        <div class="life-card-foot">
          <span class="life-days">${_e(_fmtDate(r.createdAt) || '')}</span>
        </div>
      </div>
    </article>`;
}

function _openCompassionSheet(item, memberDir, onSave) {
  _closeSheet();
  const UR = window.UpperRoom;
  if (!UR) return;
  const isEdit = !!item;
  const hasDir = memberDir && memberDir.length > 0;
  const currentStatus = item?.status || 'Pending';

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isEdit ? 'Edit Compassion Request' : 'New Compassion Request'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info"><div class="life-sheet-hd-name">${isEdit ? 'Compassion Request' : 'New Compassion Request'}</div></div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Status</div>
          <div class="life-status-row">
            ${COMPASSION_STATUSES.map(s => `<button class="life-status-pill${s === currentStatus ? ' is-active' : ''}" data-status="${_e(s)}">${_e(s)}</button>`).join('')}
          </div>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Member</div>
          ${hasDir
            ? (isEdit
                ? `<input class="life-sheet-input" type="text" value="${_e(_resolveName(item.memberId, _buildMemberIndex(memberDir)) || item.memberId || '')}" disabled>
                   <input type="hidden" data-field="memberId" value="${_e(item.memberId || '')}">`
                : _memberPickerHtml(memberDir, 'memberId'))
            : `<input class="life-sheet-input" data-field="memberId" type="text" value="${_e(item?.memberId || '')}" placeholder="Member email or ID" ${isEdit ? 'disabled' : ''}>`}
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Type</div>
          <select class="life-sheet-input" data-field="type">
            ${COMPASSION_TYPES.map(t => `<option value="${_e(t)}"${(item?.type || 'Other') === t ? ' selected' : ''}>${_e(t)}</option>`).join('')}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Amount (optional)</div>
          <input class="life-sheet-input" data-field="amount" type="number" min="0" step="0.01" value="${_e(item?.amount ?? '')}" placeholder="0.00">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Description / Need</div>
          <textarea class="life-sheet-ta" data-field="description" rows="4" placeholder="What is the need?">${_e(item?.description || item?.summary || '')}</textarea>
        </div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>${isEdit ? 'Save Changes' : 'Create Request'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
  });

  if (!isEdit) _wireMemberPicker(sheet);

  sheet.querySelectorAll('.life-status-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('.life-status-pill').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  sheet.querySelector('[data-cancel]').addEventListener('click', () => _closeSheet());
  sheet.querySelector('.life-sheet-close').addEventListener('click', () => _closeSheet());

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const memberId    = sheet.querySelector('[data-field="memberId"]').value.trim();
    const type        = sheet.querySelector('[data-field="type"]').value;
    const amount      = sheet.querySelector('[data-field="amount"]').value;
    const description = sheet.querySelector('[data-field="description"]').value.trim();
    const status      = sheet.querySelector('.life-status-pill.is-active')?.dataset.status || currentStatus;
    if (!memberId) { sheet.querySelector('[data-field="memberId"]').focus(); return; }
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Saving…';
    const payload = {
      memberId, type, status, description,
      amount: amount ? Number(amount) : undefined,
    };
    try {
      if (isEdit) {
        await UR.updateCompassionRequest(Object.assign({ id: item.id }, payload));
      } else {
        await UR.createCompassionRequest(payload);
      }
      _closeSheet();
      if (onSave) onSave();
    } catch (err) {
      console.error('[TheLife] save compassion:', err);
      btn.disabled = false; btn.textContent = isEdit ? 'Save Changes' : 'Create Request';
    }
  });
}

// ── TODOS ────────────────────────────────────────────────────────────────────
async function _loadTodos(root, memberDir) {
  const host = root.querySelector('[data-bind="todos"]');
  if (!host) return;
  const UR = window.UpperRoom;
  if (!UR || typeof UR.listTodos !== 'function') {
    host.innerHTML = _emptyState('Todos require Firestore (UpperRoom) — not available.');
    return;
  }
  host.innerHTML = '<div class="life-loading">Loading todos…</div>';
  try {
    const res  = await UR.listTodos({ limit: 100 });
    const all  = Array.isArray(res) ? res : (res?.results || res?.rows || []);
    const rows = all.filter(t => (t.status || 'Not Started') !== 'Archived');
    if (!rows.length) {
      host.innerHTML = _emptyState('No open todos. Use "Add Todo" to create one.');
      return;
    }
    const memberMap = _buildMemberIndex(memberDir || []);
    host.innerHTML = `<div class="life-queue">${rows.map(t => _todoCard(t, memberMap)).join('')}</div>`;
    host.querySelectorAll('[data-todo-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-todo-complete]')) return;
        const id = card.dataset.todoId;
        const item = rows.find(t => String(t.id) === id);
        if (item) _openTodoSheet(item, memberDir, () => _loadTodos(root, memberDir));
      });
      const cBtn = card.querySelector('[data-todo-complete]');
      if (cBtn) {
        cBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = card.dataset.todoId;
          try { await UR.completeTodo(id); _loadTodos(root, memberDir); }
          catch (err) { console.error('[TheLife] completeTodo:', err); }
        });
      }
    });
  } catch (err) {
    console.error('[TheLife] listTodos:', err);
    host.innerHTML = _emptyState('Could not load todos right now.');
  }
}

function _todoCard(t, memberMap) {
  const title    = t.title || '(untitled)';
  const priority = t.priority || 'Medium';
  const status   = t.status || 'Not Started';
  const isDone   = status === 'Done';
  const assigned = _resolveName(t.assignedTo, memberMap) || t.assignedTo || 'Unassigned';
  const due      = _fmtDate(t.dueDate);
  const priColor = priority === 'Urgent' ? '#dc2626' : priority === 'High' ? '#e8a838' : priority === 'Low' ? '#6b7280' : '#0ea5e9';
  const priBg    = priority === 'Urgent' ? 'rgba(220,38,38,0.10)' : priority === 'High' ? 'rgba(232,168,56,0.13)' : priority === 'Low' ? 'rgba(107,114,128,0.10)' : 'rgba(14,165,233,0.10)';
  return /* html */`
    <article class="life-card" data-todo-id="${_e(String(t.id || ''))}" tabindex="0" style="${isDone ? 'opacity:0.55;' : ''}">
      <div class="life-card-icon">${isDone ? '✅' : '📋'}</div>
      <div class="life-card-body">
        <div class="life-card-top">
          <span class="life-card-name" style="${isDone ? 'text-decoration:line-through;' : ''}">${_e(title)}</span>
          <span class="life-priority-badge" style="color:${priColor};background:${priBg}">${_e(priority)}</span>
          <span class="life-type-badge">${_e(status)}</span>
        </div>
        ${t.description ? `<div class="life-card-note">${_e(t.description)}</div>` : ''}
        <div class="life-card-foot">
          <span class="life-assignee">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${_e(assigned)}
          </span>
          ${due ? `<span class="life-days">Due ${_e(due)}</span>` : ''}
        </div>
      </div>
      ${!isDone ? `<div class="life-card-actions">
        <button class="life-action-btn" title="Mark done" data-todo-complete aria-label="Done">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>` : ''}
    </article>`;
}

function _openTodoSheet(item, memberDir, onSave) {
  _closeSheet();
  const UR = window.UpperRoom;
  if (!UR) return;
  const isEdit = !!item;
  const hasDir = memberDir && memberDir.length > 0;
  const currentStatus   = item?.status   || 'Not Started';
  const currentPriority = item?.priority || 'Medium';
  const dueIso = (() => {
    const ms = _ts(item?.dueDate);
    if (!ms) return item?.dueDate || '';
    return new Date(ms).toISOString().slice(0, 10);
  })();

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isEdit ? 'Edit Todo' : 'New Todo'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info"><div class="life-sheet-hd-name">${isEdit ? 'Edit Todo' : 'New Todo'}</div></div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">Title</div>
          <input class="life-sheet-input" data-field="title" type="text" value="${_e(item?.title || '')}" placeholder="What needs to be done?">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Status</div>
          <div class="life-status-row">
            ${TODO_STATUSES.map(s => `<button class="life-status-pill${s === currentStatus ? ' is-active' : ''}" data-status="${_e(s)}">${_e(s)}</button>`).join('')}
          </div>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Priority</div>
          <div class="life-status-row">
            ${TODO_PRIORITIES.map(p => `<button class="life-status-pill${p === currentPriority ? ' is-active' : ''}" data-priority="${_e(p)}">${_e(p)}</button>`).join('')}
          </div>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Assigned To</div>
          ${hasDir
            ? _caregiverSelect(memberDir, 'assignedTo', item?.assignedTo || '', '— Unassigned —')
            : `<input class="life-sheet-input" data-field="assignedTo" type="text" value="${_e(item?.assignedTo || '')}" placeholder="Email or member id">`}
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Due Date</div>
          <input class="life-sheet-input" data-field="dueDate" type="date" value="${_e(dueIso)}">
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Description</div>
          <textarea class="life-sheet-ta" data-field="description" rows="3" placeholder="Details, links, context…">${_e(item?.description || '')}</textarea>
        </div>
      </div>
      <div class="life-sheet-foot">
        ${isEdit ? `<button class="flock-btn flock-btn--danger" data-delete style="margin-right:auto">Delete</button>` : ''}
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>${isEdit ? 'Save Changes' : 'Add Todo'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
  });

  // Status pills (single-select within their row)
  sheet.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('[data-status]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });
  sheet.querySelectorAll('[data-priority]').forEach(btn => {
    btn.addEventListener('click', () => {
      sheet.querySelectorAll('[data-priority]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  sheet.querySelector('[data-cancel]').addEventListener('click', () => _closeSheet());
  sheet.querySelector('.life-sheet-close').addEventListener('click', () => _closeSheet());

  sheet.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm('Delete this todo?')) return;
    try { await UR.deleteTodo(item.id); _closeSheet(); if (onSave) onSave(); }
    catch (err) { console.error('[TheLife] deleteTodo:', err); }
  });

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const title       = sheet.querySelector('[data-field="title"]').value.trim();
    const status      = sheet.querySelector('[data-status].is-active')?.dataset.status     || currentStatus;
    const priority    = sheet.querySelector('[data-priority].is-active')?.dataset.priority || currentPriority;
    const assignedTo  = sheet.querySelector('[data-field="assignedTo"]').value.trim();
    const dueDate     = sheet.querySelector('[data-field="dueDate"]').value;
    const description = sheet.querySelector('[data-field="description"]').value.trim();
    if (!title) { sheet.querySelector('[data-field="title"]').focus(); return; }
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Saving…';
    const payload = { title, status, priority, assignedTo, dueDate, description };
    try {
      if (isEdit) {
        await UR.updateTodo(item.id, payload);
      } else {
        await UR.createTodo(payload);
      }
      _closeSheet();
      if (onSave) onSave();
    } catch (err) {
      console.error('[TheLife] save todo:', err);
      btn.disabled = false; btn.textContent = isEdit ? 'Save Changes' : 'Add Todo';
    }
  });
}

// ── Member picker wiring (shared helper) ─────────────────────────────────────
function _wireMemberPicker(sheet) {
  const pickerEl = sheet.querySelector('[data-picker-for]');
  if (!pickerEl) return;
  const hiddenInput = pickerEl.querySelector('[data-field]');
  const searchInput = pickerEl.querySelector('.life-member-search');
  const selEl       = pickerEl.querySelector('[data-member-sel]');
  const searchWrap  = pickerEl.querySelector('.life-member-picker-search-wrap');
  const chipEl      = pickerEl.querySelector('.life-member-chip');
  const chipName    = chipEl?.querySelector('.life-member-chip-name');
  const chipClear   = chipEl?.querySelector('.life-member-chip-clear');
  if (!hiddenInput || !selEl || !searchWrap || !chipEl) return;

  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    Array.from(selEl.options).forEach(opt => {
      opt.hidden = !!(q && opt.value && !opt.dataset.n?.includes(q));
    });
  });
  selEl.addEventListener('change', () => {
    const val = selEl.value;
    if (!val) return;
    const rawLabel = selEl.options[selEl.selectedIndex]?.text || val;
    const label    = rawLabel.replace(/\s{2,}\(.*\)$/, '').trim();
    hiddenInput.value     = val;
    if (chipName) chipName.textContent = label;
    searchWrap.style.display = 'none';
    chipEl.style.display    = 'flex';
  });
  chipClear?.addEventListener('click', () => {
    hiddenInput.value = '';
    selEl.value       = '';
    if (searchInput) searchInput.value = '';
    Array.from(selEl.options).forEach(opt => { opt.hidden = false; });
    chipEl.style.display    = 'none';
    searchWrap.style.display = '';
    searchInput?.focus();
  });
}

// ── Contact Composer ─────────────────────────────────────────────────────────
// Custom-styled compose sheet for text/email outreach. Captures the message,
// logs it as a careInteraction, then hands off to the device's native app
// (sms: or mailto:) pre-filled with the composed body.
let _activeComposer = null;
function _closeComposer() {
  if (!_activeComposer) return;
  const t = _activeComposer;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activeComposer === t) _activeComposer = null; }, 240);
}

export function openContactComposer(opts) { return _openComposer(opts); }
function _openComposer({ channel, name, recipient, target, caseId, sheet, onLogged }) {
  _closeComposer();
  const isText  = channel === 'text';
  const title   = isText ? 'Text Message' : 'Email Message';
  const verbPast= isText ? 'Texted' : 'Emailed';
  const icon    = isText ? '📱' : '✉️';
  const subjectDefault = isText ? '' : `Checking in — from your church family`;

  const wrap = document.createElement('div');
  wrap.className = 'life-sheet life-composer';
  wrap.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel life-composer-panel" role="dialog" aria-label="${_e(title)} to ${_e(name)}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${_e(title)}</div>
          <div class="life-sheet-hd-meta">To ${_e(name)} &bull; ${_e(recipient || '')}</div>
        </div>
        <button class="life-sheet-close" type="button" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body life-composer-body">
        ${!isText ? `
        <div class="life-sheet-field">
          <div class="life-sheet-label">Subject</div>
          <input class="life-sheet-input" data-field="subject" type="text" value="${_e(subjectDefault)}" placeholder="Subject line">
        </div>` : ''}
        <div class="life-sheet-field">
          <div class="life-sheet-label">Message</div>
          <textarea class="life-sheet-ta life-composer-ta" data-field="body" rows="8" placeholder="${isText ? 'Type your text…' : 'Write your note…'}" autofocus></textarea>
          <div class="life-composer-hint">This message will be logged on the case and opened in your device's ${isText ? 'Messages' : 'Mail'} app, pre-filled and ready to send.</div>
        </div>
      </div>
      <div class="life-sheet-foot">
        <button class="flock-btn" type="button" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" type="button" data-send>
          ${isText ? 'Open in Messages' : 'Open in Mail'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  _activeComposer = wrap;
  requestAnimationFrame(() => {
    wrap.querySelector('.life-sheet-overlay').classList.add('is-open');
    wrap.querySelector('.life-sheet-panel').classList.add('is-open');
    wrap.querySelector('.life-composer-ta')?.focus();
  });

  const close = () => _closeComposer();
  wrap.querySelector('.life-sheet-overlay').addEventListener('click', close);
  wrap.querySelector('.life-sheet-close').addEventListener('click', close);
  wrap.querySelector('[data-cancel]').addEventListener('click', close);

  wrap.querySelector('[data-send]').addEventListener('click', async () => {
    const body    = (wrap.querySelector('[data-field="body"]')?.value || '').trim();
    const subject = (wrap.querySelector('[data-field="subject"]')?.value || subjectDefault).trim();
    if (!body) {
      wrap.querySelector('[data-field="body"]')?.focus();
      return;
    }
    const sendBtn = wrap.querySelector('[data-send]');
    sendBtn.disabled = true;
    sendBtn.textContent = 'Logging…';

    // 1) Log the interaction (canonical schema: notes + interactionType)
    if (caseId) {
      const session = window.TheVine?.session?.();
      const header  = `${icon} ${verbPast} ${name}${recipient ? ' (' + recipient + ')' : ''}${!isText && subject ? ' — Subject: ' + subject : ''}`;
      const payload = {
        caseId,
        notes:           `${header}\n\n${body}`,
        interactionType: isText ? 'Text' : 'Email',
        createdBy:       session?.email || '',
        author:          session?.email || '',
      };
      try {
        const UR = window.UpperRoom;
        if (UR && typeof UR.createCareInteraction === 'function') {
          await UR.createCareInteraction(payload);
        } else if (window.TheVine?.flock?.care?.interactions) {
          await window.TheVine.flock.care.interactions.create(payload);
        }
        if (typeof onLogged === 'function') onLogged();
      } catch (e) {
        console.error('[the_life] composer: log failed', e);
      }
    }

    // 2) Hand off to native app, pre-filled with composed body
    try {
      const enc = encodeURIComponent;
      let url;
      if (isText) {
        // iOS uses ?&body=, Android uses ?body=. ?&body= works on both.
        url = `sms:${target || ''}?&body=${enc(body)}`;
      } else {
        const params = [];
        if (subject) params.push('subject=' + enc(subject));
        params.push('body=' + enc(body));
        url = `mailto:${target || ''}?${params.join('&')}`;
      }
      window.location.href = url;
    } catch (e) {
      console.error('[the_life] composer: handoff failed', e);
    }

    close();
  });
}
