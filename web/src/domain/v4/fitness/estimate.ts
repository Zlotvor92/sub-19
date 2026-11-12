/* V4 — FORMA IZ TRČANJA (SPEC § 7, § 14.3, § 14.6; AGENTS V4 t. 9a).
   Čista funkcija: ista trčanja → ista procena; ulaz se ne menja. Trčanja se obrađuju hronološki, dan po dan;
   svaka promena je zapis `FormChange` sa rečenicom „zašto". */
import { DEFAULT_VDOT, EASY_FAST_SHARE, ZONE_SHARE } from '../engine/constants';
import type {
  Confidence,
  FormChange,
  FormEstimate,
  FormPoint,
  IsoDate,
  LoadPoints,
  Meters,
  SecPerKm,
  Vdot,
  ZoneId
} from '../engine/types';
import {
  paceAtShare,
  racePace,
  raceTimeSec,
  vdotFromEasyPace,
  vdotFromResult,
  vo2AtSpeed
} from '../engine/vdot';
import * as C from './constants';
import {
  explainHeartRate,
  explainPause,
  explainQuality,
  explainResult,
  explainStart
} from './explain';
import type { FitnessFacts, FitnessRun, PauseSpan, ResultEvidence, Tenure } from './types';

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
  if (r.effort === 'race' && r.distanceM >= C.RACE_MIN_M) return 'trka';
  if (r.effort === 'test' && r.distanceM >= C.TEST_MIN_M) return 'test';
  return null;
}

/** VDOT rezultata + oprezna korekcija za izrazito negativan split; toplota samo označava (F4-REPORT). */
export function resultEvidence(r: FitnessRun): ResultEvidence {
  const rawVdot = vdotFromResult(r.distanceM, r.durationSec);
  let splitBonus = 0;
  const splits = r.splits ?? [];
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
  const hot = r.tempC !== undefined && r.tempC >= C.HOT_FROM_C;
  return { vdot: rawVdot + splitBonus, rawVdot, splitBonus, hot };
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
export function qualityEvidence(r: FitnessRun, old: Vdot, goalM: Meters): QualityEvidence | null {
  if (!usableForForm(r) || r.effort !== undefined || r.planned === undefined) return null;
  if (!isQualityZone(r.planned.zone)) return null;
  const work = (r.laps ?? []).filter(
    (l) => l.role === 'work' && l.distanceM > 0 && l.durationSec > 0
  );
  if (work.length === 0) return null;
  const workSec = work.reduce((a, l) => a + l.durationSec, 0);
  const workM = work.reduce((a, l) => a + l.distanceM, 0);
  const pr = (workSec / workM) * 1000;
  const pc = zonePace(r.planned.zone, old, goalM);
  const done = workSec >= C.QUALITY_DONE_SHARE * r.planned.workSec;
  const atPace = vdotForZonePace(r.planned.zone, pr, goalM);
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

interface Planned {
  baseLoad: LoadPoints;
  peakLoad: LoadPoints;
}

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
     (70 % VO2max): rekreativci lagano često trče brže od 66 %, pa bi 66 % precenilo formu (odluka F4, § 2.4). */
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
      return { vdot: vo2AtSpeed(60000 / median(paces)) / EASY_FAST_SHARE, source: 'trcanja' };
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
  planned: Planned | null
): FormEstimate {
  const today = dayNum(facts.today);
  const goalM = goal.distanceM;
  const runs = facts.runs
    .filter((r) => validRun(r, today))
    .slice()
    .sort((a, b) => dayNum(a.date) - dayNum(b.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const init = startingPoint(facts, runs);
  let vdot = init.vdot;
  const pauses = pauseSpans(facts, runs, today);
  const firstDay = Math.min(
    runs[0] !== undefined ? dayNum(runs[0].date) : today,
    ...pauses.map((p) => dayNum(p.to) + 1)
  );
  const startDay = Math.min(firstDay, today);

  const resultDays: number[] = [];
  const qualityDays: number[] = [];
  /** Dani primenjenog trenda pulsa: za pouzdanost vrede kao dokaz kvaliteta (§ 2.4 „bez pulsa niža pouzdanost"). */
  const hrDays: number[] = [];
  const qualityMoves: { day: number; delta: number }[] = [];
  const snapshots: { day: number; vdot: Vdot }[] = [];
  let lastHrDay = Number.NEGATIVE_INFINITY;
  const profileResultDay =
    facts.profile.recentResult?.date !== undefined ? dayNum(facts.profile.recentResult.date) : null;

  const confidenceAt = (d: number): Confidence => {
    if (resultDays.some((x) => d - x <= C.CONF_HIGH_DAYS)) return 'visoka';
    if (resultDays.some((x) => d - x <= C.CONF_MID_DAYS)) return 'srednja';
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
  const record = (c: Omit<FormChange, 'before' | 'after'>, before: Vdot, after: Vdot): void => {
    if (Math.abs(after - before) >= C.CHANGE_MIN)
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
        const ev = resultEvidence(run);
        const low = confidenceAt(d) === 'niska';
        const k = low ? C.K_LOW_CONFIDENCE : kind === 'trka' ? C.K_RACE : C.K_TEST;
        const before = vdot;
        let next = vdot + k * (ev.vdot - vdot);
        /* Toplo: donja granica — ne spušta procenu koja već ima osnov (srednja/visoka pouzdanost). */
        if (ev.hot && !low && next < vdot) next = vdot;
        vdot = next;
        resultDays.push(d);
        record(
          {
            date: run.date,
            signal: kind,
            runId: run.id,
            reason: explainResult(
              kind,
              run.date,
              run.distanceM,
              run.durationSec,
              ev,
              before,
              vdot,
              goalM
            )
          },
          before,
          vdot
        );
        continue;
      }
      const q = qualityEvidence(run, vdot, goalM);
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
    /* 3. trend pulsa: nedeljom i danas, najviše jednom u 14 dana */
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
    snapshots.push({ day: d, vdot });
  }

  const confidence = confidenceAt(today);
  const point = (v: Vdot, day: number, conf: Confidence): FormPoint => ({
    vdot: r2(v),
    raceTimeSec: Math.round(raceTimeSec(v, goalM)),
    asOf: isoOf(day),
    confidence: conf
  });

  /* plafon napretka */
  const tenure = tenureOf(facts);
  let { rate, max } = C.CEILING[tenure];
  const window = C.NO_QUALITY_WEEKS * 7;
  const coversHistory = runs[0] !== undefined && today - dayNum(runs[0].date) >= window;
  const anyQuality =
    qualityDays.some((x) => today - x < window) ||
    runs.some(
      (r) =>
        today - dayNum(r.date) < window &&
        ((r.laps ?? []).some((l) => l.role === 'work') ||
          (r.planned !== undefined && isQualityZone(r.planned.zone)))
    );
  if (coversHistory && !anyQuality) {
    rate *= C.NO_QUALITY_RATE;
    max += C.NO_QUALITY_MAX_ADD;
  }
  let fv = 1;
  if (planned !== null && planned.baseLoad > 0) {
    const ratio = clamp(planned.peakLoad / planned.baseLoad, 1, C.VOLUME_RATIO_MAX);
    fv = C.VOLUME_F_MIN + (C.VOLUME_F_SPAN * (ratio - 1)) / (C.VOLUME_RATIO_MAX - 1);
  }
  let fp = 1;
  const from = today - C.PROGRESS_WEEKS * 7;
  const resultsIn = resultDays.filter((x) => x > from).length;
  const qualityIn = qualityDays.filter((x) => x > from).length;
  if (resultsIn >= C.PROGRESS_MIN_RESULTS || qualityIn >= C.PROGRESS_MIN_QUALITY) {
    const past = [...snapshots].reverse().find((s) => s.day <= from)?.vdot ?? init.vdot;
    const slope = (vdot - past) / C.PROGRESS_WEEKS;
    fp = clamp(0.5 + (0.5 * slope) / rate, C.PROGRESS_F_MIN, C.PROGRESS_F_MAX);
  }
  const weeksToRace = Math.floor((dayNum(goal.raceDate) - today) / 7);
  const w = clamp(weeksToRace - 1, 0, C.WEEKS_MAX);
  const gain = Math.min(rate * fv * fp * w, max);
  const sigma = C.SIGMA[confidence];

  return {
    start: point(init.vdot, startDay, startConfidence),
    current: point(vdot, today, confidence),
    raceDay: {
      lowSec: Math.round(raceTimeSec(vdot + gain + sigma / 2, goalM)),
      expectedSec: Math.round(raceTimeSec(vdot + C.EXPECTED_SHARE * gain, goalM)),
      highSec: Math.round(raceTimeSec(vdot - sigma / 2, goalM))
    },
    ceilingGain: r2(gain),
    history
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
