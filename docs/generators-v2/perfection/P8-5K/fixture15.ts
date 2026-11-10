/* P8-5K (5k-v2.15.0): otisci regresije prema 9055e5b (5k-v2.14.0; kanon bez korisničkog teksta, verzije i peakKm —
   testInputs.canon09) i razlog svake promene: P8 (G1–G3, a–e; oznaka testInputs.markP8 na tekućem rezultatu), CH (drugi
   korak lanca posle promenjenog prvog). Isti postupak kao P5-5K/fixture14.ts.
   Iz web/: node ../docs/generators-v2/perfection/P8-5K/fixture15.ts <base v2 dir> <mreža>; mreža: g07 | n08d | e08e | x08g.
   Piše web/src/domain/generators/fiveK/v2/segment15.<mreža>-9055e5b.json. Polazni v2 dir: git worktree 9055e5b. */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const CUR = new URL("../../../../web/src/domain/generators/fiveK/v2/", import.meta.url).pathname;
const BASE = process.argv[2]!.replace(/\/?$/, "/");
const NET = process.argv[3]!;
const T = await import(`${CUR}testInputs.ts`);
const mk = async (d: string) => {
  const g = await import(`${d}generate.ts`), a = await import(`${d}adapt.ts`), p = await import(`${d}paces.ts`);
  return { api: { generate: g.generateFiveKV2, adapt: a.adaptFiveKV2 }, rt: p.raceTimeForVdot };
};
const b = await mk(BASE), c = await mk(CUR);
const h = (r: unknown) => createHash("sha256").update(T.canon09(r)).digest("hex").slice(0, 16);

type F = { key: string; res: any };
type Api = { api: any; rt: any };
/** Grupe tokova (računaju se grupa po grupa, da oba stabla ne drže sve rezultate u memoriji). */
function groupsOf(): { group: string; run: (x: Api) => F[] }[] {
  if (NET === "g07")
    return T.regressionInputs().map(([id, input]: [string, any]) => ({ group: id, run: (x: Api) => [{ key: id, res: x.api.generate(input) }] }));
  if (NET === "n08d")
    return [
      { group: "net", run: (x: Api) => T.adaptNetworkFlows(x.api, x.rt).map((f: any) => ({ key: f.key, res: f.result })) },
      { group: "gridP", run: (x: Api) => T.painGridBases(x.api).flatMap((pb: any) => T.painCases(pb).map((pc: any) => ({ key: pc.key, res: x.api.adapt(pb.plan, T.painFacts(pc.asOf, pc.level), pc.asOf) }))) },
    ];
  if (NET === "e08e")
    return (["narrow", "wide"] as const).flatMap((s) =>
      T.reliefBases(c.api, s === "wide").map((rb0: any) => ({
        group: `${s}:${rb0.id}`,
        run: (x: Api) => {
          const rb = T.reliefBases(x.api, s === "wide").find((y: any) => y.id === rb0.id);
          return T.reliefCases(rb, s, s === "narrow" ? T.RELIEF_NARROW : T.RELIEF_WIDE, x.rt).map((rc: any) => ({ key: `${s}:${rc.key}`, res: x.api.adapt(rb.plan, rc.facts, rc.asOf) }));
        },
      })));
  if (NET === "x08g")
    return T.earlyGridBases().map((eb: any) => ({ group: eb.id, run: (x: Api) => T.earlyFlows(eb.id, eb.input, x.api).map((f: any) => ({ key: f.key, res: f.res })) }));
  throw new Error(NET);
}
const plansOf = (r: any): any[] => (!r?.ok ? [] : r.plan.continuous ? [r.plan, r.plan.continuous.plan] : [r.plan]);
const count = (r: any, pred: (p: any) => number) => plansOf(r).reduce((s, p) => s + pred(p), 0);
function why(key: string, x: any, y: any, changed: Set<string>): string {
  // P8: razlog promene prema 9055e5b, prvi koji važi.
  const parent = key.replace(/\/(\+\d+|chain|\d+)$/, "");
  if (parent !== key && changed.has(parent)) return "CH";
  if (!y.ok) return "?rej:" + (y.reasons ?? []).map((r: any) => r.code).join("+") + (x.ok ? " (NOVO)" : "");
  if (T.markP8(y)) return "P8";
  return "?";
}
const hashes: Record<string, string> = {}, groups: Record<string, string[]> = {};
const changed: Record<string, { h: string; why: string }> = {};
const set = new Set<string>();
const stat: Record<string, number> = {};
const ex: Record<string, string[]> = {};
let total = 0;
for (const g of groupsOf()) {
  const fb = g.run(b), fc = g.run(c);
  if (fb.length !== fc.length || fb.some((f, i) => f.key !== fc[i]!.key)) throw new Error("ključevi " + g.group);
  for (let i = 0; i < fc.length; i++) {
    total++;
    const k = fc[i]!.key, hb = h(fb[i]!.res), hc = h(fc[i]!.res);
    hashes[k] = hb;
    (groups[g.group] ??= []).push(`${k}:${hb}`);
    if (hb === hc) continue;
    const w = why(k, fb[i]!.res, fc[i]!.res, set);
    set.add(k);
    changed[k] = { h: hb, why: w };
    stat[w] = (stat[w] ?? 0) + 1;
    (ex[w] ??= []).length < 5 && ex[w]!.push(k);
  }
}
const digest = (xs: string[]) => createHash("sha256").update([...xs].sort().join("\n")).digest("hex").slice(0, 16);
const out = NET === "x08g"
  ? { against: "9055e5b", canon: "canon09", count: total, plans: Object.fromEntries(Object.entries(groups).map(([g, xs]) => [g, digest(xs.filter((s) => !changed[s.slice(0, s.lastIndexOf(":"))]))])), changed }
  : { against: "9055e5b", canon: "canon09", count: total, hashes, changed };
writeFileSync(`${CUR}segment15.${NET}-9055e5b.json`, JSON.stringify(out, null, 0) + "\n");
console.log(NET, "tokova", total, "promenjeno", Object.keys(changed).length, JSON.stringify(stat));
for (const [w, xs] of Object.entries(ex)) console.log(" ", w, xs.join(" "));
