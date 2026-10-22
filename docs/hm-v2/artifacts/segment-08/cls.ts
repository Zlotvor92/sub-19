/* HM-08: pre → posle po scenariju: samo meta (adaptation: mixedWeeks/factKm) / dani / ciljevi. */
import { readFileSync, readdirSync } from "node:fs";
const [a, b, set] = process.argv.slice(2);
const load = (d: string) => Object.assign({}, ...readdirSync(d).filter((f) => f.startsWith(set + ".")).map((f) => JSON.parse(readFileSync(`${d}/${f}`, "utf8"))));
const A: any = load(a), B: any = load(b); const t: Record<string, Record<string, number>> = {}; const ex: Record<string, string[]> = {};
for (const k in A) { const x = A[k], y = B[k]; if (!y || x.rej || y.rej || x.c === y.c) continue;
  const parts = k.split("/"); const sc = set === "early" ? parts.slice(2).join("/") : parts[2];
  const cls = x.t.some((v: number, i: number) => v !== y.t[i]) ? "tgt" : x.wk.some((h: string, i: number) => h !== y.wk[i]) ? "days" : "meta";
  (t[sc] ??= {})[cls] = (t[sc]![cls] ?? 0) + 1; if (cls === "tgt") ((ex[sc] ??= []).length < 2) && ex[sc]!.push(k + " " + x.t.map((v: number, i: number) => v !== y.t[i] ? `${i + 1}:${v}→${y.t[i]}` : "").filter(Boolean).join(" ")); }
console.log(JSON.stringify(t)); console.log(JSON.stringify(ex, null, 0));
