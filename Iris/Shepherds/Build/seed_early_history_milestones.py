#!/usr/bin/env python3
"""
seed_early_history_milestones.py
Seeds the pre-March-19, 2026 FlockOS history milestones into flockos-notify Generations.
Source: K-Flock Docs.md — Appendix I: The FlockOS Timeline

Run from repo root:
  python3 "Iris/Shepherds/Build/seed_early_history_milestones.py"
"""

import subprocess, json, urllib.request, urllib.error, datetime

PROJECT    = 'flockos-notify'
COLLECTION = 'milestones'
BASE_URL   = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{COLLECTION}'

def _token():
    r = subprocess.run(
        ['/Users/greg.granger/google-cloud-sdk/bin/gcloud', 'auth', 'print-access-token'],
        capture_output=True, text=True, check=True)
    return r.stdout.strip()

def _sv(v):
    """Wrap a plain string as a Firestore stringValue."""
    return {'stringValue': v}

def _iv(v):
    """Wrap an int as a Firestore integerValue."""
    return {'integerValue': str(v)}

def post_doc(token, fields):
    body = json.dumps({'fields': fields}).encode()
    req  = urllib.request.Request(BASE_URL, data=body, method='POST')
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as r:
            doc = json.loads(r.read())
            name = doc.get('name','').split('/')[-1]
            print(f'  ✓ {name}  —  {fields["title"]["stringValue"]}')
    except urllib.error.HTTPError as e:
        print(f'  ✗ HTTP {e.code}: {e.read().decode()}')

MILESTONES = [
    # ── January 2026 (phase 1) ───────────────────────────────────────────────
    {
        'date': '2026-01-01',
        'year': 2026,
        'title': 'FlockOS concept begins',
        'category': 'founding',
        'description': 'Vision formed for a free, full-featured church management platform built entirely on Google infrastructure — zero licensing fees, accessible to churches worldwide.',
    },
    {
        'date': '2026-01-07',
        'year': 2026,
        'title': 'Core architecture established',
        'category': 'building',
        'description': 'GAS backend, Google Sheets as database, and GitHub Pages hosting defined. Four-API architecture (Matthew / Mark / Luke / John) established for App content, Missions, Statistics, and CRM.',
    },
    {
        'date': '2026-01-14',
        'year': 2026,
        'title': 'Shepherd, Scrolls & Fold modules built',
        'category': 'building',
        'description': 'The Shepherd (member management), The Scrolls (interaction ledger), and The Fold (groups) — the first three major ministry modules — launched.',
    },
    {
        'date': '2026-01-21',
        'year': 2026,
        'title': 'Multi-church deployment system launched',
        'category': 'tech',
        'description': 'build_churches.sh, JSON church config system, and the Nations/ output structure built — enabling one codebase to power many churches with unique branding and endpoints.',
    },
    {
        'date': '2026-01-28',
        'year': 2026,
        'title': 'Firestore integration added',
        'category': 'tech',
        'description': 'Firebase Firestore becomes the live primary data store. GAS shifts to hourly sync backup role. Real-time data layer now powers member presence, chat, and care.',
    },
    {
        'date': '2026-02-07',
        'year': 2026,
        'title': 'The Wellspring (offline engine) added',
        'category': 'tech',
        'description': 'Full .xlsx-based IndexedDB data layer built for rural and offline deployments. FlockOS can now run with zero internet connectivity.',
    },
    {
        'date': '2026-02-15',
        'year': 2026,
        'title': 'v3.0 — Major architecture refactor',
        'category': 'tech',
        'description': 'Bezalel provisioning tool, Truth content seeding, full permission system redesign — version 3.0 establishes the permission group architecture and content pipeline.',
    },
    # ── January 2026 ──────────────────────────────────────────────────────────
    {
        'date': '2026-01-01',
        'year': 2026,
        'title': 'Active multi-church deployments live',
        'category': 'growth',
        'description': 'FlockOS (root), TBC (Trinity Baptist Church), TheForest, and GAS demo all live in production. Multi-church system proven across four independent deployments.',
    },
    # ── February 2026 ─────────────────────────────────────────────────────────
    {
        'date': '2026-02-01',
        'year': 2026,
        'title': '24-type care system launched',
        'category': 'building',
        'description': '24 pastoral care case types with stage progressions, first-contact checklists, and workflow guides built into The Life. Full care pipeline from crisis to closure.',
    },
    # ── March 2026 (pre-19) ───────────────────────────────────────────────────
    {
        'date': '2026-03-01',
        'year': 2026,
        'title': 'Granular sub-permission system deployed',
        'category': 'tech',
        'description': '130+ permission keys, 16 groups, Grant/Deny overrides — the most complete RBAC system in FlockOS history. Every module, action, and data access point individually gateable.',
    },
    {
        'date': '2026-03-15',
        'year': 2026,
        'title': 'April 9 v3.5 — Master group + permissions finalized',
        'category': 'tech',
        'description': "master AccessControl group added (full access tier above Admin). Master API config system live. Final permissions architecture with Seed Admin > Lead Pastor > Master > Admin > Timothy hierarchy finalized.",
    },
]

def main():
    now = datetime.datetime.utcnow().isoformat() + 'Z'
    token = _token()
    print(f'Seeding {len(MILESTONES)} early-history milestones → {PROJECT}/{COLLECTION}')
    for m in MILESTONES:
        fields = {
            'date':        _sv(m['date']),
            'year':        _iv(m['year']),
            'title':       _sv(m['title']),
            'category':    _sv(m['category']),
            'description': _sv(m['description']),
            'createdAt':   _sv(now),
            'createdBy':   _sv('seed:early_history'),
        }
        post_doc(token, fields)
    print('Done.')

if __name__ == '__main__':
    main()
