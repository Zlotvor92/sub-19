/* P5 (10k-v2.12.0): F1 kontrolni test (D35), F2 kvalitet u adaptaciji (D38), F3 ubrzanja (D36), F4 početna doza T i I
   (D37). Nezavisne provere (brojevi iz odluke organizatora, ne iz policy.ts); svaki test pada na 72003c1 (pre P5). */

import { describe, expect, it } from 'vitest';
import { adaptTenKV2 } from './adapt.ts';
import { addDays, daysBetween } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import {
  earlyAsOfs,
  earlyFacts,
  earlyGridBases,
  grid02Inputs,
  inputOf,
  SCHEDULES_BY_DAYS
} from './testInputs.ts';
import type { PlanDay, PlanWeek, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const planOf = (
  days: 3 | 4 | 5 | 6,
  o: { weeks: number; km: number; vdot?: number; easy?: number; beginner?: boolean }
): TenKV2Plan => {
  const sc = SCHEDULES_BY_DAYS[days].A;
  const base = inputOf({
    weeks: o.weeks,
    km: o.km,
    vdot: o.vdot ?? 45,
    days: sc.days,
    long: sc.long
  });
  const raw =
    o.easy !== undefined ? { ...base, recentResult: null, easyPaceSecPerKm: o.easy } : base;
  const r = generateTenKV2(o.beginner ? { ...raw, experience: 'beginner' } : raw);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const errors = (p: TenKV2Plan) => validatePlan(p).filter((v) => v.severity === 'error');
const testWeeks = (p: TenKV2Plan): number[] =>
  p.weeks.filter((w) => w.days.some((d) => d.role === 'test')).map((w) => w.index);
const strideDays = (w: PlanWeek): PlanDay[] =>
  w.days.filter((d) => d.workout.segments.some((s) => s.kind === 'stride'));

describe('F1 (D35): kontrolni test u planu sa rezultatom', () => {
  it('≥ 12 nedelja: tačno jedan test u poslednjoj ne-rasteretnoj nedelji razvoja, na danu Q1; < 12 i početnik: nijedan', () => {
    for (const days of [3, 4, 5, 6] as const)
      for (const weeks of [10, 11, 12, 14, 16, 18]) {
        const p = planOf(days, { weeks, km: days === 3 ? 30 : 45 });
        const want =
          weeks >= 12
            ? [
                Math.max(
                  ...p.weeks
                    .filter((w) => w.phase === 'development' && !w.deload)
                    .map((w) => w.index)
                )
              ]
            : [];
        expect(testWeeks(p), `${days} d ${weeks} ned`).toEqual(want);
        for (const i of want) {
          const t = p.weeks[i - 1]!.days.find((d) => d.role === 'test')!;
          expect(t.weekday).toBe(p.pattern.q1);
          expect(t.workout.segments.find((s) => s.kind === 'test')!.km).toBe(5);
          expect(p.weeks[i - 1]!.notes.some((n) => n.startsWith('Kontrolni test 5 km'))).toBe(true);
          expect(p.notes.some((n) => n.includes('Unesi rezultat'))).toBe(true);
        }
        expect(errors(p)).toEqual([]);
      }
    expect(testWeeks(planOf(4, { weeks: 16, km: 30, vdot: 35, beginner: true }))).toEqual([]);
    // Plan po osećaju: i dalje test u poslednjoj nedelji baze (D27), samo jedan.
    const f = planOf(4, { weeks: 16, km: 40, easy: 360 });
    expect(testWeeks(f)).toEqual([f.weeks.map((w) => w.phase).lastIndexOf('base') + 1]);
  });

  it('O1: test nedelja sa spuštenim drugim slotom ne obara „glavna doza ne opada" (d5 48 km 18 ned VDOT 35)', () => {
    const p = planOf(5, { weeks: 18, km: 48, vdot: 35 });
    const t = p.weeks[testWeeks(p)[0]! - 1]!;
    expect(t.days.find((d) => d.role === 'q2')!.workout.dose!.step).toBe('drop');
    expect(errors(p)).toEqual([]);
  });
});

describe('F3 (D36): ubrzanja na laganom danu', () => {
  it('nedelja izgradnje i tapera: tačno jedan lagan dan, najudaljeniji od poslednjeg zahtevnog dana; baza 4 × 20 s, posle 6 × 20 s', () => {
    const sample = ([3, 4, 5, 6] as const).flatMap((d) =>
      grid02Inputs(d).filter((_, i) => i % 97 === 0)
    );
    let checked = 0;
    for (const c of sample) {
      const r = generateTenKV2(c.input);
      expect(r.ok, c.id).toBe(true);
      if (!r.ok) continue;
      const hard = r.plan.weeks
        .flatMap((w) => w.days)
        .filter((d) => d.hard)
        .map((d) => d.date);
      for (const w of r.plan.weeks) {
        const s = strideDays(w);
        if (w.phase === 'race') {
          expect(s.every((d) => d.role === 'eve')).toBe(true);
          continue;
        }
        const easy = w.days.filter((d) => d.role === 'easy');
        expect(s.length, `${c.id} ${w.index}`).toBe(easy.length > 0 ? 1 : 0);
        if (s.length === 0) continue;
        checked++;
        const d = s[0]!;
        const st = d.workout.segments.filter((x) => x.kind === 'stride');
        expect(st.length).toBe(w.phase === 'base' ? 4 : 6);
        expect(st.every((x) => x.sec === 20 && x.zone === 'R')).toBe(true);
        // Dužina dana je lagan dan (ubrzanja nisu dodatni km): jednaka ostalim laganima (D19, ±0,1 km).
        for (const e of easy)
          expect(Math.abs(e.workout.km - d.workout.km)).toBeLessThanOrEqual(0.1 + 1e-9);
        const gap = (x: string): number => {
          const prior = hard.filter((h) => h < x);
          return prior.length > 0 ? daysBetween(prior[prior.length - 1]!, x) : 99;
        };
        const best = [...easy].sort(
          (a, b) => gap(b.date) - gap(a.date) || a.date.localeCompare(b.date)
        )[0]!;
        if (w.index > 1) expect(d.date, `${c.id} ${w.index}`).toBe(best.date);
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('početnik: bez ubrzanja u uvodu (ned 1–2), posle 4 × 20 s', () => {
    const p = planOf(4, { weeks: 14, km: 25, vdot: 35, beginner: true });
    expect(p.weeks.slice(0, 2).every((w) => strideDays(w).length === 0)).toBe(true);
    for (const w of p.weeks.slice(2, -1))
      for (const d of strideDays(w))
        expect(d.workout.segments.filter((x) => x.kind === 'stride')).toHaveLength(4);
    expect(p.weeks.slice(2, -1).some((w) => strideDays(w).length === 1)).toBe(true);
  });
});

describe('F4 (D37): početna doza T i I 80 % plafona', () => {
  const T = [2000, 2500, 3000, 3500, 4000, 4500, 5000];
  const I = [2000, 2400, 3000, 3600, 4000, 4800, 5000, 6000];
  const start = (lad: number[], cap: number): number =>
    lad.filter((m) => m <= 0.8 * cap + 1e-6).pop() ?? lad[0]!;
  it('prva nedelja T (Q2 baze) i prva nedelja I (razvoj) = najviši nivo ≤ 80 % plafona', () => {
    for (const km of [35, 45, 55]) {
      const p = planOf(4, { weeks: 14, km });
      const w1 = p.weeks[0]!;
      const t = w1.days.find((d) => d.role === 'q2')!.workout.dose!;
      expect(t.doseM, `${km}`).toBe(start(T, Math.floor(0.1 * w1.targetKm * 1000 + 1e-6)));
      const d1 = p.weeks.find((w) => w.phase === 'development' && !w.deload)!;
      const i = d1.days.find((d) => d.role === 'q1')!.workout.dose!;
      expect(i.doseM, `${km}`).toBe(start(I, Math.floor(0.08 * d1.targetKm * 1000 + 1e-6)));
    }
  });
});

describe('F2 (D38): dva preteška ili preskočena kvaliteta → sledeća nedelja bez rasta doze', () => {
  const p = planOf(4, { weeks: 14, km: 40 });
  // Kraj nedelje 2 (baza, sledi baza 3): zapisi svih dana nedelja 1–2, oba kvaliteta nedelje 2 sa RPE 9.
  const w2 = p.weeks[1]!;
  const asOf = w2.endDate;
  const from = p.weeks[0]!.startDate;
  interface Rec {
    date: string;
    dayId?: string;
    km: number;
    durationSec: number;
    completed: boolean;
    rpe?: number;
    pain?: number;
  }
  const facts = (rpeQ: number, extra: Rec[] = []): { workouts: Rec[]; coverage: unknown } => ({
    workouts: [
      ...p.weeks.slice(0, 2).flatMap((w) =>
        w.days.map((d) => ({
          date: d.date,
          dayId: d.date,
          km: d.workout.km,
          durationSec: d.workout.sec,
          completed: true,
          rpe: w.index === 2 && (d.role === 'q1' || d.role === 'q2') ? rpeQ : 5
        }))
      ),
      ...extra
    ],
    coverage: { from, to: asOf, complete: true }
  });
  const slotDose = (w: PlanWeek, r: string) => w.days.find((d) => d.role === r)?.workout.dose;

  it('RPE ≥ 9 na oba: nedelja 3 drži dozu oba slota (druga struktura), cilj po pravilu isti; RPE 8: bez efekta', () => {
    const ctl = adaptTenKV2(p, facts(8), asOf);
    const r = adaptTenKV2(p, facts(9), asOf);
    expect(ctl.ok && r.ok).toBe(true);
    if (!ctl.ok || !r.ok) return;
    expect(ctl.reasons.some((x) => x.condition === 'QUALITY_HOLD')).toBe(false);
    const h = r.reasons.find((x) => x.condition === 'QUALITY_HOLD')!;
    expect(h.applied).toBe(true);
    expect(h.message).toMatch(
      /^Poslednja dva zahtevna treninga su bila preteška ili preskočena — doza ove nedelje ne raste/
    );
    const w3 = r.plan.weeks[2]!;
    for (const role of ['q1', 'q2']) {
      expect(slotDose(w3, role)!.doseM).toBe(slotDose(w2, role)!.doseM);
      expect(slotDose(ctl.plan.weeks[2]!, role)!.doseM).toBeGreaterThan(slotDose(w2, role)!.doseM);
    }
    expect(w3.nominalKm).toBe(ctl.plan.weeks[2]!.nominalKm);
    expect(w3.notes.some((n) => n.startsWith('Doza ove nedelje ne raste'))).toBe(true);
    expect(r.plan.adaptation!.steps[0]!.holdDose).toBe(3);
    // Isti zapisi sutra: ne sudi se ponovo (korak bez holdDose), nedelja 3 ostaje zadržana iz prvog koraka.
    const again = adaptTenKV2(r.plan, facts(9), addDays(asOf, 1));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.reasons.some((x) => x.condition === 'QUALITY_HOLD')).toBe(false);
    expect(again.plan.adaptation!.steps[1]!.holdDose).toBeUndefined();
    expect(slotDose(again.plan.weeks[2]!, 'q2')!.doseM).toBe(slotDose(w2, 'q2')!.doseM);
  });

  it('preskočena oba (bez zapisa uz pokrivenost) → primenjeno; uz bol → applied false', () => {
    const skip = facts(5);
    const q = w2.days.filter((d) => d.role === 'q1' || d.role === 'q2').map((d) => d.date);
    const missed = skip.workouts.filter((x) => q.includes(x.date)).reduce((a, x) => a + x.km, 0);
    // Obim nadoknađen laganim trčanjem van plana (bez manjka izvršenja, A2) — kvalitet ipak preskočen.
    const noQ = {
      ...skip,
      workouts: [
        ...skip.workouts.filter((x) => !q.includes(x.date)),
        { date: asOf, km: missed, durationSec: Math.round(missed * 360), completed: true, rpe: 4 }
      ]
    };
    const r = adaptTenKV2(p, noQ, asOf);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.reasons.some((x) => x.condition === 'UNDER_EXECUTION')).toBe(false);
      expect(r.reasons.find((x) => x.condition === 'QUALITY_HOLD')?.applied).toBe(true);
    }
    // Bez nadoknade: manjak izvršenja (A2) ima prednost — F2 se beleži kao neprimenjen.
    const under = adaptTenKV2(
      p,
      { ...skip, workouts: skip.workouts.filter((x) => !q.includes(x.date)) },
      asOf
    );
    expect(under.ok).toBe(true);
    if (under.ok) {
      expect(under.reasons.find((x) => x.condition === 'UNDER_EXECUTION')?.applied).toBe(true);
      expect(under.reasons.find((x) => x.condition === 'QUALITY_HOLD')?.applied).toBe(false);
    }
    const pain = adaptTenKV2(
      p,
      facts(9, [{ date: asOf, km: 3, durationSec: 1200, completed: true, pain: 5 }]),
      asOf
    );
    expect(pain.ok).toBe(true);
    if (pain.ok) {
      expect(pain.reasons.find((x) => x.condition === 'QUALITY_HOLD')?.applied).toBe(false);
      expect(pain.plan.adaptation!.steps[0]!.holdDose).toBeUndefined();
    }
  });

  it('trčanje van plana na datum kvaliteta (uvoz bez dayId) = odrađen dan; RPE takvog zapisa ne okida D38', () => {
    const base = facts(5);
    const q = w2.days.filter((d) => d.role === 'q1' || d.role === 'q2').map((d) => d.date);
    // Uvoz (npr. Strava): isti dani bez veze sa danom plana, oba kvaliteta sa RPE 9.
    const imported = {
      ...base,
      workouts: base.workouts.map(({ dayId: _d, ...x }) =>
        q.includes(x.date) ? { ...x, rpe: 9 } : x
      )
    };
    const r = adaptTenKV2(p, imported, asOf);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reasons.some((x) => x.condition === 'QUALITY_HOLD')).toBe(false);
    // Zapis dana plana preskočen, ali tog datuma postoji trčanje van plana → dan je odrađen.
    const swap = {
      ...base,
      workouts: [
        ...base.workouts.filter((x) => !q.includes(x.date)),
        ...q.map((date) => ({ date, km: 6, durationSec: 2100, completed: true, rpe: 9 }))
      ]
    };
    const r2 = adaptTenKV2(p, swap, asOf);
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.reasons.some((x) => x.condition === 'QUALITY_HOLD')).toBe(false);
  });

  it('bez pokrivenosti nema okidača preskočenog dana; taper bez efekta', () => {
    const f = facts(5);
    const q = w2.days.filter((d) => d.role === 'q1' || d.role === 'q2').map((d) => d.date);
    const r = adaptTenKV2(p, { workouts: f.workouts.filter((x) => !q.includes(x.date)) }, asOf);
    expect(r.ok && r.reasons.some((x) => x.condition === 'QUALITY_HOLD')).toBe(false);
    const sp = p.weeks.find((w) => w.phase === 'taper')!;
    const last = p.weeks[sp.index - 2]!;
    const a = last.endDate;
    const ff = {
      workouts: p.weeks
        .slice(sp.index - 3, sp.index - 1)
        .flatMap((w) => w.days)
        .map((d) => ({
          date: d.date,
          dayId: d.date,
          km: d.workout.km,
          durationSec: d.workout.sec,
          completed: true,
          rpe: d.role === 'q1' || d.role === 'q2' ? 9 : 5
        })),
      coverage: { from: p.weeks[sp.index - 3]!.startDate, to: a, complete: true }
    };
    const t = adaptTenKV2(p, ff, a);
    expect(t.ok).toBe(true);
    if (t.ok) {
      expect(t.reasons.find((x) => x.condition === 'QUALITY_HOLD')?.applied).toBe(false);
      expect(t.plan.adaptation!.steps[0]!.holdDose).toBeUndefined();
    }
  });
});

describe('validator: nedelja testa posle mešovite nedelje (P5, mreža E)', () => {
  it('f-d3-17w-35km-e315-B-sat, asOf sreda ned 5, manjak/pauza: test nedelja ne određuje stanje Q1 — rasterećenje se ne sudi', () => {
    const b = earlyGridBases().find((x) => x.id === 'f-d3-17w-35km-e315-B-sat')!;
    const g = generateTenKV2(b.input);
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    const asOf = earlyAsOfs(g.plan).find((x) => x.tag === 'w5wed')!.asOf;
    for (const s of ['under', 'pause10'] as const) {
      const r = adaptTenKV2(g.plan, earlyFacts(g.plan, s, asOf), asOf);
      expect(r.ok, s).toBe(true);
    }
  });
});
