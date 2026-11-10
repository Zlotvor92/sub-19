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

/** V1b: neutralni tipovi razmene su u `app/exchange.ts` (preseljeni iz `fiveK/exchange.ts` pri brisanju 5K v1); jedini
 *  fajl v2 koji sme da izađe iz v2/, i to samo type-only ka neutralnim tipovima aplikacije (`domain/state`, `domain/date`). */
const EXCHANGE = resolve(V2, 'app/exchange.ts');
const NEUTRAL = [resolve(SRC, 'domain/state'), resolve(SRC, 'domain/date')];

/** Uvozi v2 izvornog fajla koji izlaze iz v2/ (a nisu type-only iz `app/exchange.ts` ka neutralnim tipovima). */
export function escapingImports(file: string, src: string): string[] {
  const out: string[] = [];
  const code = strip(src);
  for (const m of code.matchAll(STATEMENT)) {
    const typeOnly =
      Boolean(m[2]) || /^\{\s*(type\s+[\w$]+\s*(as\s+[\w$]+\s*)?,?\s*)+\}$/.test(m[3]!.trim());
    const spec = m[4]!;
    const target = spec.startsWith('.') ? resolve(dirname(file), spec) : null;
    const inside = target !== null && (target === V2 || target.startsWith(V2 + '/'));
    const neutral =
      file.replace(/\.ts$/, '') === EXCHANGE.replace(/\.ts$/, '') &&
      target !== null &&
      NEUTRAL.includes(target.replace(/\/index(\.ts)?$|\.ts$/, ''));
    if (!inside && !(typeOnly && neutral)) out.push(`${relative(V2, file)} → ${spec}`);
  }
  for (const m of code.matchAll(SIDE_EFFECT))
    out.push(`${relative(V2, file)} → side-effect ${m[1]}`);
  if (/\bimport\s*\(|\brequire\s*\(/.test(code)) out.push(`${relative(V2, file)} → dinamički uvoz`);
  return out;
}

describe('5K v2 je izolovan', () => {
  const own = walk(V2).filter((f) => !isTest(f));

  it('v2/ ne uvozi ništa izvan v2/ (osim type-only)', () => {
    expect(own.length).toBeGreaterThanOrEqual(12);
    const bad = own.flatMap((f) => escapingImports(f, readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('provera hvata izvršni uvoz van v2/ i type-only van app/exchange.ts, a propušta type-only ka exchange', () => {
    const f = join(V2, 'x.ts');
    const ex = join(V2, 'app', 'exchange.ts');
    expect(
      escapingImports(f, "import { vdotFromRace } from '../training/vdot/calculateVDOT';")
    ).not.toEqual([]);
    expect(escapingImports(f, "import { x } from '../../tenK';")).not.toEqual([]);
    expect(escapingImports(f, "import { z } from 'zod';")).not.toEqual([]);
    expect(escapingImports(f, "const m = import('../plan');")).not.toEqual([]);
    expect(escapingImports(f, "import type { IsoDate } from './app/exchange.ts';")).toEqual([]);
    expect(escapingImports(f, "import { type IsoDate } from './app/exchange';")).toEqual([]);
    expect(escapingImports(join(V2, 'app', 'x.ts'), "import type { T } from './exchange.ts';")).toEqual(
      []
    );
    expect(escapingImports(ex, "export type { T } from '../../../../state';")).toEqual([]);
    expect(escapingImports(ex, "export type { IsoDate } from '../../../../date';")).toEqual([]);
    expect(escapingImports(ex, "export { T } from '../../../../state';")).not.toEqual([]);
    expect(escapingImports(ex, "export type { T } from '../../../../plan';")).not.toEqual([]);
    expect(escapingImports(f, "import type { T } from '../../../state';")).not.toEqual([]);
    expect(escapingImports(f, "import type { IsoDate } from '../exchange.ts';")).not.toEqual([]);
    expect(escapingImports(f, "import type { IsoDate } from '../date';")).not.toEqual([]);
    expect(escapingImports(f, "import type { X } from '../../tenK/v2/types.ts';")).not.toEqual([]);
    expect(escapingImports(f, "import { a } from './policy.ts';")).toEqual([]);
  });

  it('nema čitanja sata ni slučajnosti u v2/', () => {
    for (const f of own) {
      const code = strip(readFileSync(f, 'utf8'));
      expect(code, f).not.toMatch(/\bDate\b|Math\.random|performance\.now/);
    }
  });

  it('V1b: van v2/ v2 uvozi SAMO select.ts, i to samo adapter app/index.ts', () => {
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
      // 5k-v2.11.0 (owner K): i uvoz preko aliasa `@/…/fiveK/v2` (kao HM/MAR).
      if (/generators\/fiveK\/v2/.test(code)) edges.push(`${relative(SRC, f)} → alias v2`);
    }
    expect(edges).toEqual([
      'domain/generators/select.ts → domain/generators/fiveK/v2/app/index.ts'
    ]);
  });
});
