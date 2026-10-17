# 5K v2 — dnevnik predaje

Kako se koristi: svaki prozor prvo čita ovaj fajl; na kraju dodaje jedan blok.

Trenutno stanje: 5K v2 (`5k-v2.6.0`) je u aplikaciji IZA PREKIDAČA (segment 08a): `ui.generatorV2FiveK` (podrazumevano
isključen) / `VITE_FIVEK_V2` → nov 5K plan iz čarobnjaka ide kroz adapter `fiveK/v2/app/`; plan nosi `5k-v2` i bira se
po oznaci politike (postojeći 5K planovi ostaju v1). Generisanje (sa rezultatom, po osećaju, početnik, trčanje/hodanje),
čuvanje (backup/uvoz), prikaz i sat čitaju strukturu v2 (`structure`); ocena cilja doslovno. Adaptacija i predlozi
(izvršenje, bol, pauza, run/walk napredak, predlog tempa) su eksplicitno nepodržani u aplikaciji do 08b („stiže uskoro").
Jezgro (`adaptFiveKV2` itd.) nepromenjeno. Sledeće: 08b — povezivanje adaptacije (izvor `coverage`, činjenice iz dnevnika).
Stalni uslovi za sve v2 generatore: `AGENTS.md`.

## Segmenti 01–05b (sažeto 2026-10-17; detalji u izveštajima `reports/SEGMENT-0x-IMPLEMENTATION.md`)

- 01 (8e407f3, 5k-v2.0.x): jezgro `fiveK/v2/`, strukturisano odbijanje; vitest v2 117; check exit 0.
- 02 (a5f37c9, 5k-v2.1.0): dugi ≥ lagan, dugi ≤ 35%/90 min, strogi rast I/RP, dan pred trku ≤ 4 km, Uslov 8;
  vitest v2 190; check exit 0 (1927).
- 03 (3daeb32, 5k-v2.2.0): kapacitet 4 dana, rasterećenje van početka faze, baza bez platoa, jedan T plafon;
  mreža 240; vitest v2 240; check exit 0 (2012).
- 04 (7b4b574, 5k-v2.3.0): tabela `days` 3/4/5, 6–7 ned bez rasterećenja, trkačka nedelja cilj = planirano,
  stridesOnly; vitest v2 307; check exit 0 (2079).
- 05 (349fd64, 5k-v2.4.0): kapacitet iz konstrukcije, 3 dana 12–35 km, plan po osećaju (E ± 15 s, RPE, test 3 km),
  početnik (uvod 2 ned, bez I, +5%, dugi ≤ 60 min); vitest v2 342; generators 485; check exit 0 (2114).
- 05b (e008c03, 5k-v2.4.1): 3 dana dugi ≤ 45%, kapacitet = najveći izvodljiv cilj (`fitTargetKm`), vrh ≥ 7b4b574
  (fixture 840, 88 izuzetaka); vitest v2 356; generators 499; check exit 0 (2128).

## Segment 06 — adaptacija, 5k-v2.5.0 (2026-10-17)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: e008c03
- Novi `adapt.ts`, `assess.ts`, `steps.ts`; `generate.construct` (generate bajt-isti, 282 plana); adaptiran
  režim validatora; `adaptVolume`, `rePeriodize`, ograničenja nedelje (bol, odmor, zabrana kvaliteta).
- Odstupanja: donja granica cilja min(original, 12/15/25 km); kvalitet koji ne staje → 1 → 0 (konstruktor).
- Mreža 60 planova × 7 scenarija → 420/420, 0 grešaka; primeri `artifacts/segment-06/` (dev-04, po osećaju).
- Provere: tsc, eslint, prettier exit 0 (eslint/prettier prvi put 8 / 12, ispravljeno); vitest v2 444/444;
  novi test fajl na e008c03 pada (nema adapt.ts); generators 26 / 587; `npm run check` exit 0 (2216).
- Izveštaj: `reports/SEGMENT-06-IMPLEMENTATION.md`.

## Segment 07 — ispravke adaptacije i trčanje/hodanje, 5k-v2.6.0 (2026-10-17)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: c9003aa
- A: (1) povratni rast +10%/ned do nivoa pre smanjenja (pauza, bol, izvršenje), i oštrenje — `volume.adaptVolume`;
  dev-04 pauza 20: ned 9–11 26 / 28,6 / 31,4 (bilo 25,5); (2) donja granica = minimum nedelje (izgradnja n × 3 km:
  9/12/15, taper 7,5/10/12,5); 5 d / 30 km / pauza 35 → 15 km (bilo 25); (3) `coverage`, `breaks`.
- B: `runWalk*.ts` — lestvica L1–L12, projekcija, napredak kroz adaptFiveKV2, trka, prelaz na početnika.
- Mreže: adaptNetwork 60 × (7 + 2) = 540; trčanje/hodanje 16 × 6 + lanac = 192; 0 grešaka.
- Generisanje postojećih grana bajt-isto kao c9003aa (700 ulaza / 640 planova, fixture test).
- Provere: tsc, eslint, prettier exit 0 (prettier prvi put 9 fajlova); vitest v2 554/554; novi testovi na
  c9003aa 106/110 pada; generators 27 / 697; `npm run check` exit 0 (2326 testova).
- Izveštaj: `reports/SEGMENT-07-IMPLEMENTATION.md`; primeri `artifacts/segment-07/`.

## Segment 08a — 5K v2 u aplikaciji iza prekidača (2026-10-17)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: 7fa61eb
- Prekidač `domain/generators/flags.ts` (+ `stores/generatorFlags.ts`, Ti → Zone i postavke treninga); rutiranje po
  `meta.policyId` (`5k-v2` → `FIVE_K_V2_GENERATOR`, `KNOWN_VERSIONS` = 5k-v2.6.0); adapter `fiveK/v2/app/`.
- Format (opciono, bez migracije): `DayBase.structure`, `StructuredDay`, `PlanMeta.goalAssessment`, `GenPlanState.fiveKV2`,
  `ResolvedDay.structure`, `ui.generatorV2FiveK`. Ugovor 55 članova: a 15, b 26 (08b), c 14 (kopija stanja).
- Provere: tsc domena exit 0; generators 28 / 720; `npm run check` exit 0 (2355); E2E `fivek-v2` 2/2, plan+workouts 9/9;
  ceo E2E 67/79 — 12 padova (generator-ab-users 10, pwa 2) isti na 7fa61eb (nisu od 08a).
- Izveštaj: `reports/SEGMENT-08a-IMPLEMENTATION.md`.

