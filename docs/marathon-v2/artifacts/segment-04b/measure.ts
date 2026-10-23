/* MAR-04b merenje (pouka 32 za sve zone; N1 umor pre starta; N2 BASE_PLATEAU): po planu / toku jedan JSON red —
   heš (planHash, bez oznake verzije), odbijanje, dani kvaliteta duži od dugog po vrsti nedelje (izgradnja,
   rasterećenje, taper; iznad najnižeg nivoa / najniži), vrh, ned 1, pad doze. Trajanje dana kvaliteta = WU + rad +
   oporavci + CD, džog zadat metrima sporim E (pouka 32); dugi = trajanje dana dugog. Merni kod je nezavisan od
   konstruktora (čita samo plan). Iz korena:
   node --experimental-strip-types docs/marathon-v2/artifacts/segment-04b/measure.ts <koren> <porodica> <k>/<m>
   porodice: grid, recent, dense, feel, beg (generator); a04, early, pre, wide (adaptacija). Koren = repo čiji se
   generator meri (ulazi i scenariji uvek iz ovog repoa). Izlaz: JSON redovi na stdout. */

const here = new URL("../../../../", import.meta.url).pathname;
const root = process.argv[2]!;
const fam = process.argv[3]!;
const [k, m] = (process.argv[4] ?? "1/1").split("/").map(Number) as [
  number,
  number,
];
const G = `${root}/web/src/domain/generators/marathon/v2`;
const { generateMarathonV2, adaptMarathonV2 } = await import(`${G}/index.ts`);
const { checkInput } = await import(`${G}/input.ts`);
const { pacesAt } = await import(`${G}/steps.ts`);
const { MARATHON_V2_POLICY: P } = await import(`${G}/policy.ts`);
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

/** Najmanja doza zone u kontekstu (izgradnja: prvi nivo lestvice; rasterećenje/taper: najmanja doza). */
function lowest(d: any, beginner: boolean): number {
  if (d.step === "deload" || d.step === "taper")
    return d.zone === "MP"
      ? P.taper.mpMin.reps * P.taper.mpMin.repM
      : Math.round((beginner ? P.beginner.tFirstKm : P.deload.tMinKm) * 1000);
  const lv = P.ladders[d.ladder][0];
  const m0 =
    lv.form === "continuous"
      ? Math.round(lv.km * 1000)
      : lv.form === "reps"
        ? lv.reps * lv.repM
        : lv.repsM.reduce((a: number, x: number) => a + x, 0);
  return beginner && d.ladder === "T_continuous"
    ? Math.round(P.beginner.tFirstKm * 1000)
    : m0;
}

/** Trajanje dana kvaliteta [s]: džog zadat metrima sporim E. */
function daySec(w: any, slow: number): number {
  let s = 0;
  for (const g of w.segments)
    s +=
      g.kind === "recovery" && g.kmBasis === "exact"
        ? Math.round(g.km * slow)
        : g.sec;
  return s;
}

/** Dani kvaliteta duži od dugog po vrsti nedelje: [iznad najnižeg, najniži]; primer prvog iznad. Adaptiran plan:
    `f` = isto samo za dane posle asOf koji nisu zaključani (prošlost/urađeno/zaključano se ne menja, A11). */
function overLong(p: Plan) {
  const chk = checkInput(p.input);
  const steps = p.adaptation?.steps ?? [];
  const beginner = p.input.experience === "beginner";
  const o: Record<string, [number, number]> = {
    build: [0, 0],
    deload: [0, 0],
    taper: [0, 0],
  };
  const f: Record<string, [number, number]> = {
    build: [0, 0],
    deload: [0, 0],
    taper: [0, 0],
  };
  const asOf = p.adaptation?.asOf ?? null;
  const locked = new Set(p.adaptation?.lockedDayIds ?? []);
  const zones: Record<string, number> = {};
  let ex: string | null = null;
  let maxLowMin = 0;
  for (const w of p.weeks) {
    if (w.phase === "race") continue;
    const long = w.days.find((d: any) => d.role === "long");
    if (!long) continue;
    const pk = chk.ok
      ? pacesAt(chk.pace, steps, w.index, p.input.currentWeeklyKm)
      : p.paces;
    const kind = w.phase === "taper" ? "taper" : w.deload ? "deload" : "build";
    for (const d of w.days) {
      const dz = d.workout.dose;
      if (d.workout.kind !== "quality" || !dz) continue;
      const sec = daySec(d.workout, pk.E.slow);
      if (sec <= long.workout.sec) continue;
      const low = dz.doseM <= lowest(dz, beginner);
      o[kind]![low ? 1 : 0]++;
      if (asOf === null || (d.date > asOf && !locked.has(d.date)))
        f[kind]![low ? 1 : 0]++;
      if (!low) {
        zones[dz.zone] = (zones[dz.zone] ?? 0) + 1;
        ex ??= `ned ${w.index} ${kind} ${dz.zone} ${dz.doseM} m ${Math.round(sec / 60)} > ${Math.round(long.workout.sec / 60)} min`;
      } else maxLowMin = Math.max(maxLowMin, (sec - long.workout.sec) / 60);
    }
  }
  return { o, f, zones, ex, maxLowMin: Math.round(maxLowMin * 10) / 10 };
}

function rec(p: Plan) {
  const ol = overLong(p);
  const w1 = p.weeks[0];
  return {
    h: T.planHash(p),
    o: ol.o,
    f: ol.f,
    z: ol.zones,
    ex: ol.ex,
    lowMin: ol.maxLowMin,
    peak: p.peakKm,
    w1: w1.targetKm,
    start: p.startKm,
    drops: p.warnings.filter((x: any) => x.rule === "DOSE_DROPPED").length,
    lsq: p.warnings.some((x: any) => x.rule === "LONG_SHORTER_THAN_QUALITY"),
    targets: p.weeks.map((w: any) => w.targetKm).join(","),
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
  const g = overLong(p0);
  const genOver = Object.values(g.o).some(([a, b]) => a + b > 0);
  if (!r.ok)
    return out({
      key,
      rej: r.reasons
        .map((x: any) => `${x.code}:${x.message}`)
        .join(" | ")
        .slice(0, 240),
      genOver,
    });
  out({ key, ...rec(r.plan), genOver });
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
  const bases = T.adaptBases();
  for (const b of bases) {
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
  const bases = T.earlyGridBases(182, 78, 42);
  const all: [string, any, string, string][] = [];
  for (const b of bases) {
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
  // Široka pretraga organizatora (MAR-04 provera): gridInputs svaki 211., po osećaju 97., početnik 47., M13a 157.;
  // asOf start − 1/−3/−6, sreda i kraj nedelje 1 … N − 2; svih 17 scenarija (lanac: drugi korak nedelju kasnije).
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
