/* KAPIJA 10 KM — brojevi plana u km i provere, po obrascu kapije polumaratona (krugovi R3–R7), sa brojevima za
   10 km. Deli ih test `gate.test.ts` i skripta `docs/generators-v4/plans/gate.ts --dist tenk`, da izveštaj i test
   mere isto. Sve mere su u km iz `summarize` (isti broj koji ispis pokazuje), dan trke se ne broji.
   Razlike prema polumaratonu: lestvica vrha u km je niža; dugi ≤ 36 % nedelje (3 dana ≤ 47 %); lagan dan ≤ 80 %
   dugog kod 4 dana (3 i 5+ dana 75 %); plan ≥ 12 nedelja stiže do dugog ≥ 10 km ili 1 h; nedelja −2 ≤ 85 % vrha, nedelja trke
   ≤ 60 %; nema pravila „dugi prema vremenu trke". */
import { tenk } from '../index';
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

/** Tabela vrha za 10 km u km (ciljni planovi trenera: p11 × 1,8 za 18 ned, p03 × 1,4 za 12, p01 × 1,33 za 16,
    p06 × 1,3 za 8): polazno ≤ 25 km → × 1,8 (≥ 18 ned), × 1,5 (12–17), × 1,35 kraće; 25–35 km → × 1,45 (≥ 12 ned),
    × 1,3 kraće; ≥ 35 km → × 1,35 (≥ 12 ned), × 1,25 kraće; staž < 8 nedelja ili tegoba u 12 meseci → najviše
    × 1,4. */
export function ladderKm(baseKm: number, weeks: number, limited: boolean): number {
  let x = weeks >= 12 ? 1.35 : 1.25;
  if (baseKm <= 25.5) x = weeks >= 18 ? 1.8 : weeks >= 12 ? 1.5 : 1.35;
  else if (baseKm <= 35.5) x = weeks >= 12 ? 1.45 : 1.3;
  return limited ? Math.min(x, 1.4) : x;
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
  /* 3. lagan dan ≤ 80 % dugog (10 km: dugi je ≤ 100 min i trećina nedelje). Krug 5 (D1, D6): dugi koji trkač već trči je merilo — najveći od
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
  /* 4. udeo dugog: 3 dana ≤ 47 %, 4 dana ≤ 36 %, 5+ dana ≤ 33 % (README trenera: 30–33 %; zaokruživanje dana);
     nedelje rampe izuzete */
  let maxShare = 0;
  for (const g of weeks) {
    if (g.ramp || g.longKm <= 0 || g.kind === 'race' || runDays < 3) continue;
    maxShare = Math.max(maxShare, g.longKm / g.km);
    const cap = runDays === 3 ? 0.47 : runDays === 4 ? 0.36 : 0.33;
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
      v.push(
        `n${String(g.index)} brz rad ${String(Math.round(share * 100))} % > ${String(cap * 100)} %`
      );
  }
  /* 10. vršna nedelja 14–25 % brzog rada (10 km: ciljni p03 15 %, p11 17 %; početnik sa kratkim stažom i tegoba:
     ≥ 10 %) */
  /* Z8 (krug 7): traženi dani uz lagan dan na najkraćem trajanju (upozorenje `lagan-kratak`) — obim ne nosi kvalitet
     (motor ga zamenjuje laganim, upozorenje `obim-za-nivo`), pa vršna nedelja nema donju granicu brzog rada, a nedelja
     trke ne može ispod najkraćih laganih dana (p06: 5 dana, 30 km) */
  const shortEasy = doc.header.warnings.some((w) => w.code === 'lagan-kratak');
  const easyStart =
    doc.header.decisions.level === 'pocetnik-nov' ||
    doc.header.decisions.painCaution === true ||
    shortEasy;
  const peakMin = easyStart ? 0.1 : 0.14;
  /* krug 9 (A1): vršna nedelja i uz lagan-kratak ima donju granicu brzog rada (kvalitet se skraćuje, ne briše) */
  if (weeks.some((g) => g.kind === 'peak') && peakFast < peakMin - 0.005)
    v.push(
      `vršna nedelja brz rad ${String(Math.round(peakFast * 100))} % < ${String(Math.round(peakMin * 100))} %`
    );
  /* 9. plan ≥ 12 nedelja ima dugi ≥ 10 km ili 1 h (dužina trke); dugi ≤ 1 h 40 */
  const longestMin = Math.max(...weeks.map((g) => g.longMin));
  const longestKm = Math.max(...weeks.map((g) => g.longKm));
  if (doc.weeks.length >= 12 && longestKm < 10 && longestMin < 60)
    v.push(
      `najduži dugi ${String(longestKm)} km / ${String(Math.round(longestMin))} min < 10 km ili 1 h`
    );
  /* spor nivo (krug 2, B2): do 1 h 50 */
  /* krug 10 (stavka 14): plafon po broju dana iz podatka (srednji sa 3 dana do 1 h 50) */
  const byDays =
    tenk.safety.longMaxSecByRunDays?.[doc.header.decisions.level]?.[
      String(doc.header.decisions.runDays.length)
    ];
  const longCapMin =
    byDays !== undefined ? byDays / 60 + 1 : doc.header.decisions.level === 'spor' ? 111 : 101;
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
  if (m2 !== undefined && m2Week !== undefined && peakKm > 0) {
    if (m2.km > 0.85 * peakKm + 0.5) v.push(`nedelja −2 ${String(m2.km)} km > 85 % vrha`);
    const fastDays = m2Week.days.filter((x) => fastOf(x) > 0).length;
    if (fastDays > 2) v.push(`nedelja −2 ima ${String(fastDays)} brza treninga`);
  }
  const rw = weeks[nW - 1];
  /* nedelja trke sa traženim danima na najkraćem laganom (lagan-kratak) ne može ispod 60 % vrha (p06: 5 dana) */
  if (!shortEasy && rw !== undefined && peakKm > 0 && rw.km > 0.6 * peakKm + 0.5)
    v.push(`nedelja trke ${String(rw.km)} km > 60 % vrha`);
  /* ---- krug 2 (dopuna drugog sudije) ---- */
  /* 15. B7: tempo trke raste preko urađenog praga — plan ≥ 12 nedelja ima tempo trke od ≥ 6 km rada (srednji, brz)
     ili ≥ 4 km (ostali); prvi tempo trke ≥ 60 % minuta poslednjeg praga pre njega */
  if (doc.weeks.length >= 12) {
    const rp = all.filter((x) => x.workout?.stimulus === 'tempo-trke');
    const rpKm = Math.max(0, ...rp.map((x) => (x.workout?.workSec ?? 0) / ctx.paces.RP));
    const needKm = lvl === 'srednji' || lvl === 'brz' ? 6 : 4;
    if (rpKm < needKm - 0.05)
      v.push(`najveći tempo trke ${rpKm.toFixed(1)} km < ${String(needKm)} km`);
    const first = rp[0];
    if (first !== undefined) {
      const prags = all.filter(
        (x) =>
          x.date < first.date &&
          (x.workout?.stimulus === 'prag' || x.workout?.stimulus === 'prag-p')
      );
      const lastPrag = prags[prags.length - 1]?.workout?.workSec ?? 0;
      if ((first.workout?.workSec ?? 0) < 0.6 * lastPrag - 30)
        v.push(
          `prvi tempo trke ${String(Math.round((first.workout?.workSec ?? 0) / 60))} min < 60 % praga ${String(Math.round(lastPrag / 60))} min`
        );
    }
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
