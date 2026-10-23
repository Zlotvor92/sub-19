/* Segment 06c (10k-v2.5.0, A17): redovno rasterećenje odmah posle nedelje smanjenja otpada. Mreža R
   (testInputs.reliefGridBases: 252 R + 20 F + 20 B planova × asOf kraj ned 2…N − 4 × 7 scenarija = 18 193
   tokova): regresija prema 4917959 (segment06c.adapt-hashes-4917959.json; heš bez oznake verzije i polja
   reduced), invarijante J1–J5 NEZAVISNO od steps.ts i volume.ts (nedelje smanjenja iz polja koraka,
   rasterećenja iz baznog plana, brojevi iz policy.ts), primeri iz nalaza N1, nekadašnji sudar (12 i 17 ned),
   višak + bol, umor + bol, nov start, korak sačuvan pre 10k-v2.5.0. */

import { describe, expect, it } from 'vitest';
import { FULL, part } from '@/test/level';
import {
  a17Of,
  buildRun,
  describeReliefGrid,
  RELIEF_PARTS,
  reliefPlan
} from './reliefGrid.harness.node.test.ts';
import { adaptTenKV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import { baseFrames, framesFor } from './steps.ts';
import {
  adaptBases,
  factsOf,
  inputOf,
  RELIEF_SCENARIOS,
  reliefFacts,
  reliefGridBases,
  SCHEDULES
} from './testInputs.ts';
import type { AdaptResult, TenKV2AdaptStep, TenKV2Plan } from './types.ts';

const A = P.adapt;
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
const gen = (input: unknown): TenKV2Plan => {
  const r = generateTenKV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};

/* Mreža (reliefGrid.harness.node.test.ts): brz nivo — uzorak svih scenarija; pun — deo 1 (scenario pause10), delovi
   2…7: reliefGrid.<k>.full.node.test.ts. */
describeReliefGrid(
  'mreža R: 292 plana × asOf kraj ned 2…N − 4 × 7 scenarija = 18 193 toka (A17)',
  FULL ? part(RELIEF_SCENARIOS, 1, RELIEF_PARTS) : RELIEF_SCENARIOS
);

describe('primeri: nalaz N1 i nekadašnji sudar', () => {
  const adapt = (id: string, week: number, s: (typeof RELIEF_SCENARIOS)[number]) => {
    const p0 = reliefPlan(id);
    const asOf = p0.weeks[week - 1]!.endDate;
    return ok(adaptTenKV2(p0, reliefFacts(p0, s, asOf), asOf));
  };
  const rows = (p: TenKV2Plan, from: number, to: number) =>
    p.weeks.slice(from - 1, to).map((w) => [w.targetKm, w.deload]);
  const msg = (r: AdaptResult, c: string): string =>
    ok(r).reasons.find((x) => x.condition === c)!.message;

  it('10w-25km-v30-A-sat, asOf kraj ned 3: ned 5 više nije rasterećenje (4917959: pauza 17,0, bol 5 14,9, manjak 19,0)', () => {
    const id = '10w-25km-v30-A-sat';
    // 10K-08 (T1, lagan ≤ 0,8 × dugi i ≥ 20 min): bazni plan i povratak niži (10k-v2.9.0: 29,8 / 23,8 / 31,6 / 33,5).
    expect(rows(reliefPlan(id), 4, 7)).toEqual([
      [27.4, false],
      [21.9, true],
      [27.9, false],
      [30, false]
    ]);
    const pause = adapt(id, 3, 'pause10');
    expect(rows(pause.plan, 4, 7)).toEqual([
      [21.1, false],
      [23.2, false],
      [25, false],
      [26.5, false]
    ]);
    expect(msg(pause, 'PAUSE')).toMatch(
      / Redovno rasterećenje u nedelji 5 otpada: nedelja 4 je smanjena \(A17\)\.$/
    );
    const pain = adapt(id, 3, 'pain5');
    expect(rows(pain.plan, 4, 7)).toEqual([
      [28.3, false],
      [20.4, false],
      [22.4, false],
      [24.6, false]
    ]);
    expect(msg(pain, 'PAIN')).toContain(
      'Posle nedelje 4 rast kreće od 70 % nivoa pre bola (18,5 km).'
    );
    expect(msg(pain, 'PAIN')).toMatch(
      / Redovno rasterećenje u nedelji 5 otpada: nedelja 4 je smanjena \(A17\)\.$/
    );
    const under = adapt(id, 3, 'under');
    expect(rows(under.plan, 4, 7)).toEqual([
      [21.9, false],
      [24.1, false],
      [26.4, false],
      [28, false]
    ]);
    expect(msg(under, 'UNDER_EXECUTION')).toMatch(/nedelja 4 je smanjena \(A17\)\.$/);
    // Pauza + bol na kraju nedelje (r = n): jedna rečenica A17, u poruci pauze.
    const both = adapt(id, 3, 'pause10pain5');
    expect(msg(both, 'PAUSE')).toMatch(/nedelja 4 je smanjena \(A17\)\.$/);
    expect(msg(both, 'PAIN')).not.toContain('(A17)');
    // Umor: prinudno rasterećenje ned 4 (A5), redovno ned 5 ukida A5 — A17 bez dejstva.
    const tired = adapt(id, 3, 'fatigue');
    expect(rows(tired.plan, 4, 5)).toEqual([
      [21.4, true],
      [27.4, false]
    ]);
    expect(a17Of(tired)).toBe(false);
  });

  it('12 ned (smanjena ned 3) i 17 ned (smanjena ned 7): ukinuto rasterećenje, tačno 5 izgradnji do sledećeg (izuzetak A17)', () => {
    const p12 = adapt('12w-25km-v30-A-sat', 2, 'pause10').plan;
    expect(p12.weeks.filter((w) => w.deload).map((w) => w.index)).toEqual([9]);
    expect(buildRun(p12, 4)).toBe(5);
    const p17 = adapt('17w-25km-v30-A-sat', 6, 'pain5').plan;
    expect(p17.weeks.filter((w) => w.deload).map((w) => w.index)).toEqual([4, 13]);
    expect(p17.weeks.slice(7, 12).map((w) => w.targetKm)).toEqual([20.4, 22.4, 24.6, 26.4, 27.6]); // 10K-08 (T1): 23 … 31,6
    expect(buildRun(p17, 8)).toBe(5);
  });
});

describe('A17: polje reduced, prinudno rasterećenje, nov start, stari korak', () => {
  const p = gen(adaptBases().find((b) => b.id === 'd4-r-14w')!.input);
  const painOn = (asOf: string) => ({
    date: asOf,
    km: 0,
    durationSec: 0,
    completed: false,
    pain: 5
  });
  const deloads = (x: TenKV2Plan): number[] => x.weeks.filter((w) => w.deload).map((w) => w.index);
  const wed6 = addDays(p.weeks[5]!.startDate, 2);
  const sun6 = p.weeks[5]!.endDate;

  it('bazni plan d4-r-14w: rasterećenja 4, 8, 11', () => {
    expect(deloads(p)).toEqual([4, 8, 11]);
  });

  it('višak + bol u istom koraku: reduced false → A17 samo preko nedelje sidra (b), nikad preko fromWeek viška', () => {
    // Sreda ned 6: r = 6, fromWeek 7 (višak); rasterećenje ned 8 ostaje (fromWeek viška nije smanjenje).
    const f = factsOf(p, 'over120', wed6) as { workouts: unknown[] };
    const mid = ok(adaptTenKV2(p, { ...f, workouts: [...f.workouts, painOn(wed6)] }, wed6));
    const st = mid.plan.adaptation!.steps[0]!;
    expect([st.fromWeek, st.startKm !== null, st.levelKm !== null, st.reduced]).toEqual([
      7,
      true,
      true,
      false
    ]);
    expect(st.returnFrom).toEqual({ week: 6, share: A.painEasyFactor });
    expect(mid.reasons.filter((x) => x.applied).map((x) => x.condition)).toEqual([
      'PAIN',
      'OVER_EXECUTION'
    ]);
    expect(deloads(mid.plan)).toEqual([4, 8, 11]);
    expect(a17Of(mid)).toBe(false);
    // Kraj ned 6: r = fromWeek = 7 → rasterećenje ned 8 otpada preko sidra bola (poruka PAIN, ne viška).
    const g = factsOf(p, 'over120', sun6) as { workouts: unknown[] };
    const end = ok(adaptTenKV2(p, { ...g, workouts: [...g.workouts, painOn(sun6)] }, sun6));
    expect(end.plan.adaptation!.steps[0]!.reduced).toBe(false);
    expect(deloads(end.plan)).toEqual([4, 11]);
    expect(end.reasons.find((x) => x.condition === 'PAIN')!.message).toMatch(
      / Redovno rasterećenje u nedelji 8 otpada: nedelja 7 je smanjena \(A17\)\.$/
    );
    expect(end.reasons.find((x) => x.condition === 'OVER_EXECUTION')!.message).not.toContain(
      '(A17)'
    );
  });

  it('prinudno rasterećenje (A5) se nikad ne ukida: umor + bol u istom koraku (sreda ned 6) → ned 7 prinudno ostaje', () => {
    const tired = (d: number) => ({
      date: addDays(wed6, -d),
      km: 6,
      durationSec: 2400,
      completed: true,
      rpe: 8
    });
    const r = ok(adaptTenKV2(p, { workouts: [tired(1), tired(3), painOn(wed6)] }, wed6));
    const st = r.plan.adaptation!.steps[0]!;
    expect([st.deload, st.fromWeek, st.returnFrom?.week]).toEqual([true, 7, 6]);
    // A5: ned 7 prinudno, redovno ned 8 ukida A5; sidro bola r = 6 → ned 7 ostaje rasterećenje.
    expect(deloads(r.plan)).toEqual([4, 7, 11]);
    expect(a17Of(r)).toBe(false);
  });

  it('nov start (pauza 35 dana) se ne računa: 16 ned, asOf kraj ned 10 → nov start ned 11 (faze ostaju, A3), rasterećenje ned 12 ostaje', () => {
    const q = gen(
      inputOf({ weeks: 16, km: 35, vdot: 45, days: SCHEDULES.A.days, long: SCHEDULES.A.long })
    );
    expect(deloads(q)).toEqual([4, 8, 12]);
    const asOf = q.weeks[9]!.endDate;
    const r = ok(adaptTenKV2(q, factsOf(q, 'pause35', asOf), asOf));
    const st = r.plan.adaptation!.steps[0]!;
    expect([st.restart, st.fromWeek, st.reduced]).toEqual([true, 11, true]);
    expect(deloads(r.plan)).toEqual([4, 8, 12]);
    expect(a17Of(r)).toBe(false);
  });

  it('korak sačuvan pre 10k-v2.5.0 (bez polja reduced, A14): rezervni put startKm i levelKm → isti plan kao nov korak', () => {
    const q = gen(reliefGridBases().find((b) => b.id === '10w-25km-v30-A-sat')!.input);
    const asOf = q.weeks[2]!.endDate;
    const fresh = ok(adaptTenKV2(q, reliefFacts(q, 'pause10', asOf), asOf)).plan;
    const old = JSON.parse(JSON.stringify(fresh)) as TenKV2Plan;
    delete (old.adaptation!.steps[0] as { reduced?: boolean }).reduced;
    old.policyVersion = '10k-v2.4.1';
    const again = ok(adaptTenKV2(old, {}, asOf)).plan;
    expect(again.weeks.slice(3, 7).map((w) => [w.targetKm, w.deload])).toEqual([
      // 10K-08 (T1, lagan ≤ 0,8 × dugi i ≥ 20 min): 21,2 / 23,3 → 21,1 / 23,2.
      [21.1, false],
      [23.2, false],
      [25, false],
      [26.5, false]
    ]);
    expect(again.weeks).toEqual(ok(adaptTenKV2(fresh, {}, asOf)).plan.weeks);
  });

  it('framesFor: nov start bez rasporeda D5 (faze ostaju, A3) ne briše prinudno rasterećenje — kasniji bol ga ne ukida', () => {
    // 16 ned (rasterećenja 4, 8, 12): umor (sreda ned 10) → ned 11 prinudno, ned 12 ukida A5; pauza 35 (četvrtak) →
    // nov start ned 11 bez rasporeda (4 nedelje izgradnje); bol (petak) → sidro r = 10 → ned 11 ostaje prinudna.
    const q = gen(
      inputOf({ weeks: 16, km: 35, vdot: 45, days: SCHEDULES.A.days, long: SCHEDULES.A.long })
    );
    const chk = checkInput(q.input);
    if (!chk.ok) throw new Error('ulaz');
    const day = (i: number): string => addDays(q.weeks[9]!.startDate, i);
    const step = (asOf: string, x: Partial<TenKV2AdaptStep>): TenKV2AdaptStep => ({
      asOf,
      firstWeek: 10,
      fromWeek: 11,
      result: null,
      vdot: null,
      startKm: null,
      pauseRemainder: false,
      restart: false,
      deload: false,
      noQuality: [],
      oneQuality: [],
      rest: null,
      pain: null,
      orientation: false,
      levelKm: null,
      returnFrom: null,
      ...x
    });
    const steps = [
      step(day(2), { deload: true }),
      step(day(3), {
        startKm: 20,
        reduced: true,
        pauseRemainder: true,
        restart: true,
        levelKm: 40
      }),
      step(day(4), { levelKm: 40, returnFrom: { week: 10, share: A.painEasyFactor } })
    ];
    const dropped = new Map<number, number>();
    const f = framesFor(
      baseFrames(chk.input.startDate, chk.weeks, false)!,
      q.pattern,
      chk.input.runDays,
      chk.input.raceDate,
      chk.pace,
      steps,
      dropped
    );
    expect(f.filter((w) => w.deload).map((w) => w.index)).toEqual([4, 8, 11]);
    expect([...dropped]).toEqual([]);
  });

  it('poruka PAIN kad deluje min sa ciljem nedelje sidra (pauza + bol, d4-r-14w sreda ned 6)', () => {
    const r = ok(adaptTenKV2(p, factsOf(p, 'painPause', wed6), wed6));
    expect(r.reasons.find((x) => x.condition === 'PAIN')!.message).toContain(
      'Posle nedelje 6 rast kreće od 26,5 km (cilj nedelje 6; 70 % nivoa pre bola bilo bi 29,2 km). Povratak do 41,7 km'
    );
  });
});
