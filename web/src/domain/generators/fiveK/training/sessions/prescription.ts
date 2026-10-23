import type { Session, SessionPurpose } from '../types';

/** Prescription classification is deliberately independent of measured-form inference. */
const PURPOSE_FOR_KIND: Readonly<Record<string, SessionPurpose>> = {
  Intervali: 'I',
  Fartlek: 'I',
  Piramida: 'I',
  Repeticije: 'R',
  Oštrina: 'R',
  Tempo: 'T',
  'Tempo (broken)': 'T',
  'Tempo isprekidan': 'T',
  Progresivno: 'T',
  'Trkački ritam': 'RP',
  'Tempo trke': 'RP',
  'Kontrolna trka': 'RP',
  'Maratonski tempo': 'M',
  'Progresivno (tempo trke)': 'M',
  Aktivacija: 'activation'
};

/** Resolve before any dose/limit operation. Explicit purpose wins over legacy metadata. */
export function resolvePrescription(s: Session): SessionPurpose {
  const purpose =
    s.purpose ??
    (s.zone && s.zone !== 'E' && s.zone !== 'LR' ? s.zone : undefined) ??
    PURPOSE_FOR_KIND[s.kind];
  if (!purpose) throw new Error(`Unknown prescription purpose: ${s.kind}`);
  s.purpose = purpose;
  s.zone = purpose === 'activation' ? 'RP' : purpose;
  s.paceSource = s.zone === 'RP' || s.zone === 'M' ? 'race-specific' : 'current-fitness';
  return purpose;
}

/** I legs must remain 60–300 seconds even after shortening. Do not grow the dose. */
export function validIntervalLeg(m: number, paceSec: number): boolean {
  const seconds = (m * paceSec) / 1000;
  return seconds >= 60 && seconds <= 300;
}
