/* MAR-07 regresija (pre/posle, JSON redovi measure.ts). Menjati se smeju SAMO: (a) tok ranije odbijen (N1); (b) plan/tok
   koji je pre imao nedelju izgradnje sa dva dana kvaliteta i danom kvaliteta dužim od dugog (pouka 35); (c) tok sa
   umorom (pouka 36); (e) samo napomene i upozorenja (N11, pouka 14, N8 — sadržaj `hw` isti). Svaki drugi promenjen →
   „neobjašnjeno" (STANI). Iz korena: node docs/marathon-v2/artifacts/segment-07/compare.ts <dir> <pre> <posle>
   (fajlovi <dir>/m-<oznaka>-<porodica>-<k>of<m>.jsonl). Izlaz: JSON na stdout. */

import { readdirSync, readFileSync } from "node:fs";

const [dir, A, B] = process.argv.slice(2) as [string, string, string];
type Rec = Record<string, any>;
const load = (tag: string, fam: string): Map<string, Rec> => {
  const m = new Map<string, Rec>();
  for (const f of readdirSync(dir).filter(
    (x) => x.startsWith(`m-${tag}-${fam}-`) && x.endsWith(".jsonl"),
  ))
    for (const l of readFileSync(`${dir}/${f}`, "utf8").split("\n"))
      if (l) {
        const r = JSON.parse(l) as Rec;
        m.set(r.key, r);
      }
  return m;
};
const rules = (r: Rec | undefined): Map<string, number> =>
  new Map(
    String(r?.warn ?? "")
      .split(",")
      .filter(Boolean)
      .map((x) => [x.split(":")[0]!, Number(x.split(":")[1])]),
  );
const pct = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))]! : 0;
};
const out: Record<string, unknown> = {};
for (const fam of [
  "grid",
  "recent",
  "dense",
  "feel",
  "beg",
  "a04",
  "early",
  "pre",
  "wide",
]) {
  const a = load(A, fam);
  const b = load(B, fam);
  if (a.size === 0 && b.size === 0) continue;
  const cat: Record<string, number> = {};
  const ruleDiff: Record<string, number> = {};
  const unexplained: string[] = [];
  const newRej: string[] = [];
  let changed = 0;
  for (const [k, rb] of b) {
    const ra = a.get(k);
    if (!ra) {
      unexplained.push(`${k}: nema pre`);
      continue;
    }
    if (rb.rej && !ra.rej) newRej.push(`${k}: ${rb.rej}`);
    if (ra.h === rb.h && ra.rej === rb.rej) continue;
    changed++;
    let c: string;
    if (ra.rej) c = "a_odbijen_pre";
    else if (rb.rej) c = "NOVO_ODBIJANJE";
    else if (ra.hw === rb.hw) c = "e_samo_napomene_upozorenja";
    else if (ra.q2?.length > 0) c = "b_pouka35";
    else if (k.includes("fatigue")) c = "c_umor";
    else c = "NEOBJAŠNJENO";
    cat[c] = (cat[c] ?? 0) + 1;
    if (c === "NEOBJAŠNJENO" || c === "NOVO_ODBIJANJE")
      unexplained.length < 20 && unexplained.push(`${k} (${c})`);
    if (c === "e_samo_napomene_upozorenja") {
      const x = rules(ra);
      const y = rules(rb);
      for (const r of new Set([...x.keys(), ...y.keys()]))
        if ((x.get(r) ?? 0) !== (y.get(r) ?? 0)) {
          const d = `${r} ${x.get(r) ?? 0}→${y.get(r) ?? 0}`.replace(
            /\d+→\d+/,
            (m) =>
              Number(m.split("→")[0]) > Number(m.split("→")[1])
                ? "manje"
                : "više",
          );
          ruleDiff[d] = (ruleDiff[d] ?? 0) + 1;
        }
      if (ra.warn === rb.warn)
        ruleDiff["isto pravilo, drugi tekst/napomena"] =
          (ruleDiff["isto pravilo, drugi tekst/napomena"] ?? 0) + 1;
    }
  }
  const ok = (m: Map<string, Rec>) =>
    [...m.values()].filter((r) => !r.rej && !r.gen);
  const rej = (m: Map<string, Rec>) =>
    [...m.values()].filter((r) => r.rej).length;
  const withRule = (m: Map<string, Rec>, r: string) =>
    ok(m).filter((x) => rules(x).has(r)).length;
  const lines = (m: Map<string, Rec>) => ok(m).map((x) => x.lines as number);
  const q2 = (m: Map<string, Rec>) =>
    ok(m).filter((x) => x.q2.length > 0).length;
  out[fam] = {
    n: b.size,
    rejected: [rej(a), rej(b)],
    changed,
    categories: cat,
    warningRuleDiff: ruleDiff,
    plansTwoQualityDayLongerThanLong: [q2(a), q2(b)],
    marathonLongShortPct: [a, b].map(
      (m) =>
        Math.round(
          (1000 * withRule(m, "MARATHON_LONG_SHORT")) /
            Math.max(1, ok(m).length),
        ) / 10,
    ),
    shownLines: [a, b].map((m) => ({
      median: pct(lines(m), 0.5),
      p90: pct(lines(m), 0.9),
      max: lines(m).reduce((x, y) => Math.max(x, y), 0),
    })),
    newRejections: newRej.slice(0, 10),
    unexplained,
  };
}
console.log(JSON.stringify(out, null, 1));
