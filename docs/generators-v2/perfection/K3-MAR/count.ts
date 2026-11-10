/* K3-MAR — broj planova sa upozorenjem po porodici u snimku: node count.ts <oznaka> <PRAVILO>[,...] */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const [tag, rules] = process.argv.slice(2);
const S = JSON.parse(readFileSync(`${dir}snap-${tag}.json`, "utf8"));
for (const r of rules!.split(",")) {
  const c: Record<string, number> = {};
  for (const x of Object.values(S) as any[]) if (x.ok && x.m.warn.includes(r)) c[x.fam] = (c[x.fam] ?? 0) + 1;
  console.log(tag, r, JSON.stringify(c));
}
