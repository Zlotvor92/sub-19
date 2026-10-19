/* Regresija HM-03 prema HM-02 (planovi sa rezultatom): heš celog rezultata generatora (plan bez oznake verzije,
   ili razlozi odbijanja) za mrežu 02 (16 896), mrežu skorašnjeg najdužeg trka (10 944) i gustu mrežu nedelje 1
   (141 804). Ulazi uvek iz OVOG stabla (testInputs.ts), generator iz korena datog argumentom:
     node docs/hm-v2/artifacts/segment-03/regression-hm02.ts <koren web/src/domain/generators/halfMarathon/v2> <izlaz.json>
   Npr. koren worktree-a 2285fc7 (HM-02) i ovog stabla; dva izlaza moraju biti jednaka. */

import { writeFileSync } from "node:fs";
import {
  DAY_COUNTS,
  denseInputs,
  grid02Inputs,
  inputOf,
  KM_BY_DAYS,
  SCHEDULES_BY_DAYS,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const [root, out] = process.argv.slice(2);
if (!root || !out)
  throw new Error("upotreba: regression-hm02.ts <koren v2> <izlaz.json>");
const { generateHmV2 } = (await import(`${root}/generate.ts`)) as {
  generateHmV2: (
    raw: unknown,
  ) =>
    | { ok: true; plan: { policyVersion: string } }
    | { ok: false; reasons: unknown[] };
};

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const inputs: [string, Record<string, unknown>][] = [
  ...grid02Inputs().map(
    (g) => [g.id, g.input] as [string, Record<string, unknown>],
  ),
  ...DAY_COUNTS.flatMap((days) => {
    const xs: [string, Record<string, unknown>][] = [];
    for (let r = 5; r <= 42; r++)
      for (let km = KM_BY_DAYS[days].min; km <= KM_BY_DAYS[days].max; km += 5)
        for (const vdot of [30, 45, 70])
          for (const weeks of [10, 14, 20])
            xs.push([
              `r-d${days}-${weeks}w-${km}km-v${vdot}-r${r}`,
              inputOf({
                weeks,
                km,
                vdot,
                days: SCHEDULES_BY_DAYS[days].A.days,
                recentLongRunKm: r,
              }),
            ]);
    return xs;
  }),
  ...DAY_COUNTS.flatMap((n) =>
    denseInputs(n).map(
      (g) => [`dense-${g.id}`, g.input] as [string, Record<string, unknown>],
    ),
  ),
];
const hashes: Record<string, string> = {};
for (const [id, input] of inputs) {
  const r = generateHmV2(input);
  hashes[id] = r.ok
    ? fnv(JSON.stringify({ ...r.plan, policyVersion: "" }))
    : `odbijen:${fnv(JSON.stringify(r.reasons))}`;
}
writeFileSync(out, `${JSON.stringify(hashes)}\n`);
console.log(`${Object.keys(hashes).length} ulaza → ${out}`);
