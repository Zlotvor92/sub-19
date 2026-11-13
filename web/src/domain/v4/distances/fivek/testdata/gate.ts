/* KAPIJA 5 KM — brojevi plana u km i provere, po obrascu kapije 10 km i polumaratona (krugovi R3–R9), sa brojevima za
   5 km. Deli ih test `gate.test.ts` i skripta `docs/generators-v4/plans/gate.ts --dist fivek`, da izveštaj i test
   mere isto. Sve mere su u km iz `summarize` (isti broj koji ispis pokazuje), dan trke se ne broji.
   Razlike prema 10 km: lestvica vrha u km je niža kod iskusnih, a viša kod malog obima; dugi ≤ 35 % nedelje (3 dana
   ≤ 46 %, 5+ dana ≤ 32 %); brz rad ≤ 20 % (najteža ≤ 23 %); najteža nedelja 5 km je posle provere i nosi tempo
   trke + završnicu dugog, pa donja granica brzog rada važi za NAJBRŽU nedelju plana (≥ 12 %), ne za najtežu; plan
   ≥ 10 nedelja stiže do dugog ≥ 7 km ili 50 min (početnik ≥ 6 km ili 45 min), dugi ≤ 90 min; nedelja trke
   ≤ 50 % vrha; nema pravila „dugi prema vremenu trke". */
import { diffDays } from '../../../engine/dates';
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

/** Tabela vrha za 5 km u km (ciljni planovi trenera: p11 × 1,6 za 16 ned, p01 × 1,2 za 12, p04 × 1,1 za 16, p08
    × 1,03 za 16): polazno ≤ 20 km → × 1,7 (≥ 14 ned), × 1,5 (8–13), × 1,35 kraće; 20–35 km → × 1,35 (≥ 12 ned),
    × 1,25 kraće; > 35 km → × 1,3 (≥ 12 ned), × 1,22 (8–11), × 1,15 kraće (R12, F1); staž < 8 nedelja ili tegoba u 12 meseci → najviše
    × 1,5. */
export function ladderKm(baseKm: number, weeks: number, limited: boolean): number {
  let x = weeks >= 12 ? 1.3 : weeks >= 8 ? 1.22 : 1.15;
  if (baseKm <= 20.5) x = weeks >= 14 ? 1.7 : weeks >= 8 ? 1.5 : 1.35;
  else if (baseKm <= 35.5) x = weeks >= 12 ? 1.35 : 1.25;
  return limited ? Math.min(x, 1.5) : x;
}

function limitedRunner(facts: RunnerFacts): boolean {
  const years = facts.profile.yearsRunning;
  if (years !== undefined && years * 52 < 8) return true;
  return [...(facts.painHistory ?? []), ...facts.pain].some((p) => {
    const age = diffDays(facts.today, p.date);
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
  /* povratak posle pauze (upozorenje `povratak`): motor vraća obim svojom rampom do sadašnjeg obima — rampa nije
     skok ni manjak nedelje 1 */
  const returning = doc.header.warnings.some((w) => w.code === 'povratak');
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
    if (ref <= 0 || (returning && g.km <= baseKm + 0.5)) return;
    maxJump = Math.max(maxJump, g.km / ref - 1);
    /* S2: korak ≤ + 8 % ili + 3 km (veće od ta dva); kapija: 10 % ili 3 km + zaokruživanje dana */
    if (g.km > Math.max(ref * 1.1, ref + 3) + 0.25 * g.workouts)
      v.push(`n${String(g.index)} skok ${String(ref)} → ${String(g.km)} km`);
  });
  /* 3. lagan dan ≤ 80 % dugog (5 km: dugi je ≤ 90 min i trećina nedelje). Krug 5 (D1, D6): dugi koji trkač već trči je merilo — najveći od
     dugog te nedelje, prethodne 3 nedelje i najdužeg skorašnjeg iz profila (dugi kreće niže / ide u talasu) */
  const easyCap = 0.8;
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
    /* krug 8 (R8 t. 12): izuzetak „lakša nedelja sa laganim danom na najkraćem trajanju meri samo K8" uklonjen —
       pravila motora (t. 2–4) ga više ne traže */
    if (g.easyKm > easyCap * ref + 0.25)
      v.push(
        `n${String(g.index)} lagan ${String(g.easyKm)} > ${String(easyCap)} × dugi ${String(Math.round(ref * 10) / 10)}`
      );
  }
  /* 4. udeo dugog: 3 dana ≤ 46 %, 4 dana ≤ 35 %, 5+ dana ≤ 32 % (README trenera 5K: 28–33 %, 3 dana do 42 %);
     nedelje rampe izuzete */
  let maxShare = 0;
  for (const g of weeks) {
    if (g.ramp || g.longKm <= 0 || g.kind === 'race' || runDays < 3) continue;
    maxShare = Math.max(maxShare, g.longKm / g.km);
    /* najteža nedelja i sužavanje: dugi sme do + 3 % (kvalitet i lagani se smanjuju pre dugog; `shortenedLongMaxShare`) */
    const lighter = g.kind === 'peak' || g.kind === 'taper' ? 0.03 : 0;
    const cap = (runDays === 3 ? 0.46 : runDays === 4 ? 0.35 : 0.32) + lighter;
    if (g.longKm > cap * g.km + 0.25)
      v.push(`n${String(g.index)} dugi ${String(g.longKm)} od ${String(g.km)} km`);
  }
  /* 5. broj treninga = traženi dani u svakoj punoj nedelji gradnje (van rampe) */
  const build = weeks.filter(
    (g) => (g.kind === 'build' || g.kind === 'peak') && !g.ramp && full(g)
  );
  /* M5 (krug 5): najkraće lagano po nivou — jedan dan manje uz upozorenje „dan-izostavljen" */
  const dropOk = doc.header.warnings.some((w) => w.code === 'dan-izostavljen');
  for (const g of build)
    if (g.workouts !== runDays && !(dropOk && g.workouts === runDays - 1))
      v.push(`n${String(g.index)} ${String(g.workouts)} treninga uz ${String(runDays)} dana`);
  /* 6. nedelja trke: lagan dan ≤ 40 min i ≤ isti dan prethodne nedelje */
  const raceWeek = doc.weeks[doc.weeks.length - 1];
  const prevWeek = doc.weeks[doc.weeks.length - 2];
  let raceEasy = 0;
  if (raceWeek !== undefined && raceWeek.intent.kind === 'race') {
    for (const day of raceWeek.days) {
      const x = day.workout;
      if (x === null || x.kind !== 'easy') continue;
      const min = summarize(x, ctx).durationSec / 60;
      raceEasy = Math.max(raceEasy, min);
      if (min > 40.5) v.push(`nedelja trke ${day.date} lagano ${String(Math.round(min))} min`);
      const same = prevWeek?.days.find((d) => d.date === addDays(day.date, -7))?.workout;
      if (same !== undefined && same !== null) {
        const before = summarize(same, ctx).durationSec / 60;
        /* dan se zaokružuje na 0,5 km */
        if (min > before + (0.5 * ctx.paces.easy) / 60)
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
  /* početnik: dugi ≤ 90 min i lagan ≤ 80 % dugog — početnik sa velikim obimom (p12: 45 km, 4 dana) kreće sa ≥ 85 % */
  const firstMin = doc.header.decisions.level === 'pocetnik' ? 0.85 : runDays <= 3 ? 0.9 : 0.95;
  if (!returning && first !== undefined && first.index === 1 && firstPct < firstMin)
    v.push(`nedelja 1 ${String(first.km)} km < 95 % od ${String(baseKm)}`);

  /* 8. brz rad (S1): nedelja ≤ 20 %, najteža ≤ 23 % vremena trčanja (README 5K: ≤ 20 %); trka i test se ne broje; nedelja trke se ne meri
     (oštrenje je izuzeto) */
  let maxFast = 0;
  let peakFast = 0;
  for (const g of weeks) {
    if (g.kind === 'race' || g.durMin <= 0) continue;
    const share = g.fastMin / g.durMin;
    maxFast = Math.max(maxFast, share);
    if (g.kind === 'peak') peakFast = Math.max(peakFast, share);
    const cap = g.kind === 'peak' ? 0.23 : 0.2;
    if (share > cap + 0.005)
      v.push(
        `n${String(g.index)} brz rad ${String(Math.round(share * 100))} % > ${String(cap * 100)} %`
      );
  }
  /* 10. najbrža nedelja plana ≥ 12 % brzog rada (5 km: ciljni p01 16 % u ned 7, p04 15 %, p08 15 %, p11 12 %;
     najteža nedelja posle provere nosi samo tempo trke + završnicu dugog — ciljni p01 9 %); početnik sa kratkim
     stažom, tegoba i lagan-kratak: ≥ 6 % (hod-trk i usponi nisu brz rad) */
  /* Z8 (krug 7): traženi dani uz lagan dan na najkraćem trajanju (upozorenje `lagan-kratak`) — obim ne nosi kvalitet
     (motor ga zamenjuje laganim, upozorenje `obim-za-nivo`), pa vršna nedelja nema donju granicu brzog rada, a nedelja
     trke ne može ispod najkraćih laganih dana (p06: 5 dana, 30 km) */
  const shortEasy = doc.header.warnings.some((w) => w.code === 'lagan-kratak');
  const easyStart =
    doc.header.decisions.level === 'pocetnik-nov' ||
    doc.header.decisions.painCaution === true ||
    shortEasy;
  /* početnik ≥ 6 % (ciljni p11 12 %; jedan kvalitet nedeljno, po osećaju bez I — p12 sa 45 km nosi 6 %: obim
     početnika raste, kvalitet ne; R12) */
  const peakMin = easyStart ? 0.06 : doc.header.decisions.level === 'pocetnik' ? 0.06 : 0.12;
  /* krug 9 (A1): vršna nedelja i uz lagan-kratak ima donju granicu brzog rada (kvalitet se skraćuje, ne briše) */
  if (doc.weeks.length >= 6 && maxFast < peakMin - 0.005)
    v.push(
      `najbrža nedelja brz rad ${String(Math.round(maxFast * 100))} % < ${String(Math.round(peakMin * 100))} %`
    );
  /* 9. plan ≥ 10 nedelja ima dugi ≥ 7 km ili 50 min (početnik i mali obim ≥ 6 km ili 45 min); dugi ≤ 90 min */
  const longestMin = Math.max(...weeks.map((g) => g.longMin));
  const longestKm = Math.max(...weeks.map((g) => g.longKm));
  const lvl0 = doc.header.decisions.level;
  const smallRunner = lvl0 === 'pocetnik' || lvl0 === 'pocetnik-nov' || lvl0 === 'mali';
  const [needLongKm, needLongMin] = smallRunner ? [6, 45] : [7, 50];
  if (doc.weeks.length >= 10 && longestKm < needLongKm && longestMin < needLongMin)
    v.push(
      `najduži dugi ${String(longestKm)} km / ${String(Math.round(longestMin))} min < ${String(needLongKm)} km ili ${String(needLongMin)} min`
    );
  const longCapMin = ['spor', 'pocetnik', 'povratnik'].includes(doc.header.decisions.level)
    ? 101
    : 91;
  if (longestMin > longCapMin)
    v.push(`najduži dugi ${String(Math.round(longestMin))} min > ${String(longCapMin - 1)} min`);

  /* ---- krug 5 (P5) ---- */
  const lvl = doc.header.decisions.level;
  const fastOf = (x: PlanDoc['weeks'][number]['days'][number]): number =>
    x.workout !== null && (x.workout.kind === 'quality' || x.workout.kind === 'long')
      ? x.workout.workSec
      : 0;
  /* 11. M2: nedelja gradnje nivoa sa dva kvaliteta (srednji, brz) ima dva kvaliteta kad šablon traži dva — osim
     nedelje sa proverom forme */
  /* plan sa „dan-izostavljen" (obim ne nosi sve dane, M5; p06) je ograničen obimom, ne zamenom zone */
  if ((lvl === 'srednji' || lvl === 'brz') && !dropOk)
    for (const w of doc.weeks) {
      if (w.intent.kind !== 'build' || w.intent.source !== 'template' || w.days.length < 7)
        continue;
      if (weeks[w.index - 1]?.ramp === true) continue;
      if (w.days.some((x) => x.workout?.kind === 'test')) continue;
      /* kalendarska nedelja −2: M7 (≤ 2 brza treninga uz blok u dugom) */
      if (w.index === doc.weeks.length - 2) continue;
      /* M2 važi za nedelju u kojoj plafon/zamena tempa trke deluje (tempo trke usred nedelje ili u dugom); jedan
         kvalitet zbog prostora u obimu (p06 n1–n2, p09 n5 — isto u krugu 4) je otvoreno pitanje, ne M2 */
      const rpWeek = w.days.some(
        (x) => x.workout?.stimulus === 'tempo-trke' || x.workout?.stimulus === 'dugi-rp'
      );
      if (!rpWeek) continue;
      const wanted = w.intent.stimuli.filter(
        (x) => !x.stimulus.startsWith('ubrzanja') && x.stimulus !== 'usponi-kratki'
      ).length;
      const placed = w.days.filter((x) => x.workout?.kind === 'quality').length;
      if (wanted >= 2 && placed < 2)
        v.push(`n${String(w.index)} ${String(placed)} kvalitet u nedelji gradnje (${lvl})`);
    }
  /* 12. M6: nema kvaliteta 2 dana pre provere forme */
  const all = doc.weeks.flatMap((w) => w.days);
  for (const t of all.filter((x) => x.workout?.kind === 'test'))
    for (const q of all)
      if (q.workout?.kind === 'quality' && q.date < t.date && addDays(q.date, 2) >= t.date)
        v.push(`kvalitet ${q.date} 2 dana pred proveru ${t.date}`);
  /* 13. M7: kalendarska nedelja −2 ≤ 85 % vrha (km) i ≤ 2 brza treninga; nedelja trke (bez trke) ≤ 60 % */
  const nW = doc.weeks.length;
  const m2 = weeks[nW - 3];
  const m2Week = doc.weeks[nW - 3];
  /* R17: plan ≤ 5 nedelja — najteža je baš nedelja −2 (sužavanje 7–10 dana), pravilo „−2 ≤ 85 %" ne važi */
  const shortPlan = m2Week?.intent.kind === 'peak';
  if (!shortPlan && m2 !== undefined && m2Week !== undefined && peakKm > 0) {
    if (m2.km > 0.85 * peakKm + 0.5) v.push(`nedelja −2 ${String(m2.km)} km > 85 % vrha`);
    const fastDays = m2Week.days.filter((x) => fastOf(x) > 0).length;
    if (fastDays > 2) v.push(`nedelja −2 ima ${String(fastDays)} brza treninga`);
  }
  const rw = weeks[nW - 1];
  /* nedelja trke sa traženim danima na najkraćem laganom (lagan-kratak) ne može ispod 50 % vrha */
  if (!shortEasy && rw !== undefined && peakKm > 0 && rw.km > 0.5 * peakKm + 0.5)
    v.push(`nedelja trke ${String(rw.km)} km > 50 % vrha`);
  /* ---- krug 2 (dopuna drugog sudije) ---- */
  /* 15. tempo trke: plan ≥ 10 nedelja ima tempo trke od ≥ 4,5 km rada (srednji, brz; ciljni 5 × 1000 m) ili ≥ 2,4 km
     (spor; ciljni p11 4 × 800 m), ≥ 2 km mali obim i početnik, ≥ 1,2 km hod-trk. */
  if (doc.weeks.length >= 10) {
    const rp = all.filter((x) => x.workout?.stimulus === 'tempo-trke');
    const rpKm = Math.max(0, ...rp.map((x) => (x.workout?.workSec ?? 0) / ctx.paces.RP));
    /* mali obim i početnik: plafon doze je udeo vrha (12 km nedeljno → ≈ 12 min tempa trke), hod-trk 1,2 km */
    const needKm =
      lvl === 'srednji' || lvl === 'brz'
        ? 4.5
        : lvl === 'pocetnik-nov'
          ? 1.2
          : lvl === 'spor'
            ? 2.4
            : 2;
    if (rpKm < needKm - 0.05)
      v.push(`najveći tempo trke ${rpKm.toFixed(1)} km < ${String(needKm)} km`);
    /* 5 km: tempo trke je brži od praga (blizu I zone), pa se prvi tempo trke ne poredi sa minutima praga (pravilo
       10 km B7); prvi tempo trke ≤ 70 % najvećeg meri K7 u `fivek.test.ts` */
  }
  /* 16. B9: sužavanje nije naopako — nedelja −1 ≤ nedelja −2 ≤ vrh (km, + 0,5 za zaokruživanje) */
  const w1 = weeks[nW - 2];
  if (m2 !== undefined && w1 !== undefined) {
    if (w1.km > m2.km + 0.5)
      v.push(`nedelja −1 ${String(w1.km)} km > nedelja −2 ${String(m2.km)} km`);
    if (m2.km > peakKm + 0.5) v.push(`nedelja −2 ${String(m2.km)} km > vrh ${String(peakKm)} km`);
  }

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
