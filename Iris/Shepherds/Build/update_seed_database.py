#!/usr/bin/env python3
"""
update_seed_database.py — Ensure seed_database.json is complete and accurate.

Updates New_Covenant/Data/seed_database.json to match church.firestore.rules:
- Adds missing collections as empty arrays
- Removes deprecated collections
- Renames collections (wordsGreek → lexiconGreek, etc.)
- Adds teachingPlans data from teaching_plans.js
- Updates metadata

NO personal data (prayers, conversations, journal, etc.) — collections exist but are empty.
VALUE-ADDED data (books, theology, devotionals, teachingPlans, etc.) is preserved/added.
"""

import json
import re
import os
from datetime import datetime, timezone
from pathlib import Path

# Workspace root
REPO_ROOT = Path(__file__).resolve().parents[3]
SEED_DB_PATH = REPO_ROOT / "New_Covenant" / "Data" / "seed_database.json"
TEACHING_PLANS_PATH = REPO_ROOT / "New_Covenant" / "Data" / "teaching_plans.js"
STRONGS_GREEK_PATH = REPO_ROOT / "New_Covenant" / "Data" / "strongs-greek.js"
STRONGS_HEBREW_PATH = REPO_ROOT / "New_Covenant" / "Data" / "strongs-hebrew.js"

# Collections from church.firestore.rules that should exist
REQUIRED_COLLECTIONS = [
    # System collections (empty)
    "_aggregations",
    "_counters",
    "_deleteRequests",
    
    # App configuration
    "appConfig",
    "masterConfig",
    "settings",
    "preferences",
    
    # Deployment/admin
    "auditLog",
    "churchVault",
    "deployConfigs",
    "problems",
    "accessControl",
    
    # FlockChat
    "conversations",
    "flockchat_announcements",
    "flockchat_presence",
    "flockchat_rooms",
    "notifications",
    "templates",
    "broadcasts",
    
    # Users/Members
    "users",
    "members",
    "memberCards",
    "memberCardViews",
    "permissions",
    "households",
    "milestones",
    
    # Care/Compassion/Outreach
    "careCases",
    "careInteractions",
    "careAssignments",
    "compassionRequests",
    "compassionLogs",
    "compassionResources",
    "outreachContacts",
    "outreachCampaigns",
    "outreachFollowUps",
    "contactLog",
    "pastoralNotes",
    
    # Prayer
    "prayers",
    "todos",
    
    # Events/Calendar
    "events",
    "rsvps",
    "calendarEvents",
    
    # Groups/Volunteers/Ministries
    "groups",
    "volunteers",
    "ministries",
    "attendance",
    "checkinSessions",
    
    # Worship/Music
    "songs",
    "albums",
    "servicePlans",
    "quarterlyPlans",
    
    # Sermons
    "sermons",
    "sermonSeries",
    "sermonReviews",
    
    # Giving
    "giving",
    "pledges",
    
    # Discipleship
    "discipleshipPaths",
    "discipleshipSteps",
    "discipleshipEnrollments",
    "discipleshipMentoring",
    "discipleshipMeetings",
    "discipleshipGoals",
    "discipleshipAssessments",
    "discipleshipMilestones",
    "discipleshipCertificates",
    
    # Learning
    "learningTopics",
    "learningPlaylists",
    "learningPlaylistItems",
    "learningQuizzes",
    "learningQuizResults",
    "learningRecommendations",
    "learningProgress",
    "learningNotes",
    "learningCertificates",
    
    # Strategic
    "strategicGoals",
    "strategicInitiatives",
    "strategicKeyDates",
    
    # Missions
    "missionsRegistry",
    "missionsPartners",
    "missionsPrayerFocus",
    "missionsUpdates",
    "missionsTeams",
    
    # Statistics
    "statisticsConfig",
    "statisticsSnapshots",
    "statisticsViews",
    
    # Journal
    "journal",
    
    # Value-added content (should have data)
    "books",
    "devotionals",
    "theology",
    "theologyCategories",
    "theologySections",
    "apologetics",
    "counseling",
    "genealogy",
    "heart",
    "mirror",
    "quiz",
    "reading",
    "teachingPlans",
    "lexiconGreek",
    "lexiconHebrew",
]

# Collections to REMOVE (deprecated or renamed)
DEPRECATED_COLLECTIONS = [
    "channels",  # Now flockchat_rooms
    "config",    # Now appConfig
    "churches",  # Backend-only (Bezalel/GAS), not used in church deployments
    "cardLinks", # Subcollection, not top-level
    "groupMembers", # Subcollection under groups
    "learningBookmarks", # Not in rules
    "messages",  # Subcollection under conversations
    "missionsCities", # Deprecated/merged
    "missionsMetrics", # Deprecated/merged
    "missionsRegions", # Deprecated/merged
    "owPrayerAnswers", # Unknown/deprecated
    "owPrayerChallenges", # Unknown/deprecated
    "passages", # Unknown/deprecated
    "readingPlans", # Deprecated/consolidated into reading
    "wordsGreek", # Renamed to lexiconGreek
    "wordsHebrew", # Renamed to lexiconHebrew
]

# Collections that should stay EMPTY (personal data)
PERSONAL_COLLECTIONS = {
    "_aggregations",
    "_counters",
    "_deleteRequests",
    "auditLog",
    "careCases",
    "careInteractions",
    "careAssignments",
    "compassionRequests",
    "compassionLogs",
    "contactLog",
    "conversations",
    "discipleshipEnrollments",
    "discipleshipGoals",
    "discipleshipMeetings",
    "flockchat_announcements",
    "flockchat_presence",
    "flockchat_rooms",
    "giving",
    "journal",
    "learningProgress",
    "learningNotes",
    "learningQuizResults",
    "members",
    "memberCards",
    "memberCardViews",
    "notifications",
    "outreachContacts",
    "outreachFollowUps",
    "pastoralNotes",
    "permissions",
    "pledges",
    "prayers",
    "preferences",
    "problems",
    "quarterlyPlans",
    "rsvps",
    "sermons",
    "servicePlans",
    "todos",
    "users",
}


def load_teaching_plans():
    """Parse teaching_plans.js and return array of records."""
    if not TEACHING_PLANS_PATH.exists():
        print(f"  ⚠ teaching_plans.js not found, skipping")
        return []
    
    with open(TEACHING_PLANS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract the JSON array from: export default [...]
    match = re.search(r'export\s+default\s+(\[[\s\S]*\]);?\s*$', content)
    if not match:
        print(f"  ⚠ Could not parse teaching_plans.js")
        return []
    
    try:
        data = json.loads(match.group(1))
        print(f"  ✓ Loaded {len(data)} teaching plan sessions")
        return data
    except json.JSONDecodeError as e:
        print(f"  ⚠ JSON parse error in teaching_plans.js: {e}")
        return []


def load_strongs_lexicon(file_path, lexicon_name):
    """Parse strongs-greek.js or strongs-hebrew.js and return array of documents."""
    if not file_path.exists():
        print(f"  ⚠ {file_path.name} not found, skipping")
        return []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract the JSON object from: export default {...}
    match = re.search(r'export\s+default\s+(\{[\s\S]*\});?\s*$', content)
    if not match:
        print(f"  ⚠ Could not parse {file_path.name}")
        return []
    
    try:
        # Parse the object
        obj = json.loads(match.group(1))
        
        # Convert from {G1234: {...}, G1235: {...}} to [{_id: "G1234", ...}, {_id: "G1235", ...}]
        documents = []
        for strongs_id, entry in obj.items():
            doc = {"_id": strongs_id}
            doc.update(entry)
            documents.append(doc)
        
        print(f"  ✓ Loaded {len(documents)} {lexicon_name} entries")
        return documents
    except json.JSONDecodeError as e:
        print(f"  ⚠ JSON parse error in {file_path.name}: {e}")
        return []


def update_seed_database():
    """Update seed_database.json to match church.firestore.rules."""
    print(f"Loading seed database: {SEED_DB_PATH}")
    
    with open(SEED_DB_PATH, 'r', encoding='utf-8') as f:
        db = json.load(f)
    
    collections = db.get('collections', {})
    original_count = len(collections)
    
    # 1. Remove deprecated collections
    removed = []
    for deprecated in DEPRECATED_COLLECTIONS:
        if deprecated in collections:
            del collections[deprecated]
            removed.append(deprecated)
    
    if removed:
        print(f"\n✓ Removed {len(removed)} deprecated collections:")
        for name in sorted(removed):
            print(f"  - {name}")
    
    # 2. Rename collections
    renames = {
        'wordsGreek': 'lexiconGreek',
        'wordsHebrew': 'lexiconHebrew',
    }
    for old, new in renames.items():
        if old in collections and new not in collections:
            collections[new] = collections.pop(old)
            print(f"✓ Renamed: {old} → {new}")
    
    # 3. Add missing collections
    added = []
    for coll in REQUIRED_COLLECTIONS:
        if coll not in collections:
            # Personal collections start empty
            if coll in PERSONAL_COLLECTIONS:
                collections[coll] = []
            # Value-added collections might have seed data
            elif coll == 'teachingPlans':
                collections[coll] = load_teaching_plans()
            elif coll == 'lexiconGreek':
                collections[coll] = load_strongs_lexicon(STRONGS_GREEK_PATH, "Greek")
            elif coll == 'lexiconHebrew':
                collections[coll] = load_strongs_lexicon(STRONGS_HEBREW_PATH, "Hebrew")
            elif coll == 'appConfig':
                # Add default app config with maintenance mode
                collections[coll] = [{
                    "_id": "maintenance",
                    "enabled": False,
                    "message": "",
                    "allowedEmails": [],
                    "createdAt": None
                }]
            elif coll == 'masterConfig':
                # Add basic master config
                collections[coll] = [{
                    "_id": "defaults",
                    "createdAt": None
                }]
            else:
                # Default to empty for others
                collections[coll] = []
            added.append(coll)
    
    if added:
        print(f"\n✓ Added {len(added)} missing collections:")
        for name in sorted(added):
            data_note = f" (+ {len(collections[name])} docs)" if collections[name] else ""
            print(f"  + {name}{data_note}")
    
    # 4. Ensure personal collections are empty (no user data)
    cleared = []
    for coll in PERSONAL_COLLECTIONS:
        if coll in collections and collections[coll]:
            collections[coll] = []
            cleared.append(coll)
    
    if cleared:
        print(f"\n✓ Cleared {len(cleared)} personal collections (no user data):")
        for name in sorted(cleared):
            print(f"  ∅ {name}")
    
    # 5. Populate empty value-added collections that should have data
    populated = []
    if 'lexiconGreek' in collections and not collections['lexiconGreek']:
        collections['lexiconGreek'] = load_strongs_lexicon(STRONGS_GREEK_PATH, "Greek")
        if collections['lexiconGreek']:
            populated.append(f"lexiconGreek ({len(collections['lexiconGreek'])} docs)")
    
    if 'lexiconHebrew' in collections and not collections['lexiconHebrew']:
        collections['lexiconHebrew'] = load_strongs_lexicon(STRONGS_HEBREW_PATH, "Hebrew")
        if collections['lexiconHebrew']:
            populated.append(f"lexiconHebrew ({len(collections['lexiconHebrew'])} docs)")
    
    if populated:
        print(f"\n✓ Populated {len(populated)} value-added collections:")
        for name in populated:
            print(f"  📚 {name}")
    
    # 6. Update metadata
    total_docs = sum(len(docs) for docs in collections.values())
    total_collections = len(collections)
    
    # Check if we have Strong's data
    has_strongs = (
        collections.get('lexiconGreek') and len(collections['lexiconGreek']) > 0 and
        collections.get('lexiconHebrew') and len(collections['lexiconHebrew']) > 0
    )
    
    db['__meta'] = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "generator": "Iris/Shepherds/Build/update_seed_database.py",
        "churchId": "FlockOS",
        "format": "FlockOS-Firestore-JSON-v1",
        "version": "seed-2.1",
        "collections": total_collections,
        "totalDocs": total_docs,
        "includesStrongs": has_strongs,
        "note": "Complete seed database for a fresh FlockOS church deployment. All collections from church.firestore.rules are present. Value-added collections (books, theology, devotionals, teachingPlans, lexicons, etc.) contain seed data. Personal collections (prayers, conversations, journal, etc.) are empty arrays. Import via Admin → Church Audit → ⬆ Import .json"
    }
    
    # Reorder collections alphabetically
    db['collections'] = dict(sorted(collections.items()))
    
    # 7. Save updated database
    print(f"\n✓ Updating seed_database.json:")
    print(f"  Collections: {original_count} → {total_collections}")
    print(f"  Total docs: {total_docs}")
    
    with open(SEED_DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ seed_database.json updated successfully")


if __name__ == '__main__':
    update_seed_database()
