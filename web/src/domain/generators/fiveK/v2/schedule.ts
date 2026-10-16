/* Raspored 4 dana: 2 kvaliteta + dugi + 1 lagan. Zahtevni dani (q1, q2, dugi) moraju biti
   razmaknuti ≥ minHardGapDays i CIKLIČNO (nedelja → ponedeljak sledeće nedelje). */

import { weekdayIndex, WEEKDAYS } from './dates.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import type { Pattern, Reason, Weekday } from './types.ts';

/** Ciklični razmak u danima između dva dana u nedelji. */
export function cyclicGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 7;
  return Math.min(d, 7 - d);
}

/** Razmak od dana `from` napred do dana `to` (1…7). */
function forwardGap(from: number, to: number): number {
  const d = (((to - from) % 7) + 7) % 7;
  return d === 0 ? 7 : d;
}

export type PatternResult = { ok: true; pattern: Pattern } | { ok: false; reason: Reason };

export function choosePattern(runDays: readonly Weekday[]): PatternResult {
  const idx = runDays.map(weekdayIndex).sort((a, b) => a - b);
  const candidates: { pattern: Pattern; longRank: number; minGap: number; order: number }[] = [];
  let order = 0;
  for (let skip = 0; skip < idx.length; skip++) {
    const hard = idx.filter((_, i) => i !== skip);
    const easy = idx[skip]!;
    let minGap = 7;
    for (let i = 0; i < hard.length; i++)
      for (let j = i + 1; j < hard.length; j++)
        minGap = Math.min(minGap, cyclicGap(hard[i]!, hard[j]!));
    if (minGap < P.schedule.minHardGapDays) continue;
    for (const long of hard) {
      // Ostala dva zahtevna dana redom posle dugog; glavni kvalitet je onaj sa više odmora pre sebe.
      const [a, b] = hard
        .filter((d) => d !== long)
        .sort((x, y) => forwardGap(long, x) - forwardGap(long, y)) as [number, number];
      const gapA = forwardGap(long, a);
      const gapB = forwardGap(a, b);
      const [q1, q2] = gapB > gapA ? [b, a] : [a, b];
      candidates.push({
        pattern: {
          long: WEEKDAYS[long]!,
          q1: WEEKDAYS[q1]!,
          q2: WEEKDAYS[q2]!,
          easy: WEEKDAYS[easy]!
        },
        longRank: P.schedule.longDayPreference.indexOf(WEEKDAYS[long]!),
        minGap,
        order: order++
      });
    }
  }
  candidates.sort((x, y) => x.longRank - y.longRank || y.minGap - x.minGap || x.order - y.order);
  const best = candidates[0];
  if (!best)
    return {
      ok: false,
      reason: {
        code: 'RUN_DAYS_SPACING',
        message:
          'Izabrani dani ne dozvoljavaju 3 zahtevna dana (2 kvaliteta + dugi) bez uzastopnih dana. Izaberi razmaknutije dane.'
      }
    };
  return { ok: true, pattern: best.pattern };
}
