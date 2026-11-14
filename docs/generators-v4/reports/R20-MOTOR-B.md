# R20 — MOTOR B, 14. 11. 2026 (po Beogradu) — B1, B4–B7, B2 (deo), dopune (a), MAR, (I)–(IV); B3, B8 nisu

Stanje `54c05dc5`: kapije 0, V4 69 fajlova, 1088 + 17, typecheck čist. Testovi: `distances/longStart`, `warnings20`, `range20`.

## Urađeno
- **B1 `5b99ae85`**: prvi dugi ≤ najduži iz istorije + 2 km (`longFirstCapSec`), plafon ≥ navika (`longHabitSec`).
  MAR P3 B 23,5 → 22,8, p04 23,5 → 21,4, p01 17,5 → 15,5; 10K P3 B najduži 14,5 → 16,6; 5K P3 B 14,2 → 15. Otisci HM
  p02, p05; MAR p01, p02, p04, p05, p09, p14.
- **B7 `fca8d237`**: ispis za sudije bez nagoveštaja (u `pregled.txt`), oznake parova sa stvarnim km, `OPIS.md`.
- **B6 `d5146daa`, `64746524`**: bez dodatnog dana uz kratak staž/tegobu; kraća distanca (MAR P2 B); sužavanje nije
  „izostavljen dan"; oprema 1× (`onlyLongest`); 10K doručak; dva predloga, ostali u „Pomoglo bi i: …".
- **B4 `6180a2ae`** (menja R18 st. 1): sporiji cilj = tempo za trku (MAR p17 4:11 → 4:15); uz „počni sporije" tempo
  = sredina očekivanog i sporije granice raspona, nikad brži od forme (MAR p11 6:24, p13 6:52, p19 5:49). Dve
  prognoze rešene kroz B7. Prepravljeni: round5 R6, paceDirection, testdata/round10.
- **B5 `38eac157`, `c0e518b0`**: spora strana raspona ≥ brza (MAR p12 → 3:45:58–4:33:04, p18 → 4:58:11, HM p10 →
  2:18:56, svi niske pouzdanosti). Po osećaju rečenica kad su km laganih računati sporije od unetog (5K p09/p10/p12/
  p13); posle rezultata rečenica kad uneti lagan tempo protivreči formi (5K s04, s20 …).
- **Dopuna (a) `e5866105`**: nedelja −1: pre laganog dana u odmor otpada DRUGI kvalitet (ne tempo trke); vraćen
  prostor ne diže udeo dugog. 10K `weekMinus1MaxOfPeak` 0,7 (1 linija): p06 −1 78 % → 62 % sa tempom trke, p02 67 %.
  Otisci 10K p01, p06, p11, p12; HM s19 (dugi −1 75 → 70 min).
- **B2 deo `b0b39296`**: brzi trening ≤ dugi + 1 min kad doza dozvoljava (5K p15 intervali 7,5 → 6,8 km, HM p06
  tempo trke 10,2 → 9,2 km); otisci 5K p02, p09, p15, HM p06. 5 × 300 m (p15) ni na najmanjoj dozi ne staje.
- **MAR (a, c) `85d57599`**: pred pripremnu trku ≥ 75 min dan pre ≤ 30 min, dva dana pre ≤ 60 % (MAR p05 nedelja
  116 → 98,5 km); rastezanje koraka ≤ 2 km (K7, bez promene plana). Otisci HM p04, p09; MAR p03–p05, p07–p09,
  p12, p14–p18.

- **(II) `ab14fe8c`**: bez rezultata vreme iz laganog tempa ≥ (lagan − 30/45/60/75 s/km za 42,2/21,1/10/5 km;
  početnik ⅔): MAR p10 4:30 → 4:55, p18 → 5:02, HM p10 2:21. Četiri „ČEKA FORMU" sada prolaze; E6 Z4 ne za po osećaju.
- **(I) `870a0ccf`**: upozorenje obim/dugi/priprema → kazna 0,12 × manjak (≤ 8 %), bez napretka, spora strana +2 ×
  kazna, rečenica „X sporije od današnje forme"; tempo za trku oprezan: MAR p03 6:52, p06 4:05 → 4:19, p13 7:22,
  p19 6:20/km. Bez kazne ko je ciljnu dužinu već istrčao. MAR gate p01/p06/p07 sada prolaze.
- **MAR 1–3, IV `0d553f3a`, `ffe3386b`, `97e86fe2`, `54c05dc5`**: upozorenje bez predloga ide u red „Pomoglo bi i";
  probni „+1 dan" dodaje 40 min na obim (MAR p03 → 54,4 km, p13 dugi 21,2); `longStepShareByLevel` (MAR brz 0,12,
  ≤ 2 km: p06 dugi 26 → 26,5, vrh 55,3 → 56,7 — 30 km / 65 km ne staje); tekst kratke pripreme i upozorenje nivoa
  iz `texts` distance (5K p13 hod-trk, p14). Otisci MAR p05, p06.
## Nije urađeno
- B2 po odluci (dugi 42 min + manje dana): 5K p06 ned 1 gubi drugi kvalitet, F7 i M20 padaju — vraćeno.
- B3 (b) usko: 35 ispisa, kapije 10K 2 + MAR 1, 10K p05 i dalje +21 % — vraćeno. B3 (a): usponi/fartlek bez manjeg
  oblika u biblioteci — treba podatak.
- B8 nije započet. Prettier je preformatirao ceo `build.ts`, `guard.ts`, `plan.ts`, `render.ts`.
