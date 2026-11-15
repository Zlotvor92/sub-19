/* K3-HM — zbir jednog snimka po grupi (porodica × dani): koliko planova krši svako K3 pravilo.
   node docs/generators-v2/perfection/K3-HM/sum.ts <oznaka> */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const S = JSON.parse(readFileSync(`${dir}snap-${process.argv[2]}.json`, "utf8"));
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const G: Record<string, any[]> = {};
let rej = 0;
for (const [id, y] of Object.entries(S) as [string, any][]) { if (!y.ok) { rej++; continue; } (G[`${y.fam}-d${y.days}`] ??= []).push({ id, ...y.m }); }
console.log("odbijanja", rej);
const all = Object.values(G).flat();
const fast = all.filter((m) => (m.vdot ?? 0) >= 50 && m.peak >= 80);
console.log(`K3-E brzi (VDOT ≥ 50, vrh ≥ 80): n ${fast.length}, blok medijana ${med(fast.map((m) => m.blockKm))} km, max ${Math.max(0, ...fast.map((m) => m.blockKm))}; nizovi:`, [...new Set(fast.map((m) => m.blocks))].slice(0, 8).join(" | "));
for (const [g, L] of Object.entries(G).sort()) {
  const n = L.length;
  const c = (f: (m: any) => boolean) => L.filter(f).length;
  console.log(`${g}: n ${n} | A najduži ne u posl.3 ${c((m) => !m.longestInLast3)}, pad spec ${c((m) => m.specDrop > 0.05)} (max ${Math.max(...L.map((m) => m.specDrop))}), >45% u >3 ned ${c((m) => m.share45 > 3)}`
    + ` | B taper>60% ${c((m) => m.taperShare > 0.6 + 1e-9)} (med RP ${med(L.filter((m) => m.taperRp > 0).map((m) => m.taperRp))} min, max ${Math.max(...L.map((m) => m.taperRp))})`
    + ` | C lagan/dugi med ${med(L.map((m) => m.easyLong))} max ${Math.max(...L.map((m) => m.easyLong))}, ista doza >2 ${c((m) => m.sameRun > 2)}`
    + ` | D najteža=posl.pre tapera(≤85%: ${c((m) => m.lastPreShare <= 0.85 + 1e-9)}), od trke med ${med(L.map((m) => m.hardFromRace))}`
    + ` | F na plafonu >3 zaredom ${c((m) => m.topRun > 3)}, >4 puta ${c((m) => m.atTop > 4)}`
    + ` | G lagan<30min >2 ned ${c((m) => m.shortEasy > 2)}, test>2× ${c((m) => m.testRatio > 2)}`);
}
