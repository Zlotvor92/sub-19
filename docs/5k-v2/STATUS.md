# 5K v2 — dnevnik predaje

Kako se koristi: svaki prozor prvo čita ovaj fajl; na kraju dodaje jedan blok.

Trenutno stanje: 5K v2 (`5k-v2.8.0`, 08g) je u aplikaciji IZA PREKIDAČA (08a; prekidač vidljiv samo uz `VITE_FIVEK_V2` ili
administratoru — 08b). Generisanje, čuvanje, prikaz i sat čitaju strukturu v2. 08b: adaptacija povezana — činjenice iz
aplikacije na jednom mestu (`fiveK/v2/app/facts.ts`) → `adaptFiveKV2` → pregled → potvrda → revizija; vraćanje, traka,
promena cilja, Forma iz rezultata. 08c: činjenice iz uvoza tačne — za plan v2 trčanje koje nije upareno sa danom plana
(dan odmora, van datuma plana, zagrevanje uz trku) postaje zapis van plana (`vanPlanaV2`, po ID-ju aktivnosti) i ulazi u
km; pokrivenost čita ISKLJUČIVO `fullSync` (sve aktivnosti preuzete i obrađene; delimičan uspeh ga ne pomera), a
neobrađena aktivnost čini svoj dan nepoznatim. Uvoz za planove v1 bajt-isti. Jezgro (`policy.ts`, konstrukcija, assess)
nepromenjeno. 08d (5k-v2.6.1): bol — sidro povratka = nedelja koja sadrži asOf + 1, osnova min(0,7 × nivo pre bola,
cilj te nedelje); posle bola doza kvaliteta počinje iznova od sledeće nedelje izgradnje. 08e (5k-v2.7.0): redovno
rasterećenje odmah posle nedelje smanjenja (pauza, manjak, sidro bola; ne nov start) otpada (Odluka 9, `steps.framesFor`);
adaptacija koju konstruktor sastavi više ne odbija validator (rast uz donju granicu, minimum za cilj uz dane bola, ostatak
pauze u nedelji rasterećenja). 08g (5k-v2.8.0): prošlost = upisani dani (`written.ts`, pouka 29), trkačka ≤ taper
(pouka 30), test iz upisanog plana, provere progresije u jedinici doze + DOSE_DROPPED, umor vezan za zapise (pouka 36);
trajna rana mreža 104 800 tokova, 0 odbijanja. Sledeće: odluka o uključivanju za korisnike (v. „Preostalo" u izveštajima 08b i 08c).
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

## Segment 08d — bol: povratak ne zavisi od dana u nedelji (5k-v2.6.1, 2026-10-18)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: bf47249
- Odluka 1 dopuna (organizator, = 10K A16): sidro = nedelja r koja sadrži asOf + 1 (ne poslednja nedelja bola); posle r
  rast od osnove min(round1(0,7 × nivo koraka), cilj r); r + 1 povratni rast (+10% do nivoa), rasterećenje 0,8 × osnova;
  poruka PAIN kaže osnovu (i kad min deluje). Jedno mesto: `volume.returnBaseKm` (adaptVolume, validator, poruka);
  `KNOWN_VERSIONS` = 5k-v2.6.0 + 5k-v2.6.1.
- Sudari rešeni odlukom organizatora: (1) korak bola sa povratkom počinje novu progresiju doze od r + 1
  (`steps.doseResetAt`; BASE_R_DECREASE nepromenjen) → 0 odbijenih tokova bola (bf47249: 44 u mreži P); (2) u
  `tenK/v2/app/byteSame.068410b.json` ponovo snimljeni samo ključevi „5K v2" (19/41 promenjeno, samo oznaka).
- A–E (cilj ned 5, bf47249 → 08d): A 28,0 → 33,2; B 45,6 → 33,2; C 45,6 → 35,0; D 45,6 → 35,0; E ned 4 36,5 → 24,2, ned 5
  45,6 → 33,2.
- Regresija prema bf47249 (`segment08d.adapt-hashes-bf47249.json`): postojeće mreže 732 — promenjeno samo s06/pain5 60/60
  (svi PAIN sa povratkom; doza promenjena u 14); mreža bola P 392 — promenjeno 380 (svi sa povratkom), 12 bez povratka
  bajt-isto; generator bajt-isti osim oznake. I1–I5 bez odstupanja na 392 toka; sabotaže (a)–(e): 14/17/1/37/7 palih.
- Provere: tsc/eslint/prettier exit 0; vitest fiveK/v2 15 / 627; `npm run check` exit 0 (220 / 2700); E2E `fivek-v2` 3/3.
- Izveštaj: `reports/SEGMENT-08d-IMPLEMENTATION.md`.

## Segment 08e — rasterećenje posle smanjenja otpada; P2 (5k-v2.7.0, 2026-10-19)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: 51a924f
- Odluka 9 (organizator, = 10K A17): redovno rasterećenje odmah posle nedelje smanjenja ((a) pauza/manjak → fromWeek,
  oznaka koraka `reduced`; (b) bol sa povratkom → r; nov start ne) otpada; prinudno (umor) nikad; granica niza = najduži
  niz izgradnje bez rasterećenja koji generator pravi (izmereno 5, početnik 3) + 1 = 6 / 4 (`steps.reliefMaxRun`); jedno
  mesto `steps.framesFor` (`dropped` → konstrukcija i poruka „… otpada: nedelja n je smanjena (Odluka 9).").
- P2: VOLUME_GROWTH (validator čita `adaptFloorKm`), WEEK_MIN_VOLUME (dani bola: minimum za cilj), VOLUME_DELOAD (nova
  klasa, STANI → `volume.pauseRemainderKm`). Pretraga organizatora 5952 toka: P1 975 → 0 (0 zadržano), odbijeno 44 → 0;
  šira 10 852: P1 965 → 0, odbijeno 42 → 0 (+104 VDOT_OUT_OF_RANGE po dizajnu).
- Regresija prema 51a924f (`segment08e.adapt-hashes-51a924f.json`): svaki promenjen tok ima rečenicu Odluke 9 ili je
  ranije bio odbijen (0 drugih); generator bajt-isti osim oznake; `byteSame` 5K v2 ključevi ponovo snimljeni (19, samo
  oznaka; dozvola organizatora). KNOWN_VERSIONS = 2.6.0, 2.6.1, 2.7.0.
- Sabotaže (a)–(f3) 8/8 PAO (42 s, `--parallel 2`); vitest fiveK/v2 16 / 655 (brz); pun 08e 27/27; `npm run check` exit 0 (222 / 2763); `npm run check:full` exit 0 (271 / 2914).
- Izveštaj: `reports/SEGMENT-08e-IMPLEMENTATION.md`.

## Segment 08g — Faza 4a N2–N4 + pouka 36 (5k-v2.8.0, 2026-10-19)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci) | Polazni: f4b257d
- N2a: test iz upisanog plana (`steps.writtenTest`); N2b (odluka D): jedinica doze (m/s) u BASE_R_DECREASE,
  DOSE_PROGRESSION, BASE_PLATEAU; R pada samo kad je plafon R < prethodne → napomena + DOSE_DROPPED; N3: `week.raceWeekRest`
  → `raceRest`, RACE_WEEK_TAPER / RACE_WEEK_SHORT; N4: `written.ts`, stanje iz upisanih dana, validator ne preskače mešovitu
  nedelju (`steps.doseResetDate`); pouka 36: sidro umora iz zapisa.
- Merenje: 4a 29/19/11 odbijeno 92 → 0, trkačka > taper 34 → 0; 7/7/7 209 → 0, 94 → 0; fatigue-repeat 58/117 → 0;
  generator bajt-isti (3816). Trajna mreža 104 800: promenjeno 4067 (R 399, F 2960, N4 673, N3 34, C 1), bez razloga 0.
- byteSame: samo redovi „5K v2" (10K 19, HM 13, maraton 13). KNOWN_VERSIONS = 2.6.0, 2.6.1, 2.7.0, 2.8.0.
- Provere: tsc/eslint/prettier exit 0; `npm run check` exit 0 (282 / 3401); `--changed f4b257d` pun 174 / 1807; pun fiveK/v2
  22 / 675; E2E `fivek-v2` 3/3; sabotaže 8/8 PALO (51 s).
- Izveštaj: `reports/SEGMENT-08g-IMPLEMENTATION.md`.
