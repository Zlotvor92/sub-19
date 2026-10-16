# 5K v2 — dnevnik predaje

Kako se koristi: svaki prozor prvo čita ovaj fajl; na kraju dodaje jedan blok.

Trenutno stanje: 5K v2 jezgro (`5k-v2.1.0`, trenerske ispravke Segmenta 02) postoji u `web/src/domain/generators/fiveK/v2/`, testirano, NIJE aktivirano (select.ts/UI/store ga ne koriste). Stalni uslovi za sve v2 generatore: `AGENTS.md`.

## Segment 01 — 5K v2 jezgro (2026-10-16)

- Commit: 8e407f3d37f3606d5ebcb13d9b0a7e200c32caf7 (implementacija; ovaj STATUS upisan u sledećem commitu) | Polazni: 1f5dc4272b869653a703ed9fb6708e33161f8a1a
- Urađeno:
  - `fiveK/v2/`: policy (version + DECISIONS), input, paces (Daniels–Gilbert), periodize, volume, workouts, schedule, validate, generate, index.
  - Ulaz van opsega ili neizvodljiv → strukturisano odbijanje (sve šifre odjednom), bez fallback-a.
  - Pravila bump 2.0.0 → 2.0.1 posle pregleda primera (7/10 profila odbijeno pod 2.0.0); 7 odluka u `policy.ts`.
  - 117 testova (determinizam, datumi/faze, 4 dana, aritmetika, pravila preko validate, odbijanja, statička izolacija).
  - 13 primera u `docs/5k-v2/artifacts/segment-01/`.
- Izmenjeni/novi fajlovi: `web/src/domain/generators/fiveK/v2/*` (novo), `docs/5k-v2/artifacts/segment-01/*`, `docs/5k-v2/reports/SEGMENT-01-IMPLEMENTATION.md`, `docs/5k-v2/STATUS.md`.
- Nepromenjeno: aktivni 5K (fiveK/ van v2), 10K/HM/maraton, select.ts, UI, store, referentni izlazi.
- Provere:
  - `npx vitest run --project node src/domain/generators/fiveK/v2/` → 117/117
  - `npx vitest run --project node src/domain/generators/` → 17 fajlova / 225 testova prolazi
  - `npm run check` → exit 0 (177 fajlova / 1854 testa; 1. pokušaj pao na TS2352 u mom testu, ispravljeno)
- Otvoreno / sledeći korak:
  - Trenerska odluka: lagan trk > dugi (31–37% nedelje) kod 4 dana — podići udeo dugog ili prihvatiti.
  - Dan pred trku: skratiti lagan trk (sada jednak ostalima).
  - Proširenje opsega (3/5 dana, adaptacija) tek posle odluke iznad.
- Reprodukcija: `node docs/5k-v2/artifacts/segment-01/run.ts` (iz korena repoa, Node ≥ 22.18)

## Segment 02 — trenerske ispravke 4-dnevnog jezgra, 5k-v2.1.0 (2026-10-16)

- Commit: a5f37c9631704a9f1944e05de55305a193a964c0 (implementacija; ovaj STATUS upisan u sledećem commitu) | Polazni: e2e9f9f6735beda97d2017d6892535478968dfce
- Urađeno:
  - Dugi ≥ lagan (greška); dugi ≤ 35% / 90 min; lagan = dugi i planirano < cilj uz napomenu kad ne staje.
  - Strogi rast I (vrhunac) i RP (oštrenje), bez istog para kvaliteta; dan pred trku ≤ 4 km + 4 × 20 s; oporavak na 15 s.
  - Posle pregleda: vrhunac ≤ 4 ned, udeli od cilja, šira I/RP ponuda, baza R bez 9 × 150 m (DECISIONS 7–12).
  - Uslov 8 u validatoru (min. obim nedelje, prazan trening); `policyId` u planu; 73 nova testa.
  - 13 primera u `docs/5k-v2/artifacts/segment-02/` (kolona „lagan max", ukupno km).
- Izmenjeni/novi fajlovi: `fiveK/v2/` (policy, types, periodize, workouts, generate, validate, validate.node.test, segment02.node.test), `docs/5k-v2/artifacts/segment-02/*`, `docs/5k-v2/reports/SEGMENT-02-IMPLEMENTATION.md`, `docs/5k-v2/STATUS.md`, `AGENTS.md` (nova sekcija).
- Nepromenjeno: aktivni 5K, 10K/HM/maraton, select.ts, UI, store, `segment-01/`.
- Provere:
  - tsc domain exit 0; eslint v2 exit 0; vitest v2 → 190/190
  - `npx vitest run --project node src/domain/generators/` → 18 fajlova / 298 testova prolazi
  - `npm run check` → exit 0 (178 fajlova / 1927 testova)
- Otvoreno / sledeći korak:
  - Spori + visok obim: lagan = dugi skraćuje nedelju do 26% cilja (I do 9,1% planiranog) — trenerska odluka.
  - 15 km + VDOT ~53 odbijen; Uslov 2 delimično (vrh 1,3×/50 km; T 900/1200 s).
  - Proširenje opsega (3/5 dana, adaptacija) tek posle toga.
- Reprodukcija: `node docs/5k-v2/artifacts/segment-02/run.ts` (iz korena repoa, Node ≥ 22.18)
