/* ══════════════════════════════════════════════════════════════════════════════
   THE LIVING WATER ADAPTER — Shared Firestore-first / GAS-fallback factory
   "He that believeth on me… out of his belly shall flow rivers of living water."
   — John 7:38

   TOPOLOGY RULE (must preserve):
   • When window.UpperRoom.isReady() === true  →  route reads/writes through
     UpperRoom (Firestore-direct).  The Cloud Function trigger mirrors each write
     back to the Sheet via handleSyncWrite (N-Master SyncHandler).
   • When UpperRoom is NOT ready               →  fall back to window.TheVine.*
     (GAS).  GAS-only deployments work identically to before.
   • NEVER remove the GAS path.  GAS remains authoritative for email send + auth
     on every deployment type.

   USAGE
   ─────
   import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';

   // Inside mount():
   const V  = window.TheVine;
   const MX = buildAdapter('flock.events', V);
   // MX.list / MX.get / MX.create / MX.update / MX.delete / MX.cancel / …

   // For domains with non-standard UpperRoom arg shapes (prayer, permissions)
   // the adapter normalises args transparently — see domain map below.
   ══════════════════════════════════════════════════════════════════════════════ */

// ── Domain → UpperRoom verb map ────────────────────────────────────────────────
// Each entry maps a GAS domain path to the corresponding UpperRoom method names.
// Keys are the verb names exposed on the returned adapter object.
// Values are the UpperRoom method names (strings on window.UpperRoom).
//
// Special entries:
//   urArgs  – function(payload) → array of args to pass to the UR method
//             (used when UR and GAS have different arg shapes)
//   gasCall – function(gas, payload) → calls the GAS method with the right shape
//             (used when GAS and adapter have different arg shapes)
//
const _DOMAIN_MAP = {
  // ── Sermons ──────────────────────────────────────────────────────────────
  'flock.sermons': {
    list:   { ur: 'listSermons'   },
    get:    { ur: 'getSermon'     },
    create: { ur: 'createSermon'  },
    update: { ur: 'updateSermon'  },
    delete: { ur: 'deleteSermon'  },
  },

  // ── Sermon Series ─────────────────────────────────────────────────────────
  'flock.sermonSeries': {
    list:   { ur: 'listSermonSeries'   },
    get:    { ur: 'getSermonSeries'    },
    create: { ur: 'createSermonSeries' },
    update: { ur: 'updateSermonSeries' },
    delete: { ur: 'deleteSermonSeries' },
  },

  // ── Presentations (FlockShow) ─────────────────────────────────────────────
  'flock.presentations': {
    list:   { ur: 'listPresentations'   },
    get:    { ur: 'getPresentation'     },
    create: { ur: 'createPresentation'  },
    update: { ur: 'updatePresentation'  },
    delete: { ur: 'deletePresentation'  },
  },

  // ── Events ────────────────────────────────────────────────────────────────
  'flock.events': {
    list:   { ur: 'listEvents'   },
    get:    { ur: 'getEvent'     },
    create: { ur: 'createEvent'  },
    update: { ur: 'updateEvent'  },
    delete: { ur: 'deleteEvent'  },
    cancel: { ur: 'cancelEvent'  },
  },

  // ── Groups ────────────────────────────────────────────────────────────────
  'flock.groups': {
    list:   { ur: 'listGroups'   },
    get:    { ur: 'getGroup'     },
    create: { ur: 'createGroup'  },
    update: { ur: 'updateGroup'  },
    delete: { ur: 'deleteGroup'  },
  },

  // ── Discipleship Paths ────────────────────────────────────────────────────
  'flock.discipleship.paths': {
    list:   { ur: 'listDiscPaths'   },
    get:    { ur: 'getDiscPath'     },
    create: { ur: 'createDiscPath'  },
    update: { ur: 'updateDiscPath'  },
    // archiveDiscPath mirrors GAS soft-delete; mapped to 'delete' verb
    delete: { ur: 'archiveDiscPath' },
  },

  // ── Prayer ────────────────────────────────────────────────────────────────
  // UpperRoom updatePrayer(id, data) takes separate args; adapter normalises.
  // UpperRoom deletePrayer(id) takes a bare string id.
  'flock.prayer': {
    list:   { ur: 'listPrayers'  },
    get:    { ur: 'getPrayer',     urArgs: (p)  => [p && p.id ? p.id : p]  },
    create: { ur: 'createPrayer'  },
    update: {
      ur:     'updatePrayer',
      urArgs: (p) => { const { id, ...rest } = (p || {}); return [id, rest]; },
      gasCall:(gas, p) => gas.update && gas.update(p),
    },
    delete: {
      ur:     'deletePrayer',
      urArgs: (p) => [typeof p === 'object' ? p.id : p],
      gasCall:(gas, p) => {
        const id = typeof p === 'object' ? p.id : p;
        return gas.remove ? gas.remove(id) : (gas.update && gas.update({ id, status: 'Archived' }));
      },
    },
    // GAS uses .remove(id); surfaced as a separate verb for call sites that use it
    remove: {
      ur:     'deletePrayer',
      urArgs: (p) => [typeof p === 'object' ? p.id : p],
      gasCall:(gas, p) => {
        const id = typeof p === 'object' ? p.id : p;
        return gas.remove ? gas.remove(id) : (gas.update && gas.update({ id, status: 'Archived' }));
      },
    },
  },

  // ── Service Plans ─────────────────────────────────────────────────────────
  'flock.servicePlans': {
    list:   { ur: 'listServicePlans'   },
    get:    { ur: 'getServicePlan'     },
    create: { ur: 'createServicePlan'  },
    update: { ur: 'updateServicePlan'  },
    // NOTE: UpperRoom has no deleteServicePlan — soft-delete via update({ status:'Deleted' })
  },

  // ── Milestones ────────────────────────────────────────────────────────────
  'flock.milestones': {
    list:   { ur: 'listMilestones'   },
    create: { ur: 'createMilestone'  },
    update: { ur: 'updateMilestone'  },
    delete: { ur: 'deleteMilestone'  },
  },

  // ── Members ───────────────────────────────────────────────────────────────
  'flock.members': {
    list:   { ur: 'listMembers'   },
    get:    { ur: 'getMember'     },
    create: { ur: 'createMember'  },
    update: { ur: 'updateMember'  },
    // deleteMember(id) expects a bare string — extract .id if an object is passed
    delete: { ur: 'deleteMember', urArgs: (p) => [typeof p === 'object' && p !== null ? p.id : p] },
  },

  // ── Permissions ───────────────────────────────────────────────────────────
  // Member-role layer (memberId-keyed) — used by the_fold "Access Level".
  // Granular email-keyed grants/denies (future UI) should use a separate
  // adapter domain when implemented.
  'flock.permissions': {
    get: { ur: 'getMemberRole' },
    set: { ur: 'setMemberRole' },
  },

  // ── Care Cases ────────────────────────────────────────────────────────────
  'flock.care': {
    list:    { ur: 'listCareCases'  },
    get:     { ur: 'getCareCase'    },
    create:  { ur: 'createCareCase' },
    update:  { ur: 'updateCareCase' },
    resolve: { ur: 'resolveCareCase' },
  },

  // ── Care Interactions ─────────────────────────────────────────────────────
  'flock.care.interactions': {
    list:   { ur: 'listCareInteractions'   },
    create: { ur: 'createCareInteraction'  },
  },

  // ── Touches (contact log) ────────────────────────────────────────────────
  // Each touch is a record of a shepherd reaching out to a member via text,
  // call, or email through The Fold. Stored in churches/{id}/touches.
  'flock.touches': {
    list:   { ur: 'listTouches'   },
    create: { ur: 'createTouch'   },
  },

  // ── Giving ────────────────────────────────────────────────────────────────
  'flock.giving': {
    list:    { ur: 'listGiving'    },
    create:  { ur: 'createGiving'  },
    update:  { ur: 'updateGiving'  },
    summary: { ur: 'givingSummary' },
  },

  // ── Outreach Contacts ─────────────────────────────────────────────────────
  'flock.outreach.contacts': {
    list:   { ur: 'listOutreachContacts'   },
    get:    { ur: 'getOutreachContact'     },
    create: { ur: 'createOutreachContact'  },
    update: { ur: 'updateOutreachContact'  },
    delete: { ur: 'deleteOutreachContact'  },
  },

  // ── Strategic Plan — Goals ────────────────────────────────────────────────
  'flock.strategicPlan.goals': {
    list:   { ur: 'listStrategicGoals'        },
    create: { ur: 'createStrategicGoal'       },
    update: { ur: 'updateStrategicGoal'       },
    delete: { ur: 'deleteStrategicGoal'       },
  },

  // ── Strategic Plan — Initiatives ──────────────────────────────────────────
  'flock.strategicPlan.initiatives': {
    list:   { ur: 'listStrategicInitiatives'  },
    create: { ur: 'createStrategicInitiative' },
    update: { ur: 'updateStrategicInitiative' },
    delete: { ur: 'deleteStrategicInitiative' },
  },

  // ── Strategic Plan — Key Dates ────────────────────────────────────────────
  'flock.strategicPlan.keyDates': {
    list:   { ur: 'listStrategicKeyDates'     },
    create: { ur: 'createStrategicKeyDate'    },
    update: { ur: 'updateStrategicKeyDate'    },
    delete: { ur: 'deleteStrategicKeyDate'    },
  },

  // ── Missions Partners ─────────────────────────────────────────────────────
  'missions.partners': {
    list:   { ur: 'listMissionsPartners'   },
    get:    { ur: 'getMissionsPartners'    },
    create: { ur: 'createMissionsPartners' },
    update: { ur: 'updateMissionsPartners' },
    delete: { ur: 'deleteMissionsPartners' },
  },

  // ── Missions Registry ─────────────────────────────────────────────────────
  'missions.registry': {
    list: { ur: 'listMissionsRegistry'  },
    get:  { ur: 'getMissionsRegistry'   },
  },

  // ── App Devotionals (V.app.devotionals is a callable function) ──────────────
  'app.devotionals': {
    list: { gasCall: (gas) => typeof gas === 'function' ? gas() : Promise.resolve([]) },
  },

  // ── App Reading (V.app.reading is a callable function) ───────────────────────
  'app.reading': {
    list: { gasCall: (gas) => typeof gas === 'function' ? gas() : Promise.resolve([]) },
  },
};

// ── GAS path resolver ─────────────────────────────────────────────────────────
// Resolves 'flock.care.interactions' → V.flock.care.interactions (the GAS ns object).
// For strategicPlan sub-domains the GAS ns is V.flock.strategicPlan with a
// { collection } param; handled via _gasStrategicPlan below.
function _gasNs(V, domain) {
  if (!V) return null;
  const parts = domain.split('.');
  let obj = V;
  for (const k of parts) {
    if (obj == null || typeof obj !== 'object') return null;
    obj = obj[k];
  }
  return obj || null;
}

// ── Special GAS fallback for strategicPlan sub-domains ───────────────────────
const _SP_COL = {
  'flock.strategicPlan.goals':       'strategicGoals',
  'flock.strategicPlan.initiatives': 'strategicInitiatives',
  'flock.strategicPlan.keyDates':    'strategicKeyDates',
};

function _gasStrategicPlan(V, domain) {
  const col = _SP_COL[domain];
  if (!col || !V?.flock?.strategicPlan) return null;
  const sp = V.flock.strategicPlan;
  return {
    list:   (p)       => sp.list   ? sp.list({ collection: col, ...(p || {}) })         : Promise.resolve([]),
    create: (p)       => sp.create ? sp.create({ collection: col, ...(p || {}) })        : Promise.reject(new Error('create not supported')),
    update: (p)       => sp.update ? sp.update({ collection: col, ...(p || {}) })        : Promise.reject(new Error('update not supported')),
    delete: (id)      => sp.delete ? sp.delete({ collection: col, id: typeof id === 'object' ? id.id : id }) : Promise.reject(new Error('delete not supported')),
  };
}

// ── buildAdapter ──────────────────────────────────────────────────────────────
/**
 * Build a Firestore-first / GAS-fallback adapter for a given domain.
 *
 * @param {string} domain  - One of the keys in _DOMAIN_MAP (e.g. 'flock.events').
 * @param {object} V       - window.TheVine (may be null on Firestore-only deploys).
 * @returns {object}  Adapter with methods matching the domain's verb map plus
 *                    `isFirestore()` to interrogate the current routing path.
 */
export function buildAdapter(domain, V) {
  const UR = (typeof window !== 'undefined') ? window.UpperRoom : null;
  // Probed on every call — UpperRoom may finish init mid-session.
  const fsReady = () => !!(UR && typeof UR.isReady === 'function' && UR.isReady());

  // Ensure UpperRoom is authenticated before routing a call to Firestore.
  const _ensureUR = async () => {
    if (!UR) return;
    if (!UR.isReady || !UR.isReady()) {
      if (typeof UR.init === 'function') await UR.init();
      if (!UR.isReady() && typeof UR.authenticate === 'function') await UR.authenticate();
    }
  };

  const verbMap = _DOMAIN_MAP[domain] || {};
  const isSpDomain = domain.startsWith('flock.strategicPlan.');
  const gas = isSpDomain ? _gasStrategicPlan(V, domain) : (_gasNs(V, domain) || {});

  const adapter = { isFirestore: fsReady };

  for (const [verb, cfg] of Object.entries(verbMap)) {
    if (!cfg) continue;
    const { ur: urMethod, urArgs, gasCall } = cfg;

    adapter[verb] = async (...callArgs) => {
      const payload = callArgs[0];

      // ── Firestore path ──────────────────────────────────────────────────
      if (UR && urMethod && typeof UR[urMethod] === 'function') {
        await _ensureUR();
        if (fsReady()) {
          const args = urArgs ? urArgs(payload) : callArgs;
          return UR[urMethod](...args);
        }
      }

      // ── GAS fallback ────────────────────────────────────────────────────
      if (gasCall) return gasCall(gas, payload);
      if (gas && typeof gas[verb] === 'function') return gas[verb](...callArgs);

      // Verb not implemented in either path — return safe defaults
      if (verb === 'list' || verb === 'summary') return Promise.resolve([]);
      return Promise.resolve(null);
    };
  }

  // Passthrough any GAS verbs not in the UR map (e.g. extra domain helpers)
  if (gas && typeof gas === 'object' && !Array.isArray(gas)) {
    for (const [verb, fn] of Object.entries(gas)) {
      if (typeof fn === 'function' && !adapter[verb]) {
        adapter[verb] = (...args) => fn(...args);
      }
    }
  }

  return adapter;
}
