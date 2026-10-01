import type { Zone } from '../types';

/**
 * Naziv sesije → Danielsova zona, za ISPRAVNO računanje VDOT-a iz ostvarenog
 * tempa kvalitetne sesije. Tempo/interval sesije se trče submaksimalno
 * (T ≈ 88% VO2max, ne trka), pa Riegel (koji pretpostavlja maksimalan napor)
 * sistematski potcenjuje VDOT baš na njima.
 *
 * NAMERNO NEMA ZONU: `Kontrolna trka` — korisnik je može istrčati kao pravu
 * trku ili kontrolisano, plan ne zna šta je izabrao; putanja „trka na toj
 * distanci" je za nju bezbednija nego prag (koji bi pravu trku precenio).
 *
 * `Trkački ritam` → I (tačno za 5K, za 10K blago POTCENJUJE VDOT — bezbedan
 * smer greške). `Tempo trke` → T (isto: greška potcenjuje).
 */
export const ZONE_FOR_KIND: Readonly<Record<string, Zone>> = {
  Intervali: 'I',
  Fartlek: 'I',
  Piramida: 'I',
  Repeticije: 'R',
  Tempo: 'T',
  'Tempo (broken)': 'T',
  Progresivno: 'T',
  'Tempo isprekidan': 'T',
  'Trkački ritam': 'I',
  'Tempo trke': 'T',
  'Progresivno (tempo trke)': 'M',
  'Maratonski tempo': 'M'
};

/**
 * Sesije čiji je propis izveden iz CILJA (`racePace`), ne iz forme te nedelje.
 * Inverz tempa maratona nad ciljnim tempom vraća tačno `vdotGoal` — pa ih
 * čitati unazad kao merenje daje cirkularnost. Tempo se čuva i prikazuje; samo
 * ne ulazi u lanac forme.
 */
export const KIND_FROM_GOAL: ReadonlySet<string> = new Set([
  'Trkački ritam',
  'Tempo trke',
  'Progresivno (tempo trke)',
  'Maratonski tempo'
]);
