import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { personalPlan } from '../personal';
import type { GenPlanState } from '../state';
import {
  FIVE_K_GENERATOR,
  HALF_MARATHON_GENERATOR,
  HALF_MARATHON_PREPARATION,
  MARATHON_GENERATOR,
  MARATHON_PREPARATION,
  TEN_K_GENERATOR,
  generatorForDistance,
  generatorForPlan,
  preparationForPlan,
  productFor
} from './select';

/* ARHITEKTURA SVA ČETIRI GENERATORA (segment 4/5) — jedna provera preko 5K, 10K, HM i maratona, uz pojedinačne
   `<generator>/isolation.node.test.ts` (koji ostaju i važe i dalje):
   1. izvršno zatvorenje od `index.ts` svakog generatora ostaje u njegovom direktorijumu (izlaz su samo tipovi kroz
      `exchange.ts`);
   2. nijedan generator ne uvozi drugi generator, aplikacioni izbor (`select.ts`/`handoff.ts`) ni stari mehanizam
      (`domain/training`, `domain/plan`), ni tipom;
   3. nijedan izvršni fajl generatora ne postoji van njegovog direktorijuma: generatori nemaju zajednički kod;
   4. aplikacija (ekrani, store-ovi, servisi, ostali domen, uključujući `select.ts`/`handoff.ts`) ne uvozi izvršne
      funkcije STAROG generisanja i adaptacije; tipovi su dozvoljeni. Izuzetaka nema (segment 5/5);
   5. svaka podržana distanca ide svom generatoru, uključujući odluku o pripremi; distanca bez generatora i plan bez
      distance daju `null` (aplikacija to prikazuje), bez zamene drugim generatorom (segment 5/5);
   6. (segment 5/5) iz produkcione ulazne tačke (`main.tsx`, uključujući lenje `import()` ekrane) nijedan izvršni modul
      starog generisanja/adaptacije nije dostižan — ni kroz barel re-export (analiza po imenu);
   7. (segment 5/5) izbor generatora (`select.ts`, `handoff.ts`) ne uvozi stari mehanizam ni tipom;
   8. (segment 5/5) ZAMRZNUT INVENTAR: aplikacija sme iz `domain/training`/`domain/plan` da uvozi samo popisana imena
      (format razmene, prikaz, merenje forme — `LEGACY_SHARED_ALLOWED`). Svaki novi uvoz trenerske funkcije ili konstante
      iz starog koda u aplikaciju obara test i mora se svesno razvrstati;
   9. (posle segmenta 5/5) stari zajednički engine je OBRISAN: nijedan njegov izvršni modul generisanja/adaptacije ne
      postoji u stablu (`DELETED_LEGACY_ENGINE`); testovi koji su ga koristili idu kroz generatore (`src/test/generators.ts`). */

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

/** Izvršne funkcije starog generisanja/adaptacije (ugovor generatora). Obrisane su; pravila 4 i 6 i dalje paze da se
    ne vrate. */
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
/** Stari zajednički engine (generisanje, adaptacija, profili distanci, sesije) — obrisan posle segmenta 5/5. */
const DELETED_LEGACY_ENGINE: readonly string[] = [
  'plan/adapt.ts',
  'plan/automaticAlts.ts',
  'plan/executionAdjustment.ts',
  'plan/fatigueRecovery.ts',
  'plan/finalize.ts',
  'plan/future.ts',
  'plan/preparationDecision.ts',
  'plan/prescriptionText.ts',
  'plan/regenerate.ts',
  'plan/replan.ts',
  'plan/returnGrowth.ts',
  'plan/runWalkAdjustment.ts',
  'training/adaptation/evidence.ts',
  'training/adaptation/proposal.ts',
  'training/constants/distances.ts',
  'training/distances/hmProgression.ts',
  'training/distances/index.ts',
  'training/distances/profile10k.ts',
  'training/distances/profile21k.ts',
  'training/distances/profile42k.ts',
  'training/distances/profile5k.ts',
  'training/distances/qualityDose.ts',
  'training/distances/types.ts',
  'training/execution.ts',
  'training/generator/allocation.ts',
  'training/generator/assess.ts',
  'training/generator/athleteAssessment.ts',
  'training/generator/daySlots.ts',
  'training/generator/focus.ts',
  'training/generator/formPolicy.ts',
  'training/generator/generatePlan.ts',
  'training/generator/longRunProgression.ts',
  'training/generator/validateInput.ts',
  'training/generator/volume.ts',
  'training/generator/weeklyLoad.ts',
  'training/prediction/index.ts',
  'training/qualityGate.ts',
  'training/runWalkProgress.ts',
  'training/sessions/build.ts',
  'training/sessions/constraints.ts',
  'training/sessions/cruise.ts',
  'training/sessions/deload.ts',
  'training/sessions/intervals.ts',
  'training/sessions/longRun.ts',
  'training/sessions/prescription.ts',
  'training/sessions/progression.ts',
  'training/sessions/repetitions.ts',
  'training/sessions/tempo.ts'
];
/** Prikazni izuzeci: od segmenta 5/5 nema ih (`describePoint` je prebačen u ekran, ime distance daje generator). */
const DISPLAY_EXCEPTIONS: Readonly<Record<string, readonly string[]>> = {};

/* Inventar zajedničkog koda koji aplikacija i dalje koristi iz `domain/training`/`domain/plan` (stanje segmenta 5/5,
   v. docs/generator-isolation/ARCHITECTURE.md). Kategorije:
   F = format razmene / tehnički upis (razrešavanje plana, ručne izmene, revizije, brisanje, provere ID-jeva);
   P = prikaz (oznake, faze, tekst run/walk);
   M = merenje forme i fiziološka računica (VDOT, test 3 km, lanac forme, uparivanje redova).
   Zajedničkih trenerskih smernica (ranije „S": `rpeTarget`, `paceForZone` u prikazu/vremenu/satu, `RECOVERY_JOG`) više
   nema: od prenosa ih svaki generator ima sam. */
const LEGACY_SHARED_ALLOWED: Readonly<Record<string, readonly string[]>> = {
  'plan/index.ts': [
    'resolvePlan', // F
    'weekOf', // F
    'swapDays', // F
    'undoWeekMoves', // F
    'setAlt', // F
    'clearAlt', // F
    'hasGenPlanData', // F
    'purgeGenPlanData', // F
    'ALT_HOLD_MS', // F (uređivač ručne izmene)
    'ALT_TYPES', // F
    'RACE_DISTANCES', // F
    'chooseRaceKm', // F
    'chooseType', // F
    'holdType', // F
    'initialAltDraft', // F
    'paceFromDraftDesc', // F
    'tagName', // P
    'sessKind', // P
    'dayLabel', // P
    'planBaselineVdot' // M (polazna forma iz `meta`)
  ],
  'plan/versions.ts': ['getPlanRevisions', 'recordPlanRevision'], // F
  'plan/preparation.ts': ['preparationSummary'], // P (sažetak `meta.preparation` koju je zapisao generator)
  'plan/baseline.ts': ['planBaselineVdot'], // M
  'plan/describe.ts': ['sessKind'], // P
  /* Prijem merenja forme (klasifikacija/tolerancija, lanac/α, trenutna forma, klasa sesije) i faza nedelje su od A1/A3
     politika generatora plana (`PlanGenerator.classifyMeasurement`/`recomputeVdotChain`/`currentVdot`/`sessionClassFor`/
     `phaseOfWeek`); aplikacija ih više ne uvozi iz starog koda. */
  'training/adaptation/index.ts': [
    'predRowsForDay', // M
    'matchWeekRows', // M
    'alignVdotDates', // M
    'effectivePace' // P (tempo dana posle ručne/automatske izmene)
  ],
  'training/constants/product.ts': ['T3K_DIST_M', 'T3K_SEC_MIN'], // M
  'training/generator/runWalk.ts': ['runWalkText'], // P
  'training/prediction/summary.ts': ['predictionSummary'], // M
  'training/sessions/calc.ts': ['sessQKm'], // P (zbir za pregled promene)
  'training/test3k/index.ts': [
    't3kSeries',
    't3kVdot',
    't3kRows',
    'addT3k',
    'removeT3k',
    'upsertMeasurement'
  ], // M
  'training/vdot/calculateVDOT.ts': ['vdotFromRace'], // M
  'training/vdot/limits.ts': ['isT3kId', 't3kPossible', 'vdotPossible', 't3kSlowest'], // F/M
  'training/vdot/racePrediction.ts': ['raceTimeForVdot'] // M
};

/** Fajlovi starog koda koje produkcija (`main.tsx`) dostiže posle segmenta 5/5 — nijedan nije generisanje ni adaptacija. */
const PRODUCTION_LEGACY_FILES: readonly string[] = [
  'plan/altEditor.ts',
  'plan/baseline.ts',
  'plan/describe.ts',
  'plan/edit.ts',
  'plan/index.ts',
  'plan/preparation.ts',
  'plan/purge.ts',
  'plan/resolve.ts',
  'plan/versions.ts',
  'training/adaptation/chain.ts',
  'training/adaptation/dates.ts',
  'training/adaptation/effectivePace.ts',
  'training/adaptation/index.ts',
  'training/adaptation/matching.ts',
  'training/constants/evidence.ts',
  'training/constants/heuristics.ts',
  'training/constants/product.ts',
  'training/generator/runWalk.ts',
  'training/prediction/summary.ts',
  'training/sessions/calc.ts',
  'training/test3k/index.ts',
  'training/vdot/calculateVDOT.ts',
  'training/vdot/limits.ts',
  'training/vdot/paceForZone.ts',
  'training/vdot/physiology.ts',
  'training/vdot/racePrediction.ts',
  'training/vdot/vdotFromPace.ts',
  'training/vdot/zoneForKind.ts'
];

/* ------------------------------------------------------------------ produkcioni graf (TypeScript parser) */

interface RuntimeEdge {
  to: string | null;
  names: string[];
  reexport: boolean;
  star: boolean;
  map: Record<string, string>;
}
function resolveSpec(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')])
    if (existsSync(c) && statSync(c).isFile()) return c;
  return `UNRESOLVED:${base}`;
}
const parsed = new Map<string, { edges: RuntimeEdge[]; barrel: boolean }>();
/** Izvršne (ne samo tipske) veze fajla: `import`, `export … from`, dinamički `import()`. */
function runtimeEdges(file: string): { edges: RuntimeEdge[]; barrel: boolean } {
  const hit = parsed.get(file);
  if (hit) return hit;
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out: RuntimeEdge[] = [];
  let barrel = true;
  for (const n of sf.statements) {
    if (ts.isImportDeclaration(n)) {
      barrel = false;
      const c = n.importClause;
      if (c?.isTypeOnly) continue;
      let names = ['*'];
      if (c?.namedBindings && ts.isNamedImports(c.namedBindings)) {
        names = c.namedBindings.elements
          .filter((e) => !e.isTypeOnly)
          .map((e) => (e.propertyName ?? e.name).text);
        if (!names.length && !c.name) continue;
      }
      if (c?.name) names.push('default');
      out.push({
        to: resolveSpec(file, (n.moduleSpecifier as ts.StringLiteral).text),
        names,
        reexport: false,
        star: false,
        map: {}
      });
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier) {
      if (n.isTypeOnly) continue;
      const to = resolveSpec(file, (n.moduleSpecifier as ts.StringLiteral).text);
      if (!n.exportClause) out.push({ to, names: ['*'], reexport: true, star: true, map: {} });
      else if (ts.isNamedExports(n.exportClause)) {
        const els = n.exportClause.elements.filter((e) => !e.isTypeOnly);
        if (els.length)
          out.push({
            to,
            names: els.map((e) => (e.propertyName ?? e.name).text),
            reexport: true,
            star: false,
            map: Object.fromEntries(els.map((e) => [e.name.text, (e.propertyName ?? e.name).text]))
          });
      }
    } else if (!ts.isInterfaceDeclaration(n) && !ts.isTypeAliasDeclaration(n)) barrel = false;
  }
  const visit = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      n.arguments[0] &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      barrel = false;
      out.push({
        to: resolveSpec(file, n.arguments[0].text),
        names: ['*'],
        reexport: false,
        star: false,
        map: {}
      });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  const value = { edges: out, barrel };
  parsed.set(file, value);
  return value;
}

/** Dostižni fajlovi iz ulaza; barel fajl (samo re-export) se prati samo za tražena imena. */
function reachable(entry: string): Map<string, Set<string>> {
  const seen = new Map<string, Set<string>>();
  const stack: [string, string[]][] = [[entry, ['*']]];
  while (stack.length) {
    const [file, names] = stack.pop()!;
    const prev = seen.get(file);
    const fresh = names.filter((n) => !prev?.has(n) && !prev?.has('*'));
    if (prev && !fresh.length) continue;
    const set = prev ?? new Set<string>();
    fresh.forEach((n) => set.add(n));
    seen.set(file, set);
    const { edges: es, barrel } = runtimeEdges(file);
    for (const e of es) {
      if (!e.to || e.to.startsWith('UNRESOLVED')) continue;
      if (!barrel) {
        if (!prev) stack.push([e.to, e.names]);
        continue;
      }
      if (e.star) stack.push([e.to, fresh]);
      else {
        const want = fresh.includes('*')
          ? Object.values(e.map)
          : fresh.filter((n) => e.map[n]).map((n) => e.map[n]!);
        if (want.length) stack.push([e.to, want]);
      }
    }
  }
  return seen;
}

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
      if (LEGACY.some((l) => inside(file, l))) continue; // stari mehanizam sam sebe
      if (GENERATORS.some((g) => inside(file, g))) continue; // generatori: pravila 2–3
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

  it('svaka podržana distanca ide svom generatoru (i odluka o pripremi); ostalo eksplicitno nema generator', () => {
    const plan = (raceDistM: number): GenPlanState =>
      ({ weeks: [], pred: [], meta: { raceDistM } }) as never;
    expect(generatorForPlan(plan(5000))).toBe(FIVE_K_GENERATOR);
    expect(generatorForPlan(plan(10000))).toBe(TEN_K_GENERATOR);
    expect(generatorForPlan(plan(21097.5))).toBe(HALF_MARATHON_GENERATOR);
    expect(generatorForPlan(plan(42195))).toBe(MARATHON_GENERATOR);
    expect(preparationForPlan(plan(21097.5))).toBe(HALF_MARATHON_PREPARATION);
    expect(preparationForPlan(plan(42195))).toBe(MARATHON_PREPARATION);
    // Ugrađeni lični plan (aktivni plan kad je `genPlan === null`) je polumaraton → HM generator.
    expect(generatorForPlan(personalPlan(48))).toBe(HALF_MARATHON_GENERATOR);
    // Nepodržano: bez zamene drugim generatorom.
    for (const d of [7000, 3000, 21097, 42194, 50000]) {
      expect(generatorForPlan(plan(d))).toBeNull();
      expect(generatorForDistance(d)).toBeNull();
      expect(productFor(d)).toBeUndefined();
    }
    expect(generatorForPlan(null)).toBeNull();
    expect(preparationForPlan(null)).toBeNull();
    expect(preparationForPlan(plan(5000))).toBeNull();
    expect(preparationForPlan(plan(10000))).toBeNull();
  });

  it('produkcija (main.tsx, uključujući lenje ekrane) ne dostiže izvršne module starog generisanja/adaptacije', () => {
    const seen = reachable(join(SRC, 'main.tsx'));
    expect(seen.size).toBeGreaterThan(400);
    // Lenji ekrani su zaista praćeni (dinamički `import()`).
    expect(seen.has(join(SRC, 'features/plan/AdjustPlan.tsx'))).toBe(true);
    const bad = LEGACY_EXECUTION_MODULES.filter((f) => seen.has(f)).map((f) => relative(SRC, f));
    expect(bad).toEqual([]);
    // Zamrznut skup: iz starog koda produkcija dostiže TAČNO ove fajlove (format, prikaz, merenje forme).
    const legacyReached = [...seen.keys()]
      .filter((f) => LEGACY.some((l) => inside(f, l)))
      .map((f) => relative(DOMAIN, f))
      .sort();
    expect(legacyReached).toEqual([...PRODUCTION_LEGACY_FILES].sort());
    // Ni stari profili distanci ni stari generator kroz barel `domain/plan`.
    for (const f of [
      'training/generator/generatePlan.ts',
      'plan/replan.ts',
      'plan/adapt.ts',
      'training/distances/index.ts',
      'training/constants/distances.ts',
      'training/adaptation/proposal.ts',
      'training/adaptation/evidence.ts'
    ])
      expect(seen.has(join(DOMAIN, f)), f).toBe(false);
  });

  it('stari zajednički engine je obrisan: nijedan njegov modul ne postoji', () => {
    const present = DELETED_LEGACY_ENGINE.filter((f) => existsSync(join(DOMAIN, f)));
    expect(present).toEqual([]);
    for (const f of LEGACY_EXECUTION_MODULES) expect(existsSync(f), relative(SRC, f)).toBe(false);
    // Ni kroz barel: `domain/plan` i `domain/training/adaptation` više ne izvoze funkcije generisanja/adaptacije.
    for (const [barrel, names] of Object.entries(LEGACY_BARREL_NAMES)) {
      const src = stripComments(readFileSync(barrel, 'utf8'));
      for (const n of names)
        expect(new RegExp(`\\b${n}\\b`).test(src), `${n} u ${barrel}`).toBe(false);
    }
  });

  it('izbor generatora (select.ts, handoff.ts) ne uvozi stari mehanizam, ni tipom', () => {
    const out: string[] = [];
    for (const f of ['generators/select.ts', 'generators/handoff.ts'].map((x) => join(DOMAIN, x)))
      for (const e of edges(files, f))
        if (e.to && LEGACY.some((l) => inside(e.to!, l)))
          out.push(`${relative(SRC, f)} → ${relative(SRC, e.to)}`);
    expect(out).toEqual([]);
  });

  it('zamrznut inventar: aplikacija iz starog koda uvozi samo popisana zajednička imena', () => {
    const out: string[] = [];
    const used = new Set<string>();
    for (const file of files.keys()) {
      if (isTest(file) || LEGACY.some((l) => inside(file, l))) continue;
      if (GENERATORS.some((g) => inside(file, g))) continue;
      for (const e of runtimeEdges(file).edges) {
        if (!e.to || !LEGACY.some((l) => inside(e.to!, l))) continue;
        const mod = relative(DOMAIN, e.to);
        const allowed = LEGACY_SHARED_ALLOWED[mod] ?? [];
        for (const n of e.names) {
          used.add(`${mod}:${n}`);
          if (!allowed.includes(n)) out.push(`${relative(SRC, file)}: ${n} ← ${mod}`);
        }
      }
    }
    expect(out).toEqual([]);
    // Inventar ne sme da zastari: svaka popisana stavka se zaista koristi.
    const stale = Object.entries(LEGACY_SHARED_ALLOWED).flatMap(([mod, names]) =>
      names.filter((n) => !used.has(`${mod}:${n}`)).map((n) => `${mod}:${n}`)
    );
    expect(stale).toEqual([]);
  });

  /* Prenos zajedničke trenerske logike: predlog izmene plana zbog bola i prekida, automatska zamena dana, izvoz na sat,
     vrućina/ciljni tempo/kartica vremena, ciljni napor i pragovi predloga. Deklarisani su SAMO u generatorima (svaki
     svoju kopiju); u aplikaciji (van starog mehanizma i testova) ih nema. */
  it('trenerska logika van plana i procena stanja postoje samo u generatorima, u svakom posebno', () => {
    const NAMES = [
      'injuryProposal',
      'applyInjuryProposal',
      'runWalkForPain',
      'RW_BY_PAIN',
      'PROPOSAL_HORIZON_DAYS',
      'realignPlan',
      'REALIGN_DAY_WINDOW',
      'workoutsForWatch',
      'thresholdPace',
      'dayWorkoutText',
      'sessionFromDescription',
      'weatherCard',
      'heatFor',
      'heatAdvice',
      'heatAdjustedPace',
      'HEAT_BANDS',
      'bestHour',
      'COOLER_HOUR_DELTA',
      'rpeTarget',
      // procena stanja trkača (status bola, opterećenje, prekid, spremnost)
      'painStatus',
      'returnToRunPhase',
      'PAIN_STOP',
      'PAIN_WATCH',
      'acwrNow',
      'acwrPlan',
      'acuteKm',
      'chronicKm',
      'breakInfo',
      'completion',
      'largestWeeklyKm',
      'daysWithoutRunning',
      'plannedKm7',
      'acwrBand',
      'acwrText',
      'acwrPosition',
      'ACWR_MAX',
      'ACWR_RETURN',
      'ACWR_HIGH',
      'ACWR_SCALE',
      'readinessModel',
      'loadMeaning',
      'wellnessSignals'
    ];
    const declares = (src: string, name: string): boolean =>
      new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|class)\\s+${name}\\b`).test(src);
    const app: string[] = [];
    for (const [file, src] of files) {
      if (isTest(file) || GENERATORS.some((g) => inside(file, g))) continue;
      for (const n of NAMES) if (declares(src, n)) app.push(`${relative(SRC, file)}: ${n}`);
    }
    expect(app).toEqual([]);
    for (const root of GENERATORS) {
      const own = [...files].filter(([f]) => inside(f, root) && !isTest(f));
      const missing = NAMES.filter((n) => !own.some(([, src]) => declares(src, n)));
      expect(missing, relative(SRC, root)).toEqual([]);
    }
  });
});
