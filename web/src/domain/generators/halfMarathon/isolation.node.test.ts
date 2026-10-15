import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* IZOLACIJA HM (POLUMARATON) GENERATORA — direktne i tranzitivne zavisnosti, uključujući re-export.

   Ista pravila kao za 5K i 10K (`fiveK/isolation.node.test.ts`, `tenK/isolation.node.test.ts`, koji ostaju nepromenjeni i
   važe i dalje), primenjena na `domain/generators/halfMarathon/**` (bez testova):
   1. nijedan uvoz paketa ni `@/` alias (HM ne koristi spoljne biblioteke);
   2. svaki relativan uvoz/re-export mora ostati u `halfMarathon/`; jedini izuzetak je `exchange.ts`, koji sme SAMO tipovima
      (`export type … from`) da izvozi format razmene iz `domain/state` i `domain/date`;
   3. nema dinamičkog `import()` ni `require()`;
   4. nema nedeterminizma (`Date.now`, `Math.random`, `new Date()` bez argumenta, `performance.now`);
   5. tranzitivno zatvorenje od `index.ts` ostaje u `halfMarathon/` (osim tipova kroz `exchange.ts`);
   6. obrnuto: van testova, HM uvoze samo aplikacioni izbor generatora (`generators/select.ts`, `generators/handoff.ts`).
   Dodatno (između generatora): nijedan izdvojeni generator (5K, 10K, HM) ne uvozi drugi, ni tipom, ni re-exportom; u HM
   stablu nema profila ni parametara 5K/10K/maratona ni maratonskih grana; nijedna HM putanja odluke o pripremi ne vodi
   kroz stari mehanizam (opcija 10K/5K se predaje kao argument). Proverivač se prvo proverava na veštačkim prekršajima.
   Proverivač je namerno dupliran (ne uvozi se iz 5K/10K testa), da izmena jednog ne oslabi drugi. */

type Files = ReadonlyMap<string, string>;
interface Edge {
  from: string;
  spec: string;
  to: string | null;
  typeOnly: boolean;
  kind: 'import' | 'export' | 'side-effect' | 'dynamic';
}

const STATEMENT =
  /(?:^|[;\n])\s*(import|export)\s+(type\s+)?((?:[\w*$\s,]*\{[^}]*\}|[\w*$\s,]+?|\*\s+as\s+\w+|\*))\s+from\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT = /(?:^|[;\n])\s*import\s+['"]([^'"]+)['"]/g;
const DYNAMIC = /\bimport\s*\(|\brequire\s*\(/g;

function resolveSpec(files: Files, from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')])
    if (files.has(c)) return c;
  return `UNRESOLVED:${base}`;
}

function edgesOf(files: Files, file: string): Edge[] {
  const src = (files.get(file) ?? '').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const out: Edge[] = [];
  for (const m of src.matchAll(STATEMENT)) {
    const clause = (m[3] ?? '').trim();
    const named = /^\{([\s\S]*)\}$/.exec(clause)?.[1];
    const allTypes =
      named !== undefined &&
      named
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .every((x) => x.startsWith('type '));
    out.push({
      from: file,
      spec: m[4]!,
      to: resolveSpec(files, file, m[4]!),
      typeOnly: !!m[2] || allTypes,
      kind: m[1] as 'import' | 'export'
    });
  }
  for (const m of src.matchAll(SIDE_EFFECT))
    out.push({
      from: file,
      spec: m[1]!,
      to: resolveSpec(files, file, m[1]!),
      typeOnly: false,
      kind: 'side-effect'
    });
  if (DYNAMIC.test(src))
    out.push({
      from: file,
      spec: 'import()/require()',
      to: null,
      typeOnly: false,
      kind: 'dynamic'
    });
  DYNAMIC.lastIndex = 0;
  return out;
}

const NONDETERMINISM = [
  /\bDate\.now\s*\(/,
  /\bMath\.random\s*\(/,
  /\bnew\s+Date\s*\(\s*\)/,
  /\bperformance\.now\s*\(/
];

/** Vraća spisak prekršaja za HM koren `root` nad skupom fajlova (stvarnih ili veštačkih). */
export function isolationViolations(files: Files, root: string, domain: string): string[] {
  const inside = (f: string): boolean => f.startsWith(root + '/');
  const isTest = (f: string): boolean => /\.test\.tsx?$/.test(f);
  const exchange = join(root, 'exchange.ts');
  const allowedExchangeTargets = new Set([
    join(domain, 'state/index.ts'),
    join(domain, 'date/index.ts')
  ]);
  const rel = (f: string): string => relative(domain, f);
  const out: string[] = [];
  const own = [...files.keys()].filter((f) => inside(f) && !isTest(f));
  for (const file of own) {
    const src = files.get(file) ?? '';
    for (const re of NONDETERMINISM)
      if (re.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')))
        out.push(`${rel(file)}: nedeterminizam ${re.source}`);
    for (const e of edgesOf(files, file)) {
      if (e.kind === 'dynamic') {
        out.push(`${rel(file)}: dinamički uvoz`);
        continue;
      }
      if (!e.to) {
        out.push(`${rel(file)}: spoljni uvoz '${e.spec}'`);
        continue;
      }
      if (e.to.startsWith('UNRESOLVED:')) {
        out.push(`${rel(file)}: nerazrešen uvoz '${e.spec}'`);
        continue;
      }
      if (inside(e.to)) continue;
      const viaExchange =
        file === exchange && e.typeOnly && e.kind === 'export' && allowedExchangeTargets.has(e.to);
      if (!viaExchange)
        out.push(`${rel(file)}: ${e.typeOnly ? 'tip' : 'izvršni'} ${e.kind} van HM → ${rel(e.to)}`);
    }
  }
  const exchangeSrc = files.get(exchange);
  if (exchangeSrc !== undefined) {
    const code = exchangeSrc.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    if (/\bexport\s+(?!type\b)/.test(code)) out.push('exchange.ts: izvozi nešto osim tipova');
  }
  // Tranzitivno zatvorenje od index.ts.
  const start = join(root, 'index.ts');
  const seen = new Set<string>();
  const stack = files.has(start) ? [start] : [];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const e of edgesOf(files, f)) {
      if (!e.to || e.to.startsWith('UNRESOLVED:')) continue;
      if (!inside(e.to)) {
        if (!(f === exchange && e.typeOnly))
          out.push(`tranzitivno: ${rel(start)} → … → ${rel(f)} → ${rel(e.to)}`);
        continue;
      }
      stack.push(e.to);
    }
  }
  // Obrnuto: ko uvozi HM.
  const allowedImporters = new Set([
    join(domain, 'generators/select.ts'),
    join(domain, 'generators/handoff.ts')
  ]);
  for (const file of files.keys()) {
    if (inside(file) || isTest(file)) continue;
    for (const e of edgesOf(files, file))
      if (e.to && inside(e.to) && !allowedImporters.has(file))
        out.push(`${rel(file)}: uvozi HM generator mimo izbora generatora`);
  }
  return [...new Set(out)];
}

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DOMAIN = join(SRC, 'domain');
const ROOT = join(DOMAIN, 'generators/halfMarathon');
/* Segment 4/5: dodat i izdvojeni maratonski generator (provera međusobnog uvoza pokriva sva četiri). */
const OTHER_GENERATORS = ['fiveK', 'tenK', 'marathon'].map((g) => join(DOMAIN, 'generators', g));

function walk(dir: string, out = new Map<string, string>()): Map<string, string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.set(p, readFileSync(p, 'utf8'));
  }
  return out;
}

describe('proverivač izolacije hvata prekršaje', () => {
  const D = '/v/src/domain';
  const R = `${D}/generators/halfMarathon`;
  const base = (): Map<string, string> =>
    new Map([
      [`${R}/index.ts`, "export { a } from './a';"],
      [`${R}/a.ts`, "import { b } from './b';\nexport const a = b;"],
      [`${R}/b.ts`, 'export const b = 1;'],
      [`${R}/exchange.ts`, "export type { GenPlanState } from '../../state';"],
      [`${D}/state/index.ts`, 'export type GenPlanState = {};'],
      [`${D}/date/index.ts`, 'export type IsoDate = string;'],
      [`${D}/training/generator/generatePlan.ts`, 'export const generatePlan = 1;'],
      [`${D}/generators/select.ts`, "import * as hm from './halfMarathon';"],
      [`${D}/generators/handoff.ts`, "export { regenerateFuture } from './halfMarathon';"],
      [`${D}/generators/fiveK/index.ts`, 'export const generatePlan = 1;'],
      [`${D}/generators/tenK/index.ts`, 'export const generatePlan = 1;'],
      [`${D}/plan/preparationDecision.ts`, 'export const preparationDecision = 1;']
    ]);
  const check = (patch: Record<string, string>): string[] => {
    const files = base();
    for (const [k, v] of Object.entries(patch)) files.set(k, v);
    return isolationViolations(files, R, D);
  };

  it('čist modul nema prekršaja', () => expect(check({})).toEqual([]));
  it('direktan uvoz starog generatora', () =>
    expect(
      check({
        [`${R}/b.ts`]: "import { generatePlan } from '../../training/generator/generatePlan';"
      })
    ).not.toEqual([]));
  it('re-export iz starog mehanizma (named i zvezdica)', () => {
    expect(
      check({
        [`${R}/b.ts`]: "export { generatePlan } from '../../training/generator/generatePlan';"
      })
    ).not.toEqual([]);
    expect(
      check({ [`${R}/b.ts`]: "export * from '../../training/generator/generatePlan';" })
    ).not.toEqual([]);
  });
  it('uvoz 5K/10K generatora i aplikacione predaje (izvršni i tip)', () => {
    expect(check({ [`${R}/b.ts`]: "import { generatePlan } from '../fiveK';" })).not.toEqual([]);
    expect(check({ [`${R}/b.ts`]: "import type { X } from '../tenK/index';" })).not.toEqual([]);
    expect(
      check({ [`${R}/b.ts`]: "import { regeneratorForDistance } from '../handoff';" })
    ).not.toEqual([]);
  });
  it('stara odluka o pripremi (re-export ili uvoz)', () => {
    expect(
      check({
        [`${R}/b.ts`]: "export { preparationDecision } from '../../plan/preparationDecision';"
      })
    ).not.toEqual([]);
    expect(
      check({
        [`${R}/b.ts`]: "import { preparationDecision } from '../../plan/preparationDecision';"
      })
    ).not.toEqual([]);
  });
  it('tip van 10K mimo exchange.ts', () =>
    expect(
      check({ [`${R}/b.ts`]: "import type { GenPlanState } from '../../state';" })
    ).not.toEqual([]));
  it('izvršni izvoz kroz exchange.ts', () =>
    expect(check({ [`${R}/exchange.ts`]: "export { seedState } from '../../state';" })).not.toEqual(
      []
    ));
  it('tranzitivni put kroz 10K fajl', () => {
    const v = check({
      [`${R}/b.ts`]: "export { x } from './c';",
      [`${R}/c.ts`]: "export { generatePlan as x } from '../../training/generator/generatePlan';"
    });
    expect(v.some((s) => s.startsWith('tranzitivno'))).toBe(true);
  });
  it('paket, alias, dinamički uvoz, nedeterminizam', () => {
    expect(check({ [`${R}/b.ts`]: "import { z } from 'zod';" })).not.toEqual([]);
    expect(check({ [`${R}/b.ts`]: "import { x } from '@/domain/plan';" })).not.toEqual([]);
    expect(check({ [`${R}/b.ts`]: "const m = import('../../plan');" })).not.toEqual([]);
    expect(check({ [`${R}/b.ts`]: 'export const t = Date.now();' })).not.toEqual([]);
    expect(check({ [`${R}/b.ts`]: 'export const t = new Date();' })).not.toEqual([]);
  });
  it('uvoz HM mimo izbora generatora', () =>
    expect(
      check({
        [`${D}/plan/replan.ts`]: "import { generatePlan } from '../generators/halfMarathon';"
      })
    ).not.toEqual([]));
  it('5K i 10K generator ne smeju da uvoze HM', () => {
    expect(
      check({
        [`${D}/generators/fiveK/index.ts`]: "export { generatePlan } from '../halfMarathon';"
      })
    ).not.toEqual([]);
    expect(
      check({
        [`${D}/generators/tenK/index.ts`]: "import type { X } from '../halfMarathon/exchange';"
      })
    ).not.toEqual([]);
  });
});

describe('HM generator je izolovan (stvarni kod)', () => {
  it('nema zabranjenih direktnih, tranzitivnih ni obrnutih zavisnosti', () => {
    const files = walk(SRC);
    expect(files.has(join(ROOT, 'index.ts'))).toBe(true);
    expect(isolationViolations(files, ROOT, DOMAIN)).toEqual([]);
  });

  it('nijedna izvršna funkcija nije deljena: svaki HM fajl je u HM stablu', () => {
    const files = walk(SRC);
    const own = [...files.keys()].filter((f) => f.startsWith(ROOT + '/') && !/\.test\./.test(f));
    expect(own.length).toBeGreaterThan(60);
    // Uvoz celog modula iz aplikacije ide samo kroz javni API.
    for (const [file, src] of files) {
      // Testna infrastruktura (`src/test/`, npr. `generators.ts`) je testni kod, kao i `*.test.*`.
      if (
        file.startsWith(ROOT + '/') ||
        /\.test\./.test(file) ||
        file.startsWith(join(SRC, 'test/'))
      )
        continue;
      expect(src, file).not.toMatch(/generators\/halfMarathon\/[\w/]+['"]/);
    }
  });

  it('generatori se međusobno ne uvoze (ni tipom), u oba smera, uključujući HM', () => {
    const files = walk(SRC);
    const crosses: string[] = [];
    const all = [ROOT, ...OTHER_GENERATORS];
    const name = (root: string): string => root.slice(root.lastIndexOf('/') + 1);
    for (const [file, src] of files) {
      if (/\.test\./.test(file)) continue;
      const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      const owner = all.find((r) => file.startsWith(r + '/'));
      if (!owner) continue;
      for (const other of all)
        if (other !== owner && new RegExp(`from\\s+['"][^'"]*${name(other)}[^'"]*['"]`).test(code))
          crosses.push(`${relative(DOMAIN, file)} → ${name(other)}`);
      if (/from\s+['"][^'"]*(handoff|select)['"]/.test(code))
        crosses.push(`${relative(DOMAIN, file)} → aplikacioni izbor`);
    }
    expect(crosses).toEqual([]);
  });

  /* Čitanje tuđih oznaka ostaje namerno (kao u 10K): tip `RaceDistanceM` i M zona u `paceForZone`/opisu, jer HM
     adaptacija dobija i maratonski plan (opcija „kraća distanca: polumaraton") čiji zaštićeni dani ostaju maratonski. */
  it('HM stablo nema profile, parametre ni grane drugih distanci', () => {
    const files = walk(ROOT);
    const names = [...files.keys()].map((f) => relative(ROOT, f));
    expect(names).toContain('training/distances/profile21k.ts');
    expect(names).toContain('training/distances/hmProgression.ts');
    expect(names).toContain('plan/preparationDecision.ts');
    for (const gone of [
      'training/distances/profile5k.ts',
      'training/distances/profile10k.ts',
      'training/distances/profile42k.ts',
      'training/sessions/progression.ts'
    ])
      expect(names).not.toContain(gone);
    for (const [file, src] of files) {
      if (/\.test\./.test(file)) continue;
      const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      expect(code, file).not.toMatch(
        /\b(PROFILE|HEURISTIC|PRODUCT)_(5K|10K|42K)\b|longRunCycle|marathonConsolidation|marathonPaceBudget|fuelStrongFromMin|intervalPaceForWeek/
      );
    }
  });

  it('HM odluka o pripremi ne sadrži 10K/5K generisanje: kraću distancu dobija samo kao argument', () => {
    const src = walk(ROOT).get(join(ROOT, 'plan/preparationDecision.ts'))!;
    expect(src).toMatch(/handoff: ShorterDistanceHandoff/);
    expect(src).toMatch(/21097\.5: \[10000, 5000\]/);
    expect(src).not.toMatch(/^\s*(10000|5000|42195):/m);
  });
});
