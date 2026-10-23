#!/usr/bin/env python3
"""UGAO 3 (chains): spaja out/<D>-<deo>.json u out/summary.json i ispisuje tabelu (lanci, koraci, nalazi po klasi:
broj lanaca realno/nerealno, najkraći lanac). Iz korena repoa: python3 docs/generators-v2/audit/chains/aggregate.py"""
import glob, json, os, sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
tot = {}
for f in sorted(glob.glob(os.path.join(OUT, "*-[0-9].json"))):
    if os.path.getsize(f) == 0:
        continue
    s = json.load(open(f))
    t = tot.setdefault(s["dist"], {"chains": 0, "generated": 0, "genFailed": 0, "real": 0, "steps": 0, "stepsReal": 0,
                                   "rejectedChains": 0, "seconds": 0, "ranges": [], "cls": {}})
    for k in ["chains", "generated", "genFailed", "real", "steps", "stepsReal", "rejectedChains", "seconds"]:
        t[k] += s[k]
    t["ranges"].append([s["from"], s["to"]])
    t["seed"] = s["seed"]
    for k, v in s["cls"].items():
        c = t["cls"].setdefault(k, {"real": 0, "unreal": 0, "flowsReal": 0, "flowsUnreal": 0, "shortest": None, "ex": []})
        for x in ["real", "unreal", "flowsReal", "flowsUnreal"]:
            c[x] += v[x]
        a, b = c["shortest"], v["shortest"]
        if b and (not a or (b["real"] and not a["real"]) or (b["real"] == a["real"] and b["len"] < a["len"])):
            c["shortest"] = b
        c["ex"] = (c["ex"] + v["ex"])[:4]
json.dump(tot, open(os.path.join(OUT, "summary.json"), "w"), indent=1, ensure_ascii=False)
for d, t in tot.items():
    print(f"\n{d}: lanci {t['chains']} (generisano {t['generated']}, realni {t['real']}), koraci {t['steps']} "
          f"(realni {t['stepsReal']}), odbijenih lanaca {t['rejectedChains']}, {t['seconds']:.0f} s")
    for k, c in sorted(t["cls"].items(), key=lambda kv: -(kv[1]["real"] + kv[1]["unreal"])):
        sh = c["shortest"]
        print(f"  {k:55s} lanaca real {c['real']:6d} nereal {c['unreal']:5d}  najkraći i={sh['i']} len={sh['len']}"
              f" real={sh['real']}  {sh['detail'][:90]}")
