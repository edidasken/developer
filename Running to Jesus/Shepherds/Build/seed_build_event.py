#!/usr/bin/env python3
"""
seed_build_event.py
Writes a single build-event milestone to the flockos-notify Firestore
/milestones collection (The Generations view).

Called automatically by B-Build_Nations.sh after every successful build.
Also usable manually to record significant engineering milestones.

Usage:
  python3 "Running to Jesus/Shepherds/Build/seed_build_event.py" \
    --title "My milestone title" \
    --description "What changed and why." \
    [--category tech]   # default: tech
    [--date 2026-05-11] # default: today
    [--dry-run]

If gcloud credentials are unavailable the script exits 0 with a warning
so it never blocks the build.
"""
import argparse
import json
import subprocess
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, date

GCLOUD     = "/Users/greg.granger/google-cloud-sdk/bin/gcloud"
PROJECT    = "flockos-notify"
COLLECTION = "milestones"
VALID_CATS = {"founding", "building", "growth", "missions", "leadership", "tech", "outreach", "build"}


def _token() -> str:
    result = subprocess.run(
        [GCLOUD, "auth", "print-access-token"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"gcloud auth failed: {result.stderr.strip()}")
    return result.stdout.strip()


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


def _write(entry: dict, tok: str, dry_run: bool) -> None:
    now_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    doc    = dict(entry)
    doc["createdAt"] = now_ts
    doc["createdBy"] = "build:B-Build"

    fields = {k: _to_fs(v) for k, v in doc.items()}
    fields["createdAt"] = {"timestampValue": now_ts}

    url  = (f"https://firestore.googleapis.com/v1/projects/{PROJECT}"
            f"/databases/(default)/documents/{COLLECTION}")
    body = json.dumps({"fields": fields}).encode()

    if dry_run:
        print(f"  [seed_build_event dry-run] Would write: {entry['title']}")
        return

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {tok}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as r:
        resp   = json.loads(r.read())
        doc_id = resp.get("name", "").rsplit("/", 1)[-1]
        print(f"  ✓ Generations entry written (id: {doc_id})")


def main() -> int:
    p = argparse.ArgumentParser(description="Write one build event to Firestore /milestones.")
    p.add_argument("--title",       required=True,  help="Milestone title (short, plain text)")
    p.add_argument("--description", required=True,  help="Full description of what changed")
    p.add_argument("--category",    default="build", choices=sorted(VALID_CATS))
    p.add_argument("--date",        default=date.today().isoformat(), help="YYYY-MM-DD (default: today)")
    p.add_argument("--dry-run",     action="store_true")
    args = p.parse_args()

    entry = {
        "date":        args.date,
        "year":        int(args.date.split("-")[0]),
        "category":    args.category,
        "title":       args.title,
        "description": args.description,
    }

    dry_run = args.dry_run

    if not dry_run:
        try:
            tok = _token()
        except Exception as e:
            # Non-fatal: build continues, Firestore just won't be updated
            print(f"  ⚠  seed_build_event: gcloud auth unavailable — skipping Generations update.")
            print(f"     ({e})")
            return 0

    try:
        _write(entry, "" if dry_run else tok, dry_run)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"  ⚠  seed_build_event: Firestore write failed (HTTP {e.code}) — non-fatal.")
        print(f"     {err_body[:200]}")
        return 0  # non-fatal: build still succeeds
    except Exception as e:
        print(f"  ⚠  seed_build_event: unexpected error — non-fatal. ({e})")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
