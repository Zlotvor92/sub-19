/* P2 — razlaganje ukupnog MP po izvoru (MP trening izgradnje / blok u dugom / taper / oštrenje) i neuspele nedelje B
   po grupi. Iz web/: node ../docs/generators-v2/perfection/P2/breakdown.ts <oznaka> [<oznaka2>] */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
type Seg = { kind: string; zone?: string; km: number };
type Day = { role: string; workout: { kind: string; segments: Seg[]; title: string } };
type R = { id: string; family: string; days: number; weeks: number; rejected?: string[]; weeksJson?: string; p2?: any };
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const r1 = (x: number) => Math.round(x * 10) / 10;
function parts(r: R): Record<string, number> {
  const W = JSON.parse(r.weeksJson!) as Day[][];
  const o = { trening: 0, blok: 0, taper: 0, ostrenje: 0 };
  const N = W.length;
  W.forEach((days, i) => {
    for (const d of days) {
      const mp = d.workout.segments.filter((s) => s.zone === "MP" && (s.kind === "rep" || s.kind === "continuous")).reduce((a, s) => a + s.km, 0);
      if (!mp) continue;
      if (d.role === "long") o.blok += mp;
      else if (d.role === "sharpener") o.ostrenje += mp;
      else if (i >= N - 3) o.taper += mp;
      else o.trening += mp;
    }
  });
  return o;
}
const load = (t: string): R[] => JSON.parse(readFileSync(`${dir}raw-MAR-${t}.json`, "utf8")) as R[];
const tags = process.argv.slice(2);
for (const t of tags) {
  const rs = load(t).filter((r) => r.weeksJson);
  for (const fam of ["R", "F", "B"]) {
    const xs = rs.filter((r) => r.family === fam).map(parts);
    console.log(`${t} ${fam}: trening ${r1(med(xs.map((x) => x.trening)))}, blok ${r1(med(xs.map((x) => x.blok)))}, taper ${r1(med(xs.map((x) => x.taper)))}, oštrenje ${r1(med(xs.map((x) => x.ostrenje)))}, ukupno ${r1(med(xs.map((x) => x.trening + x.blok + x.taper + x.ostrenje)))}`);
  }
  // nedelje B koje ne staju (po rasporedu B, sastavljene kao A — napomena M19)
  const grp: Record<string, [number, number, number]> = {};
  for (const r of rs) {
    if (r.days === 3 || r.family === "B") continue;
    const types: string = r.p2.types;
    const want = [...types].reverse().map((_, k) => (k % 2 === 0 ? "B" : "A")).reverse().join("");
    const miss = [...types].filter((c, i) => want[i] === "B" && c !== "B").length;
    const g = `${r.family} ${r.days} d`;
    const a = (grp[g] ??= [0, 0, 0]);
    a[0]++; if (miss > 0) a[1]++; a[2] += miss;
  }
  console.log(`${t} nedelja B po rasporedu koja nije B: ${Object.entries(grp).map(([g, [n, p, w]]) => `${g} ${p}/${n} planova (${Math.round((100 * p) / n)} %), ${w} ned`).join("; ")}`);
}
