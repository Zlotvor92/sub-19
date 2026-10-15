/* PREDAJA DRUGOM GENERATORU (aplikacioni izbor, bez trenerskih odluka).

   Odluka o ograničenoj pripremi polumaratona/maratona (`domain/plan/preparationDecision.ts`, stari mehanizam) nudi
   „kraću distancu". Kad je ta distanca 5K ili 10K, preostali plan pravi i obrađuje izdvojeni generator te distance, a ne
   stari mehanizam. */
import { regenerateFuture as fiveKRegenerateFuture } from './fiveK';
import { regenerateFuture as tenKRegenerateFuture } from './tenK';

export function regeneratorForDistance(
  raceDistM: number | undefined
): typeof fiveKRegenerateFuture | typeof tenKRegenerateFuture | null {
  const dist = raceDistM || 5000;
  if (dist === 5000) return fiveKRegenerateFuture;
  if (dist === 10000) return tenKRegenerateFuture;
  return null;
}
