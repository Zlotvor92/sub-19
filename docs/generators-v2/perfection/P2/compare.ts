/* P2 — poređenje dve oznake measure.ts (pre / posle): metrike po grupi R/F/B, nova odbijanja, promenjeni planovi.
   Iz web/: node ../docs/generators-v2/perfection/P2/compare.ts pre posle [ids] */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const [a, b] = [process.argv[2] ?? "pre", process.argv[3] ?? "posle"];
type R = { id: string; family: string; days: number; weeks: number; km: number; rejected?: string[]; m?: any; p2?: any; weeksJson?: string };
const A: R[] = JSON.parse(readFileSync(`${dir}raw-MAR-${a}.json`, "utf8"));
const B: R[] = JSON.parse(readFileSync(`${dir}raw-MAR-${b}.json`, "utf8"));
const byA = new Map(A.map((r) => [r.id, r]));
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const r1 = (x: number) => Math.round(x * 10) / 10;
const cell = (xs: number[]) => xs.length ? `${r1(med(xs))} [${r1(Math.min(...xs))}–${r1(Math.max(...xs))}]` : "—";
const vdot = (r: R) => Number(/-v(\d+)$/.exec(r.id)?.[1] ?? NaN);
const newRej = B.filter((r) => r.rejected && !byA.get(r.id)?.rejected);
console.log(`ulaza ${B.length}; odbijeno ${a} ${A.filter((r) => r.rejected).length}, ${b} ${B.filter((r) => r.rejected).length}; nova odbijanja ${newRej.length}`);
for (const r of newRej) console.log(`  NOVO ODBIJANJE ${r.id}: ${r.rejected!.join(" | ")}`);
const changedIds = B.filter((r) => { const o = byA.get(r.id); return o?.weeksJson && r.weeksJson && o.weeksJson !== r.weeksJson; }).map((r) => r.id);
console.log(`promenjenih planova ${changedIds.length}/${B.filter((r) => r.m).length}`);
const mpTrain = (r: R) => r.p2?.mpTrainMax ?? 0;
for (const fam of ["R", "F", "B", "ALL"]) {
  const ra = A.filter((r) => r.m && (fam === "ALL" || r.family === fam)), rb = B.filter((r) => r.m && (fam === "ALL" || r.family === fam));
  console.log(`\n## ${fam} (n ${ra.length} / ${rb.length})\n| metrika | ${a} | ${b} |\n|---|---|---|`);
  const rows: [string, (r: R) => number][] = [
    ["najveći MP trening [km]", mpTrain],
    ["najveći blok [km]", (r) => Math.max(0, ...(r.p2?.blocks ?? []))],
    ["ukupno MP u planu (trening + blok) [km]", (r) => r.m.m3.totalKm],
    ["dugih sa blokom", (r) => r.m.m4.withFast],
    ["najduži dugi [km]", (r) => r.m.m4.maxKm],
    ["najduži dugi [min]", (r) => r.m.m4.maxMin],
    ["najduži dugi [% trke]", (r) => r.m.m4.pct],
    ["% km bržih od E, nedelja A (spec.)", (r) => med(r.p2?.fastA ?? []) || 0],
    ["% km bržih od E, nedelja B", (r) => (r.p2?.fastB?.length ? med(r.p2.fastB) : NaN)],
    ["% km bržih od E, specifična faza", (r) => r.m.m7.specific ?? 0],
    ["najduži dan nedelje [km]", (r) => r.p2?.longestDay ?? 0],
    ["najduži dan nedelje [min]", (r) => r.p2?.longestDayMin ?? 0],
    ["MARATHON_LONG_SHORT (1 = da)", (r) => (r.p2?.longShort ? 1 : 0)],
  ];
  for (const [name, f] of rows) console.log(`| ${name} | ${cell(ra.map(f).filter((x) => !Number.isNaN(x)))} | ${cell(rb.map(f).filter((x) => !Number.isNaN(x)))} |`);
  const ls = (rs: R[]) => rs.filter((r) => r.p2?.longShort).length;
  const ln = (rs: R[]) => rs.filter((r) => r.p2?.longShortNote).length;
  console.log(`MARATHON_LONG_SHORT upozorenje: ${ls(ra)} → ${ls(rb)}; najduži < praga ograničen trajanjem (napomena N11): ${ln(ra)} → ${ln(rb)}`);
}
console.log("\n## najduži dugi km / min / % trke po VDOT × dani (R, medijana)");
for (const v of [35, 45, 55, 65]) {
  const parts: string[] = [];
  for (const d of [3, 4, 5, 6]) {
    const f = (rs: R[]) => rs.filter((r) => r.m && r.family === "R" && vdot(r) === v && r.days === d);
    const xa = f(A), xb = f(B);
    parts.push(`d${d} ${med(xa.map((r) => r.m.m4.maxKm))}/${med(xa.map((r) => r.m.m4.maxMin))}/${med(xa.map((r) => r.m.m4.pct))} → ${med(xb.map((r) => r.m.m4.maxKm))}/${med(xb.map((r) => r.m.m4.maxMin))}/${med(xb.map((r) => r.m.m4.pct))}`);
  }
  console.log(`  v${v}: ${parts.join("; ")}`);
}
console.log("\n## dugih sa blokom po dužini pripreme × dani (posle, sve porodice, medijana [min–max], n)");
for (const wk of [...new Set(B.map((r) => r.weeks))].sort((x, y) => x - y)) {
  const parts: string[] = [];
  for (const d of [3, 4, 5, 6]) { const xs = B.filter((r) => r.m && r.weeks === wk && r.days === d).map((r) => r.m.m4.withFast); if (xs.length) parts.push(`d${d} ${cell(xs)} n${xs.length}`); }
  console.log(`  ${wk} ned: ${parts.join("; ")}`);
}
const over = B.filter((r) => r.p2).flatMap((r) => (r.p2.fastAll as number[]).map((x, i) => [r.id, i, x] as const)).filter(([, , x]) => x > 25);
console.log(`\nnedelja (sve faze osim trkačke) sa > 25 % km bržih od E: ${over.length}${over.length ? " — " + over.slice(0, 20).map(([id, i, x]) => `${id}#${i + 1} ${x}%`).join(", ") : ""}`);
const types = B.filter((r) => r.p2).reduce((acc: Record<string, number>, r) => { acc[r.p2.types] = (acc[r.p2.types] ?? 0) + 1; return acc; }, {});
console.log(`niz tipova specifičnih ne-rasteretnih nedelja (${b}): ${JSON.stringify(types)}`);
const mpTot = (rs: R[]) => med(rs.filter((r) => r.m).map((r) => r.m.m3.totalKm));
console.log(`orijentir: ukupno MP medijana (R): ${mpTot(A.filter((r) => r.family === "R"))} → ${mpTot(B.filter((r) => r.family === "R"))}`);
const b60 = B.filter((r) => r.m && r.family === "R" && (r.p2?.peakKm ?? 0) >= 60);
console.log(`orijentir: R sa vrhom ≥ 60 km/ned, najveći blok ≥ 14 km: ${b60.filter((r) => Math.max(0, ...r.p2.blocks) >= 14).length}/${b60.length}`);
const v45 = B.filter((r) => r.m && r.family === "R" && vdot(r) >= 45);
console.log(`orijentir: R VDOT ≥ 45, najduži dugi ≥ 28 km: ${v45.filter((r) => r.m.m4.maxKm >= 28).length}/${v45.length}`);
if (process.argv[4] === "ids") console.log(changedIds.join("\n"));
