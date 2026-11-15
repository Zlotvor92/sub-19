/* P4 — poređenje oznaka measure.ts (5K). Iz web/: node ../docs/generators-v2/perfection/P4/compare.ts pre posle
   Ispis: odbijanja, promenjeni planovi po klasi, metrike po porodici (samo mreža P0, i mreža V), uzrok vrha I/RP (R) i
   po osećaju/početnik (S3), nedelje > 25 % km bržih od E, S2 provere (kratke I/RP deonice, oporavak > 2 × rad, dan
   kvaliteta duži od dugog), upozorenja. */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const [a, b] = [process.argv[2] ?? "pre", process.argv[3] ?? "posle"];
type R = { id: string; net: string; family: string; days: number; weeks: number; km: number; vdot: number | null; rejected?: string[]; m?: any; p4?: any; weeksJson?: string };
const A: R[] = JSON.parse(readFileSync(`${dir}raw-5K-${a}.json`, "utf8"));
const B: R[] = JSON.parse(readFileSync(`${dir}raw-5K-${b}.json`, "utf8"));
const byA = new Map(A.map((r) => [r.id, r]));
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const r1 = (x: number) => Math.round(x * 10) / 10;
const cell = (xs: number[]) => xs.length ? `${r1(med(xs))} [${r1(Math.min(...xs))}–${r1(Math.max(...xs))}]` : "—";
const newRej = B.filter((r) => r.rejected && !byA.get(r.id)?.rejected);
console.log(`ulaza ${B.length}; odbijeno ${a} ${A.filter((r) => r.rejected).length}, ${b} ${B.filter((r) => r.rejected).length}; nova odbijanja ${newRej.length}; greške ${B.filter((r: any) => r.error).length}`);
for (const r of newRej) console.log(`  NOVO ODBIJANJE ${r.id}: ${r.rejected!.join(" | ")}`);
const both = B.filter((r) => r.weeksJson && byA.get(r.id)?.weeksJson);
const changed = both.filter((r) => byA.get(r.id)!.weeksJson !== r.weeksJson);
const byCls: Record<string, number> = {}; const totCls: Record<string, number> = {};
for (const r of both) { const k = `${r.net} ${r.family} ${r.days} d`; totCls[k] = (totCls[k] ?? 0) + 1; }
for (const r of changed) { const k = `${r.net} ${r.family} ${r.days} d`; byCls[k] = (byCls[k] ?? 0) + 1; }
console.log(`promenjenih planova (oba ok) ${changed.length}/${both.length}: ${Object.keys(totCls).sort().map((k) => `${k} ${byCls[k] ?? 0}/${totCls[k]}`).join(", ")}`);
const rpPct = (r: R) => r.p4.rpTrainMax * 20;
const rows: [string, (r: R) => number | null][] = [
  ["I rad prvi [min]", (r) => r.m.m1.I?.firstMin ?? null],
  ["I rad najveći [min]", (r) => r.m.m1.I?.maxMin ?? null],
  ["RP rad prvi [min]", (r) => r.m.m1.RP?.firstMin ?? null],
  ["RP rad najveći [min]", (r) => r.m.m1.RP?.maxMin ?? null],
  ["R rad najveći [min]", (r) => r.m.m1.R?.maxMin ?? null],
  ["T rad najveći [min]", (r) => r.m.m1.T?.maxMin ?? null],
  ["najveći RP trening [km]", (r) => r.p4.rpTrainMax],
  ["najveći RP trening, % trke", rpPct],
  ["ukupno RP u planu [km]", (r) => r.m.m3.totalKm],
  ["M2 udeo rada, dan najvećeg rada [%]", (r) => r.m.m2.atMax],
  ["M4 najduži dugi [km]", (r) => r.m.m4.maxKm],
  ["M7 baza %", (r) => r.m.m7.base ?? null],
  ["M7 vrhunac %", (r) => r.m.m7.peak ?? null],
  ["M7 oštrenje %", (r) => r.m.m7.sharpen ?? null],
  ["M7 taper %", (r) => r.m.m7.taper ?? null],
];
const fam = (X: R[], net: string, f: string, extra: (r: R) => boolean = () => true) => X.filter((r) => r.m && r.net === net && r.family === f && extra(r));
for (const [net, f, label, ex] of [["P0", "R", "P0 R (VDOT 35/45/55)", (r: R) => (r.vdot ?? 0) <= 60], ["P0", "R", "P0 R VDOT 65", (r: R) => (r.vdot ?? 0) > 60], ["P0", "F", "P0 F", () => true], ["P0", "B", "P0 B", () => true], ["G", "R", "G R (4–5 d, 30–65 km)", () => true]] as const) {
  const ra = fam(A, net, f, ex), rb = fam(B, net, f, ex);
  console.log(`\n## ${label} (n ${ra.length} / ${rb.length}) | ${a} | ${b} |`);
  for (const [name, fn] of rows) { const xa = ra.map(fn).filter((v): v is number => v !== null), xb = rb.map(fn).filter((v): v is number => v !== null); console.log(`| ${name} | ${cell(xa)} | ${cell(xb)} |`); }
}
const holdTab = (X: R[], keys: string[], filt: (r: R) => boolean) => {
  const out: Record<string, Record<string, number>> = {};
  for (const r of X.filter((x) => x.p4 && filt(x))) for (const k of keys) { const h = r.p4.hold[k]; if (h) (out[k] ??= {})[h] = (out[k]![h] ?? 0) + 1; }
  return out;
};
for (const [t, X] of [[a, A], [b, B]] as const) {
  console.log(`\nuzrok vrha I/RP, R (P0+G+V) ${t}: ${JSON.stringify(holdTab(X, ["I", "RP"], (r) => r.family === "R"))}`);
  for (const d of [3, 4, 5]) console.log(`  ${d} d: ${JSON.stringify(holdTab(X, ["I", "RP"], (r) => r.family === "R" && r.days === d))}`);
}
console.log(`\nS3 uzrok doze po osećaju / početnik (${b}); step = ≤ 1 korak/kraj faze, budget = plafon udela, offer = kraj ponude`);
for (const f of ["F", "B"]) for (const d of [3, 4, 5]) {
  const rs = B.filter((r) => r.p4 && r.family === f && r.days === d);
  if (!rs.length) continue;
  console.log(`  ${f} ${d} d (n ${rs.length}): ${JSON.stringify(holdTab(rs, ["HILLS", "TEMPO", "FARTLEK_I", "FARTLEK_T", "FARTLEK_RP", "RP_SHORT"], () => true))}`);
}
console.log(`S3 isto (${a}): F ${JSON.stringify(holdTab(A, ["HILLS", "TEMPO", "FARTLEK_I", "FARTLEK_RP"], (r) => r.family === "F"))}; B ${JSON.stringify(holdTab(A, ["HILLS", "FARTLEK_T", "FARTLEK_RP", "RP_SHORT"], (r) => r.family === "B"))}`);
for (const [t, X] of [[a, A], [b, B]] as const) {
  const over = X.filter((r) => r.p4).flatMap((r) => (r.p4.fastPct as any[]).filter((x) => x.pct > 25).map((x) => `${r.id}#${x.w} ${x.ph} ${x.pct}%`));
  console.log(`\nnedelja > 25 % km bržih od E (${t}): ${over.length}${over.length ? " — " + over.join(", ") : ""}`);
}
for (const [t, X] of [[a, A], [b, B]] as const) {
  const ok = X.filter((r) => r.p4);
  console.log(`S2/STOP (${t}): I/RP deonica < 60 s: ${ok.filter((r) => r.p4.short.length).length} planova; oporavak > 2 × rad (bez R): ${ok.filter((r) => r.p4.recRatio.length).length} planova ${[...new Set(ok.flatMap((r) => r.p4.recRatio.map((x: string) => x.split(":")[1])))].join(",")}; dan kvaliteta duži od dugog po trajanju (van trkačke): ${ok.filter((r) => r.p4.qLonger.length).length} planova, bez upozorenja ${ok.filter((r) => r.p4.qLonger.some((x: string) => x.endsWith("BEZ"))).length} (${ok.filter((r) => r.p4.qLonger.some((x: string) => x.endsWith("BEZ"))).map((r) => r.id + "#" + r.p4.qLonger.join("/")).join(", ")})`);
  const w: Record<string, number> = {}; for (const r of ok) for (const c of r.p4.warnings) w[c] = (w[c] ?? 0) + 1;
  console.log(`  upozorenja (planova): ${JSON.stringify(w)}`);
}
const V = B.filter((r) => r.p4 && r.net === "V");
console.log(`\nmreža V (VDOT 62–70, ${b}): ${V.length} planova; I najveći ${cell(V.map((r) => r.m.m1.I?.maxMin ?? 0))} min; RP trening ${cell(V.map((r) => r.p4.rpTrainMax))} km; dugi ${cell(V.map((r) => r.m.m4.maxKm))} km / ${cell(V.map((r) => r.m.m4.maxMin))} min`);
const orA = fam(A, "P0", "R", (r) => (r.vdot ?? 0) <= 60), orB = fam(B, "P0", "R", (r) => (r.vdot ?? 0) <= 60);
console.log(`orijentir: najveći RP trening ≥ 3 km medijana (P0 R ≤ 60): ${a} ${med(orA.map((r) => r.p4.rpTrainMax))}, ${b} ${med(orB.map((r) => r.p4.rpTrainMax))}`);
