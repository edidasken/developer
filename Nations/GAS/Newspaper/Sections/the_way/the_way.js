/* ═══════════════════════════════════════════════════════════════════════════
   the_way.js — Section 2: The Way
   Newspaper controller. Each gospel module is presented as a broadsheet
   story on the page. Clicking a headline opens the full module in the
   right drawer. No sidebar nav — this is a newspaper, not a SPA.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Story manifest — defines what appears on the page and in what order ── */
  /* kicker format: "§ N · CATEGORY · SUBJECT"                                */
  var STORIES = [
    /* Lead story — full-width with drop cap */
    {
      mod:       'the_gospel_reading',
      section:   1,
      category:  'TODAY\'S SCRIPTURE READINGS',
      lead:      true,
      accent:    '#059669',
    },
    /* Main column stories */
    {
      mod:       'the_gospel_devotionals',
      section:   2,
      category:  'DEVOTIONAL OF THE DAY',
      accent:    '#8B7028',
    },
    {
      mod:       'the_gospel_missions',
      section:   3,
      category:  'MISSIONS REPORT',
      accent:    '#7eaacc',
    },
    {
      mod:       'the_gospel_theology',
      section:   4,
      category:  'THEOLOGY CORNER',
      accent:    '#946B1C',
    },
    {
      mod:       'the_gospel_apologetics',
      section:   5,
      category:  'APOLOGETICS · ANSWERS TO HARD QUESTIONS',
      accent:    '#6b5b9a',
    },
    {
      mod:       'the_gospel_heart',
      section:   6,
      category:  'HEART CHECK',
      accent:    '#c0445e',
    },
    {
      mod:       'the_gospel_quizzes',
      section:   7,
      category:  'THE DAILY QUIZ · TEST YOUR KNOWLEDGE',
      accent:    '#059669',
    },
    {
      mod:       'the_gospel_genealogy',
      section:   8,
      category:  'PERSON OF SCRIPTURE',
      accent:    '#7eaacc',
    },
    {
      mod:       'the_gospel_invitation',
      section:   9,
      category:  'THE INVITATION · COME TO CHRIST',
      accent:    '#7eaacc',
      invite:    true,
    },
  ];

  /* ── SVG icon helper (24×24 Lucide-style) ─────────────────────────────────── */
  var _S = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

  /* ── Aside strip modules (col 3) ─────────────────────────────────────────── */
  var ASIDE_MODULES = [
    { mod: 'the_gospel_psalms',        label: 'Psalm of the Day',     accent: '#8B7028',
      svg: '<svg ' + _S + '><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' },
    { mod: 'the_gospel_reading',       label: "Today's Reading",      accent: '#059669',
      svg: '<svg ' + _S + '><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
    { mod: 'the_gospel_courses',       label: 'Courses',              accent: '#6b5b9a',
      svg: '<svg ' + _S + '><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>' },
    { mod: 'the_gospel_teaching_plans',label: 'Teaching Plans',       accent: '#7eaacc',
      svg: '<svg ' + _S + '><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
    { mod: 'the_gospel_counseling',    label: 'Counseling',           accent: '#c0445e',
      svg: '<svg ' + _S + '><path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.66l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21l8.84-8.62a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
    { mod: 'the_gospel_mirror',        label: "Shepherd's Mirror",    accent: '#946B1C',
      svg: '<svg ' + _S + '><rect x="3" y="2" width="18" height="20" rx="3"/><path d="M9 22v-4h6v4"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>' },
    { mod: 'the_gospel_lexicon',       label: 'Lexicon',              accent: '#059669',
      svg: '<svg ' + _S + '><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
    { mod: 'the_gospel_library',       label: 'Library',              accent: '#7eaacc',
      svg: '<svg ' + _S + '><path d="M12 6.25V19.25M12 6.25C10.83 5.48 9.25 5 7.5 5S4.17 5.48 3 6.25V19.25C4.17 18.48 5.75 18 7.5 18S10.83 18.48 12 19.25M12 6.25C13.17 5.48 14.75 5 16.5 5S19.83 5.48 21 6.25V19.25C19.83 18.48 18.25 18 16.5 18S13.17 18.48 12 19.25"/></svg>' },
    { mod: 'the_gospel_journal',       label: 'Journal',              accent: '#8B7028',
      svg: '<svg ' + _S + '><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' },
    { mod: 'the_gospel_analytics',     label: 'My Progress',          accent: '#946B1C',
      svg: '<svg ' + _S + '><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
    { mod: 'the_gospel_certificates',  label: 'Certificates',         accent: '#059669',
      svg: '<svg ' + _S + '><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>' },
    { mod: 'the_gospel_sermons',       label: 'Sermons',              accent: '#7eaacc',
      svg: '<svg ' + _S + '><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>' },
    { mod: 'the_gospel_why',           label: 'Why This?',            accent: '#6b5b9a',
      svg: '<svg ' + _S + '><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
  ];

  /* ── Module cache ────────────────────────────────────────────────────────── */
  var _modCache  = {};
  var _unmount   = null;

  /* ── DOM refs ────────────────────────────────────────────────────────────── */
  var $main  = document.getElementById('way-main');
  var $aside = document.getElementById('way-aside');

  /* ══════════════════════════════════════════════════════════════════════════
     BUILD THE PAGE
     ══════════════════════════════════════════════════════════════════════════ */
  function buildPage() {
    /* Clear loading state */
    $main.innerHTML = '';

    /* Build all stories concurrently */
    STORIES.forEach(function (story) {
      var $placeholder = document.createElement('div');
      $placeholder.className = 'way-story-loading';
      $main.appendChild($placeholder);

      _loadStory(story, $placeholder);
    });

    /* Build aside strip */
    buildAside();
  }

  /* ── Load a story and inject it into the placeholder ─────────────────────── */
  function _loadStory(story, $placeholder) {
    _importMod(story.mod)
      .then(function (mod) {
        var $story = _buildStoryEl(story, mod);
        $placeholder.parentNode.replaceChild($story, $placeholder);
      })
      .catch(function () {
        $placeholder.parentNode.removeChild($placeholder);
      });
  }

  /* ── Build a story DOM element from a loaded module ─────────────────────── */
  function _buildStoryEl(story, mod) {
    var accent = mod.accent || story.accent || 'var(--accent)';
    var title  = mod.title  || 'Untitled';
    var desc   = mod.description || '';

    /* Teaser: up to 2 sentences from description */
    var teaser = _teaser(desc, 2);

    var $art = document.createElement('article');
    $art.className = story.lead ? 'story story--lead story--full' : 'story';
    $art.style.setProperty('--story-accent', accent);

    /* Section kicker */
    var kicker = '\u00a7 ' + story.section + ' \u00b7 ' + story.category;
    $art.innerHTML =
      '<p class="story-kicker" style="color:' + esc(accent) + '">' + esc(kicker) + '</p>'
      + '<h2 class="story-hed">'
      +   '<button class="story-hed-btn" type="button" data-mod="' + esc(story.mod) + '"'
      +     (story.invite ? ' data-invite="1"' : '')
      +   '>'
      +     esc(title)
      +   '</button>'
      + '</h2>'
      + (desc ? '<p class="story-deck">' + esc(_teaser(desc, 1)) + '</p>' : '')
      + '<p class="story-byline">' + esc(_dateByline()) + '</p>'
      + (story.lead ? '<div class="story-body story-body--lead story-dropcap">' : '<div class="story-body">')
      +   esc(teaser)
      + '</div>'
      + '<hr class="story-rule">'
      + '<p class="story-readmore">'
      +   '<button class="story-readmore-btn" type="button" data-mod="' + esc(story.mod) + '"'
      +     (story.invite ? ' data-invite="1"' : '')
      +   '>'
      +     'Open ' + esc(title) + ' \u2192'
      +   '</button>'
      + '</p>';

    /* Wire headline + read-more buttons to open drawer */
    $art.querySelectorAll('[data-mod]').forEach(function ($btn) {
      $btn.addEventListener('click', function () {
        openModule(story.mod, !!story.invite, title);
      });
    });

    return $art;
  }

  /* ── Open full module in drawer ──────────────────────────────────────────── */
  function openModule(modName, isInvite, title) {
    /* teardown previous mount */
    if (typeof _unmount === 'function') {
      try { _unmount(); } catch (_e) {}
      _unmount = null;
    }

    var drawerTitle = title || modName.replace('the_gospel_', '').replace(/_/g, ' ');

    /* Show drawer with loading state */
    window.FlockGates.openDrawer(
      drawerTitle,
      '<div class="grow-skel-grid">' + _skels(3) + '</div>'
    );

    _importMod(modName)
      .then(function (mod) {
        var accent = mod.accent || 'var(--accent)';
        var $body  = document.querySelector('.drawer-body');
        if (!$body) return;

        /* Apply accent to drawer body scope */
        $body.style.setProperty('--grow-accent', accent);

        /* Render + mount */
        $body.innerHTML = (typeof mod.render === 'function')
          ? mod.render()
          : '<p style="padding:1rem;color:var(--ink-muted)">No content available.</p>';

        if (typeof mod.mount === 'function') {
          try {
            var result = mod.mount($body);
            _unmount = (typeof result === 'function') ? result : null;
          } catch (err) {
            console.warn('[the_way] mount() threw:', err);
          }
        }

        /* Append invite extras after the invitation module */
        if (isInvite) {
          appendInviteExtras($body);
        }

        $body.scrollTop = 0;
      })
      .catch(function (err) {
        var $body = document.querySelector('.drawer-body');
        if ($body) {
          $body.innerHTML = '<p style="padding:1rem;color:var(--ink-muted)">'
            + '\u26a0 Could not load module.<br><small>' + esc(String(err)) + '</small></p>';
        }
      });
  }

  /* ── Build aside (col 3) ─────────────────────────────────────────────────── */
  function buildAside() {
    /* Section label */
    var $hd = document.createElement('div');
    $hd.className = 'section-rule';
    $hd.innerHTML = '<span class="section-label">TODAY</span>';
    $aside.appendChild($hd);

    /* Psalm of the day from psalms module */
    _importMod('the_gospel_psalms')
      .then(function (mod) {
        var p = typeof mod.getPsalmOfDay === 'function'
          ? mod.getPsalmOfDay(getDayOfYear())
          : null;
        if (p) {
          _appendAsideCard($aside, 'Psalm of the Day',
            p.title || ('Psalm ' + (p.num || '')),
            p.summary || p.intro || '',
            p.verse || '',
            '#8B7028',
            'the_gospel_psalms'
          );
        }
      })
      .catch(function () {});

    /* OYB today from reading module */
    _importMod('the_gospel_reading')
      .then(function (mod) {
        var r = typeof mod.getOYBToday === 'function' ? mod.getOYBToday() : null;
        if (r) {
          _appendAsideCard($aside, "Today's Reading",
            r.label || r.passage || 'Bible in a Year',
            r.streams ? r.streams.join(' \u00b7 ') : '',
            '',
            '#059669',
            'the_gospel_reading'
          );
        }
      })
      .catch(function () {});

  }

  function _appendAsideCard($parent, label, title, body, verse, color, modName) {
    var $card = document.createElement('div');
    $card.className = 'way-today-card';
    $card.style.borderLeftColor = color || 'var(--accent)';
    $card.innerHTML = '<span class="way-today-card__label" style="color:' + esc(color || 'var(--accent)') + '">'
      + esc(label) + '</span>'
      + '<div class="way-today-card__title">' + esc(title) + '</div>'
      + (body  ? '<div class="way-today-card__body">'  + esc(body)  + '</div>' : '')
      + (verse ? '<div class="way-today-card__verse">' + esc(verse) + '</div>' : '')
      + (modName ? '<button class="way-today-card__open" type="button" data-mod="'
          + esc(modName) + '">Open \u2192</button>' : '');

    if (modName) {
      $card.querySelector('.way-today-card__open').addEventListener('click', function () {
        openModule(modName, false, label);
      });
    }
    $parent.appendChild($card);
  }

  /* ── Invite extras — church card + contact/decision form ─────────────────── */
  function appendInviteExtras($body) {
    var church = _getChurchConfig();
    var $wrap  = document.createElement('div');
    $wrap.className = 'way-invite-extras';

    if (church) {
      $wrap.innerHTML = '<div class="way-church-card">'
        + '<h3 class="way-church-card__name">' + esc(church.churchName || 'Our Church') + '</h3>'
        + '<p class="way-church-card__meta">'
        + (church.address     ? esc(church.address)     + '<br>' : '')
        + (church.phone       ? esc(church.phone)       + '<br>' : '')
        + (church.serviceTime ? esc(church.serviceTime)           : '')
        + '</p></div>';
    }

    $wrap.innerHTML += '<div class="way-contact-card">'
      + '<h3 class="way-contact-card__title">Take a Next Step</h3>'
      + '<div class="form-row"><label for="way-contact-name">Your Name</label>'
      +   '<input id="way-contact-name" type="text" placeholder="Jane Smith" autocomplete="name"></div>'
      + '<div class="form-row"><label for="way-contact-email">Email (optional)</label>'
      +   '<input id="way-contact-email" type="email" placeholder="you@example.com" autocomplete="email"></div>'
      + '<div class="form-row"><label for="way-contact-prayer">Prayer Request or Question</label>'
      +   '<textarea id="way-contact-prayer" rows="3" placeholder="Share anything on your heart\u2026"></textarea></div>'
      + '<p class="way-form-status" id="way-form-status"></p>'
      + '<button type="button" class="way-submit-btn" id="way-contact-submit">Send to Our Team</button>'
      + '<button type="button" class="way-decision-btn" id="way-decision-btn">\u271d I Want to Follow Jesus</button>'
      + '</div>';

    $body.appendChild($wrap);

    var $submit   = document.getElementById('way-contact-submit');
    var $decision = document.getElementById('way-decision-btn');
    var $status   = document.getElementById('way-form-status');
    if ($submit)   $submit.addEventListener('click',   function () { _submitForm($submit,   $status, false); });
    if ($decision) $decision.addEventListener('click', function () { _submitForm($decision, $status, true);  });
  }

  function _submitForm($btn, $status, isDecision) {
    var name   = (document.getElementById('way-contact-name')   || {}).value;
    var email  = (document.getElementById('way-contact-email')  || {}).value;
    var prayer = (document.getElementById('way-contact-prayer') || {}).value;
    name   = (name   || '').trim();
    email  = (email  || '').trim();
    prayer = (prayer || '').trim();

    if (!name) {
      if ($status) $status.textContent = 'Please enter your name.';
      return;
    }
    $btn.disabled = true;
    if ($status) $status.textContent = isDecision ? 'Praise God! Recording\u2026' : 'Sending\u2026';

    var payload = { name: name, email: email, prayer: prayer, isDecision: isDecision, timestamp: new Date().toISOString() };
    var sent = false;
    try {
      if (window.UpperRoom && typeof window.UpperRoom.createPrayer === 'function') {
        window.UpperRoom.createPrayer({ name: payload.name, request: (isDecision ? '[DECISION] ' : '') + (prayer || '(contact)'), email: email });
        sent = true;
      }
    } catch (_e) {}
    if (!sent) {
      try {
        var q = JSON.parse(localStorage.getItem('flock_contact_queue') || '[]');
        q.push(payload);
        localStorage.setItem('flock_contact_queue', JSON.stringify(q));
      } catch (_e) {}
    }

    if ($status) $status.textContent = isDecision ? '\u2713 Decision recorded \u2014 welcome to the family!' : '\u2713 Message sent.';
    ['way-contact-name','way-contact-email','way-contact-prayer'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    setTimeout(function () { $btn.disabled = false; }, 3000);
  }

  function _getChurchConfig() {
    try { var r = localStorage.getItem('flockos_church_config'); if (r) return JSON.parse(r); } catch (_e) {}
    try { if (window.UpperRoom && typeof window.UpperRoom.getChurchConfig === 'function') return window.UpperRoom.getChurchConfig(); } catch (_e) {}
    return null;
  }

  /* ── Module import helper (with cache) ───────────────────────────────────── */
  function _importMod(modName) {
    if (_modCache[modName]) return Promise.resolve(_modCache[modName]);
    return import('../../Scripts/the_gospel/' + modName + '.js')
      .then(function (mod) { _modCache[modName] = mod; return mod; });
  }

  /* ── Skeleton cards ─────────────────────────────────────────────────────── */
  function _skels(n) {
    var out = '';
    for (var i = 0; i < n; i++) out += '<div class="grow-skel-card"></div>';
    return out;
  }

  /* ── Teaser: take first N sentences ─────────────────────────────────────── */
  function _teaser(str, n) {
    if (!str) return '';
    var parts = str.match(/[^.!?]+[.!?]+/g) || [str];
    return parts.slice(0, n).join(' ').trim();
  }

  /* ── Date byline ─────────────────────────────────────────────────────────── */
  function _dateByline() {
    var d = new Date();
    var months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                  'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  /* ── Day of year ─────────────────────────────────────────────────────────── */
  function getDayOfYear() {
    var now = new Date();
    return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  }

  /* ── HTML escape ─────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#x27;');
  }

  /* ── Init ────────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', buildPage);

}());
