import {
  addDays,
  distOf,
  wedOf,
} from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
import { mergeFacts } from "/home/user/sub-19/docs/generators-v2/final-check/pre-lib.ts";
const d = distOf("MAR");
let n = 0,
  rej = 0;
const hit: Record<string, number> = {};
const ex: string[] = [];
let real = 0;
for (const [i, b] of d.all().entries()) {
  if (i % 7) continue;
  const g: any = d.generate(b.input);
  if (!g.ok) continue;
  const p = g.plan;
  const at = wedOf(p.weeks[1].startDate);
  const f1 = d.facts(p, "over120", at);
  const r1: any = d.adapt(p, f1, at);
  if (!r1.ok) {
    rej++;
    continue;
  }
  const at2 = addDays(at, 7);
  for (const form of ["new", "cum"]) {
    const f2 =
      form === "new"
        ? d.facts(r1.plan, "pause20", at2)
        : mergeFacts(f1, d.facts(r1.plan, "pause20", at2));
    const r: any = d.adapt(r1.plan, f2, at2);
    n++;
    if (!r.ok) {
      rej++;
      continue;
    }
    const bad = d.inv!(r1.plan, r.plan, at2, f2).filter((x: string) =>
      x.includes("doza raste"),
    );
    if (bad.length) {
      hit[form] = (hit[form] ?? 0) + 1;
      if (ex.length < 5) ex.push(`${b.id} ${form}: ${bad.join(",")}`);
      // stvarni rast: doza ograničene nedelje > najveća doza iste zone u upisanim ne-rasteretnim nedeljama izgradnje pre nje
      const wk = Number(bad[0].match(/ned (\d+)/)![1]);
      const z = (w: any) =>
        w.days
          .filter((x: any) => x.workout.kind === "quality")
          .map((x: any) => x.workout.dose);
      const prevMax = Math.max(
        0,
        ...r.plan.weeks
          .slice(0, wk - 1)
          .filter(
            (w: any) =>
              ["base", "development", "specific"].includes(w.phase) &&
              !w.deload,
          )
          .flatMap(z)
          .filter((q: any) => q.zone === "T")
          .map((q: any) => q.doseM),
      );
      const cur = Math.max(
        ...z(r.plan.weeks[wk - 1])
          .filter((q: any) => q.zone === "T")
          .map((q: any) => q.doseM),
        0,
      );
      if (cur > prevMax) real++;
    }
  }
}
console.log({
  planovaX2: n,
  odbijeno: rej,
  dozaRaste: hit,
  stvarniRastPremaSvimUpisanim: real,
  ex,
});
