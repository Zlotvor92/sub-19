/* D34 / A25 (P3, 10k-v2.11.0) — tip ne-rasteretne specifične nedelje (A: Q2 T cruise, B: Q2 I održavanja). JEDINO
   mesto odluke: konstruktor (generate.ts, iz nedelja kakve se upisuju) i validator (validate.ts) zovu istu funkciju nad
   prethodnim nedeljama plana. Redovan plan 4–6 dana; 3 dana i početnik nemaju tipove (null). */

import type { PlanRule } from './policy.ts';
import { isA9Note } from './week.ts';

export type SpecificType = 'A' | 'B';

/** Nedelja kakvu funkcija čita (PlanWeek ili nedelja konstruktora sa upisanim danima). */
export interface TypedWeek {
  readonly phase: string;
  readonly deload: boolean;
  readonly limits?: { readonly quality?: unknown } | undefined;
  readonly notes: readonly string[];
  readonly days: readonly {
    readonly role: string;
    readonly workout: { readonly dose?: { readonly ladder: string } | null | undefined };
  }[];
}

/** D34: plan ima smenu A/B (redovan plan sa dva kvaliteta: 4–6 dana, ne početnik). */
export const hasSpecificTypes = (rule: PlanRule): boolean => rule.quality === 2 && !rule.beginner;

/** D34: nedelja koja nosi tip — specifična, ne-rasteretna, bez ograničenja kvaliteta adaptacije (A4/A9). */
export const typedWeek = (w: TypedWeek): boolean =>
  w.phase === 'specific' && !w.deload && w.limits?.quality === undefined && !w.notes.some(isA9Note);

/** D34: tip upisane nedelje — B kad je drugi dan kvaliteta I (održavanja), inače A. */
export const typeOfWeek = (w: TypedWeek): SpecificType =>
  w.days.some((d) => d.role === 'q2' && d.workout.dose?.ladder === 'I') ? 'B' : 'A';

/**
 * D34/A25: tip sledeće nedelje koja nosi tip, iz prethodnih nedelja (prošlost = upisani dani): prva je A; posle
 * poslednje A je B i obrnuto. null = plan nema tipove (3 dana, početnik).
 */
export function specificTypeNext(prev: readonly TypedWeek[], rule: PlanRule): SpecificType | null {
  if (!hasSpecificTypes(rule)) return null;
  const last = [...prev].reverse().find(typedWeek);
  return !last || typeOfWeek(last) === 'B' ? 'A' : 'B';
}
