/* Računica sesije: kilometraža i opis se UVEK izvode iz `session` objekta
   (nikad se ne peku unapred), da kartica dana, opis i nedeljni zbir ne mogu
   da se razilaze. */

import { fmtClock, r1 } from '../../format';
import type { FartlekSession, IntervalSession, Session } from '../types';

/** Kod pragovskih i race-pace formata pauza je LAGANO TRČANJE (napor ostaje
 *  neprekidan), kod I/R formata je hod. Spisak je izričit, ne obrazac: širok
 *  regex je zahvatao i „Trkački ritam" (10K) i tiho menjao potvrđene planove. */
export const RECOVERY_JOG: readonly string[] = ['Tempo isprekidan', 'Tempo trke', 'Kontrolna trka'];

/** Pauza: tačan minut kao minut, ispod 90 s u sekundama, ostalo `m:ss min`. */
export function fmtRest(sec: number): string {
  if (sec % 60 === 0 && sec >= 60) return `${Math.round(sec / 60)} min`;
  if (sec < 90) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')} min`;
}

/** Pređeno u pauzama između ponavljanja: džog (~35% sporiji od tempa deonice) ili 150 m hoda. */
export function kmBetweenReps(s: IntervalSession): number {
  const n = Math.max((s.reps | 0) - 1, 0);
  if (!n) return 0;
  if (RECOVERY_JOG.includes(s.kind) && s.restSec > 0 && s.paceSec > 0) {
    return (n * s.restSec) / (s.paceSec * 1.35);
  }
  return n * 0.15;
}

export function sessKm(s: Session): number {
  switch (s.type) {
    case 'int':
      return r1(s.wuKm + (s.reps * s.repM) / 1000 + s.cdKm + kmBetweenReps(s));
    case 'pyramid':
      return r1(
        s.wuKm + s.reps.reduce((a, b) => a + b, 0) / 1000 + s.cdKm + (s.reps.length - 1) * 0.15
      );
    case 'fartlek':
      return r1(s.wuKm + s.cdKm + fartlekKm(s));
    case 'prog':
      return r1(s.qKm);
    case 'tempo':
      return r1(s.wuKm + s.qKm + s.cdKm);
  }
}

const fartlekKm = (s: FartlekSession): number =>
  s.reps * (s.repSec / s.paceSec + s.restSec / s.easyPaceSec);

export function sessDesc(s: Session): string {
  const text = sessionSummary(s);
  return s.notes ? `${text} · ${s.notes}` : text;
}

function sessionSummary(s: Session): string {
  switch (s.type) {
    case 'int': {
      const restWord = RECOVERY_JOG.includes(s.kind) ? 'laganog trčanja' : 'hoda';
      return `${s.kind} — ${s.wuKm} km zagrevanje + ${s.reps}×${s.repM} m @ ${fmtClock(s.paceSec)}/km (${fmtRest(s.restSec)} ${restWord}) + ${s.cdKm} km hlađenje`;
    }
    case 'pyramid':
      return `${s.kind} — ${s.wuKm} km zagrevanje + ${s.reps.join('-')} m @ ${fmtClock(s.paceSec)}/km (${fmtRest(s.restSec)} hoda između ponavljanja) + ${s.cdKm} km hlađenje`;
    case 'fartlek':
      return `Fartlek — ${s.wuKm} km zagrevanje + ${s.reps}×${s.repSec} s brzo @ ~${fmtClock(s.paceSec)}/km (${s.restSec} s laganog trčanja) + ${s.cdKm} km hlađenje`;
    case 'prog':
      return `Progresivno — ${s.qKm} km: prve dve trećine @ ~${fmtClock(s.easyPaceSec)}/km → poslednja trećina @ ${fmtClock(s.paceSec)}/km`;
    case 'tempo':
      return `${s.kind || 'Tempo'} — ${s.wuKm} km zagrevanje + ${s.qKm} km @ ${fmtClock(s.paceSec)}/km + ${s.cdKm} km hlađenje`;
  }
}

/** Radni kilometri sesije (bez zagrevanja i smirivanja) — za predikciju i lap-detekciju. */
export function sessQKm(s: Session): number {
  switch (s.type) {
    case 'int':
      return r1((s.reps * s.repM) / 1000);
    case 'pyramid':
      return r1(s.reps.reduce((a, b) => a + b, 0) / 1000);
    case 'fartlek':
      return r1((s.reps * s.repSec) / s.paceSec);
    case 'prog':
      return r1(s.qKm / 3); // T deo = poslednja trećina
    case 'tempo':
      return s.qKm;
  }
}
