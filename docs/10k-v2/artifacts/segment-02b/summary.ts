/* Sažetak primera za tabelu poređenja 02 → 02b (isti kod za 49ad476 i 10k-v2.2.1): ned 1 (cilj, dugi), vrh,
   trkačka/taper (planirano km), upozorenja po pravilu. Ne zavisi od verzije generatora. */

export interface ExampleSummary {
  ok: boolean;
  week1: number | null;
  week1Long: number | null;
  peak: number | null;
  race: number | null;
  taper: number | null;
  warnings: Record<string, number>;
}

interface Result {
  ok: boolean;
  plan?: {
    peakKm: number;
    warnings: { rule: string }[];
    weeks: {
      phase: string;
      targetKm: number;
      plannedKm: number;
      days: { role: string; workout: { km: number } }[];
    }[];
  };
}

export function summarize(result: unknown): ExampleSummary {
  const r = result as Result;
  if (!r.ok || !r.plan)
    return {
      ok: false,
      week1: null,
      week1Long: null,
      peak: null,
      race: null,
      taper: null,
      warnings: {},
    };
  const p = r.plan;
  const warnings: Record<string, number> = {};
  for (const w of p.warnings) warnings[w.rule] = (warnings[w.rule] ?? 0) + 1;
  return {
    ok: true,
    week1: p.weeks[0]!.targetKm,
    week1Long: p.weeks[0]!.days.find((d) => d.role === "long")!.workout.km,
    peak: p.peakKm,
    race: p.weeks.find((w) => w.phase === "race")!.plannedKm,
    taper: p.weeks.find((w) => w.phase === "taper")!.plannedKm,
    warnings,
  };
}
