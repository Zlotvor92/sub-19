/* Revizija v2, ugao 1b — skok dugog posle adaptacije meren prema STVARNO trčanom (činjenice), ne prema planiranom.
   Plafon skoka (pouka 28 / M13a / H: max(1,1 × L; L + 1 km), L = najduži dugi prethodne 4 nedelje) računa se u kodu iz
   UPISANIH dana; ovde se za protekle nedelje pokrivene činjenicama (coverage ili pauza) uzima najduži trk iz zapisa
   (0 bez zapisa), a za ostale nedelje upisani dugi. Broji se tok čiji neki budući dugi (prve 4 buduće nedelje)
   prelazi taj „činjenični" plafon, a ne prelazi plafon iz upisanih dana.
   Uzorak: sampleBases (deterministički), asOf sreda i kraj ned 1…N−2, scenariji sa stvarnim izostankom treninga.
   Iz web/: node ../docs/generators-v2/audit/coach-hm-mar/measure-jump.ts <HM|MAR> <kR> <kF> <kB> */

import { addDays, distOf, sampleBases, wedOf, type Plan, type Scenario } from "../../final-check/lib.ts";

const [name, kR, kF, kB] = [process.argv[2]!, ...process.argv.slice(3, 6).map(Number)] as [string, number, number, number];
const d = distOf(name);
const SC: Scenario[] = ["pause10", "pause20", "pause35", "under50", "painPause", "chain"];
type F = { workouts?: { date: string; km: number; completed: boolean }[]; coverage?: { from: string; to: string }; breaks?: { from: string; to: string }[] };
const cap = (L: number) => Math.max(1.1 * L, L + 1);
const out = { dist: name, flows: 0, rejected: 0, hit: 0, byScenario: {} as Record<string, number>, overKm: {} as Record<string, number>, maxOver: 0, maxEx: "", ex: [] as string[] };

function check(before: Plan, after: Plan, f: F, at: string, tag: string) {
  const known = (date: string) =>
    (f.coverage && date >= f.coverage.from && date <= f.coverage.to) || (f.breaks ?? []).some((b) => date >= b.from && date <= b.to);
  const ranMax = (s: string, e: string) => Math.max(0, ...(f.workouts ?? []).filter((x) => x.completed && x.date >= s && x.date <= e).map((x) => x.km));
  const longs = after.weeks.map((w) => {
    const L = w.days.find((x) => x.role === "long");
    if (w.endDate <= at && known(w.startDate) && known(w.endDate)) return { fact: ranMax(w.startDate, w.endDate), plan: L?.workout.km ?? 0 };
    return { fact: L?.workout.km ?? 0, plan: L?.workout.km ?? 0 };
  });
  const fut = after.weeks.filter((w) => w.startDate > at).slice(0, 4);
  for (const w of fut) {
    const L = w.days.find((x) => x.role === "long");
    if (!L || w.index <= 4) continue; // ned 1–4: L uključuje pretpostavljeni skorašnji najduži trk (nedelja 0) — van ove provere
    const prev = longs.slice(Math.max(0, w.index - 5), w.index - 1);
    const Lf = Math.max(...prev.map((x) => x.fact));
    const Lp = Math.max(...prev.map((x) => x.plan));
    if (Lf > 0 && L.workout.km > cap(Lf) + 0.15 && L.workout.km <= cap(Lp) + 0.05) {
      out.hit++;
      out.byScenario[tag] = (out.byScenario[tag] ?? 0) + 1;
      const over = Math.round((L.workout.km - cap(Lf)) * 10) / 10;
      const bin = over <= 1 ? "≤1 km" : over <= 3 ? "1–3 km" : ">3 km";
      out.overKm[bin] = (out.overKm[bin] ?? 0) + 1;
      if (over > out.maxOver) {
        out.maxOver = over;
        out.maxEx = `${tag} asOf ${at} (${JSON.stringify(before.input)}): ned ${w.index} dugi ${L.workout.km}, L činjenice ${Lf}, L upisano ${Lp}`;
      }
      if (out.ex.length < 8) out.ex.push(`${tag} asOf ${at}: ned ${w.index} dugi ${L.workout.km}, L činjenice ${Lf} (plafon ${Math.round(cap(Lf) * 10) / 10}), L upisano ${Lp}`);
      return;
    }
  }
}
const { bases } = sampleBases(d, { R: kR, F: kF, B: kB });
for (const b of bases) {
  const g = d.generate(b.input);
  if (!g.ok) continue;
  const p = g.plan;
  const asOfs = p.weeks.slice(0, -2).flatMap((w) => [wedOf(w.startDate), w.endDate]);
  for (const at of asOfs)
    for (const s of SC) {
      out.flows++;
      const f = d.facts(p, s, at) as F;
      const r = d.adapt(p, f, at);
      if (!r.ok) { out.rejected++; continue; }
      check(p, r.plan, f, at, s);
      if (s === "chain") {
        const a2 = addDays(at, 7);
        if (a2 >= p.input.raceDate) continue;
        const f2 = d.chain2(p, a2) as F;
        out.flows++;
        const r2 = d.adapt(r.plan, f2, a2);
        if (!r2.ok) { out.rejected++; continue; }
        check(r.plan, r2.plan, { workouts: [...(f.workouts ?? []), ...(f2.workouts ?? [])], coverage: f.coverage && f2.coverage ? { from: f.coverage.from, to: f2.coverage.to } : f2.coverage }, a2, "chain2");
      }
    }
}
console.log(JSON.stringify(out, null, 1));
