/* K3-MAR (K3-F, K3-G) — merenje bez izmene koda: (F) plato dugog na najdužem dugom plana (broj ne-rasteretnih nedelja i
   najduži niz zaredom); (G1) lagan dan < 30 min u > 2 nedelje izgradnje; (G2) rad testa > 2 × najveća ranija doza rada.
   Iz korena: node --max-old-space-size=6144 docs/generators-v2/perfection/K3-MAR/fg.ts */
const V2 = new URL("../../../../web/src/domain/generators/marathon/v2", import.meta.url).pathname;
const T = await import(`${V2}/testInputs.ts`);
const gen = (await import(`${V2}/generate.ts`)).generateMarathonV2;
const WORK = (s: any) => s.zone && !["E", "jog", "walk"].includes(s.zone) && !["recovery", "warmup", "cooldown", "stride"].includes(s.kind);
const ws = (d: any) => d.workout.segments.filter(WORK).reduce((a: number, s: any) => a + s.sec, 0);
const out: Record<string, any> = {};
for (const [fam, list] of [["R", T.gridInputs()], ["F", T.feelInputs()], ["B", T.beginnerInputs()]] as const) {
  const o = (out[fam] = { n: 0, F_top_gt4: 0, F_run_gt3: 0, F_top_gt4_3d: 0, G1: 0, G2: 0, G2_test: 0 });
  for (const c of list) {
    const r = gen(c.input); if (!r.ok) continue; o.n++;
    const W = r.plan.weeks, steady = W.filter((w: any) => !w.deload && ["base", "development", "specific"].includes(w.phase));
    const L = (w: any) => w.days.find((d: any) => d.role === "long")?.workout.km ?? 0;
    const top = Math.max(...W.map(L));
    let run = 0, best = 0, cnt = 0;
    for (const w of steady) { if (L(w) >= top - 0.05) { cnt++; run++; best = Math.max(best, run); } else run = 0; }
    if (cnt > (c.days === 3 ? 3 : 4)) { o.F_top_gt4++; }
    if (best > 3) o.F_run_gt3++;
    if (steady.filter((w: any) => w.days.some((d: any) => d.role === "easy" && d.workout.sec < 1800)).length > 2) o.G1++;
    let maxDose = 0, bad = false, hasTest = false;
    for (const w of W) for (const d of w.days) {
      if (d.role === "test") { hasTest = true; if (ws(d) > 2 * maxDose + 1e-6) bad = true; }
      else if (d.workout.kind === "quality" || d.role === "long") maxDose = Math.max(maxDose, ws(d));
    }
    if (hasTest) o.G2_test++; if (bad) o.G2++;
  }
  console.log(fam, JSON.stringify(o));
}
