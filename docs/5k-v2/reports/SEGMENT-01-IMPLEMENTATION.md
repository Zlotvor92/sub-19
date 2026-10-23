# Segment 01 — 5K v2 jezgro: izveštaj o implementaciji

- **Grana:** `claude/generator-isolation-5k-10k-hm-marathon`
- **Polazni SHA:** `1f5dc4272b869653a703ed9fb6708e33161f8a1a`
- **Verzija pravila na kraju segmenta:** `5k-v2.0.1` (`web/src/domain/generators/fiveK/v2/policy.ts`)
- **Status:** jezgro završeno za zadati početni opseg; NIJE povezano sa `select.ts`, UI-jem ni store-om
  (nije aktivirano).

## Šta je urađeno

1. Novi modul `web/src/domain/generators/fiveK/v2/` — čist domen (bez `Date`, sata, slučajnosti,
   spoljnih paketa), deterministički: isti ulaz → isti JSON (proveravano testom i dvostrukim
   pokretanjem primera — isti md5).
2. Pravila v2 su u jednom objektu `FIVE_K_V2_POLICY` (`version`), svaki prag sa komentarom da je
   heuristika. Promene posle pregleda primera zapisane u `DECISIONS` (2.0.0 → 2.0.1).
3. Ulaz → strukturisano odbijanje sa svim razlozima odjednom (`{ code, message, week? }`), bez fallback-a.
4. Plan: VDOT i tempo (sopstvene Daniels–Gilbert jednačine), faze kao podatak nedelje, ciljni km
   samo u `volume.ts`, treninzi sastavljeni iz komponenti (km/trajanje računati, `exact`/`estimated`),
   raspored 4 dana sa ciklično nesusednim zahtevnim danima, `validate.ts` koji samo prijavljuje.
5. Ako konstrukcija ne može da ispuni pravila → odbijanje (`QUALITY_INFEASIBLE`, `WEEK_INFEASIBLE`,
   `RUN_DAYS_SPACING`, `PLAN_VIOLATES_POLICY`). Nema petlje smanjivanja/dopunjavanja: ponavljanja se
   biraju jednim prolazom kroz fiksnu ponudu.
6. 4 test fajla (117 testova) + skripta primera sa 13 profila.

## Šta NIJE urađeno (van opsega ili otvoreno)

- Nije povezano ni sa čim (select.ts, UI, store, exchange) — namerno.
- Nema adaptacije tokom plana, vremena/temperature, istorije aktivnosti, 3/5/6 dana, run-walk.
- Konflikt „lagan trk duži od dugog" nije razrešen, samo prijavljen (v. Poznati problemi).
- Dan pred trku može dobiti lagan trk iste dužine kao ostali lagani dani u trkačkoj nedelji (npr. 6 km).
- Taper / trkačka nedelja: min. laganog trka spušten na 2 km (odluka 2.0.1, (6)).

## Fajlovi i svrha

| Fajl | Svrha |
|---|---|
| `fiveK/v2/policy.ts` | `FIVE_K_V2_POLICY` (version `5k-v2.0.1`) + `DECISIONS` |
| `fiveK/v2/types.ts` | ulaz/izlaz, razlozi odbijanja, struktura treninga |
| `fiveK/v2/dates.ts` | ISO datumi kao broj dana (bez `Date`); dodat pored liste iz zadatka |
| `fiveK/v2/input.ts` | `checkInput` → `{ok:true,input}` / `{ok:false,reasons}` |
| `fiveK/v2/paces.ts` | VDOT, prognoza, tempo E/T/I/R/RP, procena cilja |
| `fiveK/v2/periodize.ts` | nedelje → faza, rasterećenje, korak tapera |
| `fiveK/v2/volume.ts` | jedino mesto za ciljni km nedelje |
| `fiveK/v2/workouts.ts` | konstrukcija treninga iz blokova, budžeti, izbor ponavljanja |
| `fiveK/v2/schedule.ts` | šablon 4 dana (q1, q2, dugi, lagan) |
| `fiveK/v2/validate.ts` | `validatePlan` → lista prekršaja (error/warning) |
| `fiveK/v2/generate.ts` | `generateFiveKV2(input)` → plan ili odbijanje |
| `fiveK/v2/index.ts` | javni izvoz |
| `fiveK/v2/testInputs.ts` | zajednički test-profili (nije test fajl) |
| `fiveK/v2/*.node.test.ts` | `generate`, `validate`, `workouts`, `isolation` |
| `docs/5k-v2/artifacts/segment-01/run.ts` | generisanje primera |

Svi v2 fajlovi uvoze se sa `.ts` ekstenzijom, da bi skripta primera radila direktno u Node 22
(type stripping) bez novih zavisnosti. Postojeći izolacioni test fiveK razrešava i takve putanje.

## Podržani ulazi (sve ostalo → odbijanje)

- `runDays`: tačno 4 različita dana; moraju dozvoliti 3 ciklično nesusedna zahtevna dana
  (npr. pon–čet ne može → `RUN_DAYS_SPACING`).
- `currentWeeklyKm` 15–45.
- `recentResult`: 3000/5000/10000 m, datum ≤ start i najviše 84 dana pre starta, VDOT 30,0–60,0
  (zaokružen na 0,1).
- `startDate`…`raceDate` uključivo = 8–16 celih nedelja; trka je poslednji dan.
- `goalTimeSec` opciono; samo procena (`feasible`/`ambitious`/`unrealistic` po razlici VDOT-a ≤ 1 / ≤ 2,5 / > 2,5).
- Podržan ulaz može i dalje biti odbijen kao neizvodljiv: npr. 15 km + VDOT ~53 (rasteretni I budžet
  1,11 km ne prima 2×600 m, a 500 m traje < 2 min). U jednokratnoj mreži od 900 ulaza (5K
  17:00–30:00, 15–45 km, 8–16 ned, 4 rasporeda; skripta nije u commitu) bilo je 696 planova, 24 `QUALITY_INFEASIBLE`, 180 `VDOT_OUT_OF_RANGE`,
  0 planova sa greškom pravila.

## Odstupanja od pravila iz prompta

Sva su zapisana u `policy.ts` → `DECISIONS` (`5k-v2.0.1`). Pod 2.0.0 (doslovno pravila iz prompta)
7 od 10 podržanih profila je odbijeno; tabela tog stanja: `docs/5k-v2/artifacts/segment-01/plans-v2.0.0-review.md`.

| # | Pravilo iz prompta | 2.0.1 | Zašto |
|---|---|---|---|
| 1 | Rasterećenje „sa jednim kratkim kvalitetom" | jedini kvalitet koristi pun budžet rasteretne nedelje | 60% budžeta nije sastavljalo ni minimalan trening do ~35 km; „kratak" = 80% obima i 1 umesto 2 kvaliteta |
| 2 | Zagrevanje 2–3 km, hlađenje 1,5–2 km | < 25 km/ned: 1,5 / 1,0 km; 25–35: 2/1,5; 35–45: 2,5/1,5; ≥ 45: 3/2 | pri 15–24 km dva kvalitetna dana sa 3,5 km zagrevanja+hlađenja ostavljala su < 3 km za lagan trk |
| 3 | R 200–400 m, I 800–1200 m | R do 150 m, I do 600/500 m (I ponavljanje ≥ 2 min), RP do 400 m; bira se prva (najduža) opcija koja popuni ≥ 70% budžeta | budžeti 5–8% pri 15–20 km ne primaju 4×200 R ni 2×800 I |
| 4 | Vrhunac: „T cruise kao drugi" | ako T budžet < 2×1 km → kontinuirani T | cruise sa < 2 ponavljanja nema smisla |
| 5 | Vrh ≤ 1,3 × start | i ≤ 50 km za 4 dana | lagan trk raste preko ~17 km (v. Poznati problemi) |
| 6 | (nije zadato) | min. lagan trk 3 km; u taperu/trkačkoj nedelji 2 km | 15 km/8 ned: taper 2 ostavljao 2,6 km po laganom trku |
| 7 | (nije zadato) | budžeti zaokruženi naniže na 10 m | zaokruživanje naviše je probijalo R ≤ 5% (19,9 km → 1,00 km R) |

Ostale trenerske odluke (moje, unutar pravila prompta): tempo I = 0,975 VDOT-a (≈ Danielsove tabele),
R = 1,055, T = 0,88, E = 0,62–0,70; RP = prognoza 5K iz rezultata. Faze: oštrenje 2 ned ako ima ≥ 7
nedelja izgradnje, inače 1; ostatak pola baza / pola vrhunac (baza dobija neparnu). Rasterećenje na
nedeljama 4, 8, 12 ako su u izgradnji i nisu poslednja nedelja izgradnje. Oštrenje drži obim.
Kvalitet po fazi: baza R + kratak T + ubrzanja na laganom danu; vrhunac I + T cruise; oštrenje RP +
kratka R; taper 1 RP + kratak T; taper 2 samo RP + ubrzanja; trkačka nedelja RP oštrenje ≥ 2 (poželjno
≥ 3) dana pre trke. Ubrzanja (4×20 s) se ne računaju u R udeo. Dugi trk: min(30% nedelje, 90 min po
sporijoj granici E). Lagan trk = ostatak nedelje.

## Komande i rezultati

Potvrđeno izvršavanjem (u ovoj sesiji, Node v22.22.0, iz `web/` osim gde piše):

| Komanda | Rezultat |
|---|---|
| `npx tsc -p tsconfig.domain.json --noEmit` | 0 grešaka |
| `npx eslint src/domain/generators/fiveK/v2/` | 0 grešaka |
| `npx vitest run --project node src/domain/generators/fiveK/v2/` | 4 fajla, 117/117 prolazi |
| `node docs/5k-v2/artifacts/segment-01/run.ts` (iz korena) | 10 planova, 3 odbijanja; dva uzastopna pokretanja → isti md5 |
| `npx vitest run --project node src/domain/generators/` | 17 fajlova, 225/225 prolazi (108 postojećih + 117 novih), 8 min 59 s |
| `npm run check` | 1. pokušaj PAO na `typecheck`: TS2352 u mom `validate.node.test.ts` (kast `readonly Segment[]`) → ispravljeno (`as unknown as`). 2. pokušaj: typecheck, lint, format:check OK; `vitest run` 177 fajlova, 1854/1854 prolazi, 11 min 56 s, exit 0 |

Poređenje sa `fiveK/training/vdot` (jednokratni lokalni test, obrisan, NIJE u commitu): VDOT iz
rezultata i prognoza 5K identični na 3 decimale (5K 19:57 → 49,952; 10K 50:00 → 40,012; 3K 12:00 →
47,851). T i E (brža granica) identični; R ±1 s/km; I je 5–7 s/km sporiji jer v2 koristi 0,975
umesto 1,0 vVO2max (VDOT 50: 3:55 vs 3:50).

Potvrđeno `git status`-om: nijedan postojeći fajl nije menjan (samo novi fajlovi). Regresija generatora je
pokrenuta pre ispravke kasta u testu (ispravka menja samo tip u test fajlu; ti testovi su ponovo
prošli u `npm run check`).

Samo pregled koda: da `select.ts`/UI/store ne uvoze v2 proverava i test
`isolation.node.test.ts`.

## Primeri

`docs/5k-v2/artifacts/segment-01/`: `run.ts`, `inputs.json`, `<id>.json` (pun rezultat: plan ili
odbijanje), `plans.md` (tabela po planu), `plans-v2.0.0-review.md` (stanje pre izmena pravila).
Razvojni: `dev-01`…`dev-06` (VDOT 32–58, 20–42 km, 9–16 ned). Granični: `edge-15km-8w`,
`edge-45km-16w`, `edge-result-12w`, `edge-vdot30`. Odbijeni: `rej-3-days`, `rej-consecutive-days`,
`rej-old-fast-long`.

## Poznati problemi

1. **Lagan trk duži od dugog** (upozorenje `EASY_LONGER_THAN_LONG`) u većini nedelja izgradnje
   kod 20–50 km: sa 4 dana, dugi ≤ 30% i kvalitetnim danima ~35–40% nedelje, ostatak (31–37%) ide u
   jedan lagan dan. Probano kao greška (lagan ≤ 30%) → svih 10 profila odbijeno, pa vraćeno na
   upozorenje. Treba trenerska odluka: npr. podići udeo dugog za 4 dana, ili dozvoliti „srednje dugi"
   lagan trk, ili niži cilj nedelje.
2. Kada je lagan dan dan pre dugog (npr. pet/sub), to je najveći blok nedelje zaredom (do ~30 km).
3. Kod 45 km starta vrh je 50 km već u 3. nedelji, pa baza traje 6 nedelja na istom obimu i istim
   treninzima (monotono, ali u skladu sa pravilima).
4. Validator proverava `PLANNED_VS_TARGET` u trkačkoj nedelji samo kao upozorenje (izostavljeni lagani
   dani).
5. Opseg v2 je samo početni (4 dana, 15–45 km, VDOT 30–60); ništa nije provereno na stvarnim
   korisnicima.
