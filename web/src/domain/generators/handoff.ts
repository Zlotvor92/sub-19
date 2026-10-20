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
import { addDays, diffDays, mondayOnOrBefore, type IsoDate } from '../date';
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

type Weeks = GenPlanState['weeks'];

/** Dopuna 3b (DESIGN.md § 8, sudar 3c): v1 cilj kalemi plan po POČETKU nedelje, a v1 nedelje počinju ponedeljkom. Plan
 *  v2 ima nedelje od dana posle dana trke (trka u subotu → od nedelje). Pogled zato pregrupiše dane izvora u nedelje od
 *  ponedeljka: id dana i sadržaj dana ostaju (dnevnik, izmene i pomeranja ostaju vezani), menjaju se samo `dow` i
 *  nedelja. Broj nedelje = broj nedelje izvora koja sadrži taj ponedeljak (pre prve: prva − 1); ostala polja nedelje
 *  (faza, rasterećenje) iz iste nedelje izvora. Nedelje koje već počinju ponedeljkom se ne diraju (isti objekat). */
export function mondayWeeks(weeks: Weeks): Weeks {
  const iso = (d: string): IsoDate => d as IsoDate;
  if (weeks.every((w) => mondayOnOrBefore(iso(w.start)) === w.start)) return weeks;
  const holder = (monday: IsoDate) =>
    weeks.find((w) => {
      const k = diffDays(iso(w.start), monday);
      return k >= 0 && k < 7;
    });
  const byMonday = new Map<IsoDate, Weeks[number]['days'][number][]>();
  for (const w of weeks)
    for (const d of w.days) {
      const date = addDays(iso(w.start), d.dow);
      const monday = mondayOnOrBefore(date);
      const days = byMonday.get(monday) ?? [];
      days.push({ ...d, dow: diffDays(monday, date) });
      byMonday.set(monday, days);
    }
  return [...byMonday.keys()].sort().map((monday) => {
    const own = holder(monday);
    const src = own ?? weeks[0]!;
    return {
      ...src,
      w: own ? src.w : src.w - 1,
      start: monday,
      days: byMonday.get(monday)!.sort((a, b) => a.dow - b.dow)
    };
  });
}

/** Pogled plana izvora za v1 cilj: bez objekta plana v2 i bez meta ključeva v2; nedelje od ponedeljka
 *  (`mondayWeeks`). Dani ostaju (istorija). */
export function sourceViewForV1<P extends GenPlanState>(current: P, format: SourceFormat): P {
  const { [format.planKey]: _plan, ...rest } = current as P & Record<string, unknown>;
  const meta = current.meta
    ? (Object.fromEntries(
        Object.entries(current.meta).filter(([k]) => !format.metaKeys.includes(k))
      ) as P['meta'])
    : current.meta;
  return { ...rest, weeks: mondayWeeks(current.weeks), meta } as P;
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
