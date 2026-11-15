/* P0 — „šta drži dozu" po distanci × dani (sve porodice R/F/B zajedno) iz raw-<D>.json. Iz web/:
   node ../docs/generators-v2/perfection/P0/hold.ts > ../docs/generators-v2/perfection/P0/hold.md */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const SHORT: Record<string, string> = {
  "plafon udela zone": "plafon", "kraj lestvice": "kraj lestvice", "≤ 1 nivo nedeljno (faza se završila)": "≤1/ned+kraj faze",
  "≤ 1 korak nedeljno (faza se završila)": "≤1/ned+kraj faze", "prelaz faze (faza se završila)": "prelaz bez rasta",
  "početni nivo 60 % (faza se završila)": "start 60 % bez rasta", "dan ≤ dugi (pouka 32)": "pouka 32",
  "korak +0,5 km nedeljno / izbor faze": "korak T +0,5", "plafon trajanja T bloka faze": "plafon trajanja T",
  "kraj ponude (maxReps / trajanje ponavljanja)": "kraj ponude", "pad doze (kapacitet / pouka 32)": "pad doze",
};
console.log("| D | dani | zona | n | uzroci (% planova) |\n|---|---|---|---|---|");
for (const D of ["5K", "10K", "HM", "MAR"]) {
  const rows = JSON.parse(readFileSync(`${dir}raw-${D}.json`, "utf8")) as { days: number; m?: { hold: Record<string, string> } }[];
  for (const days of [3, 4, 5, 6]) {
    const rs = rows.filter((r) => r.m && r.days === days);
    if (!rs.length) continue;
    for (const z of ["T", "I", "R", "RP"]) {
      const c: Record<string, number> = {};
      for (const r of rs) { const h = r.m!.hold[z]; if (h) c[SHORT[h] ?? h] = (c[SHORT[h] ?? h] ?? 0) + 1; }
      const n = Object.values(c).reduce((a, b) => a + b, 0);
      if (n) console.log(`| ${D} | ${days} | ${z === "RP" && D === "MAR" ? "MP" : z} | ${n} | ${Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((100 * v) / n)}`).join("; ")} |`);
    }
  }
}
