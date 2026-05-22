/**
 * the_harvest_report.js — Outreach Tracker Section Engine
 *
 * Renders the harvest/ section (#section-main) as a full Outreach Tracker.
 * Display name: "Outreach Tracker"   Code name: harvest / the_harvest_report
 * Accent: var(--sec-harvest,#0e2818) (Field Dispatch)
 *
 * Layout:
 *   COL 1 (2.5fr): Conversation Log  |  COL 2 (2fr): Prayer Targets  |  COL 3 (1fr): Stats + Mission
 *
 * Persistence:
 *   localStorage('herald_harvest')     — gospel conversation log
 *   localStorage('herald_pray_targets') — prayer targets
 */

(function () {
  'use strict';

  var LS_HARVEST  = 'herald_harvest';
  var LS_TARGETS  = 'herald_pray_targets';
  var ACC = 'var(--sec-harvest,#0e2818)';

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

  var OUTCOMES = {
    praying:    { label: 'Praying',    color: '#2980b9' },
    interested: { label: 'Interested', color: '#8e44ad' },
    connected:  { label: 'Connected',  color: '#27ae60' },
    declined:   { label: 'Not Open',   color: '#7f8c8d' },
  };

  var state = {
    convos:     [],
    targets:    [],
    showAddConvo:  false,
    showAddTarget: false,
  };

  function loadConvos() {
    try { state.convos = JSON.parse(localStorage.getItem(LS_HARVEST) || '[]'); } catch (_) { state.convos = []; }
  }
  function saveConvos() {
    try { localStorage.setItem(LS_HARVEST, JSON.stringify(state.convos)); } catch (_) {}
  }
  function loadTargets() {
    try { state.targets = JSON.parse(localStorage.getItem(LS_TARGETS) || '[]'); } catch (_) { state.targets = []; }
  }
  function saveTargets() {
    try { localStorage.setItem(LS_TARGETS, JSON.stringify(state.targets)); } catch (_) {}
  }

  var HARVEST_VERSES = [
    { ref:'Matthew 9:37',   text:'The harvest is plentiful, but the laborers are few; therefore pray earnestly to the Lord of the harvest to send out laborers into his harvest.' },
    { ref:'John 4:35',      text:'Do you not say, "There are yet four months, then comes the harvest"? Look, I tell you, lift up your eyes, and see that the fields are white for harvest.' },
    { ref:'Luke 15:7',      text:'Just so, I tell you, there will be more joy in heaven over one sinner who repents than over ninety-nine righteous persons who need no repentance.' },
    { ref:'Romans 10:14',   text:'How then will they call on him in whom they have not believed? And how are they to believe in him of whom they have never heard?' },
    { ref:'Acts 1:8',       text:'You will receive power when the Holy Spirit has come upon you, and you will be my witnesses in Jerusalem and in all Judea and Samaria, and to the end of the earth.' },
    { ref:'2 Cor 5:20',     text:'We are ambassadors for Christ, God making his appeal through us.' },
    { ref:'1 Peter 3:15',   text:'In your hearts honor Christ the Lord as holy, always being prepared to make a defense to anyone who asks you for a reason for the hope that is in you.' },
  ];

  function injectStyles() {
    if (document.getElementById('hr-styles')) return;
    var css =
'.hr-convo{border:1px solid rgba(0,0,0,0.12);border-radius:4px;padding:9px 12px;margin-bottom:7px;position:relative;}' +
'.hr-convo-name{font-weight:700;font-size:0.9rem;}' +
'.hr-convo-notes{font-size:0.83rem;margin:3px 0;color:var(--ink,#1a100a);}' +
'.hr-convo-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:5px;}' +
'.hr-outcome{font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:10px;color:#fff;}' +
'.hr-date{font-size:0.74rem;color:var(--ink-muted,#666);}' +
'.hr-actions{position:absolute;top:7px;right:7px;display:flex;gap:3px;}' +
'.hr-sel{border:1px solid rgba(0,0,0,0.15);border-radius:3px;background:var(--paper,#faf6ed);font-family:inherit;font-size:0.74rem;padding:2px 4px;cursor:pointer;}' +
'.hr-del{border:none;background:transparent;cursor:pointer;font-size:0.8rem;padding:2px 4px;color:var(--ink-muted,#666);}' +
'.hr-del:hover{color:#c00;}' +
'.hr-target{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(0,0,0,0.08);}' +
'.hr-target:last-child{border-bottom:none;}' +
'.hr-target-check{margin-top:2px;cursor:pointer;flex-shrink:0;}' +
'.hr-target-label{flex:1;font-size:0.86rem;}' +
'.hr-target-label.answered{text-decoration:line-through;color:var(--ink-muted,#666);}' +
'.hr-target-del{border:none;background:transparent;cursor:pointer;color:var(--ink-muted,#666);font-size:0.8rem;}' +
'.hr-target-del:hover{color:#c00;}' +
'.hr-target-list{border:1px solid rgba(0,0,0,0.12);border-radius:4px;max-height:280px;overflow-y:auto;}' +
'.hr-add-form{margin-top:12px;border-top:1px solid rgba(0,0,0,0.1);padding-top:10px;}' +
'.hr-add-form input,.hr-add-form select,.hr-add-form textarea{width:100%;box-sizing:border-box;padding:5px 8px;font-family:inherit;font-size:0.83rem;border:1px solid rgba(0,0,0,0.2);border-radius:3px;margin-bottom:5px;background:var(--paper,#faf6ed);}' +
'.hr-add-form textarea{resize:vertical;min-height:55px;}' +
'.hr-add-btn{background:var(--sec-harvest,#0e2818);color:#fff;border:none;border-radius:3px;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:0.83rem;width:100%;}' +
'.hr-add-btn:hover{opacity:0.85;}' +
'.hr-toggle{background:transparent;border:1px solid rgba(0,0,0,0.2);border-radius:3px;padding:5px 12px;cursor:pointer;font-family:inherit;font-size:0.82rem;margin-bottom:8px;width:100%;}' +
'.hr-toggle:hover{background:rgba(0,0,0,0.06);}' +
'.hr-empty{padding:18px;text-align:center;color:var(--ink-muted,#666);font-style:italic;font-size:0.84rem;border:1px solid rgba(0,0,0,0.1);border-radius:4px;}' +
'.hr-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}' +
'.hr-stat{text-align:center;border:1px solid rgba(0,0,0,0.1);border-radius:4px;padding:8px 4px;}' +
'.hr-stat-num{font-size:1.6rem;font-weight:700;color:var(--sec-harvest,#0e2818);line-height:1;}' +
'.hr-stat-lbl{font-size:0.7rem;color:var(--ink-muted,#666);margin-top:3px;}';
    var el = document.createElement('style'); el.id = 'hr-styles'; el.textContent = css; document.head.appendChild(el);
  }

  function renderConvo(c) {
    var oc = OUTCOMES[c.outcome] || { label: c.outcome, color:'#999' };
    return '<div class="hr-convo">' +
      '<div class="hr-actions">' +
        '<select class="hr-sel" data-action="change-outcome" data-convo-id="' + esc(c.id) + '">' +
          Object.keys(OUTCOMES).map(function(k){ return '<option value="'+k+'"'+(c.outcome===k?' selected':'')+'>'+OUTCOMES[k].label+'</option>'; }).join('') +
        '</select>' +
        '<button class="hr-del" data-action="delete-convo" data-convo-id="' + esc(c.id) + '">\u2715</button>' +
      '</div>' +
      '<div class="hr-convo-name">' + esc(c.name) + '</div>' +
      (c.notes ? '<div class="hr-convo-notes">' + esc(c.notes) + '</div>' : '') +
      '<div class="hr-convo-meta">' +
        '<span class="hr-outcome" style="background:' + oc.color + '">' + esc(oc.label) + '</span>' +
        '<span class="hr-date">' + fmtDate(c.date) + '</span>' +
      '</div>' +
    '</div>';
  }

  function renderTarget(t, idx) {
    return '<div class="hr-target">' +
      '<input type="checkbox" class="hr-target-check" data-action="toggle-target" data-target-idx="' + idx + '"' + (t.answered?' checked':'') + '>' +
      '<div class="hr-target-label' + (t.answered?' answered':'') + '">' + esc(t.name) +
        (t.request ? '<div style="font-size:0.78rem;color:var(--ink-muted,#666);margin-top:2px;">' + esc(t.request) + '</div>' : '') +
      '</div>' +
      '<button class="hr-target-del" data-action="delete-target" data-target-idx="' + idx + '">\u2715</button>' +
    '</div>';
  }

  function calcStats() {
    var total = state.convos.length;
    var now = new Date();
    var weekAgo = new Date(now - 7 * 86400000);
    var thisWeek = state.convos.filter(function(c) { return c.date && new Date(c.date + 'T00:00:00') >= weekAgo; }).length;
    var connected = state.convos.filter(function(c) { return c.outcome === 'connected'; }).length;
    var open = state.targets.filter(function(t) { return !t.answered; }).length;
    return { total: total, thisWeek: thisWeek, connected: connected, open: open };
  }

  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    injectStyles();
    loadConvos(); loadTargets();

    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : '';
    var stats = calcStats();

    // Col 1: Conversation Log
    var col1 = '<div class="np-col">' +
      '<p class="np-col__flag" style="color:' + ACC + '">Outreach Tracker &mdash; ' + todayLong() + '</p>' +
      '<h2 class="np-headline">Conversation Log</h2>' +
      '<p class="np-byline" style="font-variant:small-caps;">Gospel Conversations &middot; Follow-Up &middot; Decisions</p>' +
      '<hr class="np-column-rule">' +
      (state.convos.length
        ? '<div style="max-height:340px;overflow-y:auto;">' + state.convos.map(renderConvo).join('') + '</div>'
        : '<div class="hr-empty">No conversations logged yet.<br>Record your first gospel conversation below.</div>') +
      '<button class="hr-toggle" id="hr-toggle-convo">' + (state.showAddConvo ? '\u2212 Cancel' : '+ Log Conversation') + '</button>' +
      (state.showAddConvo ? '<div class="hr-add-form">' +
        '<input id="hr-convo-name" type="text" placeholder="Person\'s name *">' +
        '<textarea id="hr-convo-notes" placeholder="Notes on the conversation\u2026"></textarea>' +
        '<select id="hr-convo-outcome">' + Object.keys(OUTCOMES).map(function(k){ return '<option value="'+k+'">'+OUTCOMES[k].label+'</option>'; }).join('') + '</select>' +
        '<button class="hr-add-btn" id="hr-save-convo">Save Conversation</button>' +
      '</div>' : '') +
    '</div>';

    // Col 2: Prayer Targets
    var col2 = '<div class="np-col">' +
      '<p class="np-col__flag">Prayer Targets</p>' +
      '<h2 class="np-headline" style="font-size:1.45rem;">Unsaved Neighbors</h2>' +
      '<hr class="np-column-rule">' +
      (state.targets.length
        ? '<div class="hr-target-list">' + state.targets.map(renderTarget).join('') + '</div>'
        : '<div class="hr-empty">No prayer targets yet.</div>') +
      '<button class="hr-toggle" id="hr-toggle-target" style="margin-top:10px">' + (state.showAddTarget ? '\u2212 Cancel' : '+ Add Prayer Target') + '</button>' +
      (state.showAddTarget ? '<div class="hr-add-form">' +
        '<input id="hr-target-name" type="text" placeholder="Name *">' +
        '<input id="hr-target-request" type="text" placeholder="Prayer request or context">' +
        '<button class="hr-add-btn" id="hr-save-target">Add Target</button>' +
      '</div>' : '') +
    '</div>';

    // Col 3: Stats + verse
    var verse = HARVEST_VERSES[new Date().getDay() % HARVEST_VERSES.length];
    var col3 = '<div class="np-col">' +
      '<p class="np-col__flag">This Week</p>' +
      '<div class="hr-stats">' +
        '<div class="hr-stat"><div class="hr-stat-num">' + stats.total + '</div><div class="hr-stat-lbl">Total Convos</div></div>' +
        '<div class="hr-stat"><div class="hr-stat-num">' + stats.thisWeek + '</div><div class="hr-stat-lbl">This Week</div></div>' +
        '<div class="hr-stat"><div class="hr-stat-num">' + stats.connected + '</div><div class="hr-stat-lbl">Connected</div></div>' +
        '<div class="hr-stat"><div class="hr-stat-num">' + stats.open + '</div><div class="hr-stat-lbl">Praying For</div></div>' +
      '</div>' +
      '<hr class="np-column-rule">' +
      '<div class="np-pull-quote" style="border-left-color:' + ACC + '">' +
        '<p>\u201c' + esc(verse.text) + '\u201d</p>' +
        '<footer>' + esc(verse.ref) + ' (ESV)</footer>' +
      '</div>' +
    '</div>';

    var banner = '<div class="np-banner" style="border-bottom-color:' + ACC + '">' +
      '<p class="np-banner__flag" style="color:' + ACC + '">The Flock Herald &mdash; Outreach Tracker</p>' +
      '<h2 class="np-banner__headline">' + esc(churchName || 'Outreach Tracker') + '</h2>' +
      '<p class="np-banner__deck">Gospel conversations &middot; Prayer targets &middot; The harvest report</p>' +
    '</div>';

    main.innerHTML = '<div class="np-broadsheet">' + banner +
      '<div class="np-cols" style="grid-template-columns:2.5fr 2fr 1fr">' +
      col1 + col2 + col3 + '</div></div>';

    attachEvents();
  }

  function attachEvents() {
    var main = document.getElementById('section-main');
    if (!main) return;

    main.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;

      if (action === 'delete-convo') {
        if (!confirm('Delete this conversation log?')) return;
        state.convos = state.convos.filter(function(c){ return c.id !== btn.dataset.convoId; });
        saveConvos(); render(); return;
      }
      if (action === 'toggle-target') {
        var idx = parseInt(btn.dataset.targetIdx, 10);
        if (state.targets[idx]) { state.targets[idx].answered = btn.checked; saveTargets(); render(); } return;
      }
      if (action === 'delete-target') {
        var tidx = parseInt(btn.dataset.targetIdx, 10);
        state.targets.splice(tidx, 1); saveTargets(); render(); return;
      }
      if (btn.id === 'hr-toggle-convo')   { state.showAddConvo  = !state.showAddConvo;  render(); return; }
      if (btn.id === 'hr-toggle-target')  { state.showAddTarget = !state.showAddTarget; render(); return; }
      if (btn.id === 'hr-save-convo') {
        var name = (document.getElementById('hr-convo-name').value || '').trim();
        if (!name) { alert('Name is required.'); return; }
        var notes   = (document.getElementById('hr-convo-notes').value || '').trim();
        var outcome = document.getElementById('hr-convo-outcome').value || 'praying';
        state.convos.unshift({ id: 'hv' + Date.now(), name: name, notes: notes, outcome: outcome, date: todayISO() });
        saveConvos(); state.showAddConvo = false; render(); return;
      }
      if (btn.id === 'hr-save-target') {
        var tname = (document.getElementById('hr-target-name').value || '').trim();
        if (!tname) { alert('Name is required.'); return; }
        var req = (document.getElementById('hr-target-request').value || '').trim();
        state.targets.push({ id: 'pt' + Date.now(), name: tname, request: req, answered: false });
        saveTargets(); state.showAddTarget = false; render(); return;
      }
    });

    main.addEventListener('change', function(e) {
      var sel = e.target.closest('[data-action="change-outcome"]');
      if (!sel) return;
      var cid = sel.dataset.convoId;
      var c = state.convos.find(function(x){ return x.id === cid; });
      if (c) { c.outcome = sel.value; saveConvos(); render(); }
    });
  }

  render();
  if (window.Nehemiah && typeof Nehemiah.onAuthResolved === 'function') {
    Nehemiah.onAuthResolved(render);
  }

})();
