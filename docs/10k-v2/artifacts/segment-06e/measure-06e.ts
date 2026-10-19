/* Segment 06e (10k-v2.5.2, pouka 34): adaptacija sa asOf PRE STARTA plana (start − 1, − 3, − 6), tok po tok.
   Pokretanje iz web/:
     node ../docs/10k-v2/artifacts/segment-06e/measure-06e.ts <izlaz.json> [<koren checkouta>]
   Planovi: gridInputs + feelGridInputs(3..6) + beginnerGridInputs(3..4), svaki 37. (MEASURE_EVERY=n gušće).
   Scenariji (testInputs.factsOf): fatigue, pain5, pain8, pause10 (breaks 10 dana do asOf), faster, slower, test5k,
   none, locked. Po toku: prihvaćen → heš bez oznake verzije (planHash06c); odbijen → klasa (pravila grešaka) +
   primer. Izlaz: zbir po scenariju/klasi, primeri, heševi (regresija: compare-06d.ts). 4 procesa. */

import { fork } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHARDS = 4;
const EVERY = Number(process.env["MEASURE_EVERY"] ?? 37);
const [outArg, rootArg, shardArg] = process.argv.slice(2);
const ROOT = resolve(
  rootArg ?? fileURLToPath(new URL("../../../../", import.meta.url)),
);
const V = `${ROOT}/web/src/domain/generators/tenK/v2/`;
const SCEN = [
  "fatigue",
  "pain5",
  "pain8",
  "pause10",
  "faster",
  "slower",
  "test5k",
  "none",
  "locked",
];
const BACK = [1, 3, 6];

type Flow = {
  key: string;
  scen: string;
  ok: boolean;
  hash?: number;
  cls?: string;
  ex?: string;
};

async function runShard(shard: number): Promise<Flow[]> {
  const { generateTenKV2 } = await import(V + "generate.ts");
  const { adaptTenKV2 } = await import(V + "adapt.ts");
  const { addDays } = await import(V + "dates.ts");
  const T = await import(V + "testInputs.ts");
  const facts = (p: any, s: string, a: string): unknown =>
    s === "pause10"
      ? { breaks: [{ kind: "break", from: addDays(a, -9), to: a }] }
      : T.factsOf(p, s, a);
  const every = <X>(xs: X[], n: number): X[] =>
    xs.filter((_, i) => i % n === 0);
  const plans = [
    ...every(T.gridInputs(), EVERY),
    ...every(
      ([3, 4, 5, 6] as const).flatMap((d) => T.feelGridInputs(d)),
      EVERY,
    ),
    ...every(
      ([3, 4] as const).flatMap((d) => T.beginnerGridInputs(d)),
      EVERY,
    ),
  ] as { id: string; input: unknown }[];
  const out: Flow[] = [];
  plans.forEach((c, i) => {
    if (i % SHARDS !== shard) return;
    const g = generateTenKV2(c.input);
    if (!g.ok) throw new Error(`generate ${c.id}`);
    const p0 = g.plan;
    for (const b of BACK) {
      const a = addDays(p0.input.startDate, -b);
      for (const s of SCEN) {
        const key = `${c.id}/start-${b}/${s}`;
        const r = adaptTenKV2(p0, facts(p0, s, a), a);
        if (r.ok) {
          out.push({ key, scen: s, ok: true, hash: T.planHash06c(r) });
          continue;
        }
        const errs: { rule: string; message: string; week?: number }[] = r
          .violations?.length
          ? r.violations.filter((v: any) => v.severity === "error")
          : r.reasons.map((x: any) => ({
              rule: x.code,
              message: x.message,
              week: x.week,
            }));
        out.push({
          key,
          scen: s,
          ok: false,
          cls: [...new Set(errs.map((e) => e.rule))].sort().join("+"),
          ex: errs
            .map((e) => `ned ${e.week ?? "—"} ${e.rule}: ${e.message}`)
            .join(" | "),
        });
      }
    }
  });
  return out;
}

if (shardArg !== undefined) {
  const flows = await runShard(Number(shardArg));
  process.send!(flows, () => process.exit(0));
} else {
  const t0 = Date.now();
  const self = fileURLToPath(import.meta.url);
  const parts = await Promise.all(
    Array.from(
      { length: SHARDS },
      (_, i) =>
        new Promise<Flow[]>((res, rej) => {
          const ch = fork(self, [outArg ?? "-", ROOT, String(i)], {
            serialization: "advanced",
          });
          ch.on("message", (m) => res(m as Flow[]));
          ch.on(
            "exit",
            (code) => code !== 0 && rej(new Error(`deo ${i}: izlaz ${code}`)),
          );
        }),
    ),
  );
  const flows = parts.flat().sort((a, b) => (a.key < b.key ? -1 : 1));
  const stat: Record<string, Record<string, number>> = {};
  const examples: Record<string, string[]> = {};
  for (const f of flows) {
    for (const k of [f.scen, "UKUPNO"]) {
      const g = (stat[k] ??= { tokova: 0, odbijeno: 0 });
      g.tokova!++;
      if (f.ok) continue;
      g.odbijeno!++;
      g[f.cls!] = (g[f.cls!] ?? 0) + 1;
    }
    if (f.ok) continue;
    const e = (examples[`${f.scen}/${f.cls}`] ??= []);
    if (e.length < 4) e.push(`${f.key}: ${f.ex}`);
  }
  const hashes = Object.fromEntries(
    flows.map((f) => [f.key, f.ok ? f.hash : `X:${f.cls}`]),
  );
  const sec = Math.round((Date.now() - t0) / 1000);
  writeFileSync(
    resolve(outArg!),
    JSON.stringify({ root: ROOT, every: EVERY, sec, stat, examples, hashes }) +
      "\n",
  );
  console.log(JSON.stringify({ sec, stat, examples }, null, 1));
}
