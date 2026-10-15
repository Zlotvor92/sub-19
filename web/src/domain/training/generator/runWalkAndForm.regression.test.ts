import { generatePlan } from '@/test/generators';
import { describe, expect, it } from 'vitest';
import { fmtClock } from '../../format';
import type { PlanGenerationInput, TrainingPlan } from '../types';
import {
  EASY_EFFORT_NOTE,
  QUALITY_ENTRY_NOTE
} from '@/domain/generators/fiveK/training/generator/formPolicy'; // tekst je isti u sva četiri generatora

/* Sintetički ulazi U01 (5K početnik) i U06 (10K povratnik sa godinu starim PB) iz QA ciklusa. */
const U01: PlanGenerationInput = {
  startDate: '2026-10-12',
  raceDate: '2027-01-03',
  raceDistM: 5000,
  pb: { distM: 5000, sec: 2100, date: '2026-09-13' },
  weeklyKm: 8,
  recentLongRunKm: 3,
  consistentWeeks: 0,
  breakWeeks: 0,
  qualityExperience: 'none',
  runDays: 3,
  quality: 1,
  intensity: 'kons',
  volIntensity: 'kons',
  trainedRecently: false,
  goalSec: 1800,
  lrDow: 7
};
const U06: PlanGenerationInput = {
  startDate: '2026-10-12',
  raceDate: '2027-01-31',
  raceDistM: 10000,
  pb: { distM: 5000, sec: 1620, date: '2025-10-12' },
  weeklyKm: 15,
  recentLongRunKm: 4,
  consistentWeeks: 1,
  breakWeeks: 8,
  qualityExperience: 'some',
  runDays: 3,
  quality: 1,
  intensity: 'std',
  volIntensity: 'kons',
  trainedRecently: false,
  goalSec: 3600,
  lrDow: 7
};

const make = (inp: PlanGenerationInput): TrainingPlan => {
  const plan = generatePlan(inp);
  if ('error' in plan) throw new Error(plan.error);
  return plan;
};
const runDays = (plan: TrainingPlan, w: number) =>
  plan.weeks.find((week) => week.w === w)!.days.filter((d) => !d.rest && d.km);

describe('U01: prelaz sa trčanja/hoda na neprekidno trčanje', () => {
  const plan = make(U01);

  it('lestvica 1→4 ostaje, ali prva neprekidna nedelja je probna i javlja se u meta i upozorenjima', () => {
    expect(plan.meta.runWalk).toMatchObject({ ladder: [1, 2, 3, 4], transitionWeek: 5 });
    expect(plan.meta.runWalk!.conditions.join(' ')).toMatch(/nepoznat podatak/);
    expect(plan.meta.dayWarnings.join('\n')).toMatch(/nije automatska potvrda tolerancije/);
    for (const w of [1, 2, 3, 4]) expect(runDays(plan, w).every((d) => d.tag === 'rw')).toBe(true);
  });

  it('W5 nosi uslov i rezervu, bez ubrzanja; W6 se vraća na običan opis', () => {
    const w5 = runDays(plan, 5);
    expect(w5.every((d) => d.tag !== 'rw')).toBe(true);
    for (const d of w5) {
      expect(d.desc).toMatch(/Prelaz na neprekidno trčanje je probni/);
      expect(d.desc).toMatch(/ponovi korak „5 min trčanja \/ 1 min hoda"/);
      expect(d.desc).not.toMatch(/ubrzanja/);
    }
    const w6 = runDays(plan, 6);
    expect(w6.some((d) => /Prelaz na neprekidno/.test(d.desc ?? ''))).toBe(false);
    expect(w6.some((d) => /6×20 s ubrzanja/.test(d.desc ?? ''))).toBe(true);
  });

  it('eksplicitna lestvica zadržava korak i pomera prelaz', () => {
    const held = make({ ...U01, runWalkLadder: [3, 3, 4] });
    expect(held.meta.runWalk).toMatchObject({ ladder: [3, 3, 4], transitionWeek: 4 });
    expect(runDays(held, 1)[0]!.desc).toMatch(/3 min trčanje \/ 1 min hod/);
    expect(runDays(held, 2)[0]!.desc).toMatch(/3 min trčanje \/ 1 min hod/);
    expect(runDays(held, 3)[0]!.desc).toMatch(/5 min trčanje \/ 1 min hod/);
    expect(runDays(held, 4).some((d) => d.tag === 'rw')).toBe(false);
  });

  it('dugačka lestvica produžuje bazu, a nevažeća se odbija ili ignoriše za treniranog', () => {
    const long = make({ ...U01, runWalkLadder: [1, 1, 2, 2, 3, 3, 4, 4] });
    expect(long.meta.baseWeeks).toBeGreaterThanOrEqual(9);
    expect(long.meta.runWalk!.ladder).toHaveLength(8);
    expect(generatePlan({ ...U01, runWalkLadder: [0] })).toHaveProperty('error');
    expect(generatePlan({ ...U01, runWalkLadder: [1, 5] })).toHaveProperty('error');
    const trained = make({ ...U01, trainedRecently: true, runWalkLadder: [1, 2] });
    expect(trained.meta.runWalk).toBeUndefined();
  });

  it('cilj ostaje cilj, a tempo je referenca trenutnog rezultata', () => {
    expect(plan.meta.goalSec).toBe(1800);
    expect(plan.meta.dayWarnings.join('\n')).toMatch(/Cilj je sačuvan kao želja/);
  });
});

describe('U06: istorijska referenca nije potvrđena forma', () => {
  const plan = make(U06);
  const qualitySessions = plan.weeks.flatMap((w) => w.days).filter((d) => d.session);

  it('politika je effort-first sa obrazloženjem i uslovima', () => {
    expect(plan.meta.athlete!.speedConfidence).toBe('returning');
    expect(plan.meta.formPolicy).toMatchObject({ basis: 'effort-first' });
    expect(plan.meta.formPolicy!.entryConditions).toHaveLength(3);
    const warning = plan.meta.dayWarnings.find((w) => /Zahtevniji rad se uvodi tek kad/.test(w))!;
    expect(warning).toMatch(/istorijska referenca/);
    expect(warning).toMatch(/Vremenski cilj ostaje cilj/);
    expect(plan.meta.goalSec).toBe(3600);
  });

  it('laki i dugi dani vode se naporom, ritam ostaje čitljiv kao gornja granica', () => {
    const easy = plan.weeks[0]!.days.filter((d) => d.tag === 'lako' || d.tag === 'lr');
    expect(easy.length).toBeGreaterThan(0);
    for (const d of easy) {
      expect(d.desc).toContain(EASY_EFFORT_NOTE);
      expect(d.desc).toMatch(/@ ~\d+:\d{2}\/km/);
    }
    // Bazne nedelje povratnika nemaju ubrzanja; ona čekaju kapiju za kvalitet.
    for (const week of plan.weeks.filter((w) => w.w <= plan.meta.baseWeeks))
      expect(week.days.some((d) => /ubrzanja/.test(d.desc ?? ''))).toBe(false);
  });

  it('svaki kvalitetan trening nosi napor, oznaku reference i ritam iz iste reference', () => {
    expect(qualitySessions.length).toBeGreaterThan(0);
    for (const d of qualitySessions) {
      expect(d.session!.paceBasis).toBe('reference');
      expect(d.desc).toMatch(/Forma nije potvrđena: vodi se naporom \d/);
      expect(d.desc).toContain(`~${fmtClock(d.session!.paceSec)}/km je referenca`);
    }
    const [first, ...rest] = qualitySessions;
    expect(first!.desc).toContain(QUALITY_ENTRY_NOTE);
    expect(rest.some((d) => d.desc?.includes(QUALITY_ENTRY_NOTE))).toBe(false);
  });

  it('nedatiran rezultat ostaje nepoznat (bez effort-first), svež rezultat bez pauze nema politiku', () => {
    const undated = make({
      ...U06,
      pb: { distM: 5000, sec: 1620 },
      breakWeeks: 0,
      trainedRecently: true
    });
    expect(undated.meta.athlete!.speedConfidence).toBe('undated-result');
    expect(undated.meta.formPolicy).toBeUndefined();
    const fresh = make({
      ...U06,
      pb: { distM: 5000, sec: 1620, date: '2026-09-20' },
      breakWeeks: 0,
      consistentWeeks: 10,
      trainedRecently: true
    });
    expect(fresh.meta.formPolicy).toBeUndefined();
    expect(
      fresh.weeks.flatMap((w) => w.days).some((d) => d.session?.paceBasis === 'reference')
    ).toBe(false);
  });

  it('star rezultat bez pauze takođe prelazi na effort-first', () => {
    const stale = make({ ...U06, breakWeeks: 0, consistentWeeks: 12, trainedRecently: true });
    expect(stale.meta.athlete!.speedConfidence).toBe('stale-result');
    expect(stale.meta.formPolicy).toMatchObject({ basis: 'effort-first' });
  });
});
