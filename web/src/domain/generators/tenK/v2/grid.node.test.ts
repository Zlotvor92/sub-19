/* Mreža segmenta 01: nedelje 10–18 × obim {25..55} × VDOT {30..70} × 3 rasporeda × trka sub/ned
   = 3024 plana: 0 grešaka validatora, 0 odbijanja, deterministički; bazna linija za segment 02.
   Segment 01b: nedelja 1 ispod trenutnog obima samo zbog dugog na 105 min; regresija vrha prema
   baznoj liniji 26846d7 (izuzeci sa razlogom u segment01b.regression-exceptions.json). */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { gridInputs, inputOf, SCHEDULES } from './testInputs.ts';
import type { TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'segment01.baseline.json');
const BASELINE_01 = join(HERE, 'segment01.baseline-26846d7.json');
const EXCEPTIONS = join(HERE, 'segment01b.regression-exceptions.json');
const LETTER = { base: 'B', development: 'D', specific: 'S', taper: 'T', race: 'R' } as const;

type Row = [number, number, number, number, string, number[]];
type Baseline = { policyVersion: string; plans: Record<string, Row> };

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

/** Nedelja 1: cilj, trenutni obim, dugi i plafon dugog od 105 min sporim E (nezavisno od koda). */
interface Week1 {
  targetKm: number;
  startKm: number;
  longKm: number;
  longTimeCapKm: number;
}

describe('mreža 3024 plana', () => {
  const grid = gridInputs();
  const rows: Record<string, Row> = {};
  const week1: Record<string, Week1> = {};
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
    const w = r.plan.weeks[0]!;
    week1[id] = {
      targetKm: w.targetKm,
      startKm: r.plan.input.currentWeeklyKm,
      longKm: w.days.find((d) => d.role === 'long')!.workout.km,
      longTimeCapKm: Math.floor((105 * 60 * 10) / r.plan.paces.E.slow + 1e-9) / 10
    };
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

  it('nedelja 1 < trenutni obim SAMO kad je dugi nedelje 1 na plafonu 105 min (kapacitet), nikad zbog 33 %/lestvice', () => {
    const below = Object.entries(week1).filter(([, w]) => w.targetKm < w.startKm);
    const notCapacity = below
      .filter(([, w]) => w.longKm !== w.longTimeCapKm)
      .map(
        ([id, w]) => `${id}: ${w.targetKm} < ${w.startKm}, dugi ${w.longKm} < ${w.longTimeCapKm}`
      );
    expect(notCapacity.slice(0, 10)).toEqual([]);
    // 10k-v2.1.0: 540 planova (bilo 1620), najveći pad 15,8 km (bilo 24,6).
    expect(below.length).toBe(540);
    expect(Math.max(...below.map(([, w]) => Math.round((w.startKm - w.targetKm) * 10)))).toBe(158);
  });

  it('generisanje daje TAČNO baznu liniju segment01.baseline.json', () => {
    if (process.env['TEN_K_V2_WRITE_BASELINE'] === '1')
      writeFileSync(BASELINE, JSON.stringify({ policyVersion: '10k-v2.1.0', plans: rows }) + '\n');
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
    expect(base.policyVersion).toBe('10k-v2.1.0');
    expect(Object.keys(base.plans).length).toBe(3024);
    expect(rows).toEqual(base.plans);
  });

  it('regresija (pouka 1): vrh cilj i vrh planirano ≥ 26846d7, izuzeci samo uz razlog iz fajla', () => {
    const old = JSON.parse(readFileSync(BASELINE_01, 'utf8')) as Baseline;
    const ex = JSON.parse(readFileSync(EXCEPTIONS, 'utf8')) as {
      against: string;
      reasons: Record<string, string>;
      plans: Record<string, string>;
    };
    expect(old.policyVersion).toBe('10k-v2.0.0');
    expect(ex.against).toBe('26846d7');
    const lower: Record<string, string> = {};
    const bad: string[] = [];
    for (const [id, [t, pl]] of Object.entries(rows)) {
      const [t0, pl0] = old.plans[id]!;
      if (t >= t0 && pl >= pl0) continue;
      const reason = ex.plans[id];
      lower[id] = reason ?? '';
      if (!reason || !ex.reasons[reason]) bad.push(`${id}: ${t0}/${pl0} → ${t}/${pl} bez razloga`);
      // Zaokruženje: isti vrh cilja, planirano u tehničkoj toleranciji (±0,1 km) od cilja.
      else if (reason === 'PLANNED_ROUNDING' && (t !== t0 || Math.abs(pl - t) > 0.1 + 1e-9))
        bad.push(`${id}: PLANNED_ROUNDING, a vrh cilja ${t0} → ${t}`);
      else if (reason === 'T_REPS_1000' && !(t < t0 && id.includes('-30km-v30-')))
        bad.push(`${id}: T_REPS_1000 van 30 km / VDOT 30`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
    // Fajl ne sme da nosi izuzetak koji više nije regresija.
    expect(Object.keys(ex.plans).sort()).toEqual(Object.keys(lower).sort());
    const count = (r: string): number => Object.values(lower).filter((x) => x === r).length;
    expect([count('PLANNED_ROUNDING'), count('T_REPS_1000')]).toEqual([564, 36]);
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
