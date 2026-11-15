/* P0 — tabele iz summary-<D>.json (posle measure.ts). Iz web/: node ../docs/generators-v2/perfection/P0/tables.ts > ../docs/generators-v2/perfection/P0/tables.md
   Ćelija: medijana [min–max]; „—" = zona/metrika nema plan u grupi. */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
type A = { med: number; min: number; max: number; n: number } | null;
const f = (a: A) => (a ? `${fmt(a.med)} [${fmt(a.min)}–${fmt(a.max)}]` : "—");
const fmt = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");
const pct = (a: A) => (a ? `${Math.round(a.med * 100)} [${Math.round(a.min * 100)}–${Math.round(a.max * 100)}]` : "—");
const out: string[] = [];
for (const D of ["5K", "10K", "HM", "MAR"]) {
  const s = JSON.parse(readFileSync(`${dir}summary-${D}.json`, "utf8"));
  const G = s.groups as Record<string, Record<string, unknown>>;
  const keys = Object.keys(G).filter((k) => k !== "ALL|all|all").sort((a, b) => (a.split("|")[0] === b.split("|")[0] ? (a < b ? -1 : 1) : ["R", "F", "B"].indexOf(a[0]!) - ["R", "F", "B"].indexOf(b[0]!)));
  const rk = (k: string) => k.replace("|all|all", " sve").replace(/\|/g, " ");
  out.push(`\n## ${D} (${s.policyVersions.join(", ")}; ulaza ${s.inputs}, planova ${s.ok}, odbijeno ${s.rejected.length})\n`);
  out.push("### M1 radni minuti po treningu (prva nedelja zone / najveći) i M2 udeo rada u danu [%]\n");
  out.push("| grupa | n | T prvi | T max | I prvi | I max | R prvi | R max | RP/MP prvi | RP/MP max | M2 prvi | M2 vrh |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const k of keys) { const g = G[k]! as Record<string, A>; out.push(`| ${rk(k)} | ${g["n"]} | ${f(g["M1_T_first"])} | ${f(g["M1_T_max"])} | ${f(g["M1_I_first"])} | ${f(g["M1_I_max"])} | ${f(g["M1_R_first"])} | ${f(g["M1_R_max"])} | ${f(g["M1_RP_first"])} | ${f(g["M1_RP_max"])} | ${pct(g["M2_first"])} | ${pct(g["M2_atMax"])} |`); }
  out.push("\n### M3 trkački tempo, M4 dugi, M5 ubrzanja, M6 testovi\n");
  out.push("| grupa | RP/MP max km | % trke | ukupno km | nedelja | dugi km | dugi min | dugi % trke | dugi sa brzim | plato ned | ubrzanja | testova | ned do trke |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const k of keys) { const g = G[k]! as Record<string, A>; out.push(`| ${rk(k)} | ${f(g["M3_maxKm"])} | ${f(g["M3_maxPct"])} | ${f(g["M3_totalKm"])} | ${f(g["M3_weeksWith"])} | ${f(g["M4_maxKm"])} | ${f(g["M4_maxMin"])} | ${f(g["M4_pct"])} | ${f(g["M4_withFast"])} | ${f(g["M4_plateau"])} | ${f(g["M5_strides"])} | ${f(g["M6_tests"])} | ${f(g["M6_weeksToRace"])} |`); }
  out.push("\n### M7 % km bržih od E po fazi, M8 obim\n");
  const phases = [...new Set(keys.flatMap((k) => Object.keys(G[k]!).filter((x) => x.startsWith("M7_")).map((x) => x.slice(3))))];
  out.push(`| grupa | ${phases.join(" | ")} | vrh/ned1 | vrh/trenutni | dugi/vrh nedelje |`);
  out.push(`|---|${phases.map(() => "---|").join("")}---|---|---|`);
  for (const k of keys) { const g = G[k]! as Record<string, A>; out.push(`| ${rk(k)} | ${phases.map((p) => f(g[`M7_${p}`] ?? null)).join(" | ")} | ${f(g["M8_peakOverStart"])} | ${f(g["M8_peakOverCurrent"])} | ${pct(g["M8_longShareAtPeak"])} |`); }
  out.push("\n### Šta drži dozu vrha zone (% planova grupe sa tom zonom; n = planova sa zonom)\n");
  out.push("| grupa | zona | n | uzroci |");
  out.push("|---|---|---|---|");
  for (const k of ["ALL|all|all", ...keys]) {
    const h = (G[k]!["hold"] ?? {}) as Record<string, Record<string, number>>;
    for (const z of ["T", "I", "R", "RP", "_"]) {
      const c = h[z]; if (!c) continue;
      const n = Object.values(c).reduce((a, b) => a + b, 0);
      out.push(`| ${rk(k)} | ${z === "_" ? "—" : z} | ${n} | ${Object.entries(c).sort((a, b) => b[1] - a[1]).map(([w, v]) => `${w} ${Math.round((100 * v) / n)} %`).join("; ")} |`);
    }
  }
  const rp = G["ALL|all|all"]!["repro"] as { checked: number; same: number };
  out.push(`\nKopija izbora = jezgro: ${rp.same}/${rp.checked} izbora; razlike po koraku plana: ${JSON.stringify(s.reproDiffSteps)}.`);
  out.push(`Odbijeni ulazi: ${s.rejected.length ? s.rejected.join("; ") : "nema"}. Greške: ${s.errors.length ? s.errors.join("; ") : "nema"}.`);
}
console.log(`# P0 — tabele (generisano: tables.ts)\n${out.join("\n")}`);
