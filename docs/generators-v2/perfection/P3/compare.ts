/* P3 — poređenje oznaka measure.ts: metrike po porodici R/F/B, nedelja B koja ne staje po grupi, promenjeni planovi,
   nizovi tipova, nedelje > 25 % km bržih od E, uzrok vrha RP, orijentiri. Iz web/:
   node ../docs/generators-v2/perfection/P3/compare.ts pre posle [ids] */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const [a, b] = [process.argv[2] ?? "pre", process.argv[3] ?? "posle"];
type R = { id: string; family: string; days: number; weeks: number; km: number; rejected?: string[]; m?: any; p3?: any; weeksJson?: string };
const A: R[] = JSON.parse(readFileSync(`${dir}raw-10K-${a}.json`, "utf8"));
const B: R[] = JSON.parse(readFileSync(`${dir}raw-10K-${b}.json`, "utf8"));
const byA = new Map(A.map((r) => [r.id, r]));
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const r1 = (x: number) => Math.round(x * 10) / 10;
const cell = (xs: number[]) => xs.length ? `${r1(med(xs))} [${r1(Math.min(...xs))}–${r1(Math.max(...xs))}]` : "—";
const newRej = B.filter((r) => r.rejected && !byA.get(r.id)?.rejected);
console.log(`ulaza ${B.length}; odbijeno ${a} ${A.filter((r) => r.rejected).length}, ${b} ${B.filter((r) => r.rejected).length}; nova odbijanja ${newRej.length}`);
for (const r of newRej) console.log(`  NOVO ODBIJANJE ${r.id}: ${r.rejected!.join(" | ")}`);
const changed = B.filter((r) => r.weeksJson && byA.get(r.id)?.weeksJson && byA.get(r.id)!.weeksJson !== r.weeksJson);
const byCls: Record<string, number> = {}; const totCls: Record<string, number> = {};
for (const r of B.filter((x) => x.m)) { const k = `${r.family} ${r.days} d`; totCls[k] = (totCls[k] ?? 0) + 1; }
for (const r of changed) { const k = `${r.family} ${r.days} d`; byCls[k] = (byCls[k] ?? 0) + 1; }
console.log(`promenjenih planova ${changed.length}/${B.filter((r) => r.m).length}: ${Object.keys(totCls).sort().map((k) => `${k} ${byCls[k] ?? 0}/${totCls[k]}`).join(", ")}`);
const fastSpec = (r: R) => (r.p3?.fastPct ?? []).filter((x: any) => x.ph === "specific").map((x: any) => x.pct);
for (const fam of ["R", "F", "B"]) {
  const ra = A.filter((r) => r.m && r.family === fam), rb = B.filter((r) => r.m && r.family === fam);
  console.log(`\n## ${fam} (n ${ra.length} / ${rb.length}) | ${a} | ${b} |`);
  const rows: [string, (r: R) => number][] = [
    ["najveći RP trening [km]", (r) => r.p3.rpTrainMax],
    ["najveći RP trening, % trke", (r) => r.p3.rpTrainMax * 10],
    ["ukupno RP u planu [km] (M3)", (r) => r.m.m3.totalKm],
    ["I minuti u specifičnoj fazi", (r) => r.p3.iSpecMin],
    ["I rad najveći [min] (M1)", (r) => r.m.m1.I?.maxMin ?? 0],
    ["T rad najveći [min] (M1)", (r) => r.m.m1.T?.maxMin ?? 0],
    ["M7 baza % km bržih od E", (r) => r.m.m7.base ?? 0],
    ["M7 razvoj", (r) => r.m.m7.development ?? 0],
    ["M7 specifična", (r) => r.m.m7.specific ?? 0],
    ["M7 taper", (r) => r.m.m7.taper ?? 0],
    ["vrh cilja [km]", (r) => r.p3.peakTarget],
    ["nedelja pouke 35 (drugi kvalitet lagan)", (r) => r.p3.p35],
  ];
  for (const [name, f] of rows) console.log(`| ${name} | ${cell(ra.map(f))} | ${cell(rb.map(f))} |`);
}
console.log("\n## nedelja B koja ne staje (redovan plan 4–6 d): planova sa takvom nedeljom / planova; nedelja");
for (const fam of ["R", "F"]) for (const d of [4, 5, 6]) {
  const rs = B.filter((r) => r.p3 && r.family === fam && r.days === d);
  const n = rs.filter((r) => r.p3.bNotFit > 0).length;
  console.log(`  ${fam} ${d} d: ${n}/${rs.length} (${Math.round((100 * n) / rs.length)} %), nedelja ${rs.reduce((s, r) => s + r.p3.bNotFit, 0)}`);
}
const types = B.filter((r) => r.p3 && r.days >= 4 && r.family !== "B").reduce((acc: Record<string, number>, r) => { acc[r.p3.types] = (acc[r.p3.types] ?? 0) + 1; return acc; }, {});
console.log(`niz tipova (R+F 4–6 d; a = bez Q2): ${JSON.stringify(types)}`);
const hold = (rs: R[]) => rs.reduce((acc: Record<string, number>, r) => { const h = r.m?.hold?.RP; if (h) acc[h] = (acc[h] ?? 0) + 1; return acc; }, {});
console.log(`uzrok vrha RP (R): ${a} ${JSON.stringify(hold(A.filter((r) => r.family === "R")))}`);
console.log(`uzrok vrha RP (R): ${b} ${JSON.stringify(hold(B.filter((r) => r.family === "R")))}`);
for (const [t, X] of [[a, A], [b, B]] as const) {
  const over = X.filter((r) => r.p3).flatMap((r) => (r.p3.fastPct as any[]).filter((x) => x.pct > 25).map((x) => `${r.id}#${x.w} ${x.ph} ${x.pct}%`));
  console.log(`nedelja > 25 % km bržih od E (${t}): ${over.length}${over.length ? " — " + over.slice(0, 10).join(", ") : ""}`);
}
const big = (X: R[]) => X.filter((r) => r.m && r.family === "R" && r.km >= 40);
console.log(`orijentir R ≥ 40 km/ned, najveći RP trening ≥ 6 km: ${a} ${big(A).filter((r) => r.p3.rpTrainMax >= 6).length}/${big(A).length}, ${b} ${big(B).filter((r) => r.p3.rpTrainMax >= 6).length}/${big(B).length}`);
console.log(`orijentir R ukupno RP medijana ≥ 22 km: ${a} ${med(A.filter((r) => r.m && r.family === "R").map((r) => r.m.m3.totalKm))}, ${b} ${med(B.filter((r) => r.m && r.family === "R").map((r) => r.m.m3.totalKm))}`);
const W = (X: R[]) => new Set(X.flatMap((r) => r.p3?.warnings ?? []));
console.log(`nova upozorenja (pravila): ${[...W(B)].filter((x) => !W(A).has(x)).join(", ") || "—"}`);
if (process.argv[4] === "ids") console.log(changed.map((r) => r.id).join("\n"));
