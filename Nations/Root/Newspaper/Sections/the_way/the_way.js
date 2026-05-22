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

  /* ── Daily Prayer Hours data ─────────────────────────────────────────────────── */
  var WAY_PRAYER_HOURS = [
    {
      id: 'dawn',
      time: 'Dawn',
      label: 'Morning Watch',
      icon: '\uD83C\uDF05', /* 🌅 */
      range: [4, 11],
      text: '\u201cO LORD, in the morning you hear my voice.\u201d \u2014 Psalm 5:3',
      callToPrayer: 'Lord, open my lips, and my mouth shall declare Your praise.',
      scripture: {
        ref: 'Psalm 5:1\u20133 (ESV)',
        text: 'Give ear to my words, O LORD; consider my groaning. Give attention to the sound of my cry, my King and my God, for to you do I pray. O LORD, in the morning you hear my voice; in the morning I prepare a sacrifice for you and watch.'
      },
      intercession: [
        'For the work of my hands today \u2014 may it be done as unto the Lord.',
        'For my family, that the Lord would go before them.',
        'For my pastors, elders, and the church.',
        'For one person who does not yet know Christ.',
      ],
      closing: 'Direct, control, suggest this day all I design, do, or say; that all my powers, with all their might, in Thy sole glory may unite. Amen.'
    },
    {
      id: 'midday',
      time: '12:00 PM',
      label: 'Midday Pause',
      icon: '\u2600\uFE0F', /* ☀️ */
      range: [11, 14],
      text: '\u201cSeven times a day I praise you.\u201d \u2014 Psalm 119:164',
      callToPrayer: 'In the middle of the day, I lift my eyes to the hills.',
      scripture: {
        ref: 'Psalm 121:1\u20132 (ESV)',
        text: 'I lift up my eyes to the hills. From where does my help come? My help comes from the LORD, who made heaven and earth.'
      },
      intercession: [
        'A pause of thanksgiving for what God has already done today.',
        'For wisdom in this afternoon\u2019s decisions and conversations.',
        'For the poor, the hungry, and the weary.',
        'For peace where there is conflict.',
      ],
      closing: 'Father, You who never slumber nor sleep, sustain me through this day. Amen.'
    },
    {
      id: 'three',
      time: '3:00 PM',
      label: 'Hour of Prayer',
      icon: '\u26EA', /* ⛪ */
      range: [14, 17],
      text: '\u201cNow Peter and John were going up to the temple at the hour of prayer.\u201d \u2014 Acts 3:1',
      callToPrayer: 'At the ninth hour, the hour our Savior bowed His head and gave up His Spirit.',
      scripture: {
        ref: 'Luke 23:44\u201346 (ESV)',
        text: 'It was now about the sixth hour, and there was darkness over the whole land until the ninth hour, while the sun\u2019s light failed. And the curtain of the temple was torn in two. Then Jesus, calling out with a loud voice, said, \u201cFather, into your hands I commit my spirit!\u201d And having said this he breathed his last.'
      },
      intercession: [
        'Thanksgiving for the cross, the empty tomb, the open way.',
        'For the lost \u2014 that the Lord would send laborers into His harvest.',
        'For the sick, the dying, and those who tend them.',
        'For my own soul \u2014 search me, O God, and know my heart.',
      ],
      closing: 'Jesus, by Your death You have abolished death; by Your rising again You have restored to us everlasting life. Amen.'
    },
    {
      id: 'vespers',
      time: 'Evening',
      label: 'Evening Prayers',
      icon: '\uD83C\uDF19', /* 🌙 */
      range: [17, 23],
      text: '\u201cLet my prayer be counted as incense before you.\u201d \u2014 Psalm 141:2',
      callToPrayer: 'O God, make speed to save me; O Lord, make haste to help me.',
      scripture: {
        ref: 'Psalm 141:1\u20132 (ESV)',
        text: 'O LORD, I call upon you; hasten to me! Give ear to my voice when I call to you! Let my prayer be counted as incense before you, and the lifting up of my hands as the evening sacrifice!'
      },
      intercession: [
        'A confession of today\u2019s failures \u2014 in thought, word, and deed.',
        'Thanksgiving for the mercies of this day.',
        'For all who travel, who labor through the night, who cannot sleep.',
        'For peaceful rest, and waking to serve You again.',
      ],
      closing: 'Lighten our darkness, we beseech thee, O Lord; and by thy great mercy defend us from all perils and dangers of this night. Amen.'
    },
  ];

  /* Return current prayer hour from LITURGY based on local clock */
  function _currentPrayerHour() {
    var h = new Date().getHours();
    for (var i = 0; i < WAY_PRAYER_HOURS.length; i++) {
      var l = WAY_PRAYER_HOURS[i];
      if (h >= l.range[0] && h < l.range[1]) return l;
    }
    return WAY_PRAYER_HOURS[0];
  }

  /* Build the prayer hours card HTML for the aside */
  function _buildPrayerHoursCard() {
    var _ico = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    var _icons = {
      dawn:    '<svg ' + _ico + '><line x1="2" y1="17" x2="22" y2="17"/><path d="M8 17a4 4 0 0 1 8 0"/><line x1="12" y1="5" x2="12" y2="7"/><line x1="5.22" y1="8.22" x2="6.64" y2="9.64"/><line x1="18.78" y1="8.22" x2="17.36" y2="9.64"/><line x1="2" y1="13" x2="4" y2="13"/><line x1="20" y1="13" x2="22" y2="13"/></svg>',
      midday:  '<svg ' + _ico + '><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
      three:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="21"/><line x1="6" y1="9" x2="18" y2="9"/></svg>',
      vespers: '<svg ' + _ico + '><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    };
    var now  = _currentPrayerHour();
    var rows = '';
    WAY_PRAYER_HOURS.forEach(function (l) {
      var isNow = (l.id === now.id);
      rows += '<div class="way-ph-row' + (isNow ? ' is-now' : '') + '" data-hour="' + esc(l.id) + '" tabindex="0" role="button" aria-label="Begin ' + esc(l.label) + '">'
           + '<div class="way-ph-icon">' + (_icons[l.id] || '') + '</div>'
           + '<div class="way-ph-body">'
           +   '<div class="way-ph-time">' + esc(l.time)
           +     (isNow ? ' <span class="way-ph-now-pill">Now</span>' : '')
           +   '</div>'
           +   '<div class="way-ph-sublabel">' + esc(l.label) + '</div>'
           +   '<div class="way-ph-text">' + esc(l.text) + '</div>'
           + '</div>'
           + '</div>';
    });
    return '<div class="way-ph-card">'
      + '<div class="way-ph-title">Prayer Hours</div>'
      + '<div class="way-ph-verse">\u201cEvening, morning and noon I cry out.\u201d \u2014 Ps.\u00a055:17</div>'
      + '<div class="way-ph-list">' + rows + '</div>'
      + '<button class="way-ph-begin-btn" type="button">Begin ' + esc(now.label) + '</button>'
      + '</div>';
  }

  /* Open a guided prayer session for a given liturgy hour in the drawer */
  function _openLiturgySession(hourId) {
    var hour = null;
    for (var i = 0; i < WAY_PRAYER_HOURS.length; i++) {
      if (WAY_PRAYER_HOURS[i].id === hourId) { hour = WAY_PRAYER_HOURS[i]; break; }
    }
    if (!hour) return;

    var _sico  = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    var _bell  = '<svg ' + _sico + '><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
    var _book  = '<svg ' + _sico + '><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
    var _heart = '<svg ' + _sico + '><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    var _cross = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="21"/><line x1="6" y1="9" x2="18" y2="9"/></svg>';

    var items = hour.intercession.map(function (line, idx) {
      return '<label class="pray-lit-prompt">'
        + '<input type="checkbox" data-prompt="' + idx + '">'
        + '<span>' + esc(line) + '</span>'
        + '</label>';
    }).join('');

    var html = '<div class="pray-lit-session">'
      + '<div class="pray-lit-step">'
      +   '<div class="pray-lit-step-label">' + _bell + 'Call to Prayer</div>'
      +   '<div class="pray-lit-call">' + esc(hour.callToPrayer) + '</div>'
      + '</div>'
      + '<div class="pray-lit-step">'
      +   '<div class="pray-lit-step-label">' + _book + 'Scripture \u2014 ' + esc(hour.scripture.ref) + '</div>'
      +   '<div class="pray-lit-scripture-text">' + esc(hour.scripture.text) + '</div>'
      + '</div>'
      + '<div class="pray-lit-step">'
      +   '<div class="pray-lit-step-label">' + _heart + 'Intercession</div>'
      +   '<div class="pray-lit-intercession">' + items + '</div>'
      + '</div>'
      + '<div class="pray-lit-step">'
      +   '<div class="pray-lit-step-label">' + _cross + 'Closing Prayer</div>'
      +   '<div class="pray-lit-closing">' + esc(hour.closing) + '</div>'
      + '</div>'
      + '<button class="way-amen-btn" type="button" id="way-amen-btn">\u271D Mark Complete \u2014 Amen</button>'
      + '</div>';

    window.FlockGates.openDrawer(hour.label, html);

    setTimeout(function () {
      var $btn = document.getElementById('way-amen-btn');
      if ($btn) {
        $btn.addEventListener('click', function () {
          try {
            var key = 'flockos:liturgy:' + new Date().toISOString().slice(0, 10);
            var done = JSON.parse(localStorage.getItem(key) || '[]');
            if (!done.includes(hourId)) done.push(hourId);
            localStorage.setItem(key, JSON.stringify(done));
          } catch (_e) {}
          _showToast('\u271D Amen \u2014 prayer complete.');
        });
      }
    }, 80);
  }

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

    /* Teaser: daily seed or fallback to 2 sentences from description */
    var teaser = _getDailyTeaser(story.mod) || _teaser(desc, 2);

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
      + '<p class="story-readmore">'
      +   '<button class="story-readmore-btn" type="button" data-mod="' + esc(story.mod) + '"'
      +     (story.invite ? ' data-invite="1"' : '')
      +   '>'
      +     'Open ' + esc(title) + ' \u2192'
      +   '</button>'
      + '</p>'
      + '<div class="story-ornament-divider" aria-hidden="true">'
      +   '<svg viewBox="0 0 400 16" xmlns="http://www.w3.org/2000/svg">'
      +     '<line x1="0" y1="8" x2="168" y2="8" stroke="var(--gold,#8B7028)" stroke-width="0.75"/>'
      +     '<path d="M171 5 L175 8 L171 11 L167 8 Z" fill="var(--gold,#8B7028)"/>'
      +     '<path d="M200 2 L208 8 L200 14 L192 8 Z" fill="var(--gold,#8B7028)"/>'
      +     '<rect x="198.5" y="2" width="3" height="12" fill="var(--paper-card,#fff)"/>'
      +     '<rect x="192" y="6.5" width="16" height="3" fill="var(--paper-card,#fff)"/>'
      +     '<path d="M229 5 L233 8 L229 11 L225 8 Z" fill="var(--gold,#8B7028)"/>'
      +     '<line x1="232" y1="8" x2="400" y2="8" stroke="var(--gold,#8B7028)" stroke-width="0.75"/>'
      +   '</svg>'
      + '</div>';

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

    /* All Modules quick links */
    var $rule2 = document.createElement('div');
    $rule2.className = 'section-rule';
    $rule2.style.marginTop = '1.25rem';
    $rule2.innerHTML = '<span class="section-label">ALL MODULES</span>';
    $aside.appendChild($rule2);

    var $links = document.createElement('div');
    $links.className = 'way-aside-links';
    ASIDE_MODULES.forEach(function (item) {
      var $btn = document.createElement('button');
      $btn.type = 'button';
      $btn.className = 'way-aside-link';
      $btn.style.setProperty('--aside-accent', item.accent || 'var(--accent)');
      $btn.innerHTML = item.svg
        ? '<span class="way-aside-link__icon" aria-hidden="true">' + item.svg + '</span>'
          + '<span class="way-aside-link__label">' + esc(item.label) + '</span>'
        : esc(item.label);
      $btn.addEventListener('click', function () {
        openModule(item.mod, false, item.label);
      });
      $links.appendChild($btn);
    });
    $aside.appendChild($links);

    /* Daily Prayer Hours card */
    var $phRule = document.createElement('div');
    $phRule.className = 'section-rule';
    $phRule.style.marginTop = '1.25rem';
    $phRule.innerHTML = '<span class="section-label">PRAYER HOURS</span>';
    $aside.appendChild($phRule);

    var $phWrap = document.createElement('div');
    $phWrap.innerHTML = _buildPrayerHoursCard();
    $aside.appendChild($phWrap.firstElementChild);
    var $phCard = $aside.querySelector('.way-ph-card');
    if ($phCard) {
      $phCard.querySelector('.way-ph-begin-btn').addEventListener('click', function () {
        _openLiturgySession(_currentPrayerHour().id);
      });
      $phCard.querySelectorAll('.way-ph-row').forEach(function (row) {
        row.addEventListener('click', function () {
          _openLiturgySession(row.dataset.hour);
        });
        row.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _openLiturgySession(row.dataset.hour); }
        });
      });
    }

    /* Edit daily messages button — leaders (role >= 3) only */
    var _editRole = (window.FlockGates && typeof window.FlockGates.getUserRole === 'function')
      ? window.FlockGates.getUserRole() : -1;
    if (_editRole < 3) return;
    var $editBtn = document.createElement('button');
    $editBtn.type = 'button';
    $editBtn.className = 'way-edit-daily-btn';
    $editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:-2px;margin-right:5px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit Daily Messages';
    $editBtn.addEventListener('click', _openDailyEditor);
    $aside.appendChild($editBtn);

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

  /* ── Daily teaser lookup (THE_WAY_DAILY seed + localStorage overrides) ───── */
  function _getDailyTeaser(mod) {
    var day    = new Date().getDate(); /* 1–31 */
    var custom = {};
    try { custom = JSON.parse(localStorage.getItem('the_way_custom') || '{}'); } catch (_e) {}
    var mc   = custom[mod] || {};
    var data = window.THE_WAY_DAILY;
    var seed = (data && data[mod] && data[mod].days) ? data[mod].days : [];
    var pool = seed.concat(mc.extra || []);
    if (!pool.length) return '';
    if (mc.overrides && mc.overrides[day]) return mc.overrides[day];
    return pool[(day - 1) % pool.length] || '';
  }

  /* ── Refresh story teasers live after editor saves ────────────────────────── */
  function _refreshTeasers() {
    $main.querySelectorAll('.story').forEach(function ($art) {
      var $btn = $art.querySelector('[data-mod]');
      if (!$btn) return;
      var mod = $btn.dataset.mod;
      var $body = $art.querySelector('.story-body');
      if (!$body) return;
      var fresh = _getDailyTeaser(mod);
      if (fresh) $body.textContent = fresh;
    });
  }

  /* ── Toast helper ─────────────────────────────────────────────────────────── */
  function _showToast(msg) {
    var $t = document.getElementById('toast-layer');
    if (!$t) return;
    var $el = document.createElement('div');
    $el.className = 'toast-message';
    $el.textContent = msg;
    $t.appendChild($el);
    setTimeout(function () { $el.remove(); }, 2500);
  }

  /* ── Daily message editor ─────────────────────────────────────────────────── */
  function _openDailyEditor() {
    var data   = window.THE_WAY_DAILY || {};
    var day    = new Date().getDate();
    var custom = {};
    try { custom = JSON.parse(localStorage.getItem('the_way_custom') || '{}'); } catch (_e) {}

    var tabs   = '';
    var panels = '';

    STORIES.forEach(function (story, i) {
      var mod   = story.mod;
      var mdata = data[mod] || { title: story.category, why: '', helps: '', days: [] };
      var mc    = custom[mod] || {};
      var pool  = mdata.days.concat(mc.extra || []);
      var curMsg = (mc.overrides && mc.overrides[day])
        ? mc.overrides[day]
        : (pool.length ? pool[(day - 1) % pool.length] : '');
      var extras  = mc.extra || [];
      var isFirst = (i === 0);

      tabs += '<button class="dly-tab' + (isFirst ? ' is-active' : '') + '" data-dtab="' + esc(mod) + '">'
           + esc(mdata.title || story.category)
           + '</button>';

      var extraItems = '';
      extras.forEach(function (ex, ei) {
        extraItems += '<div class="dly-extra-row">'
          + '<span class="dly-extra-text">' + esc(ex) + '</span>'
          + '<button class="dly-del-extra" data-mod="' + esc(mod) + '" data-idx="' + ei + '" type="button" title="Remove">&times;</button>'
          + '</div>';
      });

      panels += '<div class="dly-panel' + (isFirst ? ' is-active' : '') + '" data-dpanel="' + esc(mod) + '">'
        + (mdata.why ? '<p class="dly-why"><strong>Why it matters:</strong> ' + esc(mdata.why) + '</p>' : '')
        + '<p class="dly-lbl">Day ' + day + ' message &mdash; edit to override today&rsquo;s card:</p>'
        + '<textarea class="dly-textarea" data-mod="' + esc(mod) + '" rows="3">' + esc(curMsg) + '</textarea>'
        + '<div class="dly-btn-row">'
        +   '<button class="dly-save-btn" data-mod="' + esc(mod) + '" type="button">Save for Day ' + day + '</button>'
        +   '<button class="dly-reset-btn" data-mod="' + esc(mod) + '" type="button">Reset Default</button>'
        + '</div>'
        + '<hr class="dly-rule">'
        + '<p class="dly-lbl">Extra rotation messages <small>(' + mdata.days.length + '-day cycle + yours)</small>:</p>'
        + (extraItems || '<p class="dly-empty">No custom messages yet.</p>')
        + '<textarea class="dly-add-textarea" placeholder="Type a new rotation message and click Add&hellip;" rows="2"></textarea>'
        + '<button class="dly-add-btn" data-mod="' + esc(mod) + '" type="button">Add to Rotation</button>'
        + '</div>';
    });

    var editorStyle = '<style>'
      + '.dly-tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px}'
      + '.dly-tab{background:transparent;border:1.5px solid var(--rule,#e5e7ef);border-radius:6px;padding:4px 10px;font:600 0.7rem/1 var(--font-ui,sans-serif);color:var(--ink-muted);cursor:pointer;transition:all .15s}'
      + '.dly-tab.is-active{background:var(--gold,#8B7028);color:#fff;border-color:transparent}'
      + '.dly-panel{display:none}.dly-panel.is-active{display:block}'
      + '.dly-why{font-size:.82rem;line-height:1.6;color:var(--ink-muted);background:var(--paper-sunken,#f4f5f9);border-radius:8px;padding:10px 12px;margin:0 0 14px}'
      + '.dly-lbl{display:block;font:700 0.68rem/1 var(--font-ui,sans-serif);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted);margin:0 0 6px}'
      + '.dly-textarea,.dly-add-textarea{width:100%;box-sizing:border-box;border:1.5px solid var(--rule,#e5e7ef);border-radius:6px;padding:8px 10px;font:0.88rem/1.6 var(--font-body,serif);color:var(--ink);background:var(--paper-card,#fff);resize:vertical;margin-bottom:8px}'
      + '.dly-textarea:focus,.dly-add-textarea:focus{outline:2px solid var(--gold,#8B7028);border-color:transparent}'
      + '.dly-btn-row{display:flex;gap:8px;margin-bottom:16px}'
      + '.dly-save-btn,.dly-add-btn{background:var(--gold,#8B7028);color:#fff;border:none;border-radius:6px;padding:6px 14px;font:600 0.75rem var(--font-ui,sans-serif);cursor:pointer}'
      + '.dly-reset-btn{background:transparent;border:1.5px solid var(--rule,#e5e7ef);border-radius:6px;padding:6px 12px;font:600 0.75rem var(--font-ui,sans-serif);color:var(--ink-muted);cursor:pointer}'
      + '.dly-rule{border:none;border-top:1px solid var(--rule,#e5e7ef);margin:0 0 14px}'
      + '.dly-extra-row{display:flex;align-items:flex-start;gap:8px;padding:7px 10px;background:var(--paper-sunken,#f4f5f9);border-radius:6px;margin-bottom:5px}'
      + '.dly-extra-text{flex:1;font-size:.84rem;line-height:1.5;color:var(--ink)}'
      + '.dly-del-extra{background:none;border:none;color:var(--ink-muted);cursor:pointer;font-size:.9rem;flex-shrink:0;padding:0;line-height:1}'
      + '.dly-empty{font-style:italic;font-size:.82rem;color:var(--ink-muted);margin:0 0 10px}'
      + '.dly-add-textarea{margin-top:10px}'
      + '</style>';

    var html = editorStyle
      + '<p style="font-size:.84rem;line-height:1.6;color:var(--ink-muted);margin:0 0 16px">'
      +   'Customize the message shown on each story card. Changes are saved to this device only.'
      + '</p>'
      + '<div class="dly-tabs">' + tabs + '</div>'
      + panels;

    window.FlockGates.openDrawer('Edit Daily Messages', html);

    /* Wire interactions — defer so drawer DOM is painted */
    setTimeout(function () {
      var $body = document.querySelector('.drawer-body');
      if (!$body) return;

      $body.addEventListener('click', function (e) {
        /* Tab switching */
        var $tab = e.target.closest('.dly-tab');
        if ($tab) {
          $body.querySelectorAll('.dly-tab').forEach(function (t) { t.classList.remove('is-active'); });
          $body.querySelectorAll('.dly-panel').forEach(function (p) { p.classList.remove('is-active'); });
          $tab.classList.add('is-active');
          var $panel = $body.querySelector('.dly-panel[data-dpanel="' + $tab.dataset.dtab + '"]');
          if ($panel) $panel.classList.add('is-active');
        }

        /* Save day override */
        var $save = e.target.closest('.dly-save-btn');
        if ($save) {
          var mod2 = $save.dataset.mod;
          var $ta  = $body.querySelector('.dly-textarea[data-mod="' + mod2 + '"]');
          if (!$ta) return;
          var c = {};
          try { c = JSON.parse(localStorage.getItem('the_way_custom') || '{}'); } catch (_e) {}
          c[mod2] = c[mod2] || {};
          c[mod2].overrides = c[mod2].overrides || {};
          c[mod2].overrides[day] = $ta.value.trim();
          localStorage.setItem('the_way_custom', JSON.stringify(c));
          _showToast('Saved for Day ' + day);
          _refreshTeasers();
        }

        /* Reset day override */
        var $reset = e.target.closest('.dly-reset-btn');
        if ($reset) {
          var mod3 = $reset.dataset.mod;
          var c2   = {};
          try { c2 = JSON.parse(localStorage.getItem('the_way_custom') || '{}'); } catch (_e) {}
          if (c2[mod3] && c2[mod3].overrides) delete c2[mod3].overrides[day];
          localStorage.setItem('the_way_custom', JSON.stringify(c2));
          var $ta2 = $body.querySelector('.dly-textarea[data-mod="' + mod3 + '"]');
          if ($ta2) $ta2.value = _getDailyTeaser(mod3);
          _showToast('Reset to default');
          _refreshTeasers();
        }

        /* Add extra rotation message */
        var $add = e.target.closest('.dly-add-btn');
        if ($add) {
          var mod4   = $add.dataset.mod;
          var $panel = $add.closest('.dly-panel');
          var $addTa = $panel ? $panel.querySelector('.dly-add-textarea') : null;
          if (!$addTa || !$addTa.value.trim()) return;
          var msg = $addTa.value.trim();
          var c3  = {};
          try { c3 = JSON.parse(localStorage.getItem('the_way_custom') || '{}'); } catch (_e) {}
          c3[mod4] = c3[mod4] || {};
          c3[mod4].extra = c3[mod4].extra || [];
          c3[mod4].extra.push(msg);
          localStorage.setItem('the_way_custom', JSON.stringify(c3));
          $addTa.value = '';
          /* Replace empty placeholder, append new row before Add button */
          var $empty = $panel.querySelector('.dly-empty');
          if ($empty) $empty.remove();
          var $row = document.createElement('div');
          $row.className = 'dly-extra-row';
          var newIdx = c3[mod4].extra.length - 1;
          $row.innerHTML = '<span class="dly-extra-text">' + esc(msg) + '</span>'
            + '<button class="dly-del-extra" data-mod="' + esc(mod4) + '" data-idx="' + newIdx + '" type="button" title="Remove">&times;</button>';
          $add.parentNode.insertBefore($row, $add);
          _showToast('Added to rotation');
          _refreshTeasers();
        }

        /* Delete extra rotation message */
        var $del = e.target.closest('.dly-del-extra');
        if ($del) {
          var mod5 = $del.dataset.mod;
          var idx  = parseInt($del.dataset.idx, 10);
          var c4   = {};
          try { c4 = JSON.parse(localStorage.getItem('the_way_custom') || '{}'); } catch (_e) {}
          if (c4[mod5] && c4[mod5].extra) c4[mod5].extra.splice(idx, 1);
          localStorage.setItem('the_way_custom', JSON.stringify(c4));
          $del.closest('.dly-extra-row').remove();
          /* Re-index remaining delete buttons */
          var $pnl = $body.querySelector('.dly-panel[data-dpanel="' + mod5 + '"]');
          if ($pnl) $pnl.querySelectorAll('.dly-del-extra').forEach(function ($b, ii) { $b.dataset.idx = ii; });
          _showToast('Removed');
          _refreshTeasers();
        }
      });
    }, 80);
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
