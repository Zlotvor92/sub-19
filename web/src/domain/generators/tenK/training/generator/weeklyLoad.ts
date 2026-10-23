/* Weekly fast-work envelope. Session doses are chosen per day; this counts the whole
   week, including the cost of a demanding long run, so a stronger experienced dose does
   not silently stack on top of it. 10K has no long-run fast finish, no M-pace work and no
   distance-specific share, so only the shared default envelope applies.

   INTERNAL HEURISTICS (not published thresholds):
   - Envelope = share of the week's running time at T-or-faster. 13 % for experienced
     runners keeps a 50 km week near ~35 min, the order of magnitude of B.A.A. 5K/10K
     advanced weeks (two sessions of ~15–20 min at 5K/10K pace). It applies only to the
     experienced policy, which is the only one with a larger dose and LR fast finishes;
     beginner/returning/developing sessions keep their unchanged per-session time caps
     (≤ 12–16 min of fast work each), so this envelope adds no new cut for them.
   - A long run of 90+ min is a demanding day: the envelope for the rest of the week
     shrinks by 10 %. 90 min is the HM fuelling threshold already used by this app. */

import { sessQKm } from '../sessions/calc';
import type { QualityReadiness, SessionDay } from '../types';

export const WEEKLY_FAST_SHARE: Readonly<Partial<Record<QualityReadiness, number>>> = {
  experienced: 0.13
};
export const DEMANDING_LONG_RUN_MIN = 90;
const DEMANDING_LONG_RUN_FACTOR = 0.9;

/** Fast seconds of one quality day (10K quality never uses M pace). */
export function sessionLoadSec(day: SessionDay): number {
  const s = day.session;
  return sessQKm(s) * s.paceSec;
}

export interface WeeklyEnvelopeInput {
  readiness: QualityReadiness;
  volKm: number;
  /** Representative easy pace [s/km]; converts weekly km to running time. */
  easyPaceSec: number;
  longRunKm: number;
  longRunPaceSec: number;
}

/** Infinity where the readiness level has no weekly envelope. */
export function weeklyFastEnvelopeSec(x: WeeklyEnvelopeInput): number {
  const share = WEEKLY_FAST_SHARE[x.readiness];
  if (share == null) return Infinity;
  const demanding = (x.longRunKm * x.longRunPaceSec) / 60 >= DEMANDING_LONG_RUN_MIN;
  return x.volKm * x.easyPaceSec * share * (demanding ? DEMANDING_LONG_RUN_FACTOR : 1);
}
