# Ugao 5 — pouke 20–38 po distancama (5K, 10K, HM, maraton)

Kod: `670700e` (`git diff --stat 670700e HEAD -- web/` prazan). Samo čitanje koda; ništa nije pokretano ni mereno.
Putanje relativno od `web/src/domain/generators/<distanca>/v2/`; `P:` = `policy.ts` (DECISIONS), red = linija.
Već poznato (POSLE-MERGE, FINAL-2026-10-23, ODLUKE-4a) nije ponovo prijavljeno.

## 1. Tabela

| pouka | 5K | 10K | HM | MAR | razlika / nalaz |
|---|---|---|---|---|---|
| 20 traka samo za NOVO ograničenje | `app/adapt.ts:127-160` (`neededOf`: primenjen uslov + promena posle danas; bol samo uz nov zapis) — bez `newLimits` | `adapt.ts:263-300`, `steps.ts:289` `newLimits` (P:382) | `adapt.ts:325-369`, `steps.ts:293` (P:418) | `adapt.ts:271-316` | 5K drugi mehanizam, u app sloju → **N6** |
| 21 predaja: izvor šalje činjenice, cilj izvodi ulaz | cilj: `app/handoffTarget.ts:62-100` | cilj: `app/handoffTarget.ts:62-100` | cilj i izvor: `app/handoffTarget.ts`, `app/preparation.ts` | samo izvor (`app/preparation.ts`); nije cilj „kraća distanca" (3i izveštaj § 5) | bez razlike |
| 22 rasterećenje posle nedelje smanjenja otpada | `steps.ts:128-140` `reducedWeeks` (P:688, Odluka 9) | `steps.ts:123-133`, A17 (P:372) | `steps.ts:131-140`, A17 (P:357) | `steps.ts:168-177`, A17 (P:282) | bez razlike |
| 23 konstruktor ne sastavlja ono što validator odbija | trajne mreže `segment08g.grid`, `08j.grid` (P:822) | `earlyGrid*`, `prestartChain*` (P:391, 400) | `earlyGrid*`, `preStartGrid*` (P:134, 220) | `earlyGrid*`, `preStart.node` (P:114, 369) | bez razlike (merenja u ODLUKE-4a) |
| 24 jedna funkcija po veličini | `volume.pauseRemainderKm`, `adaptFloorKm` (P:715-722) | `lengths.longestLong10` (D7, P:65), `steps.ts:109` | F4a-N9 (P:394) | N9 (P:320) | bez razlike (nije proveravano po svakoj veličini) |
| 25 minimum važi za cilj; planirano ispod → upozorenje | `PLANNED_BELOW_TARGET_LIMITS` (`validate.ts`) | isto + `WEEK_MIN_REST` (A21) | isto (`validate.ts:625`) | isto | bez razlike |
| 26 merenje testova, sabotaže alatom | proces (docs/testing) | isto | isto | isto | ne zavisi od distance |
| 27 piramida kad nema druge strukture | ne važi (pouka MAR-01); ista doza druge strukture (P:530) | ne važi; ponavljanje RP 2,5/3,5 km kao odstupanje (D22b, P:184) | HI5/HI2 (P:159-166) | M10a (P:95) | HM/MAR svesno različito (N10.6); 5K/10K van opsega pouke |
| 28 dugi ≤ max(1,1 L, L+1) + `recentLongRunKm` | ne važi (dugi po udelu i ≤ min, nema ulaza) | ne važi (D17 udeo, ≤ 105/90 min) | HI7/HI8 (P:187-200), `steps.jumpRecentKm` | M13a (P:124) | pouka iz MAR-01/02; 5K/10K nemaju ulaz |
| 29 prošlost = upisani dani | `written.ts` (N4, P:726) | `written.ts` (A11, P:332) | `written.ts` (P:328) | `written.ts` (N8, P:313) | bez razlike |
| 30 trkačka ≤ planirano tapera; višak laganih → odmor | `week.ts:371` `raceWeekRest` — **oštrenje ostaje** (P:738) | `week.ts:609` — oštrenje prvo otpada (A9), pa odmor (D23, P:188) | `week.ts:961`, oštrenje prvo otpada (`week.ts:1053`) | `week.ts:893`, oštrenje prvo otpada (`week.ts:932-995`), N1 (P:290) | redosled 5K drugačiji → **N4** |
| 31 umor u uvodu početnika | uvod ima prednost: `feel.ts:344`, `validate.ts:157`; obim `volume.ts:361` | A5 dopuna 2.5.1 (P:290) | HI13 (P:250), P:289 | A5 (P:204) | 5K: put početnika sa VDOT nije pročitan — nepotvrđeno |
| 32 plafon zone, drugi član (dan kvaliteta ≤ dugi) | ne važi po tekstu (opseg HM/MAR); pouka 35 + `LONG_NOT_LONGEST` (`validate.ts:283`); R pad (P:735) | ne važi; D25 upozorenje (P:196) | HI15 (P:242), sve zone | M7/M11 (P:58, 102), samo MP | opseg zapisan u pouci; bez nalaza |
| 33 neizvodljivo rasterećenje → skraćen dugi | ugrađeno: `lengths.ts:60` dugi = min(udeo, cilj − kvalitet − n × min laganog) u svakoj nedelji | samo test (D27, P:215) i adaptacija (A9, P:322) | `lengths.ts:169` `deloadLengths`, HI14 (P:219) | `lengths.ts:278`, N10.4 (P:327) | 10K van testa/adaptacije: neizvodljivo rasterećenje nije mereno — nepotvrđeno |
| 34 umor pre starta: ned 1 = 0,8 × planirana, ned 2 = cilj ned 1 | `volume.ts:361-366` (startRef × 0,8; ned 2 = startRef) — presedan, bez posebnog koda | A5 2.5.2 (P:290), `generate.ts:87` `preStartRef`, A20 (ključ `deloadWeekOf`) | `steps.ts:353-365` `initialState`, `volume.ts:356`, `jumpRecentKm` (N7/N10.3) | `assess.ts:73`, `steps.ts:50-80`, `jumpRecentKm` | bez razlike u ishodu (start-day 0 svuda) |
| 35 dva kvaliteta samo kad dugi ostaje najduži | `week.ts:182` `secondQualityEasy`; izuzima nedelje sa danima bola/odmora (P:757) | `week.ts:433-437` (izuzima rasterećenje) | `week.ts:252`, `week.ts:700-705` (i nedelja testa) | `week.ts:427`, `week.ts:766-768` (izuzima nedelju testa) | opseg izuzetaka različit → **N9** |
| 36 umor vezan za zapise; sidro = nedelja posle nedelje zapisa | `assess.ts:415-430` (inline; `Math.max(r, …)` bez efekta jer su zapisi ≤ 7 dana) | `assess.ts:431-436` (inline) + `pre1` (K3) | `assess.ts:194-203` `fatigueWeek` | `assess.ts:61-70` `fatigueWeek` | sidro isto; **klasifikacija zapisa umora različita → N3** |
| 37 mešovita nedelja, ostatak samo naniže | `week.ts:262-310` `mixedRemainder`; zbir `assess.ts:76-87`, `week.ts:200` | `week.ts:529-570`; `written.ts:35-55`; `generate.ts:105` | `week.ts:820-900` `remainderWeek`; `adapt.ts:293-323` | `mixed.ts:30-180`; `adapt.ts:133-143` | test u nedelji, urađen dan posle asOf, kod upozorenja → **N1, N2, N5, N7, N8** |
| 37a dan poznat iz pokrivenosti bez zapisa = 0 | `assess.ts:85` | `written.ts:52` | `adapt.ts:311-314` | `mixed.ts:41` | ista semantika (vidi § 2) |
| 38 zaštićen test se ne premešta | `steps.ts:172`, `:212-231` (`writtenTest.done`; premeštanje ne ide na zaštićen dan) | `steps.ts:224-260` `protectedTest` | `steps.ts:218-247` `protectedTestDate` (K1-TEST, P:440) | `steps.ts:262`, A13c (P:383) | bez razlike za zaštićen test; nezaštićen test u mešovitoj nedelji → **N1** |
| 3i/08l weekOffset, weekLabel | `input.ts:13` `weekLabel(n, offset)` | `weekLabel.ts:9` | `weekLabel.ts:9` | nema (nije cilj predaje; 3i § 5) | vidi § 3; bez novog nalaza |

## 2. Pravilo pokrivenosti (pouka 37, „dan poznat iz potpune pokrivenosti bez zapisa = 0")

Upoređeno redom provera u četiri funkcije (5K `assess.factKmOf`, 10K `written.factKmOf`, HM `adapt.factKmOf`,
MAR `mixed.factKmOf`):

| slučaj | 5K | 10K | HM | MAR |
|---|---|---|---|---|
| dan u prijavljenoj pauzi | 0 | 0 | 0 | 0 |
| pauza izvedena iz pokrivenosti (poznati dani bez trčanja) | 0 (pokrivenost) | 0 | 0 | 0 |
| dan sa zapisom (dayId, inače datum) | zbir urađenih km, neurađen 0 | isto | isto | isto |
| pokrivenost `complete = false` ili dan van opsega pokrivenosti | planirani km | planirani | planirani | planirani |
| delimična pokrivenost nedelje | po danu (opseg from–to) | po danu | po danu | po danu |
| zaključan budući dan bez zapisa | planirani | planirani | planirani | planirani |
| **urađen dan posle asOf** (zapis datuma ≤ asOf, `dayId` budućeg dana — npr. pomeren trening) | **planirani** (`assess.ts:80` `n > t → null`) | **upisani km** (`written.ts:51`) | **upisani km** (`adapt.ts:304-318`, iterira i dane posle asOf) | **planirani** (`adapt.ts:140` preskače dane > asOf) |

Zaokruživanje (0,01 km) i `countsToWeek` daju isti zbir (jedini dan sa `countsToWeek: false` je trka, a trkačka
nedelja je izuzeta). Jedina razlika je poslednji red → N2.

## 3. weekOffset / weekLabel

- 5K, 10K, HM: grep svih šablonskih poruka sa „nedelj…/ned" i `${…index|week|w|n}` u jezgru (`assess`, `adapt`,
  `generate`, `week`, `validate`, `feel`, `runWalk*`) i u `app/*.ts`: svaki broj nedelje kalendara ide kroz
  `weekLabel`/`wl`. Preostala sirova mesta su zapisani izuzeci: STRUCTURE (`validate.ts:184` 5K, `:258` 10K, `:304`
  HM), uvod „nedelja k od N" (10K `week.ts:281`, `:394`; HM `week.ts:730`), „u nedeljama 1–2" (10K `validate.ts:306`,
  položaj u segmentu), 5K `BEGINNER_INTRO` (`validate.ts:308`, opis pravila, 08l), `throw` (steps/week). Ostali
  pogoci su km vrednosti („Nedelja 18 km < …") i interni tagovi `adaptInvariants`/`gridInvariants` (samo testovi).
- Traka 10K/HM (`adaptBanner`) i 5K (`neededOf`) vraćaju `reason.message` koje su već prošle kroz `wl`.
- Maraton nema `weekOffset`; poruke koriste sirov indeks (npr. `assess.ts:459` „nedelja ${f}") — ispravno jer maraton
  nikad nije cilj predaje (3i § 5). Razlika potpisa 5K `weekLabel(n, offset)` / 10K-HM `weekLabel(input, n)` i opsega
  (0–52 / ≥ 0) zapisana je u 08l. `Reason.week`/`Violation.week` = POSLE-MERGE.
- Zaključak: nijedna korisnička poruka jezgra 5K/10K/HM ne koristi sirov v2 indeks mimo zapisanih izuzetaka. Nema nalaza.

## 4. Pouka 37 — redosled smanjenja (detalj)

| korak | 5K | 10K | HM | MAR |
|---|---|---|---|---|
| okidač (višak) | `km(free) > R` bez tolerancije (`week.ts:272`) | > R + 0,1 (`week.ts:538`) | zaštićeni > sastavljeni za te datume i zbir > cilj + 0,1 (`week.ts:839-848`) | > ostatak + 0,1 (`mixed.ts:123`) |
| lagani do minimuma | `easyMinOf(faza)` | 3,0 km | 4 km | 5 km |
| dugi se ne skraćuje | da (`top` = dugi) | da | da | da |
| lagan ≤ preostali dugi | da | da (`hi` ≤ `top10`) | da (`caps10`) | da (`l10`) |
| otpada kvalitet: drugi, pa prvi | da (`week.ts:277-279`) | da, Q2 pa Q1 **ili test** (`week.ts:543`) | Q2, pa Q1; **test ostaje** (`week.ts:852`) | Q2, pa Q1; **test ostaje**; MP najniži nivo i dan < 5 km ostaju (`mixed.ts:151-155`) |
| otpada samo ako time staje (MAR-08) | da (`attempts`, `over` → [qs]) | da | da (`compose`, inače najmanja struktura sa kvalitetom) | da (`variants`, inače `over`) |
| ne staje → planirano > cilj + upozorenje | `MIXED_OVER_TARGET` (warn) | `MIXED_OVER_TARGET` (warn) | `MIXED_WEEK_OVER` (warn) | `MIXED_WEEK_OVER` (warn) |
| nedelja ostatka pauze | vlasnik pauza (`generate.ts:140-143`) | vlasnik pauza (`generate.ts:114`) | pouka 37 raspoređuje dane na cilj pauze (P:433) | vlasnik pauza (`mixed.pauseOwned`) |
| trkačka izuzeta | da | da | da (`week.ts:835`) | da (`adapt.ts:138`) |

Pouka 36 sidro: sve četiri = prva nedelja koja počinje posle poslednjeg RPE zapisa umora; asOf u njoj → ostatak
nedelje; već rasterećenje → bez novog. 5K/10K računaju inline, HM/MAR kroz `fatigueWeek` (ista formula).

## 5. Nalazi

| # | distanca | uzrok (fajl:linija) | klasa | predlog | status |
|---|---|---|---|---|---|
| N1 | 5K, 10K (prema HM, MAR) | Pouka 37: kontrolno trčanje / test među preostalim danima mešovite nedelje otpada kao kvalitet — 5K `week.ts:277-279` (TEST_3K je `kind: 'quality'`, `feel.ts:261-266`) i `week.ts:327` (skida oznaku testa); 10K `week.ts:543` (`kind === 'test'`, A21 „Q1/test", P:409). HM `week.ts:852` i MAR `mixed.ts:153` otpuštaju samo Q2/Q1 — „dugi i test ostaju" (HM P:433, HM-08 izveštaj). Ista situacija: u 5K/10K plan po osećaju gubi jedini test (posle adaptacije test „najviše jednom", 5K `validate.ts:422`) i ostaje po osećaju do trke; u HM/MAR test ostaje, a višak ide u planirano > cilj. Razlika je zapisana u DECISIONS svake distance, ali bez obrazloženja zašto se distance razlikuju. | T | Jedno pravilo za 4 distance (organizator): predlog — test se ne odbacuje radi ostatka (pouke 13 i 33: test/kvalitet ostaje; kao HM/MAR), ili test prvi premestiti po A13 umesto brisanja. Izmeriti mixed-deload/mixedGrid sa nedeljom testa po distanci. | potvrđeno čitanjem; broj tokova nepotvrđen (nije mereno) |
| N2 | 10K, HM (prema 5K, MAR i MASTER) | Zbir zaštićenih: urađen dan posle asOf (zapis datuma ≤ asOf sa `dayId` budućeg dana, npr. pomeren trening — 5K/10K `app/facts.ts` daje `dayId = origDate`) računa se po UPISANIM km u 10K (`written.ts:51`, `factKm` bez provere asOf) i HM (`adapt.ts:304-317`), a po PLANIRANIM km u 5K (`assess.ts:80`) i MAR (`adapt.ts:140`). MASTER pouka 37 i MAR A11c (P:376): „urađeni posle asOf = planirani km". 10K komentar `written.ts:33` („urađen posle asOf bez km") ne odgovara kodu. Uz to 5K P:769/786 kaže „urađen dan posle asOf u 5K nije činjenica", a `adapt.ts:134-137` ga ipak čuva (`keep` preko `dayId`). | T | Jedna definicija za 4 distance; MASTER literalno → 10K/HM na planirani km (ili, ako je upisani km namera, ispraviti MASTER i 5K/MAR). Ispraviti tekst 5K DECISIONS i 10K komentar. Mreža: Q dan k+1 urađen ranije (dayId budućeg dana, km ≠ plan) × asOf usred nedelje. | potvrđeno čitanjem; uticaj na plan nepotvrđen |
| N3 | 5K (prema 10K, HM, MAR) | Pouka 36 / A5 — koji zapis je „lagan" za umor: 5K uparuje zapis sa danom i po DATUMU kad nema `dayId` (`assess.ts:409` `byId.get(x.dayId ?? x.date)`), pa trčanje van plana na datum kvaliteta/trke nije lagano i ne broji se; 10K/HM/MAR (`assess.ts:423/420/430`) zapis bez `dayId` = van plana = lagan i broji se. Isti zapisi (npr. dodatno lagano trčanje uveče na dan intervala, RPE 7, uvoz bez uparivanja) → umor u 10K/HM/MAR, ne u 5K. Nije zapisano kao razlika. | T | Jedna definicija „lagan zapis" za 4 distance (predlog: zapis bez `dayId` = van plana, kao 10K/HM/MAR — 5K komentar `assess.ts:406` to već tvrdi). | potvrđeno čitanjem; učestalost nepotvrđena |
| N4 | 5K (prema 10K, HM, MAR) | Pouka 30: kad trkačka nedelja nije ≤ planirano tapera, 5K zadržava oštrenje i pretvara lagane dane u odmor (`week.ts:364-367` „dan pred trku, oštrenje i trka nikad"; P:738); 10K/HM/MAR prvo ukidaju oštrenje (A9: „sa njim bi trkačka nedelja bila veća od tapera", 10K `week.ts:721`, HM `week.ts:1053`, MAR `week.ts:995`), pa tek onda odmor. Ista situacija → 5K više dana odmora uz oštrenje, ostali bez oštrenja sa laganim danima. MASTER pouka 30 i ODLUKE N3 ne određuju mesto oštrenja; obrazloženje razlike nije zapisano. | T | Odluka organizatora: jedan redosled (predlog: kao 10K/HM/MAR — oštrenje ≤ taper je pouka 5, trkač pre trke treba lagane dane). | potvrđeno čitanjem; broj tokova nepotvrđen |
| N5 | sve (kodovi) | Isti kod, suprotno značenje: `MIXED_OVER_TARGET` je UPOZORENJE (opravdan višak) u 5K `validate.ts:478` i 10K `validate.ts:477`, a GREŠKA (odbijanje) u HM `validate.ts:601` i MAR `validate.ts:586`; HM/MAR upozorenje se zove `MIXED_WEEK_OVER`, 5K/10K grešku `MIXED_REMAINDER`. Van foldera generatora kod se ne čita (grep `web/src`), pa korisnik ne vidi razliku. Slično pouka 35: `LONG_NOT_LONGEST` (5K) / `LONG_SHORTER_THAN_QUALITY` (ostali). | K | Uskladiti nazive pri sledećoj izmeni (npr. upozorenje `MIXED_OVER_TARGET`, greška `MIXED_REMAINDER` u sve 4); merne skripte koje broje „bez upozorenja" po kodu proveriti po distanci. | potvrđeno |
| N6 | 5K (prema 10K, HM, MAR) | Pouka 20: traka 5K je u `app/adapt.ts:127-160` (`neededOf`): PAUSE/FATIGUE/UNDER/OVER/NEW_RESULT/TRANSITION kad su primenjeni i plan se menja posle danas; nema provere „NOVO ograničenje" (`steps.newLimits`, 10K `steps.ts:289`, HM `:293`, MAR). ODLUKE-4a red „traka": pravilo u domenu svake distance, HM premešten iz `app/adapt.ts` — 5K nije pomenut. Primer razlike: primenjena pauza koja traje (isti period) uz promenu iz drugog razloga → 5K prikazuje poruku pauze, HM/MAR ne. | K | Prebaciti 5K traku u domen (`adapt.ts` + `newLimits`, oblik maratona) ili zapisati zašto 5K ostaje u app sloju. | potvrđeno čitanjem; razlika u prikazu na stvarnom toku nepotvrđena |
| N7 | HM (prema MAR) | Pouka 37: MAR ne odbacuje najniži nivo MP (2 × 3000 m) ni dan kvaliteta kraći od minimuma laganog (`mixed.ts:151-155`, „odluka organizatora", A11c P:376); HM `week.ts:852` odbacuje Q1/Q2 bez izuzetka najnižeg nivoa (RP pod iz N6 postoji, `quality.ts`). MASTER pouka 37 izuzetak ne pominje; ODLUKE ga ne beleže. | T | Organizator: izuzetak najnižeg nivoa u mešovitoj nedelji važi za HM (RP pod) ili ga ukinuti u MAR; zapisati u MASTER. | potvrđeno čitanjem; da li je odluka bila samo za maraton — nepotvrđeno (izvor odluke nije nađen u docs) |
| N8 | 5K (prema 10K, HM, MAR) | Pouka 37 okidač bez tolerancije: 5K `week.ts:272` menja preostale dane već pri višku > 0 km (seče lagane), 10K/HM/MAR tek pri višku > 0,1 km (tolerancija planiranog, 10K A21 „razlika do 0,1 km bez izmene"). Kvalitet ne otpada zbog toga (lagani prvi). | K | Uskladiti na toleranciju planiranog (0,1 km) ili zapisati zašto 5K nema toleranciju. | potvrđeno |
| N9 | 5K, MAR (prema 10K, HM) | Pouka 35 — opseg izuzetaka različit: 5K ne primenjuje u nedelji sa danima bola/odmora (`week.ts:84-87`, P:757), MAR ne u nedelji testa (`week.ts:767` `!test`), 10K samo ne u rasterećenju (`week.ts:437`), HM ni jedan od ta dva (`week.ts:700-705`). MASTER: „važi u generatoru i adaptaciji … taper i trkačka izuzeti". Svaki izuzetak zapisan samo u svojoj distanci. | T | Jedan opseg (MASTER) za 4 distance ili obrazloženje po distanci; meriti „dan kvaliteta > dugi" u nedeljama bola i testa. | potvrđeno čitanjem; učestalost nepotvrđena |
| N10 | 5K (DECISIONS) | Oznake verzije u DECISIONS ne odgovaraju tekstu: 08e (`policy.ts:688`) i 08g (`:726`) nose `5k-v2.8.1`, a tekst kaže „prilagođava se po 2.7.0 / 2.8.0"; 08k (`:834`) nosi `5k-v2.10.4`, tekst i FINAL kažu 2.10.3. `policy.version` i KNOWN_VERSIONS su ispravni (`app/plan.ts:44-56`), pa uslov 6 nije pogođen. | K | Ispraviti oznake redova DECISIONS. | potvrđeno |

## 6. Bez nalaza (provereno)

- Pokrivenost (37a): pauza iz pokrivenosti, delimična pokrivenost, `complete = false`, dan sa zapisom km i neurađen
  zapis — ista semantika u 4 distance (§ 2), osim N2.
- Pouka 37 detalji: lagani do minimuma distance, pa kvalitet (drugi, pa prvi), samo ako staje; dugi se ne skraćuje;
  dugi ≥ lagan među preostalim; trkačka izuzeta — sve 4 (§ 4). HM primenjuje pouku 37 i u nedelji pauze (na cilj
  pauze, P:433), ostale je prepuštaju pravilu pauze — obe varijante zapisane, 5K i MAR merenjem bez sudara (P:808,
  A11c); za HM merenje nije nađeno → nepotvrđeno, ne nalaz.
- Pouka 36 sidro: ista formula u sve 4 (5K `Math.max(r, …)` je bez efekta jer prozor umora ≤ 7 dana do asOf).
- Pouka 38: zaštićen test ostaje, nema drugog testa — sve 4 (jedna funkcija po distanci).
- Pouka 34: isti ishod (0,8 × ned 1, ned 2 = cilj ned 1, doza ned 1; dugi reference u L samo gde postoji pouka 28).
- weekOffset/weekLabel: § 3.
