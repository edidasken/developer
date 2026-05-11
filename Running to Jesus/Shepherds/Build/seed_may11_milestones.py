#!/usr/bin/env python3
"""
seed_may11_milestones.py
One-off seeder for May 10–11, 2026 build milestones that are not yet in Firestore.

Covers:
  - Music Stand CSS consolidation (stand.css deleted, May 10)
  - CSS architecture: american_garments merged into new_covenant.css (May 11)
  - Music Stand login redesign — dark NC theme (May 11)

Run from repo root:
  python3 "Running to Jesus/Shepherds/Build/seed_may11_milestones.py"
  python3 "Running to Jesus/Shepherds/Build/seed_may11_milestones.py" --dry-run
"""
import json, subprocess, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone

GCLOUD     = "/Users/greg.granger/google-cloud-sdk/bin/gcloud"
PROJECT    = "flockos-notify"
COLLECTION = "milestones"

MILESTONES = [
    {
        "date": "2026-05-10",
        "year": 2026,
        "category": "tech",
        "title": "Music Stand CSS Consolidation",
        "description": (
            "Music Stand's standalone stand.css deleted. The app now loads exclusively "
            "from new_covenant.css — the single CSS source for all New Covenant apps. "
            "stand.css styles migrated into new_covenant.css under a dedicated "
            "Music Stand section with its own design token bridge."
        ),
    },
    {
        "date": "2026-05-11",
        "year": 2026,
        "category": "tech",
        "title": "CSS Architecture: One File — american_garments merged",
        "description": (
            "american_garments.css (9,639 lines) fully merged into new_covenant.css "
            "— New Covenant now loads a single CSS file across all 6 HTML entry points. "
            "AG base tokens preserved as :root fallbacks. All 13 named AG theme token "
            "blocks removed (NC has one theme: its own). FlockChat, ATOG, nav, cards, "
            "badges, and toggle component styles retained. "
            "6 HTML link refs, SW precache, and stale JS comments all updated. "
            "B-Build synced all 5 Nations."
        ),
    },
    {
        "date": "2026-05-11",
        "year": 2026,
        "category": "tech",
        "title": "Music Stand Login: Dark NC Theme",
        "description": (
            "Music Stand sign-in page redesigned to match the New Covenant aesthetic. "
            "Dark navy #0e1320 background with gold + purple ambient glows. "
            "Real stand.png app icon replacing the emoji placeholder. "
            "Dark card with layered depth shadow. "
            "Gold gradient Sign In button (#e8a838 → #c97d10) with glow on hover. "
            "Dark input fields with gold focus ring. "
            "B-Build synced all 5 Nations."
        ),
    },
]


def _token() -> str:
    return subprocess.check_output([GCLOUD, "auth", "print-access-token"], text=True).strip()


def _to_fs(value) -> dict:
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {k: _to_fs(v) for k, v in value.items()}}}
    if isinstance(value, list):
        return {"arrayValue": {"values": [_to_fs(v) for v in value]}}
    return {"nullValue": None}


def _write(ms: dict, tok: str, dry_run: bool) -> None:
    now_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    doc    = dict(ms)
    doc["createdAt"] = now_ts
    doc["createdBy"] = "seed:may11"

    fields = {k: _to_fs(v) for k, v in doc.items()}
    fields["createdAt"] = {"timestampValue": now_ts}

    url  = (f"https://firestore.googleapis.com/v1/projects/{PROJECT}"
            f"/databases/(default)/documents/{COLLECTION}")
    body = json.dumps({"fields": fields}).encode()

    if dry_run:
        print(f"  [dry-run] {ms['date']} — {ms['title']}")
        return

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {tok}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            resp   = json.loads(r.read())
            doc_id = resp.get("name", "").rsplit("/", 1)[-1]
            print(f"  ✓ {ms['date']} — {ms['title']} (id: {doc_id})")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        print(f"  ✗ {ms['title']}: HTTP {e.code} — {err[:200]}")
        raise


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    print(f"\nMay 10–11 Milestone Seeder")
    print(f"  Project   : {PROJECT}")
    print(f"  Collection: {COLLECTION}")
    print(f"  Entries   : {len(MILESTONES)}")
    print(f"  Mode      : {'DRY RUN' if dry_run else 'LIVE WRITE'}")
    print()

    tok = "" if dry_run else _token()
    ok = err = 0
    for ms in MILESTONES:
        try:
            _write(ms, tok, dry_run)
            ok += 1
            if not dry_run:
                time.sleep(0.1)
        except Exception as e:
            err += 1
            print(f"  ✗ FAILED: {e}")

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Done — {ok} written, {err} failed.")
    return 0 if err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
