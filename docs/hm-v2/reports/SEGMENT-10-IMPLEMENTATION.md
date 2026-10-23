# HM v2 — Segment HM-10 (krug T, hm-v2.8.0): trenerska pravila T1, T3, C4, C12, T7

Zadatak: `docs/generators-v2/audit/fixes/03-coach-rules.md` + `T-assign.md` (HM: T1, T3, T6 C4/C12, T7), uz
`00-common.md` i AGENTS.md uslove 1–8. Polazni kod `b9c4728`. Menjan samo `web/src/domain/generators/halfMarathon/v2/**`
i dokumentacija HM; DECISIONS `HM-10` u `policy.ts`. Merne skripte i artefakti: `docs/hm-v2/artifacts/segment-10/`,
`docs/generators-v2/audit/coach-hm-mar/t1-hm.ts`.

## Stavke

| stavka | ispravka (jedna funkcija za konstruktor i validator) | pre → posle |
| --- | --- | --- |
| T1 lagan ≤ 0,8 × dugi, ≥ max(4 km, 20 min) | `lengths.buildLengthsT1` / `buildLengths` (jedino mesto dužina izgradnje), `buildEasyCap10`, `buildEasyMin10`; validator `EASY_BUILD`; dugi kao i do sada (najduži dozvoljen) — ostatak koji ne staje → nedelja neizvodljiva sa tim ciljem → pretraga cilja je spušta (planirano < cilj po pravilu, `CAPACITY_LIMITED` „i lagane ≤ 0,8 × dugi" + preporuka više dana); najkraći lagan ne staje ispod 0,8 × dugi → manje laganih dana (najkasniji lagani su odmor, napomena „Manje laganih dana", validator `ROLES`); pouka 35 (`secondQualityEasy`, `buildDayLimit`): dva dana kvaliteta koja staju samo uz dan odmora → drugi dan lagan | `measure.ts HM 400 200 100` (1b #4): lagan ≥ 0,9 × dugi **3 906 → 0** / 24 852 (susedan dugom 909 → 0); `t1-hm.ts` (25 122 plana mreža): lagan > 0,8 × dugi **6 426 → 0**, lagan < 20 min **1 188 → 0**, odbijeni 0 → 0 |
| T1 pad obima | — | planovi sa nedeljom izgradnje spuštenom ispod cilja po pravilu (planirano < cilj) **3 009 → 5 031** (nedelja 19 932 → 30 690); zbir planiranog obima 21 283 447 → 21 119 290 km (−0,77 %) |
| T3 posle novog starta | `quality.restartTaperT` (taper: RP ne staje u plafon → T ≈ 60 % poslednje T doze posle povratka, min 2,0 km, kad je stanje doze posle povratka neprazno), `steps.newStartAt`, `week.sharpenerAllowed(taperRpM, newStart, pain)`; validator TAPER_QUALITY, PHASE_QUALITY, RACE_SHARPENER | `artifacts/segment-10/t3.ts` (pauza 35 na kraju svake nedelje, uzorak R400/F200/B100, 520 tokova sa novim startom i ≥ 1 nedeljom kvaliteta posle povratka): taper bez kvaliteta **227 → 143**, trkačka bez oštrenja (bez bola) **227 → 36** |
| C4 | `adapt.factKmOf`: zapis sa `dayId` dana posle asOf ne ulazi u zbir zaštićenih (planirani km, MASTER pouka 37) | test (consistency: samo čitanje, broj nije meren) |
| C12 | `week.freeKind`: RP ≤ 2 × 2000 m je nepromenljiv dan mešovite nedelje (kao MAR MP); `remainderWeek` odbacuje samo `quality` | test `d3-10w-25km-v55-B-sun` ned 6 (bilo: RP lagan) |
| T7 | `input.ts`: `recentLongRunKm > currentWeeklyKm` → `RECENT_LONG_OVER_WEEKLY` „… duže od trenutnog nedeljnog obima … — proveri unos." | mreže lib (25 122): 0 takvih ulaza; mreža pouke 28 (`r-`): 630 ulaza (r > obim) sada odbijeno |

Ostatak T3 (143 tapera bez kvaliteta): 70 — ni RP ni T 2,0 km ne staju u plafon (44 sa ciljem tapera < 20 km:
T 2,0 km > 10 %); 66 — pretraga taper nedelje stiže do prolaza „bez kvaliteta" (nijedan prolaz sa kvalitetom nije
izvodljiv); 7 drugo. Trkačka bez oštrenja 36: A9 (sa oštrenjem trkačka > taper) ili nema dana ≥ 3 dana pre trke.
Nije dalje razlagano.

## Promena otisaka (konvencija foldera: spisak promena, bazne linije se ne prepisuju)

`segment10.changed-b9c4728.json` (`artifacts/segment-10/changed10.ts`, mreže 02, 03, pouke 28): **l 12 648** (T1 — stari
plan krši T1 u nedelji izgradnje), **m 1** (T1 — lagan na granici 20 min, dugi −0,1 km), **r 150** (T1 → odbijanje
RECENT_LONG_TOO_SHORT sa pragom, r 5–7 km), **p 630** (T7), **d 40** (samo tekst), **x 3** (`r-d6-{10,14,20}w-65km-v70-r11`:
ned 1 cilj 65,0 → 64,9 km, ostale nedelje −0,1 km; stari plan ne krši T1; uzrok nije utvrđen — pretraga cilja uz
novi predikat pouke 32). `mayChange` čita spisak; vrh sme da padne samo za l/m/x (`mayLower`).
Testovi K2/DAYS_COUNT nezavisnih invarijanti: nedelja 1 ispod obima i uz lagan na 0,8 × dugi; manje dana uz napomenu.
`adaptInvariants`: minimum nedelje u koraku 0,1 km (kao validator) i nedelja bola ispod minimuma dozvoljena (pouka 25,
validator WEEK_MIN_LIMITS) — T1 čini lagane u nedelji bola većim, × 0,7 ih skraćuje.

## Testovi

- `segment10.node.test.ts` (6) + `input.node.test.ts` T7: padaju na `b9c4728` (ponašanje: T1 1b #4 lagan 23,5/24;
  T3 taper bez kvaliteta; C4 factKm sa upisanim km; C12 RP lagan; T7 bez odbijanja).
- Sabotaže `artifacts/segment-10/sabotage-10.json`: **9/9 palo** (`sabotage-10.result.json`), stanje src isto.
- Brz HM: 41 fajl / 352 testa, 0 palih. Pun HM (`TEST_FULL=1`): vidi dole. `npm run check`: typecheck, lint, format OK;
  test:fast 3 757 / 3 759 — pala 2 testa `marathon/v2/app/byteSame.node.test.ts` (redovi „HM v2" fixture-a
  `byteSame.9443676.json` u folderu maratona; HM-10 namerno menja HM v2 plan i verziju). Folder nije moj — nove
  vrednosti 15 redova su u `artifacts/segment-10/byteSame-mar-HMv2-rows.json` (javljeno organizatoru).
- E2E `e2e/hm-v2*`: 3/3.

## Otvoreno (pitanja organizatoru)

1. T1 izuzetak: nedelja NA minimumu obima u kojoj granice T1 nisu izvodljive ni sa manje laganih dana (npr. 3 dana,
   12 km: dugi ≤ 45 % = 5,4 km, lagan ≥ 4 km i ≤ 0,8 × dugi) — sada dužine kao pre T1 (lagan ≤ dugi) uz upozorenje
   EASY_BUILD_MIN_WEEK. Alternativa: planirano < minimum (degenerisana nedelja) ili odbijanje.
2. T3 „najmanje najniži nivo": kad ni T 2,0 km ne staje u plafon T 10 % (taper < 20 km) — sada bez kvaliteta (jedan
   plafon po zoni, uslov 2). Da li T3 ide iznad plafona?
3. `marathon/v2/app/byteSame.9443676.json`: redovi „HM v2" (15) — primeniti iz artefakta.
4. Taper (nije T stavka za HM): dan kvaliteta duži od dugog tapera (measure.ts T1) generator 744 → 786, adaptacija
   682 → 777 — posledica dužih/kraćih dugih posle T1.

## Primećeno, nije rađeno

- Ostatak T3 (143/36 gore) bez daljeg razlaganja.
