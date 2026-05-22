/**
 * the_letters.js — Announcements & Prayer Chain Section Engine
 *
 * Renders the epistles/ section (#section-main) as an Announcement Board + Prayer Chain.
 * Display name: "Announcements & Prayer"   Code name: epistles / the_letters
 * Accent: var(--sec-epistles,#3d2505) (Parchment Brown)
 *
 * Layout:
 *   COL 1 (2.5fr): Announcements  |  COL 2 (2fr): Prayer Chain  |  COL 3 (1fr): Pastoral Letter
 *
 * Persistence:
 *   localStorage('herald_announcements')
 *   localStorage('herald_prayer_chain')
 */

(function () {
  'use strict';

  var LS_ANNOUNCE = 'herald_announcements';
  var LS_PRAYER   = 'herald_prayer_chain';
  var ACC = 'var(--sec-epistles,#3d2505)';

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function todayLong() {
    var d = new Date();
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    return MONTHS[parseInt(p[1],10)-1].slice(0,3) + ' ' + parseInt(p[2],10);
  }

  var ANN_CATEGORIES = { event:'Event', announcement:'Announcement', notice:'Notice', urgent:'Urgent' };
  var ANN_COLORS     = { event:'#2980b9', announcement:'#27ae60', notice:'#7f8c8d', urgent:'#c0392b' };

  var state = {
    announcements: [],
    prayers:       [],
    showAddAnn:    false,
    showAddPrayer: false,
    annFilter:     'all',
  };

  function loadAnnouncements() {
    try { state.announcements = JSON.parse(localStorage.getItem(LS_ANNOUNCE) || '[]'); } catch (_) { state.announcements = []; }
  }
  function saveAnnouncements() {
    try { localStorage.setItem(LS_ANNOUNCE, JSON.stringify(state.announcements)); } catch (_) {}
  }
  function loadPrayers() {
    try { state.prayers = JSON.parse(localStorage.getItem(LS_PRAYER) || '[]'); } catch (_) { state.prayers = []; }
  }
  function savePrayers() {
    try { localStorage.setItem(LS_PRAYER, JSON.stringify(state.prayers)); } catch (_) {}
  }

  var PASTORAL_LETTERS = [
    { salutation: 'Dear Flock,', body: 'The gathering of the saints is not a program \u2014 it is the act of the people of God. Come expectant. Come prepared. Let nothing rob you of the joy of meeting together.' },
    { salutation: 'To the Church,', body: 'Prayer is not the last resort; it is the first response. Before strategy, before planning, before action \u2014 pray. The church that prays is the church that prevails.' },
    { salutation: 'Beloved,', body: 'Your attendance matters \u2014 not for the count, but for the body. When you are absent, something is missing. You are not a spectator; you are a member.' },
    { salutation: 'To the Saints,', body: 'Stewardship begins with time. Before you give your money, give your presence. Before you give your presence, give your heart. The Lord sees what you offer before the offering plate arrives.' },
    { salutation: 'Grace and peace,', body: 'The church bulletin is not a list of events \u2014 it is a window into the life of a family. Every announcement is an invitation. Every prayer request is a burden shared. Read it slowly.' },
    { salutation: 'Brothers and sisters,', body: 'Every generation of the church has faced a moment where it had to decide whether to hold the line or drift with the current. You are living in that moment. Hold the line.' },
    { salutation: 'Dear congregation,', body: 'The sermon is not the whole service. Worship, prayer, the Lord\u2019s Supper, the announcements, the fellowship \u2014 all of it is the service. Come early. Stay late. Be present for all of it.' },
  ];

  function injectStyles() {
    if (document.getElementById('lt-styles')) return;
    var css =
'.lt-ann{border:1px solid rgba(0,0,0,0.12);border-radius:4px;padding:10px 12px;margin-bottom:7px;position:relative;}' +
'.lt-ann-cat{display:inline-block;font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:10px;color:#fff;margin-bottom:5px;}' +
'.lt-ann-title{font-weight:700;font-size:0.9rem;}' +
'.lt-ann-body{font-size:0.84rem;margin:4px 0;line-height:1.45;}' +
'.lt-ann-meta{font-size:0.74rem;color:var(--ink-muted,#666);margin-top:5px;}' +
'.lt-ann-del{position:absolute;top:8px;right:8px;border:none;background:transparent;cursor:pointer;font-size:0.8rem;color:var(--ink-muted,#666);}' +
'.lt-ann-del:hover{color:#c00;}' +
'.lt-filter-bar{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;}' +
'.lt-filter-btn{border:1px solid rgba(0,0,0,0.18);border-radius:3px;background:transparent;padding:3px 8px;cursor:pointer;font-family:inherit;font-size:0.76rem;}' +
'.lt-filter-btn.active{background:' + ACC + ';color:#fff;border-color:transparent;}' +
'.lt-prayer-item{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(0,0,0,0.08);}' +
'.lt-prayer-item:last-child{border-bottom:none;}' +
'.lt-prayer-check{margin-top:2px;cursor:pointer;flex-shrink:0;}' +
'.lt-prayer-info{flex:1;}' +
'.lt-prayer-name{font-weight:600;font-size:0.87rem;}' +
'.lt-prayer-name.answered{text-decoration:line-through;color:var(--ink-muted,#666);}' +
'.lt-prayer-req{font-size:0.8rem;color:var(--ink-muted,#666);margin-top:2px;}' +
'.lt-prayer-date{font-size:0.73rem;color:var(--ink-muted,#666);}' +
'.lt-prayer-del{border:none;background:transparent;cursor:pointer;color:var(--ink-muted,#666);font-size:0.8rem;flex-shrink:0;}' +
'.lt-prayer-del:hover{color:#c00;}' +
'.lt-prayer-list{border:1px solid rgba(0,0,0,0.12);border-radius:4px;max-height:300px;overflow-y:auto;}' +
'.lt-add-form{margin-top:10px;border-top:1px solid rgba(0,0,0,0.1);padding-top:10px;}' +
'.lt-add-form input,.lt-add-form select,.lt-add-form textarea{width:100%;box-sizing:border-box;padding:5px 8px;font-family:inherit;font-size:0.83rem;border:1px solid rgba(0,0,0,0.2);border-radius:3px;margin-bottom:5px;background:var(--paper,#faf6ed);}' +
'.lt-add-form textarea{resize:vertical;min-height:55px;}' +
'.lt-add-btn{background:' + ACC + ';color:#fff;border:none;border-radius:3px;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:0.83rem;width:100%;}' +
'.lt-add-btn:hover{opacity:0.85;}' +
'.lt-toggle{background:transparent;border:1px solid rgba(0,0,0,0.2);border-radius:3px;padding:5px 12px;cursor:pointer;font-family:inherit;font-size:0.82rem;margin-bottom:8px;width:100%;}' +
'.lt-toggle:hover{background:rgba(0,0,0,0.06);}' +
'.lt-empty{padding:18px;text-align:center;color:var(--ink-muted,#666);font-style:italic;font-size:0.84rem;border:1px solid rgba(0,0,0,0.1);border-radius:4px;}' +
'.lt-pastoral-letter{border:1px solid rgba(0,0,0,0.12);border-radius:4px;padding:14px;font-size:0.87rem;line-height:1.6;}' +
'.lt-letter-salutation{font-weight:700;margin-bottom:8px;}' +
'.lt-letter-body{font-style:italic;}' +
'.lt-letter-sig{margin-top:12px;font-size:0.82rem;color:var(--ink-muted,#666);}';
    var el = document.createElement('style'); el.id = 'lt-styles'; el.textContent = css; document.head.appendChild(el);
  }

  function renderAnnouncement(ann) {
    var cc = ANN_COLORS[ann.category] || '#999';
    return '<div class="lt-ann">' +
      '<button class="lt-ann-del" data-action="delete-ann" data-ann-id="' + esc(ann.id) + '">\u2715</button>' +
      '<span class="lt-ann-cat" style="background:' + cc + '">' + esc(ANN_CATEGORIES[ann.category] || ann.category) + '</span>' +
      '<div class="lt-ann-title">' + esc(ann.title) + '</div>' +
      (ann.body ? '<div class="lt-ann-body">' + esc(ann.body) + '</div>' : '') +
      '<div class="lt-ann-meta">' + fmtDate(ann.date) + (ann.eventDate ? ' &middot; Happening: ' + fmtDate(ann.eventDate) : '') + '</div>' +
    '</div>';
  }

  function renderPrayer(p, idx) {
    return '<div class="lt-prayer-item">' +
      '<input type="checkbox" class="lt-prayer-check" data-action="toggle-prayer" data-prayer-idx="' + idx + '"' + (p.answered?' checked':'') + '>' +
      '<div class="lt-prayer-info">' +
        '<div class="lt-prayer-name' + (p.answered?' answered':'') + '">' + esc(p.name) + '</div>' +
        (p.request ? '<div class="lt-prayer-req">' + esc(p.request) + '</div>' : '') +
        '<div class="lt-prayer-date">' + fmtDate(p.date) + (p.answered ? ' &middot; Answered \u2713' : '') + '</div>' +
      '</div>' +
      '<button class="lt-prayer-del" data-action="delete-prayer" data-prayer-idx="' + idx + '">\u2715</button>' +
    '</div>';
  }

  function render() {
    var main = document.getElementById('panel-prayer') || document.getElementById('section-main');
    if (!main) return;
    injectStyles();
    loadAnnouncements(); loadPrayers();

    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : '';

    var filtered = state.annFilter === 'all' ? state.announcements
      : state.announcements.filter(function(a){ return a.category === state.annFilter; });

    var filterBtns = ['all','event','announcement','notice','urgent'].map(function(f){
      return '<button class="lt-filter-btn' + (state.annFilter===f?' active':'') + '" data-action="filter-ann" data-filter="' + f + '">' +
        (f==='all' ? 'All (' + state.announcements.length + ')' : (ANN_CATEGORIES[f]||f)) + '</button>';
    }).join('');

    // Col 1: Announcements
    var col1 = '<div class="np-col">' +
      '<p class="np-col__flag" style="color:' + ACC + '">Announcements &mdash; ' + todayLong() + '</p>' +
      '<h2 class="np-headline">Church Bulletin</h2>' +
      '<p class="np-byline" style="font-variant:small-caps;">Events &middot; Announcements &middot; Notices</p>' +
      '<hr class="np-column-rule">' +
      '<div class="lt-filter-bar">' + filterBtns + '</div>' +
      (filtered.length
        ? '<div style="max-height:340px;overflow-y:auto">' + filtered.map(renderAnnouncement).join('') + '</div>'
        : '<div class="lt-empty">No announcements yet.</div>') +
      '<button class="lt-toggle" id="lt-toggle-ann">' + (state.showAddAnn ? '\u2212 Cancel' : '+ New Announcement') + '</button>' +
      (state.showAddAnn ? '<div class="lt-add-form">' +
        '<select id="lt-ann-cat">' + Object.keys(ANN_CATEGORIES).map(function(k){ return '<option value="'+k+'">'+ANN_CATEGORIES[k]+'</option>'; }).join('') + '</select>' +
        '<input id="lt-ann-title" type="text" placeholder="Title *">' +
        '<textarea id="lt-ann-body" placeholder="Details (optional)\u2026"></textarea>' +
        '<input id="lt-ann-event-date" type="date" placeholder="Event date (if applicable)">' +
        '<button class="lt-add-btn" id="lt-save-ann">Post Announcement</button>' +
      '</div>' : '') +
    '</div>';

    // Col 2: Prayer Chain
    var openPrayers  = state.prayers.filter(function(p){ return !p.answered; });
    var answeredCount = state.prayers.filter(function(p){ return p.answered; }).length;
    var col2 = '<div class="np-col">' +
      '<p class="np-col__flag">Prayer Chain</p>' +
      '<h2 class="np-headline" style="font-size:1.45rem;">Prayer Requests</h2>' +
      '<hr class="np-column-rule">' +
      (state.prayers.length > 0
        ? '<p style="font-size:0.78rem;color:var(--ink-muted,#666);margin-bottom:7px">' + openPrayers.length + ' open &middot; ' + answeredCount + ' answered</p>'
        : '') +
      (state.prayers.length
        ? '<div class="lt-prayer-list">' + state.prayers.map(renderPrayer).join('') + '</div>'
        : '<div class="lt-empty">No prayer requests yet.</div>') +
      '<button class="lt-toggle" id="lt-toggle-prayer" style="margin-top:10px">' + (state.showAddPrayer ? '\u2212 Cancel' : '+ Add Prayer Request') + '</button>' +
      (state.showAddPrayer ? '<div class="lt-add-form">' +
        '<input id="lt-prayer-name" type="text" placeholder="Name *">' +
        '<textarea id="lt-prayer-req" placeholder="Prayer request\u2026"></textarea>' +
        '<button class="lt-add-btn" id="lt-save-prayer">Add to Prayer Chain</button>' +
      '</div>' : '') +
    '</div>';

    // Col 3: Pastoral Letter
    var letter = PASTORAL_LETTERS[new Date().getDay() % PASTORAL_LETTERS.length];
    var pastor = (window.HERALD_PASTOR_NAME) ? window.HERALD_PASTOR_NAME : 'Your Pastor';
    var col3 = '<div class="np-col">' +
      '<p class="np-col__flag">A Word from the Pulpit</p>' +
      '<hr class="np-column-rule">' +
      '<div class="lt-pastoral-letter">' +
        '<div class="lt-letter-salutation">' + esc(letter.salutation) + '</div>' +
        '<div class="lt-letter-body">' + esc(letter.body) + '</div>' +
        '<div class="lt-letter-sig">\u2014 ' + esc(pastor) + '</div>' +
      '</div>' +
    '</div>';

    var banner = '<div class="np-banner" style="border-bottom-color:' + ACC + '">' +
      '<p class="np-banner__flag" style="color:' + ACC + '">The Flock Herald &mdash; Announcements &amp; Prayer</p>' +
      '<h2 class="np-banner__headline">' + esc(churchName || 'Church Bulletin') + '</h2>' +
      '<p class="np-banner__deck">Announcements &middot; Events &middot; Prayer chain &middot; Notices</p>' +
    '</div>';

    main.innerHTML = '<div class="np-broadsheet">' + banner +
      '<div class="np-cols" style="grid-template-columns:2.5fr 2fr 1fr">' +
      col1 + col2 + col3 + '</div></div>';

    attachEvents();
  }

  function attachEvents() {
    var main = document.getElementById('panel-prayer') || document.getElementById('section-main');
    if (!main) return;

    main.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action],[id]');
      if (!btn) return;
      var action = btn.dataset.action;
      var id = btn.id;

      if (action === 'filter-ann') { state.annFilter = btn.dataset.filter; render(); return; }
      if (action === 'delete-ann') {
        if (!confirm('Remove this announcement?')) return;
        state.announcements = state.announcements.filter(function(a){ return a.id !== btn.dataset.annId; });
        saveAnnouncements(); render(); return;
      }
      if (action === 'toggle-prayer') {
        var idx = parseInt(btn.dataset.prayerIdx, 10);
        if (state.prayers[idx]) { state.prayers[idx].answered = btn.checked; savePrayers(); render(); } return;
      }
      if (action === 'delete-prayer') {
        var tidx = parseInt(btn.dataset.prayerIdx, 10);
        state.prayers.splice(tidx, 1); savePrayers(); render(); return;
      }

      if (id === 'lt-toggle-ann')    { state.showAddAnn    = !state.showAddAnn;    render(); return; }
      if (id === 'lt-toggle-prayer') { state.showAddPrayer = !state.showAddPrayer; render(); return; }

      if (id === 'lt-save-ann') {
        var title = (document.getElementById('lt-ann-title').value || '').trim();
        if (!title) { alert('Title is required.'); return; }
        var cat       = document.getElementById('lt-ann-cat').value || 'announcement';
        var body      = (document.getElementById('lt-ann-body').value || '').trim();
        var eventDate = document.getElementById('lt-ann-event-date').value || '';
        state.announcements.unshift({ id: 'an' + Date.now(), title: title, category: cat, body: body, eventDate: eventDate, date: todayISO() });
        saveAnnouncements(); state.showAddAnn = false; render(); return;
      }
      if (id === 'lt-save-prayer') {
        var name = (document.getElementById('lt-prayer-name').value || '').trim();
        if (!name) { alert('Name is required.'); return; }
        var req = (document.getElementById('lt-prayer-req').value || '').trim();
        state.prayers.unshift({ id: 'pr' + Date.now(), name: name, request: req, date: todayISO(), answered: false });
        savePrayers(); state.showAddPrayer = false; render(); return;
      }
    });
  }

  render();
  if (window.Nehemiah && typeof Nehemiah.onAuthResolved === 'function') {
    Nehemiah.onAuthResolved(render);
  }

})();
