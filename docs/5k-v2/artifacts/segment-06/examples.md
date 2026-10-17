# 5K v2 — primeri adaptacije (5k-v2.5.0)

Generisano: `node docs/5k-v2/artifacts/segment-06/run.ts`. Činjenice: `inputs.json`; reasons/changes:
`<plan>-<scenario>.json`. Kolone „posle": faza ((r) = rasterećenje, T = test), cilj / planirano km,
kvalitet, dugi km. `*` = nedelja promenjena; (asOf) = nedelja koja sadrži asOf.

## dev-04 — VDOT ~50 (5K 19:57), 35 km, 4 dana, 14 ned, cilj 19:30

### dev-04 / bez-promena (asOf 2026-12-20)

Tempo: vdot → vdot; VDOT 50 → 50; prognoza 19:56 → 19:56; cilj ambitious → ambitious; promena: 0.

Reasons:
- — (nijedan uslov nije aktivan)

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 35 | R + T_short | 12.2 | base | 35 / 35 | R + T_short | 12.2 |
| 2 | base | 37.8 | R + T_short | 13.2 | base | 37.8 / 37.8 | R + T_short | 13.2 |
| 3 | base | 40.8 | R + T_short | 14.2 | base | 40.8 / 40.8 | R + T_short | 14.2 |
| 4 | base (r) | 32.6 | R | 11.4 | base (r) | 32.6 / 32.6 | R | 11.4 |
| 5 | base | 44 | R + T_short | 15.4 | base | 44 / 44 | R + T_short | 15.4 |
| 6 | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 7 (asOf) | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 8 | peak (r) | 36.4 | I | 12.7 | peak (r) | 36.4 / 36.4 | I | 12.7 |
| 9 | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 10 | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 45.5 / 45.5 | RP + R_sharpen | 15.5 |
| 11 | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 45.5 / 45.5 | RP + R_sharpen | 15.5 |
| 12 | taper | 38.7 | RP + T_short | 13.5 | taper | 38.7 / 38.7 | RP + T_short | 13.5 |
| 13 | taper | 31.9 | RP | 11.1 | taper | 31.9 / 31.9 | RP | 11.1 |
| 14 | race | 19.49 | RP_sharpener | — | race | 19.49 / 19.49 | RP_sharpener | — |

Changes po nedelji: —.

### dev-04 / propustena-nedelja (asOf 2026-12-20)

Tempo: vdot → vdot; VDOT 50 → 50; prognoza 19:56 → 19:56; cilj ambitious → ambitious; promena: 33.

Reasons:
- PAUSE: Pauza 8 dana (obim 7 dana pre pauze 45.5 km): cilj 36.4 km; prva nedelja 1 kvalitet.
- UNDER_EXECUTION (nije primenjeno): Izvršeno 0 od 45.5 km u 7 dana (< 60%): nadjačano ili nema sledeće nedelje izgradnje.

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 35 | R + T_short | 12.2 | base | 35 / 35 | R + T_short | 12.2 |
| 2 | base | 37.8 | R + T_short | 13.2 | base | 37.8 / 37.8 | R + T_short | 13.2 |
| 3 | base | 40.8 | R + T_short | 14.2 | base | 40.8 / 40.8 | R + T_short | 14.2 |
| 4 | base (r) | 32.6 | R | 11.4 | base (r) | 32.6 / 32.6 | R | 11.4 |
| 5 | base | 44 | R + T_short | 15.4 | base | 44 / 44 | R + T_short | 15.4 |
| 6 | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 7 (asOf) | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 8* | peak (r) | 36.4 | I | 12.7 | peak (r) | 36.4 / 36.4 | I | 12.7 |
| 9* | peak | 45.5 | I + T_cruise | 15.5 | peak | 39.3 / 39.3 | I + T_cruise | 13.7 |
| 10* | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 39.3 / 39.3 | RP + R_sharpen | 13.7 |
| 11* | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 39.3 / 39.3 | RP + R_sharpen | 13.7 |
| 12* | taper | 38.7 | RP + T_short | 13.5 | taper | 33.4 / 33.4 | RP + T_short | 11.6 |
| 13* | taper | 31.9 | RP | 11.1 | taper | 27.5 / 27.5 | RP | 9.6 |
| 14* | race | 19.49 | RP_sharpener | — | race | 17.56 / 17.56 | RP_sharpener | — |

Changes po nedelji: 9: 6, 10: 6, 11: 6, 12: 5, 13: 5, 14: 5.

### dev-04 / pauza-10 (asOf 2026-12-20)

Tempo: vdot → vdot; VDOT 50 → 50; prognoza 19:56 → 19:56; cilj ambitious → ambitious; promena: 33.

Reasons:
- PAUSE: Pauza 11 dana (obim 7 dana pre pauze 47.4 km): cilj 36.4 km; prva nedelja 1 kvalitet.
- UNDER_EXECUTION (nije primenjeno): Izvršeno 0 od 45.5 km u 7 dana (< 60%): nadjačano ili nema sledeće nedelje izgradnje.

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 35 | R + T_short | 12.2 | base | 35 / 35 | R + T_short | 12.2 |
| 2 | base | 37.8 | R + T_short | 13.2 | base | 37.8 / 37.8 | R + T_short | 13.2 |
| 3 | base | 40.8 | R + T_short | 14.2 | base | 40.8 / 40.8 | R + T_short | 14.2 |
| 4 | base (r) | 32.6 | R | 11.4 | base (r) | 32.6 / 32.6 | R | 11.4 |
| 5 | base | 44 | R + T_short | 15.4 | base | 44 / 44 | R + T_short | 15.4 |
| 6 | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 7 (asOf) | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 8* | peak (r) | 36.4 | I | 12.7 | peak (r) | 36.4 / 36.4 | I | 12.7 |
| 9* | peak | 45.5 | I + T_cruise | 15.5 | peak | 39.3 / 39.3 | I + T_cruise | 13.7 |
| 10* | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 39.3 / 39.3 | RP + R_sharpen | 13.7 |
| 11* | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 39.3 / 39.3 | RP + R_sharpen | 13.7 |
| 12* | taper | 38.7 | RP + T_short | 13.5 | taper | 33.4 / 33.4 | RP + T_short | 11.6 |
| 13* | taper | 31.9 | RP | 11.1 | taper | 27.5 / 27.5 | RP | 9.6 |
| 14* | race | 19.49 | RP_sharpener | — | race | 17.56 / 17.56 | RP_sharpener | — |

Changes po nedelji: 9: 6, 10: 6, 11: 6, 12: 5, 13: 5, 14: 5.

### dev-04 / pauza-20 (asOf 2026-12-20)

Tempo: vdot → vdot; VDOT 50 → 50; prognoza 19:56 → 19:56; cilj ambitious → ambitious; promena: 42.

Reasons:
- PAUSE: Pauza 20 dana (obim 7 dana pre pauze 33.9 km): cilj 23.7 km; prva nedelja bez kvaliteta, druga 1 kvalitet.
- UNDER_EXECUTION (nije primenjeno): Izvršeno 0 od 45.5 km u 7 dana (< 60%): nadjačano ili nema sledeće nedelje izgradnje.

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 35 | R + T_short | 12.2 | base | 35 / 35 | R + T_short | 12.2 |
| 2 | base | 37.8 | R + T_short | 13.2 | base | 37.8 / 37.8 | R + T_short | 13.2 |
| 3 | base | 40.8 | R + T_short | 14.2 | base | 40.8 / 40.8 | R + T_short | 14.2 |
| 4 | base (r) | 32.6 | R | 11.4 | base (r) | 32.6 / 32.6 | R | 11.4 |
| 5 | base | 44 | R + T_short | 15.4 | base | 44 / 44 | R + T_short | 15.4 |
| 6 | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 7 (asOf) | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 8* | peak (r) | 36.4 | I | 12.7 | peak (r) | 23.7 / 23.7 | — | 8.2 |
| 9* | peak | 45.5 | I + T_cruise | 15.5 | peak | 25.5 / 25.5 | I | 8.9 |
| 10* | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 25.5 / 25.5 | RP + R_sharpen | 8.9 |
| 11* | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 25.5 / 25.5 | RP + R_sharpen | 8.9 |
| 12* | taper | 38.7 | RP + T_short | 13.5 | taper | 21.7 / 21.7 | RP + T_short | 7.5 |
| 13* | taper | 31.9 | RP | 11.1 | taper | 17.8 / 17.8 | RP | 6.2 |
| 14* | race | 19.49 | RP_sharpener | — | race | 12.73 / 12.73 | RP_sharpener | — |

Changes po nedelji: 8: 6, 9: 6, 10: 6, 11: 6, 12: 6, 13: 6, 14: 6.

### dev-04 / pauza-35 (asOf 2026-12-20)

Tempo: vdot → vdot; VDOT 50 → 50; prognoza 19:56 → 19:56; cilj ambitious → ambitious; promena: 46.

Reasons:
- PAUSE: Pauza 36 dana (obim 7 dana pre pauze 37.8 km): cilj 18.9 km; prva nedelja bez kvaliteta, druga 1 kvalitet; nov start (faze preostale izgradnje ponovo).
- UNDER_EXECUTION (nije primenjeno): Izvršeno 0 od 45.5 km u 7 dana (< 60%): nadjačano ili nema sledeće nedelje izgradnje.

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 35 | R + T_short | 12.2 | base | 35 / 35 | R + T_short | 12.2 |
| 2 | base | 37.8 | R + T_short | 13.2 | base | 37.8 / 37.8 | R + T_short | 13.2 |
| 3 | base | 40.8 | R + T_short | 14.2 | base | 40.8 / 40.8 | R + T_short | 14.2 |
| 4 | base (r) | 32.6 | R | 11.4 | base (r) | 32.6 / 32.6 | R | 11.4 |
| 5 | base | 44 | R + T_short | 15.4 | base | 44 / 44 | R + T_short | 15.4 |
| 6 | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 7 (asOf) | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 8* | peak (r) | 36.4 | I | 12.7 | base | 18.9 / 18.9 | — | 6.6 |
| 9* | peak | 45.5 | I + T_cruise | 15.5 | base | 20.4 / 20.4 | R | 7.1 |
| 10* | sharpen | 45.5 | RP + R_sharpen | 15.5 | peak | 22 / 22 | I + T_cruise | 7.7 |
| 11* | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 22 / 22 | RP + R_sharpen | 7.7 |
| 12* | taper | 38.7 | RP + T_short | 13.5 | taper | 18.7 / 18.7 | RP + T_short | 6.5 |
| 13* | taper | 31.9 | RP | 11.1 | taper | 15.4 / 15.4 | RP | 5.3 |
| 14* | race | 19.49 | RP_sharpener | — | race | 11 / 11 | RP_sharpener | — |

Changes po nedelji: 8: 8, 9: 7, 10: 7, 11: 6, 12: 6, 13: 6, 14: 6.

### dev-04 / bol-5 (asOf 2026-12-20)

Tempo: vdot → vdot; VDOT 50 → 50; prognoza 19:56 → 19:56; cilj ambitious → ambitious; promena: 5.

Reasons:
- PAIN: Bol 5/10 u poslednja 3 dana: 7 dana bez kvaliteta (do 2026-12-27). Bol: nedelju dana bez kvaliteta, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled.

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 35 | R + T_short | 12.2 | base | 35 / 35 | R + T_short | 12.2 |
| 2 | base | 37.8 | R + T_short | 13.2 | base | 37.8 / 37.8 | R + T_short | 13.2 |
| 3 | base | 40.8 | R + T_short | 14.2 | base | 40.8 / 40.8 | R + T_short | 14.2 |
| 4 | base (r) | 32.6 | R | 11.4 | base (r) | 32.6 / 32.6 | R | 11.4 |
| 5 | base | 44 | R + T_short | 15.4 | base | 44 / 44 | R + T_short | 15.4 |
| 6 | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 7 (asOf) | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 8* | peak (r) | 36.4 | I | 12.7 | peak (r) | 36.4 / 27 | — | 10.5 |
| 9 | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 10 | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 45.5 / 45.5 | RP + R_sharpen | 15.5 |
| 11 | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 45.5 / 45.5 | RP + R_sharpen | 15.5 |
| 12 | taper | 38.7 | RP + T_short | 13.5 | taper | 38.7 / 38.7 | RP + T_short | 13.5 |
| 13 | taper | 31.9 | RP | 11.1 | taper | 31.9 / 31.9 | RP | 11.1 |
| 14 | race | 19.49 | RP_sharpener | — | race | 19.49 / 19.49 | RP_sharpener | — |

Changes po nedelji: 8: 5.

### dev-04 / test-3km (asOf 2026-12-20)

Tempo: vdot → vdot; VDOT 50 → 51; prognoza 19:56 → 19:36; cilj ambitious → feasible; promena: 14.

Reasons:
- NEW_RESULT: Test 3K 11:21 (2026-12-19): VDOT 51 od nedelje 8 (bilo 50).

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 35 | R + T_short | 12.2 | base | 35 / 35 | R + T_short | 12.2 |
| 2 | base | 37.8 | R + T_short | 13.2 | base | 37.8 / 37.8 | R + T_short | 13.2 |
| 3 | base | 40.8 | R + T_short | 14.2 | base | 40.8 / 40.8 | R + T_short | 14.2 |
| 4 | base (r) | 32.6 | R | 11.4 | base (r) | 32.6 / 32.6 | R | 11.4 |
| 5 | base | 44 | R + T_short | 15.4 | base | 44 / 44 | R + T_short | 15.4 |
| 6 | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 7 (asOf) | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.5 |
| 8* | peak (r) | 36.4 | I | 12.7 | peak (r) | 36.4 / 36.4 | I | 12.7 |
| 9* | peak | 45.5 | I + T_cruise | 15.5 | peak | 45.5 / 45.5 | I + T_cruise | 15.9 |
| 10* | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 45.5 / 45.5 | RP + R_sharpen | 15.9 |
| 11* | sharpen | 45.5 | RP + R_sharpen | 15.5 | sharpen | 45.5 / 45.5 | RP + R_sharpen | 15.9 |
| 12* | taper | 38.7 | RP + T_short | 13.5 | taper | 38.7 / 38.7 | RP + T_short | 13.5 |
| 13* | taper | 31.9 | RP | 11.1 | taper | 31.9 / 31.9 | RP | 11.1 |
| 14* | race | 19.49 | RP_sharpener | — | race | 19.52 / 19.52 | RP_sharpener | — |

Changes po nedelji: plan: 3, 8: 2, 9: 3, 10: 2, 11: 2, 14: 2.

## feel-d4-25km-e600-12w — bez rezultata, E 6:00, 25 km, 4 dana, 12 ned, cilj 25:00

### feel-d4-25km-e600-12w / bez-promena (asOf 2026-12-13)

Tempo: feel → feel; VDOT — → —; prognoza — → —; cilj insufficient_data → insufficient_data; promena: 0.

Reasons:
- — (nijedan uslov nije aktivan)

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 25 | HILLS + TEMPO_FEEL | 8.7 | base | 25 / 25 | HILLS + TEMPO_FEEL | 8.7 |
| 2 | base | 27 | HILLS + TEMPO_FEEL | 9.4 | base | 27 / 27 | HILLS + TEMPO_FEEL | 9.4 |
| 3 | base T | 29.1 | TEST_3K + TEMPO_FEEL | 10.1 | base T | 29.1 / 29.1 | TEST_3K + TEMPO_FEEL | 10.1 |
| 4 | base (r) | 23.3 | HILLS | 8.1 | base (r) | 23.3 / 23.3 | HILLS | 8.1 |
| 5 | peak | 31.4 | FARTLEK + TEMPO_FEEL | 10.9 | peak | 31.4 / 31.4 | FARTLEK + TEMPO_FEEL | 10.9 |
| 6 (asOf) | peak | 32.5 | FARTLEK + TEMPO_FEEL | 11.3 | peak | 32.5 / 32.5 | FARTLEK + TEMPO_FEEL | 11.3 |
| 7 | peak (r) | 26 | FARTLEK | 9.1 | peak (r) | 26 / 26 | FARTLEK | 9.1 |
| 8 | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 32.5 / 32.5 | FARTLEK_RP + HILLS | 11.3 |
| 9 | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 32.5 / 32.5 | FARTLEK_RP + HILLS | 11.3 |
| 10 | taper | 27.6 | FARTLEK_RP + TEMPO_FEEL | 9.6 | taper | 27.6 / 27.6 | FARTLEK_RP + TEMPO_FEEL | 9.6 |
| 11 | taper | 22.8 | FARTLEK_RP | 7.9 | taper | 22.8 / 22.8 | FARTLEK_RP | 7.9 |
| 12 | race | 11.29 | FARTLEK_RP | — | race | 11.29 / 11.29 | FARTLEK_RP | — |

Changes po nedelji: —.

### feel-d4-25km-e600-12w / propustena-nedelja (asOf 2026-12-13)

Tempo: feel → feel; VDOT — → —; prognoza — → —; cilj insufficient_data → insufficient_data; promena: 33.

Reasons:
- PAUSE: Pauza 7 dana (obim 7 dana pre pauze 31.4 km): cilj 25.1 km; prva nedelja 1 kvalitet.
- UNDER_EXECUTION (nije primenjeno): Izvršeno 0 od 32.5 km u 7 dana (< 60%): nadjačano ili nema sledeće nedelje izgradnje.

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 25 | HILLS + TEMPO_FEEL | 8.7 | base | 25 / 25 | HILLS + TEMPO_FEEL | 8.7 |
| 2 | base | 27 | HILLS + TEMPO_FEEL | 9.4 | base | 27 / 27 | HILLS + TEMPO_FEEL | 9.4 |
| 3 | base T | 29.1 | TEST_3K + TEMPO_FEEL | 10.1 | base T | 29.1 / 29.1 | TEST_3K + TEMPO_FEEL | 10.1 |
| 4 | base (r) | 23.3 | HILLS | 8.1 | base (r) | 23.3 / 23.3 | HILLS | 8.1 |
| 5 | peak | 31.4 | FARTLEK + TEMPO_FEEL | 10.9 | peak | 31.4 / 31.4 | FARTLEK + TEMPO_FEEL | 10.9 |
| 6 (asOf) | peak | 32.5 | FARTLEK + TEMPO_FEEL | 11.3 | peak | 32.5 / 32.5 | FARTLEK + TEMPO_FEEL | 11.3 |
| 7* | peak (r) | 26 | FARTLEK | 9.1 | peak (r) | 25.1 / 25.1 | FARTLEK | 8.7 |
| 8* | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 25.1 / 25.1 | FARTLEK_RP + HILLS | 8.7 |
| 9* | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 25.1 / 25.1 | FARTLEK_RP + HILLS | 8.7 |
| 10* | taper | 27.6 | FARTLEK_RP + TEMPO_FEEL | 9.6 | taper | 21.3 / 21.3 | FARTLEK_RP + TEMPO_FEEL | 7.4 |
| 11* | taper | 22.8 | FARTLEK_RP | 7.9 | taper | 17.6 / 17.6 | FARTLEK_RP | 6.1 |
| 12* | race | 11.29 | FARTLEK_RP | — | race | 9.49 / 9.49 | FARTLEK_RP | — |

Changes po nedelji: 7: 5, 8: 6, 9: 6, 10: 6, 11: 6, 12: 4.

### feel-d4-25km-e600-12w / pauza-10 (asOf 2026-12-13)

Tempo: feel → feel; VDOT — → —; prognoza — → —; cilj insufficient_data → insufficient_data; promena: 35.

Reasons:
- PAUSE: Pauza 10 dana (obim 7 dana pre pauze 25.9 km): cilj 20.7 km; prva nedelja 1 kvalitet.
- UNDER_EXECUTION (nije primenjeno): Izvršeno 0 od 32.5 km u 7 dana (< 60%): nadjačano ili nema sledeće nedelje izgradnje.

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 25 | HILLS + TEMPO_FEEL | 8.7 | base | 25 / 25 | HILLS + TEMPO_FEEL | 8.7 |
| 2 | base | 27 | HILLS + TEMPO_FEEL | 9.4 | base | 27 / 27 | HILLS + TEMPO_FEEL | 9.4 |
| 3 | base T | 29.1 | TEST_3K + TEMPO_FEEL | 10.1 | base T | 29.1 / 29.1 | TEST_3K + TEMPO_FEEL | 10.1 |
| 4 | base (r) | 23.3 | HILLS | 8.1 | base (r) | 23.3 / 23.3 | HILLS | 8.1 |
| 5 | peak | 31.4 | FARTLEK + TEMPO_FEEL | 10.9 | peak | 31.4 / 31.4 | FARTLEK + TEMPO_FEEL | 10.9 |
| 6 (asOf) | peak | 32.5 | FARTLEK + TEMPO_FEEL | 11.3 | peak | 32.5 / 32.5 | FARTLEK + TEMPO_FEEL | 11.3 |
| 7* | peak (r) | 26 | FARTLEK | 9.1 | peak (r) | 20.7 / 20.7 | FARTLEK | 7.2 |
| 8* | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 20.7 / 20.7 | FARTLEK_RP + HILLS | 7.2 |
| 9* | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 20.7 / 20.7 | FARTLEK_RP + HILLS | 7.2 |
| 10* | taper | 27.6 | FARTLEK_RP + TEMPO_FEEL | 9.6 | taper | 17.6 / 17.6 | FARTLEK_RP + TEMPO_FEEL | 6.1 |
| 11* | taper | 22.8 | FARTLEK_RP | 7.9 | taper | 15 / 15 | FARTLEK_RP | 5.2 |
| 12* | race | 11.29 | FARTLEK_RP | — | race | 8.52 / 8.52 | FARTLEK_RP | — |

Changes po nedelji: 7: 6, 8: 6, 9: 6, 10: 6, 11: 6, 12: 5.

### feel-d4-25km-e600-12w / pauza-20 (asOf 2026-12-13)

Tempo: feel → feel; VDOT — → —; prognoza — → —; cilj insufficient_data → insufficient_data; promena: 35.

Reasons:
- PAUSE: Pauza 21 dana (obim 7 dana pre pauze 29.1 km): cilj 20.4 km; prva nedelja bez kvaliteta, druga 1 kvalitet.
- UNDER_EXECUTION (nije primenjeno): Izvršeno 0 od 32.5 km u 7 dana (< 60%): nadjačano ili nema sledeće nedelje izgradnje.

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 25 | HILLS + TEMPO_FEEL | 8.7 | base | 25 / 25 | HILLS + TEMPO_FEEL | 8.7 |
| 2 | base | 27 | HILLS + TEMPO_FEEL | 9.4 | base | 27 / 27 | HILLS + TEMPO_FEEL | 9.4 |
| 3 | base T | 29.1 | TEST_3K + TEMPO_FEEL | 10.1 | base T | 29.1 / 29.1 | TEST_3K + TEMPO_FEEL | 10.1 |
| 4 | base (r) | 23.3 | HILLS | 8.1 | base (r) | 23.3 / 23.3 | HILLS | 8.1 |
| 5 | peak | 31.4 | FARTLEK + TEMPO_FEEL | 10.9 | peak | 31.4 / 31.4 | FARTLEK + TEMPO_FEEL | 10.9 |
| 6 (asOf) | peak | 32.5 | FARTLEK + TEMPO_FEEL | 11.3 | peak | 32.5 / 32.5 | FARTLEK + TEMPO_FEEL | 11.3 |
| 7* | peak (r) | 26 | FARTLEK | 9.1 | peak (r) | 20.4 / 20.4 | — | 7.1 |
| 8* | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 20.4 / 20.4 | FARTLEK_RP | 7.1 |
| 9* | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 20.4 / 20.4 | FARTLEK_RP + HILLS | 7.1 |
| 10* | taper | 27.6 | FARTLEK_RP + TEMPO_FEEL | 9.6 | taper | 17.3 / 17.3 | FARTLEK_RP + TEMPO_FEEL | 6 |
| 11* | taper | 22.8 | FARTLEK_RP | 7.9 | taper | 15 / 15 | FARTLEK_RP | 5.2 |
| 12* | race | 11.29 | FARTLEK_RP | — | race | 8.52 / 8.52 | FARTLEK_RP | — |

Changes po nedelji: 7: 6, 8: 6, 9: 6, 10: 6, 11: 6, 12: 5.

### feel-d4-25km-e600-12w / pauza-35 (asOf 2026-12-13)

Tempo: feel → feel; VDOT — → —; prognoza — → —; cilj insufficient_data → insufficient_data; promena: 38.

Reasons:
- PAUSE: Pauza 35 dana (obim 7 dana pre pauze 25 km): cilj 15 km (ne ispod 15 km za 4 dana); prva nedelja bez kvaliteta, druga 1 kvalitet; nov start (faze preostale izgradnje ponovo).
- UNDER_EXECUTION (nije primenjeno): Izvršeno 0 od 32.5 km u 7 dana (< 60%): nadjačano ili nema sledeće nedelje izgradnje.

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 25 | HILLS + TEMPO_FEEL | 8.7 | base | 25 / 25 | HILLS + TEMPO_FEEL | 8.7 |
| 2 | base | 27 | HILLS + TEMPO_FEEL | 9.4 | base | 27 / 27 | HILLS + TEMPO_FEEL | 9.4 |
| 3 | base T | 29.1 | TEST_3K + TEMPO_FEEL | 10.1 | base T | 29.1 / 29.1 | TEST_3K + TEMPO_FEEL | 10.1 |
| 4 | base (r) | 23.3 | HILLS | 8.1 | base (r) | 23.3 / 23.3 | HILLS | 8.1 |
| 5 | peak | 31.4 | FARTLEK + TEMPO_FEEL | 10.9 | peak | 31.4 / 31.4 | FARTLEK + TEMPO_FEEL | 10.9 |
| 6 (asOf) | peak | 32.5 | FARTLEK + TEMPO_FEEL | 11.3 | peak | 32.5 / 32.5 | FARTLEK + TEMPO_FEEL | 11.3 |
| 7* | peak (r) | 26 | FARTLEK | 9.1 | base | 15 / 15 | — | 5.2 |
| 8* | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | peak | 16.2 / 16.2 | FARTLEK | 5.6 |
| 9* | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 16.2 / 16.2 | FARTLEK_RP + HILLS | 5.2 |
| 10* | taper | 27.6 | FARTLEK_RP + TEMPO_FEEL | 9.6 | taper | 15 / 15 | FARTLEK_RP + FARTLEK | 4.6 |
| 11* | taper | 22.8 | FARTLEK_RP | 7.9 | taper | 15 / 15 | FARTLEK_RP | 5.2 |
| 12* | race | 11.29 | FARTLEK_RP | — | race | 8.1 / 8.1 | FARTLEK_RP | — |

Changes po nedelji: 7: 8, 8: 7, 9: 6, 10: 6, 11: 6, 12: 5.

### feel-d4-25km-e600-12w / bol-5 (asOf 2026-12-13)

Tempo: feel → feel; VDOT — → —; prognoza — → —; cilj insufficient_data → insufficient_data; promena: 4.

Reasons:
- PAIN: Bol 5/10 u poslednja 3 dana: 7 dana bez kvaliteta (do 2026-12-20). Bol: nedelju dana bez kvaliteta, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled.

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 25 | HILLS + TEMPO_FEEL | 8.7 | base | 25 / 25 | HILLS + TEMPO_FEEL | 8.7 |
| 2 | base | 27 | HILLS + TEMPO_FEEL | 9.4 | base | 27 / 27 | HILLS + TEMPO_FEEL | 9.4 |
| 3 | base T | 29.1 | TEST_3K + TEMPO_FEEL | 10.1 | base T | 29.1 / 29.1 | TEST_3K + TEMPO_FEEL | 10.1 |
| 4 | base (r) | 23.3 | HILLS | 8.1 | base (r) | 23.3 / 23.3 | HILLS | 8.1 |
| 5 | peak | 31.4 | FARTLEK + TEMPO_FEEL | 10.9 | peak | 31.4 / 31.4 | FARTLEK + TEMPO_FEEL | 10.9 |
| 6 (asOf) | peak | 32.5 | FARTLEK + TEMPO_FEEL | 11.3 | peak | 32.5 / 32.5 | FARTLEK + TEMPO_FEEL | 11.3 |
| 7* | peak (r) | 26 | FARTLEK | 9.1 | peak (r) | 26 / 20.8 | — | 9.1 |
| 8 | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 32.5 / 32.5 | FARTLEK_RP + HILLS | 11.3 |
| 9 | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 32.5 / 32.5 | FARTLEK_RP + HILLS | 11.3 |
| 10 | taper | 27.6 | FARTLEK_RP + TEMPO_FEEL | 9.6 | taper | 27.6 / 27.6 | FARTLEK_RP + TEMPO_FEEL | 9.6 |
| 11 | taper | 22.8 | FARTLEK_RP | 7.9 | taper | 22.8 / 22.8 | FARTLEK_RP | 7.9 |
| 12 | race | 11.29 | FARTLEK_RP | — | race | 11.29 / 11.29 | FARTLEK_RP | — |

Changes po nedelji: 7: 4.

### feel-d4-25km-e600-12w / test-3km (asOf 2026-11-22)

Tempo: feel → vdot; VDOT — → 41.8; prognoza — → 23:13; cilj insufficient_data → feasible; promena: 30.

Reasons:
- NEW_RESULT: Test 3K 13:30 (2026-11-21): VDOT 41.8 od nedelje 4 — plan po osećaju prelazi na tempo.

| Ned | Pre: faza | cilj | kvalitet | dugi | Posle: faza | cilj / plan. | kvalitet | dugi |
|---|---|---|---|---|---|---|---|---|
| 1 | base | 25 | HILLS + TEMPO_FEEL | 8.7 | base | 25 / 25 | HILLS + TEMPO_FEEL | 8.7 |
| 2 | base | 27 | HILLS + TEMPO_FEEL | 9.4 | base | 27 / 27 | HILLS + TEMPO_FEEL | 9.4 |
| 3 (asOf) | base T | 29.1 | TEST_3K + TEMPO_FEEL | 10.1 | base T | 29.1 / 29.1 | TEST_3K + TEMPO_FEEL | 10.1 |
| 4* | base (r) | 23.3 | HILLS | 8.1 | base (r) | 23.3 / 23.3 | R | 8.1 |
| 5* | peak | 31.4 | FARTLEK + TEMPO_FEEL | 10.9 | peak | 31.4 / 31.4 | I + T_cruise | 10.9 |
| 6* | peak | 32.5 | FARTLEK + TEMPO_FEEL | 11.3 | peak | 32.5 / 32.5 | I + T_cruise | 11.3 |
| 7* | peak (r) | 26 | FARTLEK | 9.1 | peak (r) | 26 / 26 | I | 9.1 |
| 8* | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 32.5 / 32.5 | RP + R_sharpen | 11.3 |
| 9* | sharpen | 32.5 | FARTLEK_RP + HILLS | 11.3 | sharpen | 32.5 / 32.5 | RP + R_sharpen | 11.3 |
| 10* | taper | 27.6 | FARTLEK_RP + TEMPO_FEEL | 9.6 | taper | 27.6 / 27.6 | RP + T_short | 9.6 |
| 11* | taper | 22.8 | FARTLEK_RP | 7.9 | taper | 22.8 / 22.8 | RP | 7.9 |
| 12* | race | 11.29 | FARTLEK_RP | — | race | 11.8 / 11.8 | RP_sharpener | — |

Changes po nedelji: plan: 4, 4: 3, 5: 3, 6: 3, 7: 2, 8: 3, 9: 3, 10: 3, 11: 3, 12: 3.

