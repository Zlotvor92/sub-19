/* F9 · SLOJ APLIKACIJA ↔ V4: STANJE APLIKACIJE → ULAZ MOTORA (INTEGRACIJA.md § 2a).
   Jedini sastavljač `RunnerFacts` u aplikaciji (F8 § 6.4). Čiste funkcije: ne čitaju store, ne pišu, ne menjaju ulaz.
   Uvozi SAMO javne ulaze V4 (`domain/v4/engine`, `domain/v4/distances/<d>`); proverava `isolation.test.ts`. */
import type {
  Availability,
  DistanceData,
  IsoDate,
  PainFlag,
  Pause,
  Run,
  RunnerFacts,
  RunnerProfile
} from '../../domain/v4/engine';
import { fivek } from '../../domain/v4/distances/fivek';
import { tenk } from '../../domain/v4/distances/tenk';
import { hm } from '../../domain/v4/distances/hm';
import { marathon } from '../../domain/v4/distances/marathon';

/** Podaci distance po `Goal.distanceId`. Distance su podatak; sloj ih samo bira po oznaci. */
export const DISTANCES: Readonly<Record<string, DistanceData>> = Object.freeze({
  [fivek.id]: fivek,
  [tenk.id]: tenk,
  [hm.id]: hm,
  [marathon.id]: marathon
});

export const distanceData = (distanceId: string): DistanceData | null =>
  Object.prototype.hasOwnProperty.call(DISTANCES, distanceId)
    ? (DISTANCES[distanceId] ?? null)
    : null;

export interface FactsInput {
  /** Današnji dan po Beogradu (`YYYY-MM-DD`). */
  today: IsoDate;
  /** Dani trčanja iz čarobnjaka; bez njih važe dani preuzetog plana, a bez oba motor odbija unos (`nema-dana`). */
  availability?: Availability;
  profile?: RunnerProfile;
  /** Trčanja iz zapisa aktivnosti (budući `aktivnost`, F9 § 3), već u obliku `Run`. */
  activities?: readonly Run[];
  /** Prijavljene pauze (bolest, put, povreda). */
  pauses?: readonly Pause[];
  /** `PersistedState.knee` doslovno (zapisi bola). */
  knee?: readonly unknown[];
  /** Činjenice preuzetog plana (`adoptActive`): trčanja iz `log`/`vanPlana`, dani, profil. */
  adopted?: RunnerFacts;
}

const isRec = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const DATE = /^\d{4}-\d{2}-\d{2}/;

/** `knee` → `PainFlag` (isto pravilo kao adapter: datum, bol 1–10, deo tela; ostalo se preskače). */
export function painFromKnee(knee: readonly unknown[]): PainFlag[] {
  const out: PainFlag[] = [];
  for (const k of knee) {
    if (!isRec(k)) continue;
    const date =
      typeof k['date'] === 'string' && DATE.test(k['date']) ? k['date'].slice(0, 10) : null;
    const level = typeof k['pain'] === 'number' && Number.isFinite(k['pain']) ? k['pain'] : null;
    if (date === null || level === null || level < 1 || level > 10) continue;
    const part = typeof k['part'] === 'string' && k['part'] !== '' ? k['part'] : null;
    out.push(part === null ? { date, level } : { date, level, part });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

const byDateId = (a: Run, b: Run): number =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Trčanja preuzetog plana + zapis aktivnosti, bez dvostrukog brojanja:
 * - isti `id` → važi zapis aktivnosti (potpuniji), a `dayId` se zadržava iz preuzetog ako ga aktivnost nema;
 * - `log:<dan>` otpada kad aktivnost nosi isti `dayId` (isto trčanje, unos dana i Strava);
 * - `van:<datum>` (samo km po danu) otpada kad postoji bilo koja aktivnost tog datuma;
 * - `van2:<izvor:ID>` otpada kad postoji aktivnost `<izvor:ID>`.
 */
export function mergeRuns(adopted: readonly Run[], activities: readonly Run[]): Run[] {
  const actById = new Map(activities.map((r) => [r.id, r]));
  const actDays = new Set(activities.flatMap((r) => (r.dayId === undefined ? [] : [r.dayId])));
  const actDates = new Set(activities.map((r) => r.date));
  const out = new Map<string, Run>();
  for (const r of adopted) {
    if (r.id.startsWith('log:') && r.dayId !== undefined && actDays.has(r.dayId)) continue;
    if (r.id.startsWith('van:') && actDates.has(r.date)) continue;
    if (r.id.startsWith('van2:') && actById.has(r.id.slice('van2:'.length))) continue;
    out.set(r.id, r);
  }
  for (const a of activities) {
    const prev = out.get(a.id);
    out.set(
      a.id,
      a.dayId === undefined && prev?.dayId !== undefined ? { ...a, dayId: prev.dayId } : a
    );
  }
  return [...out.values()].sort(byDateId);
}

/**
 * Zapis aktivnosti → dani plana: aktivnost `strava:<id>` / `icu:<id>` dobija `dayId` dana čiji unos u `log` nosi isti
 * `stravaId` / `icuId` (tako je Strava uvoz plana danas upario trčanje sa danom). Tada `mergeRuns` izbacuje
 * `log:<dan>`, pa se isto trčanje ne broji dvaput. Aktivnost koja već ima `dayId` se ne menja.
 */
export function linkActivities(
  activities: readonly Run[],
  log: Readonly<Record<string, unknown>>
): Run[] {
  const byKey = new Map<string, string>();
  for (const [dayId, entry] of Object.entries(log)) {
    if (!isRec(entry)) continue;
    for (const [field, prefix] of [
      ['stravaId', 'strava'],
      ['icuId', 'icu']
    ] as const) {
      const v = entry[field];
      if (typeof v === 'string' || typeof v === 'number') {
        const key = `${prefix}:${String(v)}`;
        if (!byKey.has(key)) byKey.set(key, dayId);
      }
    }
  }
  return activities.map((a) => {
    if (a.dayId !== undefined) return a;
    const dayId = byKey.get(a.id);
    return dayId === undefined ? a : { ...a, dayId };
  });
}

/** Stanje aplikacije → `RunnerFacts`. Isti ulaz daje isti izlaz (redosled trčanja i bolova je određen). */
export function toFacts(input: FactsInput): RunnerFacts {
  const a = input.adopted;
  return {
    today: input.today,
    availability: input.availability ?? a?.availability ?? { runDays: [], longDay: 0 },
    profile: input.profile ?? a?.profile ?? {},
    runs: mergeRuns(a?.runs ?? [], input.activities ?? []),
    pauses: [...(input.pauses ?? a?.pauses ?? [])],
    pain: input.knee !== undefined ? painFromKnee(input.knee) : [...(a?.pain ?? [])],
    ...(a?.painHistory !== undefined ? { painHistory: [...a.painHistory] } : {})
  };
}
