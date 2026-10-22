#!/usr/bin/env python3
"""Organizator — pregled izlaza run-all.sh: jedan red po poslu (odbijanja, zajedničke provere, invarijante).
   python3 docs/generators-v2/final-check/summarize-all.py <OUT_DIR>
   Red sa „!" znači da posao nije čist (odbijanje, commonChecks, invarijanta, dva testa, iznad cilja bez upozorenja
   ili izlazni kod ≠ 0). Generator: samo poznata odbijanja ulaza sa preporukom se ne broje (RECENT_LONG_TOO_SHORT,
   QUALITY_INFEASIBLE na nerealnom 5K ulazu — POSLE-MERGE)."""
import json, os, re, sys

out = sys.argv[1]
status = {}
for line in open(os.path.join(out, "_status.tsv")):
    name, rc, sec = line.rstrip("\n").split("\t")
    status[name] = (int(rc), int(sec))

KNOWN_GEN = {"RECENT_LONG_TOO_SHORT", "QUALITY_INFEASIBLE"}


def tally(t):
    """flows, rejectedFlows, rejected, common, inv iz jednog brojača (pre-lib tally ili early.ts)."""
    return (t.get("flows"), t.get("rejectedFlows", 0), t.get("rejected") or {}, t.get("common") or {}, t.get("inv") or {})


def fmt(parts):
    return "; ".join(p for p in parts if p)


rows = []
bad = 0
for name in sorted(status):
    rc, sec = status[name]
    path = os.path.join(out, name + ".txt")
    text = open(path).read() if os.path.exists(path) else ""
    issues, info = [], []
    if rc != 0:
        issues.append(f"rc={rc}")
    try:
        d = json.loads(text)
    except Exception:
        d = None
    if isinstance(d, dict):
        tallies = []
        if "adapt" in d and isinstance(d["adapt"], dict):  # handoff-adapt
            h = d.get("handoff", {})
            info.append(f"predaja {h.get('ok')}/{h.get('calls')}")
            tallies += [(m, d["adapt"][m]) for m in ("new", "cum")]
        elif "second" in d:  # two-step
            tallies += [("first", d["first"])] + [(m, d["second"][m]) for m in ("new", "cum")]
        elif "locked" in d and "control" in d:  # locked-test
            tallies += [("locked", d["locked"]), ("control", d["control"])]
            if d.get("twoTestsAccepted"):
                issues.append(f"twoTests {d['twoTestsAccepted']}")
        elif "offer" in d:  # shorter
            info.append(f"offer {d.get('offer')} longLost {d.get('longLost')} timeCapped {d.get('offerTimeCapped')}")
            if d.get("rejected"):
                issues.append(f"rejected {d['rejected']}")
        elif "flows" in d and isinstance(d["flows"], (int, dict)):
            if isinstance(d["flows"], dict):  # fatigue-startday
                info.append(f"tokova {sum(d['flows'].values())}")
                if d.get("rejected"):
                    issues.append(f"rejected {d['rejected']}")
            else:
                tallies.append(("", d))
            if d.get("twoTests"):
                issues.append(f"twoTests {d['twoTests']}")
            if isinstance(d.get("inv"), int) and d["inv"]:
                issues.append(f"inv {d['inv']}")
        for label, t in tallies:
            flows, rej, rejd, common, inv = tally(t)
            pre = f"{label} " if label else ""
            info.append(f"{pre}{rej}/{flows}")
            if rej:
                issues.append(f"{pre}odbijeno {rej} {rejd}")
            if common:
                issues.append(f"{pre}common {common}")
            if inv:
                issues.append(f"{pre}inv {inv}")
        gen = d.get("generatorRejected")
        if isinstance(gen, dict):
            unk = {k: v for k, v in gen.items() if k not in KNOWN_GEN}
            if gen:
                info.append(f"generator {gen}")
            if unk:
                issues.append(f"generator {unk}")
        elif isinstance(gen, int) and gen:
            issues.append(f"generator {gen}")
        if name.startswith(("warnings-", "targeted-")):
            info = [f"{len(text)} B (pregled ručno)"]
            issues = [i for i in issues if i.startswith("rc=")]
    else:
        # tekstualni izlazi: fatigue-repeat, locked-result, fatigue-monday, mixed-deload, prestart-chain
        for m in re.finditer(r"odbijen[oa]_?\w*:\s*(\d+)", text):
            if int(m.group(1)):
                issues.append(m.group(0))
        for m in re.finditer(r"iznadCiljaBezUpozorenja:\s*(\d+)", text):
            if int(m.group(1)):
                issues.append(m.group(0))
        for m in re.finditer(r"drugo_rasterecenje:\s*(\d+)", text):
            if int(m.group(1)):
                issues.append(m.group(0))
        if name == "mixed-deload":
            info.append("bez upozorenja " + "/".join(re.findall(r"iznadCiljaBezUpozorenja:\s*(\d+)", text)))
        if name == "prestart-chain":
            for m in re.finditer(r"^(\w+) (\d+) (\{[^}]*\})", text, re.M):
                if m.group(3) != "{}":
                    issues.append(f"{m.group(1)} {m.group(3)[:120]}")
            info.append("4 distance")
        if not info:
            info.append(text.strip().splitlines()[-1][:100] if text.strip() else "prazno")
    if issues:
        bad += 1
    rows.append(f"{'!' if issues else ' '} {name:<28} {sec:>5}s  {fmt(info)[:110]}{'  ⇒ ' + fmt(issues)[:300] if issues else ''}")

print("\n".join(rows))
print(f"\n{len(rows)} poslova, nečistih: {bad}")
