(function () {
  'use strict';

  function start() {
    var shellInit = null;
    if (window.NewspaperShell && typeof window.NewspaperShell.initializeSectionShell === 'function') {
      shellInit = window.NewspaperShell.initializeSectionShell;
    } else if (typeof window.initializeSectionShell === 'function') {
      shellInit = window.initializeSectionShell;
    }

    if (typeof shellInit !== 'function') {
      return;
    }

    shellInit({
      sectionId: 'the_weavers',
      title: 'The Weavers',
      authLevel: 3,
      pageRoot: document.getElementById('the-weavers-grid'),
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
