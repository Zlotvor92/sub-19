/* SKALIRANJE — jedino mesto gde se šablon prilagođava trkaču. Vrh obima, najduži dugi, plafoni zona i korak rasta se
   određuju ovde jednom; kad ograničenje trkača preseče šablon, ovde nastaje i rečenica zašto (plan je nosi). */
import { CAPS } from './templates.ts';
import type { Paces, V3Input } from './types.ts';

export interface Scale {
  level: 'beginner' | 'slow' | 'mid' | 'fast';
  peakKm: number;
  hourCapMin: number | null;
  longMaxKm: number;
  /** najduži dugi bez vremenskog plafona (dugi sa blokom RP je brži, pa staje u isto vreme) */
  longNoTimeKm: number;
  longShare: number;
  longStartKm: number;
  longTimeCapMin: number;
  longStepKm: number;
  blockMaxKm: number;
  caps: { T: number; I: number; RP: number }; // minuti rada po treningu
  tStartMin: number;
  wu: number; // minuti
  cd: number;
  stepCap: (km: number) => number;
  singleQuality: boolean;
  /** km koje dani mogu da nose pri najdužem dugom (lagan ≤ 65/75 % dugog, dan pred dugi ≤ 50 %) */
  capacityKm: number;
  reasons: string[];
}

const lerp = (x: number, x0: number, x1: number, y0: number, y1: number): number =>
  y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
const r1 = (x: number): number => Math.round(x * 10) / 10;

export function computeScale(
  input: V3Input,
  p: Paces,
  N: number,
  rampWeeks: number,
  dayBeforeLongIsRun: boolean
): Scale {
  const v = p.vdot;
  const days = input.runDays.length;
  const start = input.weeklyKm;
  const level = input.beginner ? 'beginner' : v < 40 ? 'slow' : v < 52 ? 'mid' : 'fast';
  const reasons: string[] = [];

  // korak rasta nedeljnog obima: +5–10 %, ispod 25 km do +2 km; početnik +1,5 km ili 6 %
  const stepCap = input.beginner
    ? (km: number): number => Math.max(1.5, 0.06 * km)
    : (km: number): number => Math.max(2, 0.08 * km);

  // vrh obima: množilac po dužini pripreme (početnik do × 2,0 za 20 nedelja), satni plafon, apsolutni plafon
  const mult = input.beginner
    ? lerp(N, 4, 20, 1, 2)
    : N <= 12
      ? lerp(N, 6, 12, 1.1, 1.3)
      : lerp(N, 12, 16, 1.3, 1.4);
  let peak = start * mult;
  const hours =
    level === 'beginner'
      ? CAPS.hoursBeginner
      : level === 'slow'
        ? CAPS.hoursSlow
        : level === 'mid'
          ? CAPS.hoursMid
          : null;
  const hourCapMin = hours ? hours * 60 : null;
  if (hourCapMin) {
    const byHours = (hourCapMin * 60) / p.easy;
    if (byHours < peak) {
      peak = Math.max(start, byHours);
      reasons.push(
        `Vrh obima ${Math.round(peak)} km: satni plafon za tvoj nivo je ${hours} h nedeljno (km se računaju iz laganog tempa).`
      );
    }
  }
  if (peak > CAPS.peakAbsKm && start < CAPS.peakAbsKm) peak = CAPS.peakAbsKm;
  if (start >= CAPS.peakAbsKm) peak = start;
  // dostižnost: korak rasta kroz nedelje gradnje
  let reach = start;
  for (let i = 1; i < rampWeeks; i++) reach += stepCap(reach);
  if (reach < peak - 0.5) peak = reach;

  // najduži dugi: vreme, udeo nedelje, apsolutni plafon po nivou
  const timeCap = input.beginner ? CAPS.longTimeBeginnerMin : CAPS.longTimeMin;
  const share = input.beginner
    ? 0.45
    : Math.min(CAPS.longShare[days] ?? 0.35, level === 'fast' && peak >= 70 ? 0.3 : 1);
  const abs = input.beginner ? 99 : lerp(v, 45, 58, 22, 26);
  const byTime = (timeCap * 60) / p.easy;
  const byShare = share * peak;
  let longMax = Math.min(abs, byTime, byShare);
  // početnik: T do 25 min (20 km/ned) → 28 min (45 km/ned)
  const T = input.beginner
    ? Math.min(28, 25 + (start - 20) * 0.12)
    : peak < 45
      ? 30
      : peak < 80
        ? 35
        : 40;
  // WU/CD po nivou i obimu (trenerski deo treninga, ne pufer za km)
  const wu = input.beginner || start < 25 ? 10 : start < 40 ? 15 : 20;
  const cd = input.beginner || start < 25 ? 10 : start < 40 ? 10 : 15;
  // ispod 25 km nedeljno obim nosi jedan kvalitet; drugi dan je lagan sa malim podražajem
  const singleQuality = !input.beginner && days >= 4 && start < 25;
  if (singleQuality)
    reasons.push(
      'Ispod 25 km nedeljno plan ima jedan kvalitet nedeljno; drugi je lagan dan sa kratkim podražajem.'
    );

  // nosivost dana: vrh obima ne sme tražiti više nego što dani mogu da nose
  const others = input.runDays.length - 1;
  const qCount = input.beginner ? 1 : Math.min(2, others);
  const qKm = (wu + cd) / (p.easy / 60) + T / (p.T / 60);
  const easyShare = days === 3 ? CAPS.easyShareOfLong3 : CAPS.easyShareOfLong;
  const easyCount = others - (days === 3 ? 1 : qCount);
  const capacity = (L: number): number =>
    L +
    (days === 3 ? 1 : qCount) * qKm +
    (easyCount > 0 ? (easyCount - (dayBeforeLongIsRun ? 1 : 0)) * easyShare * L : 0) +
    (easyCount > 0 && dayBeforeLongIsRun ? CAPS.dayBeforeLong * L : 0);
  const capacityKm = capacity(longMax);
  if (capacityKm < peak) {
    peak = Math.max(Math.min(start, capacityKm), capacityKm);
    reasons.push(
      `Sa ${days} dana trčanja plan nosi najviše oko ${Math.round(capacityKm)} km nedeljno (dugi ${r1(longMax)} km, lagani dani do ${Math.round(easyShare * 100)} % dugog).`
    );
  }
  longMax = Math.min(longMax, share * peak + 0.01);
  const longNoTime = Math.min(abs, share * peak + 0.01);
  if (longMax === byTime && longMax < abs)
    reasons.push(
      `Najduži dugi je vođen vremenom: do ${Math.floor(timeCap / 60)} h ${String(timeCap % 60).padStart(2, '0')} min.`
    );

  // početak dugog: ≈ skorašnji najduži + 1 km, ili udeo sadašnjeg obima; u rasponu 0,6–0,82 najdužeg
  const base = input.recentLongRunKm
    ? input.recentLongRunKm + 1
    : (input.beginner
        ? 0.33
        : (({ 3: 0.42, 4: 0.34, 5: 0.3 } as Record<number, number>)[days] ?? 0.27)) * start;
  const longStart = Math.min(
    Math.max(base, (input.beginner ? 0.45 : 0.6) * longMax),
    0.82 * longMax
  );

  const blockMax = input.beginner
    ? lerp(start, 20, 45, 4, 5)
    : Math.min(v >= 55 ? 12 : lerp(v, 38, 45, 8, 10), 48 / (p.RP / 60), 0.2 * peak);
  // RP usred nedelje: plafon po nivou, ali ne više od 20 % vrha obima u km (pretpostavka, v. izveštaj)
  const RP = Math.min(
    input.beginner ? lerp(start, 20, 40, 25, 35) : lerp(v, 35, 45, 35, 44),
    (0.2 * peak * p.RP) / 60
  );
  // brz rad po treningu i kao udeo vrha obima u km: T ≤ 13 %, I ≤ 10 % (pretpostavka, v. izveštaj)
  const I = Math.min(v < 40 ? 20 : 24, (0.1 * peak * p.I) / 60);
  const Tc = Math.min(T, (0.13 * peak * p.T) / 60);
  const tStartMin = input.beginner
    ? Math.min(10 + 0.15 * Math.max(0, start - 20), 0.6 * Tc)
    : Math.min(Math.max(0.38 * start, 12), 0.7 * Tc);

  return {
    level,
    peakKm: r1(peak),
    hourCapMin,
    longMaxKm: r1(longMax),
    longNoTimeKm: r1(longNoTime),
    longShare: share,
    longStartKm: r1(longStart),
    longTimeCapMin: timeCap,
    longStepKm: input.beginner ? 1 : 2,
    blockMaxKm: Math.floor(blockMax * 2) / 2,
    caps: { T: Tc, I, RP },
    tStartMin,
    wu,
    cd,
    stepCap,
    singleQuality,
    capacityKm: r1(capacityKm),
    reasons
  };
}
