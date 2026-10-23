import type { Session, SessionDay } from '../types';
import { sessDesc, sessKm, sessQKm } from './calc';

/** Keep a previously introduced stimulus, at most 60% of its work, without speeding up. */
export function reducedQualityForDeload(previous: SessionDay, dow: number): SessionDay | null {
  const session: Session = { ...previous.session, overrides: { ...previous.session.overrides } };
  const previousWork = sessQKm(session);
  session.wuKm = Math.max(1, Math.round(session.wuKm * 7) / 10);
  session.cdKm = Math.max(0.8, Math.round(session.cdKm * 7) / 10);
  if (session.type === 'int' || session.type === 'fartlek') {
    session.reps = Math.floor(session.reps * 0.6);
    if (session.reps < 2) return null;
  } else if (session.type === 'pyramid') {
    session.reps = session.reps
      .map((m) => Math.floor((m * 0.6) / 100) * 100)
      .filter((m) => m >= 100);
    if (session.reps.length < 2) return null;
  } else {
    session.qKm = Math.floor(session.qKm * 6) / 10;
  }
  if (sessQKm(session) < 0.4 || sessQKm(session) > previousWork * 0.6 + 0.01) return null;
  session.notes = 'Rasterećenje: smanjena doza poslednjeg kvalitetnog treninga, bez ubrzavanja.';
  return { dow, tag: previous.tag, session, km: sessKm(session), desc: sessDesc(session) };
}
