#!/usr/bin/env python3
"""Seed FlockOS project build timeline milestones into the flockos-notify
Firestore /milestones collection (The Generations view).

Uses gcloud user credentials — no service-account key needed.

Usage:
    python3 seed_flockos_milestones.py
    python3 seed_flockos_milestones.py --dry-run
"""
import json
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone

GCLOUD  = "/Users/greg.granger/google-cloud-sdk/bin/gcloud"
PROJECT = "flockos-notify"
COLLECTION = "milestones"

# ── Timeline data ─────────────────────────────────────────────────────────────
# Fields: date (YYYY-MM-DD), year (int), title, category, description
# Categories: founding | building | growth | missions | leadership | tech | outreach
MILESTONES = [
    {
        "date": "2026-04-28",
        "year": 2026,
        "category": "founding",
        "title": "FlockOS Project Initiated",
        "description": (
            "The FlockOS Software repository was created and the foundational "
            "architecture established — Nations deployment structure, Covenant "
            "foundations, and multi-church build pipeline scaffolded."
        ),
    },
    {
        "date": "2026-04-28",
        "year": 2026,
        "category": "tech",
        "title": "Truth Database Seeded",
        "description": (
            "Static biblical content bundles populated: 199 genealogy records, "
            "27 theology sections, and initial devotional content committed to "
            "the FlockOS Truth DB."
        ),
    },
    {
        "date": "2026-04-29",
        "year": 2026,
        "category": "building",
        "title": "Gospel Content Modules Launched",
        "description": (
            "GROW app content suite went live: Library (all 66 books of the Bible), "
            "Devotionals, Quizzes, Reading Plans (One Year Bible), Gospel Counseling, "
            "Apologetics, and Theology — all powered by static bundles."
        ),
    },
    {
        "date": "2026-04-29",
        "year": 2026,
        "category": "missions",
        "title": "Great Commission Dashboard Live",
        "description": (
            "Missions registry launched with 10,000+ unreached people group data, "
            "regional breakdown, persecution levels, and partner tracking — "
            "enriched from the Joshua Project dataset."
        ),
    },
    {
        "date": "2026-04-29",
        "year": 2026,
        "category": "leadership",
        "title": "Pastoral Care System Built",
        "description": (
            "Real-time Pastoral Care queue launched — care cases, caregiver assignment, "
            "Lead Pastor configuration, instant badge counts, and prayer request "
            "tracking all wired to Firestore with live updates."
        ),
    },
    {
        "date": "2026-04-29",
        "year": 2026,
        "category": "tech",
        "title": "GROW App & Admin Wall Operational",
        "description": (
            "GROW teaching platform activated with Truth Editor, Teaching Plans, "
            "and scripture linkification. Admin Wall launched with maintenance "
            "utilities: bulk reassign-to-Lead-Pastor, care/prayer/outreach resets."
        ),
    },
    {
        "date": "2026-04-30",
        "year": 2026,
        "category": "growth",
        "title": "The Fold — Member Management Live",
        "description": (
            "Member management system launched: human-readable FlockOS ID conventions, "
            "member cards with quick-action care/prayer/connection, group views, "
            "and full Firestore-backed CRUD."
        ),
    },
    {
        "date": "2026-05-01",
        "year": 2026,
        "category": "leadership",
        "title": "Roles & Access Matrix Established",
        "description": (
            "23-permission access control matrix across 6 ministry categories deployed. "
            "Pastoral hierarchy slots added with member dropdowns. "
            "Deployments manager launched for live church configuration CRUD."
        ),
    },
    {
        "date": "2026-05-02",
        "year": 2026,
        "category": "tech",
        "title": "Multi-Church B-Build Pipeline",
        "description": (
            "B-Build automation launched: New_Covenant source syncs to all 5 church "
            "deployments (FlockOS, GAS, Root, TBC, TheForest) with per-church Firebase "
            "config injection, branding, and manifest patching."
        ),
    },
    {
        "date": "2026-05-02",
        "year": 2026,
        "category": "outreach",
        "title": "The Invitation App Released",
        "description": (
            "Standalone church invitation PWA deployed with per-church Firebase config, "
            "Google Maps integration, and share banner. Installable on Android/iOS "
            "independently from the main FlockOS app."
        ),
    },
    {
        "date": "2026-05-02",
        "year": 2026,
        "category": "tech",
        "title": "PWA Suite — app.flockos / app.grow / app.invite",
        "description": (
            "Three independent installable PWA folders launched, each with their own "
            "manifest, service worker, and Firebase config — enabling standalone "
            "Android/iOS installation for each app surface."
        ),
    },
    {
        "date": "2026-05-10",
        "year": 2026,
        "category": "founding",
        "title": "FlockOS v1.0 — Platform Launch",
        "description": (
            "Full pastoral management platform operational across all 5 church "
            "deployments: member management, care, missions, worship planning, "
            "communications, discipleship, and GROW content — New Covenant v1.01."
        ),
    },
    {
        "date": "2026-05-10",
        "year": 2026,
        "category": "leadership",
        "title": "Invitations Admin Panel",
        "description": (
            "Full invitation workflow built: Invite to Church (outreach contacts), "
            "Pending Approval queue with approve/deny by email, and Grant App Access "
            "with full user provisioning form."
        ),
    },
    {
        "date": "2026-05-10",
        "year": 2026,
        "category": "growth",
        "title": "Forgiveness Prayer Guide",
        "description": (
            "5-step guided prayer experience built into The Call to Forgive — "
            "personalized prayers by name, scripture per step, progress tracking, "
            "and a completion celebration screen."
        ),
    },
    {
        "date": "2026-05-10",
        "year": 2026,
        "category": "tech",
        "title": "Church Timeline (The Generations)",
        "description": (
            "Full-date milestone tracking system launched — church history recorded "
            "as MM/DD/YYYY events with categories, descriptions, and sortable "
            "timeline view. This very entry marks the system going live."
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
    """Convert a Python value to a Firestore REST field-value dict."""
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
    # Use a timestampValue for createdAt
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

    print(f"\nFlockOS Build Timeline Seeder")
    print(f"  Project   : {PROJECT}")
    print(f"  Collection: {COLLECTION}")
    print(f"  Milestones: {len(MILESTONES)}")
    print(f"  Mode      : {'DRY RUN' if dry_run else 'LIVE WRITE'}")
    print()

    if not dry_run:
        tok = token()
    else:
        tok = ""

    ok = err = 0
    for ms in MILESTONES:
        try:
            write_milestone(ms, tok, dry_run)
            ok += 1
            if not dry_run:
                time.sleep(0.1)  # avoid rate limiting
        except Exception as e:
            err += 1
            print(f"  ✗ FAILED {ms.get('title','?')}: {e}")

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Done — {ok} written, {err} failed.")
    return 0 if err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
