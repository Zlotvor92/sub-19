/* V4 — tempo koji plan savetuje za trku (R22 B2): JEDAN izvor za napomenu dana trke i za tempo trke u treninzima.
   Sporiji cilj je tempo za trku; uz upozorenje „počni sporije" ili kaznu prognoze tempo je sredina očekivanog
   vremena i sporije granice raspona, nikad brži od potvrđene forme (R20 B4, R20 I). Plan „po osećaju" nema tempa. */
import type { Meters, PlanHeader, Seconds, SecPerKm } from './types';

/** R20 B4: oprezan tempo za trku tek kad je bar 1 % sporiji od potvrđene forme. */
const CAUTIOUS_MIN_OVER = 1.01;

export interface RaceAdvice {
  /** Vreme na cilju po kom je tempo za trku. */
  timeSec: Seconds;
  /** Tempo za trku (s/km, nezaokružen). */
  pace: SecPerKm;
  /** cilj = sporiji cilj; oprezno = sporija polovina raspona; forma = današnja potvrđena forma. */
  basis: 'cilj' | 'oprezno' | 'forma' | 'nov-cilj';
}

export function raceAdvice(
  h: PlanHeader,
  raceDay: { lowSec: Seconds; expectedSec: Seconds; highSec: Seconds },
  distanceM: Meters
): RaceAdvice {
  /* A18 (krug 9): jedan izvor — današnja prognoza iz zaglavlja */
  const confirmedSec = h.form.current.raceTimeSec;
  const target = h.goal.targetTimeSec;
  const slowerAdvice =
    !h.paces.byFeel &&
    (h.warnings.some((w) => w.proposal.includes('počni sporije')) ||
      (h.decisions.raceDayPenalty ?? 0) > 0);
  const midSec = Math.round((raceDay.expectedSec + raceDay.highSec) / 2);
  const cautiousSec =
    slowerAdvice && midSec > CAUTIOUS_MIN_OVER * confirmedSec ? midSec : confirmedSec;
  /* R22 (B2): cilj brži od polazne forme koji je forma posle rezultata prestigla nije više tempo za trku — plan nudi
     nov cilj iz današnje forme (5 km s01: parkrun 21:10 uz cilj 21:44) */
  const passed =
    target !== undefined && target < h.form.start.raceTimeSec && target >= cautiousSec;
  const fromGoal = target !== undefined && target >= cautiousSec && !passed;
  const timeSec = fromGoal ? target : cautiousSec;
  /* razlika do 1 % nije nov broj — ostaje potvrđena forma */
  const cautious = !fromGoal && timeSec > confirmedSec;
  const basis = fromGoal ? 'cilj' : cautious ? 'oprezno' : passed ? 'nov-cilj' : 'forma';
  const base = h.paces.rpBase ?? h.paces.RP;
  const pace =
    fromGoal || cautious || h.paces.byFeel ? (timeSec / distanceM) * 1000 : base;
  return { timeSec, pace, basis };
}

/** R22 (B2): tempo trke u treninzima = tempo koji plan savetuje za trku, kad je sporiji od tempa iz forme (ceo
    sekund, kao tempa zona). `null` = tempo iz forme ostaje. */
export function trainingRacePace(
  h: PlanHeader,
  raceDay: { lowSec: Seconds; expectedSec: Seconds; highSec: Seconds },
  distanceM: Meters
): SecPerKm | null {
  if (h.paces.byFeel) return null;
  const adv = raceAdvice(h, raceDay, distanceM);
  if (adv.basis !== 'cilj' && adv.basis !== 'oprezno') return null;
  const pace = Math.round(adv.pace);
  return pace > (h.paces.rpBase ?? h.paces.RP) ? pace : null;
}

/** R22 (B2): tempa zaglavlja sa tempom trke koji plan savetuje (ili tempom iz forme kad saveta nema). */
export function withTrainingRacePace(
  h: PlanHeader,
  raceDay: { lowSec: Seconds; expectedSec: Seconds; highSec: Seconds },
  distanceM: Meters
): PlanHeader['paces'] {
  const { rpBase, ...rest } = h.paces;
  const base = rpBase ?? h.paces.RP;
  const rp = trainingRacePace(h, raceDay, distanceM);
  return rp === null ? { ...rest, RP: base } : { ...rest, RP: rp, rpBase: base };
}
