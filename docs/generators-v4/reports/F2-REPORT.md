# F2 — izveštaj: motor V4 (12. 11. 2026)
## Šta je urađeno
`web/src/domain/v4/engine/` (≈ 4 300 redova koda + 2 700 testova i test-podataka), bez ijednog uvoza van foldera:
`constants.ts`, `vdot.ts` (prvi commit 5c7e09e) · `dates.ts`, `format.ts` (množina, datumi, decimalni zarez) ·
`load.ts` (`summarize`, `runLoad`, sredine 42/7) · `formFallback.ts` (procena iz izjave iza `EstimateFormFn`) ·
`state.ts` (`buildState`) · `template.ts` (`expandTemplate`, nivo, šablon) · `decide.ts` (vrh, plafoni, dugi, dani) ·
`select.ts` (doza, izbor, koraci, tekst; „recept" dana) · `build.ts` (JEDAN prolaz kroz nedelje: `weekTarget` →
`longPlan` → `fastBudget` → `easyFill` → spremnost; `isMutable`) · `readiness.ts` (`applyReadiness`, § 6.5 + § 14.1) ·
`plan.ts` · `events.ts` (`deriveEvents`) · `replan.ts` (kandidat po događaju + objašnjenja § 10) · `guard.ts`
(`validate`, `guard`, `warnings`) · `render.ts` (`renderPlan`) · `fingerprint.ts` · `index.ts`.
`plan` i `replan` zovu isti prolaz; dan se gradi iz namere + `decisions` + `adjustments`, pa je ponovno građenje
idempotentno. Sintetičke distance: `testdata/synthetic.ts` (8 km, 2 šablona, 10 unosa) i `testdata/example.ts`
(21 097,5 m, podešena po § 12 (a)). Primeri ispisa: `docs/generators-v4/plans/SYN/` (3 plana).
## Testovi (projekat `domain`): 9 fajlova, 112 testova, ≈ 1,9 s
Determinizam na mreži od 224 ulaza (dani 1–7 × 12 dužina 1–30 ned × 4 profila × start u rampi/van nje) · stabilnost
(`[]`, `none`, primenjen događaj, `deriveEvents` bez novosti, 45 dana trčanja po planu dan za danom) · zaštita za
15 događaja (prošlo, urađeno, ručno, zaključano, dan trke, `protected`) · čuvar na mreži · odbijanje samo § 8.1
(14 slučajeva) · 42,2 km za 3 nedelje, 1 dan, 5 km → plan + 5 upozorenja · primeri § 12 (a), (b), (d), § 14.1 ·
K1–K5 nad `renderPlan` · izolacija (čita izvor). Primer (a) se poklapa sa SPEC-om: vrh 245 BO, plafoni 26,9 / 36,7 /
17,1 / 39,2 min, dugi 103 min, nedelja 1 = 181 BO i 28,4 km, raspon 1:38:25–1:40:00–1:41:59.
`typecheck`, ESLint, Prettier čisti; `src/domain/isolation.test.ts` zelen (pravila domena važe i za `v4`, bez izmena).
**Nalazi čuvara dozvoljeni na mreži** (ulaz ih traži): 1–2 dana (`ispod-cilja`, `min-nedelja`, `brz-udeo`, `skok`,
`taper`, `lagan-dugi`); 3 dana (`ispod-cilja`, `min-nedelja`); obim po danu > 70 ili < 25 BO (`ispod-cilja`,
`lagan-dugi`); start u rampi (`ispod-cilja` do 4. nedelje). Nikad: doza, dugi, prazan, uzastopni teški, trka.
## Izmene tipova (`types.ts`)
`Paces.easy` (E 66 % za račun km) · `PlanWeek.longSec` (odlučen dugi pre spremnosti; adapter: najduži dan) ·
`PlanHeader.adjustments?` + tip `Adjustment` (uzroci spremnosti i ponovljena doza) · `MainSet` continuous / split /
finish-block / progressive: opciono `by: 'trajanje' | 'duzina'` + tip `WorkUnit` · `BuildStateFn` 4. i 5. argument
(`estimate?`, `doc?`) · po dopunama: `Run.planned?`, `Run.tempC?`, `profile.birthYear?`, `RunnerFacts.painHistory?`,
`Adjustment` pauze nosi `reason?`, a napor/pauza/bol `lastLongSec?`. Značenje postojećih polja nije menjano.
## Odstupanja od SPEC-a (sa razlogom)
1. **`adjustments` u zaglavlju.** § 1.3 kaže „dan iz namere + decisions"; da bi kasniji događaj izgradio isti dan,
   uzroci (napor, pauza, bol, umor, ponovljena doza) moraju da se pamte. Upisuju se samo uz primenjen događaj.
2. **Dodatak ide PREKO laganog dela** (4,5 km + ≈ 1 km ubrzanja): iz cilja se oduzima ceo dodatak (≈ 8 BO), ne
   2,7 kao u (a); plafon dana važi za ceo dan. Razlog: K5. Ispis: tempo samo za zone rada, u zagradi iza teksta.
3. **„Prvi kvalitet posle rampe × 0,8"** važi 14 dana posle rampe (`POST_RAMP_FIRST_DAYS`), posebno za blok u dugom
   i za kvalitet. Bez roka bi smanjilo podražaj koji se prvi put javi mesecima kasnije.
4. **Izvedena pauza** nastaje u `deriveEvents` (i u `buildState` kad dobije `doc`); današnji dan se ne sudi.
5. **`availability-change`** čuva namere nedelja i menja samo raspored dana i najduži dugi; **`goal-change` (datum)**
   razvija šablon na (prošle + preostale) nedelje i uzima kraj, vrh i plafoni ostaju. Doslovno „plan od sutra" bi
   usred pripreme vratio fazu i obim na početak. Promena distance: sve iznova po novim podacima.
6. **Nepotpune nedelje:** cilj × (dostupni dani trčanja / svi). U nedelji trke sidro rasporeda je dan trke; dan pre
   trke je lagano ≤ 20 min ili odmor, bez dodatka (§ 6.2 k. 10 to ostavlja šablonu, a šablon ne zna dan trke).
7. **Pravilo rasta** koristi planirano POSLE spremnosti (stvarno za prošle nedelje); pre plana `B` — kao u (b).
8. **`warnings` prima objekat** `{ state, goal, data, decisions, doc }`: vrh u km i najduži dugi se čitaju iz
   izgrađenog plana. Suvi poziv pre generisanja = `plan()` (čist i brz). Dodato upozorenje `bol` (nivo ≥ 7).
9. **§ 14.6 (ugrađeno posle prve isporuke):** rampa po razlogu (2,0 / 1,0 / 1,5 × dani, do 28), dugi u rampi
    ≤ 75 %, blok tek posle dugog bez bloka ≥ 90 % pa od najnižeg koraka lestvice, izveden umor traži i 7 dana
    ≥ 1,2 × B. Moja tumačenja: „poslednji odrađeni dugi" = najduže trčanje (bez trke/testa) u 28 dana pre uzroka
    (dugi rasterećenja ne spušta plafon); pravilo bloka se gasi 42 dana posle pauze; buduće duge računam kao
    odrađene, prošle samo ako imaju trčanje. Primer (b) je sada rampa 14 dana.
10. **Sitno:** opterećenje odrađenog trčanja koristi prag TEKUĆE forme; seme baze bez `weeklyKm` je prosek istorije;
    šablon bez pogotka → najbliži istog nivoa (izuzetak samo kad `templates` nema nijedan šablon). Zaokruživanje: dugi naniže (0,5 km / 5 min); blok ≤ polovine dugog; broj deonica tako da rad ≤ plafon + 90 s.
## Zapažanja (nisu odstupanja, traže pažnju)
- Jedna trka u retkoj istoriji (bez ostalih trčanja) podiže bazu ≈ 16 % (§ 5.3 doslovno) → F4/F9.
- Trčanje bez krugova se boduje po prosečnom tempu: dan kvaliteta vredi ≈ 8 % manje od planiranog, pa pravilo rasta
  posle pauze veže jače (u (b) 155 umesto 169 BO za 4. nedelju).
- Ostatak laganog budžeta ispod `minEasySec` propada (§ 6.2 k. 7): sa 3 dana, dugi sa blokom + jak kvalitet izbace
  lagan dan. U smanjenoj nedelji blok u dugom prvi troši budžet, pa kvalitet usred nedelje može da otpadne.
## Šta F3 (podaci distance) mora da zna
**Polja koja određuju obim po nedeljama:** `template.startPct` (`P = B / startPct`), `WeekIntent.loadPct`
(tail + cycle), `body[].share`, `recoveryEvery`, `recovery.loadFactor`, `safety.maxWeeklyRampPct`, `minRampLoad`
(samo `build`/`peak`), `peakLoadCap[nivo]`, `levels`. **Raspodela unutar nedelje (km):** `longMaxSec[nivo]`,
`longShareByRunDays`, `longStepSec`, `longStartShare`, `LongSlot.lenPct`; `doseCaps`, `progression`, `dosePct`,
`minDoseSec`, `maxFastShare(Peak)`; `minEasySec`, `easyMaxShareOfLong`, `dayBeforeLongMaxShare`; `warmupCooldown`;
`presentation.byDurationAboveSecPerKm`.
**„Nedelja 1 ≈ sadašnji km":** `B = km × E tempo / 60` (30 km × 5:52 = 176 BO); cilj 1. nedelje = `loadPct₁ × B /
startPct`. Minut praga vredi 2 BO, pa nedelja sa kvalitetom ima manje km za isto BO: `loadPct₁ ≈ startPct × 1,03`
daje 28,4 km (primer: 0,72 / 0,74), `× 1,04` daje 29,5 km (sintetička: 0,75 / 0,78); za tačno 30 km `× 1,06–1,08`.
Ostalo: svaki podražaj kvaliteta i bloka mora imati red u `doseCaps` (inače doza 0 → lagan dan); blok je unos
`kind: 'long'` sa svojim podražajem; `stimuli[k]` ide na `qualityDays[k]`; za ≤ 3 dana treba lakši šablon; deonice
neka imaju `requires.minDoseSec`; tekstovi `{n} {rep} {dose} {rec} {len}`, opciono `race`, `faza.<id>`, `napor.<zona>`.
## Šta F4 i F5 moraju da znaju
**F4:** `buildState(facts, goal, data, estimateForm, doc?)`; motor ne uvozi `fitness/`. Procena se poziva dva puta
(`planned: null`, pa `{ baseLoad, peakLoad }`) i dobija trčanja sa `planned` i pauze izvedene iz plana kad je `doc` dat. Zaglavlje nosi snimak; `form-update` izvodi `deriveEvents` (0,5 VDOT, pouzdanost ≥ srednja, 14 dana);
`result` menja tempa odmah od 0,3. Brojevi § 7.5 su samo u `formFallback.ts`.
**F5:** adapter popunjava `PlanWeek.longSec`, `Paces.easy`, `eventsFrom = today`; `adjustments` izostavlja. Na događaj
se dan u prozoru gradi iz izvedene namere: `intent.stimuli[].stimulus` moraju biti oznake iz biblioteke distance,
inače dan postaje lagan. `templateId` van podataka je dozvoljen. `protected` → `replan` vraća isti objekat. Čuvar
nalaze nad preuzetim danima daje kao `rucno`. Otisak: `fingerprint(doc, facts)`, red po danu.
## Drugi krug (12. 11. 2026, po pregledu organizatora)
1. § 14.6 i § 14.1 su ugrađeni (v. odstupanje 9); test iz plana i pripremna trka: 3 dana bez ičeg brzog.
2. Pravilo rasta (`m`) i lanac dugog ne gledaju nedelje koje seku pauzu ili rampu (`underRamp`); čuvar `skok` i
   `dugi-korak` isto. Primer 03: 18 → 25,7 → 31 km (bilo 20 / 26 / 22), lagani dani ne postaju odmor.
3. Lagan dan sa ≥ 3 dana trčanja ostaje na `minEasySec` dok nedelja ne pređe cilj za > 10 % (tada otpada najraniji,
   dan posle kvaliteta poslednji); `GUARD_JUMP_TOLERANCE` 0,10. Sa 1–2 dana ostaje staro pravilo.
4. Ispis: tempo samo uz deonicu rada, na mestu opcione oznake `{pace}` u šablonu teksta („prag {n} × {rep}{pace},
   oporavak {rec}" → „prag 2 × 7 min (4:40/km), oporavak 1:30 džog"); bez oznake zagrada na kraju; po osećaju oznaka
   ne daje ništa. `Workout.text` i otisak nikad ne nose tempo. Lagani i dugi bez tempa; PROMENE imaju jedno
   objašnjenje po događaju. Čuvar `lagan-dugi` poredi km (dugi sa blokom kraće traje).
5. Blok posle pauze: prvi dugi posle rampe ispunjava uslov ≥ 90 % (lanac dugog ne gleda nedelje rampe), pa se blok
   vraća čim ga šablon traži — test nad planom od 16 nedelja.
6. Urađen dan plana bez krugova: planirana prosečna težina × stvarno trajanje kad je odrađeno ≥ 90 % planiranog
   trajanja (`Run.planned.durationSec/load`, popunjava `buildState` kad dobije plan); inače po prosečnom tempu.
Otisci se menjaju: dugi (zaokruživanje naniže), lagani dani u nedeljama gde je ostatak bio < `minEasySec`, tekst
oporavka („1:30 džog"), nedelje posle pauze/rampe. Čuvar `brz-udeo` ne meri nedelju trke (mala je, trka ne ulazi u zbir).

## Treći krug (12. 11. 2026, zahtevi taba polumaratona koje je organizator prihvatio)
Potpisi javnog izvoza su isti; nova polja su opciona, postojeći podaci rade nepromenjeno. Test: `round3.test.ts`.
1. Čuvar vidi pun napor IZ PLANA (dan `kind: 'test'`) kao uzrok, pa nedelja posle provere forme nije `ispod-cilja`.
2. Posle napora iz plana važi samo § 14.1 (3 dana bez ičeg brzog): bez rampe i bez „prvi kvalitet × 0,8". Rezultat
   trčanja vezanog za dan testa ostaje „iz plana" (`Adjustment.effort.planned`). Spoljni uzroci su nepromenjeni.
3. `safety.longStartShare`: broj ili mapa po danima; `L_0 = max(najduže skorašnje, udeo × B × 60)`.
4. `safety.longShareByRunDays`: može i po nivou (`{ nivo: { dani: udeo } }`); ravna mapa važi kao do sada.
5. Prva nedelja gradnje: `T_1 ≥ B` kad u njoj nema spremnosti (rampa, bol, umor) — i kad `peakLoadCap` veže.
6. Rasterećenje: cilj = min(namera, `recovery.loadFactor` × pun cilj prethodne nedelje).
7. Dan trke: tekst `texts['race']`, napomene iz `noteRules` sa `kinds: ['race']` (ključ teksta je `rule.text`;
   `minDurationSec` se poredi sa očekivanim vremenom trke); `renderPlan` ih ispisuje ispod reda „TRKA".
8. `onlyByFeel?: boolean` na `Requirements` (unos) i `StimulusSlot` (mesto): važi samo dok su tempa po osećaju.
Otisci: sintetička — samo primer 02 (rasterećenje 194 → 178 BO, tačka 6). Polumaraton — 11 od 12 profila (tačke
2, 3, 5, 6) i K7 za p09 (prvi „tempo trke" posle provere forme više nije × 0,8): to menja tab podataka distance.

## Četvrti krug i dodatak trećem (12. 11. 2026) — testovi `round4.test.ts`
Dodatak trećem (zahtevi adaptera): (9) dan bez ijednog koraka nije planirano trčanje — ne postaje `missed` i ne
ulazi u izvedenu pauzu; (10) `PlanHeader.legacy?` (motor ga ne čita, ulazi u kanonski zapis); (11) izveden umor
posle rupe u istoriji se ne okida (test).
A. Padež uz broj: `count(n, imenica, 'nom' | 'acc')` — „imaš / planiraj 1 nedelju, 2 nedelje, 5 nedelja, 21 nedelju";
   dan, kilometar, minut i trening imaju isti oblik u oba padeža. Test nad upozorenjima i promenama.
B. `mali-obim` i `kratak-dugi`: predlog = šta može SADA uz isti datum (probni plan sa još jednim danom: vrh i dugi)
   + šta za sledeću trku (nedelje/obim iz `adequate`). Ako dodatni dan ne diže vrh (ili ih je već 7), prvi deo kaže
   da obim ne može bezbedno više i kako trčati trku. Razlika do adekvatnog < 5 % se ne prikazuje.
C. Lanac dugog uzima odlučenu (nezaokruženu) dužinu prethodne nedelje; čuvar `dugi-korak` dozvoljava jedno
   zaokruživanje i meri prethodni dugi odlučenom dužinom.
D. Zaokruživanje deonice (500 m / 60 s) ne spušta rad ispod najmanje doze — tada se zaokružuje naviše.
E. Plan u rampi posle trke: baza je obim PRE trke (doprinos trke se oduzima iz baze), trka nije „dugi" ni za polazni
   dugi ni za plafon 75 %; bez istorije dugih plafon je 75 % polaznog dugog plana. Nedelje rampe ne ulaze u `m`.
Uz to: smanjenje × 0,8 ne obara trening ispod njegovog najmanjeg oblika (ostaje najmanja doza); čuvar ne poredi
lagan dan i dugi u nedelji rampe, a vršna nedelja pod rampom nije merilo za `taper`.
Otisci: sintetička — samo primer 02 (start posle trke). Polumaraton — planovi posle trke/pauze (E), svi gde je
dugi rastao korakom (C), deonice na granici najmanje doze (D); tekst upozorenja `mali-obim`/`kratak-dugi` (B, A).
Ispravka tačke E (organizator): trka ili test u 28 dana ulazi u „najduže skorašnje" sa 60 % trajanja (polazni dugi
i referenca plafona); plafon „dugi ≤ 75 % reference" važi samo dok je `f < 0,8`, posle toga dugi određuju rampa i
lanac. Primer 02: dugi 6,5 → 10,5 → 12 km (bilo 6,5 / 6,5 / 10,5). Pauza i bol: referenca kao do sada.


## Krug 2 (R1–R11), 12. 11. 2026 — po `briefs/R2-ROUND2.md`; testovi `engine/round5.test.ts` (34) + izmenjeni stari
Motor: 179 testova (12 fajlova, ≈ 6 s); motor + adapteri + forma + izolacija domena: 480, zeleno. `typecheck`, ESLint,
Prettier čisti. Javni potpisi isti (`index.ts` dobija još `raceNotes`); nova polja su opciona. `distances/hm` pada
(14 od 30: otisci i brojevi) — to je posao taba podataka. SYN ispisi regenerisani.
### Šta je urađeno (vlasnik odluke u zagradi)
- **R1** (`layoutWeek`, plafon dana): u nedelji `taper` i `race` lagan dan ≤ `taperEasyMaxSec` i ≤ trening na istom
  danu prethodne nedelje (bilo koje vrste; ako tog dana nije bilo treninga — najduži lagan dan te nedelje). Višak se ne
  preliva. Ubrzanja ostaju i kad plafon skrati lagani deo, dok je lagani deo ≥ 10 min.
- **R2** (isto): (a) lagan dan ≤ `easyMaxShareOfLong` × STVARNI dugi te nedelje (posle zaokruživanja; strože od
  trajanja i dužine, jer je dugi sa blokom brži); (b) ≤ `easyMaxOverPrevious` × najduži lagan dan poslednje nedelje koja
  nije rasterećenje (iz rasporeda pre spremnosti, pa rampa ne „zaključa" kratke dane); (c) sledi iz (a)/(b): višak
  ostaje neplaniran, čuvar `ispod-cilja` tek ispod 85 %. Plafon dana važi za ceo dan (lagano + dodatak) i zaokruživanje
  ga ne prelazi (`Recipe.maxSec`). Plafon ne spušta dan ispod `minEasySec`.
- **R3** (`decidePeak`, `weekTarget`): `P ≤ B × maxPeakOverBase`; rast ≤ najveća od prethodne 3 × (1 + rast), bez
  izuzetka — v. odstupanje 1 (pravilo meri minute).
- **R4** (`longPlan`, `layoutWeek`, `easyFill`): dugi ≤ udeo po danima × planirani minuti TE nedelje (cilj − dodatno
  opterećenje kvaliteta); udeo se čita za broj dana koje nedelja stvarno ima (nepotpuna prva nedelja). Sa ≥ 3 dana:
  kvalitet se prihvata samo ako posle njega svi preostali dani mogu da dobiju `minEasySec` a da nedelja ne pređe cilj
  za > 10 %; inače taj dan postaje lagan (važniji podražaj ostaje, provera forme se ne odbija). Dan otpada tek kad bi
  nedelja i bez kvaliteta prešla cilj za > 10 % — tada upozorenje `dan-izostavljen` (koje nedelje, zašto, šta raditi).
- **R5** (`weekTarget`, `wantedExtra`): cilj gradnje/vrha = `max(loadPct × P, B + dodatno)`; „dodatno" = bodovi
  kvaliteta iznad laganog trčanja istog trajanja, iz ŽELJENIH doza (pre budžeta) — čista funkcija namere, bez petlje.
- **R6** (`render.raceTruth`, `raceNotes`, `format.goalStatus`/`raceBasis`): rečenica ispod tempa; cilj ≥ očekivano →
  dostižan, između najbržeg u rasponu i očekivanog → na ivici, brži → van raspona. Dan trke: prva napomena je tempo
  (iz cilja ako nije van raspona, inače iz očekivanog), po osećaju opis napora bez s/km.
- **R7** (`modsFor`, `adjustmentWindow`, tekst u `replan.explain`): 1–3: 1 dan odmora, prvo trčanje lagano, 5 dana bez
  `impact: 'visok'`; 4–6: 2 dana odmora, 10 dana bez kvaliteta i bloka (prvih 7 i × 0,7), 14 dana dugi ≤ 75 %
  poslednjeg dugog i bez visokog udara, prvi kvalitet svake vrste u sledećih 14 dana ≤ 60 % doze; ≥ 7 kao pre. Tekst:
  uslov (≤ 2/10 i ne raste), prag za prekid (≥ 4 ili > 7 dana), lekar; bez „plan se nastavlja kako je bio".
- **R8** (`replan.onMissed`): (a) ključan propušten trening uvek daje rečenicu — i bez izmene treninga (`Change.what:
  'obavestenje'`, događaj se upisuje u `appliedEvents`, pa se ne ponavlja); (b) propušten dugi sa blokom: sledeći dugi u
  nedelji `build`/`peak` dobija blok `min(propušten, max(planiran, korak pre propuštenog))`; propušten vršni kvalitet:
  dugi bez bloka dobija korak pre; nema takve nedelje → „nije nadoknadivo — poslednje dve nedelje su za odmor";
  (c) ≥ 2 propuštena duga zaredom: sledeći dugi ≤ poslednji odrađen (28 dana) + korak, bez bloka, i lanac dugog se
  odlučuje ponovo od stvarno odrađenog (`rechainLongFrom`; cilj nedelje ostaje).
- **R9** (`runPass`, `weekSlots`): provera forme koju pauza ili rampa pojedu čeka prvu nedelju posle rampe i zamenjuje
  njen prvi kvalitet (ne ide u `taper`/`race`); tekst kaže datum. Tekst pauze, rezultata i `povratak` više ne kaže
  „prvih N dana bez brzih" nego do kog datuma su treninzi kraći i KOG DATUMA je prvi brzi trening (čita se iz plana).
  Prva nedelja posle rampe: obim ≤ poslednja puna nedelja pre × 1,10, dalje pravilo rasta.
- **R10** (`render`): tempo samo na mestu `{pace}` u tekstu unosa (usponi i koraci po naporu bez tempa; po osećaju red
  bez dodatka — napor po zonama je u zaglavlju); jedno „nedelja trke"; `build` u poslednje 2 nedelje se zove „sužavanje
  pred trku"; „dan posle trke (21,1 km za 1:42:30)" / „posle testa"; „3 treninga + trka"; „brz rad 23 % vremena
  trčanja"; „Polazim od tvojih ≈ 40 km nedeljno (…)"; prošli dani: „— urađeno 8,5 km, 50 min (5:56/km)" ili „— nije
  urađeno", prošla nedelja „Urađeno: …"; „Posle trke: N dana bez brzih treninga…"; kad se očekivano vreme razlikuje
  > 20 s od onog u zaglavlju: „Prognoza je bolja/slabija nego u prethodnom ispisu (…). Zašto:" + rečenice iz
  `form.history` posle `header.form.current.asOf`.
- **R11** (`guard.warnings`): predlog pominje vrh/dugi iz probnog plana samo ako su veći od planiranog; `malo-dana`
  više ne računa dugi iz udela (davao manji broj). `obim-za-nivo`: tempa poznata i (brzi trening zamenjen laganim u
  ≥ 2 i ≥ 25 % nedelja gradnje, ILI vrh < 95 % `adequate.minPeakWeeklyKmByLevel[nivo]`); ne izdaje se uz `mali-obim`.
### Odstupanja i odluke (sa razlogom)
1. **Pravilo rasta meri minute, ne BO; cilj = obim + dodatno.** R5 (kvalitet PREKO minuta) i R3 (rast bez izuzetka)
   se u BO sudaraju: p05 ima dodatno ≈ 15–19 % baze, pa bi rast od 7 % u BO opet dao 81–84 km uz 90. Zato lanac `m`
   i čuvar `skok` mere minute nedelje, a dodatno opterećenje ide preko. Time skok km više ne zavisi od toga da li
   nedelja ima kvalitet (uzrok 49,8 → 59,7 km). Mera opterećenja je i dalje jedna (BO); `targetLoad` je u BO.
2. **Dugi u gradnji nije ispod polaznog dugog** (`min(longStartSec, longMaxSec)`), i kad `lenPct` traži manje. Bez
   toga R2a i R5 ne mogu zajedno: 90 km na 6 dana traži dugi ≥ 21 km od prve nedelje da bi lagani dani (≤ 65 %
   dugog) nosili ostatak.
3. **Rasterećenje: dugi ≤ `recovery.longFactor` × dugi prethodne nedelje** (p11: rasterećenje sa dužim dugim).
4. **R4 „dugi do svog udela"**: dugi je uvek na udelu (jedna odluka), pa „skraćivanje" nije poseban korak. Redosled
   je: dugi na udelu → najkraće lagano uz kvalitet ako nedelja ostaje ≤ cilj + 10 % → kvalitet postaje lagan →
   dan otpada + upozorenje. Sa 1–2 dana trčanja važi staro pravilo.
5. **R1 „isti dan"**: poredi se sa treningom bilo koje vrste na tom danu prethodne nedelje (u nedelji trke dani
   kvaliteta se pomeraju, pa lagan utorak često stoji posle utorka sa kvalitetom).
6. **R7 4–6**: zadržano × 0,7 trajanja prvih 7 dana; dodato „bez visokog udara 14 dana" (trener: sadržaj koji je
   izazvao bol izlazi). Bol ≥ 4: obim se vraća kao posle pauze (R9), jer bi povratak na sačuvane ciljeve bio skok.
7. **R8a**: obaveštenje je `Change` sa `scope: 'zaglavlje'` (dan je u prošlosti; test zaštite traži da promene dana
   budu buduće). § 6.3 se time menja: ključan `missed` se upisuje u `appliedEvents` i kad treninzi ostaju isti.
8. **R9 rampa posle spoljne trke** ne pomera planiranu proveru forme (trkač je upravo dobio rezultat) — ona otpada.
9. **R10 „urađeno"**: prošli dani se ispisuju samo kad `renderPlan` dobije `state`; trčanja van plana ne ulaze u zbir
   prošle nedelje. Tempo u redu je prosek celog trčanja.
10. **Vrh u km je manji od 1,40 ×.** `P ≤ 1,40 × B` je u BO; vršna nedelja nosi dodatno ≈ 15–20 % P, pa je vrh u km
    ≈ 1,20–1,30 × (v. tabelu). Ako organizator hoće + 30–35 % km kod 4 dana, `maxPeakOverBase` treba ≈ 1,50–1,55.
### Nova polja podataka (sva opciona) i podrazumevane vrednosti (`constants.ts`)
| polje | značenje | podrazumevano |
|---|---|---|
| `safety.maxPeakOverBase` | vrh ≤ baza × | 1,40 |
| `safety.taperEasyMaxSec` (broj ili mapa po danima) | najduži lagan dan u `taper`/`race` | 50 min; ≤ 3 dana 40 min |
| `safety.easyMaxOverPrevious` | lagan dan ≤ × najduži lagan dan prethodne nedelje | 1,25 |
| `safety.easyMaxShareOfLong` — sada i mapa po danima | lagan dan ≤ udeo dugog | (obavezno polje, kao do sada) |
| `adequate.minPeakWeeklyKmByLevel` | vrh km koji nivo traži (`obim-za-nivo`) | bez → obim pri kom plafoni doza ne zavise od obima |
| `NoteRule.byFeelText` | tekst napomene za trkača po osećaju | bez → `text` |
| `texts['zaglavlje.*']`, `texts['trka.tempo']`, `['trka.po-osecaju']`, `['trka.oporavak']` | zamena rečenica zaglavlja i dana trke | `DEFAULT_TEXTS` |
Napomene trke mogu da nose `{pace}`, `{paceFrom}`, `{paceTo}` (5 i 10 s sporije), `{time}` — popunjava ih ispis
(`raceNotes`), iz cilja ako je u rasponu, inače iz očekivanog vremena. Tipovi: `Change.what` + `'obavestenje'`;
`Adjustment` `repeat` + `blockSec`, `blockDefId`, `noBlock`.
### Šta tab podataka polumaratona mora da podesi da kapija kruga 2 prođe
Stanje sa DANAŠNJIM podacima `distances/hm` (motor nov, podaci stari; km): vrh 1,07–1,30 × polazno; skok nedelje ≤ 9 %;
treninga = traženih dana u svakoj nedelji gradnje (12/12, v1); nedelja 1 = 94–104 % sadašnjeg obima; lagan/dugi do
79 %; dugi/nedelja 29–48 %. Sa probnim vrednostima `easyMaxShareOfLong { '1': 0.7, '4': 0.63 }` i udelom dugog 4 dana
0,38 / 5 dana 0,34 / 6 dana 0,31 / 3 dana 0,50: lagan/dugi ≤ 63 % (3 dana ≤ 70 %), dugi/nedelja ≤ 39 % kod 4+ dana osim
p09 42 % i p11 41 %; nedelja 1 pada na 89–92 % kod p04 i p08. Zato:
1. `easyMaxShareOfLong`: 4+ dana ≈ 0,63 (motor zaokružuje naniže, 0,65 radi, 0,63 daje rezervu za blok); 3 dana 0,70.
2. `longShareByRunDays`: 4 dana 0,38, 5 → 0,34, 6 → 0,31 (kapija meri km; dugi sa blokom je brži, pa 0,40 u minutima
   daje 41–42 % u km); 3 dana 0,50; početnik po R15. Udeo je sada × planirani minuti nedelje, ne × vrh.
3. `longStartShare` po danima tako da nedelja 1 stane uz plafon laganih dana: treba `udeo ≥ (1 − q) / (1 + n × a)`,
   `n` = broj laganih dana, `a` = `easyMaxShareOfLong`, `q` = udeo kvaliteta u minutima nedelje (≈ 0,15–0,20).
   5 dana: ≥ 0,29–0,30 (sada 0,28 → p04 92 %); 3 dana: ≥ 0,45–0,48 (sada 0,38 → p08 89 %); 6 dana ≥ 0,24.
4. `maxWeeklyRampPct` 0,07–0,08 i `minRampLoad` ≤ 12 daju skok ≤ 10 % km (pravilo sada meri minute). `startPct`:
   `P = min(B / startPct, 1,40 × B)`; `loadPct` prvih nedelja više ne određuje nedelju 1 (pod je B + dodatno).
5. Rep šablona: nedelja trke i `taper` — `taperEasyMaxSec` je podrazumevano 50 / 40 min; R15 „uto 40–50 min" ne
   traži ništa osim da `loadPct` nedelje trke ne bude manji od onoga što ti dani nose (inače dani stoje na
   `minEasySec`).
6. Tekst unosa bez `{pace}` više ne dobija tempo (usponi su već takvi); unos koji treba tempo mora da ima oznaku.
   `napomena.trka` kaže „5–10 s sporije od tempa trke": zameniti sa `{paceFrom}–{paceTo}` i `{pace}` i dodati
   `byFeelText` bez s/km (P09, P12). Napomena o gelu: isto pravilo na dugom i na trci (R19) je tekst podataka.
7. `adequate.minPeakWeeklyKmByLevel` za `brz` (i po želji `srednji`): p06 (VDOT 58, 35 km) sada dobija `kratak-dugi`,
   a `obim-za-nivo` tek kad se broj zada (kvalitet mu staje u plan, pa okidač „zamenjen laganim" ne radi).
8. Provera forme u nedelji rasterećenja malog obima (vlasnik-v2, 10. nedelja): test + dugi + 2 × 25 min prelazi
   cilj + 10 %, pa dan otpada uz `dan-izostavljen`. Rešenje u podacima: veći `loadPct` te nedelje ili test u nedelji
   gradnje (R17 ionako pomera test).
9. Kapija nad planovima vlasnika: vlasnik-v2 počinje dan posle trke — nedelje rampe (do 28. 12.) imaju 3 treninga,
   dugi 50 % nedelje i skok posle rampe; test kapije treba da izuzme nedelje koje seku rampu (`header.adjustments`).
10. Scenario s06 (bolest u 14. nedelji p04) daje nalaz čuvara `taper@19` — proveriti da li ga test scenarija dozvoljava.
### Dodatak: ugovor motor → forma (zahtev taba forme, prihvatio organizator)
(a) `buildState` za POSTOJEĆI plan (peti argument `doc`) predaje proceni `planned` iz dokumenta: `baseLoad` i
`peakLoad` iz `doc.header.decisions` (ne preračunato iz današnje baze) i `weeks: [{ start, targetLoad }]` iz
`doc.weeks`; bez plana ostaje staro (baza iz stanja, vrh koji bi plan odlučio, bez nedelja). Tip je `FormPlanned` u
`engine/types.ts`; `fitness/types.ts` ga samo preimenuje (`FitnessPlanned = FormPlanned`) — jedina izmena u `fitness/`.
(b) `FormChange.signal` dobija `'plan'` i `'baza'` (tip; `fitness/` ih još ne upisuje — to je izmena taba forme).
(c) `Run.walked?: boolean` (tip; `fitness/` hodanje i dalje izvodi iz km-podataka). (d) NIJE urađeno: predaja dnevnih
opterećenja proceni traži novo polje u `RunnerFacts` i izmenu redosleda u `buildState` (opterećenje zavisi od praga
forme, a forma se računa pre njega) — `fitness/load.ts` zato i dalje drži kopiju formule. Test: `round5.test.ts`
(„ugovor motor → forma"); motor 180, ukupno sa adapterima, formom i izolacijom 481.

## Krug 3 (QA1), 12. 11. 2026 — nalazi `qa/QA1-ENGINE-REVIEW.md`; testovi `engine/round6.test.ts`, `fitness/withEngine.test.ts`
Motor + forma + adapteri + izolacija: 520 testova, zeleno; `typecheck`, ESLint, Prettier čisti. Javni potpisi isti.
### Ispravljeno (svaki nalaz ima test koji bi pao pre ispravke)
- **K1** — jedan vlasnik pravila „šta je rezultat punog napora": `vdot.effortResult(run)` (koriste ga `fitness/` i
  motor): (0) izričit unos trkača `Run.resultSec` (+ `resultDistanceM`, inače planirana deonica); (1) krugovi rada;
  (2) aktivnost duža od planirane deonice za > 15 %: najbrži uzastopni niz km dužine deonice; (3) takva aktivnost bez
  km → NIJE dokaz forme: procena ostaje, a `fitness/` upisuje `FormChange { ignored: true }` sa rečenicom „…upiši vreme
  na 3 km da bih prilagodio tempa" (ide u ispis, odeljak FORMA); (4) inače cela aktivnost. `buildState` popunjava
  `Run.plannedEffortM` iz dana plana. Motor: tempa se ne menjaju na neupotrebljiv rezultat; rampa i tekst koriste
  trajanje deonice.
- **O2** — baza je izjava (`weeklyKm`) dok istorija nije merodavna: u poslednjih 42 dana pokriva < 21 dan ili ima
  < 6 trčanja (`seeded: true`). Merodavna istorija ispod 50 % izjave → upozorenje `baza-ispod-izjave`. Dugi nije kraći
  od `minEasySec`; čuvar `prazan` meri prema najkraćem smislenom trčanju (najkraće lagano / dan pred trku / dan u
  rampi, uz jedno zaokruživanje i 10 % za promenu tempa), ne prema stalnih 15 min.
- **O3** — poslednji dani pre trke važe po DATUMU: dan pred trku ≤ 20 min bez dodatka, poslednja 2 dana bez kvaliteta
  i sa plafonom sužavanja, dugog nema u poslednjih 6 dana — i kad ti dani padnu u nedelju pre nedelje trke. Čuvar:
  `dan-pred-trku`, `dugi-pred-trku`; `ispod-cilja` se ne prijavljuje za `taper` ni za nedelju koja dodiruje tih 6 dana.
- **O4** — posle usvojenog rezultata `byFeel = false` bez obzira na razliku, `nema-podataka` nestaje (uslov
  upozorenja je sada „tempa po osećaju", ne pouzdanost procene); `form-update` ne vraća `byFeel` na `true`.
- **O5** — `buildState` ne baca na neispravan `today`, pauzu, bol ni datum trke; ono što je morao da preskoči nosi u
  `RunnerState.inputErrors`, a `plan` to vraća kao `errors`. `validate` proverava pauze (datumi, kraj ≥ početak) i bol
  (datum, nivo 1–10).
- **O6** — trka ili test na dan nastanka plana, upisani posle, daju `result` (granica uključiva); napor koji je plan
  već uzeo u obzir pri nastanku se ne ponavlja.
- **Sitno**: S1 (pauze i bol se sortiraju → isti bajtovi), S2 (buduća pauza u sadašnjem vremenu, bez datuma posle
  trke; pauza preko dana trke se imenuje), S3, S6 (bol 1–10, VDOT 20–90), S7 (kad je sledeći isti trening već kraći:
  „ionako kraći, pa plan ostaje isti"), S9 („su 2 nedelje"), S10 („sva 3 dana"), S11 (nalazi bez ISO datuma), S13
  (dugi ≥ najkraće trčanje).
- **Nađeno novom mrežom**: u nedelji trke kvalitet više ne staje dan posle teškog dana prethodne nedelje.
- **Ispis**: odeljak FORMA štampa rečenice iz `state.form.history` — do 5, najnovija prva („Zašto je prognoza
  ovakva"). `fitness/`: nov korisnik bez ijednog trčanja više ne dobija rečenicu „nedelja odrađena 0 %".
### Testovi koji su falili (sabotaže iz QA1 sada padaju)
R2b (`layoutWeek` sa i bez merila prethodne nedelje), dan pred trku (skraćen pravilom, ne budžetom), R8a (obaveštenje
bez izmene treninga), histereza tempa 14 dana, nepotpuna prva nedelja, puls na treningu sa krugovima rada
(`fitness/estimate.test.ts`). Mreža: 7 dana kao „danas" × trka svakog dana u nedelji × 3 rasporeda (dugi i sredom i
subotom) = 147 planova: determinizam, jedna trka, bez nalaza o dozi, dugom, praznom treningu i danu pred trku,
`replan` bez događaja vraća isti objekat. Integracija (`fitness/withEngine.test.ts`): motor + `estimateForm` dan za
danom kroz 12 nedelja — po planu (plan se ne menja, prognoza ≤ + 20 s), preskače svaki peti trening, provera forme kao
jedna aktivnost (forma i tempa ostaju, rečenica šta uneti) i sa krugom rada (tempa se ubrzavaju).
### Izmene u `fitness/` (dozvoljeno u ovom krugu)
`estimate.ts`: rezultat kroz `effortResult`, zapis `ignored`; bez rečenice o neodrađenoj nedelji dok nema nijednog
trčanja. `explain.ts`: `explainUnusable`. Testovi: K1, puls na deonicama, `withEngine.test.ts`.
### Novi tipovi (opciono)
`Run.resultSec`, `Run.resultDistanceM`, `Run.plannedEffortM`; `FormChange.ignored`; `RunnerState.inputErrors`.
### NIJE urađeno (nije jeftino ili je odluka)
S4, S5 (zaštićeni dani pri promeni cilja i rasporeda), S8 (bol sa starim datumom), S12 („Polazim od ≈ X km" je tačno
samo kad je baza iz izjave), deo S13 (provera forme veća od cilja male nedelje), U1–U3.
### Šta menja planove (za tab podataka — osvežiti otiske)
1. Trka subotom (ili bilo kad je dugi u poslednjih 6 dana pre trke): nedelja sužavanja gubi dugi — taj dan je lagan
   do `taperEasyMaxSec`. Trka nedeljom je ista kao pre.
2. Poslednja 2 dana pre trke: bez kvaliteta i sa plafonom sužavanja i kad su u nedelji pre nedelje trke (trka pon/uto).
3. Plan koji počinje posle trke ili sa retkom istorijom (jedna trka, par trčanja): baza je izjavljeni obim, ne obim
   izveden iz tog jednog trčanja → vlasnik-v2 i scenariji E5 (s17–s20) imaju drugu bazu, vrh i dugi.
4. Dugi nikad kraći od `minEasySec` (mali obimi); nedelja trke: kvalitet ne ide u ponedeljak posle nedeljnog bloka.
5. Tekst: zaglavlje FORMA ima do 5 rečenica „zašto"; upozorenja „Do trke su 2–4 nedelje", „sva 3/4 dana"; novo
   upozorenje `baza-ispod-izjave`; `nema-podataka` zavisi od `byFeel`.
6. Scenariji u kojima se provera forme beleži sa `effort: 'test'` kao cela aktivnost više ne menjaju formu (treba krug
   rada, km ili `resultSec`).
### Dodatak krugu 3 (zahtevi taba podataka) — testovi u `round6.test.ts` („dodatak krugu 3") i `fitness/withEngine.test.ts`
(a) `nema-podataka`: distanca testa se čita iz plana („proveru forme na 5 km koja je u planu 17. 11."), inače
najkraći unos vrste `test` iz biblioteke; biblioteka bez testa → test se ne pominje. (b) `expandTemplate(šablon,
nedelje, biblioteka)`: rasterećenje ne kopira podražaj čiji su unosi vrste `test` ni mesto `onlyByFeel`. (c) Provera
forme u pauzi ili rampi povratka se pomera UVEK (i pri kraju rampe, kad je kvalitet već dozvoljen); rečenica je sada
„treninzi su kraći do D, a prvi brzi trening je D2" (bez „lagani" kad brzi trening pada pre kraja rampe). Test nad
PRAVIM podacima polumaratona (svih 12 profila, bolest 7 dana pred svaku proveru forme): u prozoru nema provere, a
datumi iz rečenice postoje u planu. (d) `fitness/`: nedelja pre početka plana ili bez planiranog opterećenja ne
dobija rečenicu; raspon u rečenici je uvek pon–ned. (e) PERSONALIZACIJA: stanje nosi `recentQualityWeeks` (broj
nedelja od poslednjih 8 sa trčanjem bržim od laganog: krugovi rada, zadat kvalitet, pun napor ili prosečan tempo
brži od brže granice laganog; `null` = u tom periodu nema trčanja) i `weeksSincePause` (`null` = bez pauze).
`levels[].when` i `requires` unosa biblioteke mogu da nose `min/maxRecentQualityWeeks` i `min/maxWeeksSincePause`
(tip `HistoryConditions`); nepoznata činjenica NE zadovoljava uslov, pa plan bez istorije ostaje bajt-isti. Činjenice
se pamte u `decisions` (opciono), da ponovno građenje bira iste unose. Podaci distance sada mogu da daju niži početak
onome ko nije radio kvalitet i povratniku — bez grananja u motoru.
