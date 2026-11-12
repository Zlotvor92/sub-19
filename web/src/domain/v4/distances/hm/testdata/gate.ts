/* KAPIJA KRUGA 2 (briefs/R2-ROUND2.md, „Kapija kruga 2") — brojevi plana u km i provere. Deli ih test
   `gate.test.ts` i skripta ispisa (`docs/generators-v4/plans/render.ts --stats`), da izveštaj i test mere isto.
   Sve mere su u km iz `summarize` (isti broj koji ispis pokazuje), dan trke se ne broji. */
import { paceCtxOf, summarize, type PlanDoc, type RunnerFacts } from '../../../engine/index';

export interface GateWeek {
  index: number;
  kind: string;
  km: number;
  workouts: number;
  longKm: number;
  /** Najduži lagan dan (km i min). */
  easyKm: number;
  easyMin: number;
  /** Nedelja seče rampu posle trke iz istorije (izuzeta iz broja treninga i udela dugog). */
  ramp: boolean;
}

export interface GateStats {
  baseKm: number;
  runDays: number;
  weeks: GateWeek[];
  peakKm: number;
  peakRatio: number;
  maxJumpPct: number;
  maxEasyOfLong: number;
  maxLongShare: number;
  minWorkouts: number;
  maxWorkouts: number;
  longestLongKm: number;
  raceWeekEasyMin: number;
  firstWeekPct: number;
  violations: string[];
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

/** Poslednji dan rampe posle trke/pauze iz istorije (motor: 1 dan rampe na 7 min napora, § 6.5). */
function rampEnd(doc: PlanDoc): string {
  let end = '';
  for (const a of doc.header.adjustments ?? []) {
    if (a.kind !== 'effort' || a.planned === true) continue;
    const e = addDays(a.date, Math.max(1, Math.ceil(a.durationSec / 60 / 7)));
    if (e > end) end = e;
  }
  return end;
}

const r1 = (x: number): number => Math.round(x * 10) / 10;

export function gateStats(doc: PlanDoc, facts: RunnerFacts): GateStats {
  const ctx = paceCtxOf(doc.header);
  const runDays = doc.header.decisions.runDays.length;
  const baseKm = facts.profile.weeklyKm ?? 0;
  const ramp = rampEnd(doc);
  const weeks: GateWeek[] = doc.weeks.map((w) => {
    const g: GateWeek = {
      index: w.index,
      kind: w.intent.kind,
      km: 0,
      workouts: 0,
      longKm: 0,
      easyKm: 0,
      easyMin: 0,
      ramp: ramp !== '' && w.start <= ramp
    };
    for (const day of w.days) {
      const x = day.workout;
      if (x === null || x.kind === 'race') continue;
      const c = summarize(x, ctx);
      g.km += c.km;
      g.workouts += 1;
      if (x.kind === 'long') g.longKm = Math.max(g.longKm, c.km);
      if (x.kind === 'easy') {
        g.easyKm = Math.max(g.easyKm, c.km);
        g.easyMin = Math.max(g.easyMin, c.durationSec / 60);
      }
    }
    g.km = r1(g.km);
    return g;
  });

  const v: string[] = [];
  const full = (g: GateWeek): boolean => doc.weeks[g.index - 1]?.days.length === 7;
  /* 1. vrh ≤ 1,40 × polazno */
  const peakKm = Math.max(...weeks.map((g) => g.km));
  if (baseKm > 0 && peakKm > 1.4 * baseKm + 0.05)
    v.push(`vrh ${String(peakKm)} km > 1,40 × ${String(baseKm)}`);
  /* 2. skok ≤ 10 % (+ zaokruživanje dana na 0,5 km) prema najvećoj od prethodne 3, van rasterećenja */
  let maxJump = 0;
  weeks.forEach((g, i) => {
    if (i === 0 || g.kind === 'recovery') return;
    const window = weeks.slice(Math.max(0, i - 3), i);
    const prev = window.filter((x) => full(x) && !x.ramp);
    /* rampa posle trke iz istorije je rasterećenje: posle nje meri se prema obimu pre trke (R9: poslednja puna
       nedelja pre × 1,10 — to je sadašnji obim iz profila) */
    const afterRamp = window.some((x) => x.ramp) ? [baseKm] : [];
    const ref = Math.max(0, ...prev.map((x) => x.km), ...afterRamp);
    if (ref <= 0) return;
    maxJump = Math.max(maxJump, g.km / ref - 1);
    if (g.km > ref * 1.1 + 0.25 * g.workouts)
      v.push(`n${String(g.index)} skok ${String(ref)} → ${String(g.km)} km`);
  });
  /* 3. lagan dan ≤ 65 % dugog (3 dana ≤ 70 %) */
  const easyCap = runDays <= 3 ? 0.7 : 0.65;
  let maxEasy = 0;
  for (const g of weeks) {
    if (g.longKm <= 0 || g.easyKm <= 0) continue;
    maxEasy = Math.max(maxEasy, g.easyKm / g.longKm);
    if (g.easyKm > easyCap * g.longKm + 0.25)
      v.push(
        `n${String(g.index)} lagan ${String(g.easyKm)} > ${String(easyCap)} × dugi ${String(g.longKm)}`
      );
  }
  /* 4. dugi ≤ 40 % nedelje kod 4+ dana (3 dana ≤ 50 %); nedelje rampe izuzete */
  const longCap = runDays >= 4 ? 0.4 : 0.5;
  let maxShare = 0;
  for (const g of weeks) {
    if (g.ramp || g.longKm <= 0 || g.kind === 'race' || runDays < 3) continue;
    maxShare = Math.max(maxShare, g.longKm / g.km);
    if (g.longKm > longCap * g.km + 0.25)
      v.push(`n${String(g.index)} dugi ${String(g.longKm)} od ${String(g.km)} km`);
  }
  /* 5. broj treninga = traženi dani u svakoj punoj nedelji gradnje (van rampe) */
  const build = weeks.filter(
    (g) => (g.kind === 'build' || g.kind === 'peak') && !g.ramp && full(g)
  );
  for (const g of build)
    if (g.workouts !== runDays)
      v.push(`n${String(g.index)} ${String(g.workouts)} treninga uz ${String(runDays)} dana`);
  /* 6. nedelja trke: lagan dan ≤ 50 min i ≤ isti dan prethodne nedelje */
  const raceWeek = doc.weeks[doc.weeks.length - 1];
  const prevWeek = doc.weeks[doc.weeks.length - 2];
  let raceEasy = 0;
  if (raceWeek !== undefined && raceWeek.intent.kind === 'race') {
    for (const day of raceWeek.days) {
      const x = day.workout;
      if (x === null || x.kind !== 'easy') continue;
      const min = summarize(x, ctx).durationSec / 60;
      raceEasy = Math.max(raceEasy, min);
      if (min > 50.5) v.push(`nedelja trke ${day.date} lagano ${String(Math.round(min))} min`);
      const same = prevWeek?.days.find((d) => d.date === addDays(day.date, -7))?.workout;
      if (same !== undefined && same !== null) {
        const before = summarize(same, ctx).durationSec / 60;
        if (min > before + 0.5)
          v.push(
            `nedelja trke ${day.date} ${String(Math.round(min))} min > ${String(Math.round(before))} min nedelju ranije`
          );
      }
    }
  }
  /* 7. nedelja 1 ≥ 95 % sadašnjeg obima (prva puna nedelja van rampe) */
  const first = weeks.find((g) => full(g) && !g.ramp);
  const firstPct = first === undefined || baseKm <= 0 ? 1 : first.km / baseKm;
  if (first !== undefined && first.index === 1 && firstPct < 0.95)
    v.push(`nedelja 1 ${String(first.km)} km < 95 % od ${String(baseKm)}`);

  const counted = build.length > 0 ? build : weeks;
  return {
    baseKm,
    runDays,
    weeks,
    peakKm,
    peakRatio: baseKm > 0 ? peakKm / baseKm : 0,
    maxJumpPct: maxJump * 100,
    maxEasyOfLong: maxEasy,
    maxLongShare: maxShare,
    minWorkouts: Math.min(...counted.map((g) => g.workouts)),
    maxWorkouts: Math.max(...counted.map((g) => g.workouts)),
    longestLongKm: Math.max(...weeks.map((g) => g.longKm)),
    raceWeekEasyMin: raceEasy,
    firstWeekPct: firstPct,
    violations: v
  };
}
