# HM v2 — Segment 03b: pouka 32 za sve zone (hm-v2.2.1, HM-04 korak A)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `5e09a02` (hm-v2.2.0). Menjano samo
`halfMarathon/v2/**` i `docs/hm-v2/**`; HM v1, `halfMarathon/index.ts`, lični plan, aplikacija i druge distance netaknuti.

## Odluka | mesto | test (DECISIONS HI15)

| odluka                                                                                                                                                                                      | mesto                                                                                                                                 | test                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Plafon zone = jedna funkcija, dva člana: H11 udeo i najveća doza čiji dan (WU + rad + oporavci + CD; džog zadat metrima sporim E) traje ≤ dugi iste nedelje; izgradnja, rasterećenje, taper | `quality.ts` pickSlot, fitsDay, reducedStructure; `week.ts` buildDayLimit, deloadDayLimit, taperDayLimit; `workouts.ts` qualityDaySec | `dayCap.node` (6 planova + predikat)      |
| H11 odlučuje izvodljivost kao pre (doza po pravilu); drugi član spušta po lestvici — izuzetak od „doza ne opada" (pouka 12; drop + napomena „pouka 32, plafon zone" + DOSE_DROPPED)         | isto; validator DOSE_DROP (najviši nivo u oba člana), DOSE_STALL, SLOT_REPEAT, BASE_PLATEAU, DELOAD_CONTENT, TAPER_QUALITY            | `validate.node` (pouka 32), `dayCap.node` |
| Najniži nivo zone izuzet (sopstveni dan); upozorenje LONG_SHORTER_THAN_QUALITY u izgradnji i rasterećenju                                                                                   | `fitsDay`, `validate.ts` QUALITY_OVER_LONG (greška iznad najnižeg), HI3                                                               | `dayCap.node`, `beginner.node`            |
| Dva dana: Q1 uz Q2 najniže doze u strukturi sa najviše km, Q2 uz izabran Q1; taper RP uz T 2,0 km, pa T                                                                                     | `buildDayLimit`, `taperDayLimit`                                                                                                      | `dayCap.node` (predikat), sabotaže A3/A4  |
| Nedelja testa: dugi rasterećenja naviše do trajanja testa u granicama (udeo, vreme, 24 km, pouka 28, lagani ≥ 4 km)                                                                         | `lengths.ts` deloadLengths (`minLong10`), longFor10                                                                                   | `dayCap.node` (jedinični)                 |

Na 5e09a02 `dayCap.node` pada 7/7 (dani iznad najnižeg nivoa duži od dugog; nema pada doze; nema podizanja dugog).

## Merenje pre/posle (`measure-32.ts`, `k-metrics.ts`, `compare-32.ts`; zbirovi u `artifacts/segment-03b/`)

Dani kvaliteta duži od dugog (nedelje), pre → posle. „Iznad" = iznad najnižeg nivoa zone (posle mora biti 0):

| mreža (planova)       | izgradnja iznad | rasterećenje iznad | taper iznad | najniži: izgr. / rast. / taper (posle) | test (izgr. / rast.) |
| --------------------- | --------------- | ------------------ | ----------- | -------------------------------------- | -------------------- |
| 02 (16 896)           | 822 → 0         | 72 → 0             | 1710 → 0    | 678 / 192 / 1668                       | —                    |
| r (10 944)            | 5979 → 0        | 655 → 0            | 2363 → 0    | 4056 / 811 / 1968                      | —                    |
| gusta ned 1 (141 804) | 11 941 → 0      | 1024 → 0           | 24 678 → 0  | 9938 / 1472 / 16 787                   | —                    |
| po osećaju (6336)     | 162 → 0         | 3 → 0              | 225 → 0     | 132 / 27 / 336                         | 18 / 42 (isto)       |
| početnik (1890)       | 0               | 0                  | 0           | 0 / 126 / 54                           | —                    |

- Pad doze zbog trajanja (izgradnja): 02 66 nedelja, r 742; rasterećenje/taper ispod ≈ 60 %: 02 1590, r 2028, osećaj 231.
- Najduža razlika najnižeg nivoa: taper r 35,2 min (RP 2 × 2000 m uz dugi ≤ 0,6 × najduži), izgradnja ned 1 gusta 24,0 min.
- Uzrok kratkog dugog uz najniži nivo (gusta, posle): lagani ≥ 4 km 19 766, pouka 28 6496, rasterećenje 1472, taper 463.
- Test: dugi naviše nije izvodljiv ni u jednoj od 42 nedelje rasterećenja sa testom (dugi već skraćen HI14 ili na
  udelu) — upozorenje ostaje; 18 testova u izgradnji (dugi već na plafonu) — upozorenje.
- Nedelja 1 × pouka 9: drugi član menja dozu, ne cilj — 0 odbijanja, 0 izuzetaka „upozorenje umesto pravila".
  Nedelja 1 najnižeg nivoa duža od dugog: 02 264, r 1563, osećaj 66 (izuzetak najnižeg nivoa, ≤ 24 min).
- Upozorenje pouke 14 (planova, k-metrics): 02 132 → 132, r 903 → 834, osećaj 33 → 69, početnik 0 → 126. Taper bez
  upozorenja (H7: dugi ≤ 0,6 × najduži, RP ≥ 2 × 2000 m; preporuka manje dana ne menja odnos) — inače 11 423 plana
  guste mreže.

## K1–K6 (pre → posle; `k-metrics-5e09a02.json`, `k-metrics-hm-v2.2.1.json`)

| mreža       | K1                                    | K2 ukupno / bez plafona | K3  | K4 vrh niži              | K5      | K6 ponavljanja / kval. > dugi (izgr., planova) / CAPACITY_LIMITED / vrh:start |
| ----------- | ------------------------------------- | ----------------------- | --- | ------------------------ | ------- | ----------------------------------------------------------------------------- |
| 02          | 0 → 0                                 | 396 / 0 → 396 / 0       | 0   | 0                        | 0/0/0/0 | 0 / 132 → 132 (sve najniži) / 1890 → 1890 / 1,320                             |
| r           | 39 → 39 (RECENT_LONG_TOO_SHORT ned 1) | 2265 / 0 → 2289 / 0     | 0   | **259** (najviše 3,8 km) | 0/0/0/0 | 0 / 903 → 834 / 3170 → 3194 / 1,293 → 1,292                                   |
| osećaj      | 0 → 0                                 | 297 / 0 → 297 / 0       | 0   | 0                        | 0/0/0/0 | 0 → 3 / 33 → 33 / 1101 / 1,312                                                |
| početnik    | 0 → 0                                 | 0                       | 0   | 0                        | 0/0/0/0 | 0 / 0 / 18 / 1,387                                                            |
| gusta ned 1 | 0 → 0                                 | (measure-32)            |     |                          |         |                                                                               |

K4 (mreža r): niža doza ostavlja više km za lagane; kad je dugi na granici pouke 28 (r 5–12 km, uglavnom 5–6 d, VDOT
45–70), lagani bi bili duži od dugog (pouka 2) → nedelja na najbliži izvodljiv cilj (H6, isti mehanizam kao H11).
Ciljevi promenjeni u 1278 planova r (6024 nedelje, najviše 3,8 km; ned 1: 384, od toga 24 nova ispod obima, svi sa
dugim na apsolutnom plafonu), 02: 618 nedelja ≤ 0,3 km, osećaj 21 ≤ 0,6 km; vrh ne pada u 02/03 (`volume-diff.ts`).
Primer: `r-d6-10w-75km-v70-r9` ned 1 67,3 → 63,7 km, vrh 91,3 → 87,5 km. **Otvoreno pitanje za organizatora.**

## Regresija (heš rezultata bez oznake verzije; `compare-32-result.json`)

Menja se tačno skup planova koji je na 5e09a02 imao bar jednu nedelju sa danom kvaliteta ili testa dužim od dugog:
02 1932 / 16 896, r 2518 / 10 944, gusta 21 102 / 141 804, osećaj 291 / 6336, početnik 177 / 1890 — svaki promenjen, 0
drugih, 0 novih odbijanja. Testovi: fikstura `segment03b.over-long-5e09a02.json` (4918 planova 02, r, 03); bazne
linije 02/03 i HM-02 heševi r ostaju — `grid`, `feelGrid`, `beginnerGrid`, `recent` obaraju svaku drugu promenu i pad
vrha u 02/03.

## Sabotaže (`node scripts/sabotage.mjs ../docs/hm-v2/artifacts/segment-03b/sabotage.json --parallel 2`): 6/6, 8,3 s

A1 plafon bez člana trajanja (1,7 s); A2 rasterećenje/taper bez člana (1,2); A3 Q1 uz Q2 osnovne strukture (1,2);
A4 izuzeće preskače drugi dan (1,2); A5 dugi testa se ne podiže (1,3); A6 validator bez provere najvišeg nivoa (1,6).

## Komande (iz `web/`)

`npx tsc -p tsconfig.domain.json --noEmit` 0, `tsconfig.oracle.json` 0, `npx eslint src/domain/generators/halfMarathon/v2`
0, `npx prettier --check src/domain/generators/halfMarathon/v2 ../docs/hm-v2` 0. HM v2 brz nivo: 18 fajlova, 158 testova,
23,8 s zida; pun (`TEST_FULL=1`): 30 fajlova, 193 testa, 190 s. `npm run check`: exit 0 — 253 test fajla, 3074 testa (6 min 45 s).
Odstupanje: `recent.node` skok dugog ned 1 → 2 sada prema max(dugi ned 1, skorašnji najduži) (6 d 40 km VDOT 70 r 7:
6,7 → 8,0 km je po pravilu pouke 28, a × 1,19 prema ned 1); `beginner.node` HI14: ned 5 dobija i
LONG_SHORTER_THAN_QUALITY (T 1,5 km 32′ > dugi 25′, najniži nivo).

## Primer `d6-13w-40km-v70-A-sat` (6 d, 40 km, VDOT 70; pre → posle)

Ned 2–3: R 8 × 200 / 6 × 300 i T 2,5 / 3,0 km (43–46′, dugi 32–36′) → najniži nivo druge strukture (R 4 × 300 / 3 × 400,
T 2 × 1000 / 2,0 km; 41–42′, izuzetak + upozorenje); ned 8 RP 2 × 2500 (53′) → 2 × 2000 (49′ ≤ dugi 52′); ned 11 RP
2 × 4000 (63′) → 2 × 3000 (56′), dugi 13,1 → 15,2 km (više km za dugi); taper dugi 8,4 → 9,1 km. Tabela:
`artifacts/segment-03b/plans.md`.
