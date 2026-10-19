# Maraton v2 — STATUS

Novi generator maratona sa jednim vlasnikom svake odluke (M1–M15 + M7a iz
`docs/generators-v2/MASTER-HM-MARATHON.md` § 5), izolovan u `web/src/domain/generators/marathon/v2/`. Maraton v1
(`marathon/` van `v2/`) je nepromenjen i jedini u aplikaciji; `marathon/index.ts` se ne menja do faze 2 (MAR-05).

## Kako se koristi

```ts
import { generateMarathonV2 } from "./marathon/v2/index.ts";
const r = generateMarathonV2({
  startDate: "2026-11-02", // prvi dan nedelje 1
  raceDate: "2027-02-21", // poslednji dan poslednje nedelje (12–24 cele nedelje)
  runDays: ["tue", "thu", "sat", "sun"], // segment 01: tačno 4 dana
  longRunDay: "sun", // opciono
  currentWeeklyKm: 45, // 35–65 km
  recentResult: { distanceM: 21097.5, timeSec: 6300, date: "2026-10-19" }, // 10K/HM/M; 5K uz upozorenje
  goalTimeSec: 12600, // opciono, samo ocena (M3)
});
// r.ok → r.plan (policyId 'marathon-v2', policyVersion 'marathon-v2.0.0', faza nedelje, upozorenja)
// !r.ok → r.reasons (kod + poruka sa preporukom: npr. PLAN_TOO_SHORT → polumaraton)
```

- Jedan konstruktor (`generate.ts`), validator samo prijavljuje (`validate.ts`; greške → `PLAN_VIOLATES_POLICY`).
- Primeri: iz korena repoa `node --experimental-strip-types docs/marathon-v2/artifacts/segment-01/run.ts` →
  `inputs.json`, `<id>.json`, `examples.md` (mali obim, veliki obim, spor, brz); `metrics.ts` → `metrics.json`
  (K1–K6, taper po obimu). Dva pokretanja daju bajt-isti izlaz.
- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/marathon/v2` (brz, ≈ 5 s);
  `TEST_FULL=1 …` (pun, ≈ 11 s; mreža 01 u delovima `grid.<k>.full.node.test.ts`).
- Bazna linija mreže 01: `segment01.baseline.json` (4368 redova + heš celog plana); osvežavanje
  `TEST_FULL=1 MARATHON_V2_WRITE_BASELINE=1 npx vitest run --project node src/domain/generators/marathon/v2/grid.node.test.ts`,
  pa `npx prettier --write` na fajl.
- Sabotaže: `node scripts/sabotage.mjs ../docs/marathon-v2/artifacts/segment-01/sabotage.json --parallel 2`.

## Trenutno stanje (marathon-v2.0.0)

- 4 dana, 12–24 nedelje, 35–65 km, rezultat 10K/HM/maraton (5K uz RESULT_5K) ≤ 84 dana, VDOT 30–80.
- Trajno odbijeno: < 12 ned (preporuka polumaraton), < 35 km (polumaraton ili osnova), > 65 km za 4 dana, 1/2/7
  dana, VDOT > 80, trčanje/hodanje. „Počni kasnije": > 24 ned. Privremeno: 3/5/6 dana (MAR-02), bez rezultata /
  stariji od 84 dana / VDOT < 30 / početnik (MAR-03).
- Faze 4/5/6 specifično, taper 2 nedelje (N−2 0,8 ×, N−1 0,6 × vrh), trkačka nedelja M8; MP iz VDOT-a umanjenog za
  korekciju obima (M2). M7a: minimum MP tapera (2 × 3000 m) ispred plafona 20 % (samo taper).
- Mreža 01 (4368): 0 odbijanja, 0 grešaka; upozorenja MARATHON_LONG_SHORT 2832, CAPACITY_LIMITED 1656,
  DOSE_DROPPED 318, TAPER_MP_OVER_CAP 48.

## Segment 01 (marathon-v2.0.0)

- Polazni SHA `3fec5c5`; commit „Maraton v2 Segment 01 (marathon-v2.0.0): …" (`git log --grep "Maraton v2 Segment 01"`);
  izveštaj `reports/SEGMENT-01-IMPLEMENTATION.md`.
- STANI (M7 ↔ M11, 48 planova) → odluka organizatora (b) = M7a; nalazi (dublji taper, MARATHON_LONG_SHORT,
  kapacitet) i tumačenja prihvaćeni.
- Testovi marathon/v2: brz 11 fajlova / 122 testa, pun 13 / 132; sabotaže 9/9 PAO (14,6 s);
  `npm run check` exit 0 (232 fajla, 2857 testova).

## Sledeće

- MAR-02: 3/5/6 dana (M15 tabela), mreža 02; regresija prema `segment01.baseline.json` (K4).
- MAR-03: po osećaju + test 5 km (M16), početnik (M17). MAR-04: adaptacija (M18, pouke 7, 16–25).
