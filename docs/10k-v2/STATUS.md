# 10K v2 — STATUS

Novi 10K generator sa jednim vlasnikom svake odluke (D1–D22), izolovan u
`web/src/domain/generators/tenK/v2/`. 10K v1 (`tenK/` van `v2/`) je nepromenjen i jedini je u aplikaciji;
v2 se iz `tenK/index.ts` ne izvozi do segmenta 05.

## Kako se koristi

```ts
import { generateTenKV2 } from "./tenK/v2/index.ts";
const r = generateTenKV2({
  startDate: "2026-11-02", // prvi dan nedelje 1
  raceDate: "2027-02-07", // poslednji dan poslednje nedelje (8–18 celih nedelja)
  runDays: ["tue", "thu", "sat", "sun"], // 3–6 dana (D17)
  longRunDay: "sun", // opciono (inače nedelja / poslednji dan)
  currentWeeklyKm: 40, // prosek poslednje 4 nedelje; opseg po broju dana: 3: 20–40, 4: 25–55, 5: 30–65, 6: 35–80
  recentResult: { distanceM: 10000, timeSec: 2700, date: "2026-10-19" }, // 3/5/10 km ili 21097,5 m, ≤ 84 dana
  goalTimeSec: 2610, // opciono: samo ocena (D3)
});
// r.ok → r.plan (policyId '10k-v2', policyVersion '10k-v2.2.0', faza svake nedelje, upozorenja)
// !r.ok → r.reasons: [{ code, message }] (npr. RUN_DAYS_COUNT, WEEKLY_KM_TOO_LOW, FEEL_PLAN_SEGMENT_03)
```

- `construct(input, steps)` je isti konstruktor sa koracima adaptacije (segment 04); sada samo `[]`.
- `validatePlan(plan)` samo prijavljuje (greške / upozorenja), plan ne menja.
- Primeri: iz korena repoa `node docs/10k-v2/artifacts/segment-02/run.ts` (traži `web/node_modules`) →
  `inputs.json`, `<id>.json`, `plans.md`; dva pokretanja daju bajt-isti izlaz. `segment-01/` i
  `segment-01b/` su zamrznuti izlazi 10k-v2.0.0 / 10k-v2.1.0.
- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/tenK/v2` (mreža 02 ≈ 80 s).
- Bazna linija: `tenK/v2/segment02.baseline.json` (15 840 planova, 10k-v2.2.0); namerno osvežavanje:
  `TEN_K_V2_WRITE_BASELINE=1 npx vitest run --project node src/domain/generators/tenK/v2/grid.node.test.ts`
  pa `npx prettier --write src/domain/generators/tenK/v2/segment02.baseline.json`.
- Regresija prema 53da370: `segment01.baseline.json` (redovi; vrh ne sme pasti, izuzeci sa razlogom u
  `segment02.regression-exceptions.json`) i `segment02.plan-hashes-53da370.json` (ceo plan isti ili D22
  struktura; heševe piše `docs/10k-v2/artifacts/segment-02/regression-53da370.ts` iz checkouta 53da370).

## Trenutno stanje

- Podržano: 3–6 dana (tabela D17), 8–18 nedelja (8–9: D21), rezultat 3/5/10 km ili polumaraton ≤ 84 dana,
  VDOT 30–80. Trajno odbijeno: 1, 2, 7 dana, obim van reda broja dana (poruka navodi koji brojevi dana ga
  podržavaju), < 8 / > 18 nedelja. Privremeno: bez pouzdanog rezultata ili VDOT < 30 (segment 03).
- Poznata ograničenja: 3 dana uz udeo 40 % i niski obim (ned 1 ispod obima, rasterećenje/taper bez
  kvaliteta, ponavljanje RP 2,5/3,5 km); 5–6 dana uz nizak obim i brz tempo — WU/CD dominiraju nedeljom.
- Izveštaji: `docs/10k-v2/reports/SEGMENT-01-IMPLEMENTATION.md`, `SEGMENT-01b-…`, `SEGMENT-02-IMPLEMENTATION.md`
  (sledeći prozori čitaju „Odluke" i „Preostali problemi" iz 02).

## Segment 01 (10k-v2.0.0) i 01b (10k-v2.1.0)

- 01: polazni `b3e4d75`, jezgro 4 dana, D1–D15; mreža 3024: 0 odbijanja, 0 grešaka; `npm run check` 2485 testova.
- 01b: polazni `26846d7`, D14 pojas WU/CD, D16 početni nivo, D8 oštrenje ≤ RP tapera, D10 T ≥ 1000 m;
  ned 1 ispod obima 1620 → 540; `npm run check` 2492 testa. Commitovi: `git log --grep "10K v2 Segment 01"`.

## Segment 02 (10k-v2.2.0)

- Polazni SHA: `53da370`; commit: „10K v2 Segment 02 (10k-v2.2.0): 3/5/6 dana, kratka priprema 8–9 ned"
  (`git log --grep "10K v2 Segment 02"`).
- D17 tabela po broju dana (jedina), D18 3 dana jedan kvalitet (T kont. / T cruise / RP), D19 5–6 dana
  jednaki lagani, D20 trkačka min(dana, 5), D21 kratka priprema 2/2/2 i 2/3/2, D22 T 50 m, R 400 m,
  BASE_PLATEAU greška, CAPACITY_LIMITED sa stvarnim ograničenjem.
- Odstupanja (opreznije, sa ulazom u DECISIONS): 3 dana ned 1 ispod obima zbog udela (396 planova);
  rasterećenje bez kvaliteta (528 ned), taper bez kvaliteta (48) / samo RP (6), trkačka < min (6),
  ponavljanje jedinog slota (216 ned), oštrenje nesusedno dugom tapera (van mreže).
- Mreža 15 840: 0 odbijanja, 0 grešaka, deterministička, = bazna linija; van mreže 23 036: 0 odbijanja.
- Regresija 4 dana × 10–18: redovi 0 promena, vrh ≥ 53da370 (0 izuzetaka); planovi 2184 isti, 840 sa D22
  strukturom; ponavljanje slota 1068 → 0; BASE_PLATEAU 0.
- Testovi tenK/v2: 11 fajlova, 118 testova; radni skup (v2 + architecture + isolation): 143.
- `npm run check`: exit 0 — 206 test fajlova, 2514 testova; tsc domain/oracle, eslint i prettier (v2 + docs) exit 0
  (oracle tsc prvo pao na testu, ispravljeno).
- Sabotaže D18 (18 palih), D19 (16), D21 (6), D22 (19; poruka 3); nad kodom 53da370 pada 49/118 novih testova.
