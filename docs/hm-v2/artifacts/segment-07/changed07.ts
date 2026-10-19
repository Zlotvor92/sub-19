/* HM-07 — fixture izuzetaka regresije generatora (segment07.changed-f4b257d.json): planovi mreža 02/03 (R/F/B) i mreže
   pouke 28 (`r-` + id) čiji se rezultat menja prema f4b257d, sa klasom (prvo što važi): a = pouka 35 (plan pre ima
   nedelju izgradnje sa 2 kvaliteta i danom dužim od dugog, ili posle napomenu pouke 35), b = RP < 4000 m (N6),
   d = samo napomene/upozorenja (N9 LONG_RUN_SHORT, N10.1, N11). Druga promena → greška (STANI).
   node changed07.ts <pre-gen> <posle-gen> <pre-recent> <posle-recent> > segment07.changed-f4b257d.json */
import { readFileSync } from "node:fs";
type R =
  | { c: string; m: string; a: string; b: number; p35?: number }
  | { rej: string };
const load = (f: string) =>
  JSON.parse(readFileSync(f, "utf8")) as Record<string, R>;
const [ga, gb, ra, rb] = process.argv.slice(2).map(load) as [
  Record<string, R>,
  Record<string, R>,
  Record<string, R>,
  Record<string, R>,
];
const out: Record<string, string> = {};
const build = (a: string) =>
  a.split("+").some((x) => ["base", "development", "specific"].includes(x));
for (const [A, B, pre] of [
  [ga, gb, ""],
  [ra, rb, "r-"],
] as const)
  for (const [k, a] of Object.entries(A)) {
    const b = B[k]!;
    if ("rej" in a || "rej" in b) {
      if (JSON.stringify(a) !== JSON.stringify(b))
        throw new Error(`odbijanje se menja: ${k}`);
      continue;
    }
    if (a.c !== b.c) {
      const cls = build(a.a) || (b.p35 ?? 0) > 0 ? "a" : a.b > 0 ? "b" : null;
      if (!cls) throw new Error(`promena van klase: ${k}`);
      out[pre + k] = cls;
    } else if (a.m !== b.m) out[pre + k] = "d";
  }
console.log(JSON.stringify(out, null, 0).replace(/,"/g, ',\n"'));
