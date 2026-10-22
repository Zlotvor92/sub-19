# HM v2 — Segment HM-08b (hm-v2.6.1): K1, K2, K3 (i MAR → HM), dopune pouke 37

Polazni SHA `836a5cd` (HM-08). Menjano: `halfMarathon/v2/**`, `docs/hm-v2/**`, redovi HM v2 u
`marathon/v2/app/byteSame.9443676.json`. Nalazi ranog prolaza završne provere (organizator). DECISIONS `K1-TEST`,
`K2-RACE-REST`, `K3-CHAIN`, dopuna `P37-MIXED`.

## Uzrok → ispravka

| nalaz                                                      | uzrok (strana koja odstupa)                                                                                                      | ispravka                                                                                                                                                                                                                                                                | test                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| K1 zaključan dan testa + pauza/umor/bol                    | `steps.framesFor` A13 premešta test posle asOf i kad je dan zaključan/urađen (zaštićen, upisan) → dva testa → TEST (konstruktor) | `steps.protectedTestDate` (jedna funkcija): test plana pre koraka sa danom ≤ asOf, zaključanim ili urađenim se ne premešta i nijedan drugi okvir ne nosi test (kao maraton A13b, MAR-08b); framesFor dobija skup zaključanih ∪ urađenih (konstruktor, validator, adapt) | `segment08b` K1 + mreža |
| K1 + nov rezultat (two-step locked → faster/slower/test5k) | validator sudio mesto ZAŠTIĆENOG testa (osnova tempa posle rezultata ≠ po osećaju)                                               | validator: broj testova ≤ 1 uvek; mesto samo nezaštićenom testu (kao HM07b-GUARD)                                                                                                                                                                                       | `segment08b` K1 lanac   |
| K2 trkačka + trka < minimum                                | invarijanta (test kod) bez izuzetka dana odmora koraka; validator tačno daje RACE_WEEK_SHORT (pouka 25)                          | `adaptInvariants` izuzetak: dani odmora (A4) + RACE_WEEK_SHORT                                                                                                                                                                                                          | `segment08b` K2         |
| K3a bol 8 → bol 8 (EMPTY_WEEK)                             | svi dani trčanja ned 1 su dani odmora bola → prazna nedelja; validator je odbijao                                                | WEEK_ALL_REST upozorenje (kao 10K-06g, N1)                                                                                                                                                                                                                              | `segment08b` K3         |
| K3b bol 8 → umor (WEEK_INFEASIBLE)                         | rasterećenje ned 2 bez upisanog dugog izgradnje (ned 1 cela u odmoru) → `buildWeek` null za svaki cilj (konstruktor)             | `assess` A5: `step.deloadRefLongKm` = dugi poslednje ne-rasteretne izgradnje generatora pre nedelje rasterećenja (kao pouka 34); `steps.deloadRefLong10` čitaju konstruktor i validator                                                                                 | `segment08b` K3         |
| P37 pokrivenost (ispravka organizatora, 5K-08i-b)          | dan poznat iz potpune pokrivenosti bez zapisa računat po planu                                                                   | `adapt.factKmOf`: takav dan = 0 (činjenica, A10)                                                                                                                                                                                                                        | `segment08b` pauza 10   |

MAR → HM (cilj predaje): isti uzrok kao K3 (plan cilja posle bola u izvoru + bol/umor u ned 1) — EMPTY_WEEK je bila
pauza sa razlogom (validator), WEEK_INFEASIBLE konstruktor (referenca rasterećenja).

## Merenje pre (836a5cd, worktree) → posle (iz `web/`, HM)

| skripta                                                                       | pre                                          | posle           |
| ----------------------------------------------------------------------------- | -------------------------------------------- | --------------- |
| `locked-test.ts HM 97` (odbijeno / tokova; kontrola)                          | 3193 / 4550; 0                               | **0** / 4550; 0 |
| `locked-pause.ts HM 193 97 29`                                                | 258 / 35 408 (TEST)                          | **0**           |
| `last-weeks.ts HM 193 97 29` (inv „trkačka + trka < minimum")                 | 6 / 74 836                                   | **0**           |
| `prestart-chain.ts` (HM)                                                      | 61 EMPTY_WEEK + 116 WEEK_INFEASIBLE / 35 224 | **0**           |
| `handoff-adapt.ts 'MAR>HM' 193 97 29` (new / cum)                             | 136 / 136 od 44 676                          | **0 / 0**       |
| `two-step.ts HM` korak 1 locked (cum): odbijeno / inv                         | 12 TEST / 0                                  | **0** / 0       |
| `mixed-deload.ts` / `fatigue-monday` / `fatigue-repeat end` / `locked-result` | 19/449 (sva sa upozorenjem) / 206+34 / 0 / 0 | isto            |
| `start-day.ts HM 25` / `fatigue-testweek.ts HM 25` / `early.ts HM 193 97 29`  | 0 / 0 / 0 (inv 0, common 0)                  | isto            |

`two-step` locked → cum: nezavisna provera `lib.commonChecks` DUGI<LAGAN 114 pre i posle (zaključan lagan među
budućim danima; po odluci HM-08 „dugi ≥ lagan" važi samo među preostalim danima — provera organizatora ih ne izuzima).

## Regresija (`segment-08/reg37.ts`, `cls.ts`; heš bez napomena, upozorenja, policyVersion)

Generator 25 122 i ciljana 16 275: 0 promena. Rana 4a 114 012: odbijanja 0 → 0; promenjeno 13 425 — svi su tokovi sa
danima poznatim iz pokrivenosti bez zapisa (pause10, pause35, chain, painPause, chain/2): 13 359 imaju dane
IDENTIČNE stanju pre pouke 37 (e2e482e — „bez zaštićenih"), razlika samo `adaptation.mixedWeeks/factKm`; 66
(chain/2) planirano raste u odnosu na 836a5cd i nigde ne prelazi e2e482e (`up.ts`). Cilj 258 (chain/2): A2 manjak
kao na e2e482e. K1/K2/K3: tokovi mreža su ranije bili odbijeni — u rani/ciljani skup ne ulaze.

## Sabotaže (`web/scripts/sabotage.mjs`, `--bail=1`, brz nivo) — 6/6 palo (`sabotage-08b.result.json`)

08b-a zaštićen samo ≤ asOf · 08b-c sve odmor = EMPTY_WEEK · 08b-d bez reference dugog · 08b-e invarijanta bez
izuzetka odmora · 08b-f pokrivenost po planu · 08b-g validator sudi zaštićen test. (Validator iz okvira ne sudi
mesto testa — framesFor sa skupom zaštićenih je tu radi jednog okvira; sabotaža „validator bez skupa" ne pada,
izbačena.) HM-08 sabotaže 5/5 i dalje padaju.

## Komande (iz `web/`)

- `npx tsc -b --noEmit` 0 · `eslint` (v2) 0 · `prettier --check` 0
- `npm run check`: 307 fajlova / 3586 testova, exit 0 (508 s)
- `TEST_FULL=1 npx vitest run --changed 836a5cd`: 224 / 1665, exit 0 (1529 s)
- pun nivo `halfMarathon/v2`: 68 / 400, exit 0 (982 s); brz nivo 34 / 308 (68 s); segment08b delovi 23–32 s
- `npx playwright test e2e/hm-v2.spec.ts`: 3/3 · `marathon/v2/app/byteSame` (`BYTE_SAME_RECORD=1`): 13 redova HM v2

## Stalni uslovi

1. Jedan vlasnik: zaštićen test `protectedTestDate`; referenca rasterećenja `deloadRefLong10` (odluka u assess);
   zbir zaštićenih `keptSum100`. 2–3. Plafoni i WU/CD nedirnuti. 4. Zaštita/činjenice unapred (framesFor, korak).
2. Handoff: cilj MAR → HM bez odbijanja. 6. `hm-v2.6.1`. 7. Bez uvoza van foldera. 8. Mreže 0 odbijanja.
