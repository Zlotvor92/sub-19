/* HM-07 — regresija po klasi (heš bez oznake verzije). Za svaki plan generatora (sve mreže R/F/B i mreža
   pouke 28 `recent`), tok rane i srednje
   adaptacije (uzorak 4a early.ts 193/97/29, svi asOf i 17 scenarija + lanac) i ciljani tok (4a targeted.ts: pauza 35/20,
   bol 5, ned 3 … N − 4): heš sadržaja (nedelje i plan bez napomena, upozorenja i policyVersion) i heš napomena/
   upozorenja, uz oznake klasa izmerene na planu: a = nedelja sa 2 dana kvaliteta i danom kvaliteta/testa dužim od
   dugog (faza; bez mešovitih nedelja adaptacije), b = RP doza < 4000 m, p35 = nedelje sa napomenom pouke 35,
   w = upozorenja. Poređenje: compare.ts.
   Iz korena repoa (ili korena drugog stabla): node docs/hm-v2/artifacts/segment-07/regress.ts <koren> <gen|recent|early|targeted> <i> <n> > out.json */
import { createHash } from "node:crypto";

const [root, set, si, sn] = process.argv.slice(2) as [
  string,
  string,
  string,
  string,
];
const lib = await import(`${root}/docs/generators-v2/final-check/lib.ts`);
const d = lib.distOf("HM");
const shard = Number(si);
const shards = Number(sn);
const h = (x: unknown) =>
  createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 12);
type W = {
  phase: string;
  deload: boolean;
  notes: string[];
  days: {
    role: string;
    workout: {
      kind: string;
      sec: number;
      dose?: { zone: string; doseM: number } | null;
    };
  }[];
};
type P = {
  policyVersion: string;
  notes: string[];
  warnings: { rule: string; message: string }[];
  weeks: (W & { index: number })[];
  adaptation?: { mixedWeeks: number[] };
};
function rec(p: P) {
  const { policyVersion: _v, notes, warnings, weeks, ...rest } = p;
  const content = { ...rest, weeks: weeks.map(({ notes: _n, ...w }) => w) };
  const meta = { notes, warnings, wn: weeks.map((w) => w.notes) };
  const a: string[] = [];
  let b = 0;
  let p35 = 0;
  const mixed = new Set(p.adaptation?.mixedWeeks ?? []);
  for (const w of weeks) {
    if (w.notes.some((n) => n.includes("(pouka 35)"))) p35++;
    if (mixed.has(w.index)) continue;
    const long = w.days.find((x) => x.role === "long");
    const qs = w.days.filter((x) => x.workout.kind === "quality");
    const qt = w.days.filter(
      (x) => x.workout.kind === "quality" || x.workout.kind === "test",
    );
    if (
      long &&
      qs.length >= 2 &&
      qt.some((x) => x.workout.sec > long.workout.sec)
    )
      a.push(w.deload ? "deload" : w.phase);
    for (const x of w.days)
      if (x.workout.dose?.zone === "RP" && x.workout.dose.doseM < 4000) b++;
  }
  return {
    c: h(content),
    m: h(meta),
    a: [...new Set(a)].join("+"),
    b,
    w: [...new Set(warnings.map((v) => v.rule))].sort().join(","),
    p35,
  };
}
const out: Record<string, unknown> = {};
const put = (
  k: string,
  r: { ok: boolean; plan?: P; reasons?: { code: string }[] },
) =>
  (out[k] = r.ok
    ? rec(r.plan!)
    : { rej: r.reasons!.map((x) => x.code).join(",") });
if (set === "gen") {
  d.all().forEach((b: { id: string; input: unknown }, i: number) => {
    if (i % shards === shard) put(`${b.id}`, d.generate(b.input));
  });
} else if (set === "recent") {
  // Mreža pouke 28 (recent.harness: 10 944 ulaza, raspored A).
  const T = await import(
    `${root}/web/src/domain/generators/halfMarathon/v2/testInputs.ts`
  );
  const G = await import(
    `${root}/web/src/domain/generators/halfMarathon/v2/generate.ts`
  );
  let i = 0;
  for (const days of T.DAY_COUNTS)
    for (let r = 5; r <= 42; r++)
      for (
        let km = T.KM_BY_DAYS[days].min;
        km <= T.KM_BY_DAYS[days].max;
        km += 5
      )
        for (const vdot of [30, 45, 70])
          for (const weeks of [10, 14, 20])
            if (i++ % shards === shard)
              put(
                `d${days}-${weeks}w-${km}km-v${vdot}-r${r}`,
                G.generateHmV2(
                  T.inputOf({
                    weeks,
                    km,
                    vdot,
                    days: T.SCHEDULES_BY_DAYS[days].A.days,
                    recentLongRunKm: r,
                  }),
                ),
              );
} else if (set === "early") {
  const { bases } = lib.sampleBases(d, { R: 193, F: 97, B: 29 });
  bases.forEach((b: { id: string; input: unknown }, bi: number) => {
    if (bi % shards !== shard) return;
    const g = d.generate(b.input);
    if (!g.ok) return;
    const p = g.plan;
    const N = p.weeks.length;
    const asOfs: [string, string][] = [1, 3, 6].map((k) => [
      `pre${k}`,
      lib.addDays(p.input.startDate, -k),
    ]);
    for (let i = 1; i <= N - 2; i++) {
      const w = p.weeks[i - 1];
      asOfs.push([`w${i}wed`, lib.wedOf(w.startDate)], [`w${i}end`, w.endDate]);
    }
    for (const [tag, at] of asOfs)
      for (const s of lib.SCENARIOS) {
        const k = `${b.id}/${tag}/${s}`;
        const r = d.adapt(p, d.facts(p, s, at), at);
        put(k, r);
        if (r.ok && s === "chain") {
          const at2 = lib.addDays(at, 7);
          if (at2 < p.input.raceDate)
            put(`${k}/2`, d.adapt(r.plan, d.chain2(p, at2), at2));
        }
      }
  });
} else {
  const every: Record<string, number> = { R: 61, F: 31, B: 17 };
  const seen: Record<string, number> = {};
  const bases = d.all().filter((b: { family: string }) => {
    const i = (seen[b.family] = (seen[b.family] ?? -1) + 1);
    return i % every[b.family]! === 0;
  });
  bases.forEach((b: { id: string; input: unknown }, bi: number) => {
    if (bi % shards !== shard) return;
    const g = d.generate(b.input);
    if (!g.ok) return;
    const p = g.plan;
    const N = p.weeks.length;
    for (let i = 3; i <= N - 4; i++)
      for (const s of ["pause35", "pause20", "pain5"]) {
        const asOf =
          s === "pain5"
            ? lib.wedOf(p.weeks[i - 1].startDate)
            : p.weeks[i - 1].endDate;
        put(`${b.id}/w${i}/${s}`, d.adapt(p, d.facts(p, s, asOf), asOf));
      }
  });
}
console.log(JSON.stringify(out));
