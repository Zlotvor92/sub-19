# 10K v2 — STATUS

Novi 10K generator sa jednim vlasnikom svake odluke (D1–D22, D22b, D23, D25–D30), izolovan u
`web/src/domain/generators/tenK/v2/`. 10K v1 (`tenK/` van `v2/`) je nepromenjen i jedini je u aplikaciji;
v2 se iz `tenK/index.ts` ne izvozi do segmenta 05.

## Kako se koristi

```ts
import { generateTenKV2 } from "./tenK/v2/index.ts";
const r = generateTenKV2({
  startDate: "2026-11-02", // prvi dan nedelje 1
  raceDate: "2027-02-07", // poslednji dan poslednje nedelje (8–18 celih nedelja; početnik 10–18)
  runDays: ["tue", "thu", "sat", "sun"], // 3–6 dana (D17); početnik 3–4 (D28)
  longRunDay: "sun", // opciono (inače nedelja / poslednji dan)
  currentWeeklyKm: 40, // 3: 20–40, 4: 25–55, 5: 30–65, 6: 35–80; početnik 3: 15–30, 4: 18–35
  recentResult: { distanceM: 10000, timeSec: 2700, date: "2026-10-19" }, // 3/5/10 km ili 21097,5 m
  easyPaceSecPerKm: 330, // 270–510; obavezan bez rezultata, uz rezultat > 84 dana ili VDOT < 30 (D26)
  experience: "regular", // ili "beginner" (D28); podrazumevano regular
  runWalk: false, // true → RUN_WALK_NOT_SUPPORTED (D29)
  goalTimeSec: 2610, // opciono: samo ocena (D3); u planu po osećaju posle testa
});
// r.ok → r.plan (policyId '10k-v2', policyVersion '10k-v2.3.0', paceBasis 'result' | 'feel', faza svake
// nedelje, test 5 km u planu po osećaju, RPE na kvalitetu po osećaju, upozorenja)
// !r.ok → r.reasons: [{ code, message }] (npr. EASY_PACE_REQUIRED, BEGINNER_DAYS, RUN_WALK_NOT_SUPPORTED)
```

- `construct(input, steps)` je isti konstruktor sa koracima adaptacije (segment 04); sada samo `[]`.
- `validatePlan(plan)` samo prijavljuje (greške / upozorenja), plan ne menja.
- Primeri: iz korena repoa `node docs/10k-v2/artifacts/segment-03/run.ts` (traži `web/node_modules`) →
  `inputs.json`, `<id>.json`, `plans.md`; dva pokretanja daju bajt-isti izlaz. `segment-01/` … `segment-02b/`
  su zamrznuti izlazi 10k-v2.0.0 … 2.2.1.
- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/tenK/v2` (tri mreže ≈ 95 s).
- Bazne linije (10k-v2.3.0): `segment03.baseline.json` (15 840 sa rezultatom), `segment03-feel.baseline.json`
  (11 880 po osećaju), `segment03-beginner.baseline.json` (3402 početnik); namerno osvežavanje:
  `TEN_K_V2_WRITE_BASELINE=1 npx vitest run --project node src/domain/generators/tenK/v2/grid.node.test.ts`
  (isto za `feelGrid` / `beginnerGrid`), pa `npx prettier --write src/domain/generators/tenK/v2/segment03*.json`.
- Regresija prema 21c03f1: `segment02b.baseline.json` (redovi 10k-v2.2.1; vrh ne sme pasti, izuzeci u
  `segment03.regression-exceptions.json`) i `segment03.plan-hashes-21c03f1.json` (ceo plan isti ili promenjen
  samo od D30a / D30b; piše ga `docs/10k-v2/artifacts/segment-03/regression-21c03f1.ts` iz checkouta 21c03f1).
  `segment02.baseline.json` (49ad476) služi samo za proveru vrha iz D30.

## Trenutno stanje

- Podržano: 3–6 dana, 8–18 nedelja, rezultat ≤ 84 dana sa VDOT 30–80 ili plan po osećaju (lagan tempo,
  procena VDOT 25–60, test 5 km na kraju baze), početnik 3–4 dana / 10–18 ned. Trajno odbijeno: 1, 2, 7 dana,
  obim van reda, < 8 / > 18 ned, VDOT > 80, trčanje/hodanje; početnik 5–6 dana, 8–9 ned, obim van D28.
- Poznata ograničenja: početnik malog obima bez kvaliteta (D11), test u rasterećenju skraćuje dugi;
  ponavljanje slota RP 2,5 / 3,5 km i I 2,0 km; D25 kod brzog trkača malog obima; 4 dana po osećaju sa sporim
  laganim tempom ograničena udelom dugog 33 %.
- Izveštaji: `docs/10k-v2/reports/SEGMENT-01-…` … `SEGMENT-03-IMPLEMENTATION.md` (sledeći prozori čitaju
  „Odluke" i „Preostali problemi" iz 03).

## Segmenti 01–02b (10k-v2.0.0 … 2.2.1)

- 01 (`b3e4d75` →): jezgro 4 dana, D1–D15; 01b: D14 pojas WU/CD, D16, D8 oštrenje, D10 T ≥ 1000 m.
- 02 (`53da370` →): D17–D22 (3/5/6 dana, kratka priprema); 02b (`49ad476` →): D17 udeo 3 dana 0,45, D22b,
  D23 trkačka ≤ taper, D25 upozorenje. Commitovi: `git log --grep "10K v2"`.

## Segment 03 (10k-v2.3.0)

- Polazni SHA: `21c03f1`; commit: „10K v2 Segment 03 (10k-v2.3.0): plan po osećaju + test 5 km, početnik, bez
  trčanja/hodanja, ispravke RP i trkačke nedelje" (`git log --grep "10K v2 Segment 03"`).
- D26 plan po osećaju (E = lagan ± 15 s, procena VDOT = VO2(lagan)/0,70, RPE, bez prognoze); D27 test 5 km
  (poslednja nedelja baze, Q1 / umesto kvaliteta rasterećenja, obim ne doza); D28 početnik (jedna tabela);
  D29 bez trčanja/hodanja; D30 RP ≥ 800 m i trkačka + trka ≥ minimum.
- D30 tačno kao simulacija organizatora: ponavljanja 1224/192/144/144 → 240/48/0/0, vrh niži od 49ad476
  258 → 12, RACE_WEEK_SHORT 96 → 0; regresija prema 21c03f1: isti 13 476, D30a 2268, D30b 78, oba 18, drugo 0.
- Odstupanja (opreznije): rasterećenje sa testom — dugi skraćen (234 / 324 plana po osećaju / početnik), cilj
  naviše ispod poslednje izgradnje (početnik 144); početnik bez kvaliteta kad prvi nivo ne staje u plafon (756).
- Mreže: 15 840 + 11 880 + 3402 — 0 odbijanja, 0 grešaka, determinističke, = bazne linije.
- Testovi tenK/v2: 15 fajlova, 162 testa; radni skup: 17 / 187. Nad 21c03f1 pada 58 / 162; sabotaže D26 5,
  D27 17, D28 uvod 10 / rast 6, D30a 15.
- Provere pre commita: tsc domain/oracle, eslint, prettier (v2 + docs) exit 0 (oracle/eslint posle ispravke
  `paces.node.test.ts`); `npm run check` exit 0 — 210 test fajlova, 2558 testova.
