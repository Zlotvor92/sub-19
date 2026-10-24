/* 5K-09: otisci regresije prema polaznom SHA (kanon bez korisničkog teksta, verzije i peakKm — testInputs.canon09) i
   razlog svake promene (Why09). Iz web/: node ../docs/generators-v2/audit/fixes/5K/fixture09.ts <base v2 dir> <mreža>
   mreža: g07 | n08d | e08e | x08g. Piše web/src/domain/generators/fiveK/v2/segment09.<mreža>-c13c258.json (zatim
   npx prettier --write na tom fajlu). Polazni v2 dir: git worktree c13c258 (web/src/domain/generators/fiveK/v2). */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const CUR = new URL("../../../../../web/src/domain/generators/fiveK/v2/", import.meta.url).pathname;
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
  if (!x.ok && y.ok) {
    const codes = x.reasons.map((r: any) => r.code);
    const rules = (x.violations ?? []).filter((v: any) => v.severity === "error").map((v: any) => v.rule);
    if (rules.includes("LIMITS")) return "Z6";
    if (rules.includes("RACE_WEEK_TAPER")) return "LC5";
    if (rules.some((u: string) => ["TEST_WEEK", "DOSE_PROGRESSION", "BASE_R_DECREASE", "QUALITY_REPEAT"].includes(u))) return "LC4";
    if (codes.includes("WEEK_INFEASIBLE")) return "F1";
    if (codes.includes("QUALITY_INFEASIBLE")) return "F2";
    if (codes.includes("VDOT_OUT_OF_RANGE")) return "C8";
    return "?rej:" + codes.join("+");
  }
  const uf = (p: any) => (p.adaptation?.steps ?? []).filter((s: any) => s.underFrom !== undefined).length;
  if (count(y, uf) > count(x, uf) && T.canon09(x).replace(/,"underFrom":"[^"]*"/g, "") === T.canon09(y).replace(/,"underFrom":"[^"]*"/g, "")) return "Z7";
  // C4: doza nedelje iz činjenice (oznaka doseFact) — jedina razlika u kanonu (uz oznaku prozora manjka Z7).
  const uf0 = (r: any) => T.canon09(r).replace(/,"underFrom":"[^"]*"/g, "");
  if (uf0(x) === uf0(y).replace(/,"doseFact":true/g, "")) return "LC4";
  const rs = (r: any, c: string, a: boolean) => (r.ok && r.reasons ? r.reasons.filter((q: any) => q.condition === c && q.applied === a).length : 0);
  if (rs(y, "PAIN", false) > rs(x, "PAIN", false)) return "Z8";
  if (rs(y, "UNDER_EXECUTION", false) > rs(x, "UNDER_EXECUTION", false)) return "Z7";
  const lc8 = (p: any) => (p.warnings ?? []).filter((w: any) => w.rule === "MIXED_OVER_TARGET" && w.message.includes("posle pauze")).length;
  if (count(y, lc8) > count(x, lc8)) return "LC8";
  const parent = key.replace(/\/(\+\d+|chain)$/, "");
  if (parent !== key && changed.has(parent)) return "CH";
  const test = (p: any) => (p.experience === "beginner" ? p.weeks.filter((w: any) => w.test).length : 0);
  if (count(x, test) > count(y, test)) return "C13";
  const dl = (p: any) => (p.experience === "beginner" ? p.weeks.filter((w: any) => w.deload && w.index <= 4).map((w: any) => w.index).join(",") : "");
  if (plansOf(x).map(dl).join("|") !== plansOf(y).map(dl).join("|")) return "C1";
  const rq = (p: any) => (p.warnings ?? []).filter((w: any) => w.rule === "QUALITY_REDUCED").length;
  if (count(y, rq) > 0 && count(x, rq) === 0) return "F2";
  const mo = (p: any) => (p.warnings ?? []).filter((w: any) => w.rule === "MIXED_OVER_TARGET").length;
  if (count(y, mo) !== count(x, mo)) return "Z1";
  // C2: zapis umora bez dayId je sada lagan — umor se prepoznaje (primenjen ili nadjačan, npr. sledi taper).
  const fat = (r: any) => (r.ok ? r.reasons.filter((q: any) => q.condition === "FATIGUE").length : -1);
  if (fat(x) !== fat(y)) return "C2";
  if (T.mark09("F1", y) && !T.mark09("F1", x)) return "F1";
  // Z1 bez upozorenja: kvalitet zadržan u mešovitoj nedelji, planirano u toleranciji cilja.
  const q = (p: any) => p.weeks.reduce((s: number, w: any) => s + w.days.filter((d: any) => d.workout.kind === "quality").length, 0);
  const mixed = (p: any) => (p.adaptation?.mixedWeeks ?? []).length;
  if (count(y, q) > count(x, q) && count(y, mixed) > 0) return "Z1";
  // Početnik bez kontrolnog trčanja (C13): test je ranije zamenjivao glavni kvalitet nedelje 3/4 i menjao lanac doze, i
  // kad je u toku već otpao (bol/pauza) — promena plana početnika bez druge oznake pripada C13.
  if (T.mark09("C13", y) && plansOf(x).some((p: any) => p.experience === "beginner")) return "C13";
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
  ? { against: "c13c258", canon: "canon09", count: total, plans: Object.fromEntries(Object.entries(groups).map(([g, xs]) => [g, digest(xs.filter((s) => !changed[s.slice(0, s.lastIndexOf(":"))]))])), changed }
  : { against: "c13c258", canon: "canon09", count: total, hashes, changed };
writeFileSync(`${CUR}segment09.${NET}-c13c258.json`, JSON.stringify(out, null, 0) + "\n");
console.log(NET, "tokova", total, "promenjeno", Object.keys(changed).length, JSON.stringify(stat));
for (const [w, xs] of Object.entries(ex)) console.log(" ", w, xs.join(" "));
