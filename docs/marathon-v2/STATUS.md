# Maraton v2 — STATUS

Novi generator maratona sa jednim vlasnikom svake odluke (M1–M17 + M7a, M10a, M13a iz
`docs/generators-v2/MASTER-HM-MARATHON.md` § 5), izolovan u `web/src/domain/generators/marathon/v2/`. Maraton v1
(`marathon/` van `v2/`) je nepromenjen i podrazumevan; od segmenta MAR-05 v2 je u aplikaciji iza prekidača
(`ui.generatorV2Marathon` / `VITE_MARATHON_V2`), samo kroz adapter `v2/app/` (`marathon/index.ts` izvozi `marathonV2`,
bira `select.ts` po `marathon-v2`). Prilagođavanje plana v2 u aplikaciji (MAR-06): činjenice → pregled → potvrda →
revizija, vraćanje verzije, traka, Forma, promena cilja.

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
// r.ok → r.plan (policyId 'marathon-v2', policyVersion 'marathon-v2.4.0', paceBasis, faza nedelje, upozorenja)
// !r.ok → r.reasons (kod + poruka sa preporukom: npr. PLAN_TOO_SHORT → polumaraton)
const a = adaptMarathonV2(r.plan, facts, "2026-12-13"); // M18: činjenice → { ok, plan, changes, reasons } ili odbijanje
// a.ok → a.newLimits (pouka 20: nova ograničenja poslednjeg koraka, steps.newLimits)
// adaptBanner(r.plan, a, facts, asOf) → poruke trake (pouka 20; JEDINO pravilo trake, aplikacija ga samo zove)
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

## Trenutno stanje (marathon-v2.4.0)

- MAR-07 (Faza 4a): trkačka nedelja samo sa trkom → RACE_WEEK_SHORT (N1); pouka 35 (drugi dan kvaliteta lagan kad bi
  dan kvaliteta bio duži od dugog, izgradnja; jedan kvalitet neizvodljiv → dva + upozorenje pouke 14); pouka 36 (umor
  vezan za zapise); validator čita stanje mešovite nedelje (N8); jedna definicija po veličini (N9); preporuka manje
  dana (pouka 14); MARATHON_LONG_SHORT samo bez plafona 150 min, tehnička napomena se ne prikazuje (N11).

- MAR-04/04b: assess → isti konstruktor → upisani dani (written.ts) → validate; pouka 32 za sve zone, pouka 34 (umor
  pre starta). Bez činjenica plan bajt-isti generatoru.
- 3/4/5/6 dana (M15), 12–24 nedelje, obim po redu, rezultat 10K/HM/maraton (5K uz RESULT_5K) ≤ 84 dana, VDOT 30–80.
  3 dana: jedan kvalitet T kont. → T cruise → MP (bez I/R), rasterećenje T na Q1, taper samo MP. 5/6 dana: lagani
  jednaki. Piramida M10a (I 5000 = 800-1000-1200-1200-800). M13a: dugi ≤ max(1,1 L; L + 1), L = najduži prethodne 4
  nedelje (skorašnji najduži = ned 0); neizvodljivo sa njim → RECENT_LONG_TOO_SHORT.
- M16 po osećaju (bez rezultata / > 84 dana / VDOT < 30): lagan 270–510 obavezan, E ± 15 s, procena VDOT, RPE, test
  5 km u poslednjoj nedelji baze. M17 početnik: 4–5 d, 16–24 ned, uvod 2 ned, 1 kvalitet, T kont. od 1,5 km, N−1 bez
  MP. Plafon zone: udeo M11 i trajanje dana ≤ dugi (najniži nivo izuzet; MAR-04b). S2: skraćen dugi rasterećenja (test/početnik).
- Trajno odbijeno: < 12 ned (polumaraton), obim van reda (preporuka broja dana; < 30 km polumaraton/osnova), 1/2/7
  dana, VDOT > 80, trčanje/hodanje (svi); početnik 3/6 dana, < 16 ned, obim van 25–45 / 30–50. „Počni kasnije": > 24 ned.

## Segmenti (izveštaji `reports/SEGMENT-NN-IMPLEMENTATION.md`)

| segment | verzija     | polazni SHA                     | sadržaj                                                                                              |
| ------- | ----------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 01–03   | 2.0.0–2.2.0 | `3fec5c5`, `8ae290a`, `bfb82c9` | jezgro 4 d (STANI → M7a); 3/5/6 d, M13a; po osećaju + test, početnik                                 |
| 04      | 2.3.0       | `5547285`                       | adaptacija M18 (A1–A15, A17); mreža 04, trajna rana, široka pretraga; sabotaže 14/14                 |
| 04b     | 2.3.1       | `bd07eec`                       | pouka 32 sve zone, umor pre starta (pouka 34), BASE_PLATEAU; `artifacts/segment-04b/`                |
| MAR-05  | 2.3.1       | `9443676`                       | aplikacija iza prekidača `generatorV2Marathon`, adapter `v2/app/`, byteSame 223 heša                 |
| MAR-06  | 2.3.1       | `8beef45`                       | adaptacija u aplikaciji (facts, pregled → potvrda → revizija, vraćanje, Forma, cilj), traka u domenu |

## Segment MAR-07 (marathon-v2.4.0, Faza 4a)

- Polazni SHA `7ba9717`; izveštaj `reports/SEGMENT-07-IMPLEMENTATION.md`; merenje i sabotaže `artifacts/segment-07/`.
- KNOWN_VERSIONS = 2.3.1 ∪ 2.4.0. Regresija 0 neobjašnjenih (široka 267 927); brz nivo 43 s; sabotaže 6/6.

## Sledeće

- Predaja maraton v2 ↔ HM/10K (faza 3); otvorena pitanja MAR-06 (izveštaj).
