# 10K v2 — STATUS

Novi 10K generator sa jednim vlasnikom svake odluke (D1–D22, D22b, D23, D25), izolovan u
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
// r.ok → r.plan (policyId '10k-v2', policyVersion '10k-v2.2.1', faza svake nedelje, upozorenja)
// !r.ok → r.reasons: [{ code, message }] (npr. RUN_DAYS_COUNT, WEEKLY_KM_TOO_LOW, FEEL_PLAN_SEGMENT_03)
```

- `construct(input, steps)` je isti konstruktor sa koracima adaptacije (segment 04); sada samo `[]`.
- `validatePlan(plan)` samo prijavljuje (greške / upozorenja), plan ne menja.
- Primeri: iz korena repoa `node docs/10k-v2/artifacts/segment-02b/run.ts` (traži `web/node_modules`) →
  `inputs.json`, `<id>.json`, `plans.md` (sa tabelom 02 → 02b); dva pokretanja daju bajt-isti izlaz.
  `segment-01/`, `segment-01b/`, `segment-02/` su zamrznuti izlazi 10k-v2.0.0 / 2.1.0 / 2.2.0.
- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/tenK/v2` (mreža 02 ≈ 80 s).
- Bazna linija: `tenK/v2/segment02b.baseline.json` (15 840 planova, 10k-v2.2.1); namerno osvežavanje:
  `TEN_K_V2_WRITE_BASELINE=1 npx vitest run --project node src/domain/generators/tenK/v2/grid.node.test.ts`
  pa `npx prettier --write src/domain/generators/tenK/v2/segment02b.*.json` (piše i izuzetke vrha).
- Regresija prema 49ad476: `segment02.baseline.json` (redovi 10k-v2.2.0; vrh ne sme pasti, izuzeci sa
  proverenim razlogom u `segment02b.regression-exceptions.json`) i `segment02b.plan-hashes-49ad476.json`
  (ceo plan isti ili promenjen samo od D17 / D22b / D23; heševe piše
  `docs/10k-v2/artifacts/segment-02b/regression-49ad476.ts` iz checkouta 49ad476).

## Trenutno stanje

- Podržano: 3–6 dana (tabela D17), 8–18 nedelja (8–9: D21), rezultat 3/5/10 km ili polumaraton ≤ 84 dana,
  VDOT 30–80. Trajno odbijeno: 1, 2, 7 dana, obim van reda broja dana, < 8 / > 18 nedelja. Privremeno: bez
  pouzdanog rezultata ili VDOT < 30 (segment 03).
- Poznata ograničenja: ponavljanje RP slota bez druge strukture (D22b: 1224 / 192 / 144 / 144 ned);
  kvalitetni dan duži od dugog kod brzog trkača na najnižem obimu (D25, upozorenje); 3 dana / 20 km
  rasterećenje i taper bez kvaliteta; 6 dana / 35 km trkačka ispod minimuma (upozorenje).
- Izveštaji: `docs/10k-v2/reports/SEGMENT-01-…`, `SEGMENT-01b-…`, `SEGMENT-02-…`,
  `SEGMENT-02b-IMPLEMENTATION.md` (sledeći prozori čitaju „Odluke" i „Preostali problemi" iz 02b).

## Segmenti 01 (10k-v2.0.0), 01b (10k-v2.1.0), 02 (10k-v2.2.0)

- 01: polazni `b3e4d75`, jezgro 4 dana, D1–D15; mreža 3024: 0 odbijanja, 0 grešaka.
- 01b: polazni `26846d7`, D14 pojas WU/CD, D16 početni nivo, D8 oštrenje ≤ RP tapera, D10 T ≥ 1000 m.
- 02: polazni `53da370`, D17 tabela po broju dana, D18 3 dana jedan kvalitet, D19 5–6 dana jednaki lagani,
  D20 trkačka min(dana, 5), D21 kratka priprema, D22 T 50 m / R 400 m / BASE_PLATEAU / CAPACITY_LIMITED;
  mreža 15 840: 0 odbijanja, 0 grešaka; `npm run check` 2514 testova. Commitovi: `git log --grep "10K v2"`.

## Segment 02b (10k-v2.2.1)

- Polazni SHA: `49ad476`; commit: „10K v2 Segment 02b (10k-v2.2.1): udeo dugog 3 dana, trkačka ≤ taper, RP
  struktura, upozorenje dugi < kvalitet" (`git log --grep "10K v2 Segment 02b"`).
- D17 izmena: 3 dana udeo dugog 0,45 — ned 1 ispod obima 528 (132 / 396 udeo) → 330 (svi na 105 min),
  CAPACITY_LIMITED 3 dana 888 → 828; 4–6 dana bez promene.
- D22b: RP deonice ≥ 1000 m (50 m bez podele na 100 m); RP < 1000 m 0 (bilo u 2442 plana: 1290 / 576 /
  432 / 144). Odstupanje: ponavljanje raste 216 → 1224 (3 d), 48 → 192 (4 d), 0 → 144 (5/6 d); vrh niži
  u 258 planova sa kapacitetom (do 1,1 km, izuzeci `D22b_CAPACITY`).
- D23: lagan trkačke nedelje = min(35 min E, najkraći lagan tapera); trkačka > taper 8 / 57 / 9 → 0
  (4 / 5 / 6 dana; van mreže 658 → 0); RACE_WEEK_SHORT 6 dana 0 → 90.
- D25: upozorenje `LONG_SHORTER_THAN_QUALITY` 0 / 132 / 132 / 330 planova sa preporukom manje dana.
- Mreža 15 840: 0 odbijanja, 0 grešaka, deterministička, = `segment02b.baseline.json`; regresija prema
  49ad476: isti 6822, D17 2508, D22b 540, D23 5358, D22b + D23 612, drugo 0.
- Testovi tenK/v2: 11 fajlova, 124 testa; radni skup (v2 + architecture + isolation): 149.
- Sabotaže D17 (10 palih), D22b (26), D23 (27); nad kodom 49ad476 pada 22/124 novih testova.
- Provere pre commita: tsc domain/oracle, eslint, prettier (v2 + docs) exit 0; `npm run check` exit 0 —
  206 test fajlova, 2520 testova.
