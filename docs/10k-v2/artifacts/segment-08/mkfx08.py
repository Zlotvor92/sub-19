"""10K-08: fixture segment08.changed-b9c4728.json iz dump-ova starog (b9c4728) i novog koda.
   gen-old.json / gen-new.json: gen-dump.ts; dump-old.tsv / dump-new.tsv: privremena kuka testInputs.dump08 (DUMP08,
   pun nivo mreža adaptacije, oba stabla). Uzrok = pravila 10K-08 koja stari rezultat krši (T1: lagan > 0,8 × dugi ili
   < 20 min u nedelji izgradnje; T3: nov start i taper bez kvaliteta / trkačka bez oštrenja; C11: taper sa 2 kvaliteta
   duža od dugog); bez toga 'kaskada' (posledica promenjenog baznog plana ili C3/C4/C6).
   python3 mkfx08.py <scratch dir> <izlaz.json>"""
import json, sys, collections
S, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2]
go = json.load(open(S + 'gen-old.json')); gn = json.load(open(S + 'gen-new.json'))
def load(f):
    d = {}
    for l in open(S + f):
        p = l.rstrip('\n').split('\t')
        d[(p[0], p[1])] = p[2:]
    return d
old, new = load('dump-old.tsv'), load('dump-new.tsv')
tags = {k[1]: v[1] for k, v in old.items() if k[0] == 'gen'}
gen = {}; cnt = collections.Counter()
for i, v in go.items():
    if gn[i][0] != v[0]:
        gen[i] = v; cnt[('gen', tags.get(i) or 'ostalo')] += 1
flows = collections.defaultdict(dict)
miss = set(old) ^ set(new)
for k, v in new.items():
    o = old.get(k)
    if o is None or k[0] == 'gen': continue
    if o[0] != v[0]:
        c = o[1] if o[1] not in ('', 'rej') else ('ranije odbijen' if o[1] == 'rej' else ('novo odbijanje' if v[1] == 'rej' else 'kaskada'))
        flows[k[0]][k[1]] = [int(o[0]), c]; cnt[(k[0], c)] += 1
# Tok koji novi dump nema (kuka posle provere odbijanja: međuverzija ga je odbijala) — u fixture sa starim hešom.
for k in miss:
    if k in old and k not in new and k[0] != 'gen':
        flows[k[0]][k[1]] = [int(old[k][0]), 'T1 (rasterećenje A9)']; cnt[(k[0], 'T1 (rasterećenje A9)')] += 1
tot = collections.Counter(k[0] for k in new)
for k in sorted(cnt): print(k, cnt[k])
print('ukupno po mreži', dict(tot), 'gen', len(go), 'nesparenih ključeva', len(miss), list(miss)[:5])
print('novo odbijanje', [k for k, v in new.items() if v[1] == 'rej' and old.get(k, ['', ''])[1] != 'rej'][:10])
json.dump({'against': 'b9c4728', 'note': 'Planovi generatora (mreže 02 R, F, B) i tokovi trajnih mreža adaptacije (grid04, early, relief, pain, start0) koje 10k-v2.10.0 (10K-08, krug T) menja prema b9c4728. gen: id → [planHash81, cause07, red bazne linije] na b9c4728; flows: mreža → ključ → [planHash06c na b9c4728, uzrok: T1/T3/C11 (pravilo koje stari rezultat krši) ili kaskada (promenjen bazni plan, C3/C4/C6)]. Piše docs/10k-v2/artifacts/segment-08/mkfx08.py.',
           'gen': dict(sorted(gen.items())), 'flows': {n: dict(sorted(flows[n].items())) for n in sorted(flows)}},
          open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
open(OUT, 'a').write('\n')
