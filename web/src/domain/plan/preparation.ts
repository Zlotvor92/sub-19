/** Read optional phase-2 metadata safely from legacy plans and imported backups. */
export function preparationSummary(meta: unknown): {
  label: string;
  /** False when a long-distance plan is limited or in return/base mode. */
  fullPreparation: boolean;
  /** Explicit product mode, e.g. a return plan to the existing date; null for an ordinary plan. */
  mode: string | null;
  peakLongRunKm: number;
  peakWeeklyKm: number;
  reasons: string[];
} | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  const p = m['preparation'];
  if (!p || typeof p !== 'object') return null;
  const value = p as Record<string, unknown>;
  const peakLongRunKm = value['peakLongRunKm'];
  const peakWeeklyKm = value['peakWeeklyKm'];
  const labels: Record<string, string> = {
    limited: 'Ograničena dužinska priprema',
    developing: 'Izdržljivost još nije potvrđena',
    supported: 'Dužinska priprema ima osnovu u podacima'
  };
  const status = value['endurance'];
  if (
    typeof status !== 'string' ||
    !labels[status] ||
    typeof peakLongRunKm !== 'number' ||
    !Number.isFinite(peakLongRunKm) ||
    peakLongRunKm < 0 ||
    typeof peakWeeklyKm !== 'number' ||
    !Number.isFinite(peakWeeklyKm) ||
    peakWeeklyKm < 0
  )
    return null;
  const dist = typeof m['raceDistM'] === 'number' ? m['raceDistM'] : 0;
  const name = typeof m['raceName'] === 'string' ? m['raceName'].toLowerCase() : 'trku';
  const decision = m['cycleDecision'] as { kind?: unknown } | undefined;
  const execution = m['executionAdjustment'] as { breakDays?: unknown } | undefined;
  const returning = typeof execution?.breakDays === 'number' && execution.breakDays > 0;
  const base = decision?.kind === 'base';
  const long = dist >= 21097;
  const fullPreparation = !base && !(long && status === 'limited');
  const mode = base
    ? `Povratni/bazni režim bez vremenskog cilja — nije puna priprema za ${name}`
    : fullPreparation
      ? null
      : returning
        ? `Povratni plan do postojećeg datuma — nije puna priprema za ${name}`
        : `Ograničena priprema — nije puna priprema za ${name}`;
  return {
    label: labels[status],
    fullPreparation,
    mode,
    peakLongRunKm,
    peakWeeklyKm,
    reasons: Array.isArray(value['reasons'])
      ? value['reasons'].filter((x): x is string => typeof x === 'string')
      : []
  };
}
