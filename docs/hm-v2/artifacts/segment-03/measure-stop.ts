/* HM v2 Segment 03 — merenje sudara (SEGMENT-03-STOP.md): početnik pri najmanjem obimu, prvo rasterećenje.
   Pokretanje iz korena repoa (≈ 1 min):  node docs/hm-v2/artifacts/segment-03/measure-stop.ts
   Kopira halfMarathon/v2 u privremeni folder, primeni varijantu (find/replace, tačno 1×) i pusti mrežu početnika
   (1890) kroz generator SA validatorom. Varijante: 0 = kod segmenta (stanje pri zaustavljanju); P1 = dugi
   rasterećenja ≤ 0,8 × poslednji — najduži koji ostavlja lagane ≥ 4 km (kao HI11 b), a kad ni tako kvalitet ne
   staje, rasterećenje bez kvaliteta; P4 = cilj rasterećenja naviše do najbližeg izvodljivog (≤ granica
   izgradnje); P5 = rasterećenje ispušta najraniji lagan dan dok nedelja ne stane (validator H9 za rasterećenje
   isključen). P2 (veći minimum obima početnika) meri obim 20–30 / 25–35 km korak 0,5 nad kodom segmenta. */

import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(
  new URL(
    "../../../../web/src/domain/generators/halfMarathon/v2",
    import.meta.url,
  ),
);
type Edit = [file: string, find: string, replace: string];
const VARIANTS: Record<string, Edit[]> = {
  "0": [],
  P1: [
    [
      "lengths.ts",
      "  if (test) return withEasy(",
      "  if (true) return withEasy(",
    ],
    [
      "week.ts",
      "  mode: QualityMode = 'rule',\n  roll10 = Infinity\n): BuiltWeek | null {",
      "  mode: QualityMode = 'rule',\n  roll10 = Infinity,\n  noQ = false\n): BuiltWeek | null {",
    ],
    [
      "week.ts",
      "    const fits = !intro && !test && d.doseM",
      "    const fits = !noQ && !intro && !test && d.doseM",
    ],
    [
      "week.ts",
      "    if (!fits && !relax && !intro && !test) return null;",
      "    if (!fits && !relax && !intro && !test && !noQ) return null;",
    ],
    [
      "week.ts",
      "    if (!len) return null;\n    const long0",
      "    if (!len)\n      return relax && tw && !test\n        ? buildWeek(ctx, frame, target10, quality, lastLong10, longest10, mode, roll10, true)\n        : null;\n    const long0",
    ],
    ["validate.ts", "          w.test && testDay\n", "          true\n"],
    [
      "validate.ts",
      "                to100(testDay.workout.km),",
      "                to100(testDay?.workout.km ?? w.days.filter((d) => d.workout.kind === 'quality').reduce((a, d) => a + d.workout.km, 0)),",
    ],
    [
      "validate.ts",
      "      } else if (want.doseM > capM('T', w.targetKm)) {",
      "      } else if (want.doseM > capM('T', w.targetKm) || nQuality === 0) {",
    ],
    [
      "validate.ts",
      "        if (nQuality !== 0 || !w.notes.some((n) => n.includes('bez kvaliteta')))",
      "        if (nQuality !== 0)",
    ],
  ],
  P4: [
    [
      "volume.ts",
      "  const hi = frame.deload || frame.phase === 'taper' ? nominal : cap10;",
      "  const hi = frame.phase === 'taper' ? nominal : cap10;",
    ],
    [
      "validate.ts",
      "      (w.fitted === 'up' && (w.deload || w.phase === 'taper')) ||",
      "      (w.fitted === 'up' && w.phase === 'taper') ||",
    ],
  ],
  P5: [
    [
      "week.ts",
      "    const len = deloadLengths(",
      "    let len = deloadLengths(",
    ],
    [
      "week.ts",
      "    if (!len) return null;\n    const long0",
      "    let dates2 = dates;\n    while (!len && dates2.length > 1) {\n      dates2 = dates2.slice(1);\n      len = deloadLengths(target10, tw ? km100(tw.km) : 0, dates2.length, lastLong10, rule, p, roll10, test);\n    }\n    if (!len) return null;\n    const long0",
    ],
    [
      "week.ts",
      "        ...easyDays(dates, len.easy10, p)\n      ],\n      len.long10,\n      null,\n      test",
      "        ...easyDays(dates2, len.easy10, p)\n      ],\n      len.long10,\n      null,\n      test",
    ],
    [
      "validate.ts",
      "    if (JSON.stringify(got) !== JSON.stringify(want))\n      err('ROLES'",
      "    if (!w.deload && JSON.stringify(got) !== JSON.stringify(want))\n      err('ROLES'",
    ],
  ],
};

interface Plan {
  weeks: {
    index: number;
    phase: string;
    deload: boolean;
    fitted: string | null;
    targetKm: number;
    days: { role: string; workout: { kind: string; km: number } }[];
  }[];
}
type Gen = (
  raw: unknown,
) =>
  | { ok: true; plan: Plan }
  | { ok: false; reasons: { code: string; week?: number }[] };

const tmp = mkdtempSync(join(tmpdir(), "hm03-stop-"));
const { beginnerInputs } = (await import(
  `${SRC}/testInputs.ts`
)) as typeof import("../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts");
const inputs = beginnerInputs();
const isBuild = (ph: string): boolean =>
  ph === "base" || ph === "development" || ph === "specific";
/** Plan varijante 0 po ulazu (JSON) — „promenjeni" = izvodljivi i u 0, a različiti u varijanti. */
const base0: Record<string, string> = {};
try {
  for (const [name, edits] of Object.entries(VARIANTS)) {
    const dir = join(tmp, name);
    cpSync(SRC, dir, { recursive: true });
    for (const [f, find, rep] of edits) {
      const s = readFileSync(join(dir, f), "utf8");
      if (s.split(find).length !== 2)
        throw new Error(`${name} ${f}: find ≠ 1×`);
      writeFileSync(join(dir, f), s.replace(find, rep));
    }
    const { generateHmV2 } = (await import(`${dir}/generate.ts`)) as {
      generateHmV2: Gen;
    };
    const m = {
      changedFeasible: 0,
      rejected: 0,
      plans: 0,
      deloadWeeks: 0,
      shortLongWeeks: 0,
      minLongShare: 1,
      minLong: 99,
      noQualityDeload: 0,
      upWeeks: 0,
      maxDeloadShare: 0,
      fewerDaysWeeks: 0,
    };
    const byKm: Record<string, number> = {};
    for (const g of inputs) {
      const r = generateHmV2(g.input);
      if (!r.ok) {
        m.rejected++;
        const k = `${g.days} d ${g.km} km`;
        byKm[k] = (byKm[k] ?? 0) + 1;
        continue;
      }
      m.plans++;
      const js = JSON.stringify(r.plan);
      if (name === "0") base0[g.id] = js;
      else if (base0[g.id] !== undefined && base0[g.id] !== js)
        m.changedFeasible++;
      let lastLong = 0;
      let lastBuild = 0;
      for (const w of r.plan.weeks) {
        const long = w.days.find((d) => d.role === "long")?.workout.km ?? 0;
        if (w.deload) {
          m.deloadWeeks++;
          const want = Math.floor(0.8 * lastLong * 10 + 1e-9) / 10;
          if (long < want - 1e-9) {
            m.shortLongWeeks++;
            m.minLong = Math.min(m.minLong, long);
            m.minLongShare = Math.min(
              m.minLongShare,
              +(long / lastLong).toFixed(3),
            );
          }
          if (!w.days.some((d) => d.workout.kind === "quality"))
            m.noQualityDeload++;
          if (w.fitted === "up") m.upWeeks++;
          m.maxDeloadShare = Math.max(
            m.maxDeloadShare,
            +(w.targetKm / lastBuild).toFixed(3),
          );
          if (w.days.length < (g.days as number)) m.fewerDaysWeeks++;
        }
        if (isBuild(w.phase) && !w.deload) {
          lastLong = long;
          lastBuild = w.targetKm;
        }
      }
    }
    console.log(name, JSON.stringify(m), JSON.stringify(byKm));
  }
  // P2: najmanji obim početnika bez odbijanja (kod segmenta), tempi 270–510 i VDOT 30–60, 12–20 ned, raspored A.
  const { generateHmV2 } = (await import(`${join(tmp, "0")}/generate.ts`)) as {
    generateHmV2: Gen;
  };
  const { inputOf, SCHEDULES_BY_DAYS } = (await import(
    `${SRC}/testInputs.ts`
  )) as typeof import("../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts");
  for (const days of [4, 5] as const) {
    const row: string[] = [];
    for (
      let km10 = days === 4 ? 200 : 250;
      km10 <= (days === 4 ? 300 : 350);
      km10 += 5
    ) {
      let f = 0;
      let n = 0;
      for (const pace of [
        270, 300, 330, 390, 450, 510, -30, -35, -40, -45, -50, -60,
      ])
        for (let weeks = 12; weeks <= 20; weeks++) {
          const sc = SCHEDULES_BY_DAYS[days].A;
          const inp = inputOf({
            weeks,
            km: km10 / 10,
            days: sc.days,
            long: sc.long,
            beginner: true,
            ...(pace > 0 ? { easyPaceSecPerKm: pace } : { vdot: -pace }),
          });
          n++;
          if (!generateHmV2(inp).ok) f++;
        }
      row.push(`${km10 / 10}:${f}/${n}`);
    }
    console.log(`P2 ${days} d`, row.join(" "));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
