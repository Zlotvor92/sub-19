# HM v2 Segment 02 — primeri (hm-v2.1.0)

Izvor: `node docs/hm-v2/artifacts/segment-02/run.ts` (ulazi iz mreže 02, `testInputs.ts`; poslednji sa `recentLongRunKm`).

## d3-12w-30km-v45-A-sun — 3 dana, mali obim (30 km, VDOT 45, 12 ned)

VDOT 45,0, RP 4:45/km, prognoza 1:40:14; vrh 42,0 km (granica 42,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1                    | Q2  | dugi | lagani | napomena                               |
| --- | ------ | -------------- | --------------------- | --- | ---- | ------ | -------------------------------------- |
| 1   | baza   | 30,0 / 30,0    | T 2,0 km kontinuirano | —   | 13,5 | 10,2   |                                        |
| 2   | baza   | 31,8 / 31,8    | T 2,5 km kontinuirano | —   | 14,3 | 10,7   |                                        |
| 3   | baza   | 33,7 / 33,7    | T 3,0 km kontinuirano | —   | 15,1 | 11,3   |                                        |
| 4   | razvoj | 35,7 / 35,7    | T 3 × 1000 m          | —   | 16,0 | 12,1   |                                        |
| 5   | razvoj | 28,6 / 28,6    | T 2 × 1000 m          | —   | 12,8 | 9,4    | rasterećenje                           |
| 6   | razvoj | 37,8 / 37,8    | T 2 × 1600 m          | —   | 17,0 | 13,2   |                                        |
| 7   | spec.  | 40,1 / 40,1    | RP 2 × 2000 m         | —   | 18,0 | 13,6   |                                        |
| 8   | spec.  | 42,0 / 42,0    | RP 2 × 2500 m         | —   | 18,9 | 13,6   |                                        |
| 9   | spec.  | 33,6 / 33,6    | T 3 × 1000 m          | —   | 15,1 | 10,9   | rasterećenje                           |
| 10  | spec.  | 42,0 / 42,0    | RP 2 × 3000 m         | —   | 18,9 | 12,6   |                                        |
| 11  | taper  | 29,4 / 29,4    | RP 2 × 2000 m         | —   | 11,3 | 9,6    |                                        |
| 12  | trka   | 14,6 / 14,6    | —                     | —   | —    | 6,0    | oštrenje RP 2 × 2000 m; trka van obima |

## d3-16w-45km-v30-C-sun — 3 dana, spor trkač (45 km, VDOT 30, 16 ned)

VDOT 30,0, RP 6:42/km, prognoza 2:21:17; vrh 46,1 km (granica 55,0); upozorenja: WEEK_FITTED, CAPACITY_LIMITED.

| ned | faza   | cilj / plan km | Q1                     | Q2  | dugi | lagani | napomena                               |
| --- | ------ | -------------- | ---------------------- | --- | ---- | ------ | -------------------------------------- |
| 1   | baza   | 42,5 / 42,5    | T 2,5 km kontinuirano  | —   | 17,8 | 17,8   | izvodljiv (pravilo 45,0)               |
| 2   | baza   | 43,0 / 43,0    | T 3,0 km kontinuirano  | —   | 17,8 | 17,8   | izvodljiv (pravilo 45,1)               |
| 3   | baza   | 44,0 / 44,0    | T 4,0 km kontinuirano  | —   | 17,8 | 17,8   | izvodljiv (pravilo 45,6)               |
| 4   | baza   | 34,8 / 34,8    | T 2,0 km kontinuirano  | —   | 14,2 | 14,2   | rasterećenje                           |
| 5   | baza   | 44,1 / 44,1    | T 2 × 2000 m           | —   | 17,8 | 17,8   | izvodljiv (pravilo 46,6)               |
| 6   | razvoj | 44,3 / 44,3    | T 4 × 1000 m           | —   | 17,8 | 17,8   | izvodljiv (pravilo 46,7)               |
| 7   | razvoj | 44,1 / 44,1    | T 2 × 2000 m           | —   | 17,8 | 17,8   | izvodljiv (pravilo 47,0)               |
| 8   | razvoj | 35,3 / 35,3    | T 2 × 1200 m           | —   | 14,2 | 14,2   | rasterećenje                           |
| 9   | razvoj | 44,3 / 44,3    | T 4 × 1000 m           | —   | 17,8 | 17,8   | izvodljiv (pravilo 46,7)               |
| 10  | spec.  | 44,1 / 44,1    | RP 2 × 2000 m          | —   | 17,8 | 17,8   | izvodljiv (pravilo 47,0)               |
| 11  | spec.  | 45,1 / 45,1    | RP 2 × 2500 m          | —   | 17,8 | 17,8   | izvodljiv (pravilo 46,7)               |
| 12  | spec.  | 36,0 / 36,0    | T 3 × 1000 m           | —   | 14,2 | 14,2   | rasterećenje                           |
| 13  | spec.  | 46,1 / 46,1    | RP 2 × 3000 m          | —   | 17,8 | 17,8   | izvodljiv (pravilo 47,8)               |
| 14  | spec.  | 46,0 / 46,0    | RP 6,0 km kontinuirano | —   | 17,8 | 17,8   | izvodljiv (pravilo 48,9)               |
| 15  | taper  | 29,7 / 29,8    | RP 2 × 2000 m          | —   | 10,6 | 10,6   | izvodljiv (pravilo 32,3)               |
| 16  | trka   | 11,5 / 11,5    | —                      | —   | —    | —      | oštrenje RP 2 × 2000 m; trka van obima |

## d4-18w-60km-v55-B-sun — 4 dana, veliki obim (60 km, VDOT 55; HM-01 dugi 28 km)

VDOT 55,0, RP 4:00/km, prognoza 1:24:16; vrh 70,0 km (granica 70,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1            | Q2                    | dugi | lagani      | napomena                               |
| --- | ------ | -------------- | ------------- | --------------------- | ---- | ----------- | -------------------------------------- |
| 1   | baza   | 60,0 / 60,0    | R 6 × 300 m   | T 3,0 km kontinuirano | 24,0 | 13,6        |                                        |
| 2   | baza   | 63,6 / 63,6    | R 10 × 200 m  | T 4,0 km kontinuirano | 24,0 | 15,7        |                                        |
| 3   | baza   | 67,4 / 67,4    | R 8 × 300 m   | T 5,0 km kontinuirano | 24,0 | 17,8        |                                        |
| 4   | baza   | 53,9 / 54,0    | —             | T 3,0 km kontinuirano | 19,2 | 11,9 + 11,8 | rasterećenje                           |
| 5   | baza   | 70,0 / 70,0    | R 8 × 400 m   | T 6,0 km kontinuirano | 24,0 | 17,9        |                                        |
| 6   | baza   | 70,0 / 70,0    | R 16 × 200 m  | T 7,0 km kontinuirano | 24,0 | 16,7        |                                        |
| 7   | razvoj | 70,0 / 70,0    | I 3 × 1000 m  | T 2 × 3500 m          | 24,0 | 18,2        |                                        |
| 8   | razvoj | 56,0 / 56,0    | —             | T 4 × 1000 m          | 19,2 | 12,1 + 12,1 | rasterećenje                           |
| 9   | razvoj | 70,0 / 70,0    | I 4 × 1000 m  | T 7,0 km kontinuirano | 24,0 | 16,8        |                                        |
| 10  | razvoj | 70,0 / 70,0    | I 4 × 1200 m  | T 2 × 3500 m          | 24,0 | 15,4        |                                        |
| 11  | razvoj | 70,0 / 70,0    | I 5 × 1000 m  | T 7,0 km kontinuirano | 24,0 | 15,1        |                                        |
| 12  | spec.  | 70,0 / 70,0    | RP 2 × 3000 m | T 2 × 3500 m          | 24,0 | 16,3        |                                        |
| 13  | spec.  | 56,0 / 56,0    | —             | T 4 × 1000 m          | 19,2 | 12,1 + 12,1 | rasterećenje                           |
| 14  | spec.  | 70,0 / 70,0    | RP 2 × 4000 m | T 7,0 km kontinuirano | 24,0 | 14,5        |                                        |
| 15  | spec.  | 70,0 / 70,0    | RP 3 × 3000 m | T 2 × 3500 m          | 24,0 | 13,0        |                                        |
| 16  | spec.  | 70,0 / 70,0    | RP 2 × 5000 m | T 7,0 km kontinuirano | 24,0 | 12,5        |                                        |
| 17  | taper  | 49,0 / 49,0    | RP 2 × 3000 m | T 4 × 1000 m          | 14,4 | 7,6         |                                        |
| 18  | trka   | 26,5 / 26,5    | —             | —                     | —    | 7,0 + 7,0   | oštrenje RP 2 × 2000 m; trka van obima |

## d5-14w-55km-v50-A-sun — 5 dana (55 km, VDOT 50, 14 ned)

VDOT 50,0, RP 4:20/km, prognoza 1:31:31; vrh 75,0 km (granica 75,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1            | Q2                    | dugi | lagani             | napomena                               |
| --- | ------ | -------------- | ------------- | --------------------- | ---- | ------------------ | -------------------------------------- |
| 1   | baza   | 55,0 / 55,0    | R 8 × 200 m   | T 3,0 km kontinuirano | 17,6 | 9,2 + 9,2          |                                        |
| 2   | baza   | 58,3 / 58,3    | R 6 × 300 m   | T 4,0 km kontinuirano | 18,6 | 9,7 + 9,7          |                                        |
| 3   | baza   | 61,8 / 61,8    | R 10 × 200 m  | T 5,0 km kontinuirano | 19,7 | 10,2 + 10,1        |                                        |
| 4   | baza   | 49,4 / 49,4    | —             | T 3,0 km kontinuirano | 15,7 | 8,1 + 8,1 + 8,0    | rasterećenje                           |
| 5   | razvoj | 65,5 / 65,5    | I 3 × 1000 m  | T 4 × 1500 m          | 20,9 | 10,3 + 10,3        |                                        |
| 6   | razvoj | 69,4 / 69,4    | I 4 × 1000 m  | T 4 × 1600 m          | 22,2 | 10,6 + 10,5        |                                        |
| 7   | razvoj | 73,4 / 73,4    | I 4 × 1200 m  | T 2 × 3200 m          | 23,4 | 11,7 + 11,6        |                                        |
| 8   | razvoj | 58,7 / 58,7    | —             | T 2 × 1600 m          | 18,7 | 10,1 + 10,0 + 10,0 | rasterećenje                           |
| 9   | spec.  | 75,0 / 75,0    | RP 2 × 3000 m | T 6,4 km kontinuirano | 24,0 | 12,7 + 12,6        |                                        |
| 10  | spec.  | 75,0 / 75,0    | RP 2 × 4000 m | T 2 × 3200 m          | 24,0 | 11,5 + 11,4        |                                        |
| 11  | spec.  | 60,0 / 60,0    | —             | T 2 × 1600 m          | 19,2 | 10,3 + 10,3 + 10,3 | rasterećenje                           |
| 12  | spec.  | 75,0 / 75,0    | RP 3 × 3000 m | T 6,4 km kontinuirano | 24,0 | 11,0 + 11,0        |                                        |
| 13  | taper  | 52,5 / 52,5    | RP 2 × 2500 m | T 2 × 1600 m          | 14,4 | 8,2 + 8,2          |                                        |
| 14  | trka   | 28,3 / 28,3    | —             | —                     | —    | 6,5 + 6,5          | oštrenje RP 2 × 2000 m; trka van obima |

## d6-18w-90km-v60-B-sun — 6 dana, veliki obim (90 km, VDOT 60, 18 ned)

VDOT 60,0, RP 3:42/km, prognoza 1:18:09; vrh 100,0 km (granica 100,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1            | Q2                    | dugi | lagani                    | napomena                               |
| --- | ------ | -------------- | ------------- | --------------------- | ---- | ------------------------- | -------------------------------------- |
| 1   | baza   | 90,0 / 90,0    | R 8 × 300 m   | T 5,0 km kontinuirano | 24,0 | 13,1 + 13,1 + 13,1        |                                        |
| 2   | baza   | 94,0 / 94,0    | R 8 × 400 m   | T 6,0 km kontinuirano | 24,0 | 13,6 + 13,6 + 13,6        |                                        |
| 3   | baza   | 98,0 / 98,0    | R 16 × 200 m  | T 7,0 km kontinuirano | 24,0 | 14,6 + 14,5 + 14,5        |                                        |
| 4   | baza   | 78,4 / 78,4    | —             | T 4,0 km kontinuirano | 19,2 | 11,7 + 11,7 + 11,6 + 11,6 | rasterećenje                           |
| 5   | baza   | 100,0 / 100,0  | R 8 × 400 m   | T 2 × 3500 m          | 24,0 | 15,2 + 15,1 + 15,1        |                                        |
| 6   | baza   | 100,0 / 100,0  | R 16 × 200 m  | T 7,0 km kontinuirano | 24,0 | 15,2 + 15,2 + 15,2        |                                        |
| 7   | razvoj | 100,0 / 100,0  | I 4 × 1200 m  | T 5 × 1600 m          | 24,0 | 14,2 + 14,2 + 14,1        |                                        |
| 8   | razvoj | 80,0 / 80,0    | —             | T 3 × 1600 m          | 19,2 | 11,8 + 11,7 + 11,7 + 11,7 | rasterećenje                           |
| 9   | razvoj | 100,0 / 100,0  | I 5 × 1000 m  | T 3 × 3000 m          | 24,0 | 13,8 + 13,8 + 13,7        |                                        |
| 10  | razvoj | 100,0 / 100,0  | I 5 × 1200 m  | T 2 × 4500 m          | 24,0 | 13,4 + 13,3 + 13,3        |                                        |
| 11  | razvoj | 100,0 / 100,0  | I 6 × 1000 m  | T 9,0 km kontinuirano | 24,0 | 13,5 + 13,4 + 13,4        |                                        |
| 12  | spec.  | 100,0 / 100,0  | RP 3 × 3000 m | T 2 × 4500 m          | 24,0 | 13,3 + 13,3 + 13,2        |                                        |
| 13  | spec.  | 80,0 / 80,0    | —             | T 3 × 1600 m          | 19,2 | 11,8 + 11,7 + 11,7 + 11,7 | rasterećenje                           |
| 14  | spec.  | 100,0 / 100,0  | RP 2 × 5000 m | T 9,0 km kontinuirano | 24,0 | 13,1 + 13,1 + 13,1        |                                        |
| 15  | spec.  | 100,0 / 100,0  | RP 3 × 4000 m | T 2 × 4500 m          | 24,0 | 12,2 + 12,2 + 12,2        |                                        |
| 16  | spec.  | 100,0 / 100,0  | RP 4 × 3000 m | T 9,0 km kontinuirano | 24,0 | 12,3 + 12,3 + 12,2        |                                        |
| 17  | taper  | 70,0 / 70,0    | RP 2 × 3000 m | T 3 × 1600 m          | 14,4 | 9,0 + 8,9 + 8,9           |                                        |
| 18  | trka   | 33,1 / 33,1    | —             | —                     | —    | 7,5 + 7,5                 | oštrenje RP 2 × 2000 m; trka van obima |

## r-d4-12w-40km-v45-r10 — 4 dana sa skorašnjim najdužim 10 km (pouka 28)

VDOT 45,0, RP 4:45/km, prognoza 1:40:14; vrh 56,0 km (granica 56,0); upozorenja: WEEK_FITTED, CAPACITY_LIMITED.

| ned | faza   | cilj / plan km | Q1            | Q2                    | dugi | lagani    | napomena                               |
| --- | ------ | -------------- | ------------- | --------------------- | ---- | --------- | -------------------------------------- |
| 1   | baza   | 38,2 / 38,2    | R 6 × 200 m   | T 2,0 km kontinuirano | 11,0 | 11,0      | izvodljiv (pravilo 40,0)               |
| 2   | baza   | 40,5 / 40,5    | R 8 × 200 m   | T 2,5 km kontinuirano | 16,2 | 6,8       |                                        |
| 3   | baza   | 42,9 / 42,9    | R 6 × 300 m   | T 3,0 km kontinuirano | 17,1 | 7,5       |                                        |
| 4   | razvoj | 45,5 / 45,5    | I 2 × 1000 m  | T 3 × 1000 m          | 18,2 | 9,3       |                                        |
| 5   | razvoj | 36,4 / 36,5    | —             | T 2 × 1000 m          | 14,5 | 6,9 + 6,9 | rasterećenje                           |
| 6   | razvoj | 48,2 / 48,3    | I 3 × 800 m   | T 2 × 1600 m          | 19,2 | 10,2      |                                        |
| 7   | spec.  | 51,1 / 51,1    | RP 2 × 2000 m | T 4 × 1000 m          | 20,4 | 10,0      |                                        |
| 8   | spec.  | 54,2 / 54,2    | RP 2 × 2500 m | T 3 × 1600 m          | 21,6 | 10,2      |                                        |
| 9   | spec.  | 43,4 / 43,5    | —             | T 2 × 1200 m          | 17,2 | 8,9 + 8,8 | rasterećenje                           |
| 10  | spec.  | 56,0 / 56,0    | RP 2 × 3000 m | T 2 × 2400 m          | 22,4 | 10,3      |                                        |
| 11  | taper  | 39,2 / 39,2    | RP 2 × 2000 m | T 2 × 1200 m          | 13,4 | 7,0       |                                        |
| 12  | trka   | 20,3 / 20,3    | —             | —                     | —    | 6,0       | oštrenje RP 2 × 2000 m; trka van obima |
