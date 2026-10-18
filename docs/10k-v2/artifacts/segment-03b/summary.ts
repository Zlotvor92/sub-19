/* Sažetak primera za tabelu poređenja 03 → 03b; isti kod čita plan 81bd351 (10k-v2.3.0) i 10k-v2.3.1. */

export interface ExampleSummary {
  ok: boolean;
  /** Nedelje 3 … taper sa kvalitetom / ukupno. */
  qualityWeeks: number;
  trainingWeeks: number;
  /** Nedelja testa 5 km (null = bez testa). */
  test: number | null;
  /** Najkraći dugi van trkačke nedelje [km] i dugi rasterećenja redom. */
  shortestLong: number;
  deloadLongs: number[];
  peak: number;
  /** Kvalitet tapera ('—' = bez kvaliteta) i oštrenje trkačke nedelje. */
  taper: string;
  sharpener: boolean;
}

interface Day {
  role: string;
  workout: {
    kind: string;
    km: number;
    dose: {
      zone: string;
      doseM: number;
      structure: { form: string; reps?: number; repM?: number; km?: number };
    } | null;
  };
}
interface Week {
  index: number;
  phase: string;
  deload: boolean;
  days: Day[];
}

const km = (x: number): string => x.toFixed(1).replace(".", ",");

export function summarize(result: unknown): ExampleSummary | { ok: false } {
  const r = result as {
    ok: boolean;
    plan?: { peakKm: number; weeks: Week[] };
  };
  if (!r.ok || !r.plan) return { ok: false };
  const weeks = r.plan.weeks;
  const training = weeks.filter((w) => w.index >= 3 && w.phase !== "race");
  const quality = (w: Week): Day | undefined =>
    w.days.find((d) => d.workout.kind === "quality");
  const longs = weeks.flatMap((w) =>
    w.days.filter((d) => d.role === "long").map((d) => d.workout.km),
  );
  const taper = weeks.find((w) => w.phase === "taper");
  const tq = taper && quality(taper)?.workout.dose;
  const s = tq?.structure;
  return {
    ok: true,
    qualityWeeks: training.filter((w) => quality(w)).length,
    trainingWeeks: training.length,
    test:
      weeks.find((w) => w.days.some((d) => d.workout.kind === "test"))?.index ??
      null,
    shortestLong: Math.min(...longs),
    deloadLongs: weeks
      .filter((w) => w.deload)
      .map((w) => w.days.find((d) => d.role === "long")!.workout.km),
    peak: r.plan.peakKm,
    taper: !tq
      ? "—"
      : s?.form === "continuous"
        ? `${tq.zone} ${km(s.km!)} km`
        : `${tq.zone} ${s?.reps} × ${s?.repM} m`,
    sharpener: weeks.some((w) => w.days.some((d) => d.role === "sharpener")),
  };
}
