/* VEZA SA intervals.icu — šta ta veza sme. Čisto: zapis veze → odluka.

   `athleteId` + (`token` iz OAuth-a ILI stari ručno uneti `apiKey`). Nikad oba u pozivu: šalje se ono što postoji, token ima prednost.
   Dozvole (`scope`) postoje samo uz OAuth; API ključ ima pun pristup i kod njega `scope` ne postoji — pa se odsutan `scope` tumači
   kao „sme", a prisutan bez tražene reči kao „ne sme". */

export type IcuLink = Record<string, unknown>;

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

export function icuConnected(link: IcuLink | null | undefined): boolean {
  return !!(link && link['athleteId'] && (link['token'] || link['apiKey']));
}

/** Da li veza SME da čita treninge. Stari OAuth token je izdat kad je aplikacija tražila samo wellness, pa nema opseg za treninge. */
export function icuCanReadActivities(link: IcuLink | null | undefined): boolean {
  if (!icuConnected(link)) return false;
  const s = text(link?.['scope']);
  return !s || /ACTIVITY/i.test(s);
}

/** Da li veza SME da čita podešavanja (zone pulsa): token izdat pre opsega `SETTINGS:READ` dobija 403. */
export function icuCanReadSettings(link: IcuLink | null | undefined): boolean {
  if (!icuConnected(link)) return false;
  const s = text(link?.['scope']);
  return !s || /SETTINGS/i.test(s);
}

/** Šta se šalje serveru kao dokaz veze — OAuth token ako postoji, inače stari API ključ. Nikad oba. */
export function icuCredentials(
  link: IcuLink | null | undefined
): { token: string } | { apiKey: string } {
  return link?.['token'] ? { token: text(link['token']) } : { apiKey: text(link?.['apiKey']) };
}

/** ID sportiste: `i123456` ili samo cifre (isto pravilo kao server). */
export const isAthleteId = (v: string): boolean => /^i?\d+$/.test(v);
