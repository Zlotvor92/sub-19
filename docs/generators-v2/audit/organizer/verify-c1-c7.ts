/* Organizator — nezavisna provera nalaza C1 (5K početnik rasterećenje u ned 2) i C7 (cilj predaje odbija rezultat
   nepodržane distance). Iz web/: node ../docs/generators-v2/audit/organizer/verify-c1-c7.ts */
import { distOf } from "../../final-check/lib.ts";
import { generateFiveKV2 } from "../../../../web/src/domain/generators/fiveK/v2/generate.ts";
import { generateTenKV2 } from "../../../../web/src/domain/generators/tenK/v2/generate.ts";

const d5 = distOf("5K");
const all = d5.all();
const b = all.find((x) => x.id === "b-d3-8w-12km-e420-0")!;
const g = d5.generate(b.input) as { ok: boolean; plan: { weeks: { index: number; targetKm: number; deload?: boolean; phase: string }[] } };
console.log("C1", b.id, g.ok && g.plan.weeks.map((w) => `${w.index}:${w.targetKm}${w.deload ? "R" : ""}/${w.phase}`).join(" "));
let beg = 0, early = 0;
for (const x of all) {
  if (!/^b-/.test(x.id)) continue;
  const r = d5.generate(x.input) as typeof g;
  if (!r.ok) continue;
  beg++;
  if (r.plan.weeks.some((w) => w.deload && w.index <= 2)) early++;
}
console.log("C1 početnici 5K mreže:", early, "/", beg, "sa rasterećenjem u ned 1–2");

const base = { startDate: "2026-11-02", raceDate: "2026-12-27", runDays: ["tue", "thu", "sat", "sun"], currentWeeklyKm: 30, experience: "regular", goalTimeSec: null };
const hmRes = { distanceM: 21097.5, timeSec: 6600, date: "2026-10-25" };
const marRes = { distanceM: 42195, timeSec: 14400, date: "2026-10-25" };
const r5 = generateFiveKV2({ ...base, recentResult: hmRes } as never) as { ok: boolean; errors?: { code: string }[] };
console.log("C7 5K + HM rezultat:", r5.ok, JSON.stringify((r5 as { errors?: unknown }).errors ?? (r5 as { reasons?: unknown }).reasons ?? "").slice(0, 200));
const r10 = generateTenKV2({ ...base, longRunDay: "sun", recentResult: marRes } as never) as { ok: boolean };
console.log("C7 10K + MAR rezultat:", r10.ok, JSON.stringify((r10 as { errors?: unknown }).errors ?? "").slice(0, 200));
const r10h = generateTenKV2({ ...base, longRunDay: "sun", recentResult: hmRes } as never) as { ok: boolean };
console.log("C7 10K + HM rezultat (kontrola):", r10h.ok, JSON.stringify((r10h as { errors?: unknown }).errors ?? "").slice(0, 200));
