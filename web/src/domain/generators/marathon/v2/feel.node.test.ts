import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { feelPaces, pacesFromVdot, raceTimeForVdot, vdotFromEasyPace } from './paces.ts';
import { testWeekOf } from './periodize.ts';
import { MARATHON_V2_POLICY as P } from './policy.ts';
import { inputOf, SCHEDULES_BY_DAYS, START, timeForVdot, type Profile } from './testInputs.ts';
import type { MarathonV2Plan, PlanDay } from './types.ts';
import { validatePlan } from './validate.ts';

/* M16: plan po osećaju — put ulaza, tempo (E = lagan ± 15 s, procena VDOT-a samo orijentir), RPE, bez
   prognoze/cilja, test 5 km u poslednjoj nedelji baze (Q1 ili kvalitet rasterećenja), u obimu, ne u dozi. */

const feelInput = (pr: Partial<Profile> = {}, easy = 360): Record<string, unknown> =>
  inputOf({
    weeks: 16,
    km: 45,
    days: SCHEDULES_BY_DAYS[4].A.days,
    long: 'sun',
    easyPace: easy,
    ...pr
  });
function plan(raw: Record<string, unknown>): MarathonV2Plan {
  const r = generateMarathonV2(raw);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}
const errors = (p: MarathonV2Plan): string[] =>
  [
    ...new Set(
      validatePlan(p)
        .filter((v) => v.severity === 'error')
        .map((v) => v.rule)
    )
  ].sort();
const mutate = (p0: MarathonV2Plan, fn: (p: MarathonV2Plan) => void): string[] => {
  const p = structuredClone(p0);
  fn(p);
  return errors(p);
};
const tests = (p: MarathonV2Plan): { week: number; d: PlanDay }[] =>
  p.weeks.flatMap((w) =>
    w.days.filter((d) => d.role === 'test').map((d) => ({ week: w.index, d }))
  );
const codes = (raw: unknown): string[] => {
  const r = checkInput(raw);
  return r.ok ? [] : r.reasons.map((x) => x.code);
};

/** 4 dana, 16 ned: poslednja nedelja baze (4) je rasterećenje → test na danu T slota (Q2). */
const D4 = plan(feelInput());
/** 3 dana, 12 ned: poslednja nedelja baze (3) je izgradnja → test na danu Q1 (umesto jedinog kvaliteta). */
const D3 = plan(
  feelInput({ weeks: 12, km: 30, days: SCHEDULES_BY_DAYS[3].A.days, long: 'sun' }, 450)
);

describe('M16 ulaz', () => {
  it('bez pouzdanog rezultata lagan tempo je obavezan (270–510 s/km); uz pouzdan rezultat se ne koristi', () => {
    const noPace = { ...feelInput(), easyPaceSecPerKm: undefined };
    expect(codes(noPace)).toEqual(['EASY_PACE_REQUIRED']);
    expect(codes(feelInput({}, 269))).toEqual(['EASY_PACE_OUT_OF_RANGE']);
    expect(codes(feelInput({}, 511))).toEqual(['EASY_PACE_OUT_OF_RANGE']);
    expect(codes(feelInput({}, 270))).toEqual([]);
    expect(codes(feelInput({}, 510))).toEqual([]);
    const withResult = {
      ...inputOf({ weeks: 16, km: 45, vdot: 45, days: SCHEDULES_BY_DAYS[4].A.days }),
      easyPaceSecPerKm: 400
    };
    const c = checkInput(withResult);
    expect(c.ok && c.pace.kind).toBe('result');
    expect(c.ok && 'easyPaceSecPerKm' in c.input).toBe(false);
    // Rezultat stariji od 84 dana i VDOT < 30 → po osećaju.
    const old = {
      ...withResult,
      recentResult: {
        distanceM: 21097.5,
        timeSec: timeForVdot(45),
        date: addDays(START, -85)
      }
    };
    expect(plan(old).paceBasis).toBe('feel');
  });
});

describe('M16 tempo i plan', () => {
  it('E = lagan ± 15 s; procena VDOT-a = VDOT čiji je brži kraj E (0,70) jednak laganom tempu, 25–60; MP iz procene uz korekciju obima (M2)', () => {
    for (const e of [270, 315, 360, 405, 450, 510]) {
      const { paces, capped } = feelPaces(e, 45);
      expect(paces.E).toEqual({ fast: e - 15, slow: e + 15 });
      const est = Math.round(vdotFromEasyPace(e) * 10) / 10;
      expect(paces.vdot).toBe(est);
      expect(capped).toBe(false);
      expect(paces.MP).toBe(pacesFromVdot(est, 45).MP);
    }
    expect(Math.round(vdotFromEasyPace(270) * 10) / 10).toBe(58.6);
    expect(Math.round(vdotFromEasyPace(510) * 10) / 10).toBe(26.1);
    expect(feelPaces(240, 45).capped).toBe(true);
    expect(feelPaces(240, 45).paces.vdot).toBe(60);
  });

  it('plan nosi paceBasis feel, bez prognoze maratona i ocene cilja; napomena „posle testa"', () => {
    const p = plan({ ...feelInput(), goalTimeSec: 4 * 3600 });
    expect(p.paceBasis).toBe('feel');
    expect(p.predictedMarathonSec).toBeNull();
    expect(p.goal).toBeNull();
    expect(p.notes.some((n) => n.startsWith('Plan po osećaju (M16)'))).toBe(true);
    expect(p.notes.some((n) => n.includes('posle testa'))).toBe(true);
    expect(errors(p)).toEqual([]);
  });

  it('svaki kvalitet (i oštrenje) nosi RPE zone: T 6–7, I 8, R 8, MP 5–6 „ritam maratona"; plan sa rezultatom bez RPE', () => {
    const q = D4.weeks.flatMap((w) => w.days.filter((d) => d.workout.kind === 'quality'));
    const zones = new Set(q.map((d) => d.workout.dose!.zone));
    expect([...zones].sort()).toEqual(['I', 'MP', 'R', 'T']);
    for (const d of q) {
      const r = P.feel.rpe[d.workout.dose!.zone];
      expect(d.workout.rpe).toEqual({ min: r.min, max: r.max, cue: r.cue });
    }
    expect(P.feel.rpe.MP).toEqual({ min: 5, max: 6, cue: 'ritam maratona' });
    expect(D4.weeks.at(-1)!.days.find((d) => d.role === 'sharpener')!.workout.rpe?.min).toBe(5);
    const res = plan(inputOf({ weeks: 16, km: 45, vdot: 45, days: SCHEDULES_BY_DAYS[4].A.days }));
    expect(res.weeks.some((w) => w.days.some((d) => d.workout.rpe !== undefined))).toBe(false);
  });
});

describe('M16 test 5 km', () => {
  it('tačno jedan test, u poslednjoj nedelji baze; 4 dana u rasterećenju na danu T slota (Q2), umesto kvaliteta rasterećenja', () => {
    const t = tests(D4);
    const w = testWeekOf(D4.weeks.map((x) => x.phase));
    expect(t).toHaveLength(1);
    expect(t[0]!.week).toBe(w);
    expect(D4.weeks.map((x) => x.phase).lastIndexOf('base') + 1).toBe(w);
    const wk = D4.weeks[w - 1]!;
    expect(wk.deload).toBe(true);
    expect(wk.test).toBe(true);
    expect(t[0]!.d.weekday).toBe(D4.pattern.q2);
    expect(wk.days.filter((d) => d.workout.kind === 'quality')).toHaveLength(0);
    expect(D4.weeks.filter((x) => x.test)).toHaveLength(1);
  });

  it('3 dana: test na danu Q1 umesto jedinog kvaliteta nedelje izgradnje', () => {
    const t = tests(D3);
    expect(t).toHaveLength(1);
    const wk = D3.weeks[t[0]!.week - 1]!;
    expect([wk.phase, wk.deload, t[0]!.d.weekday]).toEqual(['base', false, D3.pattern.q1]);
    expect(wk.days.some((d) => d.workout.kind === 'quality')).toBe(false);
    expect(D3.weeks[t[0]!.week]!.phase).toBe('development');
  });

  it('test: WU/CD (M14) + 5 km kontrolisano maksimalno; u obimu nedelje; nije doza (rad u zonama 0, bez plafona)', () => {
    for (const p of [D4, D3]) {
      const { week, d } = tests(p)[0]!;
      const s = d.workout.segments;
      expect(s.map((x) => x.kind)).toEqual(['warmup', 'test', 'cooldown']);
      expect([s[0]!.sec, s[2]!.sec]).toEqual([900, 600]);
      expect(s[1]!.km).toBe(5);
      expect(s[1]!.sec).toBe(raceTimeForVdot(p.vdot, 5000));
      expect(d.workout.dose).toBeNull();
      expect(d.workout.workKm).toEqual({ T: 0, I: 0, R: 0, MP: 0 });
      expect(d.countsToWeek && d.hard).toBe(true);
      const wk = p.weeks[week - 1]!;
      expect(
        Math.round(wk.days.reduce((a, x) => a + (x.countsToWeek ? x.workout.km * 100 : 0), 0))
      ).toBe(Math.round(wk.plannedKm * 100));
    }
  });

  it('progresija posle testa nastavlja od stanja pre testa (3 dana: T cruise razvoja ≥ T kont. pre testa)', () => {
    const t = tests(D3)[0]!.week;
    const before = D3.weeks[t - 2]!.days.find((d) => d.role === 'q1')!.workout.dose!;
    const after = D3.weeks[t]!.days.find((d) => d.role === 'q1')!.workout.dose!;
    expect(before.ladder).toBe('T_continuous');
    expect(after.ladder).toBe('T_cruise');
    expect(after.doseM).toBeGreaterThanOrEqual(before.doseM);
  });

  it('početnik i plan sa rezultatom nemaju test', () => {
    const beg = plan({ ...feelInput({ km: 40 }), experience: 'beginner' });
    expect(tests(beg)).toHaveLength(0);
    expect(beg.weeks.some((w) => w.test)).toBe(false);
    const res = plan(inputOf({ weeks: 16, km: 45, vdot: 45, days: SCHEDULES_BY_DAYS[4].A.days }));
    expect(tests(res)).toHaveLength(0);
  });

  it('odstupanje (M16 ispred M5): rasterećenje sa testom pri najmanjem obimu — dugi skraćen da lagani ostanu ≥ 5 km, uz napomenu i upozorenje', () => {
    const p = plan(
      feelInput({ weeks: 14, km: 30, days: SCHEDULES_BY_DAYS[3].A.days, long: 'sun' }, 270)
    );
    const w = p.weeks.find((x) => x.test)!;
    expect(w.deload).toBe(true);
    const long = w.days.find((d) => d.role === 'long')!.workout.km;
    const easy = w.days.filter((d) => d.role === 'easy').map((d) => d.workout.km);
    expect(easy.every((e) => e >= 5 && e <= long)).toBe(true);
    expect(w.notes.some((n) => n.includes('skraćen sa 0,8 ×'))).toBe(true);
    expect(p.warnings.map((x) => x.rule)).toContain('DELOAD_LONG_SHORTENED');
  });
});

describe('M16 validator hvata', () => {
  it('test u pogrešnoj nedelji, test kao doza, bez RPE, sa prognozom, pogrešan E', () => {
    expect(errors(D4)).toEqual([]);
    expect(
      mutate(D4, (p) => {
        const w = p.weeks.find((x) => x.test)!;
        delete w.test;
        p.weeks[w.index]!.test = true;
      })
    ).toContain('TEST');
    expect(
      mutate(D4, (p) => {
        const d = p.weeks.flatMap((w) => w.days).find((x) => x.role === 'test')!;
        d.workout.workKm.T = 5;
      })
    ).toContain('TEST');
    expect(
      mutate(D4, (p) => {
        const d = p.weeks.flatMap((w) => w.days).find((x) => x.workout.kind === 'quality')!;
        delete d.workout.rpe;
      })
    ).toContain('RPE');
    expect(mutate(D4, (p) => (p.predictedMarathonSec = 14000))).toContain('PACES');
    expect(mutate(D4, (p) => (p.paces.E.fast -= 1))).toContain('PACES');
    expect(mutate(D4, (p) => (p.paceBasis = 'result'))).toContain('PACE_BASIS');
  });
});
