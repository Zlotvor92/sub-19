/* K3 (5k-v2.16.0, glavni trener krug 2 § 3–4): nezavisne invarijante mreže po pravilu K3-A … K3-F. Brojevi pravila su
   ispisani ovde i u testInputs.ts (k3ILoMin / k3IHiMin), ne čitaju se iz policy.ts. Izveštaj:
   docs/generators-v2/perfection/reports/K3-5K-REPORT.md. */

import { describe, expect, it } from 'vitest';
import { generateFiveKV2 } from './generate.ts';
import { earlyGridInputs, k3IHiMin, k3ILoMin } from './testInputs.ts';
import type { FiveKV2Plan, PlanDay } from './types.ts';
import { validatePlan } from './validate.ts';

const EPS = 1e-6;
const SAMPLE = earlyGridInputs()
  .filter((_, i) => i % 3 === 0)
  .map((c) => ({ id: c.id, r: generateFiveKV2(c.input) }))
  .filter(
    (x): x is { id: string; r: Extract<typeof x.r, { ok: true }> } =>
      x.r.ok && x.r.plan.planType !== 'runWalk'
  )
  .map((x) => ({ id: x.id, p: x.r.plan as FiveKV2Plan }));
const iMin = (d: PlanDay): number =>
  d.workout.segments
    .filter((s) => s.kind === 'rep' && s.zone === 'I')
    .reduce((a, s) => a + s.sec, 0) / 60;
const regular = (p: FiveKV2Plan): boolean => p.paceMode === 'vdot' && p.experience !== 'beginner';

describe('K3-A: rad jednog I treninga po cilju nedelje', () => {
  it('svaki I trening vrhunca ≤ plafon opsega; ne-rasteretna nedelja vrhunca sa I ≥ donja granica', () => {
    let n = 0;
    let atLo = 0;
    for (const { id, p } of SAMPLE) {
      if (!regular(p)) continue;
      const v = p.vdot!;
      for (const w of p.weeks) {
        if (w.phase !== 'peak') continue;
        for (const d of w.days) {
          const m = iMin(d);
          if (m === 0) continue;
          n++;
          expect(m, `${id} ned ${w.index}`).toBeLessThanOrEqual(k3IHiMin(v, w.targetKm) + EPS);
          if (w.deload) continue;
          expect(m, `${id} ned ${w.index}`).toBeGreaterThanOrEqual(k3ILoMin(v, w.targetKm) - EPS);
          if (k3ILoMin(v, w.targetKm) > 0) atLo++;
        }
      }
    }
    expect(n).toBeGreaterThan(300);
    // Pravilo zaista deluje: ima I treninga sa donjom granicom.
    expect(atLo).toBeGreaterThan(100);
  });

  it('uzorak bez grešaka validatora', () => {
    for (const { id, p } of SAMPLE)
      expect(
        validatePlan(p).filter((v) => v.severity === 'error'),
        id
      ).toEqual([]);
  });
});

describe('K3-B: redovan plan sa tačno 4 dana', () => {
  it('lagan ≤ 0,75 × dugi u nedelji izgradnje (nedelja 1: 0,80); koristi prostor iznad 0,70', () => {
    let weeks = 0;
    let over070 = 0;
    let w1Over075 = 0;
    for (const { id, p } of SAMPLE) {
      if (p.input.runDays.length !== 4 || p.experience === 'beginner') continue;
      for (const w of p.weeks) {
        if (w.deload || !['base', 'peak', 'sharpen'].includes(w.phase)) continue;
        const long = w.days.find((d) => d.role === 'long');
        if (!long) continue;
        weeks++;
        const share = w.index === 1 ? 0.8 : 0.75;
        for (const d of w.days.filter((x) => x.role === 'easy')) {
          expect(d.workout.km, `${id} ned ${w.index}`).toBeLessThanOrEqual(
            Math.floor(long.workout.km * share * 10 + 1e-9) / 10 + EPS
          );
          const over = (x: number): boolean =>
            d.workout.km > Math.floor(long.workout.km * x * 10 + 1e-9) / 10 + EPS;
          if (w.index > 1 && over(0.7)) over070++;
          if (w.index === 1 && over(0.75)) w1Over075++;
        }
      }
    }
    expect(weeks).toBeGreaterThan(300);
    // Pravilo zaista deluje: posle nedelje 1 lagan iznad 0,70 × dugi, a u nedelji 1 iznad 0,75 × dugi.
    expect(over070).toBeGreaterThan(50);
    expect(w1Over075).toBeGreaterThan(5);
  });
});

describe('K3-C: redovan plan sa 3 dana', () => {
  const three = SAMPLE.filter(
    ({ p }) => p.input.runDays.length === 3 && p.experience !== 'beginner'
  );
  const build = (w: FiveKV2Plan['weeks'][number]): boolean =>
    !w.deload && ['base', 'peak', 'sharpen'].includes(w.phase);

  it('lagan ≤ 0,70 × dugi u nedelji izgradnje; napomena granice laganog najviše jednom po planu', () => {
    let capped = 0;
    for (const { id, p } of three) {
      for (const w of p.weeks.filter(build)) {
        const long = w.days.find((d) => d.role === 'long');
        if (!long) continue;
        for (const d of w.days.filter((x) => x.role === 'easy'))
          expect(d.workout.km, `${id} ned ${w.index}`).toBeLessThanOrEqual(
            Math.floor(long.workout.km * 7 + 1e-9) / 10 + EPS
          );
        if (w.easyCappedAtLong) capped++;
      }
      expect(
        p.weeks.filter((w) => w.notes.some((n) => n.startsWith('Lagan trk najviše'))).length,
        id
      ).toBeLessThanOrEqual(1);
    }
    expect(three.length).toBeGreaterThan(100);
    expect(capped).toBeGreaterThan(50);
  });

  it('dugi u ne-rasteretnoj nedelji oštrenja ima 6 × 20 s ubrzanja; drugde dugi bez ubrzanja', () => {
    let n = 0;
    for (const { id, p } of SAMPLE)
      for (const w of p.weeks) {
        const long = w.days.find((d) => d.role === 'long');
        if (!long) continue;
        const st = long.workout.segments.filter((s) => s.kind === 'stride');
        const want =
          p.input.runDays.length === 3 &&
          p.experience !== 'beginner' &&
          w.phase === 'sharpen' &&
          !w.deload;
        expect(st.length, `${id} ned ${w.index}`).toBe(want ? 6 : 0);
        if (want) {
          n++;
          expect(st.every((s) => s.sec === 20)).toBe(true);
        }
      }
    expect(n).toBeGreaterThan(50);
  });

  it('ista doza iste zone najviše 2 ne-rasteretne nedelje zaredom (među nedeljama te zone), od 15 km', () => {
    let pairs = 0;
    for (const { id, p } of three) {
      if (p.input.currentWeeklyKm < 15) continue;
      const last: Record<string, [string, number]> = {};
      for (const w of p.weeks.filter(build))
        for (const z of ['R', 'T', 'I', 'RP'] as const) {
          const ds = w.days.filter((d) => d.workout.kind === 'quality' && d.workout.workKm[z] > 0);
          if (ds.length === 0) continue;
          const key = JSON.stringify(ds.map((d) => d.workout.blocks));
          const pr = last[z];
          const k = pr && pr[0] === key ? pr[1] + 1 : 1;
          if (k === 2) pairs++;
          last[z] = [key, k];
          expect(k, `${id} ned ${w.index} ${z}`).toBeLessThanOrEqual(2);
        }
    }
    // Pravilo zaista deluje: ista doza dve nedelje zaredom postoji (treća se menja).
    expect(pairs).toBeGreaterThan(10);
  });
});
