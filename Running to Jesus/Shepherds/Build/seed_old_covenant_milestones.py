#!/usr/bin/env python3
"""Seed Old Covenant (pre-April 28, 2026) FlockOS build history milestones
into the flockos-notify Firestore /milestones collection.

These milestones cover the original GAS + Google Sheets architecture phase
(March–April 2026) before the New Covenant Firebase/GitHub Pages rebuild.

Usage:
    python3 seed_old_covenant_milestones.py
    python3 seed_old_covenant_milestones.py --dry-run
"""
import json
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone

GCLOUD     = "/Users/greg.granger/google-cloud-sdk/bin/gcloud"
PROJECT    = "flockos-notify"
COLLECTION = "milestones"

# ── Old Covenant Timeline — March 19 → April 24, 2026 ────────────────────────
MILESTONES = [
    {
        "date": "2026-03-19",
        "year": 2026,
        "category": "founding",
        "title": "FlockOS Founded",
        "description": (
            "The original vision laid: zero-licensing-fee church management on Google "
            "infrastructure. Defined the Books-of-the-Bible naming convention, designed "
            "the 4-API architecture (Matthew / Mark / Luke / John), built the full "
            "200-tab Google Sheet schema (~4,256 columns), and wrote all foundational "
            "JS modules — the_tabernacle, the_true_vine, firm_foundation, the_cornerstone, "
            "the_upper_room, the_scrolls, the_shofar, the_seasons, the_harvest, "
            "the_way, the_wellspring, the_well, and the_living_water. First database "
            "timestamp recorded."
        ),
    },
    {
        "date": "2026-03-21",
        "year": 2026,
        "category": "building",
        "title": "Backend Wiring & Core Frontend Modules",
        "description": (
            "Fixed 9+ broken wiring patterns across all major GAS modules. Built Tasks, "
            "Volunteer Enrichment, Prayer Admin, Journaling, Bible.com ESV Integration, "
            "Reading Plans, Audit Logging, and Module Toggle Switches. Renamed "
            "'Prayer Wall' → 'Prayer Request' across 13 files."
        ),
    },
    {
        "date": "2026-03-22",
        "year": 2026,
        "category": "leadership",
        "title": "My Flock Portal — Full Member Management",
        "description": (
            "the_life.js extracted (2,176 lines) — role-aware hub with full 7-section "
            "member editor covering all 51 Members table columns. Messages and "
            "Notifications rebuilt as card-based UI with real-time bell badge and "
            "routing for 20+ notification types."
        ),
    },
    {
        "date": "2026-03-25",
        "year": 2026,
        "category": "tech",
        "title": "Single-File Backend Consolidation",
        "description": (
            "All 4 GAS APIs (Matthew + Mark + Luke + John, ~745 functions) merged into "
            "one unified Master Code.gs (~25,000 lines). One GAS project, one file, "
            "one endpoint. JS minification pipeline added: 1.57 MB → 1.10 MB (30% reduction)."
        ),
    },
    {
        "date": "2026-03-27",
        "year": 2026,
        "category": "tech",
        "title": "Single-Sheet Architecture Complete",
        "description": (
            "All 4 Google Sheets fully consolidated into 1 sheet (200 tabs, ~4,256 columns). "
            "All 4 GAS projects consolidated into 1. Frontend TheVine now routes to a "
            "single DATABASE_URL endpoint — full unification achieved."
        ),
    },
    {
        "date": "2026-03-31",
        "year": 2026,
        "category": "missions",
        "title": "Multi-Church Build System Live",
        "description": (
            "build_churches.sh launched: reads per-church JSON configs, produces branded "
            "deployments under Church/<shortName>/. First partner churches onboarded and "
            "deployed to GitHub Pages. Per-church analytics tags registered."
        ),
    },
    {
        "date": "2026-04-04",
        "year": 2026,
        "category": "leadership",
        "title": "24-Type Pastoral Care System",
        "description": (
            "Care type engine expanded to 24 types — each with workflow guide, default "
            "priority, and assessment notes template. Types include Crisis, Grief, "
            "Marriage, Addiction, Hospital Visit, New Believer, Restoration, Domestic "
            "Violence, Immigration, Elder Care, and more."
        ),
    },
    {
        "date": "2026-04-05",
        "year": 2026,
        "category": "tech",
        "title": "Capability-Based Permissions System",
        "description": (
            "Nehemiah.can() function-level permission checks deployed across all modules. "
            "Professional permission matrix UI with capability descriptions and risk badges "
            "(LOW / MEDIUM / HIGH / CRITICAL). Need-to-know model: deny by default."
        ),
    },
    {
        "date": "2026-04-07",
        "year": 2026,
        "category": "tech",
        "title": "The Upper Room — Firebase Firestore Layer",
        "description": (
            "the_upper_room.js (4,576 lines) launched — Firebase Firestore real-time data "
            "layer covering DMs, chat rooms, channels, notifications, journal, devotionals, "
            "and 20+ data collections. Firebase Auth bridge added. Dynamic church logos "
            "and splash screens deployed across all churches."
        ),
    },
    {
        "date": "2026-04-08",
        "year": 2026,
        "category": "building",
        "title": "Full Firebase Migration",
        "description": (
            "Prayer, Todo, Care, Compassion, and Outreach migrated to Firestore. Firestore "
            "Truth collections seeded. Per-church Firebase config added to every deployment. "
            "11,688+ documents seeded across all content types."
        ),
    },
    {
        "date": "2026-04-10",
        "year": 2026,
        "category": "tech",
        "title": "The Great Commission — Church Command Center",
        "description": (
            "Seed-admin-only Church Command Center launched: Church Registry with "
            "lock/unlock/provision actions, AppConfig editor, and flat-path Firestore "
            "architecture migration. Member IDs formatted as xxx-xx-xxxx pins."
        ),
    },
    {
        "date": "2026-04-11",
        "year": 2026,
        "category": "building",
        "title": "Truth Editor & Bezalel Matrix",
        "description": (
            "the_truth.js (618 lines) — full CRUD interface for all Matthew APP content. "
            "Bezalel Matrix merged into unified bezalel.html. Quarterly Worship Planner "
            "polished with auth guard and pull-from-Service-Plans feature."
        ),
    },
    {
        "date": "2026-04-13",
        "year": 2026,
        "category": "leadership",
        "title": "Master Group System — 48-Gate Security Sweep",
        "description": (
            "Master group introduced as full system bypass tier. 48 access gates patched "
            "across 13 files. Groups system fixed with 3-source resolution. Calendar "
            "week/day views rebuilt with absolute-positioned event blocks. "
            "68,347 total frontend lines; v3.17."
        ),
    },
    {
        "date": "2026-04-15",
        "year": 2026,
        "category": "tech",
        "title": "FlockChat — Real-Time Church Messaging",
        "description": (
            "FlockChat fully integrated: unified login, role sync, real-time presence. "
            "Role-gated channels (readonly → volunteer → care → leader → pastor → admin), "
            "admin dashboard, push notifications via FCM, America theme, and PWA manifest. "
            "Deployed to Firebase Hosting (flockos-comms)."
        ),
    },
    {
        "date": "2026-04-19",
        "year": 2026,
        "category": "tech",
        "title": "BCP Auto-Build Pipeline & Unified Launcher",
        "description": (
            "BCP script auto-syncs all church deployments — propagates LICENSE, favicon, "
            "manifest updates, and per-church branding. Single-page SPA launcher at "
            "index.html with deployment tree and legacy URL redirect support."
        ),
    },
    {
        "date": "2026-04-21",
        "year": 2026,
        "category": "building",
        "title": "CSS Unification — american_garments.css",
        "description": (
            "All app-shell and shared styles consolidated into american_garments.css "
            "(single source of truth). Build pipeline auto-syncs SharedVessels CSS to "
            "Tabernacle and all deployments. FlockChat and FlockOS share unified theme "
            "tokens, color palette, and responsive breakpoints."
        ),
    },
    {
        "date": "2026-04-24",
        "year": 2026,
        "category": "founding",
        "title": "Old Covenant v3.19 — Final Build",
        "description": (
            "Full BCP build and deploy of all 4 churches, FlockChat, and comms. "
            "70,815 total frontend lines; 27,550-line Master Code.gs; 11,688+ Firestore docs; "
            "14 themes; 24 care types; 4 partner church deployments. "
            "Final Old Covenant release before New Covenant architecture began."
        ),
    },
]


# ── Firestore REST helpers ────────────────────────────────────────────────────

def token() -> str:
    return subprocess.check_output([GCLOUD, "auth", "print-access-token"], text=True).strip()


def http(method: str, url: str, tok: str, body: bytes | None = None) -> dict:
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {tok}")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as r:
        data = r.read()
    return json.loads(data) if data else {}


def to_fs(value) -> dict:
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {k: to_fs(v) for k, v in value.items()}}}
    if isinstance(value, list):
        return {"arrayValue": {"values": [to_fs(v) for v in value]}}
    return {"nullValue": None}


def write_milestone(milestone: dict, tok: str, dry_run: bool = False) -> None:
    now_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    doc = dict(milestone)
    doc["createdAt"] = now_ts
    doc["createdBy"] = "system"

    fields = {k: to_fs(v) for k, v in doc.items()}
    fields["createdAt"] = {"timestampValue": now_ts}

    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT}"
        f"/databases/(default)/documents/{COLLECTION}"
    )
    body = json.dumps({"fields": fields}).encode()

    if dry_run:
        print(f"  [DRY-RUN] Would write: {milestone['date']} — {milestone['title']}")
        return

    try:
        resp = http("POST", url, tok, body)
        doc_id = resp.get("name", "").rsplit("/", 1)[-1]
        print(f"  ✓ {milestone['date']} — {milestone['title']} (id: {doc_id})")
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace")
        print(f"  ✗ {milestone['title']}: HTTP {e.code} — {body_err[:200]}")
        raise


def main() -> int:
    dry_run = "--dry-run" in sys.argv

    print(f"\nFlockOS Old Covenant Timeline Seeder")
    print(f"  Project   : {PROJECT}")
    print(f"  Collection: {COLLECTION}")
    print(f"  Milestones: {len(MILESTONES)}")
    print(f"  Mode      : {'DRY RUN' if dry_run else 'LIVE WRITE'}")
    print()

    tok = token() if not dry_run else ""

    ok = err = 0
    for ms in MILESTONES:
        try:
            write_milestone(ms, tok, dry_run)
            ok += 1
            if not dry_run:
                time.sleep(0.1)
        except Exception as e:
            err += 1
            print(f"  ✗ FAILED {ms.get('title','?')}: {e}")

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Done — {ok} written, {err} failed.")
    return 0 if err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
