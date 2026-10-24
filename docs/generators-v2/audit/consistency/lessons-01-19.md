# Doslednost distanci — pouke 1–19 (MASTER § 2)

Ugao 5, samo čitanje koda + kratke probe (skripte van repoa, scratchpad; seed nije potreban — mreže su
determinističke, ulazi navedeni uz nalaz). Grana `claude/generator-isolation-5k-10k-hm-marathon`. Poznato
(POSLE-MERGE, FINAL-2026-10-23, ODLUKE-4a) nije ponovo prijavljeno.

Skraćenice putanja: `5K/` = `web/src/domain/generators/fiveK/v2/`, `10K/` = `…/tenK/v2/`, `HM/` = `…/halfMarathon/v2/`,
`MAR/` = `…/marathon/v2/`; `pol` = `policy.ts` (DECISIONS). 5K DECISIONS su po verziji (red u `pol` = početak unosa).

## Tabela

| pouka | 5K | 10K | HM | MAR | razlika / nalaz |
|---|---|---|---|---|---|
| 1 cilj iz konstrukcije, rupa samo ta nedelja, vrh se ne spušta, regresija vrhova | `volume.ts:139` fitTargetKm; `pol:595` (2.5.0 (2)(3)); fixture `segment05b.peaks-7b4b574.json` | `volume.ts:137` fit10; D6 `pol:58`; `segment02b/03.*` | `volume.ts:161` fit10; H6 `pol:57`, HI2 `pol:166`; `segment03.regression-exceptions.json` | `volume.ts:178` fit10; M6 `pol:51`; `segment02.regression-01.json` | dosledno |
| 2 dugi ≥ lagan (tvrdo), udeo po broju dana | `validate.ts:980` EASY_LONGER_THAN_LONG; udeli `pol:29/38/47` (45/35/30 %); 2.1.0 (1) `pol:505` | `validate.ts:589`; D13/D17 `pol:108,136`; udeli `pol:494–521` | `validate.ts:706`; H13 `pol:107`; `pol:497–524` | `validate.ts:677`; M13 `pol:117`; `pol:484–511` | dosledno (brojevi po distanci) |
| 3 glavna doza ne opada, bez identičnih, baza bez platoa, ista doza druge strukture | DOSE_PROGRESSION/QUALITY_REPEAT/BASE_R_DECREASE/BASE_PLATEAU `validate.ts:899–945`; „ista doza do 2 ned" 2.2.0 (3) `pol:530`; `quality.denser` 2.4.0 `pol:572` | MAIN_DOSE_DECREASE/IDENTICAL_WEEKS/BASE_PLATEAU `validate.ts:939–978`; D12 `pol:101` | `validate.ts:1153–1208`; H12 `pol:99` | `validate.ts:1078–1127`; M12 `pol:110` | 5K drugačija arhitektura (doza po fazi, 2 iste nedelje baze, kraći oporavak) — zapisano u 2.2.0/2.4.0 |
| 4 rasterećenje: ne 1. ned faze, ne ned 1–2, ne pred taperom | `periodize.ts:54–65` (svaka 4., početnik 3.; pomeranje na n − 1) — **nema zabrane ned 1–2** | `periodize.ts:72–80` deloadAllowed (firstAllowedWeek); D5 `pol:50` | `periodize.ts:64–72`; H5 `pol:49` | `periodize.ts:68–76`; M5 `pol:44` | **N1** (5K početnik 8 ned: rasterećenje ned 2) |
| 5 trkačka nedelja | dan pred trku ≤ 4 km `pol:287`, `validate.ts:332–346`; oštrenje ≥ 3 d `validate.ts:311–315`; lagan ≤ 50 min/50 % dugog `pol:290`; ≤ taper (pouka 30) 2.8.1 `pol:688`; minimum 4 km `pol:297` | D8/D20/D23/D30 `pol:73,158,187,233` | H8 `pol:71`, A18 `pol:364` | M8 `pol:74`, N1 `pol:289` | **N7** (5K „≤ 4 km" umesto ≤ 30 min; lagan ≠ ≤ lagan tapera) |
| 6 validator prijavljuje; plafon po zoni; WU/CD nisu pufer; odbijanje umesto degenerisanog | WU/CD po **ciljnom km nedelje** `workouts.ts:184–188`, `pol:300–309`, 2.0.1 (2) `pol:485`; T = min(udeo, vreme faze) `workouts.ts:386–393` | WU/CD po ulaznom obimu, konstantno D14 `pol:115`; D11 `pol:94`; D15 `pol:122` | H14 `pol:114`; H11 `pol:92` | M14 `pol:132`; M11 `pol:102` | **N3** (5K WU/CD menja se sa ciljem nedelje) |
| 7 adaptacija: povratni rast, donja granica, coverage, pauza, prioritet, zaštita | 2.6.0 (1)(2)(3) `pol:629`, 2.5.0 (7) `pol:608`; granica 9/12/15 km (dokumentovano) | A7–A11 `pol:303–336` | A7–A11 `pol:301–332` | A7–A11 `pol:219–255` | dosledno; 5K donja granica izgradnje viša — zapisano (2.6.0 (2)) |
| 8 aplikacija (prekidač, bez tihog v1, pregled+potvrda, fullSync) | `generators/flags.ts:29–47` (zajedničko); `app/adapt.ts:165` adaptPreview; `app/facts.ts:14` fullSync | isto; `app/adapt.ts:130`; `app/facts.ts:14` | isto; `app/adapt.ts:134`; `app/facts.ts:16` | isto; `app/adapt.ts:133`; `app/facts.ts:16` | dosledno za pročitano; „trka van obima u prikazu" i „uvoz čuva trčanja van plana" **nepotvrđeno** (UI sloj, ugao 6) |
| 9 kapacitet; ned 1 < obim samo uz dugi na vremenskom plafonu | start = min(obim, kapacitet) + START_ABOVE_CAPACITY `validate.ts:713–726`; kapacitet uz dugi na plafonu (udeo ili 90 min) 2.4.0 `pol:572` | **nema provere** (`validate.ts:1511–1513` samo start); `feelGrid.harness.node.test.ts:117–122` očekuje 132 plana ispod obima zbog udela | WEEK1_BELOW_START `validate.ts:1779–1793`, HI8 `pol:195` | VOLUME_START `validate.ts:1284–1292`, M6/M13a | **N5** (10K); 5K razlika zapisana (2.2.0 (1), upozorenje) |
| 10 najniži nivo lestvice u plafonu pri najmanjem obimu reda | ponude kraćih opcija 2.0.1 (3) `pol:485`; nema testa | nije zapisano ni testirano; 3 d 20 km: RP 2 × 1200 m > 10 % | H11 `pol:92` („30 km"); test `quality.node.test.ts:95–99` samo 30 km | test po redu `policy.node.test.ts:286–303` | **N9** (10K; HM tekst/test zastareo) |
| 11 druga struktura 100 m, pa 50 m; najmanja deonica po zoni | ponude opcija (`pol` 2.0.1 (3), 2.1.0 (9)); min trajanje I `pol:177` | D10/D22/D22b `pol:87,172,180` | H10/HI1 `pol:85,145` | M10/M10a `pol:88,95` | 5K drugačija arhitektura (liste opcija) — zapisano |
| 12 doza sme da padne samo u nedelji ograničenoj kapacitetom | samo R u bazi, DOSE_DROPPED `validate.ts:915–931`, 2.8.1 N2b `pol:688` | D12 `pol:101` | H12 `pol:99`, HI15 | M11/M12 `pol:102,110` | dosledno (5K I/RP neopadajući bez izuzetka, zapisano 2.2.0) |
| 13 početnik nema test; test ne „jede" nedelju | **početnik po osećaju ima kontrolno trčanje** (`generate.ts:93` periodize(…, a.feel)); 2.10.2 `pol:822` (test otpada prvi) | D32 `pol:249`; D27 `pol:210` | H17 `pol:137`, HI11 `pol:227` | M16/M17 `pol:147,155` | **N2** (5K) |
| 14 kvalitetni dan duži od dugog → upozorenje + preporuka manje dana | LONG_NOT_LONGEST samo uz 2 kvaliteta `validate.ts:276–285`, bez preporuke | D25 `validate.ts:617–632` (bez dana testa) | HI3, HI11 (f) `validate.ts:755–772` (sa danom testa) | N10.5 `validate.ts:700–718` (bez dana testa) | **N8** |
| 15 meri celu mrežu pre/posle | fixture-i heševa `5K/segment0*.json` | `10K/segment0*.json` | `HM/segment0*.json` | `MAR/segment0*.json` | proces, ne kod — dosledno |
| 16 adaptiran plan: tempo/osnova NEDELJE; bez koraka = generator | `steps.ts:53` pacesAt; `generate.ts:348` construct(input) | `steps.ts:47–58`; `generate.ts:69` construct(input, []) | `steps.ts:52–58`; `generate.ts:93`; test `adapt.node.test.ts:618` | `steps.ts:86–100`; `generate.ts:100`; test `adapt.node.test.ts:55` | dosledno |
| 17 rezultati su činjenice; po osećaju do nedelje rezultata | 3/5/10 km `pol:64`, `assess.ts:157`; app napomena `app/facts.ts:344–349` | 3/5/10/HM `pol:436`, `assess.ts:147` | 5/10/HM/MAR `pol:484`; test 3 km samo napomena `app/facts.ts:352–365` (ODLUKE-4a MAR-06 p. 1) | 5/10/HM/MAR + RESULT_5K (M1) | **N6** (predaja HM/MAR → 5K/10K) |
| 18 bol: sidro r, osnova povratka, doza iznova od r + 1, mreža svakog dana | `volume.ts:227` returnBaseKm; `steps.ts:248–257` doseResetAt (r + 1) | `volume.ts:211` returnBase10; **`steps.ts:113–115` restart samo nov start** | `volume.ts:224`; `steps.ts:113–123` (r + 1, preStart); test `adapt.node.test.ts:631` | `volume.ts:251`; **`steps.ts:158–160` samo nov start**; A4 `pol:196` | **N4** (10K, MAR) |
| 19 promena cilja: budući dani zaključani → samo ocena | `app/adapt.ts:390`; test `app/adapt.node.test.ts:388` | `app/adapt.ts:282`; `app/adaptFlow.node.test.ts:439` | `app/adapt.ts:287`; A15 `pol:351`; test `:540` | `app/adapt.ts:281`; A11 `pol:249`; test `:541` | dosledno (MAR bez prefiksa — nije cilj predaje) |

## Nalazi

**N1** | 5K | `5K/periodize.ts:54–65` (deloadWeeks: početnik `deloadEvery` 3 `pol:267`; kad ned 3 počinje vrhunac, pomera
se na n − 1 = 2; nema `firstAllowedWeek` kao `10K/periodize.ts:76`) | **T** (krši pouku 4 tiho; validator
`5K/validate.ts:727` proverava samo prvu nedelju faze) | Dodati „ne pre ned 3" u deloadWeeks (jedno mesto) i u
validator; ili izostaviti rasterećenje kao kod kratke pripreme. Meriti mrežu početnika pre/posle | **potvrđeno**:
probe svih 8-nedeljnih planova početnika u uzorku (3/4 d × 12–30 km × rezultat/osećaj) → 18/18 rasterećenje u ned 2,
npr. 8 ned, 3 d (uto/čet/ned), 12 km, 5 km 30:00: ciljevi 12 / **9,6** / 12,6 / 13,2 …; ned 2 je i uvod (2.4.0).
Redovni planovi (6–16 ned, 3–5 d): 0/220.

**N2** | 5K | `5K/generate.ts:93` (`periodize(…, rules.deloadEvery, a.feel)` — test za svaki plan po osećaju, i
početnika); `5K/validate.ts:412` očekuje test i kod početnika | **T** (pouka 13; 10K D32 obrazloženje: kod malog
obima test je ≈ pola nedelje) | Početnik bez kontrolnog trčanja (kao 10K D32 / HM H17 / MAR M17) ili zapisati
razlog u DECISIONS | **potvrđeno**: 84/84 planova početnika po osećaju (8–16 ned, 3/4 d, 12–25 km) imaju test; npr.
8 ned, 3 d, 12 km, lagan 6:00: ned 3 cilj 12,6 km, dan testa 5,5 km (44 %), dugi 4,1 km.

**N3** | 5K | `5K/workouts.ts:184–188` warmupBand(**targetKm** nedelje), `5K/pol:300–309`, `5K/validate.ts:992–993`;
obrazloženje 2.0.1 (2) `5K/pol:485` („ispod ~25 km … ostavlja < 3 km za lagan trk") | **T** (zapisano, ali je
obrazloženje upravo pufer: suprotno stalnom uslovu 3 i pouci 6; za HM/MAR „WU/CD po cilju nedelje" izričito odbačeno
u pouci 35; 10K/HM/MAR: pojas po ulaznom obimu, konstantno) | Odluka organizatora: pojas po ulaznom obimu
(konstantno) ili izričit izuzetak 5K u MASTER-u; meriti kapacitet malog obima | potvrđeno (kod); uticaj nemeren.

**N4** | 10K, MAR | `10K/steps.ts:113–115` i `MAR/steps.ts:158–160` restartWeeks = samo `s.restart` (nov start);
HM `steps.ts:116–123` dodaje `returnFrom.week + 1`, 5K `steps.ts:248–257` doseResetAt; MAR A4 `pol:196` i M18
navode pouku 18, ali bez „doza iznova od r + 1" | **T** (posle bola obim kreće od 0,7 × nivoa, a doza kvaliteta
nastavlja nivo pre bola; validator to dozvoljava — A9 „uz manji cilj glavna doza sme da padne") | Uskladiti sa
HM/5K (restartWeeks + returnFrom.week + 1, ista funkcija za konstruktor i validator) ili zapisati razlog u D/M
DECISIONS; meriti mrežu bola | **potvrđeno** kod oba; primer samo 10K: 14 ned, 4 d (uto/čet/sub/ned), 40 km,
10 km 45:00, bol 5 sreda ned 6 → ned 9 (cilj 40,3) **T 3 × 1200 m** (nastavak); isti ulaz HM → T 2 × 1200 m,
I 2 × 1000 m (iznova). MAR: uticaj nemeren.

**N5** | 10K | nema provere ned 1 (`10K/validate.ts:1511–1513` samo `startKm`); D6 `pol:58` bez pravila pouke 9;
`10K/feelGrid.harness.node.test.ts:117–122` zaključava 132 plana (po osećaju, 4 d) sa ned 1 ispod obima zbog udela
33 %, ne zbog 105 min | **T** (pouka 9; otvoreno od `docs/10k-v2/reports/SEGMENT-03-IMPLEMENTATION.md:112`
„Preostali problemi", bez odluke; HM je isto rešio udelom 4 d 40 % — H15) | Odluka: udeo 4 d ili WEEK1_BELOW_START
(kao HM HI8) uz merenje | potvrđeno (brojka iz testa; plan nosi CAPACITY_LIMITED, nije potpuno tih).

**N6** | 5K, 10K (kao cilj predaje) | skup distanci rezultata: 5K `pol:64` 3/5/10, 10K `pol:436` 3/5/10/HM,
HM/MAR 5/10/HM/MAR. Izvor šalje `pb` i sirove `results` bez filtra (`HM/app/preparation.ts:95–121`), cilj ih ne
filtrira (`5K/app/handoffTarget.ts:62–76, 91`; `10K/app/handoffTarget.ts:91`) → `5K/input.ts:140`
RESULT_DISTANCE_UNSUPPORTED / `5K/assess.ts:157` ADAPT_RESULT_INVALID; 10K `input.ts:241` za maraton | **T**
(činjenica izvora — HM/maraton rezultat — obara predaju „kraća distanca"; direktna adaptacija isti rezultat samo
napomenom preskače `app/facts.ts`) | Cilj odbacuje rezultat van svog skupa uz napomenu (pravilo iz `app/facts.ts`),
ili zapisati u DESIGN O-odlukama | potvrđeno čitanjem koda; delimično poznato (`handoff/SEGMENT-3d-IMPLEMENTATION.md:132`
za MAR → 10K); broj tokova HM/MAR → 5K **nemeren**.

**N7** | 5K | `5K/pol:287` raceEveMaxKm 4, `5K/validate.ts:337–346`; lagan trkačke `pol:290–291` (≤ 50 min, ≤ 50 %
dugog), ne ≤ najkraći lagan tapera | **K** | Dan pred trku min(4 km, 30 min) ili zapisati da 5K koristi km |
potvrđeno: dan pred trku do 34 min (38/368 planova uzorka, lagan 510 s/km, npr. 8 ned, 5 d, 35 km); lagan trkačke
> najkraći lagan tapera 9/714 (≤ 0,34 km, samo 6–7 ned). Oštrenje ≤ RP tapera: 0/714 (važi bez pravila).

**N8** | 5K, 10K, MAR (prema HM) | dan testa u LONG_SHORTER_THAN_QUALITY: HM ga broji (`HM/validate.ts:760–763`,
HI11 (f) — odluka HM-03); 10K (`validate.ts:620–623`, otvoreno u 10K-03), MAR (`validate.ts:703–705`) i 5K
(`validate.ts:276–285`, i samo nedelje sa dva kvaliteta) ne; 5K nema preporuku manje dana | **K** | Jedno pravilo
za 4 distance (dan testa = kvalitetni dan) + fewerDaysAdvice u 5K | potvrđeno: 5K 36/572 planova uzorka (svi
nedelja testa, 3 d / 12 km) dan testa duži od dugog bez upozorenja; 10K 1812/11 880 (stara brojka iz 10K-03);
MAR nemeren.

**N9** | 10K (HM tekst) | 10K: RP lestvica počinje 2 × 1200 m (`pol:633`), plafon 10 % pri 3 d 20 km = 2,0 km;
konstruktor tada daje RP 2 × 1000 m van lestvice bez napomene (suprotno D16 „najmanje prvi nivo"); pouka 10 nije
zapisana ni testirana u 10K i 5K. HM: H11 `pol:92` i test `quality.node.test.ts:96` proveravaju samo 30 km, a red
3 d počinje od 25 km (RP 4000 > 3750 m) | **K** (posledica HM „3 d 25 km bez RP" je poznata — ODLUKE-4a N12) | 10K:
test pouke 10 po redu (obrazac MAR `policy.node.test.ts:286`) i zapis odstupanja; HM: test i tekst po redu |
potvrđeno: 10K 8 ned, 3 d (uto/čet/ned), 20 km, 5 km 25:00 → ned 5 cilj 23,9, „RP 2 × 1000 m", napomena prazna.

Nije nalaz (zapisana razlika): 5K pouka 9 (START_ABOVE_CAPACITY), 5K pouke 3, 11, 12 (druga arhitektura doze),
5K donja granica adaptacije 9/12/15 km, HM/MAR bez testa 3 km (ODLUKE-4a), MAR bez prefiksa u promeni cilja.
