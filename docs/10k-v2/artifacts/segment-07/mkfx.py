import json, sys, collections
S='/tmp/claude-0/-home-user-sub-19/f78456e6-2b11-5c57-9ec3-0981fc722db2/scratchpad/'
def load(f, n):
    d={}
    for l in open(S+f):
        p=l.rstrip('\n').split('\t')
        d[(p[0],p[1])]=p[2:]
    return d
old=load('dump-old.tsv',0); new=load('dump-new.tsv',0)
print('old',len(old),'new',len(new), 'missing', len(set(old)^set(new)))
fx=collections.defaultdict(dict); cnt=collections.Counter()
for k,v in new.items():
    o=old.get(k)
    if o is None: continue
    if o[0]!=v[0]:
        m=v[1] if len(v)>1 and v[1] not in ('','-') else ('Z6/C3' if o[0]=='0' else '?')
        fx[k[0]][k[1]]=[int(o[0]), m]
        cnt[(k[0],m)]+=1
for k in sorted(cnt): print(k, cnt[k])
qs=[(n,k) for n in fx for k,v in fx[n].items() if v[1]=='?']
print('unexplained', len(qs), qs[:10])
if len(sys.argv)>1:
    out={'against':'c13c258','note':'Tokovi trajnih mreža adaptacije (04 grid04, E early, R relief, start + 0 start0) koje 10k-v2.9.0 (10K-07) menja posle undo07 — vrednost = [heš planHash06c na c13c258 (0 = odbijen u mreži E), uzrok: Z1/F3/O-1b/C7/C8/Z7 (testInputs.mark07) ili Z6/C3 (ranije odbijen)]. Piše docs/10k-v2/artifacts/segment-07/mkfx.py iz dump-ova (DUMP07) starog i novog koda.','flows':{n:dict(sorted(fx[n].items())) for n in sorted(fx)}}
    json.dump(out, open(sys.argv[1],'w'), indent=1, ensure_ascii=False); open(sys.argv[1],'a').write('\n')
