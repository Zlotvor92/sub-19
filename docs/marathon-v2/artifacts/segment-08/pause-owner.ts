/* MAR-08 (dopuna pouke 37): nedelja ostatka pauze (assess pauseRemainder: cilj pauze od asOf + 1) ima svog vlasnika
   (volume.ts) i pouka 37 se na nju ne primenjuje (mixed.pauseOwned). Merenje: koliko tokova pauze bi ostatak do cilja
   (zbir zaštićenih dana po činjenicama) dodatno skratio da nedelja nema vlasnika — sudar. Rana mreža (182/78/42) ×
   earlyAsOfs × pauza 10/20 i pauza 10 + bol 5 (pause10pain5). Iz web/: node ../docs/marathon-v2/artifacts/segment-08/pause-owner.ts */
import { adaptMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/adapt.ts";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import {
  factKmOf,
  mixedRest,
  pauseOwned,
} from "../../../../web/src/domain/generators/marathon/v2/mixed.ts";
import * as T from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";

let flows = 0,
  owned = 0,
  withKept = 0,
  wouldCut = 0,
  rejected = 0;
const ex: string[] = [];
for (const b of T.earlyGridBases(182, 78, 42)) {
  const g: any = generateMarathonV2(b.input);
  if (!g.ok) continue;
  const p = g.plan;
  for (const a of T.earlyAsOfs(p))
    for (const s of ["pause10", "pause20", "pause10pain5"] as const) {
      if (!(T.EARLY_SCENARIOS as readonly string[]).includes(s)) continue;
      const f: any = T.earlyFacts(p, s as any, a.asOf);
      const r: any = adaptMarathonV2(p, f, a.asOf);
      flows++;
      if (!r.ok) {
        rejected++;
        continue;
      }
      const steps = r.plan.adaptation.steps;
      const w = r.plan.weeks.find((x: any) => pauseOwned(steps, x.index));
      if (!w) continue;
      owned++;
      const kept = w.days.filter((d: any) => d.date <= a.asOf);
      if (kept.length === 0) continue;
      withKept++;
      const fk: Record<string, number> = {};
      for (const d of kept) {
        const k = factKmOf(d.date, {
          workouts: f.workouts ?? [],
          breaks: f.breaks ?? [],
        });
        if (k !== null) fk[d.date] = k;
      }
      const m = mixedRest(
        kept,
        w.days.filter((d: any) => d.date > a.asOf),
        Math.round(w.targetKm * 10),
        r.plan.paces,
        fk,
      );
      if (m.cut) {
        wouldCut++;
        if (ex.length < 5) ex.push(`${b.id}/${a.tag}/${s} ned ${w.index}`);
      }
    }
}
console.log(
  JSON.stringify(
    {
      flows,
      rejected,
      pauseOwnedWeek: owned,
      withProtectedDays: withKept,
      wouldBeCut: wouldCut,
      ex,
    },
    null,
    1,
  ),
);
