/**
 * the_bulletin.js — Care Board Section Engine
 *
 * Renders the gatehouse/ section (#section-main) as a full Care Board.
 * Display name: "Care Board"   Code name: gatehouse / the_bulletin
 * Accent: var(--sec-gatehouse, #3d1818) (Crimson Notice)
 *
 * Layout:
 *   COL 1 (2.5fr): Care Cards  |  COL 2 (2fr): Pastoral To-Dos  |  COL 3 (1fr): Care Scripture
 *
 * Persistence:
 *   localStorage('herald_care_cards')
 *   localStorage('herald_care_todos')
 */

(function () {
  'use strict';

  var LS_CARDS = 'herald_care_cards';
  var LS_TODOS = 'herald_care_todos';
  var ACC = 'var(--sec-gatehouse,#3d1818)';

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function todayLong() {
    var d = new Date();
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  function todayISO() {
    var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    return MONTHS[parseInt(p[1],10)-1].slice(0,3) + ' ' + parseInt(p[2],10) + ', ' + p[0];
  }

  var STATUS_LABELS = { active:'Active', praying:'Praying', resolved:'Resolved', closed:'Closed' };
  var STATUS_COLORS = { active:'#c0392b', praying:'#2980b9', resolved:'#27ae60', closed:'#7f8c8d' };

  var state = {
    cards: [],
    todos: [],
    cardFilter: 'all',
    showAddCard: false,
    showAddTodo: false,
  };

  function loadCards() {
    try { state.cards = JSON.parse(localStorage.getItem(LS_CARDS) || '[]'); } catch (_) { state.cards = []; }
  }
  function saveCards() {
    try { localStorage.setItem(LS_CARDS, JSON.stringify(state.cards)); } catch (_) {}
  }
  function loadTodos() {
    try { state.todos = JSON.parse(localStorage.getItem(LS_TODOS) || '[]'); } catch (_) { state.todos = []; }
  }
  function saveTodos() {
    try { localStorage.setItem(LS_TODOS, JSON.stringify(state.todos)); } catch (_) {}
  }

  var CARE_SCRIPTURES = [
    { ref:'Galatians 6:2',   text:'Bear one another\u2019s burdens, and so fulfill the law of Christ.' },
    { ref:'James 5:16',      text:'Confess your sins to one another and pray for one another, that you may be healed.' },
    { ref:'Romans 12:15',    text:'Rejoice with those who rejoice, weep with those who weep.' },
    { ref:'1 Peter 5:7',     text:'Casting all your anxieties on him, because he cares for you.' },
    { ref:'Hebrews 10:24',   text:'Let us consider how to stir up one another to love and good works.' },
    { ref:'Proverbs 17:17',  text:'A friend loves at all times, and a brother is born for a time of adversity.' },
    { ref:'Matthew 25:36',   text:'I was sick and you visited me, I was in prison and you came to me.' },
  ];

  function injectStyles() {
    if (document.getElementById('cb-styles')) return;
    var css =
'.cb-filter-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}' +
'.cb-filter-btn{border:1px solid rgba(0,0,0,0.2);border-radius:3px;background:transparent;padding:4px 10px;cursor:pointer;font-family:inherit;font-size:0.78rem;}' +
'.cb-filter-btn.active{background:var(--sec-gatehouse,#3d1818);color:#fff;border-color:transparent;}' +
'.cb-card-list{max-height:320px;overflow-y:auto;}' +
'.cb-card{border:1px solid rgba(0,0,0,0.12);border-radius:4px;padding:10px 12px;margin-bottom:8px;position:relative;}' +
'.cb-card-name{font-weight:700;font-size:0.9rem;}' +
'.cb-card-need{font-size:0.84rem;margin:3px 0;}' +
'.cb-card-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;}' +
'.cb-status-badge{font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:10px;color:#fff;}' +
'.cb-card-date{font-size:0.75rem;color:var(--ink-muted,#666);}' +
'.cb-card-assigned{font-size:0.75rem;color:var(--ink-muted,#666);}' +
'.cb-card-actions{position:absolute;top:8px;right:8px;display:flex;gap:4px;}' +
'.cb-icon-btn{border:none;background:transparent;cursor:pointer;font-size:0.8rem;padding:2px 5px;border-radius:3px;}' +
'.cb-icon-btn:hover{background:rgba(0,0,0,0.08);}' +
'.cb-add-form{margin-top:12px;border-top:1px solid rgba(0,0,0,0.1);padding-top:10px;}' +
'.cb-add-form input,.cb-add-form select,.cb-add-form textarea{width:100%;box-sizing:border-box;padding:5px 8px;font-family:inherit;font-size:0.83rem;border:1px solid rgba(0,0,0,0.2);border-radius:3px;margin-bottom:5px;background:var(--paper,#faf6ed);}' +
'.cb-add-form textarea{resize:vertical;min-height:60px;}' +
'.cb-add-btn{background:var(--sec-gatehouse,#3d1818);color:#fff;border:none;border-radius:3px;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:0.83rem;width:100%;}' +
'.cb-add-btn:hover{opacity:0.85;}' +
'.cb-toggle-btn{background:transparent;border:1px solid rgba(0,0,0,0.2);border-radius:3px;padding:5px 12px;cursor:pointer;font-family:inherit;font-size:0.82rem;margin-bottom:8px;width:100%;}' +
'.cb-toggle-btn:hover{background:rgba(0,0,0,0.06);}' +
'.cb-todo-list{max-height:280px;overflow-y:auto;}' +
'.cb-todo-item{display:flex;align-items:flex-start;gap:8px;padding:7px 10px;border-bottom:1px solid rgba(0,0,0,0.08);}' +
'.cb-todo-item:last-child{border-bottom:none;}' +
'.cb-todo-check{margin-top:2px;cursor:pointer;flex-shrink:0;}' +
'.cb-todo-label{flex:1;font-size:0.86rem;}' +
'.cb-todo-label.done{text-decoration:line-through;color:var(--ink-muted,#666);}' +
'.cb-todo-due{font-size:0.75rem;color:var(--ink-muted,#666);}' +
'.cb-todo-remove{border:none;background:transparent;cursor:pointer;color:var(--ink-muted,#666);font-size:0.8rem;}' +
'.cb-todo-remove:hover{color:#c00;}' +
'.cb-empty{padding:20px;text-align:center;color:var(--ink-muted,#666);font-style:italic;font-size:0.84rem;border:1px solid rgba(0,0,0,0.1);border-radius:4px;}';
    var el = document.createElement('style'); el.id = 'cb-styles'; el.textContent = css; document.head.appendChild(el);
  }

  function renderCard(card) {
    var sc = STATUS_COLORS[card.status] || '#999';
    var sl = STATUS_LABELS[card.status] || card.status;
    return '<div class="cb-card" data-card-id="' + esc(card.id) + '">' +
      '<div class="cb-card-actions">' +
        '<select class="cb-icon-btn" data-action="change-status" data-card-id="' + esc(card.id) + '" title="Change status">' +
          Object.keys(STATUS_LABELS).map(function(k){ return '<option value="'+k+'"'+(card.status===k?' selected':'')+'>'+STATUS_LABELS[k]+'</option>'; }).join('') +
        '</select>' +
        '<button class="cb-icon-btn" data-action="delete-card" data-card-id="' + esc(card.id) + '" title="Delete">\u2715</button>' +
      '</div>' +
      '<div class="cb-card-name">' + esc(card.name) + '</div>' +
      '<div class="cb-card-need">' + esc(card.need) + '</div>' +
      '<div class="cb-card-meta">' +
        '<span class="cb-status-badge" style="background:' + sc + '">' + esc(sl) + '</span>' +
        (card.assigned ? '<span class="cb-card-assigned">' + esc(card.assigned) + '</span>' : '') +
        '<span class="cb-card-date">' + fmtDate(card.date) + '</span>' +
      '</div>' +
    '</div>';
  }

  function renderTodo(todo, idx) {
    return '<div class="cb-todo-item" data-todo-idx="' + idx + '">' +
      '<input type="checkbox" class="cb-todo-check" data-action="toggle-todo" data-todo-idx="' + idx + '"' + (todo.done?' checked':'') + '>' +
      '<div class="cb-todo-label' + (todo.done?' done':'') + '">' +
        esc(todo.task) +
        (todo.due ? '<div class="cb-todo-due">Due ' + fmtDate(todo.due) + '</div>' : '') +
      '</div>' +
      '<button class="cb-todo-remove" data-action="delete-todo" data-todo-idx="' + idx + '">\u2715</button>' +
    '</div>';
  }

  function render() {
    var main = document.getElementById('section-main');
    if (!main) return;
    injectStyles();
    loadCards(); loadTodos();

    var churchName = (window.HERALD_CHURCH_NAME && window.HERALD_CHURCH_NAME !== 'The Flock Herald')
      ? window.HERALD_CHURCH_NAME : '';

    var filtered = state.cardFilter === 'all' ? state.cards
      : state.cards.filter(function(c){ return c.status === state.cardFilter; });

    var filterBtns = ['all','active','praying','resolved','closed'].map(function(f){
      return '<button class="cb-filter-btn' + (state.cardFilter===f?' active':'') + '" data-action="filter-cards" data-filter="' + f + '">' +
        (f==='all' ? 'All (' + state.cards.length + ')' : (STATUS_LABELS[f]||f)) + '</button>';
    }).join('');

    // Col 1: Care Cards
    var col1 = '<div class="np-col">' +
      '<p class="np-col__flag" style="color:' + ACC + '">Care Board &mdash; ' + todayLong() + '</p>' +
      '<h2 class="np-headline">Care Cards</h2>' +
      '<p class="np-byline" style="font-variant:small-caps;">Pastoral Care &middot; Prayer &middot; Follow-Up</p>' +
      '<hr class="np-column-rule">' +
      '<div class="cb-filter-bar">' + filterBtns + '</div>' +
      '<div class="cb-card-list">' +
        (filtered.length ? filtered.map(renderCard).join('') : '<div class="cb-empty">No care cards' + (state.cardFilter!=='all'?' with status &ldquo;'+STATUS_LABELS[state.cardFilter]+'&rdquo;':'') + '.</div>') +
      '</div>' +
      '<button class="cb-toggle-btn" id="cb-toggle-add-card">' + (state.showAddCard ? '&minus; Cancel' : '+ New Care Card') + '</button>' +
      (state.showAddCard ? [
        '<div class="cb-add-form">',
        '  <input id="cb-card-name" type="text" placeholder="Person\u2019s name *">',
        '  <textarea id="cb-card-need" placeholder="Need or situation *"></textarea>',
        '  <input id="cb-card-assigned" type="text" placeholder="Assigned to (optional)">',
        '  <select id="cb-card-status">' + Object.keys(STATUS_LABELS).map(function(k){return '<option value="'+k+'">'+STATUS_LABELS[k]+'</option>';}).join('') + '</select>',
        '  <button class="cb-add-btn" id="cb-save-card-btn">Save Care Card</button>',
        '</div>',
      ].join('') : '') +
    '</div>';

    // Col 2: Pastoral To-Dos
    var col2 = '<div class="np-col">' +
      '<p class="np-col__flag">Pastoral To-Dos</p>' +
      '<h2 class="np-headline" style="font-size:1.45rem;">Follow-Up Tasks</h2>' +
      '<hr class="np-column-rule">' +
      '<div class="cb-todo-list">' +
        (state.todos.length ? state.todos.map(renderTodo).join('') : '<div class="cb-empty">No tasks yet.</div>') +
      '</div>' +
      '<button class="cb-toggle-btn" id="cb-toggle-add-todo" style="margin-top:10px">' + (state.showAddTodo ? '&minus; Cancel' : '+ New Task') + '</button>' +
      (state.showAddTodo ? [
        '<div class="cb-add-form">',
        '  <input id="cb-todo-task" type="text" placeholder="Task or follow-up *">',
        '  <input id="cb-todo-due" type="date" placeholder="Due date">',
        '  <button class="cb-add-btn" id="cb-save-todo-btn">Add Task</button>',
        '</div>',
      ].join('') : '') +
    '</div>';

    // Col 3: Care Scripture
    var sc = CARE_SCRIPTURES[new Date().getDay() % CARE_SCRIPTURES.length];
    var col3 = '<div class="np-col">' +
      '<p class="np-col__flag">The Shepherd\u2019s Heart</p>' +
      '<div class="np-pull-quote" style="border-left-color:' + ACC + '">' +
        '<p>\u201c' + esc(sc.text) + '\u201d</p>' +
        '<footer>' + esc(sc.ref) + ' (ESV)</footer>' +
      '</div>' +
      '<hr class="np-column-rule">' +
      '<div class="np-body" style="font-size:0.87rem;">' +
        '<p>Pastoral care is not a program \u2014 it is the shepherd going after the one. Keep this board current. A care card is a commitment to return.</p>' +
      '</div>' +
    '</div>';

    var banner = '<div class="np-banner" style="border-bottom-color:' + ACC + '">' +
      '<p class="np-banner__flag" style="color:' + ACC + '">The Flock Herald &mdash; Care Board</p>' +
      '<h2 class="np-banner__headline">' + esc(churchName || 'Care Board') + '</h2>' +
      '<p class="np-banner__deck">Pastoral care cards &middot; Follow-up tasks &middot; Prayer tracking</p>' +
    '</div>';

    main.innerHTML = '<div class="np-broadsheet">' + banner +
      '<div class="np-cols" style="grid-template-columns:2.5fr 2fr 1fr">' +
      col1 + col2 + col3 +
      '</div></div>';

    attachEvents();
  }

  function attachEvents() {
    var main = document.getElementById('section-main');
    if (!main) return;

    main.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;

      if (action === 'filter-cards') {
        state.cardFilter = btn.dataset.filter; render(); return;
      }
      if (action === 'delete-card') {
        if (!confirm('Delete this care card?')) return;
        state.cards = state.cards.filter(function(c){ return c.id !== btn.dataset.cardId; });
        saveCards(); render(); return;
      }
      if (action === 'toggle-todo') {
        var idx = parseInt(btn.dataset.todoIdx, 10);
        if (state.todos[idx]) { state.todos[idx].done = btn.checked; saveTodos(); render(); } return;
      }
      if (action === 'delete-todo') {
        var tidx = parseInt(btn.dataset.todoIdx, 10);
        state.todos.splice(tidx, 1); saveTodos(); render(); return;
      }

      if (btn.id === 'cb-toggle-add-card') { state.showAddCard = !state.showAddCard; render(); return; }
      if (btn.id === 'cb-toggle-add-todo') { state.showAddTodo = !state.showAddTodo; render(); return; }
      if (btn.id === 'cb-save-card-btn') {
        var name = (document.getElementById('cb-card-name').value || '').trim();
        var need = (document.getElementById('cb-card-need').value || '').trim();
        if (!name || !need) { alert('Name and need are required.'); return; }
        var assigned = (document.getElementById('cb-card-assigned').value || '').trim();
        var status   = document.getElementById('cb-card-status').value || 'active';
        state.cards.unshift({ id: 'cc' + Date.now(), name: name, need: need, assigned: assigned, status: status, date: todayISO() });
        saveCards(); state.showAddCard = false; render(); return;
      }
      if (btn.id === 'cb-save-todo-btn') {
        var task = (document.getElementById('cb-todo-task').value || '').trim();
        if (!task) { alert('Please enter a task.'); return; }
        var due = document.getElementById('cb-todo-due').value || '';
        state.todos.push({ id: 'td' + Date.now(), task: task, due: due, done: false });
        saveTodos(); state.showAddTodo = false; render(); return;
      }
    });

    // Status change on care cards (select element)
    main.addEventListener('change', function(e) {
      var sel = e.target.closest('[data-action="change-status"]');
      if (!sel) return;
      var cid = sel.dataset.cardId;
      var card = state.cards.find(function(c){ return c.id === cid; });
      if (card) { card.status = sel.value; saveCards(); render(); }
    });
  }

  render();
  if (window.Nehemiah && typeof Nehemiah.onAuthResolved === 'function') {
    Nehemiah.onAuthResolved(render);
  }

})();
