import { writeFileSync } from 'node:fs';
import { distOf } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
import { runChain } from "/home/user/sub-19/docs/generators-v2/audit/chains/chains.ts";
const d = distOf('10K');
const out: Record<string, unknown> = {};
for (const i of [204, 529, 5771, 664, 218, 1885]) {
  const tr: any[] = []; const o: any = runChain(d, 20261023, i, { trace: tr });
  out[String(i)] = { id: o.id, input: tr[0].before.input, steps: tr.map((t) => ({ asOf: t.asOf, facts: t.facts, rejected: !!t.rejected })) };
  console.log(i, o.id, tr.length, tr.map((t) => t.rejected ? 'REJ' : 'ok').join(','), JSON.stringify(o.findings).slice(0, 200));
}
writeFileSync(process.argv[2]!, JSON.stringify({ seed: 20261023, note: 'Lanci ugla 3 (docs/generators-v2/audit/chains/chains.ts 10K 20261023), ulaz i činjenice po koraku; piše extract.ts (10K-07).', chains: out }, null, 1) + '\n');
