/* Segment 08g: razlog promene po toku trajne rane mreže na TEKUĆEM stablu — 'N3' (raceRest), 'N4'
   (testInputs.family08g). Iz korena repoa: node docs/5k-v2/artifacts/segment-08g/why-08g.ts <izlaz.json> */
import { writeFileSync } from 'node:fs';
import { earlyFlows, earlyGridBases, family08g } from '../../../../web/src/domain/generators/fiveK/v2/testInputs.ts';


const out: Record<string, string> = {};
for (const b of earlyGridBases())
  for (const f of earlyFlows(b.id, b.input)) {
    const w = family08g(f.plan, f.facts, f.asOf, f.res);
    if (w) out[f.key] = w;
  }
writeFileSync(process.argv[2]!, JSON.stringify(out));
console.log(Object.keys(out).length);
