# 5K v2 — dnevnik predaje

Kako se koristi: svaki prozor prvo čita ovaj fajl; na kraju dodaje jedan blok.

Trenutno stanje: 5K v2 jezgro (`5k-v2.4.0`) u `web/src/domain/generators/fiveK/v2/`, testirano, NIJE
aktivirano (select.ts/UI/store ga ne koriste). Grane: sa rezultatom (3/4/5 dana, 6–16 ned), bez pouzdanog
rezultata (plan po osećaju: E iz korisnikovog tempa ± 15 s, kvalitet RPE, test 3 km u 3./4. ned) i
početnik (≤ 4 dana, 1 kvalitet, sa ili bez rezultata). Kapacitet iz stvarne konstrukcije nedelje: 0
„lagan = dugi" van trke u svim mrežama; 3 dana ≈ 17 km, 4 dana VDOT ≥ 45 → 41,3 km (Segment 05,
preostali problemi 1–2). Run/walk nije podržan (RUN_WALK_NOT_SUPPORTED_YET). Sledeće: segment 06
(adaptacija, tempo iz testa). Stalni uslovi za sve v2 generatore: `AGENTS.md`.

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

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci; `git log -1 -- docs/5k-v2/STATUS.md`) | Polazni: 3daeb32
- Urađeno (DECISIONS 5k-v2.3.0):
  1. Tabela `days` (3/4/5): broj kvaliteta/laganih, dugi 40/35/30%, vrh 40/50/65, obim 10–35/15–45/25–65, minimum nedelje.
  2. `capacityKm(p, n)` i `peakKm(start, kapacitet, n)` — ista formula za sva tri šablona.
  3. 6–7 nedelja: baza 2, vrhunac 2, (oštrenje 1), taper 1, trka 1; bez rasterećenja; `plan.notes`.
  4. Trkačka nedelja: cilj = planirano, 50% vrha = granica.
  5. Rasterećenje: R zamena ≥ 1,2 km, inače samo ubrzanja 6 × 20 s (`stridesOnly`).
  6. Baza: R ne pada; bez višeg nivoa R se drži, T menja strukturu.
  - Odstupanja: dugi 3 d na 0,1 km; prvi T 3 d = 1 km; RP u oštrenju neopadajući (druga struktura umesto odbijanja).
- 4-dnevni planovi: 0 regresija; promene samo po odlukama 4–6 (dev-04: samo ned 14, cilj 22,8 → 19,49).
- Fajlovi: `fiveK/v2/` (policy, input, schedule, periodize, volume, workouts, generate, validate, types, testovi + `segment04.node.test.ts`), `artifacts/segment-04/` (22 primera), `reports/SEGMENT-04-IMPLEMENTATION.md`, `STATUS.md`.
- Nepromenjeno: aktivni 5K, 10K/HM/maraton, select.ts, UI, store, `segment-01..03/`.
- Provere:
  - tsc domain exit 0; eslint v2 exit 0; prettier v2 exit 0; vitest v2 → 7 fajlova / 307 testova
  - novi testovi na 3daeb32: 57/67 pada (svaka odluka 1–6)
  - `npx vitest run --project node src/domain/generators/` → 23 fajla / 450 testova prolazi (690 s)
  - `npm run check` → exit 0 (typecheck, lint, format, 183 fajla / 2079 testova)
- Otvoreno / sledeći korak:
  - 3 d, 22–35 km: „lagan = dugi" u ~50% nedelja (manjak ≤ 4,4%) — trenerska odluka o 40%/lagan ≤ dugi.
  - 3 d, 10–11 km: uvek odbijeno; realni minimum ~12–16 km.
  - Segment 05: početnici i plan bez rezultata.
- Reprodukcija: `node docs/5k-v2/artifacts/segment-04/run.ts` (iz korena repoa, Node ≥ 22.18)

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
