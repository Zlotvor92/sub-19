/* P5-HM — poređenje dve oznake measure.ts. Iz web/: node ../docs/generators-v2/perfection/P5-HM/compare.ts pre posle */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const [a, b] = [process.argv[2] ?? "pre", process.argv[3] ?? "posle"];
type R = { id: string; family: string; days: number; weeks: number; rejected?: string[]; m?: any; p5?: any; weeksJson?: string[] };
const A: R[] = JSON.parse(readFileSync(`${dir}raw-${a}.json`, "utf8"));
const B: R[] = JSON.parse(readFileSync(`${dir}raw-${b}.json`, "utf8"));
const byA = new Map(A.map((r) => [r.id, r]));
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const cell = (xs: number[]) => xs.length ? `${Math.round(med(xs) * 10) / 10} [${Math.min(...xs)}–${Math.max(...xs)}]` : "—";
const newRej = B.filter((r) => r.rejected && !byA.get(r.id)?.rejected);
console.log(`ulaza ${B.length}; odbijeno ${a} ${A.filter((r) => r.rejected).length}, ${b} ${B.filter((r) => r.rejected).length}; nova odbijanja ${newRej.length}`);
for (const r of newRej) console.log(`  NOVO ODBIJANJE ${r.id}: ${r.rejected!.join(" | ")}`);
let changed = 0, weeksSame = 0, weeksAll = 0;
for (const r of B) { const o = byA.get(r.id); if (!o?.weeksJson || !r.weeksJson) continue; if (o.weeksJson.join() !== r.weeksJson.join()) changed++; r.weeksJson.forEach((w, i) => { weeksAll++; if (o.weeksJson![i] === w) weeksSame++; }); }
console.log(`promenjenih planova ${changed}/${B.filter((r) => r.m).length}; nedelja bajt-istih ${weeksSame}/${weeksAll}`);
for (const fam of ["R", "F", "B"]) {
  const ra = A.filter((r) => r.m && r.family === fam), rb = B.filter((r) => r.m && r.family === fam);
  console.log(`\n## ${fam} (n ${ra.length} / ${rb.length})   | metrika | ${a} | ${b} |`);
  const rows: [string, (r: R) => number | null][] = [
    ["testova po planu", (r) => r.p5.tests],
    ["ned. od testa do trke", (r) => r.p5.weeksTestToRace],
    ["T rad prvi [min]", (r) => r.m.m1.T?.firstMin ?? null],
    ["I rad prvi [min]", (r) => r.m.m1.I?.firstMin ?? null],
    ["udeo rada prvog kval. dana [%]", (r) => r.m.m2.first === null ? null : Math.round(r.m.m2.first * 100)],
    ["T rad najveći [min]", (r) => r.m.m1.T?.maxMin ?? null],
    ["I rad najveći [min]", (r) => r.m.m1.I?.maxMin ?? null],
    ["laganih dana sa ubrzanjima", (r) => r.p5.strideDays],
    ["% brzih: baza (sa ubrz.)", (r) => r.p5.m7.base?.with ?? null],
    ["% brzih: baza (bez ubrz.)", (r) => r.p5.m7.base?.without ?? null],
    ["% brzih: razvoj (sa)", (r) => r.p5.m7.development?.with ?? null],
    ["% brzih: specifična (sa)", (r) => r.p5.m7.specific?.with ?? null],
    ["% brzih: taper (sa)", (r) => r.p5.m7.taper?.with ?? null],
    ["nedelja izgradnje > 25 % brzih", (r) => r.p5.over25.length],
    ["vrh obima [km]", (r) => r.p5.peakKm],
    ["WEEK_FITTED po planu", (r) => r.p5.fitted],
    ["ukupno RP [km]", (r) => r.m.m3.totalKm],
  ];
  for (const [n, f] of rows) { const fa = ra.map(f).filter((x): x is number => x !== null), fb = rb.map(f).filter((x): x is number => x !== null); console.log(`| ${n} | ${cell(fa)} | ${cell(fb)} |`); }
  const fitP = (rs: R[]) => rs.filter((r) => r.p5.fitted > 0).length;
  console.log(`| planova sa WEEK_FITTED | ${fitP(ra)} | ${fitP(rb)} |`);
  console.log(`| planova sa ned. 1 < trenutni obim | ${ra.filter((r) => r.p5.week1Km < r.p5.startKm - 0.05).length} | ${rb.filter((r) => r.p5.week1Km < r.p5.startKm - 0.05).length} |`);
  console.log(`| planova sa promenjenim vrhom | — | ${rb.filter((r) => byA.get(r.id)?.p5?.peakKm !== r.p5.peakKm).length} |`);
}
console.log("\n## test po dužini pripreme (R, " + b + "): nedelja testa / do trke / faza");
for (const wk of [...new Set(B.map((r) => r.weeks))].sort((x, y) => x - y)) {
  const rs = B.filter((r) => r.m && r.family === "R" && r.weeks === wk);
  console.log(`  ${wk} ned: testova ${cell(rs.map((r) => r.p5.tests))}, ned. testa ${cell(rs.filter((r) => r.p5.testWeek).map((r) => r.p5.testWeek))}, do trke ${cell(rs.filter((r) => r.p5.testWeek).map((r) => r.p5.weeksTestToRace))}, faze ${[...new Set(rs.flatMap((r) => r.p5.testPhase))].join(",")}`);
}
const ov = B.filter((r) => r.p5).flatMap((r) => r.p5.over25.map((o: any) => `${r.id}#${o.w} ${o.phase} ${o.pct}% (bez ubrz. ${o.noStr}%)`));
const ovA = new Set(A.filter((r) => r.p5).flatMap((r) => r.p5.over25.map((o: any) => `${r.id}#${o.w}`)));
console.log(`\nnedelje izgradnje > 25 %: ${a} ${ovA.size}, ${b} ${ov.length}; nove: ${ov.filter((x) => !ovA.has(x.split(" ")[0]!)).slice(0, 30).join("; ")}`);
const noStr = (rs: R[]) => rs.filter((r) => r.p5).flatMap((r) => r.p5.over25.filter((o: any) => o.noStr > 25)).length;
console.log(`nedelje izgradnje > 25 % brzih BEZ ubrzanja: ${a} ${noStr(A)}, ${b} ${noStr(B)}; > 30 %: ${a} ${A.filter((r) => r.p5).flatMap((r) => r.p5.over25.filter((o: any) => o.pct > 30)).length}, ${b} ${B.filter((r) => r.p5).flatMap((r) => r.p5.over25.filter((o: any) => o.pct > 30)).length}`);
