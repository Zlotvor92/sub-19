# 5K — kriterijumi prihvatanja

Važi za segmente 2–10 ovog ciklusa. Merenje: harnes `harness/run.ts` (REPRODUCE.md) nad skupovima `dev` (17), `edge` (29),
`qa` (3); osnovna linija je `reference/` na commitu `148c1c1`.

## 0. Pravila

1. **AI ocena (npr. „10/10", ocene AI trenera iz `docs/qa/`) nije kriterijum prihvatanja.** Može da ukaže gde gledati, ne da zatvori nalaz.
2. **Postojeći testovi nisu dokaz trenerske ispravnosti.** Testovi ekvivalencije (`fiveK/equivalence.node.test.ts`,
   `src/test/fixtures/fiveK-reference.json.gz`) dokazuju samo da se ponašanje nije menjalo, uključujući poznate greške. Namerna
   trenerska izmena svesno osvežava 5K referencu uz zapis razloga; ne „popravlja" se test da prođe.
3. Brojevi u odeljku „odluka" su **proizvodne/trenerske odluke**, ne naučni pragovi. Dok vrednost nije zapisana u
   `STATUS.md` → „Odluke" sa obrazloženjem, kriterijum se meri i prijavljuje, ali ne obara segment.
4. Svaka izmena 5K mora da ostavi izlaze 10K/HM/maraton identičnim (`reference/other/*` hash + postojeći testovi ekvivalencije).
5. Za svaki zatvoren nalaz: profil, nedelja/dan, pre i posle, ponovljiv ulaz. Hipoteza bez dokaza ostaje hipoteza.

Oznake: **[T]** tvrdo, automatski, obara segment · **[O]** meri se automatski, prag je odluka · **[R]** traži trenersku reviziju
(čovek trener ili korisnik kao vlasnik odluke; obrazloženje zapisano).

## 1. Tehnička ispravnost

| ID | Kriterijum | Merenje | Revizija |
|---|---|---|---|
| T1 | Svaki ulaz koji čarobnjak prihvata daje plan ili jasnu poruku; nema izuzetka | `index.json`: `error`/`notCreated`, nema `thrown` | — |
| T2 | Nema NaN/Infinity/praznog opisa trčanja | `analysis.issues` | — |
| T3 | `vol` nedelje = zbir dana (±0,05); `km` dana sa sesijom = `sessKm`; opis = `sessDesc`; vodeći „X km" u opisu = `km` | `analysis.issues` | — |
| T4 | Tempo sesije T/I/R = `paceForZone(vdot plana, zona)` (±1 s); RP = `meta.racePace` | `analysis.issues` | — |
| T5 | Determinizam: isti ulaz → isti hash; isti hash pod dva `TZ` | REPRODUCE §3 | — |
| T6 | Ulaz van modela se ne prevodi u tempo: VDOT iz rezultata u [20, 85] ili eksplicitna poruka/politika (F05) | `summary.vdot0` za E10, E29 | [R] koja politika za spore rezultate |
| T7 | Nijedan plan ne isporučuje trčanje kraće od `MIN_KM_PER_RUN` (1,5 km) osim trke/aktivacije; nijedna radna nedelja ispod `runDays × 1,5` km (F01) | po danu iz `plan.generated` | — |
| T8 | Upozorenja koja navode km navode isporučene vrednosti (± 1 km) (F04) | upoređivanje broja u tekstu sa `summary` | — |
| T9 | Izolacija: `npx vitest run --project node src/domain/generators/` zeleno; hash `reference/other/*` nepromenjen | REPRODUCE §4 | — |

## 2. Doslednost plana

| ID | Kriterijum | Merenje | Revizija |
|---|---|---|---|
| D1 | Faza koju prikaz pokazuje = faza koju je generator primenio (baza / ekonomija / vrhunac / oštrenje / deload / taper / trka) (F12) | `weeks[].displayPhase` prema poreklu faze iz generatora | — |
| D2 | Tekst fokusa nedelje odgovara sadržaju (npr. deload koji tvrdi „ostaje kratka oštrina" ima je) (F06) | `focus` prema `sessions`/`strides` | — |
| D3 | Prikazani laki tempo i tempo za vreme dolaze iz iste forme koju 5K koristi za odluke (F13) | jedinični test nad `useEasyPace`/`WeatherCard` + harnes adaptacije | — |
| D4 | Opis profila u kodu (namena faza i sesija) odgovara izlazu ili se menja opis (F07, F14) | broj sesija po zoni i fazi, `summary.rSessions` | [R] da li R/I/T po fazama |
| D5 | `meta.preparation` i poruke o spremnosti ne tvrde više nego što plan isporučuje | tekst prema `summary.preparation` | [R] šta je „pun pristup" za 5K |

## 3. Individualizacija

| ID | Kriterijum | Merenje | Revizija |
|---|---|---|---|
| I1 | Monotonost: više unete baze (isti ostali ulazi) ne daje manji isporučen vrhunac; više dana ne daje manji obim; sporiji rezultat daje sporija tempa | parovi profila koje harnes generiše variranjem jednog polja (dodati u segmentu 2) | — |
| I2 | Prva puna nedelja u ±15 % unete baze ili upozorenje sa tačnim brojem (postojeće `FIRST_WEEK_SHORTFALL_WARN`) | `summary.firstFullWeek` prema `inputWeeklyKm` | [O] da li važi i za 2–3 dana |
| I3 | Readiness (`beginner`/`returning`/`developing`/`experienced`), effort-first i run/walk daju različit, obrazložen ulaz u kvalitet | sesije prvih 4 kvalitetne nedelje po profilu | [R] |
| I4 | Profil koji aplikacija ne može da predstavi se evidentira, ne zamenjuje (F22) | lista u FINDINGS §E | [R] proizvodna odluka |

## 4. Smisao i progresija treninga

| ID | Kriterijum | Merenje | Revizija |
|---|---|---|---|
| S1 | Gornje granice zona po sesiji: I ≤ 8 %, T ≤ 10 %, R ≤ 5 % nedelje; I deonica ≤ 5 min, R ≤ 2 min, neprekidan T ≤ 20 min (postojeća pravila koda) | `pctI/pctT/pctR`, `maxRepSec` | izvor procenata nije proveren u primarnoj literaturi (v. `GENERATOR_REBUILD_CONTEXT.md` §2) |
| S2 | Jedna definicija svakog plafona (F14) | statička provera konstanti | — |
| S3 | Donja doza kvaliteta u radnim nedeljama vrhunca (min. rada po zoni ili udeo budžeta) (F08) | `zoneKm`, `qualityMin` po nedelji | [O]+[R] vrednost praga |
| S4 | Udeo zagrevanja/hlađenja u kvalitetnoj sesiji (F08) | `wuKm+cdKm` prema radu | [O]+[R] |
| S5 | Prepoznatljiv redosled faza po profilu (ekonomija → vrhunac → oštrenje) i prisustvo familija koje profil obećava (F07) | niz `sessions` po nedeljama | [R] |
| S6 | Rast obima radnih nedelja ≤ odlučenog praga; izuzetak (mali apsolutni korak) eksplicitan (F09) | `growth[].ratio` (bez delimične reference) | [O] prag |
| S7 | Vrhunac obima u odnosu na bazu i trajanje ciklusa (F10) | `summary.peakVol`, `peakOverInput` | [R] |

## 5. Raspored opterećenja i oporavka

| ID | Kriterijum | Merenje | Revizija |
|---|---|---|---|
| R1 | Generator sam ne pravi susedne zahtevne dane (kvalitet/LR/trka) kad ima slobodnih dana; korisnički izbor sme, uz upozorenje (F03) | `adjacency` za profile bez `runDows`/`qDays` = 0 | — |
| R2 | LR je najduže trčanje nedelje i udeo LR ≤ odlučenog praga po broju dana; pravila ne smeju biti nezadovoljiva (F02, F11) | `lrShare`, `easyOverLr` | [O] prag po broju dana |
| R3 | LR ≤ vremenski plafon (90 min) i apsolutni (20 km) osim zapisanog izuzetka | `lrMin`, `lrKm` (E10: 91,2 min) | [O] |
| R4 | Deload: ritam i dubina dosledni nameri; ako nosi kvalitet — stvarno ga nosi (F06) | `deloads[]` | [R] da li deload nosi kvalitet |
| R5 | Taper i trkačka nedelja: obim prema vrhuncu, broj i vrsta kvaliteta, aktivacija (F24/F25) | `summary.taper`, nedelja trke | [R] |
| R6 | Lak dan posle LR-a nije duži od LR-a bez razloga (F17) | `afterLongRun[].ratio` | [O] |
| R7 | Adaptacija: smanjenje ne briše kvalitet duže nego što pravilo kaže; svaki signal (umor, propust, pauza) ima put i u planu bez lakih dana (F18–F20) | `adaptation.*.afterQuality`, `recommendation` | [R] |

## 6. Prikaz i zaštita podataka

| ID | Kriterijum | Merenje | Revizija |
|---|---|---|---|
| P1 | Prikaz (faza, tempo, fokus, upozorenja) iz 5K generatora, ne iz zajedničke računice | D1, D3, T8 | — |
| P2 | Prošli, odrađeni, ručno izmenjeni, pomereni i merom zaključani dani, ID-jevi, `log/alts/moves/pred/predLock` ostaju posle svake adaptacije | postojeći `features/onboarding/fiveKFlow.test.tsx`, `fiveK/equivalence.node.test.ts` („prot" tokovi), E2E `final-preservation.spec.ts` | — |
| P3 | Sačuvani planovi se ne regenerišu pri učitavanju; nova polja kompatibilna unazad | `architecture.node.test.ts`, učitavanje starog `genPlan` iz reference | — |
| P4 | Nijedna izmena 5K ne menja 10K/HM/maraton | T9 | — |

## 7. Zatvaranje segmenta

Segment je zatvoren kada: sva [T] za njegove nalaze prolaze na `dev`+`edge`+`qa`; [O] sa zapisanom odlukom prolaze; svaka razlika
prema `reference/` je objašnjena po profilu; [R] stavke su navedene sa dokazom i čekaju ili imaju zapisan sud trenera;
`npm run check` i T9 zeleni.
