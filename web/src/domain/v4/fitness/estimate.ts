/* V4 — FORMA IZ TRČANJA (SPEC § 7, § 14.3, § 14.6; AGENTS V4 t. 9a).
   Čista funkcija: ista trčanja → ista procena; ulaz se ne menja. Trčanja se obrađuju hronološki, dan po dan;
   svaka promena je zapis `FormChange` sa rečenicom „zašto". */
import {
  DEFAULT_VDOT,
  ZONE_LIMIT_DAYS,
  ZONE_LIMIT_I_MAX_SEC,
  ZONE_LIMIT_T_MAX_SEC,
  ZONE_LIMIT_T_MIN_SEC,
  ZONE_SHARE
} from '../engine/constants';
import type {
  Confidence,
  FormChange,
  FormEstimate,
  FormPoint,
  IsoDate,
  Meters,
  SecPerKm,
  Transfer,
  Vdot,
  ZoneId
} from '../engine/types';
import {
  paceAtShare,
  racePace,
  raceTimeSec,
  vdotFromEasyPace,
  effortResult,
  vdotAt,
  vdotFromResult,
  vo2AtSpeed,
  zoneVdot
} from '../engine/vdot';
import * as C from './constants';
import {
  explainBaseDrop,
  explainHeartRate,
  explainPause,
  explainPlanShortfall,
  explainNoQuality,
  explainPlanWeek,
  explainQuality,
  explainResult,
  explainUnusable,
  explainStart
} from './explain';
import { rollChronic, runLoad } from './load';
import type {
  FitnessFacts,
  FitnessPlanned,
  FitnessRun,
  PauseSpan,
  ResultEvidence,
  Tenure
} from './types';

/* ------------------------------------------------------------------ datumi */

const DAY_MS = 86_400_000;

export function dayNum(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / DAY_MS);
}

export function isoOf(n: number): IsoDate {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = ponedeljak … 6 = nedelja. */
function weekday(n: number): number {
  return (((n + 3) % 7) + 7) % 7;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const r2 = (x: number): number => Math.round(x * C.VDOT_ROUND) / C.VDOT_ROUND;

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length === 0) return 0;
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

/* ------------------------------------------------------------------ dokazi */

const isQualityZone = (z: ZoneId): boolean => (C.QUALITY_ZONES as readonly string[]).includes(z);
const usableForForm = (r: FitnessRun): boolean => r.source !== 'procena';

function resultKind(r: FitnessRun): 'trka' | 'test' | null {
  if (!usableForForm(r)) return null;
  /* krug 13 (M17): pun napor na dan provere iz plana je test i kad je upisan kao trka (5K S03: 1,5 km) */
  if ((r.plannedEffortM ?? 0) > 0 && r.effort !== undefined && r.distanceM >= C.TEST_MIN_M)
    return r.effort === 'race' && r.distanceM >= C.RACE_MIN_M ? 'trka' : 'test';
  if (r.effort === 'race' && r.distanceM >= C.RACE_MIN_M) return 'trka';
  if (r.effort === 'test' && r.distanceM >= C.TEST_MIN_M) return 'test';
  /* R4 (krug 6): odrađena provera forme iz plana (trčanje vezano za dan punog napora) je rezultat */
  if (r.effort === undefined && (r.plannedEffortM ?? 0) > 0 && r.distanceM >= C.TEST_MIN_M)
    return 'test';
  return null;
}

/** VDOT rezultata + oprezna korekcija za izrazito negativan split; toplota samo označava (F4-REPORT). */
export function resultEvidence(r: FitnessRun): ResultEvidence {
  const rawVdot = vdotFromResult(r.distanceM, r.durationSec);
  let splitBonus = 0;
  const splits = r.splits ?? [];
  const hot = r.tempC !== undefined && r.tempC >= C.HOT_FROM_C;
  const paces = splits.map((x) => x.paceSec).filter((x) => x > 0);
  /* R14: hodanje — izričito (`Run.walked`) ili izvedeno iz km (neki km > 1,25 × medijane). */
  const walking =
    r.walked === true ||
    (paces.length >= 3 && Math.max(...paces) > C.WALK_SPLIT_RATIO * median(paces));
  /* R14: trka sa hodanjem se ne koriguje. */
  if (walking) return { vdot: rawVdot, rawVdot, splitBonus: 0, hot, walking };
  const halfKm = r.distanceM / 2000;
  if (splits.length >= Math.ceil(halfKm) + 1 && splits.length * 1000 <= r.distanceM + 1000) {
    const whole = Math.floor(halfKm);
    let first = 0;
    for (let i = 0; i < whole; i += 1) first += splits[i]?.paceSec ?? 0;
    first += (halfKm - whole) * (splits[whole]?.paceSec ?? 0);
    const second = r.durationSec - first;
    if (first > 0 && second > 0 && first / second - 1 >= C.NEG_SPLIT_MIN) {
      const asSecond = vdotFromResult(r.distanceM, 2 * second);
      splitBonus = clamp(C.NEG_SPLIT_SHARE * (asSecond - rawVdot), 0, C.NEG_SPLIT_MAX_BONUS);
    }
  }
  return { vdot: rawVdot + splitBonus, rawVdot, splitBonus, hot, walking };
}

/** VDOT za koji zona daje tempo `pace` (RP: tempo trke na distanci cilja). */
function vdotForZonePace(zone: ZoneId, pace: SecPerKm, goalM: Meters): Vdot {
  if (zone === 'RP') return vdotFromResult(goalM, (pace * goalM) / 1000);
  const share = zone === 'E' ? ZONE_SHARE.E : ZONE_SHARE[zone];
  return vo2AtSpeed(60000 / pace) / share;
}

function zonePace(zone: ZoneId, vdot: Vdot, goalM: Meters): SecPerKm {
  if (zone === 'RP') return racePace(vdot, goalM);
  return paceAtShare(vdot, zone === 'E' ? ZONE_SHARE.E : ZONE_SHARE[zone]);
}

interface QualityEvidence {
  vdot: Vdot;
  held: boolean;
}

/** § 7.3. `null` = trčanje nije kvalitet ili je „između" (bez dokaza). */
export function qualityEvidence(
  r: FitnessRun,
  old: Vdot,
  goalM: Meters,
  /** F4-K2: lična kriva; tempo zone i dokaz važe na sidru zone (R, I 5 km, T 10 km) i prevode se na cilj. */
  transfer?: Transfer
): QualityEvidence | null {
  if (!usableForForm(r) || r.effort !== undefined || r.planned === undefined) return null;
  if (!isQualityZone(r.planned.zone)) return null;
  const work = (r.laps ?? []).filter(
    (l) => l.role === 'work' && l.distanceM > 0 && l.durationSec > 0
  );
  if (work.length === 0) return null;
  const workSec = work.reduce((a, l) => a + l.durationSec, 0);
  const workM = work.reduce((a, l) => a + l.distanceM, 0);
  const pr = (workSec / workM) * 1000;
  const zone = r.planned.zone;
  const anchorZone = zone === 'T' || zone === 'I' || zone === 'R' ? zone : null;
  const zoneV = anchorZone === null ? old : zoneVdot(old, anchorZone, transfer);
  const pc = zonePace(zone, zoneV, goalM);
  const done = workSec >= C.QUALITY_DONE_SHARE * r.planned.workSec;
  /* dokaz na sidru zone → cilj: ista razlika kao između očekivanog na sidru i procene na cilju */
  const atPace = vdotForZonePace(zone, pr, goalM) - (zoneV - old);
  if (done && pr <= C.QUALITY_HELD_RATIO * pc) {
    const v =
      r.rpe !== undefined && r.rpe >= C.QUALITY_LIMIT_RPE
        ? old
        : Math.min(atPace, old + C.QUALITY_EVIDENCE_SPAN);
    return { vdot: v, held: true };
  }
  if (!done || pr > C.QUALITY_MISSED_RATIO * pc) {
    /* Nedovršen trening ne podiže procenu ni kad su deonice brze (odluka F4). */
    return { vdot: clamp(atPace, old - C.QUALITY_EVIDENCE_SPAN, old), held: false };
  }
  return null;
}

/** Ravnomerno lagano trčanje za trend pulsa (§ 7.4); vraća meru `e` = (m/min) / otkucaji. */
function hrEfficiency(r: FitnessRun, vdot: Vdot): number | null {
  if (!usableForForm(r) || r.effort !== undefined || r.avgHr === undefined || r.avgHr <= 0)
    return null;
  if (r.durationSec < C.HR_MIN_SEC) return null;
  if (r.planned !== undefined && isQualityZone(r.planned.zone)) return null;
  if ((r.laps ?? []).some((l) => l.role === 'work')) return null;
  const pace = (r.durationSec / r.distanceM) * 1000;
  const easy = paceAtShare(vdot, ZONE_SHARE.E);
  if (Math.abs(pace / easy - 1) > C.HR_EASY_TOLERANCE) return null;
  const sp = (r.splits ?? []).map((s) => s.paceSec).filter((p) => p > 0);
  if (sp.length > 0 && Math.max(...sp) / Math.min(...sp) - 1 > C.HR_SPLIT_SPREAD) return null;
  return r.distanceM / (r.durationSec / 60) / r.avgHr;
}

/* ------------------------------------------------------------------ pauze */

/** Prijavljene pauze ∪ prekidi bez ijednog trčanja ≥ 14 dana (i do juče); vraća samo one duže od 5 dana. */
export function pauseSpans(
  facts: FitnessFacts,
  runs: readonly FitnessRun[],
  today: number
): PauseSpan[] {
  const spans: { from: number; to: number; reported: boolean }[] = [];
  for (const p of facts.pauses) {
    const from = dayNum(p.from);
    const to = Math.min(dayNum(p.to), today);
    if (to >= from) spans.push({ from, to, reported: true });
  }
  const dates = [...new Set(runs.map((r) => dayNum(r.date)))].sort((a, b) => a - b);
  for (let i = 0; i < dates.length; i += 1) {
    const a = dates[i] ?? 0;
    /* Tekući prekid se broji do juče: današnji dan još nije prošao. */
    const b = i + 1 < dates.length ? (dates[i + 1] ?? today) : today;
    if (b - a - 1 >= C.PAUSE_DERIVED_MIN_DAYS)
      spans.push({ from: a + 1, to: b - 1, reported: false });
  }
  spans.sort((x, y) => x.from - y.from || x.to - y.to);
  const merged: { from: number; to: number; reported: boolean }[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last !== undefined && s.from <= last.to + 1) {
      last.to = Math.max(last.to, s.to);
      last.reported = last.reported || s.reported;
    } else merged.push({ ...s });
  }
  return merged
    .map((s) => ({
      from: isoOf(s.from),
      to: isoOf(s.to),
      days: s.to - s.from + 1,
      reported: s.reported
    }))
    .filter((s) => s.days > C.PAUSE_FREE_DAYS);
}

/* ------------------------------------------------------------------ staž i plafon (§ 7.5, § 14.6) */

export function tenureOf(facts: FitnessFacts): Tenure {
  const p = facts.profile;
  if (p.beginner === true) return 'pocetnik';
  if (p.yearsRunning === undefined) return 'nepoznato';
  if (p.yearsRunning < C.TENURE_JUNIOR_YEARS) return 'pocetnik';
  if (p.yearsRunning <= C.TENURE_SENIOR_YEARS) return 'srednji';
  return 'iskusan';
}

/* ------------------------------------------------------------------ glavna funkcija */

type StartSource = 'rezultat' | 'lagani-tempo' | 'trcanja' | 'nista';

function startingPoint(
  facts: FitnessFacts,
  runs: readonly FitnessRun[]
): { vdot: Vdot; source: StartSource } {
  const p = facts.profile;
  if (p.recentResult !== undefined && p.recentResult.distanceM > 0 && p.recentResult.timeSec > 0) {
    return {
      vdot: vdotFromResult(p.recentResult.distanceM, p.recentResult.timeSec),
      source: 'rezultat'
    };
  }
  if (p.easyPaceSecPerKm !== undefined && p.easyPaceSecPerKm > 0) {
    return { vdot: vdotFromEasyPace(p.easyPaceSecPerKm), source: 'lagani-tempo' };
  }
  /* Bez izjave: medijana tempa trčanja ≥ 25 min iz prve 4 nedelje istorije, čitana kao GORNJA granica laganog
     (72 % VO2max, F4-K2): rekreativci lagano često trče brže od 66 %, pa bi 66 % precenilo formu (odluka F4, § 2.4). */
  const first = runs[0];
  if (first !== undefined) {
    const until = dayNum(first.date) + 27;
    const paces = runs
      .filter((r) => dayNum(r.date) <= until && usableForForm(r) && r.effort === undefined)
      .filter(
        (r) => r.durationSec >= C.HR_MIN_SEC && !(r.laps ?? []).some((l) => l.role === 'work')
      )
      .map((r) => (r.durationSec / r.distanceM) * 1000);
    if (paces.length > 0) {
      return { vdot: vo2AtSpeed(60000 / median(paces)) / C.EASY_START_SHARE, source: 'trcanja' };
    }
  }
  return { vdot: DEFAULT_VDOT, source: 'nista' };
}

function validRun(r: FitnessRun, today: number): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    dayNum(r.date) <= today &&
    Number.isFinite(r.distanceM) &&
    Number.isFinite(r.durationSec) &&
    r.distanceM > 0 &&
    r.durationSec > 0
  );
}

export function estimateForm(
  facts: FitnessFacts,
  goal: { distanceM: Meters; raceDate: IsoDate },
  planned: FitnessPlanned | null
): FormEstimate {
  const today = dayNum(facts.today);
  const goalM = goal.distanceM;
  const runs = facts.runs
    .filter((r) => validRun(r, today))
    .slice()
    .sort((a, b) => dayNum(a.date) - dayNum(b.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  /* F4-K2: prenos rezultata na dužinu cilja — β po obimu poslednjih 8 nedelja, lični β iz dve dužine */
  const firstRunAt = runs[0] !== undefined ? dayNum(runs[0].date) : Number.POSITIVE_INFINITY;
  const weeklyKmAt = (d: number): number | null => {
    if (firstRunAt > d) return facts.profile.weeklyKm ?? null;
    let km = 0;
    for (const r of runs) {
      const day = dayNum(r.date);
      if (day > d - C.TRANSFER_VOLUME_DAYS && day <= d) km += r.distanceM / 1000;
    }
    /* krug 13 (M18/M17): kratka istorija ne daje nedeljni obim množenjem jednog dana sa 7 (jedna trka juče = 70 km
       nedeljno) — deo prozora bez trčanja popunjava izjavljeni obim, a bez izjave prozor je bar 7 dana */
    const span = Math.min(C.TRANSFER_VOLUME_DAYS, d - firstRunAt + 1);
    const declared = facts.profile.weeklyKm;
    if (span < C.TRANSFER_VOLUME_DAYS && declared !== undefined) {
      const filled = km + (declared * (C.TRANSFER_VOLUME_DAYS - span)) / 7;
      return (filled * 7) / C.TRANSFER_VOLUME_DAYS;
    }
    return (km * 7) / Math.max(7, span);
  };
  const defaultBeta = (km: number | null): number => {
    if (km === null) return C.TRANSFER_BETA_UNKNOWN;
    for (const row of C.TRANSFER_BETA) if (km >= row.minWeeklyKm) return row.beta;
    return C.TRANSFER_BETA_UNKNOWN;
  };
  /** Rezultati pre prenosa (bez hodanja i vrućine), za lični β. */
  const rawResults: { day: number; distanceM: Meters; vdot: Vdot }[] = [];
  const personalBetaAt = (d: number): number | null => {
    const pool = rawResults.filter((x) => x.day <= d && d - x.day < C.PERSONAL_BETA_DAYS);
    if (pool.length < 2) return null;
    const long = pool.reduce((a, x) => (x.distanceM > a.distanceM ? x : a));
    const short = pool.reduce((a, x) => (x.distanceM < a.distanceM ? x : a));
    if (long.distanceM / short.distanceM < C.PERSONAL_BETA_MIN_RATIO) return null;
    return clamp(
      (short.vdot - long.vdot) / Math.log(long.distanceM / short.distanceM),
      0,
      C.PERSONAL_BETA_MAX
    );
  };
  /** Prelom lične krive: dužina poslednjeg rezultata (unet rezultat, trka, test); bez njih dužina cilja. */
  let anchorM: Meters = goal.distanceM;
  let anchorFromProfile = false;
  /** R18: prelom je na rezultatu iz istorije (trka/test). */
  let anchorFromResult = false;
  /** Lična kriva na dan `d` (F4-K2): β po obimu ili lični, prelom na poslednjem rezultatu. */
  const curveAt = (d: number): { curve: Transfer; weeklyKm: number | null } => {
    const weeklyKm = weeklyKmAt(d);
    const personal = personalBetaAt(d);
    const def = defaultBeta(weeklyKm);
    const beta =
      personal === null
        ? def
        : C.PERSONAL_BETA_SHARE * personal + (1 - C.PERSONAL_BETA_SHARE) * def;
    /* prelom na unetom rezultatu bez ijednog rezultata iz istorije: granica naniže (F4-K2) */
    const capDown = anchorFromProfile;
    const zoneCapDown = anchorFromResult && !anchorFromProfile && personal === null;
    return {
      curve: {
        beta,
        personal: personal !== null,
        refM: goal.distanceM,
        anchorM,
        ...(capDown ? { capDown } : {}),
        ...(zoneCapDown ? { zoneCapDown } : {})
      },
      weeklyKm
    };
  };
  /** Prevod dokaza sa `fromM` na dužinu cilja: `loss` = koliko je VDOT na `fromM` viši od VDOT-a na cilju po
      krivi. Postojeći plan: njegova kriva (tempo punog napora je zadat po njoj — „kao planirano" = bez promene). */
  const transferAt = (
    fromM: Meters,
    d: number,
    /** VDOT dokaza (za granice dužine krive). */
    at: Vdot
  ): { loss: number; beta: number; weeklyKm: number | null; personal: boolean } => {
    const own = curveAt(d);
    const curve = planned?.transfer ?? own.curve;
    /* R18 (stavka 2): dokaz sa DUŽE trke (više od 2× cilja) na kraći cilj — jednak VDOT (Daniels/Riegel), bez
       dodatka krive za kraću dužinu: polumaraton 1:42:30 nije 10 km za 45:30 nego ≈ 46:15 */
    const longer = fromM > goal.distanceM * C.SAME_DISTANCE_MAX;
    return {
      loss: longer ? 0 : vdotAt(at, fromM, curve) - at,
      beta: curve.beta,
      weeklyKm: own.weeklyKm,
      personal: curve.personal
    };
  };
  const sameDistance = (m: Meters): boolean =>
    m >= C.SAME_DISTANCE_MIN * goal.distanceM && m <= C.SAME_DISTANCE_MAX * goal.distanceM;

  const init0 = startingPoint(facts, runs);
  const profileResult = facts.profile.recentResult;
  /* Unet rezultat bez datuma važi „pre svih trčanja": β iz izjavljenog obima, ne iz trčanja koja tek pristižu
     (inače bi se polazna procena menjala sa svakim novim trčanjem). */
  const profileDay =
    profileResult?.date !== undefined
      ? Math.min(dayNum(profileResult.date), today)
      : Math.min(firstRunAt, today + 1) - 1;
  if (init0.source === 'rezultat' && profileResult !== undefined) {
    rawResults.push({ day: profileDay, distanceM: profileResult.distanceM, vdot: init0.vdot });
  }
  if (init0.source === 'rezultat' && profileResult !== undefined) {
    anchorM = profileResult.distanceM;
    anchorFromProfile = true;
  }
  const init =
    init0.source === 'rezultat' && profileResult !== undefined
      ? {
          ...init0,
          vdot:
            2 * init0.vdot - vdotAt(init0.vdot, profileResult.distanceM, curveAt(profileDay).curve)
        }
      : init0;
  let vdot = init.vdot;
  let preFirstVdot = init.vdot;
  const pauses = pauseSpans(facts, runs, today);
  const firstDay = Math.min(
    runs[0] !== undefined ? dayNum(runs[0].date) : today,
    ...pauses.map((p) => dayNum(p.to) + 1)
  );
  const startDay = Math.min(firstDay, today);

  /** Trke i testovi; `strong` = nije prvi rezultat i nije trka sa hodanjem (R14: samo takav daje „visoku"). */
  const results: {
    day: number;
    strong: boolean;
    vdot: Vdot;
    weak?: boolean;
    race?: boolean;
    /** Dokaz dužine 0,5–2 × cilja (F4-K2: samo takav daje „visoku" i ne dobija σ druge dužine). */
    inRange?: boolean;
  }[] = [];
  const qualityDays: number[] = [];
  /** Dani primenjenog trenda pulsa: za pouzdanost vrede kao dokaz kvaliteta (§ 2.4 „bez pulsa niža pouzdanost"). */
  const hrDays: number[] = [];
  const qualityMoves: { day: number; delta: number }[] = [];
  const snapshots: { day: number; vdot: Vdot }[] = [];
  let lastHrDay = Number.NEGATIVE_INFINITY;
  const profileResultDay =
    facts.profile.recentResult?.date !== undefined ? dayNum(facts.profile.recentResult.date) : null;

  const confidenceAt = (d: number): Confidence => {
    /* Z6 (krug 7): „visoka" tek posle dva SAGLASNA rezultata (unet rezultat se računa) u prozoru visoke pouzdanosti */
    const recent = results.filter((x) => x.day <= d && d - x.day <= C.CONF_HIGH_DAYS && !x.weak);
    const pool = [
      ...recent.map((x) => x.vdot),
      ...(init.source === 'rezultat' &&
      profileResultDay !== null &&
      d - profileResultDay <= C.CONF_HIGH_DAYS
        ? [init.vdot]
        : [])
    ];
    const last = recent.at(-1);
    if (
      last !== undefined &&
      last.strong &&
      last.inRange !== false &&
      pool.length >= 2 &&
      pool.filter((v) => Math.abs(v - last.vdot) <= C.CONF_AGREE_SHARE * last.vdot).length >= 2
    )
      return 'visoka';
    if (results.some((x) => d - x.day <= C.CONF_MID_DAYS)) return 'srednja';
    const evidence = [...qualityDays, ...hrDays].filter(
      (x) => d - x < C.CONF_MID_QUALITY_DAYS
    ).length;
    if (evidence >= C.CONF_MID_QUALITY) return 'srednja';
    if (
      init.source === 'rezultat' &&
      profileResultDay !== null &&
      d - profileResultDay <= C.CONF_MID_DAYS
    ) {
      return 'srednja';
    }
    return 'niska';
  };

  const startConfidence = confidenceAt(startDay);
  const history: FormChange[] = [
    {
      date: isoOf(startDay),
      signal: 'izjava',
      before: r2(init.vdot),
      after: r2(init.vdot),
      reason: explainStart(init.source, init.vdot, goalM)
    }
  ];
  const record = (
    c: Omit<FormChange, 'before' | 'after'>,
    before: Vdot,
    after: Vdot,
    force = false
  ): void => {
    if (force || Math.abs(after - before) >= C.CHANGE_MIN)
      history.push({ ...c, before: r2(before), after: r2(after) });
  };

  const pauseEnds = new Map<number, PauseSpan>();
  for (const p of pauses) pauseEnds.set(Math.min(dayNum(p.to) + 1, today), p);
  const runsByDay = new Map<number, FitnessRun[]>();
  for (const r of runs) {
    const d = dayNum(r.date);
    const list = runsByDay.get(d) ?? [];
    list.push(r);
    runsByDay.set(d, list);
  }

  /* plafon napretka: stopa i najviše (§ 7.5, § 14.6) — potrebni već u petlji (R12) */
  const tenure = tenureOf(facts);
  const baseCeiling = C.CEILING[tenure];
  const window = C.NO_QUALITY_WEEKS * 7;
  const qualityRunDays = runs
    .filter(
      (r) =>
        (r.laps ?? []).some((l) => l.role === 'work') ||
        (r.planned !== undefined && isQualityZone(r.planned.zone))
    )
    .map((r) => dayNum(r.date));
  /** § 14.6: 12 nedelja istorije bez ijednog bržeg treninga → `r × 1,25`, `G_max + 0,5`. Računa se za svaki dan
      posebno, da uključenje ne menja prošlost (i dobija rečenicu tog dana). */
  const noQualityOn = (d: number): boolean =>
    runs[0] !== undefined &&
    d - dayNum(runs[0].date) >= window &&
    !qualityRunDays.some((x) => x > d - window && x <= d);
  const ceilingOn = (d: number): { rate: number; max: number } =>
    noQualityOn(d)
      ? {
          rate: baseCeiling.rate * C.NO_QUALITY_RATE,
          max: baseCeiling.max + C.NO_QUALITY_MAX_ADD
        }
      : baseCeiling;
  const { rate, max } = ceilingOn(today);
  let fv = 1;
  if (planned !== null && planned.baseLoad > 0) {
    const ratio = clamp(planned.peakLoad / planned.baseLoad, 1, C.VOLUME_RATIO_MAX);
    fv = C.VOLUME_F_MIN + (C.VOLUME_F_SPAN * (ratio - 1)) / (C.VOLUME_RATIO_MAX - 1);
  }
  const raceDay = dayNum(goal.raceDate);

  /* baza (R12, R13): dnevna opterećenja po pragu tekuće forme; seme iz izjave ili proseka prvih 28 dana */
  const dayLoad = (d: number, v: Vdot): number => {
    const threshold = paceAtShare(
      zoneVdot(v, 'T', planned?.transfer ?? curveAt(d).curve),
      ZONE_SHARE.T
    );
    return (runsByDay.get(d) ?? []).reduce((a, r) => a + runLoad(r, threshold), 0);
  };
  const firstRunDay = runs[0] !== undefined ? dayNum(runs[0].date) : today;
  let seed = 0;
  if (facts.profile.weeklyKm !== undefined && facts.profile.weeklyKm > 0) {
    seed = (facts.profile.weeklyKm * paceAtShare(init.vdot, ZONE_SHARE.E)) / 60 / 7;
  } else if (runs.length > 0) {
    const last = Math.min(today, firstRunDay + C.LOAD_SEED_DAYS - 1);
    let total = 0;
    for (let d = firstRunDay; d <= last; d += 1) total += dayLoad(d, init.vdot);
    seed = total / (last - firstRunDay + 1);
  }
  let chronic = seed;
  const chronicByDay = new Map<number, number>();
  const loadByDay = new Map<number, number>();
  const chronicAt = (d: number): number => chronicByDay.get(d) ?? seed;
  const targets = (planned?.weeks ?? [])
    .map((w) => ({ start: dayNum(w.start), daily: w.targetLoad / 7 }))
    .filter((w) => Number.isFinite(w.start) && w.daily >= 0);
  /** Sa ciljevima nedelja: pripisuje se tek od prvog dana plana (dani pre plana nisu „planirani"). */
  const planStart =
    targets.length > 0 ? Math.min(...targets.map((w) => w.start)) : Number.NEGATIVE_INFINITY;
  const plannedOn = (d: number): number | null => {
    for (const w of targets) if (d >= w.start && d < w.start + 7) return w.daily;
    return null;
  };

  /* R12: pripisano od poslednje trke/testa (u jedinicama plafona `G`) i zbir nedelje za objašnjenje */
  let credited = 0;
  /* E8 (krug 5): pripisani napredak odrađenog plana — ide samo u OČEKIVANO vreme na dan trke, ne u trenutnu procenu */
  let planVdot = 0;
  /** R18 (stavka 2): deo `planVdot` zadržan rezultatom (M17) — nivo koji je rezultat pokazao, ne dodatak budućem. */
  let retained = 0;
  let week = { from: startDay, provisional: 0, done: 0, ref: 0, days: 0 };
  let lastResultDay = Number.NEGATIVE_INFINITY;
  /** „Planirano" za dan bez ciljeva plana: 7 × najveća baza u 6 nedelja pre (bez samoreferentnog pada). */
  const referenceOn = (x: number): number => {
    const target = plannedOn(x);
    if (target !== null) return target;
    let best = 0;
    for (let y = x - C.BASE_DROP_DAYS; y <= x - C.PLAN_REFERENCE_LAG_DAYS; y += 1) {
      best = Math.max(best, chronicAt(y));
    }
    return best;
  };
  /* R13: već primenjen pad zbog niske baze (udeo) */
  let baseDropApplied = 0;
  let lastPauseDay = Number.NEGATIVE_INFINITY;

  for (let d = startDay; d <= today; d += 1) {
    /* 1. pauza koja se završila juče (ili traje do danas) */
    const pause = pauseEnds.get(d);
    if (pause !== undefined) {
      const loss = Math.min(
        C.PAUSE_MAX_LOSS,
        C.PAUSE_DAILY_LOSS * (pause.days - C.PAUSE_FREE_DAYS)
      );
      const before = vdot;
      vdot = vdot * (1 - loss);
      lastPauseDay = d;
      record(
        {
          date: isoOf(d),
          signal: 'pauza',
          reason: explainPause(pause.from, pause.to, pause.days, before, vdot, goalM)
        },
        before,
        vdot
      );
    }
    /* 2. trčanja tog dana */
    for (const run of runsByDay.get(d) ?? []) {
      const kind = resultKind(run);
      if (kind !== null) {
        /* K1 (krug 3): rezultat je deonica punog napora, ne cela aktivnost sa zagrevanjem i hlađenjem. */
        const result = effortResult(run);
        if (result === null) {
          record(
            {
              date: run.date,
              signal: kind,
              runId: run.id,
              ignored: true,
              reason: explainUnusable(kind, run.date, run.distanceM, run.plannedEffortM ?? 0)
            },
            vdot,
            vdot,
            true
          );
          continue;
        }
        const whole = result.distanceM === run.distanceM && result.durationSec === run.durationSec;
        const { splits: _splits, ...bare } = run;
        const scored: FitnessRun = whole
          ? run
          : { ...bare, distanceM: result.distanceM, durationSec: result.durationSec };
        const ev = resultEvidence(scored);
        if (!ev.walking && !ev.hot) {
          rawResults.push({ day: d, distanceM: scored.distanceM, vdot: ev.vdot });
        }
        const transfer = transferAt(scored.distanceM, d, ev.vdot);
        /** Dokaz preveden na dužinu cilja (F4-K2). */
        const target = ev.vdot - transfer.loss;
        const inRange = sameDistance(scored.distanceM);
        const firstInApp = results.length === 0;
        if (firstInApp) preFirstVdot = vdot;
        /* Prvi rezultat zamenjuje procenu bez osnova (iz laganog tempa, trčanja ili opštu): k = 1 (R14). */
        const first = firstInApp && init.source !== 'rezultat';
        const low = confidenceAt(d) === 'niska';
        let k = low || first ? C.K_LOW_CONFIDENCE : kind === 'trka' ? C.K_RACE : C.K_TEST;
        const before = vdot;
        let next = vdot + k * (target - vdot);
        /* A16 (krug 9): trka na dužini cilja se usvaja 100 % — današnja forma nije sporija od te trke */
        if (
          kind === 'trka' &&
          !ev.walking &&
          !ev.hot &&
          Math.abs(scored.distanceM - goalM) <= C.GOAL_RACE_SAME_SHARE * goalM &&
          target > next
        ) {
          next = target;
          k = 1;
        }
        /* Toplo (≥ 25 °C): dužina 0,5–2 × cilja se nikad ne odbacuje — spušta upola; druga dužina je donja granica. */
        const hotHeld = ev.hot && !low && !first && next < vdot;
        if (hotHeld) next = inRange ? vdot + k * C.HOT_LOWER_K_SHARE * (target - vdot) : vdot;
        /* R18 (stavka 7, M19): slabiji rezultat u 4 nedelje posle bola (nivo ≥ 4) ili kraja pauze nije pun pad forme —
           spušta upola (trka posle bola meri i oporavak, ne samo formu); samo rezultat sa druge dužine */
        const afterBreak =
          facts.pain.some(
            (p) => p.level >= 4 && d >= dayNum(p.date) && d - dayNum(p.date) <= C.AFTER_BREAK_DAYS
          ) ||
          pauses.some((p) => d > dayNum(p.to) && d - dayNum(p.to) <= C.AFTER_BREAK_DAYS);
        /* trka na dužini cilja ostaje mera (A14: zone ne brže od nje) */
        if (!hotHeld && afterBreak && !inRange && !low && !first && next < vdot)
          next = vdot + C.HOT_LOWER_K_SHARE * (next - vdot);
        vdot = next;
        /* R14: prvi rezultat U APLIKACIJI (unet rezultat ne računa) i trka sa hodanjem — najviše srednja. */
        results.push({
          day: d,
          strong: !firstInApp && !ev.walking,
          vdot: target,
          race: kind === 'trka',
          inRange
        });
        lastResultDay = d;
        anchorM = scored.distanceM;
        anchorFromProfile = false;
        anchorFromResult = true;
        credited = 0;
        /* Z4 (krug 7): rezultat bar onoliko dobar koliko se verovalo (forma + pripisani napredak) ne spušta verovanu
           formu — ostatak pripisanog napretka ostaje; slabiji rezultat ga briše */
        /* M17 (krug 14): rezultat bolji od dosadašnje procene (ali slabiji od verovanog) zadržava pripisani napredak do
           nivoa koji je rezultat pokazao — bolji rezultat ne usporava prognozu dana trke */
        const believed = before + planVdot;
        planVdot = target > before ? Math.max(0, Math.min(believed, target) - vdot) : 0;
        retained = planVdot;
        week = { from: d + 1, provisional: 0, done: 0, ref: 0, days: 0 };
        baseDropApplied = 0;
        record(
          {
            date: run.date,
            signal: kind,
            runId: run.id,
            reason: explainResult(
              kind,
              run.date,
              scored.distanceM,
              scored.durationSec,
              ev,
              {
                k,
                first,
                target,
                inRange,
                hotHeld,
                transferLoss: transfer.loss,
                weeklyKm: transfer.weeklyKm,
                personalBeta: transfer.personal
              },
              before,
              vdot,
              goalM
            )
          },
          before,
          vdot,
          /* toplota i prenos uvek dobijaju rečenicu, i kad se procena ne pomeri */
          ev.hot || Math.abs(transfer.loss) >= C.CHANGE_MIN
        );
        continue;
      }
      const q = qualityEvidence(run, vdot, goalM, planned?.transfer ?? curveAt(d).curve);
      if (q === null) continue;
      qualityDays.push(d);
      let delta = clamp(C.K_QUALITY * (q.vdot - vdot), -C.QUALITY_MAX_STEP, C.QUALITY_MAX_STEP);
      const recent = qualityMoves.filter((m) => d - m.day < C.QUALITY_WINDOW_DAYS);
      const up = recent.filter((m) => m.delta > 0).reduce((a, m) => a + m.delta, 0);
      const down = recent.filter((m) => m.delta < 0).reduce((a, m) => a + m.delta, 0);
      delta =
        delta > 0
          ? Math.min(delta, C.QUALITY_WINDOW_MAX - up)
          : Math.max(delta, -C.QUALITY_WINDOW_MAX - down);
      if (Math.abs(delta) < 1e-9) continue;
      qualityMoves.push({ day: d, delta });
      const before = vdot;
      vdot += delta;
      record(
        {
          date: run.date,
          signal: 'kvalitet',
          runId: run.id,
          reason: explainQuality(run.date, q.held, before, vdot, goalM)
        },
        before,
        vdot
      );
    }
    /* 3. baza tog dana */
    const load = dayLoad(d, vdot);
    loadByDay.set(d, load);
    chronic = rollChronic(chronic, load);
    chronicByDay.set(d, chronic);

    if (noQualityOn(d) && !noQualityOn(d - 1)) {
      record(
        { date: isoOf(d), signal: 'plan', reason: explainNoQuality(d - window + 1, d) },
        vdot,
        vdot,
        true
      );
    }
    /* 4. R12 — odrađen plan: dan u 16 nedelja pred trku se pripisuje unapred (kao da je odrađen); na kraju
       kalendarske nedelje se ispravlja po stvarnom pridržavanju te nedelje (opterećenje / planirano). Tako se
       očekivano vreme ne pomera usred nedelje, a manjak dobija rečenicu na dan kad se utvrdi. */
    const toRace = raceDay - d;
    /* F4-K2: bez plana (`planned` null) nema pripisivanja ni rečenica o „% planiranog" */
    if (
      planned !== null &&
      toRace >= 7 &&
      toRace < 7 * (C.WEEKS_MAX + 1) &&
      d > lastResultDay &&
      d >= planStart
    ) {
      const ceil = ceilingOn(d);
      /* Mogući napredak po nedelji (bez `f_p`, da pripisano ne hrani samo sebe). */
      const take = Math.min((ceil.rate * fv) / 7, Math.max(0, ceil.max - credited));
      credited += take;
      planVdot += C.EXPECTED_SHARE * take;
      week.provisional += take;
      week.done += loadByDay.get(d) ?? 0;
      week.ref += referenceOn(d);
      week.days += 1;
    }
    /* 5. R13 — pad baze: nedeljom i danas, uz ≥ 42 dana istorije i bez pauze u prozoru */
    if (
      (weekday(d) === 6 || d === today) &&
      d - firstRunDay >= C.BASE_DROP_DAYS &&
      d - lastPauseDay > C.BASE_DROP_DAYS &&
      !pauses.some((p) => dayNum(p.to) > d - C.BASE_DROP_DAYS && dayNum(p.from) <= d)
    ) {
      const past = chronicAt(d - C.BASE_DROP_DAYS);
      const ratio = past > 0 ? chronic / past : 1;
      if (ratio <= C.BASE_DROP_RATIO) {
        const loss = Math.min(
          C.BASE_DROP_LOSS_MAX,
          C.BASE_DROP_LOSS_MIN + C.BASE_DROP_LOSS_SLOPE * (C.BASE_DROP_RATIO - ratio)
        );
        if (loss > baseDropApplied + 1e-6) {
          const before = vdot;
          vdot = (vdot * (1 - loss)) / (1 - baseDropApplied);
          baseDropApplied = loss;
          record(
            {
              date: isoOf(d),
              signal: 'baza',
              reason: explainBaseDrop(ratio, before, vdot, goalM)
            },
            before,
            vdot
          );
        }
      } else {
        baseDropApplied = 0;
      }
    }

    /* 6. trend pulsa: nedeljom i danas, najviše jednom u 14 dana */
    if ((weekday(d) === 6 || d === today) && d - lastHrDay >= C.HR_EVERY_DAYS) {
      const hr = hrTrend(runs, d, vdot);
      if (hr !== null) {
        const trend = hr.trend;
        lastHrDay = d;
        hrDays.push(d);
        /* Dokaz se meri od procene na kraju prve dve nedelje trenda: isti trend se ne broji dvaput. */
        const base = [...snapshots].reverse().find((s) => s.day <= hr.baseDay)?.vdot ?? init.vdot;
        const evidence = base + trend * 100 * C.HR_VDOT_PER_PCT;
        const delta = clamp(C.K_HR * (evidence - vdot), -C.HR_MAX_STEP, C.HR_MAX_STEP);
        const before = vdot;
        vdot += delta;
        record(
          {
            date: isoOf(d),
            signal: 'trend-pulsa',
            reason: explainHeartRate(isoOf(d), trend, before, vdot, goalM)
          },
          before,
          vdot
        );
      }
    }

    /* 7. kraj nedelje: ispravka pripisanog po pridržavanju i jedna rečenica (R12). Tekuća nedelja ostaje
       pripisana unapred dok se ne završi. */
    if (weekday(d) === 6 && week.days > 0) {
      const share = week.ref > 0 ? week.done / week.ref : 1;
      const af = clamp(
        (share - C.PLAN_ADHERENCE_NONE) / (C.PLAN_ADHERENCE_FULL - C.PLAN_ADHERENCE_NONE),
        0,
        1
      );
      const giveBack = week.provisional * (1 - af);
      const before = vdot + planVdot - C.EXPECTED_SHARE * week.provisional;
      credited -= giveBack;
      planVdot -= C.EXPECTED_SHARE * giveBack;
      const expected = vdot + planVdot;
      const lost =
        raceTimeSec(expected, goalM) - raceTimeSec(expected + C.EXPECTED_SHARE * giveBack, goalM);
      /* Bez ijednog trčanja u istoriji (nov korisnik na dan nastanka plana) nema šta da se „ne odradi":
         rečenica o neodrađenoj nedelji bi bila šum u zaglavlju plana (krug 3). */
      /* Nedelja pre početka plana ili bez ijednog planiranog boda ne dobija rečenicu; raspon je uvek pon–ned. */
      const judged = week.ref > 0 && !(targets.length > 0 && d < planStart);
      const monday = isoOf(d - 6);
      if (af < 1 && giveBack > 0 && runs.length > 0 && judged) {
        record(
          {
            date: isoOf(d),
            signal: 'plan',
            reason: explainPlanShortfall(monday, isoOf(d), share, lost, before, expected, goalM)
          },
          before,
          expected,
          true
        );
      } else if (expected - before >= C.CHANGE_MIN) {
        record(
          {
            date: isoOf(d),
            signal: 'plan',
            reason: explainPlanWeek(monday, isoOf(d), share, before, expected, goalM)
          },
          before,
          expected
        );
      }
    }
    if (weekday(d) === 6) week = { from: d + 1, provisional: 0, done: 0, ref: 0, days: 0 };
    snapshots.push({ day: d, vdot });
  }

  const confidence = confidenceAt(today);
  const point = (v: Vdot, day: number, conf: Confidence): FormPoint => ({
    vdot: r2(v),
    raceTimeSec: Math.round(raceTimeSec(v, goalM)),
    asOf: isoOf(day),
    confidence: conf
  });

  let fp = 1;
  const from = today - C.PROGRESS_WEEKS * 7;
  const resultsIn = results.filter((x) => x.day > from).length;
  const qualityIn = qualityDays.filter((x) => x > from).length;
  if (resultsIn >= C.PROGRESS_MIN_RESULTS || qualityIn >= C.PROGRESS_MIN_QUALITY) {
    const past = [...snapshots].reverse().find((s) => s.day <= from)?.vdot ?? init.vdot;
    const slope = (vdot - past) / C.PROGRESS_WEEKS;
    fp = clamp(0.5 + (0.5 * slope) / rate, C.PROGRESS_F_MIN, C.PROGRESS_F_MAX);
  }
  /* `W` neprekidno (dani / 7), da se smanjuje dan po dan, kao i pripisano (R12). */
  const w = clamp((raceDay - today) / 7 - 1, 0, C.WEEKS_MAX);
  const gain = Math.min(rate * fv * fp * w, Math.max(0, max - credited));
  /* F4-K2: σ + 1,0 kad je glavni dokaz (poslednji rezultat ili unet rezultat) sa druge dužine */
  const lastResult = results.at(-1);
  const mainOther =
    lastResult !== undefined
      ? lastResult.inRange === false
      : init.source === 'rezultat' &&
        profileResult !== undefined &&
        !sameDistance(profileResult.distanceM);
  const sigma = C.SIGMA[confidence] + (mainOther ? C.SIGMA_OTHER_DISTANCE : 0);
  /* Z4 (krug 7): prvi rezultat koji je zamenio procenu niske pouzdanosti još ne otvara pun očekivani napredak (potvrda
     forme ne pomera prognozu > 1 %; s24) — dok ga ne potvrdi drugi rezultat */
  const firstOnly =
    results.length === 1 && init.source !== 'rezultat' && startConfidence === 'niska';

  return {
    start: point(init.vdot, startDay, startConfidence),
    current: point(vdot, today, confidence),
    /* Z4 (krug 7): prvi rezultat koji je zamenio procenu bez osnova još ne otvara pun očekivani napredak (potvrda
       forme ne pomera prognozu > 1 %; s24) — kao niska pouzdanost, dok ga ne potvrdi drugi rezultat */
    /* R18 (stavka 2): nivo koji je rezultat pokazao (M17) i budući napredak se preklapaju — prognoza nije ispod
       rezultata, a očekivani napredak ne raste kako trka prilazi (10 km s03: 1:36 za 6 nedelja posle 1:41 za 18) */
    raceDay: raceDayRange(
      vdot,
      planVdot - Math.min(retained, C.EXPECTED_SHARE * gain),
      gain,
      sigma,
      firstOnly ? 'niska' : confidence,
      goalM,
      firstOnly ? Math.max(vdot, preFirstVdot) : vdot,
      /* prva trka u životu: bez unetog rezultata, jedina trka i najviše jedan raniji rezultat */
      init.source !== 'rezultat' &&
        results.filter((x) => x.race === true).length === 1 &&
        results.length <= 2
        ? C.FIRST_RESULT_MIN_RANGE
        : 0
    ),
    ceilingGain: r2(gain),
    history,
    /* F4-K2: lična kriva forme po dužini za tempa i pun napor u planu; A14: granice iz stvarnih rezultata */
    transfer: withUp(
      withLimits(curveAt(today).curve, rawResults, today),
      rawResults.some((x) => x.day <= today && x.distanceM <= C.UP_EVIDENCE_MAX_M) ||
        qualityDays.some((x) => x <= today),
      tenureOf(facts) === 'pocetnik' ||
        ((weeklyKmAt(today) ?? Number.POSITIVE_INFINITY) < C.UP_LOW_VOLUME_KM &&
          vdot >= C.UP_HIGH_FORM_VDOT)
    )
  };
}

/** A7 (krug 9): bez ličnog β i bez dokaza na kraćoj dužini prenos naviše je mali i ograničen (početnik/mali obim uz
    visoku formu: 0). */
function withUp(curve: Transfer, evidence: boolean, none: boolean): Transfer {
  if (curve.personal || evidence) return curve;
  return {
    ...curve,
    up: { beta: none ? 0 : C.UP_BETA_NO_EVIDENCE, maxSec: none ? 0 : C.UP_MAX_SEC_NO_EVIDENCE }
  };
}

/** A14 (krug 9): granice zona iz stvarnih rezultata poslednjih `ZONE_LIMIT_DAYS` dana (sirovi VDOT, bez prevoda). */
function withLimits(
  curve: Transfer,
  raw: readonly { day: number; distanceM: Meters; vdot: Vdot }[],
  today: number
): Transfer {
  /* samo rezultati KRAĆI od dužine cilja: duža trka nije granica za brže zone (bez kraćeg rezultata važi A7) */
  const recent = raw.filter(
    (x) => x.day <= today && today - x.day <= ZONE_LIMIT_DAYS && x.distanceM < curve.refM - 1
  );
  if (recent.length === 0) return curve;
  let maxVdot = 0;
  let tFloor = 0;
  let iFloor = 0;
  for (const x of recent) {
    maxVdot = Math.max(maxVdot, x.vdot);
    const sec = raceTimeSec(x.vdot, x.distanceM);
    const pace = (sec / x.distanceM) * 1000;
    if (sec >= ZONE_LIMIT_T_MIN_SEC && sec <= ZONE_LIMIT_T_MAX_SEC) tFloor = Math.max(tFloor, pace);
    if (sec <= ZONE_LIMIT_I_MAX_SEC) iFloor = Math.max(iFloor, pace);
  }
  return {
    ...curve,
    limits: {
      maxVdot,
      ...(tFloor > 0 ? { tFloor } : {}),
      ...(iFloor > 0 ? { iFloor } : {})
    }
  };
}

/** Raspon na dan trke (E8, krug 5): očekivanje uključuje pripisani i planirani napredak; uz pouzdanost „niska"
    sredina raspona nije više od 1 % brža od trenutne procene. */
function raceDayRange(
  vdot: Vdot,
  planVdot: number,
  gain: number,
  sigma: number,
  confidence: Confidence,
  goalM: number,
  /** Merilo ograničenja napretka pri niskoj pouzdanosti (Z4: posle prve potvrde bolje od dva stanja). */
  capVdot: Vdot = vdot,
  /** Najmanji raspon kao deo očekivanog (Z6: prva trka u životu). */
  minRange = 0
): { lowSec: number; expectedSec: number; highSec: number } {
  let expected = raceTimeSec(vdot + planVdot + C.EXPECTED_SHARE * gain, goalM);
  if (confidence === 'niska')
    expected = Math.max(expected, raceTimeSec(capVdot, goalM) * (1 - C.LOW_CONFIDENCE_MAX_GAIN));
  let low = Math.min(expected, raceTimeSec(vdot + planVdot + gain + sigma / 2, goalM));
  let high = Math.max(expected, raceTimeSec(vdot - sigma / 2, goalM));
  /* Z6 (krug 7): prva trka u životu (prvi rezultat bez unetog) — raspon bar ± 2 % */
  if (minRange > 0) {
    low = Math.min(low, expected * (1 - minRange));
    high = Math.max(high, expected * (1 + minRange));
  }
  return {
    lowSec: Math.round(low),
    expectedSec: Math.round(expected),
    highSec: Math.round(high)
  };
}

/** § 7.4: trend mere `e` kroz poslednjih 8 kalendarskih nedelja do dana `d`; `null` kad nema dovoljno ili < 2 %.
    `baseDay` = poslednji dan druge od prve dve nedelje (od tada se meri dokaz). */
export function hrTrend(
  runs: readonly FitnessRun[],
  d: number,
  vdot: Vdot
): { trend: number; baseDay: number } | null {
  const weekStart = d - weekday(d);
  const firstWeek = weekStart - (C.HR_WINDOW_WEEKS - 1) * 7;
  const byWeek = new Map<number, number[]>();
  for (const r of runs) {
    const day = dayNum(r.date);
    if (day < firstWeek || day > d) continue;
    const e = hrEfficiency(r, vdot);
    if (e === null) continue;
    const wk = day - weekday(day);
    const list = byWeek.get(wk) ?? [];
    list.push(e);
    byWeek.set(wk, list);
  }
  const qualifying = [...byWeek.entries()]
    .filter(([, xs]) => xs.length >= C.HR_MIN_RUNS_PER_WEEK)
    .sort((a, b) => a[0] - b[0]);
  const weekly = qualifying.map(([, xs]) => median(xs));
  if (weekly.length < C.HR_MIN_WEEKS) return null;
  const firstTwo = median(weekly.slice(0, 2));
  const lastTwo = median(weekly.slice(-2));
  if (firstTwo <= 0) return null;
  const trend = lastTwo / firstTwo - 1;
  const baseDay = (qualifying[1]?.[0] ?? weekStart) + 6;
  return Math.abs(trend) >= C.HR_MIN_TREND ? { trend, baseDay } : null;
}
