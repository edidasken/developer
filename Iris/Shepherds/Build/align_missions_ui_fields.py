#!/usr/bin/env python3
"""
Final field-mapping pass for /missionsRegistry in flockos-notify:

Adds UI-aligned aliases on top of what enrich_missions_from_pdfs.py already wrote:
  persecutionRank   = restrictionsRank   (BAL Bible Restrictions Rank)
  gospelAccess      = derived from persecutionTier
  tenFortyWindow    = "Yes" | "No" (string, to match UI dropdown)
"""

import json, os, subprocess, sys, urllib.request, urllib.error

PROJECT = "flockos-notify"
BASE    = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
COL     = f"{BASE}/missionsRegistry"

TIER_TO_GOSPEL = {
    "Extreme":      "Unreached",
    "Severe":       "Limited",
    "Considerable": "Restricted",
    "Some":         "Restricted",
    "Moderate":     "Partial",
    "Minimal":      "Open",
    "Low":          "Open",
}


def get_token():
    for cmd in (
        ["gcloud","auth","print-access-token"],
        [os.path.expanduser("~/google-cloud-sdk/bin/gcloud"),"auth","print-access-token"],
    ):
        try:
            t = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode().strip()
            if t and t.startswith("ya29."): return t
        except Exception: pass
    sys.exit("ERROR: no token")


def fs_value(v):
    if isinstance(v, bool):  return {"booleanValue": v}
    if isinstance(v, int):   return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue":  v}
    return {"stringValue": str(v)}


def main():
    H = {"Authorization": f"Bearer {get_token()}", "Content-Type": "application/json"}

    # Page through all docs
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

    print(f"Loaded {len(docs)} docs.\n")

    ok = err = 0
    for doc in docs:
        doc_id = doc["name"].split("/")[-1]
        f = doc.get("fields", {})

        updates = {}

        # persecutionRank = restrictionsRank
        if "restrictionsRank" in f and "persecutionRank" not in f:
            try: updates["persecutionRank"] = int(f["restrictionsRank"]["integerValue"])
            except Exception: pass

        # gospelAccess derived from persecutionTier
        tier = f.get("persecutionTier", {}).get("stringValue", "")
        if tier and "gospelAccess" not in f:
            ga = TIER_TO_GOSPEL.get(tier)
            if ga: updates["gospelAccess"] = ga

        # tenFortyWindow as string "Yes"/"No"
        tfw = f.get("tenFortyWindow", {})
        if "booleanValue" in tfw:
            updates["tenFortyWindow"] = "Yes" if tfw["booleanValue"] else "No"

        if not updates:
            continue

        body = json.dumps({"fields": {k: fs_value(v) for k, v in updates.items()}}).encode()
        mask = "&".join(f"updateMask.fieldPaths={k}" for k in updates)
        url  = f"{COL}/{doc_id}?{mask}"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=H, method="PATCH")):
                pass
            print(f"  ✓ {doc_id:30s}  {updates}")
            ok += 1
        except urllib.error.HTTPError as e:
            print(f"  ✗ {doc_id}: {e.code}")
            err += 1

    print(f"\nDone. ✓ {ok}  ✗ {err}")


if __name__ == "__main__":
    main()
