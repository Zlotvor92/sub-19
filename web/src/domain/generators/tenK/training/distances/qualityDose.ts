/* Conservative starting doses are product heuristics, not a fitness forecast.
 * Volume supplies a ceiling; readiness and accumulated quality weeks determine
 * how much of that ceiling is used. Prescribed fitness paces never change here.
 *
 * Experienced runners (confirmed quality experience + ≥8 consistent weeks) use a
 * separate policy: for repetition sessions the distance profile's nominal zone budget
 * (never above the Daniels per-session limits I ≤ 8 % of the week, T ≤ 10 %, R ≤ 5 %)
 * is the reference dose, approached from 85–90 % over the first quality weeks, with
 * nearest-repetition rounding inside that ceiling. Beginner,
 * returning and developing runners keep the conservative policy below unchanged.
 * Calibration anchors: V.O2 (Daniels) “up to 8 % of weekly mileage” per I session,
 * 1–5 min bouts (30 mpw → 5×800 m); B.A.A. 5K/10K advanced levels open with roughly
 * 15–20 min of 5K/10K-pace work per session. Exact percentages below are internal
 * heuristics calibrated to those anchors, not published thresholds. */

import { r1 } from '../../format';
import { sessFartlek, wuCdForVolume } from '../sessions/build';
import { sessDesc, sessKm, sessQKm } from '../sessions/calc';
import { proportionalRest } from '../sessions/intervals';
import { zoneBudgetKm } from '../sessions/constraints';
import { resolvePrescription, validIntervalLeg } from '../sessions/prescription';
import type { Intensity, Session, SessionDay } from '../types';
import type { QualityRequest, ZoneBudgets } from './types';

const ENTRY_WEEKS = { beginner: 2, returning: 3, developing: 2, experienced: 0 } as const;
const DOSE_FACTOR: Readonly<Record<Intensity, number>> = { kons: 0.75, std: 0.9, agr: 1 };
const QUALITY_BUILD_WEEKS = 6;
const MINIMUM_MEANINGFUL_WORK_KM = 0.4;
const INITIAL_DOSE = {
  beginner: 0.6,
  returning: 0.55,
  developing: 0.65,
  experienced: 0.8
} as const;
/* Experienced policy (internal heuristic). Start share of the zone ceiling depends on
 * continuity (8–15 weeks 85 %, 16+ weeks 90 %) and reaches 100 % after six quality
 * weeks; std is the reference dose, kons keeps a deliberate 20 % reduction, agr skips
 * the ramp but cannot exceed the ceiling. Per-session time cap grows 15 → 22 min
 * (T × 1.25). */
const EXPERIENCED = {
  initial: (consistentWeeks: number | null | undefined): number =>
    (consistentWeeks ?? 0) >= 16 ? 0.9 : 0.85,
  intensity: { kons: 0.8, std: 1, agr: 1 } as Readonly<Record<Intensity, number>>,
  seconds: { start: 15 * 60, end: 22 * 60 },
  /** Longest threshold cruise repetition the re-fit may choose [m]. */
  maxThresholdRepM: 1600
} as const;
const FAST_WORK_SECONDS = {
  beginner: { start: 6 * 60, end: 12 * 60 },
  returning: { start: 6 * 60, end: 14 * 60 },
  developing: { start: 8 * 60, end: 16 * 60 },
  experienced: { start: 12 * 60, end: 20 * 60 }
} as const;

/** Short, controlled threshold efforts introduce quality without prescribing R pace. */
export function introductoryQuality(req: QualityRequest): SessionDay | null {
  if (!req.readiness || req.isTaper1 || req.qualW > ENTRY_WEEKS[req.readiness]) return null;
  const [wu, cd] = wuCdForVolume(req.vol);
  const repSec = req.qualW === 1 ? 30 : req.qualW === 2 ? 45 : 60;
  const reps = Math.max(6, Math.ceil((MINIMUM_MEANINGFUL_WORK_KM * req.pT) / repSec));
  const day = sessFartlek(req.dow, wu, reps, repSec, 90, req.pT, cd, req.pE);
  day.session.purpose = 'T';
  resolvePrescription(day.session);
  day.session.paceSource = 'current-fitness';
  day.session.notes = 'Uvod u kvalitet: kontrolisane deonice, bez sprinta, uz lagan oporavak.';
  day.desc = sessDesc(day.session);
  return day;
}

/** Apply once after choosing the session. Dose factors are preferences; a viable
 * pair of efforts / 0.4 km introduction wins over fractional rounding. The final
 * constrainSession/constrainWeek guard still enforces the actual weekly zone
 * budget. Warm-up, cool-down and prescribed fitness pace are never reduced. */
export function applyQualityDose(day: SessionDay, req: QualityRequest): SessionDay {
  const purpose = resolvePrescription(day.session);
  if (purpose === 'activation' || (!req.readiness && !req.qualityIntensity)) return day;
  const readiness = req.readiness ?? 'experienced';
  const intensity = req.qualityIntensity ?? 'std';
  const progress = Math.min(1, Math.max(0, (req.qualW - 1) / QUALITY_BUILD_WEEKS));
  // Both taper weeks keep the established (legacy) dose for every runner.
  if (req.readiness === 'experienced' && !req.isTaper1)
    return experiencedDose(day, req, intensity, progress);
  const initial = INITIAL_DOSE[readiness];
  // Taper is already shortened by the distance profile; never grow it again.
  const factor = DOSE_FACTOR[intensity] * (req.isTaper1 ? 1 : initial + (1 - initial) * progress);
  const s = day.session;
  const zone = s.zone;
  const timePolicy = FAST_WORK_SECONDS[readiness];
  const timeCap = Math.min(
    (timePolicy.start + (timePolicy.end - timePolicy.start) * progress) *
      DOSE_FACTOR[intensity] *
      (zone === 'T' ? 1.25 : 1),
    req.maxWorkSec ?? Infinity
  );
  const originalWork = sessQKm(s);
  const capKm = Math.min(
    originalWork,
    Math.max(MINIMUM_MEANINGFUL_WORK_KM, originalWork * factor),
    timeCap / s.paceSec
  );
  if (s.type === 'int') {
    const minRepM = zone === 'I' ? Math.ceil(60000 / s.paceSec / 100) * 100 : 100;
    if (2 * s.repM > capKm * 1000) {
      s.repM = Math.min(s.repM, Math.max(minRepM, Math.floor((capKm * 1000) / 2 / 100) * 100));
    }
    s.reps = Math.min(s.reps, Math.max(2, Math.floor((capKm * 1000 + 1e-8) / s.repM)));
    if (zone === 'I') s.restSec = proportionalRest(s.repM, s.paceSec);
    if (zone === 'R') s.restSec = Math.round((s.repM / 1000) * s.paceSec * 2.5);
  } else if (s.type === 'fartlek') {
    const minimumReps = Math.max(2, Math.ceil((MINIMUM_MEANINGFUL_WORK_KM * s.paceSec) / s.repSec));
    const minWorkKm = (minimumReps * s.repSec) / s.paceSec;
    const zoneBudget = req.vol * (zone === 'T' ? 0.1 : 0.08);
    const meaningfulFloorFits = minWorkKm <= zoneBudget && minWorkKm * s.paceSec <= timeCap;
    s.reps = Math.min(
      s.reps,
      Math.max(
        meaningfulFloorFits ? minimumReps : 2,
        Math.floor((capKm * s.paceSec) / s.repSec + 1e-8)
      )
    );
  } else if (s.type === 'pyramid') {
    const scale = Math.min(1, capKm / originalWork);
    s.reps = s.reps.map((m) => Math.max(100, Math.floor((m * scale) / 100) * 100));
    if (zone === 'I') s.reps = s.reps.filter((m) => validIntervalLeg(m, s.paceSec));
  } else if (s.type === 'tempo') {
    s.qKm = Math.floor((capKm + 1e-9) * 10) / 10;
  } else {
    s.qKm = Math.floor((capKm * 3 + 1e-9) * 10) / 10;
  }
  return finishDose(day, originalWork);
}

function finishDose(day: SessionDay, originalWork: number): SessionDay {
  const s = day.session;
  if (sessQKm(s) < originalWork - 0.05) {
    const note = 'Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju.';
    s.notes = [s.notes, note].filter(Boolean).join(' · ');
  }
  day.km = r1(sessKm(s));
  day.desc = sessDesc(s);
  return day;
}

function nominalZoneKm(zone: Session['zone'], vol: number, b: ZoneBudgets): number {
  if (zone === 'I') return Math.min(vol * b.intervalBudget.pct, b.intervalBudget.maxKm ?? Infinity);
  if (zone === 'R')
    return Math.min(vol * b.repetitionBudget.pct, b.repetitionBudget.maxKm ?? Infinity);
  return vol * b.tempoBudget.pct;
}

/** Whole count of `unitKm` nearest to the target: at least `min`, never above `hardKm`. */
const nearestCount = (targetKm: number, unitKm: number, hardKm: number, min = 2): number =>
  Math.min(Math.max(min, Math.round(targetKm / unitKm)), Math.floor(hardKm / unitKm + 1e-8));

/**
 * Experienced runners: for T/I/R repetitions the profile's nominal zone budget (capped
 * by the Daniels limit, times the shared-day fraction) is the reference; the dose
 * approaches it with progression, rounds to the nearest whole repetition and never
 * exceeds that ceiling, the per-session time cap or the weekly allowance. Race-specific RP/M work keeps the builder's amount as its reference, so
 * only its rounding is recovered. Not used in taper weeks.
 */
function experiencedDose(
  day: SessionDay,
  req: QualityRequest,
  intensity: Intensity,
  progress: number
): SessionDay {
  const s = day.session;
  const zone = s.zone;
  const originalWork = sessQKm(s);
  // agr skips the entry ramp; no choice can exceed the zone ceiling.
  const initial = intensity === 'agr' ? 1 : EXPERIENCED.initial(req.consistentWeeks);
  const factor = EXPERIENCED.intensity[intensity] * (initial + (1 - initial) * progress);
  const timeCapSec = Math.min(
    (EXPERIENCED.seconds.start + (EXPERIENCED.seconds.end - EXPERIENCED.seconds.start) * progress) *
      (zone === 'T' ? 1.25 : 1),
    req.maxWorkSec ?? Infinity
  );
  // Repetition sessions in general zones recover what fixed formats and floor rounding
  // left unused, up to the profile's own nominal zone budget (never above the Daniels
  // ceiling). Continuous, fartlek, pyramid and race-specific work keep the builder's
  // amount as reference, so only their rounding is recovered.
  const general = s.type === 'int' && (zone === 'T' || zone === 'I' || zone === 'R');
  const nominal = req.budgets && general ? nominalZoneKm(zone, req.vol, req.budgets) : Infinity;
  const ceiling = Math.min(zoneBudgetKm(s, req.vol), nominal) * (req.workShare ?? 1);
  const reference = general ? ceiling : originalWork;
  const hardKm = Math.min(reference, timeCapSec / s.paceSec);
  const targetKm = Math.min(hardKm, reference * factor);
  fitSession(s, targetKm, hardKm);
  return finishDose(day, originalWork);
}

function fitSession(s: Session, targetKm: number, hardKm: number): void {
  const zone = s.zone;
  if (s.type === 'int') {
    const minRepM =
      zone === 'I' ? Math.ceil(60000 / s.paceSec / 100) * 100 : zone === 'T' ? 1000 : 100;
    const maxRepM =
      zone === 'T'
        ? Math.max(s.repM, EXPERIENCED.maxThresholdRepM)
        : zone === 'I'
          ? Math.min(s.repM, Math.floor(300000 / s.paceSec / 100) * 100)
          : s.repM;
    let best: { reps: number; repM: number; miss: number } | null = null;
    for (let repM = Math.min(s.repM, maxRepM); repM <= maxRepM; repM += 100) {
      const reps = nearestCount(targetKm, repM / 1000, hardKm);
      if (reps < 2) continue;
      const miss = Math.abs((reps * repM) / 1000 - targetKm);
      // Ties keep the builder's repetition length.
      if (!best || miss < best.miss - 1e-9) best = { reps, repM, miss };
    }
    if (best) {
      s.reps = best.reps;
      s.repM = best.repM;
    } else {
      // Not even two repetitions fit: shorten them, keeping I at one minute or more.
      s.repM = Math.min(s.repM, Math.max(minRepM, Math.floor((hardKm * 1000) / 2 / 100) * 100));
      s.reps = Math.max(2, Math.floor((hardKm * 1000 + 1e-8) / s.repM));
    }
    if (zone === 'I') s.restSec = proportionalRest(s.repM, s.paceSec);
    if (zone === 'R') s.restSec = Math.round((s.repM / 1000) * s.paceSec * 2.5);
  } else if (s.type === 'fartlek') {
    s.reps = nearestCount(targetKm, s.repSec / s.paceSec, hardKm);
  } else if (s.type === 'pyramid') {
    // Pyramids keep their shape; they are only ever shortened.
    const originalWork = sessQKm(s);
    const scale = Math.min(1, targetKm / originalWork);
    s.reps = s.reps.map((m) => Math.max(100, Math.floor((m * scale) / 100) * 100));
    if (zone === 'I') s.reps = s.reps.filter((m) => validIntervalLeg(m, s.paceSec));
  } else if (s.type === 'tempo') {
    s.qKm = Math.min(Math.round(targetKm * 10) / 10, Math.floor((hardKm + 1e-9) * 10) / 10);
  } else {
    s.qKm = Math.min(Math.round(targetKm * 3 * 10) / 10, Math.floor((hardKm * 3 + 1e-9) * 10) / 10);
  }
}
