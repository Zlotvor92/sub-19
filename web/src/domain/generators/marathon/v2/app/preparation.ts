/* Maraton v2 → aplikacija: maraton v2 kao IZVOR predaje „kraća distanca" (faza 3, segment 3e; DESIGN.md § 3 P1–P5,
   § 8). Kopija obrasca HM v2 3c (`halfMarathon/v2/app/preparation.ts`), ne uvoz.

   - Okidač je u domenu (`../shorter.ts`, O1): posle prihvaćene adaptacije najduži dugi je ispod praga
     MARATHON_LONG_SHORT, a plan generatora za isti ulaz nije.
   - Opcije (O2a): kraća distanca istog datuma — polumaraton, pa 10K (redom kao maraton v1); prva koju cilj pokriva.
     „Zadrži plan v2" je uvek moguće: odluka ne menja plan, samo predlaže. Nedostupna opcija nosi razlog cilja doslovno
     (O4a/O5a/O8a).
   - Činjenice (P2): izvor šalje ulaz čarobnjaka bez izvedenih polja, poslednji rezultat (iz ulaza ili `step.result`
     koraka adaptacije — činjenica, ne odluka) i činjenice izvršenja. Ne šalje politiku (`policy: null`), bazu zaštite
     rasta ni ograničenja koraka adaptacije (`startKm`, `levelKm`, `returnFrom` …). Potvrđeno izvršenje (`executionBasis`) dolazi iz potvrde
     korisnika i opisa 28 dana, sa `startingKm = reportedBaseKm`. Ulaz je saglasan (start = dan posle potvrde). `raw`
     su sirove činjenice (`./facts.ts`) bez `dayId` i zaključanih dana izvora.
   - Format izvora za v1 cilj (`MARATHON_V2_SOURCE_FORMAT`): JEDINO mesto spiska ključeva koje piše samo maraton v2.
   - Vrh opcije: v1 cilj ga daje u `meta.preparation`; plan HM v2 cilja nema `meta.preparation` (predaja 3f), pa se vrh
     čita iz objekta plana v2 cilja (`hmV2`: `peakKm`, najduži dugi njegovih nedelja), strukturno.
   Cilj (funkciju predaje) daje `select.ts` kao argument; ovde se ne uvozi ništa van `marathon/v2/`. */

import { longShortKmOf, shorterOffer } from '../shorter.ts';
import type { MarathonV2Plan } from '../types.ts';
import { v2Of } from './adapt.ts';
import { addDays, isIsoDate } from './date.ts';
import { buildFacts, EDITS_KEY } from './facts.ts';
import { sourceOf } from './members.ts';
import type { AppPlan, IsoDate } from './types.ts';

const MAR_M = 42195;
const HM_M = 21097.5;
/** Kraće distance istog datuma, redom (kao maraton v1 `SHORTER`). */
const SHORTER = [HM_M, 10000] as const;
const NAME: Readonly<Record<number, string>> = { [HM_M]: 'Polumaraton', 10000: '10K' };
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Ključ objekta plana v2 i meta ključevi koje piše samo maraton v2 (ili koji opisuju cilj izvora; `EDITS_KEY` =
 *  snimak izmena u trenutku adaptacije v2) — v1 cilj ih ne nasleđuje (`handoff.ts` `sourceViewForV1`). Ključeve koje
 *  piše i v1 cilj (`trainingVdot`, `racePace`, `vdot0` …) cilj prepisuje. */
export const MARATHON_V2_SOURCE_FORMAT = {
  planKey: 'marathonV2',
  metaKeys: [
    'vdot',
    'paceBasis',
    'mpVdot',
    'predictedMarathonSec',
    'goalVdot',
    'goalAssessment',
    EDITS_KEY
  ]
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
  /** Lak tempo iz čarobnjaka kad postoji (činjenica, DESIGN § 8 „Lak tempo"; v2 cilj ga traži bez svežeg rezultata). */
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
 *  nije posle starta) — iz ulaza čarobnjaka ili iz koraka adaptacije (`step.result`: test 5 km plana ili trka); noviji
 *  po datumu, kod istog datuma korak. `null` = nema rezultata do tog dana. */
export function lastResult(
  v2: MarathonV2Plan,
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

/** Ulaz ugovora iz ulaza maratona v2 — samo činjenice čarobnjaka (bez izvedenih polja) i poslednji rezultat
 *  (`lastResult`). `intensity: 'std'`: v2 nema izbor intenziteta; v1 cilj ga traži kao obavezno polje (neutralna
 *  vrednost, ne odluka izvora). Lak tempo kad ga čarobnjak ima (činjenica, DESIGN § 8). */
export function contractInput(v2: MarathonV2Plan, startDate?: IsoDate): ContractInput {
  const i = v2.input;
  const runDows = i.runDays.map((d) => WEEKDAYS.indexOf(d) + 1);
  const start = startDate ?? i.startDate;
  const pb = lastResult(v2, start);
  return {
    startDate: start,
    raceDate: i.raceDate,
    raceDistM: MAR_M,
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
  if (!v2 || !isIsoDate(today)) return { error: 'Plan nema podatke maratona v2.' };
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

/** Ključevi objekta plana v2 cilja (HM v2 3f, 10K v2 3d-10K) — čitaju se strukturno, bez uvoza tipova cilja. */
const V2_TARGET_KEYS = ['hmV2', 'tenKV2'] as const;
/** Vrh dugog i obima plana cilja: v1 cilj — `meta.preparation`; v2 cilj — objekat plana v2 (`peakKm`, najduži dugi
 *  njegovih nedelja; prefiks izvora nije u njemu). */
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
  const longest = v2
    ? Math.max(
        0,
        ...v2.weeks.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
      )
    : 0;
  const threshold = v2 ? longShortKmOf(v2) : null;
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
    const name = ((built.result.meta ?? {}) as { raceName?: string }).raceName ?? NAME[dist]!;
    const peaks = peaksOf(built.result);
    options.push({
      id: `shorter-${dist}`,
      choice: { kind: 'shorter', raceDistM: dist },
      title: `Kraća distanca: ${name} istog datuma`,
      detail:
        built.coverage === 'full'
          ? `Isporučen plan ispunjava pravila pune pripreme za ${name}. Vremenski cilj maratona se ne prenosi.`
          : `Dužina pokriva ${name}, ali nedeljni vrhunac ne podržava vremenski cilj. Vremenski cilj maratona se ne prenosi.`,
      raceDate: basis.input.raceDate,
      raceDistM: dist,
      goalSec: null,
      coverage: built.coverage,
      peakLongRunKm: peaks.longKm,
      peakWeeklyKm: peaks.weeklyKm
    });
    break;
  }
  return {
    status,
    fullPreparation: false,
    statement: `Posle prilagođavanja najduži dugi u planu je ${String(longest).replace('.', ',')} km, ispod ${threshold ?? ''} km: ovo nije puna priprema za maraton.`,
    conditions: [
      'Zadrži plan v2: plan maratona ostaje kakav je posle prilagođavanja; kraća distanca je samo predlog.'
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
      error: 'Plan maratona v2 nudi samo kraću distancu istog datuma (ili zadržavanje plana).'
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
      from: { raceDate: basis.input.raceDate, raceDistM: MAR_M, goalSec: basis.input.goalSec },
      to: { raceDate: basis.input.raceDate, raceDistM: dist, goalSec: null }
    }
  };
}
