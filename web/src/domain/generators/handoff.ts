/* PREDAJA DRUGOM GENERATORU (aplikacioni izbor, bez trenerskih odluka).

   Odluka o ograničenoj pripremi polumaratona/maratona (`domain/plan/preparationDecision.ts`, stari mehanizam) nudi
   „kraću distancu". Kad je ta distanca 5K, preostali plan pravi i obrađuje 5K generator, a ne stari mehanizam. */
import { regenerateFuture as fiveKRegenerateFuture } from './fiveK';

export function regeneratorForDistance(
  raceDistM: number | undefined
): typeof fiveKRegenerateFuture | null {
  return (raceDistM || 5000) === 5000 ? fiveKRegenerateFuture : null;
}
