# 10K v2 — primeri segmenta 03b (10k-v2.3.1)

Generisano: `node docs/10k-v2/artifacts/segment-03b/run.ts`. Start: 2026-11-02 (ponedeljak); trka u nedelju. Km cilj/plan = cilj nedelje / planirano; trka i njen WU/CD nisu u obimu. Lagani sa * su zadati vremenom (trkačka nedelja). Tempo T/RP u planu po osećaju je orijentir (procena), trening vodi RPE. JSON fajlovi: `:` u id → `-`.

## Poređenje 03 (81bd351, 10k-v2.3.0) → 03b (10k-v2.3.1)

| primer                     | nedelje 3 … taper sa kvalitetom | test 5 km (nedelja) | najkraći dugi | dugi rasterećenja                | vrh            | taper / oštrenje                        |
| -------------------------- | ------------------------------- | ------------------- | ------------- | -------------------------------- | -------------- | --------------------------------------- |
| beg-d3-15km-e7:30-12w      | 0 / 9 → 7 / 9                   | 4 → —               | 3,1 → 6,0 km  | 3,1, 6,9 → 6,0, 6,9 km           | 19,5 → 19,5 km | — / ne → — / ne                         |
| beg-d4-18km-e8:00-10w      | 1 / 7 → 7 / 7                   | 3 → —               | 5,5 → 5,5 km  | 5,5 → 5,5 km                     | 23,4 → 23,4 km | — / ne → T 1,5 km / ne                  |
| beg-d3-20km-e6:30-14w      | 9 / 11 → 11 / 11                | 4 → —               | 5,8 → 7,9 km  | 5,8, 9,2, 9,3 → 7,9, 9,2, 9,3 km | 26,0 → 26,0 km | — / ne → T 1,5 km / ne                  |
| beg-d4-25km-result-v35-14w | 11 / 11 → 11 / 11               | — → —               | 7,2 → 7,2 km  | 7,2, 8,4, 8,5 → 7,2, 8,4, 8,5 km | 32,5 → 32,5 km | RP 2 × 1000 m / da → RP 2 × 1000 m / da |

## beg-d3-15km-e7:30-12w: početnik, 3 dana uto/čet/ned, 15 km, lagan 7:30/km, bez rezultata, 12 ned

- Osnova tempa: po osećaju (paceBasis feel) · procena VDOT 30,8 (orijentir) · prognoza 10K i ocena cilja: posle rezultata trke ili parkruna
- Tempo /km: E 7:15–7:45 (lagan 7:30 ± 15 s); orijentir (procena): T 6:16, RP 6:15
- Dani (3, početnik): Q1 čet, dugi ned, lagani uto; WU/CD 15/10 min
- Obim: start 15,0 → vrh 19,5 km (granica izgradnje 19,5 km)
- Test 5 km: nema (početnik, D32)
- Upozorenja: DELOAD_NO_QUALITY ×1, TAPER_NO_QUALITY ×1
- Napomena plana: Plan po osećaju (D26): bez rezultata trke. E = lagan tempo 7:30/km ± 15 s; tempo T/I/R/RP je orijentir (procena) iz procene VDOT 30,8 — trening vodi RPE.
- Napomena plana: Početnik bez testa 5 km (D32): kvalitet po RPE; ocena cilja i prognoza 10K posle rezultata trke ili parkruna (adaptacija, segment 04).

| nedelja | faza       | km cilj/plan | kvalitet                             | dugi   | lagani           | napomena                                                                                         |
| ------- | ---------- | ------------ | ------------------------------------ | ------ | ---------------- | ------------------------------------------------------------------------------------------------ |
| 1       | baza       | 15,0 / 15,0  | —                                    | 6,7 km | uto 4,2, čet 4,1 | uvod bez kvaliteta (D28)                                                                         |
| 2       | baza       | 16,0 / 16,0  | —                                    | 7,2 km | uto 4,4, čet 4,4 | uvod bez kvaliteta (D28)                                                                         |
| 3       | baza       | 17,0 / 17,0  | čet: T 1,5 km kontinuirano · RPE 6–7 | 7,6 km | uto 4,6          | —                                                                                                |
| 4       | baza       | 13,6 / 13,6  | —                                    | 6,0 km | uto 3,8, čet 3,8 | rasterećenje; bez kvaliteta (D11 ispred D5/D7)                                                   |
| 5       | razvoj     | 18,0 / 18,0  | čet: T 1,5 km kontinuirano · RPE 6–7 | 8,1 km | uto 5,1          | T kontinuirano (D31): prvi nivo T_cruise (2,0 km) ne staje u plafon 10 %; Q1: T 1,5 km ponovljen |
| 6       | razvoj     | 19,0 / 19,0  | čet: T 1,5 km kontinuirano · RPE 6–7 | 8,5 km | uto 5,7          | T kontinuirano (D31): prvi nivo T_cruise (2,0 km) ne staje u plafon 10 %; Q1: T 1,5 km ponovljen |
| 7       | razvoj     | 19,5 / 19,5  | čet: T 1,5 km kontinuirano · RPE 6–7 | 8,7 km | uto 6,0          | T kontinuirano (D31): prvi nivo T_cruise (2,0 km) ne staje u plafon 10 %; Q1: T 1,5 km ponovljen |
| 8       | specifično | 19,5 / 19,5  | čet: T 1,5 km kontinuirano · RPE 6–7 | 8,7 km | uto 6,0          | T kontinuirano (D31): prvi nivo RP (2,4 km) ne staje u plafon 10 %; Q1: T 1,5 km ponovljen       |
| 9       | specifično | 15,6 / 15,6  | čet: T 1,5 km kontinuirano · RPE 6–7 | 6,9 km | uto 3,9          | rasterećenje                                                                                     |
| 10      | specifično | 19,5 / 19,5  | čet: T 1,5 km kontinuirano · RPE 6–7 | 8,7 km | uto 6,0          | T kontinuirano (D31): prvi nivo RP (2,4 km) ne staje u plafon 10 %; Q1: T 1,5 km ponovljen       |
| 11      | taper      | 14,6 / 14,6  | —                                    | 6,5 km | uto 4,1, čet 4,0 | bez kvaliteta (D11 ispred D5/D7)                                                                 |
| 12      | trka       | 8,0 / 8,0    | —                                    | —      | uto 4,0, čet 4,0 | bez oštrenja (D8); trka ned (van obima)                                                          |

## beg-d4-18km-e8:00-10w: početnik, 4 dana uto/čet/sub/ned, 18 km, lagan 8:00/km, bez rezultata, 10 ned

- Osnova tempa: po osećaju (paceBasis feel) · procena VDOT 28,3 (orijentir) · prognoza 10K i ocena cilja: posle rezultata trke ili parkruna
- Tempo /km: E 7:45–8:15 (lagan 8:00 ± 15 s); orijentir (procena): T 6:42, RP 6:42
- Dani (4, početnik): Q1 čet, dugi ned, lagani uto, sub; WU/CD 15/10 min
- Obim: start 18,0 → vrh 23,4 km (granica izgradnje 23,4 km)
- Test 5 km: nema (početnik, D32)
- Upozorenja: nema
- Napomena plana: Plan po osećaju (D26): bez rezultata trke. E = lagan tempo 8:00/km ± 15 s; tempo T/I/R/RP je orijentir (procena) iz procene VDOT 28,3 — trening vodi RPE.
- Napomena plana: Početnik bez testa 5 km (D32): kvalitet po RPE; ocena cilja i prognoza 10K posle rezultata trke ili parkruna (adaptacija, segment 04).

| nedelja | faza       | km cilj/plan | kvalitet                                         | dugi   | lagani                     | napomena                                                           |
| ------- | ---------- | ------------ | ------------------------------------------------ | ------ | -------------------------- | ------------------------------------------------------------------ |
| 1       | baza       | 18,0 / 18,0  | —                                                | 5,9 km | uto 4,1, čet 4,0, sub 4,0  | uvod bez kvaliteta (D28)                                           |
| 2       | baza       | 19,0 / 19,0  | —                                                | 6,2 km | uto 4,3, čet 4,3, sub 4,2  | uvod bez kvaliteta (D28)                                           |
| 3       | baza       | 20,0 / 20,0  | čet: T 1,5 km kontinuirano · RPE 6–7             | 6,6 km | uto 4,4, sub 4,4           | —                                                                  |
| 4       | razvoj     | 21,0 / 21,0  | čet: T 2 × 1000 m (oporavak 1:00 džog) · RPE 6–7 | 6,9 km | uto 4,4, sub 4,4           | —                                                                  |
| 5       | razvoj     | 16,8 / 16,8  | čet: T 1,5 km kontinuirano · RPE 6–7             | 5,5 km | uto 3,4, sub 3,3           | rasterećenje                                                       |
| 6       | specifično | 22,1 / 22,1  | čet: T 2,0 km kontinuirano · RPE 6–7             | 7,2 km | uto 4,9, sub 4,9           | T kontinuirano (D31): prvi nivo RP (2,4 km) ne staje u plafon 10 % |
| 7       | specifično | 23,2 / 23,2  | čet: T 2 × 1000 m (oporavak 1:00 džog) · RPE 6–7 | 7,6 km | uto 5,2, sub 5,1           | T kontinuirano (D31): prvi nivo RP (2,4 km) ne staje u plafon 10 % |
| 8       | specifično | 23,4 / 23,4  | čet: T 2,0 km kontinuirano · RPE 6–7             | 7,7 km | uto 5,3, sub 5,3           | T kontinuirano (D31): prvi nivo RP (2,4 km) ne staje u plafon 10 % |
| 9       | taper      | 17,6 / 17,6  | čet: T 1,5 km kontinuirano · RPE 6–7             | 5,7 km | uto 3,7, sub 3,6           | taper: RP ne staje — T kontinuirano (D31)                          |
| 10      | trka       | 10,1 / 10,1  | —                                                | —      | uto 3,6, čet 3,6, sub 2,9* | bez oštrenja (D8); trka ned (van obima)                            |

## beg-d3-20km-e6:30-14w: početnik, 3 dana uto/čet/ned, 20 km, lagan 6:30/km, bez rezultata, 14 ned

- Osnova tempa: po osećaju (paceBasis feel) · procena VDOT 37,0 (orijentir) · prognoza 10K i ocena cilja: posle rezultata trke ili parkruna
- Tempo /km: E 6:15–6:45 (lagan 6:30 ± 15 s); orijentir (procena): T 5:25, RP 5:21
- Dani (3, početnik): Q1 čet, dugi ned, lagani uto; WU/CD 15/10 min
- Obim: start 20,0 → vrh 26,0 km (granica izgradnje 26,0 km)
- Test 5 km: nema (početnik, D32)
- Upozorenja: nema
- Napomena plana: Plan po osećaju (D26): bez rezultata trke. E = lagan tempo 6:30/km ± 15 s; tempo T/I/R/RP je orijentir (procena) iz procene VDOT 37,0 — trening vodi RPE.
- Napomena plana: Početnik bez testa 5 km (D32): kvalitet po RPE; ocena cilja i prognoza 10K posle rezultata trke ili parkruna (adaptacija, segment 04).

| nedelja | faza       | km cilj/plan | kvalitet                                          | dugi    | lagani             | napomena                                  |
| ------- | ---------- | ------------ | ------------------------------------------------- | ------- | ------------------ | ----------------------------------------- |
| 1       | baza       | 20,0 / 20,0  | —                                                 | 9,0 km  | uto 5,5, čet 5,5   | uvod bez kvaliteta (D28)                  |
| 2       | baza       | 21,0 / 21,0  | —                                                 | 9,4 km  | uto 5,8, čet 5,8   | uvod bez kvaliteta (D28)                  |
| 3       | baza       | 22,1 / 22,1  | čet: T 1,5 km kontinuirano · RPE 6–7              | 9,9 km  | uto 6,9            | —                                         |
| 4       | baza       | 17,7 / 17,8  | čet: T 1,5 km kontinuirano · RPE 6–7              | 7,9 km  | uto 4,5            | rasterećenje                              |
| 5       | razvoj     | 23,2 / 23,2  | čet: T 2 × 1000 m (oporavak 1:00 džog) · RPE 6–7  | 10,4 km | uto 6,8            | —                                         |
| 6       | razvoj     | 24,4 / 24,4  | čet: T 2 × 1200 m (oporavak 1:00 džog) · RPE 6–7  | 10,9 km | uto 7,1            | —                                         |
| 7       | razvoj     | 25,6 / 25,6  | čet: T 2,4 km kontinuirano · RPE 6–7              | 11,5 km | uto 7,9            | —                                         |
| 8       | razvoj     | 20,5 / 20,6  | čet: T 1,5 km kontinuirano · RPE 6–7              | 9,2 km  | uto 6,0            | rasterećenje                              |
| 9       | specifično | 26,0 / 26,0  | čet: RP 2 × 1200 m (oporavak 1:00 džog) · RPE 7–8 | 11,7 km | uto 7,9            | —                                         |
| 10      | specifično | 26,0 / 26,1  | čet: RP 3 × 800 m (oporavak 1:00 džog) · RPE 7–8  | 11,7 km | uto 7,8            | —                                         |
| 11      | specifično | 20,8 / 20,9  | čet: T 1,5 km kontinuirano · RPE 6–7              | 9,3 km  | uto 6,2            | rasterećenje                              |
| 12      | specifično | 26,0 / 26,0  | čet: RP 2 × 1200 m (oporavak 1:00 džog) · RPE 7–8 | 11,7 km | uto 7,9            | —                                         |
| 13      | taper      | 19,5 / 19,6  | čet: T 1,5 km kontinuirano · RPE 6–7              | 8,7 km  | uto 5,5            | taper: RP ne staje — T kontinuirano (D31) |
| 14      | trka       | 10,8 / 10,8  | —                                                 | —       | uto 5,4*, čet 5,4* | bez oštrenja (D8); trka ned (van obima)   |

## beg-d4-25km-result-v35-14w: početnik, 4 dana uto/čet/sub/ned, 25 km, rezultat 10 km VDOT 35, 14 ned

- Osnova tempa: rezultat (paceBasis result) · VDOT 35,0 · prognoza 10K 56:02
- Tempo /km: E 6:47–7:28; iz VDOT-a: T 5:40, RP 5:36
- Dani (4, početnik): Q1 čet, dugi ned, lagani uto, sub; WU/CD 15/10 min
- Obim: start 25,0 → vrh 32,5 km (granica izgradnje 32,5 km)
- Test 5 km: nema (početnik, D32)
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                | dugi    | lagani                    | napomena                 |
| ------- | ---------- | ------------ | --------------------------------------- | ------- | ------------------------- | ------------------------ |
| 1       | baza       | 25,0 / 25,0  | —                                       | 8,2 km  | uto 5,6, čet 5,6, sub 5,6 | uvod bez kvaliteta (D28) |
| 2       | baza       | 26,3 / 26,3  | —                                       | 8,6 km  | uto 5,9, čet 5,9, sub 5,9 | uvod bez kvaliteta (D28) |
| 3       | baza       | 27,6 / 27,6  | čet: T 1,5 km kontinuirano              | 9,1 km  | uto 6,8, sub 6,7          | —                        |
| 4       | baza       | 22,1 / 22,1  | čet: T 1,5 km kontinuirano              | 7,2 km  | uto 5,0, sub 4,9          | rasterećenje             |
| 5       | razvoj     | 29,0 / 29,1  | čet: T 2 × 1000 m (oporavak 1:00 džog)  | 9,5 km  | uto 7,0, sub 6,9          | —                        |
| 6       | razvoj     | 30,5 / 30,6  | čet: T 2 × 1200 m (oporavak 1:00 džog)  | 10,0 km | uto 7,3, sub 7,2          | —                        |
| 7       | razvoj     | 32,0 / 32,0  | čet: T 3 × 1000 m (oporavak 1:00 džog)  | 10,5 km | uto 7,4, sub 7,3          | —                        |
| 8       | razvoj     | 25,6 / 25,6  | čet: T 1,5 km kontinuirano              | 8,4 km  | uto 6,1, sub 6,1          | rasterećenje             |
| 9       | specifično | 32,5 / 32,5  | čet: RP 3 × 1000 m (oporavak 1:00 džog) | 10,7 km | uto 7,5, sub 7,5          | —                        |
| 10      | specifično | 32,5 / 32,5  | čet: RP 2 × 1500 m (oporavak 1:30 džog) | 10,7 km | uto 7,6, sub 7,5          | —                        |
| 11      | specifično | 26,0 / 26,0  | čet: T 1,5 km kontinuirano              | 8,5 km  | uto 6,3, sub 6,2          | rasterećenje             |
| 12      | specifično | 32,5 / 32,5  | čet: RP 3 × 1000 m (oporavak 1:00 džog) | 10,7 km | uto 7,5, sub 7,5          | —                        |
| 13      | taper      | 24,4 / 24,4  | čet: RP 2 × 1000 m (oporavak 1:00 džog) | 8,0 km  | uto 5,4, sub 5,4          | —                        |
| 14      | trka       | 13,9 / 13,9  | čet: RP 2 × 1000 m (oporavak 1:30 džog) | —       | uto 4,9*, sub 3,3*        | trka ned (van obima)     |
