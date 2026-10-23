/* Raspored nedelje po broju dana (2.3.0, tabela `days` u policy.ts):
   3 dana: 1 kvalitet + dugi + 1 lagan; 4 dana: 2 kvaliteta + dugi + 1 lagan;
   5 dana: 2 kvaliteta + dugi + 2 lagana. 2.4.0: početnik 1 kvalitet (4 dana: + 2 lagana).
   Zahtevni dani (kvaliteti, dugi) moraju biti razmaknuti ≥ minHardGapDays i CIKLIČNO
   (nedelja → ponedeljak sledeće nedelje). */

import { weekdayIndex, WEEKDAYS } from './dates.ts';
import { daysRule, FIVE_K_V2_POLICY as P, type RunDaysCount } from './policy.ts';
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

/** Svi podskupovi veličine k (redom indeksa). */
function combinations(xs: readonly number[], k: number): number[][] {
  if (k === 0) return [[]];
  const out: number[][] = [];
  xs.forEach((x, i) => {
    for (const rest of combinations(xs.slice(i + 1), k - 1)) out.push([x, ...rest]);
  });
  return out;
}

export type PatternResult = { ok: true; pattern: Pattern } | { ok: false; reason: Reason };

/** `qualityDays`: 2.4.0 iz rulesOf (početnik 1); podrazumevano red tabele `days`. */
export function choosePattern(
  runDays: readonly Weekday[],
  qualityDays: number = daysRule(runDays.length as RunDaysCount).qualityDays
): PatternResult {
  const idx = runDays.map(weekdayIndex).sort((a, b) => a - b);
  const rule = { qualityDays };
  const hardCount = rule.qualityDays + 1;
  const candidates: { pattern: Pattern; longRank: number; minGap: number; order: number }[] = [];
  let order = 0;
  // Obrnut leksikografski redosled = redosled iz 2.2.0 (izostavljen dan 0, 1, …) pri jednakim kandidatima.
  for (const hard of combinations(idx, hardCount).reverse()) {
    const easy = idx.filter((d) => !hard.includes(d));
    let minGap = 7;
    for (let i = 0; i < hard.length; i++)
      for (let j = i + 1; j < hard.length; j++)
        minGap = Math.min(minGap, cyclicGap(hard[i]!, hard[j]!));
    if (minGap < P.schedule.minHardGapDays) continue;
    for (const long of hard) {
      // Ostali zahtevni dani redom posle dugog; glavni kvalitet je onaj sa više odmora pre sebe.
      const rest = hard
        .filter((d) => d !== long)
        .sort((x, y) => forwardGap(long, x) - forwardGap(long, y));
      let q1 = rest[0]!;
      let q2: number | null = null;
      if (rest.length === 2) {
        const [a, b] = rest as [number, number];
        [q1, q2] = forwardGap(a, b) > forwardGap(long, a) ? [b, a] : [a, b];
      }
      candidates.push({
        pattern: {
          long: WEEKDAYS[long]!,
          q1: WEEKDAYS[q1]!,
          q2: q2 === null ? null : WEEKDAYS[q2]!,
          easy: easy.map((d) => WEEKDAYS[d]!)
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
        message: `Izabrani dani ne dozvoljavaju ${hardCount} zahtevna dana (${rule.qualityDays === 1 ? '1 kvalitet' : `${rule.qualityDays} kvaliteta`} + dugi) bez uzastopnih dana. Izaberi razmaknutije dane.`
      }
    };
  return { ok: true, pattern: best.pattern };
}
