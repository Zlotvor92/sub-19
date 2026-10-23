# 10K v2 — primeri segmenta 02 (10k-v2.2.0)

Generisano: `node docs/10k-v2/artifacts/segment-02/run.ts`. Start: 2026-11-02 (ponedeljak; trka subota: dan ranije). Km cilj/plan = cilj nedelje / planirano; trka i njen WU/CD nisu u obimu. Lagani sa * su zadati vremenom (trkačka nedelja: 35 min E ili dan pred trku 20 min E + ubrzanja).

## d3-20km-v35-12w — plan: 3 dana uto/čet/ned, 20 km, VDOT 35, 12 ned, cilj 55:00

- VDOT 35 · prognoza 10K 56:02 · tempo /km: E 6:47–7:28, T 5:40, I 5:13, R 4:55, RP 5:36
- Dani (3): Q1 čet, dugi ned, lagani uto
- WU/CD kvaliteta: 15/10 min (D14, pojas trenutnog obima)
- Obim: start 20,0 → vrh 28,0 km (granica izgradnje 28,0 km)
- Cilj: 55:00 → realističan (VDOT cilja 35.8, razlika 0.8)
- Upozorenja: DELOAD_NO_QUALITY ×1

| nedelja | faza       | km cilj/plan | kvalitet                                | dugi    | lagani (svi)     | napomena                                                   |
| ------- | ---------- | ------------ | --------------------------------------- | ------- | ---------------- | ---------------------------------------------------------- |
| 1       | baza       | 20,0 / 20,0  | čet: T 2,0 km kontinuirano              | 8,0 km  | uto 6,5          | —                                                          |
| 2       | baza       | 21,2 / 21,3  | čet: T 2 × 1000 m (oporavak 1:00 džog)  | 8,4 km  | uto 7,2          | —                                                          |
| 3       | baza       | 22,5 / 22,5  | čet: T 2,0 km kontinuirano              | 9,0 km  | uto 8,0          | —                                                          |
| 4       | baza       | 18,0 / 18,0  | —                                       | 7,2 km  | uto 5,4, čet 5,4 | rasterećenje; bez kvaliteta (D11 ispred D5/D7, odstupanje) |
| 5       | razvoj     | 23,9 / 23,9  | čet: T 2 × 1000 m (oporavak 1:00 džog)  | 9,5 km  | uto 8,8          | —                                                          |
| 6       | razvoj     | 25,3 / 25,4  | čet: T 2 × 1200 m (oporavak 1:00 džog)  | 10,1 km | uto 9,2          | —                                                          |
| 7       | razvoj     | 26,8 / 26,8  | čet: T 2,4 km kontinuirano              | 10,7 km | uto 10,2         | —                                                          |
| 8       | specifično | 28,0 / 28,1  | čet: RP 2 × 1200 m (oporavak 1:00 džog) | 11,2 km | uto 10,8         | —                                                          |
| 9       | specifično | 22,4 / 22,4  | čet: T 2 × 1000 m (oporavak 1:00 džog)  | 8,9 km  | uto 7,9          | rasterećenje                                               |
| 10      | specifično | 28,0 / 28,0  | čet: RP 3 × 800 m (oporavak 1:00 džog)  | 11,2 km | uto 10,6         | —                                                          |
| 11      | taper      | 21,0 / 21,1  | čet: RP 2 × 1000 m (oporavak 1:00 džog) | 8,4 km  | uto 7,0          | —                                                          |
| 12      | trka       | 10,6 / 10,6  | čet: RP 2 × 1000 m (oporavak 1:30 džog) | —       | uto 4,9*         | trka ned (van obima)                                       |

## d3-35km-v45-10w — plan: 3 dana pon/sre/sub, 35 km, VDOT 45, 10 ned, trka subota

- VDOT 45 · prognoza 10K 45:13 · tempo /km: E 5:34–6:08, T 4:38, I 4:16, R 4:01, RP 4:31
- Dani (3): Q1 sre, dugi sub, lagani pon
- WU/CD kvaliteta: 20/15 min (D14, pojas trenutnog obima)
- Obim: start 35,0 → vrh 45,0 km (granica izgradnje 45,0 km)
- Cilj: nije zadat
- Upozorenja: WEEK_FITTED ×2, CAPACITY_LIMITED ×1
- Napomena plana: 3 dana ne nose ovaj obim uz dugi ≤ 105 min; preporuka 4–6 dana. Vrh 45,0 km umesto do 45,0 km (D6).

| nedelja | faza       | km cilj/plan | kvalitet                                | dugi    | lagani (svi) | napomena                                 |
| ------- | ---------- | ------------ | --------------------------------------- | ------- | ------------ | ---------------------------------------- |
| 1       | baza       | 35,0 / 35,0  | sre: T 2,0 km kontinuirano              | 14,0 km | pon 13,0     | —                                        |
| 2       | baza       | 37,1 / 37,1  | sre: T 2,5 km kontinuirano              | 14,8 km | pon 13,8     | —                                        |
| 3       | baza       | 39,3 / 39,3  | sre: T 3,0 km kontinuirano              | 15,7 km | pon 14,6     | —                                        |
| 4       | razvoj     | 41,7 / 41,7  | sre: T 3 × 1000 m (oporavak 1:00 džog)  | 16,6 km | pon 15,8     | —                                        |
| 5       | razvoj     | 33,4 / 33,5  | sre: T 2 × 1000 m (oporavak 1:00 džog)  | 13,2 km | pon 12,1     | rasterećenje                             |
| 6       | specifično | 43,5 / 43,5  | sre: RP 3 × 1000 m (oporavak 1:00 džog) | 17,1 km | pon 17,1     | izvodljiv cilj (pravilo 44,2 km, naniže) |
| 7       | specifično | 44,7 / 44,7  | sre: RP 4 × 1000 m (oporavak 1:00 džog) | 17,1 km | pon 17,1     | izvodljiv cilj (pravilo 45,0 km, naniže) |
| 8       | specifično | 45,0 / 45,0  | sre: RP 3 × 1500 m (oporavak 1:30 džog) | 17,1 km | pon 16,9     | —                                        |
| 9       | taper      | 33,8 / 33,9  | sre: RP 2 × 1200 m (oporavak 1:00 džog) | 12,8 km | pon 12,5     | —                                        |
| 10      | trka       | 14,2 / 14,2  | sre: RP 2 × 1000 m (oporavak 1:30 džog) | —       | pon 6,0*     | trka sub (van obima)                     |

## d5-35km-v40-12w — plan: 5 dana pon/uto/čet/sub/ned, 35 km, VDOT 40, 12 ned

- VDOT 40 · prognoza 10K 50:01 · tempo /km: E 6:07–6:44, T 5:06, I 4:41, R 4:25, RP 5:00
- Dani (5): Q1 uto, Q2 čet, dugi ned, lagani pon, sub
- WU/CD kvaliteta: 20/15 min (D14, pojas trenutnog obima)
- Obim: start 35,0 → vrh 49,0 km (granica izgradnje 49,0 km)
- Cilj: nije zadat
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagani (svi)                 | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | ---------------------------- | -------------------- |
| 1       | baza       | 35,0 / 35,0  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,0 km kontinuirano              | 10,5 km | pon 4,7, sub 4,7             | —                    |
| 2       | baza       | 37,1 / 37,1  | uto: R 8 × 200 m (oporavak 200 m džog)<br>čet: T 2,5 km kontinuirano              | 11,1 km | pon 4,8, sub 4,8             | —                    |
| 3       | baza       | 39,3 / 39,3  | uto: R 6 × 300 m (oporavak 300 m džog)<br>čet: T 3,0 km kontinuirano              | 11,7 km | pon 5,2, sub 5,2             | —                    |
| 4       | baza       | 31,4 / 31,4  | čet: T 2,0 km kontinuirano                                                        | 9,3 km  | pon 4,9, uto 4,9, sub 4,9    | rasterećenje         |
| 5       | razvoj     | 41,7 / 41,7  | uto: I 2 × 1000 m (oporavak 4:00 džog)<br>čet: T 3 × 1000 m (oporavak 1:00 džog)  | 12,5 km | pon 6,2, sub 6,2             | —                    |
| 6       | razvoj     | 44,2 / 44,2  | uto: I 3 × 800 m (oporavak 3:30 džog)<br>čet: T 3 × 1200 m (oporavak 1:00 džog)   | 13,2 km | pon 6,4, sub 6,3             | —                    |
| 7       | razvoj     | 46,9 / 46,9  | uto: I 3 × 1000 m (oporavak 4:00 džog)<br>čet: T 4 × 1000 m (oporavak 1:00 džog)  | 14,0 km | pon 6,7, sub 6,6             | —                    |
| 8       | specifično | 49,0 / 49,0  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 3 × 1600 m (oporavak 1:00 džog) | 14,7 km | pon 7,5, sub 7,5             | —                    |
| 9       | specifično | 39,2 / 39,2  | čet: T 2 × 1200 m (oporavak 1:00 džog)                                            | 11,7 km | pon 6,5, uto 6,5, sub 6,5    | rasterećenje         |
| 10      | specifično | 49,0 / 49,0  | uto: RP 4 × 1000 m (oporavak 1:00 džog)<br>čet: T 2 × 2400 m (oporavak 1:00 džog) | 14,7 km | pon 7,0, sub 7,0             | —                    |
| 11      | taper      | 36,8 / 36,8  | uto: RP 2 × 1200 m (oporavak 1:00 džog)<br>čet: T 2 × 1200 m (oporavak 1:00 džog) | 11,0 km | pon 4,9, sub 4,9             | —                    |
| 12      | trka       | 22,2 / 22,2  | čet: RP 2 × 1000 m (oporavak 1:30 džog)                                           | —       | pon 5,5*, uto 5,5*, sub 3,7* | trka ned (van obima) |

## d5-60km-v55-16w — plan: 5 dana uto/sre/čet/sub/ned, 60 km, VDOT 55, 16 ned, cilj 37:00

- VDOT 55 · prognoza 10K 38:06 · tempo /km: E 4:44–5:13, T 3:56, I 3:37, R 3:25, RP 3:49
- Dani (5): Q1 uto, Q2 čet, dugi ned, lagani sre, sub
- WU/CD kvaliteta: 25/15 min (D14, pojas trenutnog obima)
- Obim: start 60,0 → vrh 75,0 km (granica izgradnje 75,0 km)
- Cilj: 37:00 → ambiciozan (VDOT cilja 56.9, razlika 1.9)
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagani (svi)                 | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | ---------------------------- | -------------------- |
| 1       | baza       | 60,0 / 60,0  | uto: R 6 × 300 m (oporavak 300 m džog)<br>čet: T 3,5 km kontinuirano              | 18,0 km | sre 9,6, sub 9,5             | —                    |
| 2       | baza       | 63,0 / 63,0  | uto: R 10 × 200 m (oporavak 200 m džog)<br>čet: T 4,0 km kontinuirano             | 18,9 km | sre 10,1, sub 10,1           | —                    |
| 3       | baza       | 66,0 / 66,0  | uto: R 8 × 300 m (oporavak 300 m džog)<br>čet: T 4,5 km kontinuirano              | 19,8 km | sre 10,6, sub 10,5           | —                    |
| 4       | baza       | 52,8 / 52,9  | čet: T 2,5 km kontinuirano                                                        | 15,8 km | uto 8,9, sre 8,8, sub 8,8    | rasterećenje         |
| 5       | baza       | 69,0 / 69,0  | uto: R 6 × 400 m (oporavak 400 m džog)<br>čet: T 5,0 km kontinuirano              | 20,1 km | sre 11,7, sub 11,7           | —                    |
| 6       | razvoj     | 72,0 / 72,0  | uto: I 3 × 1000 m (oporavak 3:30 džog)<br>čet: T 5 × 1000 m (oporavak 1:00 džog)  | 20,1 km | sre 12,8, sub 12,8           | —                    |
| 7       | razvoj     | 75,0 / 75,0  | uto: I 3 × 1200 m (oporavak 4:00 džog)<br>čet: T 4 × 1500 m (oporavak 1:00 džog)  | 20,1 km | sre 13,5, sub 13,5           | —                    |
| 8       | razvoj     | 60,0 / 60,0  | čet: T 3 × 1200 m (oporavak 1:00 džog)                                            | 16,0 km | uto 10,7, sre 10,7, sub 10,6 | rasterećenje         |
| 9       | razvoj     | 75,0 / 75,0  | uto: I 4 × 1000 m (oporavak 3:30 džog)<br>čet: T 4 × 1600 m (oporavak 1:00 džog)  | 20,1 km | sre 12,9, sub 12,8           | —                    |
| 10      | razvoj     | 75,0 / 75,0  | uto: I 4 × 1200 m (oporavak 4:00 džog)<br>čet: T 2 × 3200 m (oporavak 1:00 džog)  | 20,1 km | sre 12,5, sub 12,5           | —                    |
| 11      | specifično | 75,0 / 75,0  | uto: RP 5 × 1000 m (oporavak 1:00 džog)<br>čet: T 6,4 km kontinuirano             | 20,1 km | sre 13,3, sub 13,3           | —                    |
| 12      | specifično | 60,0 / 60,0  | čet: T 3 × 1200 m (oporavak 1:00 džog)                                            | 16,0 km | uto 10,7, sre 10,7, sub 10,6 | rasterećenje         |
| 13      | specifično | 75,0 / 75,0  | uto: RP 3 × 2000 m (oporavak 1:30 džog)<br>čet: T 2 × 3200 m (oporavak 1:00 džog) | 20,1 km | sre 12,8, sub 12,8           | —                    |
| 14      | specifično | 75,0 / 75,0  | uto: RP 2 × 3000 m (oporavak 2:00 džog)<br>čet: T 6,4 km kontinuirano             | 20,1 km | sre 13,0, sub 13,0           | —                    |
| 15      | taper      | 56,3 / 56,3  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 3 × 1200 m (oporavak 1:00 džog) | 15,0 km | sre 8,9, sub 8,9             | —                    |
| 16      | trka       | 30,5 / 30,4  | čet: RP 3 × 1000 m (oporavak 1:30 džog)                                           | —       | uto 7,0*, sre 7,0*, sub 4,7* | trka ned (van obima) |

## d6-45km-v45-14w — plan: 6 dana pon–čet/sub/ned, 45 km, VDOT 45, 14 ned

- VDOT 45 · prognoza 10K 45:13 · tempo /km: E 5:34–6:08, T 4:38, I 4:16, R 4:01, RP 4:31
- Dani (6): Q1 uto, Q2 čet, dugi ned, lagani pon, sre, sub
- WU/CD kvaliteta: 25/15 min (D14, pojas trenutnog obima)
- Obim: start 45,0 → vrh 60,0 km (granica izgradnje 60,0 km)
- Cilj: nije zadat
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagani (svi)                       | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | ---------------------------------- | -------------------- |
| 1       | baza       | 45,0 / 45,0  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,5 km kontinuirano              | 12,1 km | pon 4,9, sre 4,8, sub 4,8          | —                    |
| 2       | baza       | 47,7 / 47,7  | uto: R 8 × 200 m (oporavak 200 m džog)<br>čet: T 3,0 km kontinuirano              | 12,8 km | pon 5,1, sre 5,1, sub 5,0          | —                    |
| 3       | baza       | 50,6 / 50,6  | uto: R 6 × 300 m (oporavak 300 m džog)<br>čet: T 3,5 km kontinuirano              | 13,6 km | pon 5,5, sre 5,5, sub 5,5          | —                    |
| 4       | baza       | 40,5 / 40,5  | čet: T 2,0 km kontinuirano                                                        | 10,8 km | pon 5,3, uto 5,2, sre 5,2, sub 5,2 | rasterećenje         |
| 5       | razvoj     | 53,6 / 53,6  | uto: I 3 × 800 m (oporavak 3:15 džog)<br>čet: T 3 × 1200 m (oporavak 1:00 džog)   | 14,4 km | pon 6,1, sre 6,0, sub 6,0          | —                    |
| 6       | razvoj     | 56,6 / 56,6  | uto: I 3 × 1000 m (oporavak 4:00 džog)<br>čet: T 4 × 1000 m (oporavak 1:00 džog)  | 15,2 km | pon 6,3, sre 6,3, sub 6,3          | —                    |
| 7       | razvoj     | 59,6 / 59,6  | uto: I 3 × 1200 m (oporavak 4:00 džog)<br>čet: T 3 × 1600 m (oporavak 1:00 džog)  | 16,0 km | pon 6,6, sre 6,6, sub 6,6          | —                    |
| 8       | razvoj     | 47,7 / 47,7  | čet: T 2 × 1200 m (oporavak 1:00 džog)                                            | 12,8 km | pon 6,4, uto 6,4, sre 6,4, sub 6,3 | rasterećenje         |
| 9       | specifično | 60,0 / 60,0  | uto: RP 4 × 1000 m (oporavak 1:00 džog)<br>čet: T 5 × 1000 m (oporavak 1:00 džog) | 16,2 km | pon 6,7, sre 6,7, sub 6,6          | —                    |
| 10      | specifično | 60,0 / 60,0  | uto: RP 3 × 1500 m (oporavak 1:30 džog)<br>čet: T 4 × 1500 m (oporavak 1:00 džog) | 16,2 km | pon 6,2, sre 6,2, sub 6,2          | —                    |
| 11      | specifično | 48,0 / 48,0  | čet: T 3 × 1200 m (oporavak 1:00 džog)                                            | 12,9 km | pon 6,1, uto 6,1, sre 6,1, sub 6,0 | rasterećenje         |
| 12      | specifično | 60,0 / 60,0  | uto: RP 5 × 1000 m (oporavak 1:00 džog)<br>čet: T 3 × 2000 m (oporavak 1:00 džog) | 16,2 km | pon 6,1, sre 6,0, sub 6,0          | —                    |
| 13      | taper      | 45,0 / 45,0  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 3 × 1200 m (oporavak 1:00 džog) | 12,1 km | pon 4,0, sre 4,0, sub 4,0          | —                    |
| 14      | trka       | 26,3 / 26,3  | čet: RP 3 × 1000 m (oporavak 1:30 džog)                                           | —       | uto 6,0*, sre 6,0*, sub 4,0*       | trka ned (van obima) |

## d6-80km-v65-18w — plan: 6 dana pon–sub, 80 km, VDOT 65, 18 ned

- VDOT 65 · prognoza 10K 33:02 · tempo /km: E 4:08–4:34, T 3:26, I 3:10, R 2:59, RP 3:18
- Dani (6): Q1 uto, Q2 čet, dugi sub, lagani pon, sre, pet
- WU/CD kvaliteta: 25/15 min (D14, pojas trenutnog obima)
- Obim: start 80,0 → vrh 90,0 km (granica izgradnje 90,0 km)
- Cilj: nije zadat
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagani (svi)                           | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | -------------------------------------- | -------------------- |
| 1       | baza       | 80,0 / 80,0  | uto: R 8 × 300 m (oporavak 300 m džog)<br>čet: T 4,5 km kontinuirano              | 21,6 km | pon 10,4, sre 10,3, pet 10,3           | —                    |
| 2       | baza       | 83,0 / 83,0  | uto: R 6 × 400 m (oporavak 400 m džog)<br>čet: T 5,0 km kontinuirano              | 22,4 km | pon 11,0, sre 10,9, pet 10,9           | —                    |
| 3       | baza       | 86,0 / 86,0  | uto: R 8 × 300 m (oporavak 300 m džog)<br>čet: T 2 × 2500 m (oporavak 1:00 džog)  | 22,9 km | pon 11,7, sre 11,7, pet 11,6           | —                    |
| 4       | baza       | 68,8 / 68,8  | čet: T 3,0 km kontinuirano                                                        | 18,3 km | pon 9,6, uto 9,6, sre 9,6, pet 9,5     | rasterećenje         |
| 5       | baza       | 89,0 / 89,0  | uto: R 6 × 400 m (oporavak 400 m džog)<br>čet: T 5,0 km kontinuirano              | 22,9 km | pon 12,8, sre 12,8, pet 12,7           | —                    |
| 6       | baza       | 90,0 / 90,0  | uto: R 8 × 300 m (oporavak 300 m džog)<br>čet: T 2 × 2500 m (oporavak 1:00 džog)  | 22,9 km | pon 13,0, sre 13,0, pet 13,0           | —                    |
| 7       | razvoj     | 90,0 / 90,0  | uto: I 4 × 1000 m (oporavak 3:00 džog)<br>čet: T 5 × 1000 m (oporavak 1:00 džog)  | 22,9 km | pon 12,3, sre 12,2, pet 12,2           | —                    |
| 8       | razvoj     | 72,0 / 72,0  | čet: T 3 × 1000 m (oporavak 1:00 džog)                                            | 18,3 km | pon 10,3, uto 10,3, sre 10,2, pet 10,2 | rasterećenje         |
| 9       | razvoj     | 90,0 / 90,0  | uto: I 4 × 1200 m (oporavak 3:45 džog)<br>čet: T 4 × 1500 m (oporavak 1:00 džog)  | 22,9 km | pon 11,6, sre 11,5, pet 11,5           | —                    |
| 10      | razvoj     | 90,0 / 90,0  | uto: I 5 × 1000 m (oporavak 3:00 džog)<br>čet: T 4 × 1600 m (oporavak 1:00 džog)  | 22,9 km | pon 11,3, sre 11,3, pet 11,3           | —                    |
| 11      | razvoj     | 90,0 / 90,0  | uto: I 5 × 1200 m (oporavak 3:45 džog)<br>čet: T 5 × 1600 m (oporavak 1:00 džog)  | 22,9 km | pon 10,1, sre 10,1, pet 10,1           | —                    |
| 12      | razvoj     | 72,0 / 72,0  | čet: T 3 × 1600 m (oporavak 1:00 džog)                                            | 18,3 km | pon 9,8, uto 9,8, sre 9,8, pet 9,8     | rasterećenje         |
| 13      | specifično | 90,0 / 90,0  | uto: RP 3 × 2000 m (oporavak 1:30 džog)<br>čet: T 4 × 2000 m (oporavak 1:00 džog) | 22,9 km | pon 11,1, sre 11,1, pet 11,1           | —                    |
| 14      | specifično | 90,0 / 90,0  | uto: RP 2 × 3000 m (oporavak 2:00 džog)<br>čet: T 5 × 1600 m (oporavak 1:00 džog) | 22,9 km | pon 11,1, sre 11,1, pet 11,1           | —                    |
| 15      | specifično | 72,0 / 72,0  | čet: T 3 × 1600 m (oporavak 1:00 džog)                                            | 18,3 km | pon 9,8, uto 9,8, sre 9,8, pet 9,8     | rasterećenje         |
| 16      | specifično | 90,0 / 90,0  | uto: RP 3 × 2000 m (oporavak 1:30 džog)<br>čet: T 4 × 2000 m (oporavak 1:00 džog) | 22,9 km | pon 11,1, sre 11,1, pet 11,1           | —                    |
| 17      | taper      | 67,5 / 67,5  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 3 × 1600 m (oporavak 1:00 džog) | 17,1 km | pon 7,8, sre 7,8, pet 7,7              | —                    |
| 18      | trka       | 37,0 / 37,0  | čet: RP 3 × 1000 m (oporavak 1:30 džog)                                           | —       | uto 8,1*, sre 8,1*, pet 8,1*           | trka ned (van obima) |

## short-8w-d4-35km-v45 — kratka priprema: 8 ned, 4 dana, 35 km, VDOT 45

- VDOT 45 · prognoza 10K 45:13 · tempo /km: E 5:34–6:08, T 4:38, I 4:16, R 4:01, RP 4:31
- Dani (4): Q1 uto, Q2 čet, dugi ned, lagani sub
- WU/CD kvaliteta: 20/15 min (D14, pojas trenutnog obima)
- Obim: start 35,0 → vrh 44,2 km (granica izgradnje 49,0 km)
- Cilj: nije zadat
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagani (svi)       | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | ------------------ | -------------------- |
| 1       | baza       | 35,0 / 35,0  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,0 km kontinuirano              | 11,5 km | sub 7,3            | —                    |
| 2       | baza       | 37,1 / 37,1  | uto: R 8 × 200 m (oporavak 200 m džog)<br>čet: T 2,5 km kontinuirano              | 12,2 km | sub 7,4            | —                    |
| 3       | razvoj     | 39,3 / 39,3  | uto: I 2 × 1000 m (oporavak 4:00 džog)<br>čet: T 3 × 1000 m (oporavak 1:00 džog)  | 12,9 km | sub 8,4            | —                    |
| 4       | razvoj     | 31,4 / 31,4  | čet: T 2 × 1000 m (oporavak 1:00 džog)                                            | 10,3 km | uto 6,5, sub 6,5   | rasterećenje         |
| 5       | specifično | 41,7 / 41,7  | uto: RP 2 × 1200 m (oporavak 1:00 džog)<br>čet: T 3 × 1200 m (oporavak 1:00 džog) | 13,7 km | sub 9,5            | —                    |
| 6       | specifično | 44,2 / 44,2  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 4 × 1000 m (oporavak 1:00 džog) | 14,5 km | sub 9,9            | —                    |
| 7       | taper      | 33,2 / 33,2  | uto: RP 2 × 1000 m (oporavak 1:00 džog)<br>čet: T 2 × 1200 m (oporavak 1:00 džog) | 10,8 km | sub 5,7            | —                    |
| 8       | trka       | 18,2 / 18,2  | čet: RP 2 × 1000 m (oporavak 1:30 džog)                                           | —       | uto 6,0*, sub 4,0* | trka ned (van obima) |

## short-9w-d5-45km-v50 — kratka priprema: 9 ned, 5 dana, 45 km, VDOT 50, cilj 41:00

- VDOT 50 · prognoza 10K 41:20 · tempo /km: E 5:07–5:38, T 4:15, I 3:55, R 3:41, RP 4:08
- Dani (5): Q1 uto, Q2 čet, dugi ned, lagani pon, sub
- WU/CD kvaliteta: 25/15 min (D14, pojas trenutnog obima)
- Obim: start 45,0 → vrh 59,6 km (granica izgradnje 60,0 km)
- Cilj: 41:00 → realističan (VDOT cilja 50.5, razlika 0.5)
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagani (svi)                 | napomena             |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | ---------------------------- | -------------------- |
| 1       | baza       | 45,0 / 45,0  | uto: R 6 × 200 m (oporavak 200 m džog)<br>čet: T 2,5 km kontinuirano              | 13,5 km | pon 6,0, sub 5,9             | —                    |
| 2       | baza       | 47,7 / 47,7  | uto: R 8 × 200 m (oporavak 200 m džog)<br>čet: T 3,0 km kontinuirano              | 14,3 km | pon 6,3, sub 6,2             | —                    |
| 3       | razvoj     | 50,6 / 50,6  | uto: I 3 × 800 m (oporavak 3:00 džog)<br>čet: T 3 × 1000 m (oporavak 1:00 džog)   | 15,1 km | pon 6,9, sub 6,8             | —                    |
| 4       | razvoj     | 40,5 / 40,5  | čet: T 2 × 1000 m (oporavak 1:00 džog)                                            | 12,0 km | pon 6,3, uto 6,3, sub 6,3    | rasterećenje         |
| 5       | razvoj     | 53,6 / 53,6  | uto: I 3 × 1000 m (oporavak 3:45 džog)<br>čet: T 3 × 1200 m (oporavak 1:00 džog)  | 16,0 km | pon 7,2, sub 7,1             | —                    |
| 6       | specifično | 56,6 / 56,6  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 4 × 1000 m (oporavak 1:00 džog) | 16,9 km | pon 8,5, sub 8,4             | —                    |
| 7       | specifično | 59,6 / 59,6  | uto: RP 4 × 1000 m (oporavak 1:00 džog)<br>čet: T 3 × 1600 m (oporavak 1:00 džog) | 17,8 km | pon 8,6, sub 8,6             | —                    |
| 8       | taper      | 44,7 / 44,7  | uto: RP 2 × 1200 m (oporavak 1:00 džog)<br>čet: T 2 × 1200 m (oporavak 1:00 džog) | 13,3 km | pon 5,7, sub 5,6             | —                    |
| 9       | trka       | 27,1 / 27,1  | čet: RP 2 × 1000 m (oporavak 1:30 džog)                                           | —       | pon 6,5*, uto 6,5*, sub 4,3* | trka ned (van obima) |

## short-8w-d3-25km-v38 — kratka priprema: 8 ned, 3 dana, 25 km, VDOT 38

- VDOT 38 · prognoza 10K 52:15 · tempo /km: E 6:22–7:00, T 5:18, I 4:53, R 4:36, RP 5:14
- Dani (3): Q1 čet, dugi ned, lagani uto
- WU/CD kvaliteta: 15/10 min (D14, pojas trenutnog obima)
- Obim: start 25,0 → vrh 31,6 km (granica izgradnje 35,0 km)
- Cilj: nije zadat
- Upozorenja: nema

| nedelja | faza       | km cilj/plan | kvalitet                                | dugi    | lagani (svi) | napomena             |
| ------- | ---------- | ------------ | --------------------------------------- | ------- | ------------ | -------------------- |
| 1       | baza       | 25,0 / 25,0  | čet: T 2,0 km kontinuirano              | 10,0 km | uto 9,3      | —                    |
| 2       | baza       | 26,5 / 26,5  | čet: T 2,5 km kontinuirano              | 10,6 km | uto 9,7      | —                    |
| 3       | razvoj     | 28,1 / 28,1  | čet: T 2 × 1250 m (oporavak 1:00 džog)  | 11,2 km | uto 10,5     | —                    |
| 4       | razvoj     | 22,5 / 22,5  | čet: T 2 × 1000 m (oporavak 1:00 džog)  | 8,9 km  | uto 7,7      | rasterećenje         |
| 5       | specifično | 29,8 / 29,8  | čet: RP 5 × 500 m (oporavak 1:00 džog)  | 11,9 km | uto 11,1     | —                    |
| 6       | specifično | 31,6 / 31,6  | čet: RP 3 × 1000 m (oporavak 1:00 džog) | 12,6 km | uto 12,0     | —                    |
| 7       | taper      | 23,7 / 23,7  | čet: RP 2 × 1000 m (oporavak 1:00 džog) | 9,4 km  | uto 8,4      | —                    |
| 8       | trka       | 11,2 / 11,2  | čet: RP 2 × 1000 m (oporavak 1:30 džog) | —       | uto 5,2*     | trka ned (van obima) |

## edge-d6-80km-v30 — granični: kapacitet: 6 dana, 80 km, VDOT 30, 14 ned (105 min seče dugi)

- VDOT 30 · prognoza 10K 1:03:49 · tempo /km: E 7:39–8:23, T 6:24, I 5:54, R 5:34, RP 6:23
- Dani (6): Q1 uto, Q2 čet, dugi ned, lagani pon, sre, sub
- WU/CD kvaliteta: 25/15 min (D14, pojas trenutnog obima)
- Obim: start 80,0 → vrh 72,2 km (granica izgradnje 90,0 km)
- Cilj: nije zadat
- Upozorenja: WEEK_FITTED ×9, CAPACITY_LIMITED ×1
- Napomena plana: 6 dana ne nose ovaj obim uz dugi ≤ 105 min. Vrh 72,2 km umesto do 90,0 km (D6).

| nedelja | faza       | km cilj/plan | kvalitet                                                                          | dugi    | lagani (svi)                       | napomena                                 |
| ------- | ---------- | ------------ | --------------------------------------------------------------------------------- | ------- | ---------------------------------- | ---------------------------------------- |
| 1       | baza       | 67,8 / 67,8  | uto: R 10 × 200 m (oporavak 200 m džog)<br>čet: T 4,0 km kontinuirano             | 12,5 km | pon 12,5, sre 12,5, sub 12,5       | izvodljiv cilj (pravilo 80,0 km, naniže) |
| 2       | baza       | 69,0 / 69,0  | uto: R 8 × 300 m (oporavak 300 m džog)<br>čet: T 4,5 km kontinuirano              | 12,5 km | pon 12,5, sre 12,5, sub 12,5       | izvodljiv cilj (pravilo 70,8 km, naniže) |
| 3       | baza       | 69,4 / 69,4  | uto: R 6 × 400 m (oporavak 400 m džog)<br>čet: T 5,0 km kontinuirano              | 12,5 km | pon 12,5, sre 12,5, sub 12,5       | izvodljiv cilj (pravilo 72,0 km, naniže) |
| 4       | baza       | 55,5 / 55,5  | čet: T 3,0 km kontinuirano                                                        | 10,0 km | pon 9,4, uto 9,4, sre 9,4, sub 9,3 | rasterećenje                             |
| 5       | razvoj     | 69,5 / 69,5  | uto: I 3 × 1000 m (oporavak 4:00 džog)<br>čet: T 5 × 1000 m (oporavak 1:00 džog)  | 12,5 km | pon 12,5, sre 12,5, sub 12,5       | izvodljiv cilj (pravilo 72,4 km, naniže) |
| 6       | razvoj     | 70,9 / 70,9  | uto: I 3 × 1200 m (oporavak 4:00 džog)<br>čet: T 4 × 1500 m (oporavak 1:00 džog)  | 12,5 km | pon 12,5, sre 12,5, sub 12,5       | izvodljiv cilj (pravilo 72,5 km, naniže) |
| 7       | razvoj     | 72,2 / 72,2  | uto: I 4 × 1000 m (oporavak 4:00 džog)<br>čet: T 4 × 1600 m (oporavak 1:00 džog)  | 12,5 km | pon 12,5, sre 12,5, sub 12,5       | izvodljiv cilj (pravilo 73,9 km, naniže) |
| 8       | razvoj     | 57,8 / 57,8  | čet: T 3 × 1200 m (oporavak 1:00 džog)                                            | 10,0 km | pon 9,8, uto 9,8, sre 9,7, sub 9,7 | rasterećenje                             |
| 9       | specifično | 70,9 / 70,9  | uto: RP 4 × 1000 m (oporavak 1:00 džog)<br>čet: T 2 × 3200 m (oporavak 1:00 džog) | 12,5 km | pon 12,5, sre 12,5, sub 12,5       | izvodljiv cilj (pravilo 75,2 km, naniže) |
| 10      | specifično | 71,3 / 71,3  | uto: RP 3 × 1500 m (oporavak 1:30 džog)<br>čet: T 6,4 km kontinuirano             | 12,5 km | pon 12,5, sre 12,5, sub 12,5       | izvodljiv cilj (pravilo 73,9 km, naniže) |
| 11      | specifično | 57,0 / 57,0  | čet: T 3 × 1200 m (oporavak 1:00 džog)                                            | 10,0 km | pon 9,6, uto 9,6, sre 9,5, sub 9,5 | rasterećenje                             |
| 12      | specifično | 72,0 / 72,0  | uto: RP 5 × 1000 m (oporavak 1:00 džog)<br>čet: T 2 × 3200 m (oporavak 1:00 džog) | 12,5 km | pon 12,5, sre 12,5, sub 12,5       | izvodljiv cilj (pravilo 74,3 km, naniže) |
| 13      | taper      | 54,2 / 54,2  | uto: RP 3 × 1000 m (oporavak 1:00 džog)<br>čet: T 3 × 1200 m (oporavak 1:00 džog) | 9,3 km  | pon 9,3, sre 9,3, sub 9,2          | —                                        |
| 14      | trka       | 20,0 / 20,0  | čet: RP 3 × 1000 m (oporavak 1:30 džog)                                           | —       | uto 4,4*, sre 4,4*, sub 2,9*       | trka ned (van obima)                     |

## rej-2-days — odbijeni: 2 dana nedeljno

**Odbijeno:**

- `RUN_DAYS_COUNT`: 10K plan v2 radi sa 3–6 dana trčanja (izabrano 2).

## rej-7-days — odbijeni: 7 dana nedeljno

**Odbijeno:**

- `RUN_DAYS_COUNT`: 10K plan traži najmanje jedan dan odmora nedeljno: najviše 6 dana trčanja (izabrano 7).

## rej-3-days-45km — odbijeni: 3 dana, 45 km

**Odbijeno:**

- `WEEKLY_KM_TOO_HIGH`: Trenutni obim 45 km je iznad 40 km za 3 dana trčanja: za 45 km plan podržava 4–6 dana trčanja.

## rej-6-days-30km — odbijeni: 6 dana, 30 km

**Odbijeno:**

- `WEEKLY_KM_TOO_LOW`: Trenutni obim 30 km je ispod 35 km za 6 dana trčanja: za 30 km plan podržava 3–5 dana trčanja.

## rej-7-weeks — odbijeni: 7 nedelja

**Odbijeno:**

- `PLAN_TOO_SHORT`: Plan od 7 nedelja je prekratak: 10K plan traži najmanje 8 nedelja.
