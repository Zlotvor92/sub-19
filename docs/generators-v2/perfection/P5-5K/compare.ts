/* P5 (5K) — poređenje raw-<a>.json i raw-<b>.json (measure.ts): odbijanja, testovi po planu po dužini pripreme i
   porodici, nedelja testa (faza, nedelja do trke), bajt-istost nedelja po klasi (nedelja testa / ostale), upozorenja,
   % km bržih od E po fazi, nedelje > 25 %. Iz web/: node ../docs/generators-v2/perfection/P5-5K/compare.ts pre posle */
import { readFileSync } from "node:fs";
const [A, B] = [process.argv[2] ?? "pre", process.argv[3] ?? "posle"];
const rd = (t: string) => JSON.parse(readFileSync(new URL(`./raw-${t}.json`, import.meta.url), "utf8")) as any[];
const a = new Map(rd(A).map((r) => [r.id, r])), b = new Map(rd(B).map((r) => [r.id, r]));
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const out: string[] = [];
const rej = (m: Map<string, any>) => [...m.values()].filter((r) => r.rejected).length;
out.push(`ulaza ${a.size}; odbijeno ${A} ${rej(a)} / ${B} ${rej(b)}; novo odbijeno: ${[...b.values()].filter((r) => r.rejected && !a.get(r.id)?.rejected).map((r) => r.id).join(", ") || "0"}`);
// testovi po porodici × dužini
const fam = (r: any) => r.family === "R" ? "R" : r.family;
for (const t of [A, B]) {
  const m = t === A ? a : b;
  const g: Record<string, Record<string, number[]>> = {};
  for (const r of m.values()) if (!r.rejected) ((g[fam(r)] ??= {})[r.weeks] ??= []).push(r.tests);
  out.push(`${t}: testova po planu (porodica: ned → [min–max] n)`);
  for (const [f, ws] of Object.entries(g)) out.push(`  ${f}: ` + Object.entries(ws).map(([w, xs]) => `${w}: ${Math.min(...xs)}–${Math.max(...xs)} (${xs.length})`).join("; "));
}
// test u R planovima posle
const rt = [...b.values()].filter((r) => !r.rejected && r.family === "R" && r.tests > 0);
out.push(`${B} R sa testom: ${rt.length}; faza ${JSON.stringify(rt.reduce((o: any, r) => (o[r.testPhase] = (o[r.testPhase] ?? 0) + 1, o), {}))}; ned. od testa do trke medijana ${med(rt.map((r) => r.toRace))} [${Math.min(...rt.map((r) => r.toRace))}–${Math.max(...rt.map((r) => r.toRace))}]; po dužini: ` +
  [10, 11, 12, 13, 14, 15, 16].map((w) => { const xs = rt.filter((r) => r.weeks === w).map((r) => r.toRace); return xs.length ? `${w}: ${Math.min(...xs)}–${Math.max(...xs)}` : ""; }).filter(Boolean).join("; "));
// bajt-istost po klasi
const cls: Record<string, { plans: number; same: number; weeksSame: number; weeksAll: number; diffIdx: Record<string, number> }> = {};
for (const [id, y] of b) {
  const x = a.get(id); if (!x || x.rejected || y.rejected) continue;
  const k = `${fam(y)}:${y.tests > x.tests ? "dobio test" : "bez promene testa"}`;
  const c = (cls[k] ??= { plans: 0, same: 0, weeksSame: 0, weeksAll: 0, diffIdx: {} });
  c.plans++;
  const tw = y.testWeek;
  let allSame = true;
  y.weekHash.forEach((h: string, i: number) => {
    const s = h === x.weekHash[i];
    if (!s) { allSame = false; const rel = tw ? (i + 1 === tw ? "test" : i + 1 < tw ? "pre testa" : "posle testa") : "—"; c.diffIdx[rel] = (c.diffIdx[rel] ?? 0) + 1; }
    c.weeksAll++; if (s) c.weeksSame++;
  });
  if (allSame) c.same++;
}
out.push("bajt-istost dana nedelja (klasa: planova, bajt-isti planovi, nedelje iste/sve, promenjene nedelje po mestu):");
for (const [k, c] of Object.entries(cls)) out.push(`  ${k}: ${c.plans}, ${c.same}, ${c.weeksSame}/${c.weeksAll}, ${JSON.stringify(c.diffIdx)}`);
// upozorenja
const wc = (m: Map<string, any>) => { const o: Record<string, number> = {}; for (const r of m.values()) for (const w of r.warnings ?? []) o[w] = (o[w] ?? 0) + 1; return o; };
const wa = wc(a), wb = wc(b);
out.push("upozorenja (planova) " + A + " → " + B + ": " + [...new Set([...Object.keys(wa), ...Object.keys(wb)])].sort().map((k) => `${k} ${wa[k] ?? 0}→${wb[k] ?? 0}`).join("; "));
// % brzih po fazi (R)
for (const t of [A, B]) {
  const m = t === A ? a : b;
  const ph: Record<string, number[]> = {}; let o25 = 0;
  for (const r of m.values()) if (!r.rejected && r.family === "R") { for (const [p, v] of r.fast) (ph[p] ??= []).push(v); o25 += r.over25; }
  out.push(`${t} R % km bržih od E (medijana nedelja): ` + Object.entries(ph).map(([p, v]) => `${p} ${med(v)}`).join(", ") + `; nedelja > 25 %: ${o25}`);
}
const peakDiff = [...b.values()].filter((r) => !r.rejected && a.get(r.id) && r.peak !== a.get(r.id).peak).length;
out.push(`vrh cilja promenjen: ${peakDiff} planova`);
console.log(out.join("\n"));
