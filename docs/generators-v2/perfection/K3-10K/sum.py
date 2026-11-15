# K3-10K sažetak po pravilu: python3 sum.py <oznaka> [vdot|feel]   (čita r-<oznaka>.json)
import json, sys, statistics as st, os
d = json.load(open(os.path.join(os.path.dirname(__file__), f"r-{sys.argv[1]}.json")))
R = d["rows"]; MODE = sys.argv[2] if len(sys.argv) > 2 else None
def med(xs): return round(st.median(xs), 1) if xs else None
print("odbijanja", len(d["rej"]), "planova", len(R), "| DOSE_DROPPED planova", sum(r.get("dropped", 0) for r in R.values()), "| taper bez kvaliteta", sum(r.get("taperNoQ", 0) for r in R.values()), "| nedelja pouke 35", sum(r.get("p35", 0) for r in R.values()), "planova", sum(r.get("p35", 0) > 0 for r in R.values()))
def grp(r):
    if r["vdot"] < 40: return "VDOT<40" if r["peakT"] >= 30 else "<30"
    v = r["peakT"]
    return "<30" if v < 30 else "30-45" if v < 45 else "45-65" if v < 65 else ">=65"
A = {}
for k, r in R.items():
    if r["exp"] == "beginner" or r["iMax"] == 0 or (MODE and r["mode"] != MODE): continue
    A.setdefault(grp(r), []).append(r)
rng = {"30-45": (12, 16), "45-65": (16, 20), ">=65": (18, 24), "VDOT<40": (0, 18)}
print("K3-A I grupa (vrh obima) | n | med vrh I | p10 | p90 | ispod/iznad opsega | I ned med | plan>=10 ned sa <3 I ned")
for g in ["<30", "30-45", "45-65", ">=65", "VDOT<40"]:
    xs = A.get(g, [])
    if not xs: continue
    I = sorted(x["iMax"] for x in xs); lo, hi = rng.get(g, (0, 99))
    out = (sum(1 for x in I if x < lo - 1e-6), sum(1 for x in I if x > hi + 1e-6))
    few = sum(1 for x in xs if x["nWeeks"] >= 10 and x["iWeeksNonDeload"] < 3)
    print(g, "|", len(xs), "|", med(I), "|", round(I[len(I)//10],1), "|", round(I[9*len(I)//10],1), "|", out, "|", med([x["iWeeksNonDeload"] for x in xs]), "|", few)
RP = [r for r in R.values() if r["exp"] != "beginner" and r["rpPeakT"] >= 50 and r["vdot"] >= 40 and (not MODE or r["mode"] == MODE)]
x = sorted(r["rpMax"] for r in RP)
if x: print("K3-A RP (vrh RP pri cilju >= 50, VDOT>=40) n", len(x), "| med", med(x), "| p10", round(x[len(x)//10],1), "| ispod 22:", sum(v < 22 - 1e-6 for v in x), "| iznad 30:", sum(v > 30 + 1e-6 for v in x))
B4 = [r for r in R.values() if r["days"] == 4 and r["exp"] != "beginner"]
print("K3-B 4d redovan n", len(B4), "| lagan/dugi max med", med([r["easyLongMax"] for r in B4]), "| >0,70:", sum(r["easyLongMax"] > 0.701 for r in B4), ">0,75:", sum(r["easyLongMax"] > 0.751 for r in B4),
      "| ned1 < 95% start:", sum(r["wk1P"] < 0.95 * r["startKm"] - 0.05 for r in B4), "| planirano<cilj planova:", sum(r["belowTarget"] > 0 for r in B4))
C3 = [r for r in R.values() if r["days"] == 3 and r["exp"] != "beginner"]
print("K3-C 3d redovan n", len(C3), "| lagan/dugi max med", med([r["easyLongMax"] for r in C3]), "| >0,70:", sum(r["easyLongMax"] > 0.701 for r in C3), "| ista doza >2 ned:", sum(r["sameDoseRun"] > 2 for r in C3), "| dugi+T u spec (planova):", sum(r["longT"] > 0 for r in C3), "| planirano<cilj planova:", sum(r["belowTarget"] > 0 for r in C3))
NB = list(R.values())
print("K3-D najteža nedelja od kraja (0=trka):", {k: sum(1 for r in NB if r["hardestFromEnd"] == k) for k in range(0, 8)}, "| ≠2:", sum(r["hardestFromEnd"] != 2 for r in NB), "| pre tapera > 0,85:", sum(r["preTaperShare"] > 0.851 for r in NB))
T = [r for r in R.values() if r["testWork"] > 0]
print("K3-E planova sa testom", len(T), "| test > 2 × doza:", sum(r["testWork"] > 2 * r["testPriorMax"] + 1 for r in T), "| po danima:", {n: sum(1 for r in T if r["days"] == n and r["testWork"] > 2 * r["testPriorMax"] + 1) for n in range(3, 7)})
F = [r for r in R.values() if r["shortEasyWeeks"] > 2]
print("K3-F planova sa laganim <30 min u > 2 ned izgradnje:", len(F), "| po danima:", {n: sum(1 for r in F if r["days"] == n) for n in range(3, 7)}, "| po startu:", {k: sum(1 for r in F if lo <= r["startKm"] < hi) for k, (lo, hi) in {"<20": (0, 20), "20-30": (20, 30), ">=30": (30, 999)}.items()})
