# Seed Database Maintenance

## Overview

`seed_database.json` is the **complete** seed database for fresh FlockOS church deployments. It contains:
- All 101 collections from `church.firestore.rules`
- All value-added content (17,443+ documents)
- Empty arrays for personal/operational collections
- NO user data (prayers, conversations, journals, etc.)

**File:** `/New_Covenant/Data/seed_database.json`  
**Size:** 5.9 MB (164,998 lines)  
**Docs:** 17,443 documents across 101 collections

---

## Automatic Monitoring

**B-Build includes automatic freshness checking:**

When you run `B-Build_Nations.sh`, it automatically checks if source data files are newer than `seed_database.json`. If they are, you'll see:

```
⚠️  NOTICE: Source data files are newer than seed_database.json
   Run: python3 Iris/Shepherds/Build/update_seed_database.py
```

This check happens **after** the Nations build completes, so it won't slow down your workflow.

**Source files monitored:**
- `New_Covenant/Data/strongs-greek.js` (5,523 Greek lexicon entries)
- `New_Covenant/Data/strongs-hebrew.js` (8,674 Hebrew lexicon entries)
- `New_Covenant/Data/teaching_plans.js` (teaching sessions)

---

## When to Update seed_database.json

### ✅ Update When:
1. **B-Build warns** that source data is newer
2. **After adding/updating** content in `New_Covenant/Data/` folder
3. **Before creating** a new church deployment
4. **After updating** `church.firestore.rules` (new collections added)
5. **Monthly/quarterly** maintenance

### ❌ Don't Update:
- On every B-Build (checked automatically, only update when needed)
- For personal data changes (seed DB has no user data)
- For code changes (only data changes matter)

---

## How to Update

### Option 1: Helper Script (Recommended)
```bash
bash Iris/Shepherds/Build/refresh_seed_database.sh
```

**What it does:**
1. Runs `update_seed_database.py`
2. Shows what changed
3. Provides next steps (B-Build, commit, push)

### Option 2: Direct Python Script
```bash
python3 Iris/Shepherds/Build/update_seed_database.py
```

**What it updates:**
- Adds missing collections from `church.firestore.rules`
- Removes deprecated collections
- Loads latest lexicon data (Greek + Hebrew)
- Loads latest teaching plans
- Updates metadata (timestamp, doc count, etc.)
- Preserves all existing value-added data

---

## After Updating

### 1. Review Changes
```bash
git diff New_Covenant/Data/seed_database.json
```

### 2. B-Build (syncs to Nations/)
```bash
bash Iris/Bezalel/Scripts/B-Build_Nations.sh
```

### 3. Commit & Push
```bash
git add -A
git commit -m "Update seed_database.json with latest data"
git push origin main
```

---

## What's Included

### Value-Added Collections (14 with data):
| Collection | Docs | Description |
|------------|------|-------------|
| lexiconHebrew | 8,674 | Strong's Hebrew concordance |
| lexiconGreek | 5,523 | Strong's Greek concordance |
| genealogy | 1,321 | Biblical genealogy |
| devotionals | 979 | Daily devotionals |
| reading | 365 | Reading plans |
| missionsRegistry | 238 | Missions data |
| apologetics | 115 | Apologetics Q&A |
| books | 66 | Bible books metadata |
| counseling | 50 | Counseling resources |
| quiz | 50 | Bible quizzes |
| theology | 27 | Theology content |
| heart | 15 | Heart devotions |
| mirror | 15 | Mirror reflections |
| teachingPlans | 2 | Teaching sessions |

### Personal/Empty Collections (87):
All operational collections exist but are empty:
- `prayers`, `conversations`, `journal` (personal data)
- `members`, `users`, `permissions` (church-specific)
- `sermons`, `events`, `giving` (operational data)
- Plus 81 more collections ready for use

---

## Troubleshooting

### "Missing collections" error
**Solution:** Run `update_seed_database.py` to add them

### "Lexicons are empty"
**Solution:** Ensure `strongs-greek.js` and `strongs-hebrew.js` exist, then run update script

### "File is huge"
**Normal:** 5.9 MB is expected with 14,197 lexicon entries

### "B-Build keeps warning me"
**Solution:** Run the update script, then B-Build again to sync the changes

---

## Maintenance Schedule

**Recommended:**
- **Check:** Every B-Build (automatic)
- **Update:** When warned OR monthly
- **Review:** Before new church deployments

**Quick check:**
```bash
# See when seed_database.json was last updated
ls -lh New_Covenant/Data/seed_database.json

# See when source data was last modified
ls -lh New_Covenant/Data/strongs-*.js
ls -lh New_Covenant/Data/teaching_plans.js
```

---

## Files

**Scripts:**
- `Iris/Shepherds/Build/update_seed_database.py` — Main update script
- `Iris/Shepherds/Build/refresh_seed_database.sh` — Helper wrapper
- `Iris/Bezalel/Scripts/B-Build_Nations.sh` — Auto-checks freshness

**Data:**
- `New_Covenant/Data/seed_database.json` — The seed database
- `New_Covenant/Data/strongs-greek.js` — Greek lexicon source
- `New_Covenant/Data/strongs-hebrew.js` — Hebrew lexicon source
- `New_Covenant/Data/teaching_plans.js` — Teaching plans source

**Configuration:**
- `church.firestore.rules` — Collection definitions (source of truth)
