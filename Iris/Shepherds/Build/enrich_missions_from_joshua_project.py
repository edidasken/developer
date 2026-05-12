#!/usr/bin/env python3
"""
Enrich /missionsRegistry from joshuaproject.net country pages.

Fetches https://joshuaproject.net/countries/{ISO2} and parses the country
overview stats. Writes:

  unreachedGroups       (integer — # unreached people groups)
  totalPeopleGroups     (integer)
  percentEvangelical    (float, e.g. 1.2)
  percentChristian      (float)
  populationUnreached   (integer)
  jpProfileUrl          (string)

Reads ISO codes already on each doc.
"""
import json, os, re, subprocess, sys, urllib.request, urllib.error
import http.cookiejar, time, random
import concurrent.futures, threading

PROJECT = "flockos-notify"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
COL  = f"{BASE}/missionsRegistry"
JP   = "https://joshuaproject.net/countries/{iso}"
UA   = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

def get_token():
    return subprocess.check_output(
        [os.path.expanduser("~/google-cloud-sdk/bin/gcloud"),"auth","print-access-token"]
    ).decode().strip()

_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))
_opener.addheaders = [("User-Agent", UA), ("Accept", "text/html")]
_lock = threading.Lock()

def _open(url):
    with _lock:
        return _opener.open(url, timeout=30)

def fetch(iso, attempt=1):
    url = JP.format(iso=iso)
    try:
        r = _open(url)
        text = r.read().decode("utf-8", "ignore")
        final = r.geturl()
        if "/retry" in final or "Try Again" in text[:5000]:
            if attempt <= 6:
                # Visit /retry to get fresh cookie, then back off and retry
                try: _open("https://joshuaproject.net/retry").read()
                except Exception: pass
                time.sleep(3.0 + attempt * 1.5 + random.random())
                return fetch(iso, attempt + 1)
            return iso, "__ERR__rate-limited"
        return iso, text
    except Exception as e:
        if attempt <= 3:
            time.sleep(2 * attempt)
            return fetch(iso, attempt + 1)
        return iso, f"__ERR__{e}"

def parse(html_text):
    out = {}
    if not html_text or html_text.startswith("__ERR__"): return out
    blocks = re.findall(r'<h2 class="title">(.*?)</h2>\s*<div class="data">(.*?)</div>', html_text, re.S)
    stats = {}
    for k, v in blocks:
        k = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', k)).strip()
        v = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', v)).strip()
        stats[k] = v

    def to_int(s):
        m = re.search(r'([\d,]+)', s or '')
        return int(m.group(1).replace(',','')) if m else None
    def to_float(s):
        m = re.search(r'([\d.]+)', s or '')
        return float(m.group(1)) if m else None

    if 'People GroupsTotal' in stats:
        v = to_int(stats['People GroupsTotal'])
        if v is not None: out['totalPeopleGroups'] = v
    if 'People Groups Unreached' in stats:
        v = to_int(stats['People Groups Unreached'])
        if v is not None: out['unreachedGroups'] = v
    if 'PopulationTotal' in stats:
        v = to_int(stats['PopulationTotal'])
        if v is not None: out['jpPopulation'] = v
    if 'Population in Unreached' in stats:
        v = to_int(stats['Population in Unreached'])
        if v is not None: out['populationUnreached'] = v
    if '% Evangelical' in stats:
        v = to_float(stats['% Evangelical'])
        if v is not None: out['percentEvangelical'] = v
    if '% Christian Adherent' in stats:
        v = to_float(stats['% Christian Adherent'])
        if v is not None: out['percentChristian'] = v
    return out

def fs_value(v):
    if isinstance(v, bool):  return {"booleanValue": v}
    if isinstance(v, int):   return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue":  v}
    return {"stringValue": str(v)}

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

    # Build (doc_id, iso, name) list — skip those already enriched
    items = []
    skipped = 0
    for doc in docs:
        f = doc.get("fields", {})
        iso = f.get("isoCode", {}).get("stringValue", "").strip()
        if not iso: continue
        if "unreachedGroups" in f or "percentEvangelical" in f:
            skipped += 1
            continue
        items.append((doc["name"].split("/")[-1], iso, f.get("countryName",{}).get("stringValue","")))
    print(f"Skipping {skipped} already-enriched docs.")

    print(f"Fetching {len(items)} JP profiles sequentially…")
    pages = {}
    for doc_id, iso, name in items:
        _, html_text = fetch(iso)
        pages[iso] = html_text
        time.sleep(0.5 + random.random())  # gentle pacing

    ok = err = empty = 0
    for doc_id, iso, name in items:
        h = pages.get(iso, "")
        if h.startswith("__ERR__"):
            print(f"  ✗ {name:30s} ({iso}) fetch: {h[:80]}")
            err += 1; continue
        data = parse(h)
        data["jpProfileUrl"] = JP.format(iso=iso)
        if not data or len(data) <= 1:
            empty += 1
            print(f"  · {name:30s} ({iso}) — no JP stats")
            continue
        body = json.dumps({"fields": {k: fs_value(v) for k, v in data.items()}}).encode()
        mask = "&".join(f"updateMask.fieldPaths={k}" for k in data)
        url  = f"{COL}/{doc_id}?{mask}"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=H, method="PATCH")):
                pass
            ev = data.get("percentEvangelical")
            ur = data.get("unreachedGroups")
            print(f"  ✓ {name:30s} ({iso}) ev={ev}%  unreached={ur}")
            ok += 1
        except urllib.error.HTTPError as e:
            print(f"  ✗ {name}: {e.code}")
            err += 1
    print(f"\nDone. ✓ {ok}  ✗ {err}  · {empty}")

if __name__ == "__main__":
    main()
