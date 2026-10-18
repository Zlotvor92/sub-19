# 10K v2 — STATUS

Novi 10K generator sa jednim vlasnikom svake odluke (D1–D22, D22b, D23, D25–D32) i adaptacijom (A1–A15),
izolovan u `web/src/domain/generators/tenK/v2/`. 10K v1 (`tenK/` van `v2/`) je nepromenjen i podrazumevan; od
segmenta 05 v2 je u aplikaciji iza prekidača (`ui.generatorV2TenK` / `VITE_TENK_V2`), samo kroz adapter `v2/app/`;
od segmenta 06 i prilagođavanje (činjenice → pregled → potvrda → revizija), vraćanje verzije, cilj i Forma.

## Kako se koristi

```ts
import { adaptTenKV2, generateTenKV2 } from "./tenK/v2/index.ts";
const r = generateTenKV2({
  startDate: "2026-11-02", // prvi dan nedelje 1
  raceDate: "2027-02-07", // poslednji dan poslednje nedelje (8–18 celih nedelja; početnik 10–18)
  runDays: ["tue", "thu", "sat", "sun"], // 3–6 dana (D17); početnik 3–4 (D28)
  currentWeeklyKm: 40, // 3: 20–40, 4: 25–55, 5: 30–65, 6: 35–80; početnik 3: 15–30, 4: 18–35
  recentResult: { distanceM: 10000, timeSec: 2700, date: "2026-10-19" }, // ili easyPaceSecPerKm (D26)
  experience: "regular", // ili "beginner" (D28); runWalk: true → RUN_WALK_NOT_SUPPORTED (D29)
});
// r.ok → r.plan (policyId '10k-v2', policyVersion '10k-v2.4.0', paceBasis, faza nedelje, upozorenja)
const a = adaptTenKV2(r.plan, facts, "2026-12-09"); // asOf je ulaz (bez čitanja sata)
// facts: { workouts: [{ date, dayId?, km, durationSec, completed, rpe?, pain? }], results: [{ distM, sec,
// date, kind: "test" | "race" }], lockedDayIds, coverage: { from, to, complete }, breaks: [{ kind: "break", from, to }] }
// a.ok → a.plan (plan.adaptation: asOf, steps, mixedWeeks, lockedDayIds), a.changes, a.reasons
// !a.ok → a.reasons (ADAPT_PLAN_INVALID, ADAPT_AS_OF_INVALID, ADAPT_FACT_*, ADAPT_PROTECTION, …), a.violations
```

- `construct(input, steps)` je isti konstruktor za generate (`[]`) i adaptaciju (koraci iz `assess.ts`).
- `validatePlan(plan)` samo prijavljuje; adaptiran plan proverava po nedelji (tempo, okvir, obim iz koraka).
- Primeri: iz korena repoa `node docs/10k-v2/artifacts/segment-04/run.ts` (traži `web/node_modules`) →
  `inputs.json`, `<id>.json`, `examples.md`; dva pokretanja daju bajt-isti izlaz. `segment-01/` …
  `segment-03b/` su zamrznuti izlazi 10k-v2.0.0 … 2.3.1.
- Testovi: iz `web/` `npx vitest run --project node src/domain/generators/tenK/v2` (≈ 125 s).
- Bazne linije: `segment03.baseline.json` (R 15 840), `segment03-feel.baseline.json` (F 11 880),
  `segment03b-beginner.baseline.json` (B 3402); osvežavanje `TEN_K_V2_WRITE_BASELINE=1 npx vitest run
--project node src/domain/generators/tenK/v2/<grid|feelGrid|beginnerGrid>.node.test.ts`, pa prettier.
- Regresija prema b13ca17: `segment04.plan-hashes-b13ca17.json` (R, F, B bajt-isti; heš bez oznake verzije; piše ga
  `artifacts/segment-04/regression-b13ca17.ts` iz checkouta b13ca17). Starije: 81bd351, 21c03f1, 49ad476 (`tenK/v2/`).

## Trenutno stanje

- Generator: 3–6 dana, 8–18 nedelja, rezultat ≤ 84 dana (VDOT 30–80) ili po osećaju (test 5 km na kraju
  baze), početnik 3–4 dana / 10–18 ned (bez testa). Trajno odbijeno: 1, 2, 7 dana, obim van reda, < 8 /
  > 18 ned, VDOT > 80, trčanje/hodanje.
- Adaptacija (04): rezultat, manjak/višak, pauza 7–13 / 14–27 / ≥ 28 (nov start), bol, umor; povratni rast
  do nivoa pre smanjenja; zaštita prošlosti/urađenog/zaključanog; lančani koraci; plan starije verzije.
- Poznata ograničenja: T 1,5 km ponovljen kod početnika 3 d 15 km; ponavljanje RP 2,5 / 3,5 i I 2,0 km; D25;
  posle smanjenja WU/CD po pojasu ulaza (dugi < kvalitetni dan); mešovite nedelje se proveravaju po danu.
- Izveštaji: `reports/SEGMENT-01-…` … `SEGMENT-06-IMPLEMENTATION.md` (dalje: „Nalaz trenera" iz 06).

## Segmenti 01–03b (10k-v2.0.0 … 2.3.1)

- 01/01b: jezgro 4 dana, D1–D16; 02/02b: D17–D25 (3/5/6 dana, kratka priprema, trkačka ≤ taper).
- 03 (`21c03f1` → `81bd351`): D26–D30 (po osećaju, test 5 km, početnik, bez trčanja/hodanja, RP ≥ 800 m).
- 03b (`81bd351` → `b13ca17`): D31 (T 1,5 km početnika), D32 (početnik bez testa). `git log --grep "10K v2"`.

## Segment 04 (10k-v2.4.0)

- Polazni SHA `b13ca17`; commit „10K v2 Segment 04 (10k-v2.4.0): adaptacija — assess → construct → zaštita
  → validate" (`git log --grep "10K v2 Segment 04"`).
- Tok: `assess.ts` (A1–A10 → korak) → `construct(input, koraci)` (`steps.framesFor`, `volume.adaptNominal10`,
  `pacesAt`, režim kvaliteta) → spajanje i zaštita (`adapt.ts`, samo provera) → `validatePlan` (adaptiran režim).
- Odstupanja (DECISIONS sa ulazom): povratak do nivoa i iznad granice novog starta; 4 ned izgradnje posle pauze ≥ 28 →
  faze ostaju; cilj adaptacije pre nižeg; dugi rasterećenja ≥ 3 km; test otpada kad dugi < 5 km; doza pada sa ciljem.
- Regresija: R 15 840, F 11 880, B 3402 bajt-isti kao b13ca17. Mreža adaptacije 2040 (30 planova × 4 asOf ×
  17 scenarija): 0 odbijanja, 0 grešaka, zaštita bajt-isto, invarijante 0, deterministička.
- Testovi tenK/v2: 16 fajlova, 205 testova; radni skup 18 / 230. Na b13ca17 `adapt.node` pada ceo (31), +3;
  sabotaže A3 11, A8 5, A9 4, A10 2, A11 3 od 31.
- Provere pre commita: tsc domain/oracle, eslint, prettier exit 0; `npm run check` exit 0 (211 fajlova, 2601 testova).

## Segment 05 (aplikacija iza prekidača; jezgro `10k-v2.4.0` nepromenjeno)

- Polazni `068410b`; commit „10K v2 Segment 05: 10K v2 u aplikaciji iza prekidača — generisanje, čuvanje, prikaz,
  čarobnjak, sat" (`git log --grep "10K v2 Segment 05"`); izveštaj `reports/SEGMENT-05-IMPLEMENTATION.md`.
- Prekidač `flags.tenKV2Enabled` (podrazumevano isključen; vidljiv admin/`VITE_TENK_V2`); `select.ts`: `10k-v2` → v2
  (`10k-v2.4.0`, ostalo `UNKNOWN_POLICY`). Adapter `tenK/v2/app/` bez uvoza van `tenK/v2/` (lokalni tipovi).
- (b) adaptacija: nepodržano do 06 sa razlogom (nijedan član ne poziva v1). Uvoz u plan v2: zapisi van plana, `fullSync`
  (08c). Sat: delovi po osećaju (procena tempa) se ne šalju, `skippedReasons`. Format: `GenPlanState.tenKV2`.
- Bajt-isto: `tenK/v2/app/byteSame.node.test.ts` (140 heševa sa 068410b) + `importV1Snapshot`. `npm run check` 216 / 2642;
  E2E `tenk-v2` 3/3, ceo 81 + 2 pada `pwa` (isti na 068410b).
- Sledeće (06): činjenice → `adaptTenKV2` sa pregledom, revizije, cilj, Forma, predaja HM/maraton → 10K v2.

## Segment 06 (adaptacija u aplikaciji; jezgro `10k-v2.4.0` nepromenjeno)

- Polazni `2d8a594`; commit „10K v2 Segment 06: adaptacija 10K v2 u aplikaciji — činjenice, pregled, revizija, cilj,
  Forma" (`git log --grep "10K v2 Segment 06"`); izveštaj `reports/SEGMENT-06-IMPLEMENTATION.md`.
- Adapter: `facts.ts` (dnevnik/uvoz, van plana, bol, test 5 km `test5kSec`, test 3 km, trke, pokrivenost samo `fullSync`
  ili potvrda, pauze, zaključani dani `meta.tenKV2Edits`), `adapt.ts` (pregled, traka, `restoreMerge`, `goalChange`),
  `form.ts`, `members.ts` (b kroz isti tok; nijedan član ne poziva v1). `plan.ts`: tempo/osnova strukture po nedelji.
- UI: Plan → Prilagodi plan (`TenKV2Adjustment`), traka u Planu i Danas, Ti → Cilj, Napredak → Forma (`FormTenKV2`),
  Detalji treninga dana testa (vreme 5 km). Predaja HM/maraton → 10K ostaje 10K v1 (test).
- Nalaz za sledeći korak (jezgro): A4/A8 — nedelja sa krajem perioda bola zadržava pun cilj (i kod 5K v2); v. izveštaj.

