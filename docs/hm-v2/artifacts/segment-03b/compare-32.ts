/* HM v2 Segment 03b — regresija pouke 32: menjaju se SAMO planovi koji su na 5e09a02 imali bar jednu nedelju sa
   kvalitetnim danom (ili danom testa) dužim od dugog. Ulaz: dva izlaza measure-32.ts (pre: koren 5e09a02, posle:
   ovo stablo). Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-03b/compare-32.ts <pre.json> <posle.json> [fikstura.json]
   Fikstura (opciono) = spisak planova mreža 02, r, 03 sa takvom nedeljom pre (osnova regresionih testova). */

import { readFileSync, writeFileSync } from "node:fs";

const [a, b, fix] = process.argv.slice(2);
if (!a || !b)
  throw new Error(
    "upotreba: compare-32.ts <pre.json> <posle.json> [fikstura.json]",
  );
type M = {
  plans: Record<string, string>;
  hashes: Record<string, string>;
  count: Record<string, number>;
};
const pre = JSON.parse(readFileSync(a, "utf8")) as M;
const post = JSON.parse(readFileSync(b, "utf8")) as M;
const grid = (id: string): string =>
  id.startsWith("r-")
    ? "r"
    : id.startsWith("f-")
      ? "feel"
      : id.startsWith("b-")
        ? "beginner"
        : id.includes("-d10w-")
          ? "dense"
          : "02";
const out: Record<
  string,
  {
    inputs: number;
    overBefore: number;
    changed: number;
    changedNotOver: string[];
    overUnchanged: number;
    rejectedAfter: number;
  }
> = {};
for (const [id, h] of Object.entries(pre.hashes)) {
  const g = grid(id);
  const o = (out[g] ??= {
    inputs: 0,
    overBefore: 0,
    changed: 0,
    changedNotOver: [],
    overUnchanged: 0,
    rejectedAfter: 0,
  });
  o.inputs++;
  const over = id in pre.plans;
  if (over) o.overBefore++;
  const h2 = post.hashes[id];
  if (h2?.startsWith("odbijen") && !h.startsWith("odbijen")) o.rejectedAfter++;
  if (h2 !== h) {
    o.changed++;
    if (!over) o.changedNotOver.push(id);
  } else if (over) o.overUnchanged++;
}
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(out).map(([k, v]) => [
        k,
        {
          ...v,
          changedNotOver: [
            v.changedNotOver.length,
            ...v.changedNotOver.slice(0, 5),
          ],
        },
      ]),
    ),
    null,
    1,
  ),
);
if (fix) {
  const ids = Object.keys(pre.plans)
    .filter((id) => grid(id) !== "dense")
    .sort();
  writeFileSync(fix, `${JSON.stringify(ids, null, 0)}\n`);
  console.log(`fikstura: ${ids.length} planova`);
}
