import { diffDays, parseIsoDate } from '../../date';
import { r1 } from '../../format';
import type { DistanceHeuristic } from '../constants/distances';
import type {
  AthleteAssessment,
  PlanGenerationInput,
  PreparationAssessment,
  TrainingPlan
} from '../types';

/** Product heuristics, not universal physiological cutoffs. Missing evidence stays explicit. */
const RECENT_RESULT_DAYS = 90;
const ESTABLISHED_CONTINUITY_WEEKS = 8;

export function assessAthlete(inp: PlanGenerationInput, h: DistanceHeuristic): AthleteAssessment {
  const consistentWeeks = inp.consistentWeeks ?? null;
  const breakWeeks = inp.breakWeeks ?? 0;
  const explicitReturn =
    inp.currentReadiness?.reason === 'returning' && inp.startDate < inp.currentReadiness.until;
  const returning = explicitReturn || (breakWeeks > 0 && (consistentWeeks ?? 0) < 4);
  const currentReadiness = returning
    ? 'returning'
    : inp.currentReadiness && inp.startDate < inp.currentReadiness.until
      ? inp.currentReadiness.reason
      : 'normal';
  const qualityReadiness = returning
    ? 'returning'
    : inp.trainedRecently === false
      ? 'beginner'
      : currentReadiness !== 'normal'
        ? 'developing'
        : inp.qualityExperience === 'experienced' &&
            (consistentWeeks ?? 0) >= ESTABLISHED_CONTINUITY_WEEKS
          ? 'experienced'
          : 'developing';
  const start = parseIsoDate(inp.startDate);
  const resultDate = inp.pb.date ? parseIsoDate(inp.pb.date) : null;
  const resultAgeDays = start && resultDate ? diffDays(resultDate, start) : null;
  const assumptions: string[] = [];
  const reportedLR = inp.recentLongRunKm != null && inp.recentLongRunKm > 0;
  if (!reportedLR)
    assumptions.push(
      'Skorašnja ponovljiva dužina nije uneta; početna dužina je oprezno izvedena iz nedeljnog obima.'
    );
  if (consistentWeeks == null)
    assumptions.push('Kontinuitet nije potvrđen; kvalitet i dužina uvode se postepeno.');
  if (!inp.qualityExperience)
    assumptions.push(
      'Iskustvo sa kvalitetnim treningom nije potvrđeno; brz rezultat ga ne zamenjuje.'
    );
  if (resultAgeDays == null)
    assumptions.push(
      'Datum rezultata nije unet; tempa su referenca tog rezultata, bez potvrde njegove svežine.'
    );
  const inferredLR = Math.max(
    1.5,
    Math.min(h.longRun.lowVolumeCapKm, inp.weeklyKm * h.longRun.share)
  );
  return {
    qualityReadiness,
    ...(currentReadiness !== 'normal' ? { currentReadiness } : {}),
    weeklyBaseKm: inp.weeklyKm,
    repeatableLongRunKm: r1(reportedLR ? inp.recentLongRunKm! : inferredLR),
    longRunBasis: reportedLR ? 'reported' : 'inferred',
    consistentWeeks,
    breakWeeks,
    resultAgeDays,
    speedConfidence: returning
      ? 'returning'
      : resultAgeDays == null
        ? 'undated-result'
        : resultAgeDays <= RECENT_RESULT_DAYS
          ? 'recent-result'
          : 'stale-result',
    assumptions
  };
}

/** Assess the delivered preparation, including endurance; do not invent a speed gain. */
/** Najduže trčanje koje maratonska priprema traži za punu pripremu [km]. */
export const MARATHON_REQUIRED_LONG_RUN_KM = 26;

export function assessPreparation(plan: TrainingPlan, minPeakKm: number): PreparationAssessment {
  const athlete = plan.meta.athlete;
  const working = plan.weeks.filter((w) => !w.taper && w.w < plan.meta.weeks);
  const longRuns = working.flatMap((w) =>
    w.days.filter((d) => d.tag === 'lr' && !d.mlr).map((d) => d.km!)
  );
  const peakLongRunKm = Math.max(0, ...longRuns);
  const peakWeeklyKm = Math.max(0, ...working.map((w) => w.vol));
  const demandingDaysMax = Math.max(
    0,
    ...working.map((w) => w.days.filter((d) => d.session || d.finish).length)
  );
  /* Plan je uvek maratonski plan ovog generatora: pravilo dužine je 26 km (pravila 5K/10K/HM pripadaju njihovim
     generatorima). `!d.mlr` i `d.finish` su maratonske oznake. */
  const requiredLR = MARATHON_REQUIRED_LONG_RUN_KM;
  const repeatedExposure = longRuns.filter((km) => km >= requiredLR * 0.85).length >= 2;
  const established = (athlete?.consistentWeeks ?? 0) >= ESTABLISHED_CONTINUITY_WEEKS;
  const doseSupported =
    peakWeeklyKm >= minPeakKm && peakLongRunKm >= requiredLR && repeatedExposure;
  const endurance =
    doseSupported && established
      ? 'supported'
      : peakLongRunKm < requiredLR || peakWeeklyKm < minPeakKm
        ? 'limited'
        : 'developing';
  const reasons: string[] = [];
  if (peakLongRunKm < requiredLR)
    reasons.push(
      `Najduže planirano trčanje je ${r1(peakLongRunKm)} km; ovaj plan ima ograničenu dužinsku pripremu za ${plan.meta.raceName.toLowerCase()}. Promeni raspoložive dane, polaznu bazu ili datum trke pre vremenskog cilja.`
    );
  if (peakWeeklyKm < minPeakKm)
    reasons.push(
      `Isporučeni vrhunac ${r1(peakWeeklyKm)} km/ned je ispod okvirne baze za pun vremenski pristup (${minPeakKm} km/ned).`
    );
  if (!established)
    reasons.push(
      'Nema potvrđenog kontinuiteta od najmanje osam nedelja; izdržljivost se ne zaključuje samo iz PB-a.'
    );
  if (athlete?.currentReadiness === 'fatigued')
    reasons.push(
      ((athlete.consistentWeeks ?? 0) > 0
        ? 'Potvrđeni kontinuitet ostaje istorijska činjenica; '
        : '') + 'Visok napor trenutno zahteva rasterećenje i proveru oporavka.'
    );
  if (athlete?.speedConfidence !== 'recent-result')
    reasons.push(
      'Referentni rezultat nije potvrđena skorašnja forma u trenutnoj pripremi; tempo proveri novim rezultatom ili kontrolisanim treningom.'
    );
  if (!repeatedExposure)
    reasons.push(
      'Nema dovoljno ponovljenih dužih izlaganja da jedna najveća dužina potvrdi pripremu.'
    );
  return {
    endurance,
    goalStatus:
      plan.meta.realno === false
        ? 'needs-speed-improvement'
        : endurance !== 'supported'
          ? 'endurance-limited'
          : 'reference-only',
    peakLongRunKm: r1(peakLongRunKm),
    peakWeeklyKm: r1(peakWeeklyKm),
    demandingDaysMax,
    reasons,
    forecastBasis: 'result-and-delivered-preparation'
  };
}
