/* GENERATORI ZA TESTOVE (V1b: samo v2).

   Testovi aplikacije koji su ulazne planove pravili v1 generatorom distance sada ih prave generatorom v2 te distance —
   istim putem kao aplikacija (`domain/generators/select.ts`, `generatorForDistance` → v2). Ulaz ostaje u starom obliku
   ugovora (`PlanGenerationInput`: `raceDistM`, `pb`, `weeklyKm`, `runDays`/`runDows`, `goalSec`, `trainedRecently`), a
   ovde se prevodi u ulaz ugovora v2 (`<distanca>/v2/app/generate.ts`, `ContractInput`): rezultat bez datuma dobija datum
   7 dana pre početka (sveža forma), a broj dana bez spiska dana dobija ustaljen raspored (`RUN_DOWS`). Pravila ulaza,
   plana i odbijanja su v2 (npr. raspon nedelja do trke); odbijanje se vraća kao `{ error }`.

   Planovi starog (v1) formata za oracle testove prikaza: `legacyAdapt.ts` (zamrznut prevod) + `legacyGenerator.ts`.
   Ulaz bez distance (ili sa 0) je 5K; distanca bez generatora daje grešku „Nepodržana distanca". */
import {
  generatorForDistance,
  generatorForPlan,
  preparationForPlan,
  type PlanGenerator,
  type PreparationApi
} from '@/domain/generators/select';
import type { GenPlanState } from '@/domain/state';

const UNSUPPORTED =
  'Nepodržana distanca. Generator pravi planove za 5K, 10K, polumaraton i maraton.';

/** Ustaljen raspored dana trčanja (1 = ponedeljak … 7 = nedelja) po broju dana, dugi u nedelju. */
export const RUN_DOWS: Readonly<Record<number, readonly number[]>> = {
  2: [3, 7],
  3: [2, 4, 7],
  4: [2, 4, 6, 7],
  5: [1, 2, 4, 6, 7],
  6: [1, 2, 3, 4, 6, 7],
  7: [1, 2, 3, 4, 5, 6, 7]
};

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const minusDays = (date: string, n: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return iso(d);
};

type OldInput = {
  startDate?: string;
  raceDate?: string;
  raceDistM?: number;
  pb?: { distM: number; sec: number; date?: string } | null;
  weeklyKm?: number;
  runDays?: number;
  runDows?: number[];
  lrDow?: number | null;
  goalSec?: number | null;
  trainedRecently?: boolean;
};

/** Stari oblik ulaza ugovora → ulaz ugovora v2 (`ContractInput`). */
export function v2ContractInput(input: unknown): Record<string, unknown> {
  const i = (input ?? {}) as OldInput;
  const start = i.startDate ?? '';
  const runDows = i.runDows?.length ? i.runDows : [...(RUN_DOWS[i.runDays ?? 4] ?? RUN_DOWS[4]!)];
  return {
    startDate: start,
    raceDate: i.raceDate ?? '',
    pb: i.pb ? { ...i.pb, date: i.pb.date ?? (start ? minusDays(start, 7) : undefined) } : i.pb,
    weeklyKm: i.weeklyKm ?? 0,
    runDows,
    ...(i.lrDow != null ? { lrDow: i.lrDow } : {}),
    goalSec: i.goalSec ?? null,
    ...(i.trainedRecently !== undefined ? { trainedRecently: i.trainedRecently } : {})
  };
}

const byDistance = (raceDistM: unknown): PlanGenerator | null => generatorForDistance(raceDistM);

/** Plan iz ulaza, generatorom v2 ciljne distance. */
export const generatePlan: PlanGenerator['generatePlan'] = (input) => {
  const g = byDistance((input as { raceDistM?: unknown } | null | undefined)?.raceDistM);
  return g ? g.generatePlan(v2ContractInput(input) as never) : { error: UNSUPPORTED };
};

/** Izlaz generatora → perzistirani plan, adapterom generatora te distance. */
export const adaptGeneratedPlan: PlanGenerator['adaptGeneratedPlan'] = (gen) => {
  const g = byDistance(
    (gen as { meta?: { raceDistM?: unknown } } | null | undefined)?.meta?.raceDistM
  );
  if (!g) throw new Error('adaptGeneratedPlan: plan nema podržanu distancu');
  return g.adaptGeneratedPlan(gen);
};

/** Plan za upis iz ulaza (generisanje + prevod); greška generatora je izuzetak testa. */
export function v2Plan(input: unknown): GenPlanState {
  const gen = generatePlan(input as never);
  if ('error' in gen) throw new Error(`v2Plan: ${gen.error}`);
  const plan = adaptGeneratedPlan(gen);
  if (!plan) throw new Error('v2Plan: prevod plana nije uspeo');
  return plan;
}

/** Generator plana (sačuvanog ili napravljenog u testu). */
export function generatorOf(plan: unknown): PlanGenerator {
  const g = generatorForPlan(plan as GenPlanState);
  if (!g) throw new Error('generator: plan nema podržanu distancu');
  return g;
}

/** Odluka o pripremi plana (samo polumaraton i maraton v2). */
export function preparationOf(plan: unknown): PreparationApi {
  const p = preparationForPlan(plan as GenPlanState);
  if (!p) throw new Error('odluka o pripremi postoji samo za polumaraton i maraton');
  return p;
}
