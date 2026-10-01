/** Mapa tela: ključ (`koleno-L`) → ime za prikaz. Bol se beleži za celo telo. */
export const BODY_PARTS: Readonly<Record<string, string>> = {
  glava: 'Glava',
  vrat: 'Vrat',
  grudi: 'Grudi',
  trbuh: 'Trbuh',
  prepone: 'Prepone',
  'gornja-ledja': 'Gornja leđa',
  'donja-ledja': 'Donja leđa',
  'rame-L': 'Levo rame',
  'rame-D': 'Desno rame',
  'nadlaktica-L': 'Leva nadlaktica',
  'nadlaktica-D': 'Desna nadlaktica',
  'podlaktica-L': 'Leva podlaktica',
  'podlaktica-D': 'Desna podlaktica',
  'saka-L': 'Leva šaka',
  'saka-D': 'Desna šaka',
  'kuk-L': 'Levi kuk',
  'kuk-D': 'Desni kuk',
  'gluteus-L': 'Levi gluteus',
  'gluteus-D': 'Desni gluteus',
  'kvadriceps-L': 'Levi kvadriceps',
  'kvadriceps-D': 'Desni kvadriceps',
  'zadnja-loza-L': 'Leva zadnja loža',
  'zadnja-loza-D': 'Desna zadnja loža',
  'koleno-L': 'Levo koleno',
  'koleno-D': 'Desno koleno',
  'potkolenica-L': 'Leva potkolenica',
  'potkolenica-D': 'Desna potkolenica',
  'list-L': 'Levi list',
  'list-D': 'Desni list',
  'ahilova-L': 'Leva Ahilova',
  'ahilova-D': 'Desna Ahilova',
  'stopalo-L': 'Levo stopalo',
  'stopalo-D': 'Desno stopalo',
  'peta-L': 'Leva peta',
  'peta-D': 'Desna peta'
};

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Ime dela tela; nepoznat ključ se prikazuje kakav jeste, prazan kao „Opšte". */
export function partName(p: string | null | undefined): string {
  return p && hasOwn(BODY_PARTS, p) ? (BODY_PARTS[p] as string) : p ? p : 'Opšte';
}

/**
 * Delovi tela koji NOSE TRČANJE. Bol se beleži za celo telo (35 stavki, od glave do pete), ali plan
 * TRČANJA ne sme da se menja zbog svega: bol 10 u šaci ili glavi nije razlog da se trening pretvori u
 * odmor kao bol 10 u Ahilovoj. Ostali se beleže i vide, ali ne prepisuju plan.
 */
export const LOAD_BEARING_PARTS: ReadonlySet<string> = new Set([
  'donja-ledja',
  'prepone',
  'kuk-L',
  'kuk-D',
  'gluteus-L',
  'gluteus-D',
  'kvadriceps-L',
  'kvadriceps-D',
  'zadnja-loza-L',
  'zadnja-loza-D',
  'koleno-L',
  'koleno-D',
  'potkolenica-L',
  'potkolenica-D',
  'list-L',
  'list-D',
  'ahilova-L',
  'ahilova-D',
  'stopalo-L',
  'stopalo-D',
  'peta-L',
  'peta-D'
]);

/**
 * Zapisi bez `part` su iz vremena pre spiska delova tela (dnevnik je počeo kao dnevnik jednog zgloba) —
 * broje se kao nosivi, jer to i jesu bili.
 */
export const isLoadBearing = (part: string | null | undefined): boolean =>
  !part || LOAD_BEARING_PARTS.has(part);
