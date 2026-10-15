import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GenPlanState } from '../state';
import {
  FIVE_K_GENERATOR,
  HALF_MARATHON_GENERATOR,
  HALF_MARATHON_PREPARATION,
  LEGACY_GENERATOR,
  LEGACY_PREPARATION,
  MARATHON_GENERATOR,
  MARATHON_PREPARATION,
  TEN_K_GENERATOR,
  generatorForPlan,
  preparationForPlan
} from './select';

/* ARHITEKTURA SVA ČETIRI GENERATORA (segment 4/5) — jedna provera preko 5K, 10K, HM i maratona, uz pojedinačne
   `<generator>/isolation.node.test.ts` (koji ostaju i važe i dalje):
   1. izvršno zatvorenje od `index.ts` svakog generatora ostaje u njegovom direktorijumu (izlaz su samo tipovi kroz
      `exchange.ts`);
   2. nijedan generator ne uvozi drugi generator, aplikacioni izbor (`select.ts`/`handoff.ts`) ni stari mehanizam
      (`domain/training`, `domain/plan`), ni tipom;
   3. nijedan izvršni fajl generatora ne postoji van njegovog direktorijuma: generatori nemaju zajednički kod;
   4. aplikacija (ekrani, store-ovi, servisi, ostali domen) ne poziva izvršne funkcije STAROG generisanja i adaptacije
      mimo izbora generatora; tipovi su dozvoljeni. Jedini popisan izuzetak je prikazni `describePoint` (formatiranje
      tačke odluke na ekranu, bez trenerske odluke) — inventar za segment 5;
   5. svaka podržana distanca ide svom generatoru, uključujući odluku o pripremi; stari mehanizam ostaje samo za plan bez
      podržane distance. */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DOMAIN = join(SRC, 'domain');
const GENERATORS = ['fiveK', 'tenK', 'halfMarathon', 'marathon'].map((g) =>
  join(DOMAIN, 'generators', g)
);
const LEGACY = [join(DOMAIN, 'training'), join(DOMAIN, 'plan')];
const isTest = (f: string): boolean => /\.test\.tsx?$/.test(f) || f.startsWith(join(SRC, 'test/'));
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

function walk(dir: string, out = new Map<string, string>()): Map<string, string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.set(p, readFileSync(p, 'utf8'));
  }
  return out;
}

interface Edge {
  to: string | null;
  spec: string;
  names: { name: string; type: boolean }[];
  typeOnly: boolean;
}
const STATEMENT =
  /(?:^|[;\n])\s*(import|export)\s+(type\s+)?((?:[\w*$\s,]*\{[^}]*\}|[\w*$\s,]+?|\*\s+as\s+\w+|\*))\s+from\s+['"]([^'"]+)['"]/g;

function edges(files: ReadonlyMap<string, string>, file: string): Edge[] {
  const out: Edge[] = [];
  for (const m of stripComments(files.get(file) ?? '').matchAll(STATEMENT)) {
    const spec = m[4]!;
    let to: string | null = null;
    if (spec.startsWith('.')) {
      const base = resolve(dirname(file), spec);
      to =
        [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((c) => files.has(c)) ??
        `UNRESOLVED:${base}`;
    }
    const clause = (m[3] ?? '').trim();
    const named = /\{([\s\S]*)\}/.exec(clause)?.[1];
    const names = (named ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => ({
        name: x.replace(/^type\s+/, '').split(/\s+as\s+/)[0]!,
        type: /^type\s/.test(x)
      }));
    const typeOnly = !!m[2] || (named !== undefined && names.every((n) => n.type));
    out.push({ to, spec, names, typeOnly });
  }
  return out;
}

/** Izvršne funkcije starog generisanja/adaptacije (ugovor generatora). */
const LEGACY_EXECUTION_MODULES = [
  'training/generator/generatePlan.ts',
  'training/generator/assess.ts',
  'training/runWalkProgress.ts',
  'training/qualityGate.ts',
  'training/adaptation/proposal.ts',
  'training/adaptation/evidence.ts',
  'plan/adapt.ts',
  'plan/regenerate.ts',
  'plan/replan.ts',
  'plan/future.ts',
  'plan/executionAdjustment.ts',
  'plan/runWalkAdjustment.ts',
  'plan/automaticAlts.ts',
  'plan/finalize.ts',
  'plan/fatigueRecovery.ts',
  'plan/returnGrowth.ts',
  'plan/preparationDecision.ts'
].map((f) => join(DOMAIN, f));
/** Iste funkcije kroz barel fajlove (`domain/plan/index.ts`, `domain/training/adaptation/index.ts`). */
const LEGACY_BARREL_NAMES: Readonly<Record<string, readonly string[]>> = {
  [join(DOMAIN, 'plan/index.ts')]: [
    'adaptGeneratedPlan',
    'mergeOverrides',
    'planWithNewGoal',
    'planRecalibrated',
    'recalibratedPlan',
    'reentryPlan'
  ],
  [join(DOMAIN, 'training/adaptation/index.ts')]: [
    'planVdotNow',
    'vdotProposal',
    'applyVdotProposal',
    'undoVdotAdjustments',
    'fitnessEvidence'
  ]
};
/** Popisani prikazni izuzetak (segment 5): formatiranje tačke odluke, bez trenerske odluke. */
const DISPLAY_EXCEPTIONS: Readonly<Record<string, readonly string[]>> = {
  [join(SRC, 'features/plan/ExecutionAdjustment.tsx')]: ['describePoint']
};

const files = walk(SRC);
const inside = (f: string, root: string): boolean => f.startsWith(root + '/');

describe('arhitektura: četiri nezavisna generatora', () => {
  it('svaki generator postoji i ima sopstveni javni API', () => {
    for (const root of GENERATORS) {
      expect(files.has(join(root, 'index.ts')), root).toBe(true);
      expect(files.has(join(root, 'exchange.ts')), root).toBe(true);
    }
  });

  it('izvršno zatvorenje svakog generatora ostaje u njegovom direktorijumu', () => {
    const out: string[] = [];
    for (const root of GENERATORS) {
      const exchange = join(root, 'exchange.ts');
      const seen = new Set<string>();
      const stack = [join(root, 'index.ts')];
      while (stack.length) {
        const f = stack.pop()!;
        if (seen.has(f)) continue;
        seen.add(f);
        for (const e of edges(files, f)) {
          if (!e.to) {
            out.push(`${relative(SRC, f)}: paket '${e.spec}'`);
            continue;
          }
          if (inside(e.to, root)) {
            stack.push(e.to);
            continue;
          }
          if (!(f === exchange && e.typeOnly))
            out.push(`${relative(SRC, f)} → ${relative(SRC, e.to)}`);
        }
      }
      expect(seen.size, root).toBeGreaterThan(50);
    }
    expect(out).toEqual([]);
  });

  it('nijedan generator ne uvozi drugi generator, izbor generatora ni stari mehanizam (ni tipom)', () => {
    const out: string[] = [];
    for (const root of GENERATORS)
      for (const file of files.keys()) {
        if (!inside(file, root) || isTest(file)) continue;
        for (const e of edges(files, file)) {
          if (!e.to || inside(e.to, root)) continue;
          const target = e.to;
          const other = GENERATORS.find((g) => g !== root && inside(target, g));
          const legacy = LEGACY.some((l) => inside(target, l));
          const app = /generators\/(select|handoff)\.ts$/.test(target);
          const exchangeOk =
            file === join(root, 'exchange.ts') &&
            e.typeOnly &&
            [join(DOMAIN, 'state/index.ts'), join(DOMAIN, 'date/index.ts')].includes(target);
          if (other || legacy || app || !exchangeOk)
            out.push(`${relative(SRC, file)} → ${relative(SRC, target)}`);
        }
      }
    expect(out).toEqual([]);
  });

  it('generatori nemaju zajednički izvršni kod: van testova ih uvoze samo select.ts i handoff.ts', () => {
    const out: string[] = [];
    const allowed = new Set([
      join(DOMAIN, 'generators/select.ts'),
      join(DOMAIN, 'generators/handoff.ts')
    ]);
    for (const file of files.keys()) {
      if (isTest(file) || GENERATORS.some((g) => inside(file, g)) || allowed.has(file)) continue;
      for (const e of edges(files, file))
        if (e.to && GENERATORS.some((g) => inside(e.to!, g)))
          out.push(`${relative(SRC, file)} → ${relative(SRC, e.to)}`);
    }
    expect(out).toEqual([]);
  });

  it('aplikacija ne poziva staro generisanje/adaptaciju mimo izbora generatora (tipovi dozvoljeni)', () => {
    const out: string[] = [];
    for (const file of files.keys()) {
      if (isTest(file)) continue;
      if (LEGACY.some((l) => inside(file, l))) continue; // stari mehanizam sam sebe (segment 5)
      if (inside(file, join(DOMAIN, 'generators'))) continue; // select.ts: LEGACY_* za plan bez distance
      for (const e of edges(files, file)) {
        if (!e.to || e.typeOnly) continue;
        const runtime = e.names.filter((n) => !n.type).map((n) => n.name);
        const allowed = DISPLAY_EXCEPTIONS[file] ?? [];
        if (LEGACY_EXECUTION_MODULES.includes(e.to)) {
          const bad = e.names.length ? runtime.filter((n) => !allowed.includes(n)) : ['*'];
          if (bad.length)
            out.push(`${relative(SRC, file)}: ${bad.join(', ')} ← ${relative(SRC, e.to)}`);
        }
        const barrel = LEGACY_BARREL_NAMES[e.to];
        if (barrel) {
          const bad = runtime.filter((n) => barrel.includes(n));
          if (bad.length)
            out.push(`${relative(SRC, file)}: ${bad.join(', ')} ← ${relative(SRC, e.to)}`);
        }
      }
    }
    expect(out).toEqual([]);
  });

  it('svaka podržana distanca ide svom generatoru (i odluka o pripremi); stari samo bez podržane distance', () => {
    const plan = (raceDistM: number): GenPlanState =>
      ({ weeks: [], pred: [], meta: { raceDistM } }) as never;
    expect(generatorForPlan(plan(5000))).toBe(FIVE_K_GENERATOR);
    expect(generatorForPlan(plan(10000))).toBe(TEN_K_GENERATOR);
    expect(generatorForPlan(plan(21097.5))).toBe(HALF_MARATHON_GENERATOR);
    expect(generatorForPlan(plan(42195))).toBe(MARATHON_GENERATOR);
    expect(preparationForPlan(plan(21097.5))).toBe(HALF_MARATHON_PREPARATION);
    expect(preparationForPlan(plan(42195))).toBe(MARATHON_PREPARATION);
    expect(generatorForPlan(null)).toBe(LEGACY_GENERATOR);
    expect(generatorForPlan(plan(7000))).toBe(LEGACY_GENERATOR);
    expect(preparationForPlan(null)).toBe(LEGACY_PREPARATION);
  });
});
