# HM v2 Segment 01 — primeri (hm-v2.0.0)

Izvor: `node docs/hm-v2/artifacts/segment-01/run.ts` (ulazi iz mreže 01, `testInputs.ts`).

## 10w-30km-v45-A-sun — mali obim (30 km, VDOT 45, 10 ned)

VDOT 45,0, RP 4:45/km, prognoza 1:40:14; vrh 42,0 km (granica 42,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1            | Q2                    | dugi | lagan     | napomena                               |
| --- | ------ | -------------- | ------------- | --------------------- | ---- | --------- | -------------------------------------- |
| 1   | baza   | 30,0 / 30,0    | R 6 × 200 m   | T 2,0 km kontinuirano | 12,0 | 5,3       |                                        |
| 2   | baza   | 31,8 / 31,8    | R 4 × 300 m   | T 2,5 km kontinuirano | 12,7 | 6,0       |                                        |
| 3   | baza   | 33,7 / 33,7    | R 8 × 200 m   | T 3,0 km kontinuirano | 13,4 | 5,8       |                                        |
| 4   | razvoj | 35,7 / 35,7    | I 2 × 1000 m  | T 3 × 1000 m          | 14,2 | 6,9       |                                        |
| 5   | razvoj | 28,6 / 28,6    | —             | T 2 × 1000 m          | 11,3 | 5,5 + 5,4 | rasterećenje                           |
| 6   | spec.  | 37,8 / 37,8    | RP 2 × 2000 m | T 2 × 1600 m          | 15,1 | 6,5       |                                        |
| 7   | spec.  | 40,1 / 40,1    | RP 2 × 2500 m | T 4 × 1000 m          | 16,0 | 5,8       |                                        |
| 8   | spec.  | 42,0 / 42,0    | RP 2 × 3000 m | T 2 × 2000 m          | 16,8 | 6,1       |                                        |
| 9   | taper  | 29,4 / 29,4    | RP 2 × 2000 m | T 2 × 1200 m          | 10,0 | 4,0       |                                        |
| 10  | trka   | 16,6 / 16,6    | —             | —                     | —    | 4,0       | oštrenje RP 2 × 2000 m; trka van obima |

## 18w-60km-v55-B-sun — veliki obim (60 km, VDOT 55, 18 ned)

VDOT 55,0, RP 4:00/km, prognoza 1:24:16; vrh 70,0 km (granica 70,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1            | Q2                    | dugi | lagan       | napomena                               |
| --- | ------ | -------------- | ------------- | --------------------- | ---- | ----------- | -------------------------------------- |
| 1   | baza   | 60,0 / 60,0    | R 6 × 300 m   | T 3,0 km kontinuirano | 24,0 | 13,6        |                                        |
| 2   | baza   | 63,6 / 63,6    | R 10 × 200 m  | T 4,0 km kontinuirano | 25,4 | 14,3        |                                        |
| 3   | baza   | 67,4 / 67,4    | R 8 × 300 m   | T 5,0 km kontinuirano | 26,9 | 14,9        |                                        |
| 4   | baza   | 53,9 / 54,0    | —             | T 3,0 km kontinuirano | 21,5 | 10,7 + 10,7 | rasterećenje                           |
| 5   | baza   | 70,0 / 70,0    | R 8 × 400 m   | T 6,0 km kontinuirano | 28,0 | 13,9        |                                        |
| 6   | baza   | 70,0 / 70,0    | R 16 × 200 m  | T 7,0 km kontinuirano | 28,0 | 12,7        |                                        |
| 7   | razvoj | 70,0 / 70,0    | I 3 × 1000 m  | T 2 × 3500 m          | 28,0 | 14,2        |                                        |
| 8   | razvoj | 56,0 / 56,0    | —             | T 4 × 1000 m          | 22,4 | 10,5 + 10,5 | rasterećenje                           |
| 9   | razvoj | 70,0 / 70,0    | I 4 × 1000 m  | T 7,0 km kontinuirano | 28,0 | 12,8        |                                        |
| 10  | razvoj | 70,0 / 70,0    | I 4 × 1200 m  | T 2 × 3500 m          | 28,0 | 11,4        |                                        |
| 11  | razvoj | 70,0 / 70,0    | I 5 × 1000 m  | T 7,0 km kontinuirano | 28,0 | 11,1        |                                        |
| 12  | spec.  | 70,0 / 70,0    | RP 2 × 3000 m | T 2 × 3500 m          | 28,0 | 12,3        |                                        |
| 13  | spec.  | 56,0 / 56,0    | —             | T 4 × 1000 m          | 22,4 | 10,5 + 10,5 | rasterećenje                           |
| 14  | spec.  | 70,0 / 70,0    | RP 2 × 4000 m | T 7,0 km kontinuirano | 28,0 | 10,5        |                                        |
| 15  | spec.  | 70,0 / 70,0    | RP 3 × 3000 m | T 2 × 3500 m          | 28,0 | 9,0         |                                        |
| 16  | spec.  | 70,0 / 70,0    | RP 2 × 5000 m | T 7,0 km kontinuirano | 28,0 | 8,5         |                                        |
| 17  | taper  | 49,0 / 49,0    | RP 2 × 3000 m | T 4 × 1000 m          | 16,8 | 5,2         |                                        |
| 18  | trka   | 22,9 / 22,9    | —             | —                     | —    | 5,2 + 5,2   | oštrenje RP 2 × 2000 m; trka van obima |

## 16w-50km-v30-C-sat — spor trkač (50 km, VDOT 30, 16 ned, trka sub)

VDOT 30,0, RP 6:42/km, prognoza 2:21:17; vrh 57,8 km (granica 70,0); upozorenja: WEEK_FITTED, CAPACITY_LIMITED.

| ned | faza   | cilj / plan km | Q1            | Q2                    | dugi | lagan       | napomena                               |
| --- | ------ | -------------- | ------------- | --------------------- | ---- | ----------- | -------------------------------------- |
| 1   | baza   | 49,0 / 49,0    | R 6 × 200 m   | T 2,5 km kontinuirano | 17,8 | 17,8        | izvodljiv (pravilo 50,0)               |
| 2   | baza   | 50,3 / 50,3    | R 8 × 200 m   | T 3,0 km kontinuirano | 17,8 | 17,8        | izvodljiv (pravilo 51,9)               |
| 3   | baza   | 51,6 / 51,6    | R 6 × 300 m   | T 4,0 km kontinuirano | 17,8 | 17,8        | izvodljiv (pravilo 53,3)               |
| 4   | baza   | 41,3 / 41,3    | —             | T 2,0 km kontinuirano | 14,2 | 10,4 + 10,3 | rasterećenje                           |
| 5   | baza   | 53,1 / 53,1    | R 10 × 200 m  | T 5,0 km kontinuirano | 17,8 | 17,8        | izvodljiv (pravilo 54,7)               |
| 6   | razvoj | 52,9 / 52,9    | I 3 × 800 m   | T 2 × 2500 m          | 17,8 | 17,8        | izvodljiv (pravilo 56,3)               |
| 7   | razvoj | 53,3 / 53,3    | I 3 × 1000 m  | T 5,0 km kontinuirano | 17,8 | 17,8        | izvodljiv (pravilo 56,1)               |
| 8   | razvoj | 42,6 / 42,6    | —             | T 3 × 1000 m          | 14,2 | 10,4 + 10,4 | rasterećenje                           |
| 9   | razvoj | 55,0 / 55,0    | I 4 × 1000 m  | T 2 × 2500 m          | 17,8 | 17,8        | izvodljiv (pravilo 56,5)               |
| 10  | spec.  | 53,5 / 53,5    | RP 2 × 2000 m | T 5,0 km kontinuirano | 17,8 | 17,8        | izvodljiv (pravilo 58,3)               |
| 11  | spec.  | 54,7 / 54,7    | RP 2 × 2500 m | T 2 × 2500 m          | 17,8 | 17,8        | izvodljiv (pravilo 56,7)               |
| 12  | spec.  | 43,8 / 43,8    | —             | T 3 × 1000 m          | 14,2 | 11,0 + 11,0 | rasterećenje                           |
| 13  | spec.  | 55,5 / 55,5    | RP 2 × 3000 m | T 5,0 km kontinuirano | 17,8 | 17,8        | izvodljiv (pravilo 58,0)               |
| 14  | spec.  | 57,8 / 57,8    | RP 2 × 4000 m | T 2 × 2500 m          | 17,8 | 17,8        | izvodljiv (pravilo 58,8)               |
| 15  | taper  | 37,3 / 37,4    | RP 2 × 2000 m | T 3 × 1000 m          | 10,6 | 10,6        | izvodljiv (pravilo 40,5)               |
| 16  | trka   | 17,4 / 17,4    | —             | —                     | —    | 4,4 + 4,4   | oštrenje RP 2 × 2000 m; trka van obima |

## 12w-30km-v70-A-sun — brz trkač (30 km, VDOT 70, 12 ned)

VDOT 70,0, RP 3:14/km, prognoza 1:08:23; vrh 42,0 km (granica 42,0); upozorenja: —.

| ned | faza   | cilj / plan km | Q1            | Q2                    | dugi | lagan     | napomena                               |
| --- | ------ | -------------- | ------------- | --------------------- | ---- | --------- | -------------------------------------- |
| 1   | baza   | 30,0 / 30,0    | R 6 × 200 m   | T 2,0 km kontinuirano | 9,6  | 4,0       |                                        |
| 2   | baza   | 31,8 / 31,8    | R 4 × 300 m   | T 2,5 km kontinuirano | 11,0 | 4,0       |                                        |
| 3   | baza   | 33,7 / 33,7    | R 8 × 200 m   | T 3,0 km kontinuirano | 11,5 | 4,0       |                                        |
| 4   | razvoj | 35,7 / 35,8    | I 2 × 1000 m  | T 3 × 1000 m          | 13,3 | 4,1       |                                        |
| 5   | razvoj | 28,6 / 28,6    | —             | T 2 × 1000 m          | 10,6 | 4,9 + 4,8 | rasterećenje                           |
| 6   | razvoj | 37,8 / 37,8    | I 3 × 800 m   | T 2 × 1600 m          | 14,6 | 4,1       |                                        |
| 7   | spec.  | 40,1 / 40,1    | RP 2 × 2000 m | T 4 × 1000 m          | 14,8 | 4,0       |                                        |
| 8   | spec.  | 42,0 / 42,0    | RP 2 × 2500 m | T 2 × 2000 m          | 16,0 | 4,1       |                                        |
| 9   | spec.  | 33,6 / 33,6    | —             | T 2 × 1200 m          | 12,8 | 6,1 + 6,0 | rasterećenje                           |
| 10  | spec.  | 42,0 / 42,0    | RP 2 × 3000 m | T 4 × 1000 m          | 14,7 | 4,0       |                                        |
| 11  | taper  | 29,4 / 29,4    | RP 2 × 2000 m | T 2 × 1200 m          | 6,1  | 4,1       |                                        |
| 12  | trka   | 20,4 / 20,4    | —             | —                     | —    | 4,1       | oštrenje RP 2 × 2000 m; trka van obima |
