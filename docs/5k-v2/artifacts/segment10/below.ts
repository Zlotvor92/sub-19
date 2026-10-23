const root = process.argv[2]!;
const { distOf } = await import(root + "/docs/generators-v2/final-check/lib.ts");
const d = distOf("5K"); let plans = 0, below = 0, weeks = 0, def = 0, ok = 0, rest = 0, sumPlanned = 0;
for (const b of d.all()) { const g = d.generate(b.input) as any; plans++; if (!g.ok) continue; ok++;
  let any = false; for (const w of g.plan.weeks) { sumPlanned += w.plannedKm; if (w.phase !== 'race' && w.plannedKm < w.targetKm - 0.05) { any = true; weeks++; def += w.targetKm - w.plannedKm; } if (w.easyRest) rest++; }
  if (any) below++; }
console.log(JSON.stringify({ plans, ok, plansBelowTarget: below, weeksBelow: weeks, deficitKm: Math.round(def), weeksEasyRest: rest, plannedTotalKm: Math.round(sumPlanned) }));
