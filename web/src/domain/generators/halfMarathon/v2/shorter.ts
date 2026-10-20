/* FAZA 3 (segment 3c, DESIGN.md § 3 P1, § 8 O1) — okidač ponude „kraća distanca" u HM v2. Jedino mesto ove odluke.

   Ponuda postoji kada je plan posle prihvaćene adaptacije ispod praga upozorenja najdužeg dugog (LONG_RUN_SHORT:
   `lengths.longRunShort`, ista funkcija kao validator; 16 km, početnik 14 km). Plan generatora za isti ulaz (bez
   činjenica) NIJE ispod praga. Trka mora biti posle `asOf`. Ovo je prelaz, ne stanje čarobnjaka: plan koji je već iz
   generatora ispod praga nikad ne dobija ponudu.

   „Pre adaptacije" je plan generatora za isti ulaz. On se izvodi iz sačuvanog plana, pa nema novog polja u planu. Plan
   ostaje bajt-isti za sve tokove; ponudu računaju pregled adaptacije i odluka o pripremi. Ponuda nije prelaz na silu:
   „zadrži plan v2" je uvek moguće. */

import { generateHmV2 } from './generate.ts';
import { longRunShort } from './lengths.ts';
import { planRule } from './policy.ts';
import type { HmV2Plan, IsoDate } from './types.ts';

/** Prag upozorenja najdužeg dugog za ulaz plana [km]; `null` kad broj dana nije u tabeli. */
export function longWarnKmOf(plan: HmV2Plan): number | null {
  const rule = planRule(
    plan.input.runDays.length,
    plan.input.experience === 'beginner' ? 'beginner' : 'regular'
  );
  return rule ? rule.longWarnKm : null;
}

/** O1: adaptirani plan je ispod praga, a plan generatora za isti ulaz nije; trka je posle `asOf` (bez `asOf`: ne
 *  proverava se — pozivalac je već proverio datum). Plan bez adaptacije nikad nema ponudu. */
export function shorterOffer(plan: HmV2Plan, asOf?: IsoDate): boolean {
  if (!plan.adaptation) return false;
  if (asOf !== undefined && !(plan.input.raceDate > asOf)) return false;
  const warn = longWarnKmOf(plan);
  if (warn === null || !longRunShort(plan.weeks, warn)) return false;
  const born = generateHmV2(plan.input);
  return born.ok && !longRunShort(born.plan.weeks, warn);
}
