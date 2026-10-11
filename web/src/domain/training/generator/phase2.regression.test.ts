import { describe, expect, it } from 'vitest';
import { addDays, type IsoDate } from '../../date';
import { adaptGeneratedPlan } from '../../plan/adapt';
import { preparationSummary } from '../../plan/preparation';
import { initialWizard, stepValid, toGenerationInput } from '../../onboarding';
import { sessQKm } from '../sessions/calc';
import type { PlanGenerationInput, TrainingPlan } from '../types';
import { generatePlan } from './generatePlan';

const start = '2026-10-12' as IsoDate;
function input(patch: Partial<PlanGenerationInput> = {}): PlanGenerationInput {
  return {
    startDate: start,
    raceDate: addDays(start, 16 * 7 - 1),
    raceDistM: 5000,
    pb: { distM: 5000, sec: 1235, date: '2026-09-20' },
    weeklyKm: 40,
    runDays: 5,
    quality: 2,
    intensity: 'std',
    volIntensity: 'std',
    trainedRecently: true,
    recentLongRunKm: 12,
    consistentWeeks: 24,
    qualityExperience: 'experienced',
    _noSuggest: true,
    ...patch
  };
}
function plan(patch: Partial<PlanGenerationInput> = {}): TrainingPlan {
  const p = generatePlan(input(patch));
  if ('error' in p) throw new Error(p.error);
  return p;
}
const firstQuality = (p: TrainingPlan) =>
  p.weeks.flatMap((w) => w.days).find((d) => d.session)?.session;
const work = (p: TrainingPlan) =>
  p.weeks.flatMap((w) => w.days).reduce((n, d) => n + (d.session ? sessQKm(d.session) : 0), 0);

describe('Faza 2: ulazi menjaju odgovarajući deo pripreme', () => {
  it('isti PB ne nameće istu početnu R300 fazu različitom iskustvu', () => {
    const experienced = plan();
    const developing = plan({ qualityExperience: 'none' });
    expect(experienced.meta.vdot0).toBe(developing.meta.vdot0);
    expect(firstQuality(experienced)?.type).not.toBe('fartlek');
    expect(firstQuality(experienced)?.kind).not.toBe('Repeticije');
    expect(firstQuality(developing)?.type).toBe('fartlek');
    expect(firstQuality(developing)?.zone).toBe('T');
    expect(developing.weeks[0]!.days.filter((d) => d.session)).toHaveLength(1);
  });

  it('brži PB ne zamenjuje iskustvo ili kontinuitet', () => {
    const p = plan({
      pb: { distM: 5000, sec: 1000 },
      qualityExperience: 'none',
      consistentWeeks: 2
    });
    expect(p.meta.athlete?.qualityReadiness).toBe('developing');
    expect(firstQuality(p)?.type).toBe('fartlek');
  });

  it('dužina polazi od ponovljive istorije, uz ista tempa i nedeljnu bazu', () => {
    const shorter = plan({ recentLongRunKm: 8 });
    const longer = plan({ recentLongRunKm: 12 });
    const lr = (p: TrainingPlan) => p.weeks[0]!.days.find((d) => d.tag === 'lr' && !d.mlr)!.km!;
    expect(lr(shorter)).toBeLessThan(lr(longer));
    expect(lr(longer)).toBeLessThanOrEqual(12.1);
    expect(shorter.meta.vdot0).toBe(longer.meta.vdot0);
    expect(shorter.meta.athlete?.weeklyBaseKm).toBe(longer.meta.athlete?.weeklyBaseKm);
  });

  it('manja težina smanjuje rad bez ubrzavanja ili promene prijavljene baze', () => {
    const lighter = plan({ intensity: 'kons' });
    const harder = plan({ intensity: 'agr' });
    expect(work(lighter)).toBeLessThan(work(harder));
    expect(lighter.meta.vdot0).toBe(harder.meta.vdot0);
    expect(lighter.meta.racePace).toBe(harder.meta.racePace);
    expect(lighter.meta.athlete).toEqual(harder.meta.athlete);
  });

  it('pauza daje lagan povratak i označava stari rezultat kao nepotvrđenu formu', () => {
    const p = plan({
      raceDistM: 10000,
      weeklyKm: 15,
      runDays: 3,
      trainedRecently: false,
      recentLongRunKm: 4,
      consistentWeeks: 1,
      breakWeeks: 8,
      qualityExperience: 'some',
      pb: { distM: 5000, sec: 1620, date: '2025-10-12' }
    });
    expect(p.meta.athlete?.qualityReadiness).toBe('returning');
    expect(p.meta.athlete?.speedConfidence).toBe('returning');
    expect(p.meta.baseWeeks).toBeGreaterThan(0);
    for (const w of p.weeks.slice(0, p.meta.baseWeeks))
      expect(w.days.some((d) => d.session)).toBe(false);
    expect(firstQuality(p)?.type).toBe('fartlek');
    expect(p.meta.dayWarnings.join(' ')).toContain('Stari PB ostaje referenca');
  });

  it('preskočena istorija ostaje pretpostavka, bez zaključka iz brzog PB-a', () => {
    const inp = input();
    delete inp.recentLongRunKm;
    delete inp.consistentWeeks;
    delete inp.qualityExperience;
    delete inp.pb.date;
    const p = generatePlan(inp);
    if ('error' in p) throw new Error(p.error);
    expect(p.meta.athlete?.qualityReadiness).toBe('developing');
    expect(p.meta.athlete?.longRunBasis).toBe('inferred');
    expect(p.meta.athlete?.speedConfidence).toBe('undated-result');
    expect(p.meta.athlete?.assumptions.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Faza 2: konačna priprema i granice', () => {
  it('maraton na tri dana zadržava ostvariv obim bez povratne sprege koja urušava plan', () => {
    const p = plan({
      raceDate: addDays(start, 20 * 7 - 1),
      raceDistM: 42195,
      pb: { distM: 42195, sec: 12000, date: '2026-09-20' },
      weeklyKm: 70,
      runDays: 3,
      quality: 2,
      recentLongRunKm: 22,
      consistentWeeks: 12,
      qualityExperience: 'experienced'
    });
    const normal = p.weeks.filter((week) => !week.deload && !week.taper && week.w < p.meta.weeks);
    // A constrained frequency need not deliver the requested 70 km. It must
    // not gradually collapse from an achievable 41 km to 10 km. The 75%
    // regression margin allows workout-format and independent LR waves.
    expect(normal.at(-1)!.vol).toBeGreaterThanOrEqual(normal[0]!.vol * 0.75);
    expect(p.meta.quality).toBe(1);
    for (const week of p.weeks.slice(0, -1))
      expect(week.days.filter((day) => day.session).length).toBeLessThanOrEqual(1);
    expect(p.meta.preparation?.endurance).toBe('limited');
    expect(p.meta.dayWarnings.join(' ')).toContain('Na tri dana');
    expect(p.meta.dayWarnings.join(' ')).toContain('ograničenu dužinsku pripremu');
  });

  it('HM dužina razvija se preko starog platoa od 14 km kada baza to podržava', () => {
    const p = plan({
      raceDistM: 21097.5,
      weeklyKm: 30,
      runDays: 4,
      recentLongRunKm: 10,
      consistentWeeks: 12,
      qualityExperience: 'some',
      pb: { distM: 5000, sec: 1425, date: '2026-09-20' }
    });
    expect(p.meta.preparation?.peakLongRunKm).toBeGreaterThan(16);
    expect(p.weeks.filter((w) => w.deload).length).toBeGreaterThan(0);
    for (const w of p.weeks)
      expect(w.days.filter((d) => d.session || d.finish).length).toBeLessThanOrEqual(2);
  });

  it('kratak PB i želja 4h ne potvrđuju spremnost manjeg maratonskog profila', () => {
    const p = plan({
      raceDate: addDays(start, 20 * 7 - 1),
      raceDistM: 42195,
      weeklyKm: 30,
      runDays: 4,
      recentLongRunKm: 10,
      consistentWeeks: 12,
      qualityExperience: 'some',
      pb: { distM: 21097.5, sec: 6300, date: '2026-09-20' },
      goalSec: 14400
    });
    expect(p.meta.preparation?.endurance).toBe('limited');
    expect(p.meta.preparation?.goalStatus).toBe('endurance-limited');
    expect(p.meta.preparation?.peakLongRunKm).toBeLessThan(26);
    expect(p.meta.dayWarnings.join(' ')).toContain('ograničenu dužinsku pripremu');
  });

  it('potvrđena veća baza daje drugačiju maratonsku progresiju, bez prognoze napretka', () => {
    const p = plan({
      raceDate: addDays(start, 20 * 7 - 1),
      raceDistM: 42195,
      weeklyKm: 50,
      runDays: 5,
      recentLongRunKm: 18,
      consistentWeeks: 24,
      pb: { distM: 21097.5, sec: 6300, date: '2026-09-20' },
      goalSec: 14400
    });
    expect(p.meta.preparation?.peakLongRunKm).toBeGreaterThanOrEqual(26);
    expect(p.meta.preparation?.endurance).toBe('supported');
    expect(p.meta.vdotGoal).toBe(p.meta.vdot0);
    expect(p.meta.preparation?.demandingDaysMax).toBeLessThanOrEqual(2);
    for (const w of p.weeks.filter((w) => w.taper))
      expect(w.vol).toBeLessThan(p.meta.preparation!.peakWeeklyKm);
  });

  it('procena izdržljivosti preživljava prilagođavanje za čuvanje; stari planovi ostaju čitljivi', () => {
    const p = plan();
    const stored = adaptGeneratedPlan(p)!;
    expect(preparationSummary(stored.meta)?.peakLongRunKm).toBe(p.meta.preparation?.peakLongRunKm);
    expect(preparationSummary({ vdot0: 45 })).toBeNull();
    expect(
      preparationSummary({
        preparation: { endurance: 'supported', peakLongRunKm: Infinity, peakWeeklyKm: 50 }
      })
    ).toBeNull();
  });

  it('nevalidna istorija i datum posle početka se odbijaju', () => {
    for (const patch of [
      { recentLongRunKm: -1 },
      { consistentWeeks: NaN },
      { breakWeeks: Infinity },
      { pb: { distM: 5000, sec: 1235, date: '2026-10-13' } }
    ])
      expect('error' in generatePlan(input(patch))).toBe(true);
  });

  it('wizard prenosi istoriju i razdvojene preference, bez obaveznih novih polja', () => {
    const w = {
      ...initialWizard(),
      raceDate: '2027-01-31',
      pbMin: '20',
      pbSec: '35',
      weeklyKm: '40',
      pbDate: '2026-09-20',
      recentLongRunKm: '12',
      consistentWeeks: '24',
      breakWeeks: '0',
      qualityExperience: 'experienced' as const,
      intensity: 'kons' as const,
      volIntensity: 'agr' as const
    };
    expect(toGenerationInput(w, start)).toMatchObject({
      recentLongRunKm: 12,
      consistentWeeks: 24,
      breakWeeks: 0,
      qualityExperience: 'experienced',
      intensity: 'kons',
      volIntensity: 'agr',
      pb: { date: '2026-09-20' }
    });
    expect(stepValid({ ...w, recentLongRunKm: '-1' }, 3, start)).toBe(false);
    expect(stepValid({ ...w, pbDate: '2026-10-13' }, 2, start)).toBe(false);
  });
});
