/* HM v3 — ČUVAR BEZBEDNOSTI: 9 provera, samo prijavljuje (ne menja plan). */

import { daysBetween } from './fromV2/dates.ts';
import { midEasy } from './fromV2/paces.ts';
import { HM_V2_POLICY as P, type PlanRule } from './fromV2/policy.ts';
import type { HmV2Plan, Violation, WorkZone } from './fromV2/types.ts';
import { capSec, hoursCapKm, stepCapKm, type Scale } from './scale.ts';

const TOL = 0.15;

export function guard(plan: HmV2Plan, rule: PlanRule, s: Scale): Violation[] {
  const out: Violation[] = [];
  const bad = (rule: string, week: number, message: string): void => {
    out.push({ rule, severity: 'error', week, message });
  };
  const p = plan.paces;
  const beginner = rule.beginner;
  const hours = Math.max(hoursCapKm(p), s.startKm);
  const longs: number[] = [];
  let prevBuild = s.startKm;
  const last = plan.weeks[plan.weeks.length - 1]!;
  for (const w of plan.weeks) {
    const n = w.index;
    // 1. Plafon rada po treningu i zoni (G4/H11).
    for (const d of w.days)
      for (const z of ['T', 'I', 'R', 'RP'] as WorkZone[]) {
        const sec = d.workout.segments
          .filter((g) => (g.kind === 'rep' || g.kind === 'continuous') && g.zone === z)
          .reduce((a, g) => a + g.sec, 0);
        const inLong = d.workout.kind === 'long' || d.role === 'sharpener';
        if (sec > 0 && !inLong && sec > capSec(z, w.targetKm, p, beginner) + 1)
          bad('ZONE_CAP', n, `${d.date}: ${z} ${Math.round(sec / 60)} min iznad plafona.`);
      }
    // 2. Satni plafon nedelje (G1).
    if (w.targetKm > hours + TOL) bad('HOURS', n, `Cilj ${w.targetKm} km iznad satnog plafona.`);
    // 3. Rast obima prema prethodnoj izgradnji (H6).
    const build = !w.deload && w.phase !== 'taper' && w.phase !== 'race';
    if (build && w.targetKm - prevBuild > stepCapKm(prevBuild, beginner) + TOL)
      bad('GROWTH', n, `Rast ${w.targetKm - prevBuild} km prevelik.`);
    if (build) prevBuild = w.targetKm;
    // 4. Lagan ≤ dugi; 5. nema praznog treninga.
    const long = w.days.find((d) => d.workout.kind === 'long')?.workout.km;
    for (const d of w.days) {
      if (long !== undefined && d.workout.kind === 'easy' && d.workout.km > long)
        bad('EASY_OVER_LONG', n, `${d.date}: lagan duži od dugog.`);
      if (!(d.workout.km > 0) || !(d.workout.sec > 0) || !d.workout.title)
        bad('EMPTY', n, `${d.date}: prazan trening.`);
    }
    // 6. Nedelja ne ispod smislenog minimuma (red H15), osim trkačke.
    if (w.phase !== 'race' && w.plannedKm < rule.weekMinKm - TOL)
      bad('WEEK_MIN', n, `Planirano ${w.plannedKm} km ispod ${rule.weekMinKm} km.`);
    // 7. Dugi: najduži, trajanje (H13) i kotrljajuća granica (pouka 28).
    if (long !== undefined) {
      const sec = long * midEasy(p);
      const maxSec = beginner ? Infinity : P.lengths.longMaxSec;
      if (long > s.longestKm + 0.05 || long > P.lengths.longMaxKm || sec > maxSec + 600)
        bad('LONG_CAP', n, `Dugi ${long} km iznad plafona.`);
      const prev = longs.slice(-P.recentLong.windowWeeks);
      if (plan.input.recentLongRunKm != null && n <= P.recentLong.windowWeeks)
        prev.push(plan.input.recentLongRunKm);
      if (prev.length) {
        const L = Math.max(...prev);
        if (long > Math.max(P.recentLong.factor * L, L + P.recentLong.addKm) + 0.05)
          bad('LONG_STEP', n, `Dugi ${long} km skače preko granice prethodnih nedelja.`);
      }
      longs.push(long);
    }
    // 8. Trka je poslednji dan poslednje nedelje i jedina.
    const races = w.days.filter((d) => d.role === 'race');
    if ((w === last) !== (races.length === 1) || races.length > 1)
      bad('RACE_LAST', n, 'Trka mora biti samo poslednjeg dana plana.');
  }
  const lastDay = last.days[last.days.length - 1];
  if (!lastDay || lastDay.role !== 'race' || lastDay.date !== plan.input.raceDate)
    bad('RACE_LAST', last.index, 'Poslednji dan plana nije trka.');
  // 9. Tvrdi dani nisu uzastopni (osim trke posle oštrenja ≥ 3 dana — ne može biti susedno).
  for (const w of plan.weeks)
    for (let i = 1; i < w.days.length; i++) {
      const a = w.days[i - 1]!;
      const b = w.days[i]!;
      const gap = daysBetween(a.date, b.date);
      if (a.hard && b.hard && gap === 1 && !(a.role === 'test' && b.role === 'long'))
        bad('HARD_ADJ', w.index, `${a.date} i ${b.date}: dva teška dana zaredom.`);
    }
  return out;
}
