const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {onDocumentCreated}  = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

admin.initializeApp();

// ── FlockChat Push Notifications ──────────────────────────────────────────
// Fires on every new message. Sends an FCM push to each other participant
// whose user doc has a valid fcmToken stored.
exports.onFlockChatMessage = onDocumentCreated(
  'conversations/{convId}/messages/{msgId}',
  async (event) => {
    const msg   = event.data.data();
    const db    = admin.firestore();

    const senderId   = msg.sender   || msg.uid || '';
    const senderName = msg.senderName || msg.displayName || 'Someone';
    const body       = (msg.body || msg.text || '').slice(0, 140);
    const convId     = event.params.convId;

    if (!body) return null;

    // Fetch the conversation to get participant list
    const convSnap = await db.collection('conversations').doc(convId).get();
    if (!convSnap.exists) return null;
    const participants = convSnap.data().participants || [];
    const convName     = convSnap.data().name || convSnap.data().title || 'FlockChat';

    // Collect FCM tokens for all participants except the sender
    const recipients = participants.filter(uid => uid !== senderId);
    if (!recipients.length) return null;

    const tokenDocs = await Promise.all(
      recipients.map(uid => db.collection('users').doc(uid).get())
    );

    const tokens = [];
    const uidByToken = {};
    for (const doc of tokenDocs) {
      if (!doc.exists) continue;
      const token = doc.data()?.fcmToken;
      if (token && typeof token === 'string') {
        tokens.push(token);
        uidByToken[token] = doc.id;
      }
    }
    if (!tokens.length) return null;

    const message = {
      notification: {
        title: `${convName}`,
        body:  `${senderName}: ${body}`,
      },
      data: {
        conversationId: convId,
        channelId:      convId,
        sender:         senderId,
      },
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Clean up invalid tokens so we don't waste FCM quota
    const stale = [];
    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const code = res.error?.code || '';
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          stale.push(tokens[idx]);
        }
      }
    });
    if (stale.length) {
      const batch = db.batch();
      for (const token of stale) {
        const uid = uidByToken[token];
        if (uid) batch.update(db.collection('users').doc(uid), { fcmToken: admin.firestore.FieldValue.delete() });
      }
      await batch.commit();
    }

    console.log(`[FCM] sent=${response.successCount} failed=${response.failureCount} conv=${convId}`);
    return null;
  }
);



/**
 * Helper function to log in to SongSelect
 * Returns the authenticated page
 */
async function loginToSongSelect(page, email, password) {
  // Hide webdriver properties to avoid bot detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });
  
  // Go to SongSelect login
  await page.goto('https://songselect.ccli.com/account/signin', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  
  // Set cookie consent cookies to bypass dialog on songselect domain
  await page.setCookie({
    name: 'CookieConsent',
    value: '-1',
    domain: '.songselect.ccli.com'
  });
  
  await page.setCookie({
    name: 'CookieConsentBulkTicket',
    value: 'granted',
    domain: '.songselect.ccli.com'
  });
  
  // Also set for profile.ccli.com domain (where sign-in actually happens)
  await page.setCookie({
    name: 'CookieConsent',
    value: '-1',
    domain: '.ccli.com'
  });
  
  await page.setCookie({
    name: 'CookieConsentBulkTicket',
    value: 'granted',
    domain: '.ccli.com'
  });
  
  // Reload page so cookies take effect
  await page.reload({
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  
  // Wait a bit for any JavaScript to load the login form
  await page.waitForTimeout(3000);

  // Check current URL - might have been redirected
  const currentUrl = page.url();
  console.log('Current URL after navigation:', currentUrl);
  
  // Check if we got redirected (might indicate we're already logged in or blocked)
  if (!currentUrl.includes('signin') && !currentUrl.includes('login')) {
    console.warn('Redirected away from signin page to:', currentUrl);
  }
  
  // Check if we need to click a "Sign In" button to reveal the login form
  try {
    const signInButtonExists = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.some(btn => 
        btn.textContent?.trim() === 'Sign In' &&
        !btn.className?.includes('round-icon-button')
      );
    });
    
    if (signInButtonExists) {
      console.log('Found "Sign In" button, clicking to reveal login form');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const signInBtn = buttons.find(btn => 
          btn.textContent?.trim() === 'Sign In' &&
          !btn.className?.includes('round-icon-button')
        );
        if (signInBtn) {
          signInBtn.click();
        }
      });
      // Wait for navigation to profile.ccli.com
      await page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: 10000}).catch(() => {});
      // Wait a bit more for page to load
      await page.waitForTimeout(2000);
      console.log('Navigated after clicking Sign In button');
      
      // Dismiss cookie dialog on the new domain if present
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const allowButton = buttons.find(btn => 
          btn.textContent?.trim() === 'Allow all' ||
          btn.textContent?.trim() === 'Allow Only Necessary'
        );
        if (allowButton) {
          allowButton.click();
          return true;
        }
        return false;
      });
      
      if (clicked) {
        console.log('Dismissed cookie dialog on redirected page');
        await page.waitForTimeout(2000);
      }
    }
  } catch (signInError) {
    console.log('No Sign In button found or error clicking:', signInError.message);
  }
  
  // Handle cookie consent dialog if present
  try {
    // Try to find and click the "Allow all" button
    const allowAllButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.some(btn => 
        btn.textContent?.includes('Allow all') || 
        btn.className?.includes('CybotCookiebotDialogBodyButton')
      );
    });
    
    if (allowAllButton) {
      console.log('Found cookie consent dialog, attempting to dismiss');
      
      // Click using page.evaluate to directly trigger the button
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const allowButton = buttons.find(btn => 
          btn.textContent?.trim() === 'Allow all' ||
          btn.textContent?.trim() === 'Allow Only Necessary'
        );
        if (allowButton) {
          allowButton.click();
          return true;
        }
        return false;
      });
      
      if (clicked) {
        console.log('Clicked cookie consent button');
        // Wait for dialog to dismiss and page to update
        await page.waitForTimeout(3000);
        console.log('Cookie consent dialog should be dismissed');
      } else {
        console.log('Could not find clickable cookie button');
      }
    }
  } catch (cookieError) {
    console.log('No cookie dialog found or error dismissing:', cookieError.message);
  }

  // Try multiple possible selectors for email/username field
  let emailSelector = null;
  const possibleEmailSelectors = [
    '#EmailAddress',
    'input[type="email"]',
    'input[name="email"]',
    'input[name="EmailAddress"]',
    'input[name="username"]',
    'input[placeholder*="email" i]',
    'input[placeholder*="username" i]'
  ];
  
  for (const selector of possibleEmailSelectors) {
    try {
      const exists = await page.$(selector);
      if (exists) {
        emailSelector = selector;
        console.log('Found email field with selector:', selector);
        break;
      }
    } catch (e) {
      // Try next selector
    }
  }

  if (!emailSelector) {
    // Capture page state for debugging
    const pageUrl = page.url();
    const pageTitle = await page.title();
    const inputFields = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(input => ({
        type: input.type,
        id: input.id,
        name: input.name,
        placeholder: input.placeholder,
        className: input.className
      }));
    });
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a.button, a[href*="sign"], a[href*="login"]')).map(btn => ({
        text: btn.textContent?.trim(),
        className: btn.className,
        href: btn.href || null
      })).slice(0, 15);
    });
    const iframes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('iframe')).map(iframe => ({
        src: iframe.src,
        id: iframe.id,
        name: iframe.name
      }));
    });
    const pageStructure = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form')).map(f => ({
        id: f.id,
        className: f.className,
        action: f.action,
        inputCount: f.querySelectorAll('input').length
      }));
      const mainContent = document.body?.textContent?.substring(0, 500);
      return {forms, mainContent};
    });
    
    console.error(`Login form not found. URL: ${pageUrl}, Title: ${pageTitle}`);
    console.error('Available input fields:', JSON.stringify(inputFields, null, 2));
    console.error('Available buttons/links:', JSON.stringify(buttons, null, 2));
    console.error('Iframes:', JSON.stringify(iframes, null, 2));
    console.error('Page structure:', JSON.stringify(pageStructure, null, 2));
    
    throw new Error(`Login form not found. URL: ${pageUrl}, Inputs: ${JSON.stringify(inputFields)}, Buttons: ${JSON.stringify(buttons)}, Forms: ${JSON.stringify(pageStructure.forms)}`);
  }
  
  // Find password selector
  let passwordSelector = null;
  const possiblePasswordSelectors = [
    '#Password',
    'input[type="password"]',
    'input[name="password"]',
    'input[name="Password"]'
  ];
  
  for (const selector of possiblePasswordSelectors) {
    try {
      const exists = await page.$(selector);
      if (exists) {
        passwordSelector = selector;
        console.log('Found password field with selector:', selector);
        break;
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!passwordSelector) {
    throw new Error('Password field not found on page');
  }

  // Fill in credentials using dynamic selectors
  await page.type(emailSelector, email, {delay: 50});
  await page.type(passwordSelector, password, {delay: 50});
  
  // Submit form - try multiple button selectors
  let submitButton = null;
  const possibleSubmitSelectors = [
    'button[type="submit"]',
    'button.primary',
    'button.button.primary',
    'input[type="submit"]'
  ];
  
  for (const selector of possibleSubmitSelectors) {
    try {
      const exists = await page.$(selector);
      if (exists) {
        submitButton = selector;
        console.log('Found submit button with selector:', selector);
        break;
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!submitButton) {
    // Try finding by text content
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const signInBtn = buttons.find(btn => 
        btn.textContent?.trim().toLowerCase() === 'sign in'
      );
      if (signInBtn) {
        signInBtn.click();
        return true;
      }
      return false;
    });
    
    if (clicked) {
      console.log('Clicked submit button by text content');
    } else {
      throw new Error('Could not find submit button');
    }
  } else {
    // Click using selector
    await Promise.all([
      page.click(submitButton),
      page.waitForNavigation({waitUntil: 'networkidle2', timeout: 10000}).catch(() => {})
    ]);
  }

  // Check if login was successful
  const url = page.url();
  const isLoggedIn = !url.includes('/signin') && !url.includes('/error');

  if (!isLoggedIn) {
    throw new Error('Invalid SongSelect credentials');
  }
  
  return page;
}

/**
 * SongSelect Authentication
 * Validates SongSelect credentials by logging in
 */
exports.songSelectAuth = onCall({
  memory: '1GiB',
  timeoutSeconds: 60
}, async (request) => {
  const {email, password} = request.data;

  if (!email || !password) {
    throw new HttpsError('invalid-argument', 'Email and password are required');
  }

  let browser;
  try {
    // Add extra stealth args to avoid bot detection
    const stealthArgs = [
      ...chromium.args,
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars'
    ];
    
    browser = await puppeteer.launch({
      args: stealthArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    
    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Use helper function to log in
    await loginToSongSelect(page, email, password);

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
exports.songSelectSearch = onCall({
  memory: '1GiB',
  timeoutSeconds: 60
}, async (request) => {
  const {email, password, query} = request.data;

  if (!email || !password || !query) {
    throw new HttpsError('invalid-argument', 'Email, password, and query are required');
  }

  let browser;
  try {
    // Add extra stealth args to avoid bot detection
    const stealthArgs = [
      ...chromium.args,
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars'
    ];
    
    browser = await puppeteer.launch({
      args: stealthArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    
    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Use helper function to log in
    await loginToSongSelect(page, email, password);

    // Search for songs
    await page.goto(`https://songselect.ccli.com/search/results?List=${encodeURIComponent(query)}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('Search page URL:', page.url());

    // Extract search results with debugging
    const results = await page.evaluate(() => {
      const songs = [];
      const items = document.querySelectorAll('.song-result');
      
      console.log('Found song-result items:', items.length);
      
      // If no .song-result, try to find what elements exist
      if (items.length === 0) {
        const allSongLinks = document.querySelectorAll('a[href*="/songs/"]');
        console.log('Found song links:', allSongLinks.length);
        
        // Try alternative selectors
        const songCards = document.querySelectorAll('.song-card, .song-item, [class*="song"]');
        console.log('Found song-related elements:', songCards.length);
      }
      
      items.forEach((item) => {
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
    
    // Debug: capture page structure if no results
    if (results.length === 0) {
      const pageDebug = await page.evaluate(() => {
        const songLinks = Array.from(document.querySelectorAll('a[href*="/songs/"]')).slice(0, 5).map(a => ({
          text: a.textContent?.trim(),
          href: a.href
        }));
        const headings = Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 5).map(h => h.textContent?.trim());
        const bodyText = document.body?.textContent?.substring(0, 500);
        return {songLinks, headings, bodyText};
      });
      console.log('No results found. Page debug:', JSON.stringify(pageDebug, null, 2));
      
      // Return debug info in the response
      return {
        ok: true,
        results: [],
        count: 0,
        debug: {
          searchUrl: page.url(),
          query: query,
          ...pageDebug
        }
      };
    }

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
exports.songSelectImport = onCall({
  memory: '1GiB',
  timeoutSeconds: 60
}, async (request) => {
  const {email, password, songId} = request.data;

  if (!email || !password || !songId) {
    throw new HttpsError('invalid-argument', 'Email, password, and songId are required');
  }

  let browser;
  try {
    // Add extra stealth args to avoid bot detection
    const stealthArgs = [
      ...chromium.args,
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars'
    ];
    
    browser = await puppeteer.launch({
      args: stealthArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    
    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Use helper function to log in
    await loginToSongSelect(page, email, password);

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

/**
 * Planning Center Online - Validate Personal Access Token
 * PCO uses Personal Access Tokens for API access
 */
exports.pcoAuth = onCall(async (request) => {
  const {appId, secret} = request.data;

  if (!appId || !secret) {
    throw new HttpsError('invalid-argument', 'App ID and Secret are required');
  }

  try {
    // Test the credentials by fetching the current user
    const response = await fetch('https://api.planningcenteronline.com/services/v2/me', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${appId}:${secret}`).toString('base64')
      }
    });

    if (!response.ok) {
      throw new HttpsError('unauthenticated', 'Invalid Planning Center credentials');
    }

    const data = await response.json();
    const user = data.data;

    return {
      ok: true,
      message: 'Successfully authenticated with Planning Center',
      user: {
        id: user.id,
        name: user.attributes.name || user.attributes.email
      }
    };

  } catch (error) {
    console.error('PCO auth error:', error);
    throw new HttpsError('internal', error.message || 'Authentication failed');
  }
});

/**
 * Planning Center Online - Search Songs
 * Searches the PCO Services song library
 */
exports.pcoSearchSongs = onCall(async (request) => {
  const {appId, secret, query} = request.data;

  if (!appId || !secret || !query) {
    throw new HttpsError('invalid-argument', 'App ID, Secret, and query are required');
  }

  try {
    const auth = Buffer.from(`${appId}:${secret}`).toString('base64');
    
    // Search songs endpoint
    const response = await fetch(
      `https://api.planningcenteronline.com/services/v2/songs?where[title]=${encodeURIComponent(query)}&per_page=20`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );

    if (!response.ok) {
      throw new HttpsError('internal', 'Failed to search Planning Center songs');
    }

    const data = await response.json();
    const songs = data.data.map(song => ({
      id: song.id,
      title: song.attributes.title,
      artist: song.attributes.author || '',
      ccliNumber: song.attributes.ccli_number || '',
      themes: song.attributes.themes || '',
      lastScheduled: song.attributes.last_scheduled_at,
      createdAt: song.attributes.created_at
    }));

    return {
      ok: true,
      results: songs,
      count: songs.length
    };

  } catch (error) {
    console.error('PCO search error:', error);
    throw new HttpsError('internal', error.message || 'Search failed');
  }
});

/**
 * Planning Center Online - Import Song
 * Fetches full song details including arrangements
 */
exports.pcoImportSong = onCall(async (request) => {
  const {appId, secret, songId} = request.data;

  if (!appId || !secret || !songId) {
    throw new HttpsError('invalid-argument', 'App ID, Secret, and songId are required');
  }

  try {
    const auth = Buffer.from(`${appId}:${secret}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${auth}`
    };

    // Fetch song details
    const songResponse = await fetch(
      `https://api.planningcenteronline.com/services/v2/songs/${songId}`,
      {headers}
    );

    if (!songResponse.ok) {
      throw new HttpsError('not-found', 'Song not found');
    }

    const songData = await songResponse.json();
    const song = songData.data;

    // Fetch arrangements for this song
    const arrangementsResponse = await fetch(
      `https://api.planningcenteronline.com/services/v2/songs/${songId}/arrangements`,
      {headers}
    );

    let arrangements = [];
    let chordPro = '';
    
    if (arrangementsResponse.ok) {
      const arrangementsData = await arrangementsResponse.json();
      arrangements = arrangementsData.data;

      // Use the first arrangement's chord chart if available
      if (arrangements.length > 0) {
        const firstArr = arrangements[0];
        const arrId = firstArr.id;

        // Fetch the chord chart for this arrangement
        const chartResponse = await fetch(
          `https://api.planningcenteronline.com/services/v2/songs/${songId}/arrangements/${arrId}`,
          {headers}
        );

        if (chartResponse.ok) {
          const chartData = await chartResponse.json();
          const chart = chartData.data;
          
          // Build ChordPro from PCO data
          const lyrics = chart.attributes.chord_chart || chart.attributes.lyrics || '';
          const key = chart.attributes.chord_chart_key || song.attributes.author;
          
          chordPro = `{title: ${song.attributes.title}}
{artist: ${song.attributes.author || ''}}
${song.attributes.ccli_number ? `{ccli: ${song.attributes.ccli_number}}` : ''}
${key ? `{key: ${key}}` : ''}
${song.attributes.themes ? `{comment: Themes: ${song.attributes.themes}}` : ''}

${lyrics}`;
        }
      }
    }

    // If no chord chart, create basic structure
    if (!chordPro) {
      chordPro = `{title: ${song.attributes.title}}
{artist: ${song.attributes.author || ''}}
${song.attributes.ccli_number ? `{ccli: ${song.attributes.ccli_number}}` : ''}

{comment: No chord chart available in Planning Center}
{comment: Add lyrics and chords manually}`;
    }

    return {
      ok: true,
      title: song.attributes.title,
      artist: song.attributes.author || '',
      ccliNumber: song.attributes.ccli_number || '',
      themes: song.attributes.themes || '',
      chordPro: chordPro,
      arrangements: arrangements.map(arr => ({
        id: arr.id,
        name: arr.attributes.name,
        key: arr.attributes.chord_chart_key
      }))
    };

  } catch (error) {
    console.error('PCO import error:', error);
    throw new HttpsError('internal', error.message || 'Import failed');
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   MELCHIZEDEK — Checkr Background Check Proxy
   "And Melchizedek king of Salem brought out bread and wine." — Genesis 14:18

   Security: The Checkr Secret API key is NEVER exposed to the client.
   This function reads it from Firestore (admin-only), calls Checkr server-side,
   and stores only metadata (candidateId, invitationSentAt) in Firestore.
   ═══════════════════════════════════════════════════════════════════════════ */

exports.initiateBackgroundCheck = onCall(async (request) => {
  const { memberId, email, name, packageSlug = 'tasker_standard' } = request.data || {};

  if (!memberId || !email) {
    throw new HttpsError('invalid-argument', 'memberId and email are required.');
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Invalid email address.');
  }

  const db = admin.firestore();

  // ── Read Checkr API key from Firestore (admin-only doc) ─────────────────
  // Key is stored via Admin → Integrations → Checkr in the church's appConfig.
  // This path mirrors UpperRoom.setAppConfig: churchId root → appConfig/{key}
  let apiKey = '';
  try {
    const cfgSnap = await db.collection('appConfig').doc('checkr_api_key').get();
    apiKey = (cfgSnap.exists && cfgSnap.data()?.value) || '';
  } catch (err) {
    console.error('[melchizedek] Failed to read Checkr API key:', err);
  }

  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Checkr API key not configured. Go to Admin → Integrations → Checkr to add your key.');
  }

  const auth = Buffer.from(`${apiKey}:`).toString('base64');

  try {
    // ── Step 1: Create or find Checkr candidate ──────────────────────────
    const candidateRes = await fetch('https://api.checkr.com/v1/candidates', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!candidateRes.ok) {
      const errBody = await candidateRes.text();
      console.error('[melchizedek] Candidate creation failed:', candidateRes.status, errBody);
      throw new HttpsError('internal', `Checkr candidate creation failed: ${candidateRes.status}`);
    }

    const candidate = await candidateRes.json();
    const candidateId = candidate.id;

    // ── Step 2: Create invitation (sends email to candidate) ─────────────
    const inviteRes = await fetch('https://api.checkr.com/v1/invitations', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate_id: candidateId,
        package: packageSlug,
      }),
    });

    let invitationUrl = '';
    if (inviteRes.ok) {
      const inv = await inviteRes.json();
      invitationUrl = inv.invitation_url || inv.url || '';
    } else {
      console.warn('[melchizedek] Invitation creation warning:', inviteRes.status, await inviteRes.text());
      // Non-fatal — candidate created, email may still be sent via Checkr dashboard
    }

    // ── Step 3: Record in Firestore backgroundChecks/{memberId} ─────────
    await db.collection('backgroundChecks').doc(memberId).set({
      memberId,
      email,
      name: name || email,
      checkrCandidateId: candidateId,
      status: 'pending',
      invitationUrl: invitationUrl || '',
      invitationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      ok: true,
      candidateId,
      invitationUrl: invitationUrl || '',
    };

  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error('[melchizedek] Checkr API error:', err);
    throw new HttpsError('internal', err.message || 'Background check service error.');
  }
});

/* ── Checkr webhook receiver ────────────────────────────────────────────── */
// When a background check report completes, Checkr sends a webhook.
// This function updates the member's status in Firestore.
// Configure this as an HTTPS trigger in Checkr Dashboard:
//   https://<region>-<project>.cloudfunctions.net/checkrWebhook
const { onRequest } = require('firebase-functions/v2/https');

exports.checkrWebhook = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const event = req.body;
  const type  = event?.type;

  if (type !== 'report.completed' && type !== 'report.updated') {
    res.status(200).send('ok');
    return;
  }

  const report     = event?.data?.object;
  const reportId   = report?.id;
  const candidateId = report?.candidate_id;
  const result     = report?.result; // 'clear' | 'consider' | 'suspended'

  if (!reportId || !candidateId || !result) {
    res.status(200).send('ok');
    return;
  }

  const db = admin.firestore();

  try {
    // Find the backgroundChecks doc by candidateId
    const snap = await db.collection('backgroundChecks')
      .where('checkrCandidateId', '==', candidateId)
      .limit(1)
      .get();

    if (snap.empty) {
      console.warn('[melchizedek/webhook] No backgroundChecks doc for candidateId', candidateId);
      res.status(200).send('ok');
      return;
    }

    const docRef = snap.docs[0].ref;
    await docRef.set({
      status: result,           // 'clear' → APPROVED, 'consider' → NOT APPROVED
      checkrReportId: reportId,
      reportResult: result,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`[melchizedek/webhook] Updated ${docRef.id}: status=${result}`);
  } catch (err) {
    console.error('[melchizedek/webhook] Error updating Firestore:', err);
  }

  res.status(200).send('ok');
});
