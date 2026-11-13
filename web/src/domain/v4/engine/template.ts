/* V4 — ŠABLON (SPEC § 4.2): izbor nivoa i šablona, razvijanje u namere nedelja. Motor zna samo `WeekKind`. */
import { diffDays, mondayOf } from './dates';
import type {
  DistanceData,
  HistoryConditions,
  IsoDate,
  LevelId,
  LoadPoints,
  StimulusSlot,
  StimulusTag,
  Template,
  Vdot,
  WeekIntent,
  WorkoutDef
} from './types';

/** N = broj kalendarskih nedelja od nedelje `startDate` do nedelje trke, uključujući obe. */
export function countWeeks(startDate: IsoDate, raceDate: IsoDate): number {
  return Math.max(1, diffDays(mondayOf(raceDate), mondayOf(startDate)) / 7 + 1);
}

/** Nivo: prvo pravilo čiji svi uslovi važe; bez pogotka poslednje pravilo. */
/** Uslovi iz istorije: nepoznata činjenica (`null`/`undefined`) ne zadovoljava nijedan uslov. */
export function historyOk(
  when: HistoryConditions,
  facts: {
    recentQualityWeeks?: number | null | undefined;
    weeksSincePause?: number | null | undefined;
  }
): boolean {
  const check = (value: number | null | undefined, min?: number, max?: number): boolean => {
    if (min === undefined && max === undefined) return true;
    if (value === null || value === undefined) return false;
    return (min === undefined || value >= min) && (max === undefined || value <= max);
  };
  return (
    check(facts.recentQualityWeeks, when.minRecentQualityWeeks, when.maxRecentQualityWeeks) &&
    check(facts.weeksSincePause, when.minWeeksSincePause, when.maxWeeksSincePause)
  );
}

export function pickLevel(
  data: DistanceData,
  runner: {
    beginner: boolean;
    vdot: Vdot;
    baseLoad: LoadPoints;
    recentQualityWeeks?: number | null | undefined;
    weeksSincePause?: number | null | undefined;
    yearsRunning?: number | undefined;
  }
): LevelId {
  for (const rule of data.levels) {
    const w = rule.when;
    if (w.beginner !== undefined && w.beginner !== runner.beginner) continue;
    if (w.minVdot !== undefined && runner.vdot < w.minVdot) continue;
    if (w.maxVdot !== undefined && runner.vdot > w.maxVdot) continue;
    if (w.maxBaseLoad !== undefined && runner.baseLoad > w.maxBaseLoad) continue;
    if (
      w.maxTenureWeeks !== undefined &&
      (runner.yearsRunning === undefined || runner.yearsRunning * 52 > w.maxTenureWeeks)
    )
      continue;
    if (!historyOk(w, runner)) continue;
    return rule.id;
  }
  return data.levels[data.levels.length - 1]?.id ?? '';
}

const within = (value: number, lo: number, hi: number): boolean => value >= lo && value <= hi;

/** Šablon: prvi sa nivoom, rasponom nedelja i dana; `exact: false` znači da podaci distance ne pokrivaju ulaz. */
export function pickTemplate(
  data: DistanceData,
  level: LevelId,
  weeks: number,
  runDays: number
): { template: Template; exact: boolean } | null {
  const ofLevel = data.templates.filter((t) => t.levels.includes(level));
  const exact = ofLevel.find(
    (t) => within(weeks, t.minWeeks, t.maxWeeks) && within(runDays, t.minRunDays, t.maxRunDays)
  );
  if (exact !== undefined) return { template: exact, exact: true };
  const fallback =
    ofLevel.find((t) => within(weeks, t.minWeeks, t.maxWeeks)) ?? ofLevel[0] ?? data.templates[0];
  return fallback === undefined ? null : { template: fallback, exact: false };
}

/** Koliko nedelja tela pripada svakoj fazi: `floor(udeo × M)`, ostatak po najvećem razlomku (izjednačeno: ranija). */
function phaseCounts(template: Template, bodyWeeks: number): number[] {
  const raw = template.body.map((p) => p.share * bodyWeeks);
  const counts = raw.map((x) => Math.floor(x + 1e-9));
  let left = bodyWeeks - counts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x + 1e-9) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0 && order.length > 0; k += 1, left -= 1) {
    const slot = order[k % order.length];
    if (slot !== undefined) counts[slot.i] = (counts[slot.i] ?? 0) + 1;
  }
  return counts;
}

const scaleDose = (slot: StimulusSlot, factor: number): StimulusSlot =>
  slot.dosePct === undefined ? slot : { ...slot, dosePct: slot.dosePct * factor };

/** Rasterećenje: namera prethodne nedelje × faktori šablona; ne troši mesto u `cycle`. Ne kopira proveru forme
    (podražaj čiji su unosi biblioteke vrste `test`) ni mesto koje važi samo dok su tempa po osećaju. */
function toRecovery(
  base: WeekIntent,
  template: Template,
  phase: string,
  tests: ReadonlySet<StimulusTag>
): WeekIntent {
  const r = template.recovery;
  return {
    phase,
    kind: 'recovery',
    loadPct: base.loadPct * r.loadFactor,
    long:
      base.long === null
        ? null
        : {
            ...base.long,
            lenPct: base.long.lenPct * r.longFactor,
            ...(base.long.dosePct === undefined
              ? {}
              : { dosePct: base.long.dosePct * r.doseFactor })
          },
    stimuli: base.stimuli
      .filter((s) => s.onlyByFeel !== true && !tests.has(s.stimulus))
      .map((s) => scaleDose(s, r.doseFactor)),
    source: 'template'
  };
}

/** Razvijanje šablona u `weeks` namera (§ 4.2 k. 3–5): telo po fazama, pa rep; rasterećenja brojano unazad. */
export function expandTemplate(
  template: Template,
  weeks: number,
  /** Biblioteka distance: iz nje se zna koji podražaj je provera forme (ne kopira se u rasterećenje). */
  library: readonly WorkoutDef[] = []
): WeekIntent[] {
  const tests = new Set(library.filter((d) => d.kind === 'test').map((d) => d.stimulus));
  const tailLen = Math.min(weeks, template.tail.length);
  const tail = template.tail.slice(template.tail.length - tailLen);
  const bodyWeeks = weeks - tailLen;
  const counts = phaseCounts(template, bodyWeeks);
  const body: WeekIntent[] = [];
  let position = 0;
  template.body.forEach((phase, p) => {
    let used = 0;
    for (let k = 0; k < (counts[p] ?? 0); k += 1) {
      const fromTail = bodyWeeks - position;
      position += 1;
      const cycleAt = (n: number): WeekIntent | undefined => {
        if (phase.cycle.length === 0) return undefined;
        if (n < phase.cycle.length) return phase.cycle[n];
        const loop = Math.min(Math.max(phase.loopFrom, 0), phase.cycle.length - 1);
        return phase.cycle[loop + ((n - phase.cycle.length) % (phase.cycle.length - loop))];
      };
      const next = cycleAt(used);
      if (next === undefined) continue;
      const isRecovery = template.recoveryEvery > 0 && fromTail % template.recoveryEvery === 0;
      if (isRecovery) {
        body.push(toRecovery(body[body.length - 1] ?? next, template, phase.phase, tests));
      } else {
        body.push({ ...next, phase: phase.phase, source: 'template' });
        used += 1;
      }
    }
  });
  return [...body, ...tail.map((t): WeekIntent => ({ ...t, source: 'template' }))];
}
