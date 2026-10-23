# Posle merge-a u main — odloženo (organizator, 22. 10.)

Skup provera za merge je zaključan (`run-all.sh`). Ovde su stavke svesno odložene za dubinsku reviziju (AUDIT-PLAN),
sa razlogom zašto ne blokiraju merge.

| stavka | zašto ne blokira | izvor |
|---|---|---|
| Plauzibilnost ulaza: početnik × VDOT, VDOT × nedeljni obim, `recentLongRunKm` prema km/dani (npr. 45 km u 3 dana uz najduži 5 km) | nerealni ulazi; plan se ne odbija ili se odbija sa porukom | edges.ts, ODLUKE-4a „realni trkač" |
| HM invarijanta „povratni rast > nivo ned 2" 31 na 3 d / 45 km / rl 5 | nemoguć ulaz (gore); plan prihvaćen, prijavljuje samo test invarijanta | edges.ts HM |
| 5K QUALITY_INFEASIBLE 2 na 3 d / 12 km / VDOT 60 | nerealan ulaz; odbijanje sa porukom | edges.ts 5K |
| lib.ts KM5K bez gornjih ivica (35/45/65) | pokriveno edges.ts i trajnom mrežom 5K-08k | 5K-08j/k |
| Maraton v2 → 10K v2 u E2E (10K dolazi samo kad HM nije dostupan) | pokriveno domenskim testovima 3d-10K | 3g „Otvoreno" |
| HM/5K/maraton „rasterećenje nije niže od prethodne nedelje" (HM 118, 5K 19, maraton 178) | odluka cilja nedelje, zapisano u DECISIONS | HM-08, MAR-08, mixed-deload |
| Pouka 37: prag viška za otpadanje kvaliteta (npr. višak ≤ 10 % cilja → kvalitet ostaje uz upozorenje) | sada Q2 otpada i za mali višak kad time staje → doza ne napreduje, kaskada cilja ±0,1–1,6 km (maraton: 17/66 tokova); novo pravilo u 4 foldera | MAR-08 otvoreno 2 |
| 5K: provera „zadržana doza staje u plafon trajanja na novom tempu" i za I_REP / T_CONTINUOUS (4 putanje sa istim obrascem kao R_REP) | nijedna putanja ne dostiže plafon (edges 15 800 + pretraga sporijih rezultata 11 988 tokova) — nema toka za test ni sabotažu; dodati čim se nađe tok | 5K-08k |
| 3i: polja Reason.week / Violation.week ostaju v2 indeks (bez weekOffset) | UI ih za v2 ne prikazuje (grep features/); ako se ikad prikažu → kroz weekLabel | 3i otvoreno 2 |

## Dubinska provera (23. 10.) — svesno odloženo posle ispravki 5K-09 / 10K-07 / HM-09 / MAR-09

Izvor: `docs/generators-v2/audit/*/REPORT.md`, odluke `docs/generators-v2/AUDIT-REPORT.md`.

| stavka | zašto ne blokira | izvor |
|---|---|---|
| Lagan ≥ 0,9 × dugi / lagan = dugi u izgradnji (10K 28 %, MAR 33 %, 5K 17 %, HM 16 %), lagan < 20 min | plan prolazi pravila; trenerska odluka za sve 4 (više dana, manji cilj ili plafon laganog prema dugom) — jedno pravilo, ne po distanci | 1a M1/M5/M6, 1b #4 |
| Kvalitet/MP duži od dugog u taperu (MAR 70,6 %), 5K kvalitet duži od dugog bez pravila (F4) | mišljenje; HM pouka 35 u taperu ispravljena u HM-09 | 1b #3, fuzz F4 |
| Usklađivanje pravila među distancama: test u mešovitoj nedelji (C3), urađen dan posle asOf (C4), redosled pouke 30 u 5K (C5), progresija doze posle bola (C6), opseg pouke 35 (C11), najniži MP/RP (C12), ponovljen bol (C14), MIXED_OVER_TARGET kodovi (C9) | utvrđeno čitanjem koda, tokovi nisu mereni; svaka stavka traži odluku i meru u 4 foldera | consistency C3–C14 |
| Plauzibilnost ulaza: najduži > nedeljni obim (L1), najduži < obim/dani (L2), VDOT ≥ 60 uz ≤ 30 km | nerealni ulazi; plan se pravi ili odbija sa porukom | consistency d |
| 5K 4 dana: 98/245 kombinacija RUN_DAYS_SPACING | odbijanje sa porukom (dokumentovano); predlog: pad na 1 kvalitet | fuzz sharpen5k |
| 10K/HM/maraton pauza 35: taper bez kvaliteta, trkačka bez oštrenja, 5K 2 ned tapera posle nov starta | poznata klasa N5; trenerska odluka | 1a, 1b |
| Profil 5K (20:25 → < 20:00, 4 d, 30 km): tanak VO2/RP, rasterećenje u ned 4/8, taper 2 ned | mišljenje; pravila plan ne krši | 1a |
| 5K trčanje/hodanje: plato L12, trka duža od najdužeg trčanja; početnik: prvi test u ned 4 | mišljenje | 1a |
| Maraton po osećaju ispod 26 km: bez ponude „kraća distanca" | po dizajnu (shorter.ts) | app A4 |
| Test 5K/10K vraćanja verzije u E2E, lični plan bajt-isti u E2E | pokriveno domenom; E2E rupa | app |
