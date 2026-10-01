export type { ActivityStreams, Lap, PerKmRow, StreamSeries, WorkSegment } from './types';
export { detectWorkSegments, extractRuns, kmeans1d } from './segments';
export {
  LAPS_VERSION,
  PERKM_VERSION,
  decouplingPerKm,
  perKmDetail,
  type Decoupling
} from './perkm';
export {
  JOG_LAP_PACE_RATIO,
  LAP_DISTANCE_TOLERANCE,
  WORK_LAP_PACE_RATIO,
  allWorkLapsPace,
  blockPace,
  keepWorkItems,
  predictRange,
  riegelTo5kFromPace,
  icuRoundsToLaps,
  icuWorkPace,
  selectIcuWorkLaps,
  selectWorkLaps,
  workLapsPace,
  type IcuRound,
  type PredictRange,
  type WorkLap
} from './laps';
export { extractPaceFromDesc, mergeDay, type MergedDay, type RawActivity } from './merge';
export {
  REALIGN_DAY_WINDOW,
  REALIGN_KM_TOLERANCE,
  realignPlan,
  type RealignInput,
  type RealignResult
} from './realign';
