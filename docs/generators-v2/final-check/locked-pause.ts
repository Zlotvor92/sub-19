/* Faza 4 pre-final (22. 10.), zadatak 2c — zaključan dan + pauza 10/20 preko njega.
   asOf: sreda i kraj nedelja 3 … N − 3. Pauza: lib 'pause10' (zaključena iz pokrivenosti) i 'pause20' (eksplicitna).
   Zaključan dan (lockedDayIds = datum dana plana):
   - in: dan trčanja UNUTAR pauze (prošlost, srednji takav dan);
   - q: prvi dan kvaliteta posle asOf (pravilo pauze ga briše/smanjuje);
   - long: prvi dugi posle asOf;
   - in+q: oba.
   Iz web/: node ../docs/generators-v2/final-check/locked-pause.ts <5K|10K|HM|MAR> <kR> <kF> <kB> > out.json */

import { addDays, distOf, sampleBases, wedOf } from "./lib.ts";
import { flow, print, tally } from "./pre-lib.ts";

const [name, kR, kF, kB] = [process.argv[2]!, ...process.argv.slice(3, 6).map(Number)] as [string, number, number, number];
const d = distOf(name);
const t0 = Date.now();
const { bases, excluded } = sampleBases(d, { R: kR, F: kF, B: kB });
const t = tally();
let plans = 0;
let skipped = 0;
for (const b of bases) {
  const g = d.generate(b.input);
  if (!g.ok) continue;
  plans++;
  const p = g.plan;
  const N = p.weeks.length;
  const days = p.weeks.flatMap((w) => w.days);
  for (let i = 3; i <= N - 3; i++) {
    const w = p.weeks[i - 1]!;
    for (const at of [wedOf(w.startDate), w.endDate])
      for (const [s, len] of [["pause10", 10], ["pause20", 20]] as const) {
        const from = addDays(at, -(len - 1));
        const inside = days.filter((x) => x.date >= from && x.date <= at && x.countsToWeek && x.role !== "race");
        const lin = inside[inside.length >> 1]?.date;
        const lq = days.find((x) => x.date > at && (x.role === "q1" || x.role === "q2" || (x.hard && !["long", "race"].includes(x.role))))?.date;
        const ll = days.find((x) => x.date > at && x.role === "long")?.date;
        const variants: [string, (string | undefined)[]][] = [
          ["in", [lin]],
          ["q", [lq]],
          ["long", [ll]],
          ["in+q", [lin, lq]],
        ];
        for (const [v, ids] of variants) {
          if (ids.some((x) => !x)) {
            skipped++;
            continue;
          }
          const f = { ...d.facts(p, s, at), lockedDayIds: ids as string[] };
          flow(d, t, p, f, at, `${b.id}/w${i}/${s}/lock-${v} ${ids.join(",")}/asOf ${at}`, `${s}/lock-${v}`);
        }
      }
  }
}
print({ dist: name, step: { R: kR, F: kF, B: kB }, sampled: bases.length, excludedPermanent: excluded, plans, skippedNoDay: skipped, ...t, seconds: (Date.now() - t0) / 1000 });
