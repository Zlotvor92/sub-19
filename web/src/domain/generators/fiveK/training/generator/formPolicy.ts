import { fmtClock } from '../../format';
import type { AthleteAssessment, FormPolicy, Session } from '../types';

/* Istorijska referenca brzine (stari PB, pauza) nije potvrđena trenutna spremnost. Dok se forma ne
   potvrdi merenjem, napor vodi trening, a ritam iz reference je samo orijentir. Ovo su proizvodna
   pravila, ne fiziološki pragovi niti medicinska procena. */

/** Uslovi za uvođenje zahtevnijeg rada kad forma nije potvrđena. Proverava ih `qualityEntryGate`. */
export const QUALITY_ENTRY_CONDITIONS: readonly string[] = [
  'poslednje dve pune nedelje imaju upisano trčanje, bar 75% planiranih kilometara, bez zapisa bola 4/10 ili jačeg',
  'u poslednje dve nedelje najviše jedan lak trening prijavljen sa naporom 7/10 ili većim',
  'tempa potvrdi novim rezultatom ili kontrolisanim testom (najviše 90 dana starim); do tada napor vodi, ritam je orijentir'
];

export const EASY_EFFORT_NOTE =
  'napor 3–4/10 (razgovorno); ritam je gornja granica iz starog rezultata, uspori ako je napor veći';

/** `null` kad se istorijska referenca sme koristiti kao tekuća forma. Nedatiran rezultat ostaje nepoznat, ne zastareo. */
export function formPolicyFor(athlete: AthleteAssessment): FormPolicy | null {
  if (athlete.speedConfidence === 'returning')
    return {
      basis: 'effort-first',
      reason: `Posle pauze od ${athlete.breakWeeks} nedelja rezultat je istorijska referenca, ne potvrđena trenutna forma.`,
      entryConditions: [...QUALITY_ENTRY_CONDITIONS]
    };
  if (athlete.speedConfidence === 'stale-result')
    return {
      basis: 'effort-first',
      reason: `Rezultat je star ${athlete.resultAgeDays ?? '90+'} dana: istorijska referenca, ne potvrđena trenutna forma.`,
      entryConditions: [...QUALITY_ENTRY_CONDITIONS]
    };
  return null;
}

const QUALITY_RPE: Readonly<Record<string, string>> = {
  T: '7/10 (prijatno teško, kratke rečenice)',
  I: '8/10 (teško, uz rezervu od 1–2 ponavljanja)',
  R: '6–7/10 (brzo i opušteno, bez sprinta)'
};

/** Kratka instrukcija po naporu za zahtevan trening čiji ritam potiče iz neproverene reference. */
export function referenceQualityNote(session: Pick<Session, 'paceSec' | 'zone'>): string {
  const rpe = QUALITY_RPE[session.zone ?? 'T'] ?? '6–7/10';
  return `Forma nije potvrđena: vodi se naporom ${rpe}. Ritam ~${fmtClock(session.paceSec)}/km je referenca iz starog rezultata, ne zahtev`;
}

export const QUALITY_ENTRY_NOTE = `Uvodi se tek kad: ${QUALITY_ENTRY_CONDITIONS.map((c, i) => `${i + 1}) ${c}`).join('; ')}`;

/** Napomene koje je izdao `referenceQualityNote`/`QUALITY_ENTRY_NOTE`; prepoznaju se po početku. */
export const isReferenceNote = (note: string): boolean =>
  note.startsWith('Forma nije potvrđena: vodi se naporom') || note.startsWith('Uvodi se tek kad: ');
