/* TEKST KOJI DOMEN VRAĆA, A POMINJE STARU ORGANIZACIJU. Poruke u domenu (`domain/day/cards`, `domain/zones`) su zamrznute: njihov oblik je vezan za
   snimljene odgovore starog frontenda (oracle testovi), pa se ne menjaju. Stari „Podešavanja → …“ putevi više ne postoje; ovde se, tek pri prikazu,
   zamenjuju stvarnim putevima kroz tab Ti. Zamena je tekstualna i namerno uska: dira samo poznate fraze. */

const PATHS: ReadonlyArray<readonly [string, string]> = [
  ['Podešavanja → Tvoje zone pulsa', 'Ti → Zone i postavke treninga'],
  ['spiska u Podešavanjima', 'spiska u Ti → Zone i postavke treninga'],
  ['Podešavanja → intervals.icu →', 'Ti → Povezani servisi → intervals.icu →']
];

/** Zamenjuje stare puteve kroz Podešavanja putevima kroz tab Ti. Tekst bez tih fraza ostaje nepromenjen. */
export function currentPaths(text: string): string {
  let out = text;
  for (const [from, to] of PATHS) out = out.split(from).join(to);
  return out;
}
