/* Segment 08g (5k-v2.8.0) — trajna rana mreža (odluka organizatora 4, pouka 23): uzorak Faze 4a (early.ts 5K 29 19
   11: 194 plana mreže testInputs.earlyGridInputs) × asOf start − 6/− 3/− 1, sreda i kraj svake nedelje 1 … N − 2 ×
   svih 17 scenarija + drugi korak lanca (asOf + 7) = 75 456 tokova + ponovljen umor (pouka 36: isti zapisi asOf + 1
   … + 7) = 104 800 tokova. Po toku, nezavisno od konstrukcije:
   - 0 odbijanja (konstruktor ne sastavlja ono što validator odbija);
   - testInputs.earlyChecks (Uslov 8): prošlost bajt-ista, prazan trening, dugi ≥ lagan, trkačka ≤ taper;
   - 'none' = generator (nedelje bajt-iste);
   - regresija (5K-09) prema c13c258 (segment09.x08g-c13c258.json, otisak bez korisničkog teksta): tok van spiska
     promenjenih bajt-isti (zbir po planu); promenjen tok nosi razlog segmenta 09 (segment09.harness). Ranije
     razloge prema f4b257d (N2, N3, N4, C, F, P, M, K) opisuju izveštaji SEGMENT-08g…08l.
   - pouka 36: posle umora isti zapisi ponovo asOf + 1 … + 7 → 0 novih rasterećenja.
   BRZ nivo: planovi BRZ_PLANOVI (imenovani primeri N2a, N2b, N3, N4 i po jedan R/F/B). PUN nivo: 4 dela po planu
   (segment08g.grid.node.test.ts deo 1, segment08g.{2,3,4}.full.node.test.ts). */

import { describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { ref09, regressGroup09 } from './segment09.harness.node.test.ts';
import { earlyChecks, earlyFlows, earlyGridBases, type EarlyPlan } from './testInputs.ts';

export const GRID_TIMEOUT = 300_000;
export const PARTS = 4;
/** Brz nivo: planovi imenovanih primera iz uzorka (N2a, N2b, N3, N4) + početnik sa rezultatom. */
export const BRZ_PLANOVI = [
  'f-d4-6w-30km-e420-0',
  'r-d5-14w-60km-v32-1',
  'r-d3-9w-20km-v45-1',
  'r-d3-13w-20km-v32-1',
  'b-d3-8w-25km-v36-0'
];

const REF = ref09('x08g');

/** Provere jednog plana (sve tvrdnje mreže); vraća spisak prekršaja. */
export function checkPlan(id: string, input: Record<string, unknown>): string[] {
  const bad: string[] = [];
  const flows = earlyFlows(id, input);
  for (const f of flows) {
    if (!f.res.ok) {
      const v = f.res.violations.filter((x) => x.severity === 'error').map((x) => x.rule);
      bad.push(`${f.key}: odbijeno ${v.join('+') || f.res.reasons.map((x) => x.code).join('+')}`);
      continue;
    }
    for (const x of earlyChecks(
      f.plan as unknown as EarlyPlan,
      f.res.plan as unknown as EarlyPlan,
      f.asOf,
      f.facts
    ))
      bad.push(`${f.key}: ${x}`);
    if (
      f.key.endsWith('/none') &&
      JSON.stringify(f.res.plan.weeks) !== JSON.stringify(f.plan.weeks)
    )
      bad.push(`${f.key}: 'none' ≠ generator`);
    // Pouka 36: isti zapisi umora ponovo (asOf + 1 … + 7) ne prave novo rasterećenje.
    const fresh = f.res.plan.weeks.filter((w, i) => w.deload && !f.plan.weeks[i]!.deload);
    if (f.key.includes('/fatigue/+') && fresh.length > 0)
      bad.push(
        `${f.key}: novo rasterećenje za iste zapise umora (ned ${fresh.map((w) => w.index).join(', ')})`
      );
  }
  // 5K-09: regresija prema c13c258 (otisak bez teksta; segment09.harness.regressGroup09).
  bad.push(...regressGroup09(REF, id, flows));
  return bad;
}

/** Deo mreže: BRZ — BRZ_PLANOVI; PUN — planovi i % PARTS === part − 1. */
export function describeEarlyGrid(label: string, part: number): void {
  const all = earlyGridBases();
  const bases = FULL
    ? all.filter((_, i) => i % PARTS === part - 1)
    : all.filter((b) => BRZ_PLANOVI.includes(b.id));
  describe(label, () => {
    it(
      `${bases.length} planova: 0 odbijanja, Uslov 8, 'none' = generator, regresija prema c13c258`,
      () => {
        expect(REF.against).toBe('c13c258');
        const bad = bases.flatMap((b) => checkPlan(b.id, b.input));
        expect(bad.slice(0, 10)).toEqual([]);
      },
      GRID_TIMEOUT
    );
  });
}
