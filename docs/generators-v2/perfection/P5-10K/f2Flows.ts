/* P5-10K — mreža tokova F2 (D38): planovi mreže P0 (192) × asOf = kraj poslednje ne-rasteretne nedelje baze / razvoja /
   specifične faze × scenario. Svi dani plana do asOf (14 dana) zapisani, pokrivenost potpuna; dva poslednja dana kvaliteta:
   ok (RPE 5, kontrola) / skip (bez zapisa) / rpe9 / skip + umor (2 lagana RPE 7) / rpe9 + bol 5. Meri: odbijanja, F2 primenjen,
   doza sledeće nedelje (zbir doza kvaliteta) prema kontroli, cilj obima prema kontroli. Iz web/:
   node ../docs/generators-v2/perfection/P5-10K/f2Flows.ts → stdout */
import { grid } from "../P0/common.ts";
import { generateTenKV2 } from "../../../../web/src/domain/generators/tenK/v2/generate.ts";
import { adaptTenKV2 } from "../../../../web/src/domain/generators/tenK/v2/adapt.ts";
import { addDays } from "../../../../web/src/domain/generators/tenK/v2/dates.ts";
type Day = { date: string; role: string; workout: { kind: string; km: number; sec: number; dose: { doseM: number } | null } };
type Wk = { index: number; phase: string; deload: boolean; startDate: string; endDate: string; targetKm: number; days: Day[] };
const SC = ["ok", "skip", "rpe9", "skip+umor", "rpe9+bol"] as const;
const stat: Record<string, Record<string, number>> = {};
const inc = (k: string, f: string) => { (stat[k] ??= {})[f] = (stat[k]![f] ?? 0) + 1; };
const dose = (w: Wk | undefined) => (w?.days ?? []).reduce((a, d) => a + (d.workout.dose?.doseM ?? 0), 0);
for (const c of grid("10K")) {
  const g = generateTenKV2(c.input); if (!g.ok) continue;
  const W = g.plan.weeks as unknown as Wk[];
  for (const ph of ["base", "development", "specific"]) {
    // asOf = kraj poslednje ne-rasteretne nedelje faze posle koje sledi ne-rasteretna nedelja izgradnje.
    const w = [...W].reverse().find((x) => x.phase === ph && !x.deload && x.index >= 2 && W[x.index] !== undefined && !W[x.index]!.deload && ["base", "development", "specific"].includes(W[x.index]!.phase));
    if (!w) continue;
    const asOf = w.endDate; const from = addDays(asOf, -13);
    const days = W.flatMap((x) => x.days).filter((d) => d.date >= from && d.date <= asOf && d.role !== "race");
    const q = days.filter((d) => (d.role === "q1" || d.role === "q2") && d.workout.kind === "quality").slice(-2).map((d) => d.date);
    if (q.length < 2) { inc(`${ph}`, "bez 2 kvaliteta"); continue; }
    let ctl: { dose: number; target: number } | null = null;
    for (const s of SC) {
      const workouts: Record<string, unknown>[] = [];
      let easy7 = 0;
      for (const d of days) {
        const isQ = q.includes(d.date);
        if (isQ && s.startsWith("skip")) continue;
        const rpe = isQ && s.startsWith("rpe9") ? 9 : s === "skip+umor" && (d.role === "easy" || d.role === "long") && easy7 < 2 && d.date > addDays(asOf, -7) ? (easy7++, 7) : 5;
        workouts.push({ date: d.date, dayId: d.date, km: d.workout.km, durationSec: d.workout.sec, completed: true, rpe,
          ...(s === "rpe9+bol" && d.date === asOf ? { pain: 5 } : {}) });
      }
      if (s === "rpe9+bol" && !workouts.some((x) => x["date"] === asOf)) workouts.push({ date: asOf, km: 3, durationSec: 1200, completed: true, pain: 5 });
      const r = adaptTenKV2(g.plan, { workouts, coverage: { from, to: asOf, complete: true } }, asOf);
      const k = `${ph} ${s}`;
      if (!r.ok) { inc(k, "odbijeno"); continue; }
      inc(k, "ok");
      const h = r.reasons.find((x) => x.condition === "QUALITY_HOLD");
      if (h) inc(k, h.applied ? "F2 primenjen" : "F2 applied:false");
      const nw = (r.plan.weeks as unknown as Wk[]).find((x) => x.index === w.index + 1);
      const res = { dose: dose(nw), target: (nw as unknown as { nominalKm: number })?.nominalKm ?? 0 };
      if (s === "ok") ctl = res;
      else if (ctl) {
        inc(k, res.dose < ctl.dose ? "doza < kontrola" : res.dose === ctl.dose ? "doza = kontrola" : "doza > kontrola");
        inc(k, res.target === ctl.target ? "cilj po pravilu = kontrola" : "cilj po pravilu ≠ kontrola");
      }
      if (h?.applied && nw) {
        const before = W.find((x) => x.index === w.index + 1);
        // bez rasta: nijedan slot iznad poslednje doze slota
        type D2 = { ladder: string; doseM: number };
        const last = (role: string): D2 | undefined => [...(r.plan.weeks as unknown as Wk[])].filter((x) => x.index <= w.index && !x.deload).flatMap((x) => x.days).filter((d) => d.role === role && d.workout.dose).pop()?.workout.dose as D2 | undefined;
        const up = nw.days.some((d) => { const x = d.workout.dose as D2 | null; const l = last(d.role); return !!x && !!l && (d.role === "q1" || d.role === "q2") && x.ladder === l.ladder && x.doseM > l.doseM; });
        inc(k, up ? "slot raste (!)" : "nijedan slot ne raste");
        void before;
      }
    }
  }
}
for (const [k, v] of Object.entries(stat)) console.log(k.padEnd(24), JSON.stringify(v));
