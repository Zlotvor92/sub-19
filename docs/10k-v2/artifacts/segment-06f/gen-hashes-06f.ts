/* Segment 06f (pouka 35): generator — heš svakog plana (planHash81, bez oznake verzije) i nedelje sa 2 dana kvaliteta
   dužim od dugog (izgradnja). Mreže 01, 02 (3–6 d), F (3–6 d), B (3–4 d), bez duplikata ulaza.
   Iz web/: node ../docs/10k-v2/artifacts/segment-06f/gen-hashes-06f.ts <izlaz.json> [<koren>] */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [outArg, rootArg] = process.argv.slice(2);
const ROOT = resolve(rootArg ?? fileURLToPath(new URL("../../../../", import.meta.url)));
const V = `${ROOT}/web/src/domain/generators/tenK/v2/`;
const T = await import(`${V}testInputs.ts`);
const { generateTenKV2 } = await import(`${V}generate.ts`);
const all = [
  ...T.gridInputs(),
  ...([3, 4, 5, 6] as const).flatMap((d) => T.grid02Inputs(d)),
  ...([3, 4, 5, 6] as const).flatMap((d) => T.feelGridInputs(d)),
  ...([3, 4] as const).flatMap((d) => T.beginnerGridInputs(d)),
];
const B = new Set(["base", "development", "specific"]);
const seen = new Set<string>();
const out: Record<string, { h: number; p35: number[]; weeks: string[] } | null> = {};
for (const c of all) {
  const k = JSON.stringify(c.input);
  if (seen.has(k) && !process.env["ALL_IDS"]) continue;
  seen.add(k);
  const g = generateTenKV2(c.input);
  if (!g.ok) {
    out[c.id] = null;
    continue;
  }
  const p35: number[] = [];
  for (const w of g.plan.weeks) {
    const q = w.days.filter((d: any) => d.workout.kind === "quality");
    const l = w.days.find((d: any) => d.role === "long");
    if (B.has(w.phase) && q.length >= 2 && l && q.some((d: any) => d.workout.sec > l.workout.sec)) p35.push(w.index);
  }
  out[c.id] = {
    h: T.planHash81(g),
    p35,
    weeks: g.plan.weeks.map((w: any) => T.fnv1a(JSON.stringify(w)).toString(36)),
  };
}
writeFileSync(outArg!, JSON.stringify(out));
console.log(Object.keys(out).length, Object.values(out).filter((x) => x === null).length);
