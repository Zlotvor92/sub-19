# Spaja delove (out/*.json) po distanci u out/summary.json. python3 merge.py
import json, glob, collections
S = {}
for f in sorted(glob.glob('out/*.json')):
    if f.endswith('summary.json'): continue
    o = json.load(open(f)); d = o['dist']; s = S.setdefault(d, {'inputs':0,'plans':0,'realInputs':0,'realPlans':0,'seconds':0,'seed':o['seed']})
    for k in ['inputs','plans','realInputs','realPlans','seconds']: s[k] += o[k]
    for k in ['rejected','rejectedReal','throws','validatorErr','validatorWarn','basis','warnings']:
        c = s.setdefault(k, {})
        for a,b in o[k].items(): c[a] = c.get(a,0)+b
    for k in ['inv','find']:
        c = s.setdefault(k, {})
        for a,b in o[k].items():
            x = c.setdefault(a, {'real':0,'unreal':0}); x['real'] += b['real']; x['unreal'] += b['unreal']
    for k in ['rejectedEx','throwEx','validatorErrEx','invEx','findEx']:
        c = s.setdefault(k, {})
        for a,b in o[k].items():
            c[a] = sorted(c.get(a,[])+b, key=lambda e:(e['size'],e['i']))[:3]
json.dump(S, open('out/summary.json','w'), indent=1, ensure_ascii=False)
for d,s in S.items():
    print('=====',d,'ulaza',s['inputs'],'planova',s['plans'],'realnih ulaza',s['realInputs'],'realnih planova',s['realPlans'],'s',round(s['seconds']))
    for k in ['rejected','rejectedReal','throws','validatorErr','inv','find']: print(' ',k,s[k])
