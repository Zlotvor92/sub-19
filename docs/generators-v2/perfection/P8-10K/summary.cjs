/* P8-10K — zbir raw-<oznaka>.json po mreži i grupi. Iz web/: node ../docs/generators-v2/perfection/P8-10K/summary.cjs pre posle */
const fs = require("fs");
const dir = __dirname + "/";
const tags = process.argv.slice(2);
const BAD = /nije izvodljiv|odstupanje|cilj po pravilu|\[pravilo\]|\bD\d{1,2}\b|\bA\d{1,2}\b|\bT1\b|pouk|ne može da se sastavi|ne nose ovaj obim|plafon/i;
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const grp = (r) => (r.beginner ? "beg" : r.days === 3 ? "d3" : "d4-6");
const data = Object.fromEntries(tags.map((t) => [t, JSON.parse(fs.readFileSync(`${dir}raw-${t}.json`, "utf8"))]));
const keys = ["n", "rej", "volPlat med/max", "volPlat≥4", "longPlat med/max", "longPlat≥4", "pk≤dev−3", "over25 ned", "over30 ned", "pl.over30 %", "taperNoQ", "taperNoRP", "raceNoFast", "pl.bez RP", "buildNoQ", "deloadNoQ", "fitted ned", "lošT napomena pl."];
for (const set of Object.keys(data[tags[0]])) {
  const groups = {};
  for (const t of tags) for (const r of data[t][set]) for (const g of ["ALL", r.rejected ? null : grp(r)]) if (g) ((groups[g] ??= {})[t] ??= []).push(r);
  for (const [g, byTag] of Object.entries(groups)) {
    const line = (t) => {
      const rs = byTag[t] ?? []; const ok = rs.filter((r) => !r.rejected);
      const sum = (f) => ok.reduce((a, r) => a + f(r), 0);
      return [rs.length, rs.length - ok.length, `${med(ok.map((r) => r.volPlateau))}/${Math.max(0, ...ok.map((r) => r.volPlateau))}`, ok.filter((r) => r.volPlateau >= 4).length,
        `${med(ok.map((r) => r.longPlateau))}/${Math.max(0, ...ok.map((r) => r.longPlateau))}`, ok.filter((r) => r.longPlateau >= 4).length,
        ok.filter((r) => r.lastDev && r.firstPeak <= r.lastDev - 3).length,
        sum((r) => r.over25), sum((r) => r.over30), ok.length ? (100 * ok.filter((r) => r.over30 > 0).length / ok.length).toFixed(1) : "-",
        sum((r) => r.taperNoQ), sum((r) => r.taperNoRP), sum((r) => r.raceNoFast), ok.filter((r) => r.rpWeeks === 0).length, sum((r) => r.buildNoQ), sum((r) => r.deloadNoQ), sum((r) => r.fitted),
        ok.filter((r) => r.notes.some((n) => BAD.test(n))).length];
    };
    console.log(`\n[${set} ${g}]`);
    console.log(["oznaka", ...keys].join(" | "));
    for (const t of tags) console.log([t, ...line(t)].join(" | "));
  }
}
