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
      sectionId: 'the_family',
      title: 'The Family',
      authLevel: 0,
      pageRoot: document.getElementById('the-family-grid'),
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
