/* P5-10K — sažetak raw-<oznaka>.json (mreža P0, 192). node summary.cjs <oznaka>... */
const med = (a) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return "—"; const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; return `${Math.round(m * 10) / 10} [${Math.round(s[0] * 10) / 10}–${Math.round(s[s.length - 1] * 10) / 10}]`; };
for (const tag of process.argv.slice(2)) {
  const all = require(`./raw-${tag}.json`); const ok = all.filter((x) => x.m);
  const R = ok.filter((x) => x.family === "R"), F = ok.filter((x) => x.family === "F"), B = ok.filter((x) => x.family === "B");
  const nz = (a) => a.filter((x) => x > 0);
  const phase = (rows, ph) => med(rows.map((x) => x.m.m7[ph]).filter((x) => x !== undefined));
  const out = {
    ok: ok.length, rejected: all.length - ok.length,
    "R testova po planu (12+ ned / < 12)": `${med(R.filter((x) => x.weeks >= 12).map((x) => x.p5.test ? 1 : 0))} / ${med(R.filter((x) => x.weeks < 12).map((x) => x.p5.test ? 1 : 0))}`,
    "R ned. od testa do trke": med(R.filter((x) => x.p5.test).map((x) => x.p5.test.toRace)),
    "R ned 1 T min": med(nz(R.map((x) => x.p5.w1T))), "R ned 1 I min": med(nz(R.map((x) => x.p5.w1I))),
    "R prvi T rad min (M1)": med(R.filter((x) => x.m.m1.T).map((x) => x.m.m1.T.firstMin)),
    "R prvi I rad min (M1)": med(R.filter((x) => x.m.m1.I).map((x) => x.m.m1.I.firstMin)),
    "R M1 T max": med(R.filter((x) => x.m.m1.T).map((x) => x.m.m1.T.maxMin)), "R M1 I max": med(R.filter((x) => x.m.m1.I).map((x) => x.m.m1.I.maxMin)),
    "R udeo rada 1. kval. dana %": med(R.map((x) => (x.m.m2.first ?? 0) * 100)),
    "laganih dana sa ubrzanjima R/F/B": `${med(R.map((x) => x.p5.strideDays))} / ${med(F.map((x) => x.p5.strideDays))} / ${med(B.map((x) => x.p5.strideDays))}`,
    "nedelja sa ubrzanjima / nedelja bez trkačke (R)": `${med(R.map((x) => x.p5.strideWeeks))} / ${med(R.map((x) => x.p5.strideEligible))}`,
    "R % brzih: baza/razvoj/spec/taper": ["base", "development", "specific", "taper"].map((p) => phase(R, p)).join(" · "),
    "nedelja > 25 % brzih (svi)": ok.reduce((a, x) => a + x.p5.over25, 0),
    "R vrh cilja km": med(R.map((x) => x.p5.peakTarget)),
    "planova sa WEEK_FITTED / nedelja": `${ok.filter((x) => x.p5.fitted).length} / ${ok.reduce((a, x) => a + x.p5.fitted, 0)}`,
    "ned 1 ispod obima": ok.filter((x) => x.p5.w1Planned + 0.1 < x.p5.current).length,
  };
  console.log(`== ${tag}`); for (const [k, v] of Object.entries(out)) console.log(`${k}: ${v}`);
}
