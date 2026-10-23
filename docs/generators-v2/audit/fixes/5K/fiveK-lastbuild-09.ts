/* 5K-09: owner/fiveK-lastbuild.ts posle ispravke N1 — (1) broj iz poruke sa decimalnim zarezom (Z2); (2) višak: ista
   donja granica min(planirano, adaptFloorKm) kao manjak (assess, 5k-v2.11.0). Ostalo isto kao original.
   Iz web/: node ../docs/generators-v2/audit/fixes/5K/fiveK-lastbuild-09.ts 6 6 3 */
/* Ugao 4, 5K v2 — „poslednja nedelja izgradnje" ima dve definicije:
   - assess.ts:221 (lastBuild = cilj poslednje ne-rasteretne nedelje izgradnje pre n; bez nedelja sa ciljem koraka i bez
     osnove povratka posle bola) — ulazi u odluke manjka (assess:455–461) i viška (assess:474);
   - volume.adaptVolume (lastBuild + anchored → returnBaseKm) i validator lastBuildBefore (validate.ts:740–748) — osnova rasta
     i rasterećenja.
   Tok: korak 1 = bol (pain5 / pain8 / painPause, lib.facts5k) na asOf; korak 2 = višak (over120) ili manjak (under50) na
   asOf + 7 / + 14 nad adaptiranim planom. Meri se: korak 2 primenjen, startKm koraka 2 (odluka assess) vs ista formula sa
   lastBuild po definiciji konstruktora/validatora; i cilj nedelje n u konačnom planu prema osnovi povratka.
   Bez slučajnosti (deterministička mreža lib.grid5k, svaki k-ti po porodici, pomak k/2).
   Iz web/: node ../docs/generators-v2/audit/owner/fiveK-lastbuild.ts <kR> <kF> <kB> */

import { DISTS, addDays, wedOf, type Plan as LPlan } from "../../../final-check/lib.ts";
import { adaptFiveKV2 } from "../../../../../web/src/domain/generators/fiveK/v2/adapt.ts";
import { mustDay } from "../../../../../web/src/domain/generators/fiveK/v2/dates.ts";
import { adaptFloorKm, returnBaseKm } from "../../../../../web/src/domain/generators/fiveK/v2/volume.ts";
import { FIVE_K_V2_POLICY as P } from "../../../../../web/src/domain/generators/fiveK/v2/policy.ts";
import { baseAthlete } from "../../../../../web/src/domain/generators/fiveK/v2/steps.ts";
import type { FiveKV2Plan } from "../../../../../web/src/domain/generators/fiveK/v2/types.ts";

const [kR, kF, kB] = process.argv.slice(2, 5).map(Number) as [number, number, number];
const d5 = DISTS.find((d) => d.name === "5K")!;
const isBuild = (w: { phase: string }): boolean => w.phase === "base" || w.phase === "peak" || w.phase === "sharpen";
const round1 = (x: number): number => Math.round(x * 10) / 10;

function nOf(plan: FiveKV2Plan, asOf: string): number {
  const next = addDays(asOf, 1);
  const i = plan.weeks.findIndex((w) => mustDay(next) >= mustDay(w.startDate) && mustDay(next) <= mustDay(w.endDate));
  const r = i + 1;
  return mustDay(plan.weeks[r - 1]!.startDate) < mustDay(next) ? r + 1 : r;
}
function lastBuildAssess(plan: FiveKV2Plan, n: number): number | null {
  let x: number | null = null;
  for (const w of plan.weeks) if (w.index < n && !w.deload && isBuild(w)) x = w.targetKm;
  return x;
}
function lastBuildOwner(plan: FiveKV2Plan, n: number): number | null {
  const steps = plan.adaptation?.steps ?? [];
  const resetKm = (i: number) => steps.some((s) => s.startKm !== null && s.fromWeek === i);
  let x: number | null = null;
  for (const v of plan.weeks.slice(0, n - 1)) {
    if (isBuild(v) && (!v.deload || resetKm(v.index))) x = v.targetKm;
    for (const s of steps)
      if (s.returnFrom && s.returnFrom.week === v.index && isBuild(v)) x = returnBaseKm(s.returnFrom.share, s.levelKm, v.targetKm);
  }
  return x;
}

const out = { plans: 0, step1: 0, step2: 0, over: { applied: 0, differ: 0 }, under: { applied: 0, differ: 0 }, rejected: 0, ex: [] as string[] };
const all = d5.all();
const fam: Record<string, number> = { R: kR, F: kF, B: kB };
const bases = ["R", "F", "B"].flatMap((fm) => all.filter((b) => b.family === fm).filter((_, i) => i % fam[fm]! === Math.floor(fam[fm]! / 2)));
const t0 = Date.now();
for (const b of bases) {
  const g = d5.generate(b.input);
  if (!g.ok) continue;
  out.plans++;
  const p = g.plan as unknown as FiveKV2Plan;
  const N = p.weeks.length;
  for (let k = 1; k <= N - 4; k++)
    for (const at of [wedOf(p.weeks[k]!.startDate), p.weeks[k]!.endDate])
      for (const s1 of ["pain5", "pain8", "painPause"] as const) {
        const r1 = adaptFiveKV2(p, d5.facts(p as unknown as LPlan, s1, at), at);
        if (!r1.ok) { out.rejected++; continue; }
        out.step1++;
        const p1 = r1.plan as FiveKV2Plan;
        for (const off of [7, 14]) {
          const at2 = addDays(at, off);
          if (at2 >= p.input.raceDate) continue;
          const n = nOf(p1, at2);
          if (n > N || !isBuild(p1.weeks[n - 1]!)) continue;
          for (const s2 of ["over120", "under50"] as const) {
            const r2 = adaptFiveKV2(p1, d5.facts(p1 as unknown as LPlan, s2, at2), at2);
            if (!r2.ok) { out.rejected++; continue; }
            out.step2++;
            const cond = s2 === "over120" ? "OVER_EXECUTION" : "UNDER_EXECUTION";
            const rs = r2.reasons.find((x) => x.condition === cond && x.applied);
            if (!rs) continue;
            const st = r2.plan.adaptation!.steps.at(-1)!;
            const tn = p1.weeks[n - 1]!.targetKm;
            const la = lastBuildAssess(p1, n);
            const lo = lastBuildOwner(p1, n);
            const bucket = s2 === "over120" ? out.over : out.under;
            bucket.applied++;
            // Ista formula assess (višak: round1(min(tn, lastBuild))) sa lastBuild po definiciji vlasnika obima.
            // Manjak: round1(max(min(tn, lastBuild, max(a2, 0,8 × tn)), min(tn, pod))) — a2 iz poruke (zaokruženo na 0,1),
            // pod = adaptFloorKm(∞) (assess:265).
            const a2 = Number((/Izvršeno ([0-9.,]+) od/.exec(rs.message)?.[1] ?? 'NaN').replace(',', '.'));
            const fl = adaptFloorKm(Infinity, baseAthlete(p.input));
            const alt =
              s2 === "over120"
                ? round1(Math.max(Math.min(tn, lo ?? tn), Math.min(tn, fl)))
                : round1(Math.max(Math.min(tn, lo ?? tn, Math.max(a2, P.adapt.underFloorShare * tn)), Math.min(tn, fl)));
            const differ = alt !== st.startKm;
            if (differ) {
              bucket.differ++;
              if (out.ex.length < 8)
                out.ex.push(`${b.id} asOf1 ${at} ${s1} → asOf2 ${at2} ${s2}: n ${n}, cilj n ${tn}, assess lastBuild ${la}, vlasnik ${lo}, startKm ${st.startKm}(vlasnik bi dao ${alt}); konačan cilj n ${r2.plan.weeks[n - 1]!.targetKm}`);
            }
          }
        }
      }
}
console.log(JSON.stringify({ step: { R: kR, F: kF, B: kB }, bases: bases.length, ...out, seconds: (Date.now() - t0) / 1000 }, null, 1));
