# Graf uvoza testova/izvora (V1a). Pokretanje iz web/: python3 -I ../docs/generators-v2/perfection/V1a/import-graph.py /tmp/res.json
# Izlaz: spisak izvornih fajlova koji dosežu v1 mimo select.ts/handoff.ts + /tmp/res.json (test, direktno v1, preko select, sekunde iz scripts/test-durations.json).
import os,re,sys,json,collections
root='src'
files=[]
for dp,dn,fn in os.walk(root):
    for f in fn:
        if f.endswith(('.ts','.tsx')): files.append(os.path.join(dp,f))
fs=set(files)
rx=re.compile(r"""(?:from\s+|import\s+|import\(\s*|vi\.mock\(\s*|vi\.importActual\(\s*|require\(\s*)['"]([^'"]+)['"]""")
def resolve(src,imp):
    if imp.startswith('@/'): base=os.path.join('src',imp[2:])
    elif imp.startswith('.'): base=os.path.normpath(os.path.join(os.path.dirname(src),imp))
    else: return None
    for c in [base,base+'.ts',base+'.tsx',base+'/index.ts',base+'/index.tsx']:
        if c in fs: return c
    return None
edges={}
for f in files:
    try: t=open(f,encoding='utf8').read()
    except: continue
    e=set()
    for m in rx.finditer(t):
        r=resolve(f,m.group(1))
        if r: e.add(r)
    edges[f]=e
V1D=('fiveK','tenK','halfMarathon','marathon')
def isv1(p):
    m=re.match(r'src/domain/generators/(fiveK|tenK|halfMarathon|marathon)/(.*)',p)
    return bool(m) and not m.group(2).startswith('v2/')
CUT={'src/domain/generators/select.ts','src/domain/generators/handoff.ts'}
def closure(start,cut):
    seen={start};st=[start]
    while st:
        x=st.pop()
        for y in edges.get(x,()):
            if y in seen: continue
            if cut and y in CUT: continue
            seen.add(y); st.append(y)
    return seen
dur=json.load(open('scripts/test-durations.json'))
def istest(p): return bool(re.search(r'\.(test|node\.test|oracle\.test)\.tsx?$',p))
tests=[f for f in files if istest(f)]
res=[]
for t in tests:
    key=t[0:]  # durations keys relative to web
    c_cut=closure(t,True); c_all=closure(t,False)
    direct=any(isv1(x) for x in c_cut)
    viasel=any(isv1(x) for x in c_all)
    res.append((t,direct,viasel,dur.get(t,0)))
json.dump(res,open(sys.argv[1],'w'))
# non-test source files reaching v1 without select
src=[f for f in files if not istest(f) and not f.startswith('src/test/') and not isv1(f)]
print('non-test non-v1 src files that reach v1 directly (not via select/handoff):')
for f in src:
    if f.startswith('src/domain/generators/') and re.match(r'src/domain/generators/(fiveK|tenK|halfMarathon|marathon)/v2/',f): 
        if any(isv1(x) for x in closure(f,True)): print('  V2->V1',f)
        continue
    if any(isv1(x) for x in closure(f,True)): print('  ',f)
print('files importing select.ts (non-test):', sum(1 for f in src if 'src/domain/generators/select.ts' in edges[f]))
print('files importing handoff.ts (non-test):',[f for f in src if 'src/domain/generators/handoff.ts' in edges[f]])
# who imports v1 files directly (non-v1 files)
print('direct importers of v1 files from outside v1 (any):')
c=collections.Counter()
for f,e in edges.items():
    if isv1(f): continue
    for y in e:
        if isv1(y): c[f]+=1
for f,n in sorted(c.items()): print('  ',f,n)
