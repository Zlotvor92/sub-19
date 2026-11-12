/* V4 — FORMA: opterećenje trčanja i baza (SPEC § 5.1, § 5.3), za R12 (pridržavanje) i R13 (pad baze).
   ISTA formula kao `engine/load.ts` (`runLoad`, `rollDay`); `fitness/` sme da uvozi samo types/vdot/constants iz
   motora (§ 14.4), pa je ovde prepisana. Predlog (F4-REPORT, krug 2): motor da preda dnevna opterećenja u `facts`. */
import { CHRONIC_DAYS, PLANNED_LOAD_MIN_SHARE, WALK_WEIGHT } from '../engine/constants';
import type { LoadPoints, SecPerKm } from '../engine/types';
import { weightAtPace } from '../engine/vdot';
import type { FitnessRun } from './types';

/** Minuti × težina; krugovi → planirana prosečna težina (odrađeno ≥ 90 %) → po km → lagano. */
export function runLoad(run: FitnessRun, thresholdPace: SecPerKm): LoadPoints {
  const minutes = run.durationSec / 60;
  if (run.laps !== undefined && run.laps.length > 0) {
    let load = 0;
    for (const lap of run.laps) {
      if (lap.durationSec <= 0) continue;
      const weight =
        lap.distanceM > 0
          ? weightAtPace((lap.durationSec / lap.distanceM) * 1000, thresholdPace)
          : WALK_WEIGHT;
      load += (lap.durationSec / 60) * weight;
    }
    return load;
  }
  const p = run.planned;
  if (
    p?.load !== undefined &&
    p.durationSec !== undefined &&
    p.durationSec > 0 &&
    run.durationSec >= PLANNED_LOAD_MIN_SHARE * p.durationSec
  ) {
    return minutes * (p.load / (p.durationSec / 60));
  }
  if (run.splits !== undefined && run.splits.length > 0) {
    let weighted = 0;
    let seconds = 0;
    for (const split of run.splits) {
      weighted += split.paceSec * weightAtPace(split.paceSec, thresholdPace);
      seconds += split.paceSec;
    }
    return seconds > 0 ? minutes * (weighted / seconds) : minutes;
  }
  return minutes * weightAtPace((run.durationSec / run.distanceM) * 1000, thresholdPace);
}

/** Jedan dan baze (eksponencijalna sredina, 42 dana). */
export function rollChronic(prev: number, dayLoad: LoadPoints): number {
  return prev + (dayLoad - prev) / CHRONIC_DAYS;
}
