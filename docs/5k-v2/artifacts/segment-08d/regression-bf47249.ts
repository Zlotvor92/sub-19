/* Heševi izlaza adaptacije na polaznom SHA bf47249 (5k-v2.6.0) za regresiju segmenta 08d (5k-v2.6.1: smeju da
   se promene SAMO tokovi sa primenjenim PAIN i povratkom). Pokretanje iz korena repoa:
     git worktree add --detach /tmp/wt-bf4 bf47249
     ln -s "$PWD/web/node_modules" /tmp/wt-bf4/web/node_modules
     node docs/5k-v2/artifacts/segment-08d/regression-bf47249.ts /tmp/wt-bf4
   Kod koji se meri (generateFiveKV2, adaptFiveKV2, raceTimeForVdot) je IZ CHECKOUTA bf47249; definicije tokova
   (ulazi, činjenice, asOf) su iz OVOG stabla (fiveK/v2/testInputs.ts — adaptNetworkFlows, painGridBases,
   painCases, painFacts; na bf47249 ne postoje kao funkcije, mreže su bile u segment06/07 testovima):
   - network: postojeće mreže adaptacije — s06 (420), s07a (120), s07b (192) = 732 toka;
   - gridP: mreža bola P — 7 planova × 2 nedelje × 7 dana × bol 4/5/7/8 = 392 toka.
   Heš = prvih 16 hex sha256(canonResult(r)) — ceo rezultat adaptacije (plan, changes, reasons; odbijanje:
   reasons, violations) bez oznake verzije; rejectedNetwork/rejectedGridP = tokovi koje bf47249 odbija. Upisuje
   web/src/domain/generators/fiveK/v2/segment08d.adapt-hashes-bf47249.json (posle toga prettier --write). */

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const old = resolve(process.argv[2] ?? "");
const v2 = join(old, "web/src/domain/generators/fiveK/v2");
const { generateFiveKV2 } = (await import(join(v2, "generate.ts"))) as {
  generateFiveKV2: (input: unknown) => unknown;
};
const { adaptFiveKV2 } = (await import(join(v2, "adapt.ts"))) as {
  adaptFiveKV2: (plan: unknown, facts: unknown, asOf: string) => unknown;
};
const { raceTimeForVdot } = (await import(join(v2, "paces.ts"))) as {
  raceTimeForVdot: (vdot: number, distM: number) => number;
};
const { version } = (
  (await import(join(v2, "policy.ts"))) as {
    FIVE_K_V2_POLICY: { version: string };
  }
).FIVE_K_V2_POLICY;
const cur = (await import(
  new URL(
    "../../../../web/src/domain/generators/fiveK/v2/testInputs.ts",
    import.meta.url,
  ).href
)) as typeof import("../../../../web/src/domain/generators/fiveK/v2/testInputs.ts");

const api = { generate: generateFiveKV2, adapt: adaptFiveKV2 };
const hash = (r: unknown): string =>
  createHash("sha256").update(cur.canonResult(r)).digest("hex").slice(0, 16);

const rejected = (r: unknown): boolean => !(r as { ok: boolean }).ok;
const network: Record<string, string> = {};
const rejectedNetwork: string[] = [];
for (const f of cur.adaptNetworkFlows(api, raceTimeForVdot)) {
  network[f.key] = hash(f.result);
  if (rejected(f.result)) rejectedNetwork.push(f.key);
}
const gridP: Record<string, string> = {};
const rejectedGridP: string[] = [];
for (const b of cur.painGridBases(api))
  for (const c of cur.painCases(b)) {
    const r = adaptFiveKV2(b.plan, cur.painFacts(c.asOf, c.level), c.asOf);
    gridP[c.key] = hash(r);
    if (rejected(r)) rejectedGridP.push(c.key);
  }

const out = new URL(
  "../../../../web/src/domain/generators/fiveK/v2/segment08d.adapt-hashes-bf47249.json",
  import.meta.url,
);
writeFileSync(
  out,
  JSON.stringify({
    against: "bf47249",
    policyVersion: version,
    count: {
      network: Object.keys(network).length,
      gridP: Object.keys(gridP).length,
    },
    /** Tokovi koje bf47249 odbija (PLAN_VIOLATES_POLICY i sl.). */
    rejectedNetwork,
    rejectedGridP,
    network,
    gridP,
  }) + "\n",
);
console.log(
  Object.keys(network).length,
  "+",
  Object.keys(gridP).length,
  "heševa →",
  out.pathname,
);
