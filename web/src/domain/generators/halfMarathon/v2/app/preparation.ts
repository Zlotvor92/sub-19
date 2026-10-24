/* HM v2 → aplikacija: HM v2 kao IZVOR predaje „kraća distanca" (faza 3, segment 3c; DESIGN.md § 3 P1–P5, § 8).

   - Okidač je u domenu (`../shorter.ts`, O1): posle prihvaćene adaptacije najduži dugi je ispod praga upozorenja, a
     plan generatora za isti ulaz nije.
   - Opcije (O2a): kraća distanca istog datuma — 10K, pa 5K (redom kao v1); prva koju cilj pokriva. „Zadrži plan v2"
     je uvek moguće: odluka ne menja plan, samo predlaže. Nedostupna opcija nosi razlog cilja doslovno (O4a/O5a).
   - Činjenice (P2): izvor šalje ulaz čarobnjaka bez izvedenih polja i činjenice izvršenja. Ne šalje politiku (`policy:
     null`), bazu zaštite rasta ni korake adaptacije (`startKm`, `levelKm`, `returnFrom` …). Potvrđeno izvršenje
     (`executionBasis`) dolazi iz potvrde korisnika i opisa 28 dana, sa `startingKm = reportedBaseKm`. Ulaz je saglasan
     (start = dan posle potvrde). `raw` su sirove činjenice (`./facts.ts`) bez `dayId` i zaključanih dana izvora.
   - Format izvora za v1 cilj (`HM_V2_SOURCE_FORMAT`): JEDINO mesto spiska ključeva koje piše samo HM v2.
   Cilj (funkciju predaje) daje `select.ts` kao argument; ovde se ne uvozi ništa van `halfMarathon/v2/`. */

import { shorterOffer, longWarnKmOf } from '../shorter.ts';
import { longestLong10 } from '../lengths.ts';
import type { HmV2Plan } from '../types.ts';
import { v2Of } from './adapt.ts';
import { addDays, isIsoDate } from './date.ts';
import { buildFacts, EDITS_KEY } from './facts.ts';
import { PREFIX_KEY } from './plan.ts';
import { sourceOf } from './members.ts';
import type { AppPlan, IsoDate } from './types.ts';

const HM_M = 21097.5;
/** Kraće distance istog datuma, redom (kao HM v1 `SHORTER`). */
const SHORTER = [10000, 5000] as const;
const NAME: Readonly<Record<number, string>> = { 10000: '10K', 5000: '5K' };
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Ključ objekta plana v2, ostali ključevi plana i meta ključevi koje piše samo HM v2 (ili koji opisuju cilj izvora) — v1 cilj ih ne nasleđuje
 *  (`handoff.ts` `sourceViewForV1`). Ključeve koje piše i v1 cilj (`trainingVdot`, `racePace` …) cilj prepisuje. */
export const HM_V2_SOURCE_FORMAT = {
  planKey: 'hmV2',
  // REVIEW-3 #1: plan HM v2 nastao predajom (maraton v2 → HM v2, 3f) nosi nedelje izvora pod ključem najvišeg nivoa.
  planKeys: [PREFIX_KEY],
  metaKeys: ['vdot', 'paceBasis', 'predictedHmSec', 'goalVdot', 'goalAssessment', EDITS_KEY]
} as const;

/* ---------- lokalni strukturni oblici ugovora (tip formata daje granica u `select.ts`) ---------- */
type Meta = Record<string, unknown> | undefined;
interface Execution {
  date: IsoDate;
  reason?: 'confirmed-break' | 'fatigue' | 'reduced-volume';
  breakDays: number;
  reportedBaseKm: number;
  startingKm: number;
  reportedLongRunKm?: number;
}
export interface ContractInput {
  startDate: string;
  raceDate: string;
  raceDistM?: number;
  pb?: { distM: number; sec: number; date?: string };
  weeklyKm: number;
  recentLongRunKm?: number;
  /** 3d-dopuna: lak tempo iz čarobnjaka (činjenica korisnika, plan po osećaju); izostavljen kad ga ulaz nema. */
  easyPaceSecPerKm?: number;
  runDays: number;
  runDows: number[];
  lrDow?: number;
  intensity: 'std';
  goalSec: number | null;
  trainedRecently: boolean;
}
export interface Basis {
  input: ContractInput;
  policy: null;
  execution: Execution | null;
}
interface HandoffFacts {
  execution: Execution | null;
  restartFromBase: boolean;
  notes?: string[];
  meta?: Record<string, unknown>;
  raw?: Readonly<Record<string, unknown>>;
}
type Built = {
  result: { meta?: Meta } & Record<string, unknown>;
  coverage: 'full' | 'distance' | 'insufficient';
};
type Target = (
  current: never,
  input: ContractInput,
  today: IsoDate,
  context: never,
  facts: HandoffFacts
) => Built | { error: string };
/** Funkcija predaje (iz `select.ts`, `shorterHandoffForV2Source`): cilj za distancu ili `null`. */
export type Handoff = (raceDistM: number | undefined) => Target | null;
type Context = Parameters<typeof sourceOf>[2];

/** Poslednji rezultat (P2: činjenica) poznat na dan `onOrBefore` (start ulaza ugovora; v1 cilj traži rezultat koji
 *  nije posle starta) — iz ulaza čarobnjaka ili iz koraka adaptacije (`step.result`: test plana ili trka); noviji po
 *  datumu, kod istog datuma korak. `null` = nema rezultata do tog dana. (3c-dopuna 2, obrazac 3e.) */
export function lastResult(
  v2: HmV2Plan,
  onOrBefore: IsoDate
): { distM: number; sec: number; date: string } | null {
  const r = v2.input.recentResult;
  let best =
    r && r.date <= onOrBefore ? { distM: r.distanceM, sec: r.timeSec, date: r.date } : null;
  for (const step of v2.adaptation?.steps ?? [])
    if (step.result && step.result.date <= onOrBefore && (!best || step.result.date >= best.date))
      best = { distM: step.result.distM, sec: step.result.sec, date: step.result.date };
  return best;
}

/** Ulaz ugovora iz ulaza HM v2 — samo činjenice čarobnjaka (bez izvedenih polja; lak tempo je činjenica, 3d-dopuna) i
 *  poslednji rezultat (`lastResult`). `intensity: 'std'`: v2 nema izbor intenziteta; v1 cilj ga traži kao obavezno
 *  polje (neutralna vrednost, ne odluka izvora). */
export function contractInput(v2: HmV2Plan, startDate?: IsoDate): ContractInput {
  const i = v2.input;
  const runDows = i.runDays.map((d) => WEEKDAYS.indexOf(d) + 1);
  const start = startDate ?? i.startDate;
  const pb = lastResult(v2, start);
  return {
    startDate: start,
    raceDate: i.raceDate,
    raceDistM: HM_M,
    ...(pb ? { pb } : {}),
    weeklyKm: i.currentWeeklyKm,
    ...(i.recentLongRunKm != null ? { recentLongRunKm: i.recentLongRunKm } : {}),
    ...(i.easyPaceSecPerKm != null ? { easyPaceSecPerKm: i.easyPaceSecPerKm } : {}),
    runDays: runDows.length,
    runDows,
    ...(i.longRunDay ? { lrDow: WEEKDAYS.indexOf(i.longRunDay) + 1 } : {}),
    intensity: 'std',
    goalSec: i.goalTimeSec ?? null,
    trainedRecently: i.experience !== 'beginner'
  };
}

/** Sirove činjenice izvora za cilj (P2): zapisi sa datumom bez `dayId` izvora, bez zaključanih dana izvora. */
export function rawFacts(
  current: AppPlan,
  today: IsoDate,
  context: Context
): Record<string, unknown> {
  const v2 = v2Of(current);
  if (!v2) return {};
  const { lockedDayIds: _locked, ...facts } = buildFacts(
    sourceOf(current, today, context),
    v2
  ).facts;
  return { ...facts, workouts: facts.workouts.map(({ dayId: _d, ...w }) => w) };
}

/* ---------- PreparationApi ---------- */

/** Osnova odluke iz sačuvanog plana: ulaz čarobnjaka, bez politike i bez izvršenja. Plan v2 nema potvrđeno izvršenje
 *  u planu, pa ga ovde nema; potvrda ide kroz `executionBasis`. */
export function basisFromPlan(current: AppPlan, _today: IsoDate): Basis | null {
  const v2 = v2Of(current);
  return v2 ? { input: contractInput(v2), policy: null, execution: null } : null;
}

/** Potvrđeno izvršenje (član `executionBasis`): potvrda korisnika (pauza, baza, dužina) + opis 28 dana. Bez politike:
 *  `startingKm = reportedBaseKm`, a cilj sam izvodi početak. Ulaz je saglasan (start = dan posle potvrde). Razlog je
 *  samo činjenica potvrde: pauza → `confirmed-break`, inače `reduced-volume` (umor se ne pogađa). `returning`, `base`,
 *  `weeklyKm` (oblik ugovora) su iste potvrđene činjenice, ne izvedeni ulaz. */
export function executionBasis(
  current: AppPlan,
  today: IsoDate,
  analysis: { actualKm?: number } | null,
  options: { breakDays?: number; weeklyKm?: number; recentLongRunKm?: number }
): (Basis & { returning: boolean; base: number; weeklyKm: number }) | { error: string } {
  const v2 = v2Of(current);
  if (!v2 || !isIsoDate(today)) return { error: 'Plan nema podatke potrebne za ovu odluku.' };
  const brk = options.breakDays;
  if (brk !== undefined && (!Number.isInteger(brk) || brk < 7 || brk > 365))
    return { error: 'Potvrdi trajanje pauze od 7 do 365 dana.' };
  const base =
    options.weeklyKm ?? (analysis?.actualKm !== undefined ? analysis.actualKm / 4 : undefined);
  if (typeof base !== 'number' || !Number.isFinite(base) || base <= 0 || base > 200)
    return { error: 'Unesi ponovljivu nedeljnu bazu veću od nule, do 200 km.' };
  const lr = options.recentLongRunKm;
  if (lr !== undefined && (!Number.isFinite(lr) || lr <= 0 || lr > base))
    return { error: 'Ponovljiva dužina mora biti pozitivna i ne veća od nedeljne baze.' };
  const km = Math.round(base * 10) / 10;
  return {
    returning: brk !== undefined,
    base: km,
    weeklyKm: km,
    input: contractInput(v2, addDays(today, 1)),
    policy: null,
    execution: {
      date: today,
      reason: brk !== undefined ? 'confirmed-break' : 'reduced-volume',
      breakDays: brk ?? 0,
      reportedBaseKm: km,
      startingKm: km,
      ...(lr !== undefined ? { reportedLongRunKm: lr } : {})
    }
  };
}

/** O1: plan je ograničena priprema (ponuda „kraća distanca"). `meta` sam nije dovoljan (nema nedelje). */
export function isLimitedLongPreparation(_meta: unknown, plan?: AppPlan): boolean {
  const v2 = plan ? v2Of(plan) : null;
  return !!v2 && shorterOffer(v2);
}

function factsFor(basis: Basis, current: AppPlan, today: IsoDate, context: Context): HandoffFacts {
  return {
    execution: basis.execution,
    restartFromBase: basis.execution !== null,
    notes: [],
    meta: {},
    raw: rawFacts(current, today, context)
  };
}

function build(
  current: AppPlan,
  today: IsoDate,
  basis: Basis,
  context: Context,
  dist: number,
  handoff: Handoff
): Built | { error: string } {
  const target = handoff(dist);
  if (!target) return { error: `Za ${NAME[dist] ?? dist} nema generatora.` };
  return target(
    current as never,
    { ...basis.input, raceDistM: dist, goalSec: null },
    today,
    context as never,
    factsFor(basis, current, today, context)
  );
}

/** Ključevi objekta plana v2 cilja (10K v2, 5K v2; 3d) — čitaju se strukturno, bez uvoza tipova cilja (uslov 7). */
const V2_TARGET_KEYS = ['tenKV2', 'fiveKV2'] as const;
/** Vrh dugog i obima plana cilja: v1 cilj — `meta.preparation`; v2 cilj — objekat plana v2 (`peakKm`, najduži dugi
 *  njegovih nedelja; prefiks izvora nije u njemu). Obrazac 3e (`marathon/v2/app/preparation.ts`), kopija. */
type V2Peaks = {
  peakKm?: number;
  weeks?: readonly { days: readonly { role?: string; workout?: { km?: number } }[] }[];
};
function peaksOf(result: Built['result']): { longKm: number; weeklyKm: number } {
  const prep = (
    (result.meta ?? {}) as { preparation?: { peakLongRunKm?: number; peakWeeklyKm?: number } }
  ).preparation;
  if (prep) return { longKm: prep.peakLongRunKm ?? 0, weeklyKm: prep.peakWeeklyKm ?? 0 };
  const found: unknown = V2_TARGET_KEYS.map((k) => result[k]).find((x) => x != null);
  const v2 = found as V2Peaks | undefined;
  if (!v2) return { longKm: 0, weeklyKm: 0 };
  const longs = (v2.weeks ?? []).flatMap((w) =>
    w.days.filter((d) => d.role === 'long').map((d) => d.workout?.km ?? 0)
  );
  return { longKm: Math.max(0, ...longs), weeklyKm: v2.peakKm ?? 0 };
}

export interface Option {
  id: string;
  choice: { kind: 'shorter'; raceDistM: number };
  title: string;
  detail: string;
  raceDate: IsoDate;
  raceDistM: number;
  goalSec: number | null;
  coverage: 'full' | 'distance' | 'insufficient';
  peakLongRunKm: number;
  peakWeeklyKm: number;
}
export interface Decision {
  status: 'rejected' | 'limited';
  fullPreparation: false;
  statement: string;
  conditions: string[];
  options: Option[];
  unavailable: string[];
}

/** Odluka: opcija kraće distance (prva koju cilj pokriva) i razlozi nedostupnih; plan se ne menja. */
export function preparationDecision(
  current: AppPlan,
  today: IsoDate,
  basis: Basis,
  context: Context,
  status: 'rejected' | 'limited',
  _delivered: unknown,
  handoff: Handoff
): Decision {
  const v2 = v2Of(current);
  const longest = v2 ? longestLong10(v2.weeks) / 10 : 0;
  const warn = v2 ? longWarnKmOf(v2) : null;
  const options: Option[] = [];
  const unavailable: string[] = [];
  for (const dist of SHORTER) {
    const built = build(current, today, basis, context, dist, handoff);
    if ('error' in built) {
      unavailable.push(`${NAME[dist]}: ${built.error}`);
      continue;
    }
    if (built.coverage === 'insufficient') {
      unavailable.push(`${NAME[dist]}: plan te distance do trke ne pokriva potrebnu dužinu.`);
      continue;
    }
    const meta = (built.result.meta ?? {}) as {
      raceName?: string;
    };
    const name = meta.raceName ?? NAME[dist]!;
    options.push({
      id: `shorter-${dist}`,
      choice: { kind: 'shorter', raceDistM: dist },
      title: `Kraća distanca: ${name} istog datuma`,
      detail:
        built.coverage === 'full'
          ? `Isporučen plan ispunjava pravila pune pripreme za ${name}. Vremenski cilj polumaratona se ne prenosi.`
          : `Dužina pokriva ${name}, ali nedeljni vrhunac ne podržava vremenski cilj. Vremenski cilj polumaratona se ne prenosi.`,
      raceDate: basis.input.raceDate,
      raceDistM: dist,
      goalSec: null,
      coverage: built.coverage,
      peakLongRunKm: peaksOf(built.result).longKm,
      peakWeeklyKm: peaksOf(built.result).weeklyKm
    });
    break;
  }
  return {
    status,
    fullPreparation: false,
    statement: `Posle prilagođavanja najduži dugi u planu je ${String(longest).replace('.', ',')} km, ispod ${warn ?? ''} km: ovo nije puna priprema za polumaraton.`,
    conditions: [
      'Zadrži plan v2: plan polumaratona ostaje kakav je posle prilagođavanja; kraća distanca je samo predlog.'
    ],
    options,
    unavailable
  };
}

/** Pregled izabrane opcije: plan kraće distance (cilj ga pravi) za upis posle potvrde. Samo „kraća distanca". */
export function buildPreparationChoice(
  current: AppPlan,
  today: IsoDate,
  basis: Basis,
  choice: { kind: string; raceDistM?: number },
  context: Context,
  handoff: Handoff
):
  | {
      result: object;
      summary: string;
      notes: string[];
      change: {
        from: { raceDate: string; raceDistM: number; goalSec: number | null };
        to: { raceDate: string; raceDistM: number; goalSec: number | null };
      };
    }
  | { error: string } {
  if (choice.kind !== 'shorter' || !SHORTER.includes(choice.raceDistM as (typeof SHORTER)[number]))
    return {
      error: 'Plan polumaratona v2 nudi samo kraću distancu istog datuma (ili zadržavanje plana).'
    };
  const dist = choice.raceDistM!;
  const built = build(current, today, basis, context, dist, handoff);
  if ('error' in built) return built;
  const name = ((built.result.meta ?? {}) as { raceName?: string }).raceName ?? NAME[dist]!;
  return {
    result: built.result,
    summary: `Kraća distanca: ${name} istog datuma`,
    notes: [],
    change: {
      from: { raceDate: basis.input.raceDate, raceDistM: HM_M, goalSec: basis.input.goalSec },
      to: { raceDate: basis.input.raceDate, raceDistM: dist, goalSec: null }
    }
  };
}
