/* Polumaraton — trenerski model.
   Prag i tempo trke su glavni motor; VO2max je potpora. Dve taper nedelje,
   srednje-dugo trčanje (MLR), uputstvo za gorivo od 90 min, kontrolna trka 3–4
   nedelje pred cilj, strategija ritma po vremenu trke. */

import { fmtClock, r1 } from '../../format';
import { HEURISTIC_21K as H, PRODUCT_21K } from '../constants/distances';
import { DELOAD_EVERY } from '../constants/heuristics';
import { sessTempo, wuCdForVolume } from '../sessions/build';
import {
  chooseReps,
  fartlek,
  intervalsOf,
  proportionalRest,
  type FartlekParams
} from '../sessions/intervals';
import { DEMANDING_LONG_RUN_MIN } from '../generator/weeklyLoad';
import type { FastFinish, SessionDay } from '../types';
import {
  HM_NOTES,
  HM_TAPER,
  HM_TRACKS,
  HM_WEEKLY_FAST_SHARE,
  hmContinuousThreshold,
  hmCycle,
  hmRacePaceBlocks,
  hmTargets,
  hmThresholdBlocks,
  hmTrack,
  MIN_CONTINUOUS_KM
} from './hmProgression';
import { applyQualityDose, introductoryQuality } from './qualityDose';
import type {
  DistanceProfile,
  PaceStrategy,
  Phase,
  QualityRequest,
  SingleQualityContext
} from './types';

/** <30% prag, <60% vrhunac, ostalo specifika. */
function phase21K(qualW: number, qualWeeks: number): Phase {
  const f = qualW / Math.max(qualWeeks, 1);
  if (f < 0.3) return 'threshold';
  if (f < 0.6) return 'peak';
  return 'specific';
}

/** Strategija ritma po vremenu trke: <80 min prag, ≤110 min blokovi na tempu trke, inače dugo. */
export function paceStrategy21K(racePaceSec: number): PaceStrategy {
  const min = (racePaceSec * 21.0975) / 60;
  if (min < 80) return 'threshold';
  if (min <= 110) return 'blocks';
  return 'long';
}

const FARTLEK: FartlekParams = { minN: 5, maxN: 10, nShare: 0.12, surgeSec: 120, restSec: 90 };
const INTERVAL_LADDER_M = [2000, 1600, 1200, 1000, 800, 600] as const;

const intervalWish = (phase: Phase, wkIdx: number): number => {
  const menu = phase === 'threshold' ? [1200, 1600] : [1200, 1600, 2000];
  return menu[wkIdx % menu.length] as number;
};

const mkIntervals = (
  dow: number,
  vol: number,
  pI: number,
  phase: Phase,
  wkIdx: number
): SessionDay => {
  const q = Math.min(Math.max(vol * H.intervalBudget.pct, 2.4), H.intervalBudget.maxKm);
  const { rep, n } = chooseReps(q, intervalWish(phase, wkIdx), INTERVAL_LADDER_M, 600);
  return intervalsOf(dow, vol, n, rep, pI, proportionalRest(rep, pI));
};

/**
 * Kontrolna trka: pravi presek forme 3–4 nedelje pred cilj — i probni dan za
 * opremu, doručak i gorivo. NAMERNO nema Danielsovu zonu (v. ZONE_FOR_KIND):
 * korisnik je može istrčati punom snagom ili kontrolisano.
 */
const mkTimeTrial = (dow: number, vol: number, racePace: number): SessionDay => {
  const [wu, cd] = wuCdForVolume(vol);
  const trialKm = Math.max(5, Math.min(10, Math.round(vol * 0.15)));
  const km = r1(wu + trialKm + cd);
  return {
    dow,
    tag: 'tempo',
    km,
    desc:
      `Kontrolna trka — ${wu} km zagrevanje + ${trialKm} km + ${cd} km hlađenje. ` +
      `Kontrolisano na ${fmtClock(racePace)}/km (tempo polumaratona), bez maksimalnog testa. ` +
      `Isprobaj opremu, doručak i gorivo tačno kako planiraš na dan trke. ` +
      `Sledeća 2–3 dana drži skroz lagano, bez obzira kako se osećaš.`,
    session: {
      type: 'tempo',
      kind: 'Kontrolna trka',
      purpose: 'RP',
      zone: 'RP',
      paceSource: 'race-specific',
      notes:
        'Kontrolisano na ritmu polumaratona; isprobaj opremu i gorivo. Ovo nije maksimalan test forme. Pravu trku unesi zasebno kao test. Naredna 2–3 dana lagano.',
      wuKm: wu,
      qKm: trialKm,
      paceSec: racePace,
      cdKm: cd,
      overrides: {}
    }
  };
};

/** Kontinuirani rad do granice kad dva bloka ne staju; ispod 1,5 km nema smislene doze,
 *  pa 0 km znači da nedeljni omotač/guard taj dan pretvara u lak (bez bržeg ili dužeg rada). */
const fallbackTempo = (
  dow: number,
  vol: number,
  pace: number,
  capKm: number,
  kind: 'Tempo' | 'Tempo trke',
  purpose: 'T' | 'RP'
): SessionDay => {
  const [wu, cd] = wuCdForVolume(vol);
  const fits = Math.floor((capKm + 1e-9) * 10) / 10;
  const km = fits >= MIN_CONTINUOUS_KM ? fits : 0;
  return sessTempo(dow, wu, km, pace, Math.max(cd, 1), kind, purpose);
};

/**
 * HM nedelja po fazi i stazi (v. `hmProgression.ts`):
 * - prag (threshold): q1 pragovski blokovi rastu dužinom i zbirom; q2 naizmenično
 *   kontinuirani prag i VO2 podrška (fartlek/intervali; R nije deo HM menija).
 * - vrhunac (peak): q1 prag (svake treće nedelje intervali), q2 HM ritam u blokovima.
 * - specifično: q1 HM ritam, q2 kontinuirani prag za održavanje. Kad duga ima brz
 *   završetak na HM ritmu, ona JESTE HM dan: jedini drugi kvalitet je prag.
 * - jedan kvalitet nedeljno: prag i HM ritam naizmenično.
 * Taper: isti formati, manje rada (`HM_TAPER`), tempo ostaje.
 * Vraća `progression: true` kada je doza već izvedena iz ciljnih minuta.
 */
function chooseQuality21K(req: QualityRequest): { day: SessionDay; progression: boolean } {
  const { qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, isTaper1, dow, racePace, ctx } = req;
  const phase = phase21K(qualW, qualWeeks);
  const track = hmTrack(req.readiness);
  const policy = HM_TRACKS[track];
  const cycle = hmCycle(qualW, qualWeeks, ctx.taperW || H.taperWeeks, phase21K);
  const target = hmTargets(track, cycle);
  const x = { track, vol, intensity: req.qualityIntensity, maxWorkSec: req.maxWorkSec };
  const single = effQ === 1 || !!req.replacesSecondQuality;
  const rpMaxKm = H.racePaceBudget.maxKm;
  const prog = (day: SessionDay | null, fallback: () => SessionDay) => ({
    day: day ?? fallback(),
    progression: true
  });
  const tFallback = (): SessionDay =>
    fallbackTempo(
      dow,
      vol,
      pT,
      Math.min(vol * 0.1, (req.maxWorkSec ?? Infinity) / pT),
      'Tempo',
      'T'
    );
  const rpFallback = (): SessionDay =>
    fallbackTempo(
      dow,
      vol,
      racePace,
      Math.min(vol * 0.2, rpMaxKm, (req.maxWorkSec ?? Infinity) / racePace),
      'Tempo trke',
      'RP'
    );
  const tBlocks = (min: number, block: number, note?: string) =>
    prog(hmThresholdBlocks(dow, pT, min, block, x, note), tFallback);
  const rpBlocks = (min: number, block: number, note?: string) =>
    prog(hmRacePaceBlocks(dow, racePace, min, block, rpMaxKm, x, note), rpFallback);

  if (isTaper1 || req.taperTransition) {
    const f = isTaper1 ? HM_TAPER.final : HM_TAPER.transition;
    if (single || slotRole === 'q1')
      return rpBlocks(policy.rp.endMin * f.rp, policy.rp.blockEndMin, HM_NOTES.taper);
    if (isTaper1)
      return prog(
        hmContinuousThreshold(dow, pT, policy.t.endMin * f.t, H.tempoMaxSec, x, HM_NOTES.taper),
        tFallback
      );
    return tBlocks(policy.t.endMin * f.t, policy.t.blockEndMin, HM_NOTES.taper);
  }

  /* KONTROLNA TRKA umesto q1 — cilja se 4 nedelje pre; ako je BAŠ ta nedelja deload
     (nema kvaliteta), pomera se na 3 nedelje pre. */
  if (
    ctx.weeks &&
    ctx.w &&
    phase === 'specific' &&
    (effQ === 1 || slotRole === 'q1') &&
    vol >= 30
  ) {
    const weeksToRace = ctx.weeks - ctx.w;
    const w4 = ctx.weeks - 4;
    const lastWorking = ctx.weeks - 1 - (ctx.taperW || 1);
    const fourthIsDeload = w4 > 0 && w4 % DELOAD_EVERY === 0 && w4 < lastWorking;
    if (weeksToRace === 4 ? !fourthIsDeload : weeksToRace === 3 && fourthIsDeload) {
      return { day: mkTimeTrial(dow, vol, racePace), progression: true };
    }
  }

  const intervals = () => ({ day: mkIntervals(dow, vol, pI, phase, qualW), progression: false });
  const maintenance = target.tMin * policy.tMaintenance;
  const continuousT = () => {
    const day = hmContinuousThreshold(dow, pT, maintenance, H.tempoMaxSec, x);
    return day ? { day, progression: true } : tBlocks(maintenance, target.tBlockMin);
  };

  if (phase === 'threshold') {
    if (single || slotRole === 'q1')
      return single && qualW % 3 === 0 ? intervals() : tBlocks(target.tMin, target.tBlockMin);
    /* q2: prag je glavni motor — kontinuirani prag i VO2 podrška naizmenično (iskusni
       počinju pragom, prvi HM fartlekom). */
    const thresholdWeek = track === 'performance' ? qualW % 2 === 1 : qualW % 2 === 0;
    if (thresholdWeek) return continuousT();
    return {
      day:
        qualW % 4 < 2
          ? fartlek(FARTLEK, dow, vol, pI, pE)
          : mkIntervals(dow, vol, pI, phase, qualW),
      progression: false
    };
  }
  /* Jedan kvalitet od faze vrhunca: HM ritam (neparne) i prag (parne) naizmenično. */
  const alternate = () =>
    qualW % 2 === 1
      ? rpBlocks(target.rpMin, target.rpBlockMin)
      : tBlocks(target.tMin, target.tBlockMin);
  if (phase === 'peak') {
    if (single) return alternate();
    if (slotRole === 'q1')
      return qualW % 3 === 0 ? intervals() : tBlocks(target.tMin, target.tBlockMin);
    return rpBlocks(target.rpMin, target.rpBlockMin);
  }
  /* specifična faza */
  if (req.lrFinish) return tBlocks(target.tMin, target.tBlockMin);
  if (single) return alternate();
  if (slotRole === 'q1') return rpBlocks(target.rpMin, target.rpBlockMin);
  return continuousT();
}

function buildQuality21K(req: QualityRequest): SessionDay {
  const intro = introductoryQuality(req);
  if (intro) return applyQualityDose(intro, { ...req, budgets: H });
  const { day, progression } = chooseQuality21K(req);
  // Progression sessions are already dosed from target minutes; the race rehearsal is a
  // dated event. I/R support sessions keep the shared dose policy.
  if (progression) return day;
  return applyQualityDose(day, { ...req, budgets: H });
}

/** Prvi HM na najviše četiri dana: nedelja sa dugom ≥ 90 min nosi jedan kvalitet uz dugu. */
function singleQualityWeek21K(x: SingleQualityContext): boolean {
  return (
    hmTrack(x.readiness) === 'first' && x.runDays <= 4 && x.longRunMin >= DEMANDING_LONG_RUN_MIN
  );
}

/** Brz završetak dugog trčanja na tempu trke u specifičnoj fazi (češće za strategiju „dugo"). */
function longRunFinish21K(
  phase: Phase,
  qualW: number,
  lrKm: number,
  racePace: number,
  strategy: PaceStrategy | null
): FastFinish | null {
  if (phase !== 'specific' || !(lrKm >= 10)) return null;
  const often = strategy === 'long';
  if (!often && qualW % 2 === 0) return null;
  const finish = r1(Math.max(3, Math.min(6, lrKm * 0.25)));
  return { km: finish, paceSec: racePace, zone: 'RP' };
}

export const PROFILE_21K: DistanceProfile = {
  product: PRODUCT_21K,
  heuristic: H,
  phase: phase21K,
  buildQuality: buildQuality21K,
  paceStrategy: paceStrategy21K,
  longRunFinish: longRunFinish21K,
  singleQualityWeek: singleQualityWeek21K,
  // Support (I/R) gives way first, then threshold; HM rhythm is cut last.
  trimPriority: (day) => (day.session.zone === 'RP' ? 2 : day.session.zone === 'T' ? 1 : 0),
  weeklyFastShare: (readiness) => HM_WEEKLY_FAST_SHARE[hmTrack(readiness)]
};
