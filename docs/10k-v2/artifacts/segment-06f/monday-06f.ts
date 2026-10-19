/* Segment 06f: PRVA adaptacija umora sa asOf = ponedeljak (zapisi asOf − 1, − 3 su u prethodnoj nedelji) — klasa koju
   pouka 36 menja i bez ponavljanja: kad je nedelja asOf (sidro zapisa) već rasterećenje, novo se ne pravi. Isti uzorak
   kao measure-06f.ts. Pokretanje iz web/: node ../docs/10k-v2/artifacts/segment-06f/monday-06f.ts [<koren>] */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(process.argv[2] ?? fileURLToPath(new URL("../../../../", import.meta.url)));
const V = `${ROOT}/web/src/domain/generators/tenK/v2/`;
const T = await import(`${V}testInputs.ts`);
const { generateTenKV2 } = await import(`${V}generate.ts`);
const { adaptTenKV2 } = await import(`${V}adapt.ts`);
const key = (i: unknown) => JSON.stringify(i);
const every = <X>(xs: readonly X[], k: number, off = 0): X[] => xs.filter((_, i) => i % k === off);
const perm = new Set([...T.earlyGridBases(), ...T.adaptBases()].map((b: any) => key(b.input)));
const fam: Record<string, any[]> = {
  R: ([3, 4, 5, 6] as const).flatMap((d) => T.grid02Inputs(d)),
  F: ([3, 4, 5, 6] as const).flatMap((d) => T.feelGridInputs(d)),
  B: ([3, 4] as const).flatMap((d) => T.beginnerGridInputs(d)),
};
const K: Record<string, number> = { R: 193, F: 97, B: 29 };
const out: Record<string, string> = {};
for (const [f, xs] of Object.entries(fam))
  for (const b of every(xs, K[f]!, Math.floor(K[f]! / 2)).filter((x) => !perm.has(key(x.input)))) {
    const g = generateTenKV2(b.input);
    if (!g.ok) continue;
    const p = g.plan;
    for (const w of p.weeks.slice(1, -2)) {
      const r = adaptTenKV2(p, T.factsOf(p, "fatigue", w.startDate), w.startDate);
      out[`${b.id}/${w.startDate}`] = r.ok ? r.plan.weeks.filter((x: any) => x.deload).map((x: any) => x.index).join(",") : "ODBIJENO";
    }
  }
console.log(JSON.stringify(out));
