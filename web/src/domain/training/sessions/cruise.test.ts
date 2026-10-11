import { describe, expect, it } from 'vitest';
import { generatePlan } from '../generator/generatePlan';
import type { Day } from '../types';
import { sessInt, sessProg } from './build';
import { sessDesc, sessKm, sessQKm } from './calc';
import { constrainSession, constrainWeek } from './constraints';
import { cruiseIntervals, type CruiseParams } from './cruise';

const PARAMS: CruiseParams = {
  floorCapKm: 3,
  floorShare: 0.12,
  ladder: [
    { fromKm: 6, repKm: 2 },
    { fromKm: 3, repKm: 1.6 }
  ],
  minRepKm: 1,
  restSec: () => 90
};

describe('Pragovski stimulus pri ograničavanju obima', () => {
  it('30 km: bira 3×1000 umesto 2×1600 koje plafon pretvori u lako trčanje', () => {
    const day = cruiseIntervals(0.1, PARAMS, 5, 30, 280);
    expect(day.session.type).toBe('int');
    if (day.session.type !== 'int') throw new Error('Nedostaju pragovska ponavljanja');
    expect(day.session.reps).toBe(3);
    expect(day.session.repM).toBe(1000);
    expect(constrainSession(day.session, 30, 1200)).toBe(true);
    expect(sessQKm(day.session)).toBe(3);
  });

  it('naknadno smanjenje obima skraćuje cruise deonice i čuva tempo i ukupan dan', () => {
    const day = sessInt(5, 1.7, 2, 1600, 280, 90, 1.2, 'Tempo isprekidan');
    const originalKm = day.km;
    const days: Day[] = [day, { dow: 7, tag: 'lr', km: 30 - originalKm, desc: 'Dužina' }];
    constrainWeek(days, 1200, 350);
    const constrained = days[0];
    expect(constrained?.session?.type).toBe('int');
    if (constrained?.session?.type !== 'int') throw new Error('Prag je izgubljen');
    expect(constrained.session.reps).toBe(2);
    expect(constrained.session.repM).toBe(1500);
    expect(constrained.session.paceSec).toBe(280);
    expect(constrained.km).toBe(originalKm);
    expect(constrained.km).toBe(sessKm(constrained.session));
    expect(constrained.desc).toBe(sessDesc(constrained.session));
    const once = JSON.stringify(days);
    constrainWeek(days, 1200, 350);
    expect(JSON.stringify(days)).toBe(once);
  });

  it('mali budžet daje kratak kontinuirani prag umesto besmisleno kratkih cruise deonica', () => {
    const day = cruiseIntervals(0.1, PARAMS, 5, 15, 300);
    expect(day.session.type).toBe('tempo');
    expect(sessQKm(day.session)).toBe(1.5);
    expect(day.session.notes).toContain('kontinuirani prag');
    expect(constrainSession(day.session, 15, 1200)).toBe(true);
  });

  it('finalni fallback čuva T zonu, vremenski plafon i dosledan opis bez zaostalih intervalskih polja', () => {
    const day = sessInt(5, 1, 2, 1600, 300, 90, 1, 'Tempo isprekidan');
    const total = day.km;
    const days: Day[] = [day, { dow: 7, tag: 'lr', km: 15 - total, desc: 'Dužina' }];
    constrainWeek(days, 360, 360);
    const constrained = days[0];
    expect(constrained?.session?.type).toBe('tempo');
    if (!constrained?.session) throw new Error('Prag je izgubljen');
    expect(constrained.session.kind).toBe('Tempo');
    expect(constrained.session.zone).toBe('T');
    expect(constrained.session.paceSource).toBe('current-fitness');
    expect(sessQKm(constrained.session)).toBe(1.2);
    expect(constrained.session).not.toHaveProperty('repM');
    expect(constrained.session).not.toHaveProperty('restSec');
    expect(constrained.km).toBe(total);
    expect(constrained.desc).toBe(sessDesc(constrained.session));
    const once = JSON.stringify(days);
    constrainWeek(days, 360, 360);
    expect(JSON.stringify(days)).toBe(once);
  });

  it('ne podiže dozu iznad budžeta na prelazima između dužina deonica', () => {
    for (const vol of [10, 15, 19.9, 20, 29, 30, 31.9, 32, 59, 60, 61]) {
      for (const share of [1, 0.6, 0.4]) {
        const day = cruiseIntervals(0.1, PARAMS, 5, vol, 280, share);
        expect(sessQKm(day.session), `${vol} km, udeo ${share}`).toBeLessThanOrEqual(
          vol * 0.1 * share + 0.000001
        );
        expect(constrainSession(day.session, vol, 1200)).toBe(true);
      }
    }
  });

  it('fallback ne relaksira I/R plafone niti povećava ranije zadatu T dozu', () => {
    for (const kind of ['Intervali', 'Repeticije']) {
      const day = sessInt(5, 1, 2, 1000, 240, 120, 1, kind);
      expect(constrainSession(day.session, 10, 1200)).toBe(true);
      expect(day.session.type).toBe('int');
      expect(sessQKm(day.session)).toBeLessThanOrEqual(kind === 'Intervali' ? 0.8 : 0.5);
    }
    const day = sessInt(5, 1, 2, 1600, 280, 90, 1, 'Tempo isprekidan');
    const before = sessQKm(day.session);
    expect(constrainSession(day.session, 15, 1200)).toBe(true);
    expect(sessQKm(day.session)).toBeLessThanOrEqual(before);
    expect(sessQKm(day.session)).toBeLessThanOrEqual(1.5);
  });

  it('objašnjava zamenu kada ni najmanja smislena sesija ne staje u budžet', () => {
    const day = sessInt(5, 1, 2, 1000, 240, 120, 1, 'Intervali');
    const days: Day[] = [day, { dow: 7, tag: 'lr', km: 6 - day.km, desc: 'Dužina' }];
    constrainWeek(days, 1200, 350);
    expect(days[0]?.session).toBeUndefined();
    expect(days[0]?.tag).toBe('lako');
    expect(days[0]?.desc).toContain('Planirani trening „Intervali” odložen');
    expect(days[0]?.desc).toContain('limita ove nedelje');
  });

  it('19.5 km: skrati 2×800 I na 2×700 bez gubitka VO2 stimulusa', () => {
    const day = sessInt(5, 1, 2, 800, 240, 120, 1, 'Intervali');
    expect(constrainSession(day.session, 19.5, 1200)).toBe(true);
    if (day.session.type !== 'int') throw new Error('Nedostaju intervali');
    expect(day.session.reps).toBe(2);
    expect(day.session.repM).toBe(700);
    expect(day.session.restSec).toBeGreaterThan(0);
    expect((day.session.repM / 1000) * day.session.paceSec).toBeGreaterThanOrEqual(60);
    expect(sessQKm(day.session)).toBeLessThanOrEqual(19.5 * 0.08);
  });

  it('skraćene I/R deonice ostaju u limitu zone i imaju odgovarajući oporavak', () => {
    for (const kind of ['Intervali', 'Repeticije']) {
      for (const paceSec of [180, 240, 360, 450]) {
        for (const volume of [6, 10, 19.5, 30, 50]) {
          const day = sessInt(5, 1, 2, 1600, paceSec, 90, 1, kind);
          if (!constrainSession(day.session, volume, 1200)) continue;
          if (day.session.type !== 'int') throw new Error('Format deonica je promenjen');
          const duration = (day.session.repM / 1000) * paceSec;
          const isInterval = kind === 'Intervali';
          expect(duration).toBeLessThanOrEqual(isInterval ? 300 : 120);
          if (isInterval) expect(duration).toBeGreaterThanOrEqual(60);
          expect(day.session.repM).toBeGreaterThanOrEqual(100);
          expect(sessQKm(day.session)).toBeLessThanOrEqual(volume * (isInterval ? 0.08 : 0.05));
          expect(day.session.restSec).toBeGreaterThan(0);
          if (!isInterval) expect(day.session.restSec).toBe(Math.round(duration * 2.5));
        }
      }
    }
  });

  it('progresivno zadržava kilometražu dana i nedelje kada se skrati završni T rad', () => {
    const day = sessProg(5, 10, 280, 350);
    const days: Day[] = [day, { dow: 7, tag: 'lr', km: 10, desc: 'Dužina' }];
    constrainWeek(days, 1200, 350);
    const constrained = days[0];
    expect(constrained?.session?.type).toBe('prog');
    if (constrained?.session?.type !== 'prog') throw new Error('Progresija je izgubljena');
    expect(constrained.km).toBe(10);
    expect(days.reduce((n, d) => n + (d.km ?? 0), 0)).toBe(20);
    expect(sessQKm(constrained.session)).toBeLessThanOrEqual(2);
    expect(constrained.session.qKm).toBe(6);
    expect(constrained.session.wuKm).toBe(3);
    expect(constrained.session.cdKm).toBe(1);
    expect(constrained.session.paceSec).toBe(280);
    expect(constrained.desc).toBe(sessDesc(constrained.session));
    expect(constrained.desc).toContain('3 km zagrevanje');
    expect(constrained.desc).toContain('1 km hlađenje');
    const once = JSON.stringify(days);
    constrainWeek(days, 1200, 350);
    expect(JSON.stringify(days)).toBe(once);
  });

  it('napomena o skraćivanju deonica se ne ponavlja pri novom smanjenju nedeljnog obima', () => {
    for (const [kind, volumes, note] of [
      ['Tempo isprekidan', [30, 28], 'Pragovske deonice skraćene radi poštovanja budžeta rada.'],
      ['Intervali', [19.5, 17], 'Deonice skraćene radi poštovanja budžeta rada.']
    ] as const) {
      const day = sessInt(5, 1, 2, kind === 'Intervali' ? 800 : 1600, 280, 90, 1, kind);
      for (const volume of volumes) expect(constrainSession(day.session, volume, 1200)).toBe(true);
      expect(day.session.notes?.split(' · ').filter((n) => n === note)).toHaveLength(1);
    }
  });

  it('5K sub20 profil zadržava oba kvaliteta u prethodno pogođenim radnim nedeljama', () => {
    const plan = generatePlan({
      startDate: '2026-10-12',
      raceDate: '2027-01-31',
      raceDistM: 5000,
      pb: { distM: 5000, sec: 1425 },
      weeklyKm: 30,
      runDays: 4,
      quality: 2,
      intensity: 'std',
      volIntensity: 'std',
      goalSec: 1199,
      trainedRecently: true,
      qualityExperience: 'experienced',
      consistentWeeks: 16
    });
    if ('error' in plan) throw new Error(plan.error);
    expect(plan.meta.quality).toBe(2);
    for (const weekNumber of [1, 2, 3, 5]) {
      const week = plan.weeks.find((w) => w.w === weekNumber);
      const sessions = week?.days.flatMap((d) => (d.session ? [d.session] : [])) ?? [];
      expect(sessions, `N${weekNumber}`).toHaveLength(2);
      expect(
        sessions.some((s) => s.zone === 'T'),
        `N${weekNumber}: nema praga`
      ).toBe(true);
    }
  });
});
