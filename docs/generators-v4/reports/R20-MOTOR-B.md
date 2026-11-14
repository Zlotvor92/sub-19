# R20 — MOTOR B, 14. 11. 2026 (po Beogradu) — B1, B4 (deo), B5, B6, B7, B2 (deo), dopune (a), MAR (a, c); B3, B8 nisu

Stanje `85d57599`: kapije 0, V4 69 fajlova, 1073 + 24, typecheck čist. Testovi: `distances/longStart`, `warnings20`, `range20`.

## Urađeno
- **B1 `5b99ae85`**: prvi dugi ≤ najduži iz istorije + 2 km (`longFirstCapSec`), plafon ≥ navika (`longHabitSec`).
  MAR P3 B 23,5 → 22,8, p04 23,5 → 21,4, p01 17,5 → 15,5; 10K P3 B najduži 14,5 → 16,6; 5K P3 B 14,2 → 15. Otisci HM
  p02, p05; MAR p01, p02, p04, p05, p09, p14.
- **B7 `fca8d237`**: `pairs/*`, `scenarios/*` bez MORA DA SE RAZLIKUJE, BROJEVI, PROMENA, spiska izvedenih događaja i
  prognoze u STANJE (sve u `pregled.txt`); oznake parova sa stvarnim (skaliranim) km dugih — sudije su čitale
  „15/18 km", a MAR istorija je 17,7/21,3. Novi `pairs/OPIS.md`, `scenarios/OPIS.md` (samo ulazi).
- **B6 `d5146daa`**: bez predloga dodatnog dana uz staž < 13 ned ili tegobu (MAR P2 B); dugi < 0,8 potrebnog →
  predlog kraće distance (P2 B: polumaraton); `dan-izostavljen` ne broji sužavanje (HM p06 „ostaje na 4 dana" nestalo);
  `NoteRule.onlyLongest` — oprema samo uz najduži dugi (MAR p04 9× → 1×); 10K napomena trke + doručak (1 linija).
- **B4 `6180a2ae`** (menja R18 st. 1): sporiji cilj = tempo za trku (MAR p17 4:11 → 4:15); uz „počni sporije" tempo
  = sredina očekivanog i sporije granice raspona, nikad brži od forme (MAR p11 6:24, p13 6:52, p19 5:49). Dve
  prognoze i STANJE ≠ plan rešeni kroz B7. Namerno prepravljeni: round5 R6, paceDirection, testdata/round10.
- **B5 `38eac157`, `c0e518b0`**: spora strana raspona ≥ brza (MAR p12 → 3:45:58–4:33:04, p18 → 4:58:11, HM p10 →
  2:18:56, svi niske pouzdanosti). Po osećaju rečenica kad su km laganih računati sporije od unetog (5K p09/p10/p12/
  p13); posle rezultata rečenica kad uneti lagan tempo protivreči formi (5K s04, s20 …).
- **Dopuna (a) `e5866105`**: nedelja −1: pre laganog dana u odmor otpada DRUGI kvalitet (ne tempo trke); vraćen
  prostor ne diže udeo dugog. 10K `weekMinus1MaxOfPeak` 0,7 (1 linija): p06 −1 78 % → 62 % sa tempom trke, p02 67 %.
  Otisci 10K p01, p06, p11, p12; HM s19 (dugi −1 75 → 70 min).
- **B6 drugi deo `64746524`** (odluka organizatora): činjenice svih upozorenja ostaju, predlozi upozorenja koja nisu
  „info" rangirani po težini — dva prikazana, ostali u „Pomoglo bi i: …" uz drugi. Prepravljeni K3 testovi (≤ 2).
- **B2 deo `b0b39296`**: brzi trening ≤ dugi + 1 min kad doza dozvoljava (5K p15 intervali 7,5 → 6,8 km, HM p06
  tempo trke 10,2 → 9,2 km); otisci 5K p02, p09, p15, HM p06. 5 × 300 m (p15) ni na najmanjoj dozi ne staje.
- **MAR (a, c) `85d57599`**: pred pripremnu trku ≥ 75 min dan pre ≤ 30 min, dva dana pre ≤ 60 % (MAR p05 nedelja
  116 → 98,5 km); rastezanje koraka ≤ 2 km (K7, bez promene plana). Otisci HM p04, p09; MAR p03–p05, p07–p09,
  p12, p14–p18.

## Nije urađeno
- B2 (odluka: dugi ≥ 1,4 × 30 min, manje dana): dugi 34 → 42 min i spajanje laganih dana (bez gubitka obima) daju
  4 dana po 29 min u ned 1 i 3, ali ned 1 gubi drugi kvalitet (2 → 1), F7 (nedelja gradnje bez brzog) i M20 padaju,
  ned 2 ostaje 22 min — vraćeno. roomFor sa danom manje ruši HM p06 — vraćeno.
- B3 (b) usko (> +15 % prema prethodnoj i tri teška dana → brzi lagan): 35 ispisa promenjeno, kapije 10K 2 i MAR 1
  prekršaj, a 10K p05 i dalje +21 % (106,6 → 104,3), p11 bez promene — vraćeno. Opšte ≤ +15 % ruši MAR vrh.
- B3 (a): usponi/fartlek nemaju manji oblik istog podražaja, pa skraćivanje doze (× 1,3 najdužeg laganog) ne deluje
  na 5K p10 / 10K p11, a menja 23 plana — vraćeno; treba unos manje doze u biblioteke (podatak).
- B8 nije započet. Prettier je preformatirao ceo `build.ts`, `guard.ts`, `plan.ts`, `render.ts`.
