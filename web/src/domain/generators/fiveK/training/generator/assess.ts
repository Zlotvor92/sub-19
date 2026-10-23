import { r1 } from '../../format';
import type { Assessment, Intensity, PersonalBest } from '../types';
import { vdotFromRace } from '../vdot/calculateVDOT';
import { raceTimeForVdot } from '../vdot/racePrediction';

/**
 * Reference equivalent at current confirmed fitness, not a race-day promise.
 * Legacy argument/field names remain for stored plans and callers. Neither weeks
 * nor an intensity preference supplies evidence of an improvement in fitness.
 */
export function assess(
  pb: PersonalBest,
  _weeks: number,
  _intensity: Intensity,
  goalSec: number | null,
  raceDistM: number
): Assessment {
  const dist = raceDistM || 5000;
  const vdot0 = vdotFromRace(pb.distM, pb.sec);
  const vdotGoal = vdot0;
  const predictedSec = raceTimeForVdot(vdotGoal, dist);
  const out: Assessment = {
    assessmentBasis: 'current-fitness',
    vdot0: r1(vdot0),
    vdotGoal: r1(vdotGoal),
    predictedSec,
    realno: null,
    goalVdot: null
  };
  if (goalSec) {
    const gv = vdotFromRace(dist, goalSec);
    out.goalVdot = r1(gv);
    out.realno = gv <= vdotGoal + 0.3;
  }
  return out;
}
