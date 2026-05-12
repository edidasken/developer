#!/usr/bin/env python3
"""
Move missionsRegistry data from churches/flockos/missionsRegistry to TOP-LEVEL
missionsRegistry collection in flockos-notify Firestore. ROOT FlockOS reads
from the root of the project, not under /churches/flockos/.

  - Reads every doc under churches/flockos/missionsRegistry
  - Writes to /missionsRegistry/{same-id} with all fields
  - Deletes the old doc under churches/flockos/missionsRegistry
"""

import json, subprocess, sys, urllib.request, urllib.error

PROJECT = "flockos-notify"
BASE    = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
SRC     = f"{BASE}/churches/flockos/missionsRegistry"
DST     = f"{BASE}/missionsRegistry"


def token():
    for cmd in (["firebase","login:print-access-token"], ["gcloud","auth","print-access-token"]):
        try:
            t = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode().strip()
            if t: return t
        except Exception: pass
    sys.exit("ERROR: no token")


def main():
    tok = token()
    H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

    # 1) page through all source docs
    docs = []
    page_token = None
    while True:
        url = f"{SRC}?pageSize=300"
        if page_token: url += f"&pageToken={page_token}"
        with urllib.request.urlopen(urllib.request.Request(url, headers=H)) as r:
            d = json.loads(r.read())
        docs.extend(d.get("documents", []))
        page_token = d.get("nextPageToken")
        if not page_token: break

    print(f"Found {len(docs)} docs at churches/flockos/missionsRegistry\n")

    moved = err = deleted = 0
    for doc in docs:
        doc_id = doc["name"].split("/")[-1]
        fields = doc.get("fields", {})

        # write to top-level
        try:
            body = json.dumps({"fields": fields}).encode()
            url  = f"{DST}/{doc_id}"
            req  = urllib.request.Request(url, data=body, headers=H, method="PATCH")
            with urllib.request.urlopen(req): pass
            moved += 1
        except urllib.error.HTTPError as e:
            print(f"  ✗ WRITE {doc_id}: {e.code} {e.read().decode()[:120]}")
            err += 1
            continue

        # delete the old one
        try:
            req = urllib.request.Request(f"{SRC}/{doc_id}", headers=H, method="DELETE")
            with urllib.request.urlopen(req): pass
            deleted += 1
        except urllib.error.HTTPError as e:
            print(f"  ⚠ DELETE {doc_id}: {e.code}")

        print(f"  ✓  {doc_id}")

    print(f"\nDone. moved={moved}  deleted-old={deleted}  failed={err}")


if __name__ == "__main__":
    main()
