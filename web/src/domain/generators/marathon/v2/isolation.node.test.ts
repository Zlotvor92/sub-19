import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* Uslov 7 (AGENTS.md): maraton v2 ne uvozi NIŠTA van marathon/v2/ (ni 10K/5K/HM v2, ni maraton v1, ni
   domain/*, ni type-only); van marathon/v2/ ga od segmenta MAR-05 uvozi samo marathon/index.ts (adapter app/).
   Obrazac tenK/v2/isolation.node.test.ts (kopija, ne uvoz). */

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

/** Uvozi fajla koji izlaze iz marathon/v2/ — ni type-only uvoz van v2/ nije dozvoljen. */
function escapingImports(file: string, src: string): string[] {
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

describe('maraton v2 je izolovan (Uslov 7)', () => {
  const own = walk(V2).filter((f) => !isTest(f));

  it('marathon/v2 ne uvozi NIŠTA van marathon/v2/ (ni drugi v2, ni maraton v1, ni domain/*, ni type-only)', () => {
    expect(own.length).toBeGreaterThanOrEqual(15);
    const bad = own.flatMap((f) => escapingImports(f, readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('provera hvata svaki uvoz van v2/, uključujući type-only', () => {
    const f = join(V2, 'x.ts');
    expect(escapingImports(f, "import { a } from '../plan/x';")).not.toEqual([]);
    expect(escapingImports(f, "import { x } from '../../tenK/v2/paces.ts';")).not.toEqual([]);
    expect(escapingImports(f, "import { x } from '../../halfMarathon/v2/paces.ts';")).not.toEqual(
      []
    );
    expect(escapingImports(f, "import type { IsoDate } from '../date';")).not.toEqual([]);
    expect(escapingImports(f, "import { type IsoDate } from '../../../types';")).not.toEqual([]);
    expect(escapingImports(f, "import { z } from 'zod';")).not.toEqual([]);
    expect(escapingImports(f, "const m = import('../plan');")).not.toEqual([]);
    expect(escapingImports(f, "export { a } from '../index.ts';")).not.toEqual([]);
    expect(escapingImports(f, "import { a } from './policy.ts';")).toEqual([]);
  });

  it('nema čitanja sata ni slučajnosti u marathon/v2/', () => {
    for (const f of own) {
      const code = strip(readFileSync(f, 'utf8'));
      expect(code, f).not.toMatch(/\bDate\b|Math\.random|performance\.now/);
    }
  });

  it('segment MAR-05: van marathon/v2/ v2 uvozi SAMO marathon/index.ts, i to samo adapter app/index.ts (select.ts → marathon)', () => {
    const outside = walk(SRC).filter((f) => !f.startsWith(V2 + '/') && !isTest(f));
    const edges: string[] = [];
    for (const f of outside) {
      const code = strip(readFileSync(f, 'utf8'));
      for (const m of code.matchAll(STATEMENT)) {
        const spec = m[4]!;
        const target = spec.startsWith('.') ? resolve(dirname(f), spec) : null;
        if (target !== null && (target === V2 || target.startsWith(V2 + '/')))
          edges.push(`${relative(SRC, f)} → ${relative(SRC, target)}`);
      }
      if (/generators\/marathon\/v2/.test(code)) edges.push(`${relative(SRC, f)} → alias v2`);
    }
    expect(edges).toEqual([
      'domain/generators/marathon/index.ts → domain/generators/marathon/v2/app/index.ts'
    ]);
  });
});
