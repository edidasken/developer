#!/usr/bin/env python3
"""
Normalize persecutionLevel on /missionsRegistry to just the tier word
('Extreme'/'Severe'/'Considerable'/'Some'/'Minimal') so the UI filter and
stat counters work. Preserves the full label as `persecutionLabel`.
"""
import json, os, subprocess, sys, urllib.request, urllib.error

PROJECT = "flockos-notify"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
COL  = f"{BASE}/missionsRegistry"

def get_token():
    return subprocess.check_output(
        [os.path.expanduser("~/google-cloud-sdk/bin/gcloud"),"auth","print-access-token"]
    ).decode().strip()

def main():
    H = {"Authorization": f"Bearer {get_token()}", "Content-Type": "application/json"}
    docs, page = [], None
    while True:
        url = f"{COL}?pageSize=300" + (f"&pageToken={page}" if page else "")
        with urllib.request.urlopen(urllib.request.Request(url, headers=H)) as r:
            d = json.loads(r.read())
        docs.extend(d.get("documents", []))
        page = d.get("nextPageToken")
        if not page: break

    ok = err = 0
    for doc in docs:
        doc_id = doc["name"].split("/")[-1]
        f = doc.get("fields", {})
        tier  = f.get("persecutionTier",  {}).get("stringValue", "")
        label = f.get("persecutionLevel", {}).get("stringValue", "")
        if not tier: continue
        if label == tier: continue  # already normalized

        body = json.dumps({"fields": {
            "persecutionLevel": {"stringValue": tier},
            "persecutionLabel": {"stringValue": label or tier},
        }}).encode()
        url = f"{COL}/{doc_id}?updateMask.fieldPaths=persecutionLevel&updateMask.fieldPaths=persecutionLabel"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=H, method="PATCH")):
                pass
            print(f"  ✓ {doc_id:30s}  {label!r:35s} → {tier!r}")
            ok += 1
        except urllib.error.HTTPError as e:
            print(f"  ✗ {doc_id}: {e.code}"); err += 1
    print(f"\nDone. ✓ {ok}  ✗ {err}")

if __name__ == "__main__":
    main()
