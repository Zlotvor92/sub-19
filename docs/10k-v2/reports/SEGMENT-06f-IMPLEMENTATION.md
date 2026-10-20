# 10K v2 — Segment 06f (10k-v2.6.0): pouka 36 (umor i bol vezani za zapise), traka u domenu, tekst prekidača, pouka 25, pouka 35

Polazni SHA `7ba9717`; posle STANI (`reports/SEGMENT-06f-STOP.md`, d892fb8) odluke organizatora: (1) prva adaptacija
umora ponedeljkom prihvaćena; (2) pouka 35 opcija A (generator i adaptacija); (3) nalaz ponovljenog bola ispraviti.
Menjano: `tenK/v2/**`, `docs/10k-v2/**`, jedna rečenica u `features/ti/screens.tsx`; oznaka verzije u
`e2e/tenk-v2.spec.ts` i `features/onboarding/tenKV2Flow.test.tsx` (+ test teksta prekidača); 13 redova `10K v2` u
`marathon/v2/app/byteSame.9443676.json`. `personalPlan.node.test.ts` netaknut, prolazi. Bez PR-a, mergea, deploya.

## Šta i gde (jedan vlasnik)
| tačka | mesto | pravilo |
|---|---|---|
| 1 pouka 36 | `assess.ts` A5, `steps.deloadWeekOf` | prinudno rasterećenje = prva nedelja koja počinje posle poslednjeg RPE zapisa umora (dopuna organizatora: kad asOf već pada u nju — ostatak tekuće nedelje, `korak.deloadWeek`; urađen test te nedelje ostaje, bez novog testa); već rasterećenje → umor nije primenjen. |
| 3 (nalaz) pouka 18 | `assess.ts` A4 | korak bola sa asOf ≥ poslednjeg zapisa bola ga je obradio → isti zapis ne pravi nov period („već u planu"); nov zapis pravi. Uzrok nalaza: period odmora vezan za asOf pomeren za dan → taper 3 km < dan pred trku 3,3 km → RACE_WEEK_OVER_TAPER. |
| 2 traka | `adapt.ts` `adaptBanner`, `steps.ts` `newLimits` | oblik maratona (MAR-06); `app/adapt.ts` samo poziva. newLimits iz koraka plana (nije novo polje rezultata → heševi rezultata isti). |
| 3 tekst | `screens.tsx` | uklonjeno „Prilagođavanje 10K v2 plana stiže uskoro." |
| 4 pouka 25 | `validate.ts` | WEEK_MIN_REST (upozorenje) i uz dane bola bez odmora (van trkačke). |
| 5 pouka 35 | `week.ts` `buildWeek` | izgradnja (bez rasterećenja/tapera/trkačke), 2 dana kvaliteta, neki duži od dugog → q2 lagan, cilj isti, buildLengths (dugi raste), napomena `P35_DROP`; jedan kvalitet neizvodljiv → dva + `P35_KEEP`. |
| 5 validator | `validate.ts` | isti predikat `qualityOverLong`: QUALITY_OVER_LONG (greška) / TWO_QUALITY_LONGER (upozorenje uz P35_KEEP); uloga q2 → lagan; glavna doza sme da padne; ponavljanje jedinog slota (kao 3 dana); stanje q2 posle mešovite nedelje nepoznato dok ga ne odredi nedelja sa q2. |
| dopuna: zaštićeni dani | `validate.ts` `protectedDay`, `adapt/generate/written` `doneDayIds` | kao maraton MAR-07b (kopija): provere po danu (tipovi, WU/CD, RPE, oporavci, test, lagan ≥ min) preskaču dane ≤ asOf, zaključane i urađene; urađen dan posle asOf u `plan.adaptation.doneDayIds`. |
| 6 verzija | `policy.ts` | `10k-v2.6.0`, odluka A18 (+ dopuna A5); KNOWN_VERSIONS = 4.0, 4.1, 5.0, 5.1, 5.2, 6.0. |

Primer pouke 35: `10w-25km-v70-A-sat` ned 1: dugi 5,6 → 8,2 km (34 min), R 6 × 200 32 min, T dan lagan. 6 dana 35 km
VDOT 70: q1 i dalje duži od dugog → napomena + D25 (preporuka 3–5 dana).

## Merenje (pouka 15; iz `web/`, skripte u `artifacts/segment-06f/`)
| | 7ba9717 | 10k-v2.6.0 |
|---|---|---|
| `fatigue-repeat.ts 10K end` / bez `end` | 903/963 / 0 | **0** / 0 |
| `early.ts 10K 193 97 29` | 121 392 toka, 0 odbijanja, 0 prekršaja | **0 / 0** (`early-after.json`) |
| `measure-06f.ts` (uzorak 4a + iste činjenice asOf + 1; umor + 1 … + 7) | 269 760, 1057 odbijeno | **0 odbijeno** |
| umor ponedeljkom (`fatigue-monday.ts 10K`, zapisi u k − 1) | 176/296 „tekuća + 1" (organizator); e7ad505: 148/296 | **268 tekuća, 28 bez novog** (k već rasterećenje), 0 tekuća + 1 |
| zaključan Q1 posle novog rezultata (`locked-result.ts 10K`) | 1645/1960 odbijeno (WARMUP/COOLDOWN) | **0** |
| generator: nedelje sa 2 kvaliteta dužim od dugog | 2022 u 858/31 122 planova | **0**; 1854 nedelje sa q2 laganim |
| adaptacija (prvi korak): isto, buduće nedelje | 3602/121 392 | 467 — svi u nedelji asOf (sreda, mešovita: prošli dan kvaliteta upisan) |
| pouka 25 (dani bola, WEEK_MIN_*) | 0 | 0 |

Regresija (heš bez oznake verzije; `compare-06f.json`, `gen-hashes-06f.ts`, `adapt-nets-06f.json`):
- Generator: promenjeno **tačno 858 ulaza** (966 id-jeva mreža 01/02/F) = planovi sa nedeljom pouke 35; prva promenjena
  nedelja = prva nedelja pouke 35 u svih 858; vrh cilja isti, vrh planiranog ≤ 0,1 km niže (zaokruživanje), najveća
  glavna doza niža u 240 (q2 progresija kreće kasnije), najduži dugi viši u 30. Početnik (B) 0.
- Trajne mreže: 04 76/2040, E 5436/102 707, R 1668/18 193, P 0/336 — svaki promenjen tok ima nedelju pouke 35 u
  rezultatu ili bazni plan pouke 35 (E: 64 samo bazni plan). Fixture `segment06f.adapt-changed-7ba9717.json` (stari heš);
  starije regresije porede stanje 7ba9717 (`at7ba`), novi testovi proveravaju tačan skup.
- measure-06f: promenjeni samo ponovljen umor (9322), ponovljen bol (20 232; nalaz 3) i tokovi pouke 35 (6068 van
  ponavljanja, svi sa nedeljom pouke 35 na 7ba9717 ili baznim planom pouke 35); drugih 0. Traka: domen = staro
  pravilo aplikacije na svih 269 760 tokova (0 razlika). byteSame maratona: samo 13 redova `10K v2 #0/#1`.

## Testovi (padaju pre izmene) i sabotaže
- Novi: `fatigue.node.test.ts` (9: pouka 36, traka, pouka 25, nalaz 3), `p35.node.test.ts` (6: generator, validator);
  `earlyGrid.harness`: trajne mreže „umor pet/ned k − 1, asOf ned k − 1 ili pon k → rasterećenje k, isti dani od
  utorka" (izuzetak: pon k je dan testa), „nov rezultat + zaključan ili urađen Q1 sledeće nedelje → 0 odbijanja, dan
  bajt-isti, doneDayIds", „isti umor asOf + 1 … + 7 → 0 novih rasterećenja, traka bez umora" i „isti bol 7/8
  kraj ned N − 3/N − 2 asOf + 1 … + 7 → 0 odbijanja, isti plan" (pun: svaki 4. tok umora; svi planovi dela za bol).
  Na 7ba9717 padaju (npr. `b-d3-10w-20km-e390-A-sat/w1end/fatigue/+1: rasterećenja 2 → 3`).
- Ažurirani (06f): regresije grid/feelGrid/adapt/E/R (skup pouke 35), A5 (ponedeljak → sreda + slučaj ponedeljka), D25
  (p4 bez upozorenja, p6 sa), K2 (bazni plan promenjen: upisan dugi 10,5), periodize/quality/week (q2 lagan).
- Sabotaže (`sabotage-06f.json`, alat, `--bail=1`): umor vezan za asOf (fatigue.node), traka u aplikaciji (adaptFlow:
  manjak isti dan posle primene), tekst prekidača vraćen (tenKV2Flow), pouka 35 isključena (p35.node), bol vezan za asOf
  (fatigue.node), umor ponedeljkom u sledećoj nedelji (earlyGrid), validator sudi zaštićenom danu (earlyGrid) — 7/7,
  `sabotage-06f-result.json`.

## Provere (iz `web/`)
`npx tsc -b --noEmit`, eslint, prettier — čisto; `npm run check` 290 fajlova / 3475 testova (posle dopune), 4 min 36 s; brz nivo
tenK/v2 25 fajlova / 323 testa; pun nivo `TEST_FULL=1 … tenK/v2` (40 fajlova; posle ispravke tabela D25 grid/feelGrid
8 fajlova ponovo, 90/90); `TEST_FULL=1 npx vitest run --changed 7ba9717` **302 fajla / 2966 testova** (posle dopune i mergea), 41 min 50 s;
`npx playwright test e2e/tenk-v2.spec.ts` 3/3; sabotaže 7/7 pale, `src` bajt-isti (66,7 s; pouka 35 isključena →
plan generatora odbijen QUALITY_OVER_LONG, pada pri učitavanju p35.node). Tabele D25 (planova sa upozorenjem): R
0/132/132/330 → 0/0/0/132, F 0/78/78/132 → 0/36/24/78.

## Otvoreno / poznato
- Nov zapis bola sutradan (ne isti) u istom slučaju (`b-d4-11w-18km-v35-B-sat`, bol 8 ned 9, nov bol 8 sutra) i dalje →
  RACE_WEEK_OVER_TAPER (dan pred trku 3,3 km > taper 3 km): trenerski izbor (skratiti dan pred trku ili trkačka >
  taper uz upozorenje) — pitanje organizatoru.
- Pouka 35 u mešovitoj nedelji asOf (467 tokova): prošli dan kvaliteta je upisan; konstruktor odlučuje na sastavljenoj
  nedelji, validator mešovitu nedelju proverava po danu.

## Stalni uslovi 1–8
1. Jedno mesto: sidro umora/bola (assess), traka (adaptBanner), broj dana kvaliteta (buildWeek); bez petlji. 2. Plafoni
nepromenjeni. 3. WU/CD netaknuti (q2 → lagan, ne skraćenje WU/CD). 4. Uslovi poznati unapred kroz korak. 5. Handoff nije
diran. 6. `10k-v2.6.0`, faze iz generatora. 7. Nula novih uvoza van foldera (isolation prolazi). 8. adaptInvariants i
trajne mreže: 0 odbijanja, bez praznih treninga, dugi ≥ lagan.
