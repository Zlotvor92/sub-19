/* V4 — ODLUKE DONETE JEDNOM (SPEC § 6.2 k. 3–4, § 4.6). Svaka veličina ima jednu funkciju-vlasnika;
   `replan` ih čita iz `header.decisions` i poziva ponovo samo gde § 6.3 to dozvoljava. */
import {
  DEFAULT_EASY_MAX_OVER_PREVIOUS,
  DEFAULT_MAX_PEAK_OVER_BASE,
  DEFAULT_TAPER_EASY_MAX_SEC
} from './constants';
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

/** Ulaz lestvice vrha (S2): polazni obim u km, broj nedelja pripreme i ograničen trkač (kratak staž ili tegoba). */
export interface PeakLadderInput {
  baseKm: number;
  weeks: number;
  limited: boolean;
}

/** Množilac vrha (S2): red lestvice za polazni obim i dužinu pripreme; ograničen trkač najviše `limitedOverBase`.
    Bez lestvice: `maxPeakOverBase` ili podrazumevano 1,40. */
export function ladderOverBase(safety: SafetyNumbers, input: PeakLadderInput | null): number {
  const fallback = safety.maxPeakOverBase ?? DEFAULT_MAX_PEAK_OVER_BASE;
  const ladder = safety.peakLadder;
  if (ladder === undefined || input === null) return fallback;
  const row = ladder.rows.find(
    (r) => (r.maxBaseKm === null || input.baseKm <= r.maxBaseKm) && input.weeks >= r.minWeeks
  );
  const over = row?.overBase ?? fallback;
  return input.limited && ladder.limitedOverBase !== undefined
    ? Math.min(over, ladder.limitedOverBase)
    : over;
}

/** Ulaz lestvice iz činjenica: km = bodovi baze u minutima laganog tempa; ograničen = staž ispod praga ili tegoba
    u poslednjih 12 meseci. Kratak staž: `yearsRunning` ispod praga (u nedeljama). */
export function ladderInputOf(input: {
  baseLoad: LoadPoints;
  easyPaceSecPerKm: number;
  weeks: number;
  yearsRunning: number | undefined;
  painInYear: boolean;
  safety: SafetyNumbers;
}): PeakLadderInput {
  const tenure = input.safety.peakLadder?.limitedTenureWeeks ?? 0;
  const shortTenure = input.yearsRunning !== undefined && input.yearsRunning * 52 < tenure;
  return {
    baseKm: input.easyPaceSecPerKm > 0 ? (input.baseLoad * 60) / input.easyPaceSecPerKm : 0,
    weeks: input.weeks,
    limited: shortTenure || input.painInYear
  };
}

/** Vrh nedeljnog opterećenja: `P = max(B, min(B / startPct, plafon nivoa, B × množilac))` (R3, S2). */
export function decidePeak(
  baseLoad: LoadPoints,
  template: Template,
  safety: SafetyNumbers,
  level: LevelId,
  overBase: number = safety.maxPeakOverBase ?? DEFAULT_MAX_PEAK_OVER_BASE
): LoadPoints {
  const cap = safety.peakLoadCap[level] ?? Number.POSITIVE_INFINITY;
  /* S2: sa lestvicom je ona jedini vlasnik vrha; `startPct` šablona tada samo oblikuje prve nedelje. */
  const wanted =
    safety.peakLadder !== undefined
      ? Number.POSITIVE_INFINITY
      : template.startPct > 0
        ? baseLoad / template.startPct
        : baseLoad;
  return Math.max(baseLoad, Math.min(wanted, cap, baseLoad * overBase));
}

/** Plafon rada po treningu za nivo (S4): broj, ili mapa po nivou (`*` za ostale; bez njega bez plafona). */
export function maxWorkOf(raw: Seconds | Readonly<Record<LevelId, Seconds>>, level: LevelId): Seconds {
  if (typeof raw === 'number') return raw;
  return raw[level] ?? raw['*'] ?? Number.POSITIVE_INFINITY;
}

/** Osnovica lestvice doze (S4): `udeo × P × 60`, bez plafona nivoa. */
export function decideDoseBase(
  peakLoad: LoadPoints,
  safety: SafetyNumbers
): Record<StimulusTag, Seconds> {
  const out: Record<StimulusTag, Seconds> = {};
  for (const tag of Object.keys(safety.doseCaps).sort()) {
    const cap = safety.doseCaps[tag];
    if (cap !== undefined) out[tag] = Math.round(cap.shareOfPeakLoad * peakLoad * 60);
  }
  return out;
}

/** Plafon doze po podražaju: `min(maxWorkSec nivoa, udeo × P × 60)`, zaokružen na sekundu. */
export function decideCaps(
  peakLoad: LoadPoints,
  safety: SafetyNumbers,
  level: LevelId = ''
): Record<StimulusTag, Seconds> {
  const caps: Record<StimulusTag, Seconds> = {};
  for (const tag of Object.keys(safety.doseCaps).sort()) {
    const cap = safety.doseCaps[tag];
    if (cap !== undefined) {
      caps[tag] = Math.round(
        Math.min(maxWorkOf(cap.maxWorkSec, level), cap.shareOfPeakLoad * peakLoad * 60)
      );
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

/** Najmanji dozvoljen rast nedelje u minutima (S2): veće od `minRampLoad` i `minRampKm` u laganom tempu. */
export function minRampOf(safety: SafetyNumbers, easyPaceSecPerKm: number): number {
  return Math.max(safety.minRampLoad, ((safety.minRampKm ?? 0) * easyPaceSecPerKm) / 60);
}

/** Korak dugog (S2): veće od `longStepSec` i `longStepKm` u laganom tempu. */
export function longStepOf(safety: SafetyNumbers, easyPaceSecPerKm: number): Seconds {
  return Math.max(safety.longStepSec, (safety.longStepKm ?? 0) * easyPaceSecPerKm);
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

/** Lagan dan kao najveći udeo dugog te nedelje (R2a); broj ili mapa po broju dana trčanja. */
export function easyShareOfLong(safety: SafetyNumbers, runDays: number): number {
  const raw = safety.easyMaxShareOfLong;
  return typeof raw === 'number' ? raw : (byRunDays(raw, runDays) ?? 1);
}

/** Lagan dan kao najveći umnožak najdužeg laganog dana prethodne nedelje (R2b). */
export function easyOverPrevious(safety: SafetyNumbers): number {
  return safety.easyMaxOverPrevious ?? DEFAULT_EASY_MAX_OVER_PREVIOUS;
}

/** Najduži lagan dan u nedelji sužavanja i nedelji trke (R1). */
export function taperEasyMax(safety: SafetyNumbers, runDays: number): Seconds {
  const raw = safety.taperEasyMaxSec ?? DEFAULT_TAPER_EASY_MAX_SEC;
  return typeof raw === 'number' ? raw : (byRunDays(raw, runDays) ?? Number.POSITIVE_INFINITY);
}

/** Udeo dugog za broj dana; mapa može biti i po nivou (treći krug). */
export function longShare(safety: SafetyNumbers, level: LevelId, runDays: number): number {
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

/** Udeo dugog za nedelju od `weekKm` planiranih km (S3): ispod `longShareLowVolume.belowKm` važi veći udeo,
    a u nedeljama najdužeg dugog (`high`) najveći. */
export function longShareFor(
  safety: SafetyNumbers,
  level: LevelId,
  runDays: number,
  weekKm: number,
  high: boolean
): number {
  const base = longShare(safety, level, runDays);
  const low = safety.longShareLowVolume;
  if (low === undefined || runDays < low.minRunDays || weekKm >= low.belowKm) return base;
  return Math.max(base, high ? low.peakShare : low.share);
}

/** Najduži dugi plana: `min(plafon nivoa, udeo po danima × P × 60)`, na ceo minut. Sa laganim tempom udeo prati
    obim vrha (S3: mali obim nosi veći udeo u najviše nekoliko nedelja). */
export function decideLongMax(
  peakLoad: LoadPoints,
  safety: SafetyNumbers,
  level: LevelId,
  runDays: number,
  easyPaceSecPerKm?: number
): Seconds {
  const cap = safety.longMaxSec[level] ?? Number.POSITIVE_INFINITY;
  const share =
    easyPaceSecPerKm === undefined
      ? longShare(safety, level, runDays)
      : longShareFor(safety, level, runDays, (peakLoad * 60) / easyPaceSecPerKm, true);
  return Math.round(Math.min(cap, share * peakLoad * 60) / 60) * 60;
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
  /** Lestvica vrha (S2); bez nje važi `maxPeakOverBase`. */
  ladder?: PeakLadderInput | null;
  /** Lagani tempo (S3: udeo dugog po obimu). */
  easyPaceSecPerKm?: number;
  /** Očekivano vreme na dan trke (D3: dugi prema vremenu trke). */
  raceSec?: Seconds;
}

/** D3 (krug 5): spor trkač — dugi ≤ vreme trke + `overSec`, blok/progresija u dugom ≤ `blockMaxSec`. */
function applyLongVsRace(d: Decisions, data: DistanceData, raceSec: Seconds | undefined): Decisions {
  const r = data.safety.longVsRace;
  if (r === undefined || raceSec === undefined || raceSec < r.fromRaceSec) return d;
  const blockTags = new Set(
    data.library
      .filter((x) => x.kind === 'long' && (x.main.kind === 'finish-block' || x.main.kind === 'progressive'))
      .map((x) => x.stimulus)
  );
  const doseCapSec: Record<StimulusTag, Seconds> = { ...d.doseCapSec };
  for (const tag of blockTags) {
    const cap = doseCapSec[tag];
    if (cap !== undefined) doseCapSec[tag] = Math.min(cap, r.blockMaxSec);
  }
  return {
    ...d,
    longMaxSec: Math.min(d.longMaxSec, Math.round((raceSec + r.overSec) / 60) * 60),
    doseCapSec
  };
}

/** Sve odluke plana na jednom mestu, svaka iz svog vlasnika. */
export function decide(input: DecideInput): Decisions {
  return applyLongVsRace(decideBase(input), input.data, input.raceSec);
}

function decideBase(input: DecideInput): Decisions {
  const { data, template, level, baseLoad } = input;
  const peakOverBase = ladderOverBase(data.safety, input.ladder ?? null);
  const peakLoad =
    Math.round(decidePeak(baseLoad, template, data.safety, level, peakOverBase) * 10) / 10;
  const runDays = [...input.runDays].sort((a, b) => a - b);
  return {
    templateId: template.id,
    level,
    baseLoad,
    peakLoad,
    longMaxSec: decideLongMax(
      peakLoad,
      data.safety,
      level,
      runDays.length,
      input.easyPaceSecPerKm
    ),
    longStartSec: decideLongStart(input.longestRecentSec, baseLoad, data.safety, runDays.length),
    doseCapSec: decideCaps(peakLoad, data.safety, level),
    doseBaseSec: decideDoseBase(peakLoad, data.safety),
    ...(data.safety.peakLadder === undefined ? {} : { peakOverBase }),
    ...decideWarmup(baseLoad, data.safety),
    runDays,
    longDay: input.longDay,
    qualityDays: assignDays(runDays, input.longDay)
  };
}

/** Da li dugi (najduži dozvoljen, trajanje) stiže do dugog za distancu (S3): ≥ `minLongSec` ili ≥ `longCheckKm`;
    plan kraći od `longCheckMinWeeks` se ne proverava. */
export function longReaches(
  data: DistanceData,
  weeks: number,
  longSec: Seconds,
  easyPaceSecPerKm: number
): boolean {
  const a = data.adequate;
  if (a.longCheckMinWeeks === undefined || weeks < a.longCheckMinWeeks) return true;
  const km = a.longCheckKm ?? a.minLongKm;
  return longSec >= (a.minLongSec ?? Number.POSITIVE_INFINITY) || longSec / easyPaceSecPerKm >= km;
}
