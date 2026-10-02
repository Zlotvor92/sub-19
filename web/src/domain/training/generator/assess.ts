import { r1 } from '../../format';
import { RAMP_CAP_WEEKS, VDOT_RAMP_PER_WEEK } from '../constants/heuristics';
import type { Assessment, Intensity, PersonalBest } from '../types';
import { vdotFromRace } from '../vdot/calculateVDOT';
import { raceTimeForVdot } from '../vdot/racePrediction';

/**
 * Procena: polazni VDOT iz PB-a, projektovani VDOT na dan trke
 * (`vdot0 + rampa × min(nedelje−2, 20)`), predviđeno vreme i — ako je cilj
 * zadat — da li je realan (tolerancija zaokruživanja 0,3 VDOT).
 */
export function assess(
  pb: PersonalBest,
  weeks: number,
  intensity: Intensity,
  goalSec: number | null,
  raceDistM: number
): Assessment {
  const dist = raceDistM || 5000;
  const vdot0 = vdotFromRace(pb.distM, pb.sec);
  const rampW = Math.min(Math.max(weeks - 2, 1), RAMP_CAP_WEEKS);
  const vdotGoal = vdot0 + VDOT_RAMP_PER_WEEK[intensity] * rampW;
  const predictedSec = raceTimeForVdot(vdotGoal, dist);
  const out: Assessment = {
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
