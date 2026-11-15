/* K3-HM — samo merenje (K3-D, K3-F, K3-G, blok u dugom za 3 dana) nad snimkom snap.ts, po porodici × dani.
   node docs/generators-v2/perfection/K3-HM/open.ts <oznaka> */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const S = JSON.parse(readFileSync(`${dir}snap-${process.argv[2]}.json`, "utf8"));
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const G: Record<string, any[]> = {};
for (const y of Object.values(S) as any[]) if (y.ok) (G[`${y.fam}-d${y.days}`] ??= []).push(y.m);
let tot = { n: 0, d3: 0, d85: 0, f: 0, f4: 0, g: 0, t: 0, tn: 0 };
for (const [g, L] of Object.entries(G).sort()) {
  const c = (f: (m: any) => boolean) => L.filter(f).length;
  const hard3 = c((m) => m.hardFromRace === 3), le85 = c((m) => m.lastPreShare <= 0.85 + 1e-9);
  const f = c((m) => m.topRun > 3), f4 = c((m) => m.atTop > 4);
  const ge = c((m) => m.shortEasy > 2), withTest = L.filter((m) => m.testRatio > 0), t2 = withTest.filter((m) => m.testRatio > 2).length;
  Object.assign(tot, { n: tot.n + L.length, d3: tot.d3 + hard3, d85: tot.d85 + le85, f: tot.f + f, f4: tot.f4 + f4, g: tot.g + ge, t: tot.t + t2, tn: tot.tn + withTest.length });
  let extra = "";
  if (g.endsWith("d3")) {
    const weeks = L.flatMap((m) => (m.spec3 ? m.spec3.split(",") : [])).map((x: string) => x.split(":").map(Number));
    extra = ` | 3 dana spec: nedelja ${weeks.length}, dugi med ${med(weeks.map((x: number[]) => x[0]))} km, RP usred med ${med(weeks.map((x: number[]) => x[1]))} min`;
  }
  console.log(`${g}: n ${L.length} | D najteža 3 ned pred trku ${hard3}, posl. pred taper ≤ 85 % ${le85}, najteža od trke med ${med(L.map((m) => m.hardFromRace))}`
    + ` | F dugi na plafonu > 3 ne-rast. zaredom ${f}, > 4 puta ${f4}, niz med ${med(L.map((m) => m.topRun))}`
    + ` | G lagan < 30 min u > 2 ned ${ge}; test > 2 × najveća doza ${t2}/${withTest.length} (odnos med ${med(withTest.map((m) => m.testRatio))})${extra}`);
}
console.log("ukupno", JSON.stringify(tot));
