/* Segment 5K-10 (krug T, 5k-v2.12.0): trenerska pravila T1, T2 (5K), T4, T5, T6 (C3, C5, C11) —
   docs/generators-v2/audit/fixes/03-coach-rules.md. Svaki test pada na b9c4728 i prolazi posle; merne skripte i brojevi
   pre → posle su u docs/5k-v2/reports/SEGMENT-10-IMPLEMENTATION.md. */

import { describe, expect, it } from 'vitest';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays, daysBetween } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { easyCapKm, easyMinKm, longCapKm } from './lengths.ts';
import { feelPaces } from './paces.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { choosePattern } from './schedule.ts';
import { earlyGridInputs } from './testInputs.ts';
import type { FiveKV2Plan, FiveKV2RunWalkPlan, PlanWeek, Weekday, WeekFrame } from './types.ts';
import { validatePlan } from './validate.ts';
import {
  buildTrainingWeek,
  mixedRemainder,
  protectedKm,
  raceWeekRest,
  SECOND_EASY_NOTE
} from './week.ts';
import { easyRun } from './workouts.ts';

const input = (id: string): Record<string, unknown> =>
  earlyGridInputs().find((x) => x.id === id)!.input;
const planOf = (inp: Record<string, unknown>): FiveKV2Plan => {
  const r = generateFiveKV2(inp);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  if (r.plan.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
  return r.plan;
};
const errors = (p: FiveKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const build = (w: PlanWeek): boolean =>
  !w.deload && (w.phase === 'base' || w.phase === 'peak' || w.phase === 'sharpen');
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Profil korisnika (coach.ts): 5 km 20:25, cilj < 20:00, 4 dana, 30 km, start 19. 10., trka 13. 12. 2026. */
const USER = {
  startDate: '2026-10-19',
  raceDate: '2026-12-13',
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 30,
  recentResult: { distanceM: 5000, timeSec: 1225, date: '2026-10-12' },
  goalTimeSec: 1199
};

describe('T1: lagan prema dugom u nedelji izgradnje', () => {
  const sample = earlyGridInputs().filter((_, i) => i % 9 === 0);

  it('mreža generatora (svaki 9. ulaz): lagan ≤ 0,8 × dugi i ≥ max(3 km, 20 min); dugi ≤ udeo dana; 0 grešaka', () => {
    const bad: string[] = [];
    let weeks = 0;
    for (const b of sample) {
      const r = generateFiveKV2(b.input);
      if (!r.ok) {
        bad.push(`${b.id}: odbijen`);
        continue;
      }
      if (r.plan.planType === 'runWalk') continue;
      const p = r.plan;
      if (errors(p).length > 0) bad.push(`${b.id}: ${errors(p).join('+')}`);
      for (const w of p.weeks.filter(build)) {
        const long = w.days.find((d) => d.role === 'long');
        if (!long) continue;
        weeks++;
        expect(long.workout.km).toBeLessThanOrEqual(
          longCapKm(w.targetKm, p.paces, athleteOf(p)) + 1e-9
        );
        for (const d of w.days.filter((x) => x.role === 'easy')) {
          if (d.workout.km > easyCapKm(long.workout.km, w.phase, false) + 1e-9)
            bad.push(`${b.id} ned ${w.index}: lagan ${d.workout.km} > 0,8 × ${long.workout.km}`);
          if (d.workout.km + 1e-9 < easyMinKm(w.phase, p.paces) || d.workout.sec < P.easy.minSec)
            bad.push(`${b.id} ned ${w.index}: lagan ${d.workout.km} km / ${d.workout.sec} s`);
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(weeks).toBeGreaterThan(1000);
  });

  it('ostatak koji ne staje: planirano < cilj uz PLANNED_BELOW_TARGET i preporuku (više dana / manji obim)', () => {
    const p = planOf(USER);
    const capped = p.weeks.filter((w) => w.easyCappedAtLong);
    expect(capped.length).toBeGreaterThan(0);
    for (const w of capped) {
      expect(w.plannedKm).toBeLessThan(w.targetKm);
      expect(w.notes.some((n) => n.includes('više dana trčanja ili manji obim'))).toBe(true);
    }
    expect(p.warnings.filter((v) => v.rule === 'PLANNED_BELOW_TARGET').map((v) => v.week)).toEqual(
      capped.map((w) => w.index)
    );
  });

  it('mali obim, brz tempo (4 dana, 15 km, E 5:00): lagan dan manje (odmor) umesto laganog < 20 min', () => {
    const p = planOf(input('f-d4-9w-15km-e300-0'));
    const w = p.weeks[0]!;
    expect(w.easyRest).toBe(1);
    expect(w.days).toHaveLength(3);
    expect(w.days.filter((d) => d.role === 'easy')).toEqual([]);
    expect(errors(p)).toEqual([]);
  });

  it('izuzetak: uvodne nedelje početnika (samo lagano + ubrzanja) bez pravila — brz početnik, 3 dana / 12 km ima plan', () => {
    // fuzz i=1087 (nerealan: početnik VDOT > 45): sa pravilom u uvodu ostaje samo dugi (WEEK_DEGENERATE, odbijanje).
    const p = planOf({
      startDate: '2028-05-07',
      raceDate: '2028-06-17',
      runDays: ['sun', 'tue', 'sat'],
      currentWeeklyKm: 12,
      recentResult: { distanceM: 3000, timeSec: 601, date: '2028-04-08' },
      experience: 'beginner',
      canRun30Min: true,
      goalTimeSec: null
    });
    for (const w of p.weeks.slice(0, P.beginner.introWeeks)) {
      expect(w.stridesOnly).toBe(true);
      expect(w.days.length).toBeGreaterThanOrEqual(2);
    }
    expect(errors(p)).toEqual([]);
  });

  it('validator: lagan iznad 0,8 × dugi → EASY_VS_LONG; lagan ispod 20 min → EASY_MIN', () => {
    const p = planOf(USER);
    const wi = p.weeks.findIndex((w) => build(w) && !w.easyCappedAtLong);
    const q = clone(p);
    const w = q.weeks[wi]!;
    const long = w.days.find((d) => d.role === 'long')!.workout.km;
    const e = w.days.find((d) => d.role === 'easy')!;
    e.workout = easyRun(Math.floor(long * 9) / 10, p.paces, false);
    expect(errors(q)).toContain('EASY_VS_LONG');
    const s = clone(p);
    s.weeks[wi]!.days.find((d) => d.role === 'easy')!.workout = easyRun(3, p.paces, false);
    expect(easyMinKm('base', p.paces)).toBeGreaterThan(3);
    expect(errors(s)).toContain('EASY_MIN');
  });
});

const athleteOf = (p: FiveKV2Plan) => ({
  days: p.input.runDays.length as 3 | 4 | 5,
  beginner: p.experience === 'beginner',
  feel: p.paceMode === 'feel'
});

describe('T2 (5K): dan kvaliteta ne duži od dugog — prvo WU/CD na minimum, pa upozorenje', () => {
  const p = planOf(input('b-d4-14w-25km-e480-0'));
  const w = p.weeks[7]!;

  it('b-d4-14w-25km-e480-0 ned 8: WU/CD kvaliteta na najnižem pojasu, dan kvaliteta ≤ dugi, napomena', () => {
    expect(w.wuMin).toBe(true);
    const min = P.warmup.bands[0];
    const long = w.days.find((d) => d.role === 'long')!;
    for (const d of w.days.filter((x) => x.workout.kind === 'quality')) {
      expect(d.workout.segments.find((s) => s.kind === 'warmup')!.km).toBe(min.warmupKm);
      expect(d.workout.segments.find((s) => s.kind === 'cooldown')!.km).toBe(min.cooldownKm);
      expect(d.workout.sec).toBeLessThanOrEqual(long.workout.sec);
    }
    expect(w.notes.some((n) => n.includes('Zagrevanje i hlađenje kvaliteta skraćeni'))).toBe(true);
    expect(errors(p)).toEqual([]);
  });

  it('validator: WU/CD najnižeg pojasa bez oznake → WARMUP; dan kvaliteta duži od dugog i uz minimum → upozorenje', () => {
    const q = clone(p);
    delete q.weeks[7]!.wuMin;
    expect(errors(q)).toContain('WARMUP');
    // Mreža: dan kvaliteta duži od dugog i posle WU/CD na minimumu nosi LONG_SHORTER_THAN_QUALITY.
    let warned = 0;
    for (const b of earlyGridInputs().filter((_, i) => i % 9 === 0)) {
      const r = generateFiveKV2(b.input);
      if (!r.ok || r.plan.planType === 'runWalk') continue;
      for (const x of r.plan.weeks.filter(
        (y) => y.phase === 'base' || y.phase === 'peak' || y.phase === 'sharpen'
      )) {
        const long = x.days.find((d) => d.role === 'long');
        const longer =
          !!long &&
          !x.limits &&
          x.days.some((d) => d.workout.kind === 'quality' && d.workout.sec > long.workout.sec);
        const warn = r.plan.warnings.some(
          (v) => v.rule === 'LONG_SHORTER_THAN_QUALITY' && v.week === x.index
        );
        expect([b.id, x.index, warn]).toEqual([b.id, x.index, longer]);
        if (warn) warned++;
      }
    }
    expect(warned).toBeGreaterThan(0);
  });
});

describe('T4 (5K, trkač): taper 1 nedelja, rasterećenje, doza vrha', () => {
  it('profil korisnika (8 ned): taper 1 + trkačka, bez rasterećenja, I i RP ≥ 80 % budžeta u nedeljama vrha', () => {
    const p = planOf(USER);
    expect(p.weeks.map((w) => w.phase)).toEqual([
      'base',
      'base',
      'base',
      'peak',
      'peak',
      'sharpen',
      'taper',
      'race'
    ]);
    expect(p.weeks.filter((w) => w.deload)).toEqual([]);
    for (const w of p.weeks.filter((x) => x.phase === 'peak' || x.phase === 'sharpen')) {
      const q1 = w.days.find((d) => d.role === 'q1')!.workout;
      const main = w.phase === 'peak' ? q1.workKm.I : q1.workKm.RP;
      expect(main).toBeGreaterThanOrEqual(P.quality.peakMainMinShare * w.budgets.I - 1e-9);
      expect(main).toBeLessThanOrEqual(w.budgets.I + 1e-9);
    }
    expect(errors(p)).toEqual([]);
  });

  it('duži plan (12 ned): redovno rasterećenje ne pre nedelje 4; početnik: taper 2 nedelje (bez promene)', () => {
    const p = planOf({ ...USER, raceDate: addDays(USER.startDate, 12 * 7 - 1) });
    expect(p.weeks.filter((w) => w.deload).map((w) => w.index)[0]).toBeGreaterThanOrEqual(4);
    expect(p.weeks.filter((w) => w.phase === 'taper')).toHaveLength(1);
    const b = planOf(input('b-d4-14w-25km-e480-0'));
    expect(b.weeks.filter((w) => w.phase === 'taper')).toHaveLength(2);
  });

  it('validator: rasterećenje u planu ≤ 8 nedelja → DELOAD_SHORT; u ned 3 dužeg plana → DELOAD_EARLY; 2 nedelje tapera → PHASES', () => {
    const p = planOf(USER);
    const q = clone(p);
    q.weeks[2]!.deload = true;
    expect(errors(q)).toContain('DELOAD_SHORT');
    const l = planOf({ ...USER, raceDate: addDays(USER.startDate, 12 * 7 - 1) });
    const m = clone(l);
    m.weeks[2]!.deload = true;
    expect(errors(m)).toContain('DELOAD_EARLY');
    const t = clone(p);
    t.weeks[5]!.phase = 'taper';
    expect(errors(t)).toContain('PHASES');
  });
});

describe('T5: trčanje/hodanje L13/L14; početnik bez kontrolnog trčanja', () => {
  const rw = (weeks: number, pace: number): FiveKV2RunWalkPlan => {
    const r = generateFiveKV2({
      startDate: '2026-11-03',
      raceDate: addDays('2026-11-03', weeks * 7 - 1),
      runDays: ['tue', 'thu', 'sat'],
      currentWeeklyKm: 10,
      experience: 'beginner',
      canRun30Min: false,
      typicalEasyPaceSecPerKm: pace
    });
    if (!r.ok || r.plan.planType !== 'runWalk') throw new Error(JSON.stringify(r));
    return r.plan;
  };

  it('12 ned, lagan tempo 8:30 (trka ≈ 43 min): najduže trčanje pred trku ≥ trajanje trke − 10 min (L13/L14)', () => {
    const p = rw(12, 510);
    const race = P.runWalk.raceKm * 510;
    const sessions = p.weeks.flatMap((w) => w.days).filter((d) => d.role === 'session');
    const longest = Math.max(...sessions.map((d) => d.session.runTotalSec));
    expect(longest).toBeGreaterThanOrEqual(race - 600);
    expect(Math.max(...sessions.map((d) => d.level))).toBe(14);
    expect(p.weeks.at(-1)!.days.find((d) => d.role === 'race')!.race.continuous).toBe(true);
    expect(validatePlan(p).filter((v) => v.severity === 'error')).toEqual([]);
  });

  it('početnik (po osećaju i sa rezultatom): nema kontrolnog trčanja ni pre 2 obična dana kvaliteta', () => {
    for (const id of ['b-d4-14w-25km-e480-0', 'b-d3-8w-25km-v36-1']) {
      const p = planOf(input(id));
      expect(p.weeks.some((w) => w.test)).toBe(false);
      expect(p.weeks.flatMap((w) => w.days).some((d) => d.workout.qualityType === 'TEST_3K')).toBe(
        false
      );
    }
  });
});

describe('T1 posledica: prošlost su samo upisani dani', () => {
  it('r-d3-16w-12km-v58-1 (lagan dan manje u ned 2), umor, asOf sreda ned 2: dan ≤ asOf koji plan nema se ne dodaje', () => {
    const p = planOf(input('r-d3-16w-12km-v58-1'));
    const rec = (date: string) => ({ date, km: 6, durationSec: 2400, completed: true, rpe: 8 });
    const sun = p.weeks[0]!.endDate;
    const q = p.weeks[2]!.days.find((d) => d.workout.kind === 'quality')!;
    const at = addDays(p.weeks[1]!.startDate, 2);
    const r = adaptFiveKV2(
      p,
      { workouts: [rec(addDays(sun, -2)), rec(sun)], lockedDayIds: [q.date] },
      at
    );
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    const past = (pl: FiveKV2Plan) =>
      pl.weeks[1]!.days.filter((d) => d.date <= at || d.date === q.date);
    expect(JSON.stringify(past(r.plan))).toBe(JSON.stringify(past(p)));
  });
});

describe('T6: C3, C5, C11', () => {
  it('C3: kontrolno trčanje mešovite nedelje se ne odbacuje radi ostatka (kao dugi, ostaje kakvo je)', () => {
    // f-d4-6w-15km-e420-0 ned 3: test, lagan, lagan, dugi. Zaštićen prvi lagan toliko duži da ostatak staje samo bez
    // testa (b9c4728: test otpada) — test ostaje, lagan na minimumu, planirano > cilj (upozorenje).
    const p = planOf(input('f-d4-6w-15km-e420-0'));
    const w = p.weeks.find((x) => x.test)!;
    const test = w.days.find((d) => d.workout.qualityType === 'TEST_3K')!;
    const easy = w.days.filter((d) => d.role === 'easy');
    const long = w.days.find((d) => d.role === 'long')!;
    const min = easyMinKm(w.phase, p.paces);
    const floorNoTest = long.workout.km + Math.min(easy[1]!.workout.km, min) + min;
    const keptKm = Math.round((w.targetKm - floorNoTest - 0.1) * 100) / 100;
    const kept = [{ ...easy[0]!, workout: { ...easy[0]!.workout, km: keptKm } }];
    const m = mixedRemainder(w, kept, protectedKm(kept), p.paces);
    expect(m).not.toBeNull();
    expect(m!.over).toBe(true);
    expect(JSON.stringify(m!.days.find((d) => d.date === test.date))).toBe(JSON.stringify(test));
  });

  it('C5: trkačka nedelja veća od tapera — prvo otpada oštrenje, pa lagani u odmor', () => {
    const p = planOf(USER);
    const race = p.weeks.at(-1)!;
    const sh = race.days.find((d) => d.workout.kind === 'quality')!;
    const cap = Math.round((race.plannedKm - sh.workout.km) * 100) / 100;
    expect(raceWeekRest(race.days, p.input.raceDate, new Set(), cap)).toEqual([sh.date]);
    expect(daysBetween(sh.date, p.input.raceDate)).toBeGreaterThan(1);
  });

  it('C11: pouka 35 i u taperu i u nedelji sa danima odmora (osim trkačke)', () => {
    const pat = choosePattern(['tue', 'thu', 'sat', 'sun'] as Weekday[], 2);
    if (!pat.ok) throw new Error('šablon');
    const a = { days: 4 as const, beginner: false, feel: true };
    const p = feelPaces(480);
    const frame = (o: Partial<WeekFrame>): WeekFrame => ({
      index: 5,
      startDate: '2026-11-30',
      endDate: '2026-12-06',
      phase: 'base',
      deload: false,
      taperStep: null,
      test: false,
      ...o
    });
    const taper = buildTrainingWeek(
      frame({ phase: 'taper', taperStep: 1 }),
      12,
      pat.pattern,
      p,
      null,
      a,
      1
    );
    if (!taper.ok) throw new Error('taper');
    expect(taper.week.notes.some((n) => n.includes(SECOND_EASY_NOTE))).toBe(true);
    expect(taper.week.days.filter((d) => d.workout.kind === 'quality')).toHaveLength(1);
    // Nedelja sa danom odmora (bol ≥ 7): ista odluka kao bez odmora.
    let withRest = 0;
    for (let t = 12; t <= 20; t += 0.5) {
      const free = buildTrainingWeek(frame({ phase: 'peak' }), t, pat.pattern, p, null, a, 1);
      const rest = buildTrainingWeek(
        frame({ phase: 'peak', limits: { rest: ['2026-12-01'] } }),
        t,
        pat.pattern,
        p,
        null,
        a,
        1
      );
      if (!free.ok || !rest.ok) continue;
      const se = (w: PlanWeek): boolean => w.notes.some((n) => n.includes(SECOND_EASY_NOTE));
      expect([t, se(rest.week)]).toEqual([t, se(free.week)]);
      if (se(rest.week)) withRest++;
    }
    expect(withRest).toBeGreaterThan(0);
  });
});
