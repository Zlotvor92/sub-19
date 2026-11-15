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
- v2 plan čija je trka prošla: preuzima se kao završen (istorija ostaje).
- **Lični plan:** `activeOf` daje `personalPlan(personalBaselineVdot(log))`, adapter ga prepoznaje (`meta.licni`)
  → `header.protected = true` (motor ga ne menja sam, čuvar samo upozorava, t. 8c). Pre upisa se briše
  `personalProtected`/`PERSONAL_PROTECTED_UNTIL`. VDOT zavisi od `log` u trenutku upisa, posle je fiksan u doc-u.
### 2b. Plan starog formata → ne preuzima se; korisnik pravi nov
- **(a) Prvo otvaranje:** umesto plana jedna poruka (kao današnji `LegacyPlanNotice`, ali bez prikaza plana): „Tvoj
  plan je napravio stari generator i više se ne prikazuje. Trčanja i forma ostaju. Napravi nov plan — traje minut."
  Dugme „Napravi nov plan" otvara V4 čarobnjak. Ekran nije prazan: Danas/Napredak i dalje rade nad trčanjima
  (Strava/`aktivnost`, `vanPlana`). E2E test za to se dodaje u koraku 2.
- **(b) `log` i forma:** predlog organizatora je prihvaćen. Trčanja ostaju: `aktivnost` (Strava, cela istorija, ne
  zavisi od plana) i `log` u `user_state`. Stari plan se ne prikazuje. Ručni unosi bez Strave postoje samo u
  `log` pod ID-jevima `g…`. Ne vide se uz plan (plana nema), ali se ne brišu. V4 dani imaju ID-jeve `w{n}d{wd}`
  (`engine/plan.ts:277`), pa nema sudara sa starim `g…` ključevima. Forma pod V4 dolazi iz `v4/fitness` (trčanja),
  ne iz starog `vdotLog`.
- **(c) Brisanje starog plana iz `user_state`, dva puta (SQL se NE izvršava):**
  1. *Na uređaju pri otvaranju:* aplikacija vidi `isLegacyPlan(genPlan)` i postavlja `genPlan: null` (bez
     `purgeGenPlanData`, da `log` ostane), pa `requestPersist`. **Rizik:** briše se tek kad se nalog otvori (nalozi
     koji se ne otvaraju ostaju sa starim planom zauvek); stari uređaj van mreže može kasnije da vrati stari
     `genPlan` upisom svog stanja; kod koji to radi mora da ostane u aplikaciji. **Prednost:** nema ručnog rada nad
     bazom.
  2. *Jednokratni SQL na bazi* (posle provere zbira, uz rezervu `rezerva_20261114`):
     `update user_state set data = data - 'genPlan' where data ? 'genPlan' and not (data->'genPlan' ? 'fiveKV2'
     or … 'tenKV2' or … 'hmV2' or … 'marathonV2') and coalesce(data->'genPlan'->'meta'->>'policyId','') not like '%-v2%';`
     (tačan uslov = `isLegacyPlan` prepisan u SQL i proveren na uzorcima pre puštanja). **Rizik:** uređaj sa
     keširanim starim stanjem može da ga vrati pri sledećem upisu (isti problem kao 1, pa i tu treba čuvar na
     uređaju); pogrešan uslov briše v2 plan (zato prvo `select count(*)` po vrsti, pa `update`); nema poništavanja
     osim iz rezerve. **Prednost:** jedan trenutak, svi nalozi odjednom, kod za stari format može odmah da ode.
  Predlog: **2 + čuvar na uređaju** („`genPlan` starog formata se ignoriše") dok se kod starog formata ne obriše.
- **(d) Trka još nije prošla:** isto pravilo (ne preuzima se). Iz koda se to može utvrditi: plan starog formata nosi
  `meta.raceDate` (proveren u svim uzorcima `legacy-*.json`), pa zbir „stari format, trka ≥ danas" daje jedan
  `select` (`data->'genPlan'->'meta'->>'raceDate' >= '2026-11-15'`). Koliko ih je u bazi ne znam (bazu ne čitam).
  Takvim korisnicima poruka iz (a) dodaje datum trke, a V4 čarobnjak se otvara sa trkom i datumom popunjenim iz
  `meta.raceDistM`/`raceDate` (samo predlog unosa; plan se pravi nov).
### 2c. Kada adapteri mogu da se obrišu
Adapter v2 (`v2.ts`), adapter ličnog plana (`personal.ts`), `detect.ts`, `fingerprintLegacy.ts`, `read.ts`,
`shared.ts`, `stimuli.ts` i uzorci trebaju samo za upis iz 2a. Predlog: brišu se kada (1) organizator potvrdi zbirom
iz baze da svaki nalog sa v2 `genPlan`-om (≈ 3) i vlasnik imaju red u `plan_v4`, i (2) prođe 14 dana bez grešaka
preuzimanja. Nalog sa v2 planom koji se do tada ne otvori postaje stari format (2b). Grana starog formata
(`legacy.ts` + uzorci) briše se odmah u koraku 2.

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
| 1 | Trajno preuzimanje SAMO v2 + lični plan (§ 2a), popisna skripta (§ 3), skida se `personalProtected`. E2E podrazumevano prelazi na V4 uključen (`backend.ts:124`). Stari tokovi dobijaju izričit `ukljuceno:false` | `npm run check`, `v4Store.test`, `adopt.test`, `integrations/v4/*`, E2E `v4.spec` + `owner.spec` + nov test „prvo otvaranje upisuje red, drugi uređaj ne piše" | srednji |
| 2 | Prikaz i funkcije bez v2 puta: 27 poziva `generatorForPlan` dobija V4 izvor (forma/VDOT ← `v4/fitness`, faza ← `doc.weeks[].intent`, lagan tempo/RPE ← `paceCtxOf`, prilagođavanje ← događaji V4, `tracksOffPlanRuns` ← uvek). Briše se grana „stari prikaz", zastavica `enabled` i `v4_pristup` u kodu. Stari format: poruka + čarobnjak (§ 2b a), uklanjanje `genPlan` (§ 2b c), brišu se `adapters/legacy.ts`, uzorci `legacy-*`, `test/legacyPlans`/`legacyAdapt` (24 testa: prevod ili brisanje). `select.ts` se smanjuje na ono što ostaje | sve E2E koje danas brane v2 put (16 testova) prevedene na V4 put **pre** brisanja (§ 5). Ekrani Danas/Plan/Napredak/Ti bez praznog stanja za nalog bez `genPlan` | **veliki** |
| 3 | Brisanje v2 generatora po distanci (5K → 10K → maraton → HM), sa `*V2Actions`, `onboarding/*V2`, `*V2Steps`, `Form*V2`, `ShorterDistanceDecision`, `LegacyPlanNotice`, granom `executionActions` | po distanci: `check`, `tsc -b`, `build`, otisci V4 planova te distance (`domain/v4/distances/<d>`) nepromenjeni, E2E | srednji ×4 |
| 4 | HM v1 (`halfMarathon/` van `v2/`), `domain/personal`, `data/personalPlan.ts`, `LEGACY_PERSONAL_GENERATOR`, `select.ts`/`contract.ts`/`handoff.ts` do kraja | vlasnikov red u `plan_v4` potvrđen u bazi (organizator, samo zbir). `adopt.test › lični plan` ostaje na `personal.json` | srednji |
| 5 | Zajednički ostaci: tipovi čitanja starog formata premešteni u adapter, `domain/plan/edit.swapDays`, deo `domain/training/vdot`, `VITE_V2_DEFAULT_ON` (`vercel.json`, `deploy/vercel.cutover.json`, `cutover.node.test.ts`). Izmena `vercel.json` je deploy konfiguracija i traži potvrdu vlasnika | `check`, `build`, `deploy/*.node.test` | mali |
| 6 | Testovi/fiksture/CI/dokumenti: 78 test fajlova (prevod ili brisanje sa predmetom), `src/test/legacy*`, `generators.ts`, proročišta čiji je predmet obrisan, `ciScope.mjs` (bez `DISTANCES`/`V2_FOLDER`: domen V4 po folderu distance), `AGENTS.md` (bez v2/v1 odeljaka), `TEST-SPEED.md`, ponovno merenje `check:full` | `ciScope.node.test`, ceo `npm test` jednom, CI „sve" zelen | srednji |
| 6b | Adapteri v2 i ličnog plana + uzorci (§ 2c), posle potvrde zbirom i 14 dana | `check`, `isolation.test`, E2E `v4.spec` | mali |
| 7 | Dupli kod u V4 sloju (§ 1c): `edits.ts` datumi → motor, `isPersonal` jedini, `toResolved`/`resolvePlan` → ekrani čitaju `PlanDoc` direktno (ako vlasnik želi; inače `resolvePlan` ostaje kao jedini prikaz) | otisci planova po distanci, E2E | srednji (bez prikaza) / veliki (sa prikazom) |

## 5. Rizici i šta se gubi
1. **Vraćanje nazad:** jedini put je prethodni Vercel deployment. Za v2 i vlasnika radi (`user_state` netaknut),
   ali ne vidi ništa urađeno u V4 posle prelaska. Stari format posle SQL-a samo iz rezerve. Korak 3 ≠ dan koraka 1.
2. **Pokrivenost E2E:** 16 testova u 6 spec-ova brani samo v2 put (`fivek-v2` 3, `tenk-v2` 3, `hm-v2` 4,
   `marathon-v2` 3, `handoff-v2` 2, `legacy-plan` 1). Uz njih, svih 15 spec-ova koji zovu `createPlan`/`runWizard`
   danas rade sa V4 isključenim (`backend.ts:124`). V4 put brani `v4.spec` (6 testova). Predlog: svaki tok se
   prevodi na V4 (čarobnjak V4, preuzimanje starog plana iz uzorka, kraća distanca kao događaj V4), a briše se tek
   kad prevedeni test prođe. „Kraća distanca" (`handoff-v2`) u V4 **[neprovereno]** postoji kao funkcija.
3. **Funkcije koje danas daje samo v2** (forma/VDOT lanac, prilagođavanje izvršenja, hod-trk, ulaz u kvalitet,
   trke/rekalibracija): ako V4 nema ekvivalent, korak 2 ih gubi. Popis po funkciji je prvi zadatak koraka 2
   **[neprovereno]**.
4. **Otisak „različit" nad stvarnim v2 planovima i ličnim planom:** nepoznat dok se ne pusti popisna skripta (§ 3).
   **Gubitak za korisnike starog formata (≈ 19 naloga po zbiru organizatora):** plan nestaje i prave nov. Ručni
   unosi bez Strave ostaju samo u `log` (nevidljivi uz plan). Ako se izabere SQL (§ 2b c 2), stari plan se vraća samo
   iz rezerve `rezerva_20261114`.
5. **Proročišta/byteSame:** 32 proročišta upoređuju zajednički domen sa snimljenom starom aplikacijom
   (`legacy-recordings`, 3,9 MB). Ona ne štite generatore, osim 11 koja ih uvoze. Kad se predmet promeni
   (npr. VDOT u koraku 5), proročište pada namerno i briše se zajedno sa starim predmetom, nikad samo da bi bilo
   zeleno. `byteSame` (1) i `sameJson` (1) nestaju sa v2.
6. Gubi se: v2 generatori (66 875 redova koda), HM v1, mreže `check:full`, mogućnost „Generiši v2 plan".
   Stari planovi ostaju čitljivi samo kroz adapter.

## 6. Pitanja za vlasnika („da" prihvata predlog)
1. v2 plan čiji se otisak razlikuje preuzima se kako ga adapter da, uz upozorenje u zaglavlju. Lični plan sa
   razlikom se ne upisuje bez vašeg „da". **Da?**
2. Stari plan briše se jednokratnim SQL-om (posle zbira i uz rezervu `rezerva_20261114`), uz čuvar na uređaju koji
   ignoriše `genPlan` starog formata. `log` i trčanja se ne brišu. **Da?**
3. `user_state` v2 korisnika i vlasnika (`genPlan`, `log`, `alts`, `moves`) ostaje nepromenjen kao arhiva i put
   nazad. Adapteri v2 i ličnog plana se brišu 14 dana posle potvrde da su svi redovi upisani. **Da?**
4. Popisnu skriptu (§ 3) i SQL pušta organizator uz vaše odobrenje u tom trenutku. `vercel.json` (korak 5) se menja
   tek uz potvrdu. Dokumentacija v2 (≈ 166 MB) se arhivira, ne briše. **Da?**
