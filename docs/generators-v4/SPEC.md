# V4 — specifikacija jezgra (F1)

Zakon: `AGENTS.md` § „V4 generator — pravila". Tipovi: `web/src/domain/v4/engine/types.ts` (imena u ovom dokumentu su
imena iz tog fajla). Ovaj dokument je ugovor za tab motora (F2), forme (F4), podataka distance (F3, F7) i adaptera (F5).
Pouzdanost trenerskih brojki: [visoka] poznata formula ili zahtev vlasnika · [srednja] uobičajena trenerska praksa,
tačan broj je izbor · [niska] moja procena, mora da se kalibriše (F4/F6). Izvori se ne navode gde ih nisam proverio.

Jedinice svuda: datum `YYYY-MM-DD` po Beogradu; trajanje u sekundama; dužina u metrima; tempo u s/km; opterećenje u
bodovima (BO); forma u VDOT. Nedelja počinje ponedeljkom. Sva zaokruživanja su `Math.round` na navedeni korak.

## 0. Pojmovi u dve rečenice (ono što se kaže trkaču)

- **Opterećenje**: svaki minut trčanja vredi 1 bod ako je lagan, do 3 boda ako je vrlo brz; nedelja je zbir bodova.
- **Baza i umor**: baza je tvoj prosek opterećenja u poslednjih šest nedelja, umor prosek poslednjih sedam dana.
- **Forma**: vreme koje bi danas istrčao na svojoj distanci; menja se kad trke, testovi i treninzi pokažu da treba.
- **Plan**: šablon kaže šta nedelja treba da postigne, a motor to pretvara u treninge prema tvojoj bazi, formi i
  onome što se stvarno desilo.

## 1. `PlanDoc`

1.1. **Oblik.** `PlanDoc { schema, version, engineVersion, header, weeks[] }` → `PlanWeek { index, start, intent,
targetLoad, days[] }` → `PlanDay { id, date, origin, locked, workout | null }` → `Workout { kind, stimulus, workSec,
steps[], text }`. Generisan, ručno unet i preuzet plan imaju isti oblik; nijedno polje ne kaže ko je autor plana.

1.2. **Dan.** `workout: null` je odmor. Nedelja nosi svih 7 dana (prva nedelja plana samo dane od `startDate`).
`id` generisanog dana je `w<nedelja>d<0–6>`; preuzet dan zadržava stari ID (`n12d5`, `g2d1`) da veze iz dnevnika važe.
- `origin` — ko je poslednji odredio sadržaj: `template` (motor iz namere), `manual` (trkač: izmena, unos, pomeranje),
  `adopted` (adapter iz starog plana). Ručna izmena čuva prethodni sadržaj u `base` (vraćanje izmene).
- `locked` — zaključan dan; motor ga ne menja ni na događaj.
- **Urađeno se NE čuva u planu.** Činjenica „urađeno" je `Run` sa `dayId` u `RunnerState` (jedan izvor istine, isto
  kao današnji `log`). Dan je *urađen* ako postoji `Run` sa njegovim `dayId`; *prošao* ako je `date ≤ today`.
- **Motor sme da promeni dan samo ako važi sve:** `date > today`, `origin !== 'manual'`, `!locked`, nema `Run` za
  njega, `header.protected === false`. To je jedina provera zaštite i živi na jednom mestu (`isMutable`).

1.3. **Namera.** Nedelja čuva `intent: WeekIntent` (faza, vrsta nedelje, `loadPct`, dugi, podražaji) — onako kako je
izašla iz šablona (`source: 'template'`) ili kako ju je adapter izveo iz starog plana (`'inferred'`). Trening čuva
`stimulus` i `libraryId`. Ponovno planiranje uvek gradi dan iz namere + `header.decisions`, nikad iz prethodne
verzije dana (zato je idempotentno).

1.4. **Trening.** `steps` je niz `SingleStep` ili `RepeatStep { repeat, steps }`. Korak: `role`
(`warmup | work | recovery | cooldown | steady`), `target`, `extent` (tačno jedno: `durationSec` ili `distanceM`).
`target`: `zone` (E, M, T, I, R, RP), `effort` (RPE), `pace` (samo ručno/preuzeto), `allOut` (trka, test).
- `text` ne sadrži brojeve tempa („T 2 × 8 min, oporavak 1:30 džog"). Tempo zone ekran čita iz `header.paces`; kad je
  `paces.byFeel`, umesto tempa prikazuje opis napora iz tekstova distance. Zato promena tempa ne menja nijedan dan.
- Kilometri i opterećenje dana se ne čuvaju: izvode se iz koraka i `header.paces` (§ 5.5) funkcijom `summarize`.

1.5. **Zaglavlje** (`PlanHeader`): `goal`; `startDate`; `policyId`/`policyVersion` (= `DistanceData.id`/`version`);
`form` (polazna, procena pri poslednjoj izmeni, `paceVdot`, raspon na dan trke); `paces`; `decisions` (odluke donete
jednom, § 6.2); `warnings[]`; `protected`; `appliedEvents[]`; `eventsFrom`.
- `Warning { code, severity, problem, meaning, proposal, suggest? }` — tri rečenice po AGENTS t. 6 i predlog u
  brojevima. Nastaje pre generisanja (`plan` ga vraća u dokumentu; ekran ga može dobiti i suvim pozivom) i ostaje.
- `form` u zaglavlju je **snimak** pri poslednjoj izmeni plana. Živu procenu i raspon ekran uzima iz `fitness/`
  (§ 7); tako novo trčanje bez događaja ne menja dokument (stabilnost, § 6.3).

1.6. **Verzija.** `version` raste samo kad stari dokument ne može da se čita; tada postoji migracija `vN → vN+1`
(čista funkcija, test otiska). Dodavanje opcionog polja ne menja verziju.

## 2. `RunnerState`

2.1. **Obavezno** (`RunnerFacts`): `today`; `availability { runDays (≥ 1), longDay ∈ runDays }`. Sve ostalo je
opciono: `profile` (izjava trkača: `weeklyKm`, `easyPaceSecPerKm`, `longestRecentKm`, `recentResult`, `beginner`,
`yearsRunning`), `runs[]`, `pauses[]`, `pain[]`.

2.2. **`Run`**: obavezno `id, date, distanceM, durationSec`; opciono `dayId` (vezano za dan plana ili ne — motoru
je svejedno, forma i opterećenje čitaju sva trčanja), `effort` (`race | test`), `avgHr`, `splits[]` (po km: tempo,
puls), `laps[]` (uloga rad/oporavak, dužina, trajanje, puls), `rpe`. Napomena iz F0: aplikacija danas čuva pun zapis
samo za trčanja vezana za dan plana; za trčanja van plana samo km. `Run` bez `durationSec` se ne prima — adapter
takvom trčanju daje trajanje iz laganog tempa forme i `source: 'procena'` (ulazi u opterećenje, ne ulazi u formu).

2.3. **Izvedeno** — računa `buildState(facts, goal, data)` jednom; motor ne preračunava:
- `weeks[12]`: zbir po kalendarskim nedeljama (opterećenje, m, s, broj trčanja, najduže).
- `load { chronic, acute, asOf, seeded }` (§ 5.3). `longestRecentSec`: najduže trčanje u 28 dana.
- `form: FormEstimate` (§ 7). `lastHardEffort`: poslednje trčanje sa `effort` u 42 dana.
- `pauses`: prijavljene + izvedene (≥ 3 uzastopna kalendarska dana bez trčanja u kojima su bila ≥ 2 planirana
  treninga), u 42 dana. `pain`: zapisi bez `resolvedOn` ili razrešeni u poslednjih 14 dana.
- Zaključano i ručne izmene **nisu** u stanju nego u planu (`PlanDay.locked`, `origin`); stanje ih ne duplira.

2.4. **Kad opcionog nema** (nov korisnik mora da dobije plan):

| nema | motor uzima | posledica |
|---|---|---|
| trčanja, ali ima `weeklyKm` | `chronic = acute = weeklyKm × E_tempo / 60 / 7`, `seeded: true` | — |
| ni trčanja ni `weeklyKm` | bazna nedelja = `runDays × minEasySec / 60` BO | upozorenje `nema-podataka` |
| rezultata | forma iz `easyPaceSecPerKm` (kao 66 % VO2max), pouzdanost niska, `byFeel: true` | prvi test menja |
| ni laganog tempa | VDOT 30, pouzdanost niska, `byFeel: true` | upozorenje `nema-podataka` |
| `longestRecentKm` i trčanja | polazni dugi = `longStartShare × baza` | — |
| `yearsRunning` | stopa napretka „nepoznato" (§ 7.5) | širi raspon |
| pulsa, krugova, po km | signali koji ih traže se preskaču (§ 7.2) | niža pouzdanost |

## 3. `Event`

Događaj je okidač: sve brojeve motor čita iz stanja, događaj samo kaže *šta se desilo i kada*. `id` je
determinističan (`<vrsta>:<datum>[:<dan|trčanje|do>]`); primenjen `id` ide u `header.appliedEvents` i ne primenjuje
se dva puta. Izvedene događaje daje čista `deriveEvents(doc, state)` (gleda samo dane posle `header.eventsFrom`);
izričite šalje aplikacija.

| događaj | izvor | šta menja u stanju (pre poziva) | šta `replan` radi (§ 6.4) |
|---|---|---|---|
| `result` (trka/test) | izveden: `Run.effort` | forma (§ 7.3), `lastHardEffort` | tempa odmah ako \|Δ\| ≥ 0,3; rampa posle napora |
| `missed` | izveden: prošao dan sa treningom, bez `Run`, van pauze | ništa (trčanja nema) | običan: ništa; ključan: ponavlja dozu |
| `pause` (`from`,`to`,`reason`) | izričit ili izveden; `id` sadrži `to` | `pauses`, baza i umor padaju sami, forma (§ 7.4) | rampa povratka; ciljevi nedelja kroz pravilo rasta |
| `pain` (nivo 1–10) | izričit | `pain[]` | zaštita po nivou (§ 6.5) |
| `fatigue` | izričit, ili izveden: `acute / chronic ≥ 1,5` i `!seeded`, najviše jednom u 7 dana | ništa | 4 dana bez kvaliteta, × 0,8 |
| `manual-edit` | izričit | ništa (dan je već `manual` u planu) | ništa; čuvar samo proveri |
| `goal-change` | izričit | cilj | vreme: zaglavlje + upozorenja; datum ili distanca: ostatak plana iznova |
| `availability-change` | izričit | `availability` | ostatak plana iznova (raspored dana) |
| `form-update` | izveden po histerezi (§ 7.6) | ništa (procena već postoji) | samo `header.form.paceVdot` i `paces` |
| `none` | — | ništa | ništa; izlaz je ulazni dokument |

„Ključan" trening: dugi, ili prvi podražaj (`stimuli[0]`) nedelje vrste `build`/`peak`.

## 4. `Template`, `Workout` i izbor

4.1. **Šablon** (`Template`) je podatak distance: `levels`, raspon `minWeeks–maxWeeks` i `minRunDays–maxRunDays`,
`startPct`, `tail[]` (poslednjih K nedelja, stalne, poslednja je nedelja trke), `body[]` (faze sa udelom i nizom
namera `cycle` koji se, kad se potroši, nastavlja od `loopFrom`), `recoveryEvery`, `recovery { loadFactor,
longFactor, doseFactor }`. `WeekIntent`: `phase`, `kind` (`build | recovery | peak | taper | race`), `loadPct`
(udeo vrha), `long { lenPct, stimulus, dosePct? } | null`, `stimuli[]` **po važnosti** (`{ stimulus, dosePct?,
workoutId? }`).

4.2. **Izbor i razvijanje šablona** (N = broj kalendarskih nedelja od nedelje `startDate` do nedelje trke, uklj.):
1. Nivo: prvo pravilo iz `data.levels` čiji uslovi važe (`beginner`, VDOT, bazno opterećenje).
2. Šablon: prvi u `data.templates` sa tim nivoom, `minWeeks ≤ N ≤ maxWeeks` i brojem dana u rasponu. Podaci distance
   moraju pokriti svaki nivo × N 1–52 × dane 1–7 (test podataka, ne motora); ako nema pogotka to je greška podataka.
3. Rep: poslednjih `min(N, K)` nedelja = kraj `tail`. Telo: `M = N − K` nedelja (ako je `M ≤ 0`, nema ga).
4. Faze tela: `n_i = floor(share_i × M)`; ostatak nedelja ide fazama redom po najvećem razlomku, kod izjednačenja
   ranijoj. Nedelje faze uzimaju `cycle[0], cycle[1], …`, posle kraja od `loopFrom`.
5. Rasterećenje: nedelja tela na mestu `j` brojano unazad od repa (poslednja nedelja tela je `j = 1`) je
   rasterećenje kad `recoveryEvery > 0` i `j % recoveryEvery === 0`. Ona ne troši mesto u `cycle`: uzima nameru
   prethodne nedelje i množi `loadPct × loadFactor`, `long.lenPct × longFactor`, svaki `dosePct × doseFactor`
   (ako ga nema: tekući korak lestvice × `doseFactor`), `kind: 'recovery'`.

4.3. **Unos biblioteke** (`WorkoutDef`): `id`, `kind`, `stimulus` (glavna oznaka), `tags[]`, `impact`, `requires`
(VDOT, bazno opterećenje, faze, nivoi, dani, raspon doze, `needsKnownPaces`), `main: MainSet`, `text`, `notes`.
Doza `d` (sekunde rada) skalira glavni deo; tempo zone se uzima iz `header.paces`:

| `main.kind` | koraci iz doze `d` |
|---|---|
| `steady` | jedan korak `steady`; trajanje = budžet dana (§ 6.2 k. 7), ne doza |
| `continuous` | jedan komad `work` trajanja `d`, zaokružen na 60 s (ili na 500 m ako se dan zadaje dužinom) |
| `split` | `pieces` jednakih komada; komad = `d / pieces` zaokružen na 60 s ili 500 m; oporavak između |
| `reps` | broj `n = clamp(round(d / trajanje deonice), minReps, maxReps)`; oporavak posle svake osim poslednje |
| `ladder` | najduži početak niza `reps` čiji zbir ≤ `d + 90 s` |
| `finish-block` | dugi: `steady` E za (dužina − blok), pa `work` blok = `d` zaokružen na 500 m |
| `progressive` | dugi: `steady` E, pa `work` dužine `d` sa ciljem zone (tekst kaže „progresivno do") |
| `add-on` | lagan dan + `count × rep` (doza stalna); dan ostaje `kind: 'easy'` |
| `all-out` | `warmup`, jedan korak `allOut` na `distanceM`, `cooldown` |

Trening vrste `quality`/`test` dobija `warmup` i `cooldown` iz `decisions` (zona E). WU/CD su deo treninga i ne
menjaju se da bi se pogodio obim.

4.4. **Doza i napredovanje.** Plafon podražaja (jedan po podražaju, `decisions.doseCapSec[s]`, § 6.2 k. 4).
Doza mesta: `dosePct × plafon`, gde je `dosePct` iz šablona, a ako ga nema: `min(1, startPct + stepPct × i)` iz
`safety.progression[s]`, `i` = broj ranijih nedelja plana (vrste ≠ `recovery`) koje nose taj podražaj. Tako isti
podražaj raste kroz nedelje bez novog koda. Zatim budžet brzog rada (§ 6.2 k. 6).

4.5. **Pravilo izbora treninga** (determinističko, bez nasumičnosti). Za mesto `(stimulus, doza, faza)`:
1. `workoutId` zadat → taj unos (ako ne prolazi zahteve: korak 2).
2. Kandidati = unosi biblioteke sa istim `stimulus` i `kind` koji odgovara mestu (dugi: `long`; ostalo: `quality`,
   `test` ili `easy` sa `add-on`), čiji `requires` prolazi za trkača, fazu i dozu; dok traje bol bez `impact: 'visok'`;
   dok je `paces.byFeel` bez unosa sa `needsKnownPaces: true`.
3. Redosled kandidata = redosled u biblioteci. Bira se `kandidati[i mod broj]`, `i` iz § 4.4 — oblici se smenjuju
   (u komadu → 2 × → 3 ×) onim redom kojim ih je autor biblioteke poređao.
4. Nema kandidata → mesto postaje lagan dan (zapis u `Finding` čuvara `nema-treninga`), plan se ne odbija.

4.6. **Raspored dana** (jednom, u `decisions.qualityDays`): `d(a,b) = min(|a−b|, 7−|a−b|)`. Dugi na `longDay`.
`Q1 = argmax d(dan, dugi)` među ostalim danima trčanja (izjednačeno → kasniji dan u nedelji). Svaki sledeći
`Qk = argmax min(d(dan, dugi), d(dan, Q1), …)` (izjednačeno → raniji). `stimuli[0]` ide na Q1, `stimuli[1]` na Q2…
Mesta kojih ima više nego dana (dani − 1) se odbacuju s kraja. Unos `add-on` zauzima svoj dan kao lagan dan sa
dodatkom. Preostali dani trčanja su lagani. Tekst: `data.texts[def.text]` sa zamenama `{n} {rep} {dose} {rec} {len}`.

## 5. Opterećenje, baza i umor, kilometri

5.1. **Formula** [srednja]. `opterećenje = Σ po koracima (minuti koraka × težina)`, u BO.
Težina je funkcija brzine u odnosu na brzinu praga, `s = v / v_T`, linearno između sidara, ravno van njih:

| zona | E | M | T | I | R | oporavak džog | hod / stajanje |
|---|---|---|---|---|---|---|---|
| `s` (sidro) | ≤ 0,80 | 0,93 | 1,00 | ≥ 1,09 | ≥ 1,09 | — | — |
| težina | 1,0 | 1,5 | 2,0 | 3,0 | 3,0 | 1,0 | 0,5 |

- Imenovane zone imaju stalnu težinu iz tabele. `RP` (tempo trke) nema svoju: težina = funkcija od `s` za tempo trke
  na distanci cilja, zaokružena na 0,05. Primeri za VDOT 45: maraton `s` 0,94 → 1,55; polumaraton 0,975 → 1,80;
  10 km 1,02 → 2,25; 5 km 1,06 → 2,70. Motor zna samo `distanceM`, ne ime distance.
- `effort`: RPE ≤ 4 → 1,0; 5–6 → 1,5; 7 → 2,0; ≥ 8 → 3,0. `pace`: težina iz `s`. `allOut`: iz `s` očekivanog tempa.
- **Odrađeno trčanje**: ako ima krugove, zbir po krugovima (težina iz `s` svakog kruga); inače po km; inače
  trajanje × težina prosečnog tempa. `v_T` je prag forme na dan trčanja.
- Obrazloženje brojeva: redosled i odnos 1 : 2 : 3 prate uobičajene mere „napor × trajanje"; tačne vrednosti su
  izbor radi jednostavnosti. Mera ne zna za mišićni zamor dugog trčanja — zato dugi ima sopstveni plafon (§ 6.2).

5.2. **Dnevno opterećenje** `L_d` = zbir svih trčanja tog dana (0 za dan bez trčanja).

5.3. **Baza i umor** [srednja]: dve eksponencijalne sredine dnevnog opterećenja.
`chronic_d = chronic_{d−1} + (L_d − chronic_{d−1}) / 42`, `acute_d = acute_{d−1} + (L_d − acute_{d−1}) / 7` (BO/dan).
- Početak: ako istorija pokriva < 42 dana, obe kreću od `izjavljena nedelja / 7` (§ 2.4), pa se odvrti dostupna istorija.
- Bazno nedeljno opterećenje `B = 7 × chronic`. Svežina = `chronic − acute` (samo za prikaz i događaj `fatigue`).
- Zašto ne jednostavnije: prozor „poslednje 4 nedelje" skače kad jak dan ispadne iz prozora, a skok bi bez povoda
  menjao plan. Sredine su glatke i isti su pojmovi (CTL/ATL) koje aplikacija već prikazuje iz jutarnjih merenja.
- Model namerno NE određuje povratak posle trke i pauze sam: 7 dana bez trčanja spusti bazu samo 15 %, a dan posle
  polumaratona umor se vrati za 4–5 dana — oba su blaža od trenerske prakse. Zato povratak ide iz činjenica stanja
  (trajanje napora, dani pauze) kroz jednu rampu (§ 6.5); model daje bazu, pravilo rasta i signal umora.

5.4. **Forma i tempa** [visoka za formulu]. VDOT po Daniels–Gilbertu, `v` u m/min, `t` u min:
`VO2(v) = −4,60 + 0,182258·v + 0,000104·v²`; `udeo(t) = 0,8 + 0,1894393·e^(−0,012778·t) + 0,2989558·e^(−0,1932605·t)`;
`VDOT = VO2(v) / udeo(t)`. Vreme trke za VDOT: bisekcija po `t`. Tempo zone: brzina `v` za koju je
`VO2(v) = udeo zone × VDOT`: E 62–70 % (račun km: 66 %), M 80 %, T 88 %, I 97,5 %, R 105 %; RP = tempo trke na
`distanceM` za `paceVdot`. Tempa se zaokružuju na 1 s/km. Primer VDOT 44,6: E 6:10–5:36 (5:52), M 5:02, T 4:40,
I 4:18, R 4:03; polumaraton 1:41:00 (4:47/km).

5.5. **Kilometri se izvode**: korak sa `distanceM` → ta dužina; sa `durationSec` → `trajanje / tempo cilja`
(zona → `paces`; `effort` → E; oporavak džog → `easySlow`; hod → 9:00/km; stajanje → 0). Zbir dana na 0,1 km.
Obrnuto, kad se lagan ili dugi zadaje dužinom (`presentation.byDurationAboveSecPerKm`): minuti iz budžeta → km po
tempu E 66 % → zaokruženo na 0,5 km; inače trajanje zaokruženo na 5 min.

## 6. Ugovor `plan` i `replan`

6.1. `plan(state, goal, data) → { ok: true, doc } | { ok: false, errors }` i
`replan(doc, state, events, data) → { doc, changes[] }`. Obe su čiste: bez sata, bez nasumičnosti, bez mreže; „danas"
je `state.today`. Isti ulaz daje bajt-isti izlaz (serijalizacija sa stalnim redosledom ključeva). Plan počinje
sutra (`state.today + 1`), osim ako je zadat kasniji `goal.startDate`.

6.2. **`plan` — redosled odluka; svaka veličina ima jedno mesto** (funkcija u zagradi je jedini vlasnik):
1. *Ispravnost unosa* (`validate`, § 8.1). Neispravno → `errors`, ništa drugo se ne odbija.
2. *Šablon* (`expandTemplate`, § 4.2) → `WeekIntent[N]`.
3. *Vrh opterećenja* (`decidePeak`): `B = 7 × chronic`; `P = max(B, min(B / startPct, peakLoadCap[nivo] ?? ∞))`.
4. *Plafoni doza* (`decideCaps`): `doseCapSec[s] = min(maxWorkSec, shareOfPeakLoad × P × 60)`.
   WU/CD: prvi red `warmupCooldown` čiji je `uptoBaseLoad ≥ B`.
5. *Ciljevi nedelja* (`weekTargets`), jedan prolaz unapred: `T_k = loadPct_k × P`; za nedelje `build`/`peak`
   `T_k ≤ max(m × (1 + maxWeeklyRampPct), m + minRampLoad)`, `m` = najveće opterećenje u prethodne 3 nedelje
   (stvarno iz `state.weeks` za prošle, planirano za buduće; pre plana `B`). Dan trke ne ulazi u `T_k`.
6. *Dugi* (`longPlan`), jedan prolaz: `longMaxSec = min(safety.longMaxSec[nivo], longShareByRunDays[dani] × P × 60)`;
   polazni `L_0 = longestRecentSec` ili `longStartShare × B × 60`; `L_k = min(lenPct_k × longMaxSec,
   max(dugi u prethodne 3 nedelje, L_0) + longStepSec)`. Blok/progresija dugog je doza po § 4.4.
   *Budžet brzog rada* (`fastBudget`): redom dugi pa `stimuli[]`; za svako mesto sa težinom zone `w`:
   `doza ≤ (f × (T_k − E) − W) / (1 + f × (w − 1))`, `f = maxFastShare` (`maxFastSharePeak` za `peak`),
   `W` = već dodeljeni minuti rada, `E` = njihovo dodatno opterećenje `Σ (w−1) × rad`. Doza ispod `minDoseSec`
   (ili ispod `requires.minDoseSec` izabranog unosa) → mesto postaje lagan dan. Nema drugog prolaza.
7. *Lagani dani* (`easyFill`): `E_uk = T_k − dugi − Σ kvalitet − dodatno opterećenje dodataka`. Deli se jednako na
   lagane dane; dan pred dugi ≤ `dayBeforeLongMaxShare × dugi`, ostali ≤ `easyMaxShareOfLong × dugi`; višak se NE
   preraspodeljuje ni u WU/CD (nedelja tada ima planirano < cilj i čuvar to prijavi). Ako je deo po danu <
   `minEasySec`: ostaje `floor(E_uk × 60 / minEasySec)` laganih dana (prvo otpada dan pred dugi, pa najraniji),
   ostali postaju odmor.
8. *Stanje na dan plana* (`applyReadiness`, § 6.5): rampa posle napora/pauze, bol, umor — isti modifikator koji
   koristi `replan`. Tako plan koji počinje dan posle trke nema brze deonice.
9. *Forma i tempa u zaglavlje*, *upozorenja* (§ 8.3), *čuvar* (§ 8.2; nalazi idu u izveštaj, ne menjaju plan).
10. Nedelja trke: dan trke je `Workout { kind: 'race', steps: [allOut distanceM] }` na `goal.raceDate`; dan pre
    trke je odmor ili lagano ≤ 20 min (podatak šablona: poslednja nedelja `tail`).

6.3. **Stabilnost.** `replan(doc, state, [])` i `replan` sa događajima koji su svi u `appliedEvents` ili vrste
`none` vraća **isti dokument, bajt po bajt,** i `changes: []`. U `appliedEvents` se upisuju samo događaji koji su
proizveli bar jednu promenu; događaj koji ne traži izmenu (običan `missed`, `manual-edit`) se ne upisuje, pa ni on
ne menja dokument, a ponovljen poziv sa njim opet ne menja ništa (pravilo je bez stanja). `header.decisions` se čita, ne preračunava — vrh,
plafoni, najduži dugi i raspored dana menjaju se samo na `goal-change` (datum/distanca), `availability-change` i
pauzu ≥ 14 dana.

6.4. **`replan` — šta sme i koliko daleko** (najmanja dovoljna promena). Nikad: dan sa `date ≤ today`, urađen,
`manual`, `locked`, dan trke, plan sa `protected`. Menja se od `today + 1`. Događaji se obrađuju redom
(`date`, pa vrsta po redu iz tabele § 3, pa `id`); prozori se spajaju, modifikatori se množe (faktor = najmanji).

| događaj | prozor izmene | šta se radi u prozoru |
|---|---|---|
| `none`, `manual-edit`, običan `missed` | 0 dana | ništa |
| ključan `missed` | jedan dan: sledeće isto mesto u ≤ 14 dana | kvalitet: doza = propuštena doza; dugi: dužina = propuštena |
| `result` | rampa `R = ceil(min napora / 7)` dana + zaglavlje | § 6.5; tempa po § 7.6 |
| `pause` 3–13 dana | rampa `R = ceil(1,5 × dani)` + nedelje gde pravilo rasta veže | § 6.5; `weekTargets` i `longPlan` ponovo sa stvarnom istorijom |
| `pause` ≥ 14 dana | ceo ostatak | `decidePeak` iz nove baze (ne iznad starog `P`), pa sve iz namera |
| `pain` | 3 / 7 / 7 dana po nivou | § 6.5 |
| `fatigue` | 4 dana | kvalitet → lagano, trajanje × 0,8 |
| `goal-change` vreme | samo zaglavlje | cilj, upozorenja |
| `goal-change` datum/distanca, `availability-change` | ceo ostatak | `plan` od sutra; urađene nedelje ostaju, numeracija se nastavlja |
| `form-update` | samo zaglavlje | `paceVdot`, `paces` |

Dan u prozoru se gradi iznova iz namere nedelje i `decisions` (ista funkcija kao u `plan`), pa se primeni § 6.5.
Ako je rezultat jednak postojećem danu, dan nije promena. Svaka stvarna razlika daje jedan `Change` (§ 10).

6.5. **Spremnost iz stanja** (`applyReadiness`) — jedina politika povratka, ista za svaku distancu [srednja]:
- *Posle punog napora* (`lastHardEffort`, trajanje `D` min, `n` = dana od napora): `R = ceil(D / 7)`;
  `f(n) = 0,4 + 0,6 × n / R` za `n ≤ R`. (5 km za 22 min: 4 dana; 10 km za 46: 7; polumaraton 1:41: 15; maraton
  3:45: 33.)
- *Posle pauze* od `p ≥ 3` dana (`n` = dana od kraja pauze): `R = ceil(1,5 × min(p, 21))`; isti `f(n)`.
- Dan u rampi: `f < 0,5` → odmor. Inače trajanje laganog i dugog × `f` (najmanje 20 min). Kvalitet i blok u dugom
  dozvoljeni tek kad `f ≥ 0,8`; pre toga kvalitet postaje lagan dan trajanja `ukupno trajanje kvaliteta × f`, a dugi
  gubi blok. Kvalitet u rampi i **prvi** kvalitet svakog podražaja posle rampe: doza × 0,8.
- *Bol*: nivo 1–3 → 3 dana bez unosa `impact: 'visok'` (zamena po § 4.5); 4–6 → 7 dana bez kvaliteta, trajanje ×
  0,7; ≥ 7 → 7 dana odmor uz napomenu „javi se lekaru ili fizioterapeutu", zatim se računa kao pauza od 7 dana.
- *Umor*: 4 dana bez kvaliteta, trajanje × 0,8.
- Više uzroka: `f` = najmanji; kvalitet samo ako ga svi dozvoljavaju.

## 7. Forma iz trčanja (ugovor za `fitness/`)

7.1. `estimateForm(facts, { distanceM, raceDate }, planned | null) → FormEstimate { start, current, raceDay
{ lowSec, expectedSec, highSec }, ceilingGain, history[] }`. Čista; obrađuje trčanja hronološki; svaka promena
procene je zapis `FormChange { date, signal, before, after, reason }` — to je objašnjenje „zašto se promenilo".
Urađeno se nikad ne menja; procena se uvek može ponovo izračunati iz istih trčanja.

7.2. **Signali** (po snazi; `k` je deo razlike koji se usvaja: `nova = stara + k × (dokaz − stara)`):

| signal | uslov | dokaz | `k` | ograničenje |
|---|---|---|---|---|
| trka | `effort: 'race'`, ≥ 3000 m | VDOT rezultata | 0,7 (1,0 kad je pouzdanost niska) | — |
| test | `effort: 'test'`, ≥ 2000 m | VDOT rezultata | 0,5 (1,0 kad je niska) | — |
| odrađen kvalitet | trčanje vezano za dan sa zonom T/I/RP, ima krugove rada | v. 7.3 | 0,1 | zbir ≤ 0,3 VDOT u 7 dana |
| trend pulsa | v. 7.4 | % promene × 0,5 VDOT | 0,5 | ≤ ± 0,5 VDOT u 14 dana |
| pauza | svaki dan pauze posle petog | −0,3 % VDOT po danu | 1 | najviše −8 % |
| izjava | nema ničega drugog | rezultat ili lagani tempo iz `profile` | 1 | pouzdanost: srednja / niska |

7.3. **Kvalitet** [niska]. `p_r` = prosečan tempo krugova rada, `p_c` = ciljni tempo zone tog dana, „odrađeno" =
vreme rada ≥ 90 % zadatog. Odrađeno i `p_r ≤ 1,01 × p_c` → dokaz = VDOT čija zona daje `p_r`, najviše `stara + 1,0`;
ako je `rpe ≥ 9`, dokaz = stara (držao je, ali na granici — nema viška). Neodrađeno ili `p_r > 1,03 × p_c` → dokaz
= VDOT za `p_r`, najmanje `stara − 1,0`. Između: bez dokaza. Jedan trening pomeri procenu najviše 0,1 VDOT
(≈ 0,5 s/km) — ne skače.

7.4. **Puls sa zgloba** [niska]: samo trend. Trčanje ulazi ako: ≥ 25 min, ima `avgHr`, prosečan tempo u zoni E ± 10 %,
i (ako ima km) razlika najbržeg i najsporijeg km ≤ 12 %. Mera `e = (m/min) / otkucaji`. Nedeljna medijana samo za
nedelje sa ≥ 2 takva trčanja; treba ≥ 4 takve nedelje u poslednjih 8. Trend = medijana poslednje 2 / medijana prve 2
− 1. Računa se kad je \|trend\| ≥ 2 %. Nikad na intervalima, kratkim deonicama ni pojedinačnom treningu. Bez pulsa
se signal preskače; procena tada stoji na tempu, kvalitetu i trkama.

7.5. **Pouzdanost i raspon na dan trke.** Pouzdanost: visoka = trka/test u 42 dana; srednja = trka/test u 180 dana
ili ≥ 4 dokaza kvaliteta u 28 dana; inače niska. Neodređenost `σ` = 0,5 / 1,0 / 2,0 VDOT.
Plafon napretka do trke [niska, kalibriše F4 na istoriji vlasnika]: `G = min(r × f_v × f_p × W, G_max)`:
- `r` (VDOT nedeljno) i `G_max` po stažu: < 1 god. ili početnik 0,15 / 3,0; 1–3 god. 0,10 / 2,0; > 3 god. 0,06 / 1,2;
  nepoznato 0,08 / 1,6. (Ko trči kraće, dalje je od svog plafona.)
- `f_v` (obim): `0,8 + 0,4 × (clamp(P / B, 1, 1,3) − 1) / 0,3` → 0,8 kad obim ne raste, 1,2 kad raste ≥ 30 %.
- `f_p` (raniji napredak): nagib procene u poslednjih 8 nedelja `n_8` (VDOT/ned), ako postoje ≥ 2 dokaza trka/test
  ili ≥ 6 dokaza kvaliteta: `clamp(0,5 + 0,5 × n_8 / r, 0,5, 1,5)`; inače 1.
- `W = clamp(nedelje do trke − 1, 0, 16)`.
Raspon: `expected = vreme(tekuća + 0,6 × G)`, `low` (najbrže) `= vreme(tekuća + G + σ/2)`, `high` (najsporije)
`= vreme(tekuća − σ/2)`. Kako procena raste, raspon se pomera i sužava — prognoza više nije „1:41 → 1:41".

7.6. **Kako tempa prate procenu bez „šetanja".** Plan trči po `header.form.paceVdot`, ne po živoj proceni.
`deriveEvents` daje `form-update` samo kad važi sve: \|tekuća − paceVdot\| ≥ 0,5 VDOT (≈ 3 s/km na pragu),
pouzdanost ≥ srednja, i prošlo je ≥ 14 dana od `pacesUpdatedOn`. Izuzetak: posle trke/testa odmah, ako je
\|Δ\| ≥ 0,3. Važi naviše i naniže. Promena menja samo zaglavlje (`paceVdot`, `paces`, `byFeel: false` kad stigne
prvi rezultat); dani se ne diraju jer nose zone i dužine, ne tempa. Ciljno vreme trkača ne menja doze ni tempa:
ako je brže od `low`, ide upozorenje `cilj-van-raspona` sa realnim rasponom.

## 8. Čuvar

8.1. **Neispravan unos — jedino što se odbija** (`InputError`): datum koji ne postoji ili nije `YYYY-MM-DD`; trka
pre sutrašnjeg dana; nula dana trčanja; `longDay` van `runDays`; broj koji nije konačan ili je ≤ 0 tamo gde mora
biti pozitivan (km, tempo, vreme, rezultat); `goal.distanceId` ≠ `data.id`. Sve ostalo (maraton za 3 nedelje, 1 dan
nedeljno, 5 km nedeljno, početnik) dobija najbolji mogući plan i upozorenje.

8.2. **Provere — samo prijavljuju** (`guard(doc, state, data) → Finding[]`; ništa ne menja, ni lični plan):

| provera | nalaz kad |
|---|---|
| `doza-plafon` | rad treninga > `doseCapSec` + 90 s |
| `brz-udeo` | rad nedelje / vreme nedelje > `maxFastShare` (+ 0,02 tolerancije; `peak`: `maxFastSharePeak`) |
| `skok` | planirano > pravilo rasta iz § 6.2 k. 5 + 5 % |
| `dugi-plafon`, `dugi-korak` | dugi > `longMaxSec`; rast dugog > `longStepSec` + 60 s |
| `lagan-dugi` | lagan dan duži od dugog iste nedelje |
| `prazan` | trening bez koraka, kraći od 15 min (osim trke) ili bez teksta |
| `ispod-cilja` | planirano < 0,9 × `targetLoad` (nedelja van rampe) |
| `min-nedelja` | nedelja (osim trke i rampe) < 0,5 × `B` ili manje treninga od `min(3, dani)` |
| `teski-uzastopno` | dva kvaliteta ili kvalitet + dugi sa blokom u uzastopnim danima |
| `trka` | trka nije jedna, poslednja i na `goal.raceDate` |
| `taper` | rad nedelje `taper` > 0,6 × rada nedelje `peak` |
| `nema-treninga` | mesto bez kandidata u biblioteci (§ 4.5 k. 4) |
| `rucno` | ručno izmenjen ili preuzet dan krši neku od gornjih (samo obaveštenje trkaču) |

8.3. **Upozorenja** (`Warning`) — brojevi iz `data.adequate`, računa `warnings(state, goal, data, decisions)`:

| `code` | kada | predlog (u `suggest`) |
|---|---|---|
| `kratka-priprema` | N < `adequate.minWeeks` | `weeks = minWeeks`; ili `shorter.distanceId` |
| `mali-obim` | vrh u km < `minPeakWeeklyKm` | `peakWeeklyKm`; dodatne nedelje `ceil(ln(potreban/vrh) / ln(1 + maxWeeklyRampPct) × 4/3)` |
| `malo-dana` | dani < `minRunDays` | `runDays = minRunDays` |
| `kratak-dugi` | najduži dugi u km < `minLongKm` | `longKm`, i šta ga ograničava (dani, obim, vreme) |
| `cilj-van-raspona` | cilj brži od `raceDay.lowSec` | realan raspon i šta bi ga pomerilo |
| `povratak` | plan počinje u rampi (§ 6.5) | datum prvog kvaliteta |
| `nema-podataka` | § 2.4 | unesi rezultat ili poveži sat |

Primer: *problem* „Do maratona je 8 nedelja, a tvoj najduži trk je 14 km." *značenje* „Plan te dovodi do dugog od
24 km; poslednjih 10–12 km trke biće znatno teži od treninga." *predlog* „Za adekvatnu pripremu treba 16 nedelja i
vrh od 55 km nedeljno, ili polumaraton na isti datum."

## 9. Preuzimanje postojećih planova (AGENTS t. 8)

9.1. **Ugovor adaptera**: `adopt(legacy, today) → { doc, facts }`, gde je `legacy` = stari plan + `log` + `alts` +
`moves` + `vanPlana` (nalaz F0: sve to zajedno je stanje korisnika). Po jedan adapter za: plan starog formata (obe
podvrste), v2 plan, lični plan vlasnika. Adapter samo čita; ništa ne upisuje u stari plan; jedini zna stari oblik.
- Dan → `PlanDay`: `id` isti; `date` = važeći datum (posle `moves`, uz `movedFrom`); `origin: 'adopted'`, a
  `'manual'` ako dan ima `alts` ili `moves` (stari sadržaj u `base`); `locked` iz `log.lock`; `workout`: `kind` iz
  starog `tag`, `text` = stari `desc` doslovno, `steps` iz `structure`/`session` ako postoje, inače jedan korak
  `steady` sa `distanceM = km` (bez km: `durationSec` iz opisa ili 0 i `legacy`); sve što V4 ne tumači ide u
  `legacy` (`strides`, `runWalk`, `finish`, `mlr`, `snaga` → `extras`).
- `log` → `Run` sa `dayId` (status `done`); `skip` i prazno → nema `Run`. `vanPlana` → `Run` bez `dayId`.
- Zaglavlje: `goal` iz `meta`; `policyId = 'adopted:<format>'`; `eventsFrom = today`; `appliedEvents = []`;
  `protected = true` za lični plan vlasnika; `decisions` i `intent` izvedeni (9.3).

9.2. **Otisak pre = posle.** `fingerprint(doc, facts)` je kanonski tekst: po jedan red za svaki dan hronološki,
`datum | odmor? | vrsta | km na 0,1 | tekst | urađeno? | zaključano? | ručno?`. Adapter ima i `fingerprintLegacy`
koji isti tekst gradi direktno iz starog stanja (iz razrešenog plana: plan + `alts` + `moves` + `log`). Test: za
svaki uzorak `fingerprintLegacy(legacy) === fingerprint(adopt(legacy))` i `replan(doc, state, deriveEvents(doc,
state))` posle preuzimanja ima `changes: []`.

9.3. **Preostale nedelje kao šablon.** Adapter svakoj nedelji izvodi `intent` (`source: 'inferred'`): `phase` iz
stare nedelje ili `'nepoznata'`; `kind` iz `deload`/`taper`/nedelje trke, inače `build`; `loadPct` = opterećenje
nedelje / najveće u planu; `long.lenPct` = najduži dan / najduži u planu; `stimuli` iz starih oznaka dana po tabeli
adaptera (`int`, `tempo`, … → oznake podražaja distance). `decisions`: `peakLoad` = najveća nedelja, `longMaxSec` =
najduži dan, `doseCapSec` = najveća doza po podražaju u planu, dani iz rasporeda plana. Time je namera autora
sačuvana: V4 preostale dane ne dira dok ne dođe događaj ili izričit zahtev („prepravi ostatak plana" = `plan` od
sutra). Na događaj se menjaju samo dani u prozoru (§ 6.4), izgrađeni iz izvedene namere i biblioteke distance.

9.4. **Lični plan vlasnika** (`header.protected`): `replan` uvek vraća isti dokument i `changes: []`; umesto izmena
vraća se samo izveštaj čuvara (`rucno`) i, na događaj, tekstualni predlog u `Finding.message`. Zaštitu skida samo
vlasnik izričito.

## 10. Objašnjenje promene

`Change { eventId, scope (dan | nedelja | zaglavlje), dayId?, weekIndex?, what, before, after, reason, until }`.
`before`/`after` su kratki opisi („RP 2 × 2 km" → „lagano 5 km"). `reason` je jedna rečenica po obrascu
**šta se desilo → šta je promenjeno → do kada**, iz šablona teksta po paru (vrsta događaja, `what`); brojevi u
rečenici su iz stanja. Ekran grupiše po `eventId`. Primeri:
1. „Bio si bolestan 7 dana (14–20. 12), pa je prvih 11 dana lagano i kraće, bez brzih deonica; od 1. 1. plan se
   nastavlja kako je bio."
2. „Trčao si 10 km za 44:30, brže od forme po kojoj je plan pisan (45:34): tempa su ubrzana za 4–5 s/km, a
   očekivano vreme polumaratona je sada oko 1:38:50 (raspon 1:38:10–1:39:50)."
3. „Propustio si dugi od 16 km u nedelji 6, zato sledeći dugi ostaje 16 km umesto 17,5 km; ostatak plana je isti."

## 11. Distanca kao podatak

11.1. Folder `distances/<d>/` izvozi jedan `DistanceData` i ništa drugo; ne uvozi drugu distancu ni motor (osim
tipova). Sadrži tačno:
1. `id`, `version`, `distanceM`, `label`.
2. `levels[]` — pravila nivoa. 3. `templates[]` — po nivou, rasponu nedelja i dana (pokrivenost po § 4.2).
4. `library[]` — treninzi: lagani, dugi (lagan, progresivan, sa blokom), kvalitet po podražaju i obliku, dodaci
   (ubrzanja, kratki usponi), test, pripremna trka.
5. `safety` — `SafetyNumbers` (rast, plafon vrha, dugi, plafoni doza, lestvice, udeo brzog, lagani, WU/CD).
6. `adequate` — šta je adekvatna priprema (izvor upozorenja), uklj. kraću distancu za predlog.
7. `noteRules[]` — napomene po vrsti i trajanju treninga. 8. `presentation`. 9. `texts`.

11.2. **Zašto motoru ne treba grananje po distanci** — sve razlike su podatak:

| razlika | gde živi |
|---|---|
| dužina i tempo trke | `distanceM` → RP i njegova težina iz formule (§ 5.1, § 5.4) |
| maraton: dugi do 3 h, 30+ km | `safety.longMaxSec`, `longShareByRunDays`, `adequate.minLongKm`; `tail` sa dugim 3–4 nedelje pre trke |
| maraton: ishrana | `noteRules` („unos na 30–40 min" za dugi ≥ 90 min) i tekstovi nedelje trke |
| maraton: M tempo u dugom | unos biblioteke `finish-block` zone RP (za maraton RP ≈ M) |
| 5 km: brzina | podražaji `R`/`I` u `cycle`, unosi `reps` 200–400 m, plafoni doza u `doseCaps` |
| oporavak posle trke | trajanje napora iz stanja (§ 6.5) |
| taper | `tail` (1 nedelja za 5 km, 2–3 za maraton) |
| nivo, početnik (hod-trk) | `levels` + šabloni + unosi sa `effort`/hod koracima |

Test motora: u `engine/` nema niske sa imenom distance ni poređenja `distanceM` sa konstantom; sintetička distanca
od 3 unosa mora dati plan.

## 12. Prošetani primeri

Brojevi su računati formulama iz § 5–7. Podaci distance u primerima su ilustrativni (pravi nastaju u F3).

**(a) Nov plan: polumaraton, 30 km nedeljno, 4 dana (uto, čet, sub, ned; dugi nedelja), 10 nedelja, forma 1:41:00.**
Bez istorije trčanja. Start pon 16. 11. 2026, trka ned 24. 1. 2027.
- Forma: VDOT 44,6, pouzdanost srednja (izjava sa rezultatom). Tempa: E 5:52, T 4:40, I 4:18, RP 4:47 (težina 1,80).
- Baza: `B = 30 km × 5:52 = 176 BO`; `chronic = acute = 25,2`. Šablon „4 dana, jedan kvalitet + mali podražaj",
  `startPct 0,72` → `P = 176 / 0,72 = 245 BO`. Plafoni: prag `min(35, 0,11 × 245) = 26,9 min`, RP 36,7, I 17,1,
  blok u dugom 39,2. Najduži dugi `min(135, 0,42 × 245) = 103 min` (17,5 km); polazni `0,33 × 176 = 58 min`;
  korak 12 min. WU/CD 15/10 min. Dani: Q1 = čet (`d` = 3), Q2 = uto (mali podražaj), sub lagan, ned dugi.
- Raspon na dan trke: `r = 0,08`, `f_v = 1,2`, `W = 9` → `G = 0,86`; očekivano 1:40:00, raspon 1:38:25–1:41:59.

| ned | vrsta | cilj BO | dugi | kvalitet (čet) | uto / sub | km | brz udeo |
|---|---|---|---|---|---|---|---|
| 1 | build | 181 | 11,5 km | T 2 × 8 min | 4,5 + 4,5 | 28,4 | 10 % |
| 2 | build | 196 | 12,5 | T 2 × 10 min | 4,5 + 4,5 | 30,3 | 12 % |
| 3 | build | 210 | 14 | I 3 × 1000 m | 5 + 5 | 32,1 | 7 % |
| 4 | recovery | 171 | 11 | T 2 × 7 min | 4 + 4 | 26,5 | 9 % |
| 5 | build | 220 | 15 | RP 2 × 2 km | 6 + 6 | 35,6 | 9 % |
| 6 | build | 235 | 16,5 (4 RP) | RP 2 × 2 km | 5,5 + 5,5 | 36,1 | 19 % |
| 7 | peak | 245 | 17,5 (6 RP) | RP 1 × 3 km | 6 + 6 | 36,8 | 21 % |
| 8 | build | 208 | 14 | RP 2 × 2 km | 5 + 5 | 32,6 | 10 % |
| 9 | taper | 159 | 10,5 | RP 1 × 3 km | 3,5 + 3,5 | 24,8 | 10 % |
| 10 | race | 86 | trka 24. 1. | RP 1 × 1,5 km | 4 + odmor | 9,8 + trka | — |

Nedelja 1 po danima: uto 17. 11. lagano 4,5 km + 4 × 20 s ubrzanja; čet 19. 11. 15 min + T 2 × 8 min (oporavak 1:30)
+ 10 min = 43 min, 59 BO; sub 21. 11. lagano 4,5 km; ned 22. 11. dugi 11,5 km (68 min). Zbir 182 BO (cilj 181).
Pravilo rasta nigde ne veže (najveći korak +8 %). U nedelji 7 budžet brzog rada (23 %) dozvoljava blok do 47,6 min
i RP usred nedelje do 18,9 min; šablon traži 28,7 i 14,4, pa ne veže. Upozorenja: `mali-obim` ako
`adequate.minPeakWeeklyKm` > 37 (predlog: 4 dodatne nedelje ili 5. dan).

**(b) Ponovno planiranje: bolest 7 dana u 5. nedelji (14–20. 12), `today` = ned 20. 12.**
Stanje: nedelje 1–4 odrađene (182, 195, 212, 169 BO); posle pauze `chronic` 26,4 → 22,3, `acute` 30,4 → 10,3.
Forma: 2 dana preko petog × 0,3 % → 44,6 → 44,3 (1:41:31); razlika 0,3 < 0,5, tempa ostaju. Događaj
`pause:2026-12-14:2026-12-20`. Rampa `R = ceil(1,5 × 7) = 11` dana (21–31. 12), `f(n) = 0,4 + 0,6 n / 11`.

| dan | `n`, `f` | bilo | sada |
|---|---|---|---|
| uto 22. 12. | 2, 0,51 | lagano 5,5 km + ubrzanja | lagano 20 min (najmanje trajanje) |
| čet 24. 12. | 4, 0,62 | RP 2 × 2 km (46 min) | lagano 5 km (46 × 0,62 = 28 min) |
| sub 26. 12. | 6, 0,73 | lagano 5,5 km | lagano 4 km |
| ned 27. 12. | 7, 0,78 | dugi 16,5 km (4 RP) | dugi 13 km lagano, bez bloka |
| uto 29. 12. | 9, 0,89 | lagano 6 km + ubrzanja | lagano 5 km |
| čet 31. 12. | 11, 1,00 | RP 1 × 3 km | RP 1 × 2,5 km (kvalitet u rampi × 0,8) |

Nedelje posle rampe: pravilo rasta sa stvarnom istorijom. Nedelja 7: najveća od prethodne tri = 169 (ned. 4) →
cilj `min(245, 169 × 1,08) = 183 BO`; dugi `min(103, 76 + 12) = 88 min` = 15 km sa blokom 5 km (prvi blok posle
rampe × 0,8); sub postaje odmor (deo po danu < 25 min). Nedelja 8: `min(208, 183 × 1,08) = 198 BO`. Nedelje 9 i 10
nepromenjene. `changes`: 8 dana u nedeljama 6–7, 2 lagana dana u nedelji 8 (5 → 4,5 km) i 2 zapisa „obim" za
nedelje 7 i 8, svi sa istim `eventId`; objašnjenje je primer 1 iz § 10. Urađene nedelje 1–4 i propuštena nedelja 5 se ne diraju.

**(c) Preuzet plan starog formata u 3. nedelji, dve ručne izmene, jedan propušten trening, bez događaja.**
Plan 10 km, 12 nedelja, 4 dana; `today` = čet 3. nedelje. `alts` ima `g3d5` (subota: 8 km → 6 km) i `g4d1` (interval
→ lagano 7 km); `log` ima 8 urađenih i `g2d3` kao preskočen. `adopt`: 84 dana; `g3d5` i `g4d1` dobijaju
`origin: 'manual'` i `base` (stari sadržaj), ostali `adopted`; 8 trčanja sa `dayId`; `eventsFrom = today`;
`fingerprintLegacy === fingerprint` (84 jednaka reda). `deriveEvents` gleda samo dane posle `eventsFrom` → `[]`
(propušteni `g2d3` je pre preuzimanja). `replan(doc, state, [])` → isti dokument, `changes: []`. Sutradan, ako
trkač odradi planirano, opet `[]`. Čuvar može da prijavi `rucno` za `g4d1` (nedelja bez kvaliteta) — samo poruka.

**(d) Plan koji počinje dan posle polumaratona.** Trčao 1:41:00 u ned 15. 11; isti ulaz kao (a), start pon 16. 11.
`lastHardEffort { 101 min }` → `R = ceil(101 / 7) = 15` dana (16–30. 11), `f(n) = 0,4 + 0,6 n / 15`. Trka je u
istoriji: opterećenje dana `101 × 1,80 + zagrevanje ≈ 197 BO`, `acute` skače, forma ima pouzdanost visoka.

| dan | `n`, `f` | po šablonu | plan |
|---|---|---|---|
| uto 17. 11. | 2, 0,48 | lagano 4,5 km + ubrzanja | odmor (`f < 0,5`) |
| čet 19. 11. | 4, 0,56 | T 2 × 8 min (43 min) | lagano 4 km (43 × 0,56 = 24 min) |
| sub 21. 11. | 6, 0,64 | lagano 4,5 km | lagano 3,5 km (najmanje 20 min) |
| ned 22. 11. | 7, 0,68 | dugi 11,5 km | dugi 8 km lagano |
| uto 24. 11. | 9, 0,76 | lagano 4,5 km + ubrzanja | lagano 3,5 km, bez ubrzanja (`f < 0,8`) |
| čet 26. 11. | 11, 0,84 | T 2 × 10 min | T 2 × 8 min (doza × 0,8) |
| sub 28. 11. | 13, 0,92 | lagano 4,5 km | lagano 4 km |
| ned 29. 11. | 14, 0,96 | dugi 12,5 km | dugi 12 km |

Od 1. 12. plan je šablon iz (a). Upozorenje `povratak`: „Plan počinje dan posle polumaratona; prvih 15 dana je
oporavak, prvi brzi trening je 26. 11." Nema posebnog pravila za polumaraton: iste formule daju 4 dana posle 5 km
i 33 dana posle maratona.

## 13. Odluke, otvorena pitanja, šta nije u prvoj verziji

**Odluke koje sam doneo** (šta — zašto — pouzdanost da je ispravno):
1. Urađeno se ne čuva u `PlanDoc` nego kao `Run.dayId` u stanju — jedan izvor istine, plan ostaje bajt-isti kad se
   upiše trening. [visoka]
2. Tekst treninga bez brojeva tempa; tempa u zaglavlju — promena forme ne menja nijedan dan. Traži da ekran spaja
   zonu i tempo. [srednja: zavisi od F8]
3. Forma je VDOT; jedna skala za sve distance, formula javna i već korišćena u v3 znanju. [visoka]
4. Opterećenje = minuti × težina po brzini u odnosu na prag (1 / 1,5 / 2 / 3). [srednja]
5. Baza i umor = sredine 42 / 7 dana; povratak NE izlazi iz njih nego iz činjenica (trajanje napora, dani pauze)
   kroz jednu rampu. Brief traži povratak „iz stanja (umor, dani od trke)": koristim dane od trke i trajanje, a
   umor iz modela samo kao signal. [srednja; trener da potvrdi brojeve rampe 0,4 → 1, `D/7`, `1,5 × p`]
6. `startPct` u šablonu određuje vrh iz baze (`P = B / startPct`) — jedan broj umesto množilaca po dužini pripreme.
   [srednja]
7. `stimuli[]` je po važnosti, dani po pravilu razmaka; nema rasporeda po danu u šablonu. [srednja]
8. Neutralni događaji se ne upisuju u `appliedEvents` — inače bi „ništa" menjalo dokument. [visoka]
9. Propušten ključan trening menja samo sledeće isto mesto (ponavlja dozu), lestvica se ne pomera. [srednja]
10. Pauza ≥ 14 dana preračunava vrh; kraća samo rampu i pravilo rasta. Prag 14 je izbor. [niska]
11. Histereza tempa 0,5 VDOT / 14 dana; trka odmah od 0,3. [niska; proveriti na istoriji vlasnika]
12. Plafon napretka (§ 7.5) i svi brojevi signala forme (§ 7.2–7.4). [niska; F4 kalibriše]
13. Fazu (`PhaseId`), nivo i podražaj motor tretira kao neprozirne oznake; zna samo `WeekKind`. [visoka]
14. `types.ts` sadrži samo tipove i dve konstante verzije; brojevi modela (42, 7, težine, rampa) idu u
    `engine/constants.ts` u F2, sa upućivanjem na odeljak. [visoka]

**Otvorena pitanja** (ne blokiraju F2):
- (b) nedelja 7: blok 5 km RP u dugom dve nedelje posle bolesti — da li trener hoće strože (bez bloka dok ne prođe
  jedna puna nedelja)? Sada: × 0,8.
- Budžet brzog rada koristi `T_k` (BO) kao zamenu za vreme nedelje pre nego što su lagani dani poznati; formula u
  § 6.2 k. 6 to ispravlja, ali čuvar meri stvarni udeo — moguća razlika ≈ 1 procentni poen.
- Nedelja 1 u (a) ima 28,4 km (trkač navodi 30): posledica merenja u BO. Ako vlasnik želi „nedelja 1 ≥ sadašnji km",
  to je podatak šablona (`loadPct` prve nedelje), ne pravilo motora.
- Aplikacija ne čuva trčanja van plana sa trajanjem (F0): dok F9 to ne zatvori, forma i baza vide samo trčanja
  vezana za dan plana, a `vanPlana` ulazi sa procenjenim trajanjem.
- Izveden `fatigue` (`acute/chronic ≥ 1,5`) može da se okine posle svake trke; rampa posle napora ga već pokriva —
  F2 da proveri da se ne duplira (modifikatori se ne sabiraju, uzima se najmanji).

**Svesno NIJE u prvoj verziji:** jutarnja merenja (HRV, puls u miru, san) kao ulaz; teren, temperatura i profil
staze; snaga i mobilnost kao planiran sadržaj (prenose se samo kao `extras`); dva trčanja dnevno; više trka u planu
(pripremna trka je unos biblioteke, ne drugi cilj); plafon trajanja po danu (`maxMinutesByDay`); automatsko
prepoznavanje trke bez oznake `effort`; pomeranje treninga unutar nedelje kao odgovor motora (motor skraćuje i
menja vrstu, ne premešta dane); godine trkača.

## 14. Dopune organizatora na kapiji F1 (12. 11. 2026) — imaju prednost nad tekstom iznad

14.1. **Ništa brzo u prva 3 dana posle trke ili testa** (provera K2 rubrike; `coach/RUBRIC-V4.md`). U § 6.5, uz uslov
`f ≥ 0,8`, važi i `n ≥ 4` (dana od napora): pre toga nema kvaliteta, bloka u dugom ni dodatka `add-on` (ubrzanja,
usponi), bez obzira na trajanje napora (test 3 km i trka 5 km inače daju `R` 2–4 dana i kvalitet već 2–3. dana).
Isto važi za dan posle koga sledi test/pripremna trka iz plana: prvi kvalitet najranije 4. dana posle nje.

14.2. **Ispis za čoveka je deo motora** (`engine/render.ts`): `renderPlan(doc, state?, data) → string` daje ceo plan
kao tekst sa tempima iz `header.paces` (zona + tempo, ili opis napora kad je `byFeel`), km i trajanjem po danu,
zbirom nedelje (km, BO, udeo brzog rada), zaglavljem (cilj, polazna forma, današnja prognoza, očekivano vreme i
raspon na dan trke, upozorenja u tri rečenice) i, posle `replan`, spiskom promena sa objašnjenjem. Datumi u tekstu su
`17. 11.` (ne ISO); brojevi sa imenicom idu kroz jednu funkciju množine (`1 nedelja / 2 nedelje / 5 nedelja`);
decimalni zarez; bez internih izraza (BO, `stimulus`, ID-jevi) u tekstu koji vidi trkač — BO samo u zbirnom redu za
sudiju, pod zastavicom. Ovaj ispis čitaju sudije i vlasnik; provere K1–K5 rubrike se nad njim testiraju mašinski.

14.3. **Plafon napretka (§ 7.5) je previše oprezan kao polazna vrednost.** Vlasnik je za 18 nedelja očekivao više od
2 VDOT; primer (a) daje očekivanih 1:41:00 → 1:40:00 za 10 nedelja uz rast obima 30 %. Oblik formule ostaje; F4
kalibriše `r`, `G_max` i udeo `0,6` naviše na istoriji vlasnika i poznatim rasponima napretka rekreativaca, i
izveštava brojeve sa pouzdanošću. Motor te brojeve ne sadrži (žive u `fitness/`), pa F2 ne čeka.

14.4. **Vlasništvo fajlova.** `engine/vdot.ts` (VDOT iz rezultata, vreme za VDOT, tempo zone; § 5.4) i
`engine/constants.ts` piše tab motora i gura ih PRVE, kao zaseban commit — `fitness/` i `distances/` ih uvoze.
`fitness/` ne uvozi ništa drugo iz motora osim tipova i ta dva fajla.

14.5. **Otvoreno pitanje iz § 13 (blok u dugom posle bolesti)**: ostaje × 0,8 dok trener ne presudi; izmena je jedan
broj u `constants.ts`.

14.6. **Presuda trenera (`coach/SPEC-REVIEW.md`, 12. 11.) — prihvaćeno, menja § 6.5 i § 3:**
- Rampa posle pauze zavisi od razloga: bolest ili povreda `R = ceil(2,0 × dani)`; put/posao/odmor `1,0 × dani`;
  nepoznato `1,5 × dani`; dani se računaju najviše do 28 (umesto 21). Rampa posle napora ostaje `ceil(D / 7)`.
- Dok rampa traje, dugi ≤ 75 % poslednjeg odrađenog dugog (pre pauze/napora).
- Posle pauze ≥ 7 dana nema bloka/progresije u dugom dok nije odrađen jedan dugi BEZ bloka od ≥ 90 % dužine
  poslednjeg dugog pre pauze; prvi blok posle toga je najniži korak lestvice (`startPct`), pa redom. Za pauzu 3–6
  dana ostaje doza × 0,8. (Zamenjuje § 14.5.)
- Izveden `fatigue`: uz `acute / chronic ≥ 1,5` mora i opterećenje poslednjih 7 dana ≥ 1,2 × `B`.
- Tipovi (opciono, bez uticaja na motor u prvoj verziji osim gde piše): `profile.recentResult.date` (starost
  rezultata → pouzdanost forme u `fitness/`), `profile.birthYear`, `painHistory[]` (12 meseci; koristi ih `fitness/`
  i kasnije opreznost rasta).
- Plafon napretka (polazne vrednosti za F4, [niska–srednja]): `r` / `G_max` — < 1 god. 0,20 / 4,0; 1–3 god.
  0,13 / 2,5; > 3 god. 0,07 / 1,5; nepoznato 0,10 / 2,0; staž = godine strukturisanog treninga: bez dokaza kvaliteta
  u 12 nedelja istorije `r × 1,25` i `G_max + 0,5`.
- NIJE prihvaćeno za prvu verziju: nelinearna težina minuta u dugom (posle 90./150. min). Razlog: druga skala u
  jedinoj meri; dugi već ima sopstveni plafon. Vraća se na sto kod maratona (F7) ako ispisi pokažu potcenjen dugi.
