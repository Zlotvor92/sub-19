/* P3 — vrh plana (najveći cilj) posle prema pre i prema P-a. Iz web/: node ../docs/generators-v2/perfection/P3/peak.cjs
   (traži raw-10K-pre.json, raw-10K-s123.json — P-a iz s123-wip.patch, K2 STOP-a — i raw-10K-posle.json). */
const fs = require("fs"); const d = __dirname + "/";
const L = (t) => new Map(JSON.parse(fs.readFileSync(d + "raw-10K-" + t + ".json")).filter((r) => r.p3).map((r) => [r.id, r]));
const po = L("posle");
for (const [n, X] of [["pre", L("pre")], ["P-a", L("s123")]]) {
  let down = 0, up = 0; const ds = [];
  for (const [id, r] of po) { const dd = Math.round((r.p3.peakTarget - X.get(id).p3.peakTarget) * 10) / 10; if (dd < 0) { down++; ds.push(dd); } if (dd > 0) up++; }
  ds.sort((a, b) => a - b);
  console.log(`vrh posle prema ${n}: niži ${down}/${po.size}, viši ${up}, najveći pad ${ds[0]}, medijana pada ${ds[ds.length >> 1]}`);
}
