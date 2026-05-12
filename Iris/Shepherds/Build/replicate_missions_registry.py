#!/usr/bin/env python3
"""Replicate top-level /missionsRegistry from flockos-notify to other
Firebase projects (flockos-comms, flockos-trinity, flockos-theforest).

Reads the canonical docs from flockos-notify via the Firestore REST API,
then writes them to each target project. Uses gcloud user creds.

Usage:
    python3 replicate_missions_registry.py
"""
import json
import subprocess
import sys
import time
import urllib.parse
import urllib.request

GCLOUD = "/Users/greg.granger/google-cloud-sdk/bin/gcloud"
SOURCE = "flockos-notify"
TARGETS = ["flockos-comms", "flockos-trinity", "flockos-theforest"]
COLLECTION = "missionsRegistry"


def token() -> str:
    return subprocess.check_output([GCLOUD, "auth", "print-access-token"], text=True).strip()


def http(method: str, url: str, tok: str, body: bytes | None = None) -> dict:
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {tok}")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as r:
        data = r.read()
    return json.loads(data) if data else {}


def list_all(project: str, tok: str) -> list[dict]:
    base = f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/{COLLECTION}"
    docs: list[dict] = []
    page_token = None
    while True:
        url = base + ("?pageSize=300" + (f"&pageToken={urllib.parse.quote(page_token)}" if page_token else ""))
        resp = http("GET", url, tok)
        docs.extend(resp.get("documents", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return docs


def write_doc(project: str, doc_id: str, fields: dict, tok: str) -> None:
    url = (
        f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/"
        f"{COLLECTION}?documentId={urllib.parse.quote(doc_id)}"
    )
    body = json.dumps({"fields": fields}).encode()
    try:
        http("POST", url, tok, body)
    except urllib.error.HTTPError as e:
        if e.code == 409:  # already exists → PATCH
            patch_url = (
                f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/"
                f"{COLLECTION}/{urllib.parse.quote(doc_id)}"
            )
            http("PATCH", patch_url, tok, body)
        else:
            raise


def main() -> int:
    tok = token()
    print(f"Reading from {SOURCE}/{COLLECTION}…", flush=True)
    docs = list_all(SOURCE, tok)
    print(f"  {len(docs)} docs found.", flush=True)
    if not docs:
        print("Nothing to replicate.")
        return 1
    for tgt in TARGETS:
        print(f"\nReplicating to {tgt}…", flush=True)
        ok = err = 0
        for d in docs:
            doc_id = d["name"].rsplit("/", 1)[-1]
            try:
                write_doc(tgt, doc_id, d.get("fields", {}), tok)
                ok += 1
                if ok % 10 == 0:
                    print(f"  …{ok}", flush=True)
            except Exception as e:  # noqa: BLE001
                err += 1
                print(f"  ✗ {doc_id}: {e}", flush=True)
            time.sleep(0.05)
        print(f"  ✓ {ok}  ✗ {err}", flush=True)
    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
