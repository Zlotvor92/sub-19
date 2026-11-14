# R22 — MOTOR B, 14. 11. 2026 (po Beogradu) — B1, B2, B3, B4 (deo), B5; B6, B7 i deo dopuna nisu

Stanje `5b3b8030`: V4 72 fajla, 1113 prolazi + 12 očekivano pada, typecheck čist, kapije 4 × 0.
Svojstva nad svim distancama, profilima i scenarijima: `distances/header22.test.ts` (B1, B2, B3).

## Urađeno
- **B1 `81ca5c92`**: jedan polazni broj — rečenica „Polazna procena je iz laganog tempa" nosi oprezan broj
  iz zaglavlja i kaže zašto; i posle prvog rezultata („30:46 → 33:00", ne „26:32 → 33:00"). HM p12 2:02:10 →
  2:17:08, 10K p09 46:37 → 49:48, p12 55:06 → 1:03:12, 5K p09/p12, MAR p10/p18. Svojstvo: tačno jedan broj.
- **B2 `81ca5c92`, `36c4589b`**: `engine/racePace.ts` — jedan izvor tempa za trku (napomena, zaglavlje, treninzi);
  plan se gradi drugi put sa tim tempom (`paces.rpBase` = tempo iz forme; doza i težina RP po njemu, isti km).
  Tempo trke u treninzima: MAR p01 5:08 → 5:18, p06 4:05 → 4:19, p11 6:11 → 6:35, p13 6:41 → 7:22, p19 5:45 → 6:20
  (= napomena dana trke). Posle boljeg rezultata nov cilj (5K s01: 4:21 → 4:14/km, „nov cilj 21:10"). Posle bola
  tempo za trku se ne ubrzava. Svojstvo: tempo trke u treninzima = tempo za trku ± 3 s/km.
- **B3 `3ab109c3`**: predlog dužine pripreme jednom (kratka priprema), broj nedelja uvek, dobitak probnog plana
  samo kad postoji (MAR p06 bez „27 km", p07 bez „dugi 30 km"); dodatni dan jednom; „Duža priprema ne pomaže"
  jednom i nikad uz „16 nedelja" („I uz dužu pripremu …"); svaka tema svoja stavka, ostali predlozi posebna
  poslednja stavka „Pomoglo bi i"; nedelja provere = napomena nedelje (`Warning.weeks`); 3 dana: rečenica za OVU
  trku (tekst `upozorenje.malo-dana.trka`) i bez napretka: HM p03 2:06:45 → 2:10:31, p10 2:21:05 → 2:22:24, MAR p08
  3:27:27 → 3:32:21, 10K p08 44:10 → 45:13; obim-za-nivo upola napretka: HM p06 1:19:38 → 1:20:03; MAR p18 dobija
  polumaraton; „30 min umesto 35" razumljivo.
- **B4 deo `3a15a766`** (dopuna organizatora): `taper.weekMinus2ByWeeks`, jedno mesto za motor i čuvara; 5K
  ≤ 6 nedelja N−2 ≤ 92 %: p07 N−2 41,3 → 45,3 km, p06 26,8 → 27,8; vrh isti (50,3; 31,0).
- **B5 `5b3b8030`**: `maxLongestRunM` u pravilu nivoa (5K hod-trk samo ko nije istrčao 5 km) — P2B bez hod-trka;
  bez sprinteva uzbrdo uz tegobu potkolenice (ceo plan) ili staž < 10 nedelja (`highImpactFrom`) — 5K p13.

## Namerno promenjeni testovi i otisci
- Otisci MAR p01, p03, p06, p07, p11, p13, p19 (B2); 5K p06, p07 (B4), p13 (B5).
- K1 (HM, 10K, 5K) preskače plan bez napretka (kao MAR); ČEKA FORMU skinuto HM p03, p08; 10K p03, p06, p08
  (sada prolaze); round4/round5/5K r15/paceDirection prate nova pravila; 5K F7 i kapija: N−2 92 % za ≤ 6 nedelja.
- MAR `testdata/gate.ts` 1 linija: udeo dugog + 0,15 km (p13 n8: 9 min u tempu 7:22 nosi 0,2 km manje; plan isti).

## Nije urađeno
- B4 5K p06 dva kvaliteta u ned 2–4: drugi kvalitet (intervali 630 s) ne staje u obim ni posle izostavljanja
  laganog dana ni na najmanjoj dozi (`roomFor`, obim nedelje) — traži raspodelu viška u dugi/lagane pre kvaliteta
  (isto kao HM dopuna 2). Nedelja −1 sa tempom trke: nije urađeno. 5K p15, 10K p02/p06 (manje dana), 5K
  „4 dana < 30 min → 3", 5K kratak brz 3 dana posle subotnje provere, 5K p08/p10/p12 predlog dana: nisu.
- B6, B7, dopuna MAR (1–3), HM (2–3): nisu započeti.
