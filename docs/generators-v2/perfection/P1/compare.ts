/* P1 — poređenje dve oznake measure.ts (pre / posle): metrike po grupi R/F/B, promenjeni planovi, nedelje bajt-iste.
   Iz web/: node ../docs/generators-v2/perfection/P1/compare.ts pre posle */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const [a, b] = [process.argv[2] ?? "pre", process.argv[3] ?? "posle"];
type R = { id: string; family: string; days: number; weeks: number; rejected?: string[]; m?: any; p1?: any; weeksJson?: string };
const A: R[] = JSON.parse(readFileSync(`${dir}raw-HM-${a}.json`, "utf8"));
const B: R[] = JSON.parse(readFileSync(`${dir}raw-HM-${b}.json`, "utf8"));
const byA = new Map(A.map((r) => [r.id, r]));
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const cell = (xs: number[]) => xs.length ? `${Math.round(med(xs) * 10) / 10} [${Math.min(...xs)}–${Math.max(...xs)}]` : "—";
const newRej = B.filter((r) => r.rejected && !byA.get(r.id)?.rejected);
console.log(`ulaza ${B.length}; odbijeno ${a} ${A.filter((r) => r.rejected).length}, ${b} ${B.filter((r) => r.rejected).length}; nova odbijanja ${newRej.length}`);
for (const r of newRej) console.log(`  NOVO ODBIJANJE ${r.id}: ${r.rejected!.join(" | ")}`);
let changed = 0; const changedIds: string[] = []; let baseDevSame = 0, baseDevTotal = 0;
for (const r of B) {
  const o = byA.get(r.id); if (!o?.weeksJson || !r.weeksJson) continue;
  if (o.weeksJson !== r.weeksJson) { changed++; changedIds.push(r.id); }
}
console.log(`promenjenih planova ${changed}/${B.filter((r) => r.m).length}`);
for (const fam of ["R", "F", "B", "ALL"]) {
  const ra = A.filter((r) => r.m && (fam === "ALL" || r.family === fam)), rb = B.filter((r) => r.m && (fam === "ALL" || r.family === fam));
  console.log(`\n## ${fam} (n ${ra.length} / ${rb.length})`);
  const rows: [string, (r: R) => number][] = [
    ["M3 najveći RP u jednom danu [km]", (r) => r.m.m3.maxKm],
    ["P1 najveći RP trening [km]", (r) => r.p1?.rpTrainMax ?? r.m.m3.maxKm],
    ["M3 ukupno RP u planu [km]", (r) => r.m.m3.totalKm],
    ["M4 dugih sa delom bržim od E", (r) => r.m.m4.withFast],
    ["P1 najveći blok [km]", (r) => Math.max(0, ...(r.p1?.blocks ?? []))],
    ["M7 specifična % km bržih od E", (r) => r.m.m7.specific ?? 0],
    ["P1 najduži dan nedelje [km]", (r) => r.p1?.longestDay ?? 0],
    ["M4 najduži dugi [km]", (r) => r.m.m4.maxKm],
    ["M4 plato dugog [ned]", (r) => r.m.m4.plateau],
  ];
  for (const [name, f] of rows) console.log(`| ${name} | ${cell(ra.map(f))} | ${cell(rb.map(f))} |`);
}
console.log("\n## dugih sa blokom po dužini pripreme × dani (posle, medijana [min–max], n)");
for (const wk of [...new Set(B.map((r) => r.weeks))].sort((x, y) => x - y)) {
  const parts: string[] = [];
  for (const d of [3, 4, 5, 6]) { const xs = B.filter((r) => r.m && r.weeks === wk && r.days === d).map((r) => r.m.m4.withFast); if (xs.length) parts.push(`d${d} ${cell(xs)} n${xs.length}`); }
  console.log(`  ${wk} ned: ${parts.join("; ")}`);
}
const hold = (rs: R[]) => rs.reduce((acc: Record<string, number>, r) => { const h = r.m?.hold?.RP; if (h) acc[h] = (acc[h] ?? 0) + 1; return acc; }, {});
console.log(`\nuzrok vrha RP (R): ${a} ${JSON.stringify(hold(A.filter((r) => r.family === "R")))}`);
console.log(`uzrok vrha RP (R): ${b} ${JSON.stringify(hold(B.filter((r) => r.family === "R")))}`);
const over = B.filter((r) => r.p1).flatMap((r) => (r.p1.fastPct as number[]).map((x, i) => [r.id, i, x] as const)).filter(([, , x]) => x > 25);
console.log(`nedelja specifične faze sa > 25 % km bržih od E: ${over.length}${over.length ? " — " + over.slice(0, 12).map(([id, i, x]) => `${id}#${i + 1} ${x}%`).join(", ") : ""}`);
const big = B.filter((r) => r.m && r.family === "R" && r.weeks >= 12);
console.log(`orijentir: planova ≥ 12 ned sa ≥ 2 duga sa blokom: ${big.filter((r) => r.m.m4.withFast >= 2).length}/${big.length}`);
const b50 = B.filter((r) => r.m && r.family === "R" && Number(/-(\d+)km-/.exec(r.id)?.[1]) >= 50);
console.log(`orijentir: R ≥ 50 km/ned, najveći RP trening ≥ 10 km: ${b50.filter((r) => (r.p1?.rpTrainMax ?? 0) >= 10).length}/${b50.length}`);
const types = B.filter((r) => r.p1).reduce((acc: Record<string, number>, r) => { acc[r.p1.types] = (acc[r.p1.types] ?? 0) + 1; return acc; }, {});
console.log(`niz tipova specifičnih ne-rasteretnih nedelja (posle): ${JSON.stringify(types)}`);
if (process.argv[4] === "ids") console.log(changedIds.join("\n"));
