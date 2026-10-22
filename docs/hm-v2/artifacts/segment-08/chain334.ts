/* HM-08: svih 334 promena cilja u chain/2 — korak 2 (A2 manjak) pre/posle i odnos istrčano/planirano u prozoru. */
import { readFileSync, readdirSync } from "node:fs";
const S = process.argv[2];
const load = (d: string) => Object.assign({}, ...readdirSync(d).filter((f) => f.startsWith("early.")).map((f) => JSON.parse(readFileSync(`${d}/${f}`, "utf8"))));
const A: any = load(`${S}/pre`), B: any = load(`${S}/post`);
const keys = Object.keys(A).filter((k) => { const x = A[k], y = B[k]; return y && !x.rej && !y.rej && x.c !== y.c && x.mo.length && x.t.some((t: number, i: number) => t !== y.t[i]); });
const libs = await Promise.all([`${S}/base`, "/home/user/sub-19"].map((r) => import(`${r}/docs/generators-v2/final-check/lib.ts`)));
const tally: Record<string, number> = {}; const ex: string[] = [];
for (const k of keys) {
  const [id, tag] = k.split("/");
  const res = libs.map((lib) => {
    const d = lib.distOf("HM"); const b = d.all().find((x: any) => x.id === id) ?? lib.sampleBases(d, { R: 193, F: 97, B: 29 }).bases.find((x: any) => x.id === id);
    const p = d.generate(b.input).plan;
    const wi = Number(tag.slice(1, -3)); const at = tag.endsWith("wed") ? lib.wedOf(p.weeks[wi - 1].startDate) : p.weeks[wi - 1].endDate;
    const r1 = d.adapt(p, d.facts(p, "chain", at), at); const at2 = lib.addDays(at, 7); const f2 = d.chain2(p, at2);
    const r2 = d.adapt(r1.plan, f2, at2); const st = r2.plan.adaptation.steps.at(-1);
    const from = lib.addDays(at2, -6);
    const planned = r1.plan.weeks.flatMap((w: any) => w.days).filter((x: any) => x.countsToWeek && x.date >= from && x.date <= at2).reduce((a: number, x: any) => a + x.workout.km, 0);
    const done = f2.workouts.reduce((a: number, x: any) => a + x.km, 0);
    return { reduced: !!st.reduced, startKm: st.startKm, ratio: done / planned };
  });
  const [x, y] = res;
  const cls = x.reduced && !y.reduced && x.ratio < 0.6 && y.ratio >= 0.6 ? "A2: manjak pre, ne posle" : x.reduced === y.reduced && x.startKm !== y.startKm ? "A2: drugi startKm" : `drugo ${JSON.stringify(res)}`;
  tally[cls] = (tally[cls] ?? 0) + 1; if (ex.length < 3 && cls.startsWith("drugo")) ex.push(k + " " + cls);
}
console.log(keys.length, tally, ex);
