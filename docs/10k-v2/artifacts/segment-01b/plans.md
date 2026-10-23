# 10K v2 — primeri (10k-v2.1.0)

Generisano: `node docs/10k-v2/artifacts/segment-01b/run.ts`. Start: 2026-11-02 (ponedeljak; trka subota: dan ranije). Km cilj/plan = cilj nedelje / planirano; trka i njen WU/CD nisu u obimu.

## Poređenje segment-01 (10k-v2.0.0) → segment-01b (10k-v2.1.0)

| primer                | ned 1 km    | vrh         | najduži dugi | lagan max ned 1 |
| --------------------- | ----------- | ----------- | ------------ | --------------- |
| dev-01                | 25,0 → 25,0 | 35,0 → 35,0 | 11,5 → 11,5  | 5,6 → 5,6       |
| dev-02                | 30,0 → 30,0 | 42,0 → 42,0 | 13,8 → 13,8  | 8,4 → 8,4       |
| dev-03                | 37,6 → 40,0 | 53,2 → 55,0 | 17,2 → 17,2  | 12,4 → 10,6     |
| dev-04                | 38,8 → 45,0 | 55,9 → 60,0 | 18,0 → 18,0  | 12,8 → 11,1     |
| dev-05                | 41,9 → 55,0 | 60,0 → 60,0 | 19,8 → 19,8  | 13,8 → 14,8     |
| dev-06                | 35,0 → 35,0 | 49,0 → 49,0 | 16,1 → 16,1  | 10,9 → 7,6      |
| edge-25km-10w-vdot30  | 25,0 → 25,0 | 35,0 → 35,0 | 11,5 → 11,5  | 6,4 → 6,4       |
| edge-55km-18w-vdot30  | 30,4 → 39,2 | 40,2 → 43,5 | 12,5 → 12,5  | 10,0 → 12,5     |
| edge-55km-vdot75      | 50,1 → 55,0 | 60,0 → 60,0 | 19,8 → 19,8  | 16,5 → 10,3     |
| edge-goal-unrealistic | 35,0 → 35,0 | 48,4 → 49,0 | 15,5 → 15,5  | 11,5 → 8,4      |

## dev-01 — razvojni: 10 km 56:00, 25 km, 10 ned, cilj 54:00

- VDOT 35 · prognoza 10K 56:02 · tempo /km: E 6:47–7:28, T 5:40, I 5:13, R 4:55, RP 5:36
- Dani: Q1 uto, Q2 čet, dugi ned, lagan sub · obim start 25,0 → vrh 35,0 km (granica izgradnje 35,0 km)
- WU/CD kvaliteta: 15/10 min (D14, pojas trenutnog obima)
- Cilj: 54:00 → ambiciozan (VDOT cilja 36.6, razlika 1.6)
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagan max | napomena               |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | --------- | ---------------------- |
| 1       | baza       | 25,0 / 25,0  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,0 km kontinuirano              | 8,2 km  | 5,6 km    | —                      |
| 2       | baza       | 26,5 / 26,5  | uto: R 4 × 300 m (oporavak 300 m džog)<br>čet: T 2,5 km kontinuirano              | 8,7 km  | 6,2 km    | —                      |
| 3       | baza       | 28,1 / 28,1  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,5 km kontinuirano              | 9,2 km  | 7,2 km    | Q2: T 2,5 km ponovljen |
| 4       | razvoj     | 29,8 / 29,8  | uto: I 2 × 1000 m (oporavak 4:00 džog)<br>čet: T 2,5 km kontinuirano              | 9,8 km  | 7,9 km    | —                      |
| 5       | razvoj     | 23,8 / 23,9  | čet: T 2 × 1000 m (oporavak 1:00 džog)                                            | 7,8 km  | 5,2 km    | rasterećenje           |
| 6       | specifično | 31,6 / 31,6  | uto: RP 2 × 1200 m (oporavak 1:00 džog)<br>čet: T 3 × 1000 m (oporavak 1:00 džog) | 10,4 km | 8,4 km    | —                      |
| 7       | specifično | 33,5 / 33,5  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 2 × 1500 m (oporavak 1:00 džog) | 11,0 km | 9,1 km    | —                      |
| 8       | specifično | 35,0 / 35,0  | uto: RP 2 × 1500 m (oporavak 1:30 džog)<br>čet: T 3,0 km kontinuirano             | 11,5 km | 10,3 km   | —                      |
| 9       | taper      | 26,3 / 26,3  | uto: RP 2 × 1000 m (oporavak 1:00 džog)<br>čet: T 2 × 1000 m (oporavak 1:00 džog) | 8,6 km  | 6,4 km    | —                      |
| 10      | trka       | 13,9 / 13,9  | čet: RP 2 × 1000 m (oporavak 1:30 džog)                                           | —       | 4,9 km    | trka ned (van obima)   |

## dev-02 — razvojni: 5 km 25:00, 30 km, 12 ned, cilj 50:00

- VDOT 38.3 · prognoza 10K 51:54 · tempo /km: E 6:20–6:57, T 5:16, I 4:51, R 4:34, RP 5:11
- Dani: Q1 sre, Q2 pet, dugi ned, lagan pon · obim start 30,0 → vrh 42,0 km (granica izgradnje 42,0 km)
- WU/CD kvaliteta: 15/10 min (D14, pojas trenutnog obima)
- Cilj: 50:00 → ambiciozan (VDOT cilja 40, razlika 1.7)
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagan max | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | --------- | -------------------- |
| 1       | baza       | 30,0 / 30,0  | sre: R 6 × 200 m (oporavak 200 m džog)<br>pet: T 2,0 km kontinuirano              | 9,9 km  | 8,4 km    | —                    |
| 2       | baza       | 31,8 / 31,8  | sre: R 4 × 300 m (oporavak 300 m džog)<br>pet: T 2,5 km kontinuirano              | 10,4 km | 9,3 km    | —                    |
| 3       | baza       | 33,7 / 33,7  | sre: R 8 × 200 m (oporavak 200 m džog)<br>pet: T 3,0 km kontinuirano              | 11,1 km | 9,1 km    | —                    |
| 4       | baza       | 27,0 / 27,0  | pet: T 2,0 km kontinuirano                                                        | 8,8 km  | 6,2 km    | rasterećenje         |
| 5       | razvoj     | 35,7 / 35,7  | sre: I 2 × 1000 m (oporavak 4:00 džog)<br>pet: T 3 × 1000 m (oporavak 1:00 džog)  | 11,7 km | 10,6 km   | —                    |
| 6       | razvoj     | 37,8 / 37,8  | sre: I 3 × 800 m (oporavak 3:45 džog)<br>pet: T 3 × 1200 m (oporavak 1:00 džog)   | 12,4 km | 10,4 km   | —                    |
| 7       | razvoj     | 40,1 / 40,1  | sre: I 3 × 1000 m (oporavak 4:00 džog)<br>pet: T 4 × 1000 m (oporavak 1:00 džog)  | 13,2 km | 10,7 km   | —                    |
| 8       | specifično | 42,0 / 42,0  | sre: RP 3 × 1000 m (oporavak 1:00 džog)<br>pet: T 2 × 2000 m (oporavak 1:00 džog) | 13,8 km | 13,2 km   | —                    |
| 9       | specifično | 33,6 / 33,6  | pet: T 2 × 1200 m (oporavak 1:00 džog)                                            | 11,0 km | 8,2 km    | rasterećenje         |
| 10      | specifično | 42,0 / 42,0  | sre: RP 4 × 1000 m (oporavak 1:00 džog)<br>pet: T 4,0 km kontinuirano             | 13,8 km | 12,2 km   | —                    |
| 11      | taper      | 31,5 / 31,5  | sre: RP 2 × 1200 m (oporavak 1:00 džog)<br>pet: T 2 × 1200 m (oporavak 1:00 džog) | 10,3 km | 8,6 km    | —                    |
| 12      | trka       | 16,5 / 16,5  | sre: RP 2 × 1000 m (oporavak 1:30 džog)                                           | —       | 5,3 km    | trka ned (van obima) |

## dev-03 — razvojni: 10 km 45:00, 40 km, 14 ned, cilj 43:30

- VDOT 45.3 · prognoza 10K 44:58 · tempo /km: E 5:32–6:06, T 4:36, I 4:14, R 4:00, RP 4:30
- Dani: Q1 uto, Q2 čet, dugi ned, lagan sub · obim start 40,0 → vrh 55,0 km (granica izgradnje 55,0 km)
- WU/CD kvaliteta: 20/15 min (D14, pojas trenutnog obima)
- Cilj: 43:30 → ambiciozan (VDOT cilja 47.1, razlika 1.8)
- Upozorenja: WEEK_FITTED ×1, CAPACITY_LIMITED ×1

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagan max | napomena                                 |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | --------- | ---------------------------------------- |
| 1       | baza       | 40,0 / 40,0  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,0 km kontinuirano              | 13,2 km | 10,6 km   | —                                        |
| 2       | baza       | 42,4 / 42,4  | uto: R 8 × 200 m (oporavak 200 m džog)<br>čet: T 2,5 km kontinuirano              | 13,9 km | 11,0 km   | —                                        |
| 3       | baza       | 44,9 / 44,9  | uto: R 6 × 300 m (oporavak 300 m džog)<br>čet: T 3,0 km kontinuirano              | 14,8 km | 11,8 km   | —                                        |
| 4       | baza       | 35,9 / 35,9  | čet: T 2,0 km kontinuirano                                                        | 11,8 km | 8,1 km    | rasterećenje                             |
| 5       | razvoj     | 47,6 / 47,6  | uto: I 2 × 1000 m (oporavak 4:00 džog)<br>čet: T 3 × 1000 m (oporavak 1:00 džog)  | 15,7 km | 13,8 km   | —                                        |
| 6       | razvoj     | 50,5 / 50,5  | uto: I 3 × 800 m (oporavak 3:15 džog)<br>čet: T 3 × 1200 m (oporavak 1:00 džog)   | 16,6 km | 14,4 km   | —                                        |
| 7       | razvoj     | 53,5 / 53,5  | uto: I 3 × 1000 m (oporavak 4:00 džog)<br>čet: T 4 × 1000 m (oporavak 1:00 džog)  | 17,2 km | 15,4 km   | —                                        |
| 8       | razvoj     | 42,8 / 42,8  | čet: T 2 × 1200 m (oporavak 1:00 džog)                                            | 13,7 km | 10,3 km   | rasterećenje                             |
| 9       | specifično | 54,9 / 54,9  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 3 × 1600 m (oporavak 1:00 džog) | 17,2 km | 17,2 km   | izvodljiv cilj (pravilo 55,0 km, naniže) |
| 10      | specifično | 55,0 / 55,0  | uto: RP 4 × 1000 m (oporavak 1:00 džog)<br>čet: T 5 × 1000 m (oporavak 1:00 džog) | 17,2 km | 15,6 km   | —                                        |
| 11      | specifično | 44,0 / 44,0  | čet: T 3 × 1000 m (oporavak 1:00 džog)                                            | 13,7 km | 10,5 km   | rasterećenje                             |
| 12      | specifično | 55,0 / 55,0  | uto: RP 3 × 1500 m (oporavak 1:30 džog)<br>čet: T 2 × 2500 m (oporavak 1:00 džog) | 17,2 km | 15,6 km   | —                                        |
| 13      | taper      | 41,3 / 41,4  | uto: RP 2 × 1200 m (oporavak 1:00 džog)<br>čet: T 3 × 1000 m (oporavak 1:00 džog) | 12,9 km | 10,5 km   | —                                        |
| 14      | trka       | 18,3 / 18,3  | čet: RP 2 × 1000 m (oporavak 1:30 džog)                                           | —       | 6,0 km    | trka ned (van obima)                     |

## dev-04 — razvojni: polumaraton 1:35:00, 45 km, 16 ned, cilj 41:30

- VDOT 47.9 · prognoza 10K 42:52 · tempo /km: E 5:18–5:50, T 4:24, I 4:03, R 3:49, RP 4:17
- Dani: Q1 sre, Q2 pet, dugi ned, lagan pon · obim start 45,0 → vrh 60,0 km (granica izgradnje 60,0 km)
- WU/CD kvaliteta: 25/15 min (D14, pojas trenutnog obima)
- Cilj: 41:30 → ambiciozan (VDOT cilja 49.8, razlika 1.9)
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagan max | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | --------- | -------------------- |
| 1       | baza       | 45,0 / 45,0  | sre: R 6 × 200 m (oporavak 200 m džog)<br>pet: T 2,5 km kontinuirano              | 14,8 km | 11,1 km   | —                    |
| 2       | baza       | 47,7 / 47,7  | sre: R 8 × 200 m (oporavak 200 m džog)<br>pet: T 3,0 km kontinuirano              | 15,7 km | 11,6 km   | —                    |
| 3       | baza       | 50,6 / 50,6  | sre: R 6 × 300 m (oporavak 300 m džog)<br>pet: T 3,5 km kontinuirano              | 16,6 km | 12,8 km   | —                    |
| 4       | baza       | 40,5 / 40,5  | pet: T 2,0 km kontinuirano                                                        | 13,2 km | 9,1 km    | rasterećenje         |
| 5       | baza       | 53,6 / 53,6  | sre: R 10 × 200 m (oporavak 200 m džog)<br>pet: T 4,0 km kontinuirano             | 17,6 km | 13,8 km   | —                    |
| 6       | razvoj     | 56,6 / 56,6  | sre: I 3 × 800 m (oporavak 3:00 džog)<br>pet: T 4 × 1000 m (oporavak 1:00 džog)   | 18,0 km | 16,2 km   | —                    |
| 7       | razvoj     | 59,6 / 59,6  | sre: I 3 × 1000 m (oporavak 4:00 džog)<br>pet: T 3 × 1600 m (oporavak 1:00 džog)  | 18,0 km | 17,6 km   | —                    |
| 8       | razvoj     | 47,7 / 47,7  | pet: T 2 × 1200 m (oporavak 1:00 džog)                                            | 14,4 km | 11,8 km   | rasterećenje         |
| 9       | razvoj     | 60,0 / 60,0  | sre: I 3 × 1200 m (oporavak 4:00 džog)<br>pet: T 5 × 1000 m (oporavak 1:00 džog)  | 18,0 km | 16,9 km   | —                    |
| 10      | razvoj     | 60,0 / 60,0  | sre: I 4 × 1000 m (oporavak 4:00 džog)<br>pet: T 4 × 1500 m (oporavak 1:00 džog)  | 18,0 km | 14,9 km   | —                    |
| 11      | specifično | 60,0 / 60,0  | sre: RP 4 × 1000 m (oporavak 1:00 džog)<br>pet: T 3 × 2000 m (oporavak 1:00 džog) | 18,0 km | 16,7 km   | —                    |
| 12      | specifično | 48,0 / 48,0  | pet: T 3 × 1200 m (oporavak 1:00 džog)                                            | 14,4 km | 11,3 km   | rasterećenje         |
| 13      | specifično | 60,0 / 60,0  | sre: RP 3 × 1500 m (oporavak 1:30 džog)<br>pet: T 2 × 3000 m (oporavak 1:00 džog) | 18,0 km | 16,4 km   | —                    |
| 14      | specifično | 60,0 / 60,0  | sre: RP 5 × 1000 m (oporavak 1:00 džog)<br>pet: T 6,0 km kontinuirano             | 18,0 km | 15,9 km   | —                    |
| 15      | taper      | 45,0 / 45,0  | sre: RP 3 × 1000 m (oporavak 1:00 džog)<br>pet: T 3 × 1200 m (oporavak 1:00 džog) | 13,5 km | 9,8 km    | —                    |
| 16      | trka       | 23,3 / 23,3  | sre: RP 3 × 1000 m (oporavak 1:30 džog)                                           | —       | 6,3 km    | trka ned (van obima) |

## dev-05 — razvojni: 10 km 38:00, 55 km, 18 ned, cilj 37:00

- VDOT 55.2 · prognoza 10K 37:58 · tempo /km: E 4:43–5:13, T 3:56, I 3:37, R 3:24, RP 3:48
- Dani: Q1 uto, Q2 čet, dugi ned, lagan sub · obim start 55,0 → vrh 60,0 km (granica izgradnje 60,0 km)
- WU/CD kvaliteta: 25/15 min (D14, pojas trenutnog obima)
- Cilj: 37:00 → realističan (VDOT cilja 56.9, razlika 1.7)
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagan max | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | --------- | -------------------- |
| 1       | baza       | 55,0 / 55,0  | uto: R 8 × 200 m (oporavak 200 m džog)<br>čet: T 3,0 km kontinuirano              | 18,1 km | 14,8 km   | —                    |
| 2       | baza       | 58,0 / 58,0  | uto: R 6 × 300 m (oporavak 300 m džog)<br>čet: T 3,5 km kontinuirano              | 19,1 km | 16,0 km   | —                    |
| 3       | baza       | 60,0 / 60,0  | uto: R 10 × 200 m (oporavak 200 m džog)<br>čet: T 4,0 km kontinuirano             | 19,8 km | 16,3 km   | —                    |
| 4       | baza       | 48,0 / 48,0  | čet: T 2,0 km kontinuirano                                                        | 15,8 km | 11,1 km   | rasterećenje         |
| 5       | baza       | 60,0 / 60,0  | uto: R 8 × 300 m (oporavak 300 m džog)<br>čet: T 4,5 km kontinuirano              | 19,8 km | 15,1 km   | —                    |
| 6       | baza       | 60,0 / 60,0  | uto: R 12 × 200 m (oporavak 200 m džog)<br>čet: T 5,0 km kontinuirano             | 19,8 km | 14,5 km   | —                    |
| 7       | razvoj     | 60,0 / 60,0  | uto: I 3 × 800 m (oporavak 2:45 džog)<br>čet: T 5 × 1000 m (oporavak 1:00 džog)   | 19,8 km | 14,8 km   | —                    |
| 8       | razvoj     | 48,0 / 48,0  | čet: T 3 × 1000 m (oporavak 1:00 džog)                                            | 15,8 km | 10,4 km   | rasterećenje         |
| 9       | razvoj     | 60,0 / 60,0  | uto: I 3 × 1000 m (oporavak 3:30 džog)<br>čet: T 4 × 1500 m (oporavak 1:00 džog)  | 19,8 km | 13,1 km   | —                    |
| 10      | razvoj     | 60,0 / 60,0  | uto: I 3 × 1200 m (oporavak 4:00 džog)<br>čet: T 3 × 2000 m (oporavak 1:00 džog)  | 19,8 km | 12,5 km   | —                    |
| 11      | razvoj     | 60,0 / 60,0  | uto: I 4 × 1000 m (oporavak 3:30 džog)<br>čet: T 2 × 3000 m (oporavak 1:00 džog)  | 19,8 km | 11,8 km   | —                    |
| 12      | razvoj     | 48,0 / 48,0  | čet: T 3 × 1200 m (oporavak 1:00 džog)                                            | 15,8 km | 10,1 km   | rasterećenje         |
| 13      | specifično | 60,0 / 60,0  | uto: RP 4 × 1000 m (oporavak 1:00 džog)<br>čet: T 6,0 km kontinuirano             | 19,8 km | 13,5 km   | —                    |
| 14      | specifično | 60,0 / 60,0  | uto: RP 3 × 1500 m (oporavak 1:30 džog)<br>čet: T 2 × 3000 m (oporavak 1:00 džog) | 19,8 km | 12,8 km   | —                    |
| 15      | specifično | 48,0 / 48,0  | čet: T 3 × 1200 m (oporavak 1:00 džog)                                            | 15,8 km | 10,1 km   | rasterećenje         |
| 16      | specifično | 60,0 / 60,0  | uto: RP 5 × 1000 m (oporavak 1:00 džog)<br>čet: T 6,0 km kontinuirano             | 19,8 km | 12,3 km   | —                    |
| 17      | taper      | 45,0 / 45,0  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 3 × 1200 m (oporavak 1:00 džog) | 14,8 km | 6,7 km    | —                    |
| 18      | trka       | 23,4 / 23,4  | čet: RP 3 × 1000 m (oporavak 1:30 džog)                                           | —       | 7,0 km    | trka ned (van obima) |

## dev-06 — razvojni: 3 km 13:00, 35 km, 12 ned, trka subota, pon/uto/čet/sub

- VDOT 43.7 · prognoza 10K 46:22 · tempo /km: E 5:42–6:16, T 4:45, I 4:22, R 4:07, RP 4:38
- Dani: Q1 uto, Q2 čet, dugi sub, lagan pon · obim start 35,0 → vrh 49,0 km (granica izgradnje 49,0 km)
- WU/CD kvaliteta: 20/15 min (D14, pojas trenutnog obima)
- Cilj: nije zadat
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagan max | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | --------- | -------------------- |
| 1       | baza       | 35,0 / 35,0  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,0 km kontinuirano              | 11,5 km | 7,6 km    | —                    |
| 2       | baza       | 37,1 / 37,1  | uto: R 8 × 200 m (oporavak 200 m džog)<br>čet: T 2,5 km kontinuirano              | 12,2 km | 7,7 km    | —                    |
| 3       | baza       | 39,3 / 39,3  | uto: R 6 × 300 m (oporavak 300 m džog)<br>čet: T 3,0 km kontinuirano              | 12,9 km | 8,4 km    | —                    |
| 4       | baza       | 31,4 / 31,4  | čet: T 2,0 km kontinuirano                                                        | 10,3 km | 6,7 km    | rasterećenje         |
| 5       | razvoj     | 41,7 / 41,7  | uto: I 2 × 1000 m (oporavak 4:00 džog)<br>čet: T 3 × 1000 m (oporavak 1:00 džog)  | 13,7 km | 10,3 km   | —                    |
| 6       | razvoj     | 44,2 / 44,2  | uto: I 3 × 800 m (oporavak 3:15 džog)<br>čet: T 3 × 1200 m (oporavak 1:00 džog)   | 14,5 km | 10,6 km   | —                    |
| 7       | razvoj     | 46,9 / 47,0  | uto: I 3 × 1000 m (oporavak 4:00 džog)<br>čet: T 4 × 1000 m (oporavak 1:00 džog)  | 15,4 km | 11,0 km   | —                    |
| 8       | specifično | 49,0 / 49,0  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 3 × 1600 m (oporavak 1:00 džog) | 16,1 km | 12,7 km   | —                    |
| 9       | specifično | 39,2 / 39,2  | čet: T 2 × 1200 m (oporavak 1:00 džog)                                            | 12,8 km | 9,0 km    | rasterećenje         |
| 10      | specifično | 49,0 / 49,0  | uto: RP 4 × 1000 m (oporavak 1:00 džog)<br>čet: T 2 × 2400 m (oporavak 1:00 džog) | 16,1 km | 11,7 km   | —                    |
| 11      | taper      | 36,8 / 36,8  | uto: RP 2 × 1200 m (oporavak 1:00 džog)<br>čet: T 2 × 1200 m (oporavak 1:00 džog) | 12,0 km | 8,0 km    | —                    |
| 12      | trka       | 19,8 / 19,8  | uto: RP 2 × 1000 m (oporavak 1:30 džog)                                           | —       | 5,8 km    | trka sub (van obima) |

## edge-25km-10w-vdot30 — granični: najmanji obim, najkraći plan, VDOT 30

- VDOT 30 · prognoza 10K 1:03:49 · tempo /km: E 7:39–8:23, T 6:24, I 5:54, R 5:34, RP 6:23
- Dani: Q1 uto, Q2 čet, dugi ned, lagan sub · obim start 25,0 → vrh 35,0 km (granica izgradnje 35,0 km)
- WU/CD kvaliteta: 15/10 min (D14, pojas trenutnog obima)
- Cilj: nije zadat
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagan max | napomena               |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | --------- | ---------------------- |
| 1       | baza       | 25,0 / 25,0  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,0 km kontinuirano              | 8,2 km  | 6,4 km    | —                      |
| 2       | baza       | 26,5 / 26,5  | uto: R 4 × 300 m (oporavak 300 m džog)<br>čet: T 2,5 km kontinuirano              | 8,7 km  | 7,0 km    | —                      |
| 3       | baza       | 28,1 / 28,1  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,5 km kontinuirano              | 9,2 km  | 8,0 km    | Q2: T 2,5 km ponovljen |
| 4       | razvoj     | 29,8 / 29,8  | uto: I 2 × 1000 m (oporavak 4:00 džog)<br>čet: T 2,5 km kontinuirano              | 9,8 km  | 8,8 km    | —                      |
| 5       | razvoj     | 23,8 / 23,8  | čet: T 2 × 1000 m (oporavak 1:00 džog)                                            | 7,8 km  | 5,4 km    | rasterećenje           |
| 6       | specifično | 31,6 / 31,6  | uto: RP 2 × 1200 m (oporavak 1:00 džog)<br>čet: T 3 × 1000 m (oporavak 1:00 džog) | 10,4 km | 9,2 km    | —                      |
| 7       | specifično | 33,5 / 33,5  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 2 × 1500 m (oporavak 1:00 džog) | 11,0 km | 9,9 km    | —                      |
| 8       | specifično | 35,0 / 35,0  | uto: RP 2 × 1500 m (oporavak 1:30 džog)<br>čet: T 3,0 km kontinuirano             | 11,5 km | 11,1 km   | —                      |
| 9       | taper      | 26,3 / 26,3  | uto: RP 2 × 1000 m (oporavak 1:00 džog)<br>čet: T 2 × 1000 m (oporavak 1:00 džog) | 8,6 km  | 7,2 km    | —                      |
| 10      | trka       | 12,6 / 12,6  | čet: RP 2 × 1000 m (oporavak 1:30 džog)                                           | —       | 4,4 km    | trka ned (van obima)   |

## edge-55km-18w-vdot30 — granični: kapacitet: spor E + 55 km (105 min seče dugi)

- VDOT 30 · prognoza 10K 1:03:49 · tempo /km: E 7:39–8:23, T 6:24, I 5:54, R 5:34, RP 6:23
- Dani: Q1 uto, Q2 čet, dugi ned, lagan sub · obim start 55,0 → vrh 43,5 km (granica izgradnje 60,0 km)
- WU/CD kvaliteta: 25/15 min (D14, pojas trenutnog obima)
- Cilj: nije zadat
- Upozorenja: WEEK_FITTED ×12, CAPACITY_LIMITED ×1

| nedelja | faza       | km cilj/plan | kvalitet                                                                                              | dugi    | lagan max | napomena                                                         |
| ------- | ---------- | ------------ | ----------------------------------------------------------------------------------------------------- | ------- | --------- | ---------------------------------------------------------------- |
| 1       | baza       | 39,2 / 39,2  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,0 km kontinuirano                                  | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 55,0 km, naniže)                         |
| 2       | baza       | 40,5 / 40,5  | uto: R 8 × 200 m (oporavak 200 m džog)<br>čet: T 2,5 km kontinuirano                                  | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 41,6 km, naniže)                         |
| 3       | baza       | 41,3 / 41,3  | uto: R 6 × 300 m (oporavak 300 m džog)<br>čet: T 3,0 km kontinuirano                                  | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 42,9 km, naniže)                         |
| 4       | baza       | 33,0 / 33,0  | čet: T 2,0 km kontinuirano                                                                            | 10,0 km | 8,0 km    | rasterećenje                                                     |
| 5       | baza       | 42,3 / 42,3  | uto: R 10 × 200 m (oporavak 200 m džog)<br>čet: T 3,5 km kontinuirano                                 | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 43,8 km, naniže)                         |
| 6       | baza       | 42,8 / 42,8  | uto: R 10 × 200 m (oporavak 200 m džog)<br>čet: T 4,0 km kontinuirano                                 | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 44,8 km, naniže); Q1: R 2,0 km ponovljen |
| 7       | razvoj     | 41,8 / 41,8  | uto: I 2 × 1000 m (oporavak 4:00 džog)<br>čet: T 4 × 1000 m (oporavak 1:00 džog)                      | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 45,4 km, naniže)                         |
| 8       | razvoj     | 33,4 / 33,4  | čet: T 2 × 1200 m (oporavak 1:00 džog)                                                                | 10,0 km | 8,0 km    | rasterećenje                                                     |
| 9       | razvoj     | 42,5 / 42,5  | uto: I 3 × 800 m (oporavak 4:00 džog)<br>čet: T 2 × 2000 m (oporavak 1:00 džog)                       | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 44,3 km, naniže)                         |
| 10      | razvoj     | 43,0 / 43,0  | uto: I 3 × 1000 m (oporavak 4:00 džog)<br>čet: T 4,0 km kontinuirano                                  | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 45,1 km, naniže)                         |
| 11      | razvoj     | 43,1 / 43,1  | uto: I 1200 + 1000 + 800 m (oporavak 4:00 džog / 4:00 džog)<br>čet: T 2 × 2000 m (oporavak 1:00 džog) | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 45,6 km, naniže)                         |
| 12      | razvoj     | 34,5 / 34,5  | čet: T 2 × 1200 m (oporavak 1:00 džog)                                                                | 10,0 km | 8,5 km    | rasterećenje                                                     |
| 13      | specifično | 42,2 / 42,2  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 4,0 km kontinuirano                                 | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 45,7 km, naniže)                         |
| 14      | specifično | 43,5 / 43,5  | uto: RP 4 × 1000 m (oporavak 1:00 džog)<br>čet: T 2 × 2000 m (oporavak 1:00 džog)                     | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 44,7 km, naniže)                         |
| 15      | specifično | 34,8 / 34,8  | čet: T 2 × 1200 m (oporavak 1:00 džog)                                                                | 10,0 km | 8,7 km    | rasterećenje                                                     |
| 16      | specifično | 43,5 / 43,5  | uto: RP 5 × 800 m (oporavak 1:00 džog)<br>čet: T 4,0 km kontinuirano                                  | 12,5 km | 12,5 km   | izvodljiv cilj (pravilo 46,1 km, naniže)                         |
| 17      | taper      | 32,6 / 32,6  | uto: RP 2 × 1200 m (oporavak 1:00 džog)<br>čet: T 2 × 1200 m (oporavak 1:00 džog)                     | 9,3 km  | 8,3 km    | —                                                                |
| 18      | trka       | 14,5 / 14,5  | čet: RP 2 × 1000 m (oporavak 1:30 džog)                                                               | —       | 4,4 km    | trka ned (van obima)                                             |

## edge-55km-vdot75 — granični: 55 km, VDOT 75, 14 ned

- VDOT 75 · prognoza 10K 29:15 · tempo /km: E 3:41–4:04, T 3:04, I 2:49, R 2:39, RP 2:56
- Dani: Q1 sre, Q2 pet, dugi ned, lagan pon · obim start 55,0 → vrh 60,0 km (granica izgradnje 60,0 km)
- WU/CD kvaliteta: 25/15 min (D14, pojas trenutnog obima)
- Cilj: nije zadat
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagan max | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | --------- | -------------------- |
| 1       | baza       | 55,0 / 55,0  | sre: R 8 × 200 m (oporavak 200 m džog)<br>pet: T 3,0 km kontinuirano              | 18,1 km | 10,3 km   | —                    |
| 2       | baza       | 58,0 / 58,0  | sre: R 6 × 300 m (oporavak 300 m džog)<br>pet: T 3,5 km kontinuirano              | 19,1 km | 11,5 km   | —                    |
| 3       | baza       | 60,0 / 60,0  | sre: R 10 × 200 m (oporavak 200 m džog)<br>pet: T 4,0 km kontinuirano             | 19,8 km | 11,8 km   | —                    |
| 4       | baza       | 48,0 / 48,0  | pet: T 2,0 km kontinuirano                                                        | 15,8 km | 10,0 km   | rasterećenje         |
| 5       | razvoj     | 60,0 / 60,0  | sre: I 3 × 800 m (oporavak 2:15 džog)<br>pet: T 4 × 1000 m (oporavak 1:00 džog)   | 19,8 km | 11,2 km   | —                    |
| 6       | razvoj     | 60,0 / 60,0  | sre: I 3 × 1000 m (oporavak 2:45 džog)<br>pet: T 3 × 1600 m (oporavak 1:00 džog)  | 19,8 km | 9,8 km    | —                    |
| 7       | razvoj     | 60,0 / 60,0  | sre: I 3 × 1200 m (oporavak 3:15 džog)<br>pet: T 5 × 1000 m (oporavak 1:00 džog)  | 19,8 km | 8,2 km    | —                    |
| 8       | razvoj     | 48,0 / 48,0  | pet: T 3 × 1000 m (oporavak 1:00 džog)                                            | 15,8 km | 9,2 km    | rasterećenje         |
| 9       | specifično | 60,0 / 60,0  | sre: RP 4 × 1000 m (oporavak 1:00 džog)<br>pet: T 4 × 1500 m (oporavak 1:00 džog) | 19,8 km | 8,0 km    | —                    |
| 10      | specifično | 60,0 / 60,0  | sre: RP 3 × 1500 m (oporavak 1:30 džog)<br>pet: T 3 × 2000 m (oporavak 1:00 džog) | 19,8 km | 7,8 km    | —                    |
| 11      | specifično | 48,0 / 48,0  | pet: T 3 × 1200 m (oporavak 1:00 džog)                                            | 15,8 km | 8,9 km    | rasterećenje         |
| 12      | specifično | 60,0 / 60,0  | sre: RP 5 × 1000 m (oporavak 1:00 džog)<br>pet: T 2 × 3000 m (oporavak 1:00 džog) | 19,8 km | 7,3 km    | —                    |
| 13      | taper      | 45,0 / 45,0  | sre: RP 3 × 1000 m (oporavak 1:00 džog)<br>pet: T 3 × 1200 m (oporavak 1:00 džog) | 13,7 km | 3,0 km    | —                    |
| 14      | trka       | 32,2 / 32,2  | sre: RP 3 × 1000 m (oporavak 1:30 džog)                                           | —       | 9,0 km    | trka ned (van obima) |

## edge-goal-unrealistic — granični: 10 km 50:00, 35 km, 12 ned, cilj 40:00 (nerealan)

- VDOT 40 · prognoza 10K 50:01 · tempo /km: E 6:07–6:44, T 5:06, I 4:41, R 4:25, RP 5:00
- Dani: Q1 uto, Q2 čet, dugi ned, lagan sub · obim start 35,0 → vrh 49,0 km (granica izgradnje 49,0 km)
- WU/CD kvaliteta: 20/15 min (D14, pojas trenutnog obima)
- Cilj: 40:00 → nerealan (VDOT cilja 51.9, razlika 11.9)
- Upozorenja: GOAL_UNREALISTIC ×1

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagan max | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | --------- | -------------------- |
| 1       | baza       | 35,0 / 35,0  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,0 km kontinuirano              | 11,5 km | 8,4 km    | —                    |
| 2       | baza       | 37,1 / 37,1  | uto: R 8 × 200 m (oporavak 200 m džog)<br>čet: T 2,5 km kontinuirano              | 12,2 km | 8,5 km    | —                    |
| 3       | baza       | 39,3 / 39,3  | uto: R 6 × 300 m (oporavak 300 m džog)<br>čet: T 3,0 km kontinuirano              | 12,9 km | 9,2 km    | —                    |
| 4       | baza       | 31,4 / 31,4  | čet: T 2,0 km kontinuirano                                                        | 10,3 km | 6,9 km    | rasterećenje         |
| 5       | razvoj     | 41,7 / 41,7  | uto: I 2 × 1000 m (oporavak 4:00 džog)<br>čet: T 3 × 1000 m (oporavak 1:00 džog)  | 13,7 km | 11,2 km   | —                    |
| 6       | razvoj     | 44,2 / 44,2  | uto: I 3 × 800 m (oporavak 3:30 džog)<br>čet: T 3 × 1200 m (oporavak 1:00 džog)   | 14,5 km | 11,4 km   | —                    |
| 7       | razvoj     | 46,9 / 46,9  | uto: I 3 × 1000 m (oporavak 4:00 džog)<br>čet: T 4 × 1000 m (oporavak 1:00 džog)  | 15,4 km | 11,9 km   | —                    |
| 8       | specifično | 49,0 / 49,0  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 3 × 1600 m (oporavak 1:00 džog) | 15,5 km | 14,2 km   | —                    |
| 9       | specifično | 39,2 / 39,2  | čet: T 2 × 1200 m (oporavak 1:00 džog)                                            | 12,4 km | 9,4 km    | rasterećenje         |
| 10      | specifično | 49,0 / 49,0  | uto: RP 4 × 1000 m (oporavak 1:00 džog)<br>čet: T 2 × 2400 m (oporavak 1:00 džog) | 15,5 km | 13,2 km   | —                    |
| 11      | taper      | 36,8 / 36,8  | uto: RP 2 × 1200 m (oporavak 1:00 džog)<br>čet: T 2 × 1200 m (oporavak 1:00 džog) | 11,6 km | 9,2 km    | —                    |
| 12      | trka       | 16,8 / 16,8  | čet: RP 2 × 1000 m (oporavak 1:30 džog)                                           | —       | 5,5 km    | trka ned (van obima) |

## rej-3-days — odbijeni: 3 dana nedeljno

**Odbijeno:**

- `SUPPORTED_FROM_SEGMENT_02`: 3 dana trčanja biće podržano od segmenta 02 (sada tačno 4 dana).

## rej-8-weeks — odbijeni: 8 nedelja

**Odbijeno:**

- `SUPPORTED_FROM_SEGMENT_02`: Plan od 8 nedelja biće podržan od segmenta 02 (sada 10–18 nedelja).

## rej-19-weeks — odbijeni: 19 nedelja

**Odbijeno:**

- `PLAN_TOO_LONG`: Plan od 19 nedelja je predug (najviše 18): počni plan kasnije, najranije 2026-11-09.

## rej-20km — odbijeni: 20 km nedeljno

**Odbijeno:**

- `WEEKLY_KM_TOO_LOW`: Trenutni obim 20 km je ispod 25 km nedeljno: preporuka je 5K plan ili izgradnja osnove pre 10K plana.

## rej-no-result — odbijeni: bez rezultata

**Odbijeno:**

- `FEEL_PLAN_SEGMENT_03`: Bez rezultata trke nema pouzdanog tempa: plan po osećaju dolazi u segmentu 03.

## rej-result-100d — odbijeni: rezultat star 100 dana

**Odbijeno:**

- `FEEL_PLAN_SEGMENT_03`: Rezultat je star 100 dana (> 84): tempo nije pouzdan; plan po osećaju dolazi u segmentu 03.

## rej-vdot-below-30 — odbijeni: VDOT < 30 (10 km 70:00)

**Odbijeno:**

- `FEEL_PLAN_SEGMENT_03`: VDOT 26.8 je ispod 30: tempo iz modela nije pouzdan; plan po osećaju dolazi u segmentu 03.

## rej-mon-tue-wed-thu — odbijeni: pon/uto/sre/čet: nema 3 nesusedna teška dana

**Odbijeno:**

- `SCHEDULE_NO_RECOVERY`: U danima pon, uto, sre, čet dva kvaliteta i dugi ne mogu biti međusobno nesusedni. Predlog: uto, sre, čet, sub (dugi sub).
