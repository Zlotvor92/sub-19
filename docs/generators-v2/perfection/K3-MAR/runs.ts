/* K3-MAR (K3-C t. 3) — 3 dana: najduži niz uzastopnih ne-rasteretnih nedelja izgradnje sa istom dozom iste zone
   (i sa istom strukturom) u jedinom kvalitetu. Iz korena: node docs/generators-v2/perfection/K3-MAR/runs.ts */
const V2 = new URL("../../../../web/src/domain/generators/marathon/v2", import.meta.url).pathname;
const T = await import(`${V2}/testInputs.ts`);
const gen = (await import(`${V2}/generate.ts`)).generateMarathonV2;
const hist = { dose: {} as Record<number, number>, struct: {} as Record<number, number> };
let n = 0;
for (const c of [...T.gridInputs(3), ...T.feelInputs().filter((x: any) => x.days === 3)]) {
  const r = gen(c.input); if (!r.ok) continue; n++;
  let bd = 0, bs = 0, rd = 0, rs = 0, pd = "", ps = "";
  for (const w of r.plan.weeks) {
    if (w.deload || !["base", "development", "specific"].includes(w.phase)) continue;
    const q = w.days.find((d: any) => d.role === "q1")?.workout.dose;
    const kd = q ? `${q.zone}|${q.doseM}` : "-", ks = q ? `${kd}|${JSON.stringify(q.structure)}` : "-";
    rd = kd !== "-" && kd === pd ? rd + 1 : 1; rs = ks !== "-" && ks === ps ? rs + 1 : 1; pd = kd; ps = ks;
    bd = Math.max(bd, rd); bs = Math.max(bs, rs);
  }
  hist.dose[bd] = (hist.dose[bd] ?? 0) + 1; hist.struct[bs] = (hist.struct[bs] ?? 0) + 1;
}
console.log("planova 3 dana", n, "najduži niz iste doze:", JSON.stringify(hist.dose), "iste doze i strukture:", JSON.stringify(hist.struct));
