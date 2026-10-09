# FEATURE INVENTORY

Svaka funkcionalnost starog `app.js` i gde ide u novom frontendu. Brojevi su linije u `app.js` (APP_VERSION 282).
**Prioritet:** P0 = blokira parity izdanje · P1 = potrebno za zamenu starog frontenda · P2 = zamena je moguća i bez toga, ali se ne sme izgubiti (vraća se pre brisanja legacy-a).
**Rizik:** H = gubitak podataka / bezbednost / nepovratno · M = vidljiva regresija · L = kozmetika.
**Pročitati pre porta:** delovi koje audit nije čitao liniju po liniju (v. ARCHITECTURE §0).
Nijedna stavka se ne sme izbaciti zato što je „teško migrirati" (zahtev §31).

Putanje su relativne na `web/src/`. `domain/*` = čist TS bez DOM-a; `services/*` = I/O; `stores/*` = Zustand; `features/*` = React.

**Stanje UI-ja (2026-10-09, grana `claude/quiet-athlete`):** četiri taba — Danas · Plan · Napredak · Ti. Ekran se otvara iznad taba (stek u `stores/uiStore`, registar `features/screens.tsx`, dugme „Nazad"), mala izmena je list odozdo (registar `features/sheets.tsx`). Zajednica nema UI. Gde je koja funkcija u UI-ju: odeljak H na kraju.
Kolona *Nova lokacija*: `features/*` i `components/*` su proverene prema kodu (2026-10-09). `domain/*`, `services/*`, `stores/*`, `data/*` su imena iz audita (plan, 2026-10-01), nisu popis stvarnih fajlova i ovde nisu usklađivana; stvarno stanje je `ls web/src/<folder>`.

## A. Platforma i podaci

| ID | Feature | Postojeća implementacija | Nova lokacija | Pr. | Rizik | Pročitati pre porta |
|---|---|---|---|---|---|---|
| F-01 | **Šema stanja v11 + migracija** | `seedState` 435, `migrate` 1327–1438, `cist*` 1088–1231, `t3kMoguc`/`vdotMoguc` 1265–1283 | `domain/state/` (`PersistedStateSchema`, `migrate.ts`) + `stores/*` | P0 | **H** | `migrate` do kraja, `STARI_SEED_POTPIS`, `ukloniStariLicniPlan` |
| F-02 | Učitavanje/čuvanje, spasilačka kopija, odloženi upis | `loadState` 1439, `save/saveOdlozeno/saveOdmah` 1468–1505, `prikaziUcitavanjePalo` 14664, `prikaziUpisPao` 14690 | `services/storage/persist.ts` | P0 | **H** | ključevi (ARCHITECTURE §3), `LS_SPAS_KEY` tok |
| F-03 | **Server sync** (push/pull, sukob, istorija verzija) | `sb*` 13787–14530, `prikaziSukobSync` 14530, `istorija*` 14758–14880 | `services/sync/` + `stores/useSyncStore` | P0 | **H** | ceo `sbPush/sbPull/sbInit/sbDecide`, `primiStanjeSaServera` |
| F-04 | **Autentikacija** (Google preko Supabase, nonce, JWT, odjava, kapija) | `sbLogin` 14172, `sbLogout` 14187, `sbHead`, `sbEnsure` 14073, `sbProveriSesiju` 14122, `sbShowGate` 14393, `sbInit` 14421 | `services/api/authApi.ts`, `stores/useAuthStore`, kapija `AuthGate` u `components/ui/Shell.tsx` + Ti → Moj profil → Nalog (`features/ti/accountSection.tsx`) | P0 | **H** | hash parsiranje, `sbNonceRadi`, 900 s osvežavanje |
| F-05 | Mrežni rok (`fetchRok`) | 485–543 | `services/api/http.ts` | P0 | M | — |
| F-06 | Backup / uvoz / izvoz | `backupPayload` 12923, `validanGenPlan` 12959, `losIdUStanju` 12997, `exportBackup` 13028, `importBackup` 13035, `backupDue` 2658 | `services/backup/` + Ti → Privatnost i podaci (`features/ti/dataSection.tsx`: Izvezi / Uvezi backup); podsetnik za backup na Danas (`features/today/Advisories.tsx`) | P0 | **H** (XSS vektor kroz ID) | `losIdUStanju` ceo |
| F-07 | Brisanje naloga + lokalno zaboravljanje | `openObrisiNalogSheet` 12712, `lokalnoZaboraviSve` 12752 | list `DeleteAccountSheet` u `features/ti/AccountSheets.tsx` (Ti → Privatnost i podaci → Obriši nalog; isto iz Ti → Moj profil → Nalog), `services/api/accountApi` | P0 | **H** | oba |
| F-08 | PWA: registracija, banner „Osveži", provera verzije | `sw-reg.js`, `pratiAzuriranje` 15926, `showUpdateBanner` 16008, `osveziAplikaciju` 15986, `swStanje` 15957 | `pwa/` (`register.ts`, `updates.ts`, `updateStore.ts`) + traka „Osveži" (`app/useSystemBanners.ts`, `components/ui/BannerHost.tsx`) | P0 | **H** (R2) | v. §10 ARCHITECTURE |
| F-09 | Service worker (cache, push, sync, periodicsync, IDB) | `sw.js` | `web/public/sw.js` (isti kod, build-injektovan spisak) ili `web/src/sw/` | P0 | **H** | ceo `sw.js` + `sw-azuriranje.test` |
| F-10 | Uvodni ekran (jednom po sesiji, reduced-motion) | `uvodniEkran` 1–38, `#uvod` u HTML/CSS | `#uvod` u `web/index.html` + stil u `styles/base.css` + `web/public/uvod.js` | P2 | L | — |
| F-11 | Potvrda koju prigušen `confirm()` ne sme da pojede | `potvrdi` 14610 | `components/ui/ConfirmHost.tsx`, `app/confirm.ts` | P1 | M | test `potvrda` |
| F-12 | Trake upozorenja (oštećeno stanje, sukob, pad upisa) | `trakaUpozorenja` 14644 | `components/ui/BannerHost.tsx`, `app/useSystemBanners.ts` | P1 | M | |

## B. Plan i trening (domen)

| ID | Feature | Postojeća implementacija | Nova lokacija | Pr. | Rizik | Pročitati |
|---|---|---|---|---|---|---|
| F-20 | VDOT matematika, zone, tempo | `vo2AtV…vdotFromPace` 5974–6044, `vdotFrom5k` 646, `riegel` 628 | `domain/training/vdot/` | P0 | **H** | v. TRAINING_ENGINE_AUDIT §5 |
| F-21 | **Generator plana** (4 distance) | `DIST_PROFILES` 7659, `generatePlan` 7822–8841, `mk*/buildQuality*` 6317–7630 | `domain/training/generator/`, `distances/`, `sessions/` | P0 | **H** | cela `docs/TRAINING_ENGINE_AUDIT.md` |
| F-22 | Sesije (int/pyramid/fartlek/prog/tempo), `sessKm/sessDesc`, `applyEdit` | 6839–6942 | `domain/training/sessions/` | P0 | **H** | — |
| F-23 | Predikcijski redovi (`PRED`), `qs` | `predRow` 7018, `derivePred` 7049, `deriveQS` 7038 | `domain/training/prediction/` | P0 | H | `KIND_IZ_CILJA` |
| F-24 | Promena cilja usred pripreme | `planSaNovimCiljem` 8879, `parseClock` 8870 | `domain/training/adaptation/changeGoal.ts`; UI: Ti → Cilj → Promeni ciljno vreme (`features/ti/screens.tsx`), ulaz i iz Plan → Prilagodi plan | P1 | M | — |
| F-25 | Rekalibracija / re-entry (**samo rekalibracija je u UI-ju**) | `recalibratedPlan` 8986, `reentryPlan` 9054 | rekalibracija: `planRecalibrated` (`domain/plan/replan.ts`) preko Plan → Prilagodi plan → „Preračunaj plan prema formi" (`features/plan/planActions.ts`); `reentryPlan` (`domain/plan/replan.ts`) nema poziv ni iz jednog ekrana | P2 | L | odluka vlasnika (re-entry) |
| F-26 | Aktivni plan + datumski indeks (`CUR_PLAN`, `BY_ID`, `BY_DATE`, `DATED`) | `adaptGeneratedPlan` 659, `setActivePlan` 694, `rebuildDateIndex` 720 | `domain/plan/resolvePlan.ts` (**čista funkcija, bez mutacije**) + `stores/useTrainingStore` selektori | P0 | **H** | `rebuildDateIndex` ceo |
| F-27 | **Lični (hardkodovan) plan** vlasnika + `LICNI`, `QS`, `PRED` | 40–418, `jeVlasnik` 11560, `moraSvojPlan` 11577, `ukloniTudjiSeed` 11606 | `data/licniPlan.ts` + `domain/plan/personalPlan` | P1 | M | **IMPLEMENTIRANO** (`data/personalPlan.ts` + `domain/personal`; odluka: ostaje kao data modul) |
| F-28 | Zamena dana (swap), poništavanje | `swapDays` 784, `undoWeekMoves` 850, `weekSwapHTML` 9770, `openWeekSwap` 9797 | list `features/plan/SwapSheet.tsx` + `domain/plan/moves.ts`; UI: Plan → „Pomeri treninge" (cela nedelja) i Detalji treninga → Prilagodi trening → Pomeri na drugi dan | P0 | M | — |
| F-29 | Alternativni trening / ručna izmena dana (tip, km, opis, tempo, run/walk, + snaga) | `setAlt` 807, `clearAlt` 843, `altSheetHTML` 5635, `openAltSheet` 5679, `renderAltSheet` 5687, `cistAlts` 1198 | list `features/plan/AltSheet.tsx` + `domain/plan/alts.ts`; UI: Detalji treninga → Prilagodi trening → Zameni ili skrati (na dan odmora: Dodaj trening), „Vrati na plan" poništava | P0 | M | `setAlt`, `altDescTemplate` |
| F-30 | Izmena parametara sesije (tempo/ponavljanja/pauza), zaključana polja | `applyEdit` 6932, `mergeOverrides` 7061, `readAltFields` 5673 | `domain/training/sessions/overrides.ts` | P0 | M | — |
| F-31 | Run/walk lestvica (početnici) i za bol | `RW_LESTVICA`, `runWalkText` 918, `cistRunWalk` 1174, `rwZaBol` 1949 | `domain/training/runWalk.ts` | P0 | M | — |
| F-32 | Snaga uz trčanje; video vežbi | `jeDanSnage` 1516, `snagaSaTrcanjem` 1517, `vezbaVideo` 1052, `opisSaVezbamaHTML` 1056 | snaga se bira u `features/plan/AltSheet.tsx`, opis u Detalji treninga (`features/session/WorkoutParts.tsx`); `data/vezbe.ts` | P1 | L | `snaga-*` testovi |
| F-33 | **Završetak treninga** (done/skip, km, vreme, RPE, beleška, forma „Kako je prošlo") | `formHTML` 4876, `bindForm` 4940, `dayCard` 4815, `bindDayCard` 4859, `syncSide` 5293, `donePop` 5303 | Danas: „Završi trening" / „Preskoči" (`features/today/TodayHero.tsx`); unos u Detalji treninga → Unos (`features/today/{DayEntry,EntryForm}.tsx`, ekran `features/day/DayScreen.tsx`); `stores/useTrainingStore.logWorkout` | P0 | **H** (piše u dnevnik) | `bindForm` |
| F-34 | Pogled „Danas" | `renderDanas` 4243, `pocetnaStrana` 4088, `osveziDan` 4060, `zakaziPonoc` 4048, `renderHeader` 4125, `nextLine` 4297 | tab Danas, `features/today/` (`TodayHero`, `Advisories`) | P0 | M | prelazak preko ponoći (`danas.test`) |
| F-35 | Pogled „Plan" (prstenovi, nedelje, faze) | `renderPlan` 5386, `planSazetak` 5334, `planFaze` 5375, `prstenSVG` 5360, `nedeljaTelo` 5457, `openDaySheet` 9846 | tab Plan (jedna nedelja, ‹ ›) u `features/plan/`; „Pregled celog plana" = `features/plan/PlanOverview.tsx`; dan = ekran Detalji treninga (`features/day/DayScreen.tsx`) | P0 | M | — |
| F-36 | Oznake dana, tip, sažeci, napomene sesije | `sessCore` 877, `sessBreakdown` 966, `sessNote` 1007, `weekPhase` 951, `rpeTarget` 940, `oznakaDana` 1064, `sessKind` 1065 | `domain/plan/describe.ts` | P0 | L | — |
| F-37 | Poređenje „ista sesija", „lagano ranije", merila, razlike | `isteSesije` 4708, `karticaIstaSesija` 4787, `karticaLaganaRanije` 4758, `razlikaHTML` 4732, `meriloHTML` 3064 | `CompareCard` u `features/today/Cards.tsx` (Detalji treninga, posle trčanja) | P1 | L | — |
| F-38 | Detekcija radnih deonica iz Strava tokova, k-means, per-km | `detectWorkSegments` 3344, `kmeansV` 3263, `perKmDetail` 3479, `workLaps*` 3243–3260, `decouplingPerKm` 4001 | `domain/activity/segments.ts` | P1 | **H** (numerika) | **ceo blok 3236–3516**; `intervali-radni-deo.test`, `varijante-radni-deo.html` |
| F-39 | Spajanje/razdvajanje aktivnosti sa danima (`pickClosest`, `spojiDan`, `autoRealign`) | 3081–3236 | `domain/activity/match.ts` | P1 | M | `spojevi.test`, `prevlacenje.test` |

## C. VDOT, trka, predikcija

| ID | Feature | Postojeća | Nova | Pr. | Rizik | Pročitati |
|---|---|---|---|---|---|---|
| F-50 | Lanac forme (`vdotLog`, glačanje, `nemeri`, opseg, idempotentnost) | `recordVdot` 2458, `preracunajVdotLog` 2572, `upisiAutoTempo` 2532, `fixVdotDates` 2606, `recomputeVdotZones` 2628, `ALPHA` 8953 | `domain/training/adaptation/vdotChain.ts` | P0 | **H** | AUDIT §6 |
| F-51 | Forma vs plan, **predlog** tempa, primena, poništavanje | `formaVsPlan` 2793, `vdotPredlog` 2815, `primeniVdotPredlog` 2885, `ponistiVdotPrilagodjavanje` 2947 | `domain/training/adaptation/proposal.ts` + Plan → Prilagodi plan (`features/plan/AdjustPlan.tsx`, `useAdjustments.ts`) + red na Danas (`features/today/Advisories.tsx`) | P0 | H | `vdot-plan.test`, `forma-vs-plan.test` |
| F-52 | Pogled „Trka" (predikcija, grafik, prstenovi) | `renderPred` 10718, `predCalc` 2329, `chartPred` 11861, `chartVdotTrend` 10823, `trkaPrsten` 10608, `trendSummary` 11718, `tempoKaCilju` 11817, `planUnapred` 11843 | tab Napredak → Forma i predikcija (`features/race/FormScreen.tsx`); sažetak na Napredak (`features/progress/`) | P0 | M | `renderPred` ceo |
| F-53 | **Test na 3 km** | `t3k*` 2242–2330, `t3kKarta` 10625, `openT3kSheet` 10660 | `domain/training/t3k.ts` + list `features/race/T3kSheet.tsx`; UI: Forma i predikcija (test 3 km) i Detalji treninga → Rezultat testa → Unesi test na 3 km | P1 | M | `test-3km` (39 testova) |
| F-54 | Granice merenja (šta sme da bude merenje) | 1242–1306 (`vdotMoguc`, `t3kMoguc`…) | `domain/training/limits.ts` | P0 | H | blok 1242 |
| F-55 | Predviđanje na dan trke, upozorenja generatora | `outlookData` 9420, `renderOutlook` 9490, `planWarningsHTML` 9444 | `outlook` u čarobnjaku (`features/onboarding/Wizard.tsx`, `Step4Intensity.tsx`) | P1 | L | — |

## D. Oporavak, opterećenje, povrede

| ID | Feature | Postojeća | Nova | Pr. | Rizik | Pročitati |
|---|---|---|---|---|---|---|
| F-60 | Pogled „Oporavak" | `renderOporavak` 10460, `karticaOporavka` 9918, `karticaPulsUMiru` 10006, `chartHrv/Rhr` 9955/10033, `chartWeeks` 10063 | Napredak → Oporavak (`features/recovery/OporavakScreen.tsx`) | P0 | M | `oporavak-trka.test` |
| F-61 | Trenažno opterećenje (akutno/hronično/ACWR), pre-plan | `acwrSada` 1897, `hronicniObim` 1796, `akutniObim` 1884, `acwrPlan` 1923, `karticaOpterecenja` 10425, `upisiVanPlana` 1872 | `domain/recovery/load.ts` | P0 | M | `opterecenje-pre-plana.test` |
| F-62 | Povrede: mapa tela, status, zapisi | `bodyMapSVG` 10379, silueta 10320, `kneeStatus` 1587, `openKneeSheet` 10548, `chartKnee` 10525, `nosivDeo` 1576 | `domain/recovery/injury.ts` + Napredak → Bol (`features/recovery/BolScreen.tsx`, `BodyMap.tsx`, list `KneeSheet.tsx`) | P0 | M | polje `S.knee` zadržava ime |
| F-63 | Povratak posle bola / pauze (predlog, lestvica) | `returnToRunPhase` 1618, `injuryProposal` 1956, `applyInjuryProposal` 2221, `ostvarenost` 1700, `pauzaPovratka` 1763 | `domain/recovery/` | P0 | H | `povreda`, `povratak-obim` |
| F-64 | Telesna masa | `dodajMasu` 10166, `karticaMase` 10200, `chartWeight` 10098 | Napredak → Telesna masa (`features/recovery/MasaScreen.tsx`) | P1 | L | `masa.test` |
| F-65 | Zone pulsa (iz icu/Strava), raspodela, kartica zona | `zoneIzvor` 3540, `zoneRaspodela` 3582, `zoneHTML` 3667, `karticaZona` 3822 | `domain/activity/hrZones.ts` | P1 | M | `zone-pulsa.test` (57) |
| F-66 | Metrike sata, serija (streak), oznake nedelje | `metrikaSata` 3708, `streak` 1543, `nizDanaHTML` 1524, `weekRunCount` 1518 | tab Danas, `features/today/` | P1 | L | — |

## E. Integracije

| ID | Feature | Postojeća | Nova | Pr. | Rizik | Pročitati |
|---|---|---|---|---|---|---|
| F-70 | **Strava** (OAuth, sync, refresh, tok) | `strava*` 13094–13490, `stApi` 13152, `stravaSync` 13165, `handleOAuthReturn` 13382, `sinhronizujTreninge` 13367 | `services/strava/` (`StravaConnection` union) | P0 | **H** | `stravaSync` ceo (160 linija), `mreza-rok.test` |
| F-71 | **intervals.icu** (oporavak, aktivnosti, zone, slanje treninga na sat, OAuth) | `icu*` 10875–11540, `icuPosalji` 11701, `icuConnect` 11303, `icuFinish` 11315, `icuAutoSync` 11340 | `services/icu/` | P0 | **H** | blok 11119–11290 |
| F-72 | Vreme na dan treninga (Open-Meteo, najbolji sat, vruće/hladno) | `vremePovuci` 4408, `karticaVremena` 4544, `najboljiSat` 4461, `satTreninga` 4477, `tempTrcanja` 4528, `geo*` 4322–4340 | `services/weather/` + `domain/weather/` + Detalji treninga (`features/today/WeatherCard.tsx`); uključivanje lokacije: Ti → Zone i postavke treninga → Vreme i lokacija (`features/ti/weatherSection.tsx`) | P1 | M | `temperatura-trcanja.test` |
| F-73 | **AI analiza** (posao start/radi/citaj, trend) | `aiPozovi` 5142, `aiProveri` 5156, `aiPonovoPokreni` 5196, `aiSacekaj` 5206, `aiPokupiSve` 5218, `aiPayload` 5009, `aiKarta` 3995, `aiMoze` 3907, zaglavljeni poslovi 3911 | `services/api/aiApi` + Detalji treninga → AI analiza treninga (`features/today/AiCard.tsx`); analiza trke: Napredak → Analiza trke (`features/race/RaceAnalysis.tsx`); trend: Forma i predikcija → AI tumačenje (`features/race/TrendAi.tsx`) | P1 | M | `ai-zaglavljen.test`, `ai-posao-okidaci.test` |
| F-74 | **Web Push** (VAPID, prijava, najave, probe, periodična provera) | `push*` 15624–15830, `pozadinski*` 15555–15600, `periodicna*` 15599–15620, `osveziObavestenja` 15753 | `services/push/` + Ti → Obaveštenja (`features/ti/pushSection.tsx`) | P1 | M | `push.test` (63) |
| F-75 | Zajednica (profil, spisak, izazovi, avatari) | `zaj*` 14887–15500 | **UI uklonjen**: nema taba ni ekrana (`features/community/` obrisan). Funkcija je ugašena (`COMMUNITY_ENABLED = false` u `services/config.ts`); iza prekidača ostaje kod `domain/community/`, `services/community/communityApi.ts`, `stores/communityStore.ts`, `app/community.ts`; pri pokretanju `withdrawIfDisabled` povlači ranije objavljen red | P1 | M | `zajednica.test` (71), `zajCistProfil` |

## F. Podešavanja, podrška, administracija

| ID | Feature | Postojeća | Nova | Pr. | Rizik | Pročitati |
|---|---|---|---|---|---|---|
| F-80 | Podešavanja (grupe, sekcije, stanja) | `openSettings` 12081–12670, `osveziPodesavanja` 11942, `podesavanjaStanje` 11966, `podesavanjaGrupe` 12033 | tab Ti (`features/ti/`): Moj profil, Zone i postavke treninga, Povezani servisi, Obaveštenja, Izgled aplikacije, Privatnost i podaci, O aplikaciji; modalni list „Podešavanja" ne postoji | P0 | M | `podesavanja.test` (48) |
| F-81 | Čarobnjak (onboarding): 4 koraka, validacija, ishod | `renderOnboard` 9180, `obStepValid` 9369, `bindOnboardEvents` 9622, `finishOnboarding` 9735, `pbSanityOk` 9147, `wizardWarnings` 9451, `hasGenPlanData/purgeGenPlanData` 9709–9735 | `features/onboarding/` | P0 | M | `uvod.test`, `licni-plan.test` |
| F-82 | Prijava buga | `openBugSheet` 12670 | list `BugSheet` u `features/ti/AccountSheets.tsx` (Ti → Privatnost i podaci → Prijavi problem, samo prijavljen) | P2 | L | — |
| F-83 | Admin (korisnici, zakazana brisanja, objava) | `openKorisniciSheet` 12784, `ucitajKorisnike` 12839, `ucitajZakazana` 12805 | Ti → Vlasnik (`features/ti/adminSections.tsx`, list `UsersSheet.tsx`; red se vidi samo vlasniku) | P2 | M | `broadcast.js` admin grana |
| F-84 | Modalni list kao dijalog (fokus, inertna pozadina, Esc, Tab zamka) | `openSheet` 5562, `closeSheet` 5582, `listTab` 5547, `pozadinaInertna` 5514 | `components/ui/Sheet.tsx` + registar listova `features/sheets.tsx`; ekrani iznad taba: `features/screens.tsx` | P0 | M | `list-dijalog.test` |
| F-85 | Prevlačenje između tabova + ambijentalno svetlo | `pv*` 13491–13758, `ambijent` 4140, `setPage` 4154 | `app/useSwipeNav.ts` | P2 | L | prelazak mora poštovati `prefers-reduced-motion` |
| F-86 | Brojevi/datumi/format (srpski padeži, `fmtClock`, `esc`, `mdToHtml`) | 555–630, `plDan/pl3/brojNedelja…` 4103–4123, `gramatika.test` | `lib/format.ts`, `lib/plural.ts` | P0 | L | `gramatika.test`, `pure.test` |

## G. Pokrivenost zahteva iz zadatka (kontrola)

onboarding F-81 · Today F-34 · Plan F-35 · Recovery F-60 · Race F-52 · Community F-75 (UI uklonjen, v. F-75) · Settings F-80 (tab Ti) · workouts F-22/F-36 · workout completion F-33 · plan generation F-21 · plan editing F-29/F-30 · day swapping F-28 · alternative workouts F-29 · VDOT F-20/F-50 · training load F-61 · recovery F-60 · injuries F-62/F-63 · Strava F-70 · weather F-72 · AI F-73 · push F-74 · authentication F-04 · backup/import F-06 · PWA/offline F-08/F-09 · account deletion F-07.

**Dodatno (nije u zadatku, a postoji):** intervals.icu F-71 (izvor celog Oporavka — najveća rupa u specifikaciji), lični plan F-27, test 3 km F-53, server-side istorija verzija F-03, Zajednica sync F-75, admin F-83, snaga F-32, Android TWA (ARCHITECTURE §8).

## H. Gde je u UI-ju (stanje 2026-10-09, grana `claude/quiet-athlete`)

Tabovi: **Danas · Plan · Napredak · Ti** (`features/registry.tsx`, `stores/uiStore.ts`). Ekran (`features/screens.tsx`) se otvara iznad taba sa dugmetom „Nazad"; sistemski taster „Nazad" zatvara list pa ekran (`app/navHistory.ts`). Stari linkovi: `?tab=opor` → Napredak + Oporavak, `?tab=pred` → Napredak + Forma i predikcija, `?tab=zajed` → Danas (`app/tabs.ts`); obaveštenje `?dan=<id>` → Detalji treninga.

| Mesto u UI-ju | Šta tu stoji | Feature | Kod |
|---|---|---|---|
| Danas | trening dana sa jednim glavnim dugmetom „Detalji treninga", tihe radnje „Završi trening" / „Preskoči", kilometri nedelje, „Sledeće trčanje"; upozorenja samo kad su relevantna (tuđ plan, predlog zbog bola, upozorenje oporavka, predlog tempa, podsetnik za backup) | F-33 F-34 F-51 F-63 F-66 F-06 | `features/today/` (`TodayHero`, `Advisories`, `index.tsx`) |
| Detalji treninga (ekran) | činjenice, status (Predstoji / Odrađen / Preskočen), Prilagodi trening (Pomeri na drugi dan · Zameni ili skrati · Vrati na plan), vreme, struktura, zašto, unos; posle trčanja: Sa sata, Po zonama, Jutros, poređenje sa ranijim, AI analiza treninga; na dan testa: Rezultat testa | F-22 F-28 F-29 F-30 F-31 F-32 F-33 F-36 F-37 F-38 F-53 F-65 F-72 F-73 | `features/day/DayScreen.tsx`, `features/session/`, `features/today/{DayEntry,EntryForm,Cards,AiCard,WeatherCard}.tsx`, listovi `plan/{SwapSheet,AltSheet}.tsx` |
| Plan | jedna nedelja (‹ ›), 7 redova dana sa stanjem, redovi „Pomeri treninge", „Prilagodi plan", „Pošalji na sat" (samo uz povezan intervals.icu), dugme „Pregled celog plana" | F-28 F-35 F-71 | `features/plan/` (`index.tsx`, `WeekBody`, `DayRow`) |
| Plan → Pregled celog plana | gde si, kilometri po nedeljama, faze sa nedeljama | F-35 | `features/plan/PlanOverview.tsx` |
| Plan → Prilagodi plan | predlog zbog bola, predlog tempa prema formi, Preračunaj plan prema formi, Promeni ciljno vreme, Generiši novi plan / Napravi novi plan / Vrati na moj plan | F-24 F-25 F-51 F-63 F-81 | `features/plan/AdjustPlan.tsx`, `useAdjustments.ts`, `planActions.ts`; čarobnjak `features/onboarding/` |
| Napredak | kilometri poslednjih nedelja, VDOT i procena, poslednja aktivnost, rekordi; redovi: Forma i predikcija, Oporavak, Bol, Telesna masa, Analiza trke | F-52 F-60 F-62 F-64 | `features/progress/` (`index.tsx`, `model.ts`) |
| Napredak → Sve aktivnosti | istorija odrađenog (ručni unosi + uvoz sa Strave i intervals.icu), dodir otvara Detalje treninga tog dana, a unos van plana Analizu trke | F-39 F-70 F-71 | `features/progress/ActivitiesScreen.tsx` |
| Napredak → Forma i predikcija | odgovor „da li napredujem", procena po distancama, VDOT kroz vreme, predikcija kroz plan, test na 3 km, AI tumačenje | F-50 F-52 F-53 F-73 | `features/race/FormScreen.tsx`, `T3kSheet.tsx`, `TrendAi.tsx` |
| Napredak → Oporavak | spremnost, opterećenje (ACWR), HRV, puls u miru | F-60 F-61 | `features/recovery/OporavakScreen.tsx` |
| Napredak → Bol | mapa tela, istorija unosa | F-62 F-63 | `features/recovery/BolScreen.tsx`, `BodyMap.tsx`, `KneeSheet.tsx` |
| Napredak → Telesna masa | merenja i grafikon | F-64 | `features/recovery/MasaScreen.tsx` |
| Napredak → Analiza trke | rezultat, prolazi po kilometru, AI analiza trke | F-73 | `features/race/RaceAnalysis.tsx`, `RaceData.tsx` |
| Ti | nalog i cilj; redovi: Moj profil, Zone i postavke treninga, Povezani servisi, Obaveštenja, Izgled aplikacije, Privatnost i podaci, O aplikaciji, Vlasnik (samo vlasnik) | F-80 | `features/ti/index.tsx`, `screens.tsx` |
| Ti → Moj profil | nalog (prijava, sinhronizacija, odjava), trkačko iskustvo (samo čitanje) | F-04 | `features/ti/accountSection.tsx`, `profileModel.ts` |
| Ti → Cilj | ciljno vreme, promena cilja, Generiši novi plan | F-24 F-81 | `features/ti/screens.tsx` (`GoalScreen`) |
| Ti → Zone i postavke treninga | zone pulsa, vreme i lokacija | F-65 F-72 | `features/ti/stravaSection.tsx` (`ZonesList`), `weatherSection.tsx` |
| Ti → Povezani servisi | Strava, intervals.icu, Slanje na sat | F-70 F-71 | `features/ti/stravaSection.tsx`, `icuSections.tsx` |
| Ti → Obaveštenja | uključivanje / isključivanje podsetnika | F-74 | `features/ti/pushSection.tsx` |
| Ti → Izgled aplikacije | Prati sistem / Svetla / Tamna; po uređaju (`localStorage` ključ `sub20-tema`), ne sinhronizuje se | — | `lib/theme.ts`, `lib/useTheme.ts`, `web/public/tema.js` |
| Ti → Privatnost i podaci | Izvezi / Uvezi backup, Ranije verzije, Prijavi problem, Politika privatnosti, Obriši nalog | F-03 F-06 F-07 F-82 | `features/ti/dataSection.tsx`, `AccountSheets.tsx` |
| Ti → O aplikaciji | verzija, offline kopija, uputstvo | F-08 | `features/ti/screens.tsx` (`AboutScreen`), `AppRefresh.tsx` |
| Ti → Vlasnik | obaveštenje korisnicima, korisnici | F-83 | `features/ti/adminSections.tsx`, `UsersSheet.tsx` |
| (nema UI) Zajednica | uklonjena iz aplikacije; v. F-75 | F-75 | — |
