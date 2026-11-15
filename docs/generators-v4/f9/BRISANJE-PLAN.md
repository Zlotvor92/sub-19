# BRISANJE-1: popis i plan — svi planovi na V4, brisanje v2, v1 i duplog koda

Nalog: `briefs/BRISANJE-1-POPIS.md`. Stanje: `claude/v4` @ `823ec123`, 15. 11. 2026. ≈ 09:45 po Beogradu (sat
kontejnera). Samo dokument: kod, testovi, baza, `main` i deploy nisu dirani. Brojevi su iz `find`/`wc`/`grep` nad
`web/`. Gde piše **[neprovereno]**, to nije provereno kodom ni pokretanjem.

## 0. Ukratko
- V4 domen (`domain/v4/**`) **ne uvozi ništa van sebe** u produkcionom kodu. Jedini izlaz je test
  `adapters/adopt.test.ts` → `domain/plan/resolve` (proročište). Adapteri mogu da ostanu zauvek.
- Pravi teret nisu generatori nego **`domain/generators/select.ts`**: preko njega ga uvoze 56 fajlova aplikacije
  (bez testova). `generatorForPlan(...)` ima 27 poziva: forma/VDOT, oporavak, vreme, lagan tempo, Strava/ICU, trke,
  prilagođavanje. Pod V4 to i dalje ide kroz v2 objekat izveden iz `genPlan`. Brisanje v2 znači da sve te
  funkcije prvo dobijaju V4 zamenu (korak 2), a tek posle toga dolazi brisanje foldera.
- Lični plan vlasnika danas nije u bazi. Pravi se u hodu (`personalPlan(vdot)` iz `data/personalPlan.ts` +
  `domain/personal`), a `v4Store.personalProtected` ga drži van V4 do 13. 12. Po novoj odluci ta zaštita otpada.

## 1. Popis po folderima (putanje iz `web/src/`)

### (a) Čist v2/v1 generator — briše se
| Putanja | Fajlova (kod / test / podaci) | Redova (kod / test / podaci) | Ko uvozi |
|---|---|---|---|
| `domain/generators/fiveK/v2/` | 111 (50 / 51 / 10) | 16 199 / 11 304 / 206 936 | `select.ts` (`app/index.ts`) |
| `domain/generators/tenK/v2/` | 182 (48 / 109 / 25) | 16 360 / 13 626 / 786 741 | `select.ts` |
| `domain/generators/halfMarathon/v2/` | 151 (52 / 85 / 14) | 17 840 / 10 631 / 196 667 | `select.ts` |
| `domain/generators/marathon/v2/` | 149 (48 / 87 / 14) | 16 476 / 10 725 / 112 471 | `select.ts` |
| HM v1 (`domain/generators/halfMarathon/` van `v2/`) | 82 (2 testa) | 11 961 ukupno | `select.ts` (`* as halfMarathon`), `personal.oracle.test.ts`, `test/*` |
| `domain/generators/{select,contract,handoff}.ts` | 3 | 1 239 + 620 + 14 | 56 fajlova aplikacije (v. b) |
| v2 sloj aplikacije: `stores/{fiveK,tenK,hm,marathon}V2Actions.ts`, `domain/onboarding/*V2.ts`, `features/onboarding/*V2Steps.tsx`, `features/race/Form{V2,TenKV2,HmV2,MarathonV2}.tsx`, `features/plan/{LegacyPlanNotice,ShorterDistanceDecision}.tsx` | 18 | 2 737 | `Wizard.tsx`, `FormScreen.tsx`, `executionActions.ts`, `planActions.ts` |
| Zbir v2 generatora | 593 | 66 875 / 46 286 / 1 302 815 | |

HM v1 kopija domena: `training/` 46 fajlova (14 bajt-istih sa `domain/training`), `plan/` 18, `recovery/` 8,
`watch`, `weather`, `date`, `format`, `state`, `activities`. Sve je zamrznuto i sve se briše.

### (b) Stari kod koji V4 put i dalje koristi (ostaje dok se ne zameni)
- **Prikaz:** `integrations/v4/view.ts` → `toResolved(doc)` = `toStored` + `domain/plan/resolve.resolvePlan`
  (sa `alts: {}`). Tipovi `StoredWeek`, `DayTag`, `GenPlanState` dolaze iz `domain/state`, `diffDays`/`parseIsoDate`
  iz `domain/date`. Ekrani čitaju `ResolvedPlan` (`domain/plan/types`, 55 fajlova bez testova; `useResolvedPlan`/
  `currentPlan` 23).
- **Strava:** `services/strava/stravaSync.ts` uparuje po `d.tag` (`int`/`tempo`/`lako`/`lr`/`trka`/`snaga`) i
  `d.km` razrešenog plana i upisuje u `log[d.id]` (`importedDay`). Pod V4 oznake daje `view.tagOf`.
- **log/alts/moves/vanPlana/knee:** `stores/trainingStore` + `recoveryStore`. Pod V4 ulaze u
  `adoptActive` (`integrations/v4/adopt.ts`), a `alts`/`moves` posle preuzimanja više ne utiču na prikaz.
- **Aktivni plan:** `trainingStore.activeOf` = `genPlan`, ili vlasniku `personalPlan(personalBaselineVdot(log))`
  (`domain/personal`).
- **v2 objekat i pod V4** (`select.generatorForPlan`, 27 poziva): `stores/{actions,dayActions,recoveryActions,
  raceActions,executionActions}.ts`, `services/{strava/stravaSync,icu/icuSync,icu/icuPush}.ts`,
  `app/{integrations,community}.ts`, `features/{race/useFormModel,plan/planActions,session/useEasyPace,
  today/WeatherCard,recovery/useRecoveryModel}`. Koriste `classifyMeasurement`, `recomputeVdotChain`,
  `currentVdot`, `rpeTarget`, `phaseOfWeek`, `executionModel`, `stampPlan`, `assess`/`product`. Kada nema
  `genPlan` (nov V4 korisnik), vraća se `null`, pa te funkcije tada ne rade. Šta tačno ispada **[neprovereno]**.
- **Ostali uvozi iz `select`** (najčešći): `isFiveKV2/TenKV2/HmV2/MarathonV2Plan` (5–6 fajlova svaki),
  `stampForStorage` (4), `unsupportedPlanReason` (3), `isLegacyPlan` (3), `phaseReaderFor`/`WeekPhase` (2),
  `tracksOffPlanRuns` (Strava, ICU), `isPersonalPlan` (`v4Store`). Iz `contract`: `PlanRejectionReason` (5),
  `WeekdayName` (4).

### (c) Dupli kod — predlog šta ostaje
| Ista stvar | Mesta | Ostaje |
|---|---|---|
| datumi `addDays`/`diffDays`/`weekdayOf` | `domain/date`, `v4/engine/dates`, 4× `v2/dates.ts` + 4× `v2/app/date.ts`, HM v1 `date/`, `integrations/v4/edits.ts` (`plusDays`, `weekdayOf`) | `v4/engine/dates` (V4) i `domain/date` (aplikacija) dok prikaz ne pređe na V4. Posle samo `v4/engine/dates`. `edits.ts` → uvoz iz motora |
| `fmtKm`/`fmtClock` | `domain/format`, `v4/engine/format`, 4× `v2/app/format.ts`, 3× `v2/workouts.ts`, HM v1 `format/` | `v4/engine/format` + `domain/format` dok ga ekrani koriste |
| VDOT | `domain/training/vdot/*`, `v4/engine/vdot.ts`, HM v1 `training/` | `v4/engine/vdot` (forma pod V4: `v4/fitness`). `domain/training/vdot` posle koraka 2 |
| „lični plan?" | `select.isPersonalPlan`, `domain/personal.isPersonalMeta`, `v4/adapters/personal.isPersonal` | adapter (`isPersonal`) |
| zamena/pomeranje dana | `domain/plan/edit.swapDays` (stari put), `integrations/v4/edits.applyMove` | `applyMove` |
| razrešavanje dana iz starog stanja | `domain/plan/resolve.resolvePlan` (aplikacija), `v4/adapters/shared.resolveDays` (adapter) | `resolveDays` u adapteru. `resolvePlan` ostaje samo dok prikaz ide kroz `toResolved` |
| tipovi plana | `contract.ts` (`ResolvedPlan`…), `domain/plan/types`, `domain/state` (`GenPlanState`, `StoredWeek`) | `domain/plan/types` dok traje prikaz; `contract.ts` se briše |
| zastavica pristupa | `v4Store.enabled` + `v4_pristup` + E2E `ukljuceno:false` | posle koraka 2 V4 je jedini put, zastavica se briše |
| v2 akcije | 4× `stores/*V2Actions.ts` (89–99 redova, isti oblik), 4× forma, 4× koraci čarobnjaka | ništa; V4 čarobnjak (`integrations/v4/wizard.ts`) |

### (d) Testovi i fiksture koji postoje samo zbog (a)
- Unutar v2 foldera: 332 test fajla (46 286 redova) i 63 fajla podataka/otisaka (1,30 M redova). Nestaju sa folderom.
- `domain/generators/*.node.test.ts`: 5 fajlova (`activeSession`, `architecture`, `contract`, `personalPlan`,
  `sameJson`), 1 146 redova.
- Van `generators/`: **78 test fajlova** (18 158 redova) uvozi `select`/`contract`/generator ili `@/test/generators`,
  `legacyPlans`, `legacyAdapt`, `legacyOracle`, `legacyGenerator`. Najviše ih je u `features/plan` (8),
  `features/ti`, `features/onboarding`, `domain/plan`, `domain/day` (po 5). Gde predmet testa ostaje, test se
  prevodi; gde predmet nestaje, briše se zajedno sa predmetom.
- `src/test/`: 63 fajla, 4,7 MB (`legacy-recordings/` 3,9 MB, `fixtures/` 680 KB: `legacy-plans.json.gz`,
  `legacy-adapt.json.gz`, `legacy-generator.mjs`), `generators.ts`, `legacyOracle.ts`, `personal/`.
- Proročišta: 32 `*.oracle.test.ts` (11 uvoze generator), 36 `*.pruned`, `tsconfig.oracle.json`, projekat `oracle`
  u `vitest.config.ts`. `byteSame`: 1 fajl (`fiveK/v2/segment08d.node.test.ts`).
- **Ostaju:** uzorci adaptera `v4/adapters/fixtures/` (22 plana + 6 stanja, snimljeni jednom; ne zavise od koda v2).

### (e) Infrastruktura vezana za staro
- `web/scripts/ciScope.mjs` (279 redova): `DISTANCES`, `V2_FOLDER`, pravilo „domen van `generators/<D>/v2/`".
  Plus `ciScope.node.test.ts`.
- Sabotaže: `web/scripts/sabotage.mjs` je opšti alat i ostaje. 83 JSON fajla sabotaža u `docs/**`, od kojih 134
  pogotka „generators/" (sve v2). Ne pokreću se nigde automatski, to je arhiva.
- `check:full` (45–75 min, „skoro sve su mreže generatora") i `TEST_FULL`: posle brisanja v2 treba ponovo izmeriti.
- `vercel.json` i `web/deploy/vercel.cutover.json`: `VITE_V2_DEFAULT_ON=1` (bez efekta od V1b).
  `web/deploy/cutover.node.test.ts:56` traži taj tekst doslovno.
- Zastavice: `v4Store.enabled`, `v4_pristup`, `PERSONAL_PROTECTED_UNTIL`, E2E `support/backend.ts:124`
  (`ukljuceno:false` za sve postojeće tokove).
- `AGENTS.md`: „Radna grana" (r. 3), „Stalni uslovi za v2" (r. 21), „Testovi i sabotaže" (r. 100, v1/v2/`check:full`
  /ciScope), § V4 t. 7, 11 i 12. `docs/generator-isolation/STATUS.md`.
- Dokumentacija v2 (`docs/generators-v2` 131 MB, `10k-v2`, `5k-v2`, `hm-v2`, `marathon-v2`, `5k-rebuild`): predlog
  je da se arhivira, ne briše (vlasnikova odluka, v. § 6 p. 4).

## 2. Trajno prebacivanje planova na V4
**Pravilo „aktivan plan" iz koda** (`trainingStore.activeOf`): `genPlan` postoji, bez provere datuma trke. Za
vlasnika važi `genPlan`, a ako ga nema, ugrađen lični plan (`personalVisible`). Prikaz pod V4 (`v4DocOf`) redom:
red `plan_v4`, pa preuzimanje uz isti otisak, pa stari prikaz.

**Upis (korak 1):** pri prvom otvaranju posle `load()`, kada je V4 uključen, red `plan_v4` je `null` i `genPlan`
(ili lični plan) postoji:
`adoptActive(snapshot, danas)` → `v4.commit(cur => cur === null ? { doc, otisak } : null)`.
- `commitAction` već piše uslovno po `rev`. Ako drugi uređaj stigne prvi, radnja vidi `cur !== null` i ništa ne
  piše. Dva uređaja sa istim doc-om imaju isti otisak, pa to nije sukob.
- Uz upis ide događaj `adopted` (izvor: format, `policyVersion`, otisak pre/posle) u `plan_v4_dogadjaj`, da se
  kasnije vidi poreklo.
- `user_state` (`genPlan`, `log`, `alts`, `moves`, `vanPlana`, `knee`) se **ne menja i ne briše**. To je arhiva i
  put nazad (§ 5).
- **Posle upisa:** `alts`/`moves` su ugrađeni u doc (`origin: 'manual'`, `movedFrom`) i više se ne čitaju. Nove
  izmene idu samo kroz `edits.applyMove/applyEdit` → `commitAction`. `log` ostaje izvor istine za urađeno i za
  unos (Strava i ručno, po `d.id`; ID-jevi dana se pri preuzimanju čuvaju). `vanPlana`/`knee` ostaju činjenice
  stanja. Da li posle upisa „urađeno" u doc-u dolazi iz `log` ili samo iz `aktivnost` (`edits.doneFrom(runs)`)
  **[neprovereno]**: proverava se testom u koraku 1.
- **Trka prošla:** preuzima se isto, kao završen plan (sve nedelje su prošle, ništa se ne menja), da istorija i
  Napredak ostanu. Nov plan pravi samo V4 čarobnjak (predlog, § 6 p. 2).
- **Nalog koji se mesecima ne otvori:** preuzima se kad se otvori. Adapteri ostaju zauvek kao deo V4.
  **Potvrđeno:** produkcioni kod `domain/v4/**` ne uvozi ništa van `domain/v4` (jedini izlaz je test
  `adopt.test.ts` → `domain/plan/resolve`). `v2.ts` tumači v2 plan kao podatak (`fiveKV2`… idu doslovno u
  `carried`). `integrations/v4/adopt.ts` uvozi samo tip `GenPlanState` iz `domain/state`. Taj tip se pri brisanju
  premešta u `domain/v4/adapters` (tip čitanja starog formata).

**Lični plan vlasnika:** isti put. `activeOf` daje `personalPlan(personalBaselineVdot(log))`, adapter ga
prepoznaje (`meta.licni`) i pravi doc sa `header.protected = true`. Motor ga nikad ne menja sam, a čuvar samo
upozorava (t. 8c). Upisuje se jednom u `plan_v4` vlasnikovog naloga. Pre toga se briše `personalProtected`/
`PERSONAL_PROTECTED_UNTIL` (odluka 15. 11.). Preuzimanje ne menja plan (otisak isti, test
`adopt.test.ts › lični plan vlasnika` + `personal.json`). Menja se tek na događaj. **Briše se posle** (korak 4),
kad je red potvrđen u bazi: `data/personalPlan.ts` (414), `domain/personal/index.ts` (228; `isOwnerUid`/
`ownsEntries`/`removeForeignSeed` prvo idu u `features/ti`/`stores/owner`, ako se još koriste) i
`LEGACY_PERSONAL_GENERATOR`. VDOT ličnog plana zavisi od `log` u trenutku preuzimanja. Posle upisa je fiksan u
doc-u.

## 3. Plan bez istog otiska kad „starog prikaza" više nema
**Važno:** „isti otisak" danas znači da je `fingerprintLegacy` (građen adapterovim `resolveDays`) jednak
`fingerprint(doc)`. To je saglasnost adaptera sa samim sobom. Sa prikazom aplikacije (`resolvePlan`) poređenje
radi samo test proročišta, i to nad 22 uzorka. Stvarni planovi iz baze nikad nisu prošli kroz adapter.

**Predlog pravila:** (1) `greska` (neispravan oblik ili nepoznata distanca): ne preuzima se. Ostaje `genPlan` kao
arhiva, a korisnik vidi „Plan nije moguće preuzeti — napravi nov" (čarobnjak V4). (2) `otisak-razlicit`:
preuzima se kako adapter da, uz upozorenje u zaglavlju (`header.warnings`, vrsta „preuzimanje": broj dana koji
se razlikuju i u čemu: km/tekst/urađeno/ručno) i događaj `adopted` sa oba otiska. Ništa se ne odbija (t. 6:
„sve uz upozorenje"). (3) Isti otisak: kao danas.

**Provera unapred, bez iznošenja podataka:** skripta `web/scripts/v4AdoptCensus.mjs` (piše se u koraku 1, ne
sada). Vlasnik ili organizator je pušta lokalno nad izvozom
`select data from user_state where data ? 'genPlan'` (ili nad direktnim čitanjem servisnim ključem). Skripta zove
`adoptActive` sa današnjim datumom po Beogradu, a za vlasnika i lični plan. Ispisuje **samo brojeve** po formatu
(`legacy-a`, `legacy-b`, `v2`, `personal`): `isti / razlicit / greska(kod) / nema-plana`, a za „različit" broj
dana po vrsti razlike. Bez ID-jeva, datuma, opisa i naloga. Uslov za korak 2: `greska = 0` za aktivne naloge
(4 aktivna u 14 dana, 3 sa planom) i odluka vlasnika o „različit".

## 4. Redosled brisanja (svaki korak = jedan segment, pojedinačno proveren)
| # | Šta | Mora da ostane zeleno | Veličina |
|---|---|---|---|
| 1 | Trajno preuzimanje (§ 2) + popisna skripta (§ 3) + lični plan u `plan_v4` + skida se `personalProtected`. E2E podrazumevano prelazi na V4 uključen (`backend.ts:124`). Stari tokovi dobijaju izričit `ukljuceno:false` | `npm run check`, `v4Store.test`, `adopt.test`, `integrations/v4/*`, E2E `v4.spec` + `owner.spec` + nov test „prvo otvaranje upisuje red, drugi uređaj ne piše" | srednji |
| 2 | Prikaz i funkcije bez v2 puta: 27 poziva `generatorForPlan` dobija V4 izvor (forma/VDOT ← `v4/fitness`, faza ← `doc.weeks[].intent`, lagan tempo/RPE ← `paceCtxOf`, prilagođavanje ← događaji V4, `tracksOffPlanRuns` ← uvek). Briše se grana „stari prikaz", zastavica `enabled` i `v4_pristup` u kodu. `select.ts` se smanjuje na ono što ostaje | sve E2E koje danas brane v2 put (16 testova) prevedene na V4 put **pre** brisanja (§ 5). Ekrani Danas/Plan/Napredak/Ti bez praznog stanja za nalog bez `genPlan` | **veliki** |
| 3 | Brisanje v2 generatora po distanci (5K → 10K → maraton → HM), sa `*V2Actions`, `onboarding/*V2`, `*V2Steps`, `Form*V2`, `ShorterDistanceDecision`, `LegacyPlanNotice`, granom `executionActions` | po distanci: `check`, `tsc -b`, `build`, otisci V4 planova te distance (`domain/v4/distances/<d>`) nepromenjeni, E2E | srednji ×4 |
| 4 | HM v1 (`halfMarathon/` van `v2/`), `domain/personal`, `data/personalPlan.ts`, `LEGACY_PERSONAL_GENERATOR`, `select.ts`/`contract.ts`/`handoff.ts` do kraja | vlasnikov red u `plan_v4` potvrđen u bazi (organizator, samo zbir). `adopt.test › lični plan` ostaje na `personal.json` | srednji |
| 5 | Zajednički ostaci: tipovi čitanja starog formata premešteni u adapter, `domain/plan/edit.swapDays`, deo `domain/training/vdot`, `VITE_V2_DEFAULT_ON` (`vercel.json`, `deploy/vercel.cutover.json`, `cutover.node.test.ts`). Izmena `vercel.json` je deploy konfiguracija i traži potvrdu vlasnika | `check`, `build`, `deploy/*.node.test` | mali |
| 6 | Testovi/fiksture/CI/dokumenti: 78 test fajlova (prevod ili brisanje sa predmetom), `src/test/legacy*`, `generators.ts`, proročišta čiji je predmet obrisan, `ciScope.mjs` (bez `DISTANCES`/`V2_FOLDER`: domen V4 po folderu distance), `AGENTS.md` (bez v2/v1 odeljaka), `TEST-SPEED.md`, ponovno merenje `check:full` | `ciScope.node.test`, ceo `npm test` jednom, CI „sve" zelen | srednji |
| 7 | Dupli kod u V4 sloju (§ 1c): `edits.ts` datumi → motor, `isPersonal` jedini, `toResolved`/`resolvePlan` → ekrani čitaju `PlanDoc` direktno (ako vlasnik želi; inače `resolvePlan` ostaje kao jedini prikaz) | otisci planova po distanci, E2E | srednji (bez prikaza) / veliki (sa prikazom) |

## 5. Rizici i šta se gubi
1. **Vraćanje nazad:** posle brisanja jedini put nazad je prethodni deployment na Vercelu. On radi zato što
   `user_state` ostaje netaknut (§ 2), ali ne vidi ništa što je urađeno u V4 posle prelaska (izmene, novi planovi
   samo u `plan_v4`). Zato se korak 3 ne radi istog dana kad i korak 1.
2. **Pokrivenost E2E:** 16 testova u 6 spec-ova brani samo v2 put (`fivek-v2` 3, `tenk-v2` 3, `hm-v2` 4,
   `marathon-v2` 3, `handoff-v2` 2, `legacy-plan` 1). Uz njih, svih 15 spec-ova koji zovu `createPlan`/`runWizard`
   danas rade sa V4 isključenim (`backend.ts:124`). V4 put brani `v4.spec` (6 testova). Predlog: svaki tok se
   prevodi na V4 (čarobnjak V4, preuzimanje starog plana iz uzorka, kraća distanca kao događaj V4), a briše se tek
   kad prevedeni test prođe. „Kraća distanca" (`handoff-v2`) u V4 **[neprovereno]** postoji kao funkcija.
3. **Funkcije koje danas daje samo v2** (forma/VDOT lanac, prilagođavanje izvršenja, hod-trk, ulaz u kvalitet,
   trke/rekalibracija): ako V4 nema ekvivalent, korak 2 ih gubi. Popis po funkciji je prvi zadatak koraka 2
   **[neprovereno]**.
4. **Otisak „različit" nad stvarnim planovima:** nepoznat broj dok se ne pusti popisna skripta (§ 3).
5. **Proročišta/byteSame:** 32 proročišta upoređuju zajednički domen sa snimljenom starom aplikacijom
   (`legacy-recordings`, 3,9 MB). Ona ne štite generatore, osim 11 koja ih uvoze. Kad se predmet promeni
   (npr. VDOT u koraku 5), proročište pada namerno i briše se zajedno sa starim predmetom, nikad samo da bi bilo
   zeleno. `byteSame` (1) i `sameJson` (1) nestaju sa v2.
6. Gubi se: v2 generatori (66 875 redova koda), HM v1, mreže `check:full`, mogućnost „Generiši v2 plan".
   Stari planovi ostaju čitljivi samo kroz adapter.

## 6. Pitanja za vlasnika („da" prihvata predlog)
1. Plan čiji se otisak razlikuje preuzima se kako ga adapter da, uz upozorenje u zaglavlju i zapis razlike, a
   ne ostaje „stari prikaz", jer ga više nema. **Da?**
2. Planovi čija je trka prošla preuzimaju se kao završeni (istorija ostaje), a nov plan pravi samo V4 čarobnjak.
   **Da?**
3. `user_state` (`genPlan`, `log`, `alts`, `moves`) ostaje u bazi nepromenjen kao arhiva i put nazad. Ne briše se
   ni posle brisanja koda. **Da?**
4. Popisnu skriptu (§ 3) pušta organizator nad produkcijom, uz vaše odobrenje u tom trenutku, i vraća samo
   brojeve. Izmenu `vercel.json` (korak 5) radimo tek uz vašu potvrdu. Dokumentacija v2 (`docs/generators-v2`
   i ostali, ≈ 166 MB) se arhivira, ne briše. **Da?**
