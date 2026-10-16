/* PREDAJA DRUGOM GENERATORU (aplikacioni izbor, bez trenerskih odluka).

   Odluka o ograničenoj pripremi nudi „kraću distancu". Plan te distance pravi, obrađuje i ocenjuje generator te distance:
   - maraton (`marathon/plan/preparationDecision.ts`) → polumaraton ili 10K;
   - polumaraton (`halfMarathon/plan/preparationDecision.ts`) → 10K ili 5K;
   HM i maraton ovu funkciju dobijaju kao argument iz `select.ts` (generatori se međusobno ne uvoze). Izvor predaje samo
   ČINJENICE (`HandoffFacts`: ulaz, potvrđeno izvršenje, početak od stvarne baze); povratnu politiku, bazu zaštite rasta i
   pokrivenost pripreme određuje ciljni generator (`handoffFuture`, A2).
   `null` znači da za distancu nema izdvojenog generatora (plan pravi pozivalac). */
import { handoffFuture as fiveKHandoffFuture } from './fiveK';
import { handoffFuture as halfMarathonHandoffFuture } from './halfMarathon';
import { handoffFuture as tenKHandoffFuture } from './tenK';

export function regeneratorForDistance(
  raceDistM: number | undefined
): typeof fiveKHandoffFuture | typeof tenKHandoffFuture | typeof halfMarathonHandoffFuture | null {
  const dist = raceDistM || 5000;
  if (dist === 5000) return fiveKHandoffFuture;
  if (dist === 10000) return tenKHandoffFuture;
  if (dist === 21097.5) return halfMarathonHandoffFuture;
  return null;
}
