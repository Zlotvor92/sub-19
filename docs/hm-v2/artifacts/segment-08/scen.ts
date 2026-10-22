/* HM-08: promene po scenariju između dva skupa reg37 (npr. A bez činjenica → A sa činjenicama). */
import { readFileSync, readdirSync } from "node:fs";
const [a, b, set] = process.argv.slice(2);
const load = (d: string) => Object.assign({}, ...readdirSync(d).filter((f) => f.startsWith(set + ".")).map((f) => JSON.parse(readFileSync(`${d}/${f}`, "utf8"))));
const A: any = load(a), B: any = load(b); const t: Record<string, number> = {};
for (const k in A) { const x = A[k], y = B[k]; if (!y) continue; const s = k.split("/").slice(2).join("/") || k.split("/")[1];
  const sc = s.replace(/^w\d+\//, ""); t[sc + ":n"] = (t[sc + ":n"] ?? 0) + 1;
  if (x.rej !== y.rej) t[sc + ":rej"] = (t[sc + ":rej"] ?? 0) + 1; else if (x.c !== y.c) t[sc + ":chg"] = (t[sc + ":chg"] ?? 0) + 1;
  if (!x.rej && !y.rej && x.t.some((v: number, i: number) => v !== y.t[i])) t[sc + ":tgt"] = (t[sc + ":tgt"] ?? 0) + 1;
  if (!x.rej && !y.rej) { t[sc + ":moA"] = (t[sc + ":moA"] ?? 0) + (x.mo.length > 0 ? 1 : 0); t[sc + ":moB"] = (t[sc + ":moB"] ?? 0) + (y.mo.length > 0 ? 1 : 0); } }
console.log(JSON.stringify(t));
