/* P5-HM — udeo rada prvog T dana i prvog I dana (rad / trajanje dana) po grupi, iz raw-<oznaka>.json.
   Iz web/: node ../docs/generators-v2/perfection/P5-HM/tshare.ts pre posle */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2; };
for (const tag of process.argv.slice(2)) {
  const rows = JSON.parse(readFileSync(`${dir}raw-${tag}.json`, "utf8"));
  for (const fam of ["R", "F"]) for (const z of ["T", "I"]) {
    const xs: number[] = [];
    for (const r of rows.filter((x: any) => x.family === fam && x.weeksJson)) {
      const days = r.weeksJson.flatMap((w: string) => JSON.parse(w).days);
      const d = days.find((d: any) => d.workout.kind === "quality" && d.workout.dose?.zone === z);
      if (!d) continue;
      const work = d.workout.segments.filter((s: any) => (s.kind === "rep" || s.kind === "continuous") && s.zone === z).reduce((a: number, s: any) => a + s.sec, 0);
      xs.push(Math.round((100 * work) / d.workout.sec));
    }
    console.log(`${tag} ${fam} prvi ${z} dan: udeo rada ${med(xs)} % [${Math.min(...xs)}–${Math.max(...xs)}] n ${xs.length}`);
  }
}
