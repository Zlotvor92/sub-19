# SCORE — automatsko merilo plana (11. 11. 2026)

Skripta `score/score.ts` (iz `web/`: `node ../docs/generators-v2/perfection/score/score.ts $PWD [5K|10K|HM|MAR] [--v3 <modul>]`)
zove generator (isti pozivi kao P9/render.ts), uzima OBJEKAT plana i računa 15 pokazatelja → ocena 0–100. Bez mreže, ~1 s za 48 planova.
Izlaz: `score/out/<D>.tsv` (pokazatelji + `s_*` po pokazatelju), `score/out/SUMMARY.md`. Kod aplikacije i testovi nisu diranj.

## Pokazatelji (definicije su u komentarima koda; „rad" = segmenti rep/continuous, bez WU/CD/oporavka/koraka; test se ne računa kao rad)
a plato dugog (±0,3 km, ne-rasteretne) · b dugi ned. 1 / najduži · c nedelja najvećeg rada, pre trke (cilj 3; ≤ 8 ned: 2) ·
d poslednja ne-rasteretna pre tapera / najteža (≤ 0,85) · e taper max / najteža (≤ 0,60) i rad trkačke nedelje (6–12 min) ·
f najduži niz iste doze iste zone (±3 %, cilj ≤ 2) + parovi istih nedelja · g km u trkačkom tempu (ukupno, u dugom), nedelje sa sadržajem u dugom ·
h vrh/start, najveći skok, najveći sati · i lagan/dugi (medijana, max) · j nedelje sa laganim < 30 min · k test: postoji/nedelja/jedini kvalitet ·
l najveća doza po treningu po zoni (R, I, T, RP/MP).

## Formula (prolaz 2 — jedini dodatni, po zahtevu organizatora)
ocena = Σ w·s, s ∈ [0,1] linearno između „cilj" (1) i „loše" (0) praga; težine u tabeli `W` (zbir 100); prvi prolaz čuva `W_V1` samo za poređenje.
Dodato (fit): m najduži dugi (min/km prema zahtevu distance i nivoa) 7 · n dugi kao udeo obima u nedelji vrha (>45 % kazna, >50 % jaka) 6 ·
o vrh obima prema zahtevu (MAR 50, HM 35, 10K 25 km; srazmerno) 4 · p lagan < 30 min u > 2 nedelje + ≥ 2 kvaliteta pri 3 dana 4 ·
q rast: vrh/start > 1,4 (početnik 2,1), skok, sati po nivou (zamenjuje prethodni „rast"; težina 10).
Izbačeno iz formule: „iste nedelje" (0 na svih 48; ostaje u tabeli kao `istePar`). Smanjeno: vrh-položaj 7, monotonija 6, trkački tempo 6, sadržaj u dugom 6,
plato 4, dugi-start 2, kratak lagan 3; ostalo isto (pred-taper 6, taper 6, lagan/dugi 6, test 6, doza 6, trkačka nedelja 5).
Pragovi iz ROUND-01 § 3 / GAP § 2 i uputa organizatora; MOJE pretpostavke: udeo km u trkačkom tempu (min 4 %, MAR 3 %), „sadržaj u dugom ≥ 25 % nedelja",
10K ne-početnik dugi ≥ 75 min, MAR dugi ≥ 165 min (organizator: 2 h 45). Težine nisu podešavane prema trenerovim ocenama.

## Prosek i Spearman prema treneru (ROUND-04), pre → posle
| | naš V1 → V2 | trener | ρ V1 → V2 |
|---|---|---|---|
| 5K | 67,9 → 73,3 | 59,1 | 0,11 → 0,41 |
| 10K | 69,8 → 74,4 | 60,9 | 0,37 → 0,52 |
| HM | 76,2 → 79,7 | 62,7 | 0,26 → 0,36 |
| MAR | 78,0 → 79,6 | 59,8 | 0,21 → 0,44 |
| ukupno (48) | 73,0 → 76,8 | 60,6 | **0,24 → 0,40** |

Po trenerovim kategorijama (ρ naše ocene, 48 planova, V1 → V2): fit 0,06 → 0,22 · quality 0,08 → 0,26 · progression 0,62 → 0,56 · recovery −0,23 → −0,15 ·
specificity 0,48 → 0,59 · taper 0,45 → 0,55 · clarity −0,14 → 0,01.
Zaključak [visoka]: bolje (0,40), ali i dalje umereno; apsolutna skala precenjuje 14–20 poena. Upotrebljivo kao detektor regresija i grubi filter, ne zamena za
trenera. Napomena [srednja]: fit pokazatelji su birani NAKON što je prvi prolaz pokazao fit kao slabu tačku (po uputu organizatora), pa poboljšanje delom
prati trenerov kriterijum; n = 12 po distanci je premalo za pouzdan ρ.

## Najveća neslaganja (V2, detalji u SUMMARY.md)
- 5K p08 (mi 77,7, trener 49,5 = najlošiji): trenerov progression 2 / fit 4 — plan loše uklopljen u trkača koji skripta ne prepoznaje; MAR p06 (85,9 / 57,5): isto.
- 5K p01 (72,6 / 71 — trener rang 46), 10K p05, HM p12: mi kažnjavamo vrh-položaj, plato i sadržaj u dugom; trener te profile ocenjuje blago.

## Ograničenja (šta skripta NE može)
- Tekst, jasnoća, napomene, trkački dan (tempo po delovima, ishrana) — nema pokazatelja (clarity ρ ≈ 0).
- Smislenost za konkretnog trkača: fit je samo dugi/vrh/dani/sati; ne proverava tempo zona, lagan tempo, rezultat vs cilj, preporuku „premalo obima za distancu".
- Izbor vežbe (oblik R/I/T, oporavak, brda, fartlek) — meri se količina rada, ne zašto; recovery ρ ostaje negativan.
- Pragovi VDOT-nezavisni osim sati; I ≤ 20 min (VDOT < 40) i T ≤ 40 min (≥ 80 km/ned) nisu implementirani.
- Težine ručno zadate, ne kalibrisane; n = 12 po distanci.
