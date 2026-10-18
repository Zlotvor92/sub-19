# 10K v2 — Segment 06: adaptacija 10K v2 u aplikaciji (činjenice → pregled → potvrda → revizija)

Polazni SHA `2d8a594` (segment 05). Jezgro `10k-v2.4.0` nije menjano (ni jedan fajl van `tenK/v2/app/`). Prekidač
`ui.generatorV2TenK` / `VITE_TENK_V2` ostaje podrazumevano isključen; 10K v1 i njegovi korisnici bajt-isti.

## Tok (isti obrazac kao 5K v2 08b/08c, kopija — ne uvoz)

1. **Činjenice** (`tenK/v2/app/facts.ts`, jedino mesto prevoda): dnevnik po ID-ju dana (ručno i uvoz; `runDate` → `ts` →
   datum dana posle pomeranja; `done`/`skip`, unos bez statusa nije činjenica; RPE 1–10), trčanja pre plana (`vanPlana`) i
   neuparena uvezena (`vanPlanaV2`, bez duplog brojanja po `stravaId`/`icuId`), bol (najveći tog dana na trening; ≥ 4 bez
   treninga kao zaseban zapis), **rezultati**: test 5 km plana (`test5kSec` na unosu dana testa), test 3 km (`t3k`), trka
   iz Analize trke (napor „trka", 3/5/10 km ili polumaraton); pokrivenost SAMO iz potpune sinhronizacije danas (`fullSync`)
   ili potvrde korisnika (neobrađena aktivnost pomera početak ili je poništava); pauze samo prijavljene; zaključani dani =
   ručne izmene/pomeranja posle poslednje adaptacije (`meta.tenKV2Edits`). Sve što ne uđe ide u `notes` sa razlogom.
2. **Pregled** (`adapt.ts` → `adaptPreview`): `adaptTenKV2(plan, činjenice, danas)` → plan za upis + razlozi v2 doslovno +
   promenjene nedelje (cilj/plan km, kvalitet i test) + pokrivenost + `needed` (traka). Ništa se ne upisuje.
3. **Potvrda** (`TenKV2Adjustment` u Plan → Prilagodi plan) → `commitPlanChange` → nova revizija (`recordPlanRevision`).
4. **Traka** „Plan treba prilagoditi" (Plan i Danas, `useTenKV2Needed`): primenjeno ograničenje (bol nov posle poslednje
   adaptacije, pauza, umor, nov rezultat, manjak/višak) koje menja budući deo plana; isti dan posle primene — ništa.
   Premeštanje testa samo po sebi nije razlog trake (posledica je drugog uslova).
5. **Vraćanje verzije** (`restoreMerge` = `graftFuturePlan`): budući nezaštićeni dani iz verzije; prošle nedelje, dani do
   danas, urađeni i ručno izmenjeni/pomereni iz trenutnog plana; drugi broj nedelja → odbijanje sa razlogom.
6. **Promena cilja** (`goalChange` = `planWithNewGoal`, Ti → Cilj): isti ulaz sa novim ciljem, svi budući dani zaključani →
   treninzi bajt-isti, menja se samo ocena (plan po osećaju: bez ocene do rezultata).
7. **Forma** (`form.ts`, Napredak → Forma `FormTenKV2`): VDOT samo iz rezultata (čarobnjak, primenjeni, oni koji čekaju),
   tekući VDOT nedelje i prognoza 10K; `next` = primenjen rezultat koji važi od sledeće nedelje (A1).
8. **Unos testa 5 km** (Detalji treninga dana testa, `TenKV2TestResult`): vreme same deonice (mm:ss, 10:00–1:30:00) na
   odrađen unos; prazno briše. Bez odrađenog treninga se ne upisuje.

## Članovi ugovora (b) — `tenK/v2/app/members.ts` (nijedan ne poziva 10K v1)

| član | ponašanje |
| --- | --- |
| `buildExecutionAdjustment` | pregled adaptacije v2 (`breakDays` → prijavljena pauza do danas) |
| `planWithNewGoal` | `goalChange` + `goalChange` meta (`changedWeeks: 0`) |
| `graftFuturePlan` | `restoreMerge` |
| `fitnessEvidence`, `hasRecentMeasuredForm` | svež test 3 km ≤ 84 dana (jedini rezultat koji ugovor nosi) |
| `planVdotNow` | `meta.trainingVdot` / `vdot0`; po osećaju `null` |
| `executionModel` | opis 28 dana bez odluke (`ADAPTATION_V2`) |
| `executionBasis` | „odluka o pripremi samo HM/maraton" |
| `buildRunWalkAdjustment`, `assessRunWalkProgress` | 10K v2 nema trčanje/hodanje (D29) |
| `planRecalibrated`, `classifyMeasurement`, `vdotProposal`, `recomputeVdotChain`, `currentVdot`, `matchPlanRows`, kapija rekalibracije | ne koristi se: tempo menja samo rezultat |
| `injuryProposal`, `applyInjuryProposal`, `alignAutomaticOverlays`, `realignPlan`, `apply/undoVdot…` | bez predloga / nepromenjen ulaz |

Granica formata (`select.ts`): `buildExecutionAdjustment`, `planWithNewGoal`, `graftFuturePlan`, `tenKV2AdaptPreview`,
`tenKV2GoalChange` dobijaju tip `GenPlanState` kastom sa komentarom (adapter ne uvozi tipove formata, test izolacije).
`adaptationUnsupportedFor` je uklonjen (nema više nepodržanog plana).

## Ispravka adaptera iz 05 (Preostali problem 3)

`plan.ts`: struktura dana uzima tempo i osnovu **nedelje** (`steps.pacesAt` / `basisAt`) kad plan ima korake adaptacije:
plan po osećaju koji primi rezultat ostaje po osećaju (RPE, procena) do nedelje rezultata, a E opseg postoji u svim
nedeljama. Bez koraka: ceo plan kao do sada (bajt-isto, `byteSame` + `importV2`).

## Fajlovi van `tenK/v2` (svaki sa razlogom)

- `domain/generators/select.ts` — 10K v2 (b) kroz adapter, izvozi pregleda/cilja/forme/polja testa, uklonjen `adaptationUnsupportedFor`.
- `stores/tenKV2Actions.ts` (nov) — izvori činjenica iz store-ova, traka, upis vremena testa (`syncSources` iz 5K v2 store-a).
- `stores/executionActions.ts` — `previewTenKV2`, `tenKV2` detalji u pregledu.
- `features/plan/TenKV2Adjustment.tsx` (nov, kopija toka 5K v2), `AdjustPlan.tsx`, `index.tsx` (traka), `planActions.ts` (`changeGoalTimeTenKV2`).
- `features/today/Advisories.tsx` (traka), `features/ti/screens.tsx` (Cilj), `features/race/FormScreen.tsx` + `FormTenKV2.tsx` (nov).
- `features/day/DayScreen.tsx` + `TenKV2TestResult.tsx` (nov) — unos vremena testa 5 km.
- Testovi: `tenK/v2/app/adaptFlow.node.test.ts` (nov, 13), `features/plan/tenKV2Adapt.test.tsx` (nov, 6), izmenjeni
  `app.node.test.ts` (ugovor (b) posle 06), `tenKV2Flow.test.tsx`, `e2e/tenk-v2.spec.ts`.

## Stalni uslovi (AGENTS.md)

1. Jedan vlasnik: sve odluke o planu donosi `adaptTenKV2` (assess); adapter samo prevodi činjenice i prikazuje; nema petlji.
2. Plafoni nedirnuti (jezgro). 3. WU/CD nedirnuti. 4. Uslovi poznati unapred (rezultat, bol, pauza, izvršenje) ulaze u
   konstruktor kroz činjenice; završna zaštita samo štiti urađeno, prošlost i zaključano (test: ručno izmenjen i urađen dan
   bajt-isti posle adaptacije i vraćanja). 5. Handoff: HM/maraton → 10K ostaje 10K v1 (test); 10K v2 kao cilj predaje tek
   sa HM v2. 6. Plan nosi `10k-v2`/`10k-v2.4.0` i fazu iz v2 posle svake adaptacije (`stampPlan`). 7. `tenK/v2/app/` uvozi
   samo iz `tenK/v2/` (isolation + test da `members/adapt/facts/form` uvoze samo `./x.ts`/`../x.ts`). 8. Upotrebljivost:
   posle rezultata, manjka, bola i pauze plan za upis — svaki trening ima blokove i km > 0, dugi ≥ lagan, nedelje posle
   danas ≥ minimum (D17).

## Komande i rezultati (iz `web/`)

- `npm run check` (typecheck, eslint, prettier, svi testovi): exit 0 — 218 fajlova, 2661 testova (619 s testovi).
- `npx playwright test e2e/tenk-v2.spec.ts`: 3/3 (tok 1 sada: pregled bez činjenica → prijavljena pauza → pregled →
  primena → revizija na serveru, `asOf` u planu).
- Sabotaže adaptera (pokvareno → `adaptFlow.node` + `tenKV2Adapt`, 19 testova → vraćeno): tempo strukture iz celog plana
  umesto nedelje 1, bez `dayId` 1, traka za stari bol 1, zastarela sinhronizacija kao potpuna 1, vraćanje verzije bez
  zaštite ručno izmenjenog budućeg dana 1 (prvi krug 0 — test je štitio dan u prošlosti; pojačan), test 5 km se ne čita 4.
- Trajanje pregleda (17 nedelja, 6 dana, bol): ≈ 19 ms; plan za upis ≈ 132 KB (adaptacija ga ne uvećava bitno).

## Nalaz trenera za sledeći korak (jezgro, nije menjano u 06)

**A4/A8 (bol) — nedelja u kojoj se period bola završava zadržava pun cilj, a povratak kreće nedelju kasnije.** `returnFrom`
= poslednja nedelja perioda bola; ta nedelja zadržava originalni cilj (ograničeni su samo dani u periodu), pa isti bol daje
različit plan zavisno od dana u nedelji. Primeri (ulaz: 4 dana, 40 km, 10K 45:00, start 2026-10-26):

- bol 5 u subotu, asOf nedelja (period = cela sledeća nedelja): ned 5 = 27,6 km (70 % → povratni rast) — ispravno;
- bol 5 u sredu (period ulazi 3 dana u ned 5): ned 5 = **44,0 km** sa kvalitetom, ned 6 = 36,6 km;
- bol 7 u petak (3 dana odmora, period do ponedeljka ned 5): ned 4 = 27,1 km, ned 5 = **47,6 km sa 2 kvaliteta i laganim
  13,8 km**, ned 6 = 36,6 km.

Isto ponašanje ima 5K v2 jezgro (ista odluka A4/A8; 5K v2 nije na `main`). Predlog: posebna ispravka jezgra (10K `10k-v2.4.1`,
5K zasebno) — nedelja sa krajem perioda bola dobija cilj povratka (≤ udeo × nivo pre bola), povratni rast od prve sledeće
nedelje; regresija bez činjenica bajt-ista, mreža adaptacije sa bolom u svakom danu nedelje.
