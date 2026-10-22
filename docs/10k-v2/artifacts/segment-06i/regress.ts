// Regresija 06i (pouka 37): ROOT shard nshards stride → po toku: ključ|ok|heš plana|heševi nedelja|ciljevi|prva nedelja pouke 37
// (heš bez oznake verzije). Uzorak: svaki `stride`. plan R/F/B (mreže 02, F, B) × 17 scenarija (lanac: drugi korak + 7)
// × asOf start − 6/− 3/− 1 i ponedeljak/četvrtak/nedelja svake nedelje 1 … N − 1 (umor: svaki dan).
// Iz web/: node ../docs/10k-v2/artifacts/segment-06i/regress.ts <root> <deo> <delova> <korak> > out
const [ROOT, shard, nsh, strideS] = process.argv.slice(2);
const V = `${ROOT}/web/src/domain/generators/tenK/v2`;
const { adaptTenKV2 } = await import(`${V}/adapt.ts`);
const { generateTenKV2 } = await import(`${V}/generate.ts`);
const T: any = await import(`${V}/testInputs.ts`);
const add = (d: string, n: number) =>
  new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
};
const norm = (x: unknown): string =>
  JSON.stringify(x).replace(/10k-v2\.\d+\.\d+/g, "VERSION");
const all = [
  ...[3, 4, 5, 6].flatMap((d) => T.grid02Inputs(d)),
  ...[3, 4, 5, 6].flatMap((d) => T.feelGridInputs(d)),
  ...[3, 4].flatMap((d) => T.beginnerGridInputs(d)),
];
const stride = Number(strideS);
const chain2 = (plan: any, a2: string) => ({
  workouts: [],
  results: [
    {
      distM: 5000,
      sec: T.timeForVdot((plan.vdot ?? 40) + 1, 5000),
      date: a2,
      kind: "test",
    },
  ],
  lockedDayIds: [],
  coverage: null,
  breaks: [],
});
const out: string[] = [];
let j = 0;
for (const [i, b] of all.entries()) {
  if (i % stride) continue;
  if (j++ % Number(nsh) !== Number(shard)) continue;
  const g: any = generateTenKV2(b.input);
  if (!g.ok) continue;
  const p = g.plan;
  const N = p.weeks.length;
  const s0 = p.weeks[0].startDate;
  const base = [-6, -3, -1].map((k) => add(s0, k));
  const wk = (offs: number[]) =>
    p.weeks
      .slice(0, N - 1)
      .flatMap((w: any) => offs.map((o) => add(w.startDate, o)));
  for (const s of T.SCENARIOS) {
    const ats = [
      ...base,
      ...wk(s === "fatigue" ? [0, 1, 2, 3, 4, 5, 6] : [0, 3, 6]),
    ];
    for (const at of ats) {
      let f: any;
      try {
        f = T.factsOf(p, s, at);
      } catch {
        continue;
      }
      let a: any = adaptTenKV2(p, f, at);
      if (a.ok && s === "chain") {
        const a2 = add(at, 7);
        a = adaptTenKV2(a.plan, chain2(a.plan, a2), a2);
      }
      if (!a.ok) {
        out.push(
          `${b.id}|${at}|${s}|rej|${a.reasons.map((r: any) => r.code).join(",")}`,
        );
        continue;
      }
      const ws = a.plan.weeks;
      const note = ws.findIndex((w: any) =>
        w.notes.some((n: string) =>
          n.startsWith("Mešovita nedelja (pouka 37)"),
        ),
      );
      const over = ws.filter((w: any) =>
        a.plan.warnings.some(
          (v: any) => v.rule === "MIXED_OVER_TARGET" && v.week === w.index,
        ),
      ).length;
      out.push(
        `${b.id}|${at}|${s}|ok|${fnv(norm(a))}|${ws.map((w: any) => fnv(norm(w))).join(",")}|${ws.map((w: any) => w.targetKm).join(",")}|${note < 0 ? 0 : note + 1}|${over}`,
      );
    }
  }
}
console.log(out.join("\n"));
