/* Faza 4 pre-final (22. 10.), zadatak 2b — rezultat (faster/slower/test5k) i bol 5/8 ISTE nedelje.
   Nedelje 2 … N − 2 (svaka druga, od 2). U nedelji: rezultat i bol na dva dana u tri redosleda (rezultat pon + bol čet,
   bol pon + rezultat čet, oba čet); asOf = kasniji dan (čet) i kraj nedelje. Činjenice: lib facts scenarija rezultata
   (datum = dan rezultata) + bol (datum = dan bola), spojene. Iz web/:
   node ../docs/generators-v2/final-check/result-pain.ts <5K|10K|HM|MAR> <kR> <kF> <kB> > out.json */

import { addDays, distOf, sampleBases } from "./lib.ts";
import { flow, mergeFacts, print, tally } from "./pre-lib.ts";

const [name, kR, kF, kB] = [process.argv[2]!, ...process.argv.slice(3, 6).map(Number)] as [string, number, number, number];
const d = distOf(name);
const t0 = Date.now();
const { bases, excluded } = sampleBases(d, { R: kR, F: kF, B: kB });
const t = tally();
let plans = 0;
for (const b of bases) {
  const g = d.generate(b.input);
  if (!g.ok) continue;
  plans++;
  const p = g.plan;
  const N = p.weeks.length;
  for (let i = 2; i <= N - 2; i += 2) {
    const w = p.weeks[i - 1]!;
    const mon = w.startDate;
    const thu = addDays(mon, 3);
    const orders: [string, string, string][] = [
      ["R-pon/B-cet", mon, thu],
      ["B-pon/R-cet", thu, mon],
      ["oba-cet", thu, thu],
    ];
    for (const res of ["faster", "slower", "test5k"] as const)
      for (const lvl of [5, 8] as const)
        for (const [ord, dR, dP] of orders)
          for (const at of [thu, w.endDate]) {
            const f = mergeFacts(d.facts(p, res, dR), d.facts(p, lvl === 5 ? "pain5" : "pain8", dP));
            flow(d, t, p, f, at, `${b.id}/w${i}/${res}+pain${lvl}/${ord}/asOf ${at}`, `${res}+pain${lvl}/${ord}`);
          }
  }
}
print({ dist: name, step: { R: kR, F: kF, B: kB }, sampled: bases.length, excludedPermanent: excluded, plans, ...t, seconds: (Date.now() - t0) / 1000 });
