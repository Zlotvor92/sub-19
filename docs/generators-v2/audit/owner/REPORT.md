# Ugao 4 — jedan vlasnik (čitanje koda) — izveštaj

Kod: **670700e** (`git diff --stat 670700e HEAD -- web/` prazan pre merenja i pre izveštaja). Ništa u `web/` nije menjano.
Detalji po distanci (tabela veličina: vlasnik fajl:funkcija:linija, svi korisnici; uslovi 1–6 sa dokazima; šta je mereno):
`fiveK.md`, `tenK.md`, `halfMarathon.md`, `marathon.md`; uslov 7: `isolation.md`. Skripte su u ovom folderu, pokreću se iz
`web/`: `node ../docs/generators-v2/audit/owner/<ime>`. Seed: 5K `fiveK-volume-refs.ts` 20261023, MAR `mar-*-search.ts`/
`mar-capacity-pace.ts` 4004 (mulberry32); ostale skripte su determinističke (pune mreže ili svaki k-ti ulaz).

Organizator je ponovo pokrenuo i potvrdio: 10K O-3 (`tenK-restore.ts`: 172/2 880, kontrola 0), 5K N1 (`fiveK-n1-repro.ts`),
MAR O3 (`mar-emptyweek-example.ts` → EMPTY_WEEK ned 18), HM B2 (`hm-deloadref1.ts 40`: 347/347). Ostali brojevi su iz
skripti agenata po distanci, nisu ponovo pokretani.

## Šta je mereno

| distanca | skripte | ulazi / tokovi |
|---|---|---|
| 5K | fiveK-volume-refs, -lastbuild, -form-result, -peak-field, -n1-repro | 447 ulaza / 78 050 tokova; 744 ulaza / 32 412 + 87 624 koraka; 12 124 slučaja Forme; 7 548 tokova |
| 10K | tenK-dup, -advice, -restore | 464 020 poređenja formula; 8 220 parova + 31 311 ulaza; 2 880 tokova vraćanja (+ kontrola 2 880) |
| HM | hm-deloadref1, -deloadref, -form-result, -algebra, -inv-vs-val | 19 490; 19 490 × 3 i 13 860 × 3 koraka; 528; ≈ 80 000 provera (742 tempa); 18 018 |
| MAR | mar-formulas, -gen-search, -adapt-search, -capacity-pace, -emptyweek-search, 2 primera | 40 000 ulaza / 33 549 planova; 22 192; 14 896; 21 952 tokova; iscrpne formule F1–F10 |
| sve | imports.mjs (AST, uslov 7) | svi fajlovi v2/ (sa app/) četiri distance |

## Nalazi

| ugao | distanca | broj | ulaz koji reprodukuje | uzrok | klasa | predlog |
|---|---|---|---|---|---|---|
| owner | 10K | 172 / 2 880 tokova: sledeća adaptacija posle vraćanja revizije odbijena (PLAN_VIOLATES_POLICY); kontrola bez vraćanja 0 / 2 880. Vraćen plan krši validator u 1 207 / 2 880 i upisuje se bez provere | `tenK-restore.ts`; npr. `adaptBases d3-r-10w`, umor kraj ned 2 → `restoreMerge(…, rev1, 2026-11-23)` → `adaptTenKV2(vraćen, {}, 2026-11-23)`: TRANSITION_DOSE + MAIN_DOSE_DECREASE | `app/adapt.ts:190–266` `restoreMerge` = druga definicija spajanja prošlost/budućnost (pored `written.ts:73`), bez konstruktora i `validatePlan`; tačna linija odbijanja nepotvrđena | **B** | vraćanje kroz jezgro (construct + writtenWeeks + validatePlan) ili odbiti vraćanje kad posle snimka postoje adaptacije |
| owner | HM | 19 490 / 19 490 tokova scenarija „bol 8 (odmor pokriva dugi ned 1) + umor u istom koraku" → WEEK_INFEASIBLE ned 2; isti tok u dva koraka prolazi | `hm-deloadref1.ts 1`; npr. `adaptBases d4-r-14w`, asOf 2026-11-05 | `assess.ts:441–446` (`noLong`) gleda prethodni plan, konstruktor `generate.ts:246, 319–321` upisane dane novog plana → `lastLong10 = null` → `week.ts:465` null za svaki cilj | **B** | jedna funkcija „poslednji dugi pre nedelje w" iz upisanih dana |
| owner | HM | 3 758 / 13 860 tokova (svaki 4. plan × recentLongRunKm 10/12/14/16); bez recentLongRunKm 0 | `hm-deloadref.ts 4 10,12,14,16`; `d4-17w-50km-v40-C-sat` + recentLongRunKm 12: bol 8 (11-04) → umor → umor → DELOAD_LONG ned 3 („11.2 ≠ 10.5 km") | referenca dugog rasterećenja: konstruktor `generate.ts:246` po nedelji, validator `validate.ts:1280` jednom | **B** | jedna funkcija „referenca dugog rasterećenja nedelje w" |
| owner | HM | 6 / 19 490 i 8 / 13 860 tokova | `b-d5-12w-25km-e390-A` (početnik), isti tok u 3 koraka → WEEK_INFEASIBLE ned 11 | nepotvrđeno (verovatno 0,6 × najduži dugi < 4 km `lengths.ts:247` vs `withEasy` `lengths.ts:266–267`) | B (nepotvrđen uzrok) | prvo potvrditi uzrok |
| owner | MAR | 224 / 10 976 tokova (bol 8 kraj ned N−2, 3 dana); slučajna pretraga 1 / 22 192 | `mar-emptyweek-example.ts`: start 2026-11-02, trka 2027-01-24, mon/tue/wed, dugi mon, 30 km, HM 1:40:19 (2026-10-19), bol 8 asOf 2027-01-10 → EMPTY_WEEK ned 18 | trkačka nedelja samo sa trkom ima dve definicije: `week.raceWeekRest` (`week.ts:893–925`, pouka 30) prazni trkačku jer je planirano N−1 = 0, a `raceOnlyWeek` (`week.ts:827–838`) priznaje samo odmor u samoj trkačkoj nedelji → `validate.ts:563` | **B** (nova činjenica uz ODLUKE-4a N1: okidač N−2; bol na N−1 daje 0 na istoj mreži) | jedno mesto odluke; trenerska dilema → odluka organizatora |
| owner | 5K | 9 759 / 38 440 primenjenih koraka viška posle bola (manjak 0 / 43 812) | `fiveK-n1-repro.ts`: `r-d3-6w-20km-v45-1`, pain5 2026-11-15 → over120 2026-11-22: ned 4 ostaje 15,4 km (osnova povratka 14 + 10 %), poruka „plan se ne povećava" | „poslednja izgradnja": `assess.ts:230` (cilj ned 3 = 23,3, bez osnove povratka) vs vlasnik obima `volume.ts:337–340` / `validate.ts:736` (14) → `assess.ts:471` | **B** (dve definicije se razilaze; posledica: „bez rasta" posle bola ostavlja +10 %) | jedna funkcija „poslednja izgradnja" u volume.ts za assess, adaptVolume i validator |
| owner | 5K, HM (+10K, MAR iz koda) | 5K 12 124 / 12 124 slučaja (VDOT 22–29,5 ili 61–70); HM 495 / 528; 10K i MAR isti kod, nije mereno | 5K plan po osećaju, test 3 km sreda ned 3 sa VDOT < 30 (npr. 23:08); HM `beg-d4-f-12w`, 5 km 36:00 (VDOT 24,7) | Forma ima sopstvenu definiciju „rezultat čeka primenu" bez opsega VDOT: `fiveK/v2/app/form.ts:89–102`, `halfMarathon/v2/app/form.ts:94–106`, `tenK/v2/app/form.ts:94–107`, `marathon/v2/app/form.ts:90–102`; vlasnik `assess.ts` (opseg vdotMin–vdotMax, 5K :305–313, HM :314–321, 10K :306, MAR :326) daje RESULT_IGNORED → Forma trajno piše „čeka prilagođavanje plana" | T (plan ispravan, tekst pogrešan; po pravilu ugla razilaženje = B) | Forma da čita odluku jezgra |
| owner | MAR | 1 409 / 17 300 adaptiranih planova (22 192 toka); obrnuto 2 | `mar-timecap-example.ts` (5 d, 44 km, po osećaju 464, `faster`, asOf 2026-12-25) | plafon 150 min sa dva tempa: konstruktor tempom nedelje (`generate.ts:161–167`), `longShortOf` (`lengths.ts:86–88`, poziv `generate.ts:410`, `validate.ts:689`) tempom plana → MARATHON_LONG_SHORT kaže „ograničava ga udeo dugog", netačno | T | `longShortOf` sa tempom nedelje (`pacesAt`) |
| owner | 10K | 930 / 6 708 poruka CAPACITY_LIMITED | `d3-8w-25km-v30-A-sat`: „preporuka 4–6 dana", a 5/6 dana sa 25 km → WEEKLY_KM_TOO_LOW | `volume.ts:36–40` `capacityMessage` bez provere reda tabele; `input.ts:214–231` proverava | T | preporuka samo za dane čiji red podržava obim (ista funkcija kao ulaz) |
| owner | MAR | 247 / 2 463 tokova sa CAPACITY_LIMITED | `mar-capacity-pace.ts 100 4004`, base#2 preTaper2 faster | isti uzrok kao plafon 150 min: `volume.ts:79–115` (`generate.ts:405`, `validate.ts:1308`) | K | kao gore |
| owner | 10K | 28 / 8 220 parova (dani, obim); kraj-na-kraj 0 / 270 | `fewerDaysAdvice(4, 40.04)` → „preporuka 3 dana", a 3 d × 40,04 km → WEEKLY_KM_TOO_HIGH | `volume.ts:49–53` zaokružuje na 0,1 km, `input.ts:51, 214–231` sirov obim | K | jedna funkcija „red podržava obim" |
| owner | 5K | plafon lagan dana se razlikuje u 38 525 / 78 050 tokova; lagan u spornom pojasu 0 | svaka trkačka nedelja | `week.ts:454–459` `floor1`, `validate.ts:319–322` bez zaokruživanja | K (validator labaviji < 0,1 km) | validator da zove istu funkciju |
| owner | 5K | 2 474 / 7 548 tokova | `r-d3-6w-20km-v32-0`, asOf 2026-11-11, pause20: polje peakKm 20, vrh za taper 15,4 | `adapt.ts:227` `peakKm` drugačije od `generate.ts:400` / `volume.ts:383`; polje niko ne čita | K | upisati `peakRefKm` ili ukloniti polje |
| owner | HM | algebarski 191 / 401 vrednosti (od 41,0 km) | početnik 5 d, prethodni cilj 45 km: vlasnik rast 2,0 km, invarijanta 2,3 km | `adaptInvariants.ts:343` `min(40, …)` umesto 20 (`gridInvariants.ts:456`) | K (slabost testa) | granica 20 |
| owner | 5K | — (nema kršenja) | `imports.mjs` | `fiveK/v2/isolation.node.test.ts:33` propušta BILO KOJI type-only uvoz van v2, a `fiveK/exchange.ts:3` kaže „dozvoljen je jedino ovaj fajl" | K (rupa u testu) | type-only samo ka `fiveK/exchange.ts` |
| owner | 5K, 10K | — (nema kršenja) | `imports.mjs` + grep `src/` | test ivica „van v2 → v2" (5K `:73`, 10K `:74`) ne hvata uvoz preko `@/…/v2` aliasa (HM/MAR hvataju) | K (rupa u testu) | isti uslov kao HM/MAR |

### Druge definicije bez razilaženja (pouka 24 formalno prekršena; dokaz 0 razilaženja)

- 10K: validator prepisuje formulu na 10 mesta (WU/CD `validate.ts:655`, početni nivo `:988`, doza rasterećenja/tapera
  `:150`, spuštanje doze `:874`, dugi rasterećenja `:1143`, dani D20 `:1352`, oštrenje `:1396`, lagan trkačke `:1453`,
  nominalni cilj `:1536`, istorija cilja `:1594` + `generate.ts:346`, udeo/trajanje dugog `:561/:568`) — 464 020 poređenja, 0.
- 5K: vrh za taper/taper/rasterećenje (`validate.ts:620, 736`) 0 / 78 050; minimum nedelje 7,5/10/12,5 (`validate.ts:536`)
  vs 9/12/15 (`volume.ts:203`) 0 / 78 050 (konstruktor podiže na veći pod); najkraći lagan na 4 mesta 0; dve konstante
  `resultMaxAgeDays` (84, iste vrednosti).
- HM: trajanje dugog i bol (`validate.ts:663/675`), WU/CD km (`907/919`), lagan trkačke (`1643/1673`), osnova tempa
  (`232–237`), laganih dana rasterećenja `runDays − 2`, pod T tapera (`P.deload.tMinKm` umesto `P.taper.tMinKm`, oba 2,0) — 0.
- MAR: LONG_SHARE 0 / 8 706; LONG_DURATION i bol 0 / 2 245; VOLUME_START 0 / 40 000; START_LEVEL 0 / 19 240; dani/lagan
  trkačke 0 / 383 895; donja granica cilja (`assess.ts:404/476` vs `volume.ts:394`) 0 / 727 259; PHASE_QUALITY početnika 100
  razilaženja samo za cilj 15–19,9 km (ispod minimuma 20/25 → nedostižno).

## Stalni uslovi (AGENTS.md)

| uslov | 5K | 10K | HM | MAR |
|---|---|---|---|---|
| 1 jedan vlasnik, bez petlji skraćivanja/dopune | delimično (N1, druge definicije) | da* | da* | da* |
| 2 jedan plafon po zoni | da | da (minimum nedelje na 2 mesta, ne razilazi se) | da | da za zonu; ne za plafon trajanja (150 min, dva tempa) |
| 3 WU/CD nije pufer | da | da | da | da |
| 4 adaptacija: uslovi u konstruktor, zaštita samo štiti | da | jezgro da; `app/restoreMerge` ne (O-3) | da (B1/B2 su greške ulaza vlasnika) | da |
| 5 predaja | da (cilj) | da (cilj) | da (`policy: null` kao izvor) | da (izvor, `policy: null`) |
| 6 policyId/Version i faza iz generatora | da | jezgro da; posle `restoreMerge` meta = konstanta `P.version` (`app/plan.ts:325`), nije mereno | da | da |
| 7 nula uvoza van foldera | da (13 type-only ka `fiveK/exchange.ts`, neutralni tipovi) | da (0) | da (0) | da (0) |

\* Trkačka nedelja se gradi do 3 puta (`generate.ts`: 10K :235–248, HM :207–220, MAR :191–204) i `raceWeekRest` je pohlepna
petlja — kaskada/pretraga jednog vlasnika, ne naknadno skraćivanje. 10K: komentar `generate.ts:3` netačan uz `mixed37`.

Napomene (nepotvrđeno / bez klase): 10K `PRODUCT.minWeeks = 8` a početniku treba 10 nedelja, savet `weeksHint` van foldera
broji drugačije — nije izmereno (onboarding kod se ne izvršava kroz node bez prevodioca). 10K `adaptInvariants.ts` u
zaglavlju tvrdi nezavisnost od validatora, a uvozi tri predikata iz `steps.ts`/`week.ts`. 10K `gridInvariants` bira pojas
WU/CD po sirovom obimu, politika po zaokruženom (samo testovi).
