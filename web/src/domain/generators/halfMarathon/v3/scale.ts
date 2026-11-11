/* HM v3 — SKALIRANJE (jedino mesto odluke o brojevima). Brojevi su iz v2 politike: faktor vrha i satni plafon (G1),
   plafoni minuta rada po treningu (G4) i udeli zone (H11), najduži dugi (H13/H15), rast (H6). Kad šablon ne staje u
   ograničenja trkača, ovde se spušta i plan dobija rečenicu zašto. */

import { midEasy, round1 } from './fromV2/paces.ts';
import { HM_V2_POLICY as P, type PlanRule } from './fromV2/policy.ts';
import type { Paces } from './fromV2/types.ts';
import { COACH, type QZone, type Template } from './templates.ts';

const last = <T>(xs: readonly T[], ok: (x: T) => boolean): T => xs.filter(ok).pop() ?? xs[0]!;

/** Plafon rada jednog treninga u zoni [s] za cilj nedelje: min(G4 sekunde, udeo zone H11 × obim nedelje). */
export function capSec(z: QZone, weekKm: number, p: Paces, beginner: boolean): number {
  const c = P.caps;
  if (z === 'T')
    return Math.min(last(c.workSec.T, (b) => b.fromKm <= weekKm).sec, c.T * weekKm * p.T);
  if (z === 'I')
    return Math.min(last(c.workSec.I, (b) => b.fromVdot <= p.vdot).sec, c.I * weekKm * p.I);
  if (z === 'RP') {
    const share = last(c.RP, (b) => b.fromKm <= weekKm).share;
    return Math.min(beginner ? COACH.beginnerRpSec : c.workSec.RP, share * weekKm * p.RP);
  }
  return c.R * weekKm * p.R;
}

/** G1: satni plafon nedelje [km] — cilj × srednji lagan tempo ≤ sati pojasa VDOT-a. */
export function hoursCapKm(p: Paces): number {
  const h = last(P.volume.peakHours, (b) => b.fromVdot <= p.vdot).hours;
  return (h * 3600) / midEasy(p);
}

/** H6: najveći rast nedelje izgradnje [km] prema prethodnoj izgradnji. */
export function stepCapKm(prevKm: number, beginner: boolean): number {
  if (beginner) return COACH.beginnerStepKm;
  const v = P.volume;
  return Math.min(v.growthMaxKm, Math.max(v.growthMinKm, v.growth * prevKm));
}

export interface Scale {
  startKm: number;
  peakKm: number;
  longestKm: number;
  /** Udeo nedelje za dugi (red H15; početnik COACH). */
  longShare: number;
  peakDoseSec: Record<QZone, number>;
  blockTopKm: number;
  notes: string[];
}

/** Vrh obima, najduži dugi i vrh doze po zoni. `rampSteps` = broj koraka lestvice obima (izgradnje do vrha). */
export function scaleOf(
  t: Template,
  rule: PlanRule,
  p: Paces,
  startKm: number,
  weeks: number,
  rampSteps: number
): Scale {
  const beginner = t.id === 'beginner';
  const notes: string[] = [];
  const step = stepCapKm(startKm, beginner);
  const factor = beginner
    ? COACH.beginnerPeakFactor
    : P.volume.peakFactorByWeeks.find((r) => weeks <= r.maxWeeks)!.factor;
  const limits: [string, number][] = [
    ['plan', startKm * factor],
    ['start', beginner ? Infinity : startKm + P.volume.peakAddKm],
    ['dani', rule.peakMaxKm],
    ['sati', hoursCapKm(p)],
    ['rast', startKm + rampSteps * step]
  ];
  const [why, raw] = limits.reduce((a, b) => (b[1] < a[1] ? b : a));
  const peakKm = round1(Math.max(startKm, raw));
  if (why === 'sati')
    notes.push(
      `Vrh obima ${f1(peakKm)} km: ograničen satnim plafonom nedelje (≈ ${f1((peakKm * midEasy(p)) / 3600)} h laganim tempom).`
    );
  if (why === 'rast' && peakKm > startKm)
    notes.push(
      `Vrh obima ${f1(peakKm)} km: ograničen rastom od najviše ${f1(step)} km nedeljno do kraja lestvice obima.`
    );
  if (why === 'dani')
    notes.push(
      `Vrh obima ${f1(peakKm)} km: najviše za ${rule.quality === 1 ? 'ovaj' : 'izabrani'} broj dana.`
    );

  const longShare = beginner ? COACH.beginnerLongShare : rule.longMaxShare;
  const longCaps: [string, number][] = beginner
    ? [
        ['vreme', COACH.beginnerLongSec / midEasy(p)],
        ['obim', longShare * peakKm]
      ]
    : [
        ['km', P.lengths.longMaxKm],
        ['vreme', P.lengths.longMaxSec / p.E.slow],
        ['obim', longShare * peakKm]
      ];
  const [lwhy, lraw] = longCaps.reduce((a, b) => (b[1] < a[1] ? b : a));
  const longestKm = Math.floor(lraw * 2) / 2;
  if (lwhy === 'obim' && longestKm < rule.longWarnKm)
    notes.push(
      `Najduži dugi ${f1(longestKm)} km: ograničen obimom nedelje (≤ ${Math.round(longShare * 100)} % nedelje).`
    );
  if (beginner)
    notes.push(
      `Najduži dugi ${f1(longestKm)} km (≈ ${Math.round((longestKm * midEasy(p)) / 60)} min): u najdužem je dozvoljen 1 min hoda na svakih 10 min.`
    );

  const zones: QZone[] = ['T', 'I', 'R', 'RP'];
  const peakDoseSec = Object.fromEntries(
    zones.map((z) => [z, capSec(z, peakKm, p, beginner)])
  ) as Record<QZone, number>;
  const blockTopKm = t.blockTopKm + (p.vdot >= P.specific.fast.vdotMin ? COACH.fastBlockAddKm : 0);
  return { startKm, peakKm, longestKm, longShare, peakDoseSec, blockTopKm, notes };
}

export const f1 = (x: number): string => round1(x).toFixed(1).replace('.', ',');
