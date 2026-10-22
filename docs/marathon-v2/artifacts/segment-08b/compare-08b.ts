/* MAR-08b regresija (JSON redovi segment-08/measure.ts, pre = d73b83a, posle = MAR-08b). Promena toka (heš plana `h`,
   sadržaj `hw`, odbijanje) je dozvoljena SAMO kad je (a) tok pre bio odbijen, a sada je prihvaćen (K1 zaključan test,
   K3 lanac pre starta, K4 minimum nedelje), ili (b) se promenio `factKm` (pouka 37: dan poznat iz potpune
   pokrivenosti bez zapisa = 0). Sve drugo → „neobjašnjeno" (STANI). Promene CILJA se ispisuju. Iz korena:
   node docs/marathon-v2/artifacts/segment-08b/compare-08b.ts <dir> <porodica>... */
import { readdirSync, readFileSync } from "node:fs";

const [dir, ...fams] = process.argv.slice(2) as [string, ...string[]];
type Rec = Record<string, any>;
const load = (tag: string, fam: string): Map<string, Rec> => {
  const m = new Map<string, Rec>();
  for (const f of readdirSync(dir).filter(
    (x) => x.startsWith(`m-${tag}-${fam}-`) && x.endsWith(".jsonl"),
  ))
    for (const l of readFileSync(`${dir}/${f}`, "utf8").split("\n"))
      if (l) {
        const r = JSON.parse(l) as Rec;
        m.set(r.key, r);
      }
  return m;
};
const out: Record<string, unknown> = {};
for (const fam of fams) {
  const A = load("pre", fam);
  const B = load("post", fam);
  let changed = 0,
    fixed = 0,
    coverage = 0,
    tg = 0;
  const odd: string[] = [];
  const tgs: string[] = [];
  const rejPost: string[] = [];
  for (const [k, a] of A) {
    const b = B.get(k);
    if (!b) {
      odd.push(`${k}: nema posle`);
      continue;
    }
    if (b.rej) rejPost.push(`${k}: ${b.rej}`);
    if (a.h === b.h && a.hw === b.hw && a.rej === b.rej) continue;
    changed++;
    if (a.rej && !b.rej) fixed++;
    else if (!a.rej && !b.rej && a.fkh !== b.fkh) coverage++;
    else odd.push(`${k}: ${a.rej ?? a.h} → ${b.rej ?? b.h}`);
    if (!a.rej && !b.rej && a.tg !== b.tg) {
      tg++;
      const wa = String(a.tg).split(","),
        wb = String(b.tg).split(",");
      if (tgs.length < 10)
        tgs.push(
          `${k}: ${wa.flatMap((t, i) => (t !== wb[i] ? [`ned ${i + 1} ${t}→${wb[i]}`] : [])).join(", ")}`,
        );
    }
  }
  out[fam] = {
    flows: A.size,
    rejectedPre: [...A.values()].filter((r) => r.rej).length,
    rejectedPost: rejPost.length,
    changed,
    fixedRejected: fixed,
    coverageFactKm: coverage,
    targetChanged: tg,
    targetChanges: tgs,
    unexplained: odd.length,
    odd: odd.slice(0, 10),
    rejPost: rejPost.slice(0, 5),
  };
}
console.log(JSON.stringify(out, null, 1));
