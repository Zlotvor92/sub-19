import { describe, expect, it } from 'vitest';
import { addDays, type IsoDate } from '../date';
import { generatePlan } from '../training/generator/generatePlan';
import { plDan, fmtDayMonthYear } from '../format';
import { adaptGeneratedPlan } from './adapt';
import { headerSubtitle } from './header';
import { resolvePlan } from './resolve';

/* parity: test/gramatika.test.mjs (plDan), renderHeader. */

const START = '2026-01-05' as IsoDate;
const RACE = addDays(START, 12 * 7 + 6);
const plan = resolvePlan(
  (
    adaptGeneratedPlan(
      generatePlan({
        startDate: START,
        raceDate: RACE,
        raceDistM: 10000,
        pb: { distM: 10000, sec: 2700 },
        weeklyKm: 40,
        runDays: 5,
        quality: 2,
        intensity: 'std',
        trainedRecently: true
      })
    ) as { weeks: Parameters<typeof resolvePlan>[0] }
  ).weeks,
  { alts: {}, moves: {} }
);

describe('natpis plana', () => {
  it('pre početka: datumi starta i trke', () => {
    expect(headerSubtitle(plan, RACE, '2026-01-01')).toBe(
      `Start: ${fmtDayMonthYear(START)} · Trka: ${fmtDayMonthYear(RACE)}`
    );
  });
  it('u toku: nedelja i broj dana do trke', () => {
    const t = headerSubtitle(plan, RACE, addDays(START, 9));
    expect(t).toMatch(/^Nedelja 2 \/ 13 · \d+ (dan|dana) do trke$/);
  });
  it('dan trke, dan pre trke, posle trke', () => {
    expect(headerSubtitle(plan, RACE, RACE)).toContain('DANAS JE TRKA');
    expect(headerSubtitle(plan, RACE, addDays(RACE, -1))).toContain('1 dan do trke');
    expect(headerSubtitle(plan, RACE, addDays(RACE, 3))).toBe(
      `Plan završen · Trka: ${fmtDayMonthYear(RACE)}`
    );
  });
  it('bez plana ili bez datuma trke nema natpisa', () => {
    expect(headerSubtitle(null, RACE, START)).toBe('');
    expect(headerSubtitle(plan, null, START)).toBe('');
  });
});

describe('množina', () => {
  it('dan / dana po poslednjoj cifri, 11–14 uvek „dana"', () => {
    for (const [n, w] of [
      [1, 'dan'],
      [2, 'dana'],
      [5, 'dana'],
      [11, 'dana'],
      [21, 'dan'],
      [101, 'dan'],
      [111, 'dana'],
      [112, 'dana']
    ] as const)
      expect(plDan(n), String(n)).toBe(w);
  });
});
