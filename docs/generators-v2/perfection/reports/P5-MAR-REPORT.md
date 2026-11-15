# P5 — maraton: kontrolni test, kvalitet u adaptaciji, ubrzanja, početna doza — izveštaj

10. 11. 2026 (Europe/Belgrade). Polazni SHA `8e87fd4` (marathon-v2.9.0) → marathon-v2.10.0. Zadatak
`briefs/P5-forma-ubrzanja-pocetna-doza.md` (za maraton F1–F4). Izmenjeno samo `web/src/domain/generators/marathon/v2/**`
i dokumentacija. STOP nije bio potreban: 0 novih odbijanja, F4 ne spušta izvodljivost, F2 bez odbijanja (posle dve
ispravke validatora koje nisu nova trenerska pravila — „Tumačenja").

## Šta je ugrađeno (redovi u `policy.ts`: P5-F1, A18, P5-F3, P5-F4; heuristika, odluka organizatora P5)

- **F1** — `periodize.ts` (jedino mesto: `testKindOf`, `testWeekOf`, `periodize`): plan sa rezultatom, ne početnik,
  ≥ 12 nedelja (`policy.test.resultMinWeeks`; za maraton svaki takav plan) ima tačno jedan test 5 km (isti `testWorkout`
  kao M16) u poslednjoj ne-rasteretnoj nedelji razvoja, na danu Q1. Progresija posle testa od stanja pre testa (postojeći
  `advance`). Napomena nedelje `week.TEST_NOTE_RESULT` (čemu služi, „unesi rezultat"). Adaptacija: bez novog koda —
  rezultat testa ide kroz A1, A13 (test posle novog rezultata otpada). Validator TEST: test po vrsti plana.
- **F2 / A18** — `assess.ts` (jedino mesto okidača): dva uzastopna kvalitetna dana plana (Q1, Q2, dugi sa blokom; ne
  test), oba u 14 dana do asOf i potpuno pokrivena, svaki neodrađen (tog datuma nijedno trčanje, ni van plana —
  preciziranje organizatora 00:41) ili RPE ≥ 9 u zapisu tog dana plana → `step.holdDose` = prva ne-rasteretna
  nedelja izgradnje od sledeće; razlog `QUALITY_HARD` + poruka korisniku (tekst iz naloga, `policy.adapt`). Ispod bola,
  pauze, umora i manjka (applied false); taper/trka bez efekta; `holdFrom` sprečava ponavljanje za iste zapise.
  Konstruktor: `ctx.hold` → `pickSlot/pickBuild` bez sledećeg nivoa, `chooseBlockKm` najviše max(blok, MP). Validator:
  QUALITY_HOLD; DOSE_STALL i BASE_PLATEAU ne traže rast u toj nedelji. Aplikacija: oznaka uslova u `app/adapt.ts`.
- **F3** — `strides.ts` (jedino mesto: `stridesSpecOf`, `stridesDateOf`, `lastHardBefore`), `workouts.easyStridesWorkout`
  (struktura dana pred trku, km dana isti), primena u `generate.ts`, validator STRIDES. Baza 4, od razvoja 6, početnik 4
  × 20 s posle uvoda; dan sa najvećim razmakom od prethodnog zahtevnog (i iz prethodne nedelje), pri jednakom raniji;
  dani zabrane kvaliteta i ubrzanja (bol, odmor, zabrana) isključeni.
- **F4** — `quality.startShareOf` (jedna funkcija za `startLevel` i validator START_LEVEL), `policy.startLevel.zoneShare`
  T/I 0,8; R i MP 0,6; početnik bez promene.
- `policyVersion` marathon-v2.10.0; `app/plan.ts` KNOWN_VERSIONS ∪ marathon-v2.9.0. Prikaz (`app/`): test plana sa
  rezultatom (oznaka „Test", tempo testa procena), dan sa ubrzanjima (blok „stride"), poruka F2 kroz `userText` — bez
  internih oznaka (provera u `p5.node.test.ts` i ručni ispis `generatedPlan` profila (a)).

## Tumačenja izvođača (nisu nova trenerska pravila — molim potvrdu)

- O1 (F1, validator — odluka organizatora 10. 11. 00:06): nedelja kontrolnog testa sa spuštenim slotom postaje
  referenca glavne doze sledeće nedelje (A). Bez toga 18 ulaza mreže 02 (`d4-{19,20,24}w-45km-v35-*`) odbijeno
  MAIN_DOSE_DECREASE (ned 12 A 10 800 < ned 10 11 400 m; test ned 11 spušta cilj 67,5 → 60,4 km, T 6400 → 4800). Planovi
  isti, samo validator; posle izmene 0 odbijanja (K5, pun nivo).
- O2 (F1, adaptacija — odluka organizatora): test plana sa rezultatom u nedelji sa ograničenjem otpada (ne premešta se;
  premeštanje A13 ostaje samo za plan po osećaju), uz poruku korisniku (razlog TEST_MOVED: „Kontrolni test 5 km
  (nedelja n) otpada: ta nedelja ima ograničenje treninga … unesi ga").
- T3 (F2): prelaz u novu zonu (I/T → MP, R → I) nije „rast doze slota" — ide po M12; `hold` važi za istu lestvicu i
  prelaz iste zone (T kont. ↔ T cruise). Bez toga 35 tokova DOSE_DROP/START_LEVEL (prelaz I → MP nema nivo ≤ I doze).
- T4 (F3): bez prethodnog zahtevnog dana (ned 1) razmak je neograničen → prvi lagan dan nedelje. U adaptaciji izbor se
  računa na nedelji kakva se upisuje; zaštićen izabran dan ostaje kakav je upisan, drugi dan ne dobija ubrzanja.
- T5 (F3, mere): ubrzanja su zona R, pa ulaze u „% km bržih od E" (vidi tabelu); test se broji (odluka organizatora);
  granica lagan ≥ 20 min se meri km dana laganim tempom (dan sa ubrzanjima traje ≈ 30–60 s kraće).
- O3 (F4 — dopuna odluke organizatora 00:28: veća početna doza ne sme da košta drugi dan kvaliteta): izmereno K7 na
  31 920 planova — nedelje sa lakim drugim danom kvaliteta (pouka 35, i taper) 0 → 0; nedelje sa dozom spuštenom zbog
  „dan kvaliteta ≤ dugi" (pouka 32) 0 → 0. Nedelje sa korakom „drop" 246 → 738: sve u nedeljama sa spuštenim ciljem
  (kapacitet, M6/M11), 570 od 738 su u nedeljama kontrolnog testa (F1: test bez km I treninga → cilj spušten → T na
  plafonu), van nedelja testa 246 → 168. Uslov dopune se ne aktivira — F4 ostaje „najviši nivo ≤ 80 %".

## Komande merenja (iz `web/`, osim K5)

- **K1** `node ../docs/generators-v2/perfection/P5-MAR/measure.ts pre` (na `8e87fd4`, pre izmena) i `… measure.ts posle`
  (1,0–1,4 s) → `P5-MAR/raw-{pre,f4,f34,posle}.json` (f4 = samo F4, f34 = F4 + F3, međukoraci patch-a).
- **K2** `node ../docs/generators-v2/perfection/P5-MAR/compare.ts pre posle` → `P5-MAR/compare-pre-posle.md`.
- **K3** `node ../docs/generators-v2/perfection/P5-MAR/extra.ts pre f4 posle` (udeo rada prvog T/I dana, nedelje > 25 %).
- **K4** `node ../docs/generators-v2/perfection/P5-MAR/f2flows.ts` (25 s) → `P5-MAR/f2flows.{json,txt}`.
- **K5** iz korena: `git worktree add <wt> 8e87fd4 && node --max-old-space-size=6144
  docs/generators-v2/perfection/P5-MAR/classify.ts <wt> 8e87fd4` (258 s) → `segmentP5.stable-8e87fd4.json`,
  `P5-MAR/changed-8e87fd4.json`.
- **K7** iz korena: `node --max-old-space-size=6144 docs/generators-v2/perfection/P5-MAR/second.ts <wt>` (pouka 35/32,
  ≈ 4 min) i `node … P5-MAR/drops.ts` (korak „drop" po fazi, nedelji testa i uzroku, ≈ 4 min).
- **K6** `node ../docs/generators-v2/perfection/P5-MAR/profile.ts posle` → `P5-MAR/profile-a-posle.txt` (pre =
  `P2/profile-a-MAR-posle.txt`, kopija `P5-MAR/profile-a-pre.txt`).

## Pre / posle — mreža P0 (192 ulaza; medijana [min–max]; K1, K2, K3)

| metrika | R pre | R posle | F pre | F posle | B pre | B posle |
|---|---|---|---|---|---|---|
| odbijeno | 0 | 0 | 0 | 0 | 0 | 0 |
| testova po planu | 0 | 1 [1–1] | 1 | 1 | 0 | 0 |
| nedelja od testa do trke | — | 8 [8–9] | 12,5 [9–16] | 12,5 [9–16] | — | — |
| T rad prvi [min] | 11,8 [6,9–34] | 17,9 [6,9–45,3] | 13,7 | 20,8 | 8,7 | 8,7 |
| I rad prvi [min] | 12,7 [6,3–26,1] | 18,6 [6,3–31,3] | 12,1 | 19,3 | — | — |
| rad kvaliteta nedelje 1 [min] | 17,1 | 22,7 | 19 | 25,2 | 0 | 0 |
| udeo rada prvog kval. dana (R baze) [%] | 14,5 | 14,5 | 17 | 17 | 25,5 | 25,5 |
| laganih dana sa ubrzanjima | 0 | 17 [11–23] | 0 | 17 [11–23] | 0 | 17 [13–21] |
| nedelja sa ubrzanjima / nedelja bez trkačke [%] | 0 | 100 | 0 | 100 | 0 | 89 (uvod) |
| % brzih km baza / razvoj | 9,3 / 11 | 11,3 / 13,2 | 10,5 / 9,5 | 12 / 11,5 | 3,1 / 7,3 | 3,6 / 7,9 |
| % brzih km specifična / taper | 18 / 14,6 | 18,7 / 15,9 | 17,3 / 16,4 | 17,9 / 17,3 | 12,8 / 11,2 | 13,4 / 11,9 |
| nedelja > 25 % brzih km (Σ) | 64 | 117 | 12 | 25 | 0 | 0 |
| vrh obima [km] | 74 | 74 (32 planova ±0,1–0,4) | 65 | 65,5 | 56,1 | 56,1 |
| ukupno MP [km] | 52 | 52 (Σ −62 km) | 49 | 49 | 39 | 39 |
| planova sa WEEK_FITTED / nedelja 1 ispod cilja | 27 / 0 | 27 / 0 | 8 / 0 | 8 / 0 | 4 / 0 | 4 / 0 |

K3 (R+F, n 176): udeo rada prvog T dana 28 [22–46] → 35 [22–56] %, prvog I dana 23 [14–34] → 28 [18–38] %. Nedelje >
25 % brzih km: 87 → 144; bez ubrzanja u brojanju 87 → 77 (rast je ceo od ubrzanja, F4 sam: 87). F4 sam (raw-f4): 0
novih odbijanja, planova sa WEEK_FITTED 27 → 27 (R), WEEK_FITTED nedelja 232 → 226.

Testovi po dužini pripreme (R, K1): 12 ned → test ned 4 (8 do trke), 18 ned → ned 10 (8), 24 ned → ned 15 (9).

**Izmereno, za odluku:** plan od 12 nedelja ima samo jednu ne-rasteretnu nedelju razvoja, pa test zauzima jedini I
trening — u 36/144 R planova (4–6 d, 12 ned) I više ne postoji (I prvi: 132 → 96 planova sa I).

## F2 — mreža tokova adaptacije (K4; R i F mreže P0, 176 planova × faza × varijanta)

asOf = drugi od dva uzastopna kvalitetna dana u prvoj pogodnoj ne-rasteretnoj nedelji faze; ostali dani odrađeni.

| faza | varijanta | tokova | applied | applied:false | odbijeno |
|---|---|---|---|---|---|
| baza | RPE 9 / preskočeno / umor* / manjak | 176 / 176 / 176 / 176 | 176 / 49 / 132 / 0 | 0 / 127 / 44 / 176 | 0 |
| razvoj | isto (12 planova bez nedelje) | 164 ×4 | 156 / 126 / 100 / 0 | 0 / 30 / 56 / 156 | 0 |
| specifična | isto | 176 ×4 | 152 / 100 / 104 / 0 | 0 / 52 / 48 / 152 | 0 |
| sve | jedan RPE 9 (bez okidača) | 516 | 0 | — (nema razloga) | 0 |

Razvoj/specifična RPE 9: 8/24 tokova bez razloga QUALITY_HARD (u prozoru nema dva uzastopna kvalitetna dana).

*„umor" = dva lagana RPE 7; u planovima sa jednim laganim danom umor se ne okida (tada F2 applied). „Preskočeno" →
applied:false kad manjak izvršenja (A2) ima prednost. U 1095 primenjenih tokova: doza nedelje bez rasta nije porasla
ni u jednom (u 542 bi bez F2 porasla); nominalni cilj obima isti u svim; izvodljiv cilj (M6) niži u 101 (9 %) za
0,4–4,0 km (manje km kvaliteta → lagani na 0,8 × dugi ne nose cilj).

## Promenjeni planovi (K5; mreže 02, 03 po osećaju, 03 početnika: 31 920)

0 razlika u odbijanju; ubrzanja u 31 920/31 920. Poređenje plana bez ubrzanja (`grid.harness withoutStrides`) sa
starim: bajt-isto 2484 (B 1890/1890, F 594/8190, R 0/21 840); prva različita nedelja F1 1584 (R), F4 27 852 (R 20 256,
F 7596), **ostalo 0** — svaka razlika počinje u nedelji testa ili u nedelji sa drugačijom T/I dozom, a sve nedelje pre
nje su bajt-iste. Novi STABLE = 1716 (presek sa `segmentP2.stable-38fd091.json`); bazne linije se porede posle
`withoutStrides` (ubrzanja proverava `invariants`).

## Profil (a) (10 km 46:00, 40 km, 4 d, 16 ned; K6)

| | pre (2.9.0) | posle (2.10.0) |
|---|---|---|
| ned 1 T | 2,0 km kont. (9,4 min rada, dan 34 min) | 3,0 km kont. (14,1 min, dan 39 min) |
| prvi I (ned 5) | 2 × 1000 m (8,7 min) | 3 × 1000 m (13,0 min) |
| test | — | ned 7 (razvoj), uto, 5 km, 9 ned do trke |
| ubrzanja | 0 | 15 laganih dana (baza 4, dalje 6 × 20 s) + dan pred trku |
| ukupno MP / najduži dugi / dugi sa blokom | 52 km / 24,0 km / 2 | 52 km / 24,0 km / 2 |

## Sabotaže (`P5-MAR/sabotage.json`; `node scripts/sabotage.mjs ../docs/generators-v2/perfection/P5-MAR/sabotage.json --quiet`)

9/9 palo, `--bail=1`, stanje `src` vraćeno (poslednje pokretanje, posle svih izmena: 14,8 s): F1a plan sa rezultatom bez
testa, F1b test u rasteretnoj nedelji, F2a okidač bez efekta, F2b `hold` uzima sledeći nivo, F2c validator bez
QUALITY_HOLD, F3a uvek 4 ubrzanja, F3b pri jednakom razmaku kasniji dan, F3c validator bez STRIDES, F4a udeo T/I 60 %.
Prva verzija F3c nije pala (test je menjao i km — hvatao ARITHMETIC); test zamenjen (lagan dan iste dužine bez ubrzanja).

## Testovi (komanda — trajanje — ishod)

Iz `web/`, 10. 11. 2026 od 00:05 (Europe/Belgrade):

| komanda | trajanje | ishod |
|---|---|---|
| `npx vitest run <fajl>` (namenski, u toku rada) | 1–7 s | — |
| `npx vitest run --project node src/domain/generators/marathon/v2` (brz, 1. put) | 35 s | 21 fajl pao (verzija, bazne linije, očekivanja F1/F4) |
| isto, posle ispravki | 39 s | 40 fajlova, 442 testa zeleno |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2` (1. put, pre O1) | 856 s | 78 fajlova, 544 testa zeleno |
| isto, posle O1/O2 i preciziranja F2 (prvi ponovljeni prekinut posle ≈ 8 min zbog preciziranja F2) | 807 s | 78 fajlova, 546 testova zeleno |
| `npm run check` | 455 s | 345 fajlova, 3894 testa zeleno |
| `npx vitest run --changed 8e87fd4` | 136 s | 159 fajlova, 1590 testova zeleno |
| `npx playwright test e2e/marathon-v2.spec.ts --trace off` | 76 s | 3/3 |

Prilagođeni postojeći testovi (ulaz ili očekivanje koje menja P5, sa komentarom): adapt, adaptGrid (6236 → 6468 tokova:
asOf „preTest" i za planove sa rezultatom), beginner, feel, policy, quality, segment07, segment08c, segment11, validate,
week, app (KNOWN_VERSIONS, test u planu sa rezultatom), grid.harness (invarijanta testa po vrsti plana, nova invarijanta
ubrzanja, 20 min laganim tempom, `withoutStrides`, STABLE → `segmentP5.stable-8e87fd4.json`). Nov `p5.node.test.ts`
(18; uključuje uvoz bez dayId na datum kvalitetnog dana → bez okidača). Fikstura van foldera sa maratonom v2 ne postoji (`grep marathon-v2.9.0` van foldera: 0).

## Mišljenje (odvojeno od merenja)

1. F4 je izmerljivo popravio prvi T/I (≈ +5–6 min rada) bez gubitka izvodljivosti; udeo rada prvog dana kvaliteta
   (R u bazi) se ne menja jer R ostaje 60 %.
2. F1 test 8–9 nedelja pred trku daje svež tempo za MP i T specifične faze; cena je jedan I trening (u planu od 12
   nedelja — jedini).
3. Rast „nedelja > 25 % brzih km" je artefakt brojanja ubrzanja kao brzih km; bez njih broj pada (87 → 77).

## Otvorena pitanja organizatoru

1. Potvrda tumačenja T3–T5 (O1–O3 su po odlukama organizatora).
2. Plan od 12 nedelja: test zauzima jedini I trening razvoja (36 R planova bez I). Prihvatiti, ili test u planu od
   12–13 nedelja na Q2 / u poslednjoj nedelji baze?
3. F2: izvodljiv cilj niži u 9 % primenjenih tokova (0,4–4,0 km) — postojeći M6, nominal isti. Prihvatiti?
4. Brojati ubrzanja u „% km bržih od E" (P7 metrika) ili ne?
