#!/usr/bin/env python3
"""
Set the correct emoji flag (icon field) on every missionsRegistry country.
  Project : flockos-notify
  Path    : churches/flockos/missionsRegistry/{slug}

Uses PATCH + updateMask=icon so no other fields are touched.
Document IDs must match the slug() used by import_bible_access_list.py.
"""

import json, re, subprocess, sys, urllib.request, urllib.error

PROJECT    = "flockos-notify"
CHURCH_ID  = "flockos"
COLLECTION = "missionsRegistry"
FS_BASE    = (
    f"https://firestore.googleapis.com/v1/projects/{PROJECT}"
    f"/databases/(default)/documents/churches/{CHURCH_ID}/{COLLECTION}"
)

# ISO 3166-1 alpha-2 for every country in the Bible Access List sheet
COUNTRY_ISO = {
    "Afghanistan":              "AF",
    "Algeria":                  "DZ",
    "Armenia":                  "AM",
    "Azerbaijan":               "AZ",
    "Bahrain":                  "BH",
    "Bangladesh":               "BD",
    "Benin":                    "BJ",
    "Bhutan":                   "BT",
    "Brazil":                   "BR",
    "Brunei":                   "BN",
    "Burkina Faso":             "BF",
    "Burundi":                  "BI",
    "Cambodia":                 "KH",
    "Cameroon":                 "CM",
    "Central African Republic": "CF",
    "Chad":                     "TD",
    "China":                    "CN",
    "Colombia":                 "CO",
    "Comoros":                  "KM",
    "DR Congo":                 "CD",
    "Cuba":                     "CU",
    "Djibouti":                 "DJ",
    "Ecuador":                  "EC",
    "Egypt":                    "EG",
    "El Salvador":              "SV",
    "Eritrea":                  "ER",
    "Ethiopia":                 "ET",
    "Ghana":                    "GH",
    "Guatemala":                "GT",
    "Guinea":                   "GN",
    "Haiti":                    "HT",
    "Honduras":                 "HN",
    "India":                    "IN",
    "Indonesia":                "ID",
    "Iran":                     "IR",
    "Iraq":                     "IQ",
    "Ivory Coast":              "CI",
    "Jordan":                   "JO",
    "Kazakhstan":               "KZ",
    "Kenya":                    "KE",
    "Kuwait":                   "KW",
    "Kyrgyzstan":               "KG",
    "Laos":                     "LA",
    "Lebanon":                  "LB",
    "Libya":                    "LY",
    "Madagascar":               "MG",
    "Malawi":                   "MW",
    "Malaysia":                 "MY",
    "Maldives":                 "MV",
    "Mali":                     "ML",
    "Mauritania":               "MR",
    "Mexico":                   "MX",
    "Morocco":                  "MA",
    "Mozambique":               "MZ",
    "Myanmar":                  "MM",
    "Namibia":                  "NA",
    "Nepal":                    "NP",
    "Nicaragua":                "NI",
    "Niger":                    "NE",
    "Nigeria":                  "NG",
    "North Korea":              "KP",
    "Oman":                     "OM",
    "Pakistan":                 "PK",
    "Palestinian Territories":  "PS",
    "Philippines":              "PH",
    "Qatar":                    "QA",
    "Russia":                   "RU",
    "Rwanda":                   "RW",
    "Saudi Arabia":             "SA",
    "Somalia":                  "SO",
    "South Sudan":              "SS",
    "Sri Lanka":                "LK",
    "Sudan":                    "SD",
    "Syria":                    "SY",
    "Tajikistan":               "TJ",
    "Tanzania":                 "TZ",
    "Togo":                     "TG",
    "Tunisia":                  "TN",
    "Türkiye":                  "TR",
    "Turkmenistan":             "TM",
    "Uganda":                   "UG",
    "Ukraine":                  "UA",
    "United Arab Emirates":     "AE",
    "Uzbekistan":               "UZ",
    "Venezuela":                "VE",
    "Viet nam":                 "VN",
    "Yemen":                    "YE",
    "Zimbabwe":                 "ZW",
}


def iso_to_flag(iso2: str) -> str:
    """Convert a 2-letter ISO 3166-1 alpha-2 code to its emoji flag."""
    base = 0x1F1E6 - ord('A')
    return ''.join(chr(base + ord(c)) for c in iso2.upper())


def slug(name: str) -> str:
    """Same slug logic used by import_bible_access_list.py."""
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def get_access_token() -> str:
    for cmd in (
        ["firebase", "login:print-access-token"],
        ["gcloud", "auth", "print-access-token"],
    ):
        try:
            token = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode().strip()
            if token:
                return token
        except Exception:
            pass
    sys.exit("ERROR: Could not obtain an access token. Run `firebase login`.")


def main():
    print("Fetching access token…")
    token = get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    ok = err = 0
    for country, iso in COUNTRY_ISO.items():
        flag   = iso_to_flag(iso)
        doc_id = slug(country)
        body   = json.dumps({"fields": {"icon": {"stringValue": flag}}}).encode()
        url    = f"{FS_BASE}/{doc_id}?updateMask.fieldPaths=icon"
        req    = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
        try:
            with urllib.request.urlopen(req):
                print(f"  ✓  {flag}  {country} ({iso})")
                ok += 1
        except urllib.error.HTTPError as e:
            print(f"  ✗  {country}: HTTP {e.code} — {e.read().decode()[:100]}")
            err += 1

    print(f"\nDone.  ✓ {ok} flags set  ✗ {err} failed")


if __name__ == "__main__":
    main()
