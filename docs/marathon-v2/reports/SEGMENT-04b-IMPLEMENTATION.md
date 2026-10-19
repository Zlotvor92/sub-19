# Maraton v2 — Segment 04b (marathon-v2.3.1): umor pre starta, BASE_PLATEAU, pouka 32 za sve zone

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `bd07eec` (marathon-v2.3.0). Menjano samo
`web/src/domain/generators/marathon/v2/**` i `docs/marathon-v2/**`; `marathon/index.ts`, maraton v1, lični plan i
aplikacija nepromenjeni. Dva STANI (sudari 1–4), odluke organizatora primenjene doslovno.

## Odluke | mesto | test

| odluka                                                                                                                                                                                                                                                                                                                                                                                                                                                    | mesto                                                                                                                                                                                                                                       | test                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Pouka 32 za sve zone: plafon zone = min(M11; doza čiji dan WU + rad + oporavci + CD, džog metrima sporim E, ≤ dugi iste nedelje); dugi = dužina dugog sa tim danom (A4: posle bola), bez izvodljivih dužina najduži dozvoljen dugi; izgradnja Q1 uz Q2 najnižeg nivoa, Q2 uz izabran Q1; rasterećenje, 'one' (A9), taper (MP ≥ 2 × 3000, M7a). M11 odlučuje izvodljivost na dozi po pravilu. mpFitsLong i MP naknadna provera uklonjeni (jedna semantika) | quality.ts fitsDay, pickSlot, reduced, pickDeload, taperDoses, pickTaper; week.ts dayLimitContext, buildDayLimit, oneDayLimit, deloadDayLimit, taperDayLimit, taperWeekLimit; workouts.ts qualityDaySec; lengths.ts deloadTop10, taperTop10 | dayCap.node (12), quality.node           |
| Pad doze = izuzetak „doza ne opada" (drop + napomena + DOSE_DROPPED; rasterećenje/taper: „… umesto … (pouka 32)"); najniži nivo izuzet → LONG_SHORTER_THAN_QUALITY (izgradnja i rasterećenje)                                                                                                                                                                                                                                                             | week.ts, validate.ts (QUALITY_OVER_LONG, DOSE_*, SLOT_REPEAT, START_LEVEL, BASE_PLATEAU, DELOAD_CONTENT, ONE_QUALITY, TAPER_QUALITY čitaju istu funkciju)                                                                                   | dayCap.node, grid invarijanta „pouka 32" |
| Sudar 1+3 (odluka (a1)): ponavljanje doze je upozorenje IDENTICAL_WEEKS samo kad nijedna druga struktura iste doze i sledeći nivo ne staju u plafon zone (oba člana); napomena po HM tekstu                                                                                                                                                                                                                                                               | validate.ts IDENTICAL_WEEKS; week.ts repeatNote                                                                                                                                                                                             | dayCap.node (2 pozitivna, 2 negativna)   |
| N1 (pouka 34): umor sa asOf < start → ned 1 prinudno rasterećenje 0,8 × planirane ned 1; referenca = ned 1 generatora (korak.preStart: cilj, dugi, T doza); ned 2 = planirana ned 1 (i doza); dugi reference = nedelja 0 M13a                                                                                                                                                                                                                             | assess.ts preStartRef (jedino mesto); steps.ts preStartOf, jumpRecentKm; volume.ts adaptVolume/enterWeek; generate.ts; validate.ts; adaptInvariants.ts                                                                                      | preStart.node (20)                       |
| RECENT_LONG_TOO_SHORT samo kad isti plan bez recentLongRunKm ne zastaje na toj ni ranijoj nedelji                                                                                                                                                                                                                                                                                                                                                         | generate.ts                                                                                                                                                                                                                                 | recent.node (r ≤ 8)                      |
| N2: validator (ne konstruktor) — BASE_PLATEAU poredi sa poslednjom nedeljom sa T slotom, i preko nedelje testa                                                                                                                                                                                                                                                                                                                                            | validate.ts (prevT)                                                                                                                                                                                                                         | preStart.node N2                         |

DECISIONS: M11, M7a, M12, A5; verzija `marathon-v2.3.1`. Svih 29 novih testova (dayCap, preStart) pada na bd07eec.

## Merenje pre (bd07eec) → posle (`artifacts/segment-04b/`: measure.ts, compare.ts, compare-result.json)

Dani kvaliteta iznad najnižeg nivoa duži od dugog (nedelje; adaptacija: budući dani posle asOf):

| mreža                  | K1               | izgradnja  | rasterećenje | taper      | najniži posle (izgr./rast./taper) | promenjeno (svi „pre dan > dugi" ili izuzetak) |
| ---------------------- | ---------------- | ---------- | ------------ | ---------- | --------------------------------- | ---------------------------------------------- |
| 02 (21 840)            | 0 → 0            | 0 → 0      | 0 → 0        | 9618 → 0   | 0 / 0 / 15 384                    | 9618                                           |
| M13a (35 910)          | 930 → 930 (RLTS) | 14 937 → 0 | 2175 → 0     | 13 800 → 0 | 10 242 / 2133 / 29 031            | 14 496                                         |
| gusta ned 1 (156 954)  | 0 → 0            | 105 → 0    | 55 → 0       | 35 176 → 0 | 0 / 0 / 102 118                   | 34 933                                         |
| po osećaju (8190)      | 0 → 0            | 0          | 0            | 3156 → 0   | 0 / 0 / 6966                      | 3156                                           |
| početnik (1890)        | 0 → 0            | 0          | 0            | 0          | 0 / 27 / 54                       | 27 (upozorenje rasterećenja)                   |
| 04 (6236)              | 0 → 0            | → 0        | → 0          | → 0        | 169 / 76 / 2774                   | 843                                            |
| rana (45 101)          | 0 → 0            | → 0        | → 0          | → 0        | 2678 / 1093 / 29 789              | 16 338 (5 izuzetak)                            |
| rana pre starta (4050) | 810 → 0          | → 0        | → 0          | → 0        | 464 / 168 / 2967                  | 2018                                           |
| široka (267 927)       | 1358 → 0         | → 0        | → 0          | → 0        | 31 704 / 7922 / 190 100           | 100 973 (6 izuzetak)                           |

- Najduža razlika najnižeg nivoa: 02 25,9 min, M13a 41,9 min (taper MP 2 × 3000 uz kratak najduži dugi), široka 45 min.
- Pad doze (DOSE_DROPPED, planovi): 02/M13a/osećaj bez promene (342/576/183) — u izgradnji drugi član najčešće spušta
  početni nivo ili bira drugu strukturu; rasterećenje/taper napomenom.
- Široka pretraga = organizatorova (gridInputs svaki 211., osećaj 97., početnik 47., M13a 157.; 459 planova, 7 odbija
  generator M13a) × asOf start − 1/−3/−6, sreda i kraj ned 1…N−2 × svih 17 scenarija; pre: 690 WEEK_INFEASIBLE i 666
  RECENT_LONG_TOO_SHORT (umor pre starta), 2 BASE_PLATEAU (N2).

## Regresija

Generator: menja se tačno skup planova koji je na bd07eec imao dan kvaliteta duži od dugog (bilo koje zone i nedelje);
0 drugih (heš bez oznake verzije). Fikstura `segment04b.stable-bd07eec.json` (7566 planova 02/03 bez takvog dana): bazne
linije segment03*, MAR-02 i MAR-01 obaraju svaku njihovu promenu; vrh mreža 02/03 ne pada. Adaptacija: tok menjan samo ako
je pre odbijen, ako adaptiran plan ili generator ima dan duži od dugog, ili sa spiska `regression-exceptions.json` (odluka
organizatora, 11 tokova: 4 samo napomena mešovite nedelje; 6 MP naknadna provera → Q2 uz izabran Q1, A9 jedan kvalitet →
MP + T; 1 konstruisan neupisan dan mešovite nedelje, dugi 6,6 → 8,1 km); 0 drugih.

## K1–K6

| K                   | vrednost                                                                                                                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1                  | 0 na svim mrežama osim M13a 930 RECENT_LONG_TOO_SHORT (isto kao pre); adaptacija 0 (bilo 810 pre starta + 1358 široka)                                                                                                                                         |
| K2 ned 1 < obim     | 02 1638 → 1638, gusta 6081 → 6081, M13a 10 599 → 10 635; bez dugog na plafonu 0 (VOLUME_START, invarijanta mreže)                                                                                                                                              |
| K3                  | 0 (invarijanta mreža)                                                                                                                                                                                                                                          |
| K4                  | 02/osećaj/početnik 0; gusta 1 (0,1 km); M13a 708 (≤ 4,6 km) i ned 1 niža u 972 (dugi na plafonu skoka; niža doza → više km za lagane, lagan ≤ dugi); rana 125 (≤ 5,2 km), pre starta 7 (0,7 km), široka 2512 (≤ 5,7 km) — prihvatio organizator (kao HM-03b r) |
| K5                  | 0 (invarijante mreža i adaptInvariants)                                                                                                                                                                                                                        |
| K6 kval. dan > dugi | iznad najnižeg 0; najniži: tabela; LONG_SHORTER_THAN_QUALITY planova 02 0, M13a 2145 → 1830, gusta 58 → 0, početnik 0 → 27                                                                                                                                     |

## Sabotaže, testovi, komande (iz `web/`)

Sabotaže (`node scripts/sabotage.mjs ../docs/marathon-v2/artifacts/segment-04b/sabotage.json --parallel 2`): 9/9 PALO, 19,1 s zida, stanje src isto (`sabotage-result.json`): B1 drugi član samo za MP (T/I/R bez trajanja dana) (3,1 s); B2 najniži nivo zone nije izuzet od drugog člana (3,1 s); B3 validator bez iste funkcije (plafon slota samo M11) (2,4 s); B4 validator rasterećenja bez drugog člana (3,3 s); N1a umor pre starta bez reference generatora (2,6 s); N1b nedelja 2 posle umora pre starta raste (bez cilja reference) (2,3 s); N2 BASE_PLATEAU preskače T slot nedelje testa (3,7 s); B5 izuzetak IDENTICAL_WEEKS bez uslova (3) (sledeći nivo staje) (4,5 s); B6 izuzetak IDENTICAL_WEEKS bez uslova (2') (druga struktura staje) (5,5 s).

- `npx tsc -p tsconfig.domain.json --noEmit`, `-p tsconfig.oracle.json`, `npx eslint src/domain/generators/marathon/v2`,
  `npx prettier --check src/domain/generators/marathon/v2 ../docs/marathon-v2` — exit 0.
- Brz: `npx vitest run --project node src/domain/generators/marathon/v2` → 22 fajla, 266 testova, zid 57 s (MAR-04: 20 /
  233, 50,3 s). Pun: `TEST_FULL=1 …` → 42 fajla, 336 testova, exit 0, 749 s. `npm run check` → exit 0 (263 fajla, 3201 test,
  510 s).
- Trajna rana mreža: + asOf start − 1/−3/−6 × umor, bol 5/8, pauza 10, rezultat (4050 tokova u punom nivou).

## Stalni uslovi

1 jedan vlasnik: plafon zone `quality.fitsDay`/`reduced` + `week.*DayLimit`; referenca pre starta `assess.preStartRef`;
validator samo prijavljuje, bez petlji. 2 jedan plafon po zoni (dva člana iste funkcije). 3 WU/CD nedirnuti. 4 umor pre
starta i ograničenja dana ulaze u konstruktor (korak). 5 n/p. 6 `marathon-v2`/`marathon-v2.3.1`, faza iz okvira.
7 `isolation.node` zelen, bez izuzetaka. 8 invarijanta „pouka 32" u svim mrežama + adaptInvariants; 0 prekršaja.

## Preostalo

- Brz nivo maratona je blizu granice 60 s (generator ≈ 1,5 × sporiji zbog drugog člana; keš po tempu ublažava).
- MASTER (pouka 32 izuzetak ponavljanja) ažurira organizator.
