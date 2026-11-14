# R22 — PODATAK HM (stanje `5d55b16f` → ovaj commit), 14. 11. 2026

Izmene samo u `distances/hm/` (templates, safety, otisci) i ispisima `plans/HM/`. Motor nije diran. p01, p02, p04, p05,
p07, p09, vlasnik-v1/v2 bajt-isti; 10K/MAR/5K bajt-isti.

| profil | pre | posle |
|---|---|---|
| p12 | dugi 1 h 40 × 3 (ned 1–3), 1 h 50 / 1 h 50 / 1 h 55 (5–7); prvi tempo trke ned 11 | dugi 1 h 40 → 1 h 45 → 1 h 50, pa 2 h / 2 h 05 / 2 h 06; ned 7 dugi sa 16 min tempa trke na kraju (namera početnika: `len` 0,745 → 1) |
| p08 | dugi 19,5 km ned 1–3, 5–7, 9; obim 44,7–48,3 km 11 nedelja; ned 17 25 % (prag 2 × 8 + blok 10 km) | talas po bloku: 19,5 / 20 / 21 · 20 / 20,5 / 21,5 · 20 / 21 / 21,5 km; obim 44,7 → 49,3; ned 17 20 % (prag 3 × 6 + blok 7,5 km) |
| p03 | ned 13 25 % (prag 2 × 15 + 35 min tempa trke u dugom), 37,3 km | ned 13 18 % (prag 15 min + 28 min u dugom), 34,1 km; dugi ned 2–7 13 → 17 km |
| p10 | ned 17 25 % (prag 2 × 15 + 35 min); dugi 1 h 56 / 1 h 55 / 2 h 01 (ned 9–11) | ned 17 20 % (prag 2 × 9 + 33 min); dugi 1 h 56 / 2 h / 2 h 06; ned 5–7 15,3 → 16,7 km |
| p06 | vrh 49 km (× 1,40), dugi najviše 16,5 km, tempo trke 4,5 / 2 × 2,5 / 3 × 2 km | vrh 50,5 km (× 1,44), dugi 18 km jednom (ned 5), tempo trke 4,5 / 2 × 3,5 / 3 × 2 km; lagani i dalje 31 min |
| p11 | dugi ned 11 / 13 1 h 40 / 1 h 50 | 1 h 45 / 1 h 45 (namera početnika); rani blok tempa trke samo sa 5+ dana — sa 4 dana obara rampu posle bola (s15) |

Pravila (podaci): 1–3 dana — dugi u bloku gradnje 0,85 / +0,035 / +0,035, svaki blok +0,015 najdužeg; N−3 blok 0,7, usred
nedelje prag 0,45 umesto tempa trke, opterećenje 0,88, N−1 dugi 0,55. Lestvica vrha 32,5–35,5 km < 12 nedelja × 1,58 (bilo
1,47; vlasnik-v1 sa 30 km ostaje na 1,47). Nalazi čuvara: p08 `ispod-cilja@17` nestao, novih nema. Kapija HM 0.

Očekujem od trenera: p12 i p08 preko 80 (rast dugog, nema 25 % nedelje); p03/p10 bezbednost 8; p06 mali pomak (+1–2).

**MOTOR**
1. Upozorenje „3 dana" (p03, p10) je tekst u `engine/guard.ts`: dodati rečenicu „sa 3 dana računaj na današnju formu,
   ne na napredak" (trener § D4).
2. p06 lagani dani 35–40 min: `layoutWeek` (obim po minutima) seče lagan dan na `minEasy` nivoa i višak daje kvalitetu;
   veći vrh (× 1,6–1,7) dodaje drugi kvalitet u ned 2 i obara K7 (prvi prag > 70 %). Treba: višak obima ide u lagane dane.
3. p06 ned 1 i dalje 116 % polaznog obima (R20 MOTOR 1).
4. Sa 3 dana dan kvaliteta se ne dopunjuje laganim — kraći kvalitet spušta obim nedelje (p03 ned 13 34,1 km), a
   plafon tempa trke pretvara isečen tempo trke u prag PUNE doze (izvor 25 % nedelje kod p03, p08, p10).
5. R16 (tempo trke usred nedelje ≥ prethodni prag) ne dozvoljava kratak tempo trke 2 × 8 min usred nedelje posle praga
   2 × 13 (p12) — zato je prvi tempo trke u dugom.

Provera: V4 skup 1088 + 17 (69 fajlova), typecheck čist, kapija HM 0; otisci HM p03, p06, p08, p10, p11, p12 namerno promenjeni.
