# K4-5K: zbir K4-B iz r-<oznaka>.json (python3 sum.py pre K4)
import json, sys, statistics as st
from collections import Counter
A = json.load(open(f"r-{sys.argv[1]}.json"))["rows"]; B = json.load(open(f"r-{sys.argv[2]}.json"))["rows"]
for tag, d in (("pre", A), ("posle", B)):
    c = Counter(f"{r['fam']} {r['days']} d" for r in d.values() if r["shortEasyWeeks"] > 2)
    print(tag, "planova sa > 2 nedelje lagan < 30 min:", sum(c.values()), dict(sorted(c.items())))
hit = {k: r for k, r in B.items() if r["k4Weeks"] > 0}
g = Counter(f"{r['fam']} {r['days']} d" for r in hit.values())
print("pravilo pogađa planova", len(hit), dict(sorted(g.items())), "nedelja", sum(r["k4Weeks"] for r in hit.values()))
e = [x for r in hit.values() for x in r["k4EasyKm"]]; e0 = [x for k in hit for x in []]
print("lagan u K4 nedeljama km: medijana", st.median(e), "min", min(e), "max", max(e))
print("planirano < cilj u K4 nedeljama: zbir km", round(sum(r["k4BelowKm"] for r in hit.values()), 1), "planova sa manjkom", sum(1 for r in hit.values() if r["k4BelowKm"] > 0.05), "upozorenja PLANNED_BELOW_TARGET u njima", sum(r["k4Warn"] for r in hit.values()))
pk = [(B[k]["peakP"] - A[k]["peakP"]) / A[k]["peakP"] for k in hit]
print("planirani vrh promena: medijana %.3f min %.3f" % (st.median(pk), min(pk)))
