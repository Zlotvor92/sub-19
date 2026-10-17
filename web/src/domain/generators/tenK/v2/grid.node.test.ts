/* Mreža segmenta 01: nedelje 10–18 × obim {25..55} × VDOT {30..70} × 3 rasporeda × trka sub/ned
   = 3024 plana: 0 grešaka validatora, 0 odbijanja, deterministički; bazna linija za segment 02. */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { gridInputs, inputOf, SCHEDULES } from './testInputs.ts';
import type { TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const BASELINE = join(dirname(fileURLToPath(import.meta.url)), 'segment01.baseline.json');
const LETTER = { base: 'B', development: 'D', specific: 'S', taper: 'T', race: 'R' } as const;

type Row = [number, number, number, number, string, number[]];

/** Vrh cilj/planirano, najduži dugi, najveća glavna doza [km], niz faza, rasteretne nedelje. */
function summary(p: TenKV2Plan): Row {
  const build = p.weeks.filter(
    (w) => w.phase === 'base' || w.phase === 'development' || w.phase === 'specific'
  );
  const peak = build.reduce((a, w) => (w.targetKm > a.targetKm ? w : a), build[0]!);
  const longest = Math.max(
    ...p.weeks.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
  );
  const main = Math.max(
    ...p.weeks.map((w) =>
      w.days.reduce(
        (a, d) =>
          a + Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.RP) * 1000),
        0
      )
    )
  );
  return [
    peak.targetKm,
    peak.plannedKm,
    longest,
    main / 1000,
    p.weeks.map((w) => LETTER[w.phase]).join(''),
    p.weeks.filter((w) => w.deload).map((w) => w.index)
  ];
}

/** FNV-1a nad JSON-om plana (determinizam bez čuvanja 3024 plana u memoriji dvaput). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

describe('mreža 3024 plana', () => {
  const grid = gridInputs();
  const rows: Record<string, Row> = {};
  const hashes: number[] = [];
  let rejected: string[] = [];
  let errors: string[] = [];
  for (const { id, input } of grid) {
    const r = generateTenKV2(input);
    hashes.push(hash(JSON.stringify(r)));
    if (!r.ok) {
      rejected.push(`${id}: ${r.reasons.map((x) => x.code).join(',')}`);
      continue;
    }
    errors = errors.concat(
      validatePlan(r.plan)
        .filter((v) => v.severity === 'error')
        .map((v) => `${id}: ${v.rule}`)
    );
    rows[id] = summary(r.plan);
  }
  rejected = rejected.slice(0, 20);

  it('3024 ulaza, 0 odbijanja, 0 grešaka validatora', () => {
    expect(grid.length).toBe(3024);
    expect(new Set(grid.map((g) => g.id)).size).toBe(3024);
    expect(rejected).toEqual([]);
    expect(errors.slice(0, 20)).toEqual([]);
  });

  it('deterministički: drugo generisanje daje bajt-isti rezultat', () => {
    const again = grid.map(({ input }) => hash(JSON.stringify(generateTenKV2(input))));
    expect(again).toEqual(hashes);
  });

  it('generisanje daje TAČNO baznu liniju segment01.baseline.json', () => {
    if (process.env['TEN_K_V2_WRITE_BASELINE'] === '1')
      writeFileSync(BASELINE, JSON.stringify({ policyVersion: '10k-v2.0.0', plans: rows }) + '\n');
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as {
      policyVersion: string;
      plans: Record<string, Row>;
    };
    expect(base.policyVersion).toBe('10k-v2.0.0');
    expect(Object.keys(base.plans).length).toBe(3024);
    expect(rows).toEqual(base.plans);
  });

  it('van mreže (gusto: VDOT 30–40 × 25–55 km korak 1, 12/14/16/18 ned): 0 odbijanja, 0 grešaka', () => {
    const bad: string[] = [];
    for (const weeks of [12, 14, 16, 18])
      for (let km = 25; km <= 55; km++)
        for (let vdot = 30; vdot <= 40; vdot++) {
          const r = generateTenKV2(inputOf({ weeks, km, vdot, days: SCHEDULES.A.days }));
          if (!r.ok) bad.push(`${weeks}w ${km}km v${vdot}: ${r.reasons[0]!.code}`);
          else if (validatePlan(r.plan).some((v) => v.severity === 'error'))
            bad.push(`${weeks}w ${km}km v${vdot}: greška`);
        }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});
