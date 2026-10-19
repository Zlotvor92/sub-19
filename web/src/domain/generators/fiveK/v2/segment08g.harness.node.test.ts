/* Segment 08g (5k-v2.8.0) — trajna rana mreža (odluka organizatora 4, pouka 23): uzorak Faze 4a (early.ts 5K 29 19
   11: 194 plana mreže testInputs.earlyGridInputs) × asOf start − 6/− 3/− 1, sreda i kraj svake nedelje 1 … N − 2 ×
   svih 17 scenarija + drugi korak lanca (asOf + 7) = 75 456 tokova + ponovljen umor (pouka 36: isti zapisi asOf + 1
   … + 7) = 104 800 tokova. Po toku, nezavisno od konstrukcije:
   - 0 odbijanja (konstruktor ne sastavlja ono što validator odbija);
   - testInputs.earlyChecks (Uslov 8): prošlost bajt-ista, prazan trening, dugi ≥ lagan, trkačka ≤ taper;
   - 'none' = generator (nedelje bajt-iste);
   - regresija prema f4b257d (segment08g.early-hashes-f4b257d.json, heš bez oznake verzije): tok van spiska
     promenjenih bajt-isti (zbir po planu); promenjen tok ima razlog — R odbijen na f4b257d (N2), N3 skraćena
     trkačka (raceRest), N4 konstruktor sa upisanim danima ≠ bez njih (testInputs.family08g), C drugi korak
     lanca posle promenjenog prvog, F ponovljen umor (pouka 36: na f4b257d novo rasterećenje za iste zapise).
   - pouka 36: posle umora isti zapisi ponovo asOf + 1 … + 7 → 0 novih rasterećenja.
   BRZ nivo: planovi BRZ_PLANOVI (imenovani primeri N2a, N2b, N3, N4 i po jedan R/F/B). PUN nivo: 4 dela po planu
   (segment08g.grid.node.test.ts deo 1, segment08g.{2,3,4}.full.node.test.ts). */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import {
  canonResult,
  earlyChecks,
  earlyFlows,
  earlyGridBases,
  family08g,
  type EarlyPlan
} from './testInputs.ts';

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

const REF = JSON.parse(
  readFileSync(new URL('./segment08g.early-hashes-f4b257d.json', import.meta.url), 'utf8')
) as {
  policyVersion: string;
  plans: Record<string, string>;
  changed: Record<string, { h: string; why: 'R' | 'N3' | 'N4' | 'C' | 'F' }>;
};
const hash = (r: unknown): string =>
  createHash('sha256').update(canonResult(r)).digest('hex').slice(0, 16);
/** Zbir nepromenjenih tokova plana: sha256 spiska „ključ:heš" sortiranog po ključu (kao fixture-08g.py). */
export const digest = (xs: [string, string][]): string =>
  createHash('sha256')
    .update(
      [...xs]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([k, h]) => `${k}:${h}`)
        .join('\n')
    )
    .digest('hex')
    .slice(0, 16);

/** Provere jednog plana (sve tvrdnje mreže); vraća spisak prekršaja. */
export function checkPlan(id: string, input: Record<string, unknown>): string[] {
  const bad: string[] = [];
  const flows = earlyFlows(id, input);
  const hs = new Map(flows.map((f) => [f.key, hash(f.res)] as const));
  const unchanged: [string, string][] = [];
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
    const ch = REF.changed[f.key];
    if (!ch) {
      unchanged.push([f.key, hs.get(f.key)!]);
      continue;
    }
    if (ch.h === hs.get(f.key)) bad.push(`${f.key}: na spisku promenjenih, a bajt-isti`);
    if (ch.why === 'N3' && !(f.res.plan.weeks[f.res.plan.weeks.length - 1]!.raceRest?.length ?? 0))
      bad.push(`${f.key}: N3 bez raceRest`);
    if (ch.why === 'N4' && family08g(f.plan, f.facts, f.asOf, f.res) !== 'N4')
      bad.push(`${f.key}: N4 bez razlike upisanih dana`);
    if (ch.why === 'C' && !REF.changed[f.key.slice(0, -2)])
      bad.push(`${f.key}: C bez promene koraka 1`);
    if (ch.why === 'F' && !f.key.includes('/fatigue/+'))
      bad.push(`${f.key}: F van ponovljenog umora`);
  }
  if (REF.plans[id] === undefined) bad.push(`${id}: nema u fixture-u`);
  else if (digest(unchanged) !== REF.plans[id])
    bad.push(`${id}: nepromenjeni tokovi nisu bajt-isti`);
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
      `${bases.length} planova: 0 odbijanja, Uslov 8, 'none' = generator, regresija prema f4b257d`,
      () => {
        expect(REF.policyVersion).toBe('5k-v2.7.0');
        const bad = bases.flatMap((b) => checkPlan(b.id, b.input));
        expect(bad.slice(0, 10)).toEqual([]);
      },
      GRID_TIMEOUT
    );
  });
}
