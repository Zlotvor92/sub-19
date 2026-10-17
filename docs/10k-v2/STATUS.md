# 10K v2 — STATUS

Novi 10K generator sa jednim vlasnikom svake odluke (D1–D16), izolovan u
`web/src/domain/generators/tenK/v2/`. 10K v1 (`tenK/` van `v2/`) je nepromenjen i jedini je u aplikaciji;
v2 se iz `tenK/index.ts` ne izvozi do segmenta 05.

## Kako se koristi

```ts
import { generateTenKV2 } from "./tenK/v2/index.ts";
const r = generateTenKV2({
  startDate: "2026-11-02", // prvi dan nedelje 1
  raceDate: "2027-02-07", // poslednji dan poslednje nedelje (10–18 celih nedelja)
  runDays: ["tue", "thu", "sat", "sun"], // tačno 4
  longRunDay: "sun", // opciono (inače nedelja / poslednji dan)
  currentWeeklyKm: 40, // prosek poslednje 4 nedelje, 25–55
  recentResult: { distanceM: 10000, timeSec: 2700, date: "2026-10-19" }, // 3/5/10 km ili 21097,5 m, ≤ 84 dana
  goalTimeSec: 2610, // opciono: samo ocena (D3)
});
// r.ok → r.plan (policyId '10k-v2', policyVersion '10k-v2.1.0', faza svake nedelje, upozorenja)
// !r.ok → r.reasons: [{ code, message }] (npr. SUPPORTED_FROM_SEGMENT_02, FEEL_PLAN_SEGMENT_03)
```

- `construct(input, steps)` je isti konstruktor sa koracima adaptacije (segment 04); sada samo `[]`.
- `validatePlan(plan)` samo prijavljuje (greške / upozorenja), plan ne menja.
- Primeri: iz korena repoa `node docs/10k-v2/artifacts/segment-01b/run.ts` (traži `web/node_modules`) →
  `inputs.json`, `<id>.json`, `plans.md` (sa poređenjem prema `segment-01/`); dva pokretanja daju
  bajt-isti izlaz. `segment-01/` je zamrznut izlaz 10k-v2.0.0.
- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/tenK/v2`.
- Bazna linija mreže: `tenK/v2/segment01.baseline.json` (10k-v2.1.0); namerno osvežavanje:
  `TEN_K_V2_WRITE_BASELINE=1 npx vitest run --project node src/domain/generators/tenK/v2/grid.node.test.ts`
  pa `npx prettier --write src/domain/generators/tenK/v2/segment01.baseline.json`.
- Regresija: `segment01.baseline-26846d7.json` (10k-v2.0.0) — vrh cilj/planirano ne sme pasti; izuzeci
  samo sa razlogom u `segment01b.regression-exceptions.json` (test traži tačan skup).

## Trenutno stanje

- Podržano: 4 dana, 10–18 nedelja, 25–55 km, rezultat 3/5/10 km ili polumaraton ≤ 84 dana, VDOT 30–80.
- Privremeno odbijeno: 3/5/6 dana i 8–9 nedelja (segment 02), bez pouzdanog rezultata ili VDOT < 30
  (plan po osećaju, segment 03). Trajno: < 8 nedelja, > 18 nedelja („počni kasnije"), < 25 / > 55 km.
- Poznato ograničenje: 4 dana uz dugi ≤ 105 min ne nose trenutni obim sporijih trkača visokog obima
  (540/3024 planova, VDOT 30–45 uz 40–55 km; ned 1 ispod obima samo kad je dugi na 105 min) —
  `CAPACITY_LIMITED` preporučuje 5–6 dana (segment 02).
- Izveštaji: `docs/10k-v2/reports/SEGMENT-01-IMPLEMENTATION.md`, `SEGMENT-01b-IMPLEMENTATION.md`
  (sledeći prozori čitaju „Odluke" i „Preostali problemi" iz 01b).

## Segment 01

- Polazni SHA: `b3e4d75`; commit: „10K v2 Segment 01 (10k-v2.0.0): jezgro 4 dana sa rezultatom"
  (sopstveni SHA ne može da stoji u istom commitu: `git log --grep "10K v2 Segment 01"`).
- Verzija politike: `10k-v2.0.0`.
- Testovi tenK/v2: 11 fajlova, 89 testova (svi prošli).
- `src/domain/generators/` (node): 41 fajl, 838 testova (svi prošli).
- `npm run check`: exit 0 — 206 test fajlova, 2485 testova.
- Mreža 3024 plana: 0 odbijanja, 0 grešaka validatora, deterministička, = bazna linija.
- Sabotaže D5, D6, D8, D12, D13, D14: svaka obara testove (izveštaj).

## Segment 01b (10k-v2.1.0)

- Polazni SHA: `26846d7`; commit: „10K v2 Segment 01b (10k-v2.1.0): kapacitet 4 dana — WU/CD po obimu,
  početni nivo, oštrenje" (`git log --grep "10K v2 Segment 01b"`).
- D14 WU/CD po pojasu obima (15/10, 20/15, 25/15 min), I oporavak naniže na 15 s; D16 početni nivo
  ≤ 60 % plafona; D8 oštrenje ≤ RP doza tapera; D10 T ≥ 1000 m, I do 6 deonica ili piramida; D6 poruka
  `CAPACITY_LIMITED`; D11 ispred D12 usvojeno. Odstupanje: T bez druge strukture se u bazi ponavlja.
- Ned 1 ispod obima 1620 → 540 (svi zbog dugog na 105 min); lagan = dugi 8928 → 7992 nedelja;
  `DOSE_DROPPED` van mreže 867 → 1044 planova; regresija vrha: 600 izuzetaka sa razlogom, 0 bez.
- Testovi tenK/v2: 11 fajlova, 96 testova; radni skup (v2 + architecture + isolation): 121.
- `npm run check`: exit 0 — 206 test fajlova, 2492 testa; tsc domain/oracle, eslint i prettier (v2 + docs) exit 0
  (oracle tsc prvo pao na testu, ispravljeno).
- Mreža 3024: 0 odbijanja, 0 grešaka, deterministička, = nova bazna linija. Sabotaže D14 pojas, D16, D8
  obaraju testove.
