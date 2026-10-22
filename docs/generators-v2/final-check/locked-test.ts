/* Faza 4 pre-final (22. 10.), nalaz K1 na svim distancama — zaključan DAN TESTA + pauza 10/20, umor, bol 5/8.
   Planovi sa testom (dan testa: workout.kind 'test' ili segment 'test' — kao fatigue-testweek.ts), svaki k-ti ulaz mreže.
   asOf = svaki dan od test − 14 do test − 1; lockedDayIds = [datum dana testa]. Kontrola: isti tok bez zaključavanja.
   Iz web/: node ../docs/generators-v2/final-check/locked-test.ts <5K|10K|HM|MAR> [k] > out.json */

import { addDays, distOf, type Plan } from "./lib.ts";
import { flow, print, tally } from "./pre-lib.ts";

const name = process.argv[2]!;
const k = Number(process.argv[3] ?? 97);
const d = distOf(name);
const isTest = (x: { workout: { kind: string; segments?: { kind: string }[] } }): boolean =>
  x.workout.kind === "test" || (x.workout.segments ?? []).some((s) => s.kind === "test");
const t0 = Date.now();
const locked = tally();
const control = tally();
let plans = 0;
let twoTests = 0;
for (const [i, b] of d.all().entries()) {
  if (i % k !== 0) continue;
  const g = d.generate(b.input);
  if (!g.ok) continue;
  const p = g.plan as Plan;
  const td = p.weeks.flatMap((w) => w.days).find((x) => isTest(x as never));
  if (!td) continue;
  plans++;
  for (let o = 14; o >= 1; o--) {
    const at = addDays(td.date, -o);
    if (at < addDays(p.input.startDate, -1)) continue;
    for (const s of ["pause10", "pause20", "fatigue", "pain5", "pain8"] as const) {
      const f = d.facts(p, s, at);
      const key = `${b.id}/${s}/asOf ${at}/test ${td.date}`;
      flow(d, control, p, f, at, key, s);
      const q = flow(d, locked, p, { ...f, lockedDayIds: [td.date] }, at, `lock ${key}`, s);
      if (q && q.weeks.flatMap((w) => w.days).filter((x) => isTest(x as never)).length > 1) twoTests++;
    }
  }
}
print({ dist: name, k, plans, twoTestsAccepted: twoTests, locked, control, seconds: (Date.now() - t0) / 1000 });
