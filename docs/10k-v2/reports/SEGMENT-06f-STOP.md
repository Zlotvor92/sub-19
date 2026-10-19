# 10K v2 — Segment 06f: STANI posle merenja (pouka 35 > 0; pouka 36 menja i prvu adaptaciju ponedeljkom)

Polazni SHA `7ba9717`. Grana `claude/generator-isolation-5k-10k-hm-marathon`. **Kod nije u commitu** (commit sadrži samo
`docs/10k-v2/`). Implementacija t. 1–4 i 6 je završena i proverena, sačuvana kao
`artifacts/segment-06f/06f-prototype.diff` (`git apply` na `7ba9717`). Pouka 35 (t. 5) NIJE implementirana.

## 1. Zaključak
1. Pouka 36 (t. 1) radi: `fatigue-repeat.ts 10K end` **903/963 → 0**, bez `end` 0 → 0; trajna mreža (isti umor
   asOf + 1 … + 7) 0 novih rasterećenja; regresija = samo tokovi ponovljenog umora (§ 3).
2. **STANI 1 (regresija van t. 1):** pravilo „isti zapisi = isti plan bez obzira na dan" menja i PRVU adaptaciju umora
   kad je asOf prvi dan nedelje redovnog rasterećenja: 620/2712 tokova (`monday-06f.json`) — na 7ba9717 redovno k +
   prinudno k + 1 (dva zaredom), sada samo redovno k (isto kao isti zapisi poslati dan ranije). Nijedan od 620 drugog
   oblika. Na mreži E i uzorku 4a ovih tokova nema (asOf sreda/kraj nedelje). Primer: `d4-r-18w`, prvo rasterećenje,
   asOf = njegov ponedeljak (zapisi ned/pet pre) — 7ba9717: prinudno sledeće nedelje; sada umor nije primenjen.
3. **STANI 2 (t. 5): pouka 35 se javlja u 10K** (> 0) i u generatoru i u adaptaciji; primena menja ~2,8 % planova
   generatora (bazne linije R/F) — trenerska i arhitektonska odluka (§ 4).
4. Traka (t. 2), tekst prekidača (t. 3), pouka 25 (t. 4), verzija `10k-v2.6.0` (t. 6): gotovo u prototipu.

## 2. Šta prototip menja (jedan vlasnik)
| fajl | izmena |
|---|---|
| `assess.ts` | A5: sidro `na` = prva puna nedelja posle (poslednji RPE zapis umora + 1); rasterećenje u planu u nedeljama `na … n − 1` pokriva zapise → umor nije primenjen („rasterećenje posle ovih zapisa je već u planu (nedelja k, A5)"). Jedina odluka. |
| `steps.ts` | `newLimits(steps)` — kopija maratona (MAR-06), ne uvoz. |
| `adapt.ts` | `adaptBanner(before, r, facts, asOf)` — JEDINO pravilo trake; newLimits iz `r.plan.adaptation.steps` (nije novo polje rezultata → heševi rezultata isti). Izvoz i iz `index.ts`. |
| `app/adapt.ts` | `neededOf`/`BANNER` uklonjeni; `needed: adaptBanner(v2, r, built.facts, src.today)`. |
| `validate.ts` | pouka 25: `WEEK_MIN_REST` (upozorenje) i za nedelju sa danima bola bez odmora (van trkačke — ona ima RACE_WEEK_SHORT); tekst za odmor isti. |
| `policy.ts` | `10k-v2.6.0`; A5 dopuna; nova odluka **A18** (pouke 36, 20, 25; merenje pouke 35). `app/plan.ts`: KNOWN_VERSIONS + `10k-v2.5.2`. |
| `features/ti/screens.tsx` | uklonjena rečenica „Prilagođavanje 10K v2 plana stiže uskoro."; ostatak isti. |
| testovi | `fatigue.node.test.ts` (nov, 7); `earlyGrid.harness` (pouka 36 trajna mreža); `adapt.node` A5 (ponedeljak → sreda + nov slučaj); `tenKV2Flow.test.tsx` (tekst prekidača); oznake verzije (policy, periodize, painGrid, app, adaptFlow, `e2e/tenk-v2.spec.ts`, `tenKV2Flow.test.tsx`). byteSame: `marathon/v2/app/byteSame.9443676.json` samo 13 redova `10K v2 #0/#1` (dokazano: 7ba9717 sa oznakom 6.0 daje bajt-isti fajl — samo oznaka). `personalPlan.node.test.ts` netaknut, prolazi. |

## 3. Merenje (pouka 15)
| | pre (7ba9717) | posle |
|---|---|---|
| `early.ts 10K 193 97 29` | 264 plana, 121 392 toka, 0 odbijanja, 0 prekršaja | isto, 0 / 0 |
| `fatigue-repeat.ts 10K end` / bez `end` | 903/963 / 0 | **0** / 0 |
| `measure-06f.ts` (isti uzorak, + isti činjenice asOf + 1; umor + 1 … + 7) | 269 760 tokova, 1057 odbijeno (1056 ponovljen umor pre starta WEEK_INFEASIBLE, 1 pain8/+1) | 1 odbijen (isti pain8/+1) |
| promenjeni tokovi (heš ili traka) | — | **9192, svi ponovljen umor** (5484 manje rasterećenja); drugih 0 |
| traka: novo pravilo domena ↔ staro pravilo aplikacije, isti plan | — | 0 razlika na 269 760 |
| pouka 25 (dan bola bez odmora, WEEK_MIN_*) | 0 | 0 |

`compare-06f.json`. Novi nalaz van zadatka: `b-d4-11w-18km-v35-B-sat/w9end/pain8/+1` (isti bol 8 sutradan) →
RACE_WEEK_OVER_TAPER (trkačka 9,3 > taper 3 km), i na 7ba9717.

## 4. Pouka 35 — merenje (t. 5)
- Generator (sve mreže 01/02/F/B, 31 122 plana, `p35-generator-06f.ts`): **2022 nedelje u 858 planova**; 4 d 330, 5 d
  414, 6 d 1278; ned 1 u svih 858, ned 2 558, ned 3 318, dalje ≤ 138. Duži od dugog: q1 R 1650, I 174, RP 42; q2 T 1662.
  Razlika medijana 5,6 min (p90 15,8, max 23,2). Primer `10w-25km-v70-A-sat` ned 1: dugi 5,6 km 23 min; R 6 × 200
  32 min; T 2,0 km 31 min. B 0. Svih 858 već ima upozorenje D25 (LONG_SHORTER_THAN_QUALITY).
- U ≥ 92 % tih nedelja i q1 je duži od dugog (WU/CD 25 min) → drugi dan → lagan ne vraća dugi na prvo mesto, ostaje
  upozorenje (pouka 14).
- Adaptacija (prvi korak, uzorak 4a): **3602/121 392** toka (pauza 35: 1148, bol 5: 447, pauza + bol 429, pauza 20 390,
  pauza 10/lanac 304, manjak 267, bol 8 241, ostalo ≤ 14) — `p35-adapt-06f.json`. Primer `d4-8w-40km-v40-B-sat` pauza
  35 kraj ned 1, ned 5: dugi 5,6 km 36 min, RP 48 min, T 46 min (oblik HM/maraton nalaza).
- Opcije: (A) doslovno (q2 → lagan u generatoru i adaptaciji, dugi raste; menja ~858 planova generatora i bazne linije
  R/F, novi oblik nedelje u `week.ts` + validator ROLES/D9); (B) samo adaptacija (generator: D25 ostaje svesno
  upozorenje — nizak obim/brz tempo, WU/CD); (C) obe, ali samo kad q2 → lagan zaista vrati dugi na prvo mesto.
  **Preporuka: B** (generator bajt-isti, isti nalaz kao HM/MAR je u adaptaciji); A ako organizator želi jednako pravilo.

## 5. Pitanja organizatoru
1. Prihvata li se klasa ponedeljka (620 tokova, § 1.2) kao deo pouke 36? (preporuka: da — to je baš „isti zapisi =
   isti plan"; inače bi sidro moralo biti asOf, suprotno pouci.)
2. Pouka 35: A, B ili C (§ 4)?
Posle odgovora: primeniti prototip (+ pouka 35 po odluci), verzija ostaje `10k-v2.6.0`, izveštaj IMPLEMENTATION.

## 6. Provere prototipa (iz `web/`)
`npx tsc -b --noEmit`, eslint, prettier — čisto; `npm run check` 281 fajl / 3393 testa, 6 min 27 s;
`TEST_FULL=1 npx vitest run --changed 7ba9717` 190 fajlova / 1579 testova, 13 min 13 s; pun nivo
`TEST_FULL=1 … tenK/v2` 39 fajlova (35 + earlyGrid 1–4 posle uzorka trajne mreže pouke 36 na punom nivou: svaki 4. tok
umora dela × 7 — ceo skup je prekoračio 120 s po delu; deo ≈ 4 min); `npx playwright test e2e/tenk-v2.spec.ts` 3/3. Sabotaže
(`artifacts/segment-06f/sabotage-06f.json`, alat, `--bail=1`, brz): (a) umor vezan za asOf PAO, (b) traka u
aplikaciji PAO, (c) tekst prekidača vraćen PAO — 3/3, 45,5 s, `src` bajt-isti. Testovi koji padaju pre: fatigue 3/7,
pouka 36 trajna mreža (`b-d3-10w-20km-e390-A-sat/w1end/fatigue/+1: rasterećenja 2 → 3`), tekst prekidača.
