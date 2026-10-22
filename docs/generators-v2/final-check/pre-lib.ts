/* Faza 4 (pre-final, 22. 10.) — zajednički brojač tokova za nove kombinacije (SAMO ČITANJE, bez izmene web/**).
   Tok = adapt(plan, činjenice, asOf): odbijanje po klasi (greške validatora po pravilu, inače kod + poruka bez brojeva),
   na uspeh nezavisne provere lib.commonChecks + invarijante distance (adaptInvariants; 5K nema). */

import { commonChecks, type Dist, type Plan } from "./lib.ts";

export interface Tally {
  flows: number;
  rejectedFlows: number;
  rejected: Record<string, number>;
  rejectedEx: Record<string, string[]>;
  common: Record<string, number>;
  commonEx: Record<string, string[]>;
  inv: Record<string, number>;
  invEx: Record<string, string[]>;
  by: Record<string, number>;
}
export const tally = (): Tally => ({
  flows: 0,
  rejectedFlows: 0,
  rejected: {},
  rejectedEx: {},
  common: {},
  commonEx: {},
  inv: {},
  invEx: {},
  by: {},
});
const add = (o: Record<string, number>, ex: Record<string, string[]>, k: string, e: string) => {
  o[k] = (o[k] ?? 0) + 1;
  const xs = (ex[k] ??= []);
  if (xs.length < 3) xs.push(e);
};
const cls = (r: { code: string; message: string }): string =>
  `${r.code}:${r.message.split(":")[0]!.replace(/[0-9]+([.,][0-9]+)?/g, "#").slice(0, 70)}`;

/** Jedan tok; `group` = ključ za prebrojavanje odbijanja (npr. scenario). Vraća adaptiran plan ili null. */
export function flow(
  d: Dist,
  t: Tally,
  p: Plan,
  facts: Record<string, unknown>,
  at: string,
  keyS: string,
  group: string,
): Plan | null {
  t.flows++;
  let r;
  try {
    r = d.adapt(p, facts, at);
  } catch (e) {
    t.rejectedFlows++;
    t.by[group] = (t.by[group] ?? 0) + 1;
    add(t.rejected, t.rejectedEx, `THROW:${String(e).slice(0, 60)}`, keyS);
    return null;
  }
  if (!r.ok) {
    t.rejectedFlows++;
    t.by[group] = (t.by[group] ?? 0) + 1;
    const vs = ((r as { violations?: { rule: string; severity: string; message: string }[] }).violations ?? []).filter(
      (v) => v.severity === "error",
    );
    if (vs.length) for (const v of vs) add(t.rejected, t.rejectedEx, `VALIDATOR:${v.rule}`, `${keyS}: ${v.message.slice(0, 260)}`);
    else for (const x of r.reasons) add(t.rejected, t.rejectedEx, cls(x), `${keyS}: ${x.message.slice(0, 260)}`);
    return null;
  }
  for (const v of commonChecks(p, r.plan, at, facts)) add(t.common, t.commonEx, v, keyS);
  if (d.inv)
    for (const v of d.inv(p, r.plan, at, facts))
      add(t.inv, t.invEx, v.replace(/[0-9-]+/g, "#").slice(0, 80), `${keyS}: ${v}`);
  return r.plan;
}

/** Spajanje dva skupa činjenica (drugi ima prednost za isti datum treninga; rezultati i pauze se nadovezuju;
    zaključani i pokrivenost iz drugog, inače iz prvog). */
export function mergeFacts(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  type W = { date: string };
  const wa = (a["workouts"] as W[] | undefined) ?? [];
  const wb = (b["workouts"] as W[] | undefined) ?? [];
  const dates = new Set(wb.map((w) => w.date));
  const workouts = [...wa.filter((w) => !dates.has(w.date)), ...wb];
  const results = [...((a["results"] as unknown[]) ?? []), ...((b["results"] as unknown[]) ?? [])];
  const breaks = [...((a["breaks"] as unknown[]) ?? []), ...((b["breaks"] as unknown[]) ?? [])];
  const locked = (b["lockedDayIds"] ?? a["lockedDayIds"]) as string[] | undefined;
  const coverage = b["coverage"] ?? a["coverage"];
  return {
    ...(workouts.length ? { workouts } : {}),
    ...(results.length ? { results } : {}),
    ...(breaks.length ? { breaks } : {}),
    ...(locked ? { lockedDayIds: locked } : {}),
    ...(coverage ? { coverage } : {}),
  };
}

export const print = (o: unknown): void => console.log(JSON.stringify(o, null, 1));
