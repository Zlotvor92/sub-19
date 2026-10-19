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
  runDays: ["tue", "thu", "sat", "sun"], // 3–6 dana (H15)
  currentWeeklyKm: 40, // po redu H15 (4 dana 30–60 km)
  recentLongRunKm: 14, // opciono, 5–42 km (pouka 28)
  recentResult: { distanceM: 10000, timeSec: 2700, date: "2026-10-19" }, // 5/10 km, HM, maraton ≤ 84 dana
  goalTimeSec: 6000, // opciono (ocena H3)
});
// r.ok → r.plan (policyId 'hm-v2', policyVersion 'hm-v2.1.0', faza nedelje, upozorenja); !r.ok → r.reasons
```

- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/halfMarathon/v2` (brz, ≈ 16 s);
  `TEST_FULL=1 …` (pun, ≈ 125 s: mreža 02 u 4 dela, gusta mreža nedelje 1 u 8 delova).
- Bazne linije: `segment01.baseline.json` + `segment01.norm-hashes-3979237.json` (regresija 4 dana prema HM-01),
  `segment02.baseline.json` (16 896); osvežavanje `TEST_FULL=1 HM_V2_WRITE_BASELINE=1 npx vitest run --project node
src/domain/generators/halfMarathon/v2/grid.node.test.ts`, pa prettier.
- Primeri, K1–K6, merenja i sabotaže: `docs/hm-v2/artifacts/segment-02/` (`run.ts`, `k-metrics.ts`, `measure-*.ts`,
  `sabotage.json`).

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

## Segment 02 (hm-v2.1.0): 3/5/6 dana, dugi ≤ 24 km, pouka 28 kotrljajuće

- Zaustavljeno na `01dd4a1` (sudar pouke 28 pri r ≤ 6 km; `reports/SEGMENT-02-STOP.md`); odluke organizatora: P1
  `RECENT_LONG_TOO_SHORT` i pouka 28 kao kotrljajuće pravilo (MASTER `0614e57`). Izveštaj
  `reports/SEGMENT-02-IMPLEMENTATION.md`.
- Mreža 02 (16 896) i gusta ned 1 (141 804): K1 0, K2 bez plafona 0, invarijante 0; mreža r (10 944): samo
  RECENT_LONG_TOO_SHORT u ned 1 (r ≤ 6, 3–4 d). Regresija 4 dana: 1320 (24 km) + 198 (pouka 28), vrh niži 0.
- Testovi: brz ≈ 16 s, pun 125 s; bazna linija `segment02.baseline.json` (piše je `TEST_FULL=1 HM_V2_WRITE_BASELINE=1
… grid.node.test.ts`); primeri, K i merenja u `artifacts/segment-02/`; sabotaže 12/12.
- Sledeće: HM-03 (po osećaju + test, početnik).
