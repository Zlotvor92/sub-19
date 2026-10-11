/* Conservative starting doses are product heuristics, not a fitness forecast.
 * Volume supplies a ceiling; readiness and accumulated quality weeks determine
 * how much of that ceiling is used. Prescribed fitness paces never change here. */

import { r1 } from '../../format';
import { sessFartlek, wuCdForVolume } from '../sessions/build';
import { sessDesc, sessKm, sessQKm } from '../sessions/calc';
import { proportionalRest } from '../sessions/intervals';
import { ZONE_FOR_KIND } from '../vdot/zoneForKind';
import type { Intensity, SessionDay } from '../types';
import type { QualityRequest } from './types';

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
  day.session.zone = 'T';
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
  if (!req.readiness && !req.qualityIntensity) return day;
  const readiness = req.readiness ?? 'experienced';
  const intensity = req.qualityIntensity ?? 'std';
  const progress = Math.min(1, Math.max(0, (req.qualW - 1) / QUALITY_BUILD_WEEKS));
  const initial = INITIAL_DOSE[readiness];
  // Taper is already shortened by the distance profile; never grow it again.
  const factor = DOSE_FACTOR[intensity] * (req.isTaper1 ? 1 : initial + (1 - initial) * progress);
  const s = day.session;
  const zone = s.zone ?? ZONE_FOR_KIND[s.kind];
  const timePolicy = FAST_WORK_SECONDS[readiness];
  const timeCap =
    (timePolicy.start + (timePolicy.end - timePolicy.start) * progress) *
    DOSE_FACTOR[intensity] *
    (zone === 'T' ? 1.25 : 1);
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
  } else if (s.type === 'tempo') {
    s.qKm = Math.floor((capKm + 1e-9) * 10) / 10;
  } else {
    s.qKm = Math.floor((capKm * 3 + 1e-9) * 10) / 10;
  }
  if (sessQKm(s) < originalWork - 0.05) {
    const note = 'Doza kvalitetnog rada prilagođena kontinuitetu i izabranom opterećenju.';
    s.notes = [s.notes, note].filter(Boolean).join(' · ');
  }
  day.km = r1(sessKm(s));
  day.desc = sessDesc(s);
  return day;
}
