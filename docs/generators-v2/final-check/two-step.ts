/* Faza 4 pre-final (22. 10.), zadatak 2a — dva koraka adaptacije sa RAZLIČITIM scenarijima (svih 17 × 17).
   Uzorak lib.sampleBases (bez trajnih mreža). Prvi korak: jedan asOf po planu, naizmenično po planu
   (sreda ned 2, kraj ned 3, sreda ned ⌊N/2⌋, kraj ned N − 4). Drugi korak: asOf + 3 i asOf + 7, na ADAPTIRANOM planu,
   činjenice scenarija s2 izračunate nad planom posle prvog koraka, u dva oblika:
   - new: samo nove činjenice s2 (kao lanac 'chain' u lib/early.ts);
   - cum: činjenice prvog koraka + s2 (kao dnevnik aplikacije koji raste; pre-lib.mergeFacts).
   'none' kao s2 u obliku new = adaptacija bez činjenica. Iz web/:
   node ../docs/generators-v2/final-check/two-step.ts <5K|10K|HM|MAR> <kR> <kF> <kB> > out.json */

import { addDays, distOf, SCENARIOS, sampleBases, wedOf } from "./lib.ts";
import { flow, mergeFacts, print, tally } from "./pre-lib.ts";

const [name, kR, kF, kB] = [process.argv[2]!, ...process.argv.slice(3, 6).map(Number)] as [string, number, number, number];
const d = distOf(name);
const t0 = Date.now();
const { bases, excluded } = sampleBases(d, { R: kR, F: kF, B: kB });
const first = tally();
const second = { new: tally(), cum: tally() };
let plans = 0;
for (const [bi, b] of bases.entries()) {
  const g = d.generate(b.input);
  if (!g.ok) continue;
  plans++;
  const p = g.plan;
  const N = p.weeks.length;
  const opts: [string, string][] = [
    ["w2wed", wedOf(p.weeks[1]!.startDate)],
    ["w3end", p.weeks[2]!.endDate],
    [`w${Math.floor(N / 2)}wed`, wedOf(p.weeks[Math.floor(N / 2) - 1]!.startDate)],
    [`w${N - 4}end`, p.weeks[N - 5]!.endDate],
  ];
  const [tag, at] = opts[bi % opts.length]!;
  for (const s1 of SCENARIOS) {
    const f1 = d.facts(p, s1, at);
    const p1 = flow(d, first, p, f1, at, `${b.id}/${tag}/${s1}`, s1);
    if (!p1) continue;
    for (const off of [3, 7]) {
      const at2 = addDays(at, off);
      if (at2 >= p.input.raceDate) continue;
      for (const s2 of SCENARIOS) {
        if (s2 === s1) continue;
        const f2 = d.facts(p1, s2, at2);
        const k = `${b.id}/${tag}/${s1}→+${off}/${s2}`;
        flow(d, second.new, p1, f2, at2, `new ${k}`, `${s1}→${s2}`);
        flow(d, second.cum, p1, mergeFacts(f1, f2), at2, `cum ${k}`, `${s1}→${s2}`);
      }
    }
  }
}
print({ dist: name, step: { R: kR, F: kF, B: kB }, sampled: bases.length, excludedPermanent: excluded, plans, first, second, seconds: (Date.now() - t0) / 1000 });
