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
// r.ok → r.plan (policyId 'marathon-v2', policyVersion 'marathon-v2.2.0', paceBasis, faza nedelje, upozorenja)
// !r.ok → r.reasons (kod + poruka sa preporukom: npr. PLAN_TOO_SHORT → polumaraton)
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

## Trenutno stanje (marathon-v2.2.0)

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

## Segment 01 (marathon-v2.0.0)

- Polazni SHA `3fec5c5`; izveštaj `reports/SEGMENT-01-IMPLEMENTATION.md`. STANI (M7 ↔ M11) → M7a.
- Testovi: brz 11 / 122, pun 13 / 132; sabotaže 9/9 PAO; `npm run check` exit 0 (232 fajla, 2857 testova).

## Segment 02 (marathon-v2.1.0)

- Polazni SHA `8ae290a`; commit „Maraton v2 Segment 02 (marathon-v2.1.0): …"; izveštaj
  `reports/SEGMENT-02-IMPLEMENTATION.md`.
- STANI (pouka 28 samo za ned 1: 1611 / 35 910 neizvodljivih pri r ≤ 10 km, skok ned 1 → 2 do ×2,39) → odluka
  organizatora: kotrljajuće pravilo skoka dugog (M13a) + RECENT_LONG_TOO_SHORT.
- Mreža 02 (21 840) i gusta ned 1 (157 954): 0 odbijanja, 0 grešaka; mreža M13a (35 910): 942 odbijanja, sva
  RECENT_LONG_TOO_SHORT (r ≤ 8 km). Regresija 4 dana: tekst 4014, piramida 276, plafon skoka 78, drugo 0.
- Testovi: brz 13 fajlova / 153 testa (27 s), pun 27 / 201 (240 s); sabotaže 9/9 PAO (9,2 s).

## Segment 03 (marathon-v2.2.0)

- Polazni SHA `bfb82c9`; commit „Maraton v2 Segment 03 (marathon-v2.2.0): …"; izveštaj
  `reports/SEGMENT-03-IMPLEMENTATION.md`.
- STANI 1 (udeo 5/6 d ne rešava kval. > dugi; veći udeo K1 ≠ 0) → udeo ostaje + plafon MP sa trajanjem; STANI 2 (S2
  rasterećenje, S3 N−1 početnika) → skraćen dugi, N−1 T kont.; STANI 3 (plafon MP × M13a, +570 odbijanja) → najniži
  nivo MP izuzet; 58 (gusta, T) upozorenje.
- Regresija prema MAR-02: menja se tačno 912 planova (5 d 126, 6 d 786; VDOT 30, MP 16 → 14 km); ostalo bajt-isto.
- Testovi: brz 17 fajlova / 192 testa (48,9 s), pun 33 / 255 (6 min 18 s); sabotaže 13/13 PAO (101,4 s);
  `npm run check` exit 0 (252 fajla, 3060 testova).

## Sledeće

- MAR-04: adaptacija (M18, pouke 7, 16–25); rezultat testa 5 km → MP po M2 od sledeće nedelje.
