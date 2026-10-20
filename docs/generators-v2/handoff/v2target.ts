/* Faza 3a, pitanje 3 — izvodljivost v2 CILJA puta „generate iz činjenica + adapt sa istim činjenicama" (SAMO ČITANJE,
   samo v2 folderi, kao final-check/lib.ts). Izvor: plan HM v2 / maraton v2 iz 4a mreža (uzorak). Predaja na dan
   asOf: start − 1, kraj nedelje 2, kraj nedelje ⌊N/2⌋, kraj nedelje N − 4. Scenariji činjenica izvora (lib):
   none, under50, pause35, pain8, fatigue.
   Cilj (10K/5K za HM; HM/10K za maraton): ulaz = činjenice ulaza izvora (datum trke, dani, dan dugog, obim iz
   čarobnjaka, rezultat, lak tempo, početnik; HM cilj i skorašnji najduži), start = cele nedelje do trke od asOf + 1
   (`alignedStart`), ograničeno najvećim brojem nedelja cilja; pa adapt(plan cilja, činjenice izvora, asOf).
   Činjenice se predaju BEZ dayId izvora (zapis sa datumom; dan izvora nije dan cilja) i bez zaključanih dana izvora.
   Obim: ovde naivno obim iz čarobnjaka izvora — izvođenje obima iz činjenica je odluka cilja (DESIGN.md P3).
   Iz korena repoa: node docs/generators-v2/handoff/v2target.ts <HM|MAR> <kR> <kF> <kB> > out.json */

import { addDays, commonChecks, distOf, sampleBases, type Plan } from "../final-check/lib.ts";

const [name, kR, kF, kB] = [process.argv[2]!, ...process.argv.slice(3, 6).map(Number)] as [string, number, number, number];
const src = distOf(name);
const targets = name === "HM" ? ["10K", "5K"] : ["HM", "10K"];
const MAXW: Record<string, number> = { "5K": 16, "10K": 18, HM: 20 };
const RES: Record<string, number[]> = { "5K": [3000, 5000, 10000], "10K": [3000, 5000, 10000, 21097.5], HM: [5000, 10000, 21097.5, 42195] };
const SC = ["none", "under50", "pause35", "pain8", "fatigue"] as const;
const DAY = 86_400_000;
const diff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

function targetInput(t: string, v: Record<string, unknown>, asOf: string): Record<string, unknown> {
  const race = v["raceDate"] as string;
  const weeks = Math.min(MAXW[t]!, Math.floor((diff(addDays(asOf, 1), race) + 1) / 7));
  const r = v["recentResult"] as { distanceM: number } | null | undefined;
  const ep = v["easyPaceSecPerKm"] ?? v["typicalEasyPaceSecPerKm"];
  const beginner = v["experience"] === "beginner";
  return {
    startDate: addDays(race, -7 * Math.max(1, weeks) + 1),
    raceDate: race,
    runDays: v["runDays"],
    ...(v["longRunDay"] ? { longRunDay: v["longRunDay"] } : {}),
    currentWeeklyKm: v["currentWeeklyKm"],
    ...(r && RES[t]!.includes(r.distanceM) ? { recentResult: r } : {}),
    ...(ep != null ? (t === "5K" ? { typicalEasyPaceSecPerKm: ep } : { easyPaceSecPerKm: ep }) : {}),
    ...(beginner ? { experience: "beginner", ...(t === "5K" ? { canRun30Min: true } : {}) } : {}),
    ...(t === "HM" && v["recentLongRunKm"] != null ? { recentLongRunKm: v["recentLongRunKm"] } : {}),
    goalTimeSec: null,
  };
}
const stripIds = (f: Record<string, unknown>): Record<string, unknown> => {
  const { lockedDayIds: _l, ...rest } = f;
  const w = rest["workouts"] as Record<string, unknown>[] | undefined;
  return w ? { ...rest, workouts: w.map(({ dayId: _d, ...x }) => x) } : rest;
};
const cls = (r: { code: string; message: string }) => `${r.code}: ${r.message.replace(/[0-9]+([.,][0-9]+)?/g, "#").slice(0, 80)}`;

const t0 = Date.now();
const { bases } = sampleBases(src, { R: kR, F: kF, B: kB });
const out: Record<string, unknown> = { dist: name, step: { R: kR, F: kF, B: kB }, sources: 0 };
for (const t of targets)
  out[t] = { calls: 0, generated: 0, genRejected: {} as Record<string, number>, adaptOk: 0, adaptRejected: {} as Record<string, number>, common: {} as Record<string, number>, byWeeksLeft: {} as Record<string, string> };
const tally: Record<string, Record<string, [number, number]>> = {};
for (const b of bases) {
  const g = src.generate(b.input);
  if (!g.ok) continue;
  (out.sources as number)++;
  const p = g.plan;
  const N = p.weeks.length;
  const ends = [addDays(p.input.startDate, -1), p.weeks[1]!.endDate, p.weeks[Math.floor(N / 2) - 1]!.endDate, p.weeks[N - 5]!.endDate];
  for (const at of ends)
    for (const s of SC) {
      const facts = stripIds(src.facts(p, s, at));
      const left = Math.floor((diff(addDays(at, 1), p.input.raceDate) + 1) / 7);
      const bucket = left < 8 ? "<8" : left < 10 ? "8-9" : left < 12 ? "10-11" : "≥12";
      for (const t of targets) {
        const o = out[t] as { calls: number; generated: number; genRejected: Record<string, number>; adaptOk: number; adaptRejected: Record<string, number>; common: Record<string, number> };
        const T = distOf(t);
        o.calls++;
        const k = ((tally[t] ??= {})[bucket] ??= [0, 0]);
        k[1]++;
        const gi = T.generate(targetInput(t, p.input as unknown as Record<string, unknown>, at));
        if (!gi.ok) {
          for (const r of gi.reasons) o.genRejected[cls(r)] = (o.genRejected[cls(r)] ?? 0) + 1;
          continue;
        }
        o.generated++;
        const a = T.adapt(gi.plan, facts, at);
        if (!a.ok) {
          for (const r of a.reasons) o.adaptRejected[cls(r)] = (o.adaptRejected[cls(r)] ?? 0) + 1;
          continue;
        }
        o.adaptOk++;
        k[0]++;
        for (const v of commonChecks(gi.plan as Plan, a.plan, at, facts)) o.common[v] = (o.common[v] ?? 0) + 1;
      }
    }
}
for (const t of targets)
  (out[t] as { byWeeksLeft: Record<string, string> }).byWeeksLeft = Object.fromEntries(
    Object.entries(tally[t] ?? {}).map(([b, [ok, n]]) => [b, `${ok}/${n} ok`]),
  );
out["seconds"] = (Date.now() - t0) / 1000;
console.log(JSON.stringify(out, null, 1));
