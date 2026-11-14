# R22 — MOTOR A (događaji), 14. 11. 2026 (po Beogradu) — A1, A2, A3 urađeni; A4 i A5 delom
Poslednji commit `baf63b51`. V4 74 fajla, 1121 prolazi + 12 očekivano pada (polazno 69 / 1088 + 17; razlika = 5 novih
fajlova svojstava i izmene tabova B/distanci). Typecheck 0, kapije HM/10K/5K/MAR 0, ispisi sve 4 distance obnovljeni.
## A1 (`85d2e826`, `54570617`) — oporavak posle trke, jedno mesto `applyPostRace` (engine/breakRamp.ts)
- Trka iz zaglavlja i pripremna trka iz plana (≥ 75 min rada): dan 1 odmor (trka ≥ 75 min), dani 1–3 odmor ili
  ravnomerno lagano ≤ 30 min, 7 dana ≤ 60 % referentne (pripremna ≤ 70 % najveće od tri pre nje, bez odmora i bez
  skraćenja dugog; kratka trka van plana: samo dani 1–3). Pripremna trka ne ide u prve 3 nedelje povratka.
- Brojevi (nedelja 1 posle trke): vlasnik-v2 21,5 → 16,5 km (pon–sre odmor); HM s19 17,7 → 12,2; 10K s18 41,3 →
  30,1; 5K s20 37,3 → 26 (3 dana odmora, ne 75 min); HM s17 23,5 (već ≤ 60 %). MAR posle PM: p04 72,5 → 53,2 km
  (pon/uto 30 min), p05 125 → 88, p12 56 → 39, p15 50 → 41, p17 101 → 70. MAR s07: PM u 3. nedelji otpada.
- Usput: snižen cilj nedelje se ne upisuje (sledeći prolaz bi spustio lanac dugog); otpala pripremna trka ne ostavlja
  skraćene dane; rampa posle bola: nedelja oporavka nije merilo rasta, korak u lancu bola +20 % (R2, MAR s26).
- Svojstvo `distances/postRace.test.ts` (scenariji + profili sve 4 distance; pada na polaznom kodu).
## A2 (`85d2e826`) — propušten trening nije prekid
- `breakStartOf`: propušten trening ne pokreće pravilo povratka (ni dok traje raniji prekid). `onMissed`: sledeći
  ključni/dugi ide po planu (tekst „ide po planu" / „ostaje kako je planiran"); blok se dodaje, dužina dugog ostaje.
- 10K s11 4 × 1 km ostaje (bilo 2 × 1); MAR s11 3 h 03 ostaje (bilo 2 h 17); MAR s12 3 h 06 ostaje (bilo 2 h 22);
  10K s25 7 × 3 → 5 × 3 min i 5 × 1 → 3 × 1 km (rampa posle bolesti; bilo 3 × 3 / 2 × 1); MAR s25 29,5 → 24,5 km
  (rampa posle bolesti; bilo 21). Svojstvo `distances/missedOne.test.ts`.
## A3 (`2fa38886`) — bez mikro-doza
- Prag i tempo trke posle smanjenja ≥ 12 min (tempo trke 3 km ako je kraće), ceo broj deonica, ne preko poslednjeg
  odrađenog (tada njegov unos); obim nedelje se nadoknađuje sa laganog dana; ako ni tada ne staje u +20 % — lagano
  istog trajanja (lakša vrsta). Mesta: rampa (prvi brzi) i završni korak replan-a `noMicroCuts`.
- 10K s15 RP 4 × 1 → 3 × 1 km (bilo 2 × 600 m / 2 × 1), s16 prag 2 × 10 → 2 × 6 min (bilo 2 × 4), RP 2 × 1,2 km (bilo
  2 × 700 m); 5K s15 3 × 400 m → lagano 30 min; 5K s27 7 × 400 m (bilo 2 × 1 km). Svojstvo `microDose.test.ts`.
## A4 (`01670bfb`) — delom
- Urađeno: prvi dan posle pauze nije dugi (5K s27 dugi 70 → lagano 55, 10K s27 75 → 60); posle puta lagani dani u 14
  dana ≤ plan (10K s27 nema više 2 × 90 min); dugi u povratku ≤ plan pre događaja (10K s16 95 → 90); dva propuštena
  duga: sledeći = poslednji odrađeni (10K s12 95 → 90). Svojstvo `pauseReturn.test.ts`.
- NIJE: HM s06/s07 (ukidanje rasterećenja posle povratka dalo je skok 43,8 → 62,4 km — vraćeno); 5K s16 (zamena
  provere i kvaliteta posle bola rušila s26 u 3 distance — vraćeno).
## A5 (`baf63b51`) — delom
- Urađeno: broj u „Očekivano vreme trke je sada oko" = zaglavlje (5K s25 21:30 → 21:33; s26 protivrečna rečenica
  otpada); „podiže obim" samo iz nedelja pred trkačem van sužavanja (HM s08, s09). 5K s27 prognoza 26:22 već prati.
- NIJE: HM s18 upozorenje o obimu, 10K P2B „dan posle testa" (upozorenja/zaglavlje — MOTOR B).
## Namerno promenjeni testovi i otisci
hm/r12 M3 (3. dan posle trke lagano ≤ 30), round5 (b) (blok se ne smanjuje na propušteni), breakRamp.test i Z3 u sva 4
scenarios.test (izuzetak najmanje smislene doze), examples § 12 b (+1 km uz 3 × 1 km). Otisci: MAR p02–p05, p08–p12,
p15–p17 (oporavak posle pripremnog PM; p15 i prag 11 → 12 min posle povrede).
