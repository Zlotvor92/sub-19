import { useMemo, useState } from 'react';
import { Section } from '../../components/ui/primitives';
import { fmtClock, fmtDayMonthYear } from '../../domain/format';
import {
  productFor,
  type DecisionPoint,
  type PreparationDecision,
  type PreparationOption
} from '../../domain/generators/select';
import { useTrainingStore } from '../../stores';
import {
  previewPreparationChoice,
  storedPreparationDecision,
  type PlanChangePreview
} from '../../stores/executionActions';
import { useGeneratorFlags } from '../../stores/generatorFlags';

/* FAZA 3 (3g) — PREDAJA „KRAĆA DISTANCA" ZA IZVOR v2 (HM v2, maraton v2) u prilagođavanju plana. Ponudu, opcije, razloge
   nedostupnosti i plan cilja daje domen (`storedPreparationDecision` → izvor v2 → cilj po prekidaču korisnika); ovde se
   samo prikazuju (pouka 20: nijedno pravilo u UI). Odluka postoji dok je sačuvani plan ograničena priprema (O1
   dopuna): prikazuje se pri svakom otvaranju i posle svake nove verzije plana, a „Zatvori" je sklanja do tada. „Zadrži
   plan v2" je samo zatvaranje — plan se ne menja. */

const kmText = (km: number): string => km.toFixed(1).replace('.', ',');
/** Vrh koji cilj ne prijavljuje (0) nije vrednost plana — prikazuje se crta. */
const peakText = (km: number): string => (km > 0 ? `${kmText(km)} km` : '—');
export const COVERAGE: Record<PreparationOption['coverage'], string> = {
  full: 'ispunjava pravila pune pripreme',
  distance: 'dužina pokrivena, vremenski cilj nije podržan',
  insufficient: 'nije puna priprema'
};
export const DECISION_ID = 'plan-decision';

/** Prikaz tačke odluke (datum · distanca · cilj); ime distance daje generator te distance. Samo formatiranje. */
const describePoint = (p: DecisionPoint): string =>
  `${fmtDayMonthYear(p.raceDate)} · ${productFor(p.raceDistM)?.name ?? `${p.raceDistM / 1000} km`} · ${p.goalSec ? `cilj ${fmtClock(p.goalSec)}` : 'bez vremenskog cilja'}`;

/** Promena trke u pregledu izabrane opcije (pre → posle). */
export function RaceChange({ change }: { change: { from: DecisionPoint; to: DecisionPoint } }) {
  return (
    <dl className="note-src" aria-label="Promena trke i cilja">
      <dt>Pre</dt>
      <dd>{describePoint(change.from)}</dd>
      <dt>Posle</dt>
      <dd>{describePoint(change.to)}</dd>
    </dl>
  );
}

/** Odluka o pripremi sačuvanog plana (prati plan, dan i prekidače korisnika). */
export function useStoredDecision(today: string): PreparationDecision | null {
  const genPlan = useTrainingStore((s) => s.genPlan);
  const flags = useGeneratorFlags();
  return useMemo(
    // Cilj predaje bira prekidač korisnika (isti izvor kao za nov plan), pa promena prekidača menja opcije.
    () => (genPlan ? storedPreparationDecision(today, flags) : null),
    [genPlan, today, flags]
  );
}

/** Poruka pregleda prilagođavanja kad domen javi ponudu (`shorterOffer`) i veza ka odluci o pripremi. */
export function ShorterOfferNote({
  distance,
  hasDecision
}: {
  distance: string;
  hasDecision: boolean;
}) {
  return (
    <div className="alt-block" id="v2-shorter-offer" role="note">
      <p className="prop-m">
        Posle ovog prilagođavanja plan nije puna priprema za {distance}: može se izabrati kraća
        distanca istog datuma ili zadržati plan.
      </p>
      {hasDecision ? (
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => document.getElementById(DECISION_ID)?.scrollIntoView()}
        >
          Odluka o pripremi
        </button>
      ) : (
        <p className="note-src">
          Odluka o pripremi se prikazuje ovde kada primeniš prikazanu promenu.
        </p>
      )}
    </div>
  );
}

/** Odluka o pripremi: izjava, opcija kraće distance (pregled pa potvrda), nedostupne opcije sa razlogom domena
 *  doslovno i „Zatvori" (= zadrži plan). */
export function ShorterDistanceDecision({
  decision,
  today,
  onPreview
}: {
  decision: PreparationDecision;
  today: string;
  onPreview: (result: PlanChangePreview) => void;
}) {
  const genPlan = useTrainingStore((s) => s.genPlan);
  const [closedFor, setClosedFor] = useState<unknown>(null);
  if (closedFor === genPlan) return null;
  return (
    <Section title="Odluka o pripremi" id={DECISION_ID}>
      <p className="prop-m">{decision.statement}</p>
      {decision.options.map((option) => (
        <div className="alt-block" key={option.id}>
          <p>
            <b>{option.title}</b>
          </p>
          <p className="note-src">{option.detail}</p>
          <p className="note-src">
            {fmtDayMonthYear(option.raceDate)} · najduže {peakText(option.peakLongRunKm)} · vrhunac{' '}
            {peakText(option.peakWeeklyKm)}/ned · {COVERAGE[option.coverage]}
          </p>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => onPreview(previewPreparationChoice(null, today, null, option.choice))}
            aria-label={`Pregledaj opciju: ${option.title}`}
          >
            Pregledaj opciju
          </button>
        </div>
      ))}
      {decision.unavailable.length ? (
        <ul aria-label="Nedostupne opcije">
          {decision.unavailable.map((reason) => (
            <li className="note-src" key={reason}>
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
      {decision.conditions.map((condition) => (
        <p className="note-src" key={condition}>
          {condition}
        </p>
      ))}
      <p className="note-src">
        Opcija je samo pregled: distanca se menja tek kada primeniš prikazanu promenu; prethodni
        plan ostaje u istoriji.
      </p>
      <div className="btnrow start">
        <button type="button" className="btn ghost" onClick={() => setClosedFor(genPlan)}>
          Zatvori
        </button>
      </div>
    </Section>
  );
}
