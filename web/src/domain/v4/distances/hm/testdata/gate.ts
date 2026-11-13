/* KAPIJA KRUGA 2, izmenjena u krugu 4 po presudi trenera (briefs/R3-ROUND3.md T7; coach/ROUND-V4-HM-02.md § F1, F5)
   — brojevi plana u km i provere. Deli ih test
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
  durMin: number;
  fastMin: number;
  longMin: number;
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
  /** Najveći udeo brzog rada (S1: prag, intervali, brze deonice, tempo trke, blok; bez trke i testa) i u vršnoj. */
  maxFastShare: number;
  peakFastShare: number;
  /** Množilac vrha iz tabele trenera (km). */
  ladder: number;
  violations: string[];
}

/** Tabela vrha trenera u km (S2): polazno ≤ 25 km → × 2,0 (≥ 18 ned), × 1,6 (12–17), × 1,4 kraće; 25–35 km → × 1,6;
    ≥ 35 km → × 1,4; staž < 8 nedelja ili tegoba u 12 meseci → najviše × 1,5. */
export function ladderKm(baseKm: number, weeks: number, limited: boolean): number {
  let x = 1.4;
  if (baseKm <= 25.5) x = weeks >= 18 ? 2.0 : weeks >= 12 ? 1.6 : 1.4;
  else if (baseKm <= 35.5) x = 1.6;
  return limited ? Math.min(x, 1.5) : x;
}

function limitedRunner(facts: RunnerFacts): boolean {
  const years = facts.profile.yearsRunning;
  if (years !== undefined && years * 52 < 8) return true;
  return [...(facts.painHistory ?? []), ...facts.pain].some((p) => {
    const age = (Date.parse(facts.today) - Date.parse(p.date)) / 86400000;
    return age >= 0 && age <= 365;
  });
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
      /* nedelja koja počinje na poslednji dan rampe nije u rampi (isto kao motor, krug 5) */
      ramp: ramp !== '' && w.start < ramp,
      durMin: 0,
      fastMin: 0,
      longMin: 0
    };
    for (const day of w.days) {
      const x = day.workout;
      if (x === null || x.kind === 'race') continue;
      const c = summarize(x, ctx);
      g.km += c.km;
      g.workouts += 1;
      g.durMin += c.durationSec / 60;
      if (x.kind === 'quality' || x.kind === 'long') g.fastMin += x.workSec / 60;
      if (x.kind === 'long') {
        g.longKm = Math.max(g.longKm, c.km);
        g.longMin = Math.max(g.longMin, c.durationSec / 60);
      }
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
  /* 1. vrh ≤ tabela trenera × polazno (S2) */
  const peakKm = Math.max(...weeks.map((g) => g.km));
  const ladder = ladderKm(baseKm, doc.weeks.length, limitedRunner(facts));
  if (baseKm > 0 && peakKm > ladder * baseKm + 0.05)
    v.push(`vrh ${String(peakKm)} km > ${String(ladder)} × ${String(baseKm)}`);
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
    /* S2: korak ≤ + 8 % ili + 3 km (veće od ta dva); kapija: 10 % ili 3 km + zaokruživanje dana */
    if (g.km > Math.max(ref * 1.1, ref + 3) + 0.25 * g.workouts)
      v.push(`n${String(g.index)} skok ${String(ref)} → ${String(g.km)} km`);
  });
  /* 3. lagan dan ≤ 65 % dugog (3 dana ≤ 70 %). Krug 5 (D1, D6): dugi koji trkač već trči je merilo — najveći od
     dugog te nedelje, prethodne 3 nedelje i najdužeg skorašnjeg iz profila (dugi kreće niže / ide u talasu) */
  const easyCap = runDays <= 3 ? 0.7 : 0.65;
  let maxEasy = 0;
  const d0 = doc.header.decisions;
  const recentLongKm = Math.min(d0.longStartSec, d0.longMaxSec) / ctx.paces.easy;
  for (const [i, g] of weeks.entries()) {
    if (g.longKm <= 0 || g.easyKm <= 0) continue;
    const building = g.kind === 'build' || g.kind === 'peak';
    const prevLong = Math.max(0, ...weeks.slice(Math.max(0, i - 3), i).map((x) => x.longKm));
    const wave = doc.weeks[i]?.intent.long?.wave ?? 1;
    const maxKm = d0.longMaxSec / ctx.paces.easy;
    const ref = building
      ? Math.max(g.longKm, prevLong, recentLongKm, Math.min(maxKm, g.longKm / wave))
      : g.longKm;
    maxEasy = Math.max(maxEasy, g.easyKm / ref);
    if (g.easyKm > easyCap * ref + 0.25)
      v.push(
        `n${String(g.index)} lagan ${String(g.easyKm)} > ${String(easyCap)} × dugi ${String(Math.round(ref * 10) / 10)}`
      );
  }
  /* 4. udeo dugog (S3): 3 dana ≤ 50 %; 4+ dana ≤ 40 % od 45 km nedeljno, ispod toga ≤ 42 % i ≤ 45 % u najviše
     3 nedelje (i dugi ≤ 2 h 15); nedelje rampe izuzete */
  let maxShare = 0;
  let over42 = 0;
  for (const g of weeks) {
    if (g.ramp || g.longKm <= 0 || g.kind === 'race' || runDays < 3) continue;
    maxShare = Math.max(maxShare, g.longKm / g.km);
    const low = runDays >= 4 && g.km < 45;
    /* dopuna kruga 4 (D4, trener § D4): 45–50 km nedeljno udeo do 42 % */
    const mid = runDays >= 4 && g.km >= 45 && g.km < 50;
    const cap = runDays < 4 ? 0.5 : low ? 0.45 : mid ? 0.42 : 0.4;
    if (low && g.longKm > 0.42 * g.km + 0.25) over42 += 1;
    if (g.longKm > cap * g.km + 0.25)
      v.push(`n${String(g.index)} dugi ${String(g.longKm)} od ${String(g.km)} km`);
    if (low && g.longMin > 135.5)
      v.push(`n${String(g.index)} dugi ${String(Math.round(g.longMin))} min > 2 h 15`);
  }
  if (over42 > 3) v.push(`dugi > 42 % nedelje u ${String(over42)} nedelja (najviše 3)`);
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
  /* krug 5 (D6, odluka organizatora): sa 3 dana dugi kreće sa 85 % najdužeg, a lagan dan ne sme preko 70 % dugog —
     nedelja 1 tada ≥ 90 % */
  const firstMin = runDays <= 3 ? 0.9 : 0.95;
  if (first !== undefined && first.index === 1 && firstPct < firstMin)
    v.push(`nedelja 1 ${String(first.km)} km < 95 % od ${String(baseKm)}`);

  /* 8. brz rad (S1): nedelja ≤ 22 %, vršna ≤ 25 % vremena trčanja; trka i test se ne broje; nedelja trke se ne meri
     (oštrenje je izuzeto) */
  let maxFast = 0;
  let peakFast = 0;
  for (const g of weeks) {
    if (g.kind === 'race' || g.durMin <= 0) continue;
    const share = g.fastMin / g.durMin;
    maxFast = Math.max(maxFast, share);
    if (g.kind === 'peak') peakFast = Math.max(peakFast, share);
    const cap = g.kind === 'peak' ? 0.25 : 0.22;
    if (share > cap + 0.005)
      v.push(`n${String(g.index)} brz rad ${String(Math.round(share * 100))} % > ${String(cap * 100)} %`);
  }
  /* 10. dopuna kruga 4: vršna nedelja 16–25 % brzog rada (početnik sa kratkim stažom i tegoba: ≥ 10 %) */
  const easyStart =
    doc.header.decisions.level === 'pocetnik-nov' || doc.header.decisions.painCaution === true;
  const peakMin = easyStart ? 0.1 : 0.16;
  if (weeks.some((g) => g.kind === 'peak') && peakFast < peakMin - 0.005)
    v.push(`vršna nedelja brz rad ${String(Math.round(peakFast * 100))} % < ${String(peakMin * 100)} %`);
  /* 9. nova provera (T7): plan ≥ 16 nedelja ima dugi ≥ 15 km ili 1 h 50 */
  const longestMin = Math.max(...weeks.map((g) => g.longMin));
  const longestKm = Math.max(...weeks.map((g) => g.longKm));
  if (doc.weeks.length >= 16 && longestKm < 15 && longestMin < 110)
    v.push(`najduži dugi ${String(longestKm)} km / ${String(Math.round(longestMin))} min < 15 km ili 1 h 50`);

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
    maxFastShare: maxFast,
    peakFastShare: peakFast,
    ladder,
    violations: v
  };
}
