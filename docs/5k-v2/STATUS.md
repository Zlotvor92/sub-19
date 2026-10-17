# 5K v2 — dnevnik predaje

Kako se koristi: svaki prozor prvo čita ovaj fajl; na kraju dodaje jedan blok.

Trenutno stanje: 5K v2 (`5k-v2.6.0`) je u aplikaciji IZA PREKIDAČA (08a; prekidač vidljiv samo uz `VITE_FIVEK_V2` ili
administratoru — 08b). Generisanje, čuvanje, prikaz i sat čitaju strukturu v2. 08b: adaptacija povezana — činjenice iz
aplikacije na jednom mestu (`fiveK/v2/app/facts.ts`) → `adaptFiveKV2` → pregled → potvrda → revizija; vraćanje, traka,
promena cilja, Forma iz rezultata. 08c: činjenice iz uvoza tačne — za plan v2 trčanje koje nije upareno sa danom plana
(dan odmora, van datuma plana, zagrevanje uz trku) postaje zapis van plana (`vanPlanaV2`, po ID-ju aktivnosti) i ulazi u
km; pokrivenost čita ISKLJUČIVO `fullSync` (sve aktivnosti preuzete i obrađene; delimičan uspeh ga ne pomera), a
neobrađena aktivnost čini svoj dan nepoznatim. Uvoz za planove v1 bajt-isti. Jezgro (`policy.ts`, konstrukcija, assess)
nepromenjeno. Sledeće: odluka o uključivanju za korisnike (v. „Preostalo" u izveštajima 08b i 08c).
Stalni uslovi za sve v2 generatore: `AGENTS.md`.

## Segmenti 01–07 (sažeto 2026-10-17; detalji u izveštajima `reports/SEGMENT-0x-IMPLEMENTATION.md`)

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
- 06 (c9003aa, 5k-v2.5.0): `adapt.ts`, `assess.ts`, `steps.ts`, `generate.construct` (generate bajt-isti); mreža
  420/420; vitest v2 444; generators 26 / 587; check exit 0 (2216).
- 07 (7fa61eb, 5k-v2.6.0): povratni rast do nivoa pre smanjenja, donja granica = minimum nedelje, `coverage`/`breaks`;
  trčanje/hodanje L1–L12; mreže 540 + 192; generisanje bajt-isto; generators 27 / 697; check exit 0 (2326).

## Segment 08a — 5K v2 u aplikaciji iza prekidača (2026-10-17)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: 7fa61eb
- Prekidač `domain/generators/flags.ts` (+ `stores/generatorFlags.ts`, Ti → Zone i postavke treninga); rutiranje po
  `meta.policyId` (`5k-v2` → `FIVE_K_V2_GENERATOR`, `KNOWN_VERSIONS` = 5k-v2.6.0); adapter `fiveK/v2/app/`.
- Format (opciono, bez migracije): `DayBase.structure`, `StructuredDay`, `PlanMeta.goalAssessment`, `GenPlanState.fiveKV2`,
  `ResolvedDay.structure`, `ui.generatorV2FiveK`. Ugovor 55 članova: a 15, b 26 (08b), c 14 (kopija stanja).
- Provere: tsc domena exit 0; generators 28 / 720; `npm run check` exit 0 (2355); E2E `fivek-v2` 2/2, plan+workouts 9/9;
  ceo E2E 67/79 — 12 padova (generator-ab-users 10, pwa 2) isti na 7fa61eb (nisu od 08a).
- Izveštaj: `reports/SEGMENT-08a-IMPLEMENTATION.md`.

## Segment 08b — adaptacija 5K v2 u aplikaciji + popravke 08a (2026-10-17)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: ed5974e
- Novo u `fiveK/v2/app/`: `facts.ts`, `adapt.ts` (pregled, vraćanje, cilj, traka), `members.ts` (ugovor b; zamenjuje
  `unsupported.ts`), `form.ts`; prikaz prelaza run/walk → kontinuirani. UI: `FiveKV2Adjustment`, `FormV2`, trake, Ti → Cilj.
- Ugovor (b): 24/26 mapirano (činjenice/rezultati ili eksplicitno „ne koristi se"); nepodržano sa razlogom:
  `executionBasis`, `realignPlan`.
- Popravke: prekidač (10), `generator-ab-users` dokaz razlike = samo policyId/Version i faza → 10/10 (11), km nedelje bez
  trke (12), izmena samo tempa čuva strukturu (13); `pwa.spec` 2/2 sa 120 s, test nije diran.
- Provere: tsc domena i `tsc -b` exit 0; generators 29 / 739; `npm run check` exit 0 (191 / 2380); E2E `fivek-v2` 3/3,
  `generator-ab-users` 10/10; ceo E2E 78/80 — `pwa` 2 (istek kad rade 2 radnika; sa 1 radnikom 2/2).
- Izveštaj: `reports/SEGMENT-08b-IMPLEMENTATION.md`.

## Segment 08c — tačnost činjenica iz uvoza (2026-10-17)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: f09a50a
- Rizik 1: uvoz je odbacivao neupareno trčanje (`stravaSync.run`/`icuSync.syncActivities` `continue` na dan odmora,
  `importedDay` na dan trke, `icuRunsByDate` bez km, `recordOutOfPlan` od prvog dana) → za v2 `domain/activities/
  offPlan.ts` → `vanPlanaV2` (`izvor:ID`, dedup) → `facts.ts` (bez `dayId`; km = upareni + van plana).
- Rizik 2: `trSync` (i Strava `lastSync`) pomeren i kad tokovi/detalji padnu → novo `fullSync`/`fullSyncFrom`/
  `syncIssues` (samo v2); `syncSources` čita samo `fullSync`; neobrađena aktivnost → dan nepoznat + napomena.
- Testovi: importFacts 10 + UI 1 + offPlan 4 (na f09a50a padaju; sonda: 4 scenarija → lažna PAUSE 7 dana); v1 snimak
  12 (5K v1/10K/HM/maraton × Strava/icu) SHA-256 jednak f09a50a.
- Provere: tsc domena i `tsc -b` exit 0; generators 30 / 749; `npm run check` exit 0 (195 / 2396);
  E2E `fivek-v2` 3/3, `strava` 2/2, `race-analysis` 3/3, `data` 3/3.
- Izveštaj: `reports/SEGMENT-08c-IMPLEMENTATION.md`.
