# BRISANJE-1: popis i plan — svi planovi na V4, brisanje v2, v1 i duplog koda

Nalog: `briefs/BRISANJE-1-POPIS.md`. Stanje: `claude/v4` @ `823ec123`, 15. 11. 2026. ≈ 09:45 po Beogradu (sat
kontejnera). Samo dokument: kod, testovi, baza, `main` i deploy nisu dirani. Brojevi su iz `find`/`wc`/`grep` nad
`web/`. Gde piše **[neprovereno]**, to nije provereno kodom ni pokretanjem.
**Dopuna (odluka vlasnika 15. 11. 2026, ≈ 10:55 po Beogradu, preneo organizator):** „Samo te v2 planove i moj plan
prebacuješ u V4, ostale briši, nek generišu nove." Zato u V4 trajno prelaze samo v2 planovi (≈ 3) i lični plan.
Planovi starog formata se ne preuzimaju (§ 2b), a njihovi adapteri i fiksture idu u brisanje (§ 1a, 1d).

## 0. Ukratko
- V4 domen (`domain/v4/**`) **ne uvozi ništa van sebe** u produkcionom kodu. Jedini izlaz je test
  `adapters/adopt.test.ts` → `domain/plan/resolve` (proročište). Adapter v2 i adapter ličnog plana trebaju samo
  dok se ta preuzimanja ne upišu u `plan_v4` (§ 2c). Adapter starog formata više nije potreban.
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
| Adapter starog formata: `v4/adapters/legacy.ts` (32) + grana u `detect.ts`; uzorci `v4/adapters/fixtures/legacy-*.json` (12) i `states/legacy-*.json` (4) | 17 fajlova | 32 + 17 785 | `detect.ts`, `adopt.test.ts` |
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
- Fiksture starog formata `src/test/legacyPlans.ts` (45), `legacyAdapt.ts` (43), `fixtures/legacy-plans.json.gz`,
  `legacy-adapt.json.gz`: koristi ih 24 testa van `src/test/` (`domain/training/adaptation` 4, `domain/plan` 3,
  `domain/day` 3 …). Brišu se ili se prevode na V4 dok plan starog formata ne nestane iz prikaza (korak 2).
- **Ostaju privremeno:** uzorci `v2-*.json` (8), `personal.json` i `states/personal-*.json` (2). Brišu se zajedno sa
  adapterima (§ 2c).

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
- Dokumentacija v2 (`docs/generators-v2` 131 MB, `10k-v2`, `5k-v2`, `hm-v2`, `marathon-v2`, `5k-rebuild`): arhiva (§ 6 p. 4).

## 2. Prebacivanje planova na V4 (posle dopune)
**Pravilo „aktivan plan" iz koda** (`trainingStore.activeOf`): `genPlan` postoji, bez provere datuma trke. Za
vlasnika važi `genPlan`, a ako ga nema, ugrađen lični plan (`personalVisible`). Vrsta plana: v2 = `adapters/v2.isV2`
(`meta.policyId`/`policyVersion` sa `-v2.` ili ključ `fiveKV2`/`tenKV2`/`hmV2`/`marathonV2`); stari format =
`select.isLegacyPlan` (`meta.policyId` nema ili je u `LEGACY_POLICY_IDS`: `5k-v1`…`legacy-10k`…).
### 2a. v2 planovi i lični plan → red u `plan_v4` (trajno)
Upis (korak 1): pri prvom otvaranju posle `load()`, kada je red `plan_v4` `null`, a aktivan plan je v2 ili lični:
`adoptActive(snapshot, danas)` → `v4.commit(cur => cur === null ? { doc, otisak } : null)`.
- `commitAction` već piše uslovno po `rev`. Ako drugi uređaj stigne prvi, radnja vidi `cur !== null` i ništa ne
  piše. Isti doc sa dva uređaja nije sukob.
- Uz upis ide događaj `adopted` (format, `policyVersion`, otisak pre/posle) u `plan_v4_dogadjaj`.
- **Posle upisa:** `alts`/`moves` su ugrađeni u doc (`origin: 'manual'`, `movedFrom`) i više se ne čitaju. Nove
  izmene idu kroz `edits.applyMove/applyEdit` → `commitAction`. `log` ostaje izvor za urađeno i unos (po `d.id`;
  ID-jevi dana se pri preuzimanju čuvaju). Da li „urađeno" posle upisa dolazi iz `log` ili samo iz `aktivnost`
  (`edits.doneFrom(runs)`) **[neprovereno]**: proverava se testom u koraku 1.
- v2 plan čija je trka prošla: NE preuzima se, briše se kao stari (odluka 2, § 2d).
- **Lični plan:** `activeOf` daje `personalPlan(personalBaselineVdot(log))`, adapter ga prepoznaje (`meta.licni`)
  → `header.protected = true` (motor ga ne menja sam, čuvar samo upozorava, t. 8c). Pre upisa se briše
  `personalProtected`/`PERSONAL_PROTECTED_UNTIL`. VDOT zavisi od `log` u trenutku upisa, posle je fiksan u doc-u.
### 2b. Plan starog formata → uklanja se sa svim podacima, korisnik vidi samo čarobnjak
Odluke vlasnika (15. 11. 2026, ≈ 09:50 po Beogradu): (a) pri otvaranju SAMO čarobnjak; (b) briše se sve vezano za
stari plan, i trčanja uneta uz njega; (c) plan se uklanja, bez arhive u `user_state`. Rezerva: `rezerva_20261114`.

**Polja `user_state.data` (`domain/state/types.ts` `PersistedState`, `stores/persistence.ts` `*_KEYS`):**
| Polje | Šta je | Odluka |
|---|---|---|
| `genPlan` | stari plan (uz `genPlan.verzije` = verzije plana iz `recordPlanRevision`) | **briše se** (`null`) |
| `log` | unosi po ID-ju dana (`g…`), i Strava upisi u njih | **briše se** ceo ključ `g…` (stari plan ima samo `g…`, provereno na 12 uzoraka) |
| `alts`, `moves` | ručne izmene i pomeranja dana | **briše se** (`g…`) |
| `pred`, `predLock` | procene vremena po danu | **briše se** (`g…`) |
| `vanPlana`, `vanPlanaV2` | trčanja van plana (datum → km; `izvor:ID` → zapis) | **briše se** (odluka b; `discardPlan` ih danas NE briše) |
| `vdotLog` | lanac forme (VDOT) | **konačno (§ 2d):** prazni se ceo |
| `knee`, `kg` | bol i težina | zapisi sa `src` `g…` se brišu; ručni (`src` null) ostaju |
| `t3k` | test na 3 km | ostaje (§ 2d) |
| `wellness` | jutarnja merenja (HRV, puls u miru, san, težina) | ostaje |
| `ui` | `firstRun`, `lastBackup`, `snooze`, `seenWeek`, `geo`, `satTreninga`, `novo` | ostaje; `seenWeek`/`snooze` se poništavaju (vezani za nedelje starog plana) |
| `vreme` (`sati` treninga), `zajed` (zajednica), `icu` (veza), `strava` (tokeni, ne idu na server), `v` | podešavanja i veze | ostaje |
| nepoznata polja (`pickUnknown`) | čuvaju se doslovno | ostaje (bez tumačenja) |
Van `user_state`: `aktivnost` (Strava trčanja za V4), `push_pretplata`, `zajednica_profil`, `ai_posao` — ostaju.
Trke/rekordi: u `user_state` nema posebnog polja; rezultat trke je u `log` dana trke (`raceAi` …) i briše se sa
njim, osim kao trčanje u `aktivnost`. Konačno: briše se (§ 2d).

**Kako se uklanja (konačno, § 2d):** jednokratno u bazi (SQL nacrt u § 2d, pušta ga organizator), pa **čuvar na
uređaju**: nova radnja `discardLegacyPlan()` = `discardPlan()` (`stores/actions.ts:63`: `purgeGenPlanData` briše
`g…` iz `log`/`pred`/`predLock`/`alts`/`moves`/`vdotLog`, `knee`/`kg` sa `src` `g…`, `genPlan: null`,
`requestPersist('now')`) **plus** `vanPlana: {}`, bez `vanPlanaV2`, `ui.seenWeek`/`snooze` = `null`, pa samo
čarobnjak, bez pitanja. Pokreće se posle `hydrate` i `v4.load()` kad pravilo kaže „briše se". Pokriva uređaj sa
keširanim starim stanjem (van mreže, upis posle SQL-a) i „Vrati verziju" (`user_state_istorija`: okidač
`user_state_zapamti` čuva staro stanje najviše jednom na sat, 40 verzija; za obrisane naloge se čisti u istom SQL-u).
`discardPlan` sam ne pokriva odluku (ostavlja `vanPlana`/`vanPlanaV2`).

**Pravilo „zadržava se / briše se" (iz koda, na jednom mestu: `domain/v4/adapters/detect.ts`, `kindOfStoredPlan`):**
1. `genPlan === null` → „nema plana", ništa se ne dira (i vlasnikov ugrađeni plan je `genPlan === null`).
2. Vlasnikov nalog (`user_id = ADMIN_UID`, `services/config.ts:31`; `isOwnerUid`) → **nikad** u masovnom brisanju.
3. `adapters/v2.isV2(genPlan)` (`meta.policyId`/`policyVersion` sa `-v2.` ili ključ `fiveKV2`/`tenKV2`/`hmV2`/
   `marathonV2`) **i** `meta.raceDate >= danas` (Beograd) → zadržava se i preuzima (§ 2a).
4. Sve ostalo sa `genPlan !== null` (stari format po `select.isLegacyPlan`, v2 sa prošlom trkom, nepoznat oblik ili
   politika) → briše se. Plan koji je i `isV2` i `isLegacyPlan` (v2 ključ bez `policyId`) ide po tački 3.
**Prednost na vlasnikovom nalogu (lični plan + `genPlan` v2):** danas `trainingStore.activeOf` vraća `genPlan` ako
postoji, pa bi v2 imao prednost i lični plan se ne bi ni prikazao ni preuzeo. Po odluci 3 na vlasnikovom nalogu
važi **lični plan**: `activeOf` za vlasnika se u koraku 1 menja u „lični plan pre `genPlan`", a vlasnikov `genPlan`
v2 uklanja se posebno, na njegovom uređaju (`discardLegacyPlan`, posle upisa ličnog plana u `plan_v4`). `n…` unosi
ličnog plana ostaju, jer brisanje dira samo `g…`. Da je treći v2 plan baš vlasnikov **[neprovereno]** (zbir
organizatora). SQL vlasnikov nalog ne dira.

**Test koji ga brani** (`detect.test.ts`, korak 1): svih 8 uzoraka `v2-*` → `v2`; `personal.json` → `licni`;
12 uzoraka `legacy-*` → briše se; `null` → `nema`; veštački: v2 ključ bez `policyId` → v2, v2 sa
`raceDate` < danas → briše se, `policyId: '10k-v3'` i `raceDistM: 7000` → briše se, vlasnikov nalog → ne dira se
masovno, vlasnik sa ličnim + v2 → aktivan lični. Plus test radnje:
`discardLegacyPlan` nad `states/legacy-*` ostavlja `wellness`/`ui.geo`/`zajed`/`t3k`/ručni `knee` bajt-isto, a
nad v2 i ličnim stanjem se ne poziva. E2E (korak 2): korisnik sa starim planom vidi samo čarobnjak.

### 2d. Konačne odluke vlasnika (15. 11. 2026, ≈ 09:55 po Beogradu) i SQL nacrt
1. Plan se preuzima kako ga adapter da, uz upozorenje u zaglavlju (i v2 i lični plan).
2. v2 planovi čija je trka prošla se ne preuzimaju, brišu se kao stari.
3. Čuvaju se i prelaze u V4 SAMO dva v2 plana aktivnih korisnika i lični plan vlasnika. Sve ostalo se briše iz
   baze (plan + sve uneto uz njega). `user_state` ne ostaje kao arhiva. Korisnik posle toga vidi samo čarobnjak.
4. Zbir (organizator): v2 = 3 (trka nije prošla, aktivni u 14 dana); stari format = 19 (17 sa budućom trkom, 0
   aktivnih u 14 dana, poslednja izmena 18. 10. 2026). Treći v2 je verovatno vlasnikov (v. „Prednost" u § 2b).

**Polja `user_state.data` za obrisane naloge:**
- **Brišu se** (postaju prazna): `genPlan`, `log`, `alts`, `moves`, `pred`, `predLock`, `vdotLog`, `vanPlana`,
  `vanPlanaV2`.
- **Brišu se delimično:** iz `knee`/`kg` zapisi sa `src` (vezani za dan plana).
- **Poništavaju se:** `ui.seenWeek` i `ui.snooze` = `null`.
- **Ostaju:** `v`, `t3k`, `wellness`, ostatak `ui`, `vreme`, `zajed`, `icu`, `strava` (na serveru ionako nije),
  ručni `knee`/`kg` (`src` null) i nepoznata polja. Van `user_state` ostaju `aktivnost`, `push_pretplata`,
  `zajednica_profil` i `ai_posao`.
- Za tih 19 naloga je sve u `log`/`vdotLog` vezano za plan (0 aktivnosti od 18. 10.), pa se ta polja prazne cela.
- Red se ne briše: `delete` reda bi obrisao i merenja i podešavanja.

**SQL nacrt — NE izvršava se.** Pušta ga organizator, u jednoj transakciji, ovim redom:
```sql
begin;
create temp table za_brisanje on commit drop as
  select user_id from public.user_state
   where jsonb_typeof(data->'genPlan') = 'object'
     and user_id <> '0403f8fb-a643-4d4e-843d-f71199a0d6f9'              -- vlasnik (ADMIN_UID) nikad
     and coalesce(data->'genPlan'->'meta'->>'licni','false') <> 'true'
     and not (                                                          -- čuva se v2 sa budućom trkom
       ( data->'genPlan' ?| array['fiveKV2','tenKV2','hmV2','marathonV2']
         or coalesce(data->'genPlan'->'meta'->>'policyId','')      like '%-v2.%'
         or coalesce(data->'genPlan'->'meta'->>'policyVersion','') like '%-v2.%' )
       and coalesce(data->'genPlan'->'meta'->>'raceDate','')
           >= to_char(now() at time zone 'Europe/Belgrade', 'YYYY-MM-DD'));
select count(*) as pogodjeno from za_brisanje;                          -- mora 19, inače rollback
select count(*) as zadrzano from public.user_state
 where jsonb_typeof(data->'genPlan') = 'object'
   and user_id not in (select user_id from za_brisanje);               -- mora 3 (2 v2 + vlasnik), inače rollback
update public.user_state u
   set data = u.data || jsonb_build_object(
     'genPlan', null, 'log', '{}'::jsonb, 'alts', '{}'::jsonb, 'moves', '{}'::jsonb,
     'pred', '{}'::jsonb, 'predLock', '{}'::jsonb, 'vdotLog', '[]'::jsonb, 'vanPlana', '{}'::jsonb,
     'knee', coalesce((select jsonb_agg(k) from jsonb_array_elements(coalesce(u.data->'knee','[]')) k
                        where coalesce(k->>'src','') = ''), '[]'::jsonb),
     'kg',   coalesce((select jsonb_agg(k) from jsonb_array_elements(coalesce(u.data->'kg','[]')) k
                        where coalesce(k->>'src','') = ''), '[]'::jsonb),
     'ui',   coalesce(u.data->'ui','{}'::jsonb) || '{"seenWeek":null,"snooze":null}'::jsonb)
     - 'vanPlanaV2'
 where u.user_id in (select user_id from za_brisanje);
delete from public.user_state_istorija                                 -- POSLE update-a: okidač je upravo
 where user_id in (select user_id from za_brisanje);                   -- sačuvao staro stanje kao verziju
commit;
```
**Zašto nacrt ne može da pogodi v2 plan ni vlasnikov nalog:**
- Vlasnik je isključen dvaput, po `user_id` i po `meta.licni`.
- v2 plan sa budućom trkom je isključen istim uslovom kao `isV2`, uz datum trke.
- Oba `select`-a pre `update`-a moraju dati tačno 19 i 3, inače `rollback`.
- Pre puštanja nacrt se proverava nad uzorcima (`v2-*`, `legacy-*`, `personal.json`) u lokalnoj bazi
  **[neprovereno]**.

`user_state_istorija` se čisti samo za tih 19 naloga (odluka 3); za v2 naloge i vlasnika ostaje. Vraćanje je
moguće samo iz `rezerva_20261114`. Čuvar na uređaju (§ 2b) ostaje i posle SQL-a.

### 2c. Kada adapteri mogu da se obrišu
Adapter v2 (`v2.ts`), adapter ličnog plana (`personal.ts`), `detect.ts`, `fingerprintLegacy.ts`, `read.ts`,
`shared.ts`, `stimuli.ts` i uzorci trebaju samo za upis iz 2a. Predlog: brišu se kada (1) organizator potvrdi zbirom
iz baze da svaki nalog sa v2 `genPlan`-om (≈ 3) i vlasnik imaju red u `plan_v4`, i (2) prođe 14 dana bez grešaka
preuzimanja. Nalog sa v2 planom koji se do tada ne otvori postaje stari format (2b). Grana starog formata
(`legacy.ts` + uzorci `legacy-*`) se ne koristi za preuzimanje i briše se u koraku 2, osim 12 uzoraka koji
ostaju u `detect.test.ts` dok traje čuvar (tada se brišu zajedno sa čuvarom, korak 6b).

## 3. Plan bez istog otiska (sada samo ≈ 3 v2 plana i lični plan)
**Važno:** „isti otisak" danas znači da je `fingerprintLegacy` (adapterov `resolveDays`) jednak `fingerprint(doc)`.
To je saglasnost adaptera sa samim sobom. Sa prikazom aplikacije (`resolvePlan`) poređenje radi samo test
proročišta nad uzorcima (8 v2 + lični).

**Predlog pravila:** (1) `greska`: ne preuzima se, a plan se ponaša kao stari format (2b). Za lični plan to je
blokada: korak 4 ne počinje. (2) `otisak-razlicit`: preuzima se kako adapter da, uz upozorenje u zaglavlju
(`header.warnings`, vrsta „preuzimanje": koliko dana se razlikuje i u čemu: km/tekst/urađeno/ručno) i događaj
`adopted` sa oba otiska. Ništa se ne odbija (t. 6). Za lični plan, razlika se pre upisa javlja organizatoru i ne
upisuje se bez vlasnikovog „da" (t. 8c: lični plan ima prednost). (3) Isti otisak: upis.

**Provera unapred, bez iznošenja podataka:** skripta `web/scripts/v4AdoptCensus.mjs` (piše se u koraku 1, ne sada).
Organizator je pušta lokalno nad `select data from user_state where data ? 'genPlan'` uz vlasnikovo odobrenje.
Poziva `adoptActive` za svaki v2 plan i za lični plan (današnji datum po Beogradu). Vraća **samo brojeve**:
`v2: isti/razlicit/greska(kod)`, `licni: isti/razlicit`, `stari format: ukupno / trka ≥ danas`, i za „različit"
broj dana po vrsti razlike. Bez ID-jeva, datuma, opisa i naloga. Uslov za upis: `greska = 0` i za lični plan `isti`.

## 4. Redosled brisanja (svaki korak = jedan segment, pojedinačno proveren)
| # | Šta | Mora da ostane zeleno | Veličina |
|---|---|---|---|
| 1 | Trajno preuzimanje SAMO v2 + lični plan (§ 2a), popisna skripta (§ 3), skida se `personalProtected`. Pravilo `kindOfStoredPlan` + `detect.test.ts`, radnja `discardLegacyPlan` + čuvar, stari format → samo čarobnjak (§ 2b). E2E podrazumevano prelazi na V4 uključen (`backend.ts:124`). Stari tokovi dobijaju izričit `ukljuceno:false` | `npm run check`, `v4Store.test`, `adopt.test`, `integrations/v4/*`, E2E `v4.spec` + `owner.spec` + nov test „prvo otvaranje upisuje red, drugi uređaj ne piše" | srednji |
| 2 | Prikaz i funkcije bez v2 puta: 27 poziva `generatorForPlan` dobija V4 izvor (forma/VDOT ← `v4/fitness`, faza ← `doc.weeks[].intent`, lagan tempo/RPE ← `paceCtxOf`, prilagođavanje ← događaji V4, `tracksOffPlanRuns` ← uvek). Briše se grana „stari prikaz", zastavica `enabled` i `v4_pristup` u kodu. Brišu se `adapters/legacy.ts` (grana u `detect.ts`), `LegacyPlanNotice`, uzorci `states/legacy-*`, `test/legacyPlans`/`legacyAdapt` (24 testa: prevod ili brisanje). `select.ts` se smanjuje na ono što ostaje | sve E2E koje danas brane v2 put (16 testova) prevedene na V4 put **pre** brisanja (§ 5). Ekrani Danas/Plan/Napredak/Ti bez praznog stanja za nalog bez `genPlan` | **veliki** |
| 3 | Brisanje v2 generatora po distanci (5K → 10K → maraton → HM), sa `*V2Actions`, `onboarding/*V2`, `*V2Steps`, `Form*V2`, `ShorterDistanceDecision`, `LegacyPlanNotice`, granom `executionActions` | po distanci: `check`, `tsc -b`, `build`, otisci V4 planova te distance (`domain/v4/distances/<d>`) nepromenjeni, E2E | srednji ×4 |
| 4 | HM v1 (`halfMarathon/` van `v2/`), `domain/personal`, `data/personalPlan.ts`, `LEGACY_PERSONAL_GENERATOR`, `select.ts`/`contract.ts`/`handoff.ts` do kraja | vlasnikov red u `plan_v4` potvrđen u bazi (organizator, samo zbir). `adopt.test › lični plan` ostaje na `personal.json` | srednji |
| 5 | Zajednički ostaci: tipovi čitanja starog formata premešteni u adapter, `domain/plan/edit.swapDays`, deo `domain/training/vdot`, `VITE_V2_DEFAULT_ON` (`vercel.json`, `deploy/vercel.cutover.json`, `cutover.node.test.ts`). Izmena `vercel.json` je deploy konfiguracija i traži potvrdu vlasnika | `check`, `build`, `deploy/*.node.test` | mali |
| 6 | Testovi/fiksture/CI/dokumenti: 78 test fajlova (prevod ili brisanje sa predmetom), `src/test/legacy*`, `generators.ts`, proročišta čiji je predmet obrisan, `ciScope.mjs` (bez `DISTANCES`/`V2_FOLDER`: domen V4 po folderu distance), `AGENTS.md` (bez v2/v1 odeljaka), `TEST-SPEED.md`, ponovno merenje `check:full` | `ciScope.node.test`, ceo `npm test` jednom, CI „sve" zelen | srednji |
| 6b | Adapteri v2 i ličnog plana + uzorci (§ 2c), posle potvrde zbirom i 14 dana. Čuvar starog formata, `discardLegacyPlan`, `isLegacyPlan` u `detect.ts` i 12 uzoraka `legacy-*` — kad zbir pokaže 0 naloga sa starim `genPlan` i prođe 40 verzija / 90 dana (istorija istisnuta) | `check`, `isolation.test`, E2E `v4.spec` | mali |
| 7 | Dupli kod u V4 sloju (§ 1c): `edits.ts` datumi → motor, `isPersonal` jedini, `toResolved`/`resolvePlan` → ekrani čitaju `PlanDoc` direktno (ako vlasnik želi; inače `resolvePlan` ostaje kao jedini prikaz) | otisci planova po distanci, E2E | srednji (bez prikaza) / veliki (sa prikazom) |

## 5. Rizici i šta se gubi
1. **Vraćanje nazad:** jedini put je prethodni Vercel deployment. Za v2 i vlasnika radi (`user_state` netaknut),
   ali ne vidi ništa urađeno u V4 posle prelaska. Obrisan stari plan samo iz rezerve. Korak 3 ≠ dan koraka 1.
2. **Pokrivenost E2E:** 16 testova u 6 spec-ova brani samo v2 put (`fivek-v2` 3, `tenk-v2` 3, `hm-v2` 4,
   `marathon-v2` 3, `handoff-v2` 2, `legacy-plan` 1). Uz njih, svih 15 spec-ova koji zovu `createPlan`/`runWizard`
   danas rade sa V4 isključenim (`backend.ts:124`). V4 put brani `v4.spec` (6 testova). Predlog: svaki tok se
   prevodi na V4 (čarobnjak V4, preuzimanje starog plana iz uzorka, kraća distanca kao događaj V4), a briše se tek
   kad prevedeni test prođe. „Kraća distanca" (`handoff-v2`) u V4 **[neprovereno]** postoji kao funkcija.
3. **Funkcije koje danas daje samo v2** (forma/VDOT lanac, prilagođavanje izvršenja, hod-trk, ulaz u kvalitet,
   trke/rekalibracija): ako V4 nema ekvivalent, korak 2 ih gubi. Popis po funkciji je prvi zadatak koraka 2
   **[neprovereno]**.
4. **Otisak „različit" nad stvarnim v2 planovima i ličnim planom:** nepoznat dok se ne pusti popisna skripta (§ 3).
   **Gubitak za korisnike starog formata (≈ 19 naloga po zbiru organizatora):** plan, unosi uz njega, izmene,
   procene i `vanPlana` se brišu (§ 2b); ostaju Strava trčanja u `aktivnost`, merenja, podešavanja. Vraćanje samo
   iz rezerve `rezerva_20261114`. Pogrešno pravilo bi obrisalo v2
   ili lični plan — zato pravilo na jednom mestu + test (§ 2b) i popis brojeva pre puštanja (§ 3).
5. **Proročišta/byteSame:** 32 proročišta upoređuju zajednički domen sa snimljenom starom aplikacijom
   (`legacy-recordings`, 3,9 MB). Ona ne štite generatore, osim 11 koja ih uvoze. Kad se predmet promeni
   (npr. VDOT u koraku 5), proročište pada namerno i briše se zajedno sa starim predmetom, nikad samo da bi bilo
   zeleno. `byteSame` (1) i `sameJson` (1) nestaju sa v2.
6. Gubi se: v2 generatori (66 875 redova koda), HM v1, mreže `check:full`, mogućnost „Generiši v2 plan".
   Planovi starog formata i podaci uz njih (odluka vlasnika).

## 6. Odluke vlasnika
Sve odluke su donete (15. 11. 2026, ≈ 09:50 i ≈ 09:55 po Beogradu) i upisane su u § 2b i § 2d. Otvorenih pitanja nema.
