#!/usr/bin/env python3
"""
Tidy up top-level /missionsRegistry in flockos-notify:
  1. Rename t-rkiye → turkey (copy fields, delete original)
  2. Backfill createdAt on every doc that lacks it (server timestamp)
"""

import json, subprocess, sys, urllib.request, urllib.error, datetime

PROJECT = "flockos-notify"
BASE    = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
COL     = f"{BASE}/missionsRegistry"


def token():
    for cmd in (["firebase","login:print-access-token"], ["gcloud","auth","print-access-token"]):
        try:
            t = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode().strip()
            if t: return t
        except Exception: pass
    sys.exit("ERROR: no token")


def main():
    H = {"Authorization": f"Bearer {token()}", "Content-Type": "application/json"}

    # 1) Rename t-rkiye → turkey
    print("== Rename t-rkiye → turkey ==")
    try:
        with urllib.request.urlopen(urllib.request.Request(f"{COL}/t-rkiye", headers=H)) as r:
            src = json.loads(r.read())
        fields = src.get("fields", {})
        # write to turkey
        body = json.dumps({"fields": fields}).encode()
        with urllib.request.urlopen(urllib.request.Request(f"{COL}/turkey", data=body, headers=H, method="PATCH")):
            print("  ✓ wrote /missionsRegistry/turkey")
        # delete t-rkiye
        with urllib.request.urlopen(urllib.request.Request(f"{COL}/t-rkiye", headers=H, method="DELETE")):
            print("  ✓ deleted /missionsRegistry/t-rkiye")
    except urllib.error.HTTPError as e:
        print(f"  (skip) {e.code}: {e.read().decode()[:120]}")

    # 2) Backfill createdAt on docs that don't have it
    print("\n== Backfill createdAt ==")
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    docs = []
    page = None
    while True:
        url = f"{COL}?pageSize=300"
        if page: url += f"&pageToken={page}"
        with urllib.request.urlopen(urllib.request.Request(url, headers=H)) as r:
            d = json.loads(r.read())
        docs.extend(d.get("documents", []))
        page = d.get("nextPageToken")
        if not page: break

    backfilled = 0
    for doc in docs:
        doc_id = doc["name"].split("/")[-1]
        if "createdAt" in doc.get("fields", {}):
            continue
        body = json.dumps({"fields": {"createdAt": {"timestampValue": now_iso}}}).encode()
        url  = f"{COL}/{doc_id}?updateMask.fieldPaths=createdAt"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=H, method="PATCH")):
                backfilled += 1
        except urllib.error.HTTPError as e:
            print(f"  ✗ {doc_id}: {e.code}")
    print(f"  ✓ backfilled createdAt on {backfilled} docs (total in collection: {len(docs)})")


if __name__ == "__main__":
    main()
