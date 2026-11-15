import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALL_SHARDS,
  CWD_READS,
  E2E_SHARDS,
  MAX_SHARDS,
  buildGraph,
  decide,
  isTestFile,
  scopeOf
} from './ciScope.mjs';

/* scripts/ciScope.mjs: izbor testova po dometu izmene (TEST-SPEED.md § 13). Tabela slučajeva nad malim veštačkim
   stablom (tačan očekivan skup) + provere nad stvarnim stablom repozitorijuma. */

const HM = 'web/src/domain/generators/halfMarathon/v2';
const MAR = 'web/src/domain/generators/marathon/v2';
const TREE: Record<string, string> = {
  'web/src/main.tsx': "import { A } from './features/A.tsx';",
  'web/src/features/A.tsx': "import { hm } from '@/domain/generators/select';",
  'web/src/features/A.test.tsx': "import { A } from './A';",
  'web/src/features/B.tsx': 'export const B = 1;',
  'web/src/features/B.test.tsx': "import { B } from './B.tsx';",
  'web/src/domain/generators/select.ts': `import { hm } from './halfMarathon/v2/app/index.ts';
     export { mar } from './marathon/v2/app';`,
  [`${HM}/app/index.ts`]: "export * from '../core';",
  [`${HM}/core.ts`]: 'export const hm = 1;',
  [`${HM}/baseline.json`]: '{}',
  [`${HM}/seg10.a-1.json`]: '{}',
  [`${HM}/grid.node.test.ts`]: `import { readFileSync } from 'node:fs';
     import { hm } from './core.ts';
     const DIR = dirname(fileURLToPath(import.meta.url));
     const b = readFileSync(join(DIR, 'baseline.json'));
     const n = (k) => readFileSync(new URL(\`./seg10.\${k}-1.json\`, import.meta.url));`,
  [`${HM}/app/flow.node.test.ts`]: `import { readFileSync } from 'node:fs';
     const s = readFileSync(new URL('../../../../../stores/x.ts', import.meta.url));`,
  [`${HM}/app/old.node.test.ts`]: "import { gone } from './obrisan';",
  [`${MAR}/app/index.ts`]: "export * from '../core.ts';",
  [`${MAR}/core.ts`]: 'export const mar = 1;',
  [`${MAR}/grid.node.test.ts`]: "import { mar } from './core';",
  'web/src/stores/x.ts': 'export const x = 1;',
  'web/src/pwa/static.node.test.ts':
    "const WEB = process.cwd(); readFileSync(join(WEB, 'index.html'));",
  'web/src/test/setup.ts': '',
  'web/index.html': '<html></html>',
  'web/e2e/hm.spec.ts': '',
  'docs/testing/TEST-SPEED.md': '',
  '.claude/skills/x/SKILL.md': ''
};
const FILES = new Set(Object.keys(TREE));
const read = (f: string): string => TREE[f] ?? '';

const pick = (changed: string[], force: string | null = null) => {
  const d = decide({ changed, files: FILES, read, force });
  return { ...d, all: [...d.testFiles].sort() };
};

const HM_GRID = 'src/domain/generators/halfMarathon/v2/grid.node.test.ts';
const HM_FLOW = 'src/domain/generators/halfMarathon/v2/app/flow.node.test.ts';
const HM_OLD = 'src/domain/generators/halfMarathon/v2/app/old.node.test.ts';
const MAR_GRID = 'src/domain/generators/marathon/v2/grid.node.test.ts';
const A = 'src/features/A.test.tsx';
const B = 'src/features/B.test.tsx';
const PWA = 'src/pwa/static.node.test.ts';

describe('izbor po dometu izmene (veštačko stablo)', () => {
  it('V4 folder: odlučuje graf, ne „sve“ (aplikacija ga još ne uvozi)', () => {
    const d = pick(['web/src/domain/v4/engine/plan.ts']);
    expect(d.mode).toBe('select');
    expect(d.e2e).toBe(false);
  });
  it.each([
    ['jedna distanca (kod v2)', [`${HM}/core.ts`], [A, HM_GRID, PWA].sort(), true],
    ['dve distance', [`${HM}/core.ts`, `${MAR}/core.ts`], [A, HM_GRID, MAR_GRID, PWA].sort(), true],
    ['ekran', ['web/src/features/B.tsx'], [B, PWA], false],
    ['ekran u grafu aplikacije', ['web/src/features/A.tsx'], [A, PWA], true],
    ['bazna linija (fs, ne uvoz)', [`${HM}/baseline.json`], [HM_GRID, PWA], false],
    ['niska sa ${…} → prefiks', [`${HM}/seg10.b-1.json`], [HM_GRID, PWA], false],
    ['fajl van domena koji test čita kroz fs', ['web/src/stores/x.ts'], [HM_FLOW, PWA], false],
    // grid i flow čitaju svoj folder kroz import.meta.url, old ga uvozi
    [
      'obrisan/nov fajl na nerazrešenoj putanji',
      [`${HM}/app/obrisan.ts`],
      [HM_FLOW, HM_GRID, HM_OLD, PWA].sort(),
      false
    ],
    ['E2E spec', ['web/e2e/hm.spec.ts'], [PWA], true]
  ])('%s', (_, changed, tests, e2e) => {
    const d = pick(changed);
    expect(d.mode).toBe('select');
    expect(d.all).toEqual(tests);
    expect(d.e2e).toBe(e2e);
    expect(d.static).toBe(true);
  });

  it.each([
    ['zajednička test infrastruktura', ['web/src/test/setup.ts']],
    ['workflow', ['.github/workflows/test.yml']],
    ['docs/qa', ['docs/qa/generator-ab/inputs.json']],
    ['zavisnosti', ['web/package-lock.json']],
    ['web/scripts', ['web/scripts/testSequencer.ts']],
    ['zajednički domen', ['web/src/domain/plan/x.ts']],
    ['koren generators/*.ts', ['web/src/domain/generators/select.ts']],
    ['v1 kod distance', ['web/src/domain/generators/halfMarathon/index.ts']],
    ['nepoznata distanca', ['web/src/domain/generators/ultra/v2/x.ts']],
    ['nepoznat fajl u web/', ['web/nov.config.ts']],
    ['mešano: distanca + zajedničko', [`${HM}/core.ts`, 'web/src/test/setup.ts']]
  ])('sve: %s', (_, changed) => {
    const d = pick(changed);
    expect(d.mode).toBe('all');
    expect(d.reasons.length).toBeGreaterThan(0);
    expect([d.tests, d.static, d.e2e]).toEqual(['all', true, true]);
    expect(d.testShards).toHaveLength(ALL_SHARDS);
    expect(ALL_SHARDS).toBe(10); // V1b: „sve" u 10 delova
    expect(d.e2eShards).toHaveLength(E2E_SHARDS);
  });

  it('main / ručno / bez zelenog run-a: sve, i bez ijedne izmene', () => {
    expect(pick([], 'main').mode).toBe('all');
    expect(pick([], 'main').reasons).toEqual(['main']);
  });

  it.each([
    ['samo dokumentacija', ['docs/testing/TEST-SPEED.md']],
    ['van koda aplikacije', ['.claude/skills/x/SKILL.md']]
  ])('ništa: %s', (_, changed) => {
    const d = pick(changed);
    expect([d.mode, d.tests, d.static, d.e2e]).toEqual(['none', 'none', false, false]);
    expect([...d.testShards, ...d.e2eShards]).toEqual([]);
  });

  it('dinamički uvoz bez literala: ceo folder + relativne niske; child_process: sve', () => {
    const tree = {
      'web/src/d/a.node.test.ts': "const M = { x: './x' }; await import(M.x);",
      'web/src/d/x.ts': '',
      'web/src/e/b.node.test.ts': "import { execSync } from 'node:child_process';"
    } as Record<string, string>;
    const g = buildGraph(new Set(Object.keys(tree)), (f: string) => tree[f]);
    const a = scopeOf(g, 'web/src/d/a.node.test.ts');
    expect([a.anything, a.prefixes.has('web/src/d/'), a.prefixes.has('web/src/d/x')]).toEqual([
      false,
      true,
      true
    ]);
    expect(scopeOf(g, 'web/src/e/b.node.test.ts').anything).toBe(true);
  });
});

/* ---------- stvarno stablo ---------- */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REAL = new Set(
  execFileSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)
);
const realRead = (f: string): string => readFileSync(`${ROOT}${f}`, 'utf8');
const WEIGHTS = JSON.parse(realRead('web/scripts/test-durations.json')) as Record<string, number>;

describe('izbor nad stvarnim stablom', () => {
  const graph = buildGraph(REAL, realRead);
  const tests = [...REAL].filter((f) => f.startsWith('web/') && isTestFile(f.slice(4)));

  it('nijedan test nema domet „sve" (child_process, apsolutan uvoz)', () => {
    expect(tests.filter((t) => scopeOf(graph, t).anything)).toEqual([]);
  });

  it('moduli sa process.cwd() su tačno pregledani spisak (CWD_READS)', () => {
    // web/e2e (Playwright, ne vitest) i web/scripts (izmena → sve) nisu u dometu vitest testova preko ovog pravila.
    const cwd = [...REAL]
      .filter((f) => /^web\/(?!e2e\/|scripts\/).*\.(ts|tsx|mjs|js)$/.test(f))
      .filter((f) => /process\.cwd\(/.test(realRead(f)));
    expect(cwd.sort()).toEqual(Object.keys(CWD_READS).sort());
  });

  it('svaki fajl iz tabele trajanja (pun nivo, svi projekti) je test fajl', () => {
    const known = Object.keys(WEIGHTS).filter((k) => REAL.has(`web/${k}`));
    expect(known.filter((k) => !isTestFile(k))).toEqual([]);
  });

  it('HM v2: svi testovi foldera, nijedna mreža maratona; maraton isto obrnuto', () => {
    const hm = decide({
      changed: [`${HM}/policy.ts`],
      files: REAL,
      read: realRead,
      weights: WEIGHTS
    });
    const own = tests
      .map((t) => t.slice(4))
      .filter((t) => t.startsWith('src/domain/generators/halfMarathon/'));
    expect(own.filter((t) => !hm.testFiles.includes(t))).toEqual([]);
    const marGrids = hm.testFiles.filter(
      (t) =>
        t.startsWith('src/domain/generators/marathon/v2/') &&
        !t.startsWith('src/domain/generators/marathon/v2/app/')
    );
    expect(marGrids.filter((t) => !t.endsWith('isolation.node.test.ts'))).toEqual([]);
    expect(hm.testShards.length).toBeGreaterThan(1);
    expect(hm.testShards.length).toBeLessThanOrEqual(MAX_SHARDS);
    expect(hm.e2e).toBe(true);
  });

  it('bazna linija v2 (json): bez E2E; od drugih distanci samo provere izolacije (čitaju izvor)', () => {
    const json = [...REAL].find((f) => f.startsWith(`${HM}/`) && f.endsWith('.json'))!;
    const d = decide({ changed: [json], files: REAL, read: realRead, weights: WEIGHTS });
    expect(d.e2e).toBe(false);
    const other = d.testFiles.filter((t) => /generators\/(fiveK|tenK|marathon)\//.test(t));
    expect(other.filter((t) => !t.endsWith('/isolation.node.test.ts'))).toEqual([]);
  });
});
