/* Sastav nedelje: H13 dužine (pouka 2; 24 km), H14 WU/CD, H5 rasterećenje, H7 taper, H8 trkačka nedelja
   (pouka 5), H15 3/5/6 dana, HI6, HI7 (pouka 28), Uslov 8. Primeri iz mreža 01 i 02. */

import { describe, expect, it } from 'vitest';
import { daysBetween } from './dates.ts';
import { generateHmV2 } from './generate.ts';
import type { HmV2Plan, PlanWeek } from './types.ts';
import { grid02Inputs, gridInputs, inputOf, SCHEDULES_BY_DAYS } from './testInputs.ts';
import { warmupCooldown } from './workouts.ts';

const GRID = [...gridInputs(), ...grid02Inputs()];
const plan = (id: string): HmV2Plan => {
  const r = generateHmV2(GRID.find((g) => g.id === id)!.input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const km = (w: PlanWeek, role: string): number[] =>
  w.days.filter((d) => d.role === role).map((d) => d.workout.km);

describe('H14 WU/CD po pojasu trenutnog obima', () => {
  it('< 40 km 15/10; 40–59,9 km 20/15; ≥ 60 km 25/15 (0,1 km)', () => {
    expect(warmupCooldown(39.9)).toEqual({ warmupSec: 900, cooldownSec: 600 });
    expect(warmupCooldown(40)).toEqual({ warmupSec: 1200, cooldownSec: 900 });
    expect(warmupCooldown(59.9)).toEqual({ warmupSec: 1200, cooldownSec: 900 });
    expect(warmupCooldown(60)).toEqual({ warmupSec: 1500, cooldownSec: 900 });
  });

  it('isti pojas za ceo plan, i za oštrenje', () => {
    const p = plan('12w-60km-v45-A-sun');
    for (const w of p.weeks)
      for (const d of w.days.filter((x) => x.workout.kind === 'quality')) {
        expect(d.workout.segments[0]!.sec).toBe(1500);
        expect(d.workout.segments.at(-1)!.sec).toBe(900);
      }
  });
});

describe('H13 dužine (pouka 2)', () => {
  it('dugi ≤ 40 % cilja i ≤ 150 min sporim E, ≥ lagan; lagan ≥ 4 km; korak 0,1 km', () => {
    for (const id of ['10w-30km-v70-A-sun', '16w-50km-v30-C-sat', '20w-60km-v55-B-sun']) {
      const p = plan(id);
      for (const w of p.weeks.filter((x) => x.phase !== 'race')) {
        const long = km(w, 'long')[0]!;
        expect(long * 10, `${id} ${w.index}`).toBeLessThanOrEqual(
          Math.floor(0.4 * w.targetKm * 10 + 1e-9)
        );
        expect(long * p.paces.E.slow).toBeLessThanOrEqual(9000);
        for (const e of km(w, 'easy')) {
          expect(e).toBeLessThanOrEqual(long);
          expect(e).toBeGreaterThanOrEqual(4);
          expect(Math.round(e * 10)).toBeCloseTo(e * 10, 6);
        }
      }
    }
  });

  it('spor trkač velikog obima: dugi na 150 min (ograničenje kapaciteta, CAPACITY_LIMITED)', () => {
    const p = plan('16w-50km-v30-C-sat');
    const cap = Math.floor((9000 / p.paces.E.slow) * 10) / 10;
    expect(km(p.weeks[0]!, 'long')[0]).toBe(cap);
    expect(p.warnings.some((w) => w.rule === 'CAPACITY_LIMITED')).toBe(true);
    // Faza 4a N11: kapacitet jednom po planu — upozorenje CAPACITY_LIMITED (sa vrhom), bez napomene plana.
    expect(p.warnings.find((v) => v.rule === 'CAPACITY_LIMITED')!.message).toContain(
      'uz dugi ≤ 150 min'
    );
  });
});

describe('H13 dugi ≤ 24 km (odluka organizatora HM-01 → 02), svi brojevi dana', () => {
  it('brz trkač velikog obima: dugi na 24 km, ne preko (4 dana 60 km — u HM-01 do 28 km; 6 dana 90 km)', () => {
    for (const id of ['16w-60km-v60-A-sun', 'd6-16w-90km-v60-A-sun', 'd5-16w-75km-v70-B-sun']) {
      const p = plan(id);
      const longs = p.weeks.flatMap((w) => km(w, 'long'));
      expect(Math.max(...longs), id).toBe(24);
      // Granica 24 km ne spušta vrh (merenje: 0 nižih vrhova u mreži 02) — obim ide u lagane dane.
      expect(p.peakKm, id).toBe(p.peakCapKm);
      for (const w of p.weeks)
        for (const e of km(w, 'easy')) expect(e, `${id} ${w.index}`).toBeLessThanOrEqual(24);
    }
  });
});

describe('HI7 (pouka 28) skorašnji najduži trk', () => {
  const gen = (o: { recentLongRunKm?: number; km?: number; vdot?: number }): HmV2Plan => {
    const r = generateHmV2(
      inputOf({
        weeks: 12,
        km: o.km ?? 40,
        vdot: o.vdot ?? 45,
        days: SCHEDULES_BY_DAYS[4].A.days,
        ...o
      })
    );
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    return r.plan;
  };

  it('dugi SVAKE nedelje ≤ max(1,1 × L, L + 1,0), L = najduži prethodne 4 nedelje (ned 1–4 i r); ned 1 sme ispod obima na granici', () => {
    const free = gen({});
    expect(km(free.weeks[0]!, 'long')[0]).toBe(16); // 40 % od 40 km
    const p8 = gen({ recentLongRunKm: 8 }); // max(8,8; 9,0) = 9,0
    const l = p8.weeks.map((w) => km(w, 'long')[0] ?? 0);
    expect(l[0]).toBe(9);
    expect(p8.weeks[0]!.targetKm).toBeLessThan(40);
    expect(p8.weeks[0]!.notes.join()).toContain('— na granici');
    expect(p8.warnings.find((v) => v.rule === 'CAPACITY_LIMITED')!.message).toContain(
      'prethodne 4 nedelje (pouka 28)'
    );
    // Kotrljanje: 9,0 → 10,0 → 11,0 → 12,1 (max(1,1 × L, L + 1)); skok ned 1 → 2 ≤ 1 km ili 10 %.
    expect(l.slice(0, 4)).toEqual([9, 10, 11, 12.1]);
    for (let i = 1; i < l.length; i++) {
      const L = Math.max(...l.slice(Math.max(0, i - 4), i), i < 4 ? 8 : 0);
      if (l[i]! > 0)
        expect(l[i]!, `ned ${i + 1}`).toBeLessThanOrEqual(
          Math.max(Math.floor(1.1 * L * 10 + 1e-9), L * 10 + 10) / 10
        );
    }
    const p20 = gen({ recentLongRunKm: 14.5, km: 50 }); // max(15,95→15,9; 15,5) = 15,9
    expect(km(p20.weeks[0]!, 'long')[0]).toBe(15.9);
    // Granica viša od dugih bez ulaza: plan isti kao bez ulaza (osim ulaza i napomene nedelje 1).
    const p30 = gen({ recentLongRunKm: 30 });
    expect(p30.weeks.slice(1)).toEqual(free.weeks.slice(1));
    expect(p30.weeks[0]!.days).toEqual(free.weeks[0]!.days);
  });

  it('u nedeljama 2–4 skorašnji najduži ulazi u L (brz trkač 30 km: ned 1 dugi 11,0; ned 2 12,1 bez r, 12,4 uz r = 12)', () => {
    const at = (r?: number) =>
      gen({ km: 30, vdot: 60, ...(r !== undefined ? { recentLongRunKm: r } : {}) }).weeks.map(
        (w) => km(w, 'long')[0]
      );
    expect(at().slice(0, 2)).toEqual([11, 12.1]); // max(1,1 × 11,0; 12,0) = 12,1
    expect(at(12).slice(0, 2)).toEqual([11, 12.4]); // L = max(11,0; 12) → 13,2; dugi po udelu 12,4
  });

  it('P1: neizvodljiva nedelja uz dati r → RECENT_LONG_TOO_SHORT sa pragom i preporukom', () => {
    const r = generateHmV2(
      inputOf({
        weeks: 12,
        km: 35,
        vdot: 40,
        days: SCHEDULES_BY_DAYS[3].A.days,
        recentLongRunKm: 6
      })
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons.map((x) => [x.code, x.week])).toEqual([['RECENT_LONG_TOO_SHORT', 1]]);
    const m = /izvodljiv od (\d+),(\d) km/.exec(r.reasons[0]!.message)!;
    const thr = Number(`${m[1]}.${m[2]}`);
    expect(r.reasons[0]!.message).toContain('10K plan');
    const at = (x: number) =>
      generateHmV2(
        inputOf({
          weeks: 12,
          km: 35,
          vdot: 40,
          days: SCHEDULES_BY_DAYS[3].A.days,
          recentLongRunKm: x
        })
      ).ok;
    expect([at(thr - 0.5), at(thr)]).toEqual([false, true]);
  });

  it('bez ulaza: napomena nedelje 1 sa pragom (najmanji r za koji je dugi u granici)', () => {
    const n = gen({}).weeks[0]!.notes.find((x) => x.startsWith('Dugi nedelje 1'))!;
    // Dugi 16,0 km: 1,1 × 14,6 = 16,06 ≥ 16 (14,5 → 15,95).
    expect(n).toContain('16,0 km pretpostavlja skorašnji najduži trk od bar 14,6 km');
  });
});

describe('H15 3/5/6 dana, HI6', () => {
  it('3 dana: jedan kvalitet (T kont. → T cruise → RP), rasterećenje T na danu Q1, taper samo RP, trkačka 3 dana', () => {
    const p = plan('d3-14w-35km-v45-A-sun');
    const slots = (pred: (w: PlanWeek) => boolean): string[] => [
      ...new Set(
        p.weeks
          .filter(pred)
          .flatMap((w) =>
            w.days
              .filter((d) => d.workout.dose)
              .map((d) => `${w.phase}:${d.role}:${d.workout.dose!.ladder}`)
          )
      )
    ];
    expect(slots((w) => !w.deload && w.phase !== 'race')).toEqual([
      'base:q1:T_continuous',
      'development:q1:T_cruise',
      'specific:q1:RP',
      'taper:q1:RP'
    ]);
    expect(slots((w) => w.deload).every((x) => /:q1:T_(continuous|cruise)$/.test(x))).toBe(true);
    expect(p.weeks.some((w) => w.deload)).toBe(true);
    for (const w of p.weeks.filter((x) => x.phase !== 'race')) expect(w.days).toHaveLength(3);
    expect(p.weeks.at(-1)!.days).toHaveLength(3); // min(3, 5) sa trkom
  });

  it('5/6 dana: lagani jednaki (razlika ≤ 0,1 km, raniji dan +0,1); trkačka 6 dana = 5 dana sa trkom', () => {
    for (const id of ['d5-12w-50km-v45-A-sun', 'd6-12w-60km-v50-B-sun']) {
      const p = plan(id);
      for (const w of p.weeks.filter((x) => x.phase !== 'race')) {
        const e = w.days.filter((d) => d.role === 'easy').map((d) => Math.round(d.workout.km * 10));
        expect(Math.max(...e) - Math.min(...e), `${id} ${w.index}`).toBeLessThanOrEqual(1);
        expect(e, `${id} ${w.index}`).toEqual([...e].sort((a, b) => b - a));
      }
    }
    const r6 = plan('d6-12w-60km-v50-B-sun').weeks.at(-1)!;
    expect(r6.days).toHaveLength(5);
    expect(r6.days.some((d) => d.weekday === 'tue')).toBe(false); // otpada dugi (ned = trka) i najraniji lagan
  });
});

describe('H5 rasterećenje i H7 taper', () => {
  const p = plan('12w-40km-v45-A-sun');
  const w = (i: number): PlanWeek => p.weeks[i - 1]!;

  it('rasterećenje: cilj 0,8 × poslednji ne-rasteretni, jedan T kvalitet na danu Q2, dugi 0,8 × poslednji', () => {
    const d = p.weeks.filter((x) => x.deload).map((x) => x.index);
    expect(d).toEqual([5, 9]);
    expect(w(5).targetKm).toBe(Math.round(0.8 * w(4).targetKm * 10) / 10);
    const q = w(5).days.filter((x) => x.workout.kind === 'quality');
    expect(q.map((x) => [x.role, x.workout.dose!.zone, x.workout.dose!.doseM])).toEqual([
      ['q2', 'T', 2000]
    ]);
    expect(km(w(5), 'long')[0]).toBe(Math.floor(0.8 * km(w(4), 'long')[0]! * 10) / 10);
    expect(km(w(5), 'easy')).toHaveLength(2);
  });

  it('taper: 0,7 × vrh; RP i T ≈ 60 %; dugi ≤ 0,6 × najduži; svi dani', () => {
    const t = p.weeks.find((x) => x.phase === 'taper')!;
    expect(t.targetKm).toBe(Math.round(0.7 * p.peakKm * 10) / 10);
    expect(t.days).toHaveLength(4);
    const longest = Math.max(...p.weeks.flatMap((x) => km(x, 'long')));
    expect(km(t, 'long')[0]!).toBeLessThanOrEqual(Math.floor(0.6 * longest * 10) / 10);
    const doses = t.days.filter((x) => x.workout.dose).map((x) => [x.role, x.workout.dose!.zone]);
    expect(doses).toEqual([
      ['q1', 'RP'],
      ['q2', 'T']
    ]);
  });
});

describe('H8 trkačka nedelja (pouka 5)', () => {
  it('trka nedelja: oštrenje 2 × 2000 m RP (2:00) ≥ 3 dana pre trke, dan pred trku 20 min + 4 × 20 s, lagan ≤ taper', () => {
    for (const id of [
      '12w-40km-v45-A-sun',
      '12w-40km-v45-B-sun',
      '12w-40km-v45-C-sat',
      '12w-40km-v45-A-sat'
    ]) {
      const p = plan(id);
      const r = p.weeks.at(-1)!;
      const t = p.weeks.at(-2)!;
      const race = r.days.find((d) => d.role === 'race')!;
      expect(race.date).toBe(p.input.raceDate);
      expect(race.countsToWeek).toBe(false);
      expect(race.workout.segments.map((s) => [s.kind, s.kind === 'race' ? s.km : s.sec])).toEqual([
        ['warmup', 600],
        ['race', 21.1],
        ['cooldown', 600]
      ]);
      expect(r.days).toHaveLength(4); // min(4, 5) dana sa trkom
      expect(r.days.some((d) => d.role === 'long')).toBe(false);
      const sh = r.days.filter((d) => d.role === 'sharpener');
      expect(sh, id).toHaveLength(1);
      expect(daysBetween(sh[0]!.date, p.input.raceDate)).toBeGreaterThanOrEqual(3);
      expect(sh[0]!.workout.blocks[1]).toEqual({
        kind: 'reps',
        zone: 'RP',
        reps: 2,
        rep: { m: 2000 },
        recovery: { sec: 120 }
      });
      const tRp = t.days.find((d) => d.role === 'q1')!.workout.dose!.doseM;
      expect(sh[0]!.workout.dose!.doseM).toBeLessThanOrEqual(tRp);
      const eve = r.days.find((d) => daysBetween(d.date, p.input.raceDate) === 1);
      if (eve) {
        expect(eve.role).toBe('eve');
        expect(eve.workout.sec).toBeLessThanOrEqual(1800);
      }
      const tEasy = Math.min(...km(t, 'easy'));
      for (const e of r.days.filter((d) => d.role === 'easy')) {
        expect(e.workout.km).toBeLessThanOrEqual(tEasy);
        expect(e.workout.sec).toBeLessThanOrEqual(2100);
      }
      expect(r.plannedKm).toBeLessThanOrEqual(t.plannedKm);
      expect(r.targetKm).toBe(Math.round(r.plannedKm * 10) / 10);
      expect(r.plannedKm + 21.1).toBeGreaterThanOrEqual(16); // Uslov 8 sa trkom
    }
  });

  it('kratak lagan tapera: lagan trkačke nedelje u km (= najkraći lagan tapera)', () => {
    const p = plan('10w-30km-v45-A-sun');
    const r = p.weeks.at(-1)!;
    const t = p.weeks.at(-2)!;
    const e = r.days.find((d) => d.role === 'easy')!;
    expect(e.workout.blocks[0]!.kind).toBe('easy');
    expect(e.workout.km).toBe(Math.min(...km(t, 'easy')));
  });
});

describe('Uslov 8: upotrebljivost', () => {
  it('nema praznog treninga; nedelja ≥ 16 km; dugi ≥ lagan; planirano = cilj', () => {
    for (const id of ['10w-30km-v30-A-sun', '20w-60km-v70-C-sat']) {
      const p = plan(id);
      for (const w of p.weeks) {
        for (const d of w.days) expect(d.workout.km).toBeGreaterThan(0);
        if (w.phase !== 'race') expect(w.plannedKm).toBeGreaterThanOrEqual(16);
        expect(Math.abs(w.plannedKm - w.targetKm)).toBeLessThanOrEqual(0.1 + 1e-9);
      }
    }
  });
});
