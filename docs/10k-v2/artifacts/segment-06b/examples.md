# 10K v2 — primeri segmenta 06b (10k-v2.4.0 → 10k-v2.4.1): bol, povratak od nedelje sidra

Generisano: `node docs/10k-v2/artifacts/segment-06b/run.ts <checkout e6540a5>`. Ulaz: 4 dana (uto/čet/sub/ned, dugi nedelja), start 2026-10-26, trka 2027-01-24 (13 ned), 40 km, 10 km 45:00 (2026-10-10), cilj 43:00. Činjenica: jedan zapis bez trčanja sa bolom (`km 0, completed false, pain N`). Ćelija = cilj / planirano · broj kvaliteta. „pre" = e6540a5, „posle" = 10k-v2.4.1. Ograničenje (posle) = rasterećenje i broj dana trčanja nedelje u periodu odmora/bola.

Bazni plan: 1 40,0 · 2 42,4 · 3 44,9 · 4R 35,9 · 5 47,6 · 6 50,5 · 7 53,5 · 8R 42,8 · 9 54,9 · 10 55,0 · 11 55,0 · 12 41,3 · 13 18,3 (R = rasterećenje).

## A: asOf 2026-11-15 (nedelja; bol dan ranije, u subotu), bol 5/10 na dan 2026-11-14

- Odmor: nema; period bola 2026-11-16 – 2026-11-22; nedelja r (asOf + 1) = 4.
- Sidro: e6540a5 nedelja 4 (poslednja nedelja bola, 0,7 × njen cilj) → 10k-v2.4.1 nedelja 4; nivo pre bola 42,4 km.
- Poruka posle: Bol 5/10 u poslednja 3 dana: 7 dana bez kvaliteta i ubrzanja (2026-11-16 – 2026-11-22). Bol: 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled (A4). Posle nedelje 4 rast kreće od 70 % nivoa pre bola (29,7 km). Povratak do 42,4 km (nivo pre smanjenja) po +10 %/ned (min 1,0 km), osim tapera i trkačke nedelje (A8).

| ned | faza       | pre (e6540a5)      | posle (10k-v2.4.1)        | ograničenje           |
| --- | ---------- | ------------------ | ------------------------- | --------------------- |
| 1   | baza       | 40,0 / 40,0 · 2 kv | 40,0 / 40,0 · 2 kv (isto) | —                     |
| 2   | baza       | 42,4 / 42,4 · 2 kv | 42,4 / 42,4 · 2 kv (isto) | —                     |
| 3   | baza       | 44,9 / 44,9 · 2 kv | 44,9 / 44,9 · 2 kv (isto) | —                     |
| 4   | baza (R)   | 35,9 / 26,6 · 0 kv | 35,9 / 26,6 · 0 kv (isto) | rasterećenje, bol 4 d |
| 5   | razvoj     | 27,6 / 27,6 · 2 kv | 32,7 / 32,7 · 2 kv        | —                     |
| 6   | razvoj     | 30,4 / 30,4 · 2 kv | 36,0 / 36,0 · 2 kv        | —                     |
| 7   | razvoj     | 33,4 / 33,4 · 2 kv | 39,6 / 39,6 · 2 kv        | —                     |
| 8   | razvoj (R) | 26,7 / 26,7 · 1 kv | 31,7 / 31,7 · 1 kv        | rasterećenje          |
| 9   | specifično | 36,7 / 36,8 · 2 kv | 42,4 / 42,4 · 2 kv        | —                     |
| 10  | specifično | 40,4 / 40,4 · 2 kv | 44,9 / 44,9 · 2 kv        | —                     |
| 11  | specifično | 42,8 / 42,8 · 2 kv | 47,6 / 47,6 · 2 kv        | —                     |
| 12  | taper      | 32,1 / 32,1 · 2 kv | 35,7 / 35,7 · 2 kv        | —                     |
| 13  | trka       | 16,7 / 16,7 · 1 kv | 18,3 / 18,3 · 1 kv        | —                     |

## B: asOf 2026-11-15 (nedelja; bol dan ranije, u subotu), bol 8/10 na dan 2026-11-14

- Odmor: 2026-11-16 – 2026-11-18; period bola 2026-11-19 – 2026-11-25; nedelja r (asOf + 1) = 4.
- Sidro: e6540a5 nedelja 5 (poslednja nedelja bola, 0,7 × njen cilj) → 10k-v2.4.1 nedelja 4; nivo pre bola 42,4 km.
- Poruka posle: Bol 8/10 u poslednja 3 dana: 3 dana odmora (do 2026-11-18), pa 7 dana bez kvaliteta i ubrzanja (2026-11-19 – 2026-11-25). Bol: 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled (A4). Posle nedelje 4 rast kreće od 70 % nivoa pre bola (29,7 km). Povratak do 42,4 km (nivo pre smanjenja) po +10 %/ned (min 1,0 km), osim tapera i trkačke nedelje (A8).

| ned | faza       | pre (e6540a5)      | posle (10k-v2.4.1)        | ograničenje                      |
| --- | ---------- | ------------------ | ------------------------- | -------------------------------- |
| 1   | baza       | 40,0 / 40,0 · 2 kv | 40,0 / 40,0 · 2 kv (isto) | —                                |
| 2   | baza       | 42,4 / 42,4 · 2 kv | 42,4 / 42,4 · 2 kv (isto) | —                                |
| 3   | baza       | 44,9 / 44,9 · 2 kv | 44,9 / 44,9 · 2 kv (isto) | —                                |
| 4   | baza (R)   | 35,9 / 21,0 · 0 kv | 35,9 / 21,0 · 0 kv (isto) | rasterećenje, odmor 1 d, bol 3 d |
| 5   | razvoj     | 47,6 / 44,0 · 1 kv | 32,7 / 30,6 · 1 kv        | bol 1 d                          |
| 6   | razvoj     | 36,6 / 36,6 · 2 kv | 36,0 / 36,0 · 2 kv        | —                                |
| 7   | razvoj     | 40,3 / 40,3 · 2 kv | 39,6 / 39,6 · 2 kv        | —                                |
| 8   | razvoj (R) | 32,2 / 32,2 · 1 kv | 31,7 / 31,7 · 1 kv        | rasterećenje                     |
| 9   | specifično | 42,7 / 42,7 · 2 kv | 42,4 / 42,4 · 2 kv        | —                                |
| 10  | specifično | 45,3 / 45,4 · 2 kv | 44,9 / 45,0 · 2 kv        | —                                |
| 11  | specifično | 48,0 / 48,0 · 2 kv | 47,6 / 47,6 · 2 kv        | —                                |
| 12  | taper      | 36,0 / 36,0 · 2 kv | 35,7 / 35,7 · 2 kv        | —                                |
| 13  | trka       | 18,3 / 18,3 · 1 kv | 18,3 / 18,3 · 1 kv (isto) | —                                |

## C: asOf 2026-11-18 (sreda; bol istog dana), bol 5/10 na dan 2026-11-18

- Odmor: nema; period bola 2026-11-19 – 2026-11-25; nedelja r (asOf + 1) = 4.
- Sidro: e6540a5 nedelja 5 (poslednja nedelja bola, 0,7 × njen cilj) → 10k-v2.4.1 nedelja 4; nivo pre bola 44,9 km.
- Poruka posle: Bol 5/10 u poslednja 3 dana: 7 dana bez kvaliteta i ubrzanja (2026-11-19 – 2026-11-25). Bol: 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled (A4). Posle nedelje 4 rast kreće od 70 % nivoa pre bola (31,4 km). Povratak do 44,9 km (nivo pre smanjenja) po +10 %/ned (min 1,0 km), osim tapera i trkačke nedelje (A8).

| ned | faza       | pre (e6540a5)      | posle (10k-v2.4.1)        | ograničenje           |
| --- | ---------- | ------------------ | ------------------------- | --------------------- |
| 1   | baza       | 40,0 / 40,0 · 2 kv | 40,0 / 40,0 · 2 kv (isto) | —                     |
| 2   | baza       | 42,4 / 42,4 · 2 kv | 42,4 / 42,4 · 2 kv (isto) | —                     |
| 3   | baza       | 44,9 / 44,9 · 2 kv | 44,9 / 44,9 · 2 kv (isto) | —                     |
| 4   | baza (R)   | 35,9 / 29,1 · 0 kv | 35,9 / 29,1 · 0 kv (isto) | rasterećenje, bol 3 d |
| 5   | razvoj     | 47,6 / 44,0 · 1 kv | 34,5 / 32,2 · 1 kv        | bol 1 d               |
| 6   | razvoj     | 36,6 / 36,6 · 2 kv | 38,0 / 38,0 · 2 kv        | —                     |
| 7   | razvoj     | 40,3 / 40,3 · 2 kv | 41,8 / 41,8 · 2 kv        | —                     |
| 8   | razvoj (R) | 32,2 / 32,2 · 1 kv | 33,4 / 33,4 · 1 kv        | rasterećenje          |
| 9   | specifično | 44,3 / 44,3 · 2 kv | 44,9 / 44,9 · 2 kv        | —                     |
| 10  | specifično | 47,0 / 47,0 · 2 kv | 47,6 / 47,6 · 2 kv        | —                     |
| 11  | specifično | 49,8 / 49,8 · 2 kv | 50,5 / 50,5 · 2 kv        | —                     |
| 12  | taper      | 37,4 / 37,4 · 2 kv | 37,9 / 37,9 · 2 kv        | —                     |
| 13  | trka       | 18,3 / 18,3 · 1 kv | 18,3 / 18,3 · 1 kv (isto) | —                     |

## D: asOf 2026-11-18 (sreda; bol istog dana), bol 8/10 na dan 2026-11-18

- Odmor: 2026-11-19 – 2026-11-21; period bola 2026-11-22 – 2026-11-28; nedelja r (asOf + 1) = 4.
- Sidro: e6540a5 nedelja 5 (poslednja nedelja bola, 0,7 × njen cilj) → 10k-v2.4.1 nedelja 4; nivo pre bola 44,9 km.
- Poruka posle: Bol 8/10 u poslednja 3 dana: 3 dana odmora (do 2026-11-21), pa 7 dana bez kvaliteta i ubrzanja (2026-11-22 – 2026-11-28). Bol: 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled (A4). Posle nedelje 4 rast kreće od 70 % nivoa pre bola (31,4 km). Povratak do 44,9 km (nivo pre smanjenja) po +10 %/ned (min 1,0 km), osim tapera i trkačke nedelje (A8).

| ned | faza       | pre (e6540a5)      | posle (10k-v2.4.1)        | ograničenje                      |
| --- | ---------- | ------------------ | ------------------------- | -------------------------------- |
| 1   | baza       | 40,0 / 40,0 · 2 kv | 40,0 / 40,0 · 2 kv (isto) | —                                |
| 2   | baza       | 42,4 / 42,4 · 2 kv | 42,4 / 42,4 · 2 kv (isto) | —                                |
| 3   | baza       | 44,9 / 44,9 · 2 kv | 44,9 / 44,9 · 2 kv (isto) | —                                |
| 4   | baza (R)   | 35,9 / 17,9 · 0 kv | 35,9 / 17,9 · 0 kv (isto) | rasterećenje, odmor 2 d, bol 1 d |
| 5   | razvoj     | 47,6 / 37,9 · 0 kv | 34,5 / 27,3 · 0 kv        | bol 3 d                          |
| 6   | razvoj     | 36,6 / 36,6 · 2 kv | 38,0 / 38,0 · 2 kv        | —                                |
| 7   | razvoj     | 40,3 / 40,3 · 2 kv | 41,8 / 41,8 · 2 kv        | —                                |
| 8   | razvoj (R) | 32,2 / 32,2 · 1 kv | 33,4 / 33,4 · 1 kv        | rasterećenje                     |
| 9   | specifično | 44,3 / 44,3 · 2 kv | 44,9 / 44,9 · 2 kv        | —                                |
| 10  | specifično | 47,0 / 47,0 · 2 kv | 47,6 / 47,6 · 2 kv        | —                                |
| 11  | specifično | 49,8 / 49,8 · 2 kv | 50,5 / 50,5 · 2 kv        | —                                |
| 12  | taper      | 37,4 / 37,4 · 2 kv | 37,9 / 37,9 · 2 kv        | —                                |
| 13  | trka       | 18,3 / 18,3 · 1 kv | 18,3 / 18,3 · 1 kv (isto) | —                                |

## E: asOf 2026-11-13 (petak; bol istog dana), bol 7/10 na dan 2026-11-13

- Odmor: 2026-11-14 – 2026-11-16; period bola 2026-11-17 – 2026-11-23; nedelja r (asOf + 1) = 3.
- Sidro: e6540a5 nedelja 5 (poslednja nedelja bola, 0,7 × njen cilj) → 10k-v2.4.1 nedelja 3; nivo pre bola 42,4 km.
- Poruka posle: Bol 7/10 u poslednja 3 dana: 3 dana odmora (do 2026-11-16), pa 7 dana bez kvaliteta i ubrzanja (2026-11-17 – 2026-11-23). Bol: 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled (A4). Posle nedelje 3 rast kreće od 70 % nivoa pre bola (29,7 km). Povratak do 42,4 km (nivo pre smanjenja) po +10 %/ned (min 1,0 km), osim tapera i trkačke nedelje (A8).

| ned | faza       | pre (e6540a5)      | posle (10k-v2.4.1)        | ograničenje           |
| --- | ---------- | ------------------ | ------------------------- | --------------------- |
| 1   | baza       | 40,0 / 40,0 · 2 kv | 40,0 / 40,0 · 2 kv (isto) | —                     |
| 2   | baza       | 42,4 / 42,4 · 2 kv | 42,4 / 42,4 · 2 kv (isto) | —                     |
| 3   | baza       | 44,9 / 18,3 · 2 kv | 44,9 / 18,3 · 2 kv (isto) | odmor 2 d             |
| 4   | baza (R)   | 35,9 / 27,1 · 0 kv | 23,8 / 18,9 · 0 kv        | rasterećenje, bol 4 d |
| 5   | razvoj     | 47,6 / 47,6 · 2 kv | 32,7 / 32,7 · 2 kv        | —                     |
| 6   | razvoj     | 36,6 / 36,6 · 2 kv | 36,0 / 36,0 · 2 kv        | —                     |
| 7   | razvoj     | 40,3 / 40,3 · 2 kv | 39,6 / 39,6 · 2 kv        | —                     |
| 8   | razvoj (R) | 32,2 / 32,2 · 1 kv | 31,7 / 31,7 · 1 kv        | rasterećenje          |
| 9   | specifično | 42,7 / 42,8 · 2 kv | 42,4 / 42,4 · 2 kv        | —                     |
| 10  | specifično | 45,3 / 45,4 · 2 kv | 44,9 / 44,9 · 2 kv        | —                     |
| 11  | specifično | 48,0 / 48,0 · 2 kv | 47,6 / 47,6 · 2 kv        | —                     |
| 12  | taper      | 36,0 / 36,0 · 2 kv | 35,7 / 35,7 · 2 kv        | —                     |
| 13  | trka       | 18,3 / 18,3 · 1 kv | 18,3 / 18,3 · 1 kv (isto) | —                     |
