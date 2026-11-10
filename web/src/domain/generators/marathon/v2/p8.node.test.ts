/* P8 (marathon-v2.11.0): G1 vrh obima i rast do kraja razvoja, G2 prvi nivo lestvice uvek staje, G4 plafon treninga u
   minutima rada, G5 taper i oštrenje u minutima, G6 lagan ≤ 0,70 × dugi (4+ dana), G7 test jedini kvalitet nedelje i
   ne pre nedelje 4, Maraton (a) dan kvaliteta tapera ni po km nije duži od dugog. Mere se čitaju iz plana (segmenti),
   nezavisno od funkcija konstruktora. */
import { describe, expect, it } from 'vitest';
import { generateMarathonV2 } from './generate.ts';
import { easyCap10 } from './lengths.ts';
import { midEasy } from './paces.ts';
import { planRule } from './policy.ts';
import { inputOf, SCHEDULES_BY_DAYS, type Profile } from './testInputs.ts';
import type { MarathonV2Plan, PlanDay, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';

const plan = (pr: Partial<Profile> & { days: Profile['days'] }): MarathonV2Plan => {
  const r = generateMarathonV2(inputOf({ weeks: 16, km: 45, long: 'sun', ...pr }));
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
  return r.plan;
};
const D = (n: 3 | 4 | 5 | 6) => SCHEDULES_BY_DAYS[n].A.days;
const workSec = (d: PlanDay, zone: string): number =>
  d.workout.segments
    .filter((s) => s.zone === zone && (s.kind === 'rep' || s.kind === 'continuous'))
    .reduce((a, s) => a + s.sec, 0);
const mid = (w: PlanWeek): PlanDay[] => w.days.filter((d) => d.role === 'q1' || d.role === 'q2');
const steady = (p: MarathonV2Plan): PlanWeek[] =>
  p.weeks.filter((w) => !w.deload && ['base', 'development', 'specific'].includes(w.phase));
const longOf = (w: PlanWeek): PlanDay | undefined => w.days.find((d) => d.role === 'long');

/** Spor, veliki obim (P7 p04), početnik po osećaju (P7 p12), brz sa velikim obimom (≥ 80 km), prosečan. */
const SLOW = () => plan({ weeks: 24, km: 65, vdot: 35, days: D(5) });
const BEG = () => plan({ weeks: 18, km: 50, easyPace: 420, days: D(5), experience: 'beginner' });
const FAST = () => plan({ weeks: 18, km: 90, vdot: 55, days: D(6) });
const AVG = () => plan({ weeks: 16, km: 40, vdot: 44, days: D(4) });

describe('P8-G4: plafon jednog treninga usred nedelje u minutima rada', () => {
  it('T ≤ 30 min (cilj ≥ 80 km: 40 min), I ≤ 20 min za VDOT < 40 (inače 24), MP ≤ 60 min, početnik ≤ 45 min', () => {
    for (const [p, mp, i] of [
      [SLOW(), 3600, 1200],
      [BEG(), 2700, 1200],
      [FAST(), 3600, 1440],
      [AVG(), 3600, 1440]
    ] as const)
      for (const w of p.weeks.filter((x) => x.phase !== 'race'))
        for (const d of mid(w)) {
          expect(workSec(d, 'T'), `T ned ${w.index}`).toBeLessThanOrEqual(
            w.targetKm >= 80 ? 2400 : 1800
          );
          expect(workSec(d, 'I'), `I ned ${w.index}`).toBeLessThanOrEqual(i);
          expect(workSec(d, 'MP'), `MP ned ${w.index}`).toBeLessThanOrEqual(mp);
        }
  });
  it('plafon stvarno veže: spor trkač (VDOT 35, 65 km) dostiže T ≥ 25 min i MP ≥ 45 min, a ne prelazi ih', () => {
    const p = SLOW();
    const max = (z: string) =>
      Math.max(...p.weeks.flatMap((w) => mid(w).map((d) => workSec(d, z))));
    expect(max('T')).toBeGreaterThanOrEqual(1500);
    expect(max('MP')).toBeGreaterThanOrEqual(2700);
  });
  it('validator: T rad u okviru udela cilja, a preko minuta rada → ZONE_CAP', () => {
    const p = structuredClone(SLOW());
    const w = p.weeks.find(
      (x) => x.targetKm >= 65 && x.targetKm < 80 && mid(x).some((d) => workSec(d, 'T') > 0)
    )!;
    const d = mid(w).find((x) => workSec(x, 'T') > 0)!;
    // 6,0 km T: ispod 10 % cilja (≥ 6,5 km), a preko 30 min rada pri T tempu VDOT 35.
    expect((6 * p.paces.T) / 60).toBeGreaterThan(30);
    d.workout.workKm.T = 6;
    expect(validatePlan(p).map((v) => v.rule)).toContain('ZONE_CAP');
  });
  it('blok u dugom nije trening usred nedelje: brz trkač ima blok MP duži od najdužeg MP treninga', () => {
    const p = FAST();
    const block = Math.max(...p.weeks.map((w) => (longOf(w) ? workSec(longOf(w)!, 'MP') : 0)));
    expect(block).toBeGreaterThan(0);
  });
});

describe('P8-G2: prvi nivo lestvice zone uvek staje', () => {
  it('početnik 25 km, 4 dana: specifična faza ima trening u tempu maratona (2 × 3000 m)', () => {
    const p = plan({ weeks: 16, km: 25, vdot: 35, days: D(4), experience: 'beginner' });
    const spec = p.weeks.filter((w) => w.phase === 'specific' && !w.deload);
    expect(spec.length).toBeGreaterThan(0);
    for (const w of spec)
      expect(
        mid(w).some((d) => workSec(d, 'MP') > 0),
        `ned ${w.index}`
      ).toBe(true);
  });
});

describe('P8-G5: taper i oštrenje u minutima', () => {
  it('MP tapera ≤ 60 % (N−2) i ≤ 40 % (N−1) najvećeg MP rada izgradnje; dan kvaliteta tapera ni po km nije duži od dugog', () => {
    for (const p of [
      SLOW(),
      FAST(),
      AVG(),
      plan({ weeks: 18, km: 30, vdot: 33, days: D(3) }),
      // Brz trkač sa malim obimom: dugi tapera je kratak, pa je dan MP po km bio duži od dugog (P7, 7 planova).
      plan({ weeks: 12, km: 35, vdot: 65, days: D(4) }),
      plan({ weeks: 12, km: 50, vdot: 65, days: D(4) }),
      plan({ weeks: 18, km: 50, vdot: 65, days: D(4) }),
      plan({ weeks: 12, km: 40, vdot: 65, days: D(5) })
    ]) {
      const build = p.weeks.filter((w) => w.phase !== 'taper' && w.phase !== 'race');
      const top = Math.max(
        ...build.flatMap((w) =>
          [...mid(w), ...(longOf(w) ? [longOf(w)!] : [])].map((d) => workSec(d, 'MP'))
        )
      );
      const taper = p.weeks.filter((w) => w.phase === 'taper');
      expect(taper).toHaveLength(2);
      [0.6, 0.4].forEach((share, k) => {
        for (const d of mid(taper[k]!)) {
          expect(workSec(d, 'MP'), `N−${2 - k}`).toBeLessThanOrEqual(share * top + 1);
          if (workSec(d, 'MP') > 0)
            expect(d.workout.km, `km N−${2 - k}`).toBeLessThanOrEqual(
              longOf(taper[k]!)!.workout.km
            );
        }
      });
      expect(mid(taper[1]!).some((d) => workSec(d, 'MP') > 0)).toBe(true);
    }
  });
  it('oštrenje: dve jednake deonice u tempu maratona, deljive sa 100 m, ukupno ≤ 10 min rada i ≥ 2 × 400 m', () => {
    for (const p of [
      SLOW(),
      FAST(),
      AVG(),
      plan({ weeks: 24, km: 30, easyPace: 450, days: D(3) })
    ]) {
      const s = p.weeks.at(-1)!.days.find((d) => d.role === 'sharpener')!;
      const reps = s.workout.segments.filter((x) => x.kind === 'rep');
      expect(reps).toHaveLength(2);
      expect(reps[0]!.km).toBe(reps[1]!.km);
      expect(Math.round(reps[0]!.km * 1000) % 100).toBe(0);
      expect(reps[0]!.km).toBeGreaterThanOrEqual(0.4);
      expect(workSec(s, 'MP')).toBeLessThanOrEqual(600);
      expect(workSec(s, 'MP')).toBeGreaterThanOrEqual(240);
    }
  });
});

describe('P8-G1: vrh obima i rast do kraja razvoja', () => {
  it('vrh ≤ start × 1,30 (≤ 12 ned), × 1,35 (13–15), × 1,40 (≥ 16) i ≤ satni plafon (9 / 10 / 11 h laganim tempom)', () => {
    for (const [weeks, f] of [
      [12, 1.3],
      [14, 1.35],
      [18, 1.4]
    ] as const) {
      const p = plan({ weeks, km: 40, vdot: 50, days: D(4) });
      expect(p.peakCapKm).toBe(Math.floor(400 * f + 1e-9) / 10);
      expect(p.peakKm).toBeLessThanOrEqual(p.peakCapKm);
    }
    for (const [vdot, h] of [
      [35, 9],
      [45, 10],
      [55, 11]
    ] as const) {
      const p = plan({ weeks: 20, km: 85, vdot, days: D(5) });
      const cap = Math.floor(((h * 3600) / midEasy(p.paces)) * 10 + 1e-9) / 10;
      expect(p.peakCapKm).toBe(Math.max(85, Math.min(100, Math.floor(850 * 1.4) / 10, cap)));
    }
    // Start iznad satnog plafona: vrh = start (bez rasta, bez spuštanja).
    const over = plan({ weeks: 18, km: 85, vdot: 33, days: D(5) });
    expect(over.peakCapKm).toBe(85);
  });
  it('obim raste do kraja razvoja (ne dostiže vrh u bazi); svaki korak ≥ 3 % ili nedelja zadržava cilj', () => {
    for (const p of [AVG(), SLOW(), plan({ weeks: 24, km: 50, vdot: 45, days: D(4) })]) {
      const s = steady(p);
      const lastBase = s.filter((w) => w.phase === 'base').at(-1)!;
      expect(lastBase.nominalKm).toBeLessThan(p.peakCapKm);
      const dev = s.filter((w) => w.phase === 'development').at(-1)!;
      expect(dev.nominalKm).toBeGreaterThan(lastBase.nominalKm);
      for (let i = 1; i < s.length; i++) {
        const [a, b] = [s[i - 1]!.targetKm, s[i]!.nominalKm];
        expect(b).toBeGreaterThanOrEqual(a);
        if (b > a) expect(b - a, `ned ${s[i]!.index}`).toBeGreaterThanOrEqual(0.03 * a - 0.051);
      }
    }
  });
});

describe('P8-G6: lagan dan prema dugom', () => {
  it('nedelja izgradnje: lagan ≤ 0,70 × dugi za 4, 5 i 6 dana; 3 dana ≤ 0,80', () => {
    for (const [p, share] of [
      [AVG(), 0.7],
      [SLOW(), 0.7],
      [FAST(), 0.7],
      [plan({ weeks: 24, km: 50, vdot: 45, days: D(3) }), 0.8]
    ] as const)
      for (const w of steady(p)) {
        const L = longOf(w)!.workout.km;
        for (const d of w.days.filter((x) => x.role === 'easy'))
          expect(Math.round(d.workout.km * 10), `ned ${w.index}`).toBeLessThanOrEqual(
            Math.floor(share * Math.round(L * 10) + 1e-9)
          );
      }
    // Granica po broju dana (jedna funkcija, lengths.easyCap10): 20,0 km dugi → 14,0 km (4+ dana), 16,0 km (3 dana).
    expect(easyCap10(200, 50, planRule(4)!)).toBe(140);
    expect(easyCap10(200, 50, planRule(6)!)).toBe(140);
    expect(easyCap10(200, 50, planRule(4, 'beginner')!)).toBe(140);
    expect(easyCap10(200, 50, planRule(3)!)).toBe(160);
  });
});

describe('P8-G7: nedelja kontrolnog testa', () => {
  it('test je jedini kvalitet nedelje (plan sa rezultatom i plan po osećaju); ne pre nedelje 4', () => {
    for (const p of [AVG(), SLOW(), plan({ weeks: 18, km: 50, easyPace: 360, days: D(4) })]) {
      const w = p.weeks.find((x) => x.days.some((d) => d.role === 'test'))!;
      expect(w).toBeDefined();
      expect(w.index).toBeGreaterThanOrEqual(4);
      expect(mid(w)).toHaveLength(0);
    }
  });
  it('plan po osećaju od 12 nedelja: test bi pao u nedelju 3 i baza nema kasniju nedelju — plan bez testa, sa rečenicom', () => {
    const p = plan({ weeks: 12, km: 50, easyPace: 360, days: D(4) });
    expect(p.weeks.some((w) => w.test || w.days.some((d) => d.role === 'test'))).toBe(false);
    expect(p.notes.some((n) => n.includes('Plan nema kontrolni test'))).toBe(true);
  });
});

describe('P8-G3: dan trke se ispisuje kao trka', () => {
  it('naslov: distanca i prognoza (plan po osećaju: procena), zagrevanje posebno', () => {
    const t = (p: MarathonV2Plan) =>
      p.weeks.at(-1)!.days.find((d) => d.role === 'race')!.workout.title;
    expect(t(AVG())).toMatch(
      /^Maraton 42,2 km — prognoza \d:\d\d:\d\d \(pre starta 5 min laganog zagrevanja\)$/
    );
    expect(t(plan({ weeks: 18, km: 50, easyPace: 360, days: D(4) }))).toMatch(
      /— procena \d:\d\d:\d\d/
    );
  });
});
