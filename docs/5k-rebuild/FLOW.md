# 5K — stvarni tok i mesta koja menjaju istu odluku

Stanje koda: grana `claude/generator-isolation-5k-10k-hm-marathon`, commit `148c1c1`. Putanje relativne prema `web/src/`.
Sve navedeno je pročitano u kodu; uloga u izlazu potvrđena harnesom (`reference/`), osim gde piše „nije izvršeno".

## 1. Tok

| # | Faza | Gde | Ko odlučuje |
|---|---|---|---|
| 1 | Ulaz (čarobnjak) | `features/onboarding/Wizard.tsx:60–97` → `domain/onboarding/index.ts:247` `toGenerationInput` | aplikacija: provere forme (`stepValid`, `pbSanityOk` — 5K 12:00–99:59, `resultDateMessage`), `syncRunDays`, `trimQualityDays` |
| 2 | Izbor generatora | `domain/generators/select.ts:316` `generatorForDistance` (5000/undefined/0 → 5K) | aplikacija, samo izbor |
| 3 | Validacija ulaza | `generators/fiveK/training/generator/validateInput.ts` | 5K |
| 4 | Procena | `assess.ts` (VDOT iz rezultata, `realno`), `athleteAssessment.ts:15` `assessAthlete` (readiness, svežina rezultata, dužina), `formPolicy.ts` (effort-first) | 5K |
| 5 | Periodizacija | `generatePlan.ts:142–153` (1 taper ned., `qCut`), `:193–208` (bazne/run-walk nedelje), `:283–325` (ciljni obim, deload svake 4. ned., undulacija), `profile5k.ts:48` `phase5K` (economy < 25 %, peak < 75 %, sharpening) | 5K |
| 6 | Raspored dana | `daySlots.ts:35` `buildDaySlots`, `:118` `dayPreferenceWarnings`, `pickStrengthDay` | 5K |
| 7 | Nedelja | `generatePlan.ts:428–622` (`buildBaseWeek`, `buildQualityWeek`, `buildRaceWeek`) | 5K |
| 8 | Sesije | `profile5k.ts:105` `chooseQuality5K` → `qualityDose.ts:56` `introductoryQuality` / `:74` `applyQualityDose` → `sessions/*` | 5K |
| 9 | Ograničenja i finalizacija | `generatePlan.ts:394` `finalizeWeek` (LR udeo, lak ≤ LR) → `sessions/constraints.ts:106` `constrainWeek`; završni prolazi `:1164–1208`; `assessPreparation` `:1209` | 5K |
| 10 | Adapter | `fiveK/plan/adapt.ts` (ID dana, `pred`, `qs`), `Wizard.tsx:82` dodaje `ulaz` | 5K / aplikacija (tehnički) |
| 11 | Aktivacija i čuvanje | `stores/actions.ts:16` `activateNewPlan` — briše stare `g` podatke, **preračunava zajednički lanac forme** (`recomputeVdotChain` iz `domain/training/adaptation`), upis `requestPersist` | aplikacija |
| 12 | Prikaz | `domain/plan/resolve.ts` (datumi, izmene, pomeranja), `domain/plan/describe.ts:47` `dayLabel`, **`:60` `weekPhase`** (faza po udelu plana), `plan/preparation.ts` `preparationSummary`; laki tempo `features/session/useEasyPace.ts:11` (zajednički `currentVdot` + `generator.paceForZone`); RPE/vreme/sat kroz generator | aplikacija + 5K |
| 13 | Adaptacija | `stores/executionActions.ts` → `fiveK/training/execution.ts:129/263` (analiza, preporuka) → `plan/executionAdjustment.ts:126` → `plan/regenerate.ts:73` (`generatePlan` sa novim ulazom → `returnGrowth.ts` → `easyReturnWeeks` → `fatigueRecovery.ts`) → `plan/future.ts:29` `graftFuturePlan` → `plan/finalize.ts:41` | 5K (orkestracija u store-u) |
| 13b | Ostale adaptacije | promena cilja / rekalibracija / povratak (`plan/replan.ts:148/247/412/462`), predlog tempa (`training/adaptation/proposal.ts:154/305`), bol (`recovery/proposal.ts:106/359`), uvoz aktivnosti (`activities/realign.ts:42`), vraćanje verzije (`graftFuturePlan`) | 5K |

## 2. Izolacija — šta je provereno

- Statički: nijedan uvoz iz `fiveK/` van direktorijuma osim `exchange.ts` (samo `export type`). Provera: `grep` uvoza i postojeći
  `fiveK/isolation.node.test.ts`, `architecture.node.test.ts`, `runtimeIsolation.node.test.ts` — **13 fajlova / 108 testova prošlo**
  (`npx vitest run --project node src/domain/generators/`, 402 s).
- Store-ovi ne menjaju plan sami; zovu generator aktivnog plana (`executionActions.ts`, `raceActions.ts`, `recoveryActions.ts`,
  `planActions.ts`).
- **Preostala zajednička trenerska zavisnost** (nalaz F13): lanac forme koji vidi korisnik i od kog se računa prikazani laki tempo
  i tempo za vreme računa se u zajedničkom kodu (`domain/training/adaptation/{chain,measure}.ts`, konstante
  `domain/training/constants/heuristics.ts`: `VDOT_ALPHA`, `AUTO_VDOT_TOLERANCE`). 5K za svoje odluke (predlog tempa,
  rekalibracija) računa sopstveni lanac (`fiveK/training/adaptation/evidence.ts:122`), ali ulaz mu je `measured` koji je
  propustio zajednički `classifyMeasurement`. Prikaz faze nedelje (`weekPhase`) je zajednička računica po poziciji, ne faza 5K
  generatora (F12).

Zaključak: generisanje i adaptacija plana 5K su nezavisni. Prikaz tempa i prijem merenja forme nisu. To se mora rešiti pre
bilo koje 5K izmene tempa (v. STATUS, segment 2).

## 3. Mesta koja menjaju istu odluku

Redosled je redosled izvršavanja u `generatePlan.ts`, osim gde piše drugačije.

### Kilometraža nedelje
1. ciljni niz `vols` — rast `rampStep`, plafon `peakVolume` (`:283–317`, `volume.ts`)
2. undulacija na odredištu (`:321–325`)
3. `volQ` — probna raspodela i „dokazani" obim (`:820–843`) — veličina sesija
4. nedeljni omotač brzog rada (samo experienced) briše/skraćuje sesije (`:912–961`)
5. produženo zagrevanje/hlađenje kad nedelja podbaci (`:966–999`)
6. deload: skaliranje prema isporučenoj prethodnoj nedelji (`:475–504`)
7. taper: rez prema isporučenom vrhuncu (`:506–557`)
8. završna kočnica isporučenog rasta (`:559–606`)
9. `finalizeWeek` — LR udeo i „lak ≤ LR" (`:394–424`), dvaput (`:607`, `:1164`)
10. `constrainWeek` vraća skinut rad u hlađenje (`constraints.ts:106–137`), dvaput (`:396`, `:1187`)
11. protokol trke prepisuje dane taper nedelje (`:691–715`)
12. filtriranje dana pre početka (`:1171–1183`)
13. adaptacija: `guardReturnGrowth` (`returnGrowth.ts:5`), `easyReturnWeeks`, `guardFatigueRecovery`, `finalizeFuturePlan`

### Broj i izbor kvaliteta
`qCut` (`:152`), `frequencyQCut` (`:156`), `buildDaySlots` `effQ` (`daySlots.ts:41`), `weeklyQ` po readiness/nedelji (`:844–852`),
`introductoryQuality` (`qualityDose.ts:56`), `chooseQuality5K` rotacija (`profile5k.ts:105–173`), deload `reducedQualityForDeload`
(`:877–887`, `deload.ts`), omotač (`:949`), `constrainWeek` zamena lakim (`constraints.ts:117`), `guardReturnGrowth` (sesija → lako),
`easyReturnWeeks`, `guardFatigueRecovery`.

### Doza sesije
izbor formata (`profile5k.ts`), `applyQualityDose`/`experiencedDose` (`qualityDose.ts:74/162`), omotač (`maxWorkSec`),
`constrainSession` (`constraints.ts:32`), deload 60 % (`deload.ts`), taper format (`profile5k.ts:108–124`).
Plafon zone je zapisan na DVA mesta sa različitim brojevima (F14).

### Dužina (LR)
`nextLongRunTarget` (`longRunProgression.ts:52`), `allocEasyLongRun` (`allocation.ts:24`, svoj `capShare` po broju dana),
`clampLongRun` (`:367`), taper LR (`:1001–1015` i `taperFactor` u `nextLongRunTarget`), kočnica rasta (`:600–605`),
taper rez (`:551–555`), `finalizeWeek` (`:412`).

### Tempo
`assess` → `vdot0` (fiksan za ceo plan, `:429`), `racePace` = sporiji od cilja i trenutne forme (`:328–330`), aktivacija
`max(rp−4, pI−6)` (`:633`), `paceBasis: 'reference'` (effort-first), adaptacija: `applyVdotProposal`, `planRecalibrated`;
prikaz: zajednički `currentVdot` + `paceForZone` generatora (F13).

### Raspored
`buildDaySlots`, `capAfterLongRun` (`:784`), protokol trke po pomeraju od dana trke (`:666–682`), `pickStrengthDay`,
adaptacija `realignPlan` i korisnička pomeranja.

### Taper
ciljni `taperFactor` (`:294`), taper rez (`:506`), taper LR (`:1001`), taper sesije (`profile5k.ts:108`), protokol trke koji
prepisuje dane taper nedelje (`:693–715`), prikaz `weekPhase` (`TAPER` po poziciji ili zastavici).
