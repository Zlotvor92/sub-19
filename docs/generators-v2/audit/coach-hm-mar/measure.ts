/* Revizija v2, ugao 1b (coach-hm-mar) — brojanje trenerskih nalaza na SVIM ulazima mreža generatora (lib.ts d.all():
   porodice R/F/B) i na uzorku adaptacije (sampleBases, asOf sreda i kraj ned 1…N−2 × 17 scenarija + lanac).
   Bez slučajnosti: uzorak je deterministički (svaki k-ti plan porodice, lib.ts).
   T1 taper: dan kvaliteta (q1/q2) duži po trajanju od dugog iste nedelje tapera; uz to: napomena tvrdi suprotno
      („ne sme biti duži od dugog"), ima li plan upozorenje koje to pominje (LONG_SHORTER_THAN_QUALITY / TAPER_*).
   T2 izgradnja (ne R, ne taper): lagan ≥ 0,9 × dugi iste nedelje; „susedan" = lagan dan pre ili posle dugog.
   T3 adaptacija: taper sa dva dana kvaliteta i dugim kraćim od oba.
   Realan ulaz: VDOT ≤ 70 (svi u mrežama), početnik VDOT ≤ 45 i lak ≥ 330 s/km (ODLUKE-4a „realni trkač").
   Iz web/: node ../docs/generators-v2/audit/coach-hm-mar/measure.ts <HM|MAR> <kR> <kF> <kB> */

import { addDays, distOf, SCENARIOS, sampleBases, wedOf, type Plan, type Week } from "../../final-check/lib.ts";

const [name, kR, kF, kB] = [process.argv[2]!, ...process.argv.slice(3, 6).map(Number)] as [string, number, number, number];
const d = distOf(name);
const QR = ["q1", "q2"];
const longOf = (w: Week) => w.days.find((x) => x.role === "long");
const realistic = (p: Plan) => {
  const beg = p.input["experience"] === "beginner";
  const v = p.vdot ?? 0;
  const e = p.input["easyPaceSecPerKm"] as number | undefined;
  return v <= 70 && (!beg || (v <= 45 && (e === undefined || e >= 330)));
};
const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);

function taperIssues(p: Plan, asOf = "0000-00-00") {
  const out: { w: number; q: number; L: number; two: boolean; contra: boolean }[] = [];
  for (const w of p.weeks) {
    if (w.phase !== "taper" || w.startDate <= asOf) continue;
    const L = longOf(w);
    if (!L) continue;
    const qs = w.days.filter((x) => QR.includes(x.role));
    const over = qs.filter((x) => x.workout.sec > L.workout.sec);
    if (over.length)
      out.push({
        w: w.index,
        q: Math.max(...over.map((x) => Math.round(x.workout.sec / 60))),
        L: Math.round(L.workout.sec / 60),
        two: over.length === 2,
        contra: w.notes.some((n) => n.includes("ne sme biti duži od dugog")),
      });
  }
  return out;
}
function easyNearLong(p: Plan) {
  const out: { w: number; e: number; L: number; adj: boolean }[] = [];
  for (const w of p.weeks) {
    if (w.deload || !["base", "development", "specific"].includes(w.phase)) continue;
    const L = longOf(w);
    if (!L) continue;
    for (const x of w.days.filter((y) => y.role === "easy"))
      if (x.workout.km >= 0.9 * L.workout.km) {
        out.push({ w: w.index, e: x.workout.km, L: L.workout.km, adj: x.date === addDays(L.date, 1) || x.date === addDays(L.date, -1) });
        break;
      }
  }
  return out;
}
const warnText = (p: Plan) => p.warnings.map((v) => `${(v as { rule?: string }).rule ?? v.code}`);

const gen = { plans: 0, rejected: 0, unrealistic: 0, t1: 0, t1contra: 0, t1two: 0, t1maxOver: 0, t1ex: [] as string[], t2: 0, t2adj: 0, t2maxEasy: 0, t2ex: [] as string[], t1ByDays: {} as Record<string, number>, t1worst: "", t2worst: "", t2worstKm: 0, t2adjMinutes: {} as Record<string, number>, t2ByDays: {} as Record<string, number>, t1Warn: {} as Record<string, number> };
for (const b of d.all()) {
  const g = d.generate(b.input);
  if (!g.ok) { gen.rejected++; continue; }
  const p = g.plan;
  if (!realistic(p)) { gen.unrealistic++; continue; }
  gen.plans++;
  const t1 = taperIssues(p);
  if (t1.length) {
    gen.t1++;
    inc(gen.t1ByDays, `${p.input.runDays.length}d`);
    if (t1.some((x) => x.contra)) gen.t1contra++;
    if (t1.some((x) => x.two)) gen.t1two++;
    const ov = Math.max(...t1.map((x) => x.q - x.L));
    if (ov > gen.t1maxOver) gen.t1worst = `${b.id} (vdot ${p.vdot}): ${t1.map((x) => `ned ${x.w} ${x.q}>${x.L} min`).join(", ")}`;
    gen.t1maxOver = Math.max(gen.t1maxOver, ov);
    for (const c of warnText(p)) inc(gen.t1Warn, c);
    if (gen.t1ex.length < 6) gen.t1ex.push(`${b.id}: ${t1.map((x) => `ned ${x.w} ${x.q}>${x.L} min${x.contra ? " (napomena tvrdi suprotno)" : ""}`).join(", ")}`);
  }
  const t2 = easyNearLong(p);
  if (t2.length) {
    gen.t2++;
    inc(gen.t2ByDays, `${p.input.runDays.length}d`);
    if (t2.some((x) => x.adj)) gen.t2adj++;
    const me = Math.max(...t2.map((x) => x.e));
    if (me > gen.t2worstKm) { gen.t2worstKm = me; gen.t2worst = `${b.id} (vdot ${p.vdot}): ${t2.map((x) => `ned ${x.w} lagan ${x.e}/dugi ${x.L}${x.adj ? " susedan" : ""}`).join(", ")}`; }
    gen.t2maxEasy = Math.max(gen.t2maxEasy, me);
    // trajanje susednog laganog (min): koliko je „drugi dugi" vikenda
    for (const w of p.weeks) {
      const L = longOf(w);
      if (!L || w.deload || !["base", "development", "specific"].includes(w.phase)) continue;
      const e = w.days.find((y) => y.role === "easy" && y.workout.km >= 0.9 * L.workout.km && (y.date === addDays(L.date, 1) || y.date === addDays(L.date, -1)));
      if (e) { const m = e.workout.sec / 60; inc(gen.t2adjMinutes, m >= 120 ? "≥120 min" : m >= 90 ? "90–119 min" : "<90 min"); break; }
    }
    if (gen.t2ex.length < 6) gen.t2ex.push(`${b.id}: ${t2.map((x) => `ned ${x.w} lagan ${x.e}/dugi ${x.L}${x.adj ? " susedan" : ""}`).join(", ")}`);
  }
}

const ad = { bases: 0, flows: 0, rejected: 0, t1: 0, t1two: 0, t1contra: 0, t1noWarn: 0, byScenario: {} as Record<string, number>, ex: [] as string[] };
const { bases } = sampleBases(d, { R: kR, F: kF, B: kB });
for (const b of bases) {
  const g = d.generate(b.input);
  if (!g.ok) continue;
  const p = g.plan;
  if (!realistic(p)) continue;
  ad.bases++;
  const born = new Set(taperIssues(p).map((x) => x.w));
  const asOfs = p.weeks.slice(0, -2).flatMap((w) => [wedOf(w.startDate), w.endDate]);
  for (const at of asOfs)
    for (const s of SCENARIOS) {
      const run = (pl: Plan, f: Record<string, unknown>, a: string, tag: string) => {
        ad.flows++;
        const r = d.adapt(pl, f, a);
        if (!r.ok) { ad.rejected++; return null; }
        const t1 = taperIssues(r.plan, a).filter((x) => !born.has(x.w)); // samo novo u odnosu na plan generatora
        if (t1.length) {
          ad.t1++;
          inc(ad.byScenario, tag);
          if (t1.some((x) => x.two)) ad.t1two++;
          if (t1.some((x) => x.contra)) ad.t1contra++;
          if (!warnText(r.plan).some((c) => /LONG_SHORTER|TAPER/.test(c))) ad.t1noWarn++;
          if (ad.ex.length < 6) ad.ex.push(`${b.id} / ${tag} / asOf ${a}: ${t1.map((x) => `ned ${x.w} ${x.q}>${x.L} min${x.two ? " (oba dana)" : ""}`).join(", ")}`);
        }
        return r.plan;
      };
      const p1 = run(p, d.facts(p, s, at), at, s);
      if (p1 && s === "chain") {
        const a2 = addDays(at, 7);
        if (a2 < p.input.raceDate) run(p1, d.chain2(p, a2), a2, "chain2");
      }
    }
}
console.log(JSON.stringify({ dist: name, step: { R: kR, F: kF, B: kB }, generator: gen, adaptation: ad }, null, 1));
