/* IZBOR TESTOVA PO DOMETU IZMENE ZA CI (docs/testing/TEST-SPEED.md § 13). Jedno mesto odluke: šta CI pokreće za skup
   fajlova promenjenih od POSLEDNJEG ZELENOG run-a grane. Test: `scripts/ciScope.node.test.ts`.

   Režimi:
   - `all` — isto što i pre (svi fajlovi punog nivoa, svi delovi). Uvek na `main`-u, ručno, bez zelenog run-a, i kad
     izmena dira bilo šta zajedničko ili nepoznato (`ALL_RULES`, domen van `generators/<D>/v2/`, nepoznat fajl u web/).
   - `select` — pun nivo samo test fajlova čiji DOMET sadrži promenjen fajl. Domet testa = zatvorenje grafa uvoza
     (statički, dinamički sa literalom, `vi.mock`, `?raw`, `@/`) + fajlovi koje modul u tom zatvorenju može da čita:
     modul koji koristi `import.meta.url`/`__dirname`/`import.meta.glob` dobija ceo svoj folder i svaku relativnu
     putanju napisanu u njemu (`'../../x.json'`, `` `./seg.${n}.json` `` → prefiks); modul sa `process.cwd()`,
     `child_process`, dinamičkim uvozom bez literala ili uvozom koji se ne razrešava → domet je SVE (test uvek trči).
     Ostali testovi ne mogu da promene ishod: nijedan njihov ulaz se nije promenio od zelenog run-a.
   - `none` — nijedan test fajl nema promenjen fajl u dometu.
   E2E trči kad se menja fajl iz grafa aplikacije (`src/main.tsx`), `public/`, `sw/`, `index.html`, `e2e/` ili
   `playwright.config.ts`; statičke provere (tipovi, lint, format, build) kad se menja bilo šta u `web/`.

   Putanje su relativne na koren repozitorijuma (`web/src/...`), a spiskovi test fajlova na izlazu relativne na `web/`. */

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DISTANCES = ['fiveK', 'tenK', 'halfMarathon', 'marathon'];

/* Projekat `v1` (TEST-SPEED.md § 11.2): poređenje zamrznutih v1 generatora sa referencama starog koda. Isti spisak
   koristi `vitest.config.ts`. Relativno na web/. */
export const V1_REFERENCE = [
  'src/domain/generators/*/equivalence*.node.test.ts',
  'src/domain/generators/otherDistances*.node.test.ts',
  'src/domain/generators/runtimeIsolation*.node.test.ts',
  'src/domain/generators/personalPlan.node.test.ts',
  'src/domain/generators/guidance.node.test.ts',
  'src/domain/training/generator/generator.differential.node.test.ts',
  'src/domain/training/generator/generator.fingerprint.node.test.ts'
];

/* Broj delova. `all`: fiksno (podela po trajanju, scripts/testSequencer.ts). `select`: koliko treba da deo nosi oko
   `TARGET_S` sekundi iz tabele trajanja (≈ 3,5 min na CI-ju; tabela je od 9. 11. iz CI run-a 765), najviše `MAX_*`. */
export const ALL_SHARDS = 8;
export const V1_ALL_SHARDS = 1;
export const E2E_SHARDS = 3;
export const MAX_SHARDS = 6;
export const TARGET_S = 600;
const UNKNOWN_S = 1;

/** Promena ovde → `all` (sa razlogom). */
export const ALL_RULES = [
  [/^\.github\//, 'CI (workflow, akcije)'],
  [/^docs\/qa\//, 'docs/qa (ulazi testova)'],
  [/^web\/src\/test\//, 'zajednička test infrastruktura (src/test)'],
  [/^web\/scripts\/(?!test-durations\.json$)/, 'web/scripts (sekvencer, sabotaže, ovaj izbor)'],
  [
    /^web\/(package\.json|package-lock\.json|vitest\.config\.ts|vite\.config\.ts|tsconfig[^/]*\.json)$/,
    'zavisnosti ili konfiguracija'
  ]
];
const V2_FOLDER = new RegExp(`^web/src/domain/generators/(${DISTANCES.join('|')})/v2/`);
/** Fajlovi u web/ van domena o kojima odlučuje graf; sve ostalo u web/ → `all`. */
const WEB_GRAPH =
  /^web\/(src|public|sw|e2e|deploy)\/|^web\/(index\.html|playwright\.config\.ts|eslint\.config\.js|eslint\.domain-rules\.(js|d\.ts)|\.prettierrc\.json|\.prettierignore|\.gitignore|scripts\/test-durations\.json)$/;
const E2E_DIRECT = /^web\/(public|sw|e2e)\/|^web\/(index\.html|playwright\.config\.ts)$/;
const APP_ENTRY = 'web/src/main.tsx';

/** null = odlučuje graf; inače razlog za `all`. */
export function allReason(path) {
  for (const [re, why] of ALL_RULES) if (re.test(path)) return `${path}: ${why}`;
  if (path.startsWith('web/src/domain/') && !V2_FOLDER.test(path))
    return `${path}: domen van generators/<D>/v2 (zajednički domen, v1, nepoznato)`;
  if (path.startsWith('web/') && !WEB_GRAPH.test(path)) return `${path}: nepoznat fajl u web/`;
  return null;
}

/* ---------- graf ---------- */

const MODULE = /\.(ts|tsx|js|mjs|mts|cjs)$/;
const EXT = ['', '.ts', '.tsx', '.js', '.mjs', '.mts', '/index.ts', '/index.tsx', '/index.js'];
const SPECIFIERS = [
  /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\(\s*(?:\/\*[^*]*\*\/\s*)?['"]([^'"]+)['"]\s*\)/g,
  /\bvi\.(?:mock|doMock|unmock|doUnmock|importActual|importMock)\(\s*['"]([^'"]+)['"]/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g
];
const DYNAMIC_NON_LITERAL = /\bimport\(\s*(?:\/\*[^*]*\*\/\s*)?[^'"\s/)]/;
const READS_OWN_FOLDER = /import\.meta\.(url|dirname|filename|glob)|__dirname|__filename/;
const READS_CWD = /process\.cwd\(/;
const RUNS_PROCESS = /['"](node:)?child_process['"]/;
/* `process.cwd()` je pod vitest-om `web/` (koren vitest-a), pa takav modul dobija ceo `web/`; izuzeci su pregledani
   ručno (test `ciScope.node.test.ts` traži da spisak modula sa `process.cwd()` bude tačno ovaj, da se nov pregleda). */
export const CWD_READS = {
  'web/src/test/legacyOracle.ts': ['web/src/test/legacy-recordings/'],
  'web/src/clientSource.node.test.ts': ['web/src/'],
  'web/src/pwa/frozen.node.test.ts': ['web/'],
  'web/src/pwa/install-images.node.test.ts': ['web/'],
  'web/src/pwa/static.node.test.ts': ['web/'],
  'web/src/pwa/uvod.node.test.ts': ['web/'],
  'web/deploy/cutover.node.test.ts': ['web/', 'vercel.json', '.vercelignore']
};
/* `child_process` → domet SVE, osim pregledanih: ovaj izbor pokreće `git` samo u CLI-ju (ne pri uvozu), a njegov test
   pokreće samo `git ls-files` i tvrdi samo o web/. */
export const PROCESS_READS = {
  'web/scripts/ciScope.mjs': ['web/'],
  'web/scripts/ciScope.node.test.ts': ['web/']
};
const REL_LITERAL = /['"`](\.\.?(?:\/[^'"`]*)?)['"`]/g;

/** Direktne zavisnosti jednog modula. `files`: skup svih fajlova repozitorijuma. */
export function moduleDeps(path, code, files) {
  const dir = posix.dirname(path);
  const imports = new Set();
  const exact = new Set();
  const prefixes = new Set();
  const why = [];
  const resolve = (spec) => {
    const s = spec.replace(/\?.*$/, '');
    let base;
    if (s.startsWith('@/')) base = `web/src/${s.slice(2)}`;
    else if (s.startsWith('.')) base = posix.normalize(posix.join(dir, s));
    else if (s.startsWith('/')) return undefined;
    else return null; // paket ili node: — van repozitorijuma (package-lock → `all`)
    for (const e of EXT) if (files.has(base + e)) return base + e;
    if (base.endsWith('.js') && files.has(base.replace(/\.js$/, '.ts')))
      return base.replace(/\.js$/, '.ts');
    return undefined;
  };
  for (const re of SPECIFIERS)
    for (const m of code.matchAll(re)) {
      const r = resolve(m[1]);
      if (typeof r === 'string') imports.add(r);
      // Nerazrešen uvoz (primer koda u niski, `vi.mock` nepostojeće putanje, obrisan fajl): domet je ta putanja sa bilo
      // kojim nastavkom — ako se fajl tu pojavi, test se bira. `/apsolutna` putanja: ne zna se → sve.
      else if (r === undefined && m[1].startsWith('/')) why.push(`apsolutan uvoz: ${m[1]}`);
      else if (r === undefined) prefixes.add(m[1].startsWith('@/') ? `web/src/${m[1].slice(2)}` : posix.normalize(posix.join(dir, m[1].replace(/\?.*$/, ''))));
    }
  if (RUNS_PROCESS.test(code)) {
    if (PROCESS_READS[path]) for (const p of PROCESS_READS[path]) prefixes.add(p);
    else why.push('child_process');
  }
  if (READS_CWD.test(code)) for (const p of CWD_READS[path] ?? ['web/']) prefixes.add(p);
  if (READS_OWN_FOLDER.test(code) || DYNAMIC_NON_LITERAL.test(code)) {
    prefixes.add(`${dir}/`);
    for (const m of code.matchAll(REL_LITERAL)) {
      const lit = m[1];
      const cut = lit.indexOf('${');
      const p = posix.normalize(posix.join(dir, cut < 0 ? lit : lit.slice(0, cut)));
      if (cut < 0 && files.has(p)) exact.add(p);
      else prefixes.add(p); // folder, početak imena (`${…}`) ili obrisan fajl
    }
  }
  return { imports, exact, prefixes, anything: why.length > 0, why };
}

/** Graf svih modula u web/. */
export function buildGraph(files, read) {
  const graph = new Map();
  for (const f of files) if (f.startsWith('web/') && MODULE.test(f)) graph.set(f, moduleDeps(f, read(f), files));
  return graph;
}

/** Domet modula: zatvorenje uvoza + ono što moduli u njemu čitaju. */
export function scopeOf(graph, entry, { importsOnly = false } = {}) {
  const seen = new Set([entry]);
  const stack = [entry];
  const exact = new Set([entry]);
  const prefixes = new Set();
  const why = [];
  while (stack.length) {
    const m = graph.get(stack.pop());
    if (!m) continue;
    for (const i of m.imports) {
      exact.add(i);
      if (!seen.has(i)) seen.add(i) && stack.push(i);
    }
    if (importsOnly) continue;
    for (const e of m.exact) exact.add(e);
    for (const p of m.prefixes) prefixes.add(p);
    why.push(...m.why);
  }
  return { exact, prefixes, anything: why.length > 0, why };
}

const hits = (scope, path) =>
  scope.anything || scope.exact.has(path) || [...scope.prefixes].some((p) => path.startsWith(p));

/* ---------- test fajlovi ---------- */

const glob = (g) =>
  new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*/g, '[^/]*')}$`);
const V1_RE = V1_REFERENCE.map(glob);
export const isV1 = (webPath) => V1_RE.some((re) => re.test(webPath));

/** Test fajl punog nivoa (unija projekata iz vitest.config.ts), putanja relativna na web/. */
export function isTestFile(webPath) {
  if (webPath.includes('node_modules/') || webPath.endsWith('.harness.node.test.ts')) return false;
  if (/^src\/domain\/.*\.test\.tsx$/.test(webPath)) return false; // domain: samo .ts; ui isključuje src/domain
  return /^src\/.*\.test\.tsx?$/.test(webPath) || /^(scripts|deploy)\/.*\.node\.test\.ts$/.test(webPath);
}

const shardsFor = (files, weights, max) => {
  const total = files.reduce((s, f) => s + (weights[f] ?? UNKNOWN_S), 0);
  const n = Math.max(1, Math.min(max, files.length, Math.ceil(total / TARGET_S)));
  return Array.from({ length: n }, (_, i) => i + 1);
};
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

/** ODLUKA. `changed`: promenjeni fajlovi (koren repozitorijuma); `force`: razlog za `all` (main, ručno, bez zelenog). */
export function decide({ changed, files, read, weights = {}, force = null }) {
  const reasons = force ? [force] : changed.map(allReason).filter(Boolean);
  if (reasons.length)
    return {
      mode: 'all',
      reasons,
      static: true,
      e2e: true,
      e2eShards: range(E2E_SHARDS),
      tests: 'all',
      testShards: range(ALL_SHARDS),
      testFiles: [],
      v1: 'all',
      v1Shards: range(V1_ALL_SHARDS),
      v1Files: []
    };
  const graph = buildGraph(files, read);
  const tests = [...files]
    .filter((f) => f.startsWith('web/') && isTestFile(f.slice(4)))
    .sort();
  const selected = tests.filter((t) => {
    const s = scopeOf(graph, t);
    return changed.some((c) => hits(s, c));
  });
  const app = scopeOf(graph, APP_ENTRY, { importsOnly: true });
  const e2e = changed.some((c) => E2E_DIRECT.test(c) || app.exact.has(c));
  /* v1 (organizator, 9. 11.: v1 se briše u V1b, posao ostaje kao danas): projekat `v1` trči samo u režimu `all` (jedan
     posao, `npm run test:v1`); izmena koja nije „sve" ga ne pokreće, kao raniji `v1-changes` (v2 i van domena → ne). */
  const web = selected.map((t) => t.slice(4));
  const testFiles = web.filter((t) => !isV1(t));
  const v1Files = [];
  return {
    mode: selected.length ? 'select' : 'none',
    reasons: [],
    static: changed.some((c) => c.startsWith('web/')),
    e2e,
    e2eShards: e2e ? range(E2E_SHARDS) : [],
    tests: testFiles.length ? 'select' : 'none',
    testShards: testFiles.length ? shardsFor(testFiles, weights, MAX_SHARDS) : [],
    testFiles,
    v1: 'none',
    v1Shards: [],
    v1Files
  };
}

/* ---------- CLI (CI) ----------
   node scripts/ciScope.mjs --base <sha>     izbor prema poslednjem zelenom commitu
   node scripts/ciScope.mjs --all "<razlog>" sve (main, ručno, bez zelenog run-a)
   Upisuje izlaze u $GITHUB_OUTPUT i sažetak u $GITHUB_STEP_SUMMARY (ili na stdout). */
function main(argv) {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
  const root = git('rev-parse', '--show-toplevel').trim();
  const files = new Set(git('-C', root, 'ls-files').split('\n').filter(Boolean));
  const read = (f) => readFileSync(`${root}/${f}`, 'utf8');
  const at = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
  const base = at('--base');
  const force = at('--all') ?? (base ? null : 'nema polaznog commita');
  const changed = base
    ? git('-C', root, 'diff', '--no-renames', '--name-only', base, 'HEAD').split('\n').filter(Boolean)
    : [];
  const weights = JSON.parse(read('web/scripts/test-durations.json'));
  const d = decide({ changed, files, read, weights, force });
  // Prazna matrica je greška u GitHub Actions čak i kad je posao preskočen uslovom → `[1]` (posao se ipak preskače).
  const matrix = (xs) => JSON.stringify(xs.length ? xs : [1]);
  const out = {
    mode: d.mode,
    static: String(d.static),
    e2e: String(d.e2e),
    e2e_shards: matrix(d.e2eShards),
    tests: d.tests,
    test_shards: matrix(d.testShards),
    test_files: d.testFiles.join(' '),
    v1: d.v1,
    v1_shards: matrix(d.v1Shards),
    v1_files: d.v1Files.join(' ')
  };
  const lines = Object.entries(out).map(([k, v]) => `${k}=${v}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  const summary = [
    `## Izbor testova: ${d.mode}`,
    base ? `Polazni (poslednji zeleni) commit: \`${base}\`, promenjeno fajlova: ${changed.length}` : `Razlog: ${force}`,
    ...d.reasons.slice(0, 20).map((r) => `- sve: ${r}`),
    `- statičke provere: ${d.static}; E2E: ${d.e2e} (${d.e2eShards.length} dela)`,
    `- web testovi: ${d.tests} — ${d.tests === 'all' ? 'svi' : d.testFiles.length} fajlova, ${d.testShards.length} delova`,
    `- v1 testovi: ${d.v1} — ${d.v1 === 'all' ? 'svi' : d.v1Files.length} fajlova, ${d.v1Shards.length} delova`,
    ...(changed.length ? ['', '<details><summary>Promenjeni fajlovi</summary>', '', ...changed.map((c) => `- ${c}`), '</details>'] : []),
    ...(d.testFiles.length || d.v1Files.length
      ? ['', '<details><summary>Izabrani test fajlovi</summary>', '', ...[...d.testFiles, ...d.v1Files].map((t) => `- ${t}`), '</details>']
      : [])
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  console.log(summary);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
