/* F9 · SLOJ APLIKACIJA ↔ V4: ŽIVO STANJE PLANA (korak 8, F8 § 3–4, AGENTS 9a).
   Iz plana V4 + trčanja iz `aktivnost` + bolova (`knee`) gradi se današnje stanje motora: forma iz trčanja (tempo,
   odrađen kvalitet, trke; puls samo kao trend — radi i bez pulsa), izvedeni događaji koji se primenjuju sami
   (forma, propušten trening) i pregled prijavljenog događaja. Profil trkača plan ne čuva: polazna forma iz zaglavlja
   se daje kao rezultat na distanci cilja (to je ono što je trkač uneo pri nastanku plana). Čiste funkcije. */
import {
  buildState,
  type DistanceData,
  type PlanDoc,
  type PlanEvent,
  type ReplanResult,
  type Run,
  type RunnerFacts,
  type RunnerState
} from '../../domain/v4/engine';
import { estimateForm } from '../../domain/v4/fitness';
export { clock, shortDate } from '../../domain/v4/fitness';
import { accept, autoStep, preview, reportedEvent, type Ledger, type Report } from './events';
import { distanceData, linkActivities, toFacts } from './facts';

export interface LiveInput {
  doc: PlanDoc;
  today: string;
  /** Trčanja iz `aktivnost` (Strava). */
  runs: readonly Run[];
  /** `log` aplikacije (veza trčanja sa danom preko `stravaId`). */
  log: Readonly<Record<string, unknown>>;
  knee: readonly unknown[];
}

export interface Live {
  state: RunnerState;
  data: DistanceData;
  facts: RunnerFacts;
}

export function liveState(i: LiveInput): Live | null {
  const data = distanceData(i.doc.header.goal.distanceId);
  if (data === null) return null;
  const d = i.doc.header.decisions;
  const start = i.doc.header.form.start;
  const facts = toFacts({
    today: i.today,
    availability: {
      runDays: [...d.runDays],
      longDay: d.longDay,
      ...(d.confirmedRunDays ? { confirmedRunDays: true } : {})
    },
    profile: {
      recentResult: { distanceM: data.distanceM, timeSec: start.raceTimeSec, date: start.asOf }
    },
    activities: linkActivities(i.runs, i.log),
    knee: i.knee
  });
  return { state: buildState(facts, i.doc.header.goal, data, estimateForm, i.doc), data, facts };
}

export interface FormView {
  distanceLabel: string;
  start: { timeSec: number; asOf: string };
  today: { timeSec: number; confidence: 'niska' | 'srednja' | 'visoka' };
  raceDay: { expectedSec: number; lowSec: number; highSec: number };
  /** „Zašto se promenilo", najnovije gore. */
  why: Array<{ date: string; reason: string }>;
}

export function formView(live: Live): FormView {
  const f = live.state.form;
  return {
    distanceLabel: live.data.label,
    start: { timeSec: f.start.raceTimeSec, asOf: f.start.asOf },
    today: { timeSec: f.current.raceTimeSec, confidence: f.current.confidence },
    raceDay: { ...f.raceDay },
    why: [...f.history]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .map((c) => ({ date: c.date, reason: c.reason }))
  };
}

/** Izvedene promene (forma iz trčanja, propušten trening, pauza iz rupe) — primenjuju se same (odluka vlasnika 1). */
export const refreshPlan = (doc: PlanDoc, live: Live, ledger: Ledger): ReplanResult =>
  autoStep(doc, live.state, live.data, [], ledger);

/** Pregled prijavljenog događaja (bolest, put, bol, umor): šta bi se promenilo; ništa se ne čuva. */
export function previewReport(
  doc: PlanDoc,
  live: Live,
  report: Report,
  today: string
): { event: PlanEvent; result: ReplanResult } {
  const event = reportedEvent(report, today);
  return { event, result: preview(doc, live.state, live.data, event) };
}

/** „Primeni": isti događaj nad planom (idempotentno — već primenjen ili odbijen se ne primenjuje ponovo). */
export const acceptReport = (
  doc: PlanDoc,
  live: Live,
  ledger: Ledger,
  event: PlanEvent
): ReplanResult => accept(doc, live.state, live.data, ledger, event);
