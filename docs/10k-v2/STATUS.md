# 10K v2 — STATUS

Novi 10K generator sa jednim vlasnikom svake odluke (D1–D22, D22b, D23, D25–D32), izolovan u
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
  goalTimeSec: 2610, // opciono: samo ocena (D3); u planu po osećaju posle testa / rezultata trke
});
// r.ok → r.plan (policyId '10k-v2', policyVersion '10k-v2.3.1', paceBasis 'result' | 'feel', faza svake
// nedelje, test 5 km u planu po osećaju koji nije početnik (D32), RPE na kvalitetu po osećaju, upozorenja)
// !r.ok → r.reasons: [{ code, message }] (npr. EASY_PACE_REQUIRED, BEGINNER_DAYS, RUN_WALK_NOT_SUPPORTED)
```

- `construct(input, steps)` je isti konstruktor sa koracima adaptacije (segment 04); sada samo `[]`.
- `validatePlan(plan)` samo prijavljuje (greške / upozorenja), plan ne menja.
- Primeri: iz korena repoa `node docs/10k-v2/artifacts/segment-03b/run.ts` (traži `web/node_modules`) →
  `inputs.json`, `<id>.json`, `plans.md` (sa tabelom poređenja 03 → 03b); dva pokretanja daju bajt-isti
  izlaz. `segment-01/` … `segment-03/` su zamrznuti izlazi 10k-v2.0.0 … 2.3.0.
- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/tenK/v2` (tri mreže ≈ 120 s).
- Bazne linije: `segment03.baseline.json` (15 840 sa rezultatom) i `segment03-feel.baseline.json` (11 880
  po osećaju) iz 10k-v2.3.0 važe bez izmene; `segment03b-beginner.baseline.json` (3402 početnik,
  10k-v2.3.1); namerno osvežavanje: `TEN_K_V2_WRITE_BASELINE=1 npx vitest run --project node
src/domain/generators/tenK/v2/beginnerGrid.node.test.ts` (isto `grid` / `feelGrid`), pa prettier.
- Regresija prema 81bd351: `segment03b.plan-hashes-81bd351.json` — ceo plan R i F mreže bajt-isti (heš bez
  oznake verzije); piše ga `docs/10k-v2/artifacts/segment-03b/regression-81bd351.ts` iz checkouta 81bd351.
  Starije: prema 21c03f1 (`segment03.plan-hashes-21c03f1.json`, `segment02b.baseline.json`, izuzeci u
  `segment03.regression-exceptions.json`) i vrh prema 49ad476 (`segment02.baseline.json`).

## Trenutno stanje

- Podržano: 3–6 dana, 8–18 nedelja, rezultat ≤ 84 dana sa VDOT 30–80 ili plan po osećaju (lagan tempo,
  procena VDOT 25–60, test 5 km na kraju baze), početnik 3–4 dana / 10–18 ned (jedan kvalitet, T
  kontinuirano od 1,5 km, bez testa). Trajno odbijeno: 1, 2, 7 dana, obim van reda, < 8 / > 18 ned, VDOT >
  80, trčanje/hodanje; početnik 5–6 dana, 8–9 ned, obim van D28.
- Poznata ograničenja: početnik 3 d 15 km — T 1,5 km ponovljen kroz izgradnju, rasterećenje ned 4 i taper
  bez kvaliteta; taper početnika sa T bez oštrenja; ponavljanje slota RP 2,5 / 3,5 km i I 2,0 km; D25 kod
  brzog trkača malog obima; 4 dana po osećaju sa sporim laganim tempom ograničena udelom dugog 33 %.
- Izveštaji: `docs/10k-v2/reports/SEGMENT-01-…` … `SEGMENT-03b-IMPLEMENTATION.md` (sledeći prozori čitaju
  „Odluke" i „Preostali problemi" iz 03b).

## Segmenti 01–03 (10k-v2.0.0 … 2.3.0)

- 01 (`b3e4d75` →): jezgro 4 dana, D1–D15; 01b: D14 pojas WU/CD, D16, D8 oštrenje, D10 T ≥ 1000 m.
- 02 (`53da370` →): D17–D22 (3/5/6 dana, kratka priprema); 02b (`49ad476` →): D17 udeo 3 dana 0,45, D22b,
  D23 trkačka ≤ taper, D25 upozorenje.
- 03 (`21c03f1` → `81bd351`): D26 plan po osećaju, D27 test 5 km, D28 početnik, D29 bez trčanja/hodanja,
  D30 RP ≥ 800 m i trkačka + trka ≥ minimum. Commitovi: `git log --grep "10K v2"`.

## Segment 03b (10k-v2.3.1)

- Polazni SHA: `81bd351`; commit: „10K v2 Segment 03b (10k-v2.3.1): početnik — T 1,5 km pri malom obimu, bez
  testa" (`git log --grep "10K v2 Segment 03b"`).
- D31 (izmena D28): lestvica T kontinuirano početnika [1,5; 2,0; …]; kad prvi nivo lestvice faze ne staje u
  plafon D11 — T kontinuirano (najviši nivo početnika koji staje, po D12); rasterećenje i taper (kad RP ne
  staje) T ≈ 60 % poslednje T doze, min 1,5 km. D32 (izmena D27): početnik bez testa.
- Mreža početnika 3402 (81bd351 → 03b): nedelje izgradnje bez kvaliteta 3720 → 0, planovi bez kvaliteta od
  ned 3 do trke 378 → 0, testovi 1944 → 0, dugi rasterećenja < 4 km 162 → 0 (najkraći 4,9 km),
  rasterećenje bez kvaliteta 2316 → 654 ned, taper bez kvaliteta 1152 → 378; vrh/start 1,229 → 1,227 i
  1,281 → 1,280; ponavljanja 192 / 240 → 2580 / 168 (T 1,5 km 2436).
- Odstupanje (opreznije): T 1,5 km nema drugu strukturu — ponavljanje uz napomenu i u bazi (izuzetak
  „baza bez platoa" samo za tu dozu).
- Regresija: R 15 840 i F 11 880 bajt-isti kao 81bd351; mreže 0 odbijanja, 0 grešaka, determinističke.
- Testovi tenK/v2: 15 fajlova, 171 test; radni skup 17 / 196. Nad 81bd351 pada 19 / 171; sabotaže D31 (bez
  nivoa 1,5) 16, D32 (test vraćen) 13.
- Provere pre commita: tsc domain/oracle, eslint, prettier (v2 + docs) exit 0; `npm run check` exit 0 —
  210 test fajlova, 2567 testova.
