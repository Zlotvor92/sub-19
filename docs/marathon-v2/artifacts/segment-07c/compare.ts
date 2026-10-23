/* MAR-07c regresija (JSON redovi segment-07/measure.ts, pre = a869e21, posle = 07c). Menjati se sme SAMO tok sa umorom
   koji je pre bio odbijen pravilom TEST (dva testa: zaštićen test ≤ asOf + premešten); svaka druga promena
   (heš plana `h`, sadržaj `hw`, odbijanje) → „neobjašnjeno" (STANI). Iz korena:
   node docs/marathon-v2/artifacts/segment-07c/compare.ts <dir> <porodica>... (fajlovi <dir>/m-{pre,post}-<porodica>-*.jsonl) */
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
  let changed = 0;
  let fixed = 0;
  const odd: string[] = [];
  for (const [k, a] of A) {
    const b = B.get(k);
    if (!b) {
      odd.push(`${k}: nema posle`);
      continue;
    }
    if (a.h === b.h && a.hw === b.hw && a.rej === b.rej) continue;
    changed++;
    if (
      /fatigue/.test(k) &&
      String(a.rej ?? "").includes("najviše jedan test") &&
      !b.rej
    )
      fixed++;
    else odd.push(`${k}: ${a.rej ?? a.h} → ${b.rej ?? b.h}`);
  }
  const rej = (m: Map<string, Rec>) =>
    [...m.values()].filter((r) => r.rej).length;
  out[fam] = {
    flows: A.size,
    rejectedPre: rej(A),
    rejectedPost: rej(B),
    changed,
    fixed,
    unexplained: odd.length,
    odd: odd.slice(0, 10),
  };
}
console.log(JSON.stringify(out, null, 1));
