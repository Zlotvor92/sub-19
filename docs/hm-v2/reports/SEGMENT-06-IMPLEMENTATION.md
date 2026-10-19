# HM v2 — Segment HM-06: adaptacija polumaratona v2 u aplikaciji (činjenice → pregled → potvrda → revizija)

Polazni SHA `a3913f8` (HM-05). Jezgro `hm-v2.3.0` nije menjano (ni jedan fajl van `halfMarathon/v2/app/` i testova
mreže `recent`). Prekidač `ui.generatorV2HalfMarathon` / `VITE_HM_V2` ostaje podrazumevano isključen. Obrazac je 10K v2
segment 06 (kopija, ne uvoz — uslov 7); nijedan 10K/5K fajl nije menjan.

## Tok

1. **Činjenice** (`halfMarathon/v2/app/facts.ts`, JEDINO mesto prevoda): dnevnik po ID-ju dana (ručno i uvoz; `runDate` →
   `ts` → datum dana posle pomeranja; `done`/`skip`; RPE 1–10), trčanja pre plana (`vanPlana`) i neuparena uvezena
   (`vanPlanaV2`, bez duplog brojanja po `stravaId`/`icuId`), bol (najveći tog dana; ≥ 4 bez treninga = zaseban zapis),
   **rezultati** (A1/H18: 5000/10000/21097,5/42195 m): test 5 km plana (`test5kSec` na unosu dana testa) i trka iz Analize
   trke (napor „trka", 5/10 km, polumaraton, maraton); pokrivenost SAMO iz `fullSync` danas ili potvrde korisnika
   (neobrađena aktivnost pomera početak); pauze samo prijavljene; zaključani dani = ručne izmene/pomeranja posle poslednje
   adaptacije (`meta.hmV2Edits`). Sve ostalo → `notes` sa razlogom. **Test 3 km** (`t3k`) → napomena (v. Odstupanje 1).
2. **Pregled** (`adapt.ts` `adaptPreview`): `adaptHmV2(plan, činjenice, danas)` → plan za upis + razlozi v2 doslovno +
   promenjene nedelje (cilj/plan km, kvalitet) + pokrivenost + `needed`. Ništa se ne upisuje.
3. **Potvrda** (`HmV2Adjustment`, Plan → Prilagodi plan, umesto „stiže uskoro") → `commitPlanChange` → nova revizija.
4. **Traka** „Plan treba prilagoditi" (Plan i Danas, `useHmV2Needed`) — `adaptBanner` (pouka 20): primenjen uslov i plan
   se menja posle danas; ograničenje (bol, pauza, umor) samo kad domen prijavi NOVO ograničenje (`newLimits` iz
   `adaptHmV2`), bol još i samo uz zapis bola posle poslednje adaptacije (v. Odstupanje 2); nov rezultat / manjak / višak
   kao 10K; premeštanje testa nije razlog. Isti dan posle primene — ništa.
5. **Vraćanje verzije** (`restoreMerge` = `graftFuturePlan`): budući nezaštićeni dani iz verzije; prošle nedelje, dani do
   danas, urađeni (i budući urađeni) i ručno izmenjeni/pomereni ostaju; drugi broj nedelja → odbijanje sa razlogom.
6. **Promena cilja** (`goalChange` = `planWithNewGoal`, Ti → Cilj `changeGoalTimeHmV2`): isti ulaz sa novim ciljem, svi
   budući dani zaključani → treninzi bajt-isti (i na već prilagođenom planu), menja se samo ocena; po osećaju bez ocene.
7. **Forma** (`form.ts`, Napredak → Forma `FormHmV2`): VDOT samo iz rezultata (čarobnjak, primenjeni, oni koji čekaju —
   isti prevod `buildFacts`), VDOT tekuće nedelje i prognoza polumaratona; `next` = rezultat koji važi od sledeće nedelje.
8. **Unos testa 5 km** (Detalji treninga dana testa, `HmV2TestResult`): mm:ss 10:00–1:30:00 na odrađen unos; prazno briše.
9. **Struktura po nedelji** (`plan.ts` `weekPaces`, pouka 16, nalaz HM-05): E opseg, tempo zona i „po osećaju" iz
   `steps.pacesAt`/`basisAt` nedelje kad plan ima korake; bez koraka ceo plan (bajt-isto: `byteSame`, `importV2`).
10. Sat za plan po osećaju: nepromenjen (preskače sa razlogom, kao 10K).

## Članovi ugovora (b) — `members.ts` `MEMBERS` (26, svaki `v2` ili `not-used` sa razlogom; nijedan ne poziva HM v1)

| član                                                                                           | ponašanje                                                                                            |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `buildExecutionAdjustment`                                                                     | v2: pregled adaptacije (`breakDays` → prijavljena pauza do danas)                                    |
| `planWithNewGoal`, `graftFuturePlan`                                                           | v2: `goalChange` (`changedWeeks: 0`), `restoreMerge`                                                 |
| `planVdotNow`, `executionModel`, `injuryProposal`                                              | v2: `trainingVdot`/`vdot0` (po osećaju `null`); opis 28 dana bez odluke; bol kroz činjenice (`null`) |
| `executionBasis`                                                                               | ne koristi se: odluka o ograničenoj pripremi je HM v1; v2 smanjenje/povratak odlučuje adaptacija     |
| `fitnessEvidence`, `hasRecentMeasuredForm`                                                     | ne koristi se: ugovor nosi samo test 3 km, a on nije rezultat HM v2 (A1)                             |
| `buildRunWalkAdjustment`, `assessRunWalkProgress`                                              | ne koristi se: HM v2 nema trčanje/hodanje (H17)                                                      |
| ostalih 14 (merenje forme, lanac, rekalibracija, predlog tempa/bola, `realignPlan`, pragovi ∞) | ne koristi se, razlog po članu                                                                       |

Granica formata (`select.ts`): `buildExecutionAdjustment`, `planWithNewGoal`, `graftFuturePlan`, `hmV2AdaptPreview`,
`hmV2GoalChange` kastom (adapter ne uvozi tipove formata). `adaptationUnsupportedFor` uklonjen (nema nepodržanog plana).
`KNOWN_VERSIONS = ['hm-v2.3.0']` (∪ tekuća): od HM-05 aplikacija je pisala samo `hm-v2.3.0`; druge → `UNKNOWN_POLICY`.

## Fajlovi van `halfMarathon/v2` (svaki sa razlogom)

- `domain/generators/select.ts` — HM v2 (b) kroz adapter; `hmV2AdaptPreview`, `hmV2GoalChange`, `hmV2FormHistory`, `HM_V2_TEST_FIELD`.
- `stores/hmV2Actions.ts` (nov, kopija `tenKV2Actions`) — izvori iz store-ova, traka, upis vremena testa; `executionActions.ts` `previewHmV2`.
- `features/plan/HmV2Adjustment.tsx` (nov), `AdjustPlan.tsx`, `index.tsx` (traka), `planActions.ts` (`changeGoalTimeHmV2`);
  `features/today/Advisories.tsx` (traka); `features/ti/screens.tsx` (Cilj, tekst prekidača); `features/race/FormHmV2.tsx`
  (nov) + `FormScreen.tsx`; `features/day/HmV2TestResult.tsx` (nov) + `DayScreen.tsx`.
- Testovi: `halfMarathon/v2/app/adaptFlow.node.test.ts` (nov, 17), `app.node.test.ts` (ugovor (b) posle 06, KNOWN_VERSIONS),
  `features/plan/hmV2Adapt.test.tsx` (nov, 6), `hmV2Flow.test.tsx` (umesto „stiže uskoro" tok v2), `e2e/hm-v2.spec.ts`.
- Mreža pouke 28 (DODATNO 7): `recent.node.test.ts` → `recent.harness.node.test.ts` + deo 1/4 u glavnom fajlu + delovi
  `recent.{2,3,4}.full.node.test.ts`; provere iste (ukupno 6 izuzetaka sada statički nad celom mrežom).

## Odstupanja (za organizatora)

1. **Test 3 km nije činjenica rezultata.** Zadatak navodi „test 3 km" među rezultatima, ali jezgro HM v2 (A1, H18:
   „rezultati 5000/10000/21097,5/42195") 3000 m odbija (`ADAPT_RESULT_INVALID`, ceo pregled bi pao). Prevod u 5 km bio bi
   odluka van jezgra. Zato: svež t3k (≤ 84 dana) → napomena „plan polumaratona v2 koristi rezultat na 5 ili 10 km,
   polumaratonu ili maratonu — ne menja tempo"; Forma ga ne prikazuje. Ako treba da menja tempo — izmena jezgra (patch).
2. **Traka i bol:** `newLimits` jezgra za isti stari zapis bola sutradan vraća `pain:<asOf+7>` (period A4 vezan za asOf),
   pa bi traka stajala 3 dana posle primene. Dodat uslov „zapis bola posle poslednje adaptacije" (isto pravilo kao 10K 06
   i maraton `adaptBanner`). Izmereno: bol 11-14, primena 11-15, pregled 11-16 → `newLimits = ['pain:2026-11-23']`.

## Bajt-isti

`byteSame.node` (150 heševa, 28da6af: 5K/10K v1, HM v1, maraton, 5K v2, lični plan) prolazi bez izmene; 10K v2 `byteSame`,
`personalPlan.node.test.ts` (nije menjan) prolaze; plan HM v2 bez koraka adaptacije bajt-isti kao pre (pregled bez
činjenica: `result.weeks` = plan, test). 10K/5K v2 komponente i store-ovi nisu dirani.

## E2E (Chromium)

`e2e/hm-v2.spec.ts` tok 1 dopunjen: … → sat → Prilagodi plan: „bez novih činjenica" → prijavljena pauza 05.–14. 1. →
razlozi + tabela, server nepromenjen → primena → revizija na serveru (`asOf` 2026-01-14, `hm-v2`) → „Pregledaj vraćanje"
(server nepromenjen) → primena → „Vraćanje plana: …" na serveru. `hm-v2 + tenk-v2 + fivek-v2`: **9/9 (1,4 min)**.

## Sabotaže (`web/scripts/sabotage.mjs`, `--bail=1`, brz nivo) — 7/7 palo, 43,5 s, `src` vraćen (heš isti)

Ulaz `artifacts/segment-06/sabotage-06.json`, rezultat `sabotage-06.result.json`: (a) činjenice na dva mesta — Forma
sama čita Analizu trke (6,1 s, adaptFlow „jedno mesto prevoda"); (b) traka za stari bol (8,3 s); (c) promena cilja gradi
plan iznova bez koraka/zaključanih (6,0 s); (d) vraćanje prepisuje urađene dane (5,7 s; test pojačan: urađen dan posle
danas); (e) član (b) poziva HM v1 `executionBasis` (6,0 s, app.node); (f) struktura iz celog plana umesto nedelje
(5,5 s); (g) zastarela sinhronizacija kao potpuna (5,4 s).

## Komande i rezultati (iz `web/`)

- `npx tsc -b --noEmit` 0; `eslint` (promenjeni folderi) 0; `prettier --check` 0.
- `npx vitest run --project node src/domain/generators/halfMarathon/v2/app` 3 fajla / 49 (adaptFlow 17, app 27, byteSame 2,
  importV2 3), 7,4 s; UI `hmV2Adapt` 6, `hmV2Flow` + `hmV2Watch` 10.
- `recent` brz: 4 testa, 12,6 s; pun (`TEST_FULL=1`, pojedinačno, opterećenje ≈ 1,5): deo 1 22,2 s, 2 21,3 s, 3 21,5 s,
  4 20,9 s (bilo jedan beforeAll ≈ 82 s).
- `npm run check`: exit 0 — 273 fajla / 3317 testova (357,6 s testova).
- `npm run check:full`: exit 0 — 364 fajla / 3615 testova (2848 s testova), uklj. delove `recent` 1–4.
- Playwright 9/9 (gore).

## Stalni uslovi (AGENTS.md)

1. Jedan vlasnik: sve odluke o planu donosi `adaptHmV2` (assess); adapter samo prevodi (`facts.ts`) i prikazuje; traka
   čita `newLimits` domena; nema petlji. 2–3. Plafoni, WU/CD nedirnuti (jezgro nije menjano). 4. Uslovi poznati unapred
   (rezultat, bol, pauza, izvršenje, zaključani) ulaze u konstruktor kroz činjenice; zaštita samo urađeno, prošlost,
   zaključano (testovi: ručno izmenjen, urađen i budući urađen dan bajt-isti posle adaptacije i vraćanja). 5. Handoff
   nedirnut (test: maraton → HM v1, HM → 10K v1). 6. Plan nosi `hm-v2`/`hm-v2.3.0` i fazu iz v2 posle svake adaptacije
   (`stampPlan`, test). 7. `halfMarathon/v2/app/` uvozi samo iz `halfMarathon/v2/` (isolation bez novih izuzetaka +
   test da `members/adapt/facts/form` uvoze samo `./x.ts`/`../x.ts`). 8. Upotrebljivost: posle rezultata, manjka, bola i
   pauze plan za upis — svaki trening ima blokove i km > 0, dugi ≥ lagan, nedelje posle danas ≥ minimum (H15).

## Preostalo

- Odstupanje 1 (test 3 km) i 2 (traka/bol vs. `newLimits`) — odluka organizatora.
- Prekidač 10K v2 i dalje kaže „Prilagođavanje 10K v2 plana stiže uskoro" (tekst iz 10K 05; 10K nije diran).
- Predaja HM v2 ↔ 10K/maraton (faza 3). Plan HM v2 6 d/20 ned ≈ 159 KB po reviziji.
