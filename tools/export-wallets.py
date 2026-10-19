#!/usr/bin/env python3
"""Export private SOL wallets (joined with each player's best score) to CSV.
Usage:  SUPABASE_SERVICE_KEY=... python3 tools/export-wallets.py [-o wallets.csv]
   or:  python3 tools/export-wallets.py --key-file /path/to/service_key.txt [-o wallets.csv]
The service key is NEVER stored in this repo. Wallets are private: keep the CSV out of git."""
import argparse, csv, json, os, re, sys, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = re.search(r"LB_URL = '([^']+)'", open(os.path.join(ROOT, 'js', 'lbconfig.js')).read()).group(1)
ap = argparse.ArgumentParser(); ap.add_argument('--key-file'); ap.add_argument('-o', '--out', default='harambe-wallets.csv'); a = ap.parse_args()
key = open(a.key_file).read().strip() if a.key_file else os.environ.get('SUPABASE_SERVICE_KEY', '').strip()
if not key: sys.exit('Provide the service key via SUPABASE_SERVICE_KEY or --key-file (never commit it).')
def get(path):
    r = urllib.request.Request(URL + '/rest/v1/' + path, headers={'apikey': key, 'Authorization': 'Bearer ' + key})
    return json.load(urllib.request.urlopen(r))
wallets = get('harambe_wallets?select=name,wallet,created_at,last_seen&order=created_at.asc')
best = {}
for s in get('harambe_scores?select=name,score,stage,won&hidden=eq.false&limit=100000'):
    k = s['name'].lower()
    if k not in best or s['score'] > best[k]['score']: best[k] = s
with open(a.out, 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['name', 'wallet', 'best_score', 'best_stage', 'won', 'created_at', 'last_seen'])
    for x in wallets:
        b = best.get(x['name'].lower(), {}); w.writerow([x['name'], x['wallet'], b.get('score', ''), b.get('stage', ''), b.get('won', ''), x['created_at'], x['last_seen']])
os.chmod(a.out, 0o600); print('wrote %d wallets to %s' % (len(wallets), a.out))
