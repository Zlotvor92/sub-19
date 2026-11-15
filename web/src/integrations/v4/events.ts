/* F9 · SLOJ APLIKACIJA ↔ V4: DOGAĐAJI I ODOBRAVANJE (F8 § 9.1, INTEGRACIJA.md § 2c).
   - IZVEDENO iz trčanja i plana (`deriveEvents`: rezultat, propušten trening, rupa u trčanju, opterećenje, forma) i
     ručna izmena/premeštanje (§ 9.5) → primenjuje se SAMO („sam"), razlog je u `changes`.
   - PRIJAVLJENO (bol, umor, bolest/put, promena cilja ili dana) → „pregled": `preview` pokaže promene, pa
     „Primeni" (`accept`) ili „Ne menjaj" (`reject`).
   Dvostruka primena istog događaja nema efekta: motor pamti primenjene u `header.appliedEvents`; odbijene pamti sloj.
   Prijavljena pauza ulazi u `toFacts({ pauses })` tek POSLE prihvatanja (inače bi je `deriveEvents` primenio sam). */
import {
  deriveEvents,
  replan,
  type Availability,
  type DistanceData,
  type EventId,
  type Goal,
  type IsoDate,
  type Pause,
  type PlanDoc,
  type PlanEvent,
  type ReplanResult,
  type RunnerState
} from '../../domain/v4/engine';

export type Approval = 'sam' | 'pregled';
export type EventOrigin = 'izvedeno' | 'prijavljeno';

export function approvalOf(e: PlanEvent, origin: EventOrigin): Approval {
  if (origin === 'izvedeno') return 'sam';
  return e.kind === 'manual-edit' || e.kind === 'none' ? 'sam' : 'pregled';
}

/** Ono što korisnik prijavi („Nešto se desilo?", podešavanja). */
export type Report =
  | { kind: 'pain'; level: number; part?: string }
  | { kind: 'fatigue' }
  | { kind: 'pause'; from: IsoDate; to: IsoDate; reason: Pause['reason'] }
  | { kind: 'goal-change'; goal: Goal }
  | { kind: 'availability-change'; availability: Availability };

/** Prijava → događaj sa determinističkim id-jem (`<vrsta>:<datum>[:…]`); ista prijava istog dana = isti id. */
export function reportedEvent(r: Report, today: IsoDate): PlanEvent {
  switch (r.kind) {
    case 'pain':
      return {
        id: `pain:${today}:${r.part ?? ''}:${r.level}`,
        date: today,
        kind: 'pain',
        level: r.level,
        ...(r.part !== undefined ? { part: r.part } : {})
      };
    case 'fatigue':
      return { id: `fatigue:${today}:trkac`, date: today, kind: 'fatigue', source: 'trkac' };
    case 'pause':
      /* Isti id kao pauza koju `deriveEvents` daje iz `state.pauses`: posle prihvatanja se ne primenjuje dvaput. */
      return {
        id: `pause:${r.from}:${r.to}`,
        date: r.to,
        kind: 'pause',
        from: r.from,
        to: r.to,
        reason: r.reason
      };
    case 'goal-change':
      return {
        id: `goal-change:${today}:${r.goal.distanceId}:${r.goal.raceDate}:${r.goal.targetTimeSec ?? ''}`,
        date: today,
        kind: 'goal-change',
        goal: r.goal
      };
    case 'availability-change':
      return {
        id: `availability-change:${today}:${[...r.availability.runDays].sort().join('')}:${r.availability.longDay}`,
        date: today,
        kind: 'availability-change',
        availability: r.availability
      };
  }
}

/** Odluke korisnika o prijavljenim događajima koje motor ne pamti („Ne menjaj"). */
export interface Ledger {
  rejected: readonly EventId[];
}
export const EMPTY_LEDGER: Ledger = { rejected: [] };

export const reject = (ledger: Ledger, e: PlanEvent): Ledger =>
  ledger.rejected.includes(e.id) ? ledger : { rejected: [...ledger.rejected, e.id].sort() };

const open = (doc: PlanDoc, ledger: Ledger, e: PlanEvent): boolean =>
  !doc.header.appliedEvents.includes(e.id) && !ledger.rejected.includes(e.id);

/** Prijavljeni događaji koji još čekaju odluku (nisu ni primenjeni ni odbijeni). */
export const awaiting = (
  doc: PlanDoc,
  ledger: Ledger,
  reported: readonly PlanEvent[]
): PlanEvent[] =>
  reported.filter((e) => approvalOf(e, 'prijavljeno') === 'pregled' && open(doc, ledger, e));

/**
 * Automatski korak (bez pitanja): izvedeni događaji + ručne izmene, osim odbijenih. Isti ulaz daje isti izlaz;
 * ponovni poziv nad izlazom nema promena (motor preskače primenjene).
 */
export function autoStep(
  doc: PlanDoc,
  state: RunnerState,
  data: DistanceData,
  manual: readonly PlanEvent[],
  ledger: Ledger
): ReplanResult {
  const auto = [...deriveEvents(doc, state), ...manual].filter(
    (e) =>
      approvalOf(e, manual.includes(e) ? 'prijavljeno' : 'izvedeno') === 'sam' &&
      open(doc, ledger, e)
  );
  return auto.length === 0 ? { doc, changes: [] } : replan(doc, state, auto, data);
}

/** Pregled prijavljenog događaja: šta bi se promenilo. Ništa se ne čuva. */
export const preview = (
  doc: PlanDoc,
  state: RunnerState,
  data: DistanceData,
  e: PlanEvent
): ReplanResult => replan(doc, state, [e], data);

/** „Primeni": isti račun kao pregled; pozivalac čuva vraćen dokument. Odbijen događaj se ne primenjuje. */
export const accept = (
  doc: PlanDoc,
  state: RunnerState,
  data: DistanceData,
  ledger: Ledger,
  e: PlanEvent
): ReplanResult => (open(doc, ledger, e) ? replan(doc, state, [e], data) : { doc, changes: [] });
