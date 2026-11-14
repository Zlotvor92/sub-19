# R20 — MOTOR B, 14. 11. 2026 (po Beogradu) — B1, B4 (deo), B5, B6 (deo), B7, dopuna (a); B2, B3, B8, (b) nisu

Stanje `e5866105`. Kapije HM/10K/5K/MAR 0. V4: 69 fajlova, 1071 prolazi, 24 očekivano pada; typecheck čist. Ispisi
sve 4 distance obnovljeni. Novi testovi: `distances/longStart.test.ts`, `warnings20.test.ts`, `range20.test.ts`.

## Urađeno
- **B1 `5b99ae85`**: prvi dugi ≤ najduži iz istorije (ili uneti) + 2 km, na 5 min naniže (`longFirstCapSec`); bez
  podatka procena 1,5 × prosečan dan, samo za dugi > 90 min i pripremu ≥ `longCheckMinWeeks`. Plafon dugog ≥ drugi
  najduži nedeljni dugi u 4 nedelje (`longHabitSec`, ostaje i posle promene dana). Ned 1 / najduži: MAR P3 B 23,5 →
  22,8; MAR p04 23,5 → 21,4; p01 17,5 → 15,5; p02 17,5 → 15; p05 32 → 29 (najduži 35 ostaje); 10K P3 B 14 → 15,3,
  najduži 14,5 → 16,6 (istorija 16,4); 5K P3 B najduži 14,2 → 15. Otisci: HM p02, p05; MAR p01, p02, p04, p05, p09, p14.
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

## Nije urađeno
- B2: 5K p06 — lagan ≤ 0,8 dugog (34 min) ne dozvoljava dane od 30 min; spajanje dana gubi obim (vrh 31 → 29,5) i
  ruši silazak. Treba duži dugi za 5K p06 (podatak) ili odluka o udelu laganog. „Brzi ≤ dugi" nije započet.
- B3: skok ≤ +15 % posle rasterećenja (`weekTarget`) ruši MAR (11 prekršaja, p01 vrh pada) — vraćeno; doze uspona/
  fartleka po obimu nisu započete.
- B6 „najviše dve preporuke": AGENTS § 6 i K3 traže predlog u svakom upozorenju — treba odluka (spajanje upozorenja).
- (b) 10K p08 ned 1 = 41 km: pun polazni dugi daje +0,5 km i HM p08 ned 1 dugi 19,5 → 22 km — vraćeno; potreban
  dugi ≈ 17 km > polazni 100 min (podatak `longStartShare` 10K). Udeo doze tempa trke 0,13 briše tempo trke u −1.
- B8 (M22, `LATE_BUILD_WEEKS`) nije započet. Prettier je preformatirao ceo `build.ts`, `guard.ts`, `plan.ts`, `render.ts`.
