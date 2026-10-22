# Segment 3e — maraton v2 kao IZVOR predaje „kraća distanca" (→ HM, 10K; obrazac 3c)

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `f2e833d`. Bez PR-a, mergea i deploya. Odluke:
DESIGN.md § 8 (O1 + dopuna, O2a, O3a–O7a, O8a, „Predaja za 3e"). Dirani su samo `marathon/v2/**`, `select.ts` i
`docs/generators-v2/handoff/**`, `docs/marathon-v2/STATUS.md`; `halfMarathon/v2/**`, `tenK/v2`, `fiveK/v2`, `handoff.ts`
nisu. Verzija maratona v2 ostaje **marathon-v2.4.2**: plan ne dobija novo polje i sačuvani plan je bajt-isti
(`KNOWN_VERSIONS` nepromenjen). Uzor 3c je kopiran, ne uvezen (uslov 7).

## 1. Izmene

| Fajl | Izmena |
|---|---|
| `marathon/v2/shorter.ts` (nov) | Okidač O1 `shorterOffer(plan, asOf?)`: ima adaptaciju, ispod praga, plan generatora za isti ulaz nije, trka posle `asOf`. Prag = `belowLongShort` = `lengths.longShortOf(...) !== null`. To je ista funkcija koju čitaju validator (MARATHON_LONG_SHORT) i konstruktor (napomena N11). Red tabele dolazi iz `checkInput`, kao u validatoru. |
| `marathon/v2/app/preparation.ts` (nov) | `MARATHON_V2_SOURCE_FORMAT` je jedino mesto spiska (`marathonV2`; `vdot`, `paceBasis`, `mpVdot`, `predictedMarathonSec`, `goalVdot`, `goalAssessment`, `marathonV2Edits`). `contractInput` daje ulaz čarobnjaka bez izvedenih polja. `pb` = `lastResult`. Lak tempo ide samo bez rezultata. `rawFacts` je bez `dayId` i zaključanih dana. `basisFromPlan`: `policy: null`, `execution: null`, bez `guardBaseKm`. `executionBasis`: potvrda + opis 28 dana, `startingKm = reportedBaseKm`, start = dan posle potvrde. `preparationDecision`: HM, pa 10K, prva koju cilj pokriva. „Zadrži plan v2" je u `conditions`. Vrh opcije dolazi iz `meta.preparation` (v1) ili iz `hmV2` (`peakKm`, najduži dugi; predaja 3f). `buildPreparationChoice` radi samo „shorter". |
| `marathon/v2/app/{members,index,adapt}.ts` | `executionBasis` postaje član 'v2' (`NO_PREPARATION_DECISION` uklonjen). Izvoz odluke i formata. `AdaptPreview.shorterOffer?: true` samo kad ponuda postoji. |
| `select.ts` | `marathonV2Preparation(flags)` (obrazac `hmV2Preparation`), `preparationForPlan` → maraton v2, granični kast `executionBasis`, komentar. `shorterHandoffForV2Source` nije menjan: cilj već bira prekidač (HM v2 iz 3f, 10K v2 → `V2_TARGET_NOT_READY`). |

**N11/M13 su pomireni jednom funkcijom (bez STANI).** `longShortOf` vraća `{longestKm, timeCapped}` kad je plan ispod
praga. Validator upozorava samo kad je `!timeCapped`. Okidač čita `!== null`, dakle isti prag bez obzira na uzrok.
Sabotaža 3e-b („okidač čita upozorenje") pada.

**`lastResult` (P2: „poslednji rezultat iz ulaza ili iz koraka adaptacije").** Uzima se najnoviji rezultat čiji datum
nije posle starta ulaza ugovora. Merenje je pokazalo sudar: rezultat koraka dolazi posle starta plana, a v1 cilj tada
odbija („Datum rezultata mora biti ispravan datum koji nije posle početka plana", 65/170 ponuda). Sa uslovom
„≤ start" imamo dva slučaja:
- `basisFromPlan` (start plana) daje rezultat iz ulaza, kao u 3c;
- `executionBasis` (start = sutra) nosi i rezultat koraka.

## 2. Merenja

**M1 sa domenskim okidačem** (`shorter.ts MAR 193 97 29` → `shorter-MAR-3e.json`, 3 651 s; 253 plana, 164 394 toka,
0 odbijanja): ponuda **3 339** (2,0 %) = 3 141 pad ispod praga u odnosu na prethodni plan (= 3a; svaki ima ponudu,
`lostNotOffer` 0) + 198 bez pada u tom koraku. Tih 198 je tačno broj tokova lanca čiji je PRVI korak pao (`chain` 198):
drugi korak (`chain2`, ponuda 209 = 11 novih padova + 198) ostaje ispod praga, a plan generatora nije (dopuna O1, isto
kao 3c: 256). Rezultat kao okidač: test5k 615, slower 248; ponuda sa dugim ograničenim trajanjem (bez upozorenja, N11)
**583**. `bornShort` 188 planova nikad ne dobija ponudu.

**Tok kroz pravi kod** (`marathonSource.measure.ts` → `marathonSource.json`, 85 s). Uzorak: 253 plana, 3 036 tokova
(asOf kraj ned. 2 i ⌊N/2⌋; pause35, pause20, painPause, test5k, slower, under50). Rezultat: **170 ponuda**.

| Cilj (put) | izbori | uspeh | dupli datum / id | id prošlog dana ≠ izvor | id ≠ izvor istog datuma | curenje `marathonV2` / meta v2 | pogrešan generator | 4a |
|---|---|---|---|---|---|---|---|---|
| HM v1 (`basisFromPlan`) | 170 | 93 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | — |
| 10K v1 | 170 | 93 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | — |
| HM v2 (prekidač, 3f) | 170 | 119 | 0 / 0 | 0 | 0 | 0 / 0 | 0 | **0** |
| HM v1 (`executionBasis`, obim čarobnjaka) | 170 | 124 | | | | | | |

Razlozi neuspeha:
- **v1:** 77 × `V1_TARGET_NEEDS_RESULT` (O5a). To su 46 planova bez ijednog rezultata i 31 plan po osećaju čiji je
  test 5 km iz koraka posle starta plana. Kroz `executionBasis` tih 31 je dostupno (124 = 93 + 31; 0 odbijenih).
- **HM v2:** PLAN_TOO_SHORT 42 i PLAN_TOO_LONG 9 (O8a doslovno; 3 uz početnika). Tada se nudi 10K v1 (24 odluke).
  Odluke HM v2: HM 119, 10K 24, bez opcije 27 (10K v1 traži rezultat).
- Po osećaju → v1 nedostupan: 46/46 (O5a).

## 3. Testovi (`marathon/v2/app/handoffSource.node.test.ts`, 20)

- **Okidač:**
  - pauza 35 d (26,2 → 18,5 km): ponuda + MARATHON_LONG_SHORT;
  - test 5 km (→ 21,9 km, `timeCapped`): ponuda bez upozorenja, sa rečenicom plana `longTimeCapNote`;
  - trka nije posle `asOf` / bez adaptacije / bez pada (done100) / rođen ispod praga (17,8 km) → nema ponude.
- **Odluka i izbor:**
  - `preparationForPlan` → maraton v2; `isLimited(meta, plan)`, a sama `meta` → `false`;
  - osnova je bez politike, izvršenja i `guardBaseKm`, obim je iz čarobnjaka;
  - opcija HM (v1), „Zadrži plan v2", izjava „18,5 km, ispod 26 km";
  - izbor HM i 10K: bez `marathonV2` i meta v2, pravi generator, bez duplih datuma i id-ja, prošli id-jevi ostaju;
  - `base` → odbijanje.
- **HM v2 cilj iz PRAVOG izvora:** `isHmV2Plan`, id = id izvora istog datuma, vrh iz `hmV2` (≥ 16 km).
- **Nedostupne (doslovno):**
  - kasno → `Polumaraton: Plan od 8 nedelja je prekratak…` + `10K: V2_TARGET_NOT_READY`;
  - O8a 24 ned → PLAN_TOO_LONG, pa opcija 10K;
  - po osećaju → `V1_TARGET_NEEDS_RESULT` ×2, a sa HM v2 opcija postoji (lak tempo 315 prenet).
- **P2:** rezultat koraka ide u `pb` samo kroz `executionBasis` (bez laganog tempa) → opcija HM v1. Činjenice su bez
  `dayId` i bez `lockedDayIds` (dnevnik sa zapisima).
- **T1/T2 × {HM v1, HM v2} × trka subota/nedelja × bez izvršenja / potvrđena pauza (8 testova):**
  - politika izvora (`adapt.returnGrowth`, `pause.longShare`) menja izvor (kontrola), a cilj ne;
  - T2: HM v1 `RETURN_POLICY` i HM v2 `adapt.pause.*` menjaju cilj.
  - Kod HM v2 poredi se deo posle prefiksa + `hmV2`, jer je prefiks tekuća adaptirana nedelja izvora (O6b).

`app.node.test.ts`: `executionBasis` sada daje osnovu; `preparationForPlan(v2)` nije `null`, a plan bez adaptacije nije
ograničen.

**3f testovi** (`halfMarathon/v2/app/handoffTarget.node.test.ts`) ostaju na sintetičkom izvoru. Prelaz zahteva izmenu
`halfMarathon/v2/**`, što je zabranjeno. Pravi izvor → HM v2 je pokriven ovde (test + merenje: 119 uspeha, 4a 0).

**Sabotaže** (`sabotage-3e.json`, brz nivo, `--bail=1`): **9/9 palo**. Stanje `src` je posle vraćanja isto.
- 3e-a okidač bez provere „pre adaptacije";
- 3e-b okidač čita upozorenje umesto praga;
- 3e-c izvedeni obim;
- 3e-d čistač preskočen;
- 3e-e `dayId` prelazi;
- 3e-f bez laganog tempa;
- 3e-g vrh ne čita `hmV2`;
- 3e-h rezultat koraka se ne šalje;
- 3e-i rezultat posle starta.

## 4. Provere (iz `web/`)

| Komanda | Rezultat |
|---|---|
| `npx tsc -b --noEmit`; eslint/prettier menjanih fajlova | exit 0 |
| `npm run check` | **EXIT 0; 296 fajlova, 3521/3521** (13 min) |
| `TEST_FULL=1 npx vitest run --changed f2e833d` | **147 fajlova, 1223/1223** (7 min) |
| `TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon/v2` | **53 fajla, 438/438** (25,7 min) |
| `npx playwright test e2e/marathon-v2.spec.ts e2e/hm-v2.spec.ts` | **6/6** (42 s) |

**byteSame.** `marathon/v2/app/byteSame.9443676.json` je nepromenjen i prolazi. Nijedan byteSame snimak (HM v2, 10K
v2, maraton v2) nema red plana maratona v2, pa nema redova za osvežavanje. Sačuvani plan je bajt-isti: `plan.ts`,
`generate.ts` i `adapt.ts` jezgra nisu dirani, a pregled dobija samo neobavezno `shorterOffer`. Pun nivo foldera
(mreže sa heševima) prolazi. `personalPlan.node.test.ts` nije menjan i prolazi (`--changed`).

## 5. Uslovi AGENTS.md

1. Jedan vlasnik: `longShortOf` (validator, konstruktor, okidač); spisak formata je samo u `MARATHON_V2_SOURCE_FORMAT`;
   rezultat je samo u `lastResult`.
3. WU/CD se ne diraju.
5. Činjenice idu bez politike (`policy: null`, T1 × 8).
6. Plan cilja nosi oznaku i fazu cilja (`stampForStorage`).
7. Nema uvoza van `marathon/v2/` (`isolation`); cilj se prosleđuje kao argument iz `select.ts`.
8. Dupli datum/id 0; prošlost je zaštićena; 4a na HM v2 cilju 0.

## 6. Otvoreno (za organizatora)

1. **HM v2 (3c) nema isto što ima 3e** (nije menjano, van opsega):
   - `HM_V2_SOURCE_FORMAT` nema `hmV2Edits`, pa bi posle adaptacije snimak izmena HM v2 ostao u meta v1 cilja;
   - HM `contractInput` ne šalje rezultat iz koraka adaptacije (P2).
   Predlog: ista dopuna u HM v2 kao 3e (mali segment).
2. **Tekst `V1_TARGET_NEEDS_RESULT` („ovaj plan je po osećaju").** Netačan je za 31/170 planova koji imaju test 5 km
   posle starta plana: rezultat postoji, ali kroz `basisFromPlan` ne sme da uđe u v1 ulaz. Kroz `executionBasis`
   opcija postoji.

## 7. Predaja za 3g (šta UI prikazuje)

1. Ponuda: `AdaptPreview.shorterOffer` u pregledu adaptacije → veza ka odluci o pripremi. Uz nju:
   - `isLimitedLongPreparation(meta, plan)` (bez plana → `false`);
   - `preparationForPlan(plan, flags)` sa prekidačima korisnika (bez njih cilj je uvek v1).
2. Odluka:
   - `statement` (najduži dugi i prag);
   - opcija „Kraća distanca: Polumaraton/10K istog datuma" (`peakLongRunKm`, `peakWeeklyKm`, `coverage`);
   - „Zadrži plan v2" (`conditions[0]`) = dugme „Zatvori".
3. Razlozi nedostupnosti doslovno, kao `Polumaraton: …` / `10K: …`:
   - `V1_TARGET_NEEDS_RESULT`;
   - `V2_TARGET_NOT_READY`;
   - HM v2 PLAN_TOO_SHORT / PLAN_TOO_LONG (O8a);
   - EASY_PACE_REQUIRED.
4. Prefiks HM v2 cilja (O6b): nedelje izvora sa fazom izvora; broj nedelje u pregledu je `offset + index` (predaja 3f).
5. Potvrđeno izvršenje (`executionBasis`) je jedini put kojim rezultat koraka adaptacije stiže do v1 cilja (§ 6.2).
