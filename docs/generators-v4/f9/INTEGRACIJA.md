# F9 etapa 1: kako V4 ulazi u aplikaciju (priprema, ne ulazak)

Napisano 14. 11. 2026. oko 20:30 po beogradskom vremenu. Grana `claude/v4`, polazni commit `b73e0db2`. Etapa 1 ne menja
nijedan fajl aplikacije, ne piše u bazu i ne radi deploy. Oznake pouzdanosti: [visoka] znači da sam to pročitao u kodu na
navedenom mestu, [srednja] je izvod iz koda ili dokumenta, [niska] je procena. Gde piše „neprovereno", nisam proverio.
Odluke vlasnika iz F8 § 9 imaju prednost nad svim predlozima ovde.

## 0. Ključni nalazi

1. Strava uvoz radi samo na uređaju. Bez `genPlan` ne radi uopšte (`services/strava/stravaSync.ts:177`, poruka
   „Nema plana."). Gleda samo period od 28 dana pre početka plana (`:196`) i uzima najviše 4 × 100 aktivnosti (`:205`).
   OAuth tokeni nikad ne idu na server (`domain/state/types.ts`, polje `strava`). Zato i jednokratno povlačenje
   istorije za V4 mora da radi sa uređaja. [visoka]
2. Strava ograničava broj zahteva po APLIKACIJI, ne po korisniku (§ 4). Ako se uvoz istorije pokrene svima odjednom
   (§ 9.6, „sve odjednom"), to je usko grlo. [visoka za ograničenje, srednja za posledicu]
3. „Generiši nov plan" (`features/plan/planActions.ts:290`) zove `discardPlan` (`stores/actions.ts:63`). Taj poziv
   trajno briše `log`, `alts`, `moves`, `pred` i `vdotLog` vezane za plan. Pod V4 aktivnosti žive u posebnoj tabeli i to
   brisanje ne sme da ih dira, jer forma zavisi od istorije. [visoka]
4. Lični plan vlasnika se nikad ne upisuje u `genPlan`. Aplikacija ga računa iz koda (`activeOf`,
   `stores/trainingStore.ts:165`, `useActiveGenPlan` `:181`, `meta.licni`). Adapter za njega već postoji
   (`domain/v4/adapters/personal.ts`). [visoka]
5. Motor nema javnu funkciju koja ručnu izmenu ili premeštanje upisuje u `PlanDoc`. Postoji samo događaj
   `manual-edit {dayId}`: `replan` preslaže ostatak nedelje (`engine/replan.ts:1725–1760`) za dan koji je već
   `origin: 'manual'`. Upis datuma, `movedFrom`, `origin` i `base` zato mora da uradi sloj (§ 2d), ili tim V4 da doda
   pomoćnu funkciju u motor. Odluka pripada organizatoru (pitanje 3). [visoka]

## 1. Šavovi u aplikaciji

V4 se ubacuje na ovim mestima. Tip izmene: E = ekran, S = stanje/store, Sv = servis.

| šav | gde je danas (putanja:red) | šta V4 tu treba | tip |
|---|---|---|---|
| pravljenje plana | čarobnjak `features/onboarding/Wizard.tsx` (`generate*V2Plan` 86/99/112/149, `activateNewPlan` 141) → `stores/actions.ts:17` | na zastavicu se zove `v4/plan` (§ 2a) umesto `generate*V2Plan`; rezultat se upisuje u `plan_v4`, ne u `genPlan`. Upozorenja (AGENTS t. 6) se prikazuju pre potvrde | E+S |
| „Generiši nov plan" | `planActions.ts:290` → `discardPlan` `actions.ts:63` | pod V4: arhivira se stari `plan_v4`, a `aktivnost` se ne briše. Stari `genPlan` se ne dira (vraćanje nazad) | S |
| čuvanje plana | `genPlan` u `user_state.data` (`domain/state/types.ts:193`), store `TRAINING_KEYS` (`stores/persistence.ts:40`) | `plan_v4` (`doc` + `rev`) kroz poseban servis. `user_state` se ne menja (§ 9.2) | Sv |
| čitanje plana (jedno mesto) | `useActiveGenPlan` / `useResolvedPlan` / `currentPlan` (`stores/trainingStore.ts:181/194/202`) → `resolvePlan` (`domain/plan/resolve.ts:52`) | grananje samo ovde: sa zastavicom `ResolvedPlan` dolazi iz `PlanDoc` (§ 2b). Svi ekrani (`PlanOverview`, `DayScreen`, `SwapSheet`, `AltSheet`, `RaceAnalysis`, `AdjustPlan`) čitaju preko ovih kukica [visoka za popis kroz grep] | S |
| `log` (unos dana) | `stores/dayActions.ts` (`setStatus` 27, `editField` 33, `deleteEntry` 104), `features/today/EntryForm.tsx`, `DayEntry.tsx` | unos se dalje piše u `log` (oznaka „ručno ispravljen unos" ostaje, § 9.5). Sloj iz njega izvodi `Run` po `dayId` (§ 2a). Ručni unos trčanja van plana se upisuje i u `aktivnost` | S |
| `moves` (premeštanje) | `swapDays` `stores/trainingStore.ts:110` → `domain/plan/edit.ts:20`, ekran `features/plan/SwapSheet.tsx` | pod V4 se premeštanje ne upisuje u `moves`. Postaje izmena `PlanDoc` + događaj `manual-edit` (§ 2d) | S |
| `alts` (zamena treninga) | `features/plan/AltSheet.tsx`, `alts` u `TRAINING_KEYS` | isto kao premeštanje: dan dobija `origin:'manual'` i `base` = stari trening | S |
| `user_state` / sinhronizacija | jedan JSON po korisniku. Pravilo „poslednji upis pobeđuje" uz pitanje kad je tuđi upis noviji (`domain/sync/decide.ts:20,41`). Upis posle 4 s mirovanja (`:81`). Najviše 40 verzija (`supabase/istorija.sql:88–95`) | ne menja se. Za `plan_v4` važi poređenje po `rev` (§ 3), za `aktivnost` „ubaci ili zameni" | Sv |
| Strava uvoz | `stravaSync.ts` 152–436 (spisak 196–216, detalji po km i krugovi samo za dane plana), poziva ga `app/integrations.ts:164,240` | nov korak „aktivnosti" pre uparivanja sa planom: sva trčanja u `aktivnost`, i bez plana. Jednokratno povlačenje istorije (§ 4) | Sv |
| van plana | `vanPlana` (datum → km, `recordOutOfPlan` `stravaSync.ts:228`), `vanPlanaV2` samo uz v2 plan (`tracksOffPlanRuns`, `domain/generators/select.ts:1083`) | adapter ih samo čita za stare planove. Pod V4 izvor je `aktivnost` | — |
| bol / umor | `knee` (`domain/state/types.ts:184`), `wellness`, store `RECOVERY_KEYS` (`persistence.ts:50`) | sloj ih čita kao `pain` / `painHistory`. Prijavljeni događaj ide u `plan_v4_dogadjaj` | S |
| stari plan | `isLegacyPlan` (`domain/generators/select.ts:1017`), `features/plan/LegacyPlanNotice.tsx`, `features/today/Advisories.tsx:37` | sa zastavicom: obaveštenje „plan sada prati novi motor, ništa nije promenjeno" (F8 § 5); preuzimanje kroz `adopt` (§ 2e) | E |
| prilagođavanje v2 | `features/plan/AdjustPlan.tsx` (51, 174), `*V2Adjustment.tsx`, `planActions.ts` 47–263 | sa zastavicom se skrivaju. Novo: traka promena i „Zašto se promenilo", „Nešto se desilo?", pregled sa dugmadima „Primeni" / „Ne menjaj" za prijavljene događaje (§ 9.1) | E |
| forma / tempa | `pred`, `vdotLog`, `t3k` u `TRAINING_KEYS` | kartica Forma: `fitness.estimateForm` + `header.form` iz `PlanDoc`. `pred` i `vdotLog` ostaju samo za v2 | E |
| vlasnik | `useIsOwner` / `isOwnerNow` (`stores/owner.ts`) odlučuju samo o prikazu. Server proverava `ADMIN_EMAIL` (`api/broadcast.js:77`) | zastavica V4 se ne izvodi iz ovoga, nego iz serverske tabele (§ 5) | Sv |
| brisanje naloga | `TABELE` u `api/delete-account.js:109`, `supabase/brisi-nalog.sql:55` | dodati 4 nove tabele. Postoji test koji pada ako se zaborave (komentar `delete-account.js:105–108`) [visoka za komentar, test neproveren] | Sv |

## 2. Sloj između aplikacije i V4

Predlog: folder `web/src/integrations/v4/`, van `domain/v4/**`. Jedini on uvozi javne ulaze `engine/index.ts`,
`adapters/index.ts`, `fitness/index.ts` i `distances/*/index.ts`. Motor ostaje čist i ne zna za aplikaciju. Ovo su
samo potpisi; koda još nema.

```
facts.ts     toFacts(app: AppSnapshot, activities: Run[], today: IsoDate): RunnerFacts
             toGoal(app: AppSnapshot): Goal
             distanceData(goal: Goal): DistanceData            // hm | tenk | fivek | marathon, po distanceM
runtime.ts   makePlan(app, acts, today): { doc: PlanDoc; warnings: Warning[]; inputErrors }   // buildState → plan
             refresh(doc, app, acts, events, today): ReplanResult                            // buildState → deriveEvents → replan
view.ts      toResolved(doc: PlanDoc, log: Record<string, LogEntry>): ResolvedPlan          // renderPlan + oblik ResolvedPlan
events.ts    classify(e: PlanEvent): 'sam' | 'pregled'                                       // § 9.1
             reported(kind, payload, today): PlanEvent                                       // „Nešto se desilo?"
edits.ts     applyMove(doc, dayId, toDate): PlanDoc     applyEdit(doc, dayId, w: Workout|null): PlanDoc
adopt.ts     adoptActive(state: PersistedState, isOwner, today): AdoptResult                // adapters.adopt
store.ts     usePlanV4(): { doc, rev, status }    savePlan(doc, rev): 'ok' | 'conflict'
```

- **(a) Ulaz motora.** `toFacts` je jedini sastavljač (F8 § 6.4). Polja:
  - `today`: današnji datum po Beogradu.
  - `availability` i `profile`: iz čarobnjaka.
  - `runs`: iz tabele `aktivnost`. Za stari plan im se dodaju `log` i `vanPlana`, preko `adopt(...).facts`.
  - `pauses`: iz prijava.
  - `pain`: iz `knee`.

  `Run.planned` popunjava `buildState` iz `doc` (`engine/types.ts:1052–1059`). [visoka]
- **(b) `PlanDoc` → ekrani.** `toResolved` vraća današnji `ResolvedPlan` (`domain/plan/types.ts:21–73`): `id`, `w`,
  `date`, `origDate` ← `movedFrom`, `tag` ← `workout.kind`, `km`, `desc` ← `renderPlan`. Tako postojeći ekrani rade bez
  prepravke. Zaglavlje (upozorenja, forma, raspon na dan trke) dobija nove kartice. Rizik: `tag` i `DayTag` se ne
  poklapaju 1:1 (`lr`, `trka`, `lako`…). Zato je potreban test mapiranja nad sve četiri distance. [srednja]
- **(c) Događaji (§ 9.1).** Bez pitanja se primenjuju događaji koje izvede `deriveEvents` (`form-update`, `result`,
  `missed`, izvedena `pause`, `fatigue/opterecenje`); u traci piše razlog. Prijavljeni događaji (`pain`,
  `fatigue/trkac`, `pause` iz prijave, `goal-change`, `availability-change`) prvo prolaze kroz `replan` „na suvo": kao
  pregled se prikažu `changes`. „Primeni" upisuje i doc i događaj. „Ne menjaj" upisuje događaj tipa `odbijeno`, koji
  se posle više ne primenjuje (F8 § 6.6b). Primena je idempotentna jer je `PlanEvent.id` deterministički
  (`engine/types.ts:585`). [visoka za id]
- **(d) Premeštanje i ručna izmena (§ 9.5).**
  - `applyMove` za dan postavlja `date`, `movedFrom` = stari datum i `origin:'manual'`; `applyEdit` postavlja
    `base` = stari trening.
  - Zatim se emituje `manual-edit {dayId}`, a `replan` preslaže samo ostale dane te nedelje koje sme da menja
    (`engine/build.ts:114`: ne dira `protected`, prošlost, `manual`, `locked`).
  - Urađen dan štiti `doneIds` (`engine/done.ts`).
  - „Ubuduće dugi subotom?" posle dve nedelje zaredom: brojanje se radi nad događajima `manual-edit` u
    `plan_v4_dogadjaj`, ponuda je `availability-change`.
- **(e) Preuzimanje.** Ulaz je `adopt(stanje, today)` (`adapters/detect.ts:36`), rezultat
  `{doc, facts, carried, fallbackDays}`. Pravilo AGENTS t. 8a je da se otisak ne menja:
  `fingerprintLegacy(staro) === fingerprint(doc)` mora da važi pre prvog upisa u `plan_v4`. Ako se razlikuju, plan se
  NE preuzima; ostaje stari prikaz i prijavljuje se nalaz. Lični plan dobija `header.protected = true` do 13. 12. 2026.
  [srednja: tačan oblik poređenja otisaka proveriti u `adopt.test.ts`]

## 3. Baza (nacrt, ne izvršava se)

Nacrt je u `nacrt-tabele.sql`: tabele `aktivnost`, `plan_v4`, `plan_v4_verzija`, `plan_v4_dogadjaj` i
`v4_pristup`. `user_state` i v2 podaci se ne diraju (§ 9.2).

| tabela | ko piše | ko čita | veličina po korisniku | nazad |
|---|---|---|---|---|
| `aktivnost` | uređaj vlasnika naloga, „ubaci ili zameni" po (`user_id`, `id`) | svoj red; service_role | ≈ 19 KB [niska, F8 § 6.1] | `drop table`; trčanja ostaju na Stravi i u `log` |
| `plan_v4` | uređaj, uslovni upis `rev = videni` | svoj red | 24–41 KB [visoka, F8 § 6.2 mereno] | zastavica isključena → app čita `genPlan` kao danas |
| `plan_v4_verzija` | samo okidač (security definer), najviše 10 | svoj red | ≤ 10 × 41 KB ≈ 0,4 MB [niska] | vraćanje verzije = upis starog `doc` kroz `rev` |
| `plan_v4_dogadjaj` | uređaj, samo dopisivanje | svoj red | ≈ 100 B × broj događaja [niska] | ne briše se; ponovni `replan` ga čita |
| `v4_pristup` | service_role (ili vlasnik kroz SQL); korisnik samo isključuje (RPC) | svoj red | 1 red | `update ... set ukljuceno=false` |

RLS je po uzoru na `supabase/user-state.sql:231–245` (svaka politika `auth.uid() = user_id`) i `supabase/istorija.sql`
(istoriju piše samo okidač, nema politike za izmenu). Tabele treba dodati u `api/delete-account.js` `TABELE`, u
`brisi-nalog.sql` i u `provera.sql`.

## 4. Strava

**Šta uvoz danas vuče** [visoka, `stravaSync.ts`]:
- Spisak `/athlete/activities?after=…&per_page=100`, najviše 4 strane, od 28 dana pre početka plana.
- `/athlete/zones` najviše jednom nedeljno.
- Streamovi (`distance,time,heartrate,…,temp`) i `/activities/{id}/laps` samo za dane plana i samo jednom po treningu.
- `StravaActivity` (`domain/activities/stravaImport.ts:12`) ne čita `workout_type` (oznaka trke), `elapsed_time` ni
  `start_date`.

**Šta § 9.3 traži:**
- Što dužu istoriju; najmanje 26 nedelja kao sažetak.
- Podelu po km za poslednjih 8 nedelja.
- Sva trčanja, ne samo dane plana.
- Oznaku trke.

**Ograničenja Strava API-ja.** Proverio sam ih 14. 11. 2026. veb pretragom; rezime zvanične stranice
<https://developers.strava.com/docs/rate-limits/>. Stranicu nisam otvorio direktno.
- Ograničenje važi po aplikaciji. Ukupno: 200 zahteva na 15 min i 2000 dnevno. Čitanje: 100 zahteva na 15 min i
  1000 dnevno. [srednja]
- <https://developers.strava.com/docs/getting-started/> navodi veće limite kad aplikacija pređe 10 sportista. Dve
  stranice se razlikuju, pa važeći broj treba pročitati u podešavanjima API aplikacije. [srednja]
- Prozor od 15 min se resetuje na :00, :15, :30 i :45. Dnevni limit se resetuje u ponoć UTC, tj. u 1:00 po Beogradu
  zimi. [srednja]
- Zaglavlja `X-ReadRateLimit-Limit/Usage` nose oba broja, a Strava za povlačenje istorije preporučuje usporavanje po
  tim zaglavljima. Današnji `stravaApi.ts:123` zna samo za 429. [srednja za zaglavlja, visoka za kod]
- Najveći `per_page`: 200, po zajednici i generisanim klijentima, ne po zvaničnoj stranici. [niska]
- Neprovereno: koliko unazad spisak sme da ide (da li postoji granica istorije), da li `SummaryActivity` nosi
  `workout_type`, i šta uslovi korišćenja Strava API-ja kažu o čuvanju podataka na serveru.

**Posledica** [niska, računica iz gornjih brojeva, ne merenje]:
- Po korisniku: spisak 26 nedelja je 1–2 zahteva. Podela po km za 8 nedelja, oko 5 trčanja nedeljno, je ≈ 40 zahteva
  za streamove. Ukupno ≈ 40–45 zahteva.
- Uz limit čitanja od 100 na 15 min, to su 2 korisnika po prozoru, za celu aplikaciju zajedno.

**Predlog:**
- Prvo povlačenje istorije radi u delovima: prvo sažeci (jeftino), pa podela po km najnovije unazad.
- Zahtevi idu sa uređaja, ne više od ≈ 20 po pokretanju, uz praćenje zaglavlja.
- Prekinuto povlačenje se nastavlja pri sledećem otvaranju aplikacije, a forma u međuvremenu radi sa onim što ima
  (AGENTS 9a).

## 5. Zastavica i vraćanje nazad

- **Paljenje.** Tabela `v4_pristup(user_id, ukljuceno, od)`. Klijent je čita jednom pri pokretanju; red postoji samo za
  vlasnika. Odluka § 9.6 („sve odjednom") važi za korisnike, a zastavica služi samo dok traje priprema i proba na
  vlasniku. Kad se uđe, isti mehanizam se uključuje svima jednim SQL upisom, bez novog deploya. [srednja]
- **Bez reda ili bez mreže** → V4 je isključen. Odluka se kešira lokalno samo za prikaz; ako lokalna vrednost i server
  ne daju istu odluku, važi isključeno.
- **Šta gašenje vraća.** Sa ugašenom zastavicom app je bajt-isti kao danas: V4 nikad ne piše u `genPlan`, `log` ni u
  `alts`/`moves` dok je zastavica uključena (§ 1), a `user_state` se ne dira.
  - Gubi se samo ono što je pod V4 rađeno u `plan_v4`: premeštanja i prijave. To ostaje u bazi i vraća se kad se
    zastavica ponovo upali.
  - Trčanja se ne gube (Strava + `log`).
  - Izuzetak: dan koji je korisnik pod V4 premestio, u starom prikazu stoji na starom datumu.
- **Lični plan vlasnika.**
  - Do 13. 12. 2026. ostaje računat iz koda (`activeOf`). V4 ga preuzima samo za čitanje, sa `protected: true`
    (`engine/build.ts:114` tada ne menja nijedan dan); predlozi stižu kao tekst.
  - Ništa se ne upisuje u `genPlan` ni u zamrznut HM v1.
  - Sledeći plan vlasnika (cilj 17. 4. 2027.) pravi V4 uz pregled vlasnika (§ 9.4).

## 6. Redosled rada (etapa 2 i dalje)

Svaki korak je jedan commit na `claude/v4`. Nijedan ne ide u `main` bez izričite potvrde vlasnika.

| # | šta se menja | brani ga | potvrda vlasnika | veličina |
|---|---|---|---|---|
| 1 | `integrations/v4/facts.ts` + `view.ts`, čiste funkcije, bez ekrana | jedinični testovi: `toFacts` nad fiksturama `src/test/legacyPlans.ts`; `toResolved` nad četiri distance (tag, km, datumi); test izolacije (uvozi se samo javni ulaz V4) | ne | srednji |
| 2 | `adopt.ts` + test otiska: postojeće fiksture + lični plan → otisak pre = posle | `adopt.test.ts` + nov test nad stvarnim oblicima iz aplikacije | ne | mali |
| 3 | `edits.ts` + `events.ts` (premeštanje, ručna izmena, podela na „sam" i „pregled") | testovi svojstava: urađen ili zaključan dan se ne menja; determinizam; dvostruka primena istog događaja nema efekta | ne | srednji |
| 4 | Strava korak „aktivnosti" iza zastavice (bez plana, istorija u delovima, praćenje zaglavlja) | `stravaSync.oracle.test.ts` mora ostati zelen sa ugašenom zastavicom + nov test za usporavanje | ne za kod; da za pravu Stravu | srednji |
| 5 | Supabase GRANA: `nacrt-tabele.sql` → migracija, `provera.sql`, `delete-account` | `supabase/tests`, provera RLS-a pod drugim korisnikom | **da** (baza; odobreno u § 9.2, izvršava se tek na „kreni") | mali |
| 6 | `store.ts` + servis `plan_v4` (`rev`), zastavica `v4_pristup` | testovi sukoba: dva uređaja, isti doc → nema sukoba; različite radnje → ponovna primena | ne | srednji |
| 7 | grananje u `useActiveGenPlan`/`useResolvedPlan`/`currentPlan`; čarobnjak i „Generiši nov plan" pod zastavicom | sa ugašenom zastavicom svi postojeći UI i E2E testovi zeleni; sa upaljenom E2E za sve četiri distance | ne | veliki |
| 8 | ekrani: upozorenja pre generisanja, Forma, traka promena, „Nešto se desilo?", pregled sa „Primeni" | E2E dirnutih ekrana, `npm run build` | ne | veliki |
| 9 | deploy sa zastavicom samo za vlasnika; senka nad bazom (samo SELECT) i merenje iz F8 § 7 | otisak 100 %, čuvar 0 nalaza | **da** (deploy, `main`) | mali |
| 10 | uključenje svima + kasnije gašenje v2 | merenja iz koraka 9 | **da** | mali (kod), veliki (posledice) |

## 7. Otvorena pitanja za vlasnika (odgovor „da" prihvata predlog)

1. **Zastavica pre ulaska.** Predlog: iako je odluka „sve odjednom", V4 prvo radi nekoliko dana samo tebi (red u
   `v4_pristup`). Posle toga se jednim SQL upisom uključuje svima. Sa „ne" se preskače proba na produkciji.
2. **Uvoz istorije pri ulasku.** Predlog: istorija se povlači postepeno, po korisniku, pri otvaranju aplikacije (≈ 20
   zahteva po pokretanju). Forma je prvih dana zasnovana na kraćoj istoriji i to piše u objašnjenju. Razlog: Strava
   limit važi za celu aplikaciju (§ 4).
3. **Ko upisuje ručnu izmenu u `PlanDoc`.** Predlog: sloj aplikacije (`edits.ts`), a motor se ne menja. Sa „ne" tim
   V4 dodaje `applyManualEdit` u `engine/`, pa ulazak čeka tu izmenu.
4. **„Generiši nov plan" pod V4.** Predlog: stari `plan_v4` se arhivira u `plan_v4_verzija`, a trčanja i istorija forme
   ostaju. Danas se `log` i forma vezani za plan trajno brišu.
5. **Plan koji ne prođe proveru otiska.** Predlog: takav korisnik ostaje na starom prikazu, a nalaz dobija organizator;
   nema delimičnog preuzimanja.
6. **Strava zaglavlja i uslovi.** Predlog: pre koraka 4 pročitati važeće limite u podešavanjima Strava API aplikacije i
   uslove čuvanja podataka. Za to je potreban tvoj pristup nalogu programera; ja tom nalogu nemam pristup.

## 8. Rizici

| rizik | šta pukne | odbrana |
|---|---|---|
| sinhronizacija „poslednji upis pobeđuje" (`decide.ts:41`) | dva uređaja: jedan premesti dan, drugi primi izvedeni događaj → jedan od dva upisa nestane | `plan_v4` ima uslovan upis po `rev`. Isti doc = isti otisak = nije sukob (F8 § 6.3). `user_state` se ne koristi za V4 |
| istorija od 40 verzija | da je plan u `user_state`: 40 × (37 + 60) KB ≈ 4 MB po korisniku [srednja, F8] | posebne tabele; `plan_v4_verzija` najviše 10 |
| veličina dokumenta | 41 KB za 18 nedelja; maraton od 24+ nedelje veći [niska]; računanje na telefonu nije mereno | meriti u koraku 9 (prag < 50 KB, < 200 ms, F8 § 7); ako se prag pređe, čuvaju se samo nedelje koje nisu prošle + otisak prošlih |
| stari planovi bez generatora (19 u bazi, F8 § 5) | adapter za neki oblik da drugačiji otisak | korak 2 + pitanje 5: bez otiska nema preuzimanja |
| Strava limit po aplikaciji | uvoz istorije pri ulasku → 429 svima, i v2 korisnicima | uvoz u delovima, praćenje zaglavlja (§ 4), pitanje 2 |
| uvoz zahteva `genPlan` (`stravaSync.ts:177`) | korisnik bez plana nema istoriju, pa ni formu na prvom planu | korak 4: aktivnosti se uvoze nezavisno od plana |
| `discardPlan` briše `log` | nov plan pod V4 izgubi trčanja iz forme | `aktivnost` se ne briše; pitanje 4 |
| mapiranje `workout.kind` → `DayTag` | ekrani dana (unos, Strava uparivanje po `d.tag`, `stravaSync.ts` streamovi za `lako/lr/trka`) se ponašaju pogrešno | test mapiranja u koraku 1; uparivanje pod V4 ide po `Run.dayId`, ne po `tag` |
| lični plan vlasnika | V4 ga dirne pre 13. 12. | `header.protected` + test zaštite (`engine/protection.test.ts` postoji) + preuzimanje samo za čitanje |
