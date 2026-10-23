/* HM-03 posle odluke organizatora (HI14, pouka 14 za test): razvrstavanje planova mreže 03 koji su bili izvodljivi
   u zaustavnom commitu 4fc8a3c, a sada se razlikuju. Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-03/classify-hi14.ts <koren v2 iz 4fc8a3c>
   Za svaki promenjen plan: nedelje koje se razlikuju (faza, rasterećenje, cilj, oznaka, dugi, broj kvaliteta pre →
   posle, nova napomena) i promene upozorenja. Prekršaj uslova: promena van nedelje rasterećenja ili bez nove
   napomene „Dugi skraćen" / „ni uz skraćen dugi". */

import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import {
  beginnerInputs,
  feelInputs,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";
import type {
  HmV2Plan,
  PlanWeek,
} from "../../../../web/src/domain/generators/halfMarathon/v2/types.ts";

const [root] = process.argv.slice(2);
if (!root) throw new Error("upotreba: classify-hi14.ts <koren v2 iz 4fc8a3c>");
const old = (await import(`${root}/generate.ts`)) as {
  generateHmV2: typeof generateHmV2;
};

const desc = (w: PlanWeek): string => {
  const long = w.days.find((d) => d.role === "long")?.workout.km;
  const q = w.days.filter((d) => d.workout.kind === "quality").length;
  return `cilj ${w.targetKm}${w.fitted ? ` (${w.fitted}, pravilo ${w.nominalKm})` : ""}, dugi ${long}, kvalitet ${q}`;
};
const warnKey = (p: HmV2Plan): string[] =>
  p.warnings.map((v) => `${v.rule}@${v.week ?? "-"}`).sort();

for (const [name, inputs] of [
  ["početnik", beginnerInputs()],
  ["po osećaju", feelInputs()],
] as const) {
  let changed = 0;
  let violations = 0;
  const kinds: Record<string, number> = {};
  const rows: string[] = [];
  for (const g of inputs) {
    const a = old.generateHmV2(g.input);
    const b = generateHmV2(g.input);
    if (!a.ok) continue;
    if (!b.ok) {
      violations++;
      rows.push(`${g.id}: sada odbijen`);
      continue;
    }
    const pa = { ...a.plan, policyVersion: "" };
    const pb = { ...b.plan, policyVersion: "" };
    if (JSON.stringify(pa) === JSON.stringify(pb)) continue;
    changed++;
    const weeks = pb.weeks.filter(
      (w, i) => JSON.stringify(w) !== JSON.stringify(pa.weeks[i]),
    );
    const wa = new Set(warnKey(pa));
    const wb = new Set(warnKey(pb));
    const added = [...wb].filter((x) => !wa.has(x));
    const removed = [...wa].filter((x) => !wb.has(x));
    const kind =
      weeks.length === 0
        ? `samo upozorenja (+${added.map((x) => x.split("@")[0]).join(",")} −${removed.map((x) => x.split("@")[0]).join(",")})`
        : `nedelje ${weeks.map((w) => (w.deload ? "rast." : w.phase)).join(",")}`;
    kinds[kind] = (kinds[kind] ?? 0) + 1;
    for (const w of weeks) {
      // Dozvoljeno: nedelja rasterećenja sa novom napomenom skraćenja (HI14) ili uklonjeno skraćenje (dugi duži,
      // bez napomene — standardna konstrukcija je izvodljiva, HI14 se ne primenjuje).
      const before = pa.weeks[w.index - 1]!;
      const longOf = (x: PlanWeek): number =>
        x.days.find((d) => d.role === "long")?.workout.km ?? 0;
      const ok =
        w.deload &&
        (w.notes.some(
          (n) =>
            n.startsWith("Dugi skraćen") || n.includes("ni uz skraćen dugi"),
        ) ||
          (longOf(w) > longOf(before) && w.targetKm === before.targetKm));
      if (!ok) violations++;
      rows.push(
        `${g.id} ned ${w.index}${ok ? "" : " PREKRŠAJ"}: ${desc(pa.weeks[w.index - 1]!)} → ${desc(w)}; ${w.notes.find((n) => n.startsWith("Dugi skraćen")) ?? ""}`,
      );
    }
    if (weeks.length > 0 && (added.length > 0 || removed.length > 0))
      rows.push(`  upozorenja +${added.join(",")} −${removed.join(",")}`);
  }
  console.log(`${name}: promenjeno ${changed}, prekršaja ${violations}`, kinds);
  for (const r of rows
    .filter((x) => !x.startsWith("  ") || true)
    .slice(0, name === "početnik" ? 80 : 12))
    console.log(r);
}
