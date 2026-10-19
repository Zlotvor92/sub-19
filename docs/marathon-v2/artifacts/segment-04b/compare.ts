/* MAR-04b poređenje pre/posle (JSON redovi measure.ts): po mreži odbijanja, dani kvaliteta duži od dugog (iznad
   najnižeg nivoa / najniži; izgradnja, rasterećenje, taper), K2 (ned 1 < obim), K4 (vrh niži), pad doze i
   REGRESIJA: menja se samo plan (tok) koji je pre imao bar jedan dan kvaliteta duži od dugog (bilo koje zone i
   nedelje), ili tok koji je pre bio odbijen, ili tok čiji generator ima takav dan; svaki drugi promenjen = STANI.
   Iz korena: node --experimental-strip-types docs/marathon-v2/artifacts/segment-04b/compare.ts <dir> <pre> <posle>
   (fajlovi <dir>/m-<oznaka>-<porodica>-<k>.jsonl); izuzeci regresije sa razlogom (odluka organizatora) u
   regression-exceptions.json pored ovog fajla (ključ `<porodica>/<tok>`). Izlaz: JSON na stdout. */

import { readdirSync, readFileSync } from "node:fs";

const [dir, A, B] = process.argv.slice(2) as [string, string, string];
const EXC = JSON.parse(
  readFileSync(
    new URL("./regression-exceptions.json", import.meta.url),
    "utf8",
  ),
) as Record<string, string>;
type Rec = Record<string, any>;
const load = (tag: string, fam: string): Map<string, Rec> => {
  const m = new Map<string, Rec>();
  for (const f of readdirSync(dir).filter(
    (x) => x.startsWith(`m-${tag}-${fam}-`) && x.endsWith(".jsonl"),
  ))
    for (const l of readFileSync(`${dir}/${f}`, "utf8").split("\n"))
      if (l) {
        const r = JSON.parse(l) as Rec;
        m.set(r.key, r);
      }
  return m;
};
const kinds = ["build", "deload", "taper"] as const;
const over = (r: Rec | undefined): boolean =>
  !!r && !r.rej && !r.gen && kinds.some((k) => r.o[k][0] + r.o[k][1] > 0);
const sum = (rs: Rec[], k: string, i: 0 | 1): number =>
  rs.reduce((a, r) => a + (r.o ? r.o[k][i] : 0), 0);
const out: Record<string, unknown> = {};
for (const fam of [
  "grid",
  "recent",
  "dense",
  "feel",
  "beg",
  "a04",
  "early",
  "pre",
  "wide",
]) {
  const a = load(A, fam);
  const b = load(B, fam);
  if (a.size === 0 && b.size === 0) continue;
  const adapt = ["a04", "early", "pre", "wide"].includes(fam);
  const okA = [...a.values()].filter((r) => r.o);
  const okB = [...b.values()].filter((r) => r.o);
  const rejA = [...a.values()].filter((r) => r.rej);
  const rejB = [...b.values()].filter((r) => r.rej);
  const rejCls = (rs: Rec[]) => {
    const c: Record<string, number> = {};
    for (const r of rs) {
      const k = `${String(r.rej).split(":")[0]}:${String(r.rej)
        .split(":")[1]
        ?.replace(/\d+([,.]\d+)?/g, "#")
        .slice(0, 50)}`;
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  };
  let changed = 0;
  const other: string[] = [];
  const why: Record<string, number> = {};
  let peakLower = 0;
  let peakDrop = 0;
  const peakEx: string[] = [];
  let w1Changed = 0;
  let w1Below = 0;
  const w1Ex: string[] = [];
  for (const [key, rb] of b) {
    const ra = a.get(key);
    if (!ra) {
      other.push(`${key}: nema pre`);
      continue;
    }
    const same =
      (ra.rej ?? ra.h ?? ra.gen) === (rb.rej ?? rb.h ?? rb.gen) &&
      !!ra.rej === !!rb.rej;
    if (same) continue;
    changed++;
    const reason = ra.rej
      ? "pre odbijen"
      : over(ra)
        ? "pre dan > dugi"
        : adapt && ra.genOver
          ? "generator: dan > dugi"
          : EXC[`${fam}/${key}`]
            ? "izuzetak (odluka organizatora)"
            : null;
    if (reason) why[reason] = (why[reason] ?? 0) + 1;
    else if (other.length < 30) other.push(key);
    else other.push("…");
    if (ra.o && rb.o) {
      if (rb.peak < ra.peak - 1e-9) {
        peakLower++;
        if (ra.peak - rb.peak > peakDrop)
          peakDrop = Math.round((ra.peak - rb.peak) * 10) / 10;
        if (peakEx.length < 5) peakEx.push(`${key}: ${ra.peak} → ${rb.peak}`);
      }
      if (rb.w1 !== ra.w1) {
        w1Changed++;
        if (rb.w1 < rb.start) w1Below++;
        if (w1Ex.length < 5) w1Ex.push(`${key}: ${ra.w1} → ${rb.w1}`);
      }
    }
  }
  const lowMax = okB.reduce((x, r) => Math.max(x, r.lowMin ?? 0), 0);
  out[fam] = {
    n: b.size,
    rejected: `${rejA.length} → ${rejB.length}`,
    rejectedPre: rejCls(rejA),
    rejectedPost: rejCls(rejB),
    aboveLowest: Object.fromEntries(
      kinds.map((k) => [k, `${sum(okA, k, 0)} → ${sum(okB, k, 0)}`]),
    ),
    lowest: Object.fromEntries(
      kinds.map((k) => [k, `${sum(okA, k, 1)} → ${sum(okB, k, 1)}`]),
    ),
    lowestMaxMin: lowMax,
    zonesPre: okA.reduce((c: Record<string, number>, r) => {
      for (const [z, v] of Object.entries(r.z ?? {}))
        c[z] = (c[z] ?? 0) + (v as number);
      return c;
    }, {}),
    overPlansPre: okA.filter(over).length,
    lsqPlans: `${okA.filter((r) => r.lsq).length} → ${okB.filter((r) => r.lsq).length}`,
    doseDropped: `${okA.reduce((x, r) => x + r.drops, 0)} → ${okB.reduce((x, r) => x + r.drops, 0)}`,
    w1BelowStart: `${okA.filter((r) => r.w1 < r.start).length} → ${okB.filter((r) => r.w1 < r.start).length}`,
    changed,
    changedWhy: why,
    otherChanged: other.length,
    otherEx: other.slice(0, 30),
    K4: { lower: peakLower, maxDropKm: peakDrop, ex: peakEx },
    w1: { changed: w1Changed, belowStart: w1Below, ex: w1Ex },
  };
}
console.log(JSON.stringify(out, null, 1));
