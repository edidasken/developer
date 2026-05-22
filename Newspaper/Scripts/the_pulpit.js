/**
 * the_pulpit.js — Sermon Prep Section Engine
 *
 * Renders the pulpit/ section (#section-main) as a full Sermon Builder.
 * Display name: "Sermon Prep"   Code name: pulpit / the_pulpit
 * Accent: var(--sec-pulpit,#2e1a4a) (Bishop's Purple)
 *
 * Layout:
 *   COL 1 (2.5fr): Sermon Editor  |  COL 2 (1.5fr): Sermon List  |  COL 3 (1fr): Study Aid
 *
 * Persistence: localStorage('herald_sermons')
 */

(function () {
  'use strict';

  var LS_KEY = 'herald_sermons';
  var ACC = 'var(--sec-pulpit,#2e1a4a)';

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
    return MONTHS[parseInt(p[1],10)-1].slice(0,3) + ' ' + parseInt(p[2],10) + ', ' + p[0];
  }
  function wordCount(text) {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  var SECTION_TYPES = ['Introduction','Main Point','Illustration','Application','Cross-Reference','Conclusion','Altar Call'];

  var state = {
    sermons:    [],
    activeId:   null,
    editSection: -1,
    showNewSermon: false,
  };

  function loadSermons() {
    try { state.sermons = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (_) { state.sermons = []; }
    if (!state.activeId && state.sermons.length) state.activeId = state.sermons[0].id;
  }
  function saveSermons() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state.sermons)); } catch (_) {}
  }
  function getActive() {
    return state.sermons.find(function(s){ return s.id === state.activeId; }) || null;
  }

  var PREACHING_TIPS = [
    'A sermon with one clear proposition is remembered. A sermon with five points is forgotten.',
    'Preach the text. The authority is in the Word, not in the preacher.',
    'Start with the problem, end with the Person. Every sermon ends at the cross.',
    'The illustration exists to open the door to the truth \u2014 not to be the truth.',
    'An application without a command is a suggestion. Give your people something to do.',
    'Never preach a conclusion you haven\u2019t lived yet.',
    'The altar call begins in the sermon, not after it.',
  ];

  function injectStyles() {
    if (document.getElementById('sp-styles')) return;
    var css =
'.sp-sermon-editor{border:1px solid rgba(0,0,0,0.12);border-radius:4px;padding:14px;}' +
'.sp-field{margin-bottom:10px;}' +
'.sp-label{display:block;font-size:0.76rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-muted,#666);margin-bottom:3px;}' +
'.sp-input{width:100%;box-sizing:border-box;padding:6px 9px;font-family:inherit;font-size:0.88rem;border:1px solid rgba(0,0,0,0.2);border-radius:3px;background:var(--paper,#faf6ed);}' +
'.sp-textarea{width:100%;box-sizing:border-box;padding:8px 9px;font-family:inherit;font-size:0.86rem;border:1px solid rgba(0,0,0,0.2);border-radius:3px;background:var(--paper,#faf6ed);resize:vertical;line-height:1.55;}' +
'.sp-sections-list{margin-top:10px;}' +
'.sp-section-item{border:1px solid rgba(0,0,0,0.1);border-radius:3px;padding:8px 10px;margin-bottom:6px;}' +
'.sp-section-type{font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:' + ACC + ';margin-bottom:3px;}' +
'.sp-section-text{font-size:0.84rem;white-space:pre-wrap;word-break:break-word;}' +
'.sp-section-actions{display:flex;gap:4px;margin-top:5px;}' +
'.sp-icon-btn{border:none;background:transparent;cursor:pointer;font-size:0.78rem;padding:2px 6px;border-radius:3px;color:var(--ink-muted,#666);}' +
'.sp-icon-btn:hover{background:rgba(0,0,0,0.08);}' +
'.sp-add-section-row{display:grid;grid-template-columns:1fr auto auto;gap:6px;margin-top:8px;}' +
'.sp-add-section-row select{padding:5px 7px;font-family:inherit;font-size:0.83rem;border:1px solid rgba(0,0,0,0.2);border-radius:3px;background:var(--paper,#faf6ed);}' +
'.sp-add-section-btn{background:' + ACC + ';color:#fff;border:none;border-radius:3px;padding:5px 12px;cursor:pointer;font-family:inherit;font-size:0.83rem;white-space:nowrap;}' +
'.sp-add-section-btn:hover{opacity:0.85;}' +
'.sp-wc{font-size:0.75rem;color:var(--ink-muted,#666);text-align:right;margin-top:3px;}' +
'.sp-sermon-card{border:1px solid rgba(0,0,0,0.1);border-radius:4px;padding:9px 12px;margin-bottom:7px;cursor:pointer;}' +
'.sp-sermon-card:hover{background:rgba(0,0,0,0.04);}' +
'.sp-sermon-card.active{border-color:' + ACC + ';border-width:2px;}' +
'.sp-sermon-title{font-weight:700;font-size:0.88rem;}' +
'.sp-sermon-ref{font-size:0.79rem;color:var(--ink-muted,#666);}' +
'.sp-sermon-date{font-size:0.75rem;color:var(--ink-muted,#666);}' +
'.sp-sermon-meta{display:flex;align-items:center;justify-content:space-between;margin-top:4px;}' +
'.sp-btn{background:' + ACC + ';color:#fff;border:none;border-radius:3px;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:0.83rem;}' +
'.sp-btn:hover{opacity:0.85;}' +
'.sp-btn--outline{background:transparent;border:1px solid rgba(0,0,0,0.2);color:var(--ink,#1a100a);}' +
'.sp-btn--outline:hover{background:rgba(0,0,0,0.06);}' +
'.sp-btn--danger{background:#c0392b;color:#fff;}' +
'.sp-new-form{border:1px solid rgba(0,0,0,0.12);border-radius:4px;padding:12px;margin-bottom:10px;}' +
'.sp-editing-inline{background:var(--paper,#faf6ed);border:1px solid rgba(0,0,0,0.2);border-radius:3px;padding:6px 8px;width:100%;box-sizing:border-box;font-family:inherit;font-size:0.84rem;min-height:80px;resize:vertical;}';
    var el = document.createElement('style'); el.id = 'sp-styles'; el.textContent = css; document.head.appendChild(el);
  }

  function renderSectionItem(sec, idx, activeSermon) {
    return '<div class="sp-section-item">' +
      '<div class="sp-section-type">' + esc(sec.type) + '</div>' +
      '<div class="sp-section-text">' + esc(sec.text) + '</div>' +
      '<div class="sp-section-actions">' +
        '<button class="sp-icon-btn" data-action="edit-section" data-sec-idx="' + idx + '">\u270e Edit</button>' +
        '<button class="sp-icon-btn sp-btn--danger" data-action="delete-section" data-sec-idx="' + idx + '" style="background:transparent;color:#c0392b">\u2715 Remove</button>' +
      '</div>' +
    '</div>';
  }

  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    injectStyles();
    loadSermons();

    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : '';
    var sermon = getActive();
    var tip = PREACHING_TIPS[new Date().getDay() % PREACHING_TIPS.length];

    // Col 1: Sermon Editor
    var editorHtml;
    if (sermon) {
      var sections = sermon.sections || [];
      var totalWC = wordCount(sections.map(function(s){ return s.text; }).join(' '));
      editorHtml =
        '<div class="sp-sermon-editor">' +
        '<div class="sp-field"><label class="sp-label">Title</label>' +
          '<input class="sp-input" id="sp-title" value="' + esc(sermon.title) + '" placeholder="Sermon title"></div>' +
        '<div class="sp-field"><label class="sp-label">Scripture</label>' +
          '<input class="sp-input" id="sp-ref" value="' + esc(sermon.ref || '') + '" placeholder="e.g. John 3:16\u201317"></div>' +
        '<div class="sp-field"><label class="sp-label">Series</label>' +
          '<input class="sp-input" id="sp-series" value="' + esc(sermon.series || '') + '" placeholder="Series name (optional)"></div>' +
        '<div style="display:flex;gap:8px;margin-bottom:10px">' +
          '<button class="sp-btn" id="sp-save-meta">Save</button>' +
          '<button class="sp-btn sp-btn--outline" id="sp-cancel-edit">Cancel</button>' +
        '</div>' +
        '<hr class="np-column-rule" style="margin:10px 0">' +
        '<p class="sp-label">Outline Sections <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:0.75rem;">(' + totalWC + ' words)</span></p>' +
        '<div class="sp-sections-list">' +
          (sections.length ? sections.map(function(sec, i){ return renderSectionItem(sec, i, sermon); }).join('') : '<p style="font-size:0.84rem;color:var(--ink-muted,#666);font-style:italic">No sections yet. Add one below.</p>') +
        '</div>' +
        '<div class="sp-add-section-row">' +
          '<select id="sp-new-sec-type">' + SECTION_TYPES.map(function(t){ return '<option>' + t + '</option>'; }).join('') + '</select>' +
          '<button class="sp-add-section-btn" id="sp-add-section-btn">+ Add Section</button>' +
        '</div>' +
        '<div class="sp-field" style="margin-top:8px"><textarea id="sp-new-sec-text" class="sp-textarea" style="min-height:70px" placeholder="Type your notes for this section\u2026"></textarea></div>' +
        '</div>';
    } else {
      editorHtml = '<div class="sp-sermon-editor" style="text-align:center;padding:30px 14px;">' +
        '<p style="font-size:0.9rem;color:var(--ink-muted,#666);font-style:italic">No sermon selected.<br>Create one from the list.</p>' +
        '</div>';
    }

    var newFormHtml = '';
    if (state.showNewSermon) {
      newFormHtml = '<div class="sp-new-form">' +
        '<div class="sp-field"><label class="sp-label">Title *</label><input class="sp-input" id="sp-new-title" placeholder="Sermon title"></div>' +
        '<div class="sp-field"><label class="sp-label">Scripture</label><input class="sp-input" id="sp-new-ref" placeholder="e.g. Romans 8:1"></div>' +
        '<div class="sp-field"><label class="sp-label">Series</label><input class="sp-input" id="sp-new-series" placeholder="Series (optional)"></div>' +
        '<div style="display:flex;gap:7px">' +
          '<button class="sp-btn" id="sp-create-sermon">Create Sermon</button>' +
          '<button class="sp-btn sp-btn--outline" id="sp-cancel-new">Cancel</button>' +
        '</div>' +
      '</div>';
    }

    var col1 = '<div class="np-col">' +
      '<p class="np-col__flag" style="color:' + ACC + '">Sermon Prep &mdash; ' + todayLong() + '</p>' +
      '<h2 class="np-headline">Sermon Builder</h2>' +
      '<p class="np-byline" style="font-variant:small-caps;">Outline &middot; Notes &middot; Scripture &middot; Application</p>' +
      '<hr class="np-column-rule">' +
      editorHtml +
    '</div>';

    // Col 2: Sermon List
    var sermonCards = state.sermons.map(function(s) {
      var isActive = s.id === state.activeId;
      var wc = wordCount((s.sections || []).map(function(sec){ return sec.text; }).join(' '));
      return '<div class="sp-sermon-card' + (isActive?' active':'') + '" data-action="select-sermon" data-sermon-id="' + esc(s.id) + '">' +
        '<div class="sp-sermon-title">' + esc(s.title) + '</div>' +
        '<div class="sp-sermon-ref">' + esc(s.ref || '') + (s.series ? ' &middot; ' + esc(s.series) : '') + '</div>' +
        '<div class="sp-sermon-meta">' +
          '<span class="sp-sermon-date">' + fmtDate(s.date) + '</span>' +
          '<span style="font-size:0.74rem;color:var(--ink-muted,#666)">' + (s.sections||[]).length + ' sections &middot; ' + wc + ' words</span>' +
        '</div>' +
      '</div>';
    });

    var col2 = '<div class="np-col">' +
      '<p class="np-col__flag">Sermon List</p>' +
      '<h2 class="np-headline" style="font-size:1.45rem;">My Sermons</h2>' +
      '<hr class="np-column-rule">' +
      newFormHtml +
      '<button class="sp-btn' + (state.showNewSermon ? ' sp-btn--outline' : '') + '" id="sp-toggle-new" style="width:100%;margin-bottom:10px">' + (state.showNewSermon ? '\u2212 Cancel' : '+ New Sermon') + '</button>' +
      '<div style="max-height:400px;overflow-y:auto">' +
        (sermonCards.length ? sermonCards.join('') : '<p style="font-size:0.84rem;color:var(--ink-muted,#666);font-style:italic;padding:12px 0">No sermons yet. Create your first.</p>') +
      '</div>' +
      (sermon ? '<button class="sp-btn" style="background:#c0392b;width:100%;margin-top:10px" id="sp-delete-active">Delete This Sermon</button>' : '') +
    '</div>';

    // Col 3: Study Aid
    var col3 = '<div class="np-col">' +
      '<p class="np-col__flag">The Preacher\u2019s Corner</p>' +
      '<hr class="np-column-rule">' +
      '<div class="np-pull-quote" style="border-left-color:' + ACC + '"><p>' + esc(tip) + '</p></div>' +
      '<hr class="np-column-rule">' +
      '<div class="np-body" style="font-size:0.85rem;">' +
        '<p><strong>Word count goals:</strong></p>' +
        '<p>20-min sermon: ~2,500 words<br>30-min sermon: ~3,500 words<br>45-min sermon: ~5,000 words</p>' +
        '<p>Speaking pace: ~125\u2013140 words/minute. Use these as guides, not limits.</p>' +
      '</div>' +
    '</div>';

    var banner = '<div class="np-banner" style="border-bottom-color:' + ACC + '">' +
      '<p class="np-banner__flag" style="color:' + ACC + '">The Flock Herald &mdash; Sermon Prep</p>' +
      '<h2 class="np-banner__headline">' + esc(churchName || 'Sermon Prep') + '</h2>' +
      '<p class="np-banner__deck">Build your sermon outline &middot; Organize sections &middot; Prepare the word</p>' +
    '</div>';

    main.innerHTML = '<div class="np-broadsheet">' + banner +
      '<div class="np-cols" style="grid-template-columns:2.5fr 1.5fr 1fr">' +
      col1 + col2 + col3 + '</div></div>';

    attachEvents();
  }

  function attachEvents() {
    var main = document.getElementById('section-main');
    if (!main) return;

    // Auto-save title/ref/series on input
    ['sp-title','sp-ref','sp-series'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('blur', function() {
        var sermon = getActive();
        if (!sermon) return;
        if (id === 'sp-title')  sermon.title  = el.value.trim() || 'Untitled';
        if (id === 'sp-ref')    sermon.ref    = el.value.trim();
        if (id === 'sp-series') sermon.series = el.value.trim();
        saveSermons();
      });
    });

    main.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action],[id]');
      if (!btn) return;
      var action = btn.dataset.action;
      var id = btn.id;

      if (action === 'select-sermon') {
        state.activeId = btn.dataset.sermonId; render(); return;
      }
      if (action === 'edit-section') {
        state.editSection = parseInt(btn.dataset.secIdx, 10); render(); return;
      }
      if (action === 'delete-section') {
        var sermon2 = getActive(); if (!sermon2) return;
        var idx2 = parseInt(btn.dataset.secIdx, 10);
        sermon2.sections.splice(idx2, 1); saveSermons(); render(); return;
      }

      if (id === 'sp-toggle-new') { state.showNewSermon = !state.showNewSermon; render(); return; }
      if (id === 'sp-cancel-new') { state.showNewSermon = false; render(); return; }
      if (id === 'sp-cancel-edit') { render(); return; }

      if (id === 'sp-create-sermon') {
        var title = (document.getElementById('sp-new-title').value || '').trim();
        if (!title) { alert('Title is required.'); return; }
        var ref    = (document.getElementById('sp-new-ref').value || '').trim();
        var series = (document.getElementById('sp-new-series').value || '').trim();
        var ns = { id: 'sm' + Date.now(), title: title, ref: ref, series: series, date: todayISO(), sections: [] };
        state.sermons.unshift(ns);
        state.activeId = ns.id;
        state.showNewSermon = false;
        saveSermons(); render(); return;
      }
      if (id === 'sp-save-meta') {
        var sermon3 = getActive(); if (!sermon3) return;
        sermon3.title  = (document.getElementById('sp-title').value || '').trim() || 'Untitled';
        sermon3.ref    = (document.getElementById('sp-ref').value || '').trim();
        sermon3.series = (document.getElementById('sp-series').value || '').trim();
        saveSermons(); render(); return;
      }
      if (id === 'sp-add-section-btn') {
        var sermon4 = getActive(); if (!sermon4) return;
        var stype = document.getElementById('sp-new-sec-type').value;
        var stext = (document.getElementById('sp-new-sec-text').value || '').trim();
        if (!stext) { alert('Enter notes for this section.'); return; }
        if (!sermon4.sections) sermon4.sections = [];
        sermon4.sections.push({ type: stype, text: stext });
        saveSermons(); render(); return;
      }
      if (id === 'sp-delete-active') {
        if (!confirm('Delete this sermon? This cannot be undone.')) return;
        state.sermons = state.sermons.filter(function(s){ return s.id !== state.activeId; });
        state.activeId = state.sermons.length ? state.sermons[0].id : null;
        saveSermons(); render(); return;
      }
    });
  }

  render();
  if (window.Nehemiah && typeof Nehemiah.onAuthResolved === 'function') {
    Nehemiah.onAuthResolved(render);
  }

})();
