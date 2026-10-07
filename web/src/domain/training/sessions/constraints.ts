import { r1 } from '../../format';
import type { Day, Session } from '../types';
import { KIND_FROM_GOAL, ZONE_FOR_KIND } from '../vdot/zoneForKind';
import { sessDesc, sessKm, sessQKm } from './calc';
import { proportionalRest } from './intervals';

const floorKm = (km: number): number => Math.floor((km + 1e-9) * 10) / 10;

/** Upper limits win over repetition minimums, including after volume/taper adjustments. */
export function constrainSession(s: Session, weeklyKm: number, tempoMaxSec: number): boolean {
  const zone =
    s.zone ??
    (s.kind === 'Oštrina'
      ? 'R'
      : KIND_FROM_GOAL.has(s.kind) && s.kind !== 'Oštrina'
        ? 'RP'
        : ZONE_FOR_KIND[s.kind]);
  s.zone = zone;
  s.paceSource = zone === 'RP' || zone === 'M' ? 'race-specific' : 'current-fitness';
  const pct = zone === 'I' ? 0.08 : zone === 'R' ? 0.05 : zone === 'T' ? 0.1 : 0.2;
  const budget = Math.min(weeklyKm * pct, zone === 'I' ? 10 : zone === 'R' ? 8 : Infinity);
  if (s.type === 'int') {
    const maxSec = zone === 'I' ? 300 : zone === 'R' ? 120 : Infinity;
    s.repM = Math.min(s.repM, Math.floor((maxSec * 1000) / s.paceSec / 100) * 100);
    s.reps = Math.min(s.reps, Math.floor((budget * 1000 + 1e-8) / s.repM));
    if (zone === 'I') s.restSec = proportionalRest(s.repM, s.paceSec);
    if (zone === 'R') s.restSec = Math.round((s.repM / 1000) * s.paceSec * 2.5);
    return s.repM >= 100 && s.reps >= 2;
  }
  if (s.type === 'pyramid') {
    const maxM = Math.floor((300 * 1000) / s.paceSec / 100) * 100;
    s.reps = s.reps.map((m) => Math.min(m, maxM));
    while (s.reps.length && s.reps.reduce((a, b) => a + b, 0) > budget * 1000 + 1e-8)
      s.reps.splice(Math.floor(s.reps.length / 2), 1);
    s.restSec = proportionalRest(Math.max(...s.reps, 0), s.paceSec);
    return s.reps.length >= 2;
  }
  if (s.type === 'fartlek') {
    s.repSec = Math.min(s.repSec, 300);
    s.reps = Math.min(s.reps, Math.floor((budget * s.paceSec) / s.repSec));
    return s.reps >= 2;
  }
  const limit = Math.min(budget, zone === 'T' ? tempoMaxSec / s.paceSec : Infinity);
  if (s.type === 'tempo') s.qKm = Math.min(s.qKm, floorKm(limit));
  if (s.type === 'prog') s.qKm = Math.min(s.qKm, floorKm(limit * 3));
  return sessQKm(s) >= 0.4;
}

/** Finite monotone reduction: shrinking a workout also shrinks its weekly denominator. */
export function constrainWeek(days: Day[], tempoMaxSec: number, easyPace: number): void {
  for (let pass = 0; pass < 30; pass++) {
    const volume = days.reduce((n, d) => n + (d.km || 0), 0);
    let changed = false;
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      if (!day?.session) continue;
      const before = JSON.stringify(day.session);
      const totalKm = day.km;
      if (!constrainSession(day.session, volume, tempoMaxSec)) {
        const km = day.km;
        days[i] = {
          dow: day.dow,
          tag: 'lako',
          km,
          desc: `${km} km lako @ ~${Math.floor(easyPace / 60)}:${String(easyPace % 60).padStart(2, '0')}/km`
        };
        changed = true;
      } else {
        const removed = Math.max(0, totalKm - sessKm(day.session));
        if (day.session.type === 'prog') day.session.qKm = Math.min(day.session.qKm, totalKm);
        else day.session.cdKm = r1(day.session.cdKm + removed);
        day.km = sessKm(day.session);
        day.desc = sessDesc(day.session);
        changed ||= before !== JSON.stringify(day.session);
      }
    }
    if (!changed) break;
  }
}
