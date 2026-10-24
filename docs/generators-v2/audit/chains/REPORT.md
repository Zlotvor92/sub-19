# Dubinska provera v2 — UGAO 3: nasumični lanci adaptacija (chains)

Kod: `670700e` (`git diff --stat 670700e HEAD -- web/` prazan pre merenja i pre izveštaja). Ništa u `web/` nije menjano.
Seed svuda `20261023`; lanac `i` ima sopstveni generator slučajnosti (`chains.rngOf(seed, i)`) → svaki nalaz se
ponavlja sam za sebe: `cd web && node ../docs/generators-v2/audit/chains/rej.ts <D> 20261023 <i>` (odbijeni korak),
`dbg.ts <D> 20261023 <i> <korak>` (neidempotentnost), `tests.ts` (dani testa i zaključani dani),
`chains.ts <D> 20261023 <i> <i+1> --dump <i>` (ceo niz činjenica).

## Šta je mereno

| | 5K | 10K | HM | maraton |
|---|---|---|---|---|
| lanaca (generisanih planova) | 20 000 (20 000) | 20 000 (19 998) | 20 000 (19 999) | 20 000 (19 998) |
| realnih lanaca (VDOT ≤ 70; početnik ≤ 45 i lagan ≥ 330; razuman `recentLongRunKm`) | 20 000 | 19 140 | 18 708 | 18 735 |
| koraka adaptacije (realnih) | 75 839 | 77 506 (74 089) | 77 938 (72 897) | 77 482 (72 485) |
| odbijenih lanaca | 1 279 | 995 | 964 | 1 237 |
| vreme (s, 2 dela po 10 000) | 2 790 | 4 529 | 4 083 | 5 663 |

Posle predaje (`handoff-chains.ts`, 600 indeksa po paru, do 8 izvora po indeksu): predaja uspela 580 (HM→10K), 457
(HM→5K), 520 (MAR→10K), 193 (MAR→5K), 564 (MAR→HM) = **2 314 lanaca cilja** (cilj 1–3 adaptacije, 4 649 koraka). Ostali
pokušaji predaje su odbijeni porukom o uslovu ulaza cilja (broj dana, obim, trajanje, rezultat stariji od 84 dana) —
nije nalaz lanca, broj u `out/handoff-*.json`.

**Lanac.** Slučajan realan ulaz = ulaz mreže distance uz perturbaciju (start ±10…20 nedelja i ±3 dana — drugi dan u
nedelji, trajanje ±1 nedelja, obim × 0,85–1,15, vreme rezultata × 0,96–1,04, rezultat 0–84 dana pre starta, lagan tempo
±20 s, HM/MAR `recentLongRunKm` u 40 %). 2–6 koraka, asOf od start − 7 do dana pre trke, korak +0…14 dana. Činjenice
**kumulativne** (kao `app/facts.buildFacts`): dani po planu u tom trenutku u režimu po planu / manjak / višak / propušteno /
mešano / prijavljena pauza / pauza bez zapisa; događaji: bol 2–9, umor (RPE 8–9), brži/sporiji rezultat (trka ili test),
urađen/propušten dan; zaključani dani (ručne izmene) 0–3, u 30 % dan testa — skup važi samo za korak (snapshot izmena u
aplikaciji); pokrivenost potpuna (60 %), nepotpuna, bez. asOf = dan trke se ne meri (dokumentovano
`ADAPT_AS_OF_INVALID`).

**Provere u svakom koraku:** odbijanje/izuzetak; `lib.commonChecks` (prošlost bajt-ista, urađeni i zaključani,
prazan, dugi ≥ lagan, trkačka ≤ taper); invarijante distance; determinizam (isti poziv dvaput); **ponovna primena**
(adapt(novi plan, iste činjenice, isti asOf) → isti `weeks`); **sutra bez novih zapisa** (asOf + 1, iste činjenice);
policyId/policyVersion i faza; pouka 37 (nezavisno, zbir zaštićenih po činjenicama); pouka 38; polja prošlih nedelja;
buduća nedelja prazna / < 40 % cilja. Determinizam, prošlost, policy/faza, pouka 38, prazan trening, polja prošlih
nedelja: **0** na sve 4 distance i posle predaje.

## Nalazi

| # | ugao | distanca | broj | ulaz koji ga reprodukuje | uzrok | klasa | predlog |
|---|---|---|---|---|---|---|---|
| C1 | chains | sve 4 | odbijenih realnih lanaca: 5K 1 054 (LIMITS), 10K ≈ 958, HM ≈ 899, MAR ≈ 1 184 (svi `PLAN_VIOLATES_POLICY` LIMITS osim C3); predaja 2+5+2+1+2 | najkraći 5K `i=84` (2 koraka), HM `i=44` (2), MAR `i=33` (2); primer 5K seed 1 `i=5`: korak 4 zaključava 2027-05-04 (kvalitet), korak 4 bol 8 → zabrana kvaliteta 04-29…05-05, korak 5 (asOf 05-09) → LIMITS „Kvalitet na dan zabrane kvaliteta" za 05-04 | provera ograničenja po danima preskače samo dane zaključane u TEKUĆEM koraku (`ad.lockedDayIds`), ne dane ≤ asOf ni urađene: `fiveK/v2/validate.ts:1016`, `tenK/v2/validate.ts:1725`, `halfMarathon/v2/validate.ts:1871`, `marathon/v2/validate.ts:1830`. Dan zaključan u koraku k ostaje treningom u zabranjenom opsegu; u koraku k+1 (zaključavanje se ne ponavlja — aplikacija pravi snapshot izmena) ili kad prođe (≤ asOf) obara celu adaptaciju. Klasifikacija 3 000 lanaca (`rej-*.json`): HM LIMITS 126 = 68 „bez ranijeg zaključavanja prolazi" + 58 gde je zaključan dan posle i URAĐEN (proverenih 7/7 u 5K: dan ≤ asOf, ranije zaključan) | B | ista funkcija „zaštićen dan" (≤ asOf, zaključan u bilo kom koraku — `adaptation.lockedDayIds` svih koraka —, urađen) u proveri LIMITS, kao odluka MAR-07 („validator ne sudi činjenicama") |
| C2 | chains | sve 4 | korak nije idempotentan (realni lanci): 5K 3 267, 10K 3 990, HM 4 158, MAR 4 276 lanaca (≈ 16–23 %); predaja 109; razlaganje (2 000/3 000 lanaca, `idemp-*.json`): manjak izvršenja 5K 423/475 koraka, 10K 617/635; ostali uslovi 5K 47/7 027, 10K 39/7 032 | 5K seed 1 `i=5` korak 2: cilj ned 7 50 → 40 → (ista adaptacija opet) 32 → 25,6; najkraći 1 korak: 5K `i=106`, 10K `i=529`, HM `i=201`, MAR `i=136` | manjak izvršenja nije vezan za zapise: `step.startKm = max(min(tn, …, max(a2, 0,8 × tn)), …)` gde je `tn = target(n)` cilj TEKUĆEG plana (već smanjen) — `fiveK/v2/assess.ts:445–452`, isto `tenK/v2/assess.ts:475`, `halfMarathon/v2/assess.ts:467`, `marathon/v2/assess.ts:475`; svaka primena istih zapisa dodaje korak i seče još 20 %. Dostižno: „Plan → Prilagodi plan" je ručno, traka (`neededOf`) samo ne nudi ponovo isti dan | B | manjak vezati za zapise kao umor (pouka 36): referenca = cilj nedelje iz plana bez koraka manjka za isti prozor (ili korak koji već pokriva isti prozor ne pravi novi) |
| C3 | chains | maraton (i HM/10K) | MAR 40 lanaca „lock-sada" od 192 odbijenih (3 000 lanaca); HM 1, 10K: IDEMP/NEXT_DAY odbijeno TEST 104 lanca | MAR `i=18` (1 korak): plan po osećaju, zaključan dan testa 2027-05-03 + test 10 km 2027-03-31 → `TEST: najviše jedan test, u nedelji izgradnje po osećaju (A13, M17)`; bez zaključavanja ili bez rezultata prolazi | pouka 38 (zaštićen test ostaje) sudara se sa A13/M17 kad nov rezultat ukida test plana po osećaju; `locked-test.ts` pokriva samo pauzu/umor/bol, ne rezultat | B | zaštićen test + nov rezultat: test ostaje kao činjenica (pouka 38) i ne broji se kao „test plana po osećaju" |
| C4 | chains | 5K | QUALITY_REPEAT 83 lanca (9 u 3 000: 4 već u 1. koraku samo sa zaključanim danom), TEST_WEEK 95, DOSE_PROGRESSION 5, BASE_R_DECREASE 2 | QUALITY_REPEAT `i=45` (1 korak, bez činjenica osim zaključanog 2027-02-23): „Isti par kvaliteta kao nedelja 6"; TEST_WEEK `i=288` (2), seed 1 `i=112`: test 2027-01-20 zaključan u koraku 1, u koraku 2 (≤ asOf) → „kontrolno trčanje najviše jednom"; DOSE `i=9115`, BASE_R `i=6392` | zaključan dan kvaliteta ulazi u nedeljna pravila progresije (ponavljanje/rast doze) kao da je konstrukcija; TEST_WEEK/DOSE/BASE_R: zaštita iz ranijeg koraka izgubljena (bez ranijih zaključavanja prolazi). Tačna linija nepotvrđena | B | nedeljna pravila doze/testa čitaju zaštićen dan (sve vrste zaštite) kao činjenicu, kao C1 |
| C5 | chains | 5K | RACE_WEEK_TAPER 40 lanaca (3 000: 3 „lock-sada", 4 bez zaključavanja) | `i=2650` (2 koraka): umor + sporiji test, pa bol 8 2027-04-29 u taperu → „Trkačka nedelja 9,44 km > planirano tapera 5,4 km (pouka 30)"; isto bez zaključanih dana | pouka 30 (višak laganih trkačke → odmor) ne pokriva taper skraćen bolom posle konstrukcije trkačke; uzrok nepoznat (linija nepotvrđena) | B | trkačka nedelja posle bola u taperu po pouci 30 (RACE_WEEK_SHORT umesto odbijanja) |
| C6 | chains | sve 4 | sutra bez novih zapisa (dan bez treninga plana, iste činjenice): cilj buduće nedelje pada > 10 % — 5K 174/227 koraka sa manjkom + bol 17/686; 10K 240/256 + bol 14/479; glavni run: 5K 113, 10K 27, HM 212, MAR 245 lanaca | bol: 5K `i=33` korak 4 (asOf 2026-11-24, bol 7 2026-11-23): sutra sidro prelazi u ned 9, osnova = cilj ned 9 (22,9, već smanjen) → ned 10 31,4 → 25,1, ned 11 26,7 → 21,3, taper 22 → 17,6 | bol: „poslednja 3 dana" od asOf, sidro r = nedelja koja sadrži asOf + 1; `volume.returnBaseKm` (`fiveK/v2/volume.ts:227`) = min(0,7 × nivo, cilj nedelje r TEKUĆEG plana) → kad sidro pređe granicu nedelje, osnova je već smanjen cilj (kaskada). Manjak: C2 | B | bol vezati za zapis (kao pouka 36): isti zapis bola ne pravi nov korak; osnova iz plana pre koraka bola |
| C7 | chains | HM, 10K, MAR | trkačka > taper: HM 13, 10K 13 (+1 nereal.), MAR 2 lanca; plan prihvaćen | HM `i=4878` (3 koraka; 6 d/80 km, VDOT 68): bol 4 + umor 2 nedelje pred trku → taper 24 km, svi dani 4,0 km (i „dugi" 4 km), `TAPER_NO_QUALITY`; 10K `i=5771` (1 korak): bol 8 u taperu + zaključan lagan dan trkačke (5,3 km) → trkačka 9 > taper 7,4 | 10K: zaključan dan trkačke se ne može skinuti (činjenica) — verovatno ispravno, nedostaje upozorenje; HM: uzrok nepoznat | T (HM: B ako se potvrdi — degenerisan taper) | HM: izmeriti taper posle bola u taperu; 10K: upozorenje RACE_WEEK_SHORT/ekvivalent kad zaključan dan drži trkačku > taper |
| C8 | chains | 5K, 10K, MAR | mešovita nedelja planirano > cilj bez upozorenja: 5K 69, 10K 76, MAR 69 lanaca (+ predaja 1) | MAR `i=865` (2 koraka): pauza 14 dana bez zapisa (pokrivenost potpuna), zaključan dugi 23,1 km → ned 10 cilj 39,9, planirano 52,4 (+31 %), 0 upozorenja | dokumentovan izuzetak pouke 37: „kad pravilo pauze određuje ostatak nedelje pauze, ono je vlasnik" (`pauseRemainder = true`; 10K `i=664` isto); proveren najkraći u MAR i 10K, ostali nepotvrđeni | T | upozorenje i kad je vlasnik pauze, ako zaštićeni + preostali > cilj |
| C9 | chains | HM (i MAR→HM) | invarijanta „dugi > pouka 28": 444 real. + 55 nereal. lanaca; MAR→HM 12 | HM seed 1 `i=49` korak 2: posle pauze zaključan dugi 2026-10-18 15,2 km ostaje, cilj ned 6 smanjen | test invarijanta (`halfMarathon/v2/adaptInvariants.ts:326`) ne izuzima zaključan dugi; plan prihvaćen, validator ćuti | K (test kod) | invarijanta preskače zaključan/urađen dugi (zaštićeni su činjenice) |
| C10 | chains | 5K, 10K, HM, MAR | WEEK_INFEASIBLE: HM 1, MAR→10K 1 (realno), 10K 1 nereal.; NEXT_DAY HM 1 | HM `i=1888` (1 korak; 6 d/50 km, VDOT 35): manjak + umor + bol 9 + 3 zaključana dana → „Nedelja 2: nijedan cilj od 24 km naviše ne može da se sastavi"; isto bez zaključanih | generičko odbijanje bez preporuke (ODLUKE-4a ivice t. 3 zabranjuje ga u generatoru, za adaptaciju nema pravila); uzrok nepoznat | B (1 realan) | izmeriti i rešiti po obrascu pouke 14 (upozorenje) |
| C11 | chains | sve 4 | buduća nedelja < 40 % cilja: 5K 400, 10K 354, HM 519, MAR 564 lanaca | 5K seed 1 `i=2`: bol 7 → ned 6 dva laganih po 3,5 km (7 / 18,2 km) uz `PLANNED_BELOW_TARGET_LIMITS` | period bola (A4) po pravilu, uz upozorenje; proveren 1 primer | — (nije nalaz; T samo ako trener smatra da je prikazani cilj 18,2 uz plan 7 zbunjujući) | — |

Neidempotentnost van manjka (5K 47/7 027 koraka, 10K 39/7 032; uključuje i NO_FACTS 5K 7/3 757) — mala, uzrok nepoznat,
primeri u `out/idemp-*.json` (`ex`).

Razlaganje C2/C6 po uslovu (`idemp.ts`, prvih 2 000 lanaca po distanci; „isti" = ista adaptacija dvaput, „sutra" =
asOf + 1 bez treninga u planu, iste činjenice):

| | 5K | 10K | HM | maraton |
|---|---|---|---|---|
| isti — manjak izvršenja | 423/475 | 617/635 | 608/630 | 600/627 |
| isti — ostali uslovi | 47/7 027 | 39/7 032 | 32/7 081 | 57/7 012 |
| sutra — manjak izvršenja (cilj pada > 10 %) | 174/227 | 240/256 | 195/222 | 215/242 |
| sutra — bol bez manjka | 21/882 | 17/650 | 16/772 | 16/821 |

Klasifikacija odbijanja (`classify-rej.ts`, prvih 3 000 lanaca): 5K 202 (LIMITS 167, TEST_WEEK 14, QUALITY_REPEAT 9,
RACE_WEEK_TAPER 7, DOSE_PROGRESSION 3, ostalo 2), 10K 153 (svi LIMITS), HM 138 (LIMITS 136, TEST 1, WEEK_INFEASIBLE 1),
maraton 192 (LIMITS 149, TEST 42, LONG_JUMP 1). „lock-ranije" = poslednji korak prolazi kad se iz ranijih koraka skinu
zaključani dani; ostatak LIMITS su dani koje je trkač posle zaključavanja i URADIO (isti koren, C1).

Odnos prema poznatom: C6 (bol) je merenje stavke consistency C14 („ponovljen isti zapis bola … posledica u aplikaciji
nepotvrđena", samo čitanje) — novo: broj tokova, kaskada do tapera, i 10K (koji ima zaštitu „već u planu") takođe pada
17/650. C1–C5, C7, C10 nisu u POSLE-MERGE/FINAL/ODLUKE-4a ni u izveštajima drugih uglova (grep LIMITS/UNDER_EXECUTION/
idempot).

## Realno / nerealno

Svi gornji brojevi su realni lanci osim gde piše „nereal.". Nerealni (VDOT > 70, početnik izvan opsega, nerazuman
`recentLongRunKm`) daju iste klase u istom odnosu (npr. HM LIMITS 64, IDEMP 268); nijedna klasa ne postoji SAMO na
nerealnom ulazu (osim 10K WEEK_INFEASIBLE 1).

## Nije nađeno (0 na svim distancama i posle predaje)

Izuzetak (throw); nedeterminizam; prošlost (dani ≤ asOf, urađeni, zaključani) promenjena — `commonChecks` PROSLOST 0;
prazan trening; dugi < lagan među preostalim danima; nedostaje policyId/policyVersion/faza; pouka 38 (zaštićen test
pomeren ili drugi test u prihvaćenom planu) 0 — ali vidi C3/C4 (odbijanje umesto toga); polja prošlih nedelja promenjena 0.

## Ograničenja merenja

- Tokom merenja na granu je stigao d2f812a (organizator) sa izmenom `web/src/features/session/WorkoutParts.tsx` (+ test):
  samo UI, van `domain/generators`; uvozi mernih skripti (generatori, `app/handoffTarget`, `app/plan`, `app/preparation`)
  na 670700e su bajt-isti. Merenja važe za kod 670700e.
- Činjenice se pune po planu u tom trenutku; trkač koji svojevoljno trči dan odmora bez zaključavanja nije generisan
  (dan odmora nije dan plana) — C1 zato meri samo put kroz zaključavanje.
- „Ručne izmene" = `lockedDayIds` (jezgro ne prima sadržaj izmene).
- Pri međucommitu `git pull --rebase` je prepisao fajlove u koje su pisali idemp/rej procesi; ponovljeni su (rezultati
  isti seed). Uzorci: idemp 2 000 lanaca po distanci, rej 3 000.

## Fajlovi

`chains.ts` (lanci + provere), `run.sh` (20 000 × 4), `handoff-chains.ts` + `run-handoff.sh` (predaja), `idemp.ts`
(razlaganje C2/C6), `classify-rej.ts` (odbijanja po pravilu × zaključavanje), `rej.ts` / `dbg.ts` / `tests.ts`
(prikaz jednog lanca), `aggregate.py` → `out/summary.json`; sirovi izlazi `out/*.json` (< 200 KB).
