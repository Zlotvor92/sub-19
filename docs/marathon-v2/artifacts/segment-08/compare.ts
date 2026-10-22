/* MAR-08 regresija (JSON redovi segment-08/measure.ts, pre = 46dff18, posle = MAR-08). Menjati se sme SAMO tok čiji
   plan PRE izmene ima mešovitu nedelju posle asOf sa planirano > cilj (`mx`, pouka 37: zaštićeni dani prelaze ono što
   bi bilo sastavljeno za te dane); svaka druga promena (heš plana `h`, sadržaj `hw`, odbijanje) → „neobjašnjeno"
   (STANI); dozvoljeno i kad plan posle nosi adaptation.factKm (dopuna: zbir zaštićenih dana po činjenicama).
   Posle: planirano > cilj (po činjenicama) proverava adaptInvariants; ovde broj tokova sa MIXED_WEEK_OVER.
   Promena CILJA bilo koje nedelje se broji posebno i ispisuje (razlaže se do uzroka). Iz korena:
   node docs/marathon-v2/artifacts/segment-08/compare.ts <dir> <porodica>... (fajlovi <dir>/m-{pre,post}-<porodica>-*.jsonl) */
import { readdirSync, readFileSync } from "node:fs";

const [dir, ...fams] = process.argv.slice(2) as [string, ...string[]];
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
const out: Record<string, unknown> = {};
for (const fam of fams) {
  const A = load("pre", fam);
  const B = load("post", fam);
  let changed = 0;
  let explained = 0;
  let mxPre = 0;
  let warned = 0;
  let tgChanged = 0;
  const tgOdd: string[] = [];
  const odd: string[] = [];
  for (const [k, a] of A) {
    const b = B.get(k);
    if ((a.mx ?? []).length > 0) mxPre++;
    if (!b) {
      odd.push(`${k}: nema posle`);
      continue;
    }
    // Planirano > cilj posle izmene: po činjenicama (zaštićeni dani ≤ asOf, nedelja ostatka pauze ima vlasnika) proverava
    // adaptInvariants (nezavisno; early.ts, mixedGrid, earlyGrid) — ovde se samo broje tokovi sa MIXED_WEEK_OVER.
    if (/MIXED_WEEK_OVER/.test(b.warn ?? "")) warned++;
    if (a.tg !== undefined && a.tg !== b.tg) {
      tgChanged++;
      const wa = String(a.tg).split(",");
      const wb = String(b.tg ?? "").split(",");
      const diff = wa.flatMap((t, i) =>
        t !== wb[i] ? [`ned ${i + 1} ${t}→${wb[i]}`] : [],
      );
      if (tgOdd.length < 20)
        tgOdd.push(`${k} (mx ${JSON.stringify(a.mx)}): ${diff.join(", ")}`);
    }
    if (a.h === b.h && a.hw === b.hw && a.rej === b.rej) continue;
    changed++;
    if (!a.rej && !b.rej && ((a.mx ?? []).length > 0 || b.fk === true))
      explained++;
    else odd.push(`${k}: ${a.rej ?? a.h} → ${b.rej ?? b.h}`);
  }
  // Dopuna (zbir po činjenicama): tokovi koje je verzija „zbir po planu" (m-plan-*) menjala, a „po činjenicama" ne
  // (više nisu stisnuti), i obrnuto.
  const P = load("plan", fam);
  let unsqueezed = 0;
  let newlyCut = 0;
  for (const [k, a] of A) {
    const p = P.get(k);
    const b = B.get(k);
    if (!p || !b) continue;
    const pc = p.h !== a.h || p.hw !== a.hw;
    const bc = b.h !== a.h || b.hw !== a.hw;
    if (pc && !bc) unsqueezed++;
    if (!pc && bc) newlyCut++;
  }
  const rej = (m: Map<string, Rec>) =>
    [...m.values()].filter((r) => r.rej).length;
  out[fam] = {
    flows: A.size,
    rejectedPre: rej(A),
    rejectedPost: rej(B),
    mixedOverPre: mxPre,
    changed,
    explained,
    warnedPost: warned,
    planVersionFlows: P.size,
    unsqueezedVsPlanSum: unsqueezed,
    changedOnlyByFacts: newlyCut,
    targetChanged: tgChanged,
    targetChanges: tgOdd,
    unexplained: odd.length,
    odd: odd.slice(0, 10),
  };
}
console.log(JSON.stringify(out, null, 1));
