/* HM-08: poređenje reg37 pre/posle. node cmp37.ts <pre-dir> <post-dir> <set> */
import { readFileSync, readdirSync } from "node:fs";
const [a, b, set] = process.argv.slice(2) as [string, string, string];
const load = (dir: string) => Object.assign({}, ...readdirSync(dir).filter((f) => f.startsWith(set + ".") || f === set + ".json").map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))));
const A: Record<string, any> = load(a), B: Record<string, any> = load(b);
const n: Record<string, number> = {}; const ex: Record<string, string[]> = {};
const add = (k: string, e: string) => { n[k] = (n[k] ?? 0) + 1; ((ex[k] ??= []).length < 3) && ex[k]!.push(e); };
let maxTgtDrop = 0;
for (const k of Object.keys(A)) {
  add("total", k);
  const x = A[k], y = B[k];
  if (!y) { add("missing", k); continue; }
  if (x.rej || y.rej) { if (!x.rej && y.rej) add("newRej:" + y.rej, k); else if (x.rej && !y.rej) add("fixedRej", k); else if (x.rej !== y.rej) add("rejChanged", k); continue; }
  if (x.c === y.c) continue;
  const mo = new Set<number>(x.mo);
  if (mo.size === 0) { add("changed:x", k); continue; }
  add("changed:p37", k);
  const wks = x.wk.map((h: string, i: number) => (h !== y.wk[i] ? i + 1 : 0)).filter(Boolean);
  const other = wks.filter((w: number) => !mo.has(w));
  const tg = x.t.map((t: number, i: number) => (t !== y.t[i] ? i + 1 : 0)).filter(Boolean);
  if (other.length > 0) add("p37:otherWeeksChanged", `${k} mo ${[...mo]} chg ${wks}`);
  if (tg.length > 0) { add("p37:targetsChanged", `${k} ${tg.map((i: number) => `${i}:${x.t[i-1]}→${y.t[i-1]}`).join(" ")}`); for (const i of tg) maxTgtDrop = Math.max(maxTgtDrop, x.t[i-1] - y.t[i-1]); }
}
console.log(JSON.stringify({ n, maxTgtDrop: +maxTgtDrop.toFixed(1), ex }, null, 1));
