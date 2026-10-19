/* Faza 4a — ciljane provere kandidata iz čitanja koda i trenerskog čitanja (HM i maraton).
   (a) pouka 30 / KN-3: bol 7 i 8 na svaki dan nedelje N − 1 (i nedelje N − 2), planovi 3 i 4 dana → odbijanja po klasi;
   (b) K3: HM upozorenje LONG_RUN_SHORT u adaptiranom planu iako je najduži dugi plana ≥ praga;
   (c) nov start (pauza 35): nedelje izgradnje posle restarta — dugi < 10 km, dugi kraći od dana kvaliteta, RP/MP ispod
       najnižeg nivoa (HM RP < 4000 m, maraton MP < 6000 m), taper bez kvaliteta;
   (d) napomena „Cilj po pravilu … nije izvodljiv u konstrukciji" u planovima generatora (% planova).
   Uzorak: svaki 61. plan mreže R, 31. F, 17. B (bez obzira na trajne mreže — ovo nije pretraga odbijanja).
   Iz korena repoa: node docs/generators-v2/final-check/targeted.ts <HM|MAR> > targeted-<dist>.json */

import { addDays, distOf, wedOf, type Plan } from "./lib.ts";

const name = process.argv[2] as "HM" | "MAR";
const d = distOf(name);
const every = { R: 61, F: 31, B: 17 } as Record<string, number>;
const seen: Record<string, number> = {};
const bases = d.all().filter((b) => {
  const i = (seen[b.family] = (seen[b.family] ?? -1) + 1);
  return i % every[b.family]! === 0;
});
const add = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
const out = {
  dist: name,
  plans: 0,
  a: { flows: 0, rejected: {} as Record<string, number>, ex: [] as string[] },
  b: { flows: 0, longShortWarn: 0, falsePositive: 0, ex: [] as string[] },
  c: { flows: 0, rejected: 0, weeks: 0, longUnder10: 0, plansLongUnder10: 0, longShorterThanQ: 0, plansLongShorterThanQ: 0, rpBelowLowest: 0, taperNoQ: 0, minLong: 99, ex: [] as string[] },
  d: { plans: 0, withNote: 0, ex: "" },
};
const LONG_MIN = name === "HM" ? 16 : 26;
const lowestM = name === "HM" ? 4000 : 6000;
const dose = (title: string, zone: string): number | null => {
  const m = title.match(new RegExp(`${zone} (\\d+) × (\\d+) m`));
  if (m) return Number(m[1]) * Number(m[2]);
  const k = title.match(new RegExp(`${zone} (\\d+(?:,\\d+)?) km kontinuirano`));
  return k ? Math.round(Number(k[1]!.replace(",", ".")) * 1000) : null;
};
for (const b of bases) {
  const g = d.generate(b.input);
  if (!g.ok) continue;
  out.plans++;
  const p = g.plan as Plan;
  const N = p.weeks.length;
  // (d)
  out.d.plans++;
  const note = p.weeks.flatMap((w) => w.notes).find((n) => n.includes("nije izvodljiv u konstrukciji"));
  if (note) {
    out.d.withNote++;
    out.d.ex ||= `${b.id}: ${note.slice(0, 160)}`;
  }
  // (a) bol 7/8 svaki dan nedelja N − 2 i N − 1.
  if (p.input.runDays.length <= 4)
    for (const wi of [N - 2, N - 1])
      for (let k = 0; k < 7; k++) {
        const at = addDays(p.weeks[wi - 1]!.startDate, k);
        for (const lvl of [7, 8]) {
          out.a.flows++;
          const r = d.adapt(p, { workouts: [{ date: at, km: 0, durationSec: 0, completed: false, pain: lvl }] }, at);
          if (!r.ok) {
            const vs = ((r as { violations?: { rule: string; severity: string }[] }).violations ?? []).filter((v) => v.severity === "error");
            const cls = vs.length ? vs.map((v) => v.rule).join(",") : r.reasons.map((x) => x.code).join(",");
            add(out.a.rejected, cls);
            if (out.a.ex.length < 5) out.a.ex.push(`${b.id}/w${wi}d${k}/pain${lvl}: ${r.reasons.map((x) => x.message).join(" | ").slice(0, 300)}`);
          }
        }
      }
  // (b) i (c): pauza 35 na kraju svake nedelje 3 … N − 4, pauza 20 i bol 5 u sredu iste nedelje (b).
  for (let i = 3; i <= N - 4; i++) {
    const at = p.weeks[i - 1]!.endDate;
    for (const s of ["pause35", "pause20", "pain5"] as const) {
      const asOf = s === "pain5" ? wedOf(p.weeks[i - 1]!.startDate) : at;
      const r = d.adapt(p, d.facts(p, s, asOf), asOf);
      if (s !== "pause35") out.b.flows++;
      else out.c.flows++;
      if (!r.ok) {
        if (s === "pause35") out.c.rejected++;
        continue;
      }
      const q = r.plan;
      if (name === "HM") {
        const warn = q.warnings.some((v) => (v as { rule?: string }).rule === "LONG_RUN_SHORT");
        const maxLong = Math.max(0, ...q.weeks.flatMap((w) => w.days.filter((x) => x.role === "long").map((x) => x.workout.km)));
        if (warn) {
          out.b.longShortWarn++;
          if (maxLong >= LONG_MIN) {
            out.b.falsePositive++;
            if (out.b.ex.length < 3) out.b.ex.push(`${b.id}/w${i}/${s}: najduži dugi ${maxLong} km ≥ ${LONG_MIN}, upozorenje LONG_RUN_SHORT`);
          }
        }
      }
      if (s !== "pause35") continue;
      let u10 = false;
      let lq = false;
      for (const w of q.weeks.filter((w) => w.startDate > asOf)) {
        const L = w.days.find((x) => x.role === "long");
        const qs = w.days.filter((x) => x.role === "q1" || x.role === "q2");
        if (w.phase === "taper" && qs.length === 0) out.c.taperNoQ++;
        for (const x of qs) {
          const v = dose(x.workout.title, name === "HM" ? "RP" : "MP");
          if (v !== null && v < lowestM) {
            out.c.rpBelowLowest++;
            if (out.c.ex.length < 6) out.c.ex.push(`${b.id}/w${i}end/pause35 ned ${w.index}: ${x.workout.title}`);
          }
        }
        if (!L || !["base", "development", "specific"].includes(w.phase) || w.deload) continue;
        out.c.weeks++;
        out.c.minLong = Math.min(out.c.minLong, L.workout.km);
        if (L.workout.km < 10) {
          out.c.longUnder10++;
          u10 = true;
        }
        if (qs.some((x) => x.workout.sec > L.workout.sec)) {
          out.c.longShorterThanQ++;
          lq = true;
          if (out.c.ex.length < 6) out.c.ex.push(`${b.id}/w${i}end/pause35 ned ${w.index}: cilj ${w.targetKm}, dugi ${L.workout.km} km ${Math.round(L.workout.sec / 60)} min < ${qs.map((x) => Math.round(x.workout.sec / 60) + " min").join("/")}`);
        }
      }
      if (u10) out.c.plansLongUnder10++;
      if (lq) out.c.plansLongShorterThanQ++;
    }
  }
}
console.log(JSON.stringify(out, null, 1));
