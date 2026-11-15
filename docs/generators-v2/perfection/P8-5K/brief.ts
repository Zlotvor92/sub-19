/* P8-5K — kratak ispis 12 profila iz sirovih planova (P8-5K/plans/5K-NN.json → brief-NN.txt).
   Iz web/: node ../docs/generators-v2/perfection/P8-5K/brief.ts
   Red nedelje: indeks, faza (*D rasterećenje, *T test), t cilj, p planirano, L dugi, max najduži dan | kvalitet[km dana, min
   rada zone (bez oporavka, WU/CD)]. Na kraju upozorenja plana (pravilo, nedelja, tekst). */
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL("./plans/", import.meta.url).pathname;
for (let i = 1; i <= 12; i++) {
  const nn = String(i).padStart(2, "0");
  const { plan: p } = JSON.parse(readFileSync(`${dir}5K-${nn}.json`, "utf8"));
  const out: string[] = [`${p.policyVersion} exp ${p.experience} start ${p.startKm} peak ${p.peakKm} cap ${p.capacityKm} days ${p.input.runDays.length}`];
  for (const w of p.weeks) {
    const long = w.days.find((d: any) => d.role === "long");
    const max = Math.max(...w.days.map((d: any) => d.workout.km));
    const q = w.days.filter((d: any) => d.workout.kind === "quality" || d.role === "race").map((d: any) => {
      const work = d.workout.segments.filter((s: any) => ["rep", "tempo", "test", "race"].includes(s.kind) || (s.zone && !["E", "jog", "walk"].includes(s.zone) && !["recovery", "warmup", "cooldown", "stride"].includes(s.kind))).reduce((a: number, s: any) => a + s.sec, 0);
      return `${d.role}:${String(d.workout.title).replace(/ \(oporavak.*\)/, "")}[${d.workout.km.toFixed(1)}km,${Math.round(work / 60)}m]`;
    });
    out.push(`${w.index} ${w.phase}${w.deload ? "*D" : ""}${w.test ? "*T" : ""} t${w.targetKm} p${w.plannedKm} L${long ? long.workout.km : "-"} max${max.toFixed(1)} | ${q.join(" ; ")}`);
  }
  for (const v of p.warnings) out.push(` W ${v.rule} ${v.week ?? "-"} ${v.message}`);
  writeFileSync(`${dir}brief-${nn}.txt`, out.join("\n") + "\n");
}
