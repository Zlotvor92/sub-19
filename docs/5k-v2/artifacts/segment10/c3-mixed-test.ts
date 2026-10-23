const root = process.argv[2]!;
const { distOf, wedOf } = await import(root + "/docs/generators-v2/final-check/lib.ts");
const d = distOf("5K"); const all = d.all(); let flows = 0, lost = 0, c5 = 0, c5flows = 0, rej = 0; const ex: string[] = [];
const scen = ["pain5", "pain8", "painPause", "pause20", "under50", "over120"] as const;
for (let i = 0; i < all.length; i += 7) { const b = all[i]!; if (!b.id.startsWith('f-')) continue; const g = d.generate(b.input) as any; if (!g.ok) continue; const p = g.plan;
  for (let wi = 2; wi <= Math.min(5, p.weeks.length - 2); wi++) for (const at of [wedOf(p.weeks[wi - 1].startDate), p.weeks[wi - 1].startDate]) for (const s of scen) {
    let r: any; try { r = d.adapt(p, d.facts(p, s, at), at); } catch { continue; } flows++; if (!r.ok) { rej++; continue; }
    for (const w of r.plan.weeks) { if (!(r.plan.adaptation?.mixedWeeks ?? []).includes(w.index)) continue;
      const t0 = p.weeks[w.index - 1].days.find((x: any) => x.workout.qualityType === 'TEST_3K' && x.date > at);
      if (t0 && !w.limits && !w.days.some((x: any) => x.workout.qualityType === 'TEST_3K')) { lost++; if (ex.length < 3) ex.push(`${b.id}/${s}@${at} ned ${w.index}`); } } } }
console.log(JSON.stringify({ flows, rej, testLostInMixedWeek: lost, ex }));
