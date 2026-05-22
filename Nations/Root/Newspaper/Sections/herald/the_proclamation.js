// the_proclamation.js — Section 1: The Herald
// Phase 2 will wire Firestore + Data/* fallbacks.
// This stub initializes the page and sets the date.

(function() {
  'use strict';

  const Herald = {
    init() {
      this.renderDate();
      this.loadConfig();
      this.renderSkeletons();
      // Phase 2: wire Firestore flockNews, psalms, oneYearBible, prayers
    },

    renderDate() {
      const el = document.getElementById('herald-date');
      if (!el) return;
      const now = new Date();
      el.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    },

    loadConfig() {
      // Editor's Desk overrides from The Shepherd section
      try {
        return JSON.parse(localStorage.getItem('flock_herald_config') || '{}');
      } catch { return {}; }
    },

    renderSkeletons() {
      // Placeholder — Phase 2 replaces with live data
      const grid = document.getElementById('herald-grid');
      if (!grid) return;
      // Skeletons already in HTML; Phase 2 swaps them for real cards
    }
  };

  document.addEventListener('DOMContentLoaded', () => Herald.init());
  window.Herald = Herald;
})();
