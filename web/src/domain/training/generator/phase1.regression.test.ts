import { generatePlan, profileFor } from '@/test/generators';
import { describe, expect, it } from 'vitest';
import { addDays, type IsoDate } from '../../date';
import { r1 } from '../../format';
import { PROFILE_21K } from '@/domain/generators/halfMarathon/training/distances/profile21k';
import { sessQKm } from '../sessions/calc';
import type { PlanGenerationInput, TrainingPlan } from '../types';
import { paceForZone } from '../vdot/paceForZone';

const start = '2026-10-12' as IsoDate;
function plan(patch: Partial<PlanGenerationInput> = {}): TrainingPlan {
  const result = generatePlan({
    startDate: start,
    raceDate: addDays(start, 20 * 7 - 1),
    raceDistM: 5000,
    pb: { distM: 5000, sec: 1235 },
    weeklyKm: 30,
    runDays: 4,
    quality: 2,
    intensity: 'std',
    volIntensity: 'std',
    trainedRecently: true,
    _noSuggest: true,
    ...patch
  });
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('Faza 1: nezavisne reprodukcije audita', () => {
  it('MLR se računa u isporučen obim, bez lažnog dopunjavanja WU/CD', () => {
    // Audit: first HM week target58, MLR10.8 omitted, WU/CD padded to3.5/3.
    const p = plan({
      raceDistM: 21097.5,
      weeklyKm: 55,
      runDays: 5,
      goalSec: 5700,
      qualityExperience: 'experienced',
      consistentWeeks: 24,
      recentLongRunKm: 22,
      raceDate: '2027-01-17'
    });
    const first = p.weeks[0]!;
    expect(first.days.some((d) => d.tag === 'lr' && d.mlr && d.km > 0)).toBe(true);
    const sessions = first.days.flatMap((d) => (d.session ? [d.session] : []));
    expect(sessions).toHaveLength(2);
    for (const session of sessions) {
      expect(session.wuKm).toBeLessThan(3.5);
      expect(session.cdKm).toBeLessThan(3);
    }
    expect(first.vol).toBe(r1(first.days.reduce((n, d) => n + (d.km ?? 0), 0)));
  });

  it('konačna puna nedelja poštuje LR plafon i izuzetak za najduži kvalitet', () => {
    for (const raceDistM of [5000, 10000, 21097.5, 42195])
      for (const weeklyKm of [12, 20, 30, 40, 55, 70])
        for (const runDays of [3, 4, 5])
          for (const sec of [1235, 1620]) {
            const p = plan({ raceDistM, weeklyKm, runDays, pb: { distM: 5000, sec } });
            const c = profileFor(raceDistM)!.heuristic.longRunMaxShare;
            for (const w of p.weeks.slice(0, -1)) {
              const lr = w.days.find((d) => d.tag === 'lr' && !d.mlr);
              if (!lr || !c) continue;
              const rest = w.days.reduce((n, d) => n + (d === lr ? 0 : (d.km ?? 0)), 0);
              const maxQ = Math.max(0, ...w.days.filter((d) => d.session).map((d) => d.km ?? 0));
              const ceiling = Math.max(r1((rest * c) / (1 - c)), r1(maxQ * 1.05));
              const label = `${raceDistM}/${weeklyKm}/${runDays}/N${w.w}`;
              expect(lr.km, label).toBeLessThanOrEqual(ceiling + 0.01);
              expect(lr.km, label).toBeGreaterThanOrEqual(
                Math.max(...w.days.map((d) => d.km ?? 0)) - 0.01
              );
            }
          }
  });

  it('taper LR prikazuje gorivo i minute prema završnoj distanci', () => {
    const p = plan({
      raceDistM: 42195,
      weeklyKm: 30,
      pb: { distM: 21097.5, sec: 6300 },
      goalSec: 14400
    });
    const pace = paceForZone(p.meta.vdot0, 'LR');
    let checked = 0;
    for (const w of p.weeks.slice(0, -1))
      for (const d of w.days) {
        if (d.tag !== 'lr' || d.mlr) continue;
        const minutes = (d.km * pace) / 60;
        expect(d.desc.includes('uvežbaj gorivo')).toBe(minutes >= 75);
        const shown = /· (\d+) min/.exec(d.desc);
        if (shown) expect(Number(shown[1])).toBe(Math.round(minutes));
        checked++;
      }
    expect(checked).toBe(19);
    expect(p.weeks[17]!.days.find((d) => d.tag === 'lr')!.desc).not.toContain('gorivo');
  });

  it('protokol trke u utorak/sredu ponovo proverava prethodnu punu nedelju', () => {
    for (const offset of [1, 2]) {
      const p = plan({
        raceDistM: 42195,
        weeklyKm: 50,
        raceDate: addDays(start, 19 * 7 + offset),
        pb: { distM: 21097.5, sec: 6300 }
      });
      const w = p.weeks.at(-2)!;
      const lr = w.days.find((d) => d.tag === 'lr' && !d.mlr);
      if (!lr) continue;
      const rest = w.vol - (lr.km ?? 0);
      const maxQ = Math.max(0, ...w.days.filter((d) => d.session).map((d) => d.km ?? 0));
      expect(lr.km).toBeLessThanOrEqual(Math.max(r1((rest * 0.42) / 0.58), r1(maxQ * 1.05)) + 0.01);
      expect(lr.finish?.km ?? 0).toBeLessThanOrEqual(lr.km ?? 0);
    }
  });

  it('odsecanje početnih dana ne tretira preostali LR kao celu trening nedelju', () => {
    const full = plan();
    const partial = plan({ startDate: addDays(start, 6) });
    expect(partial.weeks[0]!.days).toEqual(full.weeks[0]!.days.filter((d) => d.dow === 7));
  });

  it('HM dva T dana dele budžet 60/40 umesto 60/60', () => {
    const req = {
      qualW: 14,
      qualWeeks: 20,
      effQ: 2,
      vol: 100,
      pI: 220,
      pT: 240,
      pE: 300,
      pR: 210,
      isTaper1: false,
      racePace: 340,
      ctx: { weeks: 20, w: 14, taperW: 2 }
    };
    const q1 = PROFILE_21K.buildQuality({ ...req, slotRole: 'q1', dow: 2 });
    const q2 = PROFILE_21K.buildQuality({ ...req, slotRole: 'q2', dow: 5 });
    expect(sessQKm(q1.session)).toBeLessThanOrEqual(6);
    expect(sessQKm(q2.session)).toBeLessThanOrEqual(4);
    expect(sessQKm(q1.session)).toBeGreaterThan(sessQKm(q2.session));
    expect(sessQKm(q1.session) + sessQKm(q2.session)).toBeLessThanOrEqual(10);
  });

  it('željeni cilj nije prikazan kao vreme koje daje preporučeni ritam', () => {
    const p = plan({ pb: { distM: 5000, sec: 1425 }, goalSec: 1199 });
    const race = p.weeks.at(-1)!.days.find((d) => d.tag === 'trka')!;
    expect(p.meta.goalSec).toBe(1199);
    expect(race.desc).toContain('željeni cilj 19:59');
    expect(race.desc).toContain('preporučeni ritam 4:45/km (oko 23:45');
    expect(p.meta.racePace).toBe(285);
  });
});
