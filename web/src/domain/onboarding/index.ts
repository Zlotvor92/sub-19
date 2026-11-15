/* ČAROBNJAK ZA PLAN (onboarding): stanje prvog koraka (distanca i datum trke) — bez DOM-a. Ekran (`features/onboarding`)
   samo crta. V1b: ostali koraci su koraci generatora v2 ciljne distance (`./fiveKV2.ts`, `./tenKV2.ts`, `./hmV2.ts`,
   `./marathonV2.ts`); koraci, pregled i upozorenja starog (v1) čarobnjaka su obrisani zajedno sa v1 generatorima. */

export const TOTAL_STEPS = 4;

export interface WizardState {
  raceDist: number;
  raceDate: string;
}

export const initialWizard = (): WizardState => ({ raceDist: 5000, raceDate: '' });

/** Samo cifre, najviše `n` (polja za vreme). */
export const clampDigits = (v: string, n: number): string =>
  String(v).replace(/\D/g, '').slice(0, n);
