# 5K v2 — dnevnik predaje

Kako se koristi: svaki prozor prvo čita ovaj fajl; na kraju dodaje jedan blok.

Trenutno stanje: 5K v2 jezgro (`5k-v2.0.1`) postoji u `web/src/domain/generators/fiveK/v2/`, testirano, NIJE aktivirano (select.ts/UI/store ga ne koriste).

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
