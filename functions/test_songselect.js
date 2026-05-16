const https = require('https');

// Test SongSelect Search
const testSearch = async () => {
  const data = JSON.stringify({
    data: {
      email: process.env.SONGSELECT_EMAIL || '',
      password: process.env.SONGSELECT_PASSWORD || '',
      query: 'Forever Kari Jobe'
    }
  });

  const options = {
    hostname: 'songSelectSearch-ugywa2xnka-uc.a.run.app',
    port: 443,
    path: '/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', body);
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Error:', e.message);
      reject(e);
    });

    req.write(data);
    req.end();
  });
};

// Get credentials from command line args if provided
if (process.argv.length >= 4) {
  process.env.SONGSELECT_EMAIL = process.argv[2];
  process.env.SONGSELECT_PASSWORD = process.argv[3];
}

if (!process.env.SONGSELECT_EMAIL || !process.env.SONGSELECT_PASSWORD) {
  console.error('Usage: node test_songselect.js <email> <password>');
  console.error('Or set SONGSELECT_EMAIL and SONGSELECT_PASSWORD environment variables');
  process.exit(1);
}

console.log('Testing SongSelect search for "Forever" by Kari Jobe...');
console.log('Email:', process.env.SONGSELECT_EMAIL);
console.log('---\n');

testSearch()
  .then(result => {
    if (result.result && result.result.results) {
      console.log('\n✓ Search successful!');
      console.log(`Found ${result.result.results.length} songs:\n`);
      result.result.results.forEach((song, idx) => {
        console.log(`${idx + 1}. ${song.title}`);
        console.log(`   Artist: ${song.artist}`);
        console.log(`   CCLI: ${song.ccliNumber}`);
        console.log(`   URL: ${song.url}`);
        console.log('');
      });
    } else if (result.error) {
      console.error('\n✗ Search failed:', result.error.message);
      console.error('Details:', JSON.stringify(result.error, null, 2));
    } else {
      console.log('\nRaw result:', JSON.stringify(result, null, 2));
    }
  })
  .catch(err => {
    console.error('\n✗ Request failed:', err.message);
    process.exit(1);
  });
