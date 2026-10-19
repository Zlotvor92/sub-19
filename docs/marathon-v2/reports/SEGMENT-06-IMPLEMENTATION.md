# Maraton v2 — Segment MAR-06: adaptacija maratona v2 u aplikaciji (činjenice → pregled → potvrda → revizija)

Polazni SHA `8beef45` (MAR-05). Obrazac je HM-06 (kopija, ne uvoz — uslov 7); nijedan 5K/10K/HM fajl nije menjan osim
zajedničkih mesta gde se dodaje maraton. Prekidač `ui.generatorV2Marathon` / `VITE_MARATHON_V2` ostaje podrazumevano
isključen. Plan politike nepromenjen: verzija ostaje `marathon-v2.3.1` (v. Traka — merenje). Bez STANI.

## Tok

1. **Činjenice** (`marathon/v2/app/facts.ts`, JEDINO mesto prevoda): dnevnik po ID-ju dana (ručno i uvoz; `runDate` →
   `ts` → datum dana posle pomeranja; `done`/`skip`; RPE 1–10), `vanPlana` i neuparena uvezena `vanPlanaV2` (bez duplog
   brojanja po `stravaId`/`icuId`), bol (najveći tog dana; ≥ 4 bez treninga = zaseban zapis), **rezultati** (M18/A1:
   5000/10000/21097,5/42195 m — proveren `P.input.resultDistancesM`): test 5 km plana (`test5kSec` na unosu dana testa)
   i trka iz Analize trke (napor „trka", 5/10 km, polumaraton, maraton); ostalo (test 3 km, trka bez punog napora, 8 km
   …) → `notes` sa razlogom. Pokrivenost SAMO iz `fullSync` danas ili potvrde (neobrađena aktivnost pomera početak);
   pauze samo prijavljene; zaključani dani = ručne izmene/pomeranja posle poslednje adaptacije (`meta.marathonV2Edits`).
   Statički test: nijedan drugi fajl adaptera ni `stores/marathonV2Actions.ts` ne čita sirove podatke.
2. **Pregled** (`adapt.ts` `adaptPreview`): `adaptMarathonV2(plan, činjenice, danas)` → plan za upis + razlozi v2
   doslovno + promenjene nedelje (cilj/plan km, kvalitet) + pokrivenost + traka (`needed` = domen `adaptBanner`).
3. **Potvrda** (`MarathonV2Adjustment`, Plan → Prilagodi plan, umesto „stiže uskoro") → `commitPlanChange` → revizija.
4. **Vraćanje verzije** (`restoreMerge` = `graftFuturePlan`): budući nezaštićeni dani iz verzije; prošle nedelje, dani
   do danas, urađeni (i budući urađeni) i ručno izmenjeni/pomereni ostaju; drugi broj nedelja → odbijanje sa razlogom.
5. **Promena cilja** (`goalChange` = `planWithNewGoal`, Ti → Cilj `changeGoalTimeMarathonV2`): isti ulaz sa novim
   ciljem, svi budući dani zaključani → treninzi bajt-isti (i na prilagođenom planu), menja se samo ocena; po osećaju bez
   ocene do rezultata.
6. **Forma** (`form.ts`, Napredak → Forma `FormMarathonV2`): VDOT samo iz rezultata (čarobnjak, primenjeni, oni koji
   čekaju — isti prevod `buildFacts`), VDOT nedelje i prognoza maratona iz MP tempa nedelje (`pacesAt` sa korekcijom
   obima M2, kao plan); `next` = rezultat koji važi od sledeće nedelje.
7. **Unos testa 5 km** (Detalji treninga dana testa, `MarathonV2TestResult`): mm:ss 10:00–1:30:00 na odrađen unos.
8. Struktura po nedelji (pouka 16): `plan.ts` `weekPaces` već od MAR-05 (sabotaža 06-f je obara).

## Traka — jedno pravilo, samo u domenu (odluka organizatora, pitanje 4 iz MAR-05)

- `steps.ts` `newLimits(steps)` = kopija HM `newLimits` (datumi noQuality/oneQuality/rest/pain poslednjeg koraka kojih
  nema u prethodnim; prinudno rasterećenje/nov start koga ranije nije bilo). `adaptMarathonV2` vraća `newLimits` u
  uspešnom rezultatu (`types.ts AdaptResult`).
- `adapt.ts adaptBanner` (domen) po pravilu HM-06: ništa kad asOf ≤ poslednje adaptacije ili se plan ne menja posle
  asOf; promene (NEW_RESULT, UNDER/OVER_EXECUTION) kad su primenjene; ograničenja (PAIN, PAUSE, FATIGUE) samo uz
  neprazan `newLimits`, bol još i uz zapis bola noviji od poslednje adaptacije. Aplikacija (`app/adapt.ts`) samo zove
  `adaptBanner` — nema sopstvenog pravila (sabotaža 06-h). Postojeći test `adapt.node` „pouka 20" prolazi bez izmene
  očekivanja; dodata 2 testa (newLimits = steps.newLimits; stari zapis bola 2 dana kasnije: bol primenjen, newLimits
  neprazan, plan se menja posle asOf — traka ne; nov zapis → traka; ista pauza sutra → ne).
- **Merenje (plan bajt-isti):** `artifacts/segment-04b/measure.ts` (heš `planHash` adaptiranog plana bez oznake verzije;
  `newLimits` je polje rezultata, ne plana) na čistom `8beef45` (worktree) i posle izmene, `cmp` JSON redova:
  mreža 04 6236/6236, trajna rana 45 101/45 101, rana pre starta 4050/4050, široka WIDE_RES — **0 promenjenih**.
  Verzija ostaje `marathon-v2.3.1`; DECISIONS M18 dopunjen (pravilo, mesto, merenje). `KNOWN_VERSIONS` =
  `['marathon-v2.3.1'] ∪ tekuća` (= `['marathon-v2.3.1']`).

## Članovi ugovora (b) — `members.ts` `MEMBERS` (26; svaki `v2` ili `not-used` sa razlogom; nijedan ne poziva maraton v1)

| član                                                                                           | ponašanje                                                                                       |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `buildExecutionAdjustment`                                                                     | v2: pregled adaptacije (`breakDays` → prijavljena pauza do danas)                               |
| `planWithNewGoal`, `graftFuturePlan`                                                           | v2: `goalChange` (`changedWeeks: 0`), `restoreMerge`                                            |
| `planVdotNow`, `executionModel`, `injuryProposal`                                              | v2: `trainingVdot`/`vdot0` (po osećaju `null`); opis 28 dana bez odluke; bol kroz činjenice     |
| `executionBasis`                                                                               | ne koristi se: odluka o ograničenoj pripremi je maraton v1; v2 smanjenje/povratak = adaptacija |
| `fitnessEvidence`, `hasRecentMeasuredForm`                                                     | ne koristi se: ugovor nosi samo test 3 km, a on nije rezultat maratona v2 (A1)                  |
| `buildRunWalkAdjustment`, `assessRunWalkProgress`                                              | ne koristi se: maraton v2 nema trčanje/hodanje (odbija ga pri izradi)                           |
| ostalih 14 (merenje forme, lanac, rekalibracija, predlog tempa/bola, `realignPlan`, pragovi ∞) | ne koristi se, razlog po članu                                                                  |

Granica formata (`select.ts`): `buildExecutionAdjustment`, `planWithNewGoal`, `graftFuturePlan`,
`marathonV2AdaptPreview`, `marathonV2GoalChange` kastom (adapter ne uvozi tipove formata); `adaptationUnsupportedFor`
uklonjen (nijedan plan više nije „nepodržan"). Test: `members/adapt/facts/form` uvoze samo `./x.ts`/`../x.ts`.

## Fajlovi van `marathon/v2` (svaki sa razlogom)

- `domain/generators/select.ts` — maraton v2 (b) kroz adapter; `marathonV2AdaptPreview`, `marathonV2GoalChange`,
  `marathonV2FormHistory`, `MARATHON_V2_TEST_FIELD`; bez `adaptationUnsupportedFor`.
- `stores/marathonV2Actions.ts` (nov, kopija `hmV2Actions`); `executionActions.ts` `previewMarathonV2` + `marathonV2`.
- `features/plan/MarathonV2Adjustment.tsx` (nov), `AdjustPlan.tsx`, `index.tsx` (traka), `planActions.ts`
  (`changeGoalTimeMarathonV2`); `features/today/Advisories.tsx` (traka); `features/ti/screens.tsx` (Cilj, tekst
  prekidača maratona); `features/race/FormMarathonV2.tsx` (nov) + `FormScreen.tsx`; `features/day/MarathonV2TestResult.tsx`
  (nov) + `DayScreen.tsx`. Za ostale distance sve grane iste (maraton dodat ispred/pored, traka maratona tek kad
  5K/10K/HM nemaju poruku).
- Testovi: `marathon/v2/app/adaptFlow.node.test.ts` (nov, 17), `app.node.test.ts` (ugovor (b) posle 06, KNOWN_VERSIONS),
  `marathon/v2/adapt.node.test.ts` (+2), `features/plan/marathonV2Adapt.test.tsx` (nov, 6), `marathonV2Flow.test.tsx`
  (umesto „stiže uskoro" tok v2), `e2e/marathon-v2.spec.ts`.

## Odstupanja i otvorena pitanja (za organizatora)

1. **Test 3 km nije činjenica rezultata** (kao HM-06 odstupanje 1): pouka 17 ga navodi, ali jezgro (M18:
   5000/10000/21097,5/42195) 3000 m odbija (`ADAPT_RESULT_INVALID`, ceo pregled bi pao). Svež t3k (≤ 84 dana) →
   napomena „plan maratona v2 koristi rezultat na 5 ili 10 km, polumaratonu ili maratonu — ne menja tempo".
2. **Umor: isti stari RPE zapisi sutradan daju drugo prinudno rasterećenje** (domen, A5, od MAR-04; nije uvedeno ovde).
   Izmereno (adaptBases, umor primenjen na kraju nedelje w, sutra ista činjenica): 228 tokova, u 198 drugi korak ima
   `deload` sa drugim `fromWeek` (sledeća puna nedelja) → `newLimits = ['deload:<w+2>']` → traka se pojavljuje (i po
   starom pravilu domena). Pravilo trake to verno prijavljuje; uzrok je assess (RPE prozor 7 dana vezan za asOf).
   Preporuka: u assess umor samo iz RPE zapisa novijih od poslednje adaptacije (izmena politike → `marathon-v2.3.2`,
   mreže) — odluka organizatora; isto verovatno važi za HM/10K kopije (nije mereno: ne znam).
3. Prekidač 10K v2 i dalje kaže „stiže uskoro" (tekst 10K; 10K nije diran).

## Bajt-isti

`marathon/v2/app/byteSame.node` (223 heša, 9443676: 5K/10K v1, HM v1/v2, maraton v1, 5K/10K v2, lični plan) prolazi bez
izmene; HM `byteSame.node` (28da6af), `personalPlan.node.test.ts` (nije menjan) prolaze; plan maratona v2 bez činjenica
posle pregleda bajt-isti (`adaptFlow`).

## E2E (Chromium)

`e2e/marathon-v2.spec.ts` tok 1 dopunjen: … → Cilj (v2) → sat → (danas 2026-02-04) Prilagodi plan „bez novih činjenica" →
prijavljena pauza 26. 1.–4. 2. → razlozi + tabela, server nepromenjen → primena → revizija na serveru (`asOf`
2026-02-04, `marathon-v2`) → „Pregledaj vraćanje" (server nepromenjen) → primena → „Vraćanje plana: …" → nedelja trke.
E2E_RES

## Sabotaže (`web/scripts/sabotage.mjs`, `--bail=1`, brz nivo) — 8/8 palo, 59,4 s, `src` vraćen (heš cc25270657b1bd7a)

`artifacts/segment-06/sabotage-06.json` → `sabotage-06.result.json`: (a) činjenice na dva mesta — Forma sama čita
Analizu trke (6,8 s); (b) traka za staro ograničenje — domen bez uslova novog zapisa bola (10,3 s, adapt.node); (c)
promena cilja gradi plan iznova (6,7 s); (d) vraćanje prepisuje urađene dane (6,1 s); (e) član (b) poziva maraton v1
`executionBasis` (6,3 s, app.node); (f) struktura iz celog plana umesto nedelje (6,0 s); (g) zastarela sinhronizacija
kao potpuna (5,7 s); (h) aplikacija sama računa traku umesto domena (10,7 s).

## Komande i rezultati (iz `web/`)

CMD_RES

## Stalni uslovi (AGENTS.md)

1. Jedan vlasnik: odluke o planu donosi `adaptMarathonV2` (assess); adapter samo prevodi (`facts.ts`) i prikazuje;
   pravilo trake samo u domenu (`adaptBanner` + `newLimits`); nema petlji. 2–3. Plafoni i WU/CD nedirnuti (plan
   bajt-isti, merenje gore). 4. Uslovi poznati unapred (rezultat, bol, pauza, izvršenje, zaključani) ulaze u konstruktor
   kroz činjenice; zaštita samo urađeno, prošlost, zaključano (testovi: ručno izmenjen, urađen i budući urađen dan
   bajt-isti posle adaptacije i vraćanja). 5. Handoff nedirnut (test: maraton → HM v1, HM → 10K v1). 6. Plan nosi
   `marathon-v2`/`marathon-v2.3.1` i fazu iz v2 posle svake adaptacije (`stampPlan`, test). 7. `marathon/v2/app/` uvozi
   samo iz `marathon/v2/` (isolation bez novih izuzetaka + test uvoza `members/adapt/facts/form`). 8. Upotrebljivost:
   posle rezultata, manjka, bola i pauze plan za upis — svaki trening ima blokove i km > 0, dugi ≥ lagan, nedelje posle
   danas ≥ minimum (M15).
