# P5-HM — forma, kvalitet u adaptaciji, ubrzanja, početna doza — hm-v2.10.0

10. 11. 2026 (Europe/Belgrade). Polaz `8e87fd4` (hm-v2.9.0). Zadatak `briefs/P5-forma-ubrzanja-pocetna-doza.md` (F1–F4) i
odluke organizatora iz dnevnika (10. 11. 01:07 i 01:28, posle P5-10K STOP — „važi za sve distance"). Izmene samo
`web/src/domain/generators/halfMarathon/v2/**`, plus snimak bajt-istosti maratonskog app sloja (vidi „Van foldera").
STOP nije bilo: 0 novih odbijanja, F4 ne spušta izvodljivost, F2 bez odbijanja u tokovima, bez sudara „dan kvaliteta ≤ dugi".

## Pravila (policy.ts P5-F1 … P5-F4; heuristike, odluka organizatora P5)

- **F1** (`periodize.testKindOf` — jedina odluka vrste testa; čitaju je generate, adapt, adaptInvariants, validate):
  plan sa rezultatom, ne početnik, ≥ 12 ned → test 5 km (isti kao po osećaju) u poslednjoj ne-rasteretnoj nedelji
  razvoja, dan Q1; progresija posle testa od stanja pre testa (postojeći mehanizam H16). Napomena nedelje
  `RESULT_TEST_NOTE` (čemu služi, unesi rezultat). Rezultat ulazi postojećim A1. **Odluka 01:07**: kontrolni test u
  nedelji sa ograničenjem otpada (ne premešta se) uz poruku TEST_MOVED; nedelja testa sa spuštenim slotom je referenca
  glavne doze (validator; mreža P0: 12 od 96 nedelja kontrolnog testa ima spušten slot — drugi dan lagan; na HM ni pre
  te izmene nije bilo MAIN_DOSE_DECREASE — M4 0 novih odbijanja). Test se broji u % brzih km (zona `test`).
- **F2** (`assess.qualityStrain` okidač; korak `qualityHold`/`qualitySeen`; `steps.holdAt`; `quality.pickSlot` hold;
  `specific.wantBlockKm` hold): Q1/Q2/dugi sa blokom (ne test), dva uzastopna u 14 dana, potpuno pokrivena, svaki
  neodrađen (**odluka 00:41**: tog datuma nijedno trčanje — ni zapis dana ni trčanje van plana/uvoz) ili RPE ≥ 9
  (zapis tog dana) → nedelja n (prva puna posle asOf) bez rasta doze: bez sledećeg nivoa (druga struktura, inače
  ponavljanje uz napomenu), prelaz T kont. ↔ T cruise ista doza, blok RP na poslednjem nivou. Prelaz u novu zonu (I, RP)
  po H12 (početni nivo nije rast — **tumačenje taba**). Cilj obima isti. Ispod bola, pauze, umora, manjka (applied
  false). Isti zapisi jednom. n = rasterećenje/taper/trka → bez efekta (**tumačenje**: ne prenosi se na sledeću izgradnju).
  Traka (adaptBanner CHANGE) + napomena `HOLD_NOTE`; app naziv uslova.
- **F3** (`week.withStrides`, `stridesDate`, `stridesReps`; `workouts.easyStridesWorkout`): jedan lagan dan u svakoj
  nedelji osim trkačke i uvoda početnika; baza 4 × 20 s, od razvoja 6 (i rasterećenje te faze — **tumačenje**:
  „nedelje izgradnje" uključuju rasterećenja), početnik 4. Dan = najveći razmak od prethodnog zahtevnog (i iz prethodne
  nedelje), pri jednakom raniji; ne dan bola/odmora ni zaštićen dan (zaštićen dan sa ubrzanjima ih zadržava). Km dana
  isti (lagan deo = km − ubrzanja − oporavci), workKm 0.
- **F4** (`policy.startLevel.capShare` T/I 0,8, R/RP 0,6; `quality.startFit`): **odluka 01:28** ugrađena za pouku 32
  (u postojećem mestu odluke, `pickSlot` grana početnog nivoa; validator START_LEVEL ista funkcija): najviši nivo ≤ 80 %
  čiji dan nije duži od dugog, inače nivo po 60 % (`fallbackShare`). Deo „ne izaziva pouku 35" **nije** ugrađen: traži
  novo mesto odluke (izbor nedelje unazad) → P-a; na HM F4 nedelje pouke 35 **smanjuje** (tabela dole).
- Test infrastrukture (folder HM): `adaptGrid.harness` `runFlow` čuva SHA-256 JSON-a toka umesto celog JSON-a — sa
  većim planovima (segmenti ubrzanja) deo `earlyGrid` punog nivoa je držao 3,3 GB heap-a i radnik je pucao na
  podrazumevanom heap-u (OOM); posle izmene 169 MB. Provera determinizma ista (jednakost heša).
- Van zadatka, nalaz: `app/plan.ts KNOWN_VERSIONS` nije sadržao `hm-v2.8.0` (verzija u `main`-u) otkad je P1 podigao
  verziju — sačuvan plan hm-v2.8.0 bi posle mergea bio „unknown". Dodati hm-v2.8.0 i hm-v2.9.0 (+ test).

## Komande (iz `web/`, pre = worktree `8e87fd4`)

| | komanda | trajanje |
|---|---|---|
| M1 | `node ../docs/generators-v2/perfection/P5-HM/measure.ts <pre\|posle>` → `raw-<oznaka>.json` (nije u repou, 13–16 MB) | 1,4 s |
| M2 | `node ../docs/generators-v2/perfection/P5-HM/compare.ts pre posle > …/compare-pre-posle.txt` | < 1 s |
| M3 | `node ../docs/generators-v2/perfection/P5-HM/tshare.ts pre posle` (`tshare.out.txt`) | < 1 s |
| M4 | `node ../docs/generators-v2/perfection/P5-HM/bigGrid.ts <pre/web>` (`bigGrid.out.txt`) | 2 min 55 s |
| M5 | `node ../docs/generators-v2/perfection/P5-HM/f2Grid.ts` (`f2Grid.out.txt`) | ≈ 1,5 min |
| M6 | `node ../docs/generators-v2/perfection/P5-HM/f4cost.ts <pre/web> <var-f13/v2>` (`f4cost.out.txt`) | 3 min 28 s |
| M7 | `node ../docs/generators-v2/perfection/P5-HM/changedP5.ts <pre/web> <scratch> > src/…/segmentP5.changed-8e87fd4.json` | ≈ 12 min |
| M8 | `node ../docs/generators-v2/perfection/P5-HM/profile.ts [pre/web]` → `profile-a-HM-{pre,posle}.txt` | 1 s |

Varijante za M6/M7: kopije v2 foldera sa pravilom isključenim u politici (`resultMinWeeks` 99, `capShare` T/I 0,6,
`stridesReps` → 0 — isto i za validator); `var-off` = sva tri isključena.

## Izmereno — mreža P0 (192 ulaza; M1, M2; medijana [min–max])

| metrika | R pre | R posle | F pre | F posle |
|---|---|---|---|---|
| odbijanja | 0 | 0 | 0 | 0 |
| testova po planu | 0 | 1 [0–1] | 1 | 1 |
| ned. od testa do trke | — | 7 [6–8] | 10 [7–13] | 10 [7–13] |
| T rad prvi [min] | 11,3 [6,9–23,2] | 13,7 [6,9–39,7] | 12,5 | 13,1 |
| I rad prvi [min] | 10,9 [6,3–20,9] | 15,7 [6,3–31,3] | 12,7 | 17,4 |
| udeo rada prvog T dana [%] (M3) | 24 [18–37] | 29 [18–50] | 26,5 | 31 |
| udeo rada prvog I dana [%] (M3) | 21 [14–29] | 25 [16–36] | 24 | 28,5 |
| T / I rad najveći [min] | 22 / 15,7 | 22,7 / 17,3 | 20,1 / 17,2 | 22,4 / 17,4 |
| laganih dana sa ubrzanjima | 0 | 14 [9–19] | 0 | 14 [9–19] |
| % brzih km bez ubrzanja: baza / razvoj | 9,5 / 9,8 | 11,1 / 11,3 | 10,4 / 8,5 | 11,7 / 10,2 |
| % brzih km bez ubrzanja: specifična / taper | 18,7 / 16,4 | 18,8 / 17,5 | 19,6 / 15,4 | 20,1 / 16,2 |
| vrh obima [km] / ukupno RP [km] | 59,5 / 45 | 59,5 / 45 | 55,5 / 45 | 55,5 / 45 |
| planova sa WEEK_FITTED | 26 | 24 | 11 | 10 |
| planova sa ned. 1 < trenutni obim | 12 | 6 | 6 | 6 |
| planova sa promenjenim vrhom | — | 3 | — | 0 |

- Nedelje izgradnje > 25 % brzih km (sve porodice; ubrzanja se ne broje — odluka organizatora): **81 → 81**. Za
  poređenje, sa km ubrzanja kao brzim: 115 (svih 34 dodatnih 25,1–26,2 %); > 30 % (sa ubrzanjima) 16 → 18.
- Početnik (n 16): bez testa, T prvi 8,7 min (isto), ubrzanja 13 [9–17] (od 3. nedelje).
- Test po pripremi (R): 10 ned bez testa; 15 ned ned 9, 6 ned do trke; 20 ned ned 12, 8 ned do trke; uvek razvoj.

## Izmereno — mreže 02, 03, pouka 28 (M4, 27 930 ulaza) i F4 × pouka 32/35 (M6, 25 122 plana)

- Odbijanja 508 → 508, novih 0, izgubljenih 0. WEEK_FITTED 5934 → 5887; nedelja 1 < trenutni obim 2561 → 2064.
  Planova sa testom 21 885; nedelja (osim trkačkih) sa laganim danom bez ubrzanja: 0.
- Pouka 35 (drugi dan lagan): pre 25 002, posle bez F4 25 494, **posle 22 641**. Doza spuštena po pouci 32: pre 255
  (prva doza zone 111); posle bez odluke 01:28 627 (477); **posle 267 (117)**; bez F4 255 (111).

## Izmereno — F2 tokovi adaptacije (M5; 192 plana × faza × scenario; zapisi 14 dana, potpuna pokrivenost)

| faza | RPE 9 ×2: primenjen / n | preskočena ×2: primenjen (uz manjak) | uz bol | uz umor | kontrola RPE 6 |
|---|---|---|---|---|---|
| baza | 180 / 184 | 128 (54 manjak) | 0 / 184 | 0 / 184 | 0 okidača |
| razvoj | 65 / 169 | 36 (68 manjak) | 0 / 169 | 0 / 169 | 0 |
| specifična | 84 / 192 | 10 (106 manjak) | 0 / 192 | 0 / 192 | 0 |

0 odbijanja u svim tokovima; 0 slučajeva da je doza nedelje n porasla; 0 ponovljenih koraka za iste zapise sutradan.
Neprimenjeno bez drugog uslova = nedelja n je rasterećenje/taper. Nedelja n promenjena u 114/180 (baza), 12/65 (razvoj),
74/84 (specifična) — u ostalim bi i bez F2 bio prelaz zone ili plafon. Napomena izostaje samo u nedelji bez dana
kvaliteta (test + drugi dan lagan): 40 slučajeva.

## Promenjeni planovi (M7; `segmentP5.changed-8e87fd4.json`, `grid.harness` `CHANGED_P5` u `mayChange`)

Mreže 02, 03, pouka 28 — 36 066 ulaza: promenjeno 34 479 — `tsd` 18 422, `sd` 11 324, `s` 3 093, `ts` 1 640, `x` 0 (t = F1, s = F3, d = F4). **Dokaz po klasi**: kopija sa F1, F3 i F4
isključenim je bajt-ista sa `8e87fd4` u **svih 36 066** ulaza (osim oznake verzije) — druge promene generatora nema;
F2 deluje samo u adaptaciji. Bajt-iste ostaju nedelje bez F1/F3/F4 uticaja (npr. trkačke nedelje: 211/2896 nedelja
mreže P0 bajt-iste). `recent.harness`: red izuzetka HM-02 se proverava samo za planove klase `s` (F3 ne menja obim,
dužine ni broj kvaliteta); za `t`/`d` se ne proverava — oslabljena provera, kao CHANGED_10.

## Profil (a) — `P5-HM/profile-a-HM-{pre,posle}.txt`

10 km 46:00, 40 km, uto/čet/sub/ned, 16 ned, cilj 1:40. Ned 1 T 2,0 → 3,0 km (rad 9,4 → 14,1 min, dan 44 → 49 min);
ned 2 T 4,0 km; razvoj I 3 × 800 → 3 × 1000 m, vrh I 4 × 1000 m; ned 9 (poslednja razvoja) kontrolni test 5 km umesto
I 4 × 1000 m, 7 ned do trke; ubrzanja jedna subota (baza 4 × 20 s, dalje 6 × 20 s), rasterećenja: utorak. RP i blok
nepromenjeni (RP 2 × 3000 → 2 × 5000, blok 4 i 6 km). T u razvoju/specifičnoj 4800 m (plafon 10 % od 56 km).

## Testovi i trajanja

| | komanda | trajanje | ishod |
|---|---|---|---|
| T1 | `npx vitest run --project node src/domain/generators/halfMarathon/v2` (brz, u toku rada, više puta) | 70–80 s | poslednji 358/358 |
| T2 | `npm run check` (posle rebase-a na `5d2f32c`) | 5 min 42 s | typecheck, lint, format OK; 3918/3918 |
| T3 | `npx vitest run --changed 8e87fd4` | 4 min 11 s | 249 fajlova, 2986/2986 |
| T4 | `TEST_FULL=1 npx vitest run --project node src/domain/generators/halfMarathon/v2 --logHeapUsage` | 9 min 54 s | 75 fajlova, 450/450; najveći heap 336 MB |
| T5 | `npx playwright test e2e/hm-v2.spec.ts e2e/handoff-v2.spec.ts --trace off` | 65 s | 8/8 |
| S | `node scripts/sabotage.mjs ../docs/generators-v2/perfection/P5-HM/sabotage-P5.json --quiet` | 26,6 s | 7/7 palo (`sabotage-P5.result.json`) |

Raniji pokušaji T4 (pre izmene harness-a): dva pada radnika na OOM (heap ≈ 2 GB, `earlyGrid` delovi); jednom pun nivo uz
`NODE_OPTIONS=--max-old-space-size=6144 --maxWorkers=2` prošao 450/450 za 14 min 55 s (heap do 3,3 GB) — uzrok pa
ispravka u harness-u, vidi „Pravila". Jedan pokušaj prekinut granicom alata (10 min), jedan restartom kontejnera.

Novi/izmenjeni testovi: nov `segmentP5.node.test.ts` (F1–F4, prikaz, bol, F2 prioritet, trčanje van plana; 11 testova),
`segmentP5.changed-8e87fd4.json`; usklađeni brojevi (bez slabljenja): `quality.node` (početni nivo 80 %),
`policy.node`, `beginner.node`, `week.node` (rasterećenje T 2400), `validate.node` (DOSE_JUMP/STALL na drugim nedeljama,
EASY_UNEQUAL na danima bez ubrzanja), `feel.node` (plan sa rezultatom 11 ned bez testa, 12 ned jedan), `adapt.node`
(prioritet: + TEST_MOVED, QUALITY_STRAIN false), `app.node`, `adaptFlow.node`, `handoffTarget.node` (verzije),
`earlyGrid`/`grid04` broj tokova (asOf nedelje testa: 27 062 → 27 300, 4919 → 5055), `gridInvariants` (nezavisno: test
F1, ubrzanja F3, trajanje laganog dana sa ubrzanjima po km), `recent.harness` (oslabljeno, vidi gore).

## Van foldera

`marathon/v2/app/byteSame.9443676.json` — snimak tokova svih generatora uključuje HM v2; ponovo snimljen
(`BYTE_SAME_RECORD=1`) na verziji posle rebase-a, promenjeno tačno 17 ključeva (prema verziji P5-MAR `e033718`) „HM v2 #…", 0 drugih.

## Otvoreno / mišljenje (odvojeno od merenja)

1. F4 × pouka 35 (deo odluke 01:28) nije ugrađen — na HM nije potreban (F4 smanjuje pouku 35); ako organizator želi
   ipak, to je novo mesto odluke.
2. F2 posle rasterećenja ne „čeka" sledeću nedelju izgradnje; ako treba, to je jedno polje koraka (`qualityHold` = prva
   ne-rasteretna nedelja izgradnje ≥ n).
3. F2 posle preciziranja 00:41: preskočeni dan sa trčanjem van plana tog datuma (uvoz) se ne broji — test u
   `segmentP5`; mreža M5 nije ponavljana (njeni scenariji nemaju takvo trčanje na dan kvaliteta).
4. T u specifičnoj fazi kod 4 dana često stoji na 4800 m (plafon 10 %) — nije tema P5.
