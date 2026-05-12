#!/usr/bin/env python3
"""
Enrich /missionsRegistry docs in flockos-notify by parsing the per-country
PDF profiles from bibleaccesslist.org. Adds:

  isoCode               (from country mapping)
  tenFortyWindow        (boolean — derived from region)
  persecutionLevel      (e.g., "Extreme Access Restrictions")
  bibleShortageNeed     (e.g., "Less than ten thousand")
  dominantReligion      (e.g., "Islam")
  christianPopulation   (integer)
  christianPercent      (float — e.g., 0.02 means 0.02%)
  worldWatchListRank    (integer or null)
  profileUrl            (PDF URL)

Reuses existing fields (countryName, restrictionsRank, bibleShortageRank,
population, continent, icon) — does not touch them.
"""

import json, re, subprocess, sys, urllib.request, urllib.error
import io, concurrent.futures
import pdfplumber

PROJECT = "flockos-notify"
BASE    = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
COL     = f"{BASE}/missionsRegistry"
PDF_URL = "https://bibleaccesslist.org/profiles/{iso}_2025_profile.pdf"

# Same ISO mapping used by update_flags.py
COUNTRY_ISO = {
    "Afghanistan":"AF","Algeria":"DZ","Armenia":"AM","Azerbaijan":"AZ","Bahrain":"BH",
    "Bangladesh":"BD","Benin":"BJ","Bhutan":"BT","Brazil":"BR","Brunei":"BN",
    "Burkina Faso":"BF","Burundi":"BI","Cambodia":"KH","Cameroon":"CM",
    "Central African Republic":"CF","Chad":"TD","China":"CN","Colombia":"CO",
    "Comoros":"KM","DR Congo":"CD","Cuba":"CU","Djibouti":"DJ","Ecuador":"EC",
    "Egypt":"EG","El Salvador":"SV","Eritrea":"ER","Ethiopia":"ET","Ghana":"GH",
    "Guatemala":"GT","Guinea":"GN","Haiti":"HT","Honduras":"HN","India":"IN",
    "Indonesia":"ID","Iran":"IR","Iraq":"IQ","Ivory Coast":"CI","Jordan":"JO",
    "Kazakhstan":"KZ","Kenya":"KE","Kuwait":"KW","Kyrgyzstan":"KG","Laos":"LA",
    "Lebanon":"LB","Libya":"LY","Madagascar":"MG","Malawi":"MW","Malaysia":"MY",
    "Maldives":"MV","Mali":"ML","Mauritania":"MR","Mexico":"MX","Morocco":"MA",
    "Mozambique":"MZ","Myanmar":"MM","Namibia":"NA","Nepal":"NP","Nicaragua":"NI",
    "Niger":"NE","Nigeria":"NG","North Korea":"KP","Oman":"OM","Pakistan":"PK",
    "Palestinian Territories":"PS","Philippines":"PH","Qatar":"QA","Russia":"RU",
    "Rwanda":"RW","Saudi Arabia":"SA","Somalia":"SO","South Sudan":"SS",
    "Sri Lanka":"LK","Sudan":"SD","Syria":"SY","Tajikistan":"TJ","Tanzania":"TZ",
    "Togo":"TG","Tunisia":"TN","Türkiye":"TR","Turkmenistan":"TM","Uganda":"UG",
    "Ukraine":"UA","United Arab Emirates":"AE","Uzbekistan":"UZ","Venezuela":"VE",
    "Viet nam":"VN","Yemen":"YE","Zimbabwe":"ZW",
}

# Regions whose countries fall predominantly in the 10/40 Window (10°N–40°N,
# from West Africa across to East Asia). Latin America and Sub-Saharan Africa
# (south of 10°N) are outside it.
TEN_FORTY_REGIONS = {"Asia", "Middle East", "North Africa", "Central Asia", "West Africa"}
# Additional Sub Saharan / other countries individually inside the 10/40 belt
TEN_FORTY_EXTRA = {
    "Eritrea","Ethiopia","Sudan","South Sudan","Djibouti","Somalia","Chad",
    "Senegal","Gambia","Guinea-Bissau",
}


import unicodedata
SLUG_OVERRIDES = {"Türkiye": "turkey"}
def slug(name):
    if name in SLUG_OVERRIDES: return SLUG_OVERRIDES[name]
    s = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def get_token():
    import os
    candidates = [
        ["gcloud","auth","print-access-token"],
        [os.path.expanduser("~/google-cloud-sdk/bin/gcloud"),"auth","print-access-token"],
        ["firebase","login:print-access-token"],
    ]
    for cmd in candidates:
        try:
            t = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode().strip()
            if t and t.startswith("ya29."): return t
            if t: return t
        except Exception: pass
    sys.exit("ERROR: no token")


# Map descriptive label → normalized persecutionLevel
LEVEL_MAP = [
    ("EXTREME",      "Extreme"),
    ("SEVERE",       "Severe"),
    ("CONSIDERABLE", "Considerable"),
    ("MODERATE",     "Moderate"),
    ("SOME",         "Some"),
    ("MINIMAL",      "Minimal"),
    ("LOW",          "Low"),
]


def parse_profile(pdf_bytes):
    """Parse the first page of a country profile PDF into structured fields."""
    out = {}
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = pdf.pages[0].extract_text() or ""
    except Exception as e:
        return {"_error": f"pdf parse: {e}"}

    # Persecution / restriction level (the all-caps line right after the rank)
    # e.g. "EXTREME ACCESS RESTRICTIONS", "SEVERE ACCESS RESTRICTIONS",
    # "CONSIDERABLE ACCESS RESTRICTIONS", "MINIMAL ACCESS RESTRICTIONS"
    m = re.search(r'\b((?:EXTREME|SEVERE|CONSIDERABLE|MODERATE|SOME|MINIMAL|LOW)\s+ACCESS\s+RESTRICTIONS)', text)
    if m:
        out["persecutionLabel"] = m.group(1).strip().title()  # full label
        for key, norm in LEVEL_MAP:
            if key in m.group(1):
                out["persecutionTier"]  = norm
                out["persecutionLevel"] = norm  # tier word for UI filter
                break

    # Bible shortage estimate phrase ("Bible needs estimate is less than ten thousand")
    m = re.search(r'Bible needs estimate is\s+(?:less than\s+)?([a-z0-9 ,.\-]+?)(?:\s*\n|$)', text, re.I)
    if m:
        phrase = m.group(0).replace("\n"," ").strip()
        out["bibleShortageNeed"] = phrase

    # Main religion
    m = re.search(r'Main religion:\s*([A-Za-z][A-Za-z &/\-]+)', text)
    if m: out["dominantReligion"] = m.group(1).strip().rstrip(".")

    # Christian population + percent: "8,800, 0.02% of total population"
    m = re.search(r'Christian population:\s*([\d,]+)\s*,?\s*([\d.]+)\s*%', text)
    if m:
        try: out["christianPopulation"] = int(m.group(1).replace(",",""))
        except Exception: pass
        try: out["christianPercent"] = float(m.group(2))
        except Exception: pass

    # World Watch List rank: "World Watch List: #10"
    m = re.search(r'World Watch List:\s*#?\s*(\d+)', text)
    if m:
        try: out["worldWatchListRank"] = int(m.group(1))
        except Exception: pass

    return out


def fetch_pdf(country, iso):
    url = PDF_URL.format(iso=iso)
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "application/pdf,*/*",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return country, iso, r.read(), None
    except Exception as e:
        return country, iso, None, str(e)


def fs_value(v):
    if isinstance(v, bool):  return {"booleanValue": v}
    if isinstance(v, int):   return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue":  v}
    return {"stringValue": str(v)}


def patch_doc(doc_id, fields, headers):
    body = json.dumps({"fields": {k: fs_value(v) for k, v in fields.items()}}).encode()
    mask = "&".join(f"updateMask.fieldPaths={k}" for k in fields)
    url  = f"{COL}/{doc_id}?{mask}"
    req  = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
    with urllib.request.urlopen(req): pass


def main():
    headers = {"Authorization": f"Bearer {get_token()}", "Content-Type": "application/json"}

    # Fetch all PDFs in parallel
    print(f"Downloading {len(COUNTRY_ISO)} country profiles in parallel…")
    pdfs = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        futures = [ex.submit(fetch_pdf, c, iso) for c, iso in COUNTRY_ISO.items()]
        for f in concurrent.futures.as_completed(futures):
            country, iso, data, err = f.result()
            if err:
                print(f"  ✗ {country}: {err}")
            else:
                pdfs[country] = (iso, data)

    print(f"\nDownloaded {len(pdfs)} PDFs. Parsing & patching Firestore…\n")

    ok = err = 0
    for country, iso in COUNTRY_ISO.items():
        if country not in pdfs:
            err += 1; continue
        _, pdf_bytes = pdfs[country]

        parsed = parse_profile(pdf_bytes)
        # Always-set fields
        parsed["isoCode"]    = iso
        parsed["profileUrl"] = PDF_URL.format(iso=iso)

        # 10/40 Window
        # We don't have the doc's region locally yet — derive from ISO mapping table later.
        # Cheaper: compute from the country name vs region in our import list.
        parsed["tenFortyWindow"] = (
            country in TEN_FORTY_EXTRA
            or _country_region(country) in TEN_FORTY_REGIONS
        )

        try:
            patch_doc(slug(country), parsed, headers)
            print(f"  ✓ {country:30s}  level={parsed.get('persecutionTier','?'):10s}"
                  f" wwl={parsed.get('worldWatchListRank','-')}  rel={parsed.get('dominantReligion','-')}")
            ok += 1
        except urllib.error.HTTPError as e:
            print(f"  ✗ {country}: HTTP {e.code} — {e.read().decode()[:120]}")
            err += 1

    print(f"\nDone. ✓ {ok}   ✗ {err}")


# Country → region map (from the original sheet, hardcoded so we don't need to refetch)
_REGION = {
    "Afghanistan":"Asia","Algeria":"North Africa","Armenia":"Central Asia","Azerbaijan":"Central Asia",
    "Bahrain":"Middle East","Bangladesh":"Asia","Benin":"West Africa","Bhutan":"Asia",
    "Brazil":"Latin America","Brunei":"Asia","Burkina Faso":"West Africa","Burundi":"Sub Saharan Africa",
    "Cambodia":"Asia","Cameroon":"West Africa","Central African Republic":"West Africa","Chad":"West Africa",
    "China":"Asia","Colombia":"Latin America","Comoros":"Sub Saharan Africa","DR Congo":"Sub Saharan Africa",
    "Cuba":"Latin America","Djibouti":"Sub Saharan Africa","Ecuador":"Latin America","Egypt":"North Africa",
    "El Salvador":"Latin America","Eritrea":"Sub Saharan Africa","Ethiopia":"Sub Saharan Africa",
    "Ghana":"West Africa","Guatemala":"Latin America","Guinea":"West Africa","Haiti":"Latin America",
    "Honduras":"Latin America","India":"Asia","Indonesia":"Asia","Iran":"Middle East","Iraq":"Middle East",
    "Ivory Coast":"West Africa","Jordan":"Middle East","Kazakhstan":"Central Asia","Kenya":"Sub Saharan Africa",
    "Kuwait":"Middle East","Kyrgyzstan":"Central Asia","Laos":"Asia","Lebanon":"Middle East",
    "Libya":"North Africa","Madagascar":"Sub Saharan Africa","Malawi":"Sub Saharan Africa","Malaysia":"Asia",
    "Maldives":"Asia","Mali":"West Africa","Mauritania":"West Africa","Mexico":"Latin America",
    "Morocco":"North Africa","Mozambique":"Sub Saharan Africa","Myanmar":"Asia",
    "Namibia":"Sub Saharan Africa","Nepal":"Asia","Nicaragua":"Latin America","Niger":"West Africa",
    "Nigeria":"West Africa","North Korea":"Asia","Oman":"Middle East","Pakistan":"Asia",
    "Palestinian Territories":"Middle East","Philippines":"Asia","Qatar":"Middle East",
    "Russia":"Central Asia","Rwanda":"Sub Saharan Africa","Saudi Arabia":"Middle East",
    "Somalia":"Sub Saharan Africa","South Sudan":"Sub Saharan Africa","Sri Lanka":"Asia",
    "Sudan":"Sub Saharan Africa","Syria":"Middle East","Tajikistan":"Central Asia",
    "Tanzania":"Sub Saharan Africa","Togo":"West Africa","Tunisia":"North Africa","Türkiye":"Asia",
    "Turkmenistan":"Central Asia","Uganda":"Sub Saharan Africa","Ukraine":"Central Asia",
    "United Arab Emirates":"Middle East","Uzbekistan":"Central Asia","Venezuela":"Latin America",
    "Viet nam":"Asia","Yemen":"Middle East","Zimbabwe":"Sub Saharan Africa",
}
def _country_region(country): return _REGION.get(country, "")


if __name__ == "__main__":
    main()
