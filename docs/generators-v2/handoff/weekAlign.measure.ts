/* Faza 3, 3c — sudar: v1 cilj kalemi plan po POČETKU NEDELJE (`graftFuturePlan`: `oldByStart`), a v1 nedelje počinju
   ponedeljkom. Plan HM v2 ima nedelje od dana posle dana trke (trka u subotu → nedelje od nedelje). Meri: u koliko
   predaja HM v2 → 10K/5K v1 (kroz čistač 3b) plan cilja ima DVA dana istog datuma (nedelja izvora + nedelja cilja).
   Iz web/: npx vitest run --config ../docs/generators-v2/handoff/vitest.measure.config.mjs weekAlign */
import * as select from "../../../web/src/domain/generators/select";
import * as THM from "../../../web/src/domain/generators/halfMarathon/v2/testInputs";
import { writeFileSync } from "node:fs";

declare const test: (name: string, fn: () => void, timeout?: number) => void;
const DAY = 86_400_000;
const addDays = (d: string, n: number) =>
  new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const WD = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

test("poravnanje nedelja v1 cilja", () => {
  const out: Record<
    string,
    {
      calls: number;
      ok: number;
      duplicateDates: number;
      weekStartDow: Record<string, number>;
    }
  > = {};
  const inputs = THM.grid02Inputs().filter((_, i) => i % 41 === 20);
  for (const c of inputs) {
    const v = c.input as {
      startDate: string;
      raceDate: string;
      runDays: string[];
      longRunDay?: string;
      currentWeeklyKm: number;
      recentResult?: { distanceM: number; timeSec: number; date: string };
    };
    const s = select.generateHmV2Plan(c.input as never);
    if (!s.ok) continue;
    const plan = s.plan;
    const race = new Date(v.raceDate + "T00:00:00Z").getUTCDay();
    const key = `trka ${["ned", "pon", "uto", "sre", "čet", "pet", "sub"][race]}`;
    const o = (out[key] ??= {
      calls: 0,
      ok: 0,
      duplicateDates: 0,
      weekStartDow: {},
    });
    const startDow = ["ned", "pon", "uto", "sre", "čet", "pet", "sub"][
      new Date(plan.weeks[0]!.start + "T00:00:00Z").getUTCDay()
    ]!;
    o.weekStartDow[startDow] = (o.weekStartDow[startDow] ?? 0) + 1;
    for (const dist of [10000, 5000])
      for (const at of [addDays(v.startDate, -1), addDays(v.startDate, 13)]) {
        const h = select.shorterHandoffForV2Source(
          { fiveKV2: false },
          {
            planKey: "hmV2",
            metaKeys: [
              "vdot",
              "paceBasis",
              "predictedHmSec",
              "goalVdot",
              "goalAssessment",
            ],
          },
        )(dist)!;
        const runDows = v.runDays.map((d) => WD.indexOf(d) + 1);
        const input = {
          startDate: v.startDate,
          raceDate: v.raceDate,
          raceDistM: dist,
          pb: v.recentResult
            ? {
                distM: v.recentResult.distanceM,
                sec: v.recentResult.timeSec,
                date: v.recentResult.date,
              }
            : undefined,
          weeklyKm: v.currentWeeklyKm,
          runDays: runDows.length,
          runDows,
          intensity: "std",
          goalSec: null,
        };
        o.calls++;
        const r = (
          h as unknown as (...a: unknown[]) => {
            result?: { weeks: { start: string; days: { dow: number }[] }[] };
          }
        )(plan, input, at, {}, { execution: null, restartFromBase: false });
        if (!r.result) continue;
        o.ok++;
        const dates = r.result.weeks.flatMap((w) =>
          w.days.map((d) => addDays(w.start, d.dow)),
        );
        if (new Set(dates).size !== dates.length) o.duplicateDates++;
      }
  }
  writeFileSync(
    new URL("./weekAlign.json", import.meta.url),
    JSON.stringify(out, null, 1) + "\n",
  );
}, 3_600_000);
