# R17 — maraton tab (podatak), 13. 11. 2026, po Beogradu

Nalog R17, izvor `coach/ROUND-V4-MAR-02.md` § D4–D5. Menjani su samo `distances/marathon/` i `plans/MAR/`; ispisi
HM, 10K i 5K su bajt-isti. Kapija MAR: 0 prekršaja, 19/19. Testovi maratona: 110 prolaze, 4 `it.fails`, 0 pada.

| stavka | urađeno | broj (pre → posle) |
|---|---|---|
| (1) dugi ≥ 26 km kod vrha ≥ 52 km | namera dugog u telu od 90 % najdužeg (bilo 80 %); korak dugog 1,5 km (bilo 1,3); polazni dugi 4 dana 40 %, 5 dana 34 % nedelje; provera `dugi-za-distancu` na 26 km (presuda MAR-01 § E1) | p01 25,5 (bez promene, kapija 25,5 sa zaokruživanjem); p06 24 → 24,5 (12 nedelja); p09 27 → 28; p11 24,8 → 25,5; p16 26,7 → 27,5 |
| (2) p07 30–32 km | isti zahvat, N−7 dugi 92 % najdužeg | p07 28,5 → 30 km (N−5 i N−3 po 30, blok 12,5 km) |
| (3) dugi ne stoji | talas 100/88/100/82 % u nameri i na plafonu; povratnik bez progresivnog dugog | p17 ned 1–4: 27,5 × 4 → 29-28-30-28; p05 31,5 × 6 → 32-29-32-32-33-24-34; p04 21 × 8 → 24/22 naizmenično |
| (4) testovi pravila motora | `scenarios.test.ts`: lestvica dugog posle prekida (`returnKeepLong`: dugi ≥ 26 km pre sužavanja, rast ≤ +20 min) nad E2 i s27; E5 (`afterLongRace`: dve nedelje dugi ≤ 60 %, nedelja ≤ 75 % obima) nad s17 i s20 | oba prolaze |

`target-compare` 21 od 78 nedelja (bilo 18). Nalazi čuvara na 19 profila: 0.

**Šta nije stiglo do cilja i zahtevi za motor:**
1. p06 24,5 km i p01 25,5 km (trener ≥ 26). p06: plan traje 12 nedelja, polazni dugi je 15 km, provera u ned 4 je bez dugog.
   Korak 1,5 km nedeljno ne stiže dalje. Korak od 1,7 km daje 25 km, ali obara K7 kod povratnika: dugi raste
   16,1 → 18,2 km (+13 %), jer motor zaokružuje dan na 0,5 km posle koraka. **Zahtev:** korak dugog u km bez
   zaokruživanja naviše (ili zaokruživanje naniže) — tada podatak može na 1,7–1,8 km i p06 stiže do 26 km.
2. Plato posle pripremnog polumaratona (p05 32-33-32, p17 28-29-28 u N−8 do N−6). Pod dugog u nedelji gradnje je
   polazni dugi, pa talas ne može ispod njega. **Zahtev:** talas sme ispod polaznog dugog (npr. do 85 %) i van
   plafona.
3. p04 (spor, 3 h 10 = 27,6 km): dugi naizmenično 24/22 km (2 h 50 / 2 h 35) do ned 18; vreme je plafon nivoa,
   pa sporiji trkač nema prostora za rast. Pitanje za trenera: 3 h 15 za spor nivo?
4. Iz MAR-02 § D (motor): t. 1 „4 dana zaredom" briše kvalitet; t. 2 s28 N−2 dugi 24–26 lagano; t. 3 upozorenje
   `obim-za-nivo` kod p04/p16. D6 (P2 B predlog polumaratona) je tekst motora.
