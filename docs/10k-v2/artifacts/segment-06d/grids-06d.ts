/* Segment 06d: heš svakog toka mreža 04 (sa drugim korakom lanca), P i R (isti tokovi i heš kao testovi
   adapt.node / painGrid / reliefGrid: testInputs.planHash06c) za kod u <koren>. Pokretanje iz web/:
     node ../docs/10k-v2/artifacts/segment-06d/grids-06d.ts <koren> <izlaz.json>
   Ulazi mreža (testInputs) uvek iz ovog repozitorijuma. */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [root, outFile] = process.argv.slice(2);
const V = `${resolve(root!)}/web/src/domain/generators/tenK/v2/`;
const T = await import(
  new URL('../../../../web/src/domain/generators/tenK/v2/testInputs.ts', import.meta.url).href
);
const { generateTenKV2 } = await import(V + 'generate.ts');
const { adaptTenKV2 } = await import(V + 'adapt.ts');
const { addDays } = await import(V + 'dates.ts');
const out: Record<string, number | string> = {};
const put = (k: string, r: any): void => {
  out[k] = r.ok ? T.planHash06c(r) : `X:${JSON.stringify(r.reasons).slice(0, 200)}`;
};
const chainFacts = (p: any, a2: string) => ({
  workouts: [
    ...T.runsIn(p, addDays(a2, -13), addDays(a2, -7)),
    ...T.runsIn(p, addDays(a2, -6), a2, 0.5)
  ],
  coverage: { from: addDays(a2, -13), to: a2, complete: true }
});
for (const b of T.adaptBases()) {
  const p0 = generateTenKV2(b.input).plan;
  for (const k of T.AS_OF_KINDS)
    for (const s of T.SCENARIOS) {
      const asOf = T.asOfOf(p0, k);
      let r = adaptTenKV2(p0, T.factsOf(p0, s, asOf), asOf);
      if (r.ok && s === 'chain') {
        const a2 = addDays(asOf, 7);
        r = adaptTenKV2(r.plan, chainFacts(r.plan, a2), a2);
      }
      put(`04/${b.id}/${k}/${s}`, r);
    }
}
for (const b of T.painGridBases()) {
  const p0 = generateTenKV2(b.input).plan;
  for (const c of T.painCases(b.id, p0))
    put(`P/${c.key}`, adaptTenKV2(p0, T.painFacts(c.asOf, c.level), c.asOf));
}
for (const b of T.reliefGridBases()) {
  const p0 = generateTenKV2(b.input).plan;
  for (const a of T.reliefAsOfs(p0))
    for (const s of T.RELIEF_SCENARIOS)
      put(`R/${b.id}/w${a.week}/${s}`, adaptTenKV2(p0, T.reliefFacts(p0, s, a.asOf), a.asOf));
}
writeFileSync(outFile!, JSON.stringify(out) + '\n');
console.log(Object.keys(out).length, 'tokova');
