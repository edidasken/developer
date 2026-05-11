/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: THE CALL TO FORGIVE — Reconciliation & Restoration
   "Forgive, and ye shall be forgiven." — Luke 6:37
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';
import { buildAdapter } from '../../Scripts/the_living_water_adapter.js';

export const name  = 'the_call_to_forgive';
export const title = 'The Call to Forgive';

let _activeCtfSheet = null;
let _liveCasesMap   = {};
let _membersCache   = null;  // { id, name }[]

const _e = s => String(s ?? '').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const STEPS = [
  { n: 1, title: 'Acknowledge the Wound',  desc: 'Name the hurt honestly and without minimising it before God.' },
  { n: 2, title: 'Choose to Forgive',      desc: 'Forgiveness is a decision of the will, not a feeling. Make the choice.' },
  { n: 3, title: 'Speak the Release',      desc: 'Pray the release aloud: "I forgive ____ for ____."' },
  { n: 4, title: 'Seek Reconciliation',    desc: 'Where safe and possible, pursue restoration of the relationship.' },
  { n: 5, title: 'Walk in the Healing',    desc: 'Forgiveness is a journey. Return to these steps as needed.' },
];

const SCRIPTURES = [
  { ref: 'Matthew 6:14',   text: 'For if you forgive men their trespasses, your heavenly Father will also forgive you.' },
  { ref: 'Colossians 3:13', text: 'Bearing with one another and, if one has a complaint against another, forgiving each other; as the Lord has forgiven you, so you also must forgive.' },
  { ref: 'Luke 6:37',      text: 'Forgive, and you will be forgiven.' },
  { ref: 'Ephesians 4:32', text: 'Be kind to one another, tenderhearted, forgiving one another, as God in Christ forgave you.' },
];

const STAGE_META = {
  Processing:   { color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)'  },
  Mediation:    { color: '#e8a838', bg: 'rgba(232,168,56,0.13)'  },
  Reconciled:   { color: '#059669', bg: 'rgba(5,150,105,0.10)'   },
  Closed:       { color: '#9ca3af', bg: 'rgba(156,163,175,0.10)' },
};

export function render() {
  return /* html */`
    <section class="ctf-view">
      ${pageHero({
        title:    'The Call to Forgive',
        subtitle: 'Pastoral tools for reconciliation, restoration, and the ministry of healing.',
        scripture: 'Forgive, and ye shall be forgiven. — Luke 6:37',
      })}

      <div class="ctf-layout">

        <!-- Left: active cases + steps -->
        <div class="ctf-main">

          <!-- Reconciliation cases -->
          <div class="way-section-header">
            <h2 class="way-section-title">Reconciliation Cases</h2>
            <button class="flock-btn flock-btn--primary" data-act="open-case" style="display:flex;align-items:center;gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Open Case
            </button>
          </div>
          <div class="ctf-cases" data-bind="cases">
            <div style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Loading cases…</div>
          </div>

          <!-- Process steps -->
          <div class="way-section-header" style="margin-top:28px;">
            <h2 class="way-section-title">The Pathway to Forgiveness</h2>
          </div>
          <div class="ctf-steps">
            ${STEPS.map(s => `
            <div class="ctf-step">
              <div class="ctf-step-n">${s.n}</div>
              <div class="ctf-step-body">
                <div class="ctf-step-title">${_e(s.title)}</div>
                <div class="ctf-step-desc">${_e(s.desc)}</div>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <!-- Right: scripture rail -->
        <aside class="ctf-scripture-col">
          <div class="ctf-scripture-hd">Scriptures on Forgiveness</div>
          ${SCRIPTURES.map(s => `
          <div class="ctf-scripture-card">
            <div class="ctf-scripture-ref">${_e(s.ref)}</div>
            <div class="ctf-scripture-text">"${_e(s.text)}"</div>
          </div>`).join('')}
          <button class="flock-btn flock-btn--ghost" data-act="prayer-guide" style="width:100%;margin-top:12px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 1 5 5c0 3-5 7-5 7S7 10 7 7a5 5 0 0 1 5-5z"/><path d="M12 22v-8"/></svg>
            Forgiveness Prayer Guide
          </button>
        </aside>

      </div>
    </section>
  `;
}

export function mount(root) {
  const reload = () => _loadCases(root, reload);
  reload();
  _loadMembers();  // preload member list for party dropdowns
  root.querySelector('[data-act="open-case"]')?.addEventListener('click', () => _openCaseSheet(null, reload));
  root.querySelector('[data-act="prayer-guide"]')?.addEventListener('click', () => _openPrayerGuide());
  return () => { _closeCtfSheet(); _closePrayerGuide(); };
}

function _rows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

// ── Member directory helpers ─────────────────────────────────────────────────

async function _loadMembers() {
  if (_membersCache) return _membersCache;
  try {
    const V  = window.TheVine;
    const UR = window.UpperRoom;
    const raw = UR && typeof UR.listMembers === 'function' && UR.isReady?.()
      ? _rows(await UR.listMembers({ limit: 500 }))
      : _rows(await V.flock.call('members.list', { limit: 500 }));
    _membersCache = raw
      .filter(m => (m.firstName || m.lastName || m.memberName))
      .map(m => {
        const name = ((m.preferredName || m.firstName || '') + ' ' + (m.lastName || '')).trim()
                  || m.memberName || m.email || '';
        return { id: String(m.id || m.memberId || m.email || name), name };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (_) {
    _membersCache = [];
  }
  return _membersCache;
}

function _memberOptions(selectedName) {
  const members = _membersCache || [];
  const opts = ['<option value="">— Select member —</option>'];
  members.forEach(m => {
    const sel = m.name === selectedName ? ' selected' : '';
    opts.push(`<option value="${_e(m.name)}"${sel}>${_e(m.name)}</option>`);
  });
  if (selectedName && !members.find(m => m.name === selectedName)) {
    opts.splice(1, 0, `<option value="${_e(selectedName)}" selected>${_e(selectedName)}</option>`);
  }
  return opts.join('');
}

async function _loadCases(root, onReload) {
  const V   = window.TheVine;
  const MX  = buildAdapter('flock.care', V);
  const UR  = window.UpperRoom;
  const casesEl = root.querySelector('[data-bind="cases"]');
  if (!casesEl) return;
  if (!UR && !V) {
    casesEl.innerHTML = '<div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Reconciliation data is unavailable right now.</div>';
    return;
  }

  try {
    // Fetch all care cases then filter client-side by careType=reconciliation
    let allRows;
    if (UR && typeof UR.listCareCases === 'function' && UR.isReady?.()) {
      allRows = _rows(await UR.listCareCases({}));
    } else {
      allRows = _rows(await MX.list({ careType: 'reconciliation', limit: 50 }));
    }
    const rows = allRows.filter(r => String(r.careType || r.type || '').toLowerCase() === 'reconciliation').slice(0, 12);
    if (!rows.length) {
      casesEl.innerHTML = '<div class="life-empty" style="padding:32px;text-align:center;color:var(--ink-muted,#7a7f96)">No reconciliation cases on file. Use "Open Case" to begin one.</div>';
      _liveCasesMap = {};
      return;
    }

    casesEl.innerHTML = rows.map(c => {
      const party1   = c.memberName || c.party1 || c.submitterName || '(unnamed)';
      const party2   = c.party2 || c.otherParty || '';
      const issue    = c.summary || c.title || c.description || c.issue || '';
      const stage    = c.status || c.stage || 'Processing';
      const dateMs   = c.createdAt?.seconds ? c.createdAt.seconds * 1000 : (c.date ? new Date(c.date).getTime() : 0);
      const date     = dateMs ? new Date(dateMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
      return _caseRow({ id: c.id ? String(c.id) : undefined, party1, party2, issue, stage, date });
    }).join('');
    _liveCasesMap = {};
    rows.forEach(c => { if (c.id) _liveCasesMap[String(c.id)] = c; });
    casesEl.querySelectorAll('.ctf-case-row[data-id]').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const rec = _liveCasesMap[row.dataset.id];
        if (rec) _openCaseSheet({
          id:     rec.id,
          party1: rec.memberName || rec.party1 || rec.submitterName || 'Member',
          party2: rec.party2 || rec.otherParty || '',
          issue:  rec.summary || rec.title || rec.description || rec.issue || '',
          stage:  rec.status || rec.stage || 'Processing',
        }, onReload);
      });
    });
  } catch (err) {
    console.error('[TheCallToForgive] load error:', err);
    casesEl.innerHTML = '<div class="life-empty" style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Could not load reconciliation cases right now.</div>';
  }
}

function _caseRow(c) {
  const meta = STAGE_META[c.stage] || STAGE_META.Processing;
  return /* html */`
    <article class="ctf-case-row"${c.id ? ` data-id="${_e(c.id)}"` : ''} tabindex="0">
      <div class="ctf-case-parties">
        <span class="ctf-party">${_e(c.party1)}</span>
        ${c.party2 ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
        <span class="ctf-party">${_e(c.party2)}</span>` : ''}
      </div>
      ${c.issue ? `<div class="ctf-case-issue">${_e(c.issue)}</div>` : ''}
      <div class="ctf-case-foot">
        <span class="ctf-stage-badge" style="color:${meta.color};background:${meta.bg}">${_e(c.stage)}</span>
        ${c.date ? `<span class="ctf-case-date">${_e(c.date)}</span>` : ''}
      </div>
    </article>`;
}

// ── Case sheet ───────────────────────────────────────────────────────────────
const CTF_STAGES = Object.keys(STAGE_META);

function _closeCtfSheet() {
  if (!_activeCtfSheet) return;
  const t = _activeCtfSheet;
  t.querySelector('.life-sheet-overlay')?.classList.remove('is-open');
  t.querySelector('.life-sheet-panel')?.classList.remove('is-open');
  setTimeout(() => { t.remove(); if (_activeCtfSheet === t) _activeCtfSheet = null; }, 320);
}

async function _openCaseSheet(c, onReload) {
  _closeCtfSheet();
  const V   = window.TheVine;
  const MX  = buildAdapter('flock.care', V);
  const UR  = window.UpperRoom;
  const useFB = !!(UR && typeof UR.isReady === 'function' && UR.isReady() && typeof UR.createCareCase === 'function');
  const isNew = !c;
  const uid   = c?.id ? String(c.id) : '';

  // Resolve existing party names (handle both field naming conventions)
  const existingParty1 = c?.party1 || c?.memberName || '';
  const existingParty2 = c?.party2 || c?.otherParty || '';

  // Ensure member list is loaded before building the form
  await _loadMembers();

  const sheet = document.createElement('div');
  sheet.className = 'life-sheet';
  sheet.innerHTML = /* html */`
    <div class="life-sheet-overlay"></div>
    <div class="life-sheet-panel" role="dialog" aria-label="${isNew ? 'Open Case' : 'Edit Case'}">
      <div class="life-sheet-drag"></div>
      <div class="life-sheet-hd">
        <div class="life-sheet-hd-info">
          <div class="life-sheet-hd-name">${isNew ? 'Open Reconciliation Case' : 'Edit Case'}</div>
          <div class="life-sheet-hd-meta">${isNew ? 'Begin the ministry of reconciliation' : _e((existingParty1 || '') + (existingParty2 ? ' & ' + existingParty2 : ''))}</div>
        </div>
        <button class="life-sheet-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="life-sheet-body">
        <div class="life-sheet-field">
          <div class="life-sheet-label">First Party / Member Name <span style="color:#dc2626">*</span></div>
          <select class="life-sheet-input" data-field="party1">
            ${_memberOptions(existingParty1)}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Second Party <span style="color:#6b7280;font-weight:400">(optional)</span></div>
          <select class="life-sheet-input" data-field="party2">
            ${_memberOptions(existingParty2)}
          </select>
        </div>
        <div class="life-sheet-field">
          <div class="life-sheet-label">Issue / Description</div>
          <textarea class="life-sheet-input" data-field="issue" rows="3" style="resize:vertical" placeholder="Brief description of the conflict or need…">${_e(c?.issue || '')}</textarea>
        </div>
        ${!isNew ? `<div class="life-sheet-field">
          <div class="life-sheet-label">Stage</div>
          <select class="life-sheet-input" data-field="stage">
            ${CTF_STAGES.map(s => `<option value="${_e(s)}"${s === (c?.stage || 'Processing') ? ' selected' : ''}>${_e(s)}</option>`).join('')}
          </select>
        </div>` : ''}
        <div class="fold-form-error" data-error style="display:none;color:#dc2626;font-size:.85rem;margin-top:8px"></div>
      </div>
      <div class="life-sheet-foot">
        ${!isNew ? '<button class="flock-btn flock-btn--danger" data-delete style="margin-right:auto">Delete Case</button>' : ''}
        ${!isNew ? '<button class="flock-btn flock-btn--ghost" data-close-case>Close Case</button>' : ''}
        <button class="flock-btn" data-cancel>Cancel</button>
        <button class="flock-btn flock-btn--primary" data-save>${isNew ? 'Open Case' : 'Save Changes'}</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  _activeCtfSheet = sheet;
  requestAnimationFrame(() => {
    sheet.querySelector('.life-sheet-overlay').classList.add('is-open');
    sheet.querySelector('.life-sheet-panel').classList.add('is-open');
    sheet.querySelector('[data-field="party1"]')?.focus();
  });

  const close = () => _closeCtfSheet();
  sheet.querySelector('[data-cancel]').addEventListener('click', close);
  sheet.querySelector('.life-sheet-close').addEventListener('click', close);

  sheet.querySelector('[data-save]').addEventListener('click', async () => {
    const errEl = sheet.querySelector('[data-error]');
    const p1    = sheet.querySelector('[data-field="party1"]').value.trim();
    if (!p1) { errEl.textContent = 'First party name is required.'; errEl.style.display = ''; return; }
    errEl.style.display = 'none';
    const btn = sheet.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = isNew ? 'Opening…' : 'Saving…';
    const payload = {
      careType:   'reconciliation',
      party1:     p1,
      party2:     sheet.querySelector('[data-field="party2"]').value.trim() || undefined,
      // Align with Pastoral Care field names so both views read the same record
      memberName: p1,
      memberId:   (_membersCache || []).find(m => m.name === p1)?.id || undefined,
      summary:    sheet.querySelector('[data-field="issue"]').value.trim() || undefined,
      status:     isNew ? 'Processing' : (sheet.querySelector('[data-field="stage"]')?.value || 'Processing'),
    };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    if (!isNew) payload.id = uid;
    try {
      if (isNew) {
        await (useFB ? UR.createCareCase(payload) : MX.create(payload));
      } else {
        await (useFB ? UR.updateCareCase(payload) : MX.update(payload));
      }
      _closeCtfSheet();
      onReload?.();
    } catch (err) {
      errEl.textContent = err?.message || 'Could not save case.';
      errEl.style.display = '';
      btn.disabled = false; btn.textContent = isNew ? 'Open Case' : 'Save Changes';
    }
  });

  sheet.querySelector('[data-close-case]')?.addEventListener('click', async () => {
    const ok = confirm('Mark this reconciliation case as Closed?');
    if (!ok) return;
    const btn = sheet.querySelector('[data-close-case]');
    btn.disabled = true; btn.textContent = 'Closing…';
    try {
      await (useFB ? UR.updateCareCase({ id: uid, status: 'Closed' }) : MX.update({ id: uid, status: 'Closed' }));
      _closeCtfSheet();
      onReload?.();
    } catch (_) { btn.disabled = false; btn.textContent = 'Close Case'; }
  });

  sheet.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const party = existingParty1 || 'this case';
    if (!confirm(`Permanently delete the case for "${party}"? This cannot be undone.`)) return;
    const btn = sheet.querySelector('[data-delete]');
    btn.disabled = true; btn.textContent = 'Deleting…';
    try {
      // care.delete does not exist in the API — always soft-delete via status update
      await (useFB ? UR.updateCareCase({ id: uid, status: 'Deleted' }) : MX.update({ id: uid, status: 'Deleted' }));
      _closeCtfSheet();
      onReload?.();
    } catch (err) {
      alert(err?.message || 'Could not delete case.');
      btn.disabled = false; btn.textContent = 'Delete Case';
    }
  });
}

// ── Prayer Guide ──────────────────────────────────────────────────────────────

const PRAYER_STEPS = [
  {
    title:     'Acknowledge the Wound',
    scripture: { ref: 'Psalm 34:18', text: 'The Lord is close to the brokenhearted and saves those who are crushed in spirit.' },
    guide:     'Before we can forgive, we must be honest about what happened. Minimising the hurt does not honour the pain — God sees it all.',
    prayer:    (name) => `Lord, I come before you with a wounded heart. I acknowledge honestly that ${name ? _e(name) : 'the person who hurt me'} wounded me. I do not minimise it. You see the full weight of this pain, and you care about every detail. I bring it to you now. Amen.`,
  },
  {
    title:     'Choose to Forgive',
    scripture: { ref: 'Colossians 3:13', text: 'Bearing with one another and, if one has a complaint against another, forgiving each other; as the Lord has forgiven you, so you also must forgive.' },
    guide:     'Forgiveness is not a feeling — it is a decision of the will. You may not feel ready, but you can choose to begin. God\'s grace meets you in the choosing.',
    prayer:    (name) => `Father, in my own strength I cannot fully forgive. But I choose — right now, as an act of my will — to forgive ${name ? _e(name) : 'this person'}. I do not do this because the hurt was small, but because you have forgiven me of so much more. Fill me with the grace to mean it more each day. Amen.`,
  },
  {
    title:     'Speak the Release',
    scripture: { ref: 'Matthew 6:14', text: 'For if you forgive men their trespasses, your heavenly Father will also forgive you.' },
    guide:     'There is power in speaking forgiveness aloud. As you say these words, you are releasing the debt — not because it was fair, but because Christ released yours.',
    prayer:    (name) => `Lord, I speak these words before you: ${name ? `I forgive ${_e(name)}.` : 'I forgive the one who wronged me.'} They no longer owe me. I release the debt. I place them in your hands and trust you for justice, healing, and whatever comes next. I will not hold this over them. Amen.`,
  },
  {
    title:     'Seek Reconciliation',
    scripture: { ref: 'Romans 12:18', text: 'If it is possible, as far as it depends on you, live at peace with everyone.' },
    guide:     'Where it is safe and wise, God calls us toward restored relationship. This does not mean pretending nothing happened — it means trusting God to lead the next step.',
    prayer:    (name) => `Father, where it is safe and right, I ask you to open the door to restored relationship with ${name ? _e(name) : 'this person'}. Give me wisdom to know when and how to reach out. If full reconciliation is not possible, guard my heart from bitterness and help me trust you. Your ways are higher than mine. Amen.`,
  },
  {
    title:     'Walk in the Healing',
    scripture: { ref: 'Isaiah 43:18–19', text: 'Forget the former things; do not dwell on the past. See, I am doing a new thing!' },
    guide:     'Forgiveness is a journey, not a single moment. The feelings may return. When they do, return to this prayer. God\'s healing is real and it is for you.',
    prayer:    (_name) => `Lord, I know this is a process. When the old pain resurfaces, I will return to this altar and choose again. Thank you that you are not done with me — or with ${_name ? _e(_name) : 'the one I have forgiven'}. I receive your healing. I step forward in freedom today. In Jesus' name, Amen.`,
  },
];

let _activePrayerGuide = null;

function _closePrayerGuide() {
  if (!_activePrayerGuide) return;
  const el = _activePrayerGuide;
  el.querySelector('.ctf-pg-overlay')?.classList.remove('is-open');
  el.querySelector('.ctf-pg-panel')?.classList.remove('is-open');
  setTimeout(() => { el.remove(); if (_activePrayerGuide === el) _activePrayerGuide = null; }, 320);
}

function _openPrayerGuide() {
  _closePrayerGuide();

  let step = 0;  // 0 = intro / name entry, 1–5 = prayer steps
  let personName = '';

  const el = document.createElement('div');
  el.className = 'ctf-pg';
  document.body.appendChild(el);
  _activePrayerGuide = el;

  function _render() {
    const isIntro  = step === 0;
    const isDone   = step > PRAYER_STEPS.length;
    const ps       = !isIntro && !isDone ? PRAYER_STEPS[step - 1] : null;
    const progress = isIntro ? 0 : Math.min(step / PRAYER_STEPS.length, 1);

    el.innerHTML = /* html */`
      <div class="ctf-pg-overlay"></div>
      <div class="ctf-pg-panel" role="dialog" aria-label="Forgiveness Prayer Guide">

        <div class="ctf-pg-header">
          <div class="ctf-pg-title-row">
            <span class="ctf-pg-eyebrow">Forgiveness Prayer Guide</span>
            <button class="ctf-pg-close" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="ctf-pg-progress-bar"><div class="ctf-pg-progress-fill" style="width:${Math.round(progress * 100)}%"></div></div>
          ${!isIntro && !isDone ? `<div class="ctf-pg-steps-row">${PRAYER_STEPS.map((s, i) => `<span class="ctf-pg-dot${i < step ? ' is-done' : (i === step - 1 ? ' is-active' : '')}"></span>`).join('')}</div>` : ''}
        </div>

        <div class="ctf-pg-body">
          ${isIntro ? /* html */`
            <div class="ctf-pg-intro">
              <div class="ctf-pg-intro-icon">🕊️</div>
              <h2 class="ctf-pg-intro-title">The Pathway to Forgiveness</h2>
              <p class="ctf-pg-intro-sub">This five-step prayer guide will walk you through the ministry of forgiveness — from honest acknowledgment to walking in healing. Take your time with each step.</p>
              <label class="ctf-pg-name-label">
                Who are you forgiving? <span style="font-weight:400;color:var(--ink-muted)">(optional)</span>
                <input class="fold-search ctf-pg-name-input" type="text" placeholder="Their first name…" value="${_e(personName)}" />
              </label>
            </div>
          ` : isDone ? /* html */`
            <div class="ctf-pg-complete">
              <div class="ctf-pg-complete-icon">✝️</div>
              <h2 class="ctf-pg-complete-title">Prayer Complete</h2>
              <p class="ctf-pg-complete-sub">You have walked through all five steps of forgiveness. This is holy work. God honours it — and he will complete the healing he has begun in you.</p>
              <div class="ctf-pg-complete-verse">
                <div class="ctf-pg-sv-ref">Philippians 1:6</div>
                <div class="ctf-pg-sv-text">"He who began a good work in you will carry it on to completion until the day of Christ Jesus."</div>
              </div>
            </div>
          ` : /* html */`
            <div class="ctf-pg-step">
              <div class="ctf-pg-step-num">Step ${step} of ${PRAYER_STEPS.length}</div>
              <h2 class="ctf-pg-step-title">${_e(ps.title)}</h2>
              <p class="ctf-pg-step-guide">${_e(ps.guide)}</p>
              <div class="ctf-pg-scripture">
                <div class="ctf-pg-sv-ref">${_e(ps.scripture.ref)}</div>
                <div class="ctf-pg-sv-text">"${_e(ps.scripture.text)}"</div>
              </div>
              <div class="ctf-pg-prayer-label">Pray aloud or silently:</div>
              <div class="ctf-pg-prayer-text">${ps.prayer(personName)}</div>
            </div>
          `}
        </div>

        <div class="ctf-pg-footer">
          ${step > 0 && !isDone ? `<button class="flock-btn flock-btn--ghost ctf-pg-back">← Back</button>` : `<span></span>`}
          ${isIntro
            ? `<button class="flock-btn flock-btn--primary ctf-pg-next">Begin Guide →</button>`
            : isDone
              ? `<button class="flock-btn flock-btn--ghost ctf-pg-restart">Start Over</button><button class="flock-btn flock-btn--primary ctf-pg-close-btn">Done</button>`
              : step < PRAYER_STEPS.length
                ? `<button class="flock-btn flock-btn--primary ctf-pg-next">Next Step →</button>`
                : `<button class="flock-btn flock-btn--primary ctf-pg-next">Finish</button>`
          }
        </div>
      </div>`;

    requestAnimationFrame(() => {
      el.querySelector('.ctf-pg-overlay')?.classList.add('is-open');
      el.querySelector('.ctf-pg-panel')?.classList.add('is-open');
    });

    el.querySelector('.ctf-pg-close')?.addEventListener('click', _closePrayerGuide);
    el.querySelector('.ctf-pg-overlay')?.addEventListener('click', _closePrayerGuide);

    el.querySelector('.ctf-pg-next')?.addEventListener('click', () => {
      if (isIntro) {
        personName = (el.querySelector('.ctf-pg-name-input')?.value || '').trim();
      }
      step++;
      _render();
    });
    el.querySelector('.ctf-pg-back')?.addEventListener('click', () => {
      step = Math.max(0, step - 1);
      _render();
    });
    el.querySelector('.ctf-pg-restart')?.addEventListener('click', () => {
      step = 0;
      personName = '';
      _render();
    });
    el.querySelector('.ctf-pg-close-btn')?.addEventListener('click', _closePrayerGuide);
  }

  _render();
}

