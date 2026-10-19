/* HM-07 — poređenje regress.ts pre/posle po klasi. Klasa promene sadržaja (prvo što važi, na planu PRE): a = nedelja
   izgradnje sa 2 dana kvaliteta i danom kvaliteta dužim od dugog (pouka 35; "aT" taper), b = RP < 4000 m (N6), c = umor
   pre starta (pouka 34 dopuna), x = ostalo (STANI). Klasa a i kad plan POSLE ima nedelju pouke 35 (npr. test
   koji sa jednim kvalitetom staje, a sa dva bi ispao — A9). Promena samo napomena/upozorenja: d.
   g = tok iz plana generatora koji je promenjen (klasa plana generatora; treći argument: pre/posle gen).
   node compare.ts <pre.json> <posle.json> [<pre-gen.json> <posle-gen.json>] */
import { readFileSync } from "node:fs";
const [fa, fb] = process.argv.slice(2) as [string, string];
type R =
  | { c: string; m: string; a: string; b: number; w: string; p35?: number }
  | { rej: string };
const A: Record<string, R> = JSON.parse(readFileSync(fa, "utf8"));
const B: Record<string, R> = JSON.parse(readFileSync(fb, "utf8"));
const [ga, gb] = process.argv
  .slice(4)
  .map((f) => JSON.parse(readFileSync(f, "utf8"))) as [
  Record<string, { c: string }>?,
  Record<string, { c: string }>?,
];
const genChanged = (k: string) =>
  !!ga && !!gb && ga[k.split("/")[0]!]?.c !== gb[k.split("/")[0]!]?.c;
const n: Record<string, number> = {};
const ex: Record<string, string[]> = {};
const add = (k: string, e: string) => {
  n[k] = (n[k] ?? 0) + 1;
  (ex[k] ??= []).length < 4 && ex[k]!.push(e);
};
const build = (a: string) =>
  a.split("+").some((x) => ["base", "development", "specific"].includes(x));
// Tok iz plana generatora: pre/posle istog generatora (prefiks ključa) — promenjen plan generatora prenosi klasu.
for (const [k, a] of Object.entries(A)) {
  const b = B[k];
  if (!b) {
    add("missing", k);
    continue;
  }
  if ("rej" in a || "rej" in b) {
    if ("rej" in b && !("rej" in a)) add("NEW_REJECT", `${k}: ${b.rej}`);
    else if ("rej" in a && !("rej" in b)) add("unrejected", k);
    continue;
  }
  add("total", k);
  if (a.c !== b.c) {
    const cls = genChanged(k)
      ? "g"
      : build(a.a) || (b.p35 ?? 0) > 0
        ? "a"
        : /\/pre\d\/(fatigue|chain)/.test(k)
          ? "c"
          : a.b > 0
            ? "b"
            : a.a.includes("taper")
              ? "aT"
              : "x";
    add(`content:${cls}`, k);
  } else if (a.m !== b.m)
    add(`meta:${a.w === b.w ? "text" : "rules"}`, `${k}: ${a.w} → ${b.w}`);
  if (build(b.a)) add("after:a", k);
  if (b.a.includes("taper")) add("after:aT", k);
  if (b.b > 0) add("after:b", k);
}
console.log(JSON.stringify({ n, ex }, null, 1));
