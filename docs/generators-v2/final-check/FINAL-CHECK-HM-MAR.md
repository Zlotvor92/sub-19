# HM v2 i maraton v2 — domenska kompletna provera (Faza 4a)

Stanje: grana `claude/generator-isolation-5k-10k-hm-marathon`, vrh `a3913f8` (hm-v2.3.0 + HM-05 aplikacija;
marathon-v2.3.1; 10K v2 `10k-v2.5.x`; 5K v2 `5k-v2.7.x`). Samo čitanje koda i merne skripte; kod generatora i
aplikacije nije menjan. Posle merenja na granu su stigli HM-06 i MAR-05/06 (`9443676`, `b4acb68`, `df90f52`):
maraton `adapt.ts`/`steps.ts` menja samo traku (pouka 20); konstrukcija plana nije dirana. Skripte i JSON: ovaj folder (komande u § 4). Čitanje koda (zadaci 4–5): tri agenta za
čitanje + moja provera navedenih linija; svaka tvrdnja ispod sa brojem je iz pokrenute skripte.

**Zaključak:** generatori HM v2 i maraton v2 su u svim pretragama bez odbijanja (rana i srednja adaptacija: HM
114 012, maraton 164 394, 10K 121 392 toka — 0 odbijanja, 0 prekršaja). Nađeno: 1 klasa odbijanja u maratonu (N1,
40 tokova ciljane pretrage), 3 klase u 5K (N2–N4), 2 trenerske greške adaptacije posle novog starta (N5, N6),
neusklađenosti pouka bez obrazloženja (N7–N10) i šum upozorenja (N11). Ispravke predlažem; ništa nije ispravljeno.

## 1. Šta je provereno

| provera | kako | rezultat |
|---|---|---|
| Trenersko čitanje (1) | `coach.ts`: po distanci 12 planova (3/4/5/6 d, mali/veliki obim, spor/brz, po osećaju, početnik, kratka/duga) + 6 adaptacija baznog plana 4 d (bol 5, pauza 20, pauza 35, umor pre starta, +2 VDOT, lanac) → `coach-HM.md`, `coach-MAR.md` | 24 + 12 planova, 0 odbijanja; zapažanja § 2 (N5, N6, N7, N12) |
| Učestalost upozorenja (2) | `warnings.ts`: CELE mreže generatora; HM R 16 896, F 6336, B 1890; maraton R 21 840, F 8190, B 1890, M13a 34 980 | tabela § 3; M13a 930 odbijanja RECENT_LONG_TOO_SHORT (poznato) |
| Rana i srednja adaptacija, 4 distance (3) | `early.ts`: svaki 193./97./29. plan (R/F/B, pomak k/2; 5K sopstvena mreža 3816 ulaza, svaki 29./19./11.), BEZ planova trajnih mreža (isključeno: 10K 57, HM 6, maraton 9); asOf start − 6/− 3/− 1, sreda i kraj nedelje 1 … N − 2; svih 17 scenarija + drugi korak lanca; provere: prošlost bajt-ista (dani ≤ asOf, urađeni, zaključani), prazan trening, dugi ≥ lagan, trkačka ≤ poslednji taper, 'none' = generator (nedelje bajt-iste), adaptInvariants distance | 5K 194 plana / 75 456 tokova: **92 odbijanja**, 34 trkačka > taper; 10K 264 / 121 392: 0; HM 212 / 114 012: 0; maraton 253 / 164 394: 0. 'none' ≠ generator: 0 na sve 4 |
| Ciljane pretrage (kandidati iz 1 i 4) | `targeted.ts`, svaki 61./31./17. plan (HM 594, maraton 736): (a) bol 7/8 svaki dan ned N − 2 i N − 1 (3–4 d); (b) LONG_RUN_SHORT posle adaptacije; (c) pauza 35 na kraju ned 3 … N − 4; (d) napomena „nije izvodljiv u konstrukciji" | (a) maraton 40/7560 EMPTY_WEEK (N1), HM 0/6636; (b) HM 5/2928 lažno (N9); (c) N5, N6; (d) N11 |
| Doslednost pouka 1–34 (4) | čitanje HM ↔ maraton i 5K/10K, provera linija | razlike N4, N7–N10 |
| Jedan vlasnik (5) | veličine konstruktor ↔ validator, HM i maraton | N9 |
| Vreme testova (6) | `vitest run --project node <dist>/v2` brz i pun, redom, sam na mašini; `npm test` | § 3.1 |

## 2. Nalazi

### N1 — ISPRAVKA-PREDLOG: maraton odbija trkačku nedelju samo sa trkom (pouka 30)
Maraton, 3 dana, bol 7 ili 8 u nedelju (poslednji dan) nedelje N − 1 → trkačka nedelja ima samo trku (dani pre
trke su odmor A4) → `EMPTY_WEEK`, plan se ne vraća. 40/7560 tokova ciljane pretrage, HM isti ulaz 0/6636.
Primer: `d3-13w-35km-v40-C-sun`, asOf = dan 7 ned 12 (`w12d6`), bol 7. Uzrok: `marathon/v2/validate.ts:515`
EMPTY_WEEK bez izuzetka; HM ima `raceOnly` (`halfMarathon/v2/validate.ts:526–533`, HM-04 tačka 4). Trajne mreže
ga ne hvataju (asOf N − 1 nedeljom nije u mrežama). Predlog: isti izuzetak kao HM (trkačka sa trkom ≥ minimum →
RACE_WEEK_SHORT/ništa), uz odluku o HM tački 4 koja još „traži potvrdu".

### N2 — ISPRAVKA-PREDLOG: 5K rana adaptacija — 92 odbijanja (pouka 23)
- 76 × `TEST_WEEK` („kontrolno trčanje najviše jednom"): lanac pauza 10 (sreda ned 2) → manjak 50 % (asOf + 7),
  planovi po osećaju 6 ned. Primer `f-d4-6w-30km-e420-0`: korak 1 premesti test 3 → 4; korak 2 (sreda ned 3,
  posle originalnog dana testa 17. 11.) odbijen. Isto i kad su urađeni dani iz adaptiranog plana; prolazi samo
  korak bez zapisa (samo `coverage`). Verovatan uzrok (nije dokazan korak po korak): `fiveK/v2/steps.ts:203–211` premešta test samo kad je dan Q1
  nedelje testa posle poslednjeg asOf; validator `fiveK/v2/validate.ts:325–336`.
- 16 × `BASE_R_DECREASE`: sporiji rezultat (−2 VDOT) u bazi. Primer `r-d5-14w-60km-v32-1`, asOf sreda ned 3,
  5 km 30:41: „R u bazi 2,10 km < prethodne 2,40 km" (ned 5). Konstruktor ne počinje progresiju R iznova posle
  novog VDOT-a (`fiveK/v2/generate.ts:96–104` resetuje samo uz cilj obima/feel), validator traži da R ne pada
  (`validate.ts:725–735`). Konstruktor sastavi ono što validator odbija (pouka 23).
5K trajne mreže nemaju asOf pre starta ni sredu svake nedelje u lancu (08e: kraj/sreda bez lanca) — zato nije
uhvaćeno. Predlog: segment 5K (ispravka + trajna mreža kao HM `earlyAsOfs` × 17 scenarija).

### N3 — ISPRAVKA-PREDLOG: 5K trkačka nedelja > taper (pouka 30 ne postoji u 5K)
34 toka (bol 8 na kraju ned N − 2): primer `r-d3-9w-20km-v45-1`, asOf kraj ned 7: taper ned 8 planirano 7,9 km
(3 dana odmora), trkačka 9,3 km. 5K nema pravilo „trkačka ≤ taper" ni RACE_WEEK_SHORT (validator 5K
`validate.ts:409–412`). Predlog: preuzeti pouku 30 (višak laganih trkačke → odmor) ili zapisati odluku da za 5K ne važi.

### N4 — ISPRAVKA-PREDLOG: 5K ne primenjuje pouku 29 (prošlost = upisani dani)
`fiveK/v2/generate.ts:109–110` (poslednji dugi trkačke iz sastavljene nedelje), `:165` (stanje doze iz sastavljene
nedelje); `adapt.ts:134` gradi bez prethodnog plana, spajanje tek posle (`:165–193`); validator preskače mešovite
nedelje u proverama zavisnim od prošlosti (`validate.ts:243–244`, `:703–704`). 10K/HM/maraton imaju `written.ts`.
U pretrazi N2 nema klase koja se svodi na ovo, ali validator to ne bi ni video. Bez obrazloženja u 5K DECISIONS.

### N5 — ISPRAVKA-PREDLOG (trenerska): posle novog starta (pauza ≥ 28) dugi kraći od kvalitetnih dana
Pauza 35 na kraju ned 3 … N − 4: nedelja izgradnje sa dugim < 10 km u HM 3714/5425 tokova (68 %), maraton
4179/9063 (46 %); dugi kraći (po trajanju) od dana kvaliteta: HM 1867 (34 %), maraton 2171 (24 %); najkraći dugi
HM 4,0 km, maraton 5,0 km. Primer (`coach-HM.md`, d4 40 km, pauza 35 kraj ned 8): ned 11 cilj 27,1 km, dugi
5,8 km (34 min), Q1 I 2×1000 (48 min), Q2 T 2×1200 (47 min); maraton d4 50 km: dugi 10,8–14,6 km do trke.
Uzrok: dva dana kvaliteta sa WU/CD po ULAZNOM obimu (H14/M14: 20/15 min) + lagani ≥ 4/5 km, dugi je ostatak;
najniži nivo zone je izuzet od drugog člana (pouka 32) → samo upozorenje LONG_SHORTER_THAN_QUALITY. Trener: dugi
od 6 km za polumaraton nema svrhu; skratio bi broj kvalitetnih dana. Predlog (odluka organizatora): posle novog
starta jedan kvalitet dok dugi ne pređe min(udeo, X km), ili WU/CD po cilju nedelje adaptacije.

### N6 — ISPRAVKA-PREDLOG: HM RP ispod najnižeg nivoa (H10) posle novog starta
31 dan „RP 2,0 / 2,4 km kontinuirano" (najniži nivo RP 2 × 2000 m) u specifičnoj fazi, 3 dana, pauza 35. Primer
`d3-11w-40km-v70-A-sun`, pauza 35 kraj ned 3, ned 7 (cilj 26,6). Uzrok: `halfMarathon/v2/quality.ts:194–197`
prenosi T dozu u RP preko `structuresForDose(ladder, prev.doseM)` bez poda; maraton ima pod MP
(`marathon/v2/quality.ts:165`, MAR-03). Predlog: isti pod za RP (kao maraton) → A9 (jedan kvalitet/bez).

### N7 — ISPRAVKA-PREDLOG (usklađivanje): pouka 34 — doza nedelje 2 posle umora pre starta
HM: ned 2 dobija dozu planirane ned 2 (`halfMarathon/v2/steps.ts:287` `advance(ref)`), maraton ponavlja dozu
planirane ned 1 (`marathon/v2/generate.ts:145`, A5 „opreznije"). Primer `coach-*.md`, umor start − 3: HM ned 2
40 km, R 8×200 + T 2,5; maraton ned 2 50 km, R 6×200 + T kao planirana ned 1. MASTER pouka 34 ne govori o dozi.

### N8 — ISPRAVKA-PREDLOG (nizak prioritet): maraton validator posle mešovite nedelje ne čita stanje (pouka 29)
`marathon/v2/validate.ts:876–880` `'unknown'` → preskaču se DOSE/IDENTICAL/START (`:1039–1043`); HM čita stanje
upisane mešovite nedelje (`halfMarathon/v2/validate.ts:890–907`, ispravka HM-04 t. 2). Konstruktor maratona čita
upisano (`generate.ts` `writtenPicks`). Posledica: slabija provera, ne odbijanje (0 u 164 394 toka).

### N9 — ISPRAVKA-PREDLOG (refaktor, bajt-isti izlaz): dve definicije iste veličine (pouka 24)
HM: najduži dugi tapera — konstruktor `longestLong10(written)` (`generate.ts:226`), validator inline max
(`validate.ts:1388`); L pouke 28 inline dvaput (`generate.ts:182–186`, `validate.ts:575–578`); preStart lookup
na 3 mesta (`steps.ts:283`, `volume.ts:248`, `validate.ts:892`); stanje doze kopija `quality.advance`
(`validate.ts:1393–1403`); LONG_RUN_SHORT računa najduži samo preko proverenih nedelja (`validate.ts:586`, 597) —
**izmereno 5/2928** lažnih upozorenja (npr. `d4-11w-35km-v50-B-sat`, bol 5 sreda ned 4: najduži 16,6 ≥ 16).
Maraton: nominalni cilj inline (`validate.ts:1150–1158` ↔ `volume.ts:121–133`), minimum nedelje inline na 3 mesta
(`volume.ts:155`, `:357`, `validate.ts:529`; poređenje u km, HM u 0,1 km), dugi tapera (`lengths.ts:187` ↔
`validate.ts:1425–1429`), pod T izuzetka (`validate.ts:852` ↔ `quality.deloadMinM`), `expectedReduced`
(`validate.ts:173`) ↔ `quality.reduced`, WU/CD inline (`validate.ts:670–674`). Osim LONG_RUN_SHORT sve je danas
ekvivalentno (isti brojevi u policy); rizik je pri sledećoj izmeni jedne kopije.

### N10 — SVESNA ODLUKA potrebna: HM ↔ maraton razlike bez obrazloženja u DECISIONS
| pouka | HM | maraton |
|---|---|---|
| 3/32 ponavljanje doze | tiho (napomena „ponovljen"), bez upozorenja `validate.ts:1053–1060` | upozorenje IDENTICAL_WEEKS uz proveru oba člana `validate.ts:997–1018` |
| 28 RECENT_LONG_TOO_SHORT | samo generator, bez provere uzroka `generate.ts:248` | i adaptacija, samo kad bez r ne zastaje `generate.ts:248–257` |
| 28/34 dugi reference u L | ne ulazi (`rollingLongCap10`) | ulazi kao nedelja 0 (`steps.ts:53` `jumpRecentKm`) |
| 33 skraćen dugi rasterećenja | svi planovi (`lengths.ts:169–188`) | samo test/početnik/adaptacija (`week.ts:492`) |
| 20 traka | samo nova ograničenja (`steps.ts:248`) | na `a3913f8` i rezultat, manjak/višak; **usklađeno u MAR-06 (`df90f52`, posle ovog merenja)** — `steps.newLimits` |
| 14 preporuka manje dana | da (`validate.ts:695–700`) | ne (`validate.ts:643–648`) |
| 27 piramida | `stepPyramid` (isti broj deonica) | `pyramidOf` (≥ 3 deonice, I 2000 → nema) |
| 23 trajna rana mreža pre starta | 7 scenarija, bez rezultata | 5 scenarija (`PRE_START_SCENARIOS`) |
Moja pretraga (17 scenarija, pre starta) pokriva obe — 0 odbijanja; razlike su semantičke, ne greške izvršavanja.

### N11 — ŠUM (predlog za aplikaciju): upozorenja i napomene
Vidi § 3. Predlozi: MARATHON_LONG_SHORT (59–96 % planova; kada je uzrok 150 min, to je namerna granica M13) →
**promeni uslov**: samo kad dugi NIJE ograničen trajanjem (tada je savet „više dana/obima" stvaran), inače jedna
rečenica u opisu plana. HM WEEK_FITTED (13,5 % R / 22,3 % F planova, 6,4–6,9 poruka po planu, svaka nedelja
zaseban red u „Na šta da paziš", do 21 reda) → **prikaži jednom** (zbir: „N nedelja spušteno do X km"). Napomena
nedelje „Cilj po pravilu … nije izvodljiv u konstrukciji nedelje" (maraton 332/736 = 45 %, HM 89/594 = 15 %;
primer 45,0 → 44,9 km) → **ukloni iz korisničkog prikaza** (tehnička). CAPACITY_LIMITED (maraton 25–37 %, HM
11–17 %) → zadrži (stvaran savet, jednom po planu). DELOAD_LONG_SHORTENED (početnik 22–24 %) → zadrži, jednom.

### N12 — POZNATO OGRANIČENJE / SVESNA ODLUKA (trenersko čitanje, bez izmene)
- Dugi maratona ≤ 150 min (M13): najduži dugi 18,1–25,7 km kod VDOT ≤ 50 (`coach-MAR.md`: 9/12 planova sa
  MARATHON_LONG_SHORT); 4d VDOT 32: dugi 18,7 km 7 nedelja zaredom. Trener bi kod sporih dodao vreme ili savet HM.
- Plato: HM 4d 60 km VDOT 62 — dugi 24 km svake ne-rasteretne nedelje 1–14; HM 5d 20 ned — 63 km i dugi 20,1 km
  u ned 8–18; maraton 6d 120 km od ned 6. Posledica H6/M6 (vrh od starta) — prihvatljivo, monotono.
- Lagan = dugi u taperu N − 2 maratona (6/12 planova; npr. 3d 50 km ned 16 17,2 = 17,2) i HM 4 d pri vrhu
  (bazni plan maratona ned 10–11 lagan 23,0–23,7 / dugi 24,4) — kao 10K N3.
- HM 3 d mali obim (25 km): rasterećenje ned 11 bez kvaliteta, taper bez kvaliteta, trkačka bez oštrenja (H11
  ispred H7; TAPER_NO_QUALITY 3,1 % planova R) — poslednje 3 nedelje samo jedan RP dan.
- Pain 5 usred izgradnje: dugi 9,7 → 14,6/18,3 km sledeće nedelje (posle nedelje bola; povratak) — ispravno.
- 10K pouka 25: WEEK_MIN_VOLUME meri planirano i uz dane bola bez odmora (`tenK/v2/validate.ts:428–449`), HM/5K
  daju upozorenje; u 121 392 toka 0 — nedostižno u merenim mrežama; uskladiti tekst pri sledećoj izmeni.

## 3. Brojke

Upozorenja generatora (% planova sa pravilom; poruka po planu):

| pravilo | HM R | HM F | HM B | MAR R | MAR F | MAR B | MAR M13a |
|---|---|---|---|---|---|---|---|
| MARATHON_LONG_SHORT / LONG_RUN_SHORT | 6,6 | 6,3 | 30,0 | 59,0 | 72,7 | 95,7 | 76,4 |
| WEEK_FITTED | 13,5 (6,4) | 22,3 (6,9) | 2,9 (2,8) | — | — | — | — |
| CAPACITY_LIMITED | 11,2 | 17,4 | 1,0 | 25,1 | 36,7 | 3,2 | 24,4 |
| TAPER_NO_QUALITY / TAPER_MP_OVER_CAP | 3,1 | 3,1 | — | 7,1 | 8,4 | — | 8,8 |
| DELOAD_NO_QUALITY / DELOAD_LONG_SHORTENED | 2,6 | 2,5 | 2,5 / 22,5 | — | — / 1,5 | 24,3 | — |
| LONG_SHORTER_THAN_QUALITY | 0,8 | 1,1 | 6,7 | — | — | 1,4 | 5,2 |
| DOSE_DROPPED | 0,9 | 0,9 | — | 1,6 | 2,1 | — | 1,6 |
| redova „Na šta da paziš" (medijana / p90 / max) | 0/4/18 | 2/12/21 | 3/5/13 | 1/3/4 | 3/5/7 | 4/5/7 | 1/3/4 |

### 3.1 Vreme testova (4 jezgra, redom, ništa drugo nije radilo)

| skup | brz (zid, fajlova/testova) | pun `TEST_FULL=1` (zid, fajlova/testova) |
|---|---|---|
| fiveK/v2 | 24,5 s (16 / 655) | 70,3 s (17 / 655) |
| tenK/v2 | 54,7 s (23 / 303) | 533 s (38 / 426) |
| halfMarathon/v2 | 45,8 s (24 / 238) | 489 s (40 / 297) |
| marathon/v2 | **66,1 s** prvo / 57,9 s drugo pokretanje (22 / 266) — granica 60 s | 706 s (42 / 336) |
| `npm test` (ceo repo, CI nivo) | — | **2248 s = 37,5 min**, exit 0, 359 / 3583 |

- Maraton brz nivo je na granici (≈ 58–66 s; MAR-04b 57 s) → ŠUM/rizik: smanjiti uzorak mreže 04/rane u brzom
  nivou maratona (npr. k × 1,3) ili podeliti najduži fajl.
- CI (GitHub Actions „Testovi", ceo posao sa E2E): run 597 (push, `8beef45`) 18:24:29 → 19:25:56 = **61,5 min**;
  run 598 (pull_request, isti SHA, uporedo) 18:24:34 → 19:21:38 = **57,1 min**, oba uspešna. Pun nivo lokalno
  pokrenut pre nego što je stigla izmena organizatora (meri se samo brz nivo); brojke ostaju kao merenje.
- CI: lokalno 37,5 min sa 3 radnika vitesta; CI > 45 min potvrđeno (57–61 min). Broj jezgara CI runnera ne znam. Predlog (TEST-SPEED
  § 3 tačka 3): `vitest run --shard=i/n` u GitHub matrici (zid ≈ ukupno / n po poslu, ista pokrivenost); bez
  shardinga: pune adaptacione mreže 10K/HM/maraton (533 + 489 + 706 s po distanci) su najveći deo — njihove delove
  `*.full.node.test.ts` pokretati u posebnom (noćnom) poslu, ne na svaki push. Ne skraćivati pokrivenost.

## 4. Komande (iz korena repoa; Node 22 skida tipove sam)

```
node docs/generators-v2/final-check/coach.ts HM > docs/generators-v2/final-check/coach-HM.md      # i MAR
node docs/generators-v2/final-check/warnings.ts HM 1 > docs/generators-v2/final-check/warnings-HM.json   # 73 s; MAR 443 s
node docs/generators-v2/final-check/early.ts 5K 29 19 11 > …/early-5K.json     # 214 s
node docs/generators-v2/final-check/early.ts 10K 193 97 29 > …/early-10K.json  # 821 s
node docs/generators-v2/final-check/early.ts HM 193 97 29 > …/early-HM.json    # 1072 s
node docs/generators-v2/final-check/early.ts MAR 193 97 29 > …/early-MAR.json  # 2127 s
node docs/generators-v2/final-check/targeted.ts HM > …/targeted-HM.json        # i MAR
```
`lib.ts`: zajednički (distance, 17 scenarija, 5K ekvivalent `facts5k`, nezavisne provere `commonChecks`).
