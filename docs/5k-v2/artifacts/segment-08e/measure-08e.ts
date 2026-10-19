/* Segment 08e (5k-v2.7.0): merenje P1 (redovno rasterećenje odmah posle nedelje smanjenja) i P2 (adaptacija
   koju konstruktor sastavi, a validator odbije). Pokretanje iz korena repoa:
     node docs/5k-v2/artifacts/segment-08e/measure-08e.ts [<koren> [<izlaz.json> [<fixture.json> [<pre.json>]]]]
   Bez korena meri ovo stablo. Za „pre": git worktree add --detach /tmp/wt-51a 51a924f
     ln -s "$PWD/web/node_modules" /tmp/wt-51a/web/node_modules
     node docs/5k-v2/artifacts/segment-08e/measure-08e.ts /tmp/wt-51a docs/5k-v2/artifacts/segment-08e/before-51a924f.json
   Kod koji se meri (generateFiveKV2, adaptFiveKV2, raceTimeForVdot, policy) je iz checkouta; definicije tokova
   (ulazi, činjenice, asOf) i ocena toka (reliefCheck — nezavisna od steps.ts) su iz OVOG stabla
   (fiveK/v2/testInputs.ts: reliefBases, reliefCases, reliefCheck, canonResult08e).
   - narrow: pretraga organizatora — adaptNetwork 60 × asOf {kraj ned w, kraj − 3}, w = 1 … N − 2 × RELIEF_NARROW;
   - wide: adaptNetwork 60 + rw-16w-pocetnik-e420 posle prelaza × asOf {sreda, kraj ned w} × RELIEF_WIDE.
   Granica niza (Odluka 9) = najduži niz izgradnje bez rasterećenja koji generator sam pravi u osnovnom rasporedu
   (periodize, planovi 8–16 ned) + 1: ostali 5 + 1 = 6, početnik 3 + 1 = 4.
   Izlaz: zbir po pretrazi i scenariju (tokova, odbijeno po pravilu, P1, zadržano zbog granice, nedelja testa),
   primeri i heš svakog toka (sha256 canonResult08e — bez oznake verzije i polja reduced, prvih 16 hex).
   Heševi idu samo u <fixture.json> (regresioni test segment08e.node.test.ts; fixture 08e: koren = checkout 51a924f →
   web/src/domain/generators/fiveK/v2/segment08e.adapt-hashes-51a924f.json; posle toga prettier --write). Uz <pre.json>
   (izlaz pokretanja na 51a924f) i fixture 51a924f dodaje regresiju: po scenariju promenjeno / sa rečenicom Odluke 9
   / ranije odbijeno / ostalo (mora biti 0) i promene nedelje kontrolnog trčanja. Pokretanja (posle):
     node docs/5k-v2/artifacts/segment-08e/measure-08e.ts . docs/5k-v2/artifacts/segment-08e/after.json \
       /tmp/after-hashes.json docs/5k-v2/artifacts/segment-08e/before-51a924f.json */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const outFile =
  process.argv[3] ?? "docs/5k-v2/artifacts/segment-08e/after.json";
const v2 = join(root, "web/src/domain/generators/fiveK/v2");
const { generateFiveKV2 } = (await import(join(v2, "generate.ts"))) as {
  generateFiveKV2: (input: unknown) => unknown;
};
const { adaptFiveKV2 } = (await import(join(v2, "adapt.ts"))) as {
  adaptFiveKV2: (plan: unknown, facts: unknown, asOf: string) => unknown;
};
const { raceTimeForVdot } = (await import(join(v2, "paces.ts"))) as {
  raceTimeForVdot: (vdot: number, distM: number) => number;
};
const P = (
  (await import(join(v2, "policy.ts"))) as {
    FIVE_K_V2_POLICY: {
      version: string;
      volume: { deloadEvery: number };
      beginner: { deloadEvery: number };
    };
  }
).FIVE_K_V2_POLICY;
const cur = (await import(
  new URL(
    "../../../../web/src/domain/generators/fiveK/v2/testInputs.ts",
    import.meta.url,
  ).href
)) as typeof import("../../../../web/src/domain/generators/fiveK/v2/testInputs.ts");

const { periodize, isShortPrep } = (await import(join(v2, "periodize.ts"))) as {
  periodize: (
    start: string,
    n: number,
    every: number,
  ) => { phase: string; deload: boolean }[];
  isShortPrep: (n: number) => boolean;
};
const api = { generate: generateFiveKV2, adapt: adaptFiveKV2 };
/** Granica (Odluka 9) = najduži niz izgradnje bez rasterećenja u osnovnom rasporedu generatora (svi planovi sa
    rasterećenjem, 8–16 ned) + 1 — mereno na kodu checkouta. */
const longestRun = (every: number): number => {
  let longest = 0;
  for (let n = 6; n <= 16; n++) {
    if (isShortPrep(n)) continue;
    let run = 0;
    for (const f of periodize("2026-01-05", n, every)) {
      run =
        ["base", "peak", "sharpen"].includes(f.phase) && !f.deload
          ? run + 1
          : 0;
      longest = Math.max(longest, run);
    }
  }
  return longest;
};
const LIMIT = {
  regular: longestRun(P.volume.deloadEvery) + 1,
  beginner: longestRun(P.beginner.deloadEvery) + 1,
};
const bound = (beginner: boolean): number =>
  beginner ? LIMIT.beginner : LIMIT.regular;
const hash = (r: unknown): string =>
  createHash("sha256").update(cur.canonResult08e(r)).digest("hex").slice(0, 16);

interface Sum {
  flows: number;
  rejected: number;
  rejectedBy: Record<string, number>;
  withReduced: number;
  p1: number;
  keptByBound: number;
  dropped: number;
  maxRun: number;
  overBound: number;
  reducedFieldWrong: number;
}
const empty = (): Sum => ({
  flows: 0,
  rejected: 0,
  rejectedBy: {},
  withReduced: 0,
  p1: 0,
  keptByBound: 0,
  dropped: 0,
  maxRun: 0,
  overBound: 0,
  reducedFieldWrong: 0,
});
const out: Record<string, unknown> = { version: P.version, limit: LIMIT };
const allHashes: Record<string, Record<string, string>> = {};
const t0 = Date.now();
for (const search of ["narrow", "wide"] as const) {
  const scenarios = search === "narrow" ? cur.RELIEF_NARROW : cur.RELIEF_WIDE;
  const total = empty();
  const by: Record<string, Sum> = {};
  const hashes: Record<string, string> = {};
  const rejected: Record<string, string> = {};
  const p1: string[] = [];
  const kept: string[] = [];
  const tests: Record<string, number | null> = {};
  const noted: Record<string, number[]> = {};
  let notedMismatch = 0;
  for (const b of cur.reliefBases(api, search === "wide"))
    for (const c of cur.reliefCases(b, search, scenarios, raceTimeForVdot)) {
      const r = api.adapt(b.plan, c.facts, c.asOf);
      const k = cur.reliefCheck(r, bound, b.plan);
      hashes[c.key] = hash(r);
      tests[c.key] = k.testWeek;
      if (k.noted.length > 0) noted[c.key] = k.noted;
      const dw = k.dropped.map((x) => x.week).sort((x, y) => x - y);
      if (
        JSON.stringify(dw) !==
        JSON.stringify([...k.noted].sort((x, y) => x - y))
      )
        notedMismatch++;
      for (const s of [total, (by[c.scenario] ??= empty())]) {
        s.flows++;
        if (k.rejected) {
          s.rejected++;
          const key = `${k.rejected.code}:${k.rejected.rules.join("+")}`;
          s.rejectedBy[key] = (s.rejectedBy[key] ?? 0) + 1;
        }
        if (k.reducedWeeks.length > 0) s.withReduced++;
        if (k.p1.length > 0) s.p1++;
        if (k.keptByBound.length > 0) s.keptByBound++;
        if (k.dropped.length > 0) s.dropped++;
        s.maxRun = Math.max(s.maxRun, ...k.dropped.map((x) => x.run), 0);
        if (k.dropped.some((x) => x.run > k.limit)) s.overBound++;
        if (
          k.reduced &&
          k.reduced.got !== undefined &&
          k.reduced.got !== k.reduced.want
        )
          s.reducedFieldWrong++;
      }
      if (k.rejected)
        rejected[c.key] = `${k.rejected.code}:${k.rejected.rules.join("+")}`;
      if (k.p1.length > 0) p1.push(`${c.key} → ${k.p1.join(",")}`);
      if (k.keptByBound.length > 0)
        kept.push(`${c.key} → ${k.keptByBound.join(",")}`);
    }
  const feelTests = Object.fromEntries(
    Object.entries(tests).filter(([, v]) => v !== null),
  );
  out[search] = {
    total,
    notedMismatch,
    byScenario: by,
    rejected,
    p1,
    keptByBound: kept,
    noted,
    testWeek: feelTests,
  };
  allHashes[search] = hashes;
  console.log(search, JSON.stringify(total), "notedMismatch", notedMismatch);
}
out["seconds"] = Math.round((Date.now() - t0) / 1000);
type Run = {
  rejected: Record<string, string>;
  noted: Record<string, number[]>;
  testWeek: Record<string, number>;
};
const fixture = process.argv[4];
if (fixture) {
  const rej = (k: string) => (out[k] as Run).rejected;
  writeFileSync(
    fixture,
    JSON.stringify({
      policyVersion: P.version,
      narrow: { hashes: allHashes["narrow"], rejected: rej("narrow") },
      wide: { hashes: allHashes["wide"], rejected: rej("wide") },
    }) + "\n",
  );
  console.log(`→ ${fixture}`);
}
const preFile = process.argv[5];
if (preFile) {
  const pre = JSON.parse(readFileSync(preFile, "utf8")) as Record<string, Run>;
  const ref = JSON.parse(
    readFileSync(
      new URL(
        "../../../../web/src/domain/generators/fiveK/v2/segment08e.adapt-hashes-51a924f.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as Record<string, { hashes: Record<string, string> }>;
  const regression: Record<string, unknown> = {};
  for (const search of ["narrow", "wide"]) {
    const now = out[search] as Run;
    const by: Record<
      string,
      {
        changed: number;
        noted: number;
        formerlyRejected: number;
        other: number;
      }
    > = {};
    const other: string[] = [];
    const testChanges: string[] = [];
    for (const [k, h] of Object.entries(allHashes[search]!)) {
      const sc = k.split("/").pop()!;
      const b = (by[sc] ??= {
        changed: 0,
        noted: 0,
        formerlyRejected: 0,
        other: 0,
      });
      const tw0 = pre[search]!.testWeek[k] ?? null;
      const tw1 = now.testWeek[k] ?? null;
      if (tw0 !== tw1 && !now.rejected[k] && !pre[search]!.rejected[k])
        testChanges.push(`${k}: ${tw0 ?? "—"} → ${tw1 ?? "—"}`);
      if (ref[search]!.hashes[k] === h) continue;
      b.changed++;
      if (now.noted[k]) b.noted++;
      else if (pre[search]!.rejected[k]) b.formerlyRejected++;
      else {
        b.other++;
        other.push(k);
      }
    }
    regression[search] = { byScenario: by, other, testChanges };
  }
  out["regression"] = regression;
}
writeFileSync(outFile, JSON.stringify(out, null, 1) + "\n");
console.log(`→ ${outFile} (${out["seconds"]} s)`);
