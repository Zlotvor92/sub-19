/* P5-MAR — poređenje dve oznake measure.ts: odbijanja, promenjeni planovi, metrike P5 po porodici R/F/B.
   Iz web/: node ../docs/generators-v2/perfection/P5-MAR/compare.ts pre posle */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const [a, b] = [process.argv[2] ?? "pre", process.argv[3] ?? "posle"];
type R = {
  id: string;
  family: string;
  days: number;
  weeks: number;
  km: number;
  rejected?: string[];
  m?: any;
  p5?: any;
  weeksJson?: string;
};
const A: R[] = JSON.parse(readFileSync(`${dir}raw-${a}.json`, "utf8"));
const B: R[] = JSON.parse(readFileSync(`${dir}raw-${b}.json`, "utf8"));
const byA = new Map(A.map((r) => [r.id, r]));
const med = (xs: number[]) => {
  const s = [...xs].sort((x, y) => x - y);
  return s.length
    ? s.length % 2
      ? s[(s.length - 1) / 2]!
      : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2
    : NaN;
};
const r1 = (x: number) => Math.round(x * 10) / 10;
const cell = (xs: number[]) =>
  xs.length
    ? `${r1(med(xs))} [${r1(Math.min(...xs))}–${r1(Math.max(...xs))}]`
    : "—";
const sum = (xs: number[]) => xs.reduce((x, y) => x + y, 0);
const newRej = B.filter((r) => r.rejected && !byA.get(r.id)?.rejected);
console.log(
  `ulaza ${B.length}; odbijeno ${a} ${A.filter((r) => r.rejected).length}, ${b} ${B.filter((r) => r.rejected).length}; nova odbijanja ${newRej.length}`,
);
for (const r of newRej)
  console.log(`  NOVO ODBIJANJE ${r.id}: ${r.rejected!.join(" | ")}`);
const changed = B.filter((r) => {
  const o = byA.get(r.id);
  return o?.weeksJson && r.weeksJson && o.weeksJson !== r.weeksJson;
});
console.log(
  `promenjenih planova ${changed.length}/${B.filter((r) => r.m).length}`,
);
for (const fam of ["R", "F", "B"]) {
  const ra = A.filter((r) => r.m && r.family === fam),
    rb = B.filter((r) => r.m && r.family === fam);
  console.log(
    `\n## ${fam} (n ${ra.length} / ${rb.length})\n| metrika | ${a} | ${b} |\n|---|---|---|`,
  );
  const rows: [string, (r: R) => number | null][] = [
    ["testova po planu", (r) => r.p5.testWeeks.length],
    ["nedelja od testa do trke", (r) => r.p5.testWeeks[0]?.toRace ?? null],
    ["T rad prvi [min]", (r) => r.p5.firstT?.min ?? null],
    ["I rad prvi [min]", (r) => r.p5.firstI?.min ?? null],
    ["rad kvaliteta nedelje 1 [min]", (r) => r.p5.w1Work],
    [
      "udeo rada prvog kval. dana [%]",
      (r) => (r.m.m2.first === null ? null : Math.round(r.m.m2.first * 100)),
    ],
    ["T rad najveći [min]", (r) => r.m.m1.T?.maxMin ?? null],
    ["I rad najveći [min]", (r) => r.m.m1.I?.maxMin ?? null],
    ["laganih dana sa ubrzanjima", (r) => r.p5.strideDays],
    [
      "nedelja sa ubrzanjima / nedelja bez trkačke",
      (r) =>
        r.p5.buildTaperWeeks
          ? Math.round((100 * r.p5.strideWeeks) / r.p5.buildTaperWeeks)
          : null,
    ],
    ["% brzih km baza", (r) => r.p5.fastByPhase.base ?? null],
    ["% brzih km razvoj", (r) => r.p5.fastByPhase.development ?? null],
    ["% brzih km specifična", (r) => r.p5.fastByPhase.specific ?? null],
    ["% brzih km taper", (r) => r.p5.fastByPhase.taper ?? null],
    ["nedelja > 25 % brzih km", (r) => r.p5.over25],
    ["vrh obima [km]", (r) => r.p5.peakKm],
    ["ukupno MP [km]", (r) => r.m.m3.totalKm],
    ["nedelja WEEK_FITTED", (r) => r.p5.fittedWeeks],
  ];
  for (const [n, f] of rows) {
    const xa = ra.map(f).filter((x): x is number => x !== null),
      xb = rb.map(f).filter((x): x is number => x !== null);
    console.log(
      `| ${n} | ${cell(xa)} (Σ ${r1(sum(xa))}) | ${cell(xb)} (Σ ${r1(sum(xb))}) |`,
    );
  }
  console.log(
    `| planova sa WEEK_FITTED | ${ra.filter((r) => r.p5.fittedWeeks > 0).length} | ${rb.filter((r) => r.p5.fittedWeeks > 0).length} |`,
  );
  console.log(
    `| nedelja 1 ispod cilja | ${ra.filter((r) => r.p5.w1Under).length} | ${rb.filter((r) => r.p5.w1Under).length} |`,
  );
  console.log(
    `| vrh obima promenjen | — | ${rb.filter((r) => byA.get(r.id)?.p5?.peakKm !== r.p5.peakKm).length} |`,
  );
}
