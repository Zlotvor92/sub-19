/* Ugao 5 (consistency), odložena odluka a): „rasterećenje nije niže od prethodne nedelje".
   SAMO ČITANJE. Iz web/: node ../docs/generators-v2/audit/consistency/deload-prev.ts <DIST> <k>
   Deterministički (bez slučajnosti): svaki k-ti plan svih porodica (R/F/B) iz lib.DISTS.
   (1) generator: redovno rasterećenje sa planirano ≥ planirano prethodne nedelje;
   (2) adaptacija umor (lib facts 'fatigue': RPE zapisi asOf−1, asOf−3), asOf = prvi dan nedelje k za SVE k
       (1 … N−4), kao mixed-deload.ts ali za sve nedelje; nova rasteretna nedelja k: cilj, planirano, prethodna. */
import { distOf } from "../../final-check/lib.ts";
const d = distOf(process.argv[2]!);
const K = Number(process.argv[3] ?? 13);
const r1 = (x: number) => Math.round(x * 10) / 10;
const gen = { plans: 0, deloads: 0, notLower: 0, ex: [] as string[] };
const ad = { flows: 0, rejected: 0, newDeload: 0, notLower: 0, targetGePrev: 0, byPrev: {} as Record<string, number>,
  diffs: [] as number[], prevDeloadFlows: 0, prevDeloadNew: 0, sameTitles: 0, pcts: [] as number[], ex: [] as string[], byFam: {} as Record<string, number>, byPhase: {} as Record<string, number> };
for (const [i, b] of d.all().entries()) {
  if (i % K !== 0) continue;
  const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan; const N = p.weeks.length; gen.plans++;
  for (let k = 1; k < N; k++) {
    const w = p.weeks[k]; if (!w.deload) continue; gen.deloads++;
    if (w.plannedKm >= p.weeks[k - 1].plannedKm - 0.05) { gen.notLower++; if (gen.ex.length < 5) gen.ex.push(`${b.id} ned ${k + 1}: ${w.plannedKm} ≥ ${p.weeks[k - 1].plannedKm}`); }
  }
  for (let k = 1; k < N - 3; k++) {
    if (p.weeks[k].deload) continue;
    const at = p.weeks[k].startDate; ad.flows++; if (p.weeks[k - 1].deload) ad.prevDeloadFlows++;
    let a: any; try { a = d.adapt(p, d.facts(p, "fatigue" as any, at), at); } catch { ad.rejected++; continue; }
    if (!a.ok) { ad.rejected++; continue; }
    const w = a.plan.weeks[k]; if (!w.deload) continue; ad.newDeload++;
    const prev = a.plan.weeks[k - 1];
    if (prev.deload) { ad.prevDeloadNew++; const t = (x: any) => x.days.map((y: any) => y.workout.title).join("|"); if (t(prev) === t(w)) ad.sameTitles++; }
    if (w.plannedKm < prev.plannedKm - 0.05) continue;
    ad.notLower++;
    if (w.targetKm >= prev.plannedKm - 0.05) ad.targetGePrev++;
    const why = prev.deload ? "prethodna rasteretna" : prev.plannedKm < prev.targetKm - 0.5 ? "prethodna planirano < cilj" : prev.phase !== w.phase ? "prelaz faze" : prev.index === 0 || k === 1 ? "ned 2 (prethodna = start)" : "ostalo";
    ad.byPrev[why] = (ad.byPrev[why] ?? 0) + 1;
    ad.byFam[b.family] = (ad.byFam[b.family] ?? 0) + 1;
    ad.byPhase[w.phase] = (ad.byPhase[w.phase] ?? 0) + 1;
    const diff = w.plannedKm - prev.plannedKm; ad.diffs.push(diff); ad.pcts.push(prev.plannedKm > 0 ? (100 * diff) / prev.plannedKm : 0);
    if (ad.ex.length < 6 || (why === "ostalo" && ad.ex.length < 12)) ad.ex.push(`${b.id} asOf ${at} ned ${k + 1} (${w.phase}): cilj ${w.targetKm} plan ${w.plannedKm}; prethodna ${prev.deload ? "R " : ""}cilj ${prev.targetKm} plan ${prev.plannedKm} [${why}]`);
  }
}
const q = (xs: number[], f: number) => { const s = [...xs].sort((x, y) => x - y); return s.length ? r1(s[Math.min(s.length - 1, Math.floor(f * s.length))]!) : 0; };
console.log(JSON.stringify({ dist: d.name, k: K, generator: gen,
  adapt: { ...ad, diffs: undefined, pcts: undefined,
    diffKm: { med: q(ad.diffs, 0.5), p90: q(ad.diffs, 0.9), max: q(ad.diffs, 1 - 1e-9) },
    diffPct: { med: q(ad.pcts, 0.5), p90: q(ad.pcts, 0.9), max: q(ad.pcts, 1 - 1e-9) } } }, null, 1));
