/* P5-MAR — dodatne mere iz raw-<oznaka>.json: udeo rada prvog T dana i prvog I dana [%], nedelje > 25 % brzih km sa i
   bez ubrzanja (R stride) i testa. Iz web/: node ../docs/generators-v2/perfection/P5-MAR/extra.ts pre posle */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const cell = (xs: number[]) => `${med(xs)} [${Math.min(...xs)}–${Math.max(...xs)}]`;
for (const tag of process.argv.slice(2)) {
  const R = JSON.parse(readFileSync(`${dir}raw-${tag}.json`, "utf8")).filter((r: any) => r.m && r.family !== "B");
  const share: Record<string, number[]> = { T: [], I: [] };
  let over = 0, overNoStr = 0, overNoStrTest = 0;
  for (const r of R) {
    const W = JSON.parse(r.weeksJson) as any[][];
    for (const z of ["T", "I"]) {
      const d = W.flat().find((x) => x.workout.kind === "quality" && x.workout.segments.some((s: any) => (s.kind === "rep" || s.kind === "continuous") && s.zone === z));
      if (d) share[z]!.push(Math.round((100 * d.workout.segments.filter((s: any) => s.kind === "rep" || s.kind === "continuous").reduce((a: number, s: any) => a + s.sec, 0)) / d.workout.sec));
    }
    for (const days of W.slice(0, -1)) {
      let f = 0, f2 = 0, f3 = 0, t = 0;
      for (const d of days) for (const s of d.workout.segments) {
        t += s.km;
        const fast = s.zone && !["E", "jog", "walk"].includes(s.zone);
        if (fast) { f += s.km; if (s.kind !== "stride") { f2 += s.km; if (s.kind !== "test") f3 += s.km; } }
      }
      if (f / t > 0.25) over++; if (f2 / t > 0.25) overNoStr++; if (f3 / t > 0.25) overNoStrTest++;
    }
  }
  console.log(`${tag} (R+F, n ${R.length}): udeo rada prvog T dana ${cell(share.T!)} %, prvog I dana ${cell(share.I!)} %; nedelja > 25 % brzih: ${over} (bez ubrzanja ${overNoStr}, bez ubrzanja i testa ${overNoStrTest})`);
}
