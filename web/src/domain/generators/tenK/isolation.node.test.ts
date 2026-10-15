import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* IZOLACIJA 10K GENERATORA — direktne i tranzitivne zavisnosti, uključujući re-export.

   Ista pravila kao za 5K (`fiveK/isolation.node.test.ts`, koji ostaje nepromenjen i važi i dalje), primenjena na
   `domain/generators/tenK/**` (bez testova):
   1. nijedan uvoz paketa ni `@/` alias (10K ne koristi spoljne biblioteke);
   2. svaki relativan uvoz/re-export mora ostati u `tenK/`; jedini izuzetak je `exchange.ts`, koji sme SAMO tipovima
      (`export type … from`) da izvozi format razmene iz `domain/state` i `domain/date`;
   3. nema dinamičkog `import()` ni `require()`;
   4. nema nedeterminizma (`Date.now`, `Math.random`, `new Date()` bez argumenta, `performance.now`);
   5. tranzitivno zatvorenje od `index.ts` ostaje u `tenK/` (osim tipova kroz `exchange.ts`);
   6. obrnuto: van testova, 10K uvoze samo aplikacioni izbor generatora (`generators/select.ts`, `generators/handoff.ts`).
   Dodatno (između generatora): nijedan izdvojeni generator ne uvozi drugi, ni tipom; u 10K stablu nema profila ni
   parametara 5K/HM/maratona. Proverivač se prvo proverava na veštačkim prekršajima (da ne prolazi „na prazno").
   Proverivač je namerno dupliran (ne uvozi se iz 5K testa), da izmena jednog ne oslabi drugi. */

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

/** Vraća spisak prekršaja za 10K koren `root` nad skupom fajlova (stvarnih ili veštačkih). */
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
        out.push(
          `${rel(file)}: ${e.typeOnly ? 'tip' : 'izvršni'} ${e.kind} van 10K → ${rel(e.to)}`
        );
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
  // Obrnuto: ko uvozi 10K.
  const allowedImporters = new Set([
    join(domain, 'generators/select.ts'),
    join(domain, 'generators/handoff.ts')
  ]);
  for (const file of files.keys()) {
    if (inside(file) || isTest(file)) continue;
    for (const e of edgesOf(files, file))
      if (e.to && inside(e.to) && !allowedImporters.has(file))
        out.push(`${rel(file)}: uvozi 10K generator mimo izbora generatora`);
  }
  return [...new Set(out)];
}

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DOMAIN = join(SRC, 'domain');
const ROOT = join(DOMAIN, 'generators/tenK');
const FIVE_K_ROOT = join(DOMAIN, 'generators/fiveK');

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
  const R = `${D}/generators/tenK`;
  const base = (): Map<string, string> =>
    new Map([
      [`${R}/index.ts`, "export { a } from './a';"],
      [`${R}/a.ts`, "import { b } from './b';\nexport const a = b;"],
      [`${R}/b.ts`, 'export const b = 1;'],
      [`${R}/exchange.ts`, "export type { GenPlanState } from '../../state';"],
      [`${D}/state/index.ts`, 'export type GenPlanState = {};'],
      [`${D}/date/index.ts`, 'export type IsoDate = string;'],
      [`${D}/training/generator/generatePlan.ts`, 'export const generatePlan = 1;'],
      [`${D}/generators/select.ts`, "import * as tenK from './tenK';"],
      [`${D}/generators/fiveK/index.ts`, 'export const generatePlan = 1;']
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
  it('uvoz 5K generatora (izvršni i tip)', () => {
    expect(check({ [`${R}/b.ts`]: "import { generatePlan } from '../fiveK';" })).not.toEqual([]);
    expect(check({ [`${R}/b.ts`]: "import type { X } from '../fiveK/index';" })).not.toEqual([]);
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
  it('uvoz 10K mimo izbora generatora', () =>
    expect(
      check({ [`${D}/plan/replan.ts`]: "import { generatePlan } from '../generators/tenK';" })
    ).not.toEqual([]));
  it('5K generator ne sme da uvozi 10K', () =>
    expect(
      check({ [`${D}/generators/fiveK/index.ts`]: "export { generatePlan } from '../tenK';" })
    ).not.toEqual([]));
});

describe('10K generator je izolovan (stvarni kod)', () => {
  it('nema zabranjenih direktnih, tranzitivnih ni obrnutih zavisnosti', () => {
    const files = walk(SRC);
    expect(files.has(join(ROOT, 'index.ts'))).toBe(true);
    expect(isolationViolations(files, ROOT, DOMAIN)).toEqual([]);
  });

  it('nijedna izvršna funkcija nije deljena: svaki 10K fajl je u 10K stablu', () => {
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
      expect(src, file).not.toMatch(/generators\/tenK\/[\w/]+['"]/);
    }
  });

  it('generatori se međusobno ne uvoze (ni tipom), u oba smera', () => {
    const files = walk(SRC);
    const crosses: string[] = [];
    for (const [file, src] of files) {
      if (/\.test\./.test(file)) continue;
      const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      if (file.startsWith(ROOT + '/') && /from\s+['"][^'"]*fiveK[^'"]*['"]/.test(code))
        crosses.push(relative(DOMAIN, file));
      if (file.startsWith(FIVE_K_ROOT + '/') && /from\s+['"][^'"]*tenK[^'"]*['"]/.test(code))
        crosses.push(relative(DOMAIN, file));
    }
    expect(crosses).toEqual([]);
  });

  it('10K stablo nema profile ni parametre drugih distanci', () => {
    const files = walk(ROOT);
    const names = [...files.keys()].map((f) => relative(ROOT, f));
    for (const gone of [
      'training/distances/profile5k.ts',
      'training/distances/profile21k.ts',
      'training/distances/profile42k.ts',
      'training/distances/hmProgression.ts'
    ])
      expect(names).not.toContain(gone);
    for (const [file, src] of files) {
      if (/\.test\./.test(file)) continue;
      const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      expect(code, file).not.toMatch(
        /\b(PROFILE|HEURISTIC|PRODUCT)_(5K|21K|42K)\b|HM_WEEKLY_FAST_SHARE|hmTrack|midweekLong|longRunFinish|marathonConsolidation/
      );
    }
  });
});
