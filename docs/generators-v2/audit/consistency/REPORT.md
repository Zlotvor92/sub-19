# Ugao 5 — doslednost distanci + odložene odluke (consistency)

Kod: `670700e` (`git diff --stat 670700e HEAD -- web/` prazan pre merenja i pre izveštaja). Samo čitanje i merne
skripte u ovom folderu; `web/` nije menjan. Sve skripte su determinističke (svaki k-ti plan mreže `final-check/lib.ts`,
bez slučajnosti — seed nije potreban; k je zapisan u komandi). Pokretanje iz `web/`:
`node ../docs/generators-v2/audit/consistency/<skripta>.ts <args>`; izlazi u `out/`.

Detaljne tabele po pouci (fajl:linija za svaku distancu):
- `lessons-01-19.md` — pouke 1–19 + pravila 5K/10K (agent čitanja koda; ključni nalazi ponovljeni merenjem, ispod).
- `lessons-20-38.md` — pouke 20–38, pravilo pokrivenosti, weekOffset/weekLabel, redosled smanjenja pouke 37.
- `messages.md` — isti događaj → ista poruka (34 situacije, F1–F21).

## Šta je mereno

| skripta | šta | tokova / ulaza |
|---|---|---|
| `deload-prev.ts <D> 13` | a) generator: redovno rasterećenje ≥ prethodna; adaptacija umor (lib `fatigue`), asOf = prvi dan SVAKE nedelje 2 … N−3 | gen 291 / 2 394 / 1 933 / 2 456 planova; adapt 1 660 / 16 288 / 16 113 / 26 648 (5K/10K/HM/MAR) |
| `mixed-drop.ts <D> 97` | b) pouka 37: otpao kvalitet u mešovitoj nedelji, procena viška da je zadržan, posledica | 4 245 / 43 740 / 42 810 / 70 335 |
| `rep-ceiling-5k.ts 7` | c) 5K I/T/R na novom (sporijem) tempu, Δ VDOT {0,1,2,4,6,8}, race/test, asOf svake nedelje | 66 216 tokova |
| `plausibility.ts`, `plausibility-gen.ts` | d) plauzibilnost ulaza svih mreža + odgovor generatora maratona | 127 890 ulaza mreža (5K 3 816, 10K 31 122, HM 25 122, MAR 31 920, MAR M13a 35 910) |
| scratchpad (nije commitovano, opisano u tekstu) | 5K početnik rasterećenje ned 1–2 (sve mreže generatora); 5K/10K cilj predaje sa rezultatom HM/maratona | 92 000 planova; 6 ulaza |

## Tabela nalaza

Klase: B blokira, T trenerski, N nerealan ulaz, K kozmetika. „čit." = potvrđeno čitanjem koda (broj tokova nije meren).

| # | ugao | distanca | broj | ulaz koji reprodukuje | uzrok | klasa | predlog |
|---|---|---|---|---|---|---|---|
| C1 | consistency | 5K (prema 10K/HM/MAR) | 72 / 648 ulaza početnika 5K mreže (svi 8-ned. početnici); 10K/HM/MAR 0 / 88 164 | `b-d3-8w-12km-e420-0` (lib 5K): ciljevi 12 → **9,6 R** → 12,6 → 13,2 | `fiveK/v2/periodize.ts:54–65`: početnik rasterećenje svake 3. nedelje, pomera se na n − 1 kad ned 3 počinje novu fazu; nema zaštite „ne u ned 1–2" (pouka 4) koju imaju ostale tri | T (B ako pouka 4 obavezuje 5K) | Organizator: pouka 4 važi i za 5K → zaštita ned 1–2 u `periodize.ts`, ili zapisati izuzetak u 5K DECISIONS |
| C2 | consistency | 5K (prema ostalim) | 355 / 1 660 tokova umora (21 %) bez rasterećenja; ostale tri 0 (svaki tok umora daje rasterećenje) | 5K `r-d4-6w-20km-v32-1`, činjenice lib `fatigue` (RPE 8/7 na asOf−1/−3, bez `dayId`), asOf 2026-11-09 | `fiveK/v2/assess.ts:407–409` uparuje zapis bez `dayId` po DATUMU; zapis na dan kvaliteta nije „lagan" → nema umora. 10K/HM/MAR: zapis bez `dayId` = van plana = lagan (`assess.ts:423/420/430`). Komentar 5K `assess.ts:406` tvrdi isto što i ostali | T | Jedna definicija „lagan zapis" (predlog: kao 10K/HM/MAR i 5K komentar) |
| C3 | consistency | 5K, 10K (prema HM/MAR) | čit. | — | Mešovita nedelja: test/kontrolno trčanje otpada kao kvalitet (5K `week.ts:277, 327`; 10K `week.ts:543`), HM `week.ts:852` / MAR `mixed.ts:153` ga čuvaju; plan po osećaju u 5K/10K može izgubiti jedini test | T | Jedno pravilo (predlog: test se ne odbacuje radi ostatka, kao HM/MAR) — `lessons-20-38.md` N1 |
| C4 | consistency | 10K, HM (prema 5K, MAR, MASTER) | čit. | — | Urađen dan posle asOf (pomeren trening, `dayId` budućeg dana) u zbiru zaštićenih: upisani km u 10K `written.ts:51` i HM `adapt.ts:304–317`; planirani km u 5K `assess.ts:80` i MAR `adapt.ts:140` (= MASTER pouka 37) | T | 10K/HM na planirani km (MASTER), ili ispraviti MASTER — `lessons-20-38.md` N2 |
| C5 | consistency | 5K (prema ostalim) | čit. | — | Pouka 30: 5K čuva oštrenje i lagane pretvara u odmor (`week.ts:364–371`); 10K/HM/MAR prvo ukidaju oštrenje (A9) | T | Jedan redosled — `lessons-20-38.md` N4 |
| C6 | consistency | 10K, MAR (prema HM, 5K) | čit. + 1 primer (10K) | 10K 14 ned / 40 km, bol 5 u ned 6: ned 9 T 3 × 1200 m; isti ulaz HM: T 2 × 1200 m | Pouka 18 „progresija doze ispočetka od r + 1": `restartWeeks` samo za nov start (10K `steps.ts:113–115`, MAR `steps.ts:158–160`) | T | Uskladiti (sidro bola u restartWeeks) — `lessons-01-19.md` N4; MAR izmeriti |
| C7 | consistency | 5K, 10K kao cilj predaje | 6/6 ulaza (domen): 5K odbija HM i maraton rezultat (RESULT_DISTANCE_UNSUPPORTED u generatoru, ADAPT_RESULT_INVALID u adaptaciji); 10K odbija maraton rezultat | `{startDate 2026-11-02, raceDate 2026-12-27, 4 d, 30 km, recentResult {21097,5 m, 6600 s}}` → `generateFiveKV2` | `fiveK/v2/app/handoffTarget.ts:91` i `tenK/v2/app/handoffTarget.ts:91` prenose `pb` izvora (HM/MAR `preparation.ts` `lastResult`) bez filtra distance; isto `targetFacts` (sirovi rezultati) | T (zapisano kao otvoreno u `handoff/SEGMENT-3d` § 6 „5K v2 ga odbija (M3 0)", nije u POSLE-MERGE; trkač HM sa HM rezultatom je realan → organizator: B?) | Cilj sam bira: rezultat nepodržane distance → bez rezultata (po osećaju/lak tempo izvora) ili RESULT_IGNORED; meriti mrežom predaje sa HM/MAR rezultatom |
| C8 | consistency | 5K | čit. | rezultat 5 km sporiji od ≈ 30:40 (VDOT < 30) | `fiveK/v2/input.ts:150–156` VDOT_OUT_OF_RANGE odbija; 10K/HM/MAR VDOT < min → plan po osećaju (`tenK/v2/input.ts:255`) | T | 5K: VDOT < min → po osećaju (obrazac 10K) |
| C9 | consistency | sve | čit. | — | Isti kod, suprotno značenje: `MIXED_OVER_TARGET` upozorenje u 5K/10K, greška u HM/MAR (HM/MAR upozorenje = `MIXED_WEEK_OVER`, 5K/10K greška = `MIXED_REMAINDER`) | K | Jedan par kodova; merne skripte „bez upozorenja" proveriti po distanci |
| C10 | consistency | HM | čit. | HM kao cilj predaje (weekOffset > 0), umor kad je sledeća nedelja već rasterećenje | `halfMarathon/v2/assess.ts:451` poslednja grana `nedelja ${f}` — sirov indeks; ostale grane `wl(f)` | K | `wl(f)` |
| C11 | consistency | 5K, MAR / 10K, HM | čit. | — | Pouka 35: opseg izuzetaka različit (5K bez nedelja bola/odmora, MAR bez nedelje testa, 10K samo bez rasterećenja, HM nijedan) | T | Jedan opseg ili obrazloženje — `lessons-20-38.md` N9 |
| C12 | consistency | HM (prema MAR) | čit. | — | Pouka 37: MAR ne odbacuje najniži nivo MP u mešovitoj nedelji (`mixed.ts:151–155`), HM odbacuje i najniži RP | T | Organizator: izuzetak za oba ili nijedan; izvor odluke nije nađen (nepotvrđeno da li je samo za MAR) |
| C13 | consistency | 5K | čit. + uzorak agenta (84/84) | početnik po osećaju, ned 3: test 5,5 km od 12,6 km, dugi 4,1 km | Pouka 13 „početnik nema test": `fiveK/v2/generate.ts:93`; nije u DECISIONS | T | Organizator: kontrolno 3 km za početnika po osećaju jeste namera? zapisati ili ukloniti |
| C14 | consistency | 10K, HM, MAR / 5K | čit. | — | Ponovljen isti zapis bola: samo 10K „već u planu" (`tenK/v2/assess.ts:336–349`); 5K/HM/MAR otvaraju nov period (`assess.ts:337/346/356`); posledica u aplikaciji nepotvrđena | T | Pravilo 10K (obrazac pouke 36) u sve 4 — `messages.md` F1 |
| C15 | consistency | sve | — | — | Poruke: decimalni zarez/tačka, interne oznake (A1, D6, „pouka N") u tekstu korisnika, „vi" samo u MAR, množina („5 lagana treninga"), `week` izgubljen u „Na šta da paziš", 10K `ADAPT_DELOAD_LONG` „sa testom" bez testa, MAR RECENT_LONG_TOO_SHORT bez praga i sa „≤ 10 %" umesto max(10 %, 1 km) | K (F7, F15, F16: T) | `messages.md` F1–F21 |
| C16 | consistency | ostalo | — | — | 5K WU/CD po cilju nedelje (uslov 3), 5K dan pred trku ≤ 4 km (do 34 min), pouka 14 bez testa u 10K/MAR/5K, 10K RP 2 × 1000 m van lestvice na 3 d/20 km, 5K traka bez `newLimits`, 5K tolerancija 0 km, 5K DECISIONS oznake verzije | T/K | `lessons-01-19.md` N3, N5, N7–N9; `lessons-20-38.md` N6, N8, N10 |

Bez nalaza (provereno čitanjem, detalji u fajlovima): pravilo pokrivenosti „dan poznat iz potpune pokrivenosti bez
zapisa = 0" isto u sve 4 (osim C4); sidro pouke 36 isto; pouka 38 ista; ishod pouke 34 isti; redosled smanjenja
pouke 37 isti (lagani → Q2 → Q1, dugi se ne skraćuje, kvalitet otpada samo ako time staje); weekLabel u 5K/10K/HM
svuda osim C10; maraton nema weekOffset (nije cilj predaje). Pragovi bol 4/7, odmor 3 d, period bola 7 d, umor
RPE ≥ 7 × 2, pauza 7/14/28 d, rezultat 84 d — isti u 4 politike.

## Odložene odluke (POSLE-MERGE) — merenje i predlog

### a) „Rasterećenje nije niže od prethodne nedelje"

| | 5K | 10K | HM | MAR |
|---|---|---|---|---|
| generator: redovno rasterećenje ≥ prethodna | 0 / 431 | 0 / 5 517 | 0 / 5 314 | 0 / 7 988 |
| tokovi umora (asOf 1. dan nedelje k) | 1 660 | 16 288 | 16 113 | 26 648 |
| …od toga prethodna nedelja = redovno rasterećenje | 431 | 4 399 | 4 259 | 7 988 |
| …i umor daje drugo uzastopno rasterećenje | 431 (100 %) | 4 399 (100 %) | 4 259 (100 %) | 7 988 (100 %) |
| „nije niže od prethodne" (planirano ≥ prethodna − 0,05) | 425 | 2 874 | 2 718 | 4 869 |
| …od toga uzrok „prethodna je redovno rasterećenje" | 425 (100 %) | 2 873 (+1 ned 2) | 2 718 (100 %) | 4 869 (100 %) |
| …sam cilj ≥ planirano prethodne | 425 | 2 854 | 2 689 | 4 788 |
| razlika planirano (medijana / p90 / max) km | 0 / 2,3 / 5,3 | 0 / 0 / 5,7 | 0 / 0 / 5,7 | 0 / 0 / 7,3 |
| isto u % prethodne (medijana / p90 / max) | 0 / 13,7 / 19 | 0 / 0,1 / 18,1 | 0 / 0 / 16,9 | 0 / 0,1 / 17,2 |
| ista dva uzastopna rasterećenja i po naslovima dana | 73 | 1 237 | 1 190 | 2 154 |

Činjenica: van prethodnog redovnog rasterećenja slučaj ne postoji (0 u svim distancama). Uzrok je jedan: umor zapisan
u nedelji redovnog rasterećenja daje prinudno rasterećenje sledeće nedelje = 0,8 × poslednja izgradnja = isti cilj kao
prethodno rasterećenje (npr. HM `d3-10w-25km-v40-A-sun` asOf 2026-12-07: 23,8 → 23,8). Iznad 0 km su samo mešovite
nedelje sa zaštićenim danom 1 (planirano > cilj uz MIXED upozorenje — pouka 37, poznato). Tokovi sa „ostalo" uzrokom: 0.
Brojevi 19/118/178 iz POSLE-MERGE su isti mehanizam na manjem uzorku (k ∈ {2, 4}, svaki 97. plan).

Mišljenje (trener): drugo rasterećenje posle rasterećenja kad trkač i dalje prijavljuje umor je prihvatljivo i
opreznije od izgradnje; nije bezbedno očekivati da bude NIŽE od prvog (to bi bila treća nedelja smanjenja bez
podatka da je potrebna). Predlog: prihvatiti kao svesnu odluku, zapisati u MASTER (pouka 36: „umor u nedelji
rasterećenja → sledeća nedelja rasterećenje istog cilja; ne niže") i ukloniti iz merenja kao „nalaz". Otvoreno
pitanje za organizatora: 15–28 % takvih parova ima i iste naslove dana (monotonija dve nedelje) — pouka 3 važi samo
za ne-rasteretne nedelje, pa nije prekršaj.

### b) Prag viška za otpadanje kvaliteta (pouka 37)

Procena (ne vrednost iz koda): višak da je kvalitet zadržan = (zaštićeni po činjenicama + preostali dani posle) +
(km kvaliteta pre − km istog dana posle) − cilj. Scenariji done100 / under50 / over120 / locked / incomplete, asOf
početak nedelje + 1/3/5 dana, nedelje 2 … N−3, svaki 97. plan.

| | 5K | 10K | HM | MAR |
|---|---|---|---|---|
| tokova / mešovitih nedelja | 4 245 / 849 | 43 740 / 7 692 | 42 810 / 16 968 | 70 335 / 27 892 |
| kvalitet otpao | 149 | 1 741 | 1 538 | 1 759 |
| scenario | samo over120 | samo over120 | samo over120 | samo over120 |
| višak ≤ 2 % / 2–5 % / 5–10 % / > 10 % | 0 / 34 / 102 / 13 | 4 / 100 / 1 245 / 392 | 16 / 121 / 1 184 / 217 | 19 / 273 / 1 296 / 171 |
| višak medijana / max km | 1,7 / 7,1 | 3,4 / 11,7 | 4,2 / 11,0 | 4,7 / 12,0 |
| sledeća nedelja: drugačija doza kvaliteta | 56 | 860 | 800 | 875 |
| kaskada cilja narednih nedelja (broj / max km) | 34 / 3,4 | 1 018 / 3,2 | 748 / 4,0 | 766 / 5,0 |
| odbijanja | 0 | 0 | 0 | 0 |

Činjenica: na ovim scenarijima kvalitet otpada SAMO kad je trkač ranije u nedelji trčao više od plana (over120: zaštićeni
dani 120 %). Otpada ceo dan kvaliteta (3–4 km razlike kvaliteta prema laganom), da bi nedelja stala u cilj koji je
trkač sam premašio.

Mišljenje (trener): kvalitet je glavni stimulus nedelje; višak koji je trkač sam napravio laganim km nije razlog da
izgubi T/I/RP dan. Predlog pravila sa brojem (mišljenje, bez izvora): kad je jedini uzrok viška upisani višak
(zaštićeni po činjenicama > planirani zaštićeni), a planirano sa zadržanim kvalitetom ≤ 1,10 × cilj, kvalitet ostaje,
lagani na minimumu, upozorenje MIXED (pouka 14). Prag 10 % pokriva 5K 136/149, 10K 1 349/1 741, HM 1 321/1 538, MAR 1 588/1 759; prag 5 % samo 34 / 104 / 137 / 292.
Alternativa bez novog broja: kvalitet ne otpada nikad radi upisanog viška (samo lagani do minimuma).

### c) 5K I_REP / T_CONTINUOUS — plafon trajanja na novom tempu

66 216 tokova (svaki 7. plan 5K mreže × svaka nedelja × Δ VDOT {0,1,2,4,6,8} × race/test): 0 odbijanja, 0 izuzetaka.
Najbliži prilaz: I tačno na plafonu 300 s (odnos 1,000; `r-d3-6w-25km-v45-0`, asOf 2026-11-04, Δ8 race, ned 4,
I 2 × 1000 m), T tačno na plafonu faze (1,000; `f-d4-6w-15km-e480-0`, asOf 2026-12-02, Δ0, „Tempo po osećaju 10 min"),
R 0,958. Dani sa odnosom > 0,95: I 20 942, T 7 382, R 1 158. Zaključak: plafon se dostiže (jednakost), ne prelazi.
Predlog: ulaz `r-d3-6w-25km-v45-0` Δ8 kao test granice (= plafon prolazi) i kandidat za sabotažu (`<` umesto `<=`
u `repFits` / I putanji); tok koji PRELAZI plafon nije nađen.

### d) Plauzibilnost ulaza

| pravilo | izvor | mreže generatora (5K/10K/HM/MAR, 91 980) | MAR M13a (35 910) |
|---|---|---|---|
| L1 najduži skorašnji > nedeljni obim | logika (jedan trening > cela nedelja) | 0 (nema polja) | 864 (2,4 %) — svi prihvaćeni (172/172 uzorka) |
| L2 najduži skorašnji < obim / dani | logika (najduži ≥ prosečan trening) | 0 | 7 749 (21,6 %) — u uzorku 185/1 552 RECENT_LONG_TOO_SHORT, 1 367 plan |
| B1 početnik VDOT > 45; B2 početnik lagan < 330 s/km | odluka korisnika (ODLUKE-4a „realni trkač") | 0 / 0 | — |
| V1 VDOT > 70 | ista odluka | 0 | 0 |
| M1 VDOT ≥ 60 uz obim ≤ 30 km | mišljenje (bez izvora) | 0 / 792 / 396 / 156 | 342 |

Čarobnjak (`features/onboarding/Step3Volume.tsx:38–39, 74–75`): obim 5–120, najduži 0–100 bez međusobne provere;
domen HM/MAR proverava samo opseg najdužeg 5–42 (`halfMarathon/v2/input.ts:239`). Koliko stvarnih unosa krši
L1/L2 — ne znam (nema podataka korisnika).
Predlog (L1/L2 su logika, ne trenerski broj): na ulazu HM/MAR odbiti ili tražiti potvrdu kad je najduži > nedeljni obim
ili < obim/dani (poruka „najduži trening ne može biti duži od nedelje / kraći od prosečnog"); edges-HM invarijanta
„3 d / 45 km / rl 5" je L2 i time otpada. M1 i „početnik × VDOT" van B1/B2: nemam izvor — bez pravila.

## Nepotvrđeno / nije urađeno
- C3, C4, C5, C11, C12, C14: broj tokova nije meren (samo čitanje).
- mixed-drop: scenario `locked` sabira zaključane buduće dane i u zaštićene i u preostale (moguće dvostruko); nalazi
  b) su svi iz over120, gde zaključanih nema.
- Aplikacijski deo pouke 8 (trka van obima u prikazu, uvoz van plana) — ugao 6.
