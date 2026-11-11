/* P9v3 — ispis 12 HM profila iz P9/inputs.json kroz HM v3 generator.
   Iz web/: node ../docs/generators-v2/perfection/P9v3/render.ts
   Izlaz: docs/generators-v2/perfection/P9v3/plans/HM/pNN.txt */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  generate,
  renderText,
  type V3Input,
} from "../../../../web/src/domain/generators/halfMarathon/v3/index.ts";

const dir = new URL(".", import.meta.url).pathname;
const all = JSON.parse(
  readFileSync(`${dir}../P9/inputs.json`, "utf8"),
) as Record<string, { title: string; input: Record<string, any> }[]>;

/** P9 ulaz → v3 ulaz (isti podaci, sopstveni tip) */
export function toV3(x: Record<string, any>): V3Input {
  return {
    startDate: x.startDate,
    raceDate: x.raceDate,
    runDays: x.runDays,
    longRunDay: x.longRunDay ?? "sun",
    weeklyKm: x.currentWeeklyKm,
    recentResult: x.recentResult
      ? { distanceM: x.recentResult.distanceM, timeSec: x.recentResult.timeSec }
      : null,
    easyPaceSecPerKm: x.easyPaceSecPerKm ?? null,
    recentLongRunKm: x.recentLongRunKm ?? null,
    beginner: x.experience === "beginner",
    goalTimeSec: x.goalTimeSec ?? null,
  };
}

const out = `${dir}plans/HM`;
mkdirSync(out, { recursive: true });
all["HM"]!.forEach((p, i) => {
  const doc = generate(toV3(p.input));
  writeFileSync(
    `${out}/p${String(i + 1).padStart(2, "0")}.txt`,
    renderText(doc, p.title),
  );
});
console.log("ok", all["HM"]!.length);
