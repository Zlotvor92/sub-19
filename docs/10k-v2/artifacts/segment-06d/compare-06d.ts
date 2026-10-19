/* Segment 06d: poređenje dva izlaza measure-06d.ts (pre / posle) tok po tok. Pokretanje:
     node compare-06d.ts <pre.json> <posle.json> <izlaz.json>
   Tok PRIHVAĆEN pre mora imati isti heš posle (bez oznake verzije); menjaju se samo ranije odbijeni. */

import { readFileSync, writeFileSync } from 'node:fs';

const [a, b, o] = process.argv.slice(2);
const pre = JSON.parse(readFileSync(a!, 'utf8'));
const post = JSON.parse(readFileSync(b!, 'utf8'));
const keys = Object.keys(pre.hashes);
const changedAccepted: string[] = [];
const fixed: Record<string, number> = {};
const stillRejected: string[] = [];
const newlyRejected: string[] = [];
for (const k of keys) {
  const x = pre.hashes[k];
  const y = post.hashes[k];
  const xOk = typeof x === 'number';
  const yOk = typeof y === 'number';
  if (xOk && !yOk) newlyRejected.push(`${k}: ${y}`);
  else if (xOk && x !== y) changedAccepted.push(k);
  else if (!xOk && yOk) fixed[x] = (fixed[x] ?? 0) + 1;
  else if (!xOk && !yOk) stillRejected.push(`${k}: ${x} → ${y}`);
}
const out = {
  tokova: keys.length,
  sameKeys: keys.length === Object.keys(post.hashes).length,
  prihvacenoPre: keys.filter((k) => typeof pre.hashes[k] === 'number').length,
  prihvacenPromenjen: changedAccepted.length,
  noviOdbijeni: newlyRejected.length,
  ispravljeno: fixed,
  idaljeOdbijeno: stillRejected.length,
  primeri: {
    prihvacenPromenjen: changedAccepted.slice(0, 20),
    noviOdbijeni: newlyRejected.slice(0, 20),
    idaljeOdbijeno: stillRejected.slice(0, 20)
  }
};
writeFileSync(o!, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
