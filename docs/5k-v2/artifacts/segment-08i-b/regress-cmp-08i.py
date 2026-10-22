import sys, collections
b=open(sys.argv[1]).read().splitlines(); n=open(sys.argv[2]).read().splitlines()
st=collections.defaultdict(lambda: collections.Counter())
up=[]; bad=[]; tgt=[]
for x,y in zip(b,n):
    X=x.split('\t'); Y=y.split('\t')
    assert X[:3]==Y[:3]
    s=X[1]; st[s]['flows']+=1
    if X[3]==Y[3]: continue
    st[s]['changed']+=1
    if X[1]=='GEN': bad.append(('GEN',x)); continue
    p37 = Y[4].startswith('OK:') and (Y[4].split(':')[1]!='' or (len(Y[4].split(':'))>3 and int(Y[4].split(':')[3])>0))
    if Y[4].startswith('OK:') and Y[4].split(':')[1]=='' and p37: st[s]['onlyProtectedKm']+=1
    if not p37: bad.append(y); 
    if Y[4].startswith('OK') and int(Y[4].split(':')[2])>0: st[s]['warn']+=1
    if X[4].startswith('REJ'): st[s]['wasRej']+=1
    if Y[4].startswith('REJ'): st[s]['nowRej']+=1; bad.append(y); continue
    if X[6].split('|')[1:]!=Y[6].split('|')[1:]:
        st[s]['targetChanged']+=1; tgt.append(y[:90])
    if X[5]!=Y[5]:
        st[s]['days']+=1
        a=list(map(float,X[6].split('|')[0].split(','))); c=list(map(float,Y[6].split('|')[0].split(',')))
        d=[round(q-p,2) for p,q in zip(a,c)]
        if any(v>0.005 for v in d): up.append((y[:80],d))
        st[s]['kmDown']+=round(-sum(d),2)
    else: st[s]['onlyNotes']+=1
tot=collections.Counter()
for s,c in st.items(): print(s, dict(c)); tot.update(c)
print('TOTAL', dict(tot)); print('TARGET', len(tgt), tgt[:5]); print('UP', len(up), up[:3]); print('BAD', len(bad), bad[:3])
