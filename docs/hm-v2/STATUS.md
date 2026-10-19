# HM v2 — STATUS

Novi generator polumaratona (policyId `hm-v2`) sa jednim vlasnikom svake odluke (H1–H15 iz
`docs/generators-v2/MASTER-HM-MARATHON.md` § 4), izolovan u `web/src/domain/generators/halfMarathon/v2/`. HM v1 je
nepromenjen i jedini u aplikaciji; `halfMarathon/index.ts` ne izvozi v2 do faze 2.

## Kako se koristi

```ts
import { generateHmV2 } from "./halfMarathon/v2/index.ts";
const r = generateHmV2({
  startDate: "2026-11-02", // prvi dan nedelje 1
  raceDate: "2027-01-24", // poslednji dan poslednje nedelje (10–20 celih nedelja)
  runDays: ["tue", "thu", "sat", "sun"], // segment 01: 4 dana
  currentWeeklyKm: 40, // 30–60 km
  recentResult: { distanceM: 10000, timeSec: 2700, date: "2026-10-19" }, // 5/10 km, HM, maraton ≤ 84 dana
  goalTimeSec: 6000, // opciono (ocena H3)
});
// r.ok → r.plan (policyId 'hm-v2', policyVersion 'hm-v2.0.0', faza nedelje, upozorenja); !r.ok → r.reasons
```

- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/halfMarathon/v2` (brz, ≈ 7 s);
  `TEST_FULL=1 …` (pun, ≈ 40 s: mreža 01 u 2 dela, gusta mreža nedelje 1 u 3 dela).
- Bazna linija `segment01.baseline.json` (3696: vrh, najduži dugi, heš plana bez oznake verzije); osvežavanje
  `TEST_FULL=1 HM_V2_WRITE_BASELINE=1 npx vitest run --project node src/domain/generators/halfMarathon/v2/grid.node.test.ts`,
  pa prettier.
- Primeri: `node docs/hm-v2/artifacts/segment-01/run.ts`; K1–K6: `…/k-metrics.ts`; sabotaže:
  `node scripts/sabotage.mjs ../docs/hm-v2/artifacts/segment-01/sabotage.json --parallel 2`.

## Segment 01 (hm-v2.0.0): jezgro 4 dana sa rezultatom

- Zaustavljeno na `faf8807` (sudar H6/pouka 9 ↔ udeo dugog 35 %; `reports/SEGMENT-01-STOP.md`); odluka
  organizatora: udeo 4 dana 0,40, tumačenja HI1/HI4, odbijanja van opsega 01. Izveštaj
  `reports/SEGMENT-01-IMPLEMENTATION.md`; commit „HM v2 Segment 01 (hm-v2.0.0): …" (`git log --grep "HM v2 Segment 01"`).
- Mreža 01 (3696) i gusta mreža nedelje 1 (30 401): K1 0, K2 bez dugog na 150 min 0, K3 0, K5 0, invarijante 0;
  CAPACITY_LIMITED 774 (VDOT 30–40 pri 40–60 km), DOSE_DROPPED 102 (samo u nedeljama ograničenim kapacitetom).
- `npm run check` exit 0 (244 fajla, 2941 test). Sabotaže 8/8 (rasterećenje, plafon zone, dugi ≥ lagan, taper ×2, oštrenje, lagan trkačke, udeo dugog).
- Odbijeno do sledećih segmenata: 3/5/6 dana (02), bez rezultata i početnik (03); trajno 1/2/7 dana, < 10 ned,
  < 30 km, VDOT > 80, trčanje/hodanje.
- Sledeće: HM-02 (3/5/6 dana, H15 ostali redovi), regresija prema `segment01.baseline.json`.
