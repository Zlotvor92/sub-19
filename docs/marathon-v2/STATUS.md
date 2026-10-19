# Maraton v2 — STATUS

Novi generator maratona sa jednim vlasnikom svake odluke (M1–M17 + M7a, M10a, M13a iz
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
  // bez rezultata: easyPaceSecPerKm: 360 (po osećaju, M16); experience: 'beginner' (M17)
});
// r.ok → r.plan (policyId 'marathon-v2', policyVersion 'marathon-v2.3.0', paceBasis, faza nedelje, upozorenja)
// !r.ok → r.reasons (kod + poruka sa preporukom: npr. PLAN_TOO_SHORT → polumaraton)
const a = adaptMarathonV2(r.plan, facts, "2026-12-13"); // M18: činjenice → { ok, plan, changes, reasons } ili odbijanje
// adaptBanner(r.plan, a, facts, asOf) → poruke trake (pouka 20, samo novo ograničenje)
```

- Jedan konstruktor (`generate.ts`), validator samo prijavljuje (`validate.ts`; greške → `PLAN_VIOLATES_POLICY`).
- Primeri: iz korena repoa `node --experimental-strip-types docs/marathon-v2/artifacts/segment-03/run.ts` →
  `inputs.json`, `<id>.json`, `examples.md`; `metrics.ts` → `metrics.json` (mreža 03 po osećaju i početnik, regresija
  prema MAR-02, mreža M13a, gusta ned 1). Dva pokretanja daju bajt-isti izlaz.
- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/marathon/v2` (brz) i `TEST_FULL=1 …`
  (pun: mreža 02 u 6 delova, gusta ned 1 u 8, mreža M13a u 3, po osećaju u 3, početnik cela).
- Bazne linije: `segment03.baseline.json` (mreža 02), `segment03-feel.baseline.json`, `segment03-beginner.baseline.json`;
  osvežavanje `TEST_FULL=1 MARATHON_V2_WRITE_BASELINE=1 npx vitest run --project node <grid|feelGrid|beginnerGrid>.node.test.ts`,
  pa `npx prettier --write`. Regresija prema MAR-02: `segment02.baseline.json` (planHash02); prema MAR-01:
  `segment01.baseline.json` + `segment02.regression-01.json`.
- Sabotaže: `node scripts/sabotage.mjs ../docs/marathon-v2/artifacts/segment-03/sabotage.json`.

## Trenutno stanje (marathon-v2.3.0)

- M18 adaptacija (MAR-04): assess → isti konstruktor (construct) → spajanje upisanih dana (written.ts) → validate;
  A1–A15, A17 (kopija 10K v2 sa brojevima maratona). Bez činjenica: plan bajt-isti (mreže 02/03, bazne linije).
- Mreža 04 (6236 tokova), trajna mreža rane adaptacije (45 101) i široka pretraga: 0 odbijanja, 0 prekršaja
  adaptInvariants. Sabotaže `artifacts/segment-04/sabotage.json`.

- 3/4/5/6 dana (M15), 12–24 nedelje, obim po redu, rezultat 10K/HM/maraton (5K uz RESULT_5K) ≤ 84 dana, VDOT 30–80.
  3 dana: jedan kvalitet T kont. → T cruise → MP (bez I/R), rasterećenje T na Q1, taper samo MP. 5/6 dana: lagani
  jednaki. Piramida M10a (I 5000 = 800-1000-1200-1200-800). M13a: dugi ≤ max(1,1 L; L + 1), L = najduži prethodne 4
  nedelje (skorašnji najduži = ned 0); neizvodljivo sa njim → RECENT_LONG_TOO_SHORT.
- M16 po osećaju (bez rezultata / > 84 dana / VDOT < 30): lagan 270–510 obavezan, E ± 15 s, procena VDOT, RPE, test
  5 km u poslednjoj nedelji baze. M17 početnik: 4–5 d, 16–24 ned, uvod 2 ned, 1 kvalitet, T kont. od 1,5 km, N−1 bez
  MP. Plafon MP: 20 % i trajanje MP dana ≤ dugi (najniži nivo izuzet). S2: skraćen dugi rasterećenja (test/početnik).
- Trajno odbijeno: < 12 ned (polumaraton), obim van reda (preporuka broja dana; < 30 km polumaraton/osnova), 1/2/7
  dana, VDOT > 80, trčanje/hodanje (svi); početnik 3/6 dana, < 16 ned, obim van 25–45 / 30–50. „Počni kasnije": > 24 ned.
- Mreže 02, 03 (8190 + 1890) i gusta ned 1: 0 odbijanja, 0 grešaka; M13a 942 (= MAR-02).

## Segmenti 01–03

- 01 (`marathon-v2.0.0`, od `3fec5c5`): jezgro 4 dana; STANI M7 ↔ M11 → M7a. 02 (`marathon-v2.1.0`, od `8ae290a`): 3/5/6
  dana, M13a. 03 (`marathon-v2.2.0`, od `bfb82c9`): po osećaju + test, početnik, plafon MP sa trajanjem. Detalji u
  `reports/SEGMENT-01…03-IMPLEMENTATION.md`.

## Segment 04 (marathon-v2.3.0)

- Polazni SHA `5547285`; izveštaj `reports/SEGMENT-04-IMPLEMENTATION.md`; bez STANI.
- Testovi: brz 20 fajlova / 233 testa (50,3 s), pun 40 / 302 (10 min 43 s); sabotaže 14/14 PALO; `npm run check` exit 0
  (260 fajlova, 3155 testova). Skripte `artifacts/segment-04/` (grid04, wide, metrics).

## Sledeće

- Faza 2: MAR-05 (prekidač, adapter, aplikacija) posle HM-05/06.
