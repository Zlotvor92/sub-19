"""Segment 08g: fixture segment08g.early-hashes-f4b257d.json iz heševa trajne rane mreže na f4b257d (pre) i
tekućem stablu (posle) — early-hashes-08g.ts — i razloga promene (why-08g.ts).
python3 fixture-08g.py <pre.json> <posle.json> <why.json> <izlaz.json>"""
import json, sys, hashlib
pre, post, why = (json.load(open(p)) for p in sys.argv[1:4])
assert pre.keys() == post.keys(), 'različit skup tokova'
plans, changed, other = {}, {}, []
by = {}
for k in pre:
    by.setdefault(k.split('/')[0], []).append(k)
for pid, keys in by.items():
    un = []
    for k in keys:
        if pre[k]['h'] == post[k]['h']:
            un.append((k, pre[k]['h']))
            continue
        w = 'R' if not pre[k]['ok'] else 'F' if pre[k].get('dl', 0) > 0 else why.get(k)
        if w is None and k.endswith('/2') and k[:-2] in changed: w = 'C'
        if w is None: other.append(k); continue
        changed[k] = {'h': pre[k]['h'], 'why': w}
    s = '\n'.join(f'{k}:{h}' for k, h in sorted(un))
    plans[pid] = hashlib.sha256(s.encode()).hexdigest()[:16]
from collections import Counter
print('tokova', len(pre), 'promenjeno', len(changed), Counter(v['why'] for v in changed.values()), 'bez razloga', len(other), other[:5])
json.dump({'policyVersion': '5k-v2.7.0', 'sha': 'f4b257d', 'plans': plans, 'changed': changed}, open(sys.argv[4], 'w'), separators=(',', ':'), sort_keys=True)
