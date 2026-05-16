# FlockOS Firebase Cloud Functions

This directory contains Firebase Cloud Functions for FlockOS, including SongSelect integration.

## Setup

1. Install dependencies:
```bash
cd functions
npm install
```

2. Deploy to Firebase:
```bash
firebase deploy --only functions --project flockos-notify
```

## Functions

### SongSelect Integration

Three Cloud Functions enable direct SongSelect integration in the STAND music app:

#### `songSelectAuth`
Validates SongSelect credentials by logging into the CCLI SongSelect website.

**Parameters:**
- `email` - SongSelect account email
- `password` - SongSelect account password

**Returns:**
```json
{
  "ok": true,
  "message": "Successfully authenticated with SongSelect",
  "email": "user@example.com"
}
```

#### `songSelectSearch`
Searches the SongSelect library for songs.

**Parameters:**
- `email` - SongSelect account email  
- `password` - SongSelect account password
- `query` - Search term

**Returns:**
```json
{
  "ok": true,
  "results": [
    {
      "title": "Goodness of God",
      "artist": "Bethel Music",
      "ccliNumber": "7118914",
      "url": "https://songselect.ccli.com/Songs/7118914",
      "songId": "7118914"
    }
  ],
  "count": 1
}
```

#### `songSelectImport`
Fetches the full ChordPro chart for a specific song.

**Parameters:**
- `email` - SongSelect account email
- `password` - SongSelect account password
- `songId` - SongSelect song ID

**Returns:**
```json
{
  "ok": true,
  "title": "Goodness of God",
  "artist": "Bethel Music",
  "ccliNumber": "7118914",
  "key": "C",
  "chordPro": "{title: Goodness of God}\n{artist: Bethel Music}..."
}
```

## How It Works

The SongSelect integration uses Puppeteer (headless Chrome) to:
1. Log into SongSelect with user credentials
2. Search for songs
3. Scrape song details and ChordPro files
4. Return data to the client

### Security Notes

- User credentials are sent securely via HTTPS
- Credentials are NOT stored on the server
- Each request authenticates fresh with SongSelect
- Puppeteer runs in a sandboxed environment

### Performance

- Authentication: ~3-5 seconds
- Search: ~3-5 seconds
- Import: ~5-8 seconds

Times vary based on SongSelect website response and network conditions.

## Local Development

Test functions locally with the Firebase emulator:

```bash
firebase emulators:start --only functions
```

Then in your client code:
```javascript
if (location.hostname === 'localhost') {
  firebase.functions().useEmulator('localhost', 5001);
}
```

## Troubleshooting

### "Deployment error" or "Function timeout"

Puppeteer requires more memory than the default Cloud Functions allocation. If you see timeout errors:

1. Update functions to use more memory in `firebase.json`:
```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs18",
    "memory": "1GB",
    "timeout": "60s"
  }
}
```

2. Redeploy:
```bash
firebase deploy --only functions
```

### "SongSelect login failed"

- Verify credentials are correct
- Check if SongSelect changed their login page structure
- May need to update selectors in `index.js`

### "ChordPro not found"

Not all SongSelect songs have ChordPro export available. The function will construct a basic ChordPro file from scraped lyrics if the download link isn't available.

## Cost Estimates

Firebase Cloud Functions pricing (as of 2024):
- 2 million invocations/month free
- After that: $0.40 per million invocations
- 400,000 GB-seconds memory free
- After that: $0.0025 per GB-second

With 1GB memory and ~5 second average duration:
- ~80,000 searches/month within free tier
- Beyond that: ~$0.02 per 100 searches

## Compliance

This integration complies with SongSelect Terms of Service:
- Users must have valid CCLI SongSelect subscriptions
- Songs are for personal church use
- No redistribution of ChordPro files
- Respects SongSelect download limits
