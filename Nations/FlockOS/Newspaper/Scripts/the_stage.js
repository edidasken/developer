/**
 * the_stage.js — Service Order Section Engine
 *
 * Renders the stage/ section (#section-main) as a full Service Order builder.
 * Display name: "Service Order"   Code name: stage / the_stage
 * Accent: var(--sec-stage,#0c1445) (Vesper Blue)
 *
 * Layout:
 *   COL 1 (3fr): Service Runsheet  |  COL 2 (1.5fr): Stage Notes
 *
 * Persistence: localStorage('herald_service_order'), localStorage('herald_stage_notes')
 */

(function () {
  'use strict';

  var LS_ORDER = 'herald_service_order';
  var LS_NOTES = 'herald_stage_notes';
  var ACC = 'var(--sec-stage,#0c1445)';

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function todayLong() {
    var d = new Date();
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  var ITEM_TYPES = [
    { value:'welcome',    label:'Welcome',     icon:'\ud83d\udcac' },
    { value:'worship',    label:'Worship Song', icon:'\ud83c\udfb5' },
    { value:'prayer',     label:'Prayer',       icon:'\ud83d\ude4f' },
    { value:'scripture',  label:'Scripture',    icon:'\ud83d\udcd6' },
    { value:'sermon',     label:'Sermon',       icon:'\ud83c\udfa4' },
    { value:'offering',   label:'Offering',     icon:'\ufffd' },
    { value:'communion',  label:'Communion',    icon:'\ud83c\udf7e' },
    { value:'announce',   label:'Announcements',icon:'\ud83d\udce2' },
    { value:'response',   label:'Response/Altar',icon:'\u271d' },
    { value:'other',      label:'Other',        icon:'\u2022' },
  ];

  var DEFAULT_ORDER = [
    { id:'d1', type:'welcome',   title:'Welcome & Greeting',   duration:5,  note:'' },
    { id:'d2', type:'worship',   title:'Opening Song',          duration:5,  note:'' },
    { id:'d3', type:'worship',   title:'Worship Song',          duration:5,  note:'' },
    { id:'d4', type:'prayer',    title:'Opening Prayer',        duration:3,  note:'' },
    { id:'d5', type:'scripture', title:'Scripture Reading',     duration:3,  note:'' },
    { id:'d6', type:'sermon',    title:'Sermon',                duration:35, note:'' },
    { id:'d7', type:'response',  title:'Response / Invitation', duration:5,  note:'' },
    { id:'d8', type:'offering',  title:'Offering',              duration:5,  note:'' },
    { id:'d9', type:'announce',  title:'Announcements',         duration:5,  note:'' },
  ];

  var state = {
    items:       [],
    stageNotes:  '',
    showAddItem: false,
    editIdx:     -1,
  };

  function loadOrder() {
    try {
      var raw = localStorage.getItem(LS_ORDER);
      state.items = raw ? JSON.parse(raw) : DEFAULT_ORDER.map(function(i){ return Object.assign({}, i); });
    } catch (_) { state.items = DEFAULT_ORDER.map(function(i){ return Object.assign({}, i); }); }
  }
  function saveOrder() {
    try { localStorage.setItem(LS_ORDER, JSON.stringify(state.items)); } catch (_) {}
  }
  function loadNotes() {
    try { state.stageNotes = localStorage.getItem(LS_NOTES) || ''; } catch (_) { state.stageNotes = ''; }
  }
  function saveNotes(val) {
    try { localStorage.setItem(LS_NOTES, val); } catch (_) {}
  }

  function typeLabel(value) {
    var t = ITEM_TYPES.find(function(t){ return t.value === value; });
    return t ? t.label : value;
  }
  function typeIcon(value) {
    var t = ITEM_TYPES.find(function(t){ return t.value === value; });
    return t ? t.icon : '\u2022';
  }

  function totalMinutes() {
    return state.items.reduce(function(sum, i){ return sum + (parseInt(i.duration,10) || 0); }, 0);
  }
  function fmtTime(mins) {
    if (mins < 60) return mins + ' min';
    var h = Math.floor(mins/60), m = mins%60;
    return h + 'h' + (m ? ' ' + m + 'm' : '');
  }

  function injectStyles() {
    if (document.getElementById('svc-styles')) return;
    var css =
'.svc-table{width:100%;border-collapse:collapse;font-size:0.85rem;}' +
'.svc-table th{text-align:left;padding:5px 8px;border-bottom:2px solid rgba(0,0,0,0.15);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted,#666);}' +
'.svc-table td{padding:7px 8px;border-bottom:1px solid rgba(0,0,0,0.07);vertical-align:middle;}' +
'.svc-table tr:hover td{background:rgba(0,0,0,0.03);}' +
'.svc-type-tag{font-size:0.72rem;font-weight:700;padding:2px 6px;border-radius:3px;background:rgba(0,0,0,0.08);white-space:nowrap;}' +
'.svc-item-title{font-weight:600;}' +
'.svc-item-note{font-size:0.78rem;color:var(--ink-muted,#666);margin-top:2px;}' +
'.svc-dur{color:var(--ink-muted,#666);white-space:nowrap;font-variant-numeric:tabular-nums;}' +
'.svc-row-btns{display:flex;gap:3px;}' +
'.svc-row-btn{border:none;background:transparent;cursor:pointer;padding:2px 5px;border-radius:3px;font-size:0.8rem;color:var(--ink-muted,#666);}' +
'.svc-row-btn:hover{background:rgba(0,0,0,0.07);}' +
'.svc-footer{display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.1);}' +
'.svc-total{font-weight:700;font-size:0.9rem;}' +
'.svc-add-form{margin-top:12px;border-top:1px solid rgba(0,0,0,0.1);padding-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;}' +
'.svc-add-form .svc-full{grid-column:1/-1;}' +
'.svc-add-form input,.svc-add-form select,.svc-add-form textarea{width:100%;box-sizing:border-box;padding:5px 8px;font-family:inherit;font-size:0.83rem;border:1px solid rgba(0,0,0,0.2);border-radius:3px;background:var(--paper,#faf6ed);}' +
'.svc-add-form textarea{resize:vertical;min-height:50px;}' +
'.svc-add-btn{background:var(--sec-stage,#0c1445);color:#fff;border:none;border-radius:3px;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:0.83rem;}' +
'.svc-add-btn:hover{opacity:0.85;}' +
'.svc-toggle{background:transparent;border:1px solid rgba(0,0,0,0.2);border-radius:3px;padding:5px 12px;cursor:pointer;font-family:inherit;font-size:0.82rem;margin-top:8px;}' +
'.svc-toggle:hover{background:rgba(0,0,0,0.06);}' +
'.svc-reset-btn{background:transparent;border:1px solid rgba(0,0,0,0.15);border-radius:3px;padding:4px 10px;cursor:pointer;font-family:inherit;font-size:0.76rem;color:var(--ink-muted,#666);}' +
'.svc-notes-area{width:100%;box-sizing:border-box;min-height:200px;padding:9px;font-family:inherit;font-size:0.85rem;border:1px solid rgba(0,0,0,0.15);border-radius:4px;background:var(--paper,#faf6ed);resize:vertical;line-height:1.55;}' +
'.svc-save-indicator{font-size:0.74rem;color:var(--ink-muted,#666);margin-top:4px;}';
    var el = document.createElement('style'); el.id = 'svc-styles'; el.textContent = css; document.head.appendChild(el);
  }

  function renderRow(item, idx) {
    return '<tr>' +
      '<td><span style="font-size:1rem;">' + typeIcon(item.type) + '</span></td>' +
      '<td>' +
        '<div class="svc-item-title">' + esc(item.title) + '</div>' +
        (item.note ? '<div class="svc-item-note">' + esc(item.note) + '</div>' : '') +
      '</td>' +
      '<td><span class="svc-type-tag">' + esc(typeLabel(item.type)) + '</span></td>' +
      '<td class="svc-dur">' + (item.duration || '–') + ' min</td>' +
      '<td>' +
        '<div class="svc-row-btns">' +
          (idx > 0 ? '<button class="svc-row-btn" data-action="move-up" data-idx="'+idx+'" title="Move up">\u2191</button>' : '<span style="width:22px;display:inline-block"></span>') +
          (idx < state.items.length - 1 ? '<button class="svc-row-btn" data-action="move-down" data-idx="'+idx+'" title="Move down">\u2193</button>' : '<span style="width:22px;display:inline-block"></span>') +
          '<button class="svc-row-btn" data-action="delete-item" data-idx="'+idx+'" title="Remove">\u2715</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }

  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    injectStyles();
    loadOrder(); loadNotes();

    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : '';

    var total = totalMinutes();

    // Col 1: Service Runsheet
    var addFormHtml = '';
    if (state.showAddItem) {
      addFormHtml = '<div class="svc-add-form">' +
        '<div><select id="svc-new-type">' + ITEM_TYPES.map(function(t){ return '<option value="'+t.value+'">'+t.label+'</option>'; }).join('') + '</select></div>' +
        '<div><input id="svc-new-dur" type="number" placeholder="Minutes" min="1" max="120" value="5"></div>' +
        '<div class="svc-full"><input id="svc-new-title" type="text" placeholder="Title *"></div>' +
        '<div class="svc-full"><textarea id="svc-new-note" placeholder="Notes (optional)\u2026"></textarea></div>' +
        '<div class="svc-full"><button class="svc-add-btn" id="svc-save-item">Add to Order</button></div>' +
      '</div>';
    }

    var col1 = '<div class="np-col">' +
      '<p class="np-col__flag" style="color:' + ACC + '">Service Order &mdash; ' + todayLong() + '</p>' +
      '<h2 class="np-headline">Sunday\u2019s Runsheet</h2>' +
      '<p class="np-byline" style="font-variant:small-caps;">Service Order &middot; Production &middot; Stage</p>' +
      '<hr class="np-column-rule">' +
      '<table class="svc-table"><thead><tr>' +
        '<th></th><th>Item</th><th>Type</th><th>Time</th><th></th>' +
      '</tr></thead><tbody>' +
        state.items.map(renderRow).join('') +
      '</tbody></table>' +
      '<div class="svc-footer">' +
        '<span class="svc-total">Total: ' + fmtTime(total) + '</span>' +
        '<button class="svc-reset-btn" id="svc-reset-order">Reset to Default</button>' +
      '</div>' +
      '<button class="svc-toggle" id="svc-toggle-add">' + (state.showAddItem ? '\u2212 Cancel' : '+ Add Item') + '</button>' +
      addFormHtml +
    '</div>';

    // Col 2: Stage Notes
    var col2 = '<div class="np-col">' +
      '<p class="np-col__flag">Stage Notes</p>' +
      '<h2 class="np-headline" style="font-size:1.45rem;">Tech &amp; Stage</h2>' +
      '<hr class="np-column-rule">' +
      '<p style="font-size:0.82rem;color:var(--ink-muted,#666);margin-bottom:6px">Notes for sound, lighting, volunteers, and staging. Auto-saved.</p>' +
      '<textarea id="svc-stage-notes" class="svc-notes-area" placeholder="Sound check at 9:30am&#10;Mics: Pastor + 2 vocalists&#10;Projector: left side&#10;Deacons: ushering positions\u2026">' + esc(state.stageNotes) + '</textarea>' +
      '<div class="svc-save-indicator" id="svc-save-indicator">Saved</div>' +
    '</div>';

    var banner = '<div class="np-banner" style="border-bottom-color:' + ACC + '">' +
      '<p class="np-banner__flag" style="color:' + ACC + '">The Flock Herald &mdash; Service Order</p>' +
      '<h2 class="np-banner__headline">' + esc(churchName || 'Service Order') + '</h2>' +
      '<p class="np-banner__deck">Build Sunday\u2019s runsheet &middot; Stage notes &middot; Production planning</p>' +
    '</div>';

    main.innerHTML = '<div class="np-broadsheet">' + banner +
      '<div class="np-cols" style="grid-template-columns:3fr 1.5fr">' +
      col1 + col2 + '</div></div>';

    attachEvents();
  }

  function attachEvents() {
    var main = document.getElementById('section-main');
    if (!main) return;

    main.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var idx = parseInt(btn.dataset.idx, 10);

      if (action === 'move-up' && idx > 0) {
        var tmp = state.items[idx-1]; state.items[idx-1] = state.items[idx]; state.items[idx] = tmp;
        saveOrder(); render(); return;
      }
      if (action === 'move-down' && idx < state.items.length - 1) {
        var tmp2 = state.items[idx+1]; state.items[idx+1] = state.items[idx]; state.items[idx] = tmp2;
        saveOrder(); render(); return;
      }
      if (action === 'delete-item') {
        state.items.splice(idx, 1); saveOrder(); render(); return;
      }

      if (btn.id === 'svc-toggle-add') { state.showAddItem = !state.showAddItem; render(); return; }
      if (btn.id === 'svc-reset-order') {
        if (!confirm('Reset service order to default template?')) return;
        state.items = DEFAULT_ORDER.map(function(i){ return Object.assign({}, i); });
        saveOrder(); render(); return;
      }
      if (btn.id === 'svc-save-item') {
        var title = (document.getElementById('svc-new-title').value || '').trim();
        if (!title) { alert('Title is required.'); return; }
        var type  = document.getElementById('svc-new-type').value || 'other';
        var dur   = parseInt(document.getElementById('svc-new-dur').value, 10) || 5;
        var note  = (document.getElementById('svc-new-note').value || '').trim();
        state.items.push({ id: 'si' + Date.now(), type: type, title: title, duration: dur, note: note });
        saveOrder(); state.showAddItem = false; render(); return;
      }
    });

    var notesEl = document.getElementById('svc-stage-notes');
    if (notesEl) {
      var saveTimer;
      notesEl.addEventListener('input', function() {
        var indicator = document.getElementById('svc-save-indicator');
        if (indicator) indicator.textContent = 'Saving\u2026';
        clearTimeout(saveTimer);
        var val = notesEl.value;
        saveTimer = setTimeout(function() {
          saveNotes(val);
          state.stageNotes = val;
          if (indicator) indicator.textContent = 'Saved';
        }, 600);
      });
    }
  }

  render();
  if (window.Nehemiah && typeof Nehemiah.onAuthResolved === 'function') {
    Nehemiah.onAuthResolved(render);
  }

})();
