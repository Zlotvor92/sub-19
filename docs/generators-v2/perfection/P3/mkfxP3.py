"""P3 (10k-v2.11.0): fixture segmentP3.changed-38fd091.json iz snimaka starog (38fd091) i novog koda.
   gen-old.json / gen-new.json: docs/10k-v2/artifacts/segment-08/gen-dump.ts nad oba stabla;
   dump-old.tsv / dump-new.tsv: privremena kuka P3_DUMP u level.harness (p08Errors i p35/p37/p07FlowErrors), pun nivo
   mreža adaptacije (adapt, earlyGrid, painGrid, reliefGrid, repeatGrid), oba stabla. Uzrok: 'P3' (D33/D34/A25).
   python3 mkfxP3.py <scratch dir> <izlaz.json>"""
import json, sys, collections
S, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2]
go = json.load(open(S + 'gen-old.json')); gn = json.load(open(S + 'gen-new.json'))
def load(f):
    d = {}
    for l in open(S + f):
        n, k, h = l.rstrip('\n').split('\t')
        if (n, k) in d and d[(n, k)] != h: raise SystemExit(f'{f}: dva heša za {n} {k}')
        d[(n, k)] = h
    return d
old, new = load('dump-old.tsv'), load('dump-new.tsv')
gen = {i: v for i, v in go.items() if gn[i][0] != v[0]}
flows = collections.defaultdict(dict); cnt = collections.Counter()
for k, h in old.items():
    if k not in new: raise SystemExit(f'nov snimak nema toka {k}')
    if new[k] != h:
        flows[k[0]][k[1]] = [int(h), 'P3']; cnt[k[0]] += 1
extra = set(new) - set(old)
tot = collections.Counter(k[0] for k in old)
print('gen promenjeno', len(gen), 'od', len(go), '; tokovi po mreži', {n: f'{cnt[n]}/{tot[n]}' for n in sorted(tot)}, '; tokova samo u novom', len(extra))
json.dump({'against': '38fd091', 'note': 'Planovi generatora (mreže 01, 02 R, F, B) i tokovi trajnih mreža adaptacije (grid04, early, relief, pain, start0) koje 10k-v2.11.0 (P3: D33 plafon i lestvica RP, D34 smena A/B i I održavanja, A25) menja prema 38fd091. gen: id → [planHash81, cause07, red bazne linije] na 38fd091; flows: mreža → ključ → [planHash06c na 38fd091, uzrok]. Piše docs/generators-v2/perfection/P3/mkfxP3.py.',
           'gen': dict(sorted(gen.items())), 'flows': {n: dict(sorted(flows[n].items())) for n in sorted(flows)}},
          open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
open(OUT, 'a').write('\n')
