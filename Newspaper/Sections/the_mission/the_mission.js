/* ═══════════════════════════════════════════════════════════════════════════
   the_mission.js — Section 5: The Mission
   People Groups Prayer Cards — powered by Joshua Project API
   Tap a country → drawer opens with unreached/frontier people group cards.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Joshua Project API Config ─────────────────────────────────────────── */
  /* Register for a free key at https://api.joshuaproject.net               */
  var JP_API_KEY = '75c0d936a53c'; // ← paste your key here
  var JP_BASE    = 'https://api.joshuaproject.net/v1';
  var CACHE_TTL  = 86400000; // 24 hours in ms
  var CACHE_KEY  = 'jp_countries_v2';

  /* ── State ──────────────────────────────────────────────────────────────── */
  var _countries    = [];
  var _filtered     = [];
  var _activeRegion = 'all';
  var _searchQuery  = '';
  var _pgCache      = {}; // { ctryId: [groups] }

  /* ── Utility: HTML escaping ─────────────────────────────────────────────── */
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  /* ── Utility: flag emoji from ISO-2 country code ───────────────────────── */
  function flagEmoji(iso2) {
    if (!iso2 || iso2.length !== 2) return '🌐';
    return Array.from(iso2.toUpperCase()).map(function (c) {
      return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65);
    }).join('');
  }

  /* ── Utility: number formatting ─────────────────────────────────────────── */
  function fmtPop(n) {
    n = parseInt(n, 10);
    if (!n || isNaN(n)) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return n.toString();
  }

  function fmtPct(n) {
    var v = parseFloat(n);
    if (isNaN(v)) return '—';
    if (v === 0)  return '0%';
    if (v < 0.1)  return '<0.1%';
    return v.toFixed(1) + '%';
  }

  /* ── Utility: reached status helpers ───────────────────────────────────── */
  function reachClass(jpText, frontier) {
    if (frontier === 1 || frontier === '1') return 'frontier';
    if (!jpText) return 'unknown';
    var t = jpText.toLowerCase();
    if (t.includes('frontier'))     return 'frontier';
    if (t.includes('unreached'))    return 'unreached';
    if (t.includes('minimally'))    return 'minimal';
    if (t.includes('superficially')) return 'superficial';
    if (t.includes('reached'))      return 'reached';
    return 'unknown';
  }

  function reachLabel(jpText, frontier) {
    if (frontier === 1 || frontier === '1') return 'Frontier';
    return jpText || 'Unknown';
  }

  /* ── Strip HTML tags safely from JP API text fields ──────────────────────── */
  function stripTags(html) {
    if (!html) return '';
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ── API: fetch countries list (cached in sessionStorage 24h) ──────────── */
  function fetchCountries() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        var cached = JSON.parse(raw);
        if (cached.ts && (Date.now() - cached.ts) < CACHE_TTL) {
          return Promise.resolve(cached.data);
        }
      }
    } catch (e) { /* ignore */ }

    var url = JP_BASE + '/countries.json?api_key=' + encodeURIComponent(JP_API_KEY) +
      '&select=Ctry,CtryID,RegionName,Population' +
      '&limit=300&sort_field=Ctry&sort_dir=ASC';

    return fetch(url).then(function (resp) {
      if (!resp.ok) throw new Error('JP API responded with ' + resp.status);
      return resp.json();
    }).then(function (data) {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
      } catch (e) { /* quota exceeded — skip cache */ }
      return data;
    });
  }

  /* ── API: fetch people groups for a country (in-memory cached) ──────────── */
  function fetchPeopleGroups(ctryId) {
    if (_pgCache[ctryId]) return Promise.resolve(_pgCache[ctryId]);

    var url = JP_BASE + '/people_groups.json?api_key=' + encodeURIComponent(JP_API_KEY) +
      '&countries=' + encodeURIComponent(ctryId) +
      '&select=PeopNameAcrossCountries,Population,PercentEvangelical,PercentAdherents' +
        ',PhotoAddress,SummaryProfile,PrayerGoals,JPScaleText,Frontier' +
      '&limit=100&sort_field=Population&sort_dir=DESC';

    return fetch(url).then(function (resp) {
      if (!resp.ok) throw new Error('JP API responded with ' + resp.status);
      return resp.json();
    }).then(function (data) {
      _pgCache[ctryId] = data;
      return data;
    });
  }

  /* ── Render: region filter tabs ─────────────────────────────────────────── */
  function getRegions(countries) {
    var seen = Object.create(null);
    var list = [];
    countries.forEach(function (c) {
      var r = (c.RegionName || 'Other').trim();
      if (!seen[r]) { seen[r] = true; list.push(r); }
    });
    return list.sort();
  }

  function renderRegionTabs(regions) {
    var el = document.getElementById('mission-region-tabs');
    if (!el) return;

    var tabs = [{ id: 'all', label: 'All Regions' }].concat(
      regions.map(function (r) { return { id: r, label: r }; })
    );

    el.innerHTML = tabs.map(function (t) {
      var active = t.id === _activeRegion ? ' is-active' : '';
      return '<button class="mission-region-tab' + active + '" data-region="' + esc(t.id) + '" type="button">' +
        esc(t.label) + '</button>';
    }).join('');

    el.addEventListener('click', function (e) {
      var btn = e.target.closest('.mission-region-tab');
      if (!btn) return;
      _activeRegion = btn.dataset.region;
      el.querySelectorAll('.mission-region-tab').forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.region === _activeRegion);
      });
      applyFilter();
    });
  }

  /* ── Render: country list ─────────────────────────────────────────────── */
  function applyFilter() {
    var q = _searchQuery;
    _filtered = _countries.filter(function (c) {
      var matchRegion = _activeRegion === 'all' || (c.RegionName || '').trim() === _activeRegion;
      var matchSearch = !q || c.Ctry.toLowerCase().includes(q);
      return matchRegion && matchSearch;
    });
    renderList();
  }

  function renderList() {
    var el = document.getElementById('mission-countries-list');
    if (!el) return;

    if (!_filtered.length) {
      el.innerHTML = '<p class="mission-empty">No countries match your search.</p>';
      return;
    }

    el.innerHTML = _filtered.map(function (c) {
      return '<button class="country-row" ' +
        'data-ctry-id="' + esc(c.CtryID) + '" ' +
        'data-ctry-name="' + esc(c.Ctry) + '" ' +
        'type="button" role="listitem">' +
        '<span class="country-row__flag" aria-hidden="true">' + flagEmoji(c.CtryID) + '</span>' +
        '<span class="country-row__info">' +
          '<span class="country-row__name">' + esc(c.Ctry) + '</span>' +
          '<span class="country-row__meta">' + esc(c.RegionName || '') +
            (c.Population ? ' · ' + fmtPop(c.Population) : '') +
          '</span>' +
        '</span>' +
        '<svg class="country-row__chevron" viewBox="0 0 24 24" fill="none" ' +
          'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M9 18l6-6-6-6"/>' +
        '</svg>' +
      '</button>';
    }).join('');

    /* Attach one delegated listener — remove previous to avoid stacking */
    el.removeEventListener('click', handleCountryClick);
    el.addEventListener('click', handleCountryClick);
  }

  function handleCountryClick(e) {
    var row = e.target.closest('.country-row');
    if (!row) return;
    openCountry(row.dataset.ctryId, row.dataset.ctryName);
  }

  /* ── Open country drawer ────────────────────────────────────────────────── */
  function openCountry(ctryId, ctryName) {
    var flag = flagEmoji(ctryId);

    var loadingHTML =
      '<div class="mission-drawer-loading" aria-live="polite">' +
        '<div class="skeleton skeleton-line skeleton-line--heading" style="width:55%"></div>' +
        '<div class="skeleton skeleton-line" style="margin-top:.75rem"></div>' +
        '<div class="skeleton skeleton-line skeleton-line--short"></div>' +
        '<div class="skeleton skeleton-line" style="margin-top:1.25rem;width:55%"></div>' +
        '<div class="skeleton skeleton-line"></div>' +
        '<div class="skeleton skeleton-line skeleton-line--short"></div>' +
      '</div>';

    window.FlockGates.openDrawer(flag + '\u2002' + ctryName, loadingHTML);

    fetchPeopleGroups(ctryId).then(function (groups) {
      var bodyEl = document.getElementById('drawer-body');
      if (!bodyEl) return;

      if (!groups || !groups.length) {
        bodyEl.innerHTML =
          '<p class="mission-empty" style="margin-top:1.5rem">' +
          'No unreached people group data found for ' + esc(ctryName) + '.</p>';
        return;
      }

      bodyEl.innerHTML =
        '<p class="mission-drawer-count">' +
          groups.length + '\u2002people group' + (groups.length !== 1 ? 's' : '') +
        '</p>' +
        groups.map(renderPrayerCard).join('');

    }).catch(function () {
      var bodyEl = document.getElementById('drawer-body');
      if (bodyEl) {
        bodyEl.innerHTML =
          '<p class="mission-error">Failed to load people groups. ' +
          'Check your API key or network connection.</p>';
      }
    });
  }

  /* ── Render: single prayer card ─────────────────────────────────────────── */
  function renderPrayerCard(g) {
    var name    = g.PeopNameAcrossCountries || g.PeopNameInCountry || 'Unknown People Group';
    var rc      = reachClass(g.JPScaleText, g.Frontier);
    var rl      = reachLabel(g.JPScaleText, g.Frontier);
    var photo   = (g.PhotoAddress || '').trim();
    var summary = stripTags(g.SummaryProfile || '');
    var prayers = stripTags(g.PrayerGoals   || '');

    var photoHTML = photo
      ? '<img class="prayer-card__photo" src="' + esc(photo) + '" ' +
          'alt="' + esc(name) + '" loading="lazy" ' +
          'onerror="this.classList.add(\'prayer-card__photo--error\')">'
      : '<div class="prayer-card__photo prayer-card__photo--placeholder" aria-hidden="true">🙏</div>';

    var summaryHTML = summary
      ? '<p class="prayer-card__summary">' + esc(summary) + '</p>'
      : '';

    var prayersHTML = prayers
      ? '<div class="prayer-card__prayers">' +
          '<h4 class="prayer-card__prayers-title">Prayer Points</h4>' +
          '<p class="prayer-card__prayers-text">' + esc(prayers) + '</p>' +
        '</div>'
      : '';

    return '<article class="prayer-card prayer-card--' + rc + '">' +
      '<div class="prayer-card__top">' +
        photoHTML +
        '<div class="prayer-card__header">' +
          '<h3 class="prayer-card__name">' + esc(name) + '</h3>' +
          '<span class="prayer-card__badge prayer-card__badge--' + rc + '">' + esc(rl) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="prayer-card__stats">' +
        statPill('Population', fmtPop(g.Population)) +
        statPill('Evangelical', fmtPct(g.PercentEvangelical)) +
        statPill('Christian',   fmtPct(g.PercentAdherents)) +
      '</div>' +
      summaryHTML +
      prayersHTML +
    '</article>';
  }

  function statPill(label, value) {
    return '<div class="stat-pill">' +
      '<span class="stat-pill__label">' + esc(label) + '</span>' +
      '<span class="stat-pill__value">' + esc(value) + '</span>' +
    '</div>';
  }

  /* ── Init ───────────────────────────────────────────────────────────────── */
  function init() {
    /* Wire up search */
    var searchEl = document.getElementById('mission-search');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        _searchQuery = this.value.toLowerCase().trim();
        applyFilter();
      });
    }

    /* Guard: no API key yet */
    var listEl = document.getElementById('mission-countries-list');
    if (JP_API_KEY === 'YOUR_JOSHUA_PROJECT_API_KEY') {
      if (listEl) {
        listEl.innerHTML =
          '<div class="mission-api-notice">' +
            '<p><strong>API key needed.</strong> Open <code>the_mission.js</code> and ' +
            'replace <code>YOUR_JOSHUA_PROJECT_API_KEY</code> with your free key.</p>' +
            '<p>Register at ' +
            '<a href="https://api.joshuaproject.net" target="_blank" rel="noopener noreferrer">' +
            'api.joshuaproject.net</a></p>' +
          '</div>';
      }
      return;
    }

    /* Show skeleton while loading */
    if (listEl) {
      listEl.innerHTML =
        '<div class="mission-skeleton-group">' +
          '<div class="skeleton skeleton-line" style="width:50%;margin-bottom:1rem"></div>' +
          '<div class="skeleton skeleton-line" style="width:70%"></div>' +
          '<div class="skeleton skeleton-line" style="width:65%"></div>' +
          '<div class="skeleton skeleton-line" style="width:80%"></div>' +
          '<div class="skeleton skeleton-line" style="width:55%"></div>' +
        '</div>';
    }

    fetchCountries().then(function (data) {
      _countries = Array.isArray(data) ? data : [];
      _filtered  = _countries.slice();
      renderRegionTabs(getRegions(_countries));
      renderList();
    }).catch(function () {
      if (listEl) {
        listEl.innerHTML =
          '<p class="mission-error">Failed to load countries. ' +
          'Check your Joshua Project API key and network connection.</p>';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
