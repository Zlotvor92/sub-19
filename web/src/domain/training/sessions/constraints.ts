import { r1 } from '../../format';
import type { Day, Session } from '../types';
import { KIND_FROM_GOAL, ZONE_FOR_KIND } from '../vdot/zoneForKind';
import { sessDesc, sessKm, sessQKm } from './calc';
import { proportionalRest } from './intervals';

const floorKm = (km: number): number => Math.floor((km + 1e-9) * 10) / 10;
const appendNote = (s: Session, note: string): void => {
  if (!s.notes?.split(' · ').includes(note)) s.notes = [s.notes, note].filter(Boolean).join(' · ');
};

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
    const originalQKm = (s.reps * s.repM) / 1000;
    // Volume trimming can make the chosen cruise format impossible. Preserve
    // the threshold stimulus by shortening its blocks before dropping it.
    if (zone === 'T' && Math.floor((budget * 1000 + 1e-8) / s.repM) < 2) {
      const shorterRepM = Math.floor((budget * 1000 + 1e-8) / 2 / 100) * 100;
      if (s.reps >= 2 && shorterRepM >= 1000) {
        s.repM = Math.min(s.repM, shorterRepM);
        appendNote(s, 'Pragovske deonice skraćene radi poštovanja budžeta rada.');
      } else {
        const qKm = floorKm(Math.min(originalQKm, budget, tempoMaxSec / s.paceSec));
        if (qKm < 0.4) return false;
        Object.assign(s, {
          type: 'tempo',
          kind: 'Tempo',
          qKm
        });
        appendNote(
          s,
          'Kratak kontinuirani prag: budžet ne podržava dva puna pragovska ponavljanja.'
        );
        Reflect.deleteProperty(s, 'reps');
        Reflect.deleteProperty(s, 'repM');
        Reflect.deleteProperty(s, 'restSec');
        return true;
      }
    }
    const maxSec = zone === 'I' ? 300 : zone === 'R' ? 120 : Infinity;
    s.repM = Math.min(s.repM, Math.floor((maxSec * 1000) / s.paceSec / 100) * 100);
    if (
      (zone === 'I' || zone === 'R') &&
      s.reps >= 2 &&
      Math.floor((budget * 1000 + 1e-8) / s.repM) < 2
    ) {
      const shorterRepM = Math.floor((budget * 1000 + 1e-8) / 2 / 100) * 100;
      // I work must still last at least one minute; R retains short fully
      // recovered repetitions. Never replace aerobic intervals with strides.
      const minimumRepM = zone === 'I' ? Math.ceil((1000 / s.paceSec / 100) * 60) * 100 : 100;
      if (shorterRepM >= minimumRepM) {
        s.repM = Math.min(s.repM, shorterRepM);
        appendNote(s, 'Deonice skraćene radi poštovanja budžeta rada.');
      }
    }
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

/** Reduce quality dose while preserving the day's easy volume and the weekly denominator. */
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
          desc: `${km} km lako @ ~${Math.floor(easyPace / 60)}:${String(easyPace % 60).padStart(2, '0')}/km · Planirani trening „${day.session.kind}” odložen: nije moguće zadržati dovoljnu dozu u okviru limita ove nedelje.`
        };
        changed = true;
      } else {
        const removed = Math.max(0, totalKm - sessKm(day.session));
        if (day.session.type === 'prog') {
          const extraWu = r1(removed * 0.75);
          day.session.wuKm = r1(day.session.wuKm + extraWu);
          day.session.cdKm = r1(day.session.cdKm + removed - extraWu);
        } else day.session.cdKm = r1(day.session.cdKm + removed);
        day.km = sessKm(day.session);
        day.desc = sessDesc(day.session);
        changed ||= before !== JSON.stringify(day.session);
      }
    }
    if (!changed) break;
  }
}
