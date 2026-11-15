/* P7a — sirovi planovi jedne verzije generatora.
   Pokretanje: node dump.ts <koren stabla> <inputs.json> <izlazni folder> [distanca ...] */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [root, inputsPath, outDir, ...only] = process.argv.slice(2);
const lib = (await import(`${root}/docs/generators-v2/final-check/lib.ts`)) as { distOf: (n: string) => { generate: (i: unknown) => unknown } };
const inputs = JSON.parse(readFileSync(inputsPath!, "utf8")) as Record<string, { title: string; input: unknown }[]>;
mkdirSync(outDir!, { recursive: true });
const sum: string[] = [];
for (const D of Object.keys(inputs)) {
  if (only.length && !only.includes(D)) continue;
  inputs[D]!.forEach((p, i) => {
    const res = lib.distOf(D).generate(p.input) as { ok: boolean };
    writeFileSync(`${outDir}/${D}-${String(i + 1).padStart(2, "0")}.json`, JSON.stringify(res));
    sum.push(`${D} ${i + 1} ${res.ok ? "ok" : "ODBIJENO " + JSON.stringify((res as unknown as { reasons: { code: string }[] }).reasons.map((r) => r.code))}`);
  });
}
console.log(sum.join("\n"));
