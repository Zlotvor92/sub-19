# HM v2 Segment 03 — primeri (hm-v2.2.0)

Izvor: `node docs/hm-v2/artifacts/segment-03/run.ts` (ulazi iz mreže 03, `testInputs.ts`).

## f-d4-12w-40km-e360-A — po osećaju, 4 dana, 40 km, lagan 6:00, 12 ned (test u izgradnji)

Po osećaju: E 5:45–6:15/km, procena VDOT 41,0 (orijentir T 5:00, RP 5:09/km), bez prognoze do testa; vrh 56,0 km (granica 56,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1 / test                         | Q2                              | dugi | lagani    | napomena                                         |
| --- | ------ | -------------- | --------------------------------- | ------------------------------- | ---- | --------- | ------------------------------------------------ |
| 1   | baza   | 40,0 / 40,0    | R 6 × 200 m (RPE 8–8)             | T 2,0 km kontinuirano (RPE 6–7) | 16,0 | 8,1       |                                                  |
| 2   | baza   | 42,4 / 42,4    | R 8 × 200 m (RPE 8–8)             | T 2,5 km kontinuirano (RPE 6–7) | 16,9 | 8,3       |                                                  |
| 3   | baza   | 44,9 / 44,9    | test 5 km kontrolisano maksimalno | T 3,0 km kontinuirano (RPE 6–7) | 17,9 | 7,3       | test                                             |
| 4   | razvoj | 47,6 / 47,6    | I 2 × 1000 m (RPE 8–8)            | T 3 × 1000 m (RPE 6–7)          | 19,0 | 10,9      |                                                  |
| 5   | razvoj | 38,1 / 38,1    | —                                 | T 2 × 1000 m (RPE 6–7)          | 15,2 | 7,5 + 7,4 | rasterećenje                                     |
| 6   | razvoj | 50,5 / 50,5    | I 3 × 800 m (RPE 8–8)             | T 2 × 1600 m (RPE 6–7)          | 20,2 | 11,7      |                                                  |
| 7   | spec.  | 53,5 / 53,5    | RP 2 × 2000 m (RPE 6–7)           | T 4 × 1000 m (RPE 6–7)          | 21,4 | 11,7      |                                                  |
| 8   | spec.  | 56,0 / 56,0    | RP 2 × 2500 m (RPE 6–7)           | T 3 × 1600 m (RPE 6–7)          | 22,4 | 11,6      |                                                  |
| 9   | spec.  | 44,8 / 44,8    | —                                 | T 2 × 1200 m (RPE 6–7)          | 17,9 | 9,3 + 9,2 | rasterećenje                                     |
| 10  | spec.  | 56,0 / 56,0    | RP 2 × 3000 m (RPE 6–7)           | T 2 × 2400 m (RPE 6–7)          | 22,4 | 10,6      |                                                  |
| 11  | taper  | 39,2 / 39,2    | RP 2 × 2000 m (RPE 6–7)           | T 2 × 1200 m (RPE 6–7)          | 13,4 | 7,3       |                                                  |
| 12  | trka   | 19,9 / 19,9    | —                                 | —                               | —    | 5,8       | oštrenje RP 2 × 2000 m (RPE 6–7); trka van obima |

## f-d3-13w-25km-e270-A — po osećaju, 3 dana, 25 km, lagan 4:30 (test u rasterećenju, dugi skraćen)

Po osećaju: E 4:15–4:45/km, procena VDOT 58,6 (orijentir T 3:44, RP 3:47/km), bez prognoze do testa; vrh 35,0 km (granica 35,0); upozorenja: LONG_RUN_SHORT, TEST_DELOAD_LONG, TAPER_NO_QUALITY.

| ned | faza   | cilj / plan km | Q1 / test                         | Q2  | dugi | lagani    | napomena                   |
| --- | ------ | -------------- | --------------------------------- | --- | ---- | --------- | -------------------------- |
| 1   | baza   | 25,0 / 25,1    | T 2,0 km kontinuirano (RPE 6–7)   | —   | 11,2 | 6,3       |                            |
| 2   | baza   | 26,5 / 26,6    | T 2,5 km kontinuirano (RPE 6–7)   | —   | 11,9 | 6,6       |                            |
| 3   | baza   | 28,1 / 28,1    | T 2 × 1250 m (RPE 6–7)            | —   | 12,6 | 7,2       |                            |
| 4   | baza   | 22,5 / 22,6    | test 5 km kontrolisano maksimalno | —   | 7,9  | 4,1       | rasterećenje, test         |
| 5   | razvoj | 29,8 / 29,9    | T 2,5 km kontinuirano (RPE 6–7)   | —   | 13,4 | 8,4       |                            |
| 6   | razvoj | 31,6 / 31,6    | T 3 × 1000 m (RPE 6–7)            | —   | 14,2 | 8,4       |                            |
| 7   | razvoj | 33,5 / 33,5    | T 2 × 1600 m (RPE 6–7)            | —   | 15,0 | 9,5       |                            |
| 8   | spec.  | 35,0 / 35,0    | RP 2 × 2000 m (RPE 6–7)           | —   | 15,7 | 9,4       |                            |
| 9   | spec.  | 28,0 / 28,0    | T 2 × 1200 m (RPE 6–7)            | —   | 12,5 | 7,3       | rasterećenje               |
| 10  | spec.  | 35,0 / 35,0    | RP 2 × 2500 m (RPE 6–7)           | —   | 15,7 | 8,4       |                            |
| 11  | spec.  | 35,0 / 35,0    | RP 5,0 km kontinuirano (RPE 6–7)  | —   | 15,7 | 8,8       |                            |
| 12  | taper  | 24,5 / 24,5    | —                                 | —   | 9,4  | 7,6 + 7,5 |                            |
| 13  | trka   | 15,0 / 15,0    | —                                 | —   | —    | 7,5 + 7,5 | oštrenje —; trka van obima |

## f-d6-20w-90km-e270-A — po osećaju, 6 dana, 90 km, lagan 4:30, 20 ned

Po osećaju: E 4:15–4:45/km, procena VDOT 58,6 (orijentir T 3:44, RP 3:47/km), bez prognoze do testa; vrh 100,0 km (granica 100,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1 / test                         | Q2                              | dugi | lagani                    | napomena                                         |
| --- | ------ | -------------- | --------------------------------- | ------------------------------- | ---- | ------------------------- | ------------------------------------------------ |
| 1   | baza   | 90,0 / 90,0    | R 8 × 300 m (RPE 8–8)             | T 5,0 km kontinuirano (RPE 6–7) | 24,0 | 12,9 + 12,9 + 12,9        |                                                  |
| 2   | baza   | 94,0 / 94,0    | R 8 × 400 m (RPE 8–8)             | T 6,0 km kontinuirano (RPE 6–7) | 24,0 | 13,4 + 13,4 + 13,4        |                                                  |
| 3   | baza   | 98,0 / 98,0    | R 16 × 200 m (RPE 8–8)            | T 7,0 km kontinuirano (RPE 6–7) | 24,0 | 14,4 + 14,3 + 14,3        |                                                  |
| 4   | baza   | 78,4 / 78,4    | —                                 | T 4,0 km kontinuirano (RPE 6–7) | 19,2 | 11,6 + 11,6 + 11,6 + 11,5 | rasterećenje                                     |
| 5   | baza   | 100,0 / 100,0  | R 8 × 400 m (RPE 8–8)             | T 2 × 3500 m (RPE 6–7)          | 24,0 | 15,0 + 15,0 + 14,9        |                                                  |
| 6   | baza   | 100,0 / 100,0  | R 16 × 200 m (RPE 8–8)            | T 7,0 km kontinuirano (RPE 6–7) | 24,0 | 15,0 + 15,0 + 15,0        |                                                  |
| 7   | baza   | 100,0 / 100,0  | test 5 km kontrolisano maksimalno | T 2 × 3500 m (RPE 6–7)          | 24,0 | 15,3 + 15,3 + 15,3        | test                                             |
| 8   | razvoj | 100,0 / 100,0  | I 4 × 1200 m (RPE 8–8)            | T 5 × 1600 m (RPE 6–7)          | 24,0 | 14,0 + 14,0 + 13,9        |                                                  |
| 9   | razvoj | 80,0 / 80,0    | —                                 | T 3 × 1600 m (RPE 6–7)          | 19,2 | 11,7 + 11,7 + 11,7 + 11,6 | rasterećenje                                     |
| 10  | razvoj | 100,0 / 100,0  | I 5 × 1000 m (RPE 8–8)            | T 3 × 3000 m (RPE 6–7)          | 24,0 | 13,6 + 13,6 + 13,5        |                                                  |
| 11  | razvoj | 100,0 / 100,0  | I 5 × 1200 m (RPE 8–8)            | T 2 × 4500 m (RPE 6–7)          | 24,0 | 13,1 + 13,1 + 13,1        |                                                  |
| 12  | razvoj | 100,0 / 100,0  | I 6 × 1000 m (RPE 8–8)            | T 9,0 km kontinuirano (RPE 6–7) | 24,0 | 13,2 + 13,2 + 13,2        |                                                  |
| 13  | razvoj | 80,0 / 80,0    | —                                 | T 3 × 1600 m (RPE 6–7)          | 19,2 | 11,7 + 11,7 + 11,7 + 11,6 | rasterećenje                                     |
| 14  | spec.  | 100,0 / 100,0  | RP 3 × 3000 m (RPE 6–7)           | T 2 × 4500 m (RPE 6–7)          | 24,0 | 13,1 + 13,1 + 13,0        |                                                  |
| 15  | spec.  | 100,0 / 100,0  | RP 2 × 5000 m (RPE 6–7)           | T 9,0 km kontinuirano (RPE 6–7) | 24,0 | 13,0 + 12,9 + 12,9        |                                                  |
| 16  | spec.  | 100,0 / 100,0  | RP 3 × 4000 m (RPE 6–7)           | T 2 × 4500 m (RPE 6–7)          | 24,0 | 12,0 + 12,0 + 12,0        |                                                  |
| 17  | spec.  | 80,0 / 80,0    | —                                 | T 3 × 1600 m (RPE 6–7)          | 19,2 | 11,7 + 11,7 + 11,7 + 11,6 | rasterećenje                                     |
| 18  | spec.  | 100,0 / 100,0  | RP 4 × 3000 m (RPE 6–7)           | T 9,0 km kontinuirano (RPE 6–7) | 24,0 | 12,1 + 12,1 + 12,0        |                                                  |
| 19  | taper  | 70,0 / 70,0    | RP 2 × 3000 m (RPE 6–7)           | T 3 × 1600 m (RPE 6–7)          | 14,4 | 8,8 + 8,8 + 8,7           |                                                  |
| 20  | trka   | 34,0 / 34,0    | —                                 | —                               | —    | 7,8 + 7,8                 | oštrenje RP 2 × 2000 m (RPE 6–7); trka van obima |

## b-d4-16w-30km-e450-A — početnik po osećaju, 4 dana, 30 km, lagan 7:30, 16 ned

Po osećaju: E 7:15–7:45/km, procena VDOT 30,8 (orijentir T 6:16, RP 6:33/km), bez prognoze do testa; vrh 42,0 km (granica 42,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1 / test                        | Q2  | dugi | lagani          | napomena                                         |
| --- | ------ | -------------- | -------------------------------- | --- | ---- | --------------- | ------------------------------------------------ |
| 1   | baza   | 30,0 / 30,0    | —                                | —   | 12,0 | 6,0 + 6,0 + 6,0 | uvod                                             |
| 2   | baza   | 31,5 / 31,5    | —                                | —   | 12,6 | 6,3 + 6,3 + 6,3 | uvod                                             |
| 3   | baza   | 33,1 / 33,1    | T 1,5 km kontinuirano (RPE 6–7)  | —   | 13,2 | 7,6 + 7,5       |                                                  |
| 4   | baza   | 26,5 / 26,5    | T 1,5 km kontinuirano (RPE 6–7)  | —   | 10,5 | 5,6 + 5,6       | rasterećenje                                     |
| 5   | baza   | 34,8 / 34,8    | T 2,0 km kontinuirano (RPE 6–7)  | —   | 13,9 | 7,8 + 7,8       |                                                  |
| 6   | razvoj | 36,5 / 36,5    | T 2 × 1200 m (RPE 6–7)           | —   | 14,6 | 8,0 + 8,0       |                                                  |
| 7   | razvoj | 38,3 / 38,3    | T 3 × 1000 m (RPE 6–7)           | —   | 15,3 | 8,2 + 8,2       |                                                  |
| 8   | razvoj | 30,6 / 30,6    | T 1,5 km kontinuirano (RPE 6–7)  | —   | 12,2 | 6,8 + 6,8       | rasterećenje                                     |
| 9   | razvoj | 40,2 / 40,2    | T 2 × 1600 m (RPE 6–7)           | —   | 16,0 | 8,8 + 8,7       |                                                  |
| 10  | spec.  | 42,0 / 42,0    | RP 2 × 2000 m (RPE 6–7)          | —   | 16,8 | 8,9 + 8,8       |                                                  |
| 11  | spec.  | 42,0 / 42,0    | RP 2 × 2500 m (RPE 6–7)          | —   | 16,8 | 8,4 + 8,3       |                                                  |
| 12  | spec.  | 33,6 / 33,6    | T 1,5 km kontinuirano (RPE 6–7)  | —   | 13,4 | 7,7 + 7,7       | rasterećenje                                     |
| 13  | spec.  | 42,0 / 42,0    | RP 2 × 3000 m (RPE 6–7)          | —   | 16,8 | 7,9 + 7,8       |                                                  |
| 14  | spec.  | 42,0 / 42,0    | RP 6,0 km kontinuirano (RPE 6–7) | —   | 16,8 | 8,0 + 7,9       |                                                  |
| 15  | taper  | 29,4 / 29,4    | RP 2 × 2000 m (RPE 6–7)          | —   | 10,0 | 6,0 + 5,9       |                                                  |
| 16  | trka   | 15,4 / 15,4    | —                                | —   | —    | 4,7             | oštrenje RP 2 × 2000 m (RPE 6–7); trka van obima |

## b-d4-12w-25km-e330-A — početnik po osećaju, 4 dana, 25 km, lagan 5:30 (taper T 1,5 km)

Po osećaju: E 5:15–5:45/km, procena VDOT 45,7 (orijentir T 4:34, RP 4:41/km), bez prognoze do testa; vrh 35,0 km (granica 35,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1 / test                        | Q2  | dugi | lagani          | napomena                   |
| --- | ------ | -------------- | -------------------------------- | --- | ---- | --------------- | -------------------------- |
| 1   | baza   | 25,0 / 25,0    | —                                | —   | 10,0 | 5,0 + 5,0 + 5,0 | uvod                       |
| 2   | baza   | 26,3 / 26,3    | —                                | —   | 10,5 | 5,3 + 5,3 + 5,2 | uvod                       |
| 3   | baza   | 27,6 / 27,6    | T 1,5 km kontinuirano (RPE 6–7)  | —   | 11,0 | 5,3 + 5,3       |                            |
| 4   | razvoj | 29,0 / 29,0    | T 2 × 1200 m (RPE 6–7)           | —   | 11,6 | 5,2 + 5,1       |                            |
| 5   | razvoj | 23,2 / 23,3    | T 1,5 km kontinuirano (RPE 6–7)  | —   | 9,2  | 4,0 + 4,0       | rasterećenje               |
| 6   | razvoj | 30,5 / 30,5    | T 3 × 1000 m (RPE 6–7)           | —   | 12,2 | 5,2 + 5,2       |                            |
| 7   | spec.  | 32,0 / 32,0    | RP 2 × 2000 m (RPE 6–7)          | —   | 12,8 | 5,2 + 5,2       |                            |
| 8   | spec.  | 33,6 / 33,6    | RP 2 × 2500 m (RPE 6–7)          | —   | 13,4 | 5,2 + 5,2       |                            |
| 9   | spec.  | 26,9 / 26,9    | T 1,5 km kontinuirano (RPE 6–7)  | —   | 10,7 | 5,1 + 5,1       | rasterećenje               |
| 10  | spec.  | 35,0 / 35,0    | RP 5,0 km kontinuirano (RPE 6–7) | —   | 14,0 | 5,8 + 5,7       |                            |
| 11  | taper  | 24,5 / 24,6    | T 1,5 km kontinuirano (RPE 6–7)  | —   | 8,4  | 5,1 + 5,0       |                            |
| 12  | trka   | 14,2 / 14,2    | —                                | —   | —    | 5,0 + 5,0       | oštrenje —; trka van obima |

## b-d5-20w-45km-v40-B — početnik sa rezultatom (VDOT 40), 5 dana, 45 km, 20 ned

VDOT 40,0, RP 5:15/km; vrh 60,0 km (granica 60,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1 / test             | Q2  | dugi | lagani                | napomena                               |
| --- | ------ | -------------- | --------------------- | --- | ---- | --------------------- | -------------------------------------- |
| 1   | baza   | 45,0 / 45,0    | —                     | —   | 14,4 | 7,7 + 7,7 + 7,6 + 7,6 | uvod                                   |
| 2   | baza   | 47,0 / 47,0    | —                     | —   | 15,0 | 8,0 + 8,0 + 8,0 + 8,0 | uvod                                   |
| 3   | baza   | 49,0 / 49,0    | T 1,5 km kontinuirano | —   | 15,6 | 9,4 + 9,3 + 9,3       |                                        |
| 4   | baza   | 39,2 / 39,2    | T 1,5 km kontinuirano | —   | 12,4 | 7,2 + 7,1 + 7,1       | rasterećenje                           |
| 5   | baza   | 51,0 / 51,0    | T 2,0 km kontinuirano | —   | 16,3 | 9,6 + 9,6 + 9,6       |                                        |
| 6   | baza   | 53,0 / 53,0    | T 2,5 km kontinuirano | —   | 16,9 | 9,9 + 9,9 + 9,9       |                                        |
| 7   | baza   | 55,0 / 55,0    | T 3,0 km kontinuirano | —   | 17,6 | 10,2 + 10,2 + 10,1    |                                        |
| 8   | razvoj | 57,0 / 57,0    | T 3 × 1000 m          | —   | 18,2 | 10,6 + 10,5 + 10,5    |                                        |
| 9   | razvoj | 45,6 / 45,6    | T 1,5 km kontinuirano | —   | 14,5 | 8,6 + 8,6 + 8,5       | rasterećenje                           |
| 10  | razvoj | 59,0 / 59,0    | T 2 × 1600 m          | —   | 18,8 | 11,0 + 11,0 + 11,0    |                                        |
| 11  | razvoj | 60,0 / 60,0    | T 4 × 1000 m          | —   | 19,2 | 10,8 + 10,8 + 10,8    |                                        |
| 12  | razvoj | 60,0 / 60,0    | T 3 × 1600 m          | —   | 19,2 | 10,6 + 10,6 + 10,6    |                                        |
| 13  | razvoj | 48,0 / 48,0    | T 2 × 1200 m          | —   | 15,3 | 8,8 + 8,8 + 8,7       | rasterećenje                           |
| 14  | spec.  | 60,0 / 60,0    | RP 2 × 2500 m         | —   | 19,2 | 10,6 + 10,6 + 10,5    |                                        |
| 15  | spec.  | 60,0 / 60,0    | RP 2 × 3000 m         | —   | 19,2 | 10,3 + 10,2 + 10,2    |                                        |
| 16  | spec.  | 60,0 / 60,0    | RP 2 × 4000 m         | —   | 19,2 | 9,6 + 9,5 + 9,5       |                                        |
| 17  | spec.  | 48,0 / 48,0    | T 2 × 1200 m          | —   | 15,3 | 8,8 + 8,8 + 8,7       | rasterećenje                           |
| 18  | spec.  | 60,0 / 60,0    | RP 3 × 3000 m         | —   | 19,2 | 9,2 + 9,2 + 9,1       |                                        |
| 19  | taper  | 42,0 / 42,0    | RP 2 × 2500 m         | —   | 11,5 | 7,2 + 7,1 + 7,1       |                                        |
| 20  | trka   | 24,6 / 24,6    | —                     | —   | —    | 5,5 + 5,5 + 5,5       | oštrenje RP 2 × 2000 m; trka van obima |
