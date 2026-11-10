/* P8-MAR završetak — mere odluka organizatora (S4 O2, G6 početnik) na mrežama po osećaju (8190) i početnika (1890).
   Iz web/: node --max-old-space-size=6144 ../docs/generators-v2/perfection/P8-MAR/finish.ts <oznaka>
   → P8-MAR/finish-<oznaka>.json */
import { writeFileSync } from "node:fs";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import { beginnerInputs, feelInputs } from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
const tag = process.argv[2] ?? "x";
const out: Record<string, unknown> = {};
{
  let n = 0, rej = 0, noTest = 0; const byWeeks: Record<string, number> = {}; const testWeek: Record<string, number> = {}; let twoQ = 0;
  for (const c of feelInputs()) { n++; const r = generateMarathonV2(c.input) as any; if (!r.ok) { rej++; continue; }
    const w = r.plan.weeks.find((x: any) => x.days.some((d: any) => d.role === "test"));
    if (!w) { noTest++; byWeeks[r.plan.weeks.length] = (byWeeks[r.plan.weeks.length] ?? 0) + 1; }
    else { const k = `${r.plan.weeks.length}w:ned${w.index}:${w.phase}`; if (r.plan.weeks.length <= 13) testWeek[k] = (testWeek[k] ?? 0) + 1; if (w.days.some((d: any) => d.role === "q1" || d.role === "q2")) twoQ++; } }
  out["poOsecaju"] = { ulaza: n, odbijeno: rej, bezTesta: noTest, bezTestaPoNedeljama: byWeeks, testKratkihPlanova: testWeek, nedeljaTestaSaKvalitetom: twoQ };
}
{
  let n = 0, rej = 0, n4 = 0, low = 0, under = 0, underWeeks = 0, ratioMax = 0; const peaks: number[] = [];
  for (const c of beginnerInputs()) { n++; const r = generateMarathonV2(c.input) as any; if (!r.ok) { rej++; continue; }
    const p = r.plan; if (p.input.runDays.length < 4) continue; n4++;
    const build = p.weeks.filter((w: any) => !w.deload && ["base", "development", "specific"].includes(w.phase));
    const top = build.reduce((a: any, w: any) => (w.targetKm > a.targetKm ? w : a));
    const plannedPeak = Math.max(...build.map((w: any) => w.plannedKm));
    peaks.push(plannedPeak);
    if (plannedPeak < 0.9 * p.peakCapKm - 1e-9) low++;
    const uw = build.filter((w: any) => w.plannedKm < w.targetKm - 0.1 - 1e-9 || w.fitted === "down").length;
    if (uw > 0) under++; underWeeks += uw;
    for (const w of build) { const L = w.days.find((d: any) => d.role === "long"); for (const d of w.days) if (d.role === "easy" && L) ratioMax = Math.max(ratioMax, d.workout.km / L.workout.km); }
    void top; }
  peaks.sort((a, b) => a - b);
  out["pocetnik"] = { ulaza: n, odbijeno: rej, planova4plus: n4, planiranVrhIspod90: low, planovaSaPlaniranoIspodCilja: under, nedeljaIspodCilja: underWeeks, laganDugiMax: Math.round(ratioMax * 100) / 100, planiranVrhMedijana: peaks[Math.floor((peaks.length - 1) / 2)] };
}
writeFileSync(new URL(`./finish-${tag}.json`, import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out));
