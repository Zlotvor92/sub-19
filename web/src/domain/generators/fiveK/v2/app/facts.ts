/* 5K v2 → aplikacija: ČINJENICE ZA ADAPTACIJU (segment 08b) — JEDINO mesto gde se podaci aplikacije (dnevnik sa uvozom
   Strava/icu, zapisi bola, testovi 3 km, unete trke, stanje sinhronizacije, potvrda korisnika, prijavljene pauze, ručne
   izmene) prevode u `AdaptFacts` jezgra. Ovde se ništa ne odlučuje o planu: odluke donosi `adaptFiveKV2` (assess).

   - Izvršeno (`workouts`): unos dnevnika po ID-ju dana (ručno ili uvoz — uvoz se upisuje u isti unos). `date` = stvarni dan
     trčanja (`runDate` uvoza, `ts` korisnika, pa datum dana posle pomeranja); `dayId` = datum dana u planu v2 kad je unos
     vezan za trening v2. `done` → završeno, `skip` → propušteno; unos bez statusa nije činjenica. Trčanja pre plana
     (`vanPlana`, samo km) ulaze bez `dayId`. Bol iz zapisa bola (najveći tog dana) ide na trening tog dana; bol ≥ praga v2
     bez treninga tog dana ide kao zaseban zapis bez trčanja.
   - Rezultati: test 3 km (`t3k`) i trka uneta u Analizi trke (`raceAi.context`, napor „trka", 3/5/10 km).
   - Pokrivenost: potpuna SAMO kad je (a) povezan izvor sinhronizacije čija je poslednja USPEŠNA sinhronizacija treninga
     ≥ danas (period od početka plana), ili (b) korisnik potvrdi „zapis za proteklih N dana je potpun". Inače nepotpuna —
     dan bez zapisa je nepoznat, ne pauza.
   - Pauze: samo eksplicitno prijavljene (Prilagodi plan → Pauza).
   - Zaključani dani: ručna izmena ili pomeranje dana posle poslednje adaptacije (`meta.fiveKV2Edits` = izmene u trenutku
     poslednje primenjene adaptacije; bez njega — sve izmene od nastanka plana).
   Šta nije ušlo i zašto ide u `notes` (bez tihog odbacivanja). Bez sata: `today` je ulaz. */

import type {
  AltRecord,
  GenPlanState,
  IsoDate,
  LogEntry,
  PainRecord,
  T3kRecord
} from '../../exchange.ts';
import { FIVE_K_V2_POLICY as P } from '../policy.ts';
import type {
  AdaptFacts,
  BreakFact,
  FactsCoverage,
  FiveKV2Plan,
  FiveKV2RunWalkPlan,
  ResultFact,
  WorkoutFact
} from '../types.ts';
import { addDays, diffDays, isIsoDate } from './date.ts';

/** Povezan izvor sinhronizacije treninga (stanje priprema aplikacija; datum je lokalni kalendarski dan). */
export interface SyncSource {
  source: 'strava' | 'icu';
  /** Dan poslednje USPEŠNE sinhronizacije treninga; `null` = još nije bilo uspešne. */
  lastSuccessDate: IsoDate | null;
}

/** Eksplicitno prijavljena pauza (od–do, uključivo). */
export interface ReportedBreak {
  from: string;
  to: string;
}

/** Ručne izmene u trenutku poslednje primenjene adaptacije (upisuje ih adaptacija u `meta.fiveKV2Edits`). */
export interface EditsSnapshot {
  alts: Readonly<Record<string, unknown>>;
  moves: Readonly<Record<string, unknown>>;
}

/** Sve što aplikacija zna, u svom formatu. Prazno/izostavljeno = nema podataka (ne pauza). */
export interface FactsSource {
  today: IsoDate;
  plan: GenPlanState;
  log: Readonly<Record<string, LogEntry>>;
  /** Trčanja pre plana: datum → km (`vanPlana`). */
  outOfPlan?: Readonly<Record<string, number>>;
  pain?: readonly PainRecord[];
  tests?: readonly T3kRecord[];
  /** Povezani izvori sinhronizacije treninga. */
  sync?: readonly SyncSource[];
  /** Korisnik je potvrdio da je zapis za proteklih N dana potpun (u toku prilagođavanja). */
  confirmedDays?: number | null;
  breaks?: readonly ReportedBreak[];
  alts?: Readonly<Record<string, AltRecord>>;
  moves?: Readonly<Record<string, unknown>>;
}

export interface CoverageInfo extends FactsCoverage {
  basis: 'sync' | 'confirmed' | 'none';
  source?: 'strava' | 'icu';
}

export interface BuiltFacts {
  facts: Required<AdaptFacts>;
  coverage: CoverageInfo;
  /** Podaci koji nisu ušli u činjenice, sa razlogom. */
  notes: string[];
}

type AnyV2 = FiveKV2Plan | FiveKV2RunWalkPlan;

/** Ključ meta polja sa izmenama u trenutku poslednje adaptacije. */
export const EDITS_KEY = 'fiveKV2Edits';

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const before = (a: string, b: string): boolean => a < b;

/** Datumi treninga plana v2 (dayId jezgra = datum dana; uključuje kontinuirani deo posle prelaza). */
export function trainingDates(v2: AnyV2): Set<string> {
  const out = new Set<string>();
  for (const w of v2.weeks as ReadonlyArray<{ days: ReadonlyArray<{ date: string }> }>)
    for (const d of w.days) out.add(d.date);
  if (v2.planType === 'runWalk' && v2.continuous)
    for (const w of v2.continuous.plan.weeks) for (const d of w.days) out.add(d.date);
  return out;
}

interface DayIndex {
  /** Datum dana po planu (pre pomeranja). */
  origDate: IsoDate;
  /** Datum posle pomeranja. */
  date: IsoDate;
}

/** ID dana aplikacije → datum po planu i datum posle pomeranja (isto pravilo kao razrešen plan). */
function dayIndex(
  plan: GenPlanState,
  moves: Readonly<Record<string, unknown>>
): Map<string, DayIndex> {
  const out = new Map<string, DayIndex>();
  for (const w of plan.weeks) {
    if (!isIsoDate(w.start)) continue;
    for (const d of w.days) {
      if (typeof d.id !== 'string') continue;
      const origDate = addDays(w.start, d.dow);
      const mv = moves[d.id];
      out.set(d.id, { origDate, date: isIsoDate(mv) ? mv : origDate });
    }
  }
  return out;
}

function coverageOf(src: FactsSource, start: IsoDate): CoverageInfo {
  const today = src.today;
  const from0 = before(today, start) ? today : start;
  const synced = (src.sync ?? []).find(
    (s) => s.lastSuccessDate !== null && isIsoDate(s.lastSuccessDate) && s.lastSuccessDate >= today
  );
  const n = num(src.confirmedDays);
  const confirmedFrom = n !== null && Number.isInteger(n) && n >= 1 ? addDays(today, 1 - n) : null;
  if (synced && (confirmedFrom === null || !before(confirmedFrom, from0)))
    return { from: from0, to: today, complete: true, basis: 'sync', source: synced.source };
  if (confirmedFrom !== null)
    return { from: confirmedFrom, to: today, complete: true, basis: 'confirmed' };
  return { from: from0, to: today, complete: false, basis: 'none' };
}

const RESULT_M: readonly number[] = P.input.resultDistancesM;

/** Rezultat trke iz Analize trke (`log[*].raceAi.context`); `null` kad unos nije trka. */
function raceOf(entry: LogEntry): {
  date: unknown;
  distanceM: number | null;
  sec: number | null;
  intent: unknown;
} | null {
  const ai = entry['raceAi'];
  const ctx = ai && typeof ai === 'object' ? (ai as { context?: unknown }).context : undefined;
  if (!ctx || typeof ctx !== 'object') return null;
  const c = ctx as Record<string, unknown>;
  return {
    date: c['date'],
    distanceM: num(c['distanceM']),
    sec: num(c['officialSec']) ?? num(entry.sec),
    intent: c['intent']
  };
}

/** Ručne izmene/pomeranja posle poslednje adaptacije → datumi dana plana v2. */
function lockedDays(
  src: FactsSource,
  idx: ReadonlyMap<string, DayIndex>,
  dates: ReadonlySet<string>,
  notes: string[]
): string[] {
  const snap = (src.plan.meta?.[EDITS_KEY] ?? null) as EditsSnapshot | null;
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  const ids = new Set<string>();
  for (const [id, alt] of Object.entries(src.alts ?? {}))
    if (!snap || !same(alt, snap.alts?.[id])) ids.add(id);
  for (const [id, mv] of Object.entries(src.moves ?? {}))
    if (!snap || !same(mv, snap.moves?.[id])) ids.add(id);
  const out: string[] = [];
  for (const id of [...ids].sort()) {
    const d = idx.get(id);
    if (!d) continue;
    if (dates.has(d.origDate)) {
      if (!out.includes(d.origDate)) out.push(d.origDate);
    } else
      notes.push(
        `Ručna izmena dana ${d.origDate} ostaje kao izmena; dan nije trening plana v2, pa ga adaptacija ne zaključava.`
      );
  }
  return out.sort();
}

/** Podaci aplikacije → činjenice jezgra (`adaptFiveKV2(plan, facts, today)`). */
export function buildFacts(src: FactsSource, v2: AnyV2): BuiltFacts {
  const today = src.today;
  const notes: string[] = [];
  const moves = src.moves ?? {};
  const idx = dayIndex(src.plan, moves);
  const dates = trainingDates(v2);
  const valid = (d: unknown): d is IsoDate => isIsoDate(d) && d <= today;

  // Izvršeno: dnevnik (ručno i uvoz) + trčanja pre plana.
  const workouts: WorkoutFact[] = [];
  for (const id of Object.keys(src.log).sort()) {
    const e = src.log[id]!;
    const status = e.status;
    if (status !== 'done' && status !== 'skip') continue;
    const day = idx.get(id);
    const raw = [e.runDate, e.ts, day?.date].find((x) => isIsoDate(x));
    if (!raw) continue;
    if (raw > today) {
      notes.push(`Unos ${id} (${raw}) je posle danas — ne ulazi.`);
      continue;
    }
    const done = status === 'done';
    const km = done ? Math.max(0, num(e.km) ?? 0) : 0;
    const sec = done ? Math.max(0, num(e.sec) ?? 0) : 0;
    const rpe = num(e['rpe']);
    workouts.push({
      date: raw,
      ...(day && dates.has(day.origDate) ? { dayId: day.origDate } : {}),
      km: Math.round(km * 100) / 100,
      durationSec: Math.round(sec),
      completed: done,
      ...(rpe !== null && rpe >= 1 && rpe <= 10 ? { rpe: Math.round(rpe) } : {})
    });
  }
  for (const [date, km] of Object.entries(src.outOfPlan ?? {}).sort()) {
    const k = num(km);
    if (valid(date) && k !== null && k > 0)
      workouts.push({ date, km: Math.round(k * 100) / 100, durationSec: 0, completed: true });
  }

  // Bol: najveći zapis dana → trening tog dana; bez treninga samo bol ≥ praga v2 (inače bi „zapis" bez trčanja na
  // dan sesije trčanja/hodanja bio propuštena sesija).
  const painByDate = new Map<string, number>();
  for (const r of src.pain ?? []) {
    const p = num(r.pain);
    if (!valid(r.date) || p === null || p < 0 || p > 10) continue;
    painByDate.set(r.date, Math.max(painByDate.get(r.date) ?? 0, p));
  }
  for (const [date, pain] of [...painByDate].sort()) {
    const on = workouts.filter((w) => w.date === date);
    const target = on.find((w) => w.completed) ?? on[0];
    if (target) target.pain = Math.max(target.pain ?? 0, pain);
    else if (pain >= P.adapt.painMin)
      workouts.push({ date, km: 0, durationSec: 0, completed: false, pain });
  }
  workouts.sort((a, b) => a.date.localeCompare(b.date));

  // Rezultati: test 3 km i unete trke punim naporom na 3/5/10 km.
  const results: ResultFact[] = [];
  for (const t of src.tests ?? []) {
    const sec = num(t.sec);
    if (valid(t.date) && sec !== null && sec > 0)
      results.push({ distM: 3000, sec, date: t.date, kind: 'test' });
  }
  for (const id of Object.keys(src.log).sort()) {
    const r = raceOf(src.log[id]!);
    if (!r || !valid(r.date) || r.sec === null || r.sec <= 0) continue;
    if (r.intent !== 'race')
      notes.push(`Trka ${r.date} nije uneta kao trka punim naporom — ne menja tempo.`);
    else if (r.distanceM === null || !RESULT_M.includes(r.distanceM))
      notes.push(
        `Trka ${r.date} (${r.distanceM === null ? '?' : r.distanceM / 1000} km): plan koristi rezultat na 3, 5 ili 10 km — ne menja tempo.`
      );
    else results.push({ distM: r.distanceM, sec: r.sec, date: r.date, kind: 'race' });
  }
  results.sort((a, b) => a.date.localeCompare(b.date));

  // Prijavljene pauze (do danas).
  const breaks: BreakFact[] = [];
  for (const b of src.breaks ?? []) {
    if (!isIsoDate(b.from) || !isIsoDate(b.to) || b.from > b.to || b.from > today) continue;
    breaks.push({ kind: 'break', from: b.from, to: b.to > today ? today : b.to });
  }

  const start = v2.input.startDate as IsoDate;
  const coverage = coverageOf(src, start);
  return {
    facts: {
      workouts,
      results,
      lockedDayIds: lockedDays(src, idx, dates, notes),
      coverage: { from: coverage.from, to: coverage.to, complete: coverage.complete },
      breaks
    },
    coverage,
    notes
  };
}

/** Tekst o pokrivenosti za pregled (šta jezgro sme da zaključi iz dana bez zapisa). */
export function coverageText(c: CoverageInfo): string {
  if (c.basis === 'sync')
    return `Zapis treninga je potpun od ${c.from} do ${c.to} (sinhronizacija ${c.source === 'icu' ? 'intervals.icu' : 'Strava'} uspešna danas): dan bez zapisa znači da nije bilo trčanja.`;
  if (c.basis === 'confirmed')
    return `Potvrdio si da je zapis za proteklih ${diffDays(c.from as IsoDate, c.to as IsoDate) + 1} dana potpun (${c.from} – ${c.to}): dan bez zapisa u tom periodu znači da nije bilo trčanja.`;
  return 'Zapis treninga nije potvrđen kao potpun: dan bez zapisa se ne računa kao propušten ni kao pauza.';
}
