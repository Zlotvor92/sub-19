// Poređenje regress.ts pre (46e72eb) i posle (06i). Iz web/: node ../docs/10k-v2/artifacts/segment-06i/regress-cmp.ts <dir>
// (<dir>/old.<k>.txt, <dir>/new.<k>.txt). Promenjen tok: drugi heš plana. Uslov 06i: promenjen ⇒ rezultat ima nedelju
// pouke 37, nedelje pre prve nedelje pouke 37 iste, ciljevi nedelja isti; odbijanja posle 0.
import { readFileSync, readdirSync } from "node:fs";
const dir = process.argv[2]!;
const load = (pre: string) => {
  const m = new Map<string, string[]>();
  for (const f of readdirSync(dir).filter(
    (x) => x.startsWith(pre + ".") && x.endsWith(".txt"),
  ))
    for (const l of readFileSync(`${dir}/${f}`, "utf8").split("\n")) {
      if (!l) continue;
      const x = l.split("|");
      m.set(x.slice(0, 3).join("|"), x.slice(3));
    }
  return m;
};
const o = load("old"),
  n = load("new");
const by: Record<
  string,
  { flows: number; changed: number; p37: number; over: number }
> = {};
const bad: Record<string, string[]> = {
  noP37: [],
  prefix: [],
  target: [],
  rejectedNew: [],
  missing: [],
  p37Unchanged: [],
};
let flows = 0,
  changed = 0,
  rejOld = 0,
  rejNew = 0;
for (const [k, a] of o) {
  const b = n.get(k);
  if (!b) {
    bad.missing!.push(k);
    continue;
  }
  flows++;
  const s = k.split("|")[2]!;
  const st = (by[s] ??= { flows: 0, changed: 0, p37: 0, over: 0 });
  st.flows++;
  if (a[0] === "rej") rejOld++;
  if (b[0] === "rej") {
    rejNew++;
    bad.rejectedNew!.push(`${k} ${b[1]}`);
    continue;
  }
  if (a[0] === "rej") continue;
  const note = Number(b[4]);
  if (a[1] === b[1]) {
    if (note > 0) bad.p37Unchanged!.push(k);
    continue;
  }
  changed++;
  st.changed++;
  if (note === 0) {
    bad.noP37!.push(k);
    continue;
  }
  st.p37++;
  if (Number(b[5]) > 0) st.over++;
  const wa = a[2]!.split(","),
    wb = b[2]!.split(",");
  if (wa.slice(0, note - 1).join() !== wb.slice(0, note - 1).join())
    bad.prefix!.push(k);
  if (a[3] !== b[3]) bad.target!.push(`${k} ${a[3]} → ${b[3]}`);
}
console.log(
  JSON.stringify(
    {
      flows,
      changed,
      rejOld,
      rejNew,
      by,
      bad: Object.fromEntries(
        Object.entries(bad).map(([k, v]) => [
          k,
          { n: v.length, ex: v.slice(0, 5) },
        ]),
      ),
    },
    null,
    1,
  ),
);
