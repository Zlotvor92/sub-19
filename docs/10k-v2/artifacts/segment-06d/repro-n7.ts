/* Ponavljanje pretrage N7 (organizator): feelGridInputs(3..6), svaki 7.; asOf kraj ned w i kraj − 3,
   w = 1 … (ned testa − 1); 6 scenarija. Pokretanje iz web/: node ../docs/10k-v2/artifacts/segment-06d/repro-n7.ts */
const V = new URL(
  "../../../../web/src/domain/generators/tenK/v2/",
  import.meta.url,
).href;
const { generateTenKV2 } = await import(V + "generate.ts");
const { adaptTenKV2 } = await import(V + "adapt.ts");
const { addDays } = await import(V + "dates.ts");
const T = await import(V + "testInputs.ts");
const plans = ([3, 4, 5, 6] as const)
  .flatMap((d) => T.feelGridInputs(d))
  .filter((_: unknown, i: number) => i % 7 === 0);
const back = (a: string, n: number) => addDays(a, -n);
const scen: Record<string, (p: any, a: string) => unknown> = {
  pause10: (_p, a) => ({
    breaks: [{ kind: "break", from: back(a, 9), to: a }],
  }),
  pause20: (_p, a) => ({
    breaks: [{ kind: "break", from: back(a, 19), to: a }],
  }),
  pain5: (_p, a) => T.painFacts(a, 5),
  pain8: (_p, a) => T.painFacts(a, 8),
  pause10pain5: (_p, a) => ({
    breaks: [{ kind: "break", from: back(a, 9), to: a }],
    ...T.painFacts(a, 5),
  }),
  under: (p, a) => ({
    workouts: T.runsIn(p, back(a, 6), back(a, 6)),
    coverage: { from: back(a, 6), to: a, complete: true },
  }),
};
let n = 0;
const rej: Record<string, number> = {};
const ex: Record<string, string[]> = {};
const t0 = Date.now();
for (const c of plans) {
  const g = generateTenKV2(c.input);
  if (!g.ok) throw new Error(c.id);
  const p = g.plan;
  const tw = p.weeks.find((w: any) => w.test)?.index;
  if (!tw) continue;
  for (let w = 1; w < tw; w++)
    for (const a of [p.weeks[w - 1].endDate, back(p.weeks[w - 1].endDate, 3)])
      for (const [s, f] of Object.entries(scen)) {
        n++;
        const r = adaptTenKV2(p, f(p, a), a);
        if (r.ok) continue;
        const k = r.violations.length
          ? [
              ...new Set(
                r.violations
                  .filter((v: any) => v.severity === "error")
                  .map((v: any) => v.rule),
              ),
            ].join("+")
          : r.reasons.map((x: any) => x.message.split(":")[0]).join("+");
        rej[k] = (rej[k] ?? 0) + 1;
        (ex[k] ??= []).length < 5 &&
          ex[k].push(
            `${c.id} ${s} ${a}: ${
              r.violations
                .filter((v: any) => v.severity === "error")
                .map((v: any) => `w${v.week} ${v.message}`)
                .join(" | ") || r.reasons.map((x: any) => x.message).join(" | ")
            }`,
          );
      }
}
console.log(
  JSON.stringify({ n, rej, ex, sec: (Date.now() - t0) / 1000 }, null, 1),
);
