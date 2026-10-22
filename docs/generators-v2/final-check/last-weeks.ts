/* Faza 4 pre-final (22. 10.), zadatak 2d — adaptacija u poslednje 3 nedelje (taper / trkačka), svih 17 scenarija,
   asOf SVAKI dan od početka nedelje N − 2 do dana pred trku; 'chain' + drugi korak lib chain2 na asOf + 7 kad je pre trke.
   Iz web/: node ../docs/generators-v2/final-check/last-weeks.ts <5K|10K|HM|MAR> <kR> <kF> <kB> > out.json */

import { addDays, distOf, SCENARIOS, sampleBases } from "./lib.ts";
import { flow, print, tally } from "./pre-lib.ts";

const [name, kR, kF, kB] = [process.argv[2]!, ...process.argv.slice(3, 6).map(Number)] as [string, number, number, number];
const d = distOf(name);
const t0 = Date.now();
const { bases, excluded } = sampleBases(d, { R: kR, F: kF, B: kB });
const t = tally();
const byWeek: Record<string, number> = {};
let plans = 0;
for (const b of bases) {
  const g = d.generate(b.input);
  if (!g.ok) continue;
  plans++;
  const p = g.plan;
  const N = p.weeks.length;
  for (let at = p.weeks[N - 3]!.startDate; at < p.input.raceDate; at = addDays(at, 1)) {
    const wi = p.weeks.findIndex((w) => w.startDate <= at && at <= w.endDate) + 1;
    const tag = `N${wi - N === 0 ? "" : wi - N}/${p.weeks[wi - 1]!.phase}`;
    for (const s of SCENARIOS) {
      const f = d.facts(p, s, at);
      const before = t.rejectedFlows;
      const p1 = flow(d, t, p, f, at, `${b.id}/${tag}/asOf ${at}/${s}`, `${tag}/${s}`);
      if (t.rejectedFlows > before) byWeek[tag] = (byWeek[tag] ?? 0) + 1;
      if (p1 && s === "chain") {
        const at2 = addDays(at, 7);
        if (at2 < p.input.raceDate) flow(d, t, p1, d.chain2(p, at2), at2, `${b.id}/${tag}/asOf ${at}/chain2 ${at2}`, `${tag}/chain2`);
      }
    }
  }
}
print({ dist: name, step: { R: kR, F: kF, B: kB }, sampled: bases.length, excludedPermanent: excluded, plans, rejectedByWeek: byWeek, ...t, seconds: (Date.now() - t0) / 1000 });
