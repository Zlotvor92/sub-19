/* Mreža 02 (planovi sa rezultatom): dana 3/4/5/6 × nedelje 8–18 × obim po broju dana (D17, korak 5 km) ×
   VDOT {30..70} × 3 rasporeda × trka sub/ned = 15 840 planova: 0 odbijanja, 0 grešaka validatora,
   deterministički, = bazna linija segment03.baseline.json (10k-v2.3.0). Invarijante nezavisno od validatora
   (gridInvariants.ts). Regresija prema 21c03f1 (10k-v2.2.1): redovi segment02b.baseline.json i heševi
   celih planova segment03.plan-hashes-21c03f1.json; promena samo od D30a (RP deonice ≥ 800 m) ili D30b
   (Uslov 8 trkačke nedelje sa trkom). Vrh prema 49ad476 (segment02.baseline.json): niži samo u 12 planova. */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { addDays, weekdayOf } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import {
  checkPlan,
  DAYS,
  type Days,
  emptyStats,
  type GridStats,
  type Row,
  statsRow,
  summaryRow
} from './gridInvariants.ts';
import { fnv1a, grid02Inputs, planHashes21 } from './testInputs.ts';
import type { TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import { repsOf } from './workouts.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'segment03.baseline.json');
const BASELINE_21 = join(HERE, 'segment02b.baseline.json');
const BASELINE_49 = join(HERE, 'segment02.baseline.json');
const HASHES_21 = join(HERE, 'segment03.plan-hashes-21c03f1.json');
const EXCEPTIONS = join(HERE, 'segment03.regression-exceptions.json');
const EPS = 1e-9;

type Baseline = { policyVersion: string; plans: Record<string, Row> };
type Exceptions = {
  against: string;
  reasons: Record<string, string>;
  plans: Record<string, string>;
};

/** D30a marker u NOVOM planu: RP deonica < 1000 m (10k-v2.2.1 ih nije imao, D22b). */
const rpBelow1000 = (p: TenKV2Plan): boolean =>
  p.weeks.some((w) =>
    w.days.some((d) => {
      const s = d.workout.dose?.zone === 'RP' ? d.workout.dose.structure : null;
      return !!s && repsOf(s).some((m) => m < 1000);
    })
  );

describe('mreža 02 sa rezultatom: 15 840 planova (3/4/5/6 dana × 8–18 ned)', () => {
  const inputs = DAYS.flatMap((n) => grid02Inputs(n));
  const rows: Record<string, Row> = {};
  const hashes: number[] = [];
  const rejected: string[] = [];
  const errors: Record<string, number> = {};
  const bad: Record<string, string[]> = {};
  const stats = {} as Record<Days, GridStats>;
  for (const n of DAYS) stats[n] = emptyStats();
  const reg: Record<
    string,
    { days: Days; h: [number, number]; rp800: boolean; capacity: boolean; rws: boolean }
  > = {};
  for (const { id, days, input } of inputs) {
    const n = days as Days;
    const r = generateTenKV2(input);
    hashes.push(fnv1a(JSON.stringify(r)));
    if (!r.ok) {
      rejected.push(`${id}: ${r.reasons.map((x) => x.code).join(',')}`);
      continue;
    }
    for (const v of validatePlan(r.plan))
      if (v.severity === 'error') errors[v.rule] = (errors[v.rule] ?? 0) + 1;
    rows[id] = summaryRow(r.plan);
    checkPlan(id, n, r.plan, bad, stats[n]);
    reg[id] = {
      days: n,
      h: planHashes21(r),
      rp800: rpBelow1000(r.plan),
      capacity: r.plan.warnings.some((x) => x.rule === 'CAPACITY_LIMITED'),
      rws: r.plan.warnings.some((x) => x.rule === 'RACE_WEEK_SHORT')
    };
  }

  it('15 840 ulaza, 0 odbijanja, 0 grešaka validatora (BASE_PLATEAU 0)', () => {
    expect(inputs.length).toBe(15840);
    expect(DAYS.map((n) => grid02Inputs(n).length)).toEqual([2640, 3696, 4224, 5280]);
    expect(new Set(inputs.map((g) => g.id)).size).toBe(15840);
    expect(rejected.slice(0, 20)).toEqual([]);
    expect(errors).toEqual({});
  });

  it('deterministički: drugo generisanje daje bajt-isti rezultat', () => {
    const again = inputs.map(({ input }) => fnv1a(JSON.stringify(generateTenKV2(input))));
    expect(again).toEqual(hashes);
  });

  it('invarijante (nezavisno od validatora): sve iz 02b + T ≥ 1000 m i RP ≥ 800 m (D30a), trkačka + trka ≥ minimum (D30b), 0 testova, paceBasis result, bez RPE', () => {
    const summaryBad = Object.fromEntries(
      Object.entries(bad).map(([k, v]) => [k, `${v.length}: ${v.slice(0, 3).join(' | ')}`])
    );
    expect(summaryBad).toEqual({});
  });

  it('D30a: ponavljanje slota 1224 / 192 / 144 / 144 → 240 / 48 / 0 / 0 nedelja (organizator na 21c03f1: isto)', () => {
    expect(DAYS.map((n) => stats[n].repeats)).toEqual([240, 48, 0, 0]);
  });

  it('D30b: RACE_WEEK_SHORT 6 + 90 → 0 (trkačka + trka 10 km ≥ minimum nedelje)', () => {
    expect(DAYS.map((n) => stats[n].raceShort)).toEqual([0, 0, 0, 0]);
    expect(Object.values(reg).filter((x) => x.rws).length).toBe(0);
  });

  it('bez promene od 21c03f1: ned 1 ispod obima samo uz 105 min, trkačka ≤ taper (lagan u km), D25, DOSE_DROPPED', () => {
    expect(DAYS.map((n) => stats[n].belowTime)).toEqual([330, 660, 264, 264]);
    // 02b: ned 1 ispod obima i DOSE_DROPPED SAMO uz dugi na 105 min (nikad samo na udelu D17).
    expect(DAYS.map((n) => [stats[n].belowShare, stats[n].doseDroppedShare])).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0]
    ]);
    expect(DAYS.map((n) => stats[n].raceKmEasy)).toEqual([636, 1428, 2004, 2538]);
    expect(DAYS.map((n) => stats[n].longShorter)).toEqual([0, 132, 132, 330]);
    expect(DAYS.map((n) => stats[n].doseDropped)).toEqual([0, 162, 0, 0]);
  });

  it('brojke po broju dana (izveštaj): CAPACITY_LIMITED, ponavljanja, vrh/start, odstupanja', () => {
    // 10k-v2.2.1: [2640, 828, 1224, 1.258, 528, 0, 48, 6], [3696, 1320, 192, 1.25, …],
    // [4224, 810, 144, 1.279, …], [5280, 732, 144, 1.25, 0, 6, 0, 90].
    expect(DAYS.map((n) => statsRow(stats[n]))).toEqual([
      [2640, 828, 240, 1.259, 528, 0, 48, 0],
      [3696, 1320, 48, 1.25, 0, 0, 0, 0],
      [4224, 810, 0, 1.279, 0, 0, 0, 0],
      [5280, 732, 0, 1.25, 0, 6, 0, 0]
    ]);
  });

  it('kratka priprema (D21): 8 ned BBDDSSTR, 9 ned BBDDDSSTR, tačno jedno rasterećenje (ned 4)', () => {
    for (const [id, row] of Object.entries(rows)) {
      if (id.includes('-8w-')) expect([row[4], row[5]], id).toEqual(['BBDDSSTR', [4]]);
      if (id.includes('-9w-')) expect([row[4], row[5]], id).toEqual(['BBDDDSSTR', [4]]);
    }
  });

  it('generisanje daje TAČNO baznu liniju segment03.baseline.json', () => {
    if (process.env['TEN_K_V2_WRITE_BASELINE'] === '1')
      writeFileSync(BASELINE, JSON.stringify({ policyVersion: '10k-v2.3.0', plans: rows }) + '\n');
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
    expect(base.policyVersion).toBe('10k-v2.3.0');
    expect(Object.keys(base.plans).length).toBe(15840);
    expect(rows).toEqual(base.plans);
  });

  it('regresija (pouka 1): vrh cilj i vrh planirano ≥ 21c03f1 za svih 15 840; niže samo uz razlog iz fajla, koji se proverava', () => {
    const old = JSON.parse(readFileSync(BASELINE_21, 'utf8')) as Baseline;
    expect(old.policyVersion).toBe('10k-v2.2.1');
    expect(Object.keys(old.plans).length).toBe(15840);
    const lower: Record<string, string> = {};
    for (const [id, r0] of Object.entries(old.plans)) {
      const r = rows[id]!;
      if (r[0] >= r0[0] && r[1] >= r0[1]) continue;
      // ROUNDING: isti vrh cilja, planirano niže u okviru tolerancije 0,1 km (druga RP struktura, D30a).
      lower[id] = r[0] < r0[0] ? 'PEAK_LOWER' : 'ROUNDING';
    }
    if (process.env['TEN_K_V2_WRITE_BASELINE'] === '1') {
      const ex = JSON.parse(readFileSync(EXCEPTIONS, 'utf8')) as Exceptions;
      writeFileSync(EXCEPTIONS, JSON.stringify({ ...ex, plans: lower }) + '\n');
    }
    const ex = JSON.parse(readFileSync(EXCEPTIONS, 'utf8')) as Exceptions;
    expect(ex.against).toBe('21c03f1');
    expect(Object.keys(ex.reasons)).toEqual(['ROUNDING']);
    expect(ex.plans).toEqual(lower);
    const why = Object.entries(lower).filter(([id, reason]) => {
      const [r0, r] = [old.plans[id]!, rows[id]!];
      return reason !== 'ROUNDING' || r[0] !== r0[0] || r0[1] - r[1] > 0.1 + EPS || !reg[id]!.rp800;
    });
    expect(why).toEqual([]);
    const count = (n: Days): number =>
      Object.keys(lower).filter((id) => reg[id]!.days === n).length;
    expect(DAYS.map(count)).toEqual([108, 0, 0, 0]);
    // Vrh cilja viši od 21c03f1 (D30a: druga RP struktura nosi kapacitet).
    const higher = (n: Days): number =>
      Object.entries(old.plans).filter(([id, r0]) => reg[id]!.days === n && rows[id]![0] > r0[0])
        .length;
    expect(DAYS.map(higher)).toEqual([120, 126, 0, 0]);
  });

  it('vrh cilja niži od 49ad476: 258 → 12 (3 dana, 30 km, VDOT 35, 17–18 ned: 35,6 → 35,2)', () => {
    const old = JSON.parse(readFileSync(BASELINE_49, 'utf8')) as Baseline;
    expect(old.policyVersion).toBe('10k-v2.2.0');
    const lower = Object.entries(old.plans)
      .filter(([id, r0]) => rows[id]![0] < r0[0])
      .map(([id, r0]) => `${id.replace(/-[ABC]-(sat|sun)$/, '')}: ${r0[0]} → ${rows[id]![0]}`);
    expect(lower.length).toBe(12);
    expect([...new Set(lower)]).toEqual([
      'd3-17w-30km-v35: 35.6 → 35.2',
      'd3-18w-30km-v35: 35.6 → 35.2'
    ]);
  });

  it('regresija: ceo plan isti kao 21c03f1 (bez oznake verzije i podrazumevanih novih polja) ili promenjen SAMO od D30a ili D30b', () => {
    const fx = JSON.parse(readFileSync(HASHES_21, 'utf8')) as {
      against: string;
      plans: Record<string, [number, number, number]>;
    };
    expect(fx.against).toBe('21c03f1');
    expect(Object.keys(fx.plans).sort()).toEqual(Object.keys(reg).sort());
    const zero = (): Record<string, number> => ({ same: 0, D30a: 0, D30b: 0, 'D30a+D30b': 0 });
    const cause: Record<Days, Record<string, number>> = {
      3: zero(),
      4: zero(),
      5: zero(),
      6: zero()
    };
    const other: string[] = [];
    for (const [id, x] of Object.entries(reg)) {
      const [h0, noRws0, rws0] = fx.plans[id]!;
      const c = cause[x.days];
      // D30b uklanja samo upozorenje RACE_WEEK_SHORT; D30a daje RP deonicu < 1000 m.
      if (x.h[0] === h0) c['same']!++;
      else if (rws0 === 1 && x.h[0] === noRws0) c['D30b']!++;
      else if (x.rp800) c[rws0 === 1 ? 'D30a+D30b' : 'D30a']!++;
      else other.push(id);
    }
    expect(other).toEqual([]);
    expect(cause).toEqual({
      3: { same: 1500, D30a: 1134, D30b: 6, 'D30a+D30b': 0 },
      4: { same: 3120, D30a: 576, D30b: 0, 'D30a+D30b': 0 },
      5: { same: 3792, D30a: 432, D30b: 0, 'D30a+D30b': 0 },
      6: { same: 5064, D30a: 126, D30b: 72, 'D30a+D30b': 18 }
    });
  });

  it('D20 trkačka nedelja (6 dana): otpada dugi, pa najraniji lagan dan', () => {
    const r = generateTenKV2(grid02Inputs(6).find((g) => g.id === 'd6-12w-50km-v45-B-sat')!.input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w = r.plan.weeks.at(-1)!;
    // Nedelja ned–sub, trka sub (nije dan trčanja): dani ned, pon, uto, sre, čet, pet → otpadaju ned (dugi)
    // i pon (najraniji lagan); ostaju uto, sre, čet, pet + trka.
    expect(w.days.map((d) => `${d.weekday}:${d.role}`)).toEqual([
      'tue:easy',
      'wed:sharpener',
      'thu:easy',
      'fri:eve',
      'sat:race'
    ]);
    expect(weekdayOf(addDays(w.startDate, 6))).toBe('sat');
  });
});
