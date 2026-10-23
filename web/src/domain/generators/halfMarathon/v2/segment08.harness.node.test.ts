/* HM-08 trajna mreža (pouka 37) — zajednički kod brzog nivoa (segment08.node.test.ts) i delova punog nivoa
   (segment08.{2…6}.full.node.test.ts). Opis mreže: segment08.node.test.ts. */

import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { adaptHmV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { basePlan, earlyGridBases } from './adaptGrid.harness.node.test.ts';
import { addDays, mustDay } from './dates.ts';
import { HM_V2_POLICY as P } from './policy.ts';
import type { AdaptResult, HmV2Facts, HmV2Plan } from './types.ts';
import { MIXED_NOTE } from './week.ts';

const EPS = 1e-9;
/** Pun nivo: svaki 8. plan rane mreže (≈ 2700 tokova u 6 delova; deo ≤ ~40 s lokalno). */
const FULL_EVERY = 8;
export const fatigue = (first: string, last: string): HmV2Facts => ({
  workouts: [first, last].map((date) => ({
    date,
    km: 6,
    durationSec: 2400,
    completed: true,
    rpe: 8
  }))
});
export const codes = (r: AdaptResult): string =>
  r.ok ? '' : r.reasons.map((x) => `${x.code} ${x.message.slice(0, 120)}`).join(' | ');

/** Pouka 37: mešovite nedelje (bez trkačke) sa danom posle asOf koji nije zaštićen, a planirano > cilj bez
    upozorenja MIXED_WEEK_OVER. */
function overWithoutWarning(p: HmV2Plan, asOf: string): number[] {
  const ad = p.adaptation!;
  const prot = new Set([...ad.lockedDayIds, ...(ad.doneDayIds ?? [])]);
  const fk = ad.factKm ?? {};
  return p.weeks
    .filter(
      (w) =>
        ad.mixedWeeks.includes(w.index) &&
        w.phase !== 'race' &&
        w.days.some((d) => mustDay(d.date) > mustDay(asOf) && !prot.has(d.date)) &&
        w.days.reduce(
          (a, d) => a + (!d.countsToWeek ? 0 : d.date in fk ? fk[d.date]! : d.workout.km),
          0
        ) >
          w.targetKm + P.tolerance.plannedKm + EPS &&
        !p.warnings.some((v) => v.rule === 'MIXED_WEEK_OVER' && v.week === w.index)
    )
    .map((w) => w.index);
}

export function describeSegment08Net(index: number, parts: number): void {
  describe(`HM-08 trajna mreža: umor asOf svaki dan nedelje k, zaključan/urađen dan k + 1 (deo ${index}/${parts})`, () => {
    const bad: string[] = [];
    const n = { flows: 0, recomposed: 0, over: 0, testDone: 0 };
    beforeAll(() => {
      const bases = earlyGridBases();
      for (const b of FULL ? part(sample(bases, FULL_EVERY), index, parts) : sample(bases, 60)) {
        const p = basePlan(b);
        const N = p.weeks.length;
        const ks = FULL
          ? Array.from({ length: Math.max(0, N - 4) }, (_, i) => i + 2)
          : [2, 4].filter((k) => k <= N - 3);
        for (const k of ks) {
          const wk = p.weeks[k - 1]!;
          const prev = p.weeks[k - 2]!;
          const next = p.weeks[k]!;
          const facts0 = fatigue(addDays(prev.endDate, -1), prev.endDate);
          const q = next.days.find((d) => d.role === 'q1' || d.role === 'q2');
          const first = next.days.find((d) => d.role !== 'race');
          for (let x = 0; x < 7; x++) {
            if (!FULL && x !== 0 && x !== 3) continue;
            const asOf = addDays(wk.startDate, x);
            const td = wk.days.find((d) => d.role === 'test');
            const testDone = !!td && td.date <= asOf;
            const variants: [string, HmV2Facts][] = [['umor', facts0]];
            if (x === 0 || x === 3) {
              if (q) variants.push(['zaključan', { ...facts0, lockedDayIds: [q.date] }]);
              if (first)
                variants.push([
                  'urađen',
                  {
                    workouts: [
                      ...facts0.workouts!,
                      {
                        date: asOf,
                        dayId: first.date,
                        km: first.workout.km,
                        durationSec: first.workout.sec,
                        completed: true
                      }
                    ]
                  }
                ]);
            }
            for (const [tag, facts] of variants) {
              n.flows++;
              const key = `${b.id}/k${k}/+${x}/${tag}`;
              const r = adaptHmV2(p, facts, asOf);
              if (!r.ok) {
                // Pre-postojeće (e2e482e, van pouke 37 — otvoreno za organizatora): test nedelje k urađen (≤ asOf,
                // zaštićen), a umor pomera test u k + 1 (A13) → dva testa (TEST). Broji se, ne prećutkuje.
                if (
                  testDone &&
                  r.reasons.every((x) =>
                    x.message.startsWith('TEST: Adaptiran plan: najviše jedan test')
                  )
                )
                  n.testDone++;
                else bad.push(`${key}: odbijen ${codes(r)}`);
                continue;
              }
              const inv = adaptInvariants(p, r.plan, asOf, facts);
              if (inv.length > 0) bad.push(`${key}: ${inv.slice(0, 3).join('; ')}`);
              const ow = overWithoutWarning(r.plan, asOf);
              if (ow.length > 0)
                bad.push(`${key}: planirano > cilj bez upozorenja, ned ${ow.join(',')}`);
              for (const w of r.plan.weeks)
                if (w.notes.some((t) => t.includes(MIXED_NOTE))) n.recomposed++;
              n.over += r.plan.warnings.filter((v) => v.rule === 'MIXED_WEEK_OVER').length;
            }
          }
        }
      }
    }, 600_000);
    it('0 odbijanja, adaptInvariants prazno, mešovita nedelja planirano ≤ cilj ili MIXED_WEEK_OVER', () => {
      expect(bad.slice(0, 10)).toEqual([]);
      expect(n.flows).toBeGreaterThan(0);
      // Mreža mora imati mešovite nedelje sa ostatkom (inače ne proverava pouku 37).
      expect(n.recomposed).toBeGreaterThan(0);
    });
  });
}
