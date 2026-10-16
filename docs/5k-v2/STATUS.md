# 5K v2 — dnevnik predaje

Kako se koristi: svaki prozor prvo čita ovaj fajl; na kraju dodaje jedan blok.

Trenutno stanje: 5K v2 jezgro (`5k-v2.2.0`, trenerske odluke Segmenta 03: kapacitet 4 dana, rasterećenje van
početka faze, baza bez platoa, jedan T plafon, brz + mali obim bez odbijanja, kratka trkačka nedelja) postoji u
`web/src/domain/generators/fiveK/v2/`, testirano, NIJE aktivirano (select.ts/UI/store ga ne koriste). Mreža
240 ulaza: 240 planova, 0 odbijanja. Stalni uslovi za sve v2 generatore: `AGENTS.md`.

## Segment 01 — 5K v2 jezgro (2026-10-16)

- Commit 8e407f3 (polazni 1f5dc42): `fiveK/v2/` (policy, input, paces, periodize, volume, workouts, schedule, validate, generate), bump 2.0.0 → 2.0.1.
- Ulaz van opsega/neizvodljiv → strukturisano odbijanje; 117 testova; 13 primera u `artifacts/segment-01/`.
- Provere: vitest v2 117/117; generators 225; `npm run check` exit 0.
- Otvoreno tada: lagan > dugi kod 4 dana; dan pred trku (rešeno u Segmentu 02).
- Izveštaj: `reports/SEGMENT-01-IMPLEMENTATION.md`.

## Segment 02 — trenerske ispravke 4-dnevnog jezgra, 5k-v2.1.0 (2026-10-16)

- Commit a5f37c9 (polazni e2e9f9f): dugi ≥ lagan, dugi ≤ 35%/90 min, strogi rast I/RP, dan pred trku ≤ 4 km, oporavak na 15 s, Uslov 8.
- DECISIONS 1–12; 73 nova testa; 13 primera u `artifacts/segment-02/`; `AGENTS.md` stalni uslovi.
- Provere: vitest v2 190/190; generators 298; `npm run check` exit 0 (1927 testova).
- Otvoreno tada: „lagan = dugi" kod sporih (rešeno 03), 15 km + VDOT ~53 odbijen (rešeno 03), plato baze (rešeno 03).
- Izveštaj: `reports/SEGMENT-02-IMPLEMENTATION.md`.

## Segment 03 — preostale trenerske odluke 4-dnevnog jezgra, 5k-v2.2.0 (2026-10-16)

- Commit: commit koji sadrži ovaj blok (SHA u završnoj poruci; `git log -1 -- docs/5k-v2/STATUS.md`) | Polazni: ce07ca6
- Urađeno (DECISIONS 5k-v2.2.0):
  1. Kapacitet 4 dana iz tempa (`volume.ts`) ograničava svaki cilj na ulazu; start = min(obim, kapacitet) + napomena.
  2. Rasterećenje nikad u prvoj nedelji vrhunca/oštrenja (`periodize.ts`).
  3. Baza: R raste do budžeta, T +0,5 km/ned do 15 min pa cruise; ista doza ≤ 2 nedelje (`BASE_PLATEAU`).
  4. Jedan T plafon po fazi (`tContinuousMaxSec`), bez `shortTMaxSec`; jedna `peakKm()`.
  5. Rasterećenje: zamena kratkim T/R uz ubrzanja; I u vrhuncu neopadajući (zadržan I → T menja strukturu).
  6. Trkačka nedelja: lagan ≤ 50 min i ≤ 50% prethodnog dugog; ostatak se ne raspoređuje.
  - `weekQuality` (workouts.ts) je jedino mesto odluke o dozi kvaliteta.
- Mreža 240 (pre → posle): planova 228 → 240; „lagan = dugi" van trkačke 666 → 0; rasterećenje na početku faze 171 → 0; QUALITY_INFEASIBLE 15 km + VDOT ~53: 12 → 0.
- Izmenjeni/novi fajlovi: `fiveK/v2/` (policy, periodize, volume, workouts, generate, validate, types, testovi + `segment03.node.test.ts`), `docs/5k-v2/artifacts/segment-03/*` (15 primera, + spor 45 km i brz 15 km/13 ned), `reports/SEGMENT-03-IMPLEMENTATION.md`, `STATUS.md`.
- Nepromenjeno: aktivni 5K, 10K/HM/maraton, select.ts, UI, store, `segment-01/`, `segment-02/`.
- Provere:
  - tsc domain exit 0; eslint v2 exit 0; prettier v2 exit 0; vitest v2 → 6 fajlova / 240 testova
  - novi testovi na ce07ca6: 41/50 pada (svaka odluka 1–6)
  - `npx vitest run --project node src/domain/generators/` → 22 fajla / 383 testa prolazi (707 s; prvi pokušaj ručno prekinut zbog trajanja)
  - `npm run check` → exit 0 (182 fajla / 2012 testova)
- Otvoreno / sledeći korak:
  - Trkačka nedelja planirano 58–100% cilja: spustiti cilj trkačke nedelje ili prihvatiti manjak (trenerska odluka).
  - Zamena u rasterećenju za 15 km + VDOT ~53 je R 4 × 150 m (kratak T ispod 1 km).
  - Proširenje opsega (3/5 dana, adaptacija) tek posle toga.
- Reprodukcija: `node docs/5k-v2/artifacts/segment-03/run.ts` (iz korena repoa, Node ≥ 22.18)
