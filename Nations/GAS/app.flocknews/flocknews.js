/**
 * FlockNews — Daily Spiritual Content for Your Church
 * Displays mission updates, Bible readings, devotionals, word studies, and Bible book highlights
 * Pastor+ users can edit all content with rich text editing powered by Google Docs features
 */

import { mountUnityHeader } from '../Scripts/the_unity_header.js';
import missionsData from '../Data/missions.js';
import devotionalsData from '../Data/devotionals.js';
import oneYearBibleData from '../Data/one_year_bible.js';
import strongsGreekData from '../Data/strongs-greek.js';
import strongsHebrewData from '../Data/strongs-hebrew.js';
import booksOfBibleData from '../Data/books-of-the-bible.js';

// Joshua Project API configuration
const JP_API_BASE = 'https://api.joshuaproject.net/v1';
const JP_API_KEY = '75c0d936a53c'; // Hardcoded for public access across all deployments

// FlockNews State
const FlockNewsState = {
  db: null,
  auth: null,
  currentUser: null,
  isPastorPlus: false,
  editMode: false,
  currentEditSection: null,
  unreachedOfDay: null,
  countryOfDay: null,
  bibleAccessSpotlight: null,
  newsData: {
    introduction: { title: '', content: '', lastUpdated: null },
    pastorHeart: { title: '', content: '', lastUpdated: null },
    announcements: { title: '', content: '', lastUpdated: null },
    mission: { title: '', content: '', lastUpdated: null },
    reading: { passage: '', reference: '', content: '', lastUpdated: null },
    devotional: { title: '', content: '', author: '', lastUpdated: null },
    greekWord: { 
      term: '', 
      transliteration: '', 
      definition: '', 
      nuance: '', 
      strongs: '', 
      examples: '',
      lastUpdated: null 
    },
    hebrewWord: { 
      term: '', 
      transliteration: '', 
      definition: '', 
      nuance: '', 
      strongs: '', 
      examples: '',
      lastUpdated: null 
    },
    book: { 
      name: '', 
      testament: '',
      author: '', 
      date: '', 
      chapters: 0,
      verses: 0,
      readingTime: '',
      overview: '', 
      themes: [], 
      keyVerses: '',
      lastUpdated: null 
    }
  },
  dateKey: '' // Format: YYYY-MM-DD
};

// Silently check pastor+ edit permissions after the page is fully rendered.
// Polls for Nehemiah to be ready (max 8s) without blocking the initial load.
function _checkEditPermissions() {
  let attempts = 0;
  const maxAttempts = 80; // 8 seconds — plenty of time after render

  const poll = () => {
    attempts++;
    if (typeof Nehemiah !== 'undefined') {
      if (Nehemiah.isAuthenticated()) {
        const profile = Nehemiah.getProfile();
        if (profile) {
          FlockNewsState.currentUser = {
            uid: profile.uid,
            displayName: profile.displayName || profile.email,
            email: profile.email,
            role: profile.role || 'member',
          };
          FlockNewsState.isPastorPlus = (profile.role === 'pastor' || profile.role === 'admin');
          // Authenticate with Firebase so Firestore reads work
          if (typeof UpperRoom !== 'undefined') {
            try {
              await UpperRoom.init(window.FLOCK_FIREBASE_CONFIG || window.FIREBASE_CONFIG || null);
              await UpperRoom.authenticate();
              console.log('[FlockNews] UpperRoom authenticated for editor');
            } catch (e) {
              console.warn('[FlockNews] UpperRoom authenticate failed:', e);
            }
          }
          if (FlockNewsState.isPastorPlus) {
            const editBtn = document.getElementById('fn-edit-toggle');
            if (editBtn) editBtn.style.display = 'flex';
            console.log('[FlockNews] Editor permissions granted:', profile.displayName || profile.email);
          }
        }
      }
      // Nehemiah loaded but not authenticated — stay as guest, nothing to do
      return;
    }
    if (attempts < maxAttempts) setTimeout(poll, 100);
    // else: timed out — stay as guest silently
  };

  setTimeout(poll, 100); // Start polling after a tick (non-blocking)
}

// Initialize FlockNews
async function initFlockNews() {
  console.log('🚀 FlockNews: Initializing...');

  try {
    // Guest mode by default — edit permissions resolved lazily after render
    FlockNewsState.currentUser = null;
    FlockNewsState.isPastorPlus = false;

    // Initialize Firebase if available
    if (typeof firebase !== 'undefined') {
      FlockNewsState.db = firebase.firestore();
      FlockNewsState.auth = firebase.auth();
      console.log('✅ Firebase initialized');
    }

    // Set current date
    setCurrentDate();

    // Mount Unity Header
    mountHeader();

    // Fetch missions data in parallel (non-blocking)
    const missionsPromise = Promise.all([
      fetchUnreachedOfDay(),
      Promise.resolve(selectCountryOfDay()),
      Promise.resolve(selectBibleAccessSpotlight())
    ]);

    // Load content
    await loadNewsContent();

    // Wait for missions data and render
    const [unreached, country, bibleAccess] = await missionsPromise;
    FlockNewsState.unreachedOfDay = unreached;
    FlockNewsState.countryOfDay = country;
    FlockNewsState.bibleAccessSpotlight = bibleAccess;
    renderMission(); // Re-render mission section with live data

    // Initialize Google Docs features if available
    if (window.initializeGoogleDocsFeatures) {
      console.log('✅ Google Docs features available for rich text editing');
    }

    // Initialize Google Sheets features if available
    if (window.initializeGoogleSheetsFeatures) {
      console.log('✅ Google Sheets features available for table insertion');
    }

  } catch (error) {
    console.error('❌ FlockNews initialization error:', error);
    showError('Failed to initialize FlockNews. Please refresh the page.');
  }
}

// Mount Unity Header
function mountHeader() {
  const appIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg>';
  
  mountUnityHeader(document.getElementById('unityHeader'), {
    appId: 'flocknews',
    appName: 'FlockNews',
    appIconSvg,
    appAccent: '#1b264f',
    appAccentDk: '#0f1735',
    homeHref: 'app.flocknews/app.flocknews.html',
    user: FlockNewsState.currentUser,
    onSignOut: async () => {
      try {
        if (typeof Nehemiah !== 'undefined') {
          await Nehemiah.logout();
        }
        window.location.replace('app.flocknews/index.html');
      } catch (err) {
        console.error('[FlockNews] Sign out failed:', err);
      }
    },
    onHamburger: () => {
      // Future: toggle sidebar
    },
  });
}

// Set current date display
function setCurrentDate() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = now.toLocaleDateString('en-US', options);
  
  // Set date key for Firestore (YYYY-MM-DD)
  FlockNewsState.dateKey = now.toISOString().split('T')[0];
  
  document.getElementById('fn-current-date').textContent = formattedDate;
}

// Load news content from Firestore
async function loadNewsContent() {
  const loadingEl = document.getElementById('fn-loading');
  const feedEl = document.getElementById('fn-news-feed');
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  try {
    loadingEl.style.display = 'block';
    feedEl.style.display = 'none';

    // Load reading and devotional from static data files (public access)
    // Reading: one_year_bible.js - match by day of year
    const dayNum = getDayOfYear();
    const readingEntry = oneYearBibleData.find((e) => e.day === dayNum) || oneYearBibleData[0];
    if (readingEntry) {
      FlockNewsState.newsData.reading = {
        passage: `${readingEntry.date} Reading`,
        reference: `OT: ${readingEntry.ot}, NT: ${readingEntry.nt}, Psalm ${readingEntry.ps}, Proverbs ${readingEntry.pr}`,
        content: `
          <h2>${readingEntry.date} — One Year Bible</h2>
          <div style="display: grid; gap: 16px; margin-top: 16px;">
            <div style="padding: 12px; background: rgba(251,146,60,0.15); border-left: 4px solid #fb923c; border-radius: 6px;">
              <strong style="color: #fb923c;">📜 Old Testament:</strong> ${readingEntry.ot}
            </div>
            <div style="padding: 12px; background: rgba(96,165,250,0.15); border-left: 4px solid #60a5fa; border-radius: 6px;">
              <strong style="color: #60a5fa;">✝️ New Testament:</strong> ${readingEntry.nt}
            </div>
            <div style="padding: 12px; background: rgba(34,197,94,0.15); border-left: 4px solid #22c55e; border-radius: 6px;">
              <strong style="color: #22c55e;">🎶 Psalms:</strong> ${readingEntry.ps}
            </div>
            <div style="padding: 12px; background: rgba(250,204,21,0.15); border-left: 4px solid #facc15; border-radius: 6px;">
              <strong style="color: #facc15;">💡 Proverbs:</strong> ${readingEntry.pr}
            </div>
          </div>
        `,
        lastUpdated: new Date().toISOString()
      };
      console.log('✅ Loaded Bible reading from one_year_bible.js for day', dayNum);
    }

    // Devotional: devotionals.js - match by date (find closest date on or before today)
    const today = FlockNewsState.dateKey;
    const devotionalEntry = devotionalsData
      .filter((d) => (d.date || d.Date || '') <= today)
      .sort((a, b) => (b.date || b.Date || '').localeCompare(a.date || a.Date || ''))[0];
    
    if (devotionalEntry) {
      FlockNewsState.newsData.devotional = {
        title: devotionalEntry.title || 'Daily Devotional',
        author: 'Pastor',
        content: `
          <h2>${devotionalEntry.title || 'Daily Devotional'}</h2>
          ${devotionalEntry.scripture ? `<p style="font-style: italic; color: var(--fn-gold); margin: 12px 0;">${devotionalEntry.scripture}</p>` : ''}
          ${devotionalEntry.theme ? `<p style="font-weight: 600; color: var(--fn-gold);">Theme: ${devotionalEntry.theme}</p>` : ''}
          ${devotionalEntry.reflection ? `<p>${devotionalEntry.reflection}</p>` : ''}
          ${devotionalEntry.question ? `<p style="margin-top: 16px;"><strong>Reflection Question:</strong> ${devotionalEntry.question}</p>` : ''}
          ${devotionalEntry.prayer ? `<p style="margin-top: 16px; font-style: italic; color: var(--fn-muted);">${devotionalEntry.prayer}</p>` : ''}
        `,
        lastUpdated: devotionalEntry.date || new Date().toISOString()
      };
      console.log('✅ Loaded devotional from devotionals.js for', devotionalEntry.date);
    }

    // Load other sections from Firestore (for pastor+ edits) or use defaults
    let loadedFromFirestore = false;

    // Try loading from Firestore - fetch from flockNews collection
    if (FlockNewsState.db) {
      try {
        // Fetch other sections from 'flockNews' collection
        const newsRef = FlockNewsState.db.collection('flockNews').doc(FlockNewsState.dateKey);
        const newsDoc = await newsRef.get();
        
        if (newsDoc.exists) {
          const newsData = newsDoc.data();
          // Update other sections if they exist in flockNews collection
          if (newsData.introduction) FlockNewsState.newsData.introduction = newsData.introduction;
          if (newsData.pastorHeart) FlockNewsState.newsData.pastorHeart = newsData.pastorHeart;
          if (newsData.announcements) FlockNewsState.newsData.announcements = newsData.announcements;
          if (newsData.mission) FlockNewsState.newsData.mission = newsData.mission;
          if (newsData.greekWord) FlockNewsState.newsData.greekWord = newsData.greekWord;
          if (newsData.hebrewWord) FlockNewsState.newsData.hebrewWord = newsData.hebrewWord;
          if (newsData.book) FlockNewsState.newsData.book = newsData.book;
          console.log('✅ Loaded additional news content from Firestore for', FlockNewsState.dateKey);
          loadedFromFirestore = true;
        }

      } catch (firestoreError) {
        console.warn('⚠️ Firestore error (expected in dev mode):', firestoreError.message);
      }
    }

    // If not loaded from Firestore, try localStorage (dev mode)
    if (!loadedFromFirestore) {
      const stored = localStorage.getItem(`flockNews_${FlockNewsState.dateKey}`);
      if (stored) {
        try {
          const storedData = JSON.parse(stored);
          // Only load non-reading, non-devotional sections from localStorage
          if (storedData.introduction) FlockNewsState.newsData.introduction = storedData.introduction;
          if (storedData.pastorHeart) FlockNewsState.newsData.pastorHeart = storedData.pastorHeart;
          if (storedData.announcements) FlockNewsState.newsData.announcements = storedData.announcements;
          if (storedData.mission) FlockNewsState.newsData.mission = storedData.mission;
          if (storedData.greekWord) FlockNewsState.newsData.greekWord = storedData.greekWord;
          if (storedData.hebrewWord) FlockNewsState.newsData.hebrewWord = storedData.hebrewWord;
          if (storedData.book) FlockNewsState.newsData.book = storedData.book;
          console.log('✅ Loaded additional content from localStorage for', FlockNewsState.dateKey);
        } catch (parseError) {
          console.warn('⚠️ Failed to parse localStorage data:', parseError);
        }
      }
    }

    // Fill in any missing sections with defaults
    await fillMissingWithDefaults();

    // Render all sections
    renderIntroduction();
    renderPastorHeart();
    renderAnnouncements();
    renderMission();
    renderReading();
    renderDevotional();
    renderWords();
    renderBook();

    loadingEl.style.display = 'none';
    feedEl.style.display = 'grid';

  } catch (error) {
    console.error('❌ Error loading news content:', error);
    // Show default content anyway
    await initializeDefaultContent();
    renderMission();
    renderReading();
    renderDevotional();
    renderWords();
    renderBook();
    loadingEl.style.display = 'none';
    feedEl.style.display = 'grid';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MISSIONS INTEGRATION — Unreached People Group & Country of the Day
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch unreached people group of the day from Joshua Project API
 * Uses hardcoded API key for public access across all deployments
 */
async function fetchUnreachedOfDay() {
  try {
    const response = await fetch(`${JP_API_BASE}/people_groups/daily_unreached.json?api_key=${encodeURIComponent(JP_API_KEY)}`);
    if (!response.ok) {
      console.error('[FlockNews] Joshua Project API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const group = Array.isArray(data) && data.length > 0 ? data[0] : null;
    
    if (group) {
      console.log('✅ Fetched unreached people group of the day:', group.PeopNameInCountry || group.PeopNameAcrossCountries);
    }

    return group;
  } catch (error) {
    console.error('[FlockNews] Error fetching unreached of the day:', error);
    return null;
  }
}

/**
 * Select country of the day from missions registry
 * Uses day of year to rotate through countries with high missions priority
 */
function selectCountryOfDay() {
  if (!missionsData || !Array.isArray(missionsData) || missionsData.length === 0) {
    console.warn('[FlockNews] No missions data available');
    return null;
  }

  // Filter for countries with significant missions need:
  // - 10/40 Window countries
  // - High persecution levels
  // - Low evangelical percentage
  // - High unreached population
  const priorityCountries = missionsData.filter(c => {
    return (
      c.tenFortyWindow === true ||
      c.worldWatchListRank <= 50 ||
      c.restrictionsRank <= 20 ||
      (c.evangelicalPercent != null && c.evangelicalPercent < 5) ||
      (c.unreachedGroups != null && c.unreachedGroups >= 10)
    );
  });

  if (priorityCountries.length === 0) {
    console.warn('[FlockNews] No priority countries found, using all countries');
    return missionsData[getDayOfYear() % missionsData.length];
  }

  // Rotate through priority countries based on day of year
  const dayOfYear = getDayOfYear();
  const country = priorityCountries[dayOfYear % priorityCountries.length];
  
  console.log('✅ Selected country of the day:', country.countryName);
  return country;
}

/**
 * Get current day of year (1-365/366)
 */
function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Select Bible Access Spotlight country - prioritizes critical Bible shortage and access restriction needs
 * Rotates daily based on day of year through countries with highest needs
 */
function selectBibleAccessSpotlight() {
  // Filter countries with critical Bible access needs
  const criticalAccessCountries = missionsData.filter((c) => {
    return (
      c.restrictionsRank <= 30 ||
      c.bibleShortageRank <= 50 ||
      c.bibleShortageTier === 'Severe' ||
      c.bibleShortageTier === 'Extreme' ||
      c.bibleShortageTier === 'Moderate'
    );
  });

  if (criticalAccessCountries.length === 0) {
    console.warn('[FlockNews] No critical Bible access countries found, using subset');
    return missionsData.filter(c => c.bibleShortageRank || c.restrictionsRank)[0];
  }

  // Rotate through critical countries based on day of year + offset to avoid duplicates with country of day
  const dayOfYear = getDayOfYear();
  const country = criticalAccessCountries[(dayOfYear + 123) % criticalAccessCountries.length];
  
  console.log('✅ Selected Bible Access Spotlight:', country.countryName);
  return country;
}

/**
 * Format Bible Access List card HTML
 */
function formatBibleAccessCard(country) {
  if (!country) {
    return '<div class="fn-missions-empty"><p>No Bible Access data available</p></div>';
  }

  const _e = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  
  const name = _e(country.countryName || 'Unknown');
  const icon = country.icon || '🌍';
  const population = country.population ? Number(country.population).toLocaleString() : '—';
  const bibleShortageRank = country.bibleShortageRank || '—';
  const bibleShortageTier = country.bibleShortageTier ? _e(country.bibleShortageTier) : '—';
  const bibleShortageRange = country.bibleShortageRange ? _e(country.bibleShortageRange) : '';
  const restrictionsRank = country.restrictionsRank || '';
  const evangelical = country.evangelicalPercent != null ? country.evangelicalPercent.toFixed(2) + '%' : '—';
  
  // Determine severity color
  let severityColor = '#fbbf24'; // default yellow
  let severityLabel = bibleShortageTier;
  if (bibleShortageTier === 'Extreme' || bibleShortageTier === 'Severe') {
    severityColor = '#ef4444'; // red
  } else if (bibleShortageTier === 'Moderate') {
    severityColor = '#f97316'; // orange
  } else if (bibleShortageTier === 'Minor') {
    severityColor = '#fbbf24'; // yellow
  }

  const restrictionBadge = restrictionsRank ? `<span class="fn-country-badge" style="background: rgba(239,68,68,0.1); color: #ef4444;">🚫 Access Rank #${restrictionsRank}</span>` : '';

  return `
    <div class="fn-bible-access-card">
      <div class="fn-bible-access-header">
        <div class="fn-bible-access-title">
          <span class="fn-country-icon">${icon}</span>
          <h3>${name}</h3>
        </div>
        <span class="fn-country-label">📖 Bible Access Spotlight</span>
      </div>
      
      <div class="fn-bible-access-badges">
        <span class="fn-country-badge" style="background: rgba(${severityColor === '#ef4444' ? '239,68,68' : severityColor === '#f97316' ? '249,115,22' : '251,191,36'},0.1); color: ${severityColor};">
          📚 ${severityLabel} Need
        </span>
        ${restrictionBadge}
      </div>
      
      <div class="fn-country-stats">
        <div class="fn-country-stat">
          <div class="fn-stat-value">${population}</div>
          <div class="fn-stat-label">Population</div>
        </div>
        <div class="fn-country-stat">
          <div class="fn-stat-value">${evangelical}</div>
          <div class="fn-stat-label">Evangelical</div>
        </div>
        <div class="fn-country-stat">
          <div class="fn-stat-value">#${bibleShortageRank}</div>
          <div class="fn-stat-label">Shortage Rank</div>
        </div>
      </div>

      <div class="fn-country-details">
        ${bibleShortageRange ? `<p><strong>Estimated Need:</strong> ${bibleShortageRange}</p>` : ''}
        <p><strong>Why It Matters:</strong> Millions need Scripture in their heart language. Bible translation and distribution face significant barriers in countries with restricted access.</p>
      </div>

      <a class="fn-country-link" href="https://bibleaccesslist.org/en/" target="_blank" rel="noopener noreferrer">
        View Bible Access List ↗
      </a>
    </div>
  `;
}

/**
 * Format Frontlines International card HTML
 */
function formatFrontlinesCard() {
  return `
    <div class="fn-frontlines-card">
      <div class="fn-frontlines-header">
        <div class="fn-frontlines-title">
          <span class="fn-country-icon">⛪</span>
          <h3>Frontlines International</h3>
        </div>
        <span class="fn-country-label">🕊️ Persecuted Church Ministry</span>
      </div>
      
      <div class="fn-frontlines-mission">
        <p><em>"Standing with the persecuted church around the world"</em></p>
      </div>

      <div class="fn-frontlines-stat-highlight">
        <div class="fn-stat-value" style="font-size: 48px; color: var(--fn-gold);">388M+</div>
        <div class="fn-stat-label">Christians living under persecution worldwide</div>
      </div>

      <div class="fn-frontlines-pillars">
        <h4 style="color: var(--fn-gold); margin-bottom: 12px; font-size: 16px;">Four Ministry Pillars:</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
          <div class="fn-pillar-item">
            <div class="fn-pillar-icon">📖</div>
            <div class="fn-pillar-name">Sowing God's Word</div>
          </div>
          <div class="fn-pillar-item">
            <div class="fn-pillar-icon">🎓</div>
            <div class="fn-pillar-name">Training</div>
          </div>
          <div class="fn-pillar-item">
            <div class="fn-pillar-icon">🤝</div>
            <div class="fn-pillar-name">Help in Time of Need</div>
          </div>
          <div class="fn-pillar-item">
            <div class="fn-pillar-icon">⛪</div>
            <div class="fn-pillar-name">Church Growth</div>
          </div>
        </div>
      </div>

      <div class="fn-country-details" style="margin-top: 16px;">
        <p><strong>The Need:</strong> Bible distribution is key. Biblical literacy is essential. Humanitarian aid and relief is critical.</p>
        <p style="margin-top: 8px;"><strong>Our Response:</strong> When needs are identified, we respond as quickly as possible. Time can be critical.</p>
      </div>

      <a class="fn-country-link" href="https://www.frontlinesinternational.org/" target="_blank" rel="noopener noreferrer">
        Learn More & Support ↗
      </a>
    </div>
  `;
}

/**
 * Format unreached people group card HTML
 */
function formatUnreachedCard(group) {
  if (!group) {
    return `
      <div class="fn-missions-empty">
        <p>📡 Unreached people group data currently unavailable.</p>
        <p style="font-size: 14px; color: var(--ink-muted); margin-top: 8px;">
          Please check your internet connection or try again later.
        </p>
      </div>
    `;
  }

  const _e = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  
  const name = _e(group.PeopNameInCountry || group.PeopNameAcrossCountries || 'Unknown People Group');
  const country = _e(group.Ctry || '');
  const population = group.Population ? Number(group.Population).toLocaleString() : '—';
  const language = _e(group.PrimaryLanguageName || '—');
  const religion = _e(group.PrimaryReligion || '—');
  const evangelical = group.PercentEvangelical != null ? parseFloat(group.PercentEvangelical).toFixed(2) + '%' : '—';
  const photo = _e(group.PeopleGroupPhotoURL || '');
  const url = _e(group.PeopleGroupURL || 'https://joshuaproject.net');
  const rawSummary = String(group.Summary || '');
  // Format summary with proper line breaks
  let summary = '';
  if (rawSummary) {
    const truncated = rawSummary.length > 280 ? rawSummary.slice(0, 280) + '…' : rawSummary;
    // Split into sentences for better readability
    summary = _e(truncated);
  }

  return `
    <div class="fn-unreached-card">
      <div class="fn-unreached-header">
        <span class="fn-unreached-label">🕊 Unreached People Group of the Day</span>
        ${country ? `<span class="fn-unreached-country">${country}</span>` : ''}
      </div>
      <div class="fn-unreached-body">
        ${photo ? `<img class="fn-unreached-photo" src="${photo}" alt="${name}" loading="lazy" onerror="this.style.display='none'">` : ''}
        <div class="fn-unreached-info">
          <h3 class="fn-unreached-name">${name}</h3>
          <div class="fn-unreached-stats">
            <span>👥 ${population}</span>
            <span>🗣️ ${language}</span>
            <span>🕌 ${religion}</span>
            <span>✝️ ${evangelical} evangelical</span>
          </div>
          ${summary ? `<p class="fn-unreached-summary">${summary}</p>` : ''}
          <a class="fn-unreached-link" href="${url}" target="_blank" rel="noopener noreferrer">
            View full profile on Joshua Project ↗
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Format country of the day card HTML
 */
function formatCountryCard(country) {
  if (!country) {
    return '<div class="fn-missions-empty"><p>No country data available</p></div>';
  }

  const _e = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  
  const name = _e(country.countryName || 'Unknown');
  const icon = country.icon || '🌍';
  const capital = _e(country.capital || '—');
  const population = country.population ? Number(country.population).toLocaleString() : '—';
  const unreachedGroups = country.unreachedGroups != null ? String(country.unreachedGroups) : '—';
  const evangelical = country.evangelicalPercent != null ? country.evangelicalPercent.toFixed(2) + '%' : '—';
  const christian = country.christianPercent != null ? country.christianPercent.toFixed(2) + '%' : '—';
  const jpUrl = country.jpProfileUrl || country.profileUrl || `https://joshuaproject.net/countries/${country.isoCode || ''}`;
  const persecutionLevel = country.persecutionLevel || country.persecutionLabel || '';
  const tenForty = country.tenFortyWindow ? '<span class="fn-country-badge fn-badge-1040">10/40 Window</span>' : '';
  const wwlRank = country.worldWatchListRank ? `<span class="fn-country-badge fn-badge-wwl">WWL Rank #${country.worldWatchListRank}</span>` : '';
  const region = _e(country.region || '');
  const gospelAccess = _e(country.gospelAccess || '');
  const owSummary = country.owSummary ? _e(country.owSummary.length > 400 ? country.owSummary.slice(0, 400) + '...' : country.owSummary) : '';
  const bibleShortage = country.bibleShortageTier || country.bibleShortageRange || '';
  const totalPeopleGroups = country.totalPeopleGroups || country.peopleGroups || '';

  return `
    <div class="fn-country-card">
      <div class="fn-country-header">
        <div class="fn-country-title">
          <span class="fn-country-icon">${icon}</span>
          <h3>${name}</h3>
        </div>
        <span class="fn-country-label">🌍 Country of the Day</span>
      </div>
      
      ${tenForty || wwlRank ? `<div class="fn-country-badges">${tenForty}${wwlRank}</div>` : ''}
      
      <div class="fn-country-stats">
        <div class="fn-country-stat">
          <div class="fn-stat-value">${population}</div>
          <div class="fn-stat-label">Population</div>
        </div>
        <div class="fn-country-stat">
          <div class="fn-stat-value">${unreachedGroups}</div>
          <div class="fn-stat-label">Unreached Groups</div>
        </div>
        <div class="fn-country-stat">
          <div class="fn-stat-value">${evangelical}</div>
          <div class="fn-stat-label">Evangelical</div>
        </div>
        <div class="fn-country-stat">
          <div class="fn-stat-value">${christian}</div>
          <div class="fn-stat-label">Christian</div>
        </div>
      </div>

      <div class="fn-country-details">
        <p><strong>Capital:</strong> ${capital}</p>
        ${region ? `<p><strong>Region:</strong> ${region}</p>` : ''}
        ${gospelAccess ? `<p><strong>Gospel Access:</strong> ${gospelAccess}</p>` : ''}
        ${totalPeopleGroups ? `<p><strong>People Groups:</strong> ${totalPeopleGroups}</p>` : ''}
        ${bibleShortage ? `<p><strong>Bible Shortage:</strong> ${_e(bibleShortage)}</p>` : ''}
        ${persecutionLevel ? `<p><strong>Persecution Level:</strong> ${_e(persecutionLevel)}</p>` : ''}
      </div>

      ${owSummary ? `<div class="fn-country-summary"><p>${owSummary}</p></div>` : ''}

      <a class="fn-country-link" href="${_e(jpUrl)}" target="_blank" rel="noopener noreferrer">
        View ${name} on Joshua Project ↗
      </a>
    </div>
  `;
}

// Get Greek Word of the Day from Strong's lexicon (rotates based on day of year)
function _getGreekWordOfDay() {
  const greekKeys = Object.keys(strongsGreekData);
  if (!greekKeys.length) return { term: '', transliteration: '', definition: '', nuance: '', strongs: '', examples: '', lastUpdated: new Date().toISOString() };
  
  const dayNum = getDayOfYear();
  const index = dayNum % greekKeys.length;
  const strongsNum = greekKeys[index];
  const entry = strongsGreekData[strongsNum];
  
  return {
    term: entry.lemma || '',
    transliteration: entry.translit || '',
    definition: entry.kjv_def || entry.strongs_def || '',
    nuance: entry.strongs_def || '',
    strongs: strongsNum,
    examples: entry.derivation || '',
    lastUpdated: new Date().toISOString()
  };
}

// Get Hebrew Word of the Day from Strong's lexicon (rotates based on day of year)
function _getHebrewWordOfDay() {
  const hebrewKeys = Object.keys(strongsHebrewData);
  if (!hebrewKeys.length) return { term: '', transliteration: '', definition: '', nuance: '', strongs: '', examples: '', lastUpdated: new Date().toISOString() };
  
  const dayNum = getDayOfYear();
  // Offset by half the year so Greek and Hebrew don't rotate in sync
  const index = (dayNum + 180) % hebrewKeys.length;
  const strongsNum = hebrewKeys[index];
  const entry = strongsHebrewData[strongsNum];
  
  return {
    term: entry.lemma || '',
    transliteration: entry.xlit || entry.pron || '',
    definition: entry.kjv_def || entry.strongs_def || '',
    nuance: entry.strongs_def || '',
    strongs: strongsNum,
    examples: entry.derivation || '',
    lastUpdated: new Date().toISOString()
  };
}

// Get Bible Book of the Day (rotates through all 66 books based on day of year)
function _getBookOfDay() {
  if (!booksOfBibleData.length) return { name: '', testament: '', author: '', date: '', chapters: 0, verses: 0, readingTime: '', overview: '', themes: [], keyVerses: '', lastUpdated: new Date().toISOString() };
  
  const dayNum = getDayOfYear();
  // Rotate through all 66 books: day 1-66, 67-132, etc.
  const index = (dayNum - 1) % booksOfBibleData.length;
  const book = booksOfBibleData[index];
  
  // Parse themes from string to array if needed
  const themes = Array.isArray(book.themes) ? book.themes : 
                 (typeof book.themes === 'string' ? book.themes.split(';').map(t => t.trim()) : []);
  
  return {
    name: book.bookName || '',
    testament: book.testament || '',
    author: book.author || '',
    date: book.timePeriod || '',
    chapters: 0, // Not in source data
    verses: 0,   // Not in source data
    readingTime: '',
    overview: book.summary || '',
    themes: themes,
    keyVerses: book.keyVerse || '',
    lastUpdated: new Date().toISOString()
  };
}

// Fill in any missing sections with default content
async function fillMissingWithDefaults() {
  await initializeDefaultContent();
  // initializeDefaultContent will set defaults for any empty sections
}

// Initialize default content (first time or missing day)
async function initializeDefaultContent() {
  const defaultData = {
    mission: {
      title: 'Unreached People Group',
      content: `
        <h2>Today's Mission Focus</h2>
        <p>Visit <a href="https://joshuaproject.net" target="_blank">Joshua Project</a> to discover today's unreached people group.</p>
        <p><em>Pastor: Click "Edit" to add today's mission information from Joshua Project.</em></p>
      `,
      lastUpdated: new Date().toISOString()
    },
    reading: {
      passage: 'Psalm 23',
      reference: 'Psalm 23:1-6',
      content: `
        <h2>Psalm 23:1-6 (ESV)</h2>
        <p><sup>1</sup> The LORD is my shepherd; I shall not want.<br>
        <sup>2</sup> He makes me lie down in green pastures.<br>
        He leads me beside still waters.<br>
        <sup>3</sup> He restores my soul.<br>
        He leads me in paths of righteousness for his name's sake.</p>
        <p><sup>4</sup> Even though I walk through the valley of the shadow of death,<br>
        I will fear no evil, for you are with me;<br>
        your rod and your staff, they comfort me.</p>
        <p><sup>5</sup> You prepare a table before me in the presence of my enemies;<br>
        you anoint my head with oil; my cup overflows.<br>
        <sup>6</sup> Surely goodness and mercy shall follow me all the days of my life,<br>
        and I shall dwell in the house of the LORD forever.</p>
      `,
      lastUpdated: new Date().toISOString()
    },
    devotional: {
      title: 'The Good Shepherd',
      author: 'Pastor',
      content: `
        <h2>The Good Shepherd</h2>
        <p>In Psalm 23, David paints a beautiful picture of God as our shepherd. Just as a shepherd cares for his flock, God cares for us with intimate knowledge and tender love.</p>
        <p>Notice the progression: provision ("I shall not want"), guidance ("green pastures," "still waters"), restoration ("restores my soul"), and protection ("valley of the shadow of death"). Every need is met by our Good Shepherd.</p>
        <p><strong>Today's Challenge:</strong> In what area of your life do you need to trust the Shepherd more fully? Where are you trying to lead yourself instead of following Him?</p>
        <p><em>Pastor: Click "Edit" to customize today's devotional.</em></p>
      `,
      lastUpdated: new Date().toISOString()
    },
    greekWord: _getGreekWordOfDay(),
    hebrewWord: _getHebrewWordOfDay(),
    book: _getBookOfDay()
  };

  // Only fill in sections that are empty or missing
  if (!FlockNewsState.newsData.mission || !FlockNewsState.newsData.mission.content) {
    FlockNewsState.newsData.mission = defaultData.mission;
  }
  if (!FlockNewsState.newsData.reading || !FlockNewsState.newsData.reading.content) {
    FlockNewsState.newsData.reading = defaultData.reading;
  }
  if (!FlockNewsState.newsData.devotional || !FlockNewsState.newsData.devotional.content) {
    FlockNewsState.newsData.devotional = defaultData.devotional;
  }
  if (!FlockNewsState.newsData.greekWord || !FlockNewsState.newsData.greekWord.term) {
    FlockNewsState.newsData.greekWord = defaultData.greekWord;
  }
  if (!FlockNewsState.newsData.hebrewWord || !FlockNewsState.newsData.hebrewWord.term) {
    FlockNewsState.newsData.hebrewWord = defaultData.hebrewWord;
  }
  if (!FlockNewsState.newsData.book || !FlockNewsState.newsData.book.name) {
    FlockNewsState.newsData.book = defaultData.book;
  }

  // Try to save defaults to Firestore, fall back to localStorage
  try {
    if (FlockNewsState.db) {
      // Save to appropriate collections
      await FlockNewsState.db.collection('reading').doc(FlockNewsState.dateKey).set(FlockNewsState.newsData.reading, { merge: true });
      await FlockNewsState.db.collection('devotionals').doc(FlockNewsState.dateKey).set(FlockNewsState.newsData.devotional, { merge: true });
      await FlockNewsState.db.collection('flockNews').doc(FlockNewsState.dateKey).set({
        mission: FlockNewsState.newsData.mission,
        greekWord: FlockNewsState.newsData.greekWord,
        hebrewWord: FlockNewsState.newsData.hebrewWord,
        book: FlockNewsState.newsData.book
      }, { merge: true });
      console.log('✅ Saved default content to Firestore for', FlockNewsState.dateKey);
    }
  } catch (error) {
    console.warn('⚠️ Could not save to Firestore (using localStorage):', error.message);
  }

  // Always save to localStorage as backup
  try {
    localStorage.setItem(`flockNews_${FlockNewsState.dateKey}`, JSON.stringify(defaultData));
    console.log('✅ Saved default content to localStorage for', FlockNewsState.dateKey);
  } catch (storageError) {
    console.error('❌ Error saving to localStorage:', storageError);
  }
}

// Render Mission section
// Render Mission section
// Render Introduction section
function renderIntroduction() {
  const content = FlockNewsState.newsData.introduction?.content || `
    <h2>Welcome to FlockNews</h2>
    <p>Welcome to this week's church bulletin and news feed! We're glad you're here.</p>
    <p>This is your central hub for staying connected with what God is doing in our church family. You'll find the pastor's weekly message, important announcements, mission updates, daily Scripture readings, devotionals, and more.</p>
    <p><strong>Stay Connected:</strong> Check back regularly for updates and be sure to share prayer requests and praises with your church family.</p>
  `;
  document.getElementById('fn-introduction-content').innerHTML = content;
}

// Render Pastor's Heart section
function renderPastorHeart() {
  const content = FlockNewsState.newsData.pastorHeart?.content || `
    <h2>A Word from Your Pastor</h2>
    <p><em>"Grace and peace to you from God our Father and the Lord Jesus Christ."</em> — 1 Corinthians 1:3</p>
    <p>Dear Church Family,</p>
    <p>As we gather together this week, I want to encourage each of you to remain steadfast in prayer and devoted to the Word. In these times, our anchor is Christ alone.</p>
    <p>I'm excited about what God is doing among us. Continue to pray for one another, serve faithfully, and keep your eyes fixed on Jesus.</p>
    <p>In Christ's love,<br><strong>Your Pastor</strong></p>
  `;
  
  const reactionsHtml = renderCardReactions('pastorHeart');
  document.getElementById('fn-pastorHeart-content').innerHTML = content + reactionsHtml;
}

// Render card reactions section
function renderCardReactions(sectionId) {
  const reactions = FlockNewsState.newsData[sectionId]?.reactions || {};
  const reactionKeys = Object.keys(reactions).filter(k => reactions[k] && reactions[k].length > 0);
  const userId = FlockNewsState.currentUser?.uid || 'anonymous';
  
  const reactionsHtml = reactionKeys.length > 0 ? `
    <div class="fn-card-reactions">
      ${reactionKeys.map(emoji => {
        const users = reactions[emoji] || [];
        const hasReacted = users.includes(userId);
        const count = users.length;
        return `<button class="fn-reaction-bubble ${hasReacted ? 'active' : ''}" onclick="FlockNews.toggleReaction('${sectionId}', '${emoji}')" title="${count} reaction${count > 1 ? 's' : ''}">${emoji} ${count}</button>`;
      }).join('')}
    </div>` : '';
  
  const addReactionHtml = `
    <div class="fn-reaction-add">
      <button class="fn-reaction-add-btn" onclick="FlockNews.showReactionPicker('${sectionId}')" title="Add reaction">➕ React</button>
    </div>`;
  
  return `
    <div class="fn-card-reaction-bar">
      ${reactionsHtml}
      ${addReactionHtml}
    </div>
  `;
}

// Render Announcements section
function renderAnnouncements() {
  const content = FlockNewsState.newsData.announcements?.content || `
    <h2>This Week's Announcements</h2>
    <ul style="list-style: none; padding: 0; margin: 16px 0;">
      <li style="padding: 12px; margin: 8px 0; background: rgba(232,168,56,0.1); border-left: 4px solid var(--fn-gold); border-radius: 6px;">
        <strong style="color: var(--fn-gold);">📅 Sunday Service:</strong> Join us for worship this Sunday at 10:00 AM. Communion will be served.
      </li>
      <li style="padding: 12px; margin: 8px 0; background: rgba(232,168,56,0.1); border-left: 4px solid var(--fn-gold); border-radius: 6px;">
        <strong style="color: var(--fn-gold);">🙏 Prayer Meeting:</strong> Wednesday nights at 7:00 PM in the fellowship hall. All are welcome.
      </li>
      <li style="padding: 12px; margin: 8px 0; background: rgba(232,168,56,0.1); border-left: 4px solid var(--fn-gold); border-radius: 6px;">
        <strong style="color: var(--fn-gold);">💝 Upcoming Events:</strong> Save the date for our church picnic on the last Saturday of the month.
      </li>
    </ul>
  `;
  document.getElementById('fn-announcements-content').innerHTML = content;
}

function renderMission() {
  // Generate HTML for unreached people group, country of the day, Bible Access spotlight, and Frontlines International
  const unreachedHtml = formatUnreachedCard(FlockNewsState.unreachedOfDay);
  const countryHtml = formatCountryCard(FlockNewsState.countryOfDay);
  const bibleAccessHtml = formatBibleAccessCard(FlockNewsState.bibleAccessSpotlight);
  const frontlinesHtml = formatFrontlinesCard();
  
  // Combine all four widgets
  const content = `
    <div class="fn-missions-container">
      ${unreachedHtml}
      ${countryHtml}
      ${bibleAccessHtml}
      ${frontlinesHtml}
    </div>
  `;
  
  document.getElementById('fn-mission-content').innerHTML = content;
}

// Render Bible Reading section
function renderReading() {
  const content = FlockNewsState.newsData.reading?.content || '<p>No Bible reading available.</p>';
  document.getElementById('fn-reading-content').innerHTML = content;
}

// Render Devotional section
function renderDevotional() {
  const content = FlockNewsState.newsData.devotional?.content || '<p>No devotional available.</p>';
  document.getElementById('fn-devotional-content').innerHTML = content;
}

// Render Word of the Day (Greek & Hebrew)
function renderWords() {
  const greek = FlockNewsState.newsData.greekWord;
  const hebrew = FlockNewsState.newsData.hebrewWord;

  // Render Greek word
  if (greek) {
    document.getElementById('fn-greek-word').innerHTML = `
      <div class="fn-word-language">Greek</div>
      <div class="fn-word-term">${greek.term || 'N/A'}</div>
      <div class="fn-word-transliteration">${greek.transliteration || ''}</div>
      <div class="fn-word-definition">${greek.definition || ''}</div>
      <div class="fn-word-nuance">${greek.nuance || ''}</div>
      ${greek.examples ? `<div class="fn-word-nuance"><strong>Examples:</strong> ${greek.examples}</div>` : ''}
      <div class="fn-word-strongs">${greek.strongs || ''}</div>
    `;
  }

  // Render Hebrew word
  if (hebrew) {
    document.getElementById('fn-hebrew-word').innerHTML = `
      <div class="fn-word-language">Hebrew</div>
      <div class="fn-word-term">${hebrew.term || 'N/A'}</div>
      <div class="fn-word-transliteration">${hebrew.transliteration || ''}</div>
      <div class="fn-word-definition">${hebrew.definition || ''}</div>
      <div class="fn-word-nuance">${hebrew.nuance || ''}</div>
      ${hebrew.examples ? `<div class="fn-word-nuance"><strong>Examples:</strong> ${hebrew.examples}</div>` : ''}
      <div class="fn-word-strongs">${hebrew.strongs || ''}</div>
    `;
  }
}

// Render Bible Book section
function renderBook() {
  const book = FlockNewsState.newsData.book;

  if (!book) {
    document.getElementById('fn-book-content').innerHTML = '<p>No book information available.</p>';
    return;
  }

  const themesHTML = book.themes && book.themes.length > 0
    ? `<ul>${book.themes.map(theme => `<li>${theme}</li>`).join('')}</ul>`
    : '<p>No themes listed.</p>';

  const keyVersesHTML = book.keyVerses 
    ? book.keyVerses.split('\n\n').map(verse => `<p><em>${verse}</em></p>`).join('')
    : '<p>No key verses listed.</p>';

  document.getElementById('fn-book-content').innerHTML = `
    <div class="fn-book-header">
      <div class="fn-book-icon">📕</div>
      <div class="fn-book-info">
        <h3>${book.name || 'Unknown'}</h3>
        <div class="fn-book-meta">${book.testament || ''} • Written by ${book.author || 'Unknown'} • ${book.date || 'Date unknown'}</div>
      </div>
    </div>

    <div class="fn-book-stats">
      <div class="fn-book-stat">
        <div class="fn-book-stat-value">${book.chapters || 0}</div>
        <div class="fn-book-stat-label">Chapters</div>
      </div>
      <div class="fn-book-stat">
        <div class="fn-book-stat-value">${book.verses || 0}</div>
        <div class="fn-book-stat-label">Verses</div>
      </div>
      <div class="fn-book-stat">
        <div class="fn-book-stat-value">${book.readingTime || 'N/A'}</div>
        <div class="fn-book-stat-label">Reading Time</div>
      </div>
    </div>

    <h3>Overview</h3>
    <p>${book.overview || 'No overview available.'}</p>

    <h3>Key Themes</h3>
    ${themesHTML}

    <h3>Key Verses</h3>
    ${keyVersesHTML}
  `;
}

// Toggle edit mode
function toggleEditMode() {
  if (!FlockNewsState.isPastorPlus) {
    alert('Only pastors and administrators can edit FlockNews content.');
    return;
  }

  FlockNewsState.editMode = !FlockNewsState.editMode;
  const appEl = document.getElementById('fn-app');
  const toggleBtn = document.getElementById('fn-edit-toggle');

  if (FlockNewsState.editMode) {
    appEl.classList.add('fn-editing');
    toggleBtn.classList.add('editing');
    toggleBtn.innerHTML = '✓';
  } else {
    appEl.classList.remove('fn-editing');
    toggleBtn.classList.remove('editing');
    toggleBtn.innerHTML = '✏️';
  }
}

// Edit a specific section
function editSection(sectionId) {
  if (!FlockNewsState.isPastorPlus) {
    alert('Only pastors and administrators can edit content.');
    return;
  }

  FlockNewsState.currentEditSection = sectionId;
  const modal = document.getElementById('fn-editor-modal');
  const titleEl = document.getElementById('fn-editor-title');
  const contentEl = document.getElementById('fn-editor-content');

  // Set title
  const titles = {
    introduction: 'Edit Welcome Introduction',
    pastorHeart: 'Edit Pastor\'s Heart',
    announcements: 'Edit Announcements',
    mission: 'Edit Mission of the Day',
    reading: 'Edit Bible Reading',
    devotional: 'Edit Devotional',
    words: 'Edit Word of the Day',
    book: 'Edit Bible Book of the Day'
  };
  titleEl.textContent = titles[sectionId] || 'Edit Section';

  // Build editor form based on section
  let editorHTML = '';

  switch (sectionId) {
    case 'introduction':
      editorHTML = buildIntroductionEditor();
      break;
    case 'pastorHeart':
      editorHTML = buildPastorHeartEditor();
      break;
    case 'announcements':
      editorHTML = buildAnnouncementsEditor();
      break;
    case 'mission':
      editorHTML = buildMissionEditor();
      break;
    case 'reading':
      editorHTML = buildReadingEditor();
      break;
    case 'devotional':
      editorHTML = buildDevotionalEditor();
      break;
    case 'words':
      editorHTML = buildWordsEditor();
      break;
    case 'book':
      editorHTML = buildBookEditor();
      break;
  }

  contentEl.innerHTML = editorHTML;
  modal.classList.add('fn-modal-open');

  // Initialize Google Docs features for rich text editors
  setTimeout(() => {
    if (window.initializeGoogleDocsFeatures) {
      // Initialize for each contenteditable element
      document.querySelectorAll('.fn-rich-editor .fd-editor-content').forEach(editor => {
        editor.contentEditable = true;
      });
    }
  }, 100);
}

// Build Introduction editor
function buildIntroductionEditor() {
  const data = FlockNewsState.newsData.introduction || {};
  return `
    <div class="fn-editor-field">
      <label>Introduction Content (HTML supported)</label>
      <div class="fn-rich-editor">
        <div class="fd-editor-content" style="min-height: 200px; padding: 12px; border: 1px solid #ccc; border-radius: 4px; background: white; color: #000;">
          ${data.content || '<p>Welcome to FlockNews...</p>'}
        </div>
      </div>
    </div>
  `;
}

// Build Pastor's Heart editor
function buildPastorHeartEditor() {
  const data = FlockNewsState.newsData.pastorHeart || {};
  return `
    <div class="fn-editor-field">
      <label>Pastor's Message (HTML supported)</label>
      <div class="fn-rich-editor">
        <div class="fd-editor-content" style="min-height: 250px; padding: 12px; border: 1px solid #ccc; border-radius: 4px; background: white; color: #000;">
          ${data.content || '<p>Dear Church Family...</p>'}
        </div>
      </div>
    </div>
  `;
}

// Build Announcements editor
function buildAnnouncementsEditor() {
  const data = FlockNewsState.newsData.announcements || {};
  return `
    <div class="fn-editor-field">
      <label>Announcements (HTML supported)</label>
      <div class="fn-rich-editor">
        <div class="fd-editor-content" style="min-height: 250px; padding: 12px; border: 1px solid #ccc; border-radius: 4px; background: white; color: #000;">
          ${data.content || '<h2>This Week\'s Announcements</h2><ul><li>Announcement 1</li></ul>'}
        </div>
      </div>
    </div>
  `;
}

// Build Mission editor
function buildMissionEditor() {
  const data = FlockNewsState.newsData.mission || {};
  return `
    <div class="fn-editor-field">
      <label>Mission Title</label>
      <input type="text" id="edit-mission-title" value="${escapeHTML(data.title || '')}" placeholder="e.g., Unreached People Group">
    </div>
    <div class="fn-editor-field">
      <label>Mission Content (Rich Text)</label>
      <div class="fn-rich-editor">
        <div class="fd-editor-toolbar" id="mission-toolbar">
          ${buildSimpleToolbar()}
        </div>
        <div class="fd-editor-content" id="edit-mission-content">${data.content || ''}</div>
      </div>
    </div>
  `;
}

// Build Reading editor
function buildReadingEditor() {
  const data = FlockNewsState.newsData.reading || {};
  return `
    <div class="fn-editor-field">
      <label>Passage Name</label>
      <input type="text" id="edit-reading-passage" value="${escapeHTML(data.passage || '')}" placeholder="e.g., Psalm 23">
    </div>
    <div class="fn-editor-field">
      <label>Reference</label>
      <input type="text" id="edit-reading-reference" value="${escapeHTML(data.reference || '')}" placeholder="e.g., Psalm 23:1-6">
    </div>
    <div class="fn-editor-field">
      <label>Reading Content (Rich Text)</label>
      <div class="fn-rich-editor">
        <div class="fd-editor-toolbar" id="reading-toolbar">
          ${buildSimpleToolbar()}
        </div>
        <div class="fd-editor-content" id="edit-reading-content">${data.content || ''}</div>
      </div>
    </div>
  `;
}

// Build Devotional editor
function buildDevotionalEditor() {
  const data = FlockNewsState.newsData.devotional || {};
  return `
    <div class="fn-editor-field">
      <label>Devotional Title</label>
      <input type="text" id="edit-devotional-title" value="${escapeHTML(data.title || '')}" placeholder="e.g., Walking in Faith">
    </div>
    <div class="fn-editor-field">
      <label>Author</label>
      <input type="text" id="edit-devotional-author" value="${escapeHTML(data.author || '')}" placeholder="e.g., Pastor John">
    </div>
    <div class="fn-editor-field">
      <label>Devotional Content (Rich Text)</label>
      <div class="fn-rich-editor">
        <div class="fd-editor-toolbar" id="devotional-toolbar">
          ${buildSimpleToolbar()}
        </div>
        <div class="fd-editor-content" id="edit-devotional-content">${data.content || ''}</div>
      </div>
    </div>
  `;
}

// Build Words editor (Greek & Hebrew)
function buildWordsEditor() {
  const greek = FlockNewsState.newsData.greekWord || {};
  const hebrew = FlockNewsState.newsData.hebrewWord || {};
  
  return `
    <h3 style="color: #fbbf24; margin-bottom: 20px;">Greek Word</h3>
    <div class="fn-editor-field">
      <label>Greek Term</label>
      <input type="text" id="edit-greek-term" value="${escapeHTML(greek.term || '')}" placeholder="e.g., ἀγάπη">
    </div>
    <div class="fn-editor-field">
      <label>Transliteration</label>
      <input type="text" id="edit-greek-transliteration" value="${escapeHTML(greek.transliteration || '')}" placeholder="e.g., agapē">
    </div>
    <div class="fn-editor-field">
      <label>Definition</label>
      <input type="text" id="edit-greek-definition" value="${escapeHTML(greek.definition || '')}" placeholder="Brief definition">
    </div>
    <div class="fn-editor-field">
      <label>Nuance & Detail</label>
      <textarea id="edit-greek-nuance" rows="4" placeholder="Detailed explanation of meaning and usage">${escapeHTML(greek.nuance || '')}</textarea>
    </div>
    <div class="fn-editor-field">
      <label>Strong's Number</label>
      <input type="text" id="edit-greek-strongs" value="${escapeHTML(greek.strongs || '')}" placeholder="e.g., Strong's G26">
    </div>
    <div class="fn-editor-field">
      <label>Examples (Bible verses)</label>
      <textarea id="edit-greek-examples" rows="3" placeholder="e.g., John 3:16, 1 Corinthians 13...">${escapeHTML(greek.examples || '')}</textarea>
    </div>

    <h3 style="color: #fbbf24; margin: 32px 0 20px;">Hebrew Word</h3>
    <div class="fn-editor-field">
      <label>Hebrew Term</label>
      <input type="text" id="edit-hebrew-term" value="${escapeHTML(hebrew.term || '')}" placeholder="e.g., שָׁלוֹם">
    </div>
    <div class="fn-editor-field">
      <label>Transliteration</label>
      <input type="text" id="edit-hebrew-transliteration" value="${escapeHTML(hebrew.transliteration || '')}" placeholder="e.g., shalom">
    </div>
    <div class="fn-editor-field">
      <label>Definition</label>
      <input type="text" id="edit-hebrew-definition" value="${escapeHTML(hebrew.definition || '')}" placeholder="Brief definition">
    </div>
    <div class="fn-editor-field">
      <label>Nuance & Detail</label>
      <textarea id="edit-hebrew-nuance" rows="4" placeholder="Detailed explanation of meaning and usage">${escapeHTML(hebrew.nuance || '')}</textarea>
    </div>
    <div class="fn-editor-field">
      <label>Strong's Number</label>
      <input type="text" id="edit-hebrew-strongs" value="${escapeHTML(hebrew.strongs || '')}" placeholder="e.g., Strong's H7965">
    </div>
    <div class="fn-editor-field">
      <label>Examples (Bible verses)</label>
      <textarea id="edit-hebrew-examples" rows="3" placeholder="e.g., Numbers 6:26, Isaiah 26:3...">${escapeHTML(hebrew.examples || '')}</textarea>
    </div>
  `;
}

// Build Book editor
function buildBookEditor() {
  const data = FlockNewsState.newsData.book || {};
  const themesText = data.themes ? data.themes.join('\n') : '';
  
  return `
    <div class="fn-editor-field">
      <label>Book Name</label>
      <input type="text" id="edit-book-name" value="${escapeHTML(data.name || '')}" placeholder="e.g., Ephesians">
    </div>
    <div class="fn-editor-field">
      <label>Testament</label>
      <input type="text" id="edit-book-testament" value="${escapeHTML(data.testament || '')}" placeholder="e.g., New Testament">
    </div>
    <div class="fn-editor-field">
      <label>Author</label>
      <input type="text" id="edit-book-author" value="${escapeHTML(data.author || '')}" placeholder="e.g., Paul the Apostle">
    </div>
    <div class="fn-editor-field">
      <label>Date Written</label>
      <input type="text" id="edit-book-date" value="${escapeHTML(data.date || '')}" placeholder="e.g., ~AD 60-62">
    </div>
    <div class="fn-editor-field">
      <label>Chapters</label>
      <input type="number" id="edit-book-chapters" value="${data.chapters || 0}">
    </div>
    <div class="fn-editor-field">
      <label>Verses</label>
      <input type="number" id="edit-book-verses" value="${data.verses || 0}">
    </div>
    <div class="fn-editor-field">
      <label>Reading Time</label>
      <input type="text" id="edit-book-reading-time" value="${escapeHTML(data.readingTime || '')}" placeholder="e.g., ~20 minutes">
    </div>
    <div class="fn-editor-field">
      <label>Overview</label>
      <textarea id="edit-book-overview" rows="4" placeholder="Brief overview of the book">${escapeHTML(data.overview || '')}</textarea>
    </div>
    <div class="fn-editor-field">
      <label>Key Themes (one per line)</label>
      <textarea id="edit-book-themes" rows="6" placeholder="Enter each theme on a new line">${escapeHTML(themesText)}</textarea>
    </div>
    <div class="fn-editor-field">
      <label>Key Verses</label>
      <textarea id="edit-book-keyverses" rows="6" placeholder="Enter key verses with references">${escapeHTML(data.keyVerses || '')}</textarea>
    </div>
  `;
}

// Build simple toolbar for rich text editor
function buildSimpleToolbar() {
  return `
    <button type="button" onclick="document.execCommand('bold')" style="font-weight: bold; padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: white; cursor: pointer; margin-right: 4px;">B</button>
    <button type="button" onclick="document.execCommand('italic')" style="font-style: italic; padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: white; cursor: pointer; margin-right: 4px;">I</button>
    <button type="button" onclick="document.execCommand('underline')" style="text-decoration: underline; padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: white; cursor: pointer; margin-right: 4px;">U</button>
    <button type="button" onclick="document.execCommand('insertUnorderedList')" style="padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: white; cursor: pointer; margin-right: 4px;">• List</button>
    <button type="button" onclick="document.execCommand('insertOrderedList')" style="padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: white; cursor: pointer; margin-right: 4px;">1. List</button>
    <button type="button" onclick="document.execCommand('formatBlock', false, 'h2')" style="padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: white; cursor: pointer; margin-right: 4px;">H2</button>
    <button type="button" onclick="document.execCommand('formatBlock', false, 'h3')" style="padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: white; cursor: pointer;">H3</button>
  `;
}

// Save edited section
async function saveSection() {
  if (!FlockNewsState.isPastorPlus) {
    alert('Only pastors and administrators can save changes.');
    return;
  }

  const sectionId = FlockNewsState.currentEditSection;

  try {
    let updatedData = {};

    switch (sectionId) {
      case 'introduction':
        updatedData = {
          introduction: {
            title: 'Welcome',
            content: document.querySelector('.fn-rich-editor .fd-editor-content').innerHTML,
            lastUpdated: new Date().toISOString()
          }
        };
        FlockNewsState.newsData.introduction = updatedData.introduction;
        break;

      case 'pastorHeart':
        updatedData = {
          pastorHeart: {
            title: 'Pastor\'s Heart',
            content: document.querySelector('.fn-rich-editor .fd-editor-content').innerHTML,
            lastUpdated: new Date().toISOString()
          }
        };
        FlockNewsState.newsData.pastorHeart = updatedData.pastorHeart;
        break;

      case 'announcements':
        updatedData = {
          announcements: {
            title: 'Announcements',
            content: document.querySelector('.fn-rich-editor .fd-editor-content').innerHTML,
            lastUpdated: new Date().toISOString()
          }
        };
        FlockNewsState.newsData.announcements = updatedData.announcements;
        break;

      case 'mission':
        updatedData = {
          mission: {
            title: document.getElementById('edit-mission-title').value,
            content: document.getElementById('edit-mission-content').innerHTML,
            lastUpdated: new Date().toISOString()
          }
        };
        FlockNewsState.newsData.mission = updatedData.mission;
        break;

      case 'reading':
        updatedData = {
          reading: {
            passage: document.getElementById('edit-reading-passage').value,
            reference: document.getElementById('edit-reading-reference').value,
            content: document.getElementById('edit-reading-content').innerHTML,
            lastUpdated: new Date().toISOString()
          }
        };
        FlockNewsState.newsData.reading = updatedData.reading;
        break;

      case 'devotional':
        updatedData = {
          devotional: {
            title: document.getElementById('edit-devotional-title').value,
            author: document.getElementById('edit-devotional-author').value,
            content: document.getElementById('edit-devotional-content').innerHTML,
            lastUpdated: new Date().toISOString()
          }
        };
        FlockNewsState.newsData.devotional = updatedData.devotional;
        break;

      case 'words':
        updatedData = {
          greekWord: {
            term: document.getElementById('edit-greek-term').value,
            transliteration: document.getElementById('edit-greek-transliteration').value,
            definition: document.getElementById('edit-greek-definition').value,
            nuance: document.getElementById('edit-greek-nuance').value,
            strongs: document.getElementById('edit-greek-strongs').value,
            examples: document.getElementById('edit-greek-examples').value,
            lastUpdated: new Date().toISOString()
          },
          hebrewWord: {
            term: document.getElementById('edit-hebrew-term').value,
            transliteration: document.getElementById('edit-hebrew-transliteration').value,
            definition: document.getElementById('edit-hebrew-definition').value,
            nuance: document.getElementById('edit-hebrew-nuance').value,
            strongs: document.getElementById('edit-hebrew-strongs').value,
            examples: document.getElementById('edit-hebrew-examples').value,
            lastUpdated: new Date().toISOString()
          }
        };
        FlockNewsState.newsData.greekWord = updatedData.greekWord;
        FlockNewsState.newsData.hebrewWord = updatedData.hebrewWord;
        break;

      case 'book':
        const themesText = document.getElementById('edit-book-themes').value;
        const themesArray = themesText.split('\n').filter(t => t.trim() !== '');
        
        updatedData = {
          book: {
            name: document.getElementById('edit-book-name').value,
            testament: document.getElementById('edit-book-testament').value,
            author: document.getElementById('edit-book-author').value,
            date: document.getElementById('edit-book-date').value,
            chapters: parseInt(document.getElementById('edit-book-chapters').value) || 0,
            verses: parseInt(document.getElementById('edit-book-verses').value) || 0,
            readingTime: document.getElementById('edit-book-reading-time').value,
            overview: document.getElementById('edit-book-overview').value,
            themes: themesArray,
            keyVerses: document.getElementById('edit-book-keyverses').value,
            lastUpdated: new Date().toISOString()
          }
        };
        FlockNewsState.newsData.book = updatedData.book;
        break;
    }

    // Save to Firestore (try, but don't fail if it doesn't work)
    try {
      if (FlockNewsState.db) {
        // Save to appropriate collection based on section
        if (sectionId === 'reading') {
          await FlockNewsState.db.collection('reading').doc(FlockNewsState.dateKey).set(updatedData.reading, { merge: true });
          console.log('✅ Saved reading section to Firestore collection "reading"');
        } else if (sectionId === 'devotional') {
          await FlockNewsState.db.collection('devotionals').doc(FlockNewsState.dateKey).set(updatedData.devotional, { merge: true });
          console.log('✅ Saved devotional section to Firestore collection "devotionals"');
        } else {
          // Save mission, words, book to flockNews collection
          await FlockNewsState.db.collection('flockNews').doc(FlockNewsState.dateKey).set(updatedData, { merge: true });
          console.log('✅ Saved', sectionId, 'section to Firestore collection "flockNews"');
        }
      }
    } catch (firestoreError) {
      console.warn('⚠️ Could not save to Firestore (using localStorage):', firestoreError.message);
    }

    // Always save to localStorage as backup
    try {
      localStorage.setItem(`flockNews_${FlockNewsState.dateKey}`, JSON.stringify(FlockNewsState.newsData));
      console.log('✅ Saved', sectionId, 'section to localStorage');
    } catch (storageError) {
      console.error('❌ Error saving to localStorage:', storageError);
    }

    // Re-render the updated section
    switch (sectionId) {
      case 'introduction': renderIntroduction(); break;
      case 'pastorHeart': renderPastorHeart(); break;
      case 'announcements': renderAnnouncements(); break;
      case 'mission': renderMission(); break;
      case 'reading': renderReading(); break;
      case 'devotional': renderDevotional(); break;
      case 'words': renderWords(); break;
      case 'book': renderBook(); break;
    }

    // Close editor
    closeEditor();

    // Show success message
    showSuccessMessage('Changes saved successfully!');

  } catch (error) {
    console.error('❌ Error saving section:', error);
    alert('Failed to save changes. Please try again.');
  }
}

// Close editor modal
function closeEditor() {
  document.getElementById('fn-editor-modal').classList.remove('fn-modal-open');
  FlockNewsState.currentEditSection = null;
}

// ──────────────────────────────────────────────────────────────────────
// REACTIONS SYSTEM
// ──────────────────────────────────────────────────────────────────────

const REACTION_EMOJIS = ['❤️', '👍', '🙏', '😊', '🎉', '👏', '🔥', '💯'];

function showReactionPicker(sectionId) {
  // Remove existing picker if any
  const existing = document.querySelector('.fn-reaction-picker');
  if (existing) existing.remove();

  // Find card element
  const cardEl = document.querySelector(`[data-section="${sectionId}"]`);
  if (!cardEl) return;

  // Create picker
  const picker = document.createElement('div');
  picker.className = 'fn-reaction-picker';
  picker.innerHTML = REACTION_EMOJIS.map(emoji => 
    `<button class="fn-reaction-picker-btn" onclick="FlockNews.addReaction('${sectionId}', '${emoji}'); this.parentElement.remove();">${emoji}</button>`
  ).join('');

  // Position near the add reaction button
  const addBtn = cardEl.querySelector('.fn-reaction-add-btn');
  if (addBtn) {
    addBtn.parentElement.style.position = 'relative';
    addBtn.parentElement.appendChild(picker);
  }

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeReactionPicker(e) {
      if (!picker.contains(e.target) && !e.target.classList.contains('fn-reaction-add-btn')) {
        picker.remove();
        document.removeEventListener('click', closeReactionPicker);
      }
    });
  }, 100);
}

async function addReaction(sectionId, emoji) {
  if (!FlockNewsState.db || !FlockNewsState.dateKey) return;
  
  const userId = FlockNewsState.currentUser?.uid || 'anonymous';
  
  try {
    const docRef = FlockNewsState.db.collection('news').doc(FlockNewsState.dateKey);
    await docRef.update({
      [`${sectionId}.reactions.${emoji}`]: firebase.firestore.FieldValue.arrayUnion(userId)
    });
    
    // Update local state
    if (!FlockNewsState.newsData[sectionId].reactions) {
      FlockNewsState.newsData[sectionId].reactions = {};
    }
    if (!FlockNewsState.newsData[sectionId].reactions[emoji]) {
      FlockNewsState.newsData[sectionId].reactions[emoji] = [];
    }
    FlockNewsState.newsData[sectionId].reactions[emoji].push(userId);
    
    // Re-render section to show updated reactions
    switch (sectionId) {
      case 'pastorHeart': renderPastorHeart(); break;
      // Add other sections as needed
    }
  } catch (err) {
    console.error('Failed to add reaction:', err);
    showErrorMessage('Failed to add reaction. Please try again.');
  }
}

async function toggleReaction(sectionId, emoji) {
  if (!FlockNewsState.db || !FlockNewsState.dateKey) return;
  
  const userId = FlockNewsState.currentUser?.uid || 'anonymous';
  const reactions = FlockNewsState.newsData[sectionId]?.reactions || {};
  const users = reactions[emoji] || [];
  const hasReacted = users.includes(userId);
  
  try {
    const docRef = FlockNewsState.db.collection('news').doc(FlockNewsState.dateKey);
    
    if (hasReacted) {
      // Remove reaction
      await docRef.update({
        [`${sectionId}.reactions.${emoji}`]: firebase.firestore.FieldValue.arrayRemove(userId)
      });
      
      // Update local state
      const index = FlockNewsState.newsData[sectionId].reactions[emoji].indexOf(userId);
      if (index > -1) {
        FlockNewsState.newsData[sectionId].reactions[emoji].splice(index, 1);
      }
    } else {
      // Add reaction
      await docRef.update({
        [`${sectionId}.reactions.${emoji}`]: firebase.firestore.FieldValue.arrayUnion(userId)
      });
      
      // Update local state
      if (!FlockNewsState.newsData[sectionId].reactions) {
        FlockNewsState.newsData[sectionId].reactions = {};
      }
      if (!FlockNewsState.newsData[sectionId].reactions[emoji]) {
        FlockNewsState.newsData[sectionId].reactions[emoji] = [];
      }
      FlockNewsState.newsData[sectionId].reactions[emoji].push(userId);
    }
    
    // Re-render section to show updated reactions
    switch (sectionId) {
      case 'pastorHeart': renderPastorHeart(); break;
      // Add other sections as needed
    }
  } catch (err) {
    console.error('Failed to toggle reaction:', err);
    showErrorMessage('Failed to update reaction. Please try again.');
  }
}

// Helper: Escape HTML
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Show error message
function showError(message) {
  alert(message);
}

// Show success message
function showSuccessMessage(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 32px;
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4);
    z-index: 10000;
    font-weight: 600;
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Export FlockNews API
window.FlockNews = {
  toggleEditMode,
  editSection,
  saveSection,
  closeEditor,
  showReactionPicker,
  addReaction,
  toggleReaction
};

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  // Start the app immediately — no waiting on auth
  initFlockNews().then(() => {
    // After render, silently check for editor permissions in the background
    _checkEditPermissions();
  });
});

export { FlockNewsState, initFlockNews };
