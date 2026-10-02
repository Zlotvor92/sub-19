/* SCENARIJI GOLDEN MASTER-A GENERATORA (2 304 ulaza) — ista matrica kao u starom `test/otisak-generatora.mjs`, prenesena doslovno.

   Fixture `fixtures/otisak-generatora.json` je uzet nad STARIM generatorom (APP_VERSION 282); novi generator mora dati isti SHA-256 po scenariju.
   Posle NAMERNE izmene generatora otisak se osvežava iz NOVOG koda: `UPDATE_FINGERPRINT=1 npx vitest run --project node generator.fingerprint`, a razlika
   ide u commit zajedno sa unosom u docs/ENGINE_CHANGES.md. */

export interface Scenario {
  ime: string;
  inp: Record<string, unknown>;
}

const POCETAK = '2026-01-05';
const DIST: Record<string, number> = { '5K': 5000, '10K': 10000, HM: 21097.5, Maraton: 42195 };
/* najmanji broj nedelja po distanci — ispod toga generator legitimno odbija */
const MIN_NED: Record<number, number> = { 5000: 6, 10000: 8, 21097.5: 10, 42195: 12 };
/* PB koji odgovara distanci — inače bi Riegel na maratonu davao besmislice i pola matrice bi bila „ista greška". */
const PB: Record<number, { distM: number; sec: number }> = {
  5000: { distM: 5000, sec: 1237 },
  10000: { distM: 10000, sec: 2580 },
  21097.5: { distM: 21097.5, sec: 5700 },
  42195: { distM: 42195, sec: 12000 }
};

function datumPosle(nedelja: number): string {
  const d = new Date(POCETAK + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + nedelja * 7);
  return d.toISOString().slice(0, 10);
}

/* Obim ne ide po proizvoljnim tačkama: mreža mora da prođe i kroz pojas 32–50 km/ned (gde veže `CILJ_OBIM_5K`) i kroz niske obime gde vežu apsolutni podovi
   — otisak koji ne pokriva mesto gde konstanta radi ne čuva ništa (provereno mutacijom). */
export function scenariji(): Scenario[] {
  const out: Scenario[] = [];
  for (const [ime, distM] of Object.entries(DIST)) {
    const min = MIN_NED[distM] as number;
    for (const nedelja of [min, min + 6, min + 14]) {
      for (const runDays of [3, 4, 5, 6]) {
        for (const weeklyKm of [12, 22, 30, 36, 45, 55, 70, 85]) {
          for (const intensity of ['kons', 'std', 'agr']) {
            for (const trainedRecently of [true, false]) {
              out.push({
                ime: `${ime} · ${runDays}d · ${weeklyKm}km · ${intensity} · ${trainedRecently ? 'trenirao' : 'pocetnik'} · ${nedelja}n`,
                inp: {
                  startDate: POCETAK,
                  raceDate: datumPosle(nedelja),
                  raceDistM: distM,
                  pb: PB[distM],
                  weeklyKm,
                  runDays,
                  quality: 2,
                  intensity,
                  trainedRecently
                }
              });
            }
          }
        }
      }
    }
  }
  return out;
}
