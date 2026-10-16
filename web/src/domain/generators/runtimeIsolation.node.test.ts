import { describe, expect, it, vi } from 'vitest';
import {
  adaptationRows,
  generationRows,
  loadReference,
  type ReferenceRow
} from '@/test/fiveK/reference';
import type { GeneratorApi } from '@/test/fiveK/legacyApi';
import { hmAdaptationRows, hmGenerationRows, loadHmReference } from '@/test/halfMarathon/reference';
import type { HmApi } from '@/test/halfMarathon/scenarios';
import {
  loadMarathonReference,
  marathonAdaptationRows,
  marathonGenerationRows
} from '@/test/marathon/reference';
import { loadTenKReference, tenKAdaptationRows, tenKGenerationRows } from '@/test/tenK/reference';
import * as fiveK from './fiveK';
import { HEURISTIC_5K } from './fiveK/training/constants/distances';
import * as halfMarathon from './halfMarathon';
import { HEURISTIC_21K } from './halfMarathon/training/constants/distances';
import { regeneratorForDistance } from './handoff';
import * as marathon from './marathon';
import { HEURISTIC_42K } from './marathon/training/constants/distances';
import * as tenK from './tenK';
import { HEURISTIC_10K } from './tenK/training/constants/distances';

/* IZOLACIJA U IZVRŠAVANJU (segment 5/5) — dopuna statičkih provera (`architecture.node.test.ts`).

   Na istim kontrolisanim ulazima (podskup zamrznutih referenci svake distance: generisanje + adaptacioni tokovi; „danas"
   je argument, sat i slučajnost se ne čitaju) proverava se:
   1. samostalno izvršavanje (svež modul, bez ostalih generatora u procesu) = referenca;
   2. izvršavanje u različitom redosledu i isprepletano = referenca;
   3. ponovljeno izvršavanje = isti rezultat;
   4. generatori nemaju zajednički promenljiv objekat (nijedan objekat dostižan iz izvoza jednog nije dostižan iz
      izvoza drugog), a izvršavanje ne menja izvezene konstante;
   5. kontrolisana LOKALNA promena politike jednog generatora (u memoriji, samo u ovom testu, vraća se u `finally`)
      menja samo njegov izlaz; ostala tri ostaju jednaka referenci.

   Granica garancije: ovo dokazuje nezavisnost TRENERSKIH implementacija u izvršavanju. Ne dokazuje da zajednički UI,
   store, runtime (JS motor, `Intl`) ili skladište ne mogu imati grešku koja pogađa sve distance. */

type Rows = Record<string, ReferenceRow>;
type Mod = typeof fiveK | typeof tenK | typeof halfMarathon | typeof marathon;

type Handoff = halfMarathon.ShorterDistanceHandoff;
/** Predaja „kraća distanca" kao u produkciji (`handoff.ts`); test je može usmeriti na drugu instancu generatora. */
let currentHandoff: Handoff = regeneratorForDistance;

function apiOf(mod: Mod, decisions = false): GeneratorApi & Partial<HmApi> {
  const m = mod as typeof halfMarathon;
  const handoff: Handoff = (dist) => currentHandoff(dist);
  const base = {
    generatePlan: m.generatePlan,
    assess: m.assess,
    adaptGeneratedPlan: m.adaptGeneratedPlan,
    resolvePlan: m.resolvePlan,
    executionModel: m.executionModel,
    buildExecutionAdjustment: decisions
      ? (((...a: Parameters<typeof m.buildExecutionAdjustment>) =>
          m.buildExecutionAdjustment(a[0], a[1], a[2], a[3], a[4], handoff)) as never)
      : m.buildExecutionAdjustment,
    buildRunWalkAdjustment: m.buildRunWalkAdjustment,
    assessRunWalkProgress: m.assessRunWalkProgress,
    qualityEntryGate: m.qualityEntryGate,
    hasRecentMeasuredForm: m.hasRecentMeasuredForm,
    planWithNewGoal: m.planWithNewGoal,
    planRecalibrated: m.planRecalibrated,
    recalibratedPlan: m.recalibratedPlan,
    reentryPlan: m.reentryPlan,
    graftFuturePlan: m.graftFuturePlan,
    alignAutomaticOverlays: m.alignAutomaticOverlays,
    vdotProposal: m.vdotProposal,
    applyVdotProposal: m.applyVdotProposal,
    undoVdotAdjustments: m.undoVdotAdjustments,
    fitnessEvidence: m.fitnessEvidence,
    planVdotNow: m.planVdotNow,
    matchPlanRows: m.matchPlanRows,
    sessKm: m.sessKm,
    sessDesc: m.sessDesc,
    t3kVdot: m.t3kVdot
  };
  if (!decisions) return base as never;
  return {
    ...base,
    executionBasis: m.executionBasis,
    basisFromPlan: m.basisFromPlan,
    preparationDecision: (...a: Parameters<typeof m.preparationDecision>) =>
      m.preparationDecision(a[0], a[1], a[2], a[3], a[4], a[5], handoff),
    buildPreparationChoice: (...a: Parameters<typeof m.buildPreparationChoice>) =>
      m.buildPreparationChoice(a[0], a[1], a[2], a[3], a[4], handoff),
    isLimitedLongPreparation: m.isLimitedLongPreparation
  } as never;
}

/** Svaki 12. ulaz generisanja i adaptacija nad prva dva bazna plana: dovoljno raznovrsno, a brzo. */
const every = (n: number) => {
  let i = 0;
  return () => i++ % n === 0;
};

interface Distance {
  name: '5K' | '10K' | 'HM' | 'maraton';
  run: (mod: Mod) => Rows;
  mod: Mod;
  /** Distance čiji plan ovaj generator nudi kao „kraću distancu" (eksplicitna predaja kroz `handoff.ts`). */
  handsOffTo: readonly string[];
  expected: () => Rows;
}

const DISTANCES: Distance[] = [
  {
    name: '5K',
    mod: fiveK,
    handsOffTo: [],
    run: (mod) => ({
      ...generationRows(apiOf(mod), every(12)),
      ...prefix('a:', adaptationRows(apiOf(mod), 2))
    }),
    expected: () => {
      const r = loadReference()!;
      return { ...r.generation, ...prefix('a:', r.adaptation) };
    }
  },
  {
    name: '10K',
    mod: tenK,
    handsOffTo: [],
    run: (mod) => ({
      ...tenKGenerationRows(apiOf(mod), every(12)),
      ...prefix('a:', tenKAdaptationRows(apiOf(mod), 2))
    }),
    expected: () => {
      const r = loadTenKReference()!;
      return { ...r.generation, ...prefix('a:', r.adaptation) };
    }
  },
  {
    name: 'HM',
    mod: halfMarathon,
    handsOffTo: ['10K', '5K'],
    run: (mod) => ({
      ...hmGenerationRows(apiOf(mod, true), every(12)),
      ...prefix('a:', hmAdaptationRows(apiOf(mod, true) as HmApi, 2))
    }),
    expected: () => {
      const r = loadHmReference()!;
      return { ...r.generation, ...prefix('a:', r.adaptation) };
    }
  },
  {
    name: 'maraton',
    mod: marathon,
    handsOffTo: ['HM', '10K'],
    run: (mod) => ({
      ...marathonGenerationRows(apiOf(mod, true), every(12)),
      ...prefix('a:', marathonAdaptationRows(apiOf(mod, true) as HmApi, 2))
    }),
    expected: () => {
      const r = loadMarathonReference()!;
      return { ...r.generation, ...prefix('a:', r.adaptation) };
    }
  }
];

function prefix(p: string, rows: Rows): Rows {
  return Object.fromEntries(Object.entries(rows).map(([k, v]) => [p + k, v]));
}

/** Razlike prema referenci za sve izračunate redove (podskup reference). */
function diff(actual: Rows, expected: Rows): string[] {
  const out: string[] = [];
  for (const [name, got] of Object.entries(actual)) {
    const ref = expected[name];
    if (!ref) out.push(`NEMA U REFERENCI: ${name}`);
    else if (ref.full !== got.full || ref.pure !== got.pure) out.push(name);
  }
  return out;
}

const runAll = (order: Distance[]): Record<string, Rows> =>
  Object.fromEntries(order.map((d) => [d.name, d.run(d.mod)]));

/** Svi objekti i nizovi dostižni iz izvoza modula (funkcije se ne prate). */
function reachableObjects(root: object): Set<object> {
  const seen = new Set<object>();
  const stack: unknown[] = Object.values(root);
  while (stack.length) {
    const v = stack.pop();
    if (!v || typeof v !== 'object' || seen.has(v)) continue;
    seen.add(v);
    for (const x of Object.values(v)) stack.push(x);
  }
  return seen;
}

const exportedConstants = (mod: Mod): string =>
  JSON.stringify(
    Object.entries(mod).filter(([, v]) => v !== null && typeof v === 'object'),
    (_k, v: unknown) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v)
  );

describe('izolacija generatora u izvršavanju', () => {
  it('svaka distanca ima referencu i neprazan kontrolisani podskup', { timeout: 600_000 }, () => {
    for (const d of DISTANCES) {
      const rows = d.run(d.mod);
      expect(Object.keys(rows).length, d.name).toBeGreaterThan(100);
      expect(diff(rows, d.expected()), d.name).toEqual([]);
    }
  });

  it(
    'samostalno izvršavanje: svež modul jednog generatora, bez ostalih u procesu',
    { timeout: 600_000 },
    async () => {
      const paths = {
        '5K': './fiveK',
        '10K': './tenK',
        HM: './halfMarathon',
        maraton: './marathon'
      } as const;
      for (const d of DISTANCES) {
        vi.resetModules();
        const fresh = (await import(/* @vite-ignore */ paths[d.name])) as Mod;
        expect(fresh, d.name).not.toBe(d.mod);
        expect(diff(d.run(fresh), d.expected()), d.name).toEqual([]);
      }
    }
  );

  it(
    'različit redosled, isprepletano i ponovljeno izvršavanje daju isti rezultat',
    { timeout: 900_000 },
    () => {
      const forward = runAll(DISTANCES);
      const backward = runAll([...DISTANCES].reverse());
      const interleaved = runAll([DISTANCES[2]!, DISTANCES[0]!, DISTANCES[3]!, DISTANCES[1]!]);
      const again = runAll(DISTANCES);
      for (const d of DISTANCES) {
        expect(backward[d.name], d.name).toEqual(forward[d.name]);
        expect(interleaved[d.name], d.name).toEqual(forward[d.name]);
        expect(again[d.name], d.name).toEqual(forward[d.name]);
        expect(diff(forward[d.name]!, d.expected()), d.name).toEqual([]);
      }
    }
  );

  it(
    'nema zajedničkog promenljivog objekta i izvršavanje ne menja izvezene konstante',
    { timeout: 600_000 },
    () => {
      const mods = DISTANCES.map((d) => [d.name, d.mod] as const);
      const sets = mods.map(([name, mod]) => [name, reachableObjects(mod)] as const);
      for (let i = 0; i < sets.length; i++)
        for (let j = i + 1; j < sets.length; j++) {
          const [a, sa] = sets[i]!;
          const [b, sb] = sets[j]!;
          const shared = [...sa].filter((o) => sb.has(o));
          expect(shared.length, `${a} ↔ ${b}`).toBe(0);
        }
      const before = mods.map(([, mod]) => exportedConstants(mod));
      runAll(DISTANCES);
      expect(mods.map(([, mod]) => exportedConstants(mod))).toEqual(before);
    }
  );

  /* 5. Probna promena `deloadFactor` u memoriji jednog generatora. Jedini dozvoljeni kanal uticaja na drugi generator je
     EKSPLICITNA predaja „kraća distanca" (HM nudi 10K/5K plan, maraton HM/10K plan, napravljen generatorom te distance kroz
     `handoff.ts`). Zato se svaka distanca računa dvaput: sa produkcionom predajom (razlika sme da postoji samo kod
     generatora koji predaje promenjenom) i sa predajom usmerenom na NETAKNUTU instancu (svež modul) — tada nijedan drugi
     generator ne sme da se promeni, što dokazuje da njegov sopstveni kod ne čita tuđu politiku. */
  it(
    'lokalna promena politike jednog generatora ne menja izlaze ostalih',
    { timeout: 1_800_000 },
    async () => {
      const policies: Record<Distance['name'], { deloadFactor: number }> = {
        '5K': HEURISTIC_5K,
        '10K': HEURISTIC_10K,
        HM: HEURISTIC_21K,
        maraton: HEURISTIC_42K
      };
      vi.resetModules();
      const pristine: Record<number, unknown> = {
        5000: (await import(/* @vite-ignore */ './fiveK')).handoffFuture,
        10000: (await import(/* @vite-ignore */ './tenK')).handoffFuture,
        21097.5: (await import(/* @vite-ignore */ './halfMarathon')).handoffFuture
      };
      const pristineHandoff = ((dist: number | undefined) =>
        pristine[dist || 5000] ?? null) as unknown as Handoff;
      const production = currentHandoff;
      let viaHandoff = 0;
      for (const target of DISTANCES) {
        const policy = policies[target.name];
        const original = policy.deloadFactor;
        try {
          policy.deloadFactor = 0.6; // probna promena SAMO u memoriji ovog testa
          for (const d of DISTANCES) {
            currentHandoff = production;
            const changed = diff(d.run(d.mod), d.expected());
            if (d === target) {
              expect(changed.length, `${d.name} mora da reaguje`).toBeGreaterThan(0);
              continue;
            }
            if (!d.handsOffTo.includes(target.name))
              expect(changed, `${target.name} → ${d.name}`).toEqual([]);
            else viaHandoff += changed.length;
            currentHandoff = pristineHandoff;
            expect(
              diff(d.run(d.mod), d.expected()),
              `${target.name} → ${d.name} (netaknuta predaja)`
            ).toEqual([]);
          }
        } finally {
          policy.deloadFactor = original;
          currentHandoff = production;
        }
        expect(diff(target.run(target.mod), target.expected()), target.name).toEqual([]);
      }
      // Kanal predaje je stvaran (bar jedan tok nudi plan kraće distance) i jedini je kanal.
      expect(viaHandoff).toBeGreaterThan(0);
    }
  );
});
