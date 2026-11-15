/* W1 (hm-v2.15.0) — nezavisne invarijante i profili mreže W1 (nije testni fajl: dele ga w1.node.test.ts i merenje
   za reports/W1-HM-REPORT.md). Brojevi iz odluka (H15, H17, brief W1), ne iz koda generatora. */

import { KM_BY_DAYS, type Profile, SCHEDULES_BY_DAYS } from './testInputs.ts';
import type { HmV2Plan } from './types.ts';

/** H15 (nezavisno): minimum nedelje po broju dana. */
const WEEK_MIN: Record<number, number> = { 3: 12, 4: 16, 5: 20, 6: 24 };
/** H17 (nezavisno): obim početnika. */
const BEG_KM: Record<number, [number, number]> = { 4: [20, 40], 5: [25, 45] };
export const EPS = 1e-9;

export interface W1Case {
  id: string;
  profile: Profile;
}

/** Osnovni profili W1-D za dužinu N. */
export function w1Cases(ns: readonly number[]): W1Case[] {
  const out: W1Case[] = [];
  for (const weeks of ns)
    for (const days of [3, 4, 5, 6] as const)
      for (const kind of ['res', 'feel', 'beg'] as const) {
        if (kind === 'beg' && days !== 4 && days !== 5) continue;
        const [lo, hi] =
          kind === 'beg' ? BEG_KM[days]! : [KM_BY_DAYS[days].min, KM_BY_DAYS[days].max];
        for (const km of [lo, hi])
          for (const sc of ['A', 'C'] as const) {
            const s = SCHEDULES_BY_DAYS[days][sc];
            const profile: Profile = { weeks, km, days: s.days, long: s.long };
            if (kind === 'res') profile.vdot = km === lo ? 38 : 52;
            else if (kind === 'feel') profile.easyPaceSecPerKm = km === lo ? 420 : 330;
            else
              Object.assign(profile, { beginner: true, easyPaceSecPerKm: km === lo ? 450 : 390 });
            out.push({ id: `${weeks}w-d${days}-${km}km-${kind}-${sc}`, profile });
          }
      }
  return out;
}

/** W1-C (nezavisno): tačno jedno upozorenje dužine, ista rečenica u napomeni plana; kratak — „Skraćena priprema" sa
    MIN, dug — „duži od preporučenih 20 nedelja" sa nedeljom K + 1. */
export function warningViolations(p: HmV2Plan, weeks: number): string[] {
  const bad: string[] = [];
  const ws = p.warnings.filter((w) => w.rule === 'PLAN_LENGTH');
  const min = p.input.experience === 'beginner' ? 12 : 10;
  if (weeks >= min && weeks <= 20) {
    if (ws.length > 0) bad.push('upozorenje dužine u planu [MIN, MAX]');
    return bad;
  }
  if (ws.length !== 1) return [`upozorenja dužine: ${ws.length}`];
  const t = ws[0]!.message;
  if (!p.notes.includes(t)) bad.push('napomena plana bez upozorenja');
  if (/W1|layout|MIN|MAX/.test(t)) bad.push(`interna oznaka: ${t}`);
  if (weeks < min) {
    if (!t.startsWith('Skraćena priprema: plan ima ') || !t.includes(`najmanje ${min}.`))
      bad.push(`tekst: ${t}`);
  } else if (
    !t.startsWith('Plan je duži od preporučenih 20 nedelja: ') ||
    !t.endsWith(`počinje u nedelji ${weeks - 19}.`)
  )
    bad.push(`tekst: ${t}`);
  return bad;
}

/** Nezavisne invarijante plana W1 (prekršaji kao tekst). */
export function w1Violations(p: HmV2Plan, weeks: number): string[] {
  const bad: string[] = [...warningViolations(p, weeks)];
  const min = WEEK_MIN[p.input.runDays.length]!;
  if (p.weeks.length !== weeks) bad.push(`broj nedelja ${p.weeks.length}`);
  const last = p.weeks[p.weeks.length - 1]!;
  if (last.phase !== 'race' || !last.days.some((d) => d.role === 'race'))
    bad.push('poslednja nedelja nije trkačka');
  for (const w of p.weeks) {
    if (w.phase === 'race' && w !== last) bad.push(`ned ${w.index}: trkačka nije poslednja`);
    // Trkačka nedelja: planirano + trka ≥ minimum (kao mreža 02).
    const km = w.plannedKm + (w.phase === 'race' ? 21.1 : 0);
    if (km + EPS < min) bad.push(`ned ${w.index}: ${w.plannedKm} km < minimum ${min}`);
    for (const d of w.days)
      if (d.role !== 'race' && (!(d.workout.km > 0) || !(d.workout.sec > 0)))
        bad.push(`ned ${w.index}: prazan trening ${d.date}`);
    const long = w.days.find((d) => d.role === 'long');
    if (w.phase !== 'race' && !long) bad.push(`ned ${w.index}: bez dugog`);
    if (long)
      for (const d of w.days)
        if (d.role === 'easy' && d.workout.km > long.workout.km + EPS)
          bad.push(`ned ${w.index}: lagan ${d.workout.km} > dugi ${long.workout.km}`);
  }
  return bad;
}
