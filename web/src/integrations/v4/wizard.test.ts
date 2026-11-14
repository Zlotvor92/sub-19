import { describe, expect, it } from 'vitest';
import { fingerprint } from '../../domain/v4/engine';
import { makePlan, wizardGoal, type WizardAnswers } from './wizard';
import { workoutFromAlt } from './manual';

const TODAY = '2026-11-14';
const BASE: WizardAnswers = {
  raceDate: '2027-03-21',
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 35,
  recentResult: { distanceM: 5000, timeSec: 22 * 60 + 30, date: '2026-10-20' },
  experience: 'regular'
};

describe('F9 korak 7 · čarobnjak → V4 plan', () => {
  for (const distance of ['5k', '10k', 'hm', 'marathon']) {
    it(`${distance}: plan postoji, nedelje imaju treninge, isti ulaz → isti plan`, () => {
      const a = makePlan({ distance, answers: BASE, today: TODAY });
      const b = makePlan({ distance, answers: BASE, today: TODAY });
      expect(a.ok).toBe(true);
      if (!a.ok || !b.ok) return;
      expect(a.doc.weeks.length).toBeGreaterThan(4);
      expect(a.doc.weeks.every((w) => w.days.some((d) => d.workout !== null))).toBe(true);
      expect(a.otisak).toBe(fingerprint(a.doc, a.facts));
      expect(a.otisak).toBe(b.otisak);
      expect(a.doc.header.goal.raceDate).toBe(BASE.raceDate);
    });
  }

  it('maraton početnika za 8 nedelja sa malim obimom: plan + upozorenje, ne odbijanje (AGENTS V4 t. 6)', () => {
    const r = makePlan({
      distance: 'marathon',
      answers: {
        raceDate: '2027-01-10',
        runDays: ['tue', 'thu', 'sun'],
        currentWeeklyKm: 10,
        experience: 'beginner'
      },
      today: TODAY
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.length).toBeGreaterThan(0);
    const serious = r.warnings.filter((w) => w.severity !== 'info');
    expect(serious.length).toBeGreaterThan(0);
    expect(serious.some((w) => w.proposal.length > 0)).toBe(true);
  });

  it('neispravan unos se odbija (trka u prošlosti, nepoznata distanca)', () => {
    expect(
      makePlan({ distance: 'hm', answers: { ...BASE, raceDate: '2026-01-01' }, today: TODAY }).ok
    ).toBe(false);
    expect(makePlan({ distance: '3k', answers: BASE, today: TODAY }).ok).toBe(false);
  });

  it('dani, dugi dan, profil i potvrda dana (M6)', () => {
    const g = wizardGoal('hm', { ...BASE, easyPaceSecPerKm: 330, longRunDay: 'sat' }, true);
    expect(g.availability).toEqual({ runDays: [1, 3, 5, 6], longDay: 5, confirmedRunDays: true });
    expect(g.profile).toMatchObject({ weeklyKm: 35, easyPaceSecPerKm: 330, beginner: false });
    expect(wizardGoal('hm', { ...BASE, runDays: ['mon', 'wed'] }).availability.longDay).toBe(2);
    expect(
      wizardGoal('fivek', { ...BASE, typicalEasyPaceSecPerKm: 360 }).profile.easyPaceSecPerKm
    ).toBe(360);
  });

  it('ručna izmena iz lista → Workout', () => {
    expect(workoutFromAlt({ tag: 'odmor', km: null, desc: 'Odmor' })).toBeNull();
    expect(workoutFromAlt({ tag: 'lako', km: 8, desc: 'Lagano 8 km' })).toEqual({
      kind: 'easy',
      stimulus: null,
      workSec: 0,
      steps: [{ role: 'steady', target: { type: 'zone', zone: 'E' }, extent: { distanceM: 8000 } }],
      text: 'Lagano 8 km'
    });
    expect(workoutFromAlt({ tag: 'tempo', km: 6, desc: 'x', pace: 290 })?.steps[0]).toMatchObject({
      target: { type: 'pace', secPerKm: 290 }
    });
    expect(workoutFromAlt({ tag: 'snaga', km: null, desc: 'Snaga' })).toMatchObject({
      kind: 'other',
      steps: []
    });
  });
});
