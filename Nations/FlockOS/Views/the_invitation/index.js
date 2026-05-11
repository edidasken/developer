/* ══════════════════════════════════════════════════════════════════════════════
   VIEW: THE INVITATION — Church Invites, Pending Approvals & App Access
   "Come unto me, all ye that labour and are heavy laden." — Matthew 11:28
   ══════════════════════════════════════════════════════════════════════════════ */

import { pageHero } from '../_frame.js';

export const name  = 'the_invitation';
export const title = 'The Invitation';

const _e = s => String(s ?? '').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function render() {
  return /* html */`
    <section class="inv-view">
      ${pageHero({
        title:    'The Invitation',
        subtitle: 'Invite people to church, approve membership requests, and grant app access.',
        scripture: 'Come unto me, all ye that labour and are heavy laden. — Matthew 11:28',
      })}

      <!-- Stats strip -->
      <div class="inv-stats">
        <div class="inv-stat-card"><div class="inv-stat-n" data-stat="pending" style="color:var(--gold)">—</div><div class="inv-stat-label">Pending Approval</div></div>
        <div class="inv-stat-card"><div class="inv-stat-n" data-stat="outreach" style="color:var(--c-emerald)">—</div><div class="inv-stat-label">Church Invitations</div></div>
        <div class="inv-stat-card"><div class="inv-stat-n" data-stat="converted" style="color:var(--c-sky)">—</div><div class="inv-stat-label">Converted</div></div>
        <div class="inv-stat-card"><div class="inv-stat-n" data-stat="total-invited" style="color:var(--c-violet)">—</div><div class="inv-stat-label">Total Invited</div></div>
      </div>

      <!-- ── INVITE TO CHURCH ─────────────────────────────────────────── -->
      <div class="way-section-header" style="margin-top:24px;">
        <h2 class="way-section-title">Invite to Church</h2>
      </div>
      <div class="inv-invite-card">
        <div class="inv-form-row inv-form-row--2">
          <label class="inv-label">First Name <span class="inv-req">*</span>
            <input class="fold-search" type="text" placeholder="First name…" data-bind="church-first" />
          </label>
          <label class="inv-label">Last Name
            <input class="fold-search" type="text" placeholder="Last name…" data-bind="church-last" />
          </label>
        </div>
        <div class="inv-form-row inv-form-row--2">
          <label class="inv-label">Phone (optional)
            <input class="fold-search" type="tel" placeholder="+1 (555) 000-0000…" data-bind="church-phone" />
          </label>
          <label class="inv-label">Email (optional)
            <input class="fold-search" type="email" placeholder="Email address…" data-bind="church-email" />
          </label>
        </div>
        <label class="inv-label" style="width:100%">Personal Note (optional)
          <textarea class="fold-search inv-textarea" placeholder="E.g. Met at soccer practice — invited to Sunday service…" data-bind="church-note" rows="2"></textarea>
        </label>
        <div class="inv-form-actions">
          <label class="inv-sms-label" data-bind="sms-toggle-wrap" style="display:none">
            <input type="checkbox" data-bind="church-sms" checked /> Send welcome SMS
          </label>
          <button class="flock-btn flock-btn--primary" data-act="send-church-invite">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
            Save Invitation
          </button>
        </div>
        <div class="inv-invite-note" data-bind="church-invite-status"></div>
      </div>

      <!-- ── PENDING APPROVAL ─────────────────────────────────────────── -->
      <div class="way-section-header" style="margin-top:28px;">
        <h2 class="way-section-title">Pending Approval</h2>
      </div>
      <div class="inv-list" data-bind="pending">
        <div style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">Loading…</div>
      </div>

      <!-- ── GRANT APP ACCESS ─────────────────────────────────────────── -->
      <div class="way-section-header" style="margin-top:28px;">
        <h2 class="way-section-title">Grant App Access</h2>
        <span style="font:0.78rem var(--font-ui);color:var(--ink-muted,#7a7f96)">Create a FlockOS login for someone</span>
      </div>
      <div class="inv-invite-card">
        <div class="inv-form-row inv-form-row--2">
          <label class="inv-label">First Name <span class="inv-req">*</span>
            <input class="fold-search" type="text" placeholder="First name…" data-bind="access-first" />
          </label>
          <label class="inv-label">Last Name <span class="inv-req">*</span>
            <input class="fold-search" type="text" placeholder="Last name…" data-bind="access-last" />
          </label>
        </div>
        <div class="inv-form-row inv-form-row--2">
          <label class="inv-label">Email <span class="inv-req">*</span>
            <input class="fold-search" type="email" placeholder="Email address…" data-bind="access-email" />
          </label>
          <label class="inv-label">Temporary Passcode <span class="inv-req">*</span>
            <input class="fold-search" type="text" placeholder="6+ characters…" data-bind="access-passcode" autocomplete="new-password" />
          </label>
        </div>
        <div class="inv-form-row">
          <label class="inv-label">Role
            <select class="inv-select" data-bind="access-role">
              <option value="readonly">Readonly</option>
              <option value="volunteer" selected>Volunteer</option>
              <option value="leader">Leader</option>
              <option value="deacon">Deacon</option>
              <option value="treasurer">Treasurer</option>
              <option value="pastor">Pastor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <div class="inv-form-actions">
          <button class="flock-btn flock-btn--primary" data-act="grant-access">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>
            Create Account
          </button>
        </div>
        <div class="inv-invite-note" data-bind="access-status"></div>
      </div>
    </section>
  `;
}

export function mount(root) {
  _loadStats(root);
  _loadPending(root);
  _wirePhoneToggle(root);
  _wireChurchInvite(root);
  _wireGrantAccess(root);
  return () => {};
}

// ── helpers ────────────────────────────────────────────────────────────────
function _rows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}
function _val(root, key) { return (root.querySelector(`[data-bind="${key}"]`)?.value ?? '').trim(); }
function _statusEl(root, key) { return root.querySelector(`[data-bind="${key}"]`); }
function _setStatus(el, msg, ok) {
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? '#059669' : '#dc2626';
}
function _btnState(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? '…' : label;
}

// ── stats ──────────────────────────────────────────────────────────────────
async function _loadStats(root) {
  try {
    const UR = window.UpperRoom;
    const V  = window.TheVine;
    const results = await Promise.allSettled([
      V?.flock?.users?.pending?.(),
      UR ? UR.listOutreachContacts({ limit: 500 }) : Promise.reject('no UR'),
    ]);
    const pendingRows  = _rows(results[0].status === 'fulfilled' ? results[0].value : []);
    const outreachRows = _rows(results[1].status === 'fulfilled' ? results[1].value : []);

    const stat = id => root.querySelector(`[data-stat="${id}"]`);
    if (stat('pending'))      stat('pending').textContent      = String(pendingRows.length);
    const active    = outreachRows.filter(r => r.status === 'New' || r.status === 'Contacted').length;
    const converted = outreachRows.filter(r => r.status === 'Converted').length;
    if (stat('outreach'))     stat('outreach').textContent     = String(active);
    if (stat('converted'))    stat('converted').textContent    = String(converted);
    if (stat('total-invited')) stat('total-invited').textContent = String(outreachRows.length);
  } catch (err) {
    console.warn('[TheInvitation] stats load error:', err);
  }
}

// ── pending approvals ──────────────────────────────────────────────────────
async function _loadPending(root) {
  const listEl = root.querySelector('[data-bind="pending"]');
  if (!listEl) return;
  const errMsg = msg => `<div style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">${_e(msg)}</div>`;

  const V = window.TheVine;
  if (!V?.flock?.users?.pending) { listEl.innerHTML = errMsg('Admin backend not available.'); return; }

  listEl.innerHTML = errMsg('Loading pending requests…');
  try {
    const res  = await V.flock.users.pending();
    const rows = _rows(res);

    const stat = root.querySelector('[data-stat="pending"]');
    if (stat) stat.textContent = String(rows.length);

    if (!rows.length) { listEl.innerHTML = errMsg('No pending approval requests.'); return; }

    const users = rows.map(u => ({
      email:     u.email || '',
      name:      u.displayName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown',
      email:     u.email || '',
      submitted: (() => {
        const ms = u.createdAt?.seconds ? u.createdAt.seconds * 1000 : (u.submittedAt ? new Date(u.submittedAt).getTime() : 0);
        return ms ? new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
      })(),
      source: u.source || u.signUpSource || '—',
      role:   u.role || 'visitor',
    }));
    listEl.innerHTML = users.map(_pendingRow).join('');

    listEl.querySelectorAll('.inv-pending-row').forEach((row, i) => {
      const u = users[i];
      if (!u?.email) return;
      row.querySelector('.inv-approve-btn')?.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`Approve ${u.name}?`)) return;
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = 'Approving…';
        try {
          await V.flock.users.approve({ email: u.email });
          row.remove();
          _refreshPendingStat(root);
        } catch (_) { btn.disabled = false; btn.textContent = 'Approve'; }
      });
      row.querySelector('.inv-deny-btn')?.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`Deny membership request from ${u.name}?`)) return;
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = 'Denying…';
        try {
          await V.flock.users.deny({ email: u.email });
          row.remove();
          _refreshPendingStat(root);
        } catch (_) { btn.disabled = false; btn.textContent = 'Deny'; }
      });
    });
  } catch (err) {
    console.error('[TheInvitation] users.pending error:', err);
    listEl.innerHTML = errMsg('Could not load pending requests.');
  }
}

function _refreshPendingStat(root) {
  const remaining = root.querySelectorAll('.inv-pending-row').length;
  const el = root.querySelector('[data-stat="pending"]');
  if (el) el.textContent = String(remaining);
  if (!remaining) {
    const listEl = root.querySelector('[data-bind="pending"]');
    if (listEl) listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--ink-muted,#7a7f96)">No pending approval requests.</div>`;
  }
}

// ── phone toggle for SMS checkbox ──────────────────────────────────────────
function _wirePhoneToggle(root) {
  const phoneEl = root.querySelector('[data-bind="church-phone"]');
  const smsWrap = root.querySelector('[data-bind="sms-toggle-wrap"]');
  if (!phoneEl || !smsWrap) return;
  phoneEl.addEventListener('input', () => {
    smsWrap.style.display = phoneEl.value.trim() ? '' : 'none';
  });
}

// ── invite to church (outreach contact) ───────────────────────────────────
function _wireChurchInvite(root) {
  const btn    = root.querySelector('[data-act="send-church-invite"]');
  const status = _statusEl(root, 'church-invite-status');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const first   = _val(root, 'church-first');
    const last    = _val(root, 'church-last');
    const phone   = _val(root, 'church-phone');
    const email   = _val(root, 'church-email');
    const note    = _val(root, 'church-note');
    const sendSms = root.querySelector('[data-bind="church-sms"]')?.checked && phone;

    if (!first) { _setStatus(status, 'First name is required.', false); return; }

    _btnState(btn, true, 'Save Invitation');
    _setStatus(status, '', true);

    try {
      const UR = window.UpperRoom;
      if (!UR?.createOutreachContact) throw new Error('Outreach backend not available.');
      const session = window.TheVine?.session?.() || {};
      await UR.createOutreachContact({
        firstName:  first,
        lastName:   last,
        phone:      phone,
        email:      email,
        notes:      note,
        source:     'PersonalInvite',
        status:     'New',
        invitedBy:  session.email || '',
      });

      if (sendSms) {
        try {
          const msg = `Hi ${first}! You've been personally invited to join us at church this Sunday. We'd love to have you!`;
          await window.TheVine.flock.sms.send({ to: phone, message: msg });
        } catch (smsErr) {
          console.warn('[TheInvitation] SMS failed:', smsErr);
          _setStatus(status, `Saved — but SMS failed: ${smsErr?.message || smsErr}`, false);
          _btnState(btn, false, 'Save Invitation');
          _clearChurchForm(root);
          _loadStats(root);
          return;
        }
      }

      _setStatus(status, `${first}${last ? ' ' + last : ''} saved${sendSms ? ' · SMS sent' : ''}.`, true);
      _clearChurchForm(root);
      _loadStats(root);
    } catch (err) {
      console.error('[TheInvitation] church invite error:', err);
      _setStatus(status, err?.message || 'Could not save — check backend.', false);
    } finally {
      _btnState(btn, false, 'Save Invitation');
    }
  });
}

function _clearChurchForm(root) {
  ['church-first', 'church-last', 'church-phone', 'church-email', 'church-note'].forEach(key => {
    const el = root.querySelector(`[data-bind="${key}"]`);
    if (el) el.value = '';
  });
  const smsWrap = root.querySelector('[data-bind="sms-toggle-wrap"]');
  if (smsWrap) smsWrap.style.display = 'none';
}

// ── grant app access ───────────────────────────────────────────────────────
function _wireGrantAccess(root) {
  const btn    = root.querySelector('[data-act="grant-access"]');
  const status = _statusEl(root, 'access-status');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const first    = _val(root, 'access-first');
    const last     = _val(root, 'access-last');
    const email    = _val(root, 'access-email');
    const passcode = _val(root, 'access-passcode');
    const role     = root.querySelector('[data-bind="access-role"]')?.value || 'volunteer';

    if (!first)                            { _setStatus(status, 'First name is required.',                   false); return; }
    if (!last)                             { _setStatus(status, 'Last name is required.',                    false); return; }
    if (!email || !email.includes('@'))    { _setStatus(status, 'Valid email is required.',                  false); return; }
    if (!passcode || passcode.length < 6)  { _setStatus(status, 'Passcode must be at least 6 characters.',  false); return; }

    _btnState(btn, true, 'Create Account');
    _setStatus(status, '', true);

    try {
      const V = window.TheVine;
      if (!V?.flock?.users?.create) throw new Error('User admin backend not available.');
      await V.flock.users.create({
        email,
        firstName:   first,
        lastName:    last,
        displayName: `${first} ${last}`.trim(),
        role,
        passcode,
      });
      _setStatus(status, `Account created for ${first} ${last} (${email}).`, true);
      ['access-first', 'access-last', 'access-email', 'access-passcode'].forEach(key => {
        const el = root.querySelector(`[data-bind="${key}"]`);
        if (el) el.value = '';
      });
    } catch (err) {
      console.error('[TheInvitation] grant access error:', err);
      _setStatus(status, err?.message || 'Could not create account — check backend.', false);
    } finally {
      _btnState(btn, false, 'Create Account');
    }
  });
}

// ── pending row template ───────────────────────────────────────────────────
function _pendingRow(u) {
  const initials = u.name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
  return /* html */`
    <article class="inv-pending-row" tabindex="0">
      <div class="fold-avatar" style="background:linear-gradient(135deg,#7c3aed,#0ea5e9);width:38px;height:38px;font-size:.78rem;">${_e(initials)}</div>
      <div class="inv-pending-body">
        <div class="inv-pending-name">${_e(u.name)}</div>
        <div class="inv-pending-meta">
          ${u.email ? `<span>${_e(u.email)}</span><span>·</span>` : ''}
          <span>${_e(u.source)}</span>
          ${u.submitted ? `<span>·</span><span>${_e(u.submitted)}</span>` : ''}
        </div>
      </div>
      <div class="inv-pending-actions">
        <button class="flock-btn flock-btn--ghost inv-deny-btn">Deny</button>
        <button class="flock-btn flock-btn--primary inv-approve-btn">Approve</button>
      </div>
    </article>`;
}

