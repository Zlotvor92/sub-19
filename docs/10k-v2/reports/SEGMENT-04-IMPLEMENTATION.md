# 10K v2 — Segment 04: adaptacija — assess → isti konstruktor → zaštita → validate (10k-v2.4.0)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `b13ca17`. Menjano samo `web/src/domain/generators/tenK/v2/**` i `docs/10k-v2/**` (novo `artifacts/segment-04/`; stari artifacts netaknuti). Nula uvoza van `tenK/v2/`; obrazac 5K v2 (`adapt/assess/steps`, `construct`, `adaptVolume`, `rePeriodize`) prepisan kao sopstvena kopija, ništa se ne uvozi iz `fiveK`; 10K v1 i druge distance nepromenjeni.

## Arhitektura (Uslov 4)

`adaptTenKV2(plan, facts, asOf)` → `{ ok, plan, changes, reasons }` | `{ ok: false, reasons, violations }`.

| fajl                                    | odgovornost                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assess.ts` (novo)                      | `checkFacts` (oblik činjenica kao 5K v2: workouts, results 3/5/10 km i 21 097,5 m, lockedDayIds, coverage, breaks) i `assess` — činjenice → `TenKV2AdaptStep` (opsezi bez kvaliteta / 1 kvalitet / odmor / bol, cilj sledeće nedelje, nov start, prinudno rasterećenje, VDOT, nivo pre smanjenja, sidro bola). Jedino mesto odluka A1–A10; ne gradi nedelje |
| `steps.ts` (novo)                       | koraci → okviri: `framesFor` (rePeriodize, prinudno rasterećenje, test A13, `limitsOf` po datumima), `pacesAt` / `basisAt` (tempo i osnova po nedelji), `appliedRestarts`                                                                                                                                                                                   |
| `generate.ts` `construct(input, steps)` | ISTI konstruktor: okviri iz `framesFor`, cilj iz `volume.adaptNominal10`, tempo nedelje iz `pacesAt`; nov start = nova progresija doze (D16); prolazi kvaliteta pravilo → popuštanje → 1 kvalitet → bez kvaliteta (A9; ograničenje nedelje bira prvi prolaz); cilj adaptacije se najpre drži; oštrenje otpada kad trkačka > taper                           |
| `volume.ts`                             | `adaptVolume` / `adaptNominal10` / `enterWeek` / `leaveWeek` / `nextBuild10`: isti rekurent kao D6 + cilj koraka, ostatak nedelje, povratni rast, granica novog starta, taper od vrha posle smanjenja, donja granica; `fit10(downOnly)`                                                                                                                     |
| `week.ts`, `lengths.ts`, `workouts.ts`  | ograničenja PRE izbora: režim kvaliteta (`QualityMode`), dan jedinog kvaliteta van zabrane; dani bola/odmora (`painLong10`, `limitedEasy10`, dan pred trku bez ubrzanja); oštrenje van zabrane                                                                                                                                                              |
| `periodize.ts`                          | `rePeriodize` (D4/D21 + D5 relativno od novog starta; null kad D5 nema raspored)                                                                                                                                                                                                                                                                            |
| `adapt.ts` (novo)                       | provera plana (A15), asOf (A11), činjenica; assess → construct → spajanje (dani ≤ asOf, urađeni, zaključani bajt-isti; `mixedWeeks`) → zaštita samo proverava (`ADAPT_PROTECTION`) → validate; `changes`, reasons (+ `TEST_MOVED`)                                                                                                                          |
| `validate.ts`                           | adaptiran režim: tempo/osnova po nedelji, faze/okviri iz koraka, D5 relativno + prinudno, cilj po `adaptNominal10` (rast od cilja koraka, vrh od novog starta, taper), `TARGET_FLOOR`, `ONE_QUALITY`, `LIMITS`; mešovite nedelje samo dani                                                                                                                  |
| `types.ts`, `policy.ts`                 | činjenice, korak, `WeekLimits`, `TenKV2Adaptation`, `AdaptResult`; `policy.adapt` + DECISIONS A1–A15; `10k-v2.4.0`                                                                                                                                                                                                                                          |

Bez čitanja sata (asOf je ulaz); koraci u `plan.adaptation.steps` (lanac); `construct(input, [])` = `generateTenKV2` (bajt-isto, dole). `construct` sa koracima vraća i validira ceo konstruisan plan (bez mešanja); `adapt` validira spojeni plan.

## Odluke A1–A15 (pravilo | mesto | test u `adapt.node.test.ts`)

| A   | pravilo (DECISIONS)                                                                                                                                                                                                                    | mesto                           | test              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------- |
| A1  | rezultat ≤ 84 d, noviji → VDOT od sledeće nedelje; po osećaju → result, RPE samo do te nedelje; D6 isti; doza se nastavlja; cilj (nedelje do trke) i prognoza iz novog VDOT-a; VDOT van 30–80 / bez sledeće nedelje → ne primenjuje se | assess, steps.pacesAt           | A1                |
| A2  | < 60 % u pokrivenih 7 d → min(prethodni cilj, max(izvršeno, 0,8 × cilj)) ≥ minimum                                                                                                                                                     | assess                          | A2                |
| A3  | pauza 7–13 / 14–27 / ≥ 28 → 80 % + 1 kvalitet / 70 % bez pa 1 / min(14 d/2, 50 %) + nov start; < 8 ned → orijentir                                                                                                                     | assess, rePeriodize             | A3, pouka (d)     |
| A4  | bol ≥ 4 → 7 d bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani × 0,7 ≥ 3; ≥ 7 → 3 d odmora; rast od 0,7 × cilja nedelje bola                                                                                                            | assess, limitsOf, lengths, week | A4                |
| A5  | ≥ 2 lagana RPE ≥ 7 → rasterećenje (0,8 × poslednja ne-rasteretna); redovno odmah posle se ukida                                                                                                                                        | assess, framesFor               | A5                |
| A6  | > 115 % u 2 pokrivena prozora → bez rasta; ne kad je sledeća rasteretna                                                                                                                                                                | assess                          | A6                |
| A7  | bol uvek; obim pauza > umor > izvršenje; svi uslovi u reasons                                                                                                                                                                          | assess                          | A7, pouka (e)     |
| A8  | +10 %/ned (min 1,0; ≥ D6) do nivoa, svuda osim tapera/trke; taper 0,75 × vrh posle smanjenja                                                                                                                                           | volume                          | A8, pouka (a)(g)  |
| A9  | cilj ≥ minimum nedelje; kvalitet → 1 → bez; test koji ne staje otpada; oštrenje otpada (trkačka ≤ taper)                                                                                                                               | volume, construct, week         | A9, pouka (b)     |
| A10 | dan bez zapisa poznat samo u coverage complete                                                                                                                                                                                         | assess                          | A10, pouka (c)    |
| A11 | zaštita samo proverava; asOf ≥ trka / pre prethodne → ADAPT_AS_OF_INVALID                                                                                                                                                              | adapt                           | A11, pouka (f)    |
| A12 | trka, taper, trkačka se ne pomeraju; rePeriodize po D5 (i faza od 1 ned)                                                                                                                                                               | periodize                       | A12               |
| A13 | blokiran test → prva sledeća slobodna nedelja izgradnje po osećaju; posle rezultata nema; početnik nema                                                                                                                                | steps.framesFor                 | A13               |
| A14 | koraci se čuvaju i ponavljaju; construct(input, koraci) = budućnost plana                                                                                                                                                              | adapt, construct                | A14, determinizam |
| A15 | plan starije verzije: budućnost tekuća pravila, prošlost mixedWeeks; druga politika → ADAPT_PLAN_INVALID                                                                                                                               | adapt.checkPlan                 | A15               |

Na b13ca17 (worktree, kopirani testovi + `adaptInvariants.ts`, `testInputs.ts`, fixture): `adapt.node.test.ts` pada ceo (`Cannot find module './adapt.ts'`, 31 test, uključujući po jedan za svaku odluku A1–A15), još 3 (verzija, DECISIONS); regresioni testovi mreža prolaze (fixture je iz b13ca17).

## Odstupanja (opreznije, bez novog broja; DECISIONS sa ulazom)

| odluka              | odstupanje / tumačenje                                                                                                                              | ulaz                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A3                  | rePeriodize bez rasporeda po D5 (4 ned izgradnje) → faze ostaju, nov start samo obima i doze                                                        | 4 d, 14 ned, VDOT 45, 35 km, kraj ned 8, pauza 35                                                      |
| A3/A8               | povratak do nivoa i iznad granice novog starta (1,4×); iznad nivoa drži granicu. Sa granicom za povratak cilj je ravan do trke                      | 4 d, 18 ned, 35 km, kraj ned 2, pauza 35: 24,6 km ned 8–16                                             |
| A9                  | cilj adaptacije se drži: svi prolazi kvaliteta na njemu pre nižeg cilja                                                                             | početnik 4 d, 14 ned, VDOT 35, 25 km, manjak kraj ned 8: 26,0 → 14,9 km bez toga                       |
| A9 (D13 ispred D5)  | dugi rasterećenja posle smanjenja obima ≤ 0,8 ×, najduži uz lagane ≥ 3 km, ≥ 3 km (pravilo testa D27)                                               | 3 d, 10 ned, VDOT 45, 25 km, kraj ned 2, pauza 21 + bol 6: rasterećenje 10,7, lagani 2,9               |
| A9/A13              | test posle smanjenja obima samo kad dugi ≥ 5 km, inače otpada (ne pre smanjenja: generator ima dugi < 5 km u nedelji testa u 30 planova po osećaju) | 3 d, 10 ned, 6:00, 25 km, kraj ned 2, pauza 35: test ned 5 → dugi 3,0, rasterećenje ned 6 neizvodljivo |
| A9 (D11 ispred D12) | glavna doza sme da padne kad je adaptiran cilj manji od nedelje poređenja                                                                           | početnik 3 d, 10 ned, 7:30, 20 km, manjak sreda ned 6: RP 2,4 → T 1,5 km                               |
| A9                  | D30b oštrenje ne popravlja → oštrenje otpada kad bi trkačka bila > taper (D23)                                                                      | u mreži 0 (D8 + D23 već drže trkačku ≤ taper); direktan test `raceWeek(…, noSharpener)`                |
| A4                  | nedelja sa danom bola/odmora: najviše 1 kvalitet doze rasterećenja i kad dani kvaliteta nisu u bolu (mreža: 32 nedelje)                             | 3 d, 10 ned, VDOT 45, 25 km, bol 8 kraj ned 2 → ned 4 (bol pon–sre, kvalitet čet)                      |
| A1                  | „obim ne raste zbog tempa" = nominal D6 isti; kapacitet je konstrukcija sa novim tempom                                                             | 3 d po osećaju, test 24:30: dugi 15,7 → 15,3 (105 min)                                                 |

## Sabotaže (pokvareno → palo od 31 u `adapt.node` → vraćeno; md5 177 fajlova `tenK/v2` + `docs/10k-v2` posle = pre)

- A3 pauza bez coverage (dan bez zapisa poznat) → 11 (A1, A10, A13, A15, pouka a/c/d/g, scenariji, bez činjenica ×2).
- A8 bez povratnog rasta (ravno do trke) → 5 (A8, A13, pouka a/g, scenariji). A9 bez donje granice → 4 (0 odbijanja, scenariji, pouka b/g).
- A10 coverage.complete zanemaren → 2 (pouka c, scenariji). A11 bez zadržavanja urađenog/zaključanog/ostatka nedelje → 3 (zaštita/invarijante, pouka f, scenariji).

## Komande i rezultati (iz `web/`)

- Tokom rada: `npx vitest run --project node src/domain/generators/tenK/v2 src/domain/generators/architecture src/domain/generators/tenK/isolation` → 18 fajlova, 230 testova (tenK/v2: 16 / 205; bilo 15 / 171); ≈ 125 s.
- Prvi krug provera (pre završnih izmena): `npx tsc -p tsconfig.domain.json --noEmit` exit 0; `npx tsc -p tsconfig.oracle.json --noEmit` exit 2 (`adapt.node.test.ts:51` konverzija niza zapisa) i `npx eslint src/domain/generators/tenK/v2` exit 1 (2: nepotrebna `!` u `adaptInvariants.ts`, `any` iz `JSON.parse`) → ispravljeno; `npx prettier --check src/domain/generators/tenK/v2 ../docs/10k-v2` 5 fajlova → `--write`. Završni krug pre commita (jednom): tsc domain exit 0, tsc oracle exit 0, eslint exit 0, prettier exit 0; `npm run check`: exit 0 — typecheck, lint, format:check, vitest 211 fajlova / 2601 testova (615 s).
- Primeri: `node docs/10k-v2/artifacts/segment-04/run.ts` dva puta → bajt-isti izlaz (sha1 10 fajlova); `regression-b13ca17.ts` iz worktree-a b13ca17 → `segment04.plan-hashes-b13ca17.json` (31 122 heša).

## Regresija generate: bajt-isto kao b13ca17

`planHash81` (ceo rezultat bez oznake verzije) = b13ca17 za sa rezultatom 15 840, po osećaju 11 880 i početnika 3402 (`grid` / `feelGrid` / `beginnerGrid`, razlika 0); bazne linije i regresije prema 81bd351 / 21c03f1 / 49ad476 zelene bez izmene; `construct(input, [])` = `generateTenKV2` (JSON), plan generatora bez `adaptation` / `limits`.

## Mreža scenarija: 30 baznih planova × 4 asOf × 17 scenarija = 2040 adaptacija

Bazni: 3/4/5/6 d × sa rezultatom (VDOT 45, 25/35/45/55 km) i po osećaju (6:00) × 10/14/18 ned + početnik 3 d po osećaju (7:30, 20 km) i 4 d VDOT 35 (25 km). asOf: kraj ned 2, sreda ned 6, kraj ned 8, sreda tapera. Svih 2040 (+ drugi korak lanca): 0 odbijanja, 0 grešaka validatora, zaštita bajt-isto, invarijante 0 prekršaja, dva poziva = isti JSON; nevaljani ulazi → strukturisano odbijanje (17 slučajeva).

| scenario               | primenjeno (od 120) | nedelje iste | mešovite | scenario                    | primenjeno                     | iste | mešovite |
| ---------------------- | ------------------- | ------------ | -------- | --------------------------- | ------------------------------ | ---- | -------- |
| bez činjenica          | NO_FACTS 120        | 120          | 0        | umor                        | FATIGUE 80                     | 40   | 0        |
| izvršeno 100 %         | —                   | 120          | 0        | rezultat +2                 | NEW_RESULT 120                 | 0    | 1        |
| manjak 50 %            | UNDER 80            | 40           | 0        | rezultat −2                 | NEW_RESULT 108 (VDOT < 30: 12) | 12   | 1        |
| višak 120 %            | OVER 80             | 44           | 0        | test 5 km                   | NEW_RESULT 120                 | 0    | 1        |
| pauza 10 (coverage)    | PAUSE 120           | 0            | 50       | nepotpuna pokrivenost       | — (NO_FACTS)                   | 120  | 0        |
| pauza 20 (prijavljena) | PAUSE 120           | 0            | 54       | zaključani + urađeni        | —                              | 120  | 0        |
| pauza 35 (nov start)   | PAUSE 120           | 0            | 60       | lanac (pauza 10, pa manjak) | UNDER 80                       | 40   | 50       |
| bol 5 / bol 8          | PAIN 120 / 120      | 0            | 54 / 54  | bol + pauza                 | PAIN 120 + PAUSE 120           | 0    | 54       |

Nije primenjeno = sledeća nedelja nije izgradnja (taper/trka) ili je rasteretna (A2, A5, A6). TEST_MOVED (A13) 4–13 po scenariju.

## Pouka 7

(a) posle pauze 20 cilj raste svake nedelje izgradnje, ≤ max(+10 %, D6), ne preko nivoa skokom, nivo dostignut pre tapera (18 ned); (b) pauza 35 posle malog obima → cilj = minimum nedelje (9 km, 3 d), nijedan cilj ispod; (c) nepotpun zapis bez coverage i sa complete = false → nijedan uslov, budući deo isti; (d) prijavljena pauza bez zapisa → 70 % cilja plana; (e) bol + pauza + manjak u istom prozoru → PAIN i PAUSE, manjak nije primenjen; bol + umor + manjak → PAIN i FATIGUE, manjak nije; (f) prošlost, urađeno i zaključano bajt-isto, mixedWeeks; (g) taper = 0,75 × vrh posle smanjenja i ≤ poslednje nedelje izgradnje (5 scenarija × 4 plana).

## Stalni uslovi (AGENTS.md)

| #   | uslov                     | stanje 04                                                                                                                                                                                                          |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | jedan vlasnik, bez petlji | odluke A1–A10 samo `assess.ts`; obim `adaptNominal10`; doza `quality.ts` (režim iz okvira); dužine `lengths.ts`; prolazi kvaliteta su ista pretraga cilja (bez petlje skraćivanja); validator samo prijavljuje     |
| 2   | jedan plafon po zoni      | D11 nepromenjen; dugi bola ≤ 60 min je ograničenje koraka (jedno mesto `painLong10`)                                                                                                                               |
| 3   | WU/CD nisu pufer          | WU/CD po pojasu ulaza (D14) i u adaptiranim nedeljama; manjak dana bola/odmora je planirano < cilj                                                                                                                 |
| 4   | adaptacija                | ograničenja ulaze u konstruktor PRE izbora (okviri, cilj, tempo, režim kvaliteta, dani); spajanje + zaštita samo proverava bajt-jednakost (`ADAPT_PROTECTION`); nema koraka koji posle konstrukcije menja kvalitet |
| 5   | handoff                   | nije u segmentu (činjenice su oblika 5K v2 radi aplikacije u 06)                                                                                                                                                   |
| 6   | policyId/Version, faza    | `10k-v2` / `10k-v2.4.0`; faza svake nedelje iz konstruktora (rePeriodize); koraci u `plan.adaptation`                                                                                                              |
| 7   | nula uvoza van foldera    | isolation.node + architecture/isolation zeleni; novi fajlovi uvoze samo `tenK/v2`                                                                                                                                  |
| 8   | upotrebljivost            | cilj ≥ minimum nedelje (A9), dugi ≥ lagan, lagan ≥ 3 km, test koji ne staje otpada; izuzetak: nedelja sa danima odmora (bol ≥ 7) sme ispod minimuma (upozorenje)                                                   |

## d4-rezultat-14w-pauza20 (4 d, VDOT 45, 35 km; prijavljena pauza 20 d, asOf kraj ned 7; nivo 39,3 km)

| ned     | faza               | cilj pre → posle          | kvalitet pre → posle                                        | dugi               |
| ------- | ------------------ | ------------------------- | ----------------------------------------------------------- | ------------------ |
| 8       | razvoj, rasteć.    | 37,5 → 29,2 (0,7 × 41,7)  | T 2 × 1200 → — (bez kvaliteta)                              | 12,3 → 9,6         |
| 9 / 10  | specifično         | 49,0 → 32,1 / 35,3        | RP + T → T 2 × 1200 (1 kvalitet) / RP 3 × 1000 + T 3 × 1000 | 16,1 → 10,5 / 11,6 |
| 11 / 12 | spec. (11 rasteć.) | 39,2 → 28,2 / 49,0 → 38,8 | T 2 × 1000 / RP 2 × 1500 + T 3 × 1200                       | 9,2 / 12,8         |
| 13 / 14 | taper / trka       | 36,8 → 29,1 / 18,2 → 15,4 | RP 2 × 1000 + T 2 × 1000 / oštrenje 2 × 1000                | 9,6 / —            |

## d3-osecaj-12w-test5km (3 d, po osećaju 6:00, 25 km; test 5 km 24:30 u ned 4 → VDOT 39,2 od ned 5)

Ned 1–4 bajt-iste; ned 5–12: ciljevi isti (D6), doze iste (metraža), tempo iz VDOT-a, bez RPE; dugi 15,7 → 15,3 km (105 min sporijim E iz VDOT-a), trkačka 12,3 → 11,4 km (35 min E); paceBasis feel → result, prognoza 50:53; test više nema. Svi primeri: `artifacts/segment-04/examples.md`.

## Odluke

- A1–A15 u DECISIONS (`policy.ts`, `10k-v2.4.0`) sa mestom i obrazloženjem; brojevi samo u `policy.adapt` (A1–A15 iz zadatka); odstupanja iz tabele gore upisana sa ulazom.
- Tumačenja bez novog broja: „sledeća nedelja" = prva puna nedelja posle asOf, ostatak tekuće nedelje dobija ograničenja i cilj pauze (izgradnja i taper); zapis bez dayId je van plana (umor ga broji kao lagan), urađen dan se štiti po dayId ili datumu; nivo pre bola = prvi zapis bola; ocena cilja posle rezultata za nedelje od rezultata do trke; „orijentir" = `GoalStatus 'orientation'` + napomena; validator spojenog plana posle mešovite nedelje preskače provere koje zavise od stanja (konstruisan plan je proveren u `construct`).

## Preostali problemi

- Svi pragovi A1–A15 i odstupanja su heuristike bez trenerske provere; posebno povratak iznad granice novog starta (A3/A8) i 1 kvalitet u nedelji sa danom bola (A4).
- Mali obim posle smanjenja: početnik 4 d posle pauze 35 → 12,6 km (svi dani ≈ 3 km, dugi 3,0–5,5 km), WU/CD ostaju po pojasu ulaza (D14) pa je dugi kraći od kvalitetnog dana (D25) u smanjenim nedeljama.
- Mešovite nedelje (asOf usred nedelje, zaključani/urađeni dani, plan starije verzije): nedeljna pravila na spojenom planu se ne proveravaju.
- Bez coverage adaptacija ne vidi pauzu ni manjak iz zapisa — aplikacija (segment 06) mora slati pokrivenost; rezultat u trkačkoj nedelji se ne primenjuje; test koji ne staje otpada (ne premešta se); 4 ned izgradnje posle pauze ≥ 28 → faze ostaju.
- Mreža adaptacije ima 30 baznih planova (2040 adaptacija), ne celu mrežu generatora; asOf samo 4 položaja.
