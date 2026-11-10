/* P5-MAR — mreža tokova adaptacije za F2 (A18): planovi mreže P0 (R i F, svi dani, svi obimi/VDOT/pripreme) × asOf =
   dan drugog od dva uzastopna kvalitetna dana u nedelji baze, razvoja i specifične faze (prva ne-rasteretna nedelja
   faze u kojoj postoje ≥ 2 kvalitetna dana pre asOf) × varijanta: rpe9 (oba RPE 9), skip (oba neodrađena), alone
   (samo jedan RPE 9 — okidača nema), +fatigue (rpe9 i 2 lagana RPE 7 → umor, F2 applied false), +under (rpe9 i
   izvršeno 50 % → manjak, applied false). Ostali dani odrađeni po planu; pokrivenost 28 dana do asOf.
   Mere: odbijanja, applied, nedelja bez rasta, doza te nedelje ≤ poslednje doze (po slotu), cilj obima isti kao bez F2.
   Iz web/: node ../docs/generators-v2/perfection/P5-MAR/f2flows.ts  → P5-MAR/f2flows.json */
import { writeFileSync } from "node:fs";
import { grid } from "../P0/common.ts";
const M = "../../../../web/src/domain/generators/marathon/v2/";
const { generateMarathonV2, adaptMarathonV2 } = await import(
  new URL(`${M}index.ts`, import.meta.url).href
);
const dates = await import(new URL(`${M}dates.ts`, import.meta.url).href);
type Day = {
  date: string;
  role: string;
  workout: {
    kind: string;
    km: number;
    sec: number;
    workKm: Record<string, number>;
    dose: { ladder: string; doseM: number } | null;
  };
};
type Wk = {
  index: number;
  phase: string;
  deload: boolean;
  targetKm: number;
  days: Day[];
};
const isQ = (d: Day) =>
  (d.role === "q1" ||
    d.role === "q2" ||
    (d.role === "long" && d.workout.workKm.MP > 0)) &&
  d.workout.kind !== "test";
const out: Record<string, unknown>[] = [];
const cnt: Record<string, number> = {};
const deltas: number[] = [];
const inc = (k: string) => (cnt[k] = (cnt[k] ?? 0) + 1);
const t0 = Date.now();
for (const c of grid("MAR").filter((c) => c.family !== "B")) {
  const g = generateMarathonV2(c.input);
  if (!g.ok) continue;
  const W = g.plan.weeks as Wk[];
  for (const phase of ["base", "development", "specific"]) {
    const qAll = W.flatMap((w) => w.days.filter(isQ).map((d) => ({ d, w })));
    const wk = W.find(
      (w) =>
        w.phase === phase &&
        !w.deload &&
        qAll.filter((x) => x.d.date <= (w.days.filter(isQ).pop()?.date ?? ""))
          .length >= 2 &&
        w.days.filter(isQ).length >= 1,
    );
    if (!wk) {
      inc(`${phase}: nema nedelje`);
      continue;
    }
    const b = wk.days.filter(isQ).pop()!;
    const i = qAll.findIndex((x) => x.d.date === b.date);
    const a = qAll[i - 1]!.d;
    const asOf = b.date;
    for (const v of ["rpe9", "skip", "alone", "fatigue", "under"]) {
      const from = dates.addDays(asOf, -27);
      const days = W.flatMap((w) => w.days).filter(
        (d) => d.date >= from && d.date <= asOf && d.role !== "race",
      );
      let easyHard = 0;
      const workouts = days.flatMap((d) => {
        const hard = d.date === b.date || (d.date === a.date && v !== "alone");
        if (hard && v === "skip")
          return [
            {
              date: d.date,
              dayId: d.date,
              km: 0,
              durationSec: 0,
              completed: false,
            },
          ];
        const under = v === "under" && dates.daysBetween(d.date, asOf) < 7;
        let rpe = hard ? 9 : 5;
        if (
          v === "fatigue" &&
          d.role === "easy" &&
          dates.daysBetween(d.date, asOf) < 7 &&
          easyHard < 2
        ) {
          rpe = 7;
          easyHard++;
        }
        return [
          {
            date: d.date,
            dayId: d.date,
            km: under ? Math.round(d.workout.km * 5) / 10 : d.workout.km,
            durationSec: d.workout.sec,
            completed: true,
            rpe,
          },
        ];
      });
      const facts = { workouts, coverage: { from, to: asOf, complete: true } };
      const r = adaptMarathonV2(g.plan, facts, asOf);
      const key = `${phase}/${v}`;
      if (!r.ok) {
        inc(`${key}: ODBIJENO`);
        out.push({
          id: c.id,
          key,
          rejected: r.reasons.map((x: { code: string; message: string }) =>
            `${x.code}: ${x.message}`.slice(0, 200),
          ),
        });
        continue;
      }
      const qr = r.reasons.find(
        (x: { condition: string }) => x.condition === "QUALITY_HARD",
      );
      const step = r.plan.adaptation.steps.at(-1);
      inc(
        `${key}: ok, QUALITY_HARD ${qr ? (qr.applied ? "applied" : "applied:false") : "nema"}${step.holdDose ? `, nedelja ${step.holdDose - Math.ceil((dates.daysBetween(W[0]!.startDate, asOf) + 1) / 7)} posle` : ""}`,
      );
      if (qr?.applied) {
        // poređenje sa istim tokom bez okidača (RPE 5 na oba dana)
        const ref = adaptMarathonV2(
          g.plan,
          {
            ...facts,
            workouts: workouts.map((x) => ({
              ...x,
              rpe: 5,
              completed: true,
              km: x.km || days.find((d) => d.date === x.date)!.workout.km,
              durationSec: x.durationSec || 1,
            })),
          },
          asOf,
        );
        const hw = step.holdDose as number;
        const P = r.plan.weeks as Wk[],
          R = ref.ok ? (ref.plan.weeks as Wk[]) : null;
        const prevBuild = P.slice(0, hw - 1)
          .filter(
            (w) =>
              !w.deload &&
              ["base", "development", "specific"].includes(w.phase),
          )
          .pop()!;
        const dose = (w: Wk, role: string) =>
          w.days.find((d) => d.role === role)?.workout.dose ?? null;
        const raised = ["q1", "q2"].some((s) => {
          const x = dose(P[hw - 1]!, s),
            y = dose(prevBuild, s);
          return x && y && x.ladder === y.ladder && x.doseM > y.doseM;
        });
        const refRaised = R
          ? ["q1", "q2"].some((s) => {
              const x = dose(R[hw - 1]!, s),
                y = dose(prevBuild, s);
              return x && y && x.ladder === y.ladder && x.doseM > y.doseM;
            })
          : null;
        if (raised) inc(`${key}: DOZA RASTE u nedelji bez rasta`);
        if (refRaised) inc(`${key}: bez F2 bi doza rasla`);
        if (R && P[hw - 1]!.targetKm !== R[hw - 1]!.targetKm) {
          inc(`${key}: CILJ OBIMA PROMENJEN`);
          deltas.push(
            Math.round((R[hw - 1]!.targetKm - P[hw - 1]!.targetKm) * 10) / 10,
          );
          if (
            r.plan.weeks[hw - 1].nominalKm !== ref.plan.weeks[hw - 1].nominalKm
          )
            inc(`${key}: NOMINALNI CILJ PROMENJEN`);
          if (process.env.DBG)
            console.log(
              key,
              c.id,
              hw,
              P[hw - 1]!.targetKm,
              R[hw - 1]!.targetKm,
              JSON.stringify(
                P[hw - 1]!.days.map((d) => [
                  d.role,
                  d.workout.km,
                  d.workout.dose?.doseM,
                ]),
              ),
              JSON.stringify(
                R[hw - 1]!.days.map((d) => [
                  d.role,
                  d.workout.km,
                  d.workout.dose?.doseM,
                ]),
              ),
              (r.plan.weeks[hw - 1] as any).notes.join(" / ").slice(0, 300),
            );
        }
      }
    }
  }
}
writeFileSync(
  new URL("f2flows.json", import.meta.url),
  JSON.stringify({ cnt, deltas, rejected: out }, null, 1),
);
console.log(
  `razlika cilja (bez F2 − sa F2) [km]: n ${deltas.length}, ${deltas.sort((x, y) => x - y).join(" ")}`,
);
for (const k of Object.keys(cnt).sort()) console.log(`${k}: ${cnt[k]}`);
console.log(`${((Date.now() - t0) / 1000).toFixed(0)} s`);
