/* ID-jevi u stanju su MAŠINSKI generisani i uvek istog oblika (n1d1, g12d3, p1, g3_1, k1751376000000,
   kt-n1d1, t3k-…): nikad ne sadrže navodnik, razmak ni znak <. To je BEZBEDNOSNA granica, ne
   kozmetika: u starom kodu ID dana je završavao u HTML atributima, pa je ID iz uvezenog backupa
   bio direktan put za ubacivanje HTML-a. U Reactu se atributi ne grade stringovima, ali ID-jevi
   ostaju ključevi mapa i delovi URL-ova/selektora, pa se granica zadržava. */

export const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidId(x: unknown): x is string {
  return typeof x === 'string' && ID_SHAPE.test(x);
}

/**
 * `String(x || '')` kao u starom kodu: `null`/`undefined`/0/'' postaju '', niz se spaja zarezom,
 * objekat postaje '[object Object]' (takav ID ionako ne prolazi `isValidId`).
 */
export function idToString(x: unknown): string {
  if (!x) return '';
  if (typeof x === 'string') return x;
  if (typeof x === 'number' || typeof x === 'boolean') return String(x);
  return Array.isArray(x) ? (x as unknown[]).join(',') : '[object Object]';
}
