/* Faza 3a, pitanje 1 — koliko tokova HM v2 / maraton v2 posle adaptacije dolazi u stanje u kome bi v1 odluka o
   ograničenoj pripremi ponudila „kraću distancu" (SAMO ČITANJE: koristi 4a mreže i činjenice iz final-check/lib.ts).
   Stanje (po toku, adaptiran plan prema planu pre adaptacije):
   - longLost: najduži dugi plana pao ispod praga distance (v1 `preparationRequirement`: HM 16 km, maraton 26 km;
     v2 isti pragovi upozorenja LONG_RUN_SHORT / MARATHON_LONG_SHORT za ne-početnika; početnik v2 14 / 24 km),
     a pre adaptacije je bio ≥ praga — adaptacija je napravila nepotpunu pripremu (v1: coverage ≠ full);
   - longLostNew: isto, ali upozorenje v2 (LONG_RUN_SHORT / MARATHON_LONG_SHORT) je NOVO posle adaptacije;
   - bornShort: plan već iz generatora ima najduži dugi < praga (stanje čarobnjaka, ne predaje);
   - goalWorse: ocena cilja v2 postala lošija (realistic/orientation → ambitious → unrealistic); planovi porodice R
     dobijaju cilj = predviđanje v2 (mreže 4a nemaju cilj);
   - rejected: adaptacija odbijena (4a: 0).
   Za longLost: preostale nedelje do trke, scenario, i da li bi kraća distanca bila pokrivena po dužini
   (najduži dugi adaptiranog plana ≥ 10 km za 10K; maraton i ≥ 16 km za HM) — gruba procena, ne plan cilja.
   3c: `offer` = domenski okidač HM v2 (`halfMarathon/v2/shorter.ts`) nad adaptiranim planom.
   3e: isto za maraton v2 (`marathon/v2/shorter.ts`); `offerTimeCapped` = ponude čiji je najduži dugi ograničen
   trajanjem (N11: bez upozorenja MARATHON_LONG_SHORT, okidač čita isti prag).
   Iz korena repoa: node docs/generators-v2/handoff/shorter.ts <HM|MAR> <kR> <kF> <kB> > out.json */

import { addDays, distOf, SCENARIOS, sampleBases, wedOf, type Plan } from "../final-check/lib.ts";
import { shorterOffer } from "../../../web/src/domain/generators/halfMarathon/v2/shorter.ts";
import { shorterOffer as marathonShorterOffer } from "../../../web/src/domain/generators/marathon/v2/shorter.ts";

const [name, kR, kF, kB] = [process.argv[2]!, ...process.argv.slice(3, 6).map(Number)] as [string, number, number, number];
const d = distOf(name);
const t0 = Date.now();
const { bases } = sampleBases(d, { R: kR, F: kF, B: kB });
const RANK: Record<string, number> = { realistic: 0, orientation: 0, ambitious: 1, unrealistic: 2 };
const warnCode = name === "HM" ? "LONG_RUN_SHORT" : "MARATHON_LONG_SHORT";
const thr = (p: Plan): number => {
  const beg = p.input["experience"] === "beginner";
  return name === "HM" ? (beg ? 14 : 16) : beg ? 24 : 26;
};
const v1thr = name === "HM" ? 16 : 26;
const longest = (p: Plan): number =>
  Math.max(0, ...p.weeks.flatMap((w) => w.days.filter((x) => x.role === "long").map((x) => x.workout.km)));
const hasWarn = (p: Plan): boolean => p.warnings.some((v) => (v as unknown as { rule: string }).rule === warnCode);
const goalOf = (p: Plan): string | null => ((p as unknown as { goal?: { status: string } | null }).goal?.status ?? null);

const out = {
  dist: name,
  step: { R: kR, F: kF, B: kB },
  plans: 0,
  generatorRejected: 0,
  flows: 0,
  rejected: 0,
  bornShort: 0,
  bornShortV1: 0,
  longLost: 0,
  longLostV1: 0,
  longLostNew: 0,
  /** 3c/3e: domenski okidač HM v2 / maraton v2 (`shorterOffer`, osnova = plan generatora za isti ulaz). */
  offer: 0,
  offerTimeCapped: 0,
  offerByScenario: {} as Record<string, number>,
  offerNotLost: 0,
  lostNotOffer: 0,
  longLostByScenario: {} as Record<string, number>,
  longLostWeeksLeft: {} as Record<string, number>,
  longLostCover10K: 0,
  longLostCoverHM: 0,
  longLostEx: [] as string[],
  goalFlows: 0,
  goalWorse: 0,
  goalWorseByScenario: {} as Record<string, number>,
  goalWorseTo: {} as Record<string, number>,
  seconds: 0,
};
const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);

function flow(p: Plan, born: Plan, facts: Record<string, unknown>, at: string, k: string, s: string) {
  out.flows++;
  const r = d.adapt(p, facts, at);
  if (!r.ok) {
    out.rejected++;
    return null;
  }
  const a = r.plan;
  const before = longest(p);
  const after = longest(a);
  const lost = before >= thr(p) && after < thr(p);
  {
    const offer = name === "HM" ? shorterOffer(a as never, at) : marathonShorterOffer(a as never, at);
    if (offer) {
      out.offer++;
      inc(out.offerByScenario, s);
      if (name !== "HM" && !hasWarn(a)) out.offerTimeCapped++;
    }
    if (offer && !lost) out.offerNotLost++;
    if (!offer && lost) out.lostNotOffer++;
  }
  if (before >= v1thr && after < v1thr) out.longLostV1++;
  if (before >= thr(p) && after < thr(p)) {
    out.longLost++;
    if (!hasWarn(p) && hasWarn(a)) out.longLostNew++;
    inc(out.longLostByScenario, s);
    const left = Math.max(0, Math.ceil((Date.parse(born.input.raceDate) - Date.parse(at)) / (7 * 86_400_000)));
    inc(out.longLostWeeksLeft, left < 4 ? "<4" : left < 8 ? "4-7" : left < 12 ? "8-11" : "≥12");
    if (after >= 10) out.longLostCover10K++;
    if (after >= 16) out.longLostCoverHM++;
    if (out.longLostEx.length < 5) out.longLostEx.push(`${k}: ${before} → ${after} km, ${left} ned`);
  }
  const g0 = goalOf(p);
  const g1 = goalOf(a);
  if (g0 && g1) {
    out.goalFlows++;
    if ((RANK[g1] ?? 0) > (RANK[g0] ?? 0)) {
      out.goalWorse++;
      inc(out.goalWorseByScenario, s);
      inc(out.goalWorseTo, `${g0}→${g1}`);
    }
  }
  return a;
}

for (const b of bases) {
  // Cilj: plan sa rezultatom (R) dobija cilj = predviđanje v2 (mreže 4a nemaju cilj), da bi ocena cilja postojala.
  let g = d.generate(b.input);
  if (g.ok && b.family === "R") {
    const pred = (g.plan as unknown as Record<string, number | null>)[name === "HM" ? "predictedHmSec" : "predictedMarathonSec"];
    if (pred) {
      const g2 = d.generate({ ...b.input, goalTimeSec: Math.round(pred) });
      if (g2.ok) g = g2;
    }
  }
  if (!g.ok) {
    out.generatorRejected++;
    continue;
  }
  out.plans++;
  const p = g.plan;
  if (longest(p) < thr(p)) out.bornShort++;
  if (longest(p) < v1thr) out.bornShortV1++;
  const N = p.weeks.length;
  const asOfs: string[] = [1, 3, 6].map((k) => addDays(p.input.startDate, -k));
  for (let i = 1; i <= N - 2; i++) {
    const w = p.weeks[i - 1]!;
    asOfs.push(wedOf(w.startDate), w.endDate);
  }
  for (const at of asOfs)
    for (const s of SCENARIOS) {
      const k = `${b.id}/${at}/${s}`;
      const p1 = flow(p, p, d.facts(p, s, at), at, k, s);
      if (p1 && s === "chain") {
        const at2 = addDays(at, 7);
        if (at2 < p.input.raceDate) flow(p1, p, d.chain2(p, at2), at2, `${k}/2`, "chain2");
      }
    }
}
out.seconds = (Date.now() - t0) / 1000;
console.log(JSON.stringify(out, null, 1));
