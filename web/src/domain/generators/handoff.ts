/* PREDAJA DRUGOM GENERATORU (aplikacioni izbor, bez trenerskih odluka).

   Odluka o ograničenoj pripremi nudi „kraću distancu". Plan te distance pravi, obrađuje i ocenjuje generator te distance:
   - maraton (`marathon/plan/preparationDecision.ts`) → polumaraton ili 10K;
   - polumaraton (`halfMarathon/plan/preparationDecision.ts`) → 10K ili 5K;
   HM i maraton ovu funkciju dobijaju kao argument iz `select.ts` (generatori se međusobno ne uvoze). Izvor predaje samo
   ČINJENICE (`HandoffFacts`: ulaz, potvrđeno izvršenje, početak od stvarne baze); povratnu politiku, bazu zaštite rasta i
   pokrivenost pripreme određuje ciljni generator (`handoffFuture`, A2).
   `null` znači da za distancu nema izdvojenog generatora (plan pravi pozivalac).

   Faza 3 (segment 3b): izvor v2 (HM v2, maraton v2) prema v1 cilju. v1 `handoffFuture` kalemi plan cilja na plan izvora
   (`graftFuturePlan` spaja `meta` izvora i cilja), pa bi plan v2 u planu cilja ostavio svoj objekat (`hmV2`,
   `marathonV2`) i meta ključeve v2 (DESIGN.md M2: 100 % predaja). v1 cilj zato dobija POGLED izvora bez njih; spisak
   ključeva daje adapter izvora (jedini koji zna svoj format) kao argument, ovde se ne uvozi. v1 kod se ne menja. */
import type { GenPlanState } from '../state';
import { handoffFuture as fiveKHandoffFuture } from './fiveK';
import { handoffFuture as halfMarathonHandoffFuture } from './halfMarathon';
import { handoffFuture as tenKHandoffFuture } from './tenK';

type V1Target =
  typeof fiveKHandoffFuture | typeof tenKHandoffFuture | typeof halfMarathonHandoffFuture;

export function regeneratorForDistance(raceDistM: number | undefined): V1Target | null {
  const dist = raceDistM || 5000;
  if (dist === 5000) return fiveKHandoffFuture;
  if (dist === 10000) return tenKHandoffFuture;
  if (dist === 21097.5) return halfMarathonHandoffFuture;
  return null;
}

/** Format plana izvora v2 koji v1 cilj ne sme da nasledi: ključ objekta plana v2 i meta ključevi koje piše samo v2.
 *  Daje ga adapter izvora (`<distanca>/v2/app/`). */
export interface SourceFormat {
  readonly planKey: string;
  readonly metaKeys: readonly string[];
}

/** Pogled plana izvora za v1 cilj: bez objekta plana v2 i bez meta ključeva v2. Nedelje i dani ostaju (istorija). */
export function sourceViewForV1<P extends GenPlanState>(current: P, format: SourceFormat): P {
  const { [format.planKey]: _plan, ...rest } = current as P & Record<string, unknown>;
  const meta = current.meta
    ? (Object.fromEntries(
        Object.entries(current.meta).filter(([k]) => !format.metaKeys.includes(k))
      ) as P['meta'])
    : current.meta;
  return { ...rest, meta } as P;
}

/** O5 (DESIGN.md § 8): v1 cilj gradi plan iz rezultata (`pb`); plan v2 po osećaju ga nema. */
export const V1_TARGET_NEEDS_RESULT =
  'Kraća distanca nije dostupna: plan te distance (v1) traži rezultat trke ili testa, a ovaj plan je po osećaju.';

/** v1 cilj za izvor v2: isti `handoffFuture`, nad pogledom izvora bez formata v2; bez rezultata → odbijanje sa
 *  razlogom (nikad tihi prelaz). `null` kao `regeneratorForDistance`. */
export function v1TargetForV2Source(
  raceDistM: number | undefined,
  format: SourceFormat
): V1Target | null {
  const target = regeneratorForDistance(raceDistM);
  if (!target) return null;
  return (current, input, today, context, facts) => {
    const pb = (input as { pb?: { distM?: unknown; sec?: unknown } }).pb;
    if (!pb || !(Number(pb.distM) > 0) || !(Number(pb.sec) > 0))
      return { error: V1_TARGET_NEEDS_RESULT };
    return target(sourceViewForV1(current, format), input, today, context, facts);
  };
}
