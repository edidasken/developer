const {onCall, HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const puppeteer = require('puppeteer');

admin.initializeApp();

/**
 * SongSelect Authentication
 * Validates SongSelect credentials by logging in
 */
exports.songSelectAuth = onCall(async (request) => {
  const {email, password} = request.data;

  if (!email || !password) {
    throw new HttpsError('invalid-argument', 'Email and password are required');
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Go to SongSelect login
    await page.goto('https://songselect.ccli.com/account/signin', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Fill in credentials
    await page.type('#EmailAddress', email);
    await page.type('#Password', password);
    
    // Submit form
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({waitUntil: 'networkidle2', timeout: 10000})
    ]);

    // Check if login was successful
    const url = page.url();
    const isLoggedIn = !url.includes('/signin') && !url.includes('/error');

    if (!isLoggedIn) {
      throw new HttpsError('unauthenticated', 'Invalid SongSelect credentials');
    }

    return {
      ok: true,
      message: 'Successfully authenticated with SongSelect',
      email: email
    };

  } catch (error) {
    console.error('SongSelect auth error:', error);
    throw new HttpsError('internal', error.message || 'Authentication failed');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

/**
 * SongSelect Search
 * Searches SongSelect library and returns results
 */
exports.songSelectSearch = onCall(async (request) => {
  const {email, password, query} = request.data;

  if (!email || !password || !query) {
    throw new HttpsError('invalid-argument', 'Email, password, and query are required');
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Login first
    await page.goto('https://songselect.ccli.com/account/signin', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.type('#EmailAddress', email);
    await page.type('#Password', password);
    
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({waitUntil: 'networkidle2'})
    ]);

    // Search for songs
    await page.goto(`https://songselect.ccli.com/search/results?List=${encodeURIComponent(query)}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Extract search results
    const results = await page.evaluate(() => {
      const songs = [];
      const items = document.querySelectorAll('.song-result');
      
      items.forEach((item, idx) => {
        if (idx >= 20) return; // Limit to 20 results
        
        const titleEl = item.querySelector('.song-title');
        const artistEl = item.querySelector('.song-author');
        const ccliEl = item.querySelector('.song-number');
        const linkEl = item.querySelector('a.song-title');
        
        if (titleEl && linkEl) {
          songs.push({
            title: titleEl.textContent.trim(),
            artist: artistEl ? artistEl.textContent.trim() : '',
            ccliNumber: ccliEl ? ccliEl.textContent.replace(/[^\d]/g, '') : '',
            url: linkEl.href,
            songId: linkEl.href.split('/').pop()
          });
        }
      });
      
      return songs;
    });

    return {
      ok: true,
      results: results,
      count: results.length
    };

  } catch (error) {
    console.error('SongSelect search error:', error);
    throw new HttpsError('internal', error.message || 'Search failed');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

/**
 * SongSelect Import
 * Fetches full ChordPro file for a song
 */
exports.songSelectImport = onCall(async (request) => {
  const {email, password, songId} = request.data;

  if (!email || !password || !songId) {
    throw new HttpsError('invalid-argument', 'Email, password, and songId are required');
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Login
    await page.goto('https://songselect.ccli.com/account/signin', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.type('#EmailAddress', email);
    await page.type('#Password', password);
    
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({waitUntil: 'networkidle2'})
    ]);

    // Go to song page
    await page.goto(`https://songselect.ccli.com/Songs/${songId}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Extract song details
    const songData = await page.evaluate(() => {
      const title = document.querySelector('.song-title, h1')?.textContent.trim() || '';
      const artist = document.querySelector('.song-author, .authors')?.textContent.trim() || '';
      const ccli = document.querySelector('.song-number, .ccli-number')?.textContent.replace(/[^\d]/g, '') || '';
      const key = document.querySelector('.song-key, .original-key')?.textContent.trim() || '';
      
      // Try to find lyrics/chords in various formats
      let lyrics = '';
      const lyricsEl = document.querySelector('.lyrics-content, .song-lyrics, pre');
      if (lyricsEl) {
        lyrics = lyricsEl.textContent.trim();
      }

      return {title, artist, ccli, key, lyrics};
    });

    // Try to download ChordPro format if available
    let chordPro = '';
    
    // Check for ChordPro download link
    const downloadLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .filter(a => a.textContent.includes('ChordPro') || a.href.includes('chordpro'))
        .map(a => a.href);
    });

    if (downloadLinks.length > 0) {
      // Navigate to ChordPro download
      const downloadPage = await browser.newPage();
      await downloadPage.goto(downloadLinks[0], {waitUntil: 'networkidle2'});
      chordPro = await downloadPage.content();
      await downloadPage.close();
    } else {
      // Construct ChordPro from scraped data
      chordPro = `{title: ${songData.title}}
{artist: ${songData.artist}}
{ccli: ${songData.ccli}}
${songData.key ? `{key: ${songData.key}}` : ''}

${songData.lyrics}`;
    }

    return {
      ok: true,
      title: songData.title,
      artist: songData.artist,
      ccliNumber: songData.ccli,
      key: songData.key,
      chordPro: chordPro
    };

  } catch (error) {
    console.error('SongSelect import error:', error);
    throw new HttpsError('internal', error.message || 'Import failed');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});
