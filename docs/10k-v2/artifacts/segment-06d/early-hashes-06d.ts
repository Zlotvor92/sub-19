/* Segment 06d: heševi mreže E na 51a924f iz merenja S (measure-06d.ts nad 51a924f; ključevi S/<plan>/<asOf>/<scen>)
   i spisak porodice 1 (prihvaćeni na 51a924f, promenjeni posle; objašnjenje family1-06d.ts). Pokretanje iz web/:
     node ../docs/10k-v2/artifacts/segment-06d/early-hashes-06d.ts <pre.json> <posle.json> <nb.json> → segment06d.early-hashes-51a924f.json */

import { readFileSync, writeFileSync } from 'node:fs';

const V = new URL('../../../../web/src/domain/generators/tenK/v2/', import.meta.url).href;
const T = await import(V + 'testInputs.ts');
const { generateTenKV2 } = await import(V + 'generate.ts');
const [preF, postF] = process.argv.slice(2);
const pre = JSON.parse(readFileSync(preF!, 'utf8')).hashes;
const post = JSON.parse(readFileSync(postF!, 'utf8')).hashes;
const flows = T.earlyFlows((b: any) => generateTenKV2(b.input).plan);
const missing = flows.filter((f: any) => !(`S/${f.key}` in pre)).map((f: any) => f.key);
if (missing.length) throw new Error(`nema u merenju: ${missing.slice(0, 5).join(', ')}`);
const hashes = flows.map((f: any) =>
  typeof pre[`S/${f.key}`] === 'number' ? pre[`S/${f.key}`] : 0
);
// Promenjeni prihvaćeni tokovi: porodica 1 (prošlost = upisani dani) ili A5 u uvodu početnika (N-b, umor ned 1;
// razvrstano dokazom family1-06d.ts — tokovi bez razlike upisanog i sastavljenog dana, <nb.json>).
const nb = new Set<string>(JSON.parse(readFileSync(process.argv[4]!, 'utf8')));
const changed = flows
  .filter(
    (f: any) => typeof pre[`S/${f.key}`] === 'number' && pre[`S/${f.key}`] !== post[`S/${f.key}`]
  )
  .map((f: any) => f.key);
const family1 = changed.filter((k: string) => !nb.has(`S/${k}`));
const introA5 = changed.filter((k: string) => nb.has(`S/${k}`));
writeFileSync(
  new URL('segment06d.early-hashes-51a924f.json', V),
  JSON.stringify({
    against: '51a924f',
    flows: flows.length,
    rejected: hashes.filter((h: number) => h === 0).length,
    family1,
    introA5,
    hashes
  }) + '\n'
);
console.log(
  flows.length,
  'tokova; odbijeno na 51a924f',
  hashes.filter((h: number) => h === 0).length,
  '; porodica 1',
  family1.length,
  '; A5 uvod',
  introA5.length
);
