/* P5 (5K) — mreža tokova adaptacije za F2 (Odluka 10). Osnove: uzorak trajne rane mreže (testInputs.earlyGridBases,
   R/F/B). asOf = kraj svake nedelje 1 … N − 2. Zapisi: svi dani plana u poslednjih 14 dana urađeni (RPE 5, pokrivenost
   potpuna), osim poslednja dva dana kvaliteta (Q1/Q2, ne test) u prozoru:
   ctl = RPE 5 (kontrola), rpe9 = RPE 9, miss = neodrađeni (completed false), i sa drugim uslovom: +pain (bol 5 na asOf),
   +fatigue (2 lagana RPE 8), +under (ostali dani pola km). Lanac: posle primenjenog rpe9 isti zapisi + urađena nedelja
   (asOf + 7) — doza ne sme ponovo da se zadrži. Po toku: odbijanje, HARD_QUALITY applied, faza nedelje zadržavanja,
   rad zona nedelje n (rpe9 ≤ ctl), cilj nedelje n (isti), broj nedelja sa hold. Samo čitanje.
   Iz web/: node ../docs/generators-v2/perfection/P5-5K/f2.ts <oznaka> → P5-5K/f2-<oznaka>.json */
import { writeFileSync } from "node:fs";
const T = await import("../../../../web/src/domain/generators/fiveK/v2/testInputs.ts");
const G = await import("../../../../web/src/domain/generators/fiveK/v2/generate.ts");
const AD = await import("../../../../web/src/domain/generators/fiveK/v2/adapt.ts");
const tag = process.argv[2] ?? "posle";
const add = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
type Day = { date: string; role: string; countsToWeek: boolean; workout: { kind: string; qualityType: string | null; km: number; sec: number; workKm: Record<string, number> } };
type Wk = { index: number; phase: string; deload: boolean; hold?: boolean; startDate: string; endDate: string; targetKm: number; days: Day[] };
const zones = (w: Wk) => { const z = { I: 0, T: 0, R: 0 }; for (const d of w.days) if (d.workout.kind === "quality" && d.countsToWeek) { z.I += d.workout.workKm.I + d.workout.workKm.RP; z.T += d.workout.workKm.T; z.R += d.workout.workKm.R; } return z; };
const stat: Record<string, any> = {};
const S = (k: string) => (stat[k] ??= { flows: 0, rej: 0, applied: 0, notApplied: 0, noTrigger: 0, holdWeeks: 0, phase: {}, msgs: {}, rejEx: [] as string[] });
const cmp = { n: 0, higher: 0, lower: 0, same: 0, targetDiff: 0, laterDiff: 0, ex: [] as string[] };
let t0 = Date.now(), bases = 0;
for (const eb of T.earlyGridBases()) {
  const g = G.generateFiveKV2(eb.input); if (!g.ok) continue; bases++;
  const plan = g.plan; const W = plan.weeks as Wk[];
  for (let i = 1; i <= W.length - 2; i++) {
    const asOf = W[i - 1]!.endDate; const from = add(asOf, -13);
    const days = W.flatMap((w) => w.days).filter((d) => d.date >= from && d.date <= asOf && d.countsToWeek);
    const q = days.filter((d) => (d.role === "q1" || d.role === "q2") && d.workout.kind === "quality" && d.workout.qualityType !== "TEST_3K");
    if (q.length < 2) continue;
    const hard = new Set(q.slice(-2).map((d) => d.date));
    const mk = (mode: "ctl" | "rpe9" | "miss", extra: string | null) => {
      const workouts: any[] = days.map((d) => {
        const h = hard.has(d.date);
        if (h && mode === "miss") return { date: d.date, dayId: d.date, km: 0, durationSec: 0, completed: false };
        const share = extra === "under" && !h ? 0.4 : 1;
        return { date: d.date, dayId: d.date, km: Math.round(d.workout.km * share * 100) / 100, durationSec: Math.round(d.workout.sec * share), completed: true, rpe: h && mode === "rpe9" ? 9 : 5 };
      });
      if (extra === "pain") workouts.push({ date: asOf, km: 0, durationSec: 0, completed: false, pain: 5 });
      if (extra === "fatigue") workouts.push({ date: add(asOf, -1), km: 5, durationSec: 1800, completed: true, rpe: 8 }, { date: add(asOf, -2), km: 5, durationSec: 1800, completed: true, rpe: 8 });
      return { workouts, coverage: { from, to: asOf, complete: true } };
    };
    const runs: Record<string, any> = {};
    for (const mode of ["ctl", "rpe9", "miss"] as const) for (const extra of [null, "pain", "fatigue", "under"]) {
      const key = `${eb.family}:${mode}${extra ? "+" + extra : ""}`;
      const s = S(key); s.flows++;
      const r: any = AD.adaptFiveKV2(plan, mk(mode, extra), asOf);
      runs[`${mode}${extra ?? ""}`] = r;
      if (!r.ok) { s.rej++; if (s.rejEx.length < 5) s.rejEx.push(`${eb.id}@${asOf}: ${r.reasons.map((x: any) => x.code).join(",")} ${(r.violations ?? []).filter((v: any) => v.severity === "error").map((v: any) => v.rule + " " + v.message).join("; ").slice(0, 200)}`); continue; }
      const hq = r.reasons.filter((x: any) => x.condition === "HARD_QUALITY");
      if (hq.length === 0) s.noTrigger++; else if (hq.some((x: any) => x.applied)) s.applied++; else { s.notApplied++; const m = hq[0].message.replace(/[\d-]{10}, [\d-]{10}/, "D").replace(/\d+/g, "#"); s.msgs[m] = (s.msgs[m] ?? 0) + 1; }
      for (const w of r.plan.weeks as Wk[]) if (w.hold) { s.holdWeeks++; s.phase[w.phase] = (s.phase[w.phase] ?? 0) + 1; }
    }
    // rpe9 prema kontroli: nedelja zadržavanja
    const a = runs["ctl"], b = runs["rpe9"];
    if (a?.ok && b?.ok) {
      const hw = (b.plan.weeks as Wk[]).find((w) => w.hold);
      if (hw) {
        cmp.n++;
        const wa = (a.plan.weeks as Wk[])[hw.index - 1]!;
        const za = zones(wa), zb = zones(hw);
        const up = (["I", "T", "R"] as const).some((z) => zb[z] > za[z] + 1e-9), dn = (["I", "T", "R"] as const).some((z) => zb[z] < za[z] - 1e-9);
        if (up) { cmp.higher++; if (cmp.ex.length < 5) cmp.ex.push(`${eb.id}@${asOf} n${hw.index} ${JSON.stringify(zb)} > ${JSON.stringify(za)}`); } else if (dn) cmp.lower++; else cmp.same++;
        if (wa.targetKm !== hw.targetKm) cmp.targetDiff++;
        // lanac: isti zapisi + urađena sledeća nedelja → bez novog zadržavanja
        const at2 = add(asOf, 7);
        if (at2 < plan.input.raceDate) {
          const f = mk("rpe9", null);
          const d2 = (b.plan.weeks as Wk[]).flatMap((w) => w.days).filter((d) => d.date > asOf && d.date <= at2 && d.countsToWeek);
          f.workouts.push(...d2.map((d) => ({ date: d.date, dayId: d.date, km: d.workout.km, durationSec: d.workout.sec, completed: true, rpe: 5 })));
          f.coverage = { from: add(at2, -13), to: at2, complete: true };
          f.workouts = f.workouts.filter((x: any) => x.date >= add(at2, -13));
          const s = S(`${eb.family}:lanac`); s.flows++;
          const r2: any = AD.adaptFiveKV2(b.plan, f, at2);
          if (!r2.ok) { s.rej++; if (s.rejEx.length < 5) s.rejEx.push(`${eb.id}@${at2}: ${r2.reasons.map((x: any) => x.code).join(",")}`); }
          else {
            const hq = r2.reasons.filter((x: any) => x.condition === "HARD_QUALITY");
            if (hq.some((x: any) => x.applied)) s.applied++; else if (hq.length) s.notApplied++; else s.noTrigger++;
            const nh = (r2.plan.weeks as Wk[]).filter((w) => w.hold && w.index > hw.index).length;
            s.holdWeeks += nh;
          }
        }
      }
    }
  }
}
writeFileSync(new URL(`./f2-${tag}.json`, import.meta.url), JSON.stringify({ bases, stat, cmp }, null, 1));
console.log(`osnova ${bases}, ${Math.round((Date.now() - t0) / 1000)} s`);
for (const [k, s] of Object.entries(stat)) console.log(`${k}: tokova ${s.flows}, odb ${s.rej}, primenjeno ${s.applied}, nije ${s.notApplied}, bez okidača ${s.noTrigger}, ned. hold ${s.holdWeeks} ${JSON.stringify(s.phase)} ${Object.keys(s.msgs).length ? JSON.stringify(s.msgs) : ""} ${s.rejEx.join(" | ")}`);
console.log(`rpe9 prema ctl (nedelja zadržavanja): n ${cmp.n}, veća doza ${cmp.higher}, manja ${cmp.lower}, ista ${cmp.same}, cilj različit ${cmp.targetDiff} ${cmp.ex.join(" | ")}`);
