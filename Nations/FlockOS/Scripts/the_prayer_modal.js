/* ══════════════════════════════════════════════════════════════════════════════
   THE PRAYER MODAL — Public outreach / prayer-request form
   "Cast all your anxiety on him because he cares for you." — 1 Peter 5:7

   Standalone module. Any New Covenant page can do:
     import { openPrayerModal } from '.../the_prayer_modal.js';
     openPrayerModal('optional pre-filled message', { name:'prayer', title:'Prayer Request' });

   Requirements on the host page (already true for every NC app):
     • window.FLOCK_FIREBASE_CONFIG  (set inline in the page <head>)
     • Firebase v10 compat SDK loaded (firebase-app-compat + firestore-compat)
   ══════════════════════════════════════════════════════════════════════════════ */

const _OUTREACH_FB_CONFIG = (typeof window !== 'undefined' && typeof window.FLOCK_FIREBASE_CONFIG === 'object' && window.FLOCK_FIREBASE_CONFIG)
  ? window.FLOCK_FIREBASE_CONFIG
  : {
      apiKey:    'AIzaSyBA-fkxjABbwIHn0i6MPiXbGwahfJmuJeo',
      authDomain:'flockos-notify.firebaseapp.com',
      projectId: 'flockos-notify',
    };

let _outreachDB = null;
function _getDB() {
  if (_outreachDB) return _outreachDB;
  try {
    const fb = window.firebase;
    if (!fb) return null;
    const app = fb.apps.length ? fb.app() : fb.initializeApp(_OUTREACH_FB_CONFIG, 'prayer-modal');
    _outreachDB = app.firestore();
  } catch (e) {
    console.warn('[prayer-modal] Firebase init failed:', e.message);
  }
  return _outreachDB;
}

async function _submitOutreachContact(data) {
  const db = _getDB();
  if (!db) throw new Error('Firebase not available');
  await db.collection('outreachContacts').add({
    source:      data.source     || 'PublicNCFooter',
    firstName:   data.firstName  || '',
    lastName:    data.lastName   || '',
    email:       data.email      || '',
    phone:       data.phone      || '',
    requestType: data.requestType|| 'Prayer Request',
    message:     data.message    || '',
    urgency:     data.urgency    || 'Normal',
    context:     data.context    || '',
    status:      'New',
    createdAt:   window.firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/* ─── CSS (injected once on first import) ────────────────────────────────── */
let _stylesInjected = false;
function _injectStyles() {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.id = 'gp-prayer-modal-styles';
  s.textContent = `
.gp-prayer-overlay {
  position:fixed; inset:0; z-index:10000;
  background:rgba(12,20,69,0.75); backdrop-filter:blur(5px);
  display:flex; align-items:flex-start; justify-content:center;
  padding:16px 16px 40px; overflow-y:auto;
  animation:gp-overlay-in 180ms ease;
}
@media(min-width:600px) { .gp-prayer-overlay { align-items:center; } }
@keyframes gp-overlay-in { from{opacity:0} to{opacity:1} }
.gp-prayer-card {
  background:var(--bg-raised,#fff); border:1px solid var(--line,#e5e7ef);
  border-radius:20px; box-shadow:0 24px 72px rgba(15,23,42,.30);
  width:100%; max-width:520px;
  padding:28px 28px 24px;
  animation:gp-card-in 200ms cubic-bezier(.2,.8,.2,1);
}
@keyframes gp-card-in { from{transform:translateY(12px) scale(.97);opacity:0} to{transform:none;opacity:1} }
.gp-prayer-head { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; gap:12px; }
.gp-prayer-title { font:700 1.15rem var(--font-ui,sans-serif); color:var(--ink,#1b264f); margin:0 0 3px; }
.gp-prayer-sub   { font:0.84rem var(--font-ui,sans-serif); color:var(--ink-muted,#7a7f96); margin:0; line-height:1.4; }
.gp-prayer-field { display:flex; flex-direction:column; gap:4px; margin-bottom:13px; }
.gp-prayer-label { font:600 0.78rem var(--font-ui,sans-serif); color:var(--ink,#1b264f); }
.gp-prayer-input {
  padding:9px 12px; border-radius:10px; border:1.5px solid var(--line,#e5e7ef);
  font:0.9rem var(--font-ui,sans-serif); color:var(--ink,#1b264f);
  background:var(--bg,#f7f8fb); outline:none; transition:border-color 130ms;
  width:100%; box-sizing:border-box;
}
.gp-prayer-input:focus { border-color:var(--gold,#e8a838); }
textarea.gp-prayer-input { resize:vertical; min-height:100px; font-size:.85rem; line-height:1.5; }
.gp-prayer-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
@media(max-width:480px) { .gp-prayer-row { grid-template-columns:1fr; } }
.gp-prayer-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:6px; }
.gp-prayer-submit {
  flex:1; padding:12px 18px; border-radius:10px;
  background:var(--gold,#e8a838); color:#0c1445; border:0;
  font:700 0.9rem var(--font-ui,sans-serif); cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  transition:background 130ms, transform 100ms;
}
.gp-prayer-submit:hover:not(:disabled) { background:#f0b534; transform:translateY(-1px); }
.gp-prayer-submit:disabled { opacity:.6; cursor:not-allowed; }
.gp-prayer-cancel {
  padding:12px 16px; border-radius:10px; background:transparent;
  border:1.5px solid var(--line,#e5e7ef);
  font:600 0.85rem var(--font-ui,sans-serif); color:var(--ink-muted,#7a7f96);
  cursor:pointer; transition:border-color 130ms,color 130ms;
}
.gp-prayer-cancel:hover { border-color:var(--ink,#1b264f); color:var(--ink,#1b264f); }
.gp-prayer-privacy {
  margin-top:14px; padding:10px 14px; border-radius:10px;
  background:rgba(232,168,56,.10);
  font:0.76rem var(--font-ui,sans-serif); color:var(--ink-muted,#7a7f96); line-height:1.5;
}
.gp-prayer-success { text-align:center; padding:12px 0 4px; }
.gp-prayer-success-icon {
  width:56px; height:56px; border-radius:50%; margin:0 auto 14px;
  background:rgba(5,150,105,.15); display:flex; align-items:center; justify-content:center;
}
.gp-prayer-success-icon svg { color:#059669; }
.gp-prayer-success-title { font:700 1.15rem var(--font-ui,sans-serif); color:var(--ink,#1b264f); margin:0 0 8px; }
.gp-prayer-success-sub   { font:0.88rem var(--font-ui,sans-serif); color:var(--ink-muted,#7a7f96); margin:0 0 20px; line-height:1.5; }
.gp-prayer-err { margin-top:8px; font:0.82rem var(--font-ui,sans-serif); color:#b91c1c; }
@media(max-width:500px) { .gp-prayer-card { padding:20px 16px 18px; } }
`;
  document.head.appendChild(s);
}

/** Open the public outreach / prayer-request modal.
 * @param {string} [prefillSummary]  pre-filled message text
 * @param {{name?:string,title?:string,source?:string}} [ctx] context (where button was pressed)
 */
export function openPrayerModal(prefillSummary, ctx) {
  _injectStyles();
  document.getElementById('gp-prayer-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'gp-prayer-overlay';
  overlay.className = 'gp-prayer-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'gp-pr-title');

  const _ctxLabel  = ctx?.title || '';
  const _ctxSource = ctx?.source || 'PublicNCFooter';
  const _isSignup  = ctx?.name === 'signup';

  function _renderForm() {
    return /* html */`
      <div class="gp-prayer-head">
        <div>
          <p class="gp-prayer-title" id="gp-pr-title">${_isSignup ? '✉️ Request Access to FlockOS' : '🙏 Send a Request to Your Pastor'}</p>
          <p class="gp-prayer-sub">${_isSignup ? 'Fill in your info and a shepherd will reach out to get you set up.' : 'Fill in your information so pastoral staff can follow up with you personally.'}</p>
          ${_ctxLabel && !_isSignup ? `<p style="margin:6px 0 0;font:600 0.74rem var(--font-ui,sans-serif);color:var(--gold,#e8a838);letter-spacing:.04em;">📍 ${_ctxLabel}</p>` : ''}
        </div>
      </div>

      <div class="gp-prayer-row">
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-fn">First Name</label>
          <input class="gp-prayer-input" id="gp-pr-fn" type="text" placeholder="First" autocomplete="given-name">
        </div>
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-ln">Last Name</label>
          <input class="gp-prayer-input" id="gp-pr-ln" type="text" placeholder="Last" autocomplete="family-name">
        </div>
      </div>

      <div class="gp-prayer-row">
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-email">Email <span style="color:#b91c1c">*</span></label>
          <input class="gp-prayer-input" id="gp-pr-email" type="email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-phone">Phone (optional)</label>
          <input class="gp-prayer-input" id="gp-pr-phone" type="tel" placeholder="(555) 000-0000" autocomplete="tel">
        </div>
      </div>

      <div class="gp-prayer-row">
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-type">Request Type</label>
          <select class="gp-prayer-input" id="gp-pr-type">
            ${_isSignup ? '<option value="Access Request" selected>Access Request</option>' : ''}
            <option value="Prayer Request">Prayer Request</option>
            <option value="Pastoral Care">Pastoral Care</option>
            <option value="Counseling">Counseling</option>
            <option value="General Contact">General Contact</option>
          </select>
        </div>
        <div class="gp-prayer-field">
          <label class="gp-prayer-label" for="gp-pr-urgency">Urgency</label>
          <select class="gp-prayer-input" id="gp-pr-urgency">
            <option value="Normal">Normal</option>
            <option value="Urgent">Urgent — please respond soon</option>
          </select>
        </div>
      </div>

      <div class="gp-prayer-field">
        <label class="gp-prayer-label" for="gp-pr-msg">${_isSignup ? 'Tell us about yourself' : 'Your Message'} <span style="color:#b91c1c">*</span></label>
        <textarea class="gp-prayer-input" id="gp-pr-msg" placeholder="${_isSignup ? 'What brings you here? Any church or background info helps…' : 'Share what\'s on your heart…'}"></textarea>
      </div>

      <div id="gp-pr-err" class="gp-prayer-err" hidden></div>

      <div class="gp-prayer-actions">
        <button class="gp-prayer-submit" id="gp-pr-send">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          ${_isSignup ? 'Request Access' : 'Send to Pastoral Team'}
        </button>
        <button class="gp-prayer-cancel" id="gp-pr-cancel">Cancel</button>
      </div>

      <p class="gp-prayer-privacy">🔒 Your information is shared only with your pastoral staff. Nothing is sold or shared externally.</p>
    `;
  }

  function _renderSuccess(name) {
    return /* html */`
      <div class="gp-prayer-success">
        <div class="gp-prayer-success-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p class="gp-prayer-success-title">Request Received${name ? `, ${name}` : ''}!</p>
        <p class="gp-prayer-success-sub">Your request has been sent to the pastoral team. Someone will be reaching out to you soon. We're praying for you.</p>
        <button class="gp-prayer-submit" id="gp-pr-done" style="max-width:200px;margin:0 auto;">Done</button>
      </div>
    `;
  }

  overlay.innerHTML = `<div class="gp-prayer-card" id="gp-pr-card">${_renderForm()}</div>`;
  document.body.appendChild(overlay);

  function _close() { overlay.remove(); }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) _close(); });
  document.getElementById('gp-pr-cancel')?.addEventListener('click', _close);

  const _esc = (ev) => { if (ev.key === 'Escape') { _close(); document.removeEventListener('keydown', _esc); } };
  document.addEventListener('keydown', _esc);

  document.getElementById('gp-pr-send')?.addEventListener('click', async () => {
    const fn      = document.getElementById('gp-pr-fn')?.value.trim()      || '';
    const ln      = document.getElementById('gp-pr-ln')?.value.trim()      || '';
    const email   = document.getElementById('gp-pr-email')?.value.trim()   || '';
    const phone   = document.getElementById('gp-pr-phone')?.value.trim()   || '';
    const type    = document.getElementById('gp-pr-type')?.value           || 'Prayer Request';
    const urgency = document.getElementById('gp-pr-urgency')?.value        || 'Normal';
    const msg     = document.getElementById('gp-pr-msg')?.value.trim()     || '';
    const errEl   = document.getElementById('gp-pr-err');

    if (!email && !phone) {
      if (errEl) { errEl.textContent = 'Please enter an email address or phone number so we can reach you.'; errEl.hidden = false; }
      document.getElementById('gp-pr-email')?.focus();
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (errEl) { errEl.textContent = 'Please enter a valid email address.'; errEl.hidden = false; }
      document.getElementById('gp-pr-email')?.focus();
      return;
    }
    if (!msg) {
      if (errEl) { errEl.textContent = 'Please add a message so we know how to help.'; errEl.hidden = false; }
      document.getElementById('gp-pr-msg')?.focus();
      return;
    }
    if (errEl) errEl.hidden = true;

    const btn = document.getElementById('gp-pr-send');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    try {
      await _submitOutreachContact({ source: _ctxSource, firstName: fn, lastName: ln, email, phone, requestType: type, urgency, message: msg, context: prefillSummary || _ctxLabel });
      const card = document.getElementById('gp-pr-card');
      if (card) card.innerHTML = _renderSuccess(fn);
      document.getElementById('gp-pr-done')?.addEventListener('click', _close);
    } catch (err) {
      console.warn('[prayer-modal] outreach submit failed:', err);
      const fallbackText = [
        `Name: ${fn} ${ln}`.trim(),
        `Email: ${email}`,
        `Phone: ${phone}`,
        `Type: ${type}`,
        `Urgency: ${urgency}`,
        `\nMessage:\n${msg}`,
      ].filter(l => l.trim()).join('\n');
      try { await navigator.clipboard.writeText(fallbackText); } catch (_) {}
      if (btn) { btn.disabled = false; btn.textContent = 'Send to Pastoral Team'; }
      if (errEl) {
        errEl.textContent = 'We couldn\'t reach the server right now. Your message has been copied to your clipboard — please email or text it to your pastoral team directly.';
        errEl.hidden = false;
      }
    }
  });

  if (prefillSummary) {
    const msgEl = document.getElementById('gp-pr-msg');
    if (msgEl) msgEl.value = prefillSummary;
  }

  setTimeout(() => document.getElementById('gp-pr-fn')?.focus(), 80);
}

/* Expose globally so non-module callers (legacy GROW hooks) can find it. */
if (typeof window !== 'undefined') {
  window._openOutreachModal = openPrayerModal;
  window.openPrayerRequest  = openPrayerModal;
}
