/* KRUG 14 (briefs/R14-MOTOR.md) — motor nad podacima polumaratona: povratak posle pauze (M2). */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { paceCtxOf } from '../../engine';
import { weekCost } from '../../engine/guard';
import { SCENARIOS } from './testdata/scenarios';

const run = (no: number): any => SCENARIOS.find((s) => s.no === no)?.run();

/** Km nedelja POSLE izmene i indeks prve nedelje koja počinje posle kraja pauze. */
function weeksAfter(r: any, pauseTo: string): { km: number[]; longMin: number[]; first: number } {
  const ctx = paceCtxOf(r.after.header);
  const race = r.after.header.goal.raceDate;
  const costs = (r.after.weeks as any[]).map((w) => weekCost(w, race, ctx));
  const first = (r.after.weeks as any[]).findIndex((w) => w.start > pauseTo);
  return {
    km: costs.map((c) => c.km),
    longMin: costs.map((c) => Math.round(c.longSec / 60)),
    first
  };
}

describe('krug 14 — povratak posle pauze (M2)', () => {
  /* s05 (p01, 7 dana bolesti), s06 (p04, 7 dana bolesti 6 nedelja pred trku), s27 (put 6 dana) */
  it.each([
    [5, '2026-12-13'],
    [6, '2027-02-07'],
    [27, '2027-01-24']
  ])('s%i: povratna nedelja 60–70 % poslednje odrađene, druga ≤ 85 %', (no, to) => {
    const r = run(no);
    const { km, first } = weeksAfter(r, to);
    /* poslednja odrađena puna nedelja pre pauze */
    const last = km.slice(0, first).reverse().find((x) => x > 0) ?? 0;
    const lastFull = no === 27 ? (km[first - 2] ?? 0) : last;
    const w1 = (km[first] ?? 0) / lastFull;
    const w2 = (km[first + 1] ?? 0) / lastFull;
    expect(w1).toBeGreaterThanOrEqual(0.6);
    expect(w1).toBeLessThanOrEqual(0.72);
    expect(w2).toBeLessThanOrEqual(0.85);
  });

  it('s05: rast dugog posle povratka najviše + 20 min nedeljno', () => {
    const { longMin, first } = weeksAfter(run(5), '2026-12-13');
    const after = longMin.slice(first).filter((x) => x > 0);
    for (let i = 1; i < 5; i += 1) expect((after[i] ?? 0) - (after[i - 1] ?? 0)).toBeLessThanOrEqual(21);
  });

  it('s06: najteža nedelja pred trku ostaje 52–55 km', () => {
    const { km } = weeksAfter(run(6), '2027-02-07');
    expect(km[16]).toBeGreaterThanOrEqual(52);
  });
});
