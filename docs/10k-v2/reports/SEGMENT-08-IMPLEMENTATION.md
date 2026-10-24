# 10K v2 — Segment 10K-08 (10k-v2.10.0): krug T — trenerska pravila

Polazni SHA `b9c4728`. Zaključan spisak: `docs/generators-v2/audit/fixes/00-common.md`, `fixes/03-coach-rules.md`,
`fixes/T-assign.md` — 10K: **T1, T3, T6 (C3, C4, C6, C11)**. Menjano `tenK/v2/**`, `docs/10k-v2/**`; izuzeci (kao
10K-07): oznaka verzije u `e2e/tenk-v2.spec.ts` i `features/onboarding/tenKV2Flow.test.tsx`. Verzija politike
10k-v2.9.0 → **10k-v2.10.0** (DECISIONS A24; `app/plan.ts` KNOWN_VERSIONS ∪ 10k-v2.9.0).

## Stavke

| stavka | ispravka (jedan vlasnik) | test (pada na b9c4728 / prolazi) | merenje pre → posle |
| --- | --- | --- | --- |
| T1 lagan prema dugom | `lengths.buildEasyBounds10` (najkraći max(3 km, 20 min E), najduži 0,8 × dugi) — konstruktor `buildLengths` i validator `EASY_VS_LONG`; ostatak premali → manje laganih dana (odmor: prvo dan pre dugog, `keptEasyDates`), ni jedan ne staje → svi lagani odmor, planirano < cilj (`easyRestShort`, upozorenje EASY_REST_BELOW_TARGET + preporuka manje dana); lagan > 0,8 × dugi uz dugi na plafonu → cilj neizvodljiv, ista pretraga D6 → niži cilj (WEEK_FITTED, CAPACITY_LIMITED „lagan ≤ 80 % dugog" + preporuka više dana); cilj se zbog T1 ne podiže iznad pravila; validator ROLES za lagan dan-odmor zove istu `buildLengths` | `segment08.node.test.ts` T1 (d4-14w-50km-v45, d4-10w-25km-v70, validator) | `coach-5k-10k/measure.ts 10K 3 400`: M1 lagan ≥ 0,95 × dugi **2 912 → 0** planova, M5 dan pre dugog **974 → 0**, M6 lagan < 20 min **1 116 → 0**; `segment-08/t1-capacity.ts 3` (10 374): lagan > 0,8 × dugi **50 790 → 0** dana, < 20 min **8 772 → 0**; odbijanja 0 → 0 |
| T1 cena (obim) | — | — | planova sa spuštenom nedeljom izgradnje (CAPACITY_LIMITED) **2 864 → 4 390** od 10 374; spuštenih nedelja 18 898 → 28 068; zbir km ispod nominalnog 42 160 → 67 954; lagani dani-odmor 0 → 4 694; planova sa planirano < cilj (EASY_REST_BELOW_TARGET) **0 → 426** (1 092 nedelje) |
| T3 posle novog starta | taper: `steps.restartKeepsTaperQuality` (posle povratka bar 1 nedelja izgradnje sa kvalitetom) → `quality.pickTaper(keepOne)`: jedan kvalitet ≈ 60 % poslednje doze, najmanje najniži nivo, i iznad plafona D11 (validator ZONE_CAP/TAPER_QUALITY isti predikat); trkačka: `week.sharpenerReps(keepShort)` kratko oštrenje 2 × 1000 m RP posle novog starta, van perioda bola | `segment08` T3 (d3-8w-40km-v30-B-sat, pauza 35 kraj ned 3) | `segment-08/t3.ts 97` (2 916 tokova pauze 35): taper bez kvaliteta uz kvalitet posle povratka **628 / 2 260 → 283 / 2 154**, trkačka bez oštrenja **709 → 9**; preostalih 283: taper ne nosi ni RP 2 × 1000 m + WU/CD (konstrukcija neizvodljiva, pravilo ne zaobilazi dužine) |
| C3 | test se u mešovitoj nedelji ne odbacuje radi ostatka (kao HM/MAR): `week.mixedRemainder` / `mixedFloorKm` / `recordedExcessKeepsQuality` | `segment08` C3 | `segment-08/c3.ts 7` (10 671 tokova, po osećaju, dan pre testa over120/done100/locked): test izgubljen **178 → 0** |
| C4 | `written.protectedKm`: zaštićen dan POSLE asOf (urađen unapred, zaključan) = planirani km (MASTER pouka 37) | `segment08` C4 (d4-14w-40km, dugi urađen u utorak sa +5 km) | primer: b9c4728 keptKm 29,08, planirano 39,86 < cilj 44,9 → posle: nedelja na cilju |
| C6 | `steps.restartWeeks`: i nedelja r + 1 posle sidra bola (kao HM) — konstruktor i validator | `segment08` C6 (14 ned, 40 km, bol 5 ned 6) | ned 9 T **3 × 1200 → 2 × 1000** (HM: 2 × 1200 m) |
| C11 | pouka 35 u svim nedeljama osim trkačke: taper sa dva dana kvaliteta u kome bi neki trajao duže od dugog → samo RP (napomena, TAPER_RP_ONLY), validator QUALITY_OVER_LONG i u taperu | `segment08` C11 (10w-25km-v70-A-sat ned 9) | tapera sa pravilom pouke 35 (mreže 01 + 02): **0 → 816** |

Tumačenja (zapisana u A24, mišljenje — organizator može da preinači):
1. T1 „dugi se ne produžava": dugi je dužina D13 za STVARAN broj laganih dana (≤ plafon udela/105 min). Bez toga bi dugi
   ostao skraćen za lagane dane kojih nema (npr. 4 d / 25 km / VDOT 70: dugi 5,6 km uz dva dana kvaliteta po 8 km).
2. T1 kad nijedan cilj nije izvodljiv (mali obim adaptacije, dugi < 20 min / 0,8): ista pretraga cilja bez T1, napomena
   T1_OFF, upozorenje EASY_VS_LONG_SMALL; redovno rasterećenje koje po D5 ne staje (duži dugi izgradnje) → pravilo A9
   (napomena T1_DELOAD, ADAPT_DELOAD_LONG). Bez toga: odbijanje WEEK_INFEASIBLE (bilo je 0 pre 10K-08).
3. T3 „najmanje najniži nivo": važi i iznad plafona zone (inače pravilo ne deluje — RP 2 × 1000 m je iznad 10 % malog
   tapera posle povratka).
4. Pouka 25 / invarijanta: nedelja sa danima bola sme planirano ispod minimuma (kao validator WEEK_MIN_REST) — uz T1 se
   to javlja i bez dana odmora.

Usput ispravljeno (posledice T1 nađene mrežama): (a) dan ≤ asOf koga prethodni plan nema (odmor po T1) se ne dopisuje u
prošlost (`written.writtenDays`, `generate.mixed37`); (b) cilj se zbog T1 ne podiže iznad pravila (umor pre starta: ned 2
bez rasta); (c) kad je prva pretraga cilja ('rule') spuštena, a druga ('relax', D11 ispred D12) daje bliži izvodljiv cilj
nedelje izgradnje, važi druga (two-step: ned 10 31,5 → 14,9 bez kvaliteta → 29,3); (d) nedelja u kojoj su svi dani odmor
(bol + T1) je WEEK_ALL_REST, ne EMPTY_WEEK (start-day: 4 odbijanja → 0).

## Zamrznuti otisci (promena = objašnjena ispravka)

Fixture `segment08.changed-b9c4728.json` (kao 06f/06i/10K-07): planovi generatora i tokovi trajnih mreža adaptacije
koje 10k-v2.10.0 menja prema b9c4728 → stanje b9c4728 + uzrok. Napravljen iz dump-ova oba stabla (b9c4728 u
worktree-u; privremena kuka `testInputs.dump08`, uklonjena) — `artifacts/segment-08/gen-dump.ts`, `mkfx08.py`.
Starije regresije porede stanje b9c4728 (`level.harness.atB9c` na dnu lanca at7ba → at46e → atC13; generator:
`planGrid.runPlanGrid` zamenjuje heš, uzrok 07 i red bazne linije); oznake toka (A17, N2, pouka 35/37) se za promenjene
tokove ne sude po današnjem rezultatu; `p08Errors` proverava da je svaki tok iz fixture-a stvarno promenjen.

| mreža | promenjeno / ukupno | uzrok (pravilo koje stari rezultat krši) |
| --- | --- | --- |
| generator 01 + 02 (R, F, B) | 18 612 / 34 146 | T1 15 486, T1+C11 972, mreža 01 bez oznake 2 154 |
| grid04 | 559 / 2 040 | T1 260, T1+C11 33, T1+T3 30, T3 38, C11 18, kaskada 180 |
| E (rana) | 70 154 / 102 707 | T1 56 227, T1+C11 3 484, C11 342, kaskada 10 077, ranije odbijen međuverzijom 24 |
| R (rasterećenje) | 16 164 / 18 193 | T1 12 686, T1+C11 1 437, C11 223, kaskada 1 818 |
| start + 0 | 7 864 / 12 336 | T1 6 493, T1+C11 339, C11 30, kaskada 998, ranije odbijen 4 |
| P (bol) | 294 / 336 | T1 40, kaskada 254 |

„Kaskada" = promenjen bazni plan (T1) ili C3/C4/C6 bez kršenja novog pravila u starom rezultatu. Bez uzroka: 0.
Tabele brojki testova (CAPACITY_LIMITED, ponavljanja, vrh/start, D25, DOSE_DROPPED, D27, D31, pouka 35 414 nedelja
umesto 1 854, painGrid I3, primeri reliefGrid/painGrid/earlyGrid/adaptFlow) ažurirane sa komentarom „10K-08 (T1)".

## Testovi

- Pun nivo `TEST_FULL=1 npx vitest run --project node src/domain/generators/tenK`: **98 / 98 fajlova, 752 / 752**.
- `npm run check` (posle `git pull`; uz NODE_OPTIONS=--max-old-space-size=8192 — eslint bez toga OOM): **339 / 339
  fajlova, 3 797 / 3 797**. `marathon/v2/app/byteSame.9443676.json`: novi heševi SAMO 16 redova „10K v2" (odobrenje
  organizatora; diff bez drugih redova); `features/onboarding/tenKV2Flow`: oznaka verzije.
- E2E `npx playwright test e2e/tenk-v2`: **3 / 3**.
- Sabotaže `artifacts/segment-08/sabotage-08.json` (`web/scripts/sabotage.mjs`, `--bail=1`): **8 / 8 palo**
  (T1 gornja granica, T1 20 min, T1 validator, T3, C3, C4, C6, C11), stanje `src` isto.

## run-all i lanci

- `run-all.sh … '.*-10K'` (14 poslova, pre ispravki (b)–(d) i t1Short): 0 odbijanja osim start-day 4 (EMPTY_WEEK — ispravljeno
  (d)); nečisto 7 — invarijanta „planirano ≠ cilj" (nedelje bez laganih dana po T1; `gridInvariants.t1Short` sada po tempu
  nedelje — ispravljeno) i two-step „taper > poslednja izgradnja" 4 (ispravljeno (c)). Ponovljeni run-all: poruka organizatoru.
- `chains.ts 10K 20261023 0 2000` (b9c4728 → posle): odbijenih lanaca 0 → 0; buduća nedelja < 40 % cilja 30 → 30;
  IDEMP:WEEKS 3 → 3; trkačka > taper 3 → 5 (oba proverena primera sa zaključanim danom, klasa C7; ostali nepotvrđeni).
  `idemp.ts`: same 3 → 3, next 2 → 1 (sve pauza).

## Primećeno, nije rađeno

- Oštrenje ≥ 1,5 × najduži lagan trkačke: 2 420 → 2 364 (nije na spisku 10K).
- Taper posle novog starta bez kvaliteta kad ni RP 2 × 1000 m sa WU/CD ne staje u dužine tapera (283 toka).
