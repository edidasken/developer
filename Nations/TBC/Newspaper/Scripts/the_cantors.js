/**
 * the_cantors.js — Song Planner Section Engine
 *
 * Renders the levites/ section (#section-main) as a full Song Planner.
 * Display name: "Song Planner"   Code name: levites / the_cantors
 * Accent: var(--sec-levites) = #1a3d28 (Cedar Green)
 *
 * Layout:
 *   COL 1 (2.5fr): Song Library  |  COL 2 (2fr): Set List  |  COL 3 (1fr): Psalm
 *
 * Persistence: localStorage('herald_setlist') for Sunday's set
 */

(function () {
  'use strict';

  var LS_KEY_SET   = 'herald_setlist';
  var LS_KEY_SONGS = 'herald_custom_songs';

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function todayLong() {
    var d = new Date();
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  var BUILTIN_SONGS = [
    { id:'s001', title:'Amazing Grace',              artist:'John Newton',         key:'G',  bpm:72,  ccli:'22025' },
    { id:'s002', title:'How Great Thou Art',          artist:'Carl Boberg',         key:'Bb', bpm:68,  ccli:'14181' },
    { id:'s003', title:'Holy, Holy, Holy',            artist:'Reginald Heber',      key:'D',  bpm:76,  ccli:'26518' },
    { id:'s004', title:'Great Is Thy Faithfulness',   artist:'Thomas Chisholm',     key:'A',  bpm:66,  ccli:'18723' },
    { id:'s005', title:'A Mighty Fortress',           artist:'Martin Luther',       key:'F',  bpm:84,  ccli:'42964' },
    { id:'s006', title:"How Deep the Father's Love",  artist:'Stuart Townend',      key:'D',  bpm:62,  ccli:'1558110' },
    { id:'s007', title:'In Christ Alone',             artist:'Keith Getty',         key:'G',  bpm:80,  ccli:'3350395' },
    { id:'s008', title:'Cornerstone',                 artist:'Hillsong Worship',    key:'C',  bpm:74,  ccli:'6158927' },
    { id:'s009', title:'What a Beautiful Name',       artist:'Hillsong Worship',    key:'D',  bpm:68,  ccli:'7068424' },
    { id:'s010', title:'Reckless Love',               artist:'Cory Asbury',         key:'Bb', bpm:72,  ccli:'7089380' },
    { id:'s011', title:'Build My Life',               artist:'Brett Younker',       key:'G',  bpm:70,  ccli:'7070345' },
    { id:'s012', title:'King of Kings',               artist:'Hillsong Worship',    key:'Bb', bpm:68,  ccli:'7127647' },
    { id:'s013', title:'Living Hope',                 artist:'Phil Wickham',        key:'D',  bpm:76,  ccli:'7106807' },
    { id:'s014', title:'The Blessing',                artist:'Kari Jobe',           key:'A',  bpm:68,  ccli:'7147007' },
    { id:'s015', title:'Way Maker',                   artist:'Sinach',              key:'Bb', bpm:68,  ccli:'7101840' },
    { id:'s016', title:'Graves Into Gardens',         artist:'Brandon Lake',        key:'E',  bpm:74,  ccli:'7138219' },
    { id:'s017', title:'House of the Lord',           artist:'Phil Wickham',        key:'A',  bpm:86,  ccli:'7168122' },
    { id:'s018', title:'Goodness of God',             artist:'Bethel Music',        key:'G',  bpm:66,  ccli:'7117726' },
    { id:'s019', title:'Psalm 46 (Lord of Hosts)',    artist:'Shane & Shane',       key:'C',  bpm:74,  ccli:'6285088' },
    { id:'s020', title:'Blessed Assurance',           artist:'Fanny Crosby',        key:'D',  bpm:100, ccli:'22324' },
    { id:'s021', title:'It Is Well with My Soul',     artist:'Philip Bliss',        key:'Eb', bpm:76,  ccli:'25376' },
    { id:'s022', title:'Before the Throne of God',    artist:'Charitie Bancroft',   key:'C',  bpm:74,  ccli:'3609825' },
    { id:'s023', title:'Ancient of Days',             artist:'Ron Kenoly',          key:'G',  bpm:120, ccli:'694194' },
    { id:'s024', title:'Shout to the Lord',           artist:'Darlene Zschech',     key:'Bb', bpm:72,  ccli:'1406918' },
    { id:'s025', title:'Here I Am to Worship',        artist:'Tim Hughes',          key:'E',  bpm:76,  ccli:'3266032' },
    { id:'s026', title:'How Can It Be',               artist:'Lauren Daigle',       key:'Ab', bpm:72,  ccli:'6484330' },
    { id:'s027', title:'Christ the Lord Is Risen',    artist:'Charles Wesley',      key:'G',  bpm:96,  ccli:'26420' },
    { id:'s028', title:'O Come All Ye Faithful',      artist:'Traditional',         key:'G',  bpm:80,  ccli:'31054' },
    { id:'s029', title:'Psalm 23 (The Lord Is My Shepherd)', artist:'Stuart Townend', key:'E', bpm:70, ccli:'1585970' },
    { id:'s030', title:'Yet Not I But Through Christ', artist:'City Alight',        key:'D',  bpm:72,  ccli:'7121852' },
  ];

  var state = { songs: [], setlist: [], filter: '', firestoreSongs: [], firestoreSongsLoaded: false };

  function loadSetlist() {
    try { state.setlist = JSON.parse(localStorage.getItem(LS_KEY_SET) || '[]'); } catch (_) { state.setlist = []; }
  }
  function saveSetlist() {
    try { localStorage.setItem(LS_KEY_SET, JSON.stringify(state.setlist)); } catch (_) {}
  }
  function loadCustomSongs() {
    try { return JSON.parse(localStorage.getItem(LS_KEY_SONGS) || '[]'); } catch (_) { return []; }
  }
  function saveCustomSongs(arr) {
    try { localStorage.setItem(LS_KEY_SONGS, JSON.stringify(arr)); } catch (_) {}
  }

  function buildSongList() {
    var custom = loadCustomSongs();
    // Use Firestore songs when loaded; suppress built-ins so the church library
    // is the only source of truth. Fall back to BUILTIN_SONGS only when
    // Firestore has not been loaded or returned zero songs.
    var base = (state.firestoreSongsLoaded && state.firestoreSongs.length > 0)
      ? state.firestoreSongs
      : BUILTIN_SONGS;
    var merged = base.concat(custom);
    var seen = {};
    state.songs = merged.filter(function(s) {
      if (seen[s.id]) return false;
      seen[s.id] = true; return true;
    });
  }

  // Normalize a Firestore song doc to the local song shape
  function normalizeFsSong(doc) {
    var d = doc;
    return {
      id:     d.id || d._fsId || ('fs' + Math.random().toString(36).slice(2)),
      title:  d.title  || 'Untitled',
      artist: d.artist || d.author || '',
      key:    d.key    || d.defaultKey || '',
      bpm:    parseInt(d.bpm || d.tempo, 10) || 0,
      ccli:   String(d.ccliNumber || d.ccli || ''),
    };
  }

  function tryLoadFirestoreSongs() {
    var UR = window.UpperRoom;
    if (!UR || typeof UR.listSongs !== 'function') return;
    UR.listSongs({ limit: 1000 }).then(function(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return;
      state.firestoreSongs = rows.map(normalizeFsSong);
      state.firestoreSongsLoaded = true;
      render();
    }).catch(function() { /* Firestore unavailable — built-ins remain active */ });
  }

  function getSong(id) {
    return state.songs.find(function(s) { return s.id === id; }) || null;
  }

  var ASCENT_PSALMS = [120,121,122,123,124,125,126,127,128,129,130,131,132,133,134];

  function loadPsalm() {
    try {
      var pd = window.HERALD_DATA && window.HERALD_DATA.psalms;
      if (!pd || !pd.byNumber) return null;
      var n = ASCENT_PSALMS[new Date().getDay() % ASCENT_PSALMS.length];
      return pd.byNumber[n] || null;
    } catch (_) { return null; }
  }

  function renderSongRow(song, inSet) {
    return '<div class="cts-song-row">' +
      '<div class="cts-song-info">' +
        '<span class="cts-song-title">' + esc(song.title) + '</span>' +
        '<span class="cts-song-artist">' + esc(song.artist) + '</span>' +
      '</div>' +
      '<div class="cts-song-meta">' +
        '<span class="cts-badge cts-badge--key">' + esc(song.key) + '</span>' +
        '<span class="cts-badge">' + song.bpm + '</span>' +
        (inSet
          ? '<button class="cts-btn cts-btn--remove" data-action="remove-from-set" data-song-id="' + esc(song.id) + '">\u2715</button>'
          : '<button class="cts-btn cts-btn--add" data-action="add-to-set" data-song-id="' + esc(song.id) + '">+ Set</button>') +
      '</div>' +
    '</div>';
  }

  function renderSetItem(song, idx) {
    return '<div class="cts-set-item">' +
      '<span class="cts-set-num">' + (idx + 1) + '</span>' +
      '<div class="cts-set-info">' +
        '<span class="cts-song-title">' + esc(song.title) + '</span>' +
        '<span class="cts-song-artist">' + esc(song.artist) + '</span>' +
      '</div>' +
      '<div class="cts-song-meta">' +
        '<span class="cts-badge cts-badge--key">' + esc(song.key) + '</span>' +
        '<span class="cts-badge">' + song.bpm + ' BPM</span>' +
        (song.ccli ? '<span class="cts-badge">CCLI ' + esc(song.ccli) + '</span>' : '') +
        '<button class="cts-btn cts-btn--remove" data-action="remove-from-set" data-song-id="' + esc(song.id) + '">\u2715</button>' +
      '</div>' +
    '</div>';
  }

  function injectStyles() {
    if (document.getElementById('cts-styles')) return;
    var css = '.cts-search{width:100%;box-sizing:border-box;padding:7px 10px;font-family:inherit;font-size:0.88rem;border:1px solid rgba(0,0,0,0.2);border-radius:4px;margin-bottom:10px;background:var(--paper,#faf6ed);}' +
'.cts-song-list{max-height:340px;overflow-y:auto;border:1px solid rgba(0,0,0,0.15);border-radius:4px;}' +
'.cts-song-row{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-bottom:1px solid rgba(0,0,0,0.08);gap:6px;}' +
'.cts-song-row:last-child{border-bottom:none;}' +
'.cts-song-row:hover{background:rgba(0,0,0,0.04);}' +
'.cts-song-info{flex:1;min-width:0;}' +
'.cts-song-title{display:block;font-weight:600;font-size:0.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
'.cts-song-artist{display:block;font-size:0.76rem;color:var(--ink-muted,#666);}' +
'.cts-song-meta{display:flex;align-items:center;gap:4px;flex-shrink:0;}' +
'.cts-badge{font-size:0.7rem;font-weight:700;padding:2px 5px;border-radius:3px;background:rgba(0,0,0,0.08);white-space:nowrap;}' +
'.cts-badge--key{background:var(--sec-levites,#1a3d28);color:#fff;}' +
'.cts-btn{border:none;border-radius:3px;cursor:pointer;font-size:0.76rem;padding:3px 7px;font-family:inherit;}' +
'.cts-btn--add{background:var(--sec-levites,#1a3d28);color:#fff;}' +
'.cts-btn--add:hover{opacity:0.82;}' +
'.cts-btn--remove{background:transparent;color:var(--ink,#1a100a);}' +
'.cts-btn--remove:hover{color:#c00;}' +
'.cts-set-list{min-height:80px;border:1px solid rgba(0,0,0,0.15);border-radius:4px;max-height:340px;overflow-y:auto;}' +
'.cts-set-item{display:flex;align-items:center;gap:7px;padding:8px 10px;border-bottom:1px solid rgba(0,0,0,0.08);}' +
'.cts-set-item:last-child{border-bottom:none;}' +
'.cts-set-num{font-weight:700;font-size:0.92rem;min-width:18px;text-align:center;color:var(--sec-levites,#1a3d28);}' +
'.cts-set-info{flex:1;min-width:0;}' +
'.cts-set-empty{padding:20px;text-align:center;color:var(--ink-muted,#666);font-style:italic;font-size:0.85rem;}' +
'.cts-set-footer{margin-top:7px;font-size:0.8rem;color:var(--ink-muted,#666);}' +
'.cts-add-form{margin-top:12px;border-top:1px solid rgba(0,0,0,0.1);padding-top:10px;}' +
'.cts-add-form input,.cts-add-form select{width:100%;box-sizing:border-box;padding:5px 8px;font-family:inherit;font-size:0.83rem;border:1px solid rgba(0,0,0,0.2);border-radius:3px;margin-bottom:5px;background:var(--paper,#faf6ed);}' +
'.cts-add-btn{background:var(--sec-levites,#1a3d28);color:#fff;border:none;border-radius:3px;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:0.83rem;width:100%;}' +
'.cts-add-btn:hover{opacity:0.85;}' +
'.cts-clear-btn{background:transparent;border:1px solid rgba(0,0,0,0.18);border-radius:3px;padding:4px 10px;cursor:pointer;font-family:inherit;font-size:0.76rem;margin-top:5px;}' +
'.cts-clear-btn:hover{background:rgba(0,0,0,0.06);}';
    var el = document.createElement('style');
    el.id = 'cts-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function render() {
    var main = document.getElementById('panel-songs') || document.getElementById('section-main');
    if (!main) return;
    injectStyles();
    buildSongList();
    loadSetlist();

    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : '';

    var psalm = loadPsalm();
    var psNum = ASCENT_PSALMS[new Date().getDay() % ASCENT_PSALMS.length];

    var q = (state.filter || '').toLowerCase();
    var visible = state.songs.filter(function(s) {
      return !q || s.title.toLowerCase().indexOf(q) !== -1 || (s.artist || '').toLowerCase().indexOf(q) !== -1;
    });

    var inSet = {};
    state.setlist.forEach(function(id) { inSet[id] = true; });

    // Col 1: Song Library
    var libraryRows = visible.length
      ? visible.map(function(s) { return renderSongRow(s, !!inSet[s.id]); }).join('')
      : '<div class="cts-set-empty">No songs match &ldquo;' + esc(state.filter) + '&rdquo;</div>';

    var col1 = '<div class="np-col">' +
      '<p class="np-col__flag" style="color:var(--sec-levites)">Song Planner &mdash; ' + todayLong() + '</p>' +
      '<h2 class="np-headline">Song Library</h2>' +
      '<p class="np-byline" style="font-variant:small-caps;">Worship &middot; Music &middot; Set Planning</p>' +
      '<hr class="np-column-rule">' +
      '<input id="cts-search" class="cts-search" type="text" placeholder="Search title or artist&hellip;" value="' + esc(state.filter) + '">' +
      '<div class="cts-song-list" id="cts-library">' + libraryRows + '</div>' +
      '<div class="cts-add-form">' +
        '<p class="np-col__flag" style="margin-bottom:6px">Add a Song</p>' +
        '<input id="cts-new-title" type="text" placeholder="Title *">' +
        '<input id="cts-new-artist" type="text" placeholder="Artist">' +
        '<select id="cts-new-key"><option value="">Key</option>' +
        ['C','C#','Db','D','Eb','E','F','F#','Gb','G','Ab','A','Bb','B'].map(function(k){return '<option>'+k+'</option>';}).join('') +
        '</select>' +
        '<input id="cts-new-bpm" type="number" placeholder="BPM" min="40" max="240">' +
        '<input id="cts-new-ccli" type="text" placeholder="CCLI #">' +
        '<button class="cts-add-btn" id="cts-add-song-btn">Add to Library</button>' +
      '</div>' +
    '</div>';

    // Col 2: Sunday's Set
    var setItems = state.setlist.map(function(id, idx) {
      var s = getSong(id); return s ? renderSetItem(s, idx) : '';
    }).filter(Boolean);

    var bpms = state.setlist.map(function(id){ var s = getSong(id); return s ? s.bpm : 0; }).filter(Boolean);
    var avgBpm = bpms.length ? Math.round(bpms.reduce(function(a,b){return a+b;},0)/bpms.length) : 0;

    var col2 = '<div class="np-col">' +
      '<p class="np-col__flag">Sunday\'s Set</p>' +
      '<h2 class="np-headline" style="font-size:1.45rem;">Set List</h2>' +
      '<hr class="np-column-rule">' +
      '<div class="cts-set-list" id="cts-setlist">' +
        (setItems.length ? setItems.join('') : '<div class="cts-set-empty">No songs yet.<br>Add from the library.</div>') +
      '</div>' +
      (setItems.length ? '<div class="cts-set-footer"><strong>' + state.setlist.length + '</strong> song' + (state.setlist.length!==1?'s':'') + (avgBpm ? ' &middot; Avg BPM: <strong>' + avgBpm + '</strong>' : '') + '</div>' +
        '<button class="cts-clear-btn" id="cts-clear-set">Clear Set</button>' : '') +
    '</div>';

    // Col 3: Psalm of the Day
    var psalmTitle = psalm ? psalm.title : ('Psalm ' + psNum);
    var psalmBody  = psalm && psalm.summary ? psalm.summary
      : 'The Songs of Ascents (Psalms 120\u2013134) were sung by pilgrims climbing to Jerusalem. They are songs of the journey \u2014 of longing, arrival, and joy in the presence of God.';

    var col3 = '<div class="np-col">' +
      '<p class="np-col__flag">Song of Ascents &mdash; Psalm ' + psNum + '</p>' +
      '<h2 class="np-headline" style="font-size:1.3rem;">' + esc(psalmTitle) + '</h2>' +
      '<hr class="np-column-rule">' +
      '<div class="np-body" style="font-size:0.87rem;"><p>' + esc(psalmBody) + '</p></div>' +
      '<p class="np-body" style="font-size:0.82rem;font-style:italic;margin-top:12px;">The 15 Songs of Ascents rotate daily as preparation for worship.</p>' +
    '</div>';

    var banner = '<div class="np-banner" style="border-bottom-color:var(--sec-levites)">' +
      '<p class="np-banner__flag" style="color:var(--sec-levites)">The Flock Herald &mdash; Song Planner</p>' +
      '<h2 class="np-banner__headline">' + esc(churchName || 'Song Planner') + '</h2>' +
      '<p class="np-banner__deck">Build Sunday\'s worship set &middot; Search the song library &middot; Plan the gathering</p>' +
    '</div>';

    main.innerHTML = '<div class="np-broadsheet">' + banner +
      '<div class="np-cols" style="grid-template-columns:2.5fr 2fr 1fr">' +
      col1 + col2 + col3 +
      '</div></div>';

    attachEvents();
  }

  function attachEvents() {
    var searchEl = document.getElementById('cts-search');
    if (searchEl) {
      searchEl.addEventListener('input', function() { state.filter = this.value; render(); });
    }
    var main = document.getElementById('panel-songs') || document.getElementById('section-main');
    if (main) {
      main.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.dataset.action;
        var songId = btn.dataset.songId;
        if (action === 'add-to-set') {
          if (state.setlist.indexOf(songId) === -1) {
            state.setlist.push(songId);
            saveSetlist(); render();
          }
        } else if (action === 'remove-from-set') {
          state.setlist = state.setlist.filter(function(id) { return id !== songId; });
          saveSetlist(); render();
        }
      });
    }
    var clearBtn = document.getElementById('cts-clear-set');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        if (!confirm("Clear Sunday's set list?")) return;
        state.setlist = []; saveSetlist(); render();
      });
    }
    var addBtn = document.getElementById('cts-add-song-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        var title = (document.getElementById('cts-new-title').value || '').trim();
        if (!title) { alert('Please enter a song title.'); return; }
        var artist = (document.getElementById('cts-new-artist').value || '').trim() || 'Unknown';
        var key    = document.getElementById('cts-new-key').value || 'G';
        var bpm    = parseInt(document.getElementById('cts-new-bpm').value, 10) || 75;
        var ccli   = (document.getElementById('cts-new-ccli').value || '').trim();
        var custom = loadCustomSongs();
        custom.push({ id: 'cu' + Date.now(), title: title, artist: artist, key: key, bpm: bpm, ccli: ccli });
        saveCustomSongs(custom);
        state.filter = ''; render();
      });
    }
  }

  render();
  tryLoadFirestoreSongs();
  if (window.Nehemiah && typeof Nehemiah.onAuthResolved === 'function') {
    Nehemiah.onAuthResolved(function() {
      render();
      tryLoadFirestoreSongs();
    });
  }

})();
