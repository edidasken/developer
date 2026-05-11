// ==========================================
// THE SHOFAR — Song Manager & Live Chord View
// Psalm 150:3 — "Praise Him with the sound of the trumpet"
// ==========================================
// Renders inside the modal-body-container.
// Provides: Song CRUD, Arrangement CRUD, setlist assignment,
// live Music Stand chord-chart view, and PDF lead-sheet export.
//
// Backend: Songs.gs on FLOCK (via TheVine)
// Actions:
//   songs.list / songs.get / songs.create / songs.update / songs.delete
//   arrangements.list / arrangements.get / arrangements.create / arrangements.update / arrangements.delete
//   setlistSongs.list / setlistSongs.add / setlistSongs.update / setlistSongs.remove
//   musicStand.get
// ==========================================

const musicStandAppState = {
    songs: [],
    arrangements: [],       // arrangements for the currently viewed song
    setlist: [],            // enriched setlist from musicStand.get
    plan: null,
    loaded: false,
    loading: false,
    filter: '',
    currentSong: null,
    currentArrangement: null,
    editorMode: 'create',   // 'create' | 'edit'
    activeTab: 'songs',     // 'songs' | 'stand'
    standIndex: 0,          // current song index in Music Stand view
    standSemitones: {}      // keyed by setlist item index → semitone offset
};

let _msActiveEditRow = null;
let _msArrEditRow = null;
let _msSongsLoadedAt = 0;
var _msSongDetailCache = {};          // keyed by songId → full song+arrangements
const _MS_SONG_TTL = 120000;         // 2-min warm window for song list

// ── Fetch helper ─────────────────────────────────────────────

function msFetchNoReferrer(url) {
    return fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
    });
}

// ── Escape & format ──────────────────────────────────────────

function msEscapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function msFormatDate(raw) {
    if (!raw) return '—';
    var s = String(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00';
    var d = new Date(s);
    if (isNaN(d.getTime())) return String(raw);
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    var yyyy = d.getFullYear();
    return mm + '/' + dd + '/' + yyyy;
}

// ── Auth ─────────────────────────────────────────────────────

function getMusicStandAuth() {
    // Use TheVine session (sessionStorage-based)
    if (typeof TheVine !== 'undefined' && typeof TheVine.session === 'function') {
        var s = TheVine.session();
        if (s && s.token && s.email) return { token: s.token, email: s.email };
    }
    return null;
}

function msIsAuthError(message) {
    var text = String(message || '').toLowerCase();
    return (
        text.includes('missing token') ||
        text.includes('missing email') ||
        text.includes('unauthorized') ||
        text.includes('access denied') ||
        text.includes('session expired')
    );
}

function msRedirectToSecure(reason) {
    var msg = String(reason || 'Session expired. Please sign in again.');
    console.warn('MusicStand auth redirect:', msg);
    if (typeof Nehemiah !== 'undefined' && typeof Nehemiah.logout === 'function') {
        Nehemiah.logout();
    } else {
        window.location.href = 'the_wall.html';
    }
}

// ── Endpoint ─────────────────────────────────────────────────

function msGetEndpoint() {
    if (typeof TheVine !== 'undefined' && typeof TheVine.endpoints === 'function') {
        var ep = TheVine.endpoints();
        if (ep.FLOCK_URL) return String(ep.FLOCK_URL).trim();
    }
    return String(window.PASTORAL_DB_V2_ENDPOINT || '').trim();
}

// ── API helpers ──────────────────────────────────────────────

async function msApiCall(action, extraParams) {
    var endpoint = msGetEndpoint();
    var auth = getMusicStandAuth();
    if (!endpoint || !auth) {
        console.warn('[MusicStand] msApiCall: no auth/endpoint — skipping redirect (auth bypass active).');
        return null;
    }

    var params = new URLSearchParams({
        action: action,
        token: auth.token,
        email: auth.email,
        _: String(Date.now())
    });

    if (extraParams && typeof extraParams === 'object') {
        var keys = Object.keys(extraParams);
        for (var i = 0; i < keys.length; i++) {
            var val = extraParams[keys[i]];
            if (val != null) params.set(keys[i], String(val));
        }
    }

    var resp = await msFetchNoReferrer(endpoint + '?' + params.toString());

    if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
            msRedirectToSecure('Access denied.');
            return null;
        }
        throw new Error('HTTP ' + resp.status);
    }

    var data = await resp.json();
    if (!data || !data.ok) {
        var msg = (data && data.message) || 'Request failed.';
        if (msIsAuthError(msg)) {
            msRedirectToSecure(msg);
            return null;
        }
        throw new Error(msg);
    }

    return data;
}

// ── CSS ──────────────────────────────────────────────────────

function msEnsureStyles() {
    if (document.getElementById('ms-styles')) return;
    var style = document.createElement('style');
    style.id = 'ms-styles';
    style.textContent = [
        '.ms-app { padding:10px 10px var(--scroll-tail-pad) 10px; color:#e5e7eb; font-family:Inter,sans-serif; }',
        '.ms-card { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:18px; margin-bottom:14px; }',
        '.ms-title { margin:0 0 10px 0; font-family:Merriweather,serif; font-size:1.6rem; color:#fff; text-align:center; }',
        '.ms-subtitle { margin:0 0 6px 0; color:#cbd5e1; font-size:1rem; text-align:center; }',

        /* Tabs */
        '.ms-tabs { display:flex; gap:0; border-bottom:1px solid rgba(255,255,255,0.12); margin-bottom:16px; }',
        '.ms-tab-btn { flex:1; padding:14px 8px; background:transparent; color:#94a3b8; border:none; border-bottom:2px solid transparent; font-weight:700; font-size:1rem; cursor:pointer; transition:all 0.2s; font-family:Inter,sans-serif; }',
        '.ms-tab-btn.ms-active { color:#22d3ee; border-bottom-color:#22d3ee; background:rgba(255,255,255,0.05); }',

        /* Table */
        '.ms-table { width:100%; border-collapse:collapse; font-size:0.92rem; }',
        '.ms-table th { padding:10px 8px; text-align:left; color:#94a3b8; font-weight:600; font-size:0.8rem; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.12); }',
        '.ms-table td { padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.06); color:#e5e7eb; }',
        '.ms-table tr:hover td { background:rgba(255,255,255,0.04); }',

        /* Buttons */
        '.ms-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 18px; border-radius:10px; border:none; font-weight:700; font-size:0.95rem; cursor:pointer; transition:all 0.15s; font-family:Inter,sans-serif; }',
        '.ms-btn-primary { background:linear-gradient(135deg,#06b6d4,#3b82f6); color:#fff; }',
        '.ms-btn-primary:hover { filter:brightness(1.15); }',
        '.ms-btn-secondary { background:rgba(255,255,255,0.08); color:#e5e7eb; border:1px solid rgba(255,255,255,0.15); }',
        '.ms-btn-secondary:hover { background:rgba(255,255,255,0.14); }',
        '.ms-btn-danger { background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3); }',
        '.ms-btn-danger:hover { background:rgba(239,68,68,0.25); }',
        '.ms-btn-sm { padding:6px 12px; font-size:0.85rem; border-radius:8px; }',

        /* Form */
        '.ms-form-group { margin-bottom:14px; }',
        '.ms-label { display:block; margin-bottom:4px; color:#94a3b8; font-size:0.85rem; font-weight:600; text-transform:uppercase; }',
        '.ms-input { width:100%; padding:10px 12px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); border-radius:10px; color:#e5e7eb; font-size:0.95rem; font-family:Inter,sans-serif; box-sizing:border-box; }',
        '.ms-input:focus { outline:none; border-color:#22d3ee; box-shadow:0 0 0 2px rgba(34,211,238,0.15); }',
        '.ms-textarea { resize:vertical; min-height:100px; }',
        '.ms-select { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'%2394a3b8\' stroke-width=\'2\' fill=\'none\'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; padding-right:36px; }',

        /* Search */
        '.ms-search-bar { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }',
        '.ms-search-input { flex:1; min-width:200px; }',

        /* Overlay / Modal */
        '.ms-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:9999; display:none; align-items:center; justify-content:center; padding:16px; }',
        '.ms-overlay.ms-visible { display:flex; }',
        '.ms-modal { background:#1e293b; border:1px solid rgba(255,255,255,0.12); border-radius:18px; padding:24px; width:100%; max-width:640px; max-height:85vh; overflow-y:auto; }',
        '.ms-modal--fullscreen { max-width:100%; max-height:100%; width:100%; height:100%; border-radius:0; border:none; display:flex; flex-direction:column; padding:20px 24px 16px 24px; }',
        '.ms-modal--fullscreen .ms-chord-display { flex:1; overflow-y:auto; margin-bottom:0; }',
        '.ms-modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }',
        '.ms-modal-title { margin:0; font-family:Merriweather,serif; font-size:1.3rem; color:#fff; }',
        '.ms-close-btn { background:none; border:none; color:#94a3b8; font-size:1.5rem; cursor:pointer; padding:4px 8px; }',
        '.ms-close-btn:hover { color:#fff; }',

        /* Music Stand full-screen view */
        '.ms-stand-view { min-height:60vh; }',
        '.ms-stand-header { display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.12); margin-bottom:16px; }',
        '.ms-stand-song-title { font-family:Merriweather,serif; font-size:1.8rem; color:#fff; margin:0; }',
        '.ms-stand-meta { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:16px; }',
        '.ms-stand-badge { background:rgba(34,211,238,0.15); color:#22d3ee; padding:4px 12px; border-radius:20px; font-size:0.85rem; font-weight:700; }',

        /* ── ChordPro rendered output ── */
        '.ms-chord-display { background:rgba(0,0,0,0.25); border-radius:12px; padding:20px 24px; margin-bottom:16px; }',
        '.ms-cp-song { font-family:"Plus Jakarta Sans",system-ui,sans-serif; font-size:1rem; line-height:1.4; color:#e2e8f0; }',
        '.ms-cp-title { font-size:1.4rem; font-weight:800; color:#fff; margin:0 0 4px 0; }',
        '.ms-cp-subtitle { font-size:0.95rem; color:#94a3b8; margin:0 0 20px 0; }',
        '.ms-cp-section-label { font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:.1em; padding:2px 0 2px 10px; border-left:3px solid; margin:20px 0 10px 0; }',
        '.ms-cp-section { margin-bottom:4px; }',
        '.ms-cp-spacer { height:18px; }',
        /* Each line = flex row of chord+lyric pairs */
        '.ms-cp-row { display:flex; flex-wrap:wrap; align-items:flex-end; gap:0; margin-bottom:2px; }',
        '.ms-cp-pair { display:inline-flex; flex-direction:column; align-items:flex-start; margin-right:2px; }',
        '.ms-cp-chord { font-family:"JetBrains Mono","Courier New",monospace; font-size:0.82rem; font-weight:700; color:#38bdf8; line-height:1.2; min-height:1.2em; white-space:pre; padding-right:4px; }',
        '.ms-cp-chord--empty { color:transparent; }',
        '.ms-cp-word { font-size:1.05rem; color:#e2e8f0; white-space:pre; line-height:1.5; }',
        '.ms-cp-word--space { color:transparent; }',
        '.ms-cp-lyric-only { font-size:1.05rem; color:#e2e8f0; line-height:1.8; padding-left:2px; }',

        '.ms-chord-line { color:#22d3ee; font-weight:700; }',
        '.ms-lyric-line { color:#e5e7eb; }',
        '.ms-stand-nav { display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-top:1px solid rgba(255,255,255,0.12); }',
        '.ms-stand-counter { color:#94a3b8; font-size:0.9rem; }',

        /* Arrangement card */
        '.ms-arr-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px; }',
        '.ms-arr-info { flex:1; min-width:200px; }',
        '.ms-arr-key { font-weight:700; color:#22d3ee; }',

        /* Responsive */
        '@media (max-width:640px) {',
        '  .ms-table th:nth-child(n+4), .ms-table td:nth-child(n+4) { display:none; }',
        '  .ms-stand-song-title { font-size:1.3rem; }',
        '  .ms-chord-display { font-size:0.95rem; padding:14px; }',
        '}'
    ].join('\n');
    document.head.appendChild(style);
}

// ══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ══════════════════════════════════════════════════════════════════════════════

// ── Firestore dual-path helper ───────────────────────────────
function _msFB() {
    return typeof UpperRoom !== 'undefined' && typeof UpperRoom.isReady === 'function' && UpperRoom.isReady();
}

// ── Semitone interval between two key names (shortest path) ─────────────────
// Returns an integer -6..+6
function msKeyInterval(fromKey, toKey) {
    if (!fromKey || !toKey || fromKey === toKey) return 0;
    var fromIdx = _MS_SHARPS.indexOf(fromKey);
    if (fromIdx === -1) fromIdx = _MS_FLATS.indexOf(fromKey);
    var toIdx = _MS_SHARPS.indexOf(toKey);
    if (toIdx === -1) toIdx = _MS_FLATS.indexOf(toKey);
    if (fromIdx === -1 || toIdx === -1) return 0;
    var diff = toIdx - fromIdx;
    if (diff > 6)  diff -= 12;
    if (diff < -6) diff += 12;
    return diff;
}

// ── Resolve the best chord content for a song+arrangement ────────────────────
// Priority: 1) arr.lyricsWithChords (already in arr.key)
//           2) song.chordSheet      (auto-transposed from song.chordSheetKey → arr.key)
// extraSemitones: any additional real-time semitone shift requested by the user.
function msResolveChordContent(song, arr, extraSemitones) {
    var extra = extraSemitones || 0;
    song  = song  || {};
    arr   = arr   || {};

    // Arrangement has its own chord chart stored in arr.key
    if (arr.lyricsWithChords) {
        return msTransposeChordPro(arr.lyricsWithChords, extra);
    }

    // Fall back to song-level master chord sheet
    if (song.chordSheet) {
        var sourceKey = song.chordSheetKey || song.defaultKey || 'C';
        var targetKey = arr.key || song.defaultKey || 'C';
        var autoSemitones = msKeyInterval(sourceKey, targetKey);
        return msTransposeChordPro(song.chordSheet, autoSemitones + extra);
    }

    return null;
}

function openMusicStandApp() {
    msEnsureStyles();

    // If songs already warm, just re-render without refetching
    if (musicStandAppState.loaded && (Date.now() - _msSongsLoadedAt) < _MS_SONG_TTL) {
        msRenderShell();
        msRenderSongsTab();
        return;
    }

    musicStandAppState.loaded = false;
    musicStandAppState.loading = false;
    musicStandAppState.songs = [];
    musicStandAppState.arrangements = [];
    musicStandAppState.setlist = [];
    musicStandAppState.plan = null;
    musicStandAppState.currentSong = null;
    musicStandAppState.currentArrangement = null;
    musicStandAppState.editorMode = 'create';
    musicStandAppState.activeTab = 'songs';
    musicStandAppState.filter = '';
    musicStandAppState.standIndex = 0;
    _msActiveEditRow = null;
    _msArrEditRow = null;
    msRenderShell();
    msLoadSongs();
};

// ══════════════════════════════════════════════════════════════════════════════
// RENDER SHELL
// ══════════════════════════════════════════════════════════════════════════════

function msRenderShell() {
    var container = document.getElementById('ms-app-container')
                 || document.getElementById('view-songs')
                 || document.getElementById('modal-body-container');
    if (!container) { console.error('MusicStand: no container found'); return; }
    container.innerHTML =
        '<div class="ms-app">' +
            '<div class="ms-card" style="text-align:center;">' +
                '<h2 class="ms-title">Music Stand</h2>' +
                '<p class="ms-subtitle">Manage your song library, chord charts, and setlists</p>' +
            '</div>' +

            '<div class="ms-tabs">' +
                '<button class="ms-tab-btn ms-active" data-ms-tab="songs">Song Library</button>' +
                '<button class="ms-tab-btn" data-ms-tab="stand">Music Stand</button>' +
            '</div>' +

            '<div id="ms-tab-songs"></div>' +
            '<div id="ms-tab-stand" style="display:none;"></div>' +

            /* Song editor overlay */
            '<div id="ms-song-overlay" class="ms-overlay" aria-hidden="true">' +
                '<div class="ms-modal" id="ms-song-modal"></div>' +
            '</div>' +

            /* Arrangement editor overlay */
            '<div id="ms-arr-overlay" class="ms-overlay" aria-hidden="true">' +
                '<div class="ms-modal" id="ms-arr-modal"></div>' +
            '</div>' +
        '</div>';

    // Tab switching
    container.querySelectorAll('.ms-tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var target = btn.getAttribute('data-ms-tab');
            msActivateTab(target);
        });
    });
}

function msActivateTab(tabName) {
    musicStandAppState.activeTab = tabName;
    var container = document.querySelector('.ms-app');
    if (!container) return;

    container.querySelectorAll('.ms-tab-btn').forEach(function(btn) {
        var t = btn.getAttribute('data-ms-tab');
        if (t === tabName) {
            btn.classList.add('ms-active');
        } else {
            btn.classList.remove('ms-active');
        }
    });

    var songsPanel = document.getElementById('ms-tab-songs');
    var standPanel = document.getElementById('ms-tab-stand');

    if (tabName === 'songs') {
        songsPanel.style.display = '';
        standPanel.style.display = 'none';
    } else {
        songsPanel.style.display = 'none';
        standPanel.style.display = '';
        msRenderStandTab();
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// SONGS TAB — Library + CRUD
// ══════════════════════════════════════════════════════════════════════════════

async function msLoadSongs() {
    musicStandAppState.loading = true;
    msRenderSongsTab();

    try {
        var rows;
        if (_msFB()) {
            rows = await UpperRoom.listSongs();
        } else {
            var data = await msApiCall('songs.list', { activeOnly: 'false' });
            rows = data ? (data.rows || []) : [];
        }
        musicStandAppState.songs = rows;
        musicStandAppState.loaded = true;
        _msSongsLoadedAt = Date.now();
    } catch (err) {
        console.error('MusicStand: failed to load songs', err);
        musicStandAppState.songs = [];
    } finally {
        musicStandAppState.loading = false;
        msRenderSongsTab();
    }
}

function msRenderSongsTab() {
    var panel = document.getElementById('ms-tab-songs');
    if (!panel) return;

    if (musicStandAppState.loading && !musicStandAppState.loaded) {
        panel.innerHTML =
            '<div class="ms-card" style="text-align:center; padding:40px;">' +
                '<p style="color:#94a3b8;">Loading song library...</p>' +
            '</div>';
        return;
    }

    var filterVal = musicStandAppState.filter.toLowerCase();
    var filtered = musicStandAppState.songs.filter(function(s) {
        if (!filterVal) return true;
        return (s.title || '').toLowerCase().indexOf(filterVal) !== -1 ||
               (s.artist || '').toLowerCase().indexOf(filterVal) !== -1;
    });

    var html =
        '<div class="ms-search-bar">' +
            '<input type="text" class="ms-input ms-search-input" id="ms-song-search" placeholder="Search songs by title or artist..." value="' + msEscapeHtml(musicStandAppState.filter) + '">' +
            '<button class="ms-btn ms-btn-secondary" id="ms-import-song-btn" style="white-space:nowrap;">&#x29C9; SongSelect</button>' +
            '<button class="ms-btn ms-btn-primary" id="ms-add-song-btn">+ Add Song</button>' +
        '</div>';

    if (filtered.length === 0) {
        html += '<div class="ms-card" style="text-align:center; padding:30px;">' +
                    '<p style="color:#94a3b8;">' +
                        (musicStandAppState.songs.length === 0 ? 'No songs yet. Add your first song!' : 'No songs match your search.') +
                    '</p>' +
                '</div>';
    } else {
        html += '<div style="overflow-x:auto;">' +
                '<table class="ms-table">' +
                    '<thead><tr>' +
                        '<th>Title</th>' +
                        '<th>Artist</th>' +
                        '<th>Key</th>' +
                        '<th>BPM</th>' +
                        '<th>Active</th>' +
                        '<th></th>' +
                    '</tr></thead>' +
                    '<tbody>';

        for (var i = 0; i < filtered.length; i++) {
            var s = filtered[i];
            html += '<tr>' +
                '<td><a href="#" class="ms-song-link" data-song-idx="' + i + '" style="color:#22d3ee; text-decoration:none; font-weight:600;">' + msEscapeHtml(s.title) + '</a></td>' +
                '<td>' + msEscapeHtml(s.artist) + '</td>' +
                '<td><span class="ms-stand-badge">' + msEscapeHtml(s.defaultKey || '—') + '</span></td>' +
                '<td>' + (s.tempoBpm || '—') + '</td>' +
                '<td>' + (s.active === 'TRUE' ? '<span style="color:#22c55e;">Yes</span>' : '<span style="color:#94a3b8;">No</span>') + '</td>' +
                '<td>' +
                    '<button class="ms-btn ms-btn-primary ms-btn-sm ms-play-song" data-song-idx="' + i + '" title="Open chord chart">♪ Play</button> ' +
                    '<button class="ms-btn ms-btn-secondary ms-btn-sm ms-edit-song" data-row-index="' + s.index + '" data-song-idx="' + i + '">Edit</button> ' +
                    '<button class="ms-btn ms-btn-danger ms-btn-sm ms-delete-song" data-row-index="' + s.index + '" data-song-id="' + msEscapeHtml(s.id || '') + '" data-title="' + msEscapeHtml(s.title) + '">Delete</button>' +
                '</td>' +
            '</tr>';
        }

        html += '</tbody></table></div>';
    }

    html += '<p style="color:#64748b; font-size:0.8rem; margin-top:12px;">' +
                filtered.length + ' of ' + musicStandAppState.songs.length + ' songs' +
            '</p>';

    panel.innerHTML = html;

    // Bind events
    var searchInput = document.getElementById('ms-song-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            musicStandAppState.filter = searchInput.value;
            msRenderSongsTab();
        });
        searchInput.focus();
    }

    var addBtn = document.getElementById('ms-add-song-btn');
    if (addBtn) {
        addBtn.addEventListener('click', function() {
            musicStandAppState.editorMode = 'create';
            _msActiveEditRow = null;
            msOpenSongEditor(null);
        });
    }

    var importBtn = document.getElementById('ms-import-song-btn');
    if (importBtn) {
        importBtn.addEventListener('click', function() { msOpenSongSelectImport(); });
    }

    // Play buttons → open chord chart directly
    panel.querySelectorAll('.ms-play-song').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var idx = Number(btn.getAttribute('data-song-idx'));
            var filteredP = musicStandAppState.songs.filter(function(s2) {
                var f = musicStandAppState.filter.toLowerCase();
                if (!f) return true;
                return (s2.title || '').toLowerCase().indexOf(f) !== -1 ||
                       (s2.artist || '').toLowerCase().indexOf(f) !== -1;
            });
            if (filteredP[idx]) msQuickPlaySong(filteredP[idx]);
        });
    });

    // Song title links → detail view
    panel.querySelectorAll('.ms-song-link').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            var idx = Number(link.getAttribute('data-song-idx'));
            var filtered2 = musicStandAppState.songs.filter(function(s2) {
                var f = musicStandAppState.filter.toLowerCase();
                if (!f) return true;
                return (s2.title || '').toLowerCase().indexOf(f) !== -1 ||
                       (s2.artist || '').toLowerCase().indexOf(f) !== -1;
            });
            if (filtered2[idx]) msOpenSongDetail(filtered2[idx]);
        });
    });

    // Edit buttons
    panel.querySelectorAll('.ms-edit-song').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var idx = Number(btn.getAttribute('data-song-idx'));
            var filtered2 = musicStandAppState.songs.filter(function(s2) {
                var f = musicStandAppState.filter.toLowerCase();
                if (!f) return true;
                return (s2.title || '').toLowerCase().indexOf(f) !== -1 ||
                       (s2.artist || '').toLowerCase().indexOf(f) !== -1;
            });
            var song = filtered2[idx];
            if (song) {
                musicStandAppState.editorMode = 'edit';
                _msActiveEditRow = song;
                msOpenSongEditor(song);
            }
        });
    });

    // Delete buttons
    panel.querySelectorAll('.ms-delete-song').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var rowIndex = btn.getAttribute('data-row-index');
            var songId   = btn.getAttribute('data-song-id');
            var title    = btn.getAttribute('data-title');
            msDeleteSong(Number(rowIndex), title, songId);
        });
    });
}

// ── Song Detail (with arrangements) ─────────────────────────

async function msOpenSongDetail(song) {
    musicStandAppState.currentSong = song;
    musicStandAppState.arrangements = [];

    // Serve cached detail if available
    var cached = _msSongDetailCache[song.id];
    if (cached && (Date.now() - cached._ts) < _MS_SONG_TTL) {
        musicStandAppState.currentSong = cached;
        musicStandAppState.arrangements = cached.arrangements || [];
        msRenderSongDetail();
        return;
    }

    // Fetch full song with arrangements
    try {
        if (_msFB() && song.id) {
            var full = await UpperRoom.getSongWithArrangements(song.id);
            full._ts = Date.now();
            musicStandAppState.currentSong = full;
            musicStandAppState.arrangements = full.arrangements || [];
            _msSongDetailCache[song.id] = full;
        } else {
            var data = await msApiCall('songs.get', { songId: song.id });
            if (!data) return;
            musicStandAppState.currentSong = data.row;
            musicStandAppState.arrangements = data.row.arrangements || [];
            data.row._ts = Date.now();
            _msSongDetailCache[song.id] = data.row;
        }
    } catch (err) {
        console.error('MusicStand: failed to load song detail', err);
    }

    msRenderSongDetail();
}

function msRenderSongDetail() {
    var panel = document.getElementById('ms-tab-songs');
    if (!panel) return;
    var song = musicStandAppState.currentSong;
    if (!song) return;

    var html =
        '<div style="margin-bottom:14px;">' +
            '<button class="ms-btn ms-btn-secondary ms-btn-sm" id="ms-back-to-list">&larr; Back to Library</button>' +
        '</div>' +

        '<div class="ms-card">' +
            '<h3 style="margin:0 0 6px 0; font-family:Merriweather,serif; font-size:1.4rem; color:#fff;">' + msEscapeHtml(song.title) + '</h3>' +
            '<p style="margin:0 0 14px 0; color:#94a3b8;">' + msEscapeHtml(song.artist || 'Unknown Artist') + '</p>' +
            '<div class="ms-stand-meta">' +
                '<span class="ms-stand-badge">Key: ' + msEscapeHtml(song.defaultKey || '—') + '</span>' +
                (song.tempoBpm ? '<span class="ms-stand-badge">' + song.tempoBpm + ' BPM</span>' : '') +
                (song.timeSignature ? '<span class="ms-stand-badge">' + msEscapeHtml(song.timeSignature) + '</span>' : '') +
                (song.ccliNumber ? '<span class="ms-stand-badge">CCLI# ' + msEscapeHtml(song.ccliNumber) + '</span>' : '') +
                (song.genre ? '<span class="ms-stand-badge">' + msEscapeHtml(song.genre) + '</span>' : '') +
            '</div>' +

            (song.lyrics ?
                '<div style="margin-top:12px;">' +
                    '<h4 style="margin:0 0 8px 0; color:#94a3b8; font-size:0.85rem; text-transform:uppercase;">Lyrics</h4>' +
                    '<div style="background:rgba(0,0,0,0.3); border-radius:10px; padding:16px; white-space:pre-wrap; color:#cbd5e1; font-size:0.95rem; line-height:1.7; max-height:300px; overflow-y:auto;">' +
                        msEscapeHtml(song.lyrics) +
                    '</div>' +
                '</div>'
            : '') +

            (song.notes ?
                '<div style="margin-top:12px;">' +
                    '<h4 style="margin:0 0 8px 0; color:#94a3b8; font-size:0.85rem; text-transform:uppercase;">Notes</h4>' +
                    '<p style="color:#cbd5e1; font-size:0.95rem; line-height:1.6;">' + msEscapeHtml(song.notes) + '</p>' +
                '</div>'
            : '') +
        '</div>';

    // Arrangements section
    html += '<div class="ms-card">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">' +
                    '<h3 style="margin:0; font-family:Merriweather,serif; font-size:1.2rem; color:#fff;">Arrangements</h3>' +
                    '<button class="ms-btn ms-btn-primary ms-btn-sm" id="ms-add-arr-btn">+ Add Arrangement</button>' +
                '</div>';

    if (musicStandAppState.arrangements.length === 0) {
        html += '<p style="color:#94a3b8; text-align:center; padding:20px 0;">No arrangements yet. Add one to start building chord charts.</p>';
    } else {
        for (var i = 0; i < musicStandAppState.arrangements.length; i++) {
            var arr = musicStandAppState.arrangements[i];
            html += '<div class="ms-arr-card">' +
                '<div class="ms-arr-info">' +
                    '<div style="font-weight:700; color:#fff; margin-bottom:4px;">' + msEscapeHtml(arr.name) + '</div>' +
                    '<div style="font-size:0.9rem; color:#94a3b8;">' +
                        '<span class="ms-arr-key">Key: ' + msEscapeHtml(arr.key) + '</span>' +
                        (arr.capo ? ' &middot; Capo ' + arr.capo : '') +
                        ' &middot; ' + msEscapeHtml(arr.instrument || 'Guitar') +
                        (arr.vocalRange ? ' &middot; Range: ' + msEscapeHtml(arr.vocalRange) : '') +
                    '</div>' +
                '</div>' +
                '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
                    '<button class="ms-btn ms-btn-secondary ms-btn-sm ms-view-arr" data-arr-idx="' + i + '">View</button>' +
                    '<button class="ms-btn ms-btn-secondary ms-btn-sm ms-edit-arr" data-arr-idx="' + i + '">Edit</button>' +
                    '<button class="ms-btn ms-btn-danger ms-btn-sm ms-delete-arr" data-row-index="' + arr.index + '" data-arr-id="' + msEscapeHtml(arr.id || '') + '" data-arr-name="' + msEscapeHtml(arr.name) + '">Delete</button>' +
                '</div>' +
            '</div>';
        }
    }

    html += '</div>';

    panel.innerHTML = html;

    // Bind events
    document.getElementById('ms-back-to-list').addEventListener('click', function() {
        musicStandAppState.currentSong = null;
        msRenderSongsTab();
    });

    var addArrBtn = document.getElementById('ms-add-arr-btn');
    if (addArrBtn) {
        addArrBtn.addEventListener('click', function() {
            _msArrEditRow = null;
            msOpenArrEditor(null);
        });
    }

    panel.querySelectorAll('.ms-view-arr').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var idx = Number(btn.getAttribute('data-arr-idx'));
            var arr2 = musicStandAppState.arrangements[idx];
            if (arr2) msShowArrangementView(arr2);
        });
    });

    panel.querySelectorAll('.ms-edit-arr').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var idx = Number(btn.getAttribute('data-arr-idx'));
            var arr2 = musicStandAppState.arrangements[idx];
            if (arr2) {
                _msArrEditRow = arr2;
                msOpenArrEditor(arr2);
            }
        });
    });

    panel.querySelectorAll('.ms-delete-arr').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var rowIndex = Number(btn.getAttribute('data-row-index'));
            var name = btn.getAttribute('data-arr-name');
            var arrId = btn.getAttribute('data-arr-id');
            msDeleteArrangement(rowIndex, name, arrId);
        });
    });
}

// ── Quick-play: open chord chart directly from song library ──────────────────
// Loads arrangements, picks the best one, and opens the chord view immediately.
// Falls back to song-level chordSheet or lyrics if no arrangements exist.

async function msQuickPlaySong(song) {
    // Fetch full song + arrangements if not cached
    var cached = _msSongDetailCache[song.id];
    if (!cached || (Date.now() - cached._ts) >= _MS_SONG_TTL) {
        try {
            if (_msFB() && song.id) {
                var full = await UpperRoom.getSongWithArrangements(song.id);
                full._ts = Date.now();
                _msSongDetailCache[song.id] = full;
                musicStandAppState.currentSong = full;
                musicStandAppState.arrangements = full.arrangements || [];
            } else {
                var data = await msApiCall('songs.get', { songId: song.id });
                if (data) {
                    data.row._ts = Date.now();
                    _msSongDetailCache[song.id] = data.row;
                    musicStandAppState.currentSong = data.row;
                    musicStandAppState.arrangements = data.row.arrangements || [];
                }
            }
        } catch (err) {
            console.warn('MusicStand: msQuickPlaySong fetch error', err);
            musicStandAppState.currentSong = song;
            musicStandAppState.arrangements = [];
        }
    } else {
        musicStandAppState.currentSong = cached;
        musicStandAppState.arrangements = cached.arrangements || [];
    }

    var arr = (musicStandAppState.arrangements && musicStandAppState.arrangements[0]) || null;

    // If there's an arrangement, use the full chord-chart overlay
    if (arr) {
        msShowArrangementView(arr);
        return;
    }

    // No arrangements — build a synthetic arrangement from song-level data
    var synth = {
        name: 'Default',
        key: musicStandAppState.currentSong.defaultKey || 'C',
        capo: 0,
        instrument: 'Guitar',
        lyricsWithChords: musicStandAppState.currentSong.chordSheet || null,
        chordChart: musicStandAppState.currentSong.chordChart || null,
    };
    // Patch song so msResolveChordContent can fall back to song.chordSheet
    msShowArrangementView(synth);
}

// ── Arrangement chord-chart view ─────────────────────────────

function msShowArrangementView(arr) {
    var overlay = document.getElementById('ms-arr-overlay');
    var modal = document.getElementById('ms-arr-modal');
    if (!overlay || !modal) return;
    modal.classList.add('ms-modal--fullscreen');
    overlay.style.padding = '0';

    var song = musicStandAppState.currentSong;
    var songTitle = song ? song.title : 'Song';
    var originalKey = arr.key || 'C';
    var capoFret = Number(arr.capo) || 0;
    var currentSemitones = 0;

    function buildChordHtml(semitones) {
        var text = msResolveChordContent(song, arr, semitones);
        if (text) return msRenderChordPro(text);
        if (arr.chordChart) return '<span class="ms-lyric-line">' + msEscapeHtml(arr.chordChart) + '</span>';
        return '<p style="color:#94a3b8; text-align:center;">No chord chart available.</p>';
    }

    var initKey = originalKey;
    var initSounding = capoFret ? msCapoSoundingKey(initKey, capoFret) : initKey;

    // Build the modal once — only chord content and key badge are updated on transpose
    modal.innerHTML =
        '<div class="ms-modal-header">' +
            '<h3 class="ms-modal-title">' + msEscapeHtml(songTitle) + ' \u2014 ' + msEscapeHtml(arr.name) + '</h3>' +
            '<button class="ms-close-btn" id="ms-arr-view-close">&times;</button>' +
        '</div>' +
        '<div class="ms-stand-meta">' +
            '<span class="ms-stand-badge" id="ms-av-key-badge">Key: ' + msEscapeHtml(initKey) + '</span>' +
            (capoFret ? '<span class="ms-stand-badge">Capo ' + capoFret + ' \u2192 sounds: <span id="ms-av-sounding-key">' + msEscapeHtml(initSounding) + '</span></span>' : '') +
            '<span class="ms-stand-badge">' + msEscapeHtml(arr.instrument || 'Guitar') + '</span>' +
        '</div>' +
        msTransposeControls(originalKey, initKey, capoFret, 'ms-av') +
        '<div class="ms-chord-display" id="ms-av-chord-content">' + buildChordHtml(0) + '</div>' +
        '<div style="text-align:right; margin-top:12px;">' +
            '<button class="ms-btn ms-btn-secondary" id="ms-arr-pdf-btn">Export PDF</button>' +
        '</div>';

    // Transpose: only update chord content and key badge — no full rebuild
    msBindTransposeControls(originalKey, 0, capoFret, 'ms-av', function(newSemitones) {
        currentSemitones = newSemitones;
        var newKey = msTransposeChord(originalKey, newSemitones) || originalKey;

        var chordDiv = document.getElementById('ms-av-chord-content');
        if (chordDiv) chordDiv.innerHTML = buildChordHtml(newSemitones);

        var keyBadge = document.getElementById('ms-av-key-badge');
        if (keyBadge) {
            keyBadge.innerHTML = 'Key: ' + msEscapeHtml(newKey) +
                (newSemitones !== 0 ? ' <span style="color:#94a3b8;font-size:0.8em;">(orig: ' + msEscapeHtml(originalKey) + ')</span>' : '');
        }

        if (capoFret) {
            var soundingSpan = document.getElementById('ms-av-sounding-key');
            if (soundingSpan) soundingSpan.textContent = msCapoSoundingKey(newKey, capoFret);
        }
    });

    document.getElementById('ms-arr-view-close').addEventListener('click', function() {
        overlay.classList.remove('ms-visible');
        overlay.setAttribute('aria-hidden', 'true');
        modal.classList.remove('ms-modal--fullscreen');
        overlay.style.padding = '';
    });

    document.getElementById('ms-arr-pdf-btn').addEventListener('click', function() {
        var resolvedContent = msResolveChordContent(song, arr, currentSemitones);
        var pdfArr = Object.assign({}, arr, {
            key: msTransposeChord(originalKey, currentSemitones) || originalKey,
            lyricsWithChords: resolvedContent || (arr.lyricsWithChords ? msTransposeChordPro(arr.lyricsWithChords, currentSemitones) : arr.lyricsWithChords)
        });
        msExportArrangementPDF(song, pdfArr);
    });

    overlay.classList.add('ms-visible');
    overlay.setAttribute('aria-hidden', 'false');

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.classList.remove('ms-visible');
            overlay.setAttribute('aria-hidden', 'true');
        }
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// SONG EDITOR (Create / Edit)
// ══════════════════════════════════════════════════════════════════════════════

function msOpenSongEditor(song) {
    var overlay = document.getElementById('ms-song-overlay');
    var modal = document.getElementById('ms-song-modal');
    if (!overlay || !modal) return;

    var isEdit = !!song;
    var title = isEdit ? 'Edit Song' : 'Add New Song';
    var s = song || {};

    modal.innerHTML =
        '<div class="ms-modal-header">' +
            '<h3 class="ms-modal-title">' + title + '</h3>' +
            '<button class="ms-close-btn" id="ms-song-editor-close">&times;</button>' +
        '</div>' +
        '<form id="ms-song-form" autocomplete="off">' +
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-f-title">Title *</label>' +
                    '<input class="ms-input" id="ms-f-title" type="text" value="' + msEscapeHtml(s.title || '') + '" required>' +
                '</div>' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-f-artist">Artist</label>' +
                    '<input class="ms-input" id="ms-f-artist" type="text" value="' + msEscapeHtml(s.artist || '') + '">' +
                '</div>' +
            '</div>' +

            '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-f-key">Default Key</label>' +
                    '<select class="ms-input ms-select" id="ms-f-key">' +
                        msKeyOptions(s.defaultKey || 'C') +
                    '</select>' +
                '</div>' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-f-bpm">Tempo (BPM)</label>' +
                    '<input class="ms-input" id="ms-f-bpm" type="number" min="0" max="300" value="' + (s.tempoBpm || '') + '">' +
                '</div>' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-f-time">Time Sig</label>' +
                    '<select class="ms-input ms-select" id="ms-f-time">' +
                        msTimeSigOptions(s.timeSignature || '4/4') +
                    '</select>' +
                '</div>' +
            '</div>' +

            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-f-ccli">CCLI Number</label>' +
                    '<input class="ms-input" id="ms-f-ccli" type="text" value="' + msEscapeHtml(s.ccliNumber || '') + '">' +
                '</div>' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-f-genre">Genre</label>' +
                    '<input class="ms-input" id="ms-f-genre" type="text" value="' + msEscapeHtml(s.genre || '') + '" placeholder="e.g. Contemporary, Hymn">' +
                '</div>' +
            '</div>' +

            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-f-duration">Duration (min)</label>' +
                    '<input class="ms-input" id="ms-f-duration" type="number" min="0" step="0.5" value="' + (s.durationMin || '') + '">' +
                '</div>' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-f-tags">Tags</label>' +
                    '<input class="ms-input" id="ms-f-tags" type="text" value="' + msEscapeHtml(s.tags || '') + '" placeholder="e.g. worship, opening, communion">' +
                '</div>' +
            '</div>' +

            '<div class="ms-form-group">' +
                '<label class="ms-label" for="ms-f-chord-sheet">&#127925; Chord Sheet &mdash; Original Key (' + msEscapeHtml(s.defaultKey || s.chordSheetKey || 'C') + ')</label>' +
                '<textarea class="ms-input ms-textarea" id="ms-f-chord-sheet" rows="12" style="font-family:monospace;font-size:0.88rem;" placeholder="[G]Amazing [C]grace how [G]sweet the sound&#10;That [G]saved a [Em]wretch like [D]me&#10;&#10;{comment: Chorus}&#10;[G]My chains are [D]gone I\'ve been set [Em]free">' + msEscapeHtml(s.chordSheet || '') + '</textarea>' +
                '<p style="color:#64748b;font-size:0.8rem;margin:4px 0 0 0;">Store in the song\'s <strong>original key</strong>. Arrangements will auto-transpose from this when they have no chart of their own. Uses ChordPro format: <code style="color:#22d3ee;">[G]word</code>.</p>' +
            '</div>' +

            '<div class="ms-form-group">' +
                '<label class="ms-label" for="ms-f-lyrics">Lyrics (plain, no chords)</label>' +
                '<textarea class="ms-input ms-textarea" id="ms-f-lyrics" rows="5" placeholder="Paste plain lyrics here (no chords)...">' + msEscapeHtml(s.lyrics || '') + '</textarea>' +
            '</div>' +

            '<div class="ms-form-group">' +
                '<label class="ms-label" for="ms-f-notes">Notes</label>' +
                '<textarea class="ms-input ms-textarea" id="ms-f-notes" rows="3" placeholder="Performance notes, arrangement tips, etc.">' + msEscapeHtml(s.notes || '') + '</textarea>' +
            '</div>' +

            '<div style="display:flex; gap:10px; justify-content:flex-end; margin-top:16px;">' +
                '<button type="button" class="ms-btn ms-btn-secondary" id="ms-song-cancel">Cancel</button>' +
                '<button type="submit" class="ms-btn ms-btn-primary" id="ms-song-save">' + (isEdit ? 'Save Changes' : 'Create Song') + '</button>' +
            '</div>' +
        '</form>';

    overlay.classList.add('ms-visible');
    overlay.setAttribute('aria-hidden', 'false');

    document.getElementById('ms-song-editor-close').addEventListener('click', function() { msCloseSongEditor(); });
    document.getElementById('ms-song-cancel').addEventListener('click', function() { msCloseSongEditor(); });

    document.getElementById('ms-song-form').addEventListener('submit', function(e) {
        e.preventDefault();
        msSaveSong(isEdit);
    });

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) msCloseSongEditor();
    });
}

function msCloseSongEditor() {
    var overlay = document.getElementById('ms-song-overlay');
    if (overlay) {
        overlay.classList.remove('ms-visible');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

async function msSaveSong(isEdit) {
    var titleVal = (document.getElementById('ms-f-title').value || '').trim();
    if (!titleVal) {
        document.getElementById('ms-f-title').focus();
        return;
    }

    var keyVal = document.getElementById('ms-f-key').value;
    var payload = {
        title:          titleVal,
        artist:         (document.getElementById('ms-f-artist').value || '').trim(),
        defaultKey:     keyVal,
        chordSheetKey:  keyVal,
        chordSheet:     document.getElementById('ms-f-chord-sheet').value || '',
        tempoBpm:       document.getElementById('ms-f-bpm').value || '0',
        timeSignature:  document.getElementById('ms-f-time').value,
        ccliNumber:     (document.getElementById('ms-f-ccli').value || '').trim(),
        genre:          (document.getElementById('ms-f-genre').value || '').trim(),
        durationMin:    document.getElementById('ms-f-duration').value || '0',
        tags:           (document.getElementById('ms-f-tags').value || '').trim(),
        lyrics:         document.getElementById('ms-f-lyrics').value || '',
        notes:          (document.getElementById('ms-f-notes').value || '').trim()
    };

    var saveBtn = document.getElementById('ms-song-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        if (isEdit && _msActiveEditRow) {
            if (_msFB()) {
                await UpperRoom.updateSong(Object.assign({ id: _msActiveEditRow.id }, payload));
            } else {
                payload.rowIndex = String(_msActiveEditRow.index);
                await msApiCall('songs.update', payload);
            }
        } else {
            if (_msFB()) {
                if (!payload.active) payload.active = 'TRUE';
                await UpperRoom.createSong(payload);
            } else {
                await msApiCall('songs.create', payload);
            }
        }
        msCloseSongEditor();
        _msSongsLoadedAt = 0;
        _msSongDetailCache = {};
        await msLoadSongs();
    } catch (err) {
        console.error('MusicStand: save song failed', err);
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Song';
    }
}

async function msDeleteSong(rowIndex, title, songId) {
    if (!confirm('Delete "' + title + '"? This cannot be undone.')) return;

    try {
        if (_msFB() && songId) {
            await UpperRoom.deleteSong(songId);
        } else {
            await msApiCall('songs.delete', { rowIndex: String(rowIndex) });
        }
        _msSongsLoadedAt = 0;
        _msSongDetailCache = {};
        await msLoadSongs();
    } catch (err) {
        console.error('MusicStand: delete song failed', err);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// ARRANGEMENT EDITOR
// ══════════════════════════════════════════════════════════════════════════════

function msOpenArrEditor(arr) {
    var overlay = document.getElementById('ms-arr-overlay');
    var modal = document.getElementById('ms-arr-modal');
    if (!overlay || !modal) return;

    var isEdit = !!arr;
    var title = isEdit ? 'Edit Arrangement' : 'Add Arrangement';
    var a = arr || {};

    modal.innerHTML =
        '<div class="ms-modal-header">' +
            '<h3 class="ms-modal-title">' + title + '</h3>' +
            '<button class="ms-close-btn" id="ms-arr-editor-close">&times;</button>' +
        '</div>' +
        '<form id="ms-arr-form" autocomplete="off">' +
            '<div class="ms-form-group">' +
                '<label class="ms-label" for="ms-af-name">Arrangement Name</label>' +
                '<input class="ms-input" id="ms-af-name" type="text" value="' + msEscapeHtml(a.name || '') + '" placeholder="e.g. Standard, Acoustic, Key of G">' +
            '</div>' +

            '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-af-key">Key *</label>' +
                    '<select class="ms-input ms-select" id="ms-af-key">' +
                        msKeyOptions(a.key || (musicStandAppState.currentSong ? musicStandAppState.currentSong.defaultKey : 'C')) +
                    '</select>' +
                '</div>' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-af-capo">Capo</label>' +
                    '<input class="ms-input" id="ms-af-capo" type="number" min="0" max="12" value="' + (a.capo || '0') + '">' +
                '</div>' +
                '<div class="ms-form-group">' +
                    '<label class="ms-label" for="ms-af-instrument">Instrument</label>' +
                    '<select class="ms-input ms-select" id="ms-af-instrument">' +
                        msInstrumentOptions(a.instrument || 'Guitar') +
                    '</select>' +
                '</div>' +
            '</div>' +

            '<div class="ms-form-group">' +
                '<label class="ms-label" for="ms-af-vocal">Vocal Range</label>' +
                '<input class="ms-input" id="ms-af-vocal" type="text" value="' + msEscapeHtml(a.vocalRange || '') + '" placeholder="e.g. E3-A4">' +
            '</div>' +

            '<div class="ms-form-group">' +
                '<label class="ms-label" for="ms-af-chords">Lyrics with Chords (ChordPro format)</label>' +
                '<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">' +
                    '<label class="ms-btn ms-btn-secondary ms-btn-sm" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px;">' +
                        '&#128194; Import ChordPro file' +
                        '<input type="file" id="ms-af-chordpro-file" accept=".txt,.chopro,.cho,.pro" style="display:none;">' +
                    '</label>' +
                    '<span id="ms-af-file-status" style="color:#64748b; font-size:0.82rem;">Supports .txt / .chopro from SongSelect</span>' +
                '</div>' +
                '<textarea class="ms-input ms-textarea" id="ms-af-chords" rows="12" placeholder="[G]Amazing [C]grace how [G]sweet the sound&#10;That [G]saved a [Em]wretch like [D]me">' + msEscapeHtml(a.lyricsWithChords || '') + '</textarea>' +
                '<p style="color:#64748b; font-size:0.8rem; margin:4px 0 0 0;">Use [Chord] before the syllable, e.g. [Am]Hello [G]world. <strong style="color:#22d3ee;">Leave blank</strong> to auto-derive from the song\'s original-key chord sheet, transposed to this arrangement\'s key.</p>' +
            '</div>' +

            '<div class="ms-form-group">' +
                '<label class="ms-label" for="ms-af-chart">Plain Chord Chart (optional)</label>' +
                '<textarea class="ms-input ms-textarea" id="ms-af-chart" rows="6" placeholder="Intro: G - C - G - D&#10;Verse: G C G D...">' + msEscapeHtml(a.chordChart || '') + '</textarea>' +
            '</div>' +

            '<div class="ms-form-group">' +
                '<label class="ms-label" for="ms-af-notes">Notes</label>' +
                '<textarea class="ms-input ms-textarea" id="ms-af-notes" rows="3">' + msEscapeHtml(a.notes || '') + '</textarea>' +
            '</div>' +

            '<div style="display:flex; gap:10px; justify-content:flex-end; margin-top:16px;">' +
                '<button type="button" class="ms-btn ms-btn-secondary" id="ms-arr-cancel">Cancel</button>' +
                '<button type="submit" class="ms-btn ms-btn-primary" id="ms-arr-save">' + (isEdit ? 'Save Changes' : 'Add Arrangement') + '</button>' +
            '</div>' +
        '</form>';

    overlay.classList.add('ms-visible');
    overlay.setAttribute('aria-hidden', 'false');

    document.getElementById('ms-arr-editor-close').addEventListener('click', function() { msCloseArrEditor(); });
    document.getElementById('ms-arr-cancel').addEventListener('click', function() { msCloseArrEditor(); });

    // ── ChordPro file import ──────────────────────────────────────────────────
    document.getElementById('ms-af-chordpro-file').addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            var text = ev.target.result || '';
            var meta = msParseChordProDirectives(text);

            // Populate chord textarea with full file content
            document.getElementById('ms-af-chords').value = text;

            // Key
            if (meta.key) {
                var keySelect = document.getElementById('ms-af-key');
                for (var i = 0; i < keySelect.options.length; i++) {
                    if (keySelect.options[i].value === meta.key) {
                        keySelect.selectedIndex = i;
                        break;
                    }
                }
            }

            // Arrangement name: default to "Key of X" if field is empty
            var nameInput = document.getElementById('ms-af-name');
            if (!nameInput.value.trim() && meta.key) {
                nameInput.value = 'Key of ' + meta.key;
            }

            // Notes: append tempo, time, CCLI if present
            var noteParts = [];
            if (meta.tempo)  noteParts.push('Tempo: ' + meta.tempo + ' BPM');
            if (meta.time)   noteParts.push('Time: ' + meta.time);
            if (meta.ccli)   noteParts.push('CCLI: ' + meta.ccli);
            if (meta.artist) noteParts.push('Artist: ' + meta.artist);
            if (noteParts.length) {
                var notesEl = document.getElementById('ms-af-notes');
                notesEl.value = (notesEl.value ? notesEl.value.trim() + '\n' : '') + noteParts.join(' | ');
            }

            // Status feedback
            var statusEl = document.getElementById('ms-af-file-status');
            if (statusEl) {
                var parts = [];
                if (meta.title)  parts.push(meta.title);
                if (meta.key)    parts.push('Key: ' + meta.key);
                if (meta.tempo)  parts.push(meta.tempo + ' BPM');
                statusEl.textContent = parts.length ? '\u2713 Loaded: ' + parts.join(' \u2022 ') : '\u2713 File loaded';
                statusEl.style.color = '#34d399';
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // allow re-selecting same file
    });

    document.getElementById('ms-arr-form').addEventListener('submit', function(e) {
        e.preventDefault();
        msSaveArrangement(isEdit);
    });

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) msCloseArrEditor();
    });
}

function msCloseArrEditor() {
    var overlay = document.getElementById('ms-arr-overlay');
    var modal = document.getElementById('ms-arr-modal');
    if (overlay) {
        overlay.classList.remove('ms-visible');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.padding = '';
    }
    if (modal) modal.classList.remove('ms-modal--fullscreen');
}

async function msSaveArrangement(isEdit) {
    var keyVal = document.getElementById('ms-af-key').value;
    if (!keyVal) return;

    var song = musicStandAppState.currentSong;
    if (!song) return;

    var payload = {
        songId:          song.id,
        name:            (document.getElementById('ms-af-name').value || '').trim() || 'Default',
        key:             keyVal,
        capo:            document.getElementById('ms-af-capo').value || '0',
        instrument:      document.getElementById('ms-af-instrument').value,
        vocalRange:      (document.getElementById('ms-af-vocal').value || '').trim(),
        lyricsWithChords:document.getElementById('ms-af-chords').value || '',
        chordChart:      document.getElementById('ms-af-chart').value || '',
        notes:           (document.getElementById('ms-af-notes').value || '').trim()
    };

    var saveBtn = document.getElementById('ms-arr-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        if (isEdit && _msArrEditRow) {
            if (_msFB()) {
                await UpperRoom.updateSongArrangement(Object.assign({ id: _msArrEditRow.id }, payload));
            } else {
                payload.rowIndex = String(_msArrEditRow.index);
                await msApiCall('arrangements.update', payload);
            }
        } else {
            if (_msFB()) {
                await UpperRoom.createSongArrangement(payload);
            } else {
                await msApiCall('arrangements.create', payload);
            }
        }
        msCloseArrEditor();
        if (song.id) delete _msSongDetailCache[song.id];
        await msOpenSongDetail(song);
    } catch (err) {
        console.error('MusicStand: save arrangement failed', err);
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Arrangement';
    }
}

async function msDeleteArrangement(rowIndex, name, arrId) {
    if (!confirm('Delete arrangement "' + name + '"? This cannot be undone.')) return;

    try {
        if (_msFB() && arrId) {
            await UpperRoom.deleteSongArrangement(arrId);
        } else {
            await msApiCall('arrangements.delete', { rowIndex: String(rowIndex) });
        }
        var song = musicStandAppState.currentSong;
        if (song && song.id) delete _msSongDetailCache[song.id];
        if (song) await msOpenSongDetail(song);
    } catch (err) {
        console.error('MusicStand: delete arrangement failed', err);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MUSIC STAND TAB — Live setlist view
// ══════════════════════════════════════════════════════════════════════════════

function msRenderStandTab() {
    var panel = document.getElementById('ms-tab-stand');
    if (!panel) return;

    // If no setlist is loaded, show plan ID input
    if (!musicStandAppState.plan) {
        panel.innerHTML =
            '<div class="ms-card" style="text-align:center; padding:30px;">' +
                '<h3 style="margin:0 0 12px 0; font-family:Merriweather,serif; color:#fff;">Load a Service Plan</h3>' +
                '<p style="color:#94a3b8; margin:0 0 16px 0;">Enter a service plan ID to load the setlist with chord charts.</p>' +
                '<div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">' +
                    '<input type="text" class="ms-input" id="ms-plan-id-input" placeholder="Plan ID" style="max-width:280px;">' +
                    '<button class="ms-btn ms-btn-primary" id="ms-load-plan-btn">Load Setlist</button>' +
                '</div>' +
            '</div>';

        document.getElementById('ms-load-plan-btn').addEventListener('click', function() {
            var planId = (document.getElementById('ms-plan-id-input').value || '').trim();
            if (planId) msLoadMusicStand(planId);
        });

        document.getElementById('ms-plan-id-input').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var planId = (document.getElementById('ms-plan-id-input').value || '').trim();
                if (planId) msLoadMusicStand(planId);
            }
        });
        return;
    }

    // Render the Music Stand
    msRenderStandView();
}

async function msLoadMusicStand(planId) {
    var panel = document.getElementById('ms-tab-stand');
    if (!panel) return;

    panel.innerHTML =
        '<div class="ms-card" style="text-align:center; padding:40px;">' +
            '<p style="color:#94a3b8;">Loading setlist...</p>' +
        '</div>';

    try {
        var data = await msApiCall('musicStand.get', { planId: planId });
        if (!data) return;

        musicStandAppState.plan = data.plan;
        musicStandAppState.setlist = data.setlist || [];
        musicStandAppState.standIndex = 0;

        msRenderStandView();
    } catch (err) {
        console.error('MusicStand: failed to load plan', err);
        panel.innerHTML =
            '<div class="ms-card" style="text-align:center; padding:30px;">' +
                '<p style="color:#f87171;">Failed to load setlist: ' + msEscapeHtml(err.message) + '</p>' +
                '<button class="ms-btn ms-btn-secondary" style="margin-top:12px;" id="ms-stand-retry">Try Again</button>' +
            '</div>';
        document.getElementById('ms-stand-retry').addEventListener('click', function() {
            musicStandAppState.plan = null;
            msRenderStandTab();
        });
    }
}

function msRenderStandView() {
    var panel = document.getElementById('ms-tab-stand');
    if (!panel) return;

    var plan = musicStandAppState.plan;
    var setlist = musicStandAppState.setlist;
    var idx = musicStandAppState.standIndex;

    // Filter to song items only for navigation
    var songItems = setlist.filter(function(e) { return e.itemType === 'Song' && e.song; });

    var html =
        '<div class="ms-card" style="padding:12px 18px;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">' +
                '<div>' +
                    '<strong style="color:#fff;">' + msEscapeHtml(plan.serviceType || 'Service') + '</strong>' +
                    '<span style="color:#94a3b8; margin-left:8px;">' + msFormatDate(plan.serviceDate) + '</span>' +
                    (plan.theme ? '<span style="color:#64748b; margin-left:8px;">&mdash; ' + msEscapeHtml(plan.theme) + '</span>' : '') +
                '</div>' +
                '<div style="display:flex; gap:6px;">' +
                    '<button class="ms-btn ms-btn-secondary ms-btn-sm" id="ms-stand-change-plan">Change Plan</button>' +
                    '<button class="ms-btn ms-btn-secondary ms-btn-sm" id="ms-stand-export-all">Export All PDF</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    if (songItems.length === 0) {
        html += '<div class="ms-card" style="text-align:center; padding:30px;">' +
                    '<p style="color:#94a3b8;">No songs in this setlist.</p>' +
                '</div>';
    } else {
        if (idx >= songItems.length) idx = songItems.length - 1;
        if (idx < 0) idx = 0;
        musicStandAppState.standIndex = idx;

        var current = songItems[idx];
        var song = current.song;
        var arr = current.arrangement;

        var originalKey = arr ? (arr.key || song.defaultKey || 'C') : (song.defaultKey || 'C');
        var capoFret    = arr ? (Number(arr.capo) || 0) : 0;
        var semitones   = musicStandAppState.standSemitones[idx] || 0;
        var displayKey  = msTransposeChord(originalKey, semitones) || originalKey;
        var soundingKey = capoFret ? msCapoSoundingKey(displayKey, capoFret) : displayKey;

        html += '<div class="ms-stand-view">' +
            '<div class="ms-stand-header">' +
                '<h2 class="ms-stand-song-title">' + msEscapeHtml(song.title) + '</h2>' +
            '</div>' +
            '<div class="ms-stand-meta">' +
                '<span class="ms-stand-badge" id="ms-sv-key-badge">Key: ' + msEscapeHtml(displayKey) + (semitones !== 0 ? ' <span style="font-size:0.8em;opacity:0.7;">(orig: ' + msEscapeHtml(originalKey) + ')</span>' : '') + '</span>' +
                (song.tempoBpm ? '<span class="ms-stand-badge">' + song.tempoBpm + ' BPM</span>' : '') +
                (song.timeSignature ? '<span class="ms-stand-badge">' + msEscapeHtml(song.timeSignature) + '</span>' : '') +
                (capoFret ? '<span class="ms-stand-badge">Capo ' + capoFret + ' \u2192 sounds: <span id="ms-sv-sounding-key">' + msEscapeHtml(soundingKey) + '</span></span>' : '') +
                (arr && arr.instrument ? '<span class="ms-stand-badge">' + msEscapeHtml(arr.instrument) + '</span>' : '') +
                (song.artist ? '<span class="ms-stand-badge">' + msEscapeHtml(song.artist) + '</span>' : '') +
            '</div>';

        // Transposition controls
        html += msTransposeControls(originalKey, displayKey, capoFret, 'ms-sv');

        // Show chord chart — priority: ChordPro (arr or auto-transposed from song.chordSheet) / arr plain chart / lyrics
        var resolvedChords = msResolveChordContent(song, arr, semitones);
        if (resolvedChords) {
            html += '<div class="ms-chord-display" id="ms-sv-chord-content">' + msRenderChordPro(resolvedChords) + '</div>';
        } else if (arr && arr.chordChart) {
            html += '<div class="ms-chord-display" id="ms-sv-chord-content">' + msEscapeHtml(arr.chordChart) + '</div>';
        } else if (song.lyrics) {
            html += '<div class="ms-chord-display" id="ms-sv-chord-content">' + msEscapeHtml(song.lyrics) + '</div>';
        } else {
            html += '<div class="ms-card" id="ms-sv-chord-content" style="text-align:center;"><p style="color:#94a3b8;">No chord chart or lyrics available for this song.</p></div>';
        }

        // Navigation
        html += '<div class="ms-stand-nav">' +
                    '<button class="ms-btn ms-btn-secondary" id="ms-stand-prev"' + (idx === 0 ? ' disabled style="opacity:0.4;cursor:default;"' : '') + '>&larr; Previous</button>' +
                    '<span class="ms-stand-counter">' + (idx + 1) + ' of ' + songItems.length + ' songs</span>' +
                    '<button class="ms-btn ms-btn-secondary" id="ms-stand-next"' + (idx >= songItems.length - 1 ? ' disabled style="opacity:0.4;cursor:default;"' : '') + '>Next &rarr;</button>' +
                '</div>';

        html += '</div>';

        // Full setlist overview
        html += '<div class="ms-card" style="margin-top:16px;">' +
                    '<h4 style="margin:0 0 10px 0; color:#94a3b8; font-size:0.85rem; text-transform:uppercase;">Full Setlist</h4>';

        for (var i = 0; i < setlist.length; i++) {
            var item = setlist[i];
            var isSong = item.itemType === 'Song' && item.song;
            var isCurrent = false;
            if (isSong) {
                var songIdx = songItems.indexOf(item);
                isCurrent = songIdx === idx;
            }

            html += '<div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px;' +
                        (isCurrent ? ' background:rgba(34,211,238,0.1); border:1px solid rgba(34,211,238,0.3);' : '') + '">' +
                        '<span style="color:#64748b; font-size:0.85rem; min-width:24px;">' + (item.order || (i + 1)) + '</span>' +
                        '<span style="font-weight:' + (isSong ? '700' : '400') + '; color:' + (isCurrent ? '#22d3ee' : isSong ? '#fff' : '#94a3b8') + ';">' +
                            msEscapeHtml(item.song ? item.song.title : item.title) +
                        '</span>' +
                        '<span style="color:#64748b; font-size:0.8rem; margin-left:auto;">' + msEscapeHtml(item.itemType || '') + '</span>' +
                        (item.duration ? '<span style="color:#64748b; font-size:0.8rem;">' + item.duration + 'm</span>' : '') +
                    '</div>';
        }

        html += '</div>';
    }

    panel.innerHTML = html;

    // Bind events
    var changePlanBtn = document.getElementById('ms-stand-change-plan');
    if (changePlanBtn) {
        changePlanBtn.addEventListener('click', function() {
            musicStandAppState.plan = null;
            musicStandAppState.setlist = [];
            musicStandAppState.standIndex = 0;
            msRenderStandTab();
        });
    }

    var exportAllBtn = document.getElementById('ms-stand-export-all');
    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', function() {
            msExportSetlistPDF();
        });
    }

    var prevBtn = document.getElementById('ms-stand-prev');
    if (prevBtn && !prevBtn.disabled) {
        prevBtn.addEventListener('click', function() {
            musicStandAppState.standIndex--;
            msRenderStandView();
        });
    }

    var nextBtn = document.getElementById('ms-stand-next');
    if (nextBtn && !nextBtn.disabled) {
        nextBtn.addEventListener('click', function() {
            musicStandAppState.standIndex++;
            msRenderStandView();
        });
    }

    // Bind transposition controls for the stand view
    if (songItems.length > 0) {
        var svOrigKey = (function() {
            var ci = songItems[idx];
            var a = ci ? ci.arrangement : null;
            var s = ci ? ci.song : null;
            return a ? (a.key || (s && s.defaultKey) || 'C') : ((s && s.defaultKey) || 'C');
        })();
        var svCapo = (function() {
            var ci = songItems[idx];
            var a = ci ? ci.arrangement : null;
            return a ? (Number(a.capo) || 0) : 0;
        })();
        msBindTransposeControls(svOrigKey, musicStandAppState.standSemitones[idx] || 0, svCapo, 'ms-sv', function(newSemitones) {
            musicStandAppState.standSemitones[idx] = newSemitones;
            var newKey = msTransposeChord(svOrigKey, newSemitones) || svOrigKey;
            var ci = songItems[idx];

            // Update chord content only — no full page re-render
            var chordDiv = document.getElementById('ms-sv-chord-content');
            if (chordDiv && ci) {
                var newResolved = msResolveChordContent(ci.song, ci.arrangement, newSemitones);
                if (newResolved) {
                    chordDiv.className = 'ms-chord-display';
                    chordDiv.innerHTML = msRenderChordPro(newResolved);
                } else if (ci.arrangement && ci.arrangement.chordChart) {
                    chordDiv.className = 'ms-chord-display';
                    chordDiv.innerHTML = msEscapeHtml(ci.arrangement.chordChart);
                } else if (ci.song && ci.song.lyrics) {
                    chordDiv.className = 'ms-chord-display';
                    chordDiv.innerHTML = msEscapeHtml(ci.song.lyrics);
                }
            }

            // Update key badge
            var keyBadge = document.getElementById('ms-sv-key-badge');
            if (keyBadge) {
                keyBadge.innerHTML = 'Key: ' + msEscapeHtml(newKey) +
                    (newSemitones !== 0 ? ' <span style="font-size:0.8em;opacity:0.7;">(orig: ' + msEscapeHtml(svOrigKey) + ')</span>' : '');
            }

            // Update sounding key
            if (svCapo) {
                var soundingSpan = document.getElementById('ms-sv-sounding-key');
                if (soundingSpan) soundingSpan.textContent = msCapoSoundingKey(newKey, svCapo);
            }
        });
    }

    // Keyboard navigation
    var keyHandler = function(e) {
        if (musicStandAppState.activeTab !== 'stand' || !musicStandAppState.plan) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (musicStandAppState.standIndex > 0) {
                musicStandAppState.standIndex--;
                msRenderStandView();
            }
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            var songItems2 = musicStandAppState.setlist.filter(function(e2) { return e2.itemType === 'Song' && e2.song; });
            if (musicStandAppState.standIndex < songItems2.length - 1) {
                musicStandAppState.standIndex++;
                msRenderStandView();
            }
        }
    };

    // Remove old listener if stored, add new one
    if (musicStandAppState._keyHandler) {
        document.removeEventListener('keydown', musicStandAppState._keyHandler);
    }
    musicStandAppState._keyHandler = keyHandler;
    document.addEventListener('keydown', keyHandler);
}

// ══════════════════════════════════════════════════════════════════════════════
// CHORDPRO RENDERER
// ══════════════════════════════════════════════════════════════════════════════
// TRANSPOSITION ENGINE
// Transposes ChordPro chord names by semitone steps.
// Handles sharps, flats, all qualities (maj7, m7, sus4, dim, aug, etc.)
// and capo calculation (sounds-like key).
// ══════════════════════════════════════════════════════════════════════════════

var _MS_SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var _MS_FLATS  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

// Prefer flats when transposing down, sharps when up
function msTransposeChord(chord, semitones) {
    if (!chord || semitones === 0) return chord;
    // Extract root note (up to 2 chars: letter + optional # or b)
    var rootMatch = chord.match(/^([A-G][#b]?)(.*)/);
    if (!rootMatch) return chord;
    var root    = rootMatch[1];
    var quality = rootMatch[2];

    // Find position in chromatic scale
    var idx = _MS_SHARPS.indexOf(root);
    if (idx === -1) idx = _MS_FLATS.indexOf(root);
    if (idx === -1) return chord; // unrecognised root — pass through

    var newIdx = ((idx + semitones) % 12 + 12) % 12;
    // Use flats when transposing down (negative), sharps when up
    var scale = semitones < 0 ? _MS_FLATS : _MS_SHARPS;
    return scale[newIdx] + quality;
}

// Apply transposition to every [Chord] token in a ChordPro string
function msTransposeChordPro(text, semitones) {
    if (!text || semitones === 0) return text;
    return String(text).replace(/\[([^\]]+)\]/g, function(_, chord) {
        // Handle slash chords like G/B
        var parts = chord.split('/');
        return '[' + parts.map(function(p) { return msTransposeChord(p.trim(), semitones); }).join('/') + ']';
    });
}

// Given a fretted key and capo fret, return the sounding key
function msCapoSoundingKey(frettedKey, capoFret) {
    if (!frettedKey || !capoFret) return frettedKey;
    var n = Number(capoFret);
    if (!n || n < 0 || n > 12) return frettedKey;
    return msTransposeChord(frettedKey, n);
}

// Convert a sounding key + capo to the fretted key the player uses
function msSoundingToFretted(soundingKey, capoFret) {
    if (!soundingKey || !capoFret) return soundingKey;
    var n = Number(capoFret);
    if (!n || n < 0 || n > 12) return soundingKey;
    return msTransposeChord(soundingKey, -n);
}

// All 12 keys for dropdowns
var _MS_ALL_KEYS = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'];

function msKeySelect(id, selected, label) {
    var html = '<select class="ms-input ms-select" id="' + id + '" style="width:auto;min-width:90px;" title="' + (label||'') + '">';
    _MS_ALL_KEYS.forEach(function(k) {
        html += '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + k + '</option>';
    });
    html += '</select>';
    return html;
}

// Transpose controls UI — emits HTML string
// targetKey: the currently-displayed key; originalKey: the stored arr.key
function msTransposeControls(originalKey, targetKey, capoFret, idPrefix) {
    var cap = Number(capoFret) || 0;
    var soundingKey = cap ? msCapoSoundingKey(targetKey, cap) : targetKey;
    var prefix = idPrefix || 'ms-xp';
    return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 14px;background:var(--accent-soft);border:1px solid var(--line-strong);border-radius:10px;">' +
        '<span style="color:var(--ink-muted);font-size:0.82rem;font-weight:700;text-transform:uppercase;white-space:nowrap;">Transpose</span>' +
        '<button class="ms-btn ms-btn-secondary ms-btn-sm" id="' + prefix + '-down">&#x2212; Semitone</button>' +
        '<button class="ms-btn ms-btn-secondary ms-btn-sm" id="' + prefix + '-up">+ Semitone</button>' +
        msKeySelect(prefix + '-key', targetKey, 'Jump to key') +
        '<button class="ms-btn ms-btn-secondary ms-btn-sm" id="' + prefix + '-reset" title="Reset to original key (' + (originalKey||'') + ')">Reset</button>' +
        (cap ? '<span style="color:var(--accent);font-size:0.85rem;white-space:nowrap;">Capo ' + cap + ' \u2192 sounds like <strong>' + soundingKey + '</strong></span>' : '') +
    '</div>';
}

// Wire up transposition controls after they're in the DOM.
// onTranspose(newSemitones) is called whenever the user changes key.
function msBindTransposeControls(originalKey, currentSemitones, capoFret, idPrefix, onTranspose) {
    var prefix = idPrefix || 'ms-xp';
    var semitones = currentSemitones || 0;

    var downBtn  = document.getElementById(prefix + '-down');
    var upBtn    = document.getElementById(prefix + '-up');
    var keySelect = document.getElementById(prefix + '-key');
    var resetBtn = document.getElementById(prefix + '-reset');

    if (downBtn) downBtn.addEventListener('click', function() {
        semitones--;
        if (keySelect) keySelect.value = msTransposeChord(originalKey, semitones) || keySelect.value;
        onTranspose(semitones);
    });
    if (upBtn) upBtn.addEventListener('click', function() {
        semitones++;
        if (keySelect) keySelect.value = msTransposeChord(originalKey, semitones) || keySelect.value;
        onTranspose(semitones);
    });
    if (keySelect) keySelect.addEventListener('change', function() {
        var target = keySelect.value;
        // Compute semitones from originalKey → target
        var origIdx = _MS_SHARPS.indexOf(originalKey);
        if (origIdx === -1) origIdx = _MS_FLATS.indexOf(originalKey);
        var targIdx = _MS_SHARPS.indexOf(target);
        if (targIdx === -1) targIdx = _MS_FLATS.indexOf(target);
        if (origIdx !== -1 && targIdx !== -1) {
            // Pick the shorter path (max 6 semitones either way)
            var diff = targIdx - origIdx;
            if (diff > 6)  diff -= 12;
            if (diff < -6) diff += 12;
            semitones = diff;
        }
        onTranspose(semitones);
    });
    if (resetBtn) resetBtn.addEventListener('click', function() {
        semitones = 0;
        if (keySelect) keySelect.value = originalKey || keySelect.value;
        onTranspose(0);
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// Converts ChordPro notation: "[G]Amazing [C]grace" into two-line
// display with chords above lyrics, using HTML spans.

// ── Parse ChordPro directive headers from a file ─────────────────────────────
// Returns: { title, artist, key, tempo, time, ccli, copyright }
function msParseChordProDirectives(text) {
    var result = {};
    var directiveRe = /^\{(\w+):\s*(.+?)\s*\}/;
    String(text).split('\n').forEach(function(line) {
        var m = line.trim().match(directiveRe);
        if (!m) return;
        var tag = m[1].toLowerCase();
        var val = m[2];
        switch (tag) {
            case 'title':  case 't':                result.title     = val; break;
            case 'artist': case 'a':                result.artist    = val; break;
            case 'subtitle': case 'st':             result.subtitle  = val; break;
            case 'key':                             result.key       = val; break;
            case 'tempo':                           result.tempo     = val; break;
            case 'time':                            result.time      = val.trim(); break;
            case 'capo':                            result.capo      = val; break;
            case 'ccli':    case 'ccli_song':       result.ccli      = val; break;
            case 'copyright':                       result.copyright = val; break;
        }
    });
    return result;
}

function msRenderChordPro(text) {
    if (!text) return '';

    var lines = String(text).split('\n');
    var html = '<div class="ms-cp-song">';
    var inSection = false;

    // Section label colours
    var sectionColors = {
        verse:    '#60a5fa',
        chorus:   '#f472b6',
        bridge:   '#a78bfa',
        intro:    '#34d399',
        outro:    '#34d399',
        tag:      '#fbbf24',
        prechorus:'#fb923c',
        interlude:'#94a3b8',
    };

    function sectionColor(name) {
        var key = String(name || '').toLowerCase().replace(/[\s_\d]/g, '');
        for (var k in sectionColors) {
            if (key.indexOf(k) !== -1) return sectionColors[k];
        }
        return '#e2e8f0';
    }

    function closeSection() {
        if (inSection) { html += '</div>'; inSection = false; }
    }

    function openSection() {
        if (!inSection) {
            html += '<div class="ms-cp-section">';
            inSection = true;
        }
    }

    // Handle a line that has [Chord]lyric interleaving — returns an HTML row
    function parseLyricLine(line) {
        // Check if line has any chord markers
        if (!/\[/.test(line)) {
            // Plain lyric / instruction line
            var trimmed = line.trim();
            if (!trimmed) return null; // blank — caller adds spacer
            return '<div class="ms-cp-lyric-only">' + msEscapeHtml(trimmed) + '</div>';
        }

        // Build pairs: [{chord, lyric}, ...]
        var pairs = [];
        var pos = 0;
        var regex = /\[([^\]]+)\]/g;
        var match;
        var lastChord = null;

        while ((match = regex.exec(line)) !== null) {
            var lyricBefore = line.substring(pos, match.index);
            if (lastChord !== null) {
                pairs.push({ chord: lastChord, lyric: lyricBefore });
            } else if (lyricBefore) {
                pairs.push({ chord: '', lyric: lyricBefore });
            }
            lastChord = match[1];
            pos = match.index + match[0].length;
        }
        // Remaining lyric after last chord
        pairs.push({ chord: lastChord || '', lyric: line.substring(pos) });

        // Render as a flex row of chord+lyric pairs
        var row = '<div class="ms-cp-row">';
        for (var i = 0; i < pairs.length; i++) {
            var p = pairs[i];
            var chordHtml = p.chord
                ? '<span class="ms-cp-chord">' + msEscapeHtml(p.chord) + '</span>'
                : '<span class="ms-cp-chord ms-cp-chord--empty">&nbsp;</span>';
            var lyricHtml = p.lyric
                ? '<span class="ms-cp-word">' + msEscapeHtml(p.lyric) + '</span>'
                : '<span class="ms-cp-word ms-cp-word--space">&nbsp;</span>';
            row += '<span class="ms-cp-pair">' + chordHtml + lyricHtml + '</span>';
        }
        row += '</div>';
        return row;
    }

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        // ── Directives ───────────────────────────────────────────────
        // Section start: {start_of_chorus}, {soc}, {verse:1}, {chorus}, etc.
        var sectionStart = line.match(/^\{(?:start_of_(\w+)|sov|soc|sob|sos|sot|(?:(verse|chorus|bridge|intro|outro|tag|pre-?chorus|interlude))(?::\s*(.+?))?)\}$/i);
        if (sectionStart) {
            closeSection();
            var sName = sectionStart[1] || sectionStart[2] || 'Section';
            var sNum  = sectionStart[3] ? ' ' + sectionStart[3].trim() : '';
            var sLabel = sName.charAt(0).toUpperCase() + sName.slice(1).toLowerCase() + sNum;
            var sCol = sectionColor(sName);
            html += '<div class="ms-cp-section-label" style="color:' + sCol + '; border-left-color:' + sCol + ';">' + msEscapeHtml(sLabel) + '</div>';
            continue;
        }

        // Section end directives
        if (/^\{end_of_\w+\}$/i.test(line)) { closeSection(); continue; }

        // {title:}, {t:}
        var titleMatch = line.match(/^\{(?:title|t):\s*(.+)\}$/i);
        if (titleMatch) {
            closeSection();
            html += '<div class="ms-cp-title">' + msEscapeHtml(titleMatch[1]) + '</div>';
            continue;
        }

        // {subtitle:}, {st:}, {artist:}
        var subMatch = line.match(/^\{(?:subtitle|st|artist):\s*(.+)\}$/i);
        if (subMatch) {
            closeSection();
            html += '<div class="ms-cp-subtitle">' + msEscapeHtml(subMatch[1]) + '</div>';
            continue;
        }

        // {comment:}, {c:}, {ci:}  — section label style
        var commentMatch = line.match(/^\{(?:comment|c|ci|cb):\s*(.+)\}$/i);
        if (commentMatch) {
            closeSection();
            var cName = commentMatch[1].trim();
            var cCol  = sectionColor(cName);
            html += '<div class="ms-cp-section-label" style="color:' + cCol + '; border-left-color:' + cCol + ';">' + msEscapeHtml(cName) + '</div>';
            continue;
        }

        // Skip any remaining directives
        if (/^\{.*\}$/.test(line.trim())) continue;

        // ── Content lines ─────────────────────────────────────────────
        if (!line.trim()) {
            closeSection();
            html += '<div class="ms-cp-spacer"></div>';
            continue;
        }

        openSection();
        var rowHtml = parseLyricLine(line);
        if (rowHtml) html += rowHtml;
    }

    closeSection();
    html += '</div>';
    return html;
}


// ══════════════════════════════════════════════════════════════════════════════
// PDF EXPORT (via jsPDF)
// ══════════════════════════════════════════════════════════════════════════════

function msLoadJsPDF() {
    return new Promise(function(resolve, reject) {
        if (window.jspdf && window.jspdf.jsPDF) {
            resolve(window.jspdf.jsPDF);
            return;
        }
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
        script.onload = function() {
            if (window.jspdf && window.jspdf.jsPDF) {
                resolve(window.jspdf.jsPDF);
            } else {
                reject(new Error('jsPDF failed to load.'));
            }
        };
        script.onerror = function() { reject(new Error('Could not load jsPDF library.')); };
        document.head.appendChild(script);
    });
}

async function msExportArrangementPDF(song, arr) {
    if (!song || !arr) return;

    try {
        var JsPDF = await msLoadJsPDF();
        var doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

        var pageWidth = doc.internal.pageSize.getWidth();
        var margin = 40;
        var maxWidth = pageWidth - margin * 2;
        var y = margin;

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(String(song.title || 'Untitled'), margin, y);
        y += 22;

        // Artist
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(String(song.artist || ''), margin, y);
        y += 16;

        // Meta line
        var meta = 'Key: ' + (arr.key || song.defaultKey || '—');
        if (arr.capo) meta += '  |  Capo ' + arr.capo;
        if (song.tempoBpm) meta += '  |  ' + song.tempoBpm + ' BPM';
        if (song.timeSignature) meta += '  |  ' + song.timeSignature;
        doc.setFontSize(10);
        doc.text(meta, margin, y);
        y += 20;

        // Separator
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 16;

        // Chord chart content
        var content = arr.lyricsWithChords || arr.chordChart || song.lyrics || '';
        var contentLines = msChordProToPlainText(content);

        doc.setFont('courier', 'normal');
        doc.setFontSize(10);
        var lineHeight = 13;

        for (var i = 0; i < contentLines.length; i++) {
            if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage();
                y = margin;
            }

            var cl = contentLines[i];
            if (cl.isChord) {
                doc.setFont('courier', 'bold');
                doc.text(cl.text, margin, y);
                doc.setFont('courier', 'normal');
            } else {
                doc.text(cl.text, margin, y);
            }
            y += lineHeight;
        }

        // Footer
        var pageCount = doc.internal.getNumberOfPages();
        for (var p = 1; p <= pageCount; p++) {
            doc.setPage(p);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                song.ccliNumber ? 'CCLI# ' + song.ccliNumber : '',
                margin,
                doc.internal.pageSize.getHeight() - 20
            );
            doc.text(
                'Page ' + p + ' of ' + pageCount,
                pageWidth - margin - 60,
                doc.internal.pageSize.getHeight() - 20
            );
            doc.setTextColor(0);
        }

        doc.save(msSlugify(song.title) + '-' + msSlugify(arr.key) + '.pdf');
    } catch (err) {
        console.error('MusicStand: PDF export failed', err);
        alert('PDF export failed: ' + err.message);
    }
}

async function msExportSetlistPDF() {
    var plan = musicStandAppState.plan;
    var setlist = musicStandAppState.setlist;
    if (!plan || !setlist.length) return;

    var songItems = setlist.filter(function(e) { return e.itemType === 'Song' && e.song; });
    if (songItems.length === 0) {
        alert('No songs in this setlist to export.');
        return;
    }

    try {
        var JsPDF = await msLoadJsPDF();
        var doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
        var pageWidth = doc.internal.pageSize.getWidth();
        var pageHeight = doc.internal.pageSize.getHeight();
        var margin = 40;

        for (var s = 0; s < songItems.length; s++) {
            if (s > 0) doc.addPage();

            var item = songItems[s];
            var song = item.song;
            var arr = item.arrangement;
            var y = margin;

            // Title
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text(String(song.title || 'Untitled'), margin, y);
            y += 22;

            // Artist
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.text(String(song.artist || ''), margin, y);
            y += 16;

            // Meta
            var meta = 'Key: ' + (arr ? (item.keyOverride || arr.key) : song.defaultKey || '—');
            if (arr && arr.capo) meta += '  |  Capo ' + arr.capo;
            if (song.tempoBpm) meta += '  |  ' + song.tempoBpm + ' BPM';
            if (song.timeSignature) meta += '  |  ' + song.timeSignature;
            doc.setFontSize(10);
            doc.text(meta, margin, y);
            y += 20;

            doc.setLineWidth(0.5);
            doc.line(margin, y, pageWidth - margin, y);
            y += 16;

            // Content
            var rawContent = msResolveChordContent(song, arr, 0);
            var content = rawContent || (arr && arr.chordChart) || song.lyrics || '';
            var contentLines = msChordProToPlainText(content);

            doc.setFont('courier', 'normal');
            doc.setFontSize(10);
            var lineHeight = 13;

            for (var i = 0; i < contentLines.length; i++) {
                if (y + lineHeight > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }

                var cl = contentLines[i];
                if (cl.isChord) {
                    doc.setFont('courier', 'bold');
                    doc.text(cl.text, margin, y);
                    doc.setFont('courier', 'normal');
                } else {
                    doc.text(cl.text, margin, y);
                }
                y += lineHeight;
            }
        }

        // Page numbers on all pages
        var totalPages = doc.internal.getNumberOfPages();
        for (var p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                (plan.serviceType || 'Service') + ' — ' + msFormatDate(plan.serviceDate),
                margin,
                pageHeight - 20
            );
            doc.text('Page ' + p + ' of ' + totalPages, pageWidth - margin - 60, pageHeight - 20);
            doc.setTextColor(0);
        }

        doc.save('setlist-' + msSlugify(plan.serviceDate || 'export') + '.pdf');
    } catch (err) {
        console.error('MusicStand: setlist PDF export failed', err);
        alert('PDF export failed: ' + err.message);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function msChordProToPlainText(text) {
    if (!text) return [];
    var lines = String(text).split('\n');
    var result = [];

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        // Section header directives
        var headerMatch = line.match(/^\{(title|t|comment|c|subtitle|st):\s*(.+)\}$/i);
        if (headerMatch) {
            result.push({ text: headerMatch[2], isChord: false });
            result.push({ text: '', isChord: false });
            continue;
        }

        // Skip other directives
        if (line.match(/^\{.*\}$/)) continue;

        // Empty line
        if (!line.trim()) {
            result.push({ text: '', isChord: false });
            continue;
        }

        // Parse chords
        var chordLine = '';
        var lyricLine = '';
        var pos = 0;
        var hasChords = false;
        var regex = /\[([^\]]+)\]/g;
        var match;

        while ((match = regex.exec(line)) !== null) {
            hasChords = true;
            var before = line.substring(pos, match.index);
            lyricLine += before;
            while (chordLine.length < lyricLine.length) chordLine += ' ';
            chordLine += match[1];
            pos = match.index + match[0].length;
        }
        lyricLine += line.substring(pos);

        if (hasChords) {
            result.push({ text: chordLine, isChord: true });
            result.push({ text: lyricLine, isChord: false });
        } else {
            result.push({ text: line, isChord: false });
        }
    }

    return result;
}

function msSlugify(str) {
    return String(str || 'untitled')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 60);
}

function msKeyOptions(selected) {
    var keys = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B',
                'Cm','C#m','Dm','D#m','Ebm','Em','Fm','F#m','Gm','G#m','Am','A#m','Bbm','Bm'];
    var html = '';
    for (var i = 0; i < keys.length; i++) {
        html += '<option value="' + keys[i] + '"' + (keys[i] === selected ? ' selected' : '') + '>' + keys[i] + '</option>';
    }
    return html;
}

function msTimeSigOptions(selected) {
    var sigs = ['4/4','3/4','6/8','2/4','6/4','12/8'];
    var html = '';
    for (var i = 0; i < sigs.length; i++) {
        html += '<option value="' + sigs[i] + '"' + (sigs[i] === selected ? ' selected' : '') + '>' + sigs[i] + '</option>';
    }
    return html;
}

function msInstrumentOptions(selected) {
    var instruments = ['Guitar','Piano','Bass','Keys','Ukulele','Cajon','Drums','Vocal','Other'];
    var html = '';
    for (var i = 0; i < instruments.length; i++) {
        html += '<option value="' + instruments[i] + '"' + (instruments[i] === selected ? ' selected' : '') + '>' + instruments[i] + '</option>';
    }
    return html;
}

// ══════════════════════════════════════════════════════════════════════════════
// SONGSELECT IMPORT
// Paste-and-parse ChordPro from CCLI SongSelect, Planning Center, or any
// ChordPro source. Stores the song in its original key so every arrangement
// can auto-transpose from it.
// ══════════════════════════════════════════════════════════════════════════════

function msOpenSongSelectImport() {
    var overlay = document.getElementById('ms-song-overlay');
    var modal   = document.getElementById('ms-song-modal');
    if (!overlay || !modal) return;

    modal.innerHTML =
        '<div class="ms-modal-header">' +
            '<h3 class="ms-modal-title">&#x29C9; Import from SongSelect / ChordPro</h3>' +
            '<button class="ms-close-btn" id="ms-import-close">&times;</button>' +
        '</div>' +
        '<p style="color:#94a3b8;font-size:0.9rem;margin:0 0 14px 0;">Paste a ChordPro chord chart from CCLI SongSelect, Planning Center, or any ChordPro source. The song will be saved in its <strong style="color:#22d3ee;">original key</strong> and can be transposed at any time.</p>' +
        '<div class="ms-form-group">' +
            '<label class="ms-label" for="ms-import-text">Paste Chord Chart</label>' +
            '<textarea class="ms-input ms-textarea" id="ms-import-text" rows="16" style="font-family:monospace;font-size:0.85rem;" placeholder="{title: Amazing Grace}&#10;{artist: John Newton}&#10;{key: G}&#10;{ccli: 4768151}&#10;&#10;{comment: Verse 1}&#10;[G]Amazing [C]grace how [G]sweet the sound&#10;That [G]saved a [Em]wretch like [D]me..."></textarea>' +
        '</div>' +
        '<div id="ms-import-preview" style="display:none;"></div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">' +
            '<button class="ms-btn ms-btn-secondary" id="ms-import-cancel">Cancel</button>' +
            '<button class="ms-btn ms-btn-secondary" id="ms-import-parse">Preview Parse</button>' +
            '<button class="ms-btn ms-btn-primary" id="ms-import-save" style="display:none;">Save to Library</button>' +
        '</div>';

    overlay.classList.add('ms-visible');
    overlay.setAttribute('aria-hidden', 'false');

    document.getElementById('ms-import-close').addEventListener('click', function() { msCloseSongEditor(); });
    document.getElementById('ms-import-cancel').addEventListener('click', function() { msCloseSongEditor(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) msCloseSongEditor(); });

    var _parsed = null;

    document.getElementById('ms-import-parse').addEventListener('click', function() {
        var text = document.getElementById('ms-import-text').value;
        _parsed = msParseSongSelect(text);
        var preview = document.getElementById('ms-import-preview');
        var saveBtn = document.getElementById('ms-import-save');

        if (!_parsed.title && !_parsed.chordSheet) {
            preview.style.display = 'block';
            preview.innerHTML = '<div style="color:#f87171;padding:12px;background:rgba(239,68,68,0.1);border-radius:8px;margin-bottom:12px;">Could not detect song data. Make sure you paste valid ChordPro content.</div>';
            saveBtn.style.display = 'none';
            return;
        }

        preview.style.display = 'block';
        preview.innerHTML =
            '<div style="background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.2);border-radius:10px;padding:14px;margin-bottom:12px;">' +
                '<div style="font-weight:700;color:#22d3ee;font-size:0.8rem;text-transform:uppercase;margin-bottom:10px;">Parsed Preview</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;font-size:0.9rem;">' +
                    '<span style="color:#94a3b8;">Title</span><span style="color:#fff;">' + msEscapeHtml(_parsed.title || '—') + '</span>' +
                    '<span style="color:#94a3b8;">Artist</span><span style="color:#fff;">' + msEscapeHtml(_parsed.artist || '—') + '</span>' +
                    '<span style="color:#94a3b8;">Original Key</span><span style="color:#22d3ee;font-weight:700;">' + msEscapeHtml(_parsed.key || '—') + '</span>' +
                    '<span style="color:#94a3b8;">CCLI #</span><span style="color:#fff;">' + msEscapeHtml(_parsed.ccliNumber || '—') + '</span>' +
                    '<span style="color:#94a3b8;">Tempo</span><span style="color:#fff;">' + msEscapeHtml(_parsed.bpm || '—') + '</span>' +
                    '<span style="color:#94a3b8;">Time Signature</span><span style="color:#fff;">' + msEscapeHtml(_parsed.timeSignature || '—') + '</span>' +
                    '<span style="color:#94a3b8;">Sections detected</span><span style="color:#fff;">' + (_parsed.sections || 0) + '</span>' +
                '</div>' +
            '</div>';
        saveBtn.style.display = '';
    });

    document.getElementById('ms-import-save').addEventListener('click', async function() {
        if (!_parsed) return;
        var saveBtn = document.getElementById('ms-import-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
            await msSaveImportedSong(_parsed);
            msCloseSongEditor();
            _msSongsLoadedAt = 0;
            _msSongDetailCache = {};
            await msLoadSongs();
        } catch (err) {
            console.error('MusicStand: SongSelect import failed', err);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save to Library';
        }
    });
}

function msParseSongSelect(text) {
    var result = { title: '', artist: '', key: '', ccliNumber: '', bpm: '', timeSignature: '', capo: '', chordSheet: text, sections: 0 };
    if (!text) return result;

    var lines = text.split('\n');

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        // Parse ChordPro directives like {title: Amazing Grace}
        var m = line.match(/^\{([\w\-]+):\s*(.+?)\s*\}$/i);
        if (m) {
            var key = m[1].toLowerCase();
            var val = m[2].trim();
            if (key === 'title' || key === 't')                           result.title = val;
            else if (key === 'artist' || key === 'a' || key === 'composer') result.artist = val;
            else if (key === 'key')                                        result.key = val;
            else if (key === 'capo')                                       result.capo = val;
            else if (key === 'tempo' || key === 'bpm')                     result.bpm = val;
            else if (key === 'time')                                       result.timeSignature = val;
            else if (key === 'ccli')                                       result.ccliNumber = val;
            else if (key === 'comment' || key === 'c')                     result.sections++;
        }
    }

    // Count {comment:} directives if we didn't accumulate them above
    var commentCount = (text.match(/^\{c(?:omment)?:/gim) || []).length;
    if (commentCount > result.sections) result.sections = commentCount;

    // If no section headings found, count blank-line-separated chord blocks
    if (!result.sections) {
        var blocks = text.split(/\n\s*\n/);
        result.sections = blocks.filter(function(b) { return b.trim() && /\[[A-G][#b]?/.test(b); }).length;
    }

    // If no title found from directives, try the first short non-chord non-directive line
    if (!result.title) {
        for (var j = 0; j < Math.min(lines.length, 5); j++) {
            var l = lines[j].trim();
            if (l && !l.startsWith('{') && !l.startsWith('[') && l.length < 80) {
                result.title = l;
                break;
            }
        }
    }

    return result;
}

async function msSaveImportedSong(parsed) {
    var payload = {
        title:          parsed.title || 'Imported Song',
        artist:         parsed.artist || '',
        defaultKey:     parsed.key || 'C',
        chordSheetKey:  parsed.key || 'C',
        chordSheet:     parsed.chordSheet || '',
        ccliNumber:     parsed.ccliNumber || '',
        tempoBpm:       parsed.bpm || '0',
        timeSignature:  parsed.timeSignature || '4/4',
        active:         'TRUE',
        notes:          'Imported from SongSelect / ChordPro'
    };
    if (parsed.capo) payload.capo = parsed.capo;

    if (_msFB()) {
        await UpperRoom.createSong(payload);
    } else {
        await msApiCall('songs.create', payload);
    }
}
window.openMusicStandApp = openMusicStandApp;

/* Expose as window.TheShofar for inline onclick= handlers */
if (typeof window !== 'undefined') {
  window.TheShofar = {
    openMusicStandApp,
  };
}
