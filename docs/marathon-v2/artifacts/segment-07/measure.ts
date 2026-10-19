/* MAR-07 merenje regresije (pouka 15): po planu / toku jedan JSON red — heš celog plana (planHash, bez oznake
   verzije), heš sadržaja (`hw`: plan bez napomena i upozorenja — treninzi, ciljevi, faze), pravila upozorenja,
   odbijanje i oznake klasa koje SMEJU da se promene: (b) nedelja izgradnje sa dva dana kvaliteta i danom kvaliteta
   dužim od dugog (pouka 35), (x) dugi kraći od dana kvaliteta u nedelji izgradnje sa dva kvaliteta. Merni kod je
   nezavisan od konstruktora (čita samo plan). Iz korena repoa:
   node docs/marathon-v2/artifacts/segment-07/measure.ts <koren> <porodica> <k>/<m>
   porodice: grid, recent, dense, feel, beg (generator); a04, early, pre, wide (adaptacija; kao segment-04b).
   Koren = repo čiji se generator meri (ulazi i scenariji uvek iz ovog repoa). Izlaz: JSON redovi na stdout. */

const here = new URL("../../../../", import.meta.url).pathname;
const root = process.argv[2]!;
const fam = process.argv[3]!;
const [k, m] = (process.argv[4] ?? "1/1").split("/").map(Number) as [
  number,
  number,
];
const G = `${root}/web/src/domain/generators/marathon/v2`;
const { generateMarathonV2, adaptMarathonV2 } = await import(`${G}/index.ts`);
const T = await import(
  `${here}web/src/domain/generators/marathon/v2/testInputs.ts`
);
const { addDays, weekdayOf } = await import(
  `${here}web/src/domain/generators/marathon/v2/dates.ts`
);

type Plan = any;
const every = <X>(xs: readonly X[], s: number): X[] =>
  xs.filter((_, i) => i % s === 0);
const mine = <X>(xs: readonly X[]): X[] => xs.filter((_, i) => i % m === k - 1);
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}
const BUILD = ["base", "development", "specific"];
/** Sadržaj plana bez napomena i upozorenja (treninzi, ciljevi, faze, koraci). */
const contentHash = (p: Plan): string =>
  fnv(
    JSON.stringify({
      ...p,
      policyVersion: "",
      notes: [],
      warnings: [],
      weeks: p.weeks.map((w: any) => ({ ...w, notes: [] })),
    }),
  );
/** Nedelje izgradnje (ne rasterećenje) sa dva dana kvaliteta u kojima je neki dan kvaliteta duži od dugog. */
function twoQOver(p: Plan): number[] {
  const out: number[] = [];
  for (const w of p.weeks) {
    if (!BUILD.includes(w.phase) || w.deload) continue;
    const L = w.days.find((d: any) => d.role === "long");
    const qs = w.days.filter((d: any) => d.workout.kind === "quality");
    if (
      L &&
      qs.length === 2 &&
      qs.some((d: any) => d.workout.sec > L.workout.sec)
    )
      out.push(w.index);
  }
  return out;
}
function rec(p: Plan) {
  const lines = new Set(
    [...p.notes, ...p.warnings.map((v: any) => v.message)].filter(Boolean),
  ).size;
  const rules: Record<string, number> = {};
  for (const v of p.warnings) rules[v.rule] = (rules[v.rule] ?? 0) + 1;
  return {
    h: T.planHash(p),
    hw: contentHash(p),
    hn: fnv(JSON.stringify([p.notes, p.weeks.map((w: any) => w.notes)])),
    warn: Object.entries(rules)
      .sort()
      .map(([r, n]) => `${r}:${n}`)
      .join(","),
    lines,
    q2: twoQOver(p),
    deloads: p.weeks.filter((w: any) => w.deload).length,
  };
}

const out = (o: unknown) => process.stdout.write(`${JSON.stringify(o)}\n`);
const genFam: Record<string, () => any[]> = {
  grid: () => T.gridInputs(),
  recent: () => T.recentInputs(),
  dense: () => T.denseInputs(),
  feel: () => T.feelInputs(),
  beg: () => T.beginnerInputs(),
};
const plans = new Map<string, Plan>();
const planOf = (id: string, input: unknown): Plan | null => {
  if (!plans.has(id)) {
    const r = generateMarathonV2(input);
    plans.set(id, r.ok ? r.plan : null);
  }
  return plans.get(id)!;
};
function flow(
  key: string,
  id: string,
  input: unknown,
  asOf: string,
  facts: (p: Plan) => unknown,
  chain?: (p: Plan, a2: string) => unknown,
) {
  const p0 = planOf(id, input);
  if (!p0) return out({ key, gen: "rejected" });
  let r = adaptMarathonV2(p0, facts(p0), asOf);
  if (r.ok && chain) {
    const a2 = addDays(asOf, 7);
    r = adaptMarathonV2(r.plan, chain(r.plan, a2), a2);
  }
  if (!r.ok)
    return out({
      key,
      rej: r.reasons
        .map((x: any) => `${x.code}:${x.message}`)
        .join(" | ")
        .slice(0, 240),
      gq2: twoQOver(p0).length > 0,
    });
  out({ key, ...rec(r.plan), gq2: twoQOver(p0).length > 0 });
}
const wedOf = (p: Plan, i: number): string => {
  let d = p.weeks[i - 1].startDate;
  while (weekdayOf(d) !== "wed") d = addDays(d, 1);
  return d;
};
const PRE = [-1, -3, -6];
const PRE_S = ["fatigue", "pain5", "pain8", "pause10", "result"];
const preFacts = (p: Plan, s: string, asOf: string) =>
  s === "result"
    ? {
        results: [
          {
            distM: 10000,
            sec: T.timeForVdot(
              Math.min(80, Math.round((p.vdot + 2) * 10) / 10),
              10000,
            ),
            date: asOf,
            kind: "race",
          },
        ],
      }
    : T.earlyFacts(p, s, asOf);

if (genFam[fam]) {
  for (const c of mine(genFam[fam]!())) {
    const r = generateMarathonV2(c.input);
    out(
      r.ok
        ? { key: c.id, ...rec(r.plan) }
        : { key: c.id, rej: r.reasons.map((x: any) => x.code).join(",") },
    );
  }
} else if (fam === "a04") {
  for (const b of T.adaptBases()) {
    const p0 = planOf(b.id, b.input)!;
    for (const c of mine(T.adaptCases(b.id, p0)))
      flow(
        c.key,
        b.id,
        b.input,
        c.asOf,
        (p) => T.factsOf(p, c.s, c.asOf),
        c.s === "chain" ? T.chainFacts : undefined,
      );
  }
} else if (fam === "early" || fam === "pre") {
  const all: [string, any, string, string][] = [];
  for (const b of T.earlyGridBases(182, 78, 42)) {
    const p0 = planOf(b.id, b.input);
    if (!p0) continue;
    if (fam === "early")
      for (const a of T.earlyAsOfs(p0))
        for (const s of T.EARLY_SCENARIOS)
          all.push([`${b.id}/${a.tag}/${s}`, b, a.asOf, s]);
    else
      for (const d of PRE)
        for (const s of PRE_S)
          all.push([
            `${b.id}/s${d}/${s}`,
            b,
            addDays(p0.input.startDate, d),
            s,
          ]);
  }
  for (const [key, b, asOf, s] of mine(all))
    flow(key, b.id, b.input, asOf, (p) => preFacts(p, s, asOf));
} else if (fam === "wide") {
  const bases = [
    ...every(T.gridInputs(), 211),
    ...every(T.feelInputs(), 97),
    ...every(T.beginnerInputs(), 47),
    ...every(T.recentInputs(), 157),
  ];
  for (const b of mine(bases)) {
    const p0 = planOf(b.id, b.input);
    if (!p0) {
      out({ key: b.id, gen: "rejected" });
      continue;
    }
    const N = p0.weeks.length;
    const asOfs = [...PRE.map((d) => addDays(p0.input.startDate, d))];
    for (let i = 1; i <= N - 2; i++)
      asOfs.push(wedOf(p0, i), p0.weeks[i - 1].endDate);
    for (const asOf of asOfs)
      for (const s of T.SCENARIOS)
        flow(
          `${b.id}/${asOf}/${s}`,
          b.id,
          b.input,
          asOf,
          (p) => T.factsOf(p, s, asOf),
          s === "chain" ? T.chainFacts : undefined,
        );
    plans.delete(b.id);
  }
}
