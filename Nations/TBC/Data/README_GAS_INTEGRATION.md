# seed_database.json — GAS Integration

## Overview

`seed_database.json` can now be used in Google Apps Script (GAS) to seed **both** Google Sheets (GAS-mode) and Firestore (Firestore-mode) from a single source.

**Stats:**
- 101 collections
- 17,443 documents
- 5.9 MB JSON file
- Includes Strong's lexicons (8,674 Hebrew + 5,523 Greek entries)

---

## Quick Start

### For New Church Setup

Add `seedFromMasterJSON()` function to your GAS `Code.gs` file (see implementation in `Architechtural Docs/New Covenant/Data/seedFromMasterJSON.gs`).

**What it does:**
1. Fetches this file from GitHub Pages
2. Seeds Google Sheet tabs (GAS mode)
3. Seeds Firestore collections (Firestore mode)
4. Returns stats: `{ sheets, firestore, collections, errors }`

**Usage:**
```javascript
// In setupFlockOSGAS() or setupFlockOSFirestore()
var stats = seedFromMasterJSON();
// ✅ Seeded 14 Sheet tabs, 17,443 Firestore docs
```

---

## Published URL

This file is automatically published to GitHub Pages by B-Build:

**https://flock-os.github.io/FlockOS/New_Covenant/Data/seed_database.json**

GAS fetches from this URL using `UrlFetchApp.fetch()`.

---

## Documentation

Complete documentation is available in `Architechtural Docs/New Covenant/Data/`:

1. **SEED_DATABASE_GAS_INTEGRATION.md** — Technical details, architecture, how it works
2. **seedFromMasterJSON.gs** — Complete GAS function code (paste into Code.gs)
3. **NEW_CHURCH_SETUP.md** — Step-by-step guide for setting up new churches

---

## Maintenance

### Keeping seed_database.json Up to Date

B-Build automatically monitors for changes and warns you:

```bash
bash Iris/Bezalel/Scripts/B-Build_Nations.sh
# → ⚠️  NOTICE: Source data files are newer than seed_database.json
#    Run: python3 Iris/Shepherds/Build/update_seed_database.py
```

**Update workflow:**
```bash
# 1. Update seed database
bash Iris/Shepherds/Build/refresh_seed_database.sh

# 2. B-Build to sync to Nations/
bash Iris/Bezalel/Scripts/B-Build_Nations.sh

# 3. Commit + push (auto-deploys to GitHub Pages)
git add -A && git commit -m "Update seed_database.json" && git push origin main
```

See `Iris/Shepherds/Build/SEED_DATABASE_MAINTENANCE.md` for details.

---

## Benefits

### Before
❌ Seed data scattered (hard-coded in GAS, copied from Firestore)  
❌ Manual data entry (~30-60 min per church)  
❌ GAS and Firestore seeded separately  
❌ No Strong's lexicons  

### After
✅ Single source of truth (`seed_database.json`)  
✅ Fully automated (one function call)  
✅ Seeds both GAS and Firestore  
✅ Complete (17,443 docs including lexicons)  
✅ Fast (~3-4 minutes total)  

---

## File Structure

```
New_Covenant/Data/
  ├── seed_database.json         ← Master seed database (THIS FILE)
  ├── strongs-greek.js            ← Source: Greek lexicon (5,523 entries)
  ├── strongs-hebrew.js           ← Source: Hebrew lexicon (8,674 entries)
  ├── teaching_plans.js           ← Source: Teaching sessions
  └── README_GAS_INTEGRATION.md   ← This file

Architechtural Docs/New Covenant/Data/  (PRIVATE, gitignored)
  ├── SEED_DATABASE_GAS_INTEGRATION.md  ← Technical docs
  ├── seedFromMasterJSON.gs             ← GAS function code
  └── NEW_CHURCH_SETUP.md               ← Setup guide

Iris/Shepherds/Build/
  ├── update_seed_database.py     ← Updates seed_database.json
  ├── refresh_seed_database.sh    ← Helper wrapper
  └── SEED_DATABASE_MAINTENANCE.md ← Maintenance guide
```

---

## Example: Setting Up a New Church

```javascript
// 1. In Apps Script, paste Code.gs from B-Master Code.md
// 2. Append seedFromMasterJSON() function
// 3. Set Script Properties (service accounts, project IDs)
// 4. Run setup:

function setupFlockOSFirestore() {
  // ... existing setup ...
  
  // Seed from master JSON
  var stats = seedFromMasterJSON();
  Logger.log('✅ Seeded ' + stats.sheets + ' tabs, ' + stats.firestore + ' docs');
  
  // ... rest of setup ...
}
```

**Result:** Church has all 17,443 seed documents in both Sheet and Firestore, ready to use!

---

## Support

**Issues:** https://github.com/flock-os/FlockOS/issues  
**Docs:** See `Architechtural Docs/New Covenant/Data/` for complete documentation
