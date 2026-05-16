/* ════════════════════════════════════════════════════════════════════════════
   FLOCKSHOW — Church Presentation App for FlockOS
   Inspired by FreeShow (github.com/ChurchApps/FreeShow — GPL-3.0)

   Features:
     • Show library with search, create, duplicate, delete
     • Slide editor — lyrics, scripture, announcement, blank types
     • Live colour + font-size controls per slide
     • Import lyrics (auto-split on blank lines)
     • Present mode — opens projector window, keyboard / swipe navigable
     • Stage notes visible in present window
     • Offline-first: localStorage persistence, no server required

   Storage key: 'flockshow_shows_v1'
   No Firebase dependency — pure client-side.
   ════════════════════════════════════════════════════════════════════════════ */

// ── Constants ─────────────────────────────────────────────────────────────────
import { mountUnityHeader } from '../Scripts/the_unity_header.js';

const FS_KEY = 'flockshow_shows_v1';

const SLIDE_TYPES = {
  lyrics:    { bg: '#0b0d14', text: '#f0f1f8', label: 'Lyrics',       icon: '🎵' },
  scripture: { bg: '#0d1a2b', text: '#e8d5a3', label: 'Scripture',    icon: '📖' },
  announce:  { bg: '#1a0e3c', text: '#ffffff',  label: 'Announcement', icon: '📣' },
  blank:     { bg: '#000000', text: '#ffffff',  label: 'Blank',        icon: '⬛' },
};

// ── Gradient / colour presets ─────────────────────────────────────────────────
const GRADIENTS = [
  { label: 'Default',      bg: '',                                                tc: '' },
  { label: 'Pure Black',   bg: '#000000',                                         tc: '#ffffff' },
  { label: 'Deep Navy',    bg: '#0b0d14',                                         tc: '#f0f1f8' },
  { label: 'Midnight',     bg: 'linear-gradient(135deg,#0b0d14,#1a0e3c)',         tc: '#e8d5fc' },
  { label: 'Ocean',        bg: 'linear-gradient(135deg,#0d1a2b,#0a2040)',         tc: '#7dd3fc' },
  { label: 'Deep Sea',     bg: 'linear-gradient(180deg,#060a14,#0d2040)',         tc: '#bfdbfe' },
  { label: 'Forest',       bg: 'linear-gradient(135deg,#0a1a0f,#0d2a15)',         tc: '#86efac' },
  { label: 'Emerald',      bg: 'linear-gradient(135deg,#001a0a,#002a10)',         tc: '#6ee7b7' },
  { label: 'Holy Fire',    bg: 'linear-gradient(135deg,#1a0500,#3d1200)',         tc: '#fbbf24' },
  { label: 'Amber',        bg: 'linear-gradient(135deg,#1a1200,#2d1f00)',         tc: '#fde68a' },
  { label: 'Crimson',      bg: 'linear-gradient(135deg,#1a0e0e,#2d0808)',         tc: '#fca5a5' },
  { label: 'Deep Purple',  bg: 'linear-gradient(135deg,#0a0a1e,#1e0a3c)',         tc: '#c4b5fd' },
  { label: 'Royal',        bg: 'linear-gradient(135deg,#0a0040,#1a0060)',         tc: '#a5b4fc' },
  { label: 'Dawn',         bg: 'linear-gradient(135deg,#1a0e1a,#2d0b35)',         tc: '#f9a8d4' },
  { label: 'Night Sky',    bg: 'linear-gradient(180deg,#0d1a2b,#060a12)',         tc: '#bfdbfe' },
  { label: 'Teal',         bg: 'linear-gradient(135deg,#001a1a,#003333)',         tc: '#5eead4' },
  { label: 'Dusk',         bg: 'linear-gradient(180deg,#0a0a1a,#1a0a0a)',         tc: '#fdba74' },
  { label: 'Slate',        bg: 'linear-gradient(135deg,#0f1215,#1a2030)',         tc: '#cbd5e1' },
];

// ── State ─────────────────────────────────────────────────────────────────────
const _st = {
  view:         'library',  // 'library' | 'editor'
  shows:        [],
  activeId:     null,
  activeSlide:  0,
  presentWin:   null,       // reference to projector window
  presentSlide: 0,          // slide currently shown in projector
  search:       '',
};

// ── Utilities ─────────────────────────────────────────────────────────────────
const _uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const _e = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// _esc is an alias for _e — both helpers HTML-escape user-controlled strings
// before they are dropped into innerHTML / template-literal markup.
const _esc = _e;

function _fmtDate(ts) {
  if (!ts) return '';
  // Firestore Timestamp objects expose toDate() / toMillis(); raw numbers / ISO strings work directly.
  var d;
  if (typeof ts === 'object' && ts !== null) {
    if (typeof ts.toDate === 'function')      d = ts.toDate();
    else if (typeof ts.toMillis === 'function') d = new Date(ts.toMillis());
    else if (typeof ts.seconds === 'number')    d = new Date(ts.seconds * 1000);
    else                                        d = new Date(ts);
  } else {
    d = new Date(ts);
  }
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Firestore / GAS / localStorage storage layer ─────────────────────────────

// True when UpperRoom (Firestore) is initialised and ready
function _fsFB() {
  return !!(window.UpperRoom &&
            typeof window.UpperRoom.isReady === 'function' &&
            window.UpperRoom.isReady());
}

// Lightweight GAS API call (mirrors msApiCall in the_shofar)
async function _fsApiCall(action, params) {
  const endpoint = String(window.PASTORAL_DB_V2_ENDPOINT || '').trim();
  if (!endpoint) return null;
  const N = window.Nehemiah;
  const sess = (N && typeof N.getSession === 'function') ? N.getSession() : null;
  if (!sess) return null;
  const p = new URLSearchParams({ action, token: sess.token, email: sess.email, _: String(Date.now()) });
  if (params) Object.keys(params).forEach(k => { if (params[k] != null) p.set(k, String(params[k])); });
  try {
    const resp = await fetch(endpoint + '?' + p.toString(), { referrerPolicy: 'no-referrer' });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data && data.ok) ? data : null;
  } catch (e) {
    console.warn('[FlockShow] GAS call failed:', action, e);
    return null;
  }
}

// Write current shows to localStorage (offline cache)
function _lsSync() {
  try { localStorage.setItem(FS_KEY, JSON.stringify(_st.shows)); } catch (_) {}
}

// Load all shows: Firestore → GAS → localStorage
async function _load() {
  // Render localStorage immediately for zero-wait UX
  try {
    const cached = JSON.parse(localStorage.getItem(FS_KEY) || '[]');
    console.log('[FlockShow] _load: localStorage cache count =', cached.length);
    if (cached.length) {
      _st.shows = cached;
      if (_st.view === 'library') _renderLibrary();
    }
  } catch (e) {
    console.warn('[FlockShow] _load: localStorage parse failed', e);
  }

  // Firestore — update in background
  if (_fsFB()) {
    try {
      console.log('[FlockShow] _load: calling UpperRoom.listPresentations…');
      const result = await window.UpperRoom.listPresentations({ limit: 200 });
      const rows = Array.isArray(result) ? result : (result.results || result.rows || []);
      console.log('[FlockShow] _load: Firestore returned', rows.length, 'rows',
                  Array.isArray(result) ? '(array)' : '(object)', result);
      _st.shows = rows.map(r => { r._fsId = r.id; return r; });
      _lsSync();
      if (_st.view === 'library') _renderLibrary();
      return;
    } catch (e) {
      console.error('[FlockShow] _load: Firestore listPresentations FAILED:', e);
    }
  } else {
    console.warn('[FlockShow] _load: UpperRoom not ready, skipping Firestore. ' +
                 'UpperRoom present? ' + !!window.UpperRoom +
                 ', isReady? ' + (window.UpperRoom && typeof window.UpperRoom.isReady === 'function' ? window.UpperRoom.isReady() : 'n/a'));
  }
  // GAS fallback
  const gasData = await _fsApiCall('presentations.list', {});
  if (gasData && Array.isArray(gasData.rows)) {
    console.log('[FlockShow] _load: GAS returned', gasData.rows.length, 'rows');
    _st.shows = gasData.rows.map(r => { r._gasId = r.id; return r; });
    _lsSync();
    if (_st.view === 'library') _renderLibrary();
    return;
  }
  console.log('[FlockShow] _load: no GAS data; final _st.shows.length =', _st.shows.length);
  // localStorage already rendered above — nothing more to do
}

// Build the Firestore-bound payload for a show.  Includes every field the
// FlockShow side needs to round-trip cleanly — most importantly `theme` (so
// the show's gradient survives the first save), and `sermonId`/`serviceDate`
// (so a presentation pushed from FEED stays linked to its sermon and won't
// be duplicated on the next push).
function _showPayload(show) {
  return {
    name:        show.name || 'Untitled',
    slides:      Array.isArray(show.slides) ? show.slides : [],
    theme:       show.theme || { bg: '', tc: '' },
    sermonId:    show.sermonId    || '',
    serviceDate: show.serviceDate || '',
  };
}

// Sync a single show to Firestore/GAS/localStorage (fire-and-forget safe)
async function _syncShow(show) {
  const payload = _showPayload(show);
  if (_fsFB()) {
    try {
      if (show._fsId) {
        console.log('[FlockShow] _syncShow: UPDATE id=' + show._fsId + ' name="' + payload.name + '"');
        await window.UpperRoom.updatePresentation(Object.assign({ id: show._fsId }, payload));
      } else {
        console.log('[FlockShow] _syncShow: CREATE name="' + payload.name + '" slides=' + payload.slides.length);
        const res = await window.UpperRoom.createPresentation(payload);
        show._fsId = res.id;
        console.log('[FlockShow] _syncShow: CREATE OK — _fsId=' + show._fsId);
      }
      _lsSync();
      return;
    } catch (e) {
      console.error('[FlockShow] _syncShow: Firestore write FAILED:', e);
    }
  } else {
    console.warn('[FlockShow] _syncShow: UpperRoom not ready — write skipped');
  }
  // GAS fallback
  if (String(window.PASTORAL_DB_V2_ENDPOINT || '').trim()) {
    try {
      if (show._gasId) {
        await _fsApiCall('presentations.update', { id: show._gasId, name: payload.name, slides: JSON.stringify(payload.slides) });
      } else {
        const res = await _fsApiCall('presentations.create', { name: payload.name, slides: JSON.stringify(payload.slides) });
        if (res && res.row) show._gasId = res.row.id;
      }
    } catch (e) {
      console.warn('[FlockShow] GAS sync failed:', e);
    }
  }
  _lsSync();
}

// Delete a show from Firestore/GAS (fire-and-forget safe)
async function _removeShow(show) {
  console.log('[FlockShow] _removeShow: id=' + show.id + ' _fsId=' + (show._fsId || '(none)') + ' _gasId=' + (show._gasId || '(none)'));
  if (_fsFB() && show._fsId) {
    try {
      await window.UpperRoom.deletePresentation(show._fsId);
      console.log('[FlockShow] _removeShow: Firestore delete OK');
    } catch (e) {
      console.error('[FlockShow] _removeShow: Firestore delete FAILED:', e);
    }
  } else if (String(window.PASTORAL_DB_V2_ENDPOINT || '').trim() && show._gasId) {
    await _fsApiCall('presentations.delete', { id: show._gasId });
  } else {
    console.warn('[FlockShow] _removeShow: no remote id to delete (local-only show)');
  }
  _lsSync();
}

// ── Model factories ───────────────────────────────────────────────────────────
function _makeSlide(type = 'lyrics', text = '') {
  return { id: _uid(), type, text, reference: '', bgColor: '', textColor: '', notes: '' };
}

function _makeShow(name = 'New Show') {
  const now = Date.now();
  return {
    id:        _uid(),
    name,
    slides:    [_makeSlide('announce', name)],
    theme:     { bg: '', tc: '' },
    createdAt: now,
    updatedAt: now,
  };
}

// ── Accessors ─────────────────────────────────────────────────────────────────
function _activeShow()  { return _st.shows.find(s => s.id === _st.activeId) || null; }
function _activeSlide() { const sh = _activeShow(); return sh?.slides[_st.activeSlide] || null; }

// ── Save / sync ──────────────────────────────────────────────────────────────────
// Sync a specific show (or active show) to storage + localStorage.
function _save(show) {
  _lsSync();
  const toSync = show || _activeShow();
  if (toSync) {
    console.log('[FlockShow] _save: queue sync for id=' + toSync.id + ' _fsId=' + (toSync._fsId || '(none)'));
    _syncShow(toSync); // fire-and-forget
  } else {
    console.log('[FlockShow] _save: no active show to sync (lsSync only)');
  }
}

function _touch(show) { show.updatedAt = Date.now(); _save(show); }

// ── Slide appearance ──────────────────────────────────────────────────────────
function _slideBg(sl, show)  { return sl.bgColor   || show?.theme?.bg || SLIDE_TYPES[sl.type]?.bg   || '#000'; }
function _slideCol(sl, show) { return sl.textColor || show?.theme?.tc || SLIDE_TYPES[sl.type]?.text || '#fff'; }

function _slideFontSize(sl) {
  if (sl.fontSize && sl.fontSize > 0) return sl.fontSize + 'px';
  const len = (sl.text || '').length;
  if (len === 0)   return '4rem';
  if (len < 40)    return '3.2rem';
  if (len < 100)   return '2.4rem';
  if (len < 200)   return '1.8rem';
  if (len < 400)   return '1.3rem';
  return '1rem';
}

// ── Present window document generator ────────────────────────────────────────
function _buildPresentDoc(show, idx) {
  const sl     = show.slides[idx];
  if (!sl) return '';
  const bg     = _slideBg(sl, show);
  const col    = _slideCol(sl, show);
  const fs     = _slideFontSize(sl);
  const body   = sl.type === 'blank' ? '' : _esc(sl.text || '');
  const refHtml = (sl.type === 'scripture' && sl.reference)
    ? `<div style="margin-top:1.2rem;font-size:.65em;opacity:.6;font-style:italic">${_esc(sl.reference)}</div>`
    : '';
  const next    = show.slides[idx + 1];
  const nextHtml = next
    ? `<div style="position:fixed;bottom:14px;left:14px;font:0.68rem system-ui,sans-serif;color:rgba(255,255,255,.38);background:rgba(255,255,255,.07);padding:4px 10px;border-radius:6px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">NEXT: ${_esc((next.text || 'Blank').slice(0, 42))}</div>`
    : '';
  const noteHtml = sl.notes
    ? `<div style="position:fixed;bottom:14px;right:14px;font:0.68rem system-ui,sans-serif;color:rgba(255,255,255,.45);background:rgba(255,255,255,.08);padding:4px 10px;border-radius:6px;max-width:260px;text-align:right">${_esc(sl.notes)}</div>`
    : '';
  const counter = `<div style="position:fixed;top:12px;right:14px;font:0.65rem system-ui,sans-serif;color:rgba(255,255,255,.22)">${idx + 1}&thinsp;/&thinsp;${show.slides.length}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>FlockShow — ${_esc(show.name)}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: ${bg};
  font-family: Georgia, 'Noto Serif', serif;
  -webkit-font-smoothing: antialiased;
  user-select: none; cursor: none;
}
.slide {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  width: 100%; height: 100%;
  padding: 6vw 12vw; text-align: center;
  color: ${col};
}
.slide-text {
  font-size: ${fs}; font-weight: 400;
  white-space: pre-wrap; max-width: 960px; line-height: 1.48;
  animation: fi .22s ease;
}
@keyframes fi {
  from { opacity: 0; transform: translateY(7px); }
  to   { opacity: 1; transform: none; }
}
</style>
</head>
<body>
<div class="slide">
  <div class="slide-text">${body}</div>
  ${refHtml}
</div>
${counter}${nextHtml}${noteHtml}
<script>
var _bg = ${JSON.stringify(bg)};
var _blacked = false;
document.addEventListener('keydown', function(e) {
  var o = window.opener;
  // B = black screen toggle
  if (e.key === 'b' || e.key === 'B') {
    _blacked = !_blacked;
    document.body.style.background = _blacked ? '#000' : _bg;
    document.querySelector('.slide').style.visibility = _blacked ? 'hidden' : 'visible';
    return;
  }
  if (!o || !o._fsKey) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault(); _blacked = false; document.body.style.background=_bg; document.querySelector('.slide').style.visibility='visible'; o._fsKey('next');
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
    e.preventDefault(); _blacked = false; document.body.style.background=_bg; document.querySelector('.slide').style.visibility='visible'; o._fsKey('prev');
  } else if (e.key === 'f' || e.key === 'F') {
    document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  } else if (e.key === 'Escape') {
    window.close();
  }
});
// Touch swipe
var _tx = 0;
document.addEventListener('touchstart', function(e) { _tx = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', function(e) {
  var dx = e.changedTouches[0].clientX - _tx;
  if (Math.abs(dx) > 50) {
    var o = window.opener;
    if (o && o._fsKey) o._fsKey(dx < 0 ? 'next' : 'prev');
  }
}, { passive: true });
<\/script>
</body>
</html>`;
}

// ── Present navigation (called by projector window) ───────────────────────────
window._fsKey = function(dir) {
  const show = _activeShow();
  if (!show) return;
  if (dir === 'next') _st.presentSlide = Math.min(_st.presentSlide + 1, show.slides.length - 1);
  if (dir === 'prev') _st.presentSlide = Math.max(_st.presentSlide - 1, 0);
  _pushToPresent();
  // Mirror selection in editor
  _st.activeSlide = _st.presentSlide;
  _renderSlideList();
  _renderPreview();
  _renderProps();
};

function _pushToPresent() {
  if (!_st.presentWin || _st.presentWin.closed) return;
  const show = _activeShow();
  if (!show) return;
  _st.presentWin.document.open();
  _st.presentWin.document.write(_buildPresentDoc(show, _st.presentSlide));
  _st.presentWin.document.close();
}

// ── Render: library grid ──────────────────────────────────────────────────────
function _renderLibrary() {
  const grid = document.getElementById('fs-shows-grid');
  if (!grid) return;
  const q = _st.search.toLowerCase().trim();
  const shows = q
    ? _st.shows.filter(s => s.name.toLowerCase().includes(q))
    : _st.shows;

  if (!shows.length) {
    if (q) {
      grid.innerHTML = `
        <div class="fs-empty">
          <div class="fs-empty-icon">🎬</div>
          <div style="font:600 1rem 'Plus Jakarta Sans',sans-serif;color:var(--fs-ink)">
            No shows match your search
          </div>
          <div style="font:0.82rem 'Plus Jakarta Sans',sans-serif;color:var(--fs-muted)">
            Try a different search term
          </div>
        </div>`;
      return;
    }
    // First-run welcome — navy/gold "Vespers" themed card + feature tiles.
    const _sess = (window.Modules && typeof window.Modules.getSession === 'function')
      ? (window.Modules.getSession() || {})
      : {};
    const _displayName = _sess.displayName || _sess.name || (_sess.email ? _sess.email.split('@')[0] : '');
    const _firstName = (String(_displayName).trim().split(/\s+/)[0] || '').replace(/[<>&"']/g, '');
    const _welcomeName = _firstName || 'Pastor';
    grid.innerHTML = `
      <div class="fs-welcome">
        <div class="fs-welcome-hero devo-dark-card">
          <div class="word-body">
            <div class="word-eyebrow devo-dark-eyebrow">
              <span>For the Shepherds</span>
              <span class="word-theme devo-dark-theme">Free • Forever</span>
            </div>
            <div class="word-title devo-dark-title">Welcome, ${_welcomeName}.</div>
            <div class="word-scrip devo-dark-scrip">
              <em>"Praise Him with strings and pipe."</em> &mdash; Psalm 150:4
            </div>
            <p class="word-tease devo-dark-tease">
              Every premium tool in FlockOS &mdash; FlockShow, FEED, GROW, STAND, and FlockChat &mdash;
              is yours at no cost. You carry the weight of ministry, and we want nothing standing
              between you and the people you shepherd. <strong>We are praying for you. We love you.
              Thank you for the work you do.</strong>
            </p>
            <button type="button" class="fs-btn fs-btn--primary fs-welcome-cta" id="fs-welcome-new-btn">
              + Create your first show
            </button>
          </div>
        </div>

        <div class="fs-welcome-features">
          <div class="fs-welcome-feat">
            <div class="fs-welcome-feat-icon">🎬</div>
            <div class="fs-welcome-feat-title">Multi-Slide Presentations</div>
            <div class="fs-welcome-feat-body">
              Build beautiful worship slides with lyrics, scripture, and announcements.
            </div>
          </div>
          <div class="fs-welcome-feat">
            <div class="fs-welcome-feat-icon">📖</div>
            <div class="fs-welcome-feat-title">Import from Sermons &amp; Songs</div>
            <div class="fs-welcome-feat-body">
              Auto-generate slides from your FlockOS sermon library or FlockStand worship songs.
            </div>
          </div>
          <div class="fs-welcome-feat">
            <div class="fs-welcome-feat-icon">✦</div>
            <div class="fs-welcome-feat-title">Gradient Backgrounds &amp; Themes</div>
            <div class="fs-welcome-feat-body">
              18 stunning gradients plus custom colours &mdash; apply themes across an entire show in one click.
            </div>
          </div>
        </div>
      </div>`;

    // Wire the welcome CTA to the same handler the main "+ New Show" button uses.
    const cta = document.getElementById('fs-welcome-new-btn');
    if (cta) cta.addEventListener('click', () => {
      document.getElementById('fs-new-show-btn')?.click();
    });
    return;
  }

  // Slim Vespers-themed banner sits above the show grid so the encouragement
  // copy stays in front of pastors even after their library fills up.
  const banner = `
    <div class="fs-lib-banner devo-dark-card">
      <div class="fs-lib-banner-body">
        <div class="fs-lib-banner-eyebrow">
          <span>For the Shepherds</span>
          <span class="fs-lib-banner-pill">Free \u2022 Forever</span>
        </div>
        <div class="fs-lib-banner-msg">
          We are praying for you. We love you. Thank you for the work you do.
        </div>
      </div>
    </div>`;

  const cards = shows.map(show => {
    const dateStr = _fmtDate(show.updatedAt || show.createdAt);
    const pips = show.slides.slice(0, 10).map(sl => {
      const bg = _slideBg(sl, show);
      const fg = _slideCol(sl, show);
      const icon = _e(SLIDE_TYPES[sl.type] && SLIDE_TYPES[sl.type].icon || '\u2726');
      return `<div class="fs-slide-pip" style="background:${_e(bg)};color:${_e(fg)}"><span class="fs-slide-pip-icon">${icon}</span></div>`;
    }).join('');
    const overflow = show.slides.length > 10
      ? `<div class="fs-slide-pip fs-slide-pip--more">+${show.slides.length - 10}</div>`
      : '';
    return `
      <div class="fs-show-card" data-show-id="${_e(show.id)}">
        <div class="fs-show-name">${_e(show.name)}</div>
        <div class="fs-show-meta">
          ${show.slides.length} slide${show.slides.length !== 1 ? 's' : ''}${dateStr ? '&nbsp;&middot;&nbsp;' + dateStr : ''}
        </div>
        <div class="fs-show-preview">${pips}${overflow}</div>
        <div class="fs-show-actions">
          <button class="fs-show-action-btn fs-show-action-btn--edit" data-act="edit" data-id="${_e(show.id)}">Edit</button>
          <button class="fs-show-action-btn fs-show-action-btn--dup"  data-act="dup"  data-id="${_e(show.id)}">Duplicate</button>
          <button class="fs-show-action-btn fs-show-action-btn--del"  data-act="del"  data-id="${_e(show.id)}">Delete</button>
        </div>
      </div>`;
  }).join('');

  grid.innerHTML = banner + cards;
}

// ── Render: slide thumbnails ──────────────────────────────────────────────────
function _renderSlideList() {
  const list = document.getElementById('fs-slide-list');
  if (!list) return;
  const show = _activeShow();

  // Remove old slide items, keep the add-slide wrapper
  list.querySelectorAll('.fs-slide-item').forEach(el => el.remove());

  if (!show) return;

  const fragment = document.createDocumentFragment();
  show.slides.forEach((sl, i) => {
    const div = document.createElement('div');
    div.className = 'fs-slide-item' + (i === _st.activeSlide ? ' fs-slide-item--active' : '');
    div.dataset.slideIdx = i;
    div.innerHTML = `
      <div class="fs-slide-num">${i + 1}</div>
      <div class="fs-slide-thumb" style="background:${_e(_slideBg(sl, show))}">
        <div class="fs-slide-thumb-text" style="color:${_e(_slideCol(sl, show))}">${_e((sl.text || '').slice(0, 80))}</div>
        <div class="fs-type-chip">${_e(SLIDE_TYPES[sl.type]?.icon || '')}</div>
      </div>`;
    fragment.appendChild(div);
  });

  // Insert before the add-slide wrapper
  const addWrap = list.querySelector('#fs-add-slide-wrap');
  list.insertBefore(fragment, addWrap);
}

// ── Render: center preview ────────────────────────────────────────────────────
function _renderPreview() {
  const canvas   = document.getElementById('fs-slide-canvas');
  const textEl   = document.getElementById('fs-canvas-text');
  const refEl    = document.getElementById('fs-canvas-ref');
  const counter  = document.getElementById('fs-prev-counter');
  const prevBtn  = document.getElementById('fs-prev-btn');
  const nextBtn  = document.getElementById('fs-next-btn');
  const goLiveBtn = document.getElementById('fs-go-live-btn');
  if (!canvas) return;

  const show = _activeShow();
  const sl   = _activeSlide();
  if (!show || !sl) {
    counter && (counter.textContent = '— / —');
    return;
  }

  canvas.style.background = _slideBg(sl, show);
  textEl.style.color      = _slideCol(sl, show);
  textEl.style.fontSize   = _slideFontSize(sl);
  textEl.textContent      = sl.type === 'blank' ? '' : (sl.text || '');

  if (sl.type === 'scripture' && sl.reference) {
    refEl.textContent  = sl.reference;
    refEl.style.color  = _slideCol(sl, show);
    refEl.hidden = false;
  } else {
    refEl.hidden = true;
  }

  counter.textContent  = `${_st.activeSlide + 1} / ${show.slides.length}`;
  prevBtn.disabled     = _st.activeSlide === 0;
  nextBtn.disabled     = _st.activeSlide === show.slides.length - 1;
  if (goLiveBtn) goLiveBtn.disabled = !(_st.presentWin && !_st.presentWin.closed);
}

// ── Render: properties panel ──────────────────────────────────────────────────
function _renderProps() {
  const show = _activeShow();
  const sl   = _activeSlide();
  if (!show || !sl) return;

  // Type buttons
  document.querySelectorAll('.fs-type-btn').forEach(btn => {
    btn.classList.toggle('fs-type-btn--active', btn.dataset.type === sl.type);
  });

  // Text
  const textEl = document.getElementById('fs-prop-text');
  if (textEl && textEl !== document.activeElement) textEl.value = sl.text || '';

  // Ref section
  const refEl      = document.getElementById('fs-prop-ref');
  const refSection = document.getElementById('fs-prop-ref-section');
  if (refEl && refEl !== document.activeElement) refEl.value = sl.reference || '';
  if (refSection) refSection.hidden = sl.type !== 'scripture';

  // Text section (hidden for blank)
  const textSection = document.getElementById('fs-prop-text-section');
  if (textSection) textSection.hidden = sl.type === 'blank';

  // Background color
  const bgInput = document.getElementById('fs-prop-bg');
  const bgLabel = document.getElementById('fs-prop-bg-label');
  const _isBgGrad = sl.bgColor && sl.bgColor.includes('gradient');
  if (bgInput) bgInput.value = _isBgGrad ? (SLIDE_TYPES[sl.type]?.bg || '#000000') : (sl.bgColor || SLIDE_TYPES[sl.type]?.bg || '#000000');
  if (bgLabel) bgLabel.textContent = _isBgGrad ? (GRADIENTS.find(g => g.bg === sl.bgColor)?.label || 'Gradient') : (sl.bgColor || 'Default');

  // Text color
  const tcInput = document.getElementById('fs-prop-tc');
  const tcLabel = document.getElementById('fs-prop-tc-label');
  if (tcInput) tcInput.value = sl.textColor || SLIDE_TYPES[sl.type]?.text || '#ffffff';
  if (tcLabel) tcLabel.textContent = sl.textColor || 'Default';

  // Notes
  const notesEl = document.getElementById('fs-prop-notes');
  if (notesEl && notesEl !== document.activeElement) notesEl.value = sl.notes || '';

  // Bible section (scripture only)
  const bibleSection = document.getElementById('fs-bible-section');
  if (bibleSection) bibleSection.hidden = sl.type !== 'scripture';
  // Restore saved translation preference
  const transEl = document.getElementById('fs-bible-translation');
  if (transEl && transEl !== document.activeElement) {
    transEl.value = _getBibleTranslation();
  }

  // Font size slider
  const fsSlider = document.getElementById('fs-prop-font-size');
  const fsLabel  = document.getElementById('fs-prop-font-size-val');
  if (fsSlider) fsSlider.value = sl.fontSize || 0;
  if (fsLabel)  fsLabel.textContent = (sl.fontSize && sl.fontSize > 0) ? sl.fontSize + 'px' : 'Auto';

  // Theme swatches — mark active
  const activeBg = sl.bgColor || '';
  document.querySelectorAll('.fs-swatch').forEach(sw => {
    sw.classList.toggle('fs-swatch--active', sw.dataset.bg === activeBg);
  });

  // Show theme bar
  _renderShowTheme();

  // Editor bar
  const titleEl   = document.getElementById('fs-show-title');
  const countEl   = document.getElementById('fs-slide-count');
  if (titleEl && titleEl !== document.activeElement) titleEl.value = show.name;
  if (countEl) countEl.textContent = `${show.slides.length} slide${show.slides.length !== 1 ? 's' : ''}`;

  // Export button enabled when in editor
  const expBtn = document.getElementById('fs-export-show-btn');
  if (expBtn) expBtn.disabled = false;
}

// ── Render: topbar header ─────────────────────────────────────────────────────
function _renderHeader() {
  const editorTab  = document.getElementById('fs-editor-tab');
  const presentBtn = document.getElementById('fs-present-btn');
  const topRight   = document.getElementById('fs-topbar-right');
  const show       = _activeShow();
  const isLive     = _st.presentWin && !_st.presentWin.closed;

  if (editorTab)  editorTab.disabled = !show;
  if (presentBtn) {
    presentBtn.disabled  = !show;
    presentBtn.textContent = isLive ? '⏹ Stop' : '▶ Present';
    presentBtn.className   = isLive
      ? 'fs-btn fs-btn--danger'
      : 'fs-btn fs-btn--primary';
  }

  const badge = document.getElementById('fs-live-badge');
  if (isLive && !badge && topRight) {
    const el = document.createElement('div');
    el.id = 'fs-live-badge';
    el.className = 'fs-live-badge';
    el.innerHTML = '<div class="fs-live-dot"></div>LIVE';
    topRight.insertBefore(el, presentBtn);
  } else if (!isLive && badge) {
    badge.remove();
  }
}

// ── Full re-render ────────────────────────────────────────────────────────────
function _renderAll() {
  _renderLibrary();
  _renderHeader();
  if (_st.view === 'editor') {
    _renderSlideList();
    _renderPreview();
    _renderProps();
  }
}

// ── View switching ────────────────────────────────────────────────────────────
function _setView(view) {
  _st.view = view;
  document.getElementById('fs-library').hidden = view !== 'library';
  document.getElementById('fs-editor').hidden  = view !== 'editor';
  document.querySelectorAll('.fs-tab').forEach(t => {
    t.classList.toggle('fs-tab--active', t.dataset.tab === view);
  });
  if (view === 'editor') {
    _renderSlideList();
    _renderPreview();
    _renderProps();
  }
}

// ── Show CRUD ─────────────────────────────────────────────────────────────────
function _openShow(id) {
  _st.activeId    = id;
  _st.activeSlide = 0;
  _setView('editor');
  _renderHeader();
}

function _newShow() {
  console.log('[FlockShow] _newShow: opening name modal');
  _openNameModal('New Show', 'Show Name', name => {
    const show = _makeShow(name);
    console.log('[FlockShow] _newShow: created locally id=' + show.id + ' name="' + show.name + '"');
    _st.shows.unshift(show);
    _save(show);
    _openShow(show.id);
  });
}

// Open the #fs-name-modal and call onConfirm(name) when OK is pressed
function _openNameModal(defaultValue, title, onConfirm) {
  const modal  = document.getElementById('fs-name-modal');
  const input  = document.getElementById('fs-nm-input');
  const titleEl = document.getElementById('fs-nm-title');
  const okBtn  = document.getElementById('fs-nm-ok');
  const cancelBtn = document.getElementById('fs-nm-cancel');
  const backdrop  = document.getElementById('fs-nm-backdrop');
  if (!modal || !input) { onConfirm(defaultValue); return; }

  if (titleEl) titleEl.textContent = title;
  input.value = defaultValue;
  modal.hidden = false;
  input.focus();
  input.select();

  function _close() {
    modal.hidden = true;
    okBtn.removeEventListener('click', _ok);
    cancelBtn.removeEventListener('click', _close);
    backdrop.removeEventListener('click', _close);
    input.removeEventListener('keydown', _key);
  }
  function _ok() {
    const name = input.value.trim() || defaultValue;
    _close();
    onConfirm(name);
  }
  function _key(e) {
    if (e.key === 'Enter') { e.preventDefault(); _ok(); }
    if (e.key === 'Escape') { _close(); }
  }

  okBtn.addEventListener('click', _ok);
  cancelBtn.addEventListener('click', _close);
  backdrop.addEventListener('click', _close);
  input.addEventListener('keydown', _key);
}

// Open the #fs-confirm-modal and call onConfirm() when OK is pressed
function _openConfirmModal(title, msg, okLabel, onConfirm) {
  const modal     = document.getElementById('fs-confirm-modal');
  const titleEl   = document.getElementById('fs-cm-title');
  const msgEl     = document.getElementById('fs-cm-msg');
  const okBtn     = document.getElementById('fs-cm-ok');
  const cancelBtn = document.getElementById('fs-cm-cancel');
  const backdrop  = document.getElementById('fs-cm-backdrop');
  if (!modal) { if (window.confirm(msg)) onConfirm(); return; }

  if (titleEl) titleEl.textContent = title;
  if (msgEl)   msgEl.textContent   = msg;
  if (okBtn)   okBtn.textContent   = okLabel || 'Confirm';
  modal.hidden = false;
  okBtn.focus();

  function _close() {
    modal.hidden = true;
    okBtn.removeEventListener('click', _ok);
    cancelBtn.removeEventListener('click', _close);
    backdrop.removeEventListener('click', _close);
    document.removeEventListener('keydown', _key);
  }
  function _ok() { _close(); onConfirm(); }
  function _key(e) {
    if (e.key === 'Enter')  { e.preventDefault(); _ok(); }
    if (e.key === 'Escape') { _close(); }
  }
  okBtn.addEventListener('click', _ok);
  cancelBtn.addEventListener('click', _close);
  backdrop.addEventListener('click', _close);
  document.addEventListener('keydown', _key);
}

function _dupShow(id) {
  const src = _st.shows.find(s => s.id === id);
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = _uid();
  copy.name = src.name + ' (copy)';
  copy.createdAt = copy.updatedAt = Date.now();
  delete copy._fsId; delete copy._gasId;
  copy.slides.forEach(sl => { sl.id = _uid(); });
  const idx = _st.shows.findIndex(s => s.id === id);
  _st.shows.splice(idx + 1, 0, copy);
  _save(copy);
  _renderLibrary();
}

function _delShow(id) {
  const show = _st.shows.find(s => s.id === id);
  if (!show) return;
  _openConfirmModal(
    'Delete Show',
    `"${show.name}" will be permanently deleted. This cannot be undone.`,
    'Delete',
    () => {
      _st.shows = _st.shows.filter(s => s.id !== id);
      if (_st.activeId === id) { _st.activeId = null; _setView('library'); }
      _removeShow(show);
      _renderLibrary();
      _renderHeader();
    }
  );
}

// ── Slide CRUD ────────────────────────────────────────────────────────────────
function _addSlide(type) {
  const show = _activeShow();
  if (!show) return;
  const sl = _makeSlide(type, '');
  show.slides.splice(_st.activeSlide + 1, 0, sl);
  _st.activeSlide += 1;
  _touch(show);
  _renderSlideList();
  _renderPreview();
  _renderProps();
  _pushToPresent();
}

function _dupSlide() {
  const show = _activeShow();
  const sl   = _activeSlide();
  if (!show || !sl) return;
  const copy = { ...sl, id: _uid() };
  show.slides.splice(_st.activeSlide + 1, 0, copy);
  _st.activeSlide += 1;
  _touch(show);
  _renderSlideList();
  _renderPreview();
  _renderProps();
  _pushToPresent();
}

function _delSlide() {
  const show = _activeShow();
  if (!show || show.slides.length <= 1) {
    alert('A show must have at least one slide.');
    return;
  }
  _openConfirmModal('Delete Slide', 'This slide will be permanently removed.', 'Delete', () => {
    show.slides.splice(_st.activeSlide, 1);
    _st.activeSlide = Math.min(_st.activeSlide, show.slides.length - 1);
    _touch(show);
    _renderSlideList();
    _renderPreview();
    _renderProps();
    _pushToPresent();
  });
}

function _selectSlide(idx) {
  const show = _activeShow();
  if (!show) return;
  const clamped = Math.max(0, Math.min(idx, show.slides.length - 1));
  if (clamped === _st.activeSlide) return;
  _st.activeSlide = clamped;
  _renderSlideList();
  _renderPreview();
  _renderProps();
}

// ── Import lyrics ─────────────────────────────────────────────────────────────
function _importLyrics() {
  const area = document.getElementById('fs-import-area');
  if (!area) return;
  const raw = area.value.trim();
  if (!raw) return;
  const show = _activeShow();
  if (!show) return;

  // Split on two or more blank lines
  const stanzas = raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  if (!stanzas.length) return;

  const newSlides = stanzas.map(text => _makeSlide('lyrics', text));
  show.slides.splice(_st.activeSlide + 1, 0, ...newSlides);
  _st.activeSlide += 1;
  _touch(show);
  area.value = '';
  _renderSlideList();
  _renderPreview();
  _renderProps();
  _pushToPresent();
}

// ── Bible verse fetch (bible-api.com — free, no key required) ────────────────
function _getBibleTranslation() {
  return localStorage.getItem('flockshow_bible_trans') || 'kjv';
}
function _setBibleTranslation(t) {
  localStorage.setItem('flockshow_bible_trans', t);
}

let _lastBibleData = null;
let _lastBibleSlideId = null;  // capture which slide the fetch targeted, so
                                // a later "Split into verses" doesn't blow
                                // away an unrelated slide if the user moved
                                // selection in the meantime

async function _fetchBibleVerse() {
  const queryEl    = document.getElementById('fs-bible-query');
  const transEl    = document.getElementById('fs-bible-translation');
  const splitBtn   = document.getElementById('fs-bible-split-btn');
  const query      = (queryEl?.value || '').trim();
  const translation = transEl?.value || 'kjv';

  if (!query) { _bibleStatus('Enter a verse reference (e.g. John 3:16)', 'err'); return; }
  _bibleStatus('Fetching from Bible API…', '');
  if (splitBtn) splitBtn.hidden = true;

  try {
    const url  = `https://bible-api.com/${encodeURIComponent(query)}?translation=${translation}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Server error (${resp.status})`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);

    _lastBibleData = data;
    _setBibleTranslation(translation);

    const sl   = _activeSlide();
    const show = _activeShow();
    if (!sl || !show) { _bibleStatus('Select a slide first.', 'err'); return; }
    _lastBibleSlideId = sl.id;

    const verses = data.verses || [];
    const text   = verses.map(v => v.text.trim()).join('\n');
    const ref    = data.reference || query;
    const label  = translation.toUpperCase();

    sl.text      = text;
    sl.reference = `${ref} (${label})`;
    _touch(show);
    _renderSlideList();
    _renderPreview();
    _renderProps();
    _pushToPresent();

    const count = verses.length;
    _bibleStatus(`✓ ${ref} — ${count} verse${count !== 1 ? 's' : ''} (${label})`, 'ok');
    if (splitBtn) splitBtn.hidden = count <= 1;
  } catch (e) {
    console.warn('[FlockShow] Bible fetch failed:', e);
    _bibleStatus(`Could not fetch: ${e.message}`, 'err');
  }
}

function _bibleStatus(msg, type) {
  const el = document.getElementById('fs-bible-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'fs-bible-status' + (type ? ` fs-bible-status--${type}` : '');
  el.hidden = false;
}

function _splitBibleVerses() {
  if (!_lastBibleData || !(_lastBibleData.verses || []).length) return;
  const show = _activeShow();
  if (!show) return;
  // Locate the slide we originally wrote the fetched verses into.  If the
  // user has since clicked a different slide, fall back to the current
  // active slide so we don't clobber unrelated content unexpectedly.
  let targetIdx = show.slides.findIndex(s => s.id === _lastBibleSlideId);
  if (targetIdx < 0) targetIdx = _st.activeSlide;
  const label  = (document.getElementById('fs-bible-translation')?.value || 'kjv').toUpperCase();
  const verses = _lastBibleData.verses;

  const newSlides = verses.map(v => {
    const sl = _makeSlide('scripture', v.text.trim());
    sl.reference = `${v.book_name} ${v.chapter}:${v.verse} (${label})`;
    return sl;
  });
  // Replace target slide with one per verse
  show.slides.splice(targetIdx, 1, ...newSlides);
  _st.activeSlide = targetIdx;
  _touch(show);
  _renderSlideList();
  _renderPreview();
  _renderProps();
  _pushToPresent();
  const splitBtn = document.getElementById('fs-bible-split-btn');
  if (splitBtn) splitBtn.hidden = true;
  _bibleStatus(`Split into ${verses.length} slide${verses.length !== 1 ? 's' : ''}`, 'ok');
}

// ── Export / Import show as JSON file ────────────────────────────────────────
function _exportShow() {
  const show = _activeShow() || _st.shows[0];
  if (!show) return;
  const clean = JSON.parse(JSON.stringify(show));
  delete clean._fsId; delete clean._gasId;
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (show.name || 'FlockShow').replace(/[^a-zA-Z0-9 _-]/g, '') + '.flockshow.json';
  a.click();
  URL.revokeObjectURL(url);
}

function _importShow() {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = '.json,.flockshow.json';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const show = JSON.parse(text);
      if (!show.id || !Array.isArray(show.slides)) throw new Error('Not a valid FlockShow file');
      show.id   = _uid();
      show.name = (show.name || 'Imported Show') + ' (imported)';
      show.slides.forEach(sl => { sl.id = _uid(); });
      _st.shows.unshift(show);
      _lsSync();
      _syncShow(show);
      _renderLibrary();
    } catch (e) {
      alert('Could not import show: ' + e.message);
    }
  });
  input.click();
}

// ── ProPresenter import (.pro6 XML, .pro4 XML, .txt plain text) ──────────────
//
//   .pro6 / .pro4  → XML.  Each <RVDisplaySlide> contains
//                    <RVTextElement> with <NSString rvXMLIvarName="RTFData">
//                    holding base64-encoded RTF.  We base64-decode then strip
//                    RTF control words to get plain slide text.
//
//   .pro   (v7)    → binary Protobuf.  We tell the user to export as text
//                    or .pro6 from ProPresenter 7 (heuristic binary scraping
//                    produces garbage and is not worth the weight).
//
//   .txt           → plain text.  Blank-line separators become new slides.
//                    Lines beginning with "[Verse]", "[Chorus]" etc are treated
//                    as section breaks.
//
function _stripRTF(rtf) {
  if (!rtf) return '';
  let s = String(rtf);
  // Decode \'XX hex escapes (Latin-1)
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  // Decode \uNNNN? unicode escapes
  s = s.replace(/\\u(-?\d+)\??/g, (_, n) => {
    let cp = parseInt(n, 10);
    if (cp < 0) cp = 65536 + cp;
    return String.fromCharCode(cp);
  });
  // Drop RTF binary/font/colour groups entirely
  s = s.replace(/\{\\\*?[^{}]*\}/g, '');
  // Convert RTF paragraph / line breaks
  s = s.replace(/\\par[d]?\b/g, '\n').replace(/\\line\b/g, '\n').replace(/\\tab\b/g, '\t');
  // Remove remaining RTF control words like \fs24 \cf2 \b0
  s = s.replace(/\\[a-zA-Z]+-?\d*\s?/g, '');
  // Remove stray braces
  s = s.replace(/[{}]/g, '');
  // Collapse 3+ blank lines to 2 (stanza separator)
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function _b64Decode(b64) {
  try {
    const bin = atob(String(b64).replace(/\s+/g, ''));
    // Decode as UTF-8 (RTF data may include unicode escapes)
    return bin;
  } catch (_) { return ''; }
}

function _parseProPresenterXML(xmlText, fallbackName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) throw new Error('Invalid ProPresenter XML');

  const root = doc.documentElement;
  if (!/RVPresentationDocument/i.test(root.nodeName)) {
    throw new Error('Not a ProPresenter document (root: ' + root.nodeName + ')');
  }

  const docName = root.getAttribute('CCLISongTitle')
                || root.getAttribute('CCLIDisplayName')
                || root.getAttribute('docType')
                || fallbackName || 'ProPresenter Import';

  const slides = [];
  // Walk every <RVDisplaySlide> (whether inside a group or standalone)
  const slideEls = doc.querySelectorAll('RVDisplaySlide');
  slideEls.forEach(slEl => {
    const label = slEl.getAttribute('label') || '';
    // Each slide can carry multiple text elements — concat them with blank lines
    const textEls = slEl.querySelectorAll('RVTextElement');
    const textParts = [];
    textEls.forEach(tEl => {
      // RTFData lives in <NSString rvXMLIvarName="RTFData">…</NSString>
      const rtfNode = tEl.querySelector('NSString[rvXMLIvarName="RTFData"]')
                   || tEl.querySelector('NSString');
      if (rtfNode) {
        const decoded = _b64Decode(rtfNode.textContent || '');
        const plain   = _stripRTF(decoded);
        if (plain) textParts.push(plain);
      }
      // PlainText fallback (some .pro4 use this)
      const ptNode = tEl.querySelector('NSString[rvXMLIvarName="PlainText"]');
      if (!rtfNode && ptNode) {
        const plain = (ptNode.textContent || '').trim();
        if (plain) textParts.push(plain);
      }
    });
    const text = textParts.join('\n\n').trim();
    if (text || label) {
      slides.push(_makeSlide('lyrics', text || label));
    }
  });

  if (!slides.length) {
    // Some files put the text only in slide labels
    slideEls.forEach(slEl => {
      const label = slEl.getAttribute('label') || '';
      if (label.trim()) slides.push(_makeSlide('lyrics', label.trim()));
    });
  }

  if (!slides.length) throw new Error('No slides found in ProPresenter file');

  return { name: docName, slides };
}

function _parseProPresenterText(txt, fallbackName) {
  // Plain-text ProPresenter export — lines like "[Verse 1]" mark section breaks.
  const sections = [];
  let current = [];
  String(txt).split(/\r?\n/).forEach(line => {
    if (/^\s*\[[^\]]+\]\s*$/.test(line)) {
      if (current.length) { sections.push(current.join('\n').trim()); current = []; }
    } else {
      current.push(line);
    }
  });
  if (current.length) sections.push(current.join('\n').trim());

  // Also split each section by 2+ blank lines (extra granularity)
  const chunks = [];
  sections.filter(Boolean).forEach(s => {
    s.split(/\n{2,}/).map(c => c.trim()).filter(Boolean).forEach(c => chunks.push(c));
  });

  if (!chunks.length) throw new Error('No text content found');

  return {
    name:   fallbackName || 'ProPresenter Import',
    slides: chunks.map(c => _makeSlide('lyrics', c)),
  };
}

async function _importProPresenter() {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = '.pro6,.pro4,.pro,.txt,application/xml,text/plain';
  input.multiple = true;
  input.addEventListener('change', async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;

    let imported = 0, failed = 0, skipped = 0;
    const failures = [];

    for (const file of files) {
      const base = file.name.replace(/\.(pro6?|pro4|txt)$/i, '');
      try {
        if (/\.pro$/i.test(file.name)) {
          // ProPresenter 7 binary protobuf — not supported
          skipped++;
          failures.push(`${file.name} — ProPresenter 7 .pro is binary. Re-save as .pro6 or export as text.`);
          continue;
        }
        const text = await file.text();
        let parsed;
        if (/^<\?xml|<RVPresentationDocument/i.test(text.trim())) {
          parsed = _parseProPresenterXML(text, base);
        } else {
          parsed = _parseProPresenterText(text, base);
        }
        const show = _makeShow(parsed.name);
        // Replace the auto-created first slide (an "announce" of the show name)
        // with the imported slides
        show.slides = parsed.slides;
        show.slides.forEach(sl => { sl.id = _uid(); });
        _st.shows.unshift(show);
        _save(show);
        imported++;
      } catch (err) {
        failed++;
        failures.push(`${file.name} — ${err.message || err}`);
        console.warn('[FlockShow] ProPresenter import failed for', file.name, err);
      }
    }

    _renderLibrary();

    const parts = [];
    if (imported) parts.push(`Imported ${imported} show${imported === 1 ? '' : 's'}.`);
    if (skipped)  parts.push(`${skipped} skipped.`);
    if (failed)   parts.push(`${failed} failed.`);
    let msg = parts.join('  ');
    if (failures.length) msg += '\n\n' + failures.join('\n');
    if (failures.length || !imported) alert(msg || 'Nothing imported.');
  });
  input.click();
}

// ── Present mode ──────────────────────────────────────────────────────────────
function _togglePresent() {
  // Stop if already live
  if (_st.presentWin && !_st.presentWin.closed) {
    _st.presentWin.close();
    _st.presentWin = null;
    _renderHeader();
    _renderPreview();
    return;
  }

  const show = _activeShow();
  if (!show) return;
  _st.presentSlide = _st.activeSlide;

  const win = window.open(
    '', 'flockshow-present',
    'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,scrollbars=no'
  );
  if (!win) {
    alert('Pop-up blocked — please allow pop-ups for this site to use Present mode.');
    return;
  }

  _st.presentWin = win;
  win.document.open();
  win.document.write(_buildPresentDoc(show, _st.presentSlide));
  win.document.close();

  win.addEventListener('beforeunload', () => {
    _st.presentWin = null;
    _renderHeader();
    _renderPreview();
  });

  _renderHeader();
  _renderPreview();
}

// ── Gradient swatches (JS-generated from GRADIENTS array) ────────────────────
function _initSwatches() {
  const container = document.getElementById('fs-theme-swatches');
  if (!container) return;
  container.innerHTML = GRADIENTS.map(g => {
    const visual = g.bg.includes('gradient') ? g.bg : (g.bg || 'linear-gradient(135deg,#0b0d14 50%,#1a0e3c)');
    return `<button class="fs-swatch" data-bg="${_e(g.bg)}" data-tc="${_e(g.tc)}" title="${_e(g.label)}" style="background:${visual}"></button>`;
  }).join('');
}

// ── Show theme controls ───────────────────────────────────────────────────────
function _renderShowTheme() {
  const show  = _activeShow();
  const chip  = document.getElementById('fs-show-theme-chip');
  const label = document.getElementById('fs-show-theme-label');
  if (!chip || !label) return;
  const bg = show?.theme?.bg || '';
  const isGrad = bg.includes('gradient');
  chip.style.background = bg || '#0b0d14';
  const gradName = isGrad ? (GRADIENTS.find(g => g.bg === bg)?.label || 'Custom gradient') : '';
  label.textContent = bg ? (gradName || bg) : 'None — using type defaults';
}

function _setShowTheme() {
  const show = _activeShow();
  const sl   = _activeSlide();
  if (!show || !sl) return;
  if (!show.theme) show.theme = {};
  show.theme.bg = sl.bgColor || '';
  show.theme.tc = sl.textColor || '';
  _touch(show);
  _renderShowTheme();
}

function _clearShowTheme() {
  const show = _activeShow();
  if (!show) return;
  show.theme = { bg: '', tc: '' };
  _touch(show);
  _renderShowTheme();
  _renderSlideList();
  _renderPreview();
}

function _applyThemeToAll() {
  const show = _activeShow();
  const sl   = _activeSlide();
  if (!show || !sl) return;
  if (!show.theme) show.theme = {};
  show.theme.bg = sl.bgColor || '';
  show.theme.tc = sl.textColor || '';
  // Clear per-slide overrides so all slides inherit the show theme
  show.slides.forEach(s => { s.bgColor = ''; s.textColor = ''; });
  _touch(show);
  _renderShowTheme();
  _renderSlideList();
  _renderPreview();
  _renderProps();
  _pushToPresent();
}

// ── Event wiring ──────────────────────────────────────────────────────────────
function _wire() {

  /* ── Tab bar ── */
  document.getElementById('fs-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (!tab || tab.disabled) return;
    if (tab.dataset.tab === 'library') { _setView('library'); _renderLibrary(); }
    if (tab.dataset.tab === 'editor' && _activeShow()) _setView('editor');
  });

  /* ── Library: new show ── */
  document.getElementById('fs-new-show-btn')?.addEventListener('click', _newShow);

  /* ── Library: search ── */
  document.getElementById('fs-search')?.addEventListener('input', e => {
    _st.search = e.target.value;
    _renderLibrary();
  });

  /* ── Library: card interactions ── */
  document.getElementById('fs-shows-grid')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (btn) {
      const id = btn.dataset.id;
      if (btn.dataset.act === 'edit') _openShow(id);
      if (btn.dataset.act === 'dup')  _dupShow(id);
      if (btn.dataset.act === 'del')  _delShow(id);
      return;
    }
    // Clicks inside the actions row (gaps between buttons) should NOT open the show.
    if (e.target.closest('.fs-show-actions')) return;
    const card = e.target.closest('[data-show-id]');
    if (card) _openShow(card.dataset.showId);
  });

  /* ── Editor: back to library ── */
  document.getElementById('fs-back-btn')?.addEventListener('click', () => {
    _setView('library');
    _renderLibrary();
  });

  /* ── Editor: show title rename ── */
  document.getElementById('fs-show-title')?.addEventListener('input', e => {
    const show = _activeShow();
    if (!show) return;
    show.name = e.target.value;
    _touch(show);
  });

  /* ── Slide list: select slide ── */
  document.getElementById('fs-slide-list')?.addEventListener('click', e => {
    const item = e.target.closest('[data-slide-idx]');
    if (item) _selectSlide(+item.dataset.slideIdx);
  });

  /* ── Add slide button ── */
  document.getElementById('fs-add-slide-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    const menu = document.getElementById('fs-add-type-menu');
    if (menu) menu.hidden = !menu.hidden;
  });

  /* ── Add type menu items ── */
  document.getElementById('fs-add-type-menu')?.addEventListener('click', e => {
    const item = e.target.closest('[data-type]');
    if (!item) return;
    document.getElementById('fs-add-type-menu').hidden = true;
    _addSlide(item.dataset.type);
  });

  /* Close add-type menu on outside click */
  document.addEventListener('click', e => {
    if (!e.target.closest('#fs-add-slide-wrap')) {
      const menu = document.getElementById('fs-add-type-menu');
      if (menu) menu.hidden = true;
    }
  });

  /* ── Duplicate / delete slide ── */
  document.getElementById('fs-dup-slide-btn')?.addEventListener('click', _dupSlide);
  document.getElementById('fs-del-slide-btn')?.addEventListener('click', _delSlide);

  /* ── Preview navigation ── */
  document.getElementById('fs-prev-btn')?.addEventListener('click', () => _selectSlide(_st.activeSlide - 1));
  document.getElementById('fs-next-btn')?.addEventListener('click', () => _selectSlide(_st.activeSlide + 1));

  /* ── Go Live: push current editor slide to projector ── */
  document.getElementById('fs-go-live-btn')?.addEventListener('click', () => {
    _st.presentSlide = _st.activeSlide;
    _pushToPresent();
  });

  /* ── Type buttons ── */
  document.querySelectorAll('.fs-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sl   = _activeSlide();
      const show = _activeShow();
      if (!sl || !show) return;
      sl.type = btn.dataset.type;
      _touch(show);
      _renderSlideList();
      _renderPreview();
      _renderProps();
      _pushToPresent();
    });
  });

  /* ── Text field ── */
  document.getElementById('fs-prop-text')?.addEventListener('input', e => {
    const sl = _activeSlide(); const show = _activeShow();
    if (!sl || !show) return;
    sl.text = e.target.value;
    _touch(show);
    _renderSlideList();
    _renderPreview();
    _pushToPresent();
  });

  /* ── Scripture reference ── */
  document.getElementById('fs-prop-ref')?.addEventListener('input', e => {
    const sl = _activeSlide(); const show = _activeShow();
    if (!sl || !show) return;
    sl.reference = e.target.value;
    _touch(show);
    _renderPreview();
    _pushToPresent();
  });

  /* ── Background color ── */
  document.getElementById('fs-prop-bg')?.addEventListener('input', e => {
    const sl = _activeSlide(); const show = _activeShow();
    if (!sl || !show) return;
    sl.bgColor = e.target.value;
    const label = document.getElementById('fs-prop-bg-label');
    if (label) label.textContent = e.target.value;
    _touch(show);
    _renderSlideList();
    _renderPreview();
    _pushToPresent();
  });
  document.getElementById('fs-prop-bg-reset')?.addEventListener('click', () => {
    const sl = _activeSlide(); const show = _activeShow();
    if (!sl || !show) return;
    sl.bgColor = '';
    const input = document.getElementById('fs-prop-bg');
    const label = document.getElementById('fs-prop-bg-label');
    if (input) input.value = SLIDE_TYPES[sl.type]?.bg || '#000000';
    if (label) label.textContent = 'Default';
    _touch(show);
    _renderSlideList();
    _renderPreview();
    _pushToPresent();
  });

  /* ── Text color ── */
  document.getElementById('fs-prop-tc')?.addEventListener('input', e => {
    const sl = _activeSlide(); const show = _activeShow();
    if (!sl || !show) return;
    sl.textColor = e.target.value;
    const label = document.getElementById('fs-prop-tc-label');
    if (label) label.textContent = e.target.value;
    _touch(show);
    _renderSlideList();
    _renderPreview();
    _pushToPresent();
  });
  document.getElementById('fs-prop-tc-reset')?.addEventListener('click', () => {
    const sl = _activeSlide(); const show = _activeShow();
    if (!sl || !show) return;
    sl.textColor = '';
    const input = document.getElementById('fs-prop-tc');
    const label = document.getElementById('fs-prop-tc-label');
    if (input) input.value = SLIDE_TYPES[sl.type]?.text || '#ffffff';
    if (label) label.textContent = 'Default';
    _touch(show);
    _renderSlideList();
    _renderPreview();
    _pushToPresent();
  });

  /* ── Stage notes ── */
  document.getElementById('fs-prop-notes')?.addEventListener('input', e => {
    const sl = _activeSlide(); const show = _activeShow();
    if (!sl || !show) return;
    sl.notes = e.target.value;
    _touch(show);
    _pushToPresent();
  });

  /* ── Font size slider ── */
  document.getElementById('fs-prop-font-size')?.addEventListener('input', e => {
    const sl = _activeSlide(); const show = _activeShow();
    if (!sl || !show) return;
    sl.fontSize = +e.target.value;
    const label = document.getElementById('fs-prop-font-size-val');
    if (label) label.textContent = sl.fontSize > 0 ? sl.fontSize + 'px' : 'Auto';
    _touch(show);
    _renderSlideList();
    _renderPreview();
    _pushToPresent();
  });
  document.getElementById('fs-prop-font-reset')?.addEventListener('click', () => {
    const sl = _activeSlide(); const show = _activeShow();
    if (!sl || !show) return;
    sl.fontSize = 0;
    const slider = document.getElementById('fs-prop-font-size');
    const label  = document.getElementById('fs-prop-font-size-val');
    if (slider) slider.value = 0;
    if (label)  label.textContent = 'Auto';
    _touch(show);
    _renderSlideList();
    _renderPreview();
    _pushToPresent();
  });

  /* ── Theme swatches ── */
  document.getElementById('fs-theme-swatches')?.addEventListener('click', e => {
    const swatch = e.target.closest('.fs-swatch');
    if (!swatch) return;
    const sl = _activeSlide(); const show = _activeShow();
    if (!sl || !show) return;
    sl.bgColor   = swatch.dataset.bg   || '';
    sl.textColor = swatch.dataset.tc   || '';
    _touch(show);
    _renderSlideList();
    _renderPreview();
    _renderProps();
    _pushToPresent();
  });

  /* ── Bible verse lookup ── */
  document.getElementById('fs-bible-fetch-btn')?.addEventListener('click', _fetchBibleVerse);
  document.getElementById('fs-bible-split-btn')?.addEventListener('click', _splitBibleVerses);
  document.getElementById('fs-bible-query')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); _fetchBibleVerse(); }
  });
  document.getElementById('fs-bible-translation')?.addEventListener('change', e => {
    _setBibleTranslation(e.target.value);
  });

  /* ── Export / Import ── */
  document.getElementById('fs-export-show-btn')?.addEventListener('click', _exportShow);
  document.getElementById('fs-import-show-btn')?.addEventListener('click', _importShow);
  document.getElementById('fs-import-pro-btn') ?.addEventListener('click', _importProPresenter);

  /* ── Import lyrics ── */
  document.getElementById('fs-import-btn')?.addEventListener('click', _importLyrics);

  /* ── From FlockStand song picker ── */
  document.getElementById('fs-from-stand-btn')?.addEventListener('click', _openSongPicker);
  document.getElementById('fs-sp-close')?.addEventListener('click', _closeSongPicker);
  document.getElementById('fs-sp-backdrop')?.addEventListener('click', _closeSongPicker);
  document.getElementById('fs-sp-search')?.addEventListener('input', _filterSongPicker);

  /* ── From Sermon picker ── */
  document.getElementById('fs-from-sermon-btn')?.addEventListener('click', _openSermonPicker);
  document.getElementById('fs-serm-close')?.addEventListener('click', _closeSermonPicker);
  document.getElementById('fs-serm-backdrop')?.addEventListener('click', _closeSermonPicker);
  document.getElementById('fs-serm-search')?.addEventListener('input', _filterSermonPicker);

  /* ── Present button ── */
  document.getElementById('fs-present-btn')?.addEventListener('click', _togglePresent);

  /* ── Show theme controls ── */
  document.getElementById('fs-set-show-theme-btn')?.addEventListener('click', _setShowTheme);
  document.getElementById('fs-apply-all-btn')?.addEventListener('click', _applyThemeToAll);
  document.getElementById('fs-clear-show-theme-btn')?.addEventListener('click', _clearShowTheme);

  /* ── Build gradient swatches ── */
  _initSwatches();

  /* ── Keyboard shortcuts in editor ── */
  document.addEventListener('keydown', e => {
    if (_st.view !== 'editor') return;
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); _selectSlide(_st.activeSlide + 1); }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); _selectSlide(_st.activeSlide - 1); }
    if (e.key === 'p' || e.key === 'P') _togglePresent();
    if (e.key === 'd' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); _dupSlide(); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Only delete slide if not in an input
      _delSlide();
    }
  });
}

// ── FlockStand song picker ───────────────────────────────────────────────────
let _spAllSongs = [];   // full list fetched from UpperRoom
let _spLoaded = false;

function _openSongPicker() {
  const picker = document.getElementById('fs-song-picker');
  if (!picker) return;
  picker.hidden = false;
  document.getElementById('fs-sp-search').value = '';
  _filterSongPicker();
  document.getElementById('fs-sp-search').focus();
  if (!_spLoaded) _loadSongPickerSongs();
}

function _closeSongPicker() {
  const picker = document.getElementById('fs-song-picker');
  if (picker) picker.hidden = true;
}

async function _loadSongPickerSongs() {
  const statusEl = document.getElementById('fs-sp-status');
  const listEl = document.getElementById('fs-sp-list');
  if (statusEl) statusEl.textContent = 'Loading songs…';
  if (listEl) listEl.innerHTML = '';
  try {
    const UR = window.UpperRoom;
    if (!UR || typeof UR.listSongs !== 'function') {
      if (statusEl) statusEl.textContent = 'FlockStand library unavailable.';
      return;
    }
    // listSongs returns paginated — fetch up to 500 rows
    const result = await UR.listSongs({ limit: 500 });
    _spAllSongs = Array.isArray(result) ? result : (result.rows || []);
    _spLoaded = true;
    _renderSongPickerList(_spAllSongs);
    if (statusEl) statusEl.textContent = `${_spAllSongs.length} song${_spAllSongs.length === 1 ? '' : 's'} in library`;
  } catch (err) {
    console.error('FlockShow: song picker load failed', err);
    if (statusEl) statusEl.textContent = 'Could not load songs. Are you signed in?';
  }
}

function _filterSongPicker() {
  const q = (document.getElementById('fs-sp-search')?.value || '').trim().toLowerCase();
  const filtered = q ? _spAllSongs.filter(s =>
    (s.title || '').toLowerCase().includes(q) ||
    (s.artist || '').toLowerCase().includes(q)
  ) : _spAllSongs;
  _renderSongPickerList(filtered);
  const statusEl = document.getElementById('fs-sp-status');
  if (statusEl && _spLoaded) {
    statusEl.textContent = q
      ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}`
      : `${_spAllSongs.length} song${_spAllSongs.length === 1 ? '' : 's'} in library`;
  }
}

function _renderSongPickerList(songs) {
  const listEl = document.getElementById('fs-sp-list');
  if (!listEl) return;
  if (!songs.length) {
    listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--fs-muted);font-size:0.83rem;">' +
      (_spLoaded ? 'No songs match.' : 'Loading…') + '</div>';
    return;
  }
  listEl.innerHTML = songs.map(s => {
    const meta = [s.artist, s.key ? `Key of ${s.key}` : ''].filter(Boolean).join(' · ');
    return `<div class="fs-sp-item" data-song-id="${s.id}" role="button" tabindex="0">
      <div class="fs-sp-item-title">${_spEscape(s.title || 'Untitled')}</div>
      ${meta ? `<div class="fs-sp-item-meta">${_spEscape(meta)}</div>` : ''}
    </div>`;
  }).join('');
  listEl.querySelectorAll('.fs-sp-item').forEach(el => {
    const id = el.dataset.songId;
    const song = songs.find(s => s.id === id);
    if (!song) return;
    el.addEventListener('click', () => _importSongFromStand(song));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') _importSongFromStand(song); });
  });
}

function _spEscape(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Strip ChordPro chords and section directives → return plain lyric text
function _stripChordPro(text) {
  if (!text) return '';
  return text
    .split('\n')
    .map(line => {
      // Remove section directives like {start_of_verse:Verse 1}, {chorus}, {eov}
      if (/^\{[^}]+\}$/.test(line.trim())) return '';
      // Strip chord brackets [G], [Am7], etc.
      return line.replace(/\[[^\]]+\]/g, '').trimEnd();
    })
    .join('\n');
}

// Split stripped text into stanzas (double-blank-line or single-blank-line separation)
function _splitStanzas(text) {
  // First try double-newline splits (common ChordPro structure)
  const stanzas = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return stanzas;
}

async function _importSongFromStand(song) {
  const statusEl = document.getElementById('fs-sp-status');
  if (statusEl) statusEl.textContent = `Loading "${song.title}"…`;

  try {
    const UR = window.UpperRoom;
    let chordProText = song.chordSheet || '';
    let songTitle = song.title || 'Untitled';

    if (UR && typeof UR.getSongWithArrangements === 'function') {
      try {
        const full = await UR.getSongWithArrangements(song.id);
        songTitle = full.title || songTitle;
        const arr = (full.arrangements || [])[0];
        chordProText = (arr && arr.lyricsWithChords) || full.chordSheet || chordProText;
      } catch (innerErr) {
        console.warn('[FlockShow] getSongWithArrangements failed, trying getSong:', innerErr);
        if (UR && typeof UR.getSong === 'function') {
          try {
            const partial = await UR.getSong(song.id);
            songTitle = partial.title || songTitle;
            chordProText = partial.chordSheet || chordProText;
          } catch (_) { /* use song data from picker list */ }
        }
      }
    }

    const stripped = _stripChordPro(chordProText);
    const stanzas  = _splitStanzas(stripped);
    const show     = _activeShow();
    if (!show) { _closeSongPicker(); return; }

    if (stanzas.length) {
      const newSlides = stanzas.map(t => _makeSlide('lyrics', t));
      show.slides.splice(_st.activeSlide + 1, 0, ...newSlides);
      _st.activeSlide += 1;
    } else {
      // No lyrics found — create one title slide rather than failing silently
      const titleSlide = _makeSlide('lyrics', songTitle);
      show.slides.splice(_st.activeSlide + 1, 0, titleSlide);
      _st.activeSlide += 1;
    }

    _touch(show);
    _renderSlideList();
    _renderPreview();
    _renderProps();
    _pushToPresent();
    _closeSongPicker();

    const count = stanzas.length || 1;
    if (statusEl) statusEl.textContent = `Imported "${songTitle}" (${count} slide${count === 1 ? '' : 's'})`;
  } catch (err) {
    console.error('FlockShow: song import failed', err);
    if (statusEl) statusEl.textContent = `Import failed: ${err.message || 'Please try again.'}`;
  }
}

// ── Sermon picker (FlockOS sermons → FlockShow auto-slide generation) ────────
let _sermAllSermons = [];
let _sermLoaded = false;

function _openSermonPicker() {
  const picker = document.getElementById('fs-sermon-picker');
  if (!picker) return;
  picker.hidden = false;
  document.getElementById('fs-serm-search').value = '';
  _filterSermonPicker();
  document.getElementById('fs-serm-search').focus();
  if (!_sermLoaded) _loadSermonPickerSermons();
}

function _closeSermonPicker() {
  const picker = document.getElementById('fs-sermon-picker');
  if (picker) picker.hidden = true;
}

async function _loadSermonPickerSermons() {
  const statusEl = document.getElementById('fs-serm-status');
  const listEl = document.getElementById('fs-serm-list');
  if (statusEl) statusEl.textContent = 'Loading sermons…';
  if (listEl) listEl.innerHTML = '';
  try {
    const UR = window.UpperRoom;
    if (!UR || typeof UR.listSermons !== 'function') {
      if (statusEl) statusEl.textContent = 'Sermon library unavailable.';
      return;
    }
    const result = await UR.listSermons({ limit: 500 });
    _sermAllSermons = Array.isArray(result) ? result : (result.results || result.rows || []);
    _sermLoaded = true;
    _renderSermonPickerList(_sermAllSermons);
    if (statusEl) statusEl.textContent = `${_sermAllSermons.length} sermon${_sermAllSermons.length === 1 ? '' : 's'} in library`;
  } catch (err) {
    console.error('FlockShow: sermon picker load failed', err);
    if (statusEl) statusEl.textContent = 'Could not load sermons. Are you signed in?';
  }
}

function _filterSermonPicker() {
  const q = (document.getElementById('fs-serm-search')?.value || '').trim().toLowerCase();
  const filtered = q ? _sermAllSermons.filter(s =>
    (s.title || '').toLowerCase().includes(q) ||
    (s.preacher || s.speaker || '').toLowerCase().includes(q) ||
    (s.scripture || s.passage || '').toLowerCase().includes(q) ||
    (s.seriesName || s.series || '').toLowerCase().includes(q)
  ) : _sermAllSermons;
  _renderSermonPickerList(filtered);
  const statusEl = document.getElementById('fs-serm-status');
  if (statusEl && _sermLoaded) {
    statusEl.textContent = q
      ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}`
      : `${_sermAllSermons.length} sermon${_sermAllSermons.length === 1 ? '' : 's'} in library`;
  }
}

function _renderSermonPickerList(sermons) {
  const listEl = document.getElementById('fs-serm-list');
  if (!listEl) return;
  if (!sermons.length) {
    listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--fs-muted);font-size:0.83rem;">' +
      (_sermLoaded ? 'No sermons match.' : 'Loading…') + '</div>';
    return;
  }
  listEl.innerHTML = sermons.map(s => {
    const preacher = s.preacher || s.speaker || '';
    const scripture = s.scripture || s.passage || '';
    const date = s.date ? new Date(s.date.seconds ? s.date.seconds * 1000 : s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const meta = [preacher, scripture, date].filter(Boolean).join(' · ');
    return `<div class="fs-sp-item" data-sermon-id="${s.id}" role="button" tabindex="0">
      <div class="fs-sp-item-title">${_spEscape(s.title || 'Untitled Sermon')}</div>
      ${meta ? `<div class="fs-sp-item-meta">${_spEscape(meta)}</div>` : ''}
    </div>`;
  }).join('');
  listEl.querySelectorAll('.fs-sp-item').forEach(el => {
    const id = el.dataset.sermonId;
    const sermon = sermons.find(s => s.id === id);
    if (!sermon) return;
    el.addEventListener('click', () => _importSermonAsSlides(sermon));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') _importSermonAsSlides(sermon); });
  });
}

// ── Sermon → slide builder ───────────────────────────────────────────────────
// Mirror of FEED's `_buildShowFromSermon` so the picker path produces the same
// quality deck as the FEED "Send to FlockShow" push.  Keep the two in sync.

const _SLIDE_CHAR_TARGET = 260;   // soft max chars per content slide
const _SLIDE_CHAR_HARD   = 360;   // hard max — never exceed on one slide

// FEED section type → FlockShow slide type
const _FEED_TO_SHOW_TYPE = {
  intro:        'lyrics',
  scripture:    'scripture',
  point:        'lyrics',
  illustration: 'lyrics',
  explanation:  'lyrics',
  application:  'lyrics',
  prayer:       'announce',
  conclusion:   'announce',
  transition:   'blank',
};

// Default section heading when the pastor didn't name the section
const _SECTION_DEFAULT_TITLE = {
  intro:        'Introduction',
  scripture:    'Scripture',
  point:        'Main Point',
  illustration: 'Illustration',
  explanation:  'Explanation',
  application:  'Application',
  prayer:       'Prayer',
  conclusion:   'Conclusion',
  transition:   'Transition',
};

// Split a long block of prose into slide-sized chunks (paragraph → sentence).
function _chunkProseToSlides(text, targetLen) {
  targetLen = targetLen || _SLIDE_CHAR_TARGET;
  const out = [];
  if (!text || !String(text).trim()) return out;

  const paragraphs = String(text)
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  paragraphs.forEach(para => {
    if (para.length <= targetLen) { out.push(para); return; }
    const sentences = para.match(/[^.!?]+[.!?]+[")'\]]*\s*|[^.!?]+$/g) || [para];
    let bucket = '';
    sentences.forEach(raw => {
      const s = raw.trim();
      if (!s) return;
      if (s.length > _SLIDE_CHAR_HARD) {
        if (bucket) { out.push(bucket.trim()); bucket = ''; }
        for (let i = 0; i < s.length; i += _SLIDE_CHAR_HARD) {
          out.push(s.slice(i, i + _SLIDE_CHAR_HARD).trim());
        }
        return;
      }
      if (bucket && (bucket.length + 1 + s.length) > targetLen) {
        out.push(bucket.trim());
        bucket = s;
      } else {
        bucket = bucket ? (bucket + ' ' + s) : s;
      }
    });
    if (bucket.trim()) out.push(bucket.trim());
  });

  return out;
}

// Split scripture text into one slide per verse, tagging each with the ref.
function _scriptureToSlides(verseText, ref) {
  const mk = (text) => {
    const sl = _makeSlide('scripture', text);
    sl.reference = ref || '';
    return sl;
  };
  if (!verseText || !String(verseText).trim()) {
    return ref ? [mk('')] : [];
  }
  let text = String(verseText).replace(/\r\n/g, '\n').trim();
  let verses;
  if (/\s\d+\s+\S/.test(text) || /^\d+\s+/.test(text)) {
    verses = text.split(/\s(?=\d+\s+[A-Z“"‘'])/).map(v => v.trim()).filter(Boolean);
  } else {
    verses = text.split(/\n+/).map(v => v.trim()).filter(Boolean);
  }
  if (verses.length <= 1) {
    return _chunkProseToSlides(text).map(mk);
  }
  return verses.map(mk);
}

// Build the full slide array for a sermon.  Returns an array of slide objects
// ready to splice into a show.
function _buildSlidesFromSermon(s) {
  const slides = [];

  // 1. Title slide
  const titleLines = [s.title || 'Untitled Sermon'];
  const speaker    = s.speaker || s.preacher || '';
  if (speaker) titleLines.push(speaker);
  slides.push(_makeSlide('announce', titleLines.join('\n')));

  // 2. Series + date
  const dateStr = s.date
    ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US',
        { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  if (s.series || dateStr) {
    slides.push(_makeSlide('announce', [s.series, dateStr].filter(Boolean).join('\n')));
  }

  // 3. Top-level passage
  const passage = s.passage || s.scripture || '';
  if (passage) {
    const sl = _makeSlide('scripture', '');
    sl.reference = passage;
    slides.push(sl);
  }

  // 4. Walk sections
  const sections = Array.isArray(s.sections) ? s.sections : [];
  sections.forEach((sec, idx) => {
    const showType = _FEED_TO_SHOW_TYPE[sec.type] || 'lyrics';
    const heading  = (sec.title || _SECTION_DEFAULT_TITLE[sec.type] || '').trim();
    const notes    = (sec.notes || '').trim();

    if (heading) {
      const tSlide = _makeSlide('announce', heading);
      tSlide.notes = `Section ${idx + 1} of ${sections.length}`;
      slides.push(tSlide);
    }

    if (sec.type === 'scripture') {
      const ref = (sec.scriptureRef || heading || '').trim();
      const verses = _scriptureToSlides(sec.scripture || notes, ref);
      verses.forEach(v => { v.notes = heading || ref || ''; slides.push(v); });
      return;
    }

    if (sec.type === 'transition') {
      if (notes) {
        const b = _makeSlide('blank', '');
        b.notes = `[Transition] ${notes}`;
        slides.push(b);
      }
      return;
    }

    if (!notes) return;

    const chunks = _chunkProseToSlides(notes);
    chunks.forEach((chunk, i) => {
      const sl = _makeSlide(showType, chunk);
      sl.notes = chunks.length > 1 ? `${heading} (${i + 1}/${chunks.length})` : heading;
      slides.push(sl);
    });
  });

  // 5. Altar call
  if (s.altarCall && s.altarCall.trim()) {
    const altarChunks = _chunkProseToSlides(s.altarCall.trim());
    altarChunks.forEach((chunk, i) => {
      const sl = _makeSlide('announce', chunk);
      sl.notes = altarChunks.length > 1
        ? `Altar Call (${i + 1}/${altarChunks.length})`
        : 'Altar Call';
      slides.push(sl);
    });
  }

  // 6. Legacy fallback: no structured sections AND has free-form `notes`
  if (!sections.length && s.notes && s.notes.trim()) {
    _chunkProseToSlides(s.notes.trim()).forEach(chunk => {
      slides.push(_makeSlide('lyrics', chunk));
    });
  }

  return slides;
}

async function _importSermonAsSlides(sermon) {
  const statusEl = document.getElementById('fs-serm-status');
  const title = sermon.title || 'Untitled Sermon';
  if (statusEl) statusEl.textContent = `Generating slides for "${title}"…`;

  try {
    const show = _activeShow();
    if (!show) { _closeSermonPicker(); return; }

    // Fetch the FULL sermon (sections live on the detail doc, not the list row)
    let fullSermon = sermon;
    const UR = window.UpperRoom;
    if (UR && typeof UR.getSermon === 'function') {
      try { fullSermon = await UR.getSermon(sermon.id); }
      catch (_) { /* fall back to row data */ }
    }

    const slides = _buildSlidesFromSermon(fullSermon);
    if (!slides.length) {
      slides.push(_makeSlide('lyrics', '(No sermon content yet — add slides manually)'));
    }

    // Insert slides after current active slide
    show.slides.splice(_st.activeSlide + 1, 0, ...slides);
    _st.activeSlide += 1;

    _touch(show);
    _renderSlideList();
    _renderPreview();
    _renderProps();
    _pushToPresent();
    _closeSermonPicker();

    if (statusEl) statusEl.textContent = `Generated ${slides.length} slide${slides.length === 1 ? '' : 's'} from "${title}"`;
  } catch (err) {
    console.error('FlockShow: sermon import failed', err);
    if (statusEl) statusEl.textContent = `Import failed: ${err.message || 'Please try again.'}`;
  }
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function _waitFor(predicate, timeout = 6000) {
  return new Promise((resolve, reject) => {
    if (predicate()) return resolve();
    const start = Date.now();
    const id = setInterval(() => {
      if (predicate())                    { clearInterval(id); resolve(); }
      else if (Date.now() - start > timeout) { clearInterval(id); reject(new Error('timeout')); }
    }, 80);
  });
}

function _showAuthGate(N) {
  const overlay = document.getElementById('fs-auth-overlay');
  if (!overlay) return;
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--fs-bg);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div class="fs-auth-card">
      <img class="fs-auth-icon" src="Images/icon-show.svg" alt="FlockShow">
      <h1>FlockShow</h1>
      <p>Sign in with your FlockOS account to access worship presentations.</p>
      <button class="fs-btn fs-btn--primary" id="fs-signin-btn" style="width:100%;justify-content:center;padding:10px 0;font-size:0.88rem;">
        Sign In to FlockOS
      </button>
      <p style="font-size:.75rem;color:var(--ink-faint)">Access is limited to authenticated FlockOS users.</p>
      <p class="fs-auth-verse">"Praise Him with strings and pipe." — Psalm 150:4</p>
    </div>`;
  document.getElementById('fs-signin-btn')?.addEventListener('click', () => {
    const base = location.href.replace(/\/app\.flockshow\/app\.flockshow\.html.*$/, '/');
    location.href = base + 'app.flockshow/';
  });
}

function _dismissAuthOverlay() {
  const overlay = document.getElementById('fs-auth-overlay');
  if (overlay) overlay.remove();
}

function _renderUserChip(N) {
  // Mount the unified FlockOS header (replaces legacy fs-topbar markup).
  const host = document.getElementById('fs-topbar');
  if (!host) return;

  const sess = (N && typeof N.getSession === 'function' ? N.getSession() : null) || {};
  const user = sess.email
    ? {
        displayName: sess.displayName || sess.name || sess.email.split('@')[0],
        email:       sess.email,
        photoURL:    sess.photoURL || '',
      }
    : null;

  const FS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16 10,8" fill="currentColor" stroke="none"/></svg>';

  mountUnityHeader(host, {
    appId:       'flockshow',
    appName:     'FlockShow',
    appIconSvg:  FS_ICON,
    appAccent:   '#ef4444',
    appAccentDk: '#7f1d1d',
    homeHref:    'app.flockshow/',
    user,
    onSignOut: () => {
      _openConfirmModal('Sign Out', `Sign out of FlockShow?`, 'Sign Out', () => {
        if (N && typeof N.logout === 'function') N.logout();
        else location.reload();
      });
    },
    onHamburger: () => {
      // FlockShow has no sidebar — hamburger hidden via CSS
    },
    features: [
      { id: 'fs-tab-library', label: 'Library',    hint: 'View shows',          run: () => { _setView('library'); _renderLibrary(); _renderHeader(); } },
      { id: 'fs-tab-editor',  label: 'Editor',     hint: 'Edit current show',   run: () => { if (_activeShow()) { _setView('editor'); _renderHeader(); } } },
      { id: 'fs-new-show',    label: 'New show',   hint: 'Create',              run: () => _newShow?.() },
      { id: 'fs-present',     label: 'Present',    hint: 'Open projector',      run: () => document.getElementById('fs-present-btn')?.click() },
    ],
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function _boot() {
  const _t0 = Date.now();
  console.log('[FlockShow] _boot: start, readyState=' + document.readyState);
  try {
    await _waitFor(() => typeof window.Nehemiah !== 'undefined');
    console.log('[FlockShow] _boot: Nehemiah present after ' + (Date.now() - _t0) + 'ms');
  } catch (_) {
    console.warn('[FlockShow] _boot: Nehemiah NEVER appeared — running ungated (local dev path)');
    _renderUserChip(null);
    await _load(); _wire(); _renderAll();
    return;
  }

  const N = window.Nehemiah;
  const sess = (typeof N.getSession === 'function') ? N.getSession() : null;
  console.log('[FlockShow] _boot: session =', sess ? { email: sess.email, hasToken: !!sess.token } : null);

  if (typeof N.isAuthenticated === 'function' && !N.isAuthenticated()) {
    console.warn('[FlockShow] _boot: NOT authenticated — redirecting to sign-in');
    const base = location.href.replace(/\/app\.flockshow\/app\.flockshow\.html.*$/, '/');
    location.replace(base + 'app.flockshow/');
    return;
  }
  console.log('[FlockShow] _boot: authenticated ✓');

  // Authenticated — dismiss overlay and launch
  _dismissAuthOverlay();
  _renderUserChip(N);
  // Explicitly init + authenticate UpperRoom (Firestore). firm_foundation.js
  // calls init() but does NOT authenticate, so _ready stays false unless we
  // drive it here. Mirrors the pattern in feed.js.
  const _tUR = Date.now();
  if (window.UpperRoom) {
    try {
      if (typeof window.UpperRoom.isReady === 'function' && !window.UpperRoom.isReady()) {
        console.log('[FlockShow] _boot: UpperRoom not ready — calling init() + authenticate()');
        await window.UpperRoom.init();
        await window.UpperRoom.authenticate();
      }
      if (typeof window.UpperRoom.waitReady === 'function') {
        await window.UpperRoom.waitReady();
      } else {
        await _waitFor(() => window.UpperRoom.isReady && window.UpperRoom.isReady(), 8000);
      }
      console.log('[FlockShow] _boot: UpperRoom ready after ' + (Date.now() - _tUR) + 'ms, isReady=' + window.UpperRoom.isReady());
    } catch (e) {
      console.error('[FlockShow] _boot: UpperRoom init/authenticate FAILED — proceeding without Firestore:', e);
    }
  } else {
    console.warn('[FlockShow] _boot: window.UpperRoom is undefined — Firestore unavailable');
  }
  await _load();
  _wire();
  _renderAll();
  console.log('[FlockShow] _boot: complete after ' + (Date.now() - _t0) + 'ms, shows.length=' + _st.shows.length);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _boot);
} else {
  _boot();
}
