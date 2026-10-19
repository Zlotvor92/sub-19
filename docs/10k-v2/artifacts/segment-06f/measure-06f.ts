/* Segment 06f: merenje pre/posle (pouka 15) — ponovljeni umor (pouka 36), traka (pouka 20), pouka 25, pouka 35.
   Pokretanje iz web/:
     node ../docs/10k-v2/artifacts/segment-06f/measure-06f.ts <izlaz.json> [<koren checkouta>]
   Planovi: uzorak Faze 4a early.ts 10K 193/97/29 (R grid02 3–6 d, F po osećaju 3–6 d, B početnik 3–4 d; pomak k/2,
   bez planova trajnih mreža). asOf: start − 1/− 3/− 6, sreda i kraj nedelja 1 … N − 2; 17 scenarija (testInputs.factsOf).
   Tok: a1 = adapt(plan, f, asOf); ponovo ISTE činjenice a1.plan → asOf + k (umor k = 1 … 7, ostali k = 1).
   Po toku: heš (planHash06c, bez oznake verzije), traka (staro pravilo aplikacije 7ba9717 — kopija neededOf — i, ako
   postoji, domen adaptBanner), broj rasterećenja. Pouka 25: WEEK_MIN_VOLUME / WEEK_MIN_REST u nedeljama sa danima
   bola bez odmora. Pouka 35: nedelje izgradnje (bez tapera i trkačke) sa 2 dana kvaliteta i danom kvaliteta dužim od
   dugog (trajanje) — generator i budućnost adaptiranih planova. */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [outArg, rootArg] = process.argv.slice(2);
const ROOT = resolve(
  rootArg ?? fileURLToPath(new URL("../../../../", import.meta.url)),
);
const V = `${ROOT}/web/src/domain/generators/tenK/v2/`;
const T = await import(`${V}testInputs.ts`);
const { generateTenKV2 } = await import(`${V}generate.ts`);
const AD = await import(`${V}adapt.ts`);
const { weekViews } = await import(`${V}app/adapt.ts`);
const { addDays } = await import(`${V}dates.ts`);
const adapt = AD.adaptTenKV2 as (p: unknown, f: unknown, a: string) => any;
const newBanner = AD.adaptBanner as
  undefined | ((b: any, r: any, f: any, a: string) => string[]);

const key = (i: unknown) => JSON.stringify(i);
const every = <X>(xs: readonly X[], k: number, off = 0): X[] =>
  xs.filter((_, i) => i % k === off);
const perm = new Set(
  [...T.earlyGridBases(), ...T.adaptBases()].map((b: any) => key(b.input)),
);
const fam: Record<string, any[]> = {
  R: ([3, 4, 5, 6] as const).flatMap((d) => T.grid02Inputs(d)),
  F: ([3, 4, 5, 6] as const).flatMap((d) => T.feelGridInputs(d)),
  B: ([3, 4] as const).flatMap((d) => T.beginnerGridInputs(d)),
};
const K: Record<string, number> = { R: 193, F: 97, B: 29 };
const bases = Object.entries(fam).flatMap(([f, xs]) =>
  every(xs, K[f]!, Math.floor(K[f]! / 2)).filter(
    (b) => !perm.has(key(b.input)),
  ),
);

/** Staro pravilo trake (10K v2 app/adapt.ts neededOf + changedWeeks na 7ba9717), doslovna kopija. */
const BANNER = new Set([
  "PAIN",
  "PAUSE",
  "FATIGUE",
  "NEW_RESULT",
  "UNDER_EXECUTION",
  "OVER_EXECUTION",
]);
function oldBanner(before: any, r: any, facts: any, today: string): string[] {
  if (!r.ok) return [];
  const b = weekViews(before);
  const a = weekViews(r.plan);
  const ids = new Set<number>(
    r.changes.filter((c: any) => c.week > 0).map((c: any) => c.week),
  );
  for (const [w, v] of a)
    if (JSON.stringify(v) !== JSON.stringify(b.get(w))) ids.add(w);
  const weeks = [...ids].filter(
    (w) => ((a.get(w)?.end ?? b.get(w)?.end ?? "") as string) > today,
  );
  const last = before.adaptation?.asOf ?? null;
  if ((last !== null && last >= today) || weeks.length === 0) return [];
  const painDates = ((facts.workouts ?? []) as any[])
    .filter((w) => (w.pain ?? 0) >= 4)
    .map((w) => w.date);
  const newPain = painDates.some((d) => last === null || d > last);
  return r.reasons
    .filter(
      (x: any) =>
        x.applied &&
        BANNER.has(x.condition) &&
        (x.condition !== "PAIN" || newPain),
    )
    .map((x: any) => x.message);
}

const BUILD = new Set(["base", "development", "specific"]);
/** Pouka 35: nedelje izgradnje sa 2+ dana kvaliteta i danom kvaliteta dužim od dugog (posle `after`). */
function p35(plan: any, after: string | null): string[] {
  const out: string[] = [];
  for (const w of plan.weeks) {
    if (!BUILD.has(w.phase) || (after !== null && w.endDate <= after)) continue;
    const q = w.days.filter((d: any) => d.workout.kind === "quality");
    const long = w.days.find((d: any) => d.role === "long");
    if (
      q.length >= 2 &&
      long &&
      q.some((d: any) => d.workout.sec > long.workout.sec)
    )
      out.push(`${w.index}${w.deload ? "d" : ""}`);
  }
  return out;
}
/** Pouka 25: nedelja sa danima bola bez odmora, planirano < minimum (pravilo WEEK_MIN_*). */
function p25(plan: any): string[] {
  const out: string[] = [];
  for (const w of plan.weeks) {
    const pain =
      (w.limits?.pain ?? []).length > 0 && (w.limits?.rest ?? []).length === 0;
    if (!pain) continue;
    for (const v of plan.warnings)
      if (v.week === w.index && /^WEEK_MIN/.test(v.rule))
        out.push(`${w.index}:${v.rule}`);
  }
  return out;
}

const dl = (p: any) => p.weeks.filter((w: any) => w.deload).length;
const out: any = {
  root: ROOT,
  plans: 0,
  flows: 0,
  rejected: 0,
  rejectedEx: [],
  p35gen: {},
  p35adapt: {},
  p25: {},
  flowsData: {},
};
const t0 = Date.now();
for (const b of bases) {
  const g = generateTenKV2(b.input);
  if (!g.ok) continue;
  out.plans++;
  const p = g.plan;
  const g35 = p35(p, null);
  if (g35.length) out.p35gen[b.id] = g35;
  const N = p.weeks.length;
  const asOfs: [string, string][] = [1, 3, 6].map((k) => [
    `pre${k}`,
    addDays(p.input.startDate, -k),
  ]);
  for (let i = 1; i <= N - 2; i++) {
    const w = p.weeks[i - 1];
    asOfs.push([`w${i}wed`, addDays(w.startDate, 2)], [`w${i}end`, w.endDate]);
  }
  for (const [tag, at] of asOfs)
    for (const s of T.SCENARIOS) {
      const k0 = `${b.id}/${tag}/${s}`;
      const f = T.factsOf(p, s, at);
      const run = (before: any, asOf: string, k: string) => {
        out.flows++;
        const r = adapt(before, f, asOf);
        if (!r.ok) {
          out.rejected++;
          if (out.rejectedEx.length < 5)
            out.rejectedEx.push(
              `${k}: ${JSON.stringify(r.reasons).slice(0, 200)}`,
            );
          out.flowsData[k] = { h: T.planHash06c(r) };
          return null;
        }
        const x: any = {
          h: T.planHash06c(r),
          dl: dl(r.plan),
          old: oldBanner(before, r, f, asOf).length,
        };
        if (newBanner) x.nb = newBanner(before, r, f, asOf).length;
        const a35 = p35(r.plan, asOf);
        if (a35.length) out.p35adapt[k] = a35;
        const a25 = p25(r.plan);
        if (a25.length) out.p25[k] = a25;
        out.flowsData[k] = x;
        return r;
      };
      const r1 = run(p, at, k0);
      if (!r1) continue;
      const reps = s === "fatigue" ? [1, 2, 3, 4, 5, 6, 7] : [1];
      for (const d of reps) {
        const at2 = addDays(at, d);
        if (at2 >= p.input.raceDate) continue;
        run(r1.plan, at2, `${k0}/+${d}`);
      }
    }
}
out.seconds = (Date.now() - t0) / 1000;
writeFileSync(outArg!, JSON.stringify(out));
console.log({
  plans: out.plans,
  flows: out.flows,
  rejected: out.rejected,
  p35gen: Object.keys(out.p35gen).length,
  p35adapt: Object.keys(out.p35adapt).length,
  p25: Object.keys(out.p25).length,
  s: out.seconds,
});
