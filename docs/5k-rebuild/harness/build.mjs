// Spaja harnes i produkcioni TypeScript u jedan ESM fajl (rolldown iz web/node_modules) i pokreće ga.
// Upotreba (iz korena repozitorijuma):  TZ=UTC node docs/5k-rebuild/harness/build.mjs [izlazni_dir]
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const require = createRequire(join(repo, 'web/package.json'));
const { build } = await import(require.resolve('rolldown'));

const out = resolve(process.argv[2] ?? join(repo, 'docs/5k-rebuild/reference'));
const tmp = mkdtempSync(join(process.env.HARNESS_TMP ?? tmpdir(), '5k-harness-'));
const bundle = join(tmp, 'run.mjs');
await build({
  input: join(here, 'run.ts'),
  platform: 'node',
  logLevel: 'warn',
  output: { file: bundle, format: 'esm' }
});
const env = { ...process.env, QA_INPUTS: join(repo, 'docs/qa/generator-final/inputs.json') };
const r = spawnSync(process.execPath, [bundle, out], { stdio: 'inherit', env });
process.exit(r.status ?? 1);
