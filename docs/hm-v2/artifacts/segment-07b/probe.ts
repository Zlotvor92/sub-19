/* HM-07b — merenje tačke 1 (pouka 36 precizno) i tačke 2 (zaštićeni dani posle novog rezultata).
   Plan: svaki 97. ulaz porodica R/F/B (kao fatigue-repeat.ts), nedelje k ∈ {2, 4, N − 6} (k ≤ N − 3).
   fat: zapisi umora (2 × RPE 8, bez dayId) u nedelji k − 1, poslednji zapis L = pon … ned, drugi L − 2 (ili L u
        ponedeljak/utorak), asOf = L … min(prvi + 6, kraj nedelje k) → očekivano: novo rasterećenje = nedelja k, 0 odbijanja;
        isti zapisi asOf poslednji dan k − 1 i prvi dan k → isti dani od drugog dana nedelje k (kad rasterećenje ne
        menja prvi dan, koji je u drugom slučaju upisan).
   res: rezultat (faster/slower/test5k) datiran krajem nedelje k; (a) asOf kraj k, zaključani Q1+Q2 nedelje k + 1;
        (b) isto, zaključan samo Q1; (c) lanac: (a) pa asOf = dan Q1 nedelje k + 1 sa urađenim Q1 (dayId, km/vreme plana).
   Iz korena repoa (ili drugog stabla): node docs/hm-v2/artifacts/segment-07b/probe.ts <koren> > out.json */
const root = process.argv[2] ?? process.cwd();
const lib = await import(`${root}/docs/generators-v2/final-check/lib.ts`);
const d = lib.distOf("HM");
const add = lib.addDays as (x: string, n: number) => string;
const out = {
  fat: {
    flows: 0,
    applicable: 0,
    rejected: 0,
    wrongWeek: 0,
    sunMonPairs: 0,
    sunMonDiff: 0,
    firstDayChanged: 0,
    sunMonDiffFirstSame: 0,
    ex: [] as string[],
  },
  res: { flows: 0, rejected: {} as Record<string, number>, ex: [] as string[] },
};
const ex = (a: string[], s: string) => a.length < 12 && a.push(s);
const newDeloads = (base: any, p: any): number[] =>
  p.weeks
    .filter((w: any) => w.deload && !base.weeks[w.index - 1].deload)
    .map((w: any) => w.index);
const build = (w: any) => ["base", "development", "specific"].includes(w.phase);
const plans = d.all().filter((_: unknown, i: number) => i % 97 === 0);
for (const b of plans) {
  const g = d.generate(b.input);
  if (!g.ok) continue;
  const p = g.plan;
  const N = p.weeks.length;
  for (const k of [...new Set([2, 4, Math.max(2, N - 6)])]) {
    if (k > N - 3) continue;
    const wk = p.weeks[k - 1];
    const prev = p.weeks[k - 2];
    // ---- fat
    const applicable = build(wk) && !wk.deload;
    for (let L = 0; L < 7; L++) {
      const last = add(prev.startDate, L);
      const first = L >= 2 ? add(last, -2) : last;
      const facts = {
        workouts: [
          { date: first, km: 6, durationSec: 2400, completed: true, rpe: 8 },
          { date: last, km: 6, durationSec: 2400, completed: true, rpe: 8 },
        ],
      };
      const byAsOf = new Map<string, any>();
      // A5: oba zapisa u prozoru od 7 dana (asOf ≤ prvi + 6).
      for (let x = 0; x <= 6 - (L >= 2 ? 2 : 0); x++) {
        const at = add(last, x);
        if (at > wk.endDate) break;
        out.fat.flows++;
        const r = d.adapt(p, facts, at);
        const key = `${b.id}/k${k}/L${L}/asOf+${x}`;
        if (!r.ok) {
          out.fat.rejected++;
          ex(
            out.fat.ex,
            `${key}: odbijen ${r.reasons.map((y: any) => y.code).join(",")}`,
          );
          continue;
        }
        byAsOf.set(at, r.plan);
        if (!applicable) continue;
        out.fat.applicable++;
        const nd = newDeloads(p, r.plan);
        if (!(nd.length === 1 && nd[0] === k)) {
          out.fat.wrongWeek++;
          ex(
            out.fat.ex,
            `${key} (${at}): nova rasterećenja [${nd}] umesto [${k}]`,
          );
        }
      }
      const sun = byAsOf.get(prev.endDate);
      const mon = byAsOf.get(wk.startDate);
      if (applicable && sun && mon) {
        out.fat.sunMonPairs++;
        const after = (pl: any) =>
          JSON.stringify(
            pl.weeks
              .flatMap((w: any) => w.days)
              .filter((x: any) => x.date > wk.startDate),
          );
        // Prvi dan nedelje k je u adaptaciji prvog dana upisan (stari plan); kad ga rasterećenje menja (npr. dugi),
        // kasniji dani smeju da se razlikuju (pouka 28 iz upisanog dugog).
        const dayAt = (pl: any) =>
          JSON.stringify(
            pl.weeks[k - 1].days.find((x: any) => x.date === wk.startDate) ??
              "",
          );
        const firstSame = dayAt(sun) === dayAt(p);
        if (!firstSame) out.fat.firstDayChanged++;
        if (after(sun) !== after(mon)) {
          out.fat.sunMonDiff++;
          if (firstSame) out.fat.sunMonDiffFirstSame++;
          ex(
            out.fat.ex,
            `${b.id}/k${k}/L${L}: ned ≠ pon od drugog dana${firstSame ? " (prvi dan isti!)" : ""}`,
          );
        }
      }
    }
    // ---- res
    const nx = p.weeks[k];
    const q1 = nx.days.find((x: any) => x.role === "q1");
    const q2 = nx.days.find((x: any) => x.role === "q2");
    for (const s of ["faster", "slower", "test5k"]) {
      const at = wk.endDate;
      const base = d.facts(p, s, at);
      const variants: [string, string[]][] = [];
      if (q1 && q2) variants.push(["a", [q1.date, q2.date]]);
      if (q1) variants.push(["b", [q1.date]]);
      for (const [v, locked] of variants) {
        out.res.flows++;
        const r = d.adapt(p, { ...base, lockedDayIds: locked }, at);
        const key = `${b.id}/k${k}/${s}/${v}`;
        if (!r.ok) {
          const c = r.reasons.map((y: any) => y.code).join(",");
          out.res.rejected[`${v}:${c}`] =
            (out.res.rejected[`${v}:${c}`] ?? 0) + 1;
          ex(
            out.res.ex,
            `${key}: ${c} ${r.reasons[0]?.message?.slice(0, 160)}`,
          );
          continue;
        }
        if (v !== "a" || !q1) continue;
        out.res.flows++;
        const day = r.plan.weeks[k].days.find((x: any) => x.date === q1.date);
        const done = {
          date: q1.date,
          dayId: q1.date,
          km: day.workout.km,
          durationSec: day.workout.sec,
          completed: true,
          rpe: 6,
        };
        const r2 = d.adapt(
          r.plan,
          { workouts: [done], lockedDayIds: q2 ? [q2.date] : [] },
          q1.date,
        );
        if (!r2.ok) {
          const c = r2.reasons.map((y: any) => y.code).join(",");
          out.res.rejected[`c:${c}`] = (out.res.rejected[`c:${c}`] ?? 0) + 1;
          ex(
            out.res.ex,
            `${key}/c: ${c} ${r2.reasons[0]?.message?.slice(0, 160)}`,
          );
        }
      }
    }
  }
}
console.log(JSON.stringify(out, null, 1));
