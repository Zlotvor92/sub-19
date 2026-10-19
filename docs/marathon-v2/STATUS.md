# Maraton v2 — STATUS

Novi generator maratona sa jednim vlasnikom svake odluke (M1–M15 + M7a, M10a, M13a iz
`docs/generators-v2/MASTER-HM-MARATHON.md` § 5), izolovan u `web/src/domain/generators/marathon/v2/`. Maraton v1
(`marathon/` van `v2/`) je nepromenjen i jedini u aplikaciji; `marathon/index.ts` se ne menja do faze 2 (MAR-05).

## Kako se koristi

```ts
import { generateMarathonV2 } from "./marathon/v2/index.ts";
const r = generateMarathonV2({
  startDate: "2026-11-02", // prvi dan nedelje 1
  raceDate: "2027-02-21", // poslednji dan poslednje nedelje (12–24 cele nedelje)
  runDays: ["tue", "thu", "sat", "sun"], // 3–6 dana (M15)
  longRunDay: "sun", // opciono
  currentWeeklyKm: 45, // po redu M15: 3 d 30–50, 4 d 35–65, 5 d 40–85, 6 d 50–110 km
  recentResult: { distanceM: 21097.5, timeSec: 6300, date: "2026-10-19" }, // 10K/HM/M; 5K uz upozorenje
  goalTimeSec: 12600, // opciono, samo ocena (M3)
  recentLongRunKm: 18, // opciono, 5–42 km: skok dugog ≤ 10 % (M13a)
});
// r.ok → r.plan (policyId 'marathon-v2', policyVersion 'marathon-v2.1.0', faza nedelje, upozorenja)
// !r.ok → r.reasons (kod + poruka sa preporukom: npr. PLAN_TOO_SHORT → polumaraton)
```

- Jedan konstruktor (`generate.ts`), validator samo prijavljuje (`validate.ts`; greške → `PLAN_VIOLATES_POLICY`).
- Primeri: iz korena repoa `node --experimental-strip-types docs/marathon-v2/artifacts/segment-02/run.ts` →
  `inputs.json`, `<id>.json`, `examples.md`; `metrics.ts` → `metrics.json` (K1–K6 po broju dana, K4, mreža M13a);
  `regression-01.ts <worktree e86d2c3>` → `segment02.regression-01.json`. Dva pokretanja daju bajt-isti izlaz.
- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/marathon/v2` (brz) i `TEST_FULL=1 …`
  (pun: mreža 02 u 6 delova, gusta ned 1 u 8, mreža M13a u 3).
- Bazna linija mreže 02: `segment02.baseline.json` (21 840 redova + heš plana); osvežavanje
  `TEST_FULL=1 MARATHON_V2_WRITE_BASELINE=1 npx vitest run --project node src/domain/generators/marathon/v2/grid.node.test.ts`,
  pa `npx prettier --write` na fajl. Regresija 4 dana prema MAR-01: `segment01.baseline.json` +
  `segment02.regression-01.json`.
- Sabotaže: `node scripts/sabotage.mjs ../docs/marathon-v2/artifacts/segment-02/sabotage.json --parallel 2`.

## Trenutno stanje (marathon-v2.1.0)

- 3/4/5/6 dana (M15), 12–24 nedelje, obim po redu, rezultat 10K/HM/maraton (5K uz RESULT_5K) ≤ 84 dana, VDOT 30–80.
  3 dana: jedan kvalitet T kont. → T cruise → MP (bez I/R), rasterećenje T na Q1, taper samo MP. 5/6 dana: lagani
  jednaki. Piramida M10a (I 5000 = 800-1000-1200-1200-800). M13a: dugi ≤ max(1,1 L; L + 1), L = najduži prethodne 4
  nedelje (skorašnji najduži = ned 0); neizvodljivo sa njim → RECENT_LONG_TOO_SHORT.
- Trajno odbijeno: < 12 ned (polumaraton), obim van reda (preporuka broja dana; < 30 km polumaraton/osnova), 1/2/7
  dana, VDOT > 80, trčanje/hodanje. „Počni kasnije": > 24 ned. Privremeno: bez rezultata / stariji od 84 dana /
  VDOT < 30 / početnik (MAR-03).
- Mreža 02 (21 840): 0 odbijanja, 0 grešaka (metrike: `reports/SEGMENT-02-IMPLEMENTATION.md`).

## Segment 01 (marathon-v2.0.0)

- Polazni SHA `3fec5c5`; commit „Maraton v2 Segment 01 (marathon-v2.0.0): …" (`git log --grep "Maraton v2 Segment 01"`);
  izveštaj `reports/SEGMENT-01-IMPLEMENTATION.md`.
- STANI (M7 ↔ M11, 48 planova) → odluka organizatora (b) = M7a; nalazi (dublji taper, MARATHON_LONG_SHORT,
  kapacitet) i tumačenja prihvaćeni.
- Testovi marathon/v2: brz 11 fajlova / 122 testa, pun 13 / 132; sabotaže 9/9 PAO (14,6 s);
  `npm run check` exit 0 (232 fajla, 2857 testova).

## Segment 02 (marathon-v2.1.0)

- Polazni SHA `8ae290a`; commit „Maraton v2 Segment 02 (marathon-v2.1.0): …"; izveštaj
  `reports/SEGMENT-02-IMPLEMENTATION.md`.
- STANI (pouka 28 samo za ned 1: 1611 / 35 910 neizvodljivih pri r ≤ 10 km, skok ned 1 → 2 do ×2,39) → odluka
  organizatora: kotrljajuće pravilo skoka dugog (M13a) + RECENT_LONG_TOO_SHORT.
- Mreža 02 (21 840) i gusta ned 1 (157 954): 0 odbijanja, 0 grešaka; mreža M13a (35 910): 942 odbijanja, sva
  RECENT_LONG_TOO_SHORT (r ≤ 8 km). Regresija 4 dana: tekst 4014, piramida 276, plafon skoka 78, drugo 0.
- Testovi: brz 13 fajlova / 153 testa (27 s), pun 27 / 201 (240 s); sabotaže 9/9 PAO (9,2 s).

## Sledeće

- MAR-03: po osećaju + test 5 km (M16), početnik (M17). MAR-04: adaptacija (M18, pouke 7, 16–25).
