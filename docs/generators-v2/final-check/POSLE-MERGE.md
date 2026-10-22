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
