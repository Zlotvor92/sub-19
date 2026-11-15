/* V4 — FORMA I TEMPA (SPEC § 5.4, § 5.1). Čiste formule: VDOT iz rezultata, vreme trke za VDOT, tempa zona,
   težina tempa trke. Ovaj fajl i `constants.ts` su jedino što `fitness/` i `distances/` uvoze iz motora (§ 14.4). */
import {
  BISECTION_STEPS,
  EASY_ANCHOR_MIN_SEC,
  EASY_FAST_SHARE,
  EFFORT_WHOLE_MAX_OVER_PLANNED,
  EASY_SLOW_SHARE,
  PACE_ROUND_SEC,
  RACE_SPEED_MAX_MPS,
  RACE_SPEED_MIN_MPS,
  RP_WEIGHT_STEP,
  SHARE_K1,
  SHARE_K2,
  SHARE_P0,
  SHARE_P1,
  SHARE_P2,
  TRANSFER_DOWN_MAX_SEC,
  TRANSFER_MAX_SEC,
  TRANSFER_MIN_SEC,
  TRANSFER_UP_MAX_SEC,
  TRANSFER_UP_SHARE,
  VO2_A,
  VO2_B,
  VO2_C,
  WEIGHT_ANCHORS,
  ZONE_ANCHOR_SEC,
  ZONE_SHARE
} from './constants';
import type { Meters, Paces, Run, SecPerKm, Seconds, Transfer, Vdot } from './types';

/** VO2 pri brzini `v` (m/min). */
export function vo2AtSpeed(metersPerMin: number): number {
  return VO2_A + VO2_B * metersPerMin + VO2_C * metersPerMin * metersPerMin;
}

/** Udeo VO2max koji se može držati `t` minuta. */
export function sustainableShare(minutes: number): number {
  return (
    SHARE_P0 + SHARE_P1 * Math.exp(SHARE_K1 * minutes) + SHARE_P2 * Math.exp(SHARE_K2 * minutes)
  );
}

/** VDOT rezultata: dužina i vreme ravnomernog punog napora. */
export function vdotFromResult(distanceM: Meters, timeSec: Seconds): Vdot {
  const minutes = timeSec / 60;
  return vo2AtSpeed(distanceM / minutes) / sustainableShare(minutes);
}

/** Vreme trke (s, bez zaokruživanja) na `distanceM` za dati VDOT; bisekcija po vremenu (VDOT opada sa vremenom). */
export function raceTimeSec(vdot: Vdot, distanceM: Meters): Seconds {
  let fast = distanceM / RACE_SPEED_MAX_MPS;
  let slow = distanceM / RACE_SPEED_MIN_MPS;
  for (let i = 0; i < BISECTION_STEPS; i += 1) {
    const mid = (fast + slow) / 2;
    if (vdotFromResult(distanceM, mid) > vdot) fast = mid;
    else slow = mid;
  }
  return (fast + slow) / 2;
}

/** Brzina (m/min) pri kojoj je `VO2(v) = share × VDOT`. */
export function speedAtShare(vdot: Vdot, share: number): number {
  const c = VO2_A - share * vdot;
  return (-VO2_B + Math.sqrt(VO2_B * VO2_B - 4 * VO2_C * c)) / (2 * VO2_C);
}

/** Tempo (s/km, bez zaokruživanja) pri udelu VDOT. */
export function paceAtShare(vdot: Vdot, share: number): SecPerKm {
  return 60000 / speedAtShare(vdot, share);
}

/** Tempo trke (s/km, bez zaokruživanja) na `distanceM`. */
export function racePace(vdot: Vdot, distanceM: Meters): SecPerKm {
  return (raceTimeSec(vdot, distanceM) / distanceM) * 1000;
}

/** VDOT za koji je dati tempo lagan (66 % VO2max, § 2.4). */
export function vdotFromEasyPace(secPerKm: SecPerKm): Vdot {
  return vo2AtSpeed(60000 / secPerKm) / ZONE_SHARE.E;
}

function roundPace(secPerKm: SecPerKm): SecPerKm {
  return Math.round(secPerKm / PACE_ROUND_SEC) * PACE_ROUND_SEC;
}

/** Tempa zona za VDOT; RP je tempo trke na `distanceM` (§ 5.4). */
/** Dužina koju VDOT pretrči punim naporom za `timeSec` (inverz `raceTimeSec`; VDOT raste sa dužinom pri istom vremenu). */
export function distanceForTime(vdot: Vdot, timeSec: Seconds): Meters {
  let short = (timeSec * RACE_SPEED_MIN_MPS) / 1;
  let long = timeSec * RACE_SPEED_MAX_MPS;
  for (let i = 0; i < BISECTION_STEPS; i += 1) {
    const mid = (short + long) / 2;
    if (vdotFromResult(mid, timeSec) < vdot) short = mid;
    else long = mid;
  }
  return (short + long) / 2;
}

/** F4-K2: VDOT na dužini `d` po ličnoj krivi (jedno mesto za sve: procena, plan, simulacije).
    `vdot` važi na `transfer.refM`; bez `transfer` (ili β = 0) isti VDOT za sve dužine. Dužine se ograničavaju na
    trke od 4 min do 5 h po `vdot`. */
export function vdotAt(vdot: Vdot, distanceM: Meters, transfer?: Transfer): Vdot {
  if (transfer === undefined || !(transfer.beta > 0)) return vdot;
  const t = transfer;
  const lo = distanceForTime(vdot, TRANSFER_MIN_SEC);
  const hi = distanceForTime(vdot, TRANSFER_MAX_SEC);
  const clampM = (m: Meters): Meters => Math.min(hi, Math.max(lo, m));
  const anchor = clampM(t.anchorM ?? t.refM);
  /* granice pomaka (u VDOT, oko `vdot`): VDOT ~ brzina, pa Δv ≈ v · Δp / (p − Δp) */
  const pI = paceAtShare(vdot, ZONE_SHARE.I);
  const pM = paceAtShare(vdot, ZONE_SHARE.M);
  const upSec = t.up?.maxSec ?? TRANSFER_UP_MAX_SEC;
  const upMax = upSec <= 0 ? 0 : (vdot * upSec) / (pI - upSec);
  const downMax = (vdot * TRANSFER_DOWN_MAX_SEC) / (pM + TRANSFER_DOWN_MAX_SEC);
  /* pomak krive od preloma: ka kraćoj dužini (naviše) pola β bez ličnog, ka dužoj pun β */
  const offset = (m: Meters): number => {
    const l = Math.log(anchor / clampM(m));
    const upBeta = t.up?.beta ?? TRANSFER_UP_SHARE * t.beta;
    const raw = (l > 0 && !t.personal ? upBeta : t.beta) * l;
    return Math.min(upMax, t.capDown === true ? Math.max(-downMax, raw) : raw);
  };
  return vdot - offset(t.refM) + offset(distanceM);
}

/** Dužina sidra zone za formu na cilju (F4-K2): trka od `ZONE_ANCHOR_SEC` punim naporom; E: duže od cilja i od
    trke od `EASY_ANCHOR_MIN_SEC`. */
export function zoneAnchorM(vdot: Vdot, zone: 'E' | 'T' | 'I' | 'R', refM: Meters): Meters {
  if (zone === 'E') return Math.max(refM, distanceForTime(vdot, EASY_ANCHOR_MIN_SEC));
  return distanceForTime(vdot, ZONE_ANCHOR_SEC[zone]);
}

/** VDOT zone po njenom sidru (F4-K2); M i tempo trke = dužina cilja. */
export function zoneVdot(vdot: Vdot, zone: 'E' | 'M' | 'T' | 'I' | 'R', transfer?: Transfer): Vdot {
  if (transfer === undefined || zone === 'M') return vdot;
  return vdotAt(vdot, zoneAnchorM(vdot, zone, transfer.refM), transfer);
}

/** Vreme punog napora na `distanceM` po ličnoj krivi (test, pripremna trka, trka). */
export function effortTimeSec(vdot: Vdot, distanceM: Meters, transfer?: Transfer): Seconds {
  return raceTimeSec(vdotAt(vdot, distanceM, transfer), distanceM);
}

/** Tempa zona za VDOT; RP je tempo trke na `distanceM` (§ 5.4). Sa `transfer` svaka zona po svom sidru (F4-K2). */
export function zonePaces(
  vdot: Vdot,
  distanceM: Meters,
  byFeel: boolean,
  /** P3 (krug 5): sporiji od `fromRaceSec` na distanci — intervali ne brži od tempa trke na `distanceM` iz forme. */
  intervalFloor?: { distanceM: Meters; fromRaceSec: Seconds },
  transfer?: Transfer
): Paces {
  const at = (m: Meters): Vdot => vdotAt(vdot, m, transfer);
  /* A14 (krug 9): VDOT zone nikad iznad najvećeg sirovog VDOT-a stvarnog rezultata */
  const lim = transfer?.limits;
  /* R18 (stavka 1): prelom na rezultatu iz istorije bez lične krive — zone naniže ograničene isto kao uz unet rezultat
     (prag i lagano ne skaču sporije kad prelom pređe sa unetog rezultata na stvarnu trku iste forme) */
  const zt: Transfer | undefined =
    transfer?.zoneCapDown === true ? { ...transfer, capDown: true } : transfer;
  const top = (v: Vdot): Vdot =>
    lim?.maxVdot === undefined ? v : Math.min(v, Math.max(vdot, lim.maxVdot));
  const vR = top(zoneVdot(vdot, 'R', zt));
  const vI = top(zoneVdot(vdot, 'I', zt));
  const vT = top(zoneVdot(vdot, 'T', zt));
  const vE = zoneVdot(vdot, 'E', zt);
  const slow =
    intervalFloor !== undefined && raceTimeSec(vdot, distanceM) >= intervalFloor.fromRaceSec;
  const I = slow
    ? Math.max(
        paceAtShare(vI, ZONE_SHARE.I),
        racePace(at(intervalFloor.distanceM), intervalFloor.distanceM)
      )
    : paceAtShare(vI, ZONE_SHARE.I);
  /* A14 (c): prag ne brži od trke od 40–70 min, intervali ne brži od trke/testa do 15 min */
  const T = Math.max(paceAtShare(vT, ZONE_SHARE.T), lim?.tFloor ?? 0);
  const Ilim = Math.max(I, lim?.iFloor ?? 0);
  return {
    easySlow: roundPace(paceAtShare(vE, EASY_SLOW_SHARE)),
    easyFast: roundPace(paceAtShare(vE, EASY_FAST_SHARE)),
    easy: roundPace(paceAtShare(vE, ZONE_SHARE.E)),
    M: roundPace(paceAtShare(vdot, ZONE_SHARE.M)),
    T: roundPace(T),
    I: roundPace(Ilim),
    R: roundPace(paceAtShare(vR, ZONE_SHARE.R)),
    RP: roundPace(racePace(vdot, distanceM)),
    byFeel
  };
}

/** Težina opterećenja iz odnosa brzine i brzine praga `s = v / v_T` (§ 5.1): linearno između sidara, ravno van. */
export function weightAtSpeedRatio(s: number): number {
  const first = WEIGHT_ANCHORS[0];
  const last = WEIGHT_ANCHORS[WEIGHT_ANCHORS.length - 1];
  if (first === undefined || last === undefined) return 1;
  if (s <= first[0]) return first[1];
  if (s >= last[0]) return last[1];
  for (let i = 1; i < WEIGHT_ANCHORS.length; i += 1) {
    const lo = WEIGHT_ANCHORS[i - 1];
    const hi = WEIGHT_ANCHORS[i];
    if (lo !== undefined && hi !== undefined && s <= hi[0]) {
      return lo[1] + ((hi[1] - lo[1]) * (s - lo[0])) / (hi[0] - lo[0]);
    }
  }
  return last[1];
}

/** Težina tempa `pace` u odnosu na tempo praga (oba s/km). */
export function weightAtPace(pace: SecPerKm, thresholdPace: SecPerKm): number {
  return pace > 0 ? weightAtSpeedRatio(thresholdPace / pace) : 1;
}

/** Težina tempa trke na `distanceM` (§ 5.1), zaokružena na 0,05. Motor zna samo dužinu, ne ime distance. */
export function racePaceWeight(vdot: Vdot, distanceM: Meters): number {
  const s = paceAtShare(vdot, ZONE_SHARE.T) / racePace(vdot, distanceM);
  return Math.round(weightAtSpeedRatio(s) / RP_WEIGHT_STEP) * RP_WEIGHT_STEP;
}

/** REZULTAT PUNOG NAPORA iz trčanja (krug 3, K1) — jedini vlasnik pravila „šta je rezultat trke ili testa":
    (0) izričit rezultat trkača (`resultSec`, uz `resultDistanceM` ili planiranu deonicu);
    (1) krugovi rada — zbir dužine i vremena;
    (2) aktivnost duža od planirane deonice za > 15 %: najbrži uzastopni niz kilometara dužine deonice (`splits`);
    (3) takva aktivnost bez kilometara: `null` — nije dokaz forme (nosi zagrevanje i hlađenje);
    (4) inače cela aktivnost (dužina ≈ planirana, ili trka van plana — snima se sama). */
export function effortResult(run: Run): { distanceM: Meters; durationSec: Seconds } | null {
  const planned = run.plannedEffortM;
  if (run.resultSec !== undefined && run.resultSec > 0) {
    const distanceM = run.resultDistanceM ?? planned ?? run.distanceM;
    if (distanceM > 0) return { distanceM, durationSec: run.resultSec };
  }
  const work = (run.laps ?? []).filter(
    (lap) => lap.role === 'work' && lap.distanceM > 0 && lap.durationSec > 0
  );
  if (work.length > 0) {
    return {
      distanceM: work.reduce((sum, lap) => sum + lap.distanceM, 0),
      durationSec: work.reduce((sum, lap) => sum + lap.durationSec, 0)
    };
  }
  const whole = { distanceM: run.distanceM, durationSec: run.durationSec };
  /* S10 (krug 4): trka se uvek usvaja cela (trka 5 km na dan planiranog testa 3 km); pravilo deonice važi za test */
  if (run.effort === 'race') return whole;
  if (planned === undefined || planned <= 0) return whole;
  if (run.distanceM <= EFFORT_WHOLE_MAX_OVER_PLANNED * planned) return whole;
  const n = Math.round(planned / 1000);
  const paces = (run.splits ?? []).map((x) => x.paceSec);
  if (n < 1 || paces.length < n || paces.some((x) => !(x > 0))) return null;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + n <= paces.length; i += 1) {
    let sum = 0;
    for (let k = i; k < i + n; k += 1) sum += paces[k] ?? 0;
    best = Math.min(best, sum);
  }
  return { distanceM: n * 1000, durationSec: best };
}
