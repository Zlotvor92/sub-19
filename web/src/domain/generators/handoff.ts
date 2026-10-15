/* PREDAJA DRUGOM GENERATORU (aplikacioni izbor, bez trenerskih odluka).

   Odluka o ograničenoj pripremi nudi „kraću distancu". Plan te distance pravi i obrađuje generator te distance:
   - maraton (`domain/plan/preparationDecision.ts`, stari mehanizam) → polumaraton ili 10K;
   - polumaraton (`halfMarathon/plan/preparationDecision.ts`) → 10K ili 5K; HM ovu funkciju dobija kao argument iz
     `select.ts` (generatori se međusobno ne uvoze).
   `null` znači da za distancu nema izdvojenog generatora (plan pravi pozivalac). */
import { regenerateFuture as fiveKRegenerateFuture } from './fiveK';
import { regenerateFuture as halfMarathonRegenerateFuture } from './halfMarathon';
import { regenerateFuture as tenKRegenerateFuture } from './tenK';

export function regeneratorForDistance(
  raceDistM: number | undefined
):
  | typeof fiveKRegenerateFuture
  | typeof tenKRegenerateFuture
  | typeof halfMarathonRegenerateFuture
  | null {
  const dist = raceDistM || 5000;
  if (dist === 5000) return fiveKRegenerateFuture;
  if (dist === 10000) return tenKRegenerateFuture;
  if (dist === 21097.5) return halfMarathonRegenerateFuture;
  return null;
}
