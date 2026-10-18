# 10K v2 — primeri segmenta 04 (10k-v2.4.0): adaptacija

Generisano: `node docs/10k-v2/artifacts/segment-04/run.ts`. Start 2026-11-02 (ponedeljak), trka u nedelju. Plan pre = generateTenKV2(ulaz) (lanac: plan posle prethodnog koraka); plan posle = adaptTenKV2(plan, činjenice, asOf). Cilj = cilj nedelje (planirano u zagradi kad se razlikuje: dani bola/odmora, mešovita nedelja sa zadržanim danima do asOf). „(isto)“ = nedelja bajt-ista. Kvalitet bez WU/CD i oporavka.

## d4-rezultat-14w-pauza20

4 dana, 14 ned, VDOT 45, 35 km — prijavljena pauza 20 dana (bez zapisa i coverage), asOf kraj ned 7

### Korak 1: asOf 2026-12-20

- Tempo: rezultat, VDOT 45,0, prognoza 10K 45:13; cilj: —
- Koraci u planu: 1; mešovite nedelje: nema; promena (changes): 39
- Upozorenja: DOSE_DROPPED

Reasons:

- `PAUSE` (primenjeno): Pauza (prijavljena) 20 dana (obim 7 dana pre pauze 41,7 km): cilj 29,2 km; prva nedelja bez kvaliteta, druga 1 kvalitet (A3). Povratak do 39,3 km (nivo pre smanjenja) po +10 %/ned (min 1,0 km), osim tapera i trkačke nedelje (A8).

| ned | faza       | cilj pre → posle (planirano) | kvalitet pre → posle                                                 | dugi pre → posle | ograničenje                 |
| --- | ---------- | ---------------------------- | -------------------------------------------------------------------- | ---------------- | --------------------------- |
| 1   | baza       | 35,0 (isto)                  | R 6 × 200 m + T 2,0 km kontinuirano                                  | 11,5             | —                           |
| 2   | baza       | 37,1 (isto)                  | R 8 × 200 m + T 2,5 km kontinuirano                                  | 12,2             | —                           |
| 3   | baza       | 39,3 (isto)                  | R 6 × 300 m + T 3,0 km kontinuirano                                  | 12,9             | —                           |
| 4   | baza       | 31,4 (isto)                  | T 2,0 km kontinuirano                                                | 10,3             | rasterećenje                |
| 5   | razvoj     | 41,7 (isto)                  | I 2 × 1000 m + T 3 × 1000 m                                          | 13,7             | —                           |
| 6   | razvoj     | 44,2 (isto)                  | I 3 × 800 m + T 3 × 1200 m                                           | 14,5             | —                           |
| 7   | razvoj     | 46,9 (isto)                  | I 3 × 1000 m + T 4 × 1000 m                                          | 15,4             | —                           |
| 8   | razvoj     | 37,5 → 29,2 (29,2)           | T 2 × 1200 m → —                                                     | 12,3 → 9,6       | rasterećenje, bez kvaliteta |
| 9   | specifično | 49,0 → 32,1 (32,1)           | RP 3 × 1000 m + T 3 × 1600 m → T 2 × 1200 m                          | 16,1 → 10,5      | 1 kvalitet                  |
| 10  | specifično | 49,0 → 35,3 (35,3)           | RP 4 × 1000 m + T 2 × 2400 m → RP 3 × 1000 m + T 3 × 1000 m          | 16,1 → 11,6      | —                           |
| 11  | specifično | 39,2 → 28,2 (28,3)           | T 2 × 1200 m → T 2 × 1000 m                                          | 12,8 → 9,2       | rasterećenje                |
| 12  | specifično | 49,0 → 38,8 (38,8)           | RP 3 × 1500 m + T 4,8 km kontinuirano → RP 2 × 1500 m + T 3 × 1200 m | 16,1 → 12,8      | —                           |
| 13  | taper      | 36,8 → 29,1 (29,1)           | RP 2 × 1200 m + T 2 × 1200 m → RP 2 × 1000 m + T 2 × 1000 m          | 12,0 → 9,6       | —                           |
| 14  | trka       | 18,2 → 15,4 (15,4)           | RP 2 × 1000 m → RP 2 × 1000 m                                        | — → —            | —                           |

## d5-rezultat-16w-manjak-lanac

5 dana, 16 ned, VDOT 45, 45 km — manjak 50 % (pokriveno) na kraju ned 5, pa nedelju kasnije opet manjak (lanac, 2 koraka)

### Korak 1: asOf 2026-12-06

- Tempo: rezultat, VDOT 45,0, prognoza 10K 45:13; cilj: —
- Koraci u planu: 1; mešovite nedelje: nema; promena (changes): 49
- Upozorenja: nema

Reasons:

- `UNDER_EXECUTION` (primenjeno): Izvršeno 26,8 od 53,6 km u 7 dana (< 60 %): nedelja 6 ne raste, cilj 45,3 km (A2). Povratak do 50,6 km (nivo pre smanjenja) po +10 %/ned (min 1,0 km), osim tapera i trkačke nedelje (A8).

| ned | faza       | cilj pre → posle (planirano) | kvalitet pre → posle                                                 | dugi pre → posle | ograničenje  |
| --- | ---------- | ---------------------------- | -------------------------------------------------------------------- | ---------------- | ------------ |
| 1   | baza       | 45,0 (isto)                  | R 6 × 200 m + T 2,5 km kontinuirano                                  | 13,5             | —            |
| 2   | baza       | 47,7 (isto)                  | R 8 × 200 m + T 3,0 km kontinuirano                                  | 14,3             | —            |
| 3   | baza       | 50,6 (isto)                  | R 6 × 300 m + T 3,5 km kontinuirano                                  | 15,1             | —            |
| 4   | baza       | 40,5 (isto)                  | T 2,0 km kontinuirano                                                | 12,0             | rasterećenje |
| 5   | baza       | 53,6 (isto)                  | R 10 × 200 m + T 4,0 km kontinuirano                                 | 16,0             | —            |
| 6   | razvoj     | 56,6 → 45,3 (45,4)           | I 3 × 800 m + T 4 × 1000 m → I 2 × 1000 m + T 4 × 1000 m             | 16,9 → 13,5      | —            |
| 7   | razvoj     | 59,6 → 49,8 (49,8)           | I 3 × 1000 m + T 3 × 1600 m → I 3 × 800 m + T 3 × 1600 m             | 17,1 → 14,9      | —            |
| 8   | razvoj     | 47,7 → 39,8 (39,8)           | T 2 × 1200 m → T 2 × 1200 m                                          | 13,6 → 11,9      | rasterećenje |
| 9   | razvoj     | 60,0 → 52,8 (52,8)           | I 3 × 1200 m + T 5 × 1000 m → I 3 × 1000 m + T 5 × 1000 m            | 17,1 → 15,8      | —            |
| 10  | razvoj     | 60,0 → 55,8 (55,8)           | I 4 × 1000 m + T 4 × 1500 m → I 3 × 1200 m + T 2 × 2500 m            | 17,1 → 16,7      | —            |
| 11  | specifično | 60,0 → 58,8 (58,8)           | RP 4 × 1000 m + T 3 × 2000 m → RP 4 × 1000 m + T 5,0 km kontinuirano | 17,1 → 17,1      | —            |
| 12  | specifično | 48,0 → 47,0 (47,0)           | T 3 × 1200 m → T 3 × 1000 m                                          | 13,6 → 13,6      | rasterećenje |
| 13  | specifično | 60,0 → 60,0 (60,0)           | RP 3 × 1500 m + T 2 × 3000 m → RP 3 × 1500 m + T 4 × 1500 m          | 17,1 → 17,1      | —            |
| 14  | specifično | 60,0 → 60,0 (60,0)           | RP 5 × 1000 m + T 6,0 km kontinuirano → RP 5 × 1000 m + T 3 × 2000 m | 17,1 → 17,1      | —            |
| 15  | taper      | 45,0 (isto)                  | RP 3 × 1000 m + T 3 × 1200 m                                         | 12,8             | —            |
| 16  | trka       | 25,5 (isto)                  | RP 3 × 1000 m                                                        | —                | —            |

### Korak 2: asOf 2026-12-13

- Tempo: rezultat, VDOT 45,0, prognoza 10K 45:13; cilj: —
- Koraci u planu: 2; mešovite nedelje: nema; promena (changes): 52
- Upozorenja: DOSE_DROPPED

Reasons:

- `UNDER_EXECUTION` (primenjeno): Izvršeno 22,7 od 45,4 km u 7 dana (< 60 %): nedelja 7 ne raste, cilj 39,8 km (A2). Povratak do 53,6 km (nivo pre smanjenja) po +10 %/ned (min 1,0 km), osim tapera i trkačke nedelje (A8).

| ned | faza       | cilj pre → posle (planirano) | kvalitet pre → posle                                                 | dugi pre → posle | ograničenje  |
| --- | ---------- | ---------------------------- | -------------------------------------------------------------------- | ---------------- | ------------ |
| 1   | baza       | 45,0 (isto)                  | R 6 × 200 m + T 2,5 km kontinuirano                                  | 13,5             | —            |
| 2   | baza       | 47,7 (isto)                  | R 8 × 200 m + T 3,0 km kontinuirano                                  | 14,3             | —            |
| 3   | baza       | 50,6 (isto)                  | R 6 × 300 m + T 3,5 km kontinuirano                                  | 15,1             | —            |
| 4   | baza       | 40,5 (isto)                  | T 2,0 km kontinuirano                                                | 12,0             | rasterećenje |
| 5   | baza       | 53,6 (isto)                  | R 10 × 200 m + T 4,0 km kontinuirano                                 | 16,0             | —            |
| 6   | razvoj     | 45,3 (isto)                  | I 2 × 1000 m + T 4 × 1000 m                                          | 13,5             | —            |
| 7   | razvoj     | 49,8 → 39,8 (39,8)           | I 3 × 800 m + T 3 × 1600 m → I 3 × 800 m + T 3 × 1200 m              | 14,9 → 11,9      | —            |
| 8   | razvoj     | 39,8 → 31,8 (31,8)           | T 2 × 1200 m → T 2 × 1000 m                                          | 11,9 → 9,5       | rasterećenje |
| 9   | razvoj     | 52,8 → 43,8 (43,8)           | I 3 × 1000 m + T 5 × 1000 m → I 3 × 1000 m + T 4 × 1000 m            | 15,8 → 13,1      | —            |
| 10  | razvoj     | 55,8 → 48,2 (48,2)           | I 3 × 1200 m + T 2 × 2500 m → I 3 × 1200 m + T 3 × 1600 m            | 16,7 → 14,4      | —            |
| 11  | specifično | 58,8 → 53,0 (53,0)           | RP 4 × 1000 m + T 5,0 km kontinuirano → RP 4 × 1000 m + T 5 × 1000 m | 17,1 → 15,9      | —            |
| 12  | specifično | 47,0 → 42,4 (42,4)           | T 3 × 1000 m → T 3 × 1000 m                                          | 13,6 → 12,7      | rasterećenje |
| 13  | specifično | 60,0 → 56,0 (56,0)           | RP 3 × 1500 m + T 4 × 1500 m → RP 3 × 1500 m + T 2 × 2500 m          | 17,1 → 16,8      | —            |
| 14  | specifično | 60,0 → 59,0 (59,0)           | RP 5 × 1000 m + T 3 × 2000 m → RP 5 × 1000 m + T 5,0 km kontinuirano | 17,1 → 17,1      | —            |
| 15  | taper      | 45,0 → 44,3 (44,3)           | RP 3 × 1000 m + T 3 × 1200 m → RP 3 × 1000 m + T 3 × 1000 m          | 12,8 → 12,8      | —            |
| 16  | trka       | 25,5 (isto)                  | RP 3 × 1000 m                                                        | —                | —            |

## d3-osecaj-12w-test5km

3 dana, 12 ned, po osećaju lagan 6:00, 25 km — test 5 km 24:30 u ned 4 (asOf kraj ned 4)

### Korak 1: asOf 2026-11-29

- Tempo: rezultat, VDOT 39,2, prognoza 10K 50:53 (bilo: po osećaju); cilj: —
- Koraci u planu: 1; mešovite nedelje: nema; promena (changes): 23
- Upozorenja: nema

Reasons:

- `NEW_RESULT` (primenjeno): Test 5 km 24:30 (2026-11-26): VDOT 39,2 od nedelje 5 — plan po osećaju prelazi na tempo iz rezultata; obim po pravilu D6, doza se nastavlja (A1).

| ned | faza       | cilj pre → posle (planirano) | kvalitet pre → posle                          | dugi pre → posle | ograničenje        |
| --- | ---------- | ---------------------------- | --------------------------------------------- | ---------------- | ------------------ |
| 1   | baza       | 25,0 (isto)                  | T 2,0 km kontinuirano                         | 11,2             | —                  |
| 2   | baza       | 26,5 (isto)                  | T 2,5 km kontinuirano                         | 11,9             | —                  |
| 3   | baza       | 28,1 (isto)                  | T 2 × 1250 m                                  | 12,6             | —                  |
| 4   | baza       | 22,5 (isto)                  | test 5 km                                     | 10,0             | rasterećenje, test |
| 5   | razvoj     | 29,8 → 29,8 (29,8)           | T 2,5 km kontinuirano → T 2,5 km kontinuirano | 13,4 → 13,4      | —                  |
| 6   | razvoj     | 31,6 → 31,6 (31,6)           | T 3 × 1000 m → T 3 × 1000 m                   | 14,2 → 14,2      | —                  |
| 7   | razvoj     | 33,5 → 33,5 (33,5)           | T 2 × 1500 m → T 2 × 1500 m                   | 15,0 → 15,0      | —                  |
| 8   | specifično | 35,0 → 35,0 (35,0)           | RP 3 × 1000 m → RP 3 × 1000 m                 | 15,7 → 15,3      | —                  |
| 9   | specifično | 28,0 → 28,0 (28,0)           | T 2 × 1000 m → T 2 × 1000 m                   | 12,5 → 12,2      | rasterećenje       |
| 10  | specifično | 35,0 → 35,0 (35,0)           | RP 2 × 1500 m → RP 2 × 1500 m                 | 15,7 → 15,3      | —                  |
| 11  | taper      | 26,3 → 26,3 (26,3)           | RP 2 × 1000 m → RP 2 × 1000 m                 | 11,7 → 11,4      | —                  |
| 12  | trka       | 12,3 → 11,4 (11,4)           | RP 2 × 1000 m → RP 2 × 1000 m                 | — → —            | —                  |

## d6-rezultat-18w-bol8

6 dana, 18 ned, VDOT 45, 55 km — bol 8/10 u sredu ned 9 (asOf sreda ned 9)

### Korak 1: asOf 2026-12-30

- Tempo: rezultat, VDOT 45,0, prognoza 10K 45:13; cilj: —
- Koraci u planu: 1; mešovite nedelje: 9; promena (changes): 53
- Upozorenja: PLANNED_BELOW_TARGET_LIMITS

Reasons:

- `PAIN` (primenjeno): Bol 8/10 u poslednja 3 dana: 3 dana odmora (do 2027-01-02), pa 7 dana bez kvaliteta i ubrzanja (2027-01-03 – 2027-01-09). Bol: 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled (A4). Posle nedelje 10 rast kreće od 70 % njenog cilja. Povratak do 70,0 km (nivo pre smanjenja) po +10 %/ned (min 1,0 km), osim tapera i trkačke nedelje (A8).

| ned | faza       | cilj pre → posle (planirano) | kvalitet pre → posle                                                          | dugi pre → posle | ograničenje                              |
| --- | ---------- | ---------------------------- | ----------------------------------------------------------------------------- | ---------------- | ---------------------------------------- |
| 1   | baza       | 55,0 (isto)                  | R 8 × 200 m + T 3,0 km kontinuirano                                           | 14,8             | —                                        |
| 2   | baza       | 58,0 (isto)                  | R 6 × 300 m + T 3,5 km kontinuirano                                           | 15,6             | —                                        |
| 3   | baza       | 61,0 (isto)                  | R 10 × 200 m + T 4,0 km kontinuirano                                          | 16,4             | —                                        |
| 4   | baza       | 48,8 (isto)                  | T 2,0 km kontinuirano                                                         | 13,1             | rasterećenje                             |
| 5   | baza       | 64,0 (isto)                  | R 8 × 300 m + T 4,5 km kontinuirano                                           | 17,1             | —                                        |
| 6   | baza       | 67,0 (isto)                  | R 6 × 400 m + T 5,0 km kontinuirano                                           | 17,1             | —                                        |
| 7   | razvoj     | 70,0 (isto)                  | I 3 × 1000 m + T 5 × 1000 m                                                   | 17,1             | —                                        |
| 8   | razvoj     | 56,0 (isto)                  | T 3 × 1000 m                                                                  | 13,6             | rasterećenje                             |
| 9   | razvoj     | 70,0 → 70,0 (40,1)           | I 3 × 1200 m + T 4 × 1500 m → I 3 × 1200 m                                    | 17,1 → 9,7       | 1 kvalitet, odmor 2 d, bol 1 d, mešovita |
| 10  | razvoj     | 70,0 → 70,0 (54,0)           | I 4 × 1000 m + T 4 × 1600 m → —                                               | 17,1 → 17,1      | bez kvaliteta, bol 5 d                   |
| 11  | razvoj     | 70,0 → 53,9 (53,9)           | I 4 × 1200 m + T 2 × 3200 m → I 3 × 1200 m + T 2 × 2500 m                     | 17,1 → 14,5      | —                                        |
| 12  | razvoj     | 56,0 → 43,1 (43,1)           | T 3 × 1200 m → T 3 × 1000 m                                                   | 13,6 → 11,6      | rasterećenje                             |
| 13  | specifično | 70,0 → 59,3 (59,3)           | RP 5 × 1000 m + T 6,4 km kontinuirano → RP 4 × 1000 m + T 5,0 km kontinuirano | 17,1 → 16,0      | —                                        |
| 14  | specifično | 70,0 → 65,2 (65,2)           | RP 3 × 2000 m + T 2 × 3200 m → RP 3 × 1500 m + T 4 × 1500 m                   | 17,1 → 17,1      | —                                        |
| 15  | specifično | 56,0 → 52,2 (52,2)           | T 3 × 1200 m → T 3 × 1200 m                                                   | 13,6 → 13,6      | rasterećenje                             |
| 16  | specifično | 70,0 → 70,0 (70,0)           | RP 5 × 1200 m + T 6,4 km kontinuirano → RP 5 × 1000 m + T 4 × 1600 m          | 17,1 → 17,1      | —                                        |
| 17  | taper      | 52,5 (isto)                  | RP 3 × 1000 m + T 3 × 1200 m                                                  | 12,8             | —                                        |
| 18  | trka       | 26,3 (isto)                  | RP 3 × 1000 m                                                                 | —                | —                                        |

## pocetnik-d4-12w-pauza35

početnik 4 dana, 12 ned, VDOT 35, 25 km — pauza 35 dana (pokriveno), asOf kraj ned 5: nov start, < 8 ned do trke → orijentir

### Korak 1: asOf 2026-12-06

- Tempo: rezultat, VDOT 35,0, prognoza 10K 56:02; cilj: orientation
- Koraci u planu: 1; mešovite nedelje: nema; promena (changes): 44
- Upozorenja: LONG_SHORTER_THAN_QUALITY, DELOAD_NO_QUALITY, ADAPT_DELOAD_LONG, TAPER_NO_QUALITY

Reasons:

- `PAUSE` (primenjeno): Pauza 35 dana (obim 7 dana pre pauze 25,2 km): cilj 12,6 km; prva nedelja bez kvaliteta, druga 1 kvalitet; nov start (faze preostale izgradnje ponovo, vrh od novog starta) (A3). Cilj je orijentir: posle duge pauze do trke ostaje manje od 8 nedelja, priprema nije potpuna (A3). Povratak do 25,0 km (nivo pre smanjenja) po +10 %/ned (min 1,0 km), osim tapera i trkačke nedelje (A8).
- `UNDER_EXECUTION` (nije primenjeno): Izvršeno 0,0 od 29,1 km u 7 dana (< 60 %): nadjačano (A7).

| ned | faza                | cilj pre → posle (planirano) | kvalitet pre → posle                          | dugi pre → posle | ograničenje    |
| --- | ------------------- | ---------------------------- | --------------------------------------------- | ---------------- | -------------- |
| 1   | baza                | 25,0 (isto)                  | —                                             | 8,2              | —              |
| 2   | baza                | 26,3 (isto)                  | —                                             | 8,6              | —              |
| 3   | baza                | 27,6 (isto)                  | T 1,5 km kontinuirano                         | 9,1              | —              |
| 4   | baza                | 22,1 (isto)                  | T 1,5 km kontinuirano                         | 7,2              | rasterećenje   |
| 5   | razvoj              | 29,0 (isto)                  | T 2 × 1000 m                                  | 9,5              | —              |
| 6   | razvoj → baza       | 30,5 → 12,6 (12,6)           | T 2 × 1200 m → —                              | 10,0 → 3,6       | bez kvaliteta  |
| 7   | razvoj              | 32,0 → 13,9 (13,9)           | T 3 × 1000 m → —                              | 10,5 → 4,5       | 1 kvalitet, A9 |
| 8   | specifično → razvoj | 32,5 → 12,0 (12,0)           | RP 3 × 1000 m → —                             | 10,7 → 3,0       | rasterećenje   |
| 9   | specifično          | 26,0 → 15,3 (15,3)           | T 1,5 km kontinuirano → T 1,5 km kontinuirano | 8,5 → 4,2        | —              |
| 10  | specifično          | 32,5 → 16,8 (16,8)           | RP 2 × 1500 m → T 1,5 km kontinuirano         | 10,7 → 5,5       | —              |
| 11  | taper               | 24,4 → 12,6 (12,6)           | RP 2 × 1000 m → —                             | 8,0 → 3,6        | —              |
| 12  | trka                | 13,9 → 9,3 (9,3)             | RP 2 × 1000 m → —                             | — → —            | —              |

## d4-nepotpuna-pokrivenost

4 dana, 14 ned, VDOT 45, 35 km — u 14 dana do asOf (kraj ned 6) zapisana su samo 3 treninga, coverage complete = false: nije pauza ni manjak

### Korak 1: asOf 2026-12-13

- Tempo: rezultat, VDOT 45,0, prognoza 10K 45:13; cilj: —
- Koraci u planu: 1; mešovite nedelje: nema; promena (changes): 0
- Upozorenja: nema

Reasons:

- nema (nijedan uslov iz činjenica)

| ned | faza       | cilj pre → posle (planirano) | kvalitet pre → posle                  | dugi pre → posle | ograničenje  |
| --- | ---------- | ---------------------------- | ------------------------------------- | ---------------- | ------------ |
| 1   | baza       | 35,0 (isto)                  | R 6 × 200 m + T 2,0 km kontinuirano   | 11,5             | —            |
| 2   | baza       | 37,1 (isto)                  | R 8 × 200 m + T 2,5 km kontinuirano   | 12,2             | —            |
| 3   | baza       | 39,3 (isto)                  | R 6 × 300 m + T 3,0 km kontinuirano   | 12,9             | —            |
| 4   | baza       | 31,4 (isto)                  | T 2,0 km kontinuirano                 | 10,3             | rasterećenje |
| 5   | razvoj     | 41,7 (isto)                  | I 2 × 1000 m + T 3 × 1000 m           | 13,7             | —            |
| 6   | razvoj     | 44,2 (isto)                  | I 3 × 800 m + T 3 × 1200 m            | 14,5             | —            |
| 7   | razvoj     | 46,9 (isto)                  | I 3 × 1000 m + T 4 × 1000 m           | 15,4             | —            |
| 8   | razvoj     | 37,5 (isto)                  | T 2 × 1200 m                          | 12,3             | rasterećenje |
| 9   | specifično | 49,0 (isto)                  | RP 3 × 1000 m + T 3 × 1600 m          | 16,1             | —            |
| 10  | specifično | 49,0 (isto)                  | RP 4 × 1000 m + T 2 × 2400 m          | 16,1             | —            |
| 11  | specifično | 39,2 (isto)                  | T 2 × 1200 m                          | 12,8             | rasterećenje |
| 12  | specifično | 49,0 (isto)                  | RP 3 × 1500 m + T 4,8 km kontinuirano | 16,1             | —            |
| 13  | taper      | 36,8 (isto)                  | RP 2 × 1200 m + T 2 × 1200 m          | 12,0             | —            |
| 14  | trka       | 18,2 (isto)                  | RP 2 × 1000 m                         | —                | —            |
