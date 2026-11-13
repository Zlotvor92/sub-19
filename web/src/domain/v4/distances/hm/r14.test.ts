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
  /* R19 (odluka organizatora): povratak po nedeljama — prva nedelja 75 %, druga 90 % referentne nedelje (najveća od
     poslednje 4 pre pauze), nikad iznad plana; treća je plan (ranije: 60–70 % / ≤ 85 % poslednje odrađene) */
  it.each([
    [5, '2026-12-13'],
    [6, '2027-02-07'],
    [27, '2027-01-24']
  ])(
    's%i: povratna nedelja ≤ 75 % referentne, druga ≤ 90 % (i ≤ plana), treća ≥ 95 % plana',
    (no, to) => {
      const r = run(no);
      const { km, first } = weeksAfter(r, to);
      const ctx = paceCtxOf(r.before.header);
      const race = r.before.header.goal.raceDate;
      const plan = (r.before.weeks as any[]).map((w) => weekCost(w, race, ctx).km);
      const ref = ((r.after.header.adjustments ?? []) as any[]).find((a) => a.kind === 'pause')
        ?.refWeekKm as number;
      expect(ref).toBeGreaterThan(0);
      const w1 = km[first] ?? 0;
      const w2 = km[first + 1] ?? 0;
      expect(w1).toBeGreaterThanOrEqual(0.6 * ref);
      expect(w1).toBeLessThanOrEqual(Math.min(0.75 * ref, plan[first] ?? 0) + 0.5);
      expect(w2).toBeLessThanOrEqual(Math.min(0.9 * ref, plan[first + 1] ?? 0) + 0.5);
      const w3 = r.after.weeks[first + 2];
      if (w3 !== undefined && w3.intent.kind !== 'taper' && w3.intent.kind !== 'race')
        expect(km[first + 2] ?? 0).toBeGreaterThanOrEqual(0.95 * (plan[first + 2] ?? 0));
    }
  );

  it('s05: rast dugog posle povratka najviše + 20 min od većeg od prethodnog i referentnog dugog', () => {
    const r = run(5);
    const { longMin, first } = weeksAfter(r, '2026-12-13');
    const ref = Math.round(
      ((((r.after.header.adjustments ?? []) as any[]).find((a) => a.kind === 'pause')
        ?.lastLongSec as number | undefined) ?? 0) / 60
    );
    const after = longMin.slice(first).filter((x) => x > 0);
    let prev = ref;
    for (let i = 0; i < 5; i += 1) {
      expect((after[i] ?? 0) - prev).toBeLessThanOrEqual(21);
      prev = Math.max(prev, after[i] ?? 0);
    }
  });

  it('s06: najteža nedelja pred trku ostaje 52–55 km', () => {
    const { km } = weeksAfter(run(6), '2027-02-07');
    expect(km[16]).toBeGreaterThanOrEqual(52);
  });
});
