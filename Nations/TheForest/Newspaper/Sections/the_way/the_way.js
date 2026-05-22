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

  /* ── Aside strip modules (col 3) ─────────────────────────────────────────── */
  var ASIDE_MODULES = [
    { mod: 'the_gospel_psalms',        label: 'Psalm of the Day',     accent: '#8B7028' },
    { mod: 'the_gospel_reading',       label: "Today's Reading",      accent: '#059669' },
    { mod: 'the_gospel_courses',       label: 'Courses',              accent: '#6b5b9a' },
    { mod: 'the_gospel_teaching_plans',label: 'Teaching Plans',       accent: '#7eaacc' },
    { mod: 'the_gospel_counseling',    label: 'Counseling',           accent: '#c0445e' },
    { mod: 'the_gospel_mirror',        label: "Shepherd's Mirror",    accent: '#946B1C' },
    { mod: 'the_gospel_lexicon',       label: 'Lexicon',              accent: '#059669' },
    { mod: 'the_gospel_library',       label: 'Library',              accent: '#7eaacc' },
    { mod: 'the_gospel_journal',       label: 'Journal',              accent: '#8B7028' },
    { mod: 'the_gospel_analytics',     label: 'My Progress',          accent: '#946B1C' },
    { mod: 'the_gospel_certificates',  label: 'Certificates',         accent: '#059669' },
    { mod: 'the_gospel_sermons',       label: 'Sermons',              accent: '#7eaacc' },
    { mod: 'the_gospel_why',           label: 'Why This?',            accent: '#6b5b9a' },
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

    /* Quick links rule */
    var $rule2 = document.createElement('div');
    $rule2.className = 'section-rule';
    $rule2.style.marginTop = '1.25rem';
    $rule2.innerHTML = '<span class="section-label">ALL MODULES</span>';
    $aside.appendChild($rule2);

    /* Quick link buttons for remaining modules */
    var $links = document.createElement('div');
    $links.className = 'way-aside-links';
    ASIDE_MODULES.forEach(function (item) {
      var $btn = document.createElement('button');
      $btn.type = 'button';
      $btn.className = 'way-aside-link';
      $btn.textContent = item.label;
      $btn.addEventListener('click', function () {
        openModule(item.mod, false, item.label);
      });
      $links.appendChild($btn);
    });
    $aside.appendChild($links);
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
