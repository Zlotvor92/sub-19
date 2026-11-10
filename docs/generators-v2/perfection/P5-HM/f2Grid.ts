/* P5-HM — F2 mreža tokova adaptacije: planovi mreže P0 (192) × asOf u nedelji baze, razvoja i specifične faze (dan
   posle drugog zahtevnog dana te nedelje / prethodne) × scenario: dva poslednja zahtevna dana preskočena (skip), oba
   RPE 9 (rpe), jedan preskočen + jedan RPE 9 (mix); uz to bol 5 (pain), umor (2 lagana RPE 7, fat), kontrola (ok:
   oba odrađena RPE 6). Svi ostali dani u 14 dana odrađeni po planu; pokrivenost 14 dana potpuna.
   Meri: odbijanja (adaptHmV2 ok:false), primenjen QUALITY_STRAIN, nedelja n — da li je ijedan slot podigao dozu, broj
   odbijanja po kodu, i ponovljen korak sa istim zapisima (sutra) — ne sme da napravi nov.
   Iz web/: node ../docs/generators-v2/perfection/P5-HM/f2Grid.ts */
import { grid } from "../P0/common.ts";
import { addDays } from "../../final-check/lib.ts";
const B = "../../../../web/src/domain/generators/halfMarathon/v2";
const { generateHmV2 } = await import(`${B}/generate.ts`);
const { adaptHmV2 } = await import(`${B}/adapt.ts`);
const md = (d: string) => Math.round(Date.parse(d + "T00:00:00Z") / 864e5);
const out: Record<string, any> = {};
const rej: string[] = [];
const bump = (k: string, f: string) => { (out[k] ??= {})[f] = (out[k][f] ?? 0) + 1; };
for (const c of grid("HM")) {
  const g: any = generateHmV2(c.input);
  if (!g.ok) continue;
  const plan = g.plan;
  const qdays = plan.weeks.flatMap((w: any) => w.days.filter((d: any) => d.role === "q1" || d.role === "q2" || (d.role === "long" && d.workout.workKm.RP > 0)).map((d: any) => ({ w, d })));
  for (const phase of ["base", "development", "specific"]) {
    // poslednji par zahtevnih dana u fazi (ne-rasteretna nedelja): asOf = dan posle drugog
    const inPh = qdays.filter((x: any) => x.w.phase === phase && !x.w.deload);
    if (inPh.length < 2) continue;
    const pick = inPh[Math.min(inPh.length - 1, 3)];
    const i = qdays.indexOf(pick);
    const [d1, d2] = [qdays[i - 1].d, qdays[i].d];
    const asOf = d2.date;
    for (const sc of ["skip", "rpe", "mix", "ok", "skip+pain", "rpe+fat", "rpe+pain"]) {
      const from = addDays(asOf, -13);
      const days = plan.weeks.flatMap((w: any) => w.days).filter((d: any) => md(d.date) >= md(from) && md(d.date) <= md(asOf) && d.role !== "race");
      const workouts: any[] = [];
      for (const d of days) {
        const isQ = d.date === d1.date || d.date === d2.date;
        const kind = sc.split("+")[0];
        if (isQ && (kind === "skip" || (kind === "mix" && d.date === d1.date))) { workouts.push({ date: d.date, dayId: d.date, km: 0, durationSec: 0, completed: false }); continue; }
        const rpe = isQ ? (kind === "ok" ? 6 : 9) : d.role === "easy" && sc.endsWith("+fat") && md(d.date) > md(asOf) - 6 ? 7 : 4;
        workouts.push({ date: d.date, dayId: d.date, km: d.workout.km, durationSec: d.workout.sec, completed: true, rpe, ...(sc.endsWith("+pain") && d.date === asOf ? { pain: 5 } : {}) });
      }
      if (sc.endsWith("+pain") && !workouts.some((x) => x.pain)) workouts.push({ date: asOf, km: 3, durationSec: 1200, completed: true, pain: 5 });
      if (sc.endsWith("+fat") && workouts.filter((x) => x.rpe === 7).length < 2) workouts.push({ date: addDays(asOf, -1), km: 4, durationSec: 1500, completed: true, rpe: 7 }, { date: addDays(asOf, -2), km: 4, durationSec: 1500, completed: true, rpe: 7 });
      const facts = { workouts, coverage: { from, to: asOf, complete: true } };
      const k = `${phase}|${sc}`;
      const r: any = adaptHmV2(plan, facts, asOf);
      if (!r.ok) { bump(k, "odbijeno"); rej.push(`${c.id} ${k}: ${r.reasons.map((x: any) => x.code).join(",")} ${(r.violations ?? []).slice(0, 2).map((v: any) => v.rule + " " + v.message).join(" | ")}`); continue; }
      bump(k, "n");
      const q = r.reasons.find((x: any) => x.condition === "QUALITY_STRAIN");
      if (q) bump(k, q.applied ? "F2 primenjen" : "F2 nije primenjen");
      const others = r.reasons.filter((x: any) => x.applied && ["PAIN", "PAUSE", "FATIGUE", "UNDER_EXECUTION"].includes(x.condition)).map((x: any) => x.condition);
      for (const o of others) bump(k, `uz ${o}`);
      const step = r.plan.adaptation.steps.at(-1);
      if (step.qualityHold) {
        const w = r.plan.weeks[step.qualityHold - 1], prev = r.plan.weeks.slice(0, step.qualityHold - 1).reverse().find((x: any) => !x.deload && ["base", "development", "specific"].includes(x.phase));
        const dose = (wk: any, role: string) => wk?.days.find((d: any) => d.role === role)?.workout.dose;
        let rose = false;
        for (const role of ["q1", "q2"]) { const a = dose(prev, role), b = dose(w, role); if (a && b && a.ladder === b.ladder && b.doseM > a.doseM) rose = true; }
        const blk = (wk: any) => wk?.days.find((d: any) => d.role === "long")?.workout.workKm.RP ?? 0;
        const lastBlk = r.plan.weeks.slice(0, step.qualityHold - 1).map(blk).filter((x: number) => x > 0).pop() ?? 0;
        if (lastBlk > 0 && blk(w) > lastBlk) rose = true;
        if (rose) bump(k, "doza porasla (greška)");
        const g0: any = adaptHmV2(plan, { workouts: [], coverage: { from, to: asOf, complete: false } }, asOf);
        if (g0.ok) { const w0 = g0.plan.weeks[step.qualityHold - 1]; if (JSON.stringify(w0.days.map((d: any) => d.workout.dose)) !== JSON.stringify(w.days.map((d: any) => d.workout.dose))) bump(k, "nedelja n promenjena"); }
        if (w.notes.some((n: string) => n.startsWith("Doza ove nedelje ne raste"))) bump(k, "napomena");
        else bump(k, `bez napomene: ${w.phase}${w.deload ? "*" : ""} q:${w.days.filter((d: any) => d.workout.kind === "quality").length} test:${w.days.some((d: any) => d.role === "test")} lim:${w.limits ? 1 : 0}`);
        // sutra: isti zapisi → bez novog koraka
        const r2: any = adaptHmV2(r.plan, { workouts, coverage: { from, to: addDays(asOf, 1), complete: true } }, addDays(asOf, 1));
        if (!r2.ok) bump(k, "sutra odbijeno");
        else if (r2.plan.adaptation.steps.at(-1).qualityHold) bump(k, "sutra ponovo (greška)");
      }
    }
  }
}
console.log(JSON.stringify(out, null, 1));
console.log(`odbijeno ${rej.length}`); for (const x of rej.slice(0, 15)) console.log("  " + x);
