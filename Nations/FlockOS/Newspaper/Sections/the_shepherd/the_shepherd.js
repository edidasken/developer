(function () {
  'use strict';

  var SECTION_KEY = 'the_shepherd';
  var SECTION_TITLE = 'The Shepherd';
  var AUTH_LEVEL = 4;
  var APP_VIEW = 'the_good_shepherd';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  }

  function getShellInit() {
    if (window.NewspaperShell && typeof window.NewspaperShell.initializeSectionShell === 'function') {
      return window.NewspaperShell.initializeSectionShell;
    }
    if (typeof window.initializeSectionShell === 'function') {
      return window.initializeSectionShell;
    }
    return null;
  }

  function initializeShell() {
    var shellInit = getShellInit();
    if (typeof shellInit !== 'function') {
      return null;
    }

    return shellInit({
      sectionId: SECTION_KEY,
      title: SECTION_TITLE,
      authLevel: AUTH_LEVEL,
      pageRoot: document.getElementById('the-shepherd-grid')
    });
  }

  function getAppFlockOsCandidates() {
    var builtPath = '../../../app.flockos/app.flockos.html?view=' + APP_VIEW;
    var workspacePath = '../../../Nations/Root/app.flockos/app.flockos.html?view=' + APP_VIEW;

    if (window.location && window.location.pathname && window.location.pathname.indexOf('/Nations/') !== -1) {
      return [builtPath, workspacePath];
    }

    return [workspacePath, builtPath];
  }

  function probeUrl(relativeUrl) {
    var absoluteUrl = new URL(relativeUrl, window.location.href).href;
    return fetch(absoluteUrl, {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin'
    }).then(function (response) {
      return !!(response && response.ok);
    }).catch(function () {
      return false;
    });
  }

  async function resolveAppFlockOsUrl() {
    var candidates = getAppFlockOsCandidates();

    for (var i = 0; i < candidates.length; i += 1) {
      try {
        if (await probeUrl(candidates[i])) {
          return candidates[i];
        }
      } catch (error) {
        // Try the next candidate.
      }
    }

    return candidates[0];
  }

  function buildIntroCard(url) {
    var card = document.createElement('article');
    card.className = 'broadsheet-card broadsheet-card--full shepherd-embed-card';
    card.style.display = 'grid';
    card.style.gap = '1rem';

    var kicker = document.createElement('p');
    kicker.className = 'story-kicker';
    kicker.textContent = 'LEGACY SHELL · FULL FLOCKOS COMMAND CENTER';

    var title = document.createElement('h2');
    title.className = 'story-hed';
    title.textContent = 'The full church operating system is embedded below';

    var deck = document.createElement('p');
    deck.className = 'story-deck';
    deck.textContent = 'Use this shell for care cases, prayers, flockchat, flockshow, flockstand, shamar, wellspring, and the rest of the FlockOS views.';

    var note = document.createElement('p');
    note.className = 'story-body';
    note.style.marginTop = '0';
    note.textContent = 'If the embed does not load, open the app directly in a new tab.';

    var link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'broadsheet-button';
    link.style.justifySelf = 'start';
    link.textContent = 'Open FlockOS in a new tab';

    var status = document.createElement('p');
    status.className = 'story-byline';
    status.textContent = 'Loading embedded shell…';

    var frame = document.createElement('iframe');
    frame.className = 'shepherd-embed-frame';
    frame.title = 'FlockOS embedded shell';
    frame.loading = 'eager';
    frame.referrerPolicy = 'same-origin';
    frame.src = url;
    frame.style.width = '100%';
    frame.style.minHeight = '72vh';
    frame.style.border = '1px solid var(--rule)';
    frame.style.borderRadius = '0.75rem';
    frame.style.background = 'var(--paper-card)';
    frame.style.boxShadow = '0 10px 24px rgba(0,0,0,0.08)';

    frame.addEventListener('load', function () {
      status.textContent = 'Embedded shell loaded.';
    });

    card.appendChild(kicker);
    card.appendChild(title);
    card.appendChild(deck);
    card.appendChild(note);
    card.appendChild(link);
    card.appendChild(status);
    card.appendChild(frame);

    return card;
  }

  function renderFallback(message) {
    var grid = document.getElementById('the-shepherd-grid');
    if (!grid) {
      return;
    }

    grid.innerHTML = '';
    var card = document.createElement('article');
    card.className = 'broadsheet-card broadsheet-card--full';
    card.innerHTML = '<div class="empty-state">'
      + '<div class="empty-state__icon">🔑</div>'
      + '<p class="empty-state__title">The Shepherd command center is unavailable</p>'
      + '<p class="empty-state__message">' + String(message || 'FlockOS could not be resolved from this location.') + '</p>'
      + '</div>';
    grid.appendChild(card);
  }

  async function start() {
    var grid = document.getElementById('the-shepherd-grid');
    if (!grid) {
      return;
    }

    var shell = initializeShell();
    try {
      var url = await resolveAppFlockOsUrl();
      grid.innerHTML = '';
      grid.appendChild(buildIntroCard(url));
    } catch (error) {
      console.warn('[The Shepherd] Failed to resolve embedded FlockOS shell:', error);
      renderFallback('The embedded FlockOS shell could not be located.');
    }

    return shell;
  }

  onReady(function () {
    start().catch(function (error) {
      console.error('[The Shepherd] Failed to initialize section:', error);
      renderFallback('The embedded FlockOS shell failed to load.');
    });
  });
})();
