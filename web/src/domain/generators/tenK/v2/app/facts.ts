/* 10K v2 → aplikacija: ČINJENICE ZA ADAPTACIJU (segment 06) — JEDINO mesto gde se podaci aplikacije (dnevnik sa uvozom
   Strava/icu, zapisi bola, rezultat testa 5 km, testovi 3 km, unete trke, stanje sinhronizacije, potvrda korisnika,
   prijavljene pauze, ručne izmene) prevode u činjenice jezgra (`TenKV2Facts`). Ovde se ništa ne odlučuje o planu: odluke
   donosi `adaptTenKV2` (assess). Prevod je kopija obrasca 5K v2 (08b/08c), ne uvoz: `tenK/v2/` ne izlazi iz sebe ni tipom.

   - Izvršeno (`workouts`): unos dnevnika po ID-ju dana (ručno ili uvoz — uvoz se upisuje u isti unos). `date` = stvarni dan
     trčanja (`runDate` uvoza, `ts` korisnika, pa datum dana posle pomeranja); `dayId` = datum dana u planu v2 kad je unos
     vezan za trening v2. `done` → završeno, `skip` → propušteno; unos bez statusa nije činjenica. Trčanja pre plana
     (`vanPlana`, samo km) i uvezena trčanja koja nisu uparena sa danom plana (`vanPlanaV2`) ulaze bez `dayId` (jezgro:
     van plana = lagan); zapis čiju aktivnost dnevnik već nosi (`stravaId`/`icuId`) se ne broji dvaput. Bol iz zapisa bola
     (najveći tog dana) ide na trening tog dana; bol ≥ praga v2 bez treninga tog dana ide kao zaseban zapis bez trčanja.
   - Rezultati: test 5 km plana (`test5kSec` na unosu dana — vreme 5 km, ne cele sesije sa WU/CD), test 3 km (`t3k`) i trka
     uneta u Analizi trke (`raceAi.context`, napor „trka", 3/5/10 km ili polumaraton).
   - Pokrivenost: potpuna SAMO kad je (a) povezan izvor čija je poslednja POTPUNA sinhronizacija (`fullSync`) ≥ danas, za
     period od početka plana i ne pre početka perioda te sinhronizacije, ili (b) korisnik potvrdi „zapis za proteklih N dana
     je potpun". Inače nepotpuna — dan bez zapisa je nepoznat, ne pauza. Aktivnost koju sinhronizacija nije obradila čini
     njen dan nepoznatim (pokrivenost počinje dan posle nje; bez dana je nepotpuna); razlog ide u `notes`.
   - Pauze: samo eksplicitno prijavljene (Prilagodi plan → Pauza).
   - Zaključani dani: ručna izmena ili pomeranje dana posle poslednje adaptacije (`meta.tenKV2Edits` = izmene u trenutku
     poslednje primenjene adaptacije; bez njega — sve izmene od nastanka plana).
   Šta nije ušlo i zašto ide u `notes` (bez tihog odbacivanja). Bez sata: `today` je ulaz. */

import { TEN_K_V2_POLICY as P } from '../policy.ts';
import type {
  BreakFact,
  FactsCoverage,
  ResultDistanceM,
  ResultFact,
  TenKV2Plan,
  WorkoutFact
} from '../types.ts';
import { addDays, diffDays, isIsoDate } from './date.ts';
import type {
  AppPlan,
  IsoDate,
  LogEntry,
  OffPlanRunRecord,
  PainRecord,
  SyncIssue,
  T3kRecord
} from './types.ts';

/** Povezan izvor sinhronizacije treninga (stanje priprema aplikacija; datum je lokalni kalendarski dan). */
export interface SyncSource {
  source: 'strava' | 'icu';
  /** Dan poslednje POTPUNE sinhronizacije (`fullSync`); `null` = nijedne. */
  lastSuccessDate: IsoDate | null;
  /** Prvi dan perioda te sinhronizacije (pre njega izvor nije proveren); izostavljeno = ceo plan. */
  fromDate?: IsoDate | null;
  /** Šta poslednja sinhronizacija nije obradila (dan nepoznat). */
  issues?: readonly SyncIssue[];
}

/** Eksplicitno prijavljena pauza (od–do, uključivo). */
export interface ReportedBreak {
  from: string;
  to: string;
}

/** Ručne izmene u trenutku poslednje primenjene adaptacije (upisuje ih adaptacija u `meta.tenKV2Edits`). */
export interface EditsSnapshot {
  alts: Readonly<Record<string, unknown>>;
  moves: Readonly<Record<string, unknown>>;
}

/** Sve što aplikacija zna, u svom formatu. Prazno/izostavljeno = nema podataka (ne pauza). */
export interface FactsSource {
  today: IsoDate;
  plan: AppPlan;
  log: Readonly<Record<string, LogEntry>>;
  /** Trčanja pre plana: datum → km (`vanPlana`). */
  outOfPlan?: Readonly<Record<string, number>>;
  /** Uvezena trčanja koja nisu uparena sa danom plana (`vanPlanaV2`, ključ `izvor:ID`). */
  offPlanRuns?: Readonly<Record<string, OffPlanRunRecord>>;
  pain?: readonly PainRecord[];
  tests?: readonly T3kRecord[];
  /** Povezani izvori sinhronizacije treninga. */
  sync?: readonly SyncSource[];
  /** Korisnik je potvrdio da je zapis za proteklih N dana potpun (u toku prilagođavanja). */
  confirmedDays?: number | null;
  breaks?: readonly ReportedBreak[];
  alts?: Readonly<Record<string, unknown>>;
  moves?: Readonly<Record<string, unknown>>;
}

export interface CoverageInfo extends FactsCoverage {
  basis: 'sync' | 'confirmed' | 'none';
  source?: 'strava' | 'icu';
  /** Poslednji dan sa neobrađenom aktivnošću (pokrivenost počinje posle njega); `'?'` = dan nepoznat. */
  unprocessed?: string;
}

/** Činjenice jezgra sa svim poljima (prazno = nema podataka). */
export interface Facts {
  workouts: WorkoutFact[];
  results: ResultFact[];
  lockedDayIds: string[];
  coverage: FactsCoverage;
  breaks: BreakFact[];
}

export interface BuiltFacts {
  facts: Facts;
  coverage: CoverageInfo;
  /** Podaci koji nisu ušli u činjenice, sa razlogom. */
  notes: string[];
}

/** Ključ meta polja sa izmenama u trenutku poslednje adaptacije. */
export const EDITS_KEY = 'tenKV2Edits';
/** Polje unosa dana sa vremenom testa 5 km [s] (samo deonica testa, bez zagrevanja i hlađenja). */
export const TEST_FIELD = 'test5kSec';
/** Distanca testa plana (D27) [m]. */
export const TEST_M = (P.test.km * 1000) as ResultDistanceM;

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const before = (a: string, b: string): boolean => a < b;

/** Faza 3 (3d-10K): potvrđena pauza iz predaje (N dana do dana potvrde) kao činjenica pauze cilja — prevod je samo ovde. */
export function confirmedBreakFact(date: IsoDate, days: number): BreakFact {
  return { kind: 'break', from: addDays(date, 1 - days), to: date };
}

/** Datumi treninga plana v2 (dayId jezgra = datum dana). */
export function trainingDates(v2: TenKV2Plan): Set<string> {
  const out = new Set<string>();
  for (const w of v2.weeks) for (const d of w.days) out.add(d.date);
  return out;
}

interface DayIndex {
  /** Datum dana po planu (pre pomeranja). */
  origDate: IsoDate;
  /** Datum posle pomeranja. */
  date: IsoDate;
}

/** ID dana aplikacije → datum po planu i datum posle pomeranja (isto pravilo kao razrešen plan). */
function dayIndex(plan: AppPlan, moves: Readonly<Record<string, unknown>>): Map<string, DayIndex> {
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

const SOURCE: Record<SyncSource['source'], string> = { strava: 'Strava', icu: 'intervals.icu' };

function coverageOf(src: FactsSource, start: IsoDate, notes: string[]): CoverageInfo {
  const today = src.today;
  const from0 = before(today, start) ? today : start;
  const synced = (src.sync ?? []).find(
    (s) => s.lastSuccessDate !== null && isIsoDate(s.lastSuccessDate) && s.lastSuccessDate >= today
  );
  const syncFrom =
    synced && isIsoDate(synced.fromDate) && before(from0, synced.fromDate)
      ? synced.fromDate
      : from0;
  const n = num(src.confirmedDays);
  const confirmedFrom = n !== null && Number.isInteger(n) && n >= 1 ? addDays(today, 1 - n) : null;
  const base: CoverageInfo =
    synced && (confirmedFrom === null || !before(confirmedFrom, syncFrom))
      ? { from: syncFrom, to: today, complete: true, basis: 'sync', source: synced.source }
      : confirmedFrom !== null
        ? { from: confirmedFrom, to: today, complete: true, basis: 'confirmed' }
        : { from: from0, to: today, complete: false, basis: 'none' };
  // Neobrađena aktivnost — njen dan (i, jer je pokrivenost jedan opseg do danas, svi pre njega) je nepoznat.
  let last: string | null = null;
  let undated = false;
  const issues = (src.sync ?? []).flatMap((s) => (s.issues ?? []).map((x) => ({ s, x })));
  for (const { s, x } of issues) {
    const day = isIsoDate(x.date) && x.date <= today ? x.date : null;
    if (x.date === null) undated = true;
    else if (day !== null && (last === null || before(last, day))) last = day;
    if (notes.length < 40)
      notes.push(
        `${SOURCE[s.source]}: ${x.id !== null ? `aktivnost ${x.id}` : 'spisak'}${x.date !== null ? ` (${x.date})` : ''} nije obrađena — ${x.reason}; ${x.date !== null ? `dan ${x.date} nije poznat` : 'dan nije poznat'}.`
      );
  }
  if (!base.complete) return base;
  if (undated) return { ...base, complete: false, unprocessed: '?' };
  if (last !== null && !before(last, base.from)) {
    const from = addDays(last, 1);
    return before(today, from)
      ? { ...base, complete: false, unprocessed: last }
      : { ...base, from, unprocessed: last };
  }
  return base;
}

const RESULT_M: readonly number[] = P.input.resultDistancesM;
const distText = (m: number): string => (m === 21097.5 ? 'polumaraton' : `${m / 1000} km`);

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
  const meta = (src.plan.meta ?? {}) as Record<string, unknown>;
  const snap = (meta[EDITS_KEY] ?? null) as EditsSnapshot | null;
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

/** Podaci aplikacije → činjenice jezgra (`adaptTenKV2(plan, facts, today)`). */
export function buildFacts(src: FactsSource, v2: TenKV2Plan): BuiltFacts {
  const today = src.today;
  const notes: string[] = [];
  const moves = src.moves ?? {};
  const idx = dayIndex(src.plan, moves);
  const dates = trainingDates(v2);
  const valid = (d: unknown): d is IsoDate => isIsoDate(d) && d <= today;
  /** Stvarni dan unosa: dan uvoza, dan korisnika, pa datum dana posle pomeranja. */
  const dateOf = (id: string, e: LogEntry): IsoDate | undefined =>
    [e.runDate, e.ts, idx.get(id)?.date].find((x): x is IsoDate => isIsoDate(x));

  // Izvršeno: dnevnik (ručno i uvoz) + trčanja pre plana.
  const workouts: WorkoutFact[] = [];
  for (const id of Object.keys(src.log).sort()) {
    const e = src.log[id]!;
    const status = e.status;
    if (status !== 'done' && status !== 'skip') continue;
    const day = idx.get(id);
    const raw = dateOf(id, e);
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
  // Trčanja van plana (od prvog dana plana; pre njega važi `vanPlana`).
  const start = v2.input.startDate;
  const inLog = new Set<string>();
  for (const e of Object.values(src.log))
    for (const [k, srcName] of [
      ['stravaId', 'strava'],
      ['icuId', 'icu']
    ] as const)
      if (typeof e[k] === 'string' || typeof e[k] === 'number') inLog.add(`${srcName}:${e[k]}`);
  for (const [key, r] of Object.entries(src.offPlanRuns ?? {}).sort()) {
    const km = num(r.km);
    const sec = num(r.sec);
    if (!isIsoDate(r.date) || before(r.date, start)) continue;
    if (r.date > today) {
      notes.push(`Trčanje van plana ${key} (${r.date}) je posle danas — ne ulazi.`);
      continue;
    }
    if (inLog.has(key)) {
      notes.push(
        `Trčanje ${key} (${r.date}) je u dnevniku dana plana — van plana se ne broji dvaput.`
      );
      continue;
    }
    const k = km !== null && km > 0 ? Math.round(km * 100) / 100 : 0;
    const d = sec !== null && sec > 0 ? Math.round(sec) : 0;
    if (k > 0 || d > 0) workouts.push({ date: r.date, km: k, durationSec: d, completed: true });
  }

  // Bol: najveći zapis dana → trening tog dana; bez treninga samo bol ≥ praga v2.
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

  // Rezultati: test 5 km plana (na unosu dana), test 3 km, unete trke punim naporom.
  const results: ResultFact[] = [];
  for (const id of Object.keys(src.log).sort()) {
    const e = src.log[id]!;
    if (e[TEST_FIELD] === undefined || e[TEST_FIELD] === null) continue;
    const sec = num(e[TEST_FIELD]);
    const date = dateOf(id, e);
    if (sec === null || sec <= 0 || !date)
      notes.push(`Test ${P.test.km} km (${id}): vreme ili datum nisu ispravni — ne menja tempo.`);
    else if (date > today) notes.push(`Test ${P.test.km} km ${date} je posle danas — ne ulazi.`);
    else results.push({ distM: TEST_M, sec, date, kind: 'test' });
  }
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
        `Trka ${r.date} (${r.distanceM === null ? '?' : distText(r.distanceM)}): plan koristi rezultat na 3, 5 ili 10 km ili polumaratonu — ne menja tempo.`
      );
    else
      results.push({
        distM: r.distanceM as ResultDistanceM,
        sec: r.sec,
        date: r.date,
        kind: 'race'
      });
  }
  results.sort((a, b) => a.date.localeCompare(b.date));

  // Prijavljene pauze (do danas).
  const breaks: BreakFact[] = [];
  for (const b of src.breaks ?? []) {
    if (!isIsoDate(b.from) || !isIsoDate(b.to) || b.from > b.to || b.from > today) continue;
    breaks.push({ kind: 'break', from: b.from, to: b.to > today ? today : b.to });
  }

  const coverage = coverageOf(src, start, notes);
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
  const gap =
    c.unprocessed === undefined
      ? ''
      : c.unprocessed === '?'
        ? ' Sinhronizacija nije obradila sve aktivnosti (dan nepoznat).'
        : ` Sinhronizacija nije obradila aktivnost od ${c.unprocessed}: taj dan i raniji nisu poznati.`;
  if (!c.complete)
    return `Zapis treninga nije potvrđen kao potpun: dan bez zapisa se ne računa kao propušten ni kao pauza.${gap}`;
  if (c.basis === 'sync')
    return `Zapis treninga je potpun od ${c.from} do ${c.to} (sinhronizacija ${c.source === 'icu' ? 'intervals.icu' : 'Strava'} danas preuzela i obradila sve aktivnosti): dan bez zapisa znači da nije bilo trčanja.${gap}`;
  return `Potvrdio si da je zapis za proteklih ${diffDays(c.from, c.to) + 1} dana potpun (${c.from} – ${c.to}): dan bez zapisa u tom periodu znači da nije bilo trčanja.${gap}`;
}
