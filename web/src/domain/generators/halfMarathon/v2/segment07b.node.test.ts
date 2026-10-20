/* HM v2 Segment HM-07b (hm-v2.4.1): pouka 36 precizno — prinudno rasterećenje je nedelja POSLE nedelje poslednjeg
   zapisa umora (prva nedelja koja počinje posle zapisa); kad asOf već pada u nju, važi za njen ostatak (prošli dani
   upisani) — i provere po danu preskaču zaštićene dane (zaključane, upisane), kao LIMITS (pouka 4, stalni uslov 4).
   Trajna mreža: rana mreža (earlyGridBases) × nedelje k ∈ {2, 4, N − 6}:
   - umor: 2 zapisa RPE 8 u nedelji k − 1 (poslednji svaki dan nedelje), asOf svaki dan od poslednjeg zapisa dok su
     oba zapisa u prozoru A5 (do kraja nedelje k) → novo rasterećenje = nedelja k, 0 odbijanja; isti zapisi poslednjeg
     dana nedelje k − 1 i prvog dana nedelje k → isti dani od drugog dana nedelje k (kad rasterećenje ne menja prvi
     dan, koji je u drugom slučaju upisan);
   - rezultat (faster/slower/test5k) krajem nedelje k + zaključani Q1/Q2 (i samo Q1) nedelje k + 1, pa lanac: urađen
     Q1 nedelje k + 1 → 0 odbijanja.
   Izmereno na 16b8906 (docs/hm-v2/artifacts/segment-07b/probe.ts, svaki 97. ulaz): umor u pogrešnoj nedelji 5698 /
   20 202, prvi/poslednji dan različit plan 2590 / 2590; rezultat + zaštićen dan 2978 / 3336 odbijeno (WARMUP, …).
   Brz nivo: svaki 60. plan, poslednji zapis 2./6./7. dana nedelje; pun: deo 1/2 ovde, deo 2 u segment07b.2.full.node.test.ts. */

import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { adaptHmV2 } from './adapt.ts';
import { factsOf } from './adaptInputs.ts';
import { basePlan, earlyGridBases } from './adaptGrid.harness.node.test.ts';
import { addDays } from './dates.ts';
import { isBuildPhase } from './periodize.ts';
import type { AdaptResult, HmV2Facts, HmV2Plan, PlanDay } from './types.ts';
import { validatePlan } from './validate.ts';

const fatigue = (first: string, last: string): HmV2Facts => ({
  workouts: [first, last].map((date) => ({
    date,
    km: 6,
    durationSec: 2400,
    completed: true,
    rpe: 8
  }))
});
const newDeloads = (base: HmV2Plan, p: HmV2Plan): number[] =>
  p.weeks.filter((w) => w.deload && !base.weeks[w.index - 1]!.deload).map((w) => w.index);
const daysAfter = (p: HmV2Plan, d: string): string =>
  JSON.stringify(p.weeks.flatMap((w) => w.days).filter((x) => x.date > d));
/** Dan sa datumom `d` (prvi dan nedelje; u adaptaciji tog dana upisan) ili '' kad tog dana nema treninga. */
const firstDay = (p: HmV2Plan, d: string): string =>
  JSON.stringify(p.weeks.flatMap((w) => w.days).find((x) => x.date === d) ?? '');
const codes = (r: AdaptResult): string =>
  r.ok ? '' : r.reasons.map((x) => `${x.code} ${x.message.slice(0, 120)}`).join(' | ');
const weeksOf = (p: HmV2Plan): number[] => {
  const N = p.weeks.length;
  return [...new Set([2, 4, Math.max(2, N - 6)])].filter((k) => k <= N - 3);
};

export function describeSegment07bNet(index: number, parts: number): void {
  describe(`HM-07b trajna mreža: umor u nedelji k − 1, rezultat + zaštićen dan (deo ${index}/${parts})`, () => {
    const bad: string[] = [];
    const n = { fat: 0, applied: 0, pairs: 0, res: 0, chain: 0 };
    beforeAll(() => {
      const bases = earlyGridBases();
      for (const b of FULL ? part(bases, index, parts) : sample(bases, 60)) {
        const p = basePlan(b);
        for (const k of weeksOf(p)) {
          const wk = p.weeks[k - 1]!;
          const prev = p.weeks[k - 2]!;
          const applicable = isBuildPhase(wk.phase) && !wk.deload;
          for (const L of FULL ? [0, 1, 2, 3, 4, 5, 6] : [1, 5, 6]) {
            const last = addDays(prev.startDate, L);
            const first = L >= 2 ? addDays(last, -2) : last;
            const facts = fatigue(first, last);
            const at = new Map<string, HmV2Plan>();
            for (let x = 0; x <= 6 - (L >= 2 ? 2 : 0); x++) {
              const asOf = addDays(last, x);
              if (asOf > wk.endDate) break;
              n.fat++;
              const r = adaptHmV2(p, facts, asOf);
              const key = `${b.id}/k${k}/L${L}/${asOf}`;
              if (!r.ok) {
                bad.push(`${key}: odbijen ${codes(r)}`);
                continue;
              }
              at.set(asOf, r.plan);
              if (!applicable) continue;
              n.applied++;
              const nd = newDeloads(p, r.plan);
              if (nd.length !== 1 || nd[0] !== k)
                bad.push(`${key}: rasterećenje [${nd.join(',')}] umesto [${k}]`);
            }
            const end = at.get(prev.endDate);
            const start = at.get(wk.startDate);
            if (applicable && end && start) {
              n.pairs++;
              if (
                firstDay(end, wk.startDate) === firstDay(p, wk.startDate) &&
                daysAfter(end, wk.startDate) !== daysAfter(start, wk.startDate)
              )
                bad.push(`${b.id}/k${k}/L${L}: kraj k − 1 ≠ početak k od drugog dana`);
            }
          }
          const nx = p.weeks[k]!;
          const q1 = nx.days.find((x) => x.role === 'q1');
          const q2 = nx.days.find((x) => x.role === 'q2');
          if (!q1) continue;
          for (const s of ['faster', 'slower', 'test5k'] as const) {
            const asOf = wk.endDate;
            const base = factsOf(p, s, asOf) as HmV2Facts;
            for (const locked of q2 ? [[q1.date, q2.date], [q1.date]] : [[q1.date]]) {
              n.res++;
              const key = `${b.id}/k${k}/${s}/${locked.length}`;
              const r = adaptHmV2(p, { ...base, lockedDayIds: locked }, asOf);
              if (!r.ok) {
                bad.push(`${key}: odbijen ${codes(r)}`);
                continue;
              }
              if (locked.length === 1) continue;
              n.chain++;
              const day = r.plan.weeks[k]!.days.find((x) => x.date === q1.date)!;
              const done = {
                date: q1.date,
                dayId: q1.date,
                km: day.workout.km,
                durationSec: day.workout.sec,
                completed: true,
                rpe: 6
              };
              const r2 = adaptHmV2(
                r.plan,
                { workouts: [done], lockedDayIds: q2 ? [q2.date] : [] },
                q1.date
              );
              if (!r2.ok) bad.push(`${key}/urađen Q1: odbijen ${codes(r2)}`);
            }
          }
        }
      }
    }, 600_000);

    it('rasterećenje = nedelja k, isti plan kraj k − 1 / početak k, 0 odbijanja sa zaštićenim danima', () => {
      expect(n.applied).toBeGreaterThan(100);
      expect(n.pairs).toBeGreaterThan(5);
      expect(n.chain).toBeGreaterThan(5);
      expect(bad.slice(0, 20)).toEqual([]);
    });
  });
}

describeSegment07bNet(1, 2);

describe('HM-07b primeri', () => {
  const k = 3;
  // Prvi plan rane mreže bez treninga prvog dana nedelje k (inače je taj dan u adaptaciji prvog dana upisan).
  const b = earlyGridBases().find((x) => {
    const w = basePlan(x).weeks[k - 1]!;
    return isBuildPhase(w.phase) && !w.deload && w.days[0]!.date !== w.startDate;
  })!;
  const p = basePlan(b);
  const wk = p.weeks[k - 1]!;
  const prev = p.weeks[k - 2]!;

  it('pouka 36: zapisi umora pretposlednji i poslednji dan nedelje k − 1, asOf prvi dan nedelje k → rasterećenje nedelje k (ostatak)', () => {
    expect(isBuildPhase(wk.phase) && !wk.deload).toBe(true);
    const facts = fatigue(addDays(prev.endDate, -2), prev.endDate);
    const r = adaptHmV2(p, facts, wk.startDate);
    if (!r.ok) throw new Error(codes(r));
    const s = r.plan.adaptation!.steps.at(-1)!;
    expect([s.deload, s.fromWeek, s.deloadWeek]).toEqual([true, k + 1, k]);
    expect(newDeloads(p, r.plan)).toEqual([k]);
    expect(r.newLimits).toContain(`deload:${k}`);
    // Isti zapisi dan ranije (poslednji dan nedelje k − 1): ista nedelja, isti dani od drugog dana nedelje k.
    const e = adaptHmV2(p, facts, prev.endDate);
    if (!e.ok) throw new Error(codes(e));
    expect(e.plan.adaptation!.steps.at(-1)!.fromWeek).toBe(k);
    expect(daysAfter(r.plan, wk.startDate)).toBe(daysAfter(e.plan, wk.startDate));
    // Isti zapisi ponovo sutradan: bez novog rasterećenja, traka ih ne vidi kao nove (pouka 20).
    const again = adaptHmV2(r.plan, facts, addDays(wk.startDate, 1));
    if (!again.ok) throw new Error(codes(again));
    expect(newDeloads(p, again.plan)).toEqual([k]);
    expect(again.newLimits.filter((x) => x.startsWith('deload:'))).toEqual([]);
  });

  it('zaključan Q1 posle bržeg rezultata nosi stari tempo; validator ga ne sudi (pouka 4), ostali dani novi tempo', () => {
    const nx = p.weeks[k]!;
    const q1 = nx.days.find((x) => x.role === 'q1')!;
    const facts = factsOf(p, 'faster', wk.endDate) as HmV2Facts;
    const r = adaptHmV2(p, { ...facts, lockedDayIds: [q1.date] }, wk.endDate);
    if (!r.ok) throw new Error(codes(r));
    const day = (pl: HmV2Plan, d: string): PlanDay =>
      pl.weeks.flatMap((w) => w.days).find((x) => x.date === d)!;
    expect(day(r.plan, q1.date)).toEqual(q1);
    expect(r.plan.vdot).toBeGreaterThan(p.vdot);
    expect(validatePlan(r.plan).filter((x) => x.severity === 'error')).toEqual([]);
    // Bez zaključavanja Q1 dobija novi tempo (zagrevanje po novom srednjem E) — zaštita je samo za zaštićen dan.
    const free = adaptHmV2(p, facts, wk.endDate);
    if (!free.ok) throw new Error(codes(free));
    expect(day(free.plan, q1.date)).not.toEqual(q1);
  });
});
