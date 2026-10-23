# 10K v2 — Segment 06c (10k-v2.5.0): rasterećenje odmah posle smanjenja otpada (A17); tačna poruka bola

Polazni SHA `f2b0194` (888bf45 = zaustavljanje sa sudarima + ispravka broja u FINAL-CHECK; kod generatora isti kao
`4917959`, heševi 4917959 važe). Grana `claude/generator-isolation-5k-10k-hm-marathon`. Menjano samo
`web/src/domain/generators/tenK/v2/` i `docs/10k-v2/`; izuzeci (samo oznaka verzije): `web/e2e/tenk-v2.spec.ts`,
`web/src/features/onboarding/tenKV2Flow.test.tsx`. `features/plan/tenKV2Adapt.test.tsx` ne proverava ni oznaku ni tekst
poruka — nije menjan. Ništa u `fiveK/`, 10K v1, HM, maratonu ni zajedničkom kodu. Bez PR-a, mergea i deploya.

## 1. Odluka (doslovno)

Prvobitni nalog (A17, 10k-v2.5.0; heuristika), tačke 1–6:

> 1. Nedelja smanjenja koraka adaptacije: (a) korak sa ciljem koraka i nivoom pre smanjenja (startKm ≠ null I levelKm ≠
>    null; to su pauza A3 i manjak A2, a višak A6 nije) → nedelja fromWeek; (b) korak bola sa povratkom (returnFrom ≠
>    null) → nedelja sidra r (returnFrom.week); (c) korak sa novim startom (restart, pauza ≥ 28 dana) se NE računa:
>    rePeriodize već gradi raspored od novog starta.
> 2. Ako je nedelja ODMAH posle nedelje smanjenja redovno rasterećenje (deload iz osnovnog rasporeda, faza izgradnje,
>    nije prinudno rasterećenje A5, nije taper ni trkačka nedelja), to rasterećenje se ukida. Ta nedelja postaje nedelja
>    izgradnje: cilj po A8 (povratni rast od osnove; kod bola od osnove returnBase10), kvalitet po fazi uz postojeća
>    ograničenja po datumima (A3/A4). Prinudno rasterećenje (A5) se nikad ne ukida.
> 3. Raspored rasterećenja posle toga se ne pomera: sledeće redovno rasterećenje ostaje gde je u osnovnom rasporedu. […]
> 4. Jedno mesto odluke: steps.ts framesFor (isto mesto kao A5). Validator D5 dobija izuzetak A17 iz iste funkcije ili
>    iz istog podatka (ne sme sam da ponavlja pravilo drugačije). assess.ts se ne menja, osim ako je potreban podatak
>    (npr. oznaka koraka); tada ga objasni.
> 5. Poruka (N2): kad deluje min sa ciljem nedelje sidra (osnova = cilj nedelje r < 0,7 × nivo), poruka PAIN glasi:
>    „Posle nedelje {r} rast kreće od {osnova} km (cilj nedelje {r}; 70 % nivoa pre bola bilo bi {x} km)." Inače ostaje
>    sadašnja. Brojevi u 10K formatu (zarez). Kad A17 ukine rasterećenje, poruka koraka dobija rečenicu: „Redovno
>    rasterećenje u nedelji {n+1} otpada: nedelja {n} je smanjena (A17)."
> 6. Verzija i aplikacija: policy.ts version = '10k-v2.5.0', DECISIONS A17 sa obrazloženjem i primerima; tekst A5/D5
>    dopunjen jednom rečenicom (izuzetak); app/plan.ts KNOWN_VERSIONS = ['10k-v2.4.0', '10k-v2.4.1', '10k-v2.5.0'];
>    sačuvan plan starije verzije ostaje plan 10K v2 i prilagođava se po 2.5.0 (A15). Test.

Odluka posle sudara (888bf45):

> SUDAR 1 → pravac (A): D5 izuzetak A17 — posle ukinutog rasterećenja najviše 5 uzastopnih nedelja izgradnje,
> RAČUNAJUĆI ukinutu nedelju (najviše 4 posle nje), samo do sledećeg redovnog rasterećenja iz osnovnog rasporeda.
> Rasporedi se ne pomeraju, nijedno rasterećenje se ne ubacuje. Ako bi niz bio > 5: ne ukidaj rasterećenje (ostaje kao
> na 4917959); upiši broj takvih tokova (očekivano 0). Validator broji isti podatak (dropped) sa granicom exceptionRun +
> 1 samo za niz koji počinje ukinutom nedeljom; nijedan drugi D5 niz ne dobija izuzetak.
> SUDAR 2 → J2: cilj nedelje posle smanjenja ≤ max(min(osnova + max(10 %, 1,0 km), nivo), osnova + korak D6), i nikad
> veći od osnova + max(10 %, 1,0 km, korak D6). A8 se ne menja.
> TAČKA 3 → TenKV2AdaptStep dobija polje reduced (dopuna: `reduced?: boolean`, izričito u svakom NOVOM koraku koji
> postavlja startKm — true: A2 ili A3 (i sa novim startom; nov start A17 i dalje isključuje 1c); false: A6; korak bez
> startKm: polja nema). framesFor (a) = !restart I (reduced === true ILI (reduced === undefined I startKm ≠ null I
> levelKm ≠ null)); rezervni put samo za stare sačuvane korake (A14). Višak + bol: A17 samo preko (b); sabotaža (e)
> (reduced se ne čita) obara test.
> J5 → heš bez oznake verzije i bez polja reduced (normalizacija kao normalize21), uz poseban broj tokova koji se od
> 4917959 razlikuju SAMO po polju reduced i proveru vrednosti polja (test).

## 2. Fajl → izmena

| fajl | izmena |
|---|---|
| `tenK/v2/types.ts` | `TenKV2AdaptStep.reduced?: boolean` (A17: true A2/A3, false A6, odsutno bez startKm i u koracima pre 2.5.0). |
| `tenK/v2/assess.ts` | **potreban podatak (tačka 4):** `step.reduced = true` uz cilj pauze (A3, i nov start) i manjka (A2), `false` uz višak (A6); nijedna druga odluka nije menjana. `painReturnNote`: poruka N2 kad je `returnBase10 < round(0,7 × nivo)`. |
| `tenK/v2/steps.ts` | `A17_MAX_RUN = exceptionRun + 1`; `targetReducedWeek` (a) i `reducedWeeks` (a)+(b), nov start ne ulazi; `framesFor(…, dropped?)`: posle A5 u istoj petlji ukida redovno rasterećenje nedelje w + 1 (izgradnja, deload, nije prinudno iz dosadašnjih koraka, niz od nje ≤ A17_MAX_RUN do sledećeg rasterećenja/kraja izgradnje); `dropped` = nedelja → indeks koraka; nov start sa primenjenim rasporedom (`rePeriodize` ≠ null) briše prinudne i ukinute od svog fromWeek (bez rasporeda — faze ostaju, A3 — ostaju i one; v. § 9.4). **Jedino mesto odluke.** |
| `tenK/v2/validate.ts` | `framesFor(…, dropped)` (isti poziv kao FRAMES); D5: na nedelji iz `dropped` niz od 1, granica `A17_MAX_RUN` do sledećeg rasterećenja; ostali nizovi `buildAllowed` kao do sada. |
| `tenK/v2/adapt.ts` | rečenica A17 za nedelje ukinute poslednjim korakom (`framesFor(baseFrames(…), …, dropped)`): (a) → poruka PAUSE/UNDER_EXECUTION, (b) → PAIN; pauza + bol na kraju nedelje (r = n): jedna rečenica, u PAUSE. |
| `tenK/v2/volume.ts` | **bez izmene** — ukinuta nedelja dobija cilj iz `adaptNominal10` (nextBuild10 od osnove; bol: `returnBase10`). |
| `tenK/v2/policy.ts` | `version: '10k-v2.5.0'`; D5 i A5 po jedna rečenica (izuzetak A17); DECISIONS **A17** (pravilo, mesto, obrazloženje sa primerima 10w/17w/E, polje reduced). |
| `tenK/v2/app/plan.ts` | `KNOWN_VERSIONS = ['10k-v2.4.0', '10k-v2.4.1', P.version]`. |
| `tenK/v2/testInputs.ts` | `stripReduced`, `planHash06c` (heš 06c; mreža R je iz 888bf45). |
| `tenK/v2/reliefGrid.node.test.ts` (nov, 17 testova) | mreža R (18 193): regresija/J5, J1–J4, reduced, determinizam; primeri N1, 12/17 ned; višak + bol, umor + bol, nov start, stari korak, nov start bez rasporeda D5 posle umora (framesFor), N2. |
| `tenK/v2/adapt.node.test.ts` | 06c regresija mreže 04 prema 4917959, provera polja reduced (2160 koraka), izmene očekivanja (§ 4.1). |
| `tenK/v2/painGrid.node.test.ts` | 06c regresija P prema 4917959; izmene I3 i E (§ 4.1); oznaka. |
| `tenK/v2/policy.node.test.ts`, `periodize.node.test.ts`, `app/app.node.test.ts`, `app/adaptFlow.node.test.ts` | oznaka, DECISIONS A1–A17 + tekst A17/A5/D5, KNOWN_VERSIONS (§ 4.1). |
| `web/e2e/tenk-v2.spec.ts`, `web/src/features/onboarding/tenKV2Flow.test.tsx` | samo oznaka `10k-v2.5.0`. |
| `docs/10k-v2/artifacts/segment-06c/` | `measure-a17.ts` + `measure-a17.json` (konačno merenje tok po tok prema kodu 4917959, zamenjuje merenje prototipa); `regression-4917959.ts`, heševi i `a17-prototype.diff` iz 888bf45 ostaju (istorija). |

## 3. Primeri iz PROBLEMA (10w-25km-v30-A-sat, asOf kraj ned 3; cilj ned 4–7, 4917959 → 10k-v2.5.0)

| scenario | 4917959 | 10k-v2.5.0 |
|---|---|---|
| pauza 10 d (breaks) | 21,2 · **rast. 17,0** · 23,3 · 25,0 | 21,2 · **23,3** · 25,0 · 26,5 |
| bol 5 (dan asOf) | 29,8 (plan. 20,9) · **rast. 14,9** · 20,5 · 22,6 | 29,8 (plan. 20,9) · **20,5** · 22,6 · 24,9 |
| manjak (1 od 4 odrađen) | 23,8 · **rast. 19,0** · 26,2 · 27,8 | 23,8 · **26,2** · 27,8 · 29,5 |
| umor | rast. 22,5 (A5) · 29,8 · 31,6 · 33,5 | isto (A5; A17 bez dejstva) |

Ned 5 po J2: pauza 21,2 + 2,1; bol 18,6 + 1,9; manjak 23,8 + 2,4 — svi ≤ nivo. Poruka (manjak): „… cilj 23,8 km (A2).
Povratak do 26,5 km … (A8). Redovno rasterećenje u nedelji 5 otpada: nedelja 4 je smanjena (A17)."

Nekadašnji sudar (sada izuzetak A17): `12w-25km-v30-A-sat` pauza 10, kraj ned 2 → rasterećenje samo ned 9, izgradnja
4–8 = 5; `17w-25km-v30-A-sat` bol 5, kraj ned 6 → ned 8–12: 23,0 → 25,3 → 27,8 → 29,8 → 31,6, rasterećenja 4 i 13.

N2 (`d4-r-14w`, pauza + bol, sreda ned 6): „Posle nedelje 6 rast kreće od 26,5 km (cilj nedelje 6; 70 % nivoa pre bola
bilo bi 29,2 km)." (4917959: „… od 70 % nivoa pre bola (26,5 km).")

## 4. Regresija

- **Generator bez činjenica** bajt-isti (jedino oznaka): `grid`, `feelGrid`, `beginnerGrid` (R 15 840, F 11 880,
  B 3402) i heš testovi prolaze bez izmene; put bez koraka (`steps.length === 0`) nije diran.
- **Prema 4917959** (`measure-a17.json`, testovi `adapt.node`, `painGrid`, `reliefGrid`; heš bez oznake i polja
  reduced). Svaki promenjen tok ima A17 ili N2 i svaki tok sa A17/N2 je promenjen (0 izuzetaka); 0 odbijanja.

| mreža / scenario | tokova | promenjeno | A17 | N2 | samo polje reduced |
|---|---|---|---|---|---|
| 04 under50 | 120 | 40 | 40 | — | 40 |
| 04 over120 | 120 | 0 | — | — | 80 (reduced false) |
| 04 pause10 / pause20 | 120 / 120 | 40 / 40 | 40 / 40 | — | 80 / 80 |
| 04 pause35 (nov start) | 120 | 0 | — | — | 120 |
| 04 pain5 / pain8 | 120 / 120 | 20 / 20 | 20 / 20 | — | — |
| 04 chain | 120 | 60 | 60 (prvi korak) | — | 60 |
| 04 painPause | 120 | 72 | 40 | 56 | 48 |
| 04 ostalih 8 (none, done100, fatigue, faster, slower, test5k, incomplete, locked) | 960 | 0 | — | — | — |
| **04 ukupno** | **2040** | **292** | 260 | 56 | 508 |
| P bol 4 / 5 / 7 / 8 | 84 × 4 | 22 × 4 = **88** | 88 | 0 | 0 |
| R pauza 10 / pauza 20 / manjak | 2599 × 3 | 739 × 3 | 739 × 3 | — | 1860 × 3 |
| R bol 5 / bol 8 | 2599 × 2 | 739 × 2 | 739 × 2 | — | — |
| R pauza 10 + bol 5 | 2599 | 1160 | 739 | 540 | 1439 |
| R umor | 2599 | 0 | — | — | — |
| **R ukupno** | **18 193** | **4855** | 4434 | 540 | 7019 |

R4 podskup (252 plana, 2268 tokova po scenariju): 644/2268 na 4917959 → 0 posle A17 (nijedan nije zadržan zbog > 5).

**Odbijanja na 4917959 koja A17 uklanja** (nađeno sabotažom (a)): 4 toka mreže R su na 4917959 odbijena —
`f-d5-12w-35km-e270-A-sat` i `f-d6-14w-35km-e405-A-sat`, bol 5 i pauza 10 + bol 5, kraj ned 2: `VOLUME_RULE: Cilj 21,8
(22,2) km ≠ 19,6 km po pravilu, bez oznake (D6)` — rasterećenje ned 4 sa testom D27 posle sidra bola. U 10k-v2.5.0 to
rasterećenje je ukinuto (A17), pa tokovi prolaze (u tabeli su među promenjenim sa A17). Uzrok nije menjan (§ 9.5).

**Nedelja testa 5 km u tokovima sa A17** (planovi po osećaju; ukinuto rasterećenje je nosilo test D27) — 19 tokova:
test otpada u 8 (u nedelji izgradnje test i drugi kvalitet ne staju → jedan kvalitet doze rasterećenja, test otpada,
A9/A13; npr. `d4-f-14w` bol 5 kraj ned 2: ned 4 = 27,0 km), test ostaje/vraća se u 10 (na 4917959 otpadao; npr. lanac
pauza → manjak), pomeren ranije u 1 (`d3-f-18w` sreda ned 6, pauza 10: ned 9 → 8). Spisak: `measure-a17.json`
(`testChanges`). Pravila A9/A13 nisu menjana.

### 4.1 Postojeća očekivanja: staro → novo (zašto)

1. `adapt.node` rezultati po scenariju: `pain5.TEST_MOVED` 5 → 6 (d4-f-14w w2end: test otpada, gore);
   `chain.TEST_MOVED` 13 → 8 (d6-f-14w, d3/d4/d5/d6-f-18w w2end: prvi korak ukida rasterećenje sa testom, drugi
   korak više ne uklanja test).
2. `adapt.node` „06b: regresija prema e6540a5": heš `planHash81` → `planHash06c` (polje reduced); „menjaju se samo tokovi
   sa PAIN" → „… sa PAIN ili A17" (A17 bez PAIN: chain 60, pause10 40, pause20 40, under50 40); `CHANGED_06B` isti.
3. `painGrid` I3: trkačke nedelje [d5-f-18w 02-05, 02-06, 02-07] → [d4-r-14w 2027-01-09 p8 ned 14: 16,0 → 16,4;
   d5-f-18w 02-07] (02-05/06: r = 14, ukinuto ned 15; d4-r-14w: r = 10, ukinuto ned 11, uz bol 8 ned 12 ima dan bola →
   RP tapera 2000 m umesto 2400 m, lagan tapera 4,2 umesto 3,8 km → trkačka veća, isti uzrok D8/D23 kao 06b);
   zaokruženje D19 16 → 14 (d5-f-18w ned 17 otpada dvaput; d4-r-14w 2026-11-21 ned 7 ostaje sa ciljem 37,1 umesto 34,7).
4. `painGrid` primer E (asOf 2026-11-13, bol 7, r = 3): ned 4 [23,8, 18,9, 0 kv] → [32,7, 25,1, 0] (rasterećenje
   ukinuto; 29,7 + 3,0), ned 5 [32,7, 32,67, 2] → [36,0, 35,97, 2], ned 6 [36,0, 36,0, 2] → [39,6, 39,6, 2]; nova
   provera `deload === false`.
5. Oznaka verzije `10k-v2.4.1` → `10k-v2.5.0`: `policy.node` (+ DECISIONS A1–A16 → A1–A17, tekst A17/A5/D5),
   `periodize.node`, `app.node` (meta), `painGrid` („plan nosi"), `tenKV2Flow.test.tsx`, E2E.
6. `app.node`: primer nepoznate verzije `10k-v2.5.0` → `10k-v2.5.1` (2.5.0 je sada tekuća).
7. `adaptFlow.node`: test 06b (KNOWN 4.0 + 4.1, rezultat 4.1, nepoznata 2.5.0) → test 06c (KNOWN 4.0 + 4.1 + 5.0; plan
   4.0 i 4.1 ostaju v2 i prilagođavaju se po 5.0 — rezultat `10k-v2.5.0`, isto kao plan 5.0; nepoznate 2.3.1, 2.4.2,
   2.5.1).

## 5. Invarijante J1–J5 (mreža R; nezavisno od steps.ts i volume.ts)

| | rezultat |
|---|---|
| J1: posle nedelje smanjenja (polja koraka) nikad redovno rasterećenje; prinudno sme | **0**; zadržanih zbog > 5: **0**; ukinuto 739 po scenariju smanjenja (4434) |
| J2: ≤ max(min(osnova + max(10 %, 1,0), nivo), osnova + D6) i ≤ osnova + max(10 %, 1,0, D6) | **0** (> 10 000 proverenih nedelja); 8 tokova mreže 04 iz izveštaja 888bf45 (28,4 / 39,8) prolaze: 28,4 = 26,8 + D6 1,6; 39,8 = 37,5 + D6 2,3 |
| J3: od ukinute nedelje ≤ 5 izgradnji; 0 grešaka validatora | **0**; najduži niz tačno 5 (12 i 17 ned) |
| J4 (Uslov 8): km > 0, dugi ≥ lagan, ≥ minimum D17, bez kvaliteta/ubrzanja u danima bola/odmora, prošlost i urađeno bajt-isti | **0** (`adaptInvariants` + validator + dani bola, svih 18 193) |
| J5: tokovi bez A17 i N2 bajt-isti prema 4917959 (normalizovan heš) | **0** izuzetaka (04, P, R) |

Polje reduced: true tačno u koracima A2/A3, false tačno u A6, odsutno u ostalim — 0 odstupanja (mreža 04: 760 / 80 /
1320 od 2160 koraka sa drugim korakom lanca; R: 0 odstupanja).

## 6. Sabotaže (pokvareno → ceo `tenK/v2` node skup → vraćeno; dokaz: heš `git diff -- web/src` isti pre i posle)

| sabotaža | palih (od 287) | koji |
|---|---|---|
| (a) A17 isključen (petlja A17 u `framesFor` prazna) | **14** | `adapt.node` 3 (rezultati po scenariju, 06b i 06c regresija), `painGrid` 3 (06c regresija P, I3, E), `reliefGrid` 8 (odbijanja 12/17 ned ne, regresija/J5, J1, J3, primeri N1 i 12/17 ned, višak + bol, stari korak) |
| (b) A17 ukida i prinudno rasterećenje | **2** | `reliefGrid`: umor + bol u istom koraku; nov start bez rasporeda D5 posle umora |
| (c) validator bez izuzetka A17 (samo `buildAllowed`) | **27** | `adapt.node` 9, `painGrid` 11, `reliefGrid` 7 (adaptacije sa ukinutim rasterećenjem odbijene `DELOAD_RUN`) |
| (d) koraci sa novim startom ulaze u A17 | **1** | `reliefGrid`: nov start 16 ned, rasterećenje ned 12 ostaje |
| (e) reduced se ne čita (staro tumačenje: startKm i levelKm) | **1** | `reliefGrid`: višak + bol u istom koraku (sreda ned 6: ned 8 bi bila ukinuta preko fromWeek viška) |

Detalji (imena svih palih testova, heševi `git diff -- web/src` pre / sa sabotažom / posle):
`artifacts/segment-06c/sabotage.json`.

## 7. Komande i rezultati (iz `web/`)

- `npx tsc -b --noEmit`, `npx eslint .`, `npx prettier --check .`: exit 0.
- `npx vitest run --project node src/domain/generators/tenK/v2`: **22 fajla, 287 / 287, 186 s** (f2b0194: 21 / 267).
- `npm run check` (typecheck, eslint, prettier, svi testovi): **exit 0 — 221 fajl, 2730 testova**, 828 s.
- `npx playwright test e2e/tenk-v2.spec.ts`: **3 / 3** (46 s).
- `node ../docs/10k-v2/artifacts/segment-06c/measure-a17.ts <checkout 4917959>` → `measure-a17.json`, 191 s (dva
  puta, pre i posle ispravke iz § 9.4: isti rezultat).
- Sabotaže: `python3` skripta (zamena teksta → ceo tenK/v2 skup → vraćanje), tri kruga; konačan na 287 testova (§ 6).
- J2 na mreži 04 (skripta, isti izraz kao `reliefGrid`): 550 nedelja, 0 prekršaja; 8 tokova iz 888bf45 tačno na
  granici osnova + D6.
- Ponovo pročitan diff: ukidanje odlučuje samo `steps.framesFor` (`reducedWeeks`, `A17_MAX_RUN`); validator i poruka
  čitaju isti `dropped` iz istog poziva; obim samo `volume.ts` (bez izmene); `assess.ts` samo podatak `reduced` i tekst
  N2.

## 8. Stalni uslovi (AGENTS.md 1–8)

1. Jedan vlasnik: ukidanje rasterećenja `steps.framesFor`; podatak „cilj koraka je smanjenje" `assess.ts` (reduced);
   obim `volume.ts`; validator samo prijavljuje iz istog `dropped`. Bez petlji.
2. Plafoni nedirnuti; granica A17 = `exceptionRun + 1` na jednom mestu (`A17_MAX_RUN`).
3. WU/CD nedirnuti.
4. Uslov poznat unapred (nedelja smanjenja) ulazi u konstruktor kroz okvire; završna zaštita samo proverava (J4).
5. Handoff bez izmene.
6. Plan nosi `10k-v2`/`10k-v2.5.0` i fazu svake nedelje; planovi 4.0 i 4.1 ostaju poznati (test `adaptFlow.node`).
7. `isolation.node.test.ts` prolazi bez novih izuzetaka; novi kod uvozi samo iz `tenK/v2/`.
8. J4 na 18 193 toka i `adaptInvariants` na mreži 04 — nijedan prazan trening, dugi ≥ lagan, nedelje ≥ minimum D17.

## 9. Preostalo

1. **Test 5 km uz A17** (§ 4): u 8 tokova planova po osećaju test otpada jer je ukinuto rasterećenje nosilo test (D27),
   a u nedelji izgradnje ne staje (A9). Po postojećim pravilima; odluka (npr. test na sledeću nedelju) nije doneta.
2. Korak sačuvan pre 10k-v2.5.0 se tumači rezervnim putem (startKm i levelKm); stari korak višak + bol bi se računao
   preko fromWeek (tačka 3, prihvaćeno; nema korisnika — prekidač isključen).
3. 5K v2 ima isti obrazac (N1) — poseban segment; `fiveK/` nedirnut.
4. Nađeno pri čitanju diffa (ispravljeno pre commita, bez uticaja na mreže): u prototipu je nov start BEZ rasporeda
   po D5 (`rePeriodize` = null, faze ostaju) brisao zapis prinudnih rasterećenja od svog fromWeek, pa bi kasniji bol
   iste nedelje ukinuo prinudno rasterećenje (16 ned: umor sreda ned 10 → ned 11 prinudno, pauza 35 četvrtak, bol
   petak → ned 11 ukinuta). Sada se zapis briše samo kad je raspored primenjen; test u `reliefGrid` (staro: rasterećenja
   [4, 8], novo: [4, 8, 11]).
5. **Rasterećenje sa testom D27 posle sidra bola** (4917959, gore): konstruktor daje cilj iznad 0,8 × osnova bez oznake
   koju validator traži (`VOLUME_RULE`). U mrežama 04, P i R posle A17 se više ne javlja (0 odbijanja), ali uzrok nije
   ispravljen; može se javiti kad rasterećenje sa testom nije odmah posle nedelje smanjenja. Odluka organizatora.
