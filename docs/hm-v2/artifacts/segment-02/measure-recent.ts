/* HM v2 Segment 02 — merenje pouke 28 (recentLongRunKm, HI7): odbijanja nedelje 1 kad je granica dugog niska.
   Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-02/measure-recent.ts
   Svaki broj dana × obim reda H15 (korak 5) × VDOT {30, 35, 40, 45, 50, 55, 60, 70, 80} × recentLongRunKm 5,0–20,0
   (korak 0,5), 12 nedelja, raspored A. Ispis: po broju dana najveći r sa odbijanjem, broj odbijanja po r, primer
   (nedelja 1: kvalitet, granica dugog, najveći izvodljiv obim). */

import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import {
  DAY_COUNTS,
  inputOf,
  KM_BY_DAYS,
  SCHEDULES_BY_DAYS,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const VDOT = [30, 35, 40, 45, 50, 55, 60, 70, 80];
const out: Record<string, unknown> = {};
for (const days of DAY_COUNTS) {
  const byR: Record<string, number> = {};
  const codes: Record<string, number> = {};
  let total = 0;
  let rejected = 0;
  let maxR = 0;
  let example = "";
  for (let km = KM_BY_DAYS[days].min; km <= KM_BY_DAYS[days].max; km += 5)
    for (const vdot of VDOT)
      for (let r2 = 10; r2 <= 40; r2++) {
        const r = r2 / 2;
        total++;
        const res = generateHmV2(
          inputOf({
            weeks: 12,
            km,
            vdot,
            days: SCHEDULES_BY_DAYS[days].A.days,
            recentLongRunKm: r,
          }),
        );
        if (res.ok) continue;
        rejected++;
        byR[r] = (byR[r] ?? 0) + 1;
        for (const x of res.reasons) codes[x.code] = (codes[x.code] ?? 0) + 1;
        if (r >= maxR) {
          maxR = r;
          example = `${days} d, ${km} km, VDOT ${vdot}, r ${r}: ${res.reasons[0]!.message}`;
        }
      }
  out[`${days} dana`] = {
    total,
    rejected,
    codes,
    maxRejectedR: maxR,
    byR,
    example,
  };
}
console.log(JSON.stringify(out, null, 1));
