import { addDays, parseIsoDate, type IsoDate } from '../date';
import type { ResolvedPlan } from '../plan/types';
import type { LogEntry } from '../state/types';
import { RUN_WALK_LADDER } from './constants/product';
import { runWalkRung } from './generator/runWalk';

/** Product thresholds for leaving the run/walk phase, not a diagnosis. Napor je RPE 0–10, bol 0–10. */
export const RUN_WALK_POLICY = {
  windowDays: 21,
  minTolerated: 3,
  maxEasyRpe: 5,
  hardRpe: 7,
  borderlinePain: 3,
  hardPain: 4,
  holdAfterMisses: 2,
  holdAfterBorderline: 2
} as const;

export type RunWalkDecision = 'not-applicable' | 'unknown' | 'advance' | 'hold' | 'step-back';

export interface RunWalkAssessment {
  decision: RunWalkDecision;
  /** Korak lestvice (1–4) poslednjeg run/walk dana do danas. */
  rung: number | null;
  /** Poslednji korak lestvice: sledeći je neprekidno trčanje. */
  finalRung: boolean;
  considered: number;
  completed: number;
  missed: number;
  tolerated: number;
  borderline: number;
  hard: number;
  /** Završeno bez upisanog napora: nepoznat podatak, ne dokaz tolerancije. */
  unreported: number;
  reasons: string[];
  /** Šta preporuka znači za korisnika; `null` kad nema šta da se odluči. */
  advice: string | null;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const empty = (decision: RunWalkDecision): RunWalkAssessment => ({
  decision,
  rung: null,
  finalRung: false,
  considered: 0,
  completed: 0,
  missed: 0,
  tolerated: 0,
  borderline: 0,
  hard: 0,
  unreported: 0,
  reasons: [],
  advice: null
});

/**
 * Procena tolerancije na trenutnom koraku trčanja/hoda iz prijavljenog izvršenja.
 * Prazan dnevnik je nepoznat podatak: nikad ne potvrđuje napredak i nikad ne računa kao neuspeh.
 * `recentPainMax` je najjači zapis bola iz oporavka u skorašnjem periodu (opciono).
 */
export function assessRunWalkProgress(input: {
  plan: ResolvedPlan;
  log: Readonly<Record<string, LogEntry>>;
  today: string;
  recentPainMax?: number | null;
}): RunWalkAssessment {
  const today = parseIsoDate(input.today);
  if (!today) return empty('not-applicable');
  const started = input.plan.dated
    .filter((d) => d.tag === 'rw' && !d.rest && d.date <= today && runWalkRung(d.runWalk) !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = started.at(-1);
  if (!latest) return empty('not-applicable');
  const rung = runWalkRung(latest.runWalk)!;
  const since: IsoDate = addDays(today, -(RUN_WALK_POLICY.windowDays - 1));
  const days = started.filter((d) => runWalkRung(d.runWalk) === rung && d.date >= since);
  const out = empty('unknown');
  out.rung = rung;
  out.finalRung = rung === RUN_WALK_LADDER.length;
  out.considered = days.length;
  for (const day of days) {
    const entry = input.log[day.id];
    if (entry?.status === 'skip') {
      out.missed++;
      continue;
    }
    if (entry?.status !== 'done') continue;
    out.completed++;
    const rpe = entry['rpe'];
    const pain = entry['knee'];
    if (finite(rpe) && rpe >= 0 && rpe <= 10) {
      if (rpe >= RUN_WALK_POLICY.hardRpe || (finite(pain) && pain >= RUN_WALK_POLICY.hardPain))
        out.hard++;
      else if (
        rpe > RUN_WALK_POLICY.maxEasyRpe ||
        (finite(pain) && pain >= RUN_WALK_POLICY.borderlinePain)
      )
        out.borderline++;
      else out.tolerated++;
    } else if (finite(pain) && pain >= RUN_WALK_POLICY.hardPain) out.hard++;
    else out.unreported++;
  }
  const painNow =
    finite(input.recentPainMax) && input.recentPainMax >= RUN_WALK_POLICY.hardPain
      ? input.recentPainMax
      : null;
  const label = RUN_WALK_LADDER[rung - 1]!.label;
  if (out.hard >= 2 && rung > 1) out.decision = 'step-back';
  else if (
    out.hard >= 1 ||
    out.borderline >= RUN_WALK_POLICY.holdAfterBorderline ||
    out.missed >= RUN_WALK_POLICY.holdAfterMisses ||
    painNow !== null
  )
    out.decision = 'hold';
  else if (out.tolerated >= RUN_WALK_POLICY.minTolerated) out.decision = 'advance';
  if (out.hard)
    out.reasons.push(
      `${out.hard} trčanja uz napor ${RUN_WALK_POLICY.hardRpe}+/10 ili bol ${RUN_WALK_POLICY.hardPain}+/10.`
    );
  if (out.borderline)
    out.reasons.push(
      `${out.borderline} trčanja uz napor iznad ${RUN_WALK_POLICY.maxEasyRpe}/10 ili blagi bol.`
    );
  if (out.missed) out.reasons.push(`${out.missed} označeno kao preskočeno na ovom koraku.`);
  if (painNow !== null) out.reasons.push(`Noviji zapis bola ${painNow}/10 u oporavku.`);
  if (out.unreported)
    out.reasons.push(
      `${out.unreported} završeno bez upisanog napora: to je nepoznat podatak, ne potvrda.`
    );
  if (out.decision === 'unknown')
    out.reasons.push(
      `Za potvrdu tolerancije treba bar ${RUN_WALK_POLICY.minTolerated} trčanja na koraku „${label}" sa upisanim naporom do ${RUN_WALK_POLICY.maxEasyRpe}/10; upisano ih je ${out.tolerated}.`
    );
  out.advice =
    out.decision === 'advance'
      ? out.finalRung
        ? 'Tolerancija je potvrđena: prelaz na neprekidno lagano trčanje je opravdan.'
        : 'Tolerancija je potvrđena: nastavi lestvicu prema planu.'
      : out.decision === 'hold'
        ? `Zadrži korak „${label}" još nedelju dana pre prelaza.`
        : out.decision === 'step-back'
          ? `Vrati se jedan korak lestvice pa ponovo napreduj.`
          : `Prelaz ostaje nepotvrđen dok ne upišeš napor za trčanja na koraku „${label}".`;
  return out;
}
