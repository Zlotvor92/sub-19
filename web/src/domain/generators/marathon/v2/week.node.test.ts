import { beforeAll, describe, expect, it } from 'vitest';
import { daysBetween } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { longTimeCap10 } from './lengths.ts';
import { midEasy } from './paces.ts';
import { MARATHON_V2_POLICY as P } from './policy.ts';
import { inputOf, SCHEDULES, type Profile } from './testInputs.ts';
import type { MarathonV2Plan, PlanWeek } from './types.ts';

/* Sastav nedelje: izgradnja (M10, M13, M14), rasterećenje (M5), taper (M7), trkačka nedelja (M8). */

function plan(pr: Partial<Profile> = {}): MarathonV2Plan {
  const r = generateMarathonV2(
    inputOf({ weeks: 16, km: 45, vdot: 45, days: SCHEDULES.A.days, long: 'sun', ...pr })
  );
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}
const to10 = (km: number): number => Math.round(km * 10);
const role = (w: PlanWeek, r: string) => w.days.filter((d) => d.role === r);

describe('izgradnja (M10, M13, M14)', () => {
  let p: MarathonV2Plan;
  beforeAll(() => {
    p = plan();
  });
  it('uloge po šablonu, dugi = min(40 % cilja, 150 min) i ≥ lagan, lagan ≥ 5 km, planirano = cilj', () => {
    for (const w of p.weeks.filter(
      (x) => !x.deload && ['base', 'development', 'specific'].includes(x.phase)
    )) {
      expect(w.days.map((d) => `${d.weekday}:${d.role}`)).toEqual([
        'tue:q1',
        'thu:q2',
        'sat:easy',
        'sun:long'
      ]);
      const long = role(w, 'long')[0]!;
      const easy = role(w, 'easy')[0]!;
      expect(to10(long.workout.km)).toBe(
        Math.min(Math.floor(0.4 * to10(w.targetKm) + 1e-9), longTimeCap10(p.paces))
      );
      expect(long.workout.km).toBeGreaterThanOrEqual(easy.workout.km);
      expect(easy.workout.km).toBeGreaterThanOrEqual(5);
      expect(Math.abs(w.plannedKm - w.targetKm)).toBeLessThanOrEqual(0.1);
    }
  });

  it('WU/CD po pojasu trenutnog obima, isti kroz plan (45 km → 15/10; 55 km → 20/15)', () => {
    const wc = (q: MarathonV2Plan) =>
      new Set(
        q.weeks.flatMap((w) =>
          w.days
            .filter((d) => d.workout.kind === 'quality')
            .map((d) => `${d.workout.segments[0]!.sec}/${d.workout.segments.at(-1)!.sec}`)
        )
      );
    expect([...wc(p)]).toEqual(['900/600']);
    expect([...wc(plan({ km: 55 }))]).toEqual(['1200/900']);
  });

  it('faza određuje kvalitet: baza R + T kont., razvoj I + T cruise, specifično MP + T cruise', () => {
    const types = (ph: string) =>
      new Set(
        p.weeks
          .filter((w) => w.phase === ph && !w.deload)
          .flatMap((w) =>
            w.days
              .filter((d) => d.workout.qualityType)
              .map((d) => `${d.role}:${d.workout.qualityType}`)
          )
      );
    expect([...types('base')].sort()).toEqual(['q1:R', 'q2:T_continuous']);
    expect([...types('development')].every((t) => /^q1:I$|^q2:T_/.test(t))).toBe(true);
    expect([...types('specific')].every((t) => /^q1:MP$|^q2:T_/.test(t))).toBe(true);
  });
});

describe('M5 rasterećenje', () => {
  let p: MarathonV2Plan;
  beforeAll(() => {
    p = plan();
  });
  it('cilj 0,8 × poslednji ne-rasteretni; jedan kvalitet T na Q2; dugi 0,8 × poslednji dugi; ostali lagani', () => {
    for (const w of p.weeks.filter((x) => x.deload)) {
      const prev = p.weeks
        .slice(0, w.index - 1)
        .filter((x) => !x.deload && ['base', 'development', 'specific'].includes(x.phase))
        .at(-1)!;
      expect(to10(w.targetKm)).toBe(Math.round(0.8 * to10(prev.targetKm)));
      expect(
        w.days
          .filter((d) => d.workout.kind === 'quality')
          .map((d) => `${d.role}:${d.workout.dose!.zone}`)
      ).toEqual(['q2:T']);
      expect(to10(role(w, 'long')[0]!.workout.km)).toBe(
        Math.floor(0.8 * to10(role(prev, 'long')[0]!.workout.km) + 1e-9)
      );
      expect(role(w, 'easy')).toHaveLength(2);
    }
  });
});

describe('M7 taper (2 nedelje)', () => {
  it('N−2: cilj ≤ 0,8 × vrh, MP i T, dugi ≤ 0,65 × najduži; N−1: cilj ≤ 0,6 × vrh, MP bez T, dugi ≤ 0,45 × najduži', () => {
    const p = plan();
    const N = p.weeks.length;
    const [t0, t1] = [p.weeks[N - 3]!, p.weeks[N - 2]!];
    const longest = Math.max(
      ...p.weeks.slice(0, N - 3).flatMap((w) => role(w, 'long').map((d) => to10(d.workout.km)))
    );
    expect([t0.phase, t1.phase]).toEqual(['taper', 'taper']);
    expect(to10(t0.nominalKm)).toBe(Math.round(0.8 * to10(p.peakKm)));
    expect(to10(t1.nominalKm)).toBe(Math.round(0.6 * to10(p.peakKm)));
    expect(t0.targetKm).toBeLessThanOrEqual(t0.nominalKm);
    expect(t1.targetKm).toBeLessThanOrEqual(t1.nominalKm);
    expect(t0.days.filter((d) => d.workout.dose).map((d) => d.workout.dose!.zone)).toEqual([
      'MP',
      'T'
    ]);
    expect(t1.days.filter((d) => d.workout.dose).map((d) => d.workout.dose!.zone)).toEqual(['MP']);
    expect(to10(role(t0, 'long')[0]!.workout.km)).toBeLessThanOrEqual(Math.floor(0.65 * longest));
    expect(to10(role(t1, 'long')[0]!.workout.km)).toBeLessThanOrEqual(Math.floor(0.45 * longest));
    expect(t0.days).toHaveLength(4);
    expect(t1.days).toHaveLength(4);
    expect(role(t1, 'easy')).toHaveLength(2);
  });
});

describe('M8 trkačka nedelja', () => {
  it('trka zamenjuje dugi; oštrenje 2 × 2000 m MP (2:00) ≥ 3 dana pre trke; dan pred trku 20 min + 4 × 20 s; trka 42,2 km + WU 5 min van obima', () => {
    const p = plan();
    const w = p.weeks.at(-1)!;
    expect(w.days.map((d) => `${d.weekday}:${d.role}`)).toEqual([
      'tue:easy',
      'thu:sharpener',
      'sat:eve',
      'sun:race'
    ]);
    const s = role(w, 'sharpener')[0]!;
    expect(s.workout.dose!.structure).toEqual({ form: 'reps', reps: 2, repM: 2000 });
    expect(s.workout.segments.filter((x) => x.kind === 'recovery').map((x) => x.sec)).toEqual([
      120
    ]);
    expect(daysBetween(s.date, p.input.raceDate)).toBeGreaterThanOrEqual(3);
    const eve = role(w, 'eve')[0]!;
    expect(eve.workout.sec).toBeLessThanOrEqual(1800);
    expect(eve.workout.segments.filter((x) => x.kind === 'stride')).toHaveLength(4);
    const race = role(w, 'race')[0]!;
    expect(race.countsToWeek).toBe(false);
    expect(race.workout.segments.map((x) => [x.kind, x.kind === 'race' ? x.km : x.sec])).toEqual([
      ['warmup', 300],
      ['race', 42.2]
    ]);
    expect(w.plannedKm + 42.2).toBeGreaterThanOrEqual(P.days[4].weekMinKm);
  });

  it('lagan = min(30 min E, najkraći lagan N−1); trkačka (bez trke) ≤ N−1; oštrenje ≤ MP doza N−1', () => {
    for (const pr of [
      {},
      { km: 35, vdot: 70 },
      { km: 65, vdot: 30 },
      { weeks: 12, km: 40, vdot: 55 }
    ]) {
      const p = plan(pr);
      const N = p.weeks.length;
      const [t1, w] = [p.weeks[N - 2]!, p.weeks[N - 1]!];
      const easyN1 = Math.min(...role(t1, 'easy').map((d) => Math.round(d.workout.km * 100)));
      const timed = Math.round((1800 * 100) / midEasy(p.paces));
      for (const d of role(w, 'easy'))
        expect(Math.round(d.workout.km * 100)).toBe(Math.min(timed, easyN1));
      expect(w.plannedKm).toBeLessThanOrEqual(t1.plannedKm);
      const mpN1 = t1.days.find((d) => d.workout.dose?.zone === 'MP')?.workout.dose?.doseM ?? 0;
      for (const d of role(w, 'sharpener')) expect(d.workout.dose!.doseM).toBeLessThanOrEqual(mpN1);
    }
  });

  it('trka subotom kada subota nije dan trčanja (B): otpada dan dugog, ostaju 3 dana + trka', () => {
    const p = plan({ days: SCHEDULES.B.days, long: 'sun', race: 'sat' });
    const w = p.weeks.at(-1)!;
    expect(w.days.map((d) => d.weekday)).toEqual(['mon', 'wed', 'fri', 'sat']);
    expect(w.days.at(-1)!.role).toBe('race');
    expect(w.days.some((d) => d.weekday === 'sun')).toBe(false);
  });
});

describe('M13 upozorenje MARATHON_LONG_SHORT', () => {
  it('najduži dugi < 26 km → upozorenje; ≥ 26 km → bez upozorenja', () => {
    const short = plan({ km: 40, vdot: 40 });
    expect(short.warnings.map((w) => w.rule)).toContain('MARATHON_LONG_SHORT');
    const long = plan({ weeks: 20, km: 65, vdot: 60 });
    const longest = Math.max(
      ...long.weeks.flatMap((w) => role(w, 'long').map((d) => d.workout.km))
    );
    expect(longest).toBeGreaterThanOrEqual(26);
    expect(long.warnings.map((w) => w.rule)).not.toContain('MARATHON_LONG_SHORT');
  });
});
