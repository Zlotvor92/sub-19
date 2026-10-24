import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const V2 = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(V2, '../../../..');
const isTest = (f: string): boolean => /\.test\.tsx?$/.test(f);
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const STATEMENT =
  /(?:^|[;\n])\s*(import|export)\s+(type\s+)?((?:[\w*$\s,]*\{[^}]*\}|[\w*$\s,]+?|\*\s+as\s+\w+|\*))\s+from\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT = /(?:^|[;\n])\s*import\s+['"]([^'"]+)['"]/g;

/** Uvozi fajla koji izlaze iz tenK/v2/ — STROŽE od 5K v2: ni type-only uvoz van v2/ nije dozvoljen. */
export function escapingImports(file: string, src: string): string[] {
  const out: string[] = [];
  const code = strip(src);
  for (const m of code.matchAll(STATEMENT)) {
    const spec = m[4]!;
    const target = spec.startsWith('.') ? resolve(dirname(file), spec) : null;
    const inside = target !== null && (target === V2 || target.startsWith(V2 + '/'));
    if (!inside) out.push(`${relative(V2, file)} → ${spec}`);
  }
  for (const m of code.matchAll(SIDE_EFFECT))
    out.push(`${relative(V2, file)} → side-effect ${m[1]}`);
  if (/\bimport\s*\(|\brequire\s*\(/.test(code)) out.push(`${relative(V2, file)} → dinamički uvoz`);
  return out;
}

/** Ivice ka tenK/v2/ iz fajla van v2: relativni uvoz u v2 (putanja) i svaki pomen `generators/tenK/v2` van relativnog
    uvoza — alias `@/…/tenK/v2`, dinamički uvoz (10K-07, owner K). */
export function v2Edges(file: string, src: string): string[] {
  const code = strip(src);
  const edges: string[] = [];
  let rel = code;
  for (const m of code.matchAll(STATEMENT)) {
    const spec = m[4]!;
    const target = spec.startsWith('.') ? resolve(dirname(file), spec) : null;
    if (target !== null && (target === V2 || target.startsWith(V2 + '/'))) {
      edges.push(`${relative(SRC, file)} → ${relative(SRC, target)}`);
      rel = rel.replace(m[0], '');
    }
  }
  if (/generators\/tenK\/v2(?![\w-])/.test(rel)) edges.push(`${relative(SRC, file)} → alias v2`);
  return edges;
}

describe('10K v2 je izolovan (Uslov 7)', () => {
  const own = walk(V2).filter((f) => !isTest(f));

  it('tenK/v2 ne uvozi NIŠTA van tenK/v2/ (ni fiveK, ni tenK v1, ni domain/*, ni type-only)', () => {
    expect(own.length).toBeGreaterThanOrEqual(15);
    const bad = own.flatMap((f) => escapingImports(f, readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('provera hvata svaki uvoz van v2/, uključujući type-only', () => {
    const f = join(V2, 'x.ts');
    expect(escapingImports(f, "import { a } from '../plan/x';")).not.toEqual([]);
    expect(escapingImports(f, "import { x } from '../../fiveK/v2/paces.ts';")).not.toEqual([]);
    expect(escapingImports(f, "import type { IsoDate } from '../date';")).not.toEqual([]);
    expect(escapingImports(f, "import { type IsoDate } from '../../../types';")).not.toEqual([]);
    expect(escapingImports(f, "import { z } from 'zod';")).not.toEqual([]);
    expect(escapingImports(f, "const m = import('../plan');")).not.toEqual([]);
    expect(escapingImports(f, "export { a } from '../index.ts';")).not.toEqual([]);
    expect(escapingImports(f, "import { a } from './policy.ts';")).toEqual([]);
  });

  it('nema čitanja sata ni slučajnosti u tenK/v2/', () => {
    for (const f of own) {
      const code = strip(readFileSync(f, 'utf8'));
      expect(code, f).not.toMatch(/\bDate\b|Math\.random|performance\.now/);
    }
  });

  it('segment 05: van tenK/v2/ v2 uvozi SAMO tenK/index.ts, i to samo adapter app/index.ts (select.ts → tenK)', () => {
    const outside = walk(SRC).filter((f) => !f.startsWith(V2 + '/') && !isTest(f));
    const edges = outside.flatMap((f) => v2Edges(f, readFileSync(f, 'utf8')));
    expect(edges).toEqual([
      'domain/generators/tenK/index.ts → domain/generators/tenK/v2/app/index.ts'
    ]);
  });

  it('10K-07: ivica van v2 hvata i alias `@/…/tenK/v2` i dinamički uvoz (kao HM/MAR)', () => {
    const f = join(SRC, 'x.ts');
    expect(v2Edges(f, "import { a } from '@/domain/generators/tenK/v2/app/index.ts';")).toEqual([
      'x.ts → alias v2'
    ]);
    expect(v2Edges(f, "const m = await import('@/domain/generators/tenK/v2');")).toEqual([
      'x.ts → alias v2'
    ]);
    expect(v2Edges(f, "import { a } from './domain/generators/tenK/v2/app/index.ts';")).toEqual([
      'x.ts → domain/generators/tenK/v2/app/index.ts'
    ]);
    expect(v2Edges(f, "import { a } from '@/domain/generators/tenK';")).toEqual([]);
  });
});
