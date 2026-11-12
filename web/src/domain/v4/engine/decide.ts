/* V4 — ODLUKE DONETE JEDNOM (SPEC § 6.2 k. 3–4, § 4.6). Svaka veličina ima jednu funkciju-vlasnika;
   `replan` ih čita iz `header.decisions` i poziva ponovo samo gde § 6.3 to dozvoljava. */
import type {
  Decisions,
  DistanceData,
  LevelId,
  LoadPoints,
  SafetyNumbers,
  Seconds,
  StimulusTag,
  Template,
  Weekday
} from './types';

/** Vrh nedeljnog opterećenja: `P = max(B, min(B / startPct, plafon nivoa))`. */
export function decidePeak(
  baseLoad: LoadPoints,
  template: Template,
  safety: SafetyNumbers,
  level: LevelId
): LoadPoints {
  const cap = safety.peakLoadCap[level] ?? Number.POSITIVE_INFINITY;
  const wanted = template.startPct > 0 ? baseLoad / template.startPct : baseLoad;
  return Math.max(baseLoad, Math.min(wanted, cap));
}

/** Plafon doze po podražaju: `min(maxWorkSec, udeo × P × 60)`, zaokružen na sekundu. */
export function decideCaps(
  peakLoad: LoadPoints,
  safety: SafetyNumbers
): Record<StimulusTag, Seconds> {
  const caps: Record<StimulusTag, Seconds> = {};
  for (const tag of Object.keys(safety.doseCaps).sort()) {
    const cap = safety.doseCaps[tag];
    if (cap !== undefined) {
      caps[tag] = Math.round(Math.min(cap.maxWorkSec, cap.shareOfPeakLoad * peakLoad * 60));
    }
  }
  return caps;
}

/** Zagrevanje i hlađenje: prvi red čiji `uptoBaseLoad ≥ B` (red sa `null` važi za sve). */
export function decideWarmup(
  baseLoad: LoadPoints,
  safety: SafetyNumbers
): { warmupSec: Seconds; cooldownSec: Seconds } {
  for (const row of safety.warmupCooldown) {
    if (row.uptoBaseLoad === null || row.uptoBaseLoad >= baseLoad) {
      return { warmupSec: row.warmupSec, cooldownSec: row.cooldownSec };
    }
  }
  const last = safety.warmupCooldown[safety.warmupCooldown.length - 1];
  return { warmupSec: last?.warmupSec ?? 0, cooldownSec: last?.cooldownSec ?? 0 };
}

/** Vrednost za broj dana iz mape „1"…„7"; ako ključa nema, najbliži manji pa najbliži veći. */
function byRunDays(map: Readonly<Record<string, number>>, runDays: number): number | undefined {
  for (let d = runDays; d >= 1; d -= 1) {
    const value = map[String(d)];
    if (value !== undefined) return value;
  }
  for (let d = runDays + 1; d <= 7; d += 1) {
    const value = map[String(d)];
    if (value !== undefined) return value;
  }
  return undefined;
}

const isDayMap = (value: unknown): value is Readonly<Record<string, number>> =>
  typeof value === 'object' && value !== null;

/** Udeo dugog za broj dana; mapa može biti i po nivou (treći krug). */
function longShare(safety: SafetyNumbers, level: LevelId, runDays: number): number {
  const map = safety.longShareByRunDays;
  const leveled = Object.values(map).some(isDayMap);
  if (!leveled) {
    const flat: Record<string, number> = {};
    for (const [key, value] of Object.entries(map))
      if (typeof value === 'number') flat[key] = value;
    return byRunDays(flat, runDays) ?? 1;
  }
  const own: unknown = map[level];
  return isDayMap(own) ? (byRunDays(own, runDays) ?? 1) : 1;
}

/** Najduži dugi plana: `min(plafon nivoa, udeo po danima × P × 60)`, na ceo minut. */
export function decideLongMax(
  peakLoad: LoadPoints,
  safety: SafetyNumbers,
  level: LevelId,
  runDays: number
): Seconds {
  const cap = safety.longMaxSec[level] ?? Number.POSITIVE_INFINITY;
  return Math.round(Math.min(cap, longShare(safety, level, runDays) * peakLoad * 60) / 60) * 60;
}

/** Polazni dugi: veće od najdužeg skorašnjeg trčanja i udela bazne nedelje (udeo može biti po broju dana). */
export function decideLongStart(
  longestRecentSec: Seconds,
  baseLoad: LoadPoints,
  safety: SafetyNumbers,
  runDays: number
): Seconds {
  const raw = safety.longStartShare;
  const share = typeof raw === 'number' ? raw : (byRunDays(raw, runDays) ?? 0);
  return Math.round(Math.max(longestRecentSec, share * baseLoad * 60) / 60) * 60;
}

const gap = (a: number, b: number): number => Math.min(Math.abs(a - b), 7 - Math.abs(a - b));

/** Raspored dana (§ 4.6): svi dani trčanja osim sidra, po prioritetu Q1, Q2, … (najveći razmak od već zauzetih). */
export function assignDays(runDays: readonly Weekday[], anchor: Weekday): Weekday[] {
  const free = runDays.filter((d) => d !== anchor);
  const taken: Weekday[] = [anchor];
  const order: Weekday[] = [];
  while (free.length > 0) {
    let best = 0;
    let bestScore = -1;
    free.forEach((day, i) => {
      const score = Math.min(...taken.map((t) => gap(day, t)));
      const better =
        score > bestScore ||
        (score === bestScore &&
          (order.length === 0 ? day > (free[best] ?? 0) : day < (free[best] ?? 0)));
      if (better) {
        best = i;
        bestScore = score;
      }
    });
    const [day] = free.splice(best, 1);
    if (day === undefined) break;
    order.push(day);
    taken.push(day);
  }
  return order;
}

export interface DecideInput {
  data: DistanceData;
  template: Template;
  level: LevelId;
  baseLoad: LoadPoints;
  longestRecentSec: Seconds;
  runDays: readonly Weekday[];
  longDay: Weekday;
}

/** Sve odluke plana na jednom mestu, svaka iz svog vlasnika. */
export function decide(input: DecideInput): Decisions {
  const { data, template, level, baseLoad } = input;
  const peakLoad = Math.round(decidePeak(baseLoad, template, data.safety, level) * 10) / 10;
  const runDays = [...input.runDays].sort((a, b) => a - b);
  return {
    templateId: template.id,
    level,
    baseLoad,
    peakLoad,
    longMaxSec: decideLongMax(peakLoad, data.safety, level, runDays.length),
    longStartSec: decideLongStart(input.longestRecentSec, baseLoad, data.safety, runDays.length),
    doseCapSec: decideCaps(peakLoad, data.safety),
    ...decideWarmup(baseLoad, data.safety),
    runDays,
    longDay: input.longDay,
    qualityDays: assignDays(runDays, input.longDay)
  };
}
