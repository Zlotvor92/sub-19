# 5K v2 — primeri Segmenta 07 (5k-v2.6.0)

Generisano: `node docs/5k-v2/artifacts/segment-07/run.ts`. Činjenice: `inputs.json`; reasons, koraci i
nedelje: `<primer>.json`. Kontinuirani plan: faza ((r) = rasterećenje), cilj / planirano km, kvalitet.
Trčanje/hodanje: nivo po danu (`*` = projekcija, nivo zavisi od pretpostavljenih sesija).
Kolona „c9003aa": iste činjenice na polaznom commitu (`c9003aa.json`, pokrenuto u worktree-ju c9003aa;
tamo nema coverage, pa su činjenice potpune od prvog zapisa).

## dev-04-pauza-20

dev-04 (VDOT ~50, 35 km, 4 dana, 14 ned), pauza 20 dana do kraja nedelje 7, potpun zapis

Reasons:
- PAUSE: Pauza 20 dana (obim 7 dana pre pauze 33.9 km): cilj 23.7 km; prva nedelja bez kvaliteta, druga 1 kvalitet. Povratak do 40.8 km (nivo pre smanjenja) po +10%/ned u svim fazama osim tapera i trkačke nedelje.
- UNDER_EXECUTION (nije primenjeno): Izvršeno 0 od 45.5 km u 7 dana (< 60%): nadjačano ili nema sledeće nedelje izgradnje.

| Ned | Plan generatora | c9003aa (posle adaptacije) | 5k-v2.6.0 (posle adaptacije) |
|---|---|---|---|
| 1 | base 35, R + T_short | base 35 / 35, R + T_short | base 35 / 35, R + T_short |
| 2 | base 37.8, R + T_short | base 37.8 / 37.8, R + T_short | base 37.8 / 37.8, R + T_short |
| 3 | base 40.8, R + T_short | base 40.8 / 40.8, R + T_short | base 40.8 / 40.8, R + T_short |
| 4 | base (r) 32.6, R | base (r) 32.6 / 32.6, R | base (r) 32.6 / 32.6, R |
| 5 | base 44, R + T_short | base 44 / 44, R + T_short | base 44 / 44, R + T_short |
| 6 | peak 45.5, I + T_cruise | peak 45.5 / 45.5, I + T_cruise | peak 45.5 / 45.5, I + T_cruise |
| 7 | peak 45.5, I + T_cruise | peak 45.5 / 45.5, I + T_cruise | peak 45.5 / 45.5, I + T_cruise |
| 8 | peak (r) 36.4, I | peak (r) 23.7 / 23.7, — | peak (r) 23.7 / 23.7, — |
| 9 | peak 45.5, I + T_cruise | peak 25.5 / 25.5, I | peak 26 / 26, I |
| 10 | sharpen 45.5, RP + R_sharpen | sharpen 25.5 / 25.5, RP + R_sharpen | sharpen 28.6 / 28.6, RP + R_sharpen |
| 11 | sharpen 45.5, RP + R_sharpen | sharpen 25.5 / 25.5, RP + R_sharpen | sharpen 31.4 / 31.4, RP + R_sharpen |
| 12 | taper 38.7, RP + T_short | taper 21.7 / 21.7, RP + T_short | taper 26.7 / 26.7, RP + T_short |
| 13 | taper 31.9, RP | taper 17.8 / 17.8, RP | taper 22 / 22, RP |
| 14 | race 19.49, RP_sharpener | race 12.73 / 12.73, RP_sharpener | race 15.36 / 15.36, RP_sharpener |

## d5-30km-pauza-35

5 dana, 30 km, VDOT ~45, 12 ned; pauza 35 dana do kraja nedelje 6, potpun zapis

Reasons:
- PAUSE: Pauza 35 dana (obim 7 dana pre pauze 30 km): cilj 15 km; prva nedelja bez kvaliteta, druga 1 kvalitet; nov start (faze preostale izgradnje ponovo). Povratak do 30 km (nivo pre smanjenja) po +10%/ned u svim fazama osim tapera i trkačke nedelje.
- UNDER_EXECUTION (nije primenjeno): Izvršeno 0 od 39 km u 7 dana (< 60%): nadjačano ili nema sledeće nedelje izgradnje.

| Ned | Plan generatora | c9003aa (posle adaptacije) | 5k-v2.6.0 (posle adaptacije) |
|---|---|---|---|
| 1 | base 30, R + T_short | base 30 / 30, R + T_short | base 30 / 30, R + T_short |
| 2 | base 32.4, R + T_short | base 32.4 / 32.4, R + T_short | base 32.4 / 32.4, R + T_short |
| 3 | base 34.9, R + T_short | base 34.9 / 34.9, R + T_short | base 34.9 / 34.9, R + T_short |
| 4 | base (r) 27.9, R | base (r) 27.9 / 27.9, R | base (r) 27.9 / 27.9, R |
| 5 | peak 37.6, I + T_cruise | peak 37.6 / 37.6, I + T_cruise | peak 37.6 / 37.6, I + T_cruise |
| 6 | peak 39, I + T_cruise | peak 39 / 39, I + T_cruise | peak 39 / 39, I + T_cruise |
| 7 | peak (r) 31.2, I | base 25 / 25, — | base 15 / 15, — |
| 8 | sharpen 39, RP + R_sharpen | peak 27 / 27, I | peak 16.5 / 16.5, I |
| 9 | sharpen 39, RP + R_sharpen | sharpen 27 / 27, RP + R_sharpen | sharpen 18.1 / 18.1, RP + R_sharpen |
| 10 | taper 33.2, RP + T_short | taper 25 / 25, RP + T_short | taper 15.4 / 15.4, RP + T_short |
| 11 | taper 27.3, RP | taper 25 / 25, RP | taper 12.7 / 12.7, RP |
| 12 | race 16.02, RP_sharpener | race 13.5 / 13.5, RP_sharpener | race 7.22 / 7.22, RP_sharpener |

## dev-04-nepotpun-unos

dev-04, asOf kraj nedelje 7; zapisi do asOf − 5, poslednjih 5 dana bez zapisa, coverage.complete = false

Reasons:
- — (nijedan uslov nije aktivan)

| Ned | Plan generatora | c9003aa (posle adaptacije) | 5k-v2.6.0 (posle adaptacije) |
|---|---|---|---|
| 1 | base 35, R + T_short | base 35 / 35, R + T_short | base 35 / 35, R + T_short |
| 2 | base 37.8, R + T_short | base 37.8 / 37.8, R + T_short | base 37.8 / 37.8, R + T_short |
| 3 | base 40.8, R + T_short | base 40.8 / 40.8, R + T_short | base 40.8 / 40.8, R + T_short |
| 4 | base (r) 32.6, R | base (r) 32.6 / 32.6, R | base (r) 32.6 / 32.6, R |
| 5 | base 44, R + T_short | base 44 / 44, R + T_short | base 44 / 44, R + T_short |
| 6 | peak 45.5, I + T_cruise | peak 45.5 / 45.5, I + T_cruise | peak 45.5 / 45.5, I + T_cruise |
| 7 | peak 45.5, I + T_cruise | peak 45.5 / 45.5, I + T_cruise | peak 45.5 / 45.5, I + T_cruise |
| 8 | peak (r) 36.4, I | peak (r) 29.1 / 29.1, I | peak (r) 36.4 / 36.4, I |
| 9 | peak 45.5, I + T_cruise | peak 31.4 / 31.4, I + T_cruise | peak 45.5 / 45.5, I + T_cruise |
| 10 | sharpen 45.5, RP + R_sharpen | sharpen 31.4 / 31.4, RP + R_sharpen | sharpen 45.5 / 45.5, RP + R_sharpen |
| 11 | sharpen 45.5, RP + R_sharpen | sharpen 31.4 / 31.4, RP + R_sharpen | sharpen 45.5 / 45.5, RP + R_sharpen |
| 12 | taper 38.7, RP + T_short | taper 26.7 / 26.7, RP + T_short | taper 38.7 / 38.7, RP + T_short |
| 13 | taper 31.9, RP | taper 22 / 22, RP | taper 31.9 / 31.9, RP |
| 14 | race 19.49, RP_sharpener | race 15.36 / 15.36, RP_sharpener | race 19.49 / 19.49, RP_sharpener |

## rw-10-projekcija

trčanje/hodanje, početnik, uto/čet/sub, 10 ned, bez tempa — projekcija generatora

| Ned | Pre (generator) | Posle | Napomena |
|---|---|---|---|
| 1 | L1, L1, L2* | L1, L1, L2* |  |
| 2 | L2*, L3*, L3* | L2*, L3*, L3* |  |
| 3 | L4*, L4*, L5* | L4*, L4*, L5* |  |
| 4 | L5*, L6*, L6* | L5*, L6*, L6* |  |
| 5 | L7*, L7*, L8* | L7*, L7*, L8* |  |
| 6 | L8*, L9*, L9* | L8*, L9*, L9* |  |
| 7 | L10*, L10*, L11* | L10*, L10*, L11* |  |
| 8 | L11*, L12*, L12* | L11*, L12*, L12* |  |
| 9 | L12*, L12*, L12* | L12*, L12*, L12* |  |
| 10 | L11*, L11*, trka L12* | L11*, L11*, trka L12* | Trka 5 km — trčanje bez prekida; cilj: završiti |

## rw-10-posle-3-ned

isti plan posle 3 nedelje: 5 sesija (RPE 5, 5, 7, 5, 5), zatim pauza 10 dana do kraja nedelje 3

Reasons:
- PAUSE: Pauza 10 dana: nivo L3 → L2.
- FATIGUE: 1 sesija sa RPE ≥ 7: nivo se na njima ne povećava.
- LEVEL: Nivo 2026-11-22: L2 (bilo L1; +2 posle po 2 uzastopne sesije RPE ≤ 6 bez bola); ostatak projekcije od L2.

| Ned | Pre (generator) | Posle | Napomena |
|---|---|---|---|
| 1 | L1, L1, L2* | L1, L1, L2* |  |
| 2 | L2*, L3*, L3* | L2*, L3*, L3* |  |
| 3 | L4*, L4*, L5* | L4*, L4*, L5* |  |
| 4 | L5*, L6*, L6* | L2, L2, L3* | promenjeno |
| 5 | L7*, L7*, L8* | L3*, L4*, L4* | promenjeno |
| 6 | L8*, L9*, L9* | L5*, L5*, L6* | promenjeno |
| 7 | L10*, L10*, L11* | L6*, L7*, L7* | promenjeno |
| 8 | L11*, L12*, L12* | L8*, L8*, L9* | promenjeno |
| 9 | L12*, L12*, L12* | L9*, L10*, L10* | promenjeno |
| 10 | L11*, L11*, trka L12* | L10*, L10*, trka L11* | Trka 5 km — 25:00 trčanje / 1:00 hod (odnos nivoa L11); cilj: završiti |

## rw-16-prelaz

trčanje/hodanje, početnik, E 7:00, 16 ned; sve sesije RPE 5 do kraja nedelje 8 → L12 → prelaz

Reasons:
- LEVEL: Nivo 2026-12-27: L12 (bilo L1; +11 posle po 2 uzastopne sesije RPE ≤ 6 bez bola); ostatak projekcije od L12.
- TRANSITION: L12 dostignut, do trke 8 nedelja: od nedelje 9 kontinuirani plan početnika (po osećaju, 12.9 km = 3 × 30 min tipičnim laganim tempom), isti konstruktor kao generator.

| Ned | Pre (generator) | Posle | Napomena |
|---|---|---|---|
| 1 | L1, L1, L2* | L1, L1, L2* |  |
| 2 | L2*, L3*, L3* | L2*, L3*, L3* |  |
| 3 | L4*, L4*, L5* | L4*, L4*, L5* |  |
| 4 | L5*, L6*, L6* | L5*, L6*, L6* |  |
| 5 | L7*, L7*, L8* | L7*, L7*, L8* |  |
| 6 | L8*, L9*, L9* | L8*, L9*, L9* |  |
| 7 | L10*, L10*, L11* | L10*, L10*, L11* |  |
| 8 | L11*, L12*, L12* | L11*, L12*, L12* |  |
| 9 | L12*, L12*, L12* | kontinuirano: base 12.9 / 12.9 km, ubrzanja | kontinuirani plan početnika (prelaz) |
| 10 | L12*, L12*, L12* | kontinuirano: base (r) 10.3 / 10.3 km, ubrzanja | kontinuirani plan početnika (prelaz) |
| 11 | L12*, L12*, L12* | kontinuirano: peak T 13.5 / 13.5 km, TEST_3K | kontinuirani plan početnika (prelaz) |
| 12 | L12*, L12*, L12* | kontinuirano: peak 14.1 / 14.1 km, FARTLEK | kontinuirani plan početnika (prelaz) |
| 13 | L12*, L12*, L12* | kontinuirano: sharpen 14.1 / 14.1 km, FARTLEK_RP | kontinuirani plan početnika (prelaz) |
| 14 | L12*, L12*, L12* | kontinuirano: taper 12 / 12 km, FARTLEK_RP | kontinuirani plan početnika (prelaz) |
| 15 | L12*, L12*, L12* | kontinuirano: taper 9.9 / 9.9 km, FARTLEK_RP | kontinuirani plan početnika (prelaz) |
| 16 | L11*, L11*, trka L12* | kontinuirano: race 7.1 / 7.1 km, FARTLEK_RP | kontinuirani plan početnika (prelaz) |

Kontinuirani deo (od nedelje 9): beginner, feel, start 12.9 km, vrh 14.1 km.

