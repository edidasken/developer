#!/usr/bin/env python3
"""
Import Bible Access List data into Firestore missionsRegistry.
  Project : flockos-notify
  Path    : churches/flockos/missionsRegistry/{country-slug}

Sheet columns:  Country | Population | Restrictions | Bible Shortage | Region

Field mapping:
  Country       → countryName   (string)
  Population    → population    (integer)
  Restrictions  → restrictionsRank   (integer — rank for bible restrictions)
  Bible Shortage→ bibleShortageRank  (integer — rank for bible shortage)
  Region        → continent     (string)

Uses PATCH + updateMask so existing docs keep all other fields intact.
New docs are created with these fields only.
"""

import csv, io, json, re, subprocess, sys, urllib.request

SHEET_URL   = "https://docs.google.com/spreadsheets/d/1dpCX-k7gzNN6fAFKNIj8JOQ3Tr9yMPV8sI_TU_6USPc/export?format=csv&gid=0"
PROJECT     = "flockos-notify"
CHURCH_ID   = "flockos"
COLLECTION  = "missionsRegistry"
FS_BASE     = (
    f"https://firestore.googleapis.com/v1/projects/{PROJECT}"
    f"/databases/(default)/documents/churches/{CHURCH_ID}/{COLLECTION}"
)


def get_access_token():
    """Get a fresh access token from the Firebase CLI."""
    try:
        token = subprocess.check_output(
            ["firebase", "login:print-access-token"],
            stderr=subprocess.DEVNULL
        ).decode().strip()
        if token:
            return token
    except Exception:
        pass
    # Fall back to gcloud ADC
    try:
        token = subprocess.check_output(
            ["gcloud", "auth", "print-access-token"],
            stderr=subprocess.DEVNULL
        ).decode().strip()
        if token:
            return token
    except Exception:
        pass
    sys.exit("ERROR: Could not obtain an access token. Run `firebase login` or `gcloud auth login`.")


def slug(name):
    """Normalize country name to a safe Firestore document ID."""
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def fs_value(v):
    """Wrap a Python value in a Firestore value object."""
    if isinstance(v, int):
        return {"integerValue": str(v)}
    return {"stringValue": str(v)}


def main():
    print("Fetching access token…")
    token = get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    print("Downloading Bible Access List CSV…")
    with urllib.request.urlopen(SHEET_URL) as r:
        csv_text = r.read().decode("utf-8")

    reader = csv.DictReader(io.StringIO(csv_text))
    rows = list(reader)
    print(f"  {len(rows)} countries found.\n")

    ok = err = skipped = 0

    for row in rows:
        country = row.get("Country", "").strip()
        if not country:
            skipped += 1
            continue

        doc_id = slug(country)

        # Build the fields dict — only the fields from this sheet
        fields = {
            "countryName": row["Country"].strip(),
            "continent":   row["Region"].strip(),
        }

        pop_raw = row.get("Population", "").strip().replace(",", "")
        if pop_raw.isdigit():
            fields["population"] = int(pop_raw)

        restr_raw = row.get("Restrictions", "").strip()
        if restr_raw.isdigit():
            fields["restrictionsRank"] = int(restr_raw)

        shortage_raw = row.get("Bible Shortage", "").strip()
        if shortage_raw.isdigit():
            fields["bibleShortageRank"] = int(shortage_raw)

        # Build Firestore document body
        fs_fields = {k: fs_value(v) for k, v in fields.items()}
        body = json.dumps({"fields": fs_fields}).encode()

        # PATCH with updateMask — merges these fields only, preserves the rest
        mask = "&".join(f"updateMask.fieldPaths={k}" for k in fs_fields)
        url  = f"{FS_BASE}/{doc_id}?{mask}"

        req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
        try:
            with urllib.request.urlopen(req):
                print(f"  ✓  {country}")
                ok += 1
        except urllib.error.HTTPError as e:
            body_err = e.read().decode()
            print(f"  ✗  {country}: HTTP {e.code} — {body_err[:120]}")
            err += 1

    print(f"\nDone.  ✓ {ok} written  ✗ {err} failed  — {skipped} skipped (empty)")


if __name__ == "__main__":
    main()
