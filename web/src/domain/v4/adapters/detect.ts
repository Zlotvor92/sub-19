/* V4 ADAPTERI — ULAZ: `adopt(stanjeKorisnika, today)` sam prepozna format (lični plan, v2, stari format) i vrati
   `{ doc, facts }` ili `{ error }`. Nikad ne baca izuzetak i nikad ne menja ulaz (SPEC § 9.1). */
import { isValidDate } from '../engine/dates';
import type { IsoDate } from '../engine/types';
import { legacySpec } from './legacy';
import { isPersonal, personalSpec } from './personal';
import { num, readState, type ReadError, type ReadPlan } from './read';
import { assemble, type AdoptOk, type FormatSpec } from './shared';
import { DISTANCE_BY_METERS } from './stimuli';
import { isV2, v2Spec } from './v2';

export type AdoptResult = AdoptOk | { error: ReadError };

export function distanceOf(plan: ReadPlan): { id: string; distanceM: number } | null {
  const m = num(plan.meta['raceDistM']);
  if (m === null) return null;
  return DISTANCE_BY_METERS.find((d) => Math.abs(d.distanceM - m) < 1) ?? null;
}

export function specOf(plan: ReadPlan): FormatSpec | { error: ReadError } {
  const distance = distanceOf(plan);
  if (distance === null) {
    return {
      error: {
        code: 'nepoznata-distanca',
        message: 'Plan nema poznatu dužinu trke (meta.raceDistM).'
      }
    };
  }
  if (isPersonal(plan)) return personalSpec(plan, distance);
  if (isV2(plan)) return v2Spec(plan, distance);
  return legacySpec(plan, distance);
}

/** Stanje korisnika (`genPlan`, `log`, `alts`, `moves`, `vanPlana`, …) → `PlanDoc` + činjenice o trkaču. */
export function adopt(input: unknown, today: IsoDate): AdoptResult {
  try {
    if (!isValidDate(today)) {
      return {
        error: {
          code: 'datum-neispravan',
          message: `Neispravan današnji datum (${String(today)}).`
        }
      };
    }
    const state = readState(input);
    if ('error' in state) return state;
    const spec = specOf(state.plan);
    if ('error' in spec) return spec;
    return assemble(state, spec, today);
  } catch (e) {
    return {
      error: {
        code: 'oblik-neispravan',
        message: `Plan nije moguće pročitati: ${e instanceof Error ? e.message : String(e)}`
      }
    };
  }
}
