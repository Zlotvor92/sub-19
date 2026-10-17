# 5K v2 — dnevnik predaje

Kako se koristi: svaki prozor prvo čita ovaj fajl; na kraju dodaje jedan blok.

Trenutno stanje: 5K v2 jezgro (`5k-v2.5.0`) u `web/src/domain/generators/fiveK/v2/`, testirano, NIJE
aktivirano (select.ts/UI/store ga ne koriste). Generisanje: sa rezultatom (3/4/5 dana, 6–16 ned), po osećaju
(E ± 15 s, kvalitet RPE, test 3 km), početnik. Adaptacija (`adaptFiveKV2(plan, facts, asOf)`): assess.ts →
ista `construct` kao generate → spajanje (prošlost/urađeno/zaključano bajt-isto) → validate; odluke 1–7
(rezultat, izvršenje, pauza, bol, umor, više od plana, prioritet). Mreža 60 × 7 → 0 grešaka.
Sledeće: trenerski pregled pragova adaptacije; povezivanje sa aplikacijom nije odobreno.
Stalni uslovi za sve v2 generatore: `AGENTS.md`.

## Segment 01 — 5K v2 jezgro (2026-10-16)

- Commit 8e407f3: `fiveK/v2/` (policy, input, paces, periodize, volume, workouts, schedule, validate, generate).
- Ulaz van opsega/neizvodljiv → strukturisano odbijanje; 117 testova; 13 primera u `artifacts/segment-01/`.
- Provere: vitest v2 117/117; generators 225; `npm run check` exit 0.
- Izveštaj: `reports/SEGMENT-01-IMPLEMENTATION.md`.

## Segment 02 — trenerske ispravke 4-dnevnog jezgra, 5k-v2.1.0 (2026-10-16)

- Commit a5f37c9: dugi ≥ lagan, dugi ≤ 35%/90 min, strogi rast I/RP, dan pred trku ≤ 4 km, Uslov 8.
- DECISIONS 1–12; 73 nova testa; 13 primera u `artifacts/segment-02/`; `AGENTS.md` stalni uslovi.
- Provere: vitest v2 190/190; generators 298; `npm run check` exit 0 (1927 testova).
- Izveštaj: `reports/SEGMENT-02-IMPLEMENTATION.md`.

## Segment 03 — preostale odluke 4-dnevnog jezgra, 5k-v2.2.0 (2026-10-16)

- Commit 3daeb32: kapacitet 4 dana, rasterećenje van početka faze, baza bez platoa, jedan T plafon, kratka trkačka nedelja.
- Mreža 240: 240 planova; „lagan = dugi" van trkačke 666 → 0.
- Provere: vitest v2 240/240; generators 383; `npm run check` exit 0 (2012 testova).
- Izveštaj: `reports/SEGMENT-03-IMPLEMENTATION.md`.

## Segment 04 — 3 i 5 dana, kratka priprema, 5k-v2.3.0 (2026-10-16)

- Commit 7b4b574: tabela `days` (3/4/5), kapacitet/vrh jedna formula, 6–7 ned bez rasterećenja, trkačka
  nedelja cilj = planirano, zamena u rasterećenju (stridesOnly), R u bazi ne pada; 22 primera.
- Provere: vitest v2 307; generators 450; `npm run check` exit 0 (2079 testova).
- Izveštaj: `reports/SEGMENT-04-IMPLEMENTATION.md`.

## Segment 05 — 3-dnevne dopune, bez rezultata, početnik, 5k-v2.4.0 (2026-10-16)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: 7b4b574
- Urađeno (DECISIONS 5k-v2.4.0): (1) kapacitet iz konstrukcije, zatvoren naniže; (2) 3 dana 12–35 km;
  (3) I/RP bez višeg nivoa: druga struktura, pa kraći oporavak; (4–7) plan po osećaju (`paceMode: 'feel'`,
  `MISSING_EASY_PACE`, test 3 km, prognoza/cilj „nedovoljno podataka", bez praga 70%); (8–10) početnik
  (`experience`, `canRun30Min`, uvod 2 ned, bez I, +5%, dugi ≤ 60 min, vrh ≤ 1,2×, rasterećenje /3, „orijentir").
- Novi fajlovi: `feel.ts`, `quality.ts`, `week.ts`, `lengths.ts`, `segment05.node.test.ts`; primeri `artifacts/segment-05/` (29).
- Mreža: sa rezultatom 3 d 128/32 (10 km), 4 d 160/0, 5 d 160/0; bez rezultata 120/0 po broju dana;
  početnik bez/sa rezultatom 3–4 d 120/0, 5 d odbijeno (RUN_DAYS_COUNT); 0 grešaka validatora.
- Regular sa rezultatom menja se samo po Odlukama 1 i 3 (512 ulaza: 274 plana promenjena, 6 odbijanja → plan, 0 promena iz drugog razloga).
- Provere: tsc, eslint, prettier exit 0; vitest v2 342/342; novi testovi na 7b4b574 35/35 pada;
  generators 24 fajla / 485; `npm run check` exit 0 (2114 testova; prvi put exit 2, TS6133 u testu, ispravljeno).
- Izveštaj: `reports/SEGMENT-05-IMPLEMENTATION.md`.

## Segment 05b — regresija kapaciteta, 5k-v2.4.1 (2026-10-16)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: 349fd64
- Urađeno (DECISIONS 5k-v2.4.1): (1) 3 dana dugi ≤ 45% (bilo 40%), ≤ 90 min, lagan ≤ dugi; (2) kapacitet =
  najveći izvodljiv cilj, rupe po nedelji (`fitTargetKm`, jedno mesto u volume.ts), korak dugog 0,1 km za
  3/4/5 dana; (3) vrh ≥ 7b4b574 (fixture 840 ulaza): 0 regresija bez izuzetka, 88 izuzetaka (3 d, lagan = dugi na 7b4b574).
- d3-30km-v48-12w: start 30 → vrh 37,5 (2.4.0: 17,1); 4 d 45 km VDOT 50: vrh ≥ 45 (2.4.0: 41,3).
- Fajlovi: `fiveK/v2/` (policy, volume, validate, lengths, `segment05b.node.test.ts`, `segment05b.peaks-7b4b574.json`,
  testovi 02/04/05), `artifacts/segment-05b/` (29 primera + `peak-exceptions.md`), `reports/SEGMENT-05b-IMPLEMENTATION.md`.
- Provere: tsc, eslint, prettier exit 0; vitest v2 356/356; novi testovi na 349fd64 6/15 pada;
  generators 25 fajlova / 499; `npm run check` exit 0 (2128 testova; prvi put exit 2, TS6133 u testu, ispravljeno).
- Izveštaj: `reports/SEGMENT-05b-IMPLEMENTATION.md`.

## Segment 06 — adaptacija, 5k-v2.5.0 (2026-10-17)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: e008c03
- Novi `adapt.ts`, `assess.ts`, `steps.ts`; `generate.construct` (generate bajt-isti, 282 plana); adaptiran
  režim validatora; `adaptVolume`, `rePeriodize`, ograničenja nedelje (bol, odmor, zabrana kvaliteta).
- Odstupanja: donja granica cilja min(original, 12/15/25 km); kvalitet koji ne staje → 1 → 0 (konstruktor).
- Mreža 60 planova × 7 scenarija → 420/420, 0 grešaka; primeri `artifacts/segment-06/` (dev-04, po osećaju).
- Provere: tsc, eslint, prettier exit 0 (eslint/prettier prvi put 8 / 12, ispravljeno); vitest v2 444/444;
  novi test fajl na e008c03 pada (nema adapt.ts); generators 26 / 587; `npm run check` exit 0 (2216).
- Izveštaj: `reports/SEGMENT-06-IMPLEMENTATION.md`.
