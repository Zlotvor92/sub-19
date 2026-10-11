/** Read optional phase-2 metadata safely from legacy plans and imported backups. */
export function preparationSummary(meta: unknown): {
  label: string;
  peakLongRunKm: number;
  peakWeeklyKm: number;
  reasons: string[];
} | null {
  if (!meta || typeof meta !== 'object') return null;
  const p = (meta as Record<string, unknown>)['preparation'];
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
  return {
    label: labels[status],
    peakLongRunKm,
    peakWeeklyKm,
    reasons: Array.isArray(value['reasons'])
      ? value['reasons'].filter((x): x is string => typeof x === 'string')
      : []
  };
}
