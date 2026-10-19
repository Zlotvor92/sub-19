/* H16 plan po osećaju: tempo iz laganog tempa (E ± 15 s, procena VDOT-a), RPE po zoni, test 5 km u poslednjoj
   nedelji baze (u obimu, ne u dozi), bez prognoze i ocene cilja do testa; HI11 tumačenja; validator hvata. */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { feelPaces, vdotFromEasyPace } from './paces.ts';
import { periodize, phasesOf, testWeekOf } from './periodize.ts';
import { HM_V2_POLICY as P } from './policy.ts';
import { feelInputs, gridInputs, inputOf, SCHEDULES_BY_DAYS } from './testInputs.ts';
import type { HmV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';

const FEEL = feelInputs();
const plan = (id: string, o: Record<string, unknown> = {}): HmV2Plan => {
  const g = [...FEEL, ...gridInputs()].find((x) => x.id === id)!;
  const r = generateHmV2({ ...g.input, ...o });
  if (!r.ok) throw new Error(`${id}: ${r.reasons.map((x) => x.message).join(' | ')}`);
  return r.plan;
};
const errors = (p: HmV2Plan): string[] =>
  [
    ...new Set(
      validatePlan(p)
        .filter((v) => v.severity === 'error')
        .map((v) => v.rule)
    )
  ].sort();
const testWeek = (p: HmV2Plan): PlanWeek => p.weeks.find((w) => w.test)!;

describe('H16 tempo po osećaju', () => {
  it('E = lagan ± 15 s; procena VDOT = VDOT čiji je brži kraj E (0,70) jednak laganom tempu, 25–60', () => {
    const p = feelPaces(360);
    expect(p.E).toEqual({ fast: 345, slow: 375 });
    // Daniels–Gilbert: VO2(166,67 m/min) / 0,70, nezavisno izračunato.
    const v = 60000 / 360;
    expect(p.vdot).toBe(Math.round(((-4.6 + 0.182258 * v + 0.000104 * v * v) / 0.7) * 10) / 10);
    expect(p.vdot).toBe(41);
    // U celom opsegu ulaza procena je u 25–60 (granice ne deluju): 270 → 58,6; 510 → 26,1.
    expect(
      [vdotFromEasyPace(270), vdotFromEasyPace(510)].map((x) => Math.round(x * 10) / 10)
    ).toEqual([58.6, 26.1]);
    expect([P.feel.vdotMin, P.feel.vdotMax]).toEqual([25, 60]);
    // Brzi tempo je orijentir iz procene (isti VDOT kao plan sa rezultatom).
    expect(p.T).toBeLessThan(p.E.fast);
  });

  it('plan: paceBasis feel, bez prognoze i ocene cilja (i uz ciljno vreme), napomene sa nedeljom testa', () => {
    const p = plan('f-d4-12w-40km-e360-A', { goalTimeSec: 6000 });
    expect([p.paceBasis, p.predictedHmSec, p.goal, p.vdot]).toEqual(['feel', null, null, 41]);
    expect(p.notes[0]).toContain('Plan po osećaju (H16): bez rezultata trke');
    expect(p.notes[1]).toContain('Test 5 km: nedelja 3, 2026-11-17 (H16)');
    expect(p.notes[1]).toContain('Ciljno vreme se ocenjuje posle rezultata');
    expect(p.warnings.filter((w) => w.severity === 'error')).toEqual([]);
  });

  it('RPE po zoni na svakom kvalitetu i oštrenju: T 6–7, RP 6–7, I 8, R 8; ne na laganom, dugom i testu', () => {
    const p = plan('f-d4-12w-40km-e360-A');
    const seen = new Map<string, string>();
    for (const w of p.weeks)
      for (const d of w.days) {
        const z = d.workout.dose?.zone;
        if (d.workout.kind === 'quality')
          seen.set(z!, `${d.workout.rpe!.min}–${d.workout.rpe!.max}`);
        else expect(d.workout.rpe).toBeUndefined();
      }
    expect(Object.fromEntries(seen)).toEqual({ R: '8–8', T: '6–7', I: '8–8', RP: '6–7' });
    expect(p.weeks.at(-1)!.days.find((d) => d.role === 'sharpener')!.workout.rpe!.cue).toBe(
      'ritam polumaratona'
    );
  });

  it('plan sa rezultatom: bez paceBasis, RPE i testa (oblik bajt-isti kao hm-v2.1.0)', () => {
    const p = plan('12w-40km-v45-A-sun');
    expect(p.paceBasis).toBeUndefined();
    expect(p.predictedHmSec).toBeGreaterThan(0);
    expect(
      p.weeks.some((w) => w.test || w.days.some((d) => d.workout.rpe || d.role === 'test'))
    ).toBe(false);
    expect(Object.keys(p.input)).toEqual([
      'startDate',
      'raceDate',
      'runDays',
      'longRunDay',
      'currentWeeklyKm',
      'recentResult',
      'goalTimeSec'
    ]);
  });
});

describe('H16 test 5 km', () => {
  it('nedelja testa = poslednja nedelja baze (periodize samo uz test)', () => {
    for (let n = 10; n <= 20; n++) {
      const ph = phasesOf(n);
      expect(ph[testWeekOf(ph) - 1]).toBe('base');
      expect(ph[testWeekOf(ph)]).toBe('development');
      expect(
        periodize('2026-11-02', n, true)!
          .filter((f) => f.test)
          .map((f) => f.index)
      ).toEqual([testWeekOf(ph)]);
      expect(periodize('2026-11-02', n)!.some((f) => f.test)).toBe(false);
    }
  });

  it('izgradnja: test na danu Q1 (umesto R), Q2 ostaje; WU/CD po pojasu + 5 km; u obimu, nije doza', () => {
    const p = plan('f-d4-12w-40km-e360-A');
    const w = testWeek(p);
    expect(w.index).toBe(3);
    const t = w.days.find((d) => d.role === 'test')!;
    expect([t.weekday, t.hard, t.countsToWeek, t.workout.kind, t.workout.dose]).toEqual([
      p.pattern.q1,
      true,
      true,
      'test',
      null
    ]);
    const seg = t.workout.segments;
    expect(seg.map((s) => s.kind)).toEqual(['warmup', 'test', 'cooldown']);
    expect([seg[0]!.sec, seg[2]!.sec]).toEqual([1200, 900]); // 40 km: pojas 20/15 min (H14)
    expect(seg[1]!.km).toBe(5);
    expect(t.workout.workKm).toEqual({ T: 0, I: 0, R: 0, RP: 0 });
    expect(w.days.find((d) => d.role === 'q2')!.workout.dose!.ladder).toBe('T_continuous');
    expect(w.notes).toContain(
      'Test 5 km (H16): kontrolisano maksimalno; računa se u obim nedelje, ne u dozu kvaliteta; rezultat koristi adaptacija (segment 04), do tada tempo ostaje procena.'
    );
  });

  it('progresija posle testa od stanja pre testa: 3 dana T kont. 2,5 → test → T cruise ≥ 2,5 km', () => {
    const p = plan('f-d3-13w-25km-e270-A');
    const q1 = (i: number) => p.weeks[i - 1]!.days.find((d) => d.role === 'q1')?.workout.dose;
    expect([q1(3)!.doseM, q1(4), q1(5)!.ladder, q1(5)!.doseM]).toEqual([
      2500,
      undefined,
      'T_cruise',
      2500
    ]);
  });

  it('rasterećenje sa testom: test na danu T slota umesto kvaliteta; dugi skraćen da lagani ostanu ≥ 4 km; cilj se ne podiže (pouka 23)', () => {
    const p4 = plan('f-d4-13w-30km-e270-A');
    const w4 = testWeek(p4);
    expect([w4.deload, w4.index]).toEqual([true, 4]);
    expect(w4.days.find((d) => d.role === 'test')!.weekday).toBe(p4.pattern.q2);
    expect(w4.days.filter((d) => d.workout.kind === 'quality')).toHaveLength(0);
    const p3 = plan('f-d3-13w-25km-e270-A');
    const w3 = testWeek(p3);
    expect(w3.days.find((d) => d.role === 'test')!.weekday).toBe(p3.pattern.q1);
    // 0,8 × 12,6 = 10,0 km → 7,9 km: cilj 22,5 − test 10,55 = 11,95 km; lagan ≥ 4 km.
    expect(w3.days.find((d) => d.role === 'long')!.workout.km).toBe(7.9);
    expect(w3.days.find((d) => d.role === 'easy')!.workout.km).toBe(4.1);
    expect(p3.warnings.find((v) => v.rule === 'TEST_DELOAD_LONG')!.week).toBe(4);
    expect(w3.notes[0]).toContain('skraćen sa 0,8 × poslednjeg ne-rasteretnog (10,0 km)');
    for (const w of [w3, w4]) expect([w.fitted, w.targetKm <= w.nominalKm]).toEqual([null, true]);
  });

  it('mreža po osećaju: nijedno rasterećenje sa testom nije podignuto (pouka 23); test „ne jede" nedelju', () => {
    let deload = 0;
    for (const g of FEEL.filter((_, i) => i % 7 === 0)) {
      const r = generateHmV2(g.input);
      if (!r.ok) throw new Error(g.id);
      const w = testWeek(r.plan);
      if (w.deload) deload++;
      expect(w.fitted === 'up' && w.deload).toBe(false);
      const long = w.days.find((d) => d.role === 'long')!.workout.km;
      for (const d of w.days.filter((x) => x.role === 'easy')) {
        expect(d.workout.km).toBeGreaterThanOrEqual(4);
        expect(d.workout.km).toBeLessThanOrEqual(long);
      }
    }
    expect(deload).toBeGreaterThan(0);
  });
});

describe('H16 validator hvata', () => {
  it('test uklonjen, premešten ili u planu sa rezultatom; RPE i oznaka osnove; prognoza', () => {
    const p = plan('f-d4-12w-40km-e360-A');
    const a = structuredClone(p);
    delete a.weeks[2]!.test;
    expect(errors(a)).toContain('TEST');
    const b = structuredClone(p);
    b.weeks[3]!.test = true;
    expect(errors(b)).toContain('TEST');
    const c = structuredClone(p);
    delete c.weeks[0]!.days[0]!.workout.rpe;
    expect(errors(c)).toContain('RPE');
    const d = structuredClone(p);
    delete d.paceBasis;
    expect(errors(d)).toContain('PACE_BASIS');
    const e = structuredClone(p);
    e.predictedHmSec = 6000;
    expect(errors(e)).toContain('PACES');
    const r = plan('12w-40km-v45-A-sun');
    const f = structuredClone(r);
    f.weeks[0]!.days[0]!.workout.rpe = { min: 8, max: 8, cue: 'x' };
    expect(errors(f)).toContain('RPE');
    const g = structuredClone(r);
    g.weeks[2]!.test = true;
    expect(errors(g)).toContain('TEST');
  });

  it('odluka HM-03: dan testa je kvalitetni dan za upozorenje LONG_SHORTER_THAN_QUALITY (pouka 14, HI3)', () => {
    const p = structuredClone(plan('f-d4-12w-40km-e360-A'));
    const w = p.weeks[2]!;
    const long = w.days.find((d) => d.role === 'long')!;
    // Dugi kraći (po trajanju) od dana testa; Q2 ostaje kraći od dugog.
    long.workout = {
      ...long.workout,
      sec: w.days.find((d) => d.role === 'test')!.workout.sec - 60
    };
    const v = validatePlan(p).filter((x) => x.rule === 'LONG_SHORTER_THAN_QUALITY');
    expect(v.map((x) => [x.severity, x.week])).toEqual([['warning', 3]]);
  });

  it('isti tempo za sve rasporede i broj dana (tempo zavisi samo od laganog tempa)', () => {
    const v = (days: 3 | 4 | 5 | 6) =>
      generateHmV2(
        inputOf({
          weeks: 12,
          km: 45,
          days: SCHEDULES_BY_DAYS[days].A.days,
          easyPaceSecPerKm: 405
        })
      );
    const ps = ([3, 4, 5, 6] as const).map((n) => {
      const r = v(n);
      if (!r.ok) throw new Error(String(n));
      return JSON.stringify(r.plan.paces);
    });
    expect(new Set(ps).size).toBe(1);
  });
});
