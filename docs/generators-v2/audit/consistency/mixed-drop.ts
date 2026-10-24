/* Ugao 5 (consistency), odložena odluka b): pouka 37 — kvalitet otpada u mešovitoj nedelji zbog malog viška.
   SAMO ČITANJE. Iz web/: node ../docs/generators-v2/audit/consistency/mixed-drop.ts <DIST> <k>
   Deterministički: svaki k-ti plan (R/F/B), nedelje 2 … N−3, asOf = početak nedelje + {1, 3, 5} dana,
   scenariji izvršenja done100 / under50 / over120 / locked / incomplete (lib.facts).
   Mešovita nedelja = nedelja koja sadrži asOf (adaptation.mixedWeeks). Otpao kvalitet = budući dan te nedelje
   koji je u planu pre adaptacije kind 'quality', a posle nije. Procena viška da je kvalitet zadržan
   (PROCENA, ne vrednost iz koda): višak = Σ km nedelje posle (zaštićeni po činjenicama adaptation.factKm, ostali
   planirani) + Σ(km kvaliteta pre − km istog dana posle) − cilj.
   Posledica: sledeća nedelja — isti naslovi kvaliteta (doza ista) ili ne; najveća |Δ cilja| u narednim nedeljama. */
import { distOf } from "../../final-check/lib.ts";
const d = distOf(process.argv[2]!);
const K = Number(process.argv[3] ?? 13);
const SC = ["done100", "under50", "over120", "locked", "incomplete"] as const;
const r2 = (x: number) => Math.round(x * 100) / 100;
const o = { flows: 0, rejected: 0, mixed: 0, dropped: 0, keptOver: 0, bySc: {} as Record<string, number>,
  excess: { le2: 0, le5: 0, le10: 0, gt10: 0 }, excessKm: [] as number[], nextDoseChanged: 0, cascade: 0, cascadeMax: 0,
  ex: [] as string[], exSmall: [] as string[] };
for (const [i, b] of d.all().entries()) {
  if (i % K !== 0) continue;
  const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan; const N = p.weeks.length;
  for (let k = 1; k < N - 3; k++) for (const off of [1, 3, 5]) for (const s of SC) {
    const wk = p.weeks[k]; const at = new Date(Date.parse(wk.startDate + "T00:00:00Z") + off * 864e5).toISOString().slice(0, 10);
    if (at > wk.endDate) continue;
    o.flows++;
    let a: any; try { a = d.adapt(p, d.facts(p, s as any, at), at); } catch { o.rejected++; continue; }
    if (!a.ok) { o.rejected++; continue; }
    const mixed: number[] = a.plan.adaptation?.mixedWeeks ?? [];
    const w = a.plan.weeks[k];
    if (!mixed.includes(w.index) && !mixed.includes(k)) continue;
    o.mixed++;
    const after = new Map(w.days.map((x: any) => [x.date, x]));
    let lost = 0, n = 0;
    for (const x of wk.days) if (x.date > at && x.workout.kind === "quality") {
      const y: any = after.get(x.date); if (y && y.workout.kind !== "quality") { n++; lost += x.workout.km - y.workout.km; }
    }
    if (!n) { if (w.plannedKm > w.targetKm + 0.1) o.keptOver++; continue; }
    o.dropped++; o.bySc[s] = (o.bySc[s] ?? 0) + 1;
    const fk = a.plan.adaptation?.factKm ?? {};
    // 5K/10K: zbir zaštićenih po činjenicama u week.protectedKm (zaštićeni = dani ≤ asOf; zaključanih nema u ovim scenarijima osim 'locked').
    const kept = w.protectedKm ?? w.keptKm;
    const tot = kept !== undefined
      ? kept + w.days.filter((x: any) => x.countsToWeek && x.date > at).reduce((acc: number, x: any) => acc + x.workout.km, 0)
      : w.days.reduce((acc: number, x: any) => acc + (!x.countsToWeek ? 0 : x.date in fk ? fk[x.date] : x.workout.km), 0);
    const ex = r2(tot + lost - w.targetKm); const pct = (100 * ex) / w.targetKm;
    o.excessKm.push(ex);
    if (pct <= 2) o.excess.le2++; else if (pct <= 5) o.excess.le5++; else if (pct <= 10) o.excess.le10++; else o.excess.gt10++;
    const t = (x: any) => x.days.filter((y: any) => y.workout.kind === "quality").map((y: any) => y.workout.title).join("|");
    const nb = p.weeks[k + 1], na = a.plan.weeks[k + 1];
    if (nb && na && !nb.deload && t(nb) !== t(na)) o.nextDoseChanged++;
    let dm = 0; for (let j = k + 1; j < N; j++) dm = Math.max(dm, Math.abs(a.plan.weeks[j].targetKm - p.weeks[j].targetKm));
    if (dm > 0.05) { o.cascade++; o.cascadeMax = Math.max(o.cascadeMax, r2(dm)); }
    const line = `${b.id} ${s} asOf ${at} ned ${k + 1}: cilj ${w.targetKm} plan ${w.plannedKm}, otpalo ${n} kval. (${r2(lost)} km), procena viška ${ex} km (${r2(pct)} %)`;
    if (o.ex.length < 4) o.ex.push(line);
    if (pct <= 5 && o.exSmall.length < 6) o.exSmall.push(line);
  }
}
const s = [...o.excessKm].sort((x, y) => x - y);
console.log(JSON.stringify({ dist: d.name, k: K, ...o, excessKm: undefined,
  excessMedKm: s.length ? s[Math.floor(s.length / 2)] : 0, excessMaxKm: s.length ? s[s.length - 1] : 0 }, null, 1));
